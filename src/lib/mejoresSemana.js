import { supabase } from './supabase'

// ── Lo mejor de la semana (Top 5) ────────────────────────────────────────────────────────────────
// Se arma con TODOS los partidos terminados de la semana (lunes a domingo, hora de Colombia) de todos los torneos
// juntos, menos los de niños (categorías Sub-…, infantiles o de escuela, que tienen su propio portal).
//
// Cómo se cuentan los puntos (lo mismo que se le explica al jugador en la pantalla):
//  · JUGADOR:  gol 3 · victoria 2 · empate 1 · MVP 4 · amarilla o azul −1 · roja −3
//  · ARQUERO:  arco en cero 5 · victoria 2 · empate 1 · MVP 4 · y por recibir pocos goles: 0 goles +3, 1 gol +2, 2 goles +1
//  · EQUIPO:   victoria 3 · empate 1 · más la diferencia de gol de la semana
//  · PARTIDO:  goles del partido + 4 si se definió por 1 gol o menos + 1 si fue empate + 2 si era de eliminación
// No pide nada nuevo a la base: usa matches, player_match_stats, tournament_logros (MVP) y players_publico (foto).

const DIA = 24 * 60 * 60 * 1000
const COT = 5 * 60 * 60 * 1000   // Colombia = UTC−5 (sin horario de verano)
const PAG = 1000

// Lunes 00:00 (hora Colombia) de la semana de `ms`, como instante UTC
function lunesDe(ms) {
  const l = new Date(ms - COT)
  const desdeLunes = (l.getUTCDay() + 6) % 7
  return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - desdeLunes) + COT
}

// atras = 1 → la semana que ya terminó; 2 → la anterior…
export function semanaAtras(atras = 1) {
  const inicio = lunesDe(Date.now()) - atras * 7 * DIA
  return { inicio, fin: inicio + 7 * DIA }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function nombreSemana({ inicio, fin }) {
  const a = new Date(inicio - COT), b = new Date(fin - COT - DIA)
  const ma = MESES[a.getUTCMonth()], mb = MESES[b.getUTCMonth()]
  return ma === mb ? `${a.getUTCDate()} al ${b.getUTCDate()} de ${mb}` : `${a.getUTCDate()} ${ma} al ${b.getUTCDate()} ${mb}`
}

const esDeNinos = t => /sub[\s-]?\d|infantil|kids|escuela|niñ/i.test(`${t?.categoria || ''} ${t?.name || ''}`)

// Trae todas las páginas (Supabase entrega máximo 1000 filas por pedido)
async function todas(armar) {
  const filas = []
  for (let desde = 0; desde < 50 * PAG; desde += PAG) {
    const { data, error } = await armar().range(desde, desde + PAG - 1)
    if (error) throw error
    filas.push(...(data || []))
    if (!data || data.length < PAG) break
  }
  return filas
}
async function porTandas(ids, armar, tanda = 80) {
  const filas = []
  for (let i = 0; i < ids.length; i += tanda) filas.push(...await todas(() => armar(ids.slice(i, i + tanda))))
  return filas
}

const memoria = new Map()   // semana → resultado (para no volver a pedir al cambiar de pestaña)

export async function cargarMejoresSemana(semana) {
  const clave = `${semana.inicio}`
  if (memoria.has(clave)) return memoria.get(clave)

  const partidosTodos = await todas(() => supabase.from('matches')
    .select('id, played_at, home_score, away_score, home_team_id, away_team_id, fase, tournament_id, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), tournaments(id,name,categoria,logo_url)')
    .eq('status', 'finished')
    .gte('played_at', new Date(semana.inicio).toISOString())
    .lt('played_at', new Date(semana.fin).toISOString())
    .order('id', { ascending: true }))
  const partidos = partidosTodos.filter(m => m.home_score != null && m.away_score != null && !esDeNinos(m.tournaments))
  const ids = partidos.map(m => m.id)
  if (ids.length === 0) {
    const vacio = { partidosJugados: 0, jugadores: [], arqueros: [], equipos: [], partidos: [] }
    memoria.set(clave, vacio)
    return vacio
  }

  const [stats, mvps] = await Promise.all([
    porTandas(ids, lote => supabase.from('player_match_stats')
      .select('id, player_id, team_id, match_id, goals_scored, goals_conceded, team_result, yellow_cards, blue_cards, red_cards, fue_arquero')
      .in('match_id', lote).order('id', { ascending: true })),
    porTandas(ids, lote => supabase.from('tournament_logros').select('id, player_id, match_id').eq('tipo', 'mvp').in('match_id', lote).order('id', { ascending: true })),
  ])
  const esMvp = new Set(mvps.map(l => `${l.match_id}|${l.player_id}`))
  const partidoPorId = new Map(partidos.map(m => [m.id, m]))
  const equipoPorId = new Map()
  partidos.forEach(m => { if (m.home) equipoPorId.set(m.home_team_id, m.home); if (m.away) equipoPorId.set(m.away_team_id, m.away) })
  const res = r => (r === 'win' ? 2 : r === 'draw' ? 1 : 0)

  // ── Jugadores y arqueros ──
  const jug = new Map(), arq = new Map()
  stats.forEach(s => {
    const m = partidoPorId.get(s.match_id)
    if (!m || !s.player_id) return
    const mvp = esMvp.has(`${s.match_id}|${s.player_id}`)
    const arquero = s.fue_arquero === true
    const mapa = arquero ? arq : jug
    const j = mapa.get(s.player_id) || { id: s.player_id, equipoId: s.team_id, torneo: m.tournaments?.name, pts: 0, pj: 0, goles: 0, mvp: 0, pg: 0, pe: 0, recibidos: 0, ceros: 0 }
    const goles = s.goals_scored || 0, recib = s.goals_conceded || 0
    j.pj++; j.goles += goles; j.mvp += mvp ? 1 : 0; j.recibidos += recib
    if (s.team_result === 'win') j.pg++
    if (s.team_result === 'draw') j.pe++
    if (arquero) {
      if (recib === 0) j.ceros++
      j.pts += (recib === 0 ? 5 : 0) + res(s.team_result) + (mvp ? 4 : 0) + Math.max(0, 3 - recib)
    } else {
      j.pts += goles * 3 + res(s.team_result) + (mvp ? 4 : 0) - (s.yellow_cards || 0) - (s.blue_cards || 0) - (s.red_cards || 0) * 3
    }
    j.equipoId = s.team_id || j.equipoId
    mapa.set(s.player_id, j)
  })
  const jugadoresTodos = [...jug.values()].filter(j => j.pts > 0)
    .sort((a, b) => b.pts - a.pts || b.goles - a.goles || b.mvp - a.mvp || a.pj - b.pj)
  const arquerosTodos = [...arq.values()].filter(j => j.pts > 0)
    .sort((a, b) => b.pts - a.pts || b.ceros - a.ceros || a.recibidos - b.recibidos)

  // ── Equipos ──
  const eq = new Map()
  partidos.forEach(m => {
    ;[[m.home_team_id, m.home_score, m.away_score], [m.away_team_id, m.away_score, m.home_score]].forEach(([tid, gf, gc]) => {
      if (!tid) return
      const e = eq.get(tid) || { id: tid, equipo: equipoPorId.get(tid), torneo: m.tournaments?.name, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 }
      e.pj++; e.gf += gf; e.gc += gc
      if (gf > gc) { e.pg++; e.pts += 3 } else if (gf === gc) { e.pe++; e.pts += 1 } else e.pp++
      eq.set(tid, e)
    })
  })
  eq.forEach(e => { e.pts += e.gf - e.gc })
  const equiposTodos = [...eq.values()].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf)

  // ── Partidos ──
  const eliminacion = f => ['octavos', 'cuartos', 'semifinal', 'final'].includes(f)
  const partidosTop = partidos.map(m => {
    const total = m.home_score + m.away_score, dif = Math.abs(m.home_score - m.away_score)
    return { ...m, pts: total + (dif <= 1 ? 4 : 0) + (dif === 0 ? 1 : 0) + (eliminacion(m.fase) ? 2 : 0) }
  }).sort((a, b) => b.pts - a.pts || (b.home_score + b.away_score) - (a.home_score + a.away_score)).slice(0, 5)

  // Fotos y nombres solo de los que salen en el Top 5
  const top = [...jugadoresTodos.slice(0, 5), ...arquerosTodos.slice(0, 5)]
  const { data: fotos } = await supabase.from('players_publico').select('id, name, photo_url, photo_face_url').in('id', top.map(j => j.id))
  const info = new Map((fotos || []).map(p => [p.id, p]))
  const vestir = j => ({ ...j, nombre: info.get(j.id)?.name || 'Jugador', foto: info.get(j.id)?.photo_face_url || info.get(j.id)?.photo_url || null, equipo: equipoPorId.get(j.equipoId) || null })

  const resultado = {
    partidosJugados: partidos.length,
    jugadores: jugadoresTodos.slice(0, 5).map(vestir),
    arqueros: arquerosTodos.slice(0, 5).map(vestir),
    equipos: equiposTodos.slice(0, 5),
    partidos: partidosTop,
    // Puesto de cada uno aunque no esté en el Top 5 (para decirle al jugador dónde quedó)
    puestoJugador: new Map(jugadoresTodos.map((j, i) => [String(j.id), i + 1])),
    puestoArquero: new Map(arquerosTodos.map((j, i) => [String(j.id), i + 1])),
    puestoEquipo: new Map(equiposTodos.map((e, i) => [String(e.id), i + 1])),
    totalJugadores: jugadoresTodos.length, totalArqueros: arquerosTodos.length, totalEquipos: equiposTodos.length,
  }
  memoria.set(clave, resultado)
  return resultado
}

// ── Por qué salió en el Top 5 (frase corta, fácil de entender) ──────────────────────────────────
const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`
const unirFrase = partes => partes.length <= 1 ? (partes[0] || '') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
const FASE = { octavos: 'los octavos', cuartos: 'los cuartos de final', semifinal: 'la semifinal', final: 'la final' }

export function porQue(tipo, item, lista, i) {
  const sig = lista[i + 1], ant = lista[i - 1]
  // Cómo le ganó al siguiente (o qué le faltó para alcanzar al de arriba)
  const comparar = () => {
    if (i === 0 && sig) return sig.pts < item.pts ? ` Le sacó ${n(item.pts - sig.pts, 'punto', 'puntos')} al segundo.` : ' Empató en puntos con el segundo y lo superó en el desempate.'
    if (i > 0 && ant && ant.pts > item.pts) return ` Le ${ant.pts - item.pts === 1 ? 'faltó' : 'faltaron'} ${n(ant.pts - item.pts, 'punto', 'puntos')} para el puesto ${i}.`
    if (i > 0 && ant && ant.pts === item.pts) return ` Empató en puntos con el puesto ${i}, que ganó en el desempate.`
    return ''
  }
  if (tipo === 'jugadores') {
    const partes = []
    if (item.goles > 0) partes.push(`hizo ${n(item.goles, 'gol', 'goles')}`)
    if (item.mvp > 0) partes.push(`fue MVP ${item.mvp === 1 ? 'una vez' : `${item.mvp} veces`}`)
    partes.push(item.pg === item.pj ? `ganó ${item.pj === 1 ? 'su partido' : `sus ${item.pj} partidos`}` : `ganó ${item.pg} de ${n(item.pj, 'partido', 'partidos')}`)
    const f = unirFrase(partes)
    return f.charAt(0).toUpperCase() + f.slice(1) + '.' + comparar()
  }
  if (tipo === 'arqueros') {
    const partes = []
    if (item.ceros > 0) partes.push(item.ceros === item.pj ? `dejó el arco en cero en ${item.pj === 1 ? 'su partido' : `sus ${item.pj} partidos`}` : `dejó el arco en cero en ${item.ceros} de ${n(item.pj, 'partido', 'partidos')}`)
    else partes.push(`recibió solo ${n(item.recibidos, 'gol', 'goles')} en ${n(item.pj, 'partido', 'partidos')}`)
    if (item.pg > 0) partes.push(`ganó ${n(item.pg, 'partido', 'partidos')}`)
    if (item.mvp > 0) partes.push(`fue MVP ${item.mvp === 1 ? 'una vez' : `${item.mvp} veces`}`)
    const f = unirFrase(partes)
    return f.charAt(0).toUpperCase() + f.slice(1) + '.' + comparar()
  }
  if (tipo === 'equipos') {
    const dif = item.gf - item.gc
    const gano = item.pg === item.pj ? `Ganó ${item.pj === 1 ? 'su partido' : `sus ${item.pj} partidos`}` : `Ganó ${item.pg} de ${n(item.pj, 'partido', 'partidos')}`
    return `${gano} con ${n(item.gf, 'gol', 'goles')} a favor y ${item.gc} en contra (${dif >= 0 ? '+' : ''}${dif}).` + comparar()
  }
  // Partido
  const total = item.home_score + item.away_score, dif = Math.abs(item.home_score - item.away_score)
  const partes = [`${n(total, 'gol', 'goles')} en total`]
  if (dif === 0) partes.push('terminó empatado')
  else if (dif === 1) partes.push('se definió por un solo gol')
  let f = unirFrase(partes)
  if (FASE[item.fase]) f += ` en ${FASE[item.fase]}`
  return (i === 0 ? 'El partido con más emoción de la semana: ' : '') + f.charAt(0).toUpperCase() + f.slice(1) + '.'
}
