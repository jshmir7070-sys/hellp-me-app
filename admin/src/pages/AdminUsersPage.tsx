/**
 * Admin Users Page - 재설계 버전
 * 운영자 관리 (인사카드 + 권한)
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더, 2개 테이블)
 * - PageHeader, StatsGrid 적용
 * - Dialog 모달 유지 (추가, 상세)
 * - 메뉴 권한 관리 유지
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Plus, UserCog, Key, RefreshCw, Download, User, Mail, Phone, MapPin, Briefcase, Eye, Menu } from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { AddressSearch } from '@/components/ui/address-search';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  zipCode?: string;
  address?: string;
  addressDetail?: string;
  role: string;
  position?: string;
  department?: string;
  isHqStaff?: boolean;
  status?: string;
  lastLoginAt?: string;
  createdAt?: string;
  profileImageUrl?: string;
  menuPermissions?: string[];
}

interface Role {
  id: number;
  name: string;
  description?: string;
  permissionCount?: number;
}

interface NewOperator {
  name: string;
  email: string;
  password: string;
  phone: string;
  zipCode: string;
  address: string;
  addressDetail: string;
  role: string;
  position: string;
  department: string;
}

// 메뉴 권한 정의 (체크박스로 부여)
const MENU_PERMISSIONS = [
  { key: 'menu.orders', label: '오더운영', description: '실시간오더관리, 오더마감자료' },
  { key: 'menu.payments', label: '결제및환불', description: '계약금결제, 잔금결제, 환불' },
  { key: 'menu.settlements', label: '정산', description: '일정산, 헬퍼정산, 요청자정산' },
  { key: 'menu.helpers', label: '헬퍼 관리', description: '신규 헬퍼 승인, 헬퍼 목록' },
  { key: 'menu.requesters', label: '요청자 관리', description: '신규 회원, 요청자 목록' },
  { key: 'menu.rates', label: '운임/정책', description: '운임설정, 환불정책' },
  { key: 'menu.disputes', label: '이의제기/사고', description: '이의제기관리, 화물사고접수, 차감, 환불' },
  { key: 'menu.cs', label: 'CS', description: 'CS 문의' },
  { key: 'menu.settings', label: '설정', description: '공지/알림, 감사로그, 직원/권한관리' },
];

export default function AdminUsersPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [menuPerms, setMenuPerms] = useState<string[]>([]);
  const [newOperator, setNewOperator] = useState<NewOperator>({
    name: '',
    email: '',
    password: '',
    phone: '',
    zipCode: '',
    address: '',
    addressDetail: '',
    role: 'admin',
    position: '',
    department: '',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: adminUsers = [], isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/users?role=admin,superadmin,hq_staff');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/roles');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 선택된 사용자의 메뉴 권한 로드
  useEffect(() => {
    if (selectedUser) {
      setMenuPerms(selectedUser.menuPermissions || []);
    }
  }, [selectedUser]);

  const createOperatorMutation = useMutation({
    mutationFn: async (data: NewOperator) => {
      const res = await adminFetch('/api/admin/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '운영자 등록에 실패했습니다');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '운영자가 등록되었습니다' });
      setShowAddModal(false);
      setNewOperator({ name: '', email: '', password: '', phone: '', zipCode: '', address: '', addressDetail: '', role: 'admin', position: '', department: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: Error) => {
      toast({ title: '오류', description: error.message, variant: 'destructive' });
    },
  });

  const updateOperatorMutation = useMutation({
    mutationFn: async (data: Partial<AdminUser> & { menuPermissions?: string[]; phone?: string }) => {
      const res = await adminFetch(`/api/admin/operators/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '수정에 실패했습니다');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '정보가 수정되었습니다' });
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: Error) => {
      toast({ title: '오류', description: error.message, variant: 'destructive' });
    },
  });

  const filteredAdminUsers = useMemo(() => {
    return (adminUsers || []).filter((u: any) =>
      ['admin', 'superadmin'].includes(u.role) || u.isHqStaff
    );
  }, [adminUsers]);

  // 통계 계산
  const stats = useMemo(() => {
    const superadmin = adminUsers.filter((u: any) => u.role === 'superadmin').length;
    const admin = adminUsers.filter((u: any) => u.role === 'admin').length;
    const hqStaff = adminUsers.filter((u: any) => u.isHqStaff).length;
    const total = filteredAdminUsers.length;

    return { superadmin, admin, hqStaff, total };
  }, [adminUsers, filteredAdminUsers]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/roles'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredAdminUsers.map((item: AdminUser) => ({
      '이름': item.name || '',
      '이메일': item.email || '',
      '전화번호': item.phoneNumber || '',
      '우편번호': item.zipCode || '',
      '주소': item.address || '',
      '상세주소': item.addressDetail || '',
      '직급': item.position || '',
      '부서': item.department || '',
      '역할': item.role || '',
      'HQ권한': item.isHqStaff ? 'Y' : 'N',
      '상태': item.status || 'active',
      '가입일': item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '',
      '마지막로그인': item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('ko-KR') : '',
    }));
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) => headers.map(h => `"${row[h as keyof typeof row] || ''}"`).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `운영자목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleViewUser = (user: AdminUser) => {
    setSelectedUser(user);
    setEditMode(false);
    setShowDetailModal(true);
  };

  const handleAddOperator = () => {
    if (!newOperator.name || !newOperator.email || !newOperator.password) {
      toast({ title: '필수 항목을 입력해주세요', variant: 'destructive' });
      return;
    }
    createOperatorMutation.mutate(newOperator);
  };

  const handleUpdateOperator = () => {
    if (!selectedUser) return;
    // Backend expects 'phone', not 'phoneNumber'
    const { phoneNumber, ...rest } = selectedUser;
    updateOperatorMutation.mutate({
      ...rest,
      phone: phoneNumber,
      menuPermissions: menuPerms
    });
  };

  const toggleMenuPermission = (key: string) => {
    setMenuPerms(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const userColumns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: 'name',
      header: '이름',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'email',
      header: '이메일',
      cell: ({ row }) => <span className="text-sm">{row.original.email || '-'}</span>,
    },
    {
      accessorKey: 'phoneNumber',
      header: '전화번호',
      cell: ({ row }) => <span className="text-sm">{row.original.phoneNumber || '-'}</span>,
    },
    {
      accessorKey: 'position',
      header: '직급',
      cell: ({ row }) => <span className="text-sm">{row.original.position || '-'}</span>,
    },
    {
      accessorKey: 'department',
      header: '부서',
      cell: ({ row }) => <span className="text-sm">{row.original.department || '-'}</span>,
    },
    {
      accessorKey: 'role',
      header: '역할',
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'superadmin' ? 'destructive' : 'default'}>
          {row.original.role === 'superadmin' ? '슈퍼관리자' : row.original.role === 'admin' ? '관리자' : row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'isHqStaff',
      header: 'HQ',
      cell: ({ row }) => row.original.isHqStaff ? <Badge variant="outline">HQ</Badge> : null,
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' || !row.original.status ? 'success' : 'default'}>
          {row.original.status === 'active' || !row.original.status ? '활성' : '비활성'}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: ({ column }) => <SortableHeader column={column}>마지막 로그인</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.lastLoginAt ? new Date(row.original.lastLoginAt).toLocaleString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => handleViewUser(row.original)}>
          <Eye className="h-4 w-4 mr-1" />
          보기
        </Button>
      ),
    },
  ];

  const roleColumns: ColumnDef<Role>[] = [
    {
      accessorKey: 'name',
      header: '역할명',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'description',
      header: '설명',
      cell: ({ row }) => <span className="text-sm">{row.original.description || '-'}</span>,
    },
    {
      accessorKey: 'permissionCount',
      header: '권한 수',
      cell: ({ row }) => <span className="text-sm">{row.original.permissionCount || '-'}</span>,
    },
    {
      id: 'actions',
      header: '액션',
      cell: () => <Button size="sm" variant="outline">편집</Button>,
    },
  ];

  // 로딩 중
  if (isLoading && adminUsers.length === 0) {
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
        title="운영자 관리"
        description="운영자 인사카드 및 권한 관리 • 실시간 동기화"
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
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              운영자 추가
            </Button>
          </>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid columns={4}>
        <StatsCard
          title="전체 운영자"
          value={stats.total}
          description="총 운영자 수"
          icon={<UserCog className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="슈퍼관리자"
          value={stats.superadmin}
          description="최고 권한"
          icon={<Shield className="h-5 w-5 text-red-500" />}
          variant="default"
        />
        <StatsCard
          title="일반관리자"
          value={stats.admin}
          description="관리 권한"
          icon={<UserCog className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="HQ 스태프"
          value={stats.hqStaff}
          description="본사 직원"
          icon={<Key className="h-5 w-5 text-green-500" />}
          variant="default"
        />
      </StatsGrid>

      {/* 운영자 목록 테이블 */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            운영자 목록
          </h3>
        </div>
        <div className="p-0">
          {filteredAdminUsers.length === 0 ? (
            <EmptyState
              icon={<UserCog className="h-12 w-12 text-muted-foreground" />}
              title="운영자가 없습니다"
              description="등록된 운영자 계정이 없습니다."
            />
          ) : (
            <DataTable
              columns={userColumns}
              data={filteredAdminUsers}
              pageSize={20}
              fixedHeader={true}
              maxHeight="calc(100vh - 600px)"
              loading={isLoading}
            />
          )}
        </div>
      </div>

      {/* 역할 관리 테이블 */}
      {roles && roles.length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Key className="h-5 w-5" />
              역할 관리
            </h3>
          </div>
          <div className="p-0">
            <DataTable
              columns={roleColumns}
              data={roles}
              pageSize={10}
              fixedHeader={true}
              maxHeight="calc(100vh - 600px)"
              loading={rolesLoading}
            />
          </div>
        </div>
      )}

      {/* 운영자 추가 모달 */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              운영자 추가
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={newOperator.name}
                  onChange={(e) => setNewOperator({ ...newOperator, name: e.target.value })}
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newOperator.email}
                  onChange={(e) => setNewOperator({ ...newOperator, email: e.target.value })}
                  placeholder="admin@hellpme.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 *</Label>
              <Input
                id="password"
                type="password"
                value={newOperator.password}
                onChange={(e) => setNewOperator({ ...newOperator, password: e.target.value })}
                placeholder="비밀번호 (최소 8자)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">전화번호</Label>
                <Input
                  id="phone"
                  value={newOperator.phone}
                  onChange={(e) => setNewOperator({ ...newOperator, phone: e.target.value })}
                  placeholder="010-1234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">역할</Label>
                <Select
                  value={newOperator.role}
                  onValueChange={(value) => setNewOperator({ ...newOperator, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="superadmin">슈퍼관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">직급</Label>
                <Input
                  id="position"
                  value={newOperator.position}
                  onChange={(e) => setNewOperator({ ...newOperator, position: e.target.value })}
                  placeholder="대리, 과장, 부장 등"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">부서</Label>
                <Input
                  id="department"
                  value={newOperator.department}
                  onChange={(e) => setNewOperator({ ...newOperator, department: e.target.value })}
                  placeholder="운영팀, 정산팀 등"
                />
              </div>
            </div>
            <AddressSearch
              value={{
                zipCode: newOperator.zipCode,
                address: newOperator.address,
                addressDetail: newOperator.addressDetail,
              }}
              onChange={(value) => setNewOperator({
                ...newOperator,
                zipCode: value.zipCode,
                address: value.address,
                addressDetail: value.addressDetail,
              })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>취소</Button>
            <Button onClick={handleAddOperator} disabled={createOperatorMutation.isPending}>
              {createOperatorMutation.isPending ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 인사카드 상세 모달 */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              인사카드
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">기본정보</TabsTrigger>
                <TabsTrigger value="auth">역할/상태</TabsTrigger>
                <TabsTrigger value="menu">메뉴 권한</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    {selectedUser.profileImageUrl ? (
                      <img src={selectedUser.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                    <p className="text-muted-foreground">{selectedUser.position || '-'} / {selectedUser.department || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" /> 이름
                    </Label>
                    {editMode ? (
                      <Input
                        value={selectedUser.name}
                        onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                      />
                    ) : (
                      <p className="p-2 bg-muted rounded">{selectedUser.name || '-'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> 이메일
                    </Label>
                    <p className="p-2 bg-muted rounded">{selectedUser.email || '-'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> 전화번호
                    </Label>
                    {editMode ? (
                      <Input
                        value={selectedUser.phoneNumber || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, phoneNumber: e.target.value })}
                      />
                    ) : (
                      <p className="p-2 bg-muted rounded">{selectedUser.phoneNumber || '-'}</p>
                    )}
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> 주소
                    </Label>
                    {editMode ? (
                      <AddressSearch
                        value={{
                          zipCode: selectedUser.zipCode || '',
                          address: selectedUser.address || '',
                          addressDetail: selectedUser.addressDetail || '',
                        }}
                        onChange={(value) => setSelectedUser({
                          ...selectedUser,
                          zipCode: value.zipCode,
                          address: value.address,
                          addressDetail: value.addressDetail,
                        })}
                      />
                    ) : (
                      <div className="space-y-1">
                        {selectedUser.zipCode && (
                          <p className="text-sm text-muted-foreground">우편번호: {selectedUser.zipCode}</p>
                        )}
                        <p className="p-2 bg-muted rounded">
                          {selectedUser.address || '-'}
                          {selectedUser.addressDetail && ` (${selectedUser.addressDetail})`}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> 직급
                    </Label>
                    {editMode ? (
                      <Input
                        value={selectedUser.position || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, position: e.target.value })}
                      />
                    ) : (
                      <p className="p-2 bg-muted rounded">{selectedUser.position || '-'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> 부서
                    </Label>
                    {editMode ? (
                      <Input
                        value={selectedUser.department || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, department: e.target.value })}
                      />
                    ) : (
                      <p className="p-2 bg-muted rounded">{selectedUser.department || '-'}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">가입일</Label>
                    <p>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('ko-KR') : '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">마지막 로그인</Label>
                    <p>{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString('ko-KR') : '-'}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="auth" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>역할</Label>
                    {editMode ? (
                      <Select
                        value={selectedUser.role}
                        onValueChange={(value) => setSelectedUser({ ...selectedUser, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">관리자</SelectItem>
                          <SelectItem value="superadmin">슈퍼관리자</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2">
                        <Badge variant={selectedUser.role === 'superadmin' ? 'destructive' : 'default'}>
                          {selectedUser.role === 'superadmin' ? '슈퍼관리자' : '관리자'}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>상태</Label>
                    <div className="p-2">
                      <Badge variant={selectedUser.status === 'active' || !selectedUser.status ? 'default' : 'secondary'}>
                        {selectedUser.status === 'active' || !selectedUser.status ? '활성' : '비활성'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>HQ 스태프</Label>
                    <div className="p-2">
                      {selectedUser.isHqStaff ? (
                        <Badge variant="outline">HQ 권한 있음</Badge>
                      ) : (
                        <span className="text-muted-foreground">권한 없음</span>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="menu" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Menu className="h-5 w-5" />
                    <Label className="text-base font-semibold">메뉴 접근 권한</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    이 운영자가 접근할 수 있는 관리자 메뉴를 선택하세요.
                    {selectedUser.role === 'superadmin' && (
                      <span className="text-primary ml-2">(슈퍼관리자는 모든 메뉴에 접근 가능)</span>
                    )}
                  </p>
                  <div className="space-y-3 border rounded-lg p-4">
                    {MENU_PERMISSIONS.map((perm) => (
                      <div key={perm.key} className="flex items-start space-x-3">
                        <Checkbox
                          id={perm.key}
                          checked={selectedUser.role === 'superadmin' || menuPerms.includes(perm.key)}
                          onCheckedChange={() => toggleMenuPermission(perm.key)}
                          disabled={!editMode || selectedUser.role === 'superadmin'}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <label
                            htmlFor={perm.key}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {perm.label}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>닫기</Button>
            {editMode ? (
              <Button onClick={handleUpdateOperator} disabled={updateOperatorMutation.isPending}>
                {updateOperatorMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            ) : (
              <Button onClick={() => setEditMode(true)}>수정</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
