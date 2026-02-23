import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, Download, FileImage, Check, X, ZoomIn,
  User, Building2, Wallet, ClipboardList, History, ShieldAlert,
  CheckCircle, XCircle, Clock, AlertCircle, AlertTriangle, Ban
} from 'lucide-react';

// === 타입 ===
interface RequesterDetail {
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    address?: string;
    profileImageUrl?: string;
    onboardingStatus?: string;
    onboardingReviewedAt?: string;
    onboardingRejectReason?: string;
    requesterCode: string;
    createdAt: string;
  };
  orderStats?: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  business?: {
    businessNumber?: string;
    businessName?: string;
    representativeName?: string;
    address?: string;
    businessType?: string;
    businessCategory?: string;
    businessImageUrl?: string;
    verificationStatus?: string;
  };
  serviceAgreement?: {
    contractAgreed?: boolean;
    depositAmount?: number;
    balanceAmount?: number;
    balanceDueDate?: string;
    signatureData?: string;
    phoneNumber?: string;
    phoneVerified?: boolean;
    agreedAt?: string;
  };
  refundAccount?: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  signupConsent?: {
    termsAgreed: boolean;
    privacyAgreed: boolean;
    locationAgreed: boolean;
    paymentAgreed: boolean;
    liabilityAgreed: boolean;
    electronicAgreed: boolean;
    marketingAgreed?: boolean;
    agreedAt?: string;
  };
  sanctions?: {
    id: number;
    sanctionType: string;
    reason: string;
    evidence?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
    createdBy?: string;
    createdByName?: string;
    createdAt?: string;
  }[];
  orderHistory?: {
    id: number;
    orderNumber?: string | null;
    status?: string;
    createdAt?: string;
    closedAt?: string;
    companyName?: string;
    deliveryArea?: string;
  }[];
}

// === 상수 ===
const ONBOARDING_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '대기중', color: 'bg-gray-100 text-gray-700', icon: Clock },
  not_submitted: { label: '미제출', color: 'bg-gray-100 text-gray-500', icon: AlertCircle },
  reviewing: { label: '검토중', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: '승인완료', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: '반려됨', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const SANCTION_TYPES: Record<string, { label: string; color: string; icon: any }> = {
  warning: { label: '경고', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  suspension: { label: '정지', color: 'bg-orange-100 text-orange-800', icon: Ban },
  blacklist: { label: '블랙리스트', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  awaiting_deposit: { label: '입금대기', color: 'bg-gray-100 text-gray-700' },
  registered: { label: '등록완료', color: 'bg-blue-100 text-blue-700' },
  matching: { label: '매칭중', color: 'bg-purple-100 text-purple-700' },
  scheduled: { label: '배정완료', color: 'bg-indigo-100 text-indigo-700' },
  in_progress: { label: '진행중', color: 'bg-cyan-100 text-cyan-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-700' },
  closing_submitted: { label: '마감제출', color: 'bg-teal-100 text-teal-700' },
  dispute_requested: { label: '분쟁요청', color: 'bg-orange-100 text-orange-700' },
  settled: { label: '정산완료', color: 'bg-emerald-100 text-emerald-700' },
};

function formatOrderNumber(orderNumber: string | null | undefined, orderId: number): string {
  if (orderNumber) {
    if (orderNumber.length === 12) {
      return `${orderNumber.slice(0, 1)}-${orderNumber.slice(1, 4)}-${orderNumber.slice(4, 8)}-${orderNumber.slice(8, 12)}`;
    }
    return orderNumber;
  }
  return `#${orderId}`;
}

// === 컴포넌트 ===
export default function RequesterDetailPage() {
  const { requesterId } = useParams<{ requesterId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showSanctionDialog, setShowSanctionDialog] = useState(false);
  const [sanctionType, setSanctionType] = useState<string>('warning');
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionDays, setSanctionDays] = useState('');

  const { data: detail, isLoading } = useQuery<RequesterDetail>({
    queryKey: ['admin-requester-detail', requesterId],
    queryFn: async () => {
      if (!requesterId) throw new Error('No requester ID');
      return apiRequest<RequesterDetail>(`/requesters/${requesterId}/detail`);
    },
    enabled: !!requesterId,
  });

  // 제재 부과 mutation
  const sanctionMutation = useMutation({
    mutationFn: async (data: { sanctionType: string; reason: string; durationDays?: number }) => {
      return apiRequest('/sanctions', {
        method: 'POST',
        body: JSON.stringify({ userId: requesterId, ...data }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requester-detail', requesterId] });
      toast({ title: '제재 부과 완료', description: '제재가 성공적으로 부과되었습니다', variant: 'success' });
      setShowSanctionDialog(false);
      setSanctionType('warning');
      setSanctionReason('');
      setSanctionDays('');
    },
    onError: () => {
      toast({ title: '오류', description: '제재 부과에 실패했습니다', variant: 'error' });
    },
  });

  // 제재 해제 mutation
  const liftSanctionMutation = useMutation({
    mutationFn: async (sanctionId: number) => {
      return apiRequest(`/sanctions/${sanctionId}/lift`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requester-detail', requesterId] });
      toast({ title: '제재 해제', description: '제재가 해제되었습니다', variant: 'success' });
    },
    onError: () => {
      toast({ title: '오류', description: '제재 해제에 실패했습니다', variant: 'error' });
    },
  });

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

  const downloadExcel = () => {
    if (!detail) return;
    const { user, business, refundAccount } = detail;
    const rows = [
      ['이름', user.name || '-'],
      ['전화번호', user.phoneNumber || '-'],
      ['이메일', user.email || '-'],
      ['주소', user.address || business?.address || '-'],
      ['요청자고유번호', user.requesterCode],
      ['온보딩상태', ONBOARDING_STATUS[user.onboardingStatus || 'pending']?.label || '-'],
      ['사업자등록번호', business?.businessNumber || '-'],
      ['상호명', business?.businessName || '-'],
      ['대표자명', business?.representativeName || '-'],
      ['업태', business?.businessType || '-'],
      ['업종', business?.businessCategory || '-'],
      ['은행명', refundAccount?.bankName || '-'],
      ['계좌번호', refundAccount?.accountNumber || '-'],
      ['예금주', refundAccount?.accountHolder || '-'],
      ['가입일', user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'],
    ];
    const csvContent = [['항목', '내용'], ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `요청자정보_${user.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-1" />뒤로가기
        </Button>
        <p className="text-muted-foreground">요청자 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const { user, business, refundAccount, orderStats, signupConsent, sanctions, orderHistory } = detail;
  const statusConfig = ONBOARDING_STATUS[user.onboardingStatus || 'pending'] || ONBOARDING_STATUS.pending;
  const StatusIcon = statusConfig.icon;
  const activeSanctions = sanctions?.filter(s => s.isActive) || [];
  const hasActiveSanction = activeSanctions.length > 0;

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-3 border-b last:border-b-0">
      <div className="bg-muted/50 px-4 py-3 font-medium text-sm border-r">{label}</div>
      <div className="col-span-2 px-4 py-3 text-sm">{value || <span className="text-muted-foreground">-</span>}</div>
    </div>
  );

  const ConsentItem = ({ label, agreed, required }: { label: string; agreed: boolean; required: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={required ? 'text-red-600 border-red-200 text-xs' : 'text-gray-500 border-gray-200 text-xs'}>
          {required ? '필수' : '선택'}
        </Badge>
        <span className="text-sm">{label}</span>
      </div>
      {agreed ? (
        <Badge className="bg-green-100 text-green-700 border-0 gap-1"><Check className="h-3 w-3" />동의</Badge>
      ) : (
        <Badge className="bg-gray-100 text-gray-500 border-0 gap-1"><X className="h-3 w-3" />미동의</Badge>
      )}
    </div>
  );

  const ImageCard = ({ label, url, alt }: { label: string; url: string | null | undefined; alt: string }) => {
    const imageUrl = getImageUrl(url);
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b">{label}</div>
        <div className="p-3 min-h-[180px] flex items-center justify-center bg-background">
          {imageUrl ? (
            <div className="relative cursor-pointer group" onClick={() => setSelectedImage(imageUrl)}>
              <img src={imageUrl} alt={alt} className="max-h-[160px] max-w-full object-contain rounded" />
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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />뒤로
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
              {user.profileImageUrl ? (
                <img src={getImageUrl(user.profileImageUrl) || ''} alt="프로필" className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{user.name}</h1>
                <Badge className={`${statusConfig.color} gap-1 border-0`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
                {hasActiveSanction && (
                  <Badge className="bg-red-100 text-red-700 border-0 gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    {SANCTION_TYPES[activeSanctions[0].sanctionType]?.label || '제재중'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user.email} · {user.phoneNumber || '-'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-yellow-700 border-yellow-300 hover:bg-yellow-50" onClick={() => { setSanctionType('warning'); setShowSanctionDialog(true); }}>
            <AlertTriangle className="h-4 w-4 mr-1" />경고
          </Button>
          <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-50" onClick={() => { setSanctionType('suspension'); setShowSanctionDialog(true); }}>
            <Ban className="h-4 w-4 mr-1" />정지
          </Button>
          <Button size="sm" variant="outline" onClick={downloadExcel}>
            <Download className="h-4 w-4 mr-1" />엑셀
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">전체 오더</div>
          <div className="text-2xl font-bold mt-1">{orderStats?.total || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">진행중</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{orderStats?.active || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">완료</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{orderStats?.completed || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">취소</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{orderStats?.cancelled || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">가입일</div>
          <div className="text-lg font-semibold mt-1">
            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
          </div>
        </Card>
      </div>

      {/* 활성 제재 배너 */}
      {hasActiveSanction && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 px-4">
            {activeSanctions.map(s => {
              const typeConfig = SANCTION_TYPES[s.sanctionType] || SANCTION_TYPES.warning;
              const TypeIcon = typeConfig.icon;
              return (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-start gap-2">
                    <TypeIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${typeConfig.color} border-0 text-xs`}>{typeConfig.label}</Badge>
                        <span className="text-sm font-medium text-red-700">{s.reason}</span>
                      </div>
                      <p className="text-xs text-red-400 mt-1">
                        {s.startDate} ~ {s.endDate || '무기한'}
                        {s.createdByName && ` · 부과자: ${s.createdByName}`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => liftSanctionMutation.mutate(s.id)} disabled={liftSanctionMutation.isPending}>
                    해제
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 탭 */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info" className="gap-1"><User className="h-4 w-4" />기본정보</TabsTrigger>
          <TabsTrigger value="business" className="gap-1"><Building2 className="h-4 w-4" />사업자정보</TabsTrigger>
          <TabsTrigger value="account" className="gap-1"><Wallet className="h-4 w-4" />환불계좌</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1"><ClipboardList className="h-4 w-4" />사용이력</TabsTrigger>
          <TabsTrigger value="sanctions" className="gap-1">
            <ShieldAlert className="h-4 w-4" />제재이력
            {(sanctions?.length || 0) > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">{sanctions?.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 기본정보 탭 */}
        <TabsContent value="info">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5" />기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t">
                  <InfoRow label="이름" value={user.name} />
                  <InfoRow label="전화번호" value={user.phoneNumber} />
                  <InfoRow label="이메일" value={user.email} />
                  <InfoRow label="주소" value={user.address || business?.address} />
                  <InfoRow label="요청자 고유번호" value={
                    <span className="font-mono text-primary font-semibold">{user.requesterCode}</span>
                  } />
                  <InfoRow label="온보딩 상태" value={
                    <Badge className={`${statusConfig.color} gap-1 border-0`}>
                      <StatusIcon className="h-3 w-3" />{statusConfig.label}
                    </Badge>
                  } />
                  <InfoRow label="가입일" value={
                    user.createdAt ? new Date(user.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'
                  } />
                </div>
              </CardContent>
            </Card>

            {/* 가입시 동의사항 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5" />가입시 동의사항</CardTitle>
              </CardHeader>
              <CardContent>
                {signupConsent ? (
                  <div className="space-y-0">
                    <ConsentItem label="서비스 이용약관" agreed={signupConsent.termsAgreed} required={true} />
                    <ConsentItem label="개인정보 수집·이용" agreed={signupConsent.privacyAgreed} required={true} />
                    <ConsentItem label="위치정보 수집·이용" agreed={signupConsent.locationAgreed} required={true} />
                    <ConsentItem label="결제·정산 정책" agreed={signupConsent.paymentAgreed} required={true} />
                    <ConsentItem label="책임 제한 동의" agreed={signupConsent.liabilityAgreed} required={true} />
                    <ConsentItem label="전자계약 및 고지" agreed={signupConsent.electronicAgreed} required={true} />
                    <ConsentItem label="마케팅 수신 동의" agreed={!!signupConsent.marketingAgreed} required={false} />
                    {signupConsent.agreedAt && (
                      <div className="pt-3 text-xs text-muted-foreground text-right">
                        동의일시: {new Date(signupConsent.agreedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-6">
                    <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>동의 정보가 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 사업자정보 탭 */}
        <TabsContent value="business">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" />사업자 등록정보</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {business ? (
                  <div className="border-t">
                    <InfoRow label="사업자등록번호" value={
                      <span className="font-mono">{business.businessNumber}</span>
                    } />
                    <InfoRow label="상호명" value={business.businessName} />
                    <InfoRow label="대표자명" value={business.representativeName} />
                    <InfoRow label="업태" value={business.businessType} />
                    <InfoRow label="업종" value={business.businessCategory} />
                    <InfoRow label="사업장 주소" value={business.address} />
                    <InfoRow label="인증 상태" value={
                      business.verificationStatus === 'verified' ? (
                        <Badge className="bg-green-100 text-green-700 border-0 gap-1"><CheckCircle className="h-3 w-3" />인증됨</Badge>
                      ) : business.verificationStatus === 'rejected' ? (
                        <Badge className="bg-red-100 text-red-700 border-0 gap-1"><XCircle className="h-3 w-3" />반려</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 border-0 gap-1"><Clock className="h-3 w-3" />대기</Badge>
                      )
                    } />
                  </div>
                ) : (
                  <div className="border-t p-8 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>등록된 사업자 정보가 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 사업자 이미지 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><FileImage className="h-5 w-5" />업로드 이미지</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <ImageCard label="프로필 이미지" url={user.profileImageUrl} alt="프로필" />
                  <ImageCard label="사업자등록증" url={business?.businessImageUrl} alt="사업자등록증" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 환불계좌 탭 */}
        <TabsContent value="account">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Wallet className="h-5 w-5" />환불 계좌</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {refundAccount ? (
                <div className="border-t">
                  <InfoRow label="은행명" value={refundAccount.bankName} />
                  <InfoRow label="계좌번호" value={
                    <span className="font-mono">{refundAccount.accountNumber}</span>
                  } />
                  <InfoRow label="예금주" value={refundAccount.accountHolder} />
                  <InfoRow label="등록일" value={
                    refundAccount.createdAt ? new Date(refundAccount.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'
                  } />
                </div>
              ) : (
                <div className="border-t p-8 text-center text-muted-foreground">
                  <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>등록된 환불 계좌가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 사용이력 탭 */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" />사용 이력</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orderHistory && orderHistory.length > 0 ? (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-4 py-3 text-left font-medium">날짜</th>
                        <th className="px-4 py-3 text-left font-medium">오더번호</th>
                        <th className="px-4 py-3 text-left font-medium">업체명</th>
                        <th className="px-4 py-3 text-left font-medium">배송지역</th>
                        <th className="px-4 py-3 text-left font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderHistory.map(order => {
                        const statusInfo = ORDER_STATUS[order.status || ''] || { label: order.status || '-', color: 'bg-gray-100 text-gray-700' };
                        return (
                          <tr key={order.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                            <td className="px-4 py-3">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-primary">{formatOrderNumber(order.orderNumber, order.id)}</span>
                            </td>
                            <td className="px-4 py-3">{order.companyName || '-'}</td>
                            <td className="px-4 py-3">{order.deliveryArea || '-'}</td>
                            <td className="px-4 py-3">
                              <Badge className={`${statusInfo.color} border-0 text-xs`}>{statusInfo.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border-t p-8 text-center text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>사용 이력이 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 제재이력 탭 */}
        <TabsContent value="sanctions">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><ShieldAlert className="h-5 w-5" />제재 이력</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowSanctionDialog(true)}>
                  제재 부과
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sanctions && sanctions.length > 0 ? (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-4 py-3 text-left font-medium">유형</th>
                        <th className="px-4 py-3 text-left font-medium">사유</th>
                        <th className="px-4 py-3 text-left font-medium">기간</th>
                        <th className="px-4 py-3 text-left font-medium">부과자</th>
                        <th className="px-4 py-3 text-left font-medium">상태</th>
                        <th className="px-4 py-3 text-left font-medium">조치</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sanctions.map(s => {
                        const typeConfig = SANCTION_TYPES[s.sanctionType] || SANCTION_TYPES.warning;
                        return (
                          <tr key={s.id} className="border-b">
                            <td className="px-4 py-3">
                              <Badge className={`${typeConfig.color} border-0 text-xs`}>{typeConfig.label}</Badge>
                            </td>
                            <td className="px-4 py-3 max-w-[300px]">{s.reason}</td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              {s.startDate || '-'} ~ {s.endDate || '무기한'}
                            </td>
                            <td className="px-4 py-3 text-xs">{s.createdByName || '-'}</td>
                            <td className="px-4 py-3">
                              {s.isActive ? (
                                <Badge className="bg-red-100 text-red-700 border-0 text-xs">활성</Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">해제됨</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {s.isActive && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => liftSanctionMutation.mutate(s.id)} disabled={liftSanctionMutation.isPending}>
                                  해제
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border-t p-8 text-center text-muted-foreground">
                  <ShieldAlert className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>제재 이력이 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 이미지 확대 다이얼로그 */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          {selectedImage && (
            <img src={selectedImage} alt="확대 이미지" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>

      {/* 제재 부과 다이얼로그 */}
      <Dialog open={showSanctionDialog} onOpenChange={setShowSanctionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>제재 부과 — {user.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>제재 유형</Label>
              <Select value={sanctionType} onValueChange={setSanctionType}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">경고</SelectItem>
                  <SelectItem value="suspension">정지</SelectItem>
                  <SelectItem value="blacklist">블랙리스트</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>사유</Label>
              <Textarea
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                placeholder="제재 사유를 입력하세요 (예: 매칭 후 지속적 취소, 잔금 미결제 등)"
                rows={3}
                className="mt-2"
              />
            </div>
            {sanctionType !== 'warning' && (
              <div>
                <Label>기간 (일)</Label>
                <Input
                  type="number"
                  value={sanctionDays}
                  onChange={(e) => setSanctionDays(e.target.value)}
                  placeholder="비워두면 무기한"
                  className="mt-2"
                  min={1}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSanctionDialog(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => sanctionMutation.mutate({
                sanctionType,
                reason: sanctionReason,
                durationDays: sanctionDays ? Number(sanctionDays) : undefined,
              })}
              disabled={!sanctionReason.trim() || sanctionMutation.isPending}
            >
              부과
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
