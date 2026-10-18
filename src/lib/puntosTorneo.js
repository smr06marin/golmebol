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

// Solo la config del W (para las planillas). Nunca falla: sin migración → 3-0.
export async function cargarGolesW(tournamentId) {
  try {
    const { data, error } = await supabase.from('tournaments').select('w_goles_ganador').eq('id', tournamentId).maybeSingle()
    return error ? 3 : golesGanadorW(data)
  } catch { return 3 }
}
