import { supabase } from './supabase'

// Columnas de `matches` que de verdad usan las páginas públicas. Se pide esta
// lista en vez de '*' porque `matches` también guarda las FIRMAS de la planilla
// (imágenes en base64) y otros datos internos: con '*' cada visitante se
// descargaba esas firmas de TODOS los partidos del torneo, varias veces.
export const COLUMNAS_PARTIDO_PUBLICO = [
  'id', 'tournament_id', 'home_team_id', 'away_team_id', 'home_score', 'away_score',
  'status', 'fase', 'ronda', 'slot_index', 'matchday', 'played_at', 'location',
  'tipo_resultado', 'penales_local', 'penales_visitante', 'penales_ganador', 'foto_w_url',
  'live_state', 'live_state_updated_at', 'live_state_rapida', 'live_state_rapida_updated_at',
].join(', ')

const EMBED_EQUIPOS = 'home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)'

// Devuelve la consulta de partidos de un torneo ya lista (sin ejecutar) para
// poder meterla en un Promise.all. Si alguna columna de la lista no existiera
// en la base, `resolver` reintenta con '*' para que la página NUNCA se quede
// sin partidos por esto.
export function consultaPartidosTorneo(torneoId) {
  return supabase.from('matches').select(`${COLUMNAS_PARTIDO_PUBLICO}, ${EMBED_EQUIPOS}`)
    .eq('tournament_id', torneoId).order('played_at', { ascending: true })
}

export async function resolverPartidosTorneo(resultado, torneoId) {
  if (resultado && !resultado.error) return resultado.data || []
  const { data } = await supabase.from('matches').select(`*, ${EMBED_EQUIPOS}`)
    .eq('tournament_id', torneoId).order('played_at', { ascending: true })
  return data || []
}

export async function traerPartidosTorneo(torneoId) {
  return resolverPartidosTorneo(await consultaPartidosTorneo(torneoId), torneoId)
}

// Árbol de eliminatorias: son los mismos partidos que ya se descargaron, solo
// los de fase distinta de 'grupo' (y sin fase nula, igual que el `neq` de la
// base), ordenados por ronda y fecha — así no hace falta una segunda consulta.
export function derivarBracket(partidos) {
  // Misma regla que `order('ronda').order('played_at')` en la base: lo que no
  // tiene valor (null) va al final.
  const cmp = (x, y) => (x == null && y == null) ? 0 : x == null ? 1 : y == null ? -1 : x < y ? -1 : x > y ? 1 : 0
  return (partidos || [])
    .filter(p => p.fase && p.fase !== 'grupo')
    .sort((a, b) => cmp(a.ronda, b.ronda) || cmp(a.played_at ? new Date(a.played_at).getTime() : null, b.played_at ? new Date(b.played_at).getTime() : null))
}
