export interface SmsProvider {
  sendSms(phone: string, message: string): Promise<SmsResult>;
  sendVerificationCode(phone: string, code: string): Promise<SmsResult>;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PushProvider {
  sendPush(userId: number, payload: PushPayload): Promise<PushResult>;
  sendBulkPush(userIds: number[], payload: PushPayload): Promise<PushResult[]>;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PaymentProvider {
  requestPayment(orderId: number, amount: number, options?: PaymentOptions): Promise<PaymentResult>;
  verifyPayment(paymentId: string): Promise<PaymentVerifyResult>;
  cancelPayment(paymentId: string, reason: string): Promise<PaymentResult>;
}

export interface PaymentOptions {
  productName?: string;
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  status?: 'pending' | 'paid' | 'cancelled' | 'failed';
  error?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  paymentId?: string;
  amount?: number;
  status?: 'paid' | 'cancelled' | 'failed';
  paidAt?: Date;
  error?: string;
}

export interface IdentityProvider {
  requestVerification(userId: number, options?: IdentityOptions): Promise<IdentityResult>;
  verifyIdentity(verificationId: string): Promise<IdentityVerifyResult>;
}

export interface IdentityOptions {
  type?: 'identity' | 'driver_license';
  redirectUrl?: string;
}

export interface IdentityResult {
  success: boolean;
  verificationId?: string;
  redirectUrl?: string;
  error?: string;
}

export interface IdentityVerifyResult {
  success: boolean;
  verified: boolean;
  name?: string;
  birthDate?: string;
  phone?: string;
  ci?: string;
  error?: string;
}

export interface IntegrationEvent {
  id?: number;
  provider: 'sms' | 'push' | 'payment' | 'identity';
  action: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  retryCount: number;
  lastError?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
