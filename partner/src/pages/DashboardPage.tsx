import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Package, Users, Wallet, TrendingUp } from 'lucide-react';

interface DashboardData {
  teamName: string;
  memberCount: number;
  activeOrderCount: number;
  monthlySettlement: number;
  currentMonth: string;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardPage() {
  const { team } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await apiRequest<DashboardData>('/dashboard');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        {error}
      </div>
    );
  }

  const cards = [
    {
      title: '활성 오더',
      value: data?.activeOrderCount || 0,
      icon: <Package className="h-5 w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '팀원 수',
      value: data?.memberCount || 0,
      icon: <Users className="h-5 w-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: '월간 정산',
      value: formatCurrency(data?.monthlySettlement || 0),
      icon: <Wallet className="h-5 w-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: '수수료율',
      value: `${team?.commissionRate || 0}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{team?.name || '파트너'} 대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.currentMonth} 기준
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-card border rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{card.title}</span>
              <div className={cn(card.bgColor, "p-2 rounded-md")}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">최근 활동</h2>
        <p className="text-sm text-muted-foreground">
          아직 표시할 활동이 없습니다. 오더현황 및 팀원관리 페이지에서 팀을 관리하세요.
        </p>
      </div>
    </div>
  );
}
