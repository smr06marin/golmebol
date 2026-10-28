// Guía para instalar Golmebol en el celular (web instalable / PWA).
// Sabe qué celular y qué navegador es, si ya está instalada y si el navegador permite instalar con un solo toque.
import { Capacitor } from '@capacitor/core'

const K_INSTALADA = 'gm_app_instalada'   // se guarda cuando ya la instaló (o dijo "ya la instalé")
const K_CERRADO = 'gm_instalar_cerrado'  // cuándo cerró el aviso con "Ahora no"
const DIAS_SIN_MOLESTAR = 3

let promptDiferido = null
const escuchas = new Set()
const avisar = () => escuchas.forEach(f => { try { f() } catch { /* nada */ } })

function leer(k) { try { return localStorage.getItem(k) } catch { return null } }
function guardar(k, v) { try { localStorage.setItem(k, v) } catch { /* modo privado: no pasa nada */ } }

// Se llama una vez al arrancar la app: guarda el aviso de "instalar" que lanza Chrome en Android
// (sale solo, a veces antes de que se dibuje la pantalla) y detecta cuando ya quedó instalada.
let iniciado = false
export function iniciarInstalacion() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptDiferido = e; avisar() })
  window.addEventListener('appinstalled', () => { guardar(K_INSTALADA, '1'); promptDiferido = null; avisar() })
}

export function alCambiar(fn) { escuchas.add(fn); return () => escuchas.delete(fn) }
export const puedeInstalarDirecto = () => !!promptDiferido

export async function instalarDirecto() {
  if (!promptDiferido) return false
  try {
    promptDiferido.prompt()
    const r = await promptDiferido.userChoice
    promptDiferido = null
    if (r?.outcome === 'accepted') { guardar(K_INSTALADA, '1'); avisar(); return true }
  } catch { /* el navegador no dejó */ }
  avisar()
  return false
}

export function marcarInstalada() { guardar(K_INSTALADA, '1'); avisar() }
export function posponer() { guardar(K_CERRADO, String(Date.now())); avisar() }

export function estaInstalada() {
  try { if (Capacitor.isNativePlatform()) return true } catch { /* nada */ }
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || window.navigator.standalone === true) {
      guardar(K_INSTALADA, '1')
      return true
    }
  } catch { /* nada */ }
  return leer(K_INSTALADA) === '1'
}

export function fuePospuesta() {
  const t = parseInt(leer(K_CERRADO) || '0', 10)
  return !!t && Date.now() - t < DIAS_SIN_MOLESTAR * 86400000
}

// Qué celular y qué navegador es
export function detectarDispositivo() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const esIOS = /iPhone|iPad|iPod/i.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const esAndroid = /Android/i.test(ua)
  const movil = esIOS || esAndroid
  // Navegador que viene dentro de WhatsApp, Instagram, Facebook, TikTok, etc.: ahí NO se puede instalar
  const enApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|TikTok|musical_ly|Snapchat|Line\/|MicroMessenger|Twitter|; wv\)/i.test(ua)
  let navegador = 'otro'
  if (esIOS) {
    if (/CriOS/i.test(ua)) navegador = 'chrome-ios'
    else if (/EdgiOS/i.test(ua)) navegador = 'edge-ios'
    else if (/FxiOS/i.test(ua)) navegador = 'firefox-ios'
    else if (/OPiOS|OPT\//i.test(ua)) navegador = 'opera-ios'
    else navegador = 'safari'
  } else if (esAndroid) {
    if (/SamsungBrowser/i.test(ua)) navegador = 'samsung'
    else if (/Firefox/i.test(ua)) navegador = 'firefox'
    else if (/EdgA/i.test(ua)) navegador = 'edge'
    else if (/OPR\/|Opera/i.test(ua)) navegador = 'opera'
    else if (/MiuiBrowser|XiaoMi/i.test(ua)) navegador = 'xiaomi'
    else if (/HeyTapBrowser|OppoBrowser|OPPO|VivoBrowser|HuaweiBrowser/i.test(ua)) navegador = 'otro-android'
    else if (/Chrome\//i.test(ua)) navegador = 'chrome'
    else navegador = 'otro-android'
  }
  return { esIOS, esAndroid, movil, enApp, navegador }
}

// Pasos según el celular. icono = nombre del dibujo que usa la guía.
export function pasosParaInstalar(d, directo) {
  if (d.enApp) {
    return {
      titulo: d.esIOS ? 'iPhone · navegador de otra app' : 'Android · navegador de otra app',
      pasos: [
        { icono: d.esIOS ? 'puntos-h' : 'puntos-v', titulo: 'Abre el menú de arriba', texto: 'Toca los tres puntos (⋯ o ⋮) que aparecen arriba o abajo en esta pantalla.' },
        { icono: 'externo', titulo: d.esIOS ? 'Toca «Abrir en Safari»' : 'Toca «Abrir en Chrome» o «Abrir en el navegador»', texto: 'Estás viendo Golmebol dentro de otra app (WhatsApp, Instagram, Facebook…). Aquí no se puede instalar: hay que abrirla en tu navegador.' },
        { icono: 'celular', titulo: 'Vuelve a tocar «Instalar»', texto: 'Cuando se abra en tu navegador, aparecerá otra vez esta guía con los pasos para instalarla.' },
      ],
    }
  }
  if (d.esIOS) {
    if (d.navegador === 'firefox-ios' || d.navegador === 'opera-ios') {
      return {
        titulo: 'iPhone · ' + (d.navegador === 'firefox-ios' ? 'Firefox' : 'Opera'),
        pasos: [
          { icono: 'copiar', titulo: 'Copia el enlace', texto: 'En este navegador no se puede instalar. Copia la dirección golmebol.com.' },
          { icono: 'safari', titulo: 'Ábrelo en Safari', texto: 'Abre Safari (el navegador azul con la brújula), pega el enlace y entra.' },
          { icono: 'celular', titulo: 'Sigue la guía de Safari', texto: 'Ya en Safari, vuelve a tocar «Instalar» y te muestra los pasos.' },
        ],
      }
    }
    const esSafari = d.navegador === 'safari'
    return {
      titulo: 'iPhone · ' + (esSafari ? 'Safari' : d.navegador === 'chrome-ios' ? 'Chrome' : 'Edge'),
      pasos: [
        { icono: 'compartir', titulo: 'Toca el botón «Compartir»', texto: esSafari ? 'Es el cuadro con una flecha hacia arriba, abajo en el centro. Si solo ves tres puntos (⋯), tócalos y busca «Compartir». En iPad está arriba a la derecha.' : 'Es el cuadro con una flecha hacia arriba, arriba a la derecha junto a la dirección. Si no lo ves, abre golmebol.com en Safari.' },
        { icono: 'agregar', titulo: 'Toca «Agregar a pantalla de inicio»', texto: 'Desliza el menú hacia abajo hasta verla. Si no aparece, toca «Ver más» al final de la lista.' },
        { icono: 'ok', titulo: 'Toca «Agregar»', texto: 'Está arriba a la derecha. Golmebol queda en tu pantalla como cualquier otra app: ábrela desde ahí.' },
      ],
    }
  }
  // Android
  const n = d.navegador
  const final = { icono: 'ok', titulo: 'Abre Golmebol desde tu pantalla', texto: 'Queda como cualquier otra app. Entra siempre desde ese ícono.' }
  if (n === 'samsung') {
    return { titulo: 'Android · Samsung Internet', pasos: [
      { icono: 'menu', titulo: 'Toca el menú ☰', texto: 'Son las tres rayitas, abajo a la derecha del navegador.' },
      { icono: 'agregar', titulo: 'Toca «Agregar página a» y luego «Pantalla de inicio»', texto: 'Si aparece «Instalar aplicación», tócala y listo.' },
      { icono: 'ok', titulo: 'Toca «Agregar»', texto: final.texto },
    ] }
  }
  if (n === 'firefox') {
    return { titulo: 'Android · Firefox', pasos: [
      { icono: 'puntos-v', titulo: 'Toca el menú ⋮', texto: 'Son los tres puntos, arriba o abajo a la derecha.' },
      { icono: 'descargar', titulo: 'Toca «Instalar»', texto: 'Si no aparece, busca «Agregar a la pantalla de inicio».' },
      final,
    ] }
  }
  if (n === 'edge') {
    return { titulo: 'Android · Edge', pasos: [
      { icono: 'puntos-h', titulo: 'Toca el menú ⋯', texto: 'Son los tres puntos, abajo en el centro.' },
      { icono: 'descargar', titulo: 'Toca «Agregar al teléfono»', texto: 'Si no aparece, busca «Agregar a pantalla de inicio».' },
      final,
    ] }
  }
  if (n === 'chrome') {
    return { titulo: 'Android · Chrome', pasos: [
      { icono: 'puntos-v', titulo: 'Toca el menú ⋮', texto: 'Son los tres puntos, arriba a la derecha de Chrome.' },
      { icono: 'descargar', titulo: 'Toca «Instalar aplicación»', texto: 'En algunos celulares dice «Agregar a la pantalla principal».' },
      { icono: 'ok', titulo: 'Toca «Instalar»', texto: final.texto },
    ] , directo }
  }
  return { titulo: 'Android', pasos: [
    { icono: 'puntos-v', titulo: 'Abre el menú del navegador', texto: 'Toca los tres puntos (⋮ o ⋯) o las tres rayitas (☰), arriba o abajo.' },
    { icono: 'agregar', titulo: 'Busca «Agregar a pantalla de inicio» o «Instalar»', texto: 'Si no ves esa opción, abre golmebol.com en Chrome: ahí siempre aparece.' },
    { icono: 'ok', titulo: 'Confirma con «Agregar»', texto: final.texto },
  ] }
}
