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

export async function registerOrderRoutes(ctx: RouteContext): Promise<void> {
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
    settlementStatements, settlementRecords, settlementLineItems, refunds, refundPolicies, deductions,
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

  // 관리자용 택배사 목록 조회 API
  app.get("/api/admin/meta/couriers", adminAuth, async (req, res) => {
    try {
      const settings = await storage.getAllCourierSettings();
      const courierList = settings.filter(s => s.isActive);

      const couriers = courierList
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id)
        .map(s => ({
          id: s.id,
          code: s.id.toString(),
          name: s.courierName,
          label: s.courierName,
          category: s.category || 'parcel',
          basePricePerBox: s.basePricePerBox || 0,
          etcPricePerBox: s.etcPricePerBox || 0,
          minDeliveryFee: s.minDeliveryFee || 0,
          minTotal: s.minTotal || 0,
          commissionRate: s.commissionRate || 0,
          urgentCommissionRate: s.urgentCommissionRate || 0,
          urgentSurchargeRate: s.urgentSurchargeRate || 0,
          isDefault: s.isDefault || false,
          sortOrder: s.sortOrder || 0,
          active: true,
        }));

      res.json({ couriers });
    } catch (err: any) {
      console.error("Admin meta couriers error:", err);
      res.status(500).json({ message: "택배사 목록 조회에 실패했습니다" });
    }
  });

  // Create order (admin) - 본사 계약권으로 계약금 없이 바로 open 상태로 생성
  app.post("/api/admin/orders", adminAuth, requirePermission("orders.create"), async (req, res) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const {
        requesterId,
        companyName,
        carrierCode,
        courierCompany,
        courierCategory,
        deliveryArea,
        campAddress,
        averageQuantity,
        pricePerUnit,
        scheduledDate,
        scheduledDateEnd,
        vehicleType,
        contactPhone,
        requesterPhone,
        deliveryGuide,
        memo,
        isUrgent,
        regionMapUrl,
        enterpriseId,
        settlementDate,
      } = req.body;

      // 필수 필드 검증
      if (!companyName || !deliveryArea || !scheduledDate || !vehicleType) {
        return res.status(400).json({
          message: "필수 필드를 입력해주세요 (회사명, 배송지역, 입차일, 차종)"
        });
      }

      // 택배사 정책에서 단가 조회
      let basePricePerBox = pricePerUnit || 1200;
      let finalPricePerBox = basePricePerBox;
      let minTotalApplied = false;
      let snapshotCommissionRate = 0;
      let snapshotPlatformRate = 0;
      let snapshotTeamLeaderRate = 0;

      if (carrierCode) {
        const courierSetting = await storage.getCourierSettingByCode(carrierCode);
        if (courierSetting) {
          basePricePerBox = courierSetting.basePricePerBox || 1200;
          finalPricePerBox = basePricePerBox;
          snapshotCommissionRate = courierSetting.commissionRate || 0;

          // 최소보장금 적용 여부 계산
          const boxCount = parseInt(String(averageQuantity || "0").replace(/[^0-9]/g, "")) || 0;
          const minTotal = courierSetting.minTotal || 0;
          if (boxCount > 0 && minTotal > 0) {
            const estimatedTotal = boxCount * basePricePerBox;
            if (estimatedTotal < minTotal) {
              finalPricePerBox = Math.ceil(minTotal / boxCount);
              minTotalApplied = true;
            }
          }
        }
      }

      // 기타택배/냉탑전용: carrierCode 없으면 시스템 설정에서 수수료율 조회
      const effectiveCategory = courierCategory || "parcel";
      if (!carrierCode && (effectiveCategory === "other" || effectiveCategory === "cold")) {
        const systemSettings = await storage.getAllSystemSettings();
        const settingsMap: Record<string, string> = {};
        systemSettings.forEach((s: any) => {
          settingsMap[s.settingKey] = s.settingValue;
        });
        if (effectiveCategory === "other") {
          snapshotCommissionRate = parseInt(settingsMap["other_commission_rate"]) || 10;
        } else if (effectiveCategory === "cold") {
          snapshotCommissionRate = parseInt(settingsMap["cold_commission_rate"]) || 10;
        }
      }

      // 협력업체 수수료율 적용 (enterpriseId가 있으면 우선 적용)
      if (enterpriseId) {
        try {
          const enterprise = await storage.getEnterpriseAccount(enterpriseId);
          if (enterprise && enterprise.commissionRate != null) {
            snapshotCommissionRate = enterprise.commissionRate;
          }
        } catch (entErr) {
          console.error("Enterprise account lookup error:", entErr);
        }
      }

      // 12자리 오더번호 생성 (본사/협력업체 오더)
      const { generateOrderNumber } = await import("../../utils/order-number");
      let enterpriseContactPhone: string | null = null;
      if (enterpriseId) {
        try {
          const entAccount = await storage.getEnterpriseAccount(enterpriseId);
          enterpriseContactPhone = entAccount?.contactPhone || null;
        } catch (e) { /* ignore */ }
      }
      const orderNumber = await generateOrderNumber({
        isEnterprise: true,
        deliveryArea: deliveryArea || "",
        enterpriseContactPhone: enterpriseContactPhone || contactPhone || requesterPhone,
      });

      // 본사 계약권 오더 생성 - 계약금 없이 바로 open 상태
      const order = await storage.createOrder({
        requesterId: requesterId || null,
        companyName,
        carrierCode: carrierCode || null,
        courierCompany: courierCompany || null,
        courierCategory: courierCategory || "parcel",
        enterpriseId: enterpriseId || null,
        settlementDate: settlementDate || null,
        deliveryArea,
        campAddress: campAddress || null,
        averageQuantity: averageQuantity || "0",
        pricePerUnit: finalPricePerBox,
        scheduledDate,
        scheduledDateEnd: scheduledDateEnd || null,
        vehicleType,
        contactPhone: contactPhone || null,
        requesterPhone: requesterPhone || null,
        deliveryGuide: deliveryGuide || null,
        memo: memo || null,
        isUrgent: isUrgent || false,
        regionMapUrl: regionMapUrl || null,
        status: "open",
        approvalStatus: "approved",
        maxHelpers: 3,
        currentHelpers: 0,
        snapshotCommissionRate,
        snapshotPlatformRate,
        snapshotTeamLeaderRate,
        basePricePerBox,
        finalPricePerBox,
        orderNumber,
        minTotalApplied,
        isHqOrder: true,
      });

      // 관리자 액션 로깅
      await logAdminAction({
        req,
        action: "order.create_hq",
        targetType: "order",
        targetId: order.id,
        newValue: {
          companyName,
          deliveryArea,
          scheduledDate,
          isHqOrder: true,
          status: "open"
        },
      });

      res.status(201).json({
        success: true,
        order: order ? { ...order, helperName: null } : null,
        message: "본사 계약권 오더가 등록되었습니다.",
      });
    } catch (err: any) {
      console.error("Admin create order error:", err);
      res.status(500).json({ message: "오더 생성에 실패했습니다" });
    }
  });

  app.get("/api/admin/orders", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      // 페이지네이션 파라미터
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      // 필터 파라미터
      const statusFilter = req.query.status as string;
      const searchTerm = req.query.search as string;

      // 전체 오더 조회 (필터링 적용)
      let allOrders = await storage.getOrders();

      // 상태 필터
      if (statusFilter && statusFilter !== 'all') {
        allOrders = allOrders.filter(o => o.status === statusFilter);
      }

      // 검색 필터 (적용 전 user 정보 필요)
      const users = await storage.getAllUsers();
      const requesterBusinesses = await storage.getAllRequesterBusinesses();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const businessMap = new Map<string, any>(requesterBusinesses.map(b => [b.userId, b]));

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        allOrders = allOrders.filter(order => {
          const requester = order.requesterId ? userMap.get(order.requesterId) : null;
          const business = order.requesterId ? businessMap.get(order.requesterId) : null;
          return (
            String(order.id).includes(search) ||
            order.orderNumber?.toLowerCase().includes(search) ||
            order.companyName?.toLowerCase().includes(search) ||
            order.deliveryArea?.toLowerCase().includes(search) ||
            requester?.name?.toLowerCase().includes(search) ||
            business?.businessName?.toLowerCase().includes(search)
          );
        });
      }

      const totalCount = allOrders.length;
      const totalPages = Math.ceil(totalCount / limit);

      // 페이지네이션 적용
      const paginatedOrders = allOrders.slice(offset, offset + limit);

      // Enrich orders with requester info
      const enrichedOrders = paginatedOrders.map(order => {
        const requester = order.requesterId ? userMap.get(order.requesterId) : null;
        const business = order.requesterId ? businessMap.get(order.requesterId) : null;
        return {
          ...order,
          requesterName: requester?.name || business?.businessName || "-",
          requesterPhone: order.requesterPhone || requester?.phoneNumber || "-",
          requesterEmail: requester?.email || "",
          boxCount: parseInt(String(order.averageQuantity || "0").replace(/[^0-9]/g, "")) || 0,
          unitPrice: order.pricePerUnit || 0,
          regionMapUrl: order.regionMapUrl || "",
        };
      });

      res.json({
        data: enrichedOrders,
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

  // Get single order (admin) - E: 가상계좌 정보 포함, 헬퍼/요청자 정보 포함
  app.get("/api/admin/orders/:orderId", adminAuth, requirePermission("orders.view"), async (req, res) => {
    // 캐시 비활성화 (계약금 등 동적 데이터 포함)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    try {
      const orderId = Number(req.params.orderId);
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // 헬퍼 정보 조회
      let helperName: any = null;
      let helperPhone: any = null;
      let helperTeamName: any = null;
      let helperProfileImage: any = null;
      if (order.matchedHelperId) {
        const helper = await storage.getUser(order.matchedHelperId);
        if (helper) {
          helperName = helper.name || helper.username;
          helperPhone = helper.phoneNumber;
          helperTeamName = helper.teamName || null;
          helperProfileImage = helper.profileImageUrl || null;
        }
      }

      // 요청자 정보 조회
      let requesterName: any = null;
      let requesterPhone: any = null;
      let requesterEmail: any = null;
      if (order.requesterId) {
        const requester = await storage.getUser(order.requesterId);
        if (requester) {
          requesterName = requester.name || requester.username;
          requesterPhone = requester.phoneNumber;
          requesterEmail = requester.email;
        }
      }

      // E: 가상계좌 정보 조회 및 포함
      let virtualAccount: any = null;
      try {
        virtualAccount = await storage.getVirtualAccountByOrder(orderId);
      } catch (e) {
        console.error("Failed to get virtual account for order:", e);
      }

      // 잔금 결제 예정일 (order 테이블에서 직접 가져옴)
      const balancePaymentDueDate = (order as any).balancePaymentDueDate || null;

      // 계약금 조회 (공통 함수 사용 - SSOT)
      const depositInfo = await getOrderDepositInfo(orderId);
      const { depositAmount, paymentStatus: depositPaymentStatus } = depositInfo;

      res.json({
        ...order,
        helperName,
        helperPhone,
        helperTeamName,
        helperProfileImage,
        requesterName,
        requesterPhone,
        requesterEmail,
        balancePaymentDueDate,
        depositAmount,
        depositPaymentStatus,
        virtualAccount: virtualAccount ? {
          id: virtualAccount.id,
          bankCode: virtualAccount.bankCode,
          bankName: getBankName(virtualAccount.bankCode || ""),
          accountNumber: virtualAccount.accountNumber,
          accountHolder: virtualAccount.accountHolder,
          amount: virtualAccount.amount,
          status: virtualAccount.status,
          paymentId: virtualAccount.paymentId,
          paidAt: virtualAccount.paidAt,
          paidAmount: virtualAccount.paidAmount,
          dueDate: virtualAccount.dueDate,
          createdAt: virtualAccount.createdAt,
          webhookReceivedAt: virtualAccount.webhookReceivedAt,
        } : null,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update order (admin) - whitelist allowed fields to prevent mass-assignment
  app.patch("/api/admin/orders/:orderId", adminAuth, requirePermission("orders.edit"), async (req, res) => {
    try {
      const allowedFields = [
        "status",
        "title", "description", "pickupAddress", "deliveryAddress",
        "pickupDate", "deliveryDate", "pickupTime", "deliveryTime",
        "vehicleType", "cargoType", "cargoWeight", "cargoDescription",
        "specialInstructions", "memo", "adminMemo", "internalNote",
        "settlementDate", "requiresColdChain", "requiredTemp",
        "contactName", "contactPhone", "receiverName", "receiverPhone",
        "itemCount", "itemUnit", "routeDistance",
      ];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) {
          sanitized[key] = req.body[key];
        }
      }
      const updated = await storage.updateOrder(Number(req.params.orderId), sanitized);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get order applications (admin)
  app.get("/api/admin/orders/:orderId/applications", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const applications = await storage.getOrderApplications(orderId);

      // 헬퍼 정보 포함
      const applicationsWithHelperInfo = await Promise.all(
        applications.map(async (app) => {
          const helper = await storage.getUser(app.helperId);
          const avgRating = await storage.getHelperAverageRating(app.helperId);

          return {
            ...app,
            helperName: helper?.name || "Unknown",
            helperNickname: (helper as any)?.nickname || null,
            helperPhone: helper?.phoneNumber,
            averageRating: avgRating,
            profileImage: (helper as any)?.profileImageUrl || null,
          };
        })
      );

      res.json(applicationsWithHelperInfo);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get service agreements for an order's requester (admin)
  app.get("/api/admin/orders/:orderId/agreements", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || !order.requesterId) {
        return res.status(404).json({ message: "Order not found" });
      }
      const agreements = await storage.getAllRequesterServiceAgreements();
      const requesterAgreements = agreements.filter(a => a.userId === order.requesterId);
      res.json(requesterAgreements);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // Get order contracts (admin) - 오더별 계약 정보 조회
  app.get("/api/admin/orders/:orderId/contracts", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const orderContracts = await storage.getOrderContracts(orderId);
      const users = await storage.getAllUsers();
      const userMap = new Map<string, any>(users.map(u => [u.id, u]));

      const contractsWithDetails = orderContracts.map(c => {
        const helper = c.helperId ? userMap.get(c.helperId) : null;
        const requester = order.requesterId ? userMap.get(order.requesterId) : null;
        return {
          ...c,
          helperName: helper?.name || '알수없음',
          helperPhone: helper?.phoneNumber,
          requesterName: requester?.name || '알수없음',
          requesterPhone: requester?.phoneNumber,
        };
      });

      res.json(contractsWithDetails);
    } catch (err: any) {
      console.error("Error fetching order contracts:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // 계약서 출력 핸들러 (공통)
  async function handleContractPdf(req: any, res: any) {
    try {
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).send("<h1>오더를 찾을 수 없습니다</h1>");
      }

      // 의뢰인 정보
      const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
      const requesterName = requester?.name || "미확인";
      const requesterPhone = requester?.phoneNumber || order.requesterPhone || "-";

      // 계약금 계산 (계약이 존재하면 계약의 고정 금액 사용, 아니면 현재 설정값 사용)
      let depositAmount = 0;
      let depRate = 0;

      const contract = await storage.getOrderContract(orderId);

      const pricePerUnit = Number(order.pricePerUnit) || 0;
      const quantity = parseInt(String(order.averageQuantity || "0").replace(/[^0-9]/g, "")) || 0;
      const supplyAmount = pricePerUnit * quantity;
      const totalWithVat = Math.round(supplyAmount * 1.1);

      if (contract) {
        // 이미 생성된 계약이 있으면 해당 금액 유지 (불변성)
        depositAmount = contract.depositAmount || 0;
        // 역산하여 표시용 비율 계산 (소수점 1자리)
        depRate = totalWithVat > 0 ? Number(((depositAmount / totalWithVat) * 100).toFixed(1)) : 0;
      } else {
        // 계약 전이면 현재 시스템 설정값 사용
        depRate = await getDepositRate();
        depositAmount = Math.round(totalWithVat * (depRate / 100));
      }

      // 잔금 입금 예정일
      const balancePaymentDueDate = (order as any).balancePaymentDueDate || "-";

      // 한국시간(KST) 포맷 헬퍼
      const formatKST = (date: Date): string => {
        const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
      };
      const formatKSTFull = (date: Date): string => {
        const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${kst.getUTCHours()}시 ${kst.getUTCMinutes()}분`;
      };

      // 계약일 (오더 생성일) — 한국시간(KST) 기준
      const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
      const contractDate = formatKST(createdAt);

      // 서명 정보 (의뢰인 서비스 동의서에서 가져옴)
      let signatureName = requesterName;
      let signedAt = contractDate;
      let phoneVerified = false;
      let verifiedPhone = requesterPhone;
      try {
        const agreements = await storage.getAllRequesterServiceAgreements();
        const agreement = agreements.find(a => a.userId === order.requesterId);
        if (agreement) {
          phoneVerified = !!(agreement as any).phoneVerified;
          if ((agreement as any).phoneNumber) verifiedPhone = (agreement as any).phoneNumber;
          if (agreement.agreedAt) {
            const d = new Date(agreement.agreedAt);
            signedAt = formatKSTFull(d);
          }
        }
      } catch (e) {
        console.error("Failed to get service agreement:", e);
      }

      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>운송주선 계약서 - ORD-${orderId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 13px; line-height: 1.8; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
    @media print { body { padding: 20px; font-size: 12px; } .no-print { display: none !important; } @page { size: A4; margin: 15mm 20mm; } .signature-area { page-break-inside: avoid; } .consent-box { page-break-inside: avoid; } }
    .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 100; }
    .print-btn:hover { background: #1d4ed8; }
    h1 { text-align: center; font-size: 22px; margin-bottom: 8px; border-bottom: 3px double #333; padding-bottom: 12px; }
    .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 30px; }
    .intro { margin-bottom: 24px; text-indent: 1em; }
    .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 8px; padding: 4px 0; border-bottom: 1px solid #ddd; }
    .section-content { margin-bottom: 16px; padding-left: 1em; }
    .section-content p { margin-bottom: 4px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .info-table th, .info-table td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    .info-table th { background: #f5f5f5; width: 140px; font-weight: 600; }
    .consent-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 12px 0; }
    .consent-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .consent-check { color: #10b981; font-weight: bold; }
    .signature-area { margin-top: 30px; border: 1px solid #ddd; border-radius: 6px; padding: 20px; }
    .signature-row { display: flex; justify-content: space-between; margin-top: 16px; }
    .signature-box { text-align: center; width: 45%; }
    .signature-line { border-bottom: 1px solid #333; margin-top: 40px; padding-bottom: 4px; }
    .footer-info { margin-top: 30px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
    .highlight { color: #dc2626; font-weight: 600; }
    .amount { font-size: 16px; font-weight: bold; color: #2563eb; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">인쇄하기</button>

  <h1>운송주선 계약서</h1>
  <p class="subtitle">오더번호: ORD-${orderId} | 계약일: ${contractDate}</p>

  <p class="intro">
    본 계약은 「화물자동차 운수사업법」 및 관련 법령에 따라 아래 당사자 간에 운송주선에 관한 사항을 정하기 위하여 체결합니다.
    본 플랫폼은 운송 주선 중개 서비스를 제공하며, "갑"과 운송인(헬퍼) 간의 운송 계약은 개인 간 거래로서 플랫폼은 거래의 당사자가 아님을 확인합니다.
  </p>

  <div class="section-title">제1조 (계약 당사자)</div>
  <table class="info-table">
    <tr><th>갑 (의뢰인)</th><td>${requesterName}</td></tr>
    <tr><th>연락처</th><td>${requesterPhone}</td></tr>
    <tr><th>을 (플랫폼)</th><td>헬프미 운송주선 플랫폼</td></tr>
  </table>

  <div class="section-title">제2조 (계약 목적)</div>
  <div class="section-content">
    <p>"을"은 "갑"의 요청에 따라 적합한 운송인(헬퍼)을 주선하며, "갑"은 이에 대한 운송 비용을 지급합니다.</p>
  </div>

  <div class="section-title">제3조 (운송 내용)</div>
  <table class="info-table">
    <tr><th>운송사/업체</th><td>${order.companyName || "-"}</td></tr>
    <tr><th>평균 수량</th><td>${order.averageQuantity || "-"}</td></tr>
    <tr><th>단가</th><td>${pricePerUnit.toLocaleString()}원</td></tr>
    <tr><th>배송지역</th><td>${order.deliveryArea || "-"}</td></tr>
    <tr><th>캠프/터미널</th><td>${order.campAddress || "-"}</td></tr>
    <tr><th>차량 타입</th><td>${order.vehicleType || "-"}</td></tr>
    <tr><th>운송 시작일</th><td>${order.scheduledDate || "-"}</td></tr>
    <tr><th>운송 종료일</th><td>${(order as any).scheduledDateEnd || "-"}</td></tr>
    <tr><th>긴급 오더</th><td>${order.isUrgent ? "예" : "아니오"}</td></tr>
    <tr><th>배송가이드</th><td>${order.deliveryGuide || "등록된 배송가이드가 없습니다."}</td></tr>
  </table>

  <div class="section-title">제4조 (운임 산정 및 정산)</div>
  <div class="section-content">
    <p>1. 운임은 등록된 단가 기준으로 산정하며, 최종 운임은 마감 자료(실제 배송 수량)에 따라 확정됩니다.</p>
    <p>2. "갑"은 오더 등록 시 예상 운임의 <span class="highlight">${depRate}%</span>를 계약금으로 선납합니다.</p>
    <p>3. 잔여금(최종 운임 - 계약금)은 마감 자료 확정 후 청구되며, 청구일로부터 7일 이내에 지급하여야 합니다.</p>
  </div>
  <table class="info-table">
    <tr><th>예상 공급가</th><td>${supplyAmount.toLocaleString()}원</td></tr>
    <tr><th>부가세 포함</th><td>${totalWithVat.toLocaleString()}원</td></tr>
    <tr><th>계약금 (${depRate}%)</th><td class="amount">${depositAmount.toLocaleString()}원</td></tr>
  </table>

  <div class="section-title">제5조 (신용거래 조건)</div>
  <div class="section-content">
    <p>1. 잔여금 정산은 신용거래이며, 미지급 시 아래 단계별 조치가 적용됩니다.</p>
    <p>2. 지급기한 초과 시: <span class="highlight">연 12%</span> 지연이자 발생</p>
    <p>3. 14일 경과 시: 서비스 이용 제한 (오더 등록 제한)</p>
    <p>4. 30일 경과 시: 법적 조치 (소송비용·변호사 비용 "갑" 부담)</p>
  </div>

  <div class="section-title">제6조~제11조 (의무, 해지, 손해배상, 개인정보, 면책)</div>
  <div class="section-content">
    <p>상세 내용은 플랫폼 이용약관 및 개인정보처리방침을 따릅니다.</p>
  </div>

  <div class="section-title">제12조 (잔금 입금 예정일)</div>
  <div class="section-content">
    <p>1. "갑"은 운송 완료 후 마감 자료 확정에 따른 잔여금을 아래 지정한 입금 예정일까지 지급하여야 합니다.</p>
    <p>2. 입금 예정일을 초과할 경우, 제5조의 신용거래 조항이 즉시 적용됩니다.</p>
  </div>
  <table class="info-table">
    <tr><th>잔금 입금 예정일</th><td class="highlight" style="font-size:15px;">${balancePaymentDueDate}</td></tr>
  </table>

  <div class="section-title">제13조 (특약사항 및 동의)</div>
  <div class="consent-box">
    <div class="consent-item">
      <span class="consent-check">&#10003;</span>
      <span>제1호: 잔여금은 마감 자료(실제 배송 수량) 기준으로 확정되며, 청구일로부터 7일 이내 지급할 것에 동의합니다.</span>
    </div>
    <div class="consent-item">
      <span class="consent-check">&#10003;</span>
      <span>제2호: 잔여금 정산은 신용거래이며, 미지급 시 연 12% 지연이자, 서비스 이용 제한 및 법적 조치(소송비용·변호사 비용 부담 포함)가 발생할 수 있음에 동의합니다.</span>
    </div>
    <div class="consent-item">
      <span class="consent-check">&#10003;</span>
      <span>제3호: 본 거래는 개인 간 거래로서 플랫폼은 통신판매중개자의 지위에 있음을 이해하며, 매칭 완료 후(운송인 연락처 전달 후) 취소 시 계약금이 환불되지 않음에 동의합니다.</span>
    </div>
    <div class="consent-item">
      <span class="consent-check">&#10003;</span>
      <span>제4호: 상기 지정한 잔금 입금 예정일(${balancePaymentDueDate})까지 잔여금을 지급할 것을 확약하며, 미이행 시 제5조의 신용거래 조항이 적용됨에 동의합니다.</span>
    </div>
  </div>

  <div class="section-title">제14조 (분쟁 해결)</div>
  <div class="section-content">
    <p>1. 본 계약과 관련한 분쟁은 당사자 간 협의하여 해결하며, 협의가 이루어지지 않을 경우 "을"의 본점 소재지를 관할하는 법원을 전속관할 법원으로 합니다.</p>
    <p>2. "갑"과 운송인(헬퍼) 간의 분쟁에 대하여 "을"은 중재를 지원할 수 있으나, 법적 분쟁의 당사자가 되지 않습니다.</p>
  </div>

  <div class="signature-area">
    <div class="section-title" style="border:none; margin-top:0;">서명 및 인증 정보</div>
    <table class="info-table">
      <tr><th>서명자</th><td>${signatureName} (서명 완료)</td></tr>
      <tr><th>본인인증</th><td>${phoneVerified ? "인증 완료" : "미인증"} (${verifiedPhone})</td></tr>
      <tr><th>계약 체결일</th><td>${signedAt} (KST)</td></tr>
    </table>
    <div class="signature-row">
      <div class="signature-box">
        <p><strong>갑 (의뢰인)</strong></p>
        <div class="signature-line">${requesterName} (서명)</div>
      </div>
      <div class="signature-box">
        <p><strong>을 (플랫폼)</strong></p>
        <div class="signature-line">헬프미 운송주선 플랫폼</div>
      </div>
    </div>
  </div>

  <div class="footer-info">
    <p>본 계약서는 전자적으로 체결되었으며, 「전자문서 및 전자거래 기본법」에 따라 법적 효력을 가집니다.</p>
    <p>문서번호: CONTRACT-${orderId}-${createdAt.getTime()} | 출력일: ${formatKST(new Date())} | 헬프미 운송주선 플랫폼</p>
    <p style="margin-top: 4px; font-size: 10px; color: #aaa;">본 문서는 시스템에서 자동 생성된 전자계약서 원본입니다. 위변조 여부 확인: 관리자 시스템에서 오더번호 ORD-${orderId}로 원본 대조 가능합니다.</p>
  </div>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      console.error("Error generating contract:", err);
      res.status(500).send("<h1>계약서 생성 중 오류가 발생했습니다</h1>");
    }
  }

  // 계약서 출력 (클라이언트용 - requireAuth)
  app.get("/api/orders/:id/contract/pdf", requireAuth, handleContractPdf);

  // 계약서 출력 (관리자용 - adminAuth)
  app.get("/api/admin/orders/:id/contract/pdf", adminAuth, handleContractPdf);

  // Get all contracts (admin)
  app.get("/api/admin/contracts", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const contracts = await storage.getAllContracts();
      const users = await storage.getAllUsers();
      const orders = await storage.getOrders();
      const courierSettingsData = await db.select().from(courierSettings).execute();
      const allSettlements = await storage.getAllSettlementStatements();

      const userMap = new Map<string, any>(users.map(u => [u.id, u]));
      const orderMap = new Map<number, any>(orders.map(o => [o.id, o]));
      const settlementMap = new Map<string, typeof allSettlements[0]>();
      allSettlements.forEach(s => {
        if (s.orderId && s.helperId) {
          settlementMap.set(`${s.orderId}-${s.helperId}`, s);
        }
      });

      const enrichedContracts = contracts.map(c => {
        const helper = c.helperId ? userMap.get(c.helperId) : null;
        const requester = c.requesterId ? userMap.get(c.requesterId) : null;
        const order = c.orderId ? orderMap.get(c.orderId) : null;
        const settlement = (c.orderId && c.helperId) ? settlementMap.get(`${c.orderId}-${c.helperId}`) : null;

        return {
          ...c,
          // 기본 정보
          helperName: helper?.name || null,
          trackingNumber: (c as any).trackingNumber || null,
          evidencePhotoUrls: (c as any).evidencePhotoUrls || [],
          helperPhone: helper?.phoneNumber || null,
          helperEmail: helper?.email || null,
          requesterName: requester?.name || null,
          requesterPhone: requester?.phoneNumber || null,
          orderTitle: order?.companyName || null,
          courier: order?.companyName || null,
          // 정산 데이터
          deliveryCount: settlement?.deliveryCount || 0,
          returnCount: settlement?.returnCount || 0,
          otherCount: settlement?.otherCount || 0,
          settlementAmount: settlement?.totalAmount || 0,
          settlementStatus: settlement?.status || null,
        };
      });

      res.json(enrichedContracts);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single contract with details (admin)
  app.get("/api/admin/contracts/:id", adminAuth, requirePermission("contracts.view"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const contract = await storage.getContract(id);

      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      const helper = contract.helperId ? await storage.getUser(contract.helperId) : null;
      const requester = contract.requesterId ? await storage.getUser(contract.requesterId) : null;
      const order = contract.orderId ? await storage.getOrder(contract.orderId) : null;
      const requesterBusiness = contract.requesterId ? await storage.getRequesterBusiness(contract.requesterId) : null;

      // Get settlement data if order completed
      const allSettlements = await storage.getAllSettlementStatements();
      const settlement = allSettlements.find(s => s.orderId === contract.orderId && s.helperId === contract.helperId);

      res.json({
        ...contract,
        // 헬퍼 정보
        helperName: helper?.name || null,
        trackingNumber: (contract as any).trackingNumber || null,
        evidencePhotoUrls: (contract as any).evidencePhotoUrls || [],
        helperPhone: helper?.phoneNumber || null,
        helperEmail: helper?.email || null,
        // 의뢰인 정보
        requesterName: requester?.name || null,
        requesterPhone: requester?.phoneNumber || null,
        requesterEmail: requester?.email || null,
        // 사업자 정보
        businessName: requesterBusiness?.businessName || null,
        // 오더 정보
        orderTitle: order?.companyName || null,
        courier: order?.companyName || null,
        deliveryArea: order?.deliveryArea || null,
        pricePerUnit: order?.pricePerUnit || 0,
        // 정산 데이터 (업무마감 후)
        deliveryCount: settlement?.deliveryCount || 0,
        returnCount: settlement?.returnCount || 0,
        pickupCount: settlement?.pickupCount || 0,
        otherCount: settlement?.otherCount || 0,
        // 금액 정보
        basePay: settlement?.basePay || 0,
        commissionAmount: settlement?.commissionAmount || 0,
        supplyAmount: settlement?.supplyAmount || 0,
        vatAmount: settlement?.vatAmount || 0,
        totalAmount: settlement?.totalAmount || contract.totalAmount || 0,
        netAmount: settlement?.netAmount || 0,
        settlementStatus: settlement?.status || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update contract status (admin)
  app.patch("/api/admin/contracts/:id/status", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, notes } = req.body;

      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      const updated = await storage.updateContract(id, { status });

      // 상태 변경 이벤트 기록
      await storage.createContractExecutionEvent({
        contractId: id,
        contractType: "service_contract",
        triggerType: "status_change",
        metadata: JSON.stringify({ previousStatus: contract.status, newStatus: status, notes }),
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Record deposit payment (admin)
  app.patch("/api/admin/contracts/:id/deposit-paid", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { transactionRef, notes } = req.body;

      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      // 중복 입금 확인 방지
      if (contract.depositPaid) {
        return res.status(409).json({ message: "이미 계약금이 입금 확인되었습니다" });
      }

      const updated = await storage.updateContract(id, {
        depositPaid: true,
        depositPaidAt: new Date(),
        downPaymentStatus: "paid",
        status: "deposit_paid",
      });

      // 오더 상태 업데이트: awaiting_deposit → scheduled (계약금 결제 완료)
      const order = await storage.getOrder(contract.orderId);
      if (order && order.status === "awaiting_deposit") {
        await storage.updateOrder(contract.orderId, { status: "scheduled" });
      }

      // Payment 기록 생성
      await storage.createPayment({
        contractId: id,
        orderId: contract.orderId,
        payerId: contract.requesterId || "system",
        provider: "manual",
        amount: contract.depositAmount || 0,
        paymentType: "deposit",
        status: "captured",
      });

      // 이벤트 기록
      await storage.createContractExecutionEvent({
        contractId: id,
        contractType: "service_contract",
        triggerType: "deposit_paid",
        metadata: JSON.stringify({ transactionRef, notes }),
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update deposit amount (admin) - 계약금 금액 수정
  app.patch("/api/admin/orders/:orderId/deposit-amount", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const { depositAmount } = req.body;

      if (depositAmount == null || isNaN(Number(depositAmount)) || Number(depositAmount) < 0) {
        return res.status(400).json({ message: "올바른 계약금 금액을 입력해주세요" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 기존 계약이 있으면 업데이트, 없으면 생성
      const existingContracts = await storage.getOrderContracts(orderId);
      if (existingContracts.length > 0) {
        const contract = existingContracts[0];
        const updated = await storage.updateContract(contract.id, {
          depositAmount: Number(depositAmount),
          downPaymentAmount: Number(depositAmount),
        });

        // 잔금 재계산
        const totalAmount = Number(updated.totalAmount) || 0;
        const newBalance = Math.max(0, totalAmount - Number(depositAmount));
        await storage.updateContract(contract.id, {
          calculatedBalanceAmount: newBalance,
          remainingAmount: newBalance,
        });

        res.json({ message: "계약금이 수정되었습니다", depositAmount: Number(depositAmount) });
      } else {
        // 계약이 없으면 오더에 직접 저장 (향후 계약 생성 시 반영)
        await storage.updateOrder(orderId, {
          depositAmount: Number(depositAmount),
        } as any);
        res.json({ message: "계약금이 수정되었습니다", depositAmount: Number(depositAmount) });
      }
    } catch (err: any) {
      console.error("[Admin] Update deposit amount error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Record balance payment (admin)
  app.patch("/api/admin/contracts/:id/balance-paid", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { transactionRef, notes } = req.body;

      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      // 중복 잔금 확인 방지
      if (contract.balancePaid) {
        return res.status(409).json({ message: "이미 잔금이 입금 확인되었습니다" });
      }

      const updated = await storage.updateContract(id, {
        balancePaid: true,
        balancePaidAt: new Date(),
      });

      // Payment 기록 생성
      await storage.createPayment({
        contractId: id,
        orderId: contract.orderId,
        payerId: contract.requesterId || "system",
        provider: "manual",
        amount: contract.balanceAmount || 0,
        paymentType: "balance",
        status: "captured",
      });

      // 이벤트 기록
      await storage.createContractExecutionEvent({
        contractId: id,
        contractType: "service_contract",
        triggerType: "balance_paid",
        metadata: JSON.stringify({ transactionRef, notes }),
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /admin/orders/{orderId}/balance/manual-paid - 수동 입금 확인 (idempotent)
  app.post("/api/admin/orders/:orderId/balance/manual-paid", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const adminUser = (req as any).adminUser;
      const { paidAmount, memo } = req.body;

      // Idempotency check
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, isConflict, cachedResponse } = await checkIdempotency(
          adminUser?.id || "admin",
          `POST:/api/admin/orders/${orderId}/balance/manual-paid`,
          idempotencyKey,
          req.body
        );
        if (isConflict) {
          return res.status(409).json({
            error: { code: "IDEMPOTENCY_CONFLICT", message: "동일 Idempotency-Key에 다른 요청이 감지되었습니다." }
          });
        }
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached manual-paid for order ${orderId}, key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" } });
      }

      // Get contract
      const contracts = await storage.getOrderContracts(orderId);
      const contract = contracts[0];

      if (!contract) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "계약을 찾을 수 없습니다" } });
      }

      // Update contract balance status
      await storage.updateContract(contract.id, {
        balancePaid: true,
        balancePaidAt: new Date(),
        balancePaymentStatus: "PAID",
      });

      // Update order status
      await storage.updateOrder(orderId, { status: "balance_paid" });

      // Payment 기록 생성
      await storage.createPayment({
        contractId: contract.id,
        orderId,
        payerId: order.requesterId || "system",
        provider: "manual",
        amount: paidAmount || contract.balanceAmount || 0,
        paymentType: "balance",
        status: "captured",
      });

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "BALANCE_MANUAL_PAID",
        orderId,
        targetType: "order",
        targetId: String(orderId),
        reason: memo || "수동 입금 확인",
        newValue: JSON.stringify({ paidAmount, memo, balanceStatus: "PAID" }),
      });

      // Notify requester
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "announcement",
          title: "입금 확인 완료",
          message: `오더 ${order.orderNumber || orderId}의 입금이 확인되었습니다.`,
          relatedId: orderId,
        });
      }

      const response = {
        ok: true,
        orderId: order.orderNumber || `O-${orderId}`,
        balanceStatus: "PAID",
        message: "입금 확인이 완료되었습니다",
      };

      // Store idempotency response
      if (idempotencyKey) {
        await storeIdempotencyResponse(adminUser?.id || "admin", `POST:/api/admin/orders/${orderId}/balance/manual-paid`, idempotencyKey, 200, response, req.body);
      }

      res.json(response);
    } catch (err: any) {
      console.error("Manual paid error:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } });
    }
  });

  // Cancel contract (admin)
  app.patch("/api/admin/contracts/:id/cancel", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;

      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      const updated = await storage.updateContract(id, {
        status: "cancelled",
      });

      // 오더 상태 및 matchedHelperId 초기화 (헬퍼 재배정 가능하도록)
      if (contract.orderId) {
        const order = await storage.getOrder(contract.orderId);
        if (order && order.matchedHelperId === contract.helperId) {
          await storage.updateOrder(contract.orderId, {
            matchedHelperId: null,
            status: "open",
            currentHelpers: Math.max(0, (order.currentHelpers || 1) - 1),
          });
        }
      }

      // 감사 로그 기록
      await logAdminAction({
        req,
        action: "contract.cancel",
        targetType: "contract",
        targetId: id,
        oldValue: { status: contract.status },
        newValue: { status: "cancelled", reason },
      });

      // 이벤트 기록
      await storage.createContractExecutionEvent({
        contractId: id,
        contractType: "service_contract",
        triggerType: "cancelled",
        metadata: JSON.stringify({ reason }),
      });

      // 알림
      if (contract.helperId) {
        await storage.createNotification({
          userId: contract.helperId || contract.requesterId,
          type: "announcement",
          title: "계약 취소",
          message: `계약이 취소되었습니다. 사유: ${reason || "관리자에 의한 취소"}`,
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 결제 상태 롤백 (수동) - 잘못된 결제 상태 수정용
  app.patch("/api/admin/contracts/:id/rollback-payment", adminAuth, requirePermission("contracts.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { depositPaid, balancePaid, reason } = req.body;

      if (typeof depositPaid !== "boolean" && typeof balancePaid !== "boolean") {
        return res.status(400).json({ message: "depositPaid 또는 balancePaid 값을 지정해주세요" });
      }

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "롤백 사유를 5자 이상 입력해주세요" });
      }

      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      const updates: any = {};
      if (typeof depositPaid === "boolean") {
        updates.depositPaid = depositPaid;
        if (!depositPaid) updates.depositPaidAt = null;
      }
      if (typeof balancePaid === "boolean") {
        updates.balancePaid = balancePaid;
        if (!balancePaid) updates.balancePaidAt = null;
      }

      const updated = await storage.updateContract(id, updates);

      // 감사 로그 기록 (필수 - 금전 관련)
      await logAdminAction({
        req,
        action: "contract.payment_rollback",
        targetType: "contract",
        targetId: id,
        oldValue: {
          depositPaid: contract.depositPaid,
          balancePaid: contract.balancePaid,
          depositPaidAt: contract.depositPaidAt,
          balancePaidAt: contract.balancePaidAt
        },
        newValue: {
          depositPaid: updates.depositPaid ?? contract.depositPaid,
          balancePaid: updates.balancePaid ?? contract.balancePaid,
          reason
        },
      });

      // 이벤트 기록
      await storage.createContractExecutionEvent({
        contractId: id,
        contractType: "service_contract",
        triggerType: "payment_rollback",
        metadata: JSON.stringify({ reason, ...updates }),
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Contract payment rollback error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 정산 재생성 - 결제 성공 후 정산 생성 실패 시 수동 재시도
  app.post("/api/admin/orders/:orderId/regenerate-settlement", adminAuth, requirePermission("settlements.create"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const { reason } = req.body;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "재생성 사유를 5자 이상 입력해주세요" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 기존 정산 확인
      const existingSettlements = await storage.getSettlementsByOrderId(orderId);
      if (existingSettlements.length > 0) {
        return res.status(400).json({
          message: "이미 정산이 존재합니다. 기존 정산을 취소한 후 재생성해주세요.",
          existingSettlements: existingSettlements.map(s => ({ id: s.id, status: s.status }))
        });
      }

      // 계약 정보 조회
      const contracts = await storage.getOrderContracts(orderId);
      if (contracts.length === 0) {
        return res.status(400).json({ message: "계약 정보가 없습니다" });
      }

      const contract = contracts[0];
      if (!contract.helperId) {
        return res.status(400).json({ message: "헬퍼 정보가 없습니다" });
      }

      // 헬퍼 정보 조회
      const helper = await storage.getUser(contract.helperId);
      if (!helper) {
        return res.status(400).json({ message: "헬퍼를 찾을 수 없습니다" });
      }

      // 수수료율 계산 (매칭 스냅샷 > 헬퍼별 실효 수수료율)
      const [contractApp] = await db.select().from(orderApplications)
        .where(and(
          eq(orderApplications.orderId, orderId),
          eq(orderApplications.helperId, contract.helperId)
        ))
        .limit(1);
      let totalCommissionRate: number;
      let platformRate: number;
      let teamLeaderRate: number;
      if (contractApp?.snapshotCommissionRate != null) {
        totalCommissionRate = contractApp.snapshotCommissionRate;
        platformRate = contractApp.snapshotPlatformRate ?? totalCommissionRate;
        teamLeaderRate = contractApp.snapshotTeamLeaderRate ?? 0;
      } else {
        const effectiveRateContract = await storage.getEffectiveCommissionRate(contract.helperId);
        totalCommissionRate = effectiveRateContract.rate;
        platformRate = effectiveRateContract.platformRate;
        teamLeaderRate = effectiveRateContract.teamLeaderRate;
      }

      // 정산 금액 계산
      const totalAmount = contract.totalAmount || 0;
      const supplyAmount = Math.round(totalAmount / 1.1);
      const vatAmount = totalAmount - supplyAmount;
      const totalCommissionAmount = Math.round(totalAmount * totalCommissionRate / 100);
      const platformCommission = Math.round(totalAmount * platformRate / 100);
      const teamLeaderIncentive = Math.round(totalAmount * teamLeaderRate / 100);
      const netPayout = totalAmount - totalCommissionAmount;

      // 정산 생성
      const settlement = await storage.createSettlementStatement({
        orderId,
        workDate: order.scheduledDate,
        status: "pending",
        supplyAmount,
        vatAmount,
        totalAmount,
        commissionRate: totalCommissionRate,
        commissionAmount: totalCommissionAmount,
        platformCommission,
        teamLeaderIncentive,
        netAmount: netPayout,
        teamLeaderId: helper.teamLeaderId || undefined,
      });

      // 감사 로그 기록
      await logAdminAction({
        req,
        action: "settlement.regenerate",
        targetType: "settlement",
        targetId: settlement.id,
        oldValue: null,
        newValue: {
          orderId,
          totalAmount,
          netPayout,
          reason
        },
      });

      console.log(`[Settlement Regenerated] Order ${orderId}, Settlement ${settlement.id}, Admin action with reason: ${reason}`);

      res.status(201).json({
        success: true,
        message: "정산이 재생성되었습니다",
        settlement,
      });
    } catch (err: any) {
      console.error("Settlement regeneration error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 정산 취소/롤백 (분쟁 해결 또는 오류 수정용)
  app.patch("/api/admin/settlements/:id/cancel", adminAuth, requirePermission("settlements.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "취소 사유를 5자 이상 입력해주세요" });
      }

      const settlement = await storage.getSettlementStatement(id);
      if (!settlement) {
        return res.status(404).json({ message: "정산 내역을 찾을 수 없습니다" });
      }

      if (settlement.status === "paid") {
        return res.status(400).json({ message: "이미 지급 완료된 정산은 취소할 수 없습니다. 환수 처리를 이용해주세요." });
      }

      const updated = await storage.updateSettlementStatement(id, {
        status: "cancelled",
        holdReason: reason,
      });

      // 감사 로그 기록
      await logAdminAction({
        req,
        action: "settlement.cancel",
        targetType: "settlement",
        targetId: id,
        oldValue: { status: settlement.status, netAmount: settlement.netAmount },
        newValue: { status: "cancelled", reason },
      });

      // 기사에게 알림
      if (settlement.helperId) {
        await storage.createNotification({
          userId: settlement.helperId,
          type: "announcement",
          title: "정산 취소",
          message: `정산이 취소되었습니다. 사유: ${reason}`,
          payload: JSON.stringify({ settlementId: id }),
        });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Settlement cancellation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all notifications (admin)
  app.get("/api/admin/notifications", adminAuth, requirePermission("notifications.view"), async (req, res) => {
    try {
      const notifications = await storage.getAllNotifications();
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all helper credentials (admin)
  app.get("/api/admin/helper-credentials", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const credentials = await storage.getAllHelperCredentials();
      res.json(credentials);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/requester-service-agreements", adminAuth, requirePermission("requesters.view"), async (req, res) => {
    try {
      const agreements = await storage.getAllRequesterServiceAgreements();
      res.json(agreements);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/helper-vehicles", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const vehicles = await storage.getAllHelperVehicles();
      res.json(vehicles);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/helper-businesses", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const businesses = await storage.getAllHelperBusinesses();
      res.json(businesses);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/requester-businesses", adminAuth, requirePermission("requesters.view"), async (req, res) => {
    try {
      const businesses = await storage.getAllRequesterBusinesses();
      res.json(businesses);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/helper-bank-accounts", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const accounts = await storage.getAllHelperBankAccounts();
      res.json(accounts);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/admin/helper-bank-accounts/:id/verify - 계좌 승인
  app.patch("/api/admin/helper-bank-accounts/:id/verify", adminAuth, requirePermission("helpers.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [account] = await db.select()
        .from(helperBankAccounts)
        .where(eq(helperBankAccounts.id, id));

      if (!account) {
        return res.status(404).json({ message: "계좌 정보를 찾을 수 없습니다" });
      }

      const [updated] = await db.update(helperBankAccounts)
        .set({
          verificationStatus: 'verified',
        })
        .where(eq(helperBankAccounts.id, id))
        .returning();

      // 헬퍼에게 계좌 승인 알림
      try {
        await storage.createNotification({
          userId: account.helperId,
          type: "bank_account_verified",
          title: "계좌 승인 완료",
          message: "등록하신 계좌가 승인되었습니다. 정산 시 해당 계좌로 입금됩니다.",
        });
        sendPushToUser(account.helperId, {
          title: "계좌 승인 완료",
          body: "등록하신 계좌가 승인되었습니다.",
          url: "/profile",
        });
      } catch (notifErr) {
        console.error("[Notification Error] Bank account verify:", notifErr);
      }

      res.json({ success: true, account: updated });
    } catch (err: any) {
      console.error("Bank account verify error:", err);
      res.status(500).json({ message: "계좌 승인에 실패했습니다" });
    }
  });

  // PATCH /api/admin/helper-bank-accounts/:id/reject - 계좌 반려
  app.patch("/api/admin/helper-bank-accounts/:id/reject", adminAuth, requirePermission("helpers.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "반려 사유를 입력해주세요" });
      }

      const [account] = await db.select()
        .from(helperBankAccounts)
        .where(eq(helperBankAccounts.id, id));

      if (!account) {
        return res.status(404).json({ message: "계좌 정보를 찾을 수 없습니다" });
      }

      const [updated] = await db.update(helperBankAccounts)
        .set({
          verificationStatus: 'rejected',
        })
        .where(eq(helperBankAccounts.id, id))
        .returning();

      // 헬퍼에게 계좌 반려 알림
      try {
        await storage.createNotification({
          userId: account.helperId,
          type: "bank_account_rejected",
          title: "계좌 반려",
          message: `등록하신 계좌가 반려되었습니다. 사유: ${reason}`,
        });
        sendPushToUser(account.helperId, {
          title: "계좌 반려",
          body: `등록하신 계좌가 반려되었습니다. 사유: ${reason}`,
          url: "/profile",
        });
      } catch (notifErr) {
        console.error("[Notification Error] Bank account reject:", notifErr);
      }

      res.json({ success: true, account: updated });
    } catch (err: any) {
      console.error("Bank account reject error:", err);
      res.status(500).json({ message: "계좌 반려에 실패했습니다" });
    }
  });

  app.get("/api/admin/helper-licenses", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const licenses = await storage.getAllHelperLicenses();
      res.json(licenses);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Admin 수동 처리 API (T-23: 연동 OFF 시 운영 가능)
  // ============================================

  // 헬퍼 인증 수기 승인 (IDENTITY_PROVIDER=mock 대체)
  app.post("/api/admin/helpers/:helperId/verify", adminAuth, requirePermission("helpers.edit"), async (req: any, res) => {
    try {
      const helperId = req.params.helperId;
      const adminUser = req.user;
      const { reason } = req.body;

      const helper = await storage.getUser(helperId);
      if (!helper || helper.role !== "helper") {
        return res.status(404).json({ code: "NOT_FOUND", message: "헬퍼를 찾을 수 없습니다" });
      }

      if (helper.helperVerified) {
        return res.status(400).json({ code: "ALREADY_VERIFIED", message: "이미 인증된 헬퍼입니다" });
      }

      await db.update(users)
        .set({
          helperVerified: true,
          helperVerifiedAt: new Date(),
          helperVerifiedBy: adminUser.id,
          onboardingStatus: "approved",
        })
        .where(eq(users.id, helperId));

      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser.id,
        action: "HELPER_VERIFIED",
        targetType: "user",
        reason: reason || "관리자 수기 승인",
        oldValue: JSON.stringify({ helperVerified: false, onboardingStatus: helper.onboardingStatus }),
        newValue: JSON.stringify({ helperVerified: true, onboardingStatus: "approved" }),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      await storage.createNotification({
        userId: helperId,
        type: "system" as any,
        title: "헬퍼 인증 완료",
        message: "관리자 확인을 통해 헬퍼 인증이 완료되었습니다. 이제 업무를 시작할 수 있습니다.",
      });

      res.json({ success: true, message: "헬퍼 인증이 완료되었습니다" });
    } catch (err: any) {
      console.error("Helper verify error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 인증 취소 (필요시)
  app.post("/api/admin/helpers/:helperId/unverify", adminAuth, requirePermission("helpers.edit"), async (req: any, res) => {
    try {
      const helperId = req.params.helperId;
      const adminUser = req.user;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ code: "REASON_REQUIRED", message: "취소 사유를 입력해주세요" });
      }

      const helper = await storage.getUser(helperId);
      if (!helper) {
        return res.status(404).json({ code: "NOT_FOUND", message: "헬퍼를 찾을 수 없습니다" });
      }

      await db.update(users)
        .set({
          helperVerified: false,
          helperVerifiedAt: null,
          helperVerifiedBy: null,
          onboardingStatus: "rejected",
        })
        .where(eq(users.id, helperId));

      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser.id,
        action: "HELPER_UNVERIFIED",
        targetType: "user",
        reason,
        oldValue: JSON.stringify({ helperVerified: true, onboardingStatus: helper.onboardingStatus }),
        newValue: JSON.stringify({ helperVerified: false, onboardingStatus: "rejected" }),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true, message: "헬퍼 인증이 취소되었습니다" });
    } catch (err: any) {
      console.error("Helper unverify error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 증빙 재요청 (마감 후 추가 증빙 요청)
  app.post("/api/admin/orders/:orderId/request-evidence", adminAuth, requirePermission("orders.edit"), async (req: any, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const adminUser = req.user;
      const { evidenceType, message: requestMessage } = req.body;

      if (!evidenceType || !requestMessage) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "증빙 유형과 요청 내용을 입력해주세요" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" });
      }

      const targetUserId = order.matchedHelperId || order.helperId;
      if (targetUserId) {
        await storage.createNotification({
          userId: targetUserId,
          type: "order_update" as any,
          title: "추가 증빙 요청",
          message: `[${evidenceType}] ${requestMessage}`,
          relatedId: orderId,
        });

        sendPushToUser(String(targetUserId), {
          title: "추가 증빙 요청",
          body: `오더 #${orderId}에 대한 추가 증빙이 요청되었습니다.`,
          url: `/orders/${orderId}/closing`,
          tag: `evidence-request-${orderId}`,
        });
      }

      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser.id,
        action: "EVIDENCE_REQUESTED",
        targetType: "order",
        targetId: String(orderId),
        orderId,
        reason: `${evidenceType}: ${requestMessage}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true, message: "증빙 재요청이 전송되었습니다" });
    } catch (err: any) {
      console.error("Request evidence error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 연동 이벤트 목록 조회 (실패 건 확인)
  app.get("/api/admin/integration-events", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { status, provider, limit = 100 } = req.query;

      let query = db.select().from(integrationEvents);

      if (status) {
        query = query.where(eq(integrationEvents.status, String(status))) as any;
      }
      if (provider) {
        query = query.where(eq(integrationEvents.provider, String(provider))) as any;
      }

      const events = await query
        .orderBy(desc(integrationEvents.createdAt))
        .limit(Number(limit));

      res.json(events);
    } catch (err: any) {
      console.error("Get integration events error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 연동 상태 조회
  app.get("/api/admin/integration-status", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const status = {
        sms: process.env.SMS_PROVIDER?.toLowerCase() === 'real' ? 'real' : 'mock',
        push: process.env.PUSH_PROVIDER?.toLowerCase() === 'real' ? 'real' : 'mock',
        payment: process.env.PAYMENT_PROVIDER?.toLowerCase() === 'real' ? 'real' : 'mock',
        identity: process.env.IDENTITY_PROVIDER?.toLowerCase() === 'real' ? 'real' : 'mock',
      };

      res.json(status);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 미인증 헬퍼 목록 조회 (수기 승인 대기)
  app.get("/api/admin/helpers/pending-verification", adminAuth, requirePermission("helpers.view"), async (req, res) => {
    try {
      const pendingHelpers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneNumber: users.phoneNumber,
        createdAt: users.createdAt,
        onboardingStatus: users.onboardingStatus,
        helperVerified: users.helperVerified,
      })
        .from(users)
        .where(and(
          eq(users.role, "helper"),
          or(
            eq(users.helperVerified, false),
            sql`${users.helperVerified} IS NULL`
          )
        ))
        .orderBy(desc(users.createdAt));

      res.json(pendingHelpers);
    } catch (err: any) {
      console.error("Get pending helpers error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Admin 비용 항목 타입 CRUD
  // 스펙: POST/PUT/GET /admin/cost-item-types
  // ============================================

  // 비용 항목 타입 목록 조회 (admin)
  app.get("/api/admin/cost-item-types", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const types = await storage.getAllCostItemTypes();
      res.json(types);
    } catch (err: any) {
      console.error("Error fetching cost item types:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 비용 항목 타입 추가 (admin)
  app.post("/api/admin/cost-item-types", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const user = (req as any).user;
      const { name, sign, is_active, sortOrder } = req.body;

      if (!name || !sign) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "name과 sign은 필수입니다" }
        });
      }

      if (!["PLUS", "MINUS"].includes(sign)) {
        return res.status(400).json({
          error: { code: "INVALID_SIGN", message: "sign은 PLUS 또는 MINUS여야 합니다" }
        });
      }

      const type = await storage.createCostItemType({
        name,
        sign: sign.toLowerCase(), // 스토리지에서는 소문자 사용
        isActive: is_active !== false,
        sortOrder: sortOrder || 0,
      });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "create",
        targetType: "cost_item_type",
        targetId: String(type.id),
        reason: `비용 항목 타입 추가: ${name}`,
        metadata: { name, sign, is_active },
      });

      res.status(201).json({
        id: type.id,
        name: type.name,
        sign: type.sign?.toUpperCase(),
        is_active: type.isActive,
      });
    } catch (err: any) {
      console.error("Error creating cost item type:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 비용 항목 타입 수정 (admin)
  app.put("/api/admin/cost-item-types/:id", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id);
      const { name, sign, is_active } = req.body;

      const existing = await storage.getCostItemType(id);
      if (!existing) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "비용 항목 타입을 찾을 수 없습니다" }
        });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (sign !== undefined) {
        if (!["PLUS", "MINUS"].includes(sign)) {
          return res.status(400).json({
            error: { code: "INVALID_SIGN", message: "sign은 PLUS 또는 MINUS여야 합니다" }
          });
        }
        updates.sign = sign.toLowerCase();
      }
      if (is_active !== undefined) updates.isActive = is_active;

      const updated = await storage.updateCostItemType(id, updates);

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "update",
        targetType: "cost_item_type",
        targetId: String(id),
        reason: `비용 항목 타입 수정: ${updated.name}`,
        metadata: { before: existing, after: updates },
      });

      res.json({
        id: updated.id,
        name: updated.name,
        sign: updated.sign?.toUpperCase(),
        is_active: updated.isActive,
      });
    } catch (err: any) {
      console.error("Error updating cost item type:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all payments (admin)
  app.get("/api/admin/payments", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      // orderNumber 매핑
      const payOrderIds = [...new Set(payments.filter(p => p.orderId).map(p => p.orderId!))];
      const payOrderList = payOrderIds.length > 0
        ? await db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders).where(inArray(orders.id, payOrderIds))
        : [];
      const payOrderMap = new Map(payOrderList.map(o => [o.id, o.orderNumber]));
      const enriched = payments.map(p => ({
        ...p,
        orderNumber: p.orderId ? payOrderMap.get(p.orderId) || null : null,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single payment (admin)
  app.get("/api/admin/payments/:id", adminAuth, requirePermission("payments.view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "결제를 찾을 수 없습니다" } });
      }
      res.json(payment);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Refund payment (admin)
  app.post("/api/admin/payments/:id/refund", adminAuth, requirePermission("payments.edit"), async (req, res) => {
    try {
      const user = (req as any).adminUser || (req as any).user;
      const id = parseInt(req.params.id);
      const { reason, amount } = req.body;

      if (!reason || reason.length < 5) {
        return res.status(400).json({
          error: { code: "INVALID_REASON", message: "환불 사유는 최소 5자 이상이어야 합니다" }
        });
      }

      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "결제를 찾을 수 없습니다" } });
      }

      if (payment.status === "refunded") {
        return res.status(400).json({
          error: { code: "ALREADY_REFUNDED", message: "이미 환불된 결제입니다" }
        });
      }

      if (payment.status !== "captured" && payment.status !== "completed") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: "환불 가능한 상태가 아닙니다. 결제 완료 상태에서만 환불할 수 있습니다." }
        });
      }

      // 환불 금액 계산 (부분 환불 지원)
      const refundAmount = amount || payment.amount;
      if (refundAmount > payment.amount) {
        return res.status(400).json({
          error: { code: "INVALID_AMOUNT", message: "환불 금액이 결제 금액을 초과합니다" }
        });
      }

      // PG사 환불 API 호출 (PortOne V2)
      let pgRefundResult: any = null;
      const pgTxId = (payment as any).pgTransactionId;
      if (pgTxId && pgService.isConfigured()) {
        pgRefundResult = await pgService.processRefund({
          paymentId: pgTxId,
          amount: refundAmount,
          reason,
        });
        if (!pgRefundResult.success) {
          console.error("[PG Refund] PG 환불 실패:", pgRefundResult.message);
          return res.status(502).json({
            error: {
              code: "PG_REFUND_FAILED",
              message: `PG 환불 처리 실패: ${pgRefundResult.message}`,
              pgResponse: pgRefundResult.pgRawResponse,
            },
          });
        }
        console.log("[PG Refund] PG 환불 성공:", pgRefundResult.refundId);
      } else if (pgTxId && !pgService.isConfigured()) {
        // PG 미연동 상태 - 테스트 모드에서는 경고만 출력
        console.warn("[PG Refund] PG 미연동 - DB 상태만 업데이트합니다.");
        pgRefundResult = { success: true, refundId: null, message: "PG 미연동 (DB만 업데이트)" };
      }

      // 결제 상태 업데이트 (전액/부분 환불 모두 "refunded" 상태로 처리)
      const isFullRefund = refundAmount === payment.amount;
      const updated = await storage.updatePayment(id, {
        status: "refunded",
        refundedAt: new Date(),
        refundReason: isFullRefund ? reason : `[부분환불 ${refundAmount}원] ${reason}`,
      });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "refund",
        targetType: "payment",
        targetId: String(id),
        reason,
        metadata: {
          originalAmount: payment.amount,
          refundAmount,
          isFullRefund,
          orderId: payment.orderId,
        },
      });

      res.json({
        success: true,
        payment: updated,
        refund_amount: refundAmount,
        is_full_refund: isFullRefund,
        pg_refund: pgRefundResult ? {
          refundId: pgRefundResult.refundId,
          status: pgRefundResult.status || "completed",
          message: pgRefundResult.message,
        } : null,
      });
    } catch (err: any) {
      console.error("Payment refund error:", err);
      res.status(500).json({ message: "환불 처리 중 오류가 발생했습니다" });
    }
  });

  // Sync payment status with PG (admin)
  app.post("/api/admin/payments/:id/sync", adminAuth, requirePermission("payments.edit"), async (req, res) => {
    try {
      const user = (req as any).adminUser || (req as any).user;
      const id = parseInt(req.params.id);
      const { reason } = req.body;

      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "결제를 찾을 수 없습니다" } });
      }

      // PG사 결제 상태 조회 API 호출 (PortOne V2)
      const pgTxId = (payment as any).pgTransactionId;
      let syncedStatus = payment.status;
      let pgStatusResult: any = null;
      let statusChanged = false;

      if (pgTxId && pgService.isConfigured()) {
        pgStatusResult = await pgService.getPaymentStatus(pgTxId);
        if (pgStatusResult.success) {
          const newDbStatus = mapPGStatusToDBStatus(pgStatusResult.status);
          if (newDbStatus !== payment.status) {
            // PG 상태와 DB 상태가 다른 경우 DB 업데이트
            await storage.updatePayment(id, { status: newDbStatus });
            syncedStatus = newDbStatus;
            statusChanged = true;
            console.log(`[PG Sync] 결제 #${id} 상태 변경: ${payment.status} → ${newDbStatus}`);
          } else {
            syncedStatus = payment.status;
          }
        } else {
          console.warn(`[PG Sync] PG 상태 조회 실패: ${pgStatusResult.message}`);
        }
      } else if (!pgTxId) {
        console.warn(`[PG Sync] 결제 #${id}: pgTransactionId 없음 - 동기화 불가`);
      }

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "sync",
        targetType: "payment",
        targetId: String(id),
        reason: reason || "결제 상태 동기화",
        metadata: {
          beforeStatus: payment.status,
          afterStatus: syncedStatus,
          orderId: payment.orderId,
          pgConfigured: pgService.isConfigured(),
          pgStatusQueried: !!pgStatusResult?.success,
        },
      });

      res.json({
        success: true,
        payment: statusChanged ? { ...payment, status: syncedStatus } : payment,
        synced_status: syncedStatus,
        status_changed: statusChanged,
        pg_status: pgStatusResult ? {
          pgStatus: pgStatusResult.status,
          amount: pgStatusResult.amount,
          method: pgStatusResult.method,
          paidAt: pgStatusResult.paidAt,
        } : null,
        message: pgStatusResult?.success
          ? (statusChanged ? `상태가 동기화되었습니다: ${payment.status} → ${syncedStatus}` : "PG 상태와 동일합니다.")
          : (pgService.isConfigured() ? "PG 상태 조회에 실패했습니다." : "PG 미연동 상태입니다. PORTONE_API_SECRET을 설정해주세요."),
      });
    } catch (err: any) {
      console.error("Payment sync error:", err);
      res.status(500).json({ message: "결제 동기화 중 오류가 발생했습니다" });
    }
  });

  // Update payment status (admin)
  app.patch("/api/admin/payments/:id/status", adminAuth, requirePermission("payments.edit"), async (req, res) => {
    try {
      const user = (req as any).adminUser || (req as any).user;
      const id = parseInt(req.params.id);
      const { status, reason } = req.body;

      if (!reason || reason.length < 10) {
        return res.status(400).json({
          error: { code: "INVALID_REASON", message: "변경 사유는 최소 10자 이상이어야 합니다" }
        });
      }

      const validStatuses = ["pending", "awaiting_deposit", "captured", "completed", "failed", "cancelled", "refunded"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: `유효하지 않은 상태입니다. 허용: ${validStatuses.join(", ")}` }
        });
      }

      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "결제를 찾을 수 없습니다" } });
      }

      const updated = await storage.updatePayment(id, { status });

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "status_change",
        targetType: "payment",
        targetId: String(id),
        reason,
        metadata: {
          beforeStatus: payment.status,
          afterStatus: status,
          orderId: payment.orderId,
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Payment status update error:", err);
      res.status(500).json({ message: "결제 상태 변경 중 오류가 발생했습니다" });
    }
  });

  // Retry failed payment (admin)
  app.post("/api/admin/payments/:id/retry", adminAuth, requirePermission("payments.edit"), async (req, res) => {
    try {
      const user = (req as any).adminUser || (req as any).user;
      const id = parseInt(req.params.id);
      const { reason } = req.body;

      if (!reason || reason.length < 5) {
        return res.status(400).json({
          error: { code: "INVALID_REASON", message: "재시도 사유는 최소 5자 이상이어야 합니다" }
        });
      }

      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "결제를 찾을 수 없습니다" } });
      }

      if (payment.status !== "failed") {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: "실패 상태의 결제만 재시도할 수 있습니다" }
        });
      }

      const currentRetryCount = payment.retryCount || 0;
      if (currentRetryCount >= 3) {
        return res.status(400).json({
          error: { code: "MAX_RETRY_EXCEEDED", message: "최대 재시도 횟수(3회)를 초과했습니다" }
        });
      }

      // Update status to pending and increment retry count
      const updated = await storage.updatePayment(id, {
        status: "pending",
        retryCount: currentRetryCount + 1,
      });

      // Log admin action
      await logAdminAction({
        userId: user.id,
        action: "retry",
        targetType: "payment",
        targetId: String(id),
        reason,
        metadata: {
          previousStatus: payment.status,
          retryCount: currentRetryCount + 1,
          orderId: payment.orderId,
        },
      });

      res.json({
        success: true,
        payment: updated,
        retry_count: currentRetryCount + 1,
        message: "결제 재시도가 예약되었습니다",
      });
    } catch (err: any) {
      console.error("Payment retry error:", err);
      res.status(500).json({ message: "결제 재시도 중 오류가 발생했습니다" });
    }
  });

  // ============================================
  // Admin 웹훅 로그 조회/재시도
  // 스펙: GET /admin/webhooks, POST /admin/webhooks/{webhookLogId}/retry
  // ============================================

  // 웹훅 로그 목록 조회 (admin)
  app.get("/api/admin/webhooks", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { source, status, limit } = req.query;
      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit as string) || 100, 1), 500) : 100;

      const logs = await storage.getAllWebhookLogs({
        source: source as string | undefined,
        status: status as string | undefined,
        limit: parsedLimit,
      });

      res.json(logs.map(log => ({
        webhook_log_id: String(log.id),
        source: log.source,
        event_type: log.eventType,
        webhook_id: log.webhookId,
        status: log.status?.toUpperCase(),
        processed_at: log.processedAt,
        error_message: log.errorMessage,
        retry_count: log.retryCount,
        related_entity_type: log.relatedEntityType,
        related_entity_id: log.relatedEntityId,
        created_at: log.createdAt,
      })));
    } catch (err: any) {
      console.error("Error fetching webhook logs:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 웹훅 로그 상세 조회 (admin)
  app.get("/api/admin/webhooks/:id", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const log = await storage.getWebhookLog(id);

      if (!log) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "웹훅 로그를 찾을 수 없습니다" }
        });
      }

      res.json({
        webhook_log_id: String(log.id),
        source: log.source,
        event_type: log.eventType,
        webhook_id: log.webhookId,
        payload: log.payload ? JSON.parse(log.payload) : null,
        status: log.status?.toUpperCase(),
        processed_at: log.processedAt,
        error_message: log.errorMessage,
        retry_count: log.retryCount,
        related_entity_type: log.relatedEntityType,
        related_entity_id: log.relatedEntityId,
        idempotency_key: log.idempotencyKey,
        ip_address: log.ipAddress,
        created_at: log.createdAt,
      });
    } catch (err: any) {
      console.error("Error fetching webhook log:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 웹훅 재처리 (admin)
  app.post("/api/admin/webhooks/:id/retry", adminAuth, requirePermission("settings.edit"), async (req, res) => {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id);
      const { reason } = req.body;

      const log = await storage.getWebhookLog(id);
      if (!log) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "웹훅 로그를 찾을 수 없습니다" }
        });
      }

      // 이미 처리된 웹훅은 재처리 불필요
      if (log.status === "processed") {
        return res.status(400).json({
          error: { code: "ALREADY_PROCESSED", message: "이미 처리된 웹훅입니다" }
        });
      }

      // 재처리 시도 (실제 처리 로직은 웹훅 타입에 따라 다름)
      const retryCount = (log.retryCount || 0) + 1;
      let result = "PROCESSING";

      try {
        const payload = log.payload ? JSON.parse(log.payload) : {};

        // 웹훅 타입별 실제 재처리 로직
        if (log.source === "portone" && log.eventType?.includes("payment")) {
          // PortOne 결제 웹훅 재처리
          const paymentId = payload.paymentId || payload.data?.paymentId;
          if (paymentId) {
            // 결제 상태 확인 및 DB 업데이트
            const payment = await storage.getPaymentByProviderPaymentId(paymentId);
            if (payment) {
              const newStatus = payload.data?.status || payload.status;
              if (newStatus && newStatus !== payment.status) {
                await storage.updatePayment(payment.id, {
                  status: newStatus,
                  paidAt: newStatus === 'paid' || newStatus === 'captured' ? new Date() : payment.paidAt
                });

                // 오더 상태도 업데이트 (계약금 입금 완료 시)
                if ((newStatus === 'paid' || newStatus === 'captured') && payment.orderId) {
                  const order = await storage.getOrder(payment.orderId);
                  if (order && order.status === 'awaiting_deposit') {
                    await storage.updateOrder(payment.orderId, { status: 'open' });
                  }
                }
              }
            }
          }
          result = "PROCESSED";
        } else if (log.source === "settlement" || log.eventType?.includes("settlement")) {
          // 정산 관련 웹훅 재처리
          const settlementId = payload.settlementId || payload.data?.settlementId;
          if (settlementId) {
            const settlement = await storage.getSettlementRecord(parseInt(settlementId));
            if (settlement) {
              const newStatus = payload.data?.status || payload.status;
              if (newStatus && newStatus !== settlement.status) {
                await storage.updateSettlementRecord(settlement.id, { status: newStatus });
              }
            }
          }
          result = "PROCESSED";
        } else {
          // 기타 웹훅 - 상태만 업데이트
          result = "PROCESSED";
        }

        await storage.updateWebhookLog(id, {
          status: "processed",
          processedAt: new Date(),
          retryCount,
        });
      } catch (processingError: any) {
        result = "FAILED";
        await storage.updateWebhookLog(id, {
          status: "failed",
          errorMessage: processingError.message || "재처리 중 오류 발생",
          retryCount,
        });
      }

      // 감사 로그 기록
      await logAdminAction({
        userId: user.id,
        action: "webhook_retry",
        targetType: "webhook_log",
        targetId: String(id),
        reason: reason || "웹훅 재처리",
        metadata: { retry_count: retryCount, result },
      });

      res.json({
        webhook_log_id: String(id),
        status: "RETRIED",
        result,
        retry_count: retryCount,
      });
    } catch (err: any) {
      console.error("Error retrying webhook:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get audit logs (admin)
  app.get("/api/admin/audit-logs", adminAuth, requirePermission("settings.view"), async (req, res) => {
    try {
      const { userId, action, targetType, targetId, limit } = req.query;
      const parsedLimit = limit ? Math.min(Math.max(parseInt(limit as string) || 100, 1), 1000) : 100;
      const logs = await storage.getAuditLogs({
        userId: userId as string | undefined,
        action: action as string | undefined,
        targetType: targetType as string | undefined,
        targetId: targetId as string | undefined,
        limit: parsedLimit,
      });
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Admin Dispute Management API (분쟁 관리)
  // ============================================

  // GET /api/admin/disputes - 분쟁 목록 조회

  // GET /api/admin/disputes/:id - 분쟁 상세 조회

  // PATCH /api/admin/disputes/:id/start-review - 검토 시작
  app.patch("/api/admin/disputes/:id/start-review", adminAuth, requirePermission("disputes.review"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;

      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      if (incident.status !== "requested" && incident.status !== "submitted") {
        return res.status(400).json({ message: `검토 시작할 수 없는 상태입니다: ${incident.status}` });
      }

      // Update incident status
      const [updated] = await db.update(incidentReports)
        .set({
          status: "reviewing",
          reviewerId: adminUser?.id,
          reviewStartedAt: new Date(),
        })
        .where(eq(incidentReports.id, id))
        .returning();

      // Update order status
      await db.update(orders)
        .set({ status: "dispute_reviewing" })
        .where(eq(orders.id, incident.orderId));

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "DISPUTE_REVIEW_STARTED",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "incident",
        targetId: String(id),
        reason: "분쟁 검토 시작",
        oldValue: JSON.stringify({ status: incident.status }),
        newValue: JSON.stringify({ status: "reviewing" }),
      });

      res.json({ success: true, incident: updated });
    } catch (err: any) {
      console.error("Start dispute review error:", err);
      res.status(500).json({ message: "검토 시작에 실패했습니다" });
    }
  });

  // PATCH /api/admin/disputes/:id/resolve - 분쟁 해결 (인정/부분인정)
  app.patch("/api/admin/disputes/:id/resolve", adminAuth, requirePermission("disputes.resolve"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { adminMemo, deductionAmount, deductionReason, resolutionAmount } = req.body;

      if (!adminMemo || adminMemo.trim().length < 10) {
        return res.status(400).json({ message: "관리자 메모는 10자 이상 입력해주세요" });
      }

      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      if (incident.status !== "reviewing") {
        return res.status(400).json({ message: `해결할 수 없는 상태입니다: ${incident.status}` });
      }

      // Update incident
      const [updated] = await db.update(incidentReports)
        .set({
          status: "resolved",
          adminMemo: adminMemo.trim(),
          deductionAmount: deductionAmount || 0,
          deductionReason: deductionReason || null,
          resolution: adminMemo.trim(),
          resolutionAmount: resolutionAmount || deductionAmount || 0,
          resolvedBy: adminUser?.id,
          resolvedAt: new Date(),
        })
        .where(eq(incidentReports.id, id))
        .returning();

      // Update order status
      await db.update(orders)
        .set({ status: "dispute_resolved" })
        .where(eq(orders.id, incident.orderId));

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "DISPUTE_RESOLVED",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "incident",
        targetId: String(id),
        reason: adminMemo.trim(),
        oldValue: JSON.stringify({ status: incident.status }),
        newValue: JSON.stringify({
          status: "resolved",
          deductionAmount: deductionAmount || 0,
          deductionReason,
        }),
      });

      // 차감 금액이 있으면 deductions 테이블에 추가
      if (deductionAmount && deductionAmount > 0 && incident.helperId) {
        await db.insert(deductions).values({
          orderId: incident.orderId,
          incidentId: id,
          requesterId: incident.requesterId,
          targetType: "helper",
          targetId: incident.helperId,
          amount: deductionAmount,
          reason: deductionReason || adminMemo.trim(),
          category: incident.incidentType || "dispute",
          status: "pending",
          createdBy: adminUser?.id,
          memo: adminMemo.trim(),
        });
      }

      res.json({ success: true, incident: updated });
    } catch (err: any) {
      console.error("Resolve dispute error:", err);
      res.status(500).json({ message: "분쟁 해결에 실패했습니다" });
    }
  });

  // PATCH /api/admin/disputes/:id/reject - 분쟁 기각
  app.patch("/api/admin/disputes/:id/reject", adminAuth, requirePermission("disputes.resolve"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { adminMemo } = req.body;

      if (!adminMemo || adminMemo.trim().length < 10) {
        return res.status(400).json({ message: "기각 사유는 10자 이상 입력해주세요" });
      }

      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      if (incident.status !== "reviewing") {
        return res.status(400).json({ message: `기각할 수 없는 상태입니다: ${incident.status}` });
      }

      // Update incident
      const [updated] = await db.update(incidentReports)
        .set({
          status: "rejected",
          adminMemo: adminMemo.trim(),
          resolution: adminMemo.trim(),
          resolvedBy: adminUser?.id,
          resolvedAt: new Date(),
        })
        .where(eq(incidentReports.id, id))
        .returning();

      // Update order status
      await db.update(orders)
        .set({ status: "dispute_rejected" })
        .where(eq(orders.id, incident.orderId));

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "DISPUTE_REJECTED",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "incident",
        targetId: String(id),
        reason: adminMemo.trim(),
        oldValue: JSON.stringify({ status: incident.status }),
        newValue: JSON.stringify({ status: "rejected" }),
      });

      res.json({ success: true, incident: updated });
    } catch (err: any) {
      console.error("Reject dispute error:", err);
      res.status(500).json({ message: "분쟁 기각에 실패했습니다" });
    }
  });

  // POST /api/admin/disputes/:id/confirm-refund - 환불 확정 및 CS환불 생성
  app.post("/api/admin/disputes/:id/confirm-refund", adminAuth, requirePermission("disputes.resolve"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { amount, reason } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "환불 금액을 입력해주세요" });
      }

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "환불 사유는 5자 이상 입력해주세요" });
      }

      // Get incident/dispute
      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      // Get order to find payment
      const order = await storage.getOrder(incident.orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // Get payment for this order
      const payment = await storage.getPaymentByOrderId(incident.orderId);
      if (!payment) {
        return res.status(404).json({ message: "결제 정보를 찾을 수 없습니다" });
      }

      // Create CS refund record
      const [refund] = await db.insert(refunds).values({
        paymentId: payment.id,
        orderId: incident.orderId,
        amount,
        reason: reason.trim(),
        reasonCategory: "dispute",
        status: "pending",
        refundMethod: "bank_transfer",
        requestedBy: adminUser?.id,
      }).returning();

      // Update incident status to resolved
      await db.update(incidentReports)
        .set({
          status: "resolved",
          resolution: reason.trim(),
          resolutionAmount: amount,
          resolvedBy: adminUser?.id,
          resolvedAt: new Date(),
        })
        .where(eq(incidentReports.id, id));

      // 정산 차감 자동 반영 (환불 금액을 정산에서 차감)
      try {
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
          const existingLineItem = await storage.getSettlementLineItemByIncident(settlement.id, id);
          if (!existingLineItem) {
            await storage.createSettlementLineItem({
              statementId: settlement.id,
              itemType: "deduction",
              itemName: `환불 확정 차감 #${id}`,
              quantity: 1,
              unitPrice: -amount,
              amount: -amount,
              notes: JSON.stringify({
                incidentId: id,
                refundId: refund.id,
                reason: reason.trim(),
                status: "approved",
                type: "refund"
              }),
            });

            const currentDeduction = settlement.deduction || 0;
            const newDeduction = currentDeduction + amount;
            const currentNetAmount = settlement.netAmount || 0;
            const newNetAmount = currentNetAmount - amount;

            await storage.updateSettlementStatement(settlement.id, {
              deduction: newDeduction,
              netAmount: newNetAmount,
            });

            await storage.updateIncidentReport(id, { settlementId: settlement.id });
            console.log(`[Refund→Settlement] Dispute #${id} refund ${amount}원 applied to settlement #${settlement.id}`);
          }
        }
      } catch (settlementErr: any) {
        console.error(`[Refund→Settlement] Failed to apply settlement adjustment for dispute #${id}:`, settlementErr);
        // Don't fail the refund if settlement adjustment fails - it can be manually applied
      }

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "REFUND_CONFIRMED",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "refund",
        targetId: String(refund.id),
        reason: reason.trim(),
        newValue: JSON.stringify({ refundId: refund.id, amount }),
      });

      console.log(`[CS Refund] Created refund ${refund.id} for dispute ${id}, amount: ${amount}`);

      res.json({ success: true, refund, message: "환불이 확정되어 CS환불로 이동되었습니다" });
    } catch (err: any) {
      console.error("Confirm refund error:", err);
      res.status(500).json({ message: "환불 확정에 실패했습니다" });
    }
  });

  // POST /api/admin/disputes/:id/resolve-without-refund - 환불 없이 분쟁 해결 (물건 발견, 합의 등)
  app.post("/api/admin/disputes/:id/resolve-without-refund", adminAuth, requirePermission("disputes.resolve"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { reason, resolutionType } = req.body;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "해결 사유는 5자 이상 입력해주세요" });
      }

      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      const validTypes = ['item_found', 'mutual_agreement', 'misunderstanding', 'other'];
      const type = validTypes.includes(resolutionType) ? resolutionType : 'other';

      await db.update(incidentReports)
        .set({
          status: "resolved",
          resolution: "[" + type + "] " + reason.trim(),
          resolutionAmount: 0,
          resolvedBy: adminUser?.id,
          resolvedAt: new Date(),
        })
        .where(eq(incidentReports.id, id));

      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "DISPUTE_RESOLVED_NO_REFUND",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "incident",
        targetId: String(id),
        reason: reason.trim(),
        newValue: JSON.stringify({ resolutionType: type }),
      });

      console.log("[Dispute] Resolved without refund - dispute " + id + ", type: " + type);

      res.json({ success: true, message: "분쟁이 환불 없이 해결 처리되었습니다" });
    } catch (err: any) {
      console.error("Resolve without refund error:", err);
      res.status(500).json({ message: "분쟁 해결에 실패했습니다" });
    }
  });

  // POST /api/admin/disputes/:id/create-deduction-refund - 차감 + 환불 통합 처리
  app.post("/api/admin/disputes/:id/create-deduction-refund", adminAuth, requirePermission("disputes.resolve"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { deductionAmount, refundAmount, reason, category } = req.body;

      if (!deductionAmount || deductionAmount <= 0) {
        return res.status(400).json({ message: "차감 금액을 입력해주세요" });
      }
      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "사유는 5자 이상 입력해주세요" });
      }

      // Get incident/dispute
      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      // Get order
      const order = await storage.getOrder(incident.orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // Get helper info from contracts or order
      const helperId = incident.helperId || order.assignedHelperId;
      const requesterId = incident.requesterId || order.requesterId;

      if (!helperId) {
        return res.status(400).json({ message: "해당 오더에 배정된 헬퍼가 없습니다" });
      }

      // 1. 헬퍼 차감 생성
      const [deduction] = await db.insert(deductions).values({
        orderId: incident.orderId,
        incidentId: id,
        helperId: helperId,
        targetType: "helper",
        targetId: helperId,
        amount: deductionAmount,
        reason: reason.trim(),
        category: category || "dispute",
        status: "pending",
        createdBy: adminUser?.id,
      }).returning();

      // 2. 요청자 환불 생성 (환불 금액이 있을 경우)
      let refund = null;
      if (refundAmount && refundAmount > 0 && requesterId) {
        const [created] = await db.insert(refunds).values({
          orderId: incident.orderId,
          incidentId: id,
          requesterId: requesterId,
          amount: refundAmount,
          reason: reason.trim(),
          reasonCategory: "dispute",
          status: "pending",
          refundMethod: "bank_transfer",
          requestedBy: adminUser?.id,
        }).returning();
        refund = created;
      }

      // 3. incident 업데이트 (차감 생성 → 자동으로 "처리중" 상태)
      await db.update(incidentReports)
        .set({
          status: "reviewing",
          deductionAmount: deductionAmount,
          deductionReason: reason.trim(),
          deductionMethod: refundAmount && refundAmount > 0 ? "both" : "helper_deduct",
          updatedAt: new Date(),
        })
        .where(eq(incidentReports.id, id));

      // 4. 정산 차감 자동 반영
      try {
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

        if (settlement && deductionAmount > 0) {
          const existingLineItem = await storage.getSettlementLineItemByIncident(settlement.id, id);
          if (!existingLineItem) {
            await storage.createSettlementLineItem({
              statementId: settlement.id,
              itemType: "deduction",
              itemName: `차감 처리 #${id}`,
              quantity: 1,
              unitPrice: -deductionAmount,
              amount: -deductionAmount,
              notes: JSON.stringify({
                incidentId: id,
                deductionId: deduction.id,
                refundId: refund?.id || null,
                reason: reason.trim(),
                status: "approved",
                type: "deduction_refund"
              }),
            });

            const currentDeduction = settlement.deduction || 0;
            const newDeduction = currentDeduction + deductionAmount;
            const currentNetAmount = settlement.netAmount || 0;
            const newNetAmount = currentNetAmount - deductionAmount;

            await storage.updateSettlementStatement(settlement.id, {
              deduction: newDeduction,
              netAmount: newNetAmount,
            });

            await storage.updateIncidentReport(id, { settlementId: settlement.id });
            console.log(`[Deduction→Settlement] Dispute #${id} deduction ${deductionAmount}원 applied to settlement #${settlement.id}`);
          }
        }
      } catch (settlementErr: any) {
        console.error(`[Deduction→Settlement] Failed to apply settlement adjustment for dispute #${id}:`, settlementErr);
      }

      // 5. 감사로그 기록
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "DEDUCTION_AND_REFUND_CREATED",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "deduction",
        targetId: String(deduction.id),
        reason: reason.trim(),
        newValue: JSON.stringify({
          deductionId: deduction.id,
          deductionAmount,
          refundId: refund?.id || null,
          refundAmount: refundAmount || 0,
          helperId,
          requesterId: requesterId || null,
        }),
      });

      console.log(`[Deduction+Refund] Created deduction ${deduction.id}${refund ? ` + refund ${refund.id}` : ''} for dispute ${id}`);

      res.json({
        success: true,
        deduction,
        refund,
        message: refund
          ? `차감(${deductionAmount.toLocaleString()}원) 및 환불(${refundAmount.toLocaleString()}원)이 생성되었습니다`
          : `차감(${deductionAmount.toLocaleString()}원)이 생성되었습니다`,
      });
    } catch (err: any) {
      console.error("Create deduction+refund error:", err);
      res.status(500).json({ message: "차감/환불 처리에 실패했습니다" });
    }
  });

  // POST /api/admin/disputes/:id/reply - 이의제기 답변 달기
  app.post("/api/admin/disputes/:id/reply", adminAuth, requirePermission("disputes.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { reply, deductionAmount, deductionReason, adminMemo } = req.body;

      if (!reply || reply.trim().length < 5) {
        return res.status(400).json({ message: "답변은 5자 이상 입력해주세요" });
      }

      // Check if it's a dispute (new system)
      const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id));

      if (dispute) {
        // Update dispute with reply
        const [updated] = await db.update(disputes)
          .set({
            adminReply: reply.trim(),
            adminReplyAt: new Date(),
            adminReplyBy: adminUser?.id,
          })
          .where(eq(disputes.id, id))
          .returning();

        // 증빙사진 조회
        const evidenceRows = await db.select().from(incidentEvidence).where(eq(incidentEvidence.incidentId, id));
        const evidencePhotoUrls = evidenceRows.filter(e => e.evidenceType === "photo").map(e => e.fileUrl);

        // Get helper info for notification
        const [helper] = await db.select().from(users).where(eq(users.id, dispute.helperId));

        // Send notification to helper
        if (helper) {
          await storage.createNotification({
            userId: dispute.helperId,
            type: "dispute_reply",
            title: "이의제기 답변",
            message: `이의제기에 대한 답변이 등록되었습니다: ${reply.trim().substring(0, 50)}...`,
            data: JSON.stringify({ disputeId: id }),
          });

          // Send push notification
          await sendPushToUser(dispute.helperId, {
            title: "이의제기 답변",
            body: `이의제기에 대한 답변이 등록되었습니다.`,
          } as any);

          // Send SMS notification (알림톡)
          if (helper.phone) {
            try {
              await smsService.sendSms(helper.phone, `[헬프미] 이의제기에 대한 답변이 등록되었습니다. 앱에서 확인해주세요.`);
            } catch (smsErr) {
              console.error("SMS send error:", smsErr);
            }
          }
        }

        // Audit log
        await db.insert(auditLogs).values({
          actorRole: "ADMIN",
          userId: adminUser?.id,
          action: "DISPUTE_REPLY_ADDED",
          targetType: "dispute",
          targetId: String(id),
          newValue: JSON.stringify({ reply: reply.trim() }),
        });

        return res.json({ success: true, dispute: updated });
      }

      // Fallback to incident reports (legacy system)
      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "이의제기를 찾을 수 없습니다" });
      }

      // Update incident with reply
      const [updated] = await db.update(incidentReports)
        .set({
          adminMemo: reply.trim(),
        })
        .where(eq(incidentReports.id, id))
        .returning();

      // Get requester info for notification
      if (incident.requesterId) {
        const [requester] = await db.select().from(users).where(eq(users.id, incident.requesterId));

        if (requester) {
          await storage.createNotification({
            userId: incident.requesterId,
            type: "dispute_reply",
            title: "분쟁 답변",
            message: `분쟁에 대한 답변이 등록되었습니다: ${reply.trim().substring(0, 50)}...`,
            data: JSON.stringify({ incidentId: id }),
          });

          // Send push notification
          await sendPushToUser(incident.requesterId, {
            title: "분쟁 답변",
            body: `분쟁에 대한 답변이 등록되었습니다.`,
          } as any);

          // Send SMS notification (알림톡)
          if (requester.phone) {
            try {
              await smsService.sendSms(requester.phone, `[헬프미] 분쟁에 대한 답변이 등록되었습니다. 앱에서 확인해주세요.`);
            } catch (smsErr) {
              console.error("SMS send error:", smsErr);
            }
          }
        }
      }

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "DISPUTE_REPLY_ADDED",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "incident",
        targetId: String(id),
        newValue: JSON.stringify({ reply: reply.trim() }),
      });

      // 차감 금액이 있으면 deductions 테이블에 추가
      if (deductionAmount && deductionAmount > 0 && incident.helperId) {
        await db.insert(deductions).values({
          orderId: incident.orderId,
          incidentId: id,
          requesterId: incident.requesterId,
          targetType: "helper",
          targetId: incident.helperId,
          amount: deductionAmount,
          reason: deductionReason || adminMemo.trim(),
          category: incident.incidentType || "dispute",
          status: "pending",
          createdBy: adminUser?.id,
          memo: adminMemo.trim(),
        });
      }

      res.json({ success: true, incident: updated });
    } catch (err: any) {
      console.error("Dispute reply error:", err);
      res.status(500).json({ message: "답변 등록에 실패했습니다" });
    }
  });

  // POST /api/admin/disputes/:id/request-evidence - 추가 증빙 요청
  app.post("/api/admin/disputes/:id/request-evidence", adminAuth, requirePermission("disputes.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const adminUser = (req as any).adminUser;
      const { dueHours = 48 } = req.body;

      const incident = await storage.getIncidentReport(id);
      if (!incident) {
        return res.status(404).json({ message: "분쟁을 찾을 수 없습니다" });
      }

      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + dueHours);

      // Update incident
      const [updated] = await db.update(incidentReports)
        .set({
          evidenceDueAt: dueAt,
        })
        .where(eq(incidentReports.id, id))
        .returning();

      // Audit log
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser?.id,
        action: "EVIDENCE_REQUESTED",
        orderId: incident.orderId,
        incidentId: id,
        targetType: "incident",
        targetId: String(id),
        reason: `추가 증빙 요청 (${dueHours}시간 내)`,
      });

      // 신고자에게 추가 증빙 요청 알림
      try {
        if (incident.requesterId) {
          await storage.createNotification({
            userId: incident.requesterId,
            type: "evidence_requested",
            title: "추가 증빙 요청",
            message: `분쟁 건에 대해 추가 증빙이 요청되었습니다. ${dueHours}시간 내에 제출해주세요.`,
            relatedId: incident.orderId,
          });
          sendPushToUser(incident.requesterId, {
            title: "추가 증빙 요청",
            body: `분쟁 건에 대해 추가 증빙이 요청되었습니다. ${dueHours}시간 내에 제출해주세요.`,
            url: `/dispute/${id}`,
          });
        }
      } catch (notifErr) {
        console.error("[Notification Error] Evidence request:", notifErr);
      }

      res.json({ success: true, incident: updated, evidenceDueAt: dueAt });
    } catch (err: any) {
      console.error("Request evidence error:", err);
      res.status(500).json({ message: "증빙 요청에 실패했습니다" });
    }
  });

  // GET /api/admin/orders/:orderId/closing-evidence - 마감 증빙 조회
  app.get("/api/admin/orders/:orderId/closing-evidence", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);

      // Get closing report
      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      if (!closingReport) {
        return res.status(404).json({ message: "마감 보고서를 찾을 수 없습니다" });
      }

      const deliveryHistoryImages = closingReport.deliveryHistoryImagesJson
        ? JSON.parse(closingReport.deliveryHistoryImagesJson)
        : [];
      const etcImages = closingReport.etcImagesJson
        ? JSON.parse(closingReport.etcImagesJson)
        : [];

      res.json({
        closingReport: {
          id: closingReport.id,
          status: closingReport.status,
          memo: closingReport.memo,
          submittedAt: closingReport.createdAt,
        },
        deliveryHistoryImages,
        etcImages,
        hasDeliveryHistory: deliveryHistoryImages.length > 0,
      });
    } catch (err: any) {
      console.error("Get closing evidence error:", err);
      res.status(500).json({ message: "마감 증빙 조회에 실패했습니다" });
    }
  });

  // GET /api/admin/orders/:orderId/closing-report - 관리자 마감자료 상세 조회
  app.get("/api/admin/orders/:orderId/closing-report", adminAuth, requirePermission("orders.view"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);

      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      if (!closingReport) {
        return res.status(404).json({ message: "마감 보고서를 찾을 수 없습니다", exists: false });
      }

      const helper = closingReport.helperId ? await storage.getUser(closingReport.helperId) : null;

      const extraCosts = closingReport.extraCostsJson
        ? JSON.parse(closingReport.extraCostsJson)
        : [];
      const deliveryHistoryImages = closingReport.deliveryHistoryImagesJson
        ? JSON.parse(closingReport.deliveryHistoryImagesJson)
        : [];
      const etcImages = closingReport.etcImagesJson
        ? JSON.parse(closingReport.etcImagesJson)
        : [];
      const dynamicFields = closingReport.dynamicFieldsJson
        ? JSON.parse(closingReport.dynamicFieldsJson)
        : {};

      res.json({
        exists: true,
        orderId,
        id: closingReport.id,
        helperName: helper?.name || "알 수 없음",
        status: closingReport.status,
        deliveredCount: closingReport.deliveredCount,
        returnedCount: closingReport.returnedCount,
        etcCount: closingReport.etcCount || 0,
        etcPricePerUnit: closingReport.etcPricePerUnit || 0,
        extraCosts,
        deliveryHistoryImages,
        etcImages,
        dynamicFields,
        memo: closingReport.memo,
        calculatedAmount: closingReport.calculatedAmount,
        submittedAt: closingReport.createdAt ? new Date(closingReport.createdAt).toISOString() : null,
        reviewedAt: closingReport.reviewedAt ? new Date(closingReport.reviewedAt).toISOString() : null,
        reviewedBy: closingReport.reviewedBy,
        rejectReason: closingReport.rejectReason,
      });
    } catch (err: any) {
      console.error("Admin get closing report error:", err);
      res.status(500).json({ message: "마감자료 조회에 실패했습니다" });
    }
  });

  // PATCH /api/admin/orders/:orderId/closing-report/quantities - 마감수량 수정 (이의제기용)
  app.patch("/api/admin/orders/:orderId/closing-report/quantities", adminAuth, requirePermission("orders.edit"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const adminUser = req.user!;
      const { deliveredCount, returnedCount, etcCount, reason } = req.body;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ message: "수정 사유는 5자 이상 입력해주세요" });
      }

      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      if (!closingReport) {
        return res.status(404).json({ message: "마감 보고서를 찾을 수 없습니다" });
      }

      const oldValues = {
        deliveredCount: closingReport.deliveredCount,
        returnedCount: closingReport.returnedCount,
        etcCount: closingReport.etcCount,
      };

      const updates: any = {};
      if (deliveredCount !== undefined) updates.deliveredCount = deliveredCount;
      if (returnedCount !== undefined) updates.returnedCount = returnedCount;
      if (etcCount !== undefined) updates.etcCount = etcCount;

      await db.update(closingReports)
        .set(updates)
        .where(eq(closingReports.id, closingReport.id));

      // 감사로그
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser.id,
        action: "CLOSING_REPORT_QUANTITIES_MODIFIED",
        orderId: orderId,
        targetType: "closing_report",
        targetId: String(closingReport.id),
        reason: reason.trim(),
        oldValue: JSON.stringify(oldValues),
        newValue: JSON.stringify({ deliveredCount, returnedCount, etcCount }),
      });

      console.log(`[ClosingReport] Quantities modified for order ${orderId} by admin ${adminUser.id}`);

      res.json({
        success: true,
        message: "마감수량이 수정되었습니다",
        oldValues,
        newValues: { deliveredCount, returnedCount, etcCount },
      });
    } catch (err: any) {
      console.error("Closing report quantity modify error:", err);
      res.status(500).json({ message: "마감수량 수정에 실패했습니다" });
    }
  });

  // POST /api/admin/orders/:orderId/closing/approve - 관리자 마감 승인 (정산 자동화 + settlement_records 생성)
  app.post("/api/admin/orders/:orderId/closing/approve", adminAuth, requirePermission("settlements.approve"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const adminUser = req.user!;
      const { adjustedAmount, reason, damageDeduction = 0, damageReason } = req.body;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      if (order.status !== "closing_submitted") {
        return res.status(400).json({ message: `현재 상태(${order.status})에서는 마감 승인을 할 수 없습니다` });
      }

      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      if (!closingReport) {
        return res.status(404).json({ message: "마감 보고서를 찾을 수 없습니다" });
      }

      // 마감자료 기반 정산 계산 (헬퍼/요청자와 동일한 계산식)
      // 통합 계산 모듈 사용 (Single Source of Truth)
      // ? 단가: 최저운임 적용된 finalPricePerBox 우선, 없으면 pricePerUnit
      const unitPrice = Number(order.finalPricePerBox ?? order.pricePerUnit ?? 0);

      const closingData = parseClosingReport(closingReport, { pricePerUnit: unitPrice });
      const settlement = calculateSettlement(closingData);

      const totalBoxCount = settlement.totalBillableCount;
      const etcCount = settlement.etcCount;
      const etcAmount = settlement.etcAmount;
      const extraCostsTotal = settlement.extraCostsTotal;
      const supplyTotal = settlement.supplyAmount;
      const vat = settlement.vatAmount;

      // 정답 금액: adjustedAmount가 있으면 그 값, 없으면 계산값
      const finalTotal = adjustedAmount !== undefined ? Number(adjustedAmount) : settlement.totalAmount;

      // 계약 정보 조회 (snapshotCommissionRate 사용)
      const orderContracts = await storage.getOrderContracts(orderId);
      const contract = orderContracts.find(c => c.helperId === closingReport.helperId);

      // 계약/지원 시점 스냅샷 수수료율 사용 (없으면 기본 10%)
      const application = await db.select().from(orderApplications)
        .where(and(
          eq(orderApplications.orderId, orderId),
          eq(orderApplications.helperId, closingReport.helperId)
        ))
        .limit(1);
      const platformFeeRate = application[0]?.snapshotCommissionRate ?? order.snapshotCommissionRate ?? 3;
      const platformFee = Math.round(finalTotal * (platformFeeRate / 100));

      // 헬퍼 지급액 = 최종금액 - 플랫폼수수료 - 화물사고차감
      const driverPayout = finalTotal - platformFee - (Number(damageDeduction) || 0);

      const downPaymentAmount = contract?.depositAmount || contract?.downPaymentAmount || 0;
      const balanceAmount = Math.max(0, finalTotal - downPaymentAmount);

      // 1. closing_reports 업데이트 (calculatedAmount = 정답 금액)
      await db.update(closingReports)
        .set({
          status: "approved",
          calculatedAmount: finalTotal,
          reviewedAt: new Date(),
          reviewedBy: adminUser.id,
        })
        .where(eq(closingReports.id, closingReport.id));

      // 2. 오더 상태 업데이트
      await storage.updateOrder(orderId, { status: "final_amount_confirmed" });

      // 3. 계약 업데이트
      if (contract) {
        await storage.updateContract(contract.id, {
          finalAmount: finalTotal,
          calculatedBalanceAmount: balanceAmount,
        });
      }

      // 4. settlement_records 생성/업데이트 (Single Source of Truth)
      const existingSettlement = await db.select()
        .from(settlementRecords)
        .where(eq(settlementRecords.orderId, orderId))
        .limit(1);

      if (existingSettlement.length === 0) {
        await db.insert(settlementRecords).values({
          orderId,
          helperId: closingReport.helperId,
          closingReportId: closingReport.id,
          contractId: contract?.id ?? null,
          baseSupply: totalBoxCount * unitPrice,
          urgentFeeSupply: 0,
          extraSupply: extraCostsTotal,
          finalSupply: supplyTotal,
          vat,
          finalTotal,
          platformFeeBaseOn: "TOTAL",
          platformFeeRate,
          platformFee,
          damageDeduction: Number(damageDeduction) || 0,
          damageReason: damageReason || null,
          driverPayout,
          status: "APPROVED",
          approvedBy: adminUser.id,
          approvedAt: new Date(),
        });
      } else {
        await db.update(settlementRecords)
          .set({
            helperId: closingReport.helperId,
            finalTotal,
            platformFee,
            damageDeduction: Number(damageDeduction) || 0,
            damageReason: damageReason || null,
            driverPayout,
            status: "APPROVED",
            approvedBy: adminUser.id,
            approvedAt: new Date(),
          })
          .where(eq(settlementRecords.orderId, orderId));
      }

      // 5. 감사 로그
      await db.insert(auditLogs).values({
        actorRole: "ADMIN",
        userId: adminUser.id,
        action: "CLOSING_APPROVED",
        orderId,
        targetType: "closing_report",
        targetId: String(closingReport.id),
        reason: reason || `마감 승인 (청구금액: ${finalTotal.toLocaleString()}원, 헬퍼지급: ${driverPayout.toLocaleString()}원)`,
      });

      // 6. 요청자 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "closing_approved",
          title: "마감 승인",
          message: `오더 마감이 승인되었습니다. 잔금 ${balanceAmount.toLocaleString()}원을 결제해주세요.`,
          relatedId: orderId,
        });

        // 푸시 알림 (의뢰인)
        sendPushToUser(order.requesterId, {
          title: "마감 승인",
          body: `${order.companyName} 오더 마감이 승인되었습니다. 잔금 ${balanceAmount.toLocaleString()}원을 결제해주세요.`,
          url: "/requester-home",
          tag: `closing-approved-requester-${orderId}`,
        });

        // SMS: 마감 승인 → 잔금 결제 안내
        const closingRequester = await storage.getUser(order.requesterId);
        if (closingRequester?.phoneNumber) {
          try {
            await smsService.sendCustomMessage(closingRequester.phoneNumber,
              `[헬프미] ${order.companyName} 오더 마감 승인. 잔금 ${balanceAmount.toLocaleString()}원을 앱에서 결제해주세요.`);
          } catch (smsErr) { console.error("[SMS Error] closing-approved requester:", smsErr); }
        }
      }

      // 7. 헬퍼 알림
      if (order.matchedHelperId) {
        await storage.createNotification({
          userId: order.matchedHelperId,
          type: "closing_approved",
          title: "마감 승인 완료",
          message: `${order.companyName} 오더 마감이 승인되었습니다. 지급 예정액: ${driverPayout.toLocaleString()}원`,
          relatedId: orderId,
        });

        sendPushToUser(order.matchedHelperId, {
          title: "마감 승인 완료",
          body: `${order.companyName} 오더 마감 승인. 지급 예정: ${driverPayout.toLocaleString()}원`,
          url: "/helper-home",
          tag: `closing-approved-helper-${orderId}`,
        });
      }

      res.json({
        success: true,
        closingReportId: closingReport.id,
        finalTotal,
        platformFee,
        damageDeduction: Number(damageDeduction) || 0,
        driverPayout,
        balanceAmount,
        status: "approved",
      });
    } catch (err: any) {
      console.error("Approve closing error:", err);
      res.status(500).json({ message: "마감 승인에 실패했습니다" });
    }
  });

  // POST /api/admin/orders/:orderId/settlement/execute - 정산 실행 (플랫폼 수수료 차감 후 기사 지급액 산출)
  app.post("/api/admin/orders/:orderId/settlement/execute", adminAuth, requirePermission("settlements.manage"), async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const adminUser = req.user!;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      if (order.status !== "balance_paid") {
        return res.status(400).json({ message: `현재 상태(${order.status})에서는 정산을 실행할 수 없습니다. 잔금 결제 완료(balance_paid) 후 진행해주세요.` });
      }

      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      if (!closingReport) {
        return res.status(404).json({ message: "마감 보고서를 찾을 수 없습니다" });
      }

      const contracts = await storage.getOrderContracts(orderId);
      const contract = contracts.find(c => c.helperId === closingReport.helperId);

      // SSOT: 마감 시점 스냅샷이 있으면 우선 사용, 없으면 재계산
      let amounts: {
        baseSupply: number;
        urgentFeeSupply: number;
        extraSupply: number;
        finalSupply: number;
        vat: number;
        finalTotal: number;
        platformFee: number;
        driverPayout: number;
      };
      let policy: { platformBaseOn: "TOTAL" | "SUPPLY"; platformRatePercent: number };

      if (closingReport.supplyAmount && closingReport.totalAmount && closingReport.netAmount) {
        // 스냅샷 값 사용 (SSOT)
        console.log(`[Settlement Execute] Using snapshot values for order ${orderId}`);
        amounts = {
          baseSupply: closingReport.supplyAmount,
          urgentFeeSupply: 0,
          extraSupply: 0,
          finalSupply: closingReport.supplyAmount,
          vat: closingReport.vatAmount || 0,
          finalTotal: closingReport.totalAmount,
          platformFee: closingReport.platformFee || 0,
          driverPayout: closingReport.netAmount,
        };
        policy = {
          platformBaseOn: "SUPPLY",
          platformRatePercent: (closingReport.platformFeeRate || 300) / 100, // bps to percent
        };
      } else {
        // 스냅샷 없음 - 기존 방식으로 재계산 (레거시 호환)
        console.log(`[Settlement Execute] No snapshot, recalculating for order ${orderId}`);
        const { calculateAndSaveSettlement, getPolicySnapshotForOrder, calculateSettlementAmounts } = await import("../../lib/settlement-calculator");

        const snapshot = await getPolicySnapshotForOrder(orderId);
        const extraCosts = closingReport.extraCostsJson ? JSON.parse(closingReport.extraCostsJson) : [];
        const extraCostItems = extraCosts.map((cost: any) => ({
          costCode: cost.costCode || "CUSTOM",
          qty: cost.qty || 1,
          unitPriceSupply: cost.amount || cost.unitPriceSupply || 0,
          memo: cost.memo,
        }));

        const snapshotAny = snapshot as any;
        policy = {
          platformBaseOn: (snapshotAny?.platformFee?.baseOn as "TOTAL" | "SUPPLY") || "TOTAL",
          platformRatePercent: snapshotAny?.platformFee?.ratePercent || 10,
        };
        const fullPolicy = {
          unitPriceSupply: snapshotAny?.carrierPricing?.unitPriceSupply || order.pricePerUnit || 0,
          minChargeSupply: snapshotAny?.carrierPricing?.minChargeSupply,
          urgentApplyType: snapshotAny?.urgentFee?.applyType,
          urgentValue: snapshotAny?.urgentFee?.value,
          urgentMaxFee: snapshotAny?.urgentFee?.maxUrgentFeeSupply,
          platformBaseOn: policy.platformBaseOn,
          platformRatePercent: policy.platformRatePercent,
          platformMinFee: snapshotAny?.platformFee?.minFee,
          platformMaxFee: snapshotAny?.platformFee?.maxFee,
        };

        amounts = calculateSettlementAmounts({
          deliveredCount: closingReport.deliveredCount || 0,
          returnedCount: closingReport.returnedCount || 0,
          otherCount: 0,
          extraCostItems,
          isUrgent: order.isUrgent ?? false,
        }, fullPolicy);
      }

      // 중복 방지: 기존 settlement_records 있으면 업데이트, 없으면 생성
      const existingRecord = await db.select()
        .from(settlementRecords)
        .where(eq(settlementRecords.orderId, orderId))
        .limit(1);

      let record;
      if (existingRecord.length > 0) {
        // 기존 레코드 업데이트
        const [updated] = await db.update(settlementRecords)
          .set({
            helperId: closingReport.helperId,
            baseSupply: amounts.baseSupply,
            urgentFeeSupply: amounts.urgentFeeSupply,
            extraSupply: amounts.extraSupply,
            finalSupply: amounts.finalSupply,
            vat: amounts.vat,
            finalTotal: amounts.finalTotal,
            platformFeeBaseOn: policy.platformBaseOn,
            platformFeeRate: policy.platformRatePercent,
            platformFee: amounts.platformFee,
            driverPayout: amounts.driverPayout,
            status: "APPROVED",
            updatedAt: new Date(),
          })
          .where(eq(settlementRecords.orderId, orderId))
          .returning();
        record = updated;
        console.log(`[Settlement Execute] Updated existing record for order ${orderId}`);
      } else {
        // 새 레코드 생성
        const [created] = await db.insert(settlementRecords).values({
          orderId,
          helperId: closingReport.helperId,
          closingReportId: closingReport.id,
          contractId: contract?.id ?? null,
          baseSupply: amounts.baseSupply,
          urgentFeeSupply: amounts.urgentFeeSupply,
          extraSupply: amounts.extraSupply,
          finalSupply: amounts.finalSupply,
          vat: amounts.vat,
          finalTotal: amounts.finalTotal,
          platformFeeBaseOn: policy.platformBaseOn,
          platformFeeRate: policy.platformRatePercent,
          platformFee: amounts.platformFee,
          driverPayout: amounts.driverPayout,
          status: "APPROVED",
        }).returning();
        record = created;
      }

      await db.insert(settlementAuditLogs).values({
        settlementId: record.id,
        actionType: "approved",
        newValue: JSON.stringify({ status: "APPROVED", amounts }),
        changedFields: JSON.stringify((amounts as any).breakdown),
        reason: "정산 실행 승인",
        actorId: adminUser.id,
        actorRole: "admin",
      });

      await storage.updateOrder(orderId, { status: "settlement_paid" });

      if (closingReport.helperId) {
        await storage.createNotification({
          userId: closingReport.helperId,
          type: "settlement_complete",
          title: "정산 완료",
          message: `정산이 완료되었습니다. 지급액: ${amounts.driverPayout.toLocaleString()}원`,
          relatedId: orderId,
        });
      }

      res.json({
        success: true,
        settlement: {
          id: record.id,
          baseSupply: amounts.baseSupply,
          urgentFeeSupply: amounts.urgentFeeSupply,
          extraSupply: amounts.extraSupply,
          finalSupply: amounts.finalSupply,
          vat: amounts.vat,
          finalTotal: amounts.finalTotal,
          platformFee: amounts.platformFee,
          driverPayout: amounts.driverPayout,
          status: "APPROVED",
        },
        breakdown: (amounts as any).breakdown,
      });
    } catch (err: any) {
      console.error("Execute settlement error:", err);
      res.status(500).json({ message: "정산 실행에 실패했습니다" });
    }
  });

  // GET /api/admin/orders/:orderId/evidence - 종합 증빙 조회 (관리자 탭용)
  app.get("/api/admin/orders/:orderId/evidence", adminAuth, requirePermission("orders.view"), async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);

      // Get closing report
      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      const deliveryHistoryImages = closingReport?.deliveryHistoryImagesJson
        ? JSON.parse(closingReport.deliveryHistoryImagesJson)
        : [];
      const etcImages = closingReport?.etcImagesJson
        ? JSON.parse(closingReport.etcImagesJson)
        : [];
      const closingMemo = closingReport?.memo || '';

      // Get QR events (qrVerifications table not in schema yet)
      const qrEvents: any[] = [];

      // Get helper names for QR events
      const qrEventsWithNames = await Promise.all(qrEvents.map(async (event) => {
        if (!event.helperId) return { ...event, helperName: '알 수 없음' };
        const helper = await storage.getUser(event.helperId);
        return {
          type: event.type === 'used' ? 'start' : event.type,
          timestamp: event.timestamp?.toISOString() || '',
          helperName: helper?.name || '알 수 없음',
        };
      }));

      // Get incident reports with evidence
      const incidents = await storage.getIncidentReportsByOrder(orderId);
      const incidentEvidence = incidents.flatMap(incident => {
        const evidence: any[] = [];
        if (incident.attachedImagesJson) {
          const images = JSON.parse(incident.attachedImagesJson);
          images.forEach((img: string, idx: number) => {
            evidence.push({
              id: incident.id * 100 + idx,
              type: incident.type,
              imageUrl: img,
              uploadedAt: incident.createdAt?.toISOString() || '',
            });
          });
        }
        return evidence;
      });

      res.json({
        deliveryHistoryImages,
        etcImages,
        closingMemo,
        qrEvents: qrEventsWithNames,
        incidentEvidence,
      });
    } catch (err: any) {
      console.error("Get order evidence error:", err);
      res.status(500).json({ message: "증빙 조회에 실패했습니다" });
    }
  });

}

