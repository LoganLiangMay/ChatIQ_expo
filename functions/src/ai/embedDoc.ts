/**
 * IQT Mode: Document Embedding
 * Uploads and embeds documents (PDFs, text files) into user's knowledge base
 * Properly vectorizes content and stores in Pinecone
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// Singleton Pinecone client
let pineconeClient: Pinecone | null = null;

async function getPineconeClient() {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY not set');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

/**
 * Fetch file from URL as Buffer or string
 */
async function fetchFile(url: string, asBuffer: boolean = false): Promise<Buffer | string> {
  const https = await import('https');
  const http = await import('http');

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const chunks: Buffer[] = [];

    client.get(url, (res) => {
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(asBuffer ? buffer : buffer.toString('utf-8'));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Extract text from PDF buffer using pdfjs-dist (Node.js compatible)
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl: `${require.resolve('pdfjs-dist')}/standard_fonts/`,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    functions.logger.info('PDF loaded', { numPages });

    // Extract text from all pages
    const textPages: string[] = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      textPages.push(pageText);
    }

    const fullText = textPages.join('\n\n');
    functions.logger.info('PDF text extracted', {
      pages: numPages,
      totalChars: fullText.length
    });

    return fullText;
  } catch (error: any) {
    functions.logger.error('PDF extraction failed', { error: error.message });
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Detect file type and extract text content
 */
async function extractTextContent(fileUrl: string, fileName: string): Promise<string> {
  const extension = fileName.toLowerCase().split('.').pop();

  functions.logger.info('Extracting text from file', { fileName, extension });

  switch (extension) {
    case 'pdf': {
      const buffer = await fetchFile(fileUrl, true) as Buffer;
      return await extractPdfText(buffer);
    }
    case 'txt':
    case 'md':
    case 'json':
    case 'csv':
    case 'log': {
      return await fetchFile(fileUrl, false) as string;
    }
    default:
      // Try to treat as text by default
      try {
        return await fetchFile(fileUrl, false) as string;
      } catch {
        throw new Error(`Unsupported file type: ${extension}. Supported formats: PDF, TXT, MD, JSON, CSV`);
      }
  }
}

export const embedDoc = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { fileUrl, fileName } = data;
    const userId = context.auth.uid;

    if (!fileUrl || !fileName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'fileUrl and fileName are required'
      );
    }

    try {
      functions.logger.info('📄 Embedding document', {
        userId,
        fileName
      });

      // 1. Extract text content from file
      const fileContent = await extractTextContent(fileUrl, fileName);

      if (!fileContent || fileContent.trim().length === 0) {
        throw new Error('File is empty or contains no extractable text');
      }

      functions.logger.info('File content extracted', {
        contentLength: fileContent.length,
        preview: fileContent.substring(0, 100) + '...'
      });

      // 2. Split document into semantic chunks using LangChain
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,      // Larger chunks for better context
        chunkOverlap: 200,    // More overlap for continuity
        separators: ['\n\n', '\n', '. ', ' ', ''], // Semantic boundaries
      });

      const chunks = await textSplitter.splitText(fileContent);

      if (chunks.length === 0) {
        throw new Error('Failed to split document into chunks');
      }

      functions.logger.info('Document split into chunks', {
        chunks: chunks.length,
        avgChunkSize: Math.round(fileContent.length / chunks.length)
      });

      // 3. Prepare documents with metadata for Pinecone
      const timestamp = Date.now();
      const docId = `doc_${userId}_${timestamp}`;

      const documentsToEmbed = chunks.map((chunk, index) => ({
        pageContent: chunk,
        metadata: {
          id: `${docId}_chunk_${index}`,
          type: 'document',
          userId,
          fileName,
          documentId: docId,
          chunkIndex: index,
          totalChunks: chunks.length,
          uploadedAt: timestamp,
          // Add these for better filtering in queries
          source: 'user_upload',
          contentType: fileName.split('.').pop() || 'unknown'
        }
      }));

      functions.logger.info('Prepared documents for embedding', {
        documents: documentsToEmbed.length
      });

      // 4. Initialize Pinecone
      const pinecone = await getPineconeClient();
      const indexName = process.env.PINECONE_INDEX_NAME;
      if (!indexName) {
        throw new Error('PINECONE_INDEX_NAME not set');
      }

      functions.logger.info('Connecting to Pinecone index', { indexName });

      const index = pinecone.Index(indexName);
      const embeddings = new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY,
        dimensions: 1536, // Ensure consistent dimensions
      });

      // 5. Embed and store in Pinecone using PineconeStore
      functions.logger.info('Creating embeddings and uploading to Pinecone...');

      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        namespace: userId, // Use userId as namespace for data isolation
      });

      // Add documents to Pinecone
      await vectorStore.addDocuments(documentsToEmbed);

      functions.logger.info('✅ Vectors uploaded to Pinecone', {
        chunks: chunks.length,
        namespace: userId
      });

      // 6. Store metadata in Firestore
      const db = admin.firestore();

      await db
        .collection(`users/${userId}/documents`)
        .doc(docId)
        .set({
          fileName,
          fileUrl,
          documentId: docId,
          chunks: chunks.length,
          characters: fileContent.length,
          uploadedAt: admin.firestore.Timestamp.now(),
          status: 'embedded',
          fileType: fileName.split('.').pop() || 'unknown',
          // Add pinecone metadata
          pineconeNamespace: userId,
          pineconeIndexName: indexName,
        });

      functions.logger.info('✅ Metadata saved to Firestore', {
        docId,
        collection: `users/${userId}/documents`
      });

      return {
        success: true,
        docId,
        fileName,
        chunks: chunks.length,
        characters: fileContent.length,
        message: `Successfully embedded ${chunks.length} chunks from ${fileName}`
      };
    } catch (error: any) {
      functions.logger.error('❌ embedDoc failed', {
        error: error.message,
        stack: error.stack,
        fileName
      });

      // Try to store error in Firestore
      try {
        const db = admin.firestore();
        const timestamp = Date.now();
        const docId = `doc_${userId}_${timestamp}`;

        await db
          .collection(`users/${userId}/documents`)
          .doc(docId)
          .set({
            fileName: fileName || 'unknown',
            fileUrl: fileUrl || '',
            documentId: docId,
            chunks: 0,
            characters: 0,
            uploadedAt: admin.firestore.Timestamp.now(),
            status: 'error',
            error: error.message,
            fileType: fileName?.split('.').pop() || 'unknown',
          });

        functions.logger.info('Error metadata saved to Firestore', { docId });
      } catch (dbError: any) {
        functions.logger.error('Failed to store error in Firestore', {
          dbError: dbError.message
        });
      }

      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to embed document'
      );
    }
  });
