import type { OrderStatus, ClosingReviewStatus, PaymentStatusType, ViewerRole, SettlementStatus, ApplicationStatus } from "@/domain/orderCardRules";

export type CourierCategory = "parcel" | "other" | "cold";

export interface OrderCardDTO {
  orderId: string;
  contractId?: string;

  title?: string;
  courierName?: string;
  companyName?: string;
  courierCategory?: CourierCategory;
  region1?: string;
  region2?: string;
  addressShort?: string;
  deliveryArea?: string;
  campName?: string;
  campAddress?: string;
  startAt?: string;
  endAt?: string;

  regionMapUrl?: string;
  deliveryGuideUrl?: string;
  deliveryGuide?: string;

  vehicleType?: string;
  expectedCount?: number;
  averageQuantity?: number;
  deliveredCount?: number;
  returnedCount?: number;
  pickupCount?: number;
  otherCount?: number;
  unitPrice?: number;
  unitPriceType?: string;
  includesVat?: boolean;
  finalAmount?: number;
  downPaidAmount?: number;
  balanceAmount?: number;
  paidAmount?: number;
  unpaidAmount?: number;
  depositPaid?: boolean;
  balancePaid?: boolean;
  balancePaidAt?: string;

  orderStatus: OrderStatus;
  closingReviewStatus?: ClosingReviewStatus;
  paymentStatus?: { down: PaymentStatusType; balance: PaymentStatusType };
  settlementStatus?: SettlementStatus;

  applicantCount?: number;
  assignedHelperName?: string;
  requesterName?: string;
  hasApplied?: boolean;
  hasReview?: boolean;
  isUrgent?: boolean;
  applicationStatus?: ApplicationStatus;
  appliedAt?: string;

  statusLabel?: string;
  statusColor?: string;

  viewerRole: ViewerRole;
}

export function adaptRequesterOrder(order: any): OrderCardDTO {
  const orderStatus = mapOrderStatus(order.status || order.orderStatus);
  const closingReviewStatus = mapClosingReviewStatus(order.closingReviewStatus);
  
  const avgQty = order.averageQuantity 
    ? parseInt(String(order.averageQuantity).replace(/[^0-9]/g, '')) || 0
    : undefined;
  
  return {
    orderId: String(order.id || order.orderId),
    contractId: order.contractId ? String(order.contractId) : undefined,
    title: order.title || order.orderTitle || formatOrderTitle(order),
    courierName: order.courierName || order.carrierName,
    companyName: order.companyName,
    courierCategory: parseCourierCategory(order.courierCategory),
    region1: order.region1 || order.pickupRegion1 || order.deliveryRegion1,
    region2: order.region2 || order.pickupRegion2 || order.deliveryRegion2,
    addressShort: order.addressShort || order.pickupAddress || order.deliveryAddress,
    deliveryArea: order.deliveryArea || order.campAddress,
    campName: order.campName || order.campAddress?.split(' ')[0],
    campAddress: order.campAddress,
    startAt: order.startAt || order.workStartTime || order.scheduledDate,
    endAt: order.endAt || order.workEndTime || order.scheduledDateEnd,
    regionMapUrl: order.regionMapUrl,
    deliveryGuideUrl: order.deliveryGuideUrl,
    deliveryGuide: order.deliveryGuide,
    vehicleType: order.vehicleType,
    expectedCount: order.expectedCount || order.estimatedDeliveryCount,
    averageQuantity: avgQty,
    deliveredCount: order.deliveredCount || order.deliveryCount || order.actualDeliveryCount,
    returnedCount: order.returnedCount || order.returnCount || order.actualReturnCount,
    otherCount: order.otherCount || order.etcCount || 0,
    unitPrice: order.unitPrice || order.pricePerUnit || order.pricePerDelivery,
    unitPriceType: order.unitPriceType || order.priceType,
    includesVat: order.includesVat ?? false,
    finalAmount: order.totalAmount || order.finalAmount || 0,
    downPaidAmount: order.depositAmount || order.downPaidAmount || 0,
    balanceAmount: order.balanceAmount || order.unpaidAmount || 0,
    paidAmount: order.paidAmount || 0,
    unpaidAmount: order.unpaidAmount || 0,
    depositPaid: order.depositPaid ?? false,
    balancePaid: order.balancePaid ?? false,
    balancePaidAt: order.balancePaidAt || undefined,
    orderStatus,
    closingReviewStatus,
    paymentStatus: {
      down: mapPaymentStatus(order.depositPaid ? 'PAID' : order.depositPaymentStatus || order.downPaymentStatus),
      balance: mapPaymentStatus(order.balancePaid ? 'PAID' : order.balancePaymentStatus),
    },
    settlementStatus: mapSettlementStatus(order.settlementStatus),
    applicantCount: order.applicantCount || order.applicationCount,
    assignedHelperName: order.helperName || order.assignedHelperName,
    hasReview: order.hasReview || !!order.reviewId,
    isUrgent: order.isUrgent || false,
    viewerRole: "requester",
  };
}

export function adaptHelperRecruitmentOrder(order: any, hasApplied: boolean = false): OrderCardDTO {
  const avgQty = order.averageQuantity 
    ? parseInt(String(order.averageQuantity).replace(/[^0-9]/g, '')) || 0
    : undefined;
  
  const serverHasApplied = order.myCandidateStatus != null || hasApplied;
  const applicantCount = order.activeCandidates ?? order.applicantCount ?? order.applicationCount ?? 0;
  const orderStatus = mapOrderStatus(order.status || order.orderStatus);
  
  return {
    orderId: String(order.id || order.orderId),
    title: order.title || order.orderTitle || formatOrderTitle(order),
    courierName: order.courierName || order.carrierName || order.courierCompany,
    companyName: order.companyName,
    courierCategory: parseCourierCategory(order.courierCategory),
    region1: order.region1 || order.pickupRegion1 || order.deliveryRegion1,
    region2: order.region2 || order.pickupRegion2 || order.deliveryRegion2,
    addressShort: order.addressShort || order.pickupAddress,
    deliveryArea: order.deliveryArea,
    campName: order.campName || order.campAddress?.split(' ')[0],
    campAddress: order.campAddress,
    startAt: order.startAt || order.workStartTime || order.scheduledDate,
    endAt: order.endAt || order.workEndTime || order.scheduledDateEnd,
    regionMapUrl: order.regionMapUrl,
    deliveryGuideUrl: order.deliveryGuideUrl,
    deliveryGuide: order.deliveryGuide,
    vehicleType: order.vehicleType,
    expectedCount: order.expectedCount || order.estimatedDeliveryCount,
    averageQuantity: avgQty,
    deliveredCount: order.deliveredCount || order.deliveryCount,
    returnedCount: order.returnedCount || order.returnCount,
    pickupCount: order.pickupCount,
    otherCount: order.otherCount,
    unitPrice: order.unitPrice || order.pricePerUnit || order.pricePerDelivery,
    unitPriceType: order.unitPriceType || order.priceType,
    includesVat: order.includesVat ?? false,
    orderStatus,
    applicantCount,
    requesterName: order.requesterName || order.companyName,
    hasApplied: serverHasApplied,
    isUrgent: order.isUrgent || false,
    viewerRole: "helper",
  };
}

export function adaptHelperApplicationOrder(application: any): OrderCardDTO {
  const order = application.order || application;
  const applicationStatus = mapApplicationStatus(application.status);
  
  const avgQty = order.averageQuantity 
    ? parseInt(String(order.averageQuantity).replace(/[^0-9]/g, '')) || 0
    : undefined;
  
  let orderStatus: OrderStatus;
  if (applicationStatus === 'accepted') {
    orderStatus = mapOrderStatus(order.status || order.orderStatus) || 'ASSIGNED';
  } else if (applicationStatus === 'rejected') {
    orderStatus = 'CANCELLED';
  } else {
    orderStatus = 'OPEN';
  }
  
  return {
    orderId: String(application.orderId || order.id || order.orderId),
    title: order.title || order.orderTitle || formatOrderTitle(order),
    courierName: order.courierName || order.carrierName || order.courierCompany,
    companyName: order.companyName,
    courierCategory: parseCourierCategory(order.courierCategory),
    region1: order.region1 || order.pickupRegion1 || order.deliveryRegion1,
    region2: order.region2 || order.pickupRegion2 || order.deliveryRegion2,
    addressShort: order.addressShort || order.pickupAddress,
    deliveryArea: order.deliveryArea,
    campName: order.campName || order.campAddress?.split(' ')[0],
    campAddress: order.campAddress,
    startAt: order.startAt || order.workStartTime || order.scheduledDate,
    endAt: order.endAt || order.workEndTime || order.scheduledDateEnd,
    regionMapUrl: order.regionMapUrl,
    deliveryGuideUrl: order.deliveryGuideUrl,
    deliveryGuide: order.deliveryGuide,
    vehicleType: order.vehicleType,
    expectedCount: order.expectedCount || order.estimatedDeliveryCount,
    averageQuantity: avgQty,
    deliveredCount: order.deliveredCount || order.deliveryCount,
    returnedCount: order.returnedCount || order.returnCount,
    pickupCount: order.pickupCount,
    otherCount: order.otherCount,
    unitPrice: order.unitPrice || order.pricePerUnit || order.pricePerDelivery,
    unitPriceType: order.unitPriceType || order.priceType,
    includesVat: order.includesVat ?? false,
    orderStatus,
    requesterName: order.requesterName || order.companyName,
    hasApplied: true,
    applicationStatus,
    appliedAt: application.appliedAt || application.createdAt,
    isUrgent: order.isUrgent || false,
    viewerRole: "helper",
  };
}

function mapApplicationStatus(status?: string): "pending" | "accepted" | "rejected" | undefined {
  if (!status) return "pending";
  switch (status.toLowerCase()) {
    case "pending":
    case "submitted":
      return "pending";
    case "accepted":
    case "approved":
    case "selected":
      return "accepted";
    case "rejected":
    case "not_selected":
    case "cancelled":
      return "rejected";
    default:
      return "pending";
  }
}

export function adaptHelperMyOrder(order: any): OrderCardDTO {
  const orderStatus = mapOrderStatus(order.status || order.orderStatus);
  const closingReviewStatus = mapClosingReviewStatus(order.closingReviewStatus);
  
  const avgQty = order.averageQuantity 
    ? parseInt(String(order.averageQuantity).replace(/[^0-9]/g, '')) || 0
    : undefined;
  
  return {
    orderId: String(order.id || order.orderId),
    contractId: order.contractId ? String(order.contractId) : undefined,
    title: order.title || order.orderTitle || formatOrderTitle(order),
    courierName: order.courierName || order.carrierName || order.courierCompany,
    companyName: order.companyName,
    courierCategory: parseCourierCategory(order.courierCategory),
    region1: order.region1 || order.pickupRegion1 || order.deliveryRegion1,
    region2: order.region2 || order.pickupRegion2 || order.deliveryRegion2,
    addressShort: order.addressShort || order.pickupAddress || order.deliveryAddress,
    deliveryArea: order.deliveryArea || order.campAddress,
    campName: order.campName || order.campAddress?.split(' ')[0],
    campAddress: order.campAddress,
    startAt: order.startAt || order.workStartTime || order.scheduledDate,
    endAt: order.endAt || order.workEndTime || order.scheduledDateEnd,
    regionMapUrl: order.regionMapUrl,
    deliveryGuideUrl: order.deliveryGuideUrl,
    deliveryGuide: order.deliveryGuide,
    vehicleType: order.vehicleType,
    expectedCount: order.expectedCount || order.estimatedDeliveryCount,
    averageQuantity: avgQty,
    deliveredCount: order.deliveredCount || order.deliveryCount || order.actualDeliveryCount,
    returnedCount: order.returnedCount || order.returnCount || order.actualReturnCount,
    pickupCount: order.pickupCount,
    otherCount: order.otherCount,
    unitPrice: order.unitPrice || order.pricePerUnit || order.pricePerDelivery,
    unitPriceType: order.unitPriceType || order.priceType,
    includesVat: order.includesVat ?? false,
    finalAmount: order.finalAmount || order.totalAmount,
    downPaidAmount: order.downPaidAmount || order.depositAmount,
    balanceAmount: order.balanceAmount || order.remainingAmount,
    orderStatus,
    closingReviewStatus,
    paymentStatus: {
      down: mapPaymentStatus(order.depositPaymentStatus || order.downPaymentStatus),
      balance: mapPaymentStatus(order.balancePaymentStatus),
    },
    settlementStatus: mapSettlementStatus(order.settlementStatus),
    requesterName: order.requesterName || order.companyName,
    isUrgent: order.isUrgent || false,
    viewerRole: "helper",
  };
}

export function adaptSettlementOrder(order: any, viewerRole: ViewerRole): OrderCardDTO {
  const dto = viewerRole === "requester" 
    ? adaptRequesterOrder(order) 
    : adaptHelperMyOrder(order);
  
  return {
    ...dto,
    settlementStatus: mapSettlementStatus(order.settlementStatus),
  };
}

export function adaptReviewOrder(order: any, viewerRole: ViewerRole): OrderCardDTO {
  const dto = viewerRole === "requester" 
    ? adaptRequesterOrder(order) 
    : adaptHelperMyOrder(order);
  
  return {
    ...dto,
    hasReview: order.hasReview || !!order.reviewId,
  };
}

export function adaptWorkHistory(item: any): OrderCardDTO {
  return {
    orderId: String(item.id || item.settlementId),
    contractId: item.settlementId ? String(item.settlementId) : undefined,
    title: item.companyName || "업무내역",
    region1: item.deliveryArea?.split(" ")[0],
    region2: item.deliveryArea?.split(" ").slice(1).join(" "),
    addressShort: item.deliveryArea,
    startAt: item.date,
    expectedCount: item.deliveryCount + item.returnCount + item.pickupCount + item.otherCount,
    deliveredCount: item.deliveryCount,
    returnedCount: item.returnCount,
    finalAmount: item.netAmount,
    orderStatus: mapWorkHistoryStatus(item.status),
    settlementStatus: mapSettlementStatus(item.status),
    viewerRole: "helper",
  };
}

function mapWorkHistoryStatus(status?: string): OrderStatus {
  if (!status) return "BALANCE_PAID";
  
  const statusMap: Record<string, OrderStatus> = {
    "pending": "CLOSING_SUBMITTED",
    "confirmed": "FINAL_AMOUNT_CONFIRMED",
    "paid": "SETTLEMENT_PAID",
    "completed": "BALANCE_PAID",
    "hold": "CLOSING_SUBMITTED",
  };
  
  return statusMap[status] || "BALANCE_PAID";
}

function mapOrderStatus(status?: string): OrderStatus {
  if (!status) return "OPEN";
  
  const statusMap: Record<string, OrderStatus> = {
    "registered": "OPEN",
    "REGISTERED": "OPEN",
    "matching": "OPEN",
    "MATCHING": "OPEN",
    "open": "OPEN",
    "OPEN": "OPEN",
    "pending": "OPEN",
    "awaiting_deposit": "PENDING_APPROVAL",
    "AWAITING_DEPOSIT": "PENDING_APPROVAL",
    "pending_deposit": "PENDING_APPROVAL",
    "PENDING_DEPOSIT": "PENDING_APPROVAL",
    "scheduled": "ASSIGNED",
    "SCHEDULED": "ASSIGNED",
    "assigned": "ASSIGNED",
    "ASSIGNED": "ASSIGNED",
    "matched": "ASSIGNED",
    "checked_in": "IN_PROGRESS",
    "CHECKED_IN": "IN_PROGRESS",
    "in_progress": "IN_PROGRESS",
    "IN_PROGRESS": "IN_PROGRESS",
    "active": "IN_PROGRESS",
    "closing_submitted": "CLOSING_SUBMITTED",
    "CLOSING_SUBMITTED": "CLOSING_SUBMITTED",
    "closing": "CLOSING_SUBMITTED",
    "final_amount_confirmed": "FINAL_AMOUNT_CONFIRMED",
    "FINAL_AMOUNT_CONFIRMED": "FINAL_AMOUNT_CONFIRMED",
    "confirmed": "FINAL_AMOUNT_CONFIRMED",
    "balance_paid": "BALANCE_PAID",
    "BALANCE_PAID": "BALANCE_PAID",
    "settlement_paid": "SETTLEMENT_PAID",
    "SETTLEMENT_PAID": "SETTLEMENT_PAID",
    "completed": "BALANCE_PAID",
    "closed": "BALANCE_PAID",
    "cancelled": "CANCELLED",
    "CANCELLED": "CANCELLED",
  };
  
  return statusMap[status] || "OPEN";
}

function mapClosingReviewStatus(status?: string): ClosingReviewStatus | undefined {
  if (!status) return undefined;
  
  const statusMap: Record<string, ClosingReviewStatus> = {
    "pending": "PENDING",
    "PENDING": "PENDING",
    "approved": "APPROVED",
    "APPROVED": "APPROVED",
    "rejected": "REJECTED",
    "REJECTED": "REJECTED",
  };
  
  return statusMap[status];
}

function mapPaymentStatus(status?: string): PaymentStatusType {
  if (!status) return "N/A";
  
  const statusMap: Record<string, PaymentStatusType> = {
    "pending": "PENDING",
    "PENDING": "PENDING",
    "paid": "PAID",
    "PAID": "PAID",
    "completed": "PAID",
    "success": "PAID",
  };
  
  return statusMap[status] || "N/A";
}

function mapSettlementStatus(status?: string): SettlementStatus | undefined {
  if (!status) return undefined;
  
  const statusMap: Record<string, SettlementStatus> = {
    "pending": "PENDING",
    "PENDING": "PENDING",
    "confirmed": "CONFIRMED",
    "CONFIRMED": "CONFIRMED",
    "paid": "PAID",
    "PAID": "PAID",
    "hold": "HOLD",
    "HOLD": "HOLD",
  };
  
  return statusMap[status];
}

function parseCourierCategory(category?: string): CourierCategory | undefined {
  if (!category) return undefined;
  if (category === "cold" || category === "other" || category === "parcel") return category;
  return undefined;
}

function formatOrderTitle(order: any): string {
  const parts: string[] = [];
  
  if (order.region2 || order.deliveryRegion2 || order.pickupRegion2) {
    parts.push(order.region2 || order.deliveryRegion2 || order.pickupRegion2);
  }
  
  if (order.serviceType) {
    const serviceMap: Record<string, string> = {
      "dawn_delivery": "새벽배송",
      "same_day": "당일배송",
      "regular": "일반배송",
      "return": "반품수거",
      "pickup": "픽업",
    };
    parts.push(serviceMap[order.serviceType] || order.serviceType);
  }
  
  return parts.length > 0 ? parts.join(" ") : "오더";
}
