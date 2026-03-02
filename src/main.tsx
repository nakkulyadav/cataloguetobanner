import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BannerProvider } from '@/hooks/useBannerState'
import { LogsProvider } from '@/hooks/useLogs'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LogsProvider>
      <BannerProvider>
        <App />
      </BannerProvider>
    </LogsProvider>
  </StrictMode>,
)
