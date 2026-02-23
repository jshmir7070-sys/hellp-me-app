import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabProvider } from './contexts/TabContext';
import { Toaster } from './components/ui/toaster';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import ClosingsPage from './pages/ClosingsPage';
import SettlementsPageV2 from './pages/SettlementsPageV2';
import HelperDetailPage from './pages/HelperDetailPage';
import RequesterDetailPage from './pages/RequesterDetailPage';
import MembersPageV2 from './pages/MembersPageV2';
import RatesPage from './pages/RatesPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import PaymentsPageV2 from './pages/PaymentsPageV2';
import IncidentsPageV2 from './pages/IncidentsPageV2';
import CSPage from './pages/CSPage';
import NotificationsPage from './pages/NotificationsPage';
import DisputesPage from './pages/DisputesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import HelperDocumentsPage from './pages/HelperDocumentsPage';
import SettlementStatsPage from './pages/SettlementStatsPage';
import PlatformSettingsPage from './pages/PlatformSettingsPage';
import TeamsPage from './pages/TeamsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import EnterpriseAccountsPage from './pages/EnterpriseAccountsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Route-level permission guard.
 * Wraps individual routes that require a specific permission string.
 * - 'superadmin_only' restricts to superadmin role only.
 * - Any other string is checked via hasPermission() (which also grants
 *   access to superadmin automatically).
 * Unauthorized users see an inline "access denied" message instead of the page.
 */
function PermissionRoute({
  children,
  requiredPermission,
}: {
  children: React.ReactNode;
  requiredPermission: string;
}) {
  const { user, hasPermission } = useAuth();

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'SUPER_ADMIN';

  const hasAccess =
    requiredPermission === 'superadmin_only'
      ? isSuperAdmin
      : hasPermission(requiredPermission);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-semibold">접근 권한이 없습니다</h2>
        <p className="text-muted-foreground text-sm">
          이 페이지에 접근하려면 관리자에게 권한을 요청하세요.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <TabProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/orders" element={<PermissionRoute requiredPermission="orders.view"><OrdersPage /></PermissionRoute>} />
                  <Route path="/closings" element={<PermissionRoute requiredPermission="orders.view"><ClosingsPage /></PermissionRoute>} />

                  {/* 통합 결제 페이지 */}
                  <Route path="/payments" element={<PermissionRoute requiredPermission="orders.view"><PaymentsPageV2 /></PermissionRoute>} />

                  {/* 통합 정산 페이지 */}
                  <Route path="/settlements" element={<PermissionRoute requiredPermission="settlements.view"><SettlementsPageV2 /></PermissionRoute>} />
                  <Route path="/settlement-stats" element={<PermissionRoute requiredPermission="settlements.view"><SettlementStatsPage /></PermissionRoute>} />

                  {/* 통합 회원 페이지 */}
                  <Route path="/members" element={<PermissionRoute requiredPermission="helpers.view"><MembersPageV2 /></PermissionRoute>} />
                  <Route path="/helpers/:helperId" element={<PermissionRoute requiredPermission="helpers.view"><HelperDetailPage /></PermissionRoute>} />
                  <Route path="/requesters/:requesterId" element={<PermissionRoute requiredPermission="helpers.view"><RequesterDetailPage /></PermissionRoute>} />

                  {/* 헬퍼 서류 검토 (통장 포함) */}
                  <Route path="/helper-documents" element={<PermissionRoute requiredPermission="helpers.edit"><HelperDocumentsPage /></PermissionRoute>} />

                  {/* 팀 관리 */}
                  <Route path="/teams" element={<PermissionRoute requiredPermission="helpers.view"><TeamsPage /></PermissionRoute>} />
                  <Route path="/teams/:teamId" element={<PermissionRoute requiredPermission="helpers.view"><TeamDetailPage /></PermissionRoute>} />

                  {/* 통합 사고 페이지 */}
                  <Route path="/incidents" element={<PermissionRoute requiredPermission="orders.view"><IncidentsPageV2 /></PermissionRoute>} />

                  <Route path="/rates" element={<PermissionRoute requiredPermission="settings.edit"><RatesPage /></PermissionRoute>} />
                  <Route path="/refund-policy" element={<PermissionRoute requiredPermission="settings.edit"><RefundPolicyPage /></PermissionRoute>} />
                  <Route path="/enterprise-accounts" element={<PermissionRoute requiredPermission="settings.edit"><EnterpriseAccountsPage /></PermissionRoute>} />
                  <Route path="/cs" element={<PermissionRoute requiredPermission="orders.view"><CSPage /></PermissionRoute>} />
                  <Route path="/notifications" element={<PermissionRoute requiredPermission="orders.view"><NotificationsPage /></PermissionRoute>} />
                  <Route path="/disputes" element={<PermissionRoute requiredPermission="disputes.view"><DisputesPage /></PermissionRoute>} />
                  <Route path="/audit-logs" element={<PermissionRoute requiredPermission="settings.view"><AuditLogsPage /></PermissionRoute>} />
                  <Route path="/admin-users" element={<PermissionRoute requiredPermission="staff.view"><AdminUsersPage /></PermissionRoute>} />
                  <Route path="/platform-settings" element={<PermissionRoute requiredPermission="superadmin_only"><PlatformSettingsPage /></PermissionRoute>} />
                </Routes>
              </Layout>
            </TabProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
          <AppRoutes />
          <Toaster />
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
