import React from 'react'
import { Modal } from './common/Modal'

type PrintPreviewProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  render: () => React.ReactNode
}
const PrintPreviewModal: React.FC<PrintPreviewProps> = ({ isOpen, onClose, title, render }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title}>
    <div className="print-preview-content" style={{ padding: 12 }}>
      {render()}
    </div>
  </Modal>
)
export default PrintPreviewModal
