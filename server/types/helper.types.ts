/**
 * Helper Module Types
 * 헬퍼 관련 타입 정의
 */

export interface HelperProfile {
  userId: string;
  name: string;
  phoneNumber: string;
  email: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  profileImage?: string;
  bio?: string;
  rating?: number;
  totalOrders?: number;
  completedOrders?: number;
  joinedAt: Date;
  lastActiveAt?: Date;
}

export type VerificationStatus =
  | 'pending'
  | 'in_review'
  | 'verified'
  | 'rejected'
  | 'suspended';

export interface HelperCredential {
  id: number;
  userId: string;
  credentialType: string;
  credentialNumber?: string;
  issuedDate?: Date;
  expiryDate?: Date;
  imageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCredentialData {
  credentialType: string;
  credentialNumber?: string;
  issuedDate?: Date;
  expiryDate?: Date;
  imageUrl?: string;
}

export interface UpdateCredentialData {
  credentialNumber?: string;
  issuedDate?: Date;
  expiryDate?: Date;
  imageUrl?: string;
  status?: 'pending' | 'verified' | 'rejected';
}

export interface HelperLicense {
  id: number;
  userId: string;
  licenseType: LicenseType;
  licenseNumber: string;
  issuedDate: Date;
  expiryDate: Date;
  driverLicenseImageUrl?: string;
  cargoLicenseImageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LicenseType =
  | 'type_1_regular'
  | 'type_1_small'
  | 'type_2_regular'
  | 'type_2_small'
  | 'special';

export interface CreateLicenseData {
  licenseType: LicenseType;
  licenseNumber: string;
  issuedDate: Date;
  expiryDate: Date;
  driverLicenseImageUrl?: string;
  cargoLicenseImageUrl?: string;
}

export interface HelperVehicle {
  id: number;
  userId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  capacity?: string;
  imageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type VehicleType =
  | 'truck_small'
  | 'truck_medium'
  | 'truck_large'
  | 'van'
  | 'motorcycle'
  | 'other';

export interface CreateVehicleData {
  vehicleType: VehicleType;
  vehicleNumber: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  capacity?: string;
  imageUrl?: string;
}

export interface HelperBusiness {
  id: number;
  userId: string;
  businessName: string;
  businessNumber: string;
  businessType: 'individual' | 'corporate';
  ownerName: string;
  address?: string;
  imageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBusinessData {
  businessName: string;
  businessNumber: string;
  businessType: 'individual' | 'corporate';
  ownerName: string;
  address?: string;
  imageUrl?: string;
}

export interface HelperBankAccount {
  id: number;
  userId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  bankbookImageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBankAccountData {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  bankbookImageUrl?: string;
}

export interface OnboardingStatus {
  userId: string;
  hasCredential: boolean;
  hasLicense: boolean;
  hasVehicle: boolean;
  hasBusiness: boolean;
  hasBankAccount: boolean;
  hasTermsAgreement: boolean;
  isComplete: boolean;
  completedSteps: number;
  totalSteps: number;
  missingSteps: string[];
}

export interface OnboardingSubmission {
  userId: string;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface HelperServiceArea {
  id: number;
  userId: string;
  areaName: string;
  areaCode?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateServiceAreaData {
  areaName: string;
  areaCode?: string;
}

export interface HelperWorkDetail {
  date: Date;
  ordersCompleted: number;
  totalEarnings: number;
  averageRating: number;
  orders: Array<{
    orderId: number;
    title: string;
    completedAt: Date;
    earnings: number;
    rating?: number;
  }>;
}

export interface HelperWorkHistory {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalEarnings: number;
  averageRating: number;
  topPerformingDays: Date[];
  ordersPerDay: Record<string, number>;
}

export interface HelperDispute {
  id: number;
  helperId: string;
  orderId?: number;
  title: string;
  description: string;
  status: DisputeStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: DisputeCategory;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

export type DisputeStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'escalated';

export type DisputeCategory =
  | 'payment'
  | 'order'
  | 'customer'
  | 'platform'
  | 'other';

export interface CreateDisputeData {
  orderId?: number;
  title: string;
  description: string;
  category: DisputeCategory;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface UpdateDisputeData {
  status?: DisputeStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  resolution?: string;
}

export interface HelperIncident {
  id: number;
  helperId: string;
  orderId?: number;
  incidentType: IncidentType;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  description: string;
  reportedAt: Date;
  status: 'reported' | 'under_investigation' | 'resolved' | 'closed';
  investigatedBy?: string;
  resolution?: string;
  resolvedAt?: Date;
}

export type IncidentType =
  | 'accident'
  | 'damage'
  | 'delay'
  | 'complaint'
  | 'violation'
  | 'other';

export interface IncidentAction {
  incidentId: number;
  action: 'acknowledge' | 'dispute' | 'provide_evidence';
  notes?: string;
  evidenceUrls?: string[];
}

export interface HelperTermsAgreement {
  id: number;
  userId: string;
  termsVersion: string;
  agreedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateTermsAgreementData {
  termsVersion: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface HelperReview {
  id: number;
  orderId: number;
  helperId: string;
  requesterId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface CreateReviewData {
  orderId: number;
  rating: number;
  comment?: string;
}

export interface HelperTeam {
  id: number;
  teamLeaderId: string;
  teamLeaderName: string;
  membersCount: number;
  members: HelperTeamMember[];
  createdAt: Date;
}

export interface HelperTeamMember {
  userId: string;
  name: string;
  phoneNumber: string;
  joinedAt: Date;
  role: 'leader' | 'member';
  isActive: boolean;
}

export interface HelperPersonalCode {
  userId: string;
  personalCode: string;
  teamId?: number;
  teamLeaderId?: string;
  isInTeam: boolean;
}

export interface HelperCommissionOverride {
  id: number;
  helperId: string;
  commissionRate: number;
  reason?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface CreateCommissionOverrideData {
  helperId: string;
  commissionRate: number;
  reason?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface HelperAvailability {
  userId: string;
  isAvailable: boolean;
  serviceAreas: string[];
  vehicleTypes: VehicleType[];
  maxOrdersPerDay?: number;
  workingHours?: {
    start: string;
    end: string;
  };
}

export interface HelperStats {
  userId: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  rating: number;
  totalReviews: number;
  totalEarnings: number;
  onTimeDeliveryRate: number;
  acceptanceRate: number;
  responseTime: number; // in minutes
}

export interface DocumentReviewTask {
  id: number;
  userId: string;
  taskType: 'credential' | 'license' | 'vehicle' | 'business' | 'bank_account';
  documentId: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface IdentityVerification {
  id: number;
  userId: string;
  verificationType: 'id_card' | 'passport' | 'driver_license';
  verificationStatus: 'pending' | 'verified' | 'failed';
  verifiedAt?: Date;
  verificationData?: Record<string, any>;
  createdAt: Date;
}

export interface HelperListFilters {
  isVerified?: boolean;
  status?: VerificationStatus;
  serviceArea?: string;
  vehicleType?: VehicleType;
  minRating?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface HelperDetailAdmin {
  profile: HelperProfile;
  credential?: HelperCredential;
  license?: HelperLicense;
  vehicle?: HelperVehicle;
  business?: HelperBusiness;
  bankAccount?: HelperBankAccount;
  stats: HelperStats;
  serviceAreas: HelperServiceArea[];
  team?: HelperTeam;
  commissionOverride?: HelperCommissionOverride;
  recentOrders: any[];
  recentDisputes: HelperDispute[];
  recentIncidents: HelperIncident[];
}

export interface VerifyHelperData {
  userId: string;
  verifiedBy: string;
  notes?: string;
}

export interface RejectHelperData {
  userId: string;
  rejectedBy: string;
  reason: string;
}
