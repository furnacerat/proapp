import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../../data/types';
import { 
  Plus, FileText, Send, CheckCircle, XCircle, Clock, Archive,
  Briefcase, Calculator, TrendingUp, Users, ChevronRight
} from 'lucide-react';

export function EstimatesDashboard() {
  const { estimates, getEstimateCustomer, addEstimate, duplicateEstimate } = useApp();
  
  const stats = useMemo(() => {
    const draft = estimates.filter(e => e.status === 'draft');
    const sent = estimates.filter(e => e.status === 'sent' || e.status === 'viewed');
    const approved = estimates.filter(e => e.status === 'approved');
    const rejected = estimates.filter(e => e.status === 'rejected');
    const converted = estimates.filter(e => e.status === 'converted' || e.convertedToJobId);
    const archived = estimates.filter(e => e.status === 'archived');
    
    const totalValue = estimates.reduce((sum, e) => sum + e.total, 0);
    const draftValue = draft.reduce((sum, e) => sum + e.total, 0);
    const sentValue = sent.reduce((sum, e) => sum + e.total, 0);
    const approvedValue = approved.reduce((sum, e) => sum + e.total, 0);
    
    return {
      total: estimates.length,
      draft: { count: draft.length, value: draftValue },
      sent: { count: sent.length, value: sentValue },
      approved: { count: approved.length, value: approvedValue },
      rejected: { count: rejected.length },
      converted: { count: converted.length },
      archived: { count: archived.length },
      totalValue,
    };
  }, [estimates]);

  const recentEstimates = useMemo(() => {
    return [...estimates]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [estimates]);

  const pendingEstimates = useMemo(() => {
    return estimates
      .filter(e => e.status === 'sent' || e.status === 'viewed' || e.status === 'in_review')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [estimates]);

  const quickActions = [
    { label: 'New Estimate', to: '/estimates/new', icon: Plus, primary: true },
    { label: 'From Template', to: '/estimates/templates', icon: FileText },
    { label: 'View All Jobs', to: '/jobs', icon: Briefcase },
  ];

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      in_review: 'bg-yellow-100 text-yellow-700',
      sent: 'bg-blue-100 text-blue-700',
      viewed: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-gray-100 text-gray-500',
      converted: 'bg-green-100 text-green-700',
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Estimates</h1>
        </div>
        <Link to="/estimates/new" className="btn btn-primary">
          <Plus size={18} /> New Estimate
        </Link>
      </div>

      <div className="page-content">
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={18} className="text-primary" />
              <span className="kpi-label">Total Estimates</span>
            </div>
            <div className="kpi-value kpi-primary">{stats.total}</div>
            <div className="kpi-sub">{formatCurrency(stats.totalValue)} total value</div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-warning" />
              <span className="kpi-label">Draft</span>
            </div>
            <div className="kpi-value">{stats.draft.count}</div>
            <div className="kpi-sub">{formatCurrency(stats.draft.value)} value</div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <Send size={18} className="text-blue-500" />
              <span className="kpi-label">Awaiting Response</span>
            </div>
            <div className="kpi-value">{stats.sent.count}</div>
            <div className="kpi-sub">{formatCurrency(stats.sent.value)} value</div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={18} className="text-success" />
              <span className="kpi-label">Approved</span>
            </div>
            <div className="kpi-value">{stats.approved.count}</div>
            <div className="kpi-sub">{formatCurrency(stats.approved.value)} value</div>
          </div>
        </div>

        <div className="grid-2 gap-6 mb-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            <div className="card-body">
              <div className="space-y-2">
                {quickActions.map(action => (
                  <Link
                    key={action.label}
                    to={action.to}
                    className={`btn ${action.primary ? 'btn-primary' : 'btn-secondary'} w-full flex items-center justify-center gap-2`}
                  >
                    <action.icon size={18} />
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pending Response</h3>
            </div>
            <div className="card-body">
              {pendingEstimates.length === 0 ? (
                <div className="text-center text-muted py-4">No estimates awaiting response</div>
              ) : (
                <div className="space-y-3">
                  {pendingEstimates.slice(0, 4).map(estimate => {
                    const customer = getEstimateCustomer(estimate.id);
                    return (
                      <Link
                        key={estimate.id}
                        to={`/estimates/${estimate.id}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        <div>
                          <div className="font-medium text-sm">{estimate.name}</div>
                          <div className="text-xs text-muted">{customer?.name}</div>
                        </div>
                        <span className={`badge ${getStatusBadge(estimate.status)}`}>
                          {ESTIMATE_STATUSES.find(s => s.value === estimate.status)?.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">Recent Estimates</h3>
              <Link to="/estimates" className="btn btn-sm btn-secondary">
                View All <ChevronRight size={14} />
              </Link>
            </div>
          </div>
          <div className="card-body">
            {recentEstimates.length === 0 ? (
              <div className="text-center text-muted py-8">
                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                <p>No estimates yet. Create your first estimate to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEstimates.map(estimate => {
                  const customer = getEstimateCustomer(estimate.id);
                  return (
                    <Link
                      key={estimate.id}
                      to={`/estimates/${estimate.id}`}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{estimate.name}</span>
                          <span className={`badge ${getStatusBadge(estimate.status)}`}>
                            {ESTIMATE_STATUSES.find(s => s.value === estimate.status)?.label}
                          </span>
                        </div>
                        <div className="text-sm text-muted mt-1">
                          {estimate.estimateNumber} • {customer?.name || 'No customer'} • {JOB_TYPES.find(t => t.value === estimate.type)?.label}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(estimate.total)}</div>
                        <div className="text-xs text-muted">Updated {formatDate(estimate.updatedAt)}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}