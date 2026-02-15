/**
 * Integration Events Retry Worker (T-22)
 * 
 * 실패한 외부 연동 이벤트를 자동으로 재시도합니다.
 * - 1~5분마다 실행
 * - 최대 3회 재시도
 * - 실패 지속 시 관리자 알림 생성
 */

import { db } from "../db";
import { integrationEvents, users } from "@shared/schema";
import { eq, and, or, lte, lt, inArray } from "drizzle-orm";
import { storage } from "../storage";

const MAX_RETRY_COUNT = 3;
const RETRY_INTERVAL_MS = 3 * 60 * 1000; // 3분마다 실행

export interface RetryHandler {
  provider: string;
  execute: (payload: any) => Promise<{ success: boolean; response?: any; error?: string }>;
}

const retryHandlers: Map<string, RetryHandler> = new Map();

export function registerRetryHandler(handler: RetryHandler): void {
  retryHandlers.set(handler.provider, handler);
}

async function processRetryableEvents(): Promise<void> {
  try {
    const now = new Date();
    
    const events = await db
      .select()
      .from(integrationEvents)
      .where(
        and(
          or(
            eq(integrationEvents.status, "FAILED"),
            eq(integrationEvents.status, "RETRYING")
          ),
          or(
            lte(integrationEvents.nextRetryAt, now),
            eq(integrationEvents.nextRetryAt as any, null)
          ),
          lt(integrationEvents.retryCount as any, MAX_RETRY_COUNT)
        )
      )
      .limit(10);

    if (events.length === 0) {
      return;
    }

    console.log(`[RetryWorker] Found ${events.length} events to retry`);

    for (const event of events) {
      const handler = retryHandlers.get(event.provider);
      
      if (!handler) {
        console.log(`[RetryWorker] No handler registered for provider: ${event.provider}`);
        continue;
      }

      try {
        const payload = JSON.parse(event.payload);
        const result = await handler.execute(payload);

        if (result.success) {
          await db
            .update(integrationEvents)
            .set({
              status: "SUCCESS",
              response: JSON.stringify(result.response || {}),
              updatedAt: new Date(),
            })
            .where(eq(integrationEvents.id, event.id));
          
          console.log(`[RetryWorker] Event ${event.id} succeeded on retry`);
        } else {
          const newRetryCount = (event.retryCount || 0) + 1;
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, newRetryCount)); // Exponential backoff
          
          if (newRetryCount >= MAX_RETRY_COUNT) {
            await db
              .update(integrationEvents)
              .set({
                status: "FAILED",
                retryCount: newRetryCount,
                lastError: result.error || "Max retries exceeded",
                nextRetryAt: null,
                updatedAt: new Date(),
              })
              .where(eq(integrationEvents.id, event.id));
            
            await notifyAdminOfFailure(event);
            console.log(`[RetryWorker] Event ${event.id} failed after ${newRetryCount} retries`);
          } else {
            await db
              .update(integrationEvents)
              .set({
                status: "RETRYING",
                retryCount: newRetryCount,
                lastError: result.error,
                nextRetryAt: nextRetry,
                updatedAt: new Date(),
              })
              .where(eq(integrationEvents.id, event.id));
            
            console.log(`[RetryWorker] Event ${event.id} scheduled for retry at ${nextRetry.toISOString()}`);
          }
        }
      } catch (error) {
        console.error(`[RetryWorker] Error processing event ${event.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[RetryWorker] Worker failed:", error);
  }
}

async function notifyAdminOfFailure(event: typeof integrationEvents.$inferSelect): Promise<void> {
  try {
    const admins = await db
      .select()
      .from(users)
      .where(inArray(users.role, ["admin", "superadmin"]))
      .limit(10);
    
    for (const admin of admins) {
      await storage.createNotification({
        userId: admin.id,
        type: "system" as any,
        title: "연동 이벤트 실패",
        message: `${event.provider} ${event.action} 이벤트가 ${MAX_RETRY_COUNT}회 재시도 후 실패했습니다. 수동 확인이 필요합니다.`,
        relatedId: event.id,
      });
    }
    
    console.log(`[RetryWorker] Admin notification created for failed event ${event.id}`);
  } catch (error) {
    console.error("[RetryWorker] Failed to notify admins:", error);
  }
}

let retryIntervalId: ReturnType<typeof setInterval> | null = null;

export function startRetryWorker(): void {
  if (retryIntervalId) {
    return;
  }
  
  console.log("[RetryWorker] Integration events retry worker started");
  
  retryIntervalId = setInterval(processRetryableEvents, RETRY_INTERVAL_MS);
  
  setTimeout(processRetryableEvents, 30000);
}

export function stopRetryWorker(): void {
  if (retryIntervalId) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
    console.log("[RetryWorker] Integration events retry worker stopped");
  }
}
