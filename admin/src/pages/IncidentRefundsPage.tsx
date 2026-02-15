import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DateRangePicker, getDefaultDateRange } from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
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

  const columns: ColumnDef<IncidentRefund>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 60,
      render: (value) => <span className="font-mono text-xs">{value}</span>,
    },
    {
      key: 'createdAt',
      header: '접수일',
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
      key: 'requesterName',
      header: '요청자',
      width: 120,
      render: (value, row) => (
        <div className="text-sm">
          <div className="font-medium">{value || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.requesterPhone || ''}</div>
        </div>
      ),
    },
    {
      key: 'incidentType',
      header: '사고유형',
      width: 80,
      render: (value) => (
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      key: 'requestedAmount',
      header: '요청금액',
      width: 100,
      align: 'right',
      render: (value) => (
        <span className="text-sm">{value?.toLocaleString() || 0}원</span>
      ),
    },
    {
      key: 'refundAmount',
      header: '환불금액',
      width: 100,
      align: 'right',
      render: (value) => (
        <span className="font-medium text-green-600">
          {value ? `${value.toLocaleString()}원` : '-'}
        </span>
      ),
    },
    {
      key: 'requesterRefundApplied',
      header: '상태',
      width: 80,
      render: (value) => (
        <Badge variant={value ? 'default' : 'outline'} className="text-xs">
          {value ? '환불완료' : '대기'}
        </Badge>
      ),
    },
    {
      key: 'refundConfirmedAt',
      header: '확정일',
      width: 100,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {value ? new Date(value).toLocaleDateString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '액션',
      width: 100,
      render: (_, row) => (
        <div className="flex gap-1">
          {!row.requesterRefundApplied ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openConfirmModal(row)}
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

  const totalPending = refunds.filter((r: IncidentRefund) => !r.requesterRefundApplied).reduce((sum: number, r: IncidentRefund) => sum + (r.requestedAmount || 0), 0);
  const totalCompleted = refunds.filter((r: IncidentRefund) => r.requesterRefundApplied).reduce((sum: number, r: IncidentRefund) => sum + (r.refundAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">화물사고 환불</h1>
          <p className="text-muted-foreground">화물사고 관련 요청자 환불 관리</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">환불 대기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalPending.toLocaleString()}원
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">환불 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalCompleted.toLocaleString()}원
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'pending'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          환불 대기
          {activeTab === 'pending' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'completed'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          환불 완료
          {activeTab === 'completed' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">환불 목록</CardTitle>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </CardHeader>
        <CardContent>
          <ExcelTable
            columns={columns}
            data={refunds}
            loading={isLoading}
            emptyMessage="환불 내역이 없습니다"
          />
        </CardContent>
      </Card>

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
