import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, Download, FileImage, Check, X, ZoomIn,
  FileText, Clock, CheckCircle, XCircle, Eye, AlertCircle
} from 'lucide-react';

interface DocumentData {
  id: number;
  userId: string;
  documentType: 'businessCert' | 'driverLicense' | 'cargoLicense' | 'vehicleCert' | 'transportContract';
  status: 'not_submitted' | 'pending' | 'reviewing' | 'approved' | 'rejected';
  imageUrl?: string;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  adminNote?: string;
  // Business cert fields
  businessNumber?: string;
  businessName?: string;
  representativeName?: string;
  businessAddress?: string;
  businessType?: string;
  businessCategory?: string;
  // License fields
  licenseNumber?: string;
  licenseType?: string;
  issueDate?: string;
  expiryDate?: string;
  // Vehicle cert fields
  plateNumber?: string;
  vehicleType?: string;
  vehicleOwnerName?: string;
  // Transport contract fields
  contractCompanyName?: string;
  contractDate?: string;
  signatureName?: string;
  verificationPhone?: string;
  contractConsent?: string;
}

interface BankAccountData {
  id: number;
  userId: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  bankbookImageUrl?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

interface SettlementSummary {
  year: number;
  month: number;
  orderCount: number;
  supplyPrice: number;
  vat: number;
  totalAmount: number;
  platformFee: number;
  deductions: number;
  driverPayout: number;
}

interface TaxInvoice {
  id: number;
  targetId: string;
  targetType: string;
  year: number;
  month: number;
  status: 'pending' | 'issued' | 'cancelled';
  issuedAt?: string;
  businessNumber?: string;
  businessName?: string;
  totalAmount?: number;
}

interface HelperDetail {
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    dailyStatus?: string;
    isTeamLeader?: boolean;
    helperVerified?: boolean;
    helperVerifiedAt?: string;
    onboardingStatus?: string;
    createdAt: string;
  };
  credential?: {
    helperCode?: string;
  };
  vehicles?: {
    plateNumber?: string;
    vehicleType?: string;
    vehicleImageUrl?: string;
  }[];
  business?: {
    businessNumber?: string;
    businessName?: string;
    representativeName?: string;
    address?: string;
    businessType?: string;
    businessCategory?: string;
    email?: string;
    businessImageUrl?: string;
  };
  bankAccount?: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    bankbookImageUrl?: string;
  };
  license?: {
    driverLicenseImageUrl?: string;
    cargoLicenseImageUrl?: string;
  };
  termsAgreement?: {
    agreedAt?: string;
    signatureImageUrl?: string;
    requiredTermsAgreed?: boolean;
    optionalTermsAgreed?: boolean;
    marketingAgreed?: boolean;
  };
  teamInfo?: {
    teamId: number;
    teamName: string;
    isLeader: boolean;
    leaderName: string;
  };
}

const DOCUMENT_TYPE_LABELS = {
  businessCert: '사업자등록증',
  driverLicense: '운전면허증',
  cargoLicense: '화물운송자격증',
  vehicleCert: '차량등록증',
  transportContract: '화물위탁계약서',
};

const STATUS_ICONS = {
  not_submitted: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-100', label: '미제출' },
  pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: '검토대기' },
  reviewing: { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100', label: '검토중' },
  approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: '승인완료' },
  rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: '반려됨' },
};

export default function HelperDetailPage() {
  const { helperId } = useParams<{ helperId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    type: 'document' | 'bank';
    action: 'approve' | 'reject';
    id: number;
    label: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: helperDetail, isLoading } = useQuery<HelperDetail>({
    queryKey: ['admin-helper-detail', helperId],
    queryFn: async () => {
      if (!helperId) throw new Error('No helper ID');
      return apiRequest<HelperDetail>(`/helpers/${helperId}/detail`);
    },
    enabled: !!helperId,
  });

  // 서류 목록 조회
  const { data: documents = [] } = useQuery<DocumentData[]>({
    queryKey: ['helper-documents', helperId],
    queryFn: async () => {
      if (!helperId) return [];
      const response = await apiRequest<{ document: DocumentData; user: any }[]>(
        `/helper-documents?userId=${helperId}`
      );
      return response.map(item => item.document);
    },
    enabled: !!helperId,
  });

  // 통장 정보 조회
  const { data: bankAccountData } = useQuery<BankAccountData | null>({
    queryKey: ['helper-bank-account', helperId],
    queryFn: async () => {
      if (!helperId) return null;
      try {
        const allAccounts = await apiRequest<BankAccountData[]>('/helper-bank-accounts');
        return allAccounts.find(acc => acc.userId === helperId) || null;
      } catch {
        return null;
      }
    },
    enabled: !!helperId,
  });

  // 정산 정보 조회 (최근 2개월)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const { data: currentMonthSettlement } = useQuery<SettlementSummary | null>({
    queryKey: ['helper-settlement', helperId, currentYear, currentMonth + 1],
    queryFn: async () => {
      if (!helperId) return null;
      try {
        const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
        const data = await apiRequest<any[]>(`/settlements/helper?startDate=${startDate}&endDate=${endDate}`);
        const helperData = data.find(s => s.helperId === helperId || s.helperId === parseInt(helperId));
        return helperData || null;
      } catch {
        return null;
      }
    },
    enabled: !!helperId,
  });

  const { data: lastMonthSettlement } = useQuery<SettlementSummary | null>({
    queryKey: ['helper-settlement', helperId, lastMonthYear, lastMonth + 1],
    queryFn: async () => {
      if (!helperId) return null;
      try {
        const startDate = new Date(lastMonthYear, lastMonth, 1).toISOString().split('T')[0];
        const endDate = new Date(lastMonthYear, lastMonth + 1, 0).toISOString().split('T')[0];
        const data = await apiRequest<any[]>(`/settlements/helper?startDate=${startDate}&endDate=${endDate}`);
        const helperData = data.find(s => s.helperId === helperId || s.helperId === parseInt(helperId));
        return helperData || null;
      } catch {
        return null;
      }
    },
    enabled: !!helperId,
  });

  // 세금계산서 조회
  const { data: taxInvoices = [] } = useQuery<TaxInvoice[]>({
    queryKey: ['helper-tax-invoices', helperId],
    queryFn: async () => {
      if (!helperId) return [];
      try {
        const data = await apiRequest<TaxInvoice[]>(`/tax-invoices?targetType=helper&targetId=${helperId}`);
        return data;
      } catch {
        return [];
      }
    },
    enabled: !!helperId,
  });

  // 서류 승인
  const approveDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/helper-documents/${id}/approve`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-documents', helperId] });
      queryClient.invalidateQueries({ queryKey: ['admin-helper-detail', helperId] });
      toast({ title: '승인 완료', description: '서류가 승인되었습니다', variant: 'success' });
      setReviewDialog(null);
    },
    onError: () => {
      toast({ title: '오류', description: '승인 처리에 실패했습니다', variant: 'error' });
    },
  });

  // 서류 반려
  const rejectDocumentMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return apiRequest(`/helper-documents/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ rejectionReason: reason }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-documents', helperId] });
      queryClient.invalidateQueries({ queryKey: ['admin-helper-detail', helperId] });
      toast({ title: '반려 완료', description: '서류가 반려되었습니다', variant: 'success' });
      setReviewDialog(null);
      setRejectionReason('');
    },
    onError: () => {
      toast({ title: '오류', description: '반려 처리에 실패했습니다', variant: 'error' });
    },
  });

  // 통장 승인
  const approveBankMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/helper-bank-accounts/${id}/verify`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-bank-account', helperId] });
      toast({ title: '승인 완료', description: '통장 정보가 승인되었습니다', variant: 'success' });
      setReviewDialog(null);
    },
    onError: () => {
      toast({ title: '오류', description: '승인 처리에 실패했습니다', variant: 'error' });
    },
  });

  // 통장 반려
  const rejectBankMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return apiRequest(`/helper-bank-accounts/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-bank-account', helperId] });
      toast({ title: '반려 완료', description: '통장 정보가 반려되었습니다', variant: 'success' });
      setReviewDialog(null);
      setRejectionReason('');
    },
    onError: () => {
      toast({ title: '오류', description: '반려 처리에 실패했습니다', variant: 'error' });
    },
  });

  const handleReviewSubmit = () => {
    if (!reviewDialog) return;

    if (reviewDialog.action === 'approve') {
      if (reviewDialog.type === 'document') {
        approveDocumentMutation.mutate(reviewDialog.id);
      } else {
        approveBankMutation.mutate(reviewDialog.id);
      }
    } else {
      if (!rejectionReason.trim()) {
        toast({ title: '알림', description: '반려 사유를 입력해주세요', variant: 'warning' });
        return;
      }
      if (reviewDialog.type === 'document') {
        rejectDocumentMutation.mutate({ id: reviewDialog.id, reason: rejectionReason });
      } else {
        rejectBankMutation.mutate({ id: reviewDialog.id, reason: rejectionReason });
      }
    }
  };

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:')) return path;
    const token = localStorage.getItem('admin_token');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    if (path.startsWith('/uploads/')) return `${path}${tokenParam}`;
    if (path.startsWith('/api/')) return path;
    return `/uploads/${path}${tokenParam}`;
  };

  const generateHelperCode = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const code = String(hash).padStart(12, '0').slice(-12);
    return code;
  };

  const downloadExcel = () => {
    if (!helperDetail) return;
    const { user, business, bankAccount, vehicles, termsAgreement } = helperDetail;
    const vehicle = vehicles?.[0];
    
    const headers = [
      '항목', '내용'
    ];
    
    const rows = [
      ['이름', user.name || '-'],
      ['전화번호', user.phoneNumber || '-'],
      ['이메일', user.email || '-'],
      ['주소', business?.address || '-'],
      ['헬퍼고유번호', generateHelperCode(user.id)],
      ['사업자등록번호', business?.businessNumber || '-'],
      ['상호명', business?.businessName || '-'],
      ['대표자명', business?.representativeName || '-'],
      ['업태', business?.businessType || '-'],
      ['업종', business?.businessCategory || '-'],
      ['은행명', bankAccount?.bankName || bankAccountData?.bankName || '-'],
      ['계좌번호', bankAccount?.accountNumber || bankAccountData?.accountNumber || '-'],
      ['예금주', bankAccount?.accountHolder || bankAccountData?.accountHolder || '-'],
      ['차량번호', vehicle?.plateNumber || '-'],
      ['차종', vehicle?.vehicleType || '-'],
      ['필수동의', termsAgreement?.requiredTermsAgreed ? 'O' : 'X'],
      ['선택동의', termsAgreement?.optionalTermsAgreed ? 'O' : 'X'],
      ['마케팅동의', termsAgreement?.marketingAgreed ? 'O' : 'X'],
      ['가입일', user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'],
    ];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `헬퍼정보_${user.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!helperDetail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-1" />뒤로가기
        </Button>
        <p className="text-muted-foreground">헬퍼 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const { user, business, bankAccount, license, vehicles, termsAgreement } = helperDetail;
  const vehicle = vehicles?.[0];
  const helperCode = generateHelperCode(user.id);

  // 서류에서 정보 추출 (documents 배열 활용)
  const businessCertDoc = documents.find(d => d.documentType === 'businessCert');
  const vehicleCertDoc = documents.find(d => d.documentType === 'vehicleCert');

  // 서류 데이터가 있으면 우선 사용, 없으면 기존 데이터 사용
  const businessInfo = {
    businessNumber: businessCertDoc?.businessNumber || business?.businessNumber,
    businessName: businessCertDoc?.businessName || business?.businessName,
    representativeName: businessCertDoc?.representativeName || business?.representativeName,
    businessType: businessCertDoc?.businessType || business?.businessType,
    businessCategory: businessCertDoc?.businessCategory || business?.businessCategory,
    email: business?.email,
  };

  const vehicleInfo = {
    plateNumber: vehicleCertDoc?.plateNumber || vehicle?.plateNumber,
    vehicleType: vehicleCertDoc?.vehicleType || vehicle?.vehicleType,
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-3 border-b last:border-b-0">
      <div className="bg-muted/50 px-4 py-3 font-medium text-sm border-r">{label}</div>
      <div className="col-span-2 px-4 py-3 text-sm">{value || '-'}</div>
    </div>
  );

  const ImageCard = ({ label, url, alt }: { label: string; url: string | null | undefined; alt: string }) => {
    const imageUrl = getImageUrl(url);
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b">{label}</div>
        <div className="p-3 min-h-[150px] flex items-center justify-center bg-background">
          {imageUrl ? (
            <div 
              className="relative cursor-pointer group"
              onClick={() => setSelectedImage(imageUrl)}
            >
              <img 
                src={imageUrl} 
                alt={alt} 
                className="max-h-[120px] max-w-full object-contain rounded"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <ZoomIn className="h-6 w-6 text-white" />
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
              <FileImage className="h-8 w-8 opacity-30" />
              <span>미등록</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AgreementBadge = ({ agreed }: { agreed?: boolean }) => (
    agreed ? (
      <Badge variant="default" className="gap-1"><Check className="h-3 w-3" />동의</Badge>
    ) : (
      <Badge variant="secondary" className="gap-1"><X className="h-3 w-3" />미동의</Badge>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />뒤로가기
          </Button>
          <div>
            <h1 className="text-2xl font-bold">헬퍼 상세정보</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button onClick={downloadExcel} className="gap-2">
          <Download className="h-4 w-4" />
          엑셀 다운로드
        </Button>
      </div>

      {/* 전체 정보를 하나의 테이블로 통합 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">헬퍼 전체 정보</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            {/* 기본 정보 */}
            <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-b">기본 정보</div>
            <div className="grid grid-cols-2 lg:grid-cols-4">
              <InfoRow label="이름" value={user.name} />
              <InfoRow label="전화번호" value={user.phoneNumber} />
              <InfoRow label="이메일" value={user.email} />
              <InfoRow label="가입일" value={
                user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'
              } />
            </div>
            <div className="grid grid-cols-1 border-t">
              <InfoRow label="주소" value={business?.address} />
              <InfoRow label="헬퍼고유번호" value={
                <span className="font-mono text-primary font-semibold">{helperCode}</span>
              } />
            </div>

            {/* 사업자 정보 */}
            <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-t">사업자 등록정보</div>
            <div className="grid grid-cols-2 lg:grid-cols-3">
              <InfoRow label="사업자등록번호" value={businessInfo.businessNumber} />
              <InfoRow label="상호명" value={businessInfo.businessName} />
              <InfoRow label="대표자명" value={businessInfo.representativeName} />
              <InfoRow label="업태" value={businessInfo.businessType} />
              <InfoRow label="업종" value={businessInfo.businessCategory} />
              <InfoRow label="사업자 이메일" value={businessInfo.email} />
            </div>

            {/* 계좌 및 차량 정보 */}
            <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-t">계좌 및 차량 정보</div>
            <div className="grid grid-cols-2 lg:grid-cols-5">
              <InfoRow label="은행명" value={bankAccount?.bankName || bankAccountData?.bankName} />
              <div className="col-span-2">
                <InfoRow label="계좌번호" value={
                  <span className="font-mono">{bankAccount?.accountNumber || bankAccountData?.accountNumber}</span>
                } />
              </div>
              <InfoRow label="예금주" value={bankAccount?.accountHolder || bankAccountData?.accountHolder} />
              <InfoRow label="차량번호" value={vehicleInfo.plateNumber} />
              <InfoRow label="차종" value={vehicleInfo.vehicleType} />
            </div>

            {/* 동의 현황 */}
            <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-t">동의 현황</div>
            <div className="grid grid-cols-3">
              <div className="px-4 py-3 border-r">
                <div className="text-xs text-muted-foreground mb-1">필수 동의</div>
                <AgreementBadge agreed={termsAgreement?.requiredTermsAgreed} />
              </div>
              <div className="px-4 py-3 border-r">
                <div className="text-xs text-muted-foreground mb-1">선택 동의</div>
                <AgreementBadge agreed={termsAgreement?.optionalTermsAgreed} />
              </div>
              <div className="px-4 py-3">
                <div className="text-xs text-muted-foreground mb-1">마케팅 동의</div>
                <AgreementBadge agreed={termsAgreement?.marketingAgreed} />
              </div>
            </div>
            {termsAgreement?.agreedAt && (
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
                동의일시: {new Date(termsAgreement.agreedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 서류 검토 섹션 - 그리드 레이아웃 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              제출 서류 현황
            </CardTitle>
            {/* 요약 통계 */}
            <div className="flex gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">승인: </span>
                <span className="font-semibold text-green-600">
                  {documents.filter(d => d.status === 'approved').length + (bankAccountData?.verificationStatus === 'verified' ? 1 : 0)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">검토: </span>
                <span className="font-semibold text-yellow-600">
                  {documents.filter(d => d.status === 'reviewing' || d.status === 'pending').length + (bankAccountData?.verificationStatus === 'pending' ? 1 : 0)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">미제출: </span>
                <span className="font-semibold text-gray-600">
                  {5 - documents.length + (bankAccountData ? 0 : 1)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 그리드 레이아웃으로 서류 표시 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 서류 목록 */}
            {(['businessCert', 'driverLicense', 'cargoLicense', 'vehicleCert', 'transportContract'] as const).map((docType) => {
              const doc = documents.find(d => d.documentType === docType);
              const status = doc?.status || 'not_submitted';
              const StatusConfig = STATUS_ICONS[status];
              const StatusIcon = StatusConfig.icon;

              return (
                <div key={docType} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  {/* 헤더 */}
                  <div className={`px-3 py-2 ${StatusConfig.bg} border-b flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${StatusConfig.color}`} />
                      <span className="font-medium text-sm">{DOCUMENT_TYPE_LABELS[docType]}</span>
                    </div>
                    <Badge variant="outline" className={`${StatusConfig.color} text-xs`}>
                      {StatusConfig.label}
                    </Badge>
                  </div>

                  {/* 내용 */}
                  <div className="p-3 bg-background">
                    {doc?.uploadedAt && (
                      <p className="text-xs text-muted-foreground mb-2">
                        제출: {new Date(doc.uploadedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </p>
                    )}

                    {doc?.rejectionReason && (
                      <p className="text-xs text-red-600 mb-2 line-clamp-2" title={doc.rejectionReason}>
                        반려: {doc.rejectionReason}
                      </p>
                    )}

                    {/* 액션 버튼 */}
                    {doc && (status === 'reviewing' || status === 'pending') && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 flex-1"
                          onClick={() => setReviewDialog({
                            open: true,
                            type: 'document',
                            action: 'approve',
                            id: doc.id,
                            label: DOCUMENT_TYPE_LABELS[docType]
                          })}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 flex-1"
                          onClick={() => setReviewDialog({
                            open: true,
                            type: 'document',
                            action: 'reject',
                            id: doc.id,
                            label: DOCUMENT_TYPE_LABELS[docType]
                          })}
                        >
                          <X className="h-3 w-3 mr-1" />
                          반려
                        </Button>
                      </div>
                    )}

                    {status === 'not_submitted' && (
                      <p className="text-xs text-muted-foreground italic">미제출</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 수수료 통장 */}
            <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-blue-50/30">
              {/* 헤더 */}
              <div className={`px-3 py-2 border-b flex items-center justify-between ${
                bankAccountData?.verificationStatus === 'verified' ? 'bg-green-100' :
                bankAccountData?.verificationStatus === 'rejected' ? 'bg-red-100' :
                bankAccountData?.verificationStatus === 'pending' ? 'bg-yellow-100' :
                'bg-gray-100'
              }`}>
                <div className="flex items-center gap-2">
                  {bankAccountData?.verificationStatus === 'verified' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : bankAccountData?.verificationStatus === 'rejected' ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : bankAccountData?.verificationStatus === 'pending' ? (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="font-medium text-sm">수수료 통장</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {bankAccountData?.verificationStatus === 'verified' ? '승인완료' :
                   bankAccountData?.verificationStatus === 'rejected' ? '반려됨' :
                   bankAccountData?.verificationStatus === 'pending' ? '검토대기' :
                   '미제출'}
                </Badge>
              </div>

              {/* 내용 */}
              <div className="p-3 bg-background">
                {bankAccountData ? (
                  <>
                    <p className="text-xs mb-1">
                      <span className="text-muted-foreground">은행:</span> {bankAccountData.bankName}
                    </p>
                    <p className="text-xs mb-1 font-mono">
                      <span className="text-muted-foreground">계좌:</span> {bankAccountData.accountNumber}
                    </p>
                    <p className="text-xs mb-2">
                      <span className="text-muted-foreground">예금주:</span> {bankAccountData.accountHolder}
                    </p>

                    {/* 액션 버튼 */}
                    {bankAccountData.verificationStatus === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 flex-1"
                          onClick={() => setReviewDialog({
                            open: true,
                            type: 'bank',
                            action: 'approve',
                            id: bankAccountData.id,
                            label: '수수료 통장'
                          })}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 flex-1"
                          onClick={() => setReviewDialog({
                            open: true,
                            type: 'bank',
                            action: 'reject',
                            id: bankAccountData.id,
                            label: '수수료 통장'
                          })}
                        >
                          <X className="h-3 w-3 mr-1" />
                          반려
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">미제출</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 정산 및 세금계산서 정보 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            정산 정보 및 세금계산서
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            {/* 통계 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/20">
              <div className="bg-background p-4 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">이번 달 오더</div>
                <div className="text-2xl font-bold text-primary">
                  {currentMonthSettlement?.orderCount || 0}건
                </div>
              </div>
              <div className="bg-background p-4 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">이번 달 정산금</div>
                <div className="text-2xl font-bold text-green-600">
                  {(currentMonthSettlement?.driverPayout || 0).toLocaleString()}원
                </div>
              </div>
              <div className="bg-background p-4 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">지난 달 오더</div>
                <div className="text-2xl font-bold">
                  {lastMonthSettlement?.orderCount || 0}건
                </div>
              </div>
              <div className="bg-background p-4 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">지난 달 정산금</div>
                <div className="text-2xl font-bold">
                  {(lastMonthSettlement?.driverPayout || 0).toLocaleString()}원
                </div>
              </div>
            </div>

            {/* 이번 달 정산 상세 */}
            {currentMonthSettlement && (
              <>
                <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-t">
                  이번 달 정산 상세 ({currentYear}년 {currentMonth + 1}월)
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4">
                  <InfoRow label="공급가액" value={`${currentMonthSettlement.supplyPrice.toLocaleString()}원`} />
                  <InfoRow label="부가세" value={`${currentMonthSettlement.vat.toLocaleString()}원`} />
                  <InfoRow label="총액" value={`${currentMonthSettlement.totalAmount.toLocaleString()}원`} />
                  <InfoRow label="플랫폼 수수료" value={`${currentMonthSettlement.platformFee.toLocaleString()}원`} />
                  <InfoRow label="차감액" value={`${currentMonthSettlement.deductions.toLocaleString()}원`} />
                  <InfoRow label="헬퍼 정산금" value={
                    <span className="font-semibold text-green-600">
                      {currentMonthSettlement.driverPayout.toLocaleString()}원
                    </span>
                  } />
                </div>
              </>
            )}

            {/* 지난 달 정산 상세 */}
            {lastMonthSettlement && (
              <>
                <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-t">
                  지난 달 정산 상세 ({lastMonthYear}년 {lastMonth + 1}월)
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4">
                  <InfoRow label="공급가액" value={`${lastMonthSettlement.supplyPrice.toLocaleString()}원`} />
                  <InfoRow label="부가세" value={`${lastMonthSettlement.vat.toLocaleString()}원`} />
                  <InfoRow label="총액" value={`${lastMonthSettlement.totalAmount.toLocaleString()}원`} />
                  <InfoRow label="플랫폼 수수료" value={`${lastMonthSettlement.platformFee.toLocaleString()}원`} />
                  <InfoRow label="차감액" value={`${lastMonthSettlement.deductions.toLocaleString()}원`} />
                  <InfoRow label="헬퍼 정산금" value={
                    <span className="font-semibold">
                      {lastMonthSettlement.driverPayout.toLocaleString()}원
                    </span>
                  } />
                </div>
              </>
            )}

            {/* 세금계산서 발행 현황 */}
            <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-t">
              세금계산서 발행 현황
            </div>
            <div className="p-4">
              {taxInvoices.length > 0 ? (
                <div className="space-y-2">
                  {taxInvoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="font-medium">
                            {invoice.year}년 {invoice.month}월
                          </div>
                          {invoice.businessName && (
                            <div className="text-xs text-muted-foreground">
                              {invoice.businessName} ({invoice.businessNumber})
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {invoice.totalAmount && (
                          <div className="text-sm font-medium">
                            {invoice.totalAmount.toLocaleString()}원
                          </div>
                        )}
                        <Badge variant={
                          invoice.status === 'issued' ? 'default' :
                          invoice.status === 'pending' ? 'secondary' :
                          'destructive'
                        }>
                          {invoice.status === 'issued' ? '발행완료' :
                           invoice.status === 'pending' ? '대기중' :
                           '취소됨'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {taxInvoices.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      외 {taxInvoices.length - 5}건
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  세금계산서 발행 내역이 없습니다
                </p>
              )}
            </div>

            {/* 정산 메모 */}
            {!currentMonthSettlement && !lastMonthSettlement && (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">정산 내역이 없습니다</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">이미지 파일</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <ImageCard
              label="사업자등록증"
              url={business?.businessImageUrl || documents.find(d => d.documentType === 'businessCert')?.imageUrl}
              alt="사업자등록증"
            />
            <ImageCard
              label="차량 이미지"
              url={vehicle?.vehicleImageUrl || documents.find(d => d.documentType === 'vehicleCert')?.imageUrl}
              alt="차량 이미지"
            />
            <ImageCard
              label="운전면허증"
              url={license?.driverLicenseImageUrl || documents.find(d => d.documentType === 'driverLicense')?.imageUrl}
              alt="운전면허증"
            />
            <ImageCard
              label="화물운송자격증"
              url={license?.cargoLicenseImageUrl || documents.find(d => d.documentType === 'cargoLicense')?.imageUrl}
              alt="화물운송자격증"
            />
            <ImageCard
              label="계약서 (서명)"
              url={termsAgreement?.signatureImageUrl || documents.find(d => d.documentType === 'transportContract')?.imageUrl}
              alt="계약서 서명"
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          {selectedImage && (
            <img src={selectedImage} alt="확대 이미지" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>

      {/* 승인/반려 확인 다이얼로그 */}
      <Dialog open={!!reviewDialog} onOpenChange={() => {
        setReviewDialog(null);
        setRejectionReason('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === 'approve' ? '승인 확인' : '반려 확인'}
            </DialogTitle>
          </DialogHeader>

          {reviewDialog && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">헬퍼</p>
                <p className="font-medium">{user?.name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">서류/항목</p>
                <p className="font-medium">{reviewDialog.label}</p>
              </div>

              {reviewDialog.action === 'reject' && (
                <div>
                  <Label htmlFor="rejection-reason">반려 사유 *</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="반려 사유를 입력하세요"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                  />
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {reviewDialog.action === 'approve'
                  ? '이 서류를 승인하시겠습니까?'
                  : '이 서류를 반려하시겠습니까?'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialog(null);
                setRejectionReason('');
              }}
            >
              취소
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={
                approveDocumentMutation.isPending ||
                rejectDocumentMutation.isPending ||
                approveBankMutation.isPending ||
                rejectBankMutation.isPending
              }
              variant={reviewDialog?.action === 'approve' ? 'default' : 'destructive'}
            >
              {approveDocumentMutation.isPending || rejectDocumentMutation.isPending ||
               approveBankMutation.isPending || rejectBankMutation.isPending
                ? '처리중...'
                : reviewDialog?.action === 'approve' ? '승인' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
