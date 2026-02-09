/**
 * Payment Module Types
 * 결제 관련 타입 정의
 */

export interface Payment {
  id: number;
  orderId?: number;
  contractId?: number;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  provider: PaymentProvider;
  providerPaymentId?: string;
  providerTransactionId?: string;
  metadata?: Record<string, any>;
  paidAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethod =
  | 'card'
  | 'virtual_account'
  | 'bank_transfer'
  | 'mobile'
  | 'kakao_pay'
  | 'naver_pay'
  | 'payco'
  | 'other';

export type PaymentProvider =
  | 'portone'
  | 'toss'
  | 'nice'
  | 'kg_inicis'
  | 'mock'
  | 'manual';

export interface CreatePaymentData {
  orderId?: number;
  contractId?: number;
  amount: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  provider?: PaymentProvider;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentData {
  status?: PaymentStatus;
  providerPaymentId?: string;
  providerTransactionId?: string;
  paidAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  id: number;
  userId: string;
  orderId?: number;
  contractId?: number;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  provider: PaymentProvider;
  clientSecret?: string;
  status: 'created' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  expiresAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentIntentData {
  orderId?: number;
  contractId?: number;
  amount: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  provider?: PaymentProvider;
  metadata?: Record<string, any>;
}

export interface VirtualAccount {
  id: number;
  paymentId: number;
  orderId?: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  paidAt?: Date;
  expiredAt?: Date;
  createdAt: Date;
}

export interface CreateVirtualAccountData {
  orderId: number;
  amount: number;
  bankName?: string;
  dueDate: Date;
  metadata?: Record<string, any>;
}

export interface PaymentRefund {
  id: number;
  paymentId: number;
  amount: number;
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  providerRefundId?: string;
  processedAt?: Date;
  failureReason?: string;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRefundData {
  paymentId: number;
  amount: number;
  reason: string;
  metadata?: Record<string, any>;
}

export interface PaymentEvent {
  id: number;
  paymentId: number;
  eventType: PaymentEventType;
  eventData?: Record<string, any>;
  source: 'system' | 'webhook' | 'admin' | 'user';
  createdAt: Date;
}

export type PaymentEventType =
  | 'created'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refund_requested'
  | 'refund_completed'
  | 'webhook_received'
  | 'status_changed'
  | 'amount_updated';

export interface PaymentReminder {
  id: number;
  paymentId: number;
  orderId?: number;
  userId: string;
  reminderType: 'email' | 'sms' | 'push';
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  scheduledAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentReminderData {
  paymentId: number;
  reminderType: 'email' | 'sms' | 'push';
  scheduledAt: Date;
}

export interface PaymentWebhookData {
  provider: PaymentProvider;
  eventType: string;
  paymentId?: string;
  transactionId?: string;
  status?: string;
  amount?: number;
  metadata?: Record<string, any>;
  signature?: string;
  timestamp?: string;
}

export interface VerifyPaymentData {
  paymentId: number;
  providerPaymentId: string;
  amount: number;
  signature?: string;
}

export interface PaymentSyncData {
  paymentId: number;
  forceSync?: boolean;
}

export interface PaymentStatusUpdate {
  paymentId: number;
  status: PaymentStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentRetry {
  paymentId: number;
  reason?: string;
}

export interface PaymentDetail {
  payment: Payment;
  refunds: PaymentRefund[];
  events: PaymentEvent[];
  virtualAccount?: VirtualAccount;
  order?: any;
  contract?: any;
  user: {
    id: string;
    name: string;
    email: string;
  };
  totalRefunded: number;
  netAmount: number;
}

export interface PaymentListFilters {
  userId?: string;
  orderId?: number;
  contractId?: number;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  provider?: PaymentProvider;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  totalRefunded: number;
  netAmount: number;
  byStatus: Record<PaymentStatus, {
    count: number;
    amount: number;
  }>;
  byMethod: Record<PaymentMethod, {
    count: number;
    amount: number;
  }>;
  byProvider: Record<PaymentProvider, {
    count: number;
    amount: number;
  }>;
  averagePaymentAmount: number;
  successRate: number;
}

export interface RefundDetail {
  refund: PaymentRefund;
  payment: Payment;
  order?: any;
  user: {
    id: string;
    name: string;
    email: string;
  };
  requestedByUser: {
    id: string;
    name: string;
    email: string;
  };
}
