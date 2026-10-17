import { supabase } from './supabase'

// Datos de la planilla del equipo (jugadores con foto, cédula y fecha de
// nacimiento). Salen por funciones del servidor con permiso controlado
// (migracion_planilla_equipo.sql): la cédula es un dato protegido.

function mensaje(error) {
  const m = error?.message || ''
  if (error?.code === 'PGRST202' || /could not find the function|schema cache|does not exist/i.test(m)) {
    return 'Falta ejecutar migracion_planilla_equipo.sql en Supabase'
  }
  return m || 'No se pudo cargar la planilla del equipo'
}

// Organizador (dueño del torneo) o admin principal — usa la sesión actual.
export async function cargarPlanillaEquipoOrganizador(teamId, tournamentId) {
  const { data, error } = await supabase.rpc('planilla_equipo_organizador', { p_team_id: teamId, p_tournament_id: tournamentId })
  if (error) throw new Error(mensaje(error))
  return data
}

// Dueño/representante del equipo — `cliente` es el cliente de supabase ya
// autenticado con su cédula y contraseña (el que usa el link de registro).
export async function cargarPlanillaEquipoRepresentante(cliente, token, tournamentId) {
  const { data, error } = await cliente.rpc('planilla_equipo_representante', { p_token: token, p_tournament_id: tournamentId })
  if (error) throw new Error(mensaje(error))
  return data
}
