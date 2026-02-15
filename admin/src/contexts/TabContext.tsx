import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface Tab {
  id: string;
  title: string;
  route: string;
  icon?: string;
  closable: boolean;
  hasUnsavedChanges?: boolean;
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  openTab: (tab: Omit<Tab, 'closable'> & { closable?: boolean }) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  markUnsavedChanges: (tabId: string, hasChanges: boolean) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

const DEFAULT_TAB: Tab = {
  id: 'dashboard',
  title: '대시보드',
  route: '/',
  closable: false,
};

const ROUTE_TO_TAB: Record<string, { id: string; title: string }> = {
  '/': { id: 'dashboard', title: '대시보드' },
  '/operations-monitor': { id: 'operations-monitor', title: '실시간 운영' },
  '/integration-health': { id: 'integration-health', title: '연동 상태' },
  '/users': { id: 'users', title: '회원관리' },
  '/verification-queue': { id: 'verification-queue', title: '검증 대기' },
  '/documents': { id: 'documents', title: '서류 관리' },
  '/teams': { id: 'teams', title: '팀/조직' },
  '/orders': { id: 'orders', title: '오더 관리' },
  '/proofs': { id: 'proofs', title: '증빙 검수' },
  '/settlement-detail': { id: 'settlement-detail', title: '정산 상세' },
  '/contracts': { id: 'contracts', title: '계약 관리' },
  '/payments': { id: 'payments', title: '결제 관리' },
  '/refunds': { id: 'refunds', title: '환불 관리' },
  '/settlements': { id: 'settlements', title: '정산 관리' },
  '/tax-invoices': { id: 'tax-invoices', title: '세금계산서' },
  '/carriers': { id: 'carriers', title: '택배사 관리' },
  '/carrier-rates': { id: 'carrier-rates', title: '운임/최저단가' },
  '/minimum-guarantee': { id: 'minimum-guarantee', title: '최소수입보장' },
  '/disputes': { id: 'disputes', title: '분쟁/클레임' },
  '/cs-tickets': { id: 'cs-tickets', title: 'CS 티켓' },
  '/notifications': { id: 'notifications', title: '알림/공지' },
  '/sms-push': { id: 'sms-push', title: 'SMS/푸시' },
  '/settings': { id: 'settings', title: '설정' },
  '/audit-logs': { id: 'audit-logs', title: '감사 로그' },
  '/admin-users': { id: 'admin-users', title: '운영자 계정' },
  '/helpers': { id: 'helpers', title: '헬퍼' },
  '/requesters': { id: 'requesters', title: '요청자' },
  '/helper-detail': { id: 'helper-detail', title: '헬퍼 상세' },
  '/requester-detail': { id: 'requester-detail', title: '요청자 상세' },
  '/pricing-policies': { id: 'pricing-policies', title: '운임 정책' },
  '/order-categories': { id: 'order-categories', title: '오더 카테고리' },
};

export function TabProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialMount = useRef(true);
  const lastProcessedPath = useRef<string | null>(null);
  
  const [tabs, setTabs] = useState<Tab[]>([DEFAULT_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard');

  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;
    
    const currentRoute = location.pathname;
    const routeInfo = ROUTE_TO_TAB[currentRoute];
    
    if (routeInfo && routeInfo.id !== 'dashboard') {
      setTabs([DEFAULT_TAB, {
        id: routeInfo.id,
        title: routeInfo.title,
        route: currentRoute,
        closable: true,
      }]);
      setActiveTabId(routeInfo.id);
    }
    
    lastProcessedPath.current = currentRoute;
  }, []);

  useEffect(() => {
    if (isInitialMount.current) return;
    
    const currentRoute = location.pathname;
    
    if (lastProcessedPath.current === currentRoute) return;
    lastProcessedPath.current = currentRoute;
    
    const routeInfo = ROUTE_TO_TAB[currentRoute];
    
    if (routeInfo) {
      setTabs(prev => {
        const existingTab = prev.find(t => t.id === routeInfo.id);
        if (existingTab) {
          return prev;
        }
        return [...prev, {
          id: routeInfo.id,
          title: routeInfo.title,
          route: currentRoute,
          closable: currentRoute !== '/',
        }];
      });
      setActiveTabId(routeInfo.id);
    }
  }, [location.pathname]);

  const openTab = useCallback((newTab: Omit<Tab, 'closable'> & { closable?: boolean }) => {
    setTabs(prev => {
      const existingTab = prev.find(t => t.id === newTab.id);
      if (existingTab) {
        return prev;
      }
      return [...prev, {
        ...newTab,
        closable: newTab.closable ?? true,
      }];
    });
    setActiveTabId(newTab.id);
    lastProcessedPath.current = newTab.route;
    navigate(newTab.route);
  }, [navigate]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabToClose = prev.find(t => t.id === tabId);
      if (!tabToClose || !tabToClose.closable) return prev;

      if (tabToClose.hasUnsavedChanges) {
        const confirmed = window.confirm('저장되지 않은 변경사항이 있습니다. 정말 닫으시겠습니까?');
        if (!confirmed) return prev;
      }

      const tabIndex = prev.findIndex(t => t.id === tabId);
      const newTabs = prev.filter(t => t.id !== tabId);
      
      if (activeTabId === tabId) {
        const newActiveTab = newTabs[Math.min(tabIndex, newTabs.length - 1)] || DEFAULT_TAB;
        setActiveTabId(newActiveTab.id);
        lastProcessedPath.current = newActiveTab.route;
        navigate(newActiveTab.route);
      }
      
      return newTabs;
    });
  }, [activeTabId, navigate]);

  const setActiveTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (tab) {
        setActiveTabId(tabId);
        lastProcessedPath.current = tab.route;
        navigate(tab.route);
      }
      return prev;
    });
  }, [navigate]);

  const markUnsavedChanges = useCallback((tabId: string, hasChanges: boolean) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, hasUnsavedChanges: hasChanges } : tab
    ));
  }, []);

  const closeAllTabs = useCallback(() => {
    const hasUnsaved = tabs.some(t => t.closable && t.hasUnsavedChanges);
    if (hasUnsaved) {
      const confirmed = window.confirm('저장되지 않은 변경사항이 있습니다. 모든 탭을 닫으시겠습니까?');
      if (!confirmed) return;
    }
    
    setTabs([DEFAULT_TAB]);
    setActiveTabId('dashboard');
    lastProcessedPath.current = '/';
    navigate('/');
  }, [tabs, navigate]);

  const closeOtherTabs = useCallback((tabId: string) => {
    const hasUnsaved = tabs.some(t => t.id !== tabId && t.closable && t.hasUnsavedChanges);
    if (hasUnsaved) {
      const confirmed = window.confirm('저장되지 않은 변경사항이 있습니다. 다른 탭을 닫으시겠습니까?');
      if (!confirmed) return;
    }
    
    setTabs(prev => prev.filter(t => t.id === tabId || !t.closable));
    setActiveTabId(tabId);
  }, [tabs]);

  return (
    <TabContext.Provider value={{
      tabs,
      activeTabId,
      openTab,
      closeTab,
      setActiveTab,
      markUnsavedChanges,
      closeAllTabs,
      closeOtherTabs,
    }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabs must be used within TabProvider');
  }
  return context;
}
