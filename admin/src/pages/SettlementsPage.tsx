/**
 * Settlements Page - 재설계 버전
 * 정산 관리 - 헬퍼 정산 확정/보류/지급 처리
 *
 * 개선사항:
 * - PageHeader 적용
 * - StatsGrid로 통계 카드 표준화
 * - DataTable로 고정 헤더 테이블 적용
 * - StatusBadge로 상태 표시 개선
 * - FilterBar 적용
 * - BatchActions for 일괄 처리
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { BatchActions } from '@/components/ui/action-buttons';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityLink } from '@/components/common';
import {
  Wallet,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  Banknote,
  AlertCircle as AlertCircleIcon,
  FileWarning,
  XCircle,
  Play,
  Pause,
  User,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SETTLEMENT_STATUS } from '@/constants/settlementStatus';

interface Settlement {
  id: number;
  helperId: string | null;
  helperName: string | null;
  helperPhone: string | null;
  orderId: number | null;
  orderTitle: string | null;
  workDate: string | null;
  baseSupply: number | null;
  urgentFeeSupply: number | null;
  extraSupply: number | null;
  finalSupply: number | null;
  vat: number | null;
  finalTotal: number | null;
  platformFeeRate: number | null;
  platformFee: number | null;
  driverPayout: number | null;
  status: string | null;
  createdAt: string | null;
  calculatedAt: string | null;
  totalAmount: number | null;
  netAmount: number | null;
  commissionAmount: number | null;
  deliveryCount: number | null;
  returnCount: number | null;
}

interface SettlementValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateSettlement(s: Settlement): SettlementValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (s.helperId === null) errors.push('헬퍼 ID 누락');
  if (s.orderId === null) warnings.push('오더 ID 누락');
  if (s.finalTotal === null || s.finalTotal === 0) errors.push('최종총액 누락');
  if (s.driverPayout === null) errors.push('기사지급액 누락');
  if (!s.status) errors.push('상태 누락');

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}

export default function SettlementsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State
  const [activeView, setActiveView] = useState<'all' | 'pending' | 'confirmed' | 'on_hold' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [selectedRows, setSelectedRows] = useState<Settlement[]>([]);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  // API Queries
  const { data: settlements = [], isLoading, error, refetch } = useQuery<Settlement[]>({
    queryKey: ['admin-settlements'],
    queryFn: async () => {
      const data = await apiRequest<Settlement[]>('/settlements');
      return data;
    },
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async (settlementId: number) => {
      return apiRequest(`/settlements/${settlementId}/confirm`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setIsApproveModalOpen(false);
      setSelectedSettlement(null);
      toast({ title: '정산이 확정되었습니다.' });
    },
  });

  const holdMutation = useMutation({
    mutationFn: async ({ settlementId, reason }: { settlementId: number; reason: string }) => {
      return apiRequest(`/settlements/${settlementId}/hold`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setIsHoldModalOpen(false);
      setSelectedSettlement(null);
      setHoldReason('');
      toast({ title: '정산이 보류되었습니다.' });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (settlementId: number) => {
      return apiRequest(`/settlements/${settlementId}/release`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setIsReleaseModalOpen(false);
      setSelectedSettlement(null);
      toast({ title: '보류가 해제되었습니다.' });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (settlementId: number) => {
      return apiRequest(`/settlements/${settlementId}/pay`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setIsPayModalOpen(false);
      setSelectedSettlement(null);
      toast({ title: '지급이 완료되었습니다.' });
    },
  });

  const batchApproveMutation = useMutation({
    mutationFn: async (settlementIds: number[]) => {
      return Promise.all(
        settlementIds.map(id => apiRequest(`/settlements/${id}/confirm`, { method: 'PATCH' }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setSelectedRows([]);
      toast({ title: `${selectedRows.length}건의 정산이 확정되었습니다.` });
    },
  });

  // Computed values
  const viewCounts = useMemo(() => {
    return {
      pending: settlements.filter(s => s.status === SETTLEMENT_STATUS.PENDING).length,
      confirmed: settlements.filter(s =>
        s.status === SETTLEMENT_STATUS.CONFIRMED || s.status === SETTLEMENT_STATUS.READY
      ).length,
      on_hold: settlements.filter(s => s.status === SETTLEMENT_STATUS.ON_HOLD).length,
      paid: settlements.filter(s => s.status === SETTLEMENT_STATUS.PAID).length,
    };
  }, [settlements]);

  const totalPending = useMemo(() => {
    return settlements
      .filter(s => s.status !== SETTLEMENT_STATUS.PAID)
      .reduce((sum, s) => sum + (s.driverPayout || 0), 0);
  }, [settlements]);

  const invalidSettlements = useMemo(() => {
    return settlements.filter(s => !validateSettlement(s).isValid);
  }, [settlements]);

  const filteredSettlements = useMemo(() => {
    return settlements.filter((settlement) => {
      // Status filter
      if (activeView !== 'all') {
        const statusMap: Record<string, string[]> = {
          pending: [SETTLEMENT_STATUS.PENDING],
          confirmed: [SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.READY],
          on_hold: [SETTLEMENT_STATUS.ON_HOLD],
          paid: [SETTLEMENT_STATUS.PAID],
        };
        const allowedStatuses = statusMap[activeView] || [];
        if (!allowedStatuses.includes(settlement.status || '')) return false;
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return String(settlement.id).includes(q) ||
          (settlement.helperName || '').toLowerCase().includes(q) ||
          (settlement.orderTitle || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [settlements, activeView, searchQuery]);

  // Handlers
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredSettlements.map(item => ({
      '정산ID': item.id,
      '헬퍼': item.helperName || '',
      '오더ID': item.orderId || '',
      '작업일': item.workDate || '',
      '공급가': item.finalSupply || 0,
      'VAT': item.vat || 0,
      '총액': item.finalTotal || 0,
      '플랫폼수수료': item.platformFee || 0,
      '기사지급액': item.driverPayout || 0,
      '상태': item.status || '',
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
    link.download = `정산목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchApprove = () => {
    const ids = selectedRows.map(s => s.id);
    batchApproveMutation.mutate(ids);
  };

  // Table columns
  const columns: ColumnDef<Settlement>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => <SortableHeader column={column}>정산ID</SortableHeader>,
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          <EntityLink type="settlement" id={row.original.id} />
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => {
        const validation = validateSettlement(row.original);
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={row.original.status || 'pending'} size="sm" />
            {!validation.isValid && (
              <Badge variant="destructive" className="text-xs">
                <FileWarning className="h-3 w-3 mr-1" />
                오류
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'helperName',
      header: '헬퍼',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.helperName || '-'}</div>
          {row.original.helperPhone && (
            <div className="text-xs text-muted-foreground">{row.original.helperPhone}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'orderId',
      header: '오더',
      cell: ({ row }) => (
        <div>
          {row.original.orderId ? (
            <>
              <EntityLink type="order" id={row.original.orderId} />
              {row.original.orderTitle && (
                <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {row.original.orderTitle}
                </div>
              )}
            </>
          ) : (
            '-'
          )}
        </div>
      ),
    },
    {
      accessorKey: 'workDate',
      header: ({ column }) => <SortableHeader column={column}>작업일</SortableHeader>,
      cell: ({ row }) => row.original.workDate ? (
        <span className="text-sm">
          {new Date(row.original.workDate).toLocaleDateString('ko-KR')}
        </span>
      ) : '-',
    },
    {
      accessorKey: 'finalTotal',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>총액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-medium">{formatAmount(row.original.finalTotal)}</div>
          {row.original.platformFee && (
            <div className="text-xs text-red-600">-{formatAmount(row.original.platformFee)}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'driverPayout',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>지급액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-bold text-green-600">
          {formatAmount(row.original.driverPayout)}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <div className="flex gap-1 justify-end flex-wrap">
            {status === SETTLEMENT_STATUS.PENDING && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSettlement(row.original);
                    setIsApproveModalOpen(true);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  확정
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSettlement(row.original);
                    setIsHoldModalOpen(true);
                  }}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  보류
                </Button>
              </>
            )}
            {status === SETTLEMENT_STATUS.ON_HOLD && (
              <Button
                size="sm"
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSettlement(row.original);
                  setIsReleaseModalOpen(true);
                }}
              >
                <Play className="h-4 w-4 mr-1" />
                해제
              </Button>
            )}
            {(status === SETTLEMENT_STATUS.CONFIRMED || status === SETTLEMENT_STATUS.READY) && (
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSettlement(row.original);
                  setIsPayModalOpen(true);
                }}
              >
                <Banknote className="h-4 w-4 mr-1" />
                지급
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Loading/Error states
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="정산 관리"
          description="정산 데이터를 불러올 수 없습니다"
        />
        <EmptyState
          icon={<AlertCircleIcon className="h-12 w-12 text-destructive" />}
          title="정산 데이터를 불러올 수 없습니다"
          description={(error as Error).message}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="정산 관리"
        description="지급 전 확정/차감 반영/보류 처리"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredSettlements.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
          </>
        }
      />

      {/* Stats Grid */}
      <StatsGrid>
        <StatsCard
          title="산출됨"
          value={viewCounts.pending}
          description="확정 대기중"
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="보류"
          value={viewCounts.on_hold}
          description="검토 필요"
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          variant={viewCounts.on_hold > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="확정"
          value={viewCounts.confirmed}
          description="지급 대기중"
          icon={<CheckCircle className="h-5 w-5 text-blue-500" />}
          variant="primary"
        />
        <StatsCard
          title="총 미지급액"
          value={formatAmount(totalPending)}
          description="지급 예정 총액"
          icon={<Wallet className="h-5 w-5 text-emerald-500" />}
          variant="success"
        />
        <StatsCard
          title="데이터 오류"
          value={invalidSettlements.length}
          description="확인 필요"
          icon={<FileWarning className="h-5 w-5 text-red-500" />}
          variant={invalidSettlements.length > 0 ? "danger" : "default"}
        />
      </StatsGrid>

      {/* Status Tabs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { key: 'all' as const, label: '전체', count: settlements.length },
          { key: 'pending' as const, label: '산출됨', count: viewCounts.pending },
          { key: 'confirmed' as const, label: '확정', count: viewCounts.confirmed },
          { key: 'on_hold' as const, label: '보류', count: viewCounts.on_hold },
          { key: 'paid' as const, label: '지급완료', count: viewCounts.paid },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-lg border-2 font-medium text-sm transition-all",
              activeView === key
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-700 border-gray-400 hover:bg-gray-50"
            )}
          >
            <span className="text-2xl font-bold">{count}</span>
            <span className="mt-1">{label}</span>
          </button>
        ))}
      </div>

      {/* Batch Actions */}
      {selectedRows.length > 0 && activeView === 'pending' && (
        <BatchActions
          selectedCount={selectedRows.length}
          onApprove={handleBatchApprove}
          loading={batchApproveMutation.isPending}
        />
      )}

      {/* Filter Bar */}
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="정산ID, 헬퍼명, 오더 검색..."
        showRefresh={false}
        showExport={false}
      />

      {/* Data Table */}
      {filteredSettlements.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-12 w-12 text-gray-400" />}
          title="정산 내역이 없습니다"
          description="검색 조건을 변경하거나 새로운 정산을 기다려주세요."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredSettlements}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 650px)"
          loading={isLoading}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
        />
      )}

      {/* Modals */}
      {/* Approve Modal */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정산 확정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>정산 #{selectedSettlement?.id}을 확정하시겠습니까?</p>
            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">헬퍼</span>
                  <span className="font-medium">{selectedSettlement?.helperName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">지급액</span>
                  <span className="font-bold text-green-600">
                    {formatAmount(selectedSettlement?.driverPayout)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)}>취소</Button>
            <Button onClick={() => selectedSettlement && approveMutation.mutate(selectedSettlement.id)}>
              확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Modal */}
      <Dialog open={isHoldModalOpen} onOpenChange={setIsHoldModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정산 보류</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>정산 #{selectedSettlement?.id}을 보류하시겠습니까?</p>
            <div>
              <label className="text-sm font-medium">보류 사유</label>
              <Textarea
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="보류 사유를 입력하세요"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoldModalOpen(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => selectedSettlement && holdMutation.mutate({
                settlementId: selectedSettlement.id,
                reason: holdReason
              })}
              disabled={!holdReason.trim()}
            >
              보류
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Modal */}
      <Dialog open={isReleaseModalOpen} onOpenChange={setIsReleaseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>보류 해제</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>정산 #{selectedSettlement?.id}의 보류를 해제하시겠습니까?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReleaseModalOpen(false)}>취소</Button>
            <Button onClick={() => selectedSettlement && releaseMutation.mutate(selectedSettlement.id)}>
              해제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Modal */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지급 완료 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>정산 #{selectedSettlement?.id}을 지급 완료 처리하시겠습니까?</p>
            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">헬퍼</span>
                  <span className="font-medium">{selectedSettlement?.helperName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">지급액</span>
                  <span className="font-bold text-green-600">
                    {formatAmount(selectedSettlement?.driverPayout)}
                  </span>
                </div>
              </CardContent>
            </Card>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
              <p className="text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                지급 완료 처리 후에는 되돌릴 수 없습니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayModalOpen(false)}>취소</Button>
            <Button onClick={() => selectedSettlement && payMutation.mutate(selectedSettlement.id)}>
              지급 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
