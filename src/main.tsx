import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { attachFlushOnLeave, attachPersistence } from './state/persist'
import { game } from './state/store'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './index.css'
import './ui/ui.css'

attachPersistence(game)
attachFlushOnLeave(game)

const root = document.getElementById('root')
if (!root) throw new Error('No #root element in index.html')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
