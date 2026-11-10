// Rankings globales de jugadores (partidos, goles, promedio, eficacia, PG/PE/PP).
// Lo usan la ventana del ranking y las "fichas de puesto" que se ven debajo de la tarjeta.
// Los datos se piden UNA vez, se guardan unos minutos en memoria (y una copia en el celular, que se borra al cerrar sesión),
// así que al tocar un número de la tarjeta el ranking abre al instante.
import { supabase } from './supabase'
import { leerCopia, guardarCopia } from './perfilPrevio'

// Partidos mínimos para entrar a los rankings de promedio y eficacia (con 1 partido un 100% no dice nada)
export const MIN_PJ = 3

export const STAT_CONFIG = {
  pj:   { label:'Partidos Jugados',   corto:'Partidos', icon:'🎮', color:'#4c8dff', campo:'pj',       formato:v=>v,                        sufijo:'PJ',    unidad:'partido',  minPj:0 },
  gc:   { label:'Goles',              corto:'Goles',    icon:'⚽', color:'#6fcf3d', campo:'goles',    formato:v=>v,                        sufijo:'goles', unidad:'gol',      minPj:0 },
  prom: { label:'Promedio',           corto:'Promedio', icon:'📊', color:'#a779ff', campo:'promedio', formato:v=>parseFloat(v).toFixed(2), sufijo:'x PJ',  unidad:'',         minPj:MIN_PJ },
  efic: { label:'Eficacia',           corto:'Eficacia', icon:'⚡', color:'#ff8a3d', campo:'eficacia', formato:v=>`${v}%`,                  sufijo:'',      unidad:'punto',    minPj:MIN_PJ },
  pg:   { label:'Partidos Ganados',   corto:'Ganados',  icon:'🏆', color:'#f5a623', campo:'pg',       formato:v=>v,                        sufijo:'PG',    unidad:'victoria', minPj:0 },
  pe:   { label:'Partidos Empatados', corto:'Empates',  icon:'🤝', color:'#9aa0a6', campo:'pe',       formato:v=>v,                        sufijo:'PE',    unidad:'empate',   minPj:0 },
  pp:   { label:'Partidos Perdidos',  corto:'Perdidos', icon:'📉', color:'#e5433d', campo:'pp',       formato:v=>v,                        sufijo:'PP',    unidad:'derrota',  minPj:0 },
}
export const ORDEN_STATS = ['pj', 'gc', 'pg', 'efic', 'prom', 'pe', 'pp']

const POS_FIELDS = ['posicion_futbol5','posicion_futbol7','posicion_futbol11']

// Misma regla que la tarjeta del jugador: si en CUALQUIER modalidad es portero, es portero.
function clasificar(p) {
  const pos = POS_FIELDS.map(f => p?.[f]).filter(Boolean)
  const esPortero = pos.includes('Portero')
  const esDefensa = !esPortero && pos.some(x => String(x).includes('Defens'))
  return { esPortero, esDefensa }
}

// ── Trae TODAS las estadísticas, ya sumadas por jugador ─────────────────────────────────────────
// 1) Si existe la función ranking_jugadores_stats (migracion_ranking_jugadores.sql) la suma la hace la base: rápido y exacto.
// 2) Si no, se lee la tabla completa por páginas (Supabase entrega máximo 1000 filas por consulta;
//    antes se leía una sola página y por eso el ranking salía incompleto y con puestos equivocados).
async function traerAgregado() {
  try {
    const { data, error } = await supabase.rpc('ranking_jugadores_stats')
    if (!error && Array.isArray(data)) {
      return data.map(r => ({
        id: String(r.player_id), nombre: r.nombre, foto: r.foto,
        players: { posicion_futbol5: r.pos5, posicion_futbol7: r.pos7, posicion_futbol11: r.pos11 },
        pj: r.pj || 0, goles: r.goles || 0, recibidos: r.recibidos || 0,
        golesComoArquero: r.goles_arq || 0, pg: r.pg || 0, pe: r.pe || 0, pp: r.pp || 0,
      }))
    }
  } catch { /* se usa el método de respaldo */ }

  const PAGINA = 1000
  const filas = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('player_match_stats')
      .select('player_id, goals_scored, goals_conceded, team_result, fue_arquero')
      .order('match_id', { ascending: true }).order('player_id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    filas.push(...(data || []))
    if (!data || data.length < PAGINA) break
    if (desde > 200000) break // tope de seguridad
  }

  const mapa = {}
  filas.forEach(s => {
    const id = String(s.player_id)
    const j = mapa[id] || (mapa[id] = { id, pj:0, goles:0, recibidos:0, golesComoArquero:0, pg:0, pe:0, pp:0 })
    j.pj++
    j.recibidos += s.goals_conceded || 0
    j.goles += s.goals_scored || 0
    if (s.fue_arquero) j.golesComoArquero += s.goals_scored || 0
    if (s.team_result === 'win')  j.pg++
    if (s.team_result === 'draw') j.pe++
    if (s.team_result === 'loss') j.pp++
  })

  // Datos de los jugadores (nombre, foto, posición) en tandas
  const ids = Object.keys(mapa)
  const info = {}
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('players')
      .select('id,name,photo_face_url,photo_url,posicion_futbol5,posicion_futbol7,posicion_futbol11')
      .in('id', ids.slice(i, i + 150))
    ;(data || []).forEach(p => { info[String(p.id)] = p })
  }
  return ids.map(id => {
    const p = info[id]
    return { ...mapa[id], nombre: p?.name || '?', foto: p?.photo_face_url || p?.photo_url || null, players: p || {} }
  })
}

// ── Caché: memoria 5 min + copia en el celular (para pintar al instante al volver) ──────────────
let _memo = null          // { t, datos }
let _enVuelo = null       // promesa en curso (evita pedir dos veces)
const VIDA_MEMORIA = 5 * 60 * 1000

export function leerAgregadoGuardado(userId) {
  if (_memo) return _memo.datos
  return userId ? leerCopia(userId, 'rankings', 24 * 60 * 60 * 1000) : null
}

export function obtenerAgregado(userId, { forzar = false } = {}) {
  if (!forzar && _memo && Date.now() - _memo.t < VIDA_MEMORIA) return Promise.resolve(_memo.datos)
  if (_enVuelo) return _enVuelo
  _enVuelo = traerAgregado()
    .then(datos => {
      _memo = { t: Date.now(), datos }
      if (userId) { try { guardarCopia(userId, 'rankings', datos) } catch { /* sin copia, no pasa nada */ } }
      return datos
    })
    .finally(() => { _enVuelo = null })
  return _enVuelo
}

// ── Cálculo ──────────────────────────────────────────────────────────────────────────────────────
export function armarLista(agregado) {
  return agregado.map(j => {
    const { esPortero, esDefensa } = clasificar(j.players)
    return {
      ...j, esPortero, esDefensa,
      promedio: j.pj > 0 ? parseFloat((esPortero ? j.recibidos / j.pj : j.goles / j.pj).toFixed(2)) : 0,
      eficacia: j.pj > 0 ? Math.round((j.pg / j.pj) * 100) : 0,
      posLabel: esPortero ? '🧤 Arquero' : esDefensa ? '🛡️ Defensa' : '⚽ Campo',
    }
  })
}

// Ordena y asigna el puesto real (los empatados comparten puesto: 1, 2, 2, 4…).
// Promedio de arquero: MENOS goles recibidos es mejor. El resto: más es mejor (perdidos: menos es mejor).
export function ordenar(lista, config, portero) {
  const asc = config.campo === 'pp' || (config.campo === 'promedio' && portero)
  const orden = [...lista].sort((a, b) => {
    const va = a[config.campo] ?? 0, vb = b[config.campo] ?? 0
    if (va !== vb) return asc ? va - vb : vb - va
    if (b.pj !== a.pj) return b.pj - a.pj            // desempate: quien jugó más
    return String(a.nombre).localeCompare(String(b.nombre))
  })
  let puestoPrevio = 0, valorPrevio = null
  return orden.map((j, i) => {
    const v = j[config.campo] ?? 0
    if (v !== valorPrevio) { puestoPrevio = i + 1; valorPrevio = v }
    return { ...j, puesto: puestoPrevio }
  })
}

// Ranking global de una estadística. El promedio solo se compara contra los de tu mismo tipo (arquero con arquero).
export function rankingGlobal(lista, statKey, soyPortero) {
  const config = STAT_CONFIG[statKey]
  const base = lista.filter(j => j.pj >= (config.minPj || 0))
  const filtrada = config.campo === 'promedio' ? base.filter(j => j.esPortero === soyPortero) : base
  return ordenar(filtrada, config, soyPortero)
}

// Mi puesto en cada estadística: { pj: { puesto, total, valor, top }, gc: {...}, … } (solo las que ya puede tener)
export function misPuestos(agregado, playerId) {
  const id = String(playerId)
  const lista = armarLista(agregado)
  const yo = lista.find(j => j.id === id)
  if (!yo) return null
  const salida = {}
  ORDEN_STATS.forEach(k => {
    const r = rankingGlobal(lista, k, yo.esPortero)
    const mio = r.find(j => j.id === id)
    if (mio) salida[k] = { puesto: mio.puesto, total: r.length, valor: mio[STAT_CONFIG[k].campo] ?? 0, top: Math.max(1, Math.ceil((mio.puesto / r.length) * 100)) }
  })
  return { yo, puestos: salida }
}
