import { supabase } from './supabase'

// Regla de Golmebol: JUEGA un partido quien quedó anotado en la planilla con
// número de camiseta (o marcado "jugó" en la carga rápida de resultado). Los
// demás jugadores de la plantilla NO suman partido jugado.
//
// Las planillas guardan con "upsert" (crear o actualizar), que nunca borra. Si
// un partido se corrige después (a alguien se le quita el número, o se
// desmarca "¿Jugó?"), su fila vieja quedaría y le seguiría contando un partido
// que no jugó. Esta función la borra: deja en `player_match_stats` de ese
// partido SOLO a los jugadores vigentes.
//
// Seguridad: si la lista de vigentes viene vacía NO borra nada — así un fallo
// al cargar la plantilla nunca puede dejar un partido sin estadísticas.
// No bloquea el guardado: si falla, se avisa en consola y el partido se guarda igual.
export async function limpiarStatsObsoletas(matchId, idsVigentes) {
  try {
    const vigentes = new Set((idsVigentes || []).filter(Boolean))
    if (!matchId || vigentes.size === 0) return
    const { data: existentes, error } = await supabase.from('player_match_stats').select('player_id').eq('match_id', matchId)
    if (error) { console.warn('No se pudo revisar estadísticas obsoletas:', error.message); return }
    const sobran = (existentes || []).map(r => r.player_id).filter(pid => pid && !vigentes.has(pid))
    if (sobran.length === 0) return
    const { error: errBorrar } = await supabase.from('player_match_stats').delete().eq('match_id', matchId).in('player_id', sobran)
    if (errBorrar) console.warn('No se pudieron limpiar estadísticas obsoletas:', errBorrar.message)
  } catch (e) {
    console.warn('Limpieza de estadísticas obsoletas falló:', e?.message || e)
  }
}

// Partido que NO se jugó (W o desierto): nadie jugó, así que se borran todas
// las estadísticas individuales que pudiera tener de un guardado anterior.
export async function borrarStatsDePartido(matchId) {
  try {
    if (!matchId) return
    const { error } = await supabase.from('player_match_stats').delete().eq('match_id', matchId)
    if (error) console.warn('No se pudieron borrar las estadísticas del partido:', error.message)
  } catch (e) {
    console.warn('Borrado de estadísticas falló:', e?.message || e)
  }
}
