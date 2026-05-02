import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, parseDateString } from '../utils/formatters';
import { generateInsights, getWeeklySummary, getKPIS, generateSmartNextActions, getPerformanceInsights } from '../utils/insights';
import { JOB_TYPES } from '../data/types';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { OnboardingGuide } from '../components/onboarding/OnboardingGuide';
import {
  Plus, AlertTriangle, TrendingUp, DollarSign, Clock, CheckSquare, Users,
  Briefcase, Receipt, Activity, Zap, Target, AlertCircle, FileText
} from 'lucide-react';

export function Dashboard() {
  const { jobs, workers, tasks, timeEntries, expenses, invoices, payments, estimates, jobTemplates, createJobFromTemplate, alerts, clearAllAlerts, branding, materialOrders, shoppingLists, allowances } = useApp();
  const { showToast } = useToast();
  
  const [quickAddType, setQuickAddType] = useState<string | null>(null);
  const [templateModalJob, setTemplateModalJob] = useState({ name: '', address: '', customer: '', templateId: '' });

  const smartEnabled = branding.smartFeaturesEnabled !== false;
  const insights = useMemo(() => smartEnabled ? generateInsights(jobs, expenses, timeEntries, workers, invoices, payments, tasks) : [], [smartEnabled, jobs, expenses, timeEntries, workers, invoices, payments, tasks]);
  const smartActions = useMemo(() => smartEnabled ? generateSmartNextActions(estimates, jobs, expenses, timeEntries, invoices, payments, tasks, materialOrders, shoppingLists, allowances) : [], [smartEnabled, estimates, jobs, expenses, timeEntries, invoices, payments, tasks, materialOrders, shoppingLists, allowances]);
  const performance = useMemo(() => getPerformanceInsights(estimates, jobs, expenses, timeEntries, invoices, payments), [estimates, jobs, expenses, timeEntries, invoices, payments]);
  const weekly = useMemo(() => getWeeklySummary(jobs, timeEntries, expenses, payments), [jobs, timeEntries, expenses, payments]);
  const kpis = useMemo(() => getKPIS(jobs, expenses, timeEntries, invoices, payments), [jobs, expenses, timeEntries, invoices, payments]);

  const unreadAlerts = alerts.filter(a => !a.isRead);
  const overdueTasks = tasks.filter(t => t.dueDate && t.status !== 'done' && parseDateString(t.dueDate) < new Date());
  const highPriorityTasks = tasks.filter(t => t.status === 'open' && (t.priority === 'high' || t.priority === 'urgent'));
  const jobsDueSoon = jobs.filter(j => j.status === 'active' && parseDateString(j.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'done');
  const activeJobsNeedingAttention = jobs.filter(job => ['active', 'scheduled', 'awaiting_materials'].includes(job.status) && (
    !tasks.some(task => task.jobId === job.id && task.status !== 'done') ||
    !materialOrders.some(order => order.jobId === job.id) && !shoppingLists.some(list => list.jobId === job.id)
  ));
  const openShoppingLists = shoppingLists.filter(list => list.status !== 'completed' && list.status !== 'cancelled');
  const laborLoggedToday = timeEntries.filter(entry => entry.date === today).reduce((sum, entry) => sum + entry.totalHours, 0);
  const ordersInFlight = materialOrders.filter(order => !['received', 'cancelled'].includes(order.status));

  const handleCreateFromTemplate = () => {
    if (!templateModalJob.templateId || !templateModalJob.name || !templateModalJob.customer) {
      showToast('Fill required fields', 'error');
      return;
    }
    createJobFromTemplate(templateModalJob.templateId, templateModalJob.name, templateModalJob.address, templateModalJob.customer);
    showToast('Job created from template!');
    setQuickAddType(null);
    setTemplateModalJob({ name: '', address: '', customer: '', templateId: '' });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'success': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return 'badge badge-red';
      case 'high': return 'badge badge-orange';
      case 'medium': return 'badge badge-yellow';
      default: return 'badge badge-blue';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Operations Dashboard</div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">Command Center</h1>
            {unreadAlerts.length > 0 && (
              <button onClick={clearAllAlerts} className="btn btn-sm btn-secondary">
                <AlertCircle size={16} /> {unreadAlerts.length} Alerts
              </button>
            )}
          </div>
          <p className="page-subtitle">See what needs attention today across jobs, labor, cash flow, and open invoices.</p>
        </div>
        <div className="quick-actions">
          <Link to="/jobs" className="btn btn-primary"><Plus size={18} /> New Job</Link>
          <Link to="/estimates/new" className="btn btn-secondary"><FileText size={18} /> New Estimate</Link>
        </div>
      </div>

      <div className="page-content">
        <OnboardingGuide />

        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={18} className="text-primary" />
              <span className="kpi-label">Active Jobs</span>
            </div>
            <div className="kpi-value kpi-primary">{kpis.activeJobs}</div>
            <div className="kpi-sub">{kpis.totalJobs} total</div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={18} className="text-success" />
              <span className="kpi-label">Revenue</span>
            </div>
            <div className="kpi-value">{formatCurrency(kpis.totalRevenue)}</div>
            <div className="kpi-sub">{formatCurrency(kpis.totalProfit)} profit</div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-accent" />
              <span className="kpi-label">This Week</span>
            </div>
            <div className="kpi-value">{weekly.hours.toFixed(1)}h</div>
            <div className="kpi-sub">{formatCurrency(weekly.laborCost)} labor</div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <Receipt size={18} className="text-danger" />
              <span className="kpi-label">Outstanding</span>
            </div>
            <div className="kpi-value kpi-accent">{formatCurrency(kpis.outstanding)}</div>
            <div className="kpi-sub">{unpaidInvoices.length} invoices</div>
          </div>
        </div>

        {smartEnabled ? (
          <div className="smart-priority-card mb-6">
            <div className="smart-priority-header">
              <div>
                <div className="page-eyebrow">Smart Next Action Engine</div>
                <h3>Priority Recommendations</h3>
              </div>
              <span className="badge badge-green">Smart Mode On</span>
            </div>
            <div className="smart-priority-grid">
              <div className="smart-priority-main">
                {smartActions.length > 0 ? (
                  smartActions.slice(0, 4).map(action => (
                    <Link key={action.id} to={action.to} className="smart-action-item">
                      <span className={getPriorityBadge(action.priority)}>{action.priority}</span>
                      <div className="smart-action-copy">
                        <strong>{action.title}</strong>
                        <p>{action.description}</p>
                      </div>
                      <span className="btn btn-sm btn-secondary">{action.actionLabel}</span>
                    </Link>
                  ))
                ) : (
                  <div className="smart-empty-state">
                    <CheckSquare size={28} />
                    <div>
                      <strong>No urgent actions right now</strong>
                      <p>Smart Mode will surface follow-ups, job delays, over-budget work, and payment reminders here.</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="smart-snapshot">
                <div className="smart-snapshot-row"><span>Avg. Margin</span><strong>{performance.averageProfitMargin.toFixed(1)}%</strong></div>
                <div className="smart-snapshot-row"><span>Close Rate</span><strong>{performance.closeRate.toFixed(0)}%</strong></div>
                <div className="smart-snapshot-row"><span>Cash Outlook</span><strong className={performance.cashFlowBalance >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(performance.cashFlowBalance)}</strong></div>
                {performance.underpricingWarnings[0] && (
                  <div className="smart-warning-note">{performance.underpricingWarnings[0]}</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card mb-6">
            <div className="card-body flex items-center justify-between gap-4">
              <div>
                <div className="font-bold">Smart Mode is off</div>
                <div className="text-sm text-muted">Enable smart features in Settings to see recommendations and automation alerts.</div>
              </div>
              <Link to="/settings" className="btn btn-primary">Open Settings</Link>
            </div>
          </div>
        )}

        {smartEnabled && <div className="card mb-6">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-primary" />
              <h3 className="card-title">AI Business Insights</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="grid-2 gap-4">
              {insights.slice(0, 6).map(insight => (
                <div key={insight.id} className={`p-4 rounded-lg border-l-4 ${getSeverityColor(insight.severity)} bg-white shadow-sm`}>
                  <div className="font-medium text-sm">{insight.title}</div>
                  <div className="text-sm text-secondary mt-1">{insight.description}</div>
                  {insight.jobId && (
                    <Link to={`/jobs/${insight.jobId}`} className="text-xs text-primary mt-2 inline-block">
                      View Job →
                    </Link>
                  )}
                </div>
              ))}
              {insights.length === 0 && (
                <div className="text-center text-muted py-4">No insights available</div>
              )}
            </div>
          </div>
        </div>}

        <div className="connected-flow-card mb-6">
          <div className="connected-flow-header">
            <div>
              <div className="page-eyebrow">Daily Command Center</div>
              <h3>Connected Workflow Pulse</h3>
            </div>
            <span className="badge badge-blue">Customer - Estimate - Job - Cash</span>
          </div>
          <div className="connected-flow-grid">
            <Link to="/tasks" className="connected-flow-item"><strong>{todayTasks.length}</strong><span>Today's tasks</span></Link>
            <Link to="/jobs" className="connected-flow-item"><strong>{activeJobsNeedingAttention.length}</strong><span>Jobs needing attention</span></Link>
            <Link to="/estimates/orders" className="connected-flow-item"><strong>{ordersInFlight.length}</strong><span>Orders in flight</span></Link>
            <Link to="/shopping-lists" className="connected-flow-item"><strong>{openShoppingLists.length}</strong><span>Open shopping lists</span></Link>
            <Link to="/time-entries" className="connected-flow-item"><strong>{laborLoggedToday.toFixed(1)}h</strong><span>Labor logged today</span></Link>
            <Link to="/invoices" className="connected-flow-item"><strong>{unpaidInvoices.length}</strong><span>Due or overdue invoices</span></Link>
          </div>
        </div>

        <div className="grid-2 gap-6 mb-6">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                <h3 className="card-title">Today's Focus</h3>
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {overdueTasks.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-red">{overdueTasks.length}</span>
                      <span className="text-sm">Overdue Tasks</span>
                    </div>
                    <Link to="/tasks" className="btn btn-sm btn-danger">View</Link>
                  </div>
                )}
                
                {unpaidInvoices.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-yellow">{unpaidInvoices.length}</span>
                      <span className="text-sm">Unpaid Invoices</span>
                    </div>
                    <Link to="/invoices" className="btn btn-sm btn-secondary">View</Link>
                  </div>
                )}
                
                {jobsDueSoon.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-blue">{jobsDueSoon.length}</span>
                      <span className="text-sm">Jobs Due Soon</span>
                    </div>
                    <Link to="/jobs" className="btn btn-sm btn-secondary">View</Link>
                  </div>
                )}
                
                {highPriorityTasks.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-orange">{highPriorityTasks.length}</span>
                      <span className="text-sm">High Priority Tasks</span>
                    </div>
                    <Link to="/tasks" className="btn btn-sm btn-secondary">View</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            <div className="card-body">
              <div className="grid-2 gap-2">
                <Link to="/jobs" className="btn btn-primary flex items-center justify-center gap-2">
                  <Plus size={18} /> New Job
                </Link>
                <Link to="/tasks" className="btn btn-secondary flex items-center justify-center gap-2">
                  <Plus size={18} /> New Task
                </Link>
                <Link to="/time-entries" className="btn btn-secondary flex items-center justify-center gap-2">
                  <Clock size={18} /> Log Time
                </Link>
                <Link to="/expenses" className="btn btn-secondary flex items-center justify-center gap-2">
                  <Receipt size={18} /> Add Expense
                </Link>
                <Link to="/invoices" className="btn btn-secondary flex items-center justify-center gap-2">
                  <DollarSign size={18} /> Record Payment
                </Link>
                <button className="btn btn-accent flex items-center justify-center gap-2" onClick={() => setQuickAddType('template')}>
                  <Briefcase size={18} /> From Template
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Job Types Performance</h3>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {JOB_TYPES.slice(0, 4).map(type => {
                const typeJobs = jobs.filter(j => j.type === type.value);
                const completed = typeJobs.filter(j => j.status === 'completed').length;
                const active = typeJobs.filter(j => j.status === 'active').length;
                if (completed === 0 && active === 0) return null;
                return (
                  <div key={type.value} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted">{completed} completed, {active} active</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{typeJobs.length}</div>
                      <div className="text-xs text-muted">jobs</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={quickAddType === 'template'} onClose={() => setQuickAddType(null)} title="Create Job from Template" size="lg">
        <div className="form-group">
          <label className="form-label">Template *</label>
          <select className="form-select" value={templateModalJob.templateId} onChange={e => setTemplateModalJob({...templateModalJob, templateId: e.target.value})}>
            <option value="">Select a template...</option>
            {jobTemplates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Job Name *</label>
          <input className="form-input" value={templateModalJob.name} onChange={e => setTemplateModalJob({...templateModalJob, name: e.target.value})} placeholder="Job name" />
        </div>
        <div className="form-group">
          <label className="form-label">Customer *</label>
          <input className="form-input" value={templateModalJob.customer} onChange={e => setTemplateModalJob({...templateModalJob, customer: e.target.value})} placeholder="Customer name" />
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input className="form-input" value={templateModalJob.address} onChange={e => setTemplateModalJob({...templateModalJob, address: e.target.value})} placeholder="Job address" />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setQuickAddType(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreateFromTemplate}>Create Job</button>
        </div>
      </Modal>
    </div>
  );
}
