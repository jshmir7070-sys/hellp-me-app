import type { PushProvider, PushPayload, PushResult } from '../types';
import { logIntegrationEvent } from '../events';

export class MockPushProvider implements PushProvider {
  async sendPush(userId: number, payload: PushPayload): Promise<PushResult> {
    console.log(`[PUSH:MOCK] To user ${userId}:`, payload.title, '-', payload.body);
    
    await logIntegrationEvent({
      provider: 'push',
      action: 'sendPush',
      payload: JSON.stringify({ userId, title: payload.title }),
      status: 'success',
      retryCount: 0,
    });

    return {
      success: true,
      messageId: `mock-push-${Date.now()}`,
    };
  }

  async sendBulkPush(userIds: number[], payload: PushPayload): Promise<PushResult[]> {
    console.log(`[PUSH:MOCK] Bulk to ${userIds.length} users:`, payload.title);
    
    await logIntegrationEvent({
      provider: 'push',
      action: 'sendBulkPush',
      payload: JSON.stringify({ userIds, title: payload.title }),
      status: 'success',
      retryCount: 0,
    });

    return userIds.map(() => ({
      success: true,
      messageId: `mock-push-bulk-${Date.now()}`,
    }));
  }
}
