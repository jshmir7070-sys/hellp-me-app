import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  CheckCircle,
  XCircle,
  Clock,
  Info,
  Search,
  AlertCircle,
} from 'lucide-react';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface BankAccount {
  id: number;
  userId: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  bankbookImageUrl?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
}

interface BankAccountWithUser extends BankAccount {
  user: UserInfo;
}

const STATUS_CONFIG = {
  pending: {
    label: '검토대기',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
  },
  verified: {
    label: '승인완료',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  rejected: {
    label: '반려됨',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
};

export default function HelperBankAccountsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
  });

  const [selectedAccount, setSelectedAccount] = useState<BankAccountWithUser | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailAccount, setDetailAccount] = useState<BankAccountWithUser | null>(null);
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'verify' | 'reject'>('verify');
  const [rejectionReason, setRejectionReason] = useState('');

  // 계좌 목록 조회
  const { data: accounts = [], isLoading } = useQuery<BankAccountWithUser[]>({
    queryKey: ['/api/admin/helper-bank-accounts'],
    queryFn: async () => {
      const allAccounts = await apiRequest<BankAccount[]>('/helper-bank-accounts');

      // 각 계좌에 대해 사용자 정보 가져오기
      const accountsWithUsers = await Promise.all(
        allAccounts.map(async (account) => {
          try {
            const user = await apiRequest<UserInfo>(`/users/${account.userId}`);
            return { ...account, user };
          } catch (err) {
            console.error(`Failed to fetch user ${account.userId}:`, err);
            return {
              ...account,
              user: {
                id: account.userId,
                name: '알 수 없음',
                email: '-',
              },
            };
          }
        })
      );

      return accountsWithUsers;
    },
  });

  // 승인 mutation
  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/helper-bank-accounts/${id}/verify`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/helper-bank-accounts'] });
      toast({ title: '승인 완료', description: '계좌 정보가 승인되었습니다', variant: 'success' });
      setShowReviewDialog(false);
      setSelectedAccount(null);
    },
    onError: () => {
      toast({ title: '오류', description: '승인 처리에 실패했습니다', variant: 'error' });
    },
  });

  // 반려 mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return apiRequest(`/helper-bank-accounts/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/helper-bank-accounts'] });
      toast({ title: '반려 완료', description: '계좌 정보가 반려되었습니다', variant: 'success' });
      setShowReviewDialog(false);
      setSelectedAccount(null);
    },
    onError: () => {
      toast({ title: '오류', description: '반려 처리에 실패했습니다', variant: 'error' });
    },
  });

  const handleReviewSubmit = () => {
    if (!selectedAccount) return;

    if (reviewAction === 'verify') {
      verifyMutation.mutate(selectedAccount.id);
    } else {
      if (!rejectionReason.trim()) {
        toast({ title: '알림', description: '반려 사유를 입력해주세요', variant: 'warning' });
        return;
      }
      rejectMutation.mutate({
        id: selectedAccount.id,
        reason: rejectionReason,
      });
    }
  };

  const openReviewDialog = (account: BankAccountWithUser, action: 'verify' | 'reject') => {
    setSelectedAccount(account);
    setReviewAction(action);
    setRejectionReason('');
    setShowReviewDialog(true);
  };

  // 상세보기 열기
  const openDetailDialog = async (account: BankAccountWithUser) => {
    setDetailAccount(account);
    setDetailImageUrl(null);
    setShowDetailDialog(true);

    // 통장사본 이미지가 있으면 토큰과 함께 가져오기
    if (account.bankbookImageUrl) {
      try {
        const headers = getAuthHeaders();
        const response = await fetch(account.bankbookImageUrl, { headers });
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setDetailImageUrl(url);
        }
      } catch (err) {
        console.error('Image load error:', err);
      }
    }
  };

  // 필터링된 계좌
  const filteredAccounts = accounts.filter(account => {
    if (filters.status !== 'all' && account.verificationStatus !== filters.status) {
      return false;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        account.user.name.toLowerCase().includes(searchLower) ||
        account.user.email.toLowerCase().includes(searchLower) ||
        account.accountHolder.toLowerCase().includes(searchLower) ||
        account.accountNumber.includes(searchLower) ||
        account.bankName.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // 통계
  const stats = {
    total: accounts.length,
    pending: accounts.filter(a => a.verificationStatus === 'pending').length,
    verified: accounts.filter(a => a.verificationStatus === 'verified').length,
    rejected: accounts.filter(a => a.verificationStatus === 'rejected').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">수수료 통장 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          헬퍼의 정산 계좌 정보를 검토하고 승인합니다
        </p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">전체</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="border rounded-lg p-4 bg-yellow-50">
          <p className="text-sm text-yellow-700">검토대기</p>
          <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
        </div>
        <div className="border rounded-lg p-4 bg-green-50">
          <p className="text-sm text-green-700">승인완료</p>
          <p className="text-2xl font-bold text-green-800">{stats.verified}</p>
        </div>
        <div className="border rounded-lg p-4 bg-red-50">
          <p className="text-sm text-red-700">반려됨</p>
          <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="헬퍼명, 이메일, 예금주, 계좌번호, 은행명 검색..."
            className="pl-10"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        <div className="w-48">
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="pending">검토대기</SelectItem>
              <SelectItem value="verified">승인완료</SelectItem>
              <SelectItem value="rejected">반려됨</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 계좌 목록 */}
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">헬퍼</th>
              <th className="px-4 py-3 text-left text-sm font-medium">예금주</th>
              <th className="px-4 py-3 text-left text-sm font-medium">은행명</th>
              <th className="px-4 py-3 text-left text-sm font-medium">계좌번호</th>
              <th className="px-4 py-3 text-left text-sm font-medium">통장사본</th>
              <th className="px-4 py-3 text-left text-sm font-medium">상태</th>
              <th className="px-4 py-3 text-left text-sm font-medium">등록일</th>
              <th className="px-4 py-3 text-right text-sm font-medium">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  계좌 정보가 없습니다
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => {
                const StatusIcon = STATUS_CONFIG[account.verificationStatus].icon;
                return (
                  <tr key={account.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{account.user.name}</p>
                        <p className="text-xs text-muted-foreground">{account.user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{account.accountHolder}</td>
                    <td className="px-4 py-3">{account.bankName}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{account.accountNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      {account.bankbookImageUrl ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">있음</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-500">없음</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_CONFIG[account.verificationStatus].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {STATUS_CONFIG[account.verificationStatus].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {format(new Date(account.createdAt), 'yyyy-MM-dd', { locale: ko })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailDialog(account)}
                        >
                          <Info className="h-4 w-4 mr-1" />
                          상세
                        </Button>
                        {account.verificationStatus === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openReviewDialog(account, 'verify')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              승인
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openReviewDialog(account, 'reject')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              반려
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 상세 다이얼로그 */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => {
        setShowDetailDialog(open);
        if (!open && detailImageUrl) {
          URL.revokeObjectURL(detailImageUrl);
          setDetailImageUrl(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>계좌 정보 상세</DialogTitle>
          </DialogHeader>

          {detailAccount && (
            <div className="space-y-4">
              {/* 헬퍼 정보 */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">헬퍼명</p>
                  <p className="font-medium">{detailAccount.user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">이메일</p>
                  <p className="text-sm">{detailAccount.user.email}</p>
                </div>
                {detailAccount.user.phoneNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">전화번호</p>
                    <p className="text-sm">{detailAccount.user.phoneNumber}</p>
                  </div>
                )}
              </div>

              {/* 상태 배지 */}
              <div className="flex items-center gap-2">
                <Badge className={STATUS_CONFIG[detailAccount.verificationStatus].color}>
                  {(() => {
                    const StatusIcon = STATUS_CONFIG[detailAccount.verificationStatus].icon;
                    return <StatusIcon className="h-4 w-4 mr-1" />;
                  })()}
                  {STATUS_CONFIG[detailAccount.verificationStatus].label}
                </Badge>
                {detailAccount.createdAt && (
                  <span className="text-sm text-muted-foreground ml-auto">
                    등록: {format(new Date(detailAccount.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                  </span>
                )}
              </div>

              {/* 계좌 정보 */}
              <div>
                <p className="text-sm font-medium mb-2">계좌 정보</p>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">예금주</p>
                    <p className="text-sm font-medium">{detailAccount.accountHolder}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">은행명</p>
                    <p className="text-sm font-medium">{detailAccount.bankName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">계좌번호</p>
                    <p className="text-sm font-mono font-medium">{detailAccount.accountNumber}</p>
                  </div>
                </div>
              </div>

              {/* 통장사본 이미지 */}
              {detailAccount.bankbookImageUrl && (
                <div>
                  <p className="text-sm font-medium mb-2">통장사본</p>
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    {detailImageUrl ? (
                      <img
                        src={detailImageUrl}
                        alt="통장사본"
                        className="w-full max-h-[500px] object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground">
                        이미지 로딩중...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {detailAccount && detailAccount.verificationStatus === 'pending' && (
              <>
                <Button
                  variant="default"
                  onClick={() => {
                    setShowDetailDialog(false);
                    openReviewDialog(detailAccount, 'verify');
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  승인
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDetailDialog(false);
                    openReviewDialog(detailAccount, 'reject');
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  반려
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 검토 다이얼로그 */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'verify' ? '계좌 승인' : '계좌 반려'}
            </DialogTitle>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">헬퍼</p>
                <p className="font-medium">{selectedAccount.user.name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">계좌 정보</p>
                <p className="font-medium">
                  {selectedAccount.bankName} / {selectedAccount.accountNumber} / {selectedAccount.accountHolder}
                </p>
              </div>

              {reviewAction === 'reject' && (
                <div>
                  <Label htmlFor="rejection-reason">반려 사유 *</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="반려 사유를 입력하세요 (예: 계좌번호 불일치, 예금주명 불일치 등)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={verifyMutation.isPending || rejectMutation.isPending}
              variant={reviewAction === 'verify' ? 'default' : 'destructive'}
            >
              {verifyMutation.isPending || rejectMutation.isPending ? '처리중...' :
                reviewAction === 'verify' ? '승인' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
