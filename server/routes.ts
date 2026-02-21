import type { Express, Request } from "express";
import type { Server } from "http";
import { randomUUID, randomBytes, createHmac } from "crypto";
import { storage, db } from "./storage";
import { api } from "@shared/routes";
import { insertCarrierRateItemSchema, insertAdminBankAccountSchema, insertCustomerServiceInquirySchema, updateCustomerServiceInquirySchema, userLocationLogs, userLocationLatest, teamIncentives, incentiveDetails, requesterRefundAccounts, insertRequesterRefundAccountSchema, SettlementStatement, authAuditLogs, insertDestinationPricingSchema, insertColdChainSettingSchema, destinationRegions, timeSlots, regionPricingRules, vatSettings, minimumGuaranteeRules, minimumGuaranteeApplications, settlementAuditLogs, settlementPayoutAttempts, orderForceStatusLogs, manualDispatchLogs, proofUploadFailures, orders, settlementStatements, settlementLineItems, helperBankAccounts, carrierMinRates, pricingTables, pricingTableRows, identityVerifications, documentReviewTasks, orderStatusEvents, smsTemplates, smsLogs, webhookLogs, integrationHealth, systemEvents, refunds, supportTicketEscalations, closingReports, contracts, incidentReports, incidentEvidence, incidentActions, auditLogs, orderStartTokens, integrationEvents, users, orderApplications, closingFieldSettings, carrierPricingPolicies, urgentFeePolicies, platformFeePolicies, extraCostCatalog, orderPolicySnapshots, settlementRecords, customerServiceInquiries, refundPolicies, insertRefundPolicySchema, customerInquiries, inquiryComments, ticketEscalations, pushNotificationLogs, deductions, disputes, signupConsents, termsVersions, termsReConsents } from "@shared/schema";
import { sql, eq, desc, and, or, inArray, not, isNull, gte, lte } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { notificationWS } from "./websocket";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { smsService } from "./sms-service";
import { requireAuth, adminAuth, AuthenticatedRequest, requireRole, requireOwner } from "./utils/auth-middleware";
import { isValidImageBuffer, sanitizeFilename, MAX_FILE_SIZE } from "./utils/file-validation";
import { canTransitionSettlementStatus, logAdminAction, canTransitionOrderStatus, validateOrderStatus } from "./utils/admin-audit";
import { helperDocuments } from "@shared/schema";
import { calculateSettlement, calculateHelperPayout, parseClosingReport } from "./lib/settlement-calculator";
import {
  ORDER_STATUS,
  CAN_APPLY_STATUSES,
  CAN_SELECT_HELPER_STATUSES,
  CAN_SUBMIT_CLOSING_STATUSES,
  CAN_APPROVE_CLOSING_STATUSES,
  CAN_CONFIRM_BALANCE_STATUSES,
  CAN_REVIEW_STATUSES,
  CANNOT_EDIT_STATUSES,
  CANNOT_DELETE_STATUSES,
  COMPLETED_STATUSES,
  IN_PROGRESS_STATUSES,
  normalizeOrderStatus,
  isOneOfStatus,
} from "./constants/order-status";
import { checkIdempotency, storeIdempotencyResponse, getIdempotencyKeyFromRequest } from "./utils/idempotency";
import { validateBody, authSchemas, clientErrorSchema } from "./utils/validation";
import { authRateLimiter, signupRateLimiter, passwordResetRateLimiter, uploadRateLimiter, pushRateLimiter, strictRateLimiter } from "./utils/rate-limiter";
import { DEFAULT_COURIERS } from "./constants/defaultCouriers";
import { encrypt, decrypt, hashForSearch, maskAccountNumber } from "./utils/encryption";
import { popbill } from "./lib/popbill";
import { pgService, mapPGStatusToDBStatus } from "./lib/pg-service";
import { registerModularRoutes } from "./routes/index";

// ============================================
// OAuth Redirect URI 환경변수 (배포/개발 환경별 명시 설정)
// ============================================
const OAUTH_BASE_URL = process.env.OAUTH_BASE_URL || "";

// ============================================
// 인증 감사 로그 헬퍼 함수
// ============================================
type AuthEventType = 
  | "login" | "login_failed" | "logout"
  | "signup" | "signup_failed"
  | "social_login" | "social_login_failed" | "social_signup"
  | "identity_verification" | "identity_verification_failed"
  | "password_change" | "password_reset";

async function logAuthEvent(
  req: Request,
  eventType: AuthEventType,
  status: "success" | "failure" | "pending",
  options: {
    userId?: string | null;
    provider?: string;
    metadata?: Record<string, any>;
  } = {}
) {
  try {
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() 
      || req.socket.remoteAddress 
      || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const requestId = (req as any).requestId || randomUUID().slice(0, 8);

    await db.insert(authAuditLogs).values({
      userId: options.userId || null,
      eventType,
      provider: options.provider || null,
      status,
      ipAddress,
      userAgent,
      requestId,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });
  } catch (err: any) {
    console.error("[AuthAudit] Failed to log event:", err);
  }
}


// ============================================
// 계약금 비율 조회 (관리자 설정값 사용)
// ============================================
async function getDepositRate(): Promise<number> {
  try {
    const settings = await storage.getAllSystemSettings();
    const depositSetting = settings.find(s => s.settingKey === 'deposit_rate');
    const rate = depositSetting ? parseInt(depositSetting.settingValue) : 10;
    return (isNaN(rate) || rate <= 0) ? 10 : rate;
  } catch {
    return 10; // 기본값 10%
  }
}

// ============================================
// 계약금 정보 조회 (SSOT - Single Source of Truth)
// ============================================
interface DepositInfo {
  depositAmount: number;
  paymentStatus: 'paid' | 'unpaid';
}

async function getOrderDepositInfo(orderId: number): Promise<DepositInfo> {
  console.log('[DepositInfo] Calculating for order:', orderId);
  
  // 1. contracts 테이블에서 확정된 계약금 조회
  const [existingContract] = await db.select()
    .from(contracts)
    .where(eq(contracts.orderId, orderId))
    .limit(1);
  
  if (existingContract && existingContract.depositAmount) {
    console.log('[DepositInfo] Found contract deposit:', existingContract.depositAmount);
    return {
      depositAmount: Number(existingContract.depositAmount),
      paymentStatus: 'paid'
    };
  }
  
  // 2. 계약 없으면 오더 정보로 예상 계약금 계산
  const [order] = await db.select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  
  if (!order) {
    console.log('[DepositInfo] Order not found');
    return { depositAmount: 0, paymentStatus: 'unpaid' };
  }
  
  const pricePerUnit = Number(order.pricePerUnit) || 0;
  const quantity = parseInt(String(order.averageQuantity || "0").replace(/[^0-9]/g, "")) || 0;
  console.log('[DepositInfo] pricePerUnit:', pricePerUnit, 'quantity:', quantity);
  const supplyAmount = pricePerUnit * quantity;
  const totalAmountWithVat = Math.round(supplyAmount * 1.1);
  const rate = await getDepositRate();
  const depositAmount = Math.round(totalAmountWithVat * (rate / 100));
  console.log('[DepositInfo] Calculated deposit:', depositAmount, 'rate:', rate + '%');
  
  // order.paymentStatus가 deposit_confirmed이면 결제완료로 처리
  const isPaid = order.paymentStatus === 'deposit_confirmed' || order.paymentStatus === 'paid';
  return { depositAmount, paymentStatus: isPaid ? 'paid' : 'unpaid' };
}

// ============================================
// 개인식별 코드 생성 (12자리 영문+숫자, 암호학적 안전)
// ============================================
function generatePersonalCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 방지: I,O,0,1 제외
  const bytes = randomBytes(12); // 암호학적 안전한 난수 사용
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

async function getOrCreatePersonalCode(userId: string): Promise<string> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  
  if (user.personalCode) {
    return user.personalCode;
  }
  
  // 새 코드 생성 (중복 및 유니크 제약조건 충돌 처리)
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generatePersonalCode();
    try {
      // 먼저 중복 검사
      const existing = await storage.getUserByPersonalCode(code);
      if (existing) continue;
      
      // DB 업데이트 시도 (유니크 제약조건으로 atomic 처리)
      await storage.updateUser(userId, { personalCode: code });
      return code;
    } catch (err: any) {
      // 유니크 제약조건 위반 시 재시도 (23505 = unique_violation)
      if (err?.code === "23505" && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
  
  throw new Error("Failed to generate unique personal code after max attempts");
}

const uploadDir = path.join(process.cwd(), "uploads", "vehicles");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const vehicleImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadVehicleImage = multer({
  storage: vehicleImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, png, webp)"));
    }
  },
});

// JWT 시크릿 설정 - 운영 환경에서는 반드시 환경변수로 설정 필요
const isProduction = process.env.NODE_ENV === "production";
if (!process.env.JWT_SECRET) {
  if (isProduction) {
    throw new Error("[SECURITY] JWT_SECRET must be set in production environment!");
  }
  // 개발환경: auth-middleware와 동일한 랜덤 시크릿 공유
  if (!(globalThis as any).__JWT_SECRET_DEV) {
    const { randomBytes: rb } = require("crypto");
    (globalThis as any).__JWT_SECRET_DEV = rb(32).toString("hex");
    console.warn("[AUTH] JWT_SECRET not set in routes. Using auto-generated dev secret.");
  }
}
const JWT_SECRET = process.env.JWT_SECRET || (globalThis as any).__JWT_SECRET_DEV;

// Helper function to broadcast updates to all connected admin users
async function broadcastToAllAdmins(eventType: string, action: string, entityId?: number | string, data?: any) {
  try {
    const result = await db.execute(sql`SELECT id FROM users WHERE is_hq_staff = true OR is_team_leader = true`);
    const adminUserIds = (result.rows || []).map((r: any) => r.id);
    
    if (adminUserIds.length > 0) {
      notificationWS.broadcastToAdmins(adminUserIds, {
        type: eventType,
        action,
        entityId,
        data,
      });
    }
  } catch (e) {
    console.error("Failed to broadcast to admins:", e);
  }
}

// Helper function to notify all helpers on an order
async function notifyOrderHelpers(orderId: number, eventType: string, status: string) {
  try {
    const applications = await storage.getOrderApplications(orderId);
    const approvedApps = applications.filter(a => a.status === "approved" || a.status === "matched");
    
    for (const app of approvedApps) {
      notificationWS.sendOrderStatusUpdate(app.helperId, {
        orderId,
        status,
      });
    }
  } catch (e) {
    console.error("Failed to notify order helpers:", e);
  }
}

// Broadcast new order to all active helpers (for real-time job list updates)
async function broadcastNewOrderToHelpers(orderData: {
  orderId: number;
  courierCompany?: string;
  deliveryArea?: string;
  scheduledDate?: string;
}) {
  try {
    const result = await db.execute(sql`SELECT id FROM users WHERE role = 'helper' AND status = 'active'`);
    const helperUserIds = (result.rows || []).map((r: any) => r.id);

    if (helperUserIds.length > 0) {
      notificationWS.broadcastNewOrderToHelpers(helperUserIds, orderData);
    }
  } catch (e) {
    console.error("Failed to broadcast new order to helpers:", e);
  }
}

// Seed master data for app/admin compatibility
async function seedMasterData() {
  // 앱 기본 택배사 목록 (DEFAULT_COURIERS 기반)
  const couriers = DEFAULT_COURIERS.map(name => ({
    courierName: name,
    minDeliveryFee: 0,
    commissionRate: 0,
    isDefault: name === "기타",
  }));

  // 5개 차종
  const vehicleTypes = [
    { vehicleTypeName: "1톤 하이탑", sortOrder: 1 },
    { vehicleTypeName: "1톤 정탑", sortOrder: 2 },
    { vehicleTypeName: "1톤 저탑", sortOrder: 3 },
    { vehicleTypeName: "1톤 냉탑", sortOrder: 4 },
    { vehicleTypeName: "무관", sortOrder: 5, isDefault: true },
  ];

  // 4개 카테고리
  const categories = [
    { categoryName: "택배사", sortOrder: 1 },
    { categoryName: "기타택배", sortOrder: 2 },
    { categoryName: "냉잡전용", sortOrder: 3 },
    { categoryName: "채용공고", sortOrder: 4, isAdminOnly: true },
  ];

  // Seed couriers
  for (const courier of couriers) {
    const existing = await storage.getCourierSettingByName(courier.courierName);
    if (!existing) {
      await storage.createCourierSetting(courier as any);
      console.log(`Seeded courier: ${courier.courierName}`);
    }
  }

  // Seed vehicle types
  for (const vt of vehicleTypes) {
    const existing = await storage.getVehicleTypeSettingByName(vt.vehicleTypeName);
    if (!existing) {
      await storage.createVehicleTypeSetting(vt);
      console.log(`Seeded vehicle type: ${vt.vehicleTypeName}`);
    }
  }

  // Seed categories
  for (const cat of categories) {
    const existing = await storage.getOrderCategorySettingByName(cat.categoryName);
    if (!existing) {
      await storage.createOrderCategorySetting(cat);
      console.log(`Seeded category: ${cat.categoryName}`);
    }
  }
}

// Helper function to send FCM push notifications to native devices
async function sendFcmToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    const allTokens = await storage.getFcmTokensByUser(userId);
    // Filter out Expo Push Tokens (handled by sendExpoPushToUser)
    const fcmTokens = allTokens.filter(t => !t.token.startsWith('ExponentPushToken['));
    if (fcmTokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const firebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!firebaseConfig) {
      console.log("[FCM] Firebase service account not configured");
      return { sent: 0, failed: 0 };
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(firebaseConfig);
    } catch {
      console.error("[FCM] Invalid Firebase service account JSON");
      return { sent: 0, failed: 0 };
    }

    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });

    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.error("[FCM] Failed to get access token");
      return { sent: 0, failed: 0 };
    }

    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    let failed = 0;

    for (const tokenRecord of fcmTokens) {
      try {
        const message = {
          message: {
            token: tokenRecord.token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: {
              url: payload.url || "/",
              tag: payload.tag || "notification-" + Date.now(),
            },
            android: {
              priority: "high" as const,
              notification: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                channel_id: "default",
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
          },
        };

        const response = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });

        if (response.ok) {
          sent++;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error("[FCM] Send error:", errorData);
          failed++;
          
          // Remove invalid tokens
          if (response.status === 404 || response.status === 410 || 
              (errorData as any)?.error?.details?.some((d: any) => 
                d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT")) {
            await storage.deleteFcmToken(tokenRecord.token);
          }
        }
      } catch (err: any) {
        console.error("[FCM] Token send error:", err.message);
        failed++;
      }
    }

    console.log(`[FCM] Sent to user ${userId}: ${sent} success, ${failed} failed`);
    return { sent, failed };
  } catch (err: any) {
    console.error("[FCM] sendFcmToUser error:", err);
    return { sent: 0, failed: 0 };
  }
}
// Send push notification via Expo Push API (for Expo Push Tokens)
async function sendExpoPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    const fcmTokens = await storage.getFcmTokensByUser(userId);
    // Filter for Expo Push Tokens (format: ExponentPushToken[xxx])
    const expoTokens = fcmTokens.filter(t => t.token.startsWith('ExponentPushToken['));
    
    if (expoTokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const messages = expoTokens.map(tokenRecord => ({
      to: tokenRecord.token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: { url: payload.url || '/', tag: payload.tag || 'notification-' + Date.now() },
    }));

    // Send via Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error('[Expo Push] API error:', await response.text());
      return { sent: 0, failed: expoTokens.length };
    }

    const result: any = await response.json();
    let sent = 0;
    let failed = 0;

    // Handle response tickets
    if (result.data && Array.isArray(result.data)) {
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          // Remove invalid tokens
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await storage.deleteFcmToken(expoTokens[i].token);
          }
        }
      }
    }

    console.log(`[Expo Push] Sent to user ${userId}: ${sent} success, ${failed} failed`);
    return { sent, failed };
  } catch (err: any) {
    console.error('[Expo Push] Error:', err);
    return { sent: 0, failed: 0 };
  }
}


// Helper function to send web push notifications to a user (includes both Web Push and FCM)
async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  // Send to Web Push, FCM, and Expo Push in parallel
  const [webResult, fcmResult, expoResult] = await Promise.all([
    sendWebPushToUser(userId, payload),
    sendFcmToUser(userId, payload),
    sendExpoPushToUser(userId, payload),
  ]);

  const totalSent = webResult.sent + fcmResult.sent + expoResult.sent;
  const totalFailed = webResult.failed + fcmResult.failed + expoResult.failed;
  
  if (totalSent > 0 || totalFailed > 0) {
    console.log(`[Push] Total sent to user ${userId}: ${totalSent} success, ${totalFailed} failed (Web: ${webResult.sent}, FCM: ${fcmResult.sent})`);
  }
  
  return { sent: totalSent, failed: totalFailed };
}

// Send push notifications to all admin/HQ staff users
async function sendPushToAdmins(payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    const admins = await storage.getAdminAndHQStaffUsers();
    const results = await Promise.all(
      admins.map(admin => sendPushToUser(admin.id, payload))
    );
    const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    console.log(`[Push] Sent to ${admins.length} admins: ${totalSent} success, ${totalFailed} failed`);
    return { sent: totalSent, failed: totalFailed };
  } catch (error) {
    console.error('[Push] Error sending to admins:', error);
    return { sent: 0, failed: 0 };
  }
}

// Helper function to send web push notifications via VAPID
async function sendWebPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    const subscriptions = await storage.getPushSubscriptionsByUser(userId);
    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const webpush = await import("web-push");
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[WebPush] VAPID keys not configured");
      return { sent: 0, failed: 0 };
    }

    webpush.setVapidDetails(
      "mailto:admin@hellpme.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      tag: payload.tag || "notification-" + Date.now(),
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint!,
            keys: { p256dh: sub.p256dh!, auth: sub.auth! },
          },
          pushPayload
        );
        sent++;
      } catch (err: any) {
        console.error("[WebPush] Send error:", err.message);
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          await storage.deletePushSubscription(sub.id);
        }
      }
    }

    return { sent, failed };
  } catch (err: any) {
    console.error("[WebPush] sendWebPushToUser error:", err);
    return { sent: 0, failed: 0 };
  }
}

// Seed RBAC roles, permissions, and role-permission mappings
async function seedRbacData() {
  console.log("Verifying RBAC data...");
  
  const existingRoles = await storage.getAllAdminRoles();
  const existingPerms = await storage.getAllAdminPermissions();
  const existingRoleMap = Object.fromEntries(existingRoles.map(r => [r.code, r.id]));
  const existingPermMap = Object.fromEntries(existingPerms.map(p => [p.key, p.id]));
  
  // 7 Roles
  const roles = [
    { code: "SUPER_ADMIN", name: "최고관리자", description: "모든 권한을 가진 최고 관리자", level: 100, isActive: true },
    { code: "ADMIN", name: "관리자", description: "대부분의 관리 권한을 가진 관리자", level: 80, isActive: true },
    { code: "MANAGER", name: "매니저", description: "운영 관리 권한을 가진 매니저", level: 60, isActive: true },
    { code: "FINANCE", name: "재무담당", description: "정산 및 결제 관련 권한", level: 50, isActive: true },
    { code: "TEAM_LEAD", name: "팀장", description: "팀 관리 권한", level: 40, isActive: true },
    { code: "CS", name: "고객지원", description: "고객 지원 및 문의 처리 권한", level: 30, isActive: true },
    { code: "STAFF", name: "일반직원", description: "기본 조회 권한만 가진 직원", level: 10, isActive: true },
  ];

  const createdRoles: Record<string, number> = {};
  let rolesCreated = 0;
  for (const role of roles) {
    if (existingRoleMap[role.code]) {
      createdRoles[role.code] = existingRoleMap[role.code];
    } else {
      const created = await storage.createAdminRole(role);
      createdRoles[role.code] = created.id;
      rolesCreated++;
      console.log(`Created role: ${role.code}`);
    }
  }

  // 62 Permissions across 13 domains
  const permissionDefs = [
    // Orders
    { key: "orders.view", domain: "orders", resource: "orders", action: "view", description: "오더 목록 및 상세 조회" },
    { key: "orders.create", domain: "orders", resource: "orders", action: "create", description: "새 오더 생성" },
    { key: "orders.edit", domain: "orders", resource: "orders", action: "edit", description: "오더 정보 수정" },
    { key: "orders.delete", domain: "orders", resource: "orders", action: "delete", description: "오더 삭제" },
    { key: "orders.assign", domain: "orders", resource: "orders", action: "assign", description: "헬퍼에게 오더 배정" },
    { key: "orders.force_override", domain: "orders", resource: "orders", action: "force_override", description: "오더 상태 강제 변경 (상태 머신 우회)" },
    { key: "orders.manage", domain: "orders", resource: "orders", action: "manage", description: "오더 관리" },
    // Enterprise
    { key: "enterprise.view", domain: "enterprise", resource: "enterprise", action: "view", description: "본사 계약 업체 및 오더 조회" },
    { key: "enterprise.create", domain: "enterprise", resource: "enterprise", action: "create", description: "본사 계약 업체 생성" },
    { key: "enterprise.edit", domain: "enterprise", resource: "enterprise", action: "edit", description: "본사 계약 정보 수정" },
    { key: "enterprise.upload", domain: "enterprise", resource: "enterprise", action: "upload", description: "CSV 오더 일괄 업로드" },
    // Dispatch
    { key: "dispatch.view", domain: "dispatch", resource: "dispatch", action: "view", description: "대행배차 신청 목록 조회" },
    { key: "dispatch.assign", domain: "dispatch", resource: "dispatch", action: "assign", description: "헬퍼 배정" },
    { key: "dispatch.edit", domain: "dispatch", resource: "dispatch", action: "edit", description: "배차 정보 수정" },
    // Matching
    { key: "matching.view", domain: "matching", resource: "matching", action: "view", description: "오더-헬퍼 매칭 현황 조회" },
    { key: "matching.assign", domain: "matching", resource: "matching", action: "assign", description: "수동 매칭 배정" },
    // Contracts
    { key: "contracts.view", domain: "contracts", resource: "contracts", action: "view", description: "계약 목록 및 상세 조회" },
    { key: "contracts.edit", domain: "contracts", resource: "contracts", action: "edit", description: "계약 정보 수정" },
    { key: "contracts.execute", domain: "contracts", resource: "contracts", action: "execute", description: "계약 법적 효력 발생" },
    // Payments
    { key: "payments.view", domain: "payments", resource: "payments", action: "view", description: "결제 내역 조회" },
    { key: "payments.refund", domain: "payments", resource: "payments", action: "refund", description: "결제 환불 처리" },
    { key: "payments.capture", domain: "payments", resource: "payments", action: "capture", description: "결제 확정 처리" },
    { key: "payments.create", domain: "payments", resource: "payments", action: "create", description: "결제 생성" },
    { key: "payments.edit", domain: "payments", resource: "payments", action: "edit", description: "결제 정보 수정" },
    // Settlements
    { key: "settlements.view", domain: "settlements", resource: "settlements", action: "view", description: "정산 내역 조회" },
    { key: "settlements.create", domain: "settlements", resource: "settlements", action: "create", description: "정산서 생성" },
    { key: "settlements.approve", domain: "settlements", resource: "settlements", action: "approve", description: "정산 승인" },
    { key: "settlements.pay", domain: "settlements", resource: "settlements", action: "pay", description: "정산 지급 처리" },
    { key: "settlements.edit", domain: "settlements", resource: "settlements", action: "edit", description: "정산 정보 수정" },
    { key: "settlements.confirm", domain: "settlements", resource: "settlements", action: "confirm", description: "정산 확정" },
    { key: "settlements.manage", domain: "settlements", resource: "settlements", action: "manage", description: "정산 관리" },
    // Incentives
    { key: "incentives.view", domain: "incentives", resource: "incentives", action: "view", description: "팀장 인센티브 조회" },
    { key: "incentives.calc", domain: "incentives", resource: "incentives", action: "calc", description: "인센티브 계산 실행" },
    { key: "incentives.approve", domain: "incentives", resource: "incentives", action: "approve", description: "인센티브 지급 승인" },
    { key: "incentives.pay", domain: "incentives", resource: "incentives", action: "pay", description: "인센티브 지급 처리" },
    // Disputes
    { key: "disputes.view", domain: "disputes", resource: "disputes", action: "view", description: "분쟁/사고 내역 조회" },
    { key: "disputes.review", domain: "disputes", resource: "disputes", action: "review", description: "분쟁 검토 시작" },
    { key: "disputes.resolve", domain: "disputes", resource: "disputes", action: "resolve", description: "분쟁 해결 처리" },
    { key: "disputes.escalate", domain: "disputes", resource: "disputes", action: "escalate", description: "상위자에게 분쟁 회부" },
    { key: "disputes.edit", domain: "disputes", resource: "disputes", action: "edit", description: "분쟁 정보 수정" },
    // Sanctions
    { key: "sanctions.view", domain: "sanctions", resource: "sanctions", action: "view", description: "제재/블랙리스트 조회" },
    { key: "sanctions.create", domain: "sanctions", resource: "sanctions", action: "create", description: "제재 부과" },
    { key: "sanctions.edit", domain: "sanctions", resource: "sanctions", action: "edit", description: "제재 정보 수정" },
    { key: "sanctions.delete", domain: "sanctions", resource: "sanctions", action: "delete", description: "제재 해제" },
    // Helpers
    { key: "helpers.view", domain: "helpers", resource: "helpers", action: "view", description: "헬퍼 목록 및 상세 조회" },
    { key: "helpers.edit", domain: "helpers", resource: "helpers", action: "edit", description: "헬퍼 정보 수정" },
    { key: "helpers.verify", domain: "helpers", resource: "helpers", action: "verify", description: "헬퍼 자격 심사" },
    { key: "helpers.manage", domain: "helpers", resource: "helpers", action: "manage", description: "헬퍼 관리" },
    // Requesters
    { key: "requesters.view", domain: "requesters", resource: "requesters", action: "view", description: "요청자 목록 및 상세 조회" },
    { key: "requesters.edit", domain: "requesters", resource: "requesters", action: "edit", description: "요청자 정보 수정" },
    // Users
    { key: "users.view", domain: "users", resource: "users", action: "view", description: "사용자 목록 조회" },
    { key: "users.edit", domain: "users", resource: "users", action: "edit", description: "사용자 정보 수정" },
    // Teams
    { key: "teams.view", domain: "teams", resource: "teams", action: "view", description: "팀 목록 및 상세 조회" },
    { key: "teams.create", domain: "teams", resource: "teams", action: "create", description: "새 팀 생성" },
    { key: "teams.edit", domain: "teams", resource: "teams", action: "edit", description: "팀 정보 수정" },
    { key: "teams.qr", domain: "teams", resource: "teams", action: "qr", description: "팀 QR 코드 관리" },
    { key: "teams.delete", domain: "teams", resource: "teams", action: "delete", description: "팀 삭제" },
    // Carriers
    { key: "carriers.view", domain: "carriers", resource: "carriers", action: "view", description: "운송사 및 최저요금 조회" },
    { key: "carriers.edit", domain: "carriers", resource: "carriers", action: "edit", description: "운송사 정보 및 요금 수정" },
    // Pricing
    { key: "pricing.view", domain: "pricing", resource: "pricing", action: "view", description: "요금 설정 조회" },
    { key: "pricing.edit", domain: "pricing", resource: "pricing", action: "edit", description: "요금 설정 변경" },
    // Policies
    { key: "policies.view", domain: "policies", resource: "policies", action: "view", description: "정책 설정 조회" },
    { key: "policies.edit", domain: "policies", resource: "policies", action: "edit", description: "정책 설정 변경" },
    // Tax
    { key: "tax.view", domain: "tax", resource: "tax", action: "view", description: "세금계산서 조회" },
    { key: "tax.issue", domain: "tax", resource: "tax", action: "issue", description: "정발행 처리" },
    { key: "tax.reverse", domain: "tax", resource: "tax", action: "reverse", description: "역발행 처리" },
    { key: "tax.cancel", domain: "tax", resource: "tax", action: "cancel", description: "세금계산서 취소" },
    // Staff
    { key: "staff.view", domain: "staff", resource: "staff", action: "view", description: "본사 직원 조회" },
    { key: "staff.create", domain: "staff", resource: "staff", action: "create", description: "본사 직원 추가" },
    { key: "staff.edit", domain: "staff", resource: "staff", action: "edit", description: "직원 정보 수정" },
    { key: "staff.roles", domain: "staff", resource: "staff", action: "roles", description: "역할 및 권한 관리" },
    // Notifications
    { key: "notifications.view", domain: "notifications", resource: "notifications", action: "view", description: "알림 템플릿 및 내역 조회" },
    { key: "notifications.send", domain: "notifications", resource: "notifications", action: "send", description: "알림 발송" },
    { key: "notifications.edit", domain: "notifications", resource: "notifications", action: "edit", description: "알림 템플릿 수정" },
    // Support
    { key: "support.view", domain: "support", resource: "support", action: "view", description: "고객지원 조회" },
    { key: "support.edit", domain: "support", resource: "support", action: "edit", description: "고객지원 처리" },
    // Settings
    { key: "settings.view", domain: "settings", resource: "settings", action: "view", description: "시스템 설정 조회" },
    { key: "settings.edit", domain: "settings", resource: "settings", action: "edit", description: "시스템 설정 변경" },
  ];

  const createdPermissions: Record<string, number> = {};
  let permsCreated = 0;
  for (const perm of permissionDefs) {
    if (existingPermMap[perm.key]) {
      createdPermissions[perm.key] = existingPermMap[perm.key];
    } else {
      const created = await storage.createAdminPermission({
        key: perm.key,
        domain: perm.domain,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        isActive: true,
      });
      createdPermissions[perm.key] = created.id;
      permsCreated++;
      console.log(`Created permission: ${perm.key}`);
    }
  }

  // Role-Permission Mappings (derived from canonical permissionDefs)
  const canonicalPermKeys = permissionDefs.map(p => p.key);
  // Dangerous permissions that bypass normal workflows - only SUPER_ADMIN gets these
  const dangerousPerms = ["orders.force_override"];
  const roleMappings: Record<string, string[]> = {
    SUPER_ADMIN: canonicalPermKeys, // All 63 permissions
    ADMIN: canonicalPermKeys.filter(k => k !== "staff.roles" && !dangerousPerms.includes(k)),
    MANAGER: canonicalPermKeys.filter(k => 
      ["orders", "enterprise", "dispatch", "matching", "contracts", "helpers", "requesters", "teams"].some(d => k.startsWith(d + ".")) &&
      !dangerousPerms.includes(k)
    ),
    FINANCE: canonicalPermKeys.filter(k => 
      ["payments", "settlements", "incentives", "tax", "contracts"].some(d => k.startsWith(d + "."))
    ),
    TEAM_LEAD: canonicalPermKeys.filter(k => 
      (["teams", "helpers", "orders", "dispatch"].some(d => k.startsWith(d + "."))) && 
      ["view", "edit", "assign"].some(a => k.endsWith("." + a))
    ),
    CS: canonicalPermKeys.filter(k => 
      (["orders", "helpers", "requesters", "disputes", "notifications"].some(d => k.startsWith(d + "."))) && 
      ["view", "review", "send"].some(a => k.endsWith("." + a))
    ),
    STAFF: canonicalPermKeys.filter(k => k.endsWith(".view")),
  };

  // Build canonical 203 role-permission pairs (fail if IDs missing)
  const expectedMappingPairs: Array<{roleId: number, permId: number, roleCode: string, permKey: string}> = [];
  const missingIds: string[] = [];
  for (const [roleCode, permKeys] of Object.entries(roleMappings)) {
    const roleId = createdRoles[roleCode];
    if (!roleId) {
      missingIds.push(`role:${roleCode}`);
      continue;
    }
    for (const permKey of permKeys) {
      const permId = createdPermissions[permKey];
      if (!permId) {
        missingIds.push(`perm:${permKey}`);
        continue;
      }
      expectedMappingPairs.push({ roleId, permId, roleCode, permKey });
    }
  }
  if (missingIds.length > 0) {
    throw new Error(`RBAC FATAL: Cannot seed - missing IDs for ${missingIds.slice(0, 10).join(", ")}${missingIds.length > 10 ? "..." : ""}`);
  }

  // Always reconcile role-permission mappings (idempotent upsert)
  let mappingsCreated = 0;
  let mappingErrors = 0;
  for (const { roleId, permId, roleCode, permKey } of expectedMappingPairs) {
    try {
      await storage.assignPermissionToRole(roleId, permId);
      mappingsCreated++;
    } catch (err: any) {
      // Ignore duplicate constraint errors (PostgreSQL 23505, SQLite/Prisma variants)
      const isDuplicate = err?.code === "23505" || 
        err?.code === "P2002" || 
        err?.message?.includes("duplicate") || 
        err?.message?.includes("UNIQUE constraint");
      if (!isDuplicate) {
        mappingErrors++;
        console.error(`Failed to assign permission ${permKey} to role ${roleCode}: ${err?.message || err}`);
      }
    }
  }

  // Verification: check exact role codes, permission keys, and mapping count
  const finalRoles = await storage.getAllAdminRoles();
  const finalPerms = await storage.getAllAdminPermissions();
  const finalRoleCodes = new Set(finalRoles.map(r => r.code));
  const finalPermKeys = new Set(finalPerms.map(p => p.key));
  
  const expectedRoleCodes = ["SUPER_ADMIN", "ADMIN", "MANAGER", "FINANCE", "TEAM_LEAD", "CS", "STAFF"];
  const canonicalRoleSet = new Set(expectedRoleCodes);
  const canonicalPermSet = new Set(canonicalPermKeys);
  
  const missingRoles = expectedRoleCodes.filter(c => !finalRoleCodes.has(c));
  const missingPerms = permissionDefs.filter(p => !finalPermKeys.has(p.key)).map(p => p.key);
  
  // Handle extra roles and permissions (not in canonical set)
  // Production: only warn, do not delete (to protect custom roles)
  // Development: delete for clean state
  let extraRolesDeleted = 0;
  let extraPermsDeleted = 0;
  const isProduction = process.env.NODE_ENV === "production";
  
  for (const role of finalRoles) {
    if (!canonicalRoleSet.has(role.code)) {
      if (isProduction) {
        console.warn(`[RBAC] Extra role found (not deleted in production): ${role.code}`);
      } else {
        await storage.deleteAdminRole(role.id);
        extraRolesDeleted++;
        console.log(`Deleted extra role: ${role.code}`);
      }
    }
  }
  for (const perm of finalPerms) {
    if (!canonicalPermSet.has(perm.key)) {
      if (isProduction) {
        console.warn(`[RBAC] Extra permission found (not deleted in production): ${perm.key}`);
      } else {
        await storage.deleteAdminPermission(perm.id);
        extraPermsDeleted++;
        console.log(`Deleted extra permission: ${perm.key}`);
      }
    }
  }
  
  // Skip exhaustive O(R*P) verification in development for fast startup
  const isDev = process.env.NODE_ENV === "development";
  
  let missingMappings = 0;
  let surplusMappings = 0;
  const canonicalSet = new Set(expectedMappingPairs.map(p => `${p.roleId}:${p.permId}`));
  
  if (!isDev) {
    // Production: full mapping verification
    for (const { roleId, permId } of expectedMappingPairs) {
      const rolePerms = await storage.getRolePermissions(roleId);
      if (!rolePerms.some(p => p.id === permId)) {
        missingMappings++;
      }
    }
    
    // Remove surplus mappings from ALL roles
    const reloadedRoles = await storage.getAllAdminRoles();
    for (const role of reloadedRoles) {
      const rolePerms = await storage.getRolePermissions((role as any).roleId || role.id);
      for (const perm of rolePerms) {
        if (!canonicalSet.has(`${role.id}:${perm.id}`)) {
          try {
            await storage.removePermissionFromRole(role.id, perm.id);
            surplusMappings++;
          } catch (err: any) {
            console.error(`Failed to remove surplus mapping: ${err?.message}`);
          }
        }
      }
    }
  }
  
  const errors: string[] = [];
  if (missingRoles.length > 0) errors.push(`missing roles: [${missingRoles.join(", ")}]`);
  if (missingPerms.length > 0) errors.push(`missing perms: [${missingPerms.slice(0, 5).join(", ")}${missingPerms.length > 5 ? "..." : ""}]`);
  if (mappingErrors > 0) errors.push(`mapping errors: ${mappingErrors}`);
  if (!isDev && missingMappings > 0) errors.push(`missing mappings: ${missingMappings}`);
  
  if (errors.length > 0) {
    throw new Error(`RBAC FATAL: verification failed - ${errors.join(", ")}`);
  }
  
  const healingNotes: string[] = [];
  if (extraRolesDeleted > 0) healingNotes.push(`${extraRolesDeleted} extra roles`);
  if (extraPermsDeleted > 0) healingNotes.push(`${extraPermsDeleted} extra perms`);
  if (surplusMappings > 0) healingNotes.push(`${surplusMappings} surplus mappings`);
  const healingNote = healingNotes.length > 0 ? ` (removed: ${healingNotes.join(", ")})` : "";
  console.log(`RBAC verified: 7 roles, 63 permissions, 203 mappings OK${isDev ? " (dev mode)" : ""}${healingNote}`);
}

// Ensure admin user exists (runs in ALL environments including production)
async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.warn("ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD 환경변수 미설정 — 관리자 시드 건너뜀");
    return;
  }
  let adminUser = await storage.getUserByEmail(adminEmail);
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  
  if (!adminUser) {
    adminUser = await storage.createUser({
      username: adminEmail,
      email: adminEmail,
      name: "최고관리자",
      password: hashedAdminPassword,
      role: "superadmin",
      isHqStaff: true,
      adminStatus: "active",
      mustChangePassword: false,
    });
    console.log(`Created superadmin user: ${adminEmail}`);
  } else {
    // Update existing admin user password, role, and ensure admin status
    await storage.updateUser(adminUser.id, {
      password: hashedAdminPassword,
      role: "superadmin",
      isHqStaff: true,
      adminStatus: "active",
      mustChangePassword: false,
    });
    console.log(`Updated superadmin user: ${adminEmail}`);
  }
}

// Seed test users and contracts
async function seedTestUsers() {
  const testUsers = [
    { email: "testhelper@test.com", name: "테스트 헬퍼", password: "Password1!", role: "helper", phoneNumber: "010-1234-5678" },
    { email: "testhelper2@test.com", name: "김배송", password: "Password1!", role: "helper", phoneNumber: "010-2345-6789" },
    { email: "testrequester@test.com", name: "테스트 사용자", password: "Password1!", role: "requester", phoneNumber: "010-3456-7890" },
    { email: "testrequester2@test.com", name: "박의뢰", password: "Password1!", role: "requester", phoneNumber: "010-4567-8901" },
  ];

  const createdUsers: Record<string, any> = {};

  for (const user of testUsers) {
    let existing = await storage.getUserByEmail(user.email);
    if (!existing) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      existing = await storage.createUser({
        username: user.email,
        email: user.email,
        name: user.name,
        password: hashedPassword,
        role: user.role,
        phoneNumber: user.phoneNumber,
      });
      console.log(`Created test user: ${user.email}`);
    }
    createdUsers[user.email] = existing;
  }
  
  // Seed test orders and contracts for settlement testing
  const existingOrders = await storage.getOrders();
  if (existingOrders.length === 0) {
    const helper1 = createdUsers["testhelper@test.com"];
    const helper2 = createdUsers["testhelper2@test.com"];
    const requester1 = createdUsers["testrequester@test.com"];
    const requester2 = createdUsers["testrequester2@test.com"];
    
    if (helper1 && requester1) {
      // Create test orders
      const order1 = await storage.createOrder({
        requesterId: requester1.id,
        companyName: "쿠팡 주간배송",
        pricePerUnit: 1200,
        averageQuantity: "400box",
        deliveryArea: "서울시 강남구",
        scheduledDate: "2024-12-20",
        vehicleType: "1톤 저탑",
        status: "scheduled",
        maxHelpers: 1,
        currentHelpers: 1,
      });
      
      const order2 = await storage.createOrder({
        requesterId: requester1.id,
        companyName: "CJ대한통운",
        pricePerUnit: 1500,
        averageQuantity: "300box",
        deliveryArea: "서울시 서초구",
        scheduledDate: "2024-12-22",
        vehicleType: "1톤 하이탑",
        status: "scheduled",
        maxHelpers: 1,
        currentHelpers: 1,
      });
      
      const order3 = await storage.createOrder({
        requesterId: requester2?.id || requester1.id,
        companyName: "한진택배",
        pricePerUnit: 1100,
        averageQuantity: "500box",
        deliveryArea: "서울시 마포구",
        scheduledDate: "2024-12-25",
        vehicleType: "1톤 정탑",
        status: "scheduled",
        maxHelpers: 1,
        currentHelpers: 1,
      });
      
      // Create test contracts with various payment states
      // Contract 1: Fully paid (for helper1)
      await storage.createContract({
        orderId: order1.id,
        helperId: helper1.id,
        requesterId: requester1.id,
        totalAmount: 480000,
        depositAmount: 96000,
        balanceAmount: 384000,
        depositPaid: true,
        downPaymentStatus: "paid",
        balancePaid: true,
        balanceDueDate: "2024-12-20",
        status: "completed",
      });
      
      // Contract 2: Only deposit paid (for helper1) - balance overdue
      await storage.createContract({
        orderId: order2.id,
        helperId: helper1.id,
        requesterId: requester1.id,
        totalAmount: 450000,
        depositAmount: 90000,
        balanceAmount: 360000,
        depositPaid: true,
        downPaymentStatus: "paid",
        balancePaid: false,
        balanceDueDate: "2024-12-15",
        status: "deposit_paid",
      });
      
      // Contract 3: For helper2
      await storage.createContract({
        orderId: order3.id,
        helperId: helper2?.id || helper1.id,
        requesterId: requester2?.id || requester1.id,
        totalAmount: 550000,
        depositAmount: 110000,
        balanceAmount: 440000,
        depositPaid: true,
        downPaymentStatus: "paid",
        balancePaid: false,
        balanceDueDate: "2024-12-28",
        status: "deposit_paid",
      });
      
      console.log("Created test orders and contracts for settlement testing");
    }
  }
  
  // Seed helper bank accounts for settlement display
  const existingBankAccounts = await storage.getAllHelperBankAccounts();
  if (existingBankAccounts.length === 0) {
    const helper1 = createdUsers["testhelper@test.com"];
    const helper2 = createdUsers["testhelper2@test.com"];
    
    if (helper1) {
      await storage.createHelperBankAccount(helper1.id, {
        accountHolder: "테스트 헬퍼",
        bankName: "국민은행",
        accountNumber: "123-456-789012",
      });
    }
    if (helper2) {
      await storage.createHelperBankAccount(helper2.id, {
        accountHolder: "김배송",
        bankName: "신한은행",
        accountNumber: "987-654-321098",
      });
    }
    console.log("Created test helper bank accounts");
  }
}

// Seed closing reports, settlements, and dispute-ready data for testing
async function seedClosingAndSettlementData() {
  // Check if we already have closing data
  const existingClosings = await db.select({ id: closingReports.id }).from(closingReports).limit(1);
  if (existingClosings.length > 0) {
    console.log("Closing/settlement seed data already exists, skipping...");
    return;
  }

  // Find test users
  const helper1 = await storage.getUserByEmail("testhelper@test.com");
  const helper2 = await storage.getUserByEmail("testhelper2@test.com");
  const requester1 = await storage.getUserByEmail("testrequester@test.com");
  const requester2 = await storage.getUserByEmail("testrequester2@test.com");

  if (!helper1 || !requester1) {
    console.log("Test users not found, skipping closing/settlement seed");
    return;
  }

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-indexed

  // Create orders in various statuses for the current month
  const orderDates = [
    { day: 3, company: "CJ대한통운", area: "서울시 강남구 역삼동", status: "settled", price: 1400, qty: "300box", vehicle: "1톤 하이탑" },
    { day: 7, company: "롯데택배", area: "서울시 서초구 반포동", status: "settled", price: 1200, qty: "250box", vehicle: "1톤 저탑" },
    { day: 10, company: "한진택배", area: "경기도 성남시 분당구", status: "closing_submitted", price: 1500, qty: "400box", vehicle: "1톤 하이탑" },
    { day: 14, company: "쿠팡 로켓배송", area: "서울시 송파구 잠실동", status: "settled", price: 1300, qty: "350box", vehicle: "1톤 정탑" },
    { day: 17, company: "CJ대한통운", area: "경기도 고양시 일산", status: "closing_submitted", price: 1400, qty: "280box", vehicle: "1톤 하이탑" },
    { day: 20, company: "롯데택배", area: "서울시 마포구 상암동", status: "in_progress", price: 1100, qty: "200box", vehicle: "1톤 저탑" },
  ];

  const createdOrders: any[] = [];

  for (const od of orderDates) {
    const scheduledDate = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}-${String(od.day).padStart(2, "0")}`;
    const order = await storage.createOrder({
      requesterId: requester1.id,
      companyName: od.company,
      pricePerUnit: od.price,
      averageQuantity: od.qty,
      deliveryArea: od.area,
      scheduledDate,
      vehicleType: od.vehicle,
      status: od.status,
      maxHelpers: 1,
      currentHelpers: 1,
    });

    // Set matchedHelperId
    await db.update(orders).set({ matchedHelperId: helper1.id, matchedAt: new Date() }).where(eq(orders.id, order.id));

    createdOrders.push({ ...order, scheduledDate, ...od });
  }

  // Also create orders for helper2
  const helper2Order = await storage.createOrder({
    requesterId: requester2?.id || requester1.id,
    companyName: "한진택배",
    pricePerUnit: 1300,
    averageQuantity: "320box",
    deliveryArea: "서울시 강서구 마곡동",
    scheduledDate: `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}-12`,
    vehicleType: "1톤 정탑",
    status: "settled",
    maxHelpers: 1,
    currentHelpers: 1,
  });
  if (helper2) {
    await db.update(orders).set({ matchedHelperId: helper2.id, matchedAt: new Date() }).where(eq(orders.id, helper2Order.id));
  }

  console.log(`Created ${createdOrders.length + 1} test orders for closing/settlement`);

  // Create contracts for each order
  for (let i = 0; i < createdOrders.length; i++) {
    const od = createdOrders[i];
    const totalAmount = od.price * parseInt(od.qty);
    await storage.createContract({
      orderId: od.id,
      helperId: helper1.id,
      requesterId: requester1.id,
      totalAmount,
      depositAmount: Math.round(totalAmount * 0.2),
      balanceAmount: Math.round(totalAmount * 0.8),
      depositPaid: true,
      downPaymentStatus: "paid",
      balancePaid: od.status === "settled",
      balanceDueDate: od.scheduledDate,
      status: od.status === "settled" ? "completed" : "deposit_paid",
    });
  }

  // Create contracts for helper2 order
  if (helper2) {
    await storage.createContract({
      orderId: helper2Order.id,
      helperId: helper2.id,
      requesterId: requester2?.id || requester1.id,
      totalAmount: 416000,
      depositAmount: 83200,
      balanceAmount: 332800,
      depositPaid: true,
      downPaymentStatus: "paid",
      balancePaid: true,
      balanceDueDate: `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}-12`,
      status: "completed",
    });
  }

  console.log("Created test contracts");

  // Create closing reports for orders that are closing_submitted or settled
  const closingData = [
    { orderIdx: 0, delivered: 285, returned: 15, status: "approved" },
    { orderIdx: 1, delivered: 240, returned: 10, status: "approved" },
    { orderIdx: 2, delivered: 380, returned: 20, status: "submitted" },
    { orderIdx: 3, delivered: 330, returned: 20, status: "approved" },
    { orderIdx: 4, delivered: 260, returned: 20, status: "submitted" },
  ];

  const createdClosings: any[] = [];

  for (const cd of closingData) {
    const od = createdOrders[cd.orderIdx];
    const deliveredAmount = cd.delivered * od.price;
    const supplyAmount = Math.round(deliveredAmount / 1.1);
    const vatAmount = deliveredAmount - supplyAmount;
    const platformFee = Math.round(deliveredAmount * 0.05);
    const netAmount = deliveredAmount - platformFee;

    const [closing] = await db.insert(closingReports).values({
      orderId: od.id,
      helperId: helper1.id,
      deliveredCount: cd.delivered,
      returnedCount: cd.returned,
      status: cd.status,
      calculatedAmount: deliveredAmount,
      supplyAmount,
      vatAmount,
      totalAmount: deliveredAmount,
      platformFeeRate: 5,
      platformFee,
      netAmount,
      deliveryHistoryImagesJson: JSON.stringify(["/uploads/sample-delivery-history.jpg"]),
      memo: `테스트 마감 데이터 - ${od.company}`,
    }).returning();

    createdClosings.push({ closing, orderData: od, closingData: cd });
  }

  // Also create closing for helper2
  if (helper2) {
    await db.insert(closingReports).values({
      orderId: helper2Order.id,
      helperId: helper2.id,
      deliveredCount: 300,
      returnedCount: 20,
      status: "approved",
      calculatedAmount: 390000,
      supplyAmount: 354545,
      vatAmount: 35455,
      totalAmount: 390000,
      platformFeeRate: 5,
      platformFee: 19500,
      netAmount: 370500,
      deliveryHistoryImagesJson: JSON.stringify(["/uploads/sample-delivery-history.jpg"]),
      memo: "테스트 마감 데이터 - 한진택배",
    });
  }

  console.log(`Created ${createdClosings.length + 1} closing reports`);

  // Create settlement statements for approved closings
  const settledClosings = createdClosings.filter(c => c.closingData.status === "approved");
  const createdSettlements: any[] = [];

  for (const sc of settledClosings) {
    const od = sc.orderData;
    const cl = sc.closing;

    const statement = await storage.createSettlementStatement({
      orderId: od.id,
      helperId: helper1.id,
      requesterId: requester1.id,
      workDate: od.scheduledDate,
      deliveryCount: cl.deliveredCount,
      returnCount: cl.returnedCount,
      basePay: cl.calculatedAmount,
      additionalPay: 0,
      penalty: 0,
      deduction: 0,
      commissionRate: 5,
      commissionAmount: cl.platformFee,
      platformCommission: cl.platformFee,
      supplyAmount: cl.supplyAmount,
      vatAmount: cl.vatAmount,
      totalAmount: cl.totalAmount,
      netAmount: cl.netAmount,
      status: "confirmed",
      helperConfirmed: true,
      helperConfirmedAt: new Date(),
    });

    createdSettlements.push(statement);

    // Create line items
    await storage.createSettlementLineItem({
      statementId: statement.id,
      itemType: "delivery",
      itemName: "배송 수수료",
      quantity: cl.deliveredCount,
      unitPrice: od.price,
      amount: cl.calculatedAmount,
    });

    await storage.createSettlementLineItem({
      statementId: statement.id,
      itemType: "platform_fee",
      itemName: "플랫폼 수수료",
      quantity: 1,
      unitPrice: cl.platformFee,
      amount: -cl.platformFee,
      notes: "5% 플랫폼 수수료",
    });
  }

  // Helper2 settlement
  if (helper2) {
    const h2Statement = await storage.createSettlementStatement({
      orderId: helper2Order.id,
      helperId: helper2.id,
      requesterId: requester2?.id || requester1.id,
      workDate: `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}-12`,
      deliveryCount: 300,
      returnCount: 20,
      basePay: 390000,
      additionalPay: 0,
      penalty: 0,
      deduction: 0,
      commissionRate: 5,
      commissionAmount: 19500,
      platformCommission: 19500,
      supplyAmount: 354545,
      vatAmount: 35455,
      totalAmount: 390000,
      netAmount: 370500,
      status: "confirmed",
      helperConfirmed: true,
      helperConfirmedAt: new Date(),
    });

    await storage.createSettlementLineItem({
      statementId: h2Statement.id,
      itemType: "delivery",
      itemName: "배송 수수료",
      quantity: 300,
      unitPrice: 1300,
      amount: 390000,
    });
  }

  console.log(`Created ${createdSettlements.length + 1} settlement statements with line items`);

  // Create a sample dispute for testing
  if (createdSettlements.length > 0) {
    const disputeSettlement = createdSettlements[0];
    await storage.createDispute({
      helperId: helper1.id,
      submitterRole: "helper",
      settlementId: disputeSettlement.id,
      orderId: disputeSettlement.orderId,
      workDate: disputeSettlement.workDate || createdOrders[0].scheduledDate,
      disputeType: "count_mismatch",
      description: "배송 수량이 실제와 다릅니다. 실제로는 290건을 배송했으나 285건으로 집계되었습니다.",
      requestedDeliveryCount: 290,
      status: "pending",
    });

    console.log("Created sample dispute for testing");
  }

  // Create a sample incident for testing
  const incidentOrder = createdOrders[3]; // settled order
  if (incidentOrder) {
    const [incident] = await db.insert(incidentReports).values({
      orderId: incidentOrder.id,
      reporterId: requester1.id,
      reporterType: "requester",
      requesterId: requester1.id,
      helperId: helper1.id,
      incidentDate: incidentOrder.scheduledDate,
      incidentType: "damage",
      description: "배송 중 화물 외박스 파손이 발생했습니다. 수령인이 확인 후 사진을 첨부합니다.",
      status: "submitted",
    }).returning();

    console.log("Created sample incident report for testing");
  }

  console.log("=== Closing/Settlement/Dispute seed data complete ===");
}

// Permission checking middleware factory
// Dangerous permissions that require explicit RBAC check even for HQ staff
const dangerousPermsRequireRbac = ["orders.force_override"];

const requirePermission = (permission: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.adminUser?.id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // HQ staff bypass for normal permissions, but dangerous permissions always require RBAC check
      const adminUser = req.adminUser;
      const isDangerousPerm = dangerousPermsRequireRbac.includes(permission);
      
      if (adminUser?.isHqStaff === true && !isDangerousPerm) {
        console.log(`[RBAC] isHqStaff bypass for ${adminUser.email}, permission: ${permission}`);
        return next();
      }
      
      try {
        const userPermissions = await storage.getUserPermissions(userId);
        if (userPermissions.includes(permission)) {
          return next();
        }
      } catch (dbErr) {
        // RBAC tables might not exist - log and deny
        console.error("[RBAC] Permission check failed (tables may not exist):", dbErr);
      }
      
      return res.status(403).json({ message: "권한이 없습니다", required: permission });
    } catch (err: any) {
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
};

// Helper function to get active refund policy
async function getActiveRefundPolicy(): Promise<{ beforeMatchingRate: number; afterMatchingRate: number }> {
  const today = new Date().toISOString().split('T')[0];
  const [policy] = await db
    .select()
    .from(refundPolicies)
    .where(
      and(
        eq(refundPolicies.isActive, true),
        lte(refundPolicies.effectiveFrom, today),
        or(
          isNull(refundPolicies.effectiveTo),
          gte(refundPolicies.effectiveTo, today)
        )
      )
    )
    .orderBy(desc(refundPolicies.isDefault), desc(refundPolicies.effectiveFrom))
    .limit(1);
  
  return {
    beforeMatchingRate: policy?.beforeMatchingRefundRate ?? 100,
    afterMatchingRate: policy?.afterMatchingRefundRate ?? 70
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed data on startup
  await seedMasterData();
  await seedRbacData();
  
  // Always ensure admin user exists (runs in all environments)
  await ensureAdminUser();
  
  // Test seeding - creates test users, orders, closings, settlements, disputes
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_TEST_SEED !== 'true') {
    await seedTestUsers();
    await seedClosingAndSettlementData();
  }

  // Register Object Storage routes
  registerObjectStorageRoutes(httpServer, app);
  const objectStorageService = new ObjectStorageService();

  // ============================================
  // 모듈화된 라우트 등록 (routes/ 디렉토리)
  // ============================================
  await registerModularRoutes({
    app,
    httpServer,
    requireAuth,
    adminAuth,
    requireRole,
    requireOwner,
    requirePermission: (permission: string) => requirePermission(permission),
    requireSuperAdmin: (req: any, res: any, next: any) => {
      const user = req.adminUser || req.user;
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "슈퍼관리자 권한이 필요합니다" });
      }
      next();
    },
    validateBody: (schema: any) => (req: any, res: any, next: any) => {
      try {
        const result = schema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ message: "입력값 검증 실패", errors: result.error.issues });
        }
        req.body = result.data;
        next();
      } catch {
        next();
      }
    },
    authRateLimiter,
    signupRateLimiter,
    passwordResetRateLimiter,
    uploadRateLimiter,
    pushRateLimiter,
    strictRateLimiter,
    storage,
    db,
    logAdminAction,
    logAuthEvent,
    broadcastToAllAdmins,
    notifyOrderHelpers,
    broadcastNewOrderToHelpers,
    sendFcmToUser,
    sendExpoPushToUser: async () => ({ sent: 0, failed: 0 }),
    sendPushToUser,
    pgService,
    mapPGStatusToDBStatus,
    calculateSettlement,
    calculateHelperPayout,
    parseClosingReport,
    ORDER_STATUS,
    canTransitionSettlementStatus,
    canTransitionOrderStatus,
    validateOrderStatus,
    encrypt,
    decrypt,
    hashForSearch,
    maskAccountNumber,
    JWT_SECRET,
    objectStorageService,
    notificationWS,
    smsService,
    popbill,
    uploadVehicleImage,
    tables: {},
    sql, eq, desc, and, or, inArray, not, isNull, gte, lte,
    checkIdempotency,
    storeIdempotencyResponse,
    getIdempotencyKeyFromRequest,
    getOrderDepositInfo,
    getDepositRate,
    getOrCreatePersonalCode,
  } as any);

  // ============================================
  // Health Check API - 서버 상태 점검용 (공개)
  // ============================================
  app.get("/api/health", async (_req, res) => {
    const { pool } = await import("./db");
    
    // DB 연결 테스트
    let dbStatus = "unknown";
    try {
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } catch (err: any) {
      dbStatus = "disconnected";
      console.error("[Health] DB connection failed:", err);
    }
    
    // 공개 응답: 민감 정보 제외
    res.json({
      status: dbStatus === "connected" ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // Client Error Logging - 클라이언트 오류 수집
  // ============================================
  app.post("/api/client-errors", validateBody(clientErrorSchema), async (req, res) => {
    try {
      const { timestamp, severity, message, stack, context, url } = req.body;
      
      // 중요 오류만 저장 (critical, error)
      if (severity === 'critical' || severity === 'error') {
        // 사용자 정보 추출 (있는 경우)
        let userId: string | undefined;
        const token = req.headers.authorization?.split(" ")[1];
        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            userId = decoded.userId;
          } catch { /* 토큰 검증 실패 무시 */ }
        }
        
        // DB에 저장
        await storage.createClientError({
          severity,
          message: message?.substring(0, 2000) || "Unknown error",
          stack: stack?.substring(0, 5000),
          context: typeof context === 'object' ? JSON.stringify(context) : context,
          url,
          userId,
          userAgent: req.headers['user-agent'],
          ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress,
        });
        
        // 콘솔 로깅 (개발 환경)
        if (process.env.NODE_ENV !== 'production') {
          console.error(`[CLIENT ERROR] [${severity}] ${message?.substring(0, 200)}`);
        }
      }
      
      res.json({ received: true });
    } catch (err: any) {
      res.status(500).json({ message: "Error logging failed" });
    }
  });


  // === meta & address routes moved to routes/meta.routes.ts ===


  // === auth routes moved to routes/auth.routes.ts ===


  // === helper routes moved to routes/helpers.routes.ts ===


  // === orders routes moved to routes/orders.routes.ts ===



  // === admin routes moved to routes/admin.routes.ts ===


  return httpServer;
}
