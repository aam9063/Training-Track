import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Inicializa Sentry solo en producción
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: true,
  })
}

// Registra el Service Worker con auto-actualización silenciosa
registerSW({
  onNeedRefresh() {
    // Nueva versión disponible — se actualiza automáticamente en el siguiente reload
  },
  onOfflineReady() {
    // App lista para funcionar offline
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Ha ocurrido un error inesperado.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
