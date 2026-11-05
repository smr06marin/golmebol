// Avisos del chat de ayuda en el navegador / app instalada (Web Push).
// Cuando soporte responde, al organizador le llega una notificación del sistema aunque
// tenga la pestaña cerrada. Cada navegador guarda su "suscripción" en el servidor.
// Estados: 'no-disponible' | 'falta-instalar' (iPhone sin instalar) | 'bloqueado' | 'pendiente' | 'activo'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { apiUrl } from './apiBase'
import { estaInstalada } from './instalarApp'

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY

const esIphone = () => {
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function aBytes(b64) {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4)
  const base = (b64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(base)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

function soportado() {
  try {
    return !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  } catch { return false }
}

async function llamarServidor(metodo, cuerpo) {
  const { data: s } = await supabase.auth.getSession()
  const r = await fetch(apiUrl('/api/soporte-push'), {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.session?.access_token || ''}` },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error('No se pudo guardar el aviso')
}

async function suscribir() {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const opciones = { userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }
    try { sub = await reg.pushManager.subscribe(opciones) } catch {
      // Suscripción vieja hecha con otra clave: se renueva
      const vieja = await reg.pushManager.getSubscription()
      if (vieja) await vieja.unsubscribe()
      sub = await reg.pushManager.subscribe(opciones)
    }
  }
  await llamarServidor('POST', sub.toJSON())
}

// Dice en qué estado está este navegador y, si ya estaba activo, renueva la suscripción en silencio.
export async function estadoAvisos() {
  try {
    if (!CLAVE_PUBLICA) return 'no-disponible'
    if (!soportado()) return esIphone() && !estaInstalada() ? 'falta-instalar' : 'no-disponible'
    if (Notification.permission === 'denied') return 'bloqueado'
    if (Notification.permission !== 'granted') return 'pendiente'
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return 'pendiente'
    suscribir().catch(() => {})
    return 'activo'
  } catch { return 'no-disponible' }
}

// Hay que llamarla desde un toque del usuario (iPhone lo exige).
export async function activarAvisos() {
  try {
    const permiso = await Notification.requestPermission()
    if (permiso === 'denied') return 'bloqueado'
    if (permiso !== 'granted') return 'pendiente'
    await suscribir()
    return 'activo'
  } catch { return 'error' }
}

export async function desactivarAvisos() {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await llamarServidor('DELETE', { endpoint: sub.endpoint }).catch(() => {})
      await sub.unsubscribe()
    }
  } catch { /* nada */ }
  return 'pendiente'
}
