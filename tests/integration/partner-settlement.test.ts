/**
 * Partner Settlement API integration tests
 *
 * Tests settlement listing and summary endpoints for the
 * partner settlement route module.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp,
  createMockUser,
  createMockTeam,
  createMockTeamMember,
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
  commissionRate: 15,
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

const token = generateTestToken('leader-001');

beforeAll(async () => {
  const { registerPartnerSettlementRoutes } = await import(
    '../../server/routes/partner/settlement.routes'
  );
  const result = await createTestApp(registerPartnerSettlementRoutes);
  app = result.app;
  storage = result.storage;
  db = result.db;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
  mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);
});

describe('Partner Settlement API', () => {
  // =================================================================
  // GET /api/partner/settlements
  // =================================================================
  describe('GET /api/partner/settlements', () => {
    it('returns settlement list with summary (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);
      storage.getUser.mockResolvedValue(createMockUser({ id: 'helper-001', name: 'Helper 1' }));

      const settlementRow = {
        id: 1,
        helperId: 'helper-001',
        period: '2025-01',
        totalContractAmount: 500000,
        commissionAmount: 75000,
        helperPayout: 425000,
        platformCommission: 50000,
        createdAt: new Date('2025-01-31'),
      };

      // Both queries end with .orderBy() or .where() (no .offset()),
      // so they resolve via .then(). First call = settlements, second = incentives.
      db.then
        .mockImplementationOnce((resolve: any) => resolve([settlementRow]))
        .mockImplementationOnce((resolve: any) => resolve([]));

      const res = await request(app)
        .get('/api/partner/settlements?month=2025-01')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settlements');
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('month', '2025-01');
      expect(res.body).toHaveProperty('teamCommissionRate', 15);
    });

    it('returns empty settlements when no active members (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/partner/settlements')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.settlements).toEqual([]);
      expect(res.body.summary.totalAmount).toBe(0);
    });
  });

  // =================================================================
  // GET /api/partner/settlements/summary
  // =================================================================
  describe('GET /api/partner/settlements/summary', () => {
    it('returns monthly summaries for last 6 months (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);
      // Each month query will hit db.select chain -> then
      db.then.mockImplementation((resolve: any) => resolve([]));

      const res = await request(app)
        .get('/api/partner/settlements/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('monthlySummaries');
      expect(res.body.monthlySummaries).toBeInstanceOf(Array);
      expect(res.body.monthlySummaries.length).toBe(6);
      expect(res.body.monthlySummaries[0]).toHaveProperty('month');
      expect(res.body.monthlySummaries[0]).toHaveProperty('totalAmount');
      expect(res.body.monthlySummaries[0]).toHaveProperty('totalCommission');
      expect(res.body.monthlySummaries[0]).toHaveProperty('count');
    });
  });
});
