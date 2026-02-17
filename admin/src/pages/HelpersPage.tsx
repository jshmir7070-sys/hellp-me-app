import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { Search, RefreshCw, Download, Check, X, Phone, Mail, Calendar, FileCheck, FileX, User, Building2, CreditCard, Car, FileText, Image, ChevronLeft, QrCode, Shield, Users, Clock, Hash, Crown, UsersRound } from 'lucide-react';

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

const statusFilters = [
  { id: 'all', label: '전체' },
  { id: 'pending', label: '승인대기' },
  { id: 'approved', label: '승인완료' },
  { id: 'rejected', label: '반려' },
];

export default function HelpersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [activeTab, setActiveTab] = useState<'helpers' | 'teams'>('helpers');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const filteredTeams = teams.filter((team) => {
    if (!teamSearch) return true;
    const q = teamSearch.toLowerCase();
    return team.name.toLowerCase().includes(q) ||
      team.leaderName.toLowerCase().includes(q);
  });

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

  const filteredHelpers = helpers.filter((helper) => {
    const status = helper.onboardingStatus || 'pending';
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && status !== 'pending' && status !== 'submitted') return false;
      if (statusFilter === 'approved' && status !== 'approved') return false;
      if (statusFilter === 'rejected' && status !== 'rejected') return false;
    }

    if (search) {
      const q = search.toLowerCase();
      return (
        helper.email?.toLowerCase().includes(q) ||
        helper.name.toLowerCase().includes(q) ||
        helper.phoneNumber?.includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: helpers.length,
    pending: helpers.filter(h => (h.onboardingStatus || 'pending') === 'pending' || h.onboardingStatus === 'submitted').length,
    approved: helpers.filter(h => h.onboardingStatus === 'approved').length,
    rejected: helpers.filter(h => h.onboardingStatus === 'rejected').length,
  };

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
    if (path.startsWith('data:')) return path;
    const token = localStorage.getItem('admin_token');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    if (path.startsWith('/uploads/')) return `${path}${tokenParam}`;
    if (path.startsWith('/api/')) return path;
    return `/uploads/${path}${tokenParam}`;
  };

  const columns: ColumnDef<HelperListItem>[] = [
    {
      key: 'email',
      header: 'ID (이메일)',
      width: 200,
      render: (value, row) => (
        <button
          className="text-blue-600 font-medium hover:underline text-left"
          onClick={(e) => {
            e.stopPropagation();
            handleIdClick(row.id);
          }}
        >
          {value || '-'}
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
      key: 'phoneNumber',
      header: '연락처',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'teamName',
      header: '소속팀',
      width: 100,
      render: (value) => value ? (
        <Badge variant="outline" className="text-xs">{value}</Badge>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      key: 'createdAt',
      header: '가입일',
      width: 100,
      render: (value) => formatDate(value),
    },
    {
      key: 'helperCredential',
      header: '사업자',
      width: 60,
      align: 'center',
      render: (value) => <DocIcon hasDoc={!!value?.businessImageUrl} />,
    },
    {
      key: 'helperCredential',
      header: '면허',
      width: 60,
      align: 'center',
      render: (value) => <DocIcon hasDoc={!!value?.driverLicenseImageUrl} />,
    },
    {
      key: 'helperCredential',
      header: '화물',
      width: 60,
      align: 'center',
      render: (value) => <DocIcon hasDoc={!!value?.cargoLicenseImageUrl} />,
    },
    {
      key: 'helperCredential',
      header: '차량',
      width: 60,
      align: 'center',
      render: (value) => <DocIcon hasDoc={!!value?.vehicleImageUrl} />,
    },
    {
      key: 'onboardingStatus',
      header: '상태',
      width: 80,
      render: (value) => getStatusBadge(value || 'pending'),
    },
    {
      key: 'id',
      header: '액션',
      width: 160,
      align: 'right',
      render: (_value, row) => (
        (row.onboardingStatus === 'pending' || row.onboardingStatus === 'submitted') ? (
          <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
              onClick={() => approveMutation.mutate(row.id)}
              disabled={approveMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              승인
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 px-3"
              onClick={() => rejectMutation.mutate(row.id)}
              disabled={rejectMutation.isPending}
            >
              <X className="h-4 w-4 mr-1" />
              반려
            </Button>
          </div>
        ) : null
      ),
    },
  ];

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

  const teamColumns: ColumnDef<TeamWithMembers>[] = [
    {
      key: 'name',
      header: '팀명',
      width: 150,
      render: (value, row) => (
        <button
          className="text-blue-600 font-medium hover:underline text-left flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTeamId(row.id);
          }}
        >
          <UsersRound className="h-4 w-4" />
          {value}
        </button>
      ),
    },
    {
      key: 'leaderName',
      header: '팀장',
      width: 120,
      render: (value) => (
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          {value}
        </div>
      ),
    },
    {
      key: 'memberCount',
      header: '인원수',
      width: 80,
      align: 'center',
      render: (value) => (
        <Badge variant="secondary">{value}명</Badge>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: 80,
      render: (value) => (
        <Badge variant={value === 'ACTIVE' ? 'success' : 'default'}>
          {value === 'ACTIVE' ? '활성' : '비활성'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: '생성일',
      width: 100,
      render: (value) => formatDate(value),
    },
  ];

  const teamMemberColumns: ColumnDef<TeamMemberItem>[] = [
    {
      key: 'name',
      header: '이름',
      width: 100,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          {row.isLeader && <Crown className="h-4 w-4 text-amber-500" />}
          <span className={row.isLeader ? 'font-bold' : ''}>{value}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'ID (이메일)',
      width: 180,
      render: (value, row) => (
        <button
          className="text-blue-600 hover:underline text-left"
          onClick={(e) => {
            e.stopPropagation();
            handleIdClick(row.id);
          }}
        >
          {value || '-'}
        </button>
      ),
    },
    {
      key: 'phoneNumber',
      header: '연락처',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'onboardingStatus',
      header: '상태',
      width: 80,
      render: (value) => getStatusBadge(value || 'approved'),
    },
    {
      key: 'createdAt',
      header: '가입일',
      width: 100,
      render: (value) => formatDate(value),
    },
  ];

  const getSortedTeamMembers = (team: TeamWithMembers) => {
    const leader = team.members.find(m => m.isLeader);
    const others = team.members.filter(m => !m.isLeader);
    return leader ? [leader, ...others] : others;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">헬퍼 관리</h1>
          <p className="text-muted-foreground">헬퍼 서류 확인 및 승인 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredHelpers.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            다운로드
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => { setActiveTab('helpers'); setSelectedTeamId(null); }}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'helpers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4 inline-block mr-2" />
          헬퍼 목록
        </button>
        <button
          onClick={() => { setActiveTab('teams'); setSelectedTeamId(null); }}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'teams'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UsersRound className="h-4 w-4 inline-block mr-2" />
          팀 관리
        </button>
      </div>

      {activeTab === 'helpers' && (
        <>
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
                  헬퍼 목록
                  {selectedIds.size > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({selectedIds.size}개 선택)
                    </span>
                  )}
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="이메일, 이름, 연락처 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ExcelTable
                data={filteredHelpers}
                columns={columns}
                loading={isLoading}
                emptyMessage="헬퍼가 없습니다"
                getRowId={(row) => row.id}
                storageKey="helpers-list"
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                maxHeight="calc(100vh - 450px)"
                onRowClick={(row) => handleIdClick(row.id)}
              />
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'teams' && !selectedTeamId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-5 w-5" />
                팀 목록
                <Badge variant="secondary" className="ml-2">{teams.length}개 팀</Badge>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="팀명, 팀장명 검색..."
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ExcelTable
              data={filteredTeams}
              columns={teamColumns}
              loading={isTeamsLoading}
              emptyMessage="등록된 팀이 없습니다"
              getRowId={(row) => row.id}
              storageKey="teams-list"
              maxHeight="calc(100vh - 400px)"
              onRowClick={(row) => setSelectedTeamId(row.id)}
            />
          </CardContent>
        </Card>
      )}

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
              <ExcelTable
                data={getSortedTeamMembers(selectedTeam)}
                columns={teamMemberColumns}
                loading={false}
                emptyMessage="팀원이 없습니다"
                getRowId={(row) => row.id}
                storageKey={`team-${selectedTeamId}-members`}
                maxHeight="calc(100vh - 400px)"
                onRowClick={(row) => handleIdClick(row.id)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
