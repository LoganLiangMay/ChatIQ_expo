/**
 * NotificationService
 * Handles push notifications using Expo Notifications:
 * - Request permissions
 * - Register for push tokens
 * - Handle foreground notifications
 * - Handle background notifications
 * - Update badge counts
 */

// @ts-nocheck
// TODO: Fix Expo Notifications API compatibility
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firestore';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;
  
  /**
   * Initialize notifications
   * - Request permissions
   * - Get push token
   * - Save token to Firestore
   */
  async initialize(): Promise<void> {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return;
      }
      
      // Get push token
      const token = await this.registerForPushNotifications();
      
      if (token) {
        this.expoPushToken = token;
        console.log('✅ Expo Push Token:', token);
        
        // Save token to Firestore
        await this.saveTokenToFirestore(token);
      }
      
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }
  
  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Notification permissions denied');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }
  
  /**
   * Register for push notifications and get Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Only works on physical devices
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }
      
      // Get Expo push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id',
      });
      
      // Android requires notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#007AFF',
        });
      }
      
      return token.data;
      
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }
  
  /**
   * Save push token to Firestore user profile
   */
  async saveTokenToFirestore(token: string): Promise<void> {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.warn('No authenticated user to save token');
        return;
      }
      
      const userRef = doc(firestore, 'users', currentUser.uid);
      await updateDoc(userRef, {
        expoPushToken: token,
        pushTokenUpdatedAt: Date.now(),
      });
      
      console.log('✅ Push token saved to Firestore');
      
    } catch (error) {
      console.error('Error saving token to Firestore:', error);
    }
  }
  
  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });
      
      return notificationId;
      
    } catch (error) {
      console.error('Error scheduling local notification:', error);
      throw error;
    }
  }
  
  /**
   * Show a local notification for a new message
   */
  async showMessageNotification(
    chatId: string,
    chatName: string,
    senderName: string,
    messageContent: string,
    isGroup: boolean
  ): Promise<void> {
    try {
      const title = isGroup ? chatName : senderName;
      const body = isGroup ? `${senderName}: ${messageContent}` : messageContent;
      
      await this.scheduleLocalNotification(title, body, {
        type: 'message',
        chatId,
        senderName,
      });
      
    } catch (error) {
      console.error('Error showing message notification:', error);
    }
  }
  
  /**
   * Update app badge count
   */
  async updateBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log('Badge count updated:', count);
      
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }
  
  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await this.updateBadgeCount(0);
      
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }
  
  /**
   * Get current badge count
   */
  async getBadgeCount(): Promise<number> {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count;
      
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }
  
  /**
   * Add notification received listener
   */
  addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(listener);
  }
  
  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }
}

export const notificationService = new NotificationService();




