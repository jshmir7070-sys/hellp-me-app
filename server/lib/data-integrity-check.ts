/**
 * 서버 시작 시 데이터 무결성 체크
 *
 * closing_reports와 order status 간 불일치를 감지하여 로그로 경고합니다.
 * db:push 등으로 closing_reports가 truncate된 경우를 감지합니다.
 */

import { db } from "../db";
import { orders, closingReports, contracts } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export async function checkDataIntegrity(): Promise<void> {
  console.log("[Integrity] Running data integrity check...");

  try {
    // 1. 마감 이후 상태인데 closing report가 없는 오더 감지
    const postClosingStatuses = [
      'closing_submitted',
      'final_amount_confirmed',
      'balance_paid',
      'settlement_paid',
      'closed',
    ];

    const allOrders = await db.select({
      id: orders.id,
      status: orders.status,
      matchedHelperId: orders.matchedHelperId,
    }).from(orders);

    const postClosingOrders = allOrders.filter(
      o => postClosingStatuses.includes(o.status || '')
    );

    if (postClosingOrders.length === 0) {
      console.log("[Integrity] No post-closing orders found. Check complete.");
      return;
    }

    const postClosingOrderIds = postClosingOrders.map(o => o.id);

    const existingReports = await db.select({
      orderId: closingReports.orderId,
    }).from(closingReports)
      .where(inArray(closingReports.orderId, postClosingOrderIds));

    const reportOrderIds = new Set(existingReports.map(r => r.orderId));

    const orphanedOrders = postClosingOrders.filter(
      o => !reportOrderIds.has(o.id)
    );

    if (orphanedOrders.length > 0) {
      console.warn(`[Integrity] ⚠️ WARNING: ${orphanedOrders.length} orders in post-closing status WITHOUT closing reports!`);
      console.warn("[Integrity] This may indicate db:push truncated closing_reports table.");
      console.warn("[Integrity] Auto-resetting orphaned orders to 'in_progress'...");

      const orphanedIds = orphanedOrders.map(o => o.id);
      await db.update(orders)
        .set({ status: "in_progress" })
        .where(inArray(orders.id, orphanedIds));

      console.warn(`[Integrity] ✅ Reset ${orphanedOrders.length} orphaned orders to 'in_progress'.`);
      console.warn("[Integrity] Helpers can now re-submit closing reports for these orders.");
      for (const o of orphanedOrders) {
        console.warn(`  - Order #${o.id}: '${o.status}' → 'in_progress'`);
      }
    } else {
      console.log(`[Integrity] ✅ All ${postClosingOrders.length} post-closing orders have closing reports.`);
    }

    // 2. closing report이 있는데 SSOT 금액 필드가 비어있는 레거시 데이터 감지
    const allReports = await db.select({
      id: closingReports.id,
      orderId: closingReports.orderId,
      totalAmount: closingReports.totalAmount,
      supplyAmount: closingReports.supplyAmount,
    }).from(closingReports);

    const legacyReports = allReports.filter(
      r => r.totalAmount == null || r.supplyAmount == null
    );

    if (legacyReports.length > 0) {
      console.warn(`[Integrity] ⚠️ ${legacyReports.length} closing reports missing SSOT amount fields (legacy data).`);
      console.warn("[Integrity] These will be recalculated at runtime using parseClosingReport + calculateSettlement.");
    }

    console.log("[Integrity] Data integrity check complete.");
  } catch (err) {
    console.error("[Integrity] Data integrity check failed:", err);
    // Don't block server startup on integrity check failure
  }
}
