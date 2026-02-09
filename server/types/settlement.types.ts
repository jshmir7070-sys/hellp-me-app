/**
 * Settlement Module Types
 * 정산 관련 타입 정의
 */

export interface Settlement {
  id: number;
  orderId: number;
  helperId: string;
  requesterId: string;
  status: SettlementStatus;
  amount: number;
  deductions: number;
  netAmount: number;
  confirmedAt?: Date;
  paidAt?: Date;
  dueDate?: Date;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type SettlementStatus =
  | 'pending'
  | 'ready'
  | 'confirmed'
  | 'paid'
  | 'on_hold'
  | 'cancelled';

export interface CreateSettlementData {
  orderId: number;
  helperId: string;
  requesterId: string;
  amount: number;
  deductions?: number;
  dueDate?: Date;
  notes?: string;
}

export interface UpdateSettlementData {
  amount?: number;
  deductions?: number;
  status?: SettlementStatus;
  notes?: string;
  dueDate?: Date;
}

export interface SettlementSummary {
  orderId: number;
  totalAmount: number;
  deductions: number;
  netAmount: number;
  helperPayout: number;
  platformFee: number;
  requesterId: string;
  helperId: string;
  orderDetails: {
    title: string;
    status: string;
    completedAt?: Date;
  };
}

export interface SettlementStatement {
  id: number;
  helperId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalOrders: number;
  totalAmount: number;
  totalDeductions: number;
  netAmount: number;
  status: 'draft' | 'confirmed' | 'paid';
  confirmedAt?: Date;
  paidAt?: Date;
  settlements: Settlement[];
  createdAt: Date;
}

export interface CreateSettlementStatementData {
  helperId: string;
  periodStart: Date;
  periodEnd: Date;
  settlementIds: number[];
}

export interface Deduction {
  id: number;
  settlementId?: number;
  orderId?: number;
  helperId: string;
  type: DeductionType;
  amount: number;
  reason: string;
  status: 'pending' | 'applied' | 'cancelled';
  appliedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export type DeductionType =
  | 'damage'
  | 'penalty'
  | 'missing_items'
  | 'quality_issue'
  | 'cancellation_fee'
  | 'other';

export interface CreateDeductionData {
  settlementId?: number;
  orderId?: number;
  helperId: string;
  type: DeductionType;
  amount: number;
  reason: string;
}

export interface Payout {
  id: number;
  settlementId: number;
  helperId: string;
  amount: number;
  status: PayoutStatus;
  method: 'bank_transfer' | 'cash' | 'other';
  accountInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  sentAt?: Date;
  succeededAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PayoutStatus =
  | 'pending'
  | 'sent'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface CreatePayoutData {
  settlementId: number;
  method: 'bank_transfer' | 'cash' | 'other';
  accountInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
}

export interface DailySettlementReport {
  date: Date;
  totalOrders: number;
  totalAmount: number;
  totalDeductions: number;
  netAmount: number;
  settlementsCount: number;
  byStatus: Record<SettlementStatus, number>;
}

export interface HelperSettlementReport {
  helperId: string;
  helperName: string;
  totalOrders: number;
  totalAmount: number;
  totalDeductions: number;
  netAmount: number;
  pendingAmount: number;
  paidAmount: number;
  settlements: Settlement[];
}

export interface MonthlySettlementSummary {
  month: string; // YYYY-MM
  totalOrders: number;
  totalHelpers: number;
  totalRequesters: number;
  totalAmount: number;
  totalDeductions: number;
  netAmount: number;
  paidAmount: number;
  pendingAmount: number;
  byStatus: Record<SettlementStatus, {
    count: number;
    amount: number;
  }>;
}

export interface BatchSettlementOperation {
  settlementIds: number[];
  action: 'confirm' | 'pay' | 'cancel';
  notes?: string;
}

export interface SettlementValidation {
  settlementId: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    orderExists: boolean;
    helperExists: boolean;
    requesterExists: boolean;
    amountValid: boolean;
    statusValid: boolean;
  };
}

export interface OutstandingBalance {
  orderId: number;
  requesterId: string;
  requesterName: string;
  amount: number;
  dueDate: Date;
  daysPastDue: number;
  status: 'pending' | 'overdue' | 'reminded';
  lastRemindedAt?: Date;
  order: {
    title: string;
    completedAt: Date;
  };
}

export interface SettlementAuditLog {
  id: number;
  settlementId: number;
  action: string;
  performedBy: string;
  performedByName: string;
  oldValue?: any;
  newValue?: any;
  notes?: string;
  createdAt: Date;
}

export interface SettlementEmailData {
  helperId: string;
  helperEmail: string;
  helperName: string;
  period: {
    start: Date;
    end: Date;
  };
  settlements: Settlement[];
  totalAmount: number;
  totalDeductions: number;
  netAmount: number;
}

export interface SettlementExportData {
  settlements: Settlement[];
  period?: {
    start: Date;
    end: Date;
  };
  filters?: {
    helperId?: string;
    requesterId?: string;
    status?: SettlementStatus;
  };
  format: 'csv' | 'excel' | 'pdf';
}

export interface BalanceInvoice {
  id: number;
  orderId: number;
  requesterId: string;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBalanceInvoiceData {
  orderId: number;
  amount: number;
  dueDate: Date;
  notes?: string;
}
