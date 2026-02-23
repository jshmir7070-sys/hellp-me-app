/**
 * Admin routes
 *
 * Admin auth, staff management, order management, contract management,
 * settlement management, helper/requester document management,
 * dispute management, incident management, policy management,
 * system settings, data management, SMS templates, etc.
 */

import type { RouteContext } from "../../types";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import {
  ORDER_STATUS,
} from "../../constants/order-status";
import {
  calculateVat,
  calculateSettlement,
  parseClosingReport,
} from "../../lib/settlement-calculator";

export async function registerSettlementRoutes(ctx: RouteContext): Promise<void> {
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
    getIndustrialAccidentInsuranceRate,
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
    destinationRegions, timeSlots, enterpriseAccounts, monthlySettlementStatements,
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

  // POST /api/admin/settlements/:id/confirm - 정산 확정 (증빙 검증 필수)
  app.post("/api/admin/settlements/:id/confirm", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { adminMemo } = req.body;

      // Idempotency check
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, isConflict, cachedResponse } = await checkIdempotency(
          adminUser?.id || "admin",
          `POST:/api/admin/settlements/${id}/confirm`,
          idempotencyKey,
          req.body
        );
        if (isConflict) {
          return res.status(409).json({
            error: { code: "IDEMPOTENCY_CONFLICT", message: "동일 Idempotency-Key에 다른 요청이 감지되었습니다." }
          });
        }
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached settlement confirm for ${id}, key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      // Get settlement
      const settlement = await storage.getSettlementStatement(id);
      if (!settlement) {
        return res.status(404).json({ message: "정산을 찾을 수 없습니다" });
      }

      // 이미 확정/지급/취소된 정산은 재확인 불가
      const completedStatuses = ["confirmed", "paid", "cancelled"];
      if (completedStatuses.includes(settlement.status || "")) {
        return res.status(409).json({
          code: "ALREADY_PROCESSED",
          message: `이미 ${settlement.status === "confirmed" ? "확정" : settlement.status === "paid" ? "지급" : "취소"}된 정산입니다.`,
        });
      }

      // Get order
      const order = await storage.getOrder(settlement.orderId!);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // Check closing report has delivery history images (MANDATORY)
      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, settlement.orderId!))
        .limit(1);

      const deliveryHistoryImages = closingReport?.deliveryHistoryImagesJson
        ? JSON.parse(closingReport.deliveryHistoryImagesJson)
        : [];

      if (deliveryHistoryImages.length === 0) {
        return res.status(400).json({
          code: "MISSING_EVIDENCE",
          message: "집배송 이력 이미지가 없어 정산을 확정할 수 없습니다. 헬퍼에게 증빙 제출을 요청해주세요.",
        });
      }

      // Check if there are unresolved disputes
      const incidents = await storage.getIncidentReportsByOrder(settlement.orderId!);
      const unresolvedDisputes = incidents.filter(i =>
        i.status === "requested" || i.status === "submitted" || i.status === "reviewing"
      );

      if (unresolvedDisputes.length > 0) {
        return res.status(400).json({
          code: "UNRESOLVED_DISPUTES",
          message: `미해결 분쟁이 ${unresolvedDisputes.length}건 있습니다. 분쟁 해결 후 정산을 확정해주세요.`,
          disputes: unresolvedDisputes.map(d => ({ id: d.id, status: d.status, type: d.type })),
        });
      }

      // Update settlement status
      await db.update(settlementStatements)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedBy: adminUser?.id,
        })
        .where(eq(settlementStatements.id, id));

      // Update order status to SETTLED
      await db.update(orders)
        .set({ status: "settled" })
        .where(eq(orders.id, settlement.orderId!));

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "SETTLEMENT_CONFIRMED",
        orderId: settlement.orderId,
        settlementId: id,
        targetType: "settlement",
        targetId: String(id),
        reason: adminMemo || "정산 확정",
        oldValue: JSON.stringify({ status: settlement.status }),
        newValue: JSON.stringify({ status: "confirmed" }),
      });

      const confirmResponse = {
        success: true,
        message: "정산이 확정되었습니다",
        settlementId: id,
        orderStatus: "settled",
      };

      // Store idempotency response
      if (idempotencyKey) {
        await storeIdempotencyResponse(adminUser?.id || "admin", `POST:/api/admin/settlements/${id}/confirm`, idempotencyKey, 200, confirmResponse, req.body);
      }

      res.json(confirmResponse);
    } catch (err: any) {
      console.error("Confirm settlement error:", err);
      res.status(500).json({ message: "정산 확정에 실패했습니다" });
    }
  });

  // GET /api/admin/settlements/:id/validation - 정산 확정 조건 검증
  app.get("/api/admin/settlements/:id/validation", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const id = Number(req.params.id);

      const settlement = await storage.getSettlementStatement(id);
      if (!settlement) {
        return res.status(404).json({ message: "정산을 찾을 수 없습니다" });
      }

      const order = await storage.getOrder(settlement.orderId!);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // Check closing report
      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, settlement.orderId!))
        .limit(1);

      const deliveryHistoryImages = closingReport?.deliveryHistoryImagesJson
        ? JSON.parse(closingReport.deliveryHistoryImagesJson)
        : [];

      // Check disputes
      const incidents = await storage.getIncidentReportsByOrder(settlement.orderId!);
      const unresolvedDisputes = incidents.filter(i =>
        i.status === "requested" || i.status === "submitted" || i.status === "reviewing"
      );

      const canConfirm = deliveryHistoryImages.length > 0 && unresolvedDisputes.length === 0;

      res.json({
        settlementId: id,
        orderId: settlement.orderId,
        canConfirm,
        validations: {
          hasDeliveryHistoryImages: deliveryHistoryImages.length > 0,
          deliveryHistoryImageCount: deliveryHistoryImages.length,
          hasUnresolvedDisputes: unresolvedDisputes.length > 0,
          unresolvedDisputeCount: unresolvedDisputes.length,
          unresolvedDisputes: unresolvedDisputes.map(d => ({ id: d.id, status: d.status, type: d.type })),
        },
        closingReport: closingReport ? {
          id: closingReport.id,
          status: closingReport.status,
          submittedAt: closingReport.createdAt,
        } : null,
      });
    } catch (err: any) {
      console.error("Validate settlement error:", err);
      res.status(500).json({ message: "정산 검증에 실패했습니다" });
    }
  });

  // Get all client errors (admin)
  app.get("/api/admin/client-errors", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { severity, isResolved, limit } = req.query;
      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit as string) || 100, 1), 500) : 100;
      const errors = await storage.getAllClientErrors({
        severity: severity as string | undefined,
        isResolved: isResolved === 'true' ? true : isResolved === 'false' ? false : undefined,
        limit: parsedLimit,
      });
      res.json(errors);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resolve client error (admin)
  app.patch("/api/admin/client-errors/:id/resolve", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;

      const error = await storage.getClientError(id);
      if (!error) {
        return res.status(404).json({ message: "에러를 찾을 수 없습니다" });
      }

      const updated = await storage.updateClientError(id, {
        isResolved: true,
        resolvedBy: user.id,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Daily settlement list (일일 정산 목록)
  app.get("/api/admin/settlements/daily", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const searchTerm = req.query.search as string;
      const offset = (page - 1) * limit;

      const closingReportsList = await db.select().from(closingReports)
        .where(
          startDate && endDate
            ? and(
              gte(closingReports.createdAt, new Date(startDate as string)),
              lte(closingReports.createdAt, new Date(endDate as string + "T23:59:59"))
            )
            : undefined
        )
        .orderBy(desc(closingReports.createdAt));

      const users = await storage.getAllUsers();
      const orders = await storage.getOrders();
      const enterpriseList = await db.select().from(enterpriseAccounts);
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const orderMap = new Map<number, any>(orders.map(o => [o.id, o]));
      const enterpriseMap = new Map<number, any>(enterpriseList.map(e => [e.id, e]));

      let allResults = closingReportsList.map(cr => {
        const order = orderMap.get(cr.orderId);
        const helper = order?.matchedHelperId ? userMap.get(order.matchedHelperId) : null;
        const enterprise = order?.enterpriseId ? enterpriseMap.get(order.enterpriseId) : null;
        const requester = order?.requesterId ? userMap.get(order.requesterId) : null;

        const pricePerBox = order?.pricePerUnit || 0;
        const extraCostsJson = cr.extraCostsJson ? (typeof cr.extraCostsJson === "string" ? JSON.parse(cr.extraCostsJson) : cr.extraCostsJson) : null;

        // SSOT: 스냅샷 우선, 없으면 calculateSettlement 사용
        let supplyPrice: number, vat: number, finalTotal: number, platformFee: number, driverPayout: number;
        if (cr.supplyAmount) {
          supplyPrice = Number(cr.supplyAmount) || 0;
          vat = Number(cr.vatAmount) || 0;
          finalTotal = Number(cr.totalAmount) || 0;
          platformFee = Number(cr.platformFee) || 0;
          driverPayout = Number(cr.netAmount) || 0;
        } else {
          const closingData = parseClosingReport(cr, order || { pricePerUnit: 0 });
          const settlement = calculateSettlement(closingData);
          supplyPrice = settlement.supplyAmount;
          vat = settlement.vatAmount;
          finalTotal = settlement.totalAmount;
          const platformFeeRate = cr.platformFeeRate ? Number(cr.platformFeeRate) / 10000 : 0;
          platformFee = Math.round(finalTotal * platformFeeRate);
          driverPayout = finalTotal - platformFee;
        }

        return {
          id: cr.id,
          orderId: cr.orderId,
          orderNumber: order?.orderNumber || null,
          helperId: order?.matchedHelperId || 0,
          helperName: helper?.name || "Unknown",
          helperPhone: helper?.phoneNumber || null,
          requesterName: requester?.name || null,
          enterpriseName: enterprise?.name || null,
          category: "parcel",
          courierCompany: order?.courierCompany || order?.companyName || null,
          deliveredCount: cr.deliveredCount || 0,
          returnedCount: cr.returnedCount || 0,
          etcCount: cr.etcCount || 0,
          etcPricePerUnit: cr.etcPricePerUnit || 0,
          extraCostsJson,
          closingMemo: cr.memo || "",
          createdAt: cr.createdAt,
          pricePerBox,
          driverPayout,
          platformFee,
          finalTotal,
        };
      });

      // 검색 필터 적용
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        allResults = allResults.filter(item =>
          String(item.orderId).includes(search) ||
          item.orderNumber?.toLowerCase().includes(search) ||
          item.helperName?.toLowerCase().includes(search) ||
          item.requesterName?.toLowerCase().includes(search) ||
          item.courierCompany?.toLowerCase().includes(search) ||
          item.enterpriseName?.toLowerCase().includes(search)
        );
      }

      const totalCount = allResults.length;
      const totalPages = Math.ceil(totalCount / limit);

      // 페이지네이션 적용
      const paginatedResults = allResults.slice(offset, offset + limit);

      res.json({
        data: paginatedResults,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
        },
      });
    } catch (err: any) {
      console.error("Daily settlement error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper monthly settlement (헬퍼별 월간 정산)
  app.get("/api/admin/settlements/helper", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // closingReports 테이블에서 마감 데이터 조회
      const closingReportsList = await db.select().from(closingReports)
        .where(
          startDate && endDate
            ? and(
              gte(closingReports.createdAt, new Date(startDate as string)),
              lte(closingReports.createdAt, new Date(endDate as string + "T23:59:59"))
            )
            : undefined
        );

      const users = await storage.getAllUsers();
      const orders = await storage.getOrders();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const orderMap = new Map<number, any>(orders.map(o => [o.id, o]));

      const helperMap = new Map<string | number, any>();

      for (const cr of closingReportsList) {
        const order = orderMap.get(cr.orderId);
        const helperId = cr.helperId || order?.matchedHelperId;
        if (!helperId) continue;

        const existing = helperMap.get(helperId) || {
          helperName: "",
          helperPhone: "",
          helperEmail: "",
          orderCount: 0,
          supplyPrice: 0,
          vat: 0,
          totalAmount: 0,
          platformFee: 0,
          deductedAmount: 0,
          deductions: 0,
          cargoIncident: 0,
          driverPayout: 0,
        };

        const helper = userMap.get(helperId);
        existing.helperName = helper?.name || "Unknown";
        existing.helperPhone = helper?.phoneNumber || "";
        existing.helperEmail = helper?.email || "";
        existing.orderCount += 1;

        // SSOT: 스냅샷 우선, 없으면 calculateSettlement 사용
        if (cr.supplyAmount) {
          existing.supplyPrice += Number(cr.supplyAmount) || 0;
          existing.vat += Number(cr.vatAmount) || 0;
          existing.totalAmount += Number(cr.totalAmount) || 0;
          existing.platformFee += Number(cr.platformFee) || 0;
          existing.driverPayout += Number(cr.netAmount) || 0;
        } else {
          const closingData = parseClosingReport(cr, order || { pricePerUnit: 0 });
          const settlement = calculateSettlement(closingData);
          const platformFeeRate = cr.platformFeeRate ? Number(cr.platformFeeRate) / 10000 : 0;
          const platformFee = Math.round(settlement.totalAmount * platformFeeRate);
          const driverPayout = settlement.totalAmount - platformFee;

          existing.supplyPrice += settlement.supplyAmount;
          existing.vat += settlement.vatAmount;
          existing.totalAmount += settlement.totalAmount;
          existing.platformFee += platformFee;
          existing.driverPayout += driverPayout;
        }

        helperMap.set(helperId, existing);
      }

      // helperId를 응답에 포함 (기존 key에만 있고 value에 없던 버그 수정)
      const result = Array.from(helperMap.entries()).map(([id, data]) => ({
        helperId: id,
        ...data,
      }));
      res.json(result);
    } catch (err: any) {
      console.error("Helper settlement error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 일괄 송금 완료 처리 API
  app.post("/api/admin/settlements/bulk-transfer", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const { helperIds, transferDate, transferNote } = req.body;
      const adminUserId = (req as any).adminUser?.id;

      if (!helperIds || !Array.isArray(helperIds) || helperIds.length === 0) {
        return res.status(400).json({ message: "helperIds는 필수 항목입니다." });
      }

      if (!transferDate) {
        return res.status(400).json({ message: "송금일(transferDate)을 지정해주세요." });
      }

      // 해당 헬퍼들의 CALCULATED 상태 정산 건을 PAID로 업데이트
      const result = await db.update(settlementRecords)
        .set({
          status: "PAID",
          paidAt: new Date(transferDate),
          paidBy: adminUserId,
          paymentReference: transferNote || `일괄 송금 처리 (${new Date(transferDate).toLocaleDateString('ko-KR')})`,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(settlementRecords.helperId, helperIds.map(String)),
            eq(settlementRecords.status, "CALCULATED"),
          )
        )
        .returning({ id: settlementRecords.id });

      res.json({ success: true, count: result.length });
    } catch (err: any) {
      console.error("Bulk transfer error:", err);
      res.status(500).json({ message: "일괄 송금 처리 실패" });
    }
  });

  // 헬퍼별 상세 이용내역 API (거래명세서 스타일)
  app.get("/api/admin/settlements/helper/:helperId/orders", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const helperId = req.params.helperId;
      const { startDate, endDate } = req.query;

      const closingReportsList = await db.select().from(closingReports)
        .where(
          and(
            eq(closingReports.helperId, helperId),
            startDate && endDate
              ? and(
                gte(closingReports.createdAt, new Date(startDate as string)),
                lte(closingReports.createdAt, new Date(endDate as string + "T23:59:59"))
              )
              : undefined
          )
        )
        .orderBy(desc(closingReports.createdAt));

      const allOrders = await storage.getOrders();
      const orderMap = new Map<number, any>(allOrders.map(o => [o.id, o]));
      const allCourierSettings = await storage.getAllCourierSettings();
      const allUsers = await storage.getAllUsers();
      const userMap = new Map<string, any>(allUsers.map(u => [u.id, u]));

      // 산재보험료율 조회 (SSOT: settlement-calculator.ts와 동일 공식)
      const insuranceRateSetting = await storage.getSystemSetting('industrial_accident_insurance_rate');
      const insuranceRate = insuranceRateSetting ? parseFloat(insuranceRateSetting.settingValue) : 1.06;

      // 헬퍼 정보
      const helperUser = userMap.get(helperId);

      let totalSupply = 0, totalVat = 0, totalAmount = 0, totalDeduction = 0, totalPayout = 0;
      let totalInsurance = 0, totalDamageDeduction = 0;

      const orderDetails = await Promise.all(closingReportsList.map(async (cr) => {
        const order = orderMap.get(cr.orderId);
        const deliveredCount = cr.deliveredCount || 0;
        const returnedCount = cr.returnedCount || 0;
        const etcCount = cr.etcCount || 0;
        const pricePerBox = order?.pricePerUnit || 0;
        const etcPricePerUnit = cr.etcPricePerUnit || 0;

        // 카테고리 결정
        const courierSetting = allCourierSettings.find(c => c.courierName === order?.companyName);
        let category = "택배";
        if (courierSetting?.category === "freight") category = "냉탑전용";
        else if (courierSetting?.category === "etc") category = "기타택배";

        // 요청자 정보
        const requesterUser = order?.requesterId ? userMap.get(order.requesterId) : null;

        // SSOT: 스냅샷 우선, 없으면 calculateSettlement 사용
        let supplyAmount: number, vatAmount: number, total: number, platformFee: number;
        if (cr.supplyAmount) {
          supplyAmount = Number(cr.supplyAmount) || 0;
          vatAmount = Number(cr.vatAmount) || 0;
          total = Number(cr.totalAmount) || 0;
          platformFee = Number(cr.platformFee) || 0;
        } else {
          const closingData = parseClosingReport(cr, order || { pricePerUnit: 0 });
          const settlement = calculateSettlement(closingData);
          supplyAmount = settlement.supplyAmount;
          vatAmount = settlement.vatAmount;
          total = settlement.totalAmount;
          const feeRate = cr.platformFeeRate ? Number(cr.platformFeeRate) / 10000 : 0;
          platformFee = Math.round(total * feeRate);
        }

        // 산재보험료 계산 (SSOT: totalAmount × insuranceRate% × 50%)
        const insurance = Math.round(total * (insuranceRate / 100) * 0.5);

        // 차감액 조회 (사고차감 + 관리자 수동 조정)
        let damageDeduction = 0;
        const deductionBreakdown: Array<{ type: string; label: string; amount: number; reason?: string }> = [];
        let adminMemo = "";
        try {
          // 1. 사고 차감 (incidentReports — 월정산서 생성 로직과 동일)
          const incidents = await db.select().from(incidentReports)
            .where(and(
              eq(incidentReports.orderId, cr.orderId),
              eq(incidentReports.helperDeductionApplied, true)
            ));
          for (const ir of incidents) {
            const amt = ir.deductionAmount || 0;
            damageDeduction += amt;
            if (amt > 0) {
              deductionBreakdown.push({
                type: "incident",
                label: "화물사고",
                amount: amt,
                reason: ir.description || "",
              });
            }
          }

          // 2. 관리자 수동 차감 (deductions 테이블)
          const adminDeductions = await db.select().from(deductions)
            .where(and(
              eq(deductions.orderId, cr.orderId),
              eq(deductions.category, "ADMIN_ADJUSTMENT")
            ));
          for (const d of adminDeductions) {
            damageDeduction += (d.amount || 0);
            deductionBreakdown.push({
              type: "admin",
              label: "관리자 조정",
              amount: d.amount || 0,
              reason: d.reason || "",
            });
            if (d.memo) adminMemo = d.memo;
          }
        } catch { /* ignore */ }

        totalSupply += supplyAmount;
        totalVat += vatAmount;
        totalAmount += total;
        totalDeduction += platformFee;
        totalInsurance += insurance;
        totalDamageDeduction += damageDeduction;
        // 지급액 = 총액 - 수수료 - 산재보험 - 차감액 (SSOT 공식 통일)
        totalPayout += (total - platformFee - insurance - damageDeduction);

        // 차감 상세 내역
        const deductionDetails: string[] = [];
        if (platformFee > 0) {
          const feeRate = cr.platformFeeRate ? Number(cr.platformFeeRate) / 100 : 0;
          deductionDetails.push(`플랫폼 수수료 ${feeRate}%: ${platformFee.toLocaleString()}원`);
        }

        return {
          orderId: cr.orderId,
          date: cr.createdAt,
          category,
          courierCompany: order?.companyName || order?.courierCompany || "-",
          helperName: helperUser?.name || "",
          helperEmail: helperUser?.email || "",
          requesterName: requesterUser?.name || "",
          deliveredCount,
          returnedCount,
          pricePerBox,
          etcCount,
          etcPricePerUnit,
          supplyAmount,
          vatAmount,
          totalAmount: total,
          insurance,
          damageDeduction,
          deductionBreakdown,
          adminMemo,
          deduction: platformFee,
          // 지급액 = 총액 - 수수료 - 산재보험 - 차감액 (SSOT 공식 통일)
          payout: total - platformFee - insurance - damageDeduction,
          deductionDetails,
          memo: cr.memo || "",
        };
      }));

      res.json({
        orders: orderDetails,
        summary: {
          totalSupply,
          totalVat,
          totalAmount,
          totalDeduction,
          totalPayout,
          totalInsurance,
          totalDamageDeduction,
          insuranceRate,
        }
      });
    } catch (err: any) {
      console.error("Helper orders detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더별 차감액 수정 API (관리자 수동 조정)
  app.patch("/api/admin/settlements/helper/:helperId/orders/:orderId/deduction", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const { helperId, orderId } = req.params;
      const { deductionAmount, reason, adminMemo } = req.body;
      const adminUserId = (req as any).adminUser?.id;

      if (deductionAmount === undefined || deductionAmount === null) {
        return res.status(400).json({ message: "차감액(deductionAmount)은 필수 항목입니다." });
      }

      // 해당 마감 건 확인
      const crList = await db.select().from(closingReports)
        .where(and(
          eq(closingReports.helperId, helperId),
          eq(closingReports.orderId, Number(orderId))
        ))
        .limit(1);

      if (!crList.length) {
        return res.status(404).json({ message: "해당 마감 건을 찾을 수 없습니다." });
      }

      // 기존 관리자 수동 차감 조회
      const existingDeductions = await db.select().from(deductions)
        .where(and(
          eq(deductions.orderId, Number(orderId)),
          eq(deductions.category, "ADMIN_ADJUSTMENT")
        ));

      if (existingDeductions.length > 0) {
        if (Number(deductionAmount) === 0) {
          // 차감액이 0이면 기존 기록 삭제
          await db.delete(deductions)
            .where(eq(deductions.id, existingDeductions[0].id));
        } else {
          // 기존 차감 업데이트
          await db.update(deductions)
            .set({
              amount: Number(deductionAmount),
              reason: reason || "관리자 수동 조정",
              memo: adminMemo || existingDeductions[0].memo || null,
              updatedAt: new Date(),
            })
            .where(eq(deductions.id, existingDeductions[0].id));
        }
      } else if (Number(deductionAmount) > 0) {
        // 새 차감 생성
        await db.insert(deductions).values({
          orderId: Number(orderId),
          helperId: helperId,
          targetType: "helper",
          targetId: helperId,
          amount: Number(deductionAmount),
          reason: reason || "관리자 수동 조정",
          memo: adminMemo || null,
          category: "ADMIN_ADJUSTMENT",
          status: "confirmed",
          createdBy: adminUserId,
        });
      }

      res.json({ success: true, message: "차감액이 저장되었습니다." });
    } catch (err: any) {
      console.error("Deduction update error:", err);
      res.status(500).json({ message: "차감액 저장 실패" });
    }
  });

  // 요청자별 상세 이용내역 API
  app.get("/api/admin/settlements/requester/:requesterId/orders", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const requesterId = req.params.requesterId;
      const { startDate, endDate } = req.query;

      const ordersData = await storage.getOrders();
      const closingReportsList = await db.select().from(closingReports);
      const closingMap = new Map<number, any>(closingReportsList.map(cr => [cr.orderId, cr]));
      const allUsers = await storage.getAllUsers();
      const userMap = new Map<string, any>(allUsers.map(u => [u.id, u]));

      const requesterOrders = ordersData.filter(o => {
        if (o.requesterId !== requesterId) return false;
        if (!startDate || !endDate) return true;
        const orderDate = new Date(o.createdAt);
        return orderDate >= new Date(startDate as string) && orderDate <= new Date(endDate as string + "T23:59:59");
      });

      const result = await Promise.all(requesterOrders.map(async order => {
        const closing = closingMap.get(order.id);
        const deliveredCount = closing?.deliveredCount || 0;
        const returnedCount = closing?.returnedCount || 0;
        const etcCount = closing?.etcCount || 0;
        const pricePerBox = order.pricePerUnit || 0;
        const etcPricePerUnit = closing?.etcPricePerUnit || 0;

        // extraCosts 계산
        const extraCostsJson = closing?.extraCostsJson ? (typeof closing.extraCostsJson === "string" ? JSON.parse(closing.extraCostsJson) : closing.extraCostsJson) : null;
        const extraTotal = extraCostsJson?.reduce((sum: number, item: any) => sum + (item.amount || item.unitPrice * item.quantity || 0), 0) || 0;

        // 공급가액/부가세 분리 계산
        let supplyAmount = 0;
        let vatAmount = 0;
        let totalAmount = 0;
        if (closing?.supplyAmount) {
          supplyAmount = Number(closing.supplyAmount) || 0;
          vatAmount = Number(closing.vatAmount) || 0;
          totalAmount = Number(closing.totalAmount) || (supplyAmount + vatAmount);
        } else if (closing?.totalAmount) {
          totalAmount = Number(closing.totalAmount) || 0;
          supplyAmount = Math.round(totalAmount / 1.1);
          vatAmount = totalAmount - supplyAmount;
        } else if (closing) {
          const baseAmount = (deliveredCount + returnedCount) * pricePerBox + etcCount * etcPricePerUnit;
          supplyAmount = baseAmount + extraTotal;
          vatAmount = Math.round(supplyAmount * 0.1);
          totalAmount = supplyAmount + vatAmount;
        }

        // 헬퍼 정보 조회
        const helperUser = order.matchedHelperId ? userMap.get(order.matchedHelperId) : null;

        // 계약금 정보 조회
        const depositInfo = await getOrderDepositInfo(order.id);
        const depositAmount = depositInfo.paymentStatus === 'paid' ? depositInfo.depositAmount : 0;
        const balanceAmount = Math.max(0, totalAmount - depositAmount);

        return {
          orderId: order.id,
          orderDate: order.scheduledDate || order.createdAt,
          courierCompany: order.courierCompany || order.companyName || '-',
          helperName: helperUser?.name || '-',
          deliveredCount,
          returnedCount,
          etcCount,
          pricePerBox,
          supplyAmount,
          vatAmount,
          totalAmount,
          depositAmount,
          balanceAmount,
          depositPaid: depositInfo.paymentStatus === 'paid',
          status: order.status,
          paymentStatus: order.paymentStatus,
        };
      }));

      // 총합계 정보 추가
      const summary = {
        totalSupply: result.reduce((sum, o) => sum + o.supplyAmount, 0),
        totalVat: result.reduce((sum, o) => sum + o.vatAmount, 0),
        totalAmount: result.reduce((sum, o) => sum + o.totalAmount, 0),
        totalDeposit: result.reduce((sum, o) => sum + o.depositAmount, 0),
        totalBalance: result.reduce((sum, o) => sum + o.balanceAmount, 0),
      };

      res.json({ orders: result, summary });
    } catch (err: any) {
      console.error("Requester orders error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Requester monthly settlement (요청자별 월간 정산)
  app.get("/api/admin/settlements/requester", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const ordersData = await storage.getOrders();
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      // closing_reports에서 정산 금액 조회
      const closingReportsList = await db.select().from(closingReports);
      const closingMap = new Map<number, any>(closingReportsList.map(cr => [cr.orderId, cr]));

      const filteredOrders = ordersData.filter(o => {
        if (!startDate || !endDate) return true;
        const orderDate = new Date(o.createdAt);
        return orderDate >= new Date(startDate as string) && orderDate <= new Date(endDate as string + "T23:59:59");
      });

      const requesterMap = new Map<string | number, any>();

      for (const order of filteredOrders) {
        const requesterId = order.requesterId;
        if (!requesterId) continue;

        const existing = requesterMap.get(requesterId) || {
          requesterId: requesterId.toString(),
          requesterName: "",
          requesterPhone: "",
          requesterEmail: "",
          businessName: "",
          orderCount: 0,
          billedAmount: 0,
          unpaidAmount: 0,
          paymentDate: null,
        };

        const requester = userMap.get(requesterId);
        existing.requesterName = requester?.name || "Unknown";
        existing.requesterPhone = requester?.phoneNumber || "";
        existing.requesterEmail = requester?.email || "";
        existing.businessName = order.companyName || "";
        existing.orderCount += 1;

        // closing_reports에서 정산 금액 가져오기
        const closingReport = closingMap.get(order.id);
        let totalAmount = 0;
        if (closingReport) {
          if (closingReport.totalAmount) {
            totalAmount = Number(closingReport.totalAmount) || 0;
          } else {
            const deliveredCount = closingReport.deliveredCount || 0;
            const returnedCount = closingReport.returnedCount || 0;
            const etcCount = closingReport.etcCount || 0;
            const pricePerBox = order.pricePerUnit || 0;
            const etcPricePerUnit = closingReport.etcPricePerUnit || 0;
            // extraCosts 계산
            const ecJson = closingReport.extraCostsJson ? (typeof closingReport.extraCostsJson === "string" ? JSON.parse(closingReport.extraCostsJson) : closingReport.extraCostsJson) : null;
            const ecTotal = ecJson?.reduce((sum: number, item: any) => sum + (item.amount || item.unitPrice * item.quantity || 0), 0) || 0;
            const baseAmount = (deliveredCount + returnedCount) * pricePerBox + etcCount * etcPricePerUnit + ecTotal;
            totalAmount = Math.round(baseAmount * 1.1);
          }
        }

        existing.billedAmount += totalAmount;

        // 미정산: 잔금 = 총액 - 계약금
        const depositInfo = await getOrderDepositInfo(order.id);
        const depositPaid = depositInfo.paymentStatus === 'paid' ? depositInfo.depositAmount : 0;
        const balanceAmount = Math.max(0, totalAmount - depositPaid);

        if (order.status !== "closed" && order.status !== "completed" && order.status !== "balance_paid" && order.status !== "settlement_paid") {
          existing.unpaidAmount += balanceAmount;
        }

        requesterMap.set(requesterId, existing);
      }

      res.json(Array.from(requesterMap.values()));
    } catch (err: any) {
      console.error("Requester settlement error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get settlement statement by orderId (for dispute settlement editing)
  app.get("/api/admin/settlements/by-order/:orderId", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      if (!orderId || isNaN(orderId)) {
        return res.status(400).json({ message: "유효한 주문 ID가 필요합니다" });
      }
      const settlement = await storage.getSettlementStatementByOrder(orderId);
      if (!settlement) {
        return res.status(404).json({ message: "해당 주문의 정산 내역이 없습니다" });
      }
      res.json(settlement);
    } catch (err: any) {
      console.error("Get settlement by order error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all settlements (admin) - settlementRecords 기반

  app.get("/api/admin/settlements", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      // 새 settlementRecords 테이블에서 조회
      const records = await db.select().from(settlementRecords).orderBy(desc(settlementRecords.createdAt));
      const users = await storage.getAllUsers();
      const orders = await storage.getOrders();
      const courierSettingsData = await db.select().from(courierSettings).execute();

      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const orderMap = new Map<number, any>(orders.map(o => [o.id, o]));

      const enrichedSettlements = records.map(r => {
        const helper = r.helperId ? userMap.get(r.helperId) : null;
        const order = r.orderId ? orderMap.get(r.orderId) : null;

        return {
          id: r.id,
          orderId: r.orderId,
          helperName: helper?.name || "Unknown",
          helperNickname: (helper as any)?.nickname || null,
          helperPhone: helper?.phoneNumber || null,
          orderTitle: order?.companyName || null,
          workDate: order?.scheduledDate || null,
          // 새 정산 필드
          baseSupply: r.baseSupply,
          urgentFeeSupply: r.urgentFeeSupply || 0,
          extraSupply: r.extraSupply || 0,
          finalSupply: r.finalSupply,
          vat: r.vat,
          finalTotal: r.finalTotal,
          platformFeeRate: r.platformFeeRate || 0,
          platformFee: r.platformFee,
          driverPayout: r.driverPayout,
          status: r.status,
          createdAt: r.createdAt,
          calculatedAt: r.calculatedAt,
          // 레거시 호환용 (기존 UI 지원)
          totalAmount: r.finalTotal,
          netAmount: r.driverPayout,
          commissionAmount: r.platformFee,
          deliveryCount: null, // 별도 조회 필요
          returnCount: null,
        };
      });

      res.json(enrichedSettlements);
    } catch (err: any) {
      console.error("Get settlements error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create settlement (admin)
  app.post("/api/admin/settlements", adminAuth, requirePermission("settlements.create"), async (req, res) => {
    try {
      const { helperId, workDate, deliveryCount, basePay, additionalPay, penalty, deduction, notes } = req.body;

      if (!helperId || !workDate) {
        return res.status(400).json({ message: "기사 ID와 작업일은 필수입니다" });
      }

      // Check if user exists (any registered user can receive settlements)
      const helper = await storage.getUser(helperId);
      if (!helper) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      // Safely parse numeric values with defaults
      const safeDeliveryCount = Number(deliveryCount) || 0;
      const safeBasePay = Number(basePay) || 0;
      const safeAdditionalPay = Number(additionalPay) || 0;
      const safePenalty = Number(penalty) || 0;
      const safeDeduction = Number(deduction) || 0;

      const totalAmount = safeBasePay + safeAdditionalPay - safePenalty - safeDeduction;

      // 헬퍼별 실효 수수료율 사용 (헬퍼별 > 팀별 > 글로벌 > 기본값)
      const effectiveRateForSettlement = await storage.getEffectiveCommissionRate(helperId);
      const commissionRate = effectiveRateForSettlement.rate;
      const commissionAmount = Math.round(totalAmount * commissionRate / 100);
      const netAmount = totalAmount - commissionAmount;

      const settlement = await storage.createSettlementStatement({
        workDate,
        deliveryCount: safeDeliveryCount,
        basePay: safeBasePay,
        additionalPay: safeAdditionalPay,
        penalty: safePenalty,
        deduction: safeDeduction,
        commissionRate,
        commissionAmount,
        totalAmount,
        netAmount,
        status: "pending",
      });

      res.status(201).json(settlement);
    } catch (err: any) {
      console.error("Create settlement error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Admin 정산 생성 API (스펙 4-1)
  // 스펙: POST /admin/settlements/generate
  // ============================================
  app.post("/api/admin/settlements/generate", adminAuth, requirePermission("settlements.create"), async (req, res) => {
    try {
      const user = (req as any).user;
      const { period_start, period_end, helper_user_id } = req.body;

      if (!period_start || !period_end || !helper_user_id) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "period_start, period_end, helper_user_id는 필수입니다" }
        });
      }

      // 헬퍼 확인
      const helper = await storage.getUser(helper_user_id);
      if (!helper) {
        return res.status(404).json({
          error: { code: "HELPER_NOT_FOUND", message: "헬퍼를 찾을 수 없습니다" }
        });
      }

      // 기간 내 완료된 오더 조회 (job_status == CLOSED + balance_invoices.status == PAID)
      const orders = await storage.getOrders();
      const courierSettingsData = await db.select().from(courierSettings).execute();
      const completedStatuses = ["closed", "balance_paid", "settlement_paid"];
      const closedOrders = orders.filter(o => {
        if (o.helperId !== helper_user_id) return false;
        if (!completedStatuses.includes(o.status || "")) return false;

        const orderDate = o.endDate || o.createdAt;
        if (!orderDate) return false;

        const date = new Date(orderDate);
        return date >= new Date(period_start) && date <= new Date(period_end);
      });

      if (closedOrders.length === 0) {
        return res.status(400).json({
          error: { code: "NO_ORDERS", message: "정산 대상 오더가 없습니다" }
        });
      }

      // 오더별 정산 데이터 계산
      let grossAmount = 0;
      let feeAmount = 0;
      let deductionAmount = 0;
      const settlementLines: any[] = [];

      for (const order of closedOrders) {
        const snapshot = await storage.getOrderPricingSnapshot(order.id);
        const costItems = await storage.getOrderCostItems(order.id);

        const baseAmount = snapshot ? Number(snapshot.baseAmountKrw) : 0;
        grossAmount += baseAmount;

        // 비용 라인 추가
        for (const item of costItems) {
          settlementLines.push({
            type: item.sign === "plus" ? "COST_PLUS" : "COST_MINUS",
            orderId: order.id,
            amount: Number(item.amount),
            label: item.label,
          });

          if (item.sign === "plus") {
            grossAmount += Number(item.amount);
          } else {
            deductionAmount += Number(item.amount);
          }
        }

        settlementLines.push({
          type: "ORDER_BASE",
          orderId: order.id,
          amount: baseAmount,
          label: order.companyName || `Order #${order.id}`,
        });
      }

      // 헬퍼별 실효 수수료율 사용 (헬퍼별 > 팀별 > 글로벌 > 기본값)
      const effectiveRateForPeriod = await storage.getEffectiveCommissionRate(helper_user_id);
      const commissionRate = effectiveRateForPeriod.rate;
      feeAmount = Math.round(grossAmount * commissionRate / 100);
      const netAmount = grossAmount - feeAmount - deductionAmount;

      // 정산 생성 (DRAFT 상태)
      const settlement = await storage.createSettlementStatement({
        helperId: helper_user_id,
        workDate: period_start, // 기간 시작일
        deliveryCount: closedOrders.length,
        basePay: grossAmount,
        commissionRate,
        commissionAmount: feeAmount,
        totalAmount: grossAmount,
        netAmount,
        status: "pending", // DRAFT 역할
        periodStart: new Date(period_start),
        periodEnd: new Date(period_end),
      });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "settlement.generate",
        targetType: "settlement",
        targetId: String(settlement.id),
        reason: `정산 생성: ${helper.name || helper_user_id} (${period_start} ~ ${period_end})`,
        metadata: { period_start, period_end, helper_user_id, order_count: closedOrders.length },
      });

      res.json({
        settlement_id: String(settlement.id),
        status: "DRAFT",
        locked: false,
        summary: {
          gross_amount: grossAmount,
          fee_amount: feeAmount,
          deduction_amount: deductionAmount,
          net_amount: netAmount,
        },
      });
    } catch (err: any) {
      console.error("Generate settlement error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Admin 정산 검증 완료 → READY (스펙 4-2)
  // 스펙: POST /admin/settlements/{settlementId}/mark-ready
  // ============================================
  app.post("/api/admin/settlements/:id/mark-ready", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const user = (req as any).user;
      const id = Number(req.params.id);
      const { reason } = req.body;

      const settlement = await storage.getSettlementStatement(id);
      if (!settlement) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "정산을 찾을 수 없습니다" }
        });
      }

      // pending(DRAFT) → confirmed(READY) 전환
      if (settlement.status !== "pending") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: `현재 상태(${settlement.status})에서 READY 처리할 수 없습니다` }
        });
      }

      const updated = await storage.updateSettlementStatement(id, {
        status: "confirmed", // READY 역할
      });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "settlement.mark_ready",
        targetType: "settlement",
        targetId: String(id),
        reason: reason || "라인 검증 완료",
        metadata: { previous_status: settlement.status },
      });

      res.json({
        settlement_id: String(id),
        status: "READY",
      });
    } catch (err: any) {
      console.error("Mark ready error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single settlement with details (admin)
  app.get("/api/admin/settlements/:id", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const settlement = await storage.getSettlementStatement(id);

      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      const lineItems = await storage.getSettlementLineItems(id);
      const helper = settlement.helperId ? await storage.getUser(settlement.helperId) : null;
      const order = settlement.orderId ? await storage.getOrder(settlement.orderId) : null;

      res.json({
        ...settlement,
        lineItems,
        helperName: helper?.name || null,
        trackingNumber: (settlement as any).trackingNumber || null,
        evidencePhotoUrls: (settlement as any).evidencePhotoUrls || [],
        helperPhone: helper?.phoneNumber || null,
        orderTitle: order?.companyName || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Confirm settlement (admin)
  app.patch("/api/admin/settlements/:id/confirm", adminAuth, requirePermission("settlements.confirm"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const settlement = await storage.getSettlementStatement(id);

      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      // 상태 머신 검증: pending → confirmed 전이만 허용
      if (!canTransitionSettlementStatus(settlement.status || "pending", SETTLEMENT_STATUS.CONFIRMED)) {
        return res.status(400).json({
          message: `현재 상태(${settlement.status})에서 확정 처리할 수 없습니다`,
          allowedFrom: ["pending"]
        });
      }

      const updated = await storage.updateSettlementStatement(id, {
        status: "confirmed",
      });

      // 감사 로그 기록
      await logAdminAction({
        req,
        action: "settlement.confirm",
        targetType: "settlement",
        targetId: id,
        oldValue: { status: settlement.status },
        newValue: { status: "confirmed" },
      });

      // 기사에게 알림
      if (settlement.helperId) {
        const payoutText = `${(settlement.netAmount || 0).toLocaleString()}원`;
        await storage.createNotification({
          userId: settlement.helperId,
          type: "settlement_completed",
          title: "정산 확정",
          message: `정산이 확정되었습니다. 지급 예정 금액: ${payoutText}`,
          payload: JSON.stringify({ settlementId: id }),
        });

        // 푸시 알림
        sendPushToUser(settlement.helperId, {
          title: "정산 확정",
          body: `정산이 확정되었습니다. 지급 예정: ${payoutText}`,
          url: "/helper-home",
          tag: `settlement-confirmed-${id}`,
        });

        // SMS: 정산 확정 알림
        const settlementHelper = await storage.getUser(settlement.helperId);
        if (settlementHelper?.phoneNumber) {
          try {
            await smsService.sendCustomMessage(settlementHelper.phoneNumber,
              `[헬프미] 정산이 확정되었습니다. 지급 예정: ${payoutText}. 앱에서 확인하세요.`);
          } catch (smsErr) { console.error("[SMS Error] settlement confirmed:", smsErr); }
        }

        // Notify helper via WebSocket
        notificationWS.sendDataRefresh(settlement.helperId, {
          type: "settlement",
          action: "updated",
          entityId: id,
        });
      }

      // Broadcast to all admins for real-time updates
      broadcastToAllAdmins("settlement", "confirmed", id, { status: "confirmed" });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Process settlement payment (admin)
  app.patch("/api/admin/settlements/:id/pay", adminAuth, requirePermission("settlements.pay"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { paymentMethod, transactionRef, notes } = req.body;

      const settlement = await storage.getSettlementStatement(id);

      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      // 상태 머신 검증: confirmed → payable → paid 전이만 허용
      // 중간 단계(payable)를 건너뛰거나 직접 paid로 전환 허용 (운영 편의성)
      if (!canTransitionSettlementStatus(settlement.status || "pending", SETTLEMENT_STATUS.PAID) &&
        !canTransitionSettlementStatus(settlement.status || "pending", SETTLEMENT_STATUS.PAYABLE)) {
        return res.status(400).json({
          message: `현재 상태(${settlement.status})에서 지급 처리할 수 없습니다`,
          allowedFrom: ["confirmed", "payable"]
        });
      }

      const updated = await storage.updateSettlementStatement(id, {
        status: "paid",
      });

      // 감사 로그 기록 - 금전 액션이므로 상세 기록
      await logAdminAction({
        req,
        action: "settlement.pay",
        targetType: "settlement",
        targetId: id,
        oldValue: { status: settlement.status, netAmount: settlement.netAmount },
        newValue: { status: "paid", paymentMethod, netAmount: settlement.netAmount },
      });

      // Payment 기록 생성
      await storage.createPayment({
        orderId: settlement.orderId,
        payerId: settlement.helperId || "system",
        provider: paymentMethod || "bank_transfer",
        amount: settlement.netAmount || 0,
        paymentType: "helper_settlement",
        status: "captured",
      });

      // 기사에게 알림
      if (settlement.helperId) {
        const paidAmtText = `${(settlement.netAmount || 0).toLocaleString()}원`;
        await storage.createNotification({
          userId: settlement.helperId,
          type: "settlement_completed",
          title: "정산금 지급 완료",
          message: `${paidAmtText}이 지급 완료되었습니다.`,
          payload: JSON.stringify({ settlementId: id }),
        });

        // 푸시 알림
        sendPushToUser(settlement.helperId, {
          title: "정산금 지급 완료",
          body: `${paidAmtText}이 지급 완료되었습니다. 앱에서 확인하세요.`,
          url: "/helper-home",
          tag: `settlement-paid-${id}`,
        });

        // SMS: 정산금 지급 완료 알림
        const paidHelper = await storage.getUser(settlement.helperId);
        if (paidHelper?.phoneNumber) {
          try {
            await smsService.sendCustomMessage(paidHelper.phoneNumber,
              `[헬프미] 정산금 ${paidAmtText}이 지급 완료되었습니다. 앱에서 확인하세요.`);
          } catch (smsErr) { console.error("[SMS Error] settlement paid:", smsErr); }
        }

        // Notify helper via WebSocket
        notificationWS.sendDataRefresh(settlement.helperId, {
          type: "settlement",
          action: "updated",
          entityId: id,
        });
      }

      // Broadcast to all admins for real-time updates
      broadcastToAllAdmins("settlement", "paid", id, { status: "paid" });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Hold settlement (admin)
  app.patch("/api/admin/settlements/:id/hold", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason, incidentId } = req.body;

      const settlement = await storage.getSettlementStatement(id);

      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      // 상태 머신 검증: PAID 상태에서는 보류 불가
      if (!canTransitionSettlementStatus(settlement.status || "pending", SETTLEMENT_STATUS.ON_HOLD)) {
        return res.status(400).json({
          message: `현재 상태(${settlement.status})에서 보류 처리할 수 없습니다`,
          reason: settlement.status === "paid" ? "이미 지급된 정산은 보류할 수 없습니다" : "허용되지 않는 상태 전이입니다"
        });
      }

      const updated = await storage.updateSettlementStatement(id, {
        status: "on_hold",
        holdReason: reason || "보류 처리됨",
        holdIncidentId: incidentId,
      });

      // 감사 로그 기록
      await logAdminAction({
        req,
        action: "settlement.hold",
        targetType: "settlement",
        targetId: id,
        oldValue: { status: settlement.status },
        newValue: { status: "on_hold", holdReason: reason },
      });

      // 기사에게 알림
      if (settlement.helperId) {
        await storage.createNotification({
          userId: settlement.helperId,
          type: "dispute_submitted",
          title: "정산 보류",
          message: `정산이 보류 처리되었습니다. 사유: ${reason || "확인 필요"}`,
          payload: JSON.stringify({ settlementId: id }),
        });

        // Notify helper via WebSocket
        notificationWS.sendDataRefresh(settlement.helperId, {
          type: "settlement",
          action: "updated",
          entityId: id,
        });
      }

      // Broadcast to all admins for real-time updates
      broadcastToAllAdmins("settlement", "held", id, { status: "on_hold" });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/admin/settlements/:id/deductions - 차감 추가 (T-08 스펙)
  app.post("/api/admin/settlements/:id/deductions", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = (req as any).adminUser || (req as any).user;
      const { type, amount, reason, evidenceUrl } = req.body;

      // 필수 필드 검증
      if (!type || !amount || !reason) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "차감 유형, 금액, 사유는 필수입니다"
        });
      }

      // 차감 유형 검증
      const validTypes = ["DAMAGE", "LOSS", "CLAIM", "ETC"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          code: "INVALID_TYPE",
          message: `차감 유형은 ${validTypes.join(", ")} 중 하나여야 합니다`
        });
      }

      const settlement = await storage.getSettlementStatement(id);
      if (!settlement) {
        return res.status(404).json({ code: "NOT_FOUND", message: "정산 내역을 찾을 수 없습니다" });
      }

      // 이미 지급된 정산은 차감 불가
      if (settlement.status === "paid") {
        return res.status(400).json({
          code: "ALREADY_PAID",
          message: "이미 지급된 정산에는 차감을 추가할 수 없습니다"
        });
      }

      // 기존 차감 금액에 추가
      const currentDeduction = settlement.deductionAmount || 0;
      const newDeductionTotal = currentDeduction + amount;

      // 차감 내역 저장 (기존 deductions JSON에 추가)
      const existingDeductions = settlement.deductions ?
        (typeof settlement.deductions === "string" ? JSON.parse(settlement.deductions) : settlement.deductions) : [];

      const newDeduction = {
        id: `ded_${Date.now()}`,
        type,
        amount,
        reason,
        evidenceUrl: evidenceUrl || null,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      existingDeductions.push(newDeduction);

      // 정산 업데이트
      const updated = await storage.updateSettlementStatement(id, {
        deductionAmount: newDeductionTotal,
        deductions: JSON.stringify(existingDeductions),
        netAmount: (settlement.totalAmount || 0) - (settlement.feeAmount || 0) - newDeductionTotal,
      });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "settlement.add_deduction",
        targetType: "settlement",
        targetId: id,
        oldValue: { deductionAmount: currentDeduction },
        newValue: {
          deductionAmount: newDeductionTotal,
          newDeduction: { type, amount, reason }
        },
        reason: reason,
      });

      res.status(201).json({
        ok: true,
        deduction: newDeduction,
        settlement: updated,
      });
    } catch (err: any) {
      console.error("Add settlement deduction error:", err);
      res.status(500).json({ code: "SERVER_ERROR", message: "차감 추가에 실패했습니다" });
    }
  });

  // Release settlement hold (admin)
  app.patch("/api/admin/settlements/:id/release", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);

      const settlement = await storage.getSettlementStatement(id);

      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      // 상태 머신 검증: on_hold → confirmed/payable로 전이 (pending은 초기 상태라 release시 confirmed로)
      if (!canTransitionSettlementStatus(settlement.status || "pending", SETTLEMENT_STATUS.CONFIRMED)) {
        return res.status(400).json({
          message: `현재 상태(${settlement.status})에서 보류 해제할 수 없습니다`,
          allowedFrom: ["on_hold"]
        });
      }

      const updated = await storage.updateSettlementStatement(id, {
        status: "confirmed",
        holdReason: null,
        holdIncidentId: null,
      });

      // 감사 로그 기록
      await logAdminAction({
        req,
        action: "settlement.release",
        targetType: "settlement",
        targetId: id,
        oldValue: { status: settlement.status, holdReason: settlement.holdReason },
        newValue: { status: "confirmed" },
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update settlement counts (for dispute resolution)
  app.patch("/api/admin/settlements/:id/counts", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { deliveryCount, returnCount, pickupCount, otherCount, unitPrice: requestedUnitPrice, notes } = req.body;

      const settlement = await storage.getSettlementStatement(id);

      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      if (settlement.status === "paid") {
        return res.status(400).json({ message: "지급 완료된 정산은 수정할 수 없습니다" });
      }

      // Recalculate amounts with updated counts
      const newDeliveryCount = deliveryCount ?? settlement.deliveryCount ?? 0;
      const newReturnCount = returnCount ?? settlement.returnCount ?? 0;
      const newPickupCount = pickupCount ?? settlement.pickupCount ?? 0;
      const newOtherCount = otherCount ?? settlement.otherCount ?? 0;

      // Derive unitPrice from existing settlement or use provided value
      const existingBoxCount = (settlement.deliveryCount || 0) + (settlement.returnCount || 0) +
        (settlement.pickupCount || 0) + (settlement.otherCount || 0);
      const existingUnitPrice = existingBoxCount > 0 && settlement.supplyAmount
        ? Math.round((settlement.supplyAmount || 0) / existingBoxCount)
        : (settlement as any).unitPrice || 0;
      const newUnitPrice = requestedUnitPrice ?? existingUnitPrice;

      // Allow zero unitPrice only when counts are also zero
      if (newUnitPrice < 0) {
        return res.status(400).json({ message: "단가는 0 이상이어야 합니다." });
      }

      const totalBoxCount = newDeliveryCount + newReturnCount + newPickupCount + newOtherCount;

      // Require explicit unitPrice when modifying counts but have no reference
      if (totalBoxCount > 0 && newUnitPrice === 0) {
        return res.status(400).json({ message: "수량이 있을 경우 단가를 입력해주세요." });
      }

      const supplyAmount = totalBoxCount * newUnitPrice;
      const vatAmount = calculateVat(supplyAmount);
      const totalAmount = supplyAmount + vatAmount;

      // Get commission rate from the existing settlement
      const commissionRate = settlement.commissionRate ?? 10;
      const platformRate = settlement.platformCommission && settlement.totalAmount
        ? Math.round((settlement.platformCommission / settlement.totalAmount) * 100 * 10) / 10
        : 8;

      const commissionAmount = Math.round(totalAmount * (commissionRate / 100));
      const platformCommission = Math.round(totalAmount * (platformRate / 100));
      const teamLeaderIncentive = commissionAmount - platformCommission;
      const netAmount = totalAmount - commissionAmount;

      // Build audit note with previous values
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const auditEntry = notes
        ? `[${timestamp}] ${notes} (이전: 배송 ${settlement.deliveryCount || 0}, 반품 ${settlement.returnCount || 0}, 픽업 ${settlement.pickupCount || 0}, 기타 ${settlement.otherCount || 0})`
        : `[${timestamp}] 수량 수정 (이전: 배송 ${settlement.deliveryCount || 0}, 반품 ${settlement.returnCount || 0}, 픽업 ${settlement.pickupCount || 0}, 기타 ${settlement.otherCount || 0})`;
      const existingContent = settlement.statementContent || "";
      const updatedContent = existingContent
        ? `${existingContent}\n${auditEntry}`
        : auditEntry;

      const updated = await storage.updateSettlementStatement(id, {
        deliveryCount: newDeliveryCount,
        returnCount: newReturnCount,
        pickupCount: newPickupCount,
        otherCount: newOtherCount,
        supplyAmount,
        vatAmount,
        totalAmount,
        commissionAmount,
        platformCommission,
        teamLeaderIncentive,
        netAmount,
        statementContent: updatedContent,
      });

      res.json({ message: "정산 수정 완료", settlement: updated });
    } catch (err: any) {
      console.error("Settlement update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate monthly settlements for all helpers (admin)
  app.post("/api/admin/settlements/generate-monthly", adminAuth, requirePermission("settlements.create"), async (req, res) => {
    try {
      const { year, month } = req.body;

      if (!year || !month) {
        return res.status(400).json({ message: "년도와 월을 입력해주세요" });
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get all orders that are closed/completed in the specified month
      const allOrders = await storage.getOrders();
      const completedStatuses = ["closed", "balance_paid", "settlement_paid"];
      const closedOrders = allOrders.filter(o => {
        const status = o.status?.toLowerCase();
        if (!completedStatuses.includes(status || "")) return false;
        // Check if order was completed in the target month
        const orderDate = o.closedAt ? new Date(o.closedAt) : (o.createdAt ? new Date(o.createdAt) : null);
        if (!orderDate) return false;
        return orderDate >= startDate && orderDate <= endDate;
      });

      if (closedOrders.length === 0) {
        return res.json({ message: "해당 월에 완료된 주문이 없습니다", created: 0, skipped: 0 });
      }

      // Get existing settlements to avoid duplicates
      const existingSettlements = await storage.getAllSettlementStatements();
      const existingOrderIds = new Set(existingSettlements.map(s => s.orderId).filter(Boolean));

      // Group orders by helper through applications
      const helperOrders: Map<string, typeof closedOrders> = new Map();

      for (const order of closedOrders) {
        if (existingOrderIds.has(order.id)) continue;

        const applications = await storage.getOrderApplications(order.id);
        const completedApp = applications.find(a => a.status === "completed");

        if (completedApp) {
          const helperId = completedApp.helperId;
          if (!helperOrders.has(helperId)) {
            helperOrders.set(helperId, []);
          }
          helperOrders.get(helperId)!.push(order);
        }
      }

      let created = 0;
      let skipped = 0;

      for (const [helperId, orders] of Array.from(helperOrders.entries())) {
        for (const order of orders) {
          try {
            // 수수료율 조회 (우선순위: 신청 스냅샷 > 오더 스냅샷 > 현재 정책)
            let commissionRate: number;
            let platformRate: number;
            let teamLeaderRate: number;
            let teamLeaderId: string | null = null;

            // 1. 헬퍼 신청(application) 스냅샷이 있으면 우선 사용
            const application = await storage.getOrderApplication(order.id, helperId);
            if (application?.snapshotCommissionRate != null &&
              application?.snapshotPlatformRate != null &&
              application?.snapshotTeamLeaderRate != null) {
              commissionRate = application.snapshotCommissionRate;
              platformRate = application.snapshotPlatformRate;
              teamLeaderRate = application.snapshotTeamLeaderRate;
              teamLeaderId = application.snapshotTeamLeaderId;
              // 2. 오더 스냅샷이 있으면 사용
            } else if (order.snapshotCommissionRate != null &&
              order.snapshotPlatformRate != null &&
              order.snapshotTeamLeaderRate != null) {
              commissionRate = order.snapshotCommissionRate;
              platformRate = order.snapshotPlatformRate;
              teamLeaderRate = order.snapshotTeamLeaderRate;
              const teamMember = await storage.getTeamMemberByUserId(helperId);
              if (teamMember) {
                const team = await storage.getTeamById(teamMember.teamId);
                teamLeaderId = team?.leaderId || null;
              }
              // 3. 스냅샷이 없으면 (레거시) 현재 정책으로 폴백
            } else {
              const effectiveRate = await storage.getEffectiveCommissionRate(helperId);
              commissionRate = effectiveRate.rate;
              platformRate = effectiveRate.platformRate;
              teamLeaderRate = effectiveRate.teamLeaderRate;
              teamLeaderId = effectiveRate.teamLeaderId;
            }

            // 마감 보고서에서 실제 수량 조회 (정확한 금액 산출)
            const [closingRpt] = await db.select().from(closingReports)
              .where(eq(closingReports.orderId, order.id))
              .limit(1);

            let supplyAmount: number;
            let vatAmount: number;
            let totalAmount: number;

            if (closingRpt?.totalAmount) {
              // 마감 보고서에 이미 계산된 금액이 있으면 사용
              totalAmount = Number(closingRpt.totalAmount) || 0;
              supplyAmount = Number(closingRpt.supplyAmount) || Math.round(totalAmount / 1.1);
              vatAmount = Number(closingRpt.vatAmount) || (totalAmount - supplyAmount);
            } else {
              // 마감 보고서가 없으면 오더 정보로 계산
              const qty = parseInt(String(order.averageQuantity || "0").replace(/[^0-9]/g, "")) || 0;
              const unitPrice = Number(order.pricePerUnit) || 0;
              const etcCount = closingRpt?.etcCount || 0;
              const etcPricePerUnit = closingRpt?.etcPricePerUnit || 0;
              supplyAmount = (qty * unitPrice) + (etcCount * etcPricePerUnit);
              vatAmount = Math.round(supplyAmount * 0.1);
              totalAmount = supplyAmount + vatAmount;
            }

            const commissionAmount = Math.round(totalAmount * commissionRate / 100);
            const platformCommission = Math.round(totalAmount * platformRate / 100);
            const teamLeaderIncentive = Math.round(totalAmount * teamLeaderRate / 100);
            const netAmount = totalAmount - commissionAmount;

            await storage.createSettlementStatement({
              orderId: order.id,
              workDate: order.scheduledDate || `${year}-${String(month).padStart(2, '0')}-01`,
              basePay: totalAmount,
              additionalPay: 0,
              penalty: 0,
              deduction: 0,
              commissionRate,
              commissionAmount,
              platformCommission,
              teamLeaderIncentive,
              teamLeaderId,
              supplyAmount,
              vatAmount,
              totalAmount,
              netAmount,
              status: "pending",
            });
            created++;
          } catch (err: any) {
            console.error(`Settlement creation error for order ${order.id}:`, err);
            skipped++;
          }
        }
      }

      res.json({
        message: `${year}년 ${month}월 정산 생성 완료`,
        created,
        skipped,
        total: closedOrders.length
      });
    } catch (err: any) {
      console.error("Generate monthly settlements error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Batch confirm settlements (admin)
  app.post("/api/admin/settlements/batch-confirm", adminAuth, requirePermission("settlements.confirm"), async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "정산 ID 목록이 필요합니다" });
      }

      const results = await Promise.all(
        ids.map(async (id: number) => {
          const settlement = await storage.getSettlementStatement(id);
          if (!settlement || settlement.status !== "pending") {
            return { id, success: false, reason: "대기 상태가 아님" };
          }

          await storage.updateSettlementStatement(id, {
            status: "confirmed",
          });

          return { id, success: true };
        })
      );

      const successCount = results.filter(r => r.success).length;
      res.json({ message: `${successCount}건 확정 완료`, results });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Batch pay settlements (admin)
  app.post("/api/admin/settlements/batch-pay", adminAuth, requirePermission("settlements.pay"), async (req, res) => {
    try {
      const { ids, paymentMethod } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "정산 ID 목록이 필요합니다" });
      }

      const results = await Promise.all(
        ids.map(async (id: number) => {
          const settlement = await storage.getSettlementStatement(id);
          if (!settlement || settlement.status !== "confirmed") {
            return { id, success: false, reason: "확정 상태가 아님" };
          }

          await storage.updateSettlementStatement(id, {
            status: "paid",
          });

          // Payment 기록 생성
          await storage.createPayment({
            orderId: settlement.orderId,
            payerId: settlement.helperId || "system",
            provider: paymentMethod || "bank_transfer",
            amount: settlement.netAmount || 0,
            paymentType: "helper_settlement",
            status: "captured",
          });

          return { id, success: true };
        })
      );

      const successCount = results.filter(r => r.success).length;
      res.json({ message: `${successCount}건 지급 완료`, results });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all disputes/incidents (admin) - combines legacy incidents and new disputes
  app.get("/api/admin/disputes", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const incidents = await storage.getAllIncidentReports();
      const helperDisputes = await storage.getAllDisputes();
      const users = await storage.getAllUsers();
      const contracts = await storage.getAllContracts();

      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const contractMap = new Map<number, any>(contracts.map(c => [c.id, c]));

      // Legacy incident reports
      const enrichedIncidents = incidents.map(i => {
        const reporter = i.reporterId ? userMap.get(i.reporterId) : null;
        const contract = i.jobContractId ? contractMap.get(i.jobContractId) : null;
        return {
          ...i,
          source: "incident" as const,
          reporterName: reporter?.name || null,
          reporterPhone: reporter?.phoneNumber || null,
          contractInfo: contract ? {
            orderId: contract.orderId,
            totalAmount: contract.totalAmount,
          } : null,
        };
      });

      // New disputes (이의제기 - helper and requester)
      const ordersData = await storage.getAllOrders();
      const orderMap = new Map<number, any>(ordersData.map(o => [o.id, o]));

      const enrichedDisputes = helperDisputes.map(d => {
        const helper = d.helperId ? userMap.get(d.helperId) : null;
        const order = d.orderId ? orderMap.get(d.orderId) : null;
        const requester = order?.requesterId ? userMap.get(order.requesterId) : null;
        return {
          id: d.id,
          source: "dispute" as const,
          submitterRole: d.submitterRole || "helper",
          disputeType: d.disputeType,
          status: d.status,
          description: d.description,
          workDate: d.workDate,
          createdAt: d.createdAt,
          resolvedAt: d.resolvedAt,
          resolution: d.resolution,
          evidencePhotoUrls: d.evidencePhotoUrl ? (() => { try { return JSON.parse(d.evidencePhotoUrl); } catch { return [d.evidencePhotoUrl]; } })() : [],
          helperName: helper?.name || null,
          helperPhone: helper?.phoneNumber || null,
          requesterName: requester?.name || null,
          requesterPhone: requester?.phoneNumber || null,
          settlementId: d.settlementId,
          orderId: d.orderId,
          orderNumber: order?.orderNumber || null,
          requestedDeliveryCount: d.requestedDeliveryCount,
          requestedReturnCount: d.requestedReturnCount,
          requestedPickupCount: d.requestedPickupCount,
          requestedOtherCount: d.requestedOtherCount,
        };
      });


      res.json({ incidents: enrichedIncidents, helperDisputes: enrichedDisputes });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single dispute (admin)
  app.get("/api/admin/disputes/:id", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const incident = await storage.getIncidentReport(id);

      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      const reporter = incident.reporterId ? await storage.getUser(incident.reporterId) : null;
      const contract = incident.jobContractId ? await storage.getContract(incident.jobContractId) : null;

      res.json({
        ...incident,
        reporterName: reporter?.name || null,
        reporterPhone: reporter?.phoneNumber || null,
        contractInfo: contract,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update dispute status (admin) - 분쟁 상태 변경 시 정산 차감 자동 연동
  app.patch("/api/admin/disputes/:id/status", adminAuth, requirePermission("disputes.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, resolution, notes, deductionAmount, adminReply } = req.body;
      const adminUser = (req as any).adminUser;

      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      const updateData: any = { status };
      if (resolution) updateData.resolution = resolution;
      if (adminReply) { updateData.adminReply = adminReply; updateData.adminReplyAt = new Date(); updateData.adminReplyBy = adminUser?.id || null; }
      if (deductionAmount !== undefined) updateData.resolutionAmount = deductionAmount;
      if (status === "resolved" || status === "closed") {
        updateData.resolvedAt = new Date();
      }

      const updated = await storage.updateIncidentReport(id, updateData);

      // 분쟁 해결 시 정산 차감 자동 반영
      if (status === "resolved" && (deductionAmount || incident.resolutionAmount)) {
        const amount = deductionAmount || incident.resolutionAmount || 0;

        // 정산 찾기: settlementId가 있으면 사용, 없으면 orderId/jobContractId로 검색
        let settlement: any = null;
        if (incident.settlementId) {
          settlement = await storage.getSettlementStatement(incident.settlementId);
        } else if (incident.orderId) {
          settlement = await storage.getSettlementStatementByOrder(incident.orderId);
        } else if (incident.jobContractId) {
          const contract = await storage.getContract(incident.jobContractId);
          if (contract?.orderId) {
            settlement = await storage.getSettlementStatementByOrder(contract.orderId);
          }
        }

        if (settlement && amount > 0) {
          // 멱등성 체크: 같은 분쟁 ID로 이미 차감이 있는지 확인
          const existingLineItem = await storage.getSettlementLineItemByIncident(settlement.id, id);

          if (!existingLineItem) {
            // 차감 라인아이템 생성
            await storage.createSettlementLineItem({
              statementId: settlement.id,
              itemType: "deduction",
              itemName: `분쟁 차감 #${id}`,
              quantity: 1,
              unitPrice: -amount,
              amount: -amount,
              notes: JSON.stringify({
                incidentId: id,
                reason: resolution || incident.description,
                status: "approved"
              }),
            });

            // 정산 차감 금액 업데이트 및 순지급액 재계산 (델타 기반)
            const currentDeduction = settlement.deduction || 0;
            const newDeduction = currentDeduction + amount;
            // 기존 netAmount에서 차감 금액만큼 빼기 (penalty/additionalPay 등 다른 필드 영향 없음)
            const currentNetAmount = settlement.netAmount || 0;
            const newNetAmount = currentNetAmount - amount;

            await storage.updateSettlementStatement(settlement.id, {
              deduction: newDeduction,
              netAmount: newNetAmount,
            });

            // 분쟁에 정산 ID 연결
            await storage.updateIncidentReport(id, { settlementId: settlement.id });

            console.log(`[Dispute→Settlement] Incident #${id} deduction ${amount}원 applied to settlement #${settlement.id}`);
          } else {
            console.log(`[Dispute→Settlement] Incident #${id} deduction already exists, skipping (idempotent)`);
          }
        }
      }

      // 분쟁 취소 시 차감 복구 (reversed)
      if (status === "closed" && incident.status === "resolved" && incident.settlementId) {
        const settlement = await storage.getSettlementStatement(incident.settlementId);
        if (settlement) {
          const existingLineItem = await storage.getSettlementLineItemByIncident(settlement.id, id);

          if (existingLineItem) {
            const reversedAmount = Math.abs(existingLineItem.amount || 0);

            // 라인아이템 상태를 reversed로 변경
            await storage.updateSettlementLineItem(existingLineItem.id, {
              notes: JSON.stringify({
                ...JSON.parse(existingLineItem.notes || "{}"),
                status: "reversed",
                reversedAt: new Date().toISOString()
              }),
            });

            // 정산 차감 금액 복구 (델타 기반)
            const currentDeduction = settlement.deduction || 0;
            const newDeduction = Math.max(0, currentDeduction - reversedAmount);
            // 기존 netAmount에 복구 금액만큼 더하기 (penalty/additionalPay 등 다른 필드 영향 없음)
            const currentNetAmount = settlement.netAmount || 0;
            const newNetAmount = currentNetAmount + reversedAmount;

            await storage.updateSettlementStatement(settlement.id, {
              deduction: newDeduction,
              netAmount: newNetAmount,
            });

            console.log(`[Dispute→Settlement] Incident #${id} deduction ${reversedAmount}원 reversed from settlement #${settlement.id}`);
          }
        }
      }

      // 신고자에게 알림
      if (incident.reporterId) {
        const statusLabel = status === "resolved" ? "해결됨" :
          status === "closed" ? "종료됨" :
            status === "investigating" ? "조사중" : status;
        await storage.createNotification({
          userId: incident.reporterId,
          type: "announcement",
          title: "분쟁 상태 변경",
          message: `분쟁 #${id} 상태가 "${statusLabel}"으로 변경되었습니다.${resolution ? ` 결과: ${resolution}` : ""}`,
        });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Dispute status update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create dispute (admin)
  app.post("/api/admin/disputes", adminAuth, requirePermission("disputes.edit"), async (req, res) => {
    try {
      const { jobContractId, reporterId, category, description, severity } = req.body;

      const incident = await storage.createIncidentReport({
        jobContractId,
        reporterId,
        incidentType: category || "complaint",
        description,
        status: "submitted",
      });

      res.json(incident);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update helper dispute status (admin)

  // Get single helper dispute (admin) - 이의제기 상세 조회

  // Get all helper disputes for app admin (admin) - 앱 관리자용 이의제기 목록
  app.get("/api/admin/helper-disputes", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const disputes = await storage.getAllDisputes();
      const users = await storage.getAllUsers();
      const ordersData = await storage.getAllOrders();

      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const orderMap = new Map<number, any>(ordersData.map(o => [o.id, o]));

      const enrichedDisputes = disputes.map(d => {
        const helper = d.helperId ? userMap.get(d.helperId) : null;
        const order = d.orderId ? orderMap.get(d.orderId) : null;
        const requester = order?.requesterId ? userMap.get(order.requesterId) : null;
        return {
          id: d.id,
          orderId: d.orderId,
          orderNumber: order?.orderNumber || null,
          helperId: d.helperId,
          submitterRole: d.submitterRole || "helper",
          submitterName: d.submitterRole === "requester" ? (requester?.name || "요청자") : (helper?.name || "헬퍼"),
          disputeType: d.disputeType,
          status: d.status,
          description: d.description,
          evidencePhotoUrls: d.evidencePhotoUrl ? (() => { try { return JSON.parse(d.evidencePhotoUrl); } catch { return [d.evidencePhotoUrl]; } })() : [],
          createdAt: d.createdAt,
          resolvedAt: d.resolvedAt,
          helperName: helper?.name || null,
          requesterName: requester?.name || null,
          settlementId: d.settlementId,
          workDate: d.workDate,
          courierName: d.courierName,
          invoiceNumber: d.invoiceNumber,
          requestedDeliveryCount: d.requestedDeliveryCount,
          requestedReturnCount: d.requestedReturnCount,
          requestedPickupCount: d.requestedPickupCount,
          requestedOtherCount: d.requestedOtherCount,
          resolution: d.resolution,
          adminReply: d.adminReply,
          helperPhone: helper?.phoneNumber || null,
          requesterPhone: requester?.phoneNumber || null,
        };
      });

      res.json(enrichedDisputes);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app.get("/api/admin/helper-disputes/:id", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const dispute = await storage.getDispute(id);

      if (!dispute) {
        return res.status(404).json({ message: "이의제기를 찾을 수 없습니다" });
      }

      const helper = dispute.helperId ? await storage.getUser(dispute.helperId) : null;
      const order = dispute.orderId ? await storage.getOrder(dispute.orderId) : null;
      const requester = order?.requesterId ? await storage.getUser(order.requesterId) : null;
      const submitter = dispute.submitterRole === "requester" ? requester : helper;

      res.json({
        profileImage: submitter?.profileImageUrl || null,
        id: dispute.id,
        orderId: dispute.orderId,
        helperId: dispute.helperId,
        settlementId: dispute.settlementId,
        submitterRole: dispute.submitterRole || "helper",
        submitterName: dispute.submitterRole === "requester" ? (requester?.name || "요청자") : (helper?.name || "헬퍼"),
        disputeType: dispute.disputeType,
        status: dispute.status,
        description: dispute.description,
        workDate: dispute.workDate,
        courierName: dispute.courierName,
        invoiceNumber: dispute.invoiceNumber,
        evidencePhotoUrls: dispute.evidencePhotoUrl ? (() => { try { return JSON.parse(dispute.evidencePhotoUrl); } catch { return [dispute.evidencePhotoUrl]; } })() : [],
        adminNote: dispute.adminReply,
        adminReplyAt: dispute.adminReplyAt,
        adminReplyBy: dispute.adminReplyBy,
        createdAt: dispute.createdAt,
        resolvedAt: dispute.resolvedAt,
        resolution: dispute.resolution,
        requestedDeliveryCount: dispute.requestedDeliveryCount,
        requestedReturnCount: dispute.requestedReturnCount,
        requestedPickupCount: dispute.requestedPickupCount,
        requestedOtherCount: dispute.requestedOtherCount,
        order: order ? {
          id: order.id,
          carrierName: (order as any).carrierName || (order as any).courierCompany || "",
          pickupLocation: (order as any).pickupLocation || (order as any).campAddress || "",
          deliveryLocation: (order as any).deliveryLocation || (order as any).deliveryArea || "",
          scheduledDate: (order as any).scheduledDate || null,
          companyName: (order as any).companyName || null,
        } : null,
        helper: helper ? {
          id: helper.id,
          name: helper.name,
          nickname: (helper as any).nickname || null,
          phone: helper.phoneNumber,
        } : null,
        requester: requester ? {
          id: requester.id,
          name: requester.name,
          phone: requester.phoneNumber,
          companyName: (order as any)?.companyName || null,
        } : null,
        helperName: helper?.name || null,
        helperPhone: helper?.phoneNumber || null,
        requesterName: requester?.name || null,
        requesterPhone: requester?.phoneNumber || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all incident reports for admin (화물사고접수)
  app.get("/api/admin/incident-reports", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const incidents = await storage.getAllIncidentReports();
      const users = await storage.getAllUsers();

      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const enrichedIncidents = incidents.map(i => {
        const helper = i.helperId ? userMap.get(i.helperId) : null;
        const requester = i.requesterId ? userMap.get(i.requesterId) : null;
        return {
          id: i.id,
          orderId: i.orderId,
          incidentType: i.incidentType,
          status: i.status,
          description: i.description,
          damageAmount: i.damageAmount,
          helperName: helper?.name || null,
          requesterName: requester?.name || null,
          helperStatus: i.helperStatus,
          createdAt: i.createdAt,
        };
      });

      res.json(enrichedIncidents);
    } catch (err: any) {
      console.error("Error fetching incident reports:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get incidents with pending deductions (화물사고차감)
  app.get("/api/admin/incident-deductions", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const incidents = await storage.getAllIncidentReports();
      const users = await storage.getAllUsers();

      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      // Filter incidents that have deduction amount and resolved status
      const deductionIncidents = incidents
        .filter(i => i.status === "resolved" && i.deductionAmount && i.deductionAmount > 0)
        .map(i => {
          const helper = i.helperId ? userMap.get(i.helperId) : null;
          return {
            id: i.id,
            orderId: i.orderId,
            incidentType: i.incidentType,
            helperName: helper?.name || null,
            helperId: i.helperId,
            deductionAmount: i.deductionAmount,
            deductionReason: i.deductionReason,
            helperDeductionApplied: i.helperDeductionApplied || false,
            deductionConfirmedAt: i.deductionConfirmedAt,
            createdAt: i.createdAt,
          };
        });

      res.json(deductionIncidents);
    } catch (err: any) {
      console.error("Error fetching deduction incidents:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get incidents with pending refunds (화물사고환불)
  app.get("/api/admin/incident-refunds", adminAuth, requirePermission("disputes.view"), async (req, res) => {
    try {
      const incidents = await storage.getAllIncidentReports();
      const users = await storage.getAllUsers();

      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      // Filter incidents that have deduction amount and resolved status
      const refundIncidents = incidents
        .filter(i => i.status === "resolved" && i.deductionAmount && i.deductionAmount > 0)
        .map(i => {
          const requester = i.requesterId ? userMap.get(i.requesterId) : null;
          return {
            id: i.id,
            orderId: i.orderId,
            incidentType: i.incidentType,
            requesterName: requester?.name || null,
            requesterId: i.requesterId,
            deductionAmount: i.deductionAmount,
            deductionReason: i.deductionReason,
            requesterRefundApplied: i.requesterRefundApplied || false,
            deductionConfirmedAt: i.deductionConfirmedAt,
            createdAt: i.createdAt,
          };
        });

      res.json(refundIncidents);
    } catch (err: any) {
      console.error("Error fetching refund incidents:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Confirm helper deduction (차감 확정)
  app.patch("/api/admin/incident-reports/:id/confirm-deduction", adminAuth, requirePermission("disputes.edit"), async (req, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const incident = await storage.getIncidentReport(incidentId);

      if (!incident) {
        return res.status(404).json({ message: "사고 접수를 찾을 수 없습니다." });
      }

      if (incident.helperDeductionApplied) {
        return res.status(400).json({ message: "이미 차감이 확정되었습니다." });
      }

      const deductionAmount = incident.deductionAmount || 0;
      const orderId = incident.orderId;

      // Update settlement_records with damage deduction
      if (orderId && deductionAmount > 0) {
        const existingRecord = await db.select().from(settlementRecords).where(eq(settlementRecords.orderId, orderId)).limit(1);

        if (existingRecord.length > 0) {
          const currentDeduction = existingRecord[0].damageDeduction || 0;
          await db.update(settlementRecords)
            .set({
              damageDeduction: currentDeduction + deductionAmount,
              updatedAt: new Date()
            })
            .where(eq(settlementRecords.orderId, orderId));

          console.log(`[Incident Deduction] Order ${orderId}: Applied deduction ${deductionAmount}원 to settlement`);
        } else {
          console.log(`[Incident Deduction] Order ${orderId}: No settlement record found, deduction noted for future settlement`);
        }
      }

      await storage.updateIncidentReport(incidentId, {
        helperDeductionApplied: true,
        deductionConfirmedAt: new Date(),
      });

      res.json({
        message: "헬퍼 차감이 확정되었습니다.",
        deductionAmount,
        orderId
      });
    } catch (err: any) {
      console.error("Error confirming deduction:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Confirm requester refund (환불 확정)
  app.patch("/api/admin/incident-reports/:id/confirm-refund", adminAuth, requirePermission("disputes.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const incident = await storage.getIncidentReport(incidentId);

      if (!incident) {
        return res.status(404).json({ message: "사고 접수를 찾을 수 없습니다." });
      }

      if (incident.requesterRefundApplied) {
        return res.status(400).json({ message: "이미 환불이 확정되었습니다." });
      }

      const refundAmount = incident.refundAmount || 0;
      const orderId = incident.orderId;
      const requesterId = incident.requesterId;
      const adminUserId = req.user?.id;

      // Create refund record if there's a refund amount
      if (refundAmount > 0 && requesterId) {
        await db.insert(refunds).values({
          orderId: orderId || null,
          incidentId: incidentId,
          requesterId: requesterId,
          amount: refundAmount,
          reason: `화물사고 환불 - ${incident.incidentType || '사고'}: ${incident.description || ''}`.substring(0, 500),
          reasonCategory: 'incident',
          status: 'completed',
          refundMethod: 'bank_transfer',
          requestedBy: adminUserId || null,
          requestedAt: new Date(),
          approvedBy: adminUserId || null,
          approvedAt: new Date(),
          completedAt: new Date(),
        });

        console.log(`[Incident Refund] Incident ${incidentId}: Created refund of ${refundAmount}원 for requester ${requesterId}`);
      }

      await storage.updateIncidentReport(incidentId, {
        requesterRefundApplied: true,
        refundConfirmedAt: new Date(),
      });

      res.json({
        message: "요청자 환불이 확정되었습니다.",
        refundAmount,
        requesterId
      });
    } catch (err: any) {
      console.error("Error confirming refund:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app.patch("/api/admin/helper-disputes/:id/status", adminAuth, requirePermission("disputes.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, resolution, adminReply } = req.body;
      const adminUser = (req as any).adminUser;

      // 유효한 상태값 검증
      const validDisputeStatuses = ["submitted", "reviewing", "resolved", "rejected"];
      if (!validDisputeStatuses.includes(status)) {
        return res.status(400).json({ message: `유효하지 않은 상태입니다: ${status}` });
      }

      const dispute = await storage.getDispute(id);
      if (!dispute) {
        return res.status(404).json({ message: "이의제기를 찾을 수 없습니다" });
      }

      const updateData: any = { status };
      if (resolution) updateData.resolution = resolution;
      if (adminReply) { updateData.adminReply = adminReply; updateData.adminReplyAt = new Date(); updateData.adminReplyBy = adminUser?.id || null; }
      if (status === "resolved" || status === "rejected") {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = adminUser?.id || null;
      }

      const updated = await storage.updateDispute(id, updateData);

      // 헬퍼에게 알림
      if (dispute.helperId) {
        const statusLabel = status === "resolved" ? "해결됨" :
          status === "rejected" ? "반려됨" :
            status === "reviewing" ? "검토중" : status;
        await storage.createNotification({
          userId: dispute.helperId || dispute.submitterId,
          type: "announcement",
          title: "이의제기 상태 변경",
          message: `${dispute.workDate} 작업건 이의제기가 "${statusLabel}"으로 변경되었습니다.${resolution ? ` 결과: ${resolution}` : ""}`,
        });

        sendPushToUser(dispute.helperId, {
          title: "이의제기 상태 변경",
          body: `${dispute.workDate} 작업건 이의제기: ${statusLabel}`,
          url: "/work-history",
          tag: `dispute-${id}`,
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Tiered pricing CRUD - 택배사별 구간 요금 관리
  app.get("/api/admin/tiered-pricing", adminAuth, requirePermission("pricing.view"), async (req, res) => {
    try {
      const tiers = await storage.getAllCourierTieredPricing();
      res.json(tiers);
    } catch (err: any) {
      console.error("tiered pricing list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/tiered-pricing", adminAuth, requirePermission("pricing.edit"), async (req, res) => {
    try {
      const { courierId, minBoxCount, maxBoxCount, minTotalVatInclusive, description } = req.body;
      if (!courierId || minBoxCount == null || minTotalVatInclusive == null) {
        return res.status(400).json({ message: "필수 필드가 누락되었습니다 (courierId, minBoxCount, minTotalVatInclusive)" });
      }

      // Calculate pricePerBox from VAT-inclusive total
      // VAT rate: 10% (divide by 1.1 to get net)
      const netTotal = Math.round(minTotalVatInclusive / 1.1);
      const boxCount = minBoxCount || 1;
      // Round up to nearest 100 won
      const calculatedPricePerBox = Math.ceil(netTotal / boxCount / 100) * 100;
      const calculatedIncrement = 100; // Fixed at \100

      const tier = await storage.createCourierTieredPricing({
        courierId,
        minBoxCount,
        maxBoxCount: maxBoxCount || null,
        minTotalVatInclusive,
        pricePerBox: calculatedPricePerBox,
        belowMinIncrementPerBox: calculatedIncrement,
        description: description || null,
        isActive: true,
      });
      res.status(201).json(tier);
    } catch (err: any) {
      console.error("tiered pricing create error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/tiered-pricing/:id", adminAuth, requirePermission("pricing.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "유효하지 않은 ID입니다" });
      }

      const { minBoxCount, maxBoxCount, minTotalVatInclusive, description } = req.body;

      // Calculate pricePerBox from VAT-inclusive total if provided
      let calculatedPricePerBox: number | undefined;
      let calculatedIncrement: number | undefined;

      if (minTotalVatInclusive != null && minBoxCount != null) {
        const netTotal = Math.round(minTotalVatInclusive / 1.1);
        const boxCount = minBoxCount || 1;
        calculatedPricePerBox = Math.ceil(netTotal / boxCount / 100) * 100;
        calculatedIncrement = 100;
      }

      const tier = await storage.updateCourierTieredPricing(id, {
        minBoxCount,
        maxBoxCount,
        minTotalVatInclusive,
        pricePerBox: calculatedPricePerBox,
        belowMinIncrementPerBox: calculatedIncrement,
        description,
      });
      res.json(tier);
    } catch (err: any) {
      console.error("tiered pricing update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/tiered-pricing/:id", adminAuth, requirePermission("pricing.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCourierTieredPricing(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("tiered pricing delete error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send notification (admin push notification)
  app.post("/api/admin/send-notification", adminAuth, requirePermission("notifications.send"), async (req, res) => {
    try {
      const { message, target, userIds } = req.body;

      let targetUsers: any[] = [];

      if (userIds && userIds.length > 0) {
        targetUsers = await Promise.all(userIds.map((id: string) => storage.getUser(id)));
        targetUsers = targetUsers.filter(Boolean);
      } else {
        const allUsers = await storage.getAllUsers();
        if (target === "helpers") {
          targetUsers = allUsers.filter(u => u.role === "helper");
        } else if (target === "requesters") {
          targetUsers = allUsers.filter(u => u.role === "requester");
        } else {
          targetUsers = allUsers;
        }
      }

      const notifications = await Promise.all(
        targetUsers.map((user) =>
          storage.createNotification({
            userId: user.id,
            type: "announcement",
            title: "관리자 알림",
            message,
          })
        )
      );

      res.json({ sent: notifications.length, message: "Notifications sent" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send settlement email to helper
  app.post("/api/admin/helpers/:helperId/settlement-email", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { helperId } = req.params;
      const { month, year, isRevised } = req.body;

      if (!month || !year || typeof month !== 'number' || typeof year !== 'number' ||
        month < 1 || month > 12 || year < 2020 || year > 2100) {
        return res.status(400).json({ message: "Invalid month or year" });
      }

      const helper = await storage.getUser(helperId);
      if (!helper) {
        return res.status(404).json({ message: "Helper not found" });
      }

      if (!helper.email) {
        return res.status(400).json({ message: "Helper has no email address" });
      }

      const allSettlements = await storage.getAllSettlementStatements();
      const monthSettlements = allSettlements.filter((s: SettlementStatement) => {
        if (s.helperId !== helperId) return false;
        if (!s.workDate) return false;
        const workDate = new Date(s.workDate as string | Date);
        if (isNaN(workDate.getTime())) return false;
        return workDate.getMonth() + 1 === month && workDate.getFullYear() === year;
      });

      if (monthSettlements.length === 0) {
        return res.status(400).json({ message: "해당 월에 정산 내역이 없습니다." });
      }

      const allOrders = await storage.getAllHelpPosts();

      const settlementDetails = monthSettlements.map((s: SettlementStatement) => {
        const order = s.orderId ? allOrders.find(o => o.id === s.orderId) : null;
        const workDate = new Date(s.workDate as string | Date);
        return {
          workDate: `${workDate.getMonth() + 1}/${workDate.getDate()}`,
          orderTitle: order?.title || s.orderId?.toString() || '-',
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
      });

      const summary = {
        totalDeliveryCount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.deliveryCount || 0), 0),
        totalReturnCount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.returnCount || 0), 0),
        totalPickupCount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.pickupCount || 0), 0),
        totalOtherCount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.otherCount || 0), 0),
        totalSupplyAmount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.supplyAmount || 0), 0),
        totalVatAmount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.vatAmount || 0), 0),
        grandTotalAmount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.totalAmount || 0), 0),
        totalCommission: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.commissionAmount || 0), 0),
        totalNetAmount: monthSettlements.reduce((sum: number, s: SettlementStatement) => sum + (s.netAmount || 0), 0),
        commissionRate: monthSettlements[0]?.commissionRate || 10,
      };

      const { generateSettlementEmailHtml, generateSettlementEmailSubject } = await import("../../templates/settlement-email");

      const emailHtml = generateSettlementEmailHtml({
        year,
        month,
        settlements: settlementDetails,
        summary,
        isRevised: isRevised || false,
      } as any);

      const revisionSuffix = isRevised ? ' (수정본)' : ' (1차)';
      const subject = `[헬프미] ${year}년 ${month}월 정산서${revisionSuffix}`;

      const smtpHostSetting = await storage.getSystemSetting("smtp_host");
      const smtpPortSetting = await storage.getSystemSetting("smtp_port");
      const smtpUserSetting = await storage.getSystemSetting("smtp_user");
      const smtpPassSetting = await storage.getSystemSetting("smtp_password");
      const smtpFromSetting = await storage.getSystemSetting("smtp_from_email");

      const smtpHost = smtpHostSetting?.settingValue;
      const smtpPort = smtpPortSetting?.settingValue;
      const smtpUser = smtpUserSetting?.settingValue;
      const smtpPass = smtpPassSetting?.settingValue;
      const smtpFrom = smtpFromSetting?.settingValue;

      if (smtpHost && smtpUser && smtpPass) {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort || "587"),
          secure: smtpPort === "465",
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: smtpFrom || smtpUser,
          to: helper.email,
          subject,
          html: emailHtml,
        });

        console.log(`[Settlement Email] Sent to ${helper.email}`);
        res.json({
          success: true,
          message: "정산서가 이메일로 발송되었습니다.",
          data: {
            email: helper.email,
            period: `${year}년 ${month}월`,
            settlementCount: monthSettlements.length,
            totalNetAmount: summary.totalNetAmount,
          }
        });
      } else {
        console.log(`[Settlement Email] SMTP not configured, logging email content`);
        console.log(`  To: ${helper.email}`);
        console.log(`  Subject: ${subject}`);
        console.log(`  Period: ${year}년 ${month}월`);
        console.log(`  Settlements: ${monthSettlements.length}건`);
        console.log(`  Total Net: ${summary.totalNetAmount}원`);

        res.json({
          success: true,
          message: "SMTP 설정이 없어 이메일 발송을 시뮬레이션했습니다. 관리자 설정에서 SMTP를 구성해주세요.",
          data: {
            email: helper.email,
            period: `${year}년 ${month}월`,
            settlementCount: monthSettlements.length,
            totalNetAmount: summary.totalNetAmount,
            smtpConfigured: false,
          }
        });
      }
    } catch (err: any) {
      console.error("Settlement email error:", err);
      res.status(500).json({ message: "정산서 이메일 발송에 실패했습니다." });
    }
  });

  // Batch send settlement emails to all helpers with settlements in a month
  app.post("/api/admin/settlements/batch-send-emails", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { month, year, isRevised } = req.body;

      if (!month || !year || typeof month !== 'number' || typeof year !== 'number' ||
        month < 1 || month > 12 || year < 2020 || year > 2100) {
        return res.status(400).json({ message: "Invalid month or year" });
      }

      const allSettlements = await storage.getAllSettlementStatements();
      const monthSettlements = allSettlements.filter((s: SettlementStatement) => {
        if (!s.workDate) return false;
        const workDate = new Date(s.workDate as string | Date);
        if (isNaN(workDate.getTime())) return false;
        return workDate.getMonth() + 1 === month && workDate.getFullYear() === year;
      });

      if (monthSettlements.length === 0) {
        return res.status(400).json({ message: "해당 월에 정산 내역이 없습니다." });
      }

      // Group settlements by helperId
      const helperSettlements = new Map<string, SettlementStatement[]>();
      for (const s of monthSettlements) {
        if (!s.helperId) continue;
        const existing = helperSettlements.get(s.helperId) || [];
        existing.push(s);
        helperSettlements.set(s.helperId, existing);
      }

      const allOrders = await storage.getAllHelpPosts();
      const { generateSettlementEmailHtml } = await import("../../templates/settlement-email");

      // Get SMTP settings
      const smtpHostSetting = await storage.getSystemSetting("smtp_host");
      const smtpPortSetting = await storage.getSystemSetting("smtp_port");
      const smtpUserSetting = await storage.getSystemSetting("smtp_user");
      const smtpPassSetting = await storage.getSystemSetting("smtp_password");
      const smtpFromSetting = await storage.getSystemSetting("smtp_from_email");

      const smtpHost = smtpHostSetting?.settingValue;
      const smtpPort = smtpPortSetting?.settingValue;
      const smtpUser = smtpUserSetting?.settingValue;
      const smtpPass = smtpPassSetting?.settingValue;
      const smtpFrom = smtpFromSetting?.settingValue;

      let transporter: any = null;
      if (smtpHost && smtpUser && smtpPass) {
        const nodemailer = await import("nodemailer");
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort || "587"),
          secure: smtpPort === "465",
          auth: { user: smtpUser, pass: smtpPass },
        });
      }

      const results: Array<{ helperId: string; helperName: string; email: string; success: boolean; error?: string }> = [];

      for (const [helperId, settlements] of Array.from(helperSettlements)) {
        const helper = await storage.getUser(helperId);
        if (!helper) {
          results.push({ helperId, helperName: "-", email: "-", success: false, error: "Helper not found" });
          continue;
        }
        if (!helper.email) {
          results.push({ helperId, helperName: helper.name || helperId, email: "-", success: false, error: "No email address" });
          continue;
        }

        const settlementDetails = settlements.map((s: SettlementStatement) => {
          const order = s.orderId ? allOrders.find(o => o.id === s.orderId) : null;
          const workDate = new Date(s.workDate as string | Date);
          return {
            workDate: `${workDate.getMonth() + 1}/${workDate.getDate()}`,
            orderTitle: order?.title || s.orderId?.toString() || '-',
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
        });

        const summary = {
          totalDeliveryCount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.deliveryCount || 0), 0),
          totalReturnCount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.returnCount || 0), 0),
          totalPickupCount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.pickupCount || 0), 0),
          totalOtherCount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.otherCount || 0), 0),
          totalSupplyAmount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.supplyAmount || 0), 0),
          totalVatAmount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.vatAmount || 0), 0),
          grandTotalAmount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.totalAmount || 0), 0),
          totalCommission: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.commissionAmount || 0), 0),
          totalNetAmount: settlements.reduce((sum: number, s: SettlementStatement) => sum + (s.netAmount || 0), 0),
          commissionRate: settlements[0]?.commissionRate || 10,
        };

        const emailHtml = generateSettlementEmailHtml({
          year,
          month,
          settlements: settlementDetails,
          summary,
          isRevised: isRevised || false,
        } as any);

        const revisionSuffix = isRevised ? ' (수정본)' : ' (1차)';
        const subject = `[헬프미] ${year}년 ${month}월 정산서${revisionSuffix}`;

        try {
          if (transporter) {
            await transporter.sendMail({
              from: smtpFrom || smtpUser,
              to: helper.email,
              subject,
              html: emailHtml,
            });
            console.log(`[Batch Settlement Email] Sent to ${helper.email}`);
            results.push({ helperId, helperName: helper.name || helperId, email: helper.email, success: true });
          } else {
            console.log(`[Batch Settlement Email] SMTP not configured, skipped for ${helper.email}`);
            results.push({ helperId, helperName: helper.name || helperId, email: helper.email, success: false, error: "SMTP 미설정 - 이메일 발송 불가" });
          }
        } catch (emailErr: any) {
          console.error(`[Batch Settlement Email] Failed for ${helper.email}:`, emailErr);
          results.push({ helperId, helperName: helper.name || helperId, email: helper.email, success: false, error: emailErr.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `${successCount}명에게 정산서 발송 완료, ${failCount}명 실패`,
        data: {
          period: `${year}년 ${month}월`,
          totalHelpers: results.length,
          successCount,
          failCount,
          results,
        }
      });
    } catch (err: any) {
      console.error("Batch settlement email error:", err);
      res.status(500).json({ message: "일괄 정산서 발송에 실패했습니다." });
    }
  });

  // ===== Settlement Excel Download (CSV) =====
  app.get("/api/admin/settlements/export", adminAuth, requirePermission("settlements.view"), async (req, res) => {
    try {
      const { month, year, status } = req.query;

      let settlements = await storage.getAllSettlementStatements();

      if (month && year) {
        const m = parseInt(month as string);
        const y = parseInt(year as string);
        settlements = settlements.filter((s: SettlementStatement) => {
          if (!s.workDate) return false;
          const workDate = new Date(s.workDate as string | Date);
          if (isNaN(workDate.getTime())) return false;
          return workDate.getMonth() + 1 === m && workDate.getFullYear() === y;
        });
      }

      if (status && status !== "all") {
        settlements = settlements.filter((s: SettlementStatement) => s.status === status);
      }

      const allOrders = await storage.getAllHelpPosts();
      const allUsers = await storage.getAllUsers();

      const csvHeader = [
        "정산ID", "작업일", "헬퍼ID", "헬퍼명", "오더ID", "배송수", "반품수", "픽업수", "기타",
        "공급가액", "부가세", "총액", "수수료율(%)", "수수료", "본사수수료", "팀장인센티브",
        "차감액", "정산금액", "상태", "확정일", "지급일"
      ].join(",");

      const csvRows = settlements.map((s: SettlementStatement) => {
        const helper = allUsers.find(u => u.id === s.helperId);
        const order = allOrders.find(o => o.id === s.orderId);
        const workDateStr = s.workDate ? new Date(s.workDate as string | Date).toISOString().split("T")[0] : "";
        const confirmedAtStr = s.helperConfirmedAt ? new Date(s.helperConfirmedAt).toISOString().split("T")[0] : "";

        return [
          s.id,
          workDateStr,
          (helper?.name || "").replace(/,/g, " "),
          s.orderId || "",
          s.deliveryCount || 0,
          s.returnCount || 0,
          s.pickupCount || 0,
          s.otherCount || 0,
          s.supplyAmount || 0,
          s.vatAmount || 0,
          s.totalAmount || 0,
          s.commissionRate || 0,
          s.commissionAmount || 0,
          s.platformCommission || 0,
          s.teamLeaderIncentive || 0,
          s.deduction || 0,
          s.netAmount || 0,
          s.status || "",
          confirmedAtStr,
          s.status === "paid" ? confirmedAtStr : ""
        ].join(",");
      });

      const csvContent = [csvHeader, ...csvRows].join("\n");
      const BOM = "\uFEFF";

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="settlements_${year || 'all'}_${month || 'all'}.csv"`);
      res.send(BOM + csvContent);
    } catch (err: any) {
      console.error("Settlement export error:", err);
      res.status(500).json({ message: "정산 내역 내보내기에 실패했습니다." });
    }
  });

  // ===== Payment Intent APIs =====
  app.post("/api/admin/payment-intents", adminAuth, requirePermission("payments.create"), async (req, res) => {
    try {
      const { orderId, contractId, payerId, payerRole, paymentType, amount } = req.body;

      if (!payerId || !paymentType || !amount) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다." });
      }

      const idempotencyKey = `${orderId || 'no-order'}-${paymentType}-${Date.now()}`;

      res.json({
        id: Date.now(),
        orderId,
        contractId,
        payerId,
        payerRole: payerRole || "requester",
        paymentType,
        amount,
        status: "created",
        idempotencyKey,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ message: "결제 Intent 생성에 실패했습니다." });
    }
  });

  app.get("/api/admin/payment-intents", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      res.json([]);
    } catch (err: any) {
      res.status(500).json({ message: "결제 Intent 조회에 실패했습니다." });
    }
  });

  // ===== Missing Admin API Endpoints (T-44) =====

  // Customer inquiries (CS tickets)
  app.get("/api/admin/customer-inquiries", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { status, priority, category, limit = "50", offset = "0" } = req.query;
      let query = db.select().from(customerInquiries).orderBy(desc(customerInquiries.createdAt));

      const conditions: any[] = [];
      if (status && status !== 'all') conditions.push(eq(customerInquiries.status, status as string));
      if (priority) conditions.push(eq(customerInquiries.priority, priority as string));
      if (category) conditions.push(eq(customerInquiries.category, category as string));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const inquiries = await query.limit(parseInt(limit as string)).offset(parseInt(offset as string));
      res.json(inquiries);
    } catch (err: any) {
      console.error("Get customer inquiries error:", err);
      res.status(500).json({ message: "Failed to fetch customer inquiries" });
    }
  });

  // Ticket escalations
  app.get("/api/admin/ticket-escalations", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { status, limit = "50" } = req.query;
      let query = db.select().from(ticketEscalations).orderBy(desc(ticketEscalations.createdAt));

      if (status && status !== 'all') {
        query = query.where(eq(ticketEscalations.status, status as string)) as any;
      }

      const escalations = await query.limit(parseInt(limit as string));
      res.json(escalations);
    } catch (err: any) {
      console.error("Get ticket escalations error:", err);
      res.status(500).json({ message: "Failed to fetch ticket escalations" });
    }
  });

  // Push messages (notification history)
  app.get("/api/admin/push-messages", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const { status, category, limit = "100" } = req.query;
      let query = db.select().from(pushNotificationLogs).orderBy(desc(pushNotificationLogs.createdAt));

      const conditions: any[] = [];
      if (status && status !== 'all') conditions.push(eq(pushNotificationLogs.status, status as string));
      if (category) conditions.push(eq(pushNotificationLogs.category, category as string));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const messages = await query.limit(parseInt(limit as string));
      res.json(messages);
    } catch (err: any) {
      console.error("Get push messages error:", err);
      res.status(500).json({ message: "Failed to fetch push messages" });
    }
  });

  // Region pricing rules
  app.get("/api/admin/region-pricing-rules", adminAuth, requirePermission("pricing.view"), async (req, res) => {
    try {
      const rules = await db.select().from(regionPricingRules).orderBy(regionPricingRules.regionName);
      res.json(rules);
    } catch (err: any) {
      console.error("Get region pricing rules error:", err);
      res.status(500).json({ message: "Failed to fetch region pricing rules" });
    }
  });

  // SMS templates

  // SMS logs
  app.get("/api/admin/sms-logs", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { status, limit = "100" } = req.query;
      let query = db.select().from(smsLogs).orderBy(desc(smsLogs.createdAt));

      if (status && status !== 'all') {
        query = query.where(eq(smsLogs.status, status as string)) as any;
      }

      const logs = await query.limit(parseInt(limit as string));
      res.json(logs);
    } catch (err: any) {
      console.error("Get SMS logs error:", err);
      res.status(500).json({ message: "Failed to fetch SMS logs" });
    }
  });

  // Refunds

  // Integration health - dynamic status check

  // Webhook logs

  // Carrier min rates
  app.get("/api/admin/carrier-min-rates", adminAuth, requirePermission("pricing.view"), async (req, res) => {
    try {
      const rates = await db.select().from(carrierMinRates).orderBy(carrierMinRates.courierId);
      res.json(rates);
    } catch (err: any) {
      console.error("Get carrier min rates error:", err);
      res.status(500).json({ message: "Failed to fetch carrier min rates" });
    }
  });

  // Pricing tables
  app.get("/api/admin/pricing-tables", adminAuth, requirePermission("pricing.view"), async (req, res) => {
    try {
      const tables = await db.select().from(pricingTables).orderBy(pricingTables.name);
      res.json(tables);
    } catch (err: any) {
      console.error("Get pricing tables error:", err);
      res.status(500).json({ message: "Failed to fetch pricing tables" });
    }
  });

  // Document review tasks
  app.get("/api/admin/document-review-tasks", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const { status, limit = "50" } = req.query;
      let query = db.select().from(documentReviewTasks).orderBy(desc(documentReviewTasks.createdAt));

      if (status && status !== 'all') {
        query = query.where(eq(documentReviewTasks.status, status as string)) as any;
      }

      const tasks = await query.limit(parseInt(limit as string));
      res.json(tasks);
    } catch (err: any) {
      console.error("Get document review tasks error:", err);
      res.status(500).json({ message: "Failed to fetch document review tasks" });
    }
  });

  // Identity verifications
  app.get("/api/admin/identity-verifications", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const { status, limit = "50" } = req.query;
      let query = db.select().from(identityVerifications).orderBy(desc(identityVerifications.createdAt));

      if (status && status !== 'all') {
        query = query.where(eq(identityVerifications.status, status as string)) as any;
      }

      const verifications = await query.limit(parseInt(limit as string));
      res.json(verifications);
    } catch (err: any) {
      console.error("Get identity verifications error:", err);
      res.status(500).json({ message: "Failed to fetch identity verifications" });
    }
  });

  // Process document review task
  app.post("/api/admin/document-review-tasks/:taskId", adminAuth, requirePermission("helpers.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId } = req.params;
      const { status, reviewedBy, rejectReason } = req.body;

      const [updated] = await db.update(documentReviewTasks)
        .set({
          status,
          reviewedBy: req.adminUser?.id,
          reviewedAt: new Date(),
          rejectReason,
          updatedAt: new Date()
        })
        .where(eq(documentReviewTasks.id, parseInt(taskId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Process document review task error:", err);
      res.status(500).json({ message: "Failed to process task" });
    }
  });

  // Process refund
  app.post("/api/admin/refunds/:refundId", adminAuth, requirePermission("payments.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const { refundId } = req.params;
      const { status, processedNote } = req.body;

      const [updated] = await db.update(refunds)
        .set({
          status,
          processedBy: req.adminUser?.id,
          processedAt: new Date(),
          adminNotes: processedNote,
          updatedAt: new Date()
        })
        .where(eq(refunds.id, parseInt(refundId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Refund not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Process refund error:", err);
      res.status(500).json({ message: "Failed to process refund" });
    }
  });

  // Deductions list
  // 차감 목록은 아래 /api/admin/deductions (deductions 테이블 기반) 사용

  // Admin roles
  app.get("/api/admin/roles", adminAuth, requirePermission("staff.view"), async (req, res) => {
    try {
      // Return basic roles list
      const roles = await storage.getAllRoles();
      res.json(roles || []);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== Team Management Routes =====

  // Admin: Assign/remove team leader role
  app.patch("/api/admin/users/:userId/team-leader", adminAuth, requirePermission("helpers.edit"), async (req, res) => {
    try {
      const { userId } = req.params;
      const { isTeamLeader } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      if (user.role !== "helper") {
        return res.status(400).json({ message: "헬퍼만 팀장이 될 수 있습니다" });
      }

      const updated = await storage.updateUserRoles(userId, { isTeamLeader });

      // If becoming team leader, create a team for them
      if (isTeamLeader) {
        const existingTeam = await storage.getTeamByLeader(userId);
        if (!existingTeam) {
          const { randomUUID } = await import("crypto");
          await storage.createTeam({
            leaderId: userId,
            name: `${user.name}팀`,
            qrCodeToken: randomUUID(),
            isActive: true,
          });
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Assign/remove HQ staff role
  app.patch("/api/admin/users/:userId/hq-staff", adminAuth, requirePermission("staff.roles"), async (req, res) => {
    try {
      const { userId } = req.params;
      const { isHqStaff } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      const updated = await storage.updateUserRoles(userId, { isHqStaff });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Change user role (helper <-> requester) - 고객센터용
  const adminRoleChangeSchema = z.object({
    role: z.enum(["helper", "requester"]),
  });

  app.patch("/api/admin/users/:userId/role", adminAuth, requirePermission("helpers.manage"), async (req, res) => {
    try {
      const { userId } = req.params;

      const parseResult = adminRoleChangeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "유효하지 않은 역할입니다" });
      }

      const { role } = parseResult.data;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      if (user.isHqStaff) {
        return res.status(400).json({ message: "관리자의 역할은 변경할 수 없습니다" });
      }

      // Generate checkInToken for requesters if needed
      const checkInToken = role === "requester" && !user.checkInToken
        ? randomBytes(32).toString("hex")
        : user.checkInToken;

      // onboardingStatus 로직:
      // - 요청자로 전환/유지: approved (요청자는 온보딩 불필요)
      // - 헬퍼로 전환 (요청자→헬퍼): pending (헬퍼 온보딩 필요)
      // - 헬퍼 유지 (헬퍼→헬퍼): 기존 상태 유지
      let onboardingStatus: string;
      if (role === "requester") {
        onboardingStatus = "approved";
      } else if (user.role === "helper") {
        onboardingStatus = user.onboardingStatus || "pending";
      } else {
        onboardingStatus = "pending";
      }

      const updated = await storage.updateUser(userId, {
        role,
        checkInToken,
        onboardingStatus,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Get all teams
  app.get("/api/admin/teams", adminAuth, requirePermission("teams.view"), async (req, res) => {
    try {
      const allTeams = await storage.getAllTeams();
      const teamsWithMembers = await Promise.all(
        allTeams.map(async (team) => {
          const members = await storage.getTeamMembers(team.id);
          const leader = await storage.getUser(team.leaderId);
          const commissionOverride = await storage.getTeamCommissionOverride(team.id);
          const memberUsers = await Promise.all(
            members.map(async (m) => {
              const user = await storage.getUser(m.helperId);
              return { ...m, user };
            })
          );
          return { ...team, leader, members: memberUsers, commissionRate: commissionOverride?.commissionRate || 0 };
        })
      );
      res.json(teamsWithMembers);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Create team
  app.post("/api/admin/teams", adminAuth, requirePermission("teams.create"), async (req, res) => {
    try {
      const { name, leaderId, commissionRate, businessType, emergencyPhone } = req.body;

      if (!name || !leaderId) {
        return res.status(400).json({ message: "팀 이름과 팀장을 선택해주세요" });
      }

      if (commissionRate === undefined || commissionRate === null || isNaN(Number(commissionRate))) {
        return res.status(400).json({ message: "팀 수수료율을 입력해주세요" });
      }

      const rate = Number(commissionRate);
      if (rate < 0 || rate > 15) {
        return res.status(400).json({ message: "수수료율은 0~15% 사이로 입력해주세요" });
      }

      // Check if leader exists and is a helper
      const leader = await storage.getUser(leaderId);
      if (!leader || leader.role !== "helper") {
        return res.status(400).json({ message: "유효한 헬퍼를 팀장으로 선택해주세요" });
      }

      // Check if leader already has a team
      const existingTeam = await storage.getTeamByLeader(leaderId);
      if (existingTeam) {
        return res.status(400).json({ message: "이미 팀장으로 등록된 헬퍼입니다" });
      }

      // Generate QR token (secure random)
      const qrCodeToken = `TEAM-${Date.now()}-${randomBytes(6).toString('hex')}`.toUpperCase();

      // Create team
      const team = await storage.createTeam({
        name,
        leaderId,
        qrCodeToken,
        isActive: true,
        businessType,
        emergencyPhone,
      });

      // Set user as team leader
      await storage.updateUserRoles(leaderId, { isTeamLeader: true });

      // Always create commission override (validated above)
      await storage.createTeamCommissionOverride({
        teamId: team.id,
        commissionRate: rate,
        notes: `팀 생성 시 설정된 수수료율: ${rate}%`,
      });

      res.json({ ...team, leader, commissionRate: commissionRate || 0 });
    } catch (err: any) {
      console.error("Create team error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Update team
  app.patch("/api/admin/teams/:teamId", adminAuth, requirePermission("teams.edit"), async (req, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const { name, isActive, commissionRate, businessType, emergencyPhone } = req.body;

      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }

      // Validate commission rate if provided
      if (commissionRate !== undefined) {
        if (commissionRate === null || isNaN(Number(commissionRate))) {
          return res.status(400).json({ message: "유효한 수수료율을 입력해주세요" });
        }
        const rate = Number(commissionRate);
        if (rate < 0 || rate > 15) {
          return res.status(400).json({ message: "수수료율은 0~15% 사이로 입력해주세요" });
        }
      }

      // Update team basic info including new fields
      const updatedTeam = await storage.updateTeam(teamId, {
        name,
        isActive,
        businessType,
        emergencyPhone,
        commissionRate: commissionRate !== undefined ? Number(commissionRate) : undefined,
      });

      // Update commission rate (always update if provided)
      if (commissionRate !== undefined) {
        const rate = Number(commissionRate);
        const existingOverride = await storage.getTeamCommissionOverride(teamId);
        if (existingOverride) {
          await storage.updateTeamCommissionOverride(existingOverride.id, {
            commissionRate: rate,
            notes: `수수료율 수정: ${rate}%`
          });
        } else {
          await storage.createTeamCommissionOverride({
            teamId,
            commissionRate: rate,
            notes: `수수료율 설정: ${rate}%`,
          });
        }
      }

      const leader = await storage.getUser(updatedTeam.leaderId);
      const finalOverride = await storage.getTeamCommissionOverride(teamId);
      res.json({ ...updatedTeam, leader, commissionRate: finalOverride?.commissionRate || 0 });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== SYSTEM SETTINGS API ====================

  // Admin: Get system settings
  app.get("/api/admin/system-settings", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const result: Record<string, string> = {};
      for (const s of settings) {
        result[s.settingKey] = s.settingValue;
      }
      res.json(result);
    } catch (err: any) {
      console.error("Get system settings error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Update system setting (슈퍼관리자만 가능)
  app.post("/api/admin/system-settings", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      // 슈퍼관리자만 시스템 설정 변경 가능
      const adminUser = (req as any).adminUser;
      if (adminUser?.role !== 'superadmin' && adminUser?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: "시스템 설정은 슈퍼관리자만 변경할 수 있습니다." });
      }

      const { key, value, description } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: "key와 value가 필요합니다" });
      }
      const setting = await storage.upsertSystemSetting(key, String(value), description);
      res.json({ success: true, setting });
    } catch (err: any) {
      console.error("Update system setting error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== PUBLIC PLATFORM INFO API (앱에서 사용) ====================

  // 앱용: 공개 플랫폼 정보 조회 (인증 불필요)
  // 민감하지 않은 플랫폼 정보만 노출 (사업자번호, 내부 설정 등 제외)
  app.get("/api/platform-info", async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        settingsMap[s.settingKey] = s.settingValue;
      }

      // 앱에서 사용할 공개 정보만 선별하여 반환
      const publicInfo = {
        // 회사 기본정보
        companyName: settingsMap['platform_corp_name'] || '헬프미',
        ceoName: settingsMap['platform_ceo_name'] || '',
        address: settingsMap['platform_addr'] || '',

        // 연락처
        phone: settingsMap['platform_phone'] || '',
        fax: settingsMap['platform_fax'] || '',
        email: settingsMap['platform_email'] || '',

        // CS 고객지원
        csPhone: settingsMap['cs_phone'] || '',
        csEmail: settingsMap['cs_email'] || '',
        csManagerName: settingsMap['cs_manager_name'] || '',
        csOperatingHours: settingsMap['cs_operating_hours'] || '평일 09:00-18:00',

        // 카카오톡/SNS
        kakaoChannelId: settingsMap['kakao_channel_id'] || '',
        kakaoChannelUrl: settingsMap['kakao_channel_url'] || '',
        instagramUrl: settingsMap['instagram_url'] || '',
        blogUrl: settingsMap['blog_url'] || '',

        // 앱 표시 정보
        appFooterText: settingsMap['app_footer_text'] || '',
        privacyPolicyUrl: settingsMap['privacy_policy_url'] || '',
        termsOfServiceUrl: settingsMap['terms_of_service_url'] || '',

        // 통신판매업 정보
        ecommerceRegNum: settingsMap['platform_ecommerce_reg_num'] || '',

        // 개인정보보호 담당자
        privacyOfficerName: settingsMap['cs_manager_name'] || '',
        privacyOfficerEmail: settingsMap['cs_email'] || '',
      };

      res.json(publicInfo);
    } catch (err: any) {
      console.error("Get platform info error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== COMMISSION POLICIES API ====================

  // Admin: Get all commission policies
  app.get("/api/admin/commission-policies", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const policies = await storage.getAllCommissionPolicies();
      res.json(policies);
    } catch (err: any) {
      console.error("Get commission policies error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Create or update commission policy (본사/팀장 수수료율 분리)
  app.post("/api/admin/commission-policies", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { policyType, defaultRate, platformRate, teamLeaderRate, description } = req.body;

      if (!policyType || !["helper", "team_leader"].includes(policyType)) {
        return res.status(400).json({ message: "정책 유형은 'helper' 또는 'team_leader'여야 합니다" });
      }

      // 본사/팀장 수수료율이 제공된 경우 총 수수료율 자동 계산
      let totalRate = Number(defaultRate) || 0;
      let platform = Number(platformRate) || 8;
      let teamLeader = Number(teamLeaderRate) || 2;

      // 총 수수료율이 없으면 본사 + 팀장으로 계산
      if (!defaultRate && (platformRate !== undefined || teamLeaderRate !== undefined)) {
        totalRate = platform + teamLeader;
      }

      if (totalRate < 0 || totalRate > 100) {
        return res.status(400).json({ message: "총 수수료율은 0~100% 사이여야 합니다" });
      }

      if (platform + teamLeader !== totalRate) {
        return res.status(400).json({ message: `본사(${platform}%) + 팀장(${teamLeader}%)가 총 수수료율(${totalRate}%)과 일치해야 합니다` });
      }

      const existing = await storage.getCommissionPolicy(policyType);
      const adminUser = (req as any).user;

      if (existing) {
        const oldValue = {
          defaultRate: existing.defaultRate,
          platformRate: existing.platformRate,
          teamLeaderRate: existing.teamLeaderRate,
        };

        const updated = await storage.updateCommissionPolicy(existing.id, {
          defaultRate: totalRate,
          platformRate: platform,
          teamLeaderRate: teamLeader,
          description,
          modifiedBy: adminUser?.id || null,
        });

        // 감사 로그 기록
        await storage.createAuditLog({
          userId: adminUser?.id,
          action: "commission_policy.update",
          targetType: "commission_policy",
          targetId: String(existing.id),
          oldValue: JSON.stringify(oldValue),
          newValue: JSON.stringify({ defaultRate: totalRate, platformRate: platform, teamLeaderRate: teamLeader }),
          ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: req.headers["user-agent"] || null,
        });

        res.json({ success: true, policy: updated, action: "updated" });
      } else {
        const created = await storage.createCommissionPolicy({
          policyType,
          defaultRate: totalRate,
          platformRate: platform,
          teamLeaderRate: teamLeader,
          description,
          isActive: true,
          modifiedBy: adminUser?.id || null,
        });

        // 감사 로그 기록
        await storage.createAuditLog({
          userId: adminUser?.id,
          action: "commission_policy.create",
          targetType: "commission_policy",
          targetId: String(created.id),
          oldValue: null,
          newValue: JSON.stringify({ policyType, defaultRate: totalRate, platformRate: platform, teamLeaderRate: teamLeader }),
          ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: req.headers["user-agent"] || null,
        });

        res.json({ success: true, policy: created, action: "created" });
      }
    } catch (err: any) {
      console.error("Create/update commission policy error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Get all helper commission overrides
  app.get("/api/admin/helper-commission-overrides", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const overrides = await storage.getAllHelperCommissionOverrides();
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const result = overrides.map(o => ({
        ...o,
        helperName: userMap.get(o.helperId)?.name || "Unknown",
        helperPhone: userMap.get(o.helperId)?.phoneNumber,
      }));

      res.json(result);
    } catch (err: any) {
      console.error("Get helper commission overrides error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Create or update helper commission override
  app.post("/api/admin/helper-commission-overrides", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const { helperId, commissionRate, notes } = req.body;

      if (!helperId) {
        return res.status(400).json({ message: "헬퍼 ID를 입력해주세요" });
      }

      const rate = Number(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ message: "수수료율은 0~100% 사이여야 합니다" });
      }

      const helper = await storage.getUser(helperId);
      if (!helper) {
        return res.status(404).json({ message: "헬퍼를 찾을 수 없습니다" });
      }

      const existing = await storage.getHelperCommissionOverride(helperId);
      if (existing) {
        const updated = await storage.updateHelperCommissionOverride(existing.id, {
          commissionRate: rate,
          notes,
          modifiedBy: (req as any).adminUser?.id || null,
        });
        res.json({ success: true, override: updated, action: "updated" });
      } else {
        const created = await storage.createHelperCommissionOverride({
          commissionRate: rate,
          notes,
          modifiedBy: (req as any).adminUser?.id || null,
        });
        res.json({ success: true, override: created, action: "created" });
      }
    } catch (err: any) {
      console.error("Create/update helper commission override error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Delete helper commission override
  app.delete("/api/admin/helper-commission-overrides/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteHelperCommissionOverride(id);
      res.json({ success: true, message: "헬퍼 수수료 설정이 삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete helper commission override error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Get effective commission rate for a helper
  app.get("/api/admin/helpers/:helperId/commission-rate", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const { helperId } = req.params;
      const helper = await storage.getUser(helperId);
      if (!helper) {
        return res.status(404).json({ message: "헬퍼를 찾을 수 없습니다" });
      }

      const { rate, source } = await storage.getEffectiveCommissionRate(helperId);

      res.json({
        helperName: helper.name,
        commissionRate: rate,
        source,
        description: source === "helper" ? "헬퍼 개별 설정" :
          source === "team" ? "팀 수수료율" :
            source === "global" ? "기본 정책" : "시스템 기본값",
      });
    } catch (err: any) {
      console.error("Get helper commission rate error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Delete team
  app.delete("/api/admin/teams/:teamId", adminAuth, requirePermission("teams.delete"), async (req, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }

      // Remove team leader role from user
      await storage.updateUserRoles(team.leaderId, { isTeamLeader: false });

      await storage.deleteTeam(teamId);
      res.json({ message: "팀이 삭제되었습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Get team details
  app.get("/api/admin/teams/:teamId", adminAuth, requirePermission("teams.view"), async (req, res) => {
    try {
      const team = await storage.getTeam(Number(req.params.teamId));
      if (!team) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }
      const members = await storage.getTeamMembers(team.id);
      const leader = await storage.getUser(team.leaderId);
      const memberUsers = await Promise.all(
        members.map(async (m) => {
          const user = await storage.getUser(m.helperId);
          return { ...m, user };
        })
      );
      res.json({ ...team, leader, members: memberUsers });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Get team members (explicit endpoint)
  app.get("/api/admin/teams/:teamId/members", adminAuth, requirePermission("teams.view"), async (req, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }
      const members = await storage.getTeamMembers(teamId);
      const memberUsers = await Promise.all(
        members.map(async (m) => {
          const user = await storage.getUser(m.helperId);
          return {
            id: m.id,
            name: user?.name || "Unknown",
            phoneNumber: user?.phoneNumber,
            email: user?.email,
            dailyStatus: user?.dailyStatus,
            isActive: m.isActive,
            joinedAt: m.joinedAt,
          };
        })
      );
      res.json(memberUsers);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: Regenerate team QR token
  app.post("/api/admin/teams/:teamId/regenerate-qr", adminAuth, requirePermission("teams.qr"), async (req, res) => {
    try {
      const team = await storage.regenerateTeamQrToken(Number(req.params.teamId));
      res.json(team);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Team leader: Get my team (authenticated helper)
  app.get("/api/teams/my-team", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근할 수 있습니다" });
      }

      // Check if user is team leader
      if (user.isTeamLeader) {
        const team = await storage.getTeamByLeader(user.id);
        if (team) {
          const members = await storage.getTeamMembers(team.id);
          const commissionOverride = await storage.getTeamCommissionOverride(team.id);
          const memberUsers = await Promise.all(
            members.map(async (m) => {
              const memberUser = await storage.getUser(m.helperId);
              return { ...m, user: memberUser };
            })
          );
          return res.json({
            isLeader: true,
            team: {
              ...team,
              members: memberUsers,
              commissionRate: commissionOverride?.commissionRate || 0
            }
          });
        }
      }

      // Check if user is member of a team
      const teamInfo = await storage.getHelperTeam(user.id);
      if (teamInfo) {
        const leader = await storage.getUser(teamInfo.team.leaderId);
        const commissionOverride = await storage.getTeamCommissionOverride(teamInfo.team.id);
        return res.json({
          isLeader: false,
          team: {
            ...teamInfo.team,
            leader,
            commissionRate: commissionOverride?.commissionRate || 0
          },
          membership: teamInfo.membership
        });
      }

      res.json({ isLeader: false, team: null });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper: Join team via QR token
  app.post("/api/teams/join", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { qrToken } = req.body;
      if (!qrToken) {
        return res.status(400).json({ message: "QR 토큰이 필요합니다" });
      }

      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 팀에 가입할 수 있습니다" });
      }

      // Team leaders cannot join other teams
      if (user.isTeamLeader) {
        return res.status(400).json({ message: "팀장은 다른 팀에 가입할 수 없습니다" });
      }

      // Check if already in a team
      const existingTeam = await storage.getHelperTeam(user.id);
      if (existingTeam) {
        return res.status(400).json({ message: "이미 팀에 가입되어 있습니다. 먼저 현재 팀에서 탈퇴해주세요" });
      }

      const team = await storage.getTeamByToken(qrToken);
      if (!team) {
        return res.status(404).json({ message: "유효하지 않은 QR 코드입니다" });
      }

      if (!team.isActive) {
        return res.status(400).json({ message: "이 팀은 현재 활성화되어 있지 않습니다" });
      }

      // Add to team
      const membership = await storage.addTeamMember({
        teamId: team.id,
        helperId: user.id,
        isActive: true,
      });

      const leader = await storage.getUser(team.leaderId);

      res.json({ message: "팀에 가입되었습니다", team: { ...team, leader }, membership });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper: Leave team
  app.post("/api/teams/leave", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근할 수 있습니다" });
      }

      const teamInfo = await storage.getHelperTeam(user.id);
      if (!teamInfo) {
        return res.status(400).json({ message: "가입된 팀이 없습니다" });
      }

      await storage.removeTeamMember(teamInfo.team.id, user.id);
      res.json({ message: "팀에서 탈퇴했습니다" });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get team by QR token (for validation before joining)
  app.get("/api/teams/by-token/:token", async (req, res) => {
    try {
      const authToken = req.headers.authorization?.split(" ")[1];
      if (!authToken) return res.status(401).json({ message: "Unauthorized" });
      jwt.verify(authToken, JWT_SECRET);

      const team = await storage.getTeamByToken(req.params.token);
      if (!team) {
        return res.status(404).json({ message: "팀을 찾을 수 없습니다" });
      }

      const leader = await storage.getUser(team.leaderId);
      res.json({ team: { ...team, leader } });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 월 정산서 전송 API
  // ============================================

  // POST /api/admin/settlements/send-monthly-statement - 헬퍼에게 월 정산서 전송
  app.post("/api/admin/settlements/send-monthly-statement", adminAuth, requirePermission("settlements.edit"), async (req: any, res: any) => {
    try {
      const { helperIds, year, month } = req.body;
      const adminUserId = (req as any).adminUser?.id;

      if (!helperIds || !Array.isArray(helperIds) || helperIds.length === 0) {
        return res.status(400).json({ message: "helperIds는 필수 항목입니다." });
      }
      if (!year || !month) {
        return res.status(400).json({ message: "year, month는 필수 항목입니다." });
      }

      // 보험료율 조회
      const insuranceRateSetting = await storage.getSystemSetting('industrial_accident_insurance_rate');
      const insuranceRate = insuranceRateSetting ? parseFloat(insuranceRateSetting.settingValue) : 1.06;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      const lastDay = new Date(year, month, 0).getDate();

      const results: { helperId: string; success: boolean; error?: string }[] = [];

      for (const helperId of helperIds) {
        try {
          // 해당 헬퍼의 해당 월 마감 보고서 조회
          const helperClosingReports = await db.select().from(closingReports)
            .where(and(
              eq(closingReports.helperId, helperId),
              gte(closingReports.createdAt, startDate),
              lte(closingReports.createdAt, endDate)
            ));

          let totalSupply = 0, totalVat = 0, totalAmount = 0;
          let totalDeductions = 0;
          const dailyData: any[] = [];
          const workDates = new Set<string>();

          for (const cr of helperClosingReports) {
            const order = await storage.getOrder(cr.orderId);
            if (!order) continue;

            // SSOT: 스냅샷 우선, 없으면 calculateSettlement 사용
            let supplyAmount: number, vatAmount: number, total: number;
            if (cr.supplyAmount) {
              supplyAmount = Number(cr.supplyAmount) || 0;
              vatAmount = Number(cr.vatAmount) || 0;
              total = Number(cr.totalAmount) || 0;
            } else {
              const closingData = parseClosingReport(cr, order);
              const settlement = calculateSettlement(closingData);
              supplyAmount = settlement.supplyAmount;
              vatAmount = settlement.vatAmount;
              total = settlement.totalAmount;
            }

            totalSupply += supplyAmount;
            totalVat += vatAmount;
            totalAmount += total;

            // 차감액: 사고차감 + 관리자 수동 조정
            let orderDeduction = 0;
            const incidents = await db.select().from(incidentReports)
              .where(and(
                eq(incidentReports.orderId, cr.orderId),
                eq(incidentReports.helperDeductionApplied, true)
              ));
            orderDeduction += incidents.reduce((sum, ir) => sum + (ir.deductionAmount || 0), 0);
            const adminDeds = await db.select().from(deductions)
              .where(and(
                eq(deductions.orderId, cr.orderId),
                eq(deductions.category, "ADMIN_ADJUSTMENT")
              ));
            orderDeduction += adminDeds.reduce((sum, d) => sum + (d.amount || 0), 0);
            totalDeductions += orderDeduction;

            const dateStr = cr.createdAt ? new Date(cr.createdAt).toISOString().split('T')[0] : '';
            if (dateStr) workDates.add(dateStr);

            dailyData.push({
              date: dateStr,
              orderId: cr.orderId,
              orderTitle: order.companyName || order.deliveryArea || '오더',
              totalAmount: total,
              deductions: orderDeduction,
            });
          }

          // 수수료 계산
          const effectiveRate = await storage.getEffectiveCommissionRate(helperId);
          const commissionRate = effectiveRate.rate;
          const commissionAmount = Math.round(totalAmount * commissionRate / 100);

          // 산재보험료 계산
          const insuranceDeduction = Math.round(totalAmount * (insuranceRate / 100) * 0.5);

          // 최종 지급액
          const payoutAmount = Math.max(0, totalAmount - commissionAmount - insuranceDeduction - totalDeductions);

          // 일별 집계
          const dailyGrouped: Record<string, any> = {};
          for (const item of dailyData) {
            if (!dailyGrouped[item.date]) {
              dailyGrouped[item.date] = { date: item.date, orderCount: 0, totalAmount: 0, deductions: 0 };
            }
            dailyGrouped[item.date].orderCount += 1;
            dailyGrouped[item.date].totalAmount += item.totalAmount;
            dailyGrouped[item.date].deductions += item.deductions;
          }
          const dailySummary = Object.values(dailyGrouped).map((d: any) => ({
            ...d,
            commission: Math.round(d.totalAmount * commissionRate / 100),
            insurance: Math.round(d.totalAmount * (insuranceRate / 100) * 0.5),
            payout: Math.max(0, d.totalAmount - Math.round(d.totalAmount * commissionRate / 100) - Math.round(d.totalAmount * (insuranceRate / 100) * 0.5) - d.deductions),
          }));

          // 기존 정산서 확인 (upsert)
          const existing = await storage.getMonthlySettlementStatementByHelperAndMonth(helperId, year, month);
          let statement;
          if (existing) {
            statement = await storage.updateMonthlySettlementStatement(existing.id, {
              totalAmount,
              commissionRate,
              commissionAmount,
              insuranceRate: String(insuranceRate),
              insuranceDeduction,
              otherDeductions: totalDeductions,
              payoutAmount,
              totalWorkDays: workDates.size,
              totalOrders: helperClosingReports.length,
              settlementDataJson: JSON.stringify(dailySummary),
              status: "sent",
              sentAt: new Date(),
              sentBy: adminUserId,
              viewedAt: null,
            });
          } else {
            statement = await storage.createMonthlySettlementStatement({
              helperId,
              year,
              month,
              totalAmount,
              commissionRate,
              commissionAmount,
              insuranceRate: String(insuranceRate),
              insuranceDeduction,
              otherDeductions: totalDeductions,
              payoutAmount,
              totalWorkDays: workDates.size,
              totalOrders: helperClosingReports.length,
              settlementDataJson: JSON.stringify(dailySummary),
              status: "sent",
              sentAt: new Date(),
              sentBy: adminUserId,
            });
          }

          // 인앱 알림
          await storage.createNotification({
            userId: helperId,
            type: "monthly_statement",
            title: "월 정산서 도착",
            message: `${year}년 ${month}월 정산서가 발송되었습니다. 확인해주세요.`,
            relatedId: statement.id,
            payload: JSON.stringify({ statementId: statement.id, year, month }),
          });

          // 푸시 알림
          const payoutText = payoutAmount.toLocaleString() + "원";
          sendPushToUser(helperId, {
            title: "월 정산서 도착",
            body: `${year}년 ${month}월 정산서가 발송되었습니다. 지급 예정: ${payoutText}`,
            url: "/settlement",
            tag: `monthly-statement-${year}-${month}`,
          });

          // SMS
          const helper = await storage.getUser(helperId);
          if (helper?.phoneNumber) {
            try {
              await smsService.sendCustomMessage(helper.phoneNumber,
                `[헬프미] ${year}년 ${month}월 정산서가 발송되었습니다. 지급 예정: ${payoutText}. 앱에서 확인하세요.`);
            } catch (smsErr) {
              console.error("[SMS Error] monthly statement:", smsErr);
            }
          }

          results.push({ helperId, success: true });
        } catch (helperErr: any) {
          console.error(`Monthly statement error for helper ${helperId}:`, helperErr);
          results.push({ helperId, success: false, error: helperErr.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({
        message: `정산서 전송 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
        results,
        successCount,
        failCount,
      });
    } catch (err: any) {
      console.error("Send monthly statement error:", err);
      res.status(500).json({ message: "정산서 전송에 실패했습니다" });
    }
  });

  // ==================== ADMIN SETTINGS ROUTES ====================
}

