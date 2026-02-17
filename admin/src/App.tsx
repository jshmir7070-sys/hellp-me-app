import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabProvider } from './contexts/TabContext';
import { Toaster } from './components/ui/toaster';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import ClosingsPage from './pages/ClosingsPage';
// import SettlementsPage from './pages/SettlementsPage';
// import DailySettlementPage from './pages/DailySettlementPage';
// import HelperSettlementPage from './pages/HelperSettlementPage';
// import RequesterSettlementPage from './pages/RequesterSettlementPage';
import SettlementsPageV2 from './pages/SettlementsPageV2';
// import HelpersPage from './pages/HelpersPage';
// import HelpersPendingPage from './pages/HelpersPendingPage';
import HelperDetailPage from './pages/HelperDetailPage';
import RequesterDetailPage from './pages/RequesterDetailPage';
// import RequestersPage from './pages/RequestersPage';
// import RequestersPendingPage from './pages/RequestersPendingPage';
import MembersPageV2 from './pages/MembersPageV2';
import RatesPage from './pages/RatesPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
// import PaymentsPage from './pages/PaymentsPage';
// import DepositPaymentsPage from './pages/DepositPaymentsPage';
// import BalancePaymentsPage from './pages/BalancePaymentsPage';
// import RefundsPage from './pages/RefundsPage';
import PaymentsPageV2 from './pages/PaymentsPageV2';
// import IncidentsPage from './pages/IncidentsPage';
// import DeductionsPage from './pages/DeductionsPage';
// import IncidentRefundsPage from './pages/IncidentRefundsPage';
import IncidentsPageV2 from './pages/IncidentsPageV2';
import CSPage from './pages/CSPage';
import NotificationsPage from './pages/NotificationsPage';
import DisputesPage from './pages/DisputesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import HelperDocumentsPage from './pages/HelperDocumentsPage';
import HelperBankAccountsPage from './pages/HelperBankAccountsPage';

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
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/closings" element={<ClosingsPage />} />
                  
                  {/* 통합 결제 페이지 */}
                  <Route path="/payments" element={<PaymentsPageV2 />} />
                  
                  {/* 통합 정산 페이지 */}
                  <Route path="/settlements" element={<SettlementsPageV2 />} />
                  
                  {/* 통합 회원 페이지 */}
                  <Route path="/members" element={<MembersPageV2 />} />
                  <Route path="/helpers/:helperId" element={<HelperDetailPage />} />
                  <Route path="/requesters/:requesterId" element={<RequesterDetailPage />} />
                  
                  {/* 헬퍼 서류 검토 */}
                  <Route path="/helper-documents" element={<HelperDocumentsPage />} />
                  <Route path="/helper-bank-accounts" element={<HelperBankAccountsPage />} />
                  
                  {/* 통합 사고 페이지 */}
                  <Route path="/incidents" element={<IncidentsPageV2 />} />
                  
                  <Route path="/rates" element={<RatesPage />} />
                  <Route path="/refund-policy" element={<RefundPolicyPage />} />
                  <Route path="/cs" element={<CSPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/disputes" element={<DisputesPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/admin-users" element={<AdminUsersPage />} />
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
    <AuthProvider>
      <AppRoutes />
      <Toaster />
    </AuthProvider>
  );
}
