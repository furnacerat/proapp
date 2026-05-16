import React from 'react'
import { Invoice } from '../data/types'
import { Job } from '../data/types'
import { Payment } from '../data/types'
import { BrandingSettings } from '../data/types'
import { formatCurrency, formatDate } from '../utils/formatters'

type Props = {
  invoice: Invoice
  job?: Job
  payments: Payment[]
  branding?: BrandingSettings
}

const InvoicePrint: React.FC<Props> = ({ invoice, job, payments, branding }) => {
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const subtotal = invoice.subtotal ?? Math.max(invoice.amount - (invoice.tax ?? 0), 0)
  const total = invoice.total ?? invoice.amount
  const balance = total - totalPaid
  const brandName = branding?.brandName || 'Your Company'
  const logo = branding?.logoDataUrl || branding?.logoUrl

  return (
    <div className="invoice-print" style={{ fontFamily: branding?.fontFamily || 'ui-sans-serif, system-ui, Arial', padding: 24, maxWidth: 800, margin: '0 auto' }}>
      {logo && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={logo} alt={brandName} style={{ maxHeight: 60, maxWidth: 200 }} />
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: branding?.primaryColor || '#1a1a1a' }}>INVOICE</h1>
        <div style={{ fontSize: 18, color: '#555' }}>{invoice.invoiceNumber}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#777', textTransform: 'uppercase' }}>From</div>
          <div style={{ fontWeight: 600 }}>{brandName}</div>
          {branding?.phone && <div style={{ fontSize: 14, color: '#555' }}>{branding.phone}</div>}
          {branding?.emailFromAddress && <div style={{ fontSize: 14, color: '#555' }}>{branding.emailFromAddress}</div>}
          {branding?.website && <div style={{ fontSize: 14, color: '#555' }}>{branding.website}</div>}
          {branding?.address && <div style={{ fontSize: 14, color: '#555', whiteSpace: 'pre-line' }}>{branding.address}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#777', textTransform: 'uppercase' }}>Date</div>
          <div style={{ fontWeight: 600 }}>{invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : ''}</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#777', textTransform: 'uppercase', marginBottom: 4 }}>Bill To</div>
        <div style={{ fontWeight: 600 }}>{job?.customer || 'Customer'}</div>
        {job?.address && <div style={{ fontSize: 14, color: '#555' }}>{job.address}</div>}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#777', textTransform: 'uppercase', marginBottom: 4 }}>Project</div>
        <div style={{ fontWeight: 600 }}>{job?.name || 'N/A'}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #333' }}>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: '#777', textTransform: 'uppercase' }}>Description</th>
            <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: '#777', textTransform: 'uppercase' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '12px 0', fontSize: 14 }}>Contract Amount</td>
            <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 14 }}>{formatCurrency(subtotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ width: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span style={{ color: '#777' }}>Subtotal</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(subtotal)}</span>
          </div>
          {!!invoice.tax && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ color: '#777' }}>Tax</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(invoice.tax)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span style={{ color: '#777' }}>Amount Due</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(total)}</span>
          </div>
          {totalPaid > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ color: '#777' }}>Payments Received</span>
              <span style={{ fontWeight: 600 }}>-{formatCurrency(totalPaid)}</span>
            </div>
          )}
          {balance > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
              <span style={{ fontWeight: 700 }}>Balance Due</span>
              <span style={{ fontWeight: 700, fontSize: 20, color: branding?.primaryColor || '#1a1a1a' }}>{formatCurrency(balance)}</span>
            </div>
          )}
          {balance <= 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontWeight: 700, color: '#22c55e' }}>Paid in Full</span>
              <span style={{ fontWeight: 700, color: '#22c55e' }}>{formatCurrency(0)}</span>
            </div>
          )}
        </div>
      </div>

      {payments.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#777', textTransform: 'uppercase', marginBottom: 8 }}>Payment History</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ padding: '4px 0', fontSize: 13, color: '#555' }}>{p.date ? formatDate(p.date) : ''}</td>
                  <td style={{ padding: '4px 0', fontSize: 13 }}>{formatCurrency(p.amount)}</td>
                  <td style={{ padding: '4px 0', fontSize: 13, color: '#777', textAlign: 'right' }}>{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {branding?.termsText && (
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee', fontSize: 12, color: '#777' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Terms & Conditions</div>
          <div>{branding.termsText}</div>
        </div>
      )}

      <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#999' }}>
        Thank you for your business!
      </div>
    </div>
  )
}

export default InvoicePrint
