import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabProvider } from './contexts/TabContext';
import { Toaster } from './components/ui/toaster';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import ClosingsPage from './pages/ClosingsPage';
import SettlementsPage from './pages/SettlementsPage';
import DailySettlementPage from './pages/DailySettlementPage';
import HelperSettlementPage from './pages/HelperSettlementPage';
import RequesterSettlementPage from './pages/RequesterSettlementPage';
import HelpersPage from './pages/HelpersPage';
import HelpersPendingPage from './pages/HelpersPendingPage';
import HelperDetailPage from './pages/HelperDetailPage';
import RequesterDetailPage from './pages/RequesterDetailPage';
import RequestersPage from './pages/RequestersPage';
import RequestersPendingPage from './pages/RequestersPendingPage';
import RatesPage from './pages/RatesPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import PaymentsPage from './pages/PaymentsPage';
import DepositPaymentsPage from './pages/DepositPaymentsPage';
import BalancePaymentsPage from './pages/BalancePaymentsPage';
import RefundsPage from './pages/RefundsPage';
import IncidentsPage from './pages/IncidentsPage';
import CSPage from './pages/CSPage';
import NotificationsPage from './pages/NotificationsPage';
import DisputesPage from './pages/DisputesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import DeductionsPage from './pages/DeductionsPage';
import IncidentRefundsPage from './pages/IncidentRefundsPage';
import TaskQueuePage from './pages/TaskQueuePage';
import IntegratedOrderDetailPage from './pages/IntegratedOrderDetailPage';

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
                  <Route path="/task-queue" element={<TaskQueuePage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/:orderId" element={<IntegratedOrderDetailPage />} />
                  <Route path="/closings" element={<ClosingsPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/payments/deposit" element={<DepositPaymentsPage />} />
                  <Route path="/payments/balance" element={<BalancePaymentsPage />} />
                  <Route path="/refunds" element={<RefundsPage />} />
                                    <Route path="/settlements" element={<SettlementsPage />} />
                  <Route path="/settlements/daily" element={<DailySettlementPage />} />
                  <Route path="/settlements/helper" element={<HelperSettlementPage />} />
                  <Route path="/settlements/requester" element={<RequesterSettlementPage />} />
                  <Route path="/deductions" element={<DeductionsPage />} />
                  <Route path="/helpers/pending" element={<HelpersPendingPage />} />
                  <Route path="/helpers/:helperId" element={<HelperDetailPage />} />
                  <Route path="/helpers" element={<HelpersPage />} />
                  <Route path="/requesters/pending" element={<RequestersPendingPage />} />
                  <Route path="/requesters/:requesterId" element={<RequesterDetailPage />} />
                  <Route path="/requesters" element={<RequestersPage />} />
                  <Route path="/rates" element={<RatesPage />} />
                  <Route path="/refund-policy" element={<RefundPolicyPage />} />
                  <Route path="/incidents" element={<IncidentsPage />} />
                  <Route path="/incident-refunds" element={<IncidentRefundsPage />} />
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
