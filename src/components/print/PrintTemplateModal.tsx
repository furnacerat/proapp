import React from 'react'
import { Modal } from '../common/Modal'
import InvoicePrintTemplate from './InvoicePrintTemplate'
import EstimatePrintTemplate from './EstimatePrintTemplate'
import { PrintInvoiceData, PrintEstimateData, PrintSettings, DEFAULT_PRINT_SETTINGS } from '../../data/printTypes'

type PrintData = PrintInvoiceData | PrintEstimateData

interface Props {
  isOpen: boolean
  onClose: () => void
  title: string
  data: PrintData
  settings?: PrintSettings
}

export const PrintTemplateModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  title, 
  data, 
  settings = DEFAULT_PRINT_SETTINGS 
}) => {
  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="print-preview-actions">
        <button className="btn btn-primary" onClick={handlePrint}>
          Print Document
        </button>
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      
      <div className="print-preview-container">
        {data.type === 'invoice' ? (
          <InvoicePrintTemplate data={data as PrintInvoiceData} settings={settings} />
        ) : data.type === 'estimate' ? (
          <EstimatePrintTemplate data={data as PrintEstimateData} settings={settings} />
        ) : (
          <div>Unknown document type</div>
        )}
      </div>
    </Modal>
  )
}

export default PrintTemplateModal