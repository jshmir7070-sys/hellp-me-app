import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

interface HelperStat {
  helperId: string;
  helperName: string;
  orderCount: number;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  totalSupplyAmount: number;
  totalVatAmount: number;
  totalAmount: number;
  commissionAmount: number;
  deductionAmount: number;
  netPayout: number;
}

interface MonthlyTrend {
  month: number;
  orderCount: number;
  totalAmount: number;
  commissionAmount: number;
  deductionAmount: number;
  netPayout: number;
}

interface IncidentByType {
  count: number;
  amount: number;
}

interface StatsData {
  year: number;
  month: number | null;
  totals: {
    orderCount: number;
    deliveredCount: number;
    returnedCount: number;
    etcCount: number;
    totalSupplyAmount: number;
    totalVatAmount: number;
    totalAmount: number;
    commissionAmount: number;
    deductionAmount: number;
    netPayout: number;
  };
  helperStats: HelperStat[];
  monthlyTrend: MonthlyTrend[];
  urgentStats: { count: number; rate: number };
  incidentStats: {
    total: number;
    confirmed: number;
    totalDeductionAmount: number;
    byType: Record<string, IncidentByType>;
  };
}

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  damage: '파손',
  loss: '분실',
  misdelivery: '오배송',
  delay: '지연',
  other: '기타',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

export default function SettlementStatsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(null);

  const queryParams = month ? `year=${year}&month=${month}` : `year=${year}`;

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['settlement-stats', year, month],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/dashboard/settlement-stats?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const trendData = (data?.monthlyTrend || []).map(t => ({
    name: MONTHS[t.month - 1],
    총액: t.totalAmount,
    수수료: t.commissionAmount,
    차감: t.deductionAmount,
    지급액: t.netPayout,
    오더수: t.orderCount,
  }));

  const incidentPieData = data?.incidentStats?.byType
    ? Object.entries(data.incidentStats.byType).map(([type, val]) => ({
        name: INCIDENT_TYPE_LABELS[type] || type,
        value: val.count,
        amount: val.amount,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">정산 통계</h1>
          <p className="text-muted-foreground">헬퍼 수익, 업무 실적, 사고 차감 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={month ?? ''}
            onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : data ? (
        <>
          {/* 전체 요약 카드 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="총 오더" value={`${data.totals.orderCount}건`} color="text-blue-600" />
            <SummaryCard label="총액 (VAT포함)" value={formatCurrency(data.totals.totalAmount)} color="text-gray-900" />
            <SummaryCard label="플랫폼 수수료" value={formatCurrency(data.totals.commissionAmount)} color="text-amber-600" />
            <SummaryCard label="사고 차감" value={formatCurrency(data.totals.deductionAmount)} color="text-red-600" />
            <SummaryCard label="헬퍼 지급 합계" value={formatCurrency(data.totals.netPayout)} color="text-green-600" />
          </div>

          {/* 실적 요약 */}
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="배송 건수" value={`${data.totals.deliveredCount.toLocaleString()}건`} color="text-blue-600" />
            <SummaryCard label="반품 건수" value={`${data.totals.returnedCount.toLocaleString()}건`} color="text-orange-600" />
            <SummaryCard label="기타 건수" value={`${data.totals.etcCount.toLocaleString()}건`} color="text-purple-600" />
            <SummaryCard label="긴급 오더" value={`${data.urgentStats.count}건 (${data.urgentStats.rate}%)`} color="text-red-600" />
          </div>

          {/* 월별 추이 차트 */}
          {!month && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">월별 정산 추이 ({year}년)</h2>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="총액" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="수수료" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="차감" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="지급액" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 사고 유형별 통계 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">사고 현황</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{data.incidentStats.total}</div>
                  <div className="text-sm text-gray-500">전체 사고</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{data.incidentStats.confirmed}</div>
                  <div className="text-sm text-gray-500">차감 확정</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(data.incidentStats.totalDeductionAmount)}</div>
                  <div className="text-sm text-gray-500">총 차감액</div>
                </div>
              </div>
              {incidentPieData.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incidentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {incidentPieData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value}건`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400">사고 내역 없음</div>
              )}
            </div>

            {/* 월별 오더 수 추이 */}
            {!month && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">월별 오더 건수</h2>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [`${value}건`, '오더']} />
                      <Bar dataKey="오더수" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* 헬퍼별 실적 테이블 */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">
              헬퍼별 실적 ({data.helperStats.length}명)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-3 font-medium">헬퍼</th>
                    <th className="text-right py-3 px-3 font-medium">오더</th>
                    <th className="text-right py-3 px-3 font-medium">배송</th>
                    <th className="text-right py-3 px-3 font-medium">반품</th>
                    <th className="text-right py-3 px-3 font-medium">기타</th>
                    <th className="text-right py-3 px-3 font-medium">공급가</th>
                    <th className="text-right py-3 px-3 font-medium">총액</th>
                    <th className="text-right py-3 px-3 font-medium text-amber-600">수수료</th>
                    <th className="text-right py-3 px-3 font-medium text-red-600">차감</th>
                    <th className="text-right py-3 px-3 font-medium text-green-600">지급액</th>
                  </tr>
                </thead>
                <tbody>
                  {data.helperStats.map((h, idx) => (
                    <tr key={h.helperId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-3 font-medium">{h.helperName}</td>
                      <td className="py-2 px-3 text-right">{h.orderCount}</td>
                      <td className="py-2 px-3 text-right">{h.deliveredCount.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{h.returnedCount.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{h.etcCount.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(h.totalSupplyAmount)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(h.totalAmount)}</td>
                      <td className="py-2 px-3 text-right text-amber-600">-{formatCurrency(h.commissionAmount)}</td>
                      <td className="py-2 px-3 text-right text-red-600">
                        {h.deductionAmount > 0 ? `-${formatCurrency(h.deductionAmount)}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-green-600 font-bold">{formatCurrency(h.netPayout)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold bg-gray-100">
                    <td className="py-3 px-3">합계</td>
                    <td className="py-3 px-3 text-right">{data.totals.orderCount}</td>
                    <td className="py-3 px-3 text-right">{data.totals.deliveredCount.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">{data.totals.returnedCount.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">{data.totals.etcCount.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(data.totals.totalSupplyAmount)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(data.totals.totalAmount)}</td>
                    <td className="py-3 px-3 text-right text-amber-600">-{formatCurrency(data.totals.commissionAmount)}</td>
                    <td className="py-3 px-3 text-right text-red-600">
                      {data.totals.deductionAmount > 0 ? `-${formatCurrency(data.totals.deductionAmount)}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right text-green-600">{formatCurrency(data.totals.netPayout)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
