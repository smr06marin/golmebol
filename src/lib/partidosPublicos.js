import { supabase } from './supabase'
import { cargarAliasTorneo, aplicarAlias } from './nombresTorneo'

// Columnas de `matches` que de verdad usan las páginas públicas. Se pide esta
// lista en vez de '*' porque `matches` también guarda las FIRMAS de la planilla
// (imágenes en base64) y otros datos internos: con '*' cada visitante se
// descargaba esas firmas de TODOS los partidos del torneo, varias veces.
//
// RENDIMIENTO: el "en vivo" (live_state / live_state_rapida) es la planilla
// COMPLETA de cada partido (lista de jugadores, firmas en imagen, etc.) y se
// queda guardada también en los partidos ya jugados: en un torneo de 47
// partidos eran ~900 KB por visita, solo para no usarlos (un partido terminado
// nunca sale "en vivo"). Ahora se piden aparte y SOLO de los partidos que no
// han terminado.
export const COLUMNAS_PARTIDO_BASE = [
  'id', 'tournament_id', 'home_team_id', 'away_team_id', 'home_score', 'away_score',
  'status', 'fase', 'ronda', 'slot_index', 'matchday', 'played_at', 'location',
  'tipo_resultado', 'penales_local', 'penales_visitante', 'penales_ganador', 'foto_w_url',
].join(', ')
export const COLUMNAS_PARTIDO_VIVO = 'id, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at'
export const COLUMNAS_PARTIDO_PUBLICO = `${COLUMNAS_PARTIDO_BASE}, ${COLUMNAS_PARTIDO_VIVO.replace(/^id, /, '')}`

const EMBED_EQUIPOS = 'home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)'

// Devuelve la consulta de partidos de un torneo ya lista (sin ejecutar) para
// poder meterla en un Promise.all. Si alguna columna de la lista no existiera
// en la base, `resolver` reintenta con '*' para que la página NUNCA se quede
// sin partidos por esto.
export function consultaPartidosTorneo(torneoId) {
  const base = supabase.from('matches').select(`${COLUMNAS_PARTIDO_BASE}, ${EMBED_EQUIPOS}`)
    .eq('tournament_id', torneoId).order('played_at', { ascending: true })
  const vivo = supabase.from('matches').select(COLUMNAS_PARTIDO_VIVO)
    .eq('tournament_id', torneoId).neq('status', 'finished')
  return Promise.all([base, vivo]).then(([rb, rv]) => {
    if (rb.error || !Array.isArray(rb.data)) return rb
    const enVivo = new Map((rv.error ? [] : (rv.data || [])).map(v => [v.id, v]))
    return { ...rb, data: rb.data.map(p => (enVivo.has(p.id) ? { ...p, ...enVivo.get(p.id) } : p)) }
  })
}

// `alias`: nombres de los equipos SOLO en este torneo (Map team_id → nombre). Si no se pasa, se piden.
export async function resolverPartidosTorneo(resultado, torneoId, alias) {
  return (await resolverPartidosConEstado(resultado, torneoId, alias)).partidos
}

// Igual, pero además avisa si la consulta FALLÓ (sin señal): así no se confunde
// "no se pudieron leer los partidos" con "el torneo no tiene partidos".
export async function resolverPartidosConEstado(resultado, torneoId, alias) {
  let partidos, error = null
  if (resultado && !resultado.error) partidos = resultado.data || []
  else {
    const r2 = await supabase.from('matches').select(`*, ${EMBED_EQUIPOS}`)
      .eq('tournament_id', torneoId).order('played_at', { ascending: true })
    partidos = r2.data || []
    error = r2.error || null
  }
  return { partidos: aplicarAlias(partidos, alias || await cargarAliasTorneo(torneoId, { publico: true })), error }
}

export async function traerPartidosTorneo(torneoId) {
  const [res, alias] = await Promise.all([consultaPartidosTorneo(torneoId), cargarAliasTorneo(torneoId, { publico: true })])
  return resolverPartidosTorneo(res, torneoId, alias)
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
