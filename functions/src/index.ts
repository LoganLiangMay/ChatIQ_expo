/**
 * Firebase Cloud Functions for MessageAI
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Initialize functions: firebase init functions
 * 4. Copy this file to functions/src/index.ts
 * 5. Install dependencies: cd functions && npm install
 * 6. Deploy: firebase deploy --only functions
 * 
 * NOTE: This file is provided for reference. You'll need to:
 * - Set up a Firebase project with Functions enabled
 * - Configure billing (Functions require Blaze plan)
 * - Deploy using Firebase CLI
 */

// @ts-nocheck
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Send push notification when a new message is created
 * Triggers on: /chats/{chatId}/messages/{messageId}
 */
export const onMessageCreated = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    try {
      const messageData = snapshot.data();
      const { chatId } = context.params;
      
      // Get sender ID
      const senderId = messageData.senderId;
      const senderName = messageData.senderName || 'Someone';
      const content = messageData.content || '📷 Image';
      
      // Get chat data
      const chatDoc = await admin.firestore()
        .collection('chats')
        .doc(chatId)
        .get();
      
      if (!chatDoc.exists) {
        console.log('Chat not found:', chatId);
        return null;
      }
      
      const chatData = chatDoc.data();
      const participants = chatData?.participants || [];
      const chatName = chatData?.name;
      const isGroup = chatData?.type === 'group';
      
      // Get all participants except sender
      const recipients = participants.filter((uid: string) => uid !== senderId);
      
      if (recipients.length === 0) {
        console.log('No recipients to notify');
        return null;
      }
      
      // Fetch push tokens for all recipients
      const userDocs = await admin.firestore()
        .collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', recipients)
        .get();
      
      const tokens: string[] = [];
      userDocs.forEach(doc => {
        const userData = doc.data();
        if (userData.expoPushToken) {
          tokens.push(userData.expoPushToken);
        }
      });
      
      if (tokens.length === 0) {
        console.log('No push tokens found for recipients');
        return null;
      }
      
      // Prepare notification payload
      const notificationTitle = isGroup ? chatName : senderName;
      const notificationBody = isGroup ? `${senderName}: ${content}` : content;
      
      // Send notifications using Expo Push Notification service
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'message',
          chatId,
          senderId,
          senderName,
        },
        badge: 1, // Will be updated by client
      }));
      
      // Send to Expo Push Notification service
      const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
      
      const response = await fetch(expoPushUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      
      const result = await response.json();
      console.log('Push notifications sent:', result);
      
      return result;
      
    } catch (error) {
      console.error('Error sending push notification:', error);
      return null;
    }
  });

/**
 * Clean up old typing indicators
 * Runs every 5 minutes
 */
export const cleanupTypingIndicators = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    try {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      const chatsSnapshot = await admin.firestore()
        .collection('chats')
        .get();
      
      let cleanupCount = 0;
      
      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        const typing = chatData.typing || {};
        
        let hasStaleTyping = false;
        const updates: any = {};
        
        for (const [userId, typingData] of Object.entries(typing)) {
          const timestamp = (typingData as any).timestamp;
          const timestampMs = timestamp?.toMillis ? timestamp.toMillis() : timestamp;
          
          if (timestampMs < fiveMinutesAgo) {
            updates[`typing.${userId}`] = admin.firestore.FieldValue.delete();
            hasStaleTyping = true;
          }
        }
        
        if (hasStaleTyping) {
          await chatDoc.ref.update(updates);
          cleanupCount++;
        }
      }
      
      console.log(`Cleaned up stale typing indicators in ${cleanupCount} chats`);
      return null;
      
    } catch (error) {
      console.error('Error cleaning up typing indicators:', error);
      return null;
    }
  });

/**
 * Update user's online status to offline after 5 minutes of inactivity
 * Runs every minute
 */
export const updateInactiveUsers = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    try {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .where('online', '==', true)
        .get();
      
      let updatedCount = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const lastSeen = userData.lastSeen;
        const lastSeenMs = lastSeen?.toMillis ? lastSeen.toMillis() : lastSeen;
        
        if (lastSeenMs && lastSeenMs < fiveMinutesAgo) {
          await userDoc.ref.update({
            online: false,
          });
          updatedCount++;
        }
      }
      
      console.log(`Updated ${updatedCount} inactive users to offline`);
      return null;
      
    } catch (error) {
      console.error('Error updating inactive users:', error);
      return null;
    }
  });




