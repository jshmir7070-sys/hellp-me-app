/**
 * Requesters Page - 재설계 버전
 * 요청자 관리
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - FilterBar로 상태 필터 통합
 * - DrawerDetail 유지
 * - EmptyState 추가
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DrawerDetail } from '@/components/common';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { RefreshCw, Phone, Mail, Calendar, Building2, MapPin, FileText, Download, Users, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Requester {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  status: string;
  createdAt: string;
  business?: {
    companyName?: string;
    businessNumber?: string;
    representativeName?: string;
    contactPhone?: string;
    address?: string;
  };
  stats?: {
    totalOrders?: number;
    completedOrders?: number;
    pendingOrders?: number;
  };
}

export default function RequestersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requesters = [], isLoading } = useQuery<Requester[]>({
    queryKey: ['admin-requesters-list'],
    queryFn: async () => {
      try {
        const data = await apiRequest<any[]>('/users?role=requester');
        return data.map((u: any) => ({
          id: u.id,
          name: u.name || '이름없음',
          email: u.email || '',
          phoneNumber: u.phoneNumber || u.phone,
          status: u.status || 'active',
          createdAt: u.createdAt,
          business: u.requesterBusiness ? {
            companyName: u.requesterBusiness.companyName,
            businessNumber: u.requesterBusiness.businessNumber,
            representativeName: u.requesterBusiness.representativeName,
            contactPhone: u.requesterBusiness.contactPhone,
            address: u.requesterBusiness.address,
          } : undefined,
          stats: u.stats,
        }));
      } catch {
        return [];
      }
    },
  });

  // 필터링
  const filteredRequesters = useMemo(() => {
    return requesters.filter((requester) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && requester.status !== 'active') return false;
        if (statusFilter === 'inactive' && requester.status === 'active') return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return (
          requester.id.toString().includes(q) ||
          requester.name.toLowerCase().includes(q) ||
          requester.phoneNumber?.includes(q) ||
          requester.business?.companyName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requesters, statusFilter, search]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = requesters.length;
    const active = requesters.filter(r => r.status === 'active').length;
    const inactive = requesters.filter(r => r.status !== 'active').length;

    return { total, active, inactive };
  }, [requesters]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }> = {
      active: { label: '활성', variant: 'success' },
      inactive: { label: '비활성', variant: 'default' },
      suspended: { label: '정지', variant: 'destructive' },
    };
    const s = map[status] || { label: status, variant: 'default' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const handleIdClick = (requester: Requester) => {
    navigate(`/requesters/${requester.id}`);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-requesters-list'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredRequesters.map((item) => ({
      '아이디': item.email || '',
      '이름': item.name || '',
      '업체명': item.business?.companyName || '',
      '연락처': item.phoneNumber || '',
      '가입일': formatDate(item.createdAt),
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
    link.download = `요청자목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<Requester>[] = [
    {
      accessorKey: 'email',
      header: ({ column }) => <SortableHeader column={column}>아이디 (이메일)</SortableHeader>,
      cell: ({ row }) => (
        <button
          className="p-0 h-auto font-mono text-sm text-emerald-600 underline hover:text-emerald-700 text-left"
          onClick={(e) => {
            e.stopPropagation();
            handleIdClick(row.original);
          }}
        >
          {row.original.email}
        </button>
      ),
    },
    {
      accessorKey: 'name',
      header: '이름',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'business',
      header: '업체명',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.business?.companyName || '-'}</span>
      ),
    },
    {
      accessorKey: 'phoneNumber',
      header: '연락처',
      cell: ({ row }) => <span className="text-sm">{row.original.phoneNumber || '-'}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>가입일</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
  ];

  // 로딩 중
  if (isLoading && requesters.length === 0) {
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
        title="요청자 관리"
        description="요청자 정보 및 사업자 관리 • 실시간 동기화"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
          </>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid columns={3}>
        <StatsCard
          title="전체 요청자"
          value={stats.total}
          description="총 요청자 수"
          icon={<Users className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="활성 요청자"
          value={stats.active}
          description="현재 활동 중"
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatsCard
          title="비활성 요청자"
          value={stats.inactive}
          description="비활성 상태"
          icon={<XCircle className="h-5 w-5 text-gray-500" />}
          variant="default"
        />
      </StatsGrid>

      {/* 필터 바 */}
      <FilterBar
        filters={[
          {
            key: 'status',
            label: '상태',
            options: [
              { label: `전체 (${stats.total})`, value: 'all' },
              { label: `활성 (${stats.active})`, value: 'active' },
              { label: `비활성 (${stats.inactive})`, value: 'inactive' },
            ],
            value: statusFilter,
            onChange: (value) => setStatusFilter(value),
          },
        ]}
        searchQuery={search}
        onSearchQueryChange={setSearch}
        searchPlaceholder="이메일, 이름, 업체명, 연락처 검색..."
      />

      {/* 데이터 테이블 */}
      {filteredRequesters.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
          title="요청자가 없습니다"
          description={search ? "검색 조건에 맞는 요청자가 없습니다." : "요청자가 없습니다."}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredRequesters}
          pageSize={20}
          fixedHeader={true}
          maxHeight="calc(100vh - 500px)"
          loading={isLoading}
          onRowClick={(row) => {
            setSelectedRequester(row);
            setIsDetailOpen(true);
          }}
        />
      )}

      {/* 상세 정보 Drawer */}
      <DrawerDetail
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedRequester?.name || '요청자 상세'}
        subtitle={selectedRequester?.email || ''}
        width="md"
      >
        {selectedRequester && (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{selectedRequester.name}</h3>
                {getStatusBadge(selectedRequester.status)}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">연락처</p>
                  <p className="font-medium">{selectedRequester.phoneNumber || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">이메일</p>
                  <p className="font-medium">{selectedRequester.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">가입일</p>
                  <p className="font-medium">{formatDate(selectedRequester.createdAt)}</p>
                </div>
              </div>
            </div>

            {selectedRequester.business && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">사업자 정보</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">업체명</p>
                      <p className="font-medium">{selectedRequester.business.companyName || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">사업자번호</p>
                      <p className="font-medium">{selectedRequester.business.businessNumber || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">대표자명</p>
                      <p className="font-medium">{selectedRequester.business.representativeName || '-'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">담당자 연락처</p>
                      <p className="font-medium">{selectedRequester.business.contactPhone || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">주소</p>
                      <p className="font-medium">{selectedRequester.business.address || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedRequester.stats && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">오더 통계</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedRequester.stats.totalOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">전체 오더</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{selectedRequester.stats.completedOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">완료</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-600">{selectedRequester.stats.pendingOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">진행중</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DrawerDetail>
    </div>
  );
}
