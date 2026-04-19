/**
 * PrintTemplateModal.tsx
 *
 * Full-screen print preview overlay rendered via ReactDOM.createPortal
 * into #print-root — which is a sibling of #root in the DOM.
 *
 * This means:
 *  - During normal use: only the overlay content is visible (app is behind the backdrop)
 *  - During print (@media print): #root is hidden, #print-root shows — so ONLY this
 *    document template prints, never the app UI.
 */

import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import InvoicePrintTemplate from './InvoicePrintTemplate'
import EstimatePrintTemplate from './EstimatePrintTemplate'
import {
  PrintInvoiceData,
  PrintEstimateData,
  PrintSettings,
  DEFAULT_PRINT_SETTINGS,
} from '../../data/printTypes'
import './printStyles.css'

type PrintData = PrintInvoiceData | PrintEstimateData

interface Props {
  isOpen: boolean
  onClose: () => void
  title: string
  data: PrintData
  settings?: PrintSettings
}

const SETTING_LABELS: { key: keyof PrintSettings; label: string }[] = [
  { key: 'showLogo',          label: 'Show Logo' },
  { key: 'showPaymentTerms',  label: 'Payment Terms' },
  { key: 'showTaxBreakdown',  label: 'Tax Breakdown' },
  { key: 'showNotes',         label: 'Notes' },
  { key: 'showSignatureLine', label: 'Signature Line' },
  { key: 'showItemDescriptions', label: 'Item Descriptions' },
  { key: 'hideZeroValueLines', label: 'Hide $0 Lines' },
]

export const PrintTemplateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  data,
  settings: initialSettings,
}) => {
  const [settings, setSettings] = useState<PrintSettings>(
    initialSettings ?? DEFAULT_PRINT_SETTINGS,
  )

  // Sync if parent provides new settings
  useEffect(() => {
    if (initialSettings) setSettings(initialSettings)
  }, [initialSettings])

  // Keyboard close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const toggleSetting = (key: keyof PrintSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handlePrint = () => {
    window.print()
  }

  const printRoot = document.getElementById('print-root')
  if (!printRoot) {
    console.error('PrintTemplateModal: #print-root element not found in index.html')
    return null
  }

  const overlay = (
    <div className="print-preview-overlay">
      {/* ── Toolbar ── */}
      <div className="print-preview-toolbar">
        <div className="print-preview-toolbar-left">
          <span className="print-preview-title">📄 {title}</span>
        </div>
        <div className="print-preview-toolbar-right">
          <button
            className="btn btn-primary"
            style={{ fontSize: 13 }}
            onClick={handlePrint}
          >
            🖨 Print Document
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, background: 'transparent', border: '1px solid #555', color: '#fff' }}
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* ── Settings Bar ── */}
      <div className="print-preview-settings">
        {SETTING_LABELS.map(({ key, label }) => (
          <label key={key} className="print-preview-setting">
            <input
              type="checkbox"
              checked={!!settings[key]}
              onChange={() => toggleSetting(key)}
            />
            {label}
          </label>
        ))}
      </div>

      {/* ── Document Preview ── */}
      <div className="print-preview-body">
        <div className="print-preview-sheet">
          {data.type === 'invoice' ? (
            <InvoicePrintTemplate data={data as PrintInvoiceData} settings={settings} />
          ) : data.type === 'estimate' ? (
            <EstimatePrintTemplate data={data as PrintEstimateData} settings={settings} />
          ) : (
            <div style={{ padding: 40, color: '#777' }}>Unknown document type.</div>
          )}
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(overlay, printRoot)
}

export default PrintTemplateModal