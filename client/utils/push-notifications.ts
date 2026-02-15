import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';
import { getToken } from '@/utils/secure-token-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationData {
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    token = expoPushToken.data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E40AF',
      });
    }
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  return token;
}

export async function savePushTokenToServer(token: string): Promise<boolean> {
  try {
    const authToken = await getToken();
    if (!authToken) {
      return false;
    }

    const response = await fetch(
      new URL('/api/push/register-fcm', getApiUrl()).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fcmToken: token,
          platform: Platform.OS,
          deviceInfo: `${Platform.OS} ${Platform.Version}`,
        }),
      }
    );

    if (!response.ok) {
      if (__DEV__) console.error('Failed to save push token to server');
      return false;
    }

    await AsyncStorage.setItem('pushToken', token);
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
}

export async function removePushTokenFromServer(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem('pushToken');
    const authToken = await getToken();

    if (!token || !authToken) {
      return false;
    }

    const response = await fetch(
      new URL('/api/push/unregister-fcm', getApiUrl()).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fcmToken: token }),
      }
    );

    if (response.ok) {
      await AsyncStorage.removeItem('pushToken');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error removing push token:', error);
    return false;
  }
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  seconds: number = 1
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<boolean> {
  return await Notifications.setBadgeCountAsync(count);
}
