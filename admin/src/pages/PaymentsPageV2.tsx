import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Money,
  getDefaultDateRange,
} from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { 
  CreditCard, 
  RefreshCw, 
  Download, 
  Search,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// ============ 인터페이스 정의 ============

interface DepositPayment {
  id: number;
  orderId: number;
  orderDate: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  depositAmount: number;
  orderStatus: string;
  paymentStatus: 'paid' | 'unpaid';
  virtualAccountNumber: string | null;
  virtualAccountBank: string | null;
  createdAt: string;
}

interface BalancePayment {
  id: number;
  orderId: number;
  orderDate: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  helperName: string;
  helperEmail: string;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  etcPricePerUnit: number;
  extraCostsTotal: number;
  supplyAmount: number;
  vatAmount: number;
  grossAmount: number;
  depositAmount: number;
  unitPrice: number;
  balanceAmount: number;
  orderStatus: string;
  paymentStatus: 'paid' | 'unpaid';
  balancePaidAt: string | null;
  balanceDueDate: string | null;
  virtualAccountNumber: string | null;
  virtualAccountBank: string | null;
  closingSubmittedAt: string | null;
  createdAt: string;
}

interface Refund {
  id: number;
  orderId: number;
  orderDate: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  refundAmount: number;
  depositAmount: number;
  refundRate: number;
  refundType: 'before_matching' | 'after_matching';
  reasonCategory: string;
  cancelReason: string;
  refundBankName: string | null;
  refundAccountNumber: string | null;
  refundAccountHolder: string | null;
  status: 'pending' | 'completed' | 'rejected';
  processedAt: string | null;
  createdAt: string;
}

// ============ 공통 설정 ============

const orderStatusLabels: Record<string, string> = {
  awaiting_deposit: '입금대기',
  open: '모집중',
  scheduled: '배송예정',
  in_progress: '진행중',
  closing_submitted: '마감제출',
  final_amount_confirmed: '최종확정',
  balance_paid: '잔금완료',
  settlement_paid: '정산완료',
  closed: '완료',
  cancelled: '취소됨',
};

const orderStatusColors: Record<string, string> = {
  awaiting_deposit: 'bg-orange-100 text-orange-800',
  open: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-cyan-100 text-cyan-800',
  closing_submitted: 'bg-indigo-100 text-indigo-800',
  final_amount_confirmed: 'bg-teal-100 text-teal-800',
  balance_paid: 'bg-emerald-100 text-emerald-800',
  settlement_paid: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const refundTypeLabels: Record<string, string> = {
  before_matching: '비매칭',
  after_matching: '매칭후',
};

const reasonCategoryLabels: Record<string, string> = {
  customer_request: '고객요청',
  unassigned_timeout: '미배정취소',
  deposit_issue: '입금문제',
  after_matching_cancel: '매칭후취소',
  dispute: '분쟁',
  error: '오류',
};

const statusLabels: Record<string, string> = {
  pending: '처리대기',
  completed: '환불완료',
  rejected: '거절됨',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

// ============ 메인 컴포넌트 ============

export default function PaymentsPageV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'deposit' | 'balance' | 'refunds'>('deposit');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange] = useState(getDefaultDateRange(30));
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [selectedDeposit, setSelectedDeposit] = useState<DepositPayment | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<BalancePayment | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ============ 환불 처리 Mutation ============

  const processRefundMutation = useMutation({
    mutationFn: async (data: { refundId: number; status: 'completed' | 'rejected'; adminNotes?: string }) => {
      return apiRequest(`/refunds/${data.refundId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: data.status,
          adminNotes: data.adminNotes,
        }),
      });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.status === 'completed' ? '환불이 승인되었습니다.' : '환불이 거절되었습니다.',
      });
      setSelectedRefund(null);
      setRejectModalOpen(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
    onError: (error: any) => {
      toast({
        title: '환불 처리 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const bulkRefundApproveMutation = useMutation({
    mutationFn: async (refundIds: number[]) => {
      const results = await Promise.allSettled(
        refundIds.map(id =>
          apiRequest(`/refunds/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed' }),
          })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return { succeeded, failed };
    },
    onSuccess: (data) => {
      toast({
        title: `일괄 승인 완료: ${data.succeeded}건 성공${data.failed > 0 ? `, ${data.failed}건 실패` : ''}`,
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
    onError: (error: any) => {
      toast({ title: '일괄 승인 실패', description: error.message, variant: 'destructive' });
    },
  });

  // ============ 데이터 조회 ============

  const { data: depositPayments = [], isLoading: loadingDeposit } = useQuery<DepositPayment[]>({
    queryKey: ['deposit-payments', dateRange],
    queryFn: async () => {
      try {
        return await apiRequest<DepositPayment[]>('/payments-detail?type=deposit');
      } catch {
        return [];
      }
    },
  });

  const { data: balancePayments = [], isLoading: loadingBalance } = useQuery<BalancePayment[]>({
    queryKey: ['balance-payments', dateRange],
    queryFn: async () => {
      try {
        return await apiRequest<BalancePayment[]>('/payments-detail?type=balance');
      } catch {
        return [];
      }
    },
  });

  const { data: refunds = [], isLoading: loadingRefunds } = useQuery<Refund[]>({
    queryKey: ['refunds', dateRange],
    queryFn: async () => {
      try {
        return await apiRequest<Refund[]>('/refunds-detail?type=regular');
      } catch {
        return [];
      }
    },
  });

  const isLoading = loadingDeposit || loadingBalance || loadingRefunds;

  // ============ 필터링 ============

  const filteredDepositPayments = depositPayments.filter(p =>
    p.requesterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterPhone?.includes(searchTerm) ||
    String(p.orderId).includes(searchTerm)
  );

  const filteredBalancePayments = balancePayments.filter(p =>
    p.requesterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.helperName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterPhone?.includes(searchTerm) ||
    String(p.orderId).includes(searchTerm)
  );

  const filteredRefunds = refunds.filter(r =>
    r.requesterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requesterPhone?.includes(searchTerm) ||
    r.cancelReason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(r.orderId).includes(searchTerm)
  );

  // ============ 통계 계산 ============

  const depositStats = {
    paid: filteredDepositPayments.filter(p => p.paymentStatus === 'paid').length,
    unpaid: filteredDepositPayments.filter(p => p.paymentStatus === 'unpaid').length,
    totalAmount: filteredDepositPayments
      .filter(p => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + (p.depositAmount || 0), 0),
  };

  const balanceStats = {
    paid: filteredBalancePayments.filter(p => p.paymentStatus === 'paid').length,
    unpaid: filteredBalancePayments.filter(p => p.paymentStatus === 'unpaid').length,
    overdue: filteredBalancePayments.filter(p => 
      p.paymentStatus === 'unpaid' && p.balanceDueDate && new Date(p.balanceDueDate) < new Date()
    ).length,
    totalAmount: filteredBalancePayments
      .filter(p => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + (p.balanceAmount || 0), 0),
  };

  const refundStats = {
    pending: filteredRefunds.filter(r => r.status === 'pending').length,
    completed: filteredRefunds.filter(r => r.status === 'completed').length,
    rejected: filteredRefunds.filter(r => r.status === 'rejected').length,
    totalAmount: filteredRefunds
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0),
  };

  // ============ 액션 핸들러 ============

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['deposit-payments'] });
    queryClient.invalidateQueries({ queryKey: ['balance-payments'] });
    queryClient.invalidateQueries({ queryKey: ['refunds'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    let data: any[] = [];
    let filename = '';

    if (activeTab === 'deposit') {
      data = filteredDepositPayments.map((item) => ({
        '오더번호': item.orderId,
        '날짜': item.orderDate ? format(new Date(item.orderDate), 'yyyy-MM-dd') : '',
        '요청자이름': item.requesterName || '',
        '아이디': item.requesterEmail || '',
        '전화번호': item.requesterPhone || '',
        '계약금금액': item.depositAmount || 0,
        '오더상태': orderStatusLabels[item.orderStatus] || item.orderStatus,
        '결제상태': item.paymentStatus === 'paid' ? '결제완료' : '미결제',
        '가상계좌은행': item.virtualAccountBank || '',
        '가상계좌번호': item.virtualAccountNumber || '',
      }));
      filename = `계약금결제_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeTab === 'balance') {
      data = filteredBalancePayments.map(item => ({
        '오더번호': item.orderId,
        '날짜': item.orderDate ? format(new Date(item.orderDate), 'yyyy-MM-dd') : '',
        '요청자': item.requesterName || '',
        '요청자연락처': item.requesterPhone || '',
        '헬퍼': item.helperName || '',
        '배송수': item.deliveredCount || 0,
        '반품수': item.returnedCount || 0,
        '기타수': item.etcCount || 0,
        '단가': item.unitPrice || 0,
        '공급가': item.supplyAmount || 0,
        '부가세': item.vatAmount || 0,
        '총액': item.grossAmount || 0,
        '계약금': item.depositAmount || 0,
        '잔금': item.balanceAmount || 0,
        '오더상태': orderStatusLabels[item.orderStatus] || item.orderStatus,
        '결제상태': item.paymentStatus === 'paid' ? '결제완료' : '미결제',
        '잔금입금일': item.balancePaidAt ? format(new Date(item.balancePaidAt), 'yyyy-MM-dd') : '',
      }));
      filename = `잔금결제_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      data = filteredRefunds.map((item) => ({
        '오더번호': item.orderId,
        '날짜': item.orderDate ? format(new Date(item.orderDate), 'yyyy-MM-dd') : '',
        '요청자이름': item.requesterName || '',
        '아이디': item.requesterEmail || '',
        '전화번호': item.requesterPhone || '',
        '환불유형': refundTypeLabels[item.refundType] || item.refundType,
        '환불사유': reasonCategoryLabels[item.reasonCategory] || item.reasonCategory,
        '계약금': item.depositAmount || 0,
        '환불율': `${item.refundRate}%`,
        '환불금액': item.refundAmount || 0,
        '취소사유': item.cancelReason || '',
        '환불계좌': item.refundAccountNumber ? `${item.refundBankName} ${item.refundAccountNumber}` : '',
        '상태': statusLabels[item.status] || item.status,
        '처리일시': item.processedAt ? format(new Date(item.processedAt), 'yyyy-MM-dd HH:mm') : '',
      }));
      filename = `환불목록_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    if (data.length === 0) {
      toast({ title: '다운로드할 데이터가 없습니다.', variant: 'destructive' });
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
    toast({ title: 'Excel 다운로드 완료' });
  };

  // ============ 컬럼 정의 ============

  const depositColumns: ColumnDef<DepositPayment>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 90,
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>,
    },
    {
      key: 'orderDate',
      header: '날짜',
      width: 100,
      render: (value) => value ? format(new Date(value), 'yyyy-MM-dd') : '-',
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 100,
      render: (value) => <span className="font-medium">{value || '-'}</span>,
    },
    {
      key: 'requesterEmail',
      header: '아이디',
      width: 150,
      render: (value) => <span className="text-muted-foreground text-sm">{value || '-'}</span>,
    },
    {
      key: 'requesterPhone',
      header: '전화번호',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'depositAmount',
      header: '계약금',
      width: 110,
      align: 'right',
      render: (value) => <Money amount={value} size="sm" />,
    },
    {
      key: 'orderStatus',
      header: '오더상태',
      width: 90,
      render: (value) => (
        <Badge className={orderStatusColors[value] || 'bg-gray-100 text-gray-800'}>
          {orderStatusLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'paymentStatus',
      header: '결제상태',
      width: 90,
      render: (value) => value === 'paid' ? (
        <Badge className="bg-green-100 text-green-800">결제완료</Badge>
      ) : (
        <Badge className="bg-red-100 text-red-800">미결제</Badge>
      ),
    },
    {
      key: 'virtualAccountNumber',
      header: '가상계좌',
      width: 200,
      render: (value, row) => value ? (
        <span className="font-mono text-sm">
          {row.virtualAccountBank && `${row.virtualAccountBank} `}
          {value}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    },
  ];

  const balanceColumns: ColumnDef<BalancePayment>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 80,
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>,
    },
    {
      key: 'orderDate',
      header: '날짜',
      width: 95,
      render: (value) => value ? format(new Date(value), 'MM-dd') : '-',
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 90,
      render: (value) => <span className="font-medium">{value || '-'}</span>,
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 90,
      render: (value) => <span className="font-medium">{value || '-'}</span>,
    },
    {
      key: 'deliveredCount',
      header: '배송',
      width: 60,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'returnedCount',
      header: '반품',
      width: 60,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'grossAmount',
      header: '총액',
      width: 100,
      align: 'right',
      render: (value) => <Money amount={value} size="sm" />,
    },
    {
      key: 'depositAmount',
      header: '계약금',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{value?.toLocaleString()}원</span>,
    },
    {
      key: 'balanceAmount',
      header: '잔금',
      width: 100,
      align: 'right',
      render: (value) => <Money amount={value} size="sm" />,
    },
    {
      key: 'paymentStatus',
      header: '상태',
      width: 80,
      render: (value) => value === 'paid' ? (
        <Badge className="bg-green-100 text-green-800">완료</Badge>
      ) : (
        <Badge className="bg-orange-100 text-orange-800">미결제</Badge>
      ),
    },
    {
      key: 'balanceDueDate',
      header: '납기일',
      width: 95,
      render: (value, row) => {
        if (!value) return '-';
        const isOverdue = row.paymentStatus === 'unpaid' && new Date(value) < new Date();
        return (
          <span className={cn('text-sm', isOverdue && 'text-red-600 font-medium')}>
            {format(new Date(value), 'MM-dd')}
          </span>
        );
      },
    },
  ];

  const refundColumns: ColumnDef<Refund>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 80,
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>,
    },
    {
      key: 'orderDate',
      header: '날짜',
      width: 95,
      render: (value) => value ? format(new Date(value), 'MM-dd') : '-',
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 100,
      render: (value) => <span className="font-medium">{value || '-'}</span>,
    },
    {
      key: 'refundType',
      header: '유형',
      width: 80,
      render: (value) => (
        <Badge className={value === 'before_matching' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}>
          {refundTypeLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'reasonCategory',
      header: '사유',
      width: 100,
      render: (value) => reasonCategoryLabels[value] || value,
    },
    {
      key: 'depositAmount',
      header: '계약금',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{value?.toLocaleString()}원</span>,
    },
    {
      key: 'refundRate',
      header: '환불율',
      width: 70,
      align: 'center',
      render: (value) => `${value}%`,
    },
    {
      key: 'refundAmount',
      header: '환불금액',
      width: 100,
      align: 'right',
      render: (value) => <Money amount={value} size="sm" />,
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => (
        <Badge className={statusColors[value] || 'bg-gray-100 text-gray-800'}>
          {statusLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'processedAt',
      header: '처리일시',
      width: 130,
      render: (value) => value ? (
        <span className="text-sm text-muted-foreground">
          {format(new Date(value), 'MM-dd HH:mm')}
        </span>
      ) : '-',
    },
  ];

  // ============ 렌더링 ============

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">💰 결제 관리</h1>
          <p className="text-muted-foreground">계약금, 잔금, 환불을 통합 관리합니다</p>
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
        </div>
      </div>

      {/* 통합 카드 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-3 w-[450px]">
                <TabsTrigger value="deposit" className="relative">
                  <CreditCard className="h-4 w-4 mr-2" />
                  계약금
                  {depositStats.unpaid > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                      {depositStats.unpaid}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="balance" className="relative">
                  <Wallet className="h-4 w-4 mr-2" />
                  잔금
                  {balanceStats.unpaid > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                      {balanceStats.unpaid}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="refunds" className="relative">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  환불
                  {refundStats.pending > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {refundStats.pending}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* 검색 */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="오더번호, 요청자, 전화번호 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 계약금 탭 */}
            <TabsContent value="deposit" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{filteredDepositPayments.length}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">결제완료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{depositStats.paid}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">미결제</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{depositStats.unpaid}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 결제금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{depositStats.totalAmount.toLocaleString()}원</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={depositColumns}
                data={filteredDepositPayments}
                onRowClick={(row) => setSelectedDeposit(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingDeposit}
              />
            </TabsContent>

            {/* 잔금 탭 */}
            <TabsContent value="balance" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{filteredBalancePayments.length}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">결제완료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{balanceStats.paid}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">미결제</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{balanceStats.unpaid}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">연체</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{balanceStats.overdue}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 잔금</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{balanceStats.totalAmount.toLocaleString()}원</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={balanceColumns}
                data={filteredBalancePayments}
                onRowClick={(row) => setSelectedBalance(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingBalance}
              />
            </TabsContent>

            {/* 환불 탭 */}
            <TabsContent value="refunds" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{filteredRefunds.length}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">처리대기</CardTitle>
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
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">거절</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{refundStats.rejected}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 환불금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{refundStats.totalAmount.toLocaleString()}원</div>
                  </CardContent>
                </Card>
              </div>

              {/* 일괄 승인 버튼 */}
              {activeTab === 'refunds' && selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium">{selectedIds.size}건 선택됨</span>
                  <Button
                    size="sm"
                    onClick={() => {
                      const pendingIds = filteredRefunds
                        .filter(r => selectedIds.has(r.id) && r.status === 'pending')
                        .map(r => r.id);
                      if (pendingIds.length === 0) {
                        toast({ title: '승인 가능한 환불 건이 없습니다.', variant: 'destructive' });
                        return;
                      }
                      if (confirm(`처리대기 중인 ${pendingIds.length}건을 일괄 승인하시겠습니까?`)) {
                        bulkRefundApproveMutation.mutate(pendingIds);
                      }
                    }}
                    disabled={bulkRefundApproveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {bulkRefundApproveMutation.isPending ? '처리중...' : '일괄 환불 승인'}
                  </Button>
                </div>
              )}

              {/* 테이블 */}
              <ExcelTable
                columns={refundColumns}
                data={filteredRefunds}
                onRowClick={(row) => setSelectedRefund(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingRefunds}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 계약금 상세 모달 */}
      <Dialog open={!!selectedDeposit} onOpenChange={() => setSelectedDeposit(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>계약금 상세 - 오더 #{selectedDeposit?.orderId}</DialogTitle>
          </DialogHeader>
          
          {selectedDeposit && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">요청자명</div>
                  <div className="font-medium">{selectedDeposit.requesterName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">연락처</div>
                  <div className="font-medium">{selectedDeposit.requesterPhone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">이메일</div>
                  <div className="font-medium">{selectedDeposit.requesterEmail}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">주문일시</div>
                  <div className="font-medium">
                    {selectedDeposit.orderDate ? format(new Date(selectedDeposit.orderDate), 'yyyy-MM-dd HH:mm') : '-'}
                  </div>
                </div>
              </div>

              {/* 결제 정보 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">결제 정보</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">계약금</span>
                    <span className="font-bold text-lg">{selectedDeposit.depositAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">결제 상태</span>
                    <Badge className={selectedDeposit.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {selectedDeposit.paymentStatus === 'paid' ? '결제완료' : '미결제'}
                    </Badge>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">오더 상태</span>
                    <Badge className={orderStatusColors[selectedDeposit.orderStatus]}>
                      {orderStatusLabels[selectedDeposit.orderStatus] || selectedDeposit.orderStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* 가상계좌 정보 */}
              {selectedDeposit.virtualAccountNumber && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">가상계좌 정보</h3>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">은행</div>
                        <div className="font-medium">{selectedDeposit.virtualAccountBank}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">계좌번호</div>
                        <div className="font-mono font-medium">{selectedDeposit.virtualAccountNumber}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedDeposit(null)}>
                  닫기
                </Button>
                {selectedDeposit.paymentStatus === 'unpaid' && (
                  <Button onClick={() => toast({ title: '입금 확인 기능은 개발 예정입니다.' })}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    입금 확인
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 잔금 상세 모달 */}
      <Dialog open={!!selectedBalance} onOpenChange={() => setSelectedBalance(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>잔금 상세 - 오더 #{selectedBalance?.orderId}</DialogTitle>
          </DialogHeader>
          
          {selectedBalance && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">요청자</div>
                  <div className="font-medium">{selectedBalance.requesterName}</div>
                  <div className="text-xs text-muted-foreground">{selectedBalance.requesterPhone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">헬퍼</div>
                  <div className="font-medium">{selectedBalance.helperName}</div>
                  <div className="text-xs text-muted-foreground">{selectedBalance.helperEmail}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">마감 제출일</div>
                  <div className="font-medium">
                    {selectedBalance.closingSubmittedAt ? format(new Date(selectedBalance.closingSubmittedAt), 'yyyy-MM-dd') : '미제출'}
                  </div>
                </div>
              </div>

              {/* 작업 내역 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">작업 내역</h3>
                <div className="grid grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold">{selectedBalance.deliveredCount}</div>
                      <div className="text-sm text-muted-foreground">배송</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold">{selectedBalance.returnedCount}</div>
                      <div className="text-sm text-muted-foreground">반품</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold">{selectedBalance.etcCount}</div>
                      <div className="text-sm text-muted-foreground">기타</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-lg font-bold">{selectedBalance.unitPrice.toLocaleString()}원</div>
                      <div className="text-sm text-muted-foreground">단가</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* 정산 내역 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">정산 내역</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">공급가액</span>
                    <span className="font-medium">{selectedBalance.supplyAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">부가세 (10%)</span>
                    <span className="font-medium">{selectedBalance.vatAmount.toLocaleString()}원</span>
                  </div>
                  {selectedBalance.extraCostsTotal > 0 && (
                    <div className="flex justify-between p-3">
                      <span className="text-muted-foreground">추가 비용</span>
                      <span className="font-medium text-orange-600">+{selectedBalance.extraCostsTotal.toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="flex justify-between p-3 bg-blue-50">
                    <span className="font-semibold">총 거래액</span>
                    <span className="font-bold text-blue-600">{selectedBalance.grossAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">계약금 (기지급)</span>
                    <span className="font-medium">-{selectedBalance.depositAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50">
                    <span className="font-bold">잔금</span>
                    <span className="font-bold text-xl text-green-600">{selectedBalance.balanceAmount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>

              {/* 잔금 결제 정보 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">잔금 결제 정보</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">결제 상태</div>
                    <Badge className={selectedBalance.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                      {selectedBalance.paymentStatus === 'paid' ? '결제완료' : '미결제'}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">납기일</div>
                    <div className="font-medium">
                      {selectedBalance.balanceDueDate ? format(new Date(selectedBalance.balanceDueDate), 'yyyy-MM-dd') : '미정'}
                    </div>
                  </div>
                  {selectedBalance.balancePaidAt && (
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground">입금 확인일</div>
                      <div className="font-medium">{format(new Date(selectedBalance.balancePaidAt), 'yyyy-MM-dd HH:mm')}</div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedBalance(null)}>
                  닫기
                </Button>
                {selectedBalance.paymentStatus === 'unpaid' && (
                  <Button onClick={() => toast({ title: '잔금 확인 기능은 개발 예정입니다.' })}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    잔금 확인
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 환불 상세 모달 */}
      <Dialog open={!!selectedRefund} onOpenChange={() => setSelectedRefund(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>환불 상세 - 오더 #{selectedRefund?.orderId}</DialogTitle>
          </DialogHeader>
          
          {selectedRefund && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">요청자명</div>
                  <div className="font-medium">{selectedRefund.requesterName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">연락처</div>
                  <div className="font-medium">{selectedRefund.requesterPhone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">환불 유형</div>
                  <Badge className={selectedRefund.refundType === 'before_matching' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}>
                    {refundTypeLabels[selectedRefund.refundType]}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">사유 분류</div>
                  <div className="font-medium">{reasonCategoryLabels[selectedRefund.reasonCategory]}</div>
                </div>
              </div>

              {/* 환불 계산 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">환불 계산</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">계약금</span>
                    <span className="font-medium">{selectedRefund.depositAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">환불율</span>
                    <span className="font-medium">{selectedRefund.refundRate}%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-orange-50">
                    <span className="font-bold">환불 금액</span>
                    <span className="font-bold text-xl text-orange-600">{selectedRefund.refundAmount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>

              {/* 취소 사유 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">취소 사유</h3>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedRefund.cancelReason || '사유 미입력'}</p>
                </div>
              </div>

              {/* 환불 계좌 */}
              {selectedRefund.refundAccountNumber && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">환불 계좌</h3>
                  <div className="grid grid-cols-3 gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">은행</div>
                      <div className="font-medium">{selectedRefund.refundBankName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">계좌번호</div>
                      <div className="font-mono font-medium">{selectedRefund.refundAccountNumber}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">예금주</div>
                      <div className="font-medium">{selectedRefund.refundAccountHolder}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 처리 상태 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">처리 상태</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">현재 상태</div>
                    <Badge className={statusColors[selectedRefund.status]}>
                      {statusLabels[selectedRefund.status]}
                    </Badge>
                  </div>
                  {selectedRefund.processedAt && (
                    <div>
                      <div className="text-sm text-muted-foreground">처리일시</div>
                      <div className="font-medium">{format(new Date(selectedRefund.processedAt), 'yyyy-MM-dd HH:mm')}</div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedRefund(null)}>
                  닫기
                </Button>
                {selectedRefund.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={processRefundMutation.isPending}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      거절
                    </Button>
                    <Button
                      onClick={() => {
                        if (confirm(`환불 ${selectedRefund.refundAmount.toLocaleString()}원을 승인하시겠습니까?`)) {
                          processRefundMutation.mutate({
                            refundId: selectedRefund.id,
                            status: 'completed',
                          });
                        }
                      }}
                      disabled={processRefundMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {processRefundMutation.isPending ? '처리중...' : '환불 승인'}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 환불 거절 사유 모달 */}
      <Dialog open={rejectModalOpen} onOpenChange={(open) => { setRejectModalOpen(open); if (!open) setRejectReason(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>환불 거절</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">오더 #{selectedRefund?.orderId}</div>
              <div className="text-lg font-bold text-orange-600">
                환불 금액: {selectedRefund?.refundAmount.toLocaleString()}원
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">거절 사유 <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="환불 거절 사유를 입력해주세요..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectModalOpen(false); setRejectReason(''); }}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast({ title: '거절 사유를 입력해주세요.', variant: 'destructive' });
                  return;
                }
                if (selectedRefund) {
                  processRefundMutation.mutate({
                    refundId: selectedRefund.id,
                    status: 'rejected',
                    adminNotes: rejectReason.trim(),
                  });
                }
              }}
              disabled={processRefundMutation.isPending || !rejectReason.trim()}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {processRefundMutation.isPending ? '처리중...' : '거절 확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
