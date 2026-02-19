// server/constants/order-status.ts

export const ORDER_STATUS = {
  AWAITING_DEPOSIT: "awaiting_deposit",
  OPEN: "open",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  CLOSING_SUBMITTED: "closing_submitted",
  FINAL_AMOUNT_CONFIRMED: "final_amount_confirmed",
  BALANCE_PAID: "balance_paid",
  SETTLEMENT_PAID: "settlement_paid",
  CLOSED: "closed",
  CANCELLED: "cancelled",
  // 분쟁 관련 상태
  DISPUTE_REVIEWING: "dispute_reviewing",
  DISPUTE_RESOLVED: "dispute_resolved",
  DISPUTE_REJECTED: "dispute_rejected",
  // 정산 완료
  SETTLED: "settled",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const CAN_APPLY_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.OPEN,
]);

export const CAN_SELECT_HELPER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.OPEN,
]);

export const CAN_CHECKIN_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.SCHEDULED,
]);

export const CAN_SUBMIT_CLOSING_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.SCHEDULED,
]);

export const CAN_APPROVE_CLOSING_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.CLOSING_SUBMITTED,
]);

export const CAN_CONFIRM_BALANCE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.FINAL_AMOUNT_CONFIRMED,
]);

export const CAN_REVIEW_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.FINAL_AMOUNT_CONFIRMED,
  ORDER_STATUS.BALANCE_PAID,
  ORDER_STATUS.SETTLEMENT_PAID,
  ORDER_STATUS.CLOSED,
]);

export const CANNOT_EDIT_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.SCHEDULED,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.CLOSING_SUBMITTED,
  ORDER_STATUS.FINAL_AMOUNT_CONFIRMED,
  ORDER_STATUS.BALANCE_PAID,
  ORDER_STATUS.SETTLEMENT_PAID,
  ORDER_STATUS.CLOSED,
]);

export const CANNOT_DELETE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.SCHEDULED,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.CLOSING_SUBMITTED,
  ORDER_STATUS.FINAL_AMOUNT_CONFIRMED,
  ORDER_STATUS.BALANCE_PAID,
  ORDER_STATUS.SETTLEMENT_PAID,
  ORDER_STATUS.CLOSED,
]);

export const COMPLETED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.CLOSING_SUBMITTED,
  ORDER_STATUS.FINAL_AMOUNT_CONFIRMED,
  ORDER_STATUS.BALANCE_PAID,
  ORDER_STATUS.SETTLEMENT_PAID,
  ORDER_STATUS.CLOSED,
]);

export const IN_PROGRESS_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.SCHEDULED,
  ORDER_STATUS.IN_PROGRESS,
]);

export function normalizeOrderStatus(status: string | null | undefined): OrderStatus | string {
  const s = String(status || "").trim();

  switch (s) {
    case "registered":
    case "matching":
      return ORDER_STATUS.OPEN;

    case "working":
      return ORDER_STATUS.IN_PROGRESS;

    case "closing_approved":
      return ORDER_STATUS.FINAL_AMOUNT_CONFIRMED;

    case "completed":
      return ORDER_STATUS.CLOSED;

    case "matched":
    case "assigned":
      return ORDER_STATUS.SCHEDULED;

    case "awaiting_deposit":
    case "open":
    case "scheduled":
    case "in_progress":
    case "closing_submitted":
    case "final_amount_confirmed":
    case "balance_paid":
    case "settlement_paid":
    case "closed":
    case "cancelled":
    case "dispute_reviewing":
    case "dispute_resolved":
    case "dispute_rejected":
    case "settled":
      return s as OrderStatus;

    default:
      console.warn(`[OrderStatus] Unknown status detected: "${s}" - this may cause workflow issues`);
      return s;
  }
}

export function validateAndNormalizeStatus(status: string | null | undefined, context?: string): OrderStatus {
  const normalized = normalizeOrderStatus(status);
  
  if (!isValidOrderStatus(normalized)) {
    const msg = `[OrderStatus] Invalid status "${status}" detected${context ? ` in ${context}` : ''}. Using fallback.`;
    console.error(msg);
    return ORDER_STATUS.OPEN;
  }
  
  return normalized as OrderStatus;
}

export function isOneOfStatus(
  status: string | null | undefined,
  allowed: ReadonlySet<OrderStatus>,
): boolean {
  const normalized = normalizeOrderStatus(status);
  return allowed.has(normalized as OrderStatus);
}

export function isValidOrderStatus(status: string): status is OrderStatus {
  return Object.values(ORDER_STATUS).includes(status as OrderStatus);
}

// 상태 전환 규칙: from -> to[]
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [ORDER_STATUS.AWAITING_DEPOSIT]: [ORDER_STATUS.OPEN, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OPEN]: [ORDER_STATUS.SCHEDULED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SCHEDULED]: [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.OPEN, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.IN_PROGRESS]: [ORDER_STATUS.CLOSING_SUBMITTED, ORDER_STATUS.SCHEDULED],
  [ORDER_STATUS.CLOSING_SUBMITTED]: [ORDER_STATUS.FINAL_AMOUNT_CONFIRMED, ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.DISPUTE_REVIEWING],
  [ORDER_STATUS.FINAL_AMOUNT_CONFIRMED]: [ORDER_STATUS.BALANCE_PAID, ORDER_STATUS.CLOSING_SUBMITTED, ORDER_STATUS.DISPUTE_REVIEWING],
  [ORDER_STATUS.BALANCE_PAID]: [ORDER_STATUS.SETTLEMENT_PAID, ORDER_STATUS.FINAL_AMOUNT_CONFIRMED, ORDER_STATUS.DISPUTE_REVIEWING],
  [ORDER_STATUS.SETTLEMENT_PAID]: [ORDER_STATUS.CLOSED, ORDER_STATUS.SETTLED],
  [ORDER_STATUS.CLOSED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  // 분쟁 관련 상태 전이
  [ORDER_STATUS.DISPUTE_REVIEWING]: [ORDER_STATUS.DISPUTE_RESOLVED, ORDER_STATUS.DISPUTE_REJECTED],
  [ORDER_STATUS.DISPUTE_RESOLVED]: [ORDER_STATUS.FINAL_AMOUNT_CONFIRMED, ORDER_STATUS.BALANCE_PAID, ORDER_STATUS.SETTLEMENT_PAID, ORDER_STATUS.CLOSED],
  [ORDER_STATUS.DISPUTE_REJECTED]: [ORDER_STATUS.FINAL_AMOUNT_CONFIRMED, ORDER_STATUS.BALANCE_PAID, ORDER_STATUS.SETTLEMENT_PAID, ORDER_STATUS.CLOSED],
  // 정산 완료
  [ORDER_STATUS.SETTLED]: [ORDER_STATUS.CLOSED],
};

export function canTransitionTo(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

export function validateStatusTransition(
  from: string | null | undefined,
  to: string | null | undefined,
  context?: string
): { valid: boolean; error?: string; fromNormalized: OrderStatus; toNormalized: OrderStatus } {
  const fromNormalized = validateAndNormalizeStatus(from, context);
  const toNormalized = validateAndNormalizeStatus(to, context);
  
  if (fromNormalized === toNormalized) {
    return { valid: true, fromNormalized, toNormalized };
  }
  
  if (!canTransitionTo(fromNormalized, toNormalized)) {
    const error = `Invalid status transition: ${fromNormalized} -> ${toNormalized}${context ? ` (${context})` : ''}`;
    console.warn(`[OrderStatus] ${error}`);
    return { valid: false, error, fromNormalized, toNormalized };
  }
  
  return { valid: true, fromNormalized, toNormalized };
}

export function getNextValidStatuses(current: string | null | undefined): OrderStatus[] {
  const normalized = normalizeOrderStatus(current);
  if (!isValidOrderStatus(normalized)) return [];
  return VALID_TRANSITIONS[normalized] || [];
}

export function getStatusRecoveryOptions(current: string | null | undefined): OrderStatus[] {
  const normalized = normalizeOrderStatus(current);
  if (!isValidOrderStatus(normalized)) return [ORDER_STATUS.OPEN];
  
  // 각 상태에서 복구 가능한 이전 상태
  const recoveryMap: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [ORDER_STATUS.CLOSING_SUBMITTED]: [ORDER_STATUS.IN_PROGRESS],
    [ORDER_STATUS.FINAL_AMOUNT_CONFIRMED]: [ORDER_STATUS.CLOSING_SUBMITTED],
    [ORDER_STATUS.BALANCE_PAID]: [ORDER_STATUS.FINAL_AMOUNT_CONFIRMED],
    [ORDER_STATUS.IN_PROGRESS]: [ORDER_STATUS.SCHEDULED],
    [ORDER_STATUS.SCHEDULED]: [ORDER_STATUS.OPEN],
  };
  
  return recoveryMap[normalized as OrderStatus] || [];
}
