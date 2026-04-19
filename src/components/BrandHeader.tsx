import React from 'react'
import { useApp } from '../context/AppContext'

const BrandHeader: React.FC = () => {
  const { branding } = useApp()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #eee', marginBottom: 8 }}>
      {branding?.logoUrl || branding?.logoDataUrl ? (
        <img src={branding.logoUrl || branding.logoDataUrl} alt="logo" style={{ height: 22 }} />
      ) : null}
      <span style={{ fontWeight: 700 }}>{branding?.brandName || 'Allen\'s Hub'}</span>
    </div>
  )
}

export default BrandHeader
