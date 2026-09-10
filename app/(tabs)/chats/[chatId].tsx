/**
 * Individual Chat Screen
 * Displays messages and allows sending new messages
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { usePresence } from '@/hooks/usePresence';
import { useTyping } from '@/hooks/useTyping';
import { db } from '@/services/database/sqlite';
import { imageService } from '@/services/storage/ImageService';
import { Chat } from '@/types/chat';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/messages/MessageList';
import { MessageInput } from '@/components/messages/MessageInput';
import { TypingIndicator } from '@/components/messages/TypingIndicator';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [otherUserId, setOtherUserId] = useState<string | undefined>(undefined);
  
  const { messages, loading, sending, sendMessage, markAllAsRead } = useMessages(
    chatId || '',
    user?.uid || ''
  );
  
  // Get other user's presence (for direct chats)
  const { online, lastSeen } = usePresence(otherUserId);
  
  // Typing indicators
  const { typingUsers, startTyping, stopTyping } = useTyping(
    chatId || '',
    user?.uid || '',
    user?.displayName || 'Unknown'
  );
  
  // Load chat details
  useEffect(() => {
    if (!chatId || !user) return;
    
    const loadChat = async () => {
      try {
        const chatData = await db.getChat(chatId);
        setChat(chatData);
        
        // For direct chats, determine the other user's ID
        if (chatData && chatData.type === 'direct') {
          const otherId = chatData.participants.find(id => id !== user.uid);
          setOtherUserId(otherId);
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
      } finally {
        setChatLoading(false);
      }
    };
    
    loadChat();
  }, [chatId, user]);
  
  // Mark all messages as read when screen is focused
  useFocusEffect(() => {
    if (chatId && user?.uid) {
      // Mark as read after a short delay to ensure messages are loaded
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  });
  
  // Get chat display name
  const getChatName = () => {
    if (!chat || !user) return 'Chat';
    
    if (chat.type === 'group') {
      return chat.name || 'Group Chat';
    }
    
    // For direct chats, show other user's name
    const otherUserId = chat.participants.find(id => id !== user.uid);
    // For now, just show "Chat" - will enhance with user data in later iterations
    return otherUserId || 'Chat';
  };
  
  const handleSendMessage = async (content: string) => {
    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Error sending message:', error);
      // TODO: Show error to user
    }
  };
  
  const handleSendImage = async (imageUri: string) => {
    if (!chatId) return;
    
    try {
      // Upload image to Firebase Storage
      const imageUrl = await imageService.uploadImage(imageUri, chatId);
      
      // Send image message
      // sendMessage only accepts content, use sendImage from hook if available
      // await sendMessage(imageUrl);
      
    } catch (error) {
      console.error('Error sending image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    }
  };
  
  if (!chatId || !user) {
    return null;
  }
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <ChatHeader
          chatId={chatId}
          chatName={getChatName()}
          chatType={chat?.type || 'direct'}
          online={online}
          lastSeen={lastSeen}
          participantCount={chat?.participants.length}
        />
        
        {/* Offline Banner */}
        <OfflineBanner />
        
        {/* Messages */}
        <View style={styles.messagesContainer}>
          <MessageList
            messages={messages}
            currentUserId={user.uid}
            loading={loading && chatLoading}
            showSenderNames={chat?.type === 'group'}
          />
          
          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <TypingIndicator
              userName={typingUsers[0]}
              typingUsers={typingUsers}
              isGroup={chat?.type === 'group'}
            />
          )}
        </View>
        
        {/* Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onSendImage={handleSendImage}
          sending={sending}
          onTypingStart={startTyping}
          onTypingStop={stopTyping}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
});

