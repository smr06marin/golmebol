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

// Pasos según el celular. Cada paso trae un "escena": el dibujo de la pantalla con la flecha que señala dónde tocar.
//   barra-abajo  { iconos:[...], objetivo:n }   barra de botones abajo (Safari, Samsung, Edge)
//   barra-arriba { objetivo:'compartir'|'puntos-v'|'puntos-h' }   dirección arriba con su botón a la derecha
//   menu         { filas:[...], objetivo:n }    lista del menú con una fila señalada
//   dialogo-ios / dialogo-android { boton:'Agregar' }
//   inicio       pantalla de inicio con el ícono de Golmebol
//   icono        { nombre }   dibujo grande sin flecha (copiar enlace, abrir otra app…)
export function pasosParaInstalar(d, directo) {
  const inicio = { escena: { tipo: 'inicio' }, titulo: 'Listo: busca el ícono de Golmebol', texto: 'Ya está en tu pantalla, como cualquier otra app. Ábrela siempre desde ahí.' }
  if (d.enApp) {
    return {
      titulo: d.esIOS ? 'iPhone · navegador de otra app' : 'Android · navegador de otra app',
      pasos: [
        { escena: { tipo: 'barra-arriba', objetivo: d.esIOS ? 'puntos-h' : 'puntos-v' }, titulo: 'Toca los tres puntitos', texto: 'Están arriba o abajo de esta pantalla.' },
        { escena: { tipo: 'menu', filas: ['Copiar enlace', d.esIOS ? 'Abrir en Safari' : 'Abrir en Chrome', 'Compartir'], objetivo: 1 }, titulo: d.esIOS ? 'Toca «Abrir en Safari»' : 'Toca «Abrir en Chrome»', texto: 'Ahora estás dentro de otra app (WhatsApp, Instagram…). Ahí no se puede instalar. Si dice «Abrir en el navegador», toca esa.' },
        { escena: { tipo: 'icono', nombre: 'celular' }, titulo: 'Vuelve a tocar «Ver cómo»', texto: 'Cuando se abra en tu navegador, esta guía sale otra vez.' },
      ],
    }
  }
  if (d.esIOS) {
    if (d.navegador === 'firefox-ios' || d.navegador === 'opera-ios') {
      return {
        titulo: 'iPhone · ' + (d.navegador === 'firefox-ios' ? 'Firefox' : 'Opera'),
        pasos: [
          { escena: { tipo: 'icono', nombre: 'copiar' }, titulo: 'Copia el enlace golmebol.com', texto: 'En este navegador no se puede instalar.' },
          { escena: { tipo: 'icono', nombre: 'safari' }, titulo: 'Ábrelo en Safari', texto: 'Safari es el navegador azul con una brújula. Pega el enlace y entra.' },
          { escena: { tipo: 'icono', nombre: 'celular' }, titulo: 'Vuelve a tocar «Ver cómo»', texto: 'Ya en Safari, esta guía te muestra los pasos.' },
        ],
      }
    }
    const esSafari = d.navegador === 'safari'
    return {
      titulo: 'iPhone · ' + (esSafari ? 'Safari' : d.navegador === 'chrome-ios' ? 'Chrome' : 'Edge'),
      pasos: [
        esSafari
          ? { escena: { tipo: 'barra-abajo', iconos: ['atras', 'adelante', 'compartir', 'libro', 'pestanas'], objetivo: 2 }, titulo: 'Toca el botón «Compartir»', texto: 'Es el cuadrito con una flecha hacia arriba. Si solo ves tres puntos (⋯), tócalos y luego «Compartir».' }
          : { escena: { tipo: 'barra-arriba', objetivo: 'compartir' }, titulo: 'Toca el botón «Compartir»', texto: 'Es el cuadrito con una flecha hacia arriba, arriba a la derecha. Si no lo ves, abre golmebol.com en Safari.' },
        { escena: { tipo: 'menu', filas: ['Copiar', 'Agregar a marcadores', 'Agregar a pantalla de inicio', 'Buscar en la página'], objetivo: 2 }, titulo: 'Toca «Agregar a pantalla de inicio»', texto: 'Desliza el menú hacia abajo con el dedo hasta verla.' },
        { escena: { tipo: 'dialogo-ios', boton: 'Agregar' }, titulo: 'Toca «Agregar»', texto: 'Está arriba a la derecha.' },
        inicio,
      ],
    }
  }
  // Android
  const n = d.navegador
  const dialogoInstalar = (boton) => ({ escena: { tipo: 'dialogo-android', boton }, titulo: `Toca «${boton}»`, texto: 'Se pone el ícono de Golmebol en tu pantalla.' })
  if (n === 'samsung') {
    return { titulo: 'Android · Samsung Internet', pasos: [
      { escena: { tipo: 'barra-abajo', iconos: ['atras', 'adelante', 'inicio', 'libro', 'menu'], objetivo: 4 }, titulo: 'Toca las tres rayitas ☰', texto: 'Están abajo a la derecha.' },
      { escena: { tipo: 'menu', filas: ['Descargas', 'Historial', 'Agregar página a', 'Compartir'], objetivo: 2 }, titulo: 'Toca «Agregar página a»', texto: 'Si ves «Instalar aplicación», toca esa y listo.' },
      { escena: { tipo: 'menu', filas: ['Marcadores', 'Pantalla de inicio', 'Página guardada'], objetivo: 1 }, titulo: 'Toca «Pantalla de inicio»', texto: '' },
      dialogoInstalar('Agregar'),
      inicio,
    ] }
  }
  if (n === 'firefox') {
    return { titulo: 'Android · Firefox', pasos: [
      { escena: { tipo: 'barra-arriba', objetivo: 'puntos-v' }, titulo: 'Toca los tres puntitos ⋮', texto: 'Están arriba o abajo a la derecha.' },
      { escena: { tipo: 'menu', filas: ['Nueva pestaña', 'Instalar', 'Compartir'], objetivo: 1 }, titulo: 'Toca «Instalar»', texto: 'Si no aparece, busca «Agregar a la pantalla de inicio».' },
      dialogoInstalar('Agregar'),
      inicio,
    ] }
  }
  if (n === 'edge') {
    return { titulo: 'Android · Edge', pasos: [
      { escena: { tipo: 'barra-abajo', iconos: ['atras', 'adelante', 'mas', 'pestanas', 'puntos-h'], objetivo: 4 }, titulo: 'Toca los tres puntitos ⋯', texto: 'Están abajo a la derecha.' },
      { escena: { tipo: 'menu', filas: ['Nueva pestaña', 'Agregar al teléfono', 'Compartir'], objetivo: 1 }, titulo: 'Toca «Agregar al teléfono»', texto: 'Si no aparece, busca «Agregar a pantalla de inicio».' },
      dialogoInstalar('Agregar'),
      inicio,
    ] }
  }
  if (n === 'chrome') {
    return { titulo: 'Android · Chrome', directo, pasos: [
      { escena: { tipo: 'barra-arriba', objetivo: 'puntos-v' }, titulo: 'Toca los tres puntitos ⋮', texto: 'Están arriba a la derecha.' },
      { escena: { tipo: 'menu', filas: ['Nueva pestaña', 'Historial', 'Instalar aplicación', 'Compartir…'], objetivo: 2 }, titulo: 'Toca «Instalar aplicación»', texto: 'En algunos celulares dice «Agregar a la pantalla principal».' },
      dialogoInstalar('Instalar'),
      inicio,
    ] }
  }
  return { titulo: 'Android', pasos: [
    { escena: { tipo: 'barra-arriba', objetivo: 'puntos-v' }, titulo: 'Toca los tres puntitos', texto: 'Están arriba o abajo del navegador (⋮ o ⋯ o ☰).' },
    { escena: { tipo: 'menu', filas: ['Nueva pestaña', 'Historial', 'Agregar a pantalla de inicio', 'Compartir'], objetivo: 2 }, titulo: 'Toca «Agregar a pantalla de inicio»', texto: 'Si no ves esa opción, abre golmebol.com en Chrome: ahí siempre aparece.' },
    dialogoInstalar('Agregar'),
    inicio,
  ] }
}
