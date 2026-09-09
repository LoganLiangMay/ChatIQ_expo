/**
 * useNotifications hook
 * Manages notification listeners and navigation
 */

// @ts-nocheck
// TODO: Fix Expo Notifications API compatibility issues
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/services/notifications/NotificationService';
import { useAuth } from '@/contexts/AuthContext';
import { AppState, AppStateStatus } from 'react-native';

export function useNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appState = useRef(AppState.currentState);
  
  useEffect(() => {
    if (!user) return;
    
    // Initialize notifications
    notificationService.initialize();
    
    // Listen for notifications received while app is in foreground
    notificationListener.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('📬 Notification received (foreground):', notification);
        
        // Notification will be shown automatically by NotificationHandler
        // You can add custom logic here if needed
      }
    );
    
    // Listen for notification taps (user interaction)
    responseListener.current = notificationService.addNotificationResponseListener(
      (response) => {
        console.log('👆 Notification tapped:', response);
        
        const data = response.notification.request.content.data;
        
        // Navigate to chat if it's a message notification
        if (data?.type === 'message' && data?.chatId) {
          router.push(`/(tabs)/chats/${data.chatId}`);
        }
      }
    );
    
    // Handle app state changes for badge count
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // App came to foreground - clear badge
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        await notificationService.updateBadgeCount(0);
      }
      
      appState.current = nextAppState;
    });
    
    // Cleanup
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      subscription.remove();
    };
  }, [user, router]);
}




