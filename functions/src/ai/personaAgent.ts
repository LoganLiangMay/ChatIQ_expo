/**
 * IQT Mode: Persona Agent
 * Generates AI responses that mimic user's communication style
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';

// Singleton Pinecone client (reused across invocations)
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

// Extract keywords from query (remove stop words)
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
    'in', 'to', 'of', 'for', 'with', 'as', 'by', 'from', 'this', 'that',
    'it', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may',
    'can', 'if', 'then', 'so', 'not', 'no', 'yes'
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5); // Limit to 5 keywords
}

export const personaAgent = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { query, chatId } = data;
    const userId = context.auth.uid;

    if (!query || !chatId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'query and chatId are required'
      );
    }

    try {
      functions.logger.info('🤖 IQT: Processing query', {
        userId,
        chatId,
        queryLength: query.length
      });

      // 1. Fetch user's personality profile
      const db = admin.firestore();
      const userDoc = await db
        .doc(`users/${userId}`)
        .get();

      if (!userDoc.exists) {
        functions.logger.warn('User document not found', { userId });
        return {
          responseText: null,
          confidence: 0,
          sources: [],
          reason: 'User not found'
        };
      }

      const personality = userDoc.data()?.personality;

      if (!personality || !personality.enabled) {
        functions.logger.warn('No personality profile found or IQT not enabled', { userId });
        return {
          responseText: null,
          confidence: 0,
          sources: [],
          reason: 'No personality profile configured or IQT Mode disabled'
        };
      }

      functions.logger.info('Loaded personality', {
        tone: personality?.tone,
        avgLength: personality?.avgLength
      });

      // 2. Query Bulletins (keyMessages) with enriched context
      const keywords = extractKeywords(query);
      functions.logger.info('Extracted keywords', { keywords });

      let bulletins: any[] = [];

      if (keywords.length > 0) {
        const bulletinQuery = db
          .collectionGroup('keyMessages')
          .where('tags', 'array-contains-any', keywords)
          .orderBy('savedAt', 'desc') // Fixed: was 'timestamp', should be 'savedAt'
          .limit(10);

        const bulletinSnapshot = await bulletinQuery.get();
        bulletins = bulletinSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        functions.logger.info('Found bulletins', {
          count: bulletins.length,
          hasEnrichedContext: bulletins.filter(b => b.enrichedContext).length
        });
      }

      // 3. LLM-based relevance scoring for bulletins
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o', // Upgraded for better relevance scoring
        temperature: 0,
        apiKey: process.env.OPENAI_API_KEY
      });

      const bulletinScores = await Promise.all(
        bulletins.map(async (bulletin: any) => {
          try {
            const prompt = `On a scale of 0-100, how relevant is this text to answering the query? ` +
              `Respond with ONLY the number (e.g., "85").\n\n` +
              `Text: ${bulletin.text}\nQuery: ${query}\n\nRelevance score:`;

            const result = await llm.invoke(prompt);
            const scoreStr = result.content.toString().trim();
            const score = parseInt(scoreStr, 10);
            return { bulletin, score: isNaN(score) ? 0 : score };
          } catch (error) {
            functions.logger.error('Bulletin scoring failed', { error });
            return { bulletin, score: 0 };
          }
        })
      );

      const relevantBulletins = bulletinScores
        .filter(({ score }) => score > 90)
        .sort((a, b) => b.score - a.score);

      functions.logger.info('Relevant bulletins', {
        count: relevantBulletins.length,
        maxScore: relevantBulletins[0]?.score || 0
      });

      // 4. RAG Query with Pinecone (with user namespace!)
      const pinecone = await getPineconeClient();
      const indexName = process.env.PINECONE_INDEX_NAME;
      if (!indexName) {
        throw new Error('PINECONE_INDEX_NAME not set');
      }

      const index = pinecone.Index(indexName);
      const embeddings = new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY,
        dimensions: 1536
      });

      functions.logger.info('Querying Pinecone', {
        namespace: userId,
        query: query.substring(0, 50)
      });

      // Create query embedding
      const queryEmbedding = await embeddings.embedQuery(query);

      // Query Pinecone directly in user's namespace
      const queryResponse = await index.namespace(userId).query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true,
        filter: {
          type: { $eq: 'saved_message' }
        }
      });

      // Extract results with scores
      const ragResults = queryResponse.matches?.map(match => ({
        pageContent: match.metadata?.text || '',
        metadata: match.metadata || {},
        score: match.score || 0
      })) || [];

      const relevantRags = ragResults.slice(0, 3); // Take top 3

      functions.logger.info('Pinecone results', {
        found: ragResults.length,
        topScore: ragResults[0]?.score || 0,
        topTopic: ragResults[0]?.metadata?.topic || 'none'
      });

      functions.logger.info('RAG results', {
        total: ragResults.length,
        relevant: relevantRags.length
      });

      // 5. Calculate overall confidence
      const ragConfidence = relevantRags.length > 0 ? 0.75 : 0; // Simplified confidence
      const bulletinConfidence = relevantBulletins.length > 0
        ? relevantBulletins[0].score / 100
        : 0;

      const overallConfidence = Math.max(ragConfidence, bulletinConfidence);

      functions.logger.info('Confidence scores', {
        rag: ragConfidence,
        bulletin: bulletinConfidence,
        overall: overallConfidence
      });

      // 6. If confidence too low, return early
      if (overallConfidence < 0.7) {
        return {
          responseText: null,
          confidence: overallConfidence,
          sources: [],
          reason: 'Confidence too low - insufficient context to generate accurate response'
        };
      }

      // 7. Build context from sources
      const contextParts: string[] = [];
      const sources: Array<{ type: 'rag' | 'bulletin'; content: string; score?: number }> = [];

      relevantBulletins.forEach(({ bulletin, score }) => {
        contextParts.push(`Key Message: ${bulletin.text}`);
        sources.push({ type: 'bulletin', content: bulletin.text, score: score / 100 });
      });

      relevantRags.forEach((doc) => {
        const content = String(doc.pageContent || doc.metadata?.text || '');
        if (content) {
          contextParts.push(`Knowledge: ${content}`);
          sources.push({ type: 'rag', content, score: doc.score || 0.75 });
        }
      });

      const context = contextParts.join('\n\n');

      // 8. Generate response mimicking user's style
      const responsePrompt = `You are mimicking the communication style of a user. Generate a response that sounds like them.

User's Communication Profile:
- Tone: ${personality.tone || 'neutral'}
- Typical response length: ${personality.avgLength || 100} words
- Common phrases: ${(personality.phrases || []).join(', ') || 'none'}

Context from their knowledge base:
${context}

Question to answer: ${query}

Generate a response that:
1. Sounds like it came from the user
2. Uses their communication style and phrases
3. Is approximately ${personality.avgLength || 100} words
4. Answers the question based on the context provided

Response:`;

      const responseLlm = new ChatOpenAI({
        modelName: 'gpt-4o', // Upgraded for better persona mimicry
        temperature: 0.7,
        apiKey: process.env.OPENAI_API_KEY
      });

      const result = await responseLlm.invoke(responsePrompt);
      const responseText = result.content.toString();

      functions.logger.info('✅ Response generated', {
        length: responseText.length,
        confidence: overallConfidence
      });

      return {
        responseText,
        confidence: overallConfidence,
        sources,
        reason: `Generated based on ${sources.length} sources`
      };
    } catch (error: any) {
      functions.logger.error('personaAgent failed', { error: error.message });
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to generate response'
      );
    }
  });
