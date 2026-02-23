import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

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
    <App />
  </StrictMode>,
)
