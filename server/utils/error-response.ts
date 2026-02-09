/**
 * 서버 에러 응답 표준화 유틸리티
 * 
 * 모든 4xx/5xx 응답은 동일한 포맷:
 * {
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "사용자 메시지",
 *     "details": [{ "field": "xxx", "reason": "YYY" }]
 *   }
 * }
 */

import { Response } from "express";
import crypto from "crypto";

export interface ErrorDetail {
  field: string;
  reason: string;
}

export interface StandardError {
  code: string;
  message: string;
  details?: ErrorDetail[];
  traceId?: string;
}

export interface StandardErrorResponse {
  error: StandardError;
}

/**
 * 에러 코드 정의
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE: "UNPROCESSABLE",
  RATE_LIMITED: "RATE_LIMITED",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  DUPLICATE_REQUEST: "DUPLICATE_REQUEST",
  CONCURRENCY_CONFLICT: "CONCURRENCY_CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  FILE_UPLOAD_ERROR: "FILE_UPLOAD_ERROR",
  PAYMENT_ERROR: "PAYMENT_ERROR",
  SETTLEMENT_ERROR: "SETTLEMENT_ERROR",
  DELIVERY_HISTORY_REQUIRED: "DELIVERY_HISTORY_REQUIRED",
  HELPER_NOT_VERIFIED: "HELPER_NOT_VERIFIED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  MAX_APPLICANTS_REACHED: "MAX_APPLICANTS_REACHED",
  ALREADY_APPLIED: "ALREADY_APPLIED",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * traceId 생성
 */
function generateTraceId(): string {
  return crypto.randomUUID();
}

/**
 * 표준 에러 응답 전송
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ErrorDetail[]
): void {
  const traceId = generateTraceId();
  
  const errorBody: StandardError = {
    code,
    message,
  };
  
  if (details && details.length > 0) {
    errorBody.details = details;
  }
  
  if (process.env.NODE_ENV !== "production") {
    errorBody.traceId = traceId;
    console.error(`[Error] ${traceId}: ${code} - ${message}`, details || "");
  }
  
  res.status(statusCode).json({ error: errorBody });
}

/**
 * 400 Bad Request
 */
export function badRequest(res: Response, message: string = "잘못된 요청입니다", details?: ErrorDetail[]): void {
  sendError(res, 400, ERROR_CODES.BAD_REQUEST, message, details);
}

/**
 * 400 Validation Error
 */
export function validationError(res: Response, message: string = "입력값 검증 실패", details?: ErrorDetail[]): void {
  sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, message, details);
}

/**
 * 401 Unauthorized
 */
export function unauthorized(res: Response, message: string = "인증이 필요합니다"): void {
  sendError(res, 401, ERROR_CODES.UNAUTHORIZED, message);
}

/**
 * 403 Forbidden
 */
export function forbidden(res: Response, message: string = "권한이 없습니다"): void {
  sendError(res, 403, ERROR_CODES.FORBIDDEN, message);
}

/**
 * 404 Not Found
 */
export function notFound(res: Response, message: string = "리소스를 찾을 수 없습니다"): void {
  sendError(res, 404, ERROR_CODES.NOT_FOUND, message);
}

/**
 * 409 Conflict
 */
export function conflict(res: Response, message: string = "충돌이 발생했습니다", details?: ErrorDetail[]): void {
  sendError(res, 409, ERROR_CODES.CONFLICT, message, details);
}

/**
 * 409 Concurrency Conflict (낙관적 락 충돌)
 */
export function concurrencyConflict(res: Response, message: string = "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."): void {
  sendError(res, 409, ERROR_CODES.CONCURRENCY_CONFLICT, message);
}

/**
 * 409 Idempotency Conflict
 */
export function idempotencyConflict(res: Response): void {
  sendError(res, 409, ERROR_CODES.IDEMPOTENCY_CONFLICT, "동일 Idempotency-Key에 다른 요청이 감지되었습니다.");
}

/**
 * 422 Unprocessable Entity
 */
export function unprocessable(res: Response, message: string, details?: ErrorDetail[]): void {
  sendError(res, 422, ERROR_CODES.UNPROCESSABLE, message, details);
}

/**
 * 429 Rate Limited
 */
export function rateLimited(res: Response, retryAfterSeconds: number): void {
  res.setHeader("Retry-After", retryAfterSeconds.toString());
  sendError(res, 429, ERROR_CODES.RATE_LIMITED, `요청이 너무 많습니다. ${retryAfterSeconds}초 후 다시 시도해주세요.`);
}

/**
 * 500 Internal Server Error
 */
export function internalError(res: Response, message: string = "서버 오류가 발생했습니다", error?: Error): void {
  sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, message);
  if (error && process.env.NODE_ENV !== "production") {
    console.error("[InternalError Stack]", error.stack);
  }
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(res: Response, message: string = "서비스를 일시적으로 사용할 수 없습니다"): void {
  sendError(res, 503, ERROR_CODES.SERVICE_UNAVAILABLE, message);
}

/**
 * 집배송 이력 필수 에러
 */
export function deliveryHistoryRequired(res: Response): void {
  sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, "집배송 이력 화면 캡쳐 또는 사진이 반드시 필요합니다. 미첨부 시 마감 제출이 불가합니다.", [
    { field: "attachments", reason: "DELIVERY_HISTORY_MIN_1" },
  ]);
}

/**
 * Express 에러 핸들러 미들웨어
 */
export function errorHandler(err: Error, req: any, res: Response, next: any): void {
  console.error("[ErrorHandler]", err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  internalError(res, "서버 오류가 발생했습니다", err);
}
