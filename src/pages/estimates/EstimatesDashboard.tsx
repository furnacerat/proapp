import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ESTIMATE_STATUSES } from '../../data/types';
import {
  Plus, FileText, Send, CheckCircle, Clock, Briefcase, Calculator,
  TrendingUp, ArrowRight, ChevronRight, Eye, BriefcaseBusiness, ClipboardList
} from 'lucide-react';

export function EstimatesDashboard() {
  const { estimates, getEstimateCustomer } = useApp();

  const stats = useMemo(() => {
    const draft = estimates.filter(e => e.status === 'draft');
    const sent = estimates.filter(e => e.status === 'sent' || e.status === 'viewed');
    const approved = estimates.filter(e => e.status === 'approved');
    const totalValue = estimates.reduce((sum, e) => sum + e.total, 0);
    return { total: estimates.length, draft: draft.length, sent: sent.length, approved: approved.length, totalValue };
  }, [estimates]);

  const recentEstimates = useMemo(() =>
    [...estimates].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
  [estimates]);

  const pending = useMemo(() =>
    estimates.filter(e => e.status === 'sent' || e.status === 'viewed' || e.status === 'in_review')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  [estimates]);

  const nextAction = useMemo(() => {
    if (stats.total === 0) return { label: 'Create your first estimate', sub: 'Turn a site visit into a professional estimate in under 60 seconds.', to: '/estimates/new', primary: true };
    if (stats.draft > 0) return { label: 'Follow up on drafts', sub: 'Send your draft estimates to move them forward.', to: '/estimates', primary: false };
    if (stats.sent > 0) return { label: 'Awaiting responses', sub: 'Check in with customers or send a reminder.', to: '/estimates', primary: false };
    return { label: 'Create another estimate', sub: 'Keep the pipeline full by adding new opportunities.', to: '/estimates/new', primary: true };
  }, [stats]);

  const pipelineStages = [
    { label: 'Draft', count: stats.draft, color: '#6b7280' },
    { label: 'Sent', count: stats.sent, color: '#3b82f6' },
    { label: 'Approved', count: stats.approved, color: '#10b981' },
  ];

  const maxStage = Math.max(stats.draft, stats.sent, stats.approved, 1);

  const badge = (status: string) => {
    const m: Record<string, string> = { draft: 'badge-gray', in_review: 'badge-yellow', sent: 'badge-blue', viewed: 'badge-blue', approved: 'badge-green', rejected: 'badge-red', expired: 'badge-yellow', archived: 'badge-gray', converted: 'badge-green' };
    return m[status] || 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Sales Pipeline</div>
          <h1 className="page-title">Estimates</h1>
          <p className="page-subtitle">Track draft, sent, approved, and converted estimates from one focused estimating dashboard.</p>
        </div>
        <Link to="/estimates/new" className="btn btn-primary"><Plus size={18} /><span>New Estimate</span></Link>
      </div>

      <div className="page-content">
        {/* Next Action Strip */}
        <div className={`card mb-6 ${stats.total === 0 ? 'nextActionCard' : 'nextActionHint'}`}>
          <div className="card-body flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={nextAction.primary ? 'nextActionIconPrimary' : 'nextActionIconSecondary'}>
                {nextAction.primary ? <Plus size={20} /> : <TrendingUp size={20} />}
              </div>
              <div>
                <div className="font-semibold">{nextAction.label}</div>
                <div className="text-sm text-muted">{nextAction.sub}</div>
              </div>
            </div>
            <Link to={nextAction.to} className={nextAction.primary ? 'btn btn-primary' : 'btn btn-secondary'}>
              <span>{nextAction.primary ? 'Create Estimate' : 'View Estimates'}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Empty State — Get Started Panel */}
        {stats.total === 0 && (
          <div className="card mb-6 emptyStateCard">
            <div className="card-body">
              <div className="emptyStateGrid">
                <div className="emptyStateLeft">
                  <div className="emptyStateHeadline">Create your first estimate in under 60 seconds</div>
                  <div className="emptyStateBody">Start with a template, add your scope of work, set your markup, and send a professional estimate — all before you leave the jobsite.</div>
                  <div className="flex gap-3 mt-6">
                    <Link to="/estimates/new" className="btn btn-primary btn-lg"><Plus size={18} /><span>Create Estimate</span></Link>
                    <Link to="/estimates/templates" className="btn btn-secondary btn-lg"><ClipboardList size={18} /><span>Use Template</span></Link>
                  </div>
                </div>
                <div className="emptyStateRight">
                  <div className="emptyFeature"><CheckCircle size={16} /><span>Professional layouts ready to send</span></div>
                  <div className="emptyFeature"><CheckCircle size={16} /><span>Built-in markup and labor pricing</span></div>
                  <div className="emptyFeature"><CheckCircle size={16} /><span>Email directly to customers</span></div>
                  <div className="emptyFeature"><CheckCircle size={16} /><span>Convert approved estimates to jobs</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2"><FileText size={18} className="text-primary" /><span className="kpi-label">Total</span></div>
            <div className="kpi-value kpi-primary">{stats.total}</div>
            <div className="kpi-sub">{formatCurrency(stats.totalValue)} value</div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2"><Clock size={18} className="text-warning" /><span className="kpi-label">Draft</span></div>
            <div className="kpi-value">{stats.draft}</div>
            <div className="kpi-sub">in progress</div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2"><Send size={18} className="text-blue-500" /><span className="kpi-label">Awaiting</span></div>
            <div className="kpi-value">{stats.sent}</div>
            <div className="kpi-sub">awaiting response</div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2"><CheckCircle size={18} className="text-success" /><span className="kpi-label">Approved</span></div>
            <div className="kpi-value">{stats.approved}</div>
            <div className="kpi-sub">approved value</div>
          </div>
        </div>

        {/* Pipeline Bar */}
        <div className="card mb-6">
          <div className="card-header"><h3 className="card-title">Pipeline</h3></div>
          <div className="card-body">
            <div className="pipelineBar">
              {pipelineStages.map(s => (
                <div key={s.label} className="pipelineRow">
                  <div className="pipelineTrack">
                    <div className="pipelineFill" style={{ width: `${Math.max((s.count / maxStage) * 100, s.count > 0 ? 10 : 0)}%`, background: s.color }} />
                  </div>
                  <div className="pipelineLabel">
                    <span className="pipelineDot" style={{ background: s.color }} />
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="pipelineCount" style={{ color: s.color }}>{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions + Pending Response */}
        <div className="grid-2 gap-6 mb-6">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Quick Actions</h3></div>
            <div className="card-body">
              <div className="actionSection">
                <div className="actionSectionLabel">Start</div>
                <Link to="/estimates/new" className="btn btn-primary w-full"><Plus size={18} /><span>New Estimate</span></Link>
                <Link to="/estimates/templates" className="btn btn-secondary w-full"><ClipboardList size={18} /><span>From Template</span></Link>
              </div>
              <div className="actionDivider" />
              <div className="actionSection">
                <div className="actionSectionLabel">Manage</div>
                <Link to="/estimates" className="btn btn-secondary w-full"><Calculator size={18} /><span>View All Estimates</span></Link>
                <Link to="/jobs" className="btn btn-secondary w-full"><Briefcase size={18} /><span>View All Jobs</span></Link>
              </div>
            </div>
          </div>

          {/* Pending Response */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pending Response</h3>
              <span className="badge badge-blue">{pending.length}</span>
            </div>
            <div className="card-body">
              {pending.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-3">Checkmark</div>
                  <div className="font-medium mb-1">No follow-ups needed</div>
                  <div className="text-sm text-muted">All estimates have been responded to. Great job staying on top of things.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.slice(0, 4).map(est => {
                    const cust = getEstimateCustomer(est.id);
                    const days = Math.floor((Date.now() - new Date(est.updatedAt).getTime()) / 86400000);
                    return (
                      <Link key={est.id} to={`/estimates/${est.id}`} className="pendingRow">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{est.name}</div>
                          <div className="text-xs text-muted">{cust?.name || 'No customer'}{days > 0 ? ` · ${days}d ago` : ''}</div>
                        </div>
                        <span className={`badge ${badge(est.status)}`}>{est.status}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Estimates */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">Recent Estimates</h3>
              <div className="flex gap-2">
                <Link to="/estimates/new" className="btn btn-sm btn-primary"><Plus size={14} /><span>New</span></Link>
                <Link to="/estimates" className="btn btn-sm btn-secondary"><span>View All</span><ChevronRight size={14} /></Link>
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            {recentEstimates.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">Clipboard</div>
                <div className="font-medium mb-1">No estimates yet</div>
                <div className="text-sm text-muted mb-4">Create your first estimate to get started</div>
                <Link to="/estimates/new" className="btn btn-primary"><Plus size={16} /><span>Create Estimate</span></Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted border-b">
                    <th className="text-left py-3 px-4">Estimate</th>
                    <th className="text-left py-3 px-4">Customer</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-right py-3 px-4">Total</th>
                    <th className="text-right py-3 px-4">Updated</th>
                    <th className="py-3 px-4 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentEstimates.map(est => {
                    const cust = getEstimateCustomer(est.id);
                    return (
                      <tr key={est.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <Link to={`/estimates/${est.id}`} className="font-medium hover:text-primary">{est.name}</Link>
                          <div className="text-xs text-muted">{est.estimateNumber}</div>
                        </td>
                        <td className="py-3 px-4 text-sm">{cust?.name || <span className="text-muted">None</span>}</td>
                        <td className="py-3 px-4 text-center"><span className={`badge ${badge(est.status)}`}>{ESTIMATE_STATUSES.find(s => s.value === est.status)?.label || est.status}</span></td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(est.total)}</td>
                        <td className="py-3 px-4 text-right text-sm text-muted">{formatDate(est.updatedAt)}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 justify-end">
                            <Link to={`/estimates/${est.id}`} className="btn btn-sm btn-icon" title="View"><Eye size={14} /></Link>
                            <Link to={`/estimates/${est.id}?edit=true`} className="btn btn-sm btn-icon" title="Edit"><BriefcaseBusiness size={14} /></Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}