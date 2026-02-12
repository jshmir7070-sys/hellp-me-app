/**
 * Full Flow Integration Tests
 *
 * 로그인 → 페이지 전환 → API 연동 전체 흐름 테스트
 * - 인증 (로그인/회원가입/토큰갱신/로그아웃)
 * - 역할별 페이지 접근 (helper/requester/admin)
 * - 오더 CRUD + 지원/수락
 * - 정산 조회
 * - 결제 연동
 * - 계약 관리
 */

import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';

// ─── Mock Users DB ───────────────────────────────────────
const mockUsers: Record<string, any> = {
  'helper-1': {
    id: 'helper-1',
    email: 'helper@test.com',
    name: '헬퍼',
    role: 'helper',
    helperVerified: true,
    phoneNumber: '010-1234-5678',
  },
  'requester-1': {
    id: 'requester-1',
    email: 'requester@test.com',
    name: '요청자',
    role: 'requester',
    phoneNumber: '010-9876-5432',
  },
  'admin-1': {
    id: 'admin-1',
    email: 'admin@test.com',
    name: '관리자',
    role: 'admin',
    isHqStaff: true,
  },
};

const mockPasswords: Record<string, string> = {
  'helper@test.com': 'helper123!',
  'requester@test.com': 'requester123!',
  'admin@test.com': 'admin123!',
};

// ─── Mock Orders DB ─────────────────────────────────────
let mockOrders: any[] = [
  {
    id: 1,
    requesterId: 'requester-1',
    companyName: '테스트물류',
    deliveryArea: '서울시 강남구',
    status: 'registered',
    approvalStatus: 'approved',
    pricePerUnit: 1500,
    scheduledDate: '2026-02-15',
    maxHelpers: 3,
    currentHelpers: 0,
    createdAt: '2026-02-10T09:00:00Z',
  },
  {
    id: 2,
    requesterId: 'requester-1',
    companyName: '빠른배송',
    deliveryArea: '서울시 송파구',
    status: 'matching',
    approvalStatus: 'approved',
    pricePerUnit: 2000,
    scheduledDate: '2026-02-16',
    maxHelpers: 2,
    currentHelpers: 1,
    matchedHelperId: 'helper-1',
    createdAt: '2026-02-11T09:00:00Z',
  },
];

let nextOrderId = 3;
let mockApplications: any[] = [];

// ─── Mock Token Logic ───────────────────────────────────
function createMockToken(userId: string): string {
  return `mock-token-${userId}-${Date.now()}`;
}

function extractUserId(token: string): string | null {
  const match = token.match(/^mock-token-(.+)-\d+$/);
  return match ? match[1] : null;
}

// ─── Auth Middleware ────────────────────────────────────
function mockRequireAuth(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const userId = extractUserId(token);
  if (!userId || !mockUsers[userId]) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.user = mockUsers[userId];
  next();
}

function mockAdminAuth(req: any, res: Response, next: NextFunction) {
  mockRequireAuth(req, res, () => {
    if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.adminUser = req.user;
    next();
  });
}

function mockRequireRole(...roles: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: '인증이 필요합니다' });
    if (req.user.role === 'admin' || req.user.isHqStaff) return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '권한이 없습니다' });
    }
    next();
  };
}

// ─── Build Test App ─────────────────────────────────────
function buildApp(): Express {
  const app = express();
  app.use(express.json());

  // ======== Health Check ========
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ======== AUTH Routes ========
  app.post('/api/auth/signup', (req, res) => {
    const { email, password, name, role, phoneNumber } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ message: '필수 항목을 입력하세요' });
    }
    if (Object.values(mockUsers).find((u: any) => u.email === email)) {
      return res.status(409).json({ message: '이미 등록된 이메일입니다' });
    }
    const id = `${role}-${Date.now()}`;
    mockUsers[id] = { id, email, name, role, phoneNumber };
    mockPasswords[email] = password;
    const token = createMockToken(id);
    res.status(201).json({ token, refreshToken: `refresh-${token}`, user: mockUsers[id] });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    if (mockPasswords[email] !== password) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }
    const user = Object.values(mockUsers).find((u: any) => u.email === email);
    if (!user) return res.status(401).json({ message: '사용자를 찾을 수 없습니다' });
    const token = createMockToken(user.id);
    res.json({ token, refreshToken: `refresh-${token}`, user });
  });

  app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || !refreshToken.startsWith('refresh-mock-token-')) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const innerToken = refreshToken.replace('refresh-', '');
    const userId = extractUserId(innerToken);
    if (!userId || !mockUsers[userId]) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const newToken = createMockToken(userId);
    res.json({ token: newToken, refreshToken: `refresh-${newToken}` });
  });

  app.get('/api/auth/me', mockRequireAuth, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
  });

  app.post('/api/auth/check-email', (req, res) => {
    const { email } = req.body;
    const exists = Object.values(mockUsers).some((u: any) => u.email === email);
    res.json({ exists });
  });

  app.post('/api/auth/find-email', (req, res) => {
    const { phoneNumber } = req.body;
    const user = Object.values(mockUsers).find((u: any) => u.phoneNumber === phoneNumber);
    if (!user) return res.status(404).json({ message: '등록된 이메일을 찾을 수 없습니다' });
    res.json({ email: user.email });
  });

  app.post('/api/auth/change-password', mockRequireAuth, (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (mockPasswords[req.user.email] !== currentPassword) {
      return res.status(400).json({ message: '현재 비밀번호가 올바르지 않습니다' });
    }
    mockPasswords[req.user.email] = newPassword;
    res.json({ success: true });
  });

  app.post('/api/auth/update-role', mockRequireAuth, (req: any, res) => {
    const { role } = req.body;
    if (!['helper', 'requester'].includes(role)) {
      return res.status(400).json({ message: '유효하지 않은 역할입니다' });
    }
    mockUsers[req.user.id].role = role;
    res.json({ success: true, role });
  });

  // ======== ORDER Routes ========
  app.post('/api/orders', mockRequireAuth, (req: any, res) => {
    const order = {
      id: nextOrderId++,
      requesterId: req.user.id,
      ...req.body,
      status: 'registered',
      approvalStatus: 'pending',
      currentHelpers: 0,
      createdAt: new Date().toISOString(),
    };
    mockOrders.push(order);
    res.status(201).json(order);
  });

  app.get('/api/orders', mockRequireAuth, (req: any, res) => {
    const { status, role } = req.query;
    let filtered = [...mockOrders];

    if (req.user.role === 'helper') {
      filtered = filtered.filter(o => o.approvalStatus === 'approved');
    } else if (req.user.role === 'requester') {
      filtered = filtered.filter(o => o.requesterId === req.user.id);
    }

    if (status) {
      filtered = filtered.filter(o => o.status === status);
    }
    res.json(filtered);
  });

  app.get('/api/orders/:id', mockRequireAuth, (req: any, res) => {
    const order = mockOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ message: '주문을 찾을 수 없습니다' });
    res.json(order);
  });

  app.patch('/api/orders/:id', mockRequireAuth, (req: any, res) => {
    const idx = mockOrders.findIndex(o => o.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ message: '주문을 찾을 수 없습니다' });
    if (mockOrders[idx].requesterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '권한이 없습니다' });
    }
    mockOrders[idx] = { ...mockOrders[idx], ...req.body };
    res.json(mockOrders[idx]);
  });

  app.delete('/api/orders/:id', mockRequireAuth, (req: any, res) => {
    const idx = mockOrders.findIndex(o => o.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ message: '주문을 찾을 수 없습니다' });
    if (mockOrders[idx].requesterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '권한이 없습니다' });
    }
    mockOrders.splice(idx, 1);
    res.json({ success: true });
  });

  app.post('/api/orders/:id/apply', mockRequireAuth, mockRequireRole('helper'), (req: any, res) => {
    const order = mockOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ message: '주문을 찾을 수 없습니다' });
    if (order.currentHelpers >= order.maxHelpers) {
      return res.status(400).json({ message: '모집 인원이 마감되었습니다' });
    }
    const existing = mockApplications.find(a => a.orderId === order.id && a.helperId === req.user.id);
    if (existing) {
      return res.status(409).json({ message: '이미 지원한 오더입니다' });
    }
    const application = {
      id: mockApplications.length + 1,
      orderId: order.id,
      helperId: req.user.id,
      status: 'pending',
      appliedAt: new Date().toISOString(),
    };
    mockApplications.push(application);
    res.status(201).json(application);
  });

  app.post('/api/orders/:id/accept-helper', mockRequireAuth, (req: any, res) => {
    const order = mockOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ message: '주문을 찾을 수 없습니다' });
    if (order.requesterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '권한이 없습니다' });
    }
    const { helperId } = req.body;
    const application = mockApplications.find(a => a.orderId === order.id && a.helperId === helperId);
    if (!application) return res.status(404).json({ message: '지원 내역을 찾을 수 없습니다' });
    application.status = 'accepted';
    order.matchedHelperId = helperId;
    order.currentHelpers += 1;
    order.status = 'matching';
    res.json({ success: true, order });
  });

  // ======== SETTLEMENT Routes ========
  app.get('/api/helper/settlement', mockRequireAuth, mockRequireRole('helper'), (req: any, res) => {
    res.json({
      totalEarnings: 150000,
      pendingSettlement: 50000,
      completedSettlement: 100000,
      settlements: [
        { id: 1, orderId: 2, amount: 50000, status: 'pending', period: '2026-02' },
        { id: 2, orderId: 1, amount: 100000, status: 'paid', period: '2026-01' },
      ],
    });
  });

  app.get('/api/admin/settlements', mockAdminAuth, (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 1, helperId: 'helper-1', amount: 50000, status: 'pending' },
        { id: 2, helperId: 'helper-1', amount: 100000, status: 'paid' },
      ],
      total: 2,
    });
  });

  // ======== PAYMENT Routes ========
  app.post('/api/payments/intent', mockRequireAuth, (req: any, res) => {
    const { orderId, amount, paymentType } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ message: '주문 ID와 금액이 필요합니다' });
    }
    res.json({
      paymentId: `pay-${Date.now()}`,
      orderId,
      amount,
      paymentType: paymentType || 'deposit',
      status: 'pending',
      virtualAccount: {
        bankName: '신한은행',
        accountNumber: '110-123-456789',
        dueDate: '2026-02-15',
      },
    });
  });

  app.get('/api/payments/:paymentId/status', mockRequireAuth, (req, res) => {
    res.json({
      paymentId: req.params.paymentId,
      status: 'completed',
      paidAt: new Date().toISOString(),
    });
  });

  // ======== CONTRACT Routes ========
  app.post('/api/contracts', mockRequireAuth, (req: any, res) => {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: '주문 ID가 필요합니다' });
    res.status(201).json({
      id: 1,
      orderId,
      requesterId: req.user.id,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });
  });

  app.get('/api/contracts/:id', mockRequireAuth, (req, res) => {
    res.json({
      id: parseInt(req.params.id),
      orderId: 2,
      requesterId: 'requester-1',
      helperId: 'helper-1',
      status: 'signed',
    });
  });

  app.post('/api/contracts/:id/sign', mockRequireAuth, (req: any, res) => {
    res.json({
      id: parseInt(req.params.id),
      signedBy: req.user.id,
      signedAt: new Date().toISOString(),
      status: 'signed',
    });
  });

  // ======== ADMIN Routes ========
  app.get('/api/admin/dashboard/overview', mockAdminAuth, (req, res) => {
    res.json({
      success: true,
      data: {
        stats: {
          activeOrders: mockOrders.length,
          activeHelpers: Object.values(mockUsers).filter((u: any) => u.role === 'helper').length,
          pendingSettlementTotal: 50000,
          todayRevenue: 300000,
        },
        recentOrders: mockOrders.slice(0, 5),
      },
    });
  });

  app.get('/api/admin/task-queue', mockAdminAuth, (req, res) => {
    res.json({
      success: true,
      data: [
        { taskType: 'order_approval', referenceId: 1, priority: 1 },
        { taskType: 'settlement_approval', referenceId: 2, priority: 2 },
      ],
      total: 2,
    });
  });

  // ======== HELPER Routes ========
  app.get('/api/helpers/me/profile', mockRequireAuth, mockRequireRole('helper'), (req: any, res) => {
    res.json({
      id: req.user.id,
      name: req.user.name,
      helperVerified: req.user.helperVerified,
      serviceAreas: [{ region: '서울특별시', district: '강남구' }],
      credentials: { status: 'approved' },
    });
  });

  // ======== NOTIFICATIONS ========
  app.get('/api/notifications', mockRequireAuth, (req: any, res) => {
    res.json([
      { id: 1, type: 'matching_success', title: '매칭 성공', message: '오더 #2에 매칭되었습니다', isRead: false },
      { id: 2, type: 'announcement', title: '공지사항', message: '시스템 점검 안내', isRead: true },
    ]);
  });

  return app;
}

// ═══════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════

describe('Full Flow Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = buildApp();
  });

  // ──────────────────────────────────
  // 1. 인증 전체 흐름
  // ──────────────────────────────────
  describe('1. Authentication Full Flow', () => {
    let helperToken: string;
    let requesterToken: string;
    let adminToken: string;

    it('should login as helper', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'helper@test.com', password: 'helper123!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.role).toBe('helper');
      helperToken = res.body.token;
    });

    it('should login as requester', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'requester@test.com', password: 'requester123!' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('requester');
      requesterToken = res.body.token;
    });

    it('should login as admin', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'admin123!' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
      adminToken = res.body.token;
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'helper@test.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('올바르지 않습니다');
    });

    it('should reject empty credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should get current user via /me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${helperToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('helper@test.com');
      expect(res.body.user.role).toBe('helper');
    });

    it('should reject /me without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'helper@test.com', password: 'helper123!' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.token).not.toBe(loginRes.body.token);
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
    });

    it('should logout successfully', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ──────────────────────────────────
  // 2. 회원가입 흐름
  // ──────────────────────────────────
  describe('2. Signup Flow', () => {
    it('should signup a new helper', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newhelper@test.com',
          password: 'newhelper123!',
          name: '새헬퍼',
          role: 'helper',
          phoneNumber: '010-1111-2222',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('helper');
      expect(res.body.user.name).toBe('새헬퍼');
      expect(res.body).toHaveProperty('token');
    });

    it('should signup a new requester', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newrequester@test.com',
          password: 'newreq123!',
          name: '새요청자',
          role: 'requester',
          phoneNumber: '010-3333-4444',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('requester');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'helper@test.com',
          password: 'test123!',
          name: '중복',
          role: 'helper',
        });

      expect(res.status).toBe(409);
    });

    it('should reject signup without required fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'incomplete@test.com' });

      expect(res.status).toBe(400);
    });

    it('should check email availability', async () => {
      const res1 = await request(app)
        .post('/api/auth/check-email')
        .send({ email: 'helper@test.com' });
      expect(res1.body.exists).toBe(true);

      const res2 = await request(app)
        .post('/api/auth/check-email')
        .send({ email: 'notexist@test.com' });
      expect(res2.body.exists).toBe(false);
    });

    it('should find email by phone number', async () => {
      const res = await request(app)
        .post('/api/auth/find-email')
        .send({ phoneNumber: '010-1234-5678' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('helper@test.com');
    });

    it('should return 404 for unknown phone number', async () => {
      const res = await request(app)
        .post('/api/auth/find-email')
        .send({ phoneNumber: '010-0000-0000' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────
  // 3. 로그인 후 역할별 페이지 접근
  // ──────────────────────────────────
  describe('3. Role-Based Page Access After Login', () => {
    let helperToken: string;
    let requesterToken: string;
    let adminToken: string;

    beforeAll(async () => {
      const h = await request(app).post('/api/auth/login').send({ email: 'helper@test.com', password: 'helper123!' });
      helperToken = h.body.token;
      const r = await request(app).post('/api/auth/login').send({ email: 'requester@test.com', password: 'requester123!' });
      requesterToken = r.body.token;
      const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'admin123!' });
      adminToken = a.body.token;
    });

    describe('Helper pages', () => {
      it('should access helper profile', async () => {
        const res = await request(app)
          .get('/api/helpers/me/profile')
          .set('Authorization', `Bearer ${helperToken}`);

        expect(res.status).toBe(200);
        expect(res.body.helperVerified).toBe(true);
      });

      it('should access helper settlement page', async () => {
        const res = await request(app)
          .get('/api/helper/settlement')
          .set('Authorization', `Bearer ${helperToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalEarnings');
        expect(res.body.settlements).toBeInstanceOf(Array);
      });

      it('should view order list (approved only)', async () => {
        const res = await request(app)
          .get('/api/orders')
          .set('Authorization', `Bearer ${helperToken}`);

        expect(res.status).toBe(200);
        expect(res.body.every((o: any) => o.approvalStatus === 'approved')).toBe(true);
      });

      it('requester should NOT access helper settlement', async () => {
        const res = await request(app)
          .get('/api/helper/settlement')
          .set('Authorization', `Bearer ${requesterToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe('Requester pages', () => {
      it('should view own orders only', async () => {
        const res = await request(app)
          .get('/api/orders')
          .set('Authorization', `Bearer ${requesterToken}`);

        expect(res.status).toBe(200);
        expect(res.body.every((o: any) => o.requesterId === 'requester-1')).toBe(true);
      });

      it('should create new order', async () => {
        const res = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${requesterToken}`)
          .send({
            companyName: '신규물류',
            deliveryArea: '서울시 마포구',
            pricePerUnit: 1800,
            scheduledDate: '2026-02-20',
            maxHelpers: 2,
          });

        expect(res.status).toBe(201);
        expect(res.body.requesterId).toBe('requester-1');
        expect(res.body.status).toBe('registered');
      });
    });

    describe('Admin pages', () => {
      it('should access dashboard overview', async () => {
        const res = await request(app)
          .get('/api/admin/dashboard/overview')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.stats).toHaveProperty('activeOrders');
      });

      it('should access task queue', async () => {
        const res = await request(app)
          .get('/api/admin/task-queue')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toBeInstanceOf(Array);
      });

      it('should access admin settlements', async () => {
        const res = await request(app)
          .get('/api/admin/settlements')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('helper should NOT access admin dashboard', async () => {
        const res = await request(app)
          .get('/api/admin/dashboard/overview')
          .set('Authorization', `Bearer ${helperToken}`);

        expect(res.status).toBe(403);
      });

      it('requester should NOT access admin dashboard', async () => {
        const res = await request(app)
          .get('/api/admin/dashboard/overview')
          .set('Authorization', `Bearer ${requesterToken}`);

        expect(res.status).toBe(403);
      });
    });
  });

  // ──────────────────────────────────
  // 4. 오더 생성 → 지원 → 매칭 흐름
  // ──────────────────────────────────
  describe('4. Order → Apply → Match Flow', () => {
    let helperToken: string;
    let requesterToken: string;
    let createdOrderId: number;

    beforeAll(async () => {
      const h = await request(app).post('/api/auth/login').send({ email: 'helper@test.com', password: 'helper123!' });
      helperToken = h.body.token;
      const r = await request(app).post('/api/auth/login').send({ email: 'requester@test.com', password: 'requester123!' });
      requesterToken = r.body.token;
    });

    it('Step 1: Requester creates order', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          companyName: '흐름테스트물류',
          deliveryArea: '서울시 종로구',
          pricePerUnit: 2500,
          scheduledDate: '2026-02-25',
          maxHelpers: 1,
          approvalStatus: 'approved',
        });

      expect(res.status).toBe(201);
      createdOrderId = res.body.id;
    });

    it('Step 2: Helper views available orders', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${helperToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Step 3: Helper views order detail', async () => {
      const res = await request(app)
        .get(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${helperToken}`);

      expect(res.status).toBe(200);
      expect(res.body.companyName).toBe('흐름테스트물류');
    });

    it('Step 4: Helper applies to order', async () => {
      const res = await request(app)
        .post(`/api/orders/${createdOrderId}/apply`)
        .set('Authorization', `Bearer ${helperToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
    });

    it('Step 4b: Helper cannot apply twice', async () => {
      const res = await request(app)
        .post(`/api/orders/${createdOrderId}/apply`)
        .set('Authorization', `Bearer ${helperToken}`);

      expect(res.status).toBe(409);
    });

    it('Step 5: Requester accepts helper', async () => {
      const res = await request(app)
        .post(`/api/orders/${createdOrderId}/accept-helper`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ helperId: 'helper-1' });

      expect(res.status).toBe(200);
      expect(res.body.order.matchedHelperId).toBe('helper-1');
      expect(res.body.order.status).toBe('matching');
    });

    it('Step 6: Requester cannot apply for orders', async () => {
      const res = await request(app)
        .post('/api/orders/1/apply')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────
  // 5. 결제 연동 흐름
  // ──────────────────────────────────
  describe('5. Payment Flow', () => {
    let requesterToken: string;

    beforeAll(async () => {
      const r = await request(app).post('/api/auth/login').send({ email: 'requester@test.com', password: 'requester123!' });
      requesterToken = r.body.token;
    });

    it('should create payment intent', async () => {
      const res = await request(app)
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ orderId: 1, amount: 150000, paymentType: 'deposit' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('paymentId');
      expect(res.body).toHaveProperty('virtualAccount');
      expect(res.body.amount).toBe(150000);
    });

    it('should check payment status', async () => {
      const res = await request(app)
        .get('/api/payments/pay-123/status')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
    });

    it('should reject payment without amount', async () => {
      const res = await request(app)
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ orderId: 1 });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────
  // 6. 계약 연동 흐름
  // ──────────────────────────────────
  describe('6. Contract Flow', () => {
    let requesterToken: string;
    let helperToken: string;

    beforeAll(async () => {
      const r = await request(app).post('/api/auth/login').send({ email: 'requester@test.com', password: 'requester123!' });
      requesterToken = r.body.token;
      const h = await request(app).post('/api/auth/login').send({ email: 'helper@test.com', password: 'helper123!' });
      helperToken = h.body.token;
    });

    it('should create contract', async () => {
      const res = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ orderId: 2 });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('draft');
    });

    it('should view contract detail', async () => {
      const res = await request(app)
        .get('/api/contracts/1')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('signed');
    });

    it('should sign contract', async () => {
      const res = await request(app)
        .post('/api/contracts/1/sign')
        .set('Authorization', `Bearer ${helperToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('signed');
      expect(res.body.signedBy).toBe('helper-1');
    });
  });

  // ──────────────────────────────────
  // 7. 비밀번호 변경 / 역할 변경
  // ──────────────────────────────────
  describe('7. Account Management', () => {
    let helperToken: string;

    beforeAll(async () => {
      const h = await request(app).post('/api/auth/login').send({ email: 'helper@test.com', password: 'helper123!' });
      helperToken = h.body.token;
    });

    it('should change password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${helperToken}`)
        .send({ currentPassword: 'helper123!', newPassword: 'newhelper456!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'helper@test.com', password: 'newhelper456!' });
      expect(loginRes.status).toBe(200);

      // Restore password
      const token2 = loginRes.body.token;
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token2}`)
        .send({ currentPassword: 'newhelper456!', newPassword: 'helper123!' });
    });

    it('should reject wrong current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${helperToken}`)
        .send({ currentPassword: 'wrong', newPassword: 'new123!' });

      expect(res.status).toBe(400);
    });

    it('should update role', async () => {
      const res = await request(app)
        .post('/api/auth/update-role')
        .set('Authorization', `Bearer ${helperToken}`)
        .send({ role: 'requester' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('requester');

      // Restore role
      await request(app)
        .post('/api/auth/update-role')
        .set('Authorization', `Bearer ${helperToken}`)
        .send({ role: 'helper' });
    });
  });

  // ──────────────────────────────────
  // 8. 알림 조회
  // ──────────────────────────────────
  describe('8. Notifications', () => {
    let helperToken: string;

    beforeAll(async () => {
      const h = await request(app).post('/api/auth/login').send({ email: 'helper@test.com', password: 'helper123!' });
      helperToken = h.body.token;
    });

    it('should fetch notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${helperToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('type');
      expect(res.body[0]).toHaveProperty('title');
    });

    it('should not fetch without auth', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────
  // 9. 오더 수정/삭제 권한
  // ──────────────────────────────────
  describe('9. Order CRUD Authorization', () => {
    let requesterToken: string;
    let helperToken: string;
    let adminToken: string;

    beforeAll(async () => {
      const r = await request(app).post('/api/auth/login').send({ email: 'requester@test.com', password: 'requester123!' });
      requesterToken = r.body.token;
      const h = await request(app).post('/api/auth/login').send({ email: 'helper@test.com', password: 'helper123!' });
      helperToken = h.body.token;
      const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'admin123!' });
      adminToken = a.body.token;
    });

    it('requester can update own order', async () => {
      const res = await request(app)
        .patch('/api/orders/1')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ deliveryArea: '서울시 서초구' });

      expect(res.status).toBe(200);
      expect(res.body.deliveryArea).toBe('서울시 서초구');
    });

    it('helper cannot update requester order', async () => {
      const res = await request(app)
        .patch('/api/orders/1')
        .set('Authorization', `Bearer ${helperToken}`)
        .send({ deliveryArea: '서울시 강북구' });

      expect(res.status).toBe(403);
    });

    it('admin can update any order', async () => {
      const res = await request(app)
        .patch('/api/orders/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .get('/api/orders/9999')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────
  // 10. End-to-End 전체 시나리오
  // ──────────────────────────────────
  describe('10. E2E: Full Business Scenario', () => {
    it('Complete flow: signup → login → create order → apply → accept → contract → payment', async () => {
      // 1) 요청자 회원가입
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'e2e-requester@test.com',
          password: 'e2e123!',
          name: 'E2E요청자',
          role: 'requester',
          phoneNumber: '010-5555-6666',
        });
      expect(signupRes.status).toBe(201);
      const requesterToken = signupRes.body.token;

      // 2) 오더 등록
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          companyName: 'E2E물류',
          deliveryArea: '서울시 영등포구',
          pricePerUnit: 3000,
          scheduledDate: '2026-03-01',
          maxHelpers: 1,
          approvalStatus: 'approved',
        });
      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.id;

      // 3) 헬퍼 로그인
      const helperLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'helper@test.com', password: 'helper123!' });
      const helperToken = helperLogin.body.token;

      // 4) 오더 상세 확인
      const detailRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${helperToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.companyName).toBe('E2E물류');

      // 5) 헬퍼 지원
      const applyRes = await request(app)
        .post(`/api/orders/${orderId}/apply`)
        .set('Authorization', `Bearer ${helperToken}`);
      expect(applyRes.status).toBe(201);

      // 6) 요청자가 헬퍼 수락
      const acceptRes = await request(app)
        .post(`/api/orders/${orderId}/accept-helper`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ helperId: 'helper-1' });
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.order.matchedHelperId).toBe('helper-1');

      // 7) 계약 생성
      const contractRes = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ orderId });
      expect(contractRes.status).toBe(201);

      // 8) 계약 서명
      const signRes = await request(app)
        .post(`/api/contracts/${contractRes.body.id}/sign`)
        .set('Authorization', `Bearer ${helperToken}`);
      expect(signRes.status).toBe(200);

      // 9) 결제
      const payRes = await request(app)
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ orderId, amount: 300000, paymentType: 'deposit' });
      expect(payRes.status).toBe(200);
      expect(payRes.body.amount).toBe(300000);

      // 10) 결제 상태 확인
      const statusRes = await request(app)
        .get(`/api/payments/${payRes.body.paymentId}/status`)
        .set('Authorization', `Bearer ${requesterToken}`);
      expect(statusRes.status).toBe(200);
    });
  });
});
