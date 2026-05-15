import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/marketing-studio.css'
import './styles/estimates.css'
import './styles/operations.css'
import './styles/finance.css'
import './styles/planning-reports.css'
import './styles/customer-portal.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
