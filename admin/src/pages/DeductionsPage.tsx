/**
 * Deductions Page - 재설계 버전
 * 화물사고 차감 관리
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - FilterBar 적용
 * - EmptyState 추가
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { adminFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Plus, RefreshCw, AlertTriangle, DollarSign, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker, getDefaultDateRange } from '@/components/common';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface Deduction {
  id: number;
  orderId: number | null;
  incidentId: number | null;
  helperId: string | null;
  requesterId: string | null;
  targetType: string;
  targetId: string;
  amount: number;
  reason: string;
  category: string | null;
  status: string;
  appliedToSettlementId: number | null;
  appliedAt: string | null;
  createdBy: string | null;
  memo: string | null;
  createdAt: string;
  targetName: string | null;
  targetPhone: string | null;
  orderInfo: {
    id: number;
    courierCompany: string;
    scheduledDate: string;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '대기', variant: 'outline' },
  applied: { label: '적용됨', variant: 'default' },
  cancelled: { label: '취소됨', variant: 'secondary' },
};

const CATEGORY_LABELS: Record<string, string> = {
  damage: '화물사고',
  delay: '지연',
  dispute: '분쟁',
  other: '기타',
};

export default function DeductionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange(30));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    targetId: '',
    amount: '',
    reason: '',
    category: 'other',
    memo: '',
  });

  const { data: deductions = [], isLoading } = useQuery({
    queryKey: ['/api/admin/deductions', statusFilter, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await adminFetch(`/api/admin/deductions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/api/admin/deductions/${id}/apply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to apply');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deductions'] });
      toast({ title: '차감이 적용되었습니다.' });
    },
    onError: () => {
      toast({ title: '차감 적용에 실패했습니다.', variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/api/admin/deductions/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '관리자 취소' }),
      });
      if (!res.ok) throw new Error('Failed to cancel');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deductions'] });
      toast({ title: '차감이 취소되었습니다.' });
    },
    onError: () => {
      toast({ title: '차감 취소에 실패했습니다.', variant: 'destructive' });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await adminFetch('/api/admin/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'helper',
          targetId: data.targetId,
          amount: parseInt(data.amount, 10),
          reason: data.reason,
          category: data.category,
          memo: data.memo,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deductions'] });
      setShowCreateModal(false);
      setCreateForm({ targetId: '', amount: '', reason: '', category: 'other', memo: '' });
      toast({ title: '차감이 생성되었습니다.' });
    },
    onError: () => {
      toast({ title: '차감 생성에 실패했습니다.', variant: 'destructive' });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/deductions'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  // 통계 계산
  const stats = useMemo(() => {
    const pending = deductions.filter((d: Deduction) => d.status === 'pending');
    const applied = deductions.filter((d: Deduction) => d.status === 'applied');
    const cancelled = deductions.filter((d: Deduction) => d.status === 'cancelled');
    const totalPending = pending.reduce((sum: number, d: Deduction) => sum + d.amount, 0);
    const totalApplied = applied.reduce((sum: number, d: Deduction) => sum + d.amount, 0);

    return {
      pendingCount: pending.length,
      appliedCount: applied.length,
      cancelledCount: cancelled.length,
      totalPending,
      totalApplied,
    };
  }, [deductions]);

  const columns: ColumnDef<Deduction>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => <SortableHeader column={column}>ID</SortableHeader>,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.id}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>생성일</SortableHeader>,
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
      accessorKey: 'targetName',
      header: '대상자',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">{row.original.targetName || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.original.targetPhone || ''}</div>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: '유형',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {CATEGORY_LABELS[row.original.category || 'other'] || row.original.category}
        </Badge>
      ),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>차감금액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <span className="font-medium text-red-600">
            -{row.original.amount.toLocaleString()}원
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'reason',
      header: '사유',
      cell: ({ row }) => (
        <span className="text-sm line-clamp-2">{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => {
        const statusInfo = STATUS_LABELS[row.original.status] || { label: row.original.status, variant: 'outline' as const };
        return (
          <Badge variant={statusInfo.variant} className="text-xs">
            {statusInfo.label}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyMutation.mutate(row.original.id)}
                disabled={applyMutation.isPending}
                className="h-7 px-2"
              >
                <Check className="h-3 w-3 mr-1" />
                적용
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelMutation.mutate(row.original.id)}
                disabled={cancelMutation.isPending}
                className="h-7 px-2 text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
          {row.original.status !== 'pending' && (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
  ];

  // 로딩 중
  if (isLoading && deductions.length === 0) {
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
        title="화물사고 차감"
        description="화물사고 관련 차감 관리 • 실시간 정산 연동"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              수동 차감
            </Button>
          </>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid>
        <StatsCard
          title="대기 중 차감"
          value={`${stats.totalPending.toLocaleString()}원`}
          description={`${stats.pendingCount}건`}
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          variant={stats.pendingCount > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="적용된 차감"
          value={`${stats.totalApplied.toLocaleString()}원`}
          description={`${stats.appliedCount}건`}
          icon={<Minus className="h-5 w-5 text-red-500" />}
          variant="default"
        />
        <StatsCard
          title="취소된 차감"
          value={stats.cancelledCount}
          description="관리자 취소"
          icon={<X className="h-5 w-5 text-gray-500" />}
          variant="default"
        />
        <StatsCard
          title="전체 건수"
          value={deductions.length}
          description="총 차감 건수"
          icon={<DollarSign className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
      </StatsGrid>

      {/* 필터 바 */}
      <FilterBar
        filters={[
          {
            key: 'status',
            label: '차감 상태',
            options: [
              { label: `전체 (${deductions.length})`, value: 'all' },
              { label: `대기 (${stats.pendingCount})`, value: 'pending' },
              { label: `적용됨 (${stats.appliedCount})`, value: 'applied' },
              { label: `취소됨 (${stats.cancelledCount})`, value: 'cancelled' },
            ],
            value: statusFilter,
            onChange: (value) => setStatusFilter(value),
          },
        ]}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* 데이터 테이블 */}
      {deductions.length === 0 ? (
        <EmptyState
          icon={<Minus className="h-12 w-12 text-muted-foreground" />}
          title="차감 내역이 없습니다"
          description="선택한 기간의 차감 내역이 없습니다."
        />
      ) : (
        <DataTable
          columns={columns}
          data={deductions}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 550px)"
          loading={isLoading}
        />
      )}

      {/* 수동 차감 생성 모달 */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수동 차감 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>대상자 ID</Label>
              <Input
                value={createForm.targetId}
                onChange={(e) => setCreateForm({ ...createForm, targetId: e.target.value })}
                placeholder="헬퍼 또는 요청자 ID"
              />
            </div>
            <div className="space-y-2">
              <Label>차감 금액</Label>
              <Input
                type="number"
                value={createForm.amount}
                onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                placeholder="금액 (원)"
              />
            </div>
            <div className="space-y-2">
              <Label>유형</Label>
              <Select
                value={createForm.category}
                onValueChange={(v) => setCreateForm({ ...createForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">화물사고</SelectItem>
                  <SelectItem value="delay">지연</SelectItem>
                  <SelectItem value="dispute">분쟁</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>사유</Label>
              <Textarea
                value={createForm.reason}
                onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                placeholder="차감 사유를 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Input
                value={createForm.memo}
                onChange={(e) => setCreateForm({ ...createForm, memo: e.target.value })}
                placeholder="관리자 메모"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              취소
            </Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.targetId || !createForm.amount || !createForm.reason || createMutation.isPending}
            >
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
