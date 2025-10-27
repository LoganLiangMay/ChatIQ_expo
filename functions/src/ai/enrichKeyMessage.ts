/**
 * Enrich Key Message with Context
 * Uses LLM to analyze surrounding messages and chat context
 * to create rich, contextual knowledge for IQT
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';

interface SurroundingMessage {
  content: string;
  senderName: string;
  timestamp: any;
}

interface ChatContext {
  chatName?: string;
  chatDescription?: string;
  isGroup: boolean;
}

export const enrichKeyMessage = functions
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const {
      messageText,
      messageId,
      chatId,
      surroundingMessages,
      chatContext
    } = data;

    const userId = context.auth.uid;

    if (!messageText || !messageId || !chatId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'messageText, messageId, and chatId are required'
      );
    }

    try {
      functions.logger.info('🔍 Enriching key message with context', {
        userId,
        chatId,
        messageLength: messageText.length,
        surroundingCount: surroundingMessages?.length || 0
      });

      // Build context prompt for LLM
      const contextPrompt = buildContextPrompt(
        messageText,
        surroundingMessages || [],
        chatContext || {}
      );

      // Use LLM to analyze and extract rich context
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o', // Upgraded for better context extraction
        temperature: 0,
        apiKey: process.env.OPENAI_API_KEY
      });

      const analysisResult = await llm.invoke(contextPrompt);
      const analysis = analysisResult.content.toString();

      functions.logger.info('✅ LLM analysis complete', {
        analysisLength: analysis.length
      });

      // Parse the LLM response
      const enrichedData = parseAnalysis(analysis, messageText);

      // Save to Firestore with enhanced context
      const db = admin.firestore();
      const savedAt = admin.firestore.Timestamp.now();

      await db
        .collection(`users/${userId}/keyMessages`)
        .doc(messageId)
        .set({
          // Original message
          text: messageText,
          messageId: messageId,
          chatId: chatId,
          savedAt: savedAt, // Required by SavedMessages component

          // Enhanced context from LLM
          enrichedContext: enrichedData.contextSummary,
          specificTopic: enrichedData.specificTopic,
          entities: enrichedData.entities,
          relatedQuestions: enrichedData.relatedQuestions,
          tags: enrichedData.tags,

          // Chat metadata
          chatName: chatContext?.chatName || null,
          chatDescription: chatContext?.chatDescription || null,
          isGroupChat: chatContext?.isGroup || false
        });

      functions.logger.info('✅ Enriched key message saved to Firestore', {
        tags: enrichedData.tags.length,
        entities: enrichedData.entities.length
      });

      // Embed in Pinecone for semantic search (async, non-blocking)
      embedMessageInPinecone(
        userId,
        messageId,
        chatId,
        messageText,
        enrichedData
      ).catch((error) => {
        functions.logger.warn('Failed to embed in Pinecone (non-critical)', {
          error: error.message
        });
      });

      return {
        success: true,
        tags: enrichedData.tags,
        contextSummary: enrichedData.contextSummary,
        specificTopic: enrichedData.specificTopic
      };
    } catch (error: any) {
      functions.logger.error('❌ Failed to enrich key message', {
        error: error.message
      });
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to enrich key message'
      );
    }
  });

/**
 * Build prompt for LLM to analyze context
 */
function buildContextPrompt(
  messageText: string,
  surroundingMessages: SurroundingMessage[],
  chatContext: ChatContext
): string {
  // Build conversation history
  const conversationHistory = surroundingMessages
    .map(msg => `${msg.senderName}: ${msg.content}`)
    .join('\n');

  const chatInfo = chatContext.chatName
    ? `Chat: "${chatContext.chatName}"${chatContext.chatDescription ? ` - ${chatContext.chatDescription}` : ''}`
    : chatContext.isGroup ? 'Group Chat' : 'Direct Chat';

  return `You are analyzing a saved message to extract rich context for an AI knowledge base.

CHAT CONTEXT:
${chatInfo}

CONVERSATION HISTORY (messages leading up to the saved message):
${conversationHistory || '(No prior messages available)'}

SAVED MESSAGE:
"${messageText}"

Your task is to analyze this message and its context to extract:

1. **Context Summary** (2-3 sentences): What is the broader context? What project, topic, or situation is being discussed?

2. **Specific Topic**: What is the specific subject matter? (e.g., "Safety Training Project Deadline", "Q3 Budget Approval", "Team Meeting Schedule")

3. **Entities**: Extract key entities like project names, dates, locations, people, amounts, etc.

4. **Related Questions**: List 3-5 questions someone might ask that this message would help answer.

5. **Keywords/Tags**: Extract 5-10 relevant keywords for search/matching (avoid common words).

Format your response EXACTLY as follows:

CONTEXT_SUMMARY: [Your 2-3 sentence summary]

SPECIFIC_TOPIC: [The specific topic]

ENTITIES: [entity1], [entity2], [entity3]

RELATED_QUESTIONS:
- [Question 1]
- [Question 2]
- [Question 3]

TAGS: [tag1], [tag2], [tag3], [tag4], [tag5]

Be specific and concrete. Use information from the conversation history to understand what project/topic is being discussed.`;
}

/**
 * Parse LLM analysis response
 */
function parseAnalysis(analysis: string, originalMessage: string): {
  contextSummary: string;
  specificTopic: string;
  entities: string[];
  relatedQuestions: string[];
  tags: string[];
} {
  const extractSection = (label: string): string => {
    const regex = new RegExp(`${label}:\\s*([^\\n]+(?:\\n(?!\\w+:|-).*)*)`);
    const match = analysis.match(regex);
    return match ? match[1].trim() : '';
  };

  const extractList = (label: string): string[] => {
    const regex = new RegExp(`${label}:\\s*([^\\n]+(?:\\n-[^\\n]+)*)`);
    const match = analysis.match(regex);
    if (!match) return [];

    return match[1]
      .split('\n')
      .map(item => item.replace(/^-\s*/, '').trim())
      .filter(item => item.length > 0);
  };

  const extractCommaSeparated = (label: string): string[] => {
    const text = extractSection(label);
    return text
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  return {
    contextSummary: extractSection('CONTEXT_SUMMARY') || `Context for: ${originalMessage}`,
    specificTopic: extractSection('SPECIFIC_TOPIC') || 'General Information',
    entities: extractCommaSeparated('ENTITIES'),
    relatedQuestions: extractList('RELATED_QUESTIONS'),
    tags: extractCommaSeparated('TAGS').slice(0, 10) // Max 10 tags
  };
}

/**
 * Embed saved message in Pinecone for semantic search
 */
async function embedMessageInPinecone(
  userId: string,
  messageId: string,
  chatId: string,
  messageText: string,
  enrichedData: {
    contextSummary: string;
    specificTopic: string;
    entities: string[];
    relatedQuestions: string[];
    tags: string[];
  }
): Promise<void> {
  try {
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME;

    if (!pineconeApiKey || !indexName) {
      throw new Error('Pinecone not configured');
    }

    // Initialize Pinecone client
    const pinecone = new Pinecone({ apiKey: pineconeApiKey });
    const index = pinecone.index(indexName);

    // Create embedding for the enriched message
    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY,
      dimensions: 1536
    });

    // Combine message with enriched context for better embedding
    const textToEmbed = `${enrichedData.specificTopic}: ${messageText}\n\nContext: ${enrichedData.contextSummary}\n\nTags: ${enrichedData.tags.join(', ')}`;

    const vector = await embeddings.embedQuery(textToEmbed);

    // Store in Pinecone with metadata
    await index.namespace(userId).upsert([
      {
        id: `saved_${messageId}`,
        values: vector,
        metadata: {
          userId,
          messageId,
          chatId,
          text: messageText,
          type: 'saved_message',
          topic: enrichedData.specificTopic,
          tags: enrichedData.tags.join(', '),
          entities: enrichedData.entities.join(', '),
          questions: enrichedData.relatedQuestions.join(' | '),
          savedAt: Date.now()
        }
      }
    ]);

    functions.logger.info('✅ Message embedded in Pinecone', {
      messageId,
      topic: enrichedData.specificTopic,
      tags: enrichedData.tags.length
    });
  } catch (error: any) {
    functions.logger.error('Failed to embed in Pinecone', {
      error: error.message,
      messageId
    });
    throw error;
  }
}
