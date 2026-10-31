import { sumarGlobal, criterioLlave } from './penales'
// Deriva el estado "en vivo" de un partido a partir del snapshot que YA suben
// en tiempo real la planilla completa (matches.live_state) o la planilla
// rápida (matches.live_state_rapida) mientras el árbitro está cargando el
// partido — no hace falta un estado nuevo en la base de datos ni que el
// árbitro haga nada distinto: si hay un snapshot reciente de cualquiera de
// las dos planillas y el partido no está finalizado, está en vivo.
const MINUTOS_STALE = 25 // si nadie actualiza el snapshot hace más de esto, se considera abandonado (el árbitro cerró la app sin terminar) y no se muestra como en vivo

// ¿La planilla rápida ya pasó por la pantalla del partido? Lo dice la propia
// planilla (partidoIniciado) o se deduce de lo que ya hay cargado (por si el
// borrador es de antes de que existiera esa marca).
function rapidaYaIniciada(snap) {
  return !!snap.partidoIniciado || snap.corriendo === true || (snap.segundos || 0) > 0 || (snap.periodo || 1) > 1 || (snap.eventos || []).length > 0
}

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
  // (Si el árbitro YA estaba planillando y salió un momento a otra pantalla —ej. a
  // asignar el número de un jugador nuevo— el partido sigue en vivo.)
  if (tipo === 'rapida' && snap.step !== 'partido' && !rapidaYaIniciada(snap)) return null
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

  // TIEMPO EXTRA: al cumplirse el tiempo el reloj NO se detiene; sigue corriendo
  // hasta que el árbitro toque "Ir al descanso" / "Finalizar". Mientras tanto
  // sale "EXTRA +m:ss" (lo que se pasó del tiempo) en vez de seguir sumando.
  const limiteSeg = (snap.duracionMinutos || 0) * 60 + (tipo === 'completa' ? (snap.tiempoExtra || 0) * 60 : 0)
  let extra = null
  if (!snap.tiempoAgotado && limiteSeg > 0 && segundos > limiteSeg) {
    const pasado = segundos - limiteSeg
    extra = `+${Math.floor(pasado / 60)}:${String(pasado % 60).padStart(2, '0')}`
  }

  return {
    golesLocal, golesVis, extra,
    periodo,
    descanso,
    corriendo: !!snap.corriendo,
    tiempoAgotado: !!snap.tiempoAgotado,
    reloj: `${minuto}:${String(seg).padStart(2, '0')}`,
  }
}

// Junta el snapshot más reciente entre planilla completa y rápida — mismo
// criterio que usa derivarEnVivo, factorizado acá para no repetirlo en cada
// función nueva que necesite leer datos del partido en vivo.
export function snapshotMasReciente(match) {
  const candidatos = []
  if (match?.live_state)        candidatos.push({ snap: match.live_state,        updatedAt: match.live_state_updated_at,        tipo: 'completa' })
  if (match?.live_state_rapida) candidatos.push({ snap: match.live_state_rapida, updatedAt: match.live_state_rapida_updated_at, tipo: 'rapida' })
  if (candidatos.length === 0) return null
  candidatos.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  return candidatos[0].snap ? candidatos[0] : null
}

// Colores de uniforme que eligieron los árbitros al iniciar el partido (o
// null si no los pusieron todavía) — la planilla completa guarda el color
// visitante como `colorVisitante`, la rápida como `colorVis`; acá se
// homogeniza para quien lo use no tenga que saber cuál de las dos está
// activa.
export function derivarColoresUniforme(match) {
  const picked = snapshotMasReciente(match)
  if (!picked) return { colorLocal: null, colorVisitante: null }
  const { snap, tipo } = picked
  return {
    colorLocal: snap.colorLocal || null,
    colorVisitante: (tipo === 'rapida' ? snap.colorVis : snap.colorVisitante) || null,
  }
}

// Faltas acumuladas (las que llevan a tiro libre directo desde la 5ta, solo
// aplica a Fútbol 5) y tarjetas amarillas/azules/rojas, TOTALIZADAS POR EQUIPO (no
// por jugador) — pensado para mostrarlas chiquitas en el marcador en vivo de
// la portada, como un canal deportivo. Las faltas cuentan solo las del
// período actual (se reinician cada mitad, igual que en la pantalla del
// árbitro); las tarjetas cuentan todo el partido.
export function derivarFaltasYTarjetas(match) {
  const vacio = { faltasLocal: 0, faltasVisitante: 0, amarillasLocal: 0, amarillasVisitante: 0, azulesLocal: 0, azulesVisitante: 0, rojasLocal: 0, rojasVisitante: 0, mostrarFaltas: false }
  const picked = snapshotMasReciente(match)
  if (!picked) return vacio
  const { snap, tipo } = picked
  const periodoActual = snap.periodo || 1
  // Las faltas acumuladas solo existen en Fútbol 5. El letrero FALTAS solo sale si en este
  // partido ya se marcó alguna falta (en cualquier tiempo): si el planillador no las está
  // marcando, no se muestra un "FALTAS 0" que no significa nada. Una vez que se marca la
  // primera, el letrero se queda (y cada tiempo arranca en 0).
  const modalidad = match?.tournaments?.modalidad || null
  const sinFaltas = modalidad ? modalidad !== 'Fútbol 5' : false

  if (tipo === 'rapida') {
    const eventos = snap.eventos || []
    const contar = (team, tipoEvento, soloPeriodoActual) => eventos.filter(e =>
      e.team === team && e.tipo === tipoEvento && (!soloPeriodoActual || e.periodo === periodoActual)
    ).length
    const r = {
      faltasLocal:         contar('local',      'falta_acum', true),
      faltasVisitante:     contar('visitante',  'falta_acum', true),
      amarillasLocal:      contar('local',      'yellow_card', false),
      amarillasVisitante:  contar('visitante',  'yellow_card', false),
      azulesLocal:         contar('local',      'blue_card', false),
      azulesVisitante:     contar('visitante',  'blue_card', false),
      rojasLocal:          contar('local',      'red_card', false),
      rojasVisitante:      contar('visitante',  'red_card', false),
    }
    const hayFaltas = eventos.some(e => e.tipo === 'falta_acum')
    return { ...r, mostrarFaltas: !sinFaltas && hayFaltas }
  }

  const faltasPeriodo = (faltasAcum) => (faltasAcum?.[`p${periodoActual}`] || []).filter(Boolean).length
  const conTarjeta = (jugs, campo) => (jugs || []).filter(j => j[campo]).length
  const r = {
    faltasLocal:         faltasPeriodo(snap.faltasAcumLocal),
    faltasVisitante:     faltasPeriodo(snap.faltasAcumVis),
    amarillasLocal:      conTarjeta(snap.jugadoresLocal, 'amarilla'),
    amarillasVisitante:  conTarjeta(snap.jugadoresVisitante, 'amarilla'),
    azulesLocal:         conTarjeta(snap.jugadoresLocal, 'azul'),
    azulesVisitante:     conTarjeta(snap.jugadoresVisitante, 'azul'),
    rojasLocal:          conTarjeta(snap.jugadoresLocal, 'roja'),
    rojasVisitante:      conTarjeta(snap.jugadoresVisitante, 'roja'),
  }
  const hayFaltas = [snap.faltasAcumLocal, snap.faltasAcumVis].some(fa => fa && Object.values(fa).some(arr => Array.isArray(arr) && arr.some(Boolean)))
  return { ...r, mostrarFaltas: !sinFaltas && hayFaltas }
}

// Lista de goles (jugador + número de camiseta + minuto) del partido, sacada
// del mismo snapshot que ya se sincroniza en vivo — para el detalle al tocar un
// partido en vivo y para las gráficas de la transmisión.
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
    goles = (snap.eventos || []).filter(e => e.tipo === 'goal').map(e => {
      const arr = e.team === 'local' ? snap.jugadoresLocal : snap.jugadoresVisitante
      const porId = e.jugadorId ? (arr || []).find(j => j.id === e.jugadorId) : null
      return {
        equipo: e.team, jugador: e.jugadorNombre || 'Jugador', numero: String(e.numero ?? porId?.numero ?? '').trim(),
        minuto: e.minuto || null, periodo: e.periodo || 1,
        jugadorId: e.jugadorId || null, foto: porId?.photo_face_url || porId?.photo_url || null,
      }
    })
  } else {
    const buscarJug = (arr, numero) => (arr || []).find(j => String(j.numero) === String(numero))
    const buscarNombre = (arr, numero) => buscarJug(arr, numero)?.nombre || 'Jugador'
    ;(snap.golesLocal || []).filter(Boolean).forEach(g => {
      const j = buscarJug(snap.jugadoresLocal, g.numero)
      goles.push({ equipo: 'local', jugador: buscarNombre(snap.jugadoresLocal, g.numero), numero: String(g.numero ?? '').trim(), minuto: g.minuto || null, periodo: g.periodo || 1, jugadorId: j?.id || null, foto: j?.photo_face_url || j?.photo_url || null })
    })
    ;(snap.golesVisitante || []).filter(Boolean).forEach(g => {
      const j = buscarJug(snap.jugadoresVisitante, g.numero)
      goles.push({ equipo: 'visitante', jugador: buscarNombre(snap.jugadoresVisitante, g.numero), numero: String(g.numero ?? '').trim(), minuto: g.minuto || null, periodo: g.periodo || 1, jugadorId: j?.id || null, foto: j?.photo_face_url || j?.photo_url || null })
    })
  }
  // `duracion` = minutos de un tiempo: el tablero lo suma a los goles del 2.º tiempo (min 17 del 2T = 37').
  return goles.map(g => ({ ...g, duracion: snap.duracionMinutos || 0 })).sort((a, b) => (a.periodo - b.periodo) || ((parseInt(a.minuto) || 0) - (parseInt(b.minuto) || 0)))
}

// Minutos que dura cada tiempo en el partido en vivo (0 si no se sabe).
export function duracionPeriodo(match) {
  const picked = snapshotMasReciente(match)
  return picked?.snap?.duracionMinutos || 0
}

// Igual que extraerGoles, pero con el player_id y el team_id REALES (no
// 'local'/'visitante') — para poder sumar estos goles a la tabla de
// goleadores del torneo (que se identifica por player_id) mientras el
// partido se sigue jugando, sin esperar a que el árbitro guarde el
// resultado final. Como se vuelve a derivar del snapshot completo cada
// vez, si el árbitro borra un gol que había metido por error, el gol
// simplemente deja de aparecer acá en el próximo snapshot — no hace falta
// ningún manejo especial para las correcciones.
export function extraerGolesConJugador(match) {
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
      teamId: e.team === 'local' ? match.home_team_id : match.away_team_id,
      jugadorId: e.jugadorId || null,
      jugadorNombre: e.jugadorNombre || 'Jugador',
      minuto: e.minuto || null, periodo: e.periodo || 1,
    }))
  } else {
    const buscar = (arr, numero) => (arr || []).find(j => String(j.numero) === String(numero))
    ;(snap.golesLocal || []).filter(Boolean).forEach(g => {
      const j = buscar(snap.jugadoresLocal, g.numero)
      goles.push({ teamId: match.home_team_id, jugadorId: j?.id || null, jugadorNombre: j?.nombre || 'Jugador', minuto: g.minuto || null, periodo: g.periodo || 1 })
    })
    ;(snap.golesVisitante || []).filter(Boolean).forEach(g => {
      const j = buscar(snap.jugadoresVisitante, g.numero)
      goles.push({ teamId: match.away_team_id, jugadorId: j?.id || null, jugadorNombre: j?.nombre || 'Jugador', minuto: g.minuto || null, periodo: g.periodo || 1 })
    })
  }
  return goles.sort((a, b) => (a.periodo - b.periodo) || ((parseInt(a.minuto) || 0) - (parseInt(b.minuto) || 0)))
}

// Nómina (número + nombre) de cada equipo, sacada del mismo snapshot en vivo
// — para la gráfica de "jugadores" del panel de control en vivo. Mismo
// snapshot que ya usan extraerGoles/extraerTarjetas (el árbitro la carga al
// armar la planilla, sea completa o rápida), así que no hace falta pedir
// nada nuevo a la base de datos.
export function extraerJugadores(match) {
  if (!match) return { local: [], visitante: [] }
  const candidatos = []
  if (match.live_state)        candidatos.push({ snap: match.live_state,        updatedAt: match.live_state_updated_at })
  if (match.live_state_rapida) candidatos.push({ snap: match.live_state_rapida, updatedAt: match.live_state_rapida_updated_at })
  if (candidatos.length === 0) return { local: [], visitante: [] }
  candidatos.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  const snap = candidatos[0].snap
  if (!snap) return { local: [], visitante: [] }
  // Solo los jugadores PLANILLADOS: con nombre y con número de camiseta. La
  // planilla trae todo el plantel inscrito (y casillas vacías de relleno), pero a
  // los que no van a jugar no se les asigna camiseta — esos no deben salir en
  // la nómina de la transmisión. Se ordenan por número de camiseta.
  const numeroDe = j => parseInt(j.numero, 10)
  const limpiar = arr => (arr || [])
    .filter(j => (j?.nombre || '').trim() && String(j?.numero ?? '').trim() !== '')
    .map(j => ({ numero: String(j.numero).trim(), nombre: j.nombre }))
    .sort((a, b) => {
      const na = numeroDe(a), nb = numeroDe(b)
      if (Number.isNaN(na) && Number.isNaN(nb)) return 0
      if (Number.isNaN(na)) return 1
      if (Number.isNaN(nb)) return -1
      return na - nb
    })
  return { local: limpiar(snap.jugadoresLocal), visitante: limpiar(snap.jugadoresVisitante) }
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

// ── Ida y vuelta ─────────────────────────────────────────────────────────
// Cuando una llave de eliminación se juega a dos partidos, la "vuelta" se
// marca poniéndole al campo `ronda` la palabra "vuelta" (ej. "Cuartos
// (vuelta)", "Vuelta") — así lo hacen tanto el generador automático de
// brackets como la creación manual de un partido suelto.

// ¿Este partido es la "vuelta" de una llave ida y vuelta?
function esPartidoVuelta(match) {
  return !!(match?.ronda && match.ronda.toLowerCase().includes('vuelta') && !match.ronda.toLowerCase().includes('repechaje'))
}

// Busca el otro partido de la misma llave (ida ↔ vuelta): mismo torneo,
// misma fase, mismos dos equipos (sin importar si quedaron invertidos como
// local/visitante). `todosPartidos` puede traer partidos de cualquier
// torneo/fase — el filtro se hace acá adentro.
export function buscarPartidoHermano(match, todosPartidos) {
  if (!match) return null
  const clave = [match.home_team_id, match.away_team_id].sort().join('|')
  return (todosPartidos || []).find(m =>
    m.id !== match.id &&
    m.tournament_id === match.tournament_id &&
    m.fase === match.fase &&
    [m.home_team_id, m.away_team_id].sort().join('|') === clave
  ) || null
}

// Goles propios de un partido (sea que ya haya terminado o esté en vivo),
// en términos de SU PROPIO local/visitante.
function golesPropios(match) {
  if (!match) return { local: 0, visitante: 0 }
  if (match.status === 'finished') return { local: match.home_score || 0, visitante: match.away_score || 0 }
  const vivo = derivarEnVivo(match)
  if (vivo) return { local: vivo.golesLocal, visitante: vivo.golesVis }
  return { local: 0, visitante: 0 }
}

// Marcador GLOBAL de una llave ida y vuelta, visto desde la perspectiva de
// `match` (o sea, en términos de SU local/visitante) — suma los goles de
// ambos partidos mapeados por equipo, no por local/visitante (que se
// invierte en la vuelta). Si no hay hermano (todavía no existe el otro
// partido), el global es simplemente el marcador propio.
export function marcadorGlobal(match, hermano) {
  const propio = golesPropios(match)
  if (!hermano) return { local: propio.local, visitante: propio.visitante, hayHermano: false }
  const otro = golesPropios(hermano)
  // Si en el hermano el equipo local es el que en `match` es visitante,
  // quiere decir que quedaron invertidos (lo normal en la vuelta).
  const invertido = hermano.home_team_id === match.away_team_id
  const otroLocal     = invertido ? otro.visitante : otro.local
  const otroVisitante = invertido ? otro.local      : otro.visitante
  // El criterio (goles o puntos) lo eligió el organizador al crear la llave; si no hay nada guardado, suma goles como siempre.
  const g = sumarGlobal({ criterio: criterioLlave(match), propioLocal: propio.local, propioVis: propio.visitante, otroLocal, otroVis: otroVisitante })
  return { local: g.local, visitante: g.visitante, hayHermano: true }
}

// ── Varios partidos en una misma transmisión ────────────────────────────
// Antes cada transmisión (site_config.en_vivo_streams) solo podía tener UN
// partido para el marcador (match_id). Ahora puede tener varios
// (match_ids) — para cuando en una misma cancha se juegan varios partidos
// seguidos sin cortar la transmisión — y el marcador va cambiando solo al
// que el árbitro tenga abierto en la planilla en cada momento. match_id se
// sigue leyendo para las transmisiones que se armaron antes de que
// existiera match_ids, así ninguna se queda sin marcador por este cambio.

// Ids de partidos configurados para una transmisión, en el orden en que se
// agregaron — ese orden es el que se usa para decidir cuál es "el que
// sigue" cuando ninguno está en vivo todavía.
// ── Transmisión que "sigue" un torneo ───────────────────────────────────
// En vez de elegir los partidos uno por uno (match_ids), el organizador puede
// dejar la transmisión siguiendo un torneo (stream.torneo_auto) y, opcional,
// una cancha (stream.cancha_auto): el marcador toma solo el partido de ese
// torneo (y cancha) que el árbitro tenga EN VIVO en ese momento. El link de
// OBS y el de control no cambian nunca. Si no hay ninguno en vivo no se
// muestra marcador (no se inventa un "próximo partido"). Si hay varios en
// vivo a la vez en el mismo torneo y no se eligió cancha, gana el que tuvo
// actividad más reciente.
export function streamTieneMarcador(stream) {
  return !!stream?.torneo_auto || idsPartidosDeStream(stream).length > 0
}

export function partidoAutoDeTorneo(stream, partidos) {
  const vivos = (partidos || []).filter(p => (
    p.tournament_id === stream.torneo_auto
    && (!stream.cancha_auto || String(p.cancha_id) === String(stream.cancha_auto))
    && derivarEnVivo(p)
  ))
  if (vivos.length <= 1) return vivos[0] || null
  const actividad = p => Math.max(Date.parse(p.live_state_updated_at) || 0, Date.parse(p.live_state_rapida_updated_at) || 0)
  return [...vivos].sort((a, b) => actividad(b) - actividad(a))[0]
}

export function idsPartidosDeStream(stream) {
  if (Array.isArray(stream?.match_ids) && stream.match_ids.length > 0) return stream.match_ids
  return stream?.match_id ? [stream.match_id] : []
}

// De una lista de partidos (los configurados en la transmisión), elige cuál
// mostrar ahora mismo: el que está en vivo (el árbitro ya tiene la planilla
// abierta); si ninguno está en vivo todavía, el próximo que no se ha
// jugado (para que se vea "A vs B" mientras arranca); si ya se jugaron
// todos, el último (para que el marcador final se quede en pantalla en vez
// de desaparecer de un momento a otro).
export function elegirPartidoActivo(candidatos) {
  if (!candidatos || candidatos.length === 0) return null
  const enVivo = candidatos.find(p => derivarEnVivo(p))
  if (enVivo) return enVivo
  const pendiente = candidatos.find(p => p.status !== 'finished')
  if (pendiente) return pendiente
  return candidatos[candidatos.length - 1]
}

// Junta los dos pasos de arriba cuando ya se tiene cargada una lista de
// partidos disponibles (por ejemplo, los no finalizados que ya trae la
// página) — saca los ids de la transmisión y elige, de esos, cuál está en
// esa lista.
export function partidoActivoDeStream(stream, partidosDisponibles) {
  if (stream?.torneo_auto) return partidoAutoDeTorneo(stream, partidosDisponibles)
  const ids = idsPartidosDeStream(stream)
  if (ids.length === 0) return null
  const candidatos = ids.map(id => (partidosDisponibles || []).find(p => p.id === id)).filter(Boolean)
  return elegirPartidoActivo(candidatos)
}
