import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callChatCompletion } from './openai';
import { PROMPTS } from './prompts';
import type { ExtractActionsRequest, ExtractActionsResponse, ActionItem } from './types';

/**
 * Extract Action Items from Conversation
 * 
 * Analyzes messages to find tasks, commitments, and to-dos.
 * Returns structured action items with:
 * - Task description
 * - Owner (if mentioned)
 * - Deadline (if mentioned)
 * - Source message
 * 
 * Response time target: <3s for 50 messages
 * Cost: ~$0.001 per extraction
 */
export const extractActionItems = functions.https.onCall(
  async (data: ExtractActionsRequest, context): Promise<ExtractActionsResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to extract action items'
      );
    }

    const { chatId, messageLimit = 50 } = data;

    // Validate input
    if (!chatId || typeof chatId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Chat ID is required'
      );
    }

    // Enforce max limit to control costs
    const limit = Math.min(messageLimit, 100);

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

      // Fetch messages
      const messagesSnap = await firestore
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      if (messagesSnap.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'No messages found in this chat'
        );
      }

      functions.logger.info('Fetching messages for action extraction', {
        chatId,
        messageCount: messagesSnap.size,
        userId: context.auth.uid,
      });

      // Fetch sender names
      const senderIds = Array.from(
        new Set(messagesSnap.docs.map((doc) => doc.data().senderId))
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

      // Build message array (chronological order)
      // Filter out images and empty messages (same logic as summarize.ts)
      const messages = messagesSnap.docs
        .reverse()
        .map((doc) => {
          const data = doc.data();

          // Check for image first, then content (prevent "📷 [Image]" in AI analysis)
          let content: string;
          if (data.imageUrl) {
            return null; // Skip images - they don't contain action items
          } else if (data.content && data.content.trim()) {
            content = data.content;
          } else {
            return null; // Skip empty messages
          }

          return {
            messageId: doc.id,
            sender: userNames.get(data.senderId) || 'Unknown',
            content,
            timestamp: data.timestamp,
          };
        })
        .filter((msg): msg is NonNullable<typeof msg> => msg !== null);

      // Generate prompt using template
      functions.logger.info('Calling OpenAI for action extraction', {
        messageCount: messages.length,
      });

      const promptMessages = PROMPTS.extractActionItems(messages);
      const startTime = Date.now();

      const response = await callChatCompletion(promptMessages, {
        model: 'gpt-4o',
        temperature: 0.3, // Lower temp for more consistent extraction
        maxTokens: 1000,
      });

      const duration = Date.now() - startTime;

      // Parse response
      let responseText = response.choices[0].message.content || '[]';
      
      // Strip markdown code fences if present (OpenAI sometimes adds them)
      responseText = responseText.replace(/```json\s*|\s*```/g, '').trim();
      
      let actionItems: ActionItem[] = [];
      try {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed)) {
          actionItems = parsed.map((item: any, index: number) => {
            // Find the message this action item came from
            const sourceMessage = messages.find(m => m.messageId === item.messageId) || messages[0];
            
            return {
              id: `action-${chatId}-${Date.now()}-${index}`,
              task: item.task || '',
              owner: item.owner || undefined,
              deadline: item.deadline || undefined,
              status: 'pending' as const,
              extractedFrom: {
                messageId: sourceMessage.messageId,
                timestamp: sourceMessage.timestamp,
              },
            };
          });
        }
      } catch (parseError) {
        functions.logger.warn('Failed to parse action items response:', responseText);
        // Return empty array if parsing fails
      }

      functions.logger.info('Action extraction complete', {
        chatId,
        duration,
        actionItemsFound: actionItems.length,
        tokensUsed: response.usage?.total_tokens || 0,
      });

      return {
        actionItems,
        messageCount: messages.length,
      };

    } catch (error: any) {
      functions.logger.error('Error extracting action items', {
        error: error.message,
        chatId,
        userId: context.auth?.uid,
      });

      // Handle specific error types
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new functions.https.HttpsError(
        'internal',
        `Failed to extract action items: ${error.message}`
      );
    }
  }
);


