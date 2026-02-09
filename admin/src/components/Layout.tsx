import { ReactNode, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTabs } from '@/contexts/TabContext';
import { useToast } from '@/hooks/use-toast';
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket';
import { useMenuBadges } from '@/hooks/useMenuBadges';
import { MENU_KEYS, PERMISSIONS } from '@/constants/permissions';
import TabBar from './TabBar';
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  Wallet,
  Users,
  Truck,
  DollarSign,
  AlertTriangle,
  MessageSquare,
  Bell,
  LogOut,
  Menu,
  X,
  Lock,
  ChevronDown,
  ChevronRight,
  UserPlus,
  List,
  CreditCard,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  permission?: string;
  badge?: number;
}

interface NavGroup {
  title: string;
  icon?: ReactNode;
  items: NavItem[];
  collapsible?: boolean;
  menuKey?: string; // 메뉴 그룹 접근 권한 키 (menu.orders, menu.settlements 등)
}

/**
 * 배지 카운트를 포함한 네비게이션 그룹 생성 함수
 */
const createNavGroups = (badges: ReturnType<typeof useMenuBadges>): NavGroup[] => [
  {
    title: '운영',
    items: [
      { href: '/', label: '대시보드', icon: <LayoutDashboard className="h-5 w-5" />, permission: PERMISSIONS.DASHBOARD_VIEW },
      { href: '/task-queue', label: '업무 대기함', icon: <Clock className="h-5 w-5" />, permission: PERMISSIONS.TASK_QUEUE_VIEW, badge: badges.taskQueue },
    ],
  },
  {
    title: '오더운영',
    icon: <Package className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.ORDERS,
    items: [
      { href: '/orders', label: '실시간오더관리', icon: <Package className="h-5 w-5" />, permission: PERMISSIONS.ORDERS_VIEW, badge: badges.orders },
      { href: '/closings', label: '오더마감자료', icon: <ClipboardCheck className="h-5 w-5" />, permission: PERMISSIONS.CLOSINGS_VIEW, badge: badges.closings },
    ],
  },
  {
    title: '결제및환불',
    icon: <CreditCard className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.PAYMENTS,
    items: [
      { href: '/payments/deposit', label: '계약금결제', icon: <CreditCard className="h-5 w-5" />, permission: PERMISSIONS.PAYMENTS_VIEW, badge: badges.paymentsDeposit },
      { href: '/payments/balance', label: '잔금결제', icon: <CreditCard className="h-5 w-5" />, permission: PERMISSIONS.PAYMENTS_VIEW, badge: badges.paymentsBalance },
      { href: '/refunds', label: '환불', icon: <RotateCcw className="h-5 w-5" />, permission: PERMISSIONS.REFUNDS_VIEW, badge: badges.refunds },
    ],
  },
  {
    title: '정산',
    icon: <Wallet className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.SETTLEMENTS,
    items: [
      { href: '/settlements/daily', label: '일정산', icon: <ClipboardCheck className="h-5 w-5" />, permission: PERMISSIONS.SETTLEMENTS_VIEW, badge: badges.settlementDaily },
      { href: '/settlements/helper', label: '헬퍼정산', icon: <Wallet className="h-5 w-5" />, permission: PERMISSIONS.SETTLEMENTS_VIEW, badge: badges.settlementHelper },
      { href: '/settlements/requester', label: '요청자정산', icon: <Users className="h-5 w-5" />, permission: PERMISSIONS.SETTLEMENTS_VIEW, badge: badges.settlementRequester },
    ],
  },
  {
    title: '헬퍼 관리',
    icon: <Truck className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.HELPERS,
    items: [
      { href: '/helpers/pending', label: '신규 헬퍼 승인', icon: <UserPlus className="h-5 w-5" />, permission: PERMISSIONS.HELPERS_VIEW, badge: badges.helpersPending },
      { href: '/helpers', label: '헬퍼 목록', icon: <List className="h-5 w-5" />, permission: PERMISSIONS.HELPERS_VIEW },
    ],
  },
  {
    title: '요청자 관리',
    icon: <Users className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.REQUESTERS,
    items: [
      { href: '/requesters/pending', label: '신규 회원', icon: <UserPlus className="h-5 w-5" />, permission: PERMISSIONS.REQUESTERS_VIEW, badge: badges.requestersPending },
      { href: '/requesters', label: '요청자 목록', icon: <List className="h-5 w-5" />, permission: PERMISSIONS.REQUESTERS_VIEW },
    ],
  },
  {
    title: '운임/정책',
    icon: <DollarSign className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.RATES,
    items: [
      { href: '/rates', label: '운임설정', icon: <DollarSign className="h-5 w-5" />, permission: PERMISSIONS.RATES_UPDATE },
      { href: '/refund-policy', label: '환불정책', icon: <AlertTriangle className="h-5 w-5" />, permission: PERMISSIONS.REFUND_POLICY_UPDATE },
    ],
  },
  {
    title: '이의제기/사고',
    icon: <AlertTriangle className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.DISPUTES,
    items: [
      { href: '/disputes', label: '이의제기관리', icon: <MessageSquare className="h-5 w-5" />, permission: PERMISSIONS.DISPUTES_VIEW, badge: badges.disputes },
      { href: '/incidents', label: '화물사고접수', icon: <AlertTriangle className="h-5 w-5" />, permission: PERMISSIONS.INCIDENTS_VIEW, badge: badges.incidents },
      { href: '/deductions', label: '화물사고차감', icon: <DollarSign className="h-5 w-5" />, permission: PERMISSIONS.DEDUCTIONS_VIEW, badge: badges.deductions },
      { href: '/incident-refunds', label: '화물사고환불', icon: <RotateCcw className="h-5 w-5" />, permission: PERMISSIONS.REFUNDS_VIEW, badge: badges.incidentRefunds },
    ],
  },
  {
    title: 'CS',
    icon: <Headphones className="h-4 w-4" />,
    collapsible: true,
    menuKey: MENU_KEYS.CS,
    items: [
      { href: '/cs', label: 'CS 문의', icon: <MessageSquare className="h-5 w-5" />, permission: PERMISSIONS.CS_VIEW, badge: badges.cs },
    ],
  },
  {
    title: '설정',
    menuKey: MENU_KEYS.SETTINGS,
    items: [
      { href: '/notifications', label: '공지/알림', icon: <Bell className="h-5 w-5" />, permission: PERMISSIONS.NOTIFICATIONS_VIEW },
      { href: '/audit-logs', label: '감사 로그', icon: <ClipboardCheck className="h-5 w-5" />, permission: PERMISSIONS.AUDIT_LOGS_VIEW },
      { href: '/admin-users', label: '직원/권한 관리', icon: <Lock className="h-5 w-5" />, permission: PERMISSIONS.STAFF_VIEW },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, hasPermission } = useAuth();
  const { openTab } = useTabs();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // WebSocket 실시간 연결
  const { isConnected } = useAdminWebSocket();

  // 메뉴 배지 카운트
  const badges = useMenuBadges();

  // 배지 카운트를 포함한 네비게이션 그룹 생성
  const navGroups = useMemo(() => createNavGroups(badges), [badges]);

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'SUPER_ADMIN';
  const userMenuPermissions: string[] = (user as any)?.menuPermissions || [];

  // 메뉴 그룹 접근 권한 체크
  const hasMenuAccess = (group: NavGroup) => {
    // 슈퍼관리자는 모든 메뉴 접근 가능
    if (isSuperAdmin) return true;
    // menuKey가 없으면 항상 표시 (운영 메뉴 등)
    if (!group.menuKey) return true;
    // 사용자에게 해당 메뉴 권한이 있는지 확인
    return userMenuPermissions.includes(group.menuKey);
  };

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => {
      const isCurrentlyCollapsed = prev[title];

      // 아코디언 방식: 다른 모든 그룹을 닫고, 현재 그룹만 토글
      const newState: Record<string, boolean> = {};

      // 모든 collapsible 그룹을 찾아서 닫기
      navGroups.forEach(group => {
        if (group.collapsible) {
          newState[group.title] = true; // 모두 닫기
        }
      });

      // 현재 클릭한 그룹만 토글 (닫혀있었으면 열고, 열려있었으면 닫기)
      newState[title] = !isCurrentlyCollapsed;

      return newState;
    });
  };

  const handleNavClick = useCallback((item: NavItem) => {
    setSidebarOpen(false);

    // 소메뉴를 클릭했을 때 해당 메뉴 그룹 자동 닫기
    const parentGroup = navGroups.find(group =>
      group.items.some(navItem => navItem.href === item.href)
    );
    if (parentGroup && parentGroup.collapsible) {
      setCollapsedGroups(prev => ({ ...prev, [parentGroup.title]: true }));
    }

    const tabId = item.href === '/' ? 'dashboard' : item.href.replace(/\//g, '-').replace(/^-/, '');
    openTab({
      id: tabId,
      title: item.label,
      route: item.href,
      closable: item.href !== '/',
    });
  }, [navGroups, openTab]);

  const checkItemPermission = (item: NavItem) => {
    if (!item.permission) return true;
    if (isSuperAdmin) return true;
    return hasPermission(item.permission);
  };

  const handleDisabledClick = (e: React.MouseEvent, item: NavItem) => {
    e.preventDefault();
    toast({
      title: "접근 권한 없음",
      description: `'${item.label}' 메뉴에 대한 권한이 없습니다.`,
      variant: "destructive",
    });
  };

  const renderNavItem = (item: NavItem) => {
    const hasAccess = checkItemPermission(item);
    const isActive = location.pathname === item.href || 
      (item.href !== '/' && location.pathname.startsWith(item.href));
    
    if (hasAccess) {
      return (
        <button
          key={item.href}
          type="button"
          onClick={() => handleNavClick(item)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full text-left",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {item.icon}
          {item.label}
          {item.badge && item.badge > 0 ? (
            <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
              {item.badge}
            </span>
          ) : null}
        </button>
      );
    }
    
    return (
      <button
        key={item.href}
        type="button"
        onClick={(e) => handleDisabledClick(e, item)}
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full text-left opacity-50 cursor-not-allowed"
      >
        {item.icon}
        <span className="flex-1">{item.label}</span>
        <Lock className="h-3 w-3" />
      </button>
    );
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-background border rounded-md shadow-sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-card border-r flex flex-col transform transition-all duration-200 ease-in-out lg:translate-x-0",
          sidebarCollapsed ? "w-16" : "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn("flex items-center h-16 border-b flex-shrink-0", sidebarCollapsed ? "px-2 justify-center" : "px-6")}>
          {sidebarCollapsed ? (
            <span className="text-xl font-bold text-primary">H</span>
          ) : (
            <>
              <span className="text-xl font-bold text-primary">Hellp Me</span>
              <span className="ml-2 text-sm text-muted-foreground">Admin</span>
            </>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto", sidebarCollapsed ? "p-2" : "p-4")}>
          {navGroups.filter(hasMenuAccess).map((group, groupIndex) => {
            const isCollapsed = collapsedGroups[group.title];
            
            if (sidebarCollapsed) {
              return (
                <div key={group.title} className={cn(groupIndex > 0 && 'mt-2')}>
                  {group.items.map((item) => {
                    const hasAccess = checkItemPermission(item);
                    const isActive = location.pathname === item.href ||
                      (item.href !== '/' && location.pathname.startsWith(item.href));

                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => hasAccess ? handleNavClick(item) : undefined}
                        title={item.badge && item.badge > 0 ? `${item.label} (${item.badge})` : item.label}
                        className={cn(
                          "relative flex items-center justify-center w-full p-2 rounded-md transition-colors mb-1",
                          !hasAccess && "opacity-50 cursor-not-allowed",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {item.icon}
                        {item.badge && item.badge > 0 ? (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            }
            
            return (
              <div key={group.title} className={cn(groupIndex > 0 && 'mt-4')}>
                {group.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {group.icon}
                      {group.title}
                    </span>
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                ) : (
                  <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {group.title}
                  </h3>
                )}
                {!isCollapsed ? (
                  <div className="space-y-1 mt-1">
                    {group.items.map(renderNavItem)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className={cn("border-t flex-shrink-0", sidebarCollapsed ? "p-2" : "p-4")}>
          {sidebarCollapsed ? (
            <>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="메뉴 펼치기"
                className="flex items-center justify-center w-full p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors mb-2"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
              <div className="w-8 h-8 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <span className="text-sm font-medium text-primary">
                  {user?.name?.[0] || 'A'}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                title="로그아웃"
                className="flex items-center justify-center w-full p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="flex items-center gap-2 w-full px-3 py-2 mb-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                <PanelLeftClose className="h-4 w-4" />
                <span>메뉴 접기</span>
              </button>
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user?.name?.[0] || 'A'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground"
                onClick={logout}
              >
                <LogOut className="h-5 w-5" />
                로그아웃
              </Button>
            </>
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className={cn("flex-1 flex flex-col h-full overflow-hidden transition-all duration-200", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <header className="flex-shrink-0 z-20 bg-background/95 backdrop-blur border-b">
          <div className="h-14 flex items-center px-6 gap-4">
            <div className="lg:hidden w-8" />
            <div className="flex-1" />

            {/* WebSocket 연결 상태 표시 */}
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground hidden sm:inline">실시간 연결됨</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-orange-500" />
                  <span className="text-muted-foreground hidden sm:inline">연결 끊김</span>
                </>
              )}
            </div>
          </div>
          <TabBar />
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
