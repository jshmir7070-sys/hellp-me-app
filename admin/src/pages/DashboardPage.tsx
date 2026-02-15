import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminFetch } from '@/lib/api';
import { Package, UserPlus, Users, AlertTriangle, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  
  const { data: chartData, isLoading } = useQuery<ChartData>({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/dashboard/charts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: '실시간 오더',
      icon: <Package className="h-5 w-5 text-blue-500" />,
      value: chartData?.realtime.activeOrders || 0,
      description: '진행중인 오더',
      href: '/orders',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      title: '신규 헬퍼',
      icon: <UserPlus className="h-5 w-5 text-green-500" />,
      value: chartData?.realtime.newHelpers || 0,
      description: '최근 7일',
      href: '/users?role=helper',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      title: '신규 회원',
      icon: <Users className="h-5 w-5 text-purple-500" />,
      value: chartData?.realtime.newMembers || 0,
      description: '최근 7일',
      href: '/users',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      title: '이의제기',
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
      value: chartData?.realtime.openDisputes || 0,
      description: '처리 대기중',
      href: '/disputes',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
  ];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">대시보드</h1>
        <p className="text-muted-foreground">Hellp Me 운영 현황을 확인하세요</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className={`cursor-pointer hover:shadow-md transition-shadow ${stat.bgColor} ${stat.borderColor} border`}
            onClick={() => navigate(stat.href)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">{stat.title}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>일별 오더 현황</CardTitle>
            <div className={`flex items-center gap-1 text-sm ${dailyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dailyGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{dailyGrowth >= 0 ? '+' : ''}{dailyGrowth}%</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData?.dailyOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => [`${value}건`, '오더']}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>월별 오더 추이</CardTitle>
            <div className={`flex items-center gap-1 text-sm ${monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthlyGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{monthlyGrowth >= 0 ? '+' : ''}{monthlyGrowth}%</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData?.monthlyOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => [`${value}건`, '오더']}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 오더 비율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData?.categoryData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(chartData?.categoryData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => [`${value}건`, '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>택배사별 오더 비율 (상위 10개)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData?.courierData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    label={({ name, percent }: { name?: string; percent?: number }) => (percent || 0) > 0.05 ? `${(name || '').slice(0, 6)}` : ''}
                    labelLine={false}
                  >
                    {(chartData?.courierData || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COURIER_COLORS[index % COURIER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value, name) => [`${value}건`, name]}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
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
