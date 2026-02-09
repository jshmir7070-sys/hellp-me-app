/**
 * Admin Controller
 * Handles admin dashboard, task queue, and batch operations
 */

import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../utils/auth-middleware';
import { pool, db } from '../db';
import { orders, settlements, identityVerifications } from '@shared/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  notifyOrderApproved,
  notifySettlementApproved,
  notifyHelperVerified,
} from '../utils/admin-websocket';

export class AdminController {
  /**
   * GET /api/admin/dashboard/overview
   * 통합 대시보드 데이터: 통계 + 업무 대기함 + 최근 오더
   */
  async getDashboardOverview(req: AuthenticatedRequest, res: Response) {
    try {
      // 병렬로 3개 쿼리 실행
      const [statsResult, taskQueueResult, recentOrdersResult] = await Promise.all([
        // 1. 실시간 통계
        pool.query('SELECT * FROM admin_stats_view LIMIT 1'),

        // 2. 업무 대기함 (우선순위 높은 순으로 20개)
        pool.query(`
          SELECT * FROM task_queue_view
          ORDER BY priority ASC, waiting_minutes DESC
          LIMIT 20
        `),

        // 3. 최근 오더 (통합 뷰에서 10개)
        pool.query(`
          SELECT * FROM admin_orders_view
          ORDER BY id DESC
          LIMIT 10
        `)
      ]);

      const stats = statsResult.rows[0] || {
        active_orders: 0,
        active_helpers: 0,
        pending_settlement_total: 0,
        today_revenue: 0
      };

      res.json({
        success: true,
        data: {
          stats: {
            activeOrders: Number(stats.active_orders),
            activeHelpers: Number(stats.active_helpers),
            pendingSettlementTotal: Number(stats.pending_settlement_total),
            todayRevenue: Number(stats.today_revenue)
          },
          taskQueue: taskQueueResult.rows.map(task => ({
            taskType: task.task_type,
            referenceId: task.reference_id,
            priority: task.priority,
            waitingMinutes: Math.round(task.waiting_minutes),
            relatedData: task.related_data
          })),
          recentOrders: recentOrdersResult.rows.map(order => ({
            id: order.id,
            status: order.status,
            isUrgent: order.is_urgent,
            requesterName: order.requester_name,
            helperName: order.helper_name,
            settlementStatus: order.settlement_status,
            platformRevenue: Number(order.platform_revenue || 0),
            statusWaitingMinutes: Math.round(order.status_waiting_minutes || 0)
          }))
        }
      });
    } catch (error: any) {
      console.error('[AdminController] getDashboardOverview error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/admin/task-queue
   * 업무 대기함 목록 (필터링 옵션 지원)
   */
  async getTaskQueue(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskType, minPriority, limit = 50 } = req.query;

      let query = 'SELECT * FROM task_queue_view WHERE 1=1';
      const params: any[] = [];

      // 필터: task_type
      if (taskType) {
        params.push(taskType);
        query += ` AND task_type = $${params.length}`;
      }

      // 필터: priority (이상)
      if (minPriority) {
        params.push(Number(minPriority));
        query += ` AND priority >= $${params.length}`;
      }

      // 정렬 및 제한
      query += ` ORDER BY priority ASC, waiting_minutes DESC LIMIT $${params.length + 1}`;
      params.push(Number(limit));

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows.map(task => ({
          taskType: task.task_type,
          referenceId: task.reference_id,
          priority: task.priority,
          waitingMinutes: Math.round(task.waiting_minutes),
          relatedData: task.related_data
        })),
        total: result.rows.length
      });
    } catch (error: any) {
      console.error('[AdminController] getTaskQueue error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/admin/batch/approve-orders
   * 오더 일괄 승인
   */
  async batchApproveOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const { orderIds } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'orderIds 배열이 필요합니다'
        });
      }

      // 트랜잭션으로 일괄 승인
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const updateResult = await client.query(
          `UPDATE orders
           SET status = 'confirmed',
               status_updated_at = NOW(),
               admin_approved_at = NOW(),
               admin_approved_by = $1
           WHERE id = ANY($2)
           AND status = 'pending'
           RETURNING id, status`,
          [req.user?.id, orderIds]
        );

        await client.query('COMMIT');

        // WebSocket으로 실시간 알림 (관리자 + 네이티브 앱)
        await notifyOrderApproved(orderIds);

        res.json({
          success: true,
          data: {
            approvedCount: updateResult.rowCount,
            approvedOrders: updateResult.rows
          }
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[AdminController] batchApproveOrders error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/admin/batch/approve-settlements
   * 정산 일괄 승인
   */
  async batchApproveSettlements(req: AuthenticatedRequest, res: Response) {
    try {
      const { settlementIds } = req.body;

      if (!Array.isArray(settlementIds) || settlementIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'settlementIds 배열이 필요합니다'
        });
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const updateResult = await client.query(
          `UPDATE settlements
           SET status = 'approved',
               approved_at = NOW(),
               approved_by = $1
           WHERE id = ANY($2)
           AND status = 'pending_approval'
           RETURNING id, status, amount`,
          [req.user?.id, settlementIds]
        );

        await client.query('COMMIT');

        // WebSocket으로 실시간 알림 (관리자 + 네이티브 앱)
        await notifySettlementApproved(settlementIds);

        res.json({
          success: true,
          data: {
            approvedCount: updateResult.rowCount,
            approvedSettlements: updateResult.rows
          }
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[AdminController] batchApproveSettlements error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/admin/batch/verify-helpers
   * 헬퍼 일괄 인증 승인
   */
  async batchVerifyHelpers(req: AuthenticatedRequest, res: Response) {
    try {
      const { verificationIds } = req.body;

      if (!Array.isArray(verificationIds) || verificationIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'verificationIds 배열이 필요합니다'
        });
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // 1. identity_verifications 테이블 업데이트
        const updateResult = await client.query(
          `UPDATE identity_verifications
           SET status = 'approved',
               verified_at = NOW(),
               verified_by = $1
           WHERE id = ANY($2)
           AND status = 'pending'
           RETURNING user_id, id`,
          [req.user?.id, verificationIds]
        );

        // 2. 연관된 users 테이블의 helper_verified 플래그 업데이트
        if (updateResult.rowCount > 0) {
          const userIds = updateResult.rows.map((row: any) => row.user_id);

          await client.query(
            `UPDATE users
             SET helper_verified = true
             WHERE id = ANY($1)`,
            [userIds]
          );
        }

        await client.query('COMMIT');

        // WebSocket으로 실시간 알림 (관리자 + 네이티브 앱)
        const userIds = updateResult.rows.map((row: any) => row.user_id);
        await notifyHelperVerified(verificationIds, userIds);

        res.json({
          success: true,
          data: {
            verifiedCount: updateResult.rowCount,
            verifiedHelpers: updateResult.rows
          }
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[AdminController] batchVerifyHelpers error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/admin/stats/settlements
   * 헬퍼별 정산 요약
   */
  async getHelperSettlements(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await pool.query(`
        SELECT * FROM helper_settlement_summary_view
        ORDER BY total_earnings DESC
        LIMIT 100
      `);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          helperId: row.helper_id,
          helperName: row.helper_name,
          completedJobs: Number(row.completed_jobs),
          totalEarnings: Number(row.total_earnings),
          pendingAmount: Number(row.pending_amount),
          paidAmount: Number(row.paid_amount)
        }))
      });
    } catch (error: any) {
      console.error('[AdminController] getHelperSettlements error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/admin/stats/billing
   * 의뢰자별 과금 요약
   */
  async getRequesterBilling(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await pool.query(`
        SELECT * FROM requester_billing_summary_view
        ORDER BY total_spent DESC
        LIMIT 100
      `);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          requesterId: row.requester_id,
          requesterName: row.requester_name,
          totalOrders: Number(row.total_orders),
          totalSpent: Number(row.total_spent),
          avgOrderValue: Number(row.avg_order_value),
          lastOrderDate: row.last_order_date
        }))
      });
    } catch (error: any) {
      console.error('[AdminController] getRequesterBilling error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/admin/orders/:id/integrated
   * 통합 오더 상세 정보 (모든 데이터를 한 번에)
   */
  async getIntegratedOrderDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = Number(req.params.id);

      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 오더 ID입니다'
        });
      }

      // 병렬로 모든 데이터 조회
      const [orderResult, contractResult, settlementResult, checkinResult, closingResult, applicationsResult] = await Promise.all([
        // 1. 오더 기본 정보
        pool.query(`
          SELECT
            o.*,
            requester.name as requester_name,
            requester.phone as requester_phone,
            requester.email as requester_email,
            helper.name as helper_name,
            helper.phone as helper_phone,
            helper.team_name as helper_team_name,
            helper.profile_image as helper_profile_image
          FROM orders o
          LEFT JOIN users requester ON o.requester_id = requester.id
          LEFT JOIN users helper ON o.matched_helper_id = helper.id
          WHERE o.id = $1
        `, [orderId]),

        // 2. 계약 정보
        pool.query(`
          SELECT * FROM job_contracts
          WHERE order_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [orderId]),

        // 3. 정산 정보
        pool.query(`
          SELECT * FROM settlements
          WHERE order_id = $1
          ORDER BY created_at DESC
        `, [orderId]),

        // 4. 체크인 정보
        pool.query(`
          SELECT * FROM check_ins
          WHERE order_id = $1
          ORDER BY checked_in_at DESC
        `, [orderId]),

        // 5. 마감 정보
        pool.query(`
          SELECT
            c.*,
            helper.name as helper_name,
            requester.name as requester_name
          FROM closings c
          LEFT JOIN users helper ON c.helper_id = helper.id
          LEFT JOIN users requester ON c.requester_id = requester.id
          WHERE c.order_id = $1
          ORDER BY c.created_at DESC
          LIMIT 1
        `, [orderId]),

        // 6. 지원자 목록
        pool.query(`
          SELECT
            a.*,
            helper.name as helper_name,
            helper.phone as helper_phone,
            helper.team_name as helper_team_name
          FROM order_applications a
          LEFT JOIN users helper ON a.helper_id = helper.id
          WHERE a.order_id = $1
          ORDER BY a.applied_at DESC
        `, [orderId])
      ]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: '오더를 찾을 수 없습니다'
        });
      }

      const order = orderResult.rows[0];
      const contract = contractResult.rows[0] || null;
      const settlements = settlementResult.rows;
      const checkins = checkinResult.rows;
      const closing = closingResult.rows[0] || null;
      const applications = applicationsResult.rows;

      res.json({
        success: true,
        data: {
          order: {
            id: order.id,
            status: order.status,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            requesterId: order.requester_id,
            requesterName: order.requester_name,
            requesterPhone: order.requester_phone,
            requesterEmail: order.requester_email,
            matchedHelperId: order.matched_helper_id,
            helperName: order.helper_name,
            helperPhone: order.helper_phone,
            helperTeamName: order.helper_team_name,
            helperProfileImage: order.helper_profile_image,
            deliveryArea: order.delivery_area,
            campAddress: order.camp_address,
            courierCompany: order.courier_company,
            companyName: order.company_name,
            boxCount: order.box_count,
            unitPrice: Number(order.unit_price),
            totalAmount: Number(order.total_amount),
            scheduledDate: order.scheduled_date,
            deadline: order.deadline,
            contactPhone: order.contact_phone,
            deliveryGuide: order.delivery_guide,
            isUrgent: order.is_urgent,
            regionMapUrl: order.region_map_url,
          },
          contract: contract ? {
            id: contract.id,
            status: contract.status,
            signedAt: contract.signed_at,
            helperSignedAt: contract.helper_signed_at,
            requesterSignedAt: contract.requester_signed_at,
            terms: contract.terms,
          } : null,
          settlements: settlements.map((s: any) => ({
            id: s.id,
            status: s.status,
            amount: Number(s.amount),
            platformFee: Number(s.platform_fee),
            netAmount: Number(s.net_amount),
            createdAt: s.created_at,
            approvedAt: s.approved_at,
            paidAt: s.paid_at,
          })),
          checkins: checkins.map((c: any) => ({
            id: c.id,
            checkedInAt: c.checked_in_at,
            location: c.location,
            photoUrl: c.photo_url,
            notes: c.notes,
          })),
          closing: closing ? {
            id: closing.id,
            status: closing.status,
            helperName: closing.helper_name,
            requesterName: closing.requester_name,
            actualBoxCount: closing.actual_box_count,
            actualWorkTime: closing.actual_work_time,
            helperNotes: closing.helper_notes,
            requesterNotes: closing.requester_notes,
            photoUrls: closing.photo_urls,
            createdAt: closing.created_at,
            helperSubmittedAt: closing.helper_submitted_at,
            requesterApprovedAt: closing.requester_approved_at,
          } : null,
          applications: applications.map((a: any) => ({
            id: a.id,
            helperId: a.helper_id,
            helperName: a.helper_name,
            helperPhone: a.helper_phone,
            helperTeamName: a.helper_team_name,
            status: a.status,
            message: a.message,
            expectedArrival: a.expected_arrival,
            appliedAt: a.applied_at,
          })),
        }
      });
    } catch (error: any) {
      console.error('[AdminController] getIntegratedOrderDetail error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const adminController = new AdminController();
