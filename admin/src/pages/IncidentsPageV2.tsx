import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { DateRangePicker, getDefaultDateRange, Pagination } from '@/components/common';
import { 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Search,
  Plus,
  DollarSign,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// ============ 인터페이스 정의 ============

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
}

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
  createdAt: string;
  targetName: string | null;
  targetPhone: string | null;
}

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
}

// ============ 공통 설정 ============

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
};

const STATUS_LABELS: Record<string, string> = {
  submitted: '접수됨',
  pending: '검토 대기',
  reviewing: '검토 중',
  resolved: '해결됨',
  rejected: '기각됨',
  applied: '적용됨',
  cancelled: '취소됨',
  completed: '완료',
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  applied: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  completed: 'bg-green-100 text-green-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  damage: '화물사고',
  delay: '지연',
  dispute: '분쟁',
  other: '기타',
};

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return amount.toLocaleString('ko-KR') + '원';
}

// ============ 메인 컴포넌트 ============

export default function IncidentsPageV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'incidents' | 'deductions' | 'refunds'>('incidents');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange(30));
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  
  // 사고접수 관련 상태
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isIncidentDetailOpen, setIsIncidentDetailOpen] = useState(false);
  
  // 차감처리 관련 상태
  const [selectedDeduction, setSelectedDeduction] = useState<Deduction | null>(null);
  const [deductionStatusFilter, setDeductionStatusFilter] = useState('pending');
  const [showCreateDeductionModal, setShowCreateDeductionModal] = useState(false);
  const [deductionForm, setDeductionForm] = useState({
    targetId: '',
    amount: '',
    reason: '',
    category: 'other',
    memo: '',
  });
  
  // 환불처리 관련 상태
  const [refundStatusFilter, setRefundStatusFilter] = useState<'pending' | 'completed'>('pending');
  const [selectedRefund, setSelectedRefund] = useState<IncidentRefund | null>(null);
  const [selectedRefundDetail, setSelectedRefundDetail] = useState<IncidentRefund | null>(null);
  const [showConfirmRefundModal, setShowConfirmRefundModal] = useState(false);
  const [adminMemo, setAdminMemo] = useState('');

  // 페이지네이션 상태
  const [incidentPage, setIncidentPage] = useState(1);
  const [deductionPage, setDeductionPage] = useState(1);
  const [refundPage, setRefundPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // ============ 데이터 조회 ============

  // 사고접수
  const { data: incidents = [], isLoading: loadingIncidents } = useQuery({
    queryKey: ['/api/admin/incidents', dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/incidents');
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Failed to fetch');
      }
      return res.json();
    },
  });

  // 차감처리
  const { data: deductions = [], isLoading: loadingDeductions } = useQuery({
    queryKey: ['/api/admin/deductions', deductionStatusFilter, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: deductionStatusFilter,
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await adminFetch(`/api/admin/deductions?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 환불처리
  const { data: refunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ['/api/admin/incident-refunds', refundStatusFilter, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: refundStatusFilter,
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

  const isLoading = loadingIncidents || loadingDeductions || loadingRefunds;

  // ============ 필터링 ============

  const filteredIncidents = incidents.filter((i: Incident) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      i.orderId.toString().includes(search) ||
      i.description.toLowerCase().includes(search) ||
      TYPE_LABELS[i.incidentType]?.toLowerCase().includes(search)
    );
  });

  const filteredDeductions = deductions.filter((d: Deduction) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      d.targetName?.toLowerCase().includes(search) ||
      d.targetPhone?.includes(search) ||
      d.reason.toLowerCase().includes(search)
    );
  });

  const filteredRefunds = refunds.filter((r: IncidentRefund) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.orderId.toString().includes(search) ||
      r.requesterName?.toLowerCase().includes(search) ||
      r.description.toLowerCase().includes(search)
    );
  });

  // ============ 통계 계산 ============

  const incidentStats = {
    total: filteredIncidents.length,
    pending: filteredIncidents.filter((i: Incident) => i.status === 'pending' || i.status === 'submitted').length,
    reviewing: filteredIncidents.filter((i: Incident) => i.status === 'reviewing').length,
    resolved: filteredIncidents.filter((i: Incident) => i.status === 'resolved').length,
  };

  const deductionStats = {
    total: filteredDeductions.length,
    totalAmount: filteredDeductions.reduce((sum: number, d: Deduction) => sum + (d.amount || 0), 0),
    pending: filteredDeductions.filter((d: Deduction) => d.status === 'pending').length,
    applied: filteredDeductions.filter((d: Deduction) => d.status === 'applied').length,
  };

  const refundStats = {
    total: filteredRefunds.length,
    totalAmount: filteredRefunds.reduce((sum: number, r: IncidentRefund) => sum + (r.refundAmount || r.requestedAmount || 0), 0),
    pending: filteredRefunds.filter((r: IncidentRefund) => !r.requesterRefundApplied).length,
    completed: filteredRefunds.filter((r: IncidentRefund) => r.requesterRefundApplied).length,
  };

  // ============ 액션 핸들러 ============

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/incidents'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/deductions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/incident-refunds'] });
    toast({ title: '데이터를 새로고침했습니다.', variant: 'success' });
  };

  const handleDownloadExcel = () => {
    let data: any[] = [];
    let filename = '';

    if (activeTab === 'incidents') {
      data = filteredIncidents.map((item: Incident) => ({
        'ID': item.id,
        '오더번호': item.orderId,
        '사고유형': TYPE_LABELS[item.incidentType] || item.incidentType,
        '설명': item.description,
        '요청금액': item.requestedAmount || 0,
        '차감금액': item.deductionAmount || 0,
        '상태': STATUS_LABELS[item.status] || item.status,
        '접수일': new Date(item.createdAt).toLocaleDateString('ko-KR'),
      }));
      filename = `사고접수_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeTab === 'deductions') {
      data = filteredDeductions.map((item: Deduction) => ({
        'ID': item.id,
        '대상': item.targetName || item.targetId,
        '연락처': item.targetPhone || '',
        '금액': item.amount,
        '사유': item.reason,
        '카테고리': CATEGORY_LABELS[item.category || ''] || item.category || '',
        '상태': STATUS_LABELS[item.status] || item.status,
        '적용일': item.appliedAt ? new Date(item.appliedAt).toLocaleDateString('ko-KR') : '',
      }));
      filename = `사고차감_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      data = filteredRefunds.map((item: IncidentRefund) => ({
        'ID': item.id,
        '오더번호': item.orderId,
        '요청자': item.requesterName || '',
        '사고유형': TYPE_LABELS[item.incidentType] || item.incidentType,
        '요청금액': item.requestedAmount,
        '환불금액': item.refundAmount || item.requestedAmount,
        '환불상태': item.requesterRefundApplied ? '완료' : '대기',
        '확정일': item.refundConfirmedAt ? new Date(item.refundConfirmedAt).toLocaleDateString('ko-KR') : '',
      }));
      filename = `사고환불_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    if (data.length === 0) {
      toast({ title: '다운로드할 데이터가 없습니다.', variant: 'warning' });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) => headers.map(h => row[h]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Excel 다운로드 완료', variant: 'success' });
  };

  // 차감 적용/취소 mutation
  const applyDeductionMutation = useMutation({
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
      toast({ title: '차감이 적용되었습니다.', variant: 'success' });
    },
  });

  const cancelDeductionMutation = useMutation({
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
      toast({ title: '차감이 취소되었습니다.', variant: 'success' });
    },
  });

  // 차감 생성 mutation
  const createDeductionMutation = useMutation({
    mutationFn: async (data: typeof deductionForm) => {
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
      setShowCreateDeductionModal(false);
      setDeductionForm({ targetId: '', amount: '', reason: '', category: 'other', memo: '' });
      toast({ title: '차감이 생성되었습니다.', variant: 'success' });
    },
  });

  // 환불 확정 mutation
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
      toast({ title: '환불 확정 완료', variant: 'success' });
      setShowConfirmRefundModal(false);
      setSelectedRefund(null);
      setAdminMemo('');
    },
  });

  // ============ 컬럼 정의 ============

  const incidentColumns: ColumnDef<Incident>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 60,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'orderId',
      header: '오더번호',
      width: 90,
      render: (value) => <span className="font-mono text-sm font-medium">#{value}</span>,
    },
    {
      key: 'incidentType',
      header: '사고유형',
      width: 100,
      render: (value) => (
        <Badge variant="outline">
          {TYPE_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      key: 'description',
      header: '설명',
      width: 250,
      render: (value) => (
        <span className="text-sm line-clamp-2">{value}</span>
      ),
    },
    {
      key: 'requestedAmount',
      header: '요청금액',
      width: 100,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'deductionAmount',
      header: '차감금액',
      width: 100,
      align: 'right',
      render: (value) => <span className="text-sm font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => (
        <Badge className={STATUS_COLORS[value] || 'bg-gray-100 text-gray-800'}>
          {STATUS_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: '접수일',
      width: 100,
      render: (value) => (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ),
    },
  ];

  const deductionColumns: ColumnDef<Deduction>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 60,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'targetName',
      header: '대상',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || `ID: ${row.targetId}`}</div>
          {row.targetPhone && (
            <div className="text-xs text-muted-foreground">{row.targetPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: '금액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium text-red-600">{formatAmount(value)}</span>,
    },
    {
      key: 'category',
      header: '카테고리',
      width: 90,
      render: (value) => (
        <Badge variant="outline">
          {CATEGORY_LABELS[value || ''] || value || '기타'}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: '사유',
      width: 200,
      render: (value) => <span className="text-sm line-clamp-2">{value}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: 80,
      render: (value) => (
        <Badge className={STATUS_COLORS[value] || 'bg-gray-100 text-gray-800'}>
          {STATUS_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      key: 'appliedAt',
      header: '적용일',
      width: 100,
      render: (value) => value ? (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      key: 'id',
      header: '액션',
      width: 120,
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => applyDeductionMutation.mutate(row.id)}
                disabled={applyDeductionMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                적용
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelDeductionMutation.mutate(row.id)}
                disabled={cancelDeductionMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                취소
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const refundColumns: ColumnDef<IncidentRefund>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 60,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'orderId',
      header: '오더번호',
      width: 90,
      render: (value) => <span className="font-mono text-sm font-medium">#{value}</span>,
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || '-'}</div>
          {row.requesterPhone && (
            <div className="text-xs text-muted-foreground">{row.requesterPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'incidentType',
      header: '사고유형',
      width: 100,
      render: (value) => (
        <Badge variant="outline">
          {TYPE_LABELS[value] || value}
        </Badge>
      ),
    },
    {
      key: 'requestedAmount',
      header: '요청금액',
      width: 100,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'refundAmount',
      header: '환불금액',
      width: 100,
      align: 'right',
      render: (value, row) => (
        <span className="text-sm font-medium text-green-600">
          {formatAmount(value || row.requestedAmount)}
        </span>
      ),
    },
    {
      key: 'requesterRefundApplied',
      header: '상태',
      width: 80,
      render: (value) => (
        <Badge className={value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
          {value ? '완료' : '대기'}
        </Badge>
      ),
    },
    {
      key: 'refundConfirmedAt',
      header: '확정일',
      width: 100,
      render: (value) => value ? (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      key: 'id',
      header: '액션',
      width: 100,
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!row.requesterRefundApplied && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedRefund(row);
                setShowConfirmRefundModal(true);
              }}
            >
              <Check className="h-4 w-4 mr-1" />
              확정
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ============ 렌더링 ============

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🚨 화물사고 관리</h1>
          <p className="text-muted-foreground">사고접수, 차감처리, 환불처리를 통합 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          {activeTab === 'deductions' && (
            <Button size="sm" onClick={() => setShowCreateDeductionModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              차감 생성
            </Button>
          )}
        </div>
      </div>

      {/* 통합 카드 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-3 w-[450px]">
                <TabsTrigger value="incidents">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  사고접수
                  {incidentStats.pending > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                      {incidentStats.pending}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="deductions">
                  <DollarSign className="h-4 w-4 mr-2" />
                  차감처리
                  {deductionStats.pending > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {deductionStats.pending}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="refunds">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  환불처리
                  {refundStats.pending > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {refundStats.pending}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* 검색 및 필터 */}
              <div className="flex items-center gap-2">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                
                {activeTab === 'deductions' && (
                  <Select value={deductionStatusFilter} onValueChange={setDeductionStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="applied">적용됨</SelectItem>
                      <SelectItem value="cancelled">취소됨</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {activeTab === 'refunds' && (
                  <Select value={refundStatusFilter} onValueChange={(v) => setRefundStatusFilter(v as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={
                      activeTab === 'incidents' 
                        ? '오더번호, 설명 검색...'
                        : activeTab === 'deductions'
                        ? '대상, 사유 검색...'
                        : '오더번호, 요청자 검색...'
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* 사고접수 탭 */}
            <TabsContent value="incidents" className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{incidentStats.total}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">검토 대기</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{incidentStats.pending}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">검토 중</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{incidentStats.reviewing}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">해결 완료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{incidentStats.resolved}건</div>
                  </CardContent>
                </Card>
              </div>

              <ExcelTable
                columns={incidentColumns}
                data={filteredIncidents.slice((incidentPage - 1) * itemsPerPage, incidentPage * itemsPerPage)}
                onRowClick={(row) => {
                  setSelectedIncident(row);
                  setIsIncidentDetailOpen(true);
                }}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingIncidents}
              />
              <Pagination
                currentPage={incidentPage}
                totalPages={Math.ceil(filteredIncidents.length / itemsPerPage) || 1}
                totalItems={filteredIncidents.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setIncidentPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setIncidentPage(1); }}
              />
            </TabsContent>

            {/* 차감처리 탭 */}
            <TabsContent value="deductions" className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{deductionStats.total}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 차감금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatAmount(deductionStats.totalAmount)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">대기</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{deductionStats.pending}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">적용완료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{deductionStats.applied}건</div>
                  </CardContent>
                </Card>
              </div>

              <ExcelTable
                columns={deductionColumns}
                data={filteredDeductions.slice((deductionPage - 1) * itemsPerPage, deductionPage * itemsPerPage)}
                onRowClick={(row) => setSelectedDeduction(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingDeductions}
              />
              <Pagination
                currentPage={deductionPage}
                totalPages={Math.ceil(filteredDeductions.length / itemsPerPage) || 1}
                totalItems={filteredDeductions.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setDeductionPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setDeductionPage(1); }}
              />
            </TabsContent>

            {/* 환불처리 탭 */}
            <TabsContent value="refunds" className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{refundStats.total}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 환불금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatAmount(refundStats.totalAmount)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">대기</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{refundStats.pending}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">완료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{refundStats.completed}건</div>
                  </CardContent>
                </Card>
              </div>

              <ExcelTable
                columns={refundColumns}
                data={filteredRefunds.slice((refundPage - 1) * itemsPerPage, refundPage * itemsPerPage)}
                onRowClick={(row) => setSelectedRefundDetail(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingRefunds}
              />
              <Pagination
                currentPage={refundPage}
                totalPages={Math.ceil(filteredRefunds.length / itemsPerPage) || 1}
                totalItems={filteredRefunds.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setRefundPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setRefundPage(1); }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 차감 생성 모달 */}
      <Dialog open={showCreateDeductionModal} onOpenChange={setShowCreateDeductionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>차감 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>헬퍼 ID</Label>
              <Input
                value={deductionForm.targetId}
                onChange={(e) => setDeductionForm({ ...deductionForm, targetId: e.target.value })}
                placeholder="헬퍼 ID 입력"
              />
            </div>
            <div>
              <Label>차감 금액</Label>
              <Input
                type="number"
                value={deductionForm.amount}
                onChange={(e) => setDeductionForm({ ...deductionForm, amount: e.target.value })}
                placeholder="금액 입력"
              />
            </div>
            <div>
              <Label>사유</Label>
              <Textarea
                value={deductionForm.reason}
                onChange={(e) => setDeductionForm({ ...deductionForm, reason: e.target.value })}
                placeholder="차감 사유 입력"
                rows={3}
              />
            </div>
            <div>
              <Label>카테고리</Label>
              <Select value={deductionForm.category} onValueChange={(v) => setDeductionForm({ ...deductionForm, category: v })}>
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
            <div>
              <Label>메모 (선택)</Label>
              <Textarea
                value={deductionForm.memo}
                onChange={(e) => setDeductionForm({ ...deductionForm, memo: e.target.value })}
                placeholder="추가 메모"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDeductionModal(false)}>
              취소
            </Button>
            <Button onClick={() => createDeductionMutation.mutate(deductionForm)} disabled={createDeductionMutation.isPending}>
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 환불 확정 모달 */}
      <Dialog open={showConfirmRefundModal} onOpenChange={setShowConfirmRefundModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>환불 확정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>요청자에게 환불을 확정하시겠습니까?</p>
            <div>
              <Label>관리자 메모 (선택)</Label>
              <Textarea
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
                placeholder="환불 확정 메모"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmRefundModal(false)}>
              취소
            </Button>
            <Button
              onClick={() => selectedRefund && confirmRefundMutation.mutate({ incidentId: selectedRefund.id, adminMemo })}
              disabled={confirmRefundMutation.isPending}
            >
              확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 사고접수 상세 모달 */}
      <Dialog open={isIncidentDetailOpen} onOpenChange={setIsIncidentDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>사고접수 상세</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">사고 ID</p>
                  <p className="font-medium">{selectedIncident.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">주문 ID</p>
                  <p className="font-medium">{selectedIncident.orderId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">사고 유형</p>
                  <p className="font-medium">{selectedIncident.incidentType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">상태</p>
                  <Badge variant={selectedIncident.status === 'resolved' ? 'default' : 'secondary'}>
                    {selectedIncident.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">요청 금액</p>
                  <p className="font-medium">{selectedIncident.requestedAmount?.toLocaleString() ?? '-'}원</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">차감 금액</p>
                  <p className="font-medium">{selectedIncident.deductionAmount?.toLocaleString() ?? '-'}원</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">접수일</p>
                  <p className="font-medium">{new Date(selectedIncident.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">사고 설명</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedIncident.description}</p>
              </div>
              {selectedIncident.deductionReason && (
                <div>
                  <p className="text-sm text-muted-foreground">차감 사유</p>
                  <p className="mt-1 text-sm">{selectedIncident.deductionReason}</p>
                </div>
              )}
              {selectedIncident.adminReply && (
                <div>
                  <p className="text-sm text-muted-foreground">관리자 답변</p>
                  <p className="mt-1 text-sm">{selectedIncident.adminReply}</p>
                </div>
              )}
              {selectedIncident.evidenceUrls && selectedIncident.evidenceUrls.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">증거자료</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {selectedIncident.evidenceUrls.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-sm">
                        첨부파일 {idx + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsIncidentDetailOpen(false); setSelectedIncident(null); }}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 차감 상세 모달 */}
      <Dialog open={!!selectedDeduction} onOpenChange={() => setSelectedDeduction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>차감 상세</DialogTitle>
          </DialogHeader>
          {selectedDeduction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">차감 ID</p>
                  <p className="font-medium">#{selectedDeduction.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">주문 ID</p>
                  <p className="font-medium">{selectedDeduction.orderId ? `#${selectedDeduction.orderId}` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">대상자</p>
                  <div>
                    <p className="font-medium">{selectedDeduction.targetName || `ID: ${selectedDeduction.targetId}`}</p>
                    {selectedDeduction.targetPhone && (
                      <p className="text-xs text-muted-foreground">{selectedDeduction.targetPhone}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">대상 유형</p>
                  <p className="font-medium">{selectedDeduction.targetType === 'helper' ? '헬퍼' : '요청자'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">차감 금액</p>
                  <p className="font-medium text-red-600">{formatAmount(selectedDeduction.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">카테고리</p>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedDeduction.category || ''] || selectedDeduction.category || '기타'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">상태</p>
                  <Badge className={STATUS_COLORS[selectedDeduction.status] || 'bg-gray-100 text-gray-800'}>
                    {STATUS_LABELS[selectedDeduction.status] || selectedDeduction.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">생성일</p>
                  <p className="font-medium">{new Date(selectedDeduction.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
                {selectedDeduction.appliedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">적용일</p>
                    <p className="font-medium">{new Date(selectedDeduction.appliedAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                )}
                {selectedDeduction.appliedToSettlementId && (
                  <div>
                    <p className="text-sm text-muted-foreground">적용 정산 ID</p>
                    <p className="font-medium">#{selectedDeduction.appliedToSettlementId}</p>
                  </div>
                )}
                {selectedDeduction.incidentId && (
                  <div>
                    <p className="text-sm text-muted-foreground">사고접수 ID</p>
                    <p className="font-medium">#{selectedDeduction.incidentId}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">차감 사유</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedDeduction.reason}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDeduction(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 환불 상세 모달 */}
      <Dialog open={!!selectedRefundDetail} onOpenChange={() => setSelectedRefundDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>환불 상세</DialogTitle>
          </DialogHeader>
          {selectedRefundDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">환불 ID</p>
                  <p className="font-medium">#{selectedRefundDetail.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">주문 ID</p>
                  <p className="font-medium">#{selectedRefundDetail.orderId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">요청자</p>
                  <div>
                    <p className="font-medium">{selectedRefundDetail.requesterName || '-'}</p>
                    {selectedRefundDetail.requesterPhone && (
                      <p className="text-xs text-muted-foreground">{selectedRefundDetail.requesterPhone}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">사고 유형</p>
                  <Badge variant="outline">
                    {TYPE_LABELS[selectedRefundDetail.incidentType] || selectedRefundDetail.incidentType}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">요청 금액</p>
                  <p className="font-medium">{formatAmount(selectedRefundDetail.requestedAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">환불 금액</p>
                  <p className="font-medium text-green-600">{formatAmount(selectedRefundDetail.refundAmount || selectedRefundDetail.requestedAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">환불 상태</p>
                  <Badge className={selectedRefundDetail.requesterRefundApplied ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {selectedRefundDetail.requesterRefundApplied ? '완료' : '대기'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">접수일</p>
                  <p className="font-medium">{new Date(selectedRefundDetail.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
                {selectedRefundDetail.refundConfirmedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">확정일</p>
                    <p className="font-medium">{new Date(selectedRefundDetail.refundConfirmedAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">사고 설명</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedRefundDetail.description}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRefundDetail(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
