/**
 * Requester Settlement Page - 재설계 버전
 * 요청자 정산 관리
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - 월 네비게이션 유지
 * - Dialog 모달 3개 유지
 * - 선택 및 일괄 처리 기능 유지
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from '@tanstack/react-table';
import { adminFetch, apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Users,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface RequesterSettlement {
  requesterId: string;
  requesterName: string;
  requesterPhone: string;
  businessName: string;
  orderCount: number;
  billedAmount: number;
  unpaidAmount: number;
  paymentDate: string | null;
}

const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

interface RequesterOrder {
  orderId: number;
  orderDate: string;
  courierCompany: string;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  pricePerBox: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  depositPaid: boolean;
  status: string;
  paymentStatus: string;
}

interface OrdersSummary {
  totalAmount: number;
  totalDeposit: number;
  totalBalance: number;
}

export default function RequesterSettlementPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequester, setSelectedRequester] = useState<RequesterSettlement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isTaxInvoiceModalOpen, setIsTaxInvoiceModalOpen] = useState(false);
  const [taxInvoiceTarget, setTaxInvoiceTarget] = useState<RequesterSettlement | null>(null);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [ordersModalRequester, setOrdersModalRequester] = useState<RequesterSettlement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;

  const { data: settlements = [], isLoading } = useQuery<RequesterSettlement[]>({
    queryKey: ["/api/admin/settlements/requester", startDate, endDate],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/requester?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: taxInvoices = [] } = useQuery<{ targetId: string; targetType: string; year: number; month: number; status: string }[]>({
    queryKey: ['/api/admin/tax-invoices', 'requester', selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/tax-invoices?targetType=requester&year=${selectedYear}&month=${selectedMonth + 1}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: ordersData } = useQuery<{ orders: RequesterOrder[], summary: OrdersSummary }>({
    queryKey: ['/api/admin/settlements/requester/orders', ordersModalRequester?.requesterId, startDate, endDate],
    queryFn: async () => {
      if (!ordersModalRequester) return { orders: [], summary: { totalAmount: 0, totalDeposit: 0, totalBalance: 0 } };
      const res = await adminFetch(`/api/admin/settlements/requester/${ordersModalRequester.requesterId}/orders?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) return { orders: [], summary: { totalAmount: 0, totalDeposit: 0, totalBalance: 0 } };
      return res.json();
    },
    enabled: !!ordersModalRequester,
  });
  const requesterOrders = ordersData?.orders || [];
  const ordersSummary = ordersData?.summary || { totalAmount: 0, totalDeposit: 0, totalBalance: 0 };

  const issuedRequesterIds = new Set(taxInvoices.map(t => String(t.targetId)));

  const handleOpenOrdersModal = (requester: RequesterSettlement) => {
    setOrdersModalRequester(requester);
    setIsOrdersModalOpen(true);
  };

  const issueTaxInvoiceMutation = useMutation({
    mutationFn: async (data: { requesterId: string; year: number; month: number }) => {
      return apiRequest('/tax-invoices/generate-monthly', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'requester',
          targetId: data.requesterId,
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
    mutationFn: async (data: { requesterIds: string[]; year: number; month: number }) => {
      return apiRequest('/tax-invoices/monthly', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'requester',
          targetIds: data.requesterIds,
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

  const filteredSettlements = useMemo(() => {
    if (!searchTerm) return settlements;
    const lower = searchTerm.toLowerCase();
    return settlements.filter((s: RequesterSettlement) =>
      (s.requesterName || '').toLowerCase().includes(lower) ||
      (s.requesterPhone || '').includes(searchTerm) ||
      (s.businessName || '').toLowerCase().includes(lower)
    );
  }, [settlements, searchTerm]);

  // 통계 계산
  const stats = useMemo(() => {
    const count = filteredSettlements.length;
    const billedAmount = filteredSettlements.reduce((acc, s) => acc + (s.billedAmount || 0), 0);
    const unpaidAmount = filteredSettlements.reduce((acc, s) => acc + (s.unpaidAmount || 0), 0);

    return { count, billedAmount, unpaidAmount };
  }, [filteredSettlements]);

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
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/requester"] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const columns: ColumnDef<RequesterSettlement>[] = [
    {
      accessorKey: 'requesterName',
      header: '요청자',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.requesterName || '-'}</div>
          {row.original.requesterPhone && (
            <div className="text-xs text-muted-foreground">{row.original.requesterPhone}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'businessName',
      header: '상호',
      cell: ({ row }) => <span className="text-sm">{row.original.businessName || '-'}</span>,
    },
    {
      accessorKey: 'orderCount',
      header: '오더수',
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={() => handleOpenOrdersModal(row.original)}
        >
          {row.original.orderCount}건
        </Badge>
      ),
    },
    {
      accessorKey: 'billedAmount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>청구</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <span className="font-medium">{formatAmount(row.original.billedAmount)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'unpaidAmount',
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader column={column}>미정산</SortableHeader>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <span className="text-red-600 font-medium">
            {row.original.unpaidAmount > 0 ? formatAmount(row.original.unpaidAmount) : '-'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'paymentDate',
      header: '결제일',
      cell: ({ row }) => <span className="text-sm">{row.original.paymentDate || '-'}</span>,
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRequester(row.original);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {issuedRequesterIds.has(String(row.original.requesterId)) ? (
            <Badge variant="secondary" className="text-xs">
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

  // 로딩 중
  if (isLoading && settlements.length === 0) {
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
        title="요청자 정산"
        description="요청자별 청구 및 결제 현황 관리 • 월별 세금계산서 발행"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </>
        }
      />

      {/* 월 네비게이션 */}
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
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="요청자명, 연락처, 상호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
      </div>

      {/* 통계 카드 */}
      <StatsGrid columns={3}>
        <StatsCard
          title="요청자 수"
          value={`${stats.count}명`}
          description="이번 달 정산 대상"
          icon={<Users className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="청구 합계"
          value={formatAmount(stats.billedAmount)}
          description="총 청구 금액"
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          variant="default"
        />
        <StatsCard
          title="미정산 합계"
          value={formatAmount(stats.unpaidAmount)}
          description="미수금"
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          variant={stats.unpaidAmount > 0 ? "warning" : "default"}
        />
      </StatsGrid>

      {/* 데이터 테이블 */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              요청자별 정산 현황
              <Badge variant="secondary" className="ml-2">{filteredSettlements.length}명</Badge>
              {selectedIds.size > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({selectedIds.size}개 선택)
                </span>
              )}
            </h3>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (confirm(`${selectedIds.size}건의 월별 합산 세금계산서를 발행하시겠습니까?`)) {
                      issueBulkTaxInvoiceMutation.mutate({
                        requesterIds: Array.from(selectedIds).map(String),
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
          </div>
        </div>
        <div className="p-0">
          {filteredSettlements.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12 text-muted-foreground" />}
              title="정산 데이터가 없습니다"
              description={`${selectedYear}년 ${monthNames[selectedMonth]} 정산 데이터가 없습니다.`}
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredSettlements}
              pageSize={20}
              fixedHeader={true}
              maxHeight="calc(100vh - 600px)"
              loading={isLoading}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </div>
      </div>

      {/* 세금계산서 발행 모달 */}
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
                  <span className="text-muted-foreground">요청자</span>
                  <span className="font-medium">{taxInvoiceTarget.requesterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">상호</span>
                  <span className="font-medium">{taxInvoiceTarget.businessName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">정산 기간</span>
                  <span className="font-medium">{selectedYear}년 {monthNames[selectedMonth]}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">청구 금액</span>
                  <span className="font-bold text-blue-600">{formatAmount(taxInvoiceTarget.billedAmount)}</span>
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
                    requesterId: taxInvoiceTarget.requesterId,
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

      {/* 요청자 정산 상세 모달 */}
      <Dialog open={!!selectedRequester} onOpenChange={() => setSelectedRequester(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>요청자 정산 상세 - {selectedRequester?.requesterName}</DialogTitle>
          </DialogHeader>
          {selectedRequester && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">요청자명</div>
                  <div className="font-medium">{selectedRequester.requesterName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">상호</div>
                  <div className="font-medium">{selectedRequester.businessName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">연락처</div>
                  <div className="font-medium">{selectedRequester.requesterPhone || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">오더 수</div>
                  <div className="font-medium">{selectedRequester.orderCount}건</div>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">청구 금액</div>
                    <div className="text-lg font-bold">{formatAmount(selectedRequester.billedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">미정산 금액</div>
                    <div className="text-lg font-bold text-red-600">{formatAmount(selectedRequester.unpaidAmount)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">결제일</div>
                    <div className="text-lg font-bold">{selectedRequester.paymentDate || '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 오더 상세 내역 모달 */}
      <Dialog open={isOrdersModalOpen} onOpenChange={(open) => { setIsOrdersModalOpen(open); if (!open) setOrdersModalRequester(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ordersModalRequester?.requesterName} - 상세 이용내역 ({selectedYear}년 {selectedMonth + 1}월)
            </DialogTitle>
          </DialogHeader>
          {ordersModalRequester && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">상호</div>
                  <div className="font-medium">{ordersModalRequester.businessName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">총 오더수</div>
                  <div className="font-medium">{ordersModalRequester.orderCount}건</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">총금액</div>
                  <div className="font-bold text-primary">{formatAmount(ordersSummary.totalAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">계약금 입금</div>
                  <div className="font-bold text-green-600">{formatAmount(ordersSummary.totalDeposit)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">잔금</div>
                  <div className="font-bold text-red-600">{formatAmount(ordersSummary.totalBalance)}</div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">오더번호</th>
                      <th className="px-3 py-2 text-left">일자</th>
                      <th className="px-3 py-2 text-left">운송사</th>
                      <th className="px-3 py-2 text-center">배송</th>
                      <th className="px-3 py-2 text-center">반품</th>
                      <th className="px-3 py-2 text-center">기타</th>
                      <th className="px-3 py-2 text-right">단가</th>
                      <th className="px-3 py-2 text-right">금액</th>
                      <th className="px-3 py-2 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requesterOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                          해당 기간에 오더 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      requesterOrders.map((order) => (
                        <tr key={order.orderId} className="border-t hover:bg-muted/50">
                          <td className="px-3 py-2 font-mono">#{order.orderId}</td>
                          <td className="px-3 py-2">{order.orderDate ? new Date(order.orderDate).toLocaleDateString('ko-KR') : '-'}</td>
                          <td className="px-3 py-2">{order.courierCompany}</td>
                          <td className="px-3 py-2 text-center">{order.deliveredCount}</td>
                          <td className="px-3 py-2 text-center">{order.returnedCount}</td>
                          <td className="px-3 py-2 text-center">{order.etcCount}</td>
                          <td className="px-3 py-2 text-right">{order.pricePerBox.toLocaleString()}원</td>
                          <td className="px-3 py-2 text-right font-medium">{order.totalAmount.toLocaleString()}원</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={order.status === 'closed' ? 'default' : 'secondary'}>
                              {order.status === 'closed' ? '마감완료' : order.status === 'closing_submitted' ? '마감제출' : order.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {requesterOrders.length > 0 && (
                    <tfoot className="bg-muted font-medium">
                      <tr>
                        <td colSpan={3} className="px-3 py-2">합계</td>
                        <td className="px-3 py-2 text-center">{requesterOrders.reduce((sum, o) => sum + o.deliveredCount, 0)}</td>
                        <td className="px-3 py-2 text-center">{requesterOrders.reduce((sum, o) => sum + o.returnedCount, 0)}</td>
                        <td className="px-3 py-2 text-center">{requesterOrders.reduce((sum, o) => sum + o.etcCount, 0)}</td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-right text-primary font-bold">
                          {requesterOrders.reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()}원
                        </td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
