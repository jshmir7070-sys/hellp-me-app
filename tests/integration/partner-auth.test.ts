/**
 * Partner Auth API integration tests
 *
 * Tests the partner authentication routes including login, /me,
 * and change-password flows. The partnerAuth middleware imports
 * storage and EFFECTIVE_JWT_SECRET directly, so we mock those
 * at the module level.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcrypt from 'bcrypt';
import {
  createTestApp,
  createMockUser,
  createMockTeam,
  generateTestToken,
  TEST_JWT_SECRET,
} from '../setup';

// ---------------------------------------------------------------------------
// Module-level mocks for partnerAuth middleware dependencies
// ---------------------------------------------------------------------------

// Storage mock shared between middleware and route handler
const mockStorageForMiddleware = {
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  getAllTeams: vi.fn().mockResolvedValue([]),
  getTeamMembers: vi.fn().mockResolvedValue([]),
  createUser: vi.fn(),
  updateUser: vi.fn(),
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
let ctxStorage: any;

const hashedPassword = bcrypt.hashSync('Correct1!', 10);

const leaderUser = createMockUser({
  id: 'leader-001',
  email: 'leader@test.com',
  password: hashedPassword,
  isTeamLeader: true,
});

const activeTeam = createMockTeam({
  id: 10,
  name: 'Alpha Team',
  leaderId: 'leader-001',
  isActive: true,
  commissionRate: 15,
  businessType: 'delivery',
});

const nonLeaderUser = createMockUser({
  id: 'user-002',
  email: 'normal@test.com',
  password: hashedPassword,
  isTeamLeader: false,
});

beforeAll(async () => {
  const { registerPartnerAuthRoutes } = await import(
    '../../server/routes/partner/auth.routes'
  );
  const result = await createTestApp(registerPartnerAuthRoutes);
  app = result.app;
  ctxStorage = result.storage;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Partner Auth API', () => {
  // =================================================================
  // POST /api/partner/auth/login
  // =================================================================
  describe('POST /api/partner/auth/login', () => {
    it('returns 200 with token, user, and team on successful login', async () => {
      // ctx.storage is used inside registerPartnerAuthRoutes for getUserByEmail,
      // but the route file destructures storage from ctx. Because we also mock
      // the global ../../server/storage for the middleware, we configure both.
      ctxStorage.getUserByEmail.mockResolvedValue(leaderUser);
      ctxStorage.getAllTeams.mockResolvedValue([activeTeam]);
      // Middleware-level storage
      mockStorageForMiddleware.getUserByEmail.mockResolvedValue(leaderUser);
      mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);

      const res = await request(app)
        .post('/api/partner/auth/login')
        .send({ email: 'leader@test.com', password: 'Correct1!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body).toHaveProperty('team');
      expect(res.body.team.id).toBe(10);
    });

    it('returns 400 when email or password is missing', async () => {
      const res = await request(app)
        .post('/api/partner/auth/login')
        .send({ email: 'leader@test.com' });

      expect(res.status).toBe(400);
    });

    it('returns 401 when user is not found (wrong email)', async () => {
      ctxStorage.getUserByEmail.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/partner/auth/login')
        .send({ email: 'unknown@test.com', password: 'Any1!' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when password is wrong', async () => {
      ctxStorage.getUserByEmail.mockResolvedValue(leaderUser);

      const res = await request(app)
        .post('/api/partner/auth/login')
        .send({ email: 'leader@test.com', password: 'WrongPass1!' });

      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not a team leader', async () => {
      ctxStorage.getUserByEmail.mockResolvedValue(nonLeaderUser);

      const res = await request(app)
        .post('/api/partner/auth/login')
        .send({ email: 'normal@test.com', password: 'Correct1!' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when no active team exists', async () => {
      ctxStorage.getUserByEmail.mockResolvedValue(leaderUser);
      ctxStorage.getAllTeams.mockResolvedValue([
        createMockTeam({ leaderId: 'leader-001', isActive: false }),
      ]);

      const res = await request(app)
        .post('/api/partner/auth/login')
        .send({ email: 'leader@test.com', password: 'Correct1!' });

      expect(res.status).toBe(403);
    });
  });

  // =================================================================
  // GET /api/partner/auth/me
  // =================================================================
  describe('GET /api/partner/auth/me', () => {
    it('returns 200 with user and team for valid token', async () => {
      const token = generateTestToken('leader-001');
      // The middleware uses the global mock
      mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
      mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);

      const res = await request(app)
        .get('/api/partner/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body).toHaveProperty('team');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/partner/auth/me');

      expect(res.status).toBe(401);
    });
  });

  // =================================================================
  // POST /api/partner/auth/change-password
  // =================================================================
  describe('POST /api/partner/auth/change-password', () => {
    it('returns 200 on successful password change', async () => {
      const token = generateTestToken('leader-001');
      mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
      mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);
      // The route handler calls ctx.storage.getUser and ctx.storage.updateUser
      ctxStorage.getUser.mockResolvedValue(leaderUser);
      ctxStorage.updateUser.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/partner/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Correct1!', newPassword: 'NewPass1!' });

      expect(res.status).toBe(200);
      expect(ctxStorage.updateUser).toHaveBeenCalled();
    });

    it('returns 401 when current password is wrong', async () => {
      const token = generateTestToken('leader-001');
      mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
      mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);
      ctxStorage.getUser.mockResolvedValue(leaderUser);

      const res = await request(app)
        .post('/api/partner/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongOld1!', newPassword: 'NewPass1!' });

      expect(res.status).toBe(401);
    });
  });
});
