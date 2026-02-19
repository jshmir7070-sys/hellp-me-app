import { BrandColors } from "@/constants/theme";

export type OrderStatus = 
  | "PENDING_APPROVAL"
  | "AWAITING_DEPOSIT"
  | "OPEN" 
  | "ASSIGNED" 
  | "IN_PROGRESS" 
  | "CLOSING_SUBMITTED" 
  | "FINAL_AMOUNT_CONFIRMED" 
  | "BALANCE_PAID" 
  | "SETTLEMENT_PAID"
  | "CANCELLED";

export type ClosingReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PaymentStatusType = "PENDING" | "PAID" | "N/A";

export type ViewerRole = "requester" | "helper" | "admin";

export type SettlementStatus = "PENDING" | "CONFIRMED" | "PAID" | "HOLD";

export interface StatusLabel {
  text: string;
  color: string;
  bgColor: string;
}

export interface ActionButton {
  label: string;
  action: string;
  variant: "primary" | "secondary" | "destructive" | "outline";
  disabled?: boolean;
}

export function getRequesterStatusLabel(
  orderStatus: OrderStatus,
  closingReviewStatus?: ClosingReviewStatus,
  balancePaymentStatus?: PaymentStatusType,
  applicantCount?: number
): StatusLabel {
  switch (orderStatus) {
    case "PENDING_APPROVAL":
    case "AWAITING_DEPOSIT":
      return { text: "입금대기(승인중)", color: BrandColors.warning, bgColor: BrandColors.warningLight };
    case "OPEN":
      if (applicantCount !== undefined && applicantCount >= 3) {
        return { text: "3명 모집완료", color: BrandColors.success, bgColor: BrandColors.successLight };
      }
      if (applicantCount !== undefined && applicantCount > 0) {
        return { text: `매칭중 (${applicantCount}명)`, color: BrandColors.info, bgColor: BrandColors.infoLight };
      }
      return { text: "등록중", color: BrandColors.requester, bgColor: BrandColors.requesterLight };
    case "ASSIGNED":
      return { text: "예정", color: BrandColors.info, bgColor: BrandColors.infoLight };
    case "IN_PROGRESS":
      return { text: "업무중", color: BrandColors.helper, bgColor: BrandColors.helperLight };
    case "CLOSING_SUBMITTED":
      if (closingReviewStatus === "APPROVED") {
        return { text: "마감 승인", color: BrandColors.success, bgColor: BrandColors.successLight };
      }
      if (closingReviewStatus === "REJECTED") {
        return { text: "마감 반려", color: BrandColors.error, bgColor: BrandColors.errorLight };
      }
      return { text: "마감 검수중", color: BrandColors.warning, bgColor: BrandColors.warningLight };
    case "FINAL_AMOUNT_CONFIRMED":
      if (balancePaymentStatus === "PENDING") {
        return { text: "잔금 결제대기", color: BrandColors.requester, bgColor: BrandColors.requesterLight };
      }
      return { text: "최종금액 확정", color: BrandColors.success, bgColor: BrandColors.successLight };
    case "BALANCE_PAID":
      return { text: "마감", color: BrandColors.success, bgColor: BrandColors.successLight };
    case "SETTLEMENT_PAID":
      return { text: "완료", color: BrandColors.success, bgColor: BrandColors.successLight };
    case "CANCELLED":
      return { text: "취소", color: BrandColors.error, bgColor: BrandColors.errorLight };
    default:
      return { text: orderStatus, color: BrandColors.neutral, bgColor: BrandColors.neutralLight };
  }
}

export function getHelperStatusLabel(
  orderStatus: OrderStatus,
  closingReviewStatus?: ClosingReviewStatus,
  balancePaymentStatus?: PaymentStatusType,
  settlementStatus?: SettlementStatus,
  hasApplied?: boolean,
  applicantCount?: number
): StatusLabel {
  switch (orderStatus) {
    case "PENDING_APPROVAL":
    case "AWAITING_DEPOSIT":
      return { text: "승인대기", color: BrandColors.warning, bgColor: BrandColors.warningLight };
    case "OPEN":
      if (hasApplied) {
        return { text: "매칭중(지원중)", color: BrandColors.info, bgColor: BrandColors.infoLight };
      }
      if (applicantCount !== undefined && applicantCount >= 3) {
        return { text: "모집마감", color: BrandColors.neutral, bgColor: BrandColors.neutralLight };
      }
      if (applicantCount !== undefined && applicantCount > 0) {
        return { text: "매칭중", color: BrandColors.info, bgColor: BrandColors.infoLight };
      }
      return { text: "등록중", color: BrandColors.requester, bgColor: BrandColors.requesterLight };
    case "ASSIGNED":
      return { text: "예정", color: BrandColors.info, bgColor: BrandColors.infoLight };
    case "IN_PROGRESS":
      return { text: "업무중", color: BrandColors.helper, bgColor: BrandColors.helperLight };
    case "CLOSING_SUBMITTED":
      if (closingReviewStatus === "APPROVED") {
        return { text: "마감 승인", color: BrandColors.success, bgColor: BrandColors.successLight };
      }
      if (closingReviewStatus === "REJECTED") {
        return { text: "마감 반려", color: BrandColors.error, bgColor: BrandColors.errorLight };
      }
      return { text: "마감 제출완료", color: BrandColors.warning, bgColor: BrandColors.warningLight };
    case "FINAL_AMOUNT_CONFIRMED":
      if (balancePaymentStatus === "PENDING") {
        return { text: "잔금 대기", color: BrandColors.warning, bgColor: BrandColors.warningLight };
      }
      return { text: "최종금액 확정", color: BrandColors.success, bgColor: BrandColors.successLight };
    case "BALANCE_PAID":
      if (settlementStatus === "PAID") {
        return { text: "정산완료", color: BrandColors.success, bgColor: BrandColors.successLight };
      }
      if (settlementStatus === "CONFIRMED" || settlementStatus === "PENDING") {
        return { text: "정산대기", color: BrandColors.info, bgColor: BrandColors.infoLight };
      }
      return { text: "마감", color: BrandColors.success, bgColor: BrandColors.successLight };
    case "SETTLEMENT_PAID":
      return { text: "정산완료", color: BrandColors.success, bgColor: BrandColors.successLight };
    case "CANCELLED":
      return { text: "취소", color: BrandColors.error, bgColor: BrandColors.errorLight };
    default:
      return { text: orderStatus, color: BrandColors.neutral, bgColor: BrandColors.neutralLight };
  }
}

export function getStatusLabel(
  viewerRole: ViewerRole,
  orderStatus: OrderStatus,
  closingReviewStatus?: ClosingReviewStatus,
  balancePaymentStatus?: PaymentStatusType,
  settlementStatus?: SettlementStatus,
  applicantCount?: number,
  hasApplied?: boolean
): StatusLabel {
  if (viewerRole === "requester") {
    return getRequesterStatusLabel(orderStatus, closingReviewStatus, balancePaymentStatus, applicantCount);
  }
  return getHelperStatusLabel(orderStatus, closingReviewStatus, balancePaymentStatus, settlementStatus, hasApplied, applicantCount);
}

// ─── 요청자 오더 카드 버튼 ───
export function getRequesterButtons(
  orderStatus: OrderStatus,
  closingReviewStatus?: ClosingReviewStatus,
  downPaymentStatus?: PaymentStatusType,
  balancePaymentStatus?: PaymentStatusType,
  hasReview?: boolean
): ActionButton[] {
  const buttons: ActionButton[] = [];

  switch (orderStatus) {
    case "PENDING_APPROVAL":
    case "AWAITING_DEPOSIT":
      if (downPaymentStatus !== "PAID") {
        buttons.push({ label: "선금 결제", action: "PAY_DOWN", variant: "primary" });
      }
      buttons.push({ label: "오더 수정", action: "EDIT_ORDER", variant: "outline" });
      break;

    case "OPEN":
      buttons.push({ label: "지원자 확인", action: "VIEW_APPLICANTS", variant: "primary" });
      buttons.push({ label: "오더 수정", action: "EDIT_ORDER", variant: "outline" });
      break;

    case "ASSIGNED":
      buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "primary" });
      break;

    case "IN_PROGRESS":
      buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "primary" });
      break;

    case "CLOSING_SUBMITTED":
      if (closingReviewStatus === "PENDING") {
        buttons.push({ label: "마감 검수", action: "REVIEW_CLOSING", variant: "primary" });
      } else if (closingReviewStatus === "REJECTED") {
        buttons.push({ label: "마감 확인", action: "VIEW_CLOSING", variant: "outline" });
      } else if (closingReviewStatus === "APPROVED") {
        buttons.push({ label: "마감 확인", action: "VIEW_CLOSING", variant: "outline" });
      }
      break;

    case "FINAL_AMOUNT_CONFIRMED":
      if (balancePaymentStatus === "PENDING") {
        buttons.push({ label: "잔금 결제", action: "PAY_BALANCE", variant: "primary" });
      }
      buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "outline" });
      break;

    case "BALANCE_PAID":
    case "SETTLEMENT_PAID":
      if (!hasReview) {
        buttons.push({ label: "리뷰 작성", action: "WRITE_REVIEW", variant: "primary" });
      }
      buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "outline" });
      break;
  }

  return buttons;
}

// ─── 헬퍼 모집공고 버튼 ───
export function getHelperRecruitmentButtons(
  hasApplied: boolean
): ActionButton[] {
  if (hasApplied) {
    return [
      { label: "지원완료", action: "VIEW_DETAIL", variant: "outline", disabled: true },
    ];
  }
  return [
    { label: "지원하기", action: "APPLY", variant: "primary" },
    { label: "상세보기", action: "VIEW_DETAIL", variant: "outline" },
  ];
}

export type ApplicationStatus = "pending" | "accepted" | "rejected";

// ─── 헬퍼 지원 목록 버튼 ───
export function getHelperApplicationButtons(
  applicationStatus?: ApplicationStatus
): ActionButton[] {
  switch (applicationStatus) {
    case "pending":
      return [
        { label: "지원취소", action: "CANCEL_APPLICATION", variant: "destructive" },
        { label: "상세보기", action: "VIEW_DETAIL", variant: "outline" },
      ];
    case "accepted":
      return [
        { label: "상세보기", action: "VIEW_DETAIL", variant: "primary" },
      ];
    case "rejected":
      return [
        { label: "상세보기", action: "VIEW_DETAIL", variant: "outline" },
      ];
    default:
      return [
        { label: "상세보기", action: "VIEW_DETAIL", variant: "outline" },
      ];
  }
}

// ─── 헬퍼 내 오더 버튼 (핵심: 업무중 → 마감 제출) ───
export function getHelperMyOrderButtons(
  orderStatus: OrderStatus,
  closingReviewStatus?: ClosingReviewStatus,
  settlementStatus?: SettlementStatus
): ActionButton[] {
  const buttons: ActionButton[] = [];

  switch (orderStatus) {
    case "ASSIGNED":
      buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "primary" });
      break;

    case "IN_PROGRESS":
      buttons.push({ label: "마감 제출", action: "SUBMIT_CLOSING", variant: "primary" });
      buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "outline" });
      break;

    case "CLOSING_SUBMITTED":
      if (closingReviewStatus === "REJECTED") {
        buttons.push({ label: "마감 재제출", action: "SUBMIT_CLOSING", variant: "primary" });
      } else {
        buttons.push({ label: "마감 확인", action: "VIEW_CLOSING", variant: "outline" });
      }
      break;

    case "FINAL_AMOUNT_CONFIRMED":
      buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "outline" });
      break;

    case "BALANCE_PAID":
      if (settlementStatus === "PENDING" || settlementStatus === "CONFIRMED") {
        buttons.push({ label: "정산 대기중", action: "VIEW_DETAIL", variant: "outline", disabled: true });
      } else if (settlementStatus === "PAID") {
        buttons.push({ label: "정산 확인", action: "VIEW_DETAIL", variant: "outline" });
      } else {
        buttons.push({ label: "상세보기", action: "VIEW_DETAIL", variant: "outline" });
      }
      break;

    case "SETTLEMENT_PAID":
      buttons.push({ label: "정산 확인", action: "VIEW_DETAIL", variant: "outline" });
      break;
  }

  return buttons;
}

// ─── 정산 목록 버튼 ───
export function getSettlementListButtons(
  settlementStatus?: SettlementStatus
): ActionButton[] {
  switch (settlementStatus) {
    case "PAID":
      return [{ label: "정산 확인", action: "VIEW_DETAIL", variant: "outline" }];
    case "CONFIRMED":
      return [{ label: "정산 대기중", action: "VIEW_DETAIL", variant: "outline", disabled: true }];
    case "HOLD":
      return [{ label: "이의제기", action: "REPORT_DISPUTE", variant: "destructive" }];
    default:
      return [{ label: "상세보기", action: "VIEW_DETAIL", variant: "outline" }];
  }
}

// ─── 요청자 마감 확인 버튼 ───
export function getRequesterClosingButtons(
  orderStatus: OrderStatus,
  closingReviewStatus?: ClosingReviewStatus,
  balancePaymentStatus?: PaymentStatusType
): ActionButton[] {
  const buttons: ActionButton[] = [];

  switch (orderStatus) {
    case "IN_PROGRESS":
    case "ASSIGNED":
      buttons.push({ label: "업무 진행중", action: "VIEW_DETAIL", variant: "outline", disabled: true });
      break;

    case "CLOSING_SUBMITTED":
      if (!closingReviewStatus || closingReviewStatus === "PENDING") {
        buttons.push({ label: "마감 확인", action: "review_closing", variant: "primary" });
      } else if (closingReviewStatus === "APPROVED") {
        buttons.push({ label: "확인 완료", action: "view_detail", variant: "outline" });
      } else if (closingReviewStatus === "REJECTED") {
        buttons.push({ label: "반려됨 (재제출 대기)", action: "view_detail", variant: "outline", disabled: true });
      }
      break;

    case "FINAL_AMOUNT_CONFIRMED":
      if (balancePaymentStatus === "PENDING") {
        buttons.push({ label: "잔금 결제", action: "pay_balance", variant: "primary" });
      }
      buttons.push({ label: "상세보기", action: "view_detail", variant: "outline" });
      break;

    case "BALANCE_PAID":
    case "SETTLEMENT_PAID":
      buttons.push({ label: "정산 완료", action: "view_detail", variant: "outline" });
      break;
  }

  return buttons;
}

// ─── 리뷰 목록 버튼 ───
export function getReviewListButtons(
  hasReview: boolean
): ActionButton[] {
  if (!hasReview) {
    return [{ label: "리뷰 작성", action: "WRITE_REVIEW", variant: "primary" }];
  }
  return [{ label: "리뷰 보기", action: "VIEW_REVIEW", variant: "outline" }];
}
