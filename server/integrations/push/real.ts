import type { PushProvider, PushPayload, PushResult } from '../types';
import { logIntegrationEvent } from '../events';
import { db } from '../../db';
import { pushSubscriptions } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export class RealPushProvider implements PushProvider {
  private expoAccessToken: string;
  private vapidPublicKey: string;
  private vapidPrivateKey: string;

  constructor() {
    this.expoAccessToken = process.env.EXPO_ACCESS_TOKEN || '';
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
  }

  async sendPush(userId: string | number, payload: PushPayload): Promise<PushResult> {
    try {
      const subscriptions = await db.select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, String(userId)));

      if (subscriptions.length === 0) {
        return { success: true, messageId: 'no-subscription' };
      }

      const results: boolean[] = [];

      for (const sub of subscriptions) {
        // Expo Push API는 ExponentPushToken으로 시작하는 토큰만 처리
        // FCM 네이티브 토큰은 Expo 앱에서 사용하지 않으므로 Expo 토큰으로 통합
        const pushToken = sub.expoPushToken || sub.fcmToken;
        
        if ((sub.platform === 'expo' || sub.platform === 'fcm') && pushToken) {
          // Expo Push Token 형식 검증 (ExponentPushToken[xxx] 또는 ExpoPushToken[xxx])
          if (pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken[')) {
            const success = await this.sendExpoPush(pushToken, payload);
            results.push(success);
          } else {
            console.warn(`[Push] Invalid Expo token format for user ${userId}: ${pushToken.substring(0, 20)}...`);
            results.push(false);
          }
        } else if (sub.platform === 'web' && sub.webEndpoint) {
          const success = await this.sendWebPush(sub, payload);
          results.push(success);
        }
      }

      await logIntegrationEvent({
        provider: 'push',
        action: 'sendPush',
        payload: JSON.stringify({ userId, title: payload.title }),
        status: results.some(r => r) ? 'success' : 'failed',
        retryCount: 0,
      });

      return {
        success: results.some(r => r),
        messageId: `push-${Date.now()}`,
      };
    } catch (error: any) {
      await logIntegrationEvent({
        provider: 'push',
        action: 'sendPush',
        payload: JSON.stringify({ userId, title: payload.title }),
        status: 'failed',
        retryCount: 0,
        lastError: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  async sendBulkPush(userIds: (string | number)[], payload: PushPayload): Promise<PushResult[]> {
    const results = await Promise.all(
      userIds.map(userId => this.sendPush(userId, payload))
    );
    return results;
  }

  private async sendExpoPush(pushToken: string, payload: PushPayload): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      };

      if (this.expoAccessToken) {
        headers['Authorization'] = `Bearer ${this.expoAccessToken}`;
      }

      const message = {
        to: pushToken,
        title: payload.title,
        body: payload.body,
        data: {
          url: payload.url,
          ...payload.data,
        },
        sound: 'default',
        channelId: 'default',
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        console.error('[ExpoPush] HTTP error:', response.status, await response.text());
        return false;
      }

      const result = await response.json();
      
      if (result.data?.status === 'error') {
        console.error('[ExpoPush] Push error:', result.data.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ExpoPush] Send error:', error);
      return false;
    }
  }

  private async sendWebPush(sub: any, payload: PushPayload): Promise<boolean> {
    if (!this.vapidPrivateKey || !sub.webEndpoint) return false;

    try {
      const webpush = await import('web-push') as any;
      
      webpush.setVapidDetails(
        'mailto:admin@hellpme.kr',
        this.vapidPublicKey,
        this.vapidPrivateKey
      );

      await webpush.sendNotification(
        {
          endpoint: sub.webEndpoint,
          keys: {
            p256dh: sub.webP256dh || '',
            auth: sub.webAuth || '',
          },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url,
          tag: payload.tag,
        })
      );

      return true;
    } catch {
      return false;
    }
  }
}
