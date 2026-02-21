/**
 * Orders, contracts, and workflow routes
 *
 * Order CRUD, applications, closing reports, balance payments,
 * incidents, disputes, settlements, work confirmations, QR checkin,
 * requester orders, helper orders, contract management
 */

import type { RouteContext } from "./types";
import { z } from "zod";
import { api } from "@shared/routes";
import {
  orders,
  orderApplications,
  users,
  contracts,
  closingReports,
  closingFieldSettings,
  orderStartTokens,
  incidentReports,
  incidentEvidence,
  disputes,
  orderStatusEvents,
  auditLogs,
  incidentActions,
  settlementRecords,
} from "@shared/schema";
import {
  calculateSettlement,
  calculateHelperPayout,
  parseClosingReport,
  calculateVat
} from "../lib/settlement-calculator";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
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
} from "../constants/order-status";
import { withTransaction } from "../utils/transactions";

export async function registerOrderRoutes(ctx: RouteContext): Promise<void> {
  const {
    app,
    requireAuth,
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
    ORDER_STATUS: ORDER_STATUS_CTX,
    canTransitionOrderStatus,
    validateOrderStatus,
    objectStorageService,
    getOrderDepositInfo,
    getDepositRate,
    getOrCreatePersonalCode,
    encrypt,
    decrypt,
    hashForSearch,
    maskAccountNumber,
    smsService,
    popbill,
    JWT_SECRET,
    logAdminAction,
    getIdempotencyKeyFromRequest,
    checkIdempotency,
    storeIdempotencyResponse,
  } = ctx;

  type AuthenticatedRequest = any;

  // ============================================
  // Orders List & Application APIs (오더 목록/지원)
  // ============================================

  // GET /api/helper/orders/open - 헬퍼용 공개 오더 목록 (T-04 스펙)
  app.get("/api/helper/orders/open", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ code: "FORBIDDEN", message: "헬퍼만 접근 가능합니다" });
      }

      const { page = "1", limit = "20", region2 } = req.query;
      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const offset = (pageNum - 1) * limitNum;

      // OPEN 상태 오더만 조회 (표준 상태 사용)
      let orders = await storage.getAllOrders();
      orders = orders.filter(o => (o.status ?? "").toLowerCase() === "open");

      // 지역 필터
      if (region2) {
        orders = orders.filter(o => o.deliveryArea?.includes(region2 as string));
      }

      // 후보 수 + 신청 수 조회 및 헬퍼 지원 상태 조회
      const orderIds = orders.map(o => o.id);
      const candidateCounts = await storage.getOrderCandidateCounts(orderIds);
      const applicationCounts = await storage.getOrderApplicationCounts(orderIds);
      const helperStatuses = await storage.getHelperCandidateStatuses(user.id, orderIds);
      const helperAppStatuses = await storage.getHelperApplicationStatuses(user.id, orderIds);

      // 총 지원자 수 합산 (candidates + applications)
      const getTotalApplicants = (orderId: number) => {
        return Math.max(candidateCounts.get(orderId) || 0, applicationCounts.get(orderId) || 0);
      };

      // 3명 이상 후보가 찬 오더 필터링 (이미 지원한 오더는 표시)
      const filteredOrders = orders.filter(o => {
        const totalCount = getTotalApplicants(o.id);
        const myStatus = helperStatuses.get(o.id) || helperAppStatuses.get(o.id);
        if (myStatus) return true;
        if (totalCount >= 3) return false;
        return true;
      });

      const totalCount = filteredOrders.length;
      const paginatedOrders = filteredOrders.slice(offset, offset + limitNum);

      const items = paginatedOrders.map(o => ({
        id: `o_${o.id}`,
        status: (o.status ?? "").toUpperCase(),
        boxCount: parseInt(o.averageQuantity ?? "0") || 0,
        unitPrice: o.pricePerUnit ?? 0,
        totalAmount: (parseInt(o.averageQuantity ?? "0") || 0) * (o.pricePerUnit ?? 0),
        region2: o.deliveryArea ?? "",
        schedule: {
          startAt: o.scheduledDate || o.createdAt,
          endAt: o.scheduledDateEnd || o.scheduledDate || o.createdAt,
        },
        activeCandidates: getTotalApplicants(o.id),
        myCandidateStatus: helperStatuses.get(o.id) || helperAppStatuses.get(o.id) || null,
      }));

      res.json({ items, page: pageNum, limit: limitNum, totalCount });
    } catch (err: any) {
      console.error("Get helper open orders error:", err);
      res.status(500).json({ code: "SERVER_ERROR", message: "Internal server error" });
    }
  });

  // GET /api/orders - 헬퍼용 오더 목록 (등록됨/매칭중/예정중 상태만)
  app.get("/api/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, category, page, limit } = req.query;
      const user = req.user!;

      // 헬퍼만 접근 가능
      if (user.role !== "helper" && !user.isHqStaff) {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * limitNum;

      let orders = await storage.getAllOrders(status as string | undefined);

      // 헬퍼에게 보여줄 상태만 필터링 (open, scheduled - 표준 상태)
      if (!user.isHqStaff) {
        orders = orders.filter(o => ["open", "scheduled"].includes(o.status ?? ""));
      }

      // 카테고리 필터 (order.courierCategory 직접 사용)
      if (category && category !== "전체") {
        const categoryCodeMap: Record<string, string> = {
          '택배사': 'parcel',
          '기타택배': 'other',
          '냉잡전용': 'cold',
        };
        const categoryCode = categoryCodeMap[category as string] || category;
        orders = orders.filter(o => (o.courierCategory || 'parcel') === categoryCode);
      }

      // 후보 수 + 신청 수 조회 및 헬퍼 지원 상태 조회 (효율적인 배치 쿼리)
      const orderIds = orders.map(o => o.id);
      const candidateCounts = await storage.getOrderCandidateCounts(orderIds);
      const applicationCounts = await storage.getOrderApplicationCounts(orderIds);
      const helperStatuses = await storage.getHelperCandidateStatuses(user.id, orderIds);
      const helperAppStatuses = await storage.getHelperApplicationStatuses(user.id, orderIds);

      // 총 지원자 수 합산
      const getTotalApplicants = (orderId: number) => {
        return Math.max(candidateCounts.get(orderId) || 0, applicationCounts.get(orderId) || 0);
      };

      // 3명 이상 지원자가 찬 오더 필터링 (이미 지원한 오더는 제외하지 않음)
      const filteredOrders = orders.filter(o => {
        const totalCount = getTotalApplicants(o.id);
        const myStatus = helperStatuses.get(o.id) || helperAppStatuses.get(o.id);

        // 이미 지원한 오더는 표시
        if (myStatus) return true;

        // 3명 이상이면 숨김
        if (totalCount >= 3) return false;

        return true;
      });

      // Pagination
      const totalCount = filteredOrders.length;
      const paginatedOrders = filteredOrders.slice(offset, offset + limitNum);

      // 각 오더에 지원자 수와 내 지원 상태 추가
      const items = paginatedOrders.map(o => ({
        ...o,
        activeCandidates: getTotalApplicants(o.id),
        myCandidateStatus: helperStatuses.get(o.id) || helperAppStatuses.get(o.id) || null,
      }));

      // Return paginated response
      res.json({
        items,
        totalCount,
        page: pageNum,
        limit: limitNum,
        hasMore: offset + limitNum < totalCount
      });
    } catch (err: any) {
      console.error("Get orders error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/orders/:id - 오더 상세 조회 (숫자 ID만 매칭)
  app.get("/api/orders/:id(\\d+)", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      res.json(order);
    } catch (err: any) {
      console.error("Get order detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/orders/:id/applications - 헬퍼 오더 지원
  app.post("/api/orders/:id/applications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 지원할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 지원 가능 상태 확인 (open만 허용 - 표준)
      const applyOrderStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(applyOrderStatus, CAN_APPLY_STATUSES)) {
        return res.status(400).json({ message: "지원할 수 없는 상태입니다" });
      }

      // 중복 지원 확인
      const existingApplications = await storage.getOrderApplications(orderId);
      const alreadyApplied = existingApplications.some(a => a.helperId === userId);
      if (alreadyApplied) {
        return res.status(400).json({ message: "이미 지원한 오더입니다" });
      }

      // A안: 3명 제한 체크 (활성 지원자만 카운트)
      const MAX_APPLICANTS = 3;
      const activeApplications = existingApplications.filter(a =>
        a.status === "applied" || a.status === "selected"
      );
      if (activeApplications.length >= MAX_APPLICANTS) {
        return res.status(409).json({
          code: "MAX_APPLICANTS_REACHED",
          message: "지원자 모집이 완료되었습니다 (최대 3명)",
          applicantCount: activeApplications.length
        });
      }

      const { message: applyMessage, expectedArrival } = req.body;
      const application = await storage.createOrderApplication({
        orderId,
        helperId: userId,
        status: "applied",
        message: applyMessage || null,
        expectedArrival: expectedArrival || null,
      });

      // 지원 시 상태 변경 없음 (open 유지) - 지원자 수는 candidates 테이블로 관리

      // 요청자에게 알림 + 푸시 전송 (알림 실패해도 지원 처리에 영향 없도록 try-catch)
      try {
        if (order.requesterId) {
          const currentCount = activeApplications.length + 1;
          await storage.createNotification({
            userId: order.requesterId,
            type: "helper_applied",
            title: "새로운 지원자",
            message: `${user.name || "헬퍼"}님이 오더에 지원했습니다. (${currentCount}/3)`,
            relatedId: orderId,
          });

          // 푸시 알림 발송
          sendPushToUser(order.requesterId, {
            title: "새로운 지원자",
            body: `${user.name || "헬퍼"}님이 ${order.companyName || ''} 오더에 지원했습니다. (${currentCount}/3)`,
            url: `/orders/${orderId}/applicants`,
            tag: `application-${orderId}`,
          });
        }
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send apply notification for order ${orderId}:`, notificationErr);
      }

      res.status(201).json(application);
    } catch (err: any) {
      console.error("Apply to order error:", err);
      res.status(500).json({ message: "지원에 실패했습니다" });
    }
  });

  // GET /api/orders/my-applications - 헬퍼 본인 지원 내역 (오더 정보 포함)
  app.get("/api/orders/my-applications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const applications = await storage.getHelperApplications(userId);

      // 각 지원에 오더 상세 정보 포함
      const applicationsWithOrders = await Promise.all(
        applications.map(async (app) => {
          const order = await storage.getOrder(app.orderId);
          return {
            ...app,
            order: order || null,
          };
        })
      );

      res.json(applicationsWithOrders);
    } catch (err: any) {
      console.error("Get my applications error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/orders/:id/closing-report - 마감자료 조회
  app.get("/api/orders/:id/closing-report", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      const user = req.user!;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인: 요청자, 헬퍼, 관리자만 조회 가능
      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const [report] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      if (!report) {
        return res.json(null);
      }

      res.json(report);
    } catch (err: any) {
      console.error("Get closing report error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/orders/:id/closing-report - 헬퍼 마감자료 제출 (E2E-07 핵심)
  // GET /api/closing-fields - 마감 필드 설정 조회 (모바일 앱용)
  app.get("/api/closing-fields", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const role = user.role;

      const allFields = await db.select().from(closingFieldSettings)
        .where(eq(closingFieldSettings.isActive, true))
        .orderBy(closingFieldSettings.sortOrder);

      // Filter by target role
      const fields = allFields.filter(f =>
        f.targetRole === 'both' || f.targetRole === role
      );

      res.json(fields);
    } catch (err: any) {
      console.error("Get closing fields error:", err);
      res.status(500).json({ message: "마감 필드를 불러오는데 실패했습니다" });
    }
  });

  // POST /api/orders/:id/close - 헬퍼 마감 제출 (집배송 이력 이미지 필수)
  app.post("/api/orders/:orderId/close", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const user = req.user!;

      // Idempotency check
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, cachedResponse } = await checkIdempotency(
          user.id,
          `POST:/api/orders/${orderId}/close`,
          idempotencyKey
        );
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached close for order ${orderId}, key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      if (user.role !== "helper") {
        return res.status(403).json({ code: "FORBIDDEN", message: "헬퍼만 마감을 제출할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" });
      }

      if (order.matchedHelperId !== user.id) {
        return res.status(403).json({ code: "NOT_ASSIGNED", message: "배정된 헬퍼만 마감을 제출할 수 있습니다" });
      }

      // 업무중 상태에서만 마감 제출 가능 (in_progress만 허용 - 표준)
      const orderStatusForClose = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(orderStatusForClose, CAN_SUBMIT_CLOSING_STATUSES)) {
        return res.status(400).json({
          code: "INVALID_STATUS",
          message: `현재 상태(${order.status})에서는 마감을 제출할 수 없습니다. 업무중 상태에서만 가능합니다.`
        });
      }

      const { text, deliveryHistoryImages, etcImages, deliveredCount, returnedCount, etcCount, extraCosts, memo, dynamicFields } = req.body;

      // 배송 수량은 필수
      if (deliveredCount === undefined || deliveredCount === null || parseInt(deliveredCount) < 0) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "배송 수량을 입력해주세요" });
      }

      // 텍스트는 선택사항
      if (text && text.length > 2000) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "마감 내용은 2000자 이하로 입력해주세요" });
      }

      if (!deliveryHistoryImages || !Array.isArray(deliveryHistoryImages) || deliveryHistoryImages.length === 0) {
        return res.status(400).json({
          code: "DELIVERY_HISTORY_REQUIRED",
          message: "집배송 이력 화면 캡쳐 또는 사진이 반드시 필요합니다.\n분쟁 방지를 위한 필수 자료입니다."
        });
      }

      // 중복 마감보고서 제출 방지
      const [existingClosing] = await db.select({ id: closingReports.id })
        .from(closingReports)
        .where(and(
          eq(closingReports.orderId, orderId),
          eq(closingReports.helperId, user.id)
        ))
        .limit(1);
      if (existingClosing) {
        return res.status(409).json({ code: "DUPLICATE", message: "이미 마감보고서가 제출되었습니다" });
      }

      const orderContracts = await storage.getOrderContracts(orderId);
      const contract = orderContracts.find(c => c.helperId === user.id);

      // 통합 계산 모듈 사용 (Single Source of Truth)
      const parsedDeliveredCount = parseInt(deliveredCount) || 0;
      const parsedReturnedCount = parseInt(returnedCount) || 0;
      const parsedEtcCount = parseInt(etcCount) || 0;

      // 택배사 설정 1번만 조회 (기타 단가 + 수수료율 공용)
      const courierSetting = await storage.getCourierSettingByName(order.companyName || "")
        || (order.courierCompany ? await storage.getCourierSettingByName(order.courierCompany) : undefined);

      // 기타 단가: 택배사 설정에서 가져오기
      const etcPricePerUnitValue = (parsedEtcCount > 0 && courierSetting?.etcPricePerBox) ? courierSetting.etcPricePerBox : 0;

      // 통합 계산 함수 사용
      const closingData = {
        deliveredCount: parsedDeliveredCount,
        returnedCount: parsedReturnedCount,
        etcCount: parsedEtcCount,
        unitPrice: order.pricePerUnit ?? 0,
        etcPricePerUnit: etcPricePerUnitValue,
        extraCosts: extraCosts || [],
      };
      const settlement = calculateSettlement(closingData);
      const calculatedAmount = settlement.totalAmount;

      // 헬퍼 수수료율 결정: 매칭 스냅샷 > 헬퍼별 실효 수수료율 > 택배사 운임설정 > 기본값
      const [helperApp] = await db.select().from(orderApplications)
        .where(and(
          eq(orderApplications.orderId, orderId),
          eq(orderApplications.helperId, user.id)
        ))
        .limit(1);

      let helperCommissionRate: number;
      if (helperApp?.snapshotCommissionRate != null) {
        helperCommissionRate = helperApp.snapshotCommissionRate; // 매칭 시 스냅샷 (%)
      } else {
        const effectiveRate = await storage.getEffectiveCommissionRate(user.id);
        helperCommissionRate = effectiveRate.rate; // 현재 실효 수수료율 (%)
      }

      const snapshotFeeRate = helperCommissionRate * 100; // bps로 변환 (% * 100)
      const snapshotPlatformFee = Math.round(settlement.totalAmount * helperCommissionRate / 100);
      const snapshotNetAmount = settlement.totalAmount - snapshotPlatformFee;

      // 정책 스냅샷 저장
      const pricingSnapshot = {
        unitPrice: order.pricePerUnit,
        etcPricePerUnit: etcPricePerUnitValue,
        platformFeeRate: snapshotFeeRate,
        courierCategory: order.courierCategory || "standard",
        capturedAt: new Date().toISOString(),
      };

      // === 트랜잭션: 마감보고서 + 상태변경 + 계약업데이트 원자성 보장 ===
      const closingReport = await withTransaction(async (tx) => {
        const report = await tx.insert(closingReports).values({
          orderId,
          helperId: user.id,
          contractId: contract?.id || null,
          deliveredCount: parsedDeliveredCount,
          etcCount: parsedEtcCount,
          etcPricePerUnit: etcPricePerUnitValue,
          returnedCount: parsedReturnedCount,
          extraCostsJson: extraCosts ? JSON.stringify(extraCosts) : null,
          memo: memo || text?.trim() || null,
          status: "submitted",
          calculatedAmount,
          supplyAmount: settlement.supplyAmount,
          vatAmount: settlement.vatAmount,
          totalAmount: settlement.totalAmount,
          platformFeeRate: snapshotFeeRate,
          platformFee: snapshotPlatformFee,
          netAmount: snapshotNetAmount,
          pricingSnapshotJson: JSON.stringify(pricingSnapshot),
          deliveryHistoryImagesJson: JSON.stringify(deliveryHistoryImages),
          etcImagesJson: etcImages ? JSON.stringify(etcImages) : null,
          dynamicFieldsJson: dynamicFields ? JSON.stringify(dynamicFields) : null,
        }).returning();

        await tx.update(orders)
          .set({ status: "closing_submitted", updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        // T-07: 계약이 있으면 최종금액/잔금 업데이트
        if (contract) {
          const downPaymentAmount = contract.depositAmount || contract.downPaymentAmount || 0;
          const txBalanceAmount = Math.max(0, calculatedAmount - downPaymentAmount);

          await tx.update(contracts)
            .set({
              finalAmount: calculatedAmount,
              balanceAmount: txBalanceAmount,
              calculatedBalanceAmount: txBalanceAmount,
              closingReportId: report[0].id,
            })
            .where(eq(contracts.id, contract.id));
        }

        return report;
      });

      // 알림 발송 (알림 실패해도 마감 처리에 영향 없도록 try-catch)
      try {
        if (order.requesterId) {
          await storage.createNotification({
            userId: order.requesterId,
            type: "matching_success",
            title: "마감 제출",
            message: `${user.name || "헬퍼"}님이 마감을 제출했습니다. 확인해주세요.`,
            relatedId: orderId,
          });

          // 푸시 알림 발송
          sendPushToUser(order.requesterId, {
            title: "마감 제출",
            body: `${user.name || "헬퍼"}님이 마감을 제출했습니다. 확인해주세요.`,
            url: `/closing/${orderId}`,
            tag: `closing-submitted-${orderId}`,
          });
        }
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send closing notification for order ${orderId}:`, notificationErr);
      }

      // 예상 정산금 계산 (snapshotCommissionRate 사용)
      const application = await db.select().from(orderApplications)
        .where(and(
          eq(orderApplications.orderId, orderId),
          eq(orderApplications.helperId, user.id)
        ))
        .limit(1);
      const platformFeeRate = application[0]?.snapshotCommissionRate ?? order.snapshotCommissionRate ?? 3;
      const estimatedPlatformFee = Math.round(calculatedAmount * (platformFeeRate / 100));
      const estimatedPayout = calculatedAmount - estimatedPlatformFee;

      // === 정산(Settlement) 자동 생성 ===
      try {
        const existingSettlement = await storage.getSettlementStatementByOrder(orderId);
        if (existingSettlement) {
          console.log(`[Settlement] Already exists for order ${orderId}, skipping creation`);
        } else {
          // 수수료율 조회 (우선순위: 신청 스냅샷 > 오더 스냅샷 > 현재 정책)
          let totalCommissionRate: number;
          let settlePlatformRate: number;
          let settleTeamLeaderRate: number;
          let settleRateSource: string;
          let settleTeamLeaderId: string | null = null;

          if (application[0]?.snapshotCommissionRate != null &&
            application[0]?.snapshotPlatformRate != null &&
            application[0]?.snapshotTeamLeaderRate != null) {
            totalCommissionRate = application[0].snapshotCommissionRate;
            settlePlatformRate = application[0].snapshotPlatformRate;
            settleTeamLeaderRate = application[0].snapshotTeamLeaderRate;
            settleTeamLeaderId = application[0].snapshotTeamLeaderId;
            settleRateSource = application[0].snapshotSource || "application_snapshot";
          } else if (order.snapshotCommissionRate != null &&
            order.snapshotPlatformRate != null &&
            order.snapshotTeamLeaderRate != null) {
            totalCommissionRate = order.snapshotCommissionRate;
            settlePlatformRate = order.snapshotPlatformRate;
            settleTeamLeaderRate = order.snapshotTeamLeaderRate;
            settleRateSource = "order_snapshot";
            const teamMember = await storage.getTeamMemberByUserId(user.id);
            if (teamMember) {
              const team = await storage.getTeamById(teamMember.teamId);
              settleTeamLeaderId = team?.leaderId || null;
            }
          } else {
            const effectiveRate = await storage.getEffectiveCommissionRate(user.id);
            totalCommissionRate = effectiveRate.rate;
            settlePlatformRate = effectiveRate.platformRate;
            settleTeamLeaderRate = effectiveRate.teamLeaderRate;
            settleRateSource = effectiveRate.source;
            settleTeamLeaderId = effectiveRate.teamLeaderId;
          }

          console.log(`[Settlement] Total: ${totalCommissionRate}% (Platform: ${settlePlatformRate}%, TeamLeader: ${settleTeamLeaderRate}%), Source: ${settleRateSource}`);

          // 박스수 = 배송 + 반품 + 기타
          const totalBoxCount = parsedDeliveredCount + parsedReturnedCount + parsedEtcCount;

          // 공급가액 = 단가 × 박스수
          const settleSupplyAmount = totalBoxCount * (order.pricePerUnit ?? 0);

          // 부가세 = 공급가액 × 10%
          const settleVatAmount = calculateVat(settleSupplyAmount);

          // 총합계금 = 공급가액 + 부가세
          const totalAmountWithVat = settleSupplyAmount + settleVatAmount;

          // 수수료 계산
          const totalCommissionAmount = Math.round(totalAmountWithVat * totalCommissionRate / 100);
          const platformCommission = Math.round(totalAmountWithVat * settlePlatformRate / 100);
          const teamLeaderIncentive = Math.round(totalAmountWithVat * settleTeamLeaderRate / 100);

          // 기사 수령액 = 총합계금 - 총 수수료
          const netPayout = totalAmountWithVat - totalCommissionAmount;

          // 근무일: scheduledDate(ISO) > 오늘 날짜
          let workDateStr = new Date().toISOString().split('T')[0];
          if (order.scheduledDate) {
            const parsed = new Date(order.scheduledDate);
            if (!isNaN(parsed.getTime())) {
              workDateStr = parsed.toISOString().split('T')[0];
            }
          }

          await storage.createSettlementStatement({
            orderId,
            helperId: user.id,
            requesterId: order.requesterId || null,
            workDate: workDateStr,
            deliveryCount: parsedDeliveredCount,
            returnCount: parsedReturnedCount,
            pickupCount: 0,
            otherCount: parsedEtcCount,
            basePay: settleSupplyAmount,
            additionalPay: 0,
            penalty: 0,
            deduction: 0,
            commissionRate: totalCommissionRate,
            commissionAmount: totalCommissionAmount,
            platformCommission,
            teamLeaderIncentive,
            teamLeaderId: settleTeamLeaderId,
            supplyAmount: settleSupplyAmount,
            vatAmount: settleVatAmount,
            totalAmount: totalAmountWithVat,
            netAmount: netPayout,
            status: "pending",
          });
          console.log(`[Settlement Created] Order ${orderId}, Helper ${user.id}, Source: ${settleRateSource}, Rate: ${totalCommissionRate}%, Total: ${totalAmountWithVat}원, Commission: ${totalCommissionAmount}원 (Platform: ${platformCommission}원, TeamLeader: ${teamLeaderIncentive}원), Net: ${netPayout}원`);
        }
      } catch (settlementErr) {
        console.error(`[Settlement Error] Failed to create settlement for order ${orderId}:`, settlementErr);
        // 정산 생성 실패해도 마감 제출은 정상 처리
      }

      const depositAmount = contract?.depositAmount || contract?.downPaymentAmount || 0;
      const balanceAmount = Math.max(0, calculatedAmount - depositAmount);

      const closeResponse = {
        success: true,
        closingReportId: closingReport[0].id,
        calculatedAmount,
        depositAmount,
        balanceAmount,
        platformFeeRate,
        estimatedPlatformFee,
        estimatedPayout,
      };

      // Store idempotency response
      if (idempotencyKey) {
        await storeIdempotencyResponse(user.id, `POST:/api/orders/${orderId}/close`, idempotencyKey, 201, closeResponse);
      }

      res.status(201).json(closeResponse);
    } catch (err: any) {
      console.error("Submit closing error:", err);
      res.status(500).json({ code: "SERVER_ERROR", message: "마감 제출에 실패했습니다", detail: err?.message || String(err) });
    }
  });
  // POST /api/upload/closing-image - 마감 이미지 업로드
  const closingImagesDir = path.join(process.cwd(), "uploads", "closing");

  if (!fs.existsSync(closingImagesDir)) {
    fs.mkdirSync(closingImagesDir, { recursive: true });
  }
  const uploadClosingImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, closingImagesDir),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, uniqueSuffix + ext);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'];
      const allowedExtensions = /\.(jpeg|jpg|png|webp)$/i;
      const hasValidMime = allowedMimeTypes.includes(file.mimetype);
      const hasValidExt = allowedExtensions.test(file.originalname);
      if (hasValidMime || hasValidExt) cb(null, true);
      else cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, png, webp)"));
    },
  });

  app.post("/api/upload/closing-image", requireAuth, uploadClosingImage.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const file = req.file;
      const imageType = req.body.imageType || 'ETC';

      if (!file) {
        return res.status(400).json({ message: "파일이 필요합니다" });
      }

      const imageUrl = `/uploads/closing/${file.filename}`;

      res.json({
        success: true,
        fileKey: imageUrl,
        imageType,
        fileName: file.originalname,
        fileSize: file.size,
      });
    } catch (err: any) {
      console.error("Upload closing image error:", err);
      res.status(500).json({ message: "이미지 업로드에 실패했습니다" });
    }
  });

  // 범용 증빙 이미지 업로드 API
  app.post("/api/upload/evidence", requireAuth, uploadClosingImage.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "파일이 필요합니다" });
      }

      const { category, referenceId, referenceType } = req.body;

      const validCategories = ['incident', 'dispute', 'closing', 'work_proof', 'contract', 'general'];
      if (category && !validCategories.includes(category)) {
        return res.status(400).json({ message: "유효하지 않은 카테고리입니다" });
      }

      const validReferenceTypes = ['order', 'contract', 'settlement', 'incident', 'dispute', 'closing_report'];
      if (referenceType && !validReferenceTypes.includes(referenceType)) {
        return res.status(400).json({ message: "유효하지 않은 참조 유형입니다" });
      }

      const file = req.file as Express.Multer.File & { key?: string; location?: string };
      const path = file.key || file.path || file.filename;
      const url = file.location || `/uploads/${path}`;

      console.log(`[Evidence Upload] User ${userId} uploaded ${category || 'general'} image: ${path}`);

      res.json({
        success: true,
        url,
        path,
        category: category || 'general',
        referenceId: referenceId || null,
        referenceType: referenceType || null,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[Evidence Upload] Error:", err);
      res.status(500).json({ message: "파일 업로드에 실패했습니다" });
    }
  });




  // Profile image upload directory
  const profileImagesDir = path.join(process.cwd(), "uploads", "profiles");
  if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
  }

  const uploadProfileImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, profileImagesDir),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, uniqueSuffix + ext);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'];
      const allowedExtensions = /\.(jpeg|jpg|png|webp)$/i;
      const hasValidMime = allowedMimeTypes.includes(file.mimetype);
      const hasValidExt = allowedExtensions.test(file.originalname);
      if (hasValidMime || hasValidExt) cb(null, true);
      else cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, png, webp)"));
    },
  });

  // Profile image upload API
  app.post("/api/upload/profile-image", requireAuth, uploadProfileImage.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "파일이 필요합니다" });
      }

      const file = req.file as Express.Multer.File & { key?: string; location?: string };
      const filePath = file.key || file.filename;
      const url = `/uploads/profiles/${filePath}`;

      // Update user's profile image URL
      await db.update(users).set({
        profileImageUrl: url,
      }).where(eq(users.id, userId));

      console.log(`[Profile Image Upload] User ${userId} uploaded profile image: ${url}`);

      res.json({
        profileImage: url || null,

        success: true,
        url,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[Profile Image Upload] Error:", err);
      res.status(500).json({ message: "파일 업로드에 실패했습니다" });
    }
  });

  // Get user profile with image
  app.get("/api/user/profile-image", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      res.json({
        profileImageUrl: (user as any).profileImageUrl || null,
      });
    } catch (err: any) {
      console.error("[Get Profile Image] Error:", err);
      res.status(500).json({ message: "프로필 이미지 조회에 실패했습니다" });
    }
  });

  // PATCH /api/user/profile - Update user profile (avatar selection, etc.)
  app.patch("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }

      const { profileImageUrl } = req.body;

      if (profileImageUrl !== undefined) {
        // Validate avatar format if it's an avatar selection
        if (profileImageUrl && typeof profileImageUrl === 'string' && profileImageUrl.startsWith('avatar:')) {
          const validAvatars = ['avatar:delivery', 'avatar:package', 'avatar:worker', 'avatar:star', 'avatar:rocket', 'avatar:smile'];
          if (!validAvatars.includes(profileImageUrl)) {
            return res.status(400).json({ message: "유효하지 않은 아바타입니다" });
          }
        }

        await db.update(users).set({
          profileImageUrl: profileImageUrl,
        }).where(eq(users.id, userId));
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      res.json({
        success: true,
        profileImage: user.profileImageUrl || null,
      });
    } catch (err: any) {
      console.error("[Update User Profile] Error:", err);
      res.status(500).json({ message: "프로필 업데이트에 실패했습니다" });
    }
  });

  // GET /api/orders/:orderId/closing-summary - 요청자용 마감 요약 조회 (잔금 포함)
  app.get("/api/orders/:orderId/closing-summary", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const user = req.user!;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      if (!isOwner && !user.isHqStaff) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const [report] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      const orderContracts2 = await storage.getOrderContracts(orderId);
      const contract = orderContracts2[0];

      const deliveryHistoryImages = report?.deliveryHistoryImagesJson
        ? JSON.parse(report.deliveryHistoryImagesJson)
        : [];
      const etcImages = report?.etcImagesJson
        ? JSON.parse(report.etcImagesJson)
        : [];

      const paymentProvider = process.env.PAYMENT_PROVIDER || "mock";
      const isManualPayment = paymentProvider === "mock";

      // SSOT: 스냅샷 값 우선 사용, 없으면 재계산
      let deliveredCount: number, returnedCount: number, etcCount: number;
      let etcPricePerUnit: number, etcAmount: number;
      let supplyAmount: number, vatAmount: number, totalAmount: number;

      if (report?.supplyAmount && report?.totalAmount) {
        // 스냅샷 값 사용
        deliveredCount = report.deliveredCount || 0;
        returnedCount = report.returnedCount || 0;
        etcCount = report.etcCount || 0;
        etcPricePerUnit = report.etcPricePerUnit || 1800;
        etcAmount = etcCount * etcPricePerUnit;
        supplyAmount = report.supplyAmount;
        vatAmount = report.vatAmount || 0;
        totalAmount = report.totalAmount;
      } else {
        // 레거시: 재계산
        const pricePerUnit = order.pricePerUnit || 0;
        const closingData = report ? parseClosingReport(report, order) : {
          deliveredCount: 0,
          returnedCount: 0,
          etcCount: 0,
          unitPrice: pricePerUnit,
          etcPricePerUnit: 1800,
          extraCosts: [],
        };
        const settlement = calculateSettlement(closingData);

        deliveredCount = settlement.deliveredCount;
        returnedCount = settlement.returnedCount;
        etcCount = settlement.etcCount;
        etcPricePerUnit = closingData.etcPricePerUnit;
        etcAmount = settlement.etcAmount;
        supplyAmount = settlement.supplyAmount;
        vatAmount = settlement.vatAmount;
        totalAmount = settlement.totalAmount;
      }

      // 계약금은 SSOT 함수 사용, 잔금은 최종금액에서 계약금 차감
      const depositInfo = await getOrderDepositInfo(orderId);
      const depositAmount = depositInfo.depositAmount;
      const depositStatus = depositInfo.paymentStatus;
      const balanceAmount = Math.max(0, totalAmount - depositAmount);
      const balanceStatus = contract?.balancePaymentStatus || "UNPAID";

      const response: any = {
        orderId: order.orderNumber || `O-${orderId}`,
        // 프론트엔드 호환 필드명
        helperClosingText: report?.memo || null,
        closingText: report?.memo || null,
        closingStatus: report?.status || null,
        submittedAt: report?.createdAt || null,
        // 배송/반품/기타 수량
        deliveredCount: deliveredCount,
        returnedCount: returnedCount,
        etcCount: etcCount,
        etcPricePerUnit: etcPricePerUnit,
        etcAmount: etcAmount,
        // 이미지 (프론트엔드 호환)
        deliveryHistoryImages: deliveryHistoryImages,
        etcImages: etcImages,
        deliveryHistoryAttachments: deliveryHistoryImages.map((url: string) => ({
          fileKey: url,
          url: url,
        })),
        etcAttachments: etcImages.map((url: string) => ({
          fileKey: url,
          url: url,
        })),
        // 금액 정보 (배송+반품+기타 포함, 부가세 포함)
        pricePerUnit: order.pricePerUnit || 0,
        supplyAmount: supplyAmount,
        vatAmount: vatAmount,
        totalAmount: totalAmount,
        depositAmount: depositAmount,
        balanceAmount: balanceAmount,
        balanceStatus: balanceStatus,
        finalAmount: contract?.finalAmount || totalAmount,
        paymentMode: isManualPayment ? "MANUAL_TRANSFER" : "AUTO_PAYMENT",
      };

      if (isManualPayment && balanceStatus !== "PAID") {
        response.bankInfo = {
          bankName: process.env.COMPANY_BANK_NAME || "우리은행",
          account: process.env.COMPANY_BANK_ACCOUNT || "1002-xxx-xxxxxx",
          holder: process.env.COMPANY_BANK_HOLDER || "더리슨",
        };
        response.payerNameRule = `입금자명에 ${order.orderNumber || `O-${orderId}`} 포함`;
      }

      res.json(response);
    } catch (err: any) {
      console.error("Get closing summary error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/orders/:orderId/balance/notify - 입금 완료 알림 (요청자가 입금 완료했음을 관리자에게 알림)
  app.post("/api/orders/:orderId/balance/notify", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const user = req.user!;
      const { message } = req.body;

      if (user.role !== "requester") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "요청자만 입금 완료 알림을 보낼 수 있습니다" } });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" } });
      }

      if (order.requesterId !== user.id) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "본인 오더에만 입금 알림을 보낼 수 있습니다" } });
      }

      const admins = await db
        .select()
        .from(users)
        .where(inArray(users.role, ["admin", "superadmin"]))
        .limit(10);

      // 관리자 알림 (알림 실패해도 입금 알림 처리에 영향 없도록 try-catch)
      try {
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            type: "system" as any,
            title: "입금 완료 알림",
            message: `요청자(${user.name || user.email})가 오더 ${order.orderNumber || orderId}에 대해 입금 완료를 알렸습니다. ${message || ""}`,
            relatedId: orderId,
          });
        }
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send balance-notify notifications for order ${orderId}:`, notificationErr);
      }

      console.log(`[Balance Notify] Requester ${user.id} notified payment for order ${orderId}`);

      res.json({
        ok: true,
        orderId: order.orderNumber || `O-${orderId}`,
        message: "입금 알림이 관리자에게 전송되었습니다",
      });
    } catch (err: any) {
      console.error("Balance notify error:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } });
    }
  });

  // T-09: POST /api/orders/:orderId/closing/confirm - 요청자 마감 확인

  // POST /api/orders/:orderId/send-account-sms - 계좌번호 문자 전송
  app.post("/api/orders/:orderId/send-account-sms", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const user = req.user!;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" } });
      }

      // 요청자 본인만 가능
      if (order.requesterId !== user.id) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "본인 오더만 요청 가능합니다" } });
      }

      // 요청자 전화번호 조회
      const requester = await storage.getUser(user.id);
      if (!requester?.phoneNumber) {
        return res.status(400).json({ error: { code: "NO_PHONE", message: "등록된 전화번호가 없습니다" } });
      }

      // 계약 정보 조회 (잔금 금액)
      const orderContracts3 = await storage.getOrderContracts(orderId);
      const contract = orderContracts3[0];
      const balanceAmount = contract?.calculatedBalanceAmount || contract?.balanceAmount || 0;

      // 계좌번호 문자 전송
      const accountInfo = process.env.BANK_ACCOUNT_INFO || "신한은행 110-123-456789 (주)헬프미";
      const message = `[헬프미] 잔금 ${balanceAmount.toLocaleString()}원 입금 안내\n\n${accountInfo}\n\n입금 후 앱에서 입금완료 버튼을 눌러주세요.`;

      const smsResult = await smsService.sendCustomMessage(requester.phoneNumber, message);

      if (smsResult.success) {
        res.json({
          ok: true,
          message: "계좌번호가 문자로 전송되었습니다",
          accountInfo,
        });
      } else {
        res.status(500).json({ error: { code: "SMS_FAILED", message: "문자 전송에 실패했습니다" } });
      }
    } catch (err: any) {
      console.error("Send account SMS error:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } });
    }
  });
  app.post("/api/orders/:orderId/closing/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const user = req.user!;

      // 요청자 또는 관리자만 확인 가능
      if (user.role !== "requester" && !user.isHqStaff) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "요청자만 마감을 확인할 수 있습니다" } });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" } });
      }

      // 요청자 본인 확인
      if (user.role === "requester" && order.requesterId !== user.id) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "본인 오더만 확인할 수 있습니다" } });
      }

      // closing_submitted 상태에서만 확인 가능 (표준)
      const closingOrderStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(closingOrderStatus, CAN_APPROVE_CLOSING_STATUSES)) {
        return res.status(400).json({
          error: {
            code: "INVALID_STATUS",
            message: `현재 상태(${order.status})에서는 마감 확인을 할 수 없습니다. 마감 제출 상태에서만 가능합니다.`
          }
        });
      }

      // 마감 보고서 조회 (settlement_records 생성 및 상태 전환에 사용)
      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      // === 트랜잭션: 마감 확인 (오더 상태 + 이벤트 + 정산 레코드) 원자성 보장 ===
      await withTransaction(async (tx) => {
        await tx.update(orders)
          .set({ status: ORDER_STATUS.FINAL_AMOUNT_CONFIRMED, updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        await tx.insert(orderStatusEvents).values({
          orderId,
          previousStatus: ORDER_STATUS.CLOSING_SUBMITTED,
          newStatus: ORDER_STATUS.FINAL_AMOUNT_CONFIRMED,
          reason: "요청자 마감 확인",
          triggerType: "closing_confirmed",
          triggeredBy: user.id,
        });

        // settlement_records 자동 생성 (마감 보고서가 있는 경우)
        if (closingReport) {
          const [existingRecord] = await tx.select({ id: settlementRecords.id })
            .from(settlementRecords)
            .where(eq(settlementRecords.orderId, orderId))
            .limit(1);

          if (!existingRecord) {
            const unitPrice = Number(order.finalPricePerBox ?? order.pricePerUnit ?? 0);
            const closingData = parseClosingReport(closingReport, { pricePerUnit: unitPrice });
            const settlement = calculateSettlement(closingData);
            const totalBoxCount = settlement.totalBillableCount;
            const finalTotal = settlement.totalAmount;

            // 수수료율: 스냅샷 > 기본값
            const [helperApp] = await tx.select().from(orderApplications)
              .where(and(
                eq(orderApplications.orderId, orderId),
                eq(orderApplications.helperId, closingReport.helperId)
              ))
              .limit(1);
            const platformFeeRate = helperApp?.snapshotCommissionRate ?? order.snapshotCommissionRate ?? 3;
            const platformFee = Math.round(finalTotal * (platformFeeRate / 100));
            const driverPayout = finalTotal - platformFee;

            const orderContracts = await storage.getOrderContracts(orderId);
            const contract = orderContracts.find(c => c.helperId === closingReport.helperId);

            await tx.insert(settlementRecords).values({
              orderId,
              helperId: closingReport.helperId,
              closingReportId: closingReport.id,
              contractId: contract?.id ?? null,
              baseSupply: totalBoxCount * unitPrice,
              urgentFeeSupply: 0,
              extraSupply: settlement.extraCostsTotal,
              finalSupply: settlement.supplyAmount,
              vat: settlement.vatAmount,
              finalTotal,
              platformFeeBaseOn: "TOTAL",
              platformFeeRate,
              platformFee,
              damageDeduction: 0,
              driverPayout,
              status: "CALCULATED",
            });
          }
        }
      });

      // 헬퍼에게 알림 (알림 실패해도 마감 확인 처리에 영향 없도록 try-catch)
      try {
        if (order.matchedHelperId) {
          await storage.createNotification({
            userId: order.matchedHelperId,
            type: "matching_success",
            title: "마감 확인 완료",
            message: `${order.companyName} 오더의 마감이 확인되었습니다. 잔금 입금 후 정산이 진행됩니다.`,
            relatedId: orderId,
          });
        }
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send closing-confirm notification for order ${orderId}:`, notificationErr);
      }

      res.json({
        ok: true,
        orderId: order.orderNumber || `O-${orderId}`,
        status: "final_amount_confirmed",
        message: "마감이 확인되었습니다",
      });
    } catch (err: any) {
      console.error("Closing confirm error:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } });
    }
  });

  // T-10: POST /api/orders/:orderId/balance/confirm - 잔금 확인 (수동 결제용)
  app.post("/api/orders/:orderId/balance/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const user = req.user!;

      // 요청자 또는 관리자만 확인 가능
      if (user.role !== "requester" && !user.isHqStaff) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "잔금 확인 권한이 없습니다" } });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" } });
      }

      // 요청자 본인 확인 (관리자는 예외)
      if (user.role === "requester" && order.requesterId !== user.id) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "본인 오더만 확인할 수 있습니다" } });
      }

      // final_amount_confirmed 상태에서만 잔금 확인 가능 (표준 상태)
      const balanceOrderStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(balanceOrderStatus, CAN_CONFIRM_BALANCE_STATUSES)) {
        return res.status(400).json({
          error: {
            code: "INVALID_STATUS",
            message: `현재 상태(${order.status})에서는 잔금 확인을 할 수 없습니다. 마감 승인 후 잔금 확인이 가능합니다.`
          }
        });
      }

      // === 트랜잭션: 잔금 확인 (오더 + 계약 + 이벤트) 원자성 보장 ===
      await withTransaction(async (tx) => {
        // 오더 상태 변경: → balance_paid
        await tx.update(orders)
          .set({ status: ORDER_STATUS.BALANCE_PAID, updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        // 계약 잔금 상태 업데이트
        const orderContracts = await tx.select().from(contracts).where(eq(contracts.orderId, orderId));
        const contract = orderContracts[0];
        if (contract) {
          await tx.update(contracts)
            .set({
              balancePaid: true,
              balancePaidAt: new Date(),
            } as any)
            .where(eq(contracts.id, contract.id));
        }

        // 오더 상태 이벤트 기록
        await tx.insert(orderStatusEvents).values({
          orderId,
          previousStatus: order.status ?? "final_amount_confirmed",
          newStatus: "balance_paid",
          reason: user.isHqStaff ? "관리자 잔금 확인" : "요청자 잔금 확인",
          triggerType: "balance_confirmed",
          triggeredBy: user.id,
        });
      });

      // 헬퍼에게 알림 (알림 실패해도 잔금 확인 처리에 영향 없도록 try-catch)
      try {
        if (order.matchedHelperId) {
          await storage.createNotification({
            userId: order.matchedHelperId,
            type: "matching_success",
            title: "잔금 입금 확인",
            message: `${order.companyName} 오더의 잔금이 확인되었습니다. 곧 정산이 진행됩니다.`,
            relatedId: orderId,
          });
        }
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send balance-confirm notification for order ${orderId}:`, notificationErr);
      }

      res.json({
        ok: true,
        orderId: order.orderNumber || `O-${orderId}`,
        status: "balance_paid",
        message: "잔금이 확인되었습니다",
      });
    } catch (err: any) {
      console.error("Balance confirm error:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } });
    }
  });

  // POST /api/orders/:orderId/incident - 화물사고 접수 (요청자 전용)
  app.post("/api/orders/:orderId/incident", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ code: "FORBIDDEN", message: "요청자만 화물사고를 접수할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" });
      }

      if (order.requesterId !== user.id) {
        return res.status(403).json({ code: "FORBIDDEN", message: "본인 오더에만 사고를 접수할 수 있습니다" });
      }

      const { type, description, additionalInfo, trackingNumber, deliveryAddress, customerName, customerPhone, attachedImages } = req.body;

      const validTypes = ['damage', 'loss', 'misdelivery', 'delay', 'other'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "유효한 사고 유형을 선택해주세요" });
      }

      if (!description || description.trim().length < 10) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "사고 내용은 10자 이상 입력해주세요" });
      }

      if (!trackingNumber || trackingNumber.trim().length === 0) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "송장번호를 입력해주세요" });
      }

      if (!deliveryAddress || deliveryAddress.trim().length === 0) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "배송지 주소를 입력해주세요" });
      }

      if (!customerName || customerName.trim().length === 0) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "수하인 이름을 입력해주세요" });
      }

      if (!customerPhone || customerPhone.trim().length === 0) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "수하인 연락처를 입력해주세요" });
      }

      const incident = await storage.createIncidentReport({
        orderId,
        reporterId: user.id,
        reporterType: 'requester',
        requesterId: user.id,
        helperId: order.matchedHelperId || null,
        incidentDate: new Date().toISOString().split("T")[0],
        incidentType: type,
        description: description.trim(),
        trackingNumber: trackingNumber.trim(),
        deliveryAddress: deliveryAddress.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        status: "requested",
      });
      // 마감 시 첨부된 집배송 이력 이미지를 사고 증빙으로 저장
      if (Array.isArray(attachedImages) && attachedImages.length > 0) {
        for (const imageUrl of attachedImages) {
          await db.insert(incidentEvidence).values({
            incidentId: incident.id,
            evidenceType: 'delivery_history',
            fileUrl: imageUrl,
            description: '마감 시 제출된 집배송 이력 이미지 (자동 첨부)',
            uploadedBy: user.id,
          });
        }
      }

      // 헬퍼에게 알림 + 푸시 (알림 실패해도 사고 접수에 영향 없도록 try-catch)
      try {
        if (order.matchedHelperId) {
          await storage.createNotification({
            userId: order.matchedHelperId,
            type: "order_update" as any,
            title: "화물사고 접수",
            message: `${user.name || "요청자"}님이 화물사고를 접수했습니다. 확인해주세요.`,
            relatedId: orderId,
          });

          sendPushToUser(order.matchedHelperId, {
            title: "화물사고 접수",
            body: `${(order as any).companyName || ""} 오더에 화물사고가 접수되었습니다.`,
            url: `/orders/${orderId}/incident`,
            tag: `incident-${incident.id}`,
          });
        }
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send incident notification to helper for order ${orderId}:`, notificationErr);
      }

      // 관리자에게 알림 + 푸시
      try {
        const admins = await storage.getAdminUsers?.() || [];
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            type: "order_update" as any,
            title: "화물사고 접수",
            message: `${user.name || "요청자"}님이 오더 #${orderId}에 화물사고를 접수했습니다.`,
            relatedId: orderId,
          });

          sendPushToUser(admin.id, {
            title: "화물사고 접수",
            body: `${user.name || "요청자"}님이 오더 #${orderId}에 화물사고를 접수했습니다.`,
            url: `/orders/${orderId}/incident`,
            tag: `admin-incident-${incident.id}`,
          });
        }
      } catch (adminNotifErr) {
        console.error(`[Notification Error] Failed to send incident notification to admins for order ${orderId}:`, adminNotifErr);
      }

      res.status(201).json({
        success: true,
        incidentId: incident.id,
        status: "submitted",
        attachedImagesCount: Array.isArray(attachedImages) ? attachedImages.length : 0,
      });
    } catch (err: any) {
      console.error("Submit incident error:", err);
      res.status(500).json({ code: "SERVER_ERROR", message: "사고 접수에 실패했습니다" });
    }
  });

  // GET /api/incidents - 화물사고 목록 조회
  app.get("/api/incidents", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const incidents = await storage.getIncidentReportsByUser(user.id);
      res.json(incidents);
    } catch (err: any) {
      console.error("Get incidents error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/incidents/:id - 요청자 사고 상세 조회
  app.get("/api/incidents/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const incidentId = Number(req.params.id);

      const [incident] = await db.select()
        .from(incidentReports)
        .where(eq(incidentReports.id, incidentId));

      if (!incident) {
        return res.status(404).json({ message: "사고를 찾을 수 없습니다" });
      }

      // 권한 검증: 본인이 신고한 사고만 조회 가능
      if (incident.requesterId !== user.id && incident.reporterId !== user.id) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      // 오더 정보 조회
      let order: any = null;
      if (incident.orderId) {
        const [orderData] = await db.select({
          id: orders.id,
          campAddress: orders.campAddress,
          deliveryArea: orders.deliveryArea,
          scheduledDate: orders.scheduledDate,
          courierCompany: orders.courierCompany,
          averageQuantity: orders.averageQuantity,
          pricePerUnit: orders.pricePerUnit,
        }).from(orders).where(eq(orders.id, incident.orderId));
        order = orderData;
      }

      // 헬퍼 정보 조회
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

      // 증빙 사진 조회
      const evidenceRows = await db.select()
        .from(incidentEvidence)
        .where(eq(incidentEvidence.incidentId, incidentId));

      // 응답 포맷
      res.json({
        profileImage: user.profileImageUrl || null,
        id: incident.id,
        orderId: incident.orderId,
        incidentType: incident.incidentType,
        incidentDate: incident.incidentDate,
        description: incident.description,
        status: incident.status,
        trackingNumber: incident.trackingNumber,
        deliveryAddress: incident.deliveryAddress,
        customerName: incident.customerName,
        customerPhone: incident.customerPhone,
        damageAmount: incident.damageAmount,
        helperStatus: incident.helperStatus,
        helperActionAt: incident.helperActionAt?.toISOString() || null,
        helperNote: incident.helperNote,
        adminMemo: incident.adminMemo,
        deductionAmount: incident.deductionAmount,
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        createdAt: incident.createdAt?.toISOString() || null,
        order: order ? {
          id: order.id,
          campAddress: order.campAddress,
          deliveryArea: order.deliveryArea,
          scheduledDate: order.scheduledDate,
          courierCompany: order.courierCompany,
          averageQuantity: order.averageQuantity,
          pricePerUnit: order.pricePerUnit,
        } : null,
        helper: helper ? {
          id: helper.id,
          name: helper.name,
          nickname: helper.nickname,
          phone: helper.phone,
        } : null,
        evidence: evidenceRows.map(e => ({
          id: e.id,
          fileUrl: e.fileUrl,
          fileType: e.fileType,
          description: e.description,
        })),
      });
    } catch (err: any) {
      console.error("Get incident detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Requester Reviews API
  // ============================================
  app.get("/api/requester/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const reviews = await storage.getReviewsByReviewer(userId);
      res.json(reviews);
    } catch (err: any) {
      console.error("Get requester reviews error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/requester/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const { orderId, helperId, contractId, rating, comment } = req.body;

      if (!orderId || !helperId || !rating) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
      }

      // 리뷰 작성 조건 검증: 잔금 결제 이후(BALANCE_PAID, SETTLEMENT_PAID)만 가능
      const order = await storage.getOrder(Number(orderId));
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 표준 상태: final_amount_confirmed 이후에만 리뷰 가능
      const reviewOrderStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(reviewOrderStatus, CAN_REVIEW_STATUSES)) {
        return res.status(400).json({
          message: "마감 승인 후에만 리뷰를 작성할 수 있습니다",
          currentStatus: order.status,
        });
      }

      // 본인 오더인지 검증
      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "본인이 생성한 오더에만 리뷰를 작성할 수 있습니다" });
      }

      // 중복 리뷰 방지
      const existingReviews = await storage.getReviewsByReviewer(userId);
      const alreadyReviewed = existingReviews.some(r => r.orderId === Number(orderId));
      if (alreadyReviewed) {
        return res.status(400).json({ message: "이미 리뷰를 작성했습니다" });
      }

      const review = await storage.createReview({
        orderId,
        requesterId: userId,
        helperId,
        contractId,
        reviewerType: "requester",
        rating,
        comment: comment || null,
      });

      // 헬퍼 평점 요약 업데이트
      try {
        const helperReviews = await storage.getHelperReviews(helperId);
        const totalRating = helperReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
        const avgRating = helperReviews.length > 0 ? Math.round((totalRating / helperReviews.length) * 100) : 0;
        await storage.upsertHelperRatingSummary({
          helperUserId: helperId,
          avgRating,
          reviewCount: helperReviews.length,
        });
      } catch (summaryErr) {
        console.error("Failed to update helper rating summary:", summaryErr);
      }

      res.status(201).json(review);
    } catch (err: any) {
      console.error("Create requester review error:", err);
      res.status(500).json({ message: "리뷰 등록에 실패했습니다" });
    }
  });

  // Requester service agreement
  app.post("/api/requester/service-agreement", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 의뢰인만 접근 가능
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const { contractAgreed, signatureData, depositAmount, balanceAmount, balanceDueDate, phoneNumber, phoneVerified, userAgent, consentLog, contractContent, orderData } = req.body;

      if (!contractAgreed || !signatureData) {
        return res.status(400).json({ message: "계약에 동의하고 서명해주세요" });
      }

      if (!orderData) {
        return res.status(400).json({ message: "오더 정보가 없습니다" });
      }

      if (contractAgreed !== true) {
        return res.status(400).json({ message: "계약 내용에 동의해주세요" });
      }

      if (!signatureData || signatureData.length < 1000) {
        return res.status(400).json({ message: "유효한 전자서명을 입력해주세요" });
      }

      if (!phoneVerified) {
        return res.status(400).json({ message: "휴대폰 인증을 완료해주세요" });
      }

      // Check if user already has a service agreement
      let agreement = await storage.getRequesterServiceAgreement(userId);

      // 클라이언트 IP 주소 추출
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

      // Create service agreement only if doesn't exist
      if (!agreement) {
        agreement = await storage.createRequesterServiceAgreement({
          userId,
          contractAgreed: true,
          depositAmount: depositAmount ?? null,
          balanceAmount: balanceAmount ?? null,
          balanceDueDate: balanceDueDate ?? null,
          phoneNumber: phoneNumber ?? null,
          phoneVerified: phoneVerified ?? false,
          signatureData,
          ipAddress,
          userAgent: userAgent ?? null,
          consentLog: consentLog ?? null,
          contractContent: contractContent ?? null,
          agreedAt: new Date(),
        });
      }

      // Create order from orderData
      const order = await storage.createOrder({
        requesterId: userId,
        helperId: null,
        trackingNumber: null,
        companyName: orderData.company || "미지정",
        pricePerUnit: orderData.unitPrice || 1200,
        averageQuantity: orderData.type === "cold_truck" ? "1건" : `${orderData.quantity || 100}box`,
        deliveryArea: orderData.deliveryArea || orderData.loadingPoint || "배송지 미입력",
        scheduledDate: orderData.requestDate || "일정 미선택",
        scheduledDateEnd: orderData.requestDateEnd || null,
        vehicleType: orderData.vehicleType || "차종 미선택",
        isUrgent: orderData.type === "cold_truck" || orderData.type === "etc_courier",
        status: "awaiting_deposit",
        approvalStatus: "pending", // 승인중
        maxHelpers: 1,
        currentHelpers: 0,
        requesterPhone: user.phoneNumber || phoneNumber,
      });

      // 가상계좌 생성 (계약금 20%)
      const unitPrice = orderData.unitPrice || 1200;
      // 냉잡전용(cold_truck)는 수량 1건으로 고정
      const quantity = orderData.type === "cold_truck" ? 1 : (orderData.quantity || 100);
      const subtotal = unitPrice * quantity;
      const vatAmount = calculateVat(subtotal);
      const totalAmount = subtotal + vatAmount;
      const depRate = await getDepositRate();
      const depositAmt = Math.round(totalAmount * (depRate / 100));

      // 가상계좌 만료일 (3일 후)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      // 테스트 모드에서 가상계좌 번호 생성
      const testBankCode = "088"; // 신한은행
      const testAccountNumber = `9${Date.now().toString().slice(-11)}`;

      const virtualAccount = await storage.createVirtualAccount({
        orderId: order.id,
        userId,
        paymentId: `payment_${order.id}_${Date.now()}`,
        bankCode: testBankCode,
        bankName: "신한은행",
        accountNumber: testAccountNumber,
        accountHolder: "헬프미",
        amount: depositAmt,
        status: "pending",
        dueDate,
      });

      res.json({
        message: "계약 동의가 완료되었습니다",
        agreement,
        order: order ? { ...order, helperName: null } : null,
        virtualAccount: {
          bankName: virtualAccount.bankName,
          accountNumber: virtualAccount.accountNumber,
          accountHolder: virtualAccount.accountHolder,
          amount: virtualAccount.amount,
          expiresAt: virtualAccount.dueDate,
        }
      });
    } catch (err: any) {
      console.error("Requester service agreement error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/requester/service-agreement", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 의뢰인만 접근 가능
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const agreement = await storage.getRequesterServiceAgreement(userId);
      res.json(agreement || null);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/requester/orders - 요청자 오더 생성 (T-03 스펙)
  app.post("/api/requester/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "requester") {
        return res.status(403).json({ code: "FORBIDDEN", message: "의뢰인만 오더를 생성할 수 있습니다" });
      }

      const { pickup, deliveryArea, schedule, price, requirements } = req.body;

      // 필수 필드 검증
      if (!deliveryArea || !schedule || !price) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "필수 정보가 누락되었습니다" });
      }

      // 금액 계산 (부가세 포함)
      const boxCount = price.boxCount || 0;
      const unitPrice = price.unitPrice || 0;
      const supplyAmount = boxCount * unitPrice;
      const totalWithVat = Math.round(supplyAmount * 1.1); // 부가세 10% 포함
      const depositRequired = supplyAmount > 0;
      const depRate = await getDepositRate();
      const depositAmount = Math.floor(totalWithVat * (depRate / 100)); // 부가세 포함 금액의 계약금

      const order = await storage.createOrder({
        requesterId: user.id,
        status: ORDER_STATUS.AWAITING_DEPOSIT, // 초기 상태: 입금 대기
        companyName: deliveryArea?.region1 || "미지정",
        deliveryArea: pickup?.address || (deliveryArea?.region1 + " " + deliveryArea?.region2),
        scheduledDate: schedule?.startAt ? new Date(schedule.startAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        scheduledDateEnd: schedule?.endAt ? new Date(schedule.endAt).toISOString().split("T")[0] : null,
        averageQuantity: String(boxCount),
        pricePerUnit: unitPrice,
        vehicleType: requirements?.vehicle || "any",
        campAddress: pickup?.address || null,
        deliveryLat: pickup?.lat?.toString() || null,
        deliveryLng: pickup?.lng?.toString() || null,
      });

      res.status(201).json({
        order: {
          id: `o_${order.id}`,
          status: depositRequired ? "PENDING_DEPOSIT" : "OPEN",
          deposit: {
            required: depositRequired,
            amount: depositAmount,
            approved: false,
          },
          createdAt: order.createdAt,
        },
      });

      // 관리자에게 새 오더 알림 (실시간 업데이트)
      await broadcastToAllAdmins("order", "created", order.id, {
        orderId: order.id,
        requesterId: user.id,
        status: ORDER_STATUS.AWAITING_DEPOSIT,
      });

      // 헬퍼들에게 새 오더 알림 (실시간 업데이트)
      await broadcastNewOrderToHelpers({
        orderId: order.id,
        courierCompany: undefined,
        deliveryArea: pickup?.address || deliveryArea?.region1,
        scheduledDate: order.scheduledDate,
      });
    } catch (err: any) {
      console.error("Create requester order error:", err);
      res.status(500).json({ code: "SERVER_ERROR", message: "오더 생성에 실패했습니다" });
    }
  });

  // Requester's own orders

  // GET /api/requester/orders/:orderId - 요청자 특정 오더 조회
  app.get("/api/requester/orders/:orderId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const userId = user.id;
      const orderId = parseInt(req.params.orderId);

      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "이 오더에 접근 권한이 없습니다" });
      }

      const orderContracts4 = await storage.getOrderContracts(orderId);
      const firstContract = orderContracts4[0];

      let helperName = "미배정";
      let selectedHelperId: any = null;
      let helperProfileImageUrl: string | null = null;
      if (order.matchedHelperId) {
        selectedHelperId = order.matchedHelperId;
        const helper = await storage.getUser(order.matchedHelperId);
        helperName = helper?.name || "미배정";
        helperProfileImageUrl = (helper as any)?.profileImageUrl || null;
      } else if (firstContract?.helperId) {
        selectedHelperId = firstContract.helperId;
        const helper = await storage.getUser(firstContract.helperId);
        helperName = helper?.name || "미배정";
        helperProfileImageUrl = (helper as any)?.profileImageUrl || null;
      }

      const depositInfo = await getOrderDepositInfo(orderId);
      const depositPaid = depositInfo.paymentStatus === "paid";
      const balancePaid = firstContract?.balancePaid || false;
      const balancePaidAt = firstContract?.balancePaidAt || null;

      const [closingReport] = await db.select()
        .from(closingReports)
        .where(eq(closingReports.orderId, orderId))
        .limit(1);

      let totalAmount = Number(firstContract?.totalAmount || 0);
      let deliveryCount = 0;
      let returnCount = 0;
      let otherCount = 0;

      if (closingReport) {
        const closingData = parseClosingReport(closingReport, order);
        const settlement = calculateSettlement(closingData);
        totalAmount = settlement.totalAmount;
        deliveryCount = settlement.deliveredCount;
        returnCount = settlement.returnedCount;
        otherCount = settlement.etcCount;
      }

      const depositAmount = depositInfo.depositAmount || Number(firstContract?.depositAmount || 0);
      const balanceAmount = Math.max(0, totalAmount - depositAmount);
      const paidAmount = (depositPaid ? depositAmount : 0) + (balancePaid ? balanceAmount : 0);
      const unpaidAmount = Math.max(0, totalAmount - paidAmount);

      let hasReview = false;
      if (firstContract) {
        const existingReview = await storage.getReviewByContract(firstContract.id);
        hasReview = !!existingReview;
      }

      res.json({
        ...order,
        helperName,
        selectedHelperId,
        helperProfileImageUrl,
        contractId: firstContract?.id || null,
        totalAmount,
        depositAmount,
        balanceAmount,
        depositPaid,
        balancePaid,
        balancePaidAt,
        paidAmount,
        unpaidAmount,
        deliveryCount,
        returnCount,
        otherCount,
        hasReview,
        workDate: order.scheduledDate || order.expectedDate || null,
        vehicleType: order.vehicleType || null,
      });
    } catch (error) {
      console.error("Error fetching requester order:", error);
      res.status(500).json({ message: "오더 조회에 실패했습니다" });
    }
  });

  app.get("/api/requester/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 의뢰인만 접근 가능
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const statusFilter = req.query.status as string | undefined;
      let myOrders = await storage.getOrdersByRequesterId(userId);

      // 홈 화면(기본): 마감일 지난 오더 + hiddenAt 설정된 오더 숨김
      // 사용이력(status=completed): 모든 완료 오더 표시
      const showHidden = statusFilter === 'completed';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!showHidden) {
        myOrders = myOrders.filter(order => {
          // hiddenAt 설정된 오더 숨김
          if (order.hiddenAt) return false;
          // 마감 대기/확인 중인 오더는 항상 표시 (액션 필요)
          const actionRequiredStatuses = ['closing_submitted', 'final_amount_confirmed'];
          if (actionRequiredStatuses.includes(order.status?.toLowerCase() || '')) {
            return true;
          }
          // 마감일이 지난 완료 오더 숨김 (정산 완료 후)
          const completedStatuses = ['balance_paid', 'settlement_paid', 'closed'];
          if (completedStatuses.includes(order.status?.toLowerCase() || '')) {
            const scheduledDate = order.scheduledDate ? new Date(order.scheduledDate) : null;
            if (scheduledDate && scheduledDate < today) return false;
          }
          return true;
        });
      }

      // 상태 필터링 (표준 상태 기준)
      if (statusFilter === 'completed') {
        // 마감 이후 오더: closing_submitted, final_amount_confirmed, balance_paid, settlement_paid, closed
        const completedStatuses = [
          'closing_submitted', 'final_amount_confirmed', 'balance_paid',
          'settlement_paid', 'closed'
        ];
        myOrders = myOrders.filter(order => completedStatuses.includes(order.status?.toLowerCase() || ''));
      } else if (statusFilter === 'in_progress') {
        // 진행중인 오더: scheduled, in_progress
        const inProgressStatuses = ['scheduled', 'in_progress'];
        myOrders = myOrders.filter(order => inProgressStatuses.includes(order.status?.toLowerCase() || ''));
      } else if (statusFilter === 'open') {
        // 매칭중인 오더: open (표준)
        myOrders = myOrders.filter(order => order.status?.toLowerCase() === 'open');
      }

      const allSettlements = await storage.getAllSettlementStatements();

      // 각 오더에 결제 정보 및 정산 데이터 추가
      const ordersWithPayment = await Promise.all(myOrders.map(async (order) => {
        try {
          const oContracts = await storage.getOrderContracts(order.id);
          const orderSettlements = allSettlements.filter(s => s.orderId === order.id);

          let totalAmount = 0;
          let paidAmount = 0;
          let unpaidAmount = 0;
          let deliveryCount = 0;
          let returnCount = 0;
          let otherCount = 0;

          for (const contract of oContracts) {
            const contractTotal = Number(contract.totalAmount) || 0;
            const depositAmt = Number(contract.depositAmount) || 0;
            const balanceAmt = Number(contract.balanceAmount) || 0;

            totalAmount += contractTotal;
            if (contract.depositPaid) paidAmount += depositAmt;
            if (contract.balancePaid) paidAmount += balanceAmt;
          }

          // 정산 데이터에서 수량 합계
          for (const settlement of orderSettlements) {
            deliveryCount += settlement.deliveryCount || 0;
            returnCount += settlement.returnCount || 0;
            otherCount += settlement.otherCount || 0;
            // 정산 totalAmount이 있으면 사용 (업무마감 기반 실제 금액)
            if (settlement.totalAmount && settlement.totalAmount > 0) {
              totalAmount = Math.max(totalAmount, settlement.totalAmount);
            }
          }

          unpaidAmount = Math.max(0, totalAmount - paidAmount);

          // 헬퍼 정보 조회
          const helperIds = oContracts.map(c => c.helperId).filter(Boolean);
          let helperName = "미배정";
          if (helperIds.length > 0) {
            const helper = await storage.getUser(helperIds[0]);
            helperName = helper?.name || "미배정";
          }

          // 마감 데이터가 있으면 실제 수량으로 금액 재계산
          const [closingReport] = await db.select()
            .from(closingReports)
            .where(eq(closingReports.orderId, order.id))
            .limit(1);

          // 계약금/잔금 정보 추가 - SSOT 함수 사용
          const firstContract = oContracts[0];
          const depositInfo = await getOrderDepositInfo(order.id);
          const depositPaid = depositInfo.paymentStatus === 'paid';
          const balancePaid = firstContract?.balancePaid || false;
          const balancePaidAt = firstContract?.balancePaidAt || null;

          // 마감 데이터가 있으면 실제 수량으로 금액 계산, 없으면 계약 금액 사용
          let depositAmount = depositInfo.depositAmount || Number(firstContract?.depositAmount || firstContract?.downPaymentAmount || 0);
          let balanceAmount = Number(firstContract?.calculatedBalanceAmount || firstContract?.remainingAmount || 0);
          let actualTotalAmount = totalAmount;

          if (closingReport) {
            // 통합 계산 모듈 사용 (Single Source of Truth)
            const closingData = parseClosingReport(closingReport, order);
            const settlement = calculateSettlement(closingData);

            actualTotalAmount = settlement.totalAmount;
            balanceAmount = Math.max(0, actualTotalAmount - depositAmount);
            totalAmount = actualTotalAmount;

            // 마감 수량 업데이트
            deliveryCount = settlement.deliveredCount;
            returnCount = settlement.returnedCount;
            otherCount = settlement.etcCount;
          }

          // T-04: applicantCount / selectedHelperId 추가
          const applications = await storage.getOrderApplications(order.id);
          const activeApplications = applications.filter(a =>
            a.status === "applied" || a.status === "selected"
          );
          const applicantCount = activeApplications.length;
          const selectedHelperId = order.matchedHelperId || null;

          // 리뷰 존재 여부 확인
          let hasReview = false;
          if (firstContract) {
            const existingReview = await storage.getReviewByContract(firstContract.id);
            hasReview = !!existingReview;
          }

          return {
            ...order,
            totalAmount,
            paidAmount,
            unpaidAmount,
            depositAmount,
            balanceAmount,
            depositPaid,
            balancePaid,
            balancePaidAt,
            deliveryCount,
            returnCount,
            otherCount,
            helperName,
            isPaid: unpaidAmount <= 0,
            applicantCount,
            selectedHelperId,
            contractId: firstContract?.id || null,
            hasReview,
            applicants: await Promise.all(activeApplications.slice(0, 3).map(async (app) => {
              const helper = await storage.getUser(app.helperId);
              return {
                id: app.id,
                helperId: app.helperId,
                helperName: helper?.name || "헬퍼",
                helperNickname: helper?.nickname || null,
                averageRating: helper?.averageRating || null,
                reviewCount: helper?.reviewCount || 0,
                profileImageUrl: helper?.profileImageUrl || null,
                status: app.status,
              };
            })),
          };
        } catch (error) {
          console.error(`Error processing order ${order.id}:`, error);
          // 계약 정보를 가져오지 못한 경우 기본값 반환
          return {
            ...order,
            totalAmount: 0,
            depositAmount: 0,
            balanceAmount: 0,
            depositPaid: false,
            balancePaid: false,
            paidAmount: 0,
            unpaidAmount: 0,
            deliveryCount: 0,
            returnCount: 0,
            otherCount: 0,
            helperName: "미배정",
            applicantCount: 0,
            selectedHelperId: order.matchedHelperId || null,
            contractId: null,
            isPaid: false,
            hasReview: false,
          };
        }
      }));

      res.json(ordersWithPayment);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Requester: Get disputes list (이의제기 목록 조회)
  app.get("/api/requester/disputes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const disputesList = await storage.getDisputesByRequester(user.id);

      res.json(disputesList.map((d: any) => ({
        id: d.id,
        orderId: d.orderId,
        workDate: d.workDate,
        disputeType: d.disputeType,
        description: d.description,
        status: d.status,
        resolution: d.resolution,
        adminReply: d.adminReply,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      })));
    } catch (err: any) {
      console.error("Get requester disputes error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // GET /api/requester/orders/:orderId/dispute-status - 해당 오더의 이의제기 상태 조회
  app.get("/api/requester/orders/:orderId/dispute-status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const orderId = Number(req.params.orderId);
      const order = await storage.getOrder(orderId);

      if (!order || order.requesterId !== user.id) {
        return res.status(403).json({ message: "해당 오더에 대한 권한이 없습니다" });
      }

      const disputes = await storage.getDisputesByOrder(orderId);
      const activeDispute = disputes.find((d: any) =>
        d.submitterRole === "requester" && ["pending", "in_review"].includes(d.status)
      );

      res.json({
        profileImage: user.profileImageUrl || null,
        hasActiveDispute: !!activeDispute,
        activeDispute: activeDispute ? {
          id: activeDispute.id,
          status: activeDispute.status,
          disputeType: activeDispute.disputeType,
          createdAt: activeDispute.createdAt,
        } : null,
        totalDisputes: disputes.filter((d: any) => d.submitterRole === "requester").length,
      });
    } catch (err: any) {
      console.error("Dispute status check error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // GET /api/requester/disputes/:id - 요청자 이의제기 상세 조회
  app.get("/api/requester/disputes/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const id = Number(req.params.id);
      const dispute = await storage.getDispute(id);

      if (!dispute || dispute.submitterRole !== "requester") {
        return res.status(404).json({ message: "이의제기를 찾을 수 없습니다" });
      }

      // Verify ownership through order
      if (dispute.orderId) {
        const order = await storage.getOrder(dispute.orderId);
        if (!order || order.requesterId !== user.id) {
          return res.status(403).json({ message: "해당 이의제기에 대한 권한이 없습니다" });
        }
      }

      // Get order info
      let order: any = null;
      let helperName: any = null;
      if (dispute.orderId) {
        const [orderData] = await db.select().from(orders).where(eq(orders.id, dispute.orderId));
        order = orderData;

        if (orderData?.matchedHelperId) {
          const [helperData] = await db.select({ name: users.name }).from(users).where(eq(users.id, orderData.matchedHelperId));
          helperName = helperData?.name;
        }
      }

      res.json({
        profileImage: user.profileImageUrl || null,
        id: dispute.id,
        orderId: dispute.orderId,
        workDate: dispute.workDate,
        disputeType: dispute.disputeType,
        description: dispute.description,
        status: dispute.status,
        resolution: dispute.resolution,
        adminReply: dispute.adminReply,
        adminReplyAt: dispute.adminReplyAt,
        createdAt: dispute.createdAt,
        resolvedAt: dispute.resolvedAt,
        order: order ? { ...order, helperName } : null,
        helperName,
        evidencePhotoUrls: dispute.evidencePhotoUrl ? JSON.parse(dispute.evidencePhotoUrl) : [],
      });
    } catch (err: any) {
      console.error("Get requester dispute detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Requester: Create a dispute (이의제기 접수)

  // POST /api/requester/disputes - 요청자 이의제기 접수
  app.post("/api/requester/disputes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 이의제기를 신청할 수 있습니다" });
      }

      const { orderId, incidentType, description, evidencePhotoUrls } = req.body;

      // Idempotency check
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, isConflict, cachedResponse } = await checkIdempotency(
          userId,
          `POST:/api/requester/disputes`,
          idempotencyKey,
          req.body
        );
        if (isConflict) {
          return res.status(409).json({
            error: { code: "IDEMPOTENCY_CONFLICT", message: "동일 Idempotency-Key에 다른 요청이 감지되었습니다." }
          });
        }
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached dispute for key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      if (!orderId || !incidentType || !description) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
      }

      // 이의제기 유형 검증
      const validDisputeTypes = ["settlement_error", "invoice_error", "contract_dispute", "service_complaint", "delay", "no_show", "amount_error", "other"];
      if (!validDisputeTypes.includes(incidentType)) {
        return res.status(400).json({ message: "유효하지 않은 이의제기 유형입니다" });
      }

      // 오더 소유권 확인
      const order = await storage.getOrder(orderId);
      if (!order || order.requesterId !== userId) {
        return res.status(403).json({ message: "해당 오더에 대한 권한이 없습니다" });
      }

      // 매칭된 헬퍼 확인 (이의제기는 매칭 후에만 가능)
      if (!order.matchedHelperId) {
        return res.status(400).json({ message: "매칭된 헬퍼가 없는 오더입니다. 이의제기는 매칭 후에만 가능합니다." });
      }

      // 중복 이의제기 확인 (pending 또는 in_review 상태의 기존 이의제기가 있는 경우)
      const existingDisputes = await storage.getDisputesByOrder(orderId);
      const activeDispute = existingDisputes.find((d: any) =>
        d.submitterRole === "requester" && ["pending", "in_review"].includes(d.status)
      );
      if (activeDispute) {
        return res.status(409).json({
          message: "이미 처리 중인 이의제기가 있습니다.",
          existingDisputeId: activeDispute.id,
          existingDisputeStatus: activeDispute.status
        });
      }

      // disputes 테이블에 이의제기 생성
      const dispute = await storage.createDispute({
        helperId: order.matchedHelperId,
        submitterRole: "requester",
        orderId,
        workDate: order.scheduledDate || new Date().toISOString().split("T")[0],
        disputeType: incidentType,
        description,
        evidencePhotoUrl: evidencePhotoUrls ? JSON.stringify(evidencePhotoUrls) : null,
        status: "pending",
      });

      // 알림 발송 (알림 실패해도 이의제기 접수에 영향 없도록 try-catch)
      try {
        // WebSocket으로 관리자에게 실시간 알림
        broadcastToAllAdmins("dispute", "created", dispute.id, {
          disputeId: dispute.id,
          orderId,
          disputeType: incidentType,
          submitterRole: "requester",
          submitterName: user.name || user.email,
        });

        // 이의제기 유형 라벨
        const disputeTypeLabel = incidentType === "settlement_error" ? "정산오류" :
          incidentType === "invoice_error" ? "세금계산서 오류" :
            incidentType === "contract_dispute" ? "계약조건분쟁" :
              incidentType === "service_complaint" ? "서비스불만" :
                incidentType === "delay" ? "일정관련" :
                  incidentType === "no_show" ? "노쇼" :
                    incidentType === "amount_error" ? "금액 오류" : "기타";

        // 헬퍼에게 이의제기 접수 알림 전송
        const disputeMessage = `의뢰인이 이의제기를 접수했습니다.\n유형: ${disputeTypeLabel}\n내용: ${description.substring(0, 100)}${description.length > 100 ? "..." : ""}`;

        await storage.createNotification({
          userId: order.matchedHelperId,
          type: "dispute_submitted",
          title: "이의제기 접수 알림",
          message: disputeMessage,
          data: JSON.stringify({ disputeId: dispute.id, orderId, disputeType: incidentType }),
          isRead: false,
        });

        await sendPushToUser(order.matchedHelperId, {
          title: "이의제기 접수 알림",
          body: `의뢰인이 이의제기를 접수했습니다. 유형: ${disputeTypeLabel}`,
        } as any);
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send dispute notifications for order ${orderId}:`, notificationErr);
      }

      // Store idempotency response
      if (idempotencyKey) {
        await storeIdempotencyResponse(userId, `POST:/api/requester/disputes`, idempotencyKey, 201, dispute, req.body);
      }

      console.log(`[Dispute] New dispute created by requester ${userId}: ${incidentType} for order ${orderId}`);

      res.status(201).json({
        success: true,
        message: "이의제기가 접수되었습니다.",
        dispute
      });
    } catch (err: any) {
      console.error("Requester dispute creation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Universal orders/my endpoint - works for both helpers and requesters
  app.get("/api/orders/my", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      let resultOrders: any[] = [];
      if (user.role === "requester") {
        resultOrders = await storage.getOrdersByRequesterId(userId);
      } else if (user.role === "helper") {
        // Get orders from contracts where helper is involved
        const helperContracts = await storage.getHelperContracts(userId);
        // Fetch each order individually (more efficient than loading all orders)
        const orderPromises = helperContracts.map(c => storage.getOrder(c.orderId));
        const orders = await Promise.all(orderPromises);
        resultOrders = orders.filter((o): o is NonNullable<typeof o> => o !== undefined);
      }

      res.json(resultOrders);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Order routes

  // 헬퍼용 내 오더 전체 목록 (예정/진행중/완료 포함)
  app.get("/api/helper/my-orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      // 헬퍼에게 배정된 모든 오더 조회 (예정/진행중/완료 등)
      const helperOrders = await db.select().from(orders)
        .where(eq(orders.matchedHelperId, userId))
        .orderBy(desc(orders.createdAt));

      // 지원해서 선정된 오더도 포함 (selected, approved, in_progress 모두)
      const applications = await db.select().from(orderApplications)
        .where(and(
          eq(orderApplications.helperId, userId),
          inArray(orderApplications.status, ["selected", "approved", "in_progress", "scheduled"])
        ));

      const selectedOrderIds = applications.map(a => a.orderId);
      let selectedOrders: typeof helperOrders = [];

      if (selectedOrderIds.length > 0) {
        selectedOrders = await db.select().from(orders)
          .where(and(
            inArray(orders.id, selectedOrderIds),
            not(eq(orders.matchedHelperId, userId)) // 중복 제외
          ))
          .orderBy(desc(orders.createdAt));
      }

      // 합쳐서 반환
      const allOrders = [...helperOrders, ...selectedOrders];
      res.json(allOrders);
    } catch (err: any) {
      console.error("Error in /api/helper/my-orders:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/orders/scheduled", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const scheduledOrders = await storage.getHelperScheduledOrders(userId);
      res.json(scheduledOrders);
    } catch (err: any) {
      console.error("Error in /api/orders/scheduled:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/orders/my-applications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const applications = await storage.getHelperApplications(userId);

      // 각 지원에 오더 상세 정보 포함
      const applicationsWithOrders = await Promise.all(
        applications.map(async (app) => {
          const order = await storage.getOrder(app.orderId);
          return {
            ...app,
            order: order || null,
          };
        })
      );

      res.json(applicationsWithOrders);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.orders.list.path, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const includeHidden = req.query.includeHidden === "true";
      let orders = await storage.getAllOrders(status, { includeHidden });

      // Filter by helper's service areas if authenticated as helper
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (user?.role === "helper") {
            const serviceAreas = await storage.getHelperServiceAreas(decoded.userId);
            if (serviceAreas.length > 0) {
              const regions = serviceAreas.map(a => a.region);
              orders = orders.filter(order => {
                if (!order.deliveryArea) return true;
                return regions.some(region => order.deliveryArea?.includes(region));
              });
            }
          }
        } catch (e) {
          // Token invalid, continue without filtering
        }
      }

      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.orders.get.path, async (req, res) => {
    try {
      const order = await storage.getOrder(Number(req.params.id));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.orders.create.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 멱등성 체크: 중복 요청 방지
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, cachedResponse } = await checkIdempotency(
          userId,
          "POST:/api/orders",
          idempotencyKey
        );
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached order creation for key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      // 역할 검증: 의뢰인만 오더 생성 가능 (관리자 제외)
      if (user.role !== "requester" && !user.isHqStaff) {
        return res.status(403).json({ message: "의뢰인만 오더를 생성할 수 있습니다" });
      }

      const input = api.orders.create.input.parse(req.body);

      // 클라이언트 필드 → DB 필드 매핑
      // pickupAddress → campAddress (캠프 및 터미널주소)
      // description → deliveryGuide (배송가이드 텍스트)
      // referenceImageUri / imageUri → regionMapUrl (배송지 이미지)
      // waypoints 배열 → JSON 문자열
      const rawBody = req.body as any;
      const category = rawBody.courierCategory || "parcel";
      const resolvedCampAddress = rawBody.pickupAddress || input.campAddress;
      const mappedInput = {
        ...input,
        campAddress: resolvedCampAddress,
        deliveryGuide: rawBody.description || input.deliveryGuide,
        regionMapUrl: rawBody.referenceImageUri || rawBody.imageUri || input.regionMapUrl,
        courierCompany: input.companyName || null,
        courierCategory: category,
        // 냉탑전용 필드: waypoints 배열을 JSON 문자열로 변환
        waypoints: Array.isArray(rawBody.waypoints) ? JSON.stringify(rawBody.waypoints) : (input as any).waypoints || null,
        // 냉탑전용: campAddress를 loadingPoint에도 매핑 (상차지 = 캠프주소)
        loadingPoint: category === "cold" ? ((input as any).loadingPoint || resolvedCampAddress) : (input as any).loadingPoint || null,
        loadingPointDetail: category === "cold" ? ((input as any).loadingPointDetail || (input as any).campAddressDetail) : (input as any).loadingPointDetail || null,
      };

      // 현재 글로벌 수수료 정책 스냅샷 가져오기
      // 주의: 오더 생성 시점에는 헬퍼가 배정되지 않았으므로 글로벌 정책만 스냅샷
      // 헬퍼별/팀별 오버라이드는 정산 시점에 적용됨
      // 이 스냅샷은 정산 시 폴백 값으로 사용되며, 정책 변경 후에도 기존 오더의 기준 수수료율 보존
      const helperPolicy = await storage.getCommissionPolicy("helper");
      let snapshotCommissionRate = helperPolicy?.defaultRate ?? 10;
      const snapshotPlatformRate = helperPolicy?.platformRate ?? 8;
      const snapshotTeamLeaderRate = helperPolicy?.teamLeaderRate ?? 2;

      // 카테고리별 수수료 오버라이드 (other/cold 카테고리는 system_settings에서 별도 수수료율 사용)
      const commissionCategory = mappedInput.courierCategory;
      if (commissionCategory === "other" || commissionCategory === "cold") {
        const allSettings = await storage.getAllSystemSettings();
        const settingsMap: Record<string, string> = {};
        allSettings.forEach((s: any) => { settingsMap[s.settingKey] = s.settingValue; });
        const categoryCommissionKey = `${commissionCategory}_commission_rate`;
        const categoryCommission = parseInt(settingsMap[categoryCommissionKey]);
        if (!isNaN(categoryCommission) && categoryCommission > 0) {
          snapshotCommissionRate = categoryCommission;
        }
      }

      // 최저운임 스냅샷 계산
      // 택배사 설정에서 minTotal 조회
      let basePricePerBox = mappedInput.pricePerUnit || 1200;
      let finalPricePerBox = basePricePerBox;
      let minTotalApplied = 0;

      const courierCompany = mappedInput.companyName;
      if (courierCompany) {
        const couriers = await storage.getAllCourierSettings();
        const courierSetting = couriers.find(c => c.courierName === courierCompany);

        if (courierSetting?.minTotal && courierSetting.minTotal > 0) {
          // 박스 수량 파싱 (예: "200box" -> 200)
          const quantityStr = mappedInput.averageQuantity || "100";
          const boxCount = parseInt(quantityStr.replace(/[^0-9]/g, '')) || 0;

          if (boxCount > 0) {
            const { calcPerBoxPricing } = await import("../utils/min-total-calculator");

            // 긴급 여부 확인 (mappedInput에서)
            const isUrgent = mappedInput.isUrgent === true || (mappedInput as any).type === "cold_truck" || (mappedInput as any).type === "etc_courier";
            const urgentSurchargeRate = courierSetting.urgentSurchargeRate || 0;

            const calcResult = calcPerBoxPricing({
              basePricePerBox,
              boxCount,
              minTotalAmount: courierSetting.minTotal,
              urgentSurchargeRate,
              isUrgent,
            });

            finalPricePerBox = calcResult.finalPricePerBox;
            minTotalApplied = calcResult.minApplied ? courierSetting.minTotal : 0;

            // 긴급 할증 또는 최저운임 적용 시 로깅
            if (calcResult.urgentApplied || calcResult.minApplied) {
              console.log(`[Order Create] 가격조정: ${basePricePerBox} → ${finalPricePerBox}원 (긴급: ${calcResult.urgentApplied}, 최저운임: ${calcResult.minApplied})`);
            }
          }
        }
      }

      // 오더 생성 (기본 상태: awaiting_deposit - 입금 대기)
      const order = await storage.createOrder({
        ...mappedInput,
        requesterId: userId,
        helperId: null,
        trackingNumber: null,
        status: "awaiting_deposit",
        approvalStatus: "pending",
        maxHelpers: mappedInput.maxHelpers || 3,
        snapshotCommissionRate,
        snapshotPlatformRate,
        snapshotTeamLeaderRate,
        basePricePerBox,
        finalPricePerBox,
        minTotalApplied,
        pricePerUnit: finalPricePerBox, // 최종 조정된 단가 사용
      });

      // 정책 스냅샷 저장 (정산 자동화용)
      try {
        const { createPolicySnapshotForOrder } = await import("../lib/settlement-calculator");
        await createPolicySnapshotForOrder(
          order.id,
          (mappedInput as any).carrierCode || mappedInput.companyName || "",
          mappedInput.courierCategory || "parcel",
          mappedInput.isUrgent === true
        );
      } catch (snapshotErr) {
        console.warn("[Order Create] Policy snapshot failed (non-critical):", snapshotErr);
      }

      // 의뢰인에게 입금 안내 알림
      await storage.createNotification({
        userId,
        type: "order_created",
        title: "오더 등록 대기",
        message: `${order.companyName} 오더가 등록 대기 상태입니다. 예약금 입금 후 등록이 완료됩니다.`,
        relatedId: order.id,
      });

      // 관리자에게 새 오더 알림 브로드캐스트
      broadcastToAllAdmins("order", "created", order.id, {
        orderId: order.id,
        companyName: order.companyName,
        requesterId: userId,
        helperId: null,
        trackingNumber: null,
        status: "awaiting_deposit",
      });

      // 멱등성 응답 저장
      if (idempotencyKey) {
        await storeIdempotencyResponse(userId, "POST:/api/orders", idempotencyKey, 201, order);
      }

      res.status(201).json(order);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      console.error("[Order Create Error]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼가 오더에 신청 (applied 상태로 생성)
  app.post(api.orders.apply.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const orderId = Number(req.params.id);

      // 멱등성 체크: 중복 신청 방지
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, cachedResponse } = await checkIdempotency(
          userId,
          `POST:/api/orders/${orderId}/apply`,
          idempotencyKey
        );
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached apply for order ${orderId}, key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      // 역할 검증: 헬퍼만 오더 신청 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 오더에 신청할 수 있습니다" });
      }

      // 온보딩 승인 검증: 승인된 헬퍼만 오더 신청 가능
      if (user.onboardingStatus !== "approved") {
        const statusMessage = user.onboardingStatus === "rejected"
          ? "가입 심사가 반려되었습니다. 정보를 수정 후 다시 제출해주세요."
          : "가입 심사가 완료되지 않았습니다. 서류 검토 후 승인이 완료되면 오더 신청이 가능합니다.";
        return res.status(403).json({ message: statusMessage });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // 지원 가능 상태 확인 (open만 허용)
      const legacyApplyStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(legacyApplyStatus, CAN_APPLY_STATUSES)) {
        return res.status(400).json({ message: "현재 신청할 수 없는 오더입니다" });
      }

      const existingApplication = await storage.getOrderApplication(orderId, userId);
      if (existingApplication) {
        return res.status(400).json({ message: "이미 신청한 오더입니다" });
      }

      // T-03: 헬퍼 중복 접수 제한 - 같은 입차일에 이미 매칭된 오더가 있으면 추가 지원 불가
      if (order.scheduledDate) {
        const matchedOrderOnDate = await storage.getHelperMatchedOrderByDate(userId, order.scheduledDate);
        if (matchedOrderOnDate) {
          return res.status(409).json({
            code: "DUPLICATE_ACTIVE_ORDER",
            message: `동일 날짜에 예정된 오더가 있어 지원이 불가합니다.`
          });
        }
      }

      // 3명 제한 체크 (원자적 처리를 위해 현재 헬퍼 수 확인)
      const currentApplications = await storage.getOrderApplications(orderId);
      const activeApplications = currentApplications.filter(a =>
        a.status === "applied" || a.status === "selected" || a.status === "scheduled" || a.status === "in_progress"
      );

      if (activeApplications.length >= 3) {
        return res.status(400).json({ message: "최대 신청 인원에 도달했습니다" });
      }

      // 신청 생성 (applied 상태)
      const application = await storage.createOrderApplication({
        orderId,
        helperId: userId,
        status: "applied",
      });

      // T-02: currentHelpers 제거 - applications COUNT로 계산
      const newHelperCount = activeApplications.length + 1;

      // 지원 시 상태 변경 없음 (open 유지) - 지원자 수는 applications 테이블로 관리

      // 의뢰인에게 알림 발송 (한 번만)
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "helper_applied",
          title: "헬퍼 업무 신청",
          message: `${user.name || "헬퍼"}님이 ${order.companyName} 오더에 신청했습니다. (${newHelperCount}/3명)`,
          relatedId: orderId,
        });

        // WebSocket 실시간 알림 (상태는 open 유지)
        notificationWS.sendOrderStatusUpdate(order.requesterId, {
          orderId,
          status: order.status || "open",
          approvalStatus: order.approvalStatus || undefined,
          applicantCount: newHelperCount,
        });

        // 푸시 알림 (태그로 중복 방지)
        sendPushToUser(order.requesterId, {
          title: "헬퍼 업무 신청",
          body: `${user.name || "헬퍼"}님이 ${order.companyName} 오더에 신청했습니다. (${newHelperCount}/3명)`,
          url: "/requester-home",
          tag: `application-${orderId}-${userId}`,
        });
      }

      // 관리자에게 실시간 브로드캐스트
      broadcastToAllAdmins("order_application", "helper_applied", orderId, {
        orderId,
        helperId: userId,
        helperName: user.name,
        companyName: order.companyName,
        applicationsCount: newHelperCount,
      });

      // 멱등성 응답 저장
      if (idempotencyKey) {
        await storeIdempotencyResponse(userId, `POST:/api/orders/${orderId}/apply`, idempotencyKey, 201, application);
      }

      res.status(201).json(application);
    } catch (err: any) {
      console.error("[Apply Error]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // T-05: DELETE /api/orders/:orderId/apply - 헬퍼 지원취소
  app.delete("/api/orders/:orderId/apply", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const orderId = Number(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "유효하지 않은 오더 ID입니다" });
      }

      // 역할 검증: 헬퍼만 취소 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 지원을 취소할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 지원 내역 확인
      const application = await storage.getOrderApplication(orderId, userId);
      if (!application) {
        return res.status(404).json({ message: "지원 내역이 없습니다" });
      }

      // applied 상태에서만 취소 가능 (selected/scheduled 상태는 취소 불가)
      if (application.status !== "applied") {
        return res.status(400).json({ message: "이미 선정되었거나 진행 중인 지원은 취소할 수 없습니다" });
      }

      // 지원 상태를 cancelled로 변경
      await storage.updateOrderApplication(application.id, { status: "cancelled" });

      // 남은 지원자 수 확인 (상태 변경 없음 - open 유지)
      const remainingApplications = await storage.getOrderApplications(orderId);
      const activeApplications = remainingApplications.filter(a =>
        a.status === "applied" || a.status === "selected"
      );

      // 요청자에게 알림 (선택)
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "helper_cancelled",
          title: "지원 취소",
          message: `${user.name || "헬퍼"}님이 지원을 취소했습니다. (${activeApplications.length}/3명)`,
          relatedId: orderId,
        });
      }

      res.json({ success: true, message: "지원이 취소되었습니다" });
    } catch (err: any) {
      console.error("Cancel application error:", err);
      res.status(500).json({ message: "지원 취소에 실패했습니다" });
    }
  });

  // === notification routes moved to routes/notifications.routes.ts ===


  // Contract routes
  app.post("/api/contracts", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { orderId, helperId, totalAmount } = req.body;
      const depRate = await getDepositRate();
      const depositAmount = Math.floor(totalAmount * (depRate / 100));
      const balanceAmount = totalAmount - depositAmount;

      const contract = await storage.createContract({
        orderId,
        requesterId: userId,
        helperId: helperId || null,
        trackingNumber: null,
        totalAmount,
        depositAmount,
        balanceAmount,
        depositPaid: false,
        balancePaid: false,
        status: "pending",
      });

      // Get order info for notification message
      const order = await storage.getOrder(orderId);
      const requester = await storage.getUser(userId);
      const helper = await storage.getUser(helperId);

      // Send push notification to Helper (selected for the job) - includes requester contact info
      const requesterPhone = requester?.phoneNumber || "연락처 미등록";
      await storage.createNotification({
        userId: helperId,
        type: "matching_success",
        title: "매칭 성공",
        message: `${order?.companyName || "배송"} 오더에 선택되었습니다.\n의뢰인: ${requester?.name || "의뢰인"}\n연락처: ${requesterPhone}`,
      });
      // 운영 로그: 민감정보 제외
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Push Notification] Sent to Helper ${helperId}: 매칭 성공`);
      }

      // Send push notification to Requester (confirmation of selection) - includes helper contact info
      const helperPhone = helper?.phoneNumber || "연락처 미등록";
      await storage.createNotification({
        userId,
        type: "matching_success",
        title: "헬퍼 선택 완료",
        message: `${helper?.name || "헬퍼"}님이 ${order?.companyName || "배송"} 오더에 배정되었습니다.\n헬퍼 연락처: ${helperPhone}`,
      });
      // 운영 로그: 민감정보 제외
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Push Notification] Sent to Requester ${userId}: 헬퍼 선택 완료`);
      }

      res.status(201).json(contract);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/contracts", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      let contracts;
      if (user.role === "helper") {
        contracts = await storage.getHelperContracts(userId);
      } else {
        contracts = await storage.getRequesterContracts(userId);
      }

      res.json(contracts);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/contracts/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const contract = await storage.getContract(Number(req.params.id));
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/contracts/:id/payment", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const contractId = Number(req.params.id);
      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      if (contract.requesterId !== userId && contract.helperId !== userId) {
        return res.status(403).json({ message: "이 계약에 대한 권한이 없습니다" });
      }

      const payment = await storage.getPaymentByContract(contractId);
      if (!payment) {
        return res.status(404).json({ message: "결제 정보가 없습니다" });
      }

      res.json(payment);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/contracts/:id/deposit", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const contractId = Number(req.params.id);
      const existingContract = await storage.getContract(contractId);

      const contract = await storage.updateContract(contractId, {
        depositPaid: true,
        depositPaidAt: new Date(),
        downPaymentStatus: "paid",
        status: "deposit_paid",
      });

      // 오더 상태 업데이트: awaiting_deposit → scheduled (계약금 결제 완료)
      if (existingContract?.orderId) {
        const order = await storage.getOrder(existingContract.orderId);
        if (order && order.status === "awaiting_deposit") {
          await storage.updateOrder(existingContract.orderId, { status: "scheduled" });
        }
      }

      res.json(contract);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/contracts/:id/balance", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const contract = await storage.updateContract(Number(req.params.id), {
        balancePaid: true,
        balancePaidAt: new Date(),
        status: "completed",
      });

      res.json(contract);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // 새 운영 체계 APIs - Phase 2: 후보 지원/선택 워크플로우
  // ============================================

  // 헬퍼 지원 API (3명 제한 적용)
  app.post("/api/orders/:orderId/candidates/apply", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 헬퍼만 지원 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 지원 가능합니다" });
      }

      // 오더 확인
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 지원 가능한 상태 확인 (open만 허용)
      const candidateApplyStatus = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(candidateApplyStatus, CAN_APPLY_STATUSES)) {
        return res.status(400).json({
          message: "현재 지원할 수 없는 상태입니다",
          currentStatus: order.status
        });
      }

      // 중복 접수 불가 검증: 헬퍼가 다른 Active 오더가 있으면 지원 불가
      const { hasActive, activeOrder } = await storage.hasActiveOrderAssignment(user.id);
      if (hasActive && activeOrder) {
        return res.status(409).json({
          error: {
            code: "DUPLICATE_ASSIGNMENT",
            message: "이미 예정된 오더가 있어 신규 지원이 불가합니다.",
            details: [{
              field: "activeOrderId",
              reason: `현재 오더: ${activeOrder.companyName} (상태: ${activeOrder.status})`
            }]
          }
        });
      }

      // 이미 지원했는지 확인
      const existingCandidate = await storage.getOrderCandidate(orderId, user.id);
      if (existingCandidate) {
        return res.status(400).json({ message: "이미 지원한 오더입니다" });
      }

      // 현재 활성 후보 수 확인 (최대 3명)
      const activeCount = await storage.countActiveOrderCandidates(orderId);
      if (activeCount >= 3) {
        return res.status(400).json({
          message: "최대 지원자 수(3명)에 도달했습니다",
          maxReached: true
        });
      }

      // 헬퍼 평점 정보 가져오기
      const ratingSummary = await storage.getHelperRatingSummary(user.id);

      // 후보 생성
      const candidate = await storage.createOrderCandidate({
        orderId,
        helperUserId: user.id,
        status: "applied",
        rankSnapshot: JSON.stringify({
          avgRating: ratingSummary?.avgRating || null,
          reviewCount: ratingSummary?.reviewCount || 0,
          completionRate: ratingSummary?.completionRate || null,
          last30dJobs: ratingSummary?.last30dJobs || 0,
        }),
      });

      // 알림 생성 (요청자에게)
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "application" as any,
          title: "새로운 지원자",
          message: `${user.name || "헬퍼"}님이 오더에 지원했습니다. (${activeCount + 1}/3)`,
          data: JSON.stringify({ orderId, candidateId: candidate.id }),
        });
      }

      res.status(201).json({
        success: true,
        candidate,
        remainingSlots: 3 - (activeCount + 1),
      });
    } catch (err: any) {
      console.error("Error in candidate apply:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 후보 목록 조회 (요청자용)
  app.get("/api/orders/:orderId/candidates", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 오더 확인
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인 (요청자 또는 관리자)
      const isOwner = order.requesterId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      // 후보 목록 조회
      const candidates = await storage.getOrderCandidates(orderId);

      // 헬퍼 정보와 평점 정보 조회
      const enrichedCandidates = await Promise.all(
        candidates.map(async (c) => {
          const helper = await storage.getUser(c.helperUserId);
          const ratingSummary = await storage.getHelperRatingSummary(c.helperUserId);
          const helperCredential = await storage.getHelperCredential(c.helperUserId);
          const helperVehicle = await storage.getHelperVehicle(c.helperUserId);

          return {
            ...c,
            helper: helper ? {
              id: helper.id,
              name: helper.name,
              profilePhoto: helper.profileImageUrl || null,
              // 연락처는 선택 후에만 공개
              phone: c.status === "selected" ? helper.phoneNumber : null,
            } : null,
            ratingSummary: ratingSummary ? {
              avgRating: ratingSummary.avgRating,
              totalCompleted: ratingSummary.totalJobs || 0,
              noShowCount: 0,
            } : null,
            credential: helperCredential ? {
              cargoId: helperCredential.licenseNumber || null,
            } : null,
            vehicle: helperVehicle ? {
              type: helperVehicle.vehicleType,
              carModel: helperVehicle.plateNumber || null,
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
      console.error("Error fetching candidates:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 선택 + 연락처 공개 (요청자용)
  app.post("/api/orders/:orderId/candidates/:candidateId/withdraw", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);
      const candidateId = Number(req.params.candidateId);

      // 헬퍼만 취소 가능
      if (user.role !== "helper") {
        return res.status(403).json({
          error: { code: "FORBIDDEN_ROLE", message: "헬퍼만 취소 가능합니다" }
        });
      }

      // 후보 조회
      const candidate = await storage.getOrderCandidateById(candidateId);
      if (!candidate || candidate.orderId !== orderId) {
        return res.status(404).json({
          error: { code: "CANDIDATE_NOT_FOUND", message: "지원 내역이 없습니다" }
        });
      }

      // 본인 지원만 취소 가능
      if (candidate.helperUserId !== user.id) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "본인의 지원만 취소할 수 있습니다" }
        });
      }

      // 이미 선택된 경우 취소 불가 (관리자 조치로 처리)
      if (candidate.status === "selected") {
        return res.status(400).json({
          error: { code: "ALREADY_SELECTED", message: "이미 선택되어 취소할 수 없습니다. 관리자에게 문의하세요." }
        });
      }

      // APPLIED/SHORTLISTED만 WITHDRAWN 가능
      if (!["applied", "shortlisted"].includes(candidate.status || "")) {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: "취소할 수 없는 상태입니다" }
        });
      }

      // 상태 업데이트 (applied/shortlisted → withdrawn)
      const updated = await storage.updateOrderCandidate(candidate.id, {
        status: "withdrawn",
        withdrawnAt: new Date(),
      });

      res.json({
        candidate_id: String(candidate.id),
        status: "WITHDRAWN",
      });
    } catch (err: any) {
      console.error("Error withdrawing candidate:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 지원 취소 (스펙: DELETE /api/orders/{orderId}/candidates/me)
  app.delete("/api/orders/:orderId/candidates/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 헬퍼만 취소 가능
      if (user.role !== "helper") {
        return res.status(403).json({
          error: { code: "FORBIDDEN_ROLE", message: "헬퍼만 취소 가능합니다" }
        });
      }

      // 본인의 후보 조회
      const candidate = await storage.getOrderCandidate(orderId, user.id);
      if (!candidate) {
        return res.status(404).json({
          error: { code: "CANDIDATE_NOT_FOUND", message: "지원 내역이 없습니다" }
        });
      }

      // 이미 취소/탈락된 경우
      if (candidate.status === "withdrawn" || candidate.status === "rejected") {
        return res.status(400).json({
          error: { code: "ALREADY_PROCESSED", message: "이미 처리된 지원입니다" }
        });
      }

      // 이미 선택된 경우 취소 불가 (관리자 조치로 처리)
      if (candidate.status === "selected") {
        return res.status(400).json({
          error: { code: "ALREADY_SELECTED", message: "이미 선택되어 취소할 수 없습니다. 관리자에게 문의하세요." }
        });
      }

      // APPLIED/SHORTLISTED만 WITHDRAWN 가능
      if (!["applied", "shortlisted"].includes(candidate.status || "")) {
        return res.status(400).json({
          error: { code: "INVALID_STATUS", message: "취소할 수 없는 상태입니다" }
        });
      }

      // 상태 업데이트 (applied/shortlisted → withdrawn)
      await storage.updateOrderCandidate(candidate.id, {
        status: "withdrawn",
        withdrawnAt: new Date(),
      });

      // 오더의 지원자 수 갱신
      const order = await storage.getOrder(orderId);
      if (order) {
        const currentCount = (order.currentHelpers || 0) - 1;
        await storage.updateOrder(orderId, {
          currentHelpers: Math.max(0, currentCount),
        });
      }

      res.json({
        ok: true,
        candidateId: candidate.id,
        status: "withdrawn",
      });
    } catch (err: any) {
      console.error("Error withdrawing candidate:", err);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } });
    }
  });

  // 비용 항목 타입 목록 조회 (관리자/요청자용)
  app.get("/api/cost-item-types", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const types = await storage.getAllCostItemTypes();
      res.json(types);
    } catch (err: any) {
      console.error("Error fetching cost item types:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 비용 항목 조회
  app.get("/api/orders/:orderId/cost-items", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인
      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const costItems = await storage.getOrderCostItems(orderId);
      res.json(costItems);
    } catch (err: any) {
      console.error("Error fetching cost items:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 비용 항목 추가 (관리자용)
  app.post("/api/orders/:orderId/cost-items", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 관리자만 비용 항목 추가 가능
      if (!user.isHqStaff) {
        return res.status(403).json({ message: "관리자만 비용 항목을 추가할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      const { typeId, label, amount, memo } = req.body;

      const costItem = await storage.createOrderCostItem({
        orderId,
        typeId: typeId || null,
        label,
        amount,
        memo: memo || null,
        addedBy: user.id,
      });

      res.status(201).json(costItem);
    } catch (err: any) {
      console.error("Error adding cost item:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 비용 항목 삭제 (관리자용)
  app.delete("/api/orders/:orderId/cost-items/:itemId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);
      const itemId = Number(req.params.itemId);

      // 관리자만 삭제 가능
      if (!user.isHqStaff) {
        return res.status(403).json({ message: "관리자만 비용 항목을 삭제할 수 있습니다" });
      }

      await storage.deleteOrderCostItem(itemId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting cost item:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 증빙 업로드 목록 조회
  app.get("/api/orders/:orderId/proofs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인
      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const proofs = await storage.getOrderCarrierProofs(orderId);
      res.json(proofs);
    } catch (err: any) {
      console.error("Error fetching proofs:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 마감 보고서 조회
  app.get("/api/orders/:orderId/closure-report", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인
      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const report = await storage.getOrderClosureReport(orderId);
      res.json(report || null);
    } catch (err: any) {
      console.error("Error fetching closure report:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 마감 보고서 생성/업데이트 (헬퍼용)
  app.post("/api/orders/:orderId/closure-report", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 헬퍼만 마감 보고서 작성 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 마감 보고서를 작성할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 담당 헬퍼인지 확인
      if (order.matchedHelperId !== user.id) {
        return res.status(403).json({ message: "담당 헬퍼만 마감 보고서를 작성할 수 있습니다" });
      }

      // IN_PROGRESS 상태에서만 마감 보고서 작성 가능 (scheduled도 편의상 허용)
      if (!["in_progress", "scheduled"].includes(order.status ?? "")) {
        return res.status(400).json({
          message: "업무 진행 중 상태에서만 마감 보고서를 작성할 수 있습니다",
          currentStatus: order.status,
        });
      }

      const { actualDeliveryCount, memo, anomalyFlag, anomalyDetail } = req.body;

      // 기존 보고서 확인
      const existingReport = await storage.getOrderClosureReport(orderId);

      let report;
      if (existingReport) {
        report = await storage.updateOrderClosureReport(existingReport.id, {
          actualDeliveryCount,
          memo,
          anomalyFlag: anomalyFlag || false,
          anomalyDetail,
        });
      } else {
        report = await storage.createOrderClosureReport({
          orderId,
          helperUserId: user.id,
          actualDeliveryCount,
          memo,
          anomalyFlag: anomalyFlag || false,
          anomalyDetail,
          submittedAt: new Date(),
        });
      }

      res.status(201).json(report);
    } catch (err: any) {
      console.error("Error creating closure report:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 가격 스냅샷 조회
  app.get("/api/orders/:orderId/pricing-snapshot", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인
      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const snapshot = await storage.getOrderPricingSnapshot(orderId);
      res.json(snapshot || null);
    } catch (err: any) {
      console.error("Error fetching pricing snapshot:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/orders/:orderId/contract-breakdown - 계약 금액 breakdown (서버 계산)
  app.get("/api/orders/:orderId/contract-breakdown", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인 - 요청자 또는 관리자만 조회 가능
      const isOwner = order.requesterId === user.id;
      const isAdmin = user.isHqStaff || user.role === 'admin' || user.role === 'superadmin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const pricePerUnit = Number(order.pricePerUnit) || 0;
      const avgQty = parseInt(String(order.averageQuantity || '1').replace(/[^0-9]/g, '')) || 1;

      const supplyAmount = pricePerUnit * avgQty;
      const vatAmount = calculateVat(supplyAmount);
      const totalAmount = supplyAmount + vatAmount;
      const depRate = await getDepositRate();
      const depositAmount = Math.floor(totalAmount * (depRate / 100));
      const balanceAmount = totalAmount - depositAmount;

      res.json({
        pricePerUnit,
        quantity: avgQty,
        supplyAmount,
        vatAmount,
        totalAmount,
        depositRate: depRate,
        depositAmount,
        balanceAmount,
      });
    } catch (err: any) {
      console.error("Error fetching contract breakdown:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 재정산 (관리자용) - 비용 항목 기반 가격 재계산
  app.post("/api/orders/:orderId/reprice", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 관리자만 재정산 가능
      if (!user.isHqStaff) {
        return res.status(403).json({ message: "관리자만 재정산할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 비용 항목 합계 계산
      const costItems = await storage.getOrderCostItems(orderId);
      const costPlusItems = costItems.filter(item => item.type === 'add' || item.type === 'plus');
      const costMinusItems = costItems.filter(item => item.type === 'subtract' || item.type === 'minus');
      const costPlusTotal = costPlusItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const costMinusTotal = costMinusItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      // 기본 단가 × 수량 (공급가 기준)
      const qty = parseInt(String(order.averageQuantity || 0)) || 0;
      const baseSupplyAmount = Number(order.pricePerUnit || 0) * qty + costPlusTotal - costMinusTotal;

      // VAT 10%
      const vatAmount = calculateVat(baseSupplyAmount);
      const grossAmount = baseSupplyAmount + vatAmount;

      // 계약금 (관리자 설정 비율)
      const depRate = await getDepositRate();
      const depositAmount = Math.round(grossAmount * (depRate / 100));
      const balanceAmount = grossAmount - depositAmount;

      // 가격 스냅샷 저장 (스키마 컬럼명과 일치)
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
      console.error("Error repricing order:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 업무 시작 API (SCHEDULED → WORKING)
  // 스펙: POST /api/orders/{orderId}/start
  app.post("/api/orders/:orderId/start", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 헬퍼만 업무 시작 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 업무를 시작할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 담당 헬퍼인지 확인
      if (order.matchedHelperId !== user.id) {
        return res.status(403).json({ message: "담당 헬퍼만 업무를 시작할 수 있습니다" });
      }

      // SCHEDULED 상태에서만 업무 시작 가능
      if (order.status !== "scheduled") {
        return res.status(400).json({
          message: "예정된 상태에서만 업무를 시작할 수 있습니다",
          currentStatus: order.status,
        });
      }

      // 오더 상태 업데이트 (SCHEDULED → WORKING/in_progress)
      await storage.updateOrder(orderId, {
        status: "in_progress",
      });

      // 오더 상태 이벤트 기록
      await storage.createOrderStatusEvent({
        orderId,
        previousStatus: "scheduled",
        newStatus: "in_progress",
        reason: "업무 시작",
        changedBy: user.id,
      });

      // 요청자에게 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "work_started" as any,
          title: "업무 시작",
          message: `${user.name || "헬퍼"}님이 ${order.companyName} 오더의 업무를 시작했습니다.`,
          data: JSON.stringify({ orderId }),
        });
      }

      res.json({
        success: true,
        newStatus: "in_progress",
      });
    } catch (err: any) {
      console.error("Error starting work:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // QR 체크인 API - QR 코드 스캔 후 업무 시작
  // 스펙: POST /api/orders/{orderId}/qr-checkin
  app.post("/api/orders/:orderId/qr-checkin", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);
      const { qrData, timestamp } = req.body;

      // 헬퍼만 체크인 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 체크인할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 담당 헬퍼인지 확인
      if (order.matchedHelperId !== user.id) {
        return res.status(403).json({ message: "담당 헬퍼만 체크인할 수 있습니다" });
      }

      // SCHEDULED 상태에서만 체크인 가능
      if (order.status !== "scheduled") {
        return res.status(400).json({
          message: "예정된 상태에서만 체크인할 수 있습니다",
          currentStatus: order.status,
        });
      }

      // QR 코드 검증 - 요청자 QR 코드와 매칭
      // QR 데이터 형식: hellpme://checkin/{requesterId}/{orderIdHash}
      let qrValid = false;
      if (qrData && order.requesterId) {
        // QR 코드가 order.requesterId를 포함하는지 검증
        // 간단한 검증 - 실제로는 암호화된 토큰 검증 필요
        if (qrData.includes(`hellpme://checkin/${order.requesterId}`) ||
          qrData.includes(`order:${orderId}`) ||
          qrData === `checkin-${order.requesterId}-${orderId}`) {
          qrValid = true;
        }
      }

      // 체크인 기록 저장 (QR 검증 여부와 관계없이 기록)
      const checkinTime = timestamp ? new Date(timestamp) : new Date();

      // 오더 상태 업데이트 (SCHEDULED → in_progress)
      await storage.updateOrder(orderId, {
        status: "in_progress",
      });

      // 오더 상태 이벤트 기록
      await storage.createOrderStatusEvent({
        orderId,
        previousStatus: "scheduled",
        newStatus: "in_progress",
        reason: qrValid ? "QR 체크인으로 업무 시작" : "QR 스캔으로 업무 시작 (미검증)",
        changedBy: user.id,
      });

      // 요청자에게 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "work_started" as any,
          title: "업무 시작",
          message: `${user.name || "헬퍼"}님이 ${order.companyName} 오더에 QR 체크인하여 업무를 시작했습니다.`,
          data: JSON.stringify({ orderId, checkinTime: checkinTime.toISOString() }),
        });
      }

      res.json({
        success: true,
        message: "출근 체크인 완료! 업무가 시작되었습니다.",
        newStatus: "in_progress",
        checkinTime: checkinTime.toISOString(),
        qrVerified: qrValid,
      });
    } catch (err: any) {
      console.error("Error QR checkin:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // T-17: QR 시작 토큰 (1회성/만료) 발급 및 검증
  // ============================================

  // POST /api/orders/:orderId/qr/start/create - QR 시작 토큰 발급 (관리자/요청자)
  app.post("/api/orders/:orderId/qr/start/create", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);
      const { expiryHours = 24 } = req.body;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 요청자 또는 관리자만 토큰 발급 가능
      if (user.role !== "requester" && user.role !== "admin" && !user.isHqStaff) {
        return res.status(403).json({ message: "토큰 발급 권한이 없습니다" });
      }

      // 요청자인 경우 본인 오더인지 확인
      if (user.role === "requester" && order.requesterId !== user.id) {
        return res.status(403).json({ message: "본인 오더에만 토큰을 발급할 수 있습니다" });
      }

      // SCHEDULED 상태에서만 토큰 발급 가능
      if (order.status !== "scheduled") {
        return res.status(400).json({
          message: "예정된 상태에서만 시작 토큰을 발급할 수 있습니다",
          currentStatus: order.status,
        });
      }

      // 기존 유효 토큰 무효화
      await db.update(orderStartTokens)
        .set({ isRevoked: true })
        .where(and(
          eq(orderStartTokens.orderId, orderId),
          sql`${orderStartTokens.usedAt} IS NULL`,
          eq(orderStartTokens.isRevoked, false)
        ));

      // 새 토큰 생성
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      const [newToken] = await db.insert(orderStartTokens).values({
        orderId,
        token,
        createdBy: user.id,
        createdByRole: user.role === "admin" || user.isHqStaff ? "ADMIN" : "REQUESTER",
        expiresAt,
      }).returning();

      // QR 코드 데이터 생성
      const qrData = `hellpme://order/${orderId}/start?token=${token}`;

      res.json({
        success: true,
        tokenId: newToken.id,
        token,
        qrData,
        expiresAt: expiresAt.toISOString(),
        expiryHours,
      });
    } catch (err: any) {
      console.error("Error creating QR start token:", err);
      res.status(500).json({ message: "토큰 생성에 실패했습니다" });
    }
  });

  // POST /api/orders/:orderId/qr/start/verify - QR 시작 토큰 검증 (헬퍼)
  app.post("/api/orders/:orderId/qr/start/verify", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ code: "INVALID_INPUT", message: "토큰이 필요합니다" });
      }

      // 헬퍼만 검증 가능
      if (user.role !== "helper") {
        return res.status(403).json({ code: "FORBIDDEN", message: "헬퍼만 업무를 시작할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ code: "NOT_FOUND", message: "오더를 찾을 수 없습니다" });
      }

      // 배정된 헬퍼인지 확인
      if (order.matchedHelperId !== user.id && order.helperId !== user.id) {
        return res.status(403).json({ code: "NOT_ASSIGNED", message: "배정된 기사만 시작할 수 있습니다" });
      }

      // 이미 업무중인지 확인
      if (order.status === "in_progress") {
        return res.status(400).json({ code: "ALREADY_STARTED", message: "이미 업무중 처리된 오더입니다" });
      }

      // SCHEDULED 상태에서만 시작 가능
      if (order.status !== "scheduled") {
        return res.status(400).json({
          code: "INVALID_STATUS",
          message: "예정된 상태에서만 업무를 시작할 수 있습니다",
          currentStatus: order.status,
        });
      }

      // 토큰 조회
      const [tokenRecord] = await db.select()
        .from(orderStartTokens)
        .where(and(
          eq(orderStartTokens.orderId, orderId),
          eq(orderStartTokens.token, token)
        ))
        .limit(1);

      if (!tokenRecord) {
        return res.status(400).json({ code: "INVALID_TOKEN", message: "유효하지 않은 QR입니다" });
      }

      // 토큰 만료 확인
      if (new Date() > tokenRecord.expiresAt) {
        return res.status(400).json({ code: "TOKEN_EXPIRED", message: "만료된 QR입니다" });
      }

      // 이미 사용된 토큰인지 확인
      if (tokenRecord.usedAt) {
        return res.status(400).json({ code: "TOKEN_USED", message: "이미 사용된 QR입니다" });
      }

      // 취소된 토큰인지 확인
      if (tokenRecord.isRevoked) {
        return res.status(400).json({ code: "TOKEN_REVOKED", message: "취소된 QR입니다" });
      }

      // 토큰 사용 처리
      await db.update(orderStartTokens)
        .set({
          usedAt: new Date(),
          usedBy: user.id,
        })
        .where(eq(orderStartTokens.id, tokenRecord.id));

      // 오더 상태 업데이트 (SCHEDULED → IN_PROGRESS)
      await storage.updateOrder(orderId, {
        status: "in_progress",
        checkedInAt: new Date(),
      });

      // 오더 상태 이벤트 기록
      await storage.createOrderStatusEvent({
        orderId,
        previousStatus: "scheduled",
        newStatus: "in_progress",
        reason: "QR 토큰 검증으로 업무 시작",
        changedBy: user.id,
      });

      // 감사 로그 기록
      await db.insert(auditLogs).values({
        actorRole: "HELPER",
        userId: user.id,
        action: "QR_START_VERIFIED",
        orderId,
        targetType: "order",
        targetId: String(orderId),
        reason: "QR 토큰으로 업무 시작",
        oldValue: JSON.stringify({ status: "scheduled" }),
        newValue: JSON.stringify({ status: "in_progress" }),
      });

      // 요청자에게 알림 + 푸시
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "work_started" as any,
          title: "업무 시작",
          message: `${user.name || "헬퍼"}님이 ${order.companyName} 오더의 업무를 시작했습니다.`,
          data: JSON.stringify({ orderId, checkinTime: new Date().toISOString() }),
        });

        // 푸시 알림 발송
        sendPushToUser(order.requesterId, {
          title: "업무 시작",
          body: `${user.name || "헬퍼"}님이 ${order.companyName} 오더의 업무를 시작했습니다.`,
          url: `/orders/${orderId}`,
          tag: `work-started-${orderId}`,
        });
      }

      res.json({
        success: true,
        message: "업무가 시작되었습니다",
        newStatus: "in_progress",
        checkinTime: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Error verifying QR start token:", err);
      res.status(500).json({ message: "토큰 검증에 실패했습니다" });
    }
  });

  // GET /api/orders/:orderId/qr/start/status - 현재 토큰 상태 조회
  app.get("/api/orders/:orderId/qr/start/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인 (요청자/관리자/배정된 헬퍼)
      const isRequester = order.requesterId === user.id;
      const isHelper = order.matchedHelperId === user.id || order.helperId === user.id;
      const isAdmin = user.role === "admin" || user.isHqStaff;

      if (!isRequester && !isHelper && !isAdmin) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      // 최신 유효 토큰 조회
      const [latestToken] = await db.select()
        .from(orderStartTokens)
        .where(and(
          eq(orderStartTokens.orderId, orderId),
          eq(orderStartTokens.isRevoked, false)
        ))
        .orderBy(desc(orderStartTokens.createdAt))
        .limit(1);

      if (!latestToken) {
        return res.json({
          hasToken: false,
          orderStatus: order.status,
        });
      }

      const isExpired = new Date() > latestToken.expiresAt;
      const isUsed = !!latestToken.usedAt;

      res.json({
        hasToken: true,
        tokenStatus: isUsed ? "used" : isExpired ? "expired" : "valid",
        expiresAt: latestToken.expiresAt.toISOString(),
        usedAt: latestToken.usedAt?.toISOString() || null,
        orderStatus: order.status,
        // QR 데이터는 요청자/관리자에게만 표시
        qrData: (isRequester || isAdmin) && !isUsed && !isExpired
          ? `hellpme://order/${orderId}/start?token=${latestToken.token}`
          : null,
      });
    } catch (err: any) {
      console.error("Error getting QR token status:", err);
      res.status(500).json({ message: "토큰 상태 조회에 실패했습니다" });
    }
  });

  // 업무 종료 API (WORKING → CLOSED) - 마감 보고서 제출 후
  app.post("/api/orders/:orderId/end-work", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 헬퍼만 업무 종료 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 업무를 종료할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 담당 헬퍼인지 확인
      if (order.matchedHelperId !== user.id) {
        return res.status(403).json({ message: "담당 헬퍼만 업무를 종료할 수 있습니다" });
      }

      // in_progress 상태에서만 업무 종료 가능
      if (order.status !== "in_progress") {
        return res.status(400).json({
          message: "진행 중 상태에서만 업무를 종료할 수 있습니다",
          currentStatus: order.status,
        });
      }

      // 마감 보고서가 있는지 확인
      const closureReport = await storage.getOrderClosureReport(orderId);
      if (!closureReport) {
        return res.status(400).json({
          message: "먼저 마감 보고서를 제출해주세요",
        });
      }

      // 오더 상태 업데이트 (WORKING → CLOSED)
      await storage.updateOrder(orderId, {
        status: "closed",
      });

      // 마감 보고서에 승인 시간 기록
      await storage.updateOrderClosureReport(closureReport.id, {
        approvedAt: new Date(),
        approvedBy: user.id,
      });

      // 오더 상태 이벤트 기록
      await storage.createOrderStatusEvent({
        orderId,
        previousStatus: "in_progress",
        newStatus: "closed",
        reason: "업무 완료 및 마감 보고서 제출",
        changedBy: user.id,
      });

      // 요청자에게 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "work_completed" as any,
          title: "업무 완료",
          message: `${user.name || "헬퍼"}님이 ${order.companyName} 오더의 업무를 완료했습니다.`,
          data: JSON.stringify({ orderId }),
        });
      }

      res.json({
        success: true,
        newStatus: "closed",
        closureReport,
      });
    } catch (err: any) {
      console.error("Error ending work:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 증빙 파일 업로드 API (헬퍼용)
  app.post("/api/orders/:orderId/proofs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 헬퍼만 증빙 업로드 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 증빙을 업로드할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 담당 헬퍼인지 확인
      if (order.matchedHelperId !== user.id) {
        return res.status(403).json({ message: "담당 헬퍼만 증빙을 업로드할 수 있습니다" });
      }

      const { fileKey, fileName, fileType, proofType } = req.body;

      if (!fileKey) {
        return res.status(400).json({ message: "파일 키가 필요합니다" });
      }

      const proof = await storage.createCarrierProofUpload({
        orderId,
        helperUserId: user.id,
        fileKey,
        fileName: fileName || null,
        fileType: fileType || null,
        proofType: proofType || "delivery", // delivery, pickup, damage, etc.
      });

      res.status(201).json(proof);
    } catch (err: any) {
      console.error("Error uploading proof:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 증빙 파일 삭제 API (헬퍼용)
  app.delete("/api/orders/:orderId/proofs/:proofId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);
      const proofId = Number(req.params.proofId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 담당 헬퍼 또는 관리자만 삭제 가능
      if (order.matchedHelperId !== user.id && !user.isHqStaff) {
        return res.status(403).json({ message: "삭제 권한이 없습니다" });
      }

      await storage.deleteCarrierProofUpload(proofId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting proof:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Phase 3: 정산 통합 APIs - 계약금/잔여금 분리, 수수료 차감
  // ============================================

  // 잔여금 청구서 조회
  app.get("/api/orders/:orderId/balance-invoice", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인
      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      const invoice = await storage.getOrderBalanceInvoice(orderId);
      res.json(invoice || null);
    } catch (err: any) {
      console.error("Error fetching balance invoice:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 잔여금 청구서 생성 (오더 마감 후 관리자가 생성)
  app.post("/api/orders/:orderId/balance-invoice", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 관리자만 잔여금 청구서 생성 가능
      if (!user.isHqStaff) {
        return res.status(403).json({ message: "관리자만 잔여금 청구서를 생성할 수 있습니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // CLOSED 또는 SETTLEMENT_PAID 상태에서만 잔여금 청구서 생성 가능
      if (!["closed", "settlement_paid"].includes(order.status ?? "")) {
        return res.status(400).json({
          message: "마감된 오더에서만 잔여금 청구서를 생성할 수 있습니다",
          currentStatus: order.status,
        });
      }

      // 가격 스냅샷 확인
      const snapshot = await storage.getOrderPricingSnapshot(orderId);
      if (!snapshot) {
        return res.status(400).json({ message: "먼저 가격 재계산을 해주세요" });
      }

      // 기존 청구서 확인
      const existingInvoice = await storage.getOrderBalanceInvoice(orderId);
      if (existingInvoice) {
        return res.status(400).json({ message: "이미 잔여금 청구서가 존재합니다" });
      }

      // 잔금 금액 검증
      const balanceAmount = Number(snapshot.balanceKrw);

      // 음수 잔금 처리 (환불 필요 케이스)
      if (balanceAmount < 0) {
        return res.status(400).json({
          message: "잔금이 음수입니다. 환불 처리가 필요합니다.",
          balanceAmount,
          note: "계약금이 최종금액보다 많습니다. 관리자에게 문의하세요.",
        });
      }

      // 0원 잔금 처리 (결제 생략)
      if (balanceAmount === 0) {
        // 0원 청구서를 "paid"로 바로 생성
        const invoice = await storage.createBalanceInvoice({
          orderId,
          pricingSnapshotId: snapshot.id,
          balanceAmountKrw: 0,
          status: "paid",
          issuedAt: new Date(),
          issuedBy: user.id,
          paidAt: new Date(),
        });

        // 오더 상태 자동 변경 (BALANCE_PAID)
        await storage.updateOrder(orderId, { status: "balance_paid" });
        await storage.createOrderStatusEvent({
          orderId,
          previousStatus: order.status,
          newStatus: "balance_paid",
          reason: "잔금 0원 (자동 완료)",
          changedBy: user.id,
        });

        return res.status(201).json({
          invoice,
          message: "잔금이 0원이므로 결제 없이 완료 처리되었습니다."
        });
      }

      // 청구서 생성 (일반 케이스)
      const invoice = await storage.createBalanceInvoice({
        orderId,
        pricingSnapshotId: snapshot.id,
        balanceAmountKrw: balanceAmount,
        status: "pending",
        issuedAt: new Date(),
        issuedBy: user.id,
      });

      // 요청자에게 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "balance_invoice" as any,
          title: "잔여금 청구",
          message: `${order.companyName} 오더의 잔여금 ₩${Number(snapshot.balanceKrw).toLocaleString()}이 청구되었습니다.`,
          data: JSON.stringify({ orderId, invoiceId: invoice.id }),
        });
      }

      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating balance invoice:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 잔여금 결제 확인 (입금 확인 후 관리자가 처리)
  app.patch("/api/orders/:orderId/balance-invoice/paid", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      // 관리자만 결제 확인 가능
      if (!user.isHqStaff) {
        return res.status(403).json({ message: "관리자만 결제를 확인할 수 있습니다" });
      }

      const invoice = await storage.getOrderBalanceInvoice(orderId);
      if (!invoice) {
        return res.status(404).json({ message: "잔여금 청구서를 찾을 수 없습니다" });
      }

      if (invoice.status !== "pending") {
        return res.status(400).json({ message: "이미 처리된 청구서입니다" });
      }

      const updated = await storage.updateBalanceInvoice(invoice.id, {
        status: "paid",
        paidAt: new Date(),
      });

      // 오더 상태 변경: FINAL_AMOUNT_CONFIRMED → BALANCE_PAID
      const order = await storage.getOrder(orderId);
      if (order) {
        await storage.updateOrder(orderId, {
          status: "balance_paid",
        });

        // 오더 상태 이벤트 기록
        await storage.createOrderStatusEvent({
          orderId,
          previousStatus: order.status,
          newStatus: "balance_paid",
          reason: "잔여금 결제 완료",
          changedBy: user.id,
        });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Error updating balance invoice:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 잔여금 결제 요청 (요청자가 결제 시작)
  // 스펙: POST /api/orders/{orderId}/balance-invoice/pay
  app.post("/api/orders/:orderId/balance-invoice/pay", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);
      const { payment_method, return_url } = req.body;

      // 요청자만 결제 가능
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({
          error: { code: "ORDER_NOT_FOUND", message: "오더를 찾을 수 없습니다" }
        });
      }

      if (order.requesterId !== user.id) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "요청자만 결제할 수 있습니다" }
        });
      }

      // 잔여금 청구서 확인
      const invoice = await storage.getOrderBalanceInvoice(orderId);
      if (!invoice) {
        return res.status(404).json({
          error: { code: "INVOICE_NOT_FOUND", message: "잔여금 청구서가 없습니다" }
        });
      }

      if (invoice.status !== "pending") {
        return res.status(400).json({
          error: { code: "INVALID_INVOICE_STATUS", message: "결제 대기 상태가 아닙니다" }
        });
      }

      // 결제 금액
      const amount = Number(invoice.amount);

      // payments 테이블에 결제 요청 생성 (PortOne 연동 준비)
      const payment = await storage.createPayment({
        userId: user.id,
        amount,
        type: "balance",
        status: "pending",
        metadata: JSON.stringify({
          orderId,
          invoiceId: invoice.id,
          paymentMethod: payment_method || "CARD",
          returnUrl: return_url || "",
        }),
      });

      // 청구서에 결제 ID 연결
      await storage.updateBalanceInvoice(invoice.id, {
        paymentId: payment.id,
      });

      // PortOne 결제 URL 생성 (실제 SDK 연동 시 여기서 PortOne API 호출)
      // 현재는 결제 정보만 반환하고 클라이언트에서 PortOne SDK로 결제 진행
      res.json({
        invoice_id: String(invoice.id),
        status: "PENDING",
        payment: {
          payment_id: String(payment.id),
          provider: "PORTONE",
          amount,
          order_name: `오더 #${orderId} 잔여금`,
          customer_email: user.email,
        },
      });
    } catch (err: any) {
      console.error("Error initiating balance payment:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 정산 요약 조회 (오더별)
  app.get("/api/orders/:orderId/settlement-summary", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 권한 확인
      const isOwner = order.requesterId === user.id || order.matchedHelperId === user.id;
      const isAdmin = user.isHqStaff;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "조회 권한이 없습니다" });
      }

      // 각 정보 조회
      const pricingSnapshot = await storage.getOrderPricingSnapshot(orderId);
      const costItems = await storage.getOrderCostItems(orderId);
      const balanceInvoice = await storage.getOrderBalanceInvoice(orderId);
      const closureReport = await storage.getOrderClosureReport(orderId);

      // 수수료율 조회 (매칭 스냅샷 > 헬퍼별 실효 수수료율 > 글로벌 설정)
      let commissionRatePercent = 12; // 기본값
      if (order.matchedHelperId) {
        const [matchedApp] = await db.select().from(orderApplications)
          .where(and(
            eq(orderApplications.orderId, orderId),
            eq(orderApplications.helperId, order.matchedHelperId)
          ))
          .limit(1);
        if (matchedApp?.snapshotCommissionRate != null) {
          commissionRatePercent = matchedApp.snapshotCommissionRate;
        } else {
          const effectiveRate = await storage.getEffectiveCommissionRate(order.matchedHelperId);
          commissionRatePercent = effectiveRate.rate;
        }
      }
      const baseAmount = pricingSnapshot ? Number(pricingSnapshot.baseSupplyAmount) : 0;
      const commissionAmount = Math.round(baseAmount * commissionRatePercent / 100);
      const helperPayout = baseAmount - commissionAmount;

      res.json({
        orderId,
        orderStatus: order.status,
        pricing: pricingSnapshot ? {
          baseSupplyAmount: Number(pricingSnapshot.baseSupplyAmount),
          costPlusTotal: Number(pricingSnapshot.costPlusTotal || 0),
          costMinusTotal: Number(pricingSnapshot.costMinusTotal || 0),
          vat: Number(pricingSnapshot.vatAmount),
          grossAmount: Number(pricingSnapshot.grossAmount),
          deposit: Number(pricingSnapshot.depositAmount),
          balance: Number(pricingSnapshot.balanceAmount),
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
          commissionRate: commissionRatePercent,
          commissionAmount,
          netPayout: helperPayout,
        },
      });
    } catch (err: any) {
      console.error("Error fetching settlement summary:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Work confirmation routes
  // Get helper's completed orders for review
  app.get("/api/helper/completed-orders-for-review", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      // Get all completed contracts for this helper
      const helperContracts2 = await storage.getHelperContracts(userId);
      const completedContracts = helperContracts2.filter(c => c.status === "completed");

      const ordersForReview: any[] = [];
      for (const contract of completedContracts) {
        const order = await storage.getOrder(contract.orderId);
        // Check for helper->requester review specifically
        const existingReview = await storage.getReviewByContractAndType(contract.id, "helper");

        if (order) {
          const requester = order.requesterId ? await storage.getUser(order.requesterId) : null;
          ordersForReview.push({
            id: order.id,
            orderId: order.id,
            contractId: contract.id,
            companyName: order.companyName,
            pricePerUnit: order.pricePerUnit,
            averageQuantity: order.averageQuantity,
            deliveryArea: order.deliveryArea,
            scheduledDate: order.scheduledDate,
            vehicleType: order.vehicleType,
            requesterId: order.requesterId,
            requesterName: requester?.name || "의뢰인",
            hasReview: !!existingReview,
          });
        }
      }

      res.json(ordersForReview);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper submits review for requester
  app.post("/api/helper/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 리뷰를 작성할 수 있습니다" });
      }

      const { contractId, orderId, requesterId, rating, comment } = req.body;

      if (!contractId || !orderId || !requesterId || !rating) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "평점은 1-5 사이여야 합니다" });
      }

      if (comment && comment.length > 100) {
        return res.status(400).json({ message: "리뷰는 100자 이내로 작성해주세요" });
      }

      // Check if helper->requester review already exists for this contract
      const existingReview = await storage.getReviewByContractAndType(contractId, "helper");
      if (existingReview) {
        return res.status(400).json({ message: "이미 리뷰를 작성했습니다" });
      }

      const review = await storage.createReview({
        contractId,
        orderId,
        helperId: userId,
        requesterId,
        reviewerType: "helper", // Helper reviewing requester
        rating,
        comment: comment || "",
      });

      res.status(201).json(review);
    } catch (err: any) {
      console.error("Helper review error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/helper/settlement - 헬퍼 월별 정산 요약
  app.get("/api/helper/settlement", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

      // 해당 월의 시작/끝 날짜
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // 1. 마감 보고서 조회 (closing_submitted 상태 포함)
      const helperClosingReports = await db.select()
        .from(closingReports)
        .where(eq(closingReports.helperId, user.id));

      // 해당 월 마감 보고서의 오더 정보 조회
      const closingWorkDays: any[] = [];
      let closingSupplyAmount = 0;
      let closingVatAmount = 0;
      let closingDeductions = 0;

      for (const report of helperClosingReports) {
        const order = await storage.getOrder(report.orderId);
        if (!order) continue;

        // scheduledDate 기준으로 해당 월 확인 (fallback: closingReport.createdAt)
        // scheduledDate는 ISO 형식(2026-02-19) 또는 한국어 형식(2월 19일) 가능
        let workDate: Date | null = null;

        if (order.scheduledDate) {
          const parsed = new Date(order.scheduledDate);
          if (!isNaN(parsed.getTime())) {
            workDate = parsed;
          } else {
            // 한국어 날짜 형식 파싱 (예: "2월 19일", "12월 3일")
            const korMatch = order.scheduledDate.match(/(\d{1,2})월\s*(\d{1,2})일?/);
            if (korMatch) {
              workDate = new Date(year, parseInt(korMatch[1]) - 1, parseInt(korMatch[2]));
            }
          }
        }

        // fallback: 마감보고서 생성일
        if (!workDate || isNaN(workDate.getTime())) {
          workDate = report.createdAt ? new Date(report.createdAt) : null;
        }

        if (!workDate || isNaN(workDate.getTime())) continue;
        if (workDate < startDate || workDate > endDate) continue;
        // 통합 계산 모듈 사용 (Single Source of Truth)
        const closingData = parseClosingReport(report, order);
        const settlement = calculateSettlement(closingData);

        const deliveredCount = settlement.deliveredCount;
        const returnedCount = settlement.returnedCount;
        const pricePerUnit = closingData.unitPrice;
        const etcCount = settlement.etcCount;
        const etcAmount = settlement.etcAmount;
        const extraCostsTotal = settlement.extraCostsTotal;
        const supplyAmount = settlement.supplyAmount;
        const vatAmount = settlement.vatAmount;
        const dailyRate = settlement.totalAmount; // VAT 포함 총액
        closingSupplyAmount += supplyAmount;
        closingVatAmount += vatAmount;

        // 차감액 계산 (확정된 사고보고서만 - helperDeductionApplied가 true인 것)
        const incidentReportsForOrder = await db.select()
          .from(incidentReports)
          .where(and(
            eq(incidentReports.orderId, report.orderId),
            eq(incidentReports.helperDeductionApplied, true)
          ));
        const orderDeductions = incidentReportsForOrder.reduce((sum, ir) => sum + (ir.deductionAmount || 0), 0);
        closingDeductions += orderDeductions;

        closingWorkDays.push({
          date: workDate.toISOString().split('T')[0],
          orderId: report.orderId,
          orderTitle: order.companyName || order.deliveryArea || '오더',
          pricePerUnit: order.pricePerUnit || 0,
          dailyRate: dailyRate, // VAT 포함 총액
          supplyAmount: supplyAmount, // 공급가
          vatAmount: vatAmount, // VAT
          deliveredCount: deliveredCount,
          returnedCount: report.returnedCount || 0,
          etcCount: etcCount,
          etcAmount: etcAmount,
          extraCostsTotal: extraCostsTotal,
          status: report.status,
          closingReportId: report.id,
          hasDeduction: orderDeductions > 0,
          deductionAmount: orderDeductions,
        });
      }

      // 2. 기존 정산서도 조회 (아직 마감 보고서가 없는 경우)
      const allSettlements = await storage.getAllSettlementStatements();
      const helperSettlements = allSettlements.filter(s => {
        if (s.helperId !== user.id) return false;
        if (!s.workDate) return false;
        const d = new Date(s.workDate);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });

      // 중복 제거 (마감 보고서에 이미 있는 오더 제외)
      const closingOrderIds = new Set(closingWorkDays.map(w => w.orderId));
      const settlementWorkDays = await Promise.all(
        helperSettlements
          .filter(s => !closingOrderIds.has(s.orderId))
          .map(async (s) => {
            const order = s.orderId ? await storage.getOrder(s.orderId) : null;
            return {
              date: s.workDate,
              orderId: s.orderId,
              orderTitle: order?.companyName || order?.deliveryArea || '오더',
              dailyRate: s.basePay || 0,
              deliveredCount: 0,
              returnedCount: 0,
              status: s.status,
              hasDeduction: (s.deduction || 0) > 0,
              deductionAmount: s.deduction || 0,
            };
          })
      );

      // 전체 근무일 목록 합치기
      const workDays = [...closingWorkDays, ...settlementWorkDays].sort((a, b) =>
        new Date(a.date!).getTime() - new Date(b.date!).getTime()
      );

      // 합계 계산 (부가세 별도 기준)
      const settlementIncome = helperSettlements
        .filter(s => !closingOrderIds.has(s.orderId))
        .reduce((sum, s) => sum + (s.basePay || 0), 0);
      const supplyAmount = closingSupplyAmount + settlementIncome; // 공급가액 (VAT 별도)
      const vat = closingVatAmount + calculateVat(settlementIncome); // 부가세 10%
      const totalAmount = supplyAmount + vat; // 합계 (공급가액 + 부가세)

      // 수수료 계산 (헬퍼별 실효 수수료율 사용 - 우선순위: 헬퍼별 > 팀별 > 글로벌 > 기본값)
      const effectiveRate = await storage.getEffectiveCommissionRate(user.id);
      const commissionRate = effectiveRate.rate;
      const commissionAmount = Math.round(totalAmount * commissionRate / 100);

      const settlementDeductions = helperSettlements
        .filter(s => !closingOrderIds.has(s.orderId))
        .reduce((sum, s) => sum + (s.deduction || 0), 0);
      const deductions = closingDeductions + settlementDeductions;
      const payoutAmount = totalAmount - commissionAmount - deductions; // 지급액 (합계 - 수수료 - 차감액)

      res.json({
        supplyAmount, // 공급가액
        vat, // 부가세
        totalAmount, // 합계
        commissionRate, // 수수료율 (%)
        commissionAmount, // 수수료
        deductions, // 차감액
        payoutAmount, // 지급액
        workDays,
      });
    } catch (err: any) {
      console.error("Helper settlement error:", err);
      res.status(500).json({ message: "정산 정보를 불러오는데 실패했습니다" });
    }
  });

  // GET /api/helper/work-detail - 특정 날짜/오더 근무 상세
  app.get("/api/helper/work-detail", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const date = req.query.date as string;
      const orderId = req.query.orderId ? parseInt(req.query.orderId as string) : null;

      if (!date && !orderId) {
        return res.status(400).json({ message: "날짜 또는 오더ID가 필요합니다" });
      }

      // 1. 먼저 마감 보고서에서 조회 시도
      let closingReport: any = null;
      let order: any = null;

      if (orderId) {
        // 오더 ID로 직접 조회
        const [report] = await db.select()
          .from(closingReports)
          .where(and(
            eq(closingReports.orderId, orderId),
            eq(closingReports.helperId, user.id)
          ))
          .limit(1);
        closingReport = report;
        order = await storage.getOrder(orderId);
      } else if (date) {
        // 날짜로 조회 - 마감 보고서가 있는 오더 찾기
        const helperReports = await db.select()
          .from(closingReports)
          .where(eq(closingReports.helperId, user.id));

        for (const report of helperReports) {
          const reportOrder = await storage.getOrder(report.orderId);
          if (reportOrder?.scheduledDate) {
            const orderDate = new Date(reportOrder.scheduledDate).toISOString().split('T')[0];
            if (orderDate === date) {
              closingReport = report;
              order = reportOrder;
              break;
            }
          }
        }
      }

      // 2. 마감 보고서가 없으면 정산서에서 조회
      let settlement: any = null;
      if (!closingReport) {
        const allSettlements = await storage.getAllSettlementStatements();
        settlement = allSettlements.find(s => {
          if (s.helperId !== user.id) return false;
          if (orderId && s.orderId === orderId) return true;
          if (date && s.workDate) {
            const settlementDate = new Date(s.workDate).toISOString().split('T')[0];
            return settlementDate === date;
          }
          return false;
        });

        if (settlement) {
          order = settlement.orderId ? await storage.getOrder(settlement.orderId) : null;
          // 해당 정산서의 오더에 대한 마감 보고서 조회
          if (settlement.orderId) {
            const [report] = await db.select()
              .from(closingReports)
              .where(eq(closingReports.orderId, settlement.orderId))
              .limit(1);
            closingReport = report;
          }
        }
      }

      if (!closingReport && !settlement) {
        return res.status(404).json({ message: "해당 날짜의 근무 정보를 찾을 수 없습니다" });
      }

      // 이미지 파싱
      const deliveryHistoryImages = closingReport?.deliveryHistoryImagesJson
        ? JSON.parse(closingReport.deliveryHistoryImagesJson)
        : [];
      const etcImages = closingReport?.etcImagesJson
        ? JSON.parse(closingReport.etcImagesJson)
        : [];
      const dynamicFields = closingReport?.dynamicFieldsJson
        ? JSON.parse(closingReport.dynamicFieldsJson)
        : {};

      // 사고보고서에서 차감액 조회
      // 차감액 조회 (확정된 사고보고서만 - helperDeductionApplied가 true인 것)
      const orderIdToCheck = closingReport?.orderId || settlement?.orderId;
      let deductionAmount = 0;
      let deductionReason = '';
      if (orderIdToCheck) {
        const orderIncidents = await db.select()
          .from(incidentReports)
          .where(and(
            eq(incidentReports.orderId, orderIdToCheck),
            eq(incidentReports.helperDeductionApplied, true)
          ));
        deductionAmount = orderIncidents.reduce((sum, ir) => sum + (ir.deductionAmount || 0), 0);
        if (orderIncidents.length > 0) {
          deductionReason = orderIncidents.map(ir => ir.incidentType).join(', ');
        }
      }

      // 금액 계산: 마감 보고서 있으면 통합 계산 모듈 사용 (기타건수, 기타비용 포함)
      let supplyAmount: number;
      let vatAmount: number;
      let totalAmount: number;
      let dailyRate: number;
      const pricePerUnit = order?.pricePerUnit || 0;

      if (closingReport) {
        const closingData = parseClosingReport(closingReport, order);
        const closingCalc = calculateSettlement(closingData);
        supplyAmount = closingCalc.supplyAmount;
        vatAmount = closingCalc.vatAmount;
        totalAmount = closingCalc.totalAmount;
        dailyRate = supplyAmount;
      } else if (settlement) {
        dailyRate = settlement.basePay || 0;
        supplyAmount = dailyRate;
        vatAmount = Math.round(supplyAmount * 0.1);
        totalAmount = supplyAmount + vatAmount;
      } else {
        const deliveredCountForCalc = closingReport?.deliveredCount || 0;
        const returnedCountForCalc = closingReport?.returnedCount || 0;
        dailyRate = pricePerUnit * (deliveredCountForCalc + returnedCountForCalc);
        supplyAmount = dailyRate;
        vatAmount = Math.round(supplyAmount * 0.1);
        totalAmount = supplyAmount + vatAmount;
      }

      // 수수료 계산 (매칭 스냅샷 우선 → 헬퍼별 실효 수수료율)
      // 1) 매칭 시 스냅샷된 수수료율이 있으면 사용 (정책 변경 후에도 원래 수수료 유지)
      const [appSnapshot] = await db.select().from(orderApplications)
        .where(and(
          eq(orderApplications.orderId, order.id),
          eq(orderApplications.helperId, user.id)
        ))
        .limit(1);
      let commissionRateDetail: number;
      if (appSnapshot?.snapshotCommissionRate != null) {
        commissionRateDetail = appSnapshot.snapshotCommissionRate;
      } else {
        // 2) 스냅샷 없으면 현재 실효 수수료율 사용
        const effectiveRateDetail = await storage.getEffectiveCommissionRate(user.id);
        commissionRateDetail = effectiveRateDetail.rate;
      }
      const commissionAmountDetail = Math.round(totalAmount * commissionRateDetail / 100);

      const netAmount = totalAmount - commissionAmountDetail - deductionAmount;

      // 기타 금액 계산
      const etcCountVal = closingReport?.etcCount ?? 0;
      const etcPricePerUnitVal = closingReport?.etcPricePerUnit ?? 0;
      const etcAmountVal = etcCountVal * etcPricePerUnitVal;

      res.json({
        orderId: closingReport?.orderId || settlement?.orderId,
        orderTitle: order?.companyName || order?.deliveryArea || '오더',
        companyName: order?.companyName,
        deliveryArea: order?.deliveryArea,
        workDate: order?.scheduledDate || settlement?.workDate,
        // 단가 정보
        pricePerUnit: order.pricePerUnit || 0,
        // 금액 정보 (부가세 별도 기준)
        dailyRate: dailyRate, // 공급가액 (= pricePerUnit * 배송건수)
        supplyAmount: supplyAmount, // 공급가액
        vatAmount: vatAmount, // 부가세 (10%)
        totalAmount: totalAmount, // 합계 (공급가액 + 부가세)
        commissionRate: commissionRateDetail, // 수수료율 (%)
        commissionAmount: commissionAmountDetail, // 수수료
        deductionAmount: deductionAmount,
        deductionReason: deductionReason,
        netAmount: netAmount, // 지급액 (합계 - 수수료 - 차감액)
        // 실적 정보
        deliveredCount: closingReport?.deliveredCount ?? 0,
        etcCount: etcCountVal,
        etcPricePerUnit: etcPricePerUnitVal,
        etcAmount: etcAmountVal, // 기타 금액 (기타건수 × 기타단가)
        returnedCount: closingReport?.returnedCount ?? 0,
        closingText: closingReport?.memo || '',
        dynamicFields: dynamicFields,
        // 이미지
        deliveryHistoryImages,
        etcImages,
        // 상태
        status: closingReport?.status || settlement?.status,
        submittedAt: closingReport?.createdAt,
      });
    } catch (err: any) {
      console.error("Helper work detail error:", err);
      res.status(500).json({ message: "근무 정보를 불러오는데 실패했습니다" });
    }
  });

  // Get helper's work history (work confirmations)
  app.get("/api/helper/work-history", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      // First, try to get settlements from the settlement_statements table
      const allSettlements = await storage.getAllSettlementStatements();
      const helperSettlements = allSettlements.filter(s => s.helperId === userId);

      const workHistory: any[] = [];

      // Use settlement statements if available
      for (const settlement of helperSettlements) {
        const order = settlement.orderId ? await storage.getOrder(settlement.orderId) : null;

        // Calculate values from settlement (hiding commission from helper)
        const supplyAmount = settlement.supplyAmount || (settlement.basePay || 0) - (settlement.commissionAmount || 0);
        const taxAmount = settlement.vatAmount || calculateVat(supplyAmount);
        const deductionAmount = settlement.deduction || 0;
        const netAmount = settlement.netAmount || (supplyAmount + taxAmount - deductionAmount);

        workHistory.push({
          id: settlement.id,
          settlementId: settlement.id,
          date: settlement.workDate || order?.scheduledDate,
          companyName: order?.companyName || "-",
          deliveryArea: order?.deliveryArea || "-",
          deliveryCount: settlement.deliveryCount || 0,
          returnCount: settlement.returnCount || 0,
          pickupCount: settlement.pickupCount || 0,
          otherCount: settlement.otherCount || 0,
          supplyAmount,
          taxAmount,
          deductionAmount,
          deductionReason: settlement.holdReason || "",
          netAmount,
          status: settlement.status || "pending",
          helperConfirmed: settlement.helperConfirmed || false,
          helperConfirmedAt: settlement.helperConfirmedAt
            ? (typeof settlement.helperConfirmedAt === 'string' ? settlement.helperConfirmedAt : settlement.helperConfirmedAt.toISOString())
            : null,
        });
      }

      // Fallback: Get from contracts if no settlements exist
      if (workHistory.length === 0) {
        const helperContracts3 = await storage.getHelperContracts(userId);
        const completedContracts = helperContracts3.filter(c => c.status === "completed");

        for (const contract of completedContracts) {
          const order = await storage.getOrder(contract.orderId);
          const confirmation = await storage.getWorkConfirmationByContract(contract.id);

          if (order) {
            let deliveryCount = 0, returnCount = 0, pickupCount = 0, otherCount = 0;
            if (confirmation?.notes) {
              const deliveryMatch = confirmation.notes.match(/배송:\s*(\d+)/);
              const returnMatch = confirmation.notes.match(/반품:\s*(\d+)/);
              const pickupMatch = confirmation.notes.match(/수거:\s*(\d+)/);
              const otherMatch = confirmation.notes.match(/기타:\s*(\d+)/);
              if (deliveryMatch) deliveryCount = parseInt(deliveryMatch[1]);
              if (returnMatch) returnCount = parseInt(returnMatch[1]);
              if (pickupMatch) pickupCount = parseInt(pickupMatch[1]);
              if (otherMatch) otherCount = parseInt(otherMatch[1]);
            }

            const pricePerUnit = order.pricePerUnit || 0;
            const billableCount = deliveryCount + returnCount;
            const otherAmount = otherCount * 200;
            const supplyAmount = (billableCount * pricePerUnit) + otherAmount;
            const taxAmount = calculateVat(supplyAmount);
            const deductionAmount = 0;
            const netAmount = supplyAmount + taxAmount - deductionAmount;

            workHistory.push({
              id: contract.id,
              settlementId: null,
              date: order.scheduledDate,
              companyName: order.companyName,
              deliveryArea: order.deliveryArea,
              deliveryCount,
              returnCount,
              pickupCount,
              otherCount,
              supplyAmount,
              taxAmount,
              deductionAmount,
              deductionReason: "",
              netAmount,
              status: confirmation?.status || "completed",
              helperConfirmed: false,
              helperConfirmedAt: null,
            });
          }
        }
      }

      res.json(workHistory);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper: Get my disputes
  app.get("/api/helper/disputes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const disputes = await storage.getDisputesByHelper(userId);
      res.json(disputes);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/helper/disputes/:id - 헬퍼 이의제기 상세 조회
  app.get("/api/helper/disputes/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const id = Number(req.params.id);
      const [dispute] = await db.select().from(disputes).where(
        and(eq(disputes.id, id), eq(disputes.helperId, userId))
      );

      if (!dispute) {
        return res.status(404).json({ message: "이의제기를 찾을 수 없습니다" });
      }

      // Get order info if exists
      let order: any = null;
      if (dispute.orderId) {
        const [orderData] = await db.select().from(orders).where(eq(orders.id, dispute.orderId));
        order = orderData;
      }

      // Get admin user info if replied
      let adminUser: any = null;
      if (dispute.adminReplyBy) {
        const [admin] = await db.select({ name: users.name }).from(users).where(eq(users.id, dispute.adminReplyBy));
        adminUser = admin;
      }

      res.json({
        ...dispute,
        order: order ? { ...(order as any), helperName: null } : null,
        adminUserName: adminUser?.name || null,
      });
    } catch (err: any) {
      console.error("Get helper dispute detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==========================================
  // 헬퍼 사고 관련 API
  // ==========================================

  // GET /api/helper/incidents - 헬퍼가 관련된 사고 목록 조회
  app.get("/api/helper/incidents", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근할 수 있습니다" });
      }

      const incidents = await db.select({
        id: incidentReports.id,
        orderId: incidentReports.orderId,
        incidentType: incidentReports.incidentType,
        incidentDate: incidentReports.incidentDate,
        description: incidentReports.description,
        status: incidentReports.status,
        helperStatus: incidentReports.helperStatus,
        helperActionAt: incidentReports.helperActionAt,
        helperNote: incidentReports.helperNote,
        createdAt: incidentReports.createdAt,
        resolvedAt: incidentReports.resolvedAt,
      })
        .from(incidentReports)
        .where(eq(incidentReports.helperId, user.id))
        .orderBy(desc(incidentReports.createdAt));

      const formattedIncidents = incidents.map(inc => ({
        ...inc,
        createdAt: inc.createdAt?.toISOString() || null,
        resolvedAt: inc.resolvedAt?.toISOString() || null,
        helperActionAt: inc.helperActionAt?.toISOString() || null,
      }));

      res.json(formattedIncidents);
    } catch (err: any) {
      console.error("Get helper incidents error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/helper/incidents/:id - 헬퍼 사고 상세 조회
  app.get("/api/helper/incidents/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근할 수 있습니다" });
      }

      const id = Number(req.params.id);
      const [incident] = await db.select()
        .from(incidentReports)
        .where(and(
          eq(incidentReports.id, id),
          eq(incidentReports.helperId, user.id)
        ));

      if (!incident) {
        return res.status(404).json({ message: "사고를 찾을 수 없습니다" });
      }
      // Get order info with helper name
      let order: any = null;
      let helperName: any = null;
      if (incident.orderId) {
        const [orderData] = await db.select({
          id: orders.id,
          campAddress: orders.campAddress,
          deliveryArea: orders.deliveryArea,
          scheduledDate: orders.scheduledDate,
          courierCompany: orders.courierCompany,
          averageQuantity: orders.averageQuantity,
          matchedHelperId: orders.matchedHelperId,
        }).from(orders).where(eq(orders.id, incident.orderId));
        order = orderData;

        // Get helper name
        if (orderData?.matchedHelperId) {
          const [helperData] = await db.select({ name: users.name })
            .from(users)
            .where(eq(users.id, orderData.matchedHelperId));
          helperName = helperData?.name || null;
        }
      }

      // Get requester info
      let requester: any = null;
      if (incident.requesterId) {
        const [requesterData] = await db.select({
          name: users.name,
          phone: users.phoneNumber,
        }).from(users).where(eq(users.id, incident.requesterId));
        requester = requesterData;
      }

      // Get evidence
      const evidence = await db.select()
        .from(incidentEvidence)
        .where(eq(incidentEvidence.incidentId, id));

      // 날짜 필드를 ISO 문자열로 변환
      const formattedIncident = {
        ...incident,
        createdAt: incident.createdAt?.toISOString() || null,
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        helperActionAt: incident.helperActionAt?.toISOString() || null,
      };

      res.json({
        ...formattedIncident,
        order: order ? { ...order, helperName } : null,
        requester,
        evidence,
      });
    } catch (err: any) {
      console.error("Get helper incident detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/helper/incidents/:id/action - 헬퍼 사고 대응 액션
  app.post("/api/helper/incidents/:id/action", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근할 수 있습니다" });
      }

      const id = Number(req.params.id);
      const { action, note } = req.body;

      // action: item_found (물건찾음), request_handling (처리요망), confirmed (확인완료)
      const validActions = ['item_found', 'recovered', 'redelivered', 'damage_confirmed', 'request_handling', 'confirmed', 'dispute'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ message: "유효하지 않은 액션입니다" });
      }

      // Check if incident belongs to helper
      const [incident] = await db.select()
        .from(incidentReports)
        .where(and(
          eq(incidentReports.id, id),
          eq(incidentReports.helperId, user.id)
        ));

      if (!incident) {
        return res.status(404).json({ message: "사고를 찾을 수 없습니다" });
      }

      // Update incident with helper action
      await db.update(incidentReports)
        .set({
          helperStatus: action,
          helperActionAt: new Date(),
          helperNote: note || null,
          updatedAt: new Date(),
        })
        .where(eq(incidentReports.id, id));

      // Add action log
      await db.insert(incidentActions).values({
        incidentId: id,
        actorId: user.id,
        actorRole: 'helper',
        actionType: `helper_${action}`,
        notes: note || null,
      });

      // Notify requester about helper action (in-app + push)
      const actionLabels: Record<string, string> = {
        item_found: '물건을 찾았습니다',
        recovered: '오배송 회수 완료',
        redelivered: '재배송 완료',
        damage_confirmed: '파손 확인',
        request_handling: '처리를 요망합니다',
        confirmed: '사고를 확인했습니다',
        dispute: '이의를 제기했습니다',
      };

      if (incident.requesterId) {
        try {
          await storage.createNotification({
            userId: incident.requesterId,
            type: "order_update" as any,
            title: "사고 처리 업데이트",
            message: `헬퍼가 "${actionLabels[action]}"(으)로 응답했습니다.`,
            relatedId: incident.orderId,
          });
          sendPushToUser(incident.requesterId, {
            title: '사고 처리 업데이트',
            body: `헬퍼가 "${actionLabels[action]}"(으)로 응답했습니다.`,
            url: `/incidents/${id}`,
            tag: `incident-action-${id}`,
          } as any);
        } catch (reqNotifErr) {
          console.error(`[Notification Error] Failed to send incident action notification to requester:`, reqNotifErr);
        }
      }

      // 관리자에게 알림 + 푸시
      try {
        const admins = await storage.getAdminUsers?.() || [];
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            type: "order_update" as any,
            title: "사고 처리 업데이트",
            message: `헬퍼 ${user.name || ""}님이 사고 #${id}에 "${actionLabels[action]}"(으)로 응답했습니다.`,
            relatedId: incident.orderId,
          });
          sendPushToUser(admin.id, {
            title: "사고 처리 업데이트",
            body: `헬퍼 ${user.name || ""}님이 사고 #${id}에 "${actionLabels[action]}"(으)로 응답했습니다.`,
            url: `/incidents/${id}`,
            tag: `admin-incident-action-${id}`,
          });
        }
      } catch (adminNotifErr) {
        console.error(`[Notification Error] Failed to send incident action notification to admins:`, adminNotifErr);
      }

      res.json({ message: "액션이 처리되었습니다", action });
    } catch (err: any) {
      console.error("Helper incident action error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Helper: Create a dispute (이의제기 신청)
  app.post("/api/helper/disputes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 이의제기를 신청할 수 있습니다" });
      }

      const {
        settlementId,
        orderId,
        workDate,
        disputeType,
        description,
        courierName,
        invoiceNumber,
        evidencePhotoUrl,
        requestedDeliveryCount,
        requestedReturnCount,
        requestedPickupCount,
        requestedOtherCount
      } = req.body;

      if (!workDate || !disputeType || !description) {
        return res.status(400).json({ message: "필수 항목을 입력해주세요" });
      }

      // 이의제기 유형 검증
      const validHelperDisputeTypes = ["settlement_error", "invoice_error", "service_complaint", "count_mismatch", "amount_error", "delivery_issue", "lost", "wrong_delivery", "other"];
      if (!validHelperDisputeTypes.includes(disputeType)) {
        return res.status(400).json({ message: "유효하지 않은 이의제기 유형입니다" });
      }

      const dispute = await storage.createDispute({
        helperId: userId,
        submitterRole: "helper",
        settlementId: settlementId || null,
        orderId: orderId || null,
        workDate,
        disputeType,
        description,
        courierName: courierName || null,
        invoiceNumber: invoiceNumber || null,
        evidencePhotoUrl: evidencePhotoUrl || null,
        requestedDeliveryCount: requestedDeliveryCount || null,
        requestedReturnCount: requestedReturnCount || null,
        requestedPickupCount: requestedPickupCount || null,
        requestedOtherCount: requestedOtherCount || null,
        status: "pending",
      });

      // Send push notification to the helper
      sendPushToUser(userId, {
        title: "이의제기 접수 완료",
        body: `${workDate} 작업건에 대한 이의제기가 접수되었습니다.`,
        url: "/work-history",
        tag: `dispute-${dispute.id}`,
      });

      // Notify admins via WebSocket
      broadcastToAllAdmins("dispute", "created", dispute.id, {
        disputeId: dispute.id,
        helperId: userId,
        helperName: user.name || user.username,
        workDate,
        disputeType,
        description,
      });

      // Send notification to all admins (in-app + push)
      try {
        const admins = await storage.getAdminUsers?.() || [];
        const disputeTypeLabels: Record<string, string> = {
          settlement_error: "정산", invoice_error: "세금계산서",
          service_complaint: "요청자 불만", count_mismatch: "수량 오류",
          amount_error: "금액 오류", other: "기타",
        };
        const typeLabel = disputeTypeLabels[disputeType] || disputeType;
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            type: "order_update" as any,
            title: "새 이의제기 접수",
            message: `${user.name || user.username}님이 [${typeLabel}] 이의제기를 접수했습니다. (${workDate})`,
            relatedId: dispute.id,
          });
          await sendPushToUser(admin.id, {
            title: "새 이의제기 접수",
            body: `${user.name || user.username}님이 ${workDate} 작업건에 대해 이의제기를 접수했습니다.`,
            url: "/disputes",
            tag: `admin-dispute-${dispute.id}`,
          });
        }
      } catch (pushErr: any) {
        console.error("Push to admins failed:", pushErr);
      }

      console.log(`[Dispute] New dispute created by helper ${userId}: ${disputeType} for ${workDate}`);

      res.status(201).json({
        success: true,
        message: "이의제기가 접수되었습니다.",
        dispute
      });
    } catch (err: any) {
      console.error("Create dispute error:", err);
      res.status(500).json({ message: "이의제기 접수에 실패했습니다" });
    }
  });

  // Helper: Get service areas (배송가능 지역)
  app.get("/api/helper/service-areas", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const areas = await storage.getHelperServiceAreas(userId);
      res.json(areas);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper: Set service areas (배송가능 지역 설정)
  app.post("/api/helper/service-areas", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { areas } = req.body;
      if (!Array.isArray(areas)) {
        return res.status(400).json({ message: "지역 목록이 필요합니다" });
      }

      const savedAreas = await storage.setHelperServiceAreas(userId, areas);
      res.json({ success: true, areas: savedAreas });
    } catch (err: any) {
      console.error("Set service areas error:", err);
      res.status(500).json({ message: "지역 설정에 실패했습니다" });
    }
  });

  app.post("/api/work-confirmations", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { contractId, orderId, proofImageUrl, notes, deliveryCount, returnCount, pickupCount, otherCount } = req.body;

      const confirmation = await storage.createWorkConfirmation({
        contractId,
        orderId,
        helperId: userId,
        proofImageUrl,
        notes,
        status: "submitted",
        deliveryCount: deliveryCount || 0,
        returnCount: returnCount || 0,
        pickupCount: pickupCount || 0,
        otherCount: otherCount || 0,
      });

      res.status(201).json(confirmation);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/work-confirmations/:contractId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const confirmation = await storage.getWorkConfirmationByContract(Number(req.params.contractId));
      if (!confirmation) {
        return res.status(404).json({ message: "Work confirmation not found" });
      }
      res.json(confirmation);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/work-confirmations/:id/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const confirmation = await storage.updateWorkConfirmation(Number(req.params.id), {
        status: "confirmed",
      });

      res.json(confirmation);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get work confirmations for an order (for requester)
  app.get("/api/orders/:orderId/work-confirmations", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Verify requester owns this order
      const { balancePaymentDate } = req.body;

      if (!balancePaymentDate) {
        return res.status(400).json({ message: "잔금 결제 예정일을 선택해주세요" });
      }

      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const confirmations = await storage.getWorkConfirmationsByOrder(Number(req.params.orderId));

      // Enhance with helper info using structured fields
      const enhancedConfirmations = await Promise.all(confirmations.map(async (conf) => {
        const helper = await storage.getUser(conf.helperId);
        const contract = await storage.getContract(conf.contractId);

        // Use structured fields directly, fallback to notes parsing for legacy data
        let deliveryCount = conf.deliveryCount ?? 0;
        let returnCount = conf.returnCount ?? 0;
        let pickupCount = conf.pickupCount ?? 0;
        let otherCount = conf.otherCount ?? 0;

        // Fallback: parse notes for legacy data without structured fields
        if (deliveryCount === 0 && returnCount === 0 && pickupCount === 0 && otherCount === 0) {
          const notes = conf.notes || "";
          const deliveryMatch = notes.match(/배송:\s*(\d+)/);
          const returnMatch = notes.match(/반품:\s*(\d+)/);
          const pickupMatch = notes.match(/집하:\s*(\d+)/) || notes.match(/수거:\s*(\d+)/);
          const otherMatch = notes.match(/기타:\s*(\d+)/);

          deliveryCount = deliveryMatch ? parseInt(deliveryMatch[1]) : 0;
          returnCount = returnMatch ? parseInt(returnMatch[1]) : 0;
          pickupCount = pickupMatch ? parseInt(pickupMatch[1]) : 0;
          otherCount = otherMatch ? parseInt(otherMatch[1]) : 0;
        }

        return {
          ...conf,
          helperName: helper?.name || "Unknown",
          helperNickname: (helper as any)?.nickname || null,
          helperPhone: helper?.phoneNumber || "",
          contractAmount: contract?.totalAmount || 0,
          depositAmount: contract?.depositAmount || 0,
          remainingAmount: contract?.balanceAmount || 0,
          deliveryCount,
          returnCount,
          pickupCount,
          otherCount,
        };
      }));

      res.json(enhancedConfirmations);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === review routes moved to routes/reviews.routes.ts ===


  // 오더 수정 (의뢰인만 가능, 매칭 전 상태만)
  app.patch("/api/orders/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      const { balancePaymentDate } = req.body;

      if (!balancePaymentDate) {
        return res.status(400).json({ message: "잔금 결제 예정일을 선택해주세요" });
      }

      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "수정 권한이 없습니다" });
      }

      // 매칭완료 이상 상태는 수정 불가 (표준)
      const editOrderStatus = normalizeOrderStatus(order.status);
      if (isOneOfStatus(editOrderStatus, CANNOT_EDIT_STATUSES)) {
        return res.status(400).json({ message: "매칭 완료된 오더는 수정할 수 없습니다" });
      }

      const { pricePerUnit, deliveryArea, scheduledDate, vehicleType, requestDateEnd } = req.body;

      const updates: Record<string, any> = {};
      if (pricePerUnit !== undefined) updates.pricePerUnit = parseInt(pricePerUnit);
      if (deliveryArea !== undefined) updates.deliveryArea = deliveryArea;
      if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
      if (vehicleType !== undefined) updates.vehicleType = vehicleType;
      if (requestDateEnd !== undefined) updates.requestDateEnd = requestDateEnd;

      const updated = await storage.updateOrder(orderId, updates);

      res.json({ message: "오더가 수정되었습니다", order: updated });
    } catch (err: any) {
      console.error("Update order error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // 오더 숨기기 (의뢰인 홈에서 숨김)
  app.post("/api/orders/:id/hide", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      await storage.updateOrder(orderId, { hiddenAt: new Date() });
      res.json({ success: true, message: "오더가 숨겨졌습니다" });
    } catch (err: any) {
      console.error("Hide order error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 오더 삭제 (의뢰인만 가능, 매칭 전 상태만)
  app.delete("/api/orders/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      const { balancePaymentDate } = req.body;

      if (!balancePaymentDate) {
        return res.status(400).json({ message: "잔금 결제 예정일을 선택해주세요" });
      }

      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "삭제 권한이 없습니다" });
      }

      // 매칭완료 이상 상태는 삭제 불가 (표준)
      const deleteOrderStatus = normalizeOrderStatus(order.status);
      if (isOneOfStatus(deleteOrderStatus, CANNOT_DELETE_STATUSES)) {
        return res.status(400).json({ message: "매칭 완료된 오더는 삭제할 수 없습니다" });
      }

      await storage.deleteOrder(orderId);

      res.json({ message: "오더가 삭제되었습니다" });
    } catch (err: any) {
      console.error("Delete order error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼 선택 (applied → selected 상태 변경)
  app.post("/api/orders/:id/select-helper", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const orderId = Number(req.params.id);
      const { helperId } = req.body;
      // totalAmount는 클라이언트에서 받지 않고 서버에서 재계산 (금액 조작 방지)

      // 멱등성 체크: 중복 선택 방지
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, cachedResponse } = await checkIdempotency(
          userId,
          `POST:/api/orders/${orderId}/select-helper`,
          idempotencyKey
        );
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached select-helper for order ${orderId}, key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // 이미 선택 완료된 경우 (idempotent 응답)
      if (order.status === "scheduled" && order.matchedHelperId === helperId) {
        const existingContract = await storage.getOrderContract(orderId);
        if (existingContract) {
          return res.json({ contract: existingContract, message: "이미 헬퍼가 선택되었습니다." });
        }
      }

      // 다른 헬퍼가 이미 선택된 경우
      if (order.status === "scheduled" && order.matchedHelperId && order.matchedHelperId !== helperId) {
        return res.status(409).json({ message: "이미 다른 헬퍼가 선택되었습니다" });
      }

      if ((order.currentHelpers || 0) >= (order.maxHelpers || 3)) {
        return res.status(400).json({ message: "최대 헬퍼 수에 도달했습니다" });
      }

      const application = await storage.getOrderApplication(orderId, helperId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const helper = await storage.getUser(helperId);
      const requester = await storage.getUser(userId);

      // 헬퍼의 실효 수수료율 스냅샷 저장 (매칭 시점 값 보존)
      const effectiveRate = await storage.getEffectiveCommissionRate(helperId);

      // 서버에서 금액 재계산 (금액 조작 방지) — 통합 정산 모듈 사용
      const boxCount = parseInt((order.averageQuantity || '0').replace(/[^0-9]/g, '')) || 0;
      const depRate = await getDepositRate();
      const settlementCalc = calculateSettlement({
        deliveredCount: boxCount,
        returnedCount: 0,
        etcCount: 0,
        unitPrice: order.pricePerUnit || 0,
        etcPricePerUnit: 0,
        extraCosts: [],
      }, depRate);

      const totalAmount = settlementCalc.supplyAmount;
      const depositAmount = settlementCalc.depositAmount;
      const balanceAmount = settlementCalc.balanceAmount;
      const newHelperCount = (order.currentHelpers || 0) + 1;

      // === 트랜잭션: 핵심 DB 작업 원자성 보장 ===
      const txResult = await withTransaction(async (tx) => {
        // 1. 헬퍼 상태를 selected로 변경 + 수수료 스냅샷
        await tx.update(orderApplications)
          .set({
            status: "selected",
            selectedAt: new Date(),
            snapshotCommissionRate: effectiveRate.rate,
            snapshotPlatformRate: effectiveRate.platformRate,
            snapshotTeamLeaderRate: effectiveRate.teamLeaderRate,
            snapshotTeamLeaderId: effectiveRate.teamLeaderId,
            snapshotSource: effectiveRate.source,
          })
          .where(eq(orderApplications.id, application.id));

        // 2. 다른 지원자들 자동 REJECTED 처리
        const allApplications = await tx.select().from(orderApplications)
          .where(eq(orderApplications.orderId, orderId));
        const rejectedHelperIds: string[] = [];
        for (const app of allApplications) {
          if (app.id !== application.id && app.status === "applied") {
            await tx.update(orderApplications)
              .set({
                status: "rejected",
                rejectedAt: new Date(),
                rejectionReason: "다른 헬퍼가 선택되었습니다",
              } as any)
              .where(eq(orderApplications.id, app.id));
            rejectedHelperIds.push(app.helperId);
          }
        }

        // 3. 같은 입차일의 다른 오더 지원 자동 취소
        if (order.scheduledDate) {
          const otherApplications = await storage.getHelperAppliedApplicationsByDate(
            helperId, order.scheduledDate, orderId
          );
          if (otherApplications.length > 0) {
            const applicationIds = otherApplications.map(a => a.applicationId);
            await tx.update(orderApplications)
              .set({ status: "auto_cancelled" })
              .where(inArray(orderApplications.id, applicationIds));
            console.log(`[Select Helper] Auto-cancelled ${applicationIds.length} applications for helper ${helperId} on same date`);
          }
        }

        // 4. 레이스 컨디션 방지: 조건부 업데이트
        const updateResult = await tx.update(orders)
          .set({
            currentHelpers: newHelperCount,
            status: "scheduled",
            matchedHelperId: helperId,
            requesterPhone: requester?.phoneNumber || null,
            helperPhoneShared: true,
            updatedAt: new Date(),
          })
          .where(and(
            eq(orders.id, orderId),
            or(
              isNull(orders.matchedHelperId),
              eq(orders.matchedHelperId, helperId) // 멱등성: 같은 헬퍼 재선택 허용
            )
          ))
          .returning();

        if (updateResult.length === 0) {
          throw new Error("ALREADY_MATCHED");
        }

        // 5. 계약 생성
        const [contract] = await tx.insert(contracts).values({
          orderId,
          requesterId: userId,
          helperId,
          trackingNumber: null,
          totalAmount,
          depositAmount,
          balanceAmount,
          depositPaid: false,
          balancePaid: false,
          status: "pending",
        } as any).returning();

        return { contract, rejectedHelperIds };
      });

      // 트랜잭션 실패: 다른 헬퍼가 이미 선택됨
      if (!txResult) {
        return res.status(409).json({
          code: "ALREADY_MATCHED",
          message: "다른 요청에서 이미 헬퍼가 선택되었습니다. 새로고침해주세요."
        });
      }

      const { contract, rejectedHelperIds } = txResult;

      // 트랜잭션 밖: 탈락 알림 (비핵심, 실패해도 데이터 무결성 유지)
      for (const rejectedHelperId of rejectedHelperIds) {
        try {
          await storage.createNotification({
            userId: rejectedHelperId,
            type: "application_rejected",
            title: "지원 결과 안내",
            message: `${order.companyName} 오더에 다른 헬퍼가 배정되었습니다.`,
            relatedId: orderId,
          });
        } catch (notifErr) {
          console.error(`[Notification Error] Failed to send rejection notification:`, notifErr);
        }
      }

      const orderCardPayload = JSON.stringify({
        orderId,
        companyName: order.companyName,
        deliveryArea: order.deliveryArea,
        scheduledDate: order.scheduledDate,
        pricePerUnit: order.pricePerUnit,
        averageQuantity: order.averageQuantity,
        vehicleType: order.vehicleType,
        regionMapUrl: order.regionMapUrl,
        deliveryGuideUrl: order.deliveryGuideUrl,
      });

      // 알림 발송 (알림 실패해도 헬퍼 선택 처리에 영향 없도록 try-catch)
      try {
        // 헬퍼에게 선택됨 알림 (매칭중)
        await storage.createNotification({
          userId: helperId,
          type: "helper_selected",
          title: "오더 매칭중",
          message: `${order.companyName} 오더에 선택되었습니다. 매칭완료를 기다려주세요.`,
          relatedId: orderId,
          payload: orderCardPayload,
        });

        // WebSocket 알림
        notificationWS.sendToUser(helperId, {
          type: "helper_selected",
          title: "오더 매칭중",
          message: `${order.companyName} 오더에 선택되었습니다.`,
          relatedId: orderId,
          payload: orderCardPayload,
        });

        // 푸시 알림
        sendPushToUser(helperId, {
          title: "오더 매칭중",
          body: `${order.companyName} 오더에 선택되었습니다. 매칭완료를 기다려주세요.`,
          url: "/helper-dashboard",
          tag: `selected-${orderId}`,
        });

        // 관리자에게 브로드캐스트
        broadcastToAllAdmins("order_status", "helper_selected", orderId, {
          orderId,
          helperName: helper?.name,
          companyName: order.companyName,
          currentHelpers: newHelperCount,
        });
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send select-helper notifications for order ${orderId}:`, notificationErr);
      }

      const response = { contract, message: "헬퍼가 선택되었습니다. 매칭완료 버튼을 눌러주세요." };

      // 멱등성 응답 저장
      if (idempotencyKey) {
        await storeIdempotencyResponse(userId, `POST:/api/orders/${orderId}/select-helper`, idempotencyKey, 200, response);
      }

      res.json(response);
    } catch (err: any) {
      if (err?.message === "ALREADY_MATCHED") {
        return res.status(409).json({
          code: "ALREADY_MATCHED",
          message: "다른 요청에서 이미 헬퍼가 선택되었습니다. 새로고침해주세요."
        });
      }
      console.error("[select-helper] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 매칭완료 확정 (selected → scheduled 상태 변경)
  app.post("/api/orders/:id/confirm-matching", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const orderId = Number(req.params.id);

      // 멱등성 체크: 중복 매칭확정 방지
      const idempotencyKey = getIdempotencyKeyFromRequest(req);
      if (idempotencyKey) {
        const { isDuplicate, cachedResponse } = await checkIdempotency(
          userId,
          `POST:/api/orders/${orderId}/confirm-matching`,
          idempotencyKey
        );
        if (isDuplicate && cachedResponse) {
          console.log(`[Idempotency] Returning cached confirm-matching for order ${orderId}, key: ${idempotencyKey}`);
          return res.status(cachedResponse.status).json(cachedResponse.body);
        }
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // 오더 상태 검증: 이미 완료/취소/진행중인 오더는 매칭 확정 불가
      const invalidStatuses = ["in_progress", "closing_submitted", "final_amount_confirmed",
        "balance_paid", "settlement_paid", "closed", "cancelled", "settled"];
      const normalizedStatus = normalizeOrderStatus(order.status);
      if (invalidStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          code: "INVALID_STATUS",
          message: `현재 상태(${order.status})에서는 매칭 확정을 할 수 없습니다.`
        });
      }

      // 의뢰인 권한 확인
      const { balancePaymentDate } = req.body;

      if (!balancePaymentDate) {
        return res.status(400).json({ message: "잔금 결제 예정일을 선택해주세요" });
      }

      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      // 선택된 헬퍼 조회
      const applications = await storage.getOrderApplications(orderId);
      const selectedApplications = applications.filter(a => a.status === "selected");

      if (selectedApplications.length === 0) {
        return res.status(400).json({ message: "선택된 헬퍼가 없습니다" });
      }

      const requester = await storage.getUser(userId);

      // 선택된 모든 헬퍼를 scheduled 상태로 변경 + 같은 날짜 다른 오더 신청 자동취소
      for (const app of selectedApplications) {
        // 스냅샷이 없으면 현재 시점에서 캡처 (select-helper를 거치지 않은 경우)
        let snapshotUpdate: Record<string, any> = {};
        if (app.snapshotCommissionRate == null || app.snapshotPlatformRate == null || app.snapshotTeamLeaderRate == null) {
          const effectiveRate = await storage.getEffectiveCommissionRate(app.helperId);
          snapshotUpdate = {
            snapshotCommissionRate: effectiveRate.rate,
            snapshotPlatformRate: effectiveRate.platformRate,
            snapshotTeamLeaderRate: effectiveRate.teamLeaderRate,
            snapshotTeamLeaderId: effectiveRate.teamLeaderId,
            snapshotSource: effectiveRate.source,
          };
          console.log(`[Matching] Snapshot captured for application ${app.id}: ${effectiveRate.rate}% (${effectiveRate.source})`);
        }

        await storage.updateOrderApplication(app.id, {
          status: "scheduled",
          scheduledAt: new Date(),
          ...snapshotUpdate,
        });

        const helper = await storage.getUser(app.helperId);

        // 같은 날짜 다른 오더 신청 자동취소 (중복 매칭 방지)
        // 단, 업무마감(completed/closed) 상태가 아닌 신청만 취소
        const helperApps = await storage.getHelperApplications(app.helperId);
        for (const otherApp of helperApps) {
          // 현재 오더 또는 이미 처리된 신청은 스킵
          if (otherApp.orderId === orderId ||
            otherApp.status === "completed" ||
            otherApp.status === "rejected" ||
            otherApp.status === "cancelled") {
            continue;
          }

          // 다른 오더의 날짜 확인
          const otherOrder = await storage.getOrder(otherApp.orderId);
          if (otherOrder && otherOrder.scheduledDate === order.scheduledDate) {
            // 같은 날짜의 다른 신청은 자동취소
            await storage.updateOrderApplication(otherApp.id, {
              status: "cancelled",
              processedAt: new Date(),
            });

            // 자동취소 알림 (알림 실패해도 취소 처리에 영향 없도록)
            try {
              await storage.createNotification({
                userId: app.helperId,
                type: "application_auto_cancelled",
                title: "신청 자동취소",
                message: `${otherOrder.companyName} 오더 신청이 자동취소되었습니다. (동일 날짜 중복 매칭 불가)`,
                relatedId: otherApp.orderId,
              });
            } catch (notifErr) {
              console.error(`[Notification Error] Failed to send auto-cancel notification:`, notifErr);
            }
          }
        }

        // 헬퍼에게 매칭완료 알림 (알림 실패해도 매칭 처리에 영향 없도록)
        // 담당자 연락처: 오더에 등록된 contactPhone 우선, 없으면 의뢰인 전화번호
        const helperNotifPhone = order.contactPhone || requester?.phoneNumber || null;
        try {
          await storage.createNotification({
            userId: app.helperId,
            type: "matching_completed",
            title: "매칭 완료",
            message: `${order.companyName} 오더 매칭이 완료되었습니다. 담당자 연락처: ${helperNotifPhone || "미등록"}`,
            relatedId: orderId,
            phoneNumber: helperNotifPhone,
          });

          // WebSocket 알림
          notificationWS.sendToUser(app.helperId, {
            type: "matching_completed",
            title: "매칭 완료",
          });

          // 푸시 알림
          sendPushToUser(app.helperId, {
            title: "매칭 완료",
            body: `${order.companyName} 오더 매칭이 완료되었습니다. 담당자: ${helperNotifPhone || "미등록"}`,
            url: "/helper-home",
            tag: `matching-complete-${orderId}`,
          });
        } catch (notifErr) {
          console.error(`[Notification Error] Failed to send matching-completed notification for helper ${app.helperId}:`, notifErr);
        }
      }

      // 나머지 applied 상태 신청은 rejected로 변경 (1명 선택, 나머지 자동 취소)
      const appliedApplications = applications.filter(a => a.status === "applied");
      for (const app of appliedApplications) {
        await storage.updateOrderApplication(app.id, {
          status: "rejected",
          processedAt: new Date(),
        });

        // 거절 알림 (알림 실패해도 reject 처리에 영향 없도록)
        try {
          await storage.createNotification({
            userId: app.helperId,
            type: "application_rejected",
            title: "오더 신청 결과",
            message: `${order.companyName} 오더에 다른 헬퍼가 선택되었습니다.`,
            relatedId: orderId,
          });
        } catch (notifErr) {
          console.error(`[Notification Error] Failed to send rejection notification:`, notifErr);
        }
      }

      // 오더 상태를 scheduled로 변경
      const matchedHelperId = selectedApplications.length > 0 ? selectedApplications[0].helperId : null;
      await storage.updateOrder(orderId, {
        status: "scheduled",
        matchedHelperId: matchedHelperId,
        matchedAt: new Date(),
        helperPhoneShared: true,
        requesterPhone: requester?.phoneNumber || null,
      });

      // 선택된 헬퍼 정보 가져오기
      const matchedHelper = selectedApplications.length > 0 ? await storage.getUser(selectedApplications[0].helperId) : null;

      // 의뢰인/관리자 알림 (알림 실패해도 매칭 처리에 영향 없도록 try-catch)
      try {
        await storage.createNotification({
          userId: userId,
          type: "matching_completed",
          title: "매칭 완료",
          message: `${order.companyName} 오더 매칭이 완료되었습니다. 헬퍼 연락처: ${matchedHelper?.phoneNumber || "미등록"}`,
          phoneNumber: matchedHelper?.phoneNumber || null,
          relatedId: orderId,
        });

        // 관리자에게 브로드캐스트
        broadcastToAllAdmins("order_status", "matching_completed", orderId, {
          orderId,
          companyName: order.companyName,
          selectedHelpers: selectedApplications.length,
        });
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send confirm-matching notifications for order ${orderId}:`, notificationErr);
      }

      // 멱등성 응답 저장
      const responseBody = { success: true, message: "매칭이 완료되었습니다" };
      if (idempotencyKey) {
        await storeIdempotencyResponse(userId, `POST:/api/orders/${orderId}/confirm-matching`, idempotencyKey, 200, responseBody);
      }

      res.json(responseBody);
    } catch (err: any) {
      console.error("Confirm matching error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 계약 확정 (의뢰인이 오더 생성 후 계약 동의)
  app.post("/api/orders/:id/confirm-contract", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const { balancePaymentDate, signatureData, requestTaxInvoice } = req.body;

      if (!balancePaymentDate) {
        return res.status(400).json({ message: "잔금 결제 예정일을 선택해주세요" });
      }

      if (order.requesterId !== userId) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      // 계약 확정: awaiting_deposit 상태 유지 (입금 대기)
      const updateData: any = {
        contractConfirmed: true,
        balancePaymentDueDate: balancePaymentDate,
        contractConfirmedAt: new Date(),
      };

      // 전자서명 데이터 저장 (base64)
      if (signatureData) {
        updateData.signatureData = signatureData;
      }

      // 세금계산서 요청 여부 저장
      if (requestTaxInvoice !== undefined) {
        updateData.requestTaxInvoice = requestTaxInvoice === true;
      }

      await storage.updateOrder(orderId, updateData);

      // 의뢰인에게 입금 안내 알림 (부가세 포함 기준)
      const pricePerUnit = order.pricePerUnit || 0;
      const avgQty = parseInt(order.averageQuantity || "1") || 1;
      const supplyAmount = pricePerUnit * avgQty;
      const totalWithVat = Math.round(supplyAmount * 1.1);
      const depRate = await getDepositRate();
      const depositAmount = Math.floor(totalWithVat * (depRate / 100));

      // 알림 발송 (알림 실패해도 계약 확정 처리에 영향 없도록 try-catch)
      try {
        await storage.createNotification({
          userId: userId,
          type: "contract_confirmed",
          title: "계약 확정 완료",
          message: `${order.companyName} 오더 계약이 확정되었습니다. 예약금 ${depositAmount.toLocaleString()}원 입금 후 헬퍼 매칭이 진행됩니다.`,
          relatedId: orderId,
        });

        // 관리자에게 알림
        broadcastToAllAdmins("order", "contract_confirmed", orderId, {
          orderId,
          companyName: order.companyName,
          requesterId: userId,
          helperId: null,
          trackingNumber: null,
          depositAmount,
        });
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send contract-confirmed notifications for order ${orderId}:`, notificationErr);
      }

      res.json({
        success: true,
        message: "계약이 확정되었습니다. 예약금 입금 안내를 확인해주세요.",
        depositAmount,
      });
    } catch (err: any) {
      console.error("Confirm contract error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contract Signature (Both Helper and Requester)
  app.post("/api/contracts/:id/sign", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      const contractId = Number(req.params.id);
      const { signature } = req.body;

      if (!signature) {
        return res.status(400).json({ message: "서명이 필요합니다" });
      }

      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      const isHelper = contract.helperId === userId;
      const isRequester = contract.requesterId === userId;

      if (!isHelper && !isRequester) {
        return res.status(403).json({ message: "계약 당사자만 서명할 수 있습니다" });
      }

      const updates: any = {};
      const now = new Date();

      if (isHelper) {
        updates.helperSignature = signature;
        updates.helperSignedAt = now;
      } else if (isRequester) {
        updates.requesterSignature = signature;
        updates.requesterSignedAt = now;
      }

      // Update contract
      const updatedContract = await storage.updateContract(contractId, updates);

      res.json({ success: true, contract: updatedContract });
    } catch (err: any) {
      console.error("Contract sign error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 업무 마감 (in_progress → closing_submitted 상태 변경) - 헬퍼가 업무마감 전송
  // 참고: 이 API는 레거시 호환성을 위해 유지됨. 신규 클라이언트는 /api/orders/:id/closing/submit 사용 권장
  app.post("/api/orders/complete", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { orderId, deliveryCount, returnCount, pickupCount, otherCount, proofImageUrl } = req.body;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // 오더 상태 검증: 업무중(in_progress) 상태에서만 마감 제출 가능
      const orderStatusForClose = normalizeOrderStatus(order.status);
      if (!isOneOfStatus(orderStatusForClose, CAN_SUBMIT_CLOSING_STATUSES)) {
        return res.status(400).json({
          message: `현재 상태(${order.status})에서는 마감을 제출할 수 없습니다. 업무중 상태에서만 가능합니다.`
        });
      }

      // Get the contract for this order and helper (효율적 조회)
      const contract = await storage.getContractByOrderAndHelper(orderId, userId);

      if (!contract) {
        return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
      }

      // 헬퍼 신청 상태 업데이트 (in_progress → closing_submitted)
      const application = await storage.getOrderApplication(orderId, userId);
      if (application) {
        await storage.updateOrderApplication(application.id, {
          status: "closing_submitted",
        });
      }

      // 정산 = {(배송수량+반품수량)*단가+(기타*200)}*1.1
      const pricePerUnit = order.pricePerUnit || 0;
      const billableCount = deliveryCount + (returnCount || 0);
      const otherAmount = (otherCount || 0) * 200;
      const baseAmount = (billableCount * pricePerUnit) + otherAmount;
      const settlementAmount = Math.floor(baseAmount * 1.1);

      // Update contract with closing_submitted data (do NOT auto-mark complete - handled by admin approval)
      await storage.updateContract(contract.id, {
        status: "closing_submitted",
      });

      // Update order status to closing_submitted (마감제출 - 관리자 승인 대기)
      await storage.updateOrder(orderId, {
        status: "closing_submitted",
      });

      // closingReports 생성 (레거시 호환: 신규 마감 보고서 테이블에도 데이터 저장)
      try {
        const [existingReport] = await db.select({ id: closingReports.id })
          .from(closingReports)
          .where(and(
            eq(closingReports.orderId, orderId),
            eq(closingReports.helperId, userId)
          ))
          .limit(1);

        if (!existingReport) {
          const closingData = {
            deliveredCount: deliveryCount || 0,
            returnedCount: returnCount || 0,
            etcCount: otherCount || 0,
            unitPrice: pricePerUnit,
            etcPricePerUnit: 0,
            extraCosts: [],
          };
          const closingSettlement = calculateSettlement(closingData);

          await db.insert(closingReports).values({
            orderId,
            helperId: userId,
            contractId: contract.id,
            deliveredCount: deliveryCount || 0,
            returnedCount: returnCount || 0,
            etcCount: otherCount || 0,
            etcPricePerUnit: 0,
            memo: null,
            status: "submitted",
            calculatedAmount: closingSettlement.totalAmount,
            supplyAmount: closingSettlement.supplyAmount,
            vatAmount: closingSettlement.vatAmount,
            totalAmount: closingSettlement.totalAmount,
            proofFilesJson: proofImageUrl ? JSON.stringify([proofImageUrl]) : null,
            deliveryHistoryImagesJson: proofImageUrl ? JSON.stringify([proofImageUrl]) : "[]",
          });
        }
      } catch (closingReportErr) {
        console.error(`[Legacy Closing] Failed to create closingReports for order ${orderId}:`, closingReportErr);
      }

      // Check if work confirmation exists, update or create
      const existingConfirmation = await storage.getWorkConfirmationByContract(contract.id);
      const confirmationNotes = `배송: ${deliveryCount}건, 반품: ${returnCount || 0}건, 수거: ${pickupCount || 0}건, 기타: ${otherCount || 0}건`;
      const completedAt = new Date();

      if (existingConfirmation) {
        await storage.updateWorkConfirmation(existingConfirmation.id, {
          notes: confirmationNotes,
          proofImageUrl: proofImageUrl || existingConfirmation.proofImageUrl,
          status: "submitted",
          deliveryCount: deliveryCount || 0,
          returnCount: returnCount || 0,
          pickupCount: pickupCount || 0,
          otherCount: otherCount || 0,
        });
      } else {
        await storage.createWorkConfirmation({
          contractId: contract.id,
          orderId,
          helperId: userId,
          proofImageUrl: proofImageUrl || null,
          notes: confirmationNotes,
          status: "submitted",
          deliveryCount: deliveryCount || 0,
          returnCount: returnCount || 0,
          pickupCount: pickupCount || 0,
          otherCount: otherCount || 0,
        });
      }

      // Create work proof event for completion (immutable log)
      const workSession = await storage.getWorkSessionByOrderAndHelper(orderId, userId);
      await storage.createWorkProofEvent({
        workSessionId: workSession?.id || null,
        helperId: userId,
        eventType: "complete",
        photoUrl: proofImageUrl || null,
        notes: JSON.stringify({
          deliveryCount,
          returnCount: returnCount || 0,
          pickupCount: pickupCount || 0,
          otherCount: otherCount || 0,
          settlementAmount,
          completedAt: completedAt.toISOString(),
        }),
      });

      // Auto checkout: Update work session with checkOutTime (업무마감 = 퇴근)
      if (workSession && !workSession.checkOutTime) {
        await storage.updateWorkSession(workSession.id, {
          checkOutTime: completedAt,
          status: "completed",
          workConfirmed: true,
          workConfirmedAt: completedAt,
        });
        console.log(`[Auto Checkout] Helper ${userId} checked out via order completion. Order: ${orderId}`);
      } else if (!workSession) {
        // No check-in record - log warning but allow completion (B안: 운영 현실적)
        console.warn(`[Order Complete] No work session found for helper ${userId} on order ${orderId}. Completion allowed without check-in.`);
      }

      // Also update check_in_records with checkOutTime if exists
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkInRecords = await storage.getCheckInRecordsByHelper(userId, today);
      const orderCheckIn = checkInRecords.find(r => r.orderId === orderId);
      if (orderCheckIn && !orderCheckIn.checkOutTime) {
        await storage.updateCheckInRecord(orderCheckIn.id, {
          checkOutTime: completedAt,
          status: "checked_out",
        });
        console.log(`[Auto Checkout] Updated check_in_records for helper ${userId}. Order: ${orderId}`);
      }

      // 알림 발송 (알림 실패해도 마감 처리에 영향 없도록 try-catch)
      try {
        // Get helper and requester info
        const helper = await storage.getUser(userId);
        const requester = contract.requesterId ? await storage.getUser(contract.requesterId) : null;

        // Prepare completion message
        const completionMessage = `${order.companyName} 마감 완료\n배송: ${deliveryCount}건, 반품: ${returnCount || 0}건${pickupCount ? `, 수거: ${pickupCount}건` : ""}${otherCount ? `, 기타: ${otherCount}건` : ""}\n정산금액: ${settlementAmount.toLocaleString()}원 (VAT포함)`;

        // Send push notification to Helper
        await storage.createNotification({
          userId: userId,
          type: "order_completed",
          title: "업무 마감 완료",
          message: completionMessage,
          relatedId: orderId,
        });

        const helperWsDelivered = notificationWS.sendToUser(userId, {
          type: "order_completed",
          title: "업무 마감 완료",
          message: completionMessage,
          relatedId: orderId,
          payload: { deliveryCount, returnCount, pickupCount, otherCount, settlementAmount },
        });

        // Log for admin (helper)
        await storage.createNotificationLog({
          userId: userId,
          type: "order_completed",
          title: "업무 마감 완료",
          message: completionMessage,
          relatedId: orderId,
          deliveryChannel: helperWsDelivered ? "websocket" : "polling",
        });

        // Send push notification to Requester
        if (requester) {
          const requesterMessage = `${helper?.name || "헬퍼"}님이 ${order.companyName} 업무를 마감했습니다.\n배송: ${deliveryCount}건, 반품: ${returnCount || 0}건${pickupCount ? `, 수거: ${pickupCount}건` : ""}${otherCount ? `, 기타: ${otherCount}건` : ""}\n정산금액: ${settlementAmount.toLocaleString()}원 (VAT포함)`;

          await storage.createNotification({
            userId: requester.id,
            type: "order_completed",
            title: "업무 마감 알림",
            message: requesterMessage,
            relatedId: orderId,
          });

          const requesterWsDelivered = notificationWS.sendToUser(requester.id, {
            type: "order_completed",
            title: "업무 마감 알림",
            message: requesterMessage,
            relatedId: orderId,
            payload: { deliveryCount, returnCount, pickupCount, otherCount, settlementAmount, helperName: helper?.name },
          });

          // Log for admin (requester)
          await storage.createNotificationLog({
            userId: requester.id,
            type: "order_completed",
            title: "업무 마감 알림",
            message: requesterMessage,
            relatedId: orderId,
            deliveryChannel: requesterWsDelivered ? "websocket" : "polling",
          });

          // Send web push to requester (async, non-blocking)
          sendPushToUser(requester.id, {
            title: "업무 마감 알림",
            body: `${helper?.name || "헬퍼"}님이 ${order.companyName} 업무를 마감했습니다. 정산금액: ${settlementAmount.toLocaleString()}원`,
            url: "/requester-dashboard",
            tag: `complete-${orderId}`,
          });
        }

        // Send web push to helper (async, non-blocking)
        sendPushToUser(userId, {
          title: "업무 마감 완료",
          body: `${order.companyName} 마감 완료. 정산금액: ${settlementAmount.toLocaleString()}원 (VAT포함)`,
          url: "/helper-dashboard",
          tag: `complete-${orderId}`,
        });

        console.log(`[Order Complete] Order ${orderId} completed by Helper ${userId}. Settlement: ${settlementAmount}원`);

        // Send order status update for real-time UI refresh
        notificationWS.sendOrderStatusUpdate(userId, {
          orderId,
          status: "completed",
          currentHelpers: order.currentHelpers || 1,
        });

        if (requester) {
          notificationWS.sendOrderStatusUpdate(requester.id, {
            orderId,
            status: "completed",
            currentHelpers: order.currentHelpers || 1,
          });
        }

        // Notify all other helpers on this order
        notifyOrderHelpers(orderId, "order_completed", "completed");

        // Broadcast to all admins for real-time admin console updates
        broadcastToAllAdmins("order", "completed", orderId, {
          orderId,
          helperId: userId,
          status: "completed",
          settlementAmount
        });
      } catch (notificationErr) {
        console.error(`[Notification Error] Failed to send notifications for order ${orderId}:`, notificationErr);
        // 알림 실패해도 마감 처리는 정상 진행
      }

      // Create settlement statement (기사정산) automatically with transaction
      // 새로운 계산 방식:
      // 총합계금 = 단가 × 박스수 × 1.1 (부가세 포함)
      // 본사 수수료 = 총합계금 × 수수료율% (본사 + 팀장)
      // 기사 수령액 = 총합계금 - 본사 수수료 (부가세 포함)

      try {
        // 멱등성 체크: 이미 정산이 생성되어 있으면 스킵
        const existingSettlement = await storage.getSettlementStatementByOrder(orderId);
        if (existingSettlement) {
          console.log(`[Settlement] Already exists for order ${orderId}, skipping creation`);
        } else {
          // 수수료율 조회 (우선순위: 신청 스냅샷 > 오더 스냅샷 > 현재 정책)
          // 매칭 시점의 헬퍼별 실효 수수료율을 보존하여 정책 변경 후에도 기존 정산에 영향 없음
          let totalCommissionRate: number;
          let platformRate: number;
          let teamLeaderRate: number;
          let rateSource: string;
          let teamLeaderId: string | null = null;

          // 1. 헬퍼 신청(application) 스냅샷이 있으면 우선 사용 (매칭 시점 헬퍼별 수수료율)
          const application = await storage.getOrderApplication(orderId, userId);
          if (application?.snapshotCommissionRate != null &&
            application?.snapshotPlatformRate != null &&
            application?.snapshotTeamLeaderRate != null) {
            totalCommissionRate = application.snapshotCommissionRate;
            platformRate = application.snapshotPlatformRate;
            teamLeaderRate = application.snapshotTeamLeaderRate;
            teamLeaderId = application.snapshotTeamLeaderId;
            rateSource = application.snapshotSource || "application_snapshot";
            // 2. 오더 스냅샷이 있으면 사용 (오더 생성 시점 글로벌 정책)
          } else if (order.snapshotCommissionRate != null &&
            order.snapshotPlatformRate != null &&
            order.snapshotTeamLeaderRate != null) {
            totalCommissionRate = order.snapshotCommissionRate;
            platformRate = order.snapshotPlatformRate;
            teamLeaderRate = order.snapshotTeamLeaderRate;
            rateSource = "order_snapshot";
            const teamMember = await storage.getTeamMemberByUserId(userId);
            if (teamMember) {
              const team = await storage.getTeamById(teamMember.teamId);
              teamLeaderId = team?.leaderId || null;
            }
            // 3. 스냅샷이 없으면 (레거시) 현재 정책으로 폴백
          } else {
            const effectiveRate = await storage.getEffectiveCommissionRate(userId);
            totalCommissionRate = effectiveRate.rate;
            platformRate = effectiveRate.platformRate;
            teamLeaderRate = effectiveRate.teamLeaderRate;
            rateSource = effectiveRate.source;
            teamLeaderId = effectiveRate.teamLeaderId;
          }

          console.log(`[Settlement] Total: ${totalCommissionRate}% (Platform: ${platformRate}%, TeamLeader: ${teamLeaderRate}%), Source: ${rateSource}`);

          // 박스수 = 배송 + 반품 + 기타
          const totalBoxCount = (deliveryCount || 0) + (returnCount || 0) + (otherCount || 0);

          // 공급가액 = 단가 × 박스수
          const supplyAmount = totalBoxCount * pricePerUnit;

          // 부가세 = 공급가액 × 10%
          const vatAmount = calculateVat(supplyAmount);

          // 총합계금 = 공급가액 + 부가세 (= 단가 × 박스수 × 1.1)
          const totalAmountWithVat = supplyAmount + vatAmount;

          // 총 수수료 = 총합계금 × 수수료율%
          const totalCommissionAmount = Math.round(totalAmountWithVat * totalCommissionRate / 100);

          // 본사 수수료 = 총합계금 × 본사수수료율%
          const platformCommission = Math.round(totalAmountWithVat * platformRate / 100);

          // 팀장 인센티브 = 총합계금 × 팀장수수료율%
          const teamLeaderIncentive = Math.round(totalAmountWithVat * teamLeaderRate / 100);

          // 기사 수령액 = 총합계금 - 총 수수료 (부가세 포함)
          const netPayout = totalAmountWithVat - totalCommissionAmount;

          const workDateStr = new Date().toISOString().split('T')[0];

          await storage.createSettlementStatement({
            orderId: orderId,
            helperId: userId,
            requesterId: contract.requesterId || null,
            workDate: workDateStr,
            deliveryCount: deliveryCount || 0,
            returnCount: returnCount || 0,
            pickupCount: pickupCount || 0,
            otherCount: otherCount || 0,
            basePay: supplyAmount, // 공급가액 (부가세 제외)
            additionalPay: 0,
            penalty: 0,
            deduction: 0,
            commissionRate: totalCommissionRate,
            commissionAmount: totalCommissionAmount,
            platformCommission: platformCommission,
            teamLeaderIncentive: teamLeaderIncentive,
            teamLeaderId: teamLeaderId,
            supplyAmount: supplyAmount, // 공급가액
            vatAmount: vatAmount, // 부가세
            totalAmount: totalAmountWithVat, // 총합계금 (부가세 포함)
            netAmount: netPayout, // 기사 수령액 (부가세 포함)
            status: "pending",
          });
          console.log(`[Settlement Created] Order ${orderId}, Helper ${userId}, Source: ${rateSource}, Rate: ${totalCommissionRate}%, Total: ${totalAmountWithVat}원, Commission: ${totalCommissionAmount}원 (Platform: ${platformCommission}원, TeamLeader: ${teamLeaderIncentive}원), Net: ${netPayout}원`);
        }
      } catch (settlementErr) {
        console.error(`[Settlement Error] Failed to create settlement for order ${orderId}:`, settlementErr);
      }

      res.json({
        message: "마감 등록 완료",
        settlementAmount,
        deliveryCount,
        returnCount,
        pickupCount,
      });
    } catch (err: any) {
      console.error("Order completion error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get order applications with helper info
  app.get("/api/orders/:id/applications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      const applications = await storage.getOrderApplications(orderId);

      const applicationsWithHelperInfo = await Promise.all(
        applications.map(async (app) => {
          const helper = await storage.getUser(app.helperId);
          const credential = await storage.getHelperCredential(app.helperId);
          const reviews = await storage.getHelperReviews(app.helperId);
          const avgRating = await storage.getHelperAverageRating(app.helperId);

          return {
            ...app,
            helperName: helper?.name || "Unknown",
            helperNickname: (helper as any)?.nickname || null,
            helperPhone: helper?.phoneNumber,
            teamName: (helper as any)?.teamName || null,
            completedJobs: (credential as any)?.completedOrders || 0,
            reviewCount: reviews.length,
            recentReviews: reviews.slice(0, 4).map(r => ({
              id: r.id,
              rating: r.rating,
              comment: r.comment,
              createdAt: r.createdAt,
              requesterName: null,
            })),
            averageRating: avgRating,
            profileImageUrl: (helper as any)?.profileImageUrl || null,
            profileImage: (helper as any)?.profileImageUrl || null,
          };
        })
      );

      res.json(applicationsWithHelperInfo);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
}