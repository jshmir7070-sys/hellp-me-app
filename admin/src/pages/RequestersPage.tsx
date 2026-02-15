import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { DrawerDetail } from '@/components/common';
import { Search, RefreshCw, Phone, Mail, Calendar, Building2, MapPin, FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

const statusFilters = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '활성' },
  { id: 'inactive', label: '비활성' },
];

export default function RequestersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequester, _setSelectedRequester] = useState<Requester | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
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

  const filteredRequesters = requesters.filter((requester) => {
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

  const counts = {
    all: requesters.length,
    active: requesters.filter(r => r.status === 'active').length,
    inactive: requesters.filter(r => r.status !== 'active').length,
  };

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
      key: 'email',
      header: '아이디 (이메일)',
      width: 200,
      render: (value, row) => (
        <button
          className="p-0 h-auto font-mono text-sm text-emerald-600 underline hover:text-emerald-700 text-left"
          onClick={(e) => {
            e.stopPropagation();
            handleIdClick(row);
          }}
        >
          {value}
        </button>
      ),
    },
    {
      key: 'name',
      header: '이름',
      width: 100,
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'business',
      header: '업체명',
      width: 150,
      render: (value) => value?.companyName || '-',
    },
    {
      key: 'phoneNumber',
      header: '연락처',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'createdAt',
      header: '가입일',
      width: 100,
      render: (value) => formatDate(value),
    },
    {
      key: 'status',
      header: '상태',
      width: 80,
      render: (value) => getStatusBadge(value),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">요청자 관리</h1>
          <p className="text-muted-foreground">요청자 정보 및 사업자 관리</p>
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

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Button
            key={filter.id}
            variant={statusFilter === filter.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
            <Badge variant="secondary" className="ml-2">
              {counts[filter.id as keyof typeof counts]}
            </Badge>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              요청자 목록
              {selectedIds.size > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({selectedIds.size}개 선택)
                </span>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이메일, 이름, 업체명, 연락처 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ExcelTable
            data={filteredRequesters}
            columns={columns}
            loading={isLoading}
            emptyMessage="요청자가 없습니다"
            getRowId={(row) => row.id}
            storageKey="requesters-list"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            maxHeight="calc(100vh - 450px)"
            onRowClick={(row) => handleIdClick(row)}
          />
        </CardContent>
      </Card>

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
