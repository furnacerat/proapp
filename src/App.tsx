import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SkeletonScreen } from './components/common/SkeletonScreen';
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
  return <SkeletonScreen />;
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

function NotFound() {
  const { role } = useAuth();
  const location = useLocation();
  const homeRoute = getDefaultRouteForRole(role);

  return (
    <div className="page-content">
      <div className="empty-state">
        <h3>Page not found</h3>
        <p>No workspace page matches <strong>{location.pathname}</strong>.</p>
        <Link className="btn btn-primary" to={homeRoute}>Back to workspace</Link>
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

function RouteErrorFallback() {
  return (
    <div className="page-content">
      <div className="empty-state">
        <h3>Something went wrong</h3>
        <p>This page hit an unexpected error. The rest of the workspace is still available.</p>
        <Link className="btn btn-primary" to="/">Back to workspace</Link>
      </div>
    </div>
  );
}

function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundary key={location.pathname} fallback={<RouteErrorFallback />}>
      {children}
    </ErrorBoundary>
  );
}

const guardedRoute = (children: ReactNode) => (
  <RouteBoundary>
    <GuardedRoute>{children}</GuardedRoute>
  </RouteBoundary>
);

function AppRoutes() {
  return (
    <ProtectedApp>
      <AppProvider>
        <ToastProvider>
          <Layout>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={guardedRoute(<DailyCommandCenter />)} />
                <Route path="/dashboard" element={guardedRoute(<Dashboard />)} />
                <Route path="/jobs" element={guardedRoute(<Jobs />)} />
                <Route path="/jobs/:id" element={guardedRoute(<JobDetail />)} />
                <Route path="/field" element={guardedRoute(<FieldMode />)} />
                <Route path="/estimates" element={guardedRoute(<EstimatesDashboard />)} />
                <Route path="/estimates/list" element={guardedRoute(<EstimatesList />)} />
                <Route path="/estimates/new" element={guardedRoute(<EstimateBuilder />)} />
                <Route path="/estimates/:id" element={guardedRoute(<EstimateBuilder />)} />
                <Route path="/estimates/templates" element={guardedRoute(<TemplatesLibrary />)} />
                <Route path="/estimates/assemblies" element={guardedRoute(<AssembliesLibrary />)} />
                <Route path="/estimates/pricebook" element={guardedRoute(<PriceBook />)} />
                <Route path="/estimates/:id/materials" element={guardedRoute(<MaterialsList />)} />
                <Route path="/estimates/suppliers" element={guardedRoute(<Suppliers />)} />
                <Route path="/estimates/orders" element={guardedRoute(<MaterialOrders />)} />
                <Route path="/workers" element={guardedRoute(<Workers />)} />
                <Route path="/time-entries" element={guardedRoute(<TimeEntries />)} />
                <Route path="/expenses" element={guardedRoute(<Expenses />)} />
                <Route path="/company-expenses" element={guardedRoute(<CompanyExpenses />)} />
                <Route path="/shopping-lists" element={guardedRoute(<ShoppingLists />)} />
                <Route path="/tasks" element={guardedRoute(<Tasks />)} />
                <Route path="/invoices" element={guardedRoute(<Invoices />)} />
                <Route path="/customers" element={guardedRoute(<Customers />)} />
                <Route path="/settings" element={guardedRoute(<Settings />)} />
                <Route path="/admin/team" element={guardedRoute(<Team />)} />
                <Route path="/schedule" element={guardedRoute(<Calendar />)} />
                <Route path="/reports" element={guardedRoute(<Reports />)} />
                <Route path="/marketing" element={guardedRoute(<MarketingStudio />)} />
                <Route path="*" element={<RouteBoundary><NotFound /></RouteBoundary>} />
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
            <Route path="/login" element={<RouteBoundary><AuthPage mode="login" /></RouteBoundary>} />
            <Route path="/signup" element={<RouteBoundary><AuthPage mode="signup" /></RouteBoundary>} />
            <Route path="/forgot-password" element={<RouteBoundary><AuthPage mode="forgot" /></RouteBoundary>} />
            <Route path="/portal/:token" element={<RouteBoundary><ToastProvider><CustomerPortal /></ToastProvider></RouteBoundary>} />
            <Route path="/*" element={<RouteBoundary><AppRoutes /></RouteBoundary>} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
