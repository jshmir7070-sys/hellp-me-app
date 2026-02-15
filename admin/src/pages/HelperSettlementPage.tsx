import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch, apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, Download, ChevronLeft, ChevronRight, Calendar, FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { useToast } from '@/hooks/use-toast';

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

interface HelperOrdersSummary {
  totalSupply: number;
  totalVat: number;
  totalAmount: number;
  totalDeduction: number;
  totalPayout: number;
}

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return amount.toLocaleString('ko-KR') + '원';
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
  const [selectedHelper, setSelectedHelper] = useState<HelperSettlement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isTaxInvoiceModalOpen, setIsTaxInvoiceModalOpen] = useState(false);
  const [taxInvoiceTarget, setTaxInvoiceTarget] = useState<HelperSettlement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dateRange = getMonthRange(selectedYear, selectedMonth);

  const { data: settlements = [], isLoading } = useQuery({
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

  const issuedHelperIds = new Set(taxInvoices.map(t => String(t.targetId)));

  const { data: helperOrdersData, isLoading: isLoadingOrders } = useQuery<{ orders: HelperOrderDetail[], summary: HelperOrdersSummary }>({
    queryKey: ['/api/admin/settlements/helper/orders', selectedHelper?.helperId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!selectedHelper) return { orders: [], summary: { totalSupply: 0, totalVat: 0, totalAmount: 0, totalDeduction: 0, totalPayout: 0 } };
      const res = await adminFetch(`/api/admin/settlements/helper/${selectedHelper.helperId}/orders?startDate=${dateRange.from}&endDate=${dateRange.to}`);
      if (!res.ok) return { orders: [], summary: { totalSupply: 0, totalVat: 0, totalAmount: 0, totalDeduction: 0, totalPayout: 0 } };
      return res.json();
    },
    enabled: !!selectedHelper,
  });
  const helperOrders = helperOrdersData?.orders || [];
  const helperSummary = helperOrdersData?.summary || { totalSupply: 0, totalVat: 0, totalAmount: 0, totalDeduction: 0, totalPayout: 0 };

  const issueTaxInvoiceMutation = useMutation({
    mutationFn: async (data: { helperId: string | number; year: number; month: number }) => {
      return apiRequest('/tax-invoices/generate-monthly', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'helper',
          targetId: data.helperId,
          year: data.year,
          month: data.month + 1,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: '세금계산서가 발행되었습니다.' });
      setIsTaxInvoiceModalOpen(false);
      setTaxInvoiceTarget(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tax-invoices'] });
    },
    onError: (error: any) => {
      toast({
        title: '세금계산서 발행 실패',
        description: error.message || '오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const issueBulkTaxInvoiceMutation = useMutation({
    mutationFn: async (data: { helperIds: (string | number)[]; year: number; month: number }) => {
      return apiRequest('/tax-invoices/monthly', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'helper',
          targetIds: data.helperIds,
          year: data.year,
          month: data.month + 1,
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({ title: `${data.successCount || selectedIds.size}건의 세금계산서가 발행되었습니다.` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tax-invoices'] });
    },
    onError: (error: any) => {
      toast({
        title: '일괄 세금계산서 발행 실패',
        description: error.message || '오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const filteredSettlements = settlements.filter((s: HelperSettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.helperName?.toLowerCase().includes(search) ||
      s.helperPhone?.includes(search)
    );
  });

  const totals = filteredSettlements.reduce(
    (acc: any, s: HelperSettlement) => ({
      supplyPrice: acc.supplyPrice + (s.supplyPrice || 0),
      vat: acc.vat + (s.vat || 0),
      totalAmount: acc.totalAmount + (s.totalAmount || 0),
      platformFee: acc.platformFee + (s.platformFee || 0),
      deductedAmount: acc.deductedAmount + (s.deductedAmount || 0),
      deductions: acc.deductions + (s.deductions || 0),
      cargoIncident: acc.cargoIncident + (s.cargoIncident || 0),
      driverPayout: acc.driverPayout + (s.driverPayout || 0),
    }),
    { supplyPrice: 0, vat: 0, totalAmount: 0, platformFee: 0, deductedAmount: 0, deductions: 0, cargoIncident: 0, driverPayout: 0 }
  );

  const goToPrevMonth = () => {
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

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  const columns: ColumnDef<HelperSettlement>[] = [
    {
      key: 'helperName',
      header: '헬퍼',
      width: 140,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || '-'}</div>
          {row.helperPhone && (
            <div className="text-xs text-muted-foreground">{row.helperPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'orderCount',
      header: '오더수',
      width: 80,
      align: 'center',
      render: (value) => <Badge variant="secondary">{value}건</Badge>,
    },
    {
      key: 'supplyPrice',
      header: '공급가액',
      width: 120,
      align: 'right',
      render: (value) => formatAmount(value),
    },
    {
      key: 'vat',
      header: '세액',
      width: 100,
      align: 'right',
      render: (value) => <span className="text-muted-foreground">{formatAmount(value)}</span>,
    },
    {
      key: 'totalAmount',
      header: '합계',
      width: 120,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'deductions',
      header: '차감',
      width: 100,
      align: 'right',
      render: (value) => (
        <span className="text-red-600">
          {value > 0 ? `-${formatAmount(value)}` : '-'}
        </span>
      ),
    },
    {
      key: 'cargoIncident',
      header: '화물사고',
      width: 100,
      align: 'right',
      render: (value) => (
        <span className="text-red-600">
          {value > 0 ? `-${formatAmount(value)}` : '-'}
        </span>
      ),
    },
    {
      key: 'driverPayout',
      header: '지급액',
      width: 130,
      align: 'right',
      render: (value) => <span className="font-bold text-blue-600">{formatAmount(value)}</span>,
    },
    {
      key: 'helperId',
      header: '액션',
      width: 140,
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHelper(row);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {issuedHelperIds.has(String(row.helperId)) ? (
            <Badge variant="secondary" className="text-xs">
              발행완료
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setTaxInvoiceTarget(row);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">헬퍼정산</h1>
          <p className="text-sm text-muted-foreground mt-1">헬퍼별 월별 누적 정산 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="헬퍼명, 연락처 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" size="sm" onClick={() => {
            const data = filteredSettlements.map((s: HelperSettlement) => ({
              '헬퍼명': s.helperName || '',
              '연락처': s.helperPhone || '',
              '오더수': s.orderCount,
              '공급가액': s.supplyPrice || 0,
              '세액': s.vat || 0,
              '합계': s.totalAmount || 0,
              '플랫폼수수료': s.platformFee || 0,
              '차감액': s.deductions || 0,
              '화물사고': s.cargoIncident || 0,
              '지급액': s.driverPayout || 0,
            }));
            if (data.length === 0) return;
            const headers = Object.keys(data[0]);
            const csvContent = [
              headers.join(','),
              ...data.map((row: Record<string, unknown>) => headers.map(h => row[h]).join(','))
            ].join('\n');
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `헬퍼정산_${selectedYear}년${selectedMonth + 1}월.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="h-4 w-4 mr-2" />
            엑셀 다운로드
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="px-4 py-1 bg-background border rounded font-medium min-w-[120px] text-center">
          {selectedYear}년 {monthNames[selectedMonth]}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="ml-2" onClick={goToCurrentMonth}>
          이번 달
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">헬퍼 수</div>
            <div className="text-2xl font-bold">{filteredSettlements.length}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">합계 (부가세 포함)</div>
            <div className="text-xl font-bold">{formatAmount(totals.totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">헬퍼 지급액 합계</div>
            <div className="text-2xl font-bold text-blue-600">{formatAmount(totals.driverPayout)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            헬퍼별 정산 현황
            <Badge variant="secondary" className="ml-2">{filteredSettlements.length}명</Badge>
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (confirm(`${selectedIds.size}건을 일괄 송금 처리하시겠습니까?`)) {
                    alert('일괄 송금 API 연동 필요');
                  }
                }}
              >
                일괄 송금
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (confirm(`${selectedIds.size}건의 월별 합산 세금계산서를 발행하시겠습니까?`)) {
                    issueBulkTaxInvoiceMutation.mutate({
                      helperIds: Array.from(selectedIds),
                      year: selectedYear,
                      month: selectedMonth,
                    });
                  }
                }}
                disabled={issueBulkTaxInvoiceMutation.isPending}
              >
                {issueBulkTaxInvoiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                일괄 세금계산서
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
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={filteredSettlements}
            columns={columns}
            loading={isLoading}
            emptyMessage={`${selectedYear}년 ${monthNames[selectedMonth]} 정산 데이터가 없습니다`}
            getRowId={(row) => row.helperId}
            storageKey="helper-settlement"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      <Dialog open={isTaxInvoiceModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsTaxInvoiceModalOpen(false);
          setTaxInvoiceTarget(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>세금계산서 발행</DialogTitle>
          </DialogHeader>
          {taxInvoiceTarget && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">헬퍼</span>
                  <span className="font-medium">{taxInvoiceTarget.helperName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">정산 기간</span>
                  <span className="font-medium">{selectedYear}년 {monthNames[selectedMonth]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">공급가액</span>
                  <span className="font-medium">{formatAmount(taxInvoiceTarget.supplyPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">세액</span>
                  <span className="font-medium">{formatAmount(taxInvoiceTarget.vat)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">합계</span>
                  <span className="font-bold text-blue-600">{formatAmount(taxInvoiceTarget.totalAmount)}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                위 금액으로 월별 합산 세금계산서를 발행합니다. 발행 후 팝빌을 통해 국세청에 전송됩니다.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaxInvoiceModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (taxInvoiceTarget) {
                  issueTaxInvoiceMutation.mutate({
                    helperId: taxInvoiceTarget.helperId,
                    year: selectedYear,
                    month: selectedMonth,
                  });
                }
              }}
              disabled={issueTaxInvoiceMutation.isPending}
            >
              {issueTaxInvoiceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              세금계산서 발행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedHelper} onOpenChange={() => setSelectedHelper(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>거래명세서 - {selectedHelper?.helperName} ({selectedYear}년 {monthNames[selectedMonth]})</DialogTitle>
          </DialogHeader>
          {selectedHelper && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">헬퍼명</div>
                  <div className="font-medium">{selectedHelper.helperName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">연락처</div>
                  <div className="font-medium">{selectedHelper.helperPhone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">총 오더수</div>
                  <div className="font-medium">{selectedHelper.orderCount}건</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">정산 기간</div>
                  <div className="font-medium">{selectedYear}년 {monthNames[selectedMonth]}</div>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs">날짜</th>
                      <th className="px-2 py-2 text-left text-xs">카테고리</th>
                      <th className="px-2 py-2 text-left text-xs">운송사</th>
                      <th className="px-2 py-2 text-center text-xs">배송</th>
                      <th className="px-2 py-2 text-center text-xs">반품</th>
                      <th className="px-2 py-2 text-right text-xs">단가</th>
                      <th className="px-2 py-2 text-center text-xs">기타</th>
                      <th className="px-2 py-2 text-right text-xs">기타단가</th>
                      <th className="px-2 py-2 text-right text-xs">공급가액</th>
                      <th className="px-2 py-2 text-right text-xs">부가세</th>
                      <th className="px-2 py-2 text-right text-xs">합계</th>
                      <th className="px-2 py-2 text-right text-xs">차감액</th>
                      <th className="px-2 py-2 text-right text-xs">지급액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingOrders ? (
                      <tr>
                        <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : helperOrders.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                          해당 기간에 정산 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      helperOrders.map((order) => (
                        <tr key={order.orderId} className="border-t hover:bg-muted/50">
                          <td className="px-2 py-2 text-xs">{new Date(order.date).toLocaleDateString('ko-KR')}</td>
                          <td className="px-2 py-2 text-xs">
                            <Badge variant={order.category === '냉탑전용' ? 'default' : order.category === '기타택배' ? 'secondary' : 'outline'} className="text-xs">
                              {order.category}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-xs">{order.courierCompany}</td>
                          <td className="px-2 py-2 text-center text-xs">{order.deliveredCount}</td>
                          <td className="px-2 py-2 text-center text-xs">{order.returnedCount}</td>
                          <td className="px-2 py-2 text-right text-xs">{order.pricePerBox.toLocaleString()}</td>
                          <td className="px-2 py-2 text-center text-xs">{order.etcCount || '-'}</td>
                          <td className="px-2 py-2 text-right text-xs">{order.etcPricePerUnit ? order.etcPricePerUnit.toLocaleString() : '-'}</td>
                          <td className="px-2 py-2 text-right text-xs">{order.supplyAmount.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-xs text-muted-foreground">{order.vatAmount.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-xs font-medium">{order.totalAmount.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-xs text-red-600">{order.deduction > 0 ? `-${order.deduction.toLocaleString()}` : '-'}</td>
                          <td className="px-2 py-2 text-right text-xs font-medium text-blue-600">{order.payout.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {helperOrders.length > 0 && (
                    <tfoot className="bg-muted font-medium">
                      <tr>
                        <td colSpan={8} className="px-2 py-2 text-sm">합계</td>
                        <td className="px-2 py-2 text-right text-sm">{helperSummary.totalSupply.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right text-sm text-muted-foreground">{helperSummary.totalVat.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right text-sm font-bold">{helperSummary.totalAmount.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right text-sm text-red-600">{helperSummary.totalDeduction > 0 ? `-${helperSummary.totalDeduction.toLocaleString()}` : '-'}</td>
                        <td className="px-2 py-2 text-right text-sm font-bold text-blue-600">{helperSummary.totalPayout.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {helperOrders.some(o => o.deductionDetails.length > 0) && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-sm font-medium mb-2">비고 (차감 내역 상세)</div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {helperOrders.filter(o => o.deductionDetails.length > 0).map((order) => (
                      <div key={order.orderId}>
                        <span className="font-medium">#{order.orderId}</span>: {order.deductionDetails.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between text-xl font-bold text-blue-600">
                  <span>최종 지급액</span>
                  <span>{formatAmount(helperSummary.totalPayout)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
