import { Request } from "express";
import { storage } from "../storage";
import { getClientInfo, extractDeviceType, extractOsInfo, extractBrowserInfo } from "./client-info";

export interface AdminActionParams {
  req: Request;
  action: string;
  targetType: string;
  targetId: string | number;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export interface EnrichedClientInfo {
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  os: string;
  browser: string;
  timestamp: string;
}

export function getEnrichedClientInfo(req: Request): EnrichedClientInfo {
  const clientInfo = getClientInfo(req);
  return {
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    deviceType: extractDeviceType(clientInfo.userAgent),
    os: extractOsInfo(clientInfo.userAgent),
    browser: extractBrowserInfo(clientInfo.userAgent),
    timestamp: clientInfo.timestamp.toISOString(),
  };
}

export async function logAdminAction(params: AdminActionParams): Promise<void> {
  const { req, action, targetType, targetId, oldValue, newValue, reason } = params;
  const adminUser = (req as any).user;
  const enrichedClient = getEnrichedClientInfo(req);
  
  const enrichedNewValue = newValue ? {
    ...((typeof newValue === 'object' && newValue !== null) ? newValue : { value: newValue }),
    _clientInfo: enrichedClient,
    ...(reason ? { _reason: reason } : {}),
  } : (reason ? { _reason: reason, _clientInfo: enrichedClient } : null);
  
  try {
    await storage.createAuditLog({
      userId: adminUser?.id || null,
      action,
      targetType,
      targetId: String(targetId),
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: enrichedNewValue ? JSON.stringify(enrichedNewValue) : null,
      ipAddress: enrichedClient.ipAddress,
      userAgent: enrichedClient.userAgent,
    });
  } catch (error) {
    console.error("[AuditLog] Failed to create audit log:", error);
  }
}

export const SETTLEMENT_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PAYABLE: "payable",
  PAID: "paid",
  DISPUTED: "disputed",
  ADJUSTED: "adjusted",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
} as const;

export type SettlementStatus = typeof SETTLEMENT_STATUS[keyof typeof SETTLEMENT_STATUS];

const VALID_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  [SETTLEMENT_STATUS.PENDING]: [SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.DISPUTED, SETTLEMENT_STATUS.CANCELLED],
  [SETTLEMENT_STATUS.CONFIRMED]: [SETTLEMENT_STATUS.PAYABLE, SETTLEMENT_STATUS.DISPUTED, SETTLEMENT_STATUS.ON_HOLD],
  [SETTLEMENT_STATUS.PAYABLE]: [SETTLEMENT_STATUS.PAID, SETTLEMENT_STATUS.ON_HOLD],
  [SETTLEMENT_STATUS.PAID]: [],
  [SETTLEMENT_STATUS.DISPUTED]: [SETTLEMENT_STATUS.ADJUSTED, SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.CANCELLED],
  [SETTLEMENT_STATUS.ADJUSTED]: [SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.CANCELLED],
  [SETTLEMENT_STATUS.ON_HOLD]: [SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.PAYABLE, SETTLEMENT_STATUS.DISPUTED, SETTLEMENT_STATUS.CANCELLED],
  [SETTLEMENT_STATUS.CANCELLED]: [],
};

export function canTransitionSettlementStatus(
  currentStatus: string,
  targetStatus: string
): boolean {
  const current = currentStatus as SettlementStatus;
  const target = targetStatus as SettlementStatus;
  
  const validTargets = VALID_TRANSITIONS[current];
  if (!validTargets) return false;
  
  return validTargets.includes(target);
}

export function validateSettlementStatus(status: string): status is SettlementStatus {
  return Object.values(SETTLEMENT_STATUS).includes(status as SettlementStatus);
}

// 6-stage ORDER_STATUS (새 운영 체계)
// APPROVAL_PENDING (승인중) - 관리자 검수/승인 대기
// REGISTERING (등록중) - 오더 등록 완료, 후보 모집 중
// MATCHING (매칭중) - 후보 1~3명 접수, 선택 대기
// SCHEDULED (예정) - 기사 선택 완료, 작업 예정
// WORKING (업무중) - 진행 중
// CLOSED (마감) - 종료/정산 진행
export const ORDER_STATUS = {
  // 신규 6단계 상태
  APPROVAL_PENDING: "approval_pending",
  REGISTERING: "registering",
  MATCHING: "matching",
  SCHEDULED: "scheduled",
  WORKING: "working",
  CLOSED: "closed",
  // 기존 상태 (하위 호환성)
  DRAFT: "draft",
  AWAITING_DEPOSIT: "awaiting_deposit",
  REGISTERED: "registered",
  MATCHED: "matched",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// 레거시 상태를 신규 상태로 매핑
export const LEGACY_STATUS_MAP: Record<string, string> = {
  draft: "registering",
  awaiting_deposit: "approval_pending",
  registered: "registering",
  matched: "scheduled",
  in_progress: "working",
  completed: "closed",
};

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // 신규 6단계 전이 규칙
  [ORDER_STATUS.APPROVAL_PENDING]: [ORDER_STATUS.REGISTERING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.REGISTERING]: [ORDER_STATUS.MATCHING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.MATCHING]: [ORDER_STATUS.SCHEDULED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SCHEDULED]: [ORDER_STATUS.WORKING, ORDER_STATUS.MATCHING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.WORKING]: [ORDER_STATUS.CLOSED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CLOSED]: [],
  // 레거시 상태 전이 규칙 (하위 호환성)
  [ORDER_STATUS.DRAFT]: [ORDER_STATUS.AWAITING_DEPOSIT, ORDER_STATUS.REGISTERING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.AWAITING_DEPOSIT]: [ORDER_STATUS.REGISTERING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.REGISTERED]: [ORDER_STATUS.MATCHING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.MATCHED]: [ORDER_STATUS.WORKING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.IN_PROGRESS]: [ORDER_STATUS.CLOSED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]: [ORDER_STATUS.CLOSED],
  [ORDER_STATUS.CANCELLED]: [],
};

export function canTransitionOrderStatus(
  currentStatus: string,
  targetStatus: string
): boolean {
  const current = currentStatus as OrderStatus;
  const target = targetStatus as OrderStatus;
  
  const validTargets = VALID_ORDER_TRANSITIONS[current];
  if (!validTargets) return false;
  
  return validTargets.includes(target);
}

export function validateOrderStatus(status: string): status is OrderStatus {
  return Object.values(ORDER_STATUS).includes(status as OrderStatus);
}
