import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText, Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateRangePicker, getDefaultDateRange } from '@/components/common';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';

interface ExtraItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

interface DailySettlement {
  id: number;
  orderId: number;
  helperId: number;
  helperName?: string;
  helperPhone?: string;
  requesterName?: string;
  category?: string;
  courierCompany?: string;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  extraCostsJson: ExtraItem[] | null;
  closingMemo: string;
  createdAt: string;
  pricePerBox: number;
  driverPayout: number;
  platformFee: number;
  finalTotal: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  parcel: '택배사',
  other: '기타택배',
  cold: '냉탑전용',
};

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return amount.toLocaleString('ko-KR') + '원';
}

export default function DailySettlementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<DailySettlement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange(30));
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ['/api/admin/settlements/daily', dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/daily?startDate=${dateRange.from}&endDate=${dateRange.to}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const filteredSettlements = settlements.filter((s: DailySettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.orderId.toString().includes(search) ||
      s.helperName?.toLowerCase().includes(search) ||
      s.requesterName?.toLowerCase().includes(search) ||
      s.courierCompany?.toLowerCase().includes(search)
    );
  });

  const totalDriverPayout = filteredSettlements.reduce((sum: number, s: DailySettlement) => sum + (s.driverPayout || 0), 0);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/daily'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredSettlements.map((item: DailySettlement) => ({
      '오더번호': item.orderId,
      '요청자': item.requesterName || '',
      '헬퍼': item.helperName || '',
      '헬퍼연락처': item.helperPhone || '',
      '카테고리': CATEGORY_LABELS[item.category || ''] || item.category || '',
      '운송사': item.courierCompany || '',
      '배송수량': item.deliveredCount || 0,
      '반품수량': item.returnedCount || 0,
      '기타수량': item.etcCount || 0,
      '박스단가': item.pricePerBox || 0,
      '최종금액': item.finalTotal || 0,
      '플랫폼수수료': item.platformFee || 0,
      '헬퍼지급액': item.driverPayout || 0,
      '마감일시': item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '',
    }));
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `일정산_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<DailySettlement>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 90,
      render: (value) => <span className="font-mono text-sm font-medium">#{value}</span>,
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 100,
      render: (value) => value || '-',
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 120,
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
      key: 'category',
      header: '카테고리',
      width: 90,
      render: (value) => (
        <Badge variant="outline">
          {CATEGORY_LABELS[value || ''] || value || '-'}
        </Badge>
      ),
    },
    {
      key: 'courierCompany',
      header: '운송사',
      width: 100,
      render: (value) => value || '-',
    },
    {
      key: 'deliveredCount',
      header: '배송수량',
      width: 80,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'returnedCount',
      header: '반품수량',
      width: 80,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'etcCount',
      header: '기타',
      width: 80,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'pricePerBox',
      header: '박스단가',
      width: 100,
      align: 'right',
      render: (value) => formatAmount(value),
    },
    {
      key: 'finalTotal',
      header: '최종금액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'platformFee',
      header: '플랫폼수수료',
      width: 110,
      align: 'right',
      render: (value) => <span className="text-muted-foreground">{formatAmount(value)}</span>,
    },
    {
      key: 'driverPayout',
      header: '헬퍼지급액',
      width: 120,
      align: 'right',
      render: (value) => <span className="font-bold text-blue-600">{formatAmount(value)}</span>,
    },
    {
      key: 'createdAt',
      header: '마감일시',
      width: 100,
      render: (value) => value ? new Date(value).toLocaleDateString('ko-KR') : '-',
    },
    {
      key: 'id',
      header: '상세',
      width: 60,
      align: 'center',
      render: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItem(row);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">일정산</h1>
          <p className="text-sm text-muted-foreground mt-1">일별 마감자료 및 헬퍼 지급액 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="오더번호, 헬퍼, 요청자 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredSettlements.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            다운로드
          </Button>
        </div>
      </div>

      <DateRangePicker value={dateRange} onChange={setDateRange} />

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">조회 건수</div>
            <div className="text-2xl font-bold">{filteredSettlements.length}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">헬퍼 지급액 합계</div>
            <div className="text-2xl font-bold text-blue-600">{formatAmount(totalDriverPayout)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">기간</div>
            <div className="text-lg font-semibold">{dateRange.from} ~ {dateRange.to}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            일정산 목록
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
            emptyMessage="정산 데이터가 없습니다"
            getRowId={(row) => row.id}
            storageKey="daily-settlement"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>일정산 상세 - 오더 #{selectedItem?.orderId}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">헬퍼</div>
                  <div className="font-medium">{selectedItem.helperName}</div>
                  <div className="text-sm text-muted-foreground">{selectedItem.helperPhone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">운송사</div>
                  <div className="font-medium">{selectedItem.courierCompany}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">배송수량</div>
                  <div className="text-xl font-bold">{selectedItem.deliveredCount}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">반품수량</div>
                  <div className="text-xl font-bold">{selectedItem.returnedCount}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">기타</div>
                  <div className="text-xl font-bold">{selectedItem.etcCount || 0}</div>
                </div>
              </div>
              {selectedItem.extraCostsJson && selectedItem.extraCostsJson.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">추가 비용</div>
                  <div className="space-y-1">
                    {selectedItem.extraCostsJson.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span>{formatAmount(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>최종금액</span>
                  <span className="font-medium">{formatAmount(selectedItem.finalTotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>플랫폼 수수료</span>
                  <span>-{formatAmount(selectedItem.platformFee)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-blue-600 border-t pt-2">
                  <span>헬퍼 지급액</span>
                  <span>{formatAmount(selectedItem.driverPayout)}</span>
                </div>
              </div>
              {selectedItem.closingMemo && (
                <div>
                  <div className="text-sm text-muted-foreground">메모</div>
                  <div className="text-sm p-2 bg-muted rounded">{selectedItem.closingMemo}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
