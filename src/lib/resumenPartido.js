// Lógica pura (sin React) del resumen de un partido ya jugado: ordena los
// eventos guardados en match_events, arma el "minuto a minuto" con el
// marcador que va cambiando, y prepara los datos que usa el flyer.
//
// Cómo se guardan los eventos (ver PlanillaRapida / PlanillaPartido):
//  - event_type: 'goal' | 'yellow_card' | 'blue_card' | 'red_card' | 'falta_acum'
//  - minute: texto "MM:SS" del cronómetro DENTRO del tiempo (el reloj vuelve a
//    cero en el 2.º tiempo), o null si no se conoce.
//  - periodo: 1 ó 2 (null se trata como 1).
//  - player_id (con nombre sacado de players_publico) o player_nombre.
// No existen eventos de cambios ni de penales (los penales de definición van
// en las columnas penales_* del partido), así que eso no se inventa aquí.

export const TIPOS_TARJETA = { yellow_card: 'amarilla', blue_card: 'azul', red_card: 'roja' }
export const COLOR_TARJETA = { amarilla: '#f9c400', azul: '#1a73e8', roja: '#d93025' }
export const FASE_LABEL = {
  grupo: 'Grupo', octavos: 'Octavos', cuartos: 'Cuartos de final', semifinal: 'Semifinal', final: 'Final', amistoso: 'Partido amistoso',
}

// "12:34" -> 754 · "12" / "12'" -> 720 (formato viejo, solo minutos) · otro -> null
export function segundosDe(minute) {
  if (minute == null) return null
  const t = String(minute).trim()
  let m = /^(\d{1,3}):(\d{2})$/.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = /^(\d{1,3})\s*['′]?$/.exec(t)
  if (m) return Number(m[1]) * 60
  return null
}

// "12:34" tal como lo marcó el cronómetro ("12" viejo -> "12:00"); null -> null
export function textoMinuto(minute) {
  const s = segundosDe(minute)
  if (s == null) return null
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Orden cronológico real: primero por tiempo (periodo), luego por reloj. Los
// eventos sin minuto van al final de su tiempo, en el orden en que llegaron.
export function ordenarEventos(eventos) {
  return (eventos || [])
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const pa = a.e.periodo || 1
      const pb = b.e.periodo || 1
      if (pa !== pb) return pa - pb
      const sa = segundosDe(a.e.minute)
      const sb = segundosDe(b.e.minute)
      if (sa == null && sb == null) return a.i - b.i
      if (sa == null) return 1
      if (sb == null) return -1
      return sa - sb || a.i - b.i
    })
    .map(x => x.e)
}

// Agrupa los goles de un mismo jugador en una sola fila (con cantidad y
// minutos). Se agrupa por player_id (más confiable) y si no por el nombre.
export function agruparGoles(eventosGol, nombreDe) {
  const orden = []
  const porJugador = new Map()
  ;(eventosGol || []).forEach(e => {
    const key = e.player_id || nombreDe(e)
    if (!porJugador.has(key)) { porJugador.set(key, { jugador: nombreDe(e), cantidad: 0, minutos: [] }); orden.push(key) }
    const acc = porJugador.get(key)
    acc.cantidad += 1
    const t = textoMinuto(e.minute)
    if (t) acc.minutos.push(t)
  })
  return orden.map(key => porJugador.get(key))
}

function ladoDe(e, partido) {
  if (e.team_id && e.team_id === partido.home_team_id) return 'local'
  if (e.team_id && e.team_id === partido.away_team_id) return 'visitante'
  return null
}

// Resumen completo de un partido a partir de sus eventos.
//  - filas: línea de tiempo (hitos + eventos) lista para pintar
//  - totalFaltas: cuántas faltas acumuladas hay (para el botón "mostrar faltas")
//  - detalleIncompleto: los goles registrados no suman el marcador final
export function construirResumen(partido, eventos, nombreDe, { incluirFaltas = false } = {}) {
  const ordenados = ordenarEventos(eventos).filter(e =>
    e.event_type === 'goal' || TIPOS_TARJETA[e.event_type] || e.event_type === 'falta_acum')

  const hayDosTiempos = ordenados.some(e => (e.periodo || 1) >= 2)
  let gl = 0
  let gv = 0
  let marcadorDescanso = null
  const faltasPorLadoPeriodo = {}
  const filas = []
  let totalFaltas = 0

  filas.push({ id: 'hito-inicio', tipo: 'hito', texto: 'Inicio del partido' })

  let descansoInsertado = false
  const insertarDescanso = () => {
    if (descansoInsertado || !hayDosTiempos) return
    descansoInsertado = true
    marcadorDescanso = `${gl} - ${gv}`
    filas.push({ id: 'hito-descanso', tipo: 'hito', texto: 'Medio tiempo', marcador: marcadorDescanso })
  }

  ordenados.forEach(e => {
    const periodo = e.periodo || 1
    if (periodo >= 2) insertarDescanso()
    const lado = ladoDe(e, partido)
    const minuto = textoMinuto(e.minute)

    if (e.event_type === 'falta_acum') {
      totalFaltas += 1
      const k = `${lado}-${periodo}`
      faltasPorLadoPeriodo[k] = (faltasPorLadoPeriodo[k] || 0) + 1
      if (incluirFaltas) {
        filas.push({ id: e.id, tipo: 'falta', lado, periodo, minuto, jugador: nombreDe(e), numeroFalta: faltasPorLadoPeriodo[k] })
      }
      return
    }

    if (e.event_type === 'goal') {
      if (lado === 'local') gl += 1
      else if (lado === 'visitante') gv += 1
      filas.push({ id: e.id, tipo: 'gol', lado, periodo, minuto, jugador: nombreDe(e), marcador: `${gl} - ${gv}`, golesLocal: gl, golesVisitante: gv })
      return
    }

    filas.push({ id: e.id, tipo: TIPOS_TARJETA[e.event_type], lado, periodo, minuto, jugador: nombreDe(e) })
  })

  // Si hubo dos tiempos pero ningún evento del 2.º tiempo cae después, igual
  // ya se insertó el medio tiempo al ver el primero; si no hubo, no se muestra.
  const penales = penalesDe(partido)
  filas.push({ id: 'hito-final', tipo: 'hito', texto: 'Final del partido', marcador: `${partido.home_score ?? 0} - ${partido.away_score ?? 0}`, final: true })
  if (penales) {
    filas.push({ id: 'hito-penales', tipo: 'hito', texto: 'Definición por penales', marcador: `${penales.local} - ${penales.visitante}`, ganador: penales.ganador })
  }

  const totalGolesRegistrados = gl + gv
  const detalleIncompleto = totalGolesRegistrados !== (Number(partido.home_score) || 0) + (Number(partido.away_score) || 0)

  return { filas, totalFaltas, detalleIncompleto, marcadorDescanso, golesRegistradosLocal: gl, golesRegistradosVisitante: gv }
}

// Penales de definición: solo si el partido los tiene guardados.
export function penalesDe(partido) {
  const l = partido?.penales_local
  const v = partido?.penales_visitante
  const tieneMarcador = l != null && v != null && l !== v
  if (!partido?.penales_ganador && !tieneMarcador) return null
  const ganador = partido.penales_ganador
    ? (partido.penales_ganador === 'home' ? 'local' : 'visitante')
    : (l > v ? 'local' : 'visitante')
  return { local: l ?? '-', visitante: v ?? '-', ganador }
}

// Datos por equipo para el flyer: goles agrupados por jugador y tarjetas.
export function datosParaFlyer(partido, eventos, nombreDe) {
  const ord = ordenarEventos(eventos)
  const goles = ord.filter(e => e.event_type === 'goal')
  const tarjetas = ord.filter(e => TIPOS_TARJETA[e.event_type])
  const delLado = (lista, lado) => lista.filter(e => ladoDe(e, partido) === lado)
  const tarj = lado => delLado(tarjetas, lado).map(e => ({ jugador: nombreDe(e), color: TIPOS_TARJETA[e.event_type] }))
  return {
    golesLocal: agruparGoles(delLado(goles, 'local'), nombreDe),
    golesVisitante: agruparGoles(delLado(goles, 'visitante'), nombreDe),
    tarjetasLocal: tarj('local'),
    tarjetasVisitante: tarj('visitante'),
  }
}

// Acorta un nombre largo para que quepa en una fila del flyer: primero
// vuelve inicial las últimas palabras ("Maria Camila Zuluaga Valencia" ->
// "Maria Camila Zuluaga V."), sin tocar la primera.
export function acortarNombre(nombre, max = 26) {
  const limpio = String(nombre || '').replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  const palabras = limpio.split(' ')
  for (let i = palabras.length - 1; i >= 1; i--) {
    if (palabras.join(' ').length <= max) break
    if (palabras[i].length > 2) palabras[i] = palabras[i][0] + '.'
  }
  const res = palabras.join(' ')
  return res.length <= max ? res : res.slice(0, max - 1) + '…'
}
