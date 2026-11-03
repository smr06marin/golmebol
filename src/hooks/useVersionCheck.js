import { useEffect, useRef, useState } from 'react'
import { hayAlgunaPlanillaAbierta } from '../lib/cierreAutomatico'

// ACTUALIZACIÓN AUTOMÁTICA DE LA APP (celular y escritorio, incluida la app instalada).
// Cada vez que se publica una versión nueva, quien ya tiene Golmebol abierta se quedaba con la vieja hasta que
// recargara a mano (en escritorio una app instalada puede pasar días abierta). Ahora:
//  · se revisa cada minuto, y también al volver a la ventana (foco / pestaña visible / internet de vuelta);
//  · al detectar una versión nueva, si la ventana está oculta o la persona acaba de volver, se recarga SOLA;
//  · si la está mirando, sale el aviso con cuenta regresiva de 15 s (con botón "Después" por si está viendo algo);
//  · NUNCA se recarga sola con una planilla abierta, en /arbitro, en /admin (formularios) ni escribiendo en un
//    campo: ahí solo sale el aviso para que la persona toque cuando quiera.
const REVISAR_CADA_MS = 60 * 1000
const CUENTA_SEG = 15
const POSPONER_MS = 10 * 60 * 1000
const MIN_ENTRE_RECARGAS_MS = 2 * 60 * 1000 // por si el servidor sirviera la página vieja: nunca en bucle

function recargar() {
  try {
    const ultima = Number(sessionStorage.getItem('golmebol_ultima_auto_recarga') || 0)
    if (Date.now() - ultima < MIN_ENTRE_RECARGAS_MS) return
    sessionStorage.setItem('golmebol_ultima_auto_recarga', String(Date.now()))
  } catch { /* sin sessionStorage: se recarga igual */ }
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('_v', Date.now().toString()) // dirección distinta → el navegador va al servidor, no al caché
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}

function esSeguroRecargar() {
  if (hayAlgunaPlanillaAbierta()) return false
  const ruta = window.location.pathname
  if (ruta.startsWith('/arbitro') || ruta.startsWith('/admin')) return false
  const el = document.activeElement
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return false
  return true
}

export function useVersionCheck() {
  const [hayNueva, setHayNueva] = useState(false)
  const [segundos, setSegundos] = useState(null) // cuenta regresiva visible (null = sin cuenta)
  const scriptActualRef = useRef(null)
  const hayNuevaRef = useRef(false)
  const pospuestoHastaRef = useRef(0)

  useEffect(() => {
    const actual = document.querySelector('script[type="module"][src*="/assets/"]')
    scriptActualRef.current = actual?.getAttribute('src') || null
  }, [])

  // Detección: cada minuto y al volver a la ventana
  useEffect(() => {
    let cancelado = false
    async function revisar(alVolver) {
      if (cancelado || !scriptActualRef.current) return
      if (hayNuevaRef.current) {
        if (alVolver && esSeguroRecargar() && Date.now() >= pospuestoHastaRef.current) recargar()
        return
      }
      try {
        const res = await fetch('/', { cache: 'no-store' })
        const html = await res.text()
        const match = html.match(/<script[^>]*type="module"[^>]*src="(\/assets\/[^"]+\.js)"/)
        if (cancelado || !match || !match[1] || match[1] === scriptActualRef.current) return
        hayNuevaRef.current = true
        setHayNueva(true)
        if ((document.hidden || alVolver) && esSeguroRecargar()) recargar()
      } catch { /* sin internet: se vuelve a intentar */ }
    }
    const id = setInterval(() => revisar(false), REVISAR_CADA_MS)
    const alVolver = () => { if (!document.hidden) revisar(true) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    window.addEventListener('online', alVolver)
    const primero = setTimeout(() => revisar(false), 15000) // una revisión pronto tras abrir
    return () => {
      cancelado = true
      clearInterval(id); clearTimeout(primero)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
      window.removeEventListener('online', alVolver)
    }
  }, [])

  // Ya hay versión nueva: recargar sola si es seguro (oculta: de una; visible: cuenta regresiva)
  useEffect(() => {
    if (!hayNueva) return undefined
    let cuenta = null
    const id = setInterval(() => {
      if (Date.now() < pospuestoHastaRef.current || !esSeguroRecargar()) { cuenta = null; setSegundos(null); return }
      if (document.hidden) { recargar(); return }
      cuenta = cuenta === null ? CUENTA_SEG : cuenta - 1
      setSegundos(Math.max(cuenta, 0))
      if (cuenta <= 0) recargar()
    }, 1000)
    return () => clearInterval(id)
  }, [hayNueva])

  function posponer() {
    pospuestoHastaRef.current = Date.now() + POSPONER_MS
    setSegundos(null)
  }

  return { hayNueva, segundos, posponer }
}
