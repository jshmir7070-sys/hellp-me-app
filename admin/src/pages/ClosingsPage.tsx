import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Image, FileText, RefreshCw, Download, Search, AlertTriangle, Edit, ExternalLink, X, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateRangePicker, getDefaultDateRange } from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';

// ==================== 인터페이스 ====================

interface ExtraItem {
  name: string;
  unitPrice: number;
  quantity: number;
  memo?: string;
}

interface IncidentInfo {
  id: number;
  orderId: number;
  incidentType: string;
  status: string;
  damageAmount?: number;
  deductionAmount?: number;
  description?: string;
  createdAt?: string;
}

interface DeductionInfo {
  id: number;
  orderId: number;
  incidentId?: number;
  helperId?: string;
  amount: number;
  reason: string;
  category?: string;
  status?: string;
  memo?: string;
}

interface OrderDetail {
  closingReportId: number;
  orderId: number;
  orderNumber: string | null;
  orderStatus: string;
  // 요청자
  requesterId: string | null;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  businessName: string;
  // 헬퍼
  helperId: string;
  helperName: string;
  helperPhone: string;
  helperEmail: string;
  helperTeamName: string;
  // 오더 정보
  deliveryArea: string;
  courierCompany: string;
  vehicleType: string;
  scheduledDate: string;
  scheduledDateEnd: string | null;
  pricePerUnit: number;
  averageQuantity: string;
  campAddress: string;
  contactPhone: string;
  arrivalTime: string;
  enterpriseId: number | null;
  enterpriseName: string;
  // 마감 데이터
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  extraCostsJson: ExtraItem[];
  deliveryHistoryImages: string[];
  etcImages: string[];
  closingMemo: string;
  closingCreatedAt: string;
  // 정산
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  platformFeeRate: number;
  platformFee: number;
  netAmount: number;
  // 정산 상세 breakdown
  deliveryReturnAmount: number;
  etcAmount: number;
  extraCostsTotal: number;
  etcPricePerUnit: number;
  // 이벤트
  hasIncident: boolean;
  hasDispute: boolean;
  hasAnyEvent: boolean;
  incidents: IncidentInfo[];
  deductions: DeductionInfo[];
  deductionTotal: number;
  settlementRecord: any;
}

// ==================== 유틸 ====================

const toAbsFileUrl = (p: string) => {
  if (!p) return p;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${window.location.origin}${p}`;
};

const formatOrderNumber = (orderNumber: string | null, orderId: number): string => {
  if (orderNumber) {
    // 12자리: X-XXX-XXXX-XXXX 형태로 표시
    if (orderNumber.length === 12) {
      return `${orderNumber.slice(0, 1)}-${orderNumber.slice(1, 4)}-${orderNumber.slice(4, 8)}-${orderNumber.slice(8, 12)}`;
    }
    return orderNumber;
  }
  return `#${orderId}`;
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  cargo_damage: '화물사고',
  accident: '사고접수',
  dispute: '이의제기',
  complaint: '민원접수',
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  requested: '접수',
  reviewing: '검토중',
  resolved: '해결',
  rejected: '기각',
};

// ==================== 컴포넌트 ====================

export default function ClosingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 상태
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageModalTitle, setImageModalTitle] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange(30));
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<{
    deliveredCount: number;
    returnedCount: number;
    etcCount: number;
    deductionUpdates: { id?: number; amount: number; reason: string; memo: string; incidentId?: number; helperId?: string }[];
  } | null>(null);

  // 데이터 조회
  const { data: orderDetails = [], isLoading, error } = useQuery({
    queryKey: ['/api/admin/order-details', dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await adminFetch(
        `/api/admin/order-details?startDate=${dateRange.from}&endDate=${dateRange.to}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `서버 오류 (${res.status})`);
      }
      return res.json();
    },
    retry: 1,
  });

  // 수정 Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: number; data: any }) => {
      const res = await adminFetch(`/api/admin/order-details/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '수정 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '오더상세내역이 수정되었습니다.', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/order-details'] });
      setEditMode(false);
      setEditData(null);
      setSelectedOrder(null);
    },
    onError: (err: Error) => {
      toast({ title: '수정 실패: ' + err.message, variant: 'destructive' });
    },
  });

  // URL ?orderId= 파라미터로 오더상세 자동 오픈
  const autoOpenHandled = useRef(false);
  useEffect(() => {
    if (autoOpenHandled.current) return;
    const targetOrderId = searchParams.get('orderId');
    if (!targetOrderId || !orderDetails.length) return;

    const orderId = Number(targetOrderId);
    const found = (orderDetails as OrderDetail[]).find((o) => o.orderId === orderId);
    if (found) {
      setSelectedOrder(found);
      autoOpenHandled.current = true;
      searchParams.delete('orderId');
      setSearchParams(searchParams, { replace: true });
    } else {
      autoOpenHandled.current = true;
      searchParams.delete('orderId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [orderDetails, searchParams, setSearchParams]);

  // 검색 필터링
  const filteredOrders = useMemo(() => {
    return orderDetails.filter((o: OrderDetail) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase().replace(/-/g, '');
      return (
        (o.orderNumber && o.orderNumber.includes(search)) ||
        o.orderId.toString().includes(search) ||
        o.helperName?.toLowerCase().includes(search) ||
        o.requesterName?.toLowerCase().includes(search) ||
        o.courierCompany?.toLowerCase().includes(search)
      );
    });
  }, [orderDetails, searchTerm]);

  // 이미지 모달
  const openImages = (images: string[], title: string = '이미지') => {
    setSelectedImages(images);
    setImageModalTitle(title);
    setShowImageModal(true);
  };

  // 새로고침
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/order-details'] });
    toast({ title: '데이터를 새로고침했습니다.', variant: 'success' });
  };

  // CSV 다운로드
  const handleDownloadExcel = () => {
    const data = filteredOrders.map((item: OrderDetail) => ({
      '오더번호': formatOrderNumber(item.orderNumber, item.orderId),
      '요청자': item.requesterName || '',
      '요청자연락처': item.requesterPhone || '',
      '헬퍼': item.helperName || '',
      '헬퍼연락처': item.helperPhone || '',
      '배송지역': item.deliveryArea || '',
      '운송사': item.courierCompany || '',
      '배송수량': item.deliveredCount || 0,
      '반품수량': item.returnedCount || 0,
      '기타수량': item.etcCount || 0,
      '합계금': item.totalAmount?.toLocaleString() || '0',
      '차감합계': item.deductionTotal?.toLocaleString() || '0',
      '이벤트': item.hasAnyEvent ? '있음' : '-',
      '마감메모': item.closingMemo || '',
    }));
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) =>
        headers.map((h) => `"${row[h as keyof typeof row] ?? ''}"`).join(',')
      ),
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `오더상세내역_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 수정 모드 진입
  const enterEditMode = (order: OrderDetail) => {
    setEditMode(true);
    setEditData({
      deliveredCount: order.deliveredCount,
      returnedCount: order.returnedCount,
      etcCount: order.etcCount,
      deductionUpdates: order.deductions.map((d) => ({
        id: d.id,
        amount: d.amount,
        reason: d.reason,
        memo: d.memo || '',
      })),
    });
  };

  // 수정 저장
  const handleSaveEdit = () => {
    if (!selectedOrder || !editData) return;
    updateMutation.mutate({
      orderId: selectedOrder.orderId,
      data: editData,
    });
  };

  // ==================== 테이블 컬럼 ====================

  const columns: ColumnDef<OrderDetail>[] = [
    {
      key: 'orderNumber',
      header: '오더번호',
      width: 140,
      render: (_, row) => (
        <span className="font-mono text-sm font-medium">
          {formatOrderNumber(row.orderNumber, row.orderId)}
        </span>
      ),
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 120,
      render: (value, row) => (
        <div className="text-sm">
          <p className="font-medium">{value || '-'}</p>
          <p className="text-xs text-muted-foreground">{row.requesterPhone || ''}</p>
        </div>
      ),
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 120,
      render: (value, row) => (
        <div className="text-sm">
          <p className="font-medium">{value || '-'}</p>
          <p className="text-xs text-muted-foreground">{row.helperPhone || ''}</p>
        </div>
      ),
    },
    {
      key: 'deliveredCount',
      header: '배송/반품/기타',
      width: 120,
      align: 'center',
      render: (_, row) => (
        <span className="text-sm font-medium">
          {row.deliveredCount} / {row.returnedCount} / {row.etcCount || 0}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      header: '합계금',
      width: 100,
      align: 'right',
      render: (value) => (
        <span className="text-sm font-medium">
          {(value || 0).toLocaleString()}원
        </span>
      ),
    },
    {
      key: 'deductionTotal',
      header: '차감',
      width: 90,
      align: 'right',
      render: (value) =>
        value > 0 ? (
          <span className="text-sm font-medium text-red-600">
            -{value.toLocaleString()}원
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      key: 'orderStatus',
      header: '상태',
      width: 80,
      align: 'center',
      render: (value) => {
        const statusLabels: Record<string, string> = {
          closing_submitted: '마감제출',
          closed: '종료',
          settled: '정산완료',
          dispute_requested: '분쟁접수',
          dispute_reviewing: '분쟁검토',
          dispute_resolved: '분쟁해결',
        };
        return (
          <Badge variant="outline" className="text-xs">
            {statusLabels[value] || value || '-'}
          </Badge>
        );
      },
    },
    {
      key: 'hasAnyEvent',
      header: '이벤트',
      width: 100,
      align: 'center',
      render: (_, row) => {
        if (!row.hasAnyEvent) return <span className="text-xs text-muted-foreground">-</span>;

        // 사고 건 중 완료 여부 판단
        const incidentItems = row.incidents || [];
        const completedStatuses = ['resolved', 'closed', 'rejected'];

        const incidentList = incidentItems.filter((inc: IncidentInfo) =>
          inc.incidentType === 'cargo_damage' || inc.incidentType === 'accident'
        );
        const disputeList = incidentItems.filter((inc: IncidentInfo) =>
          inc.incidentType === 'dispute' || inc.incidentType === 'complaint'
        );

        const allIncidentsComplete = incidentList.length > 0 && incidentList.every((inc: IncidentInfo) => completedStatuses.includes(inc.status));
        const allDisputesComplete = disputeList.length > 0 && disputeList.every((inc: IncidentInfo) => completedStatuses.includes(inc.status));

        return (
          <div className="flex flex-col gap-1 items-center">
            {incidentList.length > 0 && (
              allIncidentsComplete ? (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-green-300 text-green-700 bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  사고완료
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  사고접수
                </Badge>
              )
            )}
            {disputeList.length > 0 && (
              allDisputesComplete ? (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-green-300 text-green-700 bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  이의완료
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  이의제기
                </Badge>
              )
            )}
            {incidentList.length === 0 && disputeList.length === 0 && incidentItems.length > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                이벤트
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'closingReportId',
      header: '상세',
      width: 60,
      align: 'center',
      render: (_, row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrder(row);
            setEditMode(false);
            setEditData(null);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ==================== 렌더링 ====================

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">오더상세내역</h1>
          <p className="text-sm text-muted-foreground mt-1">
            오더별 전체 정보 조회 · 이벤트 관리 · 정산 확인
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="오더번호, 헬퍼, 요청자 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-72 pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={filteredOrders.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            다운로드
          </Button>
        </div>
      </div>

      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          데이터 로딩 오류: {(error as Error).message}
        </div>
      )}

      {/* 리스트 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            오더상세내역
            <Badge variant="secondary" className="ml-2">
              {filteredOrders.length}건
            </Badge>
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={filteredOrders}
            columns={columns}
            loading={isLoading}
            emptyMessage="오더상세내역이 없습니다"
            getRowId={(row: OrderDetail) => row.closingReportId}
            storageKey="order-details-page"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      {/* 일반 이미지 모달 */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{imageModalTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
            {selectedImages.map((img, idx) => (
              <a key={idx} href={toAbsFileUrl(img)} target="_blank" rel="noopener noreferrer">
                <img
                  src={toAbsFileUrl(img)}
                  alt={`이미지 ${idx + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border hover:opacity-80 transition"
                />
              </a>
            ))}
            {selectedImages.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">이미지가 없습니다</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== 상세 모달 ==================== */}
      <Dialog open={!!selectedOrder} onOpenChange={() => { setSelectedOrder(null); setEditMode(false); setEditData(null); }}>
        <DialogContent className="max-w-5xl p-0 max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <div className="p-6 space-y-6">
              {/* 오더번호 헤더 */}
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold">오더상세조회</h2>
                <p className="text-2xl font-mono font-bold mt-2 text-primary">
                  {formatOrderNumber(selectedOrder.orderNumber, selectedOrder.orderId)}
                </p>
                {selectedOrder.hasAnyEvent && (() => {
                  const completedStatuses = ['resolved', 'closed', 'rejected'];
                  const incs = (selectedOrder.incidents || []) as IncidentInfo[];
                  const incidentList = incs.filter(i => i.incidentType === 'cargo_damage' || i.incidentType === 'accident');
                  const disputeList = incs.filter(i => i.incidentType === 'dispute' || i.incidentType === 'complaint');
                  const allIncComplete = incidentList.length > 0 && incidentList.every(i => completedStatuses.includes(i.status));
                  const allDispComplete = disputeList.length > 0 && disputeList.every(i => completedStatuses.includes(i.status));
                  return (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {incidentList.length > 0 && (
                        allIncComplete ? (
                          <Badge variant="outline" className="text-sm px-3 py-1 border-green-300 text-green-700 bg-green-50">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            사고완료
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-sm px-3 py-1">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            사고접수
                          </Badge>
                        )
                      )}
                      {disputeList.length > 0 && (
                        allDispComplete ? (
                          <Badge variant="outline" className="text-sm px-3 py-1 border-green-300 text-green-700 bg-green-50">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            이의완료
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-sm px-3 py-1">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            이의제기
                          </Badge>
                        )
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 요청자/헬퍼 정보 2컬럼 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 border-b pb-2">요청자정보</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">이름</span>
                      <span className="font-medium">{selectedOrder.requesterName} ({selectedOrder.requesterEmail || '-'})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">연락처</span>
                      <span>{selectedOrder.requesterPhone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">사업자명</span>
                      <span>{selectedOrder.businessName || '-'}</span>
                    </div>
                    {selectedOrder.enterpriseName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">협력업체</span>
                        <span className="font-medium text-blue-600">{selectedOrder.enterpriseName}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 border-b pb-2">헬퍼정보</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">이름</span>
                      <span className="font-medium">{selectedOrder.helperName} ({selectedOrder.helperEmail || '-'})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">연락처</span>
                      <span>{selectedOrder.helperPhone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">팀명</span>
                      <span>{selectedOrder.helperTeamName || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 오더정보 전체 */}
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-bold text-muted-foreground mb-3 border-b pb-2">오더정보</h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">배송지역</span>
                    <p className="font-medium">{selectedOrder.deliveryArea || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">운송사</span>
                    <p className="font-medium">{selectedOrder.courierCompany || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">차종</span>
                    <p className="font-medium">{selectedOrder.vehicleType || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">일정</span>
                    <p className="font-medium">
                      {selectedOrder.scheduledDate}
                      {selectedOrder.scheduledDateEnd ? ` ~ ${selectedOrder.scheduledDateEnd}` : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">입차시간</span>
                    <p className="font-medium">{selectedOrder.arrivalTime || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">단가</span>
                    <p className="font-medium">{selectedOrder.pricePerUnit?.toLocaleString()}원</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">수량</span>
                    <p className="font-medium">{selectedOrder.averageQuantity || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">캠프주소</span>
                    <p className="font-medium">{selectedOrder.campAddress || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">담당자연락처</span>
                    <p className="font-medium">{selectedOrder.contactPhone || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 배송/반품/기타 */}
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-bold text-muted-foreground mb-3 border-b pb-2">배송 · 반품 · 기타</h3>
                {editMode && editData ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">배송수량</label>
                      <Input
                        type="number"
                        value={editData.deliveredCount}
                        onChange={(e) =>
                          setEditData({ ...editData, deliveredCount: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">반품수량</label>
                      <Input
                        type="number"
                        value={editData.returnedCount}
                        onChange={(e) =>
                          setEditData({ ...editData, returnedCount: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">기타수량</label>
                      <Input
                        type="number"
                        value={editData.etcCount}
                        onChange={(e) =>
                          setEditData({ ...editData, etcCount: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">배송</p>
                      <p className="text-2xl font-bold text-blue-600">{selectedOrder.deliveredCount}</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">반품</p>
                      <p className="text-2xl font-bold text-orange-600">{selectedOrder.returnedCount}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">기타</p>
                      <p className="text-2xl font-bold text-gray-600">{selectedOrder.etcCount || 0}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 추가비용 */}
              {selectedOrder.extraCostsJson && selectedOrder.extraCostsJson.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 border-b pb-2">
                    추가비용 <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">VAT별도</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.extraCostsJson.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded text-sm">
                        <span className="font-medium">{item.name}</span>
                        <span>
                          {item.unitPrice?.toLocaleString()}원 x {item.quantity || 1} ={' '}
                          {((item.unitPrice || 0) * (item.quantity || 1)).toLocaleString()}원
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold border-t pt-2 text-sm">
                      <span>추가비용 합계</span>
                      <span>
                        {selectedOrder.extraCostsJson
                          .reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0)
                          .toLocaleString()}
                        원
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 마감사진 */}
              {(selectedOrder.deliveryHistoryImages?.length > 0 || selectedOrder.etcImages?.length > 0) && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 border-b pb-2">
                    마감사진
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-6"
                      onClick={() =>
                        openImages(
                          [...(selectedOrder.deliveryHistoryImages || []), ...(selectedOrder.etcImages || [])],
                          '마감 이미지'
                        )
                      }
                    >
                      <Image className="h-3 w-3 mr-1" />
                      전체보기
                    </Button>
                  </h3>
                  <div className="grid grid-cols-6 gap-2">
                    {[...(selectedOrder.deliveryHistoryImages || []), ...(selectedOrder.etcImages || [])]
                      .slice(0, 12)
                      .map((img, idx) => (
                        <a key={idx} href={toAbsFileUrl(img)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={toAbsFileUrl(img)}
                            alt={`이미지 ${idx + 1}`}
                            className="w-full aspect-square object-cover rounded border hover:opacity-80"
                          />
                        </a>
                      ))}
                  </div>
                </div>
              )}

              {/* 차감/사고 내역 */}
              {(selectedOrder.incidents.length > 0 || selectedOrder.deductions.length > 0) && (
                <div className="border rounded-lg p-4 border-red-200 bg-red-50/30">
                  <h3 className="text-sm font-bold text-red-600 mb-3 border-b border-red-200 pb-2">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    차감 · 사고 내역
                  </h3>

                  {/* 사고/이의제기 목록 */}
                  {selectedOrder.incidents.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-muted-foreground mb-2">사고/이의제기 접수</p>
                      <div className="space-y-2">
                        {selectedOrder.incidents.map((inc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-xs">
                                {INCIDENT_TYPE_LABELS[inc.incidentType] || inc.incidentType}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                              </Badge>
                            </div>
                            <div className="text-right">
                              {inc.damageAmount ? (
                                <span className="font-medium text-red-600">
                                  피해금액: {inc.damageAmount.toLocaleString()}원
                                </span>
                              ) : null}
                              {inc.deductionAmount ? (
                                <span className="font-medium text-red-600 ml-2">
                                  차감: {inc.deductionAmount.toLocaleString()}원
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 차감 목록 */}
                  {selectedOrder.deductions.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-2">차감내역</p>
                      {editMode && editData ? (
                        <div className="space-y-2">
                          {editData.deductionUpdates.map((du, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                              <Input
                                type="number"
                                value={du.amount}
                                onChange={(e) => {
                                  const updates = [...editData.deductionUpdates];
                                  updates[idx].amount = parseInt(e.target.value) || 0;
                                  setEditData({ ...editData, deductionUpdates: updates });
                                }}
                                className="w-32"
                                placeholder="금액"
                              />
                              <Input
                                value={du.reason}
                                onChange={(e) => {
                                  const updates = [...editData.deductionUpdates];
                                  updates[idx].reason = e.target.value;
                                  setEditData({ ...editData, deductionUpdates: updates });
                                }}
                                className="flex-1"
                                placeholder="사유"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const updates = editData.deductionUpdates.filter((_, i) => i !== idx);
                                  setEditData({ ...editData, deductionUpdates: updates });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditData({
                                ...editData,
                                deductionUpdates: [
                                  ...editData.deductionUpdates,
                                  { amount: 0, reason: '화물사고 차감', memo: '', helperId: selectedOrder.helperId },
                                ],
                              });
                            }}
                          >
                            + 차감 추가
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedOrder.deductions.map((ded, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-white rounded border text-sm"
                            >
                              <div>
                                <span className="font-medium">{ded.reason}</span>
                                {ded.category && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {ded.category}
                                  </Badge>
                                )}
                              </div>
                              <span className="font-bold text-red-600">
                                -{ded.amount?.toLocaleString()}원
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between font-bold text-red-600 border-t border-red-200 pt-2 text-sm">
                            <span>차감 합계</span>
                            <span>-{selectedOrder.deductionTotal?.toLocaleString()}원</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 청구금 / 헬퍼지급금 */}
              <div className="border rounded-lg p-4 bg-blue-50/30">
                <h3 className="text-sm font-bold text-muted-foreground mb-3 border-b pb-2">정산 요약</h3>

                {/* 금액 산출 상세 */}
                <div className="mb-4 space-y-1 text-sm bg-white rounded-lg p-3 border">
                  <p className="text-xs font-bold text-muted-foreground mb-2">금액 산출 내역</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      배송+반품 ({selectedOrder.deliveredCount}+{selectedOrder.returnedCount}) × {selectedOrder.pricePerUnit?.toLocaleString()}원
                    </span>
                    <span>{(selectedOrder.deliveryReturnAmount || 0).toLocaleString()}원</span>
                  </div>
                  {(selectedOrder.etcCount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        기타 ({selectedOrder.etcCount}) × {(selectedOrder.etcPricePerUnit || 1800).toLocaleString()}원
                      </span>
                      <span>{(selectedOrder.etcAmount || 0).toLocaleString()}원</span>
                    </div>
                  )}
                  {(selectedOrder.extraCostsTotal || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">추가비용 <span className="text-[10px] text-amber-700">(VAT별도)</span></span>
                      <span>{(selectedOrder.extraCostsTotal || 0).toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span>공급가액</span>
                    <span>{selectedOrder.supplyAmount?.toLocaleString()}원</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">공급가액</span>
                      <span>{selectedOrder.supplyAmount?.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">부가세(10%)</span>
                      <span>{selectedOrder.vatAmount?.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>청구금</span>
                      <span className="text-lg">{selectedOrder.totalAmount?.toLocaleString()}원</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">플랫폼 수수료({selectedOrder.platformFeeRate ?? 5}%)</span>
                      <span className="text-red-500">-{selectedOrder.platformFee?.toLocaleString()}원</span>
                    </div>
                    {selectedOrder.deductionTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">차감합계</span>
                        <span className="text-red-500">
                          -{selectedOrder.deductionTotal?.toLocaleString()}원
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>헬퍼 지급금</span>
                      <span className="text-lg text-primary">{selectedOrder.netAmount?.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>

                {/* 정산내역 확인 링크 */}
                <div className="mt-4 pt-3 border-t">
                  <Button
                    variant="link"
                    className="text-sm text-blue-600 hover:underline p-0 h-auto flex items-center gap-1"
                    onClick={() => {
                      setSelectedOrder(null);
                      navigate('/settlements');
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    헬퍼 정산내역 확인 (정산통합관리)
                  </Button>
                </div>
              </div>

              {/* 마감 메모 */}
              {selectedOrder.closingMemo && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-bold text-muted-foreground mb-2">마감 메모</h3>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    {selectedOrder.closingMemo}
                  </p>
                </div>
              )}

              {/* 하단 버튼 */}
              <div className="flex justify-between items-center border-t pt-4">
                <div>
                  {selectedOrder.hasAnyEvent && !editMode && (
                    <Button
                      variant="destructive"
                      onClick={() => enterEditMode(selectedOrder)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      수정 (이벤트 처리)
                    </Button>
                  )}
                  {!selectedOrder.hasAnyEvent && (
                    <span className="text-xs text-muted-foreground">
                      이벤트(사고/이의제기)가 없어 수정 불가
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditMode(false);
                          setEditData(null);
                        }}
                      >
                        취소
                      </Button>
                      <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? '저장중...' : '저장'}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => { setSelectedOrder(null); setEditMode(false); }}>
                      닫기
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
