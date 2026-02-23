/**
 * Partner Members API integration tests
 *
 * Tests team member listing, detail, invite, and removal endpoints.
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
  name: 'Alpha Team',
  leaderId: 'leader-001',
  isActive: true,
  qrCodeToken: 'invite-token-xyz',
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

const helperUser = createMockUser({
  id: 'helper-001',
  name: 'Helper One',
  email: 'helper1@test.com',
  phone: '010-1111-2222',
});

const member1 = createMockTeamMember({
  id: 1,
  teamId: 10,
  helperId: 'helper-001',
  isActive: true,
  joinedAt: new Date('2024-03-01'),
});

const token = generateTestToken('leader-001');

beforeAll(async () => {
  const { registerPartnerMemberRoutes } = await import(
    '../../server/routes/partner/members.routes'
  );
  const result = await createTestApp(registerPartnerMemberRoutes);
  app = result.app;
  storage = result.storage;
  db = result.db;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
  mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);
});

describe('Partner Members API', () => {
  // =================================================================
  // GET /api/partner/members
  // =================================================================
  describe('GET /api/partner/members', () => {
    it('returns enriched member list (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);
      storage.getUser.mockResolvedValue(helperUser);

      const res = await request(app)
        .get('/api/partner/members')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('members');
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0]).toHaveProperty('user');
      expect(res.body.members[0].user).toHaveProperty('name', 'Helper One');
      expect(res.body).toHaveProperty('teamName', 'Alpha Team');
      expect(res.body).toHaveProperty('inviteCode', 'invite-token-xyz');
    });
  });

  // =================================================================
  // GET /api/partner/members/:memberId
  // =================================================================
  describe('GET /api/partner/members/:memberId', () => {
    it('returns member detail with recent orders (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);
      storage.getUser.mockResolvedValue(helperUser);
      // db.select().from().where().orderBy().limit() -> recent orders
      db.offset.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/partner/members/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('member');
      expect(res.body.member.id).toBe(1);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('recentOrders');
    });

    it('returns 404 when member not found', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);

      const res = await request(app)
        .get('/api/partner/members/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =================================================================
  // POST /api/partner/members/invite
  // =================================================================
  describe('POST /api/partner/members/invite', () => {
    it('returns invite code for the team (200)', async () => {
      const res = await request(app)
        .post('/api/partner/members/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inviteCode', 'invite-token-xyz');
      expect(res.body).toHaveProperty('teamName', 'Alpha Team');
      expect(res.body).toHaveProperty('teamId', 10);
    });
  });

  // =================================================================
  // DELETE /api/partner/members/:memberId
  // =================================================================
  describe('DELETE /api/partner/members/:memberId', () => {
    it('deactivates a team member (200)', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);

      // db.update().set().where() chain
      const whereReturning = vi.fn().mockResolvedValue(undefined);
      const setMock = vi.fn().mockReturnValue({ where: whereReturning });
      db.update = vi.fn().mockReturnValue({ set: setMock });

      const res = await request(app)
        .delete('/api/partner/members/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });
  });
});
