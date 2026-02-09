/**
 * Settlement Service
 * 정산 비즈니스 로직
 */

import { storage, db } from '../storage';
import { eq, and, gte, lte, desc, inArray, sql } from 'drizzle-orm';
import {
  Settlement,
  CreateSettlementData,
  UpdateSettlementData,
  SettlementSummary,
  SettlementStatement,
  CreateSettlementStatementData,
  Deduction,
  CreateDeductionData,
  Payout,
  CreatePayoutData,
  DailySettlementReport,
  HelperSettlementReport,
  MonthlySettlementSummary,
  BatchSettlementOperation,
  SettlementValidation,
  OutstandingBalance,
  SettlementAuditLog,
  SettlementEmailData,
  SettlementExportData,
  BalanceInvoice,
  CreateBalanceInvoiceData,
  SettlementStatus,
  PayoutStatus,
} from '../types/settlement.types';
import { logger } from '../lib/logger';
import {
  settlements,
  orders,
  users,
  deductions,
  payouts,
  settlementStatements,
  balanceInvoices,
  auditLogs,
} from '@shared/schema';

class SettlementService {
  // ================================
  // Settlement CRUD Operations
  // ================================

  /**
   * 정산 생성
   */
  async createSettlement(data: CreateSettlementData, createdBy: string): Promise<Settlement> {
    logger.info('Creating settlement', { orderId: data.orderId, helperId: data.helperId });

    const netAmount = data.amount - (data.deductions || 0);

    const [settlement] = await db
      .insert(settlements)
      .values({
        orderId: data.orderId,
        helperId: data.helperId,
        requesterId: data.requesterId,
        amount: data.amount,
        deductions: data.deductions || 0,
        netAmount,
        status: 'pending',
        dueDate: data.dueDate,
        notes: data.notes,
      })
      .returning();

    // Audit log
    await this.createAuditLog(settlement.id, 'create', createdBy, null, settlement);

    return settlement as Settlement;
  }

  /**
   * 정산 조회 (단건)
   */
  async getSettlementById(id: number): Promise<Settlement | null> {
    const [settlement] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, id))
      .limit(1);

    return settlement as Settlement || null;
  }

  /**
   * 정산 목록 조회 (관리자)
   */
  async getSettlements(filters?: {
    helperId?: string;
    requesterId?: string;
    status?: SettlementStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Settlement[]> {
    let query = db.select().from(settlements);

    const conditions: any[] = [];

    if (filters?.helperId) {
      conditions.push(eq(settlements.helperId, filters.helperId));
    }
    if (filters?.requesterId) {
      conditions.push(eq(settlements.requesterId, filters.requesterId));
    }
    if (filters?.status) {
      conditions.push(eq(settlements.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte(settlements.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(settlements.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(settlements.createdAt));
    return results as Settlement[];
  }

  /**
   * 헬퍼의 정산 목록 조회
   */
  async getHelperSettlements(helperId: string): Promise<Settlement[]> {
    const results = await db
      .select()
      .from(settlements)
      .where(eq(settlements.helperId, helperId))
      .orderBy(desc(settlements.createdAt));

    return results as Settlement[];
  }

  /**
   * 정산 업데이트
   */
  async updateSettlement(
    id: number,
    data: UpdateSettlementData,
    updatedBy: string
  ): Promise<Settlement> {
    const oldSettlement = await this.getSettlementById(id);
    if (!oldSettlement) {
      throw new Error('Settlement not found');
    }

    // Calculate net amount if amount or deductions changed
    let netAmount = oldSettlement.netAmount;
    if (data.amount !== undefined || data.deductions !== undefined) {
      const amount = data.amount ?? oldSettlement.amount;
      const deductions = data.deductions ?? oldSettlement.deductions;
      netAmount = amount - deductions;
    }

    const [updated] = await db
      .update(settlements)
      .set({
        ...data,
        netAmount,
        updatedAt: new Date(),
      })
      .where(eq(settlements.id, id))
      .returning();

    // Audit log
    await this.createAuditLog(id, 'update', updatedBy, oldSettlement, updated);

    return updated as Settlement;
  }

  // ================================
  // Settlement Status Transitions
  // ================================

  /**
   * 정산을 'ready' 상태로 변경
   */
  async markSettlementReady(id: number, updatedBy: string): Promise<Settlement> {
    logger.info('Marking settlement as ready', { settlementId: id });
    return this.updateSettlement(id, { status: 'ready' }, updatedBy);
  }

  /**
   * 정산 확정
   */
  async confirmSettlement(id: number, confirmedBy: string): Promise<Settlement> {
    logger.info('Confirming settlement', { settlementId: id });

    const settlement = await this.getSettlementById(id);
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    if (settlement.status === 'confirmed' || settlement.status === 'paid') {
      throw new Error('Settlement already confirmed or paid');
    }

    const [updated] = await db
      .update(settlements)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(settlements.id, id))
      .returning();

    // Audit log
    await this.createAuditLog(id, 'confirm', confirmedBy, settlement, updated);

    return updated as Settlement;
  }

  /**
   * 정산 지급 완료
   */
  async markSettlementPaid(id: number, paidBy: string): Promise<Settlement> {
    logger.info('Marking settlement as paid', { settlementId: id });

    const settlement = await this.getSettlementById(id);
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    if (settlement.status !== 'confirmed') {
      throw new Error('Settlement must be confirmed before marking as paid');
    }

    const [updated] = await db
      .update(settlements)
      .set({
        status: 'paid',
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(settlements.id, id))
      .returning();

    // Audit log
    await this.createAuditLog(id, 'mark_paid', paidBy, settlement, updated);

    return updated as Settlement;
  }

  /**
   * 정산 보류
   */
  async holdSettlement(id: number, reason: string, heldBy: string): Promise<Settlement> {
    logger.info('Holding settlement', { settlementId: id, reason });

    const updated = await this.updateSettlement(
      id,
      { status: 'on_hold', notes: reason },
      heldBy
    );

    return updated;
  }

  /**
   * 정산 보류 해제
   */
  async releaseSettlement(id: number, releasedBy: string): Promise<Settlement> {
    logger.info('Releasing settlement', { settlementId: id });
    return this.updateSettlement(id, { status: 'ready' }, releasedBy);
  }

  /**
   * 정산 취소
   */
  async cancelSettlement(id: number, reason: string, cancelledBy: string): Promise<Settlement> {
    logger.info('Cancelling settlement', { settlementId: id, reason });

    const updated = await this.updateSettlement(
      id,
      { status: 'cancelled', notes: reason },
      cancelledBy
    );

    return updated;
  }

  /**
   * 정산 잠금 (편집 방지)
   */
  async lockSettlement(id: number, lockedBy: string): Promise<Settlement> {
    const settlement = await this.getSettlementById(id);
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    // Add lock metadata
    const metadata = { ...(settlement.metadata || {}), locked: true, lockedBy, lockedAt: new Date() };

    return this.updateSettlement(id, { metadata }, lockedBy);
  }

  /**
   * 정산 잠금 해제
   */
  async unlockSettlement(id: number, unlockedBy: string): Promise<Settlement> {
    const settlement = await this.getSettlementById(id);
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    const metadata = { ...(settlement.metadata || {}), locked: false, unlockedBy, unlockedAt: new Date() };

    return this.updateSettlement(id, { metadata }, unlockedBy);
  }

  // ================================
  // Settlement Calculations
  // ================================

  /**
   * 주문의 정산 요약 계산
   */
  async calculateSettlementSummary(orderId: number): Promise<SettlementSummary> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new Error('Order not found');
    }

    // Get deductions for this order
    const orderDeductions = await db
      .select()
      .from(deductions)
      .where(and(
        eq(deductions.orderId, orderId),
        eq(deductions.status, 'applied')
      ));

    const totalDeductions = orderDeductions.reduce((sum, d) => sum + (d.amount || 0), 0);

    // Calculate platform fee (예: 10%)
    const platformFeeRate = 0.1;
    const totalAmount = order.totalPrice || 0;
    const platformFee = totalAmount * platformFeeRate;
    const helperPayout = totalAmount - platformFee - totalDeductions;

    const summary: SettlementSummary = {
      orderId: order.id,
      totalAmount,
      deductions: totalDeductions,
      netAmount: totalAmount - totalDeductions,
      helperPayout,
      platformFee,
      requesterId: order.requesterId,
      helperId: order.assignedHelperId || '',
      orderDetails: {
        title: order.title,
        status: order.status,
        completedAt: order.completedAt,
      },
    };

    return summary;
  }

  /**
   * 주문에 대한 정산 생성 (자동)
   */
  async generateSettlementForOrder(orderId: number, createdBy: string): Promise<Settlement> {
    const summary = await this.calculateSettlementSummary(orderId);

    const settlement = await this.createSettlement(
      {
        orderId,
        helperId: summary.helperId,
        requesterId: summary.requesterId,
        amount: summary.totalAmount,
        deductions: summary.deductions,
      },
      createdBy
    );

    return settlement;
  }

  /**
   * 월별 정산 자동 생성
   */
  async generateMonthlySettlements(
    year: number,
    month: number,
    createdBy: string
  ): Promise<Settlement[]> {
    logger.info('Generating monthly settlements', { year, month });

    // Find all completed orders in the month without settlements
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          gte(orders.completedAt, startDate),
          lte(orders.completedAt, endDate)
        )
      );

    const generatedSettlements: Settlement[] = [];

    for (const order of completedOrders) {
      // Check if settlement already exists
      const existing = await db
        .select()
        .from(settlements)
        .where(eq(settlements.orderId, order.id))
        .limit(1);

      if (existing.length === 0) {
        try {
          const settlement = await this.generateSettlementForOrder(order.id, createdBy);
          generatedSettlements.push(settlement);
        } catch (error) {
          logger.error('Failed to generate settlement for order', error as Error, { orderId: order.id });
        }
      }
    }

    logger.info('Monthly settlements generated', { count: generatedSettlements.length });
    return generatedSettlements;
  }

  // ================================
  // Deductions Management
  // ================================

  /**
   * 공제 생성
   */
  async createDeduction(data: CreateDeductionData, createdBy: string): Promise<Deduction> {
    logger.info('Creating deduction', { helperId: data.helperId, amount: data.amount });

    const [deduction] = await db
      .insert(deductions)
      .values({
        ...data,
        status: 'pending',
        createdBy,
      })
      .returning();

    return deduction as Deduction;
  }

  /**
   * 공제 적용
   */
  async applyDeduction(id: number, appliedBy: string): Promise<Deduction> {
    logger.info('Applying deduction', { deductionId: id });

    const [updated] = await db
      .update(deductions)
      .set({
        status: 'applied',
        appliedAt: new Date(),
      })
      .where(eq(deductions.id, id))
      .returning();

    // If linked to settlement, update settlement amount
    if (updated.settlementId) {
      const settlement = await this.getSettlementById(updated.settlementId);
      if (settlement) {
        await this.updateSettlement(
          settlement.id,
          { deductions: settlement.deductions + (updated.amount || 0) },
          appliedBy
        );
      }
    }

    return updated as Deduction;
  }

  /**
   * 공제 취소
   */
  async cancelDeduction(id: number, cancelledBy: string): Promise<Deduction> {
    logger.info('Cancelling deduction', { deductionId: id });

    const [deduction] = await db
      .select()
      .from(deductions)
      .where(eq(deductions.id, id))
      .limit(1);

    if (!deduction) {
      throw new Error('Deduction not found');
    }

    const [updated] = await db
      .update(deductions)
      .set({ status: 'cancelled' })
      .where(eq(deductions.id, id))
      .returning();

    // If was applied to settlement, adjust settlement amount
    if (deduction.status === 'applied' && deduction.settlementId) {
      const settlement = await this.getSettlementById(deduction.settlementId);
      if (settlement) {
        await this.updateSettlement(
          settlement.id,
          { deductions: Math.max(0, settlement.deductions - (deduction.amount || 0)) },
          cancelledBy
        );
      }
    }

    return updated as Deduction;
  }

  /**
   * 공제 목록 조회
   */
  async getDeductions(filters?: {
    helperId?: string;
    settlementId?: number;
    status?: 'pending' | 'applied' | 'cancelled';
  }): Promise<Deduction[]> {
    let query = db.select().from(deductions);

    const conditions: any[] = [];

    if (filters?.helperId) {
      conditions.push(eq(deductions.helperId, filters.helperId));
    }
    if (filters?.settlementId) {
      conditions.push(eq(deductions.settlementId, filters.settlementId));
    }
    if (filters?.status) {
      conditions.push(eq(deductions.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(deductions.createdAt));
    return results as Deduction[];
  }

  // ================================
  // Payout Management
  // ================================

  /**
   * 지급 요청 생성
   */
  async createPayout(data: CreatePayoutData, createdBy: string): Promise<Payout> {
    const settlement = await this.getSettlementById(data.settlementId);
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    if (settlement.status !== 'confirmed') {
      throw new Error('Settlement must be confirmed before creating payout');
    }

    logger.info('Creating payout', { settlementId: data.settlementId, amount: settlement.netAmount });

    const [payout] = await db
      .insert(payouts)
      .values({
        settlementId: data.settlementId,
        helperId: settlement.helperId,
        amount: settlement.netAmount,
        status: 'pending',
        method: data.method,
        accountInfo: data.accountInfo,
        retryCount: 0,
        createdBy,
      })
      .returning();

    return payout as Payout;
  }

  /**
   * 지급 상태 업데이트
   */
  async updatePayoutStatus(
    id: number,
    status: PayoutStatus,
    updatedBy: string,
    failureReason?: string
  ): Promise<Payout> {
    logger.info('Updating payout status', { payoutId: id, status });

    const updates: any = { status, updatedAt: new Date() };

    if (status === 'sent') {
      updates.sentAt = new Date();
    } else if (status === 'succeeded') {
      updates.succeededAt = new Date();

      // Also mark settlement as paid
      const [payout] = await db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
      if (payout) {
        await this.markSettlementPaid(payout.settlementId, updatedBy);
      }
    } else if (status === 'failed') {
      updates.failedAt = new Date();
      updates.failureReason = failureReason;
    }

    const [updated] = await db
      .update(payouts)
      .set(updates)
      .where(eq(payouts.id, id))
      .returning();

    return updated as Payout;
  }

  /**
   * 지급 재시도
   */
  async retryPayout(id: number, retriedBy: string): Promise<Payout> {
    logger.info('Retrying payout', { payoutId: id });

    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, id))
      .limit(1);

    if (!payout) {
      throw new Error('Payout not found');
    }

    const [updated] = await db
      .update(payouts)
      .set({
        status: 'pending',
        retryCount: (payout.retryCount || 0) + 1,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, id))
      .returning();

    return updated as Payout;
  }

  /**
   * 지급 내역 조회
   */
  async getPayouts(filters?: {
    settlementId?: number;
    helperId?: string;
    status?: PayoutStatus;
  }): Promise<Payout[]> {
    let query = db.select().from(payouts);

    const conditions: any[] = [];

    if (filters?.settlementId) {
      conditions.push(eq(payouts.settlementId, filters.settlementId));
    }
    if (filters?.helperId) {
      conditions.push(eq(payouts.helperId, filters.helperId));
    }
    if (filters?.status) {
      conditions.push(eq(payouts.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(payouts.createdAt));
    return results as Payout[];
  }

  // ================================
  // Batch Operations
  // ================================

  /**
   * 정산 일괄 확정
   */
  async batchConfirmSettlements(
    operation: BatchSettlementOperation,
    confirmedBy: string
  ): Promise<Settlement[]> {
    logger.info('Batch confirming settlements', { count: operation.settlementIds.length });

    const confirmed: Settlement[] = [];

    for (const id of operation.settlementIds) {
      try {
        const settlement = await this.confirmSettlement(id, confirmedBy);
        confirmed.push(settlement);
      } catch (error) {
        logger.error('Failed to confirm settlement', error as Error, { settlementId: id });
      }
    }

    return confirmed;
  }

  /**
   * 정산 일괄 지급
   */
  async batchPaySettlements(
    operation: BatchSettlementOperation,
    paidBy: string
  ): Promise<Settlement[]> {
    logger.info('Batch paying settlements', { count: operation.settlementIds.length });

    const paid: Settlement[] = [];

    for (const id of operation.settlementIds) {
      try {
        const settlement = await this.markSettlementPaid(id, paidBy);
        paid.push(settlement);
      } catch (error) {
        logger.error('Failed to pay settlement', error as Error, { settlementId: id });
      }
    }

    return paid;
  }

  // ================================
  // Reporting
  // ================================

  /**
   * 일별 정산 리포트
   */
  async getDailyReport(date: Date): Promise<DailySettlementReport> {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const dailySettlements = await this.getSettlements({
      startDate: startOfDay,
      endDate: endOfDay,
    });

    const byStatus: Record<SettlementStatus, number> = {
      pending: 0,
      ready: 0,
      confirmed: 0,
      paid: 0,
      on_hold: 0,
      cancelled: 0,
    };

    let totalAmount = 0;
    let totalDeductions = 0;

    dailySettlements.forEach((s) => {
      byStatus[s.status]++;
      totalAmount += s.amount;
      totalDeductions += s.deductions;
    });

    return {
      date: startOfDay,
      totalOrders: dailySettlements.length,
      totalAmount,
      totalDeductions,
      netAmount: totalAmount - totalDeductions,
      settlementsCount: dailySettlements.length,
      byStatus,
    };
  }

  /**
   * 헬퍼별 정산 리포트
   */
  async getHelperReport(helperId: string): Promise<HelperSettlementReport> {
    const helperSettlements = await this.getHelperSettlements(helperId);

    const [helper] = await db
      .select()
      .from(users)
      .where(eq(users.id, helperId))
      .limit(1);

    let totalAmount = 0;
    let totalDeductions = 0;
    let pendingAmount = 0;
    let paidAmount = 0;

    helperSettlements.forEach((s) => {
      totalAmount += s.amount;
      totalDeductions += s.deductions;

      if (s.status === 'paid') {
        paidAmount += s.netAmount;
      } else if (s.status !== 'cancelled') {
        pendingAmount += s.netAmount;
      }
    });

    return {
      helperId,
      helperName: helper?.name || 'Unknown',
      totalOrders: helperSettlements.length,
      totalAmount,
      totalDeductions,
      netAmount: totalAmount - totalDeductions,
      pendingAmount,
      paidAmount,
      settlements: helperSettlements,
    };
  }

  /**
   * 월별 정산 요약
   */
  async getMonthlyReport(year: number, month: number): Promise<MonthlySettlementSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const monthlySettlements = await this.getSettlements({
      startDate,
      endDate,
    });

    const helpers = new Set<string>();
    const requesters = new Set<string>();
    const byStatus: Record<SettlementStatus, { count: number; amount: number }> = {
      pending: { count: 0, amount: 0 },
      ready: { count: 0, amount: 0 },
      confirmed: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      on_hold: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    };

    let totalAmount = 0;
    let totalDeductions = 0;
    let paidAmount = 0;
    let pendingAmount = 0;

    monthlySettlements.forEach((s) => {
      helpers.add(s.helperId);
      requesters.add(s.requesterId);
      byStatus[s.status].count++;
      byStatus[s.status].amount += s.netAmount;

      totalAmount += s.amount;
      totalDeductions += s.deductions;

      if (s.status === 'paid') {
        paidAmount += s.netAmount;
      } else if (s.status !== 'cancelled') {
        pendingAmount += s.netAmount;
      }
    });

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      totalOrders: monthlySettlements.length,
      totalHelpers: helpers.size,
      totalRequesters: requesters.size,
      totalAmount,
      totalDeductions,
      netAmount: totalAmount - totalDeductions,
      paidAmount,
      pendingAmount,
      byStatus,
    };
  }

  // ================================
  // Audit & Validation
  // ================================

  /**
   * 정산 검증
   */
  async validateSettlement(id: number): Promise<SettlementValidation> {
    const settlement = await this.getSettlementById(id);
    if (!settlement) {
      return {
        settlementId: id,
        isValid: false,
        errors: ['Settlement not found'],
        warnings: [],
        details: {
          orderExists: false,
          helperExists: false,
          requesterExists: false,
          amountValid: false,
          statusValid: false,
        },
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const details = {
      orderExists: false,
      helperExists: false,
      requesterExists: false,
      amountValid: false,
      statusValid: false,
    };

    // Check order exists
    const [order] = await db.select().from(orders).where(eq(orders.id, settlement.orderId)).limit(1);
    details.orderExists = !!order;
    if (!order) errors.push('Associated order not found');

    // Check helper exists
    const [helper] = await db.select().from(users).where(eq(users.id, settlement.helperId)).limit(1);
    details.helperExists = !!helper;
    if (!helper) errors.push('Helper not found');

    // Check requester exists
    const [requester] = await db.select().from(users).where(eq(users.id, settlement.requesterId)).limit(1);
    details.requesterExists = !!requester;
    if (!requester) errors.push('Requester not found');

    // Check amounts
    details.amountValid = settlement.amount > 0 && settlement.netAmount >= 0;
    if (settlement.amount <= 0) errors.push('Invalid amount');
    if (settlement.netAmount < 0) errors.push('Net amount cannot be negative');
    if (settlement.amount - settlement.deductions !== settlement.netAmount) {
      errors.push('Amount calculation mismatch');
    }

    // Check status
    const validStatuses: SettlementStatus[] = ['pending', 'ready', 'confirmed', 'paid', 'on_hold', 'cancelled'];
    details.statusValid = validStatuses.includes(settlement.status);
    if (!details.statusValid) errors.push('Invalid status');

    // Warnings
    if (settlement.status === 'pending' && settlement.createdAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      warnings.push('Settlement pending for more than 7 days');
    }

    return {
      settlementId: id,
      isValid: errors.length === 0,
      errors,
      warnings,
      details,
    };
  }

  /**
   * Audit log 생성
   */
  async createAuditLog(
    settlementId: number,
    action: string,
    performedBy: string,
    oldValue: any,
    newValue: any,
    notes?: string
  ): Promise<void> {
    await db.insert(auditLogs).values({
      entityType: 'settlement',
      entityId: settlementId.toString(),
      action,
      performedBy,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      notes,
    });
  }

  /**
   * Audit logs 조회
   */
  async getAuditLogs(settlementId: number): Promise<SettlementAuditLog[]> {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, 'settlement'),
          eq(auditLogs.entityId, settlementId.toString())
        )
      )
      .orderBy(desc(auditLogs.createdAt));

    return logs.map((log) => ({
      id: log.id,
      settlementId,
      action: log.action,
      performedBy: log.performedBy,
      performedByName: log.performedBy, // TODO: Join with users table
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      newValue: log.newValue ? JSON.parse(log.newValue) : null,
      notes: log.notes || undefined,
      createdAt: log.createdAt,
    }));
  }

  // ================================
  // Outstanding Balances
  // ================================

  /**
   * 미지급 잔액 조회
   */
  async getOutstandingBalances(): Promise<OutstandingBalance[]> {
    // This would query for unpaid settlements past their due date
    const now = new Date();

    const overdueSettlements = await db
      .select()
      .from(settlements)
      .where(
        and(
          eq(settlements.status, 'confirmed'),
          lte(settlements.dueDate, now)
        )
      )
      .orderBy(settlements.dueDate);

    const outstandingBalances: OutstandingBalance[] = [];

    for (const settlement of overdueSettlements) {
      const [order] = await db.select().from(orders).where(eq(orders.id, settlement.orderId)).limit(1);
      const [requester] = await db.select().from(users).where(eq(users.id, settlement.requesterId)).limit(1);

      if (order && requester && settlement.dueDate) {
        const daysPastDue = Math.floor((now.getTime() - settlement.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        outstandingBalances.push({
          orderId: order.id,
          requesterId: requester.id,
          requesterName: requester.name,
          amount: settlement.netAmount,
          dueDate: settlement.dueDate,
          daysPastDue,
          status: 'overdue',
          order: {
            title: order.title,
            completedAt: order.completedAt || new Date(),
          },
        });
      }
    }

    return outstandingBalances;
  }
}

export const settlementService = new SettlementService();
