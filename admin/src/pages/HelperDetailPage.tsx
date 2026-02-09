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

export default function HelperDetailPage() {
  const { helperId } = useParams<{ helperId: string }>();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: helperDetail, isLoading } = useQuery<HelperDetail>({
    queryKey: ['admin-helper-detail', helperId],
    queryFn: async () => {
      if (!helperId) throw new Error('No helper ID');
      return apiRequest<HelperDetail>(`/helpers/${helperId}/detail`);
    },
    enabled: !!helperId,
  });

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/api/')) return path;
    return `/api/files/${path}`;
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
      ['은행명', bankAccount?.bankName || '-'],
      ['계좌번호', bankAccount?.accountNumber || '-'],
      ['예금주', bankAccount?.accountHolder || '-'],
      ['차량번호', vehicle?.plateNumber || '-'],
      ['차종', vehicle?.vehicleType || '-'],
      ['필수동의', termsAgreement?.requiredTermsAgreed ? 'O' : 'X'],
      ['선택동의', termsAgreement?.optionalTermsAgreed ? 'O' : 'X'],
      ['마케팅동의', termsAgreement?.marketingAgreed ? 'O' : 'X'],
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
              <InfoRow label="주소" value={business?.address} />
              <InfoRow label="헬퍼고유번호" value={
                <span className="font-mono text-primary font-semibold">{helperCode}</span>
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
              <InfoRow label="사업자 이메일" value={business?.email} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">계좌 정보</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <InfoRow label="은행명" value={bankAccount?.bankName} />
              <InfoRow label="계좌번호" value={
                <span className="font-mono">{bankAccount?.accountNumber}</span>
              } />
              <InfoRow label="예금주" value={bankAccount?.accountHolder} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">차량 정보</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <InfoRow label="차량번호" value={vehicle?.plateNumber} />
              <InfoRow label="차종" value={vehicle?.vehicleType} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">동의 현황</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <div className="grid grid-cols-3 border-b">
                <div className="bg-muted/50 px-4 py-3 font-medium text-sm border-r">필수 동의</div>
                <div className="bg-muted/50 px-4 py-3 font-medium text-sm border-r">선택 동의</div>
                <div className="bg-muted/50 px-4 py-3 font-medium text-sm">마케팅 동의</div>
              </div>
              <div className="grid grid-cols-3">
                <div className="px-4 py-3 border-r">
                  <AgreementBadge agreed={termsAgreement?.requiredTermsAgreed} />
                </div>
                <div className="px-4 py-3 border-r">
                  <AgreementBadge agreed={termsAgreement?.optionalTermsAgreed} />
                </div>
                <div className="px-4 py-3">
                  <AgreementBadge agreed={termsAgreement?.marketingAgreed} />
                </div>
              </div>
              {termsAgreement?.agreedAt && (
                <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
                  동의일시: {new Date(termsAgreement.agreedAt).toLocaleString('ko-KR')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">이미지 파일</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <ImageCard 
              label="사업자등록증" 
              url={business?.businessImageUrl} 
              alt="사업자등록증" 
            />
            <ImageCard 
              label="차량 이미지" 
              url={vehicle?.vehicleImageUrl} 
              alt="차량 이미지" 
            />
            <ImageCard 
              label="운전면허증" 
              url={license?.driverLicenseImageUrl} 
              alt="운전면허증" 
            />
            <ImageCard 
              label="화물운송자격증" 
              url={license?.cargoLicenseImageUrl} 
              alt="화물운송자격증" 
            />
            <ImageCard 
              label="계약서 (서명)" 
              url={termsAgreement?.signatureImageUrl} 
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
