import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { snapshotMasReciente } from '../lib/liveMatch'
import { CIERRE_AUTO_MS, calcularFinTiempoSnap, planillaEstaAbierta } from '../lib/cierreAutomatico'

// VIGILANTE DEL CIERRE AUTOMÁTICO.
// Cierra solas las planillas que se quedaron sin cerrar 5 minutos después de terminar el partido, AUNQUE
// la planilla de ese partido no esté abierta en ningún celular (ej.: el árbitro se olvidó y abrió la planilla
// de otro partido). Corre en cualquier celular/computador con la app abierta y una cuenta de administrador,
// organizador o árbitro: cada minuto revisa los partidos con borrador vencido y, si hay alguno, abre la MISMA
// planilla del partido en modo oculto (sin pantalla ni sonido) para que se guarde tal como estaba, sin MVP.
// Si no hay nadie con la app abierta, queda pendiente y se cierra apenas alguien la abra.

const PlanillaPartido = lazy(() => import('./PlanillaPartido'))
const PlanillaRapida  = lazy(() => import('./planillaRapida/PlanillaRapida'))
const PlanillaPapel   = lazy(() => import('./planillaPapel/PlanillaPapel'))

const REVISAR_CADA_MS = 60 * 1000
const VENTANA_DIAS = 3
const MAX_INTENTOS = 2
const ESPERA_ENTRE_INTENTOS_MS = 30 * 60 * 1000
const MAX_OCULTA_MS = 120 * 1000
const SELECT_PARTIDO = '*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)'

// partidoId -> { n, ultimo } (para no insistir con un partido que no se deja cerrar solo, ej. eliminatoria empatada)
const intentos = new Map()

function vencido(match) {
  const picked = snapshotMasReciente(match)
  if (!picked?.snap) return false
  const fin = calcularFinTiempoSnap(picked.snap, { updatedAt: picked.updatedAt })
  return !!fin && Date.now() - fin >= CIERRE_AUTO_MS
}

export default function CierreAutomaticoGlobal() {
  const { user, rol } = useAuthStore()
  const { pathname } = useLocation()
  const [oculta, setOculta] = useState(null) // { partido, tipo }
  const ocupadoRef = useRef(false)

  const rolOk = rol?.rol === 'admin' || rol?.rol === 'organizador'
  const activo = !!user?.id && (rolOk || pathname.startsWith('/arbitro'))

  useEffect(() => {
    if (!activo) return undefined
    let vivo = true

    async function revisar() {
      if (!vivo || ocupadoRef.current || document.hidden || !navigator.onLine) return
      ocupadoRef.current = true
      try {
        const desde = new Date(Date.now() - VENTANA_DIAS * 86400000).toISOString()
        const { data, error } = await supabase.from('matches')
          .select('id, status, tournament_id, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at')
          .neq('status', 'finished')
          .or(`live_state_updated_at.gte.${desde},live_state_rapida_updated_at.gte.${desde}`)
          .limit(60)
        if (error || !data) { ocupadoRef.current = false; return }
        const ahora = Date.now()
        const candidato = data.find(m => {
          if (planillaEstaAbierta(m.id)) return false
          const it = intentos.get(m.id)
          if (it && (it.n >= MAX_INTENTOS || ahora - it.ultimo < ESPERA_ENTRE_INTENTOS_MS)) return false
          return vencido(m)
        })
        if (!candidato) { ocupadoRef.current = false; return }
        // Varios celulares pueden estar vigilando: se espera un rato al azar y se confirma que siga sin cerrar
        await new Promise(r => setTimeout(r, Math.random() * 15000))
        if (!vivo || planillaEstaAbierta(candidato.id)) { ocupadoRef.current = false; return }
        const { data: p } = await supabase.from('matches').select(SELECT_PARTIDO).eq('id', candidato.id).maybeSingle()
        if (!vivo || !p || p.status === 'finished' || !vencido(p)) { ocupadoRef.current = false; return }
        const picked = snapshotMasReciente(p)
        const tipo = picked.tipo === 'completa' ? 'completa' : (picked.snap?.papel ? 'papel' : 'rapida')
        const it = intentos.get(p.id) || { n: 0, ultimo: 0 }
        intentos.set(p.id, { n: it.n + 1, ultimo: Date.now() })
        setOculta({ partido: p, tipo }) // ocupadoRef sigue en true hasta que termine
      } catch (e) {
        console.error('vigilante de cierre automático:', e)
        ocupadoRef.current = false
      }
    }

    const primero = setTimeout(revisar, 20000 + Math.random() * 10000)
    const tic = setInterval(revisar, REVISAR_CADA_MS)
    const alVolver = () => { if (!document.hidden) revisar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { vivo = false; clearTimeout(primero); clearInterval(tic); document.removeEventListener('visibilitychange', alVolver) }
  }, [activo])

  // Mientras la planilla oculta trabaja: sin avisos en pantalla y con un tope de tiempo
  useEffect(() => {
    if (!oculta) return undefined
    const alertOriginal = window.alert
    window.alert = (msg) => { console.log('[cierre automático]', msg) }
    const tope = setTimeout(() => terminar(), MAX_OCULTA_MS)
    return () => { window.alert = alertOriginal; clearTimeout(tope) }
  }, [oculta])

  function terminar() {
    setOculta(null)
    ocupadoRef.current = false
  }

  if (!oculta) return null
  const props = { partido: oculta.partido, onClose: terminar, onGuardarResultado: () => {}, oculta: true }
  const Comp = oculta.tipo === 'completa' ? PlanillaPartido : (oculta.tipo === 'papel' ? PlanillaPapel : PlanillaRapida)
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: 0, top: 0, width: 1, height: 1, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none', contain: 'layout paint', transform: 'translateZ(0)' }}>
      <Suspense fallback={null}>
        <Comp key={oculta.partido.id} {...props}/>
      </Suspense>
    </div>
  )
}
