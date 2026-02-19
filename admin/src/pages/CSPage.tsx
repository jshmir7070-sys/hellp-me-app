import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Eye, CheckCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';

interface CSTicket {
  id: number;
  orderId: number | null;
  userId: number;
  userName: string;
  userRole: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  inquiry: '문의',
  complaint: '불만',
  refund: '환불',
  other: '기타',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function CSPage() {
  const [selectedTicket, setSelectedTicket] = useState<CSTicket | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const queryClient = useQueryClient();

  const resolveTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const res = await adminFetch(`/api/admin/cs/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      if (!res.ok) throw new Error('상태 변경 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cs'] });
      toast({ title: 'CS 티켓이 해결되었습니다', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'CS 티켓 상태 변경 실패', variant: 'error' });
    },
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['/api/admin/cs'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/cs');
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Failed to fetch');
      }
      return res.json();
    },
  });

  const columns: ColumnDef<CSTicket>[] = [
    {
      key: 'id',
      header: '티켓ID',
      width: 80,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'orderId',
      header: '오더ID',
      width: 80,
      render: (value) => <span className="font-mono text-sm">{value ? `#${value}` : '-'}</span>,
    },
    {
      key: 'userName',
      header: '요청자/헬퍼',
      width: 120,
      render: (value, row) => (
        <div>
          <div>{value}</div>
          <div className="text-xs text-muted-foreground">
            {row.userRole === 'helper' ? '헬퍼' : '요청자'}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: '유형',
      width: 80,
      render: (value) => <Badge variant="outline">{TYPE_LABELS[value] || value}</Badge>,
    },
    {
      key: 'subject',
      header: '제목',
      width: 200,
      render: (value) => <span className="truncate block max-w-xs">{value}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: 80,
      align: 'center',
      render: (value) => (
        <Badge className={STATUS_COLORS[value] || 'bg-gray-100'}>
          {value === 'open' ? '대기' : 
           value === 'in_progress' ? '처리중' : 
           value === 'resolved' ? '해결' : '종료'}
        </Badge>
      ),
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
    {
      key: 'id',
      header: '액션',
      width: 100,
      align: 'center',
      render: (_, row) => (
        <div className="flex justify-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSelectedTicket(row)}>
            <Eye className="h-4 w-4" />
          </Button>
          {row.status !== 'resolved' ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-green-600"
              onClick={(e) => {
                e.stopPropagation();
                resolveTicketMutation.mutate(row.id);
              }}
              disabled={resolveTicketMutation.isPending}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">C/S</h1>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            처리대기 {tickets.filter((t: CSTicket) => t.status === 'open').length}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            CS 티켓
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={tickets}
            columns={columns}
            loading={isLoading}
            emptyMessage="등록된 CS 티켓이 없습니다"
            getRowId={(row) => row.id}
            storageKey="cs-tickets"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>CS 티켓 #{selectedTicket?.id}</DialogTitle>
          </DialogHeader>
          {selectedTicket ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">요청자/헬퍼</h4>
                  <p>{selectedTicket.userName} ({selectedTicket.userRole === 'helper' ? '헬퍼' : '요청자'})</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">오더</h4>
                  <p>{selectedTicket.orderId ? `#${selectedTicket.orderId}` : '-'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">유형</h4>
                  <p>{TYPE_LABELS[selectedTicket.type] || selectedTicket.type}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">생성일</h4>
                  <p>{new Date(selectedTicket.createdAt).toLocaleString('ko-KR')}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">제목</h4>
                <p>{selectedTicket.subject}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">내용</h4>
                <p className="text-sm bg-muted/50 p-3 rounded">{selectedTicket.message}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
