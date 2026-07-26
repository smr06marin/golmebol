import { supabase } from './supabase'

// Resuelve TODAS las predicciones (Predix) pendientes de un partido, sin
// importar desde cuál pantalla se cerró el partido (planilla completa,
// planilla rápida, árbitro o edición rápida del marcador en el panel admin)
// — antes esta lógica estaba copiada y pegada en 5 lugares distintos y en
// NINGUNO de ellos se le daban puntos a quien acertaba el goleador del
// partido, aunque el goleador sí se guardaba en cada predicción.
//
// Puntos:
//   - Ganador correcto: 3 (5 si acertó empate)
//   - Goles del local exactos: 3
//   - Goles del visitante exactos: 3
//   - Marcador exacto completo (bonus): 10
//   - Goleador correcto: 2 — el jugador con MÁS goles anotados en ESE
//     partido según player_match_stats.goals_scored (si hay empate entre
//     varios, cualquiera de ellos cuenta como acierto). Los autogoles nunca
//     se le anotan a ningún jugador en player_match_stats, así que un
//     autogol jamás puede convertir a alguien en "goleador del partido".
export async function resolverPrediccionesPartido(matchId, golesHome, golesAway) {
  const ganador = golesHome > golesAway ? 'home' : golesHome < golesAway ? 'away' : 'draw'

  const { data: preds } = await supabase.from('predicciones').select('*').eq('match_id', matchId).eq('resuelta', false)
  if (!preds || preds.length === 0) return

  const { data: stats } = await supabase.from('player_match_stats').select('player_id, goals_scored').eq('match_id', matchId)
  let maxGoles = 0
  ;(stats || []).forEach(s => { if ((s.goals_scored || 0) > maxGoles) maxGoles = s.goals_scored })
  const goleadoresPartido = maxGoles > 0
    ? new Set((stats || []).filter(s => (s.goals_scored || 0) === maxGoles).map(s => s.player_id))
    : new Set()

  for (const pred of preds) {
    let pts = 0
    if (pred.ganador === ganador) pts += ganador === 'draw' ? 5 : 3
    if (pred.goles_home === golesHome) pts += 3
    if (pred.goles_away === golesAway) pts += 3
    if (pred.goles_home === golesHome && pred.goles_away === golesAway) pts += 10
    if (pred.goleador_id && goleadoresPartido.has(pred.goleador_id)) pts += 2
    await supabase.from('predicciones').update({ puntos_ganados: pts, resuelta: true }).eq('id', pred.id)
  }
}

// Para partidos que no otorgan puntos de Predix (ej. amistosos marcados como
// tal) — deja las predicciones resueltas en 0 en vez de dejarlas pendientes
// para siempre.
export async function anularPrediccionesPartido(matchId) {
  await supabase.from('predicciones').update({ puntos_ganados: 0, resuelta: true }).eq('match_id', matchId).eq('resuelta', false)
}
