import { supabase } from './supabase'

// Plantillas de TODOS los equipos de un torneo, pedidas de una vez (en segundo
// plano al abrir el torneo) para que al tocar un equipo la plantilla salga al
// instante. Los jugadores salen de players_publico (vista segura, sin cédula).
//
// Si la vista no tiene las etiquetas (Élite/Profesional/Mayor de 35), se
// reintenta sin ellas: la plantilla SIEMPRE se muestra, aunque sea sin etiquetas.
const COLS_CON_ETIQUETAS = 'id, name, photo_url, photo_face_url, es_elite, es_profesional, es_mayor_35, etiqueta_personalizada'
const COLS_BASE = 'id, name, photo_url, photo_face_url'

async function jugadoresPorIds(ids) {
  const mapa = {}
  const trozos = []
  for (let i = 0; i < ids.length; i += 80) trozos.push(ids.slice(i, i + 80))
  let cols = COLS_CON_ETIQUETAS
  await Promise.all(trozos.map(async trozo => {
    let r = await supabase.from('players_publico').select(cols).in('id', trozo)
    if (r.error && cols === COLS_CON_ETIQUETAS) {
      cols = COLS_BASE
      r = await supabase.from('players_publico').select(cols).in('id', trozo)
    }
    if (r.error) throw r.error
    ;(r.data || []).forEach(p => { mapa[p.id] = p })
  }))
  return mapa
}

const porNombre = (a, b) => (a.name || '').localeCompare(b.name || '')

// → { [teamId]: [jugador, ...] } ordenados por nombre
export async function cargarRostersTorneo(tournamentId) {
  const regs = []
  for (let desde = 0; desde < 6000; desde += 1000) {
    const { data, error } = await supabase.from('tournament_player_registrations')
      .select('player_id, team_id')
      .eq('tournament_id', tournamentId).eq('activo', true)
      .range(desde, desde + 999)
    if (error) throw error
    regs.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const ids = [...new Set(regs.map(r => r.player_id).filter(Boolean))]
  const mapa = ids.length ? await jugadoresPorIds(ids) : {}
  const porEquipo = {}
  regs.forEach(r => {
    const j = mapa[r.player_id]
    if (!j || !r.team_id) return
    ;(porEquipo[r.team_id] = porEquipo[r.team_id] || []).push(j)
  })
  Object.values(porEquipo).forEach(l => l.sort(porNombre))
  return porEquipo
}

// Un solo equipo (por si se abre antes de que termine la carga de todos)
export async function cargarRosterEquipo(tournamentId, teamId) {
  const { data, error } = await supabase.from('tournament_player_registrations')
    .select('player_id').eq('tournament_id', tournamentId).eq('team_id', teamId).eq('activo', true)
  if (error) throw error
  const ids = [...new Set((data || []).map(r => r.player_id).filter(Boolean))]
  if (!ids.length) return []
  const mapa = await jugadoresPorIds(ids)
  return ids.map(i => mapa[i]).filter(Boolean).sort(porNombre)
}
