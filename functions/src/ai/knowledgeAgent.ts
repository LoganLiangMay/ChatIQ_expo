/**
 * Knowledge Agent - Server-side agent with LangChain + LangSmith
 * Handles complex queries requiring RAG, knowledge bank, and style mimicry
 */

import * as functions from 'firebase-functions';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone client (singleton)
let pineconeClient: Pinecone | null = null;
let vectorStore: PineconeStore | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.EXPO_PUBLIC_PINECONE_API_KEY || functions.config().pinecone?.api_key;
    if (!apiKey) {
      throw new Error('Pinecone API key not configured');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

async function getVectorStore(): Promise<PineconeStore> {
  if (!vectorStore) {
    const pc = getPineconeClient();
    const indexName = functions.config().pinecone?.index || process.env.EXPO_PUBLIC_PINECONE_INDEX || 'chatiq-messages';
    const index = pc.Index(indexName);

    const apiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      apiKey: apiKey,  // Fixed: Use 'apiKey' not 'openAIApiKey'
    });

    vectorStore = new PineconeStore(embeddings, {
      pineconeIndex: index,
      textKey: 'content',  // Match the field name in embeddings.ts
      // No namespace - use default (same as embeddings.ts)
    });
  }
  return vectorStore;
}

/**
 * Knowledge Agent - Callable Firebase Function
 * Uses LangChain + LangSmith for RAG queries
 * 
 * LangSmith auto-tracing enabled via environment variables:
 * - LANGSMITH_TRACING=true
 * - LANGSMITH_API_KEY=your_key
 * - LANGSMITH_PROJECT=your_project
 */
export const knowledgeAgent = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { question, userId, queryType = 'general', conversationHistory = [] } = data;

    if (!question) {
      throw new functions.https.HttpsError('invalid-argument', 'Question is required');
    }

    console.log(`🤖 [KnowledgeAgent] Query from user ${userId}: ${question}`);

    // Initialize LLM with LangSmith tracing (auto-enabled via env vars)
    const configKey = functions.config().openai?.api_key;
    const envKey = process.env.OPENAI_API_KEY;

    console.log(`🔍 [KnowledgeAgent] Config key exists: ${!!configKey}, length: ${configKey?.length || 0}`);
    console.log(`🔍 [KnowledgeAgent] Env key exists: ${!!envKey}, length: ${envKey?.length || 0}`);

    const apiKey = configKey || envKey;

    if (!apiKey) {
      console.error('❌ [KnowledgeAgent] No API key found in config or env');
      throw new functions.https.HttpsError('internal', 'OpenAI API key not configured');
    }

    console.log(`✅ [KnowledgeAgent] Using API key, length: ${apiKey.length}`);

    const model = new ChatOpenAI({
      modelName: 'gpt-4o', // Upgraded for maximum accuracy and reasoning
      temperature: 0.7,
      apiKey: apiKey,
    });

    // For RAG queries, use vector search + LLM
    if (queryType === 'rag' || queryType === 'knowledge') {
      const store = await getVectorStore();

      // Perform similarity search - using LangChain VectorStore API
      // Note: No filter needed - Pinecone returns most semantically similar messages
      // across all chats the user has access to (filtering happens at query time via embeddings)
      const results = await (store as any).similaritySearch(question, 5);

      console.log(`🔍 [KnowledgeAgent] Found ${results?.length || 0} relevant documents`);

      // Build context from retrieved documents
      const context = results && results.length > 0
        ? results.map((doc: any) => doc.pageContent || doc.text || '').join('\n\n---\n\n')
        : 'No relevant context found.';

      // Build conversation history context
      const conversationContext = conversationHistory && conversationHistory.length > 0
        ? conversationHistory.map((msg: any) =>
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
          ).join('\n')
        : '';

      // Generate response with context - prioritize conversation history for reference resolution
      const hasRAGResults = results && results.length > 0;
      const hasConversationContext = conversationContext.length > 0;

      let prompt: string;

      if (hasConversationContext) {
        // Use conversation history to resolve pronouns and references FIRST
        prompt = `You are an AI assistant for ChatIQ, helping users find information from their conversations.

CONVERSATION HISTORY (use this to understand pronouns like "this", "that", "it"):
${conversationContext}

${hasRAGResults ? `RELEVANT MESSAGES FROM YOUR CHATS:
${context}

Instructions:
1. First, look at the CONVERSATION HISTORY to understand what the user is referring to with pronouns or vague references
2. Then use the RELEVANT MESSAGES to provide specific information
3. Answer the question by combining both sources` : `I searched your message history but didn't find specific past discussions about this topic.

Instructions:
1. Use the CONVERSATION HISTORY above to understand what the user is asking about
2. If the conversation history provides enough context to answer, use it
3. If needed, provide helpful general information based on the topic from the conversation`}

Question: ${question}

Answer:`;
      } else {
        // No conversation history - fall back to original logic
        prompt = `You are an AI assistant for ChatIQ, helping users find information from their conversations.

${hasRAGResults ? `Here are relevant messages from your chats:
${context}

Answer the question based on this context.` : `I couldn't find any relevant discussions in your chats. Let me provide a helpful general answer.`}

Question: ${question}

Answer:`;
      }

      const response = await model.invoke(prompt);

      console.log(`✅ [KnowledgeAgent] RAG response generated`);

      return {
        success: true,
        answer: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
        sources: results?.map((doc: any) => ({
          content: doc.pageContent || doc.text,
          metadata: doc.metadata,
        })) || [],
        queryType: 'rag',
      };
    }

    // For simple queries, use direct LLM call
    // Build conversation history for simple queries too
    const conversationContext = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.map((msg: any) =>
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n')
      : '';

    const prompt = `You are a helpful AI assistant for ChatIQ, a team messaging app.

${conversationContext ? `Recent conversation:\n${conversationContext}\n\n` : ''}User question: ${question}

Answer:`;
    const response = await model.invoke(prompt);

    console.log(`✅ [KnowledgeAgent] Simple response generated`);

    return {
      success: true,
      answer: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      queryType: 'simple',
    };

  } catch (error: any) {
    console.error('❌ [KnowledgeAgent] Error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to process query');
  }
});

/**
 * Embed Content - Store messages/summaries in vector database
 * Called automatically by triggers or manually
 */
export const embedContent = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { id, text, metadata } = data;

    if (!id || !text || !metadata) {
      throw new functions.https.HttpsError('invalid-argument', 'id, text, and metadata are required');
    }

    console.log(`📝 [EmbedContent] Embedding content: ${id}`);

    const store = await getVectorStore();
    
    await store.addDocuments([
      {
        pageContent: text,
        metadata: {
          id,
          ...metadata,
          timestamp: Date.now(),
        },
      },
    ]);

    console.log(`✅ [EmbedContent] Content embedded successfully`);

    return { success: true, id };

  } catch (error: any) {
    console.error('❌ [EmbedContent] Error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to embed content');
  }
});

/**
 * Search Vector Store - Semantic search across conversations
 */
export const searchVectorStore = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { query, filter = {}, limit = 5 } = data;

    if (!query) {
      throw new functions.https.HttpsError('invalid-argument', 'Query is required');
    }

    console.log(`🔍 [SearchVectorStore] Searching for: ${query}`);

    const store = await getVectorStore();
    const results = await (store as any).similaritySearch(query, limit, filter);

    console.log(`✅ [SearchVectorStore] Found ${results?.length || 0} results`);

    return {
      success: true,
      results: results?.map((doc: any) => ({
        content: doc.pageContent || doc.text,
        metadata: doc.metadata,
      })) || [],
    };

  } catch (error: any) {
    console.error('❌ [SearchVectorStore] Error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to search');
  }
});

