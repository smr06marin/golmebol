import { supabase } from './supabase'

// Datos privados de un equipo: cédula y teléfono del dueño, y token del link de registro.
// Ya no viajan en la tabla pública de equipos: la base solo los entrega, a través de esta
// función, al admin, al organizador de un torneo donde juega el equipo, al staff de la
// escuela o al propio dueño. Para cualquier otra persona devuelve null (sin romper nada).
export async function cargarDatosPrivadosEquipo(teamId) {
  if (!teamId) return null
  try {
    const { data, error } = await supabase.rpc('equipo_datos_privados', { p_team_id: teamId })
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

// Mezcla esos datos sobre el objeto del equipo SOLO donde traen valor
// (así, con la base sin migrar, no pisa lo que ya venía en la fila).
export function conDatosPrivados(equipo, priv) {
  if (!equipo || !priv) return equipo
  const extra = {}
  for (const k of ['representante_cedula', 'representante_telefono', 'registro_token']) {
    if (priv[k]) extra[k] = priv[k]
  }
  return { ...equipo, ...extra }
}
