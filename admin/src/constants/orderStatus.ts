export const ORDER_STATUS = {
  AWAITING_DEPOSIT: "awaiting_deposit",
  OPEN: "open",
  MATCHING: "matching",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  CLOSING_SUBMITTED: "closing_submitted",
  FINAL_AMOUNT_CONFIRMED: "final_amount_confirmed",
  BALANCE_PAID: "balance_paid",
  SETTLEMENT_PAID: "settlement_paid",
  CLOSED: "closed",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_deposit: "계약금 대기",
  open: "공고중",
  matching: "매칭중",
  scheduled: "예정",
  in_progress: "업무중",
  closing_submitted: "마감제출",
  final_amount_confirmed: "최종확정",
  balance_paid: "잔금완료",
  settlement_paid: "정산완료",
  closed: "종료",
  cancelled: "취소",
};

export function normalizeOrderStatus(status?: string | null): OrderStatus | string {
  const s = String(status || "").trim();

  switch (s) {
    case "registered":
    case "matching":
      return ORDER_STATUS.OPEN;
    case "working":
    case "checked_in":
      return ORDER_STATUS.IN_PROGRESS;
    case "closing_approved":
      return ORDER_STATUS.FINAL_AMOUNT_CONFIRMED;
    case "completed":
      return ORDER_STATUS.CLOSED;
    case "matched":
    case "assigned":
      return ORDER_STATUS.SCHEDULED;
    default:
      return s;
  }
}

export function isOrderStatus(status: string | null | undefined, allowed: OrderStatus[]): boolean {
  const normalized = normalizeOrderStatus(status);
  return allowed.includes(normalized as OrderStatus);
}

export type OrderRow = {
  id: number;
  status: string | null;
  matchedHelperId?: string | null;
  paymentStatus?: string | null;
  hasClosingReport?: boolean;
  finalTotalAmount?: number | null;
};

export function getOrderActionState(order: OrderRow) {
  const status = normalizeOrderStatus(order.status);

  const canViewCandidates = status === ORDER_STATUS.OPEN;
  const canSelectHelper = status === ORDER_STATUS.OPEN;
  const canCheckIn = status === ORDER_STATUS.SCHEDULED;

  const canViewClosingReport =
    status === ORDER_STATUS.CLOSING_SUBMITTED ||
    status === ORDER_STATUS.FINAL_AMOUNT_CONFIRMED ||
    status === ORDER_STATUS.BALANCE_PAID ||
    status === ORDER_STATUS.SETTLEMENT_PAID ||
    status === ORDER_STATUS.CLOSED;

  const canApproveClosing = status === ORDER_STATUS.CLOSING_SUBMITTED;
  const canConfirmBalance = status === ORDER_STATUS.FINAL_AMOUNT_CONFIRMED;
  const canExecuteSettlement = status === ORDER_STATUS.BALANCE_PAID;

  return {
    canViewCandidates,
    canSelectHelper,
    canCheckIn,
    canViewClosingReport,
    canApproveClosing,
    canConfirmBalance,
    canExecuteSettlement,
  };
}
