// Notificaciones push de la APP (Android / iPhone). En la web normal no hace nada.
//
// Cómo funciona:
//  1. La persona toca "Activar avisos" -> se pide el permiso del sistema y Firebase
//     le da un "token" a ese celular.
//  2. Ese token se guarda en Supabase (registrar_push) junto con los equipos que
//     sigue (la estrella, ver favoritos.js) y los torneos que activó aquí.
//     Es anónimo: no se guarda cédula, correo ni nombre.
//  3. El servidor (api/push-enviar.js) manda los avisos a los celulares que siguen
//     ese equipo o ese torneo. Entre 10 pm y 10 am no se envía nada: sale a las 10 am.
import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { notify } from './notify'
import { leerFavoritosIds, EVENTO_FAVORITOS } from './favoritos'

const K_ACTIVO = 'gm_avisos_activo'
const K_TOKEN = 'gm_push_token'
const K_TORNEOS = 'gm_avisos_torneos'
const EVENTO = 'gm-avisos'
const memoria = {}

export const avisosDisponibles = () => {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

function leer(clave, defecto) {
  try {
    const v = localStorage.getItem(clave)
    if (v !== null) { const j = JSON.parse(v); memoria[clave] = j; return j }
  } catch { /* sin acceso a localStorage: se usa la memoria */ }
  return clave in memoria ? memoria[clave] : defecto
}
function escribir(clave, valor) {
  memoria[clave] = valor
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* ignorar */ }
  try { window.dispatchEvent(new Event(EVENTO)) } catch { /* ignorar */ }
}

export const avisosActivos = () => leer(K_ACTIVO, false) === true
export const torneosConAviso = () => { const v = leer(K_TORNEOS, []); return Array.isArray(v) ? v : [] }

// Manda a Supabase el celular + equipos + torneos actuales.
export async function sincronizarAvisos() {
  if (!avisosDisponibles() || !avisosActivos()) return
  const token = leer(K_TOKEN, null)
  if (!token) return
  try {
    await supabase.rpc('registrar_push', {
      p_token: token,
      p_plataforma: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
      p_equipos: leerFavoritosIds(),
      p_torneos: torneosConAviso(),
    })
  } catch { /* sin internet: se reintenta en el próximo cambio o al abrir la app */ }
}

let iniciado = false
let temporizador = null
const sincronizarPronto = () => { clearTimeout(temporizador); temporizador = setTimeout(sincronizarAvisos, 800) }

// Se llama una vez al abrir la app (main.jsx). Deja listos los oyentes y, si ya
// estaban activados, renueva el token (Firebase puede cambiarlo).
export async function iniciarAvisos() {
  if (iniciado || !avisosDisponibles()) return
  iniciado = true
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.addListener('registration', t => {
      escribir(K_TOKEN, t.value)
      sincronizarAvisos()
    })
    await PushNotifications.addListener('registrationError', () => {
      notify('No se pudieron activar los avisos. Intenta de nuevo.', 'error')
    })
    // App abierta: Android no muestra la notificación sola, se muestra adentro
    await PushNotifications.addListener('pushNotificationReceived', n => {
      notify([n.title, n.body].filter(Boolean).join(' — '))
    })
    // Tocó la notificación: abre el torneo
    await PushNotifications.addListener('pushNotificationActionPerformed', a => {
      const ruta = a?.notification?.data?.ruta
      if (typeof ruta === 'string' && ruta.startsWith('/')) {
        window.history.pushState({}, '', ruta)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    })
    window.addEventListener(EVENTO_FAVORITOS, sincronizarPronto)
    if (avisosActivos()) {
      const perm = await PushNotifications.checkPermissions()
      if (perm.receive === 'granted') await PushNotifications.register()
    }
  } catch { /* el plugin no está en este build: se ignora */ }
}

// Pide el permiso y registra el celular. Devuelve { ok, motivo }.
export async function activarAvisos() {
  if (!avisosDisponibles()) return { ok: false, motivo: 'no_app' }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return { ok: false, motivo: 'permiso' }
    escribir(K_ACTIVO, true)
    await PushNotifications.register()
    return { ok: true }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}

export async function desactivarAvisos() {
  escribir(K_ACTIVO, false)
  const token = leer(K_TOKEN, null)
  if (token) { try { await supabase.rpc('baja_push', { p_token: token }) } catch { /* ignorar */ } }
}

export function alternarTorneoAviso(id) {
  if (!id) return
  const actual = torneosConAviso()
  escribir(K_TORNEOS, actual.includes(id) ? actual.filter(x => x !== id) : [...actual, id])
  sincronizarAvisos()
}

export function useAvisos() {
  const [estado, setEstado] = useState(() => ({ activo: avisosActivos(), torneos: torneosConAviso() }))
  useEffect(() => {
    const sync = () => setEstado({ activo: avisosActivos(), torneos: torneosConAviso() })
    window.addEventListener(EVENTO, sync)
    return () => window.removeEventListener(EVENTO, sync)
  }, [])
  const activar = useCallback(() => activarAvisos(), [])
  const desactivar = useCallback(() => desactivarAvisos(), [])
  return { ...estado, activar, desactivar, alternarTorneo: alternarTorneoAviso }
}
