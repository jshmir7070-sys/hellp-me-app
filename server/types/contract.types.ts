/**
 * Contract Module Types
 * 계약 관련 타입 정의
 */

export interface Contract {
  id: number;
  orderId: number;
  requesterId: string;
  helperId: string;
  title: string;
  status: ContractStatus;
  startDate: Date;
  endDate?: Date;
  amount: number;
  terms?: string;
  signedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface CreateContractData {
  orderId: number;
  requesterId: string;
  helperId: string;
  title: string;
  startDate: Date;
  endDate?: Date;
  amount: number;
  terms?: string;
}

export interface UpdateContractData {
  status?: ContractStatus;
  title?: string;
  amount?: number;
  terms?: string;
  endDate?: Date;
}

export interface ContractSignature {
  id: number;
  contractId: number;
  userId: string;
  userRole: 'requester' | 'helper';
  signedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface ContractDetail {
  contract: Contract;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  helper: {
    id: string;
    name: string;
    email: string;
  };
  order: any;
  signatures: ContractSignature[];
  payment?: any;
}
