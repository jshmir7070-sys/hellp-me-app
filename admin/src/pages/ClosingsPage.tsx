import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Image, FileText, RefreshCw, Download } from 'lucide-react';
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

interface ClosingReport {
  id: number;
  orderId: number;
  helperId: number;
  helperName?: string;
  helperPhone?: string;
  requesterId?: string;
  requesterName?: string;
  requesterPhone?: string;
  category?: string;
  categoryBasePrice?: number;
  categoryEtcPrice?: number;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  deliveryHistoryImages: string[];
  etcImages: string[];
  extraCostsJson: ExtraItem[] | null;
  closingMemo: string;
  status: string;
  createdAt: string;
  order?: {
    status: string;
    courierCompany: string;
    averageQuantity: string;
    finalPricePerBox: number;
    pricePerUnit: number;
  };
  settlement?: {
    finalTotal: number;
    driverPayout: number;
    platformFee: number;
    supplyPrice: number;
    depositAmount: number;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  parcel: '택배사',
  other: '기타택배',
  cold: '냉탑전용',
};

const toAbsFileUrl = (p: string) => {
  if (!p) return p;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${window.location.origin}${p}`;
};

export default function ClosingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedClosing, setSelectedClosing] = useState<ClosingReport | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange(30));
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const { data: closings = [], isLoading } = useQuery({
    queryKey: ['/api/admin/closings', dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/closings?status=all&startDate=${dateRange.from}&endDate=${dateRange.to}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const openImages = (images: string[]) => {
    setSelectedImages(images);
    setShowImageModal(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/closings'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredClosings.map((item: ClosingReport) => ({
      '오더번호': item.orderId,
      '요청자': item.requesterName || '',
      '요청자연락처': item.requesterPhone || '',
      '헬퍼': item.helperName || '',
      '헬퍼연락처': item.helperPhone || '',
      '카테고리': CATEGORY_LABELS[item.category || 'parcel'] || item.category || '',
      '운송사': item.order?.courierCompany || '',
      '배송수량': item.deliveredCount || 0,
      '반품수량': item.returnedCount || 0,
      '기타수량': item.etcCount || 0,
      '메모': item.closingMemo || '',
      '상태': item.status || '',
      '제출일시': item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '',
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
    link.download = `마감자료_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredClosings = closings.filter((c: ClosingReport) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      c.orderId.toString().includes(search) ||
      c.helperName?.toLowerCase().includes(search) ||
      c.requesterName?.toLowerCase().includes(search) ||
      c.order?.courierCompany?.toLowerCase().includes(search)
    );
  });

  const columns: ColumnDef<ClosingReport>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 90,
      render: (value) => <span className="font-mono text-sm font-medium">#{value}</span>,
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 120,
      render: (value, row) => (
        <div className="text-sm">
          <p className="font-medium">{value || '-'}</p>
          <p className="text-xs text-muted-foreground">{row.requesterPhone || ''}</p>
        </div>
      ),
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 120,
      render: (value, row) => (
        <div className="text-sm">
          <p className="font-medium">{value || `헬퍼#${row.helperId}`}</p>
          <p className="text-xs text-muted-foreground">{row.helperPhone || ''}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: '카테고리',
      width: 80,
      render: (value) => (
        <Badge variant="outline" className="text-xs">
          {CATEGORY_LABELS[value || 'parcel'] || value}
        </Badge>
      ),
    },
    {
      key: 'order',
      header: '운송사',
      width: 100,
      render: (value) => <span className="text-sm">{value?.courierCompany || '-'}</span>,
    },
    {
      key: 'categoryBasePrice',
      header: '설정단가',
      width: 80,
      align: 'right',
      render: (value) => <span className="text-sm">{value ? value.toLocaleString() + '원' : '-'}</span>,
    },
    {
      key: 'deliveredCount',
      header: '배송수량',
      width: 80,
      align: 'center',
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'returnedCount',
      header: '반품수량',
      width: 80,
      align: 'center',
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'etcCount',
      header: '기타',
      width: 80,
      align: 'center',
      render: (value) => <span className="font-medium">{value || 0}</span>,
    },
    {
      key: 'extraCostsJson',
      header: '추가비용',
      width: 140,
      render: (value) => {
        const extraItems: ExtraItem[] = value || [];
        if (extraItems.length === 0) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <div className="space-y-1">
            {extraItems.slice(0, 2).map((item, idx) => (
              <div key={idx} className="text-xs bg-muted/50 px-2 py-1 rounded">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground ml-1">
                  @{item.unitPrice?.toLocaleString()}
                </span>
              </div>
            ))}
            {extraItems.length > 2 ? (
              <span className="text-xs text-muted-foreground">
                +{extraItems.length - 2}개
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'deliveryHistoryImages',
      header: '마감자료',
      width: 80,
      align: 'center',
      render: (value, row) => {
        const totalImages = (value?.length || 0) + (row.etcImages?.length || 0);
        if (totalImages > 0) {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation();
                openImages([...(value || []), ...(row.etcImages || [])]);
              }}
            >
              <Image className="h-4 w-4 mr-1" />
              <span className="text-xs">{totalImages}</span>
            </Button>
          );
        }
        return <span className="text-xs text-muted-foreground">없음</span>;
      },
    },
    {
      key: 'createdAt',
      header: '제출일시',
      width: 110,
      render: (value) => (
        <span className="text-xs text-muted-foreground">
          {new Date(value).toLocaleString('ko-KR', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </span>
      ),
    },
    {
      key: 'id',
      header: '상세',
      width: 60,
      align: 'center',
      render: (_, row) => (
        <Button 
          size="sm" 
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedClosing(row);
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
          <h1 className="text-2xl font-bold">마감 자료 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">헬퍼가 제출한 마감 자료가 자동으로 요청자에게 반영됩니다</p>
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
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredClosings.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            다운로드
          </Button>
        </div>
      </div>

      <DateRangePicker value={dateRange} onChange={setDateRange} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            마감 자료 목록
            <Badge variant="secondary" className="ml-2">{filteredClosings.length}건</Badge>
            {selectedIds.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedIds.size}개 선택)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={filteredClosings}
            columns={columns}
            loading={isLoading}
            emptyMessage="마감 자료가 없습니다"
            getRowId={(row) => row.id}
            storageKey="closings-page"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
          />
        </CardContent>
      </Card>

      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>마감 자료 이미지</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
            {selectedImages.map((img, idx) => (
              <a key={idx} href={toAbsFileUrl(img)} target="_blank" rel="noopener noreferrer">
                <img 
                  src={toAbsFileUrl(img)} 
                  alt={`이미지 ${idx + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border hover:opacity-80 transition"
                />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedClosing} onOpenChange={() => setSelectedClosing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>마감 상세 - 오더 #{selectedClosing?.orderId}</DialogTitle>
          </DialogHeader>
          {selectedClosing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">요청자</h4>
                  <p>{selectedClosing.requesterName || '-'}</p>
                  <p className="text-xs text-muted-foreground">{selectedClosing.requesterPhone}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">헬퍼</h4>
                  <p>{selectedClosing.helperName || `헬퍼#${selectedClosing.helperId}`}</p>
                  <p className="text-xs text-muted-foreground">{selectedClosing.helperPhone}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">카테고리</h4>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedClosing.category || 'parcel'] || selectedClosing.category}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">운송사</h4>
                  <p>{selectedClosing.order?.courierCompany || '-'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">배송/반품/기타</h4>
                  <p className="font-medium">{selectedClosing.deliveredCount} / {selectedClosing.returnedCount} / {selectedClosing.etcCount || 0}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">제출시간</h4>
                  <p>{new Date(selectedClosing.createdAt).toLocaleString('ko-KR')}</p>
                </div>
              </div>

              {selectedClosing.settlement ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">정산 금액</h4>
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">요청자 총액</p>
                      <p className="text-lg font-bold">{selectedClosing.settlement?.finalTotal?.toLocaleString() || '-'}원</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">플랫폼 수수료</p>
                      <p className="text-lg font-medium">{selectedClosing.settlement?.platformFee?.toLocaleString() || '-'}원</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">헬퍼 지급액</p>
                      <p className="text-lg font-bold text-primary">{selectedClosing.settlement?.driverPayout?.toLocaleString() || '-'}원</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {(selectedClosing.extraCostsJson && selectedClosing.extraCostsJson.length > 0) ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">추가 항목</h4>
                  <div className="space-y-2">
                    {(selectedClosing.extraCostsJson as ExtraItem[]).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-sm">
                          {item.unitPrice?.toLocaleString()}원 x {item.quantity} = {((item.unitPrice || 0) * (item.quantity || 1)).toLocaleString()}원
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedClosing.deliveryHistoryImages?.length > 0 ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">배송이력 이미지 ({selectedClosing.deliveryHistoryImages.length})</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedClosing.deliveryHistoryImages.map((img, idx) => (
                      <a key={idx} href={toAbsFileUrl(img)} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={toAbsFileUrl(img)} 
                          alt={`배송이력 ${idx + 1}`}
                          className="w-full aspect-square object-cover rounded border hover:opacity-80"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedClosing.etcImages?.length > 0 ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">기타 이미지 ({selectedClosing.etcImages.length})</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedClosing.etcImages.map((img, idx) => (
                      <a key={idx} href={toAbsFileUrl(img)} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={toAbsFileUrl(img)} 
                          alt={`기타 ${idx + 1}`}
                          className="w-full aspect-square object-cover rounded border hover:opacity-80"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedClosing.closingMemo ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">마감 메모</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">{selectedClosing.closingMemo}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
