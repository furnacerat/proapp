import React from 'react'
import { PrintEstimateData, PrintSettings, DEFAULT_PRINT_SETTINGS } from '../../data/printTypes'
import { parseDateString } from '../../utils/formatters'

interface Props {
  data: PrintEstimateData
  settings?: PrintSettings
}

const fmt = (n: number) => `$${n.toFixed(2)}`
const fmtDate = (d?: string) => d ? parseDateString(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

export const EstimatePrintTemplate: React.FC<Props> = ({ data, settings = DEFAULT_PRINT_SETTINGS }) => {
  const { company, client, project, lineItems, notes, terms } = data

  return (
    <div className="print-document">

      {/* ── Header: Logo + Company + Estimate Meta ── */}
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
          {company.address && <div className="print-company-contact">{company.address}</div>}
        </div>

        <div className="print-header-right">
          <div className="print-doc-type">ESTIMATE</div>
          <div className="print-doc-number"># {data.estimateNumber}</div>
          <div className="print-meta-rows">
            <div className="print-meta-row">
              <span className="print-meta-label">Date</span>
              <span className="print-meta-value">{fmtDate(data.issueDate)}</span>
            </div>
            {data.validUntil && (
              <div className="print-meta-row">
                <span className="print-meta-label">Valid Until</span>
                <span className="print-meta-value">{fmtDate(data.validUntil)}</span>
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

      {/* ── Prepared For / Project ── */}
      <div className="print-parties">
        <div className="print-party">
          <div className="print-party-label">Prepared For</div>
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
            <div className="print-party-label">Project / Location</div>
            <div className="print-party-name">{project.name}</div>
            {project.address && (
              <div className="print-party-detail">
                {project.address.line1}
                {project.address.line2 && <><br />{project.address.line2}</>}
                {project.address.city && (
                  <><br />{project.address.city}{project.address.state ? `, ${project.address.state}` : ''} {project.address.zip}</>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Line Items Table ── */}
      {lineItems.length > 0 ? (
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
            {lineItems.map((item, i) => (
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
          </tbody>
        </table>
      ) : (
        <div className="print-empty-items">
          No line items have been added to this estimate.
        </div>
      )}

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
          <span>Estimate Total</span>
          <span>{fmt(data.total)}</span>
        </div>
      </div>

      {/* ── Terms & Conditions ── */}
      {terms && settings.showPaymentTerms && (
        <div className="print-section">
          <div className="print-section-title">Terms &amp; Conditions</div>
          <div className="print-prose">{terms}</div>
        </div>
      )}

      {/* ── Notes ── */}
      {notes && settings.showNotes && (
        <div className="print-section">
          <div className="print-section-title">Notes</div>
          <div className="print-prose">{notes}</div>
        </div>
      )}

      {/* ── Signature Block ── */}
      {settings.showSignatureLine && (
        <div className="print-signature-block">
          <div className="print-section-title">Acceptance</div>
          <p className="print-prose">
            By signing below, you authorize {company.brandName} to proceed with the above scope of work
            under the terms and conditions stated on this estimate.
          </p>
          <div className="print-signature-grid">
            <div className="print-sig-field">
              <div className="print-sig-line" />
              <div className="print-sig-label">Client Signature</div>
            </div>
            <div className="print-sig-field">
              <div className="print-sig-line" />
              <div className="print-sig-label">Date</div>
            </div>
            <div className="print-sig-field">
              <div className="print-sig-line" />
              <div className="print-sig-label">Printed Name</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="print-footer">
        {company.brandName} · Thank you for considering our proposal!
      </div>
    </div>
  )
}

export default EstimatePrintTemplate
