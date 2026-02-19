/**
 * 푸시 알림(Push Notification) API 라우트
 *
 * - GET  /api/push/vapid-public-key  – VAPID 공개키 조회
 * - POST /api/push/subscribe         – 웹 푸시 구독
 * - POST /api/push/unsubscribe       – 웹 푸시 구독 해제
 * - GET  /api/push/status            – 푸시 구독 상태 조회
 * - POST /api/push/register-fcm      – FCM 토큰 등록
 * - POST /api/push/unregister-fcm    – FCM 토큰 해제
 * - POST /api/admin/push/test        – 관리자 테스트 푸시 전송
 */

import { z } from "zod";
import type { RouteContext } from "./types";

export function registerPushRoutes(ctx: RouteContext): void {
  const { app, requireAuth, adminAuth, storage } = ctx;

  // VAPID 공개키 조회
  app.get("/api/push/vapid-public-key", (_req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(500).json({ message: "VAPID public key not configured" });
    }
    res.json({ publicKey });
  });

  // 웹 푸시 구독
  const pushSubscribeSchema = z.object({
    subscription: z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      }),
    }),
    userAgent: z.string().optional(),
  });

  app.post("/api/push/subscribe", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;

      const parseResult = pushSubscribeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "잘못된 구독 데이터입니다",
          errors: parseResult.error.errors,
        });
      }

      const { subscription, userAgent } = parseResult.data;

      // Remove existing subscription for this endpoint
      await storage.deletePushSubscriptionByEndpoint(subscription.endpoint);

      // Create new subscription
      const pushSub = await storage.createPushSubscription({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      });

      res.status(201).json({
        success: true,
        message: "푸시 알림이 활성화되었습니다",
        subscriptionId: pushSub.id,
      });
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      res.status(500).json({ message: "푸시 구독 중 오류가 발생했습니다" });
    }
  });

  // 웹 푸시 구독 해제
  app.post("/api/push/unsubscribe", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { endpoint } = req.body;

      if (endpoint) {
        await storage.deletePushSubscriptionByEndpoint(endpoint);
      } else {
        await storage.deletePushSubscriptionsByUser(userId);
      }

      res.json({ success: true, message: "푸시 알림이 비활성화되었습니다" });
    } catch (err: any) {
      console.error("Push unsubscribe error:", err);
      res.status(500).json({ message: "푸시 구독 해제 중 오류가 발생했습니다" });
    }
  });

  // 푸시 구독 상태 조회
  app.get("/api/push/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const subscriptions = await storage.getPushSubscriptionsByUser(userId);

      res.json({
        subscribed: subscriptions.length > 0,
        subscriptionCount: subscriptions.length,
      });
    } catch (err: any) {
      console.error("Push status error:", err);
      res.status(500).json({ message: "푸시 상태 조회 중 오류가 발생했습니다" });
    }
  });

  // FCM 토큰 등록
  const fcmRegisterSchema = z.object({
    fcmToken: z.string().min(1),
    platform: z.string().optional().default("native"),
    deviceInfo: z.string().optional(),
  });

  app.post("/api/push/register-fcm", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;

      const parseResult = fcmRegisterSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "잘못된 FCM 토큰 데이터입니다",
          errors: parseResult.error.errors,
        });
      }

      const { fcmToken, platform, deviceInfo } = parseResult.data;

      const token = await storage.createOrUpdateFcmToken({
        userId,
        token: fcmToken,
        platform,
        deviceInfo,
      });

      res.json({
        success: true,
        message: "FCM 토큰이 등록되었습니다",
        tokenId: token.id,
      });
    } catch (err: any) {
      console.error("FCM register error:", err);
      res.status(500).json({ message: "FCM 토큰 등록 중 오류가 발생했습니다" });
    }
  });

  // FCM 토큰 해제
  app.post("/api/push/unregister-fcm", requireAuth, async (req: any, res) => {
    try {
      const { fcmToken } = req.body;

      if (fcmToken) {
        await storage.deleteFcmToken(fcmToken);
      } else {
        const userId = req.user?.id;
        await storage.deleteFcmTokensByUser(userId);
      }

      res.json({ success: true, message: "FCM 토큰이 해제되었습니다" });
    } catch (err: any) {
      console.error("FCM unregister error:", err);
      res.status(500).json({ message: "FCM 토큰 해제 중 오류가 발생했습니다" });
    }
  });

  // 관리자: 테스트 푸시 전송
  app.post("/api/admin/push/test", adminAuth, async (req: any, res) => {
    try {
      const { userId, title, body, url } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const subscriptions = await storage.getPushSubscriptionsByUser(userId);

      if (subscriptions.length === 0) {
        return res.status(404).json({ message: "해당 사용자의 푸시 구독이 없습니다" });
      }

      const webpush = await import("web-push");

      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

      if (!vapidPublicKey || !vapidPrivateKey) {
        return res.status(500).json({ message: "VAPID keys not configured" });
      }

      webpush.setVapidDetails(
        "mailto:admin@hellpme.com",
        vapidPublicKey,
        vapidPrivateKey
      );

      const payload = JSON.stringify({
        title: title || "테스트 알림",
        body: body || "이것은 테스트 푸시 알림입니다.",
        url: url || "/",
        tag: "test-" + Date.now(),
      });

      let successCount = 0;
      let failCount = 0;

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          successCount++;
        } catch (err: any) {
          console.error("Push send error:", err);
          failCount++;

          // Remove invalid subscription
          if (err.statusCode === 404 || err.statusCode === 410) {
            await storage.deletePushSubscription(sub.id);
          }
        }
      }

      res.json({
        success: true,
        message: `${successCount}개 전송 성공, ${failCount}개 실패`,
      });
    } catch (err: any) {
      console.error("Test push error:", err);
      res.status(500).json({ message: "테스트 푸시 전송 중 오류가 발생했습니다" });
    }
  });
}
