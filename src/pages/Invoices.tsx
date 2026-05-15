import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock3,
  Copy,
  CreditCard,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, parseDateString } from '../utils/formatters';
import { INVOICE_TYPES, INVOICE_STATUSES } from '../data/types';
import type { Invoice, InvoiceStatus, PaymentMethod } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { buildClientInvoiceData } from '../utils/buildPrintData';
import { PrintTemplateModal } from '../components/print/PrintTemplateModal';
import type { PrintInvoiceData } from '../data/printTypes';
import { DEFAULT_PRINT_SETTINGS } from '../data/printTypes';
import { renderEmailAll } from '../utils/emailTemplates';

type GroupMode = 'none' | 'job' | 'customer' | 'status';

interface InvoiceSummary extends Invoice {
  jobName: string;
  customer: string;
  progress: number;
  paid: number;
  balance: number;
  effectiveStatus: InvoiceStatus;
  ageBucket: '0-7' | '8-30' | '30+';
  daysPastDue: number;
  expectedPaid: number;
  customerEmail?: string;
  customerPhone?: string;
}

const todayString = () => new Date().toISOString().split('T')[0];

export function Invoices() {
  const { customers, jobs, invoices, payments, addInvoice, updateInvoice, addPayment, deleteInvoice, getJobProgress, branding, sendEmail } = useApp();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [ageFilter, setAgeFilter] = useState<InvoiceSummary['ageBucket'] | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [paymentModalId, setPaymentModalId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [printData, setPrintData] = useState<PrintInvoiceData | null>(null);
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);
  const [sendMethod, setSendMethod] = useState<'email' | 'sms'>('email');
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  const [formData, setFormData] = useState({
    jobId: '', invoiceNumber: '', amount: '', type: 'deposit', dueDate: '', status: 'draft', notes: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '', date: todayString(), method: 'check', checkNumber: '', notes: ''
  });

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'overdue') setStatusFilter('overdue');
    if (status === 'open') setStatusFilter('');
  }, [searchParams]);

  const getInvoicePayments = (invoiceId: string) => payments.filter(payment => payment.invoiceId === invoiceId);

  const invoiceSummaries = useMemo<InvoiceSummary[]>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return invoices.map(invoice => {
      const job = jobs.find(item => item.id === invoice.jobId);
      const customer = customers.find(item => item.id === invoice.customerId || item.id === job?.customerId);
      const paid = payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0);
      const balance = Math.max(0, invoice.amount - paid);
      const dueDate = invoice.dueDate ? parseDateString(invoice.dueDate) : now;
      dueDate.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const effectiveStatus: InvoiceStatus = balance <= 0 ? 'paid' : daysPastDue > 0 && invoice.status !== 'draft' ? 'overdue' : paid > 0 ? 'partial' : invoice.status;
      const outstandingAge = Math.max(0, daysPastDue);
      const ageBucket: InvoiceSummary['ageBucket'] = outstandingAge <= 7 ? '0-7' : outstandingAge <= 30 ? '8-30' : '30+';
      const progress = job ? getJobProgress(job.id) : 0;
      return {
        ...invoice,
        jobName: job?.name || 'Unknown Job',
        customer: job?.customer || 'No customer',
        progress,
        paid,
        balance,
        effectiveStatus,
        ageBucket,
        daysPastDue,
        expectedPaid: job ? job.contractAmount * (progress / 100) : 0,
        customerEmail: customer?.email || job?.customerEmail,
        customerPhone: customer?.phone || job?.customerPhone,
      };
    }).sort((a, b) => parseDateString(a.dueDate || a.createdAt).getTime() - parseDateString(b.dueDate || b.createdAt).getTime());
  }, [customers, invoices, jobs, payments, getJobProgress]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoiceSummaries.filter(invoice => {
      if (query && ![invoice.invoiceNumber, invoice.jobName, invoice.customer, invoice.type, invoice.effectiveStatus].some(value => value.toLowerCase().includes(query))) return false;
      if (jobFilter && invoice.jobId !== jobFilter) return false;
      if (statusFilter && invoice.effectiveStatus !== statusFilter) return false;
      if (ageFilter && invoice.ageBucket !== ageFilter) return false;
      return true;
    });
  }, [invoiceSummaries, search, jobFilter, statusFilter, ageFilter]);

  const groupedInvoices = useMemo(() => {
    const groups = new Map<string, { label: string; invoices: InvoiceSummary[] }>();
    filteredInvoices.forEach(invoice => {
      const key = groupMode === 'job' ? invoice.jobId : groupMode === 'customer' ? invoice.customer : groupMode === 'status' ? invoice.effectiveStatus : 'all';
      const label = groupMode === 'job' ? invoice.jobName : groupMode === 'customer' ? invoice.customer : groupMode === 'status' ? invoice.effectiveStatus : 'Invoices';
      const group = groups.get(key) || { label, invoices: [] };
      group.invoices.push(invoice);
      groups.set(key, group);
    });
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
  }, [filteredInvoices, groupMode]);

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = invoiceSummaries.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdueInvoices = invoiceSummaries.filter(invoice => invoice.balance > 0 && invoice.effectiveStatus === 'overdue');
  const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const dueSoon = invoiceSummaries.filter(invoice => {
    if (invoice.balance <= 0 || invoice.effectiveStatus === 'overdue') return false;
    const due = parseDateString(invoice.dueDate);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  });
  const aging = {
    '0-7': invoiceSummaries.filter(invoice => invoice.balance > 0 && invoice.ageBucket === '0-7').reduce((sum, invoice) => sum + invoice.balance, 0),
    '8-30': invoiceSummaries.filter(invoice => invoice.balance > 0 && invoice.ageBucket === '8-30').reduce((sum, invoice) => sum + invoice.balance, 0),
    '30+': invoiceSummaries.filter(invoice => invoice.balance > 0 && invoice.ageBucket === '30+').reduce((sum, invoice) => sum + invoice.balance, 0),
  };

  const alerts = useMemo(() => {
    const underpaidJobs = jobs.map(job => {
      const progress = getJobProgress(job.id);
      const jobInvoices = invoiceSummaries.filter(invoice => invoice.jobId === job.id);
      const paid = jobInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
      const expected = job.contractAmount * (progress / 100);
      return { job, progress, paid, expected, shortfall: expected - paid };
    }).filter(item => item.progress >= 50 && item.shortfall > item.job.contractAmount * 0.15);
    const largeBalances = invoiceSummaries.filter(invoice => invoice.balance >= 5000);
    return [
      ...overdueInvoices.slice(0, 2).map(invoice => ({ title: 'Overdue invoice', detail: `${invoice.invoiceNumber} is ${formatCurrency(invoice.balance)} past due.` })),
      ...underpaidJobs.slice(0, 2).map(item => ({ title: 'Job underpaid vs progress', detail: `${item.job.name} is ${item.progress}% complete with ${formatCurrency(item.shortfall)} expected unpaid.` })),
      ...largeBalances.slice(0, 2).map(invoice => ({ title: 'Large outstanding balance', detail: `${invoice.invoiceNumber} has ${formatCurrency(invoice.balance)} outstanding.` })),
    ];
  }, [jobs, invoiceSummaries, overdueInvoices, getJobProgress]);

  const handleSave = () => {
    if (!formData.jobId || !formData.amount) {
      showToast('Fill required fields', 'error');
      return;
    }
    const amount = parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid invoice amount', 'error');
      return;
    }
    const invNum = formData.invoiceNumber || `INV-${String(invoices.length + 1).padStart(3, '0')}`;
    addInvoice({
      jobId: formData.jobId,
      invoiceNumber: invNum,
      amount,
      type: formData.type as Invoice['type'],
      dueDate: formData.dueDate,
      status: formData.status as InvoiceStatus,
      notes: formData.notes
    });
    showToast('Invoice created');
    setShowModal(false);
    setFormData({ jobId: '', invoiceNumber: '', amount: '', type: 'deposit', dueDate: '', status: 'draft', notes: '' });
  };

  const handleAddPayment = () => {
    if (!paymentForm.amount || !paymentModalId) {
      showToast('Enter amount', 'error');
      return;
    }
    const amount = parseFloat(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid payment amount', 'error');
      return;
    }
    addPayment({
      invoiceId: paymentModalId,
      amount,
      date: paymentForm.date,
      method: paymentForm.method as PaymentMethod,
      checkNumber: paymentForm.checkNumber,
      notes: paymentForm.notes
    });
    showToast('Payment recorded');
    setPaymentModalId(null);
    setPaymentForm({ amount: '', date: todayString(), method: 'check', checkNumber: '', notes: '' });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteInvoice(deleteId);
      showToast('Invoice deleted');
      setDeleteId(null);
    }
  };

  const handlePrintInvoice = (inv: Invoice) => {
    const job = jobs.find(j => j.id === inv.jobId);
    const invPayments = getInvoicePayments(inv.id);
    const data = buildClientInvoiceData(inv, job, invPayments, branding, DEFAULT_PRINT_SETTINGS);
    setPrintData(data);
  };

  const handleOpenSendInvoice = (invoice: InvoiceSummary) => {
    setSendInvoiceId(invoice.id);
    setSendMethod(invoice.customerEmail ? 'email' : 'sms');
  };

  const selectedSendInvoice = invoiceSummaries.find(invoice => invoice.id === sendInvoiceId);

  const invoiceSmsMessage = (invoice: InvoiceSummary) => {
    const dueText = invoice.dueDate ? ` Due ${formatDate(invoice.dueDate)}.` : '';
    return `${branding.brandName || 'Your Company'}: Invoice ${invoice.invoiceNumber} has a balance of ${formatCurrency(invoice.balance)}.${dueText}`;
  };

  const handleSendInvoice = async () => {
    if (!selectedSendInvoice) return;
    if (sendMethod === 'email' && !selectedSendInvoice.customerEmail) {
      showToast('Add a customer email before sending', 'warning');
      return;
    }
    if (sendMethod === 'sms' && !selectedSendInvoice.customerPhone) {
      showToast('Add a customer phone number before texting', 'warning');
      return;
    }

    const job = jobs.find(item => item.id === selectedSendInvoice.jobId);
    const customer = customers.find(item => item.id === selectedSendInvoice.customerId || item.id === job?.customerId);

    if (sendMethod === 'sms') {
      const phone = String(selectedSendInvoice.customerPhone || '').replace(/[^\d+]/g, '');
      const bodySeparator = /iPad|iPhone|iPod/i.test(navigator.userAgent) ? '&' : '?';
      window.location.href = `sms:${phone}${bodySeparator}body=${encodeURIComponent(invoiceSmsMessage(selectedSendInvoice))}`;
      if (selectedSendInvoice.status === 'draft') updateInvoice(selectedSendInvoice.id, { status: 'sent' });
      showToast('Text app opened');
      setSendInvoiceId(null);
      return;
    }

    setIsSendingInvoice(true);
    const email = renderEmailAll('invoice', branding, {
      invoice: {
        ...selectedSendInvoice,
        amount: formatCurrency(selectedSendInvoice.amount),
        balance: formatCurrency(selectedSendInvoice.balance),
      },
      customer: customer || { name: selectedSendInvoice.customer, email: selectedSendInvoice.customerEmail },
      totals: { balance: formatCurrency(selectedSendInvoice.balance), paid: formatCurrency(selectedSendInvoice.paid) },
    });
    const delivered = await sendEmail({
      to: selectedSendInvoice.customerEmail || '',
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    setIsSendingInvoice(false);

    if (delivered) {
      if (selectedSendInvoice.status === 'draft') updateInvoice(selectedSendInvoice.id, { status: 'sent' });
      showToast('Invoice email sent');
      setSendInvoiceId(null);
    } else {
      showToast('Email draft opened');
    }
  };

  const duplicateInvoice = (invoice: InvoiceSummary) => {
    addInvoice({
      jobId: invoice.jobId,
      invoiceNumber: `${invoice.invoiceNumber}-COPY`,
      amount: invoice.amount,
      type: invoice.type,
      dueDate: invoice.dueDate,
      status: 'draft',
      notes: invoice.notes,
    });
    showToast('Invoice duplicated as draft');
  };

  const sendReminder = (invoice?: InvoiceSummary) => {
    if (invoice) {
      handleOpenSendInvoice(invoice);
      return;
    }
    const firstOverdue = overdueInvoices[0];
    if (!firstOverdue) {
      showToast('No overdue invoices to send', 'warning');
      return;
    }
    handleOpenSendInvoice(firstOverdue);
  };

  return (
    <div className="invoice-command-page">
      <div className="invoice-command-header">
        <div>
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Invoices &amp; Payments</h1>
          <p className="page-subtitle">Track, collect, and act on payments before cash flow gets tight.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Create Invoice</button>
      </div>

      <section className="invoice-kpi-grid">
        <InvoiceKpi icon={ReceiptText} label="Total Invoiced" value={formatCurrency(totalInvoiced)} sub={`${invoices.length} invoices`} onClick={() => { setStatusFilter(''); setAgeFilter(''); }} />
        <InvoiceKpi icon={CheckCircle} label="Total Paid" value={formatCurrency(totalPaid)} sub={`${payments.length} payments`} tone="paid" onClick={() => { setStatusFilter('paid'); setAgeFilter(''); }} />
        <InvoiceKpi icon={Wallet} label="Outstanding" value={formatCurrency(outstanding)} sub={`${invoiceSummaries.filter(invoice => invoice.balance > 0).length} open invoices`} tone={outstanding > 0 ? 'warning' : 'paid'} onClick={() => { setStatusFilter(''); setAgeFilter(''); }} />
      </section>

      <section className="invoice-urgent-panel">
        <div>
          <h2>Urgent Actions</h2>
          <p>{overdueInvoices.length} overdue invoice{overdueInvoices.length === 1 ? '' : 's'} • {formatCurrency(overdueAmount)} overdue • {dueSoon.length} due soon</p>
        </div>
        <div className="invoice-urgent-actions">
          <button className="btn btn-secondary" onClick={() => setStatusFilter('overdue')}><AlertTriangle size={16} /> View Overdue</button>
          <button className="btn btn-primary" onClick={() => sendReminder()}><Mail size={16} /> Send Reminders</button>
        </div>
      </section>

      <section className="invoice-aging-grid">
        <AgingCard label="0-7 days" value={aging['0-7']} active={ageFilter === '0-7'} onClick={() => { setAgeFilter('0-7'); setStatusFilter(''); }} />
        <AgingCard label="8-30 days" value={aging['8-30']} active={ageFilter === '8-30'} onClick={() => { setAgeFilter('8-30'); setStatusFilter(''); }} />
        <AgingCard label="30+ days" value={aging['30+']} urgent={aging['30+'] > 0} active={ageFilter === '30+'} onClick={() => { setAgeFilter('30+'); setStatusFilter(''); }} />
      </section>

      {alerts.length > 0 && (
        <section className="invoice-alert-grid">
          {alerts.map(alert => (
            <button key={`${alert.title}-${alert.detail}`} className="invoice-alert-card" onClick={() => {
              setAgeFilter('');
              setStatusFilter(alert.title.toLowerCase().includes('overdue') ? 'overdue' : '');
            }}>
              <AlertTriangle size={18} />
              <span><strong>{alert.title}</strong>{alert.detail}</span>
            </button>
          ))}
        </section>
      )}

      <section className="invoice-controls">
        <div className="invoice-search">
          <Search size={18} />
          <input placeholder="Search invoice, job, customer..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <select value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
          <option value="">All Jobs</option>
          {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
        </select>
        <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setAgeFilter(''); }}>
          <option value="">All Status</option>
          {INVOICE_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </section>

      <div className="invoice-group-toggle">
        <span>Group</span>
        {(['none', 'job', 'customer', 'status'] as GroupMode[]).map(mode => (
          <button key={mode} className={groupMode === mode ? 'is-active' : ''} onClick={() => setGroupMode(mode)}>
            {mode === 'none' ? 'None' : mode === 'job' ? 'By Job' : mode === 'customer' ? 'By Customer' : 'By Status'}
          </button>
        ))}
      </div>

      <section className="invoice-table-card">
        {groupMode === 'none' ? (
          <InvoiceTable invoices={filteredInvoices} onPayment={setPaymentModalId} onReminder={sendReminder} onPrint={handlePrintInvoice} onDuplicate={duplicateInvoice} onDelete={setDeleteId} />
        ) : (
          <div className="invoice-group-list">
            {groupedInvoices.length === 0 ? <div className="invoice-empty">No invoices</div> : groupedInvoices.map(group => {
              const total = group.invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
              const balance = group.invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
              return (
                <div key={group.key} className="invoice-group-card">
                  <div className="invoice-group-header">
                    <h3>{group.label.replace('_', ' ')}</h3>
                    <span>{group.invoices.length} invoices • {formatCurrency(total)} billed • {formatCurrency(balance)} open</span>
                  </div>
                  <InvoiceTable invoices={group.invoices} onPayment={setPaymentModalId} onReminder={sendReminder} onPrint={handlePrintInvoice} onDuplicate={duplicateInvoice} onDelete={setDeleteId} compact />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Invoice">
        <div className="form-group"><label className="form-label">Job *</label><select className="form-select" value={formData.jobId} onChange={e => setFormData({...formData, jobId: e.target.value})}><option value="">Select job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}</select></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Invoice #</label><input className="form-input" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} placeholder="Auto" /></div>
          <div className="form-group"><label className="form-label">Amount *</label><input className="form-input" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>{INVOICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} /></div>
        </div>
        <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>{INVOICE_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Notes (Client-visible)</label><textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Notes shown on client invoice" /></div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Create Invoice</button></div>
      </Modal>

      <Modal isOpen={!!paymentModalId} onClose={() => setPaymentModalId(null)} title="Record Payment">
        <div className="form-group"><label className="form-label">Amount *</label><input className="form-input" type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} /></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Method</label><select className="form-select" value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}><option value="check">Check</option><option value="cash">Cash</option><option value="card">Card</option><option value="ach">Transfer</option><option value="other">Other</option></select></div>
        </div>
        <div className="form-group"><label className="form-label">Check / Reference #</label><input className="form-input" value={paymentForm.checkNumber} onChange={e => setPaymentForm({...paymentForm, checkNumber: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} /></div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}><button className="btn btn-secondary" onClick={() => setPaymentModalId(null)}>Cancel</button><button className="btn btn-primary" onClick={handleAddPayment}>Record Payment</button></div>
      </Modal>

      <Modal isOpen={!!sendInvoiceId} onClose={() => setSendInvoiceId(null)} title="Send Invoice" size="sm">
        {selectedSendInvoice && (
          <>
            <div className="space-y-4">
              <div className="send-method-grid">
                <button className={`send-method-card ${sendMethod === 'email' ? 'active' : ''}`} onClick={() => setSendMethod('email')}>
                  <Mail size={18} />
                  <span>Email</span>
                  <small>{selectedSendInvoice.customerEmail || 'No email on file'}</small>
                </button>
                <button className={`send-method-card ${sendMethod === 'sms' ? 'active' : ''}`} onClick={() => setSendMethod('sms')}>
                  <MessageSquare size={18} />
                  <span>Text</span>
                  <small>{selectedSendInvoice.customerPhone || 'No phone on file'}</small>
                </button>
              </div>
              <div className="send-preview">
                {sendMethod === 'sms'
                  ? invoiceSmsMessage(selectedSendInvoice)
                  : `Invoice ${selectedSendInvoice.invoiceNumber} will be emailed to ${selectedSendInvoice.customerEmail || 'the customer email on file'}. Balance: ${formatCurrency(selectedSendInvoice.balance)}.`}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSendInvoiceId(null)} disabled={isSendingInvoice}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSendInvoice} disabled={isSendingInvoice}>
                {isSendingInvoice ? 'Sending...' : sendMethod === 'sms' ? 'Open Text App' : 'Send Email'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Invoice" message="Delete this invoice and all payments?" confirmLabel="Delete" danger />

      {printData && (
        <PrintTemplateModal
          isOpen={!!printData}
          onClose={() => setPrintData(null)}
          title={`Invoice ${printData.invoiceNumber}`}
          data={printData}
        />
      )}
    </div>
  );
}

function InvoiceKpi({ icon: Icon, label, value, sub, tone, onClick }: { icon: LucideIcon; label: string; value: string; sub: string; tone?: 'paid' | 'warning'; onClick?: () => void }) {
  return (
    <button className={`invoice-kpi-card ${tone || ''}`} onClick={onClick}>
      <div className="invoice-kpi-icon"><Icon size={18} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </button>
  );
}

function AgingCard({ label, value, urgent, active, onClick }: { label: string; value: number; urgent?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <button className={`invoice-aging-card ${urgent ? 'urgent' : ''} ${active ? 'active' : ''}`} onClick={onClick}>
      <Clock3 size={18} />
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </button>
  );
}

function InvoiceTable({
  invoices,
  onPayment,
  onReminder,
  onPrint,
  onDuplicate,
  onDelete,
  compact,
}: {
  invoices: InvoiceSummary[];
  onPayment: (id: string) => void;
  onReminder: (invoice: InvoiceSummary) => void;
  onPrint: (invoice: Invoice) => void;
  onDuplicate: (invoice: InvoiceSummary) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  if (invoices.length === 0) return <div className="invoice-empty">No invoices</div>;

  return (
    <div className={`invoice-table-wrap ${compact ? 'compact' : ''}`}>
      <table className="invoice-table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Job</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Job Progress</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(invoice => (
            <tr key={invoice.id} className={invoice.effectiveStatus === 'overdue' ? 'is-overdue' : invoice.effectiveStatus === 'paid' ? 'is-paid' : ''}>
              <td data-label="Invoice #" className="invoice-number">{invoice.invoiceNumber}</td>
              <td data-label="Job"><Link to={`/jobs/${invoice.jobId}`}>{invoice.jobName}</Link><small>{invoice.customer}</small></td>
              <td data-label="Type"><span className="badge badge-gray">{invoice.type.replace('_', ' ')}</span></td>
              <td data-label="Amount">{formatCurrency(invoice.amount)}</td>
              <td data-label="Paid" className="invoice-paid">{formatCurrency(invoice.paid)}</td>
              <td data-label="Balance" className="invoice-balance">{formatCurrency(invoice.balance)}</td>
              <td data-label="Status"><span className={`badge ${invoice.effectiveStatus === 'paid' ? 'badge-green' : invoice.effectiveStatus === 'overdue' ? 'badge-red' : invoice.effectiveStatus === 'partial' ? 'badge-yellow' : 'badge-blue'}`}>{invoice.effectiveStatus.replace('_', ' ')}</span></td>
              <td data-label="Job Progress">
                <div className="invoice-progress-cell">
                  <span>{invoice.progress}% complete</span>
                  <small>{formatCurrency(invoice.paid)} paid / {formatCurrency(invoice.expectedPaid)} expected</small>
                </div>
              </td>
              <td data-label="Actions">
                <div className="invoice-row-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => onPayment(invoice.id)}><CreditCard size={14} /> Record Payment</button>
                  <button className="btn btn-sm btn-secondary btn-icon" onClick={() => onReminder(invoice)} title="Send Reminder"><Bell size={14} /></button>
                  <button className="btn btn-sm btn-secondary btn-icon" onClick={() => onPrint(invoice)} title="Print"><Printer size={14} /></button>
                  <button className="btn btn-sm btn-secondary btn-icon" onClick={() => onDuplicate(invoice)} title="Duplicate"><Copy size={14} /></button>
                  <button className="btn btn-sm btn-danger btn-icon" onClick={() => onDelete(invoice.id)} title="Delete"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
