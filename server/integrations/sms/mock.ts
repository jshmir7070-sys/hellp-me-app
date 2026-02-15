import type { SmsProvider, SmsResult } from '../types';
import { logIntegrationEvent } from '../events';

export class MockSmsProvider implements SmsProvider {
  async sendSms(phone: string, message: string): Promise<SmsResult> {
    console.log(`[SMS:MOCK] To: ${phone}, Message: ${message}`);
    
    await logIntegrationEvent({
      provider: 'sms',
      action: 'sendSms',
      payload: JSON.stringify({ phone, message: message.substring(0, 50) }),
      status: 'success',
      retryCount: 0,
    });

    return {
      success: true,
      messageId: `mock-sms-${Date.now()}`,
    };
  }

  async sendVerificationCode(phone: string, code: string): Promise<SmsResult> {
    console.log(`[SMS:MOCK] Verification to ${phone}: ${code}`);
    
    await logIntegrationEvent({
      provider: 'sms',
      action: 'sendVerificationCode',
      payload: JSON.stringify({ phone, code }),
      status: 'success',
      retryCount: 0,
    });

    return {
      success: true,
      messageId: `mock-verify-${Date.now()}`,
    };
  }
}
