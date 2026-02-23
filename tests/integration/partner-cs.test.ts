/**
 * Partner CS (Customer Service) API integration tests
 *
 * Tests CRUD operations for CS inquiries managed by team leaders.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp,
  createMockUser,
  createMockTeam,
  generateTestToken,
} from '../setup';

// ---------------------------------------------------------------------------
// Module-level mocks
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
let db: any;

const token = generateTestToken('leader-001');

const sampleInquiry = {
  id: 1,
  teamId: 10,
  reporterId: 'leader-001',
  title: 'Delivery issue',
  content: 'Package was damaged',
  category: 'damage',
  priority: 'high',
  status: 'open',
  orderId: null,
  createdAt: new Date('2025-01-10'),
  updatedAt: new Date('2025-01-10'),
};

beforeAll(async () => {
  const { registerPartnerCSRoutes } = await import(
    '../../server/routes/partner/cs.routes'
  );
  const result = await createTestApp(registerPartnerCSRoutes);
  app = result.app;
  db = result.db;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
  mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);

  // Reset chainable db mock defaults
  db.offset.mockResolvedValue([sampleInquiry]);
  db.then.mockImplementation((resolve: any) => resolve([{ count: 1 }]));
  db.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([sampleInquiry]),
    }),
  });
  db.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...sampleInquiry, priority: 'normal' }]),
      }),
    }),
  });
});

describe('Partner CS API', () => {
  // =================================================================
  // GET /api/partner/cs
  // =================================================================
  describe('GET /api/partner/cs', () => {
    it('returns paginated CS inquiry list (200)', async () => {
      const res = await request(app)
        .get('/api/partner/cs?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inquiries');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('totalPages');
    });
  });

  // =================================================================
  // POST /api/partner/cs
  // =================================================================
  describe('POST /api/partner/cs', () => {
    it('creates a new CS inquiry (201)', async () => {
      const res = await request(app)
        .post('/api/partner/cs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Delivery issue',
          content: 'Package was damaged during transport',
          category: 'damage',
          priority: 'high',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 when title or content is missing', async () => {
      const res = await request(app)
        .post('/api/partner/cs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
    });
  });

  // =================================================================
  // GET /api/partner/cs/:id
  // =================================================================
  describe('GET /api/partner/cs/:id', () => {
    it('returns inquiry detail (200)', async () => {
      // The route does db.select().from().where() which resolves via then
      db.then.mockImplementation((resolve: any) => resolve([sampleInquiry]));

      const res = await request(app)
        .get('/api/partner/cs/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 1);
    });

    it('returns 404 when inquiry not found', async () => {
      db.then.mockImplementation((resolve: any) => resolve([]));

      const res = await request(app)
        .get('/api/partner/cs/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =================================================================
  // PATCH /api/partner/cs/:id
  // =================================================================
  describe('PATCH /api/partner/cs/:id', () => {
    it('updates an inquiry (200)', async () => {
      // Verify ownership: first db.select chain
      db.then.mockImplementation((resolve: any) => resolve([sampleInquiry]));

      const res = await request(app)
        .patch('/api/partner/cs/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Updated content', priority: 'normal' });

      expect(res.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });
  });
});
