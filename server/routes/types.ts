/**
 * 라우트 모듈 공통 타입 정의
 *
 * 각 라우트 모듈에서 사용하는 공유 타입, 유틸리티, 미들웨어 참조를
 * 중앙에서 관리합니다.
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";

/**
 * 라우트 모듈 등록 함수 시그니처
 * 각 도메인 라우트 파일은 이 함수를 export 합니다.
 */
export type RouteRegistrar = (ctx: RouteContext) => void | Promise<void>;

/**
 * 라우트 모듈에 전달되는 컨텍스트
 * 기존 routes.ts에서 사용하던 공유 의존성들을 모아놓은 객체
 */
export interface RouteContext {
  app: Express;
  httpServer: Server;

  // 인증 미들웨어
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  adminAuth: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (role: string) => (req: Request, res: Response, next: NextFunction) => void;
  requireOwner: (req: Request, res: Response, next: NextFunction) => void;
  requirePermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => void;
  requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => void;

  // 유효성 검사
  validateBody: (schema: any) => (req: Request, res: Response, next: NextFunction) => void;

  // Rate limiter
  authRateLimiter: any;
  signupRateLimiter: any;
  passwordResetRateLimiter: any;
  uploadRateLimiter: any;
  pushRateLimiter: any;
  strictRateLimiter: any;

  // 스토리지 & DB
  storage: any;
  db: any;

  // 유틸리티 함수
  logAdminAction: (params: any) => Promise<void>;
  logAuthEvent: (req: Request, eventType: string, status: string, options?: any) => Promise<void>;
  broadcastToAllAdmins: (eventType: string, action: string, entityId?: number | string, data?: any) => Promise<void>;
  notifyOrderHelpers: (orderId: number, eventType: string, status: string) => Promise<void>;
  broadcastNewOrderToHelpers: (orderData: any) => Promise<void>;
  sendFcmToUser: (userId: string, payload: any) => Promise<any>;
  sendExpoPushToUser: (userId: string, payload: any) => Promise<any>;
  sendPushToUser: (userId: string, payload: { title: string; body: string; url?: string; tag?: string }) => Promise<{ sent: number; failed: number }>;

  // 결제
  pgService: any;

  // PG 상태 매핑
  mapPGStatusToDBStatus: (status: string) => string;

  // 정산 계산
  calculateSettlement: any;
  calculateHelperPayout: any;
  parseClosingReport: any;

  // 오더 상태
  ORDER_STATUS: any;
  canTransitionSettlementStatus: any;
  canTransitionOrderStatus: any;
  validateOrderStatus: any;

  // 암호화
  encrypt: any;
  decrypt: any;
  hashForSearch: any;
  maskAccountNumber: any;

  // 공통 변수
  JWT_SECRET: string;
  objectStorageService: any;
  notificationWS: any;
  smsService: any;
  popbill: any;

  // 파일 업로드
  uploadVehicleImage: any;

  // 테이블 참조 (drizzle schema)
  tables: Record<string, any>;

  // SQL 헬퍼
  sql: any;
  eq: any;
  desc: any;
  and: any;
  or: any;
  inArray: any;
  not: any;
  isNull: any;
  gte: any;
  lte: any;

  // 체크 유틸
  checkIdempotency: any;
  storeIdempotencyResponse: any;
  getIdempotencyKeyFromRequest: any;

  // 기타
  getOrderDepositInfo: (orderId: number) => Promise<any>;
  getDepositRate: () => Promise<number>;
  getOrCreatePersonalCode: (userId: string) => Promise<string>;
}

/**
 * 관리자 요청 확장 타입
 */
export interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
  user?: {
    id: string;
    email: string;
    role: string;
  };
}
