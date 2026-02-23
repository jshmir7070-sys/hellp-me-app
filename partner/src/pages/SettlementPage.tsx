import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Wallet, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';

interface Settlement {
  id: number;
  helperId: string;
  helperName: string;
  orderId: number;
  period: string;
  totalContractAmount: number;
  helperPayout: number;
  commissionRate: number;
  commissionAmount: number;
  platformCommission: number;
  status: string;
  createdAt: string;
}

interface SettlementSummary {
  totalAmount: number;
  totalCommission: number;
  totalPayout: number;
  platformCommission: number;
}

interface TeamIncentive {
  id: number;
  period: string;
  totalFees: number;
  incentiveRate: number;
  incentiveAmount: number;
  status: string;
}

interface MonthlySummary {
  month: string;
  totalAmount: number;
  totalCommission: number;
  count: number;
}

const SETTLEMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: '확인', color: 'bg-blue-100 text-blue-800' },
  paid: { label: '지급완료', color: 'bg-green-100 text-green-800' },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-800' },
};

export default function SettlementPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [teamIncentive, setTeamIncentive] = useState<TeamIncentive | null>(null);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [month, setMonth] = useState('');
  const [teamCommissionRate, setTeamCommissionRate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (month) {
      loadSettlements();
    }
  }, [month]);

  useEffect(() => {
    loadMonthlySummaries();
  }, []);

  const loadSettlements = async () => {
    setIsLoading(true);
    try {
      const result = await apiRequest<{
        settlements: Settlement[];
        summary: SettlementSummary;
        teamIncentive: TeamIncentive | null;
        month: string;
        teamCommissionRate: number;
      }>(`/settlements?month=${month}`);
      setSettlements(result.settlements);
      setSummary(result.summary);
      setTeamIncentive(result.teamIncentive);
      setTeamCommissionRate(result.teamCommissionRate);
    } catch (err) {
      console.error('Failed to load settlements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthlySummaries = async () => {
    try {
      const result = await apiRequest<{ monthlySummaries: MonthlySummary[] }>('/settlements/summary');
      setMonthlySummaries(result.monthlySummaries);
    } catch (err) {
      console.error('Failed to load monthly summaries:', err);
    }
  };

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return `${y}년 ${parseInt(mo)}월`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">팀정산</h1>
        <p className="text-sm text-muted-foreground mt-1">
          팀원별 정산 현황 조회 (수수료율: {teamCommissionRate}%)
        </p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-muted rounded-md">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-semibold">{formatMonth(month)}</span>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-muted rounded-md">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">총 계약금액</p>
            <p className="text-xl font-bold">{formatCurrency(summary.totalAmount)}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">총 수수료</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(summary.totalCommission)}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">헬퍼 지급액</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalPayout)}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">팀장 인센티브</p>
            <p className="text-xl font-bold text-purple-600">
              {teamIncentive ? formatCurrency(teamIncentive.incentiveAmount) : '-'}
            </p>
            {teamIncentive && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                teamIncentive.status === 'paid' ? 'bg-green-100 text-green-800' :
                teamIncentive.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {teamIncentive.status === 'paid' ? '지급완료' : teamIncentive.status === 'approved' ? '승인완료' : '산출완료'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Settlements table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            팀원별 정산 내역
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">헬퍼</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">오더</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">계약금액</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">수수료율</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">수수료</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">지급액</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">상태</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">날짜</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    해당 월의 정산 내역이 없습니다
                  </td>
                </tr>
              ) : (
                settlements.map((s) => {
                  const statusInfo = SETTLEMENT_STATUS[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-800' };
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs font-medium">{s.helperName}</td>
                      <td className="px-4 py-3 text-xs font-mono">#{s.orderId}</td>
                      <td className="px-4 py-3 text-xs text-right">{formatCurrency(s.totalContractAmount || 0)}</td>
                      <td className="px-4 py-3 text-xs text-right">{s.commissionRate || 0}%</td>
                      <td className="px-4 py-3 text-xs text-right text-orange-600">{formatCurrency(s.commissionAmount || 0)}</td>
                      <td className="px-4 py-3 text-xs text-right text-green-600 font-medium">{formatCurrency(s.helperPayout || 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{formatDate(s.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly trend */}
      {monthlySummaries.length > 0 && (
        <div className="bg-card border rounded-lg p-4 mt-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4" />
            월별 추이 (최근 6개월)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {monthlySummaries.map((ms) => (
              <div key={ms.month} className="text-center p-3 bg-muted/30 rounded-md">
                <p className="text-xs text-muted-foreground">{formatMonth(ms.month)}</p>
                <p className="text-sm font-bold mt-1">{formatCurrency(ms.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">{ms.count}건</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
