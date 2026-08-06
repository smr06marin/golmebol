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

// Momento (Date.now()) del último registro propio en este tab. SessionGuard
// lo usa para no confundir su propia escritura con una sesión ajena: justo
// después de loguearse, hay una ventana corta donde la lectura inicial de la
// base de datos (o el eco de Realtime) puede llegar antes o después de que
// este mismo dispositivo termine de guardar su id — sin este resguardo, el
// dispositivo que se acaba de loguear se auto-expulsa por una carrera de
// tiempos, no porque haya entrado otro de verdad.
let registradaEn = 0
export function seRegistroHacePoco() {
  return Date.now() - registradaEn < 8000
}

// Se llama al arrancar un login/creación de cuenta, ANTES de llamar a
// supabase.auth — en cuanto esa llamada tiene éxito, SessionGuard se entera
// del usuario casi al instante (por el listener de auth) y hace su chequeo,
// pero recién varios pasos (y awaits) después es que este dispositivo llega
// a "reclamar" la sesión con registrarSesionDispositivo(). Si no se marca la
// gracia desde ya, ese chequeo de por medio ve el session_id de OTRO
// dispositivo (el dueño actual) contra el id local viejo de este navegador y
// se auto-expulsa antes de terminar de entrar.
export function marcarInicioLogin() {
  registradaEn = Date.now()
}

// Se llama justo después de un login exitoso — este dispositivo "reclama" la
// sesión: genera un id propio, lo guarda local, y lo deja en la base de
// datos como el dueño actual. Cualquier otro dispositivo que ya estuviera
// adentro con la misma cuenta va a quedar con un id que ya no coincide.
export async function registrarSesionDispositivo(playerId) {
  const nuevoId = generarId()
  registradaEn = Date.now()
  guardarIdSesionLocal(nuevoId)
  await supabase.from('players').update({ session_id: nuevoId, session_actualizado_at: new Date().toISOString() }).eq('id', playerId)
}
