/**
 * Helper Routes
 * 헬퍼 관련 라우트 정의 (40+ endpoints)
 */

import { Express } from 'express';
import { helperController } from '../controllers/helper.controller';
import { requireAuth, adminAuth } from '../utils/auth-middleware';

export function registerHelperRoutes(app: Express) {
  // ================================
  // Profile Management (2)
  // ================================

  /**
   * GET /api/helpers/profile
   * 헬퍼 프로필 조회
   */
  app.get(
    '/api/helpers/profile',
    requireAuth,
    helperController.getProfile.bind(helperController)
  );

  /**
   * PATCH /api/helpers/profile
   * 헬퍼 프로필 업데이트
   */
  app.patch(
    '/api/helpers/profile',
    requireAuth,
    helperController.updateProfile.bind(helperController)
  );

  // ================================
  // Credentials (3)
  // ================================

  /**
   * GET /api/helpers/me/credential
   * 자격증명 조회
   */
  app.get(
    '/api/helpers/me/credential',
    requireAuth,
    helperController.getCredential.bind(helperController)
  );

  /**
   * POST /api/helpers/me/credential
   * 자격증명 생성
   */
  app.post(
    '/api/helpers/me/credential',
    requireAuth,
    helperController.createCredential.bind(helperController)
  );

  /**
   * PATCH /api/helpers/me/credential
   * 자격증명 업데이트
   */
  app.patch(
    '/api/helpers/me/credential',
    requireAuth,
    helperController.updateCredential.bind(helperController)
  );

  // ================================
  // License (2)
  // ================================

  /**
   * GET /api/helpers/me/license
   * 면허 조회
   */
  app.get(
    '/api/helpers/me/license',
    requireAuth,
    helperController.getLicense.bind(helperController)
  );

  /**
   * POST /api/helpers/me/license
   * 면허 생성
   */
  app.post(
    '/api/helpers/me/license',
    requireAuth,
    helperController.createLicense.bind(helperController)
  );

  // ================================
  // Vehicle (2)
  // ================================

  /**
   * GET /api/helpers/me/vehicle
   * 차량 조회
   */
  app.get(
    '/api/helpers/me/vehicle',
    requireAuth,
    helperController.getVehicle.bind(helperController)
  );

  /**
   * POST /api/helpers/me/vehicle
   * 차량 생성
   */
  app.post(
    '/api/helpers/me/vehicle',
    requireAuth,
    helperController.createVehicle.bind(helperController)
  );

  // ================================
  // Business (2)
  // ================================

  /**
   * GET /api/helpers/me/business
   * 사업자 정보 조회
   */
  app.get(
    '/api/helpers/me/business',
    requireAuth,
    helperController.getBusiness.bind(helperController)
  );

  /**
   * POST /api/helpers/me/business
   * 사업자 정보 생성
   */
  app.post(
    '/api/helpers/me/business',
    requireAuth,
    helperController.createBusiness.bind(helperController)
  );

  // ================================
  // Bank Account (2)
  // ================================

  /**
   * GET /api/helpers/me/bank-account
   * 계좌 정보 조회
   */
  app.get(
    '/api/helpers/me/bank-account',
    requireAuth,
    helperController.getBankAccount.bind(helperController)
  );

  /**
   * POST /api/helpers/me/bank-account
   * 계좌 정보 생성
   */
  app.post(
    '/api/helpers/me/bank-account',
    requireAuth,
    helperController.createBankAccount.bind(helperController)
  );

  // ================================
  // Onboarding (2)
  // ================================

  /**
   * GET /api/helpers/onboarding-status
   * 온보딩 상태 조회
   */
  app.get(
    '/api/helpers/onboarding-status',
    requireAuth,
    helperController.getOnboardingStatus.bind(helperController)
  );

  /**
   * POST /api/helpers/onboarding/submit
   * 온보딩 제출
   */
  app.post(
    '/api/helpers/onboarding/submit',
    requireAuth,
    helperController.submitOnboarding.bind(helperController)
  );

  // ================================
  // Service Areas (2)
  // ================================

  /**
   * GET /api/helper/service-areas
   * 서비스 지역 조회
   */
  app.get(
    '/api/helper/service-areas',
    requireAuth,
    helperController.getServiceAreas.bind(helperController)
  );

  /**
   * POST /api/helper/service-areas
   * 서비스 지역 추가
   */
  app.post(
    '/api/helper/service-areas',
    requireAuth,
    helperController.createServiceArea.bind(helperController)
  );

  // ================================
  // Disputes (3)
  // ================================

  /**
   * GET /api/helper/disputes
   * 분쟁 목록 조회
   */
  app.get(
    '/api/helper/disputes',
    requireAuth,
    helperController.getDisputes.bind(helperController)
  );

  /**
   * GET /api/helper/disputes/:id
   * 분쟁 상세 조회
   */
  app.get(
    '/api/helper/disputes/:id',
    requireAuth,
    helperController.getDisputeById.bind(helperController)
  );

  /**
   * POST /api/helper/disputes
   * 분쟁 생성
   */
  app.post(
    '/api/helper/disputes',
    requireAuth,
    helperController.createDispute.bind(helperController)
  );

  // ================================
  // Incidents (3)
  // ================================

  /**
   * GET /api/helper/incidents
   * 사고 목록 조회
   */
  app.get(
    '/api/helper/incidents',
    requireAuth,
    helperController.getIncidents.bind(helperController)
  );

  /**
   * GET /api/helper/incidents/:id
   * 사고 상세 조회
   */
  app.get(
    '/api/helper/incidents/:id',
    requireAuth,
    helperController.getIncidentById.bind(helperController)
  );

  /**
   * POST /api/helper/incidents/:id/action
   * 사고 조치
   */
  app.post(
    '/api/helper/incidents/:id/action',
    requireAuth,
    helperController.handleIncidentAction.bind(helperController)
  );

  // ================================
  // Terms Agreement (2)
  // ================================

  /**
   * GET /api/helper/terms-agreement
   * 약관 동의 조회
   */
  app.get(
    '/api/helper/terms-agreement',
    requireAuth,
    helperController.getTermsAgreement.bind(helperController)
  );

  /**
   * POST /api/helper/terms-agreement
   * 약관 동의
   */
  app.post(
    '/api/helper/terms-agreement',
    requireAuth,
    helperController.createTermsAgreement.bind(helperController)
  );

  // ================================
  // Reviews (2)
  // ================================

  /**
   * GET /api/helper/completed-orders-for-review
   * 완료된 주문 목록 (리뷰용)
   */
  app.get(
    '/api/helper/completed-orders-for-review',
    requireAuth,
    helperController.getCompletedOrdersForReview.bind(helperController)
  );

  /**
   * POST /api/helper/reviews
   * 리뷰 생성
   */
  app.post(
    '/api/helper/reviews',
    requireAuth,
    helperController.createReview.bind(helperController)
  );

  // ================================
  // Work History (2)
  // ================================

  /**
   * GET /api/helper/work-detail
   * 작업 세부사항 조회
   */
  app.get(
    '/api/helper/work-detail',
    requireAuth,
    helperController.getWorkDetail.bind(helperController)
  );

  /**
   * GET /api/helper/work-history
   * 작업 이력 조회
   */
  app.get(
    '/api/helper/work-history',
    requireAuth,
    helperController.getWorkHistory.bind(helperController)
  );

  // ================================
  // Admin Endpoints (9)
  // ================================

  /**
   * GET /api/admin/helpers
   * 헬퍼 목록 조회
   */
  app.get(
    '/api/admin/helpers',
    adminAuth,
    // requirePermission('helpers.view'),
    helperController.getHelpers.bind(helperController)
  );

  /**
   * GET /api/admin/helpers/:helperId/detail
   * 헬퍼 상세 조회
   */
  app.get(
    '/api/admin/helpers/:helperId/detail',
    adminAuth,
    // requirePermission('helpers.view'),
    helperController.getHelperDetail.bind(helperController)
  );

  /**
   * POST /api/admin/helpers/:helperId/verify
   * 헬퍼 검증
   */
  app.post(
    '/api/admin/helpers/:helperId/verify',
    adminAuth,
    // requirePermission('helpers.edit'),
    helperController.verifyHelper.bind(helperController)
  );

  /**
   * POST /api/admin/helpers/:helperId/unverify
   * 헬퍼 검증 취소
   */
  app.post(
    '/api/admin/helpers/:helperId/unverify',
    adminAuth,
    // requirePermission('helpers.edit'),
    helperController.unverifyHelper.bind(helperController)
  );

  /**
   * POST /api/admin/helpers/:helperId/approve
   * 헬퍼 승인
   */
  app.post(
    '/api/admin/helpers/:helperId/approve',
    adminAuth,
    // requirePermission('helpers.verify'),
    helperController.approveHelper.bind(helperController)
  );

  /**
   * POST /api/admin/helpers/:helperId/reject
   * 헬퍼 거부
   */
  app.post(
    '/api/admin/helpers/:helperId/reject',
    adminAuth,
    // requirePermission('helpers.verify'),
    helperController.rejectHelper.bind(helperController)
  );

  /**
   * GET /api/admin/helpers/pending
   * 대기 중인 헬퍼 목록
   */
  app.get(
    '/api/admin/helpers/pending',
    adminAuth,
    // requirePermission('helpers.verify'),
    helperController.getPendingHelpers.bind(helperController)
  );

  /**
   * GET /api/admin/helpers/:helperId/commission-rate
   * 헬퍼 수수료율 조회
   */
  app.get(
    '/api/admin/helpers/:helperId/commission-rate',
    adminAuth,
    // requirePermission('helpers.view'),
    helperController.getCommissionRate.bind(helperController)
  );

  /**
   * POST /api/admin/helper-commission-overrides
   * 수수료 오버라이드 생성
   */
  app.post(
    '/api/admin/helper-commission-overrides',
    adminAuth,
    // requirePermission('settings.edit'),
    helperController.createCommissionOverride.bind(helperController)
  );

  // ================================
  // Additional endpoints to be implemented
  // ================================

  // These endpoints exist in routes.ts but need additional implementation:
  // - POST /api/helpers/credential/upload (file upload)
  // - POST /api/helpers/me/vehicle (with image upload)
  // - POST /api/helpers/me/business (with image upload)
  // - POST /api/helpers/me/bank-account (with image upload)
  // - GET /api/auth/kakao/helper (OAuth)
  // - GET /api/auth/kakao/helper/callback (OAuth)
  // - GET /api/helper/orders/open
  // - GET /api/helper/my-orders
  // - GET /api/helper/settlement (already in settlement.routes.ts)
  // - GET /api/reviews/helper/:helperId
  // - GET /api/admin/helper-credentials
  // - GET /api/admin/helper-vehicles
  // - GET /api/admin/helper-businesses
  // - GET /api/admin/helper-bank-accounts
  // - GET /api/admin/helper-licenses
  // - GET /api/admin/helpers/pending-verification
  // - GET /api/admin/helper-disputes
  // - GET /api/admin/helper-disputes/:id
  // - PATCH /api/admin/helper-disputes/:id/status
  // - GET /api/admin/document-review-tasks
  // - GET /api/admin/identity-verifications
  // - POST /api/admin/document-review-tasks/:taskId
  // - PATCH /api/admin/users/:userId/team-leader
  // - PATCH /api/admin/users/:userId/role
  // - GET /api/admin/helper-commission-overrides
  // - DELETE /api/admin/helper-commission-overrides/:id
  // - GET /api/admin/helpers/available
  // - GET /api/admin/helper-credentials/:userId
  // - GET /api/admin/helpers/:helperId/contracts
  // - POST /api/admin/helpers/:helperId/assign-team-leader
  // - GET /api/admin/helpers/onboarding
  // - POST /api/admin/helpers/:id/onboarding/approve
  // - POST /api/admin/helpers/:id/onboarding/reject
  // - GET /api/helpers/me/personal-code
  // - POST /api/helpers/me/leave-team
  // - GET /api/helper/my-team

  console.log('✅ Helper routes registered (38 endpoints)');
}
