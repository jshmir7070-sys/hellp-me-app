/**
 * Payments Page - 재설계 버전
 * 결제 관리 - 실패/웹훅 미수신/취소/환불 처리
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - FilterBar로 뷰 통합
 * - 액션 버튼 UI 개선
 * - Toast 알림으로 변경
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  StatusBadge,
  Money,
  UserCell,
  EntityLink,
  DateRangePicker,
  getDefaultDateRange,
  DrawerDetail,
  ReasonModal,
  AuditTrail,
} from '@/components/common';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard, AlertTriangle, CheckCircle, RefreshCw, Download, Webhook, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Payment {
  id: number;
  contractId: number;
  requesterId: number;
  requesterName: string;
  amount: number;
  method: string;
  status: string;
  requestedAt: string;
  completedAt?: string;
  webhookReceived: boolean;
  retryCount: number;
}

const refundTemplates = [
  { id: '1', label: '고객 요청', text: '고객 요청에 따른 결제 취소/환불입니다.' },
  { id: '2', label: '이중 결제', text: '이중 결제 발생으로 인한 환불입니다.' },
  { id: '3', label: '오더 취소', text: '오더 취소에 따른 결제 환불입니다.' },
];

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState(getDefaultDateRange(7));
  const [activeView, setActiveView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('timeline');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'payments' | 'webhooks'>('payments');

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['admin-payments', dateRange, activeView],
    queryFn: async () => {
      try {
        const data = await apiRequest<any[]>('/payments');
        return data.map((p: any, idx: number) => ({
          id: p.id || idx + 1,
          contractId: p.contractId || idx + 200,
          requesterId: p.requesterId || 0,
          requesterName: p.requesterName || `요청자${idx + 1}`,
          amount: p.amount || 100000,
          method: p.method || 'CARD',
          status: p.status || 'PAID',
          requestedAt: p.requestedAt || p.createdAt || new Date().toISOString(),
          completedAt: p.completedAt,
          webhookReceived: p.webhookReceived !== false,
          retryCount: p.retryCount || 0,
        }));
      } catch {
        return [];
      }
    },
  });

  const refundMutation = useMutation({
    mutationFn: async ({ paymentId, reason, amount }: { paymentId: number; reason: string; amount?: number }) => {
      return apiRequest(`/payments/${paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason, amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      setIsRefundModalOpen(false);
      setIsDrawerOpen(false);
      setSelectedPayment(null);
      toast({ title: '환불 처리가 완료되었습니다.' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: number; reason?: string }) => {
      return apiRequest(`/payments/${paymentId}/sync`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast({ title: '동기화가 완료되었습니다.' });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: number; reason: string }) => {
      return apiRequest(`/payments/${paymentId}/retry`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      setIsRetryModalOpen(false);
      setSelectedPayment(null);
      toast({ title: '재시도 처리가 완료되었습니다.' });
    },
  });

  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);

  // 통계 계산
  const stats = useMemo(() => {
    const total = payments.length;
    const failed = payments.filter(p => p.status === 'FAILED').length;
    const webhookMissing = payments.filter(p => !p.webhookReceived && p.status === 'PAID').length;
    const completed = payments.filter(p => p.status === 'PAID' || p.status === 'CONFIRMED').length;
    const totalAmount = payments
      .filter(p => p.status === 'PAID' || p.status === 'CONFIRMED')
      .reduce((sum, p) => sum + p.amount, 0);

    return { total, failed, webhookMissing, completed, totalAmount };
  }, [payments]);

  const viewCounts = {
    failed: stats.failed,
    webhook_missing: stats.webhookMissing,
    pending: payments.filter(p => p.status === 'PENDING').length,
  };

  const filteredPayments = payments.filter((payment) => {
    if (activeView === 'failed' && payment.status !== 'FAILED') return false;
    if (activeView === 'webhook_missing' && (payment.webhookReceived || payment.status !== 'PAID')) return false;
    if (activeView === 'pending' && payment.status !== 'PENDING') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return String(payment.id).includes(q) ||
        payment.requesterName.toLowerCase().includes(q);
    }
    return true;
  });

  const handleRowClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setDrawerTab('timeline');
    setIsDrawerOpen(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredPayments.map((item) => ({
      '결제ID': item.id,
      '계약ID': item.contractId,
      '요청자ID': item.requesterId,
      '요청자명': item.requesterName,
      '금액': item.amount,
      '결제수단': getMethodLabel(item.method),
      '결제상태': item.status,
      '요청시각': new Date(item.requestedAt).toLocaleString('ko-KR'),
      '완료시각': item.completedAt ? new Date(item.completedAt).toLocaleString('ko-KR') : '',
      '웹훅수신': item.webhookReceived ? 'Y' : 'N',
      '재시도횟수': item.retryCount,
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
    link.download = `결제목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      CARD: '카드',
      VBANK: '가상계좌',
      TRANSFER: '계좌이체',
    };
    return methods[method] || method;
  };

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => <SortableHeader column={column}>결제ID</SortableHeader>,
      cell: ({ row }) => <EntityLink type="payment" id={row.original.id} />,
    },
    {
      accessorKey: 'contractId',
      header: ({ column }) => <SortableHeader column={column}>계약ID</SortableHeader>,
      cell: ({ row }) => <EntityLink type="contract" id={row.original.contractId} />,
    },
    {
      accessorKey: 'requesterName',
      header: '요청자',
      cell: ({ row }) => (
        <UserCell
          name={row.original.requesterName}
          id={row.original.requesterId}
          role="requester"
        />
      ),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>금액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <Money amount={row.original.amount} size="sm" />
        </div>
      ),
    },
    {
      accessorKey: 'method',
      header: '수단',
      cell: ({ row }) => (
        <span className="text-sm">{getMethodLabel(row.original.method)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: '결제상태',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'requestedAt',
      header: ({ column }) => <SortableHeader column={column}>요청시각</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.requestedAt).toLocaleString('ko-KR')}
        </span>
      ),
    },
    {
      accessorKey: 'completedAt',
      header: ({ column }) => <SortableHeader column={column}>완료시각</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.completedAt ? new Date(row.original.completedAt).toLocaleString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'webhookReceived',
      header: '웹훅수신',
      cell: ({ row }) => (
        <div className="flex justify-center">
          {row.original.webhookReceived ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      ),
    },
    {
      accessorKey: 'retryCount',
      header: ({ column }) => (
        <div className="text-center">
          <SortableHeader column={column}>재시도</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center text-sm">{row.original.retryCount}</div>
      ),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!row.original.webhookReceived && row.original.status === 'PAID' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                syncMutation.mutate({ paymentId: row.original.id, reason: 'PG 상태 동기화' });
              }}
              disabled={syncMutation.isPending}
              title="PG 동기화"
            >
              <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
            </Button>
          )}
          {row.original.status === 'FAILED' && row.original.retryCount < 3 && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPayment(row.original);
                setIsRetryModalOpen(true);
              }}
              title="재시도"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // 로딩 중
  if (isLoading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <PageHeader
        title="결제 관리"
        description="결제 실패/웹훅 미수신/취소/환불까지 금전 사고를 제로화 • 실시간 모니터링"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
          </>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid>
        <StatsCard
          title="오늘 결제"
          value={stats.total}
          description="총 결제 건수"
          icon={<CreditCard className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="실패"
          value={stats.failed}
          description="재처리 필요"
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          variant={stats.failed > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="웹훅 미수신"
          value={stats.webhookMissing}
          description="확인 필요"
          icon={<Webhook className="h-5 w-5 text-amber-500" />}
          variant={stats.webhookMissing > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="완료"
          value={stats.completed}
          description="정상 처리"
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          variant="success"
        />
      </StatsGrid>

      {/* 필터 바 */}
      <FilterBar
        filters={[
          {
            key: 'status',
            label: '결제 상태',
            options: [
              { label: `전체 (${stats.total})`, value: 'all' },
              { label: `실패 (${viewCounts.failed})`, value: 'failed' },
              { label: `웹훅 미수신 (${viewCounts.webhook_missing})`, value: 'webhook_missing' },
              { label: `대기중 (${viewCounts.pending})`, value: 'pending' },
            ],
            value: activeView,
            onChange: (value) => setActiveView(value),
          },
        ]}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="결제ID, 요청자 검색..."
      />

      {/* 탭 */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('payments')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'payments'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          결제 트랜잭션
          {activeTab === 'payments' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'webhooks'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          웹훅 로그
          {activeTab === 'webhooks' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* 결제 트랜잭션 테이블 */}
      {activeTab === 'payments' && (
        filteredPayments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-12 w-12 text-muted-foreground" />}
            title="결제 데이터가 없습니다"
            description="선택한 필터에 해당하는 결제 내역이 없습니다."
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredPayments}
            pageSize={20}
            fixedHeader={true}
            maxHeight="calc(100vh - 550px)"
            loading={isLoading}
            onRowClick={handleRowClick}
          />
        )
      )}

      {/* 웹훅 로그 탭 */}
      {activeTab === 'webhooks' && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<Webhook className="h-12 w-12 text-muted-foreground" />}
              title="웹훅 로그"
              description="웹훅 로그 기능은 추후 구현 예정입니다."
            />
          </CardContent>
        </Card>
      )}

      <DrawerDetail
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`결제 PAY-${selectedPayment?.id}`}
        subtitle={selectedPayment?.requesterName}
        tabs={[
          {
            id: 'timeline',
            label: '타임라인',
            content: (
              <AuditTrail
                events={[
                  {
                    id: '1',
                    action: '결제 요청',
                    actor: selectedPayment?.requesterName || '',
                    timestamp: selectedPayment?.requestedAt || '',
                  },
                  ...(selectedPayment?.completedAt ? [{
                    id: '2',
                    action: '결제 완료',
                    actor: 'System',
                    timestamp: selectedPayment.completedAt,
                  }] : []),
                ]}
              />
            ),
          },
          {
            id: 'webhook',
            label: '웹훅 로그',
            content: (
              <div className="text-center py-8 text-muted-foreground">
                웹훅 로그 (추후 구현)
              </div>
            ),
          },
          {
            id: 'impact',
            label: '연결 정산',
            content: (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    {selectedPayment?.status === 'PAID' || selectedPayment?.status === 'CONFIRMED'
                      ? '정산이 생성되었습니다'
                      : '결제 미완료로 정산이 생성되지 않았습니다'}
                  </p>
                </div>
              </div>
            ),
          },
        ]}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        footer={
          (selectedPayment?.status === 'PAID' || selectedPayment?.status === 'CONFIRMED') && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setIsRefundModalOpen(true)}
            >
              환불/취소
            </Button>
          )
        }
      />

      <ReasonModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onSubmit={(reason) => {
          if (selectedPayment) {
            refundMutation.mutate({ paymentId: selectedPayment.id, reason });
          }
        }}
        title="환불/취소"
        description="환불 사유를 입력해 주세요. 이 작업은 되돌릴 수 없습니다."
        submitText="환불 처리"
        variant="destructive"
        templates={refundTemplates}
        isLoading={refundMutation.isPending}
      />

      <ReasonModal
        isOpen={isRetryModalOpen}
        onClose={() => setIsRetryModalOpen(false)}
        onSubmit={(reason) => {
          if (selectedPayment) {
            retryMutation.mutate({ paymentId: selectedPayment.id, reason });
          }
        }}
        title="결제 재시도"
        description="재시도 사유를 입력해 주세요. 최대 3회까지 재시도할 수 있습니다."
        submitText="재시도"
        variant="default"
        templates={[
          { id: '1', label: '일시적 오류', text: 'PG사 일시적 오류로 인한 재시도입니다.' },
          { id: '2', label: '카드 한도', text: '카드 한도 초과 후 고객 요청에 따른 재시도입니다.' },
          { id: '3', label: '네트워크 오류', text: '네트워크 오류로 인한 재시도입니다.' },
        ]}
        isLoading={retryMutation.isPending}
      />
    </div>
  );
}
