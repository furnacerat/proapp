import React from 'react'
import { PrintInvoiceData, PrintSettings, DEFAULT_PRINT_SETTINGS } from '../../data/printTypes'
import { parseDateString } from '../../utils/formatters'

interface Props {
  data: PrintInvoiceData
  settings?: PrintSettings
}

const fmt = (n: number) => `$${n.toFixed(2)}`
const fmtDate = (d?: string) => d ? parseDateString(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

export const InvoicePrintTemplate: React.FC<Props> = ({ data, settings = DEFAULT_PRINT_SETTINGS }) => {
  const { company, client, project, lineItems, payments, balanceDue, notes, paymentTerms } = data
  const isPaidInFull = balanceDue !== undefined && balanceDue <= 0
  const visibleLineItems = settings.hideZeroValueLines
    ? lineItems.filter(item => item.total !== 0)
    : lineItems

  return (
    <div className="print-document">

      {/* ── Header: Logo + Company + Invoice Meta ── */}
      <div className="print-header-row">
        <div className="print-header-left">
          {settings.showLogo && (company.logoDataUrl || company.logoUrl) && (
            <img
              src={company.logoDataUrl || company.logoUrl}
              alt={company.brandName}
              className="print-logo"
            />
          )}
          <div className="print-company-name">{company.brandName}</div>
          {company.phone && <div className="print-company-contact">{company.phone}</div>}
          {company.emailFromAddress && <div className="print-company-contact">{company.emailFromAddress}</div>}
          {company.website && <div className="print-company-contact">{company.website}</div>}
          {company.address && <div className="print-company-contact">{company.address}</div>}
        </div>

        <div className="print-header-right">
          <div className="print-doc-type">INVOICE</div>
          <div className="print-doc-number"># {data.invoiceNumber}</div>
          <div className="print-meta-rows">
            <div className="print-meta-row">
              <span className="print-meta-label">Date</span>
              <span className="print-meta-value">{fmtDate(data.issueDate)}</span>
            </div>
            {data.dueDate && (
              <div className="print-meta-row">
                <span className="print-meta-label">Due Date</span>
                <span className="print-meta-value">{fmtDate(data.dueDate)}</span>
              </div>
            )}
            <div className="print-meta-row">
              <span className="print-meta-label">Status</span>
              <span className="print-meta-value print-status">{data.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="print-divider" />

      {/* ── Bill To / Project ── */}
      <div className="print-parties">
        <div className="print-party">
          <div className="print-party-label">Bill To</div>
          <div className="print-party-name">{client.name}</div>
          {client.address && (
            <div className="print-party-detail">
              {client.address.line1}
              {client.address.line2 && <><br />{client.address.line2}</>}
              {client.address.city && (
                <><br />{client.address.city}{client.address.state ? `, ${client.address.state}` : ''} {client.address.zip}</>
              )}
            </div>
          )}
          {client.email && <div className="print-party-detail">{client.email}</div>}
          {client.phone && <div className="print-party-detail">{client.phone}</div>}
        </div>

        {project && (
          <div className="print-party">
            <div className="print-party-label">Project / Job</div>
            <div className="print-party-name">{project.name}</div>
            {project.address && (
              <div className="print-party-detail">
                {project.address.line1}
                {project.address.line2 && <><br />{project.address.line2}</>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Line Items Table ── */}
      <table className="print-line-items">
        <thead>
          <tr>
            <th>Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {visibleLineItems.map((item, i) => (
            <tr key={i}>
              <td>
                <div className="print-item-name">{item.description}</div>
                {item.detail && settings.showItemDescriptions && (
                  <div className="print-item-detail">{item.detail}</div>
                )}
              </td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">{item.unit || '—'}</td>
              <td className="text-right">{fmt(item.unitPrice)}</td>
              <td className="text-right">{fmt(item.total)}</td>
            </tr>
          ))}
          {visibleLineItems.length === 0 && (
            <tr>
              <td colSpan={5}>No billable line items selected.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div className="print-totals">
        <div className="print-totals-row">
          <span>Subtotal</span>
          <span>{fmt(data.subtotal)}</span>
        </div>
        {data.discount && data.discount > 0 && (
          <div className="print-totals-row">
            <span>Discount</span>
            <span>-{fmt(data.discount)}</span>
          </div>
        )}
        {data.tax && settings.showTaxBreakdown && (
          <div className="print-totals-row">
            <span>Tax</span>
            <span>{fmt(data.tax)}</span>
          </div>
        )}
        <div className="print-totals-row print-total-final">
          <span>Invoice Total</span>
          <span>{fmt(data.total)}</span>
        </div>
        {payments && payments.length > 0 && payments.reduce((s, p) => s + p.amount, 0) > 0 && (
          <div className="print-totals-row print-paid-row">
            <span>Payments Received</span>
            <span>-{fmt(payments.reduce((s, p) => s + p.amount, 0))}</span>
          </div>
        )}
        {isPaidInFull ? (
          <div className="print-totals-row print-paid-full">
            <span>Balance Due</span>
            <span>PAID IN FULL</span>
          </div>
        ) : balanceDue !== undefined && balanceDue > 0 ? (
          <div className="print-totals-row print-balance">
            <span>Balance Due</span>
            <span>{fmt(balanceDue)}</span>
          </div>
        ) : null}
      </div>

      {/* ── Payment History ── */}
      {payments && payments.length > 0 && (
        <div className="print-section">
          <div className="print-section-title">Payment History</div>
          <table className="print-payments-table">
            <tbody>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.method}</td>
                  <td className="text-right">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Payment Terms ── */}
      {paymentTerms && settings.showPaymentTerms && (
        <div className="print-section">
          <div className="print-section-title">Payment Terms</div>
          <div className="print-prose">{paymentTerms}</div>
        </div>
      )}

      {/* ── Notes ── */}
      {notes && settings.showNotes && (
        <div className="print-section">
          <div className="print-section-title">Notes</div>
          <div className="print-prose">{notes}</div>
        </div>
      )}

      {/* ── Footer ── */}
      {settings.showSignatureLine && (
        <div className="print-signature-block">
          <div className="print-section-title">Authorization</div>
          <div className="print-signature-grid">
            <div className="print-sig-field">
              <div className="print-sig-line" />
              <div className="print-sig-label">Customer Signature</div>
            </div>
            <div className="print-sig-field">
              <div className="print-sig-line" />
              <div className="print-sig-label">Printed Name</div>
            </div>
            <div className="print-sig-field">
              <div className="print-sig-line" />
              <div className="print-sig-label">Date</div>
            </div>
          </div>
        </div>
      )}

      <div className="print-footer">
        {company.brandName} · Thank you for your business!
      </div>
    </div>
  )
}

export default InvoicePrintTemplate
