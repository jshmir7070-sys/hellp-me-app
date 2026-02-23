import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { Search, RefreshCw, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: number;
  createdAt: string;
  userId?: number;
  action: string;
  targetType: string;
  targetId: number;
  ipAddress?: string;
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiRequest<AuditLog[]>('/audit-logs'),
  });

  const filteredLogs = logs.filter((log) => {
    if (!debouncedSearch) return true;
    const searchLower = debouncedSearch.toLowerCase();
    return (
      log.action?.toLowerCase().includes(searchLower) ||
      log.targetType?.toLowerCase().includes(searchLower) ||
      log.targetId?.toString().includes(searchLower)
    );
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredLogs.map((item) => ({
      '시간': formatDateTime(item.createdAt),
      '사용자ID': item.userId || '',
      '액션': item.action || '',
      '대상유형': item.targetType || '',
      '대상ID': item.targetId || '',
      'IP주소': item.ipAddress || '',
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
    link.download = `감사로그_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<AuditLog>[] = [
    {
      key: 'createdAt',
      header: '시간',
      width: 160,
      render: (value) => formatDateTime(value),
    },
    {
      key: 'userId',
      header: '사용자',
      width: 100,
      render: (value) => <span className="font-mono text-sm">{value || '-'}</span>,
    },
    {
      key: 'action',
      header: '액션',
      width: 120,
      render: (value) => <Badge variant="outline">{value}</Badge>,
    },
    {
      key: 'targetType',
      header: '대상',
      width: 180,
      render: (value, row) => (
        <>
          <span className="text-muted-foreground">{value}</span>
          <span className="font-mono text-sm ml-1">#{row.targetId}</span>
        </>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      width: 140,
      render: (value) => <span className="font-mono text-sm">{value || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">감사 로그</h1>
          <p className="text-muted-foreground">관리자 활동 기록을 조회합니다</p>
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              감사 로그 목록
              {selectedIds.size > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({selectedIds.size}개 선택됨)
                </span>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ExcelTable
            data={filteredLogs}
            columns={columns}
            loading={isLoading}
            emptyMessage="감사 로그가 없습니다"
            getRowId={(row) => row.id}
            storageKey="audit-logs-table"
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
