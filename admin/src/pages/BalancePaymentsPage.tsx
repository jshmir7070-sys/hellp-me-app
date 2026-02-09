import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api';
import { CreditCard, RefreshCw, Download, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';

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

export default function BalancePaymentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const { data: payments = [], isLoading } = useQuery<BalancePayment[]>({
    queryKey: ['balance-payments'],
    queryFn: async () => {
      try {
        return await apiRequest<BalancePayment[]>('/payments-detail?type=balance');
      } catch {
        return [];
      }
    },
  });

  const filteredPayments = payments.filter(p =>
    p.requesterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.helperName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterPhone?.includes(searchTerm) ||
    String(p.orderId).includes(searchTerm)
  );

  const paidCount = filteredPayments.filter(p => p.paymentStatus === 'paid').length;
  const unpaidCount = filteredPayments.filter(p => p.paymentStatus === 'unpaid').length;
  const overdueCount = filteredPayments.filter(p => 
    p.paymentStatus === 'unpaid' && p.balanceDueDate && new Date(p.balanceDueDate) < new Date()
  ).length;
  const totalBalanceAmount = filteredPayments
    .filter(p => p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + (p.balanceAmount || 0), 0);
  const totalGrossAmount = filteredPayments
    .reduce((sum, p) => sum + (p.grossAmount || 0), 0);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['balance-payments'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredPayments.map(item => ({
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
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `잔금결제_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<BalancePayment>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 80,
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>,
    },
    {
      key: 'orderDate',
      header: '날짜',
      width: 90,
      render: (value) => value ? format(new Date(value), 'yyyy-MM-dd') : '-',
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 100,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.requesterPhone || ''}</div>
        </div>
      ),
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 80,
      render: (value) => value || '-',
    },
    {
      key: 'deliveredCount',
      header: '배송수',
      width: 70,
      align: 'right',
      render: (value) => value?.toLocaleString() || 0,
    },
    {
      key: 'returnedCount',
      header: '반품수',
      width: 70,
      align: 'right',
      render: (value) => value?.toLocaleString() || 0,
    },
    {
      key: 'etcCount',
      header: '기타',
      width: 100,
      align: 'right',
      render: (value, row) => value > 0 ? (
        <span>{value} x {row.etcPricePerUnit?.toLocaleString()}원</span>
      ) : row.extraCostsTotal > 0 ? (
        <span>{row.extraCostsTotal?.toLocaleString()}원</span>
      ) : '-',
    },
    {
      key: 'unitPrice',
      header: '단가',
      width: 80,
      align: 'right',
      render: (value) => `${value?.toLocaleString()}원`,
    },
    {
      key: 'supplyAmount',
      header: '공급가',
      width: 90,
      align: 'right',
      render: (value) => `${value?.toLocaleString()}원`,
    },
    {
      key: 'vatAmount',
      header: '부가세',
      width: 80,
      align: 'right',
      render: (value) => <span className="text-muted-foreground">{value?.toLocaleString()}원</span>,
    },
    {
      key: 'grossAmount',
      header: '총액',
      width: 100,
      align: 'right',
      render: (value) => <span className="font-medium">{value?.toLocaleString()}원</span>,
    },
    {
      key: 'depositAmount',
      header: '계약금',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-orange-600">-{value?.toLocaleString()}원</span>,
    },
    {
      key: 'balanceAmount',
      header: '잔금',
      width: 100,
      align: 'right',
      render: (value) => <span className="font-bold text-blue-700">{value?.toLocaleString()}원</span>,
    },
    {
      key: 'orderStatus',
      header: '오더상태',
      width: 85,
      render: (value) => (
        <Badge className={orderStatusColors[value] || 'bg-gray-100 text-gray-800'}>
          {orderStatusLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'paymentStatus',
      header: '결제상태',
      width: 80,
      render: (value, row) => {
        if (value === 'paid') {
          return <Badge className="bg-green-100 text-green-800">결제완료</Badge>;
        }
        const isOverdue = row.balanceDueDate && new Date(row.balanceDueDate) < new Date();
        return isOverdue ? (
          <Badge className="bg-red-600 text-white animate-pulse">연체</Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800">미결제</Badge>
        );
      },
    },
    {
      key: 'balancePaidAt',
      header: '잔금입금일',
      width: 100,
      render: (value, row) => {
        if (value) {
          return format(new Date(value), 'yyyy-MM-dd');
        }
        if (row.balanceDueDate) {
          const dueDate = new Date(row.balanceDueDate);
          const isOverdue = dueDate < new Date();
          return (
            <span className={isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
              {isOverdue ? '기한초과' : `~${format(dueDate, 'MM/dd')}`}
            </span>
          );
        }
        return '-';
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">잔금 결제</h1>
          <p className="text-muted-foreground">헬퍼 마감자료를 토대로 산출된 잔금 결제 내역입니다. (배송수+반품수+기타+부가세 적용)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredPayments.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredPayments.length}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">결제완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidCount}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">미결제</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{unpaidCount}건</div>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? 'border-red-500 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">연체</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-700 animate-pulse' : 'text-gray-400'}`}>
              {overdueCount}건
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 금액(VAT포함)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGrossAmount.toLocaleString()}원</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">결제완료 잔금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalBalanceAmount.toLocaleString()}원</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              잔금 결제 내역
              {selectedIds.size > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({selectedIds.size}개 선택)
                </span>
              )}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름, 이메일, 전화번호, 오더ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={filteredPayments}
            columns={columns}
            loading={isLoading}
            emptyMessage="잔금 결제 내역이 없습니다."
            getRowId={(row) => row.id}
            storageKey="balance-payments"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>
    </div>
  );
}
