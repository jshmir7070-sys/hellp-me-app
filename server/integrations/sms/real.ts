import type { SmsProvider, SmsResult } from '../types';
import { logIntegrationEvent } from '../events';

export class RealSmsProvider implements SmsProvider {
  private apiKey: string;
  private apiSecret: string;
  private senderId: string;

  constructor() {
    this.apiKey = process.env.SOLAPI_API_KEY || '';
    this.apiSecret = process.env.SOLAPI_API_SECRET || '';
    this.senderId = process.env.SOLAPI_SENDER_ID || '';
  }

  async sendSms(phone: string, message: string): Promise<SmsResult> {
    try {
      const response = await this.callSolapiApi(phone, message);
      
      await logIntegrationEvent({
        provider: 'sms',
        action: 'sendSms',
        payload: JSON.stringify({ phone, message: message.substring(0, 50) }),
        status: 'success',
        retryCount: 0,
      });

      return {
        success: true,
        messageId: response.messageId,
      };
    } catch (error: any) {
      await logIntegrationEvent({
        provider: 'sms',
        action: 'sendSms',
        payload: JSON.stringify({ phone, message: message.substring(0, 50) }),
        status: 'failed',
        retryCount: 0,
        lastError: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendVerificationCode(phone: string, code: string): Promise<SmsResult> {
    const message = `[헬프미] 인증번호: ${code} (3분 이내 입력)`;
    return this.sendSms(phone, message);
  }

  private async callSolapiApi(phone: string, message: string): Promise<{ messageId: string }> {
    const crypto = await import('crypto');
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(32).toString('hex');
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(date + salt)
      .digest('hex');

    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({
        message: {
          to: phone,
          from: this.senderId,
          text: message,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SMS API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return { messageId: result.groupId || result.messageId || 'unknown' };
  }
}
