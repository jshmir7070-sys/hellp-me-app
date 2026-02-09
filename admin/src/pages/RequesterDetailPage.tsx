import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  ChevronLeft, Download, FileImage, Check, X, ZoomIn
} from 'lucide-react';

interface RequesterDetail {
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    address?: string;
    onboardingStatus?: string;
    onboardingReviewedAt?: string;
    onboardingRejectReason?: string;
    requesterCode: string;
    createdAt: string;
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
}

export default function RequesterDetailPage() {
  const { requesterId } = useParams<{ requesterId: string }>();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: requesterDetail, isLoading } = useQuery<RequesterDetail>({
    queryKey: ['admin-requester-detail', requesterId],
    queryFn: async () => {
      if (!requesterId) throw new Error('No requester ID');
      return apiRequest<RequesterDetail>(`/requesters/${requesterId}/detail`);
    },
    enabled: !!requesterId,
  });

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/api/')) return path;
    if (path.startsWith('data:')) return path;
    return `/api/files/${path}`;
  };

  const downloadExcel = () => {
    if (!requesterDetail) return;
    const { user, business, serviceAgreement } = requesterDetail;
    
    const headers = ['항목', '내용'];
    
    const rows = [
      ['이름', user.name || '-'],
      ['전화번호', user.phoneNumber || '-'],
      ['이메일', user.email || '-'],
      ['주소', user.address || business?.address || '-'],
      ['요청자고유번호', user.requesterCode],
      ['사업자등록번호', business?.businessNumber || '-'],
      ['상호명', business?.businessName || '-'],
      ['대표자명', business?.representativeName || '-'],
      ['업태', business?.businessType || '-'],
      ['업종', business?.businessCategory || '-'],
      ['서비스계약동의', serviceAgreement?.contractAgreed ? 'O' : 'X'],
      ['휴대폰인증', serviceAgreement?.phoneVerified ? 'O' : 'X'],
      ['가입일', user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'],
    ];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!requesterDetail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-1" />뒤로가기
        </Button>
        <p className="text-muted-foreground">요청자 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const { user, business, serviceAgreement, refundAccount } = requesterDetail;

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
      <Badge variant="default" className="gap-1"><Check className="h-3 w-3" />완료</Badge>
    ) : (
      <Badge variant="secondary" className="gap-1"><X className="h-3 w-3" />미완료</Badge>
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
            <h1 className="text-2xl font-bold">요청자 상세정보</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button onClick={downloadExcel} className="gap-2">
          <Download className="h-4 w-4" />
          엑셀 다운로드
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <InfoRow label="이름" value={user.name} />
              <InfoRow label="전화번호" value={user.phoneNumber} />
              <InfoRow label="이메일" value={user.email} />
              <InfoRow label="주소" value={user.address || business?.address} />
              <InfoRow label="요청자고유번호" value={
                <span className="font-mono text-primary font-semibold">{user.requesterCode}</span>
              } />
              <InfoRow label="가입일" value={
                user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'
              } />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">사업자 등록정보</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <InfoRow label="사업자등록번호" value={business?.businessNumber} />
              <InfoRow label="상호명" value={business?.businessName} />
              <InfoRow label="대표자명" value={business?.representativeName} />
              <InfoRow label="업태" value={business?.businessType} />
              <InfoRow label="업종" value={business?.businessCategory} />
              <InfoRow label="사업장 주소" value={business?.address} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">환불 계좌</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <InfoRow label="은행명" value={refundAccount?.bankName} />
              <InfoRow label="계좌번호" value={refundAccount?.accountNumber} />
              <InfoRow label="예금주" value={refundAccount?.accountHolder} />
              <InfoRow label="등록일" value={
                refundAccount?.createdAt ? new Date(refundAccount.createdAt).toLocaleDateString('ko-KR') : '-'
              } />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">서비스 이용 동의</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <div className="grid grid-cols-3 border-b">
                <div className="bg-muted/50 px-4 py-3 font-medium text-sm border-r">서비스 계약 동의</div>
                <div className="bg-muted/50 px-4 py-3 font-medium text-sm border-r">휴대폰 인증</div>
                <div className="bg-muted/50 px-4 py-3 font-medium text-sm">동의일시</div>
              </div>
              <div className="grid grid-cols-3">
                <div className="px-4 py-3 border-r">
                  <AgreementBadge agreed={serviceAgreement?.contractAgreed} />
                </div>
                <div className="px-4 py-3 border-r">
                  <AgreementBadge agreed={serviceAgreement?.phoneVerified} />
                </div>
                <div className="px-4 py-3 text-sm">
                  {serviceAgreement?.agreedAt ? new Date(serviceAgreement.agreedAt).toLocaleString('ko-KR') : '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">이미지 파일</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ImageCard 
              label="사업자등록증" 
              url={business?.businessImageUrl} 
              alt="사업자등록증" 
            />
            <ImageCard 
              label="서비스 계약서 (서명)" 
              url={serviceAgreement?.signatureData} 
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
    </div>
  );
}
