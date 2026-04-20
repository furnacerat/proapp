import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/common/Toast';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { Workers } from './pages/Workers';
import { TimeEntries } from './pages/TimeEntries';
import { Expenses } from './pages/Expenses';
import { Tasks } from './pages/Tasks';
import { Invoices } from './pages/Invoices';
import { Calendar } from './pages/Calendar';
import { Reports } from './pages/Reports';
import { EstimatesDashboard } from './pages/estimates/EstimatesDashboard';
import { EstimatesList } from './pages/estimates/EstimatesList';
import { EstimateBuilder } from './pages/estimates/EstimateBuilder';
import { TemplatesLibrary } from './pages/estimates/TemplatesLibrary';
import { AssembliesLibrary } from './pages/estimates/AssembliesLibrary';
import { PriceBook } from './pages/estimates/PriceBook';
import { MaterialsList } from './pages/estimates/MaterialsList';
import { Settings } from './pages/Settings';
import { Customers } from './pages/Customers';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/estimates" element={<EstimatesDashboard />} />
              <Route path="/estimates/list" element={<EstimatesList />} />
              <Route path="/estimates/new" element={<EstimateBuilder />} />
              <Route path="/estimates/:id" element={<EstimateBuilder />} />
              <Route path="/estimates/templates" element={<TemplatesLibrary />} />
              <Route path="/estimates/assemblies" element={<AssembliesLibrary />} />
              <Route path="/estimates/pricebook" element={<PriceBook />} />
              <Route path="/estimates/:id/materials" element={<MaterialsList />} />
              <Route path="/workers" element={<Workers />} />
              <Route path="/time-entries" element={<TimeEntries />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/schedule" element={<Calendar />} />
              <Route path="/reports" element={<Reports />} />
            </Routes>
          </Layout>
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
