/**
 * Dashboard Page - 재설계 버전
 * 운영 현황 대시보드
 *
 * 개선사항:
 * - PageHeader 컴포넌트 적용
 * - StatsGrid 및 StatsCard로 통계 카드 표준화
 * - 차트 레이아웃 개선
 * - 새로고침 기능 추가
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, StatsCard, StatsGrid } from '@/components/ui/page-header';
import { adminFetch } from '@/lib/api';
import {
  Package,
  UserPlus,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChartData {
  dailyOrders: { date: string; count: number }[];
  monthlyOrders: { month: string; count: number }[];
  categoryData: { name: string; value: number; color: string }[];
  courierData: { name: string; count: number }[];
  realtime: {
    activeOrders: number;
    newHelpers: number;
    newMembers: number;
    openDisputes: number;
  };
}

const COURIER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: chartData, isLoading, refetch } = useQuery<ChartData>({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/dashboard/charts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    },
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
    toast({ title: '대시보드를 새로고침했습니다.' });
  };

  // Calculate growth rates
  const dailyGrowth = chartData?.dailyOrders && chartData.dailyOrders.length >= 2
    ? (() => {
        const today = chartData.dailyOrders[chartData.dailyOrders.length - 1]?.count || 0;
        const yesterday = chartData.dailyOrders[chartData.dailyOrders.length - 2]?.count || 0;
        if (yesterday === 0) return today > 0 ? 100 : 0;
        return Math.round(((today - yesterday) / yesterday) * 100);
      })()
    : 0;

  const monthlyGrowth = chartData?.monthlyOrders && chartData.monthlyOrders.length >= 2
    ? (() => {
        const thisMonth = chartData.monthlyOrders[chartData.monthlyOrders.length - 1]?.count || 0;
        const lastMonth = chartData.monthlyOrders[chartData.monthlyOrders.length - 2]?.count || 0;
        if (lastMonth === 0) return thisMonth > 0 ? 100 : 0;
        return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
      })()
    : 0;

  // Stat cards configuration
  const statCards = [
    {
      title: '실시간 오더',
      icon: <Package className="h-5 w-5 text-blue-500" />,
      value: chartData?.realtime.activeOrders || 0,
      description: '진행중인 오더',
      href: '/orders',
      variant: 'primary' as const,
      trend: dailyGrowth !== 0 ? { value: dailyGrowth, isPositive: dailyGrowth > 0 } : undefined,
    },
    {
      title: '신규 헬퍼',
      icon: <UserPlus className="h-5 w-5 text-green-500" />,
      value: chartData?.realtime.newHelpers || 0,
      description: '최근 7일',
      href: '/users?role=helper',
      variant: 'success' as const,
    },
    {
      title: '신규 회원',
      icon: <Users className="h-5 w-5 text-purple-500" />,
      value: chartData?.realtime.newMembers || 0,
      description: '최근 7일',
      href: '/users',
      variant: 'default' as const,
    },
    {
      title: '이의제기',
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
      value: chartData?.realtime.openDisputes || 0,
      description: '처리 대기중',
      href: '/disputes',
      variant: (chartData?.realtime.openDisputes || 0) > 0 ? 'warning' as const : 'default' as const,
    },
  ];

  // Loading state
  if (isLoading && !chartData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="대시보드"
        description="Hellp Me 운영 현황을 확인하세요 • 1분마다 자동 새로고침"
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            새로고침
          </Button>
        }
      />

      {/* Stats Grid */}
      <StatsGrid>
        {statCards.map((stat) => (
          <div
            key={stat.title}
            onClick={() => navigate(stat.href)}
            className="cursor-pointer transition-transform hover:scale-105"
          >
            <StatsCard
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              variant={stat.variant}
              trend={stat.trend}
            />
          </div>
        ))}
      </StatsGrid>

      {/* Daily & Monthly Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <CardTitle>일별 오더 현황</CardTitle>
            </div>
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md",
              dailyGrowth >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
            )}>
              {dailyGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{dailyGrowth >= 0 ? '+' : ''}{dailyGrowth}%</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData?.dailyOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value) => [`${value}건`, '오더']}
                  />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-500" />
              <CardTitle>월별 오더 추이</CardTitle>
            </div>
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md",
              monthlyGrowth >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
            )}>
              {monthlyGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{monthlyGrowth >= 0 ? '+' : ''}{monthlyGrowth}%</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData?.monthlyOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value) => [`${value}건`, '오더']}
                  />
                  <Bar
                    dataKey="count"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category & Courier Distribution Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-purple-500" />
              <CardTitle>카테고리별 오더 비율</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData?.categoryData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent || 0) > 0.05 ? `${name || ''} ${((percent || 0) * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {(chartData?.categoryData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value) => [`${value}건`, '']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-orange-500" />
              <CardTitle>택배사별 오더 비율 (상위 10개)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData?.courierData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="count"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent || 0) > 0.05 ? `${(name || '').slice(0, 6)}` : ''
                    }
                    labelLine={false}
                  >
                    {(chartData?.courierData || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COURIER_COLORS[index % COURIER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value, name) => [`${value}건`, name]}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    formatter={(value) => value.length > 10 ? value.slice(0, 10) + '...' : value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
