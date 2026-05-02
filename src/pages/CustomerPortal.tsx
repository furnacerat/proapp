import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { approvePortalChangeOrder, approvePortalEstimate, getPortalWorkspace, type PortalWorkspace } from '../services/portalService';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { Estimate, EstimateLineItem, Invoice } from '../data/types';
import { Camera, CheckCircle2, ClipboardCheck, CreditCard, FileText, Home, Loader2, Mail, MapPin, ReceiptText } from 'lucide-react';

const invoiceBalance = (invoice: Invoice, payments: { invoiceId: string; amount: number }[]) => {
  const paid = payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max((invoice.total ?? invoice.amount) - paid, 0);
};

const estimateItems = (estimate: Estimate): EstimateLineItem[] => [
  ...(estimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
  ...(estimate.sections || []).flatMap(section => section.lineItems || []),
];

function StatusBadge({ status }: { status: string }) {
  return <span className={`portal-badge status-${status}`}>{status.replace(/_/g, ' ')}</span>;
}

export function CustomerPortal() {
  const { token = '' } = useParams<{ token: string }>();
  const [workspace, setWorkspace] = useState<PortalWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const loadPortal = async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await getPortalWorkspace(token);
      if (!loaded) {
        setError('This portal link is invalid, expired, or no longer active.');
        setWorkspace(null);
      } else {
        setWorkspace(loaded);
        setCustomerName(loaded.customer.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPortal();
  }, [token]);

  const primaryJob = workspace?.jobs[0];
  const outstandingBalance = useMemo(() => {
    if (!workspace) return 0;
    return workspace.invoices.reduce((sum, invoice) => sum + invoiceBalance(invoice, workspace.payments), 0);
  }, [workspace]);

  const approveEstimate = async (estimateId: string) => {
    setBusyAction(`estimate-${estimateId}`);
    await approvePortalEstimate(token, estimateId, customerName || workspace?.customer.name || 'Customer');
    await loadPortal();
    setBusyAction('');
  };

  const approveChangeOrder = async (changeOrderId: string) => {
    setBusyAction(`change-${changeOrderId}`);
    await approvePortalChangeOrder(token, changeOrderId, customerName || workspace?.customer.name || 'Customer');
    await loadPortal();
    setBusyAction('');
  };

  if (loading) {
    return (
      <main className="portal-shell portal-centered">
        <Loader2 className="portal-spinner" size={28} />
        <p>Loading your project portal...</p>
      </main>
    );
  }

  if (error || !workspace) {
    return (
      <main className="portal-shell portal-centered">
        <div className="portal-empty-icon"><FileText size={28} /></div>
        <h1>Portal link unavailable</h1>
        <p>{error || 'We could not open this portal link.'}</p>
      </main>
    );
  }

  return (
    <main className="portal-shell">
      <section className="portal-hero">
        <div>
          <span className="portal-eyebrow"><Home size={15} /> Customer Portal</span>
          <h1>{primaryJob?.name || workspace.customer.name}</h1>
          <p>{primaryJob?.address || workspace.customer.address || 'Project information and approvals'}</p>
          <div className="portal-contact-row">
            {workspace.customer.email && <span><Mail size={15} /> {workspace.customer.email}</span>}
            {(primaryJob?.address || workspace.customer.address) && <span><MapPin size={15} /> {primaryJob?.address || workspace.customer.address}</span>}
          </div>
        </div>
        <div className="portal-balance-panel">
          <span>Open balance</span>
          <strong>{formatCurrency(outstandingBalance)}</strong>
          <small>{workspace.invoices.length} invoice{workspace.invoices.length === 1 ? '' : 's'} available</small>
        </div>
      </section>

      <section className="portal-kpi-grid">
        <div><strong>{workspace.estimates.length}</strong><span>Estimates</span></div>
        <div><strong>{workspace.changeOrders.length}</strong><span>Change orders</span></div>
        <div><strong>{workspace.photos.length}</strong><span>Photos</span></div>
        <div><strong>{workspace.jobs.length}</strong><span>Projects</span></div>
      </section>

      <section className="portal-section">
        <div className="portal-section-heading">
          <ClipboardCheck size={20} />
          <div>
            <h2>Approvals</h2>
            <p>Review estimates and change orders that need a decision.</p>
          </div>
        </div>
        <div className="portal-card-grid">
          {workspace.estimates.map(estimate => {
            const lineItems = estimateItems(estimate).filter(item => item.clientVisible !== false);
            const canApprove = ['sent', 'viewed', 'in_review'].includes(estimate.status);
            return (
              <article className="portal-card" key={estimate.id}>
                <div className="portal-card-header">
                  <div>
                    <h3>{estimate.name}</h3>
                    <p>{estimate.estimateNumber} {estimate.validUntil ? `| valid through ${formatDate(estimate.validUntil)}` : ''}</p>
                  </div>
                  <StatusBadge status={estimate.status} />
                </div>
                <strong className="portal-price">{formatCurrency(estimate.total)}</strong>
                <div className="portal-line-list">
                  {lineItems.slice(0, 5).map(item => (
                    <div key={item.id}>
                      <span>{item.name}</span>
                      <strong>{formatCurrency(item.priceTotal ?? item.total ?? 0)}</strong>
                    </div>
                  ))}
                  {lineItems.length > 5 && <small>{lineItems.length - 5} more line items</small>}
                </div>
                {canApprove ? (
                  <button className="portal-primary-btn" onClick={() => approveEstimate(estimate.id)} disabled={busyAction === `estimate-${estimate.id}`}>
                    <CheckCircle2 size={17} /> Approve Estimate
                  </button>
                ) : (
                  <span className="portal-muted-action">No action needed</span>
                )}
              </article>
            );
          })}

          {workspace.changeOrders.map(order => (
            <article className="portal-card" key={order.id}>
              <div className="portal-card-header">
                <div>
                  <h3>Change Order</h3>
                  <p>{formatDate(order.createdAt)}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <p>{order.description}</p>
              <strong className="portal-price">{formatCurrency(order.amount)}</strong>
              {order.status === 'pending' ? (
                <button className="portal-primary-btn" onClick={() => approveChangeOrder(order.id)} disabled={busyAction === `change-${order.id}`}>
                  <CheckCircle2 size={17} /> Approve Change Order
                </button>
              ) : (
                <span className="portal-muted-action">No action needed</span>
              )}
            </article>
          ))}

          {!workspace.estimates.length && !workspace.changeOrders.length && (
            <div className="portal-empty">No estimates or change orders are ready for review.</div>
          )}
        </div>
      </section>

      <section className="portal-section">
        <div className="portal-section-heading">
          <ReceiptText size={20} />
          <div>
            <h2>Invoices</h2>
            <p>View balances and payment status.</p>
          </div>
        </div>
        <div className="portal-list">
          {workspace.invoices.map(invoice => {
            const balance = invoiceBalance(invoice, workspace.payments);
            return (
              <div className="portal-list-row" key={invoice.id}>
                <div>
                  <strong>{invoice.invoiceNumber}</strong>
                  <span>{invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : 'No due date'} | {invoice.status}</span>
                </div>
                <div>
                  <strong>{formatCurrency(balance)}</strong>
                  <span>{balance > 0 ? 'Balance due' : 'Paid'}</span>
                </div>
                <button className="portal-secondary-btn" disabled><CreditCard size={16} /> Pay Online Soon</button>
              </div>
            );
          })}
          {!workspace.invoices.length && <div className="portal-empty">No invoices have been shared yet.</div>}
        </div>
      </section>

      <section className="portal-section">
        <div className="portal-section-heading">
          <Camera size={20} />
          <div>
            <h2>Progress</h2>
            <p>Photos and updates shared from the job.</p>
          </div>
        </div>
        <div className="portal-photo-grid">
          {workspace.photos.map(photo => (
            <figure key={photo.id}>
              <img src={photo.url} alt={photo.description || photo.category} />
              <figcaption>{photo.description || photo.category} <span>{formatDate(photo.createdAt)}</span></figcaption>
            </figure>
          ))}
          {!workspace.photos.length && <div className="portal-empty">No project photos have been shared yet.</div>}
        </div>
        {!!workspace.timeline.length && (
          <div className="portal-timeline">
            {workspace.timeline.map(entry => (
              <div key={entry.id}>
                <strong>{entry.title}</strong>
                <span>{formatDate(entry.timestamp)}</span>
                {entry.description && <p>{entry.description}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
