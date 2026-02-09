export type OrderStatus =
  | "awaiting_deposit"
  | "open"
  | "scheduled"
  | "in_progress"
  | "closing_submitted"
  | "final_amount_confirmed"
  | "balance_paid"
  | "settlement_paid"
  | "closed"
  | "cancelled";

export type CourierCategory = "parcel" | "other" | "cold";

export interface OrderRow {
  id: number;
  status: OrderStatus;
  courierName: string;
  category: CourierCategory;
  scheduledDate?: string;
  boxCount: number;
  matchedHelperId?: number | null;
  matchedHelperName?: string | null;
  closingSubmittedAt?: string | null;
  finalTotal?: number | null;
  driverPayout?: number | null;
}

export interface ClosingDetail {
  orderId: number;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  extraCosts: Array<{ label: string; amount: number }>;
  deliveryHistoryImages: string[];
  etcImages: string[];
  submittedAt: string;
  memo?: string | null;
}

export interface SettlementRow {
  id: number;
  orderId: number;
  helperId: number;
  helperName?: string;
  finalTotal: number;
  platformFee: number;
  damageDeduction: number;
  driverPayout: number;
  status: "calculated" | "approved" | "paid" | "hold";
  scheduledDate?: string;
}

export interface CourierSettingRow {
  id: number;
  courierName: string;
  category: CourierCategory;
  basePricePerBox: number;
  minTotal: number;
  commissionRate: number;
  urgentCommissionRate: number;
  urgentSurchargeRate: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface HelperSummary {
  id: number;
  name: string;
  phone: string;
  email?: string;
  region?: string;
  vehicleType?: string;
  isActive: boolean;
  isVerified: boolean;
  totalOrders?: number;
  totalPayout?: number;
  lastWorkDate?: string;
  licenseImages?: string[];
  vehicleImages?: string[];
  bankbookImages?: string[];
}

export interface RequesterSummary {
  id: number;
  companyName: string;
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  isVerified: boolean;
  totalOrders?: number;
  totalPaid?: number;
  outstandingAmount?: number;
  lastOrderDate?: string;
}

export interface IncidentRow {
  id: number;
  orderId: number;
  type: string;
  amount: number;
  reason: string;
  status: string;
  images?: string[];
  createdAt: string;
}

export interface CSTicketRow {
  id: number;
  orderId?: number | null;
  userId: number;
  userName: string;
  userRole: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}
