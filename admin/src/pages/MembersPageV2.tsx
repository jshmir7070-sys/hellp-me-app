import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { Pagination } from '@/components/common/Pagination';
import { 
  Users, 
  Truck,
  RefreshCw, 
  Download, 
  Search,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// ============ 인터페이스 정의 ============

interface Helper {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  teamName?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  createdAt: string;
  approvedAt?: string;
}

interface Requester {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  businessName?: string;
  businessNumber?: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  createdAt: string;
  approvedAt?: string;
}

// ============ 공통 설정 ============

const statusLabels: Record<string, string> = {
  pending: '승인대기',
  active: '활성',
  inactive: '비활성',
  suspended: '정지',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-red-100 text-red-800',
};

// ============ 메인 컴포넌트 ============

export default function MembersPageV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'helpers' | 'requesters'>('helpers');
  const [helperTab, setHelperTab] = useState<'all' | 'pending'>('all');
  const [requesterTab, setRequesterTab] = useState<'all' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [selectedMember, setSelectedMember] = useState<Helper | Requester | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // 페이지네이션 상태
  const [helperPage, setHelperPage] = useState(1);
  const [helperLimit, setHelperLimit] = useState(50);
  const [requesterPage, setRequesterPage] = useState(1);
  const [requesterLimit, setRequesterLimit] = useState(50);

  // ============ 데이터 조회 ============

  const { data: helpersResponse, isLoading: loadingHelpers } = useQuery({
    queryKey: ['helpers', helperTab, searchTerm, helperPage, helperLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(helperPage));
      params.append('limit', String(helperLimit));
      if (helperTab === 'pending') params.append('status', 'pending');
      if (searchTerm) params.append('search', searchTerm);
      
      return await apiRequest<{
        data: Helper[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/helpers?${params.toString()}`);
    },
  });

  const { data: requestersResponse, isLoading: loadingRequesters } = useQuery({
    queryKey: ['requesters', requesterTab, searchTerm, requesterPage, requesterLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(requesterPage));
      params.append('limit', String(requesterLimit));
      if (requesterTab === 'pending') params.append('status', 'pending');
      if (searchTerm) params.append('search', searchTerm);
      
      return await apiRequest<{
        data: Requester[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/requesters?${params.toString()}`);
    },
  });

  const helpers = helpersResponse?.data || [];
  const requesters = requestersResponse?.data || [];
  const isLoading = loadingHelpers || loadingRequesters;

  // ============ 필터링 (이제 백엔드에서 처리) ============

  const filteredHelpers = helpers;
  const filteredRequesters = requesters;

  // ============ 통계 계산 (전체 통계 조회 필요) ============

  const { data: allHelpers = [] } = useQuery<Helper[]>({
    queryKey: ['helpers-all'],
    queryFn: async () => {
      const result = await apiRequest<{ data: Helper[] }>('/helpers?limit=9999');
      return result.data || [];
    },
  });

  const { data: allRequesters = [] } = useQuery<Requester[]>({
    queryKey: ['requesters-all'],
    queryFn: async () => {
      const result = await apiRequest<{ data: Requester[] }>('/requesters?limit=9999');
      return result.data || [];
    },
  });

  const helperStats = {
    total: allHelpers.filter(h => h.status !== 'pending').length,
    pending: allHelpers.filter(h => h.status === 'pending').length,
    active: allHelpers.filter(h => h.status === 'active').length,
    suspended: allHelpers.filter(h => h.status === 'suspended').length,
  };

  const requesterStats = {
    total: allRequesters.filter(r => r.status !== 'pending').length,
    pending: allRequesters.filter(r => r.status === 'pending').length,
    active: allRequesters.filter(r => r.status === 'active').length,
    suspended: allRequesters.filter(r => r.status === 'suspended').length,
  };

  // ============ 액션 핸들러 ============

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['helpers'] });
    queryClient.invalidateQueries({ queryKey: ['requesters'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    let data: any[] = [];
    let filename = '';

    if (activeTab === 'helpers') {
      data = filteredHelpers.map((item) => ({
        'ID': item.id,
        '이름': item.name,
        '이메일': item.email,
        '전화번호': item.phoneNumber,
        '팀명': item.teamName || '',
        '차량종류': item.vehicleType || '',
        '차량번호': item.vehiclePlate || '',
        '상태': statusLabels[item.status] || item.status,
        '가입일': new Date(item.createdAt).toLocaleDateString('ko-KR'),
        '승인일': item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('ko-KR') : '',
      }));
      filename = `헬퍼목록_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      data = filteredRequesters.map((item) => ({
        'ID': item.id,
        '이름': item.name,
        '이메일': item.email,
        '전화번호': item.phoneNumber,
        '사업자명': item.businessName || '',
        '사업자번호': item.businessNumber || '',
        '상태': statusLabels[item.status] || item.status,
        '가입일': new Date(item.createdAt).toLocaleDateString('ko-KR'),
        '승인일': item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('ko-KR') : '',
      }));
      filename = `요청자목록_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    if (data.length === 0) {
      toast({ title: '다운로드할 데이터가 없습니다.', variant: 'destructive' });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) => headers.map(h => row[h]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Excel 다운로드 완료' });
  };

  // 승인/거절 mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'helper' | 'requester' }) => {
      const endpoint = type === 'helper' ? `/helpers/${id}/approve` : `/requesters/${id}/approve`;
      return await apiRequest(endpoint, { method: 'POST' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type === 'helper' ? 'helpers' : 'requesters'] });
      toast({ title: '승인이 완료되었습니다.' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'helper' | 'requester' }) => {
      const endpoint = type === 'helper' ? `/helpers/${id}/reject` : `/requesters/${id}/reject`;
      return await apiRequest(endpoint, { method: 'POST' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type === 'helper' ? 'helpers' : 'requesters'] });
      toast({ title: '거절이 완료되었습니다.' });
    },
  });

  // ============ 컬럼 정의 ============

  const helperColumns: ColumnDef<Helper>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 70,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'name',
      header: '이름',
      width: 100,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.teamName && (
            <div className="text-xs text-muted-foreground">{row.teamName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: '이메일',
      width: 180,
      render: (value) => <span className="text-sm">{value}</span>,
    },
    {
      key: 'phoneNumber',
      header: '전화번호',
      width: 120,
      render: (value) => value,
    },
    {
      key: 'vehicleType',
      header: '차량',
      width: 150,
      render: (value, row) => (
        <div className="text-sm">
          {value && <div>{value}</div>}
          {row.vehiclePlate && <div className="text-xs text-muted-foreground">{row.vehiclePlate}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => (
        <Badge className={statusColors[value] || 'bg-gray-100 text-gray-800'}>
          {statusLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: '가입일',
      width: 100,
      render: (value) => (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ),
    },
    {
      key: 'id',
      header: '액션',
      width: 120,
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => approveMutation.mutate({ id: row.id, type: 'helper' })}
                disabled={approveMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                승인
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => rejectMutation.mutate({ id: row.id, type: 'helper' })}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                거절
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const requesterColumns: ColumnDef<Requester>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 70,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'name',
      header: '이름',
      width: 100,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.businessName && (
            <div className="text-xs text-muted-foreground">{row.businessName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: '이메일',
      width: 180,
      render: (value) => <span className="text-sm">{value}</span>,
    },
    {
      key: 'phoneNumber',
      header: '전화번호',
      width: 120,
      render: (value) => value,
    },
    {
      key: 'businessNumber',
      header: '사업자번호',
      width: 140,
      render: (value) => value ? (
        <span className="font-mono text-sm">{value}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => (
        <Badge className={statusColors[value] || 'bg-gray-100 text-gray-800'}>
          {statusLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: '가입일',
      width: 100,
      render: (value) => (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ),
    },
    {
      key: 'id',
      header: '액션',
      width: 120,
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => approveMutation.mutate({ id: row.id, type: 'requester' })}
                disabled={approveMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                승인
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => rejectMutation.mutate({ id: row.id, type: 'requester' })}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                거절
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  // ============ 렌더링 ============

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">👥 회원 관리</h1>
          <p className="text-muted-foreground">헬퍼와 요청자 회원을 통합 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* 통합 카드 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-2 w-[350px]">
                <TabsTrigger value="helpers">
                  <Truck className="h-4 w-4 mr-2" />
                  헬퍼
                  {helperStats.pending > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                      {helperStats.pending}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="requesters">
                  <Users className="h-4 w-4 mr-2" />
                  요청자
                  {requesterStats.pending > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                      {requesterStats.pending}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* 검색 */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    activeTab === 'helpers'
                      ? '이름, 이메일, 전화번호, 팀명 검색...'
                      : '이름, 이메일, 전화번호, 사업자명 검색...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 헬퍼 탭 */}
            <TabsContent value="helpers" className="space-y-4">
              {/* 서브 탭 */}
              <Tabs value={helperTab} onValueChange={(v) => setHelperTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">
                    전체 ({helperStats.total})
                  </TabsTrigger>
                  <TabsTrigger value="pending">
                    승인대기 ({helperStats.pending})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <ExcelTable
                    columns={helperColumns}
                    data={filteredHelpers}
                    onRowClick={(row) => {
                      setSelectedMember(row);
                      setIsDetailOpen(true);
                    }}
                    selectable={true}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    loading={loadingHelpers}
                  />
                  
                  {helpersResponse?.pagination && (
                    <Pagination
                      currentPage={helpersResponse.pagination.page}
                      totalPages={helpersResponse.pagination.totalPages}
                      totalItems={helpersResponse.pagination.total}
                      itemsPerPage={helperLimit}
                      onPageChange={(page) => setHelperPage(page)}
                      onItemsPerPageChange={(limit) => {
                        setHelperLimit(limit);
                        setHelperPage(1);
                      }}
                    />
                  )}
                </TabsContent>

                <TabsContent value="pending" className="mt-4">
                  <ExcelTable
                    columns={helperColumns}
                    data={filteredHelpers}
                    onRowClick={(row) => {
                      setSelectedMember(row);
                      setIsDetailOpen(true);
                    }}
                    selectable={true}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    loading={loadingHelpers}
                  />
                  
                  {helpersResponse?.pagination && (
                    <Pagination
                      currentPage={helpersResponse.pagination.page}
                      totalPages={helpersResponse.pagination.totalPages}
                      totalItems={helpersResponse.pagination.total}
                      itemsPerPage={helperLimit}
                      onPageChange={(page) => setHelperPage(page)}
                      onItemsPerPageChange={(limit) => {
                        setHelperLimit(limit);
                        setHelperPage(1);
                      }}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* 요청자 탭 */}
            <TabsContent value="requesters" className="space-y-4">
              {/* 서브 탭 */}
              <Tabs value={requesterTab} onValueChange={(v) => setRequesterTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">
                    전체 ({requesterStats.total})
                  </TabsTrigger>
                  <TabsTrigger value="pending">
                    승인대기 ({requesterStats.pending})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <ExcelTable
                    columns={requesterColumns}
                    data={filteredRequesters}
                    onRowClick={(row) => {
                      setSelectedMember(row);
                      setIsDetailOpen(true);
                    }}
                    selectable={true}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    loading={loadingRequesters}
                  />
                  
                  {requestersResponse?.pagination && (
                    <Pagination
                      currentPage={requestersResponse.pagination.page}
                      totalPages={requestersResponse.pagination.totalPages}
                      totalItems={requestersResponse.pagination.total}
                      itemsPerPage={requesterLimit}
                      onPageChange={(page) => setRequesterPage(page)}
                      onItemsPerPageChange={(limit) => {
                        setRequesterLimit(limit);
                        setRequesterPage(1);
                      }}
                    />
                  )}
                </TabsContent>

                <TabsContent value="pending" className="mt-4">
                  <ExcelTable
                    columns={requesterColumns}
                    data={filteredRequesters}
                    onRowClick={(row) => {
                      setSelectedMember(row);
                      setIsDetailOpen(true);
                    }}
                    selectable={true}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    loading={loadingRequesters}
                  />
                  
                  {requestersResponse?.pagination && (
                    <Pagination
                      currentPage={requestersResponse.pagination.page}
                      totalPages={requestersResponse.pagination.totalPages}
                      totalItems={requestersResponse.pagination.total}
                      itemsPerPage={requesterLimit}
                      onPageChange={(page) => setRequesterPage(page)}
                      onItemsPerPageChange={(limit) => {
                        setRequesterLimit(limit);
                        setRequesterPage(1);
                      }}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 회원 상세 모달 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'helpers' ? '헬퍼' : '요청자'} 상세 정보 - {selectedMember?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedMember && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">회원 ID</div>
                    <div className="font-mono text-sm">{selectedMember.id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">이름</div>
                    <div className="font-medium">{selectedMember.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">이메일</div>
                    <div className="font-medium">{selectedMember.email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">연락처</div>
                    <div className="font-medium">{selectedMember.phoneNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">상태</div>
                    <Badge className={cn(statusColors[selectedMember.status])}>
                      {statusLabels[selectedMember.status]}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">가입일</div>
                    <div className="font-medium">
                      {new Date(selectedMember.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  {selectedMember.approvedAt && (
                    <div>
                      <div className="text-sm text-muted-foreground">승인일</div>
                      <div className="font-medium">
                        {new Date(selectedMember.approvedAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 헬퍼 추가 정보 */}
              {activeTab === 'helpers' && 'teamName' in selectedMember && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">헬퍼 정보</h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    {selectedMember.teamName && (
                      <div>
                        <div className="text-sm text-muted-foreground">소속 팀</div>
                        <div className="font-medium">{selectedMember.teamName}</div>
                      </div>
                    )}
                    {selectedMember.vehicleType && (
                      <div>
                        <div className="text-sm text-muted-foreground">차량 종류</div>
                        <div className="font-medium">{selectedMember.vehicleType}</div>
                      </div>
                    )}
                    {selectedMember.vehiclePlate && (
                      <div>
                        <div className="text-sm text-muted-foreground">차량 번호</div>
                        <div className="font-medium">{selectedMember.vehiclePlate}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 요청자 추가 정보 */}
              {activeTab === 'requesters' && 'businessName' in selectedMember && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">사업자 정보</h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    {selectedMember.businessName && (
                      <div>
                        <div className="text-sm text-muted-foreground">상호명</div>
                        <div className="font-medium">{selectedMember.businessName}</div>
                      </div>
                    )}
                    {selectedMember.businessNumber && (
                      <div>
                        <div className="text-sm text-muted-foreground">사업자번호</div>
                        <div className="font-medium">{selectedMember.businessNumber}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 활동 통계 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">활동 통계</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">-</div>
                        <div className="text-sm text-muted-foreground mt-1">완료 오더</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">-</div>
                        <div className="text-sm text-muted-foreground mt-1">총 거래액</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">-</div>
                        <div className="text-sm text-muted-foreground mt-1">평균 평점</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  * 통계 데이터는 개발 예정입니다
                </div>
              </div>

              {/* 액션 버튼 */}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  닫기
                </Button>
                {selectedMember.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast({ title: '반려 기능은 개발 예정입니다.' });
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      반려
                    </Button>
                    <Button
                      onClick={() => {
                        toast({ title: '승인 기능은 개발 예정입니다.' });
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      승인
                    </Button>
                  </>
                )}
                {selectedMember.status === 'active' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast({ title: '정지 기능은 개발 예정입니다.' });
                    }}
                  >
                    정지
                  </Button>
                )}
                {selectedMember.status === 'suspended' && (
                  <Button
                    onClick={() => {
                      toast({ title: '정지 해제 기능은 개발 예정입니다.' });
                    }}
                  >
                    정지 해제
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
