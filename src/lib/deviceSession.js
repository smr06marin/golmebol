import { supabase } from './supabase'

// Bloqueo de sesión única por cuenta (jugador, profesor, árbitro, escuela,
// acudiente...). Cada dispositivo guarda su propio id de sesión en
// localStorage; al hacer login se genera uno nuevo y se sobreescribe en
// players.session_id — el dispositivo que se haya quedado con el id viejo
// lo nota (ver SessionGuard.jsx) y se cierra solo.
const LOCAL_KEY = 'golmebol_session_id'

function generarId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function idSesionLocal() {
  try { return localStorage.getItem(LOCAL_KEY) } catch { return null }
}

export function guardarIdSesionLocal(id) {
  try { localStorage.setItem(LOCAL_KEY, id) } catch {}
}

export function limpiarSesionLocal() {
  try { localStorage.removeItem(LOCAL_KEY) } catch {}
}

// Se llama justo después de un login exitoso — este dispositivo "reclama" la
// sesión: genera un id propio, lo guarda local, y lo deja en la base de
// datos como el dueño actual. Cualquier otro dispositivo que ya estuviera
// adentro con la misma cuenta va a quedar con un id que ya no coincide.
export async function registrarSesionDispositivo(playerId) {
  const nuevoId = generarId()
  guardarIdSesionLocal(nuevoId)
  await supabase.from('players').update({ session_id: nuevoId, session_actualizado_at: new Date().toISOString() }).eq('id', playerId)
}
