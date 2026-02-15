import https from 'https';
import crypto from 'crypto';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SmsProvider {
  send(phoneNumber: string, message: string): Promise<SmsResult>;
}

class SolapiProvider implements SmsProvider {
  private apiKey: string;
  private apiSecret: string;
  private senderId: string;

  constructor() {
    this.apiKey = process.env.SOLAPI_API_KEY || '';
    this.apiSecret = process.env.SOLAPI_API_SECRET || '';
    this.senderId = process.env.SOLAPI_SENDER_ID || '';
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret && this.senderId);
  }

  private getSignature(timestamp: string, salt: string): string {
    const message = timestamp + salt;
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
  }

  async send(phoneNumber: string, message: string): Promise<SmsResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Solapi not configured' };
    }

    const timestamp = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const signature = this.getSignature(timestamp, salt);

    const data = JSON.stringify({
      message: {
        to: phoneNumber.replace(/-/g, ''),
        from: this.senderId,
        text: message,
      },
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.solapi.com',
        path: '/messages/v4/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `HMAC-SHA256 apiKey=${this.apiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`,
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (res.statusCode === 200) {
              resolve({ success: true, messageId: result.groupId || result.messageId });
            } else {
              resolve({ success: false, error: result.errorMessage || 'SMS send failed' });
            }
          } catch {
            resolve({ success: false, error: 'Invalid response from SMS provider' });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.write(data);
      req.end();
    });
  }
}

class NaverSensProvider implements SmsProvider {
  private accessKey: string;
  private secretKey: string;
  private serviceId: string;
  private senderId: string;

  constructor() {
    this.accessKey = process.env.NAVER_ACCESS_KEY || '';
    this.secretKey = process.env.NAVER_SECRET_KEY || '';
    this.serviceId = process.env.NAVER_SMS_SERVICE_ID || '';
    this.senderId = process.env.NAVER_SMS_SENDER_ID || '';
  }

  isConfigured(): boolean {
    return !!(this.accessKey && this.secretKey && this.serviceId && this.senderId);
  }

  private makeSignature(timestamp: string, url: string): string {
    const message = `POST ${url}\n${timestamp}\n${this.accessKey}`;
    return crypto.createHmac('sha256', this.secretKey).update(message).digest('base64');
  }

  async send(phoneNumber: string, message: string): Promise<SmsResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Naver SENS not configured' };
    }

    const timestamp = Date.now().toString();
    const url = `/sms/v2/services/${this.serviceId}/messages`;
    const signature = this.makeSignature(timestamp, url);

    const data = JSON.stringify({
      type: 'SMS',
      from: this.senderId,
      content: message,
      messages: [{ to: phoneNumber.replace(/-/g, '') }],
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'sens.apigw.ntruss.com',
        path: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.accessKey,
          'x-ncp-apigw-signature-v2': signature,
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (res.statusCode === 202) {
              resolve({ success: true, messageId: result.requestId });
            } else {
              resolve({ success: false, error: result.error || 'SMS send failed' });
            }
          } catch {
            resolve({ success: false, error: 'Invalid response from SMS provider' });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.write(data);
      req.end();
    });
  }
}

class MockSmsProvider implements SmsProvider {
  async send(phoneNumber: string, message: string): Promise<SmsResult> {
    console.log(`[SMS Mock] To: ${phoneNumber.substring(0, 7)}****, Message: ${message.substring(0, 20)}...`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}

class SmsService {
  private provider: SmsProvider;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    
    const solapiProvider = new SolapiProvider();
    const naverProvider = new NaverSensProvider();
    
    if (solapiProvider.isConfigured()) {
      this.provider = solapiProvider;
      console.log('[SMS] Using Solapi provider');
    } else if (naverProvider.isConfigured()) {
      this.provider = naverProvider;
      console.log('[SMS] Using Naver SENS provider');
    } else {
      this.provider = new MockSmsProvider();
      if (this.isProduction) {
        console.warn('[SMS] WARNING: No SMS provider configured in production!');
      } else {
        console.log('[SMS] Using mock provider (development mode)');
      }
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<SmsResult> {
    const message = `[헬프미] 인증번호 [${code}]를 입력해주세요. 3분 내 유효합니다.`;
    return this.provider.send(phoneNumber, message);
  }

  async sendPasswordReset(phoneNumber: string, tempPassword: string): Promise<SmsResult> {
    const message = `[헬프미] 임시 비밀번호: ${tempPassword}\n로그인 후 비밀번호를 변경해주세요.`;
    return this.provider.send(phoneNumber, message);
  }

  async sendApprovalNotice(phoneNumber: string, userName: string): Promise<SmsResult> {
    const message = `[헬프미] ${userName}님, 헬퍼 가입이 승인되었습니다. 앱에서 로그인하세요.`;
    return this.provider.send(phoneNumber, message);
  }

  async sendRejectionNotice(phoneNumber: string, userName: string, reason?: string): Promise<SmsResult> {
    const reasonText = reason ? ` 사유: ${reason.substring(0, 30)}` : '';
    const message = `[헬프미] ${userName}님, 헬퍼 가입이 반려되었습니다.${reasonText} 문의: 고객센터`;
    return this.provider.send(phoneNumber, message);
  }

  async sendOrderStatusUpdate(phoneNumber: string, orderId: number, status: string): Promise<SmsResult> {
    const statusMessages: Record<string, string> = {
      'approved': '승인되었습니다',
      'in_progress': '진행 중입니다',
      'completed': '완료되었습니다',
      'cancelled': '취소되었습니다',
    };
    const statusText = statusMessages[status] || status;
    const message = `[헬프미] 주문 #${orderId}이(가) ${statusText}. 앱에서 확인하세요.`;
    return this.provider.send(phoneNumber, message);
  }

  async sendCustomMessage(phoneNumber: string, message: string): Promise<SmsResult> {
    return this.provider.send(phoneNumber, message);
  }
}

export const smsService = new SmsService();
export type { SmsResult };
