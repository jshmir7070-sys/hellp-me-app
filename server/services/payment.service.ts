/**
 * Payment Service
 * 결제 비즈니스 로직
 */

import { storage, db } from '../storage';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import {
  Payment,
  CreatePaymentData,
  UpdatePaymentData,
  PaymentIntent,
  CreatePaymentIntentData,
  VirtualAccount,
  CreateVirtualAccountData,
  PaymentRefund,
  CreateRefundData,
  PaymentEvent,
  PaymentReminder,
  CreatePaymentReminderData,
  PaymentWebhookData,
  VerifyPaymentData,
  PaymentDetail,
  PaymentListFilters,
  PaymentStats,
  PaymentStatus,
  PaymentEventType,
} from '../types/payment.types';
import { logger } from '../lib/logger';
import {
  payments,
  paymentIntents,
  virtualAccounts,
  paymentRefunds,
  paymentEvents,
  paymentReminders,
  orders,
  users,
} from '@shared/schema';

class PaymentService {
  // ================================
  // Payment CRUD
  // ================================

  /**
   * 결제 생성
   */
  async createPayment(data: CreatePaymentData, userId: string): Promise<Payment> {
    logger.info('Creating payment', { userId, amount: data.amount });

    const [payment] = await db
      .insert(payments)
      .values({
        ...data,
        userId,
        currency: data.currency || 'KRW',
        provider: data.provider || 'portone',
        status: 'pending',
      })
      .returning();

    // Create event
    await this.createPaymentEvent(payment.id, 'created', { userId });

    return payment as Payment;
  }

  /**
   * 결제 조회
   */
  async getPaymentById(id: number): Promise<Payment | null> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);

    return payment as Payment || null;
  }

  /**
   * 결제 목록 조회
   */
  async getPayments(filters?: PaymentListFilters): Promise<Payment[]> {
    let query = db.select().from(payments);

    const conditions: any[] = [];

    if (filters?.userId) {
      conditions.push(eq(payments.userId, filters.userId));
    }
    if (filters?.orderId) {
      conditions.push(eq(payments.orderId, filters.orderId));
    }
    if (filters?.contractId) {
      conditions.push(eq(payments.contractId, filters.contractId));
    }
    if (filters?.status) {
      conditions.push(eq(payments.status, filters.status));
    }
    if (filters?.paymentMethod) {
      conditions.push(eq(payments.paymentMethod, filters.paymentMethod));
    }
    if (filters?.provider) {
      conditions.push(eq(payments.provider, filters.provider));
    }
    if (filters?.startDate) {
      conditions.push(gte(payments.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(payments.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(payments.createdAt));
    return results as Payment[];
  }

  /**
   * 결제 업데이트
   */
  async updatePayment(
    id: number,
    data: UpdatePaymentData,
    updatedBy: string
  ): Promise<Payment> {
    const oldPayment = await this.getPaymentById(id);
    if (!oldPayment) {
      throw new Error('Payment not found');
    }

    const [updated] = await db
      .update(payments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    // Create event if status changed
    if (data.status && data.status !== oldPayment.status) {
      await this.createPaymentEvent(id, 'status_changed', {
        oldStatus: oldPayment.status,
        newStatus: data.status,
        updatedBy,
      });
    }

    return updated as Payment;
  }

  // ================================
  // Payment Intents
  // ================================

  /**
   * 결제 인텐트 생성
   */
  async createPaymentIntent(
    data: CreatePaymentIntentData,
    userId: string
  ): Promise<PaymentIntent> {
    logger.info('Creating payment intent', { userId, amount: data.amount });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const [intent] = await db
      .insert(paymentIntents)
      .values({
        ...data,
        userId,
        currency: data.currency || 'KRW',
        provider: data.provider || 'portone',
        status: 'created',
        expiresAt,
        clientSecret: this.generateClientSecret(),
      })
      .returning();

    return intent as PaymentIntent;
  }

  /**
   * 결제 인텐트 조회
   */
  async getPaymentIntentById(id: number): Promise<PaymentIntent | null> {
    const [intent] = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, id))
      .limit(1);

    return intent as PaymentIntent || null;
  }

  /**
   * 결제 인텐트 목록
   */
  async getPaymentIntents(userId?: string): Promise<PaymentIntent[]> {
    let query = db.select().from(paymentIntents);

    if (userId) {
      query = query.where(eq(paymentIntents.userId, userId)) as any;
    }

    const results = await query.orderBy(desc(paymentIntents.createdAt));
    return results as PaymentIntent[];
  }

  /**
   * Client Secret 생성
   */
  private generateClientSecret(): string {
    return `pi_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }

  // ================================
  // Virtual Accounts
  // ================================

  /**
   * 가상계좌 생성
   */
  async createVirtualAccount(
    data: CreateVirtualAccountData,
    userId: string
  ): Promise<VirtualAccount> {
    logger.info('Creating virtual account', { userId, orderId: data.orderId });

    // Create payment first
    const payment = await this.createPayment(
      {
        orderId: data.orderId,
        amount: data.amount,
        paymentMethod: 'virtual_account',
        provider: 'portone',
        metadata: data.metadata,
      },
      userId
    );

    // Generate virtual account (in real implementation, call provider API)
    const [account] = await db
      .insert(virtualAccounts)
      .values({
        paymentId: payment.id,
        orderId: data.orderId,
        bankName: data.bankName || '우리은행',
        accountNumber: this.generateVirtualAccountNumber(),
        accountHolder: 'Hellp Me',
        amount: data.amount,
        dueDate: data.dueDate,
        status: 'pending',
      })
      .returning();

    return account as VirtualAccount;
  }

  /**
   * 가상계좌 조회
   */
  async getVirtualAccountByOrderId(orderId: number): Promise<VirtualAccount | null> {
    const [account] = await db
      .select()
      .from(virtualAccounts)
      .where(eq(virtualAccounts.orderId, orderId))
      .orderBy(desc(virtualAccounts.createdAt))
      .limit(1);

    return account as VirtualAccount || null;
  }

  /**
   * 가상계좌 번호 생성
   */
  private generateVirtualAccountNumber(): string {
    const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `1002${random}`;
  }

  // ================================
  // Payment Verification
  // ================================

  /**
   * 결제 검증
   */
  async verifyPayment(data: VerifyPaymentData): Promise<Payment> {
    logger.info('Verifying payment', { paymentId: data.paymentId });

    const payment = await this.getPaymentById(data.paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // In real implementation, verify with provider API
    // For now, just update status
    const verified = await this.updatePayment(
      data.paymentId,
      {
        status: 'completed',
        providerPaymentId: data.providerPaymentId,
        paidAt: new Date(),
      },
      'system'
    );

    await this.createPaymentEvent(data.paymentId, 'completed', {
      providerPaymentId: data.providerPaymentId,
      amount: data.amount,
    });

    return verified;
  }

  /**
   * 결제 상태 조회
   */
  async getPaymentStatus(paymentId: number): Promise<{ status: PaymentStatus; payment: Payment }> {
    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    return {
      status: payment.status,
      payment,
    };
  }

  // ================================
  // Refunds
  // ================================

  /**
   * 환불 생성
   */
  async createRefund(data: CreateRefundData, requestedBy: string): Promise<PaymentRefund> {
    logger.info('Creating refund', { paymentId: data.paymentId, amount: data.amount });

    const payment = await this.getPaymentById(data.paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'completed') {
      throw new Error('Can only refund completed payments');
    }

    const [refund] = await db
      .insert(paymentRefunds)
      .values({
        ...data,
        status: 'pending',
        requestedBy,
      })
      .returning();

    await this.createPaymentEvent(data.paymentId, 'refund_requested', {
      refundId: refund.id,
      amount: data.amount,
      reason: data.reason,
      requestedBy,
    });

    return refund as PaymentRefund;
  }

  /**
   * 환불 처리
   */
  async processRefund(refundId: number): Promise<PaymentRefund> {
    logger.info('Processing refund', { refundId });

    const [refund] = await db
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new Error('Refund not found');
    }

    // In real implementation, call provider API to process refund
    const [updated] = await db
      .update(paymentRefunds)
      .set({
        status: 'completed',
        processedAt: new Date(),
        providerRefundId: `rf_${Math.random().toString(36).substring(2, 15)}`,
      })
      .where(eq(paymentRefunds.id, refundId))
      .returning();

    // Update payment status
    await this.updatePayment(
      refund.paymentId,
      { status: 'refunded' },
      'system'
    );

    await this.createPaymentEvent(refund.paymentId, 'refund_completed', {
      refundId,
      amount: refund.amount,
    });

    return updated as PaymentRefund;
  }

  /**
   * 환불 목록 조회
   */
  async getRefunds(paymentId?: number): Promise<PaymentRefund[]> {
    let query = db.select().from(paymentRefunds);

    if (paymentId) {
      query = query.where(eq(paymentRefunds.paymentId, paymentId)) as any;
    }

    const results = await query.orderBy(desc(paymentRefunds.createdAt));
    return results as PaymentRefund[];
  }

  // ================================
  // Payment Events
  // ================================

  /**
   * 결제 이벤트 생성
   */
  async createPaymentEvent(
    paymentId: number,
    eventType: PaymentEventType,
    eventData?: Record<string, any>
  ): Promise<PaymentEvent> {
    const [event] = await db
      .insert(paymentEvents)
      .values({
        paymentId,
        eventType,
        eventData,
        source: 'system',
      })
      .returning();

    return event as PaymentEvent;
  }

  /**
   * 결제 이벤트 조회
   */
  async getPaymentEvents(paymentId: number): Promise<PaymentEvent[]> {
    const events = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.paymentId, paymentId))
      .orderBy(desc(paymentEvents.createdAt));

    return events as PaymentEvent[];
  }

  // ================================
  // Payment Reminders
  // ================================

  /**
   * 결제 리마인더 생성
   */
  async createPaymentReminder(data: CreatePaymentReminderData, userId: string): Promise<PaymentReminder> {
    logger.info('Creating payment reminder', { paymentId: data.paymentId });

    const payment = await this.getPaymentById(data.paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const [reminder] = await db
      .insert(paymentReminders)
      .values({
        paymentId: data.paymentId,
        orderId: payment.orderId,
        userId,
        reminderType: data.reminderType,
        scheduledAt: data.scheduledAt,
        status: 'pending',
        attempts: 0,
      })
      .returning();

    return reminder as PaymentReminder;
  }

  /**
   * 리마인더 목록 조회
   */
  async getPaymentReminders(paymentId?: number): Promise<PaymentReminder[]> {
    let query = db.select().from(paymentReminders);

    if (paymentId) {
      query = query.where(eq(paymentReminders.paymentId, paymentId)) as any;
    }

    const results = await query.orderBy(desc(paymentReminders.createdAt));
    return results as PaymentReminder[];
  }

  // ================================
  // Webhooks
  // ================================

  /**
   * 웹훅 처리
   */
  async handleWebhook(data: PaymentWebhookData): Promise<void> {
    logger.info('Handling payment webhook', { provider: data.provider, eventType: data.eventType });

    // Find payment by provider payment ID
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, data.paymentId || ''))
      .limit(1);

    if (!payment) {
      logger.warn('Payment not found for webhook', { providerPaymentId: data.paymentId });
      return;
    }

    // Create event
    await this.createPaymentEvent(payment.id, 'webhook_received', data);

    // Update payment based on webhook event
    if (data.status === 'paid' || data.status === 'completed') {
      await this.updatePayment(
        payment.id,
        {
          status: 'completed',
          paidAt: new Date(),
        },
        'webhook'
      );
    } else if (data.status === 'failed') {
      await this.updatePayment(
        payment.id,
        {
          status: 'failed',
          failedAt: new Date(),
          failureReason: data.metadata?.reason,
        },
        'webhook'
      );
    }
  }

  // ================================
  // Admin Functions
  // ================================

  /**
   * 결제 상세 조회 (관리자)
   */
  async getPaymentDetail(id: number): Promise<PaymentDetail | null> {
    const payment = await this.getPaymentById(id);
    if (!payment) {
      return null;
    }

    const [refunds, events, user] = await Promise.all([
      this.getRefunds(id),
      this.getPaymentEvents(id),
      storage.getUserById(payment.userId),
    ]);

    const totalRefunded = refunds
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      payment,
      refunds,
      events,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
      } : {
        id: payment.userId,
        name: 'Unknown',
        email: 'unknown@example.com',
      },
      totalRefunded,
      netAmount: payment.amount - totalRefunded,
    };
  }

  /**
   * 결제 통계
   */
  async getPaymentStats(filters?: PaymentListFilters): Promise<PaymentStats> {
    const allPayments = await this.getPayments(filters);
    const allRefunds = await this.getRefunds();

    const totalAmount = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunded = allRefunds
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const byStatus: any = {};
    const byMethod: any = {};
    const byProvider: any = {};

    allPayments.forEach((p) => {
      // By status
      if (!byStatus[p.status]) {
        byStatus[p.status] = { count: 0, amount: 0 };
      }
      byStatus[p.status].count++;
      byStatus[p.status].amount += p.amount || 0;

      // By method
      if (!byMethod[p.paymentMethod]) {
        byMethod[p.paymentMethod] = { count: 0, amount: 0 };
      }
      byMethod[p.paymentMethod].count++;
      byMethod[p.paymentMethod].amount += p.amount || 0;

      // By provider
      if (!byProvider[p.provider]) {
        byProvider[p.provider] = { count: 0, amount: 0 };
      }
      byProvider[p.provider].count++;
      byProvider[p.provider].amount += p.amount || 0;
    });

    const completedPayments = allPayments.filter((p) => p.status === 'completed');
    const successRate = allPayments.length > 0
      ? (completedPayments.length / allPayments.length) * 100
      : 0;

    return {
      totalPayments: allPayments.length,
      totalAmount,
      totalRefunded,
      netAmount: totalAmount - totalRefunded,
      byStatus,
      byMethod,
      byProvider,
      averagePaymentAmount: allPayments.length > 0 ? totalAmount / allPayments.length : 0,
      successRate: Math.round(successRate * 10) / 10,
    };
  }

  /**
   * 결제 동기화 (외부 시스템과)
   */
  async syncPayment(paymentId: number): Promise<Payment> {
    logger.info('Syncing payment', { paymentId });

    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // In real implementation, fetch from provider API and update
    // For now, just create an event
    await this.createPaymentEvent(paymentId, 'status_changed', {
      action: 'manual_sync',
    });

    return payment;
  }

  /**
   * 결제 재시도
   */
  async retryPayment(paymentId: number): Promise<Payment> {
    logger.info('Retrying payment', { paymentId });

    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'failed') {
      throw new Error('Can only retry failed payments');
    }

    const updated = await this.updatePayment(
      paymentId,
      {
        status: 'processing',
        failureReason: null,
      },
      'admin'
    );

    return updated;
  }

  // ================================
  // Overdue Management (Phase 2)
  // ================================

  /**
   * 연체 결제 목록 조회 (관리자용)
   */
  async getOverduePayments(filters: {
    status?: string;
    minDays?: number;
  }): Promise<Payment[]> {
    logger.info('Getting overdue payments', filters);

    const conditions: any[] = [];

    // 연체 상태 필터
    if (filters.status) {
      conditions.push(eq(storage.payments.overdueStatus, filters.status));
    } else {
      // 기본: 정상 상태 제외
      conditions.push(eq(storage.payments.overdueStatus, 'overdue'));
    }

    // 최소 연체 일수 필터
    if (filters.minDays) {
      conditions.push(gte(storage.payments.overdueDays, filters.minDays));
    }

    const payments = await db
      .select()
      .from(storage.payments)
      .where(and(...conditions))
      .orderBy(desc(storage.payments.overdueDays));

    return payments;
  }

  /**
   * 결제 독촉 발송
   */
  async sendPaymentReminder(paymentId: number, message?: string): Promise<Payment> {
    logger.info('Sending payment reminder', { paymentId, message });

    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'completed') {
      throw new Error('Cannot send reminder for completed payment');
    }

    // 독촉 발송 횟수 증가 및 타임스탬프 업데이트
    const updated = await db
      .update(storage.payments)
      .set({
        reminderSentCount: (payment.reminderSentCount || 0) + 1,
        lastReminderSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storage.payments.id, paymentId))
      .returning();

    // TODO: 실제 알림 발송 로직 (푸시/이메일/SMS)
    logger.info('Payment reminder sent', {
      paymentId,
      count: updated[0].reminderSentCount,
    });

    return updated[0];
  }

  /**
   * 서비스 이용 제한
   */
  async restrictService(paymentId: number, reason?: string): Promise<Payment> {
    logger.info('Restricting service', { paymentId, reason });

    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'completed') {
      throw new Error('Cannot restrict service for completed payment');
    }

    // 서비스 제한 시작
    const updated = await db
      .update(storage.payments)
      .set({
        overdueStatus: 'overdue',
        serviceRestrictedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storage.payments.id, paymentId))
      .returning();

    // TODO: 실제 서비스 제한 로직 (주문 접수 차단 등)
    logger.info('Service restricted', { paymentId });

    return updated[0];
  }

  /**
   * 채권 추심 위탁
   */
  async startCollection(
    paymentId: number,
    agency?: string,
    notes?: string
  ): Promise<Payment> {
    logger.info('Starting collection', { paymentId, agency, notes });

    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'completed') {
      throw new Error('Cannot start collection for completed payment');
    }

    // 채권 추심 시작
    const updated = await db
      .update(storage.payments)
      .set({
        overdueStatus: 'collection',
        collectionStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storage.payments.id, paymentId))
      .returning();

    // TODO: 실제 추심 위탁 로직 (외부 추심 기관 연동)
    logger.info('Collection started', { paymentId, agency });

    return updated[0];
  }

  /**
   * 내 연체 결제 조회 (사용자용)
   */
  async getMyOverduePayments(userId: number): Promise<Payment[]> {
    logger.info('Getting my overdue payments', { userId });

    const payments = await db
      .select()
      .from(storage.payments)
      .where(
        and(
          eq(storage.payments.userId, userId),
          eq(storage.payments.overdueStatus, 'overdue')
        )
      )
      .orderBy(desc(storage.payments.overdueDays));

    return payments;
  }

  /**
   * 연체이자 계산 (연 15%, 일할 계산)
   */
  calculateLateInterest(principalAmount: number, overdueDays: number): number {
    const annualRate = 0.15; // 15%
    const dailyRate = annualRate / 365;
    const interest = principalAmount * dailyRate * overdueDays;
    return Math.round(interest * 100) / 100; // 소수점 2자리
  }
}

export const paymentService = new PaymentService();
