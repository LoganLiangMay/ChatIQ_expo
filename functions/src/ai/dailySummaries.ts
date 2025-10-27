import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callChatCompletion } from './openai';
import { PROMPTS } from './prompts';

/**
 * Daily Chat Summaries - Automatic Background Summarization
 * 
 * Features:
 * - Runs every day at 1 AM UTC
 * - Summarizes active chats from previous day
 * - Stores summaries in Firestore: /chats/{chatId}/summaries/{date}
 * - Can be manually triggered by users (updates existing summary)
 * - Embeds summaries for AI Assistant RAG context
 */

interface DailySummary {
  date: string; // YYYY-MM-DD format
  summary: string;
  messageCount: number;
  participants: string[];
  timeRange: {
    start: number;
    end: number;
  };
  createdAt: number;
  updatedAt: number;
  generatedBy: 'auto' | 'manual'; // Track how summary was created
  userId?: string; // If manually generated, track who requested it
}

/**
 * Scheduled function: Auto-generate daily summaries for active chats
 * Runs every day at 1 AM UTC (can be configured)
 */
export const generateDailySummaries = functions.pubsub
  .schedule('0 1 * * *') // Every day at 1 AM UTC (5 PM PST / 8 PM EST)
  .timeZone('UTC')
  .onRun(async (context) => {
    const firestore = admin.firestore();
    
    try {
      // Calculate yesterday's date range
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);
      
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setUTCHours(23, 59, 59, 999);
      
      const dateKey = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
      const startTimestamp = yesterday.getTime();
      const endTimestamp = yesterdayEnd.getTime();
      
      functions.logger.info('Starting daily summary generation', {
        date: dateKey,
        startTimestamp,
        endTimestamp,
      });
      
      // Find all chats with messages from yesterday
      const chatsSnapshot = await firestore.collection('chats').get();
      
      let processedChats = 0;
      let skippedChats = 0;
      let errors = 0;
      
      for (const chatDoc of chatsSnapshot.docs) {
        const chatId = chatDoc.id;
        
        try {
          // Check if summary already exists for this date
          const existingSummary = await firestore
            .collection('chats')
            .doc(chatId)
            .collection('summaries')
            .doc(dateKey)
            .get();
          
          if (existingSummary.exists) {
            functions.logger.info('Summary already exists, skipping', {
              chatId,
              date: dateKey,
            });
            skippedChats++;
            continue;
          }
          
          // Get messages from yesterday
          const messagesSnapshot = await firestore
            .collection('chats')
            .doc(chatId)
            .collection('messages')
            .where('timestamp', '>=', startTimestamp)
            .where('timestamp', '<=', endTimestamp)
            .orderBy('timestamp', 'asc')
            .limit(100) // Limit to 100 messages per day
            .get();
          
          if (messagesSnapshot.empty) {
            functions.logger.info('No messages found for date, skipping', {
              chatId,
              date: dateKey,
            });
            skippedChats++;
            continue;
          }
          
          // Generate summary for this chat
          await generateAndSaveSummary(
            chatId,
            dateKey,
            messagesSnapshot,
            'auto'
          );
          
          processedChats++;
          
          // Add delay to avoid rate limits (1 second between chats)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error: any) {
          functions.logger.error('Error processing chat for daily summary', {
            chatId,
            date: dateKey,
            error: error.message,
          });
          errors++;
        }
      }
      
      functions.logger.info('Daily summary generation complete', {
        date: dateKey,
        processedChats,
        skippedChats,
        errors,
        totalChats: chatsSnapshot.size,
      });
      
      return { success: true, processedChats, skippedChats, errors };
      
    } catch (error: any) {
      functions.logger.error('Fatal error in daily summary generation', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  });

/**
 * Manual trigger: Generate or update summary for a specific date
 * Called when user opens chat and requests summary
 */
export const saveChatSummary = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { chatId, summary, messageCount, participants, timeRange, date } = data;
    
    // Validate input
    if (!chatId || !summary || !date) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'chatId, summary, and date are required'
      );
    }
    
    try {
      const firestore = admin.firestore();
      
      // Verify user is a participant
      const chatDoc = await firestore.collection('chats').doc(chatId).get();
      
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Chat not found');
      }
      
      const chatData = chatDoc.data();
      const chatParticipants = chatData?.participants || [];
      
      if (!chatParticipants.includes(context.auth.uid)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User is not a participant in this chat'
        );
      }
      
      // Determine date key (YYYY-MM-DD format)
      const dateKey = date || new Date().toISOString().split('T')[0];
      
      // Check if summary exists
      const summaryRef = firestore
        .collection('chats')
        .doc(chatId)
        .collection('summaries')
        .doc(dateKey);
      
      const existingSummary = await summaryRef.get();
      const now = Date.now();
      
      const summaryData: DailySummary = {
        date: dateKey,
        summary,
        messageCount: messageCount || 0,
        participants: participants || [],
        timeRange: timeRange || { start: now, end: now },
        createdAt: existingSummary.exists ? existingSummary.data()!.createdAt : now,
        updatedAt: now,
        generatedBy: 'manual',
        userId: context.auth.uid,
      };
      
      await summaryRef.set(summaryData, { merge: true });
      
      functions.logger.info('Summary saved/updated', {
        chatId,
        date: dateKey,
        userId: context.auth.uid,
        isUpdate: existingSummary.exists,
      });
      
      // Optionally: Embed summary for RAG (async, don't wait)
      embedSummaryForRAG(chatId, dateKey, summary, summaryData).catch(
        (error) => {
          functions.logger.error('Failed to embed summary (non-critical)', {
            chatId,
            date: dateKey,
            error: error.message,
          });
        }
      );
      
      return {
        success: true,
        date: dateKey,
        updated: existingSummary.exists,
      };
      
    } catch (error: any) {
      functions.logger.error('Error saving summary', {
        error: error.message,
        chatId,
        userId: context.auth?.uid,
      });
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        `Failed to save summary: ${error.message}`
      );
    }
  }
);

/**
 * Get historical summaries for a chat
 * Returns summaries ordered by date (most recent first)
 */
export const getChatSummaries = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { chatId, limit = 30 } = data;
    
    if (!chatId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'chatId is required'
      );
    }
    
    try {
      const firestore = admin.firestore();
      
      // Verify user is a participant
      const chatDoc = await firestore.collection('chats').doc(chatId).get();
      
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Chat not found');
      }
      
      const chatData = chatDoc.data();
      const participants = chatData?.participants || [];
      
      if (!participants.includes(context.auth.uid)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User is not a participant in this chat'
        );
      }
      
      // Fetch summaries ordered by date DESC
      const summariesSnapshot = await firestore
        .collection('chats')
        .doc(chatId)
        .collection('summaries')
        .orderBy('date', 'desc')
        .limit(Math.min(limit, 90)) // Max 90 days
        .get();
      
      const summaries = summariesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      return { summaries };
      
    } catch (error: any) {
      functions.logger.error('Error fetching summaries', {
        error: error.message,
        chatId,
      });
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        `Failed to fetch summaries: ${error.message}`
      );
    }
  }
);

/**
 * Helper: Generate and save summary
 */
async function generateAndSaveSummary(
  chatId: string,
  dateKey: string,
  messagesSnapshot: admin.firestore.QuerySnapshot,
  generatedBy: 'auto' | 'manual',
  userId?: string
): Promise<void> {
  const firestore = admin.firestore();
  
  // Fetch sender names
  const senderIds = Array.from(
    new Set(messagesSnapshot.docs.map((doc) => doc.data().senderId))
  );
  
  const userDocs = await Promise.all(
    senderIds.map((id) => firestore.collection('users').doc(id).get())
  );
  
  const userNames = new Map<string, string>();
  userDocs.forEach((doc) => {
    if (doc.exists) {
      userNames.set(doc.id, doc.data()?.displayName || 'Unknown');
    }
  });
  
  // Build message array
  const messages = messagesSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      sender: userNames.get(data.senderId) || 'Unknown',
      content: data.content || (data.imageUrl ? '📷 Image' : '[No content]'),
      timestamp: data.timestamp,
    };
  });
  
  // Extract metadata
  const participantNames = Array.from(new Set(messages.map((m) => m.sender)));
  const timeRange = {
    start: messages[0].timestamp,
    end: messages[messages.length - 1].timestamp,
  };
  
  // Generate summary
  const promptMessages = PROMPTS.summarizeThread(messages);
  const response = await callChatCompletion(promptMessages, {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 500,
  });
  
  const summary = response.choices[0].message.content || 'Unable to generate summary';
  
  // Save to Firestore
  const now = Date.now();
  const summaryData: DailySummary = {
    date: dateKey,
    summary,
    messageCount: messages.length,
    participants: participantNames,
    timeRange,
    createdAt: now,
    updatedAt: now,
    generatedBy,
    userId,
  };
  
  await firestore
    .collection('chats')
    .doc(chatId)
    .collection('summaries')
    .doc(dateKey)
    .set(summaryData);
  
  functions.logger.info('Summary generated and saved', {
    chatId,
    date: dateKey,
    messageCount: messages.length,
    generatedBy,
  });
  
  // Embed for RAG (async)
  embedSummaryForRAG(chatId, dateKey, summary, summaryData).catch((error) => {
    functions.logger.warn('Failed to embed summary (non-critical)', {
      chatId,
      date: dateKey,
      error: error.message,
    });
  });
}

/**
 * Helper: Embed summary for RAG (Pinecone)
 * Makes summaries searchable by AI Assistant
 */
async function embedSummaryForRAG(
  chatId: string,
  dateKey: string,
  summary: string,
  metadata: DailySummary
): Promise<void> {
  try {
    // Import embedding function
    const { embedMessage } = require('./embeddings');
    
    // Create unique ID for summary
    const summaryId = `summary_${chatId}_${dateKey}`;
    
    // Embed with enriched metadata
    await embedMessage(
      summaryId,
      chatId,
      `Daily Summary (${dateKey}): ${summary}`,
      {
        type: 'daily_summary',
        date: dateKey,
        messageCount: metadata.messageCount,
        participants: metadata.participants.join(', '),
        generatedBy: metadata.generatedBy,
      }
    );
    
    functions.logger.info('Summary embedded for RAG', {
      chatId,
      date: dateKey,
      summaryId,
    });
    
  } catch (error: any) {
    // Non-critical error - log and continue
    functions.logger.warn('Summary embedding failed', {
      chatId,
      date: dateKey,
      error: error.message,
    });
  }
}

