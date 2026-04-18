import React from 'react'
import { Invoice } from '../data/types'
import { Job } from '../data/types'
import { Payment } from '../data/types'
import { formatCurrency } from '../utils/formatters'

type Props = {
  invoice: Invoice
  job?: Job
  payments: Payment[]
}

const InvoicePrint: React.FC<Props> = ({ invoice, job, payments }) => {
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = invoice.amount - totalPaid

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui, Arial', padding: 8 }}>
      <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 8 }}>{/* Optional branding header can go here */}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>{invoice.invoiceNumber}</div>
        <div>{invoice.date ? new Date(invoice.date).toLocaleDateString() : ''}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, color: '#555' }}>Job</div>
          <div style={{ fontWeight: 600 }}>{job?.name ?? ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, color: '#555' }}>Balance</div>
          <div style={{ fontWeight: 600 }}>{formatCurrency(balance)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 6 }}>
        <div className="card" style={{ padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#555' }}>Amount</div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(invoice.amount)}</div>
        </div>
        <div className="card" style={{ padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#555' }}>Paid</div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div className="card" style={{ padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#555' }}>Balance</div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(balance)}</div>
        </div>
        <div className="card" style={{ padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#555' }}>Status</div>
          <div style={{ fontWeight: 700 }}>{invoice.status}</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <details>
          <summary>Payments</summary>
          <ul>
            {payments.map(p => (
              <li key={p.id}>{p.date ? new Date(p.date).toLocaleDateString() : ''} - {formatCurrency(p.amount)} - {p.method}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}

export default InvoicePrint
