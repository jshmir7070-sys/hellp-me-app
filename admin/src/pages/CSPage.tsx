import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Eye, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader, StatsGrid, StatsCard } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

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

  const stats = useMemo(() => {
    const open = tickets.filter((t: CSTicket) => t.status === 'open').length;
    const inProgress = tickets.filter((t: CSTicket) => t.status === 'in_progress').length;
    const resolved = tickets.filter((t: CSTicket) => t.status === 'resolved').length;
    const total = tickets.length;
    return { open, inProgress, resolved, total };
  }, [tickets]);

  const columns: ColumnDef<CSTicket>[] = useMemo(() => [
    {
      accessorKey: 'id',
      header: '티켓ID',
      cell: ({ row }) => <span className="font-mono text-sm">#{row.original.id}</span>,
    },
    {
      accessorKey: 'orderId',
      header: '오더ID',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.orderId ? `#${row.original.orderId}` : '-'}</span>,
    },
    {
      accessorKey: 'userName',
      header: '요청자/헬퍼',
      cell: ({ row }) => (
        <div>
          <div>{row.original.userName}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.userRole === 'helper' ? '헬퍼' : '요청자'}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: '유형',
      cell: ({ row }) => <Badge variant="outline">{TYPE_LABELS[row.original.type] || row.original.type}</Badge>,
    },
    {
      accessorKey: 'subject',
      header: '제목',
      cell: ({ row }) => <span className="truncate block max-w-xs">{row.original.subject}</span>,
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => (
        <Badge className={STATUS_COLORS[row.original.status] || 'bg-gray-100'}>
          {row.original.status === 'open' ? '대기' :
           row.original.status === 'in_progress' ? '처리중' :
           row.original.status === 'resolved' ? '해결' : '종료'}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: '생성일',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString('ko-KR')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div className="flex justify-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSelectedTicket(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
          {row.original.status !== 'resolved' ? (
            <Button size="sm" variant="ghost" className="text-green-600">
              <CheckCircle className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="C/S" description="고객 서비스 티켓 관리" />

      <StatsGrid>
        <StatsCard
          title="전체 티켓"
          value={stats.total}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatsCard
          title="처리 대기"
          value={stats.open}
          icon={<Clock className="h-4 w-4" />}
          description={stats.open > 0 ? "대기 중인 티켓" : "모두 처리됨"}
        />
        <StatsCard
          title="처리 중"
          value={stats.inProgress}
          icon={<AlertCircle className="h-4 w-4" />}
        />
        <StatsCard
          title="해결 완료"
          value={stats.resolved}
          icon={<CheckCircle className="h-4 w-4" />}
        />
      </StatsGrid>

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
          {tickets.length === 0 && !isLoading ? (
            <EmptyState
              icon={<MessageSquare className="h-12 w-12" />}
              title="등록된 CS 티켓이 없습니다"
              description="고객 서비스 문의가 접수되면 여기에 표시됩니다"
            />
          ) : (
            <DataTable
              columns={columns}
              data={tickets}
              loading={isLoading}
              maxHeight="calc(100vh - 550px)"
            />
          )}
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
