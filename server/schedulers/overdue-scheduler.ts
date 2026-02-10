/**
 * Overdue Payment Scheduler (Phase 2)
 * 매일 자정 연체 오더 스캔 및 자동 독촉/지연손해금 누적
 */

import cron from 'node-cron';
import { db } from '../storage';
import { storage } from '../storage';
import { payments } from '@shared/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { paymentService } from '../services/payment.service';
import { logger } from '../lib/logger';

interface OverdueStage {
  minDays: number;
  maxDays: number;
  action: 'reminder' | 'restrict' | 'collection' | 'legal';
  description: string;
}

// 연체 단계별 액션 정의
const OVERDUE_STAGES: OverdueStage[] = [
  { minDays: 0, maxDays: 2, action: 'reminder', description: '1차 독촉 (D+0~2)' },
  { minDays: 3, maxDays: 6, action: 'reminder', description: '2차 독촉 (D+3~6)' },
  { minDays: 7, maxDays: 13, action: 'restrict', description: '서비스 제한 (D+7~13)' },
  { minDays: 14, maxDays: 29, action: 'collection', description: '추심 위탁 경고 (D+14~29)' },
  { minDays: 30, maxDays: 9999, action: 'legal', description: '법적 조치 (D+30+)' },
];

class OverdueScheduler {
  private isRunning = false;

  /**
   * 스케줄러 시작 (매일 자정 실행)
   */
  start() {
    // 매일 오전 1시에 실행 (자정은 부하가 많을 수 있으므로)
    cron.schedule('0 1 * * *', async () => {
      await this.processOverduePayments();
    });

    // 매시간 정각에도 실행 (실시간성 보강)
    cron.schedule('0 * * * *', async () => {
      await this.updateOverdueDays();
    });

    logger.info('✅ Overdue scheduler started');
    logger.info('- Daily scan: 1:00 AM');
    logger.info('- Hourly update: every hour at :00');
  }

  /**
   * 연체 결제 처리 (메인 로직)
   */
  async processOverduePayments() {
    if (this.isRunning) {
      logger.warn('Overdue scheduler already running, skipping...');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Starting overdue payment scan...');

    try {
      // 1. 연체 일수 업데이트
      await this.updateOverdueDays();

      // 2. 연체 결제 조회 (status != 'completed')
      const overduePayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.status, 'pending'),
            gte(payments.overdueDays, 1)
          )
        );

      logger.info(`Found ${overduePayments.length} overdue payments`);

      // 3. 각 결제에 대해 단계별 액션 실행
      for (const payment of overduePayments) {
        await this.processPayment(payment);
      }

      logger.info('✅ Overdue payment scan completed');
    } catch (error) {
      logger.error('❌ Overdue scheduler error', error as Error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 연체 일수 업데이트 (모든 pending 결제)
   */
  async updateOverdueDays() {
    try {
      // dueDate가 과거인 모든 pending 결제 조회
      const pendingPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.status, 'pending'));

      const now = new Date();
      let updatedCount = 0;

      for (const payment of pendingPayments) {
        if (!payment.dueDate) continue;

        const dueDate = new Date(payment.dueDate);
        const diffTime = now.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          // 연체 일수 계산 및 지연손해금 계산
          const lateInterest = paymentService.calculateLateInterest(
            payment.amount,
            diffDays
          );

          // 연체 상태 결정
          let overdueStatus = 'normal';
          if (diffDays >= 30) overdueStatus = 'legal';
          else if (diffDays >= 14) overdueStatus = 'collection';
          else if (diffDays >= 7) overdueStatus = 'overdue';
          else if (diffDays >= 1) overdueStatus = 'warning';

          await db
            .update(payments)
            .set({
              overdueDays: diffDays,
              lateInterest: lateInterest.toString(),
              overdueStatus,
              updatedAt: new Date(),
            })
            .where(eq(payments.id, payment.id));

          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        logger.info(`Updated ${updatedCount} overdue payment records`);
      }
    } catch (error) {
      logger.error('Failed to update overdue days', error as Error);
    }
  }

  /**
   * 개별 결제 처리 (단계별 액션)
   */
  async processPayment(payment: any) {
    const overdueDays = payment.overdueDays || 0;

    // 해당 연체 일수에 맞는 단계 찾기
    const stage = OVERDUE_STAGES.find(
      (s) => overdueDays >= s.minDays && overdueDays <= s.maxDays
    );

    if (!stage) return;

    logger.info(
      `Processing payment ${payment.id}: ${overdueDays} days overdue - ${stage.description}`
    );

    try {
      switch (stage.action) {
        case 'reminder':
          await this.sendReminder(payment, overdueDays);
          break;

        case 'restrict':
          await this.restrictService(payment);
          break;

        case 'collection':
          await this.startCollection(payment);
          break;

        case 'legal':
          await this.startLegalAction(payment);
          break;
      }
    } catch (error) {
      logger.error(`Failed to process payment ${payment.id}`, error as Error);
    }
  }

  /**
   * 독촉 발송
   */
  async sendReminder(payment: any, overdueDays: number) {
    // 이미 최근에 독촉을 보냈는지 확인 (중복 방지)
    if (payment.lastReminderSentAt) {
      const lastSent = new Date(payment.lastReminderSentAt);
      const hoursSinceLastReminder =
        (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);

      // 24시간 이내에 보낸 적이 있으면 스킵
      if (hoursSinceLastReminder < 24) {
        return;
      }
    }

    const message = `잔금 결제가 ${overdueDays}일 연체되었습니다. 지연손해금(연 15%)이 발생하고 있습니다.`;

    await paymentService.sendPaymentReminder(payment.id, message);
    logger.info(`Reminder sent for payment ${payment.id}`);
  }

  /**
   * 서비스 이용 제한
   */
  async restrictService(payment: any) {
    // 이미 제한되었는지 확인
    if (payment.serviceRestrictedAt) {
      return;
    }

    const reason = `${payment.overdueDays}일 연체로 인한 서비스 이용 제한`;
    await paymentService.restrictService(payment.id, reason);
    logger.info(`Service restricted for payment ${payment.id}`);
  }

  /**
   * 채권 추심 위탁 시작
   */
  async startCollection(payment: any) {
    // 이미 추심이 시작되었는지 확인
    if (payment.collectionStartedAt) {
      return;
    }

    const agency = 'Default Collection Agency'; // TODO: 실제 추심 기관 정보
    const notes = `${payment.overdueDays}일 연체, 지연손해금: ${payment.lateInterest}원`;

    await paymentService.startCollection(payment.id, agency, notes);
    logger.info(`Collection started for payment ${payment.id}`);
  }

  /**
   * 법적 조치 시작
   */
  async startLegalAction(payment: any) {
    // 이미 법적 조치가 시작되었는지 확인
    if (payment.legalActionStartedAt) {
      return;
    }

    await db
      .update(payments)
      .set({
        overdueStatus: 'legal',
        legalActionStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    // TODO: 법무팀 알림, 소송 준비 등
    logger.warn(`Legal action initiated for payment ${payment.id}`);
  }

  /**
   * 수동 실행 (테스트용)
   */
  async runNow() {
    logger.info('Manual overdue scan triggered');
    await this.processOverduePayments();
  }
}

export const overdueScheduler = new OverdueScheduler();
