import { useEffect, useRef, useState } from 'react'

// En el celular, al salir de la página (WhatsApp, copiar un link, otra app) y
// volver, el navegador muchas veces RECARGA la página desde cero: todo lo que
// estaba solo en memoria (qué torneo estaba filtrado, qué jornada estaba
// abierta, hasta dónde se había bajado) se pierde y la persona tiene que
// volver a buscar. Estos hooks guardan ese "dónde estaba" en el propio
// navegador y lo restauran solos al volver.
//
// Es SOLO estado de pantalla (filtros, pestañas, secciones abiertas, scroll):
// nada de datos del negocio. Caduca a las 12 h para que no reviva una
// pantalla de ayer. Si el navegador no deja guardar, todo funciona igual,
// simplemente sin recordar.
const TTL_MS = 12 * 60 * 60 * 1000

function leer(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const o = JSON.parse(raw)
    if (o && typeof o.t === 'number' && Date.now() - o.t < TTL_MS) return o.v
  } catch (e) {}
  return undefined
}

// Igual que useState, pero recuerda el valor entre recargas.
//   const [filtro, setFiltro] = useEstadoUI('gm_ui_calendario_filtro', 'todos')
export function useEstadoUI(key, inicial) {
  const [valor, setValor] = useState(() => {
    const guardado = leer(key)
    if (guardado !== undefined) return guardado
    return typeof inicial === 'function' ? inicial() : inicial
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ v: valor, t: Date.now() })) } catch (e) {}
  }, [key, valor])
  return [valor, setValor]
}

// Recuerda hasta dónde se había bajado la página y vuelve ahí cuando el
// contenido ya cargó (`listo` pasa a true). Usar con la clave de la pantalla.
export function useRestaurarScroll(key, listo) {
  const restaurado = useRef(false)

  // Guarda la posición mientras se desplaza (y al salir de la página).
  useEffect(() => {
    let timer = null
    function guardar() {
      if (!restaurado.current) return // no pisar lo guardado antes de haber restaurado
      try { localStorage.setItem(key, JSON.stringify({ v: window.scrollY, t: Date.now() })) } catch (e) {}
    }
    function alScroll() { clearTimeout(timer); timer = setTimeout(guardar, 150) }
    window.addEventListener('scroll', alScroll, { passive: true })
    window.addEventListener('pagehide', guardar)
    document.addEventListener('visibilitychange', guardar)
    return () => {
      clearTimeout(timer)
      guardar()
      window.removeEventListener('scroll', alScroll)
      window.removeEventListener('pagehide', guardar)
      document.removeEventListener('visibilitychange', guardar)
    }
  }, [key])

  // Restaura una sola vez, cuando ya hay contenido (la altura de la página
  // puede tardar un instante en estar completa, por eso se reintenta un poco).
  useEffect(() => {
    if (!listo || restaurado.current) return
    const destino = leer(key)
    if (typeof destino !== 'number' || destino <= 0) { restaurado.current = true; return }
    let intentos = 0
    function intentar() {
      window.scrollTo(0, destino)
      intentos++
      if (Math.abs(window.scrollY - destino) > 4 && intentos < 8) setTimeout(intentar, 120)
      else restaurado.current = true
    }
    requestAnimationFrame(intentar)
  }, [key, listo])
}

// Borra lo recordado de una pantalla (por si hace falta "empezar de cero").
export function olvidarEstadoUI(...keys) {
  keys.forEach(k => { try { localStorage.removeItem(k) } catch (e) {} })
}
