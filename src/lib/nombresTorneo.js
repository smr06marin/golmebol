import { supabase } from './supabase'

// ── Nombre del equipo DENTRO de un torneo ─────────────────────────────────
// Un equipo es el mismo en todos los torneos (así se junta toda su historia),
// pero un organizador puede ponerle otro nombre SOLO en su torneo (por
// patrocinio, categoría, etc.). Ese nombre se guarda en
// tournament_teams.nombre_torneo y NO toca teams.name (el nombre de siempre).
// Si la columna todavía no existe en la base, todo sigue como antes.

// { team_id → nombre en ese torneo } de un torneo
// `publico: true` lee la vista pública (para visitantes sin sesión).
export async function cargarAliasTorneo(torneoId, { publico = false } = {}) {
  const m = new Map()
  if (!torneoId) return m
  try {
    const { data, error } = await supabase.from(publico ? 'tournament_teams_publico' : 'tournament_teams').select('team_id, nombre_torneo').eq('tournament_id', torneoId).not('nombre_torneo', 'is', null)
    if (!error) for (const r of data || []) { const n = (r.nombre_torneo || '').trim(); if (n) m.set(r.team_id, n) }
  } catch { /* sin la columna: se usan los nombres de siempre */ }
  return m
}

// Pone el nombre del torneo en filas ya cargadas de UN solo torneo:
//   · partidos  → home / away (usa home_team_id / away_team_id)
//   · filas con equipo embebido → teams (usa team_id)
export function aplicarAlias(filas, alias) {
  if (!alias || alias.size === 0 || !Array.isArray(filas)) return filas
  return filas.map(r => {
    if (!r || typeof r !== 'object') return r
    let o = r
    if (r.home && r.home_team_id && alias.has(r.home_team_id)) o = { ...o, home: { ...r.home, name: alias.get(r.home_team_id) } }
    if (r.away && r.away_team_id && alias.has(r.away_team_id)) o = { ...o, away: { ...r.away, name: alias.get(r.away_team_id) } }
    const tid = r.team_id || (r.teams && r.teams.id)
    if (r.teams && tid && alias.has(tid)) o = { ...o, teams: { ...r.teams, name: alias.get(tid) } }
    return o
  })
}

// Para listas con partidos de VARIOS torneos (agenda del árbitro, partidos del
// día...): busca los nombres de cada torneo y los aplica. Si no hay ninguno
// (lo normal), devuelve las filas tal cual.
export async function aplicarAliasMultiTorneo(filas) {
  if (!Array.isArray(filas) || filas.length === 0) return filas
  const tids = [...new Set(filas.map(r => r?.tournament_id).filter(Boolean))]
  if (tids.length === 0) return filas
  let porTorneo = new Map()
  try {
    const { data, error } = await supabase.from('tournament_teams').select('tournament_id, team_id, nombre_torneo').in('tournament_id', tids).not('nombre_torneo', 'is', null)
    if (error || !data || data.length === 0) return filas
    for (const r of data) {
      const n = (r.nombre_torneo || '').trim(); if (!n) continue
      if (!porTorneo.has(r.tournament_id)) porTorneo.set(r.tournament_id, new Map())
      porTorneo.get(r.tournament_id).set(r.team_id, n)
    }
  } catch { return filas }
  if (porTorneo.size === 0) return filas
  return filas.map(r => {
    const alias = r?.tournament_id ? porTorneo.get(r.tournament_id) : null
    return alias ? aplicarAlias([r], alias)[0] : r
  })
}
