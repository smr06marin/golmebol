import { supabase } from './supabase'

// ── PUESTOS ("top") de jugadores y equipos ──────────────────────────────────
// Cada dato de un perfil muestra en qué puesto está frente a los demás:
//  · plataforma: contra todos los jugadores / equipos de Golmebol
//  · torneo: contra los de ese mismo torneo
//
// Cómo se calcula: se bajan (paginado, solo columnas deportivas) las estadísticas,
// los partidos terminados, los logros y los penales de TODA la plataforma, se suman
// por jugador/equipo y se cuenta cuántos tienen un valor mejor. Nada privado:
// no se pide ni se usa cédula, teléfono ni fecha de nacimiento.
//
// Reglas:
//  · Empates: mismo puesto (1, 2, 2, 4).
//  · "Mejor" depende del dato: más goles es mejor; MENOS tarjetas, derrotas y goles
//    en contra es mejor (el #1 es quien menos tiene).
//  · Promedios y porcentajes solo cuentan desde MIN_PJ_TASA partidos, para que un
//    solo partido no deje a nadie de #1.
//  · Si el valor es 0 en un dato que se "suma" (goles, MVP, tarjetas…), no hay puesto.

export const MIN_PJ_TASA = 3
const PAGINA = 1000
const MAX_PAGINAS = 60
const TTL_MEMORIA = 5 * 60 * 1000

const r2 = x => Math.round(x * 100) / 100
const pos = v => v > 0
const siempre = () => true

// ── Definición de cada dato rankeable ──
// k: clave · v: valor · el: ¿entra a la tabla? · sh: ¿se muestra el chip? · dir: 'bajo' si menos es mejor
export const DEFS_JUGADOR = [
  { k: 'pj',        v: m => m.pj,       el: m => m.pj > 0,  sh: pos },
  { k: 'goles',     v: m => m.goles,    el: m => m.pj > 0,  sh: pos },
  { k: 'gpp',       v: m => r2(m.goles / m.pj), el: m => m.pj >= MIN_PJ_TASA, sh: pos },
  { k: 'amarillas', dir: 'bajo', v: m => m.amarillas, el: m => m.pj > 0, sh: pos },
  { k: 'rojas',     dir: 'bajo', v: m => m.rojas,     el: m => m.pj > 0, sh: pos },
  { k: 'mvp',       v: m => m.mvp,      el: m => m.pj > 0,  sh: pos },
  { k: 'hat',       v: m => m.hat,      el: m => m.pj > 0,  sh: pos },
  { k: 'g',         v: m => m.g,        el: m => m.pj > 0,  sh: pos },
  { k: 'camp',      v: m => m.camp,     el: m => m.pj > 0,  sh: pos },
  // arquero
  { k: 'arqPj',     v: m => m.arqPj,    el: m => m.arqPj > 0, sh: pos },
  { k: 'arqCero',   v: m => m.arqCero,  el: m => m.arqPj > 0, sh: pos },
  { k: 'arqRec',    dir: 'bajo', v: m => m.arqRec, el: m => m.arqPj >= MIN_PJ_TASA, sh: siempre },
  { k: 'arqProm',   dir: 'bajo', v: m => r2(m.arqRec / m.arqPj), el: m => m.arqPj >= MIN_PJ_TASA, sh: siempre },
  { k: 'arqPct',    v: m => Math.round((100 * m.arqCero) / m.arqPj), el: m => m.arqPj >= MIN_PJ_TASA, sh: pos },
  { k: 'racha',     v: m => m.racha,    el: m => m.arqPj > 0, sh: pos },
  { k: 'penAt',     v: m => m.penAt,    el: m => m.penEnf > 0, sh: pos },
  { k: 'golesArq',  v: m => m.golesArq, el: m => m.arqPj > 0, sh: pos },
]

export const DEFS_EQUIPO = [
  { k: 'pj',   v: m => m.pj,           el: m => m.pj > 0, sh: pos },
  { k: 'g',    v: m => m.g,            el: m => m.pj > 0, sh: pos },
  { k: 'p',    dir: 'bajo', v: m => m.p, el: m => m.pj > 0, sh: siempre },
  { k: 'dg',   v: m => m.gf - m.gc,    el: m => m.pj > 0, sh: siempre },
  { k: 'gf',   v: m => m.gf,           el: m => m.pj > 0, sh: pos },
  { k: 'gc',   dir: 'bajo', v: m => m.gc, el: m => m.pj >= MIN_PJ_TASA, sh: siempre },
  { k: 'gfpp', v: m => r2(m.gf / m.pj), el: m => m.pj >= MIN_PJ_TASA, sh: pos },
  { k: 'gcpp', dir: 'bajo', v: m => r2(m.gc / m.pj), el: m => m.pj >= MIN_PJ_TASA, sh: siempre },
  { k: 'pts',  v: m => m.g * 3 + m.e,  el: m => m.pj > 0, sh: siempre },
  { k: 'camp', v: m => m.camp,         el: m => m.pj > 0, sh: pos },
]

const nuevoJ = () => ({ pj: 0, goles: 0, amarillas: 0, rojas: 0, hat: 0, g: 0, mvp: 0, camp: 0, arqPj: 0, arqRec: 0, arqCero: 0, golesArq: 0, penAt: 0, penEnf: 0, racha: 0, _l: [] })
const nuevoE = () => ({ pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, camp: 0 })

// ── Descarga paginada (Supabase devuelve máx. ~1000 filas por consulta) ──
async function traerTodo(armar) {
  const filas = []
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const { data, error } = await armar().range(i * PAGINA, (i + 1) * PAGINA - 1)
    if (error) return { data: filas, error }
    filas.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }
  return { data: filas, error: null }
}

// ── Construcción (pura: se prueba sin base de datos) ──
export function construirUniverso({ stats = [], partidos = [], logros = [], penales = [] }) {
  const mapaP = new Map()
  partidos.forEach(m => {
    if (m && m.status === 'finished' && m.home_team_id && m.away_team_id && m.home_score != null && m.away_score != null) mapaP.set(m.id, m)
  })

  // Jugadores
  const jug = new Map() // id -> { total, torneos: {tid: ambito} }
  const entidadJ = pid => {
    let e = jug.get(pid)
    if (!e) { e = { total: nuevoJ(), torneos: {} }; jug.set(pid, e) }
    return e
  }
  const ambitosJ = (e, tid) => {
    const a = [e.total]
    if (tid) { if (!e.torneos[tid]) e.torneos[tid] = nuevoJ(); a.push(e.torneos[tid]) }
    return a
  }
  stats.forEach(s => {
    if (!s || !s.player_id) return
    const e = entidadJ(s.player_id)
    const m = mapaP.get(s.match_id)
    const gcEquipo = m ? ((s.team_id === m.home_team_id ? m.away_score : m.home_score) || 0) : null
    const goles = s.goals_scored || 0
    const r = s.team_result
    ambitosJ(e, s.tournament_id).forEach(a => {
      a.pj++
      a.goles += goles
      a.amarillas += (s.yellow_cards || 0) + (s.blue_cards || 0)
      a.rojas += s.red_cards || 0
      if (goles >= 3) a.hat++
      if (r === 'win' || r === 'G') a.g++
      if (s.fue_arquero) {
        a.arqPj++
        a.arqRec += s.goals_conceded || 0
        a.golesArq += goles
        if (gcEquipo === 0) a.arqCero++
        a._l.push({ t: new Date(m?.played_at || s.created_at || 0).getTime() || 0, cero: gcEquipo === 0 })
      }
    })
  })
  logros.forEach(l => {
    if (!l || !l.player_id || !jug.has(l.player_id)) return
    const e = jug.get(l.player_id)
    const tipo = l.tipo
    ambitosJ(e, l.tournament_id && e.torneos[l.tournament_id] ? l.tournament_id : null).forEach(a => {
      if (tipo === 'mvp') a.mvp++
      else if (tipo === 'campeon' || tipo === 'campeonato') a.camp++
    })
  })
  penales.forEach(p => {
    if (!p || !p.arquero_id || !jug.has(p.arquero_id)) return
    const e = jug.get(p.arquero_id)
    ambitosJ(e, p.tournament_id && e.torneos[p.tournament_id] ? p.tournament_id : null).forEach(a => {
      a.penEnf++
      if (p.resultado === 'atajado') a.penAt++
    })
  })
  // Mejor racha de arcos en cero seguidos (por orden de fecha)
  const rematar = a => {
    a._l.sort((x, y) => x.t - y.t)
    let cur = 0, max = 0
    a._l.forEach(x => { if (x.cero) { cur++; if (cur > max) max = cur } else cur = 0 })
    a.racha = max
    delete a._l
  }
  jug.forEach(e => { rematar(e.total); Object.values(e.torneos).forEach(rematar) })

  // Equipos
  const eqs = new Map()
  const entidadE = id => { let e = eqs.get(id); if (!e) { e = { total: nuevoE(), torneos: {} }; eqs.set(id, e) } return e }
  mapaP.forEach(m => {
    ;[[m.home_team_id, m.home_score, m.away_score], [m.away_team_id, m.away_score, m.home_score]].forEach(([tid, gf, gc]) => {
      const e = entidadE(tid)
      const amb = [e.total]
      if (m.tournament_id) { if (!e.torneos[m.tournament_id]) e.torneos[m.tournament_id] = nuevoE(); amb.push(e.torneos[m.tournament_id]) }
      amb.forEach(a => {
        a.pj++; a.gf += gf || 0; a.gc += gc || 0
        if ((gf || 0) > (gc || 0)) a.g++; else if ((gf || 0) === (gc || 0)) a.e++; else a.p++
      })
    })
  })
  logros.forEach(l => {
    if (!l || l.tipo !== 'campeon' || !l.team_id || !eqs.has(l.team_id)) return
    const e = eqs.get(l.team_id)
    e.total.camp++
    if (l.tournament_id && e.torneos[l.tournament_id]) e.torneos[l.tournament_id].camp++
  })

  // Tablas de valores por dato (para contar rápido cuántos son mejores)
  const tabla = (entidades, defs) => {
    const out = {}
    defs.forEach(d => { out[d.k] = [] })
    entidades.forEach(a => { defs.forEach(d => { if (d.el(a)) out[d.k].push(d.v(a)) }) })
    return out
  }
  const armar = (mapa, defs) => {
    const plat = tabla([...mapa.values()].map(e => e.total), defs)
    const porTorneo = {}
    const tids = new Set()
    mapa.forEach(e => Object.keys(e.torneos).forEach(t => tids.add(t)))
    tids.forEach(t => {
      const lista = []
      mapa.forEach(e => { if (e.torneos[t]) lista.push(e.torneos[t]) })
      porTorneo[t] = tabla(lista, defs)
    })
    return { plat, porTorneo }
  }
  return {
    jug, eqs,
    tablasJ: armar(jug, DEFS_JUGADOR),
    tablasE: armar(eqs, DEFS_EQUIPO),
  }
}

function puestoEn(tablaValores, def, ambito) {
  if (!def.el(ambito)) return null
  const mio = def.v(ambito)
  if (!def.sh(mio)) return null
  const vals = tablaValores[def.k] || []
  let mejores = 0
  for (let i = 0; i < vals.length; i++) {
    if (def.dir === 'bajo' ? vals[i] < mio : vals[i] > mio) mejores++
  }
  return { n: mejores + 1, de: vals.length }
}

function puestosDe(mapa, tablas, defs, id) {
  const e = mapa.get(id)
  if (!e) return null
  const sacar = (tab, amb) => {
    const o = {}
    defs.forEach(d => { const p = puestoEn(tab, d, amb); if (p) o[d.k] = p })
    return o
  }
  const torneos = {}
  Object.entries(e.torneos).forEach(([tid, amb]) => { torneos[tid] = sacar(tablas.porTorneo[tid] || {}, amb) })
  return { plataforma: sacar(tablas.plat, e.total), torneos }
}

export const puestosJugador = (u, id) => puestosDe(u.jug, u.tablasJ, DEFS_JUGADOR, id)
export const puestosEquipo  = (u, id) => puestosDe(u.eqs, u.tablasE, DEFS_EQUIPO, id)

// ── Carga desde Supabase (una vez cada 5 min por sesión) ──
let memo = null, memoT = 0
export function cargarUniverso() {
  if (memo && Date.now() - memoT < TTL_MEMORIA) return memo
  memoT = Date.now()
  memo = (async () => {
    const [rStats, rPartidos, rLogros, rPen] = await Promise.all([
      traerTodo(() => supabase.from('player_match_stats')
        .select('player_id, team_id, tournament_id, match_id, goals_scored, yellow_cards, blue_cards, red_cards, team_result, fue_arquero, goals_conceded, created_at')
        .order('match_id').order('player_id')),
      traerTodo(() => supabase.from('matches')
        .select('id, tournament_id, status, played_at, home_team_id, away_team_id, home_score, away_score')
        .eq('status', 'finished').order('id')),
      traerTodo(() => supabase.from('tournament_logros').select('tipo, player_id, team_id, tournament_id').order('id')),
      traerTodo(() => supabase.from('partido_penales').select('arquero_id, tournament_id, resultado').order('id')),
    ])
    if (rStats.error) throw rStats.error
    if (rPartidos.error) throw rPartidos.error
    return construirUniverso({
      stats: rStats.data, partidos: rPartidos.data,
      logros: rLogros.error ? [] : rLogros.data,      // sin logros: solo no habrá puesto de MVP/títulos
      penales: rPen.error ? [] : rPen.data,           // sin la tabla de penales (migración pendiente): se ignora
    })
  })().catch(e => { memo = null; throw e })
  return memo
}
