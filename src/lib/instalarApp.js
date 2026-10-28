// Guía para instalar Golmebol en el celular (web instalable / PWA).
// Sabe qué celular y qué navegador es, si ya está instalada y si el navegador permite instalar con un solo toque.
import { Capacitor } from '@capacitor/core'

const K_CERRADO = 'gm_instalar_cerrado_visita'  // cerró el aviso: no vuelve a salir en ESTA visita (al volver a entrar sale otra vez)
const VIEJAS = ['gm_app_instalada', 'gm_instalar_cerrado']  // claves de la versión anterior, ya no se usan

let promptDiferido = null
const escuchas = new Set()
const avisar = () => escuchas.forEach(f => { try { f() } catch { /* nada */ } })

function leerVisita(k) { try { return sessionStorage.getItem(k) } catch { return null } }
function guardarVisita(k, v) { try { sessionStorage.setItem(k, v) } catch { /* modo privado: no pasa nada */ } }

// Se llama una vez al arrancar la app: guarda el aviso de "instalar" que lanza Chrome en Android
// (sale solo, a veces antes de que se dibuje la pantalla) y detecta cuando ya quedó instalada.
let iniciado = false
export function iniciarInstalacion() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  try { VIEJAS.forEach(k => localStorage.removeItem(k)) } catch { /* nada */ }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptDiferido = e; avisar() })
  window.addEventListener('appinstalled', () => { promptDiferido = null; avisar() })
}

export function alCambiar(fn) { escuchas.add(fn); return () => escuchas.delete(fn) }
export const puedeInstalarDirecto = () => !!promptDiferido

export async function instalarDirecto() {
  if (!promptDiferido) return false
  try {
    promptDiferido.prompt()
    const r = await promptDiferido.userChoice
    promptDiferido = null
    if (r?.outcome === 'accepted') { avisar(); return true }
  } catch { /* el navegador no dejó */ }
  avisar()
  return false
}

export function posponer() { guardarVisita(K_CERRADO, '1'); avisar() }
export const fuePospuesta = () => leerVisita(K_CERRADO) === '1'

// "Instalada" = se está abriendo DESDE la app (pantalla de inicio / app nativa). Abierta en el navegador, el aviso siempre sale.
export function estaInstalada() {
  try { if (Capacitor.isNativePlatform()) return true } catch { /* nada */ }
  try {
    return !!(window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || window.navigator.standalone === true)
  } catch { return false }
}

// Copia el enlace de Golmebol (para pegarlo en Safari)
export async function copiarEnlace() {
  const url = 'https://golmebol.com'
  try { await navigator.clipboard.writeText(url); return true } catch { /* sigue abajo */ }
  try {
    const t = document.createElement('textarea'); t.value = url; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); document.body.removeChild(t)
    return !!ok
  } catch { return false }
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
    // Así se instala en el iPhone (Safari), grabado en un iPhone real: ⋯ → Compartir → Ver más → Agregar a Inicio → Agregar
    const pasosSafari = [
      { escena: { tipo: 'safari-barra', objetivo: 'puntos' }, titulo: 'Toca los tres puntitos ⋯', texto: 'Están abajo a la derecha, al lado de golmebol.com. (Si en tu iPhone ves abajo el cuadrito con la flecha ↑, toca ese y pasa al paso 3.)' },
      { escena: { tipo: 'menu', filas: ['Compartir', 'Agregar a Marcadores', 'Agregar marcador a…', 'Nueva pestaña'], objetivo: 0 }, titulo: 'Toca «Compartir»', texto: 'Es la primera opción de la lista, arriba.' },
      { escena: { tipo: 'hoja-compartir' }, titulo: 'Toca «Ver más»', texto: 'Está a la derecha, debajo de WhatsApp. Si ya ves «Agregar a Inicio», pasa al paso 4.' },
      { escena: { tipo: 'menu', filas: ['Agregar marcador a…', 'Agregar a Favoritos', 'Agregar a nota rápida', 'Buscar en la página', 'Agregar a Inicio'], objetivo: 4 }, titulo: 'Toca «Agregar a Inicio»', texto: 'Si no la ves, desliza la lista hacia arriba con el dedo. En algunos iPhone dice «Agregar a pantalla de inicio».' },
      { escena: { tipo: 'dialogo-ios', boton: 'Agregar' }, titulo: 'Toca «Agregar»', texto: 'Es el botón azul de arriba a la derecha. Deja prendido «Abrir como app web».' },
      { escena: { tipo: 'inicio' }, titulo: 'Listo: busca el ícono de Golmebol', texto: 'Aparece al final de tus apps, en la pantalla de inicio. Ábrela siempre desde ahí.' },
    ]
    if (d.navegador === 'safari') return { titulo: 'iPhone · Safari', pasos: pasosSafari }
    // En iPhone la app SOLO se instala desde Safari: si está en otro navegador (Chrome, Firefox, el de WhatsApp…) primero hay que pasarse a Safari
    return {
      titulo: 'iPhone · hay que usar Safari',
      pasos: [
        { escena: { tipo: 'safari-inicio' }, titulo: 'En iPhone se instala desde Safari', texto: 'Safari es el navegador azul con una brújula que ya trae tu iPhone. Búscalo y ábrelo.' },
        { escena: { tipo: 'copiar' }, accion: 'copiar', titulo: 'Copia el enlace de Golmebol', texto: 'Toca el botón de abajo. Después lo pegas en Safari.' },
        { escena: { tipo: 'safari-barra', objetivo: 'direccion' }, titulo: 'En Safari, pega el enlace y entra', texto: 'Toca la barra de abajo, mantén el dedo, elige «Pegar y buscar». Cuando cargue Golmebol, esta guía te sigue explicando.' },
        ...pasosSafari,
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
