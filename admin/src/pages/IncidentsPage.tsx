import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Eye, Plus, ArrowRight, MessageSquare, RefreshCw, Send, Clock, User, ChevronRight, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { useToast } from '@/hooks/use-toast';

interface Incident {
  id: number;
  orderId: number;
  incidentType: string;
  description: string;
  requestedAmount: number | null;
  deductionAmount: number | null;
  deductionReason: string | null;
  adminReply: string | null;
  status: string;
  createdAt: string;
  evidenceUrls?: string[];
  helperStatus?: string;
  helperActionAt?: string;
  helperNote?: string;
  helperResponseDeadline?: string;
  helperResponseRequired?: boolean;
  adminForceProcessed?: boolean;
  adminForceProcessedAt?: string;
  adminForceProcessedReason?: string;
}

interface IncidentAction {
  id: number;
  incidentId: number;
  actionType: string;
  performedBy: number | null;
  performerName: string;
  notes: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  damage: '파손',
  loss: '분실',
  lost: '분실',
  misdelivery: '오배송',
  wrong_delivery: '오배송',
  delay: '지연',
  other: '기타',
  count_mismatch: '수량 불일치',
  amount_error: '금액 오류',
  freight_accident: '화물 사고',
  dispute: '정산 오류',
  complaint: '서비스 불만',
  settlement_error: '정산 금액 오류',
  invoice_error: '세금계산서 오류',
  contract_dispute: '계약 조건 분쟁',
  service_complaint: '서비스 불만',
};

const STATUS_LABELS: Record<string, string> = {
  submitted: '접수됨',
  pending: '검토 대기',
  reviewing: '검토 중',
  resolved: '해결됨',
  rejected: '기각됨',
  applied: '적용됨',
  cancelled: '취소됨',
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  applied: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  comment: '코멘트',
  status_change: '상태 변경',
  update: '정보 수정',
  reply: '답변 등록',
  evidence_request: '증빙 요청',
};

export default function IncidentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [adminReply, setAdminReply] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionReason, setDeductionReason] = useState('');
  const [deductionMethod, setDeductionMethod] = useState<'helper_deduct' | 'requester_refund' | 'both'>('both');

  const { data: incidents = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/incidents'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/incidents');
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Failed to fetch');
      }
      return res.json();
    },
  });

  const { data: actions = [], refetch: refetchActions } = useQuery({
    queryKey: ['/api/admin/incidents', selectedIncident?.id, 'actions'],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const res = await adminFetch(`/api/admin/incidents/${selectedIncident.id}/actions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedIncident,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { status?: string; deductionAmount?: number; deductionReason?: string; adminReply?: string }) => {
      const res = await adminFetch(`/api/admin/incidents/${selectedIncident!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '업데이트 완료', description: '사고 정보가 업데이트되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incidents'] });
      refetchActions();
      setNewStatus('');
      setAdminReply('');
      setDeductionAmount('');
      setDeductionReason('');
    },
    onError: () => {
      toast({ title: '오류', description: '업데이트에 실패했습니다.', variant: 'destructive' });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await adminFetch(`/api/admin/incidents/${selectedIncident!.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: 'comment', notes }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '코멘트 등록', description: '코멘트가 등록되었습니다.' });
      refetchActions();
      setNewComment('');
    },
    onError: () => {
      toast({ title: '오류', description: '코멘트 등록에 실패했습니다.', variant: 'destructive' });
    },
  });

  const handleStatusChange = () => {
    if (newStatus) {
      updateMutation.mutate({ status: newStatus });
    }
  };

  const handleReply = () => {
    if (adminReply.trim()) {
      updateMutation.mutate({ adminReply });
    }
  };

  const confirmDeductionMutation = useMutation({
    mutationFn: async (data: { deductionAmount: number; deductionReason: string; deductionMethod: string; adminMemo?: string }) => {
      const res = await adminFetch(`/api/admin/incidents/${selectedIncident!.id}/confirm-deduction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to confirm deduction');
      return res.json();
    },
    onSuccess: (data) => {
      const methods = [];
      if (data.helperDeductionApplied) methods.push('헬퍼 정산 공제');
      if (data.requesterRefundApplied) methods.push('요청자 환불');
      toast({ 
        title: '차감 확정 완료', 
        description: `${methods.join(' + ')} 처리되었습니다.` 
      });
      refetch();
      refetchActions();
      setSelectedIncident(null);
    },
    onError: () => {
      toast({ title: '오류', description: '차감 확정에 실패했습니다.', variant: 'destructive' });
    },
  });

  const handleDeduction = () => {
    const amount = parseInt(deductionAmount);
    if (!isNaN(amount) && amount > 0 && deductionReason.trim()) {
      confirmDeductionMutation.mutate({ 
        deductionAmount: amount, 
        deductionReason, 
        deductionMethod,
        adminMemo: adminReply || undefined,
      });
    }
  };

  // 관리자 강제 처리 mutation
  const forceProcessMutation = useMutation({
    mutationFn: async (data: { reason: string; deductionAmount?: number; deductionMethod?: string; adminMemo?: string }) => {
      const res = await adminFetch(`/api/admin/incidents/${selectedIncident!.id}/force-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to force process');
      return res.json();
    },
    onSuccess: (data) => {
      const methods = [];
      if (data.helperDeductionApplied) methods.push('헬퍼 정산 공제');
      if (data.requesterRefundApplied) methods.push('요청자 환불');
      toast({ 
        title: '강제 처리 완료', 
        description: methods.length > 0 ? `${methods.join(' + ')} 처리되었습니다.` : '처리되었습니다.' 
      });
      refetch();
      refetchActions();
      setSelectedIncident(null);
    },
    onError: () => {
      toast({ title: '오류', description: '강제 처리에 실패했습니다.', variant: 'destructive' });
    },
  });

  const handleForceProcess = () => {
    const amount = parseInt(deductionAmount);
    forceProcessMutation.mutate({ 
      reason: deductionReason || '헬퍼 응답 기한 초과',
      deductionAmount: !isNaN(amount) && amount > 0 ? amount : undefined,
      deductionMethod: !isNaN(amount) && amount > 0 ? deductionMethod : undefined,
      adminMemo: adminReply || undefined,
    });
  };

  // 헬퍼 응답 기한 체크
  const isDeadlinePassed = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return '-';
    const d = new Date(deadline);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return '기한 초과';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}시간 남음`;
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간 남음`;
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment);
    }
  };

  const openDetail = (incident: Incident) => {
    setSelectedIncident(incident);
    setNewStatus(incident.status);
    setAdminReply(incident.adminReply || '');
    setDeductionAmount(incident.deductionAmount?.toString() || '');
    setDeductionReason(incident.deductionReason || '');
    setNewComment('');
  };

  const columns: ColumnDef<Incident>[] = [
    {
      key: 'orderId',
      header: '오더ID',
      width: 90,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'incidentType',
      header: '유형',
      width: 100,
      render: (value) => <Badge variant="outline">{TYPE_LABELS[value] || value}</Badge>,
    },
    {
      key: 'description',
      header: '내용',
      width: 200,
      render: (value) => <span className="text-sm truncate block max-w-xs">{value}</span>,
    },
    {
      key: 'requestedAmount',
      header: '요청 금액',
      width: 110,
      align: 'right',
      render: (value) => value ? (
        <span className="font-medium">{value.toLocaleString()}원</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: 'deductionAmount',
      header: '차감액',
      width: 110,
      align: 'right',
      render: (value) => value ? (
        <span className="font-medium text-red-600">-{value.toLocaleString()}원</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: 'evidenceUrls',
      header: '증빙',
      width: 70,
      align: 'center',
      render: (value) => {
        const urls = value || [];
        return urls.length > 0 ? (
          <Badge variant="secondary">{urls.length}장</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">없음</span>
        );
      },
    },
    {
      key: 'adminReply',
      header: '답변',
      width: 70,
      align: 'center',
      render: (value) => value ? (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">완료</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">대기</span>
      ),
    },
    {
      key: 'helperStatus',
      header: '헬퍼응답',
      width: 100,
      align: 'center',
      render: (value, row) => {
        if (row.adminForceProcessed) {
          return <Badge className="bg-orange-100 text-orange-800">강제처리</Badge>;
        }
        if (value === 'confirmed') {
          return <Badge className="bg-green-100 text-green-800">확인완료</Badge>;
        }
        if (value === 'item_found') {
          return <Badge className="bg-blue-100 text-blue-800">물건찾음</Badge>;
        }
        if (value === 'request_handling') {
          return <Badge className="bg-purple-100 text-purple-800">처리요망</Badge>;
        }
        // 헬퍼 응답 기한 체크
        if (row.helperResponseDeadline) {
          if (isDeadlinePassed(row.helperResponseDeadline)) {
            return <Badge className="bg-red-100 text-red-800">기한초과</Badge>;
          }
          return <span className="text-xs text-amber-600">{formatDeadline(row.helperResponseDeadline)}</span>;
        }
        return <span className="text-muted-foreground text-sm">대기중</span>;
      },
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      align: 'center',
      render: (value) => (
        <Badge className={STATUS_COLORS[value] || 'bg-gray-100'}>
          {STATUS_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: '등록일',
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
      width: 80,
      align: 'center',
      render: (_, row) => (
        <Button size="sm" variant="ghost" onClick={() => openDetail(row)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const handleRefresh = async () => {
    await refetch();
    toast({ title: '새로고침 완료' });
  };

  const handleDownloadExcel = () => {
    const headers = ['오더ID', '유형', '내용', '요청금액', '차감액', '증빙', '답변', '상태', '등록일'];
    const rows = incidents.map((row: Record<string, unknown>) => [
      `#${row.orderId}`,
      TYPE_LABELS[row.incidentType as string] || row.incidentType || '',
      row.description || '',
      row.requestedAmount ?? '',
      row.deductionAmount ?? '',
      ((row.evidenceUrls as string[]) || []).length + '장',
      row.adminReply ? '완료' : '대기',
      STATUS_LABELS[row.status as string] || row.status || '',
      row.createdAt ? new Date(row.createdAt as string).toLocaleDateString('ko-KR') : '',
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `사고목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: '다운로드 완료' });
  };

  const statusCounts = {
    all: incidents.length,
    pending: incidents.filter((i: Incident) => i.status === 'pending' || i.status === 'submitted').length,
    reviewing: incidents.filter((i: Incident) => i.status === 'reviewing').length,
    resolved: incidents.filter((i: Incident) => i.status === 'resolved' || i.status === 'applied').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">화물사고접수</h1>
          <p className="text-muted-foreground">배송 사고 접수 및 처리 관리</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button variant="outline" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            엑셀 다운로드
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            사고 등록
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Badge variant="secondary" className="px-3 py-1">
          전체 {statusCounts.all}
        </Badge>
        <Badge variant="outline" className="px-3 py-1 bg-yellow-50">
          대기 {statusCounts.pending}
        </Badge>
        <Badge variant="outline" className="px-3 py-1 bg-purple-50">
          검토중 {statusCounts.reviewing}
        </Badge>
        <Badge variant="outline" className="px-3 py-1 bg-green-50">
          해결됨 {statusCounts.resolved}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            사고 목록
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={incidents}
            columns={columns}
            loading={isLoading}
            emptyMessage="등록된 사고가 없습니다"
            getRowId={(row) => row.id}
            storageKey="incidents"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              사고 상세 - 오더 #{selectedIncident?.orderId}
              {selectedIncident && (
                <Badge className={STATUS_COLORS[selectedIncident.status] || 'bg-gray-100'}>
                  {STATUS_LABELS[selectedIncident.status] || selectedIncident.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedIncident && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">유형</h4>
                  <p className="font-medium">{TYPE_LABELS[selectedIncident.incidentType] || selectedIncident.incidentType}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">요청 금액</h4>
                  <p className="font-medium">
                    {selectedIncident.requestedAmount ? `${selectedIncident.requestedAmount.toLocaleString()}원` : '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">내용</h4>
                  <p className="whitespace-pre-wrap">{selectedIncident.description}</p>
                </div>
              </div>

              {/* 증빙 사진 */}
              {selectedIncident.evidenceUrls && selectedIncident.evidenceUrls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">증빙 사진</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIncident.evidenceUrls.map((url: string, idx: number) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={url}
                          alt={`증빙 ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 상태 변경 */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium">상태 변경</h4>
                <div className="flex gap-2">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">검토 대기</SelectItem>
                      <SelectItem value="reviewing">검토 중</SelectItem>
                      <SelectItem value="resolved">해결됨</SelectItem>
                      <SelectItem value="rejected">기각</SelectItem>
                      <SelectItem value="applied">적용됨</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleStatusChange} disabled={!newStatus || newStatus === selectedIncident.status}>
                    상태 변경
                  </Button>
                </div>
              </div>

              {/* 답변 달기 */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  답변 달기
                </h4>
                {selectedIncident.adminReply && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">{selectedIncident.adminReply}</p>
                  </div>
                )}
                <Textarea
                  placeholder="접수자에게 전달할 답변을 입력하세요..."
                  value={adminReply}
                  onChange={(e) => setAdminReply(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleReply} disabled={!adminReply.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  답변 등록
                </Button>
              </div>

              {/* 차감 처리 */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium text-red-600">차감 확정</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>차감 금액</Label>
                    <Input
                      type="number"
                      placeholder="금액 입력"
                      value={deductionAmount}
                      onChange={(e) => setDeductionAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>차감 사유</Label>
                    <Input
                      placeholder="사유 입력"
                      value={deductionReason}
                      onChange={(e) => setDeductionReason(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>처리 방식</Label>
                  <Select value={deductionMethod} onValueChange={(v: 'helper_deduct' | 'requester_refund' | 'both') => setDeductionMethod(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="처리 방식 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="helper_deduct">헬퍼 정산 공제</SelectItem>
                      <SelectItem value="requester_refund">요청자 환불</SelectItem>
                      <SelectItem value="both">헬퍼 공제 + 요청자 환불</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deductionMethod === 'helper_deduct' && '헬퍼 정산에서 차감 금액이 공제됩니다.'}
                    {deductionMethod === 'requester_refund' && '요청자에게 환불 처리됩니다.'}
                    {deductionMethod === 'both' && '헬퍼 정산 공제 및 요청자 환불이 동시에 진행됩니다.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    onClick={handleDeduction}
                    disabled={!deductionAmount || !deductionReason.trim() || confirmDeductionMutation.isPending || selectedIncident?.status === 'resolved'}
                  >
                    {confirmDeductionMutation.isPending ? '처리 중...' : '차감 확정'}
                  </Button>
                  
                  {/* 강제 처리 버튼 - 헬퍼 응답 대기 중일 때만 표시 */}
                  {selectedIncident && !selectedIncident.helperStatus && selectedIncident.status !== 'resolved' && (
                    <Button 
                      variant="outline" 
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                      onClick={handleForceProcess}
                      disabled={forceProcessMutation.isPending}
                    >
                      {forceProcessMutation.isPending ? '처리 중...' : '관리자 강제 처리'}
                    </Button>
                  )}
                </div>
                
                {/* 헬퍼 응답 상태 표시 */}
                {selectedIncident && (
                  <div className="mt-3 p-3 bg-muted/50 rounded text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">헬퍼 응답 현황</span>
                    </div>
                    {selectedIncident.adminForceProcessed ? (
                      <p className="text-orange-600">관리자가 강제 처리함 ({selectedIncident.adminForceProcessedReason || '헬퍼 응답 없음'})</p>
                    ) : selectedIncident.helperStatus ? (
                      <div>
                        <Badge className={
                          selectedIncident.helperStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                          selectedIncident.helperStatus === 'item_found' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }>
                          {selectedIncident.helperStatus === 'confirmed' ? '확인완료' :
                           selectedIncident.helperStatus === 'item_found' ? '물건찾음' : '처리요망'}
                        </Badge>
                        {selectedIncident.helperNote && (
                          <p className="mt-1 text-muted-foreground">{selectedIncident.helperNote}</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-amber-600">
                          {selectedIncident.helperResponseDeadline ? (
                            isDeadlinePassed(selectedIncident.helperResponseDeadline) 
                              ? '응답 기한 초과 - 관리자 강제 처리 가능'
                              : `응답 대기 중 (${formatDeadline(selectedIncident.helperResponseDeadline)})`
                          ) : '응답 대기 중'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 처리 이력 */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  처리 이력
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {actions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">처리 이력이 없습니다.</p>
                  ) : (
                    actions.map((action: IncidentAction) => (
                      <div key={action.id} className="flex gap-3 text-sm p-2 bg-muted/30 rounded">
                        <div className="flex-shrink-0">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{action.performerName}</span>
                            <Badge variant="outline" className="text-xs">
                              {ACTION_TYPE_LABELS[action.actionType] || action.actionType}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {new Date(action.createdAt).toLocaleString('ko-KR')}
                            </span>
                          </div>
                          {action.notes && <p className="mt-1 text-muted-foreground">{action.notes}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 코멘트 추가 */}
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <Input
                    placeholder="코멘트 추가..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedIncident(null);
                    navigate(`/disputes?orderId=${selectedIncident.orderId}`);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  관련 분쟁 보기
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedIncident(null);
                    navigate(`/orders?id=${selectedIncident.orderId}`);
                  }}
                >
                  오더 상세
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  onClick={() => {
                    setSelectedIncident(null);
                    navigate('/incident-refunds');
                  }}
                >
                  환불 목록으로
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
