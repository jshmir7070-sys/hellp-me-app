import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker, getDefaultDateRange } from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';

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

  const columns: ColumnDef<Deduction>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 60,
      render: (value) => <span className="font-mono text-xs">{value}</span>,
    },
    {
      key: 'createdAt',
      header: '생성일',
      width: 100,
      render: (value) => (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ),
    },
    {
      key: 'orderInfo',
      header: '오더',
      width: 120,
      render: (value) => (
        <div className="text-sm">
          {value ? (
            <>
              <div className="font-medium">#{value.id}</div>
              <div className="text-xs text-muted-foreground">{value.courierCompany}</div>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'targetName',
      header: '대상자',
      width: 120,
      render: (value, row) => (
        <div className="text-sm">
          <div className="font-medium">{value || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.targetPhone || ''}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: '유형',
      width: 80,
      render: (value) => (
        <Badge variant="outline" className="text-xs">
          {CATEGORY_LABELS[value || 'other'] || value}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: '차감금액',
      width: 100,
      align: 'right',
      render: (value) => (
        <span className="font-medium text-red-600">
          -{value.toLocaleString()}원
        </span>
      ),
    },
    {
      key: 'reason',
      header: '사유',
      width: 200,
      render: (value) => (
        <span className="text-sm line-clamp-2">{value}</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: 80,
      render: (value) => {
        const statusInfo = STATUS_LABELS[value] || { label: value, variant: 'outline' as const };
        return (
          <Badge variant={statusInfo.variant} className="text-xs">
            {statusInfo.label}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: '액션',
      width: 120,
      render: (_, row) => (
        <div className="flex gap-1">
          {row.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyMutation.mutate(row.id)}
                disabled={applyMutation.isPending}
                className="h-7 px-2"
              >
                <Check className="h-3 w-3 mr-1" />
                적용
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelMutation.mutate(row.id)}
                disabled={cancelMutation.isPending}
                className="h-7 px-2 text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
          {row.status !== 'pending' && (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
  ];

  const totalPending = deductions.filter((d: Deduction) => d.status === 'pending').reduce((sum: number, d: Deduction) => sum + d.amount, 0);
  const totalApplied = deductions.filter((d: Deduction) => d.status === 'applied').reduce((sum: number, d: Deduction) => sum + d.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">화물사고차감</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            수동 차감
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">대기 중 차감</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalPending.toLocaleString()}원
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">적용된 차감</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalApplied.toLocaleString()}원
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">차감 목록</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="applied">적용됨</SelectItem>
                  <SelectItem value="cancelled">취소됨</SelectItem>
                </SelectContent>
              </Select>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ExcelTable
            columns={columns}
            data={deductions}
            loading={isLoading}
            emptyMessage="차감 내역이 없습니다"
            
          />
        </CardContent>
      </Card>

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
