/**
 * PG 결제 관련 라우트
 *
 * PortOne V2 API를 통한 결제 관리 엔드포인트
 *
 * - POST /api/admin/payments/bulk-sync   – 여러 결제 건 PG 동기화
 * - GET  /api/admin/payments/pg-info     – PG 연동 정보 조회
 * - POST /api/payments/webhook/portone   – PortOne 웹훅 수신
 */

import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { payments, webhookLogs } from "@shared/schema";
import type { RouteContext, AdminRequest } from "./types";
import { PAYMENT_STATUS, canTransitionPaymentStatus } from "../utils/admin-audit";

// ============================================
// Standard Webhooks 시그니처 검증
// (PortOne V2는 Standard Webhooks 스펙 준수)
// https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
// ============================================

const WEBHOOK_TOLERANCE_SECONDS = 300; // 5분 (재생 공격 방지)

/**
 * Standard Webhooks 시그니처를 검증합니다.
 */
function verifyWebhookSignature(
  secret: string,
  body: string,
  headers: Record<string, string | string[] | undefined>
): true | string {
  // 1) 필수 헤더 추출
  const msgId = headers["webhook-id"] as string | undefined;
  const timestamp = headers["webhook-timestamp"] as string | undefined;
  const signatureHeader = headers["webhook-signature"] as string | undefined;

  if (!msgId) return "webhook-id 헤더 누락";
  if (!timestamp) return "webhook-timestamp 헤더 누락";
  if (!signatureHeader) return "webhook-signature 헤더 누락";

  // 2) 타임스탬프 검증 (±5분)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return "webhook-timestamp가 유효한 숫자가 아닙니다";

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS) {
    return `타임스탬프 만료 (${Math.abs(now - ts)}초 차이, 허용: ${WEBHOOK_TOLERANCE_SECONDS}초)`;
  }

  // 3) 시크릿 키 디코딩 (whsec_ prefix 제거 후 Base64 디코딩)
  let secretBytes: Buffer;
  try {
    const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    secretBytes = Buffer.from(rawSecret, "base64");
  } catch {
    return "웹훅 시크릿 디코딩 실패";
  }

  // 4) 서명 대상 생성: "{msg_id}.{timestamp}.{body}"
  const signedContent = `${msgId}.${timestamp}.${body}`;

  // 5) HMAC-SHA256 서명 생성
  const expectedSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // 6) 헤더에서 서명 목록 파싱
  const signatures = signatureHeader.split(" ");

  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts.length !== 2) continue;

    const [version, sigValue] = parts;
    if (version !== "v1") continue; // 현재 v1(HMAC-SHA256)만 지원

    // 7) Constant-time 비교
    try {
      const expected = Buffer.from(expectedSignature, "base64");
      const received = Buffer.from(sigValue, "base64");
      if (expected.length === received.length && crypto.timingSafeEqual(expected, received)) {
        return true; // ✅ 검증 성공
      }
    } catch {
      continue;
    }
  }

  return "서명 불일치 — 위조된 요청일 수 있습니다";
}

export function registerPGPaymentRoutes(ctx: RouteContext): void {
  const { app, adminAuth, storage, db, pgService, mapPGStatusToDBStatus, logAdminAction, broadcastToAllAdmins } = ctx;

  /**
   * PG 연동 정보 조회 (관리자)
   */
  app.get("/api/admin/payments/pg-info", adminAuth, (_req, res) => {
    const info = pgService.getServiceInfo();
    res.json({
      success: true,
      pg: info,
      supportedFeatures: {
        refund: true,
        partialRefund: true,
        statusSync: true,
        webhook: true,
      },
      supportedProviders: [
        "PortOne V2 (토스, KG이니시스, 나이스, KCP 등)",
      ],
    });
  });

  /**
   * 여러 결제 건 PG 상태 일괄 동기화 (관리자)
   */
  app.post("/api/admin/payments/bulk-sync", adminAuth, async (req, res) => {
    try {
      const user = (req as AdminRequest).adminUser || (req as AdminRequest).user;
      const { paymentIds } = req.body;

      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ message: "paymentIds는 필수 배열입니다." });
      }

      if (paymentIds.length > 50) {
        return res.status(400).json({ message: "한 번에 최대 50건까지 동기화할 수 있습니다." });
      }

      const results: Array<{
        paymentId: number;
        success: boolean;
        beforeStatus?: string;
        afterStatus?: string;
        message: string;
      }> = [];

      for (const paymentId of paymentIds) {
        try {
          const payment = await storage.getPayment(paymentId);
          if (!payment) {
            results.push({ paymentId, success: false, message: "결제를 찾을 수 없습니다." });
            continue;
          }

          const pgTxId = (payment as any).pgTransactionId;
          if (!pgTxId) {
            results.push({ paymentId, success: false, message: "pgTransactionId 없음" });
            continue;
          }

          if (!pgService.isConfigured()) {
            results.push({ paymentId, success: false, message: "PG 미연동" });
            continue;
          }

          const pgResult = await pgService.getPaymentStatus(pgTxId);
          if (!pgResult.success) {
            results.push({ paymentId, success: false, message: pgResult.message });
            continue;
          }

          const newStatus = mapPGStatusToDBStatus(pgResult.status);

          // 상태 전이 검증
          if (!canTransitionPaymentStatus(payment.status || 'initiated', newStatus)) {
            results.push({
              paymentId,
              success: false,
              beforeStatus: payment.status || 'initiated',
              afterStatus: newStatus,
              message: `유효하지 않은 상태 전이: ${payment.status} -> ${newStatus}`,
            });
            continue;
          }

          if (newStatus !== payment.status) {
            await storage.updatePayment(paymentId, { status: newStatus });
            results.push({
              paymentId,
              success: true,
              beforeStatus: payment.status || 'initiated',
              afterStatus: newStatus,
              message: `상태 변경: ${payment.status} → ${newStatus}`,
            });
          } else {
            results.push({
              paymentId,
              success: true,
              beforeStatus: payment.status || 'initiated',
              afterStatus: payment.status,
              message: "PG 상태와 동일",
            });
          }
        } catch (err: any) {
          results.push({
            paymentId,
            success: false,
            message: `오류: ${(err as Error).message}`,
          });
        }
      }

      const changed = results.filter(r => r.success && r.beforeStatus !== r.afterStatus);
      const failed = results.filter(r => !r.success);

      await logAdminAction({
        userId: user?.id,
        action: "bulk_sync",
        targetType: "payment",
        targetId: "bulk",
        reason: "일괄 PG 상태 동기화",
        metadata: {
          totalRequested: paymentIds.length,
          changed: changed.length,
          failed: failed.length,
        },
      });

      res.json({
        success: true,
        total: paymentIds.length,
        synced: results.filter(r => r.success).length,
        changed: changed.length,
        failed: failed.length,
        results,
      });
    } catch (err: any) {
      console.error("Bulk sync error:", err);
      res.status(500).json({ message: "일괄 동기화 실패" });
    }
  });

  /**
   * PortOne 웹훅 수신
   * POST /api/payments/webhook/portone
   */
  app.post("/api/payments/webhook/portone", async (req, res) => {
    let webhookLogId: number | null = null;
    const webhookId = req.headers["webhook-id"] as string | undefined;

    try {
      const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;

      // ─── 0단계: 멱등성 검사 (Idempotency) ───
      const rawBodyBuf = (req as any).rawBody as Buffer | undefined;
      const rawBody = rawBodyBuf ? rawBodyBuf.toString("utf8") : JSON.stringify(req.body);

      if (webhookId) {
        try {
          const [inserted] = await db.insert(webhookLogs).values({
            webhookId: webhookId,
            source: "portone",
            eventType: "payment.webhook", // Added eventType as it is notNull in schema
            payload: rawBody,
            status: "pending",
          }).returning({ id: webhookLogs.id });
          webhookLogId = inserted.id;
        } catch (e: any) {
          if (e.code === "23505") { // Unique constraint violation (중복 웹훅)
            const existing = await db.select().from(webhookLogs).where(eq(webhookLogs.webhookId, webhookId)).limit(1);
            // 이미 성공했거나 처리 중이면 200 OK 반환 (재시도 방지)
            console.log(`[PG Webhook] 중복 요청 (Idempotency): ${webhookId}`);
            return res.status(200).json({ received: true, cached: true });
          }
          console.error("[PG Webhook] Log Insert Error:", e);
          // 로그 실패해도 진행은 시도
        }
      }

      // ─── 1단계: 시그니처 검증 ───
      if (webhookSecret) {
        const result = verifyWebhookSignature(webhookSecret, rawBody, req.headers);
        if (result !== true) {
          console.warn(`[PG Webhook] 시그니처 검증 실패: ${result}`);
          if (webhookLogId) await db.update(webhookLogs).set({ status: "failed", errorMessage: "Invalid Signature" }).where(eq(webhookLogs.id, webhookLogId));
          return res.status(401).json({ message: "Webhook signature verification failed" });
        }
      }

      // ─── 2단계: 이벤트 처리 ───
      const { type, data } = req.body;

      if (type === "Transaction.Paid" || type === "Transaction.Cancelled" || type === "Transaction.Failed") {
        const pgPaymentId = data?.paymentId;
        if (!pgPaymentId) return res.status(200).json({ received: true });

        await db.transaction(async (tx) => {
          // ─── 3단계: Row Locking (동시성 제어) ───
          const [payment] = await tx.select()
            .from(payments)
            .where(eq(payments.providerPaymentId, pgPaymentId))
            .for('update');

          if (!payment) {
            console.warn(`[PG Webhook] 결제 건 없음: ${pgPaymentId}`);
            if (webhookLogId) await tx.update(webhookLogs).set({ status: "failed", errorMessage: "Payment not found" }).where(eq(webhookLogs.id, webhookLogId));
            return;
          }

          // ─── 4단계: PG 상태 조회 ───
          if (!pgService.isConfigured()) return;
          const pgResult = await pgService.getPaymentStatus(pgPaymentId);
          if (!pgResult.success) {
            if (webhookLogId) await tx.update(webhookLogs).set({ status: "failed", errorMessage: "PG Status Check Failed" }).where(eq(webhookLogs.id, webhookLogId));
            return;
          }

          // ─── 5단계: 금액 교차 검증 (Security) ───
          if (pgResult.amount !== undefined && payment.amount) {
            // 100원 오차 허용 (소수점 이슈 등)
            const tolerance = 100;
            const diff = Math.abs(pgResult.amount - payment.amount);

            if (diff > tolerance) {
              const msg = `[CRITICAL] 결제 금액 불일치! DB: ${payment.amount}, PG: ${pgResult.amount}`;
              console.error(msg);

              // 1. 관리자 알림 발송
              await broadcastToAllAdmins("payment", "fraud_suspected", payment.id, {
                reason: "amount_mismatch",
                dbAmount: payment.amount,
                pgAmount: pgResult.amount
              });

              // 2. 상태를 'fraud_suspected'로 변경하여 지급 정지
              await tx.update(payments)
                .set({ status: PAYMENT_STATUS.FRAUD_SUSPECTED })
                .where(eq(payments.id, payment.id));

              if (webhookLogId) await tx.update(webhookLogs).set({ status: "failed", errorMessage: "Fraud Suspected: Amount Mismatch" }).where(eq(webhookLogs.id, webhookLogId));
              return;
            }
          }

          const newStatus = mapPGStatusToDBStatus(pgResult.status);
          const prevStatus = payment.status || 'initiated';

          // ─── 6단계: 상태 전이 유효성 검사 ───
          if (!canTransitionPaymentStatus(prevStatus, newStatus)) {
            const msg = `유효하지 않은 상태 전이 시도: ${prevStatus} -> ${newStatus}`;
            console.warn(`[PG Webhook] ${msg}`);
            if (webhookLogId) await tx.update(webhookLogs).set({ status: "failed", errorMessage: msg }).where(eq(webhookLogs.id, webhookLogId));
            return;
          }

          // ─── 7단계: DB 업데이트 ───
          if (newStatus !== prevStatus) {
            const updateData: Record<string, any> = { status: newStatus };
            if (newStatus === "completed" && !payment.paidAt) {
              updateData.paidAt = new Date();
            }
            if (newStatus === "refunded" && !payment.canceledAt) {
              updateData.canceledAt = new Date();
            }

            await tx.update(payments)
              .set(updateData)
              .where(eq(payments.id, payment.id));

            // 상태 변경 로그
            try {
              await storage.createPaymentStatusEvent({
                paymentId: payment.id,
                previousStatus: prevStatus,
                newStatus,
                changedBy: null,
                reason: `PortOne 웹훅 (${type})`,
              });
            } catch (e) { /* ignore */ }

            console.log(`[PG Webhook] ✅ 결제 #${payment.id} 업데이트: ${prevStatus} -> ${newStatus}`);
          }
        });
      }

      // 성공 처리
      if (webhookLogId) {
        await db.update(webhookLogs).set({ status: "success" }).where(eq(webhookLogs.id, webhookLogId));
      }
      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[PG Webhook] 처리 오류:", err);
      // 로그 상태 실패 업데이트 (이미 잡히지 않은 에러)
      if (webhookLogId) {
        try { await db.update(webhookLogs).set({ status: "failed", errorMessage: err.message }).where(eq(webhookLogs.id, webhookLogId)); } catch { }
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
}
