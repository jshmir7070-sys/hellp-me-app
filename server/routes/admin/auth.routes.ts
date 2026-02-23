/**
 * Admin routes
 *
 * Admin auth, staff management, order management, contract management,
 * settlement management, helper/requester document management,
 * dispute management, incident management, policy management,
 * system settings, data management, SMS templates, etc.
 */

import type { RouteContext } from "../../types";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import {
  ORDER_STATUS,
  normalizeOrderStatus,
  isOneOfStatus,
} from "../../constants/order-status";
import {
  JWT_ACCESS_TOKEN_EXPIRY,
  JWT_REFRESH_TOKEN_EXPIRY_DAYS,
  PASSWORD_EXPIRY_DAYS,
} from "../../constants/auth";
import { withTransaction } from "../../utils/transactions";

export async function registerAuthRoutes(ctx: RouteContext): Promise<void> {
  const {
    app,
    requireAuth,
    adminAuth,
    storage,
    db,
    sql,
    eq,
    desc,
    and,
    or,
    inArray,
    not,
    isNull,
    gte,
    lte,
    broadcastToAllAdmins,
    broadcastNewOrderToHelpers,
    notifyOrderHelpers,
    notificationWS,
    sendPushToUser,
    sendFcmToUser,
    sendExpoPushToUser,
    calculateSettlement,
    calculateHelperPayout,
    parseClosingReport,
    ORDER_STATUS: ORDER_STATUS_CTX,
    canTransitionSettlementStatus,
    canTransitionOrderStatus,
    validateOrderStatus,
    objectStorageService,
    getOrderDepositInfo,
    getDepositRate,
    getOrCreatePersonalCode,
    logAdminAction,
    logAuthEvent,
    encrypt,
    decrypt,
    hashForSearch,
    maskAccountNumber,
    JWT_SECRET,
    smsService,
    popbill,
    pgService,
    mapPGStatusToDBStatus,
    uploadVehicleImage,
    signupRateLimiter,
    passwordResetRateLimiter,
    strictRateLimiter,
    authRateLimiter,
    uploadRateLimiter,
    pushRateLimiter,
    validateBody,
    checkIdempotency,
    storeIdempotencyResponse,
    getIdempotencyKeyFromRequest,
    requirePermission,
    // requireSuperAdmin - 아래 15880줄에서 더 정교한 버전으로 재정의
    requireRole,
    requireOwner,
  } = ctx;

  type AuthenticatedRequest = any;

  // Import shared schema tables used by admin routes
  const schema = await import("@shared/schema");
  const {
    orders, users, contracts, orderApplications, closingReports, helperDocuments,
    helperBankAccounts, identityVerifications, documentReviewTasks, orderStatusEvents,
    settlementStatements, settlementRecords, refunds, refundPolicies, deductions,
    incidentReports, incidentEvidence, disputes, customerServiceInquiries, customerInquiries,
    inquiryComments, ticketEscalations, supportTicketEscalations, smsTemplates, smsLogs,
    webhookLogs, integrationHealth, integrationEvents, systemEvents, pushNotificationLogs,
    pricingTables, pricingTableRows, carrierMinRates, carrierPricingPolicies,
    urgentFeePolicies, platformFeePolicies, extraCostCatalog, closingFieldSettings,
    manualDispatchLogs, orderForceStatusLogs, proofUploadFailures, settlementAuditLogs,
    settlementPayoutAttempts, requesterRefundAccounts, minimumGuaranteeRules,
    minimumGuaranteeApplications, regionPricingRules, vatSettings,
    orderRegistrationFields, orderClosureReports, payments,
    taxInvoices, courierSettings, signupConsents, termsVersions, termsReConsents,
    auditLogs, teamIncentives, incentiveDetails, userLocationLatest, userLocationLogs,
    destinationRegions, timeSlots,
    insertAdminBankAccountSchema, insertCarrierRateItemSchema, insertColdChainSettingSchema,
    insertCustomerServiceInquirySchema, insertDestinationPricingSchema, insertRefundPolicySchema,
    insertRequesterRefundAccountSchema, updateCustomerServiceInquirySchema,
  } = schema;

  type SettlementStatement = typeof settlementStatements.$inferSelect;

  // Import server-side utilities
  const { SETTLEMENT_STATUS } = await import("../../utils/admin-audit");
  const { CAN_SELECT_HELPER_STATUSES } = await import("../../constants/order-status");
  const { DEFAULT_COURIERS } = await import("../../constants/defaultCouriers");
  const { isValidImageBuffer, sanitizeFilename, MAX_FILE_SIZE } = await import("../../utils/file-validation");
  const { isNotNull } = await import("drizzle-orm");

  // Utility: bank code → bank name mapping
  function getBankName(code: string): string {
    const bankMap: Record<string, string> = {
      "004": "KB국민", "011": "NH농협", "020": "우리", "088": "신한",
      "003": "기업", "081": "하나", "005": "외환", "023": "SC제일",
      "027": "씨티", "039": "경남", "034": "광주", "031": "대구",
      "032": "부산", "035": "제주", "037": "전북", "071": "우체국",
      "045": "새마을금고", "048": "신협", "089": "K뱅크", "090": "카카오뱅크",
      "092": "토스뱅크",
    };
    return bankMap[code] || code;
  }

  // Utility: get active refund policy
  async function getActiveRefundPolicy() {
    const policies = await db.select().from(refundPolicies)
      .where(eq(refundPolicies.isActive, true))
      .limit(1);
    return policies[0] || null;
  }

  // ==================== ADMIN ROUTES ====================

  // Admin SMS verification temporary storage
  const adminSmsVerifications = new Map<string, { userId: string; code: string; expiresAt: Date; phoneNumber: string }>();
  const adminPasswordResetTokens = new Map<string, { userId: string; expiresAt: Date }>();

  // Admin-specific login (separate from app login)
  app.post("/api/admin/auth/login", strictRateLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다" });
      }

      // Only allow HQ staff or admin/superadmin role
      if (!user.isHqStaff && user.role !== "admin" && user.role !== "superadmin") {
        return res.status(403).json({ message: "관리자 권한이 없습니다" });
      }

      // Check adminStatus - only "active" can login
      if (user.adminStatus === "pending") {
        return res.status(403).json({ message: "관리자 승인 대기 중입니다. 승인 후 로그인해 주세요." });
      }
      if (user.adminStatus === "suspended") {
        return res.status(403).json({ message: "계정이 정지되었습니다. 관리자에게 문의해 주세요." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다" });
      }

      // Check if password is expired
      let passwordExpired = false;
      let passwordExpiresSoon = false;
      let daysUntilExpiry = PASSWORD_EXPIRY_DAYS;

      if (user.passwordChangedAt) {
        const daysSinceChange = (Date.now() - new Date(user.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
        daysUntilExpiry = Math.max(0, Math.floor(PASSWORD_EXPIRY_DAYS - daysSinceChange));

        if (daysSinceChange > PASSWORD_EXPIRY_DAYS) {
          passwordExpired = true;
        } else if (daysSinceChange > PASSWORD_EXPIRY_DAYS - 10) {
          passwordExpiresSoon = true;
        }
      }

      // If password is expired, return tempToken for password change
      if (passwordExpired) {
        const tempToken = randomBytes(32).toString("hex");
        adminPasswordResetTokens.set(tempToken, {
          userId: user.id,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        return res.json({
          passwordExpired: true,
          tempToken,
          message: "비밀번호가 만료되었습니다. 새 비밀번호를 설정해주세요.",
        });
      }

      // SMS 2-Factor Authentication (if user has phone number)
      if (user.phoneNumber) {
        const tempToken = randomBytes(32).toString("hex");
        const smsCode = String(require("crypto").randomInt(100000, 999999));

        adminSmsVerifications.set(tempToken, {
          userId: user.id,
          code: smsCode,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          phoneNumber: user.phoneNumber,
        });

        // Mask phone number for display
        const maskedPhone = user.phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");

        // Send SMS
        try {
          await smsService.sendSms(user.phoneNumber, `[Hellp Me] 관리자 로그인 인증번호: ${smsCode}`);
        } catch (smsErr) {
          console.error("SMS send error:", smsErr);
        }

        return res.json({
          requireSmsVerification: true,
          tempToken,
          phoneNumber: maskedPhone,
          passwordExpiresSoon,
          daysUntilExpiry,
        });
      }

      // Direct login if no phone number
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRY });

      const refreshTokenValue = randomBytes(32).toString("hex");
      const refreshExpiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const deviceInfo = req.headers["user-agent"] || undefined;
      await storage.createRefreshToken(user.id, refreshTokenValue, refreshExpiresAt, deviceInfo);

      // Get user permissions
      const userRoles = await storage.getStaffRoleAssignments(user.id);
      const permissions: string[] = [];
      for (const role of userRoles) {
        const rolePerms = await storage.getRolePermissions(role.roleId);
        permissions.push(...rolePerms.map(p => p.permissionKey));
      }

      res.json({
        token,
        refreshToken: refreshTokenValue,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHqStaff: user.isHqStaff,
          permissions: [...new Set(permissions)],
        },
        passwordExpiresSoon,
        daysUntilExpiry,
      });
    } catch (err: any) {
      console.error("Admin login error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Verify SMS code for admin login
  app.post("/api/admin/auth/verify-sms", strictRateLimiter, async (req, res) => {
    try {
      const { tempToken, code } = req.body;

      const verification = adminSmsVerifications.get(tempToken);
      if (!verification) {
        return res.status(400).json({ message: "인증 세션이 만료되었습니다. 다시 로그인해주세요." });
      }

      if (new Date() > verification.expiresAt) {
        adminSmsVerifications.delete(tempToken);
        return res.status(400).json({ message: "인증번호가 만료되었습니다. 다시 로그인해주세요." });
      }

      if (verification.code !== code) {
        return res.status(400).json({ message: "인증번호가 올바르지 않습니다." });
      }

      adminSmsVerifications.delete(tempToken);

      const user = await storage.getUser(verification.userId);
      if (!user) {
        return res.status(400).json({ message: "사용자를 찾을 수 없습니다." });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRY });

      const refreshTokenValue = randomBytes(32).toString("hex");
      const refreshExpiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const deviceInfo = req.headers["user-agent"] || undefined;
      await storage.createRefreshToken(user.id, refreshTokenValue, refreshExpiresAt, deviceInfo);

      // Get user permissions
      const userRoles = await storage.getStaffRoleAssignments(user.id);
      const permissions: string[] = [];
      for (const role of userRoles) {
        const rolePerms = await storage.getRolePermissions(role.roleId);
        permissions.push(...rolePerms.map(p => p.permissionKey));
      }

      res.json({
        token,
        refreshToken: refreshTokenValue,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHqStaff: user.isHqStaff,
          permissions: [...new Set(permissions)],
        },
      });
    } catch (err: any) {
      console.error("SMS verification error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Resend SMS code
  app.post("/api/admin/auth/resend-sms", strictRateLimiter, async (req, res) => {
    try {
      const { tempToken } = req.body;

      const verification = adminSmsVerifications.get(tempToken);
      if (!verification) {
        return res.status(400).json({ message: "인증 세션이 만료되었습니다. 다시 로그인해주세요." });
      }

      const newCode = String(require("crypto").randomInt(100000, 999999));
      verification.code = newCode;
      verification.expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      try {
        await smsService.sendSms(verification.phoneNumber, `[Hellp Me] 관리자 로그인 인증번호: ${newCode}`);
      } catch (smsErr) {
        console.error("SMS resend error:", smsErr);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("SMS resend error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Request password reset
  app.post("/api/admin/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user || (!user.isHqStaff && user.role !== "admin")) {
        return res.json({ success: true });
      }

      const resetToken = randomBytes(32).toString("hex");
      adminPasswordResetTokens.set(resetToken, {
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const tempPassword = randomBytes(4).toString("hex");
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
      });

      console.log(`[Admin Password Reset] User: ${email}, password reset completed`);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Password reset error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Change password (for expired password)
  app.post("/api/admin/auth/change-password", async (req, res) => {
    try {
      const { tempToken, newPassword } = req.body;

      const resetData = adminPasswordResetTokens.get(tempToken);
      if (!resetData) {
        return res.status(400).json({ message: "세션이 만료되었습니다. 다시 로그인해주세요." });
      }

      if (new Date() > resetData.expiresAt) {
        adminPasswordResetTokens.delete(tempToken);
        return res.status(400).json({ message: "세션이 만료되었습니다. 다시 로그인해주세요." });
      }

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "비밀번호는 8자 이상이어야 합니다." });
      }

      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

      if (!(hasUpperCase && hasLowerCase && hasNumber && hasSpecial)) {
        return res.status(400).json({ message: "대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다." });
      }

      adminPasswordResetTokens.delete(tempToken);

      const user = await storage.getUser(resetData.userId);
      if (!user) {
        return res.status(400).json({ message: "사용자를 찾을 수 없습니다." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRY });

      const refreshTokenValue = randomBytes(32).toString("hex");
      const refreshExpiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const deviceInfo = req.headers["user-agent"] || undefined;
      await storage.createRefreshToken(user.id, refreshTokenValue, refreshExpiresAt, deviceInfo);

      const userRoles = await storage.getStaffRoleAssignments(user.id);
      const permissions: string[] = [];
      for (const role of userRoles) {
        const rolePerms = await storage.getRolePermissions(role.roleId);
        permissions.push(...rolePerms.map(p => p.permissionKey));
      }

      res.json({
        token,
        refreshToken: refreshTokenValue,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHqStaff: user.isHqStaff,
          permissions: [...new Set(permissions)],
        },
      });
    } catch (err: any) {
      console.error("Password change error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });
  // Admin password change (authenticated user)
  app.post("/api/admin/auth/update-password", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (!user.isHqStaff && user.role !== "admin") {
        return res.status(403).json({ message: "관리자 권한이 없습니다" });
      }

      const { currentPassword, newPassword } = req.body;

      // If mustChangePassword is true, currentPassword is not required
      if (!user.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "현재 비밀번호를 입력해주세요" });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: "현재 비밀번호가 올바르지 않습니다" });
        }
      }

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "새 비밀번호는 8자 이상이어야 합니다" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      });

      res.json({ success: true, message: "비밀번호가 변경되었습니다" });
    } catch (err: any) {
      // 운영 로그: 민감정보 제외, 에러 타입만 기록
      console.error("[Auth] Password change failed:", (err as Error).message?.substring(0, 50));
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Create admin staff (requires existing admin)
  app.post("/api/admin/staff", adminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const currentUser = req.user!;

      if (!currentUser.isHqStaff && currentUser.role !== "admin") {
        return res.status(403).json({ message: "관리자 권한이 없습니다" });
      }

      const { email, name, phoneNumber, address, birthDate } = req.body;

      if (!email || !name) {
        return res.status(400).json({ message: "이메일과 이름은 필수입니다" });
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "이미 존재하는 이메일입니다" });
      }

      // Generate random initial password (12 chars - secure)
      const initialPassword = randomBytes(6).toString('hex') + randomBytes(2).toString('hex').toUpperCase();
      const hashedPassword = await bcrypt.hash(initialPassword, 10);

      const newUser = await storage.createUser({
        username: email,
        email,
        password: hashedPassword,
        name,
        phoneNumber: phoneNumber || null,
        address: address || null,
        birthDate: birthDate || null,
        role: "helper", // Base role, but isHqStaff=true makes them admin
        isHqStaff: true,
        mustChangePassword: true,
        adminStatus: "pending", // Requires approval before login
      });

      res.status(201).json({
        success: true,
        message: "관리자 계정이 생성되었습니다. 승인 후 로그인이 가능합니다.",
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          adminStatus: "pending",
        },
      });
    } catch (err: any) {
      console.error("Create admin staff error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Approve admin staff (generate new temp password and send SMS)
  app.patch("/api/admin/staff/:id/approve", adminAuth, requirePermission("staff.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const currentUser = req.user!;

      if (!currentUser.isHqStaff && currentUser.role !== "admin") {
        return res.status(403).json({ message: "관리자 권한이 없습니다" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      if (!targetUser.isHqStaff && targetUser.role !== "admin") {
        return res.status(400).json({ message: "관리자 계정이 아닙니다" });
      }

      if (targetUser.adminStatus === "active") {
        return res.status(400).json({ message: "이미 승인된 계정입니다" });
      }

      // Generate new temporary password (secure)
      const tempPassword = randomBytes(6).toString('hex') + randomBytes(2).toString('hex').toUpperCase();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      await storage.updateUser(targetUser.id, {
        adminStatus: "active",
        approvedAt: new Date(),
        approvedBy: currentUser.id,
        password: hashedPassword,
        mustChangePassword: true,
      });

      // SMS 임시 비밀번호 발송
      let smsSent = false;
      if (targetUser.phoneNumber) {
        try {
          const smsResult = await smsService.sendCustomMessage(
            targetUser.phoneNumber,
            `[헬프미 관리자] 계정이 승인되었습니다.\n임시 비밀번호: ${tempPassword}\n로그인 후 반드시 비밀번호를 변경해주세요.`
          );
          smsSent = smsResult.success;
        } catch (smsErr) {
          console.error("[SMS Error] Failed to send temp password:", smsErr);
        }
      }

      res.json({
        success: true,
        message: "관리자 계정이 승인되었습니다. 임시 비밀번호가 등록된 휴대폰으로 SMS 발송됩니다.",
        smsSent,
      });
    } catch (err: any) {
      console.error("Approve admin staff error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Suspend admin staff
  app.patch("/api/admin/staff/:id/suspend", adminAuth, requirePermission("staff.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const currentUser = req.user!;

      if (!currentUser.isHqStaff && currentUser.role !== "admin") {
        return res.status(403).json({ message: "관리자 권한이 없습니다" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      if (!targetUser.isHqStaff && targetUser.role !== "admin") {
        return res.status(400).json({ message: "관리자 계정이 아닙니다" });
      }

      // Prevent self-suspension
      if (targetUser.id === currentUser.id) {
        return res.status(400).json({ message: "자신의 계정을 정지할 수 없습니다" });
      }

      await storage.updateUser(targetUser.id, {
        adminStatus: "suspended",
      });

      res.json({
        success: true,
        message: "관리자 계정이 정지되었습니다.",
      });
    } catch (err: any) {
      console.error("Suspend admin staff error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  // Reactivate suspended admin staff
  app.patch("/api/admin/staff/:id/reactivate", adminAuth, requirePermission("staff.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const currentUser = req.user!;

      if (!currentUser.isHqStaff && currentUser.role !== "admin") {
        return res.status(403).json({ message: "관리자 권한이 없습니다" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      if (targetUser.adminStatus !== "suspended") {
        return res.status(400).json({ message: "정지된 계정이 아닙니다" });
      }

      await storage.updateUser(targetUser.id, {
        adminStatus: "active",
      });

      res.json({
        success: true,
        message: "관리자 계정이 재활성화되었습니다.",
      });
    } catch (err: any) {
      console.error("Reactivate admin staff error:", err);
      res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

}


