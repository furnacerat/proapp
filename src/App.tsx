import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { ProtectedApp } from './components/auth/ProtectedApp';
import { Layout } from './components/layout/Layout';
import { canAccessRoute, getDefaultRouteForRole } from './auth/rbac';
import { useAuth } from './context/AuthContext';
import './index.css';

const lazyNamed = <TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) => lazy(async () => ({ default: (await loader())[exportName] as ComponentType<any> }));

const DailyCommandCenter = lazyNamed(() => import('./pages/DailyCommandCenter'), 'DailyCommandCenter');
const Dashboard = lazyNamed(() => import('./pages/Dashboard'), 'Dashboard');
const Jobs = lazyNamed(() => import('./pages/Jobs'), 'Jobs');
const JobDetail = lazyNamed(() => import('./pages/JobDetail'), 'JobDetail');
const FieldMode = lazyNamed(() => import('./pages/FieldMode'), 'FieldMode');
const Workers = lazyNamed(() => import('./pages/Workers'), 'Workers');
const TimeEntries = lazyNamed(() => import('./pages/TimeEntries'), 'TimeEntries');
const Expenses = lazyNamed(() => import('./pages/Expenses'), 'Expenses');
const CompanyExpenses = lazyNamed(() => import('./pages/CompanyExpenses'), 'CompanyExpenses');
const ShoppingLists = lazyNamed(() => import('./pages/ShoppingLists'), 'ShoppingLists');
const Tasks = lazyNamed(() => import('./pages/Tasks'), 'Tasks');
const Invoices = lazyNamed(() => import('./pages/Invoices'), 'Invoices');
const Calendar = lazyNamed(() => import('./pages/Calendar'), 'Calendar');
const Reports = lazyNamed(() => import('./pages/Reports'), 'Reports');
const MarketingStudio = lazyNamed(() => import('./pages/MarketingStudio'), 'MarketingStudio');
const EstimatesDashboard = lazyNamed(() => import('./pages/estimates/EstimatesDashboard'), 'EstimatesDashboard');
const EstimatesList = lazyNamed(() => import('./pages/estimates/EstimatesList'), 'EstimatesList');
const EstimateBuilder = lazyNamed(() => import('./pages/estimates/EstimateBuilder'), 'EstimateBuilder');
const TemplatesLibrary = lazyNamed(() => import('./pages/estimates/TemplatesLibrary'), 'TemplatesLibrary');
const AssembliesLibrary = lazyNamed(() => import('./pages/estimates/AssembliesLibrary'), 'AssembliesLibrary');
const PriceBook = lazyNamed(() => import('./pages/estimates/PriceBook'), 'PriceBook');
const MaterialsList = lazyNamed(() => import('./pages/estimates/MaterialsList'), 'MaterialsList');
const Suppliers = lazyNamed(() => import('./pages/estimates/Suppliers'), 'Suppliers');
const MaterialOrders = lazyNamed(() => import('./pages/estimates/MaterialOrders'), 'MaterialOrders');
const Settings = lazyNamed(() => import('./pages/Settings'), 'Settings');
const Customers = lazyNamed(() => import('./pages/Customers'), 'Customers');
const AuthPage = lazyNamed(() => import('./pages/auth/AuthPage'), 'AuthPage');
const CustomerPortal = lazyNamed(() => import('./pages/CustomerPortal'), 'CustomerPortal');
const Team = lazyNamed(() => import('./pages/admin/Team'), 'Team');

function RouteLoading() {
  return (
    <div className="page-content">
      <div className="empty-state">
        <h3>Loading...</h3>
      </div>
    </div>
  );
}

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

function GuardedRoute({ children }: { children: ReactNode }) {
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
            <Suspense fallback={<RouteLoading />}>
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
            </Suspense>
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
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
            <Route path="/portal/:token" element={<ToastProvider><CustomerPortal /></ToastProvider>} />
            <Route path="/*" element={<AppRoutes />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
