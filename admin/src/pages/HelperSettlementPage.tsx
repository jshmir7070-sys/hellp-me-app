/**
 * Helper Settlement Page - 재설계 버전
 * 헬퍼 정산 - 월별 헬퍼 정산 요약 및 세금계산서 발행
 *
 * 개선사항:
 * - PageHeader 적용
 * - StatsGrid로 통계 표시
 * - DataTable로 고정 헤더 적용
 * - 월 선택 UI 개선
 * - FilterBar 적용
 * - EmptyState 사용
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { adminFetch, apiRequest } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Eye,
  Users,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  Loader2,
  Wallet,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelperSettlement {
  helperId: number;
  helperName: string;
  helperPhone: string;
  orderCount: number;
  supplyPrice: number;
  vat: number;
  totalAmount: number;
  platformFee: number;
  deductedAmount: number;
  deductions: number;
  cargoIncident: number;
  driverPayout: number;
}

interface HelperOrderDetail {
  orderId: number;
  date: string;
  category: string;
  courierCompany: string;
  deliveredCount: number;
  returnedCount: number;
  pricePerBox: number;
  etcCount: number;
  etcPricePerUnit: number;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  deduction: number;
  payout: number;
  deductionDetails: string[];
  memo: string;
}

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export default function HelperSettlementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHelper, setSelectedHelper] = useState<HelperSettlement | null>(null);
  const [isTaxInvoiceModalOpen, setIsTaxInvoiceModalOpen] = useState(false);
  const [taxInvoiceTarget, setTaxInvoiceTarget] = useState<HelperSettlement | null>(null);

  const dateRange = getMonthRange(selectedYear, selectedMonth);

  // API Queries
  const { data: settlements = [], isLoading } = useQuery<HelperSettlement[]>({
    queryKey: ['/api/admin/settlements/helper', dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/helper?startDate=${dateRange.from}&endDate=${dateRange.to}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: taxInvoices = [] } = useQuery<{ targetId: string; targetType: string; year: number; month: number; status: string }[]>({
    queryKey: ['/api/admin/tax-invoices', 'helper', selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/tax-invoices?targetType=helper&year=${selectedYear}&month=${selectedMonth + 1}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: helperOrders = [] } = useQuery<HelperOrderDetail[]>({
    queryKey: ['/api/admin/settlements/helper-orders', selectedHelper?.helperId, dateRange.from, dateRange.to],
    enabled: !!selectedHelper,
    queryFn: async () => {
      if (!selectedHelper) return [];
      const res = await adminFetch(
        `/api/admin/settlements/helper-orders?helperId=${selectedHelper.helperId}&startDate=${dateRange.from}&endDate=${dateRange.to}`
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Mutations
  const issueTaxInvoiceMutation = useMutation({
    mutationFn: async (helperId: number) => {
      return apiRequest('/tax-invoices', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'helper',
          targetId: String(helperId),
          year: selectedYear,
          month: selectedMonth + 1,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tax-invoices', 'helper', selectedYear, selectedMonth] });
      setIsTaxInvoiceModalOpen(false);
      setTaxInvoiceTarget(null);
      toast({ title: '세금계산서가 발행되었습니다.' });
    },
    onError: (error: Error) => {
      toast({
        title: '세금계산서 발행 실패',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Computed values
  const issuedHelperIds = useMemo(() => {
    return new Set(taxInvoices.map(inv => String(inv.targetId)));
  }, [taxInvoices]);

  const filteredSettlements = useMemo(() => {
    if (!searchTerm) return settlements;
    const q = searchTerm.toLowerCase();
    return settlements.filter(s =>
      s.helperName.toLowerCase().includes(q) ||
      s.helperPhone.toLowerCase().includes(q)
    );
  }, [settlements, searchTerm]);

  const stats = useMemo(() => {
    return {
      totalHelpers: settlements.length,
      totalOrders: settlements.reduce((sum, s) => sum + s.orderCount, 0),
      totalPayout: settlements.reduce((sum, s) => sum + s.driverPayout, 0),
      issuedInvoices: issuedHelperIds.size,
    };
  }, [settlements, issuedHelperIds]);

  // Handlers
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  const handleDownloadExcel = () => {
    const data = filteredSettlements.map(item => ({
      '헬퍼명': item.helperName,
      '연락처': item.helperPhone,
      '오더수': item.orderCount,
      '공급가액': item.supplyPrice,
      '세액': item.vat,
      '합계': item.totalAmount,
      '차감': item.deductions,
      '화물사고': item.cargoIncident,
      '지급액': item.driverPayout,
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
    link.download = `헬퍼정산_${selectedYear}_${selectedMonth + 1}월.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // Table columns
  const columns: ColumnDef<HelperSettlement>[] = [
    {
      accessorKey: 'helperName',
      header: ({ column }) => <SortableHeader column={column}>헬퍼</SortableHeader>,
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
      accessorKey: 'orderCount',
      header: ({ column }) => (
        <div className="text-center">
          <SortableHeader column={column}>오더수</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="secondary">{row.original.orderCount}건</Badge>
        </div>
      ),
    },
    {
      accessorKey: 'supplyPrice',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>공급가액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">{formatAmount(row.original.supplyPrice)}</div>
      ),
    },
    {
      accessorKey: 'vat',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>세액</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">{formatAmount(row.original.vat)}</div>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>합계</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">{formatAmount(row.original.totalAmount)}</div>
      ),
    },
    {
      accessorKey: 'deductions',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>차감</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-red-600">
          {row.original.deductions > 0 ? `-${formatAmount(row.original.deductions)}` : '-'}
        </div>
      ),
    },
    {
      accessorKey: 'cargoIncident',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>화물사고</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-red-600">
          {row.original.cargoIncident > 0 ? `-${formatAmount(row.original.cargoIncident)}` : '-'}
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
        <div className="text-right font-bold text-blue-600">{formatAmount(row.original.driverPayout)}</div>
      ),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHelper(row.original);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {issuedHelperIds.has(String(row.original.helperId)) ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              발행완료
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setTaxInvoiceTarget(row.original);
                setIsTaxInvoiceModalOpen(true);
              }}
            >
              <FileText className="h-4 w-4 mr-1" />
              미발행
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="헬퍼 정산"
        description="헬퍼별 월별 누적 정산 현황 및 세금계산서 발행"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredSettlements.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </>
        }
      />

      {/* Month Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-xl font-bold">
                  {selectedYear}년 {monthNames[selectedMonth]}
                </span>
              </div>
              {(selectedYear !== today.getFullYear() || selectedMonth !== today.getMonth()) && (
                <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
                  이번 달
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <StatsGrid>
        <StatsCard
          title="헬퍼 수"
          value={stats.totalHelpers}
          description={`${stats.totalHelpers}명 활동`}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          variant="primary"
        />
        <StatsCard
          title="총 오더"
          value={stats.totalOrders}
          description="완료된 오더"
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatsCard
          title="총 지급액"
          value={formatAmount(stats.totalPayout)}
          description="이번 달 누적"
          icon={<Wallet className="h-5 w-5 text-emerald-500" />}
          variant="default"
        />
        <StatsCard
          title="세금계산서"
          value={`${stats.issuedInvoices}/${stats.totalHelpers}`}
          description="발행 현황"
          icon={<FileText className="h-5 w-5 text-purple-500" />}
          variant={stats.issuedInvoices === stats.totalHelpers && stats.totalHelpers > 0 ? "success" : "warning"}
        />
      </StatsGrid>

      {/* Filter Bar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="헬퍼명, 연락처 검색..."
        showRefresh={false}
        showExport={false}
      />

      {/* Data Table */}
      {filteredSettlements.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 text-gray-400" />}
          title="정산 내역이 없습니다"
          description="선택한 월에 정산 내역이 없습니다."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredSettlements}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 600px)"
          loading={isLoading}
        />
      )}

      {/* Tax Invoice Modal */}
      <Dialog open={isTaxInvoiceModalOpen} onOpenChange={setIsTaxInvoiceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>세금계산서 발행</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              <strong>{taxInvoiceTarget?.helperName}</strong> 헬퍼에게<br />
              <strong>{selectedYear}년 {monthNames[selectedMonth]}</strong> 세금계산서를 발행하시겠습니까?
            </p>
            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">공급가액</span>
                  <span className="font-medium">{formatAmount(taxInvoiceTarget?.supplyPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">세액</span>
                  <span className="font-medium">{formatAmount(taxInvoiceTarget?.vat)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>합계</span>
                  <span>{formatAmount(taxInvoiceTarget?.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                세금계산서 발행 후 국세청에 신고됩니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaxInvoiceModalOpen(false)}>취소</Button>
            <Button
              onClick={() => taxInvoiceTarget && issueTaxInvoiceMutation.mutate(taxInvoiceTarget.helperId)}
              disabled={issueTaxInvoiceMutation.isPending}
            >
              {issueTaxInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  발행 중...
                </>
              ) : (
                '발행'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Helper Detail Modal */}
      {selectedHelper && (
        <Dialog open={!!selectedHelper} onOpenChange={() => setSelectedHelper(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedHelper.helperName} 정산 상세 ({selectedYear}년 {monthNames[selectedMonth]})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {helperOrders.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-8 w-8 text-gray-400" />}
                  title="정산 상세 내역이 없습니다"
                  description="이 헬퍼의 정산 내역을 불러올 수 없습니다."
                />
              ) : (
                <div className="space-y-3">
                  {helperOrders.map((order, idx) => (
                    <Card key={idx}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">오더ID:</span> {order.orderId}
                          </div>
                          <div>
                            <span className="text-muted-foreground">날짜:</span> {order.date}
                          </div>
                          <div>
                            <span className="text-muted-foreground">택배사:</span> {order.courierCompany}
                          </div>
                          <div>
                            <span className="text-muted-foreground">배송:</span> {order.deliveredCount}개 / 반품: {order.returnedCount}개
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">지급액:</span>{' '}
                            <span className="font-bold text-blue-600">{formatAmount(order.payout)}</span>
                          </div>
                          {order.deduction > 0 && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">차감:</span>{' '}
                              <span className="text-red-600">-{formatAmount(order.deduction)}</span>
                              {order.deductionDetails.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {order.deductionDetails.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                          {order.memo && (
                            <div className="col-span-2 text-xs bg-muted p-2 rounded">
                              {order.memo}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
