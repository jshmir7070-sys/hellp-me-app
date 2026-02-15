import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api';
import { RotateCcw, RefreshCw, Search, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { useToast } from '@/hooks/use-toast';

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

const refundTypeLabels: Record<string, string> = {
  before_matching: '비매칭',
  after_matching: '매칭후',
};

const refundTypeColors: Record<string, string> = {
  before_matching: 'bg-blue-100 text-blue-800',
  after_matching: 'bg-orange-100 text-orange-800',
};

// 환불 사유 카테고리
const reasonCategoryLabels: Record<string, string> = {
  customer_request: '고객요청',
  unassigned_timeout: '미배정취소',
  deposit_issue: '입금문제',
  after_matching_cancel: '매칭후취소',
  dispute: '분쟁',
  error: '오류',
};

const reasonCategoryColors: Record<string, string> = {
  customer_request: 'bg-gray-100 text-gray-800',
  unassigned_timeout: 'bg-purple-100 text-purple-800',
  deposit_issue: 'bg-red-100 text-red-800',
  after_matching_cancel: 'bg-orange-100 text-orange-800',
  dispute: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
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

export default function RefundsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: refunds = [], isLoading } = useQuery<Refund[]>({
    queryKey: ['refunds'],
    queryFn: async () => {
      try {
        return await apiRequest<Refund[]>('/refunds-detail?type=regular');
      } catch {
        return [];
      }
    },
  });

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['refunds'] });
    toast({ title: '새로고침 완료' });
  };

  const handleDownloadExcel = () => {
    const headers = ['오더번호', '날짜', '요청자이름', '아이디', '전화번호', '환불유형', '환불사유', '계약금', '환불율', '환불금액', '취소사유', '환불계좌', '상태', '처리일시'];
    const rows = (filteredRefunds as unknown as Record<string, unknown>[]).map((row: Record<string, unknown>) => [
      row.orderId,
      row.orderDate ? new Date(row.orderDate as string).toLocaleDateString('ko-KR') : '',
      row.requesterName || '',
      row.requesterEmail || '',
      row.requesterPhone || '',
      refundTypeLabels[row.refundType as string] || row.refundType || '',
      reasonCategoryLabels[row.reasonCategory as string] || row.reasonCategory || '',
      row.depositAmount,
      `${row.refundRate}%`,
      row.refundAmount,
      row.cancelReason || '',
      row.refundAccountNumber ? `${row.refundBankName} ${row.refundAccountNumber}` : '',
      statusLabels[row.status as string] || row.status || '',
      row.processedAt ? new Date(row.processedAt as string).toLocaleString('ko-KR') : '',
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `환불목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: '다운로드 완료' });
  };

  const filteredRefunds = refunds.filter(r =>
    r.requesterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requesterPhone?.includes(searchTerm) ||
    r.cancelReason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(r.orderId).includes(searchTerm)
  );

  const pendingCount = filteredRefunds.filter(r => r.status === 'pending').length;
  const completedCount = filteredRefunds.filter(r => r.status === 'completed').length;
  const totalRefundAmount = filteredRefunds
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

  const columns: ColumnDef<Refund>[] = [
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
      width: 140,
      render: (value) => <span className="text-muted-foreground">{value || '-'}</span>,
    },
    {
      key: 'requesterPhone',
      header: '전화번호',
      width: 115,
      render: (value) => value || '-',
    },
    {
      key: 'refundType',
      header: '환불유형',
      width: 80,
      render: (value) => (
        <Badge className={refundTypeColors[value] || 'bg-gray-100 text-gray-800'}>
          {refundTypeLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'reasonCategory',
      header: '환불사유',
      width: 95,
      render: (value) => (
        <Badge className={reasonCategoryColors[value] || 'bg-gray-100 text-gray-800'}>
          {reasonCategoryLabels[value] || value || '-'}
        </Badge>
      ),
    },
    {
      key: 'depositAmount',
      header: '계약금',
      width: 90,
      align: 'right',
      render: (value) => `${value?.toLocaleString()}원`,
    },
    {
      key: 'refundRate',
      header: '환불율',
      width: 70,
      align: 'right',
      render: (value) => `${value}%`,
    },
    {
      key: 'refundAmount',
      header: '환불금액',
      width: 100,
      align: 'right',
      render: (value) => <span className="font-medium">{value?.toLocaleString()}원</span>,
    },
    {
      key: 'cancelReason',
      header: '취소사유',
      width: 150,
      render: (value) => (
        <span className="text-sm truncate block" title={value}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'refundAccountNumber',
      header: '환불계좌',
      width: 180,
      render: (value, row) => value ? (
        <div>
          <span className="font-medium">{row.refundBankName}</span>
          <span className="ml-1 font-mono">{value}</span>
          {row.refundAccountHolder && (
            <span className="ml-1 text-muted-foreground">({row.refundAccountHolder})</span>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: 85,
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
      render: (value) => value ? format(new Date(value), 'yyyy-MM-dd HH:mm') : '-',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">환불</h1>
          <p className="text-muted-foreground">비매칭(매칭 전) 고객취소에 따른 환불 내역입니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button variant="outline" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            엑셀 다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">환불완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 환불금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRefundAmount.toLocaleString()}원</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              환불 내역
              {selectedIds.size > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({selectedIds.size}개 선택)
                </span>
              )}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름, 이메일, 전화번호, 사유"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={filteredRefunds}
            columns={columns}
            loading={isLoading}
            emptyMessage="환불 내역이 없습니다."
            getRowId={(row) => row.id}
            storageKey="refunds"
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
