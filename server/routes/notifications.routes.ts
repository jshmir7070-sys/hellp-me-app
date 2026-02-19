/**
 * 알림(Notification) API 라우트
 *
 * - GET  /api/notifications             – 사용자 알림 목록 조회
 * - GET  /api/notifications/unread-count – 읽지 않은 알림 수
 * - POST /api/notifications/:id/read    – 단일 알림 읽음 처리
 * - POST /api/notifications/read-all    – 전체 알림 읽음 처리
 * - POST /api/notifications/test        – 테스트 알림 생성
 */

import type { RouteContext } from "./types";

export function registerNotificationRoutes(ctx: RouteContext): void {
  const { app, requireAuth, storage } = ctx;

  // 사용자 알림 목록 조회
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (err: any) {
      console.error("[Notifications] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 읽지 않은 알림 수
  app.get("/api/notifications/unread-count", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (err: any) {
      console.error("[Notifications] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 단일 알림 읽음 처리
  app.post("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const notification = await storage.markNotificationAsRead(Number(req.params.id));
      res.json(notification);
    } catch (err: any) {
      console.error("[Notifications] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 전체 알림 읽음 처리
  app.post("/api/notifications/read-all", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Notifications] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 테스트 알림 생성
  app.post("/api/notifications/test", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;

      const testNotifications = [
        { userId, type: "matching_success" as const, title: "매칭 성공", message: "쿠팡 주간 배송 오더가 매칭되었습니다. 담당자 연락처: 010-1234-5678" },
        { userId, type: "announcement" as const, title: "본사 공지", message: "12월 31일은 정상 운영됩니다." },
      ];

      for (const notif of testNotifications) {
        await storage.createNotification(notif);
      }

      res.json({ success: true, message: "테스트 알림이 생성되었습니다" });
    } catch (err: any) {
      console.error("[Notifications] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
