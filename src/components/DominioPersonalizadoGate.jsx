import { useEffect, useState, lazy, Suspense } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TorneoPublicoPage = lazy(() => import('../pages/TorneoPublicoPage'))

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

  const [estado, setEstado] = useState(hostPropio ? 'ok' : 'cargando') // ok | cargando | torneo | sin_vincular
  const [torneoId, setTorneoId] = useState(null)

  useEffect(() => {
    if (hostPropio) return
    let cancelado = false
    async function resolver() {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id')
        .eq('custom_domain', hostname)
        .maybeSingle()
      if (cancelado) return
      if (error || !data?.id) {
        setEstado('sin_vincular')
        return
      }
      setTorneoId(data.id)
      setEstado('torneo')
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
          Configurá el dominio en la pestaña Personalización del torneo y apuntá el DNS a Golmebol.
        </div>
      </div>
    )
  }

  // Dominio custom → página pública del torneo (MemoryRouter para contexto de
  // router fuera del BrowserRouter; el id llega por prop)
  return (
    <Suspense fallback={<div style={loadingStyle}>CARGANDO...</div>}>
      <MemoryRouter initialEntries={[`/t/${torneoId}`]}>
        <TorneoPublicoPage tournamentId={torneoId} />
      </MemoryRouter>
    </Suspense>
  )
}
