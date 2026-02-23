/**
 * Core Auth API integration tests
 *
 * Tests the main application signup and login endpoints from
 * server/routes/auth.routes.ts using the RouteContext factory.
 *
 * Because auth.routes.ts uses `api.auth.signup.input.parse()` which
 * has strict Zod validation (password complexity, agreements, etc.),
 * the tests provide fully valid input objects.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcrypt from 'bcrypt';
import {
  createTestApp,
  createMockUser,
  generateTestToken,
  TEST_JWT_SECRET,
} from '../setup';

// ---------------------------------------------------------------------------
// Module-level mocks
//
// auth.routes.ts imports @shared/schema and @shared/routes, plus
// server/utils/validation and server/constants/*. We let these resolve
// normally since they are pure modules without heavy side-effects.
// ---------------------------------------------------------------------------

// We don't need to mock storage/jwt at module level for core auth routes
// because they receive everything via the RouteContext (ctx).

let app: Express;
let storage: any;
let db: any;

const hashedPassword = bcrypt.hashSync('Test123!@', 10);

const existingUser = createMockUser({
  id: 'user-existing',
  email: 'exists@test.com',
  password: hashedPassword,
  role: 'requester',
});

const validSignupBody = {
  email: 'new@test.com',
  password: 'Test123!@',
  name: 'New User',
  role: 'requester',
  agreements: {
    terms: true,
    privacy: true,
    location: true,
    payment: true,
    liability: true,
    electronic: true,
  },
};

beforeAll(async () => {
  const { registerAuthRoutes } = await import(
    '../../server/routes/auth.routes'
  );
  const result = await createTestApp(registerAuthRoutes);
  app = result.app;
  storage = result.storage;
  db = result.db;

  // db.insert for signupConsents - make it silently succeed
  db.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
});

beforeEach(() => {
  vi.clearAllMocks();

  // Re-configure default db insert mock
  db.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
});

describe('Core Auth API', () => {
  // =================================================================
  // POST /api/auth/signup
  // =================================================================
  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns 201 with token', async () => {
      storage.getUserByEmail.mockResolvedValue(null);
      storage.createUser.mockResolvedValue(
        createMockUser({
          id: 'new-user-001',
          email: 'new@test.com',
          name: 'New User',
          role: 'requester',
        }),
      );
      storage.createRefreshToken.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/auth/signup')
        .send(validSignupBody);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('returns 400 when email already exists', async () => {
      storage.getUserByEmail.mockResolvedValue(existingUser);

      const res = await request(app)
        .post('/api/auth/signup')
        .send(validSignupBody);

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid input (missing agreements)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'bad@test.com',
          password: 'short',
          name: 'X',
          role: 'requester',
          agreements: { terms: false },
        });

      expect(res.status).toBe(400);
    });
  });

  // =================================================================
  // POST /api/auth/login
  // =================================================================
  describe('POST /api/auth/login', () => {
    it('returns 200 with token on successful login', async () => {
      storage.getUserByEmail.mockResolvedValue(existingUser);
      storage.createRefreshToken.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'exists@test.com', password: 'Test123!@' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('returns 401 when password is wrong', async () => {
      storage.getUserByEmail.mockResolvedValue(existingUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'exists@test.com', password: 'WrongPass1!' });

      expect(res.status).toBe(401);
    });

    it('returns 404 when user does not exist', async () => {
      storage.getUserByEmail.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'Any1!' });

      expect(res.status).toBe(404);
    });
  });
});
