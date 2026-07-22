import { useEffect, useRef, useState } from 'react'

// En algunos celulares (sobre todo Xiaomi/Redmi con el navegador MIUI) el
// caché del teléfono a veces ignora los headers del servidor y se queda
// pegado días en una versión vieja de la app después de un despliegue nuevo
// — por eso a veces se ve rota, con diseños desactualizados o feos. Este
// hook revisa cada tanto (y cada vez que se vuelve a la pestaña, por ejemplo
// al salir de WhatsApp) si el archivo principal cambió en el servidor; si
// cambió, avisa para que la persona recargue con un toque.
export function useVersionCheck() {
  const [hayNueva, setHayNueva] = useState(false)
  const scriptActualRef = useRef(null)

  useEffect(() => {
    const actual = document.querySelector('script[type="module"][src*="/assets/"]')
    scriptActualRef.current = actual?.getAttribute('src') || null
  }, [])

  useEffect(() => {
    let cancelado = false
    async function revisar() {
      if (hayNueva || !scriptActualRef.current || cancelado) return
      try {
        const res = await fetch('/', { cache: 'no-store' })
        const html = await res.text()
        const match = html.match(/<script[^>]*type="module"[^>]*src="(\/assets\/[^"]+\.js)"/)
        if (match && match[1] && match[1] !== scriptActualRef.current) setHayNueva(true)
      } catch (e) {}
    }
    const id = setInterval(revisar, 120000) // cada 2 minutos
    function alVolver() { if (!document.hidden) revisar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { cancelado = true; clearInterval(id); document.removeEventListener('visibilitychange', alVolver) }
  }, [hayNueva])

  return hayNueva
}
