import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Eye, Building2, RefreshCw, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';

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
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
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

  const columns: ColumnDef<PendingRequester>[] = [
    {
      key: 'createdAt',
      header: '가입일',
      width: 100,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleDateString('ko-KR')}
        </span>
      ),
    },
    {
      key: 'email',
      header: '이메일(아이디)',
      width: 200,
      render: (value) => <span className="text-sm">{value || '-'}</span>,
    },
    {
      key: 'companyName',
      header: '업체명',
      width: 150,
      render: (value) => <span className="font-medium">{value || '-'}</span>,
    },
    {
      key: 'name',
      header: '담당자',
      width: 100,
      render: (value) => value,
    },
    {
      key: 'phone',
      header: '연락처',
      width: 120,
      render: (value) => value,
    },
    {
      key: 'id',
      header: '액션',
      width: 120,
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedRequester(row); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={(e) => { e.stopPropagation(); approveMutation.mutate(row.id); }}
            disabled={approveMutation.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => { e.stopPropagation(); setSelectedRequester(row); setShowRejectModal(true); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">신규 요청자 승인</h1>
          <Badge variant="outline" className="mt-1">{requesters.length}명 대기중</Badge>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            승인 대기 목록
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={requesters}
            columns={columns}
            loading={isLoading}
            emptyMessage="승인 대기 중인 요청자가 없습니다"
            getRowId={(row) => row.id}
            storageKey="requesters-pending-page"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>요청자 반려</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">반려 사유</label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="반려 사유를 입력하세요" className="mt-2" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>취소</Button>
              <Button variant="destructive" onClick={() => selectedRequester && rejectMutation.mutate({ id: selectedRequester.id, reason: rejectReason })} disabled={!rejectReason.trim() || rejectMutation.isPending}>반려하기</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequester && !showRejectModal} onOpenChange={() => setSelectedRequester(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>요청자 상세 - #{selectedRequester?.id}</DialogTitle></DialogHeader>
          {selectedRequester ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><h4 className="text-sm font-medium text-muted-foreground">고유번호</h4><p className="font-mono text-sm">{selectedRequester.id}</p></div>
                <div><h4 className="text-sm font-medium text-muted-foreground">업체명</h4><p>{selectedRequester.companyName || '-'}</p></div>
                <div><h4 className="text-sm font-medium text-muted-foreground">담당자</h4><p>{selectedRequester.name}</p></div>
                <div><h4 className="text-sm font-medium text-muted-foreground">연락처</h4><p>{selectedRequester.phone}</p></div>
                <div><h4 className="text-sm font-medium text-muted-foreground">이메일(아이디)</h4><p>{selectedRequester.email}</p></div>
                <div><h4 className="text-sm font-medium text-muted-foreground">가입일</h4><p>{new Date(selectedRequester.createdAt).toLocaleDateString('ko-KR')}</p></div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setShowRejectModal(true)}><X className="h-4 w-4 mr-2" />반려</Button>
                <Button onClick={() => approveMutation.mutate(selectedRequester.id)} disabled={approveMutation.isPending}><Check className="h-4 w-4 mr-2" />승인</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
