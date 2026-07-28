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
  // El árbitro tocó "Suspender" (parar el partido sin guardar resultado, para
  // seguirlo después) — no está en cancha ahora mismo, así que no debe salir
  // como "en vivo" hasta que vuelva a entrar y siga jugando.
  if (snap.pausado) return null

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

  const periodo = snap.periodo || 1
  // "Descanso" = se acabó el tiempo del primer período y el árbitro todavía
  // no arrancó el segundo (que es lo que pone periodo en 2). En el segundo
  // período, tiempoAgotado ya significa que se acabó el partido (no descanso).
  const descanso = !!snap.tiempoAgotado && periodo === 1

  return {
    golesLocal, golesVis,
    periodo,
    descanso,
    corriendo: !!snap.corriendo,
    tiempoAgotado: !!snap.tiempoAgotado,
    reloj: `${minuto}:${String(seg).padStart(2, '0')}`,
  }
}

// Lista de goles (jugador + minuto) del partido, sacada del mismo snapshot
// que ya se sincroniza en vivo — para el detalle al tocar un partido en vivo.
export function extraerGoles(match) {
  if (!match) return []
  const candidatos = []
  if (match.live_state)        candidatos.push({ snap: match.live_state,        updatedAt: match.live_state_updated_at,        tipo: 'completa' })
  if (match.live_state_rapida) candidatos.push({ snap: match.live_state_rapida, updatedAt: match.live_state_rapida_updated_at, tipo: 'rapida' })
  if (candidatos.length === 0) return []
  candidatos.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  const { snap, tipo } = candidatos[0]
  if (!snap) return []

  let goles = []
  if (tipo === 'rapida') {
    goles = (snap.eventos || []).filter(e => e.tipo === 'goal').map(e => ({
      equipo: e.team, jugador: e.jugadorNombre || 'Jugador', minuto: e.minuto || null, periodo: e.periodo || 1,
    }))
  } else {
    const buscarNombre = (arr, numero) => (arr || []).find(j => String(j.numero) === String(numero))?.nombre || 'Jugador'
    ;(snap.golesLocal || []).filter(Boolean).forEach(g => {
      goles.push({ equipo: 'local', jugador: buscarNombre(snap.jugadoresLocal, g.numero), minuto: g.minuto || null, periodo: g.periodo || 1 })
    })
    ;(snap.golesVisitante || []).filter(Boolean).forEach(g => {
      goles.push({ equipo: 'visitante', jugador: buscarNombre(snap.jugadoresVisitante, g.numero), minuto: g.minuto || null, periodo: g.periodo || 1 })
    })
  }
  return goles.sort((a, b) => (a.periodo - b.periodo) || ((parseInt(a.minuto) || 0) - (parseInt(b.minuto) || 0)))
}

// Tarjetas (amarilla/azul/roja) del partido, sacadas del mismo snapshot en
// vivo — para mostrarlas en el detalle del partido en la pantalla de inicio
// (antes solo se mostraban los goles, las tarjetas quedaban registradas bien
// en la planilla pero nunca se veían del lado del "en vivo").
const TIPOS_TARJETA = { yellow_card: 'amarilla', blue_card: 'azul', red_card: 'roja' }

export function extraerTarjetas(match) {
  if (!match) return []
  const candidatos = []
  if (match.live_state)        candidatos.push({ snap: match.live_state,        updatedAt: match.live_state_updated_at,        tipo: 'completa' })
  if (match.live_state_rapida) candidatos.push({ snap: match.live_state_rapida, updatedAt: match.live_state_rapida_updated_at, tipo: 'rapida' })
  if (candidatos.length === 0) return []
  candidatos.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  const { snap, tipo } = candidatos[0]
  if (!snap) return []

  let tarjetas = []
  if (tipo === 'rapida') {
    tarjetas = (snap.eventos || []).filter(e => TIPOS_TARJETA[e.tipo]).map(e => ({
      equipo: e.team, jugador: e.jugadorNombre || 'Jugador', color: TIPOS_TARJETA[e.tipo], minuto: e.minuto || null, periodo: e.periodo || 1,
    }))
  } else {
    const extraerDe = (jugs, equipo) => (jugs || []).forEach(j => {
      const nombre = j.nombre || (j.numero ? `#${j.numero}` : 'Jugador')
      if (j.amarilla) tarjetas.push({ equipo, jugador: nombre, color: 'amarilla', minuto: typeof j.amarilla === 'string' ? j.amarilla : null, periodo: 1 })
      if (j.azul)     tarjetas.push({ equipo, jugador: nombre, color: 'azul',     minuto: typeof j.azul === 'string' ? j.azul : null, periodo: 1 })
      if (j.roja)     tarjetas.push({ equipo, jugador: nombre, color: 'roja',     minuto: typeof j.roja === 'string' ? j.roja : null, periodo: 1 })
    })
    extraerDe(snap.jugadoresLocal, 'local')
    extraerDe(snap.jugadoresVisitante, 'visitante')
  }
  return tarjetas
}
