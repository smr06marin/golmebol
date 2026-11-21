import { useEffect, useState } from 'react'
import { urlImagenReducida, alFallarMini } from '../lib/imagenMini'
import { focoDeFoto } from '../lib/focoRostro'

// ── Foto del jugador encuadrada en la CARA ──────────────────────────────────
// Cada jugador sube la foto distinta (de lejos, de cuerpo entero, con la cara abajo o a un lado). Esta foto busca
// dónde está la cara (con el mismo detector de las tarjetas, ver focoRostro.js) y la acomoda para que quede centrada
// y de buen tamaño dentro del recuadro. Mientras se calcula —o si no encuentra cara— se ve con el encuadre de siempre.
// El resultado de cada foto queda guardado en el celular: la siguiente vez sale encuadrada al instante.
//
// ancho / alto: tamaño del recuadro en px. caraAlto: qué parte del alto del recuadro ocupa la cara.
// ojosY: a qué altura del recuadro quedan los ojos (0 = arriba, 1 = abajo).
const LADO = 720 // la foto se pide reducida a esto (suficiente para hacer zoom a la cara sin que se vea borrosa)

function calcularEncuadre(f, nw, nh, W, H, caraAlto, ojosY) {
  const kMin = Math.max(W / nw, H / nh)                 // lo mínimo para que la foto llene el recuadro
  let k = (caraAlto * H) / Math.max(1, f.alto * nh)     // zoom para que la cara tenga el tamaño deseado
  k = Math.min(Math.max(k, kMin), kMin * 5)             // nunca deja huecos, y no exagera el zoom en caras muy chicas
  const w = nw * k, h = nh * k
  const left = Math.min(0, Math.max(W - w, W / 2 - f.cx * w))
  const top = Math.min(0, Math.max(H - h, ojosY * H - f.ojos * h))
  return { left, top, width: w, height: h }
}

function FotoConEncuadre({ url, alt, ancho, alto, caraAlto, ojosY }) {
  const src = urlImagenReducida(url, LADO)
  const [enc, setEnc] = useState(null)

  useEffect(() => {
    let vivo = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = async () => {
      const f = await focoDeFoto(url, img)
      if (!vivo || !f) return
      setEnc(calcularEncuadre(f, img.naturalWidth, img.naturalHeight, ancho, alto, caraAlto, ojosY))
    }
    img.onerror = () => { if (img.src !== url) img.src = url } // si la versión reducida falla, con la original
    img.src = src
    return () => { vivo = false }
  }, [url, src, ancho, alto, caraAlto, ojosY])

  return (
    <div style={{ position: 'relative', width: ancho, height: alto, overflow: 'hidden' }}>
      <img src={src} alt={alt} crossOrigin="anonymous" onError={alFallarMini} loading="lazy" decoding="async"
        style={enc
          ? { position: 'absolute', left: enc.left, top: enc.top, width: enc.width, height: enc.height, maxWidth: 'none' }
          : { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}/>
    </div>
  )
}

export default function FotoEncuadrada({ url, alt = '', ancho, alto, caraAlto = 0.5, ojosY = 0.46 }) {
  if (!url) return null
  // key = url: si cambia la foto, arranca de cero (sin el encuadre de la foto anterior)
  return <FotoConEncuadre key={url} url={url} alt={alt} ancho={ancho} alto={alto} caraAlto={caraAlto} ojosY={ojosY}/>
}
