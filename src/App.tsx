import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/common/Toast';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { Estimates } from './pages/Estimates';
import { EstimateDetail } from './pages/EstimateDetail';
import { Workers } from './pages/Workers';
import { TimeEntries } from './pages/TimeEntries';
import { Expenses } from './pages/Expenses';
import { Tasks } from './pages/Tasks';
import { Invoices } from './pages/Invoices';
import { Calendar } from './pages/Calendar';
import { Reports } from './pages/Reports';
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
              <Route path="/estimates" element={<Estimates />} />
              <Route path="/estimates/:id" element={<EstimateDetail />} />
              <Route path="/workers" element={<Workers />} />
              <Route path="/time-entries" element={<TimeEntries />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/invoices" element={<Invoices />} />
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