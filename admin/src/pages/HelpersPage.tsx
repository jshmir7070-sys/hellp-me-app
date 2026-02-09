/**
 * Helpers Page - 재설계 버전
 * 헬퍼 관리 및 팀 관리
 *
 * 개선사항:
 * - DataTable로 전환 (고정 헤더)
 * - PageHeader, StatsGrid 적용
 * - FilterBar로 탭 통합
 * - EmptyState 추가
 * - 헬퍼 카드 상세 뷰 유지
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageHeader, StatsCard, StatsGrid, FilterBar } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Check, X, Phone, Mail, Calendar, FileCheck, FileX, User, Building2,
  CreditCard, Car, FileText, Image, ChevronLeft, QrCode, Shield, Users,
  Clock, Hash, Crown, UsersRound, RefreshCw, Download, UserCheck, UserX
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelperListItem {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  onboardingStatus?: string;
  createdAt: string;
  helperCredential?: any;
  teamName?: string;
}

interface HelperDetail {
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    dailyStatus?: string;
    isTeamLeader?: boolean;
    helperVerified?: boolean;
    helperVerifiedAt?: string;
    onboardingStatus?: string;
    onboardingReviewedAt?: string;
    onboardingRejectReason?: string;
    qrCode?: string;
    createdAt: string;
  };
  credential?: any;
  vehicles?: any;
  business?: {
    businessNumber?: string;
    businessName?: string;
    representativeName?: string;
    address?: string;
    businessType?: string;
    businessCategory?: string;
    email?: string;
    businessImageUrl?: string;
  };
  bankAccount?: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    bankbookImageUrl?: string;
  };
  license?: {
    driverLicenseImageUrl?: string;
    cargoLicenseImageUrl?: string;
  };
  termsAgreement?: {
    agreedAt?: string;
    signatureImageUrl?: string;
  };
  teamInfo?: {
    teamId: number;
    teamName: string;
    isLeader: boolean;
    leaderName: string;
  };
}

interface TeamWithMembers {
  id: number;
  name: string;
  leaderId: string;
  leaderName: string;
  leaderPhone?: string;
  leaderEmail?: string;
  memberCount: number;
  status: string;
  createdAt: string;
  members: TeamMemberItem[];
}

interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  isLeader: boolean;
  onboardingStatus?: string;
  createdAt: string;
}

export default function HelpersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'helpers' | 'teams'>('helpers');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: helpers = [], isLoading } = useQuery<HelperListItem[]>({
    queryKey: ['admin-helpers-list'],
    queryFn: async () => {
      try {
        const data = await apiRequest<any[]>('/users?role=helper');
        return data.map((u: any) => ({
          id: u.id,
          name: u.name || '이름없음',
          email: u.email || '',
          phoneNumber: u.phoneNumber || u.phone,
          onboardingStatus: u.onboardingStatus || 'pending',
          createdAt: u.createdAt,
          helperCredential: u.helperCredential,
          teamName: u.teamName || '',
        }));
      } catch {
        return [];
      }
    },
  });

  const { data: helperDetail, isLoading: isDetailLoading } = useQuery<HelperDetail>({
    queryKey: ['admin-helper-detail', selectedHelperId],
    queryFn: async () => {
      if (!selectedHelperId) throw new Error('No helper selected');
      return apiRequest<HelperDetail>(`/helpers/${selectedHelperId}/detail`);
    },
    enabled: !!selectedHelperId && viewMode === 'detail',
  });

  const { data: teams = [], isLoading: isTeamsLoading } = useQuery<TeamWithMembers[]>({
    queryKey: ['admin-teams-with-members'],
    queryFn: async () => {
      try {
        const data = await apiRequest<any[]>('/teams');
        return data.map((t: any) => ({
          id: t.id,
          name: t.name || `팀 ${t.id}`,
          leaderId: t.teamLeaderId || '',
          leaderName: t.teamLeaderName || '미지정',
          leaderPhone: t.teamLeaderPhone,
          leaderEmail: t.teamLeaderEmail,
          memberCount: t.memberCount || 0,
          status: t.status || 'ACTIVE',
          createdAt: t.createdAt || new Date().toISOString(),
          members: (t.members || []).map((m: any) => ({
            id: m.id,
            name: m.name || '이름없음',
            email: m.email || '',
            phoneNumber: m.phoneNumber || m.phone,
            isLeader: m.id === t.teamLeaderId || m.isTeamLeader,
            onboardingStatus: m.onboardingStatus || 'approved',
            createdAt: m.createdAt,
          })),
        }));
      } catch {
        return [];
      }
    },
    enabled: activeTab === 'teams',
  });

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const approveMutation = useMutation({
    mutationFn: (helperId: string) =>
      apiRequest(`/helpers/${helperId}/approve`, {
        method: 'POST',
        body: JSON.stringify({})
      }),
    onSuccess: () => {
      toast({ title: '헬퍼가 승인되었습니다' });
      queryClient.invalidateQueries({ queryKey: ['admin-helpers-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-helper-detail', selectedHelperId] });
    },
    onError: (error: Error) => {
      toast({ title: '승인 실패', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (helperId: string) =>
      apiRequest(`/helpers/${helperId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: '서류 미비' })
      }),
    onSuccess: () => {
      toast({ title: '헬퍼가 반려되었습니다' });
      queryClient.invalidateQueries({ queryKey: ['admin-helpers-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-helper-detail', selectedHelperId] });
    },
    onError: (error: Error) => {
      toast({ title: '반려 실패', description: error.message, variant: 'destructive' });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-helpers-list'] });
    queryClient.invalidateQueries({ queryKey: ['admin-teams-with-members'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = filteredHelpers.map(item => ({
      'ID': item.id,
      '이름': item.name || '',
      '이메일': item.email || '',
      '연락처': item.phoneNumber || '',
      '소속팀': item.teamName || '-',
      '가입일': item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '',
      '상태': item.onboardingStatus || 'pending',
      '사업자등록': item.helperCredential?.businessImageUrl ? 'O' : 'X',
      '면허증': item.helperCredential?.driverLicenseImageUrl ? 'O' : 'X',
      '화물자격증': item.helperCredential?.cargoLicenseImageUrl ? 'O' : 'X',
      '차량등록': item.helperCredential?.vehicleImageUrl ? 'O' : 'X',
    }));
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `헬퍼목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 필터링
  const filteredHelpers = useMemo(() => {
    return helpers.filter((helper) => {
      const status = helper.onboardingStatus || 'pending';
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && status !== 'pending' && status !== 'submitted') return false;
        if (statusFilter === 'approved' && status !== 'approved') return false;
        if (statusFilter === 'rejected' && status !== 'rejected') return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          helper.email?.toLowerCase().includes(q) ||
          helper.name.toLowerCase().includes(q) ||
          helper.phoneNumber?.includes(q)
        );
      }
      return true;
    });
  }, [helpers, statusFilter, searchQuery]);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return team.name.toLowerCase().includes(q) ||
        team.leaderName.toLowerCase().includes(q);
    });
  }, [teams, searchQuery]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = helpers.length;
    const pending = helpers.filter(h => (h.onboardingStatus || 'pending') === 'pending' || h.onboardingStatus === 'submitted').length;
    const approved = helpers.filter(h => h.onboardingStatus === 'approved').length;
    const rejected = helpers.filter(h => h.onboardingStatus === 'rejected').length;

    return { total, pending, approved, rejected };
  }, [helpers]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }> = {
      pending: { label: '대기', variant: 'default' },
      submitted: { label: '심사중', variant: 'warning' },
      approved: { label: '승인', variant: 'success' },
      rejected: { label: '반려', variant: 'destructive' },
    };
    const s = map[status] || { label: status, variant: 'default' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const DocIcon = ({ hasDoc }: { hasDoc: boolean }) => (
    hasDoc ? (
      <FileCheck className="h-4 w-4 text-emerald-500" />
    ) : (
      <FileX className="h-4 w-4 text-gray-300" />
    )
  );

  const handleIdClick = (helperId: string) => {
    navigate(`/helpers/${helperId}`);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedHelperId(null);
  };

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/api/')) return path;
    return `/api${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const helperColumns: ColumnDef<HelperListItem>[] = [
    {
      accessorKey: 'email',
      header: 'ID (이메일)',
      cell: ({ row }) => (
        <button
          className="text-blue-600 font-medium hover:underline text-left text-sm"
          onClick={(e) => {
            e.stopPropagation();
            handleIdClick(row.original.id);
          }}
        >
          {row.original.email || '-'}
        </button>
      ),
    },
    {
      accessorKey: 'name',
      header: '이름',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'phoneNumber',
      header: '연락처',
      cell: ({ row }) => <span className="text-sm">{row.original.phoneNumber || '-'}</span>,
    },
    {
      accessorKey: 'teamName',
      header: '소속팀',
      cell: ({ row }) => row.original.teamName ? (
        <Badge variant="outline" className="text-xs">{row.original.teamName}</Badge>
      ) : <span className="text-gray-400 text-sm">-</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>가입일</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      accessorKey: 'helperCredential',
      header: '서류',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <DocIcon hasDoc={!!row.original.helperCredential?.businessImageUrl} />
          <DocIcon hasDoc={!!row.original.helperCredential?.driverLicenseImageUrl} />
          <DocIcon hasDoc={!!row.original.helperCredential?.cargoLicenseImageUrl} />
          <DocIcon hasDoc={!!row.original.helperCredential?.vehicleImageUrl} />
        </div>
      ),
    },
    {
      accessorKey: 'onboardingStatus',
      header: '상태',
      cell: ({ row }) => getStatusBadge(row.original.onboardingStatus || 'pending'),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => (
        (row.original.onboardingStatus === 'pending' || row.original.onboardingStatus === 'submitted') ? (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-3"
              onClick={() => approveMutation.mutate(row.original.id)}
              disabled={approveMutation.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-3"
              onClick={() => rejectMutation.mutate(row.original.id)}
              disabled={rejectMutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  const teamColumns: ColumnDef<TeamWithMembers>[] = [
    {
      accessorKey: 'name',
      header: '팀명',
      cell: ({ row }) => (
        <button
          className="text-blue-600 font-medium hover:underline text-left flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTeamId(row.original.id);
          }}
        >
          <UsersRound className="h-4 w-4" />
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: 'leaderName',
      header: '팀장',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{row.original.leaderName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'memberCount',
      header: '인원수',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.memberCount}명</Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'ACTIVE' ? 'success' : 'default'}>
          {row.original.status === 'ACTIVE' ? '활성' : '비활성'}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>생성일</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
  ];

  const teamMemberColumns: ColumnDef<TeamMemberItem>[] = [
    {
      accessorKey: 'name',
      header: '이름',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.isLeader && <Crown className="h-4 w-4 text-amber-500" />}
          <span className={row.original.isLeader ? 'font-bold' : ''}>{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'ID (이메일)',
      cell: ({ row }) => (
        <button
          className="text-blue-600 hover:underline text-left text-sm"
          onClick={(e) => {
            e.stopPropagation();
            handleIdClick(row.original.id);
          }}
        >
          {row.original.email || '-'}
        </button>
      ),
    },
    {
      accessorKey: 'phoneNumber',
      header: '연락처',
      cell: ({ row }) => <span className="text-sm">{row.original.phoneNumber || '-'}</span>,
    },
    {
      accessorKey: 'onboardingStatus',
      header: '상태',
      cell: ({ row }) => getStatusBadge(row.original.onboardingStatus || 'approved'),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>가입일</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
  ];

  const getSortedTeamMembers = (team: TeamWithMembers) => {
    const leader = team.members.find(m => m.isLeader);
    const others = team.members.filter(m => !m.isLeader);
    return leader ? [leader, ...others] : others;
  };

  // 헬퍼 상세 카드 뷰
  if (viewMode === 'detail' && selectedHelperId) {
    if (isDetailLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!helperDetail) {
      return (
        <div className="space-y-6">
          <Button variant="ghost" onClick={handleBackToList}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            목록으로
          </Button>
          <div className="text-center py-8 text-muted-foreground">헬퍼 정보를 불러올 수 없습니다</div>
        </div>
      );
    }

    const { user, business, bankAccount, license, vehicles, termsAgreement, teamInfo } = helperDetail;
    const status = user.onboardingStatus || 'pending';

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBackToList}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            목록으로
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">헬퍼 카드</h1>
            <p className="text-sm text-muted-foreground">헬퍼의 모든 정보를 한눈에 확인</p>
          </div>
          {(status === 'pending' || status === 'submitted') && (
            <div className="flex gap-2">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => approveMutation.mutate(user.id)}
                disabled={approveMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                승인
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate(user.id)}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                반려
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1 lg:row-span-2">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <User className="h-12 w-12 text-blue-600" />
              </div>
              <CardTitle className="text-xl">{user.name}</CardTitle>
              <div className="mt-2">{getStatusBadge(status)}</div>
              {user.helperVerified && (
                <Badge variant="success" className="mt-2">
                  <Shield className="h-3 w-3 mr-1" />
                  인증완료
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <QrCode className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-xs text-muted-foreground">등록 QR코드</p>
                <p className="font-mono text-sm font-bold">{user.qrCode || '-'}</p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">ID (이메일)</p>
                    <span>{user.email || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phoneNumber || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs break-all">{user.email || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">가입일</p>
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                </div>
                {user.helperVerifiedAt && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">승인일</p>
                      <span>{formatDate(user.helperVerifiedAt)}</span>
                    </div>
                  </div>
                )}
                {user.onboardingRejectReason && (
                  <div className="p-2 bg-red-50 rounded text-red-600 text-xs">
                    반려사유: {user.onboardingRejectReason}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                사업자 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              {business?.businessNumber ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">사업자등록번호</p>
                    <p className="font-medium">{business.businessNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">상호명</p>
                    <p className="font-medium">{business.businessName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">대표자명</p>
                    <p className="font-medium">{business.representativeName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">업태 / 업종</p>
                    <p className="font-medium">
                      {business.businessType || '-'} / {business.businessCategory || '-'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">주소</p>
                    <p className="font-medium">{business.address || '-'}</p>
                  </div>
                  {business.email && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">이메일</p>
                      <p className="font-medium">{business.email}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">사업자 정보 없음</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                팀 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamInfo ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">팀명</p>
                    <p className="font-medium">{teamInfo.teamName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">역할</p>
                    <p className="font-medium">{teamInfo.isLeader ? '팀장' : '팀원'}</p>
                  </div>
                  {!teamInfo.isLeader && (
                    <div>
                      <p className="text-xs text-muted-foreground">팀장</p>
                      <p className="font-medium">{teamInfo.leaderName}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">팀 없음</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                차량 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vehicles?.vehicleType || vehicles?.plateNumber ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">차량종류</p>
                    <p className="font-medium">{vehicles.vehicleType || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">차량번호</p>
                    <p className="font-medium">{vehicles.plateNumber || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">차량 정보 없음</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                정산 계좌
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bankAccount?.bankName ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">은행</p>
                    <p className="font-medium">{bankAccount.bankName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">계좌번호</p>
                    <p className="font-medium">{bankAccount.accountNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">예금주</p>
                    <p className="font-medium">{bankAccount.accountHolder || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">계좌 정보 없음</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                계약 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              {termsAgreement?.agreedAt ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">계약 체결일</p>
                    <p className="font-medium">{formatDate(termsAgreement.agreedAt)}</p>
                  </div>
                  {termsAgreement.signatureImageUrl && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">전자서명</p>
                      <div
                        className="w-full h-16 bg-muted rounded border cursor-pointer overflow-hidden"
                        onClick={() => setSelectedImage(getImageUrl(termsAgreement.signatureImageUrl))}
                      >
                        <img
                          src={getImageUrl(termsAgreement.signatureImageUrl) || ''}
                          alt="서명"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">계약 미체결</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                제출 서류
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { key: 'businessCert', label: '사업자등록증', url: business?.businessImageUrl },
                  { key: 'driverLicense', label: '운전면허증', url: license?.driverLicenseImageUrl },
                  { key: 'cargoLicense', label: '화물운송자격증', url: license?.cargoLicenseImageUrl },
                  { key: 'vehicleCert', label: '차량등록증', url: vehicles?.vehicleImageUrl },
                  { key: 'bankbook', label: '통장사본', url: bankAccount?.bankbookImageUrl },
                ].map((doc) => {
                  const imageUrl = getImageUrl(doc.url);
                  return (
                    <div key={doc.key} className="space-y-2">
                      <p className="text-sm font-medium text-center">{doc.label}</p>
                      {imageUrl ? (
                        <div
                          className="aspect-[3/4] bg-muted rounded-lg overflow-hidden cursor-pointer border-2 border-emerald-200 hover:border-emerald-400 transition-colors"
                          onClick={() => setSelectedImage(imageUrl)}
                        >
                          <img
                            src={imageUrl}
                            alt={doc.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center h-full"><span class="text-xs text-muted-foreground">로드 실패</span></div>';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="aspect-[3/4] bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
                          <Image className="h-8 w-8 text-gray-300 mb-2" />
                          <span className="text-xs text-gray-400">미제출</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={selectedImage}
                alt="Document"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 로딩 중
  if (isLoading && helpers.length === 0) {
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
        title="헬퍼 관리"
        description="헬퍼 서류 확인 및 승인 관리 • 팀 관리 • 실시간 동기화"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredHelpers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
          </>
        }
      />

      {/* 통계 카드 */}
      <StatsGrid columns={4}>
        <StatsCard
          title="전체 헬퍼"
          value={stats.total}
          description="총 헬퍼 수"
          icon={<Users className="h-5 w-5 text-blue-500" />}
          variant="default"
        />
        <StatsCard
          title="승인 대기"
          value={stats.pending}
          description="심사 필요"
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          variant={stats.pending > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="승인 완료"
          value={stats.approved}
          description="활동 가능"
          icon={<UserCheck className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatsCard
          title="반려"
          value={stats.rejected}
          description="서류 반려"
          icon={<UserX className="h-5 w-5 text-red-500" />}
          variant="default"
        />
      </StatsGrid>

      {/* 탭 */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => { setActiveTab('helpers'); setSelectedTeamId(null); }}
          className={cn(
            "px-4 py-2 font-medium transition-colors border-b-2",
            activeTab === 'helpers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="h-4 w-4 inline-block mr-2" />
          헬퍼 목록
        </button>
        <button
          onClick={() => { setActiveTab('teams'); setSelectedTeamId(null); }}
          className={cn(
            "px-4 py-2 font-medium transition-colors border-b-2",
            activeTab === 'teams'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <UsersRound className="h-4 w-4 inline-block mr-2" />
          팀 관리
        </button>
      </div>

      {/* 헬퍼 목록 탭 */}
      {activeTab === 'helpers' && (
        <>
          {/* 필터 바 */}
          <FilterBar
            filters={[
              {
                key: 'status',
                label: '상태',
                options: [
                  { label: `전체 (${stats.total})`, value: 'all' },
                  { label: `승인대기 (${stats.pending})`, value: 'pending' },
                  { label: `승인완료 (${stats.approved})`, value: 'approved' },
                  { label: `반려 (${stats.rejected})`, value: 'rejected' },
                ],
                value: statusFilter,
                onChange: (value) => setStatusFilter(value),
              },
            ]}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchPlaceholder="이메일, 이름, 연락처 검색..."
          />

          {/* 데이터 테이블 */}
          {filteredHelpers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12 text-muted-foreground" />}
              title="헬퍼가 없습니다"
              description={searchQuery ? "검색 조건에 맞는 헬퍼가 없습니다." : "헬퍼가 없습니다."}
            />
          ) : (
            <DataTable
              columns={helperColumns}
              data={filteredHelpers}
              pageSize={20}
              fixedHeader={true}
              maxHeight="calc(100vh - 550px)"
              loading={isLoading}
              onRowClick={(row) => handleIdClick(row.id)}
            />
          )}
        </>
      )}

      {/* 팀 관리 탭 - 팀 목록 */}
      {activeTab === 'teams' && !selectedTeamId && (
        <>
          {/* 검색 바 */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="팀명, 팀장명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {filteredTeams.length === 0 ? (
            <EmptyState
              icon={<UsersRound className="h-12 w-12 text-muted-foreground" />}
              title="팀이 없습니다"
              description={searchQuery ? "검색 조건에 맞는 팀이 없습니다." : "등록된 팀이 없습니다."}
            />
          ) : (
            <DataTable
              columns={teamColumns}
              data={filteredTeams}
              pageSize={20}
              fixedHeader={true}
              maxHeight="calc(100vh - 500px)"
              loading={isTeamsLoading}
              onRowClick={(row) => setSelectedTeamId(row.id)}
            />
          )}
        </>
      )}

      {/* 팀 관리 탭 - 팀 상세 */}
      {activeTab === 'teams' && selectedTeamId && selectedTeam && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedTeamId(null)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              팀 목록으로
            </Button>
            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UsersRound className="h-5 w-5" />
                {selectedTeam.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                팀장: {selectedTeam.leaderName} | 총 {selectedTeam.memberCount}명
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                팀원 목록
                <Badge variant="secondary">{selectedTeam.members.length}명</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={teamMemberColumns}
                data={getSortedTeamMembers(selectedTeam)}
                pageSize={20}
                fixedHeader={true}
                maxHeight="calc(100vh - 450px)"
                loading={false}
                onRowClick={(row) => handleIdClick(row.id)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
