import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { StatusBadge, EntityLink, DateRangePicker, getDefaultDateRange, Money, ReasonModal } from '@/components/common';
import { AlertTriangle, Plus, RefreshCw, Download, Filter, ChevronDown, Eye, CheckCircle, XCircle, User, Phone, FileText, MessageSquare, Image as ImageIcon, ExternalLink, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// --- Types ---

/** 이의제기 (정산 수량 편차, 청구 금액 오류, 세금계산서 불일치 등) */
interface Dispute {
  id: number;
  realId: number; // API에서 받은 원본 ID
  orderId: number | null;
  orderNumber?: string | null;
  settlementId: number | null;
  helperId: string;
  helperName: string;
  helperPhone?: string;
  requesterName?: string;
  requesterPhone?: string;
  submitterRole: string; // 'helper' | 'requester'
  disputeType: string; // 'count_mismatch' | 'amount_error' | 'delivery_issue' | 'other'
  status: string; // 'pending' | 'reviewing' | 'resolved' | 'rejected'
  description: string;
  workDate: string;
  courierName?: string;
  invoiceNumber?: string;
  // 수량 수정 요청
  requestedDeliveryCount?: number | null;
  requestedReturnCount?: number | null;
  requestedPickupCount?: number | null;
  requestedOtherCount?: number | null;
  // 증빙
  evidencePhotoUrls?: string[];
  // 처리 결과
  resolution?: string | null;
  resolvedAt?: string | null;
  adminReply?: string | null;
  adminReplyAt?: string | null;
  createdAt: string;
  // detail API enriched
  profileImage?: string | null;
  submitterName?: string;
  adminNote?: string | null;
  order?: { id: number; carrierName?: string; pickupLocation?: string; deliveryLocation?: string; scheduledDate?: string; companyName?: string } | null;
  helper?: { id: string; name: string; nickname?: string; phone?: string } | null;
  requester?: { id: string; name: string; phone?: string; companyName?: string } | null;
}

// 이의제기 상태
const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  submitted: '접수됨',
  reviewing: '검토 중',
  resolved: '인정(해결)',
  rejected: '기각',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  reviewing: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

// 헬퍼 이의제기 유형 (HelperDisputeSubmitScreen 드롭다운과 일치)
const HELPER_DISPUTE_TYPE_LABELS: Record<string, string> = {
  settlement_error: '정산',
  invoice_error: '세금계산서',
  closing_data_mismatch: '마감자료불일치',
  service_complaint: '요청자 불만',
  other: '기타(직접작성)',
};

// 요청자 이의제기 유형 (RequesterDisputeScreen 드롭다운과 일치)
const REQUESTER_DISPUTE_TYPE_LABELS: Record<string, string> = {
  settlement_error: '정산오류',
  invoice_error: '세금계산서 오류',
  contract_dispute: '계약조건분쟁',
  service_complaint: '서비스불만',
  delay: '일정관련',
  no_show: '노쇼',
  other: '기타',
};

// 통합 (모든 유형 커버 — fallback)
const ALL_DISPUTE_TYPE_LABELS: Record<string, string> = {
  ...REQUESTER_DISPUTE_TYPE_LABELS,
  ...HELPER_DISPUTE_TYPE_LABELS,
  count_mismatch: '수량 불일치',
  amount_error: '금액 오류',
  freight_accident: '화물 사고',
  damage: '물품 파손',
  delivery_issue: '배송 문제',
  lost: '분실',
  wrong_delivery: '오배송',
};

interface Deduction {
  id: number;
  helperId: number;
  helperName: string;
  amount: number;
  reason: string;
  disputeId?: number;
  settlementApplied: boolean;
  createdAt: string;
}

function formatOrderNumber(orderNumber: string | null | undefined, orderId: number): string {
  if (orderNumber) {
    if (orderNumber.length === 12) {
      return `${orderNumber.slice(0, 1)}-${orderNumber.slice(1, 4)}-${orderNumber.slice(4, 8)}-${orderNumber.slice(8, 12)}`;
    }
    return orderNumber;
  }
  return `#${orderId}`;
}

export default function DisputesPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const orderIdFilter = searchParams.get('orderId');

  const [dateRange, setDateRange] = useState(getDefaultDateRange(30));
  const [activeTab, setActiveTab] = useState<'disputes' | 'deductions'>('disputes');
  const [searchQuery, setSearchQuery] = useState(orderIdFilter || '');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeductionModalOpen, setIsDeductionModalOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedDisputeIds, setSelectedDisputeIds] = useState<Set<string | number>>(new Set());
  const [selectedDeductionIds, setSelectedDeductionIds] = useState<Set<string | number>>(new Set());
  const [adminReplyText, setAdminReplyText] = useState('');

  // --- Queries ---

  // 이의제기 목록 (helperDisputes만 — 사고접수는 사고접수 페이지에서 관리)
  const { data: disputes = [], isLoading: disputesLoading, refetch: refetchDisputes } = useQuery<Dispute[]>({
    queryKey: ['admin-disputes', dateRange],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/helper-disputes`, { credentials: 'include' });
      if (!res.ok) throw new Error('이의제기 목록을 불러올 수 없습니다');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.items || []);
      return list.map((d: any) => ({
        id: d.id,
        realId: d.id,
        orderId: d.orderId,
        orderNumber: d.orderNumber || null,
        settlementId: d.settlementId,
        helperId: d.helperId || '',
        helperName: d.helperName || '',
        helperPhone: d.helperPhone,
        requesterName: d.requesterName || '',
        requesterPhone: d.requesterPhone,
        submitterRole: d.submitterRole || 'helper',
        disputeType: d.disputeType || 'other',
        status: d.status || 'pending',
        description: d.description || '',
        workDate: d.workDate || '',
        courierName: d.courierName,
        invoiceNumber: d.invoiceNumber,
        requestedDeliveryCount: d.requestedDeliveryCount,
        requestedReturnCount: d.requestedReturnCount,
        requestedPickupCount: d.requestedPickupCount,
        requestedOtherCount: d.requestedOtherCount,
        evidencePhotoUrls: d.evidencePhotoUrls || [],
        resolution: d.resolution,
        resolvedAt: d.resolvedAt,
        adminReply: d.adminReply,
        createdAt: d.createdAt,
      }));
    },
  });

  // 이의제기 상세 조회
  const { data: disputeDetail } = useQuery<Dispute>({
    queryKey: ['admin-dispute-detail', selectedDispute?.realId],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/helper-disputes/${selectedDispute!.realId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('이의제기 상세를 불러올 수 없습니다');
      return res.json();
    },
    enabled: !!selectedDispute?.realId && isDetailOpen,
  });

  // 상세 데이터가 있으면 merge
  const displayDispute: Dispute | null = selectedDispute ? {
    ...selectedDispute,
    ...(disputeDetail ? {
      profileImage: disputeDetail.profileImage,
      submitterName: disputeDetail.submitterName,
      adminNote: disputeDetail.adminNote || disputeDetail.adminReply,
      adminReplyAt: disputeDetail.adminReplyAt,
      order: disputeDetail.order,
      helper: disputeDetail.helper,
      requester: disputeDetail.requester,
      courierName: disputeDetail.courierName || selectedDispute.courierName,
      invoiceNumber: disputeDetail.invoiceNumber || selectedDispute.invoiceNumber,
      evidencePhotoUrls: disputeDetail.evidencePhotoUrls || selectedDispute.evidencePhotoUrls,
      resolution: disputeDetail.resolution || selectedDispute.resolution,
    } : {}),
  } : null;

  const { data: deductions = [], isLoading: deductionsLoading, refetch: refetchDeductions } = useQuery<Deduction[]>({
    queryKey: ['admin-deductions', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await adminFetch(`/api/admin/deductions?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // --- Mutations ---

  // 상태 변경 (reviewing, resolved, rejected)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ disputeId, status, resolution, adminReply }: { disputeId: number; status: string; resolution?: string; adminReply?: string }) => {
      const res = await adminFetch(`/api/admin/helper-disputes/${disputeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, resolution, adminReply }),
      });
      if (!res.ok) throw new Error('상태 변경에 실패했습니다');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-detail'] });
      const msg = variables.status === 'resolved' ? '이의제기 인정(해결)' :
                  variables.status === 'rejected' ? '이의제기 기각' :
                  variables.status === 'reviewing' ? '검토 시작' : '상태 변경';
      toast({ title: `${msg} 완료`, variant: 'success' });
      setIsDetailOpen(false);
      refetchDisputes();
    },
    onError: () => toast({ title: '상태 변경 실패', variant: 'error' }),
  });

  // 관리자 답변 (reply 엔드포인트 — disputes 테이블 우선 체크)
  const adminReplyMutation = useMutation({
    mutationFn: async ({ disputeId, reply }: { disputeId: number; reply: string }) => {
      const res = await adminFetch(`/api/admin/disputes/${disputeId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reply }),
      });
      if (!res.ok) throw new Error('답변 등록에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-detail'] });
      toast({ title: '관리자 답변 등록 완료', variant: 'success' });
      setAdminReplyText('');
      refetchDisputes();
    },
    onError: () => toast({ title: '답변 등록 실패', variant: 'error' }),
  });

  const handleRefresh = async () => {
    if (activeTab === 'disputes') {
      await refetchDisputes();
    } else {
      await refetchDeductions();
    }
    toast({ title: '새로고침 완료', variant: 'success' });
  };

  const handleDownloadExcel = () => {
    if (activeTab === 'disputes') {
      const headers = ['이의제기ID', '오더ID', '정산ID', '제출자', '역할', '이의유형', '상태', '작업일', '접수일', '배송건수', '반품건수', '집화건수', '기타건수'];
      const rows = (disputes as unknown as Record<string, unknown>[]).map((row: Record<string, unknown>) => [
        `#${row.id}`,
        row.orderId ?? '',
        row.settlementId ?? '',
        row.helperName || '',
        row.submitterRole === 'requester' ? '요청자' : '헬퍼',
        getTypeLabel(row.disputeType as string, row.submitterRole as string),
        STATUS_LABELS[row.status as string] || row.status || '',
        row.workDate || '',
        row.createdAt ? new Date(row.createdAt as string).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '',
        row.requestedDeliveryCount ?? '',
        row.requestedReturnCount ?? '',
        row.requestedPickupCount ?? '',
        row.requestedOtherCount ?? '',
      ]);
      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `이의제기목록_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['차감ID', '헬퍼', '금액', '사유', '연결분쟁', '정산반영', '생성일'];
      const rows = (deductions as unknown as Record<string, unknown>[]).map((row: Record<string, unknown>) => [
        `DED-${row.id}`,
        row.helperName || '',
        row.amount,
        row.reason || '',
        row.disputeId ? `DSP-${row.disputeId}` : '',
        row.settlementApplied ? '반영됨' : '대기',
        row.createdAt ? new Date(row.createdAt as string).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '',
      ]);
      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `차감목록_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast({ title: '다운로드 완료', variant: 'success' });
  };

  const statusCounts = {
    new: disputes.filter(d => d.status === 'pending').length,
    inReview: disputes.filter(d => d.status === 'reviewing').length,
    resolved: disputes.filter(d => ['resolved', 'rejected'].includes(d.status)).length,
  };

  const handleRowClick = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setAdminReplyText('');
    setIsDetailOpen(true);
  };

  const getTypeLabel = (type: string, submitterRole?: string) => {
    if (submitterRole === 'requester') {
      return REQUESTER_DISPUTE_TYPE_LABELS[type] || ALL_DISPUTE_TYPE_LABELS[type] || type;
    }
    return HELPER_DISPUTE_TYPE_LABELS[type] || ALL_DISPUTE_TYPE_LABELS[type] || type;
  };

  const getStepIndex = (status: string) => {
    if (status === 'pending') return 0;
    if (status === 'reviewing') return 1;
    if (['resolved', 'rejected'].includes(status)) return 2;
    return 0;
  };

  const disputeColumns: ColumnDef<Dispute>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 80,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'disputeType',
      header: '이의 유형',
      width: 120,
      render: (value, row) => (
        <span className="text-sm font-medium">{getTypeLabel(value, row.submitterRole)}</span>
      ),
    },
    {
      key: 'helperName',
      header: '제출자',
      width: 110,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="text-sm">{value || '-'}</span>
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium w-fit",
            row.submitterRole === 'requester' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
          )}>
            {row.submitterRole === 'requester' ? '요청자' : '헬퍼'}
          </span>
        </div>
      ),
    },
    {
      key: 'workDate',
      header: '작업일',
      width: 100,
      render: (value) => <span className="text-sm text-muted-foreground">{value || '-'}</span>,
    },
    {
      key: 'orderId',
      header: '오더',
      width: 150,
      render: (value, row) => value ? <EntityLink type="order" id={value} label={formatOrderNumber(row.orderNumber, value)} /> : <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => (
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[value] || 'bg-gray-100')}>
          {STATUS_LABELS[value] || value}
        </span>
      ),
    },
    {
      key: 'description',
      header: '내용',
      width: 200,
      render: (value: string) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block" title={value || ''}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: '접수일',
      width: 100,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {value ? new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
        </span>
      ),
    },
  ];

  const deductionColumns: ColumnDef<Deduction>[] = [
    {
      key: 'id',
      header: '차감ID',
      width: 100,
      render: (value) => <span className="font-mono text-sm">DED-{value}</span>,
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 100,
    },
    {
      key: 'amount',
      header: '금액',
      width: 100,
      align: 'right',
      render: (value) => (
        <span className="text-red-600">-<Money amount={value} size="sm" /></span>
      ),
    },
    {
      key: 'reason',
      header: '사유',
      width: 200,
      render: (value) => <span className="truncate max-w-[200px] block">{value}</span>,
    },
    {
      key: 'disputeId',
      header: '연결 분쟁',
      width: 100,
      render: (value) => value ? <EntityLink type="dispute" id={value} /> : <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'settlementApplied',
      header: '정산 반영',
      width: 100,
      render: (value) => <StatusBadge status={value ? 'APPROVED' : 'PENDING'} />,
    },
    {
      key: 'createdAt',
      header: '생성일',
      width: 100,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">이의제기관리</h1>
          <p className="text-muted-foreground">헬퍼/요청자 이의제기 처리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            엑셀 다운로드
          </Button>
          {activeTab === 'deductions' && (
            <Button size="sm" onClick={() => setIsDeductionModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              차감 추가
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">신규 분쟁</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.new}</div>
            <p className="text-xs text-muted-foreground">즉시 처리 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">검토중</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.inReview}</div>
            <p className="text-xs text-muted-foreground">담당자 배정됨</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">해결됨</CardTitle>
            <AlertTriangle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.resolved}</div>
            <p className="text-xs text-muted-foreground">이번 달 해결 건수</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('disputes')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'disputes'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          분쟁 목록
          {activeTab === 'disputes' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('deductions')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'deductions'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          차감 목록
          {activeTab === 'deductions' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>
              {activeTab === 'disputes' ? '분쟁 목록' : '차감 목록'}
              {activeTab === 'disputes' && selectedDisputeIds.size > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({selectedDisputeIds.size}개 선택됨)
                </span>
              )}
              {activeTab === 'deductions' && selectedDeductionIds.size > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({selectedDeductionIds.size}개 선택됨)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Input
                placeholder="검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Filter className="h-4 w-4 mr-2" />
                필터
                <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", filterOpen && "rotate-180")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'disputes' ? (
            <ExcelTable
              data={disputes}
              columns={disputeColumns}
              loading={disputesLoading}
              emptyMessage="분쟁 데이터가 없습니다"
              getRowId={(row) => row.id}
              storageKey="disputes-table"
              selectable
              selectedIds={selectedDisputeIds}
              onSelectionChange={setSelectedDisputeIds}
              onRowClick={handleRowClick}
              maxHeight="calc(100vh - 450px)"
            />
          ) : (
            <ExcelTable
              data={deductions}
              columns={deductionColumns}
              loading={deductionsLoading}
              emptyMessage="차감 데이터가 없습니다"
              getRowId={(row) => row.id}
              storageKey="deductions-table"
              selectable
              selectedIds={selectedDeductionIds}
              onSelectionChange={setSelectedDeductionIds}
              maxHeight="calc(100vh - 450px)"
            />
          )}
        </CardContent>
      </Card>

      {/* ===== 이의제기 상세 모달 ===== */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {displayDispute && (() => {
            const status = displayDispute.status;
            const stepIdx = getStepIndex(status);
            const isRejected = status === 'rejected';
            const steps = [
              { key: 'pending', label: '접수' },
              { key: 'reviewing', label: '검토 중' },
              { key: 'resolved', label: '완료' },
            ];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">이의제기</span>
                    #{displayDispute.realId}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {getTypeLabel(displayDispute.disputeType, displayDispute.submitterRole)}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                {/* 프로그레스 스테퍼 */}
                <div className="flex items-center justify-center gap-0 my-4">
                  {steps.map((step, idx) => (
                    <div key={step.key} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2',
                          idx < stepIdx ? 'bg-green-500 border-green-500 text-white' :
                          idx === stepIdx && isRejected && idx === 2 ? 'bg-red-500 border-red-500 text-white' :
                          idx === stepIdx ? 'bg-blue-500 border-blue-500 text-white' :
                          'bg-gray-100 border-gray-300 text-gray-400'
                        )}>
                          {idx < stepIdx ? <CheckCircle className="w-4 h-4" /> :
                           idx === stepIdx && isRejected ? <XCircle className="w-4 h-4" /> :
                           idx + 1}
                        </div>
                        <span className={cn(
                          'text-xs mt-1',
                          idx <= stepIdx ? 'text-foreground font-medium' : 'text-muted-foreground'
                        )}>
                          {isRejected && idx === 2 ? '기각' : step.label}
                        </span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={cn(
                          'w-16 h-0.5 mx-2 mt-[-14px]',
                          idx < stepIdx ? 'bg-green-500' : 'bg-gray-200'
                        )} />
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-3 gap-3 text-sm bg-muted/30 rounded-lg p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">이의 유형</p>
                      <p className="font-medium">{getTypeLabel(displayDispute.disputeType, displayDispute.submitterRole)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">상태</p>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[status] || 'bg-gray-100')}>
                        {STATUS_LABELS[status] || status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">제출자</p>
                      <p className="font-medium">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          displayDispute.submitterRole === 'requester' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {displayDispute.submitterRole === 'requester' ? '요청자' : '헬퍼'}
                        </span>
                        <span className="ml-1">{displayDispute.submitterName || displayDispute.helperName}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">작업일</p>
                      <p className="font-medium">{displayDispute.workDate || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">접수일</p>
                      <p className="font-medium">{displayDispute.createdAt ? new Date(displayDispute.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">오더</p>
                      <p className="font-medium">{displayDispute.orderId ? <EntityLink type="order" id={displayDispute.orderId} label={formatOrderNumber(displayDispute.orderNumber, displayDispute.orderId)} /> : '-'}</p>
                    </div>
                    {displayDispute.settlementId && (
                      <div>
                        <p className="text-xs text-muted-foreground">정산ID</p>
                        <p className="font-medium">#{displayDispute.settlementId}</p>
                      </div>
                    )}
                  </div>

                  {/* 이의제기 내용 */}
                  {displayDispute.description && (
                    <div className="bg-muted/20 rounded-lg p-4">
                      <p className="text-sm font-medium mb-1 flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        이의제기 사유
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{displayDispute.description}</p>
                    </div>
                  )}

                  {/* 수량 수정 요청 (핵심 섹션) */}
                  {(displayDispute.requestedDeliveryCount != null || displayDispute.requestedReturnCount != null ||
                    displayDispute.requestedPickupCount != null || displayDispute.requestedOtherCount != null) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium mb-3 flex items-center gap-1 text-blue-800">
                        <AlertTriangle className="w-4 h-4" />
                        수량 수정 요청
                      </p>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div className="text-center bg-white rounded p-2 border">
                          <p className="text-xs text-muted-foreground mb-1">배송</p>
                          <p className="text-lg font-bold text-blue-700">{displayDispute.requestedDeliveryCount ?? '-'}</p>
                          <p className="text-[10px] text-muted-foreground">건</p>
                        </div>
                        <div className="text-center bg-white rounded p-2 border">
                          <p className="text-xs text-muted-foreground mb-1">반품</p>
                          <p className="text-lg font-bold text-orange-600">{displayDispute.requestedReturnCount ?? '-'}</p>
                          <p className="text-[10px] text-muted-foreground">건</p>
                        </div>
                        <div className="text-center bg-white rounded p-2 border">
                          <p className="text-xs text-muted-foreground mb-1">집화</p>
                          <p className="text-lg font-bold text-green-600">{displayDispute.requestedPickupCount ?? '-'}</p>
                          <p className="text-[10px] text-muted-foreground">건</p>
                        </div>
                        <div className="text-center bg-white rounded p-2 border">
                          <p className="text-xs text-muted-foreground mb-1">기타</p>
                          <p className="text-lg font-bold text-gray-600">{displayDispute.requestedOtherCount ?? '-'}</p>
                          <p className="text-[10px] text-muted-foreground">건</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 운송 정보 */}
                  {(displayDispute.courierName || displayDispute.invoiceNumber) && (
                    <div className="bg-muted/20 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">운송 정보</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {displayDispute.courierName && (
                          <div>
                            <p className="text-xs text-muted-foreground">운송사</p>
                            <p className="font-medium">{displayDispute.courierName}</p>
                          </div>
                        )}
                        {displayDispute.invoiceNumber && (
                          <div>
                            <p className="text-xs text-muted-foreground">송장번호</p>
                            <p className="font-medium font-mono">{displayDispute.invoiceNumber}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 오더/요청자/헬퍼 정보 (상세 API에서 가져온 데이터) */}
                  {(displayDispute.order || displayDispute.helper || displayDispute.requester) && (
                    <div className="grid grid-cols-2 gap-3">
                      {displayDispute.helper && (
                        <div className="bg-muted/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">헬퍼</p>
                          </div>
                          <p className="text-sm font-medium">{displayDispute.helper.name}</p>
                          {displayDispute.helper.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" />{displayDispute.helper.phone}
                            </p>
                          )}
                        </div>
                      )}
                      {displayDispute.requester && (
                        <div className="bg-muted/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">요청자 (업체)</p>
                          </div>
                          <p className="text-sm font-medium">{displayDispute.requester.name}</p>
                          {displayDispute.requester.companyName && (
                            <p className="text-xs text-muted-foreground">{displayDispute.requester.companyName}</p>
                          )}
                          {displayDispute.requester.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" />{displayDispute.requester.phone}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 증빙 사진 */}
                  {displayDispute.evidencePhotoUrls && displayDispute.evidencePhotoUrls.length > 0 && (
                    <div className="bg-muted/20 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        증빙 자료 ({displayDispute.evidencePhotoUrls.length})
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {displayDispute.evidencePhotoUrls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                             className="block aspect-square bg-gray-100 rounded overflow-hidden hover:opacity-80">
                            <img src={url} alt={`증빙 ${idx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 관리자 답변/처리 결과 */}
                  {(displayDispute.adminReply || displayDispute.adminNote || displayDispute.resolution) && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium text-emerald-800">관리자 처리 내역</p>
                      {(displayDispute.adminReply || displayDispute.adminNote) && (
                        <div>
                          <p className="text-xs text-muted-foreground">관리자 답변</p>
                          <p className="text-sm whitespace-pre-wrap">{displayDispute.adminReply || displayDispute.adminNote}</p>
                        </div>
                      )}
                      {displayDispute.resolution && (
                        <div>
                          <p className="text-xs text-muted-foreground">처리 결과</p>
                          <p className="text-sm whitespace-pre-wrap">{displayDispute.resolution}</p>
                        </div>
                      )}
                      {displayDispute.resolvedAt && (
                        <p className="text-xs text-muted-foreground">
                          처리일: {new Date(displayDispute.resolvedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 관리자 답변 입력 (미완료 상태) */}
                  {!['resolved', 'rejected'].includes(status) && (
                    <div className="bg-muted/20 rounded-lg p-4 space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        관리자 답변 / 처리 메모
                      </Label>
                      <Textarea
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="이의제기에 대한 답변 또는 처리 사유를 입력하세요..."
                        rows={3}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (adminReplyText.trim().length < 5) {
                            toast({ title: '답변은 5자 이상 입력해 주세요.', variant: 'error' });
                            return;
                          }
                          adminReplyMutation.mutate({ disputeId: displayDispute.realId, reply: adminReplyText });
                        }}
                        disabled={adminReplyMutation.isPending || !adminReplyText.trim()}
                      >
                        답변 등록
                      </Button>
                    </div>
                  )}
                </div>

                {/* 액션 버튼 */}
                <DialogFooter className="flex flex-wrap gap-2 sm:justify-start">
                  {/* 오더 상세 이동 */}
                  {displayDispute.orderId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      asChild
                    >
                      <Link to={`/closings?orderId=${displayDispute.orderId}`}>
                        <ExternalLink className="w-4 h-4 mr-1" />
                        오더 보기
                      </Link>
                    </Button>
                  )}
                  {/* 정산 상세 이동 (이의제기 해당 건) */}
                  {displayDispute.settlementId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                      asChild
                    >
                      <Link to={`/settlements?id=${displayDispute.settlementId}`}>
                        <Wallet className="w-4 h-4 mr-1" />
                        정산 보기
                      </Link>
                    </Button>
                  )}

                  {status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => updateStatusMutation.mutate({ disputeId: displayDispute.realId, status: 'reviewing' })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      검토 시작
                    </Button>
                  )}
                  {status === 'reviewing' && (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          const reply = adminReplyText.trim() || '이의제기 인정 처리';
                          updateStatusMutation.mutate({
                            disputeId: displayDispute.realId,
                            status: 'resolved',
                            resolution: reply,
                            adminReply: reply,
                          });
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        인정 (수량 수정 반영)
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const reply = adminReplyText.trim() || '이의제기 기각 처리';
                          updateStatusMutation.mutate({
                            disputeId: displayDispute.realId,
                            status: 'rejected',
                            resolution: reply,
                            adminReply: reply,
                          });
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        기각
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                    닫기
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ReasonModal
        isOpen={isDeductionModalOpen}
        onClose={() => setIsDeductionModalOpen(false)}
        onSubmit={() => setIsDeductionModalOpen(false)}
        title="차감 추가"
        description="차감 사유를 입력해 주세요."
        submitText="차감 생성"
      />
    </div>
  );
}
