// Guardado automático de borradores en TODA la app.
//
// Problema: en el celular, la persona está llenando un formulario, sale a
// WhatsApp a copiar un dato y, al volver, el navegador a veces RECARGA la
// página desde cero y lo escrito se pierde.
//
// Solución: mientras alguien escribe en cualquier campo (texto, número,
// teléfono, fecha, lista desplegable, casilla, cuadro de texto largo) se
// guarda un borrador en el propio celular. Si la página se recarga, cuando
// los mismos campos vuelven a aparecer en la misma pantalla se rellenan solos.
//
// Cuidados para no restaurar cosas viejas:
//  · el borrador se arma SIEMPRE desde lo que hay escrito en pantalla en ese
//    momento: si el formulario se cerró, se guardó o se vació, ese campo
//    desaparece del borrador;
//  · caduca a las 2 horas;
//  · cada campo se restaura una sola vez;
//  · nunca se guardan contraseñas, archivos ni campos marcados con
//    data-sin-borrador.
const CLAVE = 'gm_borradores_v1'
const TTL_MS = 2 * 60 * 60 * 1000
const RUTAS_EXCLUIDAS = [/^\/login/, /^\/jugador\/login/, /^\/planillar\//, /^\/reloj\//, /^\/overlay\//, /^\/en-vivo-control\//]
const TIPOS_EXCLUIDOS = new Set(['password', 'file', 'hidden', 'submit', 'button', 'reset', 'image', 'range', 'color', 'radio'])
const NOMBRES_EXCLUIDOS = /pass|clave|contrase|otp|codigo_sms|cvv|card|tarjeta_num/i

let iniciado = false
let pendiente = {}                 // { ruta: { t, campos: { clave: valor } } } leído al arrancar
const registrados = new Set()      // campos que la persona tocó (o que se restauraron)
const yaVistos = new WeakSet()     // campos ya evaluados para restaurar
let temporizador = null

function ruta() { return window.location.pathname }
function excluida() { return RUTAS_EXCLUIDAS.some(r => r.test(ruta())) }

function leerTodo() {
  try {
    const o = JSON.parse(localStorage.getItem(CLAVE) || '{}')
    const ahora = Date.now()
    const limpio = {}
    Object.keys(o).forEach(r => { if (o[r] && ahora - o[r].t < TTL_MS && o[r].campos) limpio[r] = o[r] })
    return limpio
  } catch { return {} }
}
function escribirTodo(o) {
  try {
    if (Object.keys(o).length === 0) localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, JSON.stringify(o))
  } catch { /* sin espacio o sin permiso: simplemente no se guarda */ }
}

function esCampo(el) {
  if (!el || !el.tagName) return false
  const tag = el.tagName
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false
  if (el.closest && el.closest('[data-sin-borrador]')) return false
  if (el.hasAttribute('data-sin-borrador') || el.readOnly || el.disabled) return false
  const tipo = (el.getAttribute('type') || 'text').toLowerCase()
  if (tag === 'INPUT' && TIPOS_EXCLUIDOS.has(tipo)) return false
  const ident = `${el.name || ''} ${el.id || ''} ${el.getAttribute('autocomplete') || ''}`
  if (NOMBRES_EXCLUIDOS.test(ident)) return false
  return true
}

function firma(el) {
  const tipo = el.tagName === 'INPUT' ? (el.getAttribute('type') || 'text').toLowerCase() : el.tagName.toLowerCase()
  const nombre = el.name || el.id || el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''
  return `${tipo}|${nombre}`
}

// Recorre todos los campos de la pantalla y les pone una clave estable:
// firma + número de orden entre los campos que tienen la misma firma.
function mapaDeClaves() {
  const conteo = {}
  const mapa = new Map()
  document.querySelectorAll('input,textarea,select').forEach(el => {
    if (!esCampo(el)) return
    const f = firma(el)
    conteo[f] = (conteo[f] || 0) + 1
    mapa.set(el, `${f}#${conteo[f]}`)
  })
  return mapa
}

function valorDe(el) {
  if (el.type === 'checkbox') return el.checked ? '1' : ''
  return el.value
}

function guardarAhora() {
  temporizador = null
  if (excluida()) return
  const r = ruta()
  const todo = leerTodo()
  const mapa = mapaDeClaves()
  const vivos = {}
  const clavesTocadas = new Set()
  registrados.forEach(el => {
    if (!el.isConnected) { registrados.delete(el); return }
    const k = mapa.get(el)
    if (!k) return
    clavesTocadas.add(k)
    const v = valorDe(el)
    if (v !== '' && v != null) vivos[k] = v
  })
  // Lo que todavía no se restauró (sigue "pendiente") no se pierde.
  const previos = (pendiente[r] && pendiente[r].campos) || {}
  const campos = {}
  Object.keys(previos).forEach(k => { if (!clavesTocadas.has(k)) campos[k] = previos[k] })
  Object.assign(campos, vivos)
  if (Object.keys(campos).length) todo[r] = { t: Date.now(), campos }
  else delete todo[r]
  escribirTodo(todo)
}

function programarGuardado(ms = 500) {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(guardarAhora, ms)
}

function ponerValor(el, valor) {
  try {
    if (el.type === 'checkbox') {
      const quiere = valor === '1'
      if (el.checked !== quiere) el.click()
      return
    }
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype
      : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, valor); else el.value = valor
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } catch { /* si un campo no deja, se sigue con los demás */ }
}

function restaurarEnPantalla() {
  if (excluida()) return
  const r = ruta()
  const p = pendiente[r]
  if (!p || !p.campos || !Object.keys(p.campos).length) return
  const mapa = mapaDeClaves()
  mapa.forEach((clave, el) => {
    if (yaVistos.has(el)) return
    yaVistos.add(el)
    if (!(clave in p.campos)) return
    if (document.activeElement === el) return // la persona está escribiendo ahí
    const valor = p.campos[clave]
    delete p.campos[clave] // cada campo se restaura una sola vez
    if (valorDe(el) === valor) { registrados.add(el); return }
    ponerValor(el, valor)
    registrados.add(el)
    // Si la pantalla termina de cargar sus datos y pisa lo restaurado
    // (campos que se llenan desde la base), se vuelve a poner — salvo que la
    // persona ya haya tocado ese campo.
    let tocado = false
    const marcar = e => { if (e.isTrusted) tocado = true }
    el.addEventListener('input', marcar, { once: true })
    let n = 0
    const iv = setInterval(() => {
      n++
      if (tocado || !el.isConnected || n > 10) { clearInterval(iv); return }
      if (valorDe(el) !== valor) ponerValor(el, valor)
    }, 300)
  })
  programarGuardado(800)
}

function alEscribir(e) {
  if (!e.isTrusted) return
  const el = e.target
  if (!esCampo(el)) return
  if (excluida()) return
  yaVistos.add(el)
  registrados.add(el)
  programarGuardado()
}

export function iniciarBorradores() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  pendiente = leerTodo()

  document.addEventListener('input', alEscribir, true)
  document.addEventListener('change', alEscribir, true)

  // El momento clave: justo al salir de la pestaña (WhatsApp, otra app).
  document.addEventListener('visibilitychange', () => { if (document.hidden) guardarAhora() })
  window.addEventListener('pagehide', guardarAhora)

  // Cada vez que aparecen campos nuevos (se abre un formulario, termina de
  // cargar la pantalla) se intenta restaurar; y si un formulario se cierra,
  // se actualiza el borrador para que no reviva.
  let rafPendiente = false
  const obs = new MutationObserver(() => {
    if (rafPendiente) return
    rafPendiente = true
    requestAnimationFrame(() => {
      rafPendiente = false
      restaurarEnPantalla()
      if (registrados.size) programarGuardado(700)
    })
  })
  const arrancar = () => {
    obs.observe(document.body, { childList: true, subtree: true })
    restaurarEnPantalla()
  }
  if (document.body) arrancar(); else window.addEventListener('DOMContentLoaded', arrancar)
}

// Borra todos los borradores (por si hace falta empezar de cero o al cerrar sesión).
export function olvidarBorradores() {
  pendiente = {}
  registrados.clear()
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}
