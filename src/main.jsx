import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Arranque en paralelo: antes el navegador bajaba TODA la app, la ejecutaba, y
// solo entonces se enteraba de qué página tenía que pedir (otra descarga más).
// Ahora, apenas arranca, ya pide la página que se está visitando (inicio o
// tabla de un torneo) al mismo tiempo que el resto de la app — esa espera en
// fila era buena parte de lo que se sentía como "demora en entrar".
// (Mismo criterio de "host propio" que DominioPersonalizadoGate.)
try {
  const host = window.location.hostname.toLowerCase()
  const hostPropio = host === 'localhost' || host === '127.0.0.1' || host.endsWith('golmebol.com') || host.endsWith('.vercel.app')
  const ruta = window.location.pathname
  if (!hostPropio) import('./pages/TorneoPublicoPage')            // dominio propio de un torneo/organizador
  else if (ruta === '/') import('./pages/LandingPage')            // inicio de Golmebol
  else if (ruta.startsWith('/t/')) import('./pages/TorneoPublicoPage') // tabla pública de un torneo
} catch (e) { /* si algo falla, la app carga la página normal más tarde */ }

import('./App.jsx').then(({ default: App }) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
