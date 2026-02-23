import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Package, UserPlus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Order {
  id: number;
  status: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupCity?: string;
  deliveryCity?: string;
  deliveryArea?: string;
  companyName?: string;
  totalAmount?: number;
  matchedHelperId?: string;
  helperName?: string;
  createdAt: string;
  scheduledDate?: string;
  cargo?: string;
  vehicleType?: string;
}

interface TeamMember {
  id: number;
  helperId: string;
  isActive: boolean;
  user: { id: string; name: string; phone: string };
}

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'matching', label: '매칭중' },
  { value: 'scheduled', label: '배정완료' },
  { value: 'in_progress', label: '진행중' },
  { value: 'closing_submitted', label: '마감제출' },
  { value: 'closed', label: '완료' },
];

const STATUS_LABELS: Record<string, string> = {
  awaiting_deposit: '입금대기',
  deposit_paid: '입금완료',
  matching: '매칭중',
  scheduled: '배정완료',
  in_progress: '진행중',
  closing_submitted: '마감제출',
  final_amount_confirmed: '최종확인',
  balance_paid: '잔금완료',
  settlement_paid: '정산완료',
  settled: '정산완료',
  closed: '완료',
  cancelled: '취소',
  refunded: '환불',
};

const STATUS_COLORS: Record<string, string> = {
  matching: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  closing_submitted: 'bg-purple-100 text-purple-800',
  closed: 'bg-green-100 text-green-800',
  settled: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Assign dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignOrderId, setAssignOrderId] = useState<number | null>(null);
  const [selectedHelperId, setSelectedHelperId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, page]);

  const loadMembers = async () => {
    try {
      const result = await apiRequest<{ members: TeamMember[] }>('/members');
      setMembers(result.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const result = await apiRequest<{
        orders: Order[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/orders?${params.toString()}`);

      setOrders(result.orders);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignOrderId || !selectedHelperId) return;
    setAssigning(true);
    try {
      await apiRequest(`/orders/${assignOrderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ helperId: selectedHelperId }),
      });
      setShowAssignDialog(false);
      setAssignOrderId(null);
      setSelectedHelperId('');
      loadOrders();
    } catch (err: any) {
      alert(err.message || '배정에 실패했습니다');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">오더현황</h1>
        <p className="text-sm text-muted-foreground mt-1">팀 오더 목록 및 관리</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">오더번호</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">상태</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">회사명</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">배송지역</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">배정헬퍼</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">차종</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">등록일</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">작업</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    오더가 없습니다
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">#{order.id}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs truncate max-w-[150px]">{order.companyName || '-'}</td>
                    <td className="px-4 py-3 text-xs truncate max-w-[150px]">{order.deliveryArea || '-'}</td>
                    <td className="px-4 py-3 text-xs">{order.helperName || '-'}</td>
                    <td className="px-4 py-3 text-xs">{order.vehicleType || '-'}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      {order.status === 'matching' && (
                        <button
                          onClick={() => {
                            setAssignOrderId(order.id);
                            setShowAssignDialog(true);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                        >
                          <UserPlus className="h-3 w-3" />
                          배정
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              총 {total}건 (페이지 {page}/{totalPages})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-muted disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-muted disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assign Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">팀원 배정</h3>
            <p className="text-sm text-muted-foreground mb-4">
              오더 #{assignOrderId}에 배정할 팀원을 선택하세요
            </p>
            <select
              value={selectedHelperId}
              onChange={(e) => setSelectedHelperId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background mb-4"
            >
              <option value="">팀원 선택</option>
              {members.filter(m => m.isActive).map((m) => (
                <option key={m.helperId} value={m.helperId}>
                  {m.user.name} ({m.user.phone})
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAssignDialog(false); setSelectedHelperId(''); }}
                className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
              >
                취소
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedHelperId || assigning}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {assigning ? '배정 중...' : '배정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
