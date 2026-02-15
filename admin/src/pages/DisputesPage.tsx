import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { StatusBadge, EntityLink, DateRangePicker, getDefaultDateRange, Money, DrawerDetail, ReasonModal } from '@/components/common';
import { AlertTriangle, Plus, RefreshCw, Download, Filter, ChevronDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Dispute {
  id: number;
  orderId: number;
  contractId: number;
  requesterId: number;
  requesterName: string;
  helperId: number;
  helperName: string;
  type: string;
  status: string;
  createdAt: string;
  requestedAmount: number;
  confirmedAmount?: number;
  assignee?: string;
  submitterRole?: 'helper' | 'requester';
  description?: string;
}

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

const disputeTypes = [
  { id: 'damage', label: '파손' },
  { id: 'loss', label: '분실' },
  { id: 'wrong_delivery', label: '오배송' },
  { id: 'settlement_error', label: '정산 금액 오류' },
  { id: 'invoice_error', label: '세금계산서 오류' },
  { id: 'contract_dispute', label: '계약 조건 분쟁' },
  { id: 'service_complaint', label: '서비스 불만' },
  { id: 'delay', label: '일정 관련' },
  { id: 'other', label: '기타' },
];

export default function DisputesPage() {
    const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const orderIdFilter = searchParams.get('orderId');
  
  const [dateRange, setDateRange] = useState(getDefaultDateRange(30));
  const [activeTab, setActiveTab] = useState<'disputes' | 'deductions'>('disputes');
  const [searchQuery, setSearchQuery] = useState(orderIdFilter || '');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('summary');
  const [isDeductionModalOpen, setIsDeductionModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isResolveNoRefundModalOpen, setIsResolveNoRefundModalOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedDisputeIds, setSelectedDisputeIds] = useState<Set<string | number>>(new Set());
  const [selectedDeductionIds, setSelectedDeductionIds] = useState<Set<string | number>>(new Set());

  const { data: disputes = [], isLoading: disputesLoading, refetch: refetchDisputes } = useQuery<Dispute[]>({
    queryKey: ['admin-disputes', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await adminFetch(`/api/admin/disputes?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch disputes');
      const data = await res.json();
      // Handle new format: { incidents: [...], helperDisputes: [...] }
      if (data.incidents || data.helperDisputes) {
        const allDisputes: Dispute[] = [];
        // Add legacy incidents
        if (Array.isArray(data.incidents)) {
          data.incidents.forEach((i: any) => allDisputes.push({
            id: i.id,
            orderId: i.orderId || i.contractInfo?.orderId,
            contractId: i.jobContractId,
            requesterId: i.reporterId,
            requesterName: i.reporterName || '미확인',
            helperId: 0,
            helperName: '',
            type: i.type || i.issueType || 'other',
            status: i.status,
            createdAt: i.createdAt,
            requestedAmount: i.requestedAmount || 0,
            confirmedAmount: i.confirmedAmount,
            assignee: i.reviewerId,
          }));
        }
        // Add disputes (이의제기 - helper and requester)
        if (Array.isArray(data.helperDisputes)) {
          data.helperDisputes.forEach((d: any) => allDisputes.push({
            id: d.id + 100000, // Offset to avoid ID collision with incidents
            orderId: d.orderId,
            contractId: 0,
            requesterId: 0,
            requesterName: d.requesterName || '',
            helperId: d.helperId,
            helperName: d.helperName || '',
            type: d.disputeType || 'other',
            status: d.status,
            createdAt: d.createdAt,
            requestedAmount: 0,
            confirmedAmount: undefined,
            assignee: undefined,
            submitterRole: d.submitterRole || 'helper',
            description: d.description || '',
          }));
        }
        return allDisputes;
      }
      return Array.isArray(data) ? data : (data.items || []);
    },
  });

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

  const confirmRefundMutation = useMutation({
    mutationFn: async ({ disputeId, amount, reason }: { disputeId: number; amount: number; reason: string }) => {
      const res = await adminFetch(`/api/admin/disputes/${disputeId}/confirm-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount, reason }),
      });
      if (!res.ok) throw new Error('환불 확정에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      toast({ title: '환불 확정 완료' });
      setIsDrawerOpen(false);
      setIsRefundModalOpen(false);
      refetchDisputes();
    },
    onError: () => {
      toast({ title: '환불 확정 실패', variant: 'destructive' });
    },
  });

  const handleConfirmRefund = (reason: string) => {
    if (selectedDispute) {
      confirmRefundMutation.mutate({
        disputeId: selectedDispute.id,
        amount: selectedDispute.confirmedAmount || selectedDispute.requestedAmount,
        reason,
      });
    }
  };

  const resolveNoRefundMutation = useMutation({
    mutationFn: async ({ disputeId, reason, resolutionType }: { disputeId: number; reason: string; resolutionType: string }) => {
      const res = await adminFetch(`/api/admin/disputes/${disputeId}/resolve-without-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason, resolutionType }),
      });
      if (!res.ok) throw new Error('분쟁 해결에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      toast({ title: '분쟁 해결 완료', description: '환불 없이 분쟁이 해결되었습니다.' });
      setIsDrawerOpen(false);
      setIsResolveNoRefundModalOpen(false);
    },
    onError: () => {
      toast({ title: '분쟁 해결 실패', variant: 'destructive' });
    },
  });

  const handleResolveNoRefund = (reason: string) => {
    if (selectedDispute) {
      resolveNoRefundMutation.mutate({
        disputeId: selectedDispute.id,
        reason,
        resolutionType: 'item_found',
      });
    }
  };

  const handleRefresh = async () => {
    if (activeTab === 'disputes') {
      await refetchDisputes();
    } else {
      await refetchDeductions();
    }
    toast({ title: '새로고침 완료' });
  };

  const handleDownloadExcel = () => {
    if (activeTab === 'disputes') {
      const headers = ['분쟁ID', '오더ID', '계약ID', '요청자', '헬퍼', '유형', '상태', '접수일', '요청금액', '확정금액', '담당자'];
      const rows = (disputes as unknown as Record<string, unknown>[]).map((row: Record<string, unknown>) => [
        `DSP-${row.id}`,
        row.orderId,
        row.contractId,
        row.requesterName || '',
        row.helperName || '',
        disputeTypes.find(t => t.id === row.type)?.label || row.type || '',
        row.status,
        row.createdAt ? new Date(row.createdAt as string).toLocaleDateString('ko-KR') : '',
        row.requestedAmount,
        row.confirmedAmount ?? '',
        row.assignee || '',
      ]);
      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `분쟁목록_${new Date().toISOString().slice(0, 10)}.csv`;
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
        row.createdAt ? new Date(row.createdAt as string).toLocaleDateString('ko-KR') : '',
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
    toast({ title: '다운로드 완료' });
  };

  const statusCounts = {
    new: disputes.filter(d => d.status === 'NEW').length,
    inReview: disputes.filter(d => d.status === 'IN_REVIEW').length,
    resolved: disputes.filter(d => d.status === 'RESOLVED').length,
  };

  const handleRowClick = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setDrawerTab('summary');
    setIsDrawerOpen(true);
  };

  const getTypeLabel = (type: string) => {
    const found = disputeTypes.find(t => t.id === type);
    return found ? found.label : type;
  };

  const disputeColumns: ColumnDef<Dispute>[] = [
    {
      key: 'id',
      header: '분쟁ID',
      width: 100,
      render: (value) => <span className="font-mono text-sm">DSP-{value}</span>,
    },
    {
      key: 'orderId',
      header: '오더/계약',
      width: 120,
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          <EntityLink type="order" id={value} />
          <EntityLink type="contract" id={row.contractId} />
        </div>
      ),
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 100,
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 100,
    },
    {
      key: 'submitterRole',
      header: '제출자',
      width: 80,
      render: (value: string) => (
        <span className={cn(
          "px-2 py-0.5 rounded text-xs font-medium",
          value === 'requester' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        )}>
          {value === 'requester' ? '요청자' : '헬퍼'}
        </span>
      ),
    },
    {
      key: 'type',
      header: '유형',
      width: 80,
      render: (value) => getTypeLabel(value),
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => <StatusBadge status={value} />,
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
          {new Date(value).toLocaleDateString('ko-KR')}
        </span>
      ),
    },
    {
      key: 'requestedAmount',
      header: '금액(요청/확정)',
      width: 140,
      align: 'right',
      render: (value, row) => (
        <div className="flex flex-col items-end">
          <Money amount={value} size="sm" />
          {row.confirmedAmount !== undefined && (
            <span className="text-xs text-emerald-600">
              확정: <Money amount={row.confirmedAmount} size="sm" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'assignee',
      header: '담당자',
      width: 80,
      render: (value) => value || '-',
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
          {new Date(value).toLocaleDateString('ko-KR')}
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

      <DrawerDetail
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`분쟁 DSP-${selectedDispute?.id}`}
        subtitle={`${selectedDispute?.requesterName} vs ${selectedDispute?.helperName}`}
        tabs={[
          {
            id: 'summary',
            label: '요약',
            content: (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">분쟁 유형</span>
                    <p className="font-medium">{selectedDispute ? getTypeLabel(selectedDispute.type) : '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">상태</span>
                    <p><StatusBadge status={selectedDispute?.status || ''} /></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">요청 금액</span>
                    <p className="font-medium"><Money amount={selectedDispute?.requestedAmount || 0} /></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">확정 금액</span>
                    <p className="font-medium">
                      {selectedDispute?.confirmedAmount !== undefined ? (
                        <Money amount={selectedDispute.confirmedAmount} />
                      ) : (
                        <span className="text-muted-foreground">미확정</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'timeline',
            label: '처리 이력',
            content: (
              <div className="text-sm text-muted-foreground text-center py-8">
                처리 이력이 없습니다
              </div>
            ),
          },
        ]}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        footer={
          selectedDispute?.status !== 'RESOLVED' ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                상태 변경
              </Button>
              <Button variant="outline" size="sm">
                차감 생성
              </Button>
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => setIsResolveNoRefundModalOpen(true)}
              >
                환불 없이 해결
              </Button>
              <Button 
                size="sm"
                onClick={() => setIsRefundModalOpen(true)}
              >
                환불 확정
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsDrawerOpen(false)}
              >
                닫기
              </Button>
            </div>
          )
        }
      />

      <ReasonModal
        isOpen={isDeductionModalOpen}
        onClose={() => setIsDeductionModalOpen(false)}
        onSubmit={() => {
          setIsDeductionModalOpen(false);
        }}
        title="차감 추가"
        description="차감 사유를 입력해 주세요."
        submitText="차감 생성"
      />

      <ReasonModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onSubmit={handleConfirmRefund}
        title="환불 확정"
        description={`환불 금액: ${(selectedDispute?.confirmedAmount || selectedDispute?.requestedAmount || 0).toLocaleString()}원\n환불 사유를 입력해 주세요.`}
        submitText="환불 확정"
        isLoading={confirmRefundMutation.isPending}
      />

      <ReasonModal
        isOpen={isResolveNoRefundModalOpen}
        onClose={() => setIsResolveNoRefundModalOpen(false)}
        onSubmit={handleResolveNoRefund}
        title="환불 없이 해결"
        description="물건을 찾았거나 당사자 간 합의가 이루어진 경우 환불 없이 분쟁을 해결합니다. 해결 사유를 입력해 주세요."
        submitText="분쟁 해결 완료"
        isLoading={resolveNoRefundMutation.isPending}
      />
    </div>
  );
}
