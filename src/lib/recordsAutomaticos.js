import { supabase } from './supabase'

// Calcula los récords que se generan solos con los datos de la liga
// (máximo goleador, hat-tricks, rachas, etc.). Se usa tanto en la página
// pública de récords como en el panel de admin (para que el admin vea qué
// dato real se mostraría antes de decidir si lo oculta o no).
export async function calcularRecordsAutomaticos() {
  const { data: cache } = await supabase
    .from('player_stats_cache')
    .select('*, players(name, posicion_futbol5, posicion_futbol7, posicion_futbol11)')

  const { data: statsPorPartido } = await supabase
    .from('player_match_stats')
    .select('*, players(name), matches(home_score, away_score, played_at, home:home_team_id(name), away:away_team_id(name))')
    .gt('goals_scored', 0)
    .order('goals_scored', { ascending: false })

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home:home_team_id(name), away:away_team_id(name)')
    .eq('status', 'finished')

  const recs = []
  const GOLD = '#f9a825', CYAN = '#00ddd0'

  // 1. Máximo goleador
  const topGol = [...(cache || [])].sort((a, b) => b.goles - a.goles)[0]
  if (topGol?.goles > 0) recs.push({
    id: 'max_goleador',
    titulo: `${topGol.goles} goles históricos`,
    nombre: topGol.players?.name || '?',
    subtitulo: `${topGol.pj} partidos jugados`,
    descripcion: `Promedio ${topGol.pj > 0 ? (topGol.goles / topGol.pj).toFixed(2) : 0} goles/partido`,
    color: GOLD,
  })

  // 2. Más goles en un partido
  const topGolPar = (statsPorPartido || [])[0]
  if (topGolPar?.goals_scored >= 2) recs.push({
    id: 'goles_partido',
    titulo: `${topGolPar.goals_scored} goles en un partido`,
    nombre: topGolPar.players?.name || '?',
    subtitulo: `${topGolPar.matches?.home?.name} vs ${topGolPar.matches?.away?.name}`,
    descripcion: topGolPar.matches?.played_at ? new Date(topGolPar.matches.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    color: '#e8710a',
  })

  // 3. Hat-tricks
  const topHat = [...(cache || [])].sort((a, b) => b.hat_tricks - a.hat_tricks)[0]
  if (topHat?.hat_tricks > 0) recs.push({
    id: 'hat_tricks',
    titulo: `${topHat.hat_tricks} hat-trick${topHat.hat_tricks > 1 ? 's' : ''}`,
    nombre: topHat.players?.name || '?',
    subtitulo: 'más hat-tricks en la historia',
    descripcion: '3 o más goles en un solo partido',
    color: GOLD,
  })

  // 4. Más victorias
  const topVic = [...(cache || [])].sort((a, b) => b.victorias - a.victorias)[0]
  if (topVic?.victorias > 0) recs.push({
    id: 'victorias',
    titulo: `${topVic.victorias} victorias`,
    nombre: topVic.players?.name || '?',
    subtitulo: `en ${topVic.pj} partidos`,
    descripcion: `${topVic.pj > 0 ? Math.round((topVic.victorias / topVic.pj) * 100) : 0}% de eficacia`,
    color: '#9955ff',
  })

  // 5. Más partidos
  const topPJ = [...(cache || [])].sort((a, b) => b.pj - a.pj)[0]
  if (topPJ?.pj > 0) recs.push({
    id: 'mas_partidos',
    titulo: `${topPJ.pj} partidos jugados`,
    nombre: topPJ.players?.name || '?',
    subtitulo: 'más partidos en la historia',
    descripcion: `${topPJ.victorias || 0}V · ${topPJ.empates || 0}E · ${topPJ.derrotas || 0}D`,
    color: CYAN,
  })

  // 6. Racha victorias
  const topRachaV = [...(cache || [])].sort((a, b) => (b.racha_victorias_max || b.racha_victorias_actual || 0) - (a.racha_victorias_max || a.racha_victorias_actual || 0))[0]
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
  const topRachaG = [...(cache || [])].sort((a, b) => (b.racha_goles_actual || 0) - (a.racha_goles_actual || 0))[0]
  if (topRachaG?.racha_goles_actual >= 2) recs.push({
    id: 'racha_gol',
    titulo: `goles en ${topRachaG.racha_goles_actual} partidos seguidos`,
    nombre: topRachaG.players?.name || '?',
    subtitulo: '🔥 racha goleadora activa',
    descripcion: 'marcó en partidos consecutivos',
    color: '#e8710a',
  })

  // 8. Arcos en cero
  const porteros = (cache || []).filter(s => {
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
  const topFair = [...(cache || [])].filter(s => s.partidos_sin_tarjetas > 0).sort((a, b) => b.partidos_sin_tarjetas - a.partidos_sin_tarjetas)[0]
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

  return recs
}
