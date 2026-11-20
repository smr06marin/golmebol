import { supabase } from './supabase'

// Listas de partidos SIN lo pesado.
//
// Cada fila de `matches` puede guardar cosas grandes que una LISTA no necesita:
//   · firmas          → las firmas de la planilla en imagen (~40 KB por partido)
//   · live_state      → la planilla completa "en vivo" (jugadores, goles, etc.)
//   · live_state_rapida, planilla_papel → lo mismo de la planilla rápida / de papel
// Con select('*') un torneo de 40–50 partidos bajaba 1–2 MB en cada carga del
// panel (y otra vez al guardar cualquier cambio). Aquí se piden todas las demás
// columnas, y lo "en vivo" SOLO de los partidos que todavía no han terminado
// (un partido jugado nunca sale en vivo). Cada planilla, al abrirse, sigue
// leyendo su partido completo por su cuenta.

export const PESADAS_PARTIDO = ['firmas', 'live_state', 'live_state_rapida', 'planilla_papel']
const EN_VIVO = 'id, live_state, live_state_rapida, planilla_papel'

const CLAVE = 'gm_cols_matches_v1'
let columnas = null      // 'id,tournament_id,...' (sin las pesadas)
let pidiendo = null

function leerGuardadas() {
  try {
    const o = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (o && Array.isArray(o.cols) && o.cols.length > 0 && Date.now() - o.t < 24 * 3600 * 1000) return o.cols.join(',')
  } catch { /* sin caché */ }
  return null
}

// Los nombres de las columnas se aprenden de UN partido (una vez al día): así,
// si mañana se agrega una columna nueva a la base, aparece sola aquí.
async function columnasLivianas() {
  if (columnas) return columnas
  const guardadas = leerGuardadas()
  if (guardadas) { columnas = guardadas; return columnas }
  if (!pidiendo) {
    pidiendo = (async () => {
      let r = await supabase.from('matches').select('*').neq('status', 'finished').limit(1)
      if (!r.error && (!r.data || r.data.length === 0)) r = await supabase.from('matches').select('*').limit(1)
      if (r.error || !r.data || !r.data[0]) return null
      const cols = Object.keys(r.data[0]).filter(c => !PESADAS_PARTIDO.includes(c))
      try { localStorage.setItem(CLAVE, JSON.stringify({ cols, t: Date.now() })) } catch { /* sin caché */ }
      columnas = cols.join(',')
      return columnas
    })().finally(() => { pidiendo = null })
  }
  return pidiendo
}

function olvidarColumnas() {
  columnas = null
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}

const faltaColumna = e => !!e && (e.code === '42703' || e.code === 'PGRST204' || /does not exist|could not find/i.test(e.message || ''))

// embed: lo que va después de las columnas (ej. 'home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
// filtrar: q => q.eq('tournament_id', id).order('played_at')  — los mismos filtros de siempre
export async function traerPartidosLivianos(embed, filtrar) {
  const extra = embed ? `, ${embed}` : ''
  const cols = await columnasLivianas().catch(() => null)
  if (!cols) return filtrar(supabase.from('matches').select(`*${extra}`))
  let res = await filtrar(supabase.from('matches').select(`${cols}${extra}`))
  if (res.error && faltaColumna(res.error)) {
    // Se quitó una columna de la base: se vuelve a aprender la lista la próxima vez y ahora se pide todo
    olvidarColumnas()
    return filtrar(supabase.from('matches').select(`*${extra}`))
  }
  if (res.error || !Array.isArray(res.data) || res.data.length === 0) return res

  // Lo "en vivo" de los que no han terminado, y de los terminados solo SI tienen hoja de papel
  // (para saber qué planilla abrir: con `true` alcanza, la hoja completa la lee la planilla al abrirse).
  const hayPendientes = res.data.some(p => p.status !== 'finished')
  const hayTerminados = res.data.some(p => p.status === 'finished')
  const [rv, rp] = await Promise.all([
    hayPendientes ? filtrar(supabase.from('matches').select(EN_VIVO)).neq('status', 'finished') : Promise.resolve({ data: [] }),
    hayTerminados ? filtrar(supabase.from('matches').select('id')).eq('status', 'finished').not('planilla_papel', 'is', null) : Promise.resolve({ data: [] }),
  ])
  const vivo = new Map((rv.error ? [] : (rv.data || [])).map(v => [v.id, v]))
  const conPapel = new Set((rp.error ? [] : (rp.data || [])).map(v => v.id))
  return {
    ...res,
    data: res.data.map(p => {
      if (vivo.has(p.id)) return { ...p, ...vivo.get(p.id) }
      return { ...p, live_state: null, live_state_rapida: null, planilla_papel: conPapel.has(p.id) ? true : null }
    }),
  }
}
