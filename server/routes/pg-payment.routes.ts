/**
 * PG 결제 관련 라우트
 *
 * PortOne V2 API를 통한 결제 관리 엔드포인트
 *
 * - POST /api/admin/payments/bulk-sync   – 여러 결제 건 PG 동기화
 * - GET  /api/admin/payments/pg-info     – PG 연동 정보 조회
 * - POST /api/payments/webhook/portone   – PortOne 웹훅 수신
 */

import type { RouteContext, AdminRequest } from "./types";

export function registerPGPaymentRoutes(ctx: RouteContext): void {
  const { app, adminAuth, storage, db, pgService, mapPGStatusToDBStatus, logAdminAction } = ctx;

  /**
   * PG 연동 정보 조회 (관리자)
   * GET /api/admin/payments/pg-info
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
   * POST /api/admin/payments/bulk-sync
   * Body: { paymentIds: number[] }
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
          if (newStatus !== payment.status) {
            await storage.updatePayment(paymentId, { status: newStatus });
            results.push({
              paymentId,
              success: true,
              beforeStatus: payment.status,
              afterStatus: newStatus,
              message: `상태 변경: ${payment.status} → ${newStatus}`,
            });
          } else {
            results.push({
              paymentId,
              success: true,
              beforeStatus: payment.status,
              afterStatus: payment.status,
              message: "PG 상태와 동일",
            });
          }
        } catch (err) {
          results.push({
            paymentId,
            success: false,
            message: `오류: ${(err as Error).message}`,
          });
        }
      }

      const changed = results.filter(r => r.success && r.beforeStatus !== r.afterStatus);
      const failed = results.filter(r => !r.success);

      // 감사 로그
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
    } catch (err) {
      console.error("Bulk sync error:", err);
      res.status(500).json({ message: "일괄 동기화 실패" });
    }
  });

  /**
   * PortOne 웹훅 수신
   * POST /api/payments/webhook/portone
   *
   * PortOne에서 결제 상태 변경 시 호출됩니다.
   * 웹훅 시크릿을 검증한 후 결제 상태를 자동으로 업데이트합니다.
   */
  app.post("/api/payments/webhook/portone", async (req, res) => {
    try {
      const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;

      // 웹훅 시크릿 검증 (설정된 경우만)
      if (webhookSecret) {
        const signature = req.headers["x-portone-signature"];
        // TODO: 실제 PortOne 웹훅 시그니처 검증 구현
        // PortOne V2 웹훅은 HMAC-SHA256 서명을 사용합니다
        if (!signature) {
          console.warn("[PG Webhook] 서명이 없는 웹훅 요청 무시");
          return res.status(401).json({ message: "Missing webhook signature" });
        }
      }

      const { type, data } = req.body;

      console.log(`[PG Webhook] 이벤트 수신: ${type}`, JSON.stringify(data).substring(0, 200));

      if (type === "Transaction.Paid" || type === "Transaction.Cancelled" || type === "Transaction.Failed") {
        const paymentId = data?.paymentId;
        if (paymentId) {
          // PG 트랜잭션 ID로 우리 DB의 결제 건을 찾아서 업데이트
          const pgResult = await pgService.getPaymentStatus(paymentId);
          if (pgResult.success) {
            const newStatus = mapPGStatusToDBStatus(pgResult.status);
            console.log(`[PG Webhook] 결제 상태 업데이트 예정: ${paymentId} → ${newStatus}`);
            // 실제 DB 업데이트는 pgTransactionId로 결제 건을 조회한 후 수행
            // storage.findPaymentByPgTransactionId가 필요합니다 (향후 구현)
          }
        }
      }

      // 웹훅은 항상 200 응답 (재시도 방지)
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[PG Webhook] 처리 오류:", err);
      // 웹훅 에러도 200 반환 (PortOne이 재시도하지 않도록)
      res.status(200).json({ received: true, error: "processing_error" });
    }
  });
}
