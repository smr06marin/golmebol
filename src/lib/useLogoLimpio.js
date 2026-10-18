import { useEffect, useState } from 'react'
import { logoLimpioDesdeUrl, logoLimpioListo } from './logoTransparente'

// Devuelve la versión del logo lista para dibujarse sobre un flyer:
//   undefined → todavía se está procesando
//   null      → usar la imagen original (no se pudo / no hizo falta limpiar)
//   string    → URL de la imagen con fondo transparente
export function useLogoLimpio(url) {
  const [res, setRes] = useState({ url: null, src: undefined })
  useEffect(() => {
    if (!url) return undefined
    let vivo = true
    logoLimpioDesdeUrl(url).then(src => { if (vivo) setRes({ url, src }) })
    return () => { vivo = false }
  }, [url])
  if (!url) return null
  return res.url === url ? res.src : logoLimpioListo(url)
}
