import React from 'react'
import { PrintEstimateData, PrintSettings, DEFAULT_PRINT_SETTINGS } from '../../data/printTypes'

interface Props {
  data: PrintEstimateData
  settings?: PrintSettings
}

export const EstimatePrintTemplate: React.FC<Props> = ({ data, settings = DEFAULT_PRINT_SETTINGS }) => {
  const { company, client, project, lineItems, notes, terms } = data

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
        <h1 className="print-title">ESTIMATE</h1>
        <div className="print-doc-number">{data.estimateNumber}</div>
      </div>

      <div className="print-meta-grid">
        <div className="print-meta-group">
          <div className="print-meta-label">Date</div>
          <div className="print-meta-value">
            {data.issueDate ? new Date(data.issueDate).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        {data.validUntil && (
          <div className="print-meta-group">
            <div className="print-meta-label">Valid Until</div>
            <div className="print-meta-value">
              {new Date(data.validUntil).toLocaleDateString()}
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
          <div className="print-party-label">To</div>
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
        {data.discount && data.discount > 0 && (
          <div className="print-totals-row">
            <span>Discount</span>
            <span>-${data.discount.toFixed(2)}</span>
          </div>
        )}
        {data.tax && settings.showTaxBreakdown && (
          <div className="print-totals-row">
            <span>Tax</span>
            <span>${data.tax.toFixed(2)}</span>
          </div>
        )}
        <div className="print-totals-row print-total-final">
          <span>Total</span>
          <span>${data.total.toFixed(2)}</span>
        </div>
      </div>

      {terms && settings.showPaymentTerms && (
        <div className="print-terms">
          <div className="print-section-title">Terms & Conditions</div>
          <div>{terms}</div>
        </div>
      )}

      {notes && settings.showNotes && (
        <div className="print-notes">
          <div className="print-section-title">Notes</div>
          <div>{notes}</div>
        </div>
      )}

      {settings.showSignatureLine && (
        <div className="print-signature">
          <div className="print-signature-line">
            <div className="print-signature-label">Accepted by:</div>
            <div className="print-signature-space"></div>
          </div>
          <div className="print-signature-line">
            <div className="print-signature-label">Date:</div>
            <div className="print-signature-space"></div>
          </div>
        </div>
      )}

      <div className="print-footer">
        Thank you for your consideration!
      </div>
    </div>
  )
}

export default EstimatePrintTemplate