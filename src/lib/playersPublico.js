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

// La vista goleadores_por_torneo solo trae `photo_url` (foto de la tarjeta), pero la mayoría de jugadores tienen
// solo la foto de la CARA (photo_face_url) — por eso los goleadores salían sin foto. A los que les falta, se les
// completa con su foto de cara (o la de tarjeta) desde players_publico. Si algo falla, devuelve la lista tal cual.
export async function completarFotosGoleadores(lista, max = 40) {
  const rows = lista || []
  const ids = [...new Set(rows.slice(0, max).filter(g => g?.player_id && !g.photo_url).map(g => g.player_id))]
  if (ids.length === 0) return rows
  try {
    const { data, error } = await supabase.from('players_publico').select('id, photo_url, photo_face_url').in('id', ids)
    if (error || !data?.length) return rows
    const foto = new Map(data.map(p => [p.id, p.photo_face_url || p.photo_url || null]))
    return rows.map(g => (!g.photo_url && foto.get(g.player_id)) ? { ...g, photo_url: foto.get(g.player_id) } : g)
  } catch {
    return rows
  }
}
