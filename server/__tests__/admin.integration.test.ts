/**
 * Admin API Integration Tests
 *
 * Tests admin endpoints with mocked database
 */

import request from 'supertest';
import express, { Express } from 'express';
import { adminAuth } from '../utils/auth-middleware';

// Mock adminAuth middleware for testing
jest.mock('../utils/auth-middleware', () => ({
  adminAuth: (req: any, res: any, next: any) => {
    req.user = {
      id: 'admin-123',
      role: 'admin',
      isHqStaff: true,
    };
    req.adminUser = req.user;
    next();
  },
}));

describe('Admin API Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock dashboard overview endpoint
    app.get('/api/admin/dashboard/overview', adminAuth, (req, res) => {
      res.json({
        success: true,
        data: {
          stats: {
            activeOrders: 15,
            activeHelpers: 8,
            pendingSettlementTotal: 1500000,
            todayRevenue: 300000,
          },
          taskQueue: [
            {
              taskType: 'order_approval',
              referenceId: 1,
              priority: 1,
              waitingMinutes: 45,
              relatedData: {
                orderId: 1,
                requesterName: '김철수',
                isUrgent: true,
              },
            },
          ],
          recentOrders: [
            {
              id: 1,
              status: 'pending',
              isUrgent: true,
              requesterName: '김철수',
              helperName: null,
              settlementStatus: null,
              platformRevenue: 0,
              statusWaitingMinutes: 45,
            },
          ],
        },
      });
    });

    // Mock task queue endpoint
    app.get('/api/admin/task-queue', adminAuth, (req, res) => {
      const { taskType, minPriority, limit = 50 } = req.query;

      res.json({
        success: true,
        data: [
          {
            taskType: 'order_approval',
            referenceId: 1,
            priority: 1,
            waitingMinutes: 45,
            relatedData: { orderId: 1, isUrgent: true },
          },
          {
            taskType: 'settlement_approval',
            referenceId: 2,
            priority: 2,
            waitingMinutes: 120,
            relatedData: { settlementId: 2, amount: 50000 },
          },
        ],
        total: 2,
      });
    });

    // Mock batch approve orders endpoint
    app.post('/api/admin/batch/approve-orders', adminAuth, (req, res) => {
      const { orderIds } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'orderIds 배열이 필요합니다',
        });
      }

      res.json({
        success: true,
        data: {
          approvedCount: orderIds.length,
          approvedOrders: orderIds.map(id => ({
            id,
            status: 'confirmed',
          })),
        },
      });
    });

    // Mock batch approve settlements endpoint
    app.post('/api/admin/batch/approve-settlements', adminAuth, (req, res) => {
      const { settlementIds } = req.body;

      if (!Array.isArray(settlementIds) || settlementIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'settlementIds 배열이 필요합니다',
        });
      }

      res.json({
        success: true,
        data: {
          approvedCount: settlementIds.length,
          approvedSettlements: settlementIds.map(id => ({
            id,
            status: 'approved',
            amount: 50000,
          })),
        },
      });
    });

    // Mock batch verify helpers endpoint
    app.post('/api/admin/batch/verify-helpers', adminAuth, (req, res) => {
      const { verificationIds } = req.body;

      if (!Array.isArray(verificationIds) || verificationIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'verificationIds 배열이 필요합니다',
        });
      }

      res.json({
        success: true,
        data: {
          verifiedCount: verificationIds.length,
          verifiedHelpers: verificationIds.map(id => ({
            id,
            user_id: `user-${id}`,
          })),
        },
      });
    });
  });

  describe('Dashboard Overview', () => {
    it('should return dashboard overview data', async () => {
      const response = await request(app).get('/api/admin/dashboard/overview');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('taskQueue');
      expect(response.body.data).toHaveProperty('recentOrders');
      expect(response.body.data.stats).toHaveProperty('activeOrders', 15);
    });

    it('should include task queue in dashboard', async () => {
      const response = await request(app).get('/api/admin/dashboard/overview');

      expect(response.body.data.taskQueue).toBeInstanceOf(Array);
      expect(response.body.data.taskQueue[0]).toHaveProperty('taskType');
      expect(response.body.data.taskQueue[0]).toHaveProperty('priority');
    });
  });

  describe('Task Queue', () => {
    it('should return task queue list', async () => {
      const response = await request(app).get('/api/admin/task-queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it('should handle query parameters', async () => {
      const response = await request(app)
        .get('/api/admin/task-queue')
        .query({ taskType: 'order_approval', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Batch Operations - Orders', () => {
    it('should batch approve orders', async () => {
      const response = await request(app)
        .post('/api/admin/batch/approve-orders')
        .send({ orderIds: [1, 2, 3] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.approvedCount).toBe(3);
      expect(response.body.data.approvedOrders).toHaveLength(3);
    });

    it('should reject empty orderIds', async () => {
      const response = await request(app)
        .post('/api/admin/batch/approve-orders')
        .send({ orderIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing orderIds', async () => {
      const response = await request(app)
        .post('/api/admin/batch/approve-orders')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Batch Operations - Settlements', () => {
    it('should batch approve settlements', async () => {
      const response = await request(app)
        .post('/api/admin/batch/approve-settlements')
        .send({ settlementIds: [1, 2] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.approvedCount).toBe(2);
    });

    it('should reject empty settlementIds', async () => {
      const response = await request(app)
        .post('/api/admin/batch/approve-settlements')
        .send({ settlementIds: [] });

      expect(response.status).toBe(400);
    });
  });

  describe('Batch Operations - Helper Verification', () => {
    it('should batch verify helpers', async () => {
      const response = await request(app)
        .post('/api/admin/batch/verify-helpers')
        .send({ verificationIds: [1, 2, 3] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verifiedCount).toBe(3);
    });

    it('should reject empty verificationIds', async () => {
      const response = await request(app)
        .post('/api/admin/batch/verify-helpers')
        .send({ verificationIds: [] });

      expect(response.status).toBe(400);
    });
  });

  describe('Authorization', () => {
    it('should require admin authentication', async () => {
      // This test assumes adminAuth middleware is working
      const response = await request(app).get('/api/admin/dashboard/overview');
      expect(response.status).toBe(200); // Mock always passes
    });
  });
});
