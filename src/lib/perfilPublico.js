import { supabase } from './supabase'
import { hydratePlayersPublico } from './playersPublico'

// ── Datos de los perfiles PÚBLICOS de equipo (/e/:id) y jugador (/j/:id) ────
//
// REGLA DE PRIVACIDAD: acá solo se piden columnas seguras.
//  · equipos: id, nombre, escudo, ciudad, modalidad y género. NUNCA se pide
//    `select('*')` de `teams` porque esa tabla guarda la cédula, el teléfono y
//    el nombre del representante.
//  · jugadores: siempre desde `players_publico` (vista segura para visitantes),
//    nunca desde `players` (cédula, teléfono, fecha de nacimiento, etc.).

const COLS_EQUIPO = 'id, name, logo_url, city, modalidad, genero'
const COLS_JUGADOR = 'id, name, photo_url, photo_face_url, posicion, posicion_futbol5, posicion_futbol7, posicion_futbol11'
const COLS_PARTIDO = 'id, tournament_id, status, fase, played_at, home_score, away_score, home_team_id, away_team_id, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), tournaments(name, logo_url)'

// Posición del jugador según la modalidad del equipo/torneo (fútbol 5, 7 u 11).
export function posicionDeJugador(p, modalidad) {
  if (!p) return ''
  const m = String(modalidad || '')
  const campo = m.includes('11') ? 'posicion_futbol11' : m.includes('7') ? 'posicion_futbol7' : m.includes('5') ? 'posicion_futbol5' : null
  return (campo && p[campo]) || p.posicion || p.posicion_futbol5 || p.posicion_futbol7 || p.posicion_futbol11 || ''
}

// Resultado desde el punto de vista de `teamId`: 'G' | 'E' | 'P'
export function resultadoPara(partido, teamId) {
  const l = partido.home_score || 0, v = partido.away_score || 0
  const mios = partido.home_team_id === teamId ? l : v
  const rival = partido.home_team_id === teamId ? v : l
  return mios > rival ? 'G' : mios === rival ? 'E' : 'P'
}

function inicioHoy() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const porFechaDesc = (a, b) => new Date(b.played_at || 0) - new Date(a.played_at || 0)
const porFechaAsc  = (a, b) => new Date(a.played_at || 8.64e15) - new Date(b.played_at || 8.64e15)

// ── EQUIPO ──────────────────────────────────────────────────────────────────
export async function cargarEquipoPublico(id) {
  const [rEq, rPartidos, rTT, rTP, rStats, rLogros] = await Promise.all([
    supabase.from('teams').select(COLS_EQUIPO).eq('id', id).maybeSingle(),
    supabase.from('matches').select(COLS_PARTIDO).or(`home_team_id.eq.${id},away_team_id.eq.${id}`).limit(400),
    supabase.from('tournament_teams').select('tournament_id, tournaments(id, name, logo_url, season, modalidad, edicion)').eq('team_id', id),
    supabase.from('team_players').select('player_id, activo').eq('team_id', id),
    supabase.from('player_match_stats').select('player_id, goals_scored, yellow_cards, blue_cards, red_cards').eq('team_id', id),
    supabase.from('tournament_logros').select('id, tipo, tournament_id, tournaments(name, season)').eq('team_id', id),
  ])
  if (rEq.error) throw rEq.error
  const equipo = rEq.data
  if (!equipo) return { equipo: null }

  // ── Partidos ──
  const todos = (rPartidos.data || []).filter(p => p.home?.id && p.away?.id)
  const hoy = inicioHoy()
  const jugados = todos.filter(p => p.status === 'finished').sort(porFechaDesc)
  const proximos = todos
    .filter(p => p.status !== 'finished' && (!p.played_at || new Date(p.played_at) >= hoy))
    .sort(porFechaAsc)

  // ── Totales ──
  const tot = { pj: jugados.length, g: 0, e: 0, p: 0, gf: 0, gc: 0 }
  const porTorneoMap = {}
  jugados.forEach(m => {
    const local = m.home_team_id === id
    const gf = (local ? m.home_score : m.away_score) || 0
    const gc = (local ? m.away_score : m.home_score) || 0
    const r = resultadoPara(m, id)
    tot.gf += gf; tot.gc += gc
    if (r === 'G') tot.g++; else if (r === 'E') tot.e++; else tot.p++
    const t = (porTorneoMap[m.tournament_id] = porTorneoMap[m.tournament_id] || { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 })
    t.pj++; t.gf += gf; t.gc += gc
    if (r === 'G') t.g++; else if (r === 'E') t.e++; else t.p++
  })
  // forma: últimos 5, del más viejo al más nuevo
  const forma = jugados.slice(0, 5).map(m => resultadoPara(m, id)).reverse()

  // ── Torneos jugados ──
  const torneos = (rTT.data || [])
    .map(r => r.tournaments)
    .filter(Boolean)
    .map(t => ({ ...t, ...(porTorneoMap[t.id] || { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 }) }))
    .sort((a, b) => String(b.season || '').localeCompare(String(a.season || '')) || (b.edicion || 0) - (a.edicion || 0))

  // ── Plantilla (activos) con goles y tarjetas ──
  const activos = (rTP.data || []).filter(r => r.activo !== false)
  let plantilla
  try {
    const hid = await hydratePlayersPublico(activos, { columns: COLS_JUGADOR })
    const stats = {}
    ;(rStats.data || []).forEach(s => {
      const x = (stats[s.player_id] = stats[s.player_id] || { pj: 0, goles: 0, amarillas: 0, rojas: 0 })
      x.pj++; x.goles += s.goals_scored || 0
      x.amarillas += (s.yellow_cards || 0) + (s.blue_cards || 0); x.rojas += s.red_cards || 0
    })
    plantilla = hid
      .filter(r => r.players)
      .map(r => ({ ...r.players, ...(stats[r.player_id] || { pj: 0, goles: 0, amarillas: 0, rojas: 0 }) }))
      .sort((a, b) => b.goles - a.goles || b.pj - a.pj || (a.name || '').localeCompare(b.name || ''))
  } catch { plantilla = [] }

  // ── Palmarés ──
  const logros = (rLogros.data || [])
  const campeonatos = logros.filter(l => l.tipo === 'campeon')
  const subcampeonatos = logros.filter(l => l.tipo === 'subcampeon')
  const terceros = logros.filter(l => l.tipo === 'tercer_puesto')

  return { equipo, totales: tot, forma, jugados, proximos, torneos, plantilla, campeonatos, subcampeonatos, terceros }
}

// ── ARQUERO ─────────────────────────────────────────────────────────────────
// Goles que recibió el EQUIPO del jugador en ese partido (null si no se sabe).
// Se calcula con el marcador del partido, no con goals_conceded, porque ese campo
// solo se anota al último arquero que tapó: si hubo cambio, el primero quedaba en 0.
export function golesContraEquipo(s) {
  const m = s?.matches
  if (!m || m.home_score == null || m.away_score == null || !m.home?.id) return null
  const esLocal = s.team_id === m.home.id
  return (esLocal ? m.away_score : m.home_score) || 0
}

// ¿Su posición registrada es portero (en cualquier modalidad)?
export function esPortero(j) {
  if (!j) return false
  return [j.posicion, j.posicion_futbol5, j.posicion_futbol7, j.posicion_futbol11].some(p => /portero|arquero/i.test(String(p || '')))
}

// Datos de arquero a partir de sus filas de estadísticas. Un partido cuenta como
// "de arquero" si ese día atajó (fue_arquero).
// penales: filas de partido_penales donde fue el arquero (o null si la tabla no existe todavía).
// Los goles de la tanda de penales NO entran en goles recibidos: solo las atajadas se suman aparte.
export function calcularArquero(stats, jugador, penales) {
  const arq = (stats || []).filter(s => s.fue_arquero)
  const pj = arq.length
  let recibidos = 0, arcosEnCero = 0, golesComoArquero = 0, racha = 0, rachaMax = 0
  const cron = arq.slice().sort((a, b) => new Date(a.matches?.played_at || a.created_at || 0) - new Date(b.matches?.played_at || b.created_at || 0))
  cron.forEach(s => {
    recibidos += s.goals_conceded || 0
    golesComoArquero += s.goals_scored || 0
    if (golesContraEquipo(s) === 0) { arcosEnCero++; racha++; if (racha > rachaMax) rachaMax = racha } else racha = 0
  })
  const total = (stats || []).length
  return {
    es: esPortero(jugador) || (pj > 0 && pj * 2 >= total),
    pj, recibidos, arcosEnCero, golesComoArquero,
    promedio: pj > 0 ? recibidos / pj : 0,
    pctArcoEnCero: pj > 0 ? Math.round((arcosEnCero / pj) * 100) : 0,
    rachaMax, rachaActual: racha,
    penalesEnfrentados: penales ? penales.length : null,
    penalesAtajados: penales ? penales.filter(r => r.resultado === 'atajado').length : null,
  }
}

// ── JUGADOR ─────────────────────────────────────────────────────────────────
export async function cargarJugadorPublico(id) {
  const { data: jug, error } = await supabase.from('players_publico').select(COLS_JUGADOR).eq('id', id).maybeSingle()
  if (error) throw error
  if (!jug) return { jugador: null }

  const [rStats, rLogros, rPen] = await Promise.all([
    supabase.from('player_match_stats')
      .select('match_id, team_id, tournament_id, goals_scored, yellow_cards, blue_cards, red_cards, team_result, fue_arquero, goals_conceded, created_at, matches(id, played_at, home_score, away_score, fase, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)), teams(id, name, logo_url), tournaments(id, name, modalidad, season)')
      .eq('player_id', id),
    supabase.from('tournament_logros').select('id, tipo, match_id, tournament_id, tournaments(name, season)').eq('player_id', id),
    supabase.from('partido_penales').select('match_id, resultado').eq('arquero_id', id),
  ])

  const stats = (rStats.data || []).slice().sort((a, b) =>
    new Date(b.matches?.played_at || b.created_at || 0) - new Date(a.matches?.played_at || a.created_at || 0))
  const logros = rLogros.data || []
  const mvpPartidos = new Set(logros.filter(l => l.tipo === 'mvp').map(l => l.match_id))

  const tot = { pj: stats.length, goles: 0, amarillas: 0, rojas: 0, mvp: logros.filter(l => l.tipo === 'mvp').length, g: 0, e: 0, p: 0, hatTricks: 0 }
  const porTorneoMap = {}
  stats.forEach(s => {
    const g = s.goals_scored || 0
    tot.goles += g
    tot.amarillas += (s.yellow_cards || 0) + (s.blue_cards || 0)
    tot.rojas += s.red_cards || 0
    if (g >= 3) tot.hatTricks++
    const r = s.team_result
    if (r === 'win' || r === 'G') tot.g++; else if (r === 'draw' || r === 'E') tot.e++; else if (r === 'loss' || r === 'P') tot.p++
    const key = s.tournament_id || 'sin'
    const t = (porTorneoMap[key] = porTorneoMap[key] || { torneo: s.tournaments || null, equipo: s.teams || null, pj: 0, goles: 0, amarillas: 0, rojas: 0 })
    t.pj++; t.goles += g; t.amarillas += (s.yellow_cards || 0) + (s.blue_cards || 0); t.rojas += s.red_cards || 0
    if (s.fue_arquero) {
      t.arqPj = (t.arqPj || 0) + 1
      t.arqRecibidos = (t.arqRecibidos || 0) + (s.goals_conceded || 0)
      if (golesContraEquipo(s) === 0) t.arqCero = (t.arqCero || 0) + 1
    }
  })
  // ¿De cuántos partidos de su equipo participó? Jugar = quedar anotado en la
  // planilla; los partidos en que estuvo en la plantilla pero no se anotó no
  // suman a "jugados", pero SÍ cuentan en el total del equipo.
  const equiposPorTorneo = {}
  stats.forEach(s => {
    if (!s.tournament_id || !s.team_id) return
    ;(equiposPorTorneo[s.tournament_id] = equiposPorTorneo[s.tournament_id] || new Set()).add(s.team_id)
  })
  const idsTorneos = Object.keys(equiposPorTorneo)
  let partidosEquipo = null
  if (idsTorneos.length > 0) {
    const { data: ms, error: errMs } = await supabase.from('matches')
      .select('id, tournament_id, home_team_id, away_team_id')
      .in('tournament_id', idsTorneos).eq('status', 'finished').limit(3000)
    if (!errMs && ms) {
      partidosEquipo = { total: 0, porTorneo: {} }
      ms.forEach(m => {
        const eqs = equiposPorTorneo[m.tournament_id]
        if (!eqs || !(eqs.has(m.home_team_id) || eqs.has(m.away_team_id))) return
        partidosEquipo.total++
        partidosEquipo.porTorneo[m.tournament_id] = (partidosEquipo.porTorneo[m.tournament_id] || 0) + 1
      })
    }
  }
  Object.entries(porTorneoMap).forEach(([tid, t]) => {
    const de = partidosEquipo?.porTorneo[tid]
    t.deEquipo = de == null ? null : Math.max(de, t.pj)
  })
  tot.deEquipo = partidosEquipo ? Math.max(partidosEquipo.total, tot.pj) : null
  const porTorneo = Object.values(porTorneoMap).sort((a, b) => b.goles - a.goles || b.pj - a.pj)

  // Equipo actual = el de su partido más reciente
  const equipoActual = stats.find(s => s.teams?.id)?.teams || null

  const partidos = stats.map(s => ({ ...s, es_mvp: mvpPartidos.has(s.match_id), gcEquipo: golesContraEquipo(s) }))
  const campeonatos = logros.filter(l => l.tipo === 'campeon' || l.tipo === 'campeonato')

  // Si la tabla de penales todavía no existe (falta la migración) rPen trae error: se ignora.
  const arquero = calcularArquero(stats, jug, rPen.error ? null : (rPen.data || []))

  return { jugador: jug, totales: tot, porTorneo, partidos, equipoActual, campeonatos, logros, arquero }
}

// ── RANKING DE ARQUEROS DE UN TORNEO ────────────────────────────────────────
// Una fila por arquero: partidos en que atajó, goles recibidos, arcos en cero y
// penales atajados en tandas. Los nombres salen de players_publico (vista segura).
// Devuelve [] si nadie ha atajado todavía.
export async function cargarArquerosTorneo(tournamentId) {
  const [rStats, rPen] = await Promise.all([
    supabase.from('player_match_stats')
      .select('player_id, team_id, goals_conceded, matches(home_score, away_score, home_team_id, away_team_id)')
      .eq('tournament_id', tournamentId).eq('fue_arquero', true).limit(3000),
    supabase.from('partido_penales').select('arquero_id, resultado').eq('tournament_id', tournamentId),
  ])
  if (rStats.error) throw rStats.error

  const por = {}
  ;(rStats.data || []).forEach(s => {
    if (!s.player_id) return
    const x = (por[s.player_id] = por[s.player_id] || { id: s.player_id, pj: 0, recibidos: 0, arcosEnCero: 0, equipos: {}, penAtajados: 0, penEnfrentados: 0 })
    x.pj++
    x.recibidos += s.goals_conceded || 0
    x.equipos[s.team_id] = (x.equipos[s.team_id] || 0) + 1
    const m = s.matches
    if (m && m.home_score != null && m.away_score != null) {
      const gc = (s.team_id === m.home_team_id ? m.away_score : m.home_score) || 0
      if (gc === 0) x.arcosEnCero++
    }
  })
  if (!rPen.error) {
    ;(rPen.data || []).forEach(r => {
      const x = r.arquero_id && por[r.arquero_id]
      if (!x) return
      x.penEnfrentados++
      if (r.resultado === 'atajado') x.penAtajados++
    })
  }
  const lista = Object.values(por)
  if (lista.length === 0) return []

  let hid = lista.map(x => ({ player_id: x.id }))
  try { hid = await hydratePlayersPublico(hid, { columns: 'id, name, photo_url, photo_face_url' }) } catch { /* sin nombres: se muestran como "Arquero" */ }
  const jugador = Object.fromEntries(hid.map(h => [h.player_id, h.players]))

  return lista.map(x => {
    const j = jugador[x.id]
    const teamId = Object.entries(x.equipos).sort((a, b) => b[1] - a[1])[0]?.[0] || null // el equipo donde más atajó
    return {
      id: x.id, name: j?.name || 'Arquero', foto: j?.photo_face_url || j?.photo_url || null, teamId,
      pj: x.pj, recibidos: x.recibidos, arcosEnCero: x.arcosEnCero, promedio: x.pj > 0 ? x.recibidos / x.pj : 0,
      penAtajados: x.penAtajados, penEnfrentados: x.penEnfrentados,
    }
  })
}
