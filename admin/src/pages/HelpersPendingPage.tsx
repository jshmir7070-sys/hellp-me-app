import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch, apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Eye, Users, RefreshCw, Download, FileText, CreditCard, Car, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PendingHelper {
  id: number;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  createdAt: string;
  status: string;
  licenseVerified: boolean;
  bankAccountVerified: boolean;
}

interface HelperDetail {
  user: any;
  credential?: any;
  vehicles?: any[];
  business?: any;
  bankAccount?: any;
  license?: any;
  termsAgreement?: any;
  teamInfo?: any;
  contracts?: any[];
}

const getImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `/api/files/${url}`;
};

export default function HelpersPendingPage() {
  const [selectedHelper, setSelectedHelper] = useState<PendingHelper | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: helpers = [], isLoading } = useQuery({
    queryKey: ['/api/admin/helpers', 'pending'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/helpers?status=pending');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: helperDetail, isLoading: isDetailLoading } = useQuery<HelperDetail>({
    queryKey: ['admin-helper-detail', selectedHelper?.id],
    queryFn: async () => {
      if (!selectedHelper?.id) throw new Error('No helper selected');
      return apiRequest<HelperDetail>(`/helpers/${selectedHelper.id}/detail`);
    },
    enabled: !!selectedHelper && !showRejectModal,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/api/admin/helpers/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '헬퍼 승인 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/helpers'] });
      setSelectedHelper(null);
    },
    onError: () => {
      toast({ title: '승인 실패', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await adminFetch(`/api/admin/helpers/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '헬퍼 반려 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/helpers'] });
      setSelectedHelper(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: () => {
      toast({ title: '반려 실패', variant: 'destructive' });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/helpers', 'pending'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = helpers.map((item: PendingHelper) => ({
      '가입일': new Date(item.createdAt).toLocaleDateString('ko-KR'),
      '헬퍼ID': item.id,
      '이름': item.name || '',
      '연락처': item.phone || '',
      '이메일': item.email || '',
      '차량유형': item.vehicleType || '',
      '면허확인': item.licenseVerified ? '완료' : '미완료',
      '계좌확인': item.bankAccountVerified ? '완료' : '미완료',
      '상태': item.status || '',
    }));
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `헬퍼대기_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<PendingHelper>[] = [
    {
      key: 'createdAt',
      header: '가입일',
      width: 100,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleDateString('ko-KR')}
        </span>
      ),
    },
    {
      key: 'email',
      header: '이메일(아이디)',
      width: 200,
      render: (value) => <span className="text-sm">{value || '-'}</span>,
    },
    {
      key: 'name',
      header: '이름/연락처',
      width: 140,
      render: (value, row) => (
        <div>
          <div>{value}</div>
          <div className="text-sm text-muted-foreground">{row.phone}</div>
        </div>
      ),
    },
    {
      key: 'vehicleType',
      header: '차량유형',
      width: 100,
      render: (value) => value || '-',
    },
    {
      key: 'licenseVerified',
      header: '서류상태',
      width: 160,
      align: 'center',
      render: (value, row) => (
        <div className="flex items-center justify-center gap-2">
          <Badge variant={value ? 'default' : 'outline'} className="text-xs">
            면허 {value ? '완료' : '미완료'}
          </Badge>
          <Badge variant={row.bankAccountVerified ? 'default' : 'outline'} className="text-xs">
            계좌 {row.bankAccountVerified ? '완료' : '미완료'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'id',
      header: '액션',
      width: 120,
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedHelper(row); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={(e) => { e.stopPropagation(); approveMutation.mutate(row.id); }}
            disabled={approveMutation.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHelper(row);
              setShowRejectModal(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">신규 헬퍼 승인</h1>
          <Badge variant="outline" className="mt-1">{helpers.length}명 대기중</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            CSV 다운로드
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            승인 대기 목록
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={helpers}
            columns={columns}
            loading={isLoading}
            emptyMessage="승인 대기 중인 헬퍼가 없습니다"
            getRowId={(row) => row.id}
            storageKey="helpers-pending-page"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>헬퍼 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">반려 사유</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요"
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>취소</Button>
              <Button 
                variant="destructive"
                onClick={() => selectedHelper && rejectMutation.mutate({ id: selectedHelper.id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                반려하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedHelper && !showRejectModal} onOpenChange={() => setSelectedHelper(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>헬퍼 상세 - #{selectedHelper?.id} {selectedHelper?.name}</DialogTitle>
          </DialogHeader>
          {isDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : helperDetail ? (
            <div className="space-y-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="basic">기본정보</TabsTrigger>
                  <TabsTrigger value="business">사업자정보</TabsTrigger>
                  <TabsTrigger value="bank">계좌정보</TabsTrigger>
                  <TabsTrigger value="license">면허정보</TabsTrigger>
                  <TabsTrigger value="vehicle">차량정보</TabsTrigger>
                  <TabsTrigger value="contracts">계약내역</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />기본 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">헬퍼 고유번호</h4>
                          <p className="font-mono text-sm">{helperDetail.user?.helperCode || helperDetail.user?.id || selectedHelper?.id || '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">이름</h4>
                          <p>{helperDetail.user?.name || selectedHelper?.name || '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">연락처</h4>
                          <p>{helperDetail.user?.phoneNumber || selectedHelper?.phone || '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">이메일(아이디)</h4>
                          <p>{helperDetail.user?.email || selectedHelper?.email || '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">가입일</h4>
                          <p>{helperDetail.user?.createdAt ? new Date(helperDetail.user.createdAt).toLocaleDateString('ko-KR') : '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">온보딩 상태</h4>
                          <Badge variant={helperDetail.user?.onboardingStatus === 'approved' ? 'default' : 'secondary'}>
                            {helperDetail.user?.onboardingStatus || 'pending'}
                          </Badge>
                        </div>
                        {helperDetail.teamInfo && (
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground">소속팀</h4>
                            <p>{helperDetail.teamInfo.teamName} {helperDetail.teamInfo.isLeader ? '(팀장)' : ''}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {helperDetail.termsAgreement && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />약관 동의
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground">동의일</h4>
                            <p>{helperDetail.termsAgreement.agreedAt ? new Date(helperDetail.termsAgreement.agreedAt).toLocaleDateString('ko-KR') : '-'}</p>
                          </div>
                          {helperDetail.termsAgreement.signatureImageUrl && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">서명</h4>
                              <img 
                                src={getImageUrl(helperDetail.termsAgreement.signatureImageUrl)}
                                alt="서명"
                                className="h-16 border rounded cursor-pointer hover:opacity-80"
                                onClick={() => setSelectedImage(getImageUrl(helperDetail.termsAgreement.signatureImageUrl))}
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="business" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" />사업자 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {helperDetail.business ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">사업자등록번호</h4>
                              <p>{helperDetail.business.businessNumber || '-'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">상호명</h4>
                              <p>{helperDetail.business.businessName || '-'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">대표자명</h4>
                              <p>{helperDetail.business.representativeName || '-'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">업태</h4>
                              <p>{helperDetail.business.businessType || '-'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">업종</h4>
                              <p>{helperDetail.business.businessCategory || '-'}</p>
                            </div>
                            <div className="col-span-2">
                              <h4 className="text-sm font-medium text-muted-foreground">주소</h4>
                              <p>{helperDetail.business.address || '-'}</p>
                            </div>
                          </div>
                          {helperDetail.business.businessImageUrl && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">사업자등록증</h4>
                              <img 
                                src={getImageUrl(helperDetail.business.businessImageUrl)}
                                alt="사업자등록증"
                                className="max-h-48 border rounded cursor-pointer hover:opacity-80"
                                onClick={() => setSelectedImage(getImageUrl(helperDetail.business.businessImageUrl))}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">사업자 정보가 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="bank" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />계좌 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {helperDetail.bankAccount ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">은행명</h4>
                              <p>{helperDetail.bankAccount.bankName || '-'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">계좌번호</h4>
                              <p>{helperDetail.bankAccount.accountNumber || '-'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">예금주</h4>
                              <p>{helperDetail.bankAccount.accountHolder || '-'}</p>
                            </div>
                          </div>
                          {helperDetail.bankAccount.bankbookImageUrl && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">통장사본</h4>
                              <img 
                                src={getImageUrl(helperDetail.bankAccount.bankbookImageUrl)}
                                alt="통장사본"
                                className="max-h-48 border rounded cursor-pointer hover:opacity-80"
                                onClick={() => setSelectedImage(getImageUrl(helperDetail.bankAccount.bankbookImageUrl))}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">계좌 정보가 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="license" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />면허 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {helperDetail.license ? (
                        <div className="grid grid-cols-2 gap-4">
                          {helperDetail.license.driverLicenseImageUrl && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">운전면허증</h4>
                              <img 
                                src={getImageUrl(helperDetail.license.driverLicenseImageUrl)}
                                alt="운전면허증"
                                className="max-h-48 border rounded cursor-pointer hover:opacity-80"
                                onClick={() => setSelectedImage(getImageUrl(helperDetail.license.driverLicenseImageUrl))}
                              />
                            </div>
                          )}
                          {helperDetail.license.cargoLicenseImageUrl && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">화물운송자격증</h4>
                              <img 
                                src={getImageUrl(helperDetail.license.cargoLicenseImageUrl)}
                                alt="화물운송자격증"
                                className="max-h-48 border rounded cursor-pointer hover:opacity-80"
                                onClick={() => setSelectedImage(getImageUrl(helperDetail.license.cargoLicenseImageUrl))}
                              />
                            </div>
                          )}
                          {!helperDetail.license.driverLicenseImageUrl && !helperDetail.license.cargoLicenseImageUrl && (
                            <p className="text-muted-foreground col-span-2">면허 이미지가 없습니다.</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">면허 정보가 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="vehicle" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Car className="h-4 w-4" />차량 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {helperDetail.vehicles && helperDetail.vehicles.length > 0 ? (
                        <div className="space-y-4">
                          {helperDetail.vehicles.map((vehicle: any, idx: number) => (
                            <div key={idx} className="p-3 border rounded-lg">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">차량번호</h4>
                                  <p>{vehicle.plateNumber || vehicle.vehicleNumber || '-'}</p>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">차종</h4>
                                  <p>{vehicle.vehicleType || vehicle.type || '-'}</p>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground">톤수</h4>
                                  <p>{vehicle.tonnage || '-'}</p>
                                </div>
                              </div>
                              {vehicle.vehicleImageUrl && (
                                <div className="mt-3">
                                  <h4 className="text-sm font-medium text-muted-foreground mb-2">차량 이미지</h4>
                                  <img 
                                    src={getImageUrl(vehicle.vehicleImageUrl)}
                                    alt="차량"
                                    className="max-h-32 border rounded cursor-pointer hover:opacity-80"
                                    onClick={() => setSelectedImage(getImageUrl(vehicle.vehicleImageUrl))}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">차량 정보가 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contracts" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />계약 내역
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {helperDetail.contracts && helperDetail.contracts.length > 0 ? (
                        <div className="space-y-3">
                          {helperDetail.contracts.map((contract: any, idx: number) => (
                            <div key={idx} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="font-medium">계약 #{contract.id}</span>
                                  <Badge className="ml-2" variant={contract.status === 'completed' ? 'default' : 'secondary'}>
                                    {contract.status === 'completed' ? '완료' : 
                                     contract.status === 'active' ? '진행중' : 
                                     contract.status === 'cancelled' ? '취소' : contract.status}
                                  </Badge>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString('ko-KR') : '-'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">의뢰인: </span>
                                  <span>{contract.requesterName}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">총액: </span>
                                  <span className="font-medium">{Number(contract.totalAmount || 0).toLocaleString()}원</span>
                                </div>
                                {contract.order && (
                                  <>
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">배송일: </span>
                                      <span>{contract.order.scheduledDate ? new Date(contract.order.scheduledDate).toLocaleDateString('ko-KR') : '-'}</span>
                                    </div>
                                    <div className="col-span-2 text-xs text-muted-foreground">
                                      {contract.order.pickupAddress} → {contract.order.deliveryAddress}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">계약 내역이 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => { setShowRejectModal(true); }}>
                  <X className="h-4 w-4 mr-2" />반려
                </Button>
                <Button onClick={() => approveMutation.mutate(selectedHelper!.id)} disabled={approveMutation.isPending}>
                  <Check className="h-4 w-4 mr-2" />승인
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-4">상세 정보를 불러올 수 없습니다.</p>
          )}
        </DialogContent>
      </Dialog>

      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl">
            <img src={selectedImage} alt="확대 이미지" className="w-full h-auto" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
