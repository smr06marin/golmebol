import { supabase } from './supabase'

// Plantillas de TODOS los equipos de un torneo, pedidas de una vez (en segundo
// plano al abrir el torneo) para que al tocar un equipo la plantilla salga al
// instante. Los jugadores salen de players_publico (vista segura, sin cédula).
//
// Si la vista no tiene las etiquetas (Élite/Profesional/Mayor de 35), se
// reintenta sin ellas: la plantilla SIEMPRE se muestra, aunque sea sin etiquetas.
const COLS_CON_ETIQUETAS = 'id, name, photo_url, photo_face_url, es_elite, es_profesional, es_mayor_35, etiqueta_personalizada'
// + la etiqueta Exprofesional (migracion_exprofesional.sql). Si la vista todavía no la tiene, se usan las de antes.
const COLS_CON_EXPRO = 'id, name, photo_url, photo_face_url, es_elite, es_profesional, es_exprofesional, es_mayor_35, etiqueta_personalizada'
const COLS_BASE = 'id, name, photo_url, photo_face_url'

async function jugadoresPorIds(ids) {
  const mapa = {}
  const trozos = []
  for (let i = 0; i < ids.length; i += 80) trozos.push(ids.slice(i, i + 80))
  let cols = COLS_CON_EXPRO
  await Promise.all(trozos.map(async trozo => {
    let r = await supabase.from('players_publico').select(cols).in('id', trozo)
    if (r.error && cols === COLS_CON_EXPRO) {
      cols = COLS_CON_ETIQUETAS
      r = await supabase.from('players_publico').select(cols).in('id', trozo)
    }
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

// Marca de pago de la inscripción (solo sirve en torneos con inscripción POR JUGADOR). Si la columna no existe
// todavía (migración sin correr), se pide sin ella y el jugador queda sin la marca: la plantilla siempre se muestra.
async function regsConPago(armar, cols) {
  let r = await armar(supabase.from('tournament_player_registrations').select(cols + ', inscripcion_pagada'))
  if (r.error && /inscripcion_pagada/i.test(r.error.message || '')) {
    r = await armar(supabase.from('tournament_player_registrations').select(cols))
  }
  return r
}
const conPago = (j, r) => ('inscripcion_pagada' in r ? { ...j, inscripcion_pagada: r.inscripcion_pagada === true } : j)

// → { [teamId]: [jugador, ...] } ordenados por nombre
export async function cargarRostersTorneo(tournamentId) {
  const regs = []
  for (let desde = 0; desde < 6000; desde += 1000) {
    const { data, error } = await regsConPago(q => q.eq('tournament_id', tournamentId).eq('activo', true).range(desde, desde + 999), 'player_id, team_id')
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
    ;(porEquipo[r.team_id] = porEquipo[r.team_id] || []).push(conPago(j, r))
  })
  Object.values(porEquipo).forEach(l => l.sort(porNombre))
  return porEquipo
}

// Un solo equipo (por si se abre antes de que termine la carga de todos)
export async function cargarRosterEquipo(tournamentId, teamId) {
  const { data, error } = await regsConPago(q => q.eq('tournament_id', tournamentId).eq('team_id', teamId).eq('activo', true), 'player_id')
  if (error) throw error
  const regs = (data || []).filter(r => r.player_id)
  const ids = [...new Set(regs.map(r => r.player_id))]
  if (!ids.length) return []
  const mapa = await jugadoresPorIds(ids)
  const vistos = new Set()
  return regs.filter(r => mapa[r.player_id] && !vistos.has(r.player_id) && vistos.add(r.player_id))
    .map(r => conPago(mapa[r.player_id], r)).sort(porNombre)
}
