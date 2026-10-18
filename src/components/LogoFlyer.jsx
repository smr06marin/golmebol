import { useEffect, useState } from 'react'
import { logoLimpioDesdeUrl, logoLimpioListo } from '../lib/logoTransparente'

// Logo/escudo para los flyers. Si la imagen tiene fondo liso (blanco, por
// ejemplo) se le quita y se dibuja directo sobre el flyer, sin la caja blanca;
// si ya es transparente se dibuja tal cual. Si no se puede limpiar (fondo de
// foto, o el servidor de imágenes no permite leerla), cae a la caja blanca de
// siempre para que nunca se vea mal.
function useLogoLimpio(url) {
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

export default function LogoFlyer({ url, size, radio = 0, pad = 0 }) {
  const limpio = useLogoLimpio(url)
  const transparente = typeof limpio === 'string'
  return (
    <div style={{
      width: size, height: size, boxSizing: 'border-box', flexShrink: 0, padding: transparente ? Math.round(pad * 0.3) : pad,
      borderRadius: transparente ? '50%' : radio,
      background: transparente ? 'radial-gradient(circle, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 68%)' : '#fff',
    }}>
      <img src={transparente ? limpio : url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>
    </div>
  )
}
