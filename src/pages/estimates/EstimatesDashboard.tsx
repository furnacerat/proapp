import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../../data/types';
import {
  Plus, FileText, Send, CheckCircle, Clock, Briefcase, Calculator,
  TrendingUp, ArrowRight, ChevronRight, Eye, BriefcaseBusiness,
  ClipboardList, Zap, DollarSign, BarChart2, Users, Mail
} from 'lucide-react';

export function EstimatesDashboard() {
  const { estimates, getEstimateCustomer } = useApp();

  const stats = useMemo(() => {
    const draft = estimates.filter(e => e.status === 'draft');
    const sent = estimates.filter(e => e.status === 'sent' || e.status === 'viewed' || e.status === 'in_review');
    const approved = estimates.filter(e => e.status === 'approved');
    const totalValue = estimates.reduce((sum, e) => sum + e.total, 0);
    const approvedValue = approved.reduce((sum, e) => sum + e.total, 0);
    return { total: estimates.length, draft: draft.length, sent: sent.length, approved: approved.length, totalValue, approvedValue };
  }, [estimates]);

  const recentEstimates = useMemo(() =>
    [...estimates].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8),
  [estimates]);

  const pending = useMemo(() =>
    estimates.filter(e => e.status === 'sent' || e.status === 'viewed' || e.status === 'in_review')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
  [estimates]);

  const nextAction = useMemo(() => {
    if (stats.total === 0) return {
      headline: 'Create your first estimate in under 60 seconds',
      sub: 'Start with a template, add your scope, set markup, and send a professional estimate — all before you leave the jobsite.',
      primary: { label: 'Create Estimate', to: '/estimates/new' },
      secondary: { label: 'Use a Template', to: '/estimates/templates' },
    };
    if (stats.draft > 0) return {
      headline: `${stats.draft} draft ${stats.draft === 1 ? 'estimate needs' : 'estimates need'} attention`,
      sub: 'Review, finalize, and send your drafts to move them forward in the pipeline.',
      primary: { label: 'Review Drafts', to: '/estimates' },
      secondary: null,
    };
    if (stats.sent > 0) return {
      headline: `${stats.sent} estimate${stats.sent > 1 ? 's' : ''} awaiting response`,
      sub: 'Follow up with customers or send a friendly reminder to keep momentum.',
      primary: { label: 'Send Reminder', to: '/estimates' },
      secondary: null,
    };
    if (stats.approved > 0) return {
      headline: `${stats.approved} approved estimate${stats.approved > 1 ? 's' : ''}`,
      sub: `${formatCurrency(stats.approvedValue)} in approved value ready to convert to jobs.`,
      primary: { label: 'Convert to Job', to: '/estimates' },
      secondary: null,
    };
    return {
      headline: 'Keep the pipeline full',
      sub: 'Add new opportunities every week to stay ahead of slow seasons.',
      primary: { label: 'Create Estimate', to: '/estimates/new' },
      secondary: null,
    };
  }, [stats]);

  const pipelineStages = [
    { label: 'Draft', count: stats.draft, color: '#64748b', bg: '#f1f5f9', icon: FileText },
    { label: 'Awaiting', count: stats.sent, color: '#f97316', bg: '#fff7ed', icon: Clock },
    { label: 'Approved', count: stats.approved, color: '#10b981', bg: '#f0fdf4', icon: CheckCircle },
  ];

  const badge = (status: string) => {
    const m: Record<string, string> = { draft: 'status-draft', in_review: 'status-review', sent: 'status-sent', viewed: 'status-sent', approved: 'status-approved', rejected: 'status-rejected', expired: 'status-review', archived: 'status-draft', converted: 'status-approved' };
    return m[status] || 'status-draft';
  };

  return (
    <div className="dash-root">
      {/* ── PAGE HEADER ── */}
      <div className="dash-header">
        <div className="dash-header-left">
          <div className="page-eyebrow">Sales Pipeline</div>
          <h1 className="page-title">Estimates</h1>
          <p className="page-subtitle">Your estimating command center — track, send, and close deals.</p>
        </div>
        <Link to="/estimates/new" className="btn btn-primary">
          <Plus size={18} /><span>New Estimate</span>
        </Link>
      </div>

      <div className="dash-content">

        {/* ── NEXT ACTION HERO ── */}
        <div className="nextActionHero">
          <div className="nextActionHeroInner">
            <div className="nextActionHeroText">
              <div className="nextActionHeroIcon">
                {stats.total === 0 ? <Zap size={22} /> : <TrendingUp size={22} />}
              </div>
              <div>
                <div className="nextActionHeroHeadline">{nextAction.headline}</div>
                <div className="nextActionHeroSub">{nextAction.sub}</div>
              </div>
            </div>
            <div className="nextActionHeroCtas">
              {nextAction.primary && (
                <Link to={nextAction.primary.to} className="btn btn-primary btn-lg">
                  <span>{nextAction.primary.label}</span><ArrowRight size={18} />
                </Link>
              )}
              {nextAction.secondary && (
                <Link to={nextAction.secondary.to} className="btn btn-ghost btn-lg">
                  <ClipboardList size={18} /><span>{nextAction.secondary.label}</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── KPI GRID ── */}
        <div className="kpiGrid">
          <div className="kpiCard">
            <div className="kpiCardIcon kpiCardIconBlue"><FileText size={20} /></div>
            <div className="kpiCardBody">
              <div className="kpiCardValue kpiValueBlue">{stats.total}</div>
              <div className="kpiCardLabel">Total Estimates</div>
              <div className="kpiCardSub">{formatCurrency(stats.totalValue)} in value</div>
            </div>
          </div>
          <div className="kpiCard">
            <div className="kpiCardIcon kpiCardIconAmber"><Clock size={20} /></div>
            <div className="kpiCardBody">
              <div className="kpiCardValue kpiValueAmber">{stats.draft}</div>
              <div className="kpiCardLabel">Draft</div>
              <div className="kpiCardSub">in progress</div>
            </div>
          </div>
          <div className="kpiCard">
            <div className="kpiCardIcon kpiCardIconOrange"><Send size={20} /></div>
            <div className="kpiCardBody">
              <div className="kpiCardValue kpiValueOrange">{stats.sent}</div>
              <div className="kpiCardLabel">Awaiting</div>
              <div className="kpiCardSub">awaiting response</div>
            </div>
          </div>
          <div className="kpiCard">
            <div className="kpiCardIcon kpiCardIconGreen"><CheckCircle size={20} /></div>
            <div className="kpiCardBody">
              <div className="kpiCardValue kpiValueGreen">{stats.approved}</div>
              <div className="kpiCardLabel">Approved</div>
              <div className="kpiCardSub">{formatCurrency(stats.approvedValue)} value</div>
            </div>
          </div>
        </div>

        {/* ── PIPELINE + PENDING ── */}
        <div className="dashMidGrid">

          {/* Pipeline */}
          <div className="dashCard">
            <div className="dashCardHeader">
              <div className="flex items-center gap-2">
                <BarChart2 size={18} className="text-primary" />
                <h3 className="dashCardTitle">Pipeline</h3>
              </div>
              <Link to="/estimates" className="btn btn-sm btn-ghost"><span>View all</span><ChevronRight size={14} /></Link>
            </div>
            <div className="dashCardBody">
              <div className="pipelineFlow">
                {pipelineStages.map((s, i) => (
                  <div key={s.label} className="pipelineStep">
                    {i > 0 && <div className="pipelineConnector" />}
                    <div className="pipelineNode" style={{ background: s.bg, borderColor: s.color }}>
                      <s.icon size={18} style={{ color: s.color }} />
                    </div>
                    <div className="pipelineNodeLabel">
                      <div className="pipelineNodeCount" style={{ color: s.color }}>{s.count}</div>
                      <div className="pipelineNodeName">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pending Response */}
          <div className="dashCard">
            <div className="dashCardHeader">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-primary" />
                <h3 className="dashCardTitle">Pending Response</h3>
              </div>
              {pending.length > 0 && <span className="badge badge-orange">{pending.length}</span>}
            </div>
            <div className="dashCardBody">
              {pending.length === 0 ? (
                <div className="pendingEmpty">
                  <CheckCircle size={28} className="text-success mb-2 mx-auto" />
                  <div className="pendingEmptyTitle">All clear</div>
                  <div className="text-sm text-muted">No estimates awaiting a response. Nice work.</div>
                </div>
              ) : (
                <div className="pendingList">
                  {pending.map(est => {
                    const cust = getEstimateCustomer(est.id);
                    const days = Math.floor((Date.now() - new Date(est.updatedAt).getTime()) / 86400000);
                    return (
                      <Link key={est.id} to={`/estimates/${est.id}`} className="pendingItem">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{est.name}</div>
                          <div className="text-xs text-muted">{cust?.name || 'No customer'}{days > 0 ? ` · ${days}d ago` : ''}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`badge ${badge(est.status)}`}>{est.status}</span>
                          <ChevronRight size={14} className="text-muted" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── WORKFLOW LAUNCHER ── */}
        <div className="dashCard">
          <div className="dashCardHeader">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              <h3 className="dashCardTitle">Workflow Launcher</h3>
            </div>
          </div>
          <div className="dashCardBody">
            <div className="workflowGrid">

              <div className="workflowGroup">
                <div className="workflowGroupLabel">Start Work</div>
                <Link to="/estimates/new" className="btn btn-primary btn-lg w-full workflowBtn">
                  <Plus size={18} /><span>New Estimate</span><ArrowRight size={16} className="ml-auto" />
                </Link>
                <div className="workflowSubBtnRow">
                  <Link to="/estimates/templates" className="btn btn-secondary w-full"><ClipboardList size={16} /><span>From Template</span></Link>
                </div>
              </div>

              <div className="workflowDivider" />

              <div className="workflowGroup">
                <div className="workflowGroupLabel">Manage Work</div>
                <Link to="/estimates" className="btn btn-secondary btn-lg w-full workflowBtn">
                  <Calculator size={18} /><span>All Estimates</span><ArrowRight size={16} className="ml-auto" />
                </Link>
                <div className="workflowSubBtnRow">
                  <Link to="/jobs" className="btn btn-secondary w-full"><Briefcase size={16} /><span>Active Jobs</span></Link>
                  <Link to="/estimates/orders" className="btn btn-secondary w-full"><DollarSign size={16} /><span>Material Orders</span></Link>
                </div>
              </div>

              <div className="workflowDivider" />

              <div className="workflowGroup">
                <div className="workflowGroupLabel">Team</div>
                <Link to="/workers" className="btn btn-secondary btn-lg w-full workflowBtn">
                  <Users size={18} /><span>Workers</span><ArrowRight size={16} className="ml-auto" />
                </Link>
                <div className="workflowSubBtnRow">
                  <Link to="/estimates/suppliers" className="btn btn-secondary w-full"><DollarSign size={16} /><span>Suppliers</span></Link>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── RECENT ESTIMATES ── */}
        <div className="dashCard">
          <div className="dashCardHeader">
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-primary" />
              <h3 className="dashCardTitle">Recent Estimates</h3>
            </div>
            <div className="flex gap-2">
              <Link to="/estimates/new" className="btn btn-sm btn-primary"><Plus size={14} /><span>New</span></Link>
              <Link to="/estimates" className="btn btn-sm btn-ghost"><span>View all</span><ChevronRight size={14} /></Link>
            </div>
          </div>
          <div className="dashCardBody p-0">
            {recentEstimates.length === 0 ? (
              <div className="recentEmpty">
                <div className="recentEmptyIcon"><FileText size={36} /></div>
                <div className="recentEmptyTitle">No estimates yet</div>
                <div className="text-sm text-muted mb-4">Create your first estimate to start winning work.</div>
                <Link to="/estimates/new" className="btn btn-primary"><Plus size={16} /><span>Create Estimate</span></Link>
              </div>
            ) : (
              <table className="recentTable">
                <thead>
                  <tr className="recentTableHead">
                    <th className="text-left py-3 px-4">Estimate</th>
                    <th className="text-left py-3 px-4 hidden-mobile">Customer</th>
                    <th className="text-left py-3 px-4 hidden-mobile">Type</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-right py-3 px-4">Total</th>
                    <th className="text-right py-3 px-4 hidden-mobile">Updated</th>
                    <th className="py-3 px-4 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentEstimates.map(est => {
                    const cust = getEstimateCustomer(est.id);
                    const type = JOB_TYPES.find(t => t.value === est.type)?.label || est.type;
                    return (
                      <tr key={est.id} className="recentTableRow">
                        <td className="py-3 px-4">
                          <Link to={`/estimates/${est.id}`} className="font-semibold text-sm hover:text-primary">{est.name}</Link>
                          <div className="text-xs text-muted mt-0.5">{est.estimateNumber}</div>
                        </td>
                        <td className="py-3 px-4 text-sm hidden-mobile">{cust?.name || <span className="text-muted-soft">—</span>}</td>
                        <td className="py-3 px-4 text-sm text-muted hidden-mobile">{type}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`badge ${badge(est.status)}`}>{ESTIMATE_STATUSES.find(s => s.value === est.status)?.label || est.status}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">{formatCurrency(est.total)}</td>
                        <td className="py-3 px-4 text-right text-sm text-muted hidden-mobile">{formatDate(est.updatedAt)}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 justify-end">
                            <Link to={`/estimates/${est.id}`} className="btn btn-xs btn-icon" title="View"><Eye size={13} /></Link>
                            <Link to={`/estimates/${est.id}?edit=true`} className="btn btn-xs btn-icon" title="Edit"><BriefcaseBusiness size={13} /></Link>
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
