/**
 * Helper Controller
 * 헬퍼 HTTP 요청/응답 처리
 */

import { Request, Response } from 'express';
import { helperService } from '../services/helper.service';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from '../utils/auth-middleware';

export class HelperController {
  // ================================
  // Profile Management
  // ================================

  /**
   * GET /api/helpers/profile
   * 헬퍼 프로필 조회
   */
  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const profile = await helperService.getHelperProfile(userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      logger.error('Failed to get helper profile', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile',
      });
    }
  }

  /**
   * PATCH /api/helpers/profile
   * 헬퍼 프로필 업데이트
   */
  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const updated = await helperService.updateHelperProfile(userId, data);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to update helper profile', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
      });
    }
  }

  // ================================
  // Credentials
  // ================================

  /**
   * GET /api/helpers/me/credential
   * 자격증명 조회
   */
  async getCredential(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const credential = await helperService.getCredential(userId);

      res.json({
        success: true,
        data: credential,
      });
    } catch (error) {
      logger.error('Failed to get credential', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get credential',
      });
    }
  }

  /**
   * POST /api/helpers/me/credential
   * 자격증명 생성
   */
  async createCredential(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const credential = await helperService.createCredential(userId, data);

      res.status(201).json({
        success: true,
        data: credential,
      });
    } catch (error) {
      logger.error('Failed to create credential', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create credential',
      });
    }
  }

  /**
   * PATCH /api/helpers/me/credential
   * 자격증명 업데이트
   */
  async updateCredential(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const updated = await helperService.updateCredential(userId, data);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to update credential', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update credential',
      });
    }
  }

  // ================================
  // License
  // ================================

  /**
   * GET /api/helpers/me/license
   * 면허 조회
   */
  async getLicense(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const license = await helperService.getLicense(userId);

      res.json({
        success: true,
        data: license,
      });
    } catch (error) {
      logger.error('Failed to get license', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get license',
      });
    }
  }

  /**
   * POST /api/helpers/me/license
   * 면허 생성
   */
  async createLicense(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const license = await helperService.createLicense(userId, data);

      res.status(201).json({
        success: true,
        data: license,
      });
    } catch (error) {
      logger.error('Failed to create license', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create license',
      });
    }
  }

  // ================================
  // Vehicle
  // ================================

  /**
   * GET /api/helpers/me/vehicle
   * 차량 조회
   */
  async getVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const vehicle = await helperService.getVehicle(userId);

      res.json({
        success: true,
        data: vehicle,
      });
    } catch (error) {
      logger.error('Failed to get vehicle', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get vehicle',
      });
    }
  }

  /**
   * POST /api/helpers/me/vehicle
   * 차량 생성
   */
  async createVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const vehicle = await helperService.createVehicle(userId, data);

      res.status(201).json({
        success: true,
        data: vehicle,
      });
    } catch (error) {
      logger.error('Failed to create vehicle', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create vehicle',
      });
    }
  }

  // ================================
  // Business
  // ================================

  /**
   * GET /api/helpers/me/business
   * 사업자 정보 조회
   */
  async getBusiness(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const business = await helperService.getBusiness(userId);

      res.json({
        success: true,
        data: business,
      });
    } catch (error) {
      logger.error('Failed to get business', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get business',
      });
    }
  }

  /**
   * POST /api/helpers/me/business
   * 사업자 정보 생성
   */
  async createBusiness(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const business = await helperService.createBusiness(userId, data);

      res.status(201).json({
        success: true,
        data: business,
      });
    } catch (error) {
      logger.error('Failed to create business', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create business',
      });
    }
  }

  // ================================
  // Bank Account
  // ================================

  /**
   * GET /api/helpers/me/bank-account
   * 계좌 정보 조회
   */
  async getBankAccount(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const account = await helperService.getBankAccount(userId);

      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      logger.error('Failed to get bank account', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get bank account',
      });
    }
  }

  /**
   * POST /api/helpers/me/bank-account
   * 계좌 정보 생성
   */
  async createBankAccount(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const account = await helperService.createBankAccount(userId, data);

      res.status(201).json({
        success: true,
        data: account,
      });
    } catch (error) {
      logger.error('Failed to create bank account', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create bank account',
      });
    }
  }

  // ================================
  // Onboarding
  // ================================

  /**
   * GET /api/helpers/onboarding-status
   * 온보딩 상태 조회
   */
  async getOnboardingStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const status = await helperService.getOnboardingStatus(userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get onboarding status', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get onboarding status',
      });
    }
  }

  /**
   * POST /api/helpers/onboarding/submit
   * 온보딩 제출
   */
  async submitOnboarding(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const submission = await helperService.submitOnboarding(userId);

      res.json({
        success: true,
        data: submission,
      });
    } catch (error) {
      logger.error('Failed to submit onboarding', error as Error);
      res.status(400).json({
        success: false,
        error: (error as Error).message || 'Failed to submit onboarding',
      });
    }
  }

  // ================================
  // Service Areas
  // ================================

  /**
   * GET /api/helper/service-areas
   * 서비스 지역 조회
   */
  async getServiceAreas(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const areas = await helperService.getServiceAreas(userId);

      res.json({
        success: true,
        data: areas,
      });
    } catch (error) {
      logger.error('Failed to get service areas', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get service areas',
      });
    }
  }

  /**
   * POST /api/helper/service-areas
   * 서비스 지역 추가
   */
  async createServiceArea(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const area = await helperService.createServiceArea(userId, data);

      res.status(201).json({
        success: true,
        data: area,
      });
    } catch (error) {
      logger.error('Failed to create service area', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create service area',
      });
    }
  }

  // ================================
  // Disputes
  // ================================

  /**
   * GET /api/helper/disputes
   * 분쟁 목록 조회
   */
  async getDisputes(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const disputes = await helperService.getDisputes(userId);

      res.json({
        success: true,
        data: disputes,
      });
    } catch (error) {
      logger.error('Failed to get disputes', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get disputes',
      });
    }
  }

  /**
   * GET /api/helper/disputes/:id
   * 분쟁 상세 조회
   */
  async getDisputeById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const dispute = await helperService.getDisputeById(id);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          error: 'Dispute not found',
        });
      }

      // Verify ownership
      if (dispute.helperId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized',
        });
      }

      res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      logger.error('Failed to get dispute', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dispute',
      });
    }
  }

  /**
   * POST /api/helper/disputes
   * 분쟁 생성
   */
  async createDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const dispute = await helperService.createDispute(userId, data);

      res.status(201).json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      logger.error('Failed to create dispute', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dispute',
      });
    }
  }

  // ================================
  // Incidents
  // ================================

  /**
   * GET /api/helper/incidents
   * 사고 목록 조회
   */
  async getIncidents(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const incidents = await helperService.getIncidents(userId);

      res.json({
        success: true,
        data: incidents,
      });
    } catch (error) {
      logger.error('Failed to get incidents', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get incidents',
      });
    }
  }

  /**
   * GET /api/helper/incidents/:id
   * 사고 상세 조회
   */
  async getIncidentById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const incident = await helperService.getIncidentById(id);

      if (!incident) {
        return res.status(404).json({
          success: false,
          error: 'Incident not found',
        });
      }

      // Verify ownership
      if (incident.helperId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized',
        });
      }

      res.json({
        success: true,
        data: incident,
      });
    } catch (error) {
      logger.error('Failed to get incident', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get incident',
      });
    }
  }

  /**
   * POST /api/helper/incidents/:id/action
   * 사고 조치
   */
  async handleIncidentAction(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const incidentId = parseInt(req.params.id);
      const { action, notes, evidenceUrls } = req.body;

      const updated = await helperService.handleIncidentAction(userId, {
        incidentId,
        action,
        notes,
        evidenceUrls,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to handle incident action', error as Error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to handle incident action',
      });
    }
  }

  // ================================
  // Terms Agreement
  // ================================

  /**
   * GET /api/helper/terms-agreement
   * 약관 동의 조회
   */
  async getTermsAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const agreement = await helperService.getTermsAgreement(userId);

      res.json({
        success: true,
        data: agreement,
      });
    } catch (error) {
      logger.error('Failed to get terms agreement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get terms agreement',
      });
    }
  }

  /**
   * POST /api/helper/terms-agreement
   * 약관 동의
   */
  async createTermsAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const agreement = await helperService.createTermsAgreement(userId, data);

      res.status(201).json({
        success: true,
        data: agreement,
      });
    } catch (error) {
      logger.error('Failed to create terms agreement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create terms agreement',
      });
    }
  }

  // ================================
  // Reviews
  // ================================

  /**
   * GET /api/helper/completed-orders-for-review
   * 완료된 주문 목록 (리뷰용)
   */
  async getCompletedOrdersForReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;

      const orders = await helperService.getCompletedOrdersForReview(userId);

      res.json({
        success: true,
        data: orders,
      });
    } catch (error) {
      logger.error('Failed to get completed orders for review', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get completed orders',
      });
    }
  }

  /**
   * POST /api/helper/reviews
   * 리뷰 생성
   */
  async createReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const review = await helperService.createReview(userId, data);

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      logger.error('Failed to create review', error as Error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to create review',
      });
    }
  }

  // ================================
  // Work History
  // ================================

  /**
   * GET /api/helper/work-detail
   * 작업 세부사항 조회
   */
  async getWorkDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const { date } = req.query;

      const workDate = date ? new Date(date as string) : new Date();

      const detail = await helperService.getWorkDetail(userId, workDate);

      res.json({
        success: true,
        data: detail,
      });
    } catch (error) {
      logger.error('Failed to get work detail', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get work detail',
      });
    }
  }

  /**
   * GET /api/helper/work-history
   * 작업 이력 조회
   */
  async getWorkHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const history = await helperService.getWorkHistory(userId, start, end);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Failed to get work history', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get work history',
      });
    }
  }

  // ================================
  // Admin Endpoints
  // ================================

  /**
   * GET /api/admin/helpers
   * 헬퍼 목록 조회 (관리자)
   */
  async getHelpers(req: Request, res: Response) {
    try {
      const filters = req.query;

      const helpers = await helperService.getHelpers(filters);

      res.json({
        success: true,
        data: helpers,
      });
    } catch (error) {
      logger.error('Failed to get helpers', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get helpers',
      });
    }
  }

  /**
   * GET /api/admin/helpers/:helperId/detail
   * 헬퍼 상세 조회 (관리자)
   */
  async getHelperDetail(req: Request, res: Response) {
    try {
      const helperId = req.params.helperId;

      const detail = await helperService.getHelperDetail(helperId);

      if (!detail) {
        return res.status(404).json({
          success: false,
          error: 'Helper not found',
        });
      }

      res.json({
        success: true,
        data: detail,
      });
    } catch (error) {
      logger.error('Failed to get helper detail', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get helper detail',
      });
    }
  }

  /**
   * POST /api/admin/helpers/:helperId/verify
   * 헬퍼 검증
   */
  async verifyHelper(req: AuthenticatedRequest, res: Response) {
    try {
      const helperId = req.params.helperId;
      const verifiedBy = req.user.id;
      const { notes } = req.body;

      await helperService.verifyHelper({
        userId: helperId,
        verifiedBy,
        notes,
      });

      res.json({
        success: true,
        message: 'Helper verified successfully',
      });
    } catch (error) {
      logger.error('Failed to verify helper', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify helper',
      });
    }
  }

  /**
   * POST /api/admin/helpers/:helperId/unverify
   * 헬퍼 검증 취소
   */
  async unverifyHelper(req: AuthenticatedRequest, res: Response) {
    try {
      const helperId = req.params.helperId;
      const unverifiedBy = req.user.id;

      await helperService.unverifyHelper(helperId, unverifiedBy);

      res.json({
        success: true,
        message: 'Helper unverified successfully',
      });
    } catch (error) {
      logger.error('Failed to unverify helper', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to unverify helper',
      });
    }
  }

  /**
   * POST /api/admin/helpers/:helperId/approve
   * 헬퍼 승인
   */
  async approveHelper(req: AuthenticatedRequest, res: Response) {
    try {
      const helperId = req.params.helperId;
      const approvedBy = req.user.id;

      await helperService.verifyHelper({
        userId: helperId,
        verifiedBy: approvedBy,
      });

      res.json({
        success: true,
        message: 'Helper approved successfully',
      });
    } catch (error) {
      logger.error('Failed to approve helper', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve helper',
      });
    }
  }

  /**
   * POST /api/admin/helpers/:helperId/reject
   * 헬퍼 거부
   */
  async rejectHelper(req: AuthenticatedRequest, res: Response) {
    try {
      const helperId = req.params.helperId;
      const rejectedBy = req.user.id;
      const { reason } = req.body;

      await helperService.rejectHelper({
        userId: helperId,
        rejectedBy,
        reason,
      });

      res.json({
        success: true,
        message: 'Helper rejected',
      });
    } catch (error) {
      logger.error('Failed to reject helper', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject helper',
      });
    }
  }

  /**
   * GET /api/admin/helpers/pending
   * 대기 중인 헬퍼 목록
   */
  async getPendingHelpers(req: Request, res: Response) {
    try {
      const helpers = await helperService.getHelpers({
        isVerified: false,
        status: 'in_review',
      });

      res.json({
        success: true,
        data: helpers,
      });
    } catch (error) {
      logger.error('Failed to get pending helpers', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pending helpers',
      });
    }
  }

  /**
   * GET /api/admin/helpers/:helperId/commission-rate
   * 헬퍼 수수료율 조회
   */
  async getCommissionRate(req: Request, res: Response) {
    try {
      const helperId = req.params.helperId;

      const override = await helperService.getCommissionOverride(helperId);

      res.json({
        success: true,
        data: {
          helperId,
          commissionRate: override?.commissionRate || 10, // Default 10%
          hasOverride: !!override,
          override,
        },
      });
    } catch (error) {
      logger.error('Failed to get commission rate', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get commission rate',
      });
    }
  }

  /**
   * POST /api/admin/helper-commission-overrides
   * 수수료 오버라이드 생성
   */
  async createCommissionOverride(req: AuthenticatedRequest, res: Response) {
    try {
      const data = req.body;
      const createdBy = req.user.id;

      const override = await helperService.createCommissionOverride(data, createdBy);

      res.status(201).json({
        success: true,
        data: override,
      });
    } catch (error) {
      logger.error('Failed to create commission override', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create commission override',
      });
    }
  }
}

export const helperController = new HelperController();
