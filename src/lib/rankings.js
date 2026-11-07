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
  { k: 'tpp',       dir: 'bajo', v: m => r2((m.amarillas + m.rojas) / m.pj), el: m => m.pj >= MIN_PJ_TASA, sh: siempre },
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

// Puntaje de "rendimiento" de un equipo: puntos por partido (3 por victoria, 1 por empate) y, si hay
// empate, diferencia de gol por partido y luego goles a favor por partido. Así los equipos que han jugado
// distinta cantidad de partidos se comparan en igualdad (se ordena por promedio, no por totales).
const rendimiento = m => {
  const ppp = (m.g * 3 + m.e) / m.pj
  const dgpp = (m.gf - m.gc) / m.pj
  const gfpp = m.gf / m.pj
  return Math.round(ppp * 1000) * 1e11 + Math.round((dgpp + 100) * 100) * 1e5 + Math.min(99999, Math.round(gfpp * 100))
}

export const DEFS_EQUIPO = [
  { k: 'ppp',  v: m => r2((m.g * 3 + m.e) / m.pj), r: rendimiento, el: m => m.pj >= MIN_PJ_TASA, sh: siempre },
  { k: 'pctg', v: m => Math.round((100 * m.g) / m.pj), el: m => m.pj >= MIN_PJ_TASA, sh: siempre },
  { k: 'dgpp', v: m => r2((m.gf - m.gc) / m.pj), el: m => m.pj >= MIN_PJ_TASA, sh: siempre },
  { k: 'cs',   v: m => m.cs,           el: m => m.pj > 0, sh: pos },
  { k: 'cspct', v: m => Math.round((100 * m.cs) / m.pj), el: m => m.pj >= MIN_PJ_TASA, sh: pos },
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
const nuevoE = () => ({ pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, cs: 0, camp: 0 })

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
        if (!(gc || 0)) a.cs++
        if ((gf || 0) > (gc || 0)) a.g++; else if ((gf || 0) === (gc || 0)) a.e++; else a.p++
      })
    })
  })
  // Un título cuenta UNA vez por equipo y torneo (la tabla guarda una fila por jugador)
  const titulosVistos = new Set()
  logros.forEach(l => {
    if (!l || l.tipo !== 'campeon' || !l.team_id || !eqs.has(l.team_id)) return
    const kT = `${l.team_id}|${l.tournament_id}`
    if (titulosVistos.has(kT)) return
    titulosVistos.add(kT)
    const e = eqs.get(l.team_id)
    e.total.camp++
    if (l.tournament_id && e.torneos[l.tournament_id]) e.torneos[l.tournament_id].camp++
  })

  // Tablas de valores por dato (para contar rápido cuántos son mejores)
  const tabla = (entidades, defs) => {
    const out = {}
    defs.forEach(d => { out[d.k] = [] })
    entidades.forEach(a => { defs.forEach(d => { if (d.el(a)) out[d.k].push((d.r || d.v)(a)) }) })
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
  const orden = (def.r || def.v)(ambito)   // con desempates si el dato los tiene
  const vals = tablaValores[def.k] || []
  let mejores = 0
  for (let i = 0; i < vals.length; i++) {
    if (def.dir === 'bajo' ? vals[i] < orden : vals[i] > orden) mejores++
  }
  return { n: mejores + 1, de: vals.length }
}

// Cada puesto lleva también de qué dato es (k), contra quién se compara (ambito: 'plataforma'
// o el id del torneo), de quién es (tipo/id): así, al tocarlo, se puede abrir el ranking completo.
function puestosDe(mapa, tablas, defs, id, tipo) {
  const e = mapa.get(id)
  if (!e) return null
  const sacar = (tab, amb, ambito) => {
    const o = {}
    defs.forEach(d => { const p = puestoEn(tab, d, amb); if (p) o[d.k] = { ...p, k: d.k, ambito, tipo, id } })
    return o
  }
  const torneos = {}
  Object.entries(e.torneos).forEach(([tid, amb]) => { torneos[tid] = sacar(tablas.porTorneo[tid] || {}, amb, tid) })
  return { plataforma: sacar(tablas.plat, e.total, 'plataforma'), torneos }
}

export const puestosJugador = (u, id) => puestosDe(u.jug, u.tablasJ, DEFS_JUGADOR, id, 'jugador')
export const puestosEquipo  = (u, id) => puestosDe(u.eqs, u.tablasE, DEFS_EQUIPO, id, 'equipo')

// ── Qué significa cada ranking (lo que se lee al tocar un puesto) ──
// fmt: 'int' | 'dec' (2 decimales) | 'signo' (+/-) | 'pct'
export const INFO_RANKING = {
  equipo: {
    ppp:  { titulo: 'Rendimiento (puntos por partido)', explica: 'El ranking más justo para comparar equipos: promedio de puntos por partido (3 por victoria, 1 por empate). Así no importa si un equipo ha jugado más partidos que otro. Si empatan, decide la diferencia de gol por partido y luego los goles a favor por partido.', fmt: 'dec', min: true },
    pctg: { titulo: '% de victorias', explica: 'De cada 100 partidos, cuántos ha ganado.', fmt: 'pct', min: true },
    dgpp: { titulo: 'Diferencia de gol por partido', explica: 'Goles a favor menos goles en contra, en promedio por partido.', fmt: 'signo2', min: true },
    cs:   { titulo: 'Partidos sin recibir gol', explica: 'Partidos en los que el equipo dejó su arco en cero. Cuenta totales: quien juega más partidos tiene más oportunidades.', fmt: 'int', justo: 'cspct' },
    cspct: { titulo: '% de partidos sin recibir gol', explica: 'De cada 100 partidos, en cuántos dejó el arco en cero.', fmt: 'pct', min: true },
    pj:   { titulo: 'Partidos jugados', explica: 'Equipos ordenados por cuántos partidos han jugado. Mide actividad, no calidad.', fmt: 'int' },
    g:    { titulo: 'Partidos ganados', explica: 'Equipos ordenados por cuántos partidos han ganado.', fmt: 'int', justo: 'pctg' },
    p:    { titulo: 'Partidos perdidos', explica: 'Equipos ordenados de menos a más derrotas: el 1° es el que menos ha perdido.', fmt: 'int', justo: 'ppp' },
    dg:   { titulo: 'Diferencia de gol', explica: 'Goles a favor menos goles en contra. Mientras más alta, mejor.', fmt: 'signo', justo: 'dgpp' },
    gf:   { titulo: 'Goles a favor', explica: 'Equipos ordenados por la cantidad de goles que han marcado.', fmt: 'int', justo: 'gfpp' },
    gc:   { titulo: 'Goles en contra', explica: 'Ordenados de menos a más goles recibidos: el 1° es el que menos goles le han hecho.', fmt: 'int', min: true, justo: 'gcpp' },
    gfpp: { titulo: 'Goles a favor por partido', explica: 'Promedio de goles que marca en cada partido.', fmt: 'dec', min: true },
    gcpp: { titulo: 'Goles en contra por partido', explica: 'Promedio de goles que recibe en cada partido: el 1° es el que menos recibe.', fmt: 'dec', min: true },
    pts:  { titulo: 'Puntos', explica: 'Se suman 3 puntos por victoria y 1 por empate, en todos sus partidos.', fmt: 'int', justo: 'ppp' },
    camp: { titulo: 'Títulos', explica: 'Equipos ordenados por la cantidad de torneos que han ganado como campeón.', fmt: 'int' },
  },
  jugador: {
    pj:        { titulo: 'Partidos jugados', explica: 'Jugadores ordenados por cuántos partidos han jugado. Mide actividad, no calidad.', fmt: 'int' },
    goles:     { titulo: 'Goles', explica: 'Jugadores ordenados por la cantidad de goles marcados. Cuenta totales: quien juega más partidos tiene más oportunidades.', fmt: 'int', justo: 'gpp' },
    tpp:       { titulo: 'Juego limpio (tarjetas por partido)', explica: 'Amarillas y rojas por partido jugado: el 1° es el más disciplinado.', fmt: 'dec', min: true },
    gpp:       { titulo: 'Goles por partido', explica: 'Promedio de goles que marca en cada partido.', fmt: 'dec', min: true },
    amarillas: { titulo: 'Tarjetas amarillas', explica: 'Ordenados de menos a más tarjetas: el 1° es el más disciplinado. Cuenta totales; para comparar justo mira las tarjetas por partido.', fmt: 'int', justo: 'tpp' },
    rojas:     { titulo: 'Tarjetas rojas', explica: 'Ordenados de menos a más rojas: el 1° es el más disciplinado.', fmt: 'int' },
    mvp:       { titulo: 'Jugador del partido (MVP)', explica: 'Veces que fue elegido el mejor jugador de un partido.', fmt: 'int' },
    hat:       { titulo: 'Hat-tricks', explica: 'Partidos en los que marcó 3 goles o más.', fmt: 'int' },
    g:         { titulo: 'Partidos ganados', explica: 'Partidos que ganó con su equipo.', fmt: 'int' },
    camp:      { titulo: 'Títulos', explica: 'Torneos que ganó como campeón.', fmt: 'int' },
    arqPj:     { titulo: 'Partidos como arquero', explica: 'Partidos en los que atajó.', fmt: 'int' },
    arqCero:   { titulo: 'Arcos en cero', explica: 'Partidos en los que atajó sin recibir ningún gol.', fmt: 'int', justo: 'arqPct' },
    arqRec:    { titulo: 'Goles recibidos', explica: 'Ordenados de menos a más goles recibidos como arquero: el 1° es el que menos recibe.', fmt: 'int', min: true, justo: 'arqProm' },
    arqProm:   { titulo: 'Promedio de goles recibidos', explica: 'Goles recibidos por partido como arquero: el 1° es el que menos recibe.', fmt: 'dec', min: true },
    arqPct:    { titulo: '% de arcos en cero', explica: 'De cada 100 partidos como arquero, en cuántos dejó el arco en cero.', fmt: 'pct', min: true },
    racha:     { titulo: 'Mejor racha sin recibir gol', explica: 'Mayor cantidad de partidos seguidos con el arco en cero.', fmt: 'int' },
    penAt:     { titulo: 'Penales atajados', explica: 'Penales que atajó en definiciones por penales.', fmt: 'int' },
    golesArq:  { titulo: 'Goles como arquero', explica: 'Goles que marcó jugando de arquero.', fmt: 'int' },
  },
}

// Texto corto para el "globo" que sale al dejar el mouse sobre un puesto
export function textoPuesto(p) {
  const i = p && INFO_RANKING[p.tipo]?.[p.k]
  if (!i) return `Puesto ${p?.n} del ranking, de ${p?.de}`
  return `${i.titulo}: puesto ${p.n} de ${p.de}. ${i.explica} Toca para ver el ranking completo.`
}

// Orden en que se ofrecen los rankings en la ventana (primero los justos: por partido / porcentajes)
export const ORDEN_RANKING = {
  equipo: [
    ['Rendimiento', ['ppp', 'pctg', 'dgpp']],
    ['Ataque', ['gfpp', 'gf']],
    ['Defensa', ['gcpp', 'cspct', 'gc', 'cs']],
    ['Totales', ['pts', 'g', 'p', 'dg', 'pj', 'camp']],
  ],
  jugador: [
    ['Goles', ['gpp', 'goles', 'hat']],
    ['Equipo', ['mvp', 'g', 'camp', 'pj']],
    ['Juego limpio', ['tpp', 'amarillas', 'rojas']],
    ['Arqueros', ['arqProm', 'arqPct', 'arqCero', 'arqRec', 'racha', 'arqPj', 'penAt', 'golesArq']],
  ],
}

// Torneos en los que ya hay datos de este equipo / jugador (para el filtro por torneo)
export function torneosDe(u, tipo, id) {
  const e = (tipo === 'jugador' ? u.jug : u.eqs).get(id)
  return e ? Object.keys(e.torneos) : []
}

// Lista completa y ordenada de un ranking, la misma cuenta que usan los puestos
// (con desempates si el dato los tiene; si no, empatan y comparten puesto).
export function listaRanking(u, tipo, k, ambito) {
  const defs = tipo === 'jugador' ? DEFS_JUGADOR : DEFS_EQUIPO
  const mapa = tipo === 'jugador' ? u.jug : u.eqs
  const def = defs.find(d => d.k === k)
  if (!def) return { filas: [], total: 0, minimo: 0 }
  const orden = def.r || def.v
  const filas = []
  mapa.forEach((e, id) => {
    const amb = ambito === 'plataforma' ? e.total : e.torneos[ambito]
    if (!amb || !def.el(amb)) return
    filas.push({ id, valor: def.v(amb), o: orden(amb), pj: amb.pj })
  })
  const bajo = def.dir === 'bajo'
  filas.sort((a, b) => (bajo ? a.o - b.o : b.o - a.o))
  let puesto = 0
  filas.forEach((f, i) => {
    if (i === 0 || f.o !== filas[i - 1].o) puesto = i + 1
    f.puesto = puesto
    f.mostrar = def.sh(f.valor)
  })
  return { filas: filas.filter(f => f.mostrar), total: filas.length, minimo: INFO_RANKING[tipo]?.[k]?.min ? MIN_PJ_TASA : 0 }
}

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
