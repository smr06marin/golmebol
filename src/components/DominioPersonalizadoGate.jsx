import { useEffect, useState, lazy, Suspense } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import MarcaGolmebol from './MarcaGolmebol'

const TorneoPublicoPage      = lazy(() => import('../pages/TorneoPublicoPage'))
const OrganizadorVitrinaPage = lazy(() => import('../pages/OrganizadorVitrinaPage'))

function esHostPropio(hostname) {
  const h = (hostname || '').toLowerCase()
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('golmebol.com') ||
    h.endsWith('.vercel.app')
  )
}

const loadingStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  background: '#07070e',
  color: '#00ddd0',
  fontFamily: 'var(--font-display), system-ui, sans-serif',
  letterSpacing: '.2em',
  fontSize: '1rem',
}

/**
 * Si el visitante entra por un dominio propio (custom_domain del torneo),
 * muestra TorneoPublicoPage de ese torneo. En hosts de Golmebol / Vercel /
 * localhost deja pasar el router normal.
 */
export default function DominioPersonalizadoGate({ children }) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const hostPropio = esHostPropio(hostname)

  const [estado, setEstado] = useState(hostPropio ? 'ok' : 'cargando') // ok | cargando | torneo | organizador | sin_vincular
  const [torneoId, setTorneoId] = useState(null)
  const [organizadorId, setOrganizadorId] = useState(null)

  useEffect(() => {
    if (hostPropio) return
    let cancelado = false
    async function resolver() {
      // hostname (window.location.hostname) siempre llega en minúsculas —
      // ilike en vez de eq para que un dominio guardado con mayúsculas por
      // error igual haga match (además de que el formulario ya lo guarda
      // en minúsculas de por sí).
      // 1. ¿El dominio es de UN torneo puntual? (feature original)
      const { data: t } = await supabase.from('tournaments').select('id').ilike('custom_domain', hostname).maybeSingle()
      if (cancelado) return
      if (t?.id) { setTorneoId(t.id); setEstado('torneo'); return }

      // 2. ¿El dominio es la vitrina de un organizador (varios torneos)?
      const { data: o } = await supabase.from('organizador_perfiles').select('organizador_id').ilike('custom_domain', hostname).maybeSingle()
      if (cancelado) return
      if (o?.organizador_id) { setOrganizadorId(o.organizador_id); setEstado('organizador'); return }

      setEstado('sin_vincular')
    }
    resolver()
    return () => { cancelado = true }
  }, [hostname, hostPropio])

  if (hostPropio) return children

  if (estado === 'cargando') {
    return <div style={loadingStyle}>CARGANDO...</div>
  }

  if (estado === 'sin_vincular') {
    return (
      <div style={{
        ...loadingStyle,
        flexDirection: 'column',
        gap: '12px',
        letterSpacing: 'normal',
        color: '#9aa0a6',
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2rem' }}>🌐</div>
        <div style={{ color: '#fff', fontWeight: '700', fontSize: '1.05rem' }}>
          Este dominio todavía no está vinculado a ningún torneo
        </div>
        <div style={{ fontSize: '.85rem', maxWidth: '360px', lineHeight: 1.5 }}>
          Configurá el dominio en la pestaña Personalización del torneo (o en "Mi dominio" si es la vitrina de un organizador) y apuntá el DNS a Golmebol.
        </div>
      </div>
    )
  }

  if (estado === 'torneo') {
    // Dominio de UN torneo puntual → página pública de ese torneo directo
    // (MemoryRouter para contexto de router fuera del BrowserRouter; el id
    // llega por prop).
    return (
      <Suspense fallback={<div style={loadingStyle}>CARGANDO...</div>}>
        <MemoryRouter initialEntries={[`/t/${torneoId}`]}>
          <TorneoPublicoPage tournamentId={torneoId} />
        </MemoryRouter>
        <MarcaGolmebol/>
      </Suspense>
    )
  }

  // Dominio de un ORGANIZADOR → vitrina con todos sus torneos como página
  // de inicio, y cada torneo individual como ruta hermana dentro del mismo
  // dominio (así el visitante nunca sale del dominio propio del organizador).
  return (
    <Suspense fallback={<div style={loadingStyle}>CARGANDO...</div>}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<OrganizadorVitrinaPage organizadorId={organizadorId} />} />
          <Route path="/t/:id" element={<TorneoPublicoPage />} />
        </Routes>
      </MemoryRouter>
      <MarcaGolmebol/>
    </Suspense>
  )
}
