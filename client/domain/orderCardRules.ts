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

export function getRequesterButtons(
  _orderStatus: OrderStatus,
  _closingReviewStatus?: ClosingReviewStatus,
  _downPaymentStatus?: PaymentStatusType,
  _balancePaymentStatus?: PaymentStatusType,
  _hasReview?: boolean
): ActionButton[] {
  return [];
}

export function getHelperRecruitmentButtons(
  _hasApplied: boolean
): ActionButton[] {
  return [];
}

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export function getHelperApplicationButtons(
  _applicationStatus?: ApplicationStatus
): ActionButton[] {
  return [];
}

export function getHelperMyOrderButtons(
  _orderStatus: OrderStatus,
  _closingReviewStatus?: ClosingReviewStatus,
  _settlementStatus?: SettlementStatus
): ActionButton[] {
  return [];
}

export function getSettlementListButtons(
  _settlementStatus?: SettlementStatus
): ActionButton[] {
  return [];
}

export function getReviewListButtons(
  _hasReview: boolean
): ActionButton[] {
  return [];
}
