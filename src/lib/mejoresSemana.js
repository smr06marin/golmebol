import { supabase } from './supabase'

// ── Lo mejor de la semana (Top 5) ────────────────────────────────────────────────────────────────
// Se arma con TODOS los partidos terminados de la semana (lunes a domingo, hora de Colombia) de todos los torneos
// juntos, menos los de niños (categorías Sub-…, infantiles o de escuela, que tienen su propio portal).
//
// Cómo se ordena por dentro (en la pantalla NO se muestran puntos, solo los 5 mejores y por qué):
//  · JUGADOR:  gol 3 · victoria 2 · empate 1 · MVP 4 · amarilla o azul −1 · roja −3
//  · ARQUERO:  arco en cero 5 · victoria 2 · empate 1 · MVP 4 · gol 3 · y por recibir pocos goles: 0 goles +3, 1 gol +2, 2 goles +1
//  · EQUIPO:   victoria 3 · empate 1 · más la diferencia de gol de la semana
//  · PARTIDO:  goles del partido + 4 si se definió por 1 gol o menos + 1 si fue empate + 2 si era de eliminación
//              + 4 si hubo REMONTADA (solo cuando la planilla tiene los minutos de los goles, ver abajo)
// No pide nada nuevo a la base: usa matches, player_match_stats, match_events (goles con su minuto),
// tournament_logros (MVP) y players_publico (foto).
//
// LOS MINUTOS DE LOS GOLES: solo se usan si el partido se planilló con el cronómetro. Se considera confiable cuando
// cada gol del marcador tiene su evento, todos tienen minuto ("MM:SS" + tiempo 1 o 2), cada equipo tiene tantos
// goles como dice el marcador y NO hay dos goles en el mismo minuto exacto (si los ponen todos en el mismo minuto
// o en 00:00 es porque no se planilló con el tiempo, y ahí no se dice nada de remontadas ni de goles decisivos).
// Con minutos confiables se detecta: remontada (el que ganó iba perdiendo), el gol de la victoria (quién lo hizo y
// en qué minuto), si un jugador hizo los últimos goles con los que ganaron y el empate sobre el final.

const DIA = 24 * 60 * 60 * 1000
const COT = 5 * 60 * 60 * 1000   // Colombia = UTC−5 (sin horario de verano)
const PAG = 1000

// Lunes 00:00 (hora Colombia) de la semana de `ms`, como instante UTC
function lunesDe(ms) {
  const l = new Date(ms - COT)
  const desdeLunes = (l.getUTCDay() + 6) % 7
  return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - desdeLunes) + COT
}

// Cada semana va de lunes 12:00 a. m. a domingo 11:59 p. m. (hora Colombia) y SE PUBLICA el lunes siguiente a la
// 1:00 p. m. (así alcanzan a cargar las planillas del fin de semana). Antes de esa hora se sigue viendo la anterior.
// atras = 1 → la última semana publicada; 2 → la anterior…
const HORA_PUBLICACION = 13   // lunes a la 1:00 p. m.
export function semanaAtras(atras = 1) {
  const base = lunesDe(Date.now() - HORA_PUBLICACION * 60 * 60 * 1000)
  const inicio = base - atras * 7 * DIA
  return { inicio, fin: inicio + 7 * DIA, publicada: inicio + 7 * DIA + HORA_PUBLICACION * 60 * 60 * 1000 }
}
// Cuándo sale la próxima
export function proximaPublicacion() {
  return semanaAtras(0).publicada
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
// "lunes 16 de nov" (hora Colombia)
export function diaCorto(ms) {
  const d = new Date(ms - COT)
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}
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

const primerNombre = nombre => { const p = String(nombre || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1]}` : (p[0] || '') }

// "12:30" → 750 segundos (null si no tiene un minuto válido)
const aSegundos = t => { const x = /^\s*(\d{1,3}):(\d{2})\s*$/.exec(String(t || '')); return x ? Number(x[1]) * 60 + Number(x[2]) : null }
const textoMinuto = (seg, per) => `al minuto ${Math.floor(seg / 60)} del ${per === 2 ? 'segundo' : 'primer'} tiempo`

// Reconstruye cómo se dio el partido gol por gol. Devuelve null si la planilla no tiene minutos confiables.
export function comoSeDio(m, goles) {
  const total = (m.home_score || 0) + (m.away_score || 0)
  if (!total || goles.length !== total) return null
  const ev = goles.map(g => ({ ...g, seg: aSegundos(g.minute), per: Number(g.periodo) || 1 }))
  if (ev.some(g => g.seg == null)) return null
  if (ev.filter(g => g.team_id === m.home_team_id).length !== m.home_score) return null
  if (ev.filter(g => g.team_id === m.away_team_id).length !== m.away_score) return null
  // Dos goles en el mismo minuto exacto (o todos en 00:00) = no se planilló con el tiempo
  if (new Set(ev.map(g => `${g.per}|${g.seg}`)).size !== ev.length) return null
  if (ev.length > 1 && ev.every(g => g.seg === 0)) return null
  ev.sort((a, b) => a.per - b.per || a.seg - b.seg)

  const dur = Number(m.tournaments?.duracion_tiempo_min) || null
  const esTardio = g => g.per === 2 && dur && g.seg >= (dur - 3) * 60
  let h = 0, a = 0, peor = 0, peorMarcador = null
  const ganador = m.home_score > m.away_score ? m.home_team_id : m.away_score > m.home_score ? m.away_team_id : null
  const signo = ganador === m.home_team_id ? 1 : -1
  const marcadores = []
  ev.forEach(g => {
    if (g.team_id === m.home_team_id) h++; else a++
    marcadores.push([h, a])
    const dif = (h - a) * signo   // desde el lado del que ganó
    if (ganador && dif < peor) { peor = dif; peorMarcador = signo === 1 ? `${h}-${a}` : `${a}-${h}` }
  })
  const r = { ganador }
  // Remontada: el que ganó estuvo perdiendo
  if (ganador && peor <= -1) r.remontada = { iba: peorMarcador, final: signo === 1 ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`, desventaja: -peor }
  if (ganador) {
    // Gol de la victoria: el gol del ganador que lo puso arriba para siempre
    const perdedorGoles = Math.min(m.home_score, m.away_score)
    const delGanador = ev.filter(g => g.team_id === ganador)
    const decisivo = delGanador[perdedorGoles]
    if (decisivo) r.golVictoria = { playerId: decisivo.player_id || null, texto: textoMinuto(decisivo.seg, decisivo.per), tardio: !!esTardio(decisivo) }
    // Los últimos goles del partido fueron todos del mismo jugador del ganador y con ellos ganaron (antes no iban ganando)
    let k = 0
    for (let i = ev.length - 1; i >= 0; i--) { if (ev[i].team_id === ganador && ev[i].player_id && ev[i].player_id === ev[ev.length - 1].player_id) k++; else break }
    if (k >= 2) {
      const antes = marcadores[ev.length - k - 1] || [0, 0]
      if ((antes[0] - antes[1]) * signo <= 0) r.ultimosGoles = { playerId: ev[ev.length - 1].player_id, n: k }
    }
  } else {
    // Empate: ¿el último gol fue el del empate en el segundo tiempo?
    const ult = ev[ev.length - 1]
    if (ult && ult.per === 2) r.golEmpate = { playerId: ult.player_id || null, teamId: ult.team_id, texto: textoMinuto(ult.seg, ult.per), tardio: !!esTardio(ult) }
  }
  return r
}

const memoria = new Map()   // semana → resultado (para no volver a pedir al cambiar de pestaña)

export async function cargarMejoresSemana(semana) {
  const clave = `${semana.inicio}`
  const guardado = memoria.get(clave)
  const enCurso = semana.fin > Date.now()
  if (guardado && (!enCurso || Date.now() - guardado.t < 5 * 60 * 1000)) return guardado.r

  const partidosTodos = await todas(() => supabase.from('matches')
    .select('id, played_at, home_score, away_score, home_team_id, away_team_id, fase, tournament_id, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), tournaments(id,name,categoria,logo_url,duracion_tiempo_min)')
    .eq('status', 'finished')
    .gte('played_at', new Date(semana.inicio).toISOString())
    .lt('played_at', new Date(semana.fin).toISOString())
    .order('id', { ascending: true }))
  const partidos = partidosTodos.filter(m => m.home_score != null && m.away_score != null && !esDeNinos(m.tournaments))
  const ids = partidos.map(m => m.id)
  if (ids.length === 0) {
    const vacio = { partidosJugados: 0, jugadores: [], arqueros: [], equipos: [], partidos: [] }
    memoria.set(clave, { t: Date.now(), r: vacio })
    return vacio
  }

  const [stats, mvps, golesEv] = await Promise.all([
    porTandas(ids, lote => supabase.from('player_match_stats')
      .select('id, player_id, team_id, match_id, goals_scored, goals_conceded, team_result, yellow_cards, blue_cards, red_cards, fue_arquero')
      .in('match_id', lote).order('id', { ascending: true })),
    porTandas(ids, lote => supabase.from('tournament_logros').select('id, player_id, match_id').eq('tipo', 'mvp').in('match_id', lote).order('id', { ascending: true })),
    // Si no se pueden leer los eventos, simplemente no se habla de minutos
    porTandas(ids, lote => supabase.from('match_events').select('id, match_id, team_id, player_id, minute, periodo').eq('event_type', 'goal').in('match_id', lote).order('id', { ascending: true })).catch(() => []),
  ])
  const golesPorPartido = new Map()
  golesEv.forEach(g => { if (!golesPorPartido.has(g.match_id)) golesPorPartido.set(g.match_id, []); golesPorPartido.get(g.match_id).push(g) })
  const esMvp = new Set(mvps.map(l => `${l.match_id}|${l.player_id}`))
  const partidoPorId = new Map(partidos.map(m => [m.id, m]))
  const equipoPorId = new Map()
  partidos.forEach(m => { if (m.home) equipoPorId.set(m.home_team_id, m.home); if (m.away) equipoPorId.set(m.away_team_id, m.away) })
  const res = r => (r === 'win' ? 2 : r === 'draw' ? 1 : 0)
  // Cómo se dio cada partido (solo si tiene minutos confiables)
  const historia = new Map(partidos.map(m => [m.id, comoSeDio(m, golesPorPartido.get(m.id) || [])]))

  // ── Jugadores y arqueros ──
  const jug = new Map(), arq = new Map()
  stats.forEach(s => {
    const m = partidoPorId.get(s.match_id)
    if (!m || !s.player_id) return
    const mvp = esMvp.has(`${s.match_id}|${s.player_id}`)
    const arquero = s.fue_arquero === true
    const mapa = arquero ? arq : jug
    const j = mapa.get(s.player_id) || { id: s.player_id, equipoId: s.team_id, torneo: m.tournaments?.name, pts: 0, pj: 0, goles: 0, mvp: 0, pg: 0, pe: 0, recibidos: 0, ceros: 0, tarjetas: 0, detalle: [] }
    // Detalle de cada partido (para contar en la frase lo que pasó: hat-trick, arquero goleador, MVP…)
    const esLocal = s.team_id === m.home_team_id
    j.detalle.push({
      rival: (esLocal ? m.away : m.home)?.name || 'el rival', fase: m.fase,
      goles: s.goals_scored || 0, recibidos: s.goals_conceded || 0, mvp, resultado: s.team_result,
      marcador: esLocal ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`,
    })
    j.tarjetas += (s.yellow_cards || 0) + (s.blue_cards || 0) + (s.red_cards || 0)
    const goles = s.goals_scored || 0, recib = s.goals_conceded || 0
    j.pj++; j.goles += goles; j.mvp += mvp ? 1 : 0; j.recibidos += recib
    if (s.team_result === 'win') j.pg++
    if (s.team_result === 'draw') j.pe++
    if (arquero) {
      if (recib === 0) j.ceros++
      j.pts += (recib === 0 ? 5 : 0) + res(s.team_result) + (mvp ? 4 : 0) + Math.max(0, 3 - recib) + goles * 3
    } else {
      j.pts += goles * 3 + res(s.team_result) + (mvp ? 4 : 0) - (s.yellow_cards || 0) - (s.blue_cards || 0) - (s.red_cards || 0) * 3
    }
    j.equipoId = s.team_id || j.equipoId
    ;(j.equiposIds = j.equiposIds || new Set()).add(s.team_id)
    mapa.set(s.player_id, j)
  })
  // Momentos decisivos (gol de la victoria, últimos goles, goles en una remontada) para la frase del "por qué"
  partidos.forEach(m => {
    const h = historia.get(m.id)
    if (!h) return
    const rival = tid => equipoPorId.get(tid === m.home_team_id ? m.away_team_id : m.home_team_id)?.name || 'el rival'
    const agregar = (pid, momento) => { const j = jug.get(pid) || arq.get(pid); if (j) (j.momentos = j.momentos || []).push(momento) }
    if (h.ultimosGoles) agregar(h.ultimosGoles.playerId, { tipo: 'ultimos', n: h.ultimosGoles.n, rival: rival(h.ganador), remontada: !!h.remontada })
    else if (h.golVictoria?.playerId) agregar(h.golVictoria.playerId, { tipo: 'victoria', rival: rival(h.ganador), minuto: h.golVictoria.texto, tardio: h.golVictoria.tardio, remontada: !!h.remontada })
    if (h.golEmpate?.playerId) agregar(h.golEmpate.playerId, { tipo: 'empate', rival: rival(h.golEmpate.teamId), minuto: h.golEmpate.texto })
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
      // Su mejor resultado de la semana (la victoria más amplia)
      if (gf > gc && (!e.mejor || gf - gc > e.mejor.dif)) e.mejor = { dif: gf - gc, marcador: `${gf}-${gc}`, rival: equipoPorId.get(tid === m.home_team_id ? m.away_team_id : m.home_team_id)?.name || 'el rival' }
      eq.set(tid, e)
    })
  })
  eq.forEach(e => { e.pts += e.gf - e.gc })
  partidos.forEach(m => {
    const h = historia.get(m.id)
    if (!h?.remontada) return
    const e = eq.get(h.ganador)
    if (e) (e.momentos = e.momentos || []).push({ tipo: 'remontada', rival: equipoPorId.get(h.ganador === m.home_team_id ? m.away_team_id : m.home_team_id)?.name || 'el rival', iba: h.remontada.iba, final: h.remontada.final })
  })
  const equiposTodos = [...eq.values()].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf)

  // ── Partidos ──
  const eliminacion = f => ['octavos', 'cuartos', 'semifinal', 'final'].includes(f)
  const partidosTop = partidos.map(m => {
    const total = m.home_score + m.away_score, dif = Math.abs(m.home_score - m.away_score)
    const h = historia.get(m.id)
    return { ...m, historia: h, pts: total + (dif <= 1 ? 4 : 0) + (dif === 0 ? 1 : 0) + (eliminacion(m.fase) ? 2 : 0) + (h?.remontada ? 4 : 0) }
  }).sort((a, b) => b.pts - a.pts || (b.home_score + b.away_score) - (a.home_score + a.away_score)).slice(0, 5)

  // Fotos y nombres solo de los que salen en el Top 5
  const top = [...jugadoresTodos.slice(0, 5), ...arquerosTodos.slice(0, 5)]
  // La figura de cada partido del Top: el que hizo 3 o más goles, un arquero que hizo gol o un arquero MVP
  partidosTop.forEach(m => {
    const filas = stats.filter(x => x.match_id === m.id && x.player_id)
    const masGoles = filas.filter(x => !x.fue_arquero).sort((a, b) => (b.goals_scored || 0) - (a.goals_scored || 0))[0]
    const arqGol = filas.find(x => x.fue_arquero && (x.goals_scored || 0) > 0)
    const arqMvp = filas.find(x => x.fue_arquero && esMvp.has(`${m.id}|${x.player_id}`))
    m.figuras = []
    if (masGoles && (masGoles.goals_scored || 0) >= 3) m.figuras.push({ tipo: 'goles', playerId: masGoles.player_id, n: masGoles.goals_scored })
    if (arqGol) m.figuras.push({ tipo: 'arqueroGol', playerId: arqGol.player_id, n: arqGol.goals_scored })
    if (arqMvp) m.figuras.push({ tipo: 'arqueroMvp', playerId: arqMvp.player_id })
  })
  const goleadoresClave = partidosTop.flatMap(m => [m.historia?.golVictoria?.playerId, m.historia?.ultimosGoles?.playerId, m.historia?.golEmpate?.playerId, ...m.figuras.map(f => f.playerId)]).filter(Boolean)
  const { data: fotos } = await supabase.from('players_publico').select('id, name, photo_url, photo_face_url').in('id', [...new Set([...top.map(j => j.id), ...goleadoresClave])])
  const info = new Map((fotos || []).map(p => [p.id, p]))
  const vestir = j => ({ ...j, nombre: info.get(j.id)?.name || 'Jugador', foto: info.get(j.id)?.photo_face_url || info.get(j.id)?.photo_url || null, equipo: equipoPorId.get(j.equipoId) || null,
    equipos: [...(j.equiposIds || [])].map(id => equipoPorId.get(id)?.name).filter(Boolean) })

  const resultado = {
    partidosJugados: partidos.length,
    jugadores: jugadoresTodos.slice(0, 5).map(vestir),
    arqueros: arquerosTodos.slice(0, 5).map(vestir),
    equipos: equiposTodos.slice(0, 5),
    partidos: partidosTop.map(m => ({ ...m, nombreDe: Object.fromEntries(goleadoresClave.map(pid => [pid, primerNombre(info.get(pid)?.name)])) })),
    // Puesto de cada uno aunque no esté en el Top 5 (para decirle al jugador dónde quedó)
    puestoJugador: new Map(jugadoresTodos.map((j, i) => [String(j.id), i + 1])),
    puestoArquero: new Map(arquerosTodos.map((j, i) => [String(j.id), i + 1])),
    puestoEquipo: new Map(equiposTodos.map((e, i) => [String(e.id), i + 1])),
    totalJugadores: jugadoresTodos.length, totalArqueros: arquerosTodos.length, totalEquipos: equiposTodos.length,
  }
  memoria.set(clave, { t: Date.now(), r: resultado })
  return resultado
}

// ── Por qué salió en el Top 5 (frase corta, fácil de entender) ──────────────────────────────────
const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`
const unirFrase = partes => partes.length <= 1 ? (partes[0] || '') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
const FASE = { octavos: 'los octavos', cuartos: 'los cuartos de final', semifinal: 'la semifinal', final: 'la final' }
const NOMBRE_GOLES = { 3: '¡Hat-trick!', 4: '¡Póker de goles!', 5: '¡Manita!' }

export function porQue(tipo, item, lista, i) {
  // Lo más decisivo que hizo (si la planilla tenía minutos)
  const momento = () => {
    const peso = x => x.tipo === 'ultimos' ? 5 : x.tipo === 'remontada' ? 4 : x.tipo === 'victoria' ? (x.remontada ? 4 : x.tardio ? 3 : 2) : 1
    const mo = [...(item.momentos || [])].sort((x, y) => peso(y) - peso(x))[0]
    if (!mo) return ''
    if (mo.tipo === 'ultimos') return ` ${mo.remontada ? '¡Clave en la remontada! ' : ''}Hizo los ${mo.n === 2 ? 'dos' : mo.n} últimos goles con los que ganaron contra ${mo.rival}.`
    if (mo.tipo === 'victoria') return ` Hizo el gol de la victoria contra ${mo.rival} ${mo.minuto}${mo.tardio ? ', sobre el final' : ''}${mo.remontada ? ' y completó la remontada' : ''}.`
    if (mo.tipo === 'empate') return ` Empató el partido contra ${mo.rival} ${mo.minuto}.`
    if (mo.tipo === 'remontada') return ` Remontó contra ${mo.rival}: iba perdiendo ${mo.iba} y ganó ${mo.final}.`
    return ''
  }
  const det = item.detalle || []
  const vez = x => (x === 1 ? 'una vez' : `${x} veces`)
  const mayus = t => t.charAt(0).toUpperCase() + t.slice(1)
  const faseDe = d => (FASE[d.fase] ? ` en ${FASE[d.fase]}` : '')
  if (tipo === 'jugadores') {
    const frases = []
    // 1. Lo más llamativo de un solo partido: muchos goles
    const mejor = [...det].sort((a, b) => b.goles - a.goles)[0]
    if (mejor && mejor.goles >= 3) frases.push(`${NOMBRE_GOLES[Math.min(mejor.goles, 5)] || `¡${mejor.goles} goles en un partido!`} Le hizo ${n(mejor.goles, 'gol', 'goles')} a ${mejor.rival}${faseDe(mejor)}${mejor.resultado === 'win' ? ` y ganaron ${mejor.marcador}` : mejor.resultado === 'draw' ? ` y empataron ${mejor.marcador}` : ''}.`)
    // 2. El momento decisivo (con los minutos de la planilla)
    const mo = momento()
    if (mo) frases.push(mo.trim())
    // 3. MVP
    const mvps = det.filter(d => d.mvp)
    if (mvps.length === 1 && frases.length < 2) frases.push(`Fue elegido el MVP contra ${mvps[0].rival}.`)
    else if (mvps.length > 1) frases.push(`Fue el MVP ${vez(mvps.length)} esta semana.`)
    // 4. Resumen de la semana
    const resumen = []
    if (item.goles > 0 && !(mejor && mejor.goles >= 3 && item.pj === 1)) resumen.push(`${n(item.goles, 'gol', 'goles')} en ${n(item.pj, 'partido', 'partidos')}`)
    resumen.push(item.pg === item.pj ? (item.pj === 1 ? 'ganó su partido' : `ganó sus ${item.pj} partidos`) : `ganó ${item.pg} de ${item.pj}`)
    if (item.tarjetas === 0 && item.pj > 1) resumen.push('sin tarjetas')
    frases.push(mayus(`${frases.length ? 'en la semana: ' : ''}${unirFrase(resumen)}.`))
    return frases.slice(0, 3).join(' ')
  }
  if (tipo === 'arqueros') {
    const frases = []
    // 1. Arquero goleador (¡no pasa todos los días!)
    const conGol = det.filter(d => d.goles > 0)
    if (conGol.length) frases.push(`¡Arquero goleador! Le hizo ${n(conGol.reduce((x, d) => x + d.goles, 0), 'gol', 'goles')} a ${conGol.map(d => d.rival).join(' y ')}.`)
    // 2. MVP siendo arquero: para que escojan al arquero como el mejor del partido tuvo que atajar mucho
    const mvps = det.filter(d => d.mvp)
    if (mvps.length) frases.push(`Fue elegido el MVP contra ${mvps.map(d => d.rival).join(' y ')}${mvps.length === 1 ? faseDe(mvps[0]) : ''}: que escojan a un arquero como el mejor de la cancha dice que tuvo una gran actuación.`)
    // 3. Arcos en cero
    const ceros = det.filter(d => d.recibidos === 0)
    if (ceros.length === item.pj && item.pj > 1) frases.push(`No le hicieron ni un gol en sus ${item.pj} partidos.`)
    else if (ceros.length) frases.push(`Dejó el arco en cero contra ${ceros.map(d => d.rival).join(' y ')}${ceros.length === 1 ? faseDe(ceros[0]) : ''}.`)
    else frases.push(`Recibió solo ${n(item.recibidos, 'gol', 'goles')} en ${n(item.pj, 'partido', 'partidos')}.`)
    // 4. Victorias
    if (frases.length < 3 && item.pg > 0) frases.push(item.pg === item.pj ? (item.pj === 1 ? 'Y su equipo ganó.' : `Y ganaron sus ${item.pj} partidos.`) : `Y ganaron ${item.pg} de ${item.pj}.`)
    return frases.slice(0, 3).join(' ')
  }
  if (tipo === 'equipos') {
    const dif = item.gf - item.gc
    const gano = item.pg === item.pj ? `Ganó ${item.pj === 1 ? 'su partido' : `sus ${item.pj} partidos`}` : `Ganó ${item.pg} de ${n(item.pj, 'partido', 'partidos')}`
    let f = `${gano} con ${n(item.gf, 'gol', 'goles')} a favor y ${item.gc} en contra (${dif >= 0 ? '+' : ''}${dif}).`
    const mo = momento()
    if (mo) f += mo
    else if (item.mejor && item.mejor.dif >= 3) f += ` Su mejor resultado: le ganó ${item.mejor.marcador} a ${item.mejor.rival}.`
    if (item.pp === 0 && item.pj > 1) f += ' Invicto en la semana.'
    return f
  }
  // Partido: si la planilla tiene minutos se cuenta cómo se dio; si no, solo el marcador
  const total = item.home_score + item.away_score, dif = Math.abs(item.home_score - item.away_score)
  const h = item.historia
  const nombre = pid => item.nombreDe?.[pid] || ''
  const equipo = tid => (tid === item.home_team_id ? item.home : item.away)?.name || 'el ganador'
  const enFase = FASE[item.fase] ? ` en ${FASE[item.fase]}` : ''
  let f
  if (h?.remontada) {
    f = `¡Remontada${enFase}! ${equipo(h.ganador)} iba perdiendo ${h.remontada.iba} y terminó ganando ${h.remontada.final}.`
    if (h.ultimosGoles && nombre(h.ultimosGoles.playerId)) f += ` ${nombre(h.ultimosGoles.playerId)} hizo los ${h.ultimosGoles.n === 2 ? 'dos' : h.ultimosGoles.n} últimos goles.`
    else if (h.golVictoria?.playerId && nombre(h.golVictoria.playerId)) f += ` El gol de la victoria fue de ${nombre(h.golVictoria.playerId)} ${h.golVictoria.texto}.`
  } else if (h?.golVictoria && dif === 1 && h.golVictoria.tardio) {
    f = `${n(total, 'gol', 'goles')}${enFase} y se definió sobre el final: ${nombre(h.golVictoria.playerId) ? `gol de ${nombre(h.golVictoria.playerId)} ` : ''}${h.golVictoria.texto}.`
  } else if (h?.golEmpate && h.golEmpate.tardio) {
    f = `Empate ${item.home_score}-${item.away_score}${enFase} con un gol sobre el final${nombre(h.golEmpate.playerId) ? ` de ${nombre(h.golEmpate.playerId)}` : ''} ${h.golEmpate.texto}.`
  } else {
    const partes = [`${n(total, 'gol', 'goles')} en total`]
    if (dif === 0) partes.push('terminó empatado')
    else if (dif === 1) partes.push('se definió por un solo gol')
    f = unirFrase(partes) + enFase + '.'
    if (h?.golVictoria?.playerId && nombre(h.golVictoria.playerId) && dif <= 2) f += ` El gol de la victoria fue de ${nombre(h.golVictoria.playerId)} ${h.golVictoria.texto}.`
  }
  // La figura del partido (si la hubo)
  ;(item.figuras || []).forEach(fi => {
    const quien = nombre(fi.playerId)
    if (!quien) return
    if (fi.tipo === 'goles' && !f.includes(quien)) f += ` ${quien} hizo ${n(fi.n, 'gol', 'goles')}${fi.n >= 3 ? ` (${(NOMBRE_GOLES[Math.min(fi.n, 5)] || '').replace(/[¡!]/g, '').toLowerCase() || 'goleada personal'})` : ''}.`
    if (fi.tipo === 'arqueroGol') f += ` ¡Y el arquero ${quien} hizo gol!`
    if (fi.tipo === 'arqueroMvp') f += ` El MVP fue el arquero ${quien}.`
  })
  return (i === 0 ? 'El partido con más emoción de la semana: ' : '') + f.charAt(0).toUpperCase() + f.slice(1)
}
