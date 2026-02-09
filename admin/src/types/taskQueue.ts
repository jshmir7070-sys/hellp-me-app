/**
 * Task Queue Types
 * 업무 대기함 타입 정의
 */

export type TaskType = 'order_approval' | 'settlement_approval' | 'helper_verification';

export interface TaskQueueItem {
  taskType: TaskType;
  referenceId: number;
  priority: number; // 1=긴급, 2=고액, 3=일반
  waitingMinutes: number;
  relatedData: {
    orderId?: number;
    settlementId?: number;
    verificationId?: number;
    requesterName?: string;
    helperName?: string;
    pickup?: string;
    delivery?: string;
    amount?: number;
    isUrgent?: boolean;
    [key: string]: any;
  };
}

export interface DashboardStats {
  activeOrders: number;
  activeHelpers: number;
  pendingSettlementTotal: number;
  todayRevenue: number;
}

export interface DashboardOverview {
  stats: DashboardStats;
  taskQueue: TaskQueueItem[];
  recentOrders: Array<{
    id: number;
    status: string;
    isUrgent: boolean;
    requesterName: string;
    helperName: string | null;
    settlementStatus: string | null;
    platformRevenue: number;
    statusWaitingMinutes: number;
  }>;
}

export interface BatchApprovalResult {
  approvedCount: number;
  approvedOrders?: Array<{ id: number; status: string }>;
  approvedSettlements?: Array<{ id: number; status: string; amount: number }>;
  verifiedHelpers?: Array<{ id: number; user_id: string }>;
}
