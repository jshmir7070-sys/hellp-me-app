/**
 * Health API integration tests
 *
 * Validates that the health / meta endpoints respond correctly
 * and that the test infrastructure itself works end-to-end.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../setup';
import { registerHealthRoutes } from '../../server/routes/health.routes';

let app: Express;

beforeAll(async () => {
  const result = await createTestApp(registerHealthRoutes);
  app = result.app;
});

describe('Health API', () => {
  // ---------------------------------------------------------------
  // GET /api/health/pg
  // ---------------------------------------------------------------
  describe('GET /api/health/pg', () => {
    it('returns 200 with PG service info when configured', async () => {
      const res = await request(app).get('/api/health/pg');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'connected');
      expect(res.body).toHaveProperty('configured', true);
    });

    it('returns not_configured when PG service is not set up', async () => {
      const result = await createTestApp((ctx) => {
        ctx.pgService.getServiceInfo = () => ({ configured: false });
        registerHealthRoutes(ctx);
      });

      const res = await request(result.app).get('/api/health/pg');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('not_configured');
    });
  });

  // ---------------------------------------------------------------
  // GET /api/meta/routes
  // ---------------------------------------------------------------
  describe('GET /api/meta/routes', () => {
    it('returns 200 with route module list', async () => {
      const res = await request(app).get('/api/meta/routes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version', '2.0');
      expect(res.body.modules).toBeInstanceOf(Array);
      expect(res.body.modules.length).toBeGreaterThan(0);
      expect(res.body.modules[0]).toHaveProperty('name');
      expect(res.body.modules[0]).toHaveProperty('status', 'active');
    });
  });
});
