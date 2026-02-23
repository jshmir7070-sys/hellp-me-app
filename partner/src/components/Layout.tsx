import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  Users,
  Wallet,
  MessageSquare,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { href: '/', label: '대시보드', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/orders', label: '오더현황', icon: <Package className="h-5 w-5" /> },
  { href: '/members', label: '팀원관리', icon: <Users className="h-5 w-5" /> },
  { href: '/settlements', label: '팀정산', icon: <Wallet className="h-5 w-5" /> },
  { href: '/cs', label: '팀 CS', icon: <MessageSquare className="h-5 w-5" /> },
  { href: '/incidents', label: '팀사고관리', icon: <AlertTriangle className="h-5 w-5" /> },
  { href: '/settings', label: '설정', icon: <Settings className="h-5 w-5" /> },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, team, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavClick = (href: string) => {
    setSidebarOpen(false);
    navigate(href);
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-background border rounded-md shadow-sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-card border-r flex flex-col transform transition-all duration-200 ease-in-out lg:translate-x-0",
          sidebarCollapsed ? "w-16" : "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Team name header */}
        <div className={cn("flex items-center h-16 border-b flex-shrink-0", sidebarCollapsed ? "px-2 justify-center" : "px-4")}>
          {sidebarCollapsed ? (
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary truncate">{team?.name || '파트너'}</p>
                <p className="text-xs text-muted-foreground">Partner Portal</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto", sidebarCollapsed ? "p-2" : "p-4")}>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));

              if (sidebarCollapsed) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => handleNavClick(item.href)}
                    title={item.label}
                    className={cn(
                      "flex items-center justify-center w-full p-2 rounded-md transition-colors mb-1",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {item.icon}
                  </button>
                );
              }

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleNavClick(item.href)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors text-left",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom section */}
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
                  {user?.name?.[0] || 'P'}
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
                    {user?.name?.[0] || 'P'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">팀장</p>
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

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={cn("flex-1 flex flex-col h-full overflow-hidden transition-all duration-200", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
