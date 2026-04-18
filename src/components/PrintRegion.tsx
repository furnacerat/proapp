import React from 'react'

// A simple wrapper to isolate printable regions. Any content inside this component will be
// printed when the browser print dialog is opened, while content outside remains hidden via CSS.
export const PrintRegion: React.FC<{ title?: string, className?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ title, className, children, ...rest }) => {
  return (
    <section className={`print-region ${className ?? ''}`} aria-label={title || 'Printable region'} {...rest}>
      {children}
    </section>
  )
}

export default PrintRegion
