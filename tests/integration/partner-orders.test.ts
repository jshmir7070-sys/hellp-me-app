/**
 * Partner Orders API integration tests
 *
 * Tests order listing, detail, available orders, and assignment
 * endpoints from the partner orders route module.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp,
  createMockUser,
  createMockTeam,
  createMockOrder,
  createMockTeamMember,
  generateTestToken,
} from '../setup';

// ---------------------------------------------------------------------------
// Module-level mocks (partnerAuth middleware dependencies)
// ---------------------------------------------------------------------------

const leaderUser = createMockUser({
  id: 'leader-001',
  isTeamLeader: true,
});

const activeTeam = createMockTeam({
  id: 10,
  leaderId: 'leader-001',
  isActive: true,
});

const mockStorageForMiddleware = {
  getUser: vi.fn().mockResolvedValue(leaderUser),
  getAllTeams: vi.fn().mockResolvedValue([activeTeam]),
};

vi.mock('../../server/storage', () => ({
  storage: mockStorageForMiddleware,
}));

vi.mock('../../server/config/jwt', () => ({
  EFFECTIVE_JWT_SECRET: 'test-secret',
}));

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let app: Express;
let storage: any;
let db: any;

const member1 = createMockTeamMember({ id: 1, teamId: 10, helperId: 'helper-001', isActive: true });
const member2 = createMockTeamMember({ id: 2, teamId: 10, helperId: 'helper-002', isActive: true });

const sampleOrder = createMockOrder({
  id: 100,
  matchedHelperId: 'helper-001',
  status: 'scheduled',
});

const matchingOrder = createMockOrder({
  id: 200,
  matchedHelperId: null,
  status: 'matching',
});

const token = generateTestToken('leader-001');

beforeAll(async () => {
  const { registerPartnerOrderRoutes } = await import(
    '../../server/routes/partner/orders.routes'
  );
  const result = await createTestApp(registerPartnerOrderRoutes);
  app = result.app;
  storage = result.storage;
  db = result.db;
});

beforeEach(() => {
  vi.clearAllMocks();

  // Reset middleware mocks
  mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
  mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);
});

describe('Partner Orders API', () => {
  // =================================================================
  // GET /api/partner/orders
  // =================================================================
  describe('GET /api/partner/orders', () => {
    it('returns paginated order list (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([member1, member2]);

      // db.select().from().where().orderBy().limit().offset() -> orders
      db.offset.mockResolvedValue([sampleOrder]);
      // count query: the second call chain also resolves through offset
      // Because the same db mock is reused, we handle it by making offset
      // return the order list the first time. The count query in the route
      // uses a separate db.select chain; since our mock returns the same chain,
      // the second .offset() call will also resolve. We configure via then.
      db.then.mockImplementation((resolve: any) => resolve([{ count: 1 }]));

      const res = await request(app)
        .get('/api/partner/orders?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orders');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('totalPages');
    });

    it('returns empty list when no active team members (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/partner/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });

  // =================================================================
  // GET /api/partner/orders/available
  // =================================================================
  describe('GET /api/partner/orders/available', () => {
    it('returns matching orders (200)', async () => {
      db.offset.mockResolvedValue([matchingOrder]);

      const res = await request(app)
        .get('/api/partner/orders/available')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orders');
    });
  });

  // =================================================================
  // GET /api/partner/orders/:orderId
  // =================================================================
  describe('GET /api/partner/orders/:orderId', () => {
    it('returns order detail (200)', async () => {
      storage.getOrder.mockResolvedValue(
        createMockOrder({ id: 100, matchedHelperId: 'helper-001', status: 'scheduled' }),
      );
      storage.getTeamMembers.mockResolvedValue([member1]);
      storage.getOrderApplications.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/partner/orders/100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('order');
      expect(res.body).toHaveProperty('applications');
    });

    it('returns 404 when order not found', async () => {
      storage.getOrder.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/partner/orders/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =================================================================
  // POST /api/partner/orders/:orderId/assign
  // =================================================================
  describe('POST /api/partner/orders/:orderId/assign', () => {
    it('assigns team member successfully (200)', async () => {
      storage.getOrder.mockResolvedValue(matchingOrder);
      storage.getTeamMembers.mockResolvedValue([member1]);
      storage.createOrderApplication.mockResolvedValue({ id: 1 });
      storage.updateOrder.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/partner/orders/200/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({ helperId: 'helper-001' });

      expect(res.status).toBe(200);
      expect(storage.updateOrder).toHaveBeenCalledWith(200, expect.objectContaining({
        matchedHelperId: 'helper-001',
        status: 'scheduled',
      }));
    });

    it('returns 400 when helperId is not a team member', async () => {
      storage.getOrder.mockResolvedValue(matchingOrder);
      storage.getTeamMembers.mockResolvedValue([member1]);

      const res = await request(app)
        .post('/api/partner/orders/200/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({ helperId: 'outsider-999' });

      expect(res.status).toBe(400);
    });
  });
});
