// Sistema de puntos configurable por torneo (victoria / empate / derrota).
// Antes estaba fijo en 3-1-0 en cada página que arma la tabla de
// posiciones; ahora cada torneo puede definir el suyo (migracion_sistema_puntos.sql).
// Si el torneo todavía no tiene el campo (torneos viejos, o falta correr la
// migración), se usa el default de siempre: 3 por victoria, 1 por empate, 0 por derrota.
//
// Partido por W (migracion_w_y_descuentos.sql): cada torneo define con qué marcador
// gana el equipo que SÍ se presentó (w_goles_ganador, por defecto 3-0) y cuántos
// puntos recibe (w_puntos_ganador; vacío = los mismos de una victoria normal).
// Descuentos de puntos: tabla descuentos_puntos (ajustes manuales por equipo).
import { supabase } from './supabase'

export function getPuntosTorneo(torneo) {
  const victoria = torneo?.pts_victoria ?? 3
  return {
    victoria,
    empate:   torneo?.pts_empate   ?? 1,
    derrota:  torneo?.pts_derrota  ?? 0,
    victoriaW: torneo?.w_puntos_ganador ?? victoria,
  }
}

// Puntos que suma el GANADOR de un partido: los del W si el partido fue por W.
export function puntosVictoria(P, partido) {
  return partido?.tipo_resultado === 'w' ? P.victoriaW : P.victoria
}

// Goles con los que gana el equipo que se presentó en un W (3 si el torneo no lo definió).
export function golesGanadorW(torneo) {
  const n = parseInt(torneo?.w_goles_ganador, 10)
  return Number.isFinite(n) && n >= 0 ? n : 3
}

// Descuentos de puntos de un torneo ([] si la tabla todavía no existe o no hay).
export async function cargarDescuentos(tournamentId) {
  if (!tournamentId) return []
  try {
    const { data, error } = await supabase.from('descuentos_puntos')
      .select('id, tournament_id, team_id, puntos, motivo, created_at')
      .eq('tournament_id', tournamentId).order('created_at', { ascending: true })
    return error || !Array.isArray(data) ? [] : data
  } catch { return [] }
}

// Torneo con lo necesario para armar la tabla de posiciones: sistema de puntos,
// config del W y descuentos. Si faltan columnas (migración sin correr) se
// reintenta con lo de siempre, así la tabla nunca se rompe.
export async function cargarTorneoPuntos(tournamentId) {
  let res = await supabase.from('tournaments')
    .select('pts_victoria, pts_empate, pts_derrota, w_puntos_ganador, w_goles_ganador').eq('id', tournamentId).maybeSingle()
  if (res.error) {
    res = await supabase.from('tournaments').select('pts_victoria, pts_empate, pts_derrota').eq('id', tournamentId).maybeSingle()
  }
  const descuentos = await cargarDescuentos(tournamentId)
  return { ...(res.data || {}), descuentos }
}

// Los partidos por W YA jugados guardan su marcador en el partido (ej. 3-0), así que
// al cambiar la config del torneo (ej. a 1-0) hay que reescribirlo. Se llama al guardar
// la config: el equipo que ganó por W (el de más goles) queda con `goles`, el otro con 0.
// Devuelve cuántos partidos cambió. Si goles < 1 no toca nada (sin goles no se sabría quién ganó).
export async function reaplicarMarcadorW(tournamentId, goles) {
  const g = parseInt(goles, 10)
  if (!tournamentId || !Number.isFinite(g) || g < 1) return { cambiados: 0, error: null }
  let error = null, cambiados = 0
  try {
    const { data, error: errLeer } = await supabase.from('matches')
      .select('id, home_score, away_score').eq('tournament_id', tournamentId).eq('tipo_resultado', 'w').eq('status', 'finished')
    if (errLeer || !data) return { cambiados: 0, error: errLeer || null }
    for (const m of data) {
      const h = m.home_score || 0, a = m.away_score || 0
      if (h === a) continue
      const nh = h > a ? g : 0, na = a > h ? g : 0
      if (nh === h && na === a) continue
      const { data: upd, error: errUpd } = await supabase.from('matches').update({ home_score: nh, away_score: na }).eq('id', m.id).select('id')
      if (!errUpd && upd && upd.length) cambiados++
      else error = errUpd || new Error('sin permiso para editar el partido')
    }
  } catch (e) { error = e }
  return { cambiados, error }
}

// Solo la config del W (para las planillas). Nunca falla: sin migración → 3-0.
export async function cargarGolesW(tournamentId) {
  try {
    const { data, error } = await supabase.from('tournaments').select('w_goles_ganador').eq('id', tournamentId).maybeSingle()
    return error ? 3 : golesGanadorW(data)
  } catch { return 3 }
}
