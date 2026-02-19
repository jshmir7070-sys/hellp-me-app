/**
 * Auth routes module
 *
 * Signup, Login, Token Refresh, Logout, OAuth (Kakao/Naver),
 * Password Reset, SMS Verification, Identity Verification,
 * Account Withdrawal, Change Password, Delete Account
 */

import type { RouteContext } from "./types";
import { api } from "@shared/routes";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { randomBytes, createHmac } from "crypto";
import {
  JWT_ACCESS_TOKEN_EXPIRY,
  JWT_ACCESS_TOKEN_EXPIRY_SECONDS,
  JWT_REFRESH_TOKEN_EXPIRY_DAYS,
  SMS_VERIFICATION_EXPIRY_MINUTES,
} from "../constants/auth";

const isProduction = process.env.NODE_ENV === "production";

const OAUTH_BASE_URL = process.env.OAUTH_BASE_URL || "";

/** Remove password hash and other sensitive fields before sending user to client */
function sanitizeUser(user: any) {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe;
}

export async function registerAuthRoutes(ctx: RouteContext): Promise<void> {
  const {
    app,
    requireAuth,
    storage,
    db,
    JWT_SECRET,
    logAuthEvent,
    smsService,
    signupRateLimiter,
    passwordResetRateLimiter,
    strictRateLimiter,
    authRateLimiter,
    sql,
    eq,
    broadcastToAllAdmins,
    sendPushToUser,
    notificationWS,
    popbill,
    validateBody,
    getOrCreatePersonalCode,
    hashForSearch,
  } = ctx;

  // Import validation schemas directly
  const { authSchemas } = await import("../utils/validation");
  const { webhookLogs, signupConsents } = await import("@shared/schema");
  const { ORDER_STATUS } = await import("../constants/order-status");
  const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
  // Import auth middleware types
  type AuthenticatedRequest = any;

  // Auth routes
  app.post(api.auth.signup.path, signupRateLimiter, async (req, res) => {
    try {
      const input = api.auth.signup.input.parse(req.body);

      // 필수 동의 항목 서버 측 검증
      const { agreements } = input;
      if (!agreements.terms || !agreements.privacy || !agreements.location || !agreements.payment || !agreements.liability || !agreements.electronic) {
        return res.status(400).json({ message: "모든 필수 약관에 동의해야 합니다", field: "agreements" });
      }
      // 헬퍼인 경우 산재보험·적재물보험·독립사업자 동의 필수
      if (input.role === "helper") {
        if (!agreements.industrialAccidentInsurance || !agreements.cargoInsurance || !agreements.independentContractor) {
          return res.status(400).json({ message: "헬퍼 필수 동의 항목(산재보험, 적재물보험, 독립사업자 확인)에 모두 동의해야 합니다", field: "agreements" });
        }
      }

      // Check email duplicate
      const existingEmail = await storage.getUserByEmail(input.email);
      if (existingEmail) {
        return res.status(400).json({ message: "이미 사용중인 이메일입니다", field: "email" });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Generate permanent checkInToken for requesters
      const checkInToken = input.role === "requester"
        ? randomBytes(32).toString("hex")
        : undefined;

      const user = await storage.createUser({
        username: input.email,
        email: input.email,
        password: hashedPassword,
        name: input.name,
        address: input.address ?? undefined,
        birthDate: input.birthDate ?? undefined,
        phoneNumber: input.phoneNumber ?? undefined,
        role: input.role,
        checkInToken,
        identityVerified: input.identityVerified ?? false,
        identityCi: input.identityCi ? hashForSearch(input.identityCi) : undefined,
        identityDi: input.identityDi ? hashForSearch(input.identityDi) : undefined,
        identityVerifiedAt: input.identityVerified ? new Date() : undefined,
        kakaoId: input.kakaoId ?? undefined,
        naverId: input.naverId ?? undefined,
      });

      // ============ 동의 기록 DB 저장 (법적 증거) ============
      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const userAgentStr = req.headers["user-agent"] || "";
      try {
        await db.insert(signupConsents).values({
          userId: user.id,
          role: input.role,
          termsAgreed: agreements.terms,
          privacyAgreed: agreements.privacy,
          locationAgreed: agreements.location,
          paymentAgreed: agreements.payment,
          liabilityAgreed: agreements.liability,
          electronicAgreed: agreements.electronic,
          industrialAccidentInsuranceAgreed: agreements.industrialAccidentInsurance ?? null,
          cargoInsuranceAgreed: agreements.cargoInsurance ?? null,
          independentContractorAgreed: agreements.independentContractor ?? null,
          marketingAgreed: agreements.marketing ?? false,
          ipAddress,
          userAgent: userAgentStr,
          consentLog: JSON.stringify({
            agreedAt: new Date().toISOString(),
            items: Object.entries(agreements).map(([key, value]) => ({
              key,
              agreed: value,
              timestamp: new Date().toISOString(),
            })),
          }),
        });
      } catch (consentErr) {
        console.error("Failed to save signup consent record:", consentErr);
        // 동의 기록 저장 실패해도 가입은 진행 (추후 재확인 플로우로 보완)
      }

      // 회원가입 시 개인코드 자동 생성 (요청자/헬퍼 모두)
      try {
        const personalCode = await getOrCreatePersonalCode(user.id);
        user.personalCode = personalCode;
      } catch (err: any) {
        console.error("Failed to generate personal code on signup:", err);
      }

      // Access token (1시간) 및 Refresh token (30일) 발급
      const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRY });
      const refreshTokenValue = randomBytes(32).toString("hex");
      const refreshExpiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const deviceInfo = req.headers["user-agent"] || undefined;
      await storage.createRefreshToken(user.id, refreshTokenValue, refreshExpiresAt, deviceInfo);

      res.status(201).json({
        user: sanitizeUser(user),
        token: accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: JWT_ACCESS_TOKEN_EXPIRY_SECONDS
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, authRateLimiter, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        await logAuthEvent(req, "login_failed", "failure", {
          metadata: { reason: "user_not_found", email: input.email }
        });
        return res.status(404).json({ message: "비회원입니다. 회원가입을 진행해주세요." });
      }
      const validPassword = await bcrypt.compare(input.password, user.password);
      if (!validPassword) {
        await logAuthEvent(req, "login_failed", "failure", {
          userId: user.id,
          metadata: { reason: "invalid_password" }
        });
        return res.status(401).json({ message: "비밀번호가 올바르지 않습니다" });
      }
      
      // Access token (1시간) 및 Refresh token (30일) 발급
      const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRY });
      const refreshTokenValue = randomBytes(32).toString("hex");
      const refreshExpiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const deviceInfo = req.headers["user-agent"] || undefined;
      await storage.createRefreshToken(user.id, refreshTokenValue, refreshExpiresAt, deviceInfo);

      await logAuthEvent(req, "login", "success", { userId: user.id });
      res.json({
        user: sanitizeUser(user),
        token: accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: JWT_ACCESS_TOKEN_EXPIRY_SECONDS
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "올바른 이메일 형식을 입력해주세요" });
      }
      console.error("Login error:", err);
      res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
    }
  });

  // 토큰 갱신 API
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken || typeof refreshToken !== "string") {
        return res.status(400).json({ message: "Refresh token이 필요합니다" });
      }
      
      const storedToken = await storage.getRefreshToken(refreshToken);
      if (!storedToken) {
        return res.status(401).json({ message: "유효하지 않은 refresh token입니다" });
      }
      
      // 만료 확인
      if (new Date() > storedToken.expiresAt) {
        await storage.revokeRefreshToken(refreshToken);
        return res.status(401).json({ message: "Refresh token이 만료되었습니다" });
      }
      
      const user = await storage.getUser(storedToken.userId);
      if (!user) {
        await storage.revokeRefreshToken(refreshToken);
        return res.status(401).json({ message: "사용자를 찾을 수 없습니다" });
      }
      
      // 새 access token 발급
      const newAccessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRY });

      // Refresh token rotation (보안 강화)
      await storage.revokeRefreshToken(refreshToken);
      const newRefreshTokenValue = randomBytes(32).toString("hex");
      const newRefreshExpiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const deviceInfo = req.headers["user-agent"] || undefined;
      await storage.createRefreshToken(user.id, newRefreshTokenValue, newRefreshExpiresAt, deviceInfo);

      res.json({
        token: newAccessToken,
        refreshToken: newRefreshTokenValue,
        expiresIn: JWT_ACCESS_TOKEN_EXPIRY_SECONDS
      });
    } catch (err: any) {
      console.error("Token refresh error:", err);
      res.status(500).json({ message: "토큰 갱신 중 오류가 발생했습니다" });
    }
  });

  // 로그아웃 (refresh token 폐기)
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await storage.revokeRefreshToken(refreshToken);
      }
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("Logout error:", err);
      res.status(500).json({ message: "로그아웃 처리 중 오류가 발생했습니다" });
    }
  });

  // 회원탈퇴 API
  app.post("/api/auth/withdraw", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { password, reason } = req.body;

      // 비밀번호 확인 (소셜 로그인 사용자는 제외)
      if (user.passwordHash && password) {
        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return res.status(400).json({ message: "비밀번호가 일치하지 않습니다" });
        }
      }

      // 진행 중인 오더 확인
      const activeOrders = await storage.getOrdersByRequesterId(user.id);
      const allOrdersRaw = await storage.getOrders();
      const helperOrders = allOrdersRaw.filter(o => o.matchedHelperId === user.id);
      const allOrders = [...activeOrders, ...helperOrders];
      const hasActiveOrder = allOrders.some(o => 
        !['completed', 'closed', 'cancelled'].includes(o.status)
      );
      
      if (hasActiveOrder) {
        return res.status(400).json({ 
          message: "진행 중인 오더가 있어 탈퇴할 수 없습니다. 모든 오더를 완료하거나 취소 후 다시 시도해주세요." 
        });
      }

      // 미정산 확인
      const settlements = await storage.getSettlementsByHelper(user.id);
      const pendingSettlement = settlements.some(s => s.status === 'pending');
      if (pendingSettlement) {
        return res.status(400).json({ 
          message: "미정산 건이 있어 탈퇴할 수 없습니다. 정산 완료 후 다시 시도해주세요." 
        });
      }

      // 감사 로그 기록
      await storage.createAuditLog({
        userId: user.id,
        action: 'USER_WITHDRAW',
        targetType: 'user',
        targetId: user.id,
        details: { reason: reason || '사유 미입력', email: user.email },
        ipAddress: req.ip || 'unknown',
      });

      // 사용자 비활성화 (소프트 삭제)
      await storage.updateUser(user.id, {
        isActive: false,
        deletedAt: new Date(),
        email: `deleted_${Date.now()}_${user.email}`, // 이메일 중복 방지
      });

      // 모든 리프레시 토큰 무효화
      await storage.revokeAllUserTokens(user.id);

      res.json({ success: true, message: "회원탈퇴가 완료되었습니다" });
    } catch (err: any) {
      console.error("Withdraw error:", err);
      res.status(500).json({ message: "회원탈퇴 처리 중 오류가 발생했습니다" });
    }
  });

  app.get(api.auth.me.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    
    // 개인코드가 없으면 자동 생성 (요청자/헬퍼 모두)
    if (!user.personalCode) {
      try {
        const personalCode = await getOrCreatePersonalCode(user.id);
        user.personalCode = personalCode;
      } catch (err: any) {
        console.error("Failed to generate personal code:", err);
      }
    }
    
    res.json({ user: sanitizeUser(user) });
  });

  // Update user role (after signup)
  const updateRoleSchema = z.object({
    role: z.enum(["helper", "requester"]),
  });
  
  app.post("/api/auth/update-role", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      const parseResult = updateRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "유효하지 않은 역할입니다" });
      }
      
      const { role } = parseResult.data;

      // Generate checkInToken for requesters
      const checkInToken = role === "requester" 
        ? randomBytes(32).toString("hex") 
        : undefined;

      // onboardingStatus 로직:
      // - 요청자로 전환/유지: approved (요청자는 온보딩 불필요)
      // - 헬퍼로 전환 (요청자→헬퍼): pending (헬퍼 온보딩 필요)
      // - 헬퍼 유지 (헬퍼→헬퍼): 기존 상태 유지
      let onboardingStatus: string;
      if (role === "requester") {
        // 요청자는 항상 approved
        onboardingStatus = "approved";
      } else if (user.role === "helper") {
        // 이미 헬퍼인 경우 기존 상태 유지
        onboardingStatus = user.onboardingStatus || "pending";
      } else {
        // 요청자에서 헬퍼로 전환 - 헬퍼 온보딩 필요
        onboardingStatus = "pending";
      }

      // 개인코드가 없으면 자동 생성 (요청자/헬퍼 모두)
      let personalCode: string | undefined;
      if (!user.personalCode) {
        try {
          personalCode = await getOrCreatePersonalCode(user.id);
        } catch (err: any) {
          console.error("Failed to generate personal code:", err);
        }
      }

      const updatedUser = await storage.updateUser(user.id, { 
        role,
        checkInToken,
        onboardingStatus,
        ...(personalCode && { personalCode }),
      });

      res.json({ user: sanitizeUser(updatedUser) });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check email availability
  app.post(api.auth.checkEmail.path, async (req, res) => {
    try {
      const input = api.auth.checkEmail.input.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        res.json({ available: false, message: "이미 사용중인 이메일입니다" });
      } else {
        res.json({ available: true, message: "사용 가능한 이메일입니다" });
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ available: false, message: "올바른 이메일 형식을 입력해주세요" });
      }
      console.error("Email check error:", err);
      res.status(500).json({ available: false, message: "이메일 확인 중 오류가 발생했습니다" });
    }
  });

  // Find email by phone number and name
  app.post("/api/auth/find-email", validateBody(authSchemas.findEmail), async (req, res) => {
    try {
      const { phoneNumber, name } = req.body;
      
      const users = await storage.getAllUsers();
      const user = users.find(u => 
        u.phoneNumber === phoneNumber && 
        u.name === name && 
        !u.isHqStaff
      );
      
      if (!user) {
        return res.status(404).json({ message: "일치하는 계정을 찾을 수 없습니다" });
      }
      
      // Mask email for security (show first 3 chars + ***@domain)
      const email = user.email;
      const [localPart, domain] = email.split("@");
      const maskedLocal = localPart.length > 3 
        ? localPart.substring(0, 3) + "***" 
        : localPart.substring(0, 1) + "***";
      const maskedEmail = `${maskedLocal}@${domain}`;
      
      res.json({ 
        email: maskedEmail,
        createdAt: user.createdAt
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Request password reset (sends temporary password)
  app.post("/api/auth/reset-password", passwordResetRateLimiter, validateBody(authSchemas.resetPassword), async (req, res) => {
    try {
      const { email, phoneNumber, name } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user || user.phoneNumber !== phoneNumber || user.name !== name) {
        return res.status(404).json({ message: "일치하는 계정을 찾을 수 없습니다" });
      }
      
      if (user.isHqStaff) {
        return res.status(403).json({ message: "관리자 계정은 별도의 절차가 필요합니다" });
      }
      
      // 개발 환경에서는 고정 테스트 임시 비밀번호 사용
      const isTestMode = process.env.NODE_ENV !== "production";
      const tempPassword = isTestMode ? "Test1234!" : `Temp${randomBytes(4).toString('hex')}!`;
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      await storage.updateUser(user.id, { 
        password: hashedPassword,
        mustChangePassword: true
      });
      
      // SMS 발송 (테스트 모드에서는 실제 발송 안함)
      if (!isTestMode) {
        const smsResult = await smsService.sendPasswordReset(user.phoneNumber!, tempPassword);
        if (!smsResult.success) {
          console.error(`[비밀번호 재설정 SMS 실패] ${smsResult.error}`);
        }
      } else {
        console.log(`[테스트 모드] 임시 비밀번호 발급됨 → ${user.phoneNumber}`);
      }

      res.json({
        success: true,
        message: isTestMode ? "임시 비밀번호가 발급되었습니다 (개발환경)" : "임시 비밀번호가 등록된 전화번호로 발송되었습니다",
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 회원가입용 휴대폰 인증번호 발송 (토큰 불필요)
  app.post("/api/auth/send-signup-code", signupRateLimiter, async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.length < 10) {
        return res.status(400).json({ message: "올바른 전화번호를 입력해주세요" });
      }
      
      // IP 기반 레이트 리밋
      const rawIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const ipAddress = rawIp.replace(/^::ffff:/, '');
      
      // 같은 IP에서 1분에 3회 제한
      const recentByIp = await storage.getRecentPhoneVerificationCodesByIp(ipAddress, 60);
      if (recentByIp.length >= 3) {
        return res.status(429).json({ message: "너무 많은 요청입니다. 1분 후 다시 시도해주세요." });
      }
      
      // 같은 전화번호로 1분에 3회 제한
      const recentByPhone = await storage.getRecentPhoneVerificationCodes(phoneNumber, 60);
      if (recentByPhone.length >= 3) {
        return res.status(429).json({ message: "이 번호로 너무 많은 요청이 있습니다. 1분 후 다시 시도해주세요." });
      }
      
      // 개발 환경에서는 고정 테스트 인증코드 사용
      const isTestMode = process.env.NODE_ENV !== "production";
      const code = isTestMode ? "123456" : String(require("crypto").randomInt(100000, 999999));
      const expiresAt = new Date(Date.now() + SMS_VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

      // DB에 인증코드 저장
      await storage.createPhoneVerificationCode({
        phoneNumber,
        code,
        userId: null,
        purpose: "signup_verify",
        expiresAt,
        ipAddress,
        isUsed: false,
        attempts: 0,
      });
      
      // SMS 발송 (테스트 모드에서는 실제 발송 안함)
      if (!isTestMode) {
        const smsResult = await smsService.sendVerificationCode(phoneNumber, code);
        if (!smsResult.success) {
          console.error(`[회원가입 인증코드 SMS 실패] ${smsResult.error}`);
        }
      } else {
        console.log(`[테스트 모드] 인증번호: ${code} → ${phoneNumber}`);
      }
      
      res.json({ 
        success: true, 
        message: isTestMode ? `[테스트] 인증번호: ${code}` : "인증번호가 발송되었습니다",
        expiresIn: 180,
        ...(isTestMode && { devCode: code })
      });
    } catch (err: any) {
      console.error("회원가입 인증코드 발송 오류:", err);
      res.status(500).json({ message: "인증코드 발송에 실패했습니다" });
    }
  });

  // 회원가입용 휴대폰 인증번호 검증 (토큰 불필요)
  app.post("/api/auth/verify-signup-code", signupRateLimiter, async (req, res) => {
    try {
      const { phoneNumber, code } = req.body;
      
      if (!phoneNumber || !code) {
        return res.status(400).json({ message: "전화번호와 인증번호를 입력해주세요" });
      }
      
      // DB에서 유효한 인증코드 조회
      const verificationCode = await storage.getValidPhoneVerificationCode(phoneNumber, "signup_verify");
      
      if (!verificationCode) {
        return res.status(400).json({ message: "인증번호가 만료되었거나 존재하지 않습니다. 다시 요청해주세요." });
      }
      
      // 시도 횟수 체크 (최대 5회)
      const attempts = verificationCode.attempts ?? 0;
      if (attempts >= 5) {
        await storage.markPhoneVerificationCodeUsed(verificationCode.id);
        return res.status(400).json({ message: "인증 시도 횟수를 초과했습니다. 새로운 인증번호를 요청해주세요." });
      }
      
      // 시도 횟수 증가
      await storage.incrementPhoneVerificationAttempts(verificationCode.id);
      
      // 인증코드 검증
      if (verificationCode.code !== code) {
        const remaining = 5 - (attempts + 1);
        return res.status(400).json({ 
          message: `인증번호가 올바르지 않습니다. (남은 시도: ${remaining}회)` 
        });
      }
      
      // 인증 성공: 코드 사용 처리
      await storage.markPhoneVerificationCodeUsed(verificationCode.id);
      
      res.json({ success: true, message: "인증이 완료되었습니다" });
    } catch (err: any) {
      console.error("회원가입 인증번호 검증 오류:", err);
      res.status(500).json({ message: "인증번호 검증에 실패했습니다" });
    }
  });

  // 휴대폰 인증번호 발송
  app.post("/api/auth/send-phone-code", strictRateLimiter, requireAuth, validateBody(authSchemas.sendPhoneCode), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      
      const { phoneNumber } = req.body;
      
      // IP 및 전화번호 기반 레이트 리밋 (모든 요청에 적용)
      // 정규화된 IP 주소 추출 (스푸핑 방지: req.ip 우선 사용)
      const rawIp = req.ip || req.socket?.remoteAddress || 'unknown';
      // IPv6 mapped IPv4 정규화 (::ffff:127.0.0.1 -> 127.0.0.1)
      const ipAddress = rawIp.replace(/^::ffff:/, '');
      
      // 같은 IP에서 1분에 3회 제한 (모든 IP에 적용)
      const recentByIp = await storage.getRecentPhoneVerificationCodesByIp(ipAddress, 60);
      if (recentByIp.length >= 3) {
        return res.status(429).json({ message: "너무 많은 요청입니다. 1분 후 다시 시도해주세요." });
      }
      
      // 같은 전화번호로 1분에 3회 제한
      const recentByPhone = await storage.getRecentPhoneVerificationCodes(phoneNumber, 60);
      if (recentByPhone.length >= 3) {
        return res.status(429).json({ message: "이 번호로 너무 많은 요청이 있습니다. 1분 후 다시 시도해주세요." });
      }
      
      // 개발 환경에서는 고정 테스트 인증코드 사용
      const isTestMode = process.env.NODE_ENV !== "production";
      const code = isTestMode ? "123456" : String(require("crypto").randomInt(100000, 999999));
      const expiresAt = new Date(Date.now() + SMS_VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

      // DB에 인증코드 저장
      await storage.createPhoneVerificationCode({
        phoneNumber,
        code,
        userId,
        purpose: "phone_verify",
        expiresAt,
        ipAddress,
        isUsed: false,
        attempts: 0,
      });
      
      // SMS 발송 (테스트 모드에서는 실제 발송 안함)
      if (!isTestMode) {
        const smsResult = await smsService.sendVerificationCode(phoneNumber, code);
        if (!smsResult.success) {
          console.error(`[인증코드 SMS 실패] ${smsResult.error}`);
        }
      } else {
        console.log(`[테스트 모드] 인증번호: ${code} → ${phoneNumber}`);
      }
      
      res.json({ 
        success: true, 
        message: isTestMode ? `[테스트] 인증번호: ${code}` : "인증번호가 발송되었습니다",
        expiresIn: 180,
        ...(isTestMode && { devCode: code })
      });
    } catch (err: any) {
      console.error("인증코드 발송 오류:", err);
      res.status(500).json({ message: "인증코드 발송에 실패했습니다" });
    }
  });

  // 휴대폰 인증번호 검증
  app.post("/api/auth/verify-phone", requireAuth, validateBody(authSchemas.verifyPhone), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      
      const { phoneNumber, code } = req.body;
      
      // DB에서 유효한 인증코드 조회
      const verificationCode = await storage.getValidPhoneVerificationCode(phoneNumber, "phone_verify");
      
      if (!verificationCode) {
        return res.status(400).json({ message: "인증번호가 만료되었거나 존재하지 않습니다. 다시 요청해주세요." });
      }
      
      // 시도 횟수 체크 (최대 5회)
      const attempts = verificationCode.attempts ?? 0;
      if (attempts >= 5) {
        await storage.markPhoneVerificationCodeUsed(verificationCode.id);
        return res.status(400).json({ message: "인증 시도 횟수를 초과했습니다. 새로운 인증번호를 요청해주세요." });
      }
      
      // 시도 횟수 증가
      await storage.incrementPhoneVerificationAttempts(verificationCode.id);
      
      // 인증코드 검증
      if (verificationCode.code !== code) {
        const remaining = 5 - (attempts + 1);
        return res.status(400).json({ 
          message: `인증번호가 올바르지 않습니다. (남은 시도: ${remaining}회)` 
        });
      }
      
      // 인증 성공: 코드 사용 처리
      await storage.markPhoneVerificationCodeUsed(verificationCode.id);
      
      // 사용자 전화번호 업데이트
      await storage.updateUser(userId, { phoneNumber });
      
      res.json({ success: true, message: "인증이 완료되었습니다" });
    } catch (err: any) {
      console.error("인증번호 검증 오류:", err);
      res.status(500).json({ message: "인증번호 검증에 실패했습니다" });
    }
  });

  // PortOne 본인인증 ID 생성 (SDK 호출 전에 먼저 호출해야 함)
  app.post("/api/auth/create-identity-verification", async (req, res) => {
    try {
      // PortOne V2 API로 본인인증 ID 사전 생성
      const identityVerificationId = `identity-${Date.now()}-${randomBytes(6).toString('hex')}`;
      
      // 운영 환경에서 API 시크릿 미설정 시 에러 반환
      if (!PORTONE_API_SECRET) {
        if (isProduction) {
          console.error("[PortOne] PORTONE_API_SECRET not configured in production");
          return res.status(503).json({ message: "본인인증 서비스를 이용할 수 없습니다. 관리자에게 문의하세요." });
        }
        console.log("[PortOne 테스트 모드] 생성된 ID:", identityVerificationId);
        return res.json({ identityVerificationId, testMode: true });
      }

      // PortOne V2 API로 본인인증 ID 사전 생성
      const createResponse = await fetch(
        "https://api.portone.io/identity-verifications",
        {
          method: "POST",
          headers: {
            "Authorization": `PortOne ${PORTONE_API_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identityVerificationId,
          }),
        }
      );

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error("PortOne ID 생성 실패:", error);
        // PortOne API가 ID 사전 생성을 요구하지 않는 경우도 있으므로 ID 반환
        return res.json({ identityVerificationId, preCreated: false });
      }

      console.log("[PortOne] 본인인증 ID 생성 완료:", identityVerificationId);
      res.json({ identityVerificationId, preCreated: true });
    } catch (err: any) {
      console.error("본인인증 ID 생성 오류:", err);
      res.status(500).json({ message: "본인인증 ID 생성 실패" });
    }
  });

  // PortOne 본인인증 검증 (회원가입 전)
  app.post("/api/auth/verify-identity", async (req, res) => {
    try {
      const { identityVerificationId } = req.body;
      
      if (!identityVerificationId) {
        await logAuthEvent(req, "identity_verification_failed", "failure", {
          provider: "portone",
          metadata: { reason: "missing_verification_id" }
        });
        return res.status(400).json({ message: "인증 정보가 필요합니다" });
      }

      // 요청 ID 형식 검증 (위변조 방지)
      if (typeof identityVerificationId !== "string" || 
          !identityVerificationId.startsWith("identity-") ||
          identityVerificationId.length > 100) {
        await logAuthEvent(req, "identity_verification_failed", "failure", {
          provider: "portone",
          metadata: { reason: "invalid_verification_id_format" }
        });
        return res.status(400).json({ message: "유효하지 않은 인증 정보입니다" });
      }

      const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
      
      // 운영 환경에서 API 시크릿 미설정 시 에러 반환
      if (!PORTONE_API_SECRET) {
        if (isProduction) {
          console.error("[PortOne] PORTONE_API_SECRET not configured in production");
          return res.status(503).json({ message: "본인인증 서비스를 이용할 수 없습니다. 관리자에게 문의하세요." });
        }
        console.log("[PortOne 테스트 모드] identityVerificationId:", identityVerificationId);
        
        // 테스트용 고정 DI 생성 (동일 세션에서 중복 확인 가능)
        const testDi = `test_di_${identityVerificationId}`;
        
        // 중복 가입 확인 (테스트 모드에서도 DI 확인)
        const existingUser = await storage.getUserByDi(testDi);
        if (existingUser) {
          await logAuthEvent(req, "identity_verification_failed", "failure", {
            provider: "portone",
            metadata: { reason: "duplicate_di", testMode: true }
          });
          return res.status(409).json({ message: "이미 가입된 계정이 있습니다" });
        }
        
        await logAuthEvent(req, "identity_verification", "success", {
          provider: "portone",
          metadata: { testMode: true, di: testDi }
        });
        
        // 테스트용 mock 데이터 반환
        return res.json({
          success: true,
          verified: true,
          customer: {
            name: "테스트사용자",
            phoneNumber: "01012345678",
            birthDate: "1990-01-01",
            gender: "MALE",
            ci: `test_ci_${identityVerificationId}`,
            di: testDi,
          },
          message: "테스트 모드: 본인인증이 완료되었습니다"
        });
      }

      // 실제 PortOne API 호출
      const verificationResponse = await fetch(
        `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
        {
          headers: {
            Authorization: `PortOne ${PORTONE_API_SECRET}`,
          },
        }
      );

      if (!verificationResponse.ok) {
        const error = await verificationResponse.json();
        console.error("PortOne verification error:", error);
        await logAuthEvent(req, "identity_verification_failed", "failure", {
          provider: "portone",
          metadata: { reason: "api_error", statusCode: verificationResponse.status }
        });
        return res.status(400).json({ message: "본인인증 정보 조회에 실패했습니다" });
      }

      const identityVerification: any = await verificationResponse.json();

      // 응답 검증 강화: 필수 필드 확인
      if (!identityVerification || typeof identityVerification !== "object") {
        await logAuthEvent(req, "identity_verification_failed", "failure", {
          provider: "portone",
          metadata: { reason: "invalid_response_format" }
        });
        return res.status(400).json({ message: "본인인증 응답이 올바르지 않습니다" });
      }

      if (identityVerification.status !== "VERIFIED") {
        await logAuthEvent(req, "identity_verification_failed", "failure", {
          provider: "portone",
          metadata: { reason: "not_verified", status: identityVerification.status }
        });
        return res.status(400).json({ message: "본인인증이 완료되지 않았습니다" });
      }

      // verifiedCustomer 필수 필드 검증
      const verifiedCustomer = identityVerification.verifiedCustomer;
      if (!verifiedCustomer || !verifiedCustomer.di || !verifiedCustomer.name) {
        await logAuthEvent(req, "identity_verification_failed", "failure", {
          provider: "portone",
          metadata: { reason: "missing_customer_data" }
        });
        return res.status(400).json({ message: "본인인증 정보가 불완전합니다" });
      }

      const { ci, di, name, gender, birthDate, phoneNumber } = verifiedCustomer;

      // 중복 가입 확인 (DI 기준)
      if (di) {
        const existingUser = await storage.getUserByDi(di);
        if (existingUser) {
          await logAuthEvent(req, "identity_verification_failed", "failure", {
            provider: "portone",
            metadata: { reason: "duplicate_di" }
          });
          return res.status(409).json({ message: "이미 가입된 계정이 있습니다" });
        }
      }

      // 성공 로그 (민감정보 제외)
      await logAuthEvent(req, "identity_verification", "success", {
        provider: "portone",
        metadata: { 
          hasCI: !!ci,
          hasDI: !!di,
          hasPhone: !!phoneNumber,
        }
      });

      res.json({
        success: true,
        verified: true,
        customer: {
          name,
          phoneNumber,
          birthDate,
          gender,
          ci,
          di,
        },
        message: "본인인증이 완료되었습니다"
      });
    } catch (err: any) {
      console.error("Identity verification error:", err);
      await logAuthEvent(req, "identity_verification_failed", "failure", {
        provider: "portone",
        metadata: { error: (err as Error).message }
      });
      res.status(500).json({ message: "본인인증 처리 중 오류가 발생했습니다" });
    }
  });

  // ============================================
  // 결제 인텐트 API (네이티브 앱용 보안 결제)
  // ============================================

  // 결제 인텐트 생성 (토큰을 WebView에 노출하지 않음)
  app.post("/api/payments/intent", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, contractId, amount, paymentType, orderTitle } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "유효한 결제 금액이 필요합니다" });
      }

      // 결제 ID 생성 (유니크)
      const paymentId = `pay_${paymentType || 'payment'}_${orderId || contractId || 'direct'}_${Date.now()}_${randomBytes(4).toString('hex')}`;

      const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
      const PORTONE_STORE_ID = process.env.PORTONE_STORE_ID;
      const baseUrl = process.env.OAUTH_BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

      // 운영 환경에서는 PortOne API 필수
      if (isProduction && !PORTONE_API_SECRET) {
        console.error("[Payment Intent] PORTONE_API_SECRET not configured in production");
        return res.status(503).json({ message: "결제 서비스를 이용할 수 없습니다. 관리자에게 문의하세요." });
      }

      // PortOne V2 결제 URL 생성
      if (PORTONE_API_SECRET && PORTONE_STORE_ID) {
        try {
          // PortOne checkout URL 형식으로 반환
          // 실제로는 PortOne SDK를 통해 결제 페이지를 로드해야 함
          const checkoutParams = new URLSearchParams({
            storeId: PORTONE_STORE_ID,
            paymentId: paymentId,
            orderName: orderTitle || `헬프미 ${paymentType === 'deposit' ? '계약금' : '잔금'} 결제`,
            totalAmount: String(amount),
            currency: 'KRW',
            payMethod: 'CARD',
            redirectUrl: `${baseUrl}/payment/callback?status=success`,
            failUrl: `${baseUrl}/payment/callback?status=fail`,
          });

          // 결제 정보를 DB에 저장 (필수)
          await storage.createPayment({
            payerId: userId,
            provider: 'portone',
            providerPaymentId: paymentId,
            amount,
            currency: 'KRW',
            paymentType: paymentType || 'deposit',
            status: 'initiated',
            orderId: orderId ? parseInt(orderId) : undefined,
            contractId: contractId ? parseInt(contractId) : undefined,
          });
          console.log(`[Payment Intent] Payment record created: ${paymentId}`);

          // 서버 측 결제 페이지 URL 반환
          const paymentUrl = `${baseUrl}/payment/checkout?${checkoutParams.toString()}`;

          return res.json({
            success: true,
            paymentId,
            paymentUrl,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          });
        } catch (err: any) {
          console.error("[Payment Intent] PortOne error:", err);
          return res.status(500).json({ message: "결제 URL 생성에 실패했습니다" });
        }
      }

      // 개발 환경 테스트 모드
      const testPaymentUrl = `${baseUrl}/payment/test-checkout?paymentId=${paymentId}&amount=${amount}&orderTitle=${encodeURIComponent(orderTitle || '테스트 결제')}`;

      res.json({
        success: true,
        paymentId,
        paymentUrl: testPaymentUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        isTestMode: true,
      });
    } catch (err: any) {
      console.error("[Payment Intent] Error:", err);
      res.status(500).json({ message: "결제 초기화에 실패했습니다" });
    }
  });

  // 결제 상태 확인
  app.get("/api/payments/:paymentId/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { paymentId } = req.params;
      
      // DB에서 결제 상태 조회
      const payment = await storage.getPaymentByProviderPaymentId(paymentId);
      
      if (!payment) {
        return res.status(404).json({ 
          paymentId,
          status: 'not_found',
          message: '결제 정보를 찾을 수 없습니다'
        });
      }
      
      res.json({
        paymentId,
        status: payment.status || 'initiated',
        amount: payment.amount,
        paymentType: payment.paymentType,
        paidAt: payment.paidAt,
        provider: payment.provider,
      });
    } catch (err: any) {
      console.error("[Payment Status] Error:", err);
      res.status(500).json({ message: "결제 상태 조회에 실패했습니다" });
    }
  });

  // 결제 완료 확정 (WebView 성공 후 서버 검증)
  app.post("/api/payments/:paymentId/verify", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { paymentId } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ verified: false, message: "로그인이 필요합니다" });
      }
      
      const payment = await storage.getPaymentByProviderPaymentId(paymentId);
      
      if (!payment) {
        return res.status(404).json({ verified: false, message: '결제 정보를 찾을 수 없습니다' });
      }

      if (payment.payerId !== userId) {
        return res.status(403).json({ verified: false, message: '권한이 없습니다' });
      }

      if (payment.status === 'captured' || payment.status === 'completed') {
        return res.json({
          verified: true,
          status: payment.status,
          amount: payment.amount,
          paymentType: payment.paymentType,
          paidAt: payment.paidAt,
        });
      }

      const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
      if (PORTONE_API_SECRET && payment.provider === 'portone') {
        try {
          const portoneResponse = await fetch(
            `https://api.portone.io/payments/${paymentId}`,
            { headers: { 'Authorization': `PortOne ${PORTONE_API_SECRET}` } }
          );
          
          if (portoneResponse.ok) {
            const portoneData: any = await portoneResponse.json();
            
            if (portoneData.status === 'PAID') {
              await storage.updatePaymentStatus(payment.id, 'captured', {
                paidAt: new Date(),
                providerPaymentId: portoneData.paymentId,
              });
              
              if (payment.contractId) {
                const contract = await storage.getContract(payment.contractId);
                if (contract && payment.paymentType === 'deposit') {
                  await storage.updateContract(payment.contractId, { status: 'active', depositPaidAt: new Date() });
                  if (contract.orderId) {
                    await storage.updateOrder(contract.orderId, { status: 'scheduled' });
                  }
                } else if (contract && payment.paymentType === 'balance') {
                  await storage.updateContract(payment.contractId, { balancePaidAt: new Date() });
                }
              }
              
              console.log(`[Payment Verify] Payment ${paymentId} verified as PAID via PortOne`);
              return res.json({ verified: true, status: 'captured', amount: payment.amount, paymentType: payment.paymentType, paidAt: new Date() });
            } else if (portoneData.status === 'FAILED' || portoneData.status === 'CANCELLED') {
              await storage.updatePaymentStatus(payment.id, 'failed');
              return res.json({ verified: false, status: 'failed', message: '결제가 실패하거나 취소되었습니다' });
            } else {
              return res.json({ verified: false, status: payment.status, message: '결제가 아직 처리 중입니다' });
            }
          }
        } catch (portoneError) {
          console.error("[Payment Verify] PortOne API error:", portoneError);
        }
      }

      if (!isProduction && payment.status === 'initiated') {
        await storage.updatePaymentStatus(payment.id, 'captured', { paidAt: new Date() });
        
        if (payment.contractId) {
          const contract = await storage.getContract(payment.contractId);
          if (contract && payment.paymentType === 'deposit') {
            await storage.updateContract(payment.contractId, { status: 'active', depositPaidAt: new Date() });
            if (contract.orderId) {
              await storage.updateOrder(contract.orderId, { status: 'scheduled' });
            }
          }
        }
        
        console.log(`[Payment Verify] Test mode - Payment ${paymentId} marked as captured`);
        return res.json({ verified: true, status: 'captured', amount: payment.amount, paymentType: payment.paymentType, paidAt: new Date(), isTestMode: true });
      }
      
      res.json({
        verified: payment.status === 'captured' || payment.status === 'completed',
        status: payment.status,
        amount: payment.amount,
        paymentType: payment.paymentType,
        paidAt: payment.paidAt,
      });
    } catch (err: any) {
      console.error("[Payment Verify] Error:", err);
      res.status(500).json({ verified: false, message: "결제 검증에 실패했습니다" });
    }
  });

  // ============================================
  // 가상계좌 결제 API
  // ============================================

  // 가상계좌 발급 요청 (계약금)
  app.post("/api/payment/virtual-account/request", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, amount } = req.body;

      if (!orderId || !amount) {
        return res.status(400).json({ message: "주문 ID와 금액이 필요합니다" });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
      }

      // 기존 가상계좌가 있는지 확인
      const existingAccount = await storage.getVirtualAccountByOrder(orderId);
      if (existingAccount && existingAccount.status === "pending") {
        return res.json({
          success: true,
          virtualAccount: existingAccount,
          message: "기존 가상계좌를 사용해주세요"
        });
      }

      const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
      const paymentId = `payment_${orderId}_${Date.now()}`;
      
      // PortOne API 사용 가능한 경우
      if (PORTONE_API_SECRET) {
        // PortOne V2 가상계좌 결제 요청
        const paymentResponse = await fetch("https://api.portone.io/payments/" + paymentId + "/virtual-account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `PortOne ${PORTONE_API_SECRET}`,
          },
          body: JSON.stringify({
            storeId: process.env.PORTONE_STORE_ID,
            channelKey: process.env.PORTONE_CHANNEL_KEY,
            orderName: `오더 #${orderId} 계약금`,
            totalAmount: amount,
            currency: "KRW",
            customer: {
              name: order.companyName || "의뢰인",
            },
            virtualAccount: {
              bank: "SHINHAN", // 기본 은행 (설정 가능)
              accountExpiry: {
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24시간 후 만료
              },
            },
          }),
        });

        const paymentData = await paymentResponse.json() as any;
        
        if (paymentData.virtualAccount) {
          const virtualAccount = await storage.createVirtualAccount({
            orderId,
            userId,
            paymentId,
            bankCode: paymentData.virtualAccount.bank,
            bankName: getBankName(paymentData.virtualAccount.bank),
            accountNumber: paymentData.virtualAccount.accountNumber,
            accountHolder: paymentData.virtualAccount.accountHolder || "헬프미",
            amount,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "pending",
          });

          return res.json({
            success: true,
            virtualAccount,
            message: "가상계좌가 발급되었습니다"
          });
        }
      }
      
      // 운영 환경에서는 PortOne API 필수
      if (isProduction) {
        console.error("[Virtual Account] PORTONE_API_SECRET not configured in production");
        return res.status(503).json({ message: "결제 서비스를 이용할 수 없습니다. 관리자에게 문의하세요." });
      }
      
      // 개발 환경 테스트 모드
      const testVirtualAccount = await storage.createVirtualAccount({
        orderId,
        userId,
        paymentId,
        bankCode: "088",
        bankName: "신한은행",
        accountNumber: `110${String(orderId).padStart(3, "0")}${Date.now().toString().slice(-6)}`,
        accountHolder: "헬프미(주)",
        amount,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "pending",
      });

      res.json({
        success: true,
        virtualAccount: testVirtualAccount,
        isTestMode: true,
        message: "테스트 가상계좌가 발급되었습니다"
      });
    } catch (err: any) {
      console.error("Virtual account request error:", err);
      res.status(500).json({ message: "가상계좌 발급 중 오류가 발생했습니다" });
    }
  });

  // 가상계좌 정보 조회
  app.get("/api/payment/virtual-account/:orderId", requireAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const virtualAccount = await storage.getVirtualAccountByOrder(orderId);
      
      if (!virtualAccount) {
        return res.status(404).json({ message: "가상계좌를 찾을 수 없습니다" });
      }

      res.json({ virtualAccount });
    } catch (err: any) {
      console.error("Virtual account fetch error:", err);
      res.status(500).json({ message: "가상계좌 조회 중 오류가 발생했습니다" });
    }
  });

  // PortOne 입금 확인 웹훅 (PG사에서 호출)
  app.post("/api/webhook/portone/payment", async (req, res) => {
    try {
      // A-1: PortOne 웹훅 서명 검증 (보안 강화)
      const signature = req.headers["portone-signature"] as string;
      const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
      
      if (webhookSecret) {
        // PortOne V2 서명 검증 방식
        const rawBody = JSON.stringify(req.body);
        const expectedSignature = createHmac("sha256", webhookSecret)
          .update(rawBody)
          .digest("hex");
        
        if (signature !== expectedSignature) {
          console.warn("[PortOne Webhook] Invalid signature", {
            received: signature?.substring(0, 10),
            expected: expectedSignature?.substring(0, 10),
          });
          return res.status(401).json({ success: false, message: "Invalid signature" });
        }
        
        console.log("[PortOne Webhook] Signature verified ✓");
      } else {
        // 개발 환경: 레거시 헤더 방식 폴백
        const legacySecret = req.headers["x-webhook-secret"] || req.headers["webhook-secret"];
        if (legacySecret !== process.env.PORTONE_LEGACY_SECRET) {
          console.warn("[PortOne Webhook] Invalid legacy webhook secret");
          return res.status(401).json({ success: false, message: "Invalid webhook secret" });
        }
      }

      const { paymentId, status, paidAmount, paidAt } = req.body;

      console.log("[PortOne Webhook] Received:", { paymentId, status, paidAmount });

      // 웹훅 로그 저장
      const [webhookLog] = await db.insert(webhookLogs).values({
        source: "portone",
        eventType: `payment.${status?.toLowerCase() || "unknown"}`,
        webhookId: paymentId,
        payload: JSON.stringify(req.body),
        status: "received",
        relatedEntityType: "payment",
        relatedEntityId: paymentId,
        idempotencyKey: paymentId,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      }).returning();

      if (status === "PAID" || status === "VIRTUAL_ACCOUNT_ISSUED") {
        // paymentId로 가상계좌 조회
        const virtualAccount = await storage.getVirtualAccountByPaymentId(paymentId);
        
        if (!virtualAccount) {
          console.warn(`[PortOne Webhook] Virtual account not found for paymentId: ${paymentId}`);
          return res.json({ success: true, message: "Virtual account not found" });
        }
        
        // A-2: 멱등 처리 (이미 처리된 경우 스킵)
        if (virtualAccount.status === "paid") {
          console.log(`[PortOne Webhook] Already processed: paymentId=${paymentId}`);
          return res.json({ success: true, message: "Already processed" });
        }
        
        if (status === "PAID") {
          // 가상계좌 상태 업데이트
          await storage.updateVirtualAccount(virtualAccount.id, {
            status: "paid",
            paidAmount,
            paidAt: paidAt ? new Date(paidAt) : new Date(),
            webhookReceivedAt: new Date(),
          });

          // B: 오더 상태 자동 변경 (awaiting_deposit → open) + approvalStatus 포함
          const order = await storage.getOrder(virtualAccount.orderId);
          if (order && order.status === ORDER_STATUS.AWAITING_DEPOSIT) {
            const updatedOrder = await storage.updateOrder(virtualAccount.orderId, {
              status: ORDER_STATUS.OPEN,
              paymentStatus: "deposit_confirmed",
              approvalStatus: "approved",
            });
            
            // 업데이트 성공 확인 후에만 브로드캐스트
            if (updatedOrder) {
              console.log(`[Auto Approve] Order ${virtualAccount.orderId} approved after deposit confirmation`);
              
              // D: 관리자 WS 브로드캐스트 (실시간 UI 갱신) - 업데이트 성공 후에만 실행
              try {
                await broadcastToAllAdmins("order", "payment_auto_approved", virtualAccount.orderId, {
                  orderId: virtualAccount.orderId,
                  paymentId,
                  status: ORDER_STATUS.OPEN,
                  paymentStatus: "deposit_confirmed",
                  approvalStatus: "approved",
                  paidAmount,
                });
              } catch (wsErr) {
                console.error("Admin broadcast error:", wsErr);
              }
            }
            
            // 푸시 알림 발송
            try {
              if (order.requesterId) {
                const user = await storage.getUser(order.requesterId);
                if (user) {
                  await storage.createNotification({
                    userId: user.id,
                    type: "order_approved",
                    title: "오더 승인 완료",
                    message: `오더 #${virtualAccount.orderId}의 계약금 입금이 확인되어 승인되었습니다.`,
                    relatedId: virtualAccount.orderId,
                  });
                }
              }
            } catch (notifyErr) {
              console.error("Notification error:", notifyErr);
            }
          }
        }
      }

      // 웹훅 로그 처리 완료
      if (webhookLog) {
        await db.update(webhookLogs)
          .set({ status: "processed", processedAt: new Date() })
          .where(eq(webhookLogs.id, webhookLog.id));
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      // 웹훅 로그 실패 기록
      try {
        const { paymentId: failedPaymentId } = req.body || {};
        if (failedPaymentId) {
          await db.update(webhookLogs)
            .set({ status: "failed", errorMessage: (err as Error).message })
            .where(eq(webhookLogs.webhookId, failedPaymentId));
        }
      } catch (_) {}
      res.status(500).json({ message: "웹훅 처리 오류" });
    }
  });

  // C: 테스트용 입금 확인 API (개발 환경에서만 - 운영에서는 비활성화)
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/payment/virtual-account/:orderId/confirm-test", async (req, res) => {
      try {
        const orderId = parseInt(req.params.orderId);
        const virtualAccount = await storage.getVirtualAccountByOrder(orderId);
        
        if (!virtualAccount) {
          return res.status(404).json({ message: "가상계좌를 찾을 수 없습니다" });
        }

        // 가상계좌 상태 업데이트
        await storage.updateVirtualAccount(virtualAccount.id, {
          status: "paid",
          paidAmount: virtualAccount.amount,
          paidAt: new Date(),
          webhookReceivedAt: new Date(),
        });

        // 오더 상태 자동 변경 + approvalStatus 포함
        const order = await storage.getOrder(orderId);
        if (order && order.status === ORDER_STATUS.AWAITING_DEPOSIT) {
          await storage.updateOrder(orderId, {
            status: ORDER_STATUS.OPEN,
            paymentStatus: "deposit_confirmed",
            approvalStatus: "approved",
          });
          
          // 관리자 WS 브로드캐스트
          await broadcastToAllAdmins("order", "payment_test_approved", orderId, {
            orderId,
            status: ORDER_STATUS.OPEN,
            paymentStatus: "deposit_confirmed",
            approvalStatus: "approved",
          });
        }

        res.json({ 
          success: true, 
          message: "테스트 입금이 확인되었습니다",
          orderStatus: ORDER_STATUS.OPEN
        });
      } catch (err: any) {
        console.error("Test confirm error:", err);
        res.status(500).json({ message: "테스트 입금 확인 오류" });
      }
    });
  }

  // 은행 코드 → 은행명 변환
  function getBankName(bankCode: string): string {
    const banks: Record<string, string> = {
      "SHINHAN": "신한은행",
      "KB": "국민은행",
      "WOORI": "우리은행",
      "HANA": "하나은행",
      "NH": "농협은행",
      "IBK": "기업은행",
      "SC": "SC제일은행",
      "CITI": "씨티은행",
      "KAKAO": "카카오뱅크",
      "TOSS": "토스뱅크",
      "KBANK": "케이뱅크",
    };
    return banks[bankCode] || bankCode;
  }

  // 카카오 로그인 시작 (기존 - 호환성 유지)
  app.get("/api/auth/kakao", (req, res) => {
    const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
    const REDIRECT_URI = `${baseUrl}/api/auth/kakao/callback`;
    const role = req.query.role || "helper";
    
    console.log("[Kakao] Redirect URI:", REDIRECT_URI);
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${role}`;
    res.redirect(kakaoAuthUrl);
  });

  // 카카오 로그인 - 헬퍼 전용
  app.get("/api/auth/kakao/helper", (req, res) => {
    const KAKAO_REST_API_KEY = process.env.KAKAO_HELPER_REST_API_KEY || process.env.KAKAO_REST_API_KEY;
    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
    const REDIRECT_URI = `${baseUrl}/api/auth/kakao/helper/callback`;
    
    console.log("[Kakao Helper] Redirect URI:", REDIRECT_URI);
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=helper`;
    res.redirect(kakaoAuthUrl);
  });

  // 카카오 로그인 - 의뢰인 전용
  app.get("/api/auth/kakao/requester", (req, res) => {
    const KAKAO_REST_API_KEY = process.env.KAKAO_REQUESTER_REST_API_KEY || process.env.KAKAO_REST_API_KEY;
    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
    const REDIRECT_URI = `${baseUrl}/api/auth/kakao/requester/callback`;
    
    console.log("[Kakao Requester] Redirect URI:", REDIRECT_URI);
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=requester`;
    res.redirect(kakaoAuthUrl);
  });

  // 카카오 로그인 콜백 - 헬퍼 전용
  app.get("/api/auth/kakao/helper/callback", async (req, res) => {
    try {
      const { code } = req.query;
      const KAKAO_REST_API_KEY = process.env.KAKAO_HELPER_REST_API_KEY || process.env.KAKAO_REST_API_KEY;
      const protocol = req.get("x-forwarded-proto") || req.protocol;
      const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
      const REDIRECT_URI = `${baseUrl}/api/auth/kakao/helper/callback`;
      console.log("[Kakao Helper Callback] Redirect URI:", REDIRECT_URI);

      const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: KAKAO_REST_API_KEY!,
          redirect_uri: REDIRECT_URI,
          code: code as string,
        }),
      });

      const tokenData = await tokenResponse.json() as any;
      if (!tokenData.access_token) {
        await logAuthEvent(req, "social_login_failed", "failure", {
          provider: "kakao",
          metadata: { reason: "token_failed", role: "helper" }
        });
        return res.redirect("/signup?error=kakao_token_failed&role=helper");
      }

      const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = await userResponse.json() as any;
      const kakaoId = userData.id?.toString();
      const kakaoAccount = userData.kakao_account || {};
      const profile = kakaoAccount.profile || {};
      const email = kakaoAccount.email;
      const name = profile.nickname || `카카오사용자${kakaoId?.slice(-4)}`;

      let user = await storage.getUserByKakaoId(kakaoId);
      if (!user && email) {
        user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, { kakaoId });
        }
      }

      if (user) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        await logAuthEvent(req, "social_login", "success", {
          userId: user.id,
          provider: "kakao",
          metadata: { kakaoId, role: "helper" }
        });
        const userPayload = encodeURIComponent(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHqStaff: user.isHqStaff,
        }));
        return res.redirect(`/auth-callback?token=${token}&user=${userPayload}`);
      }

      await logAuthEvent(req, "social_signup", "pending", {
        provider: "kakao",
        metadata: { kakaoId, email, role: "helper" }
      });
      const signupData = encodeURIComponent(JSON.stringify({
        provider: "kakao",
        kakaoId,
        email: email || "",
        name,
        role: "helper",
      }));
      res.redirect(`/signup?social=${signupData}`);
    } catch (err: any) {
      console.error("Kakao helper login error:", err);
      await logAuthEvent(req, "social_login_failed", "failure", {
        provider: "kakao",
        metadata: { error: (err as Error).message, role: "helper" }
      });
      res.redirect("/signup?error=kakao_failed&role=helper");
    }
  });

  // 카카오 로그인 콜백 - 의뢰인 전용
  app.get("/api/auth/kakao/requester/callback", async (req, res) => {
    try {
      const { code } = req.query;
      const KAKAO_REST_API_KEY = process.env.KAKAO_REQUESTER_REST_API_KEY || process.env.KAKAO_REST_API_KEY;
      const protocol = req.get("x-forwarded-proto") || req.protocol;
      const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
      const REDIRECT_URI = `${baseUrl}/api/auth/kakao/requester/callback`;
      console.log("[Kakao Requester Callback] Redirect URI:", REDIRECT_URI);

      const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: KAKAO_REST_API_KEY!,
          redirect_uri: REDIRECT_URI,
          code: code as string,
        }),
      });

      const tokenData = await tokenResponse.json() as any;
      if (!tokenData.access_token) {
        await logAuthEvent(req, "social_login_failed", "failure", {
          provider: "kakao",
          metadata: { reason: "token_failed", role: "requester" }
        });
        return res.redirect("/signup?error=kakao_token_failed&role=requester");
      }

      const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = await userResponse.json() as any;
      const kakaoId = userData.id?.toString();
      const kakaoAccount = userData.kakao_account || {};
      const profile = kakaoAccount.profile || {};
      const email = kakaoAccount.email;
      const name = profile.nickname || `카카오사용자${kakaoId?.slice(-4)}`;

      let user = await storage.getUserByKakaoId(kakaoId);
      if (!user && email) {
        user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, { kakaoId });
        }
      }

      if (user) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        await logAuthEvent(req, "social_login", "success", {
          userId: user.id,
          provider: "kakao",
          metadata: { kakaoId, role: "requester" }
        });
        const userPayload = encodeURIComponent(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHqStaff: user.isHqStaff,
        }));
        return res.redirect(`/auth-callback?token=${token}&user=${userPayload}`);
      }

      await logAuthEvent(req, "social_signup", "pending", {
        provider: "kakao",
        metadata: { kakaoId, email, role: "requester" }
      });
      const signupData = encodeURIComponent(JSON.stringify({
        provider: "kakao",
        kakaoId,
        email: email || "",
        name,
        role: "requester",
      }));
      res.redirect(`/signup?social=${signupData}`);
    } catch (err: any) {
      console.error("Kakao requester login error:", err);
      await logAuthEvent(req, "social_login_failed", "failure", {
        provider: "kakao",
        metadata: { error: (err as Error).message, role: "requester" }
      });
      res.redirect("/signup?error=kakao_failed&role=requester");
    }
  });

  // 카카오 로그인 콜백 (기존 - 호환성 유지)
  app.get("/api/auth/kakao/callback", async (req, res) => {
    try {
      const { code, state: role } = req.query;
      const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
      const protocol = req.get("x-forwarded-proto") || req.protocol;
      const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
      const REDIRECT_URI = `${baseUrl}/api/auth/kakao/callback`;
      console.log("[Kakao Callback] Redirect URI:", REDIRECT_URI);

      // 액세스 토큰 요청
      const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: KAKAO_REST_API_KEY!,
          redirect_uri: REDIRECT_URI,
          code: code as string,
        }),
      });

      const tokenData = await tokenResponse.json() as any;
      if (!tokenData.access_token) {
        await logAuthEvent(req, "social_login_failed", "failure", {
          provider: "kakao",
          metadata: { reason: "token_failed" }
        });
        return res.redirect("/signup?error=kakao_token_failed");
      }

      // 사용자 정보 요청
      const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = await userResponse.json() as any;
      const kakaoId = userData.id?.toString();
      const kakaoAccount = userData.kakao_account || {};
      const profile = kakaoAccount.profile || {};

      const email = kakaoAccount.email;
      const name = profile.nickname || `카카오사용자${kakaoId?.slice(-4)}`;

      // 기존 사용자 확인 (카카오 ID 또는 이메일로)
      let user = await storage.getUserByKakaoId(kakaoId);
      
      if (!user && email) {
        user = await storage.getUserByEmail(email);
        if (user) {
          // 이메일로 찾은 경우 카카오 ID 연결
          await storage.updateUser(user.id, { kakaoId });
        }
      }

      if (user) {
        // 기존 사용자 로그인
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        await logAuthEvent(req, "social_login", "success", {
          userId: user.id,
          provider: "kakao",
          metadata: { kakaoId }
        });
        const userPayload = encodeURIComponent(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHqStaff: user.isHqStaff,
        }));
        return res.redirect(`/auth-callback?token=${token}&user=${userPayload}`);
      }

      // 신규 사용자: 회원가입 페이지로 이동
      await logAuthEvent(req, "social_signup", "pending", {
        provider: "kakao",
        metadata: { kakaoId, email }
      });
      const signupData = encodeURIComponent(JSON.stringify({
        provider: "kakao",
        kakaoId,
        email: email || "",
        name,
        role: role || "helper",
      }));
      res.redirect(`/signup?social=${signupData}`);
    } catch (err: any) {
      console.error("Kakao login error:", err);
      await logAuthEvent(req, "social_login_failed", "failure", {
        provider: "kakao",
        metadata: { error: (err as Error).message }
      });
      res.redirect("/signup?error=kakao_failed");
    }
  });

  // 네이버 로그인 시작
  app.get("/api/auth/naver", (req, res) => {
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
    const REDIRECT_URI = `${baseUrl}/api/auth/naver/callback`;
    const role = req.query.role || "helper";
    const state = Buffer.from(JSON.stringify({ role })).toString("base64");
    
    console.log("[Naver] Redirect URI:", REDIRECT_URI);
    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${state}`;
    res.redirect(naverAuthUrl);
  });

  // 네이버 로그인 콜백
  app.get("/api/auth/naver/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
      const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
      const protocol = req.get("x-forwarded-proto") || req.protocol;
      const baseUrl = OAUTH_BASE_URL || `${protocol}://${req.get("host")}`;
      const REDIRECT_URI = `${baseUrl}/api/auth/naver/callback`;
      console.log("[Naver Callback] Redirect URI:", REDIRECT_URI);

      let role = "helper";
      try {
        const stateData = JSON.parse(Buffer.from(state as string, "base64").toString());
        role = stateData.role || "helper";
      } catch {}

      // 액세스 토큰 요청
      const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: NAVER_CLIENT_ID!,
          client_secret: NAVER_CLIENT_SECRET!,
          redirect_uri: REDIRECT_URI,
          code: code as string,
          state: state as string,
        }),
      });

      const tokenData = await tokenResponse.json() as any;
      if (!tokenData.access_token) {
        await logAuthEvent(req, "social_login_failed", "failure", {
          provider: "naver",
          metadata: { reason: "token_failed" }
        });
        return res.redirect("/signup?error=naver_token_failed");
      }

      // 사용자 정보 요청
      const userResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = await userResponse.json() as any;
      const naverUser = userData.response || {};
      const naverId = naverUser.id;
      const email = naverUser.email;
      const name = naverUser.name || naverUser.nickname || `네이버사용자${naverId?.slice(-4)}`;
      const phoneNumber = naverUser.mobile?.replace(/-/g, "");

      // 기존 사용자 확인 (네이버 ID 또는 이메일로)
      let user = await storage.getUserByNaverId(naverId);
      
      if (!user && email) {
        user = await storage.getUserByEmail(email);
        if (user) {
          // 이메일로 찾은 경우 네이버 ID 연결
          await storage.updateUser(user.id, { naverId });
        }
      }

      if (user) {
        // 기존 사용자 로그인
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        await logAuthEvent(req, "social_login", "success", {
          userId: user.id,
          provider: "naver",
          metadata: { naverId }
        });
        const userPayload = encodeURIComponent(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHqStaff: user.isHqStaff,
        }));
        return res.redirect(`/auth-callback?token=${token}&user=${userPayload}`);
      }

      // 신규 사용자: 회원가입 페이지로 이동
      await logAuthEvent(req, "social_signup", "pending", {
        provider: "naver",
        metadata: { naverId, email }
      });
      const signupData = encodeURIComponent(JSON.stringify({
        provider: "naver",
        naverId,
        email: email || "",
        name,
        phoneNumber: phoneNumber || "",
        role,
      }));
      res.redirect(`/signup?social=${signupData}`);
    } catch (err: any) {
      console.error("Naver login error:", err);
      await logAuthEvent(req, "social_login_failed", "failure", {
        provider: "naver",
        metadata: { error: (err as Error).message }
      });
      res.redirect("/signup?error=naver_failed");
    }
  });


  // === Change Password & Delete Account ===
  app.post("/api/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 입력해주세요" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "비밀번호는 6자 이상이어야 합니다" });
      }
      
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "현재 비밀번호가 일치하지 않습니다" });
      }
      
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedNewPassword });
      
      res.json({ success: true, message: "비밀번호가 변경되었습니다" });
    } catch (err: any) {
      // 운영 로그: 민감정보 제외
      console.error("[Auth] Password change failed:", (err as Error).message?.substring(0, 50));
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User account deletion (회원 탈퇴)
  app.delete("/api/auth/delete-account", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      
      // Soft delete by marking user as deleted (email/username prefixed to prevent reuse)
      await storage.updateUser(userId, { 
        email: `deleted_${Date.now()}_${user.email}`,
        username: `deleted_${Date.now()}_${user.username}`,
      });
      
      res.json({ success: true, message: "회원 탈퇴가 완료되었습니다" });
    } catch (err: any) {
      console.error("Account deletion error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}