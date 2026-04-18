import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { PieChart, TrendingUp, DollarSign, Clock, Users } from 'lucide-react';
import { getJobLaborCost, getJobExpenseTotal } from '../utils/calculations';

export function Reports() {
  const { jobs, workers, timeEntries, expenses, invoices, payments } = useApp();
  const [reportType, setReportType] = useState('profit');

  const profitData = useMemo(() => {
    return jobs.filter(j => j.status === 'completed' || j.status === 'active' || j.status === 'closed').map(j => {
      const labor = getJobLaborCost(j.id, timeEntries);
      const material = getJobExpenseTotal(j.id, expenses);
      const total = labor + material;
      const profit = j.contractAmount - total;
      return { ...j, labor, material, total, profit };
    });
  }, [jobs, timeEntries, expenses]);

  const totalRevenue = profitData.reduce((sum, j) => sum + j.contractAmount, 0);
  const totalCost = profitData.reduce((sum, j) => sum + j.total, 0);
  const totalProfit = profitData.reduce((sum, j) => sum + j.profit, 0);

  const categoryData = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    return Object.entries(totals).map(([cat, amt]) => ({ category: cat, amount: amt, percent: totalCost > 0 ? (amt / totalCost) * 100 : 0 }));
  }, [expenses, totalCost]);

  const laborByJob = useMemo(() => {
    return jobs.map(j => ({ name: j.name, labor: getJobLaborCost(j.id, timeEntries) })).filter(j => j.labor > 0);
  }, [jobs, timeEntries]);

  const unpaidData = useMemo(() => {
    const paymentMap = new Map< string, number >();
    payments.forEach(p => { const cur = paymentMap.get(p.invoiceId) || 0; paymentMap.set(p.invoiceId, cur + p.amount); });
    return invoices.filter(i => { const paid = paymentMap.get(i.id) || 0; return paid < i.amount; }).map(i => {
      const job = jobs.find(j => j.id === i.jobId);
      const paid = paymentMap.get(i.id) || 0;
      return { ...i, jobName: job?.name || '', balance: i.amount - paid };
    });
  }, [invoices, payments, jobs]);

  const unpaidTotal = unpaidData.reduce((sum, i) => sum + i.balance, 0);

  const hoursByWorker = useMemo(() => {
    return workers.map(w => {
      const hours = timeEntries.filter(t => t.workerId === w.id).reduce((s, t) => s + t.totalHours, 0);
      return { name: w.name, hours, type: w.type };
    }).filter(w => w.hours > 0);
  }, [workers, timeEntries]);

  const totalHours = hoursByWorker.reduce((s, w) => s + w.hours, 0);

  const reports = [
    { id: 'profit', label: 'Profit by Job', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses by Category', icon: PieChart },
    { id: 'labor', label: 'Labor Cost by Job', icon: Clock },
    { id: 'unpaid', label: 'Unpaid Invoices', icon: DollarSign },
    { id: 'hours', label: 'Hours by Worker', icon: Users },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      <div className="page-content">
        <div className="flex gap-2 mb-4" style={{overflowX: 'auto'}}>
          {reports.map(r => (
            <button key={r.id} className={`btn ${reportType === r.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportType(r.id)}>
              <r.icon size={18} /> {r.label}
            </button>
          ))}
        </div>

        {reportType === 'profit' && (
          <div>
            <div className="kpi-grid mb-4">
              <div className="kpi-card"><div className="kpi-label">Total Revenue</div><div className="kpi-value">{formatCurrency(totalRevenue)}</div></div>
              <div className="kpi-card"><div className="kpi-label">Total Cost</div><div className="kpi-value">{formatCurrency(totalCost)}</div></div>
              <div className="kpi-card"><div className="kpi-label">Total Profit</div><div className={`kpi-value ${totalProfit >= 0 ? 'kpi-success' : 'kpi-danger'}`}>{formatCurrency(totalProfit)}</div></div>
              <div className="kpi-card"><div className="kpi-label">Profit Margin</div><div className="kpi-value">{totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(0) : 0}%</div></div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Profit by Job</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Job</th><th>Contract</th><th>Labor</th><th>Materials</th><th>Total Cost</th><th>Profit</th><th>Margin</th></tr></thead>
                  <tbody>
                    {profitData.length === 0 ? <tr><td colSpan={7} className="text-center text-muted">No data</td></tr> : profitData.map(j => (
                      <tr key={j.id}>
                        <td><Link to={`/jobs/${j.id}`}>{j.name}</Link></td>
                        <td>{formatCurrency(j.contractAmount)}</td>
                        <td>{formatCurrency(j.labor)}</td>
                        <td>{formatCurrency(j.material)}</td>
                        <td>{formatCurrency(j.total)}</td>
                        <td className={j.profit >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(j.profit)}</td>
                        <td>{j.contractAmount > 0 ? ((j.profit / j.contractAmount) * 100).toFixed(0) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {reportType === 'expenses' && (
          <div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Expenses by Category</h3><span className="badge badge-gray">{formatCurrency(totalCost)} total</span></div>
              <div className="card-body">
                {categoryData.length === 0 ? <p className="text-muted">No expenses</p> : categoryData.map(c => (
                  <div key={c.category} style={{marginBottom: '12px'}}>
                    <div className="flex justify-between mb-1"><span className="font-medium">{c.category}</span><span>{formatCurrency(c.amount)}</span></div>
                    <div style={{background: 'var(--border)', height: '8px', borderRadius: '4px'}}>
                      <div style={{background: 'var(--primary)', height: '100%', borderRadius: '4px', width: `${c.percent}%`}} />
                    </div>
                    <div className="text-sm text-muted">{c.percent.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {reportType === 'labor' && (
          <div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Labor Cost by Job</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Job</th><th>Labor Cost</th></tr></thead>
                  <tbody>
                    {laborByJob.length === 0 ? <tr><td colSpan={2} className="text-center text-muted">No data</td></tr> : laborByJob.map(j => (
                      <tr key={j.name}>
                        <td>{j.name}</td>
                        <td className="font-medium">{formatCurrency(j.labor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {reportType === 'unpaid' && (
          <div>
            <div className="kpi-card mb-4">
              <div className="kpi-label">Total Unpaid</div>
              <div className="kpi-value kpi-danger">{formatCurrency(unpaidTotal)}</div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Unpaid Invoices</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Invoice</th><th>Job</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead>
                  <tbody>
                    {unpaidData.length === 0 ? <tr><td colSpan={5} className="text-center text-muted">All paid!</td></tr> : unpaidData.map(i => (
                      <tr key={i.id}>
                        <td>{i.invoiceNumber}</td>
                        <td><Link to={`/jobs/${i.jobId}`}>{i.jobName}</Link></td>
                        <td>{formatCurrency(i.amount)}</td>
                        <td className="text-success">{formatCurrency(i.amount - i.balance)}</td>
                        <td className="font-medium text-danger">{formatCurrency(i.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {reportType === 'hours' && (
          <div>
            <div className="kpi-card mb-4">
              <div className="kpi-label">Total Hours</div>
              <div className="kpi-value">{totalHours.toFixed(1)}</div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Hours by Worker</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Worker</th><th>Type</th><th>Hours</th></tr></thead>
                  <tbody>
                    {hoursByWorker.length === 0 ? <tr><td colSpan={3} className="text-center text-muted">No data</td></tr> : hoursByWorker.map(w => (
                      <tr key={w.name}>
                        <td>{w.name}</td>
                        <td><span className="badge badge-gray">{w.type}</span></td>
                        <td className="font-medium">{w.hours.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}