import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/api';
import { useTabs } from '@/contexts/TabContext';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  Search,
  Users,
  Building2,
  UserCheck,
  UserX,
  Phone,
} from 'lucide-react';

// ============ Interfaces ============

interface TeamLeader {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
}

interface TeamMemberInfo {
  id: number;
  helperId: string;
  isActive: boolean;
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    phoneNumber?: string;
  };
}

interface Team {
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
  members?: TeamMemberInfo[];
}

// ============ Main Component ============

export default function TeamsPage() {
  const { openTab } = useTabs();

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'inactive'>('all');

  // ============ Data Fetching ============

  const { data: teams = [], isLoading, refetch } = useQuery<Team[]>({
    queryKey: ['admin-teams'],
    queryFn: () => apiRequest<Team[]>('/teams'),
  });

  // ============ Computed ============

  const stats = {
    total: teams.length,
    active: teams.filter((t) => t.isActive).length,
    inactive: teams.filter((t) => !t.isActive).length,
    totalMembers: teams.reduce((sum, t) => sum + (t.members?.length ?? 0), 0),
  };

  const filteredTeams = teams.filter((team) => {
    // Status filter
    if (statusTab === 'active' && !team.isActive) return false;
    if (statusTab === 'inactive' && team.isActive) return false;

    // Search filter
    if (!debouncedSearch) return true;
    const term = debouncedSearch.toLowerCase();
    return (
      team.name.toLowerCase().includes(term) ||
      team.leader?.name?.toLowerCase().includes(term) ||
      team.leader?.phoneNumber?.includes(term) ||
      team.businessType?.toLowerCase().includes(term) ||
      String(team.id).includes(term)
    );
  });

  // ============ Helpers ============

  const handleRowClick = (team: Team) => {
    openTab({
      id: `team-${team.id}`,
      title: `팀: ${team.name}`,
      route: `/teams/${team.id}`,
      closable: true,
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

  // ============ Render ============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">대리점/파트너 팀 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">
            등록된 대리점 및 파트너사 팀 현황
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">전체</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-green-50">
          <div className="flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">활성 팀</p>
              <p className="text-2xl font-bold text-green-700">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-red-50">
          <div className="flex items-center gap-3">
            <UserX className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">비활성 팀</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-purple-50">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">전체 팀원</p>
              <p className="text-2xl font-bold text-purple-700">{stats.totalMembers}명</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 탭 + 테이블 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  전체 ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="active">
                  활성 ({stats.active})
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  비활성 ({stats.inactive})
                </TabsTrigger>
              </TabsList>

              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="팀명, 팀장명, 연락처로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* 모든 탭 동일 테이블 (필터만 다름) */}
            {(['all', 'active', 'inactive'] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">로딩 중...</span>
                  </div>
                ) : filteredTeams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Building2 className="h-12 w-12 mb-3 opacity-50" />
                    <p>{debouncedSearch ? '검색 결과가 없습니다.' : '등록된 팀이 없습니다.'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-3 font-medium">ID</th>
                          <th className="text-left px-4 py-3 font-medium">팀명</th>
                          <th className="text-left px-4 py-3 font-medium">팀장</th>
                          <th className="text-left px-4 py-3 font-medium">연락처</th>
                          <th className="text-left px-4 py-3 font-medium">업무유형</th>
                          <th className="text-right px-4 py-3 font-medium">수수료율</th>
                          <th className="text-right px-4 py-3 font-medium">팀원수</th>
                          <th className="text-center px-4 py-3 font-medium">상태</th>
                          <th className="text-left px-4 py-3 font-medium">등록일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeams.map((team) => (
                          <tr
                            key={team.id}
                            className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => handleRowClick(team)}
                          >
                            <td className="px-4 py-3 text-muted-foreground">{team.id}</td>
                            <td className="px-4 py-3 font-medium">{team.name}</td>
                            <td className="px-4 py-3">{team.leader?.name || '-'}</td>
                            <td className="px-4 py-3">
                              {team.leader?.phoneNumber ? (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {team.leader.phoneNumber}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3">{team.businessType || '-'}</td>
                            <td className="px-4 py-3 text-right font-medium">{team.commissionRate}%</td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-medium">{team.members?.length ?? 0}</span>명
                            </td>
                            <td className="px-4 py-3 text-center">
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
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(team.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
