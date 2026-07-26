// Deriva el estado "en vivo" de un partido a partir del snapshot que YA suben
// en tiempo real la planilla completa (matches.live_state) o la planilla
// rápida (matches.live_state_rapida) mientras el árbitro está cargando el
// partido — no hace falta un estado nuevo en la base de datos ni que el
// árbitro haga nada distinto: si hay un snapshot reciente de cualquiera de
// las dos planillas y el partido no está finalizado, está en vivo.
const MINUTOS_STALE = 25 // si nadie actualiza el snapshot hace más de esto, se considera abandonado (el árbitro cerró la app sin terminar) y no se muestra como en vivo

export function derivarEnVivo(match) {
  if (!match || match.status === 'finished') return null

  const candidatos = []
  if (match.live_state)        candidatos.push({ snap: match.live_state,        updatedAt: match.live_state_updated_at,        tipo: 'completa' })
  if (match.live_state_rapida) candidatos.push({ snap: match.live_state_rapida, updatedAt: match.live_state_rapida_updated_at, tipo: 'rapida' })
  if (candidatos.length === 0) return null

  candidatos.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  const { snap, updatedAt, tipo } = candidatos[0]
  if (!snap || !updatedAt) return null
  // Planilla rápida: mientras arma colores/roster todavía no empezó el partido de verdad
  if (tipo === 'rapida' && snap.step !== 'partido') return null

  const minutosDesde = (Date.now() - new Date(updatedAt).getTime()) / 60000
  if (minutosDesde > MINUTOS_STALE) return null

  let golesLocal, golesVis
  if (tipo === 'rapida') {
    const eventos = snap.eventos || []
    golesLocal = eventos.filter(e => e.team === 'local' && e.tipo === 'goal').length
    golesVis   = eventos.filter(e => e.team === 'visitante' && e.tipo === 'goal').length
  } else {
    golesLocal = (snap.golesLocal || []).filter(Boolean).length
    golesVis   = (snap.golesVisitante || []).filter(Boolean).length
  }

  let segundos = snap.segundos || 0
  if (snap.corriendo && snap.savedAt) {
    const transcurrido = Math.floor((Date.now() - new Date(snap.savedAt).getTime()) / 1000)
    if (transcurrido > 0) segundos += transcurrido
  }
  const minuto = Math.floor(segundos / 60)
  const seg = segundos % 60

  return {
    golesLocal, golesVis,
    periodo: snap.periodo || 1,
    corriendo: !!snap.corriendo,
    tiempoAgotado: !!snap.tiempoAgotado,
    reloj: `${minuto}:${String(seg).padStart(2, '0')}`,
  }
}
