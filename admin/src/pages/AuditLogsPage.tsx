import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader, StatsGrid, StatsCard } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, RefreshCw, Download, FileText, Activity, Users } from 'lucide-react';
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
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiRequest<AuditLog[]>('/audit-logs'),
  });

  const stats = useMemo(() => {
    const total = logs.length;
    const todayLogs = logs.filter((log) => {
      const today = new Date();
      const logDate = new Date(log.createdAt);
      return logDate.toDateString() === today.toDateString();
    }).length;
    const uniqueUsers = new Set(logs.filter(log => log.userId).map(log => log.userId)).size;
    const uniqueActions = new Set(logs.map(log => log.action)).size;
    return { total, todayLogs, uniqueUsers, uniqueActions };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!search) return true;
      const searchLower = search.toLowerCase();
      return (
        log.action?.toLowerCase().includes(searchLower) ||
        log.targetType?.toLowerCase().includes(searchLower) ||
        log.targetId?.toString().includes(searchLower)
      );
    });
  }, [logs, search]);

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

  const columns: ColumnDef<AuditLog>[] = useMemo(() => [
    {
      accessorKey: 'createdAt',
      header: '시간',
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: 'userId',
      header: '사용자',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.userId || '-'}</span>,
    },
    {
      accessorKey: 'action',
      header: '액션',
      cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge>,
    },
    {
      accessorKey: 'targetType',
      header: '대상',
      cell: ({ row }) => (
        <>
          <span className="text-muted-foreground">{row.original.targetType}</span>
          <span className="font-mono text-sm ml-1">#{row.original.targetId}</span>
        </>
      ),
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.ipAddress || '-'}</span>,
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="감사 로그"
        description="관리자 활동 기록을 조회합니다"
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              새로고침
            </Button>
            <Button variant="outline" onClick={handleDownloadExcel}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
          </>
        }
      />

      <StatsGrid>
        <StatsCard
          title="전체 로그"
          value={stats.total}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatsCard
          title="오늘 기록"
          value={stats.todayLogs}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatsCard
          title="활동 사용자"
          value={stats.uniqueUsers}
          icon={<Users className="h-4 w-4" />}
        />
        <StatsCard
          title="액션 유형"
          value={stats.uniqueActions}
          icon={<Activity className="h-4 w-4" />}
        />
      </StatsGrid>

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
        <CardContent className="p-0">
          {filteredLogs.length === 0 && !isLoading ? (
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="감사 로그가 없습니다"
              description="관리자 활동 기록이 여기에 표시됩니다"
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredLogs}
              loading={isLoading}
              maxHeight="calc(100vh - 550px)"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
