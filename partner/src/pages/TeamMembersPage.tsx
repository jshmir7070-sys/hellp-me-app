import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Users, Copy, Check, UserMinus, Phone, AlertCircle } from 'lucide-react';

interface TeamMember {
  id: number;
  helperId: string;
  isActive: boolean;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string;
    onboardingStatus: string;
    helperVerified: boolean;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: '승인완료', color: 'bg-green-100 text-green-800' },
  reviewing: { label: '검토중', color: 'bg-yellow-100 text-yellow-800' },
  pending: { label: '대기', color: 'bg-gray-100 text-gray-800' },
  not_submitted: { label: '미제출', color: 'bg-red-100 text-red-800' },
  rejected: { label: '거절', color: 'bg-red-100 text-red-800' },
};

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const result = await apiRequest<{
        members: TeamMember[];
        teamName: string;
        inviteCode: string;
      }>('/members');
      setMembers(result.members);
      setInviteCode(result.inviteCode);
      setTeamName(result.teamName);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!confirm(`${memberName}님을 팀에서 제거하시겠습니까?`)) return;

    setRemovingId(memberId);
    try {
      await apiRequest(`/members/${memberId}`, { method: 'DELETE' });
      loadMembers();
    } catch (err: any) {
      alert(err.message || '팀원 제거에 실패했습니다');
    } finally {
      setRemovingId(null);
    }
  };

  const activeMembers = members.filter(m => m.isActive);
  const inactiveMembers = members.filter(m => !m.isActive);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">팀원관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {teamName} — 활성 팀원 {activeMembers.length}명
        </p>
      </div>

      {/* Invite code section */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">팀 초대코드</h3>
            <p className="text-xs text-muted-foreground mt-1">
              헬퍼 앱에서 이 코드를 입력하면 팀에 가입할 수 있습니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-3 py-1.5 bg-muted rounded-md text-sm font-mono">
              {inviteCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="복사"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active members */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            활성 팀원 ({activeMembers.length})
          </h3>
        </div>
        <div className="divide-y">
          {activeMembers.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">
              아직 팀원이 없습니다. 초대코드를 공유하세요.
            </div>
          ) : (
            activeMembers.map((member) => (
              <div key={member.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {member.user?.name?.[0] || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.user?.name || '알 수 없음'}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {member.user?.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {member.user.phone}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        가입: {formatDate(member.joinedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.user && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      (STATUS_LABELS[member.user.onboardingStatus] || STATUS_LABELS.pending).color
                    }`}>
                      {member.user.helperVerified
                        ? '인증됨'
                        : (STATUS_LABELS[member.user.onboardingStatus] || STATUS_LABELS.pending).label}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveMember(member.id, member.user?.name || '')}
                    disabled={removingId === member.id}
                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="팀원 제거"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Inactive members */}
      {inactiveMembers.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden mt-4">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              비활성 팀원 ({inactiveMembers.length})
            </h3>
          </div>
          <div className="divide-y">
            {inactiveMembers.map((member) => (
              <div key={member.id} className="px-4 py-3 flex items-center gap-3 opacity-50">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {member.user?.name?.[0] || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-sm">{member.user?.name || '알 수 없음'}</p>
                  <span className="text-xs text-muted-foreground">탈퇴/제거됨</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
