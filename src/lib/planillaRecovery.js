import { supabase } from './supabase'

// Si el celular recarga la página (o el navegador mata la pestaña al pasar a
// WhatsApp y volver) mientras se está llenando la planilla de un partido, este
// marcador permite reabrirla automáticamente en el mismo partido al volver,
// en vez de perder todo y empezar de cero. Los datos ya escritos siguen
// guardados aparte en localStorage (clave `planilla_<id>`) — esto solo dice
// "qué partido estaba abierto" para saber cuál planilla volver a mostrar.
export const PLANILLA_ABIERTA_KEY = 'golmebol_planilla_abierta'

export async function recuperarPlanillaAbierta() {
  try {
    const raw = localStorage.getItem(PLANILLA_ABIERTA_KEY)
    if (!raw) return null
    const { id } = JSON.parse(raw)
    if (!id) return null
    const { data, error } = await supabase.from('matches')
      .select('*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
      .eq('id', id).single()
    if (error || !data) return null
    return data
  } catch (e) {
    return null
  }
}
