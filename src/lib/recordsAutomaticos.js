import { supabase } from './supabase'
import { hydratePlayersPublico } from './playersPublico'
import { MARCAS_GOLES, marcaDeGoles } from './marcasGoles'
import { guardarCacheRapido, leerCacheRapido } from './cacheRapido'

// Calcula los récords que se generan solos con los datos de la liga
// (máximo goleador, hat-tricks, rachas, etc.). Se usa tanto en la página
// pública de récords como en el panel de admin (para que el admin vea qué
// dato real se mostraría antes de decidir si lo oculta o no).
//
// Los nombres/posiciones salen de players_publico (no del embed a players),
// para que la página pública siga funcionando cuando anon pierda SELECT
// sobre la tabla base.
//
// Rendimiento: las tres tablas se piden A LA VEZ (antes una por una), con solo las columnas que hacen falta,
// completas (cada página de 1000 filas en paralelo: antes se cortaba en 1000 y los récords podían salir mal)
// y los nombres se piden SOLO de quienes ganan un récord (antes se pedían los ~2.500 jugadores en un solo
// pedido, con una dirección enorme que la base podía rechazar). La última copia buena queda guardada para
// pintar al instante al volver a entrar.
const PAG = 1000

async function traerTodas(armar) {
  const primera = await armar(0, PAG - 1)
  if (primera.error) throw primera.error
  const filas = [...(primera.data || [])]
  const total = primera.count ?? filas.length
  if (filas.length < PAG || total <= PAG) return filas
  const paginas = Math.ceil(total / PAG)
  const resto = await Promise.all(Array.from({ length: paginas - 1 }, (_, i) => armar((i + 1) * PAG, (i + 2) * PAG - 1)))
  resto.forEach(r => { if (r.error) throw r.error; filas.push(...(r.data || [])) })
  return filas
}

// Última copia buena de los récords automáticos (null si no hay o ya es muy vieja)
export function recordsAutomaticosGuardados() {
  return leerCacheRapido('records_auto', 24 * 60 * 60 * 1000)
}

export async function calcularRecordsAutomaticos() {
  // Si una tabla no responde, se calcula con lo que sí llegó (esos récords simplemente no salen) en vez de romper todo.
  const seguro = p => p.catch(() => [])
  const [cacheRaw, statsRaw, matches] = await Promise.all([
    seguro(traerTodas((d, h) => supabase.from('player_stats_cache')
      .select('*', { count: 'exact' }) // todas las columnas: así no falla si alguna (p. ej. la racha máxima) todavía no existe
      .order('player_id').range(d, h))),
    seguro(traerTodas((d, h) => supabase.from('player_match_stats')
      .select('player_id, match_id, goals_scored', { count: 'exact' })
      .gt('goals_scored', 0).order('goals_scored', { ascending: false }).order('match_id').order('player_id').range(d, h))),
    seguro(traerTodas((d, h) => supabase.from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, played_at, home:home_team_id(name), away:away_team_id(name)', { count: 'exact' })
      .eq('status', 'finished').order('id').range(d, h))),
  ])

  const porId = new Map((matches || []).map(m => [m.id, m]))

  // Quiénes pueden ganar algo: solo de ellos se piden nombre y posición.
  const maxPor = (lista, clave) => [...lista].sort((a, b) => clave(b) - clave(a))[0]
  const racha = x => x.racha_victorias_max || x.racha_victorias_actual || 0
  const elegidos = new Set()
  const candidatos = []
  const sumar = x => { if (x && !elegidos.has(x)) { elegidos.add(x); candidatos.push(x) } }
  ;[x => x.goles, x => x.victorias, x => x.pj, racha, x => x.racha_goles_actual || 0].forEach(clave => sumar(maxPor(cacheRaw, clave)))
  sumar(maxPor((cacheRaw || []).filter(x => x.partidos_sin_tarjetas > 0), x => x.partidos_sin_tarjetas))
  ;[...cacheRaw].sort((a, b) => (b.arcos_cero || 0) - (a.arcos_cero || 0)).filter(x => x.arcos_cero > 0).slice(0, 60).forEach(sumar)
  // se conserva el orden original: así, ante un empate, gana el mismo que ganaba antes
  const candidatosEnOrden = cacheRaw.filter(x => elegidos.has(x))

  // Marcas de goles (doblete, triplete…): se cuenta por jugador sin nombres, y se piden solo los de quienes lideran
  const porMarca = new Map()
  MARCAS_GOLES.filter(m => m.n >= 2).forEach(m => {
    const porJugador = new Map()
    statsRaw.forEach(s => {
      if (!s.player_id || marcaDeGoles(s.goals_scored)?.n !== m.n) return
      porJugador.set(s.player_id, (porJugador.get(s.player_id) || 0) + 1)
    })
    const top = [...porJugador.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top) porMarca.set(m.n, { id: top[0], veces: top[1] })
  })
  const topGolPar = statsRaw[0]

  const idsNombres = [...new Set([...porMarca.values()].map(x => x.id).concat(topGolPar?.player_id ? [topGolPar.player_id] : []))]
  const cols = 'id, name, posicion_futbol5, posicion_futbol7, posicion_futbol11'
  const [cache, nombres] = await Promise.all([
    hydratePlayersPublico(candidatosEnOrden, { columns: cols }).catch(() => candidatosEnOrden.map(r => ({ ...r, players: null }))),
    hydratePlayersPublico(idsNombres.map(id => ({ player_id: id })), { columns: 'id, name' }).catch(() => []),
  ])
  const nombreDe = Object.fromEntries(nombres.map(r => [r.player_id, r.players?.name]))

  const recs = []
  const GOLD = '#f9a825', CYAN = '#00ddd0'

  // 1. Máximo goleador
  const topGol = [...cache].sort((a, b) => b.goles - a.goles)[0]
  if (topGol?.goles > 0) recs.push({
    id: 'max_goleador',
    titulo: `${topGol.goles} goles históricos`,
    nombre: topGol.players?.name || '?',
    subtitulo: `${topGol.pj} partidos jugados`,
    descripcion: `Promedio ${topGol.pj > 0 ? (topGol.goles / topGol.pj).toFixed(2) : 0} goles/partido`,
    color: GOLD,
  })

  // 2. Más goles en un partido
  const partidoTop = topGolPar ? porId.get(topGolPar.match_id) : null
  if (topGolPar?.goals_scored >= 2) recs.push({
    id: 'goles_partido',
    titulo: `${topGolPar.goals_scored} goles en un partido (${marcaDeGoles(topGolPar.goals_scored)?.nombre || ''})`,
    nombre: nombreDe[topGolPar.player_id] || '?',
    subtitulo: `${partidoTop?.home?.name} vs ${partidoTop?.away?.name}`,
    descripcion: partidoTop?.played_at ? new Date(partidoTop.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    color: '#e8710a',
  })

  // 3. Marcas de goles por tipo (doblete, triplete, póker… gesta histórica): quién tiene más de cada una
  MARCAS_GOLES.filter(m => m.n >= 2).forEach(m => {
    const top = porMarca.get(m.n)
    if (top) recs.push({
      id: `marca_${m.n}`,
      titulo: `${top.veces} ${top.veces === 1 ? m.nombre : m.plural}`,
      nombre: nombreDe[top.id] || '?',
      subtitulo: `más ${m.plural.toLowerCase()} en la historia`,
      descripcion: `${m.n >= 10 ? '10 o más' : m.n} goles en un solo partido`,
      color: GOLD,
    })
  })

  // 4. Más victorias
  const topVic = [...cache].sort((a, b) => b.victorias - a.victorias)[0]
  if (topVic?.victorias > 0) recs.push({
    id: 'victorias',
    titulo: `${topVic.victorias} victorias`,
    nombre: topVic.players?.name || '?',
    subtitulo: `en ${topVic.pj} partidos`,
    descripcion: `${topVic.pj > 0 ? Math.round((topVic.victorias / topVic.pj) * 100) : 0}% de eficacia`,
    color: '#9955ff',
  })

  // 5. Más partidos
  const topPJ = [...cache].sort((a, b) => b.pj - a.pj)[0]
  if (topPJ?.pj > 0) recs.push({
    id: 'mas_partidos',
    titulo: `${topPJ.pj} partidos jugados`,
    nombre: topPJ.players?.name || '?',
    subtitulo: 'más partidos en la historia',
    descripcion: `${topPJ.victorias || 0}V · ${topPJ.empates || 0}E · ${topPJ.derrotas || 0}D`,
    color: CYAN,
  })

  // 6. Racha victorias
  const topRachaV = [...cache].sort((a, b) => (b.racha_victorias_max || b.racha_victorias_actual || 0) - (a.racha_victorias_max || a.racha_victorias_actual || 0))[0]
  const rachaV = topRachaV?.racha_victorias_max || topRachaV?.racha_victorias_actual || 0
  if (rachaV >= 2) recs.push({
    id: 'racha_vic',
    titulo: `${rachaV} victorias seguidas`,
    nombre: topRachaV.players?.name || '?',
    subtitulo: 'mayor racha de victorias consecutivas',
    descripcion: topRachaV?.racha_victorias_actual === rachaV ? '🔥 Racha activa' : 'Récord histórico',
    color: '#00ee55',
  })

  // 7. Racha goles
  const topRachaG = [...cache].sort((a, b) => (b.racha_goles_actual || 0) - (a.racha_goles_actual || 0))[0]
  if (topRachaG?.racha_goles_actual >= 2) recs.push({
    id: 'racha_gol',
    titulo: `goles en ${topRachaG.racha_goles_actual} partidos seguidos`,
    nombre: topRachaG.players?.name || '?',
    subtitulo: '🔥 racha goleadora activa',
    descripcion: 'marcó en partidos consecutivos',
    color: '#e8710a',
  })

  // 8. Arcos en cero
  const porteros = cache.filter(s => {
    const pos = s.players?.posicion_futbol5 || s.players?.posicion_futbol7 || s.players?.posicion_futbol11 || ''
    return pos === 'Portero'
  })
  const topArcos = [...porteros].sort((a, b) => b.arcos_cero - a.arcos_cero)[0]
  if (topArcos?.arcos_cero > 0) recs.push({
    id: 'arcos_cero',
    titulo: `${topArcos.arcos_cero} arcos en cero`,
    nombre: topArcos.players?.name || '?',
    subtitulo: 'mejor arquero · valla menos vencida',
    descripcion: `en ${topArcos.pj} partidos jugados`,
    color: CYAN,
  })

  // 9. Fair play
  const topFair = [...cache].filter(s => s.partidos_sin_tarjetas > 0).sort((a, b) => b.partidos_sin_tarjetas - a.partidos_sin_tarjetas)[0]
  if (topFair) recs.push({
    id: 'fair_play',
    titulo: `${topFair.partidos_sin_tarjetas} partidos sin tarjetas`,
    nombre: topFair.players?.name || '?',
    subtitulo: 'fair play · juego limpio',
    descripcion: `de ${topFair.pj} partidos jugados`,
    color: '#00ee55',
  })

  // 10. Partido más goleador
  const masGolesPar = [...(matches || [])].map(m => ({ ...m, total: (m.home_score || 0) + (m.away_score || 0) })).sort((a, b) => b.total - a.total)[0]
  if (masGolesPar?.total > 0) recs.push({
    id: 'partido_goles',
    titulo: `${masGolesPar.total} goles en un partido`,
    nombre: `${masGolesPar.home?.name} ${masGolesPar.home_score} — ${masGolesPar.away_score} ${masGolesPar.away?.name}`,
    subtitulo: 'partido más goleador de la historia',
    descripcion: masGolesPar.played_at ? new Date(masGolesPar.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
    color: '#d93025',
  })

  // 11. Mayor goleada
  const goleada = [...(matches || [])].map(m => ({ ...m, diff: Math.abs((m.home_score || 0) - (m.away_score || 0)) })).sort((a, b) => b.diff - a.diff)[0]
  if (goleada?.diff >= 2) recs.push({
    id: 'goleada',
    titulo: `goleada de ${goleada.diff} goles`,
    nombre: `${goleada.home?.name} ${goleada.home_score} — ${goleada.away_score} ${goleada.away?.name}`,
    subtitulo: 'mayor goleada de la historia',
    descripcion: goleada.played_at ? new Date(goleada.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
    color: '#e8710a',
  })

  // 12. Equipo más goleador / más victorioso
  const equiposMap = {}
  ;(matches || []).forEach(m => {
    const add = (id, name, gF, gC) => {
      if (!id || !name) return
      if (!equiposMap[id]) equiposMap[id] = { name, goles: 0, pj: 0, victorias: 0, empates: 0, derrotas: 0 }
      equiposMap[id].goles += gF
      equiposMap[id].pj   += 1
      if (gF > gC) equiposMap[id].victorias++
      else if (gF === gC) equiposMap[id].empates++
      else equiposMap[id].derrotas++
    }
    add(m.home_team_id, m.home?.name, m.home_score || 0, m.away_score || 0)
    add(m.away_team_id, m.away?.name, m.away_score || 0, m.home_score || 0)
  })
  const equiposArr = Object.values(equiposMap)

  const topGolEq = [...equiposArr].sort((a, b) => b.goles - a.goles)[0]
  if (topGolEq?.goles > 0) recs.push({
    id: 'eq_goles',
    titulo: `${topGolEq.goles} goles anotados`,
    nombre: topGolEq.name || '?',
    subtitulo: 'equipo más goleador',
    descripcion: `en ${topGolEq.pj} partidos`,
    color: GOLD,
  })

  const topVicEq = [...equiposArr].sort((a, b) => b.victorias - a.victorias)[0]
  if (topVicEq?.victorias > 0) recs.push({
    id: 'eq_victorias',
    titulo: `${topVicEq.victorias} victorias`,
    nombre: topVicEq.name || '?',
    subtitulo: 'equipo más victorioso',
    descripcion: `${topVicEq.pj} PJ · ${topVicEq.goles} goles`,
    color: '#9955ff',
  })

  guardarCacheRapido('records_auto', recs)
  return recs
}
