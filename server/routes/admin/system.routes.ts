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
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  ORDER_STATUS,
  normalizeOrderStatus,
  isOneOfStatus,
} from "../../constants/order-status";
import {
  calculateVat,
  calculateSettlement,
  parseClosingReport,
} from "../../lib/settlement-calculator";

export async function registerSystemRoutes(ctx: RouteContext): Promise<void> {
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
    settlementPayoutAttempts, requesterRefundAccounts,
    regionPricingRules, vatSettings,
    orderRegistrationFields, orderClosureReports, payments,
    taxInvoices, courierSettings, signupConsents, termsVersions, termsReConsents,
    auditLogs, teamIncentives, incentiveDetails, userLocationLatest, userLocationLogs,
    destinationRegions, timeSlots, enterpriseAccounts,
    insertAdminBankAccountSchema, insertCarrierRateItemSchema, insertColdChainSettingSchema,
    insertCustomerServiceInquirySchema, insertDestinationPricingSchema, insertRefundPolicySchema,
    insertRequesterRefundAccountSchema, updateCustomerServiceInquirySchema,
  } = schema;

  type SettlementStatement = typeof settlementStatements.$inferSelect;

  // Import server-side utilities
  const { SETTLEMENT_STATUS } = await import("../../utils/admin-audit");
  const { CAN_SELECT_HELPER_STATUSES } = await import("../../constants/order-status");
  const { DEFAULT_COURIERS } = await import("../../constants/defaultCouriers");
  const { trackSettingChange } = await import("../../utils/setting-change-tracker");
  const { settingChangeHistory } = schema;
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

  // ==================== ADMIN DASHBOARD ROUTES ====================

  // GET /api/admin/dashboard/charts - Dashboard data
  app.get("/api/admin/dashboard/charts", adminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get counts
      const allOrders = await storage.getAllOrders();
      const allUsers = await db.select().from(users);
      const allDisputes = await db.select().from(disputes);

      const activeOrders = allOrders.filter(o => !['completed', 'closed', 'cancelled'].includes(o.status)).length;
      const newHelpers = allUsers.filter(u => u.role === 'helper' && new Date(u.createdAt) >= sevenDaysAgo).length;
      const newRequesters = allUsers.filter(u => u.role === 'requester' && new Date(u.createdAt) >= sevenDaysAgo).length;
      const openDisputes = allDisputes.filter(d => d.status === 'pending' || d.status === 'open').length;

      // Daily orders for last 7 days
      const dailyOrders: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        const count = allOrders.filter(o => o.createdAt && new Date(o.createdAt).toISOString().split('T')[0] === dateStr).length;
        dailyOrders.push({ date: dateStr, count });
      }

      // Category data
      const statusCounts: Record<string, number> = {};
      allOrders.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const categoryData = Object.entries(statusCounts).map(([name, value], i) => ({
        name, value, color: colors[i % colors.length]
      }));

      res.json({
        dailyOrders,
        monthlyOrders: [],
        categoryData,
        courierData: [],
        realtime: { activeOrders, newHelpers, newRequesters, openDisputes }
      });
    } catch (err: any) {
      console.error("[Admin Dashboard] Charts error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/admin/dashboard/settlement-stats - Settlement statistics
  app.get("/api/admin/dashboard/settlement-stats", adminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month } = req.query as { year?: string; month?: string };
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const period = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

      const statements = await db.select().from(settlementStatements)
        .where(eq(settlementStatements.period, period));

      const totalAmount = statements.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      const totalFees = statements.reduce((sum, s) => sum + Number(s.platformFee || 0), 0);
      const completedCount = statements.filter(s => s.status === 'completed').length;
      const pendingCount = statements.filter(s => s.status === 'pending').length;

      res.json({
        period,
        totalAmount,
        totalFees,
        completedCount,
        pendingCount,
        totalCount: statements.length,
        statements
      });
    } catch (err: any) {
      console.error("[Admin Dashboard] Settlement stats error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== ADMIN SETTINGS ROUTES ====================

  // Get all courier settings
  app.get("/api/admin/settings/couriers", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const settings = await storage.getAllCourierSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create courier setting
  app.post("/api/admin/settings/couriers", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const {
        courierName, category, basePricePerBox, minDeliveryFee, minTotal,
        commissionRate, urgentCommissionRate, urgentSurchargeRate, isDefault
      } = req.body;

      if (!courierName || !courierName.trim()) {
        return res.status(400).json({ message: "택배사 이름을 입력해주세요" });
      }

      const existing = await storage.getCourierSettingByName(courierName);
      if (existing) {
        return res.status(400).json({ message: "이미 존재하는 택배사입니다" });
      }
      const setting = await storage.createCourierSetting({
        courierName: courierName.trim(),
        category: category || 'parcel',
        basePricePerBox: Number(basePricePerBox) || 0,
        minDeliveryFee: Number(minDeliveryFee) || 0,
        minTotal: Number(minTotal) || 0,
        commissionRate: Number(commissionRate) || 0,
        urgentCommissionRate: Number(urgentCommissionRate) || 0,
        urgentSurchargeRate: Number(urgentSurchargeRate) || 0,
        isDefault: isDefault || false,
        isActive: true,
      });
      res.json(setting);
    } catch (err: any) {
      console.error("Create courier error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update courier setting
  app.patch("/api/admin/settings/couriers/:id", adminAuth, requirePermission("settings.edit"), async (req: any, res) => {
    try {
      const {
        category, basePricePerBox, minDeliveryFee, minTotal,
        commissionRate, urgentCommissionRate, urgentSurchargeRate,
        isDefault, isActive, sortOrder, applyToCategory,
        effectiveFrom, changeReason
      } = req.body;
      const updates: Record<string, any> = {};
      if (category !== undefined) updates.category = category;
      if (basePricePerBox !== undefined) updates.basePricePerBox = Number(basePricePerBox);
      if (req.body.etcPricePerBox !== undefined) updates.etcPricePerBox = Number(req.body.etcPricePerBox);
      if (minDeliveryFee !== undefined) updates.minDeliveryFee = Number(minDeliveryFee);
      if (minTotal !== undefined) updates.minTotal = Number(minTotal);
      if (commissionRate !== undefined) updates.commissionRate = Number(commissionRate);
      if (urgentCommissionRate !== undefined) updates.urgentCommissionRate = Number(urgentCommissionRate);
      if (urgentSurchargeRate !== undefined) updates.urgentSurchargeRate = Number(urgentSurchargeRate);
      if (isDefault !== undefined) updates.isDefault = isDefault;
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);

      // 변경 전 현재 값 조회
      const currentSetting = await storage.getCourierSettingById(Number(req.params.id));

      const trackResult = await trackSettingChange(storage, {
        settingType: "courier_settings",
        entityId: String(req.params.id),
        oldValue: currentSetting,
        newValue: updates,
        effectiveFrom,
        reason: changeReason,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => {
          // 카테고리 기본값 변경 시 해당 카테고리 전체 택배사에 적용
          if (currentSetting?.courierName.startsWith('(DEFAULT)') || applyToCategory) {
            const targetCategory = currentSetting?.category || category;
            if (targetCategory && minTotal !== undefined) {
              await storage.updateCourierSettingsByCategory(targetCategory, { minTotal: Number(minTotal) });
            }
          }
          return storage.updateCourierSetting(Number(req.params.id), updates);
        },
      });

      if (trackResult.scheduled) {
        return res.json({ message: "예약 적용 등록됨", scheduled: true, effectiveFrom });
      }
      res.json(trackResult.result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete courier setting
  app.delete("/api/admin/settings/couriers/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await storage.deleteCourierSetting(Number(req.params.id));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Seed default couriers (from app list)
  app.post("/api/admin/settings/couriers/seed-defaults", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const existing = await storage.getAllCourierSettingsIncludingDeleted();
      const existsSet = new Set(existing.map(c => c.courierName));
      let added = 0;

      for (const name of DEFAULT_COURIERS) {
        if (existsSet.has(name)) continue;
        await storage.createCourierSetting({
          courierName: name,
          minDeliveryFee: 0,
          commissionRate: 0,
          isDefault: name === "기타",
        });
        added++;
      }

      res.json({ ok: true, added, message: `${added}개 택배사가 추가되었습니다` });
    } catch (err: any) {
      console.error("[Admin] Seed couriers error:", err);
      res.status(500).json({ message: "Seed failed" });
    }
  });

  // ==================== ORDER CATEGORIES (오더 카테고리 관리) ====================

  // Get all order categories
  app.get("/api/admin/settings/order-categories", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const settings = await storage.getAllOrderCategorySettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create order category
  app.post("/api/admin/settings/order-categories", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { categoryName, sortOrder, isActive, isAdminOnly, allowedCourierNames } = req.body;
      if (!categoryName) {
        return res.status(400).json({ message: "카테고리명을 입력해주세요" });
      }
      const existing = await storage.getOrderCategorySettingByName(categoryName);
      if (existing) {
        return res.status(400).json({ message: "이미 존재하는 카테고리명입니다" });
      }
      const setting = await storage.createOrderCategorySetting({
        categoryName,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== false,
        isAdminOnly: isAdminOnly || false,
        allowedCourierNames: allowedCourierNames ? JSON.stringify(allowedCourierNames) : null,
      });
      res.json(setting);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update order category
  app.patch("/api/admin/settings/order-categories/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { categoryName, sortOrder, isActive, isAdminOnly, allowedCourierNames } = req.body;
      const updates: Record<string, any> = {};
      if (categoryName !== undefined) updates.categoryName = categoryName;
      if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
      if (isAdminOnly !== undefined) updates.isAdminOnly = isAdminOnly;
      if (allowedCourierNames !== undefined) {
        updates.allowedCourierNames = allowedCourierNames ? JSON.stringify(allowedCourierNames) : null;
      }
      const setting = await storage.updateOrderCategorySetting(Number(req.params.id), updates);
      res.json(setting);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete order category
  app.delete("/api/admin/settings/order-categories/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await storage.deleteOrderCategorySetting(Number(req.params.id));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== CLOSING FIELD SETTINGS (마감 필드 설정) ====================

  // Get all closing field settings
  app.get("/api/admin/settings/closing-fields", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const fields = await db.select().from(closingFieldSettings).orderBy(closingFieldSettings.sortOrder);
      res.json(fields);
    } catch (err: any) {
      console.error("Get closing fields error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create closing field setting
  app.post("/api/admin/settings/closing-fields", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { fieldName, fieldType, isRequired, placeholder, description, targetRole, sortOrder } = req.body;
      if (!fieldName) {
        return res.status(400).json({ message: "필드명을 입력해주세요" });
      }
      const [field] = await db.insert(closingFieldSettings).values({
        fieldName,
        fieldType: fieldType || 'text',
        isRequired: isRequired || false,
        placeholder: placeholder || null,
        description: description || null,
        targetRole: targetRole || 'helper',
        sortOrder: Number(sortOrder) || 0,
        createdBy: req.user?.id,
      }).returning();
      res.json(field);
    } catch (err: any) {
      console.error("Create closing field error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update closing field setting
  app.patch("/api/admin/settings/closing-fields/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { fieldName, fieldType, isRequired, placeholder, description, targetRole, sortOrder, isActive } = req.body;
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (fieldName !== undefined) updates.fieldName = fieldName;
      if (fieldType !== undefined) updates.fieldType = fieldType;
      if (isRequired !== undefined) updates.isRequired = isRequired;
      if (placeholder !== undefined) updates.placeholder = placeholder;
      if (description !== undefined) updates.description = description;
      if (targetRole !== undefined) updates.targetRole = targetRole;
      if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);

      const [field] = await db.update(closingFieldSettings)
        .set(updates)
        .where(eq(closingFieldSettings.id, Number(req.params.id)))
        .returning();
      res.json(field);
    } catch (err: any) {
      console.error("Update closing field error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete closing field setting
  app.delete("/api/admin/settings/closing-fields/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(closingFieldSettings).where(eq(closingFieldSettings.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete closing field error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // ==================== ORDER REGISTRATION FIELDS (오더등록 필드) ====================

  // Get all order registration fields
  app.get("/api/admin/settings/order-fields", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const fields = await db.select().from(orderRegistrationFields).orderBy(orderRegistrationFields.sortOrder);
      res.json(fields);
    } catch (err: any) {
      console.error("Get order registration fields error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create order registration field
  app.post("/api/admin/settings/order-fields", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { fieldCode, fieldName, fieldType, isRequired, placeholder, description, options, defaultValue, validationRule, sortOrder } = req.body;
      const [field] = await db.insert(orderRegistrationFields).values({
        fieldCode,
        fieldName,
        fieldType: fieldType || 'text',
        isRequired: isRequired ?? true,
        placeholder,
        description,
        options,
        defaultValue,
        validationRule,
        sortOrder: sortOrder || 0,
        createdBy: req.user!.id,
      }).returning();
      res.json(field);
    } catch (err: any) {
      console.error("Create order registration field error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update order registration field
  app.patch("/api/admin/settings/order-fields/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { fieldCode, fieldName, fieldType, isRequired, placeholder, description, options, defaultValue, validationRule, sortOrder, isActive } = req.body;
      const [field] = await db.update(orderRegistrationFields)
        .set({
          ...(fieldCode !== undefined && { fieldCode }),
          ...(fieldName !== undefined && { fieldName }),
          ...(fieldType !== undefined && { fieldType }),
          ...(isRequired !== undefined && { isRequired }),
          ...(placeholder !== undefined && { placeholder }),
          ...(description !== undefined && { description }),
          ...(options !== undefined && { options }),
          ...(defaultValue !== undefined && { defaultValue }),
          ...(validationRule !== undefined && { validationRule }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(orderRegistrationFields.id, Number(req.params.id)))
        .returning();
      res.json(field);
    } catch (err: any) {
      console.error("Update order registration field error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete order registration field
  app.delete("/api/admin/settings/order-fields/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(orderRegistrationFields).where(eq(orderRegistrationFields.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete order registration field error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // ==================== PRICING POLICIES (정산 자동화 정책) ====================

  // Carrier Pricing Policies (택배사별 단가 정책)
  app.get("/api/admin/settings/carrier-pricing-policies", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const policies = await db.select().from(carrierPricingPolicies).orderBy(carrierPricingPolicies.carrierCode, carrierPricingPolicies.serviceType);
      res.json(policies);
    } catch (err: any) {
      console.error("Get carrier pricing policies error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/settings/carrier-pricing-policies", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { carrierCode, serviceType, regionCode, vehicleType, unitType, unitPriceSupply, minChargeSupply, effectiveFrom, effectiveTo } = req.body;
      if (!carrierCode || !serviceType || !unitPriceSupply || !effectiveFrom) {
        return res.status(400).json({ message: "필수 항목을 입력해주세요" });
      }
      const [policy] = await db.insert(carrierPricingPolicies).values({
        carrierCode,
        serviceType,
        regionCode: regionCode || null,
        vehicleType: vehicleType || null,
        unitType: unitType || "BOX",
        unitPriceSupply: Number(unitPriceSupply),
        minChargeSupply: minChargeSupply ? Number(minChargeSupply) : null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isActive: true,
        createdBy: req.user?.id,
      }).returning();
      res.json(policy);
    } catch (err: any) {
      console.error("Create carrier pricing policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/settings/carrier-pricing-policies/:id", adminAuth, requirePermission("settings.edit"), async (req: any, res) => {
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };
      const fields = ["carrierCode", "serviceType", "regionCode", "vehicleType", "unitType", "unitPriceSupply", "minChargeSupply", "effectiveFrom", "effectiveTo", "isActive"];
      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          updates[f] = f.includes("Supply") || f.includes("Price") ? Number(req.body[f]) : req.body[f];
        }
      });

      // 변경 전 값 조회
      const [currentPolicy] = await db.select().from(carrierPricingPolicies)
        .where(eq(carrierPricingPolicies.id, Number(req.params.id)));

      const trackResult = await trackSettingChange(storage, {
        settingType: "carrier_pricing",
        entityId: String(req.params.id),
        oldValue: currentPolicy,
        newValue: updates,
        effectiveFrom: req.body.scheduledEffectiveFrom,
        reason: req.body.changeReason,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => {
          const [policy] = await db.update(carrierPricingPolicies)
            .set(updates)
            .where(eq(carrierPricingPolicies.id, Number(req.params.id)))
            .returning();
          return policy;
        },
      });

      if (trackResult.scheduled) {
        return res.json({ message: "예약 적용 등록됨", scheduled: true });
      }
      res.json(trackResult.result);
    } catch (err: any) {
      console.error("Update carrier pricing policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/settings/carrier-pricing-policies/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(carrierPricingPolicies).where(eq(carrierPricingPolicies.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete carrier pricing policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Urgent Fee Policies (긴급수수료 정책)
  app.get("/api/admin/settings/urgent-fee-policies", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const policies = await db.select().from(urgentFeePolicies).orderBy(urgentFeePolicies.carrierCode);
      res.json(policies);
    } catch (err: any) {
      console.error("Get urgent fee policies error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/settings/urgent-fee-policies", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { carrierCode, applyType, value, maxUrgentFeeSupply, effectiveFrom, effectiveTo } = req.body;
      if (!applyType || !value || !effectiveFrom) {
        return res.status(400).json({ message: "필수 항목을 입력해주세요" });
      }
      const [policy] = await db.insert(urgentFeePolicies).values({
        carrierCode: carrierCode || null,
        applyType,
        value: Number(value),
        maxUrgentFeeSupply: maxUrgentFeeSupply ? Number(maxUrgentFeeSupply) : null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isActive: true,
        createdBy: req.user?.id,
      }).returning();
      res.json(policy);
    } catch (err: any) {
      console.error("Create urgent fee policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/settings/urgent-fee-policies/:id", adminAuth, requirePermission("settings.edit"), async (req: any, res) => {
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };
      const fields = ["carrierCode", "applyType", "value", "maxUrgentFeeSupply", "effectiveFrom", "effectiveTo", "isActive"];
      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          updates[f] = f === "value" || f === "maxUrgentFeeSupply" ? Number(req.body[f]) : req.body[f];
        }
      });

      // 변경 전 값 조회
      const [currentPolicy] = await db.select().from(urgentFeePolicies)
        .where(eq(urgentFeePolicies.id, Number(req.params.id)));

      const trackResult = await trackSettingChange(storage, {
        settingType: "urgent_fee",
        entityId: String(req.params.id),
        oldValue: currentPolicy,
        newValue: updates,
        effectiveFrom: req.body.scheduledEffectiveFrom,
        reason: req.body.changeReason,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => {
          const [policy] = await db.update(urgentFeePolicies)
            .set(updates)
            .where(eq(urgentFeePolicies.id, Number(req.params.id)))
            .returning();
          return policy;
        },
      });

      if (trackResult.scheduled) {
        return res.json({ message: "예약 적용 등록됨", scheduled: true });
      }
      res.json(trackResult.result);
    } catch (err: any) {
      console.error("Update urgent fee policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/settings/urgent-fee-policies/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(urgentFeePolicies).where(eq(urgentFeePolicies.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete urgent fee policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Platform Fee Policies (플랫폼 수수료 정책)
  app.get("/api/admin/settings/platform-fee-policies", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const policies = await db.select().from(platformFeePolicies).orderBy(desc(platformFeePolicies.isDefault), platformFeePolicies.effectiveFrom);
      res.json(policies);
    } catch (err: any) {
      console.error("Get platform fee policies error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/settings/platform-fee-policies", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { name, baseOn, feeType, ratePercent, fixedAmount, minFee, maxFee, effectiveFrom, effectiveTo, isDefault } = req.body;
      if (!name || !baseOn || !effectiveFrom) {
        return res.status(400).json({ message: "필수 항목을 입력해주세요" });
      }
      if (isDefault) {
        await db.update(platformFeePolicies).set({ isDefault: false }).where(eq(platformFeePolicies.isDefault, true));
      }
      const [policy] = await db.insert(platformFeePolicies).values({
        name,
        baseOn,
        feeType: feeType || "PERCENT",
        ratePercent: ratePercent ? Number(ratePercent) : null,
        fixedAmount: fixedAmount ? Number(fixedAmount) : null,
        minFee: minFee ? Number(minFee) : null,
        maxFee: maxFee ? Number(maxFee) : null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isActive: true,
        isDefault: isDefault || false,
        createdBy: req.user?.id,
      }).returning();
      res.json(policy);
    } catch (err: any) {
      console.error("Create platform fee policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/settings/platform-fee-policies/:id", adminAuth, requirePermission("settings.edit"), async (req: any, res) => {
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };
      const fields = ["name", "baseOn", "feeType", "ratePercent", "fixedAmount", "minFee", "maxFee", "effectiveFrom", "effectiveTo", "isActive", "isDefault"];
      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          updates[f] = ["ratePercent", "fixedAmount", "minFee", "maxFee"].includes(f) ? Number(req.body[f]) : req.body[f];
        }
      });

      // 변경 전 값 조회
      const [currentPolicy] = await db.select().from(platformFeePolicies)
        .where(eq(platformFeePolicies.id, Number(req.params.id)));

      const trackResult = await trackSettingChange(storage, {
        settingType: "platform_fee",
        entityId: String(req.params.id),
        oldValue: currentPolicy,
        newValue: updates,
        effectiveFrom: req.body.scheduledEffectiveFrom,
        reason: req.body.changeReason,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => {
          if (req.body.isDefault) {
            await db.update(platformFeePolicies).set({ isDefault: false }).where(eq(platformFeePolicies.isDefault, true));
          }
          const [policy] = await db.update(platformFeePolicies)
            .set(updates)
            .where(eq(platformFeePolicies.id, Number(req.params.id)))
            .returning();
          return policy;
        },
      });

      if (trackResult.scheduled) {
        return res.json({ message: "예약 적용 등록됨", scheduled: true });
      }
      res.json(trackResult.result);
    } catch (err: any) {
      console.error("Update platform fee policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/settings/platform-fee-policies/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(platformFeePolicies).where(eq(platformFeePolicies.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete platform fee policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Refund Policies (환불 정책 관리)
  app.get("/api/admin/settings/refund-policies", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const policies = await db.select().from(refundPolicies).orderBy(desc(refundPolicies.isDefault), desc(refundPolicies.effectiveFrom));
      res.json(policies);
    } catch (err: any) {
      console.error("Get refund policies error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/settings/refund-policies", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertRefundPolicySchema.parse({
        ...req.body,
        createdBy: req.user?.id
      });
      const [created] = await db.insert(refundPolicies).values(data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      console.error("Create refund policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/settings/refund-policies/:id", adminAuth, requirePermission("settings.edit"), async (req: any, res) => {
    try {
      const { name, beforeMatchingRefundRate, afterMatchingRefundRate, effectiveFrom, effectiveTo, isActive, isDefault, scheduledEffectiveFrom, changeReason } = req.body;
      const updateData = {
        name,
        beforeMatchingRefundRate,
        afterMatchingRefundRate,
        effectiveFrom,
        effectiveTo,
        isActive,
        isDefault,
        updatedAt: new Date()
      };

      // 변경 전 값 조회
      const [currentPolicy] = await db.select().from(refundPolicies)
        .where(eq(refundPolicies.id, Number(req.params.id)));

      const trackResult = await trackSettingChange(storage, {
        settingType: "refund_policy",
        entityId: String(req.params.id),
        oldValue: currentPolicy,
        newValue: updateData,
        effectiveFrom: scheduledEffectiveFrom,
        reason: changeReason,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => {
          const [updated] = await db
            .update(refundPolicies)
            .set(updateData)
            .where(eq(refundPolicies.id, Number(req.params.id)))
            .returning();
          return updated;
        },
      });

      if (trackResult.scheduled) {
        return res.json({ message: "예약 적용 등록됨", scheduled: true });
      }
      res.json(trackResult.result);
    } catch (err: any) {
      console.error("Update refund policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/settings/refund-policies/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(refundPolicies).where(eq(refundPolicies.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete refund policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Extra Cost Catalog (추가비용 항목 카탈로그)
  app.get("/api/admin/settings/extra-cost-catalog", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const items = await db.select().from(extraCostCatalog).orderBy(extraCostCatalog.sortOrder);
      res.json(items);
    } catch (err: any) {
      console.error("Get extra cost catalog error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/settings/extra-cost-catalog", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { costCode, label, unitLabel, defaultUnitPriceSupply, inputMode, requireMemo, sortOrder } = req.body;
      if (!costCode || !label) {
        return res.status(400).json({ message: "항목 코드와 표시명을 입력해주세요" });
      }
      const [item] = await db.insert(extraCostCatalog).values({
        costCode,
        label,
        unitLabel: unitLabel || null,
        defaultUnitPriceSupply: defaultUnitPriceSupply ? Number(defaultUnitPriceSupply) : null,
        inputMode: inputMode || "QTY_PRICE",
        requireMemo: requireMemo || false,
        sortOrder: sortOrder ? Number(sortOrder) : 100,
        isActive: true,
        createdBy: req.user?.id,
      }).returning();
      res.json(item);
    } catch (err: any) {
      console.error("Create extra cost catalog error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/settings/extra-cost-catalog/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };
      const fields = ["costCode", "label", "unitLabel", "defaultUnitPriceSupply", "inputMode", "requireMemo", "sortOrder", "isActive"];
      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          updates[f] = ["defaultUnitPriceSupply", "sortOrder"].includes(f) ? Number(req.body[f]) : req.body[f];
        }
      });
      const [item] = await db.update(extraCostCatalog)
        .set(updates)
        .where(eq(extraCostCatalog.id, Number(req.params.id)))
        .returning();
      res.json(item);
    } catch (err: any) {
      console.error("Update extra cost catalog error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/settings/extra-cost-catalog/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(extraCostCatalog).where(eq(extraCostCatalog.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete extra cost catalog error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Policy lookup API (앱용 정책 조회)
  app.get("/api/policies/pricing", requireAuth, async (req, res) => {
    try {
      const { carrierCode, serviceType } = req.query;
      if (!carrierCode || !serviceType) {
        return res.status(400).json({ message: "carrierCode와 serviceType이 필요합니다" });
      }

      const {
        findActiveCarrierPricing,
        findActiveUrgentFeePolicy,
        findActivePlatformFeePolicy,
      } = await import("../../lib/settlement-calculator");

      const date = new Date().toISOString().split("T")[0];
      const pricingPolicy = await findActiveCarrierPricing(carrierCode as string, serviceType as string, date);
      const urgentPolicy = await findActiveUrgentFeePolicy(carrierCode as string, date);
      const platformPolicy = await findActivePlatformFeePolicy(date);

      res.json({
        unitPriceSupply: pricingPolicy?.unitPriceSupply || null,
        minChargeSupply: pricingPolicy?.minChargeSupply || null,
        urgent: urgentPolicy ? {
          applyType: urgentPolicy.applyType,
          value: urgentPolicy.value,
          maxFee: urgentPolicy.maxUrgentFeeSupply,
        } : null,
        platformFee: platformPolicy ? {
          baseOn: platformPolicy.baseOn,
          ratePercent: platformPolicy.ratePercent,
          minFee: platformPolicy.minFee,
          maxFee: platformPolicy.maxFee,
        } : null,
      });
    } catch (err: any) {
      console.error("Get policies error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== CARRIER RATE ITEMS (택배사별 품목 단가) ====================

  // Get all carrier rate items
  app.get("/api/admin/settings/carrier-rates", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const items = await storage.getAllCarrierRateItems();
      const couriers = await storage.getAllCourierSettings();
      const enriched = items.map(item => {
        const courier = couriers.find(c => c.id === item.courierId);
        return { ...item, courierName: courier?.courierName || "Unknown" };
      });
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get carrier rate items by courier
  app.get("/api/admin/settings/couriers/:courierId/rates", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const items = await storage.getCarrierRateItemsByCourier(Number(req.params.courierId));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create carrier rate item
  app.post("/api/admin/settings/carrier-rates", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const parsed = insertCarrierRateItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const item = await storage.createCarrierRateItem(parsed.data);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update carrier rate item
  app.patch("/api/admin/settings/carrier-rates/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { itemName, itemType, unitPrice, includeVat, displayOrder, isActive, sortOrder } = req.body;
      const updates: Record<string, any> = {};
      if (itemName !== undefined) updates.itemName = itemName;
      if (itemType !== undefined) updates.itemType = itemType;
      if (unitPrice !== undefined) updates.unitPrice = Number(unitPrice);
      if (includeVat !== undefined) updates.includeVat = includeVat;
      if (displayOrder !== undefined) updates.displayOrder = Number(displayOrder);
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
      const item = await storage.updateCarrierRateItem(Number(req.params.id), updates);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete carrier rate item
  app.delete("/api/admin/settings/carrier-rates/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await storage.deleteCarrierRateItem(Number(req.params.id));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== ADMIN BANK ACCOUNTS (입금 통장 관리) ====================

  // Get all admin bank accounts
  app.get("/api/admin/settings/bank-accounts", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const accounts = await storage.getAllAdminBankAccounts();
      res.json(accounts.map(a => ({ ...a, accountNumber: decrypt(a.accountNumber) })));
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get bank accounts by type (deposit or balance)
  app.get("/api/admin/settings/bank-accounts/:type", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const accounts = await storage.getAdminBankAccountsByType(req.params.type);
      res.json(accounts.map(a => ({ ...a, accountNumber: decrypt(a.accountNumber) })));
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create bank account
  app.post("/api/admin/settings/bank-accounts", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const parsed = insertAdminBankAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const data = { ...parsed.data };
      if (data.accountNumber) {
        data.accountNumber = encrypt(data.accountNumber);
      }
      const account = await storage.createAdminBankAccount(data);
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update bank account
  app.patch("/api/admin/settings/bank-accounts/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { accountType, bankName, accountNumber, accountHolder, bankBranch, displayOrder, isActive, notes, sortOrder } = req.body;
      const updates: Record<string, any> = {};
      if (accountType !== undefined) updates.accountType = accountType;
      if (bankName !== undefined) updates.bankName = bankName;
      if (accountNumber !== undefined) updates.accountNumber = encrypt(accountNumber);
      if (accountHolder !== undefined) updates.accountHolder = accountHolder;
      if (bankBranch !== undefined) updates.bankBranch = bankBranch;
      if (displayOrder !== undefined) updates.displayOrder = Number(displayOrder);
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
      if (notes !== undefined) updates.notes = notes;
      const account = await storage.updateAdminBankAccount(Number(req.params.id), updates);
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete bank account
  app.delete("/api/admin/settings/bank-accounts/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await storage.deleteAdminBankAccount(Number(req.params.id));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all team commission overrides
  app.get("/api/admin/settings/team-commissions", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const overrides = await storage.getAllTeamCommissionOverrides();
      const teams = await storage.getAllTeams();
      const enriched = await Promise.all(overrides.map(async (o) => {
        const team = teams.find(t => t.id === o.teamId);
        if (!team) return { ...o, teamName: "Unknown" };
        const leader = await storage.getUser(team.leaderId);
        return { ...o, teamName: team.name, leaderName: leader?.name || "Unknown" };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create team commission override
  app.post("/api/admin/settings/team-commissions", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { teamId, commissionRate, notes } = req.body;
      const existing = await storage.getTeamCommissionOverride(Number(teamId));
      if (existing) {
        return res.status(400).json({ message: "이미 설정된 팀입니다. 수정하세요." });
      }
      const override = await storage.createTeamCommissionOverride({
        teamId: Number(teamId),
        commissionRate: Number(commissionRate),
        notes: notes || null,
      });
      res.json(override);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update team commission override
  app.patch("/api/admin/settings/team-commissions/:id", adminAuth, requirePermission("settings.edit"), async (req: any, res) => {
    try {
      const { commissionRate, notes, effectiveFrom, changeReason } = req.body;
      const updates: Record<string, any> = {};
      if (commissionRate !== undefined) updates.commissionRate = Number(commissionRate);
      if (notes !== undefined) updates.notes = notes;

      // 변경 전 값 조회
      const [currentOverride] = await db.select().from(schema.teamCommissionOverrides)
        .where(eq(schema.teamCommissionOverrides.id, Number(req.params.id)));

      const trackResult = await trackSettingChange(storage, {
        settingType: "team_commission",
        entityId: String(req.params.id),
        oldValue: currentOverride,
        newValue: updates,
        effectiveFrom,
        reason: changeReason,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => storage.updateTeamCommissionOverride(Number(req.params.id), updates),
      });

      if (trackResult.scheduled) {
        return res.json({ message: "예약 적용 등록됨", scheduled: true, effectiveFrom });
      }
      res.json(trackResult.result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete team commission override
  app.delete("/api/admin/settings/team-commissions/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await storage.deleteTeamCommissionOverride(Number(req.params.id));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== DESTINATION PRICING (착지별/시간대별 단가) ====================

  // Get all destination pricing
  app.get("/api/admin/settings/destination-pricing", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const pricing = await storage.getAllDestinationPricing();
      res.json(pricing);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get destination pricing by category
  app.get("/api/admin/settings/destination-pricing/category/:category", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const pricing = await storage.getDestinationPricingByCategory(req.params.category);
      res.json(pricing);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create destination pricing
  app.post("/api/admin/settings/destination-pricing", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const parsed = insertDestinationPricingSchema.safeParse({
        workCategory: req.body.workCategory,
        courierId: req.body.courierId || null,
        destinationRegion: req.body.destinationRegion,
        timeSlot: req.body.timeSlot,
        pricePerBox: Number(req.body.pricePerBox) || 0,
        minimumFee: Number(req.body.minimumFee) || 0,
        isActive: req.body.isActive !== false,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "유효하지 않은 입력입니다" });
      }
      if (parsed.data.workCategory === "택배사" && !parsed.data.courierId) {
        return res.status(400).json({ message: "택배사를 선택해주세요" });
      }
      const pricing = await storage.createDestinationPricing(parsed.data);
      res.json(pricing);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update destination pricing
  app.patch("/api/admin/settings/destination-pricing/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { workCategory, courierId, destinationRegion, timeSlot, pricePerBox, minimumFee, isActive } = req.body;
      const updates: Record<string, any> = {};

      const existingPricing = await storage.getDestinationPricing(Number(req.params.id));
      if (!existingPricing) {
        return res.status(404).json({ message: "가격 설정을 찾을 수 없습니다" });
      }

      if (workCategory !== undefined) {
        if (workCategory !== "택배사" && workCategory !== "기타택배") {
          return res.status(400).json({ message: "유효하지 않은 업무 카테고리입니다" });
        }
        updates.workCategory = workCategory;
      }
      if (courierId !== undefined) {
        updates.courierId = courierId || null;
      }
      if (destinationRegion !== undefined) {
        if (!destinationRegions.includes(destinationRegion)) {
          return res.status(400).json({ message: "유효하지 않은 착지 지역입니다" });
        }
        updates.destinationRegion = destinationRegion;
      }
      if (timeSlot !== undefined) {
        if (!timeSlots.includes(timeSlot)) {
          return res.status(400).json({ message: "유효하지 않은 시간대입니다" });
        }
        updates.timeSlot = timeSlot;
      }
      if (pricePerBox !== undefined) {
        const price = Number(pricePerBox);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({ message: "박스당 단가는 0 이상이어야 합니다" });
        }
        updates.pricePerBox = price;
      }
      if (minimumFee !== undefined) {
        const fee = Number(minimumFee);
        if (isNaN(fee) || fee < 0) {
          return res.status(400).json({ message: "최저가는 0 이상이어야 합니다" });
        }
        updates.minimumFee = fee;
      }
      if (isActive !== undefined) {
        updates.isActive = Boolean(isActive);
      }

      const finalWorkCategory = updates.workCategory ?? existingPricing.workCategory;
      const finalCourierId = updates.courierId !== undefined ? updates.courierId : existingPricing.courierId;

      if (finalWorkCategory === "택배사" && !finalCourierId) {
        return res.status(400).json({ message: "택배사 카테고리에는 택배사를 선택해야 합니다" });
      }

      const pricing = await storage.updateDestinationPricing(Number(req.params.id), updates);
      res.json(pricing);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete destination pricing
  app.delete("/api/admin/settings/destination-pricing/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await storage.deleteDestinationPricing(Number(req.params.id));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== COLD CHAIN SETTINGS (냉탑 최저가) ====================

  // Get all cold chain settings
  app.get("/api/admin/settings/cold-chain", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const settings = await storage.getAllColdChainSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create cold chain setting
  app.post("/api/admin/settings/cold-chain", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const parsed = insertColdChainSettingSchema.safeParse({
        settingName: req.body.settingName,
        minimumFee: Number(req.body.minimumFee) || 0,
        description: req.body.description || null,
        isActive: req.body.isActive !== false,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "유효하지 않은 입력입니다" });
      }
      const setting = await storage.createColdChainSetting(parsed.data);
      res.json(setting);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update cold chain setting
  app.patch("/api/admin/settings/cold-chain/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { settingName, minimumFee, description, isActive } = req.body;
      const updates: Record<string, any> = {};

      const existingSetting = await storage.getColdChainSetting(Number(req.params.id));
      if (!existingSetting) {
        return res.status(404).json({ message: "냉탑 설정을 찾을 수 없습니다" });
      }

      if (settingName !== undefined) {
        if (typeof settingName !== "string" || settingName.trim().length === 0) {
          return res.status(400).json({ message: "설정명을 입력해주세요" });
        }
        updates.settingName = settingName.trim();
      }
      if (minimumFee !== undefined) {
        const fee = Number(minimumFee);
        if (isNaN(fee) || fee < 0) {
          return res.status(400).json({ message: "최저가는 0 이상이어야 합니다" });
        }
        updates.minimumFee = fee;
      }
      if (description !== undefined) {
        updates.description = description === null ? null : String(description);
      }
      if (isActive !== undefined) {
        updates.isActive = Boolean(isActive);
      }

      const setting = await storage.updateColdChainSetting(Number(req.params.id), updates);
      res.json(setting);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete cold chain setting
  app.delete("/api/admin/settings/cold-chain/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await storage.deleteColdChainSetting(Number(req.params.id));
      res.json({ message: "삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // System settings routes
  app.get("/api/admin/settings/system", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/settings/system/:key", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const setting = await storage.getSystemSetting(req.params.key);
      res.json(setting || null);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/settings/system", adminAuth, requirePermission("settings.edit"), async (req: any, res) => {
    try {
      const { key, value, description, effectiveFrom, changeReason } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: "key와 value는 필수입니다" });
      }

      // 변경 전 값 조회
      let oldValue = null;
      try {
        const existing = await storage.getSystemSetting(key);
        oldValue = existing?.value || null;
      } catch {}

      const trackResult = await trackSettingChange(storage, {
        settingType: "system_setting",
        entityId: key,
        oldValue: { value: oldValue, description },
        newValue: { value: String(value), description },
        effectiveFrom,
        reason: changeReason,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => storage.upsertSystemSetting(key, String(value), description),
      });

      if (trackResult.scheduled) {
        return res.json({ message: "예약 적용 등록됨", scheduled: true, effectiveFrom });
      }
      res.json(trackResult.result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==========================================
  // Setting Change History (설정 변경 이력) API
  // ==========================================

  // 변경 이력 조회 (페이징 + 필터)
  app.get("/api/admin/settings/change-history", adminAuth, requirePermission("settings.view"), async (req: any, res: any) => {
    try {
      const { settingType, status, page, limit } = req.query;
      const result = await storage.getSettingChangeHistory({
        settingType: settingType as string | undefined,
        status: status as string | undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error fetching change history:", err);
      res.status(500).json({ message: "변경 이력 조회 실패" });
    }
  });

  // 대기 중인 예약 변경 목록
  app.get("/api/admin/settings/change-history/pending", adminAuth, requirePermission("settings.view"), async (req: any, res: any) => {
    try {
      // effectiveFrom 관계없이 모든 pending 조회 (미래 포함)
      const allPending = await db.select().from(settingChangeHistory)
        .where(eq(settingChangeHistory.status, "pending"))
        .orderBy(settingChangeHistory.effectiveFrom);
      res.json(allPending);
    } catch (err: any) {
      console.error("Error fetching pending changes:", err);
      res.status(500).json({ message: "대기 변경 조회 실패" });
    }
  });

  // 예약 변경 취소
  app.post("/api/admin/settings/change-history/:id/cancel", adminAuth, requirePermission("settings.edit"), async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const record = await storage.getSettingChangeHistoryById(id);
      if (!record) {
        return res.status(404).json({ message: "이력을 찾을 수 없습니다" });
      }
      if (record.status !== "pending") {
        return res.status(400).json({ message: "대기 상태의 변경만 취소할 수 있습니다" });
      }
      const updated = await storage.updateSettingChangeHistoryStatus(id, "cancelled");
      res.json(updated);
    } catch (err: any) {
      console.error("Error cancelling change:", err);
      res.status(500).json({ message: "취소 실패" });
    }
  });

  // 변경 롤백 (이전 값으로 복원)
  app.post("/api/admin/settings/change-history/:id/rollback", adminAuth, requirePermission("settings.edit"), async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const record = await storage.getSettingChangeHistoryById(id);
      if (!record) {
        return res.status(404).json({ message: "이력을 찾을 수 없습니다" });
      }
      if (record.status !== "active") {
        return res.status(400).json({ message: "활성 상태의 변경만 롤백할 수 있습니다" });
      }

      // oldValue를 해당 테이블에 재적용
      const { activatePendingChanges } = await import("../../utils/scheduled-settings");
      // 롤백: oldValue를 newValue로, 현재 값을 oldValue로 하여 즉시 적용
      const rollbackResult = await trackSettingChange(storage, {
        settingType: record.settingType,
        entityId: record.entityId || undefined,
        fieldName: record.fieldName || undefined,
        oldValue: record.newValue,  // 현재 값 (롤백 전)
        newValue: record.oldValue,  // 복원할 값
        reason: `롤백: 이력 #${record.id} 복원 (${req.body?.reason || ""})`,
        changedBy: req.user?.id,
        changedByName: req.user?.name || req.user?.username,
        applyFn: async () => {
          // scheduled-settings의 applyChange와 동일한 로직
          const parsedOldValue = safeParseJSON(record.oldValue);
          switch (record.settingType) {
            case "courier_settings":
              return storage.updateCourierSetting(Number(record.entityId), parsedOldValue);
            case "team_commission":
              return storage.updateTeamCommissionOverride(Number(record.entityId), parsedOldValue);
            case "system_setting":
              const val = typeof parsedOldValue === 'object' ? String(parsedOldValue.value) : String(parsedOldValue);
              return storage.upsertSystemSetting(record.entityId!, val);
            case "platform_fee":
              return db.update(platformFeePolicies)
                .set({ ...parsedOldValue, updatedAt: new Date() })
                .where(eq(platformFeePolicies.id, Number(record.entityId)));
            case "urgent_fee":
              return db.update(urgentFeePolicies)
                .set({ ...parsedOldValue, updatedAt: new Date() })
                .where(eq(urgentFeePolicies.id, Number(record.entityId)));
            case "carrier_pricing":
              return db.update(carrierPricingPolicies)
                .set({ ...parsedOldValue, updatedAt: new Date() })
                .where(eq(carrierPricingPolicies.id, Number(record.entityId)));
            case "refund_policy":
              return db.update(refundPolicies)
                .set({ ...parsedOldValue, updatedAt: new Date() })
                .where(eq(refundPolicies.id, Number(record.entityId)));
            default:
              throw new Error(`Unknown settingType: ${record.settingType}`);
          }
        },
      });

      // 원본 이력 상태 → rolled_back
      await db.update(settingChangeHistory)
        .set({
          status: "rolled_back",
          rolledBackBy: req.user?.id,
          rolledBackAt: new Date(),
        })
        .where(eq(settingChangeHistory.id, id));

      res.json({ message: "롤백 완료", rollbackHistoryId: rollbackResult.historyId });
    } catch (err: any) {
      console.error("Error rolling back change:", err);
      res.status(500).json({ message: "롤백 실패" });
    }
  });

  // 계약서용 동적 설정값 제공 API
  app.get("/api/settings/contract-values", async (req: any, res: any) => {
    try {
      // 계약금율
      const depositRate = await getDepositRate();

      // 수수료 상한 (system_settings에서 조회 또는 기본값 30%)
      let commissionRateMax = 30;
      try {
        const maxSetting = await storage.getSystemSetting("commission_rate_max");
        if (maxSetting) commissionRateMax = Number(maxSetting.value) || 30;
      } catch {}

      // 환불 정책 (활성 기본값)
      let refundBeforeMatching = 100;
      let refundAfterMatching = 90;
      try {
        const activePolicy = await getActiveRefundPolicy();
        if (activePolicy) {
          refundBeforeMatching = activePolicy.beforeMatchingRefundRate ?? 100;
          refundAfterMatching = activePolicy.afterMatchingRefundRate ?? 90;
        }
      } catch {}

      // 플랫폼 수수료율 (기본 정책)
      let platformFeeRate = 8;
      try {
        const [defaultPolicy] = await db.select().from(platformFeePolicies)
          .where(and(
            eq(platformFeePolicies.isActive, true),
            eq(platformFeePolicies.isDefault, true)
          ))
          .limit(1);
        if (defaultPolicy?.ratePercent) platformFeeRate = defaultPolicy.ratePercent;
      } catch {}

      res.json({
        depositRate,
        commissionRateMax,
        refundBeforeMatching,
        refundAfterMatching,
        platformFeeRate,
      });
    } catch (err: any) {
      console.error("Error fetching contract values:", err);
      res.status(500).json({ message: "설정값 조회 실패" });
    }
  });

  function safeParseJSON(str: string | null): any {
    if (str === null || str === undefined) return null;
    try { return JSON.parse(str); } catch { return str; }
  }

  // Payment reminders routes
  app.get("/api/admin/payment-reminders", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const reminders = await storage.getAllPaymentReminders();
      res.json(reminders);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/payment-reminders/:id", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const reminder = await storage.getPaymentReminder(Number(req.params.id));
      if (!reminder) {
        return res.status(404).json({ message: "독촉장을 찾을 수 없습니다" });
      }
      res.json(reminder);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/payment-reminders", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const { requesterId, orderId, orderNumber, unpaidAmount, dueDate, overdueDate,
        signatureData, phoneNumber, phoneVerified, ipAddress, userAgent,
        consentLog, contractContent } = req.body;

      if (!requesterId || !orderNumber || !unpaidAmount || !dueDate) {
        return res.status(400).json({ message: "필수 필드를 모두 입력해주세요" });
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ipAddress;
      const clientUserAgent = req.headers['user-agent'] || userAgent;

      const reminder = await storage.createPaymentReminder({
        requesterId,
        orderId: orderId || null,
        orderNumber,
        unpaidAmount,
        dueDate,
        overdueDate: overdueDate || null,
        reminderLevel: 0,
        signatureData: signatureData || null,
        phoneNumber: phoneNumber || null,
        phoneVerified: phoneVerified || false,
        ipAddress: typeof clientIp === 'string' ? clientIp : String(clientIp),
        userAgent: typeof clientUserAgent === 'string' ? clientUserAgent : String(clientUserAgent),
        consentLog: consentLog || null,
        contractContent: contractContent || null,
      });
      res.status(201).json(reminder);
    } catch (err: any) {
      console.error("Payment reminder creation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/payment-reminders/:id", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const { reminderLevel, signatureData, phoneNumber, phoneVerified, phoneVerifiedAt,
        agreedAt, ipAddress, userAgent, consentLog, contractContent,
        firstReminderSentAt, secondReminderSentAt, thirdReminderSentAt, certifiedMailPrintedAt } = req.body;

      const updates: Record<string, any> = {};
      if (reminderLevel !== undefined) updates.reminderLevel = reminderLevel;
      if (signatureData !== undefined) updates.signatureData = signatureData;
      if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
      if (phoneVerified !== undefined) updates.phoneVerified = phoneVerified;
      if (phoneVerifiedAt !== undefined) updates.phoneVerifiedAt = new Date(phoneVerifiedAt);
      if (agreedAt !== undefined) updates.agreedAt = new Date(agreedAt);
      if (ipAddress !== undefined) updates.ipAddress = ipAddress;
      if (userAgent !== undefined) updates.userAgent = userAgent;
      if (consentLog !== undefined) updates.consentLog = consentLog;
      if (contractContent !== undefined) updates.contractContent = contractContent;
      if (firstReminderSentAt !== undefined) updates.firstReminderSentAt = new Date(firstReminderSentAt);
      if (secondReminderSentAt !== undefined) updates.secondReminderSentAt = new Date(secondReminderSentAt);
      if (thirdReminderSentAt !== undefined) updates.thirdReminderSentAt = new Date(thirdReminderSentAt);
      if (certifiedMailPrintedAt !== undefined) updates.certifiedMailPrintedAt = new Date(certifiedMailPrintedAt);

      const reminder = await storage.updatePaymentReminder(Number(req.params.id), updates);
      res.json(reminder);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/payment-reminders/:id", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      await storage.deletePaymentReminder(Number(req.params.id));
      res.json({ message: "독촉장이 삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== Announcement image upload setup =====
  const announcementImagesDir = path.join(process.cwd(), "uploads", "announcements");
  if (!fs.existsSync(announcementImagesDir)) {
    fs.mkdirSync(announcementImagesDir, { recursive: true });
  }

  const uploadAnnouncementImage = multer({
    storage: multer.diskStorage({
      destination: (_req: any, _file: any, cb: any) => cb(null, announcementImagesDir),
      filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `ann_${uniqueSuffix}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      const allowedExtensions = /\.(jpeg|jpg|png|webp|gif)$/i;
      if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.test(file.originalname)) {
        cb(null, true);
      } else {
        cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, png, webp, gif)"));
      }
    },
  });

  // POST /api/admin/announcements/upload-image — 공지사항 이미지 업로드
  app.post("/api/admin/announcements/upload-image", adminAuth, requirePermission("notifications.send"), uploadAnnouncementImage.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "이미지 파일을 업로드해주세요" });
      }
      const filePath = req.file.filename;
      const url = `/uploads/announcements/${filePath}`;
      console.log(`[Announcement Image Upload] Uploaded: ${url}`);
      res.json({ success: true, url });
    } catch (err: any) {
      console.error("Announcement image upload error:", err);
      res.status(500).json({ message: "이미지 업로드에 실패했습니다" });
    }
  });

  // GET /api/announcements/popups — 팝업용 공지사항 조회 (앱 클라이언트용)
  app.get("/api/announcements/popups", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const popups = await storage.getPopupAnnouncements(user.role);
      res.json(popups);
    } catch (err: any) {
      console.error("Popup announcements error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/announcements/banners — 인라인 배너 광고 조회 (앱 클라이언트용)
  app.get("/api/announcements/banners", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const banners = await storage.getBannerAnnouncements(user.role);
      res.json(banners);
    } catch (err: any) {
      console.error("Banner announcements error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Announcement routes (본사 공지)
  app.get("/api/announcements", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const userAnnouncements = await storage.getUserAnnouncements(user.id, user.role);
      res.json(userAnnouncements);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/announcements", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/announcements/:id", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(Number(req.params.id));
      if (!announcement) {
        return res.status(404).json({ message: "공지를 찾을 수 없습니다" });
      }
      res.json(announcement);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/announcements/:id/recipients", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const recipients = await storage.getAnnouncementRecipients(Number(req.params.id));
      const recipientDetails = await Promise.all(
        recipients.map(async (r) => {
          const user = await storage.getUser(r.userId);
          return {
            ...r,
            userName: user?.name || "알 수 없음",
            userEmail: user?.email || "",
            userRole: user?.role || "",
          };
        })
      );
      res.json(recipientDetails);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/announcements", adminAuth, requirePermission("notifications.send"), async (req: AuthenticatedRequest, res) => {
    try {
      const { title, content, targetAudience, createdBy, imageUrl, linkUrl, isPopup, isBanner, type, priority, expiresAt } = req.body;

      // createdBy: 클라이언트에서 보낸 값 사용, 없으면 인증된 admin의 userId 사용
      const resolvedCreatedBy = createdBy || req.user?.id;

      if (!title || !content || !targetAudience || !resolvedCreatedBy) {
        return res.status(400).json({ message: "필수 필드를 모두 입력해주세요" });
      }

      // 광고 타입은 이미지 필수
      if (type === 'ad' && !imageUrl) {
        return res.status(400).json({ message: "광고 타입은 이미지가 필수입니다" });
      }

      // expiresAt 처리: 빈 문자열이면 null, 유효한 날짜면 그대로
      const resolvedExpiresAt = expiresAt && expiresAt.trim() !== '' ? expiresAt : null;

      const announcement = await storage.createAnnouncement({
        title,
        content,
        targetAudience,
        createdBy: resolvedCreatedBy,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        isPopup: isPopup || false,
        isBanner: isBanner || false,
        type: type || "notice",
        priority: priority || "normal",
        expiresAt: resolvedExpiresAt,
      });

      // Create notifications for target users
      const allUsers = await storage.getAllUsers();
      const targetUsers = allUsers.filter((u) => {
        if (targetAudience === "all") return true;
        return u.role === targetAudience;
      });

      // Add each user as a recipient and send notification
      for (const user of targetUsers) {
        await storage.addAnnouncementRecipient({
          announcementId: announcement.id,
          userId: user.id,
        });

        await storage.createNotification({
          userId: user.id,
          type: "announcement",
          title: `[공지] ${title}`,
          message: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
          relatedId: announcement.id,
        });
      }

      res.status(201).json({
        ...announcement,
        recipientCount: targetUsers.length,
      });
    } catch (err: any) {
      console.error("Announcement creation error:", err?.message || err);
      console.error("Announcement creation detail:", JSON.stringify({ title, content, targetAudience, createdBy, type, isPopup, isBanner }));
      res.status(500).json({ message: err?.message || "Internal server error" });
    }
  });

  app.delete("/api/admin/announcements/:id", adminAuth, requirePermission("notifications.edit"), async (req, res) => {
    try {
      await storage.deleteAnnouncement(Number(req.params.id));
      res.json({ message: "공지가 삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User preferences (푸시 알림/위치 설정)
  app.patch("/api/users/preferences", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { pushEnabled, locationConsent, latitude, longitude } = req.body;
      const updates: any = {};
      if (pushEnabled !== undefined) updates.pushEnabled = pushEnabled;
      if (locationConsent !== undefined) updates.locationConsent = locationConsent;
      if (latitude !== undefined) updates.latitude = latitude;
      if (longitude !== undefined) updates.longitude = longitude;
      if (latitude !== undefined || longitude !== undefined) {
        updates.locationUpdatedAt = new Date();
      }

      const user = await storage.updateUserPreferences(userId, updates);
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/preferences", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      res.json({
        pushEnabled: user.pushEnabled ?? true,
        locationConsent: user.locationConsent ?? false,
        latitude: user.latitude,
        longitude: user.longitude,
        locationUpdatedAt: user.locationUpdatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notification settings GET
  app.get("/api/users/notification-settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      const defaultSettings = {
        orderNotifications: true,
        contractNotifications: true,
        settlementNotifications: true,
        marketingNotifications: false,
        locationTracking: true,
      };

      const savedSettings = user.notificationPreferences
        ? JSON.parse(user.notificationPreferences)
        : {};

      res.json({ ...defaultSettings, ...savedSettings });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notification settings PATCH
  app.patch("/api/users/notification-settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const currentSettings = user.notificationPreferences
        ? JSON.parse(user.notificationPreferences)
        : {};

      const updatedSettings = { ...currentSettings, ...req.body };

      await storage.updateUser(userId, {
        notificationPreferences: JSON.stringify(updatedSettings),
      });

      res.json(updatedSettings);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Location update API (네이티브 앱 위치 업데이트)
  app.post("/api/location/update", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { latitude, longitude, accuracy, capturedAt, source } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      // Update user's latest location
      await storage.updateUserPreferences(userId, {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        locationUpdatedAt: new Date(),
      });

      // Log location (optional - for tracking history)
      try {
        await db.insert(userLocationLogs).values({
          userId: userId,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          accuracy: accuracy?.toString(),
          source: source || 'foreground',
        });

        // Update or insert latest location
        await db.insert(userLocationLatest).values({
          userId: userId,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          accuracy: accuracy?.toString(),
        }).onConflictDoUpdate({
          target: userLocationLatest.userId,
          set: {
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            accuracy: accuracy?.toString(),
            updatedAt: new Date(),
          },
        });
      } catch (logErr) {
        console.error("Location log error (non-critical):", logErr);
      }

      res.json({ success: true, message: "Location updated" });
    } catch (err: any) {
      console.error("Location update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper profile endpoints (헬퍼 프로필 조회/수정)
  app.get("/api/helpers/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // Get helper credentials and vehicle if exists
      const credentials = await storage.getHelperCredential(userId);
      const vehicle = await storage.getHelperVehicle(userId);

      res.json({
        name: user.name || "",
        phoneNumber: user.phoneNumber || "",
        email: user.email || "",
        nickname: user.nickname || credentials?.name || "",
        address: user.address || credentials?.address || "",
        addressDetail: user.addressDetail || "",
        birthDate: user.birthDate || "",
        profileImageUrl: (user as any).profileImageUrl || null,
        profileImage: (user as any).profileImageUrl || null,
        categories: credentials?.category ? [credentials.category] : [],
        regions: [],
        vehicleType: vehicle?.vehicleType || "",
        monthlyCommission: 0,
      });
    } catch (err: any) {
      console.error("Helper profile fetch error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/helpers/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { phoneNumber, nickname, email, address, categories, regions, vehicleType } = req.body;

      // Update user table fields
      const userUpdates: any = {};
      if (phoneNumber !== undefined) userUpdates.phoneNumber = phoneNumber;
      if (email !== undefined) userUpdates.email = email;
      if (address !== undefined) userUpdates.address = address;
      if (nickname !== undefined) userUpdates.nickname = nickname;

      if (Object.keys(userUpdates).length > 0) {
        await storage.updateUserPreferences(userId, userUpdates);
      }

      // Update or create helper credentials for category/nickname
      const existingCredentials = await storage.getHelperCredential(userId);
      if (existingCredentials) {
        const credUpdates: any = {};
        if (nickname !== undefined) credUpdates.name = nickname;
        if (categories && Array.isArray(categories) && categories.length > 0) {
          credUpdates.category = categories[0];
        }
        if (address !== undefined) credUpdates.address = address;

        if (Object.keys(credUpdates).length > 0) {
          await storage.updateHelperCredential(userId, credUpdates);
        }
      } else if (nickname || (categories && categories.length > 0)) {
        // Create new credentials if needed
        const user = req.user!;
        if (user) {
          await storage.createHelperCredential(userId, {
            name: nickname || user.name || "",
            phone: phoneNumber || user.phoneNumber || "",
            address: address || "",
            category: categories?.[0] || "기타",
          });
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Helper profile update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User password change (비밀번호 변경)

  // === change-password & delete-account moved to routes/auth.routes.ts ===


  // User tax invoice setting (의뢰인 세금계산서 발행 여부)
  app.patch("/api/user/tax-invoice", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { taxInvoiceEnabled } = req.body;
      if (typeof taxInvoiceEnabled !== "boolean") {
        return res.status(400).json({ message: "taxInvoiceEnabled must be a boolean" });
      }

      const user = await storage.updateUserPreferences(userId, { taxInvoiceEnabled });
      res.json({ taxInvoiceEnabled: user?.taxInvoiceEnabled ?? taxInvoiceEnabled });
    } catch (err: any) {
      console.error("Tax invoice setting error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notification logs (알림 발송 기록 - 본사 관리용)
  app.get("/api/admin/notification-logs", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const logs = await storage.getAllNotificationLogs();

      // Enrich with user info
      const logsWithUserInfo = await Promise.all(
        logs.map(async (log) => {
          const user = await storage.getUser(log.userId);
          return {
            ...log,
            userName: user?.name || "알 수 없음",
            userEmail: user?.email || "",
            userRole: user?.role || "",
          };
        })
      );

      res.json(logsWithUserInfo);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/notification-logs/stats", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const logs = await storage.getAllNotificationLogs();
      const total = logs.length;
      const read = logs.filter(l => l.isRead).length;
      const unread = total - read;
      const delivered = logs.filter(l => l.isDelivered).length;

      res.json({
        total,
        read,
        unread,
        delivered,
        deliveredRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        readRate: total > 0 ? Math.round((read / total) * 100) : 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== 법적 안전장치 API ====================

  // 건별 전자계약 (Job Contracts)
  app.post("/api/job-contracts", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const contract = await storage.createJobContract({
        ...req.body,
        helperId: userId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 지시 이력 로그 생성
      await storage.createInstructionLog({
        orderId: req.body.orderId,
        jobContractId: contract.id,
        issuerId: req.body.instructionIssuerId,
        issuerName: req.body.instructionIssuerName,
        issuerType: req.body.instructionIssuerType,
        instructionType: "contract_created",
        instructionContent: `계약 생성: ${req.body.workContent}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(contract);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/job-contracts", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const contracts = await storage.getHelperJobContracts(userId);
      res.json(contracts);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/job-contracts/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const contract = await storage.getJobContract(Number(req.params.id));
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      // 본인 관련 계약만 조회 가능
      if (contract.helperId !== userId && contract.requesterId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(contract);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/job-contracts/:id/sign", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const contract = await storage.getJobContract(Number(req.params.id));
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      // 권한 확인: 계약 당사자만 서명 가능
      if (contract.helperId !== userId && contract.requesterId !== userId) {
        return res.status(403).json({ message: "계약 당사자만 서명할 수 있습니다" });
      }

      const updates: any = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      // 기사 서명인 경우
      if (contract.helperId === userId) {
        updates.helperSignature = req.body.signature;
        updates.helperSignedAt = new Date();
      }
      // 의뢰인 서명인 경우
      else if (contract.requesterId === userId) {
        updates.requesterSignature = req.body.signature;
        updates.requesterSignedAt = new Date();
      }

      // 양측 서명 완료 시에만 status를 signed로 변경
      const helperSigned = updates.helperSignature || contract.helperSignature;
      const requesterSigned = updates.requesterSignature || contract.requesterSignature;
      if (helperSigned && requesterSigned) {
        updates.status = "signed";
      }

      const updated = await storage.updateJobContract(Number(req.params.id), updates);

      // 지시 이력 로그
      await storage.createInstructionLog({
        jobContractId: contract.id,
        orderId: contract.orderId,
        issuerId: userId,
        instructionType: "contract_signed",
        instructionContent: `계약 서명 완료`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 근무 세션 (Work Sessions)
  app.post("/api/work-sessions/check-in", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // 기존 세션 확인
      let session = await storage.getWorkSessionByOrder(req.body.orderId);

      if (session) {
        // 기존 세션 업데이트
        session = await storage.updateWorkSession(session.id, {
          checkInTime: new Date(),
          checkInLatitude: req.body.latitude,
          checkInLongitude: req.body.longitude,
          checkInAddress: req.body.address,
          status: "checked_in",
        });
      } else {
        // 새 세션 생성
        session = await storage.createWorkSession({
          orderId: req.body.orderId,
          jobContractId: req.body.jobContractId,
          helperId: userId,
          checkInTime: new Date(),
          checkInLatitude: req.body.latitude,
          checkInLongitude: req.body.longitude,
          checkInAddress: req.body.address,
          status: "checked_in",
        });
      }

      // 출근 증빙 이벤트 기록
      await storage.createWorkProofEvent({
        workSessionId: session.id,
        helperId: userId,
        eventType: "check_in",
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        address: req.body.address,
        capturedAt: new Date(),
      });

      res.json(session);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/work-sessions/check-out", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const session = await storage.getWorkSessionByOrder(req.body.orderId);
      if (!session) return res.status(404).json({ message: "Work session not found" });

      const updated = await storage.updateWorkSession(session.id, {
        checkOutTime: new Date(),
        checkOutLatitude: req.body.latitude,
        checkOutLongitude: req.body.longitude,
        checkOutAddress: req.body.address,
        checkOutPhotoUrl: req.body.photoUrl,
        status: "checked_out",
      });

      // 퇴근 증빙 이벤트 기록
      await storage.createWorkProofEvent({
        workSessionId: session.id,
        helperId: userId,
        eventType: "check_out",
        photoUrl: req.body.photoUrl,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        address: req.body.address,
        capturedAt: new Date(),
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/work-sessions/:id/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const session = await storage.getWorkSession(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "Work session not found" });

      const updated = await storage.updateWorkSession(session.id, {
        workConfirmed: true,
        workConfirmedAt: new Date(),
        status: "confirmed",
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/work-sessions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const sessions = await storage.getHelperWorkSessions(userId);
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/work-sessions/order/:orderId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const session = await storage.getWorkSessionByOrder(Number(req.params.orderId));
      if (session && session.helperId !== userId) {
        // 본인 세션만 조회 가능 (또는 관련 오더 당사자)
        const order = await storage.getOrder(Number(req.params.orderId));
        if (!order || (order.requesterId !== userId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(session || null);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 근무 증빙 이벤트 (Work Proof Events)
  app.post("/api/work-proof-events", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const event = await storage.createWorkProofEvent({
        ...req.body,
        helperId: userId,
        capturedAt: new Date(),
      });

      res.json(event);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/work-proof-events/:sessionId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const session = await storage.getWorkSession(Number(req.params.sessionId));
      if (!session) return res.status(404).json({ message: "Session not found" });

      // 본인 세션의 증빙만 조회 가능
      if (session.helperId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const events = await storage.getWorkProofEventsBySession(Number(req.params.sessionId));
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 정산 명세서 (Settlement Statements)
  app.post("/api/settlement-statements", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, helperId, basePay, additionalPay, penalty, deduction, lineItems,
        notes, settlementDate, status: stmtStatus, periodStart, periodEnd } = req.body;

      // 수수료율 결정 로직
      let commissionRate = 0;

      // 1. 오더에서 택배사 정보 가져오기
      if (orderId) {
        const order = await storage.getOrder(orderId);
        if (order?.companyName) {
          const courierSettings = await storage.getAllCourierSettings();
          const courierSetting = courierSettings.find(c => c.courierName === order.companyName);
          if (courierSetting) {
            commissionRate = courierSetting.commissionRate || 0;
          }
        }
      }

      // 2. 헬퍼의 팀 수수료율 확인 (팀 수수료율이 있으면 우선 적용)
      if (helperId) {
        const helper = await storage.getUser(helperId);
        if (helper?.teamName) {
          const allTeams = await storage.getAllTeams();
          const team = allTeams.find(t => t.name === helper.teamName);
          if (team) {
            const teamCommission = await storage.getTeamCommissionOverride(team.id);
            if (teamCommission && teamCommission.commissionRate > 0) {
              commissionRate = teamCommission.commissionRate;
            }
          }
        }
      }

      // 3. 금액 계산 (basePay, additionalPay는 공급가 기준 → VAT 별도 계산)
      const basePayAmount = Number(basePay) || 0;
      const additionalPayAmount = Number(additionalPay) || 0;
      const penaltyAmount = Number(penalty) || 0;
      const deductionAmount = Number(deduction) || 0;

      const supplyAmount = basePayAmount + additionalPayAmount;
      const vatAmount = Math.round(supplyAmount * 0.1);
      const totalAmount = supplyAmount + vatAmount;
      const commissionAmount = Math.round(totalAmount * (commissionRate / 100));
      const netAmount = totalAmount - commissionAmount - penaltyAmount - deductionAmount;

      // 허용된 필드만 명시적으로 전달 (...rest 사용 금지 — injection 방지)
      const statement = await storage.createSettlementStatement({
        orderId,
        helperId,
        basePay: basePayAmount,
        additionalPay: additionalPayAmount,
        penalty: penaltyAmount,
        deduction: deductionAmount,
        commissionRate,
        commissionAmount,
        supplyAmount,
        vatAmount,
        totalAmount,
        netAmount,
        ...(notes != null && { notes }),
        ...(settlementDate != null && { settlementDate }),
        ...(stmtStatus != null && { status: stmtStatus }),
        ...(periodStart != null && { periodStart }),
        ...(periodEnd != null && { periodEnd }),
      });

      // 정산 항목 상세 생성
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createSettlementLineItem({
            ...item,
            statementId: statement.id,
          });
        }
      }

      res.json(statement);
    } catch (err: any) {
      console.error("Settlement creation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/settlement-statements", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const statements = await storage.getHelperSettlementStatements(userId);
      res.json(statements);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/settlement-statements/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const statement = await storage.getSettlementStatement(Number(req.params.id));
      if (!statement) return res.status(404).json({ message: "Statement not found" });

      // 본인 관련 정산명세서만 조회 가능
      if (statement.helperId !== userId && statement.requesterId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const lineItems = await storage.getSettlementLineItems(statement.id);
      res.json({ ...statement, lineItems });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settlement-statements/:id/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const statement = await storage.getSettlementStatement(Number(req.params.id));
      if (!statement) return res.status(404).json({ message: "Statement not found" });

      // 본인 정산명세서만 확인 가능
      if (statement.helperId !== userId) {
        return res.status(403).json({ message: "본인 정산명세서만 확인할 수 있습니다" });
      }

      const updated = await storage.updateSettlementStatement(statement.id, {
        helperConfirmed: true,
        helperConfirmedAt: new Date(),
        helperSignature: req.body.signature,
        helperIpAddress: req.ip,
        helperUserAgent: req.headers["user-agent"],
        status: "confirmed",
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 지시 이력 로그 (Instruction Logs)
  app.get("/api/instruction-logs/order/:orderId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // 본인 관련 오더의 지시 이력만 조회 가능
      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order) return res.status(404).json({ message: "Order not found" });

      // 관련 계약 확인
      const contracts = await storage.getHelperContracts(userId);
      const isHelperContract = contracts.some(c => c.orderId === Number(req.params.orderId));
      const isRequester = order.requesterId === userId;

      if (!isHelperContract && !isRequester) {
        return res.status(403).json({ message: "Access denied" });
      }

      const logs = await storage.getInstructionLogsByOrder(Number(req.params.orderId));
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/instruction-logs", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const logs = await storage.getAllInstructionLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 사고/분쟁 접수 (Incident Reports)
  app.post("/api/incident-reports", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 사고 유형에 따른 책임주체 자동 제안
      const incidentType = req.body.incidentType;
      let suggestedResponsibility = "platform";

      if (incidentType === "damage") suggestedResponsibility = "helper";
      else if (incidentType === "loss") suggestedResponsibility = "helper";
      else if (incidentType === "delay") suggestedResponsibility = "shared";
      else if (incidentType === "missing") suggestedResponsibility = "requester";
      else if (incidentType === "absent") suggestedResponsibility = "helper";

      const report = await storage.createIncidentReport({
        ...req.body,
        reporterId: userId,
        reporterType: user?.role,
        suggestedResponsibility,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 분쟁 접수 알림: 관리자에게 알림
      const admins = await storage.getAllUsers();
      const hqStaff = admins.filter(u => u.isHqStaff);
      for (const admin of hqStaff) {
        await storage.createNotification({
          userId: admin.id,
          type: "dispute_submitted",
          title: "새로운 분쟁 접수",
          message: `${user?.name || "사용자"}님이 분쟁을 접수했습니다. (유형: ${incidentType})`,
          relatedId: report.id,
        });
      }

      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/incident-reports", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      const allReports = await storage.getAllIncidentReports();

      // 본인 관련 사고만 조회
      const reports = allReports.filter(r =>
        r.reporterId === userId ||
        r.helperId === userId ||
        r.requesterId === userId
      );

      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/incident-reports/:id", requireAuth, async (req, res) => {
    try {
      const report = await storage.getIncidentReport(Number(req.params.id));
      if (!report) return res.status(404).json({ message: "Report not found" });

      const evidence = await storage.getIncidentEvidence(report.id);
      res.json({ ...report, evidence });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/incident-reports/:id/evidence", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const evidence = await storage.createIncidentEvidence({
        ...req.body,
        incidentId: Number(req.params.id),
        uploadedBy: userId,
      });

      res.json(evidence);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/incident-reports/:id", adminAuth, requirePermission("disputes.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const report = await storage.getIncidentReport(Number(req.params.id));
      if (!report) return res.status(404).json({ message: "Report not found" });

      const updates = {
        ...req.body,
        resolvedBy: req.body.status === "resolved" ? userId : undefined,
        resolvedAt: req.body.status === "resolved" ? new Date() : undefined,
      };

      const updated = await storage.updateIncidentReport(Number(req.params.id), updates);

      // 분쟁 해결 알림: 관련 당사자들에게 알림
      if (req.body.status === "resolved") {
        const partiesToNotify = [report.reporterId, report.helperId, report.requesterId].filter(Boolean) as string[];
        const uniqueParties = Array.from(new Set(partiesToNotify));

        for (const userId of uniqueParties) {
          await storage.createNotification({
            userId,
            type: "dispute_resolved",
            title: "분쟁 해결 완료",
            message: `분쟁(ID: ${report.id})이 해결되었습니다. 결과: ${req.body.resolution || "해결 완료"}`,
            relatedId: report.id,
          });
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/incident-reports", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const reports = await storage.getAllIncidentReports();
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 대체근무 요청 (Substitute Requests)
  app.post("/api/substitute-requests", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // 급한 요청일수록 수수료 가중 적용
      const urgencyLevel = req.body.urgencyLevel || "normal";
      let urgencyPremium = 0;
      const basePayment = req.body.basePayment || 0;

      if (urgencyLevel === "same_day") urgencyPremium = Math.round(basePayment * 0.3); // 30% 추가
      else if (urgencyLevel === "next_day") urgencyPremium = Math.round(basePayment * 0.15); // 15% 추가 (유지)

      const request = await storage.createSubstituteRequest({
        ...req.body,
        requesterId: userId,
        helperId: null,
        trackingNumber: null,
        requestDate: new Date().toISOString().split("T")[0],
        urgencyPremium,
        totalPayment: basePayment + urgencyPremium,
      });

      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/substitute-requests", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const requests = await storage.getRequesterSubstituteRequests(userId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/substitute-requests/pending", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getPendingSubstituteRequests();
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/substitute-requests/:id/match", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const request = await storage.getSubstituteRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const updated = await storage.updateSubstituteRequest(request.id, {
        matchedHelperId: userId,
        matchedAt: new Date(),
        status: "matched",
      });

      // 건별 전자계약 자동 생성
      const contract = await storage.createJobContract({
        orderId: request.orderId,
        helperId: userId,
        requesterId: request.requesterId,
        workDate: request.workDate,
        workContent: request.workContent || "대체근무",
        paymentAmount: request.totalPayment || 0,
        status: "pending",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ request: updated, contract });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/substitute-requests", adminAuth, requirePermission("dispatch.view"), async (req, res) => {
    try {
      const requests = await storage.getAllSubstituteRequests();
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: 모든 법적 계약 조회
  app.get("/api/admin/job-contracts", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const contracts = await storage.getAllJobContracts();
      res.json(contracts);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: 모든 정산 명세서 조회
  app.get("/api/admin/settlement-statements", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const statements = await storage.getAllSettlementStatements();
      res.json(statements);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== 법적 보호 API (계약 실행, 결제, 분쟁 워크플로우) ====================

  // Validation schemas for legal protection APIs
  const contractExecutionSchema = z.object({
    triggerType: z.enum(["terms_checked", "payment_confirmed", "execution_recorded"]),
    initiatorRole: z.enum(["helper", "requester"]).optional(),
    paymentId: z.number().nullable().optional(),
    termsChecked: z.boolean().optional(),
  });

  const paymentCreateSchema = z.object({
    contractId: z.number().nullable().optional(),
    jobContractId: z.number().nullable().optional(),
    orderId: z.number().nullable().optional(),
    amount: z.number().min(1, "결제 금액은 1원 이상이어야 합니다"),
    paymentType: z.enum(["deposit", "balance", "full"]),
    provider: z.string().optional(),
  });

  const paymentUpdateSchema = z.object({
    status: z.enum(["initiated", "authorized", "captured", "canceled", "refunded"]),
    reason: z.string().optional(),
  });

  const workSessionStartSchema = z.object({
    triggerSource: z.enum(["check_in", "first_proof", "requester_manual"]),
    proofEventId: z.number().nullable().optional(),
  });

  const workProofSchema = z.object({
    eventType: z.enum(["delivery", "pickup", "return", "incident", "other"]).optional(),
    photoUrl: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
  });

  const incidentWorkflowSchema = z.object({
    action: z.enum(["evidence_requested", "evidence_submitted", "hold_settlement", "review_started", "resolved", "escalated", "closed"]),
    notes: z.string().optional(),
    dueHours: z.number().optional(),
    resolution: z.string().optional(),
    resolutionAmount: z.number().optional(),
    escalatedTo: z.string().optional(),
  });

  // 계약 실행 트리거 (결제 + 약관 동의 = 법적 효력 발생)
  app.post("/api/contracts/:id/execute", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // Validate input
      const validatedInput = contractExecutionSchema.parse(req.body);
      const contractId = Number(req.params.id);

      // Verify contract exists and user is authorized
      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Only requester can execute a contract
      if (contract.requesterId !== userId) {
        return res.status(403).json({ message: "의뢰인만 계약을 실행할 수 있습니다" });
      }

      // Check if contract is already executed
      if (contract.status === "deposit_paid" || contract.status === "completed") {
        return res.status(400).json({ message: "이미 실행된 계약입니다" });
      }

      // Verify payment exists and matches requirements for payment_confirmed trigger
      let linkedPayment: any = null;
      if (validatedInput.triggerType === "payment_confirmed") {
        if (!validatedInput.paymentId) {
          return res.status(400).json({ message: "결제 ID가 필요합니다" });
        }

        const payment = await storage.getPayment(validatedInput.paymentId);
        if (!payment) {
          return res.status(404).json({ message: "결제 정보를 찾을 수 없습니다" });
        }

        // Payment must be for this contract, by this requester, and captured
        if (payment.contractId !== contractId) {
          return res.status(400).json({ message: "이 계약과 연결된 결제가 아닙니다" });
        }
        if (payment.payerId !== userId) {
          return res.status(403).json({ message: "본인이 결제한 건만 사용할 수 있습니다" });
        }
        if (payment.status !== "captured") {
          return res.status(400).json({ message: "결제가 완료되지 않았습니다" });
        }

        // Verify minimum payment amount (at least deposit amount)
        if (contract.depositAmount && payment.amount < contract.depositAmount) {
          return res.status(400).json({ message: "결제 금액이 예약금보다 적습니다" });
        }

        linkedPayment = payment;
      }

      // 계약 실행 이벤트 기록
      const executionEvent = await storage.createContractExecutionEvent({
        contractId,
        contractType: "service_contract",
        triggerType: validatedInput.triggerType,
        initiatedBy: userId,
        initiatorRole: "requester",
        paymentId: linkedPayment?.id || null,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: JSON.stringify({
          termsChecked: validatedInput.termsChecked,
          executionTime: new Date().toISOString(),
          paymentAmount: linkedPayment?.amount,
        }),
      });

      // 계약 상태 업데이트
      await storage.updateContract(contractId, {
        status: "deposit_paid",
        depositPaid: true,
        depositPaidAt: new Date(),
        downPaymentStatus: "paid",
      });

      res.json({ success: true, executionEvent });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Contract execution error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 건별 계약 실행 트리거
  app.post("/api/job-contracts/:id/execute", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // Validate input
      const validatedInput = contractExecutionSchema.parse(req.body);
      const jobContractId = Number(req.params.id);

      const jobContract = await storage.getJobContract(jobContractId);
      if (!jobContract) {
        return res.status(404).json({ message: "Job contract not found" });
      }

      // Only helper or requester in the contract can execute
      if (jobContract.helperId !== userId && jobContract.requesterId !== userId) {
        return res.status(403).json({ message: "이 계약에 대한 권한이 없습니다" });
      }

      // Verify payment exists if payment_confirmed trigger
      if (validatedInput.triggerType === "payment_confirmed") {
        const existingPayment = await storage.getPaymentByJobContract(jobContractId);
        if (!existingPayment || existingPayment.status !== "captured") {
          return res.status(400).json({ message: "결제 완료 후에만 계약 실행이 가능합니다" });
        }
      }

      const initiatorRole = userId === jobContract.helperId ? "helper" : "requester";

      // 계약 실행 이벤트 기록
      const executionEvent = await storage.createContractExecutionEvent({
        contractId: jobContractId,
        contractType: "job_contract",
        triggerType: validatedInput.triggerType,
        initiatedBy: userId,
        initiatorRole,
        paymentId: validatedInput.paymentId || null,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: JSON.stringify({
          termsChecked: validatedInput.termsChecked,
          executionTime: new Date().toISOString(),
        }),
      });

      // 계약 상태 업데이트
      await storage.updateJobContract(jobContractId, {
        status: "executed",
        executionEventId: executionEvent.id,
        executedAt: new Date(),
        executionStatus: "executed",
      });

      res.json({ success: true, executionEvent });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Job contract execution error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 결제 API
  app.post("/api/payments", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // Validate input
      const validatedInput = paymentCreateSchema.parse(req.body);

      // At least one contract link is required
      if (!validatedInput.contractId && !validatedInput.jobContractId) {
        return res.status(400).json({ message: "계약 ID가 필요합니다" });
      }

      // Verify contract linkage and authorization
      if (validatedInput.contractId) {
        const contract = await storage.getContract(validatedInput.contractId);
        if (!contract) {
          return res.status(404).json({ message: "Contract not found" });
        }
        // Only requester can create payments for service contracts
        if (contract.requesterId !== userId) {
          return res.status(403).json({ message: "결제를 생성할 권한이 없습니다" });
        }

        // Check for existing pending/captured payments on this contract
        const existingPayment = await storage.getPaymentByContract(validatedInput.contractId);
        if (existingPayment && (existingPayment.status === "initiated" || existingPayment.status === "authorized" || existingPayment.status === "captured")) {
          return res.status(400).json({ message: "이 계약에 이미 진행 중인 결제가 있습니다" });
        }

        // Validate minimum payment amount matches contract
        if (validatedInput.paymentType === "deposit" && contract.depositAmount && validatedInput.amount < contract.depositAmount) {
          return res.status(400).json({ message: "예약금 금액이 부족합니다" });
        }
      }

      if (validatedInput.jobContractId) {
        const jobContract = await storage.getJobContract(validatedInput.jobContractId);
        if (!jobContract) {
          return res.status(404).json({ message: "Job contract not found" });
        }
        // Only requester can create payments for job contracts
        if (jobContract.requesterId !== userId) {
          return res.status(403).json({ message: "결제를 생성할 권한이 없습니다" });
        }

        // Check for existing pending/captured payments on this job contract
        const existingPayment = await storage.getPaymentByJobContract(validatedInput.jobContractId);
        if (existingPayment && (existingPayment.status === "initiated" || existingPayment.status === "authorized" || existingPayment.status === "captured")) {
          return res.status(400).json({ message: "이 계약에 이미 진행 중인 결제가 있습니다" });
        }
      }

      const payment = await storage.createPayment({
        contractId: validatedInput.contractId,
        jobContractId: validatedInput.jobContractId,
        orderId: validatedInput.orderId,
        payerId: userId,
        provider: validatedInput.provider || "manual",
        amount: validatedInput.amount,
        paymentType: validatedInput.paymentType,
        status: "initiated",
        depositFlag: validatedInput.paymentType === "deposit",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 결제 상태 이벤트 기록
      await storage.createPaymentStatusEvent({
        paymentId: payment.id,
        previousStatus: null,
        newStatus: "initiated",
        changedBy: userId,
        reason: "결제 생성",
      });

      res.json(payment);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Payment creation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/payments/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // Validate input
      const validatedInput = paymentUpdateSchema.parse(req.body);

      const paymentId = Number(req.params.id);
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Critical transitions require HQ staff authorization
      const criticalTransitions = ["captured", "refunded"];
      if (criticalTransitions.includes(validatedInput.status)) {
        if (!user?.isHqStaff) {
          return res.status(403).json({ message: "본사 직원만 결제 완료/환불 처리할 수 있습니다" });
        }
      } else {
        // Non-critical transitions: Only payer or HQ staff can update
        if (payment.payerId !== userId && !user?.isHqStaff) {
          return res.status(403).json({ message: "결제 상태를 변경할 권한이 없습니다" });
        }
      }

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        initiated: ["authorized", "captured", "canceled"],
        authorized: ["captured", "canceled"],
        captured: ["refunded"],
        canceled: [],
        refunded: [],
      };

      const currentStatus = payment.status || "initiated";
      if (!validTransitions[currentStatus]?.includes(validatedInput.status)) {
        return res.status(400).json({
          message: `${currentStatus}에서 ${validatedInput.status}로 변경할 수 없습니다`
        });
      }

      const previousStatus = payment.status;
      const updates: any = { status: validatedInput.status };
      if (validatedInput.status === "captured") updates.paidAt = new Date();
      if (validatedInput.status === "canceled") {
        updates.canceledAt = new Date();
        updates.cancelReason = validatedInput.reason;
      }
      if (validatedInput.status === "refunded") {
        updates.refundedAt = new Date();
        updates.refundReason = validatedInput.reason;
      }

      const updated = await storage.updatePayment(paymentId, updates);

      // 결제 상태 변경 이벤트 기록
      await storage.createPaymentStatusEvent({
        paymentId,
        previousStatus,
        newStatus: validatedInput.status,
        changedBy: userId,
        reason: validatedInput.reason,
      });

      // 결제 완료 시 계약 실행 트리거 - 자동 실행하지 않음, 의뢰인이 별도로 실행해야 함
      // (이전에는 자동으로 계약 실행 이벤트를 생성했으나, 분리하여 명시적 실행 필요)

      // 환불/취소 시 계약 상태 업데이트
      if ((validatedInput.status === "refunded" || validatedInput.status === "canceled") && payment.contractId) {
        await storage.updateContract(payment.contractId, { status: "cancelled" });
      }
      if ((validatedInput.status === "refunded" || validatedInput.status === "canceled") && payment.jobContractId) {
        await storage.updateJobContract(payment.jobContractId, {
          status: "voided",
          executionStatus: "voided"
        });
      }

      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Payment update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin only - get all payments
  app.get("/api/payments", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/payments/:id/events", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const payment = await storage.getPayment(Number(req.params.id));
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Only payer or HQ staff can view payment events
      if (payment.payerId !== userId && !user?.isHqStaff) {
        return res.status(403).json({ message: "결제 이벤트를 조회할 권한이 없습니다" });
      }

      const events = await storage.getPaymentStatusEvents(Number(req.params.id));
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 업무 시작 트리거 (첫 번째 증빙 또는 수동 시작)
  app.post("/api/work-sessions/:id/start", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // Validate input
      const validatedInput = workSessionStartSchema.parse(req.body);

      const sessionId = Number(req.params.id);
      const session = await storage.getWorkSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Work session not found" });
      }

      // Authorization: Only helper in session, related requester, or HQ staff can start
      let isAuthorized = false;
      if (session.helperId === userId) {
        isAuthorized = true;
      } else if (user?.isHqStaff) {
        isAuthorized = true;
      } else if (session.jobContractId) {
        const jobContract = await storage.getJobContract(session.jobContractId);
        if (jobContract?.requesterId === userId) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ message: "업무 세션을 시작할 권한이 없습니다" });
      }

      const updated = await storage.updateWorkSession(sessionId, {
        status: "started",
        startTriggerSource: validatedInput.triggerSource,
        startEventId: validatedInput.proofEventId || null,
        startedAt: new Date(),
        startedBy: userId,
      });

      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Work session start error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 첫 번째 증빙 제출 시 자동 업무 시작
  app.post("/api/work-sessions/:id/proof", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // Validate input
      const validatedInput = workProofSchema.parse(req.body);

      const sessionId = Number(req.params.id);
      const session = await storage.getWorkSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Work session not found" });
      }

      // Only the helper assigned to this session can submit proof
      if (session.helperId !== userId) {
        return res.status(403).json({ message: "이 세션에 증빙을 제출할 권한이 없습니다" });
      }

      // 기존 증빙 확인
      const existingProofs = await storage.getWorkProofEventsBySession(sessionId);
      const isFirstProof = existingProofs.length === 0;

      // 증빙 이벤트 생성
      const proofEvent = await storage.createWorkProofEvent({
        workSessionId: sessionId,
        helperId: userId,
        eventType: validatedInput.eventType || "delivery",
        photoUrl: validatedInput.photoUrl,
        latitude: validatedInput.latitude,
        longitude: validatedInput.longitude,
        address: validatedInput.address,
        notes: validatedInput.notes,
        isFirstProof,
        verifiedAt: new Date(),
      });

      // 첫 번째 증빙인 경우 자동으로 업무 시작
      if (isFirstProof && session.status === "pending") {
        await storage.updateWorkSession(sessionId, {
          status: "started",
          startTriggerSource: "first_proof",
          startEventId: proofEvent.id,
          startedAt: new Date(),
          startedBy: userId,
        });
      }

      res.json(proofEvent);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Work proof submission error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 분쟁 목록 조회
  app.get("/api/incidents", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);

      // HQ staff can see all incidents, others only their own
      if (user?.isHqStaff) {
        const incidents = await storage.getAllIncidentReports();
        return res.json(incidents);
      } else {
        const incidents = await storage.getIncidentsByUser(userId);
        return res.json(incidents);
      }
    } catch (err: any) {
      console.error("Get incidents error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 분쟁 신규 접수
  const createIncidentSchema = z.object({
    incidentType: z.enum(["damage", "delay", "dispute", "complaint", "other"]),
    description: z.string().min(10, "설명은 최소 10자 이상 입력해주세요"),
    damageAmount: z.number().optional(),
    orderId: z.number().optional(),
    jobContractId: z.number().optional(),
  });

  app.post("/api/incidents", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);

      // Zod 스키마 검증
      const validatedData = createIncidentSchema.parse(req.body);

      // orderId 권한 검증 - 본인의 오더인지 확인
      if (validatedData.orderId) {
        const order = await storage.getOrder(validatedData.orderId);
        if (!order) {
          return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
        }
        // 헬퍼는 자신에게 배정된 오더, 의뢰인은 자신이 생성한 오더에만 분쟁 등록 가능
        if (user?.role === "helper" && order.matchedHelperId !== userId) {
          return res.status(403).json({ message: "본인에게 배정된 오더에만 분쟁을 등록할 수 있습니다" });
        }
        if (user?.role === "requester" && order.requesterId !== userId) {
          return res.status(403).json({ message: "본인이 등록한 오더에만 분쟁을 등록할 수 있습니다" });
        }
      }

      // jobContractId 권한 검증
      if (validatedData.jobContractId) {
        const contract = await storage.getJobContract(validatedData.jobContractId);
        if (!contract) {
          return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
        }
        if (user?.role === "helper" && contract.helperId !== userId) {
          return res.status(403).json({ message: "본인의 계약에만 분쟁을 등록할 수 있습니다" });
        }
        if (user?.role === "requester" && contract.requesterId !== userId) {
          return res.status(403).json({ message: "본인의 계약에만 분쟁을 등록할 수 있습니다" });
        }
      }

      const incident = await storage.createIncidentReport({
        reporterId: userId,
        reporterType: user?.role || "helper",
        incidentType: validatedData.incidentType,
        description: validatedData.description,
        damageAmount: validatedData.damageAmount,
        orderId: validatedData.orderId,
        jobContractId: validatedData.jobContractId,
        helperId: user?.role === "helper" ? userId : undefined,
        requesterId: user?.role === "requester" ? userId : undefined,
        status: "submitted",
        incidentDate: new Date().toISOString().split("T")[0],
      });

      // 분쟁 접수 액션 로그 생성
      await storage.createIncidentAction({
        incidentId: incident.id,
        actorId: userId,
        actorRole: user?.role || "helper",
        actionType: "submitted",
        previousStatus: null,
        newStatus: "submitted",
        notes: validatedData.description,
      });

      res.status(201).json(incident);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Create incident error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 분쟁 처리 워크플로우
  app.post("/api/incidents/:id/workflow", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // Validate input
      const validatedInput = incidentWorkflowSchema.parse(req.body);

      const incidentId = Number(req.params.id);
      const incident = await storage.getIncidentReport(incidentId);
      if (!incident) {
        return res.status(404).json({ message: "Incident not found" });
      }

      // Authorization: Role-based action permissions
      const isHqStaff = user?.isHqStaff;
      const isReporter = incident.reporterId === userId;

      // State-based constraints: prevent actions on closed/resolved incidents
      const closedStatuses = ["closed", "resolved"];
      if (closedStatuses.includes(incident.status || "")) {
        if (validatedInput.action !== "closed" || !isHqStaff) {
          return res.status(400).json({ message: "이미 종결된 분쟁입니다" });
        }
      }

      // Define valid status transitions
      const validStatusTransitions: Record<string, string[]> = {
        submitted: ["awaiting_evidence", "under_review", "resolved", "closed"],
        awaiting_evidence: ["under_review", "resolved", "closed"],
        under_review: ["resolved", "escalated", "closed"],
        escalated: ["under_review", "resolved", "closed"],
        resolved: ["closed"],
        closed: [],
      };

      // Define which actions each role can perform
      const hqOnlyActions = ["evidence_requested", "hold_settlement", "review_started", "resolved", "escalated", "closed"];
      const reporterActions = ["evidence_submitted"];

      if (hqOnlyActions.includes(validatedInput.action) && !isHqStaff) {
        return res.status(403).json({ message: "본사 직원만 수행할 수 있는 작업입니다" });
      }

      if (reporterActions.includes(validatedInput.action) && !isReporter && !isHqStaff) {
        return res.status(403).json({ message: "신고자 또는 본사 직원만 증빙을 제출할 수 있습니다" });
      }

      // Evidence submission is only valid when awaiting_evidence
      if (validatedInput.action === "evidence_submitted" && incident.status !== "awaiting_evidence") {
        return res.status(400).json({ message: "증빙 요청 상태에서만 증빙을 제출할 수 있습니다" });
      }

      const previousStatus = incident.status || "submitted";
      let newStatus = previousStatus;
      const updates: any = {};

      switch (validatedInput.action) {
        case "evidence_requested":
          if (!validStatusTransitions[previousStatus]?.includes("awaiting_evidence")) {
            return res.status(400).json({ message: "현재 상태에서 증빙 요청을 할 수 없습니다" });
          }
          newStatus = "awaiting_evidence";
          const dueHours = validatedInput.dueHours || 48;
          updates.evidenceDueAt = new Date(Date.now() + dueHours * 60 * 60 * 1000);
          break;
        case "evidence_submitted":
          newStatus = "under_review";
          break;
        case "hold_settlement":
          if (incident.settlementId) {
            await storage.updateSettlementStatement(incident.settlementId, {
              isOnHold: true,
              holdReason: validatedInput.notes,
              holdIncidentId: incidentId,
              holdStartedAt: new Date(),
              status: "on_hold",
            });
            updates.settlementHoldId = incident.settlementId;
          }
          break;
        case "review_started":
          if (!validStatusTransitions[previousStatus]?.includes("under_review")) {
            return res.status(400).json({ message: "현재 상태에서 검토를 시작할 수 없습니다" });
          }
          newStatus = "under_review";
          updates.reviewStartedAt = new Date();
          updates.reviewerId = userId;
          break;
        case "resolved":
          if (!validStatusTransitions[previousStatus]?.includes("resolved")) {
            return res.status(400).json({ message: "현재 상태에서 해결할 수 없습니다" });
          }
          if (!validatedInput.resolution) {
            return res.status(400).json({ message: "해결 내용이 필요합니다" });
          }
          newStatus = "resolved";
          updates.resolvedBy = userId;
          updates.resolvedAt = new Date();
          updates.resolution = validatedInput.resolution;
          updates.resolutionAmount = validatedInput.resolutionAmount;
          if (incident.settlementHoldId) {
            await storage.updateSettlementStatement(incident.settlementHoldId, {
              isOnHold: false,
              holdReleasedAt: new Date(),
              status: "confirmed",
            });
          }
          break;
        case "escalated":
          if (!validStatusTransitions[previousStatus]?.includes("escalated")) {
            return res.status(400).json({ message: "현재 상태에서 에스컬레이션할 수 없습니다" });
          }
          if (!validatedInput.escalatedTo) {
            return res.status(400).json({ message: "에스컬레이션 대상이 필요합니다" });
          }
          newStatus = "escalated";
          updates.escalatedAt = new Date();
          updates.escalatedTo = validatedInput.escalatedTo;
          break;
        case "closed":
          if (!validStatusTransitions[previousStatus]?.includes("closed") && previousStatus !== "resolved") {
            return res.status(400).json({ message: "현재 상태에서 종결할 수 없습니다" });
          }
          newStatus = "closed";
          break;
      }

      updates.status = newStatus;
      const updatedIncident = await storage.updateIncidentReport(incidentId, updates);

      // 액션 로그 기록
      await storage.createIncidentAction({
        incidentId,
        actorId: userId,
        actorRole: isHqStaff ? "hq_staff" : (user?.role || "unknown"),
        actionType: validatedInput.action,
        previousStatus,
        newStatus,
        notes: validatedInput.notes,
        metadata: JSON.stringify(req.body),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updatedIncident);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Incident workflow error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 분쟁 액션 이력 조회
  app.get("/api/incidents/:id/actions", requireAuth, async (req, res) => {
    try {
      const actions = await storage.getIncidentActions(Number(req.params.id));
      res.json(actions);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 계약 실행 이벤트 조회
  app.get("/api/contracts/:id/execution-events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getContractExecutionEventsByContract(
        Number(req.params.id),
        "service_contract"
      );
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/job-contracts/:id/execution-events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getContractExecutionEventsByContract(
        Number(req.params.id),
        "job_contract"
      );
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 계약 문서 API
  app.post("/api/contracts/:id/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const document = await storage.createContractDocument({
        contractId: Number(req.params.id),
        documentType: req.body.documentType,
        storagePath: req.body.storagePath,
        fileSize: req.body.fileSize,
        checksum: req.body.checksum,
        mimeType: req.body.mimeType || "application/pdf",
      });

      res.json(document);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/contracts/:id/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getContractDocuments(Number(req.params.id));
      res.json(documents);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== 추가 관리자 API (헬퍼, 요청자, 직원, 제재, 알림 템플릿) ====================

  // 회원 통계 (limit=9999 대신 사용)
  app.get("/api/admin/members/stats", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const helperResult = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE onboarding_status != 'pending') AS total,
          COUNT(*) FILTER (WHERE onboarding_status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE onboarding_status = 'approved' AND (status IS NULL OR status = 'active')) AS active,
          COUNT(*) FILTER (WHERE status = 'suspended') AS suspended
        FROM users WHERE role = 'helper' AND is_hq_staff IS NOT TRUE
      `);
      const requesterResult = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE onboarding_status != 'pending') AS total,
          COUNT(*) FILTER (WHERE onboarding_status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE onboarding_status = 'approved' AND (status IS NULL OR status = 'active')) AS active,
          COUNT(*) FILTER (WHERE status = 'suspended') AS suspended
        FROM users WHERE role = 'requester'
      `);
      const h = (helperResult.rows || [])[0] || {};
      const r = (requesterResult.rows || [])[0] || {};
      res.json({
        helpers: { total: Number(h.total || 0), pending: Number(h.pending || 0), active: Number(h.active || 0), suspended: Number(h.suspended || 0) },
        requesters: { total: Number(r.total || 0), pending: Number(r.pending || 0), active: Number(r.active || 0), suspended: Number(r.suspended || 0) },
      });
    } catch (err: any) {
      console.error("Error fetching member stats:", err);
      res.status(500).json({ message: "통계 조회 실패" });
    }
  });

  // 기사(헬퍼) 목록 조회 (상태 필터 지원)
  app.get("/api/admin/helpers", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const searchTerm = req.query.search as string;
      const offset = (page - 1) * limit;

      const users = await storage.getAllUsers();
      let helpers = users.filter(u => u.role === "helper" && !u.isHqStaff);

      // 상태 필터링: available = waiting 상태 + 활성 기사 + 승인된 헬퍼만
      if (statusFilter === "available") {
        helpers = helpers.filter(h =>
          (h.dailyStatus === "waiting" || !h.dailyStatus) &&
          h.onboardingStatus === "approved"
        );
      } else if (statusFilter === "working") {
        helpers = helpers.filter(h => h.dailyStatus === "working");
      } else if (statusFilter === "off") {
        helpers = helpers.filter(h => h.dailyStatus === "off");
      } else if (statusFilter === "pending") {
        helpers = helpers.filter(h => h.onboardingStatus === "pending");
      }

      // 검색 필터
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        helpers = helpers.filter(h =>
          h.name?.toLowerCase().includes(search) ||
          h.phoneNumber?.includes(search) ||
          h.email?.toLowerCase().includes(search) ||
          h.teamName?.toLowerCase().includes(search)
        );
      }

      const totalCount = helpers.length;
      const totalPages = Math.ceil(totalCount / limit);

      // 페이지네이션 적용
      const paginatedHelpers = helpers.slice(offset, offset + limit);

      const result = paginatedHelpers.map(h => ({
        id: h.id,
        username: h.username,
        email: h.email,
        name: h.name,
        phoneNumber: h.phoneNumber,
        address: h.address,
        birthDate: h.birthDate,
        dailyStatus: h.dailyStatus || "waiting",
        isTeamLeader: h.isTeamLeader || false,
        teamName: h.teamName,
        locationConsent: h.locationConsent || false,
        onboardingStatus: h.onboardingStatus,
        createdAt: h.createdAt,
      }));

      res.json({
        data: result,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 가용 헬퍼 목록 조회 (매칭용)
  app.get("/api/admin/helpers/available", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const helpers = users.filter(u =>
        u.role === "helper" &&
        !u.isHqStaff &&
        (u.dailyStatus === "waiting" || !u.dailyStatus) &&
        u.onboardingStatus === "approved"
      );

      const result = helpers.map(h => ({
        id: h.id,
        username: h.username,
        email: h.email,
        name: h.name,
        phoneNumber: h.phoneNumber,
        address: h.address,
        birthDate: h.birthDate,
        dailyStatus: h.dailyStatus || "waiting",
        isTeamLeader: h.isTeamLeader || false,
        teamName: h.teamName,
        locationConsent: h.locationConsent || false,
        latitude: h.latitude,
        longitude: h.longitude,
        createdAt: h.createdAt,
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 자격증명 상세 조회
  app.get("/api/admin/helper-credentials/:userId", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const credential = await storage.getHelperCredential(req.params.userId);
      if (!credential) {
        return res.json([]);
      }
      res.json(credential);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 요청자 목록 조회
  app.get("/api/admin/requesters", adminAuth, requirePermission("requesters.view"), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const searchTerm = req.query.search as string;
      const statusFilter = req.query.status as string;
      const offset = (page - 1) * limit;

      const users = await storage.getAllUsers();
      let requesters = users.filter(u => u.role === "requester");

      // 상태 필터
      if (statusFilter && statusFilter !== 'all') {
        requesters = requesters.filter(r => r.onboardingStatus === statusFilter);
      }

      // 검색 필터
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        requesters = requesters.filter(r =>
          r.name?.toLowerCase().includes(search) ||
          r.phoneNumber?.includes(search) ||
          r.email?.toLowerCase().includes(search)
        );
      }

      const totalCount = requesters.length;
      const totalPages = Math.ceil(totalCount / limit);

      // 페이지네이션 적용
      const paginatedRequesters = requesters.slice(offset, offset + limit);

      const result = paginatedRequesters.map(r => ({
        id: r.id,
        username: r.username,
        email: r.email,
        name: r.name,
        phoneNumber: r.phoneNumber,
        address: r.address,
        createdAt: r.createdAt,
      }));

      res.json({
        data: result,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 요청자 오더 목록 조회
  app.get("/api/admin/requesters/:userId/orders", adminAuth, requirePermission("requesters.view"), async (req, res) => {
    try {
      const allOrders = await storage.getAllOrders();
      const orders = allOrders.filter(o => o.requesterId === req.params.userId);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 요청자 상세 정보 조회
  app.get("/api/admin/requesters/:requesterId/detail", adminAuth, requirePermission("requesters.view"), async (req, res) => {
    try {
      const { requesterId } = req.params;
      const user = await storage.getUser(requesterId);
      if (!user || user.role !== "requester") {
        return res.status(404).json({ message: "요청자를 찾을 수 없습니다" });
      }

      const [business, serviceAgreement, refundAccountResult, userOrders, consentResult, allSanctions] = await Promise.all([
        storage.getRequesterBusiness(requesterId),
        storage.getRequesterServiceAgreement(requesterId),
        db.select().from(requesterRefundAccounts).where(eq(requesterRefundAccounts.userId, requesterId)).limit(1),
        storage.getOrders().then(orders => orders.filter(o => o.requesterId === requesterId)),
        db.select().from(signupConsents).where(eq(signupConsents.userId, requesterId)).limit(1),
        storage.getAllUserSanctions(),
      ]);
      const refundAccount = refundAccountResult[0] || null;
      const consent = consentResult[0] || null;
      const userSanctionsList = allSanctions.filter(s => s.userId === requesterId);

      // 요청자 고유번호 생성 (12자리)
      const generateRequesterCode = (id: string) => {
        const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return String(hash).padStart(12, '0').slice(-12);
      };

      // 관리자 이름 매핑 (제재 생성자)
      const adminUsers = await storage.getAllUsers();
      const adminMap = new Map(adminUsers.map(u => [u.id, u.name]));

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          profileImageUrl: user.profileImageUrl,
          onboardingStatus: user.onboardingStatus,
          onboardingReviewedAt: user.onboardingReviewedAt,
          onboardingRejectReason: user.onboardingRejectReason,
          requesterCode: generateRequesterCode(user.id),
          createdAt: user.createdAt,
        },
        orderStats: {
          total: userOrders.length,
          active: userOrders.filter(o => !['completed', 'cancelled', 'deleted'].includes(o.status || '')).length,
          completed: userOrders.filter(o => o.status === 'completed').length,
          cancelled: userOrders.filter(o => o.status === 'cancelled').length,
        },
        business: business ? {
          businessNumber: business.businessNumber,
          businessName: business.businessName,
          representativeName: business.representativeName,
          address: business.address,
          businessType: business.businessType,
          businessCategory: business.businessCategory,
          businessImageUrl: business.businessImageUrl,
          verificationStatus: business.verificationStatus,
        } : null,
        serviceAgreement: serviceAgreement ? {
          contractAgreed: serviceAgreement.contractAgreed,
          depositAmount: serviceAgreement.depositAmount,
          balanceAmount: serviceAgreement.balanceAmount,
          balanceDueDate: serviceAgreement.balanceDueDate,
          signatureData: serviceAgreement.signatureData,
          phoneNumber: serviceAgreement.phoneNumber,
          phoneVerified: serviceAgreement.phoneVerified,
          agreedAt: serviceAgreement.agreedAt,
        } : null,
        refundAccount: refundAccount ? {
          bankName: refundAccount.bankName,
          accountNumber: maskAccountNumber(refundAccount.accountNumber),
          accountHolder: refundAccount.accountHolder,
          createdAt: refundAccount.createdAt,
          updatedAt: refundAccount.updatedAt,
        } : null,
        // 가입시 동의사항
        signupConsent: consent ? {
          termsAgreed: consent.termsAgreed,
          privacyAgreed: consent.privacyAgreed,
          locationAgreed: consent.locationAgreed,
          paymentAgreed: consent.paymentAgreed,
          liabilityAgreed: consent.liabilityAgreed,
          electronicAgreed: consent.electronicAgreed,
          marketingAgreed: consent.marketingAgreed,
          agreedAt: consent.agreedAt,
        } : null,
        // 제재 이력
        sanctions: userSanctionsList.map(s => ({
          id: s.id,
          sanctionType: s.sanctionType,
          reason: s.reason,
          evidence: s.evidence,
          startDate: s.startDate,
          endDate: s.endDate,
          isActive: s.isActive,
          createdBy: s.createdBy,
          createdByName: adminMap.get(s.createdBy || '') || '-',
          createdAt: s.createdAt,
        })),
        // 오더 이력 (날짜 + 오더번호 + 상태)
        orderHistory: userOrders
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .map(o => ({
            id: o.id,
            orderNumber: o.orderNumber || null,
            status: o.status,
            createdAt: o.createdAt,
            closedAt: o.closedAt,
            companyName: o.companyName,
            deliveryArea: o.deliveryArea,
          })),
      });
    } catch (err: any) {
      console.error("Requester detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 직원(HQ Staff) 목록 조회
  app.get("/api/admin/staff", adminAuth, requirePermission("staff.view"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const staff = users.filter(u => u.isHqStaff || u.role === "admin");
      const result = staff.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phoneNumber: s.phoneNumber,
        role: s.role === "admin" ? "관리자" : "본사직원",
        isHqStaff: s.isHqStaff || false,
        adminStatus: s.adminStatus || "active", // pending, active, suspended
        approvedAt: s.approvedAt,
        passwordChangedAt: s.passwordChangedAt,
        createdAt: s.createdAt,
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 역할 목록 조회
  app.get("/api/admin/roles", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const roles = await storage.getAllAdminRoles();
      res.json(roles);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 역할별 권한 조회
  app.get("/api/admin/roles/:id/permissions", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const roleId = Number(req.params.id);
      const permissions = await storage.getRolePermissions(roleId);
      res.json(permissions);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 권한 목록 조회
  app.get("/api/admin/permissions", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const permissions = await storage.getAllAdminPermissions();
      res.json(permissions);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 현재 사용자 권한 목록 조회
  app.get("/api/admin/my-permissions", adminAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const permissions = await storage.getUserPermissions(userId);
      res.json(permissions);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 직원 역할 배정
  app.post("/api/admin/staff/:userId/roles", adminAuth, requirePermission("staff.roles"), async (req, res) => {
    try {
      const { roleId } = req.body;
      const userId = req.params.userId;
      const assignedBy = (req as any).user?.id;

      if (!roleId) {
        return res.status(400).json({ message: "역할 ID가 필요합니다" });
      }

      const assignment = await storage.assignRoleToStaff(userId, roleId, assignedBy);
      res.status(201).json({ success: true, assignment });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 직원 역할 해제
  app.delete("/api/admin/staff/:userId/roles/:roleId", adminAuth, requirePermission("staff.roles"), async (req, res) => {
    try {
      const userId = req.params.userId;
      const roleId = Number(req.params.roleId);

      await storage.removeRoleFromStaff(userId, roleId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 직원 역할 조회
  app.get("/api/admin/staff/:userId/roles", adminAuth, requirePermission("staff.view"), async (req, res) => {
    try {
      const assignments = await storage.getStaffRoleAssignments(req.params.userId);
      const roles = await storage.getAllAdminRoles();
      const roleMap = new Map<number, any>(roles.map(r => [r.id, r]));

      const result = assignments.map(a => ({
        ...a,
        role: roleMap.get(a.roleId),
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 제재 목록 조회
  app.get("/api/admin/sanctions", adminAuth, requirePermission("sanctions.view"), async (req, res) => {
    try {
      const sanctions = await storage.getAllUserSanctions();
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const result = sanctions.map(s => ({
        ...s,
        userName: userMap.get(s.userId)?.name || "Unknown",
        userEmail: userMap.get(s.userId)?.email || "",
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 제재 등록
  app.post("/api/admin/sanctions", adminAuth, requirePermission("sanctions.create"), async (req, res) => {
    try {
      const { userId, sanctionType, reason, evidence, durationDays } = req.body;
      if (!userId || !sanctionType || !reason) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
      }

      const startDate = new Date().toISOString().split("T")[0];
      const endDate = durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : null;

      const sanction = await storage.createUserSanction({
        userId,
        sanctionType,
        reason,
        evidence: evidence || null,
        startDate,
        endDate,
        isActive: true,
        createdBy: (req as any).user?.id || null,
      });

      // 감사 로그 기록 (필수 - 법적 증빙)
      await logAdminAction({
        req,
        action: "sanction.create",
        targetType: "user",
        targetId: userId,
        oldValue: null,
        newValue: { sanctionType, reason, evidence, startDate, endDate },
      });

      // 사용자에게 알림 생성
      await storage.createNotification({
        userId,
        type: "announcement",
        title: "계정 제재 안내",
        message: `${sanctionType === "warning" ? "경고" : sanctionType === "suspension" ? "정지" : "블랙리스트"} 조치가 적용되었습니다: ${reason}`,
      });

      res.status(201).json({ success: true, sanction });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 제재 해제
  app.patch("/api/admin/sanctions/:id/lift", adminAuth, requirePermission("sanctions.delete"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sanction = await storage.getUserSanction(id);
      if (!sanction) {
        return res.status(404).json({ message: "제재 정보를 찾을 수 없습니다" });
      }

      const updated = await storage.updateUserSanction(id, {
        isActive: false,
      });

      // 감사 로그 기록 (필수 - 법적 증빙)
      await logAdminAction({
        req,
        action: "sanction.lift",
        targetType: "user",
        targetId: sanction.userId,
        oldValue: { sanctionId: id, sanctionType: sanction.sanctionType, isActive: true },
        newValue: { sanctionId: id, isActive: false },
      });

      // 사용자에게 알림
      await storage.createNotification({
        userId: sanction.userId,
        type: "announcement",
        title: "제재 해제 안내",
        message: "계정 제재가 해제되었습니다.",
      });

      res.json({ success: true, sanction: updated });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==============================================
  // 고객센터 문의 (Customer Service Inquiries)
  // ==============================================

  // 관리자: 모든 문의 조회
  app.get("/api/admin/cs-inquiries", adminAuth, async (req, res) => {
    try {
      const inquiries = await storage.getAllCustomerServiceInquiries();
      // 각 문의에 사용자 정보 추가
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      // orderNumber 매핑
      const csOrderIds = [...new Set(inquiries.filter(i => i.orderId).map(i => i.orderId!))];
      const csOrderList = csOrderIds.length > 0
        ? await db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders).where(inArray(orders.id, csOrderIds))
        : [];
      const csOrderMap = new Map(csOrderList.map(o => [o.id, o.orderNumber]));
      const result = inquiries.map(inq => ({
        ...inq,
        userName: userMap.get(inq.userId)?.name || "알 수 없음",
        userPhone: userMap.get(inq.userId)?.phoneNumber || "",
        userEmail: userMap.get(inq.userId)?.email || "",
        orderNumber: inq.orderId ? csOrderMap.get(inq.orderId) || null : null,
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 관리자: 문의 상세 조회
  app.get("/api/admin/cs-inquiries/:id", adminAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const inquiry = await storage.getCustomerServiceInquiry(id);
      if (!inquiry) {
        return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      }
      const user = await storage.getUser(inquiry.userId);
      res.json({
        ...inquiry,
        userName: user?.name || "알 수 없음",
        userPhone: user?.phoneNumber || "",
        userEmail: user?.email || "",
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 관리자: 문의 답변/상태 업데이트
  app.patch("/api/admin/cs-inquiries/:id", adminAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).user;

      const parseResult = updateCustomerServiceInquirySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request data", errors: parseResult.error.flatten() });
      }

      const { status, response, adminNote, priority, assignedTo } = parseResult.data;

      const updates: any = {};
      if (status) updates.status = status;
      if (response !== undefined) {
        updates.response = response;
        updates.respondedAt = new Date();
        updates.respondedBy = adminUser?.id;
      }
      if (adminNote !== undefined) updates.adminNote = adminNote;
      if (priority) updates.priority = priority;
      if (assignedTo !== undefined) updates.assignedTo = assignedTo;

      const updated = await storage.updateCustomerServiceInquiry(id, updates);

      // 답변이 있으면 사용자에게 알림
      if (response) {
        const inquiry = await storage.getCustomerServiceInquiry(id);
        if (inquiry) {
          await storage.createNotification({
            userId: inquiry.userId,
            type: "announcement",
            title: "문의 답변 완료",
            message: `'${inquiry.title}' 문의에 답변이 등록되었습니다.`,
          });
        }
      }

      res.json({ success: true, inquiry: updated });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 사용자: 내 문의 목록 조회
  app.get("/api/cs-inquiries", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const inquiries = await storage.getCustomerServiceInquiriesByUser(userId);
      res.json(inquiries);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 사용자: 문의 상세 조회
  app.get("/api/cs-inquiries/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const id = Number(req.params.id);
      const inquiry = await storage.getCustomerServiceInquiry(id);

      if (!inquiry) {
        return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      }
      if (inquiry.userId !== userId) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }
      res.json(inquiry);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 사용자: 문의 등록
  app.post("/api/cs-inquiries", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parseResult = insertCustomerServiceInquirySchema.safeParse({
        ...req.body,
        userId: user.id,
        userRole: user.role,
        status: "pending",
        priority: "normal",
      });

      if (!parseResult.success) {
        return res.status(400).json({ message: "필수 항목을 입력해주세요", errors: parseResult.error.flatten() });
      }

      const inquiry = await storage.createCustomerServiceInquiry(parseResult.data);

      res.status(201).json({ success: true, inquiry });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 알림 템플릿 목록 (systemSettings에서 템플릿 조회)
  app.get("/api/admin/notification-templates", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const templates = settings
        .filter(s => s.settingKey.startsWith("notification_template_"))
        .map((s, idx) => {
          const data = JSON.parse(s.settingValue);
          return { id: idx + 1, key: s.settingKey, ...data };
        });
      res.json(templates);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 알림 템플릿 생성/수정
  app.post("/api/admin/notification-templates", adminAuth, requirePermission("notifications.edit"), async (req, res) => {
    try {
      const { eventType, title, message, targetAudience } = req.body;
      const key = `notification_template_${eventType}`;
      const value = JSON.stringify({ eventType, title, message, targetAudience, isActive: true });
      await storage.upsertSystemSetting(key, value, `알림 템플릿: ${eventType}`);
      res.json({ success: true, key });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 알림 발송 (내부 알림 + WebSocket)
  app.post("/api/admin/notifications/send", adminAuth, requirePermission("notifications.send"), async (req, res) => {
    try {
      const { targetAudience, title, message, targetUserIds } = req.body;

      let userIds: string[] = [];

      if (targetUserIds && targetUserIds.length > 0) {
        userIds = targetUserIds;
      } else {
        const users = await storage.getAllUsers();
        if (targetAudience === "all") {
          userIds = users.map(u => u.id);
        } else if (targetAudience === "helper") {
          userIds = users.filter(u => u.role === "helper").map(u => u.id);
        } else if (targetAudience === "requester") {
          userIds = users.filter(u => u.role === "requester").map(u => u.id);
        }
      }

      // 각 사용자에게 알림 생성
      let sentCount = 0;
      for (const userId of userIds) {
        await storage.createNotification({
          userId,
          type: "announcement",
          title,
          message,
        });
        sentCount++;
      }

      res.json({ success: true, sentCount });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 입금 확인 및 등록 승인 (awaiting_deposit → open)
  app.post("/api/admin/orders/:orderId/approve-deposit", adminAuth, requirePermission("orders.manage"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // awaiting_deposit 상태에서만 입금 승인 가능
      if (order.status !== ORDER_STATUS.AWAITING_DEPOSIT) {
        return res.status(400).json({ message: `현재 상태(${order.status})에서는 입금 승인할 수 없습니다` });
      }

      // 오더 상태를 open으로 변경 (paymentStatus도 함께 업데이트)
      await storage.updateOrder(orderId, {
        status: ORDER_STATUS.OPEN,
        approvalStatus: "approved",
        paymentStatus: "deposit_confirmed",
        matchedAt: new Date(), // 입금 확인 시간 기록
      });

      // 계약(contracts) 테이블도 업데이트
      const contracts = await storage.getOrderContracts(orderId);
      if (contracts.length > 0) {
        await storage.updateContract(contracts[0].id, {
          depositPaid: true,
          depositPaidAt: new Date(),
          downPaymentStatus: "paid",
        });
      }

      // 의뢰인에게 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "order_approved",
          title: "오더 등록 완료",
          message: `${order.companyName} 오더 입금이 확인되어 등록되었습니다. 이제 헬퍼가 신청할 수 있습니다.`,
          relatedId: orderId,
        });

        notificationWS.sendOrderStatusUpdate(order.requesterId, {
          orderId,
          status: ORDER_STATUS.OPEN,
          approvalStatus: "approved",
        });

        sendPushToUser(order.requesterId, {
          title: "오더 등록 완료",
          body: `${order.companyName} 오더 입금 확인. 헬퍼 모집이 시작됩니다.`,
          url: "/requester-home",
          tag: `order-approved-${orderId}`,
        });
      }

      // 모든 헬퍼에게 새 오더 알림 (optional - broadcast)
      broadcastToAllAdmins("order", "open", orderId, {
        orderId,
        companyName: order.companyName,
        status: ORDER_STATUS.OPEN,
      });

      res.json({ success: true, message: "오더가 등록되었습니다" });
    } catch (err: any) {
      console.error("Order approval error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더에 헬퍼 신청 (관리자가 대신 신청 — 배정이 아님)
  app.post("/api/admin/orders/:orderId/assign", adminAuth, requirePermission("orders.assign"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const { helperId } = req.body;

      if (!helperId) {
        return res.status(400).json({ message: "기사 ID가 필요합니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 신청은 open 상태에서만 가능
      const assignOrderStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(assignOrderStatus, CAN_SELECT_HELPER_STATUSES)) {
        return res.status(400).json({
          message: "신청은 'OPEN' 상태에서만 가능합니다. 현재 상태: " + order.status
        });
      }

      const helper = await storage.getUser(helperId);
      if (!helper || helper.role !== "helper") {
        return res.status(404).json({ message: "기사를 찾을 수 없습니다" });
      }

      // 이미 신청한 헬퍼인지 확인
      const existingApp = await storage.getOrderApplication(orderId, helperId);
      if (existingApp) {
        return res.status(400).json({ message: "이미 신청한 헬퍼입니다" });
      }

      // 최대 신청 인원 확인 (order.maxHelpers, 기본값 3)
      const maxHelpers = order.maxHelpers || 3;
      const currentApplications = await storage.getOrderApplications(orderId);
      const activeApplications = currentApplications.filter((a: any) =>
        a.status === "applied" || a.status === "selected" || a.status === "scheduled" || a.status === "in_progress"
      );
      if (activeApplications.length >= maxHelpers) {
        return res.status(400).json({ message: `최대 신청 인원(${maxHelpers}명)에 도달했습니다` });
      }

      // 신청 생성 (applied 상태 = 관리자가 대신 신청)
      const application = await storage.createOrderApplication({
        orderId,
        helperId,
        status: "applied",
      });

      const newHelperCount = activeApplications.length + 1;

      // 오더 상태는 변경하지 않음 (open 유지) — 신청이므로
      // 기사 상태도 변경하지 않음 — 아직 매칭 아님

      // 헬퍼에게 알림
      await storage.createNotification({
        userId: helperId,
        type: "helper_applied",
        title: "오더 신청 완료",
        message: `관리자가 ${order.companyName || "배송"} 오더에 신청했습니다. (${newHelperCount}/${maxHelpers}명)`,
        relatedId: orderId,
      });
      console.log(`[Admin Apply] Admin applied order ${orderId} for Helper ${helperId}`);

      // 의뢰인에게 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "helper_applied",
          title: "헬퍼 업무 신청",
          message: `${helper.name || "헬퍼"}님이 ${order.companyName || "배송"} 오더에 신청했습니다. (${newHelperCount}/${maxHelpers}명)`,
          relatedId: orderId,
        });

        // Real-time update to requester (상태는 open 유지)
        notificationWS.sendOrderStatusUpdate(order.requesterId, {
          orderId,
          status: order.status || "open",
          applicantCount: newHelperCount,
        });
      }

      // Real-time update to helper
      notificationWS.sendOrderStatusUpdate(helperId, {
        orderId,
        status: order.status || "open",
        applicantCount: newHelperCount,
      });

      // Broadcast to all admins for real-time updates
      broadcastToAllAdmins("order_application", "helper_applied", orderId, {
        orderId,
        helperId,
        helperName: helper.name,
        companyName: order.companyName,
        applicationsCount: newHelperCount,
      });

      res.json({ success: true, application, helperId });
    } catch (err: any) {
      console.error("[Admin Apply] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 전체 배정 (신청된 헬퍼 일괄 배정 + 푸시알림 + 전화번호 전송)
  app.post("/api/admin/orders/:orderId/bulk-assign", adminAuth, requirePermission("orders.assign"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // open 상태에서만 전체 배정 가능
      const bulkAssignStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(bulkAssignStatus, CAN_SELECT_HELPER_STATUSES)) {
        return res.status(400).json({
          message: "전체 배정은 'OPEN' 상태에서만 가능합니다. 현재 상태: " + order.status
        });
      }

      // 신청된(applied) 헬퍼 목록 조회
      const allApplications = await storage.getOrderApplications(orderId);
      const appliedApps = allApplications.filter((a: any) => a.status === "applied");

      if (appliedApps.length === 0) {
        return res.status(400).json({ message: "신청된 헬퍼가 없습니다" });
      }

      // 의뢰인 정보 조회
      const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
      const requesterPhone = requester?.phoneNumber || "연락처 미등록";

      // 전체 헬퍼 정보 조회
      const helperInfos: { id: string; name: string; phone: string }[] = [];
      for (const app of appliedApps) {
        const helper = await storage.getUser(app.helperId);
        if (helper) {
          helperInfos.push({
            id: helper.id,
            name: helper.name || "헬퍼",
            phone: helper.phoneNumber || "연락처 미등록",
          });
        }
      }

      // 일괄 배정 처리: applied → approved, 오더 → scheduled
      for (const app of appliedApps) {
        await storage.updateOrderApplication(app.id, { status: "approved" });
      }

      // 첫 번째 헬퍼를 대표 matchedHelperId로 설정 (복수 배정이지만 DB 호환)
      const firstHelper = helperInfos[0];
      await storage.updateOrder(orderId, {
        status: "scheduled",
        matchedHelperId: firstHelper?.id || null,
        currentHelpers: appliedApps.length,
      });

      // 전체 헬퍼 연락처 목록 (알림 메시지용)
      const helperListText = helperInfos
        .map((h, i) => `${i + 1}. ${h.name} (${h.phone})`)
        .join("\n");

      // 각 헬퍼에게 배정 알림 + 의뢰인 전화번호 전송
      for (const helperInfo of helperInfos) {
        // 헬퍼 상태 업데이트
        await storage.updateUser(helperInfo.id, { dailyStatus: "working" });

        // 알림 생성
        await storage.createNotification({
          userId: helperInfo.id,
          type: "matching_success",
          title: "오더 배정 완료",
          message: `${order.companyName || "배송"} 오더에 배정되었습니다.\n의뢰인: ${requester?.name || "의뢰인"}\n연락처: ${requesterPhone}\n\n배정 인원: ${helperInfos.length}명`,
          relatedId: orderId,
        });

        // 푸시 알림
        sendPushToUser(helperInfo.id, {
          title: "오더 배정 완료",
          body: `${order.companyName || "배송"} 오더에 배정되었습니다. 의뢰인: ${requesterPhone}`,
          url: "/helper-dashboard",
          tag: `bulk-assign-${orderId}`,
        });

        // SMS: 배정 알림 (헬퍼에게)
        if (helperInfo.phone && helperInfo.phone !== "연락처 미등록") {
          try {
            await smsService.sendCustomMessage(helperInfo.phone,
              `[헬프미] ${order.companyName || "배송"} 오더에 배정되었습니다. 의뢰인: ${requester?.name || "의뢰인"} (${requesterPhone}). 앱에서 확인하세요.`);
          } catch (smsErr) { console.error("[SMS Error] bulk-assign helper:", smsErr); }
        }

        // WebSocket 실시간 알림
        notificationWS.sendOrderStatusUpdate(helperInfo.id, {
          orderId,
          status: "scheduled",
          currentHelpers: appliedApps.length,
        });
      }

      // 의뢰인에게 알림 (전체 헬퍼 연락처 포함)
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "matching_success",
          title: "헬퍼 전체 배정 완료",
          message: `${order.companyName || "배송"} 오더에 ${helperInfos.length}명이 배정되었습니다.\n\n${helperListText}`,
          relatedId: orderId,
        });

        sendPushToUser(order.requesterId, {
          title: "헬퍼 배정 완료",
          body: `${order.companyName || "배송"} 오더에 ${helperInfos.length}명이 배정되었습니다.`,
          url: "/requester-home",
          tag: `bulk-assign-requester-${orderId}`,
        });

        notificationWS.sendOrderStatusUpdate(order.requesterId, {
          orderId,
          status: "scheduled",
          currentHelpers: appliedApps.length,
        });

        // SMS: 배정 완료 알림 (의뢰인에게)
        const bulkRequester = await storage.getUser(order.requesterId);
        if (bulkRequester?.phoneNumber) {
          try {
            const helperNamesText = helperInfos.map(h => h.name).join(", ");
            await smsService.sendCustomMessage(bulkRequester.phoneNumber,
              `[헬프미] ${order.companyName || "배송"} 오더에 ${helperInfos.length}명 배정 완료. (${helperNamesText}). 앱에서 확인하세요.`);
          } catch (smsErr) { console.error("[SMS Error] bulk-assign requester:", smsErr); }
        }
      }

      // 관리자 브로드캐스트
      broadcastToAllAdmins("order", "bulk_assigned", orderId, {
        orderId,
        helperCount: helperInfos.length,
        status: "scheduled",
      });

      console.log(`[Admin Bulk Assign] Order ${orderId}: ${helperInfos.length} helpers assigned`);

      res.json({
        success: true,
        assignedCount: helperInfos.length,
        helpers: helperInfos.map(h => ({ id: h.id, name: h.name, phone: h.phone })),
      });
    } catch (err: any) {
      console.error("[Admin Bulk Assign] Error:", err);
      res.status(500).json({ message: "전체 배정에 실패했습니다" });
    }
  });

  // 본사 오더 직접 배정 (다중 헬퍼 원스텝 배정)
  app.post("/api/admin/orders/:orderId/direct-assign", adminAuth, requirePermission("orders.assign"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const { helperIds } = req.body;

      if (!helperIds || !Array.isArray(helperIds) || helperIds.length === 0) {
        return res.status(400).json({ message: "배정할 헬퍼를 선택해주세요" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // open 상태에서만 배정 가능
      const directAssignStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(directAssignStatus, CAN_SELECT_HELPER_STATUSES)) {
        return res.status(400).json({
          message: "배정은 'OPEN' 상태에서만 가능합니다. 현재 상태: " + order.status
        });
      }

      // 최대 헬퍼 수 확인
      const maxHelpers = order.maxHelpers || 3;
      const existingApps = await storage.getOrderApplications(orderId);
      const activeApps = existingApps.filter((a: any) =>
        a.status === "applied" || a.status === "approved" || a.status === "selected" || a.status === "scheduled" || a.status === "in_progress"
      );
      const availableSlots = maxHelpers - activeApps.length;
      if (helperIds.length > availableSlots) {
        return res.status(400).json({
          message: `최대 ${maxHelpers}명까지 배정 가능합니다. 현재 ${activeApps.length}명 배정 중, ${availableSlots}명 추가 가능.`
        });
      }

      // 의뢰인 정보 조회
      const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
      const requesterPhone = requester?.phoneNumber || "연락처 미등록";

      // 각 헬퍼에 대해 application 생성 (status: approved 바로)
      const assignedHelpers: { id: string; name: string; phone: string }[] = [];
      for (const helperId of helperIds) {
        const helper = await storage.getUser(helperId);
        if (!helper || helper.role !== "helper") {
          console.warn(`[Direct Assign] Helper ${helperId} not found or not helper role, skipping`);
          continue;
        }

        // 이미 신청한 헬퍼인지 확인
        const existingApp = await storage.getOrderApplication(orderId, helperId);
        if (existingApp) {
          // 이미 applied 상태면 approved로 변경
          if (existingApp.status === "applied") {
            await storage.updateOrderApplication(existingApp.id, { status: "approved" });
          }
          assignedHelpers.push({
            id: helper.id,
            name: helper.name || "헬퍼",
            phone: helper.phoneNumber || "연락처 미등록",
          });
          continue;
        }

        // 새로 application 생성 (바로 approved)
        await storage.createOrderApplication({
          orderId,
          helperId,
          status: "approved",
        });

        assignedHelpers.push({
          id: helper.id,
          name: helper.name || "헬퍼",
          phone: helper.phoneNumber || "연락처 미등록",
        });
      }

      if (assignedHelpers.length === 0) {
        return res.status(400).json({ message: "유효한 헬퍼가 없습니다" });
      }

      // 첫 번째 헬퍼를 대표 matchedHelperId로 설정
      const firstHelper = assignedHelpers[0];
      await storage.updateOrder(orderId, {
        status: "scheduled",
        matchedHelperId: firstHelper.id,
        currentHelpers: activeApps.length + assignedHelpers.length,
      });

      // 전체 헬퍼 연락처 목록 (알림 메시지용)
      const helperListText = assignedHelpers
        .map((h, i) => `${i + 1}. ${h.name} (${h.phone})`)
        .join("\n");

      // 각 헬퍼에게 배정 알림 + 푸시 + SMS
      for (const helperInfo of assignedHelpers) {
        await storage.updateUser(helperInfo.id, { dailyStatus: "working" });

        await storage.createNotification({
          userId: helperInfo.id,
          type: "matching_success",
          title: "오더 배정 완료",
          message: `${order.companyName || "배송"} 오더에 배정되었습니다.\n${requester ? `의뢰인: ${requester.name || "의뢰인"}\n연락처: ${requesterPhone}\n` : ""}배정 인원: ${assignedHelpers.length}명`,
          relatedId: orderId,
        });

        sendPushToUser(helperInfo.id, {
          title: "오더 배정 완료",
          body: `${order.companyName || "배송"} 오더에 배정되었습니다.${requester ? ` 의뢰인: ${requesterPhone}` : ""}`,
          url: "/helper-dashboard",
          tag: `direct-assign-${orderId}`,
        });

        if (helperInfo.phone && helperInfo.phone !== "연락처 미등록") {
          try {
            await smsService.sendCustomMessage(helperInfo.phone,
              `[헬프미] ${order.companyName || "배송"} 오더에 배정되었습니다.${requester ? ` 의뢰인: ${requester.name || "의뢰인"} (${requesterPhone})` : ""} 앱에서 확인하세요.`);
          } catch (smsErr) { console.error("[SMS Error] direct-assign helper:", smsErr); }
        }

        notificationWS.sendOrderStatusUpdate(helperInfo.id, {
          orderId,
          status: "scheduled",
          currentHelpers: activeApps.length + assignedHelpers.length,
        });
      }

      // 의뢰인에게 알림 (있을 경우)
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "matching_success",
          title: "헬퍼 배정 완료",
          message: `${order.companyName || "배송"} 오더에 ${assignedHelpers.length}명이 배정되었습니다.\n\n${helperListText}`,
          relatedId: orderId,
        });

        sendPushToUser(order.requesterId, {
          title: "헬퍼 배정 완료",
          body: `${order.companyName || "배송"} 오더에 ${assignedHelpers.length}명이 배정되었습니다.`,
          url: "/requester-home",
          tag: `direct-assign-requester-${orderId}`,
        });

        notificationWS.sendOrderStatusUpdate(order.requesterId, {
          orderId,
          status: "scheduled",
          currentHelpers: activeApps.length + assignedHelpers.length,
        });
      }

      broadcastToAllAdmins("order", "direct_assigned", orderId, {
        orderId,
        helperCount: assignedHelpers.length,
        status: "scheduled",
      });

      console.log(`[Admin Direct Assign] Order ${orderId}: ${assignedHelpers.length} helpers directly assigned`);

      res.json({
        success: true,
        assignedCount: assignedHelpers.length,
        helpers: assignedHelpers.map(h => ({ id: h.id, name: h.name, phone: h.phone })),
      });
    } catch (err: any) {
      console.error("[Admin Direct Assign] Error:", err);
      res.status(500).json({ message: "직접 배정에 실패했습니다" });
    }
  });

  // 개별 헬퍼 배정 해제
  app.delete("/api/admin/orders/:orderId/applications/:helperId", adminAuth, requirePermission("orders.assign"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const { helperId } = req.params;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // in_progress 이후 상태에서는 해제 불가
      const removeStatus = normalizeOrderStatus(order.status);
      if (removeStatus !== ORDER_STATUS.OPEN && removeStatus !== ORDER_STATUS.SCHEDULED) {
        return res.status(400).json({
          message: "업무 진행 중에는 배정 해제가 불가합니다. 현재 상태: " + order.status
        });
      }

      const application = await storage.getOrderApplication(orderId, helperId);
      if (!application) {
        return res.status(404).json({ message: "해당 헬퍼의 신청 내역을 찾을 수 없습니다" });
      }

      // application을 rejected로 변경
      await storage.updateOrderApplication(application.id, { status: "rejected" });

      // 남은 active 헬퍼 확인
      const allApps = await storage.getOrderApplications(orderId);
      const remainingApproved = allApps.filter((a: any) =>
        a.helperId !== helperId &&
        (a.status === "approved" || a.status === "selected" || a.status === "scheduled" || a.status === "in_progress")
      );

      if (remainingApproved.length === 0) {
        // 배정된 헬퍼가 없으면 open으로 복귀
        await storage.updateOrder(orderId, {
          status: "open",
          matchedHelperId: null,
          currentHelpers: 0,
        });
      } else {
        // 첫 번째 남은 헬퍼를 대표로 재설정
        await storage.updateOrder(orderId, {
          matchedHelperId: remainingApproved[0].helperId,
          currentHelpers: remainingApproved.length,
        });
      }

      // 해제된 헬퍼에게 알림
      await storage.createNotification({
        userId: helperId,
        type: "order_update",
        title: "오더 배정 해제",
        message: `${order.companyName || "배송"} 오더의 배정이 해제되었습니다.`,
        relatedId: orderId,
      });

      // 헬퍼 상태 복귀
      await storage.updateUser(helperId, { dailyStatus: "available" });

      broadcastToAllAdmins("order", "assignment_removed", orderId, {
        orderId,
        helperId,
        remainingHelpers: remainingApproved.length,
      });

      console.log(`[Admin Remove Assignment] Order ${orderId}: Helper ${helperId} removed, ${remainingApproved.length} remaining`);

      res.json({
        success: true,
        remainingHelpers: remainingApproved.length,
        newStatus: remainingApproved.length === 0 ? "open" : order.status,
      });
    } catch (err: any) {
      console.error("[Admin Remove Assignment] Error:", err);
      res.status(500).json({ message: "배정 해제에 실패했습니다" });
    }
  });

  // ============================================
  // 기사 상세 통합 API (Helper Detail)
  // ============================================
  // Get helper contracts (admin) - 헬퍼별 계약 정보 조회
  app.get("/api/admin/helpers/:helperId/contracts", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const { helperId } = req.params;
      const helperContracts = await storage.getHelperContracts(helperId);
      const orders = await storage.getOrders();
      const orderMap = new Map<number, any>(orders.map(o => [o.id, o]));

      const contractsWithDetails = helperContracts.map(c => {
        const order = orderMap.get(c.orderId);
        return {
          ...c,
          orderInfo: order ? {
            id: order.id,
            companyName: order.companyName,
            deliveryArea: order.deliveryArea,
            courierCompany: order.courierCompany || order.companyName,
            status: order.status,
          } : null,
        };
      });

      res.json(contractsWithDetails);
    } catch (err: any) {
      console.error("Error fetching helper contracts:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/helpers/:helperId/detail", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const { helperId } = req.params;
      const user = await storage.getUser(helperId);
      if (!user || user.role !== "helper") {
        return res.status(404).json({ message: "기사를 찾을 수 없습니다" });
      }

      const [credential, vehicles, business, bankAccount, license, termsAgreement, helperContracts, helperJobContracts, helperDocs] = await Promise.all([
        storage.getHelperCredential(helperId),
        storage.getHelperVehicle(helperId),
        storage.getHelperBusiness(helperId),
        storage.getHelperBankAccount(helperId),
        storage.getHelperLicense(helperId),
        storage.getHelperTermsAgreement(helperId),
        storage.getHelperContracts(helperId),
        storage.getHelperJobContracts(helperId),
        db.select().from(helperDocuments).where(eq(helperDocuments.userId, helperId)),
      ]);

      // 계약 정보 가공
      const contractsWithOrders = await Promise.all(
        (helperContracts || []).slice(0, 20).map(async (contract) => {
          const order = contract.orderId ? await storage.getOrder(contract.orderId) : null;
          const requester = order?.requesterId ? await storage.getUser(order.requesterId) : null;
          return {
            id: contract.id,
            orderId: contract.orderId,
            status: contract.status,
            depositAmount: contract.depositAmount,
            depositPaidAt: contract.depositPaidAt,
            balanceAmount: contract.balanceAmount,
            balancePaidAt: contract.balancePaidAt,
            totalAmount: contract.totalAmount,
            createdAt: contract.createdAt,
            order: order ? {
              pickupAddress: order.pickupAddress,
              deliveryAddress: order.deliveryAddress,
              scheduledDate: order.scheduledDate,
              averageQuantity: order.averageQuantity,
            } : null,
            requesterName: requester?.name || '-',
          };
        })
      );

      // 본사 계약 (Job Contracts) 정보 가공
      const jobContractsWithDetails = await Promise.all(
        (helperJobContracts || []).slice(0, 20).map(async (jc) => {
          const order = jc.orderId ? await storage.getOrder(jc.orderId) : null;
          const requester = jc.requesterId ? await storage.getUser(jc.requesterId) : null;
          return {
            id: jc.id,
            orderId: jc.orderId,
            status: jc.status,
            executionStatus: jc.executionStatus,
            workDate: jc.workDate,
            workStartTime: jc.workStartTime,
            workEndTime: jc.workEndTime,
            workContent: jc.workContent,
            paymentAmount: jc.paymentAmount,
            helperSignedAt: jc.helperSignedAt,
            requesterSignedAt: jc.requesterSignedAt,
            createdAt: jc.createdAt,
            order: order ? {
              pickupAddress: order.pickupAddress,
              deliveryAddress: order.deliveryAddress,
              scheduledDate: order.scheduledDate,
              averageQuantity: order.averageQuantity,
            } : null,
            requesterName: requester?.name || '-',
          };
        })
      );

      // 팀 정보 조회
      let teamInfo: any = null;
      const teams = await storage.getAllTeams();
      for (const team of teams) {
        const members = await storage.getTeamMembers(team.id);
        const isMember = members.some(m => m.helperId === helperId && m.isActive);
        if (isMember) {
          const leader = await storage.getUser(team.leaderId);
          teamInfo = {
            teamId: team.id,
            teamName: team.name,
            leaderName: leader?.name || "",
          };
          break;
        }
      }

      // helper_documents에서 이미지 URL 추출 (서류 제출 시 이미지가 여기에 저장됨)
      const docsByType: Record<string, any> = {};
      (helperDocs || []).forEach((doc: any) => {
        docsByType[doc.documentType] = doc;
      });

      // business 이미지를 documents에서 보완
      const businessWithImage = business ? {
        ...business,
        businessImageUrl: business.businessImageUrl || docsByType['businessCert']?.imageUrl || null,
      } : docsByType['businessCert'] ? {
        businessNumber: docsByType['businessCert'].businessNumber,
        businessName: docsByType['businessCert'].businessName,
        representativeName: docsByType['businessCert'].representativeName,
        address: docsByType['businessCert'].businessAddress,
        businessType: docsByType['businessCert'].businessType,
        businessCategory: docsByType['businessCert'].businessCategory,
        businessImageUrl: docsByType['businessCert'].imageUrl,
      } : null;

      // license 이미지를 documents에서 보완
      const licenseWithImages = license ? {
        ...license,
        driverLicenseImageUrl: license.driverLicenseImageUrl || docsByType['driverLicense']?.imageUrl || null,
        cargoLicenseImageUrl: license.cargoLicenseImageUrl || docsByType['cargoLicense']?.imageUrl || null,
      } : {
        driverLicenseImageUrl: docsByType['driverLicense']?.imageUrl || null,
        cargoLicenseImageUrl: docsByType['cargoLicense']?.imageUrl || null,
      };

      // vehicles를 배열로 변환 (getHelperVehicle은 단일 객체 반환)
      const vehiclesArray = vehicles ? [vehicles] : [];
      // vehicleCert 문서에서 차량 이미지 보완
      if (vehiclesArray.length > 0 && !vehiclesArray[0].vehicleImageUrl && docsByType['vehicleCert']?.imageUrl) {
        vehiclesArray[0] = { ...vehiclesArray[0], vehicleImageUrl: docsByType['vehicleCert'].imageUrl };
      } else if (vehiclesArray.length === 0 && docsByType['vehicleCert']?.imageUrl) {
        vehiclesArray.push({
          plateNumber: docsByType['vehicleCert'].plateNumber,
          vehicleType: docsByType['vehicleCert'].vehicleType,
          vehicleImageUrl: docsByType['vehicleCert'].imageUrl,
        } as any);
      }

      // bankAccount를 helper_bank_accounts에서 가져왔으므로 그대로 사용
      // 통장 이미지가 없으면 bankbookImageUrl도 null

      res.json({
        user: {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profileImageUrl: user.profileImageUrl,
          address: user.address,
          dailyStatus: user.dailyStatus,
          isTeamLeader: user.isTeamLeader,
          helperVerified: user.helperVerified,
          helperVerifiedAt: user.helperVerifiedAt,
          onboardingStatus: user.onboardingStatus,
          onboardingReviewedAt: user.onboardingReviewedAt,
          onboardingRejectReason: user.onboardingRejectReason,
          qrCode: user.qrCodeToken || `HELPER-${user.id}`,
          createdAt: user.createdAt,
        },
        credential,
        vehicles: vehiclesArray,
        business: businessWithImage,
        bankAccount,
        license: licenseWithImages,
        termsAgreement: termsAgreement ? {
          agreedAt: termsAgreement.agreedAt,
          signatureImageUrl: termsAgreement.signatureData,
          requiredTermsAgreed: Boolean(termsAgreement.serviceAgreed && termsAgreement.liabilityAgreed && termsAgreement.settlementAgreed),
          optionalTermsAgreed: Boolean(termsAgreement.locationAgreed),
          marketingAgreed: Boolean(termsAgreement.privacyAgreed),
          serviceAgreed: termsAgreement.serviceAgreed,
          vehicleAgreed: termsAgreement.vehicleAgreed,
          liabilityAgreed: termsAgreement.liabilityAgreed,
          settlementAgreed: termsAgreement.settlementAgreed,
          locationAgreed: termsAgreement.locationAgreed,
          privacyAgreed: termsAgreement.privacyAgreed,
        } : null,
        teamInfo,
        contracts: contractsWithOrders,
        jobContracts: jobContractsWithDetails,
      });
    } catch (err: any) {
      console.error("Helper detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 본사 계약 오더 API (Enterprise Orders)
  // ============================================
  app.get("/api/admin/enterprise-orders", adminAuth, requirePermission("enterprise.view"), async (req, res) => {
    try {
      const batches = await storage.getAllEnterpriseOrderBatches();
      const result = await Promise.all(batches.map(async (batch) => {
        const company = await storage.getEnterpriseAccount(batch.enterpriseId);
        return {
          id: batch.id,
          companyId: batch.enterpriseId,
          companyName: company?.name || "알수없음",
          projectCode: batch.projectCode,
          orderCount: batch.orderCount || 0,
          slaType: batch.slaType === "same_day" ? "당일배송" : batch.slaType === "next_day" ? "익일배송" : "예약배송",
          settlementModel: "건당정산",
          taxType: "exclusive",
          status: batch.status || "pending",
          createdAt: batch.createdAt,
          totalAmount: batch.totalAmount || 0,
        };
      }));
      res.json(result);
    } catch (err: any) {
      console.error("enterprise-orders error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/enterprise-companies", adminAuth, requirePermission("enterprise.view"), async (req, res) => {
    try {
      const accounts = await storage.getAllEnterpriseAccounts();
      const result = accounts.map(a => ({
        id: a.id,
        name: a.name,
        businessNumber: a.businessNumber || "",
        contactName: a.contactName || "",
        contactPhone: a.contactPhone || "",
        contractStart: a.contractStartDate,
        contractEnd: a.contractEndDate,
        status: a.isActive ? "active" : "inactive",
      }));
      res.json(result);
    } catch (err: any) {
      console.error("enterprise-companies error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/enterprise-companies", adminAuth, requirePermission("enterprise.create"), async (req, res) => {
    try {
      const { name, businessNumber, contactName, contactPhone, contractStart, contractEnd } = req.body;
      const account = await storage.createEnterpriseAccount({
        name,
        businessNumber: businessNumber || "",
        contactName,
        contactPhone,
        contractStartDate: contractStart,
        contractEndDate: contractEnd,
        isActive: true,
      });
      res.status(201).json(account);
    } catch (err: any) {
      console.error("create enterprise error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/enterprise-orders", adminAuth, requirePermission("enterprise.create"), async (req, res) => {
    try {
      const { companyId, projectCode, slaType, orderCount, totalAmount, notes, deliveryArea, vehicleType, pricePerUnit, scheduledDate } = req.body;

      // Get enterprise company info
      const company = await storage.getEnterpriseAccount(parseInt(companyId));
      if (!company) {
        return res.status(404).json({ message: "업체를 찾을 수 없습니다" });
      }

      // Create batch record
      const batch = await storage.createEnterpriseOrderBatch({
        enterpriseId: parseInt(companyId),
        projectCode,
        slaType: slaType || "next_day",
        orderCount: parseInt(orderCount) || 1,
        totalAmount: parseInt(totalAmount) || 0,
        notes,
        status: "pending",
      });

      // Create actual orders in orders table so helpers can see them
      const numOrders = parseInt(orderCount) || 1;
      const createdOrders: any[] = [];

      // Generate date string for scheduled date
      const today = new Date();
      const targetDate = scheduledDate || (() => {
        if (slaType === "same_day") {
          return `${today.getMonth() + 1}월 ${today.getDate()}일`;
        } else {
          const nextDay = new Date(today);
          nextDay.setDate(nextDay.getDate() + 1);
          return `${nextDay.getMonth() + 1}월 ${nextDay.getDate()}일`;
        }
      })();

      const { generateOrderNumber: genEntOrderNum } = await import("../../utils/order-number");
      for (let i = 0; i < numOrders; i++) {
        const entOrderNum = await genEntOrderNum({
          isEnterprise: true,
          deliveryArea: deliveryArea || "전국",
          enterpriseContactPhone: company.contactPhone,
        });
        const order = await storage.createOrder({
          requesterId: null, // Enterprise orders don't have individual requesters
          companyName: `${company.name} - ${projectCode}`,
          pricePerUnit: parseInt(pricePerUnit) || 1500,
          averageQuantity: "협의",
          deliveryArea: deliveryArea || "전국",
          scheduledDate: targetDate,
          vehicleType: vehicleType || "1톤하이탑",
          isUrgent: slaType === "same_day",
          status: ORDER_STATUS.OPEN,
          maxHelpers: 1,
          currentHelpers: 0,
          orderNumber: entOrderNum,
        });
        createdOrders.push(order);
      }

      // Notify all approved helpers about new orders
      const allHelpers = await storage.getAllUsers();
      const approvedHelpers = allHelpers.filter(u => u.role === "helper" && u.onboardingStatus === "approved");
      for (const helper of approvedHelpers) {
        await storage.createNotification({
          userId: helper.id,
          type: "new_order",
          title: "새로운 기업 오더 등록",
          message: `${company.name} - ${numOrders}건의 새 오더가 등록되었습니다.`,
          relatedId: createdOrders[0]?.id,
        });
      }

      res.status(201).json({ batch, orders: createdOrders });
    } catch (err: any) {
      console.error("create enterprise order error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/enterprise/orders", adminAuth, requirePermission("enterprise.create"), async (req, res) => {
    try {
      const { companyId, projectCode, slaType, orderCount, totalAmount, notes, deliveryArea, vehicleType, pricePerUnit, scheduledDate } = req.body;

      // Redirect to main enterprise-orders endpoint
      const company = await storage.getEnterpriseAccount(parseInt(companyId));
      if (!company) {
        return res.status(404).json({ message: "업체를 찾을 수 없습니다" });
      }

      const batch = await storage.createEnterpriseOrderBatch({
        enterpriseId: parseInt(companyId),
        projectCode,
        slaType: slaType || "next_day",
        orderCount: parseInt(orderCount) || 1,
        totalAmount: parseInt(totalAmount) || 0,
        notes,
        status: "pending",
      });

      // Create actual orders in orders table
      const numOrders = parseInt(orderCount) || 1;
      const createdOrders: any[] = [];

      const today = new Date();
      const targetDate = scheduledDate || (() => {
        if (slaType === "same_day") {
          return `${today.getMonth() + 1}월 ${today.getDate()}일`;
        } else {
          const nextDay = new Date(today);
          nextDay.setDate(nextDay.getDate() + 1);
          return `${nextDay.getMonth() + 1}월 ${nextDay.getDate()}일`;
        }
      })();

      const { generateOrderNumber: genEntOrderNum2 } = await import("../../utils/order-number");
      for (let i = 0; i < numOrders; i++) {
        const entOrderNum2 = await genEntOrderNum2({
          isEnterprise: true,
          deliveryArea: deliveryArea || "전국",
          enterpriseContactPhone: company.contactPhone,
        });
        const order = await storage.createOrder({
          requesterId: null,
          companyName: `${company.name} - ${projectCode}`,
          pricePerUnit: parseInt(pricePerUnit) || 1500,
          averageQuantity: notes || "협의",
          deliveryArea: deliveryArea || "전국",
          scheduledDate: targetDate,
          vehicleType: vehicleType || "1톤하이탑",
          isUrgent: slaType === "same_day",
          status: ORDER_STATUS.OPEN,
          maxHelpers: 1,
          currentHelpers: 0,
          orderNumber: entOrderNum2,
        });
        createdOrders.push(order);
      }

      res.status(201).json({ batch, orders: createdOrders });
    } catch (err: any) {
      console.error("create enterprise order error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/enterprise/orders/import", adminAuth, requirePermission("enterprise.upload"), async (req, res) => {
    try {
      const { enterpriseId, csvData } = req.body;

      if (!enterpriseId || !csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ message: "enterpriseId와 csvData 배열이 필요합니다" });
      }

      // 최대 500행 제한
      const MAX_ROWS = 500;
      if (csvData.length > MAX_ROWS) {
        return res.status(400).json({
          message: `한 번에 최대 ${MAX_ROWS}행까지만 업로드할 수 있습니다. 현재: ${csvData.length}행`
        });
      }

      const enterprise = await storage.getEnterpriseAccount(enterpriseId);
      if (!enterprise) {
        return res.status(404).json({ message: "업체를 찾을 수 없습니다" });
      }

      // 유효한 차량 타입 목록
      const VALID_VEHICLE_TYPES = [
        "다마스", "라보", "1톤", "1.2톤", "1.4톤", "1톤하이탑",
        "2.5톤", "3.5톤", "5톤", "5톤플러스", "11톤", "오토바이"
      ];

      // 날짜 형식 검증 (YYYY-MM-DD)
      const isValidDate = (dateStr: string): boolean => {
        if (!dateStr) return false;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) return false;
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      };

      const createdOrders: any[] = [];
      const errors: string[] = [];
      const processedKeys = new Set<string>();
      let duplicateCount = 0;

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        try {
          // 필수 필드 검증
          if (!row.companyName || !row.deliveryArea || !row.scheduledDate || !row.vehicleType) {
            errors.push(`행 ${i + 1}: 필수 필드(회사명, 배송지역, 일정, 차종) 누락`);
            continue;
          }

          // 날짜 형식 검증
          if (!isValidDate(row.scheduledDate)) {
            errors.push(`행 ${i + 1}: 날짜 형식 오류 (YYYY-MM-DD 형식 필요)`);
            continue;
          }

          // 차량 타입 검증
          if (!VALID_VEHICLE_TYPES.includes(row.vehicleType)) {
            errors.push(`행 ${i + 1}: 유효하지 않은 차종 (${row.vehicleType})`);
            continue;
          }

          // 가격 검증
          const price = parseInt(row.pricePerUnit);
          if (row.pricePerUnit && (isNaN(price) || price < 0)) {
            errors.push(`행 ${i + 1}: 유효하지 않은 단가`);
            continue;
          }

          // 중복 검사 (같은 회사+날짜+지역+차종)
          const rowKey = `${row.companyName}|${row.scheduledDate}|${row.deliveryArea}|${row.vehicleType}`;
          if (processedKeys.has(rowKey)) {
            errors.push(`행 ${i + 1}: 중복 데이터 (동일 조건 이미 존재)`);
            duplicateCount++;
            continue;
          }
          processedKeys.add(rowKey);

          const { generateOrderNumber: genExcelOrderNum } = await import("../../utils/order-number");
          const excelOrderNum = await genExcelOrderNum({
            isEnterprise: true,
            deliveryArea: row.deliveryArea || "",
            enterpriseContactPhone: enterprise.contactPhone,
          });
          const order = await storage.createOrder({
            companyName: row.companyName || enterprise.name,
            pricePerUnit: price || 0,
            averageQuantity: row.averageQuantity || "0box",
            deliveryArea: row.deliveryArea,
            scheduledDate: row.scheduledDate,
            vehicleType: row.vehicleType,
            isUrgent: row.isUrgent === true || row.isUrgent === "true",
            status: ORDER_STATUS.OPEN,
            maxHelpers: parseInt(row.maxHelpers) || 3,
            currentHelpers: 0,
            orderNumber: excelOrderNum,
          });
          createdOrders.push(order);
        } catch (rowErr) {
          console.error(`Row ${i + 1} error:`, rowErr);
          errors.push(`행 ${i + 1}: 처리 실패`);
        }
      }

      res.json({
        success: true,
        importedCount: createdOrders.length,
        totalRows: csvData.length,
        errorCount: errors.length,
        errors: errors.slice(0, 20), // 최대 20개 에러까지 표시
        skippedDuplicates: duplicateCount,
      });
    } catch (err: any) {
      console.error("CSV import error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 대행배차 API (Dispatch Requests)
  // ============================================
  app.get("/api/admin/dispatch-requests", adminAuth, requirePermission("dispatch.view"), async (req, res) => {
    try {
      const requests = await storage.getAllDispatchRequests();
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const result = requests.map(r => ({
        ...r,
        requesterName: userMap.get(r.requesterId)?.name || "Unknown",
        assignedHelperName: r.assignedHelperId ? userMap.get(r.assignedHelperId)?.name : null,
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/dispatch-requests", adminAuth, requirePermission("dispatch.edit"), async (req, res) => {
    try {
      const { requesterId, pickupAddress, deliveryAddress, urgency, notes, orderId } = req.body;
      const request = await storage.createDispatchRequest({
        requesterId,
        pickupAddress,
        deliveryAddress,
        urgency: urgency || "normal",
        notes,
        orderId,
        status: "pending",
      });
      res.status(201).json(request);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/dispatch-requests/:id/assign", adminAuth, requirePermission("dispatch.assign"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { helperId } = req.body;

      if (!helperId) {
        return res.status(400).json({ message: "기사 ID가 필요합니다" });
      }

      const request = await storage.getDispatchRequest(id);
      if (!request) {
        return res.status(404).json({ message: "배차 요청을 찾을 수 없습니다" });
      }

      const helper = await storage.getUser(helperId);
      if (!helper || helper.role !== "helper") {
        return res.status(404).json({ message: "기사를 찾을 수 없습니다" });
      }

      const updated = await storage.updateDispatchRequest(id, {
        assignedAt: new Date(),
        status: "assigned",
      });

      // 요청자 정보 조회
      const requester = request.requesterId ? await storage.getUser(request.requesterId) : null;
      const requesterPhone = requester?.phoneNumber || "연락처 미등록";
      const helperPhone = helper?.phoneNumber || "연락처 미등록";

      // 기사에게 알림 (요청자 연락처 포함)
      await storage.createNotification({
        userId: helperId,
        type: "matching_success",
        title: "대행배차 배정",
        message: `새로운 대행배차가 배정되었습니다.\n픽업: ${request.pickupAddress}\n의뢰인 연락처: ${requesterPhone}`,
      });

      // 요청자에게 알림 (헬퍼 연락처 포함)
      if (request.requesterId) {
        await storage.createNotification({
          userId: request.requesterId,
          type: "matching_success",
          title: "대행배차 헬퍼 배정 완료",
          message: `대행배차에 헬퍼가 배정되었습니다.\n헬퍼: ${helper.name || "헬퍼"}\n연락처: ${helperPhone}`,
        });
      }

      res.json({ success: true, request: updated });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reject dispatch request (admin)
  app.post("/api/admin/dispatch-requests/:id/reject", adminAuth, requirePermission("dispatch.assign"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;

      const request = await storage.getDispatchRequest(id);
      if (!request) {
        return res.status(404).json({ message: "배차 요청을 찾을 수 없습니다" });
      }

      const updated = await storage.updateDispatchRequest(id, {
        status: "rejected",
        notes: reason || "관리자에 의해 거절됨",
      });

      // 요청자에게 알림
      if (request.requesterId) {
        await storage.createNotification({
          userId: request.requesterId,
          type: "matching_failed",
          title: "대행배차 거절",
          message: `대행배차 요청이 거절되었습니다. 사유: ${reason || "배차 불가"}`,
        });
      }

      res.json({ success: true, request: updated });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Auto dispatch - assign to available helpers automatically (admin)
  app.post("/api/admin/dispatch-requests/auto-assign", adminAuth, requirePermission("dispatch.assign"), async (req, res) => {
    try {
      const pendingRequests = await storage.getAllDispatchRequests();
      const pending = pendingRequests.filter(r => r.status === "pending");

      if (pending.length === 0) {
        return res.json({ message: "대기 중인 배차 요청이 없습니다", assigned: 0 });
      }

      // 가용 헬퍼 조회
      const users = await storage.getAllUsers();
      const availableHelpers = users.filter(u =>
        u.role === "helper" &&
        u.dailyStatus === "available"
      );

      if (availableHelpers.length === 0) {
        return res.json({ message: "배정 가능한 기사가 없습니다", assigned: 0 });
      }

      let assignedCount = 0;
      const results: any[] = [];

      // 긴급 요청 우선 정렬
      const sortedRequests = pending.sort((a, b) => {
        const urgencyOrder = { emergency: 0, urgent: 1, normal: 2 };
        return (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 2) -
          (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 2);
      });

      for (let i = 0; i < sortedRequests.length && i < availableHelpers.length; i++) {
        const request = sortedRequests[i];
        const helper = availableHelpers[i];

        await storage.updateDispatchRequest(request.id, {
          assignedHelperId: helper.id,
          assignedAt: new Date(),
          status: "assigned",
        });

        // 기사에게 알림
        await storage.createNotification({
          userId: helper.id,
          type: "matching_success",
          title: "대행배차 자동 배정",
          message: `새로운 대행배차가 자동 배정되었습니다.\n픽업: ${request.pickupAddress}`,
        });

        assignedCount++;
        results.push({ requestId: request.id, helperId: helper.id, helperName: helper.name });
      }

      res.json({
        message: `${assignedCount}건 자동 배차 완료`,
        assigned: assignedCount,
        results
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 팀장 인센티브 API (Team Incentives)
  // ============================================
  app.get("/api/admin/team-incentives", adminAuth, requirePermission("incentives.view"), async (req, res) => {
    try {
      const incentives = await storage.getAllTeamIncentives();
      const teams = await storage.getAllTeams();
      const users = await storage.getAllUsers();
      const teamMap = new Map<number, any>(teams.map(t => [t.id, t]));
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const result = incentives.map(i => {
        const team = teamMap.get(i.teamId);
        const leader = team ? userMap.get(team.leaderId) : null;
        return {
          ...i,
          teamName: team?.name || "Unknown",
          leaderName: leader?.name || "Unknown",
        };
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/team-incentives/:id/details", adminAuth, requirePermission("incentives.view"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const incentive = await storage.getTeamIncentive(id);
      if (!incentive) {
        return res.status(404).json({ message: "인센티브를 찾을 수 없습니다" });
      }

      const team = await storage.getTeam(incentive.teamId);
      const members = team ? await storage.getTeamMembers(team.id) : [];
      const memberIds = members.map(m => m.helperId);
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const [year, month] = incentive.period.split("-").map(Number);
      const settlements = await storage.getAllSettlementStatements();

      const details = settlements
        .filter(s => {
          if (!memberIds.includes(s.helperId)) return false;
          if (!s.workDate) return false;
          const workDate = new Date(s.workDate);
          return workDate.getFullYear() === year && (workDate.getMonth() + 1) === month;
        })
        .map(s => {
          const helper = userMap.get(s.helperId);
          return {
            id: s.id,
            helperName: helper?.name || "Unknown",
            helperNickname: (helper as any)?.nickname || null,
            workDate: s.workDate,
            deliveryCount: s.deliveryCount || 0,
            totalAmount: s.totalAmount || 0,
            commissionAmount: s.commissionAmount || 0,
          };
        });

      res.json({ incentive, details });
    } catch (err: any) {
      console.error("Get incentive details error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/incentives/calc", adminAuth, requirePermission("incentives.calc"), async (req, res) => {
    try {
      const { period } = req.body;
      if (!period) {
        return res.status(400).json({ message: "기간(YYYY-MM)을 선택해주세요" });
      }

      const teams = await storage.getAllTeams();
      const settlements = await storage.getAllSettlementStatements();
      const settings = await storage.getAllSystemSettings();
      const policies = await storage.getAllIncentivePolicies();
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const rateSetting = settings.find(s => s.settingKey === "default_incentive_rate");
      const defaultRate = rateSetting ? parseFloat(rateSetting.settingValue) : 5;

      const [year, month] = period.split("-").map(Number);

      const createdIncentives: any[] = [];

      for (const team of teams) {
        const members = await storage.getTeamMembers(team.id);
        const memberIds = members.map(m => m.helperId);

        if (memberIds.length === 0) continue;

        const teamSettlements = settlements.filter(s => {
          if (!s.teamLeaderId || s.teamLeaderId !== team.leaderId) return false;
          if (!s.workDate) return false;
          if (s.status !== "confirmed" && s.status !== "paid") return false;

          const workDate = new Date(s.workDate);
          return workDate.getFullYear() === year && (workDate.getMonth() + 1) === month;
        });

        if (teamSettlements.length === 0) continue;

        const totalFees = teamSettlements.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const incentiveAmount = teamSettlements.reduce((sum, s) => sum + (s.teamLeaderIncentive || 0), 0);

        const teamPolicy = policies.find(p => p.teamId === team.id && p.isActive);
        const incentiveRate = teamPolicy?.defaultRate || Math.round(defaultRate);

        const leader = userMap.get(team.leaderId);

        // 팀별 인센티브 생성을 트랜잭션으로 감싸 원자성 보장
        try {
          const incentive = await db.transaction(async (tx) => {
            const [newIncentive] = await tx.insert(teamIncentives).values({
              teamId: team.id,
              period,
              totalFees,
              incentiveRate,
              incentiveAmount,
              status: "pending",
            }).returning();

            for (const s of teamSettlements) {
              await tx.insert(incentiveDetails).values({
                incentiveId: newIncentive.id,
                contractAmount: s.totalAmount || 0,
                feeRate: s.commissionRate || 0,
                feeAmount: s.commissionAmount || 0,
                completedAt: s.helperConfirmedAt,
              });
            }

            return newIncentive;
          });

          createdIncentives.push({
            ...incentive,
            teamName: team.name,
            leaderName: leader?.name || "Unknown",
            memberCount: memberIds.length,
            settlementCount: teamSettlements.length,
          });

          console.log(`[Incentive Created] Team: ${team.name}, Leader: ${leader?.name}, Rate: ${incentiveRate}%, Amount: ${incentiveAmount}원`);
        } catch (teamErr) {
          console.error(`[Incentive Error] Failed to create incentive for team ${team.name}:`, teamErr);
        }
      }

      res.json({
        success: true,
        message: `${createdIncentives.length}개 팀의 인센티브가 산출되었습니다`,
        incentives: createdIncentives
      });
    } catch (err: any) {
      console.error("Calculate incentives error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/incentive-policies", adminAuth, requirePermission("incentives.view"), async (req, res) => {
    try {
      const policies = await storage.getAllIncentivePolicies();
      const teams = await storage.getAllTeams();
      const teamMap = new Map<number, any>(teams.map(t => [t.id, t]));

      const result = policies.map(p => ({
        ...p,
        teamName: p.teamId ? teamMap.get(p.teamId)?.name : "전체 기본값",
      }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/incentive-policies", adminAuth, requirePermission("incentives.calc"), async (req, res) => {
    try {
      const { teamId, defaultRate, minThreshold, paymentCycle, autoApprove } = req.body;

      if (defaultRate < 0 || defaultRate > 100) {
        return res.status(400).json({ message: "인센티브율은 0~100% 사이여야 합니다" });
      }

      const policy = await storage.createIncentivePolicy({
        teamId: teamId || null,
        defaultRate: defaultRate || 5,
        minThreshold: minThreshold || 0,
        paymentCycle: paymentCycle || "monthly",
        autoApprove: autoApprove || false,
        isActive: true,
      });

      res.json({ success: true, policy });
    } catch (err: any) {
      console.error("Create incentive policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/incentive-policies/:id", adminAuth, requirePermission("incentives.calc"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { defaultRate, minThreshold, paymentCycle, autoApprove, isActive } = req.body;

      if (defaultRate !== undefined && (defaultRate < 0 || defaultRate > 100)) {
        return res.status(400).json({ message: "인센티브율은 0~100% 사이여야 합니다" });
      }

      const updated = await storage.updateIncentivePolicy(id, {
        ...(defaultRate !== undefined && { defaultRate }),
        ...(minThreshold !== undefined && { minThreshold }),
        ...(paymentCycle !== undefined && { paymentCycle }),
        ...(autoApprove !== undefined && { autoApprove }),
        ...(isActive !== undefined && { isActive }),
      });

      res.json({ success: true, policy: updated });
    } catch (err: any) {
      console.error("Update incentive policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/incentives/:id/approve", adminAuth, requirePermission("incentives.approve"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const incentive = await storage.getTeamIncentive(id);
      if (!incentive) {
        return res.status(404).json({ message: "인센티브를 찾을 수 없습니다" });
      }

      const updated = await storage.updateTeamIncentive(id, {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: (req as any).user?.id || "admin",
      });

      res.json({ success: true, incentive: updated });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/incentives/:id/pay", adminAuth, requirePermission("incentives.pay"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const incentive = await storage.getTeamIncentive(id);
      if (!incentive) {
        return res.status(404).json({ message: "인센티브를 찾을 수 없습니다" });
      }
      if (incentive.status !== "approved") {
        return res.status(400).json({ message: "승인된 인센티브만 지급할 수 있습니다" });
      }

      const updated = await storage.updateTeamIncentive(id, {
        status: "paid",
        paidAt: new Date(),
      });

      // 팀장에게 알림
      const team = await storage.getTeam(incentive.teamId);
      if (team) {
        await storage.createNotification({
          userId: team.leaderId,
          type: "announcement",
          title: "인센티브 지급 완료",
          message: `${incentive.period} 인센티브가 지급되었습니다.`,
        });
      }

      res.json({ success: true, incentive: updated });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 세금계산서 API (Tax Invoices)
  // ============================================
  // ============================================
  // 월별 정산 집계 API (Monthly Settlement Summary)
  // ============================================

  // 월별 정산 요약 조회 (헬퍼/요청자별)
  app.get("/api/admin/monthly-settlement-summary", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { month, userType } = req.query;

      if (!month || typeof month !== 'string') {
        return res.status(400).json({ error: "month parameter required (YYYY-MM format)" });
      }

      // 월의 시작일과 끝일 계산
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59);

      // 정산 레코드 조회 (해당 월에 생성된 것들)
      const allSettlements = await db.select().from(settlementRecords)
        .where(
          and(
            gte(settlementRecords.createdAt, startDate),
            lte(settlementRecords.createdAt, endDate),
            eq(settlementRecords.status, 'completed')
          )
        );

      // 사용자 정보 조회
      const userIds = [...new Set(allSettlements.map(s => s.helperId))];
      const allUsers = await storage.getAllUsers();
      const userMap = new Map<string, any>(allUsers.map(u => [u.id, u]));

      // 헬퍼별 집계
      const helperSummary = new Map<string, {
        userId: string;
        userName: string;
        email: string;
        totalSupply: number;
        totalVat: number;
        totalAmount: number;
        settlementCount: number;
        settlementIds: number[];
        hasMonthlyInvoice: boolean;
      }>();

      for (const settlement of allSettlements) {
        const helperId = settlement.helperId;
        const user = userMap.get(helperId);

        if (!helperSummary.has(helperId)) {
          helperSummary.set(helperId, {
            userId: helperId,
            userName: user?.name || 'Unknown',
            email: user?.email || '',
            totalSupply: 0,
            totalVat: 0,
            totalAmount: 0,
            settlementCount: 0,
            settlementIds: [] as number[],
            hasMonthlyInvoice: false,
          });
        }

        const summary = helperSummary.get(helperId)!;
        summary.totalSupply += Number(settlement.finalSupply) || 0;
        summary.totalVat += Number(settlement.vat) || 0;
        summary.totalAmount += Number(settlement.finalTotal) || 0;
        summary.settlementCount += 1;
        summary.settlementIds.push(settlement.id);
      }

      // 이미 발행된 월별 세금계산서 확인
      const existingMonthlyInvoices = await db.select().from(taxInvoices)
        .where(
          and(
            eq(taxInvoices.invoiceScope, 'monthly'),
            eq(taxInvoices.targetMonth, month)
          )
        );

      for (const invoice of existingMonthlyInvoices) {
        if (invoice.targetUserId && helperSummary.has(invoice.targetUserId)) {
          helperSummary.get(invoice.targetUserId)!.hasMonthlyInvoice = true;
        }
      }

      const summaryArray = Array.from(helperSummary.values())
        .filter(s => s.settlementCount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount);

      res.json({
        month,
        helpers: summaryArray,
        totalHelpers: summaryArray.length,
        grandTotalSupply: summaryArray.reduce((sum, s) => sum + s.totalSupply, 0),
        grandTotalVat: summaryArray.reduce((sum, s) => sum + s.totalVat, 0),
        grandTotalAmount: summaryArray.reduce((sum, s) => sum + s.totalAmount, 0),
      });
    } catch (error) {
      console.error("Monthly settlement summary error:", error);
      res.status(500).json({ error: "Failed to fetch monthly settlement summary" });
    }
  });

  // 월별 합산 세금계산서 생성
  /**
   * 월별 합산 세금계산서 생성
   *
   * userType에 따라 자동 분기:
   * - helper: 역발행 (공급자=헬퍼, 공급받는자=헬프미) → 영수
   * - requester: 정발행 (공급자=헬프미, 공급받는자=요청자) → 청구 or 영수
   */
  app.post("/api/admin/tax-invoices/monthly", adminAuth, requirePermission("tax.issue"), async (req, res) => {
    try {
      const { month, userId, userType = 'helper', purposeType } = req.body;

      if (!month || !userId) {
        return res.status(400).json({ error: "month and userId required" });
      }

      // 월의 시작일과 끝일 계산
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59);

      // 기존 월별 세금계산서 확인
      const existingInvoice = await db.select().from(taxInvoices)
        .where(
          and(
            eq(taxInvoices.invoiceScope, 'monthly'),
            eq(taxInvoices.targetMonth, month),
            eq(taxInvoices.targetUserId, userId)
          )
        )
        .limit(1);

      if (existingInvoice.length > 0) {
        return res.status(409).json({
          error: "Monthly invoice already exists",
          existingInvoice: existingInvoice[0]
        });
      }

      // 해당 월의 정산 레코드 조회
      const settlements = await db.select().from(settlementRecords)
        .where(
          and(
            eq(settlementRecords.helperId, userId),
            gte(settlementRecords.createdAt, startDate),
            lte(settlementRecords.createdAt, endDate),
            eq(settlementRecords.status, 'completed')
          )
        );

      if (settlements.length === 0) {
        return res.status(404).json({ error: "No completed settlements found for this month" });
      }

      // 금액 합산
      const totalSupply = settlements.reduce((sum, s) => sum + (Number(s.finalSupply) || 0), 0);
      const totalVat = settlements.reduce((sum, s) => sum + (Number(s.vat) || 0), 0);
      const totalAmount = settlements.reduce((sum, s) => sum + (Number(s.finalTotal) || 0), 0);
      const settlementIds = settlements.map(s => s.id);

      // 사용자 정보 조회
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // 플랫폼 사업자 정보 조회
      const sysSettings = await storage.getAllSystemSettings();
      const getSetting = (key: string) => sysSettings.find(s => s.settingKey === key)?.settingValue || "";
      const platformCorpNum = getSetting("platform_corp_num");
      const platformCorpName = getSetting("platform_corp_name") || "헬프미";
      const platformCeoName = getSetting("platform_ceo_name");
      const platformAddr = getSetting("platform_addr");
      const platformBizType = getSetting("platform_biz_type");
      const platformBizClass = getSetting("platform_biz_class");
      const platformEmail = getSetting("platform_email");

      // userType에 따라 issueType, 공급자/공급받는자 역할 자동 결정
      const isHelper = userType === 'helper';
      const issueType = isHelper ? 'reverse' : 'forward';
      // 헬퍼: 지급 후 영수 / 요청자: 결제전 청구, 결제후 영수
      const resolvedPurposeType = purposeType || (isHelper ? '영수' : '청구');

      // 사업자 정보 조회 (헬퍼인 경우)
      let helperBiz: any = null;
      let requesterBiz: any = null;
      if (isHelper) {
        const helperBusinesses = await storage.getAllHelperBusinesses();
        helperBiz = helperBusinesses.find(b => b.userId === userId);
      } else {
        const requesterBusinesses = await storage.getAllRequesterBusinesses();
        requesterBiz = requesterBusinesses.find(b => b.userId === userId);
      }

      // 세금계산서 번호 생성
      const invoiceNumber = `MTI-${month.replace('-', '')}-${userId.slice(-6).toUpperCase()}`;
      const mgtKey = `M${month.replace('-', '')}${Date.now().toString().slice(-8)}`;

      // 월별 세금계산서 생성
      const newInvoice = await storage.createTaxInvoice({
        invoiceNumber,
        invoiceScope: 'monthly',
        targetMonth: month,
        targetUserId: userId,
        targetUserType: userType,
        settlementIds: JSON.stringify(settlementIds),
        issueType,
        purposeType: resolvedPurposeType,
        supplyAmount: totalSupply,
        vatAmount: totalVat,
        totalAmount,
        writeDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        // 공급자 (헬퍼=헬퍼사업자, 요청자=헬프미)
        supplierCorpNum: isHelper ? (helperBiz?.businessNumber || "") : platformCorpNum,
        supplierCorpName: isHelper ? (helperBiz?.businessName || user.name || "") : platformCorpName,
        supplierCeoName: isHelper ? (helperBiz?.representativeName || user.name || "") : platformCeoName,
        supplierAddr: isHelper ? (helperBiz?.address || "") : platformAddr,
        supplierBizType: isHelper ? (helperBiz?.businessType || "") : platformBizType,
        supplierBizClass: isHelper ? (helperBiz?.businessCategory || "") : platformBizClass,
        supplierEmail: isHelper ? (helperBiz?.email || user.email || "") : platformEmail,
        // 공급받는자 (헬퍼=헬프미, 요청자=요청자사업자)
        buyerCorpNum: isHelper ? platformCorpNum : (requesterBiz?.businessNumber || ""),
        buyerCorpName: isHelper ? platformCorpName : (requesterBiz?.businessName || user.name || user.email),
        buyerCeoName: isHelper ? platformCeoName : (requesterBiz?.representativeName || user.name || ""),
        buyerAddr: isHelper ? platformAddr : (requesterBiz?.address || ""),
        buyerBizType: isHelper ? platformBizType : (requesterBiz?.businessType || ""),
        buyerBizClass: isHelper ? platformBizClass : (requesterBiz?.businessCategory || ""),
        buyerEmail: isHelper ? platformEmail : (requesterBiz?.email || user.email || ""),
        popbillMgtKey: mgtKey,
        status: 'draft',
        createdBy: (req as AuthenticatedRequest).user.id,
        detailList: JSON.stringify([{
          sn: 1,
          itemName: `${month} 월간 정산`,
          qty: settlements.length,
          unitCost: Math.round(totalSupply / settlements.length),
          supplyCost: totalSupply,
          tax: totalVat,
        }]),
      });

      res.status(201).json({
        success: true,
        invoice: newInvoice,
        summary: {
          settlementCount: settlements.length,
          totalSupply,
          totalVat,
          totalAmount,
          issueType,
          purposeType: resolvedPurposeType,
        }
      });
    } catch (error) {
      console.error("Create monthly tax invoice error:", error);
      res.status(500).json({ error: "Failed to create monthly tax invoice" });
    }
  });

  app.get("/api/admin/tax-invoices", adminAuth, requirePermission("tax.view"), async (req, res) => {
    try {
      const invoices = await storage.getAllTaxInvoices();
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const result = invoices.map(inv => {
        return {
          ...inv,
          helperName: inv.recipientName || "Unknown",
        };
      });

      res.json(result);
    } catch (err: any) {
      console.error("Get tax invoices error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/tax-invoices/pending-queue", adminAuth, requirePermission("tax.view"), async (req, res) => {
    try {
      const settlements = await storage.getAllSettlementStatements();
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const confirmedSettlements = settlements.filter(s => s.status === "confirmed" || s.status === "paid");

      const pendingQueue = confirmedSettlements.map(s => {
        const helper = userMap.get(s.helperId);
        const supplyAmount = s.supplyAmount || Math.round((s.totalAmount || 0) / 1.1);
        const vatAmount = s.vatAmount || calculateVat(supplyAmount);

        return {
          id: s.id,
          settlementId: s.id,
          helperName: helper?.name || "Unknown",
          helperNickname: (helper as any)?.nickname || null,
          businessNumber: helper?.address || "",
          supplyAmount,
          vatAmount,
          totalAmount: s.totalAmount || 0,
          commissionAmount: s.commissionAmount || 0,
          workDate: s.workDate,
          status: s.status === "paid" ? "issued" : "pending",
          confirmedAt: s.helperConfirmedAt,
        };
      });

      res.json(pendingQueue);
    } catch (err: any) {
      console.error("Get pending queue error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/vat-settings", adminAuth, requirePermission("tax.view"), async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const vatRateSetting = settings.find(s => s.settingKey === "vat_rate");
      const taxTypeSetting = settings.find(s => s.settingKey === "default_tax_type");
      const autoIssueSetting = settings.find(s => s.settingKey === "auto_issue_tax_invoice");
      const issueDelaySetting = settings.find(s => s.settingKey === "tax_invoice_issue_delay_days");

      res.json({
        defaultTaxType: taxTypeSetting?.settingValue || "exclusive",
        vatRate: vatRateSetting ? parseInt(vatRateSetting.settingValue) : 10,
        autoIssue: autoIssueSetting?.settingValue === "true",
        issueDelayDays: issueDelaySetting ? parseInt(issueDelaySetting.settingValue) : 3,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/tax-invoices/generate-monthly", adminAuth, requirePermission("tax.issue"), async (req, res) => {
    try {
      const { period, helperId } = req.body;
      if (!period) {
        return res.status(400).json({ message: "기간(YYYY-MM)을 입력해주세요" });
      }

      const [year, month] = period.split("-").map(Number);
      const settlements = await storage.getAllSettlementStatements();
      const users = await storage.getAllUsers();
      const helperBusinesses = await storage.getAllHelperBusinesses();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const businessMap = new Map<string, any>(helperBusinesses.map(b => [b.userId, b]));

      const helperSettlements: { [key: string]: typeof settlements } = {};

      for (const s of settlements) {
        if (s.status !== "confirmed" && s.status !== "paid") continue;
        if (!s.workDate) continue;

        const workDate = new Date(s.workDate);
        if (workDate.getFullYear() !== year || (workDate.getMonth() + 1) !== month) continue;
        if (helperId && s.helperId !== helperId) continue;

        if (!helperSettlements[s.helperId]) {
          helperSettlements[s.helperId] = [];
        }
        helperSettlements[s.helperId].push(s);
      }

      const createdInvoices: any[] = [];
      const settings = await storage.getAllSystemSettings();
      const commissionRateSetting = settings.find(s => s.settingKey === "platform_commission_rate");
      const commissionRate = commissionRateSetting ? parseFloat(commissionRateSetting.settingValue) : 5;

      for (const [hId, hSettlements] of Object.entries(helperSettlements)) {
        const helper = userMap.get(hId);
        const business = businessMap.get(hId);

        if (!helper) continue;

        let totalAmount = 0;
        let totalDeliveryCount = 0;
        let totalReturnCount = 0;

        for (const s of hSettlements) {
          totalAmount += s.totalAmount || 0;
          totalDeliveryCount += s.deliveryCount || 0;
          totalReturnCount += s.returnCount || 0;
        }

        const commissionAmount = Math.round(totalAmount * commissionRate / 100);
        const supplyAfterCommission = totalAmount - commissionAmount;
        const supplyAmount = Math.round(supplyAfterCommission / 1.1);
        const vatAmount = supplyAfterCommission - supplyAmount;

        const invoiceNumber = `INV-${period.replace("-", "")}-${hId.substring(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

        // 헬퍼 세금계산서: 역발행 (헬퍼=공급자, 헬프미=공급받는자)
        // 헬퍼가 배송 서비스를 제공하므로 공급자, 플랫폼이 서비스를 구매하므로 공급받는자
        const platformSettings = await storage.getAllSystemSettings();
        const platformCorpNum = platformSettings.find(s => s.settingKey === "platform_corp_num")?.settingValue || "";
        const platformCorpName = platformSettings.find(s => s.settingKey === "platform_corp_name")?.settingValue || "헬프미";
        const platformCeoName = platformSettings.find(s => s.settingKey === "platform_ceo_name")?.settingValue || "";
        const platformAddr = platformSettings.find(s => s.settingKey === "platform_addr")?.settingValue || "";
        const platformBizType = platformSettings.find(s => s.settingKey === "platform_biz_type")?.settingValue || "";
        const platformBizClass = platformSettings.find(s => s.settingKey === "platform_biz_class")?.settingValue || "";
        const platformEmail = platformSettings.find(s => s.settingKey === "platform_email")?.settingValue || "";

        const invoice = await storage.createTaxInvoice({
          invoiceNumber,
          issueType: "reverse",  // 헬퍼 → 역발행
          purposeType: "영수",   // 헬퍼 지급 완료 후 영수
          targetUserType: "helper",
          targetUserId: hId,
          // 공급자 = 헬퍼 (서비스 제공자)
          supplierCorpNum: business?.businessNumber || "",
          supplierCorpName: business?.businessName || helper.name || "Unknown",
          supplierCeoName: business?.representativeName || helper.name || "",
          supplierAddr: business?.address || "",
          supplierBizType: business?.businessType || "",
          supplierBizClass: business?.businessCategory || "",
          supplierEmail: business?.email || helper.email || "",
          // 공급받는자 = 헬프미 (서비스 구매자)
          buyerCorpNum: platformCorpNum,
          buyerCorpName: platformCorpName,
          buyerCeoName: platformCeoName,
          buyerAddr: platformAddr,
          buyerBizType: platformBizType,
          buyerBizClass: platformBizClass,
          buyerEmail: platformEmail,
          supplyAmount,
          vatAmount,
          totalAmount: supplyAfterCommission,
          issueDate: period,
          status: "pending",
        });

        createdInvoices.push({
          ...invoice,
          helperName: helper.name,
          deliveryCount: totalDeliveryCount,
          returnCount: totalReturnCount,
          commissionAmount,
          originalTotal: totalAmount,
        });
      }

      res.json({
        success: true,
        message: `${createdInvoices.length}건의 세금계산서가 생성되었습니다`,
        invoices: createdInvoices,
      });
    } catch (err: any) {
      console.error("Generate monthly tax invoices error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/tax-invoices/:id/issue", adminAuth, requirePermission("tax.issue"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const invoice = await storage.getTaxInvoice(id);

      if (!invoice) {
        return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
      }

      const updated = await storage.updateTaxInvoice(id, {
        status: "issued",
        issueDate: new Date().toISOString().split("T")[0],
      });

      res.json({
        success: true,
        invoice: updated,
        message: "세금계산서가 발행되었습니다",
      });
    } catch (err: any) {
      console.error("Issue tax invoice error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/tax-invoices/:id/reverse", adminAuth, requirePermission("tax.reverse"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const invoice = await storage.getTaxInvoice(id);

      if (!invoice) {
        return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
      }

      const updated = await storage.updateTaxInvoice(id, {
        issueType: "reverse",
        status: "pending",
      });

      res.json({
        success: true,
        invoice: updated,
        message: "역발행 요청이 처리되었습니다",
      });
    } catch (err: any) {
      console.error("Reverse tax invoice error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/tax-invoices/:id/cancel", adminAuth, requirePermission("tax.cancel"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;

      const invoice = await storage.getTaxInvoice(id);
      if (!invoice) {
        return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
      }

      const updated = await storage.updateTaxInvoice(id, {
        status: "cancelled",
        cancelReason: reason,
        cancelledAt: new Date(),
        cancelledBy: (req as any).user?.id || "admin",
      });

      res.json({
        success: true,
        invoice: updated,
        message: "세금계산서가 취소되었습니다",
      });
    } catch (err: any) {
      console.error("Cancel tax invoice error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/tax-invoices/:id", adminAuth, requirePermission("tax.view"), async (req, res) => {

    // ============================================
    // 팝빌 세금계산서 API 연동
    // ============================================

    // 팝빌 연동 상태 확인
    app.get("/api/admin/popbill/status", adminAuth, requirePermission("tax.view"), async (req, res) => {
      try {
        res.json({
          configured: popbill.isConfigured(),
          message: popbill.isConfigured()
            ? "팝빌 API가 설정되었습니다"
            : "팝빌 API 키가 설정되지 않았습니다. POPBILL_LINK_ID와 POPBILL_SECRET_KEY를 설정하세요.",
        });
      } catch (err: any) {
        console.error("Check popbill status error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // 팝빌 정발행 (요청자용: 공급자=헬프미 → 공급받는자=요청자, 청구 또는 영수)
    app.post("/api/admin/tax-invoices/:id/popbill-issue", adminAuth, requirePermission("tax.issue"), async (req, res) => {
      try {
        if (!popbill.isConfigured()) {
          return res.status(400).json({ message: "팝빌 API가 설정되지 않았습니다" });
        }

        const id = Number(req.params.id);
        const { purposeType: overridePurpose } = req.body; // 선택적 override
        const invoice = await storage.getTaxInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
        }

        // 역발행 세금계산서는 popbill-reverse를 사용해야 함
        if (invoice.issueType === "reverse") {
          return res.status(400).json({
            message: "역발행 세금계산서는 popbill-reverse 엔드포인트를 사용하세요"
          });
        }

        const mgtKey = popbill.generateMgtKey();
        const writeDate = new Date().toISOString().split("T")[0].replace(/-/g, "");

        // purposeType: body에서 override 가능, 없으면 DB 저장값, 기본값 '영수'
        const resolvedPurpose = overridePurpose || invoice.purposeType || '영수';

        const taxInvoiceData = popbill.buildTaxInvoice({
          type: "forward",
          purposeType: resolvedPurpose as '영수' | '청구',
          writeDate,
          supplierCorpNum: invoice.supplierCorpNum || "",
          supplierCorpName: invoice.supplierCorpName || "",
          supplierCeoName: invoice.supplierCeoName || "",
          supplierAddr: invoice.supplierAddr || undefined,
          supplierBizType: invoice.supplierBizType || undefined,
          supplierBizClass: invoice.supplierBizClass || undefined,
          supplierEmail: invoice.supplierEmail || undefined,
          buyerCorpNum: invoice.buyerCorpNum || "",
          buyerCorpName: invoice.buyerCorpName || "",
          buyerCeoName: invoice.buyerCeoName || "",
          buyerAddr: invoice.buyerAddr || undefined,
          buyerBizType: invoice.buyerBizType || undefined,
          buyerBizClass: invoice.buyerBizClass || undefined,
          buyerEmail: invoice.buyerEmail || undefined,
          supplyAmount: invoice.supplyAmount || 0,
          vatAmount: invoice.vatAmount || 0,
          remark1: invoice.remark1 || undefined,
        });

        const result = await popbill.registIssue(
          invoice.supplierCorpNum || "",
          mgtKey,
          taxInvoiceData
        );

        const updated = await storage.updateTaxInvoice(id, {
          status: "issued",
          issueDate: writeDate,
          purposeType: resolvedPurpose,
          popbillMgtKey: mgtKey,
          popbillNtsconfirmNum: result.ntsConfirmNum,
          popbillStatus: "issued",
        });

        res.json({
          success: true,
          invoice: updated,
          popbillResult: result,
          message: `세금계산서가 팝빌을 통해 정발행(${resolvedPurpose})되었습니다`,
        });
      } catch (err: any) {
        console.error("Popbill issue tax invoice error:", err);
        res.status(500).json({ message: err.message || "팝빌 발행 오류" });
      }
    });

    // 팝빌 역발행 요청 (헬퍼용: 공급자=헬퍼, 공급받는자=헬프미가 대신 역발행 요청)
    // 역발행 세금계산서: 헬퍼(공급자)가 배송 서비스를 제공 → 헬프미(공급받는자)가 발행을 대신 요청
    // registRequest()는 공급받는자(헬프미) corpNum으로 호출
    app.post("/api/admin/tax-invoices/:id/popbill-reverse", adminAuth, requirePermission("tax.reverse"), async (req, res) => {
      try {
        if (!popbill.isConfigured()) {
          return res.status(400).json({ message: "팝빌 API가 설정되지 않았습니다" });
        }

        const id = Number(req.params.id);
        const { memo } = req.body;
        const invoice = await storage.getTaxInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
        }

        // 정발행 세금계산서는 popbill-issue를 사용해야 함
        if (invoice.issueType === "forward") {
          return res.status(400).json({
            message: "정발행 세금계산서는 popbill-issue 엔드포인트를 사용하세요"
          });
        }

        const mgtKey = popbill.generateMgtKey();
        const writeDate = new Date().toISOString().split("T")[0].replace(/-/g, "");

        const taxInvoiceData = popbill.buildTaxInvoice({
          type: "reverse",
          purposeType: (invoice.purposeType as '영수' | '청구') || '영수',
          writeDate,
          // 공급자 = 헬퍼 (서비스 제공자)
          supplierCorpNum: invoice.supplierCorpNum || "",
          supplierCorpName: invoice.supplierCorpName || "",
          supplierCeoName: invoice.supplierCeoName || "",
          supplierAddr: invoice.supplierAddr || undefined,
          supplierBizType: invoice.supplierBizType || undefined,
          supplierBizClass: invoice.supplierBizClass || undefined,
          supplierEmail: invoice.supplierEmail || undefined,
          // 공급받는자 = 헬프미 (서비스 구매자, 역발행 요청자)
          buyerCorpNum: invoice.buyerCorpNum || "",
          buyerCorpName: invoice.buyerCorpName || "",
          buyerCeoName: invoice.buyerCeoName || "",
          buyerAddr: invoice.buyerAddr || undefined,
          buyerBizType: invoice.buyerBizType || undefined,
          buyerBizClass: invoice.buyerBizClass || undefined,
          buyerEmail: invoice.buyerEmail || undefined,
          supplyAmount: invoice.supplyAmount || 0,
          vatAmount: invoice.vatAmount || 0,
          remark1: invoice.remark1 || undefined,
        });

        // registRequest: 공급받는자(헬프미) corpNum으로 호출
        const result = await popbill.registRequest(
          invoice.buyerCorpNum || "",
          mgtKey,
          taxInvoiceData,
          memo
        );

        const updated = await storage.updateTaxInvoice(id, {
          issueType: "reverse",
          status: "pending",
          popbillMgtKey: mgtKey,
          popbillStatus: "requested",
        });

        res.json({
          success: true,
          invoice: updated,
          popbillResult: result,
          message: "역발행 요청이 팝빌을 통해 전송되었습니다 (헬퍼에게 승인 요청)",
        });
      } catch (err: any) {
        console.error("Popbill reverse tax invoice error:", err);
        res.status(500).json({ message: err.message || "팝빌 역발행 오류" });
      }
    });

    // 팝빌 세금계산서 상태 조회
    app.get("/api/admin/tax-invoices/:id/popbill-status", adminAuth, requirePermission("tax.view"), async (req, res) => {
      try {
        if (!popbill.isConfigured()) {
          return res.status(400).json({ message: "팝빌 API가 설정되지 않았습니다" });
        }

        const id = Number(req.params.id);
        const invoice = await storage.getTaxInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
        }

        if (!invoice.popbillMgtKey) {
          return res.status(400).json({ message: "팝빌 연동 정보가 없습니다" });
        }

        const mgtKeyType = invoice.issueType === "forward" ? "SELL" : "BUY";
        const result = await popbill.getInfo(
          invoice.supplierCorpNum || invoice.buyerCorpNum || "",
          mgtKeyType,
          invoice.popbillMgtKey
        );

        await storage.updateTaxInvoice(id, {
          popbillStatus: result.stateCode,
          ntsResult: result.ntsConfirmNum ? "accepted" : "pending",
        });

        res.json({
          success: true,
          status: result,
        });
      } catch (err: any) {
        console.error("Get popbill status error:", err);
        res.status(500).json({ message: err.message || "상태 조회 오류" });
      }
    });

    // 팝빌 PDF 조회
    app.get("/api/admin/tax-invoices/:id/popbill-pdf", adminAuth, requirePermission("tax.view"), async (req, res) => {
      try {
        if (!popbill.isConfigured()) {
          return res.status(400).json({ message: "팝빌 API가 설정되지 않았습니다" });
        }

        const id = Number(req.params.id);
        const invoice = await storage.getTaxInvoice(id);

        if (!invoice || !invoice.popbillMgtKey) {
          return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
        }

        const mgtKeyType = invoice.issueType === "forward" ? "SELL" : "BUY";
        const result = await popbill.getPDF(
          invoice.supplierCorpNum || invoice.buyerCorpNum || "",
          mgtKeyType,
          invoice.popbillMgtKey
        );

        res.json({
          success: true,
          pdfUrl: result.url,
        });
      } catch (err: any) {
        console.error("Get popbill PDF error:", err);
        res.status(500).json({ message: err.message || "PDF 조회 오류" });
      }
    });

    /**
     * 개별 정산에서 세금계산서 생성
     *
     * targetType에 따라 자동 분기:
     * - helper (기본): 역발행 (공급자=헬퍼, 공급받는자=헬프미) → 영수
     * - requester: 정발행 (공급자=헬프미, 공급받는자=요청자) → 청구 or 영수
     */
    app.post("/api/admin/settlements/:settlementId/create-tax-invoice", adminAuth, requirePermission("tax.issue"), async (req, res) => {
      try {
        const settlementId = Number(req.params.settlementId);
        const { targetType = "helper", purposeType } = req.body;

        // 정산 정보 조회
        const settlements = await storage.getAllSettlementRecords();
        const settlement = settlements.find(s => s.id === settlementId);

        if (!settlement) {
          return res.status(404).json({ message: "정산 정보를 찾을 수 없습니다" });
        }

        const isHelper = targetType === "helper";
        const issueType = isHelper ? "reverse" : "forward";
        const resolvedPurposeType = purposeType || (isHelper ? "영수" : "청구");

        // 플랫폼 사업자 정보
        const sysSettings = await storage.getAllSystemSettings();
        const getSetting = (key: string) => sysSettings.find(s => s.settingKey === key)?.settingValue || "";
        const platformCorpNum = getSetting("platform_corp_num");
        const platformCorpName = getSetting("platform_corp_name") || "헬프미";
        const platformCeoName = getSetting("platform_ceo_name");
        const platformAddr = getSetting("platform_addr");
        const platformBizType = getSetting("platform_biz_type");
        const platformBizClass = getSetting("platform_biz_class");
        const platformEmail = getSetting("platform_email");

        // 대상 사용자 사업자 정보 조회
        let targetBiz: any = null;
        const targetUserId = isHelper ? settlement.helperId : (settlement as any).requesterId;
        const targetUser = await storage.getUser(targetUserId);

        if (isHelper) {
          const helperBusinesses = await storage.getAllHelperBusinesses();
          targetBiz = helperBusinesses.find(b => b.userId === targetUserId);
        } else {
          const requesterBusinesses = await storage.getAllRequesterBusinesses();
          targetBiz = requesterBusinesses.find(b => b.userId === targetUserId);
        }

        // 세금계산서 생성
        const taxInvoice = await storage.createTaxInvoice({
          orderId: settlement.orderId,
          settlementId: settlement.id,
          issueType,
          purposeType: resolvedPurposeType,
          targetUserId: targetUserId,
          targetUserType: targetType,
          // 공급자 (헬퍼=헬퍼사업자, 요청자=헬프미)
          supplierCorpNum: isHelper ? (targetBiz?.businessNumber || "") : platformCorpNum,
          supplierCorpName: isHelper ? (targetBiz?.businessName || targetUser?.name || "") : platformCorpName,
          supplierCeoName: isHelper ? (targetBiz?.representativeName || targetUser?.name || "") : platformCeoName,
          supplierAddr: isHelper ? (targetBiz?.address || "") : platformAddr,
          supplierBizType: isHelper ? (targetBiz?.businessType || "") : platformBizType,
          supplierBizClass: isHelper ? (targetBiz?.businessCategory || "") : platformBizClass,
          supplierEmail: isHelper ? (targetBiz?.email || targetUser?.email || "") : platformEmail,
          // 공급받는자 (헬퍼=헬프미, 요청자=요청자사업자)
          buyerCorpNum: isHelper ? platformCorpNum : (targetBiz?.businessNumber || ""),
          buyerCorpName: isHelper ? platformCorpName : (targetBiz?.businessName || targetUser?.name || ""),
          buyerCeoName: isHelper ? platformCeoName : (targetBiz?.representativeName || targetUser?.name || ""),
          buyerAddr: isHelper ? platformAddr : (targetBiz?.address || ""),
          buyerBizType: isHelper ? platformBizType : (targetBiz?.businessType || ""),
          buyerBizClass: isHelper ? platformBizClass : (targetBiz?.businessCategory || ""),
          buyerEmail: isHelper ? platformEmail : (targetBiz?.email || targetUser?.email || ""),
          supplyAmount: Math.round(Number(settlement.supplyPrice || 0)),
          vatAmount: Math.round(Number(settlement.vat || 0)),
          totalAmount: Math.round(Number(settlement.finalTotal || 0)),
          status: "draft",
          writeDate: new Date().toISOString().split("T")[0].replace(/-/g, ""),
          createdBy: (req as any).user?.id,
        });

        res.json({
          success: true,
          taxInvoice,
          message: `세금계산서가 생성되었습니다 (${isHelper ? '역발행' : '정발행'}, ${resolvedPurposeType})`,
        });
      } catch (err: any) {
        console.error("Create tax invoice from settlement error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    try {
      const id = Number(req.params.id);
      const invoice = await storage.getTaxInvoice(id);

      if (!invoice) {
        return res.status(404).json({ message: "세금계산서를 찾을 수 없습니다" });
      }

      res.json(invoice);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 단가 변환 API (Price Conversion)
  // ============================================
  app.get("/api/admin/minimum-fares", adminAuth, requirePermission("carriers.view"), async (req, res) => {
    try {
      // courierSettings에서 최저운임 정보 조회
      const settings = await storage.getAllCourierSettings();
      const fares = settings.map(s => ({
        id: s.id,
        carrierId: s.id,
        carrierName: s.courierName,
        workType: "일반배송",
        baseWeight: "5kg이하",
        minimumAmount: s.minDeliveryFee || 3000,
        updatedAt: s.updatedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
      }));
      res.json(fares);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/price-conversion-rules", adminAuth, requirePermission("carriers.view"), async (req, res) => {
    try {
      const rules = await storage.getAllPriceConversionRules();
      res.json(rules);
    } catch (err: any) {
      console.error("price conversion rules fetch error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/price-conversion-rules", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const { name, courierId, workType, timeSlot, conversionType, unit, priority, isActive } = req.body;

      if (!name) {
        return res.status(400).json({ message: "규칙명을 입력해주세요" });
      }

      if (unit !== undefined && (unit <= 0 || unit % 10 !== 0)) {
        return res.status(400).json({ message: "단위는 10 이상의 10의 배수여야 합니다" });
      }

      const rule = await storage.createPriceConversionRule({
        name,
        courierId: courierId || null,
        workType: workType || null,
        timeSlot: timeSlot || null,
        conversionType: conversionType || "ceiling",
        unit: unit || 100,
        priority: priority || 0,
        isActive: isActive !== false,
      });

      res.status(201).json(rule);
    } catch (err: any) {
      console.error("create price conversion rule error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/price-conversion-rules/:id", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const ruleId = parseInt(req.params.id);
      if (isNaN(ruleId)) {
        return res.status(400).json({ message: "유효하지 않은 ID입니다" });
      }

      const existing = await storage.getPriceConversionRule(ruleId);
      if (!existing) {
        return res.status(404).json({ message: "규칙을 찾을 수 없습니다" });
      }

      const { name, courierId, workType, timeSlot, conversionType, unit, priority, isActive } = req.body;

      if (unit !== undefined && (unit <= 0 || unit % 10 !== 0)) {
        return res.status(400).json({ message: "단위는 10 이상의 10의 배수여야 합니다" });
      }

      const updated = await storage.updatePriceConversionRule(ruleId, {
        ...(name !== undefined && { name }),
        ...(courierId !== undefined && { courierId }),
        ...(workType !== undefined && { workType }),
        ...(timeSlot !== undefined && { timeSlot }),
        ...(conversionType !== undefined && { conversionType }),
        ...(unit !== undefined && { unit }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
      });

      res.json(updated);
    } catch (err: any) {
      console.error("update price conversion rule error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/price-conversion-rules/:id", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const ruleId = parseInt(req.params.id);
      if (isNaN(ruleId)) {
        return res.status(400).json({ message: "유효하지 않은 ID입니다" });
      }

      const existing = await storage.getPriceConversionRule(ruleId);
      if (!existing) {
        return res.status(404).json({ message: "규칙을 찾을 수 없습니다" });
      }

      await storage.deletePriceConversionRule(ruleId);
      res.json({ success: true, message: "규칙이 삭제되었습니다" });
    } catch (err: any) {
      console.error("delete price conversion rule error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/pricing/convert", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const { amount, courierId } = req.body;
      // 100원 단위 올림 변환
      const unit = 100;
      const converted = Math.ceil(amount / unit) * unit;
      res.json({
        original: amount,
        converted,
        unit,
        appliedRule: "100원 단위 올림",
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 최저운임 100원 단위 validation
  app.patch("/api/admin/minimum-fares/:id", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const courierId = parseInt(req.params.id);
      const { minimumAmount } = req.body;

      if (isNaN(courierId)) {
        return res.status(400).json({ message: "유효하지 않은 ID입니다" });
      }

      // 100원 단위 검증
      if (minimumAmount % 100 !== 0) {
        return res.status(400).json({
          message: "최저운임은 100원 단위로 입력해야 합니다",
          suggestedAmount: Math.ceil(minimumAmount / 100) * 100,
        });
      }

      // courierSettings 업데이트
      const updated = await storage.updateCourierSetting(courierId, {
        minDeliveryFee: minimumAmount
      });

      if (!updated) {
        return res.status(404).json({ message: "택배사 설정을 찾을 수 없습니다" });
      }

      res.json({ success: true, message: "최저운임이 업데이트되었습니다", updated });
    } catch (err: any) {
      console.error("minimum fare update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 택배사별 박스 수량 차등 가격 API
  // ============================================
  app.get("/api/admin/courier-tiered-pricing", adminAuth, requirePermission("carriers.view"), async (req, res) => {
    try {
      const tieredPricing = await storage.getAllCourierTieredPricing();
      res.json(tieredPricing);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/courier-tiered-pricing/:courierId", adminAuth, requirePermission("carriers.view"), async (req, res) => {
    try {
      const courierId = parseInt(req.params.courierId);
      const tieredPricing = await storage.getCourierTieredPricingByCourier(courierId);
      res.json(tieredPricing);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/courier-tiered-pricing", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const { courierId, minBoxCount, maxBoxCount, minTotalVatInclusive, description } = req.body;

      if (!minBoxCount || minBoxCount < 1) {
        return res.status(400).json({ message: "최소 박스 수량은 1개 이상이어야 합니다" });
      }
      if (!minTotalVatInclusive || minTotalVatInclusive < 1000) {
        return res.status(400).json({ message: "최소 요청 합계금액은 1,000원 이상이어야 합니다" });
      }

      // VAT 포함 금액에서 VAT 제외 금액 계산 (10% VAT)
      const netTotal = Math.round(minTotalVatInclusive / 1.1);
      // 박스당 단가 계산 (100원 단위로 올림)
      const calculatedPricePerBox = Math.ceil(netTotal / minBoxCount / 100) * 100;
      // 미달 시 인상액 계산 (기본 100원, 최소 합계 유지를 위해 필요한 인상액)
      const calculatedIncrement = 100;

      const newTier = await storage.createCourierTieredPricing({
        courierId,
        minBoxCount,
        maxBoxCount: maxBoxCount || null,
        minTotalVatInclusive,
        pricePerBox: calculatedPricePerBox,
        belowMinIncrementPerBox: calculatedIncrement,
        description: description || null,
        isActive: true,
      });
      res.json(newTier);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/courier-tiered-pricing/:id", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { minBoxCount, maxBoxCount, minTotalVatInclusive, description, isActive } = req.body;

      let calculatedPricePerBox: number | undefined;
      let calculatedIncrement: number | undefined;

      // minTotalVatInclusive가 제공되면 자동 계산
      if (minTotalVatInclusive && minBoxCount) {
        const netTotal = Math.round(minTotalVatInclusive / 1.1);
        calculatedPricePerBox = Math.ceil(netTotal / minBoxCount / 100) * 100;
        calculatedIncrement = 100;
      }

      const updated = await storage.updateCourierTieredPricing(id, {
        minBoxCount,
        maxBoxCount,
        minTotalVatInclusive,
        pricePerBox: calculatedPricePerBox,
        belowMinIncrementPerBox: calculatedIncrement,
        description,
        isActive,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/courier-tiered-pricing/:id", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCourierTieredPricing(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 팀 QR 관리 API (Team QR Management)
  // ============================================
  const createTeamQrSchema = z.object({
    teamId: z.number({ coerce: true }),
    expiryDays: z.number({ coerce: true }).optional(),
  });

  const updateTeamCommissionSchema = z.object({
    commissionRate: z.number({ coerce: true }).min(0).max(100),
    notes: z.string().optional(),
  });

  const assignTeamLeaderSchema = z.object({
    teamName: z.string().optional(),
    commissionRate: z.number({ coerce: true }).min(0).max(100).optional(),
  });

  app.get("/api/admin/team-qr", adminAuth, requirePermission("teams.qr"), async (req, res) => {
    try {
      const qrCodes = await storage.getAllTeamQrCodes();
      const teams = await storage.getAllTeams();
      const teamMap = new Map<number, any>(teams.map(t => [t.id, t]));

      const result = qrCodes.map(qr => ({
        ...qr,
        teamName: teamMap.get(qr.teamId)?.name || '알 수 없음',
      }));
      res.json(result);
    } catch (err: any) {
      console.error("team-qr list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/team-qr/scan-logs", adminAuth, requirePermission("teams.qr"), async (req, res) => {
    try {
      const logs = await storage.getAllQrScanLogs();
      res.json(logs);
    } catch (err: any) {
      console.error("scan-logs error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/team-qr", adminAuth, requirePermission("teams.qr"), async (req, res) => {
    try {
      const parsed = createTeamQrSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "유효하지 않은 요청입니다", errors: parsed.error.errors });
      }

      const { teamId, expiryDays } = parsed.data;

      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }

      const code = `TEAM-${teamId}-${Date.now().toString(36).toUpperCase()}`;
      const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

      const created = await storage.createTeamQrCode({
        teamId,
        code,
        qrType: "TEAM_JOIN_QR",
        expiresAt,
        status: "active",
      });

      res.json({ success: true, qrCode: created });
    } catch (err: any) {
      console.error("team-qr create error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/team-qr/:id", adminAuth, requirePermission("teams.qr"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.revokeTeamQrCode(id);
      res.json({ success: true, message: "QR 코드가 폐기되었습니다" });
    } catch (err: any) {
      console.error("team-qr revoke error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 팀장 지정 API (Assign Team Leader)
  // 관리자가 헬퍼를 팀장으로 지정하면 팀 생성 및 QR 변경
  // ============================================
  app.post("/api/admin/helpers/:helperId/assign-team-leader", adminAuth, requirePermission("teams.edit"), async (req, res) => {
    try {
      const { helperId } = req.params;
      const parsed = assignTeamLeaderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "유효하지 않은 요청입니다", errors: parsed.error.errors });
      }

      const { teamName, commissionRate } = parsed.data;

      const helper = await storage.getUser(helperId);
      if (!helper || helper.role !== "helper") {
        return res.status(404).json({ message: "헬퍼를 찾을 수 없습니다" });
      }

      const existingTeam = await storage.getTeamByLeader(helperId);
      if (existingTeam) {
        return res.status(400).json({ message: "이미 팀장으로 등록되어 있습니다" });
      }

      const teamQrToken = helper.checkInToken || `team-${Date.now().toString(36)}`;
      const finalTeamName = teamName || `${helper.name || helper.username}팀`;
      const rate = commissionRate !== undefined ? commissionRate : 5;

      const { team } = await storage.assignTeamLeaderTransactional({
        teamName: finalTeamName,
        teamQrToken,
        commissionRate: rate,
      });

      res.json({
        success: true,
        team,
        message: `${helper.name || helper.username}님이 팀장으로 지정되었습니다`
      });
    } catch (err: any) {
      console.error("assign team leader error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/teams/:teamId/commission", adminAuth, requirePermission("teams.edit"), async (req, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const parsed = updateTeamCommissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "유효하지 않은 요청입니다", errors: parsed.error.errors });
      }

      const { commissionRate, notes } = parsed.data;

      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }

      const existing = await storage.getTeamCommissionOverride(teamId);

      if (existing) {
        const updated = await storage.updateTeamCommissionOverride(existing.id, {
          commissionRate,
          notes: notes || existing.notes,
        });
        res.json(updated);
      } else {
        const created = await storage.createTeamCommissionOverride({
          teamId,
          commissionRate,
          notes: notes || "관리자 설정",
        });
        res.json(created);
      }
    } catch (err: any) {
      console.error("team commission update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 헬퍼 온보딩 승인 API (Helper Onboarding Approval)
  // ============================================
  app.get("/api/admin/helpers/onboarding", adminAuth, requirePermission("helpers.verify"), async (req, res) => {
    try {
      const { status } = req.query;
      const credentials = await storage.getHelperCredentialsByStatus(status as string || "pending");
      res.json(credentials);
    } catch (err: any) {
      console.error("onboarding list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/helpers/:id/onboarding/approve", adminAuth, requirePermission("helpers.verify"), async (req, res) => {
    try {
      const credentialId = parseInt(req.params.id);
      const reviewerId = (req as any).user?.id;

      // Get the credential to find the userId
      const credential = await storage.getHelperCredentialById(credentialId);
      if (!credential) {
        return res.status(404).json({ message: "자격 증명을 찾을 수 없습니다" });
      }

      const oldStatus = credential.verificationStatus;
      await storage.updateHelperCredentialStatus(credentialId, "approved", reviewerId);

      // 감사 로그 기록
      await storage.createAuditLog({
        userId: reviewerId,
        action: "helper.onboarding.approve",
        targetType: "helper_credential",
        targetId: String(credentialId),
        oldValue: JSON.stringify({ verificationStatus: oldStatus, userId: credential.userId }),
        newValue: JSON.stringify({ verificationStatus: "approved", userId: credential.userId }),
        ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
        userAgent: req.headers["user-agent"] || null,
      });

      // Send push notification to the helper
      await storage.createNotification({
        userId: credential.userId,
        type: "onboarding_approved",
        title: "가입 승인 완료",
        message: "축하합니다! 헬퍼 가입이 승인되었습니다. 이제 오더를 확인하고 업무를 시작할 수 있습니다.",
        relatedId: credentialId,
      });

      res.json({ success: true, message: "승인되었습니다" });
    } catch (err: any) {
      console.error("approve error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/helpers/:id/onboarding/reject", adminAuth, requirePermission("helpers.verify"), async (req, res) => {
    try {
      const credentialId = parseInt(req.params.id);
      const { reason } = req.body;
      const reviewerId = (req as any).user?.id;

      // Get the credential to find the userId
      const credential = await storage.getHelperCredentialById(credentialId);
      if (!credential) {
        return res.status(404).json({ message: "자격 증명을 찾을 수 없습니다" });
      }

      const oldStatus = credential.verificationStatus;
      await storage.updateHelperCredentialStatus(credentialId, "rejected", reviewerId, reason);

      // 감사 로그 기록
      await storage.createAuditLog({
        userId: reviewerId,
        action: "helper.onboarding.reject",
        targetType: "helper_credential",
        targetId: String(credentialId),
        oldValue: JSON.stringify({ verificationStatus: oldStatus, userId: credential.userId }),
        newValue: JSON.stringify({ verificationStatus: "rejected", userId: credential.userId, reason }),
        ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
        userAgent: req.headers["user-agent"] || null,
      });

      // Send push notification to the helper with rejection reason
      await storage.createNotification({
        userId: credential.userId,
        type: "onboarding_rejected",
        title: "가입 반려",
        message: `헬퍼 가입이 반려되었습니다. 사유: ${reason || "사유 없음"}. 정보를 수정 후 다시 제출해주세요.`,
        relatedId: credentialId,
      });

      res.json({ success: true, message: "반려되었습니다" });
    } catch (err: any) {
      console.error("reject error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 헬퍼 가입 승인/반려 API (User-level onboarding)
  // ============================================

  // 심사 대기중인 헬퍼 목록 조회
  app.get("/api/admin/helpers/pending", adminAuth, requirePermission("helpers.verify"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const pendingHelpers = users.filter(u => u.role === "helper" && u.onboardingStatus === "pending");

      // 각 헬퍼의 서류 정보 조회
      const helpersWithDocs = await Promise.all(pendingHelpers.map(async (helper) => {
        const [credential, vehicle, license, bankAccount] = await Promise.all([
          storage.getHelperCredential(helper.id),
          storage.getHelperVehicle(helper.id),
          storage.getHelperLicense(helper.id),
          storage.getHelperBankAccount(helper.id),
        ]);

        return {
          id: helper.id,
          username: helper.username,
          name: helper.name,
          email: helper.email,
          phoneNumber: helper.phoneNumber,
          onboardingStatus: helper.onboardingStatus,
          createdAt: helper.createdAt,
          credential,
          vehicle,
          license,
          bankAccount,
        };
      }));

      res.json(helpersWithDocs);
    } catch (err: any) {
      console.error("pending helpers error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 가입 승인 (User-level)
  app.post("/api/admin/helpers/:helperId/approve", adminAuth, requirePermission("helpers.verify"), async (req, res) => {
    try {
      const { helperId } = req.params;
      const reviewerId = (req as any).user?.id;

      const helper = await storage.getUser(helperId);
      if (!helper || helper.role !== "helper") {
        return res.status(404).json({ message: "헬퍼를 찾을 수 없습니다" });
      }

      if (helper.onboardingStatus === "approved") {
        return res.status(400).json({ message: "이미 승인된 헬퍼입니다" });
      }

      // 사용자 온보딩 상태 업데이트
      await storage.updateUser(helperId, {
        onboardingStatus: "approved",
        onboardingReviewedAt: new Date(),
        onboardingReviewedBy: reviewerId,
        onboardingRejectReason: null,
      });

      // 알림 저장 및 푸시 알림 전송
      await storage.createNotification({
        userId: helperId,
        type: "onboarding_approved",
        title: "가입 승인 완료",
        message: "축하합니다! 헬퍼 가입이 승인되었습니다. 이제 오더를 확인하고 업무를 시작할 수 있습니다.",
        relatedId: null,
      });

      // 실제 푸시 알림 전송
      sendPushToUser(helperId, {
        title: "가입 승인 완료",
        body: "축하합니다! 헬퍼 가입이 승인되었습니다. 이제 오더를 확인하고 업무를 시작할 수 있습니다.",
        url: "/helper-home",
        tag: "onboarding_approved",
      });

      // WebSocket notification for real-time status update
      notificationWS.sendDataRefresh(helperId, {
        type: "onboarding",
        action: "updated",
        metadata: { status: "approved" },
      });

      // SMS 알림 발송
      if (helper.phoneNumber) {
        const smsResult = await smsService.sendApprovalNotice(helper.phoneNumber, helper.name);
        if (!smsResult.success) {
          console.error(`[승인 SMS 실패] ${smsResult.error}`);
        }
      }

      res.json({ success: true, message: "헬퍼 가입이 승인되었습니다" });
    } catch (err: any) {
      console.error("approve helper error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 가입 반려 (User-level)
  app.post("/api/admin/helpers/:helperId/reject", adminAuth, requirePermission("helpers.verify"), async (req, res) => {
    try {
      const { helperId } = req.params;
      const { reason } = req.body;
      const reviewerId = (req as any).user?.id;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "반려 사유를 입력해주세요" });
      }

      const helper = await storage.getUser(helperId);
      if (!helper || helper.role !== "helper") {
        return res.status(404).json({ message: "헬퍼를 찾을 수 없습니다" });
      }

      // 사용자 온보딩 상태 업데이트
      await storage.updateUser(helperId, {
        onboardingStatus: "rejected",
        onboardingReviewedAt: new Date(),
        onboardingReviewedBy: reviewerId,
        onboardingRejectReason: reason.trim(),
      });

      // 알림 저장 및 푸시 알림 전송
      await storage.createNotification({
        userId: helperId,
        type: "onboarding_rejected",
        title: "가입 심사 반려",
        message: `가입 심사가 반려되었습니다. 사유: ${reason.trim()}`,
        relatedId: null,
      });

      // 실제 푸시 알림 전송
      sendPushToUser(helperId, {
        title: "가입 심사 반려",
        body: `가입 심사가 반려되었습니다. 사유: ${reason.trim()}`,
        url: "/helper-home",
        tag: "onboarding_rejected",
      });

      // WebSocket notification for real-time status update
      notificationWS.sendDataRefresh(helperId, {
        type: "onboarding",
        action: "updated",
        metadata: { status: "rejected" },
      });

      // SMS 알림 발송
      if (helper.phoneNumber) {
        const smsResult = await smsService.sendRejectionNotice(helper.phoneNumber, helper.name, reason);
        if (!smsResult.success) {
          console.error(`[반려 SMS 실패] ${smsResult.error}`);
        }
      }

      res.json({ success: true, message: "헬퍼 가입이 반려되었습니다" });
    } catch (err: any) {
      console.error("reject helper error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 헬퍼 앱 정산/인센티브 조회 API
  // ============================================
  app.get("/api/helpers/me/settlements", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const settlements = await storage.getSettlementsByHelper(userId);
      res.json(settlements);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/helpers/settlements/:id/confirm", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const settlementId = Number(req.params.id);

      // Idempotency check
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, cachedResponse } = await checkIdempotency(
          userId,
          `PATCH:/api/helpers/settlements/${settlementId}/confirm`,
          idempotencyKey
        );
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached settlement confirm for ${settlementId}, key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      if (!settlementId || isNaN(settlementId)) {
        return res.status(400).json({ message: "유효하지 않은 정산 ID입니다" });
      }

      const settlement = await storage.getSettlementStatement(settlementId);

      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      if (settlement.helperId !== userId) {
        return res.status(403).json({ message: "본인의 정산만 확인할 수 있습니다" });
      }

      if (settlement.helperConfirmed) {
        return res.status(400).json({ message: "이미 확인된 정산입니다" });
      }

      const forwardedFor = req.headers["x-forwarded-for"];
      const ipAddress = (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : null)
        || req.ip
        || req.socket?.remoteAddress
        || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const updated = await storage.updateSettlementStatement(settlementId, {
        helperConfirmed: true,
        helperConfirmedAt: new Date(),
        helperIpAddress: typeof ipAddress === "string" ? ipAddress : String(ipAddress),
        helperUserAgent: userAgent,
      });

      console.log(`[Settlement Confirmed] Settlement ${settlementId} confirmed by helper ${userId}`);

      const confirmResponse = { success: true, message: "정산 내역을 확인했습니다", settlement: updated };

      // Store idempotency response
      if (idempotencyKey) {
        await storeIdempotencyResponse(userId, `PATCH:/api/helpers/settlements/${settlementId}/confirm`, idempotencyKey, 200, confirmResponse);
      }

      res.json(confirmResponse);
    } catch (err: any) {
      console.error("helper settlement confirm error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/team-leader/incentives", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);
      if (!user?.isTeamLeader) {
        return res.status(403).json({ message: "팀장만 접근 가능합니다" });
      }
      const incentives = await storage.getIncentivesByTeamLeader(userId);
      res.json(incentives);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 헬퍼 개인식별 코드 API
  // ============================================

  // 헬퍼 개인 코드 조회 (없으면 생성)
  app.get("/api/helpers/me/personal-code", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const code = await getOrCreatePersonalCode(userId);

      res.json({
        personalCode: code,
        isTeamLeader: user.isTeamLeader,
        teamName: user.teamName,
      });
    } catch (err: any) {
      console.error("get personal code error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 의뢰인 개인 코드 조회 (없으면 생성) - 웹 텍스트 입력용
  app.get("/api/requesters/me/personal-code", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const code = await getOrCreatePersonalCode(userId);

      res.json({
        personalCode: code,
        name: user.name,
      });
    } catch (err: any) {
      console.error("get requester personal code error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 팀 탈퇴 API
  app.post("/api/helpers/me/leave-team", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      // 팀 소속 확인
      const teamMembership = await storage.getTeamMemberByUserId(userId);
      if (!teamMembership || !teamMembership.isActive) {
        return res.status(400).json({ message: "소속된 팀이 없습니다" });
      }

      // 팀장은 탈퇴 불가 (팀 해산 필요)
      if (user.isTeamLeader) {
        return res.status(400).json({ message: "팀장은 팀을 탈퇴할 수 없습니다. 관리자에게 문의해주세요." });
      }

      // 팀 멤버십 비활성화
      await storage.updateTeamMember(teamMembership.id, {
        isActive: false,
      });

      // 사용자 정보 업데이트
      await storage.updateUser(userId, {
        teamName: null,
      });

      res.json({ success: true, message: "팀에서 탈퇴했습니다" });
    } catch (err: any) {
      console.error("leave team error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 헬퍼 팀 관리 API (Team QR)
  // ============================================

  // 팀장의 팀 정보 및 QR 코드 조회
  app.get("/api/helper/my-team", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);

      if (!user || !user.isTeamLeader) {
        return res.status(403).json({ message: "팀장만 접근할 수 있습니다" });
      }

      // Get or create team for this leader
      let team = await storage.getTeamByLeader(userId);

      if (!team) {
        // Auto-create team for team leader with unique QR token
        const qrToken = `TEAM_${randomUUID()}`;
        team = await storage.createTeam({
          leaderId: userId,
          name: user.teamName || `${user.name || '헬퍼'} 팀`,
          qrCodeToken: qrToken,
          isActive: true,
        });

        // Add leader as a member of their own team
        await storage.addTeamMember({
          teamId: team.id,
          helperId: userId,
          isActive: true,
        });
      }

      // Ensure team has a valid QR token (regenerate if missing)
      if (!team.qrCodeToken) {
        team = await storage.regenerateTeamQrToken(team.id);
      }

      // Get member count
      const members = await storage.getTeamMembers(team.id);

      res.json({
        teamId: team.id,
        teamName: team.name,
        qrCode: team.qrCodeToken,
        memberCount: members.length,
        members: members.map(m => ({
          id: m.id,
        })),
      });
    } catch (err: any) {
      console.error("Error fetching team info:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 팀원 가입 (QR 스캔 - 팀장 개인코드 또는 팀 QR 토큰)
  app.post("/api/helper/join-team", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { qrCode, personalCode } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 팀에 가입할 수 있습니다" });
      }

      let team;

      // personalCode가 명시적으로 제공된 경우: 팀장 개인코드로 팀 찾기
      if (personalCode) {
        // 개인코드 정규화 (대문자)
        const normalizedCode = personalCode.trim().toUpperCase();
        const teamLeader = await storage.getUserByPersonalCode(normalizedCode);

        if (teamLeader) {
          if (!teamLeader.isTeamLeader) {
            return res.status(400).json({ message: "해당 사용자는 팀장이 아닙니다" });
          }
          team = await storage.getTeamByLeader(teamLeader.id);
          if (!team) {
            return res.status(404).json({ message: "해당 팀장의 팀을 찾을 수 없습니다" });
          }
        } else {
          // 개인코드로 찾지 못한 경우 팀 토큰으로 폴백 시도
          team = await storage.getTeamByToken(personalCode);
          if (!team) {
            return res.status(404).json({ message: "유효하지 않은 개인코드입니다" });
          }
        }
      } else if (qrCode) {
        // qrCode가 제공된 경우: 기존 팀 QR 토큰으로 팀 찾기 (레거시 호환)
        team = await storage.getTeamByToken(qrCode);
        if (!team) {
          return res.status(404).json({ message: "유효하지 않은 QR 코드입니다" });
        }
      } else {
        return res.status(400).json({ message: "팀장 개인코드 또는 QR 코드가 필요합니다" });
      }

      // Block leaders from joining their own team
      if (team.leaderId === userId) {
        return res.status(400).json({ message: "본인의 팀에 가입할 수 없습니다" });
      }

      // Check if user is already a team leader
      if (user.isTeamLeader) {
        return res.status(400).json({ message: "팀장은 다른 팀에 가입할 수 없습니다" });
      }

      // Check if already in a team
      const existingMembership = await storage.getHelperTeam(userId);
      if (existingMembership) {
        // If already in this team, return success (idempotent)
        if (existingMembership.team.id === team.id) {
          return res.json({
            success: true,
            teamName: team.name,
            message: `이미 ${team.name} 팀에 소속되어 있습니다`
          });
        }
        return res.status(400).json({ message: "이미 다른 팀에 소속되어 있습니다" });
      }

      // Check if already a member of this specific team (defensive)
      const isAlreadyMember = await storage.isHelperInTeam(team.id, userId);
      if (isAlreadyMember) {
        return res.json({
          success: true,
          teamName: team.name,
          message: `이미 ${team.name} 팀에 소속되어 있습니다`
        });
      }

      // Join the team
      await storage.addTeamMember({
        teamId: team.id,
        helperId: userId,
        isActive: true,
      });

      // Update user's team name
      await storage.updateUser(userId, { teamName: team.name });

      res.json({
        success: true,
        teamName: team.name,
        message: `${team.name} 팀에 가입되었습니다`
      });
    } catch (err: any) {
      console.error("Error joining team:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 팀 QR 스캔 로그 (팀별 필터)
  // ============================================
  app.get("/api/admin/teams/:teamId/qr/scans", adminAuth, requirePermission("teams.qr"), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const logs = await storage.getQrScanLogsByTeam(teamId);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 긴급 대타 요청 API (Substitute Requests)
  // ============================================
  app.post("/api/substitute-requests", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { orderId, urgencyLevel, workDate, workContent } = req.body;
      const request = await storage.createSubstituteRequest({
        requesterId: userId,
        orderId,
        urgencyLevel: urgencyLevel || "normal",
        workDate: workDate || new Date().toISOString().split("T")[0],
        requestDate: new Date().toISOString().split("T")[0],
        workContent,
        status: "pending",
      });
      res.status(201).json(request);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/substitute-requests/feed", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getPendingSubstituteRequests();
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/substitute-requests/:id/accept", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      await storage.acceptSubstituteRequest(requestId, userId);
      res.json({ success: true, message: "대타 요청을 수락했습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 지시사항 이력 API (Instruction Logs)
  // ============================================
  app.post("/api/admin/contracts/:id/instructions", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const jobContractId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { instructionContent, instructionType } = req.body;
      const log = await storage.createInstructionLog({
        jobContractId,
        issuerId: userId,
        instructionContent: instructionContent || "",
        instructionType: instructionType || "general",
      });
      res.status(201).json(log);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/contracts/:id/instructions", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const logs = await storage.getInstructionLogsByContract(contractId);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 단가 변환 규칙 CRUD (Price Conversion Rules)
  // ============================================
  app.get("/api/admin/pricing/conversion-rules", adminAuth, requirePermission("carriers.view"), async (req, res) => {
    try {
      const rules = await storage.getAllPriceConversionRules();
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/pricing/conversion-rules", adminAuth, requirePermission("carriers.edit"), async (req, res) => {
    try {
      const { name, conversionType, unit, priority, isActive } = req.body;
      const rule = await storage.createPriceConversionRule({
        name,
        conversionType,
        unit: unit || 100,
        priority: priority || 1,
        isActive: isActive !== false,
      });
      res.status(201).json(rule);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 내 제재 조회 API (My Sanctions)
  // ============================================
  app.get("/api/me/sanctions", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const sanctions = await storage.getSanctionsByUser(userId);
      res.json(sanctions);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 분쟁 상태 조회 API (My Incidents)
  // ============================================
  app.get("/api/incidents/my", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const incidents = await storage.getIncidentsByUser(userId);
      res.json(incidents);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === checkin & push routes moved to routes/checkin.routes.ts, routes/push.routes.ts ===


  // ========================================
  // Data Management APIs (SUPER_ADMIN only)
  // ========================================

  // Check if user is super admin
  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    const user = req.adminUser || req.user;
    if (!user) {
      return res.status(401).json({ message: "인증이 필요합니다" });
    }

    // 환경변수 기반 슈퍼관리자 이메일 목록
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    if (superAdminEmails.length > 0 && superAdminEmails.includes(user.email)) {
      return next();
    }

    // Check if user has SUPER_ADMIN role by querying database
    const result = await db.execute(sql`
      SELECT r.code FROM staff_role_assignments sra
      JOIN admin_roles r ON r.id = sra.role_id
      WHERE sra.user_id = ${user.id}::text AND r.code = 'SUPER_ADMIN' AND sra.is_active = true
      LIMIT 1
    `);

    if (!result.rows || result.rows.length === 0) {
      console.log("SUPER_ADMIN check failed for user:", user.id, user.email);
      return res.status(403).json({
        message: `최고관리자 권한이 필요합니다 (${user.email || user.id})`
      });
    }
    next();
  };

  // Get data statistics for management
  app.get("/api/admin/data-management/stats", adminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const stats = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COUNT(*) FROM help_posts) as posts_count,
          (SELECT COUNT(*) FROM orders) as orders_count,
          (SELECT COUNT(*) FROM settlements) as settlements_count,
          (SELECT COUNT(*) FROM helper_credentials) as helpers_count,
          (SELECT COUNT(*) FROM check_in_records) as checkins_count,
          (SELECT COUNT(*) FROM work_proof_events) as work_proofs_count,
          (SELECT COUNT(*) FROM teams) as teams_count,
          (SELECT COUNT(*) FROM contracts) as contracts_count,
          (SELECT COUNT(*) FROM hq_staff) as staff_count
      `);

      res.json(stats.rows[0] || {});
    } catch (err: any) {
      console.error("Data stats error:", err);
      res.status(500).json({ message: "데이터 통계 조회 실패" });
    }
  });

  // Delete specific data type
  app.delete("/api/admin/data-management/:dataType", adminAuth, requireSuperAdmin, async (req, res) => {
    const { dataType } = req.params;
    const { confirmCode } = req.body;

    // Require confirmation code for safety
    if (confirmCode !== "DELETE_CONFIRM") {
      return res.status(400).json({ message: "확인 코드가 올바르지 않습니다" });
    }

    try {
      let deletedCount = 0;

      switch (dataType) {
        case "orders":
          // Delete related data first
          await db.execute(sql`DELETE FROM work_proof_events`);
          await db.execute(sql`DELETE FROM check_in_records`);
          await db.execute(sql`DELETE FROM settlements`);
          await db.execute(sql`DELETE FROM helper_applications`);
          const ordersResult = await db.execute(sql`DELETE FROM orders`);
          deletedCount = ordersResult.rowCount || 0;
          break;

        case "settlements":
          const settlementsResult = await db.execute(sql`DELETE FROM settlements`);
          deletedCount = settlementsResult.rowCount || 0;
          break;

        case "posts":
          await db.execute(sql`DELETE FROM orders`);
          await db.execute(sql`DELETE FROM settlements`);
          const postsResult = await db.execute(sql`DELETE FROM help_posts`);
          deletedCount = postsResult.rowCount || 0;
          break;

        case "users":
          // Only delete non-admin users
          const usersResult = await db.execute(sql`
            DELETE FROM users 
            WHERE role != 'admin' 
            AND id NOT IN (SELECT user_id FROM hq_staff WHERE user_id IS NOT NULL)
          `);
          deletedCount = usersResult.rowCount || 0;
          break;

        case "checkins":
          const checkinsResult = await db.execute(sql`DELETE FROM check_in_records`);
          deletedCount = checkinsResult.rowCount || 0;
          break;

        case "work_proofs":
          const workProofsResult = await db.execute(sql`DELETE FROM work_proof_events`);
          deletedCount = workProofsResult.rowCount || 0;
          break;

        default:
          return res.status(400).json({ message: "지원하지 않는 데이터 유형입니다" });
      }

      // Log the action
      console.log(`[DATA_MANAGEMENT] User ${(req as any).user.id} deleted ${dataType}: ${deletedCount} records`);

      res.json({
        success: true,
        message: `${deletedCount}건의 ${dataType} 데이터가 삭제되었습니다`
      });
    } catch (err: any) {
      console.error("Data delete error:", err);
      res.status(500).json({ message: "데이터 삭제 중 오류가 발생했습니다" });
    }
  });

  // ========================================
  // Staff Management APIs (SUPER_ADMIN only)
  // ========================================

  // Get all admin roles
  app.get("/api/admin/staff/roles", adminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, code, name, description FROM admin_roles ORDER BY id
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("Get roles error:", err);
      res.status(500).json({ message: "역할 목록 조회 실패" });
    }
  });

  // Get all staff members
  app.get("/api/admin/staff", adminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT u.id, u.email, u.name, u.phone_number as "phoneNumber", u.address, 
               u.admin_status as "adminStatus", u.created_at as "createdAt",
               ar.code as "roleCode", ar.name as "roleName"
        FROM users u
        LEFT JOIN staff_role_assignments sra ON sra.user_id = u.id::text AND sra.is_active = true
        LEFT JOIN admin_roles ar ON ar.id = sra.role_id
        WHERE u.is_hq_staff = true OR u.role = 'admin'
        ORDER BY u.created_at DESC
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("Get staff error:", err);
      res.status(500).json({ message: "직원 목록 조회 실패" });
    }
  });

  // Create new staff member
  app.post("/api/admin/staff", adminAuth, requireSuperAdmin, async (req, res) => {
    const { email, name, phoneNumber, address, password, roleId } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ message: "이메일, 이름, 비밀번호는 필수입니다" });
    }

    try {
      // Check if email already exists
      const existing = await db.execute(sql`SELECT id FROM users WHERE email = ${email}`);
      if (existing.rows && existing.rows.length > 0) {
        return res.status(400).json({ message: "이미 존재하는 이메일입니다" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      const username = email.split("@")[0];

      // Create user
      await db.execute(sql`
        INSERT INTO users (id, email, username, name, phone_number, address, password, role, is_hq_staff, admin_status, onboarding_status)
        VALUES (${userId}, ${email}, ${username}, ${name}, ${phoneNumber || null}, ${address || null}, ${hashedPassword}, 'admin', true, 'active', 'approved')
      `);

      // Assign role if provided
      if (roleId) {
        await db.execute(sql`
          INSERT INTO staff_role_assignments (user_id, role_id, assigned_by, is_active)
          VALUES (${userId}, ${roleId}, ${(req as any).user.id}, true)
        `);
      }

      console.log(`[STAFF] Created new staff: ${email} by ${(req as any).user.id}`);

      res.json({
        success: true,
        message: "직원이 등록되었습니다",
        userId
      });
    } catch (err: any) {
      console.error("Create staff error:", err);
      res.status(500).json({ message: "직원 등록 중 오류가 발생했습니다" });
    }
  });

  // Update staff role
  app.patch("/api/admin/staff/:userId/role", adminAuth, requireSuperAdmin, async (req, res) => {
    const { userId } = req.params;
    const { roleId } = req.body;

    try {
      // Deactivate existing role
      await db.execute(sql`
        UPDATE staff_role_assignments SET is_active = false WHERE user_id = ${userId}
      `);

      // Assign new role
      if (roleId) {
        await db.execute(sql`
          INSERT INTO staff_role_assignments (user_id, role_id, assigned_by, is_active)
          VALUES (${userId}, ${roleId}, ${(req as any).user.id}, true)
        `);
      }

      res.json({ success: true, message: "역할이 변경되었습니다" });
    } catch (err: any) {
      console.error("Update role error:", err);
      res.status(500).json({ message: "역할 변경 실패" });
    }
  });

  // Delete staff member (deactivate)
  app.delete("/api/admin/staff/:userId", adminAuth, requireSuperAdmin, async (req, res) => {
    const { userId } = req.params;

    try {
      await db.execute(sql`
        UPDATE users SET admin_status = 'inactive' WHERE id = ${userId}
      `);
      await db.execute(sql`
        UPDATE staff_role_assignments SET is_active = false WHERE user_id = ${userId}
      `);

      res.json({ success: true, message: "직원이 비활성화되었습니다" });
    } catch (err: any) {
      console.error("Delete staff error:", err);
      res.status(500).json({ message: "직원 비활성화 실패" });
    }
  });

  // Reset all operational data (사용자/설정 유지, 운영 데이터 전체 초기화)
  app.post("/api/admin/data-management/reset-all", adminAuth, requireSuperAdmin, async (req, res) => {
    const { confirmCode, confirmText } = req.body;

    // Double confirmation for safety
    if (confirmCode !== "RESET_ALL_DATA" || confirmText !== "전체 초기화 확인") {
      return res.status(400).json({ message: "확인 정보가 올바르지 않습니다" });
    }

    try {
      const user = (req as any).adminUser || (req as any).user;
      console.log(`[DATA_MANAGEMENT] User ${user?.id} starting FULL OPERATIONAL DATA RESET...`);

      // TRUNCATE CASCADE로 FK 제약 자동 처리
      // 순서: 자식 테이블 → 부모 테이블 (CASCADE가 처리하지만 명시적 순서 유지)
      const safeTruncate = async (tableName: string) => {
        try {
          await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE`));
        } catch (e: any) {
          if (!e.message?.includes('does not exist') && !e.message?.includes('relation') ) {
            console.warn(`[RESET] Failed to truncate ${tableName}:`, e.message);
          }
        }
      };

      // ========== 1. 오더 관련 (자식 먼저) ==========
      await safeTruncate('work_proof_events');
      await safeTruncate('work_sessions');
      await safeTruncate('work_confirmations');
      await safeTruncate('order_status_events');
      await safeTruncate('order_force_status_logs');
      await safeTruncate('order_policy_snapshots');
      await safeTruncate('order_cost_items');
      await safeTruncate('order_closure_reports');
      await safeTruncate('order_registration_fields');
      await safeTruncate('order_start_tokens');
      await safeTruncate('order_candidates');
      await safeTruncate('order_applications');
      await safeTruncate('manual_dispatch_logs');
      await safeTruncate('dispatch_requests');
      await safeTruncate('pricing_snapshots');
      await safeTruncate('carrier_proof_uploads');
      await safeTruncate('proof_upload_failures');
      await safeTruncate('balance_invoices');
      await safeTruncate('reassignments');
      await safeTruncate('substitute_requests');

      // ========== 2. 계약/작업 ==========
      await safeTruncate('contract_execution_events');
      await safeTruncate('contract_documents');
      await safeTruncate('job_contracts');
      await safeTruncate('contracts');
      await safeTruncate('job_postings');

      // ========== 3. 마감보고서 ==========
      await safeTruncate('closing_reports');

      // ========== 4. 정산 ==========
      await safeTruncate('settlement_audit_logs');
      await safeTruncate('settlement_payout_attempts');
      await safeTruncate('settlement_line_items');
      await safeTruncate('settlement_records');
      await safeTruncate('settlement_statements');
      await safeTruncate('monthly_settlement_statements');
      await safeTruncate('payout_events');
      await safeTruncate('payouts');

      // ========== 5. 사고/분쟁/환불/차감 ==========
      await safeTruncate('incident_actions');
      await safeTruncate('incident_evidence');
      await safeTruncate('team_incidents');
      await safeTruncate('incident_reports');
      await safeTruncate('disputes');
      await safeTruncate('refunds');
      await safeTruncate('deductions');

      // ========== 6. 결제/세금계산서 ==========
      await safeTruncate('payment_status_events');
      await safeTruncate('payment_reminders');
      await safeTruncate('payment_intents');
      await safeTruncate('payments');
      await safeTruncate('tax_invoices');
      await safeTruncate('virtual_accounts');

      // ========== 7. 고객문의/티켓 ==========
      await safeTruncate('inquiry_comments');
      await safeTruncate('ticket_escalations');
      await safeTruncate('support_ticket_escalations');
      await safeTruncate('customer_inquiries');
      await safeTruncate('customer_service_inquiries');
      await safeTruncate('team_cs_inquiries');

      // ========== 8. 알림/SMS/푸시 로그 ==========
      await safeTruncate('push_deliveries');
      await safeTruncate('push_events');
      await safeTruncate('push_messages');
      await safeTruncate('push_notification_logs');
      await safeTruncate('notification_logs');
      await safeTruncate('notifications');
      await safeTruncate('sms_logs');

      // ========== 9. 시스템 로그/이벤트 ==========
      await safeTruncate('webhook_logs');
      await safeTruncate('integration_events');
      await safeTruncate('integration_health');
      await safeTruncate('system_events');
      await safeTruncate('audit_logs');
      await safeTruncate('auth_audit_logs');
      await safeTruncate('instruction_logs');
      await safeTruncate('client_errors');

      // ========== 10. 리뷰/공지/체크인 ==========
      await safeTruncate('reviews');
      await safeTruncate('helper_rating_summary');
      await safeTruncate('announcement_recipients');
      await safeTruncate('announcements');
      await safeTruncate('check_in_records');
      await safeTruncate('contact_share_events');

      // ========== 11. 인센티브/기업 ==========
      await safeTruncate('incentive_details');
      await safeTruncate('team_incentives');
      await safeTruncate('incentive_policies');
      await safeTruncate('enterprise_order_batches');
      await safeTruncate('enterprise_accounts');

      // ========== 12. 제재/QR/멱등성 ==========
      await safeTruncate('user_sanctions');
      await safeTruncate('qr_scan_logs');
      await safeTruncate('idempotency_keys');

      // ========== 13. 위치/인증/기기 ==========
      await safeTruncate('user_location_logs');
      await safeTruncate('user_location_latest');
      await safeTruncate('phone_verification_codes');

      // ========== 14. 문서/본인확인 ==========
      await safeTruncate('document_reviews');
      await safeTruncate('document_review_tasks');
      await safeTruncate('documents');
      await safeTruncate('identity_verifications');

      // ========== 15. MG(최저보장) ==========
      await safeTruncate('mg_topups');
      await safeTruncate('mg_period_summaries');
      await safeTruncate('mg_enrollments');
      await safeTruncate('minimum_guarantee_applications');

      // ========== 16. 정책 스냅샷/변경 이력 ==========
      await safeTruncate('policy_snapshots');
      await safeTruncate('rate_change_logs');
      await safeTruncate('setting_change_history');

      // ========== 17. 세션/토큰/동의 ==========
      await safeTruncate('refresh_tokens');
      await safeTruncate('push_subscriptions');
      await safeTruncate('fcm_tokens');
      await safeTruncate('user_devices');
      await safeTruncate('helper_terms_agreements');
      await safeTruncate('signup_consents');
      await safeTruncate('terms_re_consents');
      await safeTruncate('policy_consents');
      await safeTruncate('requester_service_agreements');

      // ========== 18. 기타 ==========
      await safeTruncate('help_posts');
      await safeTruncate('user_permissions');
      await safeTruncate('staff_role_assignments');

      // ========== 19. 오더 (부모 테이블 — 마지막) ==========
      await safeTruncate('orders');

      console.log(`[DATA_MANAGEMENT] User ${user?.id} completed FULL OPERATIONAL DATA RESET`);

      res.json({
        success: true,
        message: "전체 운영 데이터가 초기화되었습니다 (사용자 계정 및 시스템 설정 유지)"
      });
    } catch (err: any) {
      console.error("Data reset error:", err);
      res.status(500).json({ message: "전체 초기화 중 오류가 발생했습니다: " + (err as any).message });
    }
  });

  // Auto-hide scheduler: hide completed orders after 24 hours
  const runAutoHideScheduler = async () => {
    try {
      const now = new Date();
      // Use optimized DB query instead of loading all orders
      const ordersToHide = await storage.getOrdersPendingAutoHide();

      for (const order of ordersToHide) {
        await storage.updateOrder(order.id, { hiddenAt: now });
        console.log(`[AUTO_HIDE] Order ${order.id} hidden at ${now.toISOString()}`);
      }

      if (ordersToHide.length > 0) {
        console.log(`[AUTO_HIDE] Processed ${ordersToHide.length} orders`);
      }
    } catch (err: any) {
      console.error("[AUTO_HIDE] Scheduler error:", err);
    }
  };

  // Run auto-hide scheduler every hour
  setInterval(runAutoHideScheduler, 60 * 60 * 1000);
  // Also run once on startup
  setTimeout(runAutoHideScheduler, 5000);
  console.log("Auto-hide scheduler initialized (runs every hour)");

  // Auto-delete scheduler: delete unmatched orders after scheduled date has passed
  const runAutoDeleteExpiredOrders = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Get all orders that are still in open/awaiting_deposit status
      const allOrders = await storage.getOrders();
      const expiredOrders = allOrders.filter(order => {
        // Only delete unmatched orders (open, awaiting_deposit - 표준)
        const unmatchedStatuses = [ORDER_STATUS.OPEN, ORDER_STATUS.AWAITING_DEPOSIT];
        const normalizedStatus = normalizeOrderStatus(order.status);
        if (!order.status || !unmatchedStatuses.includes(normalizedStatus as any)) return false;

        // Check if scheduled date has passed
        if (!order.scheduledDate) return false;

        // Parse Korean date format (e.g., "1월 15일" or "2026-01-15")
        let scheduledDate: Date;
        if (order.scheduledDate.includes("월")) {
          // Korean format: "1월 15일"
          const match = order.scheduledDate.match(/(\d+)월\s*(\d+)일/);
          if (!match) return false;
          const month = parseInt(match[1]) - 1;
          const day = parseInt(match[2]);
          scheduledDate = new Date(now.getFullYear(), month, day);
          // If the date appears to be in the past by more than 6 months, it might be next year
          if (scheduledDate.getTime() > now.getTime() + 180 * 24 * 60 * 60 * 1000) {
            scheduledDate = new Date(now.getFullYear() - 1, month, day);
          }
        } else {
          // ISO format
          scheduledDate = new Date(order.scheduledDate);
        }

        const scheduledDateOnly = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());

        return scheduledDateOnly < today;
      });

      for (const order of expiredOrders) {
        // Soft delete by setting hiddenAt and status to closed
        await storage.updateOrder(order.id, {
          status: "closed",
          hiddenAt: now
        });

        // 관련 지원서 일괄 취소
        try {
          const apps = await storage.getOrderApplications(order.id);
          const activeApps = apps.filter(a => a.status === "applied" || a.status === "selected");
          for (const app of activeApps) {
            await storage.updateOrderApplication(app.id, {
              status: "auto_cancelled",
              rejectionReason: "오더 자동 만료",
            });
          }

          // 요청자에게 자동 만료 알림
          if (order.requesterId) {
            await storage.createNotification({
              userId: order.requesterId,
              type: "order_expired",
              title: "오더 자동 만료",
              message: `${order.companyName || ''} 오더가 입차 예정일 경과로 자동 마감되었습니다.`,
              relatedId: order.id,
            });
          }
        } catch (cleanupErr) {
          console.error(`[AUTO_DELETE] Cleanup error for order ${order.id}:`, cleanupErr);
        }

        console.log(`[AUTO_DELETE] Expired order ${order.id} (scheduledDate: ${order.scheduledDate}) deleted at ${now.toISOString()}`);
      }

      if (expiredOrders.length > 0) {
        console.log(`[AUTO_DELETE] Processed ${expiredOrders.length} expired orders`);
      }
    } catch (err: any) {
      console.error("[AUTO_DELETE] Scheduler error:", err);
    }
  };

  // Run auto-delete scheduler every hour
  setInterval(runAutoDeleteExpiredOrders, 60 * 60 * 1000);
  // Also run once on startup (after 10 seconds)
  setTimeout(runAutoDeleteExpiredOrders, 10000);
  console.log("Auto-delete expired orders scheduler initialized (runs every hour)");

  // Auto-cancel unassigned orders scheduler
  // 입차 예정일이 지났는데 헬퍼가 배정되지 않은 오더를 자동 취소하고 환불 처리
  const runAutoUnassignedOrderCancel = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // open 또는 awaiting_deposit 상태에서 헬퍼가 배정되지 않은 오더 조회
      const openOrders = await db.select().from(orders).where(
        and(
          or(eq(orders.status, "open"), eq(orders.status, "awaiting_deposit")),
          isNull(orders.matchedHelperId),
          isNull(orders.hiddenAt),
          sql`true`
        )
      );

      // 입차 예정일이 지난 오더 필터링
      const expiredUnassignedOrders = openOrders.filter(order => {
        if (!order.scheduledDate) return false;

        let scheduledDate: Date;
        if (order.scheduledDate.includes("월")) {
          const match = order.scheduledDate.match(/(\d+)월\s*(\d+)일/);
          if (!match) return false;
          const month = parseInt(match[1]) - 1;
          const day = parseInt(match[2]);
          scheduledDate = new Date(now.getFullYear(), month, day);
          if (scheduledDate.getTime() > now.getTime() + 180 * 24 * 60 * 60 * 1000) {
            scheduledDate = new Date(now.getFullYear() - 1, month, day);
          }
        } else {
          scheduledDate = new Date(order.scheduledDate);
        }

        const scheduledDateOnly = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
        return scheduledDateOnly < today;
      });

      for (const order of expiredUnassignedOrders) {
        // 오더 취소 처리
        await storage.updateOrder(order.id, {
          status: "cancelled",
          updatedAt: now
        });

        // 관련 데이터 정리
        try {
          // 1. 지원서 일괄 취소
          const apps = await storage.getOrderApplications(order.id);
          const activeApps = apps.filter(a => a.status === "applied" || a.status === "selected");
          for (const app of activeApps) {
            await storage.updateOrderApplication(app.id, {
              status: "auto_cancelled",
              rejectionReason: "미배정 오더 자동취소",
            });
            // 지원 헬퍼에게 알림
            try {
              await storage.createNotification({
                userId: app.helperId,
                type: "application_auto_cancelled",
                title: "신청 자동취소",
                message: `${order.companyName || ''} 오더가 자동취소되어 신청도 취소되었습니다.`,
                relatedId: order.id,
              });
            } catch (_) { }
          }

          // 2. 계약금 입금된 경우 환불 레코드 생성
          if (order.status === "awaiting_deposit" || order.paymentStatus === "deposit_confirmed") {
            const orderContracts = await storage.getOrderContracts(order.id);
            const contract = orderContracts[0];
            if (contract && contract.depositPaid) {
              await db.insert(refunds).values({
                orderId: order.id,
                contractId: contract.id,
                requesterId: order.requesterId || "",
                amount: contract.depositAmount || 0,
                reason: "미배정 오더 자동취소로 인한 계약금 환불",
                status: "pending",
                refundType: "full",
              });
              console.log(`[UNASSIGNED_CANCEL] Refund record created for order ${order.id}`);
            }
          }

          // 3. 요청자에게 알림
          if (order.requesterId) {
            await storage.createNotification({
              userId: order.requesterId,
              type: "order_cancelled",
              title: "오더 자동취소",
              message: `${order.companyName || ''} 오더가 헬퍼 미배정으로 자동취소되었습니다.`,
              relatedId: order.id,
            });
            sendPushToUser(order.requesterId, {
              title: "오더 자동취소",
              body: `${order.companyName || ''} 오더가 헬퍼 미배정으로 자동취소되었습니다.`,
              url: "/orders",
            });
          }
        } catch (cleanupErr) {
          console.error(`[UNASSIGNED_CANCEL] Cleanup error for order ${order.id}:`, cleanupErr);
        }

        console.log(`[UNASSIGNED_CANCEL] Order ${order.id} cancelled (scheduledDate: ${order.scheduledDate}) - No helper assigned`);
      }

      if (expiredUnassignedOrders.length > 0) {
        console.log(`[UNASSIGNED_CANCEL] Cancelled ${expiredUnassignedOrders.length} unassigned orders`);
      }
    } catch (err: any) {
      console.error("[UNASSIGNED_CANCEL] Scheduler error:", err);
    }
  };

  // Run auto-unassigned cancel scheduler every hour
  setInterval(runAutoUnassignedOrderCancel, 60 * 60 * 1000);
  // Also run once on startup (after 15 seconds)
  setTimeout(runAutoUnassignedOrderCancel, 15000);
  console.log("Auto-cancel unassigned orders scheduler initialized (runs every hour)");

  // Monthly settlement email scheduler: sends on 1st of each month
  const runMonthlySettlementEmailScheduler = async () => {
    try {
      const now = new Date();
      const isFirstDay = now.getDate() === 1;
      const isScheduledHour = now.getHours() === 9; // 오전 9시에 발송

      if (!isFirstDay || !isScheduledHour) {
        return;
      }

      // Get previous month
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      console.log(`[SETTLEMENT_EMAIL] Starting monthly settlement email for ${prevYear}-${prevMonth}`);

      // Get all settlements for previous month
      const allSettlements = await storage.getAllSettlementStatements();

      // Group by helperId
      const helperSettlements = new Map<string, typeof allSettlements>();
      for (const settlement of allSettlements) {
        const workDate = settlement.workDate ? new Date(settlement.workDate) : null;
        if (!workDate) continue;
        if (workDate.getFullYear() !== prevYear || (workDate.getMonth() + 1) !== prevMonth) continue;

        if (!helperSettlements.has(settlement.helperId)) {
          helperSettlements.set(settlement.helperId, []);
        }
        helperSettlements.get(settlement.helperId)!.push(settlement);
      }

      // Get SMTP settings
      const smtpHostSetting = await storage.getSystemSetting("smtp_host");
      const smtpPortSetting = await storage.getSystemSetting("smtp_port");
      const smtpUserSetting = await storage.getSystemSetting("smtp_user");
      const smtpPasswordSetting = await storage.getSystemSetting("smtp_password");
      const smtpFromEmailSetting = await storage.getSystemSetting("smtp_from_email");

      const smtpHost = smtpHostSetting?.settingValue;
      const smtpPort = smtpPortSetting?.settingValue || "587";
      const smtpUser = smtpUserSetting?.settingValue;
      const smtpPassword = smtpPasswordSetting?.settingValue;
      const smtpFromEmail = smtpFromEmailSetting?.settingValue;

      if (!smtpHost || !smtpUser || !smtpPassword) {
        console.log("[SETTLEMENT_EMAIL] SMTP not configured, skipping auto-send");
        return;
      }

      const nodemailer = await import("nodemailer");
      const { generateSettlementEmailHtml } = await import("../../templates/settlement-email");

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465",
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      let sentCount = 0;
      let failedCount = 0;

      const helperEntries = Array.from(helperSettlements.entries());
      for (const [helperId, settlements] of helperEntries) {
        try {
          const helper = await storage.getUser(helperId);
          if (!helper?.email) {
            console.log(`[SETTLEMENT_EMAIL] No email for helper ${helperId}`);
            failedCount++;
            continue;
          }

          // Calculate summary
          const summary = {
            totalDeliveryCount: settlements.reduce((sum, s) => sum + (s.deliveryCount || 0), 0),
            totalReturnCount: settlements.reduce((sum, s) => sum + (s.returnCount || 0), 0),
            totalPickupCount: settlements.reduce((sum, s) => sum + (s.pickupCount || 0), 0),
            totalOtherCount: settlements.reduce((sum, s) => sum + (s.otherCount || 0), 0),
            totalSupplyAmount: settlements.reduce((sum, s) => sum + (s.supplyAmount || 0), 0),
            totalVatAmount: settlements.reduce((sum, s) => sum + (s.vatAmount || 0), 0),
            grandTotalAmount: settlements.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
            totalCommission: settlements.reduce((sum, s) => sum + (s.commissionAmount || 0), 0),
            totalNetAmount: settlements.reduce((sum, s) => sum + (s.netAmount || 0), 0),
            commissionRate: settlements[0]?.commissionRate || 10,
          };

          const emailHTML = generateSettlementEmailHtml({
            helperName: helper.name || helperId,
            year: prevYear,
            month: prevMonth,
            settlements: settlements.map((s: any) => {
              const wd = s.workDate ? new Date(s.workDate) : null;
              const formattedDate = wd && !isNaN(wd.getTime()) ? `${wd.getMonth() + 1}/${wd.getDate()}` : "-";
              return {
                workDate: formattedDate,
                orderTitle: s.orderTitle || "작업",
                deliveryCount: s.deliveryCount || 0,
                returnCount: s.returnCount || 0,
                pickupCount: s.pickupCount || 0,
                otherCount: s.otherCount || 0,
                supplyAmount: s.supplyAmount || 0,
                vatAmount: s.vatAmount || 0,
                totalAmount: s.totalAmount || 0,
                commissionAmount: s.commissionAmount || 0,
                netAmount: s.netAmount || 0,
              };
            }),
            summary,
          });

          await transporter.sendMail({
            from: smtpFromEmail || smtpUser,
            to: helper.email,
            subject: `[헬프미] ${prevYear}년 ${prevMonth}월 정산서 (1차)`,
            html: emailHTML,
          });

          sentCount++;
          console.log(`[SETTLEMENT_EMAIL] Sent to ${helper.email}`);
        } catch (err: any) {
          console.error(`[SETTLEMENT_EMAIL] Failed for helper ${helperId}:`, err);
          failedCount++;
        }
      }

      console.log(`[SETTLEMENT_EMAIL] Completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (err: any) {
      console.error("[SETTLEMENT_EMAIL] Scheduler error:", err);
    }
  };

  // Run monthly settlement email scheduler every hour (checks if it's 1st of month at 9am)
  setInterval(runMonthlySettlementEmailScheduler, 60 * 60 * 1000);
  console.log("Monthly settlement email scheduler initialized");

  // ==================== 잔금 입금일 3일전 리마인더 스케줄러 ====================
  const runBalancePaymentReminder = async () => {
    try {
      // 3일 후 날짜 계산
      const now = new Date();
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      const targetDateStr = threeDaysLater.toISOString().split("T")[0]; // YYYY-MM-DD

      // 잔금 미결제 + 잔금결제예정일이 3일 후인 오더 조회
      const dueSoonOrders = await db.select().from(orders)
        .where(and(
          eq(orders.balancePaymentDueDate, targetDateStr),
          not(eq(orders.status, "cancelled")),
          not(eq(orders.status, "completed")),
        ));

      if (dueSoonOrders.length === 0) return;

      console.log(`[BALANCE_REMINDER] Found ${dueSoonOrders.length} orders with balance due in 3 days (${targetDateStr})`);

      for (const order of dueSoonOrders) {
        if (!order.requesterId) continue;

        // 이미 오늘 리마인더 보냈는지 확인 (중복 방지)
        const todayStr = now.toISOString().split("T")[0];
        const existingNotifs = await storage.getUserNotifications(order.requesterId);
        const alreadySent = existingNotifs.some((n: any) =>
          n.type === "balance_reminder" && n.relatedId === order.id &&
          n.createdAt && new Date(n.createdAt).toISOString().split("T")[0] === todayStr
        );
        if (alreadySent) continue;

        // 인앱 알림
        await storage.createNotification({
          userId: order.requesterId,
          type: "balance_reminder" as any,
          title: "잔금 결제 안내",
          message: `${order.companyName} 오더의 잔금 결제일이 3일 후(${targetDateStr})입니다. 기한 내 결제해주세요.`,
          relatedId: order.id,
        });

        // 푸시 알림
        sendPushToUser(order.requesterId, {
          title: "잔금 결제 안내",
          body: `${order.companyName} 오더 잔금 결제일이 3일 후입니다. 앱에서 결제해주세요.`,
          url: "/requester-home",
          tag: `balance-reminder-${order.id}`,
        });

        // SMS: 잔금 입금일 3일전 리마인더
        const reminderRequester = await storage.getUser(order.requesterId);
        if (reminderRequester?.phoneNumber) {
          try {
            await smsService.sendCustomMessage(reminderRequester.phoneNumber,
              `[헬프미] ${order.companyName} 오더 잔금 결제일이 3일 후(${targetDateStr})입니다. 기한 내 결제 부탁드립니다.`);
          } catch (smsErr) { console.error("[SMS Error] balance reminder:", smsErr); }
        }

        console.log(`[BALANCE_REMINDER] Sent reminder for order ${order.id} to requester ${order.requesterId}`);
      }
    } catch (err: any) {
      console.error("[BALANCE_REMINDER] Scheduler error:", err);
    }
  };

  // 잔금 리마인더: 매 6시간마다 실행 (하루 중 한 번만 알림 — 중복 체크 포함)
  setInterval(runBalancePaymentReminder, 6 * 60 * 60 * 1000);
  // 서버 시작 시 1분 후 첫 실행
  setTimeout(runBalancePaymentReminder, 60 * 1000);
  console.log("Balance payment 3-day reminder scheduler initialized");

  // ============================================
  // 스케줄러: 화물사고 자동 차감 (헬퍼 응답 기한 만료 시)
  // 비즈니스 규칙:
  // - 요청자가 접수 → 헬퍼 응답 기한 내 동의 시 차감
  // - 미액션(기한 초과) 시 자동 차감
  // - 분쟁(dispute) 시 미차감
  // ============================================
  async function runIncidentAutoDeduction() {
    try {
      const now = new Date();
      // 응답 기한이 지났고, 헬퍼가 미응답이며, 아직 차감 안 된 사고 건 조회
      const expiredIncidents = await db.select()
        .from(incidentReports)
        .where(and(
          eq(incidentReports.helperDeductionApplied, false),
          eq(incidentReports.helperResponseRequired, true),
          // 분쟁(dispute) 상태가 아닌 건만
          or(
            isNull(incidentReports.helperStatus),
            not(eq(incidentReports.helperStatus, 'dispute'))
          ),
          // 응답 기한이 지난 건
          lte(incidentReports.helperResponseDeadline, now),
          // 관리자 강제 처리 안 된 건
          eq(incidentReports.adminForceProcessed, false)
        ));

      if (expiredIncidents.length === 0) return;

      let appliedCount = 0;
      for (const incident of expiredIncidents) {
        // 헬퍼가 이미 응답(confirmed, item_found, request_handling)한 건은 스킵
        if (incident.helperStatus === 'confirmed' || incident.helperStatus === 'item_found' || incident.helperStatus === 'request_handling') {
          continue;
        }

        // 차감 금액이 0이면 스킵
        if (!incident.deductionAmount || incident.deductionAmount <= 0) {
          continue;
        }

        // 자동 차감 적용
        await db.update(incidentReports)
          .set({
            helperDeductionApplied: true,
            deductionConfirmedAt: now,
            updatedAt: now,
          })
          .where(eq(incidentReports.id, incident.id));

        appliedCount++;
        console.log(`[Incident Auto-Deduction] Applied deduction for incident #${incident.id}, order #${incident.orderId}, amount: ${incident.deductionAmount}원`);
      }

      if (appliedCount > 0) {
        console.log(`[Incident Auto-Deduction] Auto-applied ${appliedCount} incident deductions`);
      }
    } catch (err) {
      console.error("[Incident Auto-Deduction] Scheduler error:", err);
    }
  }

  // 매 1시간마다 실행
  setInterval(runIncidentAutoDeduction, 60 * 60 * 1000);
  // 서버 시작 2분 후 첫 실행
  setTimeout(runIncidentAutoDeduction, 2 * 60 * 1000);
  console.log("Incident auto-deduction scheduler initialized (runs every hour)");

  // ==================== 운영 핵심 기능 API ====================

  // 지역별 운임 규칙 API
  app.get("/api/admin/settings/region-pricing", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const rules = await db.select().from(regionPricingRules).orderBy(regionPricingRules.priority);
      res.json(rules);
    } catch (err: any) {
      console.error("Get region pricing rules error:", err);
      res.status(500).json({ message: "Failed to get region pricing rules" });
    }
  });

  app.post("/api/admin/settings/region-pricing", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const result = await db.insert(regionPricingRules).values({
        ...req.body,
        createdBy: actorId,
      }).returning();
      res.json(result[0]);
    } catch (err: any) {
      console.error("Create region pricing rule error:", err);
      res.status(500).json({ message: "Failed to create region pricing rule" });
    }
  });

  app.patch("/api/admin/settings/region-pricing/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const result = await db.update(regionPricingRules)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(regionPricingRules.id, parseInt(req.params.id)))
        .returning();
      res.json(result[0]);
    } catch (err: any) {
      console.error("Update region pricing rule error:", err);
      res.status(500).json({ message: "Failed to update region pricing rule" });
    }
  });

  app.delete("/api/admin/settings/region-pricing/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(regionPricingRules).where(eq(regionPricingRules.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete region pricing rule error:", err);
      res.status(500).json({ message: "Failed to delete region pricing rule" });
    }
  });

  // 정산 락/언락 API (settlementRecords 사용)
  app.post("/api/admin/settlements/:id/lock", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const actorId = (req as any).adminUser?.id;
      const { reason } = req.body;

      // 현재 정산 조회 (settlementRecords 사용)
      const [settlement] = await db.select().from(settlementRecords).where(eq(settlementRecords.id, settlementId));
      if (!settlement) {
        return res.status(404).json({ message: "Settlement not found" });
      }
      if (settlement.status === "LOCKED") {
        return res.status(400).json({ message: "Settlement is already locked" });
      }

      // 락 설정
      const [updated] = await db.update(settlementRecords)
        .set({
          status: "LOCKED",
          updatedAt: new Date(),
        })
        .where(eq(settlementRecords.id, settlementId))
        .returning();

      // 감사 로그 기록
      await db.insert(settlementAuditLogs).values({
        settlementId,
        actionType: "locked",
        previousValue: JSON.stringify({ status: settlement.status }),
        newValue: JSON.stringify({ status: "LOCKED" }),
        reason,
        actorId,
        actorRole: (req as any).adminUser?.role || "admin",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Lock settlement error:", err);
      res.status(500).json({ message: "Failed to lock settlement" });
    }
  });

  app.post("/api/admin/settlements/:id/unlock", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const actorId = (req as any).adminUser?.id;
      const { reason } = req.body;

      const [settlement] = await db.select().from(settlementRecords).where(eq(settlementRecords.id, settlementId));
      if (!settlement) {
        return res.status(404).json({ message: "Settlement not found" });
      }
      if (settlement.status !== "LOCKED") {
        return res.status(400).json({ message: "Settlement is not locked" });
      }

      const [updated] = await db.update(settlementRecords)
        .set({
          status: "APPROVED",
          updatedAt: new Date(),
        })
        .where(eq(settlementRecords.id, settlementId))
        .returning();

      await db.insert(settlementAuditLogs).values({
        settlementId,
        actionType: "unlocked",
        previousValue: JSON.stringify({ status: "LOCKED" }),
        newValue: JSON.stringify({ status: "APPROVED" }),
        reason,
        actorId,
        actorRole: (req as any).adminUser?.role || "admin",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Unlock settlement error:", err);
      res.status(500).json({ message: "Failed to unlock settlement" });
    }
  });

  // 정산 금액 수정 API (락 체크 포함) - settlementRecords 사용
  app.patch("/api/admin/settlements/:id/amount", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const actorId = (req as any).adminUser?.id;
      const { driverPayout, reason } = req.body;

      const [settlement] = await db.select().from(settlementRecords).where(eq(settlementRecords.id, settlementId));
      if (!settlement) {
        return res.status(404).json({ message: "Settlement not found" });
      }
      if (settlement.status === "LOCKED" || settlement.status === "CONFIRMED") {
        return res.status(403).json({ message: "Settlement is locked/confirmed and cannot be modified" });
      }

      const previousAmount = settlement.driverPayout;
      const [updated] = await db.update(settlementRecords)
        .set({
          driverPayout,
          updatedAt: new Date(),
        })
        .where(eq(settlementRecords.id, settlementId))
        .returning();

      await db.insert(settlementAuditLogs).values({
        settlementId,
        actionType: "amount_changed",
        previousValue: JSON.stringify({ driverPayout: previousAmount }),
        newValue: JSON.stringify({ driverPayout }),
        changedFields: JSON.stringify(["driverPayout"]),
        reason,
        actorId,
        actorRole: (req as any).adminUser?.role || "admin",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Update settlement amount error:", err);
      res.status(500).json({ message: "Failed to update settlement amount" });
    }
  });

  // 정산 감사 로그 조회
  app.get("/api/admin/settlements/:id/audit-logs", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const logs = await db.select()
        .from(settlementAuditLogs)
        .where(eq(settlementAuditLogs.settlementId, settlementId))
        .orderBy(desc(settlementAuditLogs.createdAt));
      res.json(logs);
    } catch (err: any) {
      console.error("Get settlement audit logs error:", err);
      res.status(500).json({ message: "Failed to get audit logs" });
    }
  });

  // ============================================
  // Admin 지급 요청/재시도 API (스펙 4-4, 4-6)
  // 스펙: POST /admin/payouts/request, POST /admin/payouts/{payoutId}/retry
  // ============================================

  // 지급 요청 (admin)
  app.post("/api/admin/payouts/request", adminAuth, requirePermission("settlements.pay"), async (req, res) => {
    try {
      const user = (req as any).user || (req as any).adminUser;
      const { settlement_id, payout_account_id } = req.body;

      if (!settlement_id) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "settlement_id는 필수입니다" }
        });
      }

      // 정산 확인
      const settlement = await storage.getSettlementStatement(Number(settlement_id));
      if (!settlement) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "정산을 찾을 수 없습니다" }
        });
      }

      // READY(confirmed) + locked 상태에서만 지급 요청 가능
      if (settlement.status !== "confirmed") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: `정산 상태(${settlement.status})가 READY가 아닙니다` }
        });
      }

      // 헬퍼 계좌 정보 조회
      const helperBankAccount = await storage.getHelperBankAccount(settlement.helperId);
      if (!helperBankAccount) {
        return res.status(400).json({
          error: { code: "NO_BANK_ACCOUNT", message: "헬퍼 계좌 정보가 없습니다" }
        });
      }

      // 기존 지급 확인
      const existingPayout = await storage.getPayoutBySettlement(Number(settlement_id));
      if (existingPayout && existingPayout.status === "SUCCEEDED") {
        return res.status(400).json({
          error: { code: "ALREADY_PAID", message: "이미 지급 완료된 정산입니다" }
        });
      }

      // 지급 생성
      const payout = await storage.createPayout({
        settlementId: Number(settlement_id),
        helperId: settlement.helperId,
        amount: settlement.netAmount || 0,
        bankName: helperBankAccount.bankName || "",
        accountNumber: maskAccountNumber(helperBankAccount.accountNumber || ""),
        accountHolder: helperBankAccount.accountHolder || "",
        status: "REQUESTED",
        requestedAt: new Date(),
      });

      // 지급 이벤트 기록
      await storage.createPayoutEvent({
        payoutId: payout.id,
        previousStatus: null,
        newStatus: "REQUESTED",
        reason: "지급 요청 생성",
        actorId: user.id,
      });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "payout.request",
        targetType: "payout",
        targetId: String(payout.id),
        reason: `지급 요청: 정산 #${settlement_id}`,
        metadata: { settlement_id, amount: payout.amount },
      });

      res.json({
        payout_id: String(payout.id),
        status: "REQUESTED",
      });
    } catch (err: any) {
      console.error("Payout request error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 지급 목록 조회 (admin)
  app.get("/api/admin/payouts", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { status, helper_id, limit } = req.query;
      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit as string) || 100, 1), 500) : 100;

      const payouts = await storage.getAllPayouts({
        status: status as string | undefined,
        helperId: helper_id as string | undefined,
        limit: parsedLimit,
      });

      res.json(payouts.map(p => ({
        payout_id: String(p.id),
        settlement_id: String(p.settlementId),
        helper_id: p.helperId,
        amount: p.amount,
        bank_name: p.bankName,
        account_number: maskAccountNumber(p.accountNumber || ""),
        account_holder: p.accountHolder,
        status: p.status,
        requested_at: p.requestedAt,
        sent_at: p.sentAt,
        succeeded_at: p.succeededAt,
        failed_at: p.failedAt,
        failure_message: p.failureMessage,
        retry_count: p.retryCount,
      })));
    } catch (err: any) {
      console.error("Get payouts error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 지급 재시도 (admin)
  app.post("/api/admin/payouts/:id/retry", adminAuth, requirePermission("settlements.pay"), async (req, res) => {
    try {
      const user = (req as any).user || (req as any).adminUser;
      const id = parseInt(req.params.id);
      const { reason } = req.body;

      const payout = await storage.getPayout(id);
      if (!payout) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "지급 기록을 찾을 수 없습니다" }
        });
      }

      // FAILED 상태에서만 재시도 가능
      if (payout.status !== "FAILED") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: `상태(${payout.status})가 FAILED가 아닙니다` }
        });
      }

      const previousStatus = payout.status;
      const retryCount = (payout.retryCount || 0) + 1;

      // 상태 업데이트
      const updated = await storage.updatePayout(id, {
        status: "REQUESTED",
        requestedAt: new Date(),
        retryCount,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
      });

      // 지급 이벤트 기록
      await storage.createPayoutEvent({
        payoutId: id,
        previousStatus,
        newStatus: "REQUESTED",
        reason: reason || "재시도",
        actorId: user.id,
        metadata: JSON.stringify({ retry_count: retryCount }),
      });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "payout.retry",
        targetType: "payout",
        targetId: String(id),
        reason: reason || "지급 재시도",
        metadata: { retry_count: retryCount },
      });

      res.json({
        payout_id: String(id),
        status: "REQUESTED",
        retry_count: retryCount,
      });
    } catch (err: any) {
      console.error("Payout retry error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 지급 상태 업데이트: REQUESTED → SENT (송금 실행됨)
  app.patch("/api/admin/payouts/:id/sent", adminAuth, requirePermission("settlements.pay"), async (req, res) => {
    try {
      const user = (req as any).user || (req as any).adminUser;
      const id = parseInt(req.params.id);

      const payout = await storage.getPayout(id);
      if (!payout) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "지급 기록을 찾을 수 없습니다" }
        });
      }

      if (payout.status !== "REQUESTED") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: `상태(${payout.status})가 REQUESTED가 아닙니다` }
        });
      }

      const updated = await storage.updatePayout(id, {
        status: "SENT",
        sentAt: new Date(),
      });

      await storage.createPayoutEvent({
        payoutId: id,
        previousStatus: "REQUESTED",
        newStatus: "SENT",
        reason: "송금 실행",
        actorId: user.id,
      });

      await logAdminAction({
        userId: user.id,
        action: "payout.sent",
        targetType: "payout",
        targetId: String(id),
        reason: "송금 실행 완료",
      });

      res.json({
        payout_id: String(id),
        status: "SENT",
        sent_at: updated?.sentAt,
      });
    } catch (err: any) {
      console.error("Payout sent error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 지급 상태 업데이트: SENT → SUCCEEDED (입금 확인됨) - 오더 상태 SETTLEMENT_PAID로 변경
  app.patch("/api/admin/payouts/:id/succeeded", adminAuth, requirePermission("settlements.pay"), async (req, res) => {
    try {
      const user = (req as any).user || (req as any).adminUser;
      const id = parseInt(req.params.id);

      const payout = await storage.getPayout(id);
      if (!payout) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "지급 기록을 찾을 수 없습니다" }
        });
      }

      if (payout.status !== "SENT") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: `상태(${payout.status})가 SENT가 아닙니다` }
        });
      }

      const updated = await storage.updatePayout(id, {
        status: "SUCCEEDED",
        succeededAt: new Date(),
      });

      await storage.createPayoutEvent({
        payoutId: id,
        previousStatus: "SENT",
        newStatus: "SUCCEEDED",
        reason: "입금 확인 완료",
        actorId: user.id,
      });

      // 정산서 조회 및 오더 상태 업데이트 (BALANCE_PAID → SETTLEMENT_PAID)
      const settlement = await storage.getSettlement(payout.settlementId!);
      if (settlement && settlement.orderId) {
        const order = await storage.getOrder(settlement.orderId);
        if (order && order.status === "balance_paid") {
          await storage.updateOrder(settlement.orderId, {
            status: "settlement_paid",
          });

          await storage.createOrderStatusEvent({
            orderId: settlement.orderId,
            previousStatus: "balance_paid",
            newStatus: "settlement_paid",
            reason: "헬퍼 정산 지급 완료",
            changedBy: user.id,
          });

          // 헬퍼에게 알림
          if (settlement.helperId) {
            await storage.createNotification({
              userId: settlement.helperId,
              type: "settlement" as any,
              title: "정산금 입금 완료",
              message: `정산금 ${Number(payout.amount).toLocaleString()}원이 입금되었습니다.`,
              data: JSON.stringify({ orderId: settlement.orderId, payoutId: id }),
            });
          }
        }
      }

      await logAdminAction({
        userId: user.id,
        action: "payout.succeeded",
        targetType: "payout",
        targetId: String(id),
        reason: "입금 확인 완료",
        metadata: { orderId: settlement?.orderId },
      });

      res.json({
        payout_id: String(id),
        status: "SUCCEEDED",
        succeeded_at: updated?.succeededAt,
        order_status: "settlement_paid",
      });
    } catch (err: any) {
      console.error("Payout succeeded error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 지급 상태 업데이트: SENT → FAILED (실패)
  app.patch("/api/admin/payouts/:id/failed", adminAuth, requirePermission("settlements.pay"), async (req, res) => {
    try {
      const user = (req as any).user || (req as any).adminUser;
      const id = parseInt(req.params.id);
      const { failure_code, failure_message } = req.body;

      const payout = await storage.getPayout(id);
      if (!payout) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "지급 기록을 찾을 수 없습니다" }
        });
      }

      if (payout.status !== "SENT" && payout.status !== "REQUESTED") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: `현재 상태(${payout.status})에서 실패 처리할 수 없습니다` }
        });
      }

      const previousStatus = payout.status;
      const updated = await storage.updatePayout(id, {
        status: "FAILED",
        failedAt: new Date(),
        failureCode: failure_code || "UNKNOWN",
        failureMessage: failure_message || "송금 실패",
      });

      await storage.createPayoutEvent({
        payoutId: id,
        previousStatus,
        newStatus: "FAILED",
        reason: failure_message || "송금 실패",
        actorId: user.id,
        metadata: JSON.stringify({ failure_code }),
      });

      await logAdminAction({
        userId: user.id,
        action: "payout.failed",
        targetType: "payout",
        targetId: String(id),
        reason: failure_message || "송금 실패",
        metadata: { failure_code },
      });

      res.json({
        payout_id: String(id),
        status: "FAILED",
        failed_at: updated?.failedAt,
        failure_code,
        failure_message,
      });
    } catch (err: any) {
      console.error("Payout failed error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 정산 지급 시도 관리
  app.get("/api/admin/settlements/:id/payout-attempts", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const attempts = await db.select()
        .from(settlementPayoutAttempts)
        .where(eq(settlementPayoutAttempts.settlementId, settlementId))
        .orderBy(desc(settlementPayoutAttempts.createdAt));
      res.json(attempts);
    } catch (err: any) {
      console.error("Get payout attempts error:", err);
      res.status(500).json({ message: "Failed to get payout attempts" });
    }
  });

  app.post("/api/admin/settlements/:id/retry-payout", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const actorId = (req as any).adminUser?.id;

      const [settlement] = await db.select().from(settlementStatements).where(eq(settlementStatements.id, settlementId));
      if (!settlement) {
        return res.status(404).json({ message: "Settlement not found" });
      }

      // 마지막 시도 조회
      const [lastAttempt] = await db.select()
        .from(settlementPayoutAttempts)
        .where(eq(settlementPayoutAttempts.settlementId, settlementId))
        .orderBy(desc(settlementPayoutAttempts.attemptNumber))
        .limit(1);

      const attemptNumber = lastAttempt ? (lastAttempt.attemptNumber || 1) + 1 : 1;

      // 헬퍼 계좌 정보 조회
      const [bankAccount] = await db.select()
        .from(helperBankAccounts)
        .where(eq(helperBankAccounts.userId, settlement.helperId));

      // 새 지급 시도 기록
      const [attempt] = await db.insert(settlementPayoutAttempts).values({
        settlementId,
        attemptNumber,
        amount: settlement.netAmount || 0,
        bankName: bankAccount?.bankName,
        accountNumber: maskAccountNumber(bankAccount?.accountNumber || ""),
        accountHolder: bankAccount?.accountHolder,
        status: "pending",
        processedBy: actorId,
      }).returning();

      // TODO: 실제 은행 API 연동 시 여기서 처리

      res.json(attempt);
    } catch (err: any) {
      console.error("Retry payout error:", err);
      res.status(500).json({ message: "Failed to retry payout" });
    }
  });

  // 오더 상태 강제 변경 API
  app.post("/api/admin/orders/:orderId/force-status", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const adminUser = (req as any).adminUser;
      const actorId = adminUser?.id;

      // Ensure this is an admin user, not a helper or requester
      if (!actorId || !adminUser) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      const { newStatus, reason, relatedIncidentId, affectedHelperId, forceOverride } = req.body;

      if (!newStatus || !reason) {
        return res.status(400).json({ message: "Status and reason are required" });
      }

      // Validate the target status is a valid ORDER_STATUS value
      if (!validateOrderStatus(newStatus)) {
        return res.status(400).json({
          message: `Invalid status: ${newStatus}. Valid values: ${Object.values(ORDER_STATUS).join(", ")}`
        });
      }

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const previousStatus = order.status || "unknown";

      // Validate state transition is allowed
      const isValidTransition = canTransitionOrderStatus(previousStatus, newStatus);

      if (!isValidTransition) {
        // Check if forceOverride is requested - requires orders.force_override permission
        if (!forceOverride) {
          return res.status(400).json({
            message: `Cannot transition from "${previousStatus}" to "${newStatus}". Use forceOverride if you have permission.`
          });
        }

        // Verify user has force_override permission via RBAC
        // Fail closed: if RBAC check fails or permissions are empty, deny access
        let hasForceOverridePermission = false;
        try {
          const userPermissions = await storage.getUserPermissions(actorId);
          hasForceOverridePermission = userPermissions.includes("orders.force_override");
        } catch (rbacErr) {
          console.error("[Force-Status] RBAC permission check failed:", rbacErr);
          // Fail closed: deny access if RBAC check fails
        }

        if (!hasForceOverridePermission) {
          return res.status(403).json({
            message: "forceOverride requires orders.force_override permission (SUPER_ADMIN only)"
          });
        }
      }

      // 오더 상태 변경
      const [updated] = await db.update(orders)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // Whether force override was actually used to bypass validation
      const wasOverrideUsed = forceOverride && !isValidTransition;

      // 강제 변경 로그 기록
      await db.insert(orderForceStatusLogs).values({
        orderId,
        previousStatus,
        newStatus,
        reason,
        actorId,
        actorRole: (req as any).adminUser?.role || "admin",
        forceOverrideUsed: wasOverrideUsed,
        relatedIncidentId,
        affectedHelperId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 알림 발송 (요청자 + 영향받는 헬퍼)
      const statusLabel = newStatus === "cancelled" ? "취소" : newStatus === "completed" ? "완료" : newStatus;
      const notifTitle = "오더 상태 변경";
      const notifMessage = `오더 #${orderId}의 상태가 관리자에 의해 "${statusLabel}"(으)로 변경되었습니다.`;

      // 요청자 알림
      if (order.requesterId) {
        try {
          await storage.createNotification({
            userId: order.requesterId,
            type: "order_status_changed",
            title: notifTitle,
            message: notifMessage,
            relatedId: orderId,
          });
          sendPushToUser(order.requesterId, {
            title: notifTitle,
            body: notifMessage,
            url: `/orders/${orderId}`,
            tag: "order_status_changed",
          });
          notificationWS.sendOrderStatusUpdate(order.requesterId, {
            orderId,
            status: newStatus,
            previousStatus,
          });
        } catch (notifErr) {
          console.error("[Force-Status] Requester notification error:", notifErr);
        }
      }

      // 영향받는 헬퍼 알림
      if (affectedHelperId) {
        try {
          await storage.createNotification({
            userId: affectedHelperId,
            type: "order_status_changed",
            title: notifTitle,
            message: notifMessage,
            relatedId: orderId,
          });
          sendPushToUser(affectedHelperId, {
            title: notifTitle,
            body: notifMessage,
            url: `/orders/${orderId}`,
            tag: "order_status_changed",
          });
          notificationWS.sendOrderStatusUpdate(affectedHelperId, {
            orderId,
            status: newStatus,
            previousStatus,
          });
        } catch (notifErr) {
          console.error("[Force-Status] Helper notification error:", notifErr);
        }
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Force status change error:", err);
      res.status(500).json({ message: "Failed to force status change" });
    }
  });

  // 오더 상태 강제 변경 이력 조회
  app.get("/api/admin/orders/:orderId/force-status-logs", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const logs = await db.select()
        .from(orderForceStatusLogs)
        .where(eq(orderForceStatusLogs.orderId, orderId))
        .orderBy(desc(orderForceStatusLogs.createdAt));
      res.json(logs);
    } catch (err: any) {
      console.error("Get force status logs error:", err);
      res.status(500).json({ message: "Failed to get force status logs" });
    }
  });

  // ============================================
  // Admin: 데이터 무결성 진단 & 복구 API
  // ============================================

  // GET /api/admin/data-integrity/orphaned-orders - 마감 보고서 없는 post-closing 오더 목록
  app.get("/api/admin/data-integrity/orphaned-orders", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const postClosingStatuses = ['closing_submitted', 'final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'];
      const allOrders2 = await db.select({
        id: orders.id,
        status: orders.status,
        matchedHelperId: orders.matchedHelperId,
        companyName: orders.companyName,
        scheduledDate: orders.scheduledDate,
        createdAt: orders.createdAt,
      }).from(orders);

      const postClosingOrders2 = allOrders2.filter(o => postClosingStatuses.includes(o.status || ''));
      const postClosingIds = postClosingOrders2.map(o => o.id);

      if (postClosingIds.length === 0) {
        return res.json({ orphanedOrders: [], total: 0 });
      }

      const existingReports2 = await db.select({ orderId: closingReports.orderId })
        .from(closingReports)
        .where(inArray(closingReports.orderId, postClosingIds));
      const reportOrderIds2 = new Set(existingReports2.map(r => r.orderId));

      const orphaned2 = postClosingOrders2.filter(o => !reportOrderIds2.has(o.id)).map(o => ({
        orderId: o.id,
        status: o.status,
        matchedHelperId: o.matchedHelperId,
        companyName: o.companyName,
        scheduledDate: o.scheduledDate,
        createdAt: o.createdAt,
      }));

      res.json({ orphanedOrders: orphaned2, total: orphaned2.length });
    } catch (err: any) {
      console.error("Orphaned orders check error:", err);
      res.status(500).json({ message: "데이터 무결성 체크 실패" });
    }
  });

  // POST /api/admin/data-integrity/reset-to-in-progress - 마감 보고서 없는 오더를 in_progress로 복구
  app.post("/api/admin/data-integrity/reset-to-in-progress", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const { orderIds } = req.body;
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "orderIds 배열이 필요합니다" });
      }

      const adminUser = (req as any).adminUser;
      const results: any[] = [];

      for (const orderId of orderIds) {
        const order = await storage.getOrder(orderId);
        if (!order) {
          results.push({ orderId, success: false, reason: "오더를 찾을 수 없음" });
          continue;
        }

        // closing report 존재 여부 확인
        const [existingReport] = await db.select({ id: closingReports.id })
          .from(closingReports)
          .where(eq(closingReports.orderId, orderId))
          .limit(1);

        if (existingReport) {
          results.push({ orderId, success: false, reason: "마감 보고서가 이미 존재함" });
          continue;
        }

        // in_progress로 복구 (헬퍼가 마감을 다시 제출할 수 있도록)
        await db.update(orders)
          .set({ status: "in_progress", updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        // 강제 상태 변경 로그
        await db.insert(orderForceStatusLogs).values({
          orderId,
          previousStatus: order.status,
          newStatus: "in_progress",
          reason: "데이터 무결성 복구: closing report 없이 post-closing 상태여서 in_progress로 리셋",
          changedBy: adminUser?.id || "system",
        });

        results.push({ orderId, success: true, previousStatus: order.status });
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[Integrity Recovery] Admin reset ${successCount}/${orderIds.length} orders to in_progress`);

      res.json({ results, successCount, totalRequested: orderIds.length });
    } catch (err: any) {
      console.error("Reset to in_progress error:", err);
      res.status(500).json({ message: "오더 복구 실패" });
    }
  });

  // ============================================
  // Admin: 헬퍼 노출 진단 API
  // ============================================

  // 헬퍼 노출 진단 API - 오더가 헬퍼에게 왜 안 보이는지 진단
  app.post("/api/admin/orders/:orderId/diagnose-helper-visibility", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { helper_user_id, include_filters } = req.body;

      const reasonCodes: string[] = [];
      const actionSuggestions: { reason_code: string; suggestion: string }[] = [];
      const snapshot: Record<string, any> = {};

      const addReason = (code: string, suggestion: string) => {
        reasonCodes.push(code);
        actionSuggestions.push({ reason_code: code, suggestion });
      };

      // 1. 오더 조회
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.json({
          order_id: orderId,
          is_visible: false,
          reason_codes: ["ORDER_NOT_FOUND"],
          action_suggestions: [{ reason_code: "ORDER_NOT_FOUND", suggestion: "오더가 존재하지 않습니다. 오더 생성 API/DB 저장 경로를 점검하세요." }],
          snapshot: {},
        });
      }

      snapshot.job_status = order.status;
      snapshot.selected_helper_user_id = order.matchedHelperId || null;
      snapshot.payment_status = order.paymentStatus;

      // 2. 오더 상태 점검 (표준: open만 허용)
      if (order.status !== "open") {
        addReason("JOB_STATUS_NOT_OPEN", `오더 상태가 '${order.status}'입니다. OPEN 상태여야 헬퍼에게 노출됩니다.`);
      }

      // 3. 이미 기사 선택됨
      if (order.matchedHelperId) {
        addReason("ORDER_ALREADY_SELECTED", "이미 기사가 선택되었습니다. 다른 헬퍼에게는 정상적으로 숨김 처리됩니다.");
      }

      // 4. 취소/만료/마감 상태 확인
      if (["closed", "cancelled", "expired"].includes(order.status)) {
        addReason("ORDER_NOT_ACTIVE", `오더가 '${order.status}' 상태입니다. 정상적으로 숨김 처리됩니다.`);
      }

      // 5. 후보 수 확인 (3명 제한)
      try {
        const activeCandidates = await storage.getActiveOrderCandidates(orderId);
        snapshot.active_candidate_count = activeCandidates.length;
        snapshot.candidate_limit = 3;

        if (activeCandidates.length >= 3) {
          addReason("CANDIDATE_LIMIT_REACHED", "후보가 3명 이상 지원했습니다. 더 이상 헬퍼에게 노출되지 않습니다 (정상 동작).");
        }
      } catch (candidateErr) {
        console.error("Candidate count query error:", candidateErr);
        addReason("CANDIDATE_COUNT_QUERY_ERROR", "후보 수 집계 중 오류가 발생했습니다. 쿼리/인덱스를 점검하세요.");
        snapshot.candidate_query_error = true;
      }

      // 6. 계약금 결제 확인
      const depositRequired = order.paymentStatus === "awaiting_deposit" || order.status === "awaiting_deposit";
      snapshot.deposit_required = depositRequired;

      if (depositRequired || order.status === "awaiting_deposit") {
        // 결제 레코드 확인
        const depositPayments = await db.select()
          .from(payments)
          .where(and(
            eq(payments.orderId, orderId),
            eq(payments.paymentType, "deposit")
          ))
          .limit(1);

        if (depositPayments.length === 0) {
          addReason("DEPOSIT_REQUIRED_BUT_MISSING", "계약금이 필수인데 결제 레코드가 없습니다. 결제 생성 로직을 점검하세요.");
          snapshot.deposit_payment_record = null;
        } else {
          const depositPayment = depositPayments[0];
          snapshot.deposit_payment_record = {
            id: depositPayment.id,
            status: depositPayment.status,
            amount: depositPayment.amount,
          };

          // 결제 상태 확인
          if (depositPayment.status !== "captured" && depositPayment.status !== "completed") {
            addReason("DEPOSIT_NOT_CONFIRMED", `계약금 결제 상태가 '${depositPayment.status}'입니다. 결제 확정(captured/completed)이 필요합니다.`);
          }

          // 금액 불일치 확인
          if (order.depositAmount && depositPayment.amount !== order.depositAmount) {
            addReason("PAYMENT_AMOUNT_MISMATCH", `결제 금액(${depositPayment.amount})이 예상 계약금(${order.depositAmount})과 불일치합니다. 위변조 또는 오더 금액 재산정이 필요합니다.`);
            snapshot.payment_amount_mismatch = {
              expected: order.depositAmount,
              actual: depositPayment.amount,
            };
          }
        }

        // 웹훅 로그 확인
        const recentWebhooks = await db.select()
          .from(webhookLogs)
          .where(and(
            eq(webhookLogs.relatedEntityType, "order"),
            eq(webhookLogs.relatedEntityId, String(orderId))
          ))
          .orderBy(desc(webhookLogs.createdAt))
          .limit(1);

        if (recentWebhooks.length > 0) {
          const lastWebhook = recentWebhooks[0];
          snapshot.webhook_last_status = lastWebhook.status;

          if (lastWebhook.status === "failed") {
            addReason("WEBHOOK_FAILED", "웹훅 처리가 실패했습니다. [웹훅 재처리] 버튼을 눌러 재처리하세요.");
          }
        }
      }

      snapshot.deposit_payment_status = order.paymentStatus;

      // 7. 필터 조건 (지역/차량/택배사)
      if (include_filters) {
        snapshot.filters = {
          region_code: order.region || null,
          vehicle_type: order.vehicleType || null,
          carrier_id: order.courierCompany || null,
        };
      }

      // 8. 특정 헬퍼 진단 (helper_user_id가 제공된 경우)
      if (helper_user_id) {
        const helper = await storage.getUser(helper_user_id);

        if (!helper) {
          addReason("HELPER_NOT_FOUND", "해당 헬퍼를 찾을 수 없습니다. 계정 정보를 확인하세요.");
        } else {
          const helperContext: Record<string, any> = {
            helper_user_id: helper.id,
            helper_status: helper.status || "active",
            is_filtered_out: false,
            filtered_out_reasons: [] as string[],
          };

          // 헬퍼 계정 상태 확인
          if (helper.status !== "active") {
            addReason("HELPER_NOT_ACTIVE", `헬퍼 계정 상태가 '${helper.status}'입니다. ACTIVE 상태여야 지원 가능합니다.`);
            helperContext.is_filtered_out = true;
            helperContext.filtered_out_reasons.push("HELPER_NOT_ACTIVE");
          }

          // 헬퍼 차량 정보
          const helperVehicle = await storage.getHelperVehicle(helper_user_id);
          if (helperVehicle) {
            helperContext.helper_vehicle_type = helperVehicle.vehicleType;

            // 차량 타입 매칭 확인
            if (order.vehicleType && helperVehicle.vehicleType !== order.vehicleType) {
              addReason("VEHICLE_MISMATCH", `헬퍼 차량 타입(${helperVehicle.vehicleType})이 오더 요구 차량(${order.vehicleType})과 일치하지 않습니다.`);
              helperContext.is_filtered_out = true;
              helperContext.filtered_out_reasons.push("VEHICLE_MISMATCH");
            }
          }

          // 헬퍼 서비스 지역 확인
          const helperAreas = await storage.getHelperServiceAreas(helper_user_id);
          if (helperAreas.length > 0) {
            helperContext.helper_region_codes = helperAreas.map(a => a.region);

            if (order.region && !helperAreas.some(a => a.region === order.region)) {
              addReason("REGION_MISMATCH", `헬퍼 서비스 지역에 오더 지역(${order.region})이 포함되지 않습니다.`);
              helperContext.is_filtered_out = true;
              helperContext.filtered_out_reasons.push("REGION_MISMATCH");
            }
          }

          // 헬퍼 서류 승인 상태 확인
          const helperLicense = await storage.getHelperLicense(helper_user_id);
          if (helperLicense) {
            helperContext.helper_docs_approved = helperLicense.status === "approved";

            if (helperLicense.status !== "approved") {
              addReason("HELPER_DOCS_NOT_APPROVED", `헬퍼 서류가 미승인 상태입니다 (상태: ${helperLicense.status}). 서류 승인이 필요합니다.`);
              helperContext.is_filtered_out = true;
              helperContext.filtered_out_reasons.push("HELPER_DOCS_NOT_APPROVED");
            }
          }

          // 이미 지원했는지 확인
          const existingCandidate = await storage.getOrderCandidate(orderId, helper_user_id);
          if (existingCandidate) {
            addReason("HELPER_ALREADY_APPLIED", `헬퍼가 이미 지원했습니다 (상태: ${existingCandidate.status}). 리스트에는 표시되며 '지원함' 표기됩니다.`);
            helperContext.my_candidate_status = existingCandidate.status;
          }

          snapshot.helper_context = helperContext;
        }
      }

      const isVisible = reasonCodes.length === 0;

      res.json({
        order_id: orderId,
        is_visible: isVisible,
        reason_codes: reasonCodes,
        action_suggestions: actionSuggestions,
        snapshot,
      });
    } catch (err: any) {
      console.error("Diagnose helper visibility error:", err);
      res.status(500).json({ message: "Failed to diagnose helper visibility" });
    }
  });

  // ============================================
  // Admin: 오더 기준 웹훅 재처리
  // ============================================
  app.post("/api/admin/orders/:orderId/retry-webhook", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const user = (req as any).adminUser || (req as any).user;
      const orderId = parseInt(req.params.orderId);
      const { reason } = req.body;

      if (!reason || reason.length < 10) {
        return res.status(400).json({
          error: { code: "INVALID_REASON", message: "사유는 최소 10자 이상이어야 합니다" }
        });
      }

      // 해당 오더의 최신 실패 웹훅 찾기
      const failedWebhooks = await db.select()
        .from(webhookLogs)
        .where(and(
          eq(webhookLogs.relatedEntityType, "order"),
          eq(webhookLogs.relatedEntityId, String(orderId)),
          eq(webhookLogs.status, "failed")
        ))
        .orderBy(desc(webhookLogs.createdAt))
        .limit(1);

      if (failedWebhooks.length === 0) {
        return res.status(404).json({
          error: { code: "NO_FAILED_WEBHOOK", message: "재처리할 실패 웹훅이 없습니다" }
        });
      }

      const webhook = failedWebhooks[0];
      const retryCount = (webhook.retryCount || 0) + 1;

      // 웹훅 재처리 시도
      try {
        await storage.updateWebhookLog(webhook.id, {
          status: "processed",
          processedAt: new Date(),
          retryCount,
        });

        // 결제 웹훅인 경우 오더 상태 업데이트
        if (webhook.eventType?.includes("payment") || webhook.eventType?.includes("deposit")) {
          await storage.updateOrder(orderId, {
            paymentStatus: "deposit_paid",
            status: ORDER_STATUS.OPEN,
          });
        }

        // 감사 로그 기록
        await logAdminAction({
          userId: user.id,
          action: "order_webhook_retry",
          targetType: "order",
          targetId: String(orderId),
          reason,
          metadata: {
            webhook_id: webhook.id,
            retry_count: retryCount,
            result: "PROCESSED",
          },
        });

        res.json({
          success: true,
          webhook_log_id: webhook.id,
          status: "PROCESSED",
          retry_count: retryCount,
        });
      } catch (processingError: any) {
        await storage.updateWebhookLog(webhook.id, {
          status: "failed",
          errorMessage: processingError.message || "재처리 중 오류 발생",
          retryCount,
        });

        res.status(500).json({
          error: { code: "RETRY_FAILED", message: "웹훅 재처리 실패" }
        });
      }
    } catch (err: any) {
      console.error("Order webhook retry error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Admin: 새 운영 체계 APIs
  // ============================================

  // 관리자용 후보 목록 조회
  app.get("/api/admin/orders/:orderId/candidates", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const candidates = await storage.getOrderCandidates(orderId);

      const enrichedCandidates = await Promise.all(
        candidates.map(async (c) => {
          const helper = await storage.getUser(c.helperUserId);
          const ratingSummary = await storage.getHelperRatingSummary(c.helperUserId);
          const helperVehicle = await storage.getHelperVehicle(c.helperUserId);

          return {
            ...c,
            helper: helper ? {
              id: helper.id,
              name: helper.name,
              phone: c.status === "selected" ? helper.phoneNumber : null,
              profilePhoto: helper.profilePhoto,
            } : null,
            ratingSummary: ratingSummary ? {
              avgRating: ratingSummary.avgRating,
              totalCompleted: ratingSummary.totalCompleted,
              noShowCount: ratingSummary.noShowCount,
            } : null,
            vehicle: helperVehicle ? {
              type: helperVehicle.vehicleType,
              carModel: helperVehicle.carModel,
            } : null,
          };
        })
      );

      res.json({
        orderId,
        totalCandidates: candidates.length,
        maxCandidates: 3,
        candidates: enrichedCandidates,
      });
    } catch (err: any) {
      console.error("Admin get candidates error:", err);
      res.status(500).json({ message: "Failed to get candidates" });
    }
  });

  // 관리자용 후보 선택
  app.post("/api/admin/orders/:orderId/candidates/:candidateId/select", adminAuth, requirePermission("orders.manage"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const candidateId = parseInt(req.params.candidateId);
      const actorId = (req as any).adminUser?.id;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const candidates = await storage.getOrderCandidates(orderId);
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      if (candidate.status === "selected") {
        return res.status(400).json({ message: "Already selected" });
      }

      const updatedCandidate = await storage.updateOrderCandidate(candidateId, {
        status: "selected",
        selectedAt: new Date(),
      });

      const helper = await storage.getUser(candidate.helperUserId);

      await storage.createContactShareEvent({
        orderId,
        candidateId,
        helperUserId: candidate.helperUserId,
        requesterUserId: order.requesterId || actorId,
        sharedPhone: helper?.phone || null,
        sharedAt: new Date(),
      });

      await storage.updateOrder(orderId, {
        status: "scheduled",
        matchedHelperId: candidate.helperUserId,
      });

      await storage.createOrderStatusEvent({
        orderId,
        previousStatus: "open",
        newStatus: "scheduled",
        reason: "관리자가 헬퍼 선택",
        changedBy: actorId,
      });

      for (const c of candidates) {
        if (c.id !== candidateId && c.status === "applied") {
          await storage.updateOrderCandidate(c.id, {
            status: "rejected",
            rejectedAt: new Date(),
          });
        }
      }

      res.json({
        success: true,
        candidate: updatedCandidate,
        helper: helper ? {
          id: helper.id,
          name: helper.name,
          phone: helper.phoneNumber,
        } : null,
      });
    } catch (err: any) {
      console.error("Admin select candidate error:", err);
      res.status(500).json({ message: "Failed to select candidate" });
    }
  });

  // 관리자용 마감 보고서 조회
  app.get("/api/admin/orders/:orderId/closure-report", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const report = await storage.getOrderClosureReport(orderId);
      res.json(report || null);
    } catch (err: any) {
      console.error("Admin get closure report error:", err);
      res.status(500).json({ message: "Failed to get closure report" });
    }
  });

  // 관리자용 마감 보고서 승인 (CLOSING_SUBMITTED → FINAL_AMOUNT_CONFIRMED)
  app.post("/api/admin/orders/:orderId/closure-report/approve", adminAuth, requirePermission("orders.manage"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const adminUser = req.user!;
      const { finalAmount, memo } = req.body;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.status !== "closing_submitted") {
        return res.status(400).json({
          message: `마감자료 승인은 closing_submitted 상태에서만 가능합니다 (현재: ${order.status})`
        });
      }

      // 마감 보고서 조회
      const closureReport = await storage.getOrderClosureReport(orderId);
      if (!closureReport) {
        return res.status(404).json({ message: "마감 보고서를 찾을 수 없습니다" });
      }

      // 마감 보고서 승인 처리
      await db.update(closingReports)
        .set({
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: adminUser.id,
          calculatedAmount: finalAmount || closureReport.calculatedAmount,
          updatedAt: new Date(),
        })
        .where(eq(closingReports.orderId, orderId));

      // 오더 상태 변경: CLOSING_SUBMITTED → FINAL_AMOUNT_CONFIRMED
      await storage.updateOrder(orderId, {
        status: "final_amount_confirmed",
      });

      // 계약 업데이트: 최종 금액 반영
      const orderContracts = await storage.getOrderContracts(orderId);
      if (orderContracts.length > 0) {
        const contract = orderContracts[0];
        const confirmedFinalAmount = finalAmount || closureReport.calculatedAmount || contract.totalAmount;
        const calculatedBalance = confirmedFinalAmount - (contract.downPaymentAmount || contract.depositAmount);

        await db.update(contracts)
          .set({
            finalAmount: confirmedFinalAmount,
            finalAmountConfirmedAt: new Date(),
            calculatedBalanceAmount: calculatedBalance,
          })
          .where(eq(contracts.id, contract.id));
      }

      // 이벤트 로깅
      await db.insert(orderStatusEvents).values({
        orderId,
        fromStatus: "closing_submitted",
        toStatus: "final_amount_confirmed",
        reason: memo || "관리자 마감자료 승인",
        changedBy: adminUser.id,
      });

      res.json({
        success: true,
        message: "마감자료가 승인되었습니다",
        order: { id: orderId, status: "final_amount_confirmed" },
      });
    } catch (err: any) {
      console.error("Admin approve closure report error:", err);
      res.status(500).json({ message: "마감자료 승인에 실패했습니다" });
    }
  });

  // 관리자용 마감 보고서 반려 (CLOSING_SUBMITTED → IN_PROGRESS)
  app.post("/api/admin/orders/:orderId/closure-report/reject", adminAuth, requirePermission("orders.manage"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const adminUser = req.user!;
      const { reason } = req.body;

      if (!reason || reason.trim() === "") {
        return res.status(400).json({ message: "반려 사유를 입력해주세요" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.status !== "closing_submitted") {
        return res.status(400).json({
          message: `마감자료 반려는 closing_submitted 상태에서만 가능합니다 (현재: ${order.status})`
        });
      }

      // 마감 보고서 반려 처리
      await db.update(closingReports)
        .set({
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: adminUser.id,
          rejectReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(closingReports.orderId, orderId));

      // 오더 상태 변경: CLOSING_SUBMITTED → IN_PROGRESS (재제출 가능하도록)
      await storage.updateOrder(orderId, {
        status: "in_progress",
      });

      // 이벤트 로깅
      await db.insert(orderStatusEvents).values({
        orderId,
        fromStatus: "closing_submitted",
        toStatus: "in_progress",
        reason: `마감자료 반려: ${reason}`,
        changedBy: adminUser.id,
      });

      res.json({
        success: true,
        message: "마감자료가 반려되었습니다",
        order: { id: orderId, status: "in_progress" },
      });
    } catch (err: any) {
      console.error("Admin reject closure report error:", err);
      res.status(500).json({ message: "마감자료 반려에 실패했습니다" });
    }
  });

  // 관리자용 증빙 목록 조회
  app.get("/api/admin/orders/:orderId/proofs", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const proofs = await storage.getOrderCarrierProofs(orderId);
      res.json(proofs);
    } catch (err: any) {
      console.error("Admin get proofs error:", err);
      res.status(500).json({ message: "Failed to get proofs" });
    }
  });

  // 관리자용 정산 요약 조회
  app.get("/api/admin/orders/:orderId/settlement-summary", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const pricingSnapshot = await storage.getOrderPricingSnapshot(orderId);
      const costItems = await storage.getOrderCostItems(orderId);
      const balanceInvoice = await storage.getOrderBalanceInvoice(orderId);
      const closureReport = await storage.getOrderClosureReport(orderId);

      const commissionRate = 0.05;
      const baseAmount = pricingSnapshot ? Number(pricingSnapshot.baseAmountKrw) : 0;
      const commissionAmount = Math.round(baseAmount * commissionRate);
      const helperPayout = baseAmount - commissionAmount;

      res.json({
        orderId,
        orderStatus: order.status,
        pricing: pricingSnapshot ? {
          baseAmount: Number(pricingSnapshot.baseAmountKrw),
          additionalCosts: Number(pricingSnapshot.additionalCostsKrw),
          vat: Number(pricingSnapshot.vatKrw),
          totalWithVat: Number(pricingSnapshot.totalWithVatKrw),
          deposit: Number(pricingSnapshot.depositKrw),
          balance: Number(pricingSnapshot.balanceKrw),
        } : null,
        costItems: costItems.map(item => ({
          id: item.id,
          label: item.label,
          amount: Number(item.amount),
        })),
        balanceInvoice: balanceInvoice ? {
          id: balanceInvoice.id,
          amount: Number(balanceInvoice.amount),
          status: balanceInvoice.status,
          issuedAt: balanceInvoice.issuedAt,
          paidAt: balanceInvoice.paidAt,
        } : null,
        closureReport: closureReport ? {
          actualDeliveryCount: closureReport.actualDeliveryCount,
          anomalyFlag: closureReport.anomalyFlag,
          submittedAt: closureReport.submittedAt,
          approvedAt: closureReport.approvedAt,
        } : null,
        helperSettlement: {
          grossAmount: baseAmount,
          commissionRate,
          commissionAmount,
          netPayout: helperPayout,
        },
      });
    } catch (err: any) {
      console.error("Admin get settlement summary error:", err);
      res.status(500).json({ message: "Failed to get settlement summary" });
    }
  });

  // 관리자용 재정산
  app.post("/api/admin/orders/:orderId/reprice", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const actorId = (req as any).adminUser?.id;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const costItems = await storage.getOrderCostItems(orderId);
      const costPlusItems = costItems.filter(item => item.type === 'add' || item.type === 'plus');
      const costMinusItems = costItems.filter(item => item.type === 'subtract' || item.type === 'minus');
      const costPlusTotal = costPlusItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const costMinusTotal = costMinusItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const qty = parseInt(String(order.averageQuantity || 0)) || 0;
      const baseSupplyAmount = Number(order.pricePerUnit || 0) * qty + costPlusTotal - costMinusTotal;
      const vatAmount = calculateVat(baseSupplyAmount);
      const grossAmount = baseSupplyAmount + vatAmount;
      const depRate = await getDepositRate();
      const depositAmount = Math.round(grossAmount * (depRate / 100));
      const balanceAmount = grossAmount - depositAmount;

      const snapshot = await storage.createPricingSnapshot({
        orderId,
        baseSupplyAmount,
        vatAmount,
        grossAmount,
        depositAmount,
        balanceAmount,
        costPlusTotal,
        costMinusTotal,
      });

      res.json({
        success: true,
        snapshot,
        breakdown: {
          baseSupplyAmount,
          costPlusTotal,
          costMinusTotal,
          vatAmount,
          grossAmount,
          depositAmount,
          balanceAmount,
        },
      });
    } catch (err: any) {
      console.error("Admin reprice error:", err);
      res.status(500).json({ message: "Failed to reprice" });
    }
  });

  // T-11: POST /api/admin/orders/:orderId/settle - 관리자 정산 확정
  app.post("/api/admin/orders/:orderId/settle", adminAuth, requirePermission("settlements.create"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const adminUser = (req as any).adminUser;
      const { commissionRate, deductions, memo } = req.body;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" } });
      }

      // balance_paid 상태에서만 정산 가능
      if (order.status !== "balance_paid" && order.status !== "final_amount_confirmed") {
        return res.status(400).json({
          error: {
            code: "INVALID_STATUS",
            message: `현재 상태(${order.status})에서는 정산을 진행할 수 없습니다. 잔금 확인 후 정산이 가능합니다.`
          }
        });
      }

      // 계약 조회
      const contracts = await storage.getOrderContracts(orderId);
      const contract = contracts[0];
      if (!contract) {
        return res.status(400).json({ error: { code: "NO_CONTRACT", message: "계약 정보가 없습니다" } });
      }

      // 정산금액 계산
      const finalAmount = contract.finalAmount || contract.totalAmount || 0;
      const rate = commissionRate || 0.03; // 기본 3% 수수료
      const commissionAmount = Math.floor(Number(finalAmount) * rate);
      const deductionAmount = deductions?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0;
      const helperPayoutAmount = Number(finalAmount) - commissionAmount - deductionAmount;

      // Settlement 생성
      const settlement = await storage.createSettlement({
        orderId,
        helperId: contract.helperId || order.matchedHelperId || "",
        requesterId: order.requesterId || "",
        finalAmount: Number(finalAmount),
        platformFeeAmount: commissionAmount,
        deductionAmount,
        helperPayoutAmount,
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedBy: adminUser?.id,
      });

      // 오더 상태 변경
      await storage.updateOrder(orderId, { status: "settlement_paid" });

      // 계약 상태 업데이트
      await storage.updateContract(contract.id, {
        status: "completed",
      });

      // 오더 상태 이벤트 기록
      await storage.createOrderStatusEvent({
        orderId,
        previousStatus: order.status ?? "balance_paid",
        newStatus: "settlement_paid",
        reason: memo || "관리자 정산 확정",
        triggerType: "settled",
        triggeredBy: adminUser?.id,
      });

      // 감사 로그
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "ORDER_SETTLED",
        orderId,
        targetType: "order",
        targetId: String(orderId),
        reason: memo || "관리자 정산 확정",
        newValue: JSON.stringify({
          finalAmount,
          commissionAmount,
          deductionAmount,
          helperPayoutAmount,
          settlementId: settlement.id
        }),
      });

      // 헬퍼에게 알림
      if (contract.helperId || order.matchedHelperId) {
        await storage.createNotification({
          userId: contract.helperId || order.matchedHelperId || "",
          type: "matching_success",
          title: "정산 완료",
          message: `${order.companyName} 오더의 정산이 완료되었습니다. 지급 예정액: ${helperPayoutAmount.toLocaleString()}원`,
          relatedId: orderId,
        });
      }

      res.json({
        ok: true,
        orderId: order.orderNumber || `O-${orderId}`,
        status: "settlement_paid",
        settlement: {
          id: settlement.id,
          finalAmount: Number(finalAmount),
          commissionAmount,
          deductionAmount,
          helperPayoutAmount,
        },
        message: "정산이 완료되었습니다",
      });
    } catch (err: any) {
      console.error("Admin settle error:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "정산 처리에 실패했습니다" } });
    }
  });

  // 관리자용 잔여금 청구서 발행
  app.post("/api/admin/orders/:orderId/balance-invoice", adminAuth, requirePermission("settlements.create"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const actorId = (req as any).adminUser?.id;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!["closed", "settlement_paid"].includes(order.status ?? "")) {
        return res.status(400).json({ message: "Order must be closed to issue balance invoice" });
      }

      const snapshot = await storage.getOrderPricingSnapshot(orderId);
      if (!snapshot) {
        return res.status(400).json({ message: "Please reprice the order first" });
      }

      const existingInvoice = await storage.getOrderBalanceInvoice(orderId);
      if (existingInvoice) {
        return res.status(400).json({ message: "Balance invoice already exists" });
      }

      const invoice = await storage.createBalanceInvoice({
        orderId,
        pricingSnapshotId: snapshot.id,
        balanceAmountKrw: snapshot.balanceKrw,
        status: "pending",
        issuedAt: new Date(),
        issuedBy: actorId,
      });

      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Admin create balance invoice error:", err);
      res.status(500).json({ message: "Failed to create balance invoice" });
    }
  });

  // 관리자용 잔여금 결제 확인
  app.patch("/api/admin/orders/:orderId/balance-invoice/paid", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const actorId = (req as any).adminUser?.id;

      const invoice = await storage.getOrderBalanceInvoice(orderId);
      if (!invoice) {
        return res.status(404).json({ message: "Balance invoice not found" });
      }

      if (invoice.status !== "pending") {
        return res.status(400).json({ message: "Invoice already processed" });
      }

      const updated = await storage.updateBalanceInvoice(invoice.id, {
        status: "paid",
        paidAt: new Date(),
      });

      const order = await storage.getOrder(orderId);
      if (order) {
        await storage.updateOrder(orderId, { status: "balance_paid" });
        await storage.createOrderStatusEvent({
          orderId,
          previousStatus: order.status,
          newStatus: "balance_paid",
          reason: "잔여금 결제 완료 (관리자 확인)",
          changedBy: actorId,
        });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Admin confirm payment error:", err);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // 관리자용 마감 보고서 목록 조회
  // GET /api/admin/closure-reports - 관리자용 마감자료 목록 (closingReports 테이블 사용)
  app.get("/api/admin/closure-reports", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const reports = await db.select({
        id: closingReports.id,
        orderId: closingReports.orderId,
        helperId: closingReports.helperId,
        deliveredCount: closingReports.deliveredCount,
        returnedCount: closingReports.returnedCount,
        etcCount: closingReports.etcCount,
        etcPricePerUnit: closingReports.etcPricePerUnit,
        extraCostsJson: closingReports.extraCostsJson,
        deliveryHistoryImagesJson: closingReports.deliveryHistoryImagesJson,
        etcImagesJson: closingReports.etcImagesJson,
        memo: closingReports.memo,
        status: closingReports.status,
        calculatedAmount: closingReports.calculatedAmount,
        supplyAmount: closingReports.supplyAmount,
        vatAmount: closingReports.vatAmount,
        totalAmount: closingReports.totalAmount,
        reviewedAt: closingReports.reviewedAt,
        reviewedBy: closingReports.reviewedBy,
        rejectReason: closingReports.rejectReason,
        createdAt: closingReports.createdAt,
      })
        .from(closingReports)
        .orderBy(desc(closingReports.createdAt))
        .limit(200);

      const enrichedReports = await Promise.all(reports.map(async (report) => {
        const order = await storage.getOrder(report.orderId);
        const helper = await storage.getUser(report.helperId);

        const extraCosts = report.extraCostsJson ? JSON.parse(report.extraCostsJson) : [];

        return {
          id: report.id,
          orderId: report.orderId,
          helperName: helper?.name || "알 수 없음",
          deliveredCount: report.deliveredCount,
          returnedCount: report.returnedCount,
          etcCount: report.etcCount || 0,
          etcPricePerUnit: report.etcPricePerUnit || 0,
          actualDeliveryCount: (report.deliveredCount || 0) + (report.returnedCount || 0),
          extraCosts,
          memo: report.memo,
          status: report.status,
          calculatedAmount: report.calculatedAmount,
          submittedAt: report.createdAt,
          approvedAt: report.reviewedAt,
          confirmedAt: report.reviewedAt,
          confirmedBy: report.reviewedBy,
          rejectionReason: report.rejectReason,
          anomalyFlag: false,
          anomalyDetail: null,
          order: order ? {
            boxCount: order.averageQuantity,
            totalAmount: order.totalAmount,
            requesterName: order.requesterName,
          } : null,
          pricing: {
            // closing report DB에 저장된 SSOT 값 사용
            supplyAmount: report.supplyAmount || Math.round((report.calculatedAmount || 0) / 1.1),
            additionalCosts: extraCosts.reduce((sum: number, c: any) => sum + (c.amount || c.unitPriceSupply || 0), 0),
            vat: report.vatAmount || calculateVat(report.supplyAmount || Math.round((report.calculatedAmount || 0) / 1.1)),
            totalWithVat: report.totalAmount || report.calculatedAmount || 0,
            baseAmount: report.calculatedAmount || 0,
            deposit: 0,
            balance: 0,
          },
        };
      }));

      res.json(enrichedReports);
    } catch (err: any) {
      console.error("Admin get closure reports error:", err);
      res.status(500).json({ message: "Failed to get closure reports" });
    }
  });

  // 관리자용 마감 보고서 승인
  // PATCH /api/admin/closure-reports/:reportId/approve - 마감자료 승인 (closingReports 사용)
  app.patch("/api/admin/closure-reports/:reportId/approve", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const reportId = parseInt(req.params.reportId);
      const actorId = (req as any).adminUser?.id;

      const [report] = await db.select().from(closingReports).where(eq(closingReports.id, reportId));
      if (!report) {
        return res.status(404).json({ message: "마감자료를 찾을 수 없습니다" });
      }

      if (report.status !== "submitted") {
        return res.status(400).json({ message: "이미 처리된 마감자료입니다" });
      }

      const [updated] = await db.update(closingReports)
        .set({
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: actorId,
        })
        .where(eq(closingReports.id, reportId))
        .returning();

      // 오더 상태 업데이트
      await storage.updateOrder(report.orderId, { status: "final_amount_confirmed" });

      await storage.createAdminAuditLog({
        adminUserId: actorId,
        action: "closure_report_approved",
        targetType: "closure_report",
        targetId: String(reportId),
        description: `마감보고 승인: 오더#${report.orderId}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Admin approve closure report error:", err);
      res.status(500).json({ message: "마감자료 승인에 실패했습니다" });
    }
  });

  // PATCH /api/admin/closure-reports/:reportId/reject - 마감자료 반려 (closingReports 사용)
  app.patch("/api/admin/closure-reports/:reportId/reject", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const reportId = parseInt(req.params.reportId);
      const actorId = (req as any).adminUser?.id;
      const { reason } = req.body;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "반려 사유는 5자 이상 입력해주세요" });
      }

      const [report] = await db.select().from(closingReports).where(eq(closingReports.id, reportId));
      if (!report) {
        return res.status(404).json({ message: "마감자료를 찾을 수 없습니다" });
      }

      if (report.status !== "submitted") {
        return res.status(400).json({ message: "이미 처리된 마감자료입니다" });
      }

      const [updated] = await db.update(closingReports)
        .set({
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: actorId,
          rejectReason: reason,
        })
        .where(eq(closingReports.id, reportId))
        .returning();

      await storage.createAdminAuditLog({
        adminUserId: actorId,
        action: "closure_report_rejected",
        targetType: "closure_report",
        targetId: String(reportId),
        description: `마감보고 반려: 오더#${report.orderId}, 사유: ${reason}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Admin reject closure report error:", err);
      res.status(500).json({ message: "Failed to reject closure report" });
    }
  });

  // 관리자용 마감 보고서 배송/반품 수량 업데이트
  app.patch("/api/admin/closure-reports/:reportId/counts", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const reportId = parseInt(req.params.reportId);
      const actorId = (req as any).adminUser?.id;
      const { deliveredCount, returnedCount } = req.body;

      if (deliveredCount === undefined && returnedCount === undefined) {
        return res.status(400).json({ message: "배송 또는 반품 수량을 입력해주세요" });
      }

      const [report] = await db.select().from(orderClosureReports).where(eq(orderClosureReports.id, reportId));
      if (!report) {
        return res.status(404).json({ message: "마감 보고서를 찾을 수 없습니다" });
      }

      const updateData: any = {};
      if (deliveredCount !== undefined) {
        updateData.deliveredCount = parseInt(deliveredCount) || 0;
      }
      if (returnedCount !== undefined) {
        updateData.returnedCount = parseInt(returnedCount) || 0;
      }

      const [updated] = await db.update(orderClosureReports)
        .set(updateData)
        .where(eq(orderClosureReports.id, reportId))
        .returning();

      await storage.createAdminAuditLog({
        adminUserId: actorId,
        action: "closure_report_counts_updated",
        targetType: "closure_report",
        targetId: String(reportId),
        description: `마감보고 수량 수정: 오더#${report.orderId}, 배송: ${updateData.deliveredCount ?? report.deliveredCount}, 반품: ${updateData.returnedCount ?? report.returnedCount}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Admin update closure report counts error:", err);
      res.status(500).json({ message: "수량 업데이트에 실패했습니다" });
    }
  });

  // 수동 배차 API
  app.post("/api/admin/orders/:orderId/manual-dispatch", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const actorId = (req as any).adminUser?.id;
      const { helperId, dispatchType, reason } = req.body;

      if (!helperId || !dispatchType || !reason) {
        return res.status(400).json({ message: "Helper ID, dispatch type, and reason are required" });
      }

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const previousHelperId = order.matchedHelperId;

      // 오더 헬퍼 배정
      const [updated] = await db.update(orders)
        .set({
          status: "scheduled",
          matchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // 수동 배차 로그 기록
      await db.insert(manualDispatchLogs).values({
        orderId,
        dispatchType,
        reason,
        previousHelperId,
        actorId,
        actorRole: (req as any).adminUser?.role || "admin",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Manual dispatch error:", err);
      res.status(500).json({ message: "Failed to manual dispatch" });
    }
  });

  // 수동 배차 이력 조회
  app.get("/api/admin/orders/:orderId/dispatch-logs", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const logs = await db.select()
        .from(manualDispatchLogs)
        .where(eq(manualDispatchLogs.orderId, orderId))
        .orderBy(desc(manualDispatchLogs.createdAt));
      res.json(logs);
    } catch (err: any) {
      console.error("Get dispatch logs error:", err);
      res.status(500).json({ message: "Failed to get dispatch logs" });
    }
  });

  // 증빙 업로드 실패 큐 조회
  app.get("/api/admin/proof-upload-failures", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const failures = await db.select()
        .from(proofUploadFailures)
        .where(eq(proofUploadFailures.status, "pending"))
        .orderBy(desc(proofUploadFailures.createdAt));
      res.json(failures);
    } catch (err: any) {
      console.error("Get proof upload failures error:", err);
      res.status(500).json({ message: "Failed to get proof upload failures" });
    }
  });

  // VAT 설정 API
  app.get("/api/admin/settings/vat", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const settings = await db.select().from(vatSettings).orderBy(vatSettings.createdAt);
      res.json(settings);
    } catch (err: any) {
      console.error("Get VAT settings error:", err);
      res.status(500).json({ message: "Failed to get VAT settings" });
    }
  });

  app.post("/api/admin/settings/vat", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const result = await db.insert(vatSettings).values({
        ...req.body,
        createdBy: actorId,
      }).returning();
      res.json(result[0]);
    } catch (err: any) {
      console.error("Create VAT setting error:", err);
      res.status(500).json({ message: "Failed to create VAT setting" });
    }
  });

  app.patch("/api/admin/settings/vat/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const result = await db.update(vatSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(vatSettings.id, parseInt(req.params.id)))
        .returning();
      res.json(result[0]);
    } catch (err: any) {
      console.error("Update VAT setting error:", err);
      res.status(500).json({ message: "Failed to update VAT setting" });
    }
  });

  // ============================================
  // Wave 2: 추가 운영 API (T-01, T-07, T-08)
  // ============================================

  // T-01: 택배사 최저운임 관리 API
  app.get("/api/admin/carrier-min-rates", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const rates = await db.select()
        .from(carrierMinRates)
        .orderBy(desc(carrierMinRates.createdAt));
      res.json(rates);
    } catch (err: any) {
      console.error("Get carrier min rates error:", err);
      res.status(500).json({ message: "Failed to get carrier min rates" });
    }
  });

  app.post("/api/admin/carrier-min-rates", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const result = await db.insert(carrierMinRates).values({
        ...req.body,
        createdBy: actorId,
      }).returning();
      res.json(result[0]);
    } catch (err: any) {
      console.error("Create carrier min rate error:", err);
      res.status(500).json({ message: "Failed to create carrier min rate" });
    }
  });

  app.patch("/api/admin/carrier-min-rates/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const result = await db.update(carrierMinRates)
        .set({ ...req.body, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(carrierMinRates.id, parseInt(req.params.id)))
        .returning();
      res.json(result[0]);
    } catch (err: any) {
      console.error("Update carrier min rate error:", err);
      res.status(500).json({ message: "Failed to update carrier min rate" });
    }
  });

  app.delete("/api/admin/carrier-min-rates/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(carrierMinRates).where(eq(carrierMinRates.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete carrier min rate error:", err);
      res.status(500).json({ message: "Failed to delete carrier min rate" });
    }
  });

  // 표준 운임표 관리 API
  app.get("/api/admin/pricing-tables", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const tables = await db.select()
        .from(pricingTables)
        .orderBy(desc(pricingTables.createdAt));
      res.json(tables);
    } catch (err: any) {
      console.error("Get pricing tables error:", err);
      res.status(500).json({ message: "Failed to get pricing tables" });
    }
  });

  app.get("/api/admin/pricing-tables/:id", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const [table] = await db.select()
        .from(pricingTables)
        .where(eq(pricingTables.id, parseInt(req.params.id)));
      if (!table) {
        return res.status(404).json({ message: "Pricing table not found" });
      }
      const rows = await db.select()
        .from(pricingTableRows)
        .where(eq(pricingTableRows.tableId, table.id))
        .orderBy(pricingTableRows.sortOrder);
      res.json({ ...table, rows });
    } catch (err: any) {
      console.error("Get pricing table error:", err);
      res.status(500).json({ message: "Failed to get pricing table" });
    }
  });

  app.post("/api/admin/pricing-tables", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const { rows, ...tableData } = req.body;
      const [table] = await db.insert(pricingTables).values({
        ...tableData,
        createdBy: actorId,
      }).returning();

      if (rows && rows.length > 0) {
        await db.insert(pricingTableRows).values(
          rows.map((row: any, index: number) => ({ ...row, tableId: table.id, sortOrder: index }))
        );
      }
      res.json(table);
    } catch (err: any) {
      console.error("Create pricing table error:", err);
      res.status(500).json({ message: "Failed to create pricing table" });
    }
  });

  app.patch("/api/admin/pricing-tables/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { rows, ...tableData } = req.body;
      const tableId = parseInt(req.params.id);

      const [table] = await db.update(pricingTables)
        .set({ ...tableData, updatedAt: new Date() })
        .where(eq(pricingTables.id, tableId))
        .returning();

      if (rows) {
        await db.delete(pricingTableRows).where(eq(pricingTableRows.tableId, tableId));
        if (rows.length > 0) {
          await db.insert(pricingTableRows).values(
            rows.map((row: any, index: number) => ({ ...row, tableId, sortOrder: index }))
          );
        }
      }
      res.json(table);
    } catch (err: any) {
      console.error("Update pricing table error:", err);
      res.status(500).json({ message: "Failed to update pricing table" });
    }
  });

  // 지역별 운임 규칙 관리 API
  app.get("/api/admin/region-pricing-rules", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const rules = await db.select()
        .from(regionPricingRules)
        .orderBy(desc(regionPricingRules.priority), regionPricingRules.regionName);
      res.json(rules);
    } catch (err: any) {
      console.error("Get region pricing rules error:", err);
      res.status(500).json({ message: "Failed to get region pricing rules" });
    }
  });

  app.post("/api/admin/region-pricing-rules", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const [rule] = await db.insert(regionPricingRules).values({
        ...req.body,
      }).returning();
      res.json(rule);
    } catch (err: any) {
      console.error("Create region pricing rule error:", err);
      res.status(500).json({ message: "Failed to create region pricing rule" });
    }
  });

  app.patch("/api/admin/region-pricing-rules/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const [rule] = await db.update(regionPricingRules)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(regionPricingRules.id, parseInt(req.params.id)))
        .returning();
      res.json(rule);
    } catch (err: any) {
      console.error("Update region pricing rule error:", err);
      res.status(500).json({ message: "Failed to update region pricing rule" });
    }
  });

  app.delete("/api/admin/region-pricing-rules/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      await db.delete(regionPricingRules).where(eq(regionPricingRules.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete region pricing rule error:", err);
      res.status(500).json({ message: "Failed to delete region pricing rule" });
    }
  });

  // T-07: 본인인증 이력 조회 API
  app.get("/api/admin/identity-verifications", adminAuth, requirePermission("users.view"), async (req, res) => {
    try {
      const { status, userId } = req.query;
      let query = db.select().from(identityVerifications);

      if (status) {
        query = query.where(eq(identityVerifications.status, status as string)) as any;
      }
      if (userId) {
        query = query.where(eq(identityVerifications.userId, userId as string)) as any;
      }

      const verifications = await query.orderBy(desc(identityVerifications.createdAt));
      res.json(verifications);
    } catch (err: any) {
      console.error("Get identity verifications error:", err);
      res.status(500).json({ message: "Failed to get identity verifications" });
    }
  });

  // T-07: 서류 검토 작업 관리 API
  app.get("/api/admin/document-review-tasks", adminAuth, requirePermission("users.view"), async (req, res) => {
    try {
      const { status, priority, assignedTo } = req.query;
      let query = db.select().from(documentReviewTasks);

      if (status) {
        query = query.where(eq(documentReviewTasks.status, status as string)) as any;
      }
      if (priority) {
        query = query.where(eq(documentReviewTasks.priority, priority as string)) as any;
      }
      if (assignedTo) {
        query = query.where(eq(documentReviewTasks.assignedTo, assignedTo as string)) as any;
      }

      const tasks = await query.orderBy(desc(documentReviewTasks.createdAt));
      res.json(tasks);
    } catch (err: any) {
      console.error("Get document review tasks error:", err);
      res.status(500).json({ message: "Failed to get document review tasks" });
    }
  });

  app.patch("/api/admin/document-review-tasks/:id", adminAuth, requirePermission("users.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const taskId = parseInt(req.params.id);
      const { status, rejectReason, rejectCategory, revisionNote } = req.body;

      const updateData: any = { ...req.body, updatedAt: new Date() };

      if (status === "approved" || status === "rejected") {
        updateData.reviewedBy = actorId;
        updateData.reviewedAt = new Date();
      }
      if (status === "in_review" && !updateData.assignedTo) {
        updateData.assignedTo = actorId;
        updateData.assignedAt = new Date();
      }

      const [task] = await db.update(documentReviewTasks)
        .set(updateData)
        .where(eq(documentReviewTasks.id, taskId))
        .returning();

      res.json(task);
    } catch (err: any) {
      console.error("Update document review task error:", err);
      res.status(500).json({ message: "Failed to update document review task" });
    }
  });

  // 오더 상태 타임라인 API
  app.get("/api/admin/orders/:orderId/status-events", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const events = await db.select()
        .from(orderStatusEvents)
        .where(eq(orderStatusEvents.orderId, orderId))
        .orderBy(desc(orderStatusEvents.createdAt));
      res.json(events);
    } catch (err: any) {
      console.error("Get order status events error:", err);
      res.status(500).json({ message: "Failed to get order status events" });
    }
  });

  // T-08: SMS 템플릿 관리 API
  app.get("/api/admin/sms-templates", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const templates = await db.select()
        .from(smsTemplates)
        .orderBy(smsTemplates.category, smsTemplates.code);
      res.json(templates);
    } catch (err: any) {
      console.error("Get SMS templates error:", err);
      res.status(500).json({ message: "Failed to get SMS templates" });
    }
  });

  // Note: POST /api/admin/sms-templates is defined in the SMS Management APIs section below (line ~33380)

  app.patch("/api/admin/sms-templates/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const [template] = await db.update(smsTemplates)
        .set({ ...req.body, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(smsTemplates.id, parseInt(req.params.id)))
        .returning();
      res.json(template);
    } catch (err: any) {
      console.error("Update SMS template error:", err);
      res.status(500).json({ message: "Failed to update SMS template" });
    }
  });

  // T-08: SMS 발송 로그 조회 API
  app.get("/api/admin/sms-logs", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { status, phone, limit = "100" } = req.query;
      let query = db.select().from(smsLogs);

      if (status) {
        query = query.where(eq(smsLogs.status, status as string)) as any;
      }
      if (phone) {
        query = query.where(eq(smsLogs.recipientPhone, phone as string)) as any;
      }

      const logs = await query.orderBy(desc(smsLogs.createdAt)).limit(parseInt(limit as string));
      res.json(logs);
    } catch (err: any) {
      console.error("Get SMS logs error:", err);
      res.status(500).json({ message: "Failed to get SMS logs" });
    }
  });

  // 웹훅 로그 조회 API

  // 웹훅 재처리 API
  app.post("/api/admin/webhook-logs/:id/retry", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      const [log] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, logId));

      if (!log) {
        return res.status(404).json({ message: "Webhook log not found" });
      }

      // 상태 업데이트 (실제 재처리 로직은 별도 구현 필요)
      const [updated] = await db.update(webhookLogs)
        .set({
          status: "processing",
          retryCount: (log.retryCount || 0) + 1,
        })
        .where(eq(webhookLogs.id, logId))
        .returning();

      res.json(updated);
    } catch (err: any) {
      console.error("Retry webhook error:", err);
      res.status(500).json({ message: "Failed to retry webhook" });
    }
  });

  // 연동 상태 조회 API
  app.get("/api/admin/integration-health", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const health = await db.select().from(integrationHealth).orderBy(integrationHealth.serviceName);
      res.json(health);
    } catch (err: any) {
      console.error("Get integration health error:", err);
      res.status(500).json({ message: "Failed to get integration health" });
    }
  });

  // 시스템 이벤트 로그 조회 API
  app.get("/api/admin/system-events", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { severity, source, limit = "100" } = req.query;
      let query = db.select().from(systemEvents);

      if (severity) {
        query = query.where(eq(systemEvents.severity, severity as string)) as any;
      }
      if (source) {
        query = query.where(eq(systemEvents.source, source as string)) as any;
      }

      const events = await query.orderBy(desc(systemEvents.createdAt)).limit(parseInt(limit as string));
      res.json(events);
    } catch (err: any) {
      console.error("Get system events error:", err);
      res.status(500).json({ message: "Failed to get system events" });
    }
  });

  // 환불 관리 API
  app.get("/api/admin/refunds", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const { status, limit = "100" } = req.query;
      let query = db.select().from(refunds);

      if (status) {
        query = query.where(eq(refunds.status, status as string)) as any;
      }

      const refundList = await query.orderBy(desc(refunds.createdAt)).limit(parseInt(limit as string));
      res.json(refundList);
    } catch (err: any) {
      console.error("Get refunds error:", err);
      res.status(500).json({ message: "Failed to get refunds" });
    }
  });

  app.post("/api/admin/refunds", adminAuth, requirePermission("payments.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const [refund] = await db.insert(refunds).values({
        ...req.body,
        requestedBy: actorId,
        requestedAt: new Date(),
      }).returning();
      res.json(refund);
    } catch (err: any) {
      console.error("Create refund error:", err);
      res.status(500).json({ message: "Failed to create refund" });
    }
  });

  app.patch("/api/admin/refunds/:id", adminAuth, requirePermission("payments.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const refundId = parseInt(req.params.id);
      const { status, reason, notes } = req.body;

      // 현재 환불 상태 조회 (이중 환불 방지)
      const [existingRefund] = await db.select().from(refunds).where(eq(refunds.id, refundId));
      if (!existingRefund) {
        return res.status(404).json({ message: "Refund not found" });
      }

      // 이미 완료/실패된 환불은 상태 변경 불가
      const terminalStatuses = ["completed", "failed"];
      if (terminalStatuses.includes(existingRefund.status)) {
        return res.status(400).json({
          message: `이미 ${existingRefund.status === "completed" ? "완료" : "실패"} 처리된 환불입니다. 상태를 변경할 수 없습니다.`,
        });
      }

      // 허용된 필드만 명시적 전달 (...req.body 제거)
      const updateData: any = {};
      if (status) updateData.status = status;
      if (reason !== undefined) updateData.reason = reason;
      if (notes !== undefined) updateData.notes = notes;

      if (status === "completed") {
        updateData.approvedBy = actorId;
        updateData.approvedAt = new Date();
        updateData.completedAt = new Date();
      } else if (status === "failed") {
        updateData.failedAt = new Date();
      }

      const [refund] = await db.update(refunds)
        .set(updateData)
        .where(eq(refunds.id, refundId))
        .returning();

      res.json(refund);
    } catch (err: any) {
      console.error("Update refund error:", err);
      res.status(500).json({ message: "Failed to update refund" });
    }
  });

  // CS 티켓 에스컬레이션 API
  app.get("/api/admin/ticket-escalations", adminAuth, requirePermission("support.view"), async (req, res) => {
    try {
      const escalations = await db.select()
        .from(supportTicketEscalations)
        .orderBy(desc(supportTicketEscalations.createdAt));
      res.json(escalations);
    } catch (err: any) {
      console.error("Get ticket escalations error:", err);
      res.status(500).json({ message: "Failed to get ticket escalations" });
    }
  });

  app.post("/api/admin/ticket-escalations", adminAuth, requirePermission("support.edit"), async (req, res) => {
    try {
      const actorId = (req as any).adminUser?.id;
      const [escalation] = await db.insert(supportTicketEscalations).values({
        ...req.body,
        escalatedBy: actorId,
      }).returning();
      res.json(escalation);
    } catch (err: any) {
      console.error("Create ticket escalation error:", err);
      res.status(500).json({ message: "Failed to create ticket escalation" });
    }
  });

  // ============================================
  // Admin-App Integration APIs (Wave 3)
  // ============================================

  // Documents API (서류 관리)
  app.get("/api/admin/documents", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const { userId, status, docType, limit } = req.query;

      // Safely parse limit with guard for undefined/invalid values
      const parsedLimit = limit ? parseInt(limit as string, 10) : 100;
      const safeLimit = Number.isNaN(parsedLimit) ? 100 : parsedLimit;

      const documents = await storage.getAllDocuments({
        userId: userId as string | undefined,
        status: status as string | undefined,
        docType: docType as string | undefined,
        limit: safeLimit,
      });

      res.json(documents);
    } catch (err: any) {
      console.error("Get documents error:", err);
      res.status(500).json({ message: "서류 목록을 불러오지 못했습니다" });
    }
  });

  app.get("/api/admin/documents/:id", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) {
        return res.status(404).json({ message: "서류를 찾을 수 없습니다" });
      }

      const reviews = await storage.getDocumentReviews(doc.id);
      const user = await storage.getUser(doc.userId);

      res.json({ ...doc, reviews, user });
    } catch (err: any) {
      console.error("Get document error:", err);
      res.status(500).json({ message: "서류 정보를 불러오지 못했습니다" });
    }
  });

  // Document review (서류 검토/승인/반려)
  app.post("/api/admin/documents/:id/review", adminAuth, requirePermission("helpers.edit"), async (req, res) => {
    try {
      const docId = parseInt(req.params.id);
      const adminId = (req as any).adminUser?.id;
      const { action, reason } = req.body;

      if (!action || !reason) {
        return res.status(400).json({ message: "액션과 사유를 입력해주세요" });
      }

      if (!["APPROVE", "REJECT", "REQUEST_MORE"].includes(action)) {
        return res.status(400).json({ message: "유효하지 않은 액션입니다" });
      }

      const doc = await storage.getDocument(docId);
      if (!doc) {
        return res.status(404).json({ message: "서류를 찾을 수 없습니다" });
      }

      // Create review record
      const review = await storage.createDocumentReview({
        documentId: docId,
        adminId,
        action,
        reason,
      });

      // Update document status
      let newStatus: string;
      if (action === "APPROVE") {
        newStatus = "APPROVED";
      } else if (action === "REJECT") {
        newStatus = "REJECTED";
      } else {
        newStatus = "UNDER_REVIEW";
      }

      const updatedDoc = await storage.updateDocument(docId, { status: newStatus });

      // Log admin action
      await logAdminAction({
        req,
        action: "document.review",
        targetType: "document",
        targetId: docId,
        oldValue: { status: doc.status },
        newValue: { status: newStatus, reason },
      });

      res.json({ document: updatedDoc, review });
    } catch (err: any) {
      console.error("Document review error:", err);
      res.status(500).json({ message: "서류 검토 처리에 실패했습니다" });
    }
  });

  // User sanctions API (사용자 제재)
  app.get("/api/admin/sanctions", adminAuth, requirePermission("staff.view"), async (req, res) => {
    try {
      const sanctions = await storage.getAllUserSanctions();
      const sanctionsWithUsers = await Promise.all(
        sanctions.map(async (s) => {
          const user = await storage.getUser(s.userId);
          return { ...s, user };
        })
      );
      res.json(sanctionsWithUsers);
    } catch (err: any) {
      console.error("Get sanctions error:", err);
      res.status(500).json({ message: "제재 목록을 불러오지 못했습니다" });
    }
  });

  app.post("/api/admin/sanctions", adminAuth, requirePermission("staff.edit"), async (req, res) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const { userId, sanctionType, reason, startDate, endDate } = req.body;

      if (!userId || !sanctionType || !reason) {
        return res.status(400).json({ message: "필수 정보를 입력해주세요" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      const sanction = await storage.createUserSanction({
        userId,
        sanctionType,
        reason,
        startDate: startDate || new Date().toISOString().split("T")[0],
        endDate: endDate || null,
        isActive: true,
        createdBy: adminId,
      });

      await logAdminAction({
        req,
        action: "sanction.create",
        targetType: "user",
        targetId: userId,
        oldValue: { sanctionType: null },
        newValue: { sanctionType, reason },
      });

      res.json(sanction);
    } catch (err: any) {
      console.error("Create sanction error:", err);
      res.status(500).json({ message: "제재 등록에 실패했습니다" });
    }
  });

  app.patch("/api/admin/sanctions/:id/release", adminAuth, requirePermission("staff.edit"), async (req, res) => {
    try {
      const sanctionId = parseInt(req.params.id);
      const adminId = (req as any).adminUser?.id;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "해제 사유를 입력해주세요" });
      }

      const sanction = await storage.getUserSanction(sanctionId);
      if (!sanction) {
        return res.status(404).json({ message: "제재 정보를 찾을 수 없습니다" });
      }

      const updated = await storage.updateUserSanction(sanctionId, {
        isActive: false,
        endDate: new Date().toISOString().split("T")[0],
      });

      await logAdminAction({
        req,
        action: "sanction.release",
        targetType: "sanction",
        targetId: sanctionId,
        oldValue: { isActive: true },
        newValue: { isActive: false, reason },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Release sanction error:", err);
      res.status(500).json({ message: "제재 해제에 실패했습니다" });
    }
  });

  // Order reassignment (기사 재배정)
  app.post("/api/admin/orders/:orderId/reassign", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const adminId = (req as any).adminUser?.id;
      const { toHelperId, reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "재배정 사유를 입력해주세요" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // Get current helper from accepted application
      const applications = await storage.getOrderApplications(orderId);
      const acceptedApp = applications.find(a => a.status === "accepted");
      const fromHelperId = acceptedApp?.helperId || null;

      // Validate new helper if provided
      if (toHelperId) {
        const newHelper = await storage.getUser(toHelperId);
        if (!newHelper || newHelper.role !== "helper") {
          return res.status(400).json({ message: "유효한 헬퍼를 선택해주세요" });
        }
      }

      // Get previous helper from order
      const previousHelperId = (order as any).matchedHelperId || fromHelperId;

      // Create reassignment record
      const reassignment = await storage.createReassignment({
        orderId,
        fromHelperId: previousHelperId,
        toHelperId: toHelperId || null,
        reason,
        createdBy: adminId,
      });

      // Update order with new helper and status
      const newOrderStatus = toHelperId ? "scheduled" : "matching";
      await storage.updateOrder(orderId, {
        status: newOrderStatus,
        matchedHelperId: toHelperId || null,
        matchedAt: toHelperId ? new Date() : null,
      });

      // Update applications - cancel accepted one
      if (acceptedApp) {
        await storage.updateOrderApplication(acceptedApp.id, { status: "cancelled" });
      }

      // Create order status event
      await storage.createOrderStatusEvent({
        orderId,
        triggerType: "admin",
        triggeredBy: adminId,
        previousStatus: order.status,
        newStatus: newOrderStatus,
        reason: `재배정: ${reason}`,
      });

      await logAdminAction({
        req,
        action: "order.reassign",
        targetType: "order",
        targetId: orderId,
        oldValue: { helperId: previousHelperId, status: order.status },
        newValue: { helperId: toHelperId, status: newOrderStatus, reason },
      });

      res.json(reassignment);
    } catch (err: any) {
      console.error("Reassign order error:", err);
      res.status(500).json({ message: "기사 재배정에 실패했습니다" });
    }
  });

  // Webhook logs API (웹훅 로그)
  app.get("/api/admin/webhook-logs", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { source, status, limit = "100" } = req.query;
      const logs = await storage.getAllWebhookLogs({
        source: source as string,
        status: status as string,
        limit: parseInt(limit as string),
      });
      res.json(logs);
    } catch (err: any) {
      console.error("Get webhook logs error:", err);
      res.status(500).json({ message: "웹훅 로그를 불러오지 못했습니다" });
    }
  });

  app.post("/api/admin/webhook-logs/:id/retry", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      const adminId = (req as any).adminUser?.id;

      const log = await storage.getWebhookLog(logId);
      if (!log) {
        return res.status(404).json({ message: "웹훅 로그를 찾을 수 없습니다" });
      }

      if (log.status !== "failed") {
        return res.status(400).json({ message: "실패한 웹훅만 재처리할 수 있습니다" });
      }

      // Update status to indicate retry attempt
      const updated = await storage.updateWebhookLog(logId, {
        status: "processing",
        retryCount: (log.retryCount || 0) + 1,
      });

      await logAdminAction({
        req,
        action: "webhook.retry",
        targetType: "webhook_log",
        targetId: logId,
        oldValue: { status: log.status },
        newValue: { status: "processing" },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Retry webhook error:", err);
      res.status(500).json({ message: "웹훅 재처리에 실패했습니다" });
    }
  });

  // Identity verifications API (본인인증 이력)
  app.get("/api/admin/users/:userId/identity-verifications", adminAuth, requirePermission("staff.view"), async (req, res) => {
    try {
      const { userId } = req.params;
      const verifications = await storage.getUserIdentityVerifications(userId);
      res.json(verifications);
    } catch (err: any) {
      console.error("Get identity verifications error:", err);
      res.status(500).json({ message: "본인인증 이력을 불러오지 못했습니다" });
    }
  });

  // Order status events API (오더 상태 이력)
  app.get("/api/admin/orders/:orderId/status-events", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const events = await storage.getOrderStatusEvents(orderId);

      // Enrich with actor info
      const enrichedEvents = await Promise.all(
        events.map(async (e) => {
          const actor = e.triggeredBy ? await storage.getUser(e.triggeredBy) : null;
          return { ...e, actor };
        })
      );

      res.json(enrichedEvents);
    } catch (err: any) {
      console.error("Get order status events error:", err);
      res.status(500).json({ message: "오더 상태 이력을 불러오지 못했습니다" });
    }
  });

  // Reassignment history (재배정 이력)
  app.get("/api/admin/orders/:orderId/reassignments", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const reassignments = await storage.getOrderReassignments(orderId);

      const enriched = await Promise.all(
        reassignments.map(async (r) => {
          const fromHelper = r.fromHelperId ? await storage.getUser(r.fromHelperId) : null;
          const toHelper = r.toHelperId ? await storage.getUser(r.toHelperId) : null;
          const createdByUser = await storage.getUser(r.createdBy);
          return { ...r, fromHelper, toHelper, createdByUser };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      console.error("Get reassignments error:", err);
      res.status(500).json({ message: "재배정 이력을 불러오지 못했습니다" });
    }
  });

  // =====================================================
  // 관리자 리뉴얼 API (앱 연동 100%)
  // =====================================================

  // GET /api/admin/closings - 마감 검수함 목록
  app.get("/api/admin/closings", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const status = req.query.status as string || 'pending';
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      console.log(`[closings] Query params: status=${status}, startDate=${startDate}, endDate=${endDate}`);

      // 간단한 쿼리 - closing_reports만 조회 후 order 정보 별도 조회
      const reports = await db.select().from(closingReports).orderBy(desc(closingReports.createdAt));
      console.log(`[closings] Found ${reports.length} closing_reports`);

      const courierSettings = await storage.getAllCourierSettings();

      const enriched = await Promise.all(
        reports.map(async (cr) => {
          try {
            const order = await storage.getOrder(cr.orderId);
            if (!order) {
              console.log(`[closings] Report ${cr.id}: order ${cr.orderId} not found, skipping`);
              return null;
            }

            const helper = await storage.getUser(cr.helperId);
            const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
            const settlement = await db
              .select()
              .from(settlementRecords)
              .where(eq(settlementRecords.orderId, cr.orderId))
              .limit(1);

            // Get category from courier_settings
            const courierSetting = courierSettings.find(c => c.courierName === order.companyName);
            const category = courierSetting?.category || "parcel";
            const categoryBasePrice = courierSetting?.basePricePerBox || 0;
            const categoryEtcPrice = courierSetting?.etcPricePerBox || 0;

            let closingStatus = 'pending';
            const os = order.status;
            if (os === 'closing_submitted') closingStatus = 'pending';
            else if (['final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'].includes(os || '')) closingStatus = 'approved';
            else if (['open', 'scheduled'].includes(os || '')) closingStatus = 'rejected';

            if (status !== 'all') {
              if (status === 'pending' && closingStatus !== 'pending') return null;
              if (status === 'approved' && closingStatus !== 'approved') return null;
              if (status === 'rejected' && closingStatus !== 'rejected') return null;
            }

            return {
              id: cr.id,
              orderId: cr.orderId,
              helperId: cr.helperId,
              helperName: helper?.nickname || helper?.name || null,
              helperPhone: helper?.phoneNumber || null,
              requesterId: order.requesterId,
              requesterName: requester?.nickname || requester?.name || null,
              requesterPhone: requester?.phoneNumber || null,
              category,
              categoryBasePrice,
              categoryEtcPrice,
              deliveredCount: cr.deliveredCount,
              returnedCount: cr.returnedCount,
              etcCount: cr.etcCount || 0,
              deliveryHistoryImages: cr.deliveryHistoryImagesJson ? JSON.parse(cr.deliveryHistoryImagesJson) : [],
              etcImages: cr.etcImagesJson ? JSON.parse(cr.etcImagesJson) : [],
              extraCostsJson: cr.extraCostsJson ? (() => {
                try {
                  const parsed = JSON.parse(cr.extraCostsJson);
                  return Array.isArray(parsed) ? parsed.map((item: any) => ({
                    name: item.code || item.name || '',
                    unitPrice: item.amount || item.unitPrice || 0,
                    quantity: item.quantity || 1,
                    memo: item.memo || '',
                  })) : [];
                } catch { return []; }
              })() : [],
              closingMemo: cr.memo,
              dynamicFields: cr.dynamicFieldsJson ? (() => { try { return JSON.parse(cr.dynamicFieldsJson); } catch { return null; } })() : null,
              createdAt: cr.createdAt,
              status: closingStatus,
              order: {
                status: order.status,
                courierCompany: order.courierCompany || order.companyName,
                averageQuantity: order.averageQuantity,
                finalPricePerBox: order.finalPricePerBox,
                pricePerUnit: order.pricePerUnit,
              },
              settlement: settlement[0] || null,
            };
          } catch (itemErr) {
            console.error(`[closings] Error enriching report ${cr.id}:`, itemErr);
            return null;
          }
        })
      );

      let filtered = enriched.filter(Boolean);
      console.log(`[closings] After enrichment: ${enriched.length} total, ${filtered.length} non-null`);

      // Date filtering
      if (startDate || endDate) {
        const beforeDateFilter = filtered.length;
        filtered = filtered.filter((item: any) => {
          if (!item.createdAt) return true;
          const createdDate = item.createdAt instanceof Date ? item.createdAt.toISOString().split("T")[0] : String(item.createdAt).split("T")[0];
          if (startDate && createdDate < startDate) return false;
          if (endDate && createdDate > endDate) return false;
          return true;
        });
        console.log(`[closings] After date filter: ${beforeDateFilter} -> ${filtered.length}`);
      }

      console.log(`[closings] Returning ${filtered.length} items`);
      res.json(filtered);
    } catch (err: any) {
      console.error("Get closings error:", err);
      res.status(500).json({ message: "마감 목록을 불러오지 못했습니다" });
    }
  });

  // GET /api/admin/order-details - 오더상세내역 (통합 조회)
  app.get("/api/admin/order-details", adminAuth, requirePermission("orders.view"), async (req: AuthenticatedRequest, res) => {
    try {
      const searchOrderNumber = req.query.orderNumber as string | undefined;
      const searchOrderId = req.query.orderId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const currentUser = req.user;
      const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'SUPER_ADMIN';

      // 모든 closing_reports 조회
      const reports = await db.select().from(closingReports).orderBy(desc(closingReports.createdAt));

      // 모든 사고/이의제기 조회
      const allIncidents = await db.select().from(incidentReports);
      const incidentsByOrder = new Map<number, any[]>();
      allIncidents.forEach((inc: any) => {
        const arr = incidentsByOrder.get(inc.orderId) || [];
        arr.push(inc);
        incidentsByOrder.set(inc.orderId, arr);
      });

      // 모든 차감 조회
      const allDeductions = await db.select().from(deductions);
      const deductionsByOrder = new Map<number, any[]>();
      allDeductions.forEach((ded: any) => {
        const arr = deductionsByOrder.get(ded.orderId) || [];
        arr.push(ded);
        deductionsByOrder.set(ded.orderId, arr);
      });

      const enriched = await Promise.all(
        reports.map(async (cr: any) => {
          try {
            const order = await storage.getOrder(cr.orderId);
            if (!order) return null;

            // 오더번호 검색
            if (searchOrderNumber) {
              if (order.orderNumber !== searchOrderNumber && String(order.id) !== searchOrderNumber) {
                return null;
              }
            }
            if (searchOrderId && String(order.id) !== searchOrderId) {
              return null;
            }

            const helper = cr.helperId ? await storage.getUser(cr.helperId) : null;
            const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;

            // 사고/이의제기 정보
            const orderIncidents = incidentsByOrder.get(cr.orderId) || [];
            const hasIncident = orderIncidents.some((inc: any) => inc.incidentType === 'cargo_damage' || inc.incidentType === 'accident');
            const hasDispute = orderIncidents.some((inc: any) => inc.incidentType === 'dispute' || inc.incidentType === 'complaint');
            const hasAnyEvent = hasIncident || hasDispute || orderIncidents.length > 0;

            // 차감 정보
            const orderDeductions = deductionsByOrder.get(cr.orderId) || [];
            const deductionTotal = orderDeductions.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

            // 정산 정보
            const settlement = await db
              .select()
              .from(settlementRecords)
              .where(eq(settlementRecords.orderId, cr.orderId))
              .limit(1);

            // 추가비용 파싱
            let extraCosts: any[] = [];
            if (cr.extraCostsJson) {
              try {
                const parsed = JSON.parse(cr.extraCostsJson);
                extraCosts = Array.isArray(parsed) ? parsed.map((item: any) => ({
                  name: item.code || item.name || '',
                  unitPrice: item.amount || item.unitPrice || 0,
                  quantity: item.quantity || 1,
                  memo: item.memo || '',
                })) : [];
              } catch { extraCosts = []; }
            }

            // 협력업체 정보
            let enterpriseName = '';
            if (order.enterpriseId) {
              try {
                const ent = await storage.getEnterpriseAccount(order.enterpriseId);
                enterpriseName = ent?.name || '';
              } catch { /* ignore */ }
            }

            // 권한 분리: 일반 관리자는 이벤트 있는 건만
            if (!isSuperAdmin && !hasAnyEvent) {
              return null;
            }

            // SSOT 정산 계산기로 금액 라이브 재계산 (반품·기타·추가비용 정확 반영)
            const closingData = parseClosingReport(cr, order);
            const settlementCalc = calculateSettlement(closingData);

            // 수수료율: 매칭 스냅샷 → 헬퍼별 실효 수수료율 → 글로벌 기본값
            let platformFeeRate = 5; // fallback
            try {
              const [appSnapshot] = await db.select().from(orderApplications)
                .where(and(
                  eq(orderApplications.orderId, cr.orderId),
                  eq(orderApplications.helperId, cr.helperId)
                ))
                .limit(1);
              if (appSnapshot?.snapshotCommissionRate != null) {
                platformFeeRate = appSnapshot.snapshotCommissionRate;
              } else {
                const effectiveRate = await storage.getEffectiveCommissionRate(cr.helperId);
                platformFeeRate = effectiveRate.rate;
              }
            } catch { /* fallback to 5% */ }

            const platformFeeCalc = Math.round(settlementCalc.totalAmount * (platformFeeRate / 100));
            const netAmountCalc = Math.max(0, settlementCalc.totalAmount - platformFeeCalc - deductionTotal);

            return {
              // 기본 정보
              closingReportId: cr.id,
              orderId: cr.orderId,
              orderNumber: order.orderNumber || null,
              orderStatus: order.status,
              // 요청자 정보
              requesterId: order.requesterId,
              requesterName: requester?.nickname || requester?.name || '미확인',
              requesterPhone: requester?.phoneNumber || '',
              requesterEmail: requester?.email || '',
              businessName: order.companyName || '',
              // 헬퍼 정보
              helperId: cr.helperId,
              helperName: helper?.nickname || helper?.name || '미확인',
              helperPhone: helper?.phoneNumber || '',
              helperEmail: helper?.email || '',
              helperTeamName: '', // TODO: team lookup if needed
              // 오더 정보
              deliveryArea: order.deliveryArea || '',
              courierCompany: order.courierCompany || order.companyName || '',
              vehicleType: order.vehicleType || '',
              scheduledDate: order.scheduledDate || '',
              scheduledDateEnd: order.scheduledDateEnd || null,
              pricePerUnit: order.pricePerUnit || 0,
              etcPricePerUnit: closingData.etcPricePerUnit || 1800,
              averageQuantity: order.averageQuantity || '',
              campAddress: order.campAddress || '',
              contactPhone: order.contactPhone || '',
              arrivalTime: order.arrivalTime || '',
              enterpriseId: order.enterpriseId || null,
              enterpriseName,
              // 마감 데이터
              deliveredCount: cr.deliveredCount || 0,
              returnedCount: cr.returnedCount || 0,
              etcCount: cr.etcCount || 0,
              extraCostsJson: extraCosts,
              deliveryHistoryImages: cr.deliveryHistoryImagesJson ? JSON.parse(cr.deliveryHistoryImagesJson) : [],
              etcImages: cr.etcImagesJson ? JSON.parse(cr.etcImagesJson) : [],
              closingMemo: cr.memo || '',
              closingCreatedAt: cr.createdAt,
              // 정산 (SSOT 계산기 결과)
              supplyAmount: settlementCalc.supplyAmount,
              vatAmount: settlementCalc.vatAmount,
              totalAmount: settlementCalc.totalAmount,
              platformFeeRate: platformFeeRate,
              platformFee: platformFeeCalc,
              netAmount: netAmountCalc,
              // 정산 상세 breakdown
              deliveryReturnAmount: settlementCalc.deliveryReturnAmount,
              etcAmount: settlementCalc.etcAmount,
              extraCostsTotal: settlementCalc.extraCostsTotal,
              // 차감/사고 이벤트
              hasIncident,
              hasDispute,
              hasAnyEvent,
              incidents: orderIncidents,
              deductions: orderDeductions,
              deductionTotal,
              // 정산 레코드
              settlementRecord: settlement[0] || null,
            };
          } catch (itemErr) {
            console.error(`[order-details] Error enriching report ${cr.id}:`, itemErr);
            return null;
          }
        })
      );

      let filtered = enriched.filter(Boolean);

      // 날짜 필터
      if (startDate || endDate) {
        filtered = filtered.filter((item: any) => {
          const schedDate = item.scheduledDate || '';
          if (startDate && schedDate < startDate) return false;
          if (endDate && schedDate > endDate) return false;
          return true;
        });
      }

      res.json(filtered);
    } catch (err: any) {
      console.error("Get order-details error:", err);
      res.status(500).json({ message: "오더상세내역을 불러오지 못했습니다" });
    }
  });

  // PUT /api/admin/order-details/:orderId - 오더상세내역 수정 (이벤트 있는 건만)
  app.put("/api/admin/order-details/:orderId", adminAuth, requirePermission("orders.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { deliveredCount, returnedCount, etcCount, deductionUpdates } = req.body;

      // 해당 오더에 이벤트가 있는지 확인
      const orderIncidents = await db.select().from(incidentReports)
        .where(eq(incidentReports.orderId, orderId));
      if (orderIncidents.length === 0) {
        return res.status(403).json({ message: "이벤트(사고/이의제기)가 없는 오더는 수정할 수 없습니다" });
      }

      // closing_report 업데이트
      const existingReports = await db.select().from(closingReports)
        .where(eq(closingReports.orderId, orderId));
      if (existingReports.length > 0) {
        const cr = existingReports[0];
        const updates: any = {};
        if (deliveredCount !== undefined) updates.deliveredCount = deliveredCount;
        if (returnedCount !== undefined) updates.returnedCount = returnedCount;
        if (etcCount !== undefined) updates.etcCount = etcCount;

        if (Object.keys(updates).length > 0) {
          await db.update(closingReports).set(updates).where(eq(closingReports.id, cr.id));
        }
      }

      // 차감 업데이트 (배열)
      if (deductionUpdates && Array.isArray(deductionUpdates)) {
        for (const du of deductionUpdates) {
          if (du.id) {
            // 기존 차감 수정
            await db.update(deductions).set({
              amount: du.amount,
              reason: du.reason,
              memo: du.memo,
            }).where(eq(deductions.id, du.id));
          } else {
            // 신규 차감 생성 (화물사고 자동차감)
            await db.insert(deductions).values({
              orderId,
              incidentId: du.incidentId || null,
              helperId: du.helperId || null,
              targetType: du.targetType || 'helper',
              targetId: du.targetId || null,
              amount: du.amount || 0,
              reason: du.reason || '화물사고 차감',
              category: du.category || 'incident',
              status: 'confirmed',
              memo: du.memo || '',
            });
          }
        }
      }

      // 관리자 액션 로그
      await logAdminAction({
        req,
        action: "order_detail.update",
        targetType: "order",
        targetId: orderId,
        newValue: req.body,
      });

      res.json({ success: true, message: "오더상세내역이 수정되었습니다" });
    } catch (err: any) {
      console.error("Update order-details error:", err);
      res.status(500).json({ message: "오더상세내역 수정에 실패했습니다" });
    }
  });

  // POST /api/admin/orders/:orderId/closing/reject - 마감 반려
  app.post("/api/admin/orders/:orderId/closing/reject", adminAuth, requirePermission("orders.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { reason } = req.body;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      await storage.updateOrder(orderId, { status: 'scheduled' });

      if (order.matchedHelperId) {
        const rejectMsg = reason || '마감이 반려되었습니다. 다시 제출해주세요.';
        await storage.createNotification({
          userId: order.matchedHelperId,
          type: 'closing_rejected',
          title: '마감 반려',
          message: rejectMsg,
          data: { orderId },
        });

        // 푸시 알림
        sendPushToUser(order.matchedHelperId, {
          title: "마감 반려",
          body: `${order.companyName || "오더"} 마감이 반려되었습니다. 다시 제출해주세요.`,
          url: "/helper-home",
          tag: `closing-rejected-${orderId}`,
        });
      }

      res.json({ success: true, message: '마감이 반려되었습니다' });
    } catch (err: any) {
      console.error("Reject closing error:", err);
      res.status(500).json({ message: "마감 반려에 실패했습니다" });
    }
  });

  // GET /api/admin/requesters/pending - 승인 대기 요청자 목록
  app.get("/api/admin/requesters/pending", adminAuth, requirePermission("requesters.view"), async (req, res) => {
    try {
      const pendingRequesters = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.role, 'requester'),
            eq((users as any).isVerified, false),
            isNull((users as any).deletedAt)
          )
        )
        .orderBy(desc(users.createdAt));

      res.json(pendingRequesters.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        companyName: u.companyName,
        createdAt: u.createdAt,
        status: 'pending',
      })));
    } catch (err: any) {
      console.error("Get pending requesters error:", err);
      res.status(500).json({ message: "대기 요청자 목록을 불러오지 못했습니다" });
    }
  });

  // POST /api/admin/requesters/:id/approve - 요청자 승인
  app.post("/api/admin/requesters/:id/approve", adminAuth, requirePermission("requesters.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);

      await db.update(users)
        .set({ isVerified: true, verifiedAt: new Date() })
        .where(eq(users.id, userId));

      await storage.createNotification({
        userId,
        type: 'account_approved',
        title: '계정 승인',
        message: '회원가입이 승인되었습니다. 이제 서비스를 이용할 수 있습니다.',
        data: {},
      });

      res.json({ success: true, message: '요청자가 승인되었습니다' });
    } catch (err: any) {
      console.error("Approve requester error:", err);
      res.status(500).json({ message: "요청자 승인에 실패했습니다" });
    }
  });

  // POST /api/admin/requesters/:id/reject - 요청자 반려
  app.post("/api/admin/requesters/:id/reject", adminAuth, requirePermission("requesters.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { reason } = req.body;

      await storage.createNotification({
        userId,
        type: 'account_rejected',
        title: '가입 반려',
        message: reason || '회원가입이 반려되었습니다.',
        data: {},
      });

      await db.update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, userId));

      res.json({ success: true, message: '요청자가 반려되었습니다' });
    } catch (err: any) {
      console.error("Reject requester error:", err);
      res.status(500).json({ message: "요청자 반려에 실패했습니다" });
    }
  });

  // GET /api/admin/incidents - 사고/차감 목록
  app.get("/api/admin/incidents", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const incidents = await db
        .select({
          id: incidentReports.id,
          orderId: incidentReports.orderId,
          type: incidentReports.incidentType,
          description: incidentReports.description,
          deductionAmount: incidentReports.deductionAmount,
          status: incidentReports.status,
          helperStatus: incidentReports.helperStatus,
          helperActionAt: incidentReports.helperActionAt,
          helperResponseDeadline: incidentReports.helperResponseDeadline,
          createdAt: incidentReports.createdAt,
        })
        .from(incidentReports)
        .orderBy(desc(incidentReports.createdAt));

      // orderNumber 매핑
      const orderIds = [...new Set(incidents.filter(i => i.orderId).map(i => i.orderId!))];
      const orderList = orderIds.length > 0
        ? await db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders).where(inArray(orders.id, orderIds))
        : [];
      const orderNumMap = new Map(orderList.map(o => [o.id, o.orderNumber]));

      const enriched = incidents.map(inc => ({
        id: inc.id,
        orderId: inc.orderId,
        orderNumber: inc.orderId ? orderNumMap.get(inc.orderId) || null : null,
        incidentType: inc.type || 'damage',
        amount: inc.deductionAmount || 0,
        reason: inc.description || '',
        status: inc.status || 'pending',
        helperStatus: inc.helperStatus || null,
        helperActionAt: inc.helperActionAt || null,
        helperResponseDeadline: inc.helperResponseDeadline || null,
        createdAt: inc.createdAt,
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error("Get incidents error:", err);
      res.status(500).json({ message: "사고 목록을 불러오지 못했습니다" });
    }
  });

  // POST /api/admin/incidents - 사고 등록
  app.post("/api/admin/incidents", adminAuth, requirePermission("orders.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, type, amount, reason, images, helperResponseHours } = req.body;
      const adminId = req.user?.id;

      // 대응 시간: 요청값 > system_settings > 기본 48시간
      let responseHours = 48;
      if (helperResponseHours) {
        responseHours = Number(helperResponseHours);
      } else {
        const setting = await storage.getSystemSetting('incident_response_hours');
        if (setting?.settingValue) {
          responseHours = Number(setting.settingValue) || 48;
        }
      }
      const helperResponseDeadline = new Date();
      helperResponseDeadline.setHours(helperResponseDeadline.getHours() + responseHours);

      const [incident] = await db.insert(incidentReports).values({
        orderId,
        incidentType: type || 'damage',
        description: reason,
        deductionAmount: amount || 0,
        status: 'pending',
        reportedBy: adminId,
        helperResponseDeadline,
        helperResponseRequired: true,
        adminForceProcessed: false,
      }).returning();

      if (images && images.length > 0) {
        for (const img of images) {
          await db.insert(incidentEvidence).values({
            incidentId: incident.id,
            evidenceType: 'image',
            fileUrl: img,
          });
        }
      }

      res.json({ success: true, incident });
    } catch (err: any) {
      console.error("Create incident error:", err);
      res.status(500).json({ message: "사고 등록에 실패했습니다" });
    }
  });


  // PATCH /api/admin/incidents/:id - 사고 상태 변경
  app.patch("/api/admin/incidents/:id", adminAuth, requirePermission("orders.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const { status, deductionAmount, deductionReason, adminReply } = req.body;

      // 유효한 사고 상태 값 검증
      const validIncidentStatuses = ["submitted", "investigating", "reviewing", "resolved", "closed", "rejected"];
      if (status && !validIncidentStatuses.includes(status)) {
        return res.status(400).json({ message: `유효하지 않은 상태입니다: ${status}` });
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (deductionAmount !== undefined) updateData.deductionAmount = deductionAmount;
      if (deductionReason !== undefined) updateData.deductionReason = deductionReason;
      if (adminReply !== undefined) updateData.adminReply = adminReply;

      await db.update(incidentReports)
        .set(updateData)
        .where(eq(incidentReports.id, incidentId));

      // 액션 이력 추가
      const adminUser = req.user;
      if (adminUser) {
        await storage.createIncidentAction({
          incidentId,
          actionType: status ? 'status_change' : 'update',
          actorId: adminUser.id,
          notes: status ? `상태 변경: ${status}` : (adminReply ? `답변 등록` : '정보 수정'),
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Update incident error:", err);
      res.status(500).json({ message: "사고 상태 변경에 실패했습니다" });
    }
  });

  // GET /api/admin/incidents/:id - 사고 상세 조회
  app.get("/api/admin/incidents/:id", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const incidentId = parseInt(req.params.id);

      const [incident] = await db.select().from(incidentReports)
        .where(eq(incidentReports.id, incidentId))
        .limit(1);

      if (!incident) {
        return res.status(404).json({ message: "사고를 찾을 수 없습니다" });
      }

      // Get order info with helper name
      let order: any = null;
      let helperName: any = null;
      if (incident.orderId) {
        const [orderData] = await db.select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          campAddress: orders.campAddress,
          deliveryArea: orders.deliveryArea,
          scheduledDate: orders.scheduledDate,
          courierCompany: orders.courierCompany,
          averageQuantity: orders.averageQuantity,
          matchedHelperId: orders.matchedHelperId,
          companyName: orders.companyName,
        }).from(orders).where(eq(orders.id, incident.orderId));
        order = orderData;

        if (orderData?.matchedHelperId) {
          const [helperData] = await db.select({ name: users.name })
            .from(users)
            .where(eq(users.id, orderData.matchedHelperId));
          helperName = helperData?.name || null;
        }
      }

      // Get helper info
      let helper: any = null;
      if (incident.helperId) {
        const [helperData] = await db.select({
          id: users.id,
          name: users.name,
          nickname: users.nickname,
          phone: users.phoneNumber,
        }).from(users).where(eq(users.id, incident.helperId));
        helper = helperData;
      }

      // Get requester info (companyName은 users가 아닌 orders 테이블에 있음)
      let requester: any = null;
      if (incident.requesterId) {
        const [requesterData] = await db.select({
          id: users.id,
          name: users.name,
          phone: users.phoneNumber,
        }).from(users).where(eq(users.id, incident.requesterId));
        requester = requesterData ? {
          ...requesterData,
          companyName: order?.companyName || null,
        } : null;
      }

      // Get reporter info
      let reporter: any = null;
      if (incident.reporterId) {
        const [reporterData] = await db.select({
          id: users.id,
          name: users.name,
          role: users.role,
        }).from(users).where(eq(users.id, incident.reporterId));
        reporter = reporterData;
      }

      // Get evidence
      const evidence = await db.select()
        .from(incidentEvidence)
        .where(eq(incidentEvidence.incidentId, incidentId));

      // Get action history
      let actions: any[] = [];
      try {
        actions = await storage.getIncidentActions(incidentId);
      } catch { /* ignore if not implemented */ }

      res.json({
        ...incident,
        createdAt: incident.createdAt?.toISOString() || null,
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        helperActionAt: incident.helperActionAt?.toISOString() || null,
        deductionConfirmedAt: incident.deductionConfirmedAt?.toISOString() || null,
        reviewStartedAt: incident.reviewStartedAt?.toISOString() || null,
        order: order ? { ...order, helperName } : null,
        helper,
        requester,
        reporter,
        evidence,
        actions,
      });
    } catch (err: any) {
      console.error("Get incident detail error:", err);
      res.status(500).json({ message: "사고 상세 조회에 실패했습니다" });
    }
  });

  // GET /api/admin/incidents/:id/actions - 사고 처리 이력 조회
  app.get("/api/admin/incidents/:id/actions", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const actions = await storage.getIncidentActions(incidentId);

      // 액션에 담당자 정보 추가
      const actionsWithUser = await Promise.all(actions.map(async (action) => {
        if (action.performedBy) {
          const user = await storage.getUser(action.performedBy);
          return { ...action, performerName: user?.name || '알 수 없음' };
        }
        return { ...action, performerName: '시스템' };
      }));

      res.json(actionsWithUser);
    } catch (err: any) {
      console.error("Get incident actions error:", err);
      res.status(500).json({ message: "처리 이력 조회에 실패했습니다" });
    }
  });

  // POST /api/admin/incidents/:id/actions - 사고 처리 액션/코멘트 추가
  app.post("/api/admin/incidents/:id/actions", adminAuth, requirePermission("orders.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const { actionType, notes } = req.body;
      const adminUser = req.user;

      if (!notes) {
        return res.status(400).json({ message: "코멘트 내용을 입력해주세요" });
      }

      const action = await storage.createIncidentAction({
        incidentId,
        actionType: actionType || 'comment',
        actorId: adminUser?.id,
        notes,
      });

      res.json({ ...action, performerName: adminUser?.name || '관리자' });
    } catch (err: any) {
      console.error("Add incident action error:", err);
      res.status(500).json({ message: "코멘트 등록에 실패했습니다" });
    }
  });


  // POST /api/admin/incidents/:id/confirm-deduction - 사고 차감 확정
  app.post("/api/admin/incidents/:id/confirm-deduction", adminAuth, requirePermission("settlements.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const {
        deductionAmount,
        deductionReason,
        deductionMethod, // helper_deduct, requester_refund, both
        adminMemo
      } = req.body;

      if (!deductionAmount || deductionAmount <= 0) {
        return res.status(400).json({ message: "차감 금액을 입력해주세요" });
      }

      if (!deductionMethod || !['helper_deduct', 'requester_refund', 'both'].includes(deductionMethod)) {
        return res.status(400).json({ message: "처리 방식을 선택해주세요" });
      }

      // 사고 조회
      const [incident] = await db.select()
        .from(incidentReports)
        .where(eq(incidentReports.id, incidentId))
        .limit(1);

      if (!incident) {
        return res.status(404).json({ message: "사고를 찾을 수 없습니다" });
      }

      // 이미 차감 확정된 사고는 재처리 불가
      if (incident.helperDeductionApplied) {
        return res.status(409).json({ message: "이미 차감이 확정된 사고입니다" });
      }

      const adminUser = req.user;
      const now = new Date();

      // 1. 헬퍼 정산 공제 처리
      let helperDeductionApplied = false;
      if ((deductionMethod === 'helper_deduct' || deductionMethod === 'both') && incident.helperId) {
        // deductions 테이블에 차감 내역 추가
        await db.insert(deductions).values({
          orderId: incident.orderId,
          incidentId: incidentId,
          targetType: 'helper',
          amount: deductionAmount,
          reason: deductionReason || `화물사고 차감 (사고번호: ${incidentId})`,
          category: 'incident',
          sourceType: 'incident',
          sourceId: incidentId,
          status: 'pending',
          createdBy: adminUser?.id,
        });

        // 해당 오더의 정산 레코드가 있으면 차감 반영
        if (incident.orderId) {
          const [settlement] = await db.select()
            .from(settlementRecords)
            .where(eq(settlementRecords.orderId, incident.orderId))
            .limit(1);

          if (settlement) {
            const currentDeductions = settlement.damageDeduction || 0;
            await db.update(settlementRecords)
              .set({
                damageDeduction: currentDeductions + deductionAmount,
                updatedAt: now,
              })
              .where(eq(settlementRecords.id, settlement.id));
          }
        }

        helperDeductionApplied = true;

        // 헬퍼에게 알림
        if (incident.helperId) {
          sendPushToUser(incident.helperId, {
            title: '사고 차감 확정',
            body: `사고 건에 대해 ${deductionAmount.toLocaleString()}원이 차감되었습니다.`,
          } as any);
        }
      }

      // 2. 요청자 환불 처리
      let requesterRefundApplied = false;
      if ((deductionMethod === 'requester_refund' || deductionMethod === 'both') && incident.requesterId) {
        // refunds 테이블에 환불 내역 추가
        await db.insert(refunds).values({
          orderId: incident.orderId,
          incidentId: incidentId,
          reasonCategory: "incident",
          requesterId: incident.requesterId,
          amount: deductionAmount,
          reason: deductionReason || `화물사고 환불 (사고번호: ${incidentId})`,
          status: 'pending',
          requestedAt: now,
          createdBy: adminUser?.id,
        });

        requesterRefundApplied = true;

        // 요청자에게 알림
        if (incident.requesterId) {
          sendPushToUser(incident.requesterId, {
            title: '사고 환불 처리',
            body: `사고 건에 대해 ${deductionAmount.toLocaleString()}원 환불이 진행됩니다.`,
          } as any);
        }
      }

      // 3. 사고 상태 업데이트
      await db.update(incidentReports)
        .set({
          status: 'resolved',
          deductionAmount,
          deductionReason,
          deductionMethod,
          deductionConfirmedAt: now,
          helperDeductionApplied,
          requesterRefundApplied,
          adminMemo,
          resolvedBy: adminUser?.id,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(incidentReports.id, incidentId));

      // 4. 액션 이력 추가
      await storage.createIncidentAction({
        incidentId,
        actionType: 'deduction_confirmed',
        actorId: adminUser?.id,
        notes: `차감 확정: ${deductionAmount.toLocaleString()}원 (${deductionMethod === 'helper_deduct' ? '헬퍼 정산 공제' :
          deductionMethod === 'requester_refund' ? '요청자 환불' : '헬퍼 공제 + 요청자 환불'
          })`,
      });

      res.json({
        success: true,
        message: '차감이 확정되었습니다',
        helperDeductionApplied,
        requesterRefundApplied,
      });
    } catch (err: any) {
      console.error("Confirm incident deduction error:", err);
      res.status(500).json({ message: "차감 확정에 실패했습니다" });
    }
  });
  // POST /api/admin/incidents/:id/force-process - 관리자 강제 처리 (헬퍼 응답 기한 초과)
  app.post("/api/admin/incidents/:id/force-process", adminAuth, requirePermission("orders.manage"), async (req: AuthenticatedRequest, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const { reason, deductionAmount, deductionMethod, adminMemo } = req.body;
      const adminUser = req.user;
      const now = new Date();

      // 사고 조회
      const [incident] = await db.select().from(incidentReports)
        .where(eq(incidentReports.id, incidentId))
        .limit(1);

      if (!incident) {
        return res.status(404).json({ message: "사고를 찾을 수 없습니다" });
      }

      // 이미 처리된 사고인지 확인
      if (incident.status === 'resolved' || incident.adminForceProcessed) {
        return res.status(400).json({ message: "이미 처리된 사고입니다" });
      }

      // 헬퍼 응답 기한 확인 (기한 초과 또는 관리자 권한)
      const isDeadlinePassed = incident.helperResponseDeadline && new Date(incident.helperResponseDeadline) < now;
      const hasHelperResponse = !!incident.helperStatus;

      if (!isDeadlinePassed && !hasHelperResponse) {
        // 기한 전이고 헬퍼 응답도 없으면 경고만 (관리자 권한으로 강제 처리 가능)
        console.log(`[ForceProcess] 기한 전 강제 처리: incidentId=${incidentId}, deadline=${incident.helperResponseDeadline}`);
      }

      // 차감 금액이 있는 경우 처리
      let helperDeductionApplied = false;
      let requesterRefundApplied = false;

      if (deductionAmount && deductionAmount > 0) {
        const method = deductionMethod || 'helper_deduct';

        if (method === 'helper_deduct' || method === 'both') {
          // 헬퍼 차감 처리
          if (incident.orderId) {
            await db.insert(deductions).values({
              orderId: incident.orderId,
              incidentId: incidentId,
              amount: deductionAmount,
              reason: reason || `화물사고 차감 (관리자 강제처리, 사고번호: ${incidentId})`,
              deductionType: 'damage',
              status: 'applied',
              appliedAt: now,
              createdBy: adminUser?.id,
            });
          }
          helperDeductionApplied = true;

          if (incident.helperId) {
            sendPushToUser(incident.helperId, {
              title: '사고 처리 알림',
              body: `관리자가 사고 건을 처리했습니다. 차감액: ${deductionAmount.toLocaleString()}원`,
            } as any);
          }
        }

        if (method === 'requester_refund' || method === 'both') {
          // 요청자 환불 처리
          if (incident.orderId) {
            await db.insert(refunds).values({
              orderId: incident.orderId,
              incidentId: incidentId,
              reasonCategory: "incident",
              requesterId: incident.requesterId,
              amount: deductionAmount,
              reason: reason || `화물사고 환불 (관리자 강제처리, 사고번호: ${incidentId})`,
              status: 'pending',
              requestedAt: now,
              createdBy: adminUser?.id,
            });
          }
          requesterRefundApplied = true;

          if (incident.requesterId) {
            sendPushToUser(incident.requesterId, {
              title: '사고 환불 처리',
              body: `사고 건에 대해 ${deductionAmount.toLocaleString()}원 환불이 진행됩니다.`,
            } as any);
          }
        }
      }

      // 사고 상태 업데이트
      await db.update(incidentReports)
        .set({
          status: 'resolved',
          adminForceProcessed: true,
          adminForceProcessedAt: now,
          adminForceProcessedBy: adminUser?.id,
          adminForceProcessedReason: reason,
          deductionAmount: deductionAmount || 0,
          deductionMethod: deductionMethod || null,
          helperDeductionApplied,
          requesterRefundApplied,
          adminMemo,
          resolvedBy: adminUser?.id,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(incidentReports.id, incidentId));

      // 액션 이력 추가
      await storage.createIncidentAction({
        incidentId,
        actionType: 'admin_force_processed',
        actorId: adminUser?.id,
        notes: `관리자 강제 처리: ${reason || '헬퍼 응답 없음'}${deductionAmount ? ` (차감: ${deductionAmount.toLocaleString()}원)` : ''}`,
      });

      res.json({
        success: true,
        message: '관리자 강제 처리가 완료되었습니다',
        helperDeductionApplied,
        requesterRefundApplied,
      });
    } catch (err: any) {
      console.error("Force process incident error:", err);
      res.status(500).json({ message: "강제 처리에 실패했습니다" });
    }
  });

  // PATCH /api/admin/settlements/by-order/:orderId/deduct - 정산에 차감 반영
  app.patch("/api/admin/settlements/by-order/:orderId/deduct", adminAuth, requirePermission("settlements.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { amount, reason } = req.body;

      const [settlement] = await db
        .select()
        .from(settlementRecords)
        .where(eq(settlementRecords.orderId, orderId))
        .limit(1);

      if (!settlement) {
        return res.status(404).json({ message: "정산 기록을 찾을 수 없습니다" });
      }

      const newDeduction = (settlement.damageDeduction || 0) + amount;
      const newPayout = (settlement.finalTotal || 0) - (settlement.platformFee || 0) - newDeduction;

      await db.update(settlementRecords)
        .set({
          damageDeduction: newDeduction,
          damageReason: reason,
          driverPayout: newPayout,
        })
        .where(eq(settlementRecords.id, settlement.id));

      res.json({ success: true, newDeduction, newPayout });
    } catch (err: any) {
      console.error("Deduct settlement error:", err);
      res.status(500).json({ message: "차감 반영에 실패했습니다" });
    }
  });

  // GET /api/admin/cs - CS 티켓 목록
  app.get("/api/admin/cs", adminAuth, async (req, res) => {
    try {
      const tickets = await db
        .select()
        .from(customerServiceInquiries)
        .orderBy(desc(customerServiceInquiries.createdAt));

      const enriched = await Promise.all(
        tickets.map(async (t) => {
          const user = await storage.getUser(t.userId);
          return {
            id: t.id,
            orderId: t.orderId,
            userId: t.userId,
            userName: user?.name || '알 수 없음',
            userRole: user?.role || 'unknown',
            type: t.type || 'inquiry',
            subject: t.subject || '',
            message: t.message,
            status: t.status,
            createdAt: t.createdAt,
          };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      console.error("Get CS tickets error:", err);
      res.status(500).json({ message: "CS 목록을 불러오지 못했습니다" });
    }
  });

  // PATCH /api/admin/cs/:id - CS 티켓 상태 변경
  app.patch("/api/admin/cs/:id", adminAuth, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { status } = req.body;

      await db.update(customerServiceInquiries)
        .set({ status })
        .where(eq(customerServiceInquiries.id, ticketId));

      res.json({ success: true });
    } catch (err: any) {
      console.error("Update CS ticket error:", err);
      res.status(500).json({ message: "CS 상태 변경에 실패했습니다" });
    }
  });

  // GET /api/admin/outstanding - 미수금 목록
  app.get("/api/admin/outstanding", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const outstandingOrders = await db
        .select({
          orderId: orders.id,
          requesterId: orders.requesterId,
          finalTotal: settlementRecords.finalTotal,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .innerJoin(settlementRecords, eq(orders.id, settlementRecords.orderId))
        .where(eq(orders.status, 'final_amount_confirmed'))
        .orderBy(desc(orders.createdAt));

      const enriched = await Promise.all(
        outstandingOrders.map(async (o) => {
          const requester = await storage.getUser(o.requesterId);
          return {
            ...o,
            requesterName: requester?.name,
            companyName: requester?.companyName,
          };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      console.error("Get outstanding error:", err);
      res.status(500).json({ message: "미수금 목록을 불러오지 못했습니다" });
    }
  });

  // POST /api/admin/outstanding/:orderId/remind - 미수금 알림 발송
  app.post("/api/admin/outstanding/:orderId/remind", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      await storage.createNotification({
        userId: order.requesterId,
        type: 'payment_reminder',
        title: '결제 안내',
        message: '잔금 결제가 필요합니다. 결제를 진행해주세요.',
        data: { orderId },
      });

      res.json({ success: true, message: '알림이 발송되었습니다' });
    } catch (err: any) {
      console.error("Send reminder error:", err);
      res.status(500).json({ message: "알림 발송에 실패했습니다" });
    }
  });
  // POST /api/admin/settlements/:id/mark-paid - 정산 수동 지급 완료 처리
  // NOTE: 은행 API 연동 전까지 수동 처리. 연동 후 자동화 예정.
  app.post("/api/admin/settlements/:id/mark-paid", adminAuth, requirePermission("settlements.pay"), async (req: AuthenticatedRequest, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const { paymentMethod, transactionId, paidAmount, notes, confirmManualPayment } = req.body;

      // 안전장치: 수동 지급 확인 필수
      if (!confirmManualPayment) {
        return res.status(400).json({
          code: "CONFIRMATION_REQUIRED",
          message: "수동 지급 완료를 확인해주세요. confirmManualPayment: true 필요"
        });
      }

      // 기존 정산 레코드 확인
      const [existingSettlement] = await db.select().from(settlementRecords).where(eq(settlementRecords.id, settlementId));
      if (!existingSettlement) {
        return res.status(404).json({ message: "정산 레코드를 찾을 수 없습니다" });
      }

      // 이미 지급된 경우 중복 방지
      if (existingSettlement.status === 'paid') {
        return res.status(400).json({
          code: "ALREADY_PAID",
          message: "이미 지급 완료된 정산입니다",
          paidAt: existingSettlement.paidAt
        });
      }

      // 지급 금액 불일치 경고 (지정된 경우)
      if (paidAmount && existingSettlement.driverPayout && Math.abs(paidAmount - existingSettlement.driverPayout) > 100) {
        console.warn(`[Settlement ${settlementId}] Payment amount mismatch: expected ${existingSettlement.driverPayout}, got ${paidAmount}`);
      }

      await db.update(settlementRecords)
        .set({
          status: 'paid',
          paidAt: new Date()
        })
        .where(eq(settlementRecords.id, settlementId));

      if (existingSettlement.orderId) {
        await storage.updateOrder(existingSettlement.orderId, { status: 'settlement_paid' });
      }

      // 감사 로그
      console.log(`[Settlement] Manual payment marked: ID=${settlementId}, Admin=${req.user?.id}, Method=${paymentMethod || 'unspecified'}, TxId=${transactionId || 'none'}`);

      res.json({
        success: true,
        settlementId,
        message: "지급 완료 처리되었습니다. 은행 API 연동 전 수동 처리입니다."
      });
    } catch (err: any) {
      console.error("Mark paid error:", err);
      res.status(500).json({ message: "지급 완료 처리에 실패했습니다" });
    }
  });

  // GET /api/admin/helpers/:helperId/card - 헬퍼 카드 상세
  app.get("/api/admin/helpers/:helperId/card", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const helperId = parseInt(req.params.helperId);
      const helper = await storage.getUser(helperId);

      if (!helper) {
        return res.status(404).json({ message: "헬퍼를 찾을 수 없습니다" });
      }

      // 누적 통계
      const completedOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.matchedHelperId, helperId),
            inArray(orders.status, ['closed', 'settlement_paid'])
          )
        );

      const settlements = await db
        .select()
        .from(settlementRecords)
        .where(eq(settlementRecords.helperId, helperId));

      const totalPayout = settlements.reduce((sum, s) => sum + (s.driverPayout || 0), 0);
      const lastOrder = completedOrders[completedOrders.length - 1];

      res.json({
        id: helper.id,
        name: helper.name,
        email: helper.email,
        phone: helper.phoneNumber,
        region: helper.region,
        vehicleType: helper.vehicleType,
        isActive: !helper.isSuspended,
        isVerified: helper.isVerified,
        totalOrders: completedOrders.length,
        totalPayout,
        lastWorkDate: lastOrder?.createdAt,
        createdAt: helper.createdAt,
      });
    } catch (err: any) {
      console.error("Get helper card error:", err);
      res.status(500).json({ message: "헬퍼 정보를 불러오지 못했습니다" });
    }
  });

  // GET /api/admin/requesters/:requesterId/card - 요청자 카드 상세
  app.get("/api/admin/requesters/:requesterId/card", adminAuth, requirePermission("requesters.view"), async (req, res) => {
    try {
      const requesterId = parseInt(req.params.requesterId);
      const requester = await storage.getUser(requesterId);

      if (!requester) {
        return res.status(404).json({ message: "요청자를 찾을 수 없습니다" });
      }

      // 누적 통계
      const allOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.requesterId, requesterId));

      const settlements = await db
        .select()
        .from(settlementRecords)
        .where(eq((settlementRecords as any).requesterId, requesterId));

      const totalPaid = settlements.reduce((sum, s) => sum + (s.finalTotal || 0), 0);

      // 미수금 (final_amount_confirmed 상태인 오더들)
      const outstandingOrders = allOrders.filter(o => o.status === 'final_amount_confirmed');
      const outstandingSettlements = await Promise.all(
        outstandingOrders.map(o => db.select().from(settlementRecords).where(eq(settlementRecords.orderId, o.id)).limit(1))
      );
      const outstandingAmount = outstandingSettlements.flat().reduce((sum, s) => sum + (s?.finalTotal || 0), 0);

      const lastOrder = allOrders[allOrders.length - 1];

      res.json({
        id: requester.id,
        name: requester.name,
        companyName: requester.companyName,
        email: requester.email,
        phone: requester.phoneNumber,
        address: requester.address,
        isVerified: requester.isVerified,
        totalOrders: allOrders.length,
        totalPaid,
        outstandingAmount,
        lastOrderDate: lastOrder?.createdAt,
        createdAt: requester.createdAt,
      });
    } catch (err: any) {
      console.error("Get requester card error:", err);
      res.status(500).json({ message: "요청자 정보를 불러오지 못했습니다" });
    }
  });

  // GET /api/admin/payments-detail - 결제 목록 (계약금/잔금 구분)
  app.get("/api/admin/payments-detail", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const { type } = req.query;

      const allClosings = await db.select().from(closingReports);
      const allContracts = await db.select().from(contracts);
      const allOrders = await db.select().from(orders);

      const results: any[] = [];

      for (const order of allOrders) {
        const contract = allContracts.find(c => c.orderId === order.id);
        const closing = allClosings.find(c => c.orderId === order.id);
        const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
        // 헬퍼 정보: contract.helperUserId 또는 order.matchedHelperId 사용
        const helperUserId = contract?.helperUserId || order.matchedHelperId;
        const helper = helperUserId ? await storage.getUser(helperUserId) : null;

        const unitPrice = Number(order.finalPricePerBox || order.pricePerUnit || 1200);

        if (type === 'deposit') {
          // 입금대기 상태이거나 계약이 있는 오더 표시
          if (order.status === 'awaiting_deposit' || order.paymentStatus === 'deposit_confirmed' || contract) {
            // 공통 함수로 계약금 정보 조회 (SSOT)
            const depositInfo = await getOrderDepositInfo(order.id);
            results.push({
              id: order.id,
              orderId: order.id,
              orderDate: order.createdAt,
              requesterName: requester?.name || '-',
              requesterEmail: requester?.email || '-',
              requesterPhone: requester?.phoneNumber || '-',
              depositAmount: depositInfo.depositAmount,
              orderStatus: order.status,
              paymentStatus: depositInfo.paymentStatus,
              virtualAccountNumber: null,
              virtualAccountBank: null,
              createdAt: order.createdAt,
            });
          }
        } else if (type === 'balance') {
          // 잔금 대상: 마감 보고서가 있는 오더만 (정확한 데이터 연동 - SSOT)
          if (closing) {
            // === closing report DB에 저장된 SSOT 값 우선 사용 ===
            const deliveredCount = closing.deliveredCount || 0;
            const returnedCount = closing.returnedCount || 0;
            const etcCount = closing.etcCount || 0;
            const etcPricePerUnit = closing.etcPricePerUnit || 0;

            let extraCostsTotal = 0;
            if (closing.extraCostsJson) {
              try {
                const extraCostsItems = JSON.parse(closing.extraCostsJson);
                extraCostsTotal = extraCostsItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
              } catch { /* ignore */ }
            }

            // DB에 저장된 정산 스냅샷 사용 (마감 제출 시 calculateSettlement로 계산된 값)
            let supplyAmount: number, vatAmount: number, grossAmount: number;
            if (closing.supplyAmount != null && closing.vatAmount != null && closing.totalAmount != null) {
              // 마감 제출 시 저장된 SSOT 값 사용
              supplyAmount = closing.supplyAmount;
              vatAmount = closing.vatAmount;
              grossAmount = closing.totalAmount;
            } else {
              // 레거시 데이터: parseClosingReport + calculateSettlement로 재계산
              const closingData = parseClosingReport(closing, order);
              const settlement = calculateSettlement(closingData);
              supplyAmount = settlement.supplyAmount;
              vatAmount = settlement.vatAmount;
              grossAmount = settlement.totalAmount;
            }

            const depositAmount = contract?.depositAmount || 0;
            const balanceAmount = Math.max(0, grossAmount - depositAmount);

            results.push({
              id: order.id,
              orderId: order.id,
              orderDate: order.createdAt,
              requesterName: requester?.name || '-',
              requesterEmail: requester?.email || '-',
              requesterPhone: requester?.phoneNumber || '-',
              helperName: helper?.name || '-',
              helperEmail: helper?.email || '-',
              deliveredCount,
              returnedCount,
              etcCount,
              etcPricePerUnit,
              extraCostsTotal,
              supplyAmount,
              vatAmount,
              grossAmount,
              depositAmount,
              unitPrice,
              balanceAmount,
              orderStatus: order.status,
              paymentStatus: ['balance_paid', 'settlement_paid', 'closed'].includes(order.status || '') ? 'paid' : 'unpaid',
              balancePaidAt: (contract as any)?.balancePaidAt || null,
              balanceDueDate: (contract as any)?.balanceDueDate || (order as any).balancePaymentDueDate || null,
              virtualAccountNumber: null,
              virtualAccountBank: null,
              closingReportId: closing.id,
              closingSubmittedAt: closing.createdAt || null,
              createdAt: order.createdAt,
            });
          }
        }
      }

      res.json(results);
    } catch (err: any) {
      console.error("Get payments detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/admin/refunds-detail - 환불 목록 (일반/CS 구분)
  app.get("/api/admin/refunds-detail", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const { type } = req.query;

      if (type === 'cs') {
        const incidents = await db.select().from(incidentReports).where(isNotNull(incidentReports.deductionAmount));
        const results: any[] = [];

        for (const incident of incidents) {
          const order = await storage.getOrder(incident.orderId);
          if (!order) continue;

          const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
          const contractList = await db.select().from(contracts).where(eq(contracts.orderId, order.id)).limit(1);
          const helper = contractList[0]?.helperUserId ? await storage.getUser(contractList[0].helperUserId) : null;

          results.push({
            id: incident.id,
            orderId: incident.orderId,
            orderDate: order.createdAt,
            requesterName: requester?.name || '-',
            requesterEmail: requester?.email || '-',
            requesterPhone: requester?.phoneNumber || '-',
            helperName: helper?.name || '-',
            helperEmail: helper?.email || '-',
            trackingNumber: null,
            csReason: incident.type || 'other',
            csReasonDetail: incident.reason || null,
            refundAmount: incident.deductionAmount || 0,
            refundBankName: null,
            refundAccountNumber: null,
            refundAccountHolder: null,
            receiptStatus: 'received',
            helperConfirmed: incident.status === 'applied',
            refundCompleted: incident.status === 'applied',
            status: incident.status === 'applied' ? 'completed' : incident.status === 'pending' ? 'pending' : 'helper_confirmed',
            processedAt: incident.status === 'applied' ? incident.createdAt : null,
            createdAt: incident.createdAt,
          });
        }

        res.json(results);
      } else {
        const cancelledOrders = await db.select().from(orders).where(eq(orders.status, 'cancelled'));
        const refundPolicy = await getActiveRefundPolicy();
        const results: any[] = [];

        for (const order of cancelledOrders) {
          const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
          const contractList = await db.select().from(contracts).where(eq(contracts.orderId, order.id)).limit(1);
          const depositAmount = contractList[0]?.depositAmount || 0;

          const hasHelper = !!contractList[0]?.helperUserId;
          const refundRate = hasHelper ? refundPolicy.afterMatchingRate : refundPolicy.beforeMatchingRate;
          const refundAmount = Math.round(depositAmount * refundRate / 100);

          // 환불 사유 카테고리 결정
          let reasonCategory = 'customer_request'; // 기본: 고객요청
          const cancelReasonText = (order.cancelReason || '').toLowerCase();

          if (cancelReasonText.includes('미배정') || cancelReasonText.includes('unassigned') || cancelReasonText.includes('timeout')) {
            reasonCategory = 'unassigned_timeout'; // 미배정 타임아웃
          } else if (cancelReasonText.includes('입금') || cancelReasonText.includes('deposit')) {
            reasonCategory = 'deposit_issue'; // 입금 문제
          } else if (hasHelper) {
            reasonCategory = 'after_matching_cancel'; // 매칭 후 취소
          }

          results.push({
            id: order.id,
            orderId: order.id,
            orderDate: order.createdAt,
            requesterName: requester?.name || '-',
            requesterEmail: requester?.email || '-',
            requesterPhone: requester?.phoneNumber || '-',
            refundAmount: refundAmount,
            depositAmount: depositAmount,
            refundRate: refundRate,
            refundType: hasHelper ? 'after_matching' : 'before_matching',
            reasonCategory: reasonCategory,
            cancelReason: order.cancelReason || '-',
            refundBankName: null,
            refundAccountNumber: null,
            refundAccountHolder: null,
            status: 'completed',
            processedAt: order.updatedAt || order.createdAt,
            createdAt: order.createdAt,
          });
        }

        res.json(results);
      }
    } catch (err: any) {
      console.error("Get refunds detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // ============================================
  // CS Ticket Management CRUD APIs
  // ============================================

  // Get single inquiry
  app.get("/api/admin/customer-inquiries/:id", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { id } = req.params;
      const [inquiry] = await db.select().from(customerInquiries).where(eq(customerInquiries.id, parseInt(id)));
      if (!inquiry) {
        return res.status(404).json({ message: "Inquiry not found" });
      }

      const comments = await db.select().from(inquiryComments)
        .where(eq(inquiryComments.inquiryId, parseInt(id)))
        .orderBy(inquiryComments.createdAt);

      res.json({ ...inquiry, comments });
    } catch (err: any) {
      console.error("Get inquiry error:", err);
      res.status(500).json({ message: "Failed to fetch inquiry" });
    }
  });

  // Update inquiry status
  app.patch("/api/admin/customer-inquiries/:id", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status, priority, assigneeId, assigneeName } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;
      if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
      if (assigneeName !== undefined) updateData.assigneeName = assigneeName;

      if (status === 'resolved') updateData.resolvedAt = new Date();
      if (status === 'closed') updateData.closedAt = new Date();

      const [updated] = await db.update(customerInquiries)
        .set(updateData)
        .where(eq(customerInquiries.id, parseInt(id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Inquiry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Update inquiry error:", err);
      res.status(500).json({ message: "Failed to update inquiry" });
    }
  });

  // Reply to inquiry
  app.post("/api/admin/customer-inquiries/:id/reply", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { content, isInternal = false } = req.body;

      const [comment] = await db.insert(inquiryComments).values({
        inquiryId: parseInt(id),
        authorId: req.adminUser?.id,
        authorName: req.adminUser?.name || 'Admin',
        authorRole: 'admin',
        content,
        isInternal,
      }).returning();

      // Update inquiry status to in_progress or waiting_response
      if (!isInternal) {
        await db.update(customerInquiries)
          .set({
            status: 'waiting_response',
            responseContent: content,
            respondedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(customerInquiries.id, parseInt(id)));
      }

      res.json(comment);
    } catch (err: any) {
      console.error("Reply to inquiry error:", err);
      res.status(500).json({ message: "Failed to add reply" });
    }
  });

  // Escalate inquiry
  app.post("/api/admin/customer-inquiries/:id/escalate", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { escalationType, reason, priority = 'high', assignedTo, assignedToName, dueDate } = req.body;

      const [escalation] = await db.insert(ticketEscalations).values({
        inquiryId: parseInt(id),
        escalationType,
        reason,
        priority,
        escalatedBy: req.adminUser?.id,
        escalatedByName: req.adminUser?.name || 'Admin',
        assignedTo,
        assignedToName,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      }).returning();

      // Update inquiry priority
      await db.update(customerInquiries)
        .set({ priority: 'urgent', updatedAt: new Date() })
        .where(eq(customerInquiries.id, parseInt(id)));

      res.json(escalation);
    } catch (err: any) {
      console.error("Escalate inquiry error:", err);
      res.status(500).json({ message: "Failed to escalate inquiry" });
    }
  });

  // Resolve escalation
  app.patch("/api/admin/ticket-escalations/:id", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status, resolution, adminReply } = req.body;

      const updateData: any = { status, updatedAt: new Date() };
      if (resolution) updateData.resolution = resolution;
      if (adminReply) { updateData.adminReply = adminReply; updateData.adminReplyAt = new Date(); updateData.adminReplyBy = (req as any).adminUser?.id || null; }
      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = (req as any).adminUser?.id;
      }

      const [updated] = await db.update(ticketEscalations)
        .set(updateData)
        .where(eq(ticketEscalations.id, parseInt(id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Escalation not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Update escalation error:", err);
      res.status(500).json({ message: "Failed to update escalation" });
    }
  });

  // ============================================
  // SMS Management APIs
  // ============================================

  // Create SMS template
  app.post("/api/admin/sms-templates", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { code, name, category, content, variables, senderType } = req.body;

      const [template] = await db.insert(smsTemplates).values({
        code,
        name,
        category,
        content,
        variables,
        senderType,
        createdBy: (req as any).adminUser?.id,
      } as any).returning();

      res.json(template);
    } catch (err: any) {
      console.error("Create SMS template error:", err);
      res.status(500).json({ message: "Failed to create SMS template" });
    }
  });

  // Update SMS template
  app.patch("/api/admin/sms-templates/:id", adminAuth, requirePermission("settings.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { name, content, variables, senderType, isActive } = req.body;

      const updateData: any = { updatedBy: req.adminUser?.id, updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (content !== undefined) updateData.content = content;
      if (variables !== undefined) updateData.variables = variables;
      if (senderType !== undefined) updateData.senderType = senderType;
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updated] = await db.update(smsTemplates)
        .set(updateData)
        .where(eq(smsTemplates.id, parseInt(id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Update SMS template error:", err);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Send SMS
  app.post("/api/admin/send-sms", adminAuth, requirePermission("notifications.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { recipientPhone, recipientUserId, content, templateId, metadata } = req.body;

      // Log SMS attempt
      const [smsLog] = await db.insert(smsLogs).values({
        templateId,
        recipientPhone,
        recipientUserId,
        content,
        status: 'pending',
        provider: 'solapi',
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      }).returning();

      // Try to send via SMS service
      try {
        const result = await smsService.sendSms({ to: recipientPhone, message: content });

        await db.update(smsLogs)
          .set({
            status: result.success ? 'sent' : 'failed',
            providerId: result.messageId,
            errorMessage: result.error,
            sentAt: new Date()
          })
          .where(eq(smsLogs.id, smsLog.id));

        res.json({ success: result.success, messageId: result.messageId, error: result.error });
      } catch (sendErr: any) {
        await db.update(smsLogs)
          .set({ status: 'failed', errorMessage: sendErr.message })
          .where(eq(smsLogs.id, smsLog.id));

        res.json({ success: false, error: sendErr.message });
      }
    } catch (err: any) {
      console.error("Send SMS error:", err);
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  // ============================================
  // Push Notification APIs
  // ============================================

  // Send push notification
  app.post("/api/admin/send-push", adminAuth, requirePermission("notifications.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { recipientUserId, title, body, data, category, relatedEntityType, relatedEntityId } = req.body;

      // Log push attempt
      const [pushLog] = await db.insert(pushNotificationLogs).values({
        recipientUserId,
        title,
        body,
        data: data ? JSON.stringify(data) : undefined,
        category,
        relatedEntityType,
        relatedEntityId,
        status: 'pending',
      } as any).returning();

      // Try to send via notification service
      try {
        await notificationWS.sendToUser(recipientUserId, { type: 'notification', title, body, data });

        await db.update(pushNotificationLogs)
          .set({ status: 'sent', sentAt: new Date() })
          .where(eq(pushNotificationLogs.id, pushLog.id));

        res.json({ success: true });
      } catch (sendErr: any) {
        await db.update(pushNotificationLogs)
          .set({ status: 'failed', errorMessage: sendErr.message })
          .where(eq(pushNotificationLogs.id, pushLog.id));

        res.json({ success: false, error: sendErr.message });
      }
    } catch (err: any) {
      console.error("Send push error:", err);
      res.status(500).json({ message: "Failed to send push notification" });
    }
  });

  // Bulk send push notification
  app.post("/api/admin/send-bulk-push", adminAuth, requirePermission("notifications.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { userIds, title, body, data, category } = req.body;

      const results: any[] = [];
      for (const userId of userIds) {
        try {
          await notificationWS.sendToUser(userId, { type: 'notification', title, body, data });

          await db.insert(pushNotificationLogs).values({
            recipientUserId: userId,
            title,
            body,
            data: data ? JSON.stringify(data) : undefined,
            category,
            status: 'sent',
            sentAt: new Date(),
          } as any);

          results.push({ userId, success: true });
        } catch (err: any) {
          results.push({ userId, success: false, error: err.message });
        }
      }

      res.json({ sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results });
    } catch (err: any) {
      console.error("Bulk push error:", err);
      res.status(500).json({ message: "Failed to send bulk push" });
    }
  });

  // ============================================
  // System Health Check API
  // ============================================

  // Health check for all integrations
  app.post("/api/admin/integration-health/check", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const checkResults: any[] = [];

      // Check Database
      try {
        await db.execute(sql`SELECT 1`);
        checkResults.push({ serviceName: 'PostgreSQL', serviceType: 'database', status: 'healthy' });
      } catch {
        checkResults.push({ serviceName: 'PostgreSQL', serviceType: 'database', status: 'down' });
      }

      // Check SMS (Solapi)
      if (process.env.SOLAPI_API_KEY) {
        checkResults.push({ serviceName: 'Solapi SMS', serviceType: 'sms', status: 'healthy' });
      } else {
        checkResults.push({ serviceName: 'Solapi SMS', serviceType: 'sms', status: 'not_configured' });
      }

      // Check Popbill
      if (process.env.POPBILL_LINK_ID) {
        checkResults.push({ serviceName: 'Popbill', serviceType: 'tax_invoice', status: 'healthy' });
      } else {
        checkResults.push({ serviceName: 'Popbill', serviceType: 'tax_invoice', status: 'not_configured' });
      }

      // Check Kakao OAuth
      if (process.env.KAKAO_REST_API_KEY) {
        checkResults.push({ serviceName: 'Kakao OAuth', serviceType: 'oauth', status: 'healthy' });
      } else {
        checkResults.push({ serviceName: 'Kakao OAuth', serviceType: 'oauth', status: 'not_configured' });
      }

      // Update integration_health table
      for (const result of checkResults) {
        const existing = await db.select().from(integrationHealth)
          .where(eq(integrationHealth.serviceName, result.serviceName));

        if (existing.length > 0) {
          await db.update(integrationHealth)
            .set({
              status: result.status,
              lastCheckAt: new Date(),
              lastSuccessAt: result.status === 'healthy' ? new Date() : undefined,
              lastFailureAt: result.status === 'down' ? new Date() : undefined,
            })
            .where(eq(integrationHealth.serviceName, result.serviceName));
        } else {
          await db.insert(integrationHealth).values({
            serviceName: result.serviceName,
            serviceType: result.serviceType,
            status: result.status,
            lastCheckAt: new Date(),
            lastSuccessAt: result.status === 'healthy' ? new Date() : undefined,
          });
        }
      }

      res.json({ checked: checkResults.length, results: checkResults });
    } catch (err: any) {
      console.error("Health check error:", err);
      res.status(500).json({ message: "Failed to perform health check" });
    }
  });


  // ============================================
  // 차감(Deduction) 관리 API
  // ============================================

  // GET /api/admin/deductions - 차감 목록 조회
  app.get("/api/admin/deductions", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { status, startDate, endDate } = req.query;

      const conditions: any[] = [];
      if (status && status !== "all") {
        conditions.push(eq(deductions.status, status as string));
      }
      if (startDate) {
        conditions.push(gte(deductions.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(deductions.createdAt, new Date(endDate as string)));
      }

      const results = await db.select({
        deduction: deductions,
        helper: {
          id: users.id,
          name: users.name,
          phone: users.phoneNumber,
        },
        order: {
          id: orders.id,
          courierCompany: orders.courierCompany,
          scheduledDate: orders.scheduledDate,
        },
      })
        .from(deductions)
        .leftJoin(users, eq(deductions.targetId, users.id))
        .leftJoin(orders, eq(deductions.orderId, orders.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(deductions.createdAt));

      const formatted = results.map(r => ({
        ...r.deduction,
        targetName: r.helper?.name || null,
        targetPhone: r.helper?.phone || null,
        orderInfo: r.order ? {
          id: r.order.id,
          courierCompany: r.order.courierCompany,
          scheduledDate: r.order.scheduledDate,
        } : null,
      }));

      res.json(formatted);
    } catch (err: any) {
      console.error("Get deductions error:", err);
      res.status(500).json({ message: "차감 목록 조회에 실패했습니다" });
    }
  });

  // PATCH /api/admin/deductions/:id/apply - 차감 적용
  app.patch("/api/admin/deductions/:id/apply", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { settlementId, memo } = req.body;

      const [deduction] = await db.select().from(deductions).where(eq(deductions.id, id));
      if (!deduction) {
        return res.status(404).json({ message: "차감 내역을 찾을 수 없습니다" });
      }

      if (deduction.status !== "pending") {
        return res.status(400).json({ message: "적용할 수 없는 상태입니다: " + deduction.status });
      }

      const [updated] = await db.update(deductions)
        .set({
          status: "applied",
          appliedToSettlementId: settlementId || null,
          appliedAt: new Date(),
          appliedBy: adminUser?.id,
          memo: memo || deduction.memo,
          updatedAt: new Date(),
        })
        .where(eq(deductions.id, id))
        .returning();

      res.json({ success: true, deduction: updated });
    } catch (err: any) {
      console.error("Apply deduction error:", err);
      res.status(500).json({ message: "차감 적용에 실패했습니다" });
    }
  });

  // PATCH /api/admin/deductions/:id/cancel - 차감 취소
  app.patch("/api/admin/deductions/:id/cancel", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { reason } = req.body;

      const [deduction] = await db.select().from(deductions).where(eq(deductions.id, id));
      if (!deduction) {
        return res.status(404).json({ message: "차감 내역을 찾을 수 없습니다" });
      }

      if (deduction.status === "applied") {
        return res.status(400).json({ message: "이미 적용된 차감은 취소할 수 없습니다" });
      }

      const [updated] = await db.update(deductions)
        .set({
          status: "cancelled",
          memo: reason || deduction.memo,
          updatedAt: new Date(),
        })
        .where(eq(deductions.id, id))
        .returning();

      if (deduction.incidentId) {
        await db.update(incidentReports)
          .set({ status: "resolved", deductionAmount: 0 })
          .where(eq(incidentReports.id, deduction.incidentId));
      }

      res.json({ success: true, deduction: updated });
    } catch (err: any) {
      console.error("Cancel deduction error:", err);
      res.status(500).json({ message: "차감 취소에 실패했습니다" });
    }
  });

  // POST /api/admin/deductions - 수동 차감 생성
  app.post("/api/admin/deductions", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { orderId, targetType, targetId, amount, reason, category, memo } = req.body;

      if (!targetId || !amount || !reason) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
      }

      const [created] = await db.insert(deductions).values({
        orderId: orderId || null,
        targetType: targetType || "helper",
        targetId,
        amount,
        reason,
        category: category || "other",
        status: "pending",
        createdBy: adminUser?.id,
        memo,
      }).returning();

      res.json({ success: true, deduction: created });
    } catch (err: any) {
      console.error("Create deduction error:", err);
      res.status(500).json({ message: "차감 생성에 실패했습니다" });
    }
  });


  // ============================================
  // 헬퍼 서류 관리 API
  // ============================================

  // GET /api/helpers/documents/status - 서류 제출 상태 조회
  app.get("/api/helpers/documents/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const documents = await db.select()
        .from(helperDocuments)
        .where(eq(helperDocuments.userId, userId));

      // 자동 보정: 모든 필수 서류가 승인되었는데 onboardingStatus가 approved가 아닌 경우 갱신
      const user = req.user!;
      if (user.onboardingStatus !== "approved") {
        const requiredTypes = ["businessCert", "driverLicense", "cargoLicense", "vehicleCert", "transportContract"];
        const allApproved = requiredTypes.every(type =>
          documents.some(d => d.documentType === type && d.status === "approved")
        );
        if (allApproved) {
          await db.update(users)
            .set({
              onboardingStatus: "approved",
              helperVerified: true,
              helperVerifiedAt: new Date(),
            })
            .where(eq(users.id, userId));
          console.log(`[Onboarding Auto-fix] Helper ${userId} all documents already approved → onboardingStatus=approved`);
        }
      }

      res.json(documents);
    } catch (err: any) {
      console.error("Documents status fetch error:", err);
      res.status(500).json({ message: "서류 상태 조회에 실패했습니다" });
    }
  });

  // GET /api/helpers/documents/:type - 특정 서류 조회
  app.get("/api/helpers/documents/:type", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const documentType = req.params.type;

      const [document] = await db.select()
        .from(helperDocuments)
        .where(and(
          eq(helperDocuments.userId, userId),
          eq(helperDocuments.documentType, documentType)
        ));

      if (!document) {
        return res.status(404).json({ message: "서류를 찾을 수 없습니다" });
      }

      res.json(document);
    } catch (err: any) {
      console.error("Document fetch error:", err);
      res.status(500).json({ message: "서류 조회에 실패했습니다" });
    }
  });

  // POST /api/helpers/documents/:type - 서류 제출/재제출
  const uploadHelperDocument = multer({
    storage: multer.diskStorage({
      destination: (_req: any, _file: any, cb: any) => cb(null, "uploads/"),
      filename: (_req: any, file: any, cb: any) => cb(null, `doc_${Date.now()}_${file.originalname}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream'];
      const allowedExtensions = /\.(jpeg|jpg|png|webp|pdf)$/i;
      if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.test(file.originalname)) {
        cb(null, true);
      } else {
        cb(new Error("이미지 또는 PDF 파일만 업로드 가능합니다"));
      }
    },
  });
  // 화물위탁계약서는 JSON body로 제출하므로 multer 스킵
  const conditionalUpload = (req: any, res: any, next: any) => {
    if (req.params.type === 'transportContract') {
      return next();
    }
    uploadHelperDocument.single('file')(req, res, next);
  };
  app.post("/api/helpers/documents/:type", requireAuth, conditionalUpload, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const documentType = req.params.type;

      // 화물위탁계약서는 파일 없이 JSON 데이터로 제출
      let imageUrl: string | null = null;
      if (documentType === 'transportContract') {
        // 파일 업로드 불필요 - 계약서 생성 방식
      } else {
        if (!req.file) {
          return res.status(400).json({ message: "파일을 업로드해주세요" });
        }

        // 파일 검증 (diskStorage는 buffer가 없으므로 파일에서 읽기)
        const fileBuffer = fs.readFileSync(req.file.path);
        if (!isValidImageBuffer(fileBuffer)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "유효하지 않은 이미지 파일입니다" });
        }

        if (req.file.size > MAX_FILE_SIZE) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "파일 크기가 너무 큽니다 (최대 10MB)" });
        }

        // 파일을 documents 폴더로 이동
        const filename = `helper-doc-${userId}-${documentType}-${Date.now()}${path.extname(req.file.originalname)}`;
        const uploadDir = path.join(process.cwd(), "uploads", "documents");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filepath = path.join(uploadDir, sanitizeFilename(filename));
        fs.renameSync(req.file.path, filepath);

        imageUrl = `/uploads/documents/${filename}`;
      }

      // 서류 타입별 데이터 구성
      const documentData: any = {
        userId,
        documentType,
        ...(imageUrl && { imageUrl }),
        status: 'reviewing',
        uploadedAt: new Date(),
        updatedAt: new Date(),
      };

      // 각 서류 타입별 추가 필드
      if (documentType === 'businessCert') {
        documentData.businessNumber = req.body.businessNumber;
        documentData.businessName = req.body.businessName;
        documentData.representativeName = req.body.representativeName;
        documentData.businessAddress = req.body.businessAddress;
        documentData.businessType = req.body.businessType;
        documentData.businessCategory = req.body.businessCategory;
      } else if (documentType === 'driverLicense') {
        documentData.licenseNumber = req.body.licenseNumber;
        documentData.licenseType = req.body.licenseType;
        documentData.issueDate = req.body.issueDate;
        documentData.expiryDate = req.body.expiryDate;
      } else if (documentType === 'cargoLicense') {
        documentData.licenseNumber = req.body.licenseNumber;
        documentData.issueDate = req.body.issueDate;
      } else if (documentType === 'vehicleCert') {
        documentData.plateNumber = req.body.plateNumber;
        documentData.vehicleType = req.body.vehicleType;
        documentData.vehicleOwnerName = req.body.vehicleOwnerName;
      } else if (documentType === 'transportContract') {
        documentData.contractCompanyName = req.body.contractCompanyName;
        documentData.contractDate = req.body.contractDate;
        documentData.signatureName = req.body.signatureName;
        documentData.verificationPhone = req.body.verificationPhone;
        documentData.contractConsent = req.body.contractConsent;
      }

      // 기존 서류가 있는지 확인
      const [existing] = await db.select()
        .from(helperDocuments)
        .where(and(
          eq(helperDocuments.userId, userId),
          eq(helperDocuments.documentType, documentType)
        ));

      let document;
      if (existing) {
        // 업데이트 (재제출)
        [document] = await db.update(helperDocuments)
          .set(documentData)
          .where(eq(helperDocuments.id, existing.id))
          .returning();
      } else {
        // 신규 등록
        [document] = await db.insert(helperDocuments)
          .values(documentData)
          .returning();
      }

      res.json({ success: true, document });
    } catch (err: any) {
      console.error("Document submit error:", err);
      res.status(500).json({ message: "서류 제출에 실패했습니다" });
    }
  });


  // ============================================
  // 관리자 서류 검토 API
  // ============================================

  // GET /api/admin/helper-documents - 모든 헬퍼의 서류 목록 조회
  app.get("/api/admin/helper-documents", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const { status, documentType, userId } = req.query;

      const conditions: any[] = [];
      if (status && status !== "all") {
        conditions.push(eq(helperDocuments.status, status as string));
      }
      if (documentType) {
        conditions.push(eq(helperDocuments.documentType, documentType as string));
      }
      if (userId) {
        conditions.push(eq(helperDocuments.userId, userId as string));
      }

      const documents = await db.select({
        document: helperDocuments,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          phoneNumber: users.phoneNumber,
        },
      })
        .from(helperDocuments)
        .leftJoin(users, eq(helperDocuments.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(helperDocuments.uploadedAt));

      res.json(documents);
    } catch (err: any) {
      console.error("Admin documents fetch error:", err);
      res.status(500).json({ message: "서류 목록 조회에 실패했습니다" });
    }
  });

  // GET /api/admin/helper-documents/:id - 특정 서류 상세 조회
  app.get("/api/admin/helper-documents/:id", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [result] = await db.select({
        document: helperDocuments,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          phoneNumber: users.phoneNumber,
        },
      })
        .from(helperDocuments)
        .leftJoin(users, eq(helperDocuments.userId, users.id))
        .where(eq(helperDocuments.id, id));

      if (!result) {
        return res.status(404).json({ message: "서류를 찾을 수 없습니다" });
      }

      res.json(result);
    } catch (err: any) {
      console.error("Admin document detail fetch error:", err);
      res.status(500).json({ message: "서류 조회에 실패했습니다" });
    }
  });

  // PATCH /api/admin/helper-documents/:id/approve - 서류 승인
  app.patch("/api/admin/helper-documents/:id/approve", adminAuth, requirePermission("helpers.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { adminNote } = req.body;

      const [document] = await db.update(helperDocuments)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: adminUser?.id,
          adminNote,
          updatedAt: new Date(),
        })
        .where(eq(helperDocuments.id, id))
        .returning();

      if (!document) {
        return res.status(404).json({ message: "서류를 찾을 수 없습니다" });
      }

      // 전체 서류 승인 여부 확인 → onboardingStatus 갱신
      try {
        const allDocs = await db.select()
          .from(helperDocuments)
          .where(eq(helperDocuments.userId, document.userId));

        const requiredTypes = ["businessCert", "driverLicense", "cargoLicense", "vehicleCert", "transportContract"];
        const allApproved = requiredTypes.every(type =>
          allDocs.some(d => d.documentType === type && d.status === "approved")
        );

        if (allApproved) {
          await db.update(users)
            .set({
              onboardingStatus: "approved",
              helperVerified: true,
              helperVerifiedAt: new Date(),
            })
            .where(eq(users.id, document.userId));
          console.log(`[Onboarding] Helper ${document.userId} all documents approved → onboardingStatus=approved, helperVerified=true`);
        }
      } catch (onboardErr) {
        console.error("[Onboarding Status Error]:", onboardErr);
      }

      // 헬퍼에게 서류 승인 알림
      try {
        await storage.createNotification({
          userId: document.userId,
          type: "document_approved",
          title: "서류 승인 완료",
          message: `제출하신 서류(${document.documentType})가 승인되었습니다.`,
        });
        sendPushToUser(document.userId, {
          title: "서류 승인 완료",
          body: `제출하신 서류가 승인되었습니다.`,
          url: "/profile/documents",
        });
      } catch (notifErr) {
        console.error("[Notification Error] Document approve:", notifErr);
      }

      res.json({ success: true, document });
    } catch (err: any) {
      console.error("Document approve error:", err);
      res.status(500).json({ message: "서류 승인에 실패했습니다" });
    }
  });

  // PATCH /api/admin/helper-documents/:id/reject - 서류 반려
  app.patch("/api/admin/helper-documents/:id/reject", adminAuth, requirePermission("helpers.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { rejectionReason, adminNote } = req.body;

      if (!rejectionReason) {
        return res.status(400).json({ message: "반려 사유를 입력해주세요" });
      }

      const [document] = await db.update(helperDocuments)
        .set({
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: adminUser?.id,
          rejectionReason,
          adminNote,
          updatedAt: new Date(),
        })
        .where(eq(helperDocuments.id, id))
        .returning();

      if (!document) {
        return res.status(404).json({ message: "서류를 찾을 수 없습니다" });
      }

      // 헬퍼에게 서류 반려 알림
      try {
        await storage.createNotification({
          userId: document.userId,
          type: "document_rejected",
          title: "서류 반려",
          message: `제출하신 서류(${document.documentType})가 반려되었습니다. 사유: ${rejectionReason}`,
        });
        sendPushToUser(document.userId, {
          title: "서류 반려",
          body: `제출하신 서류가 반려되었습니다. 사유: ${rejectionReason}`,
          url: "/profile/documents",
        });
      } catch (notifErr) {
        console.error("[Notification Error] Document reject:", notifErr);
      }

      res.json({ success: true, document });
    } catch (err: any) {
      console.error("Document reject error:", err);
      res.status(500).json({ message: "서류 반려에 실패했습니다" });
    }
  });

  // ============================================
  // 협력업체 관리 (Enterprise Accounts)
  // ============================================

  // GET /api/admin/enterprise-accounts — 전체 목록
  app.get("/api/admin/enterprise-accounts", adminAuth, requirePermission("settings.edit"), async (_req, res) => {
    try {
      const accounts = await storage.getAllEnterpriseAccounts();
      res.json(accounts);
    } catch (err: any) {
      console.error("Enterprise accounts list error:", err);
      res.status(500).json({ message: "협력업체 목록 조회에 실패했습니다" });
    }
  });

  // GET /api/admin/enterprise-accounts/search — 이름 검색 (오더등록 모달용)
  app.get("/api/admin/enterprise-accounts/search", adminAuth, async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (!q) {
        return res.json([]);
      }
      const all = await db
        .select()
        .from(enterpriseAccounts)
        .where(
          and(
            eq(enterpriseAccounts.isActive, true),
            sql`${enterpriseAccounts.name} ILIKE ${'%' + q + '%'}`
          )
        )
        .orderBy(enterpriseAccounts.name)
        .limit(20);
      res.json(all);
    } catch (err: any) {
      console.error("Enterprise accounts search error:", err);
      res.status(500).json({ message: "협력업체 검색에 실패했습니다" });
    }
  });

  // POST /api/admin/enterprise-accounts — 생성
  app.post("/api/admin/enterprise-accounts", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { name, businessNumber, contactName, contactPhone, contactEmail, commissionRate,
        representativeName, businessType, businessItem, address, faxNumber, taxEmail,
        bankName, accountNumber, accountHolder, memo,
        contractStartDate, contractEndDate, settlementModel, taxType } = req.body;
      if (!name || !businessNumber) {
        return res.status(400).json({ message: "업체명과 사업자등록번호는 필수입니다" });
      }
      const account = await storage.createEnterpriseAccount({
        name,
        businessNumber,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        commissionRate: commissionRate != null ? commissionRate : 10,
        representativeName: representativeName || null,
        businessType: businessType || null,
        businessItem: businessItem || null,
        address: address || null,
        faxNumber: faxNumber || null,
        taxEmail: taxEmail || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        accountHolder: accountHolder || null,
        memo: memo || null,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        settlementModel: settlementModel || 'per_order',
        taxType: taxType || 'exclusive',
      });
      res.json(account);
    } catch (err: any) {
      console.error("Enterprise account create error:", err);
      res.status(500).json({ message: "협력업체 등록에 실패했습니다" });
    }
  });

  // PATCH /api/admin/enterprise-accounts/:id — 수정
  app.patch("/api/admin/enterprise-accounts/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, businessNumber, contactName, contactPhone, contactEmail, commissionRate, isActive,
        representativeName, businessType, businessItem, address, faxNumber, taxEmail,
        bankName, accountNumber, accountHolder, memo,
        contractStartDate, contractEndDate, settlementModel, taxType } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (businessNumber !== undefined) updates.businessNumber = businessNumber;
      if (contactName !== undefined) updates.contactName = contactName;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail;
      if (commissionRate !== undefined) updates.commissionRate = commissionRate;
      if (isActive !== undefined) updates.isActive = isActive;
      if (representativeName !== undefined) updates.representativeName = representativeName;
      if (businessType !== undefined) updates.businessType = businessType;
      if (businessItem !== undefined) updates.businessItem = businessItem;
      if (address !== undefined) updates.address = address;
      if (faxNumber !== undefined) updates.faxNumber = faxNumber;
      if (taxEmail !== undefined) updates.taxEmail = taxEmail;
      if (bankName !== undefined) updates.bankName = bankName;
      if (accountNumber !== undefined) updates.accountNumber = accountNumber;
      if (accountHolder !== undefined) updates.accountHolder = accountHolder;
      if (memo !== undefined) updates.memo = memo;
      if (contractStartDate !== undefined) updates.contractStartDate = contractStartDate;
      if (contractEndDate !== undefined) updates.contractEndDate = contractEndDate;
      if (settlementModel !== undefined) updates.settlementModel = settlementModel;
      if (taxType !== undefined) updates.taxType = taxType;

      const account = await storage.updateEnterpriseAccount(id, updates);
      res.json(account);
    } catch (err: any) {
      console.error("Enterprise account update error:", err);
      res.status(500).json({ message: "협력업체 수정에 실패했습니다" });
    }
  });

  // DELETE /api/admin/enterprise-accounts/:id — 비활성화
  app.delete("/api/admin/enterprise-accounts/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const account = await storage.updateEnterpriseAccount(id, { isActive: false });
      res.json({ success: true, account });
    } catch (err: any) {
      console.error("Enterprise account deactivate error:", err);
      res.status(500).json({ message: "협력업체 비활성화에 실패했습니다" });
    }
  });
}

