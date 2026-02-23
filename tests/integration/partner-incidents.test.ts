/**
 * Partner Incidents API integration tests
 *
 * Tests CRUD operations for incident reports managed by team leaders.
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

const token = generateTestToken('leader-001');

const member1 = createMockTeamMember({ id: 1, teamId: 10, helperId: 'helper-001', isActive: true });

const sampleIncident = {
  id: 1,
  teamId: 10,
  helperId: 'helper-001',
  orderId: null,
  incidentType: 'damage',
  description: 'Vehicle scratched during delivery',
  severity: 'medium',
  status: 'open',
  teamLeaderNote: null,
  resolvedAt: null,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
};

beforeAll(async () => {
  const { registerPartnerIncidentRoutes } = await import(
    '../../server/routes/partner/incidents.routes'
  );
  const result = await createTestApp(registerPartnerIncidentRoutes);
  app = result.app;
  storage = result.storage;
  db = result.db;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageForMiddleware.getUser.mockResolvedValue(leaderUser);
  mockStorageForMiddleware.getAllTeams.mockResolvedValue([activeTeam]);

  // Default db mock behavior
  db.offset.mockResolvedValue([sampleIncident]);
  db.then.mockImplementation((resolve: any) => resolve([{ count: 1 }]));
  db.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([sampleIncident]),
    }),
  });
  db.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...sampleIncident, status: 'resolved' }]),
      }),
    }),
  });
});

describe('Partner Incidents API', () => {
  // =================================================================
  // GET /api/partner/incidents
  // =================================================================
  describe('GET /api/partner/incidents', () => {
    it('returns paginated incident list with helper names (200)', async () => {
      storage.getUser.mockResolvedValue(
        createMockUser({ id: 'helper-001', name: 'Helper One' }),
      );

      const res = await request(app)
        .get('/api/partner/incidents?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('incidents');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('totalPages');
      // Enriched with helperName
      expect(res.body.incidents[0]).toHaveProperty('helperName');
    });
  });

  // =================================================================
  // POST /api/partner/incidents
  // =================================================================
  describe('POST /api/partner/incidents', () => {
    it('creates a new incident (201)', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);

      const res = await request(app)
        .post('/api/partner/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          helperId: 'helper-001',
          description: 'Vehicle scratched during delivery',
          incidentType: 'damage',
          severity: 'medium',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/partner/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({ helperId: '' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when helper is not a team member', async () => {
      storage.getTeamMembers.mockResolvedValue([member1]);

      const res = await request(app)
        .post('/api/partner/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          helperId: 'outsider-999',
          description: 'Some incident',
        });

      expect(res.status).toBe(400);
    });
  });

  // =================================================================
  // GET /api/partner/incidents/:id
  // =================================================================
  describe('GET /api/partner/incidents/:id', () => {
    it('returns incident detail with helper name (200)', async () => {
      db.then.mockImplementation((resolve: any) => resolve([sampleIncident]));
      storage.getUser.mockResolvedValue(
        createMockUser({ id: 'helper-001', name: 'Helper One' }),
      );

      const res = await request(app)
        .get('/api/partner/incidents/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('helperName', 'Helper One');
    });

    it('returns 404 when incident not found', async () => {
      db.then.mockImplementation((resolve: any) => resolve([]));

      const res = await request(app)
        .get('/api/partner/incidents/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =================================================================
  // PATCH /api/partner/incidents/:id
  // =================================================================
  describe('PATCH /api/partner/incidents/:id', () => {
    it('updates an incident (200)', async () => {
      db.then.mockImplementation((resolve: any) => resolve([sampleIncident]));

      const res = await request(app)
        .patch('/api/partner/incidents/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'resolved', teamLeaderNote: 'Resolved after review' });

      expect(res.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });
  });
});
