/**
 * Smart Semantic Search
 * 
 * Searches messages by meaning, not just keywords
 * Uses OpenAI to re-rank results semantically
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getOpenAIClient } from './openai';
import { PROMPTS } from './prompts';

export interface SearchFilters {
  chatId?: string;
  senderId?: string;
  dateFrom?: number;
  dateTo?: number;
  priorityOnly?: boolean;
  hasActionItems?: boolean;
}

export interface MessageSearchResult {
  messageId: string;
  chatId: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  relevanceScore: number;
  context?: {
    before: Array<{ sender: string; content: string }>;
    after: Array<{ sender: string; content: string }>;
  };
  chatName?: string;
  isPriority?: boolean;
}

/**
 * Search messages with semantic understanding
 * 
 * Flow:
 * 1. Fetch recent messages from Firestore (keyword filter)
 * 2. Use OpenAI to re-rank by semantic similarity
 * 3. Add context (messages before/after)
 * 4. Return top results
 */
export async function searchMessages(
  query: string,
  userId: string,
  filters?: SearchFilters,
  limit: number = 20
): Promise<MessageSearchResult[]> {
  const db = getFirestore();

  // Step 1: Fetch messages from Firestore with filters
  const messages = await fetchMessages(db, userId, query, filters);

  if (messages.length === 0) {
    return [];
  }

  // Step 2: Re-rank with OpenAI for semantic similarity
  const rankedMessages = await rankMessagesBySemantic(query, messages);

  // Step 3: Add context (messages before/after)
  const enrichedResults = await addContextToResults(db, rankedMessages, limit);

  return enrichedResults;
}

/**
 * Fetch messages from Firestore with basic filters
 */
async function fetchMessages(
  db: FirebaseFirestore.Firestore,
  userId: string,
  query: string,
  filters?: SearchFilters
): Promise<Array<{
  messageId: string;
  chatId: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  isPriority?: boolean;
}>> {
  const messages: Array<any> = [];
  const queryLower = query.toLowerCase();

  // Get all chats user is part of
  const chatsSnapshot = await db
    .collection('chats')
    .where('participants', 'array-contains', userId)
    .limit(50) // Limit chats to scan
    .get();

  // For each chat, fetch recent messages
  for (const chatDoc of chatsSnapshot.docs) {
    const chatId = chatDoc.id;
    const chatData = chatDoc.data();

    // Apply chat filter if specified
    if (filters?.chatId && chatId !== filters.chatId) {
      continue;
    }

    // Build message query
    let messagesQuery = db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(100); // Fetch last 100 messages per chat

    // Apply date filters
    if (filters?.dateFrom) {
      messagesQuery = messagesQuery.where('timestamp', '>=', filters.dateFrom);
    }
    if (filters?.dateTo) {
      messagesQuery = messagesQuery.where('timestamp', '<=', filters.dateTo);
    }

    const messagesSnapshot = await messagesQuery.get();

    // Filter messages
    for (const msgDoc of messagesSnapshot.docs) {
      const msgData = msgDoc.data();
      
      // Apply filters
      if (filters?.senderId && msgData.senderId !== filters.senderId) {
        continue;
      }
      if (filters?.priorityOnly && !msgData.isPriority) {
        continue;
      }

      // Basic keyword filter (before AI re-ranking)
      const content = (msgData.content || '').toLowerCase();
      if (!content.includes(queryLower)) {
        // Skip if no keyword match (saves OpenAI cost)
        // For pure semantic search, remove this check
        continue;
      }

      // Get sender name
      const senderSnapshot = await db.collection('users').doc(msgData.senderId).get();
      const senderName = senderSnapshot.exists 
        ? senderSnapshot.data()?.displayName || 'Unknown'
        : 'Unknown';

      messages.push({
        messageId: msgDoc.id,
        chatId,
        content: msgData.content,
        senderId: msgData.senderId,
        senderName,
        timestamp: msgData.timestamp,
        isPriority: msgData.isPriority || false,
        chatName: chatData.name || 'Chat',
      });
    }
  }

  // Sort by timestamp (most recent first)
  messages.sort((a, b) => b.timestamp - a.timestamp);

  // Limit to 500 messages max (cost control)
  return messages.slice(0, 500);
}

/**
 * Re-rank messages using OpenAI for semantic similarity
 */
async function rankMessagesBySemantic(
  query: string,
  messages: Array<{
    messageId: string;
    chatId: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    isPriority?: boolean;
    chatName?: string;
  }>
): Promise<Array<{
  messageId: string;
  chatId: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  relevanceScore: number;
  isPriority?: boolean;
  chatName?: string;
}>> {
  // If only a few messages, return as-is with default score
  if (messages.length <= 5) {
    return messages.map(msg => ({
      ...msg,
      relevanceScore: 0.8,
    }));
  }

  // Prepare messages with initial scores
  const messagesWithScores = messages.map((msg, idx) => ({
    content: msg.content,
    score: 1.0 - (idx / messages.length), // Initial score based on order
  }));

  // Use OpenAI to re-rank
  const prompt = PROMPTS.rankSearchResults(query, messagesWithScores);
  
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: prompt as any,
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse ranked indices
    const ranking = JSON.parse(content);
    const rankedIndices = ranking.rankedIndices as number[];

    // Re-order messages based on ranking
    const rankedMessages = rankedIndices.map((idx, rank) => {
      const msg = messages[idx];
      return {
        ...msg,
        relevanceScore: 1.0 - (rank / rankedIndices.length),
      };
    });

    return rankedMessages;
  } catch (error) {
    console.error('Error ranking messages with OpenAI:', error);
    
    // Fallback: return original order with decreasing scores
    return messages.map((msg, idx) => ({
      ...msg,
      relevanceScore: 1.0 - (idx / messages.length),
    }));
  }
}

/**
 * Add context (messages before/after) to results
 */
async function addContextToResults(
  db: FirebaseFirestore.Firestore,
  messages: Array<{
    messageId: string;
    chatId: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    relevanceScore: number;
    isPriority?: boolean;
    chatName?: string;
  }>,
  limit: number
): Promise<MessageSearchResult[]> {
  const topMessages = messages.slice(0, limit);
  
  const enriched = await Promise.all(
    topMessages.map(async (msg) => {
      try {
        // Fetch 2 messages before and after for context
        const contextBefore = await db
          .collection('chats')
          .doc(msg.chatId)
          .collection('messages')
          .where('timestamp', '<', msg.timestamp)
          .orderBy('timestamp', 'desc')
          .limit(2)
          .get();

        const contextAfter = await db
          .collection('chats')
          .doc(msg.chatId)
          .collection('messages')
          .where('timestamp', '>', msg.timestamp)
          .orderBy('timestamp', 'asc')
          .limit(2)
          .get();

        // Get sender names for context
        const before = await Promise.all(
          contextBefore.docs.map(async (doc) => {
            const data = doc.data();
            const senderSnapshot = await db.collection('users').doc(data.senderId).get();
            const senderName = senderSnapshot.exists
              ? senderSnapshot.data()?.displayName || 'Unknown'
              : 'Unknown';
            return {
              sender: senderName,
              content: data.content,
            };
          })
        );

        const after = await Promise.all(
          contextAfter.docs.map(async (doc) => {
            const data = doc.data();
            const senderSnapshot = await db.collection('users').doc(data.senderId).get();
            const senderName = senderSnapshot.exists
              ? senderSnapshot.data()?.displayName || 'Unknown'
              : 'Unknown';
            return {
              sender: senderName,
              content: data.content,
            };
          })
        );

        return {
          messageId: msg.messageId,
          chatId: msg.chatId,
          content: msg.content,
          senderId: msg.senderId,
          senderName: msg.senderName,
          timestamp: msg.timestamp,
          relevanceScore: msg.relevanceScore,
          context: {
            before: before.reverse(), // Reverse to chronological order
            after,
          },
          chatName: msg.chatName,
          isPriority: msg.isPriority,
        };
      } catch (error) {
        console.error('Error adding context to message:', error);
        return {
          messageId: msg.messageId,
          chatId: msg.chatId,
          content: msg.content,
          senderId: msg.senderId,
          senderName: msg.senderName,
          timestamp: msg.timestamp,
          relevanceScore: msg.relevanceScore,
          chatName: msg.chatName,
          isPriority: msg.isPriority,
        };
      }
    })
  );

  return enriched;
}

