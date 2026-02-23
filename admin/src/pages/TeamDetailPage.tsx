import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTabs } from '@/contexts/TabContext';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  Users,
  DollarSign,
  Info,
  QrCode,
  Copy,
  Phone,
  Mail,
  Building2,
  UserCheck,
  UserX,
  Calendar,
} from 'lucide-react';

// ============ Interfaces ============

interface TeamLeader {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
}

interface TeamMember {
  id: number;
  name: string;
  phoneNumber?: string;
  email?: string;
  dailyStatus?: string;
  isActive: boolean;
  joinedAt: string;
}

interface TeamDetail {
  id: number;
  leaderId: string;
  name: string;
  qrCodeToken: string;
  businessType?: string;
  emergencyPhone?: string;
  commissionRate: number;
  isActive: boolean;
  createdAt: string;
  leader?: TeamLeader;
  members?: Array<{
    id: number;
    helperId: string;
    isActive: boolean;
    joinedAt: string;
    user?: {
      id: string;
      name: string;
      phoneNumber?: string;
      email?: string;
    };
  }>;
}

interface QrScanLog {
  id: number;
  scannedAt: string;
  scannedBy?: string;
  scannerName?: string;
}

// ============ Main Component ============

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { toast } = useToast();
  const { openTab } = useTabs();

  const [activeTab, setActiveTab] = useState('info');

  // ============ Data Fetching ============

  const {
    data: team,
    isLoading: loadingTeam,
    refetch: refetchTeam,
  } = useQuery<TeamDetail>({
    queryKey: ['admin-team', teamId],
    queryFn: () => apiRequest<TeamDetail>(`/teams/${teamId}`),
    enabled: !!teamId,
  });

  const {
    data: members = [],
    isLoading: loadingMembers,
  } = useQuery<TeamMember[]>({
    queryKey: ['admin-team-members', teamId],
    queryFn: () => apiRequest<TeamMember[]>(`/teams/${teamId}/members`),
    enabled: !!teamId,
  });

  const {
    data: qrScans = [],
    isLoading: loadingQrScans,
  } = useQuery<QrScanLog[]>({
    queryKey: ['admin-team-qr-scans', teamId],
    queryFn: () => apiRequest<QrScanLog[]>(`/teams/${teamId}/qr/scans`),
    enabled: !!teamId && activeTab === 'qr',
  });

  // ============ Computed ============

  const memberStats = {
    total: members.length,
    active: members.filter((m) => m.isActive).length,
    inactive: members.filter((m) => !m.isActive).length,
  };

  // ============ Helpers ============

  const handleGoBack = () => {
    openTab({
      id: 'teams',
      title: '팀 관리',
      route: '/teams',
      closable: true,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: '복사됨', description: 'QR 토큰이 클립보드에 복사되었습니다.' });
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ============ Render ============

  if (loadingTeam) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">로딩 중...</span>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">팀을 찾을 수 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={handleGoBack}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{team.name}</h1>
              <Badge
                className={cn(
                  team.isActive
                    ? 'bg-green-100 text-green-800 hover:bg-green-100'
                    : 'bg-red-100 text-red-800 hover:bg-red-100'
                )}
              >
                {team.isActive ? '활성' : '비활성'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              팀 ID: {team.id} | 팀장: {team.leader?.name || team.leaderId}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchTeam()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">전체 팀원</p>
              <p className="text-2xl font-bold">{memberStats.total}명</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-green-50">
          <div className="flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">활성 팀원</p>
              <p className="text-2xl font-bold text-green-700">{memberStats.active}명</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-red-50">
          <div className="flex items-center gap-3">
            <UserX className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">비활성 팀원</p>
              <p className="text-2xl font-bold text-red-600">{memberStats.inactive}명</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-amber-50">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">수수료율</p>
              <p className="text-2xl font-bold text-amber-700">{team.commissionRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="info" className="gap-1">
                <Info className="h-4 w-4" />
                기본정보
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1">
                <Users className="h-4 w-4" />
                팀원 ({memberStats.total})
              </TabsTrigger>
              <TabsTrigger value="qr" className="gap-1">
                <QrCode className="h-4 w-4" />
                QR코드
              </TabsTrigger>
            </TabsList>

            {/* ===== Tab: 기본정보 ===== */}
            <TabsContent value="info" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 팀 정보 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      팀 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">팀명</span>
                      <span className="font-medium">{team.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">팀 ID</span>
                      <span className="font-mono text-xs">{team.id}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">업무유형</span>
                      <span className="font-medium">{team.businessType || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">수수료율</span>
                      <span className="font-bold text-lg">{team.commissionRate}%</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">상태</span>
                      <Badge
                        className={cn(
                          'text-xs',
                          team.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-red-100 text-red-800 hover:bg-red-100'
                        )}
                      >
                        {team.isActive ? '활성' : '비활성'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">등록일</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(team.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 팀장 정보 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      팀장 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">이름</span>
                      <span className="font-medium">{team.leader?.name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">사용자 ID</span>
                      <span className="font-mono text-xs">{team.leaderId}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">연락처</span>
                      {team.leader?.phoneNumber ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {team.leader.phoneNumber}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">이메일</span>
                      {team.leader?.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {team.leader.email}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-muted-foreground">비상 연락처</span>
                      {team.emergencyPhone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-red-400" />
                          {team.emergencyPhone}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">팀원 수</span>
                      <span className="font-medium">{memberStats.total}명</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ===== Tab: 팀원 ===== */}
            <TabsContent value="members" className="mt-4">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">로딩 중...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="h-12 w-12 mb-3 opacity-50" />
                  <p>등록된 팀원이 없습니다.</p>
                  <p className="text-xs mt-1">팀원은 QR코드 스캔을 통해 가입합니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium">ID</th>
                        <th className="text-left px-4 py-3 font-medium">이름</th>
                        <th className="text-left px-4 py-3 font-medium">연락처</th>
                        <th className="text-left px-4 py-3 font-medium">이메일</th>
                        <th className="text-center px-4 py-3 font-medium">근무상태</th>
                        <th className="text-center px-4 py-3 font-medium">상태</th>
                        <th className="text-left px-4 py-3 font-medium">가입일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 text-muted-foreground">{member.id}</td>
                          <td className="px-4 py-3 font-medium">{member.name || '-'}</td>
                          <td className="px-4 py-3">
                            {member.phoneNumber ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {member.phoneNumber}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{member.email || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className="text-xs">
                              {member.dailyStatus || '-'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              className={cn(
                                'text-xs',
                                member.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                              )}
                            >
                              {member.isActive ? '활성' : '비활성'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(member.joinedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ===== Tab: QR코드 ===== */}
            <TabsContent value="qr" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    팀 QR 토큰
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                    <code className="flex-1 font-mono text-sm break-all">
                      {team.qrCodeToken}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(team.qrCodeToken)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    헬퍼가 이 QR 토큰을 스캔하면 자동으로 팀에 가입됩니다.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">QR 스캔 기록</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingQrScans ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">로딩 중...</span>
                    </div>
                  ) : qrScans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <QrCode className="h-10 w-10 mb-2 opacity-50" />
                      <p>QR 스캔 기록이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-3 font-medium">ID</th>
                            <th className="text-left px-4 py-3 font-medium">스캔자</th>
                            <th className="text-left px-4 py-3 font-medium">스캔 시간</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qrScans.map((scan) => (
                            <tr key={scan.id} className="border-b hover:bg-muted/30">
                              <td className="px-4 py-3 text-muted-foreground">{scan.id}</td>
                              <td className="px-4 py-3">{scan.scannerName || scan.scannedBy || '-'}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {formatDateTime(scan.scannedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
