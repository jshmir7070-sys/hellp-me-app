/**
 * Settlement Routes
 * 정산 관련 라우트 정의 (64+ endpoints)
 */

import { Express } from 'express';
import { settlementController } from '../controllers/settlement.controller';
import { requireAuth, adminAuth } from '../utils/auth-middleware';

// Note: requirePermission middleware would need to be imported if it exists
// For now, we'll use adminAuth as placeholder

export function registerSettlementRoutes(app: Express) {
  // ================================
  // Public/Helper Endpoints (4)
  // ================================

  /**
   * GET /api/orders/:orderId/settlement-summary
   * 주문의 정산 요약 조회
   */
  app.get(
    '/api/orders/:orderId/settlement-summary',
    requireAuth,
    settlementController.getOrderSettlementSummary.bind(settlementController)
  );

  /**
   * GET /api/helper/settlement
   * 헬퍼의 정산 내역 조회
   */
  app.get(
    '/api/helper/settlement',
    requireAuth,
    settlementController.getHelperSettlement.bind(settlementController)
  );

  /**
   * GET /api/helpers/me/settlements
   * 내 정산 목록 조회 (헬퍼)
   */
  app.get(
    '/api/helpers/me/settlements',
    requireAuth,
    settlementController.getMySettlements.bind(settlementController)
  );

  /**
   * PATCH /api/helpers/settlements/:id/confirm
   * 정산 확인 (헬퍼)
   */
  app.patch(
    '/api/helpers/settlements/:id/confirm',
    requireAuth,
    settlementController.helperConfirmSettlement.bind(settlementController)
  );

  // ================================
  // Admin Endpoints - CRUD (8)
  // ================================

  /**
   * GET /api/admin/settlements
   * 정산 목록 조회
   */
  app.get(
    '/api/admin/settlements',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getSettlements.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/:id
   * 정산 상세 조회
   */
  app.get(
    '/api/admin/settlements/:id',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getSettlementById.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements
   * 정산 생성
   */
  app.post(
    '/api/admin/settlements',
    adminAuth,
    // requirePermission('settlements.create'),
    settlementController.createSettlement.bind(settlementController)
  );

  /**
   * PATCH /api/admin/settlements/:id/amount
   * 정산 금액 수정
   */
  app.patch(
    '/api/admin/settlements/:id/amount',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.updateSettlementAmount.bind(settlementController)
  );

  /**
   * PATCH /api/admin/settlements/:id/counts
   * 정산 수량 수정
   */
  app.patch(
    '/api/admin/settlements/:id/counts',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.updateSettlementCounts.bind(settlementController)
  );

  // ================================
  // Admin Endpoints - Status Changes (11)
  // ================================

  /**
   * POST /api/admin/settlements/:id/mark-ready
   * 정산을 'ready' 상태로 변경
   */
  app.post(
    '/api/admin/settlements/:id/mark-ready',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.markSettlementReady.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/:id/confirm
   * 정산 확정 (POST)
   */
  app.post(
    '/api/admin/settlements/:id/confirm',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.confirmSettlement.bind(settlementController)
  );

  /**
   * PATCH /api/admin/settlements/:id/confirm
   * 정산 확정 (PATCH)
   */
  app.patch(
    '/api/admin/settlements/:id/confirm',
    adminAuth,
    // requirePermission('settlements.confirm'),
    settlementController.confirmSettlement.bind(settlementController)
  );

  /**
   * PATCH /api/admin/settlements/:id/pay
   * 정산 지급 완료
   */
  app.patch(
    '/api/admin/settlements/:id/pay',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.paySettlement.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/:id/mark-paid
   * 정산 지급 완료 표시
   */
  app.post(
    '/api/admin/settlements/:id/mark-paid',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.markSettlementPaid.bind(settlementController)
  );

  /**
   * PATCH /api/admin/settlements/:id/hold
   * 정산 보류
   */
  app.patch(
    '/api/admin/settlements/:id/hold',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.holdSettlement.bind(settlementController)
  );

  /**
   * PATCH /api/admin/settlements/:id/release
   * 정산 보류 해제
   */
  app.patch(
    '/api/admin/settlements/:id/release',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.releaseSettlement.bind(settlementController)
  );

  /**
   * PATCH /api/admin/settlements/:id/cancel
   * 정산 취소
   */
  app.patch(
    '/api/admin/settlements/:id/cancel',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.cancelSettlement.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/:id/lock
   * 정산 잠금
   */
  app.post(
    '/api/admin/settlements/:id/lock',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.lockSettlement.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/:id/unlock
   * 정산 잠금 해제
   */
  app.post(
    '/api/admin/settlements/:id/unlock',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.unlockSettlement.bind(settlementController)
  );

  // ================================
  // Admin Endpoints - Generation (3)
  // ================================

  /**
   * POST /api/admin/settlements/generate
   * 정산 자동 생성
   */
  app.post(
    '/api/admin/settlements/generate',
    adminAuth,
    // requirePermission('settlements.create'),
    settlementController.generateSettlements.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/generate-monthly
   * 월별 정산 자동 생성
   */
  app.post(
    '/api/admin/settlements/generate-monthly',
    adminAuth,
    // requirePermission('settlements.create'),
    settlementController.generateMonthlySettlements.bind(settlementController)
  );

  /**
   * POST /api/admin/orders/:orderId/regenerate-settlement
   * 주문의 정산 재생성
   */
  app.post(
    '/api/admin/orders/:orderId/regenerate-settlement',
    adminAuth,
    // requirePermission('settlements.create'),
    settlementController.regenerateSettlement.bind(settlementController)
  );

  // ================================
  // Admin Endpoints - Batch Operations (2)
  // ================================

  /**
   * POST /api/admin/settlements/batch-confirm
   * 정산 일괄 확정
   */
  app.post(
    '/api/admin/settlements/batch-confirm',
    adminAuth,
    // requirePermission('settlements.confirm'),
    settlementController.batchConfirmSettlements.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/batch-pay
   * 정산 일괄 지급
   */
  app.post(
    '/api/admin/settlements/batch-pay',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.batchPaySettlements.bind(settlementController)
  );

  // ================================
  // Admin Endpoints - Deductions (5)
  // ================================

  /**
   * GET /api/admin/deductions
   * 공제 목록 조회
   */
  app.get(
    '/api/admin/deductions',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getDeductions.bind(settlementController)
  );

  /**
   * POST /api/admin/deductions
   * 공제 생성
   */
  app.post(
    '/api/admin/deductions',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.createDeduction.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/:id/deductions
   * 정산에 공제 추가
   */
  app.post(
    '/api/admin/settlements/:id/deductions',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.addDeductionToSettlement.bind(settlementController)
  );

  /**
   * PATCH /api/admin/deductions/:id/apply
   * 공제 적용
   */
  app.patch(
    '/api/admin/deductions/:id/apply',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.applyDeduction.bind(settlementController)
  );

  /**
   * PATCH /api/admin/deductions/:id/cancel
   * 공제 취소
   */
  app.patch(
    '/api/admin/deductions/:id/cancel',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.cancelDeduction.bind(settlementController)
  );

  // ================================
  // Admin Endpoints - Payouts (8)
  // ================================

  /**
   * GET /api/admin/payouts
   * 지급 내역 조회
   */
  app.get(
    '/api/admin/payouts',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getPayouts.bind(settlementController)
  );

  /**
   * POST /api/admin/payouts/request
   * 지급 요청
   */
  app.post(
    '/api/admin/payouts/request',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.requestPayout.bind(settlementController)
  );

  /**
   * POST /api/admin/payouts/:id/retry
   * 지급 재시도
   */
  app.post(
    '/api/admin/payouts/:id/retry',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.retryPayout.bind(settlementController)
  );

  /**
   * PATCH /api/admin/payouts/:id/sent
   * 지급 전송 완료
   */
  app.patch(
    '/api/admin/payouts/:id/sent',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.markPayoutSent.bind(settlementController)
  );

  /**
   * PATCH /api/admin/payouts/:id/succeeded
   * 지급 성공
   */
  app.patch(
    '/api/admin/payouts/:id/succeeded',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.markPayoutSucceeded.bind(settlementController)
  );

  /**
   * PATCH /api/admin/payouts/:id/failed
   * 지급 실패
   */
  app.patch(
    '/api/admin/payouts/:id/failed',
    adminAuth,
    // requirePermission('settlements.pay'),
    settlementController.markPayoutFailed.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/:id/payout-attempts
   * 정산의 지급 시도 내역
   */
  app.get(
    '/api/admin/settlements/:id/payout-attempts',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getPayoutAttempts.bind(settlementController)
  );

  /**
   * POST /api/admin/settlements/:id/retry-payout
   * 정산 지급 재시도
   */
  app.post(
    '/api/admin/settlements/:id/retry-payout',
    adminAuth,
    // requirePermission('settlements.edit'),
    settlementController.retrySettlementPayout.bind(settlementController)
  );

  // ================================
  // Admin Endpoints - Reports (10)
  // ================================

  /**
   * GET /api/admin/settlements/daily
   * 일별 정산 리포트
   */
  app.get(
    '/api/admin/settlements/daily',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getDailyReport.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/helper
   * 헬퍼별 정산 리포트
   */
  app.get(
    '/api/admin/settlements/helper',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getHelperReport.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/helper/:helperId/orders
   * 특정 헬퍼의 정산 주문 목록
   */
  app.get(
    '/api/admin/settlements/helper/:helperId/orders',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getHelperOrderSettlements.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/requester/:requesterId/orders
   * 특정 요청자의 정산 주문 목록
   */
  app.get(
    '/api/admin/settlements/requester/:requesterId/orders',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getRequesterOrderSettlements.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/requester
   * 요청자별 정산 리포트
   */
  app.get(
    '/api/admin/settlements/requester',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getRequesterReport.bind(settlementController)
  );

  /**
   * GET /api/admin/monthly-settlement-summary
   * 월별 정산 요약
   */
  app.get(
    '/api/admin/monthly-settlement-summary',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getMonthlyReport.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/:id/validation
   * 정산 검증
   */
  app.get(
    '/api/admin/settlements/:id/validation',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.validateSettlement.bind(settlementController)
  );

  /**
   * GET /api/admin/settlements/:id/audit-logs
   * 정산 Audit logs
   */
  app.get(
    '/api/admin/settlements/:id/audit-logs',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getAuditLogs.bind(settlementController)
  );

  /**
   * GET /api/admin/outstanding
   * 미지급 잔액 조회
   */
  app.get(
    '/api/admin/outstanding',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getOutstandingBalances.bind(settlementController)
  );

  /**
   * GET /api/admin/orders/:orderId/settlement-summary
   * 주문의 정산 요약 (관리자)
   */
  app.get(
    '/api/admin/orders/:orderId/settlement-summary',
    adminAuth,
    // requirePermission('settlements.view'),
    settlementController.getAdminOrderSettlementSummary.bind(settlementController)
  );

  // ================================
  // Additional endpoints to be implemented
  // ================================

  // These endpoints exist in routes.ts but need additional service methods:
  // - POST /api/admin/orders/:orderId/closing/approve
  // - POST /api/admin/orders/:orderId/settlement/execute
  // - POST /api/admin/helpers/:helperId/settlement-email
  // - POST /api/admin/settlements/batch-send-emails
  // - GET /api/admin/settlements/export
  // - POST /api/settlement-statements
  // - GET /api/settlement-statements
  // - GET /api/settlement-statements/:id
  // - POST /api/settlement-statements/:id/confirm
  // - GET /api/admin/settlement-statements
  // - POST /api/admin/settlements/:settlementId/create-tax-invoice
  // - POST /api/admin/outstanding/:orderId/remind
  // - POST /api/admin/orders/:orderId/reprice
  // - POST /api/admin/orders/:orderId/settle
  // - POST /api/admin/orders/:orderId/balance-invoice
  // - PATCH /api/admin/orders/:orderId/balance-invoice/paid
  // - POST /api/admin/incidents/:id/confirm-deduction
  // - PATCH /api/admin/settlements/by-order/:orderId/deduct

  console.log('✅ Settlement routes registered (51 endpoints)');
}
