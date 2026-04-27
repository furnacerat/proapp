import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  DollarSign,
  Eye,
  PieChart,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { getJobExpenseTotal, getJobLaborCost } from '../utils/calculations';

type ComparisonMode = 'estimateActual' | 'monthMonth';

const monthKey = (date: string) => date.slice(0, 7);
const currentMonthKey = () => new Date().toISOString().slice(0, 7);
const previousMonthKey = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 7);
};

const percentChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export function Reports() {
  const { jobs, timeEntries, expenses, invoices, payments } = useApp();
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('estimateActual');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const paidByInvoice = useMemo(() => payments.reduce((acc, payment) => {
    acc[payment.invoiceId] = (acc[payment.invoiceId] || 0) + payment.amount;
    return acc;
  }, {} as Record<string, number>), [payments]);

  const jobReports = useMemo(() => jobs
    .filter(job => ['active', 'scheduled', 'completed', 'closed', 'awaiting_payment'].includes(job.status))
    .map(job => {
      const labor = getJobLaborCost(job.id, timeEntries);
      const materials = getJobExpenseTotal(job.id, expenses);
      const actualCost = labor + materials;
      const estimatedCost = job.estimatedCost || 0;
      const revenue = job.contractAmount || 0;
      const profit = revenue - actualCost;
      const estimatedProfit = revenue - estimatedCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const variance = actualCost - estimatedCost;
      const variancePercent = estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0;
      const paid = invoices.filter(invoice => invoice.jobId === job.id).reduce((sum, invoice) => sum + (paidByInvoice[invoice.id] || 0), 0);
      return { ...job, labor, materials, actualCost, estimatedCost, revenue, profit, estimatedProfit, margin, variance, variancePercent, paid };
    })
    .sort((a, b) => a.margin - b.margin), [expenses, invoices, jobs, paidByInvoice, timeEntries]);

  const selectedJob = jobReports.find(job => job.id === selectedJobId) || jobReports[0];

  const thisMonth = currentMonthKey();
  const lastMonth = previousMonthKey();
  const monthly = useMemo(() => {
    const summarize = (key: string) => {
      const monthInvoices = invoices.filter(invoice => monthKey(invoice.dueDate) === key);
      const monthExpenses = expenses.filter(expense => monthKey(expense.date) === key);
      const monthTime = timeEntries.filter(entry => monthKey(entry.date) === key);
      const revenue = monthInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
      const cost = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0) + monthTime.reduce((sum, entry) => sum + entry.laborCost, 0);
      return { revenue, cost, profit: revenue - cost };
    };
    return { current: summarize(thisMonth), previous: summarize(lastMonth) };
  }, [expenses, invoices, lastMonth, thisMonth, timeEntries]);

  const totals = {
    revenue: jobReports.reduce((sum, job) => sum + job.revenue, 0),
    cost: jobReports.reduce((sum, job) => sum + job.actualCost, 0),
    estimatedCost: jobReports.reduce((sum, job) => sum + job.estimatedCost, 0),
    profit: jobReports.reduce((sum, job) => sum + job.profit, 0),
    estimatedProfit: jobReports.reduce((sum, job) => sum + job.estimatedProfit, 0),
  };
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const costVariance = totals.cost - totals.estimatedCost;
  const revenueTrend = percentChange(monthly.current.revenue, monthly.previous.revenue);
  const costTrend = percentChange(monthly.current.cost, monthly.previous.cost);
  const profitTrend = percentChange(monthly.current.profit, monthly.previous.profit);

  const lowMarginJobs = jobReports.filter(job => job.margin < 18).slice(0, 5);
  const overBudgetJobs = jobReports.filter(job => job.variance > 0).sort((a, b) => b.variance - a.variance).slice(0, 5);
  const highCostJobs = [...jobReports].sort((a, b) => b.actualCost - a.actualCost).slice(0, 5);
  const topPerformingJobs = [...jobReports].sort((a, b) => b.margin - a.margin).slice(0, 4);
  const underperformingJobs = [...jobReports].filter(job => job.profit < job.estimatedProfit).slice(0, 4);

  const costDrivers = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenses.forEach(expense => { grouped[expense.category] = (grouped[expense.category] || 0) + expense.amount; });
    const laborTotal = timeEntries.reduce((sum, entry) => sum + entry.laborCost, 0);
    if (laborTotal > 0) grouped.labor = laborTotal;
    return Object.entries(grouped)
      .map(([category, amount]) => ({ category, amount, percent: totals.cost > 0 ? (amount / totals.cost) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [expenses, timeEntries, totals.cost]);

  const selectedExpenses = selectedJob ? expenses.filter(expense => expense.jobId === selectedJob.id).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const selectedTime = selectedJob ? timeEntries.filter(entry => entry.jobId === selectedJob.id) : [];
  const maxProfit = Math.max(...jobReports.map(job => Math.abs(job.profit)), 1);

  const trendCard = (label: string, value: number, trend: number, goodWhenUp: boolean, icon: React.ReactNode) => {
    const good = goodWhenUp ? trend >= 0 : trend <= 0;
    return (
      <div className={`reports-kpi ${good ? 'good' : 'bad'}`}>
        {icon}
        <span>{label}</span>
        <strong>{formatCurrency(value)}</strong>
        <small>{trend >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />} {Math.abs(trend).toFixed(1)}% vs last month</small>
      </div>
    );
  };

  return (
    <div className="reports-bi-page">
      <section className="reports-hero">
        <div>
          <div className="page-eyebrow">Business Intelligence</div>
          <h1>Reports</h1>
          <p>Spot profit leaks, understand trends, and decide where the business needs attention next.</p>
        </div>
        <div className="reports-mode-toggle">
          <button className={comparisonMode === 'estimateActual' ? 'active' : ''} onClick={() => setComparisonMode('estimateActual')}>Estimate vs Actual</button>
          <button className={comparisonMode === 'monthMonth' ? 'active' : ''} onClick={() => setComparisonMode('monthMonth')}>This Month vs Last Month</button>
        </div>
      </section>

      <section className="reports-kpi-grid">
        {trendCard('Revenue', comparisonMode === 'monthMonth' ? monthly.current.revenue : totals.revenue, revenueTrend, true, <DollarSign size={20} />)}
        {trendCard('Cost', comparisonMode === 'monthMonth' ? monthly.current.cost : totals.cost, comparisonMode === 'monthMonth' ? costTrend : percentChange(totals.cost, totals.estimatedCost), false, <PieChart size={20} />)}
        {trendCard('Profit', comparisonMode === 'monthMonth' ? monthly.current.profit : totals.profit, comparisonMode === 'monthMonth' ? profitTrend : percentChange(totals.profit, totals.estimatedProfit), true, <TrendingUp size={20} />)}
        <div className={`reports-kpi ${totalMargin >= 25 ? 'good' : totalMargin < 15 ? 'bad' : ''}`}>
          <BarChart3 size={20} />
          <span>Margin</span>
          <strong>{totalMargin.toFixed(1)}%</strong>
          <small>{formatCurrency(costVariance)} cost variance</small>
        </div>
      </section>

      <section className="reports-trends">
        <div className="reports-trend-panel">
          <h2>Trends</h2>
          {[
            { label: 'Revenue trend', value: monthly.current.revenue, previous: monthly.previous.revenue, className: 'revenue' },
            { label: 'Cost trend', value: monthly.current.cost, previous: monthly.previous.cost, className: 'cost' },
            { label: 'Profit trend', value: monthly.current.profit, previous: monthly.previous.profit, className: 'profit' },
          ].map(item => {
            const max = Math.max(item.value, item.previous, 1);
            return (
              <div key={item.label} className="reports-trend-row">
                <div><strong>{item.label}</strong><span>{formatCurrency(item.value)} current / {formatCurrency(item.previous)} previous</span></div>
                <div className="reports-trend-bars">
                  <i className={item.className} style={{ width: `${(item.value / max) * 100}%` }} />
                  <em style={{ width: `${(item.previous / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="reports-insight-card">
          <Zap size={22} />
          <h2>Decision Signal</h2>
          <p>{costVariance > 0 ? `Actual costs are ${formatCurrency(costVariance)} above estimate. Start with the over-budget jobs and cost drivers below.` : `Actual costs are ${formatCurrency(Math.abs(costVariance))} under estimate. Protect the current margin and watch jobs with low profit bars.`}</p>
        </div>
      </section>

      <section className="reports-problem-grid">
        <ProblemList title="Low Margin Jobs" icon={<TrendingDown size={18} />} jobs={lowMarginJobs} metric={(job) => `${job.margin.toFixed(1)}%`} onSelect={setSelectedJobId} />
        <ProblemList title="Over Budget Jobs" icon={<AlertTriangle size={18} />} jobs={overBudgetJobs} metric={(job) => formatCurrency(job.variance)} onSelect={setSelectedJobId} />
        <ProblemList title="High Cost Jobs" icon={<Briefcase size={18} />} jobs={highCostJobs} metric={(job) => formatCurrency(job.actualCost)} onSelect={setSelectedJobId} />
      </section>

      <section className="reports-main-grid">
        <div className="reports-table-card">
          <div className="reports-section-heading">
            <h2>Profit by Job</h2>
            <span>Variance, margin, and profit bars</span>
          </div>
          <div className="table-container">
            <table className="table reports-profit-table">
              <thead><tr><th>Job</th><th>Revenue</th><th>Estimate</th><th>Actual</th><th>Variance</th><th>Profit</th><th>Margin</th><th></th></tr></thead>
              <tbody>
                {jobReports.map(job => (
                  <tr key={job.id}>
                    <td><Link to={`/jobs/${job.id}`}>{job.name}</Link><small>{job.status.replace('_', ' ')}</small></td>
                    <td>{formatCurrency(job.revenue)}</td>
                    <td>{formatCurrency(job.estimatedCost)}</td>
                    <td>{formatCurrency(job.actualCost)}</td>
                    <td className={job.variance <= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(job.variance)}</td>
                    <td>
                      <span className={job.profit >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(job.profit)}</span>
                      <div className="reports-profit-bar"><i style={{ width: `${Math.min(100, Math.abs(job.profit) / maxProfit * 100)}%` }} className={job.profit >= 0 ? 'positive' : 'negative'} /></div>
                    </td>
                    <td><span className={`reports-margin-pill ${job.margin >= 25 ? 'good' : job.margin < 15 ? 'bad' : 'mid'}`}>{job.margin.toFixed(1)}%</span></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => setSelectedJobId(job.id)}><Eye size={14} /> Drill</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="reports-drilldown">
          {selectedJob ? (
            <>
              <div className="reports-section-heading">
                <h2>{selectedJob.name}</h2>
                <Link to={`/jobs/${selectedJob.id}`} className="btn btn-sm btn-secondary">Open Job</Link>
              </div>
              <div className="reports-breakdown-grid">
                <div><span>Labor</span><strong>{formatCurrency(selectedJob.labor)}</strong></div>
                <div><span>Materials</span><strong>{formatCurrency(selectedJob.materials)}</strong></div>
                <div><span>Paid</span><strong>{formatCurrency(selectedJob.paid)}</strong></div>
                <div><span>Margin</span><strong>{selectedJob.margin.toFixed(1)}%</strong></div>
              </div>
              <div className="reports-cost-split">
                <span style={{ width: `${selectedJob.actualCost > 0 ? (selectedJob.labor / selectedJob.actualCost) * 100 : 0}%` }} />
                <b style={{ width: `${selectedJob.actualCost > 0 ? (selectedJob.materials / selectedJob.actualCost) * 100 : 0}%` }} />
              </div>
              <small className="reports-split-label">Labor vs materials</small>
              <h3>Expense Timeline</h3>
              <div className="reports-expense-timeline">
                {selectedExpenses.slice(-7).map(expense => (
                  <div key={expense.id}><span>{formatDate(expense.date)}</span><strong>{expense.vendor}</strong><b>{formatCurrency(expense.amount)}</b></div>
                ))}
                {selectedTime.slice(-4).map(entry => (
                  <div key={entry.id}><span>{formatDate(entry.date)}</span><strong>Labor logged</strong><b>{formatCurrency(entry.laborCost)}</b></div>
                ))}
                {selectedExpenses.length + selectedTime.length === 0 && <p>No expense or labor timeline yet.</p>}
              </div>
            </>
          ) : <p>No job selected.</p>}
        </aside>
      </section>

      <section className="reports-insights-grid">
        <InsightList title="Top Performing Jobs" items={topPerformingJobs} value={(job) => `${job.margin.toFixed(1)}% margin`} />
        <InsightList title="Underperforming Jobs" items={underperformingJobs} value={(job) => `${formatCurrency(job.estimatedProfit - job.profit)} below target`} />
        <div className="reports-insight-list">
          <h2>Cost Drivers</h2>
          {costDrivers.map(driver => (
            <div key={driver.category} className="reports-driver-row">
              <div><strong>{driver.category.replace('_', ' ')}</strong><span>{driver.percent.toFixed(1)}% of total cost</span></div>
              <b>{formatCurrency(driver.amount)}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProblemList({ title, icon, jobs, metric, onSelect }: {
  title: string;
  icon: React.ReactNode;
  jobs: Array<{ id: string; name: string; status: string; margin: number; variance: number; actualCost: number }>;
  metric: (job: { margin: number; variance: number; actualCost: number }) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="reports-problem-card">
      <div className="reports-section-heading"><h2>{icon}{title}</h2></div>
      {jobs.length === 0 ? <p>No problem jobs in this category.</p> : jobs.map(job => (
        <button key={job.id} onClick={() => onSelect(job.id)}>
          <span>{job.name}<small>{job.status.replace('_', ' ')}</small></span>
          <strong>{metric(job)}</strong>
        </button>
      ))}
    </div>
  );
}

function InsightList({ title, items, value }: {
  title: string;
  items: Array<{ id: string; name: string; margin: number; estimatedProfit: number; profit: number }>;
  value: (job: { margin: number; estimatedProfit: number; profit: number }) => string;
}) {
  return (
    <div className="reports-insight-list">
      <h2>{title}</h2>
      {items.length === 0 ? <p>No data yet.</p> : items.map(job => (
        <div key={job.id} className="reports-driver-row">
          <div><strong>{job.name}</strong><span>{value(job)}</span></div>
          <Link to={`/jobs/${job.id}`}>View</Link>
        </div>
      ))}
    </div>
  );
}
