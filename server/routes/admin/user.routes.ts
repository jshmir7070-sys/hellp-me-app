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
import { withTransaction } from "../../utils/transactions";

export async function registerUserRoutes(ctx: RouteContext): Promise<void> {
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

  // Admin user list
  app.get("/api/admin/users", adminAuth, requirePermission("staff.view"), async (req, res) => {
    try {
      const roleFilter = req.query.role as string | undefined;
      let users = await storage.getAllUsers();

      // Filter by role if specified
      if (roleFilter) {
        const roles = roleFilter.split(',').map(r => r.trim());
        users = users.filter(u => {
          // For helper/requester queries, exclude admin roles
          if (roles.includes('helper') || roles.includes('requester')) {
            if (u.role === 'superadmin' || u.role === 'admin' || u.isHqStaff) {
              return false;
            }
          }
          return roles.includes(u.role);
        });
      }

      const usersWithParsedPerms = users.map(u => ({ ...u, menuPermissions: u.menuPermissions ? JSON.parse(u.menuPermissions) : [] })); res.json(usersWithParsedPerms);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user (admin)
  app.patch("/api/admin/users/:userId", adminAuth, requirePermission("staff.edit"), async (req, res) => {
    try {
      const updated = await storage.updateUser(req.params.userId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/admin/operators - Create new operator (admin user)
  const createOperatorSchema = z.object({
    name: z.string().min(1, "이름을 입력해주세요"),
    email: z.string().email("유효한 이메일을 입력해주세요"),
    password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
    phone: z.string().optional(),
    address: z.string().optional(),
    role: z.enum(["admin", "superadmin"]).default("admin"),
    position: z.string().optional(),
    department: z.string().optional(),
  });

  app.post("/api/admin/operators", adminAuth, requirePermission("staff.create"), async (req, res) => {
    try {
      const parseResult = createOperatorSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "입력값이 유효하지 않습니다",
          errors: parseResult.error.errors
        });
      }

      const { name, email, password, phone, address, role, position, department } = parseResult.data;

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "이미 사용 중인 이메일입니다" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate unique username from email
      const username = email.split("@")[0] + "_" + Date.now().toString(36);

      // Create user with admin role
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        phoneNumber: phone || null,
        address: address || null,
        role,
        isHqStaff: role === "admin" || role === "superadmin",
        adminStatus: "active",
        onboardingStatus: "approved",
      });

      // Update position and department if provided
      if (position || department) {
        await storage.updateUser(newUser.id, {
          position: position || null,
          department: department || null,
        });
      }

      // Fetch updated user to return
      const createdUser = await storage.getUser(newUser.id);
      if (!createdUser) {
        return res.status(500).json({ message: "사용자 생성 후 조회에 실패했습니다" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = createdUser;
      res.status(201).json(userWithoutPassword);
    } catch (err: any) {
      console.error("Create operator error:", err);
      res.status(500).json({ message: "운영자 생성에 실패했습니다" });
    }
  });

  // PATCH /api/admin/operators/:id - Update operator info
  const updateOperatorSchema = z.object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    position: z.string().optional(),
    department: z.string().optional(),
    role: z.enum(["admin", "superadmin"]).optional(),
    menuPermissions: z.array(z.string()).optional(), // 메뉴 접근 권한 배열
  });

  app.patch("/api/admin/operators/:id", adminAuth, requirePermission("staff.edit"), async (req, res) => {
    try {
      const { id } = req.params;

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "운영자를 찾을 수 없습니다" });
      }

      // Verify this is an operator (admin/superadmin with isHqStaff)
      if (!user.isHqStaff) {
        return res.status(400).json({ message: "이 사용자는 운영자가 아닙니다" });
      }

      const parseResult = updateOperatorSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "입력값이 유효하지 않습니다",
          errors: parseResult.error.errors
        });
      }

      const { name, phone, address, position, department, role, menuPermissions } = parseResult.data;

      // Build update object (excluding email and password)
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phoneNumber = phone;
      if (address !== undefined) updateData.address = address;
      if (position !== undefined) updateData.position = position;
      if (department !== undefined) updateData.department = department;
      if (menuPermissions !== undefined) updateData.menuPermissions = JSON.stringify(menuPermissions);
      if (role !== undefined) {
        updateData.role = role;
        updateData.isHqStaff = role === "admin" || role === "superadmin";
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "수정할 내용이 없습니다" });
      }

      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(500).json({ message: "운영자 수정에 실패했습니다" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (err: any) {
      console.error("Update operator error:", err);
      res.status(500).json({ message: "운영자 수정에 실패했습니다" });
    }
  });

  // Get all orders (admin) with requester info

  // End of User Routes
}
