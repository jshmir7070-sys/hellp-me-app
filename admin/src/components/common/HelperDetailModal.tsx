import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, User, Phone, Mail, Calendar, Truck, Building2, CreditCard, FileText, Users, Star, Package, Image as ImageIcon, ExternalLink, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface HelperDetailModalProps {
  helperId: string | number | null;
  isOpen: boolean;
  onClose: () => void;
}

interface HelperDetail {
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    dailyStatus?: string;
    isTeamLeader?: boolean;
    createdAt: string;
  };
  credential?: {
    id: number;
    userId: string;
    status: string;
    category?: string;
    profilePhotoUrl?: string;
    idFrontPhotoUrl?: string;
    idBackPhotoUrl?: string;
    driverLicensePhotoUrl?: string;
    bankAccountPhotoUrl?: string;
    createdAt: string;
    verifiedAt?: string;
  };
  vehicles?: {
    id: number;
    vehicleType: string;
    vehicleNumber: string;
    registrationPhotoUrl?: string;
    insurancePhotoUrl?: string;
    vehiclePhotoUrl?: string;
  };
  business?: {
    id: number;
    businessNumber: string;
    businessName: string;
    representativeName: string;
    address?: string;
    businessLicensePhotoUrl?: string;
  };
  bankAccount?: {
    id: number;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    bankbookPhotoUrl?: string;
  };
  license?: {
    id: number;
    licenseNumber: string;
    issueDate?: string;
    expiryDate?: string;
    licensePhotoUrl?: string;
  };
  termsAgreement?: {
    agreedAt: string;
  };
  teamInfo?: {
    teamId: number;
    teamName: string;
    isLeader: boolean;
    leaderName: string;
  };
}

export default function HelperDetailModal({ helperId, isOpen, onClose }: HelperDetailModalProps) {
  const { data: helper, isLoading } = useQuery<HelperDetail>({
    queryKey: ['admin-helper-detail', helperId],
    queryFn: () => apiRequest<HelperDetail>(`/helpers/${helperId}/detail`),
    enabled: isOpen && !!helperId,
  });

  const { data: stats } = useQuery<{ completedOrders: number; totalEarnings: number; averageRating: number }>({
    queryKey: ['admin-helper-stats', helperId],
    queryFn: async () => {
      try {
        const orders = await apiRequest<any[]>(`/orders?helperId=${helperId}`);
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        const settlements = await apiRequest<any[]>(`/settlements?helperId=${helperId}`);
        const totalEarnings = settlements.reduce((sum, s) => sum + (s.netAmount || 0), 0);
        return { completedOrders, totalEarnings, averageRating: 4.5 };
      } catch {
        return { completedOrders: 0, totalEarnings: 0, averageRating: 0 };
      }
    },
    enabled: isOpen && !!helperId,
  });

  interface HelperContract {
    id: number;
    orderId: number;
    helperSignature?: string;
    signedAt?: string;
    status: string;
    createdAt: string;
    orderInfo?: {
      id: number;
      companyName: string;
      deliveryArea: string;
      courierCompany: string;
      status: string;
    };
  }

  const { data: helperContracts = [] } = useQuery<HelperContract[]>({
    queryKey: ['admin-helper-contracts', helperId],
    queryFn: () => apiRequest<HelperContract[]>(`/admin/helpers/${helperId}/contracts`),
    enabled: isOpen && !!helperId,
  });

  if (!isOpen) return null;

  const getStatusBadge = (status?: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive'; icon: React.ReactNode }> = {
      pending: { label: '승인대기', variant: 'warning', icon: <Clock className="h-3 w-3" /> },
      approved: { label: '승인됨', variant: 'success', icon: <CheckCircle className="h-3 w-3" /> },
      active: { label: '활성', variant: 'success', icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { label: '반려됨', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
      suspended: { label: '정지', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
    };
    const s = statusMap[status || 'pending'] || { label: status || '알수없음', variant: 'default', icon: null };
    return (
      <Badge variant={s.variant} className="flex items-center gap-1">
        {s.icon}
        {s.label}
      </Badge>
    );
  };

  const ImagePreview = ({ url, label }: { url?: string; label: string }) => {
    if (!url) {
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg border-2 border-dashed">
          <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground">{label} 미등록</span>
        </div>
      );
    }
    return (
      <div className="relative group">
        <img
          src={url}
          alt={label}
          className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => window.open(url, '_blank')}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
          <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')}>
            <ExternalLink className="h-4 w-4 mr-1" />
            원본 보기
          </Button>
        </div>
        <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">{label}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="relative w-full max-w-4xl bg-background rounded-lg shadow-xl my-8">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{helper?.user?.name || '헬퍼 상세정보'}</h2>
              <p className="text-sm text-muted-foreground">ID: {helperId}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : helper ? (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <Package className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold">{stats?.completedOrders || 0}</div>
                      <div className="text-xs text-muted-foreground">완료 오더</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                      <div className="text-2xl font-bold">{(stats?.totalEarnings || 0).toLocaleString()}원</div>
                      <div className="text-xs text-muted-foreground">총 수익</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <Star className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                      <div className="text-2xl font-bold">{stats?.averageRating?.toFixed(1) || '-'}</div>
                      <div className="text-xs text-muted-foreground">평균 평점</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    기본 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">연락처</p>
                          <p className="font-medium">{helper.user.phoneNumber || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">이메일</p>
                          <p className="font-medium">{helper.user.email || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">가입일</p>
                          <p className="font-medium">{formatDate(helper.user.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">승인 상태</p>
                          {getStatusBadge(helper.credential?.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">카테고리</p>
                          <p className="font-medium">{helper.credential?.category || '-'}</p>
                        </div>
                      </div>
                      {helper.teamInfo && (
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">소속팀</p>
                            <p className="font-medium">
                              {helper.teamInfo.teamName}
                              {helper.teamInfo.isLeader && <Badge className="ml-2">팀장</Badge>}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    신분증명 서류
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ImagePreview url={helper.credential?.profilePhotoUrl} label="프로필 사진" />
                    <ImagePreview url={helper.credential?.idFrontPhotoUrl} label="신분증 앞면" />
                    <ImagePreview url={helper.credential?.idBackPhotoUrl} label="신분증 뒷면" />
                    <ImagePreview url={helper.credential?.driverLicensePhotoUrl} label="운전면허증" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    차량 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {helper.vehicles ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">차량 종류</p>
                          <p className="font-medium">{helper.vehicles.vehicleType || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">차량 번호</p>
                          <p className="font-medium">{helper.vehicles.vehicleNumber || '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <ImagePreview url={helper.vehicles.vehiclePhotoUrl} label="차량 사진" />
                        <ImagePreview url={helper.vehicles.registrationPhotoUrl} label="차량등록증" />
                        <ImagePreview url={helper.vehicles.insurancePhotoUrl} label="보험증서" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">차량 정보가 등록되지 않았습니다</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    사업자 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {helper.business ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">사업자번호</p>
                          <p className="font-medium font-mono">{helper.business.businessNumber || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">상호명</p>
                          <p className="font-medium">{helper.business.businessName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">대표자</p>
                          <p className="font-medium">{helper.business.representativeName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">주소</p>
                          <p className="font-medium">{helper.business.address || '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <ImagePreview url={helper.business.businessLicensePhotoUrl} label="사업자등록증" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">사업자 정보가 등록되지 않았습니다</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    정산 계좌
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {helper.bankAccount ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">은행</p>
                          <p className="font-medium">{helper.bankAccount.bankName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">계좌번호</p>
                          <p className="font-medium font-mono">{helper.bankAccount.accountNumber || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">예금주</p>
                          <p className="font-medium">{helper.bankAccount.accountHolder || '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <ImagePreview url={helper.bankAccount.bankbookPhotoUrl} label="통장사본" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">계좌 정보가 등록되지 않았습니다</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    자격증/면허
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {helper.license ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">면허번호</p>
                          <p className="font-medium font-mono">{helper.license.licenseNumber || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">발급일</p>
                          <p className="font-medium">{helper.license.issueDate ? formatDate(helper.license.issueDate) : '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">만료일</p>
                          <p className="font-medium">{helper.license.expiryDate ? formatDate(helper.license.expiryDate) : '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <ImagePreview url={helper.license.licensePhotoUrl} label="자격증 사본" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">자격증 정보가 등록되지 않았습니다</p>
                  )}
                </CardContent>
              </Card>

              {helper.termsAgreement && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      약관 동의
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(helper.termsAgreement.agreedAt)}에 이용약관에 동의하였습니다.
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-500" />
                    계약 이력 ({helperContracts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {helperContracts.length > 0 ? (
                    <div className="space-y-4">
                      {helperContracts.map((contract) => (
                        <div key={contract.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              계약 #{contract.id} - 오더 #{contract.orderId}
                            </span>
                            <Badge variant={contract.status === 'active' ? 'success' : 'secondary'}>
                              {contract.status === 'active' ? '활성' : contract.status}
                            </Badge>
                          </div>
                          {contract.orderInfo && (
                            <div className="text-sm text-muted-foreground">
                              <p>{contract.orderInfo.companyName} / {contract.orderInfo.courierCompany}</p>
                              <p>{contract.orderInfo.deliveryArea}</p>
                            </div>
                          )}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">계약일시</p>
                              <p className="font-medium">
                                {contract.signedAt 
                                  ? formatDate(contract.signedAt) 
                                  : contract.createdAt 
                                    ? formatDate(contract.createdAt)
                                    : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">헬퍼 서명</p>
                              {contract.helperSignature ? (
                                <img 
                                  src={contract.helperSignature} 
                                  alt="헬퍼 서명" 
                                  className="max-w-[150px] h-auto border rounded bg-white p-1 mt-1"
                                />
                              ) : (
                                <p className="text-muted-foreground">서명 없음</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">계약 이력이 없습니다</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              헬퍼 정보를 불러올 수 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
