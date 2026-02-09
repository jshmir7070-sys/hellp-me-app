/**
 * Refunds Page - 재설계 버전
 * 환불 관리 - 비매칭(매칭 전) 고객취소에 따른 환불 내역
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - StatusBadge로 통합
 * - EmptyState 추가
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api';
import { RotateCcw, RefreshCw, Download, FileText, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

  // 검색 필터
  const filteredRefunds = useMemo(() => {
    return refunds.filter(r =>
      r.requesterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requesterPhone?.includes(searchTerm) ||
      r.cancelReason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(r.orderId).includes(searchTerm)
    );
  }, [refunds, searchTerm]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = filteredRefunds.length;
    const pending = filteredRefunds.filter(r => r.status === 'pending').length;
    const completed = filteredRefunds.filter(r => r.status === 'completed').length;
    const totalAmount = filteredRefunds
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    return { total, pending, completed, totalAmount };
  }, [filteredRefunds]);

  const columns: ColumnDef<Refund>[] = [
    {
      accessorKey: 'orderId',
      header: ({ column }) => <SortableHeader column={column}>오더번호</SortableHeader>,
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.original.orderId}</span>
      ),
    },
    {
      accessorKey: 'orderDate',
      header: ({ column }) => <SortableHeader column={column}>날짜</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.orderDate ? format(new Date(row.original.orderDate), 'yyyy-MM-dd') : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'requesterName',
      header: '요청자이름',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.requesterName || '-'}</span>
      ),
    },
    {
      accessorKey: 'requesterEmail',
      header: '아이디',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.requesterEmail || '-'}</span>
      ),
    },
    {
      accessorKey: 'requesterPhone',
      header: '전화번호',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.requesterPhone || '-'}</span>
      ),
    },
    {
      accessorKey: 'refundType',
      header: '환불유형',
      cell: ({ row }) => (
        <Badge className={refundTypeColors[row.original.refundType] || 'bg-gray-100 text-gray-800'}>
          {refundTypeLabels[row.original.refundType] || row.original.refundType}
        </Badge>
      ),
    },
    {
      accessorKey: 'reasonCategory',
      header: '환불사유',
      cell: ({ row }) => (
        <Badge className={reasonCategoryColors[row.original.reasonCategory] || 'bg-gray-100 text-gray-800'}>
          {reasonCategoryLabels[row.original.reasonCategory] || row.original.reasonCategory || '-'}
        </Badge>
      ),
    },
    {
      accessorKey: 'depositAmount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>계약금</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-sm">{row.original.depositAmount?.toLocaleString()}원</div>
      ),
    },
    {
      accessorKey: 'refundRate',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>환불율</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-sm">{row.original.refundRate}%</div>
      ),
    },
    {
      accessorKey: 'refundAmount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>환불금액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <span className="font-medium">{row.original.refundAmount?.toLocaleString()}원</span>
        </div>
      ),
    },
    {
      accessorKey: 'cancelReason',
      header: '취소사유',
      cell: ({ row }) => (
        <span className="text-sm truncate block max-w-[200px]" title={row.original.cancelReason}>
          {row.original.cancelReason || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'refundAccountNumber',
      header: '환불계좌',
      cell: ({ row }) => row.original.refundAccountNumber ? (
        <div className="text-sm">
          <span className="font-medium">{row.original.refundBankName}</span>
          <span className="ml-1 font-mono">{row.original.refundAccountNumber}</span>
          {row.original.refundAccountHolder && (
            <span className="ml-1 text-muted-foreground">({row.original.refundAccountHolder})</span>
          )}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => (
        <Badge className={statusColors[row.original.status] || 'bg-gray-100 text-gray-800'}>
          {statusLabels[row.original.status] || row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'processedAt',
      header: ({ column }) => <SortableHeader column={column}>처리일시</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.processedAt ? format(new Date(row.original.processedAt), 'yyyy-MM-dd HH:mm') : '-'}
        </span>
      ),
    },
  ];

  // 로딩 중
  if (isLoading && refunds.length === 0) {
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
        title="환불 관리"
        description="비매칭(매칭 전) 고객취소에 따른 환불 내역 • 자동 정산 연동"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid>
        <StatsCard
          title="총 건수"
          value={`${stats.total}건`}
          description="전체 환불 요청"
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="처리대기"
          value={`${stats.pending}건`}
          description="승인 대기 중"
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          variant={stats.pending > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="환불완료"
          value={`${stats.completed}건`}
          description="정상 처리됨"
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatsCard
          title="총 환불금액"
          value={`${stats.totalAmount.toLocaleString()}원`}
          description="완료된 환불 총액"
          icon={<RotateCcw className="h-5 w-5 text-purple-500" />}
          variant="default"
        />
      </StatsGrid>

      {/* 검색 바 */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="이름, 이메일, 전화번호, 사유 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* 데이터 테이블 */}
      {filteredRefunds.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="h-12 w-12 text-muted-foreground" />}
          title="환불 내역이 없습니다"
          description={searchTerm ? "검색 조건에 맞는 환불 내역이 없습니다." : "환불 요청이 없습니다."}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredRefunds}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 500px)"
          loading={isLoading}
        />
      )}
    </div>
  );
}
