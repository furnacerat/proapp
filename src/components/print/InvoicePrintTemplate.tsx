import React from 'react'
import { PrintInvoiceData, PrintSettings, DEFAULT_PRINT_SETTINGS } from '../../data/printTypes'

interface Props {
  data: PrintInvoiceData
  settings?: PrintSettings
}

export const InvoicePrintTemplate: React.FC<Props> = ({ data, settings = DEFAULT_PRINT_SETTINGS }) => {
  const { company, client, project, lineItems, payments, balanceDue, notes, paymentTerms } = data

  return (
    <div className="print-document">
      <div className="print-header">
        {settings.showLogo && company.logoDataUrl && (
          <img src={company.logoDataUrl} alt={company.brandName} className="print-logo" />
        )}
        <div className="print-company-name">{company.brandName}</div>
        {company.emailFromAddress && (
          <div className="print-company-contact">{company.emailFromAddress}</div>
        )}
      </div>

      <div className="print-title-section">
        <h1 className="print-title">INVOICE</h1>
        <div className="print-doc-number">{data.invoiceNumber}</div>
      </div>

      <div className="print-meta-grid">
        <div className="print-meta-group">
          <div className="print-meta-label">Date</div>
          <div className="print-meta-value">
            {data.issueDate ? new Date(data.issueDate).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        {data.dueDate && (
          <div className="print-meta-group">
            <div className="print-meta-label">Due Date</div>
            <div className="print-meta-value">
              {new Date(data.dueDate).toLocaleDateString()}
            </div>
          </div>
        )}
        <div className="print-meta-group">
          <div className="print-meta-label">Status</div>
          <div className="print-meta-value print-status">{data.status}</div>
        </div>
      </div>

      <div className="print-parties">
        <div className="print-party">
          <div className="print-party-label">From</div>
          <div className="print-party-name">{company.brandName}</div>
          {company.emailFromAddress && (
            <div className="print-party-detail">{company.emailFromAddress}</div>
          )}
        </div>
        <div className="print-party">
          <div className="print-party-label">Bill To</div>
          <div className="print-party-name">{client.name}</div>
          {client.address && (
            <div className="print-party-detail">
              {client.address.line1}
              {client.address.line2 && <>, {client.address.line2}</>}
              {client.address.city && (
                <>, {client.address.city}, {client.address.state} {client.address.zip}</>
              )}
            </div>
          )}
          {client.email && <div className="print-party-detail">{client.email}</div>}
          {client.phone && <div className="print-party-detail">{client.phone}</div>}
        </div>
        {project && (
          <div className="print-party">
            <div className="print-party-label">Project</div>
            <div className="print-party-name">{project.name}</div>
            {project.address && (
              <div className="print-party-detail">
                {project.address.line1}
                {project.address.line2 && <>, {project.address.line2}</>}
              </div>
            )}
          </div>
        )}
      </div>

      <table className="print-line-items">
        <thead>
          <tr>
            <th>Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit</th>
            <th className="text-right">Price</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={index}>
              <td>
                <div>{item.description}</div>
                {item.detail && <div className="print-item-detail">{item.detail}</div>}
              </td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">{item.unit || ''}</td>
              <td className="text-right">${item.unitPrice.toFixed(2)}</td>
              <td className="text-right">${item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-totals">
        <div className="print-totals-row">
          <span>Subtotal</span>
          <span>${data.subtotal.toFixed(2)}</span>
        </div>
        <div className="print-totals-row print-total-final">
          <span>Total Due</span>
          <span>${data.total.toFixed(2)}</span>
        </div>
        {balanceDue !== undefined && balanceDue > 0 && (
          <div className="print-totals-row print-balance">
            <span>Balance Due</span>
            <span>${balanceDue.toFixed(2)}</span>
          </div>
        )}
      </div>

      {payments && payments.length > 0 && (
        <div className="print-payments">
          <div className="print-section-title">Payment History</div>
          <table className="print-payments-table">
            <tbody>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td>{p.date ? new Date(p.date).toLocaleDateString() : ''}</td>
                  <td className="text-right">${p.amount.toFixed(2)}</td>
                  <td className="text-right">{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paymentTerms && settings.showPaymentTerms && (
        <div className="print-terms">
          <div className="print-section-title">Payment Terms</div>
          <div>{paymentTerms}</div>
        </div>
      )}

      {notes && settings.showNotes && (
        <div className="print-notes">
          <div className="print-section-title">Notes</div>
          <div>{notes}</div>
        </div>
      )}

      <div className="print-footer">
        Thank you for your business!
      </div>
    </div>
  )
}

export default InvoicePrintTemplate