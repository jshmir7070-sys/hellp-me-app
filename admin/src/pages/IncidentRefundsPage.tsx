/**
 * Incident Refunds Page - 재설계 버전
 * 화물사고 환불 관리
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - FilterBar로 탭 통합
 * - EmptyState 추가
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { adminFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, RefreshCw, Eye, AlertTriangle, DollarSign, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DateRangePicker, getDefaultDateRange } from '@/components/common';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface IncidentRefund {
  id: number;
  orderId: number;
  incidentType: string;
  description: string;
  requestedAmount: number;
  refundAmount: number | null;
  requesterRefundApplied: boolean;
  refundConfirmedAt: string | null;
  status: string;
  createdAt: string;
  requesterName: string | null;
  requesterPhone: string | null;
  orderInfo: {
    id: number;
    courierCompany: string;
    scheduledDate: string;
  } | null;
}

const TYPE_LABELS: Record<string, string> = {
  damage: '파손',
  loss: '분실',
  misdelivery: '오배송',
  delay: '지연배송',
  other: '기타',
};

export default function IncidentRefundsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange(30));
  const [selectedIncident, setSelectedIncident] = useState<IncidentRefund | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [adminMemo, setAdminMemo] = useState('');

  const { data: refunds = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/incident-refunds', activeTab, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: activeTab,
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await adminFetch(`/api/admin/incident-refunds?${params}`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Failed to fetch');
      }
      return res.json();
    },
  });

  const confirmRefundMutation = useMutation({
    mutationFn: async (data: { incidentId: number; adminMemo?: string }) => {
      const res = await adminFetch(`/api/admin/incident-reports/${data.incidentId}/confirm-refund`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminMemo: data.adminMemo }),
      });
      if (!res.ok) throw new Error('Failed to confirm refund');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incident-refunds'] });
      toast({ title: '환불 확정 완료', description: '요청자 환불이 확정되었습니다.' });
      setShowConfirmModal(false);
      setSelectedIncident(null);
      setAdminMemo('');
    },
    onError: () => {
      toast({ title: '환불 확정 실패', variant: 'destructive' });
    },
  });

  const handleConfirmRefund = () => {
    if (selectedIncident) {
      confirmRefundMutation.mutate({
        incidentId: selectedIncident.id,
        adminMemo: adminMemo || undefined,
      });
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const openConfirmModal = (incident: IncidentRefund) => {
    setSelectedIncident(incident);
    setAdminMemo('');
    setShowConfirmModal(true);
  };

  // 통계 계산
  const stats = useMemo(() => {
    const pending = refunds.filter((r: IncidentRefund) => !r.requesterRefundApplied);
    const completed = refunds.filter((r: IncidentRefund) => r.requesterRefundApplied);
    const totalPending = pending.reduce((sum: number, r: IncidentRefund) => sum + (r.requestedAmount || 0), 0);
    const totalCompleted = completed.reduce((sum: number, r: IncidentRefund) => sum + (r.refundAmount || 0), 0);

    return {
      pendingCount: pending.length,
      completedCount: completed.length,
      totalPending,
      totalCompleted,
    };
  }, [refunds]);

  const columns: ColumnDef<IncidentRefund>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => <SortableHeader column={column}>ID</SortableHeader>,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.id}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>접수일</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm">{new Date(row.original.createdAt).toLocaleDateString('ko-KR')}</span>
      ),
    },
    {
      accessorKey: 'orderInfo',
      header: '오더',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.orderInfo ? (
            <>
              <div className="font-medium">#{row.original.orderInfo.id}</div>
              <div className="text-xs text-muted-foreground">{row.original.orderInfo.courierCompany}</div>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'requesterName',
      header: '요청자',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">{row.original.requesterName || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.original.requesterPhone || ''}</div>
        </div>
      ),
    },
    {
      accessorKey: 'incidentType',
      header: '사고유형',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[row.original.incidentType] || row.original.incidentType}
        </Badge>
      ),
    },
    {
      accessorKey: 'requestedAmount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>요청금액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <span className="text-sm">{row.original.requestedAmount?.toLocaleString() || 0}원</span>
        </div>
      ),
    },
    {
      accessorKey: 'refundAmount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>환불금액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <span className="font-medium text-green-600">
            {row.original.refundAmount ? `${row.original.refundAmount.toLocaleString()}원` : '-'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'requesterRefundApplied',
      header: '상태',
      cell: ({ row }) => (
        <Badge variant={row.original.requesterRefundApplied ? 'default' : 'outline'} className="text-xs">
          {row.original.requesterRefundApplied ? '환불완료' : '대기'}
        </Badge>
      ),
    },
    {
      accessorKey: 'refundConfirmedAt',
      header: ({ column }) => <SortableHeader column={column}>확정일</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.refundConfirmedAt ? new Date(row.original.refundConfirmedAt).toLocaleDateString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {!row.original.requesterRefundApplied ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openConfirmModal(row.original)}
              className="h-7 px-2"
            >
              <Check className="h-3 w-3 mr-1" />
              환불확정
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2">
              <Eye className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // 로딩 중
  if (isLoading && refunds.length === 0) {
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
        title="화물사고 환불"
        description="화물사고 관련 요청자 환불 관리 • 실시간 모니터링"
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            새로고침
          </Button>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid columns={4}>
        <StatsCard
          title="환불 대기 (건)"
          value={stats.pendingCount}
          description="확정 대기 중"
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          variant={stats.pendingCount > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="환불 대기 (금액)"
          value={`${stats.totalPending.toLocaleString()}원`}
          description="대기 총액"
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          variant="default"
        />
        <StatsCard
          title="환불 완료 (건)"
          value={stats.completedCount}
          description="확정 완료"
          icon={<Check className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatsCard
          title="환불 완료 (금액)"
          value={`${stats.totalCompleted.toLocaleString()}원`}
          description="완료 총액"
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          variant="default"
        />
      </StatsGrid>

      {/* 필터 바 */}
      <FilterBar
        filters={[
          {
            key: 'status',
            label: '환불 상태',
            options: [
              { label: `환불 대기 (${stats.pendingCount})`, value: 'pending' },
              { label: `환불 완료 (${stats.completedCount})`, value: 'completed' },
            ],
            value: activeTab,
            onChange: (value) => setActiveTab(value as 'pending' | 'completed'),
          },
        ]}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* 데이터 테이블 */}
      {refunds.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="h-12 w-12 text-muted-foreground" />}
          title="환불 내역이 없습니다"
          description="선택한 기간의 환불 내역이 없습니다."
        />
      ) : (
        <DataTable
          columns={columns}
          data={refunds}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 550px)"
          loading={isLoading}
        />
      )}

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>환불 확정</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">오더</span>
                  <span className="font-medium">#{selectedIncident.orderInfo?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">요청자</span>
                  <span className="font-medium">{selectedIncident.requesterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">사고유형</span>
                  <span className="font-medium">{TYPE_LABELS[selectedIncident.incidentType] || selectedIncident.incidentType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">요청금액</span>
                  <span className="font-medium text-green-600">{selectedIncident.requestedAmount?.toLocaleString()}원</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>관리자 메모 (선택)</Label>
                <Textarea
                  value={adminMemo}
                  onChange={(e) => setAdminMemo(e.target.value)}
                  placeholder="환불 관련 메모"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              취소
            </Button>
            <Button
              onClick={handleConfirmRefund}
              disabled={confirmRefundMutation.isPending}
            >
              환불 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
