import { supabase } from './supabase'

// Sube a la base el avance del partido (reloj, goles, tarjetas) para que las páginas públicas lo
// muestren EN VIVO. La tabla de partidos solo deja editar al dueño/admin del torneo, así que un árbitro
// (con cuenta o con link) era rechazado SIN error y el en vivo nunca aparecía. Ahora se guarda por una
// función de la base con su propio permiso (migracion_guardar_en_vivo.sql). Si esa función todavía no
// existe, se usa el guardado directo de antes. Nunca lanza error: es un respaldo que no debe frenar la planilla.
//   tipo: 'rapida' (matches.live_state_rapida) | 'completa' (matches.live_state)
const faltaFuncion = e => !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|schema cache|does not exist/i.test(e.message || ''))

export async function guardarEnVivo(matchId, tipo, snap, ts) {
  try {
    const { error } = await supabase.rpc('guardar_estado_en_vivo', { p_match_id: matchId, p_tipo: tipo, p_snap: snap, p_ts: ts })
    if (!error) return true
    if (!faltaFuncion(error)) { console.warn('[en vivo] no se pudo subir el avance:', error.message); return false }
    const campos = tipo === 'rapida'
      ? { live_state_rapida: snap, live_state_rapida_updated_at: ts }
      : { live_state: snap, live_state_updated_at: ts }
    const { error: err2 } = await supabase.from('matches').update(campos).eq('id', matchId)
    if (err2) console.warn('[en vivo] no se pudo subir el avance:', err2.message)
    return !err2
  } catch { return false }
}

// Guarda el RESULTADO del partido (marcador, estado finalizado, penales, firmas, capitanes...). Igual que el en vivo:
// la tabla de partidos solo deja editar al dueño/admin, y a un árbitro la base le descartaba el cambio SIN error,
// así que la planilla creía haber guardado y el partido seguía "pendiente". Ahora va por una función de la base con
// permiso (migracion_guardar_resultado_partido.sql). Devuelve { error } como supabase: error = null si SÍ se guardó.
// Si esa función aún no existe, se guarda directo como antes, pero comprobando que de verdad se modificó una fila.
export async function guardarResultadoPartido(matchId, campos) {
  const { data, error } = await supabase.rpc('guardar_resultado_partido', { p_match_id: matchId, p_campos: campos })
  if (!error) {
    if (data && data.ok === false) return { error: { message: 'la base no guardó el partido (0 filas modificadas)' } }
    return { error: null }
  }
  if (!faltaFuncion(error)) return { error }
  const { data: filas, error: err2 } = await supabase.from('matches').update(campos).eq('id', matchId).select('id')
  if (err2) return { error: err2 }
  if (!filas || filas.length === 0) return { error: { message: 'la base no permitió guardar el resultado (falta ejecutar migracion_guardar_resultado_partido.sql en Supabase)' } }
  return { error: null }
}
