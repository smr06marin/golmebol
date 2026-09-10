import { supabase } from './supabase'

// La cédula es el identificador único de cada PERSONA en Golmebol, sin
// importar en qué rol esté: un jugador y un árbitro son la misma fila de
// `players` (con rol/es_arbitro), así que basta buscar ahí para saber si
// esa cédula ya tiene nombre registrado en la plataforma.
export async function buscarPersonaPorCedula(cedula) {
  const c = (cedula || '').trim()
  if (!c) return null
  const { data } = await supabase.from('players')
    .select('id, name, telefono, numero_cedula, rol, es_arbitro, es_arbitro_lider, photo_url, photo_face_url')
    .eq('numero_cedula', c)
    .maybeSingle()
  return data || null
}

// Si la cédula no es de ningún jugador/árbitro, puede que ya sea el
// dueño/representante de OTRO equipo — también cuenta como "ya registrado".
export async function buscarDuenoEquipoPorCedula(cedula, excludeTeamId = null) {
  const c = (cedula || '').trim()
  if (!c) return null
  let q = supabase.from('teams')
    .select('representante_nombre, representante_telefono')
    .eq('representante_cedula', c)
    .not('representante_nombre', 'is', null)
    .limit(1)
  if (excludeTeamId) q = q.neq('id', excludeTeamId)
  const { data } = await q.maybeSingle()
  return data || null
}

// Resuelve, para una cédula, cuál es el nombre/teléfono "de verdad" ya
// registrados en la plataforma (jugador/árbitro, o dueño de otro equipo).
// Se usa como último chequeo justo antes de GUARDAR — así, aunque el
// autocompletado en pantalla no se haya alcanzado a disparar (por ejemplo si
// se guarda apenas se escribe la cédula, sin salir del campo), el equipo
// nunca queda guardado con la cédula de una persona pero el nombre de otra.
export async function resolverIdentidadPorCedula(cedula, excludeTeamId = null) {
  const c = (cedula || '').trim()
  if (!c) return null
  const persona = await buscarPersonaPorCedula(c)
  if (persona) return { nombre: persona.name || '', telefono: persona.telefono || '' }
  const equipo = await buscarDuenoEquipoPorCedula(c, excludeTeamId)
  if (equipo) return { nombre: equipo.representante_nombre || '', telefono: equipo.representante_telefono || '' }
  return null
}

export function rolActualLabel(p) {
  const esArbitro = p.es_arbitro || p.rol === 'arbitro'
  const esJugador = p.rol === 'jugador' || !esArbitro
  if (esArbitro && esJugador) return p.es_arbitro_lider ? 'jugador y coordinador de árbitros' : 'jugador y árbitro'
  if (esArbitro) return p.es_arbitro_lider ? 'coordinador de árbitros' : 'árbitro'
  return 'jugador'
}
