/**
 * 출근 체크(Check-in) API 라우트
 *
 * - POST /api/checkin/qr                – QR 코드 기반 출근 체크
 * - POST /api/checkin                   – 오더 기반 직접 출근 체크
 * - POST /api/checkin/order             – 오더 기반 출근 (레거시)
 * - GET  /api/checkin/today             – 오늘의 출근 기록 조회
 * - GET  /api/checkin/qr-data           – 의뢰인 QR 코드 데이터
 * - POST /api/checkin/by-code           – 요청자 개인코드 출근 체크
 * - POST /api/checkin/verify-helper-code – 헬퍼 코드 출근 확인
 */

import { randomBytes } from "crypto";
import { normalizeOrderStatus, ORDER_STATUS } from "../constants/order-status";
import type { RouteContext } from "./types";

/** 오늘 날짜 시작시각을 KST(UTC+9) 기준으로 반환 */
function getTodayStartKST(): Date {
  const now = new Date();
  // KST = UTC + 9시간
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  // KST 기준 자정
  const kstMidnight = new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
    0, 0, 0, 0
  ));
  // UTC로 변환 (KST 자정 - 9시간 = 전날 15:00 UTC)
  return new Date(kstMidnight.getTime() - kstOffset);
}

export function registerCheckinRoutes(ctx: RouteContext): void {
  const { app, requireAuth, storage, notificationWS, broadcastToAllAdmins, notifyOrderHelpers, sendPushToUser } = ctx;

  // 헬퍼 역할 확인 미들웨어
  const requireHelper = async (req: any, res: any, next: any) => {
    const user = await storage.getUser(req.user?.id);
    if (!user || user.role !== "helper") {
      return res.status(403).json({ message: "헬퍼만 출근 체크를 할 수 있습니다" });
    }
    req.helperUser = user;
    next();
  };

  // QR 코드 기반 출근 체크
  app.post("/api/checkin/qr", requireAuth, requireHelper, async (req: any, res) => {
    try {
      const helperId = req.user?.id;
      const helperUser = req.helperUser;
      const { qrData, latitude, longitude, address } = req.body;

      // QR 데이터 파싱
      let parsedQR;
      try {
        parsedQR = JSON.parse(qrData);
      } catch {
        return res.status(400).json({ message: "잘못된 QR 코드입니다" });
      }

      // QR 유형 확인
      if (parsedQR.type !== "hellpme_checkin") {
        return res.status(400).json({ message: "출근 체크용 QR 코드가 아닙니다" });
      }

      const requesterId = parsedQR.requesterId;
      if (!requesterId) {
        return res.status(400).json({ message: "의뢰인 정보가 없는 QR 코드입니다" });
      }

      // 영구 토큰 검증
      if (!parsedQR.token) {
        return res.status(400).json({ message: "유효하지 않은 QR 코드입니다" });
      }

      // 의뢰인 확인 및 토큰 검증
      const requester = await storage.getUser(requesterId);
      if (!requester || requester.role !== "requester") {
        return res.status(400).json({ message: "유효하지 않은 의뢰인입니다" });
      }

      if (requester.checkInToken !== parsedQR.token) {
        return res.status(400).json({ message: "QR 코드가 유효하지 않습니다" });
      }

      // 헬퍼-의뢰인 간 활성 배정 확인 (order_applications + matched_helper_id 둘 다 체크)
      const helperApplications = await storage.getHelperApplications(helperId);
      const requesterOrders = await storage.getOrdersByRequesterId(requesterId);
      const activeOrders = requesterOrders.filter((o: any) => {
        const s = normalizeOrderStatus(o.status);
        return s === ORDER_STATUS.SCHEDULED || s === ORDER_STATUS.OPEN;
      });
      const activeOrderIds = new Set(activeOrders.map((o: any) => o.id));

      // 1) order_applications 기반 확인
      const hasAppAssignment = helperApplications.some(
        (app: any) => (app.status === "approved" || app.status === "selected") && activeOrderIds.has(app.orderId)
      );
      // 2) matched_helper_id 직접 배정 확인
      const hasDirectAssignment = activeOrders.some(
        (o: any) => o.matchedHelperId === helperId
      );

      if (!hasAppAssignment && !hasDirectAssignment) {
        return res.status(403).json({
          message: "이 의뢰인과의 활성 배정이 없습니다. 오더에 지원 후 승인되어야 출근할 수 있습니다.",
        });
      }

      // 이미 오늘 이 의뢰인에게 출근한 기록이 있는지 확인 (중복 출근 방지, KST 기준)
      const today = getTodayStartKST();
      const existingRecords = await storage.getCheckInRecordsByHelper(helperId, today);
      const alreadyCheckedIn = existingRecords.some((r: any) => r.requesterId === requesterId);

      if (alreadyCheckedIn) {
        return res.status(400).json({
          message: "이미 오늘 이 의뢰인에게 출근 체크를 하셨습니다",
          alreadyCheckedIn: true,
        });
      }

      // 해당 헬퍼가 배정된 활성 오더 찾기 (scheduled → in_progress로 변경)
      const approvedApp = helperApplications.find(
        (app: any) => (app.status === "approved" || app.status === "selected") && activeOrderIds.has(app.orderId)
      );
      // matched_helper_id 직접 배정 오더 (application 없는 경우)
      const directOrder = !approvedApp
        ? activeOrders.find((o: any) => o.matchedHelperId === helperId)
        : null;

      // 배정된 오더 ID 결정 (application 우선, 없으면 직접 배정)
      const assignedOrderId = approvedApp?.orderId || directOrder?.id || null;

      let updatedOrder: any = null;
      if (approvedApp) {
        const order = await storage.getOrder(approvedApp.orderId);
        const orderStatus = normalizeOrderStatus(order.status);
        if (order && (orderStatus === ORDER_STATUS.SCHEDULED || orderStatus === ORDER_STATUS.OPEN)) {
          updatedOrder = await storage.updateOrder(approvedApp.orderId, {
            status: "in_progress",
          });

          await storage.updateOrderApplication(approvedApp.id, {
            checkedInAt: new Date(),
          });
        }
      } else if (directOrder) {
        // matched_helper_id 직접 배정: application 없이 오더 상태 변경
        const orderStatus = normalizeOrderStatus(directOrder.status);
        if (orderStatus === ORDER_STATUS.SCHEDULED || orderStatus === ORDER_STATUS.OPEN) {
          updatedOrder = await storage.updateOrder(directOrder.id, {
            status: "in_progress",
          });
        }
      }

      // 출근 기록 생성
      const checkInRecord = await storage.createCheckInRecord({
        helperId,
        requesterId,
        requesterName: parsedQR.requesterName || requester.name,
        checkInTime: new Date(),
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        status: "checked_in",
        orderId: assignedOrderId,
      });

      // 헬퍼 상태를 "근무중"으로 변경
      await storage.updateUser(helperId, { dailyStatus: "working" });

      // 알림 생성 - 의뢰인에게 헬퍼 출근 알림
      await storage.createNotification({
        userId: requesterId,
        type: "helper_checked_in",
        title: "헬퍼 출근 완료",
        message: `${helperUser?.name || "헬퍼"}님이 출근 체크를 완료했습니다. 오더가 업무중으로 변경되었습니다.`,
        relatedId: checkInRecord.id,
      });

      // WebSocket 실시간 알림
      if (updatedOrder && assignedOrderId) {
        notificationWS.sendOrderStatusUpdate(requesterId, {
          orderId: assignedOrderId,
          status: "in_progress",
        });
      }
      notificationWS.sendToUser(requesterId, {
        type: "helper_checked_in",
        title: "헬퍼 출근 완료",
        message: `${helperUser?.name || "헬퍼"}님이 출근 체크를 완료했습니다.`,
        relatedId: assignedOrderId,
      });

      // 푸시 알림
      sendPushToUser(requesterId, {
        title: "헬퍼 출근 완료",
        body: `${helperUser?.name || "헬퍼"}님이 출근 체크를 완료했습니다.`,
        url: "/requester-home",
        tag: `checkin-qr-${assignedOrderId}`,
      });

      // 관리자에게 브로드캐스트
      broadcastToAllAdmins("checkin", "created", checkInRecord.id, {
        orderId: assignedOrderId,
        helperId,
        helperName: helperUser?.name,
        status: "checked_in",
      });

      res.status(201).json({
        success: true,
        message: "출근 체크가 완료되었습니다. 오더가 업무중으로 변경되었습니다.",
        checkIn: checkInRecord,
        requesterName: parsedQR.requesterName || requester.name,
        orderStatus: updatedOrder?.status || null,
      });
    } catch (err: any) {
      console.error("Check-in error:", err);
      res.status(500).json({ message: "출근 체크 중 오류가 발생했습니다" });
    }
  });

  // 오더 기반 직접 출근 체크
  app.post("/api/checkin", requireAuth, requireHelper, async (req: any, res) => {
    try {
      const helperId = req.user?.id;
      const helperUser = req.helperUser;
      const { orderId, latitude, longitude, address } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "오더 ID가 필요합니다" });
      }

      // 오더 확인
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 헬퍼 배정 검증 (application 또는 matched_helper_id)
      const application = await storage.getOrderApplication(orderId, helperId);
      const isAssigned = (application && (application.status === "approved" || application.status === "selected"))
        || (order as any).matchedHelperId === helperId;
      if (!isAssigned) {
        return res.status(403).json({ message: "이 오더에 배정되지 않았습니다" });
      }

      // 이미 오늘 이 오더에 출근한 기록이 있는지 확인 (KST 기준)
      const today = getTodayStartKST();
      const existingRecords = await storage.getCheckInRecordsByHelper(helperId, today);
      const alreadyCheckedIn = existingRecords.some((r: any) => r.orderId === orderId);

      if (alreadyCheckedIn) {
        return res.status(400).json({ message: "이미 출근 체크를 하셨습니다" });
      }

      const checkInTime = new Date();

      // 출근 기록 생성
      const checkInRecord = await storage.createCheckInRecord({
        helperId,
        orderId: orderId,
        requesterId: order.requesterId || "",
        requesterName: null,
        checkInTime,
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        status: "checked_in",
      });

      // 헬퍼 신청 상태를 in_progress로 변경
      if (application && (application.status === "approved" || application.status === "selected" || application.status === "scheduled")) {
        await storage.updateOrderApplication(application.id, {
          status: "in_progress",
          checkedInAt: checkInTime,
        });
      }

      // 오더 상태를 in_progress로 변경
      const orderStatus = normalizeOrderStatus(order.status);
      if (orderStatus === ORDER_STATUS.SCHEDULED || orderStatus === ORDER_STATUS.OPEN) {
        await storage.updateOrder(orderId, {
          status: "in_progress",
          checkedInAt: checkInTime,
        });
      }

      // 헬퍼 상태를 "근무중"으로 변경
      await storage.updateUser(helperId, { dailyStatus: "working" });

      // 알림 생성 - 의뢰인에게 헬퍼 출근 알림
      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "helper_checked_in",
          title: "헬퍼 출근",
          message: `${helperUser?.name || "헬퍼"}님이 ${order.companyName} 오더에 출근했습니다.`,
          relatedId: orderId,
        });

        // WebSocket 알림
        notificationWS.sendOrderStatusUpdate(order.requesterId, {
          orderId,
          status: "in_progress",
          approvalStatus: order.approvalStatus || undefined,
        });
        notificationWS.sendToUser(order.requesterId, {
          type: "helper_checked_in",
          title: "헬퍼 출근",
          message: `${helperUser?.name || "헬퍼"}님이 ${order.companyName} 오더에 출근했습니다.`,
          relatedId: orderId,
        });

        // 푸시 알림
        sendPushToUser(order.requesterId, {
          title: "헬퍼 출근",
          body: `${helperUser?.name || "헬퍼"}님이 ${order.companyName} 오더에 출근했습니다.`,
          url: "/requester-home",
          tag: `checkin-${orderId}`,
        });
      }

      // 관리자에게 브로드캐스트
      broadcastToAllAdmins("order_status", "helper_checked_in", orderId, {
        orderId,
        helperName: helperUser?.name,
        companyName: order.companyName,
      });

      res.status(201).json({
        success: true,
        message: "출근 체크가 완료되었습니다",
        checkIn: checkInRecord,
      });
    } catch (err: any) {
      console.error("Check-in error:", err);
      res.status(500).json({ message: "출근 체크 중 오류가 발생했습니다" });
    }
  });

  // 오더 기반 체크인 (레거시)
  app.post("/api/checkin/order", requireAuth, requireHelper, async (req: any, res) => {
    try {
      const helperId = req.user?.id;
      const helperUser = req.helperUser;
      const { orderId, latitude, longitude, address } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "오더 ID가 필요합니다" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "오더를 찾을 수 없습니다" });
      }

      // 헬퍼 배정 검증
      const legacyApp = await storage.getOrderApplication(orderId, helperId);
      const isLegacyAssigned = (legacyApp && (legacyApp.status === "approved" || legacyApp.status === "selected"))
        || (order as any).matchedHelperId === helperId;
      if (!isLegacyAssigned) {
        return res.status(403).json({ message: "이 오더에 배정되지 않았습니다" });
      }

      const today = getTodayStartKST();
      const existingRecords = await storage.getCheckInRecordsByHelper(helperId, today);
      const alreadyCheckedIn = existingRecords.some((r: any) => r.orderId === orderId);

      if (alreadyCheckedIn) {
        return res.status(400).json({ message: "이미 출근 체크를 하셨습니다" });
      }

      const checkInRecord = await storage.createCheckInRecord({
        helperId,
        orderId: orderId,
        requesterId: order.requesterId || "",
        requesterName: null,
        checkInTime: new Date(),
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        status: "checked_in",
      });

      await storage.updateUser(helperId, { dailyStatus: "working" });

      if (order.requesterId) {
        await storage.createNotification({
          userId: order.requesterId,
          type: "order_application",
          title: "헬퍼 출근 완료",
          message: `${helperUser?.name || "헬퍼"}님이 오더 #${orderId}에 출근 체크를 완료했습니다.`,
          relatedId: checkInRecord.id,
        });

        // Real-time update to requester
        notificationWS.sendOrderStatusUpdate(order.requesterId, {
          orderId,
          status: "checked_in",
          currentHelpers: order.currentHelpers || 1,
        });
        notificationWS.sendToUser(order.requesterId, {
          type: "checkin_update",
          title: "헬퍼 출근 완료",
          message: `${helperUser?.name || "헬퍼"}님이 출근 체크를 완료했습니다.`,
          relatedId: orderId,
        });
      }

      // Notify all other helpers on this order
      notifyOrderHelpers(orderId, "checkin_update", "checked_in");

      // Broadcast to admins for real-time admin console updates
      broadcastToAllAdmins("checkin", "created", checkInRecord.id, {
        orderId,
        helperId,
        status: "checked_in",
      });

      res.status(201).json({
        success: true,
        message: "출근 체크가 완료되었습니다",
        checkIn: checkInRecord,
      });
    } catch (err: any) {
      console.error("Check-in error:", err);
      res.status(500).json({ message: "출근 체크 중 오류가 발생했습니다" });
    }
  });

  // 오늘의 출근 기록 조회 (헬퍼 전용)
  app.get("/api/checkin/today", requireAuth, requireHelper, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const today = getTodayStartKST();

      const records = await storage.getCheckInRecordsByHelper(userId, today);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 의뢰인용 QR 코드 API (영구 토큰 사용)
  app.get("/api/checkin/qr-data", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 QR 코드를 생성할 수 있습니다" });
      }

      // If user doesn't have a checkInToken, generate one
      let checkInToken = user.checkInToken;
      if (!checkInToken) {
        checkInToken = randomBytes(32).toString("hex");
        await storage.updateUser(userId, { checkInToken });
      }

      const qrData = {
        type: "hellpme_checkin",
        requesterId: userId,
        requesterName: user.name,
        requesterPhone: user.phoneNumber,
        token: checkInToken,
      };

      res.json(qrData);
    } catch (err: any) {
      console.error("QR data error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 헬퍼가 요청자 개인코드로 출근 체크 (12자리 코드 입력)
  app.post("/api/checkin/by-code", requireAuth, requireHelper, async (req: any, res) => {
    try {
      const helperId = req.user?.id;
      const helperUser = req.helperUser;
      const { requesterCode, latitude, longitude, address } = req.body;

      if (!requesterCode || typeof requesterCode !== "string" || requesterCode.length !== 12) {
        return res.status(400).json({ message: "12자리 요청자 코드를 입력해주세요" });
      }

      // 요청자 코드로 사용자 찾기
      const normalizedCode = requesterCode.trim().toUpperCase();
      const requester = await storage.getUserByPersonalCode(normalizedCode);

      if (!requester) {
        return res.status(404).json({ message: "유효하지 않은 요청자 코드입니다" });
      }

      if (requester.role !== "requester") {
        return res.status(400).json({ message: "해당 코드는 요청자 계정이 아닙니다" });
      }

      const requesterId = requester.id;

      // 헬퍼-요청자 간 활성 배정 확인 (order_applications + matched_helper_id 둘 다 체크)
      const helperApplications = await storage.getHelperApplications(helperId);
      const requesterOrders = await storage.getOrdersByRequesterId(requesterId);
      const activeOrders = requesterOrders.filter((o: any) => {
        const s = normalizeOrderStatus(o.status);
        return s === ORDER_STATUS.SCHEDULED || s === ORDER_STATUS.OPEN;
      });
      const activeOrderIds = new Set(activeOrders.map((o: any) => o.id));

      // 1) order_applications 기반 확인
      const approvedApp = helperApplications.find(
        (app: any) => (app.status === "approved" || app.status === "selected") && activeOrderIds.has(app.orderId)
      );
      // 2) matched_helper_id 직접 배정 확인
      const directOrder = !approvedApp
        ? activeOrders.find((o: any) => o.matchedHelperId === helperId)
        : null;

      if (!approvedApp && !directOrder) {
        return res.status(403).json({
          message: "이 요청자와의 활성 배정이 없습니다. 오더에 지원 후 승인되어야 출근할 수 있습니다.",
        });
      }

      // 배정된 오더 ID 결정
      const assignedOrderId = approvedApp?.orderId || directOrder?.id || null;

      // 이미 오늘 이 요청자에게 출근한 기록이 있는지 확인 (KST 기준)
      const today = getTodayStartKST();
      const existingRecords = await storage.getCheckInRecordsByHelper(helperId, today);
      const alreadyCheckedIn = existingRecords.some((r: any) => r.requesterId === requesterId);

      if (alreadyCheckedIn) {
        return res.status(400).json({
          message: "이미 오늘 이 요청자에게 출근 체크를 하셨습니다",
          alreadyCheckedIn: true,
        });
      }

      // 오더 상태를 "in_progress" (업무중)으로 변경
      let updatedOrder: any = null;
      if (approvedApp) {
        const order = await storage.getOrder(approvedApp.orderId);
        const checkOrderStatus = normalizeOrderStatus(order.status);
        if (order && (checkOrderStatus === ORDER_STATUS.SCHEDULED || checkOrderStatus === ORDER_STATUS.OPEN)) {
          updatedOrder = await storage.updateOrder(approvedApp.orderId, {
            status: "in_progress",
          });

          await storage.updateOrderApplication(approvedApp.id, {
            checkedInAt: new Date(),
          });
        }
      } else if (directOrder) {
        // matched_helper_id 직접 배정: application 없이 오더 상태 변경
        const orderStatus = normalizeOrderStatus(directOrder.status);
        if (orderStatus === ORDER_STATUS.SCHEDULED || orderStatus === ORDER_STATUS.OPEN) {
          updatedOrder = await storage.updateOrder(directOrder.id, {
            status: "in_progress",
          });
        }
      }

      // 출근 기록 생성
      const checkInRecord = await storage.createCheckInRecord({
        helperId,
        requesterId,
        requesterName: requester.name,
        checkInTime: new Date(),
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        status: "checked_in",
        orderId: assignedOrderId,
      });

      // 헬퍼 상태를 "근무중"으로 변경
      await storage.updateUser(helperId, { dailyStatus: "working" });

      // 알림 생성 - 요청자에게 헬퍼 출근 알림
      await storage.createNotification({
        userId: requesterId,
        type: "helper_checked_in",
        title: "헬퍼 출근 완료",
        message: `${helperUser?.name || "헬퍼"}님이 출근 체크를 완료했습니다. 오더가 업무중으로 변경되었습니다.`,
        relatedId: checkInRecord.id,
      });

      // WebSocket 실시간 알림
      if (updatedOrder && assignedOrderId) {
        notificationWS.sendOrderStatusUpdate(requesterId, {
          orderId: assignedOrderId,
          status: "in_progress",
        });
      }
      notificationWS.sendToUser(requesterId, {
        type: "helper_checked_in",
        title: "헬퍼 출근 완료",
        message: `${helperUser?.name || "헬퍼"}님이 출근 체크를 완료했습니다.`,
        relatedId: assignedOrderId,
      });

      // 푸시 알림
      sendPushToUser(requesterId, {
        title: "헬퍼 출근 완료",
        body: `${helperUser?.name || "헬퍼"}님이 출근 체크를 완료했습니다.`,
        url: "/requester-home",
        tag: `checkin-code-${assignedOrderId}`,
      });

      // 관리자에게 브로드캐스트
      broadcastToAllAdmins("checkin", "created", checkInRecord.id, {
        orderId: assignedOrderId,
        helperId,
        helperName: helperUser?.name,
        status: "checked_in",
      });

      res.status(201).json({
        success: true,
        message: "출근 체크가 완료되었습니다. 오더가 업무중으로 변경되었습니다.",
        checkIn: checkInRecord,
        requesterName: requester.name,
        orderStatus: updatedOrder?.status || "in_progress",
        orderId: assignedOrderId,
      });
    } catch (err: any) {
      console.error("check-in by-code error:", err);
      res.status(500).json({ message: "출근 체크 중 오류가 발생했습니다" });
    }
  });

  // 요청자가 헬퍼 개인코드로 출근 확인 (12자리 코드 입력 또는 QR 스캔)
  app.post("/api/checkin/verify-helper-code", requireAuth, async (req: any, res) => {
    try {
      const requesterId = req.user?.id;
      const requester = await storage.getUser(requesterId);

      if (!requester || requester.role !== "requester") {
        return res.status(403).json({ message: "요청자만 헬퍼 출근을 확인할 수 있습니다" });
      }

      const { helperCode } = req.body;
      if (!helperCode || typeof helperCode !== "string" || helperCode.length !== 12) {
        return res.status(400).json({ message: "12자리 헬퍼 코드를 입력해주세요" });
      }

      // 헬퍼 코드로 사용자 찾기
      const normalizedCode = helperCode.trim().toUpperCase();
      const helper = await storage.getUserByPersonalCode(normalizedCode);

      if (!helper) {
        return res.status(404).json({ message: "유효하지 않은 헬퍼 코드입니다" });
      }

      if (helper.role !== "helper") {
        return res.status(400).json({ message: "해당 코드는 헬퍼 계정이 아닙니다" });
      }

      // 중복 출근 방지 (KST 기준)
      const todayStart = getTodayStartKST();
      const existingRecords = await storage.getCheckInRecordsByHelper(helper.id, todayStart);
      const alreadyCheckedIn = existingRecords.some((r: any) => r.requesterId === requesterId);

      if (alreadyCheckedIn) {
        return res.status(400).json({
          message: "이미 오늘 이 헬퍼의 출근이 확인되었습니다",
          alreadyCheckedIn: true,
        });
      }

      // 헬퍼-요청자 간 활성 배정 확인 및 오더 상태 변경 (order_applications + matched_helper_id 둘 다 체크)
      const helperApplications = await storage.getHelperApplications(helper.id);
      const requesterOrders = await storage.getOrdersByRequesterId(requesterId);
      const activeOrders = requesterOrders.filter((o: any) => {
        const s = normalizeOrderStatus(o.status);
        // cancelled/closed 오더는 제외 (취소된 오더에 체크인 방지)
        return s === ORDER_STATUS.SCHEDULED || s === ORDER_STATUS.OPEN;
      });
      const activeOrderIds = new Set(activeOrders.map((o: any) => o.id));

      // 1) order_applications 기반 확인
      const approvedApp = helperApplications.find(
        (a: any) => (a.status === "approved" || a.status === "selected") && activeOrderIds.has(a.orderId)
      );
      // 2) matched_helper_id 직접 배정 확인
      const directOrder = !approvedApp
        ? activeOrders.find((o: any) => o.matchedHelperId === helper.id)
        : null;

      // 배정이 없으면 에러
      if (!approvedApp && !directOrder) {
        return res.status(403).json({
          message: "이 헬퍼와의 활성 배정이 없습니다.",
        });
      }

      // 배정된 오더 ID 결정
      const assignedOrderId = approvedApp?.orderId || directOrder?.id || null;

      let updatedOrder: any = null;
      if (approvedApp) {
        const order = await storage.getOrder(approvedApp.orderId);
        const orderStatus = normalizeOrderStatus(order.status);
        if (order && (orderStatus === ORDER_STATUS.SCHEDULED || orderStatus === ORDER_STATUS.OPEN)) {
          updatedOrder = await storage.updateOrder(approvedApp.orderId, {
            status: "in_progress",
          });
          await storage.updateOrderApplication(approvedApp.id, {
            checkedInAt: new Date(),
          });
        }
      } else if (directOrder) {
        // matched_helper_id 직접 배정: application 없이 오더 상태 변경
        const orderStatus = normalizeOrderStatus(directOrder.status);
        if (orderStatus === ORDER_STATUS.SCHEDULED || orderStatus === ORDER_STATUS.OPEN) {
          updatedOrder = await storage.updateOrder(directOrder.id, {
            status: "in_progress",
          });
        }
      }

      // 출근 기록 생성
      const now = new Date();
      const checkInRecord = await storage.createCheckInRecord({
        helperId: helper.id,
        requesterId: requesterId,
        requesterName: requester.name,
        checkInTime: now,
        latitude: null,
        longitude: null,
        address: null,
        status: "checked_in",
        orderId: assignedOrderId,
      });

      // 헬퍼 상태를 "근무중"으로 변경
      await storage.updateUser(helper.id, { dailyStatus: "working" });

      // 알림 전송
      await storage.createNotification({
        userId: helper.id,
        title: "출근 확인",
        message: `${requester.name || "요청자"}님이 출근을 확인했습니다.`,
        type: "helper_checked_in",
        relatedId: checkInRecord.id,
      });

      // WebSocket 실시간 알림
      if (updatedOrder && assignedOrderId) {
        notificationWS.sendOrderStatusUpdate(requesterId, {
          orderId: assignedOrderId,
          status: "in_progress",
        });
      }
      notificationWS.sendToUser(helper.id, {
        type: "helper_checked_in",
        title: "출근 확인",
        message: `${requester.name || "요청자"}님이 출근을 확인했습니다.`,
        relatedId: assignedOrderId,
      });

      res.json({
        success: true,
        message: "헬퍼 출근이 확인되었습니다",
        helperName: helper.name,
        helperId: helper.id,
        checkInTime: now,
      });
    } catch (err: any) {
      console.error("verify-helper-code error:", err);
      res.status(500).json({ message: "출근 확인 중 오류가 발생했습니다" });
    }
  });
}
