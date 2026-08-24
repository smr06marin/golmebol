import { useEffect, useState, lazy, Suspense } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import MarcaGolmebol from './MarcaGolmebol'

const TorneoPublicoPage      = lazy(() => import('../pages/TorneoPublicoPage'))
const OrganizadorVitrinaPage = lazy(() => import('../pages/OrganizadorVitrinaPage'))
const ReservarEscenarioPage  = lazy(() => import('../pages/ReservarEscenarioPage'))
const PedirEscenarioPage     = lazy(() => import('../pages/PedirEscenarioPage'))

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
  // En Vercel, cuando se agregan el dominio raíz y el "www" juntos, uno
  // queda como producción y el otro redirige (308) hacia ese — así que el
  // visitante puede terminar en "www.miliga.com" aunque haya entrado a
  // "miliga.com" (o al revés). Se guarda/compara siempre sin "www." para
  // que no importe cuál de los dos haya quedado como el real.
  const hostnameBase = hostname.replace(/^www\./, '')

  const [estado, setEstado] = useState(hostPropio ? 'ok' : 'cargando') // ok | cargando | torneo | organizador | sin_vincular
  const [torneoId, setTorneoId] = useState(null)
  const [organizadorId, setOrganizadorId] = useState(null)

  useEffect(() => {
    if (hostPropio) return
    let cancelado = false
    async function resolver() {
      // ilike (no eq) para que un dominio guardado con mayúsculas por error
      // igual haga match, además de compararlo ya sin "www.".
      // 1. ¿El dominio es de UN torneo puntual? (feature original)
      const { data: t } = await supabase.from('tournaments').select('id').ilike('custom_domain', hostnameBase).maybeSingle()
      if (cancelado) return
      if (t?.id) { setTorneoId(t.id); setEstado('torneo'); return }

      // 2. ¿El dominio es la vitrina de un organizador (varios torneos)?
      const { data: o } = await supabase.from('organizador_perfiles').select('organizador_id').ilike('custom_domain', hostnameBase).maybeSingle()
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
  // de inicio, y cada torneo/reserva de cancha como ruta hermana dentro del
  // mismo dominio (así el visitante nunca sale del dominio propio). Se
  // arranca en el pathname real (no siempre en "/") para que un link
  // directo a /reservar/:escenarioId (compartido, o guardado en favoritos)
  // también funcione, no solo los links que salen desde la vitrina.
  const pathnameActual = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
  return (
    <Suspense fallback={<div style={loadingStyle}>CARGANDO...</div>}>
      <MemoryRouter initialEntries={[pathnameActual]}>
        <Routes>
          <Route path="/" element={<OrganizadorVitrinaPage organizadorId={organizadorId} />} />
          <Route path="/t/:id" element={<TorneoPublicoPage />} />
          <Route path="/reservar/:escenarioId" element={<ReservarEscenarioPage/>} />
          <Route path="/pedir/:escenarioId" element={<PedirEscenarioPage/>} />
          <Route path="*" element={<OrganizadorVitrinaPage organizadorId={organizadorId} />} />
        </Routes>
      </MemoryRouter>
      <MarcaGolmebol/>
    </Suspense>
  )
}
