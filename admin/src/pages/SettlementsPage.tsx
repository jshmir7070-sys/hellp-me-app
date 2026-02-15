import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  StatusBadge,
  Money,
  UserCell,
  EntityLink,
  DateRangePicker,
  getDefaultDateRange,
  SavedViews,
  DrawerDetail,
  ConfirmModal,
  ReasonModal,
  AuditTrail,
  HelperDetailModal,
} from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { 
  Wallet, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Filter, 
  ChevronDown, 
  Play, 
  Pause, 
  Banknote,
  AlertCircle,
  FileWarning
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SETTLEMENT_STATUS, getSettlementActionState } from '@/constants/settlementStatus';

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
  return amount.toLocaleString('ko-KR') + '원';
}

const savedViews = [
  { id: 'all', label: '전체' },
  { id: 'pending', label: '산출됨', count: 0 },
  { id: 'confirmed', label: '확정/지급대기', count: 0 },
  { id: 'on_hold', label: '보류', count: 0 },
  { id: 'paid', label: '지급완료', count: 0 },
];

export default function SettlementsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState(getDefaultDateRange(30));
  const [activeView, setActiveView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('details');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [helperDetailId, setHelperDetailId] = useState<string | number | null>(null);
  const [isHelperDetailOpen, setIsHelperDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const { data: settlements = [], isLoading, error, refetch } = useQuery<Settlement[]>({
    queryKey: ['admin-settlements', dateRange, activeView],
    queryFn: async () => {
      const data = await apiRequest<Settlement[]>('/settlements');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (settlementId: number) => {
      return apiRequest(`/settlements/${settlementId}/confirm`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setIsApproveModalOpen(false);
      setIsDrawerOpen(false);
      window.alert('정산이 확정되었습니다.');
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
      setIsDrawerOpen(false);
      window.alert('정산이 보류되었습니다.');
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (settlementId: number) => {
      return apiRequest(`/settlements/${settlementId}/release`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setIsDrawerOpen(false);
      window.alert('보류가 해제되었습니다.');
    },
  });

  const payMutation = useMutation({
    mutationFn: async (settlementId: number) => {
      return apiRequest(`/settlements/${settlementId}/pay`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setIsPayModalOpen(false);
      setIsDrawerOpen(false);
      window.alert('지급이 완료되었습니다.');
    },
  });

  const viewCounts = {
    pending: settlements.filter(s => s.status === SETTLEMENT_STATUS.PENDING).length,
    confirmed: settlements.filter(s => s.status === SETTLEMENT_STATUS.CONFIRMED || s.status === SETTLEMENT_STATUS.PAYABLE).length,
    on_hold: settlements.filter(s => s.status === SETTLEMENT_STATUS.HOLD).length,
    paid: settlements.filter(s => s.status === SETTLEMENT_STATUS.PAID).length,
  };

  const filteredSettlements = settlements.filter((settlement) => {
    if (activeView !== 'all') {
      const statusMap: Record<string, string[]> = {
        pending: [SETTLEMENT_STATUS.PENDING],
        confirmed: [SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.PAYABLE],
        on_hold: [SETTLEMENT_STATUS.HOLD],
        paid: [SETTLEMENT_STATUS.PAID],
      };
      const allowedStatuses = statusMap[activeView] || [];
      if (!allowedStatuses.includes(settlement.status || '')) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return String(settlement.id).includes(q) ||
        (settlement.helperName?.toLowerCase() || '').includes(q) ||
        (settlement.orderTitle?.toLowerCase() || '').includes(q);
    }
    return true;
  });

  const totalPending = settlements
    .filter(s => [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.CONFIRMED, SETTLEMENT_STATUS.PAYABLE].includes(s.status as any))
    .reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const invalidCount = settlements.filter(s => !validateSettlement(s).isValid).length;

  const handleRowClick = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setDrawerTab('details');
    setIsDrawerOpen(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredSettlements.map((item) => ({
      '정산ID': item.id,
      '헬퍼ID': item.helperId || '',
      '헬퍼명': item.helperName || '',
      '헬퍼연락처': item.helperPhone || '',
      '오더ID': item.orderId || '',
      '오더명': item.orderTitle || '',
      '작업일': item.workDate ? new Date(item.workDate).toLocaleDateString('ko-KR') : '',
      '배송건수': item.deliveryCount || 0,
      '반품건수': item.returnCount || 0,
      '총액': item.totalAmount || 0,
      '수수료': item.commissionAmount || 0,
      '지급액': item.netAmount || 0,
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
    link.download = `정산목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderValidationBadge = (settlement: Settlement) => {
    const validation = validateSettlement(settlement);
    if (!validation.isValid) {
      return (
        <Badge variant="destructive" className="ml-2 text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          데이터 오류
        </Badge>
      );
    }
    if (validation.warnings.length > 0) {
      return (
        <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">
          <FileWarning className="h-3 w-3 mr-1" />
          경고
        </Badge>
      );
    }
    return null;
  };

  const canConfirm = (settlement: Settlement) => {
    const validation = validateSettlement(settlement);
    const actions = getSettlementActionState({
      id: settlement.id,
      status: settlement.status,
      totalAmount: settlement.totalAmount,
      netAmount: settlement.netAmount,
      finalTotal: settlement.finalTotal,
      driverPayout: settlement.driverPayout,
    });
    return validation.isValid && actions.canConfirm;
  };

  const canPay = (settlement: Settlement) => {
    const validation = validateSettlement(settlement);
    const actions = getSettlementActionState({
      id: settlement.id,
      status: settlement.status,
      totalAmount: settlement.totalAmount,
      netAmount: settlement.netAmount,
      finalTotal: settlement.finalTotal,
      driverPayout: settlement.driverPayout,
    });
    return validation.isValid && actions.canPay;
  };

  const columns: ColumnDef<Settlement>[] = [
    {
      key: 'id',
      header: '정산ID',
      width: 100,
      render: (value, row) => (
        <div className="flex items-center">
          <EntityLink type="settlement" id={value} />
          {renderValidationBadge(row)}
        </div>
      ),
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 120,
      render: (value, row) => row.helperId ? (
        <UserCell
          name={value || '정보없음'}
          id={row.helperId}
          role="helper"
          onClick={() => {
            setHelperDetailId(row.helperId);
            setIsHelperDetailOpen(true);
          }}
        />
      ) : (
        <span className="text-red-500">헬퍼 미지정</span>
      ),
    },
    {
      key: 'orderId',
      header: '오더',
      width: 90,
      render: (value) => value ? (
        <EntityLink type="order" id={value} />
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: 'workDate',
      header: '작업일',
      width: 100,
      render: (value) => value ? (
        new Date(value).toLocaleDateString('ko-KR')
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: 'deliveryCount',
      header: '배송/반품',
      width: 80,
      align: 'right',
      render: (value, row) => (
        <>
          <span>{value ?? '-'}</span>
          <span className="text-muted-foreground">/</span>
          <span>{row.returnCount ?? '-'}</span>
        </>
      ),
    },
    {
      key: 'totalAmount',
      header: '총액',
      width: 100,
      align: 'right',
      render: (value) => value !== null ? (
        <Money amount={value} size="sm" />
      ) : (
        <span className="text-red-500 font-medium">누락</span>
      ),
    },
    {
      key: 'commissionAmount',
      header: '수수료',
      width: 90,
      align: 'right',
      render: (value) => value !== null ? (
        <span className="text-muted-foreground"><Money amount={value} size="sm" /></span>
      ) : (
        <span>-</span>
      ),
    },
    {
      key: 'netAmount',
      header: '지급액',
      width: 100,
      align: 'right',
      render: (value) => value !== null ? (
        <span className="font-medium"><Money amount={value} size="sm" /></span>
      ) : (
        <span className="text-red-500 font-medium">누락</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => <StatusBadge status={value || 'UNKNOWN'} />,
    },
    {
      key: 'id',
      header: '액션',
      width: 130,
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {canConfirm(row) && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSettlement(row);
                setIsApproveModalOpen(true);
              }}
            >
              확정
            </Button>
          )}
          {canPay(row) && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSettlement(row);
                setIsPayModalOpen(true);
              }}
            >
              지급
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">정산 데이터를 불러올 수 없습니다</p>
                <p className="text-sm text-red-600">{(error as Error).message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                재시도
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">정산 관리</h1>
          <p className="text-muted-foreground">지급 전 확정/차감 반영/보류 처리</p>
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

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">산출됨</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{viewCounts.pending}</div>
            <p className="text-xs text-muted-foreground">확정 대기중</p>
          </CardContent>
        </Card>
        <Card className={cn(viewCounts.on_hold > 0 && 'border-amber-500')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">보류</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{viewCounts.on_hold}</div>
            <p className="text-xs text-muted-foreground">검토 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">확정</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{viewCounts.confirmed}</div>
            <p className="text-xs text-muted-foreground">지급 대기중</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 미지급액</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Money amount={totalPending} size="lg" />
            </div>
            <p className="text-xs text-muted-foreground">지급 예정 총액</p>
          </CardContent>
        </Card>
        <Card className={cn(invalidCount > 0 && 'border-red-500 bg-red-50')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">데이터 오류</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", invalidCount > 0 && "text-red-600")}>
              {invalidCount}
            </div>
            <p className="text-xs text-muted-foreground">확인 필요</p>
          </CardContent>
        </Card>
      </div>

      <SavedViews
        views={savedViews.map(v => ({
          ...v,
          count: viewCounts[v.id as keyof typeof viewCounts],
        }))}
        activeView={activeView}
        onSelect={setActiveView}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-lg">
                정산 목록
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-sm font-normal text-primary">
                    ({selectedIds.size}건 선택)
                  </span>
                )}
              </CardTitle>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (confirm(`${selectedIds.size}건을 일괄 송금 처리하시겠습니까?`)) {
                        alert('일괄 송금 API 연동 필요');
                      }
                    }}
                  >
                    <Banknote className="h-4 w-4 mr-1" />
                    일괄 송금
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    선택 해제
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Input
                placeholder="정산ID, 헬퍼명, 오더명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Filter className="h-4 w-4 mr-2" />
                필터
                <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", filterOpen && "rotate-180")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ExcelTable
            data={filteredSettlements}
            columns={columns}
            loading={isLoading}
            emptyMessage="정산 데이터가 없습니다."
            getRowId={(row) => row.id}
            storageKey="settlements-page"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      <DrawerDetail
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`정산 STL-${selectedSettlement?.id}`}
        subtitle={selectedSettlement?.helperName || '헬퍼 정보 없음'}
        tabs={[
          {
            id: 'details',
            label: '정산 상세',
            content: selectedSettlement ? (
              <div className="space-y-6">
                {!validateSettlement(selectedSettlement).isValid && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                      <AlertCircle className="h-4 w-4" />
                      데이터 검증 오류
                    </div>
                    <ul className="text-sm text-red-700 list-disc list-inside">
                      {validateSettlement(selectedSettlement).errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">헬퍼</p>
                    <p className="font-medium">{selectedSettlement.helperName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">연락처</p>
                    <p className="font-medium">{selectedSettlement.helperPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">오더</p>
                    <p className="font-medium">
                      {selectedSettlement.orderId ? `ORD-${selectedSettlement.orderId}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">작업일</p>
                    <p className="font-medium">
                      {selectedSettlement.workDate 
                        ? new Date(selectedSettlement.workDate).toLocaleDateString('ko-KR')
                        : '-'
                      }
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">정산 금액</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">총액</p>
                      <p className="font-medium">{formatAmount(selectedSettlement.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">수수료</p>
                      <p className="font-medium">{formatAmount(selectedSettlement.commissionAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">지급액</p>
                      <p className="font-medium text-emerald-600">{formatAmount(selectedSettlement.netAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">상태</p>
                      <StatusBadge status={selectedSettlement.status || 'UNKNOWN'} />
                    </div>
                  </div>
                </div>
              </div>
            ) : null,
          },
          {
            id: 'breakdown',
            label: '항목별 내역',
            content: selectedSettlement ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">기본공급가</p>
                    <p className="font-medium">{formatAmount(selectedSettlement.baseSupply)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">긴급비</p>
                    <p className="font-medium">{formatAmount(selectedSettlement.urgentFeeSupply)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">추가비</p>
                    <p className="font-medium">{formatAmount(selectedSettlement.extraSupply)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">최종공급가</p>
                    <p className="font-medium">{formatAmount(selectedSettlement.finalSupply)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">부가세</p>
                    <p className="font-medium">{formatAmount(selectedSettlement.vat)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">최종총액</p>
                    <p className="font-medium">{formatAmount(selectedSettlement.finalTotal)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">플랫폼수수료율</p>
                    <p className="font-medium">{selectedSettlement.platformFeeRate ? `${selectedSettlement.platformFeeRate}%` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">플랫폼수수료</p>
                    <p className="font-medium">{formatAmount(selectedSettlement.platformFee)}</p>
                  </div>
                  <div className="col-span-2 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">기사지급액</p>
                    <p className="text-xl font-bold text-emerald-600">{formatAmount(selectedSettlement.driverPayout)}</p>
                  </div>
                </div>
              </div>
            ) : null,
          },
          {
            id: 'audit',
            label: '감사로그',
            content: <AuditTrail events={[]} />,
          },
        ]}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        footer={
          selectedSettlement && (
            <div className="flex gap-2">
              {selectedSettlement.status === SETTLEMENT_STATUS.PENDING && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsHoldModalOpen(true)}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    보류
                  </Button>
                  {canConfirm(selectedSettlement) && (
                    <Button
                      className="flex-1"
                      onClick={() => setIsApproveModalOpen(true)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      확정
                    </Button>
                  )}
                </>
              )}
              {selectedSettlement.status === SETTLEMENT_STATUS.HOLD && (
                <Button
                  className="flex-1"
                  onClick={() => releaseMutation.mutate(selectedSettlement.id)}
                  disabled={releaseMutation.isPending}
                >
                  보류 해제
                </Button>
              )}
              {canPay(selectedSettlement) && (
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setIsPayModalOpen(true)}
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  지급
                </Button>
              )}
            </div>
          )
        }
      />

      <ConfirmModal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        onConfirm={() => {
          if (selectedSettlement) {
            approveMutation.mutate(selectedSettlement.id);
          }
        }}
        title="정산 확정"
        description={`정산 STL-${selectedSettlement?.id}을 확정하시겠습니까? 확정 후에는 지급 처리가 가능합니다.`}
        confirmText="확정"
        isLoading={approveMutation.isPending}
      />

      <ReasonModal
        isOpen={isHoldModalOpen}
        onClose={() => setIsHoldModalOpen(false)}
        onSubmit={(reason) => {
          if (selectedSettlement) {
            holdMutation.mutate({ settlementId: selectedSettlement.id, reason });
          }
        }}
        title="정산 보류"
        description="보류 사유를 입력해 주세요."
        submitText="보류"
        variant="default"
        templates={[
          { id: '1', label: '금액 확인 필요', text: '정산 금액 확인이 필요합니다.' },
          { id: '2', label: '분쟁 진행중', text: '분쟁이 진행중이어서 정산을 보류합니다.' },
          { id: '3', label: '추가 서류 필요', text: '추가 서류 확인 후 처리 예정입니다.' },
        ]}
        isLoading={holdMutation.isPending}
      />

      <ConfirmModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        onConfirm={() => {
          if (selectedSettlement) {
            payMutation.mutate(selectedSettlement.id);
          }
        }}
        title="지급 처리"
        description={`정산 STL-${selectedSettlement?.id}의 지급액 ${formatAmount(selectedSettlement?.netAmount)}을 지급하시겠습니까?`}
        confirmText="지급"
        variant="default"
        isLoading={payMutation.isPending}
      />

      <HelperDetailModal
        helperId={helperDetailId}
        isOpen={isHelperDetailOpen}
        onClose={() => setIsHelperDetailOpen(false)}
      />
    </div>
  );
}
