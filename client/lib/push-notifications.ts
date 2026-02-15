import { useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import { getApiUrl } from '@/lib/query-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushNotificationData = {
  type?: string;
  screen?: string;
  params?: Record<string, string>;
};

export type UsePushNotificationsOptions = {
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationResponse?: (
    response: Notifications.NotificationResponse
  ) => void;
};

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
) {
  const { onNotificationReceived, onNotificationResponse } = options;

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermission(finalStatus);

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E40AF',
      });
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      setExpoPushToken(token);
      return token;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }, []);

  const savePushTokenToServer = useCallback(
    async (authToken: string): Promise<boolean> => {
      if (!expoPushToken) {
        return false;
      }

      try {
        const response = await fetch(
          new URL('/api/push/register-fcm', getApiUrl()).toString(),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              token: expoPushToken,
              platform: Platform.OS,
            }),
          }
        );

        return response.ok;
      } catch (error) {
        console.error('Failed to save push token:', error);
        return false;
      }
    },
    [expoPushToken]
  );

  const parseNotificationData = useCallback(
    (notificationData: Notifications.Notification): PushNotificationData => {
      const data = notificationData.request.content.data as PushNotificationData;
      return {
        type: data?.type,
        screen: data?.screen,
        params: data?.params,
      };
    },
    []
  );

  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current =
      Notifications.addNotificationReceivedListener((receivedNotification: Notifications.Notification) => {
        setNotification(receivedNotification);
        onNotificationReceived?.(receivedNotification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((notificationResponse: Notifications.NotificationResponse) => {
        onNotificationResponse?.(notificationResponse);
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [registerForPushNotifications, onNotificationReceived, onNotificationResponse]);

  const openSettings = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try {
        await Linking.openSettings();
      } catch (error) {
        console.error('Failed to open settings:', error);
      }
    }
  }, []);

  return {
    expoPushToken,
    permission,
    notification,
    registerForPushNotifications,
    savePushTokenToServer,
    parseNotificationData,
    openSettings,
    hasPermission: permission === 'granted',
  };
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: PushNotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as any,
    },
    trigger: trigger || null,
  });
}

export async function cancelNotification(
  notificationId: string
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
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
