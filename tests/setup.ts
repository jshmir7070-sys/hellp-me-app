/**
 * Shared test utilities for HelpMe platform integration tests.
 *
 * Provides factory functions for creating mock Express apps,
 * generating JWT tokens, and building mock domain objects.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { vi } from 'vitest';
import type { RouteContext } from '../server/routes/types';

const TEST_JWT_SECRET = 'test-secret';

// ---------------------------------------------------------------------------
// Mock DB  (chainable Drizzle-style query builder)
// ---------------------------------------------------------------------------

export function createMockDb(defaultResult: any[] = []) {
  let result = defaultResult;

  const chain: any = {
    _setResult(val: any[]) {
      result = val;
    },
    select: vi.fn().mockImplementation(() => chain),
    from: vi.fn().mockImplementation(() => chain),
    where: vi.fn().mockImplementation(() => chain),
    orderBy: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    offset: vi.fn().mockImplementation(() => Promise.resolve(result)),
    // When the chain is awaited directly (e.g. db.select().from().where())
    // Drizzle resolves via .then – simulate by making the chain thenable
    then: vi.fn().mockImplementation((resolve: any) => resolve(result)),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };

  return chain;
}

// ---------------------------------------------------------------------------
// Mock Tables  (column references for Drizzle eq/and/etc.)
// ---------------------------------------------------------------------------

export function createMockTables() {
  return {
    orders: {
      id: 'orders.id',
      matchedHelperId: 'orders.matchedHelperId',
      status: 'orders.status',
      createdAt: 'orders.created_at',
      scheduledDate: 'orders.scheduled_date',
    },
    teamCsInquiries: {
      id: 'teamCs.id',
      teamId: 'teamCs.team_id',
      status: 'teamCs.status',
      createdAt: 'teamCs.created_at',
      reporterId: 'teamCs.reporter_id',
    },
    teamIncidents: {
      id: 'incidents.id',
      teamId: 'incidents.team_id',
      status: 'incidents.status',
      createdAt: 'incidents.created_at',
      helperId: 'incidents.helper_id',
    },
    orderApplications: {
      id: 'oa.id',
      orderId: 'oa.order_id',
      helperId: 'oa.helper_id',
    },
    settlementStatements: {
      helperId: 'ss.helper_id',
      createdAt: 'ss.created_at',
      period: 'ss.period',
    },
    teamMembers: {
      id: 'tm.id',
      teamId: 'tm.team_id',
      helperId: 'tm.helper_id',
      isActive: 'tm.is_active',
    },
    teamIncentives: {
      teamId: 'ti.team_id',
      period: 'ti.period',
    },
    users: { id: 'users.id' },
    signupConsents: { userId: 'sc.user_id' },
    webhookLogs: { id: 'wl.id' },
  };
}

// ---------------------------------------------------------------------------
// Mock SQL helpers
// ---------------------------------------------------------------------------

export function createSqlHelpers() {
  return {
    eq: vi.fn((a: any, b: any) => ({ op: 'eq', a, b })),
    and: vi.fn((...args: any[]) => ({ op: 'and', args })),
    or: vi.fn((...args: any[]) => ({ op: 'or', args })),
    desc: vi.fn((col: any) => ({ op: 'desc', col })),
    inArray: vi.fn((col: any, vals: any[]) => ({ op: 'inArray', col, vals })),
    not: vi.fn((val: any) => ({ op: 'not', val })),
    isNull: vi.fn((col: any) => ({ op: 'isNull', col })),
    gte: vi.fn((col: any, val: any) => ({ op: 'gte', col, val })),
    lte: vi.fn((col: any, val: any) => ({ op: 'lte', col, val })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
      op: 'sql',
      raw: strings.join('?'),
      values,
    })),
  };
}

// ---------------------------------------------------------------------------
// Mock Storage
// ---------------------------------------------------------------------------

export function createMockStorage() {
  return {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getAllTeams: vi.fn().mockResolvedValue([]),
    getTeamMembers: vi.fn().mockResolvedValue([]),
    getOrder: vi.fn(),
    getOrders: vi.fn(),
    createOrder: vi.fn(),
    updateOrder: vi.fn(),
    getOrderApplications: vi.fn().mockResolvedValue([]),
    createOrderApplication: vi.fn(),
    getNotifications: vi.fn().mockResolvedValue([]),
    createNotification: vi.fn(),
    createRefreshToken: vi.fn(),
    getRefreshToken: vi.fn(),
    deleteRefreshToken: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// createTestApp  – main factory
// ---------------------------------------------------------------------------

export interface TestAppResult {
  app: Express;
  storage: ReturnType<typeof createMockStorage>;
  db: ReturnType<typeof createMockDb>;
  tables: ReturnType<typeof createMockTables>;
  ctx: RouteContext;
}

/**
 * Build a minimal Express app wired to a full mock RouteContext.
 *
 * @param routeRegistrar  - The route module's register function (e.g. registerHealthRoutes)
 */
export async function createTestApp(
  routeRegistrar: (ctx: RouteContext) => void | Promise<void>,
): Promise<TestAppResult> {
  const app = express();
  app.use(express.json());

  const storage = createMockStorage();
  const db = createMockDb();
  const tables = createMockTables();
  const helpers = createSqlHelpers();

  // Pass-through middleware stubs
  const passThrough = (_req: Request, _res: Response, next: NextFunction) => next();
  const passThroughFactory = (_arg: any) => passThrough;

  const ctx: RouteContext = {
    app,
    httpServer: {} as any,

    // Auth middleware (just pass through for unit/integration testing)
    requireAuth: passThrough,
    adminAuth: passThrough,
    requireRole: passThroughFactory,
    requireOwner: passThrough,
    requirePermission: passThroughFactory,
    requireSuperAdmin: passThrough,

    // Validation middleware
    validateBody: (schema: any) => (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (err: any) {
        res.status(400).json({ message: err.errors?.[0]?.message ?? 'Validation error' });
      }
    },

    // Rate limiters (pass through)
    authRateLimiter: passThrough,
    signupRateLimiter: passThrough,
    passwordResetRateLimiter: passThrough,
    uploadRateLimiter: passThrough,
    pushRateLimiter: passThrough,
    strictRateLimiter: passThrough,

    // Storage & DB
    storage,
    db,

    // Utility functions
    logAdminAction: vi.fn().mockResolvedValue(undefined),
    logAuthEvent: vi.fn().mockResolvedValue(undefined),
    broadcastToAllAdmins: vi.fn().mockResolvedValue(undefined),
    notifyOrderHelpers: vi.fn().mockResolvedValue(undefined),
    broadcastNewOrderToHelpers: vi.fn().mockResolvedValue(undefined),
    sendFcmToUser: vi.fn().mockResolvedValue(undefined),
    sendExpoPushToUser: vi.fn().mockResolvedValue(undefined),
    sendPushToUser: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),

    // Payment
    pgService: { getServiceInfo: vi.fn().mockReturnValue({ configured: true }) },

    // PG status mapping
    mapPGStatusToDBStatus: vi.fn((s: string) => s),

    // Settlement
    calculateSettlement: vi.fn(),
    calculateHelperPayout: vi.fn(),
    parseClosingReport: vi.fn(),

    // Order status
    ORDER_STATUS: {
      MATCHING: 'matching',
      SCHEDULED: 'scheduled',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
    },
    canTransitionSettlementStatus: vi.fn().mockReturnValue(true),
    canTransitionOrderStatus: vi.fn().mockReturnValue(true),
    validateOrderStatus: vi.fn().mockReturnValue(true),

    // Encryption
    encrypt: vi.fn((v: string) => `enc_${v}`),
    decrypt: vi.fn((v: string) => v.replace('enc_', '')),
    hashForSearch: vi.fn((v: string) => `hash_${v}`),
    maskAccountNumber: vi.fn((v: string) => '****' + v.slice(-4)),

    // Common
    JWT_SECRET: TEST_JWT_SECRET,
    objectStorageService: {},
    notificationWS: {},
    smsService: { send: vi.fn() },
    popbill: {},

    // Upload
    uploadVehicleImage: passThrough,

    // Tables
    tables,

    // SQL helpers
    ...helpers,

    // Idempotency
    checkIdempotency: vi.fn().mockResolvedValue(null),
    storeIdempotencyResponse: vi.fn().mockResolvedValue(undefined),
    getIdempotencyKeyFromRequest: vi.fn().mockReturnValue(null),

    // Misc
    getOrderDepositInfo: vi.fn().mockResolvedValue({}),
    getDepositRate: vi.fn().mockResolvedValue(0.1),
    getOrCreatePersonalCode: vi.fn().mockResolvedValue('PCODE-001'),
  };

  await routeRegistrar(ctx);

  return { app, storage, db, tables, ctx };
}

// ---------------------------------------------------------------------------
// Token helper
// ---------------------------------------------------------------------------

export function generateTestToken(userId: string, secret: string = TEST_JWT_SECRET): string {
  return jwt.sign({ userId }, secret, { expiresIn: '1h' });
}

// ---------------------------------------------------------------------------
// Mock domain objects
// ---------------------------------------------------------------------------

export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-001',
    email: 'test@example.com',
    username: 'test@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012', // bcrypt hash placeholder
    name: 'Test User',
    role: 'helper',
    phoneNumber: '010-1234-5678',
    address: 'Seoul, Korea',
    birthDate: '1990-01-01',
    isTeamLeader: false,
    helperVerified: false,
    onboardingStatus: 'pending',
    profileImageUrl: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockTeam(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    name: 'Test Team',
    leaderId: 'user-001',
    qrCodeToken: 'qr-token-abc',
    commissionRate: 10,
    businessType: 'general',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockOrder(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    requesterId: 'req-001',
    matchedHelperId: null,
    status: 'matching',
    serviceType: 'moving',
    description: 'Test order',
    address: 'Seoul',
    scheduledDate: new Date('2025-03-01'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    ...overrides,
  };
}

export function createMockTeamMember(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    teamId: 1,
    helperId: 'helper-001',
    isActive: true,
    joinedAt: new Date('2024-02-01'),
    ...overrides,
  };
}

export { TEST_JWT_SECRET };
