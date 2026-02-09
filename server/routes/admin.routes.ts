/**
 * Admin Routes
 * All /api/admin/* endpoints
 */

import type { Express } from 'express';
import { adminController } from '../controllers/admin.controller';
import { adminAuth } from '../utils/auth-middleware';

export function registerAdminRoutes(app: Express) {
  console.log('🔧 Registering admin routes...');

  // ==================== Dashboard ====================

  /**
   * GET /api/admin/dashboard/overview
   * 통합 대시보드: 통계 + 업무 대기함 + 최근 오더
   */
  app.get(
    '/api/admin/dashboard/overview',
    adminAuth,
    adminController.getDashboardOverview.bind(adminController)
  );

  // ==================== Task Queue ====================

  /**
   * GET /api/admin/task-queue
   * 업무 대기함 목록 (필터링 옵션: taskType, minPriority, limit)
   */
  app.get(
    '/api/admin/task-queue',
    adminAuth,
    adminController.getTaskQueue.bind(adminController)
  );

  // ==================== Batch Operations ====================

  /**
   * POST /api/admin/batch/approve-orders
   * 오더 일괄 승인
   * Body: { orderIds: number[] }
   */
  app.post(
    '/api/admin/batch/approve-orders',
    adminAuth,
    adminController.batchApproveOrders.bind(adminController)
  );

  /**
   * POST /api/admin/batch/approve-settlements
   * 정산 일괄 승인
   * Body: { settlementIds: number[] }
   */
  app.post(
    '/api/admin/batch/approve-settlements',
    adminAuth,
    adminController.batchApproveSettlements.bind(adminController)
  );

  /**
   * POST /api/admin/batch/verify-helpers
   * 헬퍼 일괄 인증 승인
   * Body: { verificationIds: number[] }
   */
  app.post(
    '/api/admin/batch/verify-helpers',
    adminAuth,
    adminController.batchVerifyHelpers.bind(adminController)
  );

  // ==================== Statistics ====================

  /**
   * GET /api/admin/stats/settlements
   * 헬퍼별 정산 요약
   */
  app.get(
    '/api/admin/stats/settlements',
    adminAuth,
    adminController.getHelperSettlements.bind(adminController)
  );

  /**
   * GET /api/admin/stats/billing
   * 의뢰자별 과금 요약
   */
  app.get(
    '/api/admin/stats/billing',
    adminAuth,
    adminController.getRequesterBilling.bind(adminController)
  );

  // ==================== Integrated Order Detail ====================

  /**
   * GET /api/admin/orders/:id/integrated
   * 통합 오더 상세 정보 (모든 정보를 한 번에)
   */
  app.get(
    '/api/admin/orders/:id/integrated',
    adminAuth,
    adminController.getIntegratedOrderDetail.bind(adminController)
  );

  console.log('✅ Admin routes registered');
}
