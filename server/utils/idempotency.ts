import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { idempotencyKeys } from "@shared/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import crypto from "crypto";

const IDEMPOTENCY_TTL_HOURS = 24;

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function hashPayload(payload: any): string {
  const json = JSON.stringify(payload || {});
  return crypto.createHash("sha256").update(json).digest("hex");
}

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  isConflict?: boolean;
  cachedResponse?: { status: number; body: any };
}

export async function checkIdempotency(
  userId: string,
  endpoint: string,
  idempotencyKey: string,
  requestPayload?: any
): Promise<IdempotencyCheckResult> {
  try {
    const existing = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.key, idempotencyKey),
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.endpoint, endpoint),
          gt(idempotencyKeys.expiresAt, new Date())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      
      if (requestPayload && record.requestHash) {
        const currentHash = hashPayload(requestPayload);
        if (currentHash !== record.requestHash) {
          console.log(`[Idempotency] Conflict detected: same key "${idempotencyKey}" with different payload`);
          return { isDuplicate: false, isConflict: true };
        }
      }
      
      return {
        isDuplicate: true,
        cachedResponse: {
          status: record.responseStatus,
          body: JSON.parse(record.responseBody),
        },
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error("[Idempotency] Check failed:", error);
    return { isDuplicate: false };
  }
}

export async function storeIdempotencyResponse(
  userId: string,
  endpoint: string,
  idempotencyKey: string,
  responseStatus: number,
  responseBody: any,
  requestPayload?: any
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

    await db.insert(idempotencyKeys).values({
      key: idempotencyKey,
      userId,
      endpoint,
      requestHash: requestPayload ? hashPayload(requestPayload) : null,
      responseStatus,
      responseBody: JSON.stringify(responseBody),
      status: "COMPLETED",
      expiresAt,
    });
  } catch (error) {
    console.error("[Idempotency] Store failed:", error);
  }
}

export async function cleanupExpiredKeys(): Promise<number> {
  try {
    const result = await db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.expiresAt, new Date()))
      .returning({ id: idempotencyKeys.id });
    return result.length;
  } catch (error) {
    console.error("[Idempotency] Cleanup failed:", error);
    return 0;
  }
}

setInterval(async () => {
  await cleanupExpiredKeys();
}, 1000 * 60 * 60);

export function getIdempotencyKeyFromRequest(req: Request): string | null {
  const key = req.headers["x-idempotency-key"];
  if (typeof key === "string" && key.length > 0) {
    return key;
  }
  if (req.body && typeof req.body.idempotencyKey === "string") {
    return req.body.idempotencyKey;
  }
  return null;
}

export interface IdempotentResponse extends Response {
  idempotencyKey?: string;
  idempotencyUserId?: string;
  idempotencyEndpoint?: string;
}

export async function handleIdempotentRequest(
  req: Request,
  res: Response,
  userId: string,
  endpoint: string,
  handler: () => Promise<{ status: number; body: any }>
): Promise<void> {
  const idempotencyKey = getIdempotencyKeyFromRequest(req);
  
  if (!idempotencyKey) {
    const result = await handler();
    res.status(result.status).json(result.body);
    return;
  }

  const { isDuplicate, isConflict, cachedResponse } = await checkIdempotency(
    userId,
    endpoint,
    idempotencyKey,
    req.body
  );

  if (isConflict) {
    res.status(409).json({
      error: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "동일 Idempotency-Key에 다른 요청이 감지되었습니다.",
      },
    });
    return;
  }

  if (isDuplicate && cachedResponse) {
    console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
    res.status(cachedResponse.status).json(cachedResponse.body);
    return;
  }

  const result = await handler();
  
  await storeIdempotencyResponse(
    userId,
    endpoint,
    idempotencyKey,
    result.status,
    result.body,
    req.body
  );

  res.status(result.status).json(result.body);
}
