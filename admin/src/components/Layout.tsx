import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTabs } from '@/contexts/TabContext';
import { useToast } from '@/hooks/use-toast';
import TabBar from './TabBar';
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  Wallet,
  Users,
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
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
  BarChart3,
  Building2,
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

const navGroups: NavGroup[] = [
  {
    title: '운영',
    items: [
      { href: '/', label: '대시보드', icon: <LayoutDashboard className="h-5 w-5" />, permission: 'orders.view' },
    ],
  },
  {
    title: '오더운영',
    icon: <Package className="h-4 w-4" />,
    collapsible: true,
    menuKey: 'menu.orders',
    items: [
      { href: '/orders', label: '실시간오더관리', icon: <Package className="h-5 w-5" />, permission: 'orders.view' },
      { href: '/closings', label: '오더마감자료', icon: <ClipboardCheck className="h-5 w-5" />, permission: 'orders.view' },
    ],
  },
  {
    title: '결제관리',
    icon: <CreditCard className="h-4 w-4" />,
    collapsible: true,
    menuKey: 'menu.payments',
    items: [
      { href: '/payments', label: '결제통합관리', icon: <CreditCard className="h-5 w-5" />, permission: 'orders.view' },
    ],
  },
  {
    title: '정산',
    icon: <Wallet className="h-4 w-4" />,
    collapsible: true,
    menuKey: 'menu.settlements',
    items: [
      { href: '/settlements', label: '정산통합관리', icon: <Wallet className="h-5 w-5" />, permission: 'settlements.view' },
      { href: '/settlement-stats', label: '정산통계', icon: <BarChart3 className="h-5 w-5" />, permission: 'settlements.view' },
    ],
  },
  {
    title: '회원 관리',
    icon: <Users className="h-4 w-4" />,
    collapsible: true,
    menuKey: 'menu.members',
    items: [
      { href: '/members', label: '회원통합관리', icon: <Users className="h-5 w-5" />, permission: 'helpers.view' },
      { href: '/helper-documents', label: '헬퍼서류검토', icon: <ClipboardCheck className="h-5 w-5" />, permission: 'helpers.edit' },
      { href: '/helper-bank-accounts', label: '수수료통장관리', icon: <Wallet className="h-5 w-5" />, permission: 'helpers.edit' },
    ],
  },
  {
    title: '운임/정책',
    icon: <DollarSign className="h-4 w-4" />,
    collapsible: true,
    menuKey: 'menu.rates',
    items: [
      { href: '/rates', label: '운임설정', icon: <DollarSign className="h-5 w-5" />, permission: 'settings.manage' },
      { href: '/refund-policy', label: '환불정책', icon: <AlertTriangle className="h-5 w-5" />, permission: 'settings.manage' },
    ],
  },
  {
    title: '이의제기/사고',
    icon: <AlertTriangle className="h-4 w-4" />,
    collapsible: true,
    menuKey: 'menu.disputes',
    items: [
      { href: '/disputes', label: '이의제기관리', icon: <MessageSquare className="h-5 w-5" />, permission: 'disputes.view' },
      { href: '/incidents', label: '화물사고통합관리', icon: <AlertTriangle className="h-5 w-5" />, permission: 'orders.view' },
    ],
  },
  {
    title: 'CS',
    icon: <Headphones className="h-4 w-4" />,
    collapsible: true,
    menuKey: 'menu.cs',
    items: [
      { href: '/cs', label: 'CS 문의', icon: <MessageSquare className="h-5 w-5" />, permission: 'orders.view' },
    ],
  },
  {
    title: '설정',
    menuKey: 'menu.settings',
    items: [
      { href: '/platform-settings', label: '플랫폼 정보', icon: <Building2 className="h-5 w-5" />, permission: 'superadmin_only' },
      { href: '/notifications', label: '공지/알림', icon: <Bell className="h-5 w-5" />, permission: 'orders.view' },
      { href: '/audit-logs', label: '감사 로그', icon: <ClipboardCheck className="h-5 w-5" />, permission: 'settings.view' },
      { href: '/admin-users', label: '직원/권한 관리', icon: <Lock className="h-5 w-5" />, permission: 'staff.view' },
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
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleNavClick = (item: NavItem) => {
    setSidebarOpen(false);
    const tabId = item.href === '/' ? 'dashboard' : item.href.replace(/\//g, '-').replace(/^-/, '');
    openTab({
      id: tabId,
      title: item.label,
      route: item.href,
      closable: item.href !== '/',
    });
  };

  const checkItemPermission = (item: NavItem) => {
    if (!item.permission) return true;
    // 슈퍼관리자 전용 메뉴
    if (item.permission === 'superadmin_only') return isSuperAdmin;
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
                        title={item.label}
                        className={cn(
                          "flex items-center justify-center w-full p-2 rounded-md transition-colors mb-1",
                          !hasAccess && "opacity-50 cursor-not-allowed",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {item.icon}
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
