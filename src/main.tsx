import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
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
