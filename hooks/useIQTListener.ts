/**
 * useIQTListener Hook
 * Monitors incoming messages and triggers IQT auto-response when appropriate
 */

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/services/firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Message } from '@/types/message';

interface PersonalitySettings {
  enabled: boolean;
  autoSend: boolean;
  tone: string;
  avgLength: number;
  phrases: string[];
}

interface IQTResponse {
  responseText: string | null;
  confidence: number;
  sources: Array<{
    type: 'rag' | 'bulletin';
    content: string;
    score?: number;
  }>;
  reason?: string;
}

interface PendingResponse {
  chatId: string;
  messageId: string;
  response: IQTResponse;
}

export function useIQTListener(
  onResponseReady?: (response: PendingResponse) => void
) {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [settings, setSettings] = useState<PersonalitySettings | null>(null);
  const [pendingResponse, setPendingResponse] = useState<PendingResponse | null>(null);

  // Track processed messages to avoid duplicate processing
  const processedMessages = useRef(new Set<string>());

  // Track last check time to only process new messages
  const lastCheckTime = useRef<Timestamp>(Timestamp.now());

  // Load IQT settings
  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | undefined;

    const loadSettings = async () => {
      try {
        const db = await getFirebaseFirestore();
        const userRef = doc(db, 'users', user.uid);

        unsubscribe = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data();
            const personalityData = userData.personality as PersonalitySettings | undefined;

            if (personalityData) {
              setIsEnabled(personalityData.enabled || false);
              setSettings(personalityData);
            } else {
              setIsEnabled(false);
              setSettings(null);
            }
          } else {
            setIsEnabled(false);
            setSettings(null);
          }
        }, (error) => {
          console.error('Error loading IQT settings:', error);
          setIsEnabled(false);
          setSettings(null);
        });
      } catch (error) {
        console.error('Failed to initialize IQT listener:', error);
        setIsEnabled(false);
        setSettings(null);
      }
    };

    loadSettings();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Detect if a message is a question
  const isQuestion = (text: string): boolean => {
    // Check for question mark
    if (text.includes('?')) return true;

    // Check for common question words at the start
    const questionWords = [
      'how', 'what', 'when', 'why', 'where', 'who', 'which',
      'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does',
      'will', 'did', 'has', 'have', 'may'
    ];

    const firstWord = text.trim().toLowerCase().split(/\s+/)[0];
    return questionWords.includes(firstWord);
  };

  // Process a message and potentially generate a response
  const processMessage = async (message: Message, chatId: string) => {
    // Skip if already processed
    if (processedMessages.current.has(message.id)) {
      return;
    }

    // Skip if message is from the current user
    if (message.senderId === user?.uid) {
      return;
    }

    // Skip if not a question
    if (!isQuestion(message.content)) {
      return;
    }

    // Mark as processed
    processedMessages.current.add(message.id);

    console.log('📨 IQT: Processing question:', message.content.substring(0, 50) + '...');

    try {
      // Call personaAgent function
      const functions = getFunctions();
      const personaAgent = httpsCallable<
        { query: string; chatId: string },
        IQTResponse
      >(functions, 'personaAgent');

      const result = await personaAgent({
        query: message.content,
        chatId
      });

      const response = result.data;

      console.log('🤖 IQT: Response generated:', {
        confidence: response.confidence,
        hasResponse: !!response.responseText
      });

      // Only proceed if confidence is sufficient
      if (response.confidence < 0.7 || !response.responseText) {
        console.log('⚠️ IQT: Confidence too low, skipping');
        return;
      }

      const pendingResp: PendingResponse = {
        chatId,
        messageId: message.id,
        response
      };

      // If auto-send is enabled and confidence is high, send automatically
      if (settings?.autoSend && response.confidence >= 0.8) {
        console.log('✅ IQT: Auto-sending response');
        // Auto-send will be handled by the callback
        if (onResponseReady) {
          onResponseReady(pendingResp);
        }
      } else {
        console.log('👀 IQT: Response ready for preview');
        // Otherwise, show preview
        setPendingResponse(pendingResp);
        if (onResponseReady) {
          onResponseReady(pendingResp);
        }
      }
    } catch (error) {
      console.error('Failed to process message with IQT:', error);
    }
  };

  // Listen to messages across all user's chats
  useEffect(() => {
    if (!user || !isEnabled || !settings) {
      return;
    }

    console.log('🎧 IQT: Listener started');

    let unsubscribes: Unsubscribe[] = [];
    let chatsUnsubscribe: Unsubscribe | undefined;

    const setupListeners = async () => {
      try {
        const db = await getFirebaseFirestore();
        unsubscribes = [];

        // Get all chats where user is a participant
        const chatsQuery = query(
          collection(db, 'chats'),
          where('participants', 'array-contains', user.uid)
        );

        chatsUnsubscribe = onSnapshot(chatsQuery, (chatsSnapshot) => {
          // Clear existing message listeners
          unsubscribes.forEach(unsub => unsub());
          unsubscribes.length = 0;

          chatsSnapshot.forEach((chatDoc) => {
            const chatId = chatDoc.id;

            // Listen to messages in this chat that are newer than last check
            const messagesQuery = query(
              collection(db, 'chats', chatId, 'messages'),
              where('timestamp', '>', lastCheckTime.current),
              orderBy('timestamp', 'desc')
            );

            const messagesUnsubscribe = onSnapshot(messagesQuery, (messagesSnapshot) => {
              messagesSnapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  const message = {
                    id: change.doc.id,
                    ...change.doc.data()
                  } as Message;

                  // Process the message asynchronously
                  processMessage(message, chatId);
                }
              });
            });

            unsubscribes.push(messagesUnsubscribe);
          });
        });
      } catch (error) {
        console.error('Failed to setup IQT message listeners:', error);
      }
    };

    setupListeners();

    // Cleanup
    return () => {
      console.log('🔇 IQT: Listener stopped');
      if (chatsUnsubscribe) {
        chatsUnsubscribe();
      }
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, isEnabled, settings]);

  return {
    isEnabled,
    settings,
    pendingResponse,
    clearPendingResponse: () => setPendingResponse(null)
  };
}
