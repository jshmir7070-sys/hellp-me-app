import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  SavedViews,
  DrawerDetail,
  ReasonModal,
  AuditTrail,
} from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { CreditCard, AlertTriangle, CheckCircle, RefreshCw, Download, Filter, ChevronDown, Webhook, RotateCcw } from 'lucide-react';
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

const savedViews = [
  { id: 'all', label: '전체' },
  { id: 'failed', label: '실패', count: 0 },
  { id: 'webhook_missing', label: '웹훅 미수신', count: 0 },
  { id: 'pending', label: '대기중', count: 0 },
];

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
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

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
      window.alert('환불 처리가 완료되었습니다.');
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
      window.alert('동기화가 완료되었습니다.');
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
      window.alert('재시도 처리가 완료되었습니다.');
    },
  });

  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);

  const viewCounts = {
    failed: payments.filter(p => p.status === 'FAILED').length,
    webhook_missing: payments.filter(p => !p.webhookReceived && p.status === 'PAID').length,
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
      key: 'id',
      header: '결제ID',
      width: 90,
      render: (value) => <EntityLink type="payment" id={value} />,
    },
    {
      key: 'contractId',
      header: '계약ID',
      width: 90,
      render: (value) => <EntityLink type="contract" id={value} />,
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 120,
      render: (value, row) => (
        <UserCell
          name={value}
          id={row.requesterId}
          role="requester"
        />
      ),
    },
    {
      key: 'amount',
      header: '금액',
      width: 110,
      align: 'right',
      render: (value) => <Money amount={value} size="sm" />,
    },
    {
      key: 'method',
      header: '수단',
      width: 80,
      render: (value) => getMethodLabel(value),
    },
    {
      key: 'status',
      header: '결제상태',
      width: 90,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'requestedAt',
      header: '요청시각',
      width: 140,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleString('ko-KR')}
        </span>
      ),
    },
    {
      key: 'completedAt',
      header: '완료시각',
      width: 140,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {value ? new Date(value).toLocaleString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      key: 'webhookReceived',
      header: '웹훅수신',
      width: 80,
      align: 'center',
      render: (value) => value ? (
        <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
      ),
    },
    {
      key: 'retryCount',
      header: '재시도',
      width: 70,
      align: 'center',
      render: (value) => value,
    },
    {
      key: 'id',
      header: '액션',
      width: 100,
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!row.webhookReceived && row.status === 'PAID' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                syncMutation.mutate({ paymentId: row.id, reason: 'PG 상태 동기화' });
              }}
              disabled={syncMutation.isPending}
              title="PG 동기화"
            >
              <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
            </Button>
          )}
          {row.status === 'FAILED' && row.retryCount < 3 && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPayment(row);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">결제 관리</h1>
          <p className="text-muted-foreground">결제 실패/웹훅 미수신/취소/환불까지 금전 사고를 제로화</p>
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 결제</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
            <p className="text-xs text-muted-foreground">총 결제 건수</p>
          </CardContent>
        </Card>
        <Card className={cn(viewCounts.failed > 0 && 'border-red-500')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">실패</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{viewCounts.failed}</div>
            <p className="text-xs text-muted-foreground">재처리 필요</p>
          </CardContent>
        </Card>
        <Card className={cn(viewCounts.webhook_missing > 0 && 'border-amber-500')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">웹훅 미수신</CardTitle>
            <Webhook className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{viewCounts.webhook_missing}</div>
            <p className="text-xs text-muted-foreground">확인 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payments.filter(p => p.status === 'PAID' || p.status === 'CONFIRMED').length}
            </div>
            <p className="text-xs text-muted-foreground">정상 처리</p>
          </CardContent>
        </Card>
      </div>

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

      {activeTab === 'payments' && (
        <>
          <SavedViews
            views={savedViews.map(v => ({
              ...v,
              count: viewCounts[v.id as keyof typeof viewCounts],
            }))}
            activeView={activeView}
            onSelect={setActiveView}
          />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-lg">
                    결제 목록
                    {selectedIds.size > 0 && (
                      <span className="ml-2 text-sm font-normal text-primary">
                        ({selectedIds.size}건 선택)
                      </span>
                    )}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-4">
                  <DateRangePicker value={dateRange} onChange={setDateRange} />
                  <Input
                    placeholder="결제ID, 요청자 검색..."
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
              <ExcelTable
                data={filteredPayments}
                columns={columns}
                loading={isLoading}
                emptyMessage="결제 데이터가 없습니다."
                getRowId={(row) => row.id}
                storageKey="payments-page"
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                maxHeight="calc(100vh - 450px)"
                onRowClick={handleRowClick}
              />
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'webhooks' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              웹훅 로그 목록 (추후 구현)
            </div>
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
