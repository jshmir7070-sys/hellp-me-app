/**
 * Requesters Pending Page - 재설계 버전
 * 신규 요청자 승인 관리
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - Dialog 모달 유지
 * - EmptyState 추가
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { adminFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Eye, Building2, RefreshCw, Download, Clock, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface PendingRequester {
  id: number;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  createdAt: string;
  status: string;
}

export default function RequestersPendingPage() {
  const [selectedRequester, setSelectedRequester] = useState<PendingRequester | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requesters = [], isLoading } = useQuery({
    queryKey: ['/api/admin/requesters', 'pending'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/requesters?status=pending');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/api/admin/requesters/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '요청자 승인 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/requesters'] });
      setSelectedRequester(null);
    },
    onError: () => {
      toast({ title: '승인 실패', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await adminFetch(`/api/admin/requesters/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '요청자 반려 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/requesters'] });
      setSelectedRequester(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: () => {
      toast({ title: '반려 실패', variant: 'destructive' });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/requesters', 'pending'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = requesters.map((item: PendingRequester) => ({
      '가입일': new Date(item.createdAt).toLocaleDateString('ko-KR'),
      '요청자ID': item.id,
      '업체명': item.companyName || '',
      '담당자': item.name || '',
      '연락처': item.phone || '',
      '이메일': item.email || '',
      '상태': item.status || '',
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
    link.download = `요청자대기_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 통계 계산
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = requesters.filter((r: PendingRequester) => new Date(r.createdAt) >= today).length;
    const avgWaitDays = requesters.length > 0
      ? Math.round(requesters.reduce((sum: number, r: PendingRequester) => {
          const days = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / requesters.length)
      : 0;

    return { total: requesters.length, todayCount, avgWaitDays };
  }, [requesters]);

  const columns: ColumnDef<PendingRequester>[] = [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>가입일</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString('ko-KR')}
        </span>
      ),
    },
    {
      accessorKey: 'email',
      header: '이메일(아이디)',
      cell: ({ row }) => <span className="text-sm">{row.original.email || '-'}</span>,
    },
    {
      accessorKey: 'companyName',
      header: '업체명',
      cell: ({ row }) => <span className="font-medium">{row.original.companyName || '-'}</span>,
    },
    {
      accessorKey: 'name',
      header: '담당자',
      cell: ({ row }) => <span className="text-sm">{row.original.name}</span>,
    },
    {
      accessorKey: 'phone',
      header: '연락처',
      cell: ({ row }) => <span className="text-sm">{row.original.phone}</span>,
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRequester(row.original);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={(e) => {
              e.stopPropagation();
              approveMutation.mutate(row.original.id);
            }}
            disabled={approveMutation.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRequester(row.original);
              setShowRejectModal(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // 로딩 중
  if (isLoading && requesters.length === 0) {
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
        title="신규 요청자 승인"
        description="신규 가입한 요청자의 승인 관리 • 실시간 알림"
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
      <StatsGrid columns={3}>
        <StatsCard
          title="승인 대기"
          value={stats.total}
          description="전체 대기 건수"
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          variant={stats.total > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="오늘 신규"
          value={stats.todayCount}
          description="금일 가입자"
          icon={<UserPlus className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="평균 대기"
          value={`${stats.avgWaitDays}일`}
          description="평균 대기 기간"
          icon={<Building2 className="h-5 w-5 text-purple-500" />}
          variant="default"
        />
      </StatsGrid>

      {/* 데이터 테이블 */}
      {requesters.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12 text-muted-foreground" />}
          title="승인 대기 중인 요청자가 없습니다"
          description="모든 요청자가 승인되었거나 대기 중인 신청이 없습니다."
        />
      ) : (
        <DataTable
          columns={columns}
          data={requesters}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 500px)"
          loading={isLoading}
        />
      )}

      {/* 반려 사유 입력 모달 */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>요청자 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">반려 사유</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요"
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequester && rejectMutation.mutate({ id: selectedRequester.id, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              반려하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 요청자 상세 보기 모달 */}
      <Dialog open={!!selectedRequester && !showRejectModal} onOpenChange={() => setSelectedRequester(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>요청자 상세 - #{selectedRequester?.id}</DialogTitle>
          </DialogHeader>
          {selectedRequester ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">고유번호</h4>
                  <p className="font-mono text-sm">{selectedRequester.id}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">업체명</h4>
                  <p>{selectedRequester.companyName || '-'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">담당자</h4>
                  <p>{selectedRequester.name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">연락처</h4>
                  <p>{selectedRequester.phone}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">이메일(아이디)</h4>
                  <p>{selectedRequester.email}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">가입일</h4>
                  <p>{new Date(selectedRequester.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(true);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              반려
            </Button>
            <Button
              onClick={() => selectedRequester && approveMutation.mutate(selectedRequester.id)}
              disabled={approveMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              승인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
