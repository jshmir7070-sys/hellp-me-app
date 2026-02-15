import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api';
import { CreditCard, RefreshCw, Search, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';

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

export default function DepositPaymentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: payments = [], isLoading } = useQuery<DepositPayment[]>({
    queryKey: ['deposit-payments'],
    queryFn: async () => {
      try {
        return await apiRequest<DepositPayment[]>('/payments-detail?type=deposit');
      } catch {
        return [];
      }
    },
  });

  const filteredPayments = payments.filter(p =>
    p.requesterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.requesterPhone?.includes(searchTerm) ||
    String(p.orderId).includes(searchTerm)
  );

  const paidCount = filteredPayments.filter(p => p.paymentStatus === 'paid').length;
  const unpaidCount = filteredPayments.filter(p => p.paymentStatus === 'unpaid').length;
  const totalAmount = filteredPayments
    .filter(p => p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + (p.depositAmount || 0), 0);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['deposit-payments'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredPayments.map((item) => ({
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
    link.download = `계약금결제_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<DepositPayment>[] = [
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
      header: '요청자이름',
      width: 100,
      render: (value) => <span className="font-medium">{value || '-'}</span>,
    },
    {
      key: 'requesterEmail',
      header: '아이디',
      width: 150,
      render: (value) => <span className="text-muted-foreground">{value || '-'}</span>,
    },
    {
      key: 'requesterPhone',
      header: '전화번호',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'depositAmount',
      header: '계약금금액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{value?.toLocaleString()}원</span>,
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
      width: 80,
      render: (value) => value === 'paid' ? (
        <Badge className="bg-green-100 text-green-800">결제완료</Badge>
      ) : (
        <Badge className="bg-red-100 text-red-800">미결제</Badge>
      ),
    },
    {
      key: 'virtualAccountNumber',
      header: '가상계좌번호',
      width: 180,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">계약금 결제</h1>
          <p className="text-muted-foreground">오더 계약금 결제 내역을 조회합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            CSV 다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 계약금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAmount.toLocaleString()}원</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              계약금 결제 내역
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
            emptyMessage="계약금 결제 내역이 없습니다."
            getRowId={(row) => row.id}
            storageKey="deposit-payments"
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
