import { supabase } from './supabase'

/**
 * Hidrata filas con datos de players_publico (vista segura para anon).
 * PostgREST no embebe vistas vía FK, así que se hace fetch separado por ids.
 *
 * @param {Array} rows
 * @param {object} opts
 * @param {string} [opts.idKey='player_id'] — columna con el uuid del jugador
 * @param {string} [opts.as='players'] — nombre del campo anidado (compat con embeds)
 * @param {string} [opts.columns='id, name, photo_url, photo_face_url, city, genero, posicion, posicion_futbol5, posicion_futbol7, posicion_futbol11, goles_escuela, asistencias_escuela, amarillas_escuela, rojas_escuela, partidos_escuela, mvp_escuela']
 */
export async function hydratePlayersPublico(rows, opts = {}) {
  const idKey = opts.idKey || 'player_id'
  const as = opts.as || 'players'
  const columns = opts.columns || 'id, name, photo_url, photo_face_url, city, genero, posicion, posicion_futbol5, posicion_futbol7, posicion_futbol11, goles_escuela, asistencias_escuela, amarillas_escuela, rojas_escuela, partidos_escuela, mvp_escuela'
  const list = rows || []
  const ids = [...new Set(list.map(r => r?.[idKey]).filter(Boolean))]
  if (ids.length === 0) {
    return list.map(r => ({ ...r, [as]: r[as] || null }))
  }
  const { data, error } = await supabase.from('players_publico').select(columns).in('id', ids)
  if (error) throw error
  const map = Object.fromEntries((data || []).map(p => [p.id, p]))
  return list.map(r => ({ ...r, [as]: map[r[idKey]] || null }))
}
