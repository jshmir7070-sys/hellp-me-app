/**
 * Integrated Order Detail Types
 * 통합 오더 상세 타입 정의
 */

export interface IntegratedOrderDetail {
  order: {
    id: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    requesterId: string;
    requesterName: string;
    requesterPhone: string;
    requesterEmail: string;
    matchedHelperId: string | null;
    helperName: string | null;
    helperPhone: string | null;
    helperTeamName: string | null;
    helperProfileImage: string | null;
    deliveryArea: string;
    campAddress: string;
    courierCompany: string;
    companyName: string;
    boxCount: number;
    unitPrice: number;
    totalAmount: number;
    scheduledDate: string;
    deadline: string | null;
    contactPhone: string;
    deliveryGuide: string | null;
    isUrgent: boolean;
    regionMapUrl: string | null;
  };
  contract: {
    id: number;
    status: string;
    signedAt: string | null;
    helperSignedAt: string | null;
    requesterSignedAt: string | null;
    terms: string | null;
  } | null;
  settlements: Array<{
    id: number;
    status: string;
    amount: number;
    platformFee: number;
    netAmount: number;
    createdAt: string;
    approvedAt: string | null;
    paidAt: string | null;
  }>;
  checkins: Array<{
    id: number;
    checkedInAt: string;
    location: string | null;
    photoUrl: string | null;
    notes: string | null;
  }>;
  closing: {
    id: number;
    status: string;
    helperName: string | null;
    requesterName: string | null;
    actualBoxCount: number | null;
    actualWorkTime: number | null;
    helperNotes: string | null;
    requesterNotes: string | null;
    photoUrls: string[] | null;
    createdAt: string;
    helperSubmittedAt: string | null;
    requesterApprovedAt: string | null;
  } | null;
  applications: Array<{
    id: number;
    helperId: string;
    helperName: string;
    helperPhone: string;
    helperTeamName: string | null;
    status: string;
    message: string | null;
    expectedArrival: string | null;
    appliedAt: string;
  }>;
}
