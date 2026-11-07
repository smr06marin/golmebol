// Notificaciones push de Golmebol: app nativa (Android / iPhone, Firebase) Y navegador / app instalada (Web Push).
// En iPhone el navegador solo permite avisos si Golmebol está instalada en la pantalla de inicio (regla de Apple).
//
// Cómo funciona:
//  1. La persona toca "Activar avisos" -> se pide el permiso del sistema y se obtiene un "token" de ese celular
//     (app nativa: token de Firebase · navegador: la suscripción Web Push, con la misma clave VAPID del chat de ayuda).
//  2. Ese token se guarda en Supabase (registrar_push) junto con los equipos que
//     sigue (la estrella, ver favoritos.js) y los torneos que activó aquí.
//     Es anónimo: no se guarda cédula, correo ni nombre.
//  3. El servidor (api/push-enviar.js) manda los avisos a los celulares que siguen
//     ese equipo o ese torneo. Entre 10 pm y 10 am no se envía nada: sale a las 10 am.
import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { notify } from './notify'
import { leerFavoritosIds, EVENTO_FAVORITOS, EVENTO_EQUIPO_SEGUIDO } from './favoritos'
import { EVENTO_TORNEO_SEGUIDO } from './favoritosTorneos'
import { mensajeMotivo } from './avisosTextos'
import { estaInstalada } from './instalarApp'

const K_ACTIVO = 'gm_avisos_activo'
const K_TOKEN = 'gm_push_token'
const K_TORNEOS = 'gm_avisos_torneos'
const EVENTO = 'gm-avisos'
const memoria = {}
const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY

const esNativo = () => { try { return Capacitor.isNativePlatform() } catch { return false } }
const esIphone = () => {
  try {
    const ua = navigator.userAgent || ''
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  } catch { return false }
}
const webSoportado = () => {
  try { return !esNativo() && !!CLAVE_PUBLICA && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window } catch { return false }
}
function aBytes(b64) {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

// Dónde está la persona: 'nativo' (app) · 'web' (navegador o app instalada) · 'falta_instalar' (iPhone sin instalar) · 'no_disponible'
export function plataformaAvisos() {
  if (esNativo()) return 'nativo'
  if (webSoportado()) return 'web'
  if (esIphone() && !estaInstalada()) return 'falta_instalar'
  return 'no_disponible'
}

async function suscribirWeb() {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const opciones = { userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }
    try { sub = await reg.pushManager.subscribe(opciones) } catch {
      const vieja = await reg.pushManager.getSubscription() // suscripción hecha con otra clave: se renueva
      if (vieja) await vieja.unsubscribe()
      sub = await reg.pushManager.subscribe(opciones)
    }
  }
  return sub
}
async function suscripcionWebActual() {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    return (await reg?.pushManager.getSubscription()) || null
  } catch { return null }
}

// El botón de avisos se muestra siempre; si el navegador no puede, la hoja explica por qué.
export const avisosDisponibles = () => true

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
// Devuelve { ok, error }: antes los fallos se tragaban en silencio y la app decía "AVISOS ACTIVADOS" aunque el celular
// nunca hubiera quedado registrado (por eso podían no llegar avisos). Ahora se sabe si de verdad quedó guardado.
export let ultimoErrorRegistro = ''
export async function sincronizarAvisos() {
  const falla = (error) => { ultimoErrorRegistro = String(error || '').slice(0, 200); return { ok: false, error: ultimoErrorRegistro } }
  if (!avisosActivos()) return falla('inactivo')
  if (!esNativo()) {
    if (!webSoportado()) return falla('navegador sin soporte')
    const sub = await suscripcionWebActual()
    const j = sub?.toJSON?.()
    if (!j?.endpoint || !j.keys?.p256dh || !j.keys?.auth) return falla('sin suscripción del navegador')
    try {
      const { error } = await supabase.rpc('registrar_push_web', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_equipos: leerFavoritosIds(), p_torneos: torneosConAviso() })
      if (error) return falla(error.message || error.code || 'error del servidor')
    } catch (e) { return falla(e?.message || 'sin internet') } // se reintenta en el próximo cambio o al abrir la app
    ultimoErrorRegistro = ''
    return { ok: true }
  }
  const token = leer(K_TOKEN, null)
  if (!token) return falla('sin token del celular')
  try {
    const { error } = await supabase.rpc('registrar_push', {
      p_token: token,
      p_plataforma: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
      p_equipos: leerFavoritosIds(),
      p_torneos: torneosConAviso(),
    })
    if (error) return falla(error.message || error.code || 'error del servidor')
  } catch (e) { return falla(e?.message || 'sin internet') } // se reintenta en el próximo cambio o al abrir la app
  ultimoErrorRegistro = ''
  return { ok: true }
}

// Manda una notificación de prueba a ESTE celular (api/_pushProbar.js) y devuelve qué encontró el servidor.
// Primero vuelve a registrar el celular, para que la prueba sea con lo que de verdad está guardado.
export async function probarAvisos() {
  const reg = await sincronizarAvisos()
  const token = esNativo() ? leer(K_TOKEN, null) : (await suscripcionWebActual())?.endpoint
  if (!token) return { error: 'sin_token', registroError: reg.error }
  try {
    const url = esNativo() ? 'https://golmebol.com/api/push-enviar?accion=probar' : '/api/push-enviar?accion=probar'
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok && !j.registrado && !j.error) return { error: 'servidor', registroError: reg.error }
    return { ...j, registroError: reg.ok ? '' : reg.error }
  } catch {
    return { error: 'red', registroError: reg.error }
  }
}

let iniciado = false
let temporizador = null
const sincronizarPronto = () => { clearTimeout(temporizador); temporizador = setTimeout(sincronizarAvisos, 800) }

// Al tocar «Seguir» en un equipo o un torneo, los avisos se activan solos para ese equipo / torneo: si el celular
// todavía no los tenía, se pide el permiso en ese mismo toque. Si no se puede (permiso bloqueado, iPhone sin instalar
// la app, navegador sin soporte) el seguimiento queda igual y se explica por qué, una sola vez por visita.
let motivoYaMostrado = false
async function asegurarAvisos() {
  if (avisosActivos()) return true
  const r = await activarAvisos()
  if (r.ok) return true
  if (!motivoYaMostrado) { motivoYaMostrado = true; notify(mensajeMotivo(r.motivo, plataformaAvisos()), 'error') }
  return false
}
async function alSeguirEquipo() {
  const eraActivo = avisosActivos()
  if (!(await asegurarAvisos())) return
  sincronizarAvisos()
  notify(eraActivo ? 'Listo: te avisaremos de los partidos de este equipo.' : 'Avisos activados: te avisaremos de los partidos de este equipo.')
}
async function alSeguirTorneo(ev) {
  const { id, seguido } = ev.detail || {}
  if (!id) return
  if (!seguido) { if (torneosConAviso().includes(id)) alternarTorneoAviso(id); return }
  const eraActivo = avisosActivos()
  if (!(await asegurarAvisos())) return
  if (!torneosConAviso().includes(id)) alternarTorneoAviso(id)
  notify(eraActivo ? 'Listo: te avisaremos de lo que pase en este torneo.' : 'Avisos activados: te avisaremos de lo que pase en este torneo.')
}

// Se llama una vez al abrir la app (main.jsx). Deja listos los oyentes y, si ya
// estaban activados, renueva el token (Firebase puede cambiarlo).
export async function iniciarAvisos() {
  if (iniciado) return
  iniciado = true
  window.addEventListener(EVENTO_EQUIPO_SEGUIDO, alSeguirEquipo)
  window.addEventListener(EVENTO_TORNEO_SEGUIDO, alSeguirTorneo)
  if (!esNativo()) {
    // Navegador / app instalada: deja lista la sincronización y, si ya estaban activados, renueva la suscripción en silencio
    window.addEventListener(EVENTO_FAVORITOS, sincronizarPronto)
    try {
      navigator.serviceWorker?.addEventListener('message', ev => {
        const m = ev.data
        if (m?.tipo === 'aviso-torneo') notify([m.titulo, m.cuerpo].filter(Boolean).join(' — '))
      })
    } catch { /* ignorar */ }
    if (avisosActivos() && webSoportado()) {
      try {
        if (Notification.permission === 'granted') { await suscribirWeb(); sincronizarAvisos() }
        else if (Notification.permission === 'denied') escribir(K_ACTIVO, false)
      } catch { /* se reintenta en la próxima visita */ }
    }
    return
  }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.addListener('registration', async t => {
      escribir(K_TOKEN, t.value)
      const reg = await sincronizarAvisos()
      if (!reg.ok && reg.error !== 'inactivo') notify('Los avisos quedaron a medias: no se pudo registrar tu celular en Golmebol. Abre Avisos y toca «Enviarme una prueba».', 'error')
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
  if (!esNativo()) {
    const donde = plataformaAvisos()
    if (donde !== 'web') return { ok: false, motivo: donde }
    try {
      let perm = Notification.permission
      if (perm === 'denied') return { ok: false, motivo: 'permiso' }
      if (perm === 'default') perm = await Notification.requestPermission()
      if (perm !== 'granted') return { ok: false, motivo: 'permiso' }
      const sub = await suscribirWeb()
      escribir(K_TOKEN, sub.endpoint)
      escribir(K_ACTIVO, true)
      const reg = await sincronizarAvisos()
      // Si el celular no quedó registrado en Golmebol, NO se deja "activado": no llegaría ningún aviso.
      if (!reg.ok) { escribir(K_ACTIVO, false); return { ok: false, motivo: 'registro', detalle: reg.error } }
      return { ok: true }
    } catch {
      return { ok: false, motivo: 'error' }
    }
  }
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
  const token = leer(K_TOKEN, null) || (esNativo() ? null : (await suscripcionWebActual())?.endpoint)
  if (token) { try { await supabase.rpc('baja_push', { p_token: token }) } catch { /* ignorar */ } }
}

// Botón "Activar avisos" de la página de un torneo: enciende los avisos (si hace falta) y deja ese torneo activado.
export async function activarAvisosDeTorneo(id) {
  if (!id) return { ok: false, motivo: 'error' }
  if (!avisosActivos()) { const r = await activarAvisos(); if (!r.ok) return r }
  if (!torneosConAviso().includes(id)) alternarTorneoAviso(id)
  return { ok: true }
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
