export const SETTLEMENT_STATUS = {
  PENDING: "pending",
  READY: "ready",
  CONFIRMED: "confirmed",
  PAID: "paid",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
} as const;

export type SettlementStatus = typeof SETTLEMENT_STATUS[keyof typeof SETTLEMENT_STATUS];

export const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  pending: "산출됨",
  ready: "지급가능",
  confirmed: "확정됨",
  paid: "지급완료",
  on_hold: "보류",
  cancelled: "취소됨",
};

export type SettlementRow = {
  id: number;
  status: string | null;
  totalAmount?: number | null;
  commissionAmount?: number | null;
  netAmount?: number | null;
  finalTotal?: number | null;
  driverPayout?: number | null;
  isOnHold?: boolean | null;
};

export function getSettlementActionState(s: SettlementRow) {
  const hasAmounts =
    ((s.totalAmount ?? s.finalTotal ?? 0) > 0) &&
    ((s.netAmount ?? s.driverPayout ?? 0) > 0);

  const status = s.status || "";

  const canConfirm =
    status === SETTLEMENT_STATUS.PENDING && hasAmounts && !s.isOnHold;

  const canMarkReady =
    status === SETTLEMENT_STATUS.CONFIRMED && !s.isOnHold;

  const canPay =
    status === SETTLEMENT_STATUS.READY && hasAmounts && !s.isOnHold;

  const canHold =
    [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.READY].includes(
      status as any
    ) && !s.isOnHold;

  const canReleaseHold =
    status === SETTLEMENT_STATUS.ON_HOLD || s.isOnHold === true;

  return { hasAmounts, canConfirm, canMarkReady, canPay, canHold, canReleaseHold };
}
