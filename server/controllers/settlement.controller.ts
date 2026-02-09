/**
 * Settlement Controller
 * 정산 HTTP 요청/응답 처리
 */

import { Request, Response } from 'express';
import { settlementService } from '../services/settlement.service';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from '../utils/auth-middleware';

export class SettlementController {
  // ================================
  // Public/Helper Endpoints
  // ================================

  /**
   * GET /api/orders/:orderId/settlement-summary
   * 주문의 정산 요약 조회
   */
  async getOrderSettlementSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);

      const summary = await settlementService.calculateSettlementSummary(orderId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get settlement summary', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get settlement summary',
      });
    }
  }

  /**
   * GET /api/helper/settlement
   * 헬퍼의 정산 내역 조회
   */
  async getHelperSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const helperId = req.user.id;

      const settlements = await settlementService.getHelperSettlements(helperId);

      res.json({
        success: true,
        data: settlements,
      });
    } catch (error) {
      logger.error('Failed to get helper settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get helper settlements',
      });
    }
  }

  /**
   * GET /api/helpers/me/settlements
   * 내 정산 목록 조회 (헬퍼)
   */
  async getMySettlements(req: AuthenticatedRequest, res: Response) {
    try {
      const helperId = req.user.id;

      const settlements = await settlementService.getHelperSettlements(helperId);

      res.json({
        success: true,
        data: settlements,
      });
    } catch (error) {
      logger.error('Failed to get my settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get my settlements',
      });
    }
  }

  /**
   * PATCH /api/helpers/settlements/:id/confirm
   * 정산 확인 (헬퍼)
   */
  async helperConfirmSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const helperId = req.user.id;

      // Verify settlement belongs to this helper
      const settlement = await settlementService.getSettlementById(id);
      if (!settlement) {
        return res.status(404).json({
          success: false,
          error: 'Settlement not found',
        });
      }

      if (settlement.helperId !== helperId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized',
        });
      }

      const confirmed = await settlementService.confirmSettlement(id, helperId);

      res.json({
        success: true,
        data: confirmed,
      });
    } catch (error) {
      logger.error('Failed to confirm settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm settlement',
      });
    }
  }

  // ================================
  // Admin Endpoints - CRUD
  // ================================

  /**
   * GET /api/admin/settlements
   * 정산 목록 조회 (관리자)
   */
  async getSettlements(req: Request, res: Response) {
    try {
      const { helperId, requesterId, status, startDate, endDate } = req.query;

      const filters: any = {};
      if (helperId) filters.helperId = helperId as string;
      if (requesterId) filters.requesterId = requesterId as string;
      if (status) filters.status = status as any;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const settlements = await settlementService.getSettlements(filters);

      res.json({
        success: true,
        data: settlements,
      });
    } catch (error) {
      logger.error('Failed to get settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get settlements',
      });
    }
  }

  /**
   * GET /api/admin/settlements/:id
   * 정산 상세 조회
   */
  async getSettlementById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const settlement = await settlementService.getSettlementById(id);

      if (!settlement) {
        return res.status(404).json({
          success: false,
          error: 'Settlement not found',
        });
      }

      res.json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      logger.error('Failed to get settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get settlement',
      });
    }
  }

  /**
   * POST /api/admin/settlements
   * 정산 생성
   */
  async createSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const data = req.body;
      const createdBy = req.user.id;

      const settlement = await settlementService.createSettlement(data, createdBy);

      res.status(201).json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      logger.error('Failed to create settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create settlement',
      });
    }
  }

  /**
   * PATCH /api/admin/settlements/:id/amount
   * 정산 금액 수정
   */
  async updateSettlementAmount(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { amount, deductions } = req.body;
      const updatedBy = req.user.id;

      const updated = await settlementService.updateSettlement(
        id,
        { amount, deductions },
        updatedBy
      );

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to update settlement amount', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update settlement amount',
      });
    }
  }

  /**
   * PATCH /api/admin/settlements/:id/counts
   * 정산 수량 수정
   */
  async updateSettlementCounts(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedBy = req.user.id;

      const updated = await settlementService.updateSettlement(id, updates, updatedBy);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to update settlement counts', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update settlement counts',
      });
    }
  }

  // ================================
  // Admin Endpoints - Status Changes
  // ================================

  /**
   * POST /api/admin/settlements/:id/mark-ready
   * 정산을 'ready' 상태로 변경
   */
  async markSettlementReady(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const updatedBy = req.user.id;

      const updated = await settlementService.markSettlementReady(id, updatedBy);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to mark settlement ready', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark settlement ready',
      });
    }
  }

  /**
   * POST /api/admin/settlements/:id/confirm
   * PATCH /api/admin/settlements/:id/confirm
   * 정산 확정
   */
  async confirmSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const confirmedBy = req.user.id;

      const confirmed = await settlementService.confirmSettlement(id, confirmedBy);

      res.json({
        success: true,
        data: confirmed,
      });
    } catch (error) {
      logger.error('Failed to confirm settlement', error as Error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to confirm settlement',
      });
    }
  }

  /**
   * PATCH /api/admin/settlements/:id/pay
   * 정산 지급 완료
   */
  async paySettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const paidBy = req.user.id;

      const paid = await settlementService.markSettlementPaid(id, paidBy);

      res.json({
        success: true,
        data: paid,
      });
    } catch (error) {
      logger.error('Failed to pay settlement', error as Error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to pay settlement',
      });
    }
  }

  /**
   * POST /api/admin/settlements/:id/mark-paid
   * 정산 지급 완료 표시
   */
  async markSettlementPaid(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const paidBy = req.user.id;

      const paid = await settlementService.markSettlementPaid(id, paidBy);

      res.json({
        success: true,
        data: paid,
      });
    } catch (error) {
      logger.error('Failed to mark settlement as paid', error as Error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to mark settlement as paid',
      });
    }
  }

  /**
   * PATCH /api/admin/settlements/:id/hold
   * 정산 보류
   */
  async holdSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const heldBy = req.user.id;

      const held = await settlementService.holdSettlement(id, reason, heldBy);

      res.json({
        success: true,
        data: held,
      });
    } catch (error) {
      logger.error('Failed to hold settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to hold settlement',
      });
    }
  }

  /**
   * PATCH /api/admin/settlements/:id/release
   * 정산 보류 해제
   */
  async releaseSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const releasedBy = req.user.id;

      const released = await settlementService.releaseSettlement(id, releasedBy);

      res.json({
        success: true,
        data: released,
      });
    } catch (error) {
      logger.error('Failed to release settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to release settlement',
      });
    }
  }

  /**
   * PATCH /api/admin/settlements/:id/cancel
   * 정산 취소
   */
  async cancelSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const cancelledBy = req.user.id;

      const cancelled = await settlementService.cancelSettlement(id, reason, cancelledBy);

      res.json({
        success: true,
        data: cancelled,
      });
    } catch (error) {
      logger.error('Failed to cancel settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel settlement',
      });
    }
  }

  /**
   * POST /api/admin/settlements/:id/lock
   * 정산 잠금
   */
  async lockSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const lockedBy = req.user.id;

      const locked = await settlementService.lockSettlement(id, lockedBy);

      res.json({
        success: true,
        data: locked,
      });
    } catch (error) {
      logger.error('Failed to lock settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to lock settlement',
      });
    }
  }

  /**
   * POST /api/admin/settlements/:id/unlock
   * 정산 잠금 해제
   */
  async unlockSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const unlockedBy = req.user.id;

      const unlocked = await settlementService.unlockSettlement(id, unlockedBy);

      res.json({
        success: true,
        data: unlocked,
      });
    } catch (error) {
      logger.error('Failed to unlock settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to unlock settlement',
      });
    }
  }

  // ================================
  // Admin Endpoints - Generation
  // ================================

  /**
   * POST /api/admin/settlements/generate
   * 정산 자동 생성
   */
  async generateSettlements(req: AuthenticatedRequest, res: Response) {
    try {
      const { orderIds } = req.body;
      const createdBy = req.user.id;

      const generated = [];

      for (const orderId of orderIds) {
        try {
          const settlement = await settlementService.generateSettlementForOrder(orderId, createdBy);
          generated.push(settlement);
        } catch (error) {
          logger.error('Failed to generate settlement for order', error as Error, { orderId });
        }
      }

      res.json({
        success: true,
        data: generated,
        count: generated.length,
      });
    } catch (error) {
      logger.error('Failed to generate settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate settlements',
      });
    }
  }

  /**
   * POST /api/admin/settlements/generate-monthly
   * 월별 정산 자동 생성
   */
  async generateMonthlySettlements(req: AuthenticatedRequest, res: Response) {
    try {
      const { year, month } = req.body;
      const createdBy = req.user.id;

      const generated = await settlementService.generateMonthlySettlements(year, month, createdBy);

      res.json({
        success: true,
        data: generated,
        count: generated.length,
      });
    } catch (error) {
      logger.error('Failed to generate monthly settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate monthly settlements',
      });
    }
  }

  /**
   * POST /api/admin/orders/:orderId/regenerate-settlement
   * 주문의 정산 재생성
   */
  async regenerateSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);
      const createdBy = req.user.id;

      const settlement = await settlementService.generateSettlementForOrder(orderId, createdBy);

      res.json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      logger.error('Failed to regenerate settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to regenerate settlement',
      });
    }
  }

  // ================================
  // Admin Endpoints - Batch Operations
  // ================================

  /**
   * POST /api/admin/settlements/batch-confirm
   * 정산 일괄 확정
   */
  async batchConfirmSettlements(req: AuthenticatedRequest, res: Response) {
    try {
      const { settlementIds } = req.body;
      const confirmedBy = req.user.id;

      const confirmed = await settlementService.batchConfirmSettlements(
        { settlementIds, action: 'confirm' },
        confirmedBy
      );

      res.json({
        success: true,
        data: confirmed,
        count: confirmed.length,
      });
    } catch (error) {
      logger.error('Failed to batch confirm settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch confirm settlements',
      });
    }
  }

  /**
   * POST /api/admin/settlements/batch-pay
   * 정산 일괄 지급
   */
  async batchPaySettlements(req: AuthenticatedRequest, res: Response) {
    try {
      const { settlementIds } = req.body;
      const paidBy = req.user.id;

      const paid = await settlementService.batchPaySettlements(
        { settlementIds, action: 'pay' },
        paidBy
      );

      res.json({
        success: true,
        data: paid,
        count: paid.length,
      });
    } catch (error) {
      logger.error('Failed to batch pay settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch pay settlements',
      });
    }
  }

  // ================================
  // Admin Endpoints - Deductions
  // ================================

  /**
   * GET /api/admin/deductions
   * 공제 목록 조회
   */
  async getDeductions(req: Request, res: Response) {
    try {
      const { helperId, settlementId, status } = req.query;

      const filters: any = {};
      if (helperId) filters.helperId = helperId as string;
      if (settlementId) filters.settlementId = parseInt(settlementId as string);
      if (status) filters.status = status as any;

      const deductions = await settlementService.getDeductions(filters);

      res.json({
        success: true,
        data: deductions,
      });
    } catch (error) {
      logger.error('Failed to get deductions', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get deductions',
      });
    }
  }

  /**
   * POST /api/admin/deductions
   * 공제 생성
   */
  async createDeduction(req: AuthenticatedRequest, res: Response) {
    try {
      const data = req.body;
      const createdBy = req.user.id;

      const deduction = await settlementService.createDeduction(data, createdBy);

      res.status(201).json({
        success: true,
        data: deduction,
      });
    } catch (error) {
      logger.error('Failed to create deduction', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create deduction',
      });
    }
  }

  /**
   * POST /api/admin/settlements/:id/deductions
   * 정산에 공제 추가
   */
  async addDeductionToSettlement(req: AuthenticatedRequest, res: Response) {
    try {
      const settlementId = parseInt(req.params.id);
      const data = { ...req.body, settlementId };
      const createdBy = req.user.id;

      const deduction = await settlementService.createDeduction(data, createdBy);

      res.status(201).json({
        success: true,
        data: deduction,
      });
    } catch (error) {
      logger.error('Failed to add deduction to settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to add deduction to settlement',
      });
    }
  }

  /**
   * PATCH /api/admin/deductions/:id/apply
   * 공제 적용
   */
  async applyDeduction(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const appliedBy = req.user.id;

      const applied = await settlementService.applyDeduction(id, appliedBy);

      res.json({
        success: true,
        data: applied,
      });
    } catch (error) {
      logger.error('Failed to apply deduction', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply deduction',
      });
    }
  }

  /**
   * PATCH /api/admin/deductions/:id/cancel
   * 공제 취소
   */
  async cancelDeduction(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const cancelledBy = req.user.id;

      const cancelled = await settlementService.cancelDeduction(id, cancelledBy);

      res.json({
        success: true,
        data: cancelled,
      });
    } catch (error) {
      logger.error('Failed to cancel deduction', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel deduction',
      });
    }
  }

  // ================================
  // Admin Endpoints - Payouts
  // ================================

  /**
   * GET /api/admin/payouts
   * 지급 내역 조회
   */
  async getPayouts(req: Request, res: Response) {
    try {
      const { settlementId, helperId, status } = req.query;

      const filters: any = {};
      if (settlementId) filters.settlementId = parseInt(settlementId as string);
      if (helperId) filters.helperId = helperId as string;
      if (status) filters.status = status as any;

      const payouts = await settlementService.getPayouts(filters);

      res.json({
        success: true,
        data: payouts,
      });
    } catch (error) {
      logger.error('Failed to get payouts', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payouts',
      });
    }
  }

  /**
   * POST /api/admin/payouts/request
   * 지급 요청
   */
  async requestPayout(req: AuthenticatedRequest, res: Response) {
    try {
      const data = req.body;
      const createdBy = req.user.id;

      const payout = await settlementService.createPayout(data, createdBy);

      res.status(201).json({
        success: true,
        data: payout,
      });
    } catch (error) {
      logger.error('Failed to request payout', error as Error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to request payout',
      });
    }
  }

  /**
   * POST /api/admin/payouts/:id/retry
   * 지급 재시도
   */
  async retryPayout(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const retriedBy = req.user.id;

      const retried = await settlementService.retryPayout(id, retriedBy);

      res.json({
        success: true,
        data: retried,
      });
    } catch (error) {
      logger.error('Failed to retry payout', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry payout',
      });
    }
  }

  /**
   * PATCH /api/admin/payouts/:id/sent
   * 지급 전송 완료
   */
  async markPayoutSent(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const updatedBy = req.user.id;

      const updated = await settlementService.updatePayoutStatus(id, 'sent', updatedBy);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to mark payout as sent', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark payout as sent',
      });
    }
  }

  /**
   * PATCH /api/admin/payouts/:id/succeeded
   * 지급 성공
   */
  async markPayoutSucceeded(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const updatedBy = req.user.id;

      const updated = await settlementService.updatePayoutStatus(id, 'succeeded', updatedBy);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to mark payout as succeeded', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark payout as succeeded',
      });
    }
  }

  /**
   * PATCH /api/admin/payouts/:id/failed
   * 지급 실패
   */
  async markPayoutFailed(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { failureReason } = req.body;
      const updatedBy = req.user.id;

      const updated = await settlementService.updatePayoutStatus(
        id,
        'failed',
        updatedBy,
        failureReason
      );

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to mark payout as failed', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark payout as failed',
      });
    }
  }

  /**
   * GET /api/admin/settlements/:id/payout-attempts
   * 정산의 지급 시도 내역
   */
  async getPayoutAttempts(req: Request, res: Response) {
    try {
      const settlementId = parseInt(req.params.id);

      const payouts = await settlementService.getPayouts({ settlementId });

      res.json({
        success: true,
        data: payouts,
      });
    } catch (error) {
      logger.error('Failed to get payout attempts', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payout attempts',
      });
    }
  }

  /**
   * POST /api/admin/settlements/:id/retry-payout
   * 정산 지급 재시도
   */
  async retrySettlementPayout(req: AuthenticatedRequest, res: Response) {
    try {
      const settlementId = parseInt(req.params.id);
      const retriedBy = req.user.id;

      // Find latest payout for this settlement
      const payouts = await settlementService.getPayouts({ settlementId });
      if (payouts.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No payout found for this settlement',
        });
      }

      const latestPayout = payouts[0];
      const retried = await settlementService.retryPayout(latestPayout.id, retriedBy);

      res.json({
        success: true,
        data: retried,
      });
    } catch (error) {
      logger.error('Failed to retry settlement payout', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry settlement payout',
      });
    }
  }

  // ================================
  // Admin Endpoints - Reports
  // ================================

  /**
   * GET /api/admin/settlements/daily
   * 일별 정산 리포트
   */
  async getDailyReport(req: Request, res: Response) {
    try {
      const { date } = req.query;
      const reportDate = date ? new Date(date as string) : new Date();

      const report = await settlementService.getDailyReport(reportDate);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to get daily report', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get daily report',
      });
    }
  }

  /**
   * GET /api/admin/settlements/helper
   * 헬퍼별 정산 리포트
   */
  async getHelperReport(req: Request, res: Response) {
    try {
      const { helperId } = req.query;

      if (!helperId) {
        return res.status(400).json({
          success: false,
          error: 'helperId is required',
        });
      }

      const report = await settlementService.getHelperReport(helperId as string);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to get helper report', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get helper report',
      });
    }
  }

  /**
   * GET /api/admin/settlements/helper/:helperId/orders
   * 특정 헬퍼의 정산 주문 목록
   */
  async getHelperOrderSettlements(req: Request, res: Response) {
    try {
      const helperId = req.params.helperId;

      const settlements = await settlementService.getHelperSettlements(helperId);

      res.json({
        success: true,
        data: settlements,
      });
    } catch (error) {
      logger.error('Failed to get helper order settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get helper order settlements',
      });
    }
  }

  /**
   * GET /api/admin/settlements/requester/:requesterId/orders
   * 특정 요청자의 정산 주문 목록
   */
  async getRequesterOrderSettlements(req: Request, res: Response) {
    try {
      const requesterId = req.params.requesterId;

      const settlements = await settlementService.getSettlements({ requesterId });

      res.json({
        success: true,
        data: settlements,
      });
    } catch (error) {
      logger.error('Failed to get requester order settlements', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get requester order settlements',
      });
    }
  }

  /**
   * GET /api/admin/settlements/requester
   * 요청자별 정산 리포트
   */
  async getRequesterReport(req: Request, res: Response) {
    try {
      const { requesterId } = req.query;

      if (!requesterId) {
        return res.status(400).json({
          success: false,
          error: 'requesterId is required',
        });
      }

      const settlements = await settlementService.getSettlements({
        requesterId: requesterId as string,
      });

      res.json({
        success: true,
        data: settlements,
      });
    } catch (error) {
      logger.error('Failed to get requester report', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get requester report',
      });
    }
  }

  /**
   * GET /api/admin/monthly-settlement-summary
   * 월별 정산 요약
   */
  async getMonthlyReport(req: Request, res: Response) {
    try {
      const { year, month } = req.query;

      if (!year || !month) {
        return res.status(400).json({
          success: false,
          error: 'year and month are required',
        });
      }

      const report = await settlementService.getMonthlyReport(
        parseInt(year as string),
        parseInt(month as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to get monthly report', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get monthly report',
      });
    }
  }

  /**
   * GET /api/admin/settlements/:id/validation
   * 정산 검증
   */
  async validateSettlement(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const validation = await settlementService.validateSettlement(id);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('Failed to validate settlement', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate settlement',
      });
    }
  }

  /**
   * GET /api/admin/settlements/:id/audit-logs
   * 정산 Audit logs
   */
  async getAuditLogs(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const logs = await settlementService.getAuditLogs(id);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error('Failed to get audit logs', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit logs',
      });
    }
  }

  /**
   * GET /api/admin/outstanding
   * 미지급 잔액 조회
   */
  async getOutstandingBalances(req: Request, res: Response) {
    try {
      const balances = await settlementService.getOutstandingBalances();

      res.json({
        success: true,
        data: balances,
      });
    } catch (error) {
      logger.error('Failed to get outstanding balances', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get outstanding balances',
      });
    }
  }

  /**
   * GET /api/admin/orders/:orderId/settlement-summary
   * 주문의 정산 요약 (관리자)
   */
  async getAdminOrderSettlementSummary(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);

      const summary = await settlementService.calculateSettlementSummary(orderId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get order settlement summary', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order settlement summary',
      });
    }
  }
}

export const settlementController = new SettlementController();
