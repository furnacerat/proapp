import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { ProtectedApp } from './components/auth/ProtectedApp';
import { Layout } from './components/layout/Layout';
import { DailyCommandCenter } from './pages/DailyCommandCenter';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { FieldMode } from './pages/FieldMode';
import { Workers } from './pages/Workers';
import { TimeEntries } from './pages/TimeEntries';
import { Expenses } from './pages/Expenses';
import { CompanyExpenses } from './pages/CompanyExpenses';
import { ShoppingLists } from './pages/ShoppingLists';
import { Tasks } from './pages/Tasks';
import { Invoices } from './pages/Invoices';
import { Calendar } from './pages/Calendar';
import { Reports } from './pages/Reports';
import { MarketingStudio } from './pages/MarketingStudio';
import { EstimatesDashboard } from './pages/estimates/EstimatesDashboard';
import { EstimatesList } from './pages/estimates/EstimatesList';
import { EstimateBuilder } from './pages/estimates/EstimateBuilder';
import { TemplatesLibrary } from './pages/estimates/TemplatesLibrary';
import { AssembliesLibrary } from './pages/estimates/AssembliesLibrary';
import { PriceBook } from './pages/estimates/PriceBook';
import { MaterialsList } from './pages/estimates/MaterialsList';
import { Suppliers } from './pages/estimates/Suppliers';
import { MaterialOrders } from './pages/estimates/MaterialOrders';
import { Settings } from './pages/Settings';
import { Customers } from './pages/Customers';
import { AuthPage } from './pages/auth/AuthPage';
import { CustomerPortal } from './pages/CustomerPortal';
import { Team } from './pages/admin/Team';
import { canAccessRoute, getDefaultRouteForRole } from './auth/rbac';
import { useAuth } from './context/AuthContext';
import './index.css';

function AccessDenied() {
  const { role } = useAuth();
  return (
    <div className="page-content">
      <div className="empty-state">
        <h3>Access restricted</h3>
        <p>Your current role does not have access to this workspace area.</p>
        <a className="btn btn-primary" href={getDefaultRouteForRole(role)}>Go to your workspace</a>
      </div>
    </div>
  );
}

function GuardedRoute({ children }: { children: React.ReactNode }) {
  const { role, profile } = useAuth();
  const path = window.location.pathname;
  if (profile?.active === false) return <AccessDenied />;
  if (!canAccessRoute(role, path)) return <AccessDenied />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <ProtectedApp>
      <AppProvider>
        <ToastProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<GuardedRoute><DailyCommandCenter /></GuardedRoute>} />
              <Route path="/dashboard" element={<GuardedRoute><Dashboard /></GuardedRoute>} />
              <Route path="/jobs" element={<GuardedRoute><Jobs /></GuardedRoute>} />
              <Route path="/jobs/:id" element={<GuardedRoute><JobDetail /></GuardedRoute>} />
              <Route path="/field" element={<GuardedRoute><FieldMode /></GuardedRoute>} />
              <Route path="/estimates" element={<GuardedRoute><EstimatesDashboard /></GuardedRoute>} />
              <Route path="/estimates/list" element={<GuardedRoute><EstimatesList /></GuardedRoute>} />
              <Route path="/estimates/new" element={<GuardedRoute><EstimateBuilder /></GuardedRoute>} />
              <Route path="/estimates/:id" element={<GuardedRoute><EstimateBuilder /></GuardedRoute>} />
              <Route path="/estimates/templates" element={<GuardedRoute><TemplatesLibrary /></GuardedRoute>} />
              <Route path="/estimates/assemblies" element={<GuardedRoute><AssembliesLibrary /></GuardedRoute>} />
              <Route path="/estimates/pricebook" element={<GuardedRoute><PriceBook /></GuardedRoute>} />
              <Route path="/estimates/:id/materials" element={<GuardedRoute><MaterialsList /></GuardedRoute>} />
              <Route path="/estimates/suppliers" element={<GuardedRoute><Suppliers /></GuardedRoute>} />
              <Route path="/estimates/orders" element={<GuardedRoute><MaterialOrders /></GuardedRoute>} />
              <Route path="/workers" element={<GuardedRoute><Workers /></GuardedRoute>} />
              <Route path="/time-entries" element={<GuardedRoute><TimeEntries /></GuardedRoute>} />
              <Route path="/expenses" element={<GuardedRoute><Expenses /></GuardedRoute>} />
              <Route path="/company-expenses" element={<GuardedRoute><CompanyExpenses /></GuardedRoute>} />
              <Route path="/shopping-lists" element={<GuardedRoute><ShoppingLists /></GuardedRoute>} />
              <Route path="/tasks" element={<GuardedRoute><Tasks /></GuardedRoute>} />
              <Route path="/invoices" element={<GuardedRoute><Invoices /></GuardedRoute>} />
              <Route path="/customers" element={<GuardedRoute><Customers /></GuardedRoute>} />
              <Route path="/settings" element={<GuardedRoute><Settings /></GuardedRoute>} />
              <Route path="/admin/team" element={<GuardedRoute><Team /></GuardedRoute>} />
              <Route path="/schedule" element={<GuardedRoute><Calendar /></GuardedRoute>} />
              <Route path="/reports" element={<GuardedRoute><Reports /></GuardedRoute>} />
              <Route path="/marketing" element={<GuardedRoute><MarketingStudio /></GuardedRoute>} />
            </Routes>
          </Layout>
        </ToastProvider>
      </AppProvider>
    </ProtectedApp>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/portal/:token" element={<ToastProvider><CustomerPortal /></ToastProvider>} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
