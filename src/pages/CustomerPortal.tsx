import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { approvePortalChangeOrder, approvePortalEstimate, getPortalWorkspace, signPortalDocument, type PortalWorkspace } from '../services/portalService';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { Estimate, EstimateLineItem, Invoice, SignatureRequest } from '../data/types';
import { Camera, CheckCircle2, ClipboardCheck, CreditCard, FileSignature, FileText, Home, Loader2, Mail, MapPin, ReceiptText } from 'lucide-react';

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

const createSignatureDataUrl = (name: string) => {
  const escaped = name.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char] || char));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180"><rect width="640" height="180" fill="#fff"/><text x="36" y="105" font-family="Georgia, 'Times New Roman', serif" font-size="54" font-style="italic" fill="#111827">${escaped}</text><line x1="32" y1="132" x2="608" y2="132" stroke="#94a3b8" stroke-width="2"/><text x="36" y="158" font-family="Arial, sans-serif" font-size="16" fill="#64748b">Electronically signed</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const documentTypeLabel = (request: SignatureRequest) => request.documentType.replace(/_/g, ' ');

export function CustomerPortal() {
  const { token = '' } = useParams<{ token: string }>();
  const [workspace, setWorkspace] = useState<PortalWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [signatureConsent, setSignatureConsent] = useState(false);

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
        setSignatureName(loaded.customer.name);
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

  const signDocument = async (requestId: string) => {
    if (!signatureName.trim() || !signatureConsent) return;
    setBusyAction(`signature-${requestId}`);
    await signPortalDocument(token, requestId, signatureName.trim(), createSignatureDataUrl(signatureName.trim()), signatureName.trim());
    await loadPortal();
    setSignatureConsent(false);
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
        <div><strong>{workspace.signatureRequests.length}</strong><span>Documents</span></div>
        <div><strong>{workspace.photos.length}</strong><span>Photos</span></div>
      </section>

      <section className="portal-section">
        <div className="portal-section-heading">
          <FileSignature size={20} />
          <div>
            <h2>Documents to Sign</h2>
            <p>Review shared documents and sign with your legal name.</p>
          </div>
        </div>
        <div className="portal-card-grid">
          {workspace.signatureRequests.map(request => (
            <article className="portal-card portal-signature-card" key={request.id}>
              <div className="portal-card-header">
                <div>
                  <h3>{request.documentTitle || request.title}</h3>
                  <p>{documentTypeLabel(request)} {request.expiresAt ? `| expires ${formatDate(request.expiresAt)}` : ''}</p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              {request.message && <p>{request.message}</p>}
              <div className="portal-document-preview">{request.documentBody}</div>
              {request.status === 'signed' ? (
                <div className="portal-signature-complete">
                  {request.signatureDataUrl && <img src={request.signatureDataUrl} alt={`Signature for ${request.signerName || 'customer'}`} />}
                  <span>Signed by {request.signerName || request.signatureText || 'customer'}{request.signedAt ? ` on ${formatDate(request.signedAt)}` : ''}</span>
                </div>
              ) : (
                <div className="portal-sign-form">
                  <label>
                    Legal signature name
                    <input value={signatureName} onChange={event => setSignatureName(event.target.value)} />
                  </label>
                  <label className="portal-checkbox">
                    <input type="checkbox" checked={signatureConsent} onChange={event => setSignatureConsent(event.target.checked)} />
                    <span>I agree this typed name is my electronic signature for this document.</span>
                  </label>
                  <button className="portal-primary-btn" onClick={() => signDocument(request.id)} disabled={!signatureName.trim() || !signatureConsent || busyAction === `signature-${request.id}`}>
                    <FileSignature size={17} /> Sign Document
                  </button>
                </div>
              )}
            </article>
          ))}
          {!workspace.signatureRequests.length && <div className="portal-empty">No documents are waiting for signature.</div>}
        </div>
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
                <span className="portal-payment-note"><CreditCard size={16} /> Online payment not set up</span>
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
