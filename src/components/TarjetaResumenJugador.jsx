import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { descargarFlyer } from '../lib/flyerDescarga'

// ── "Mi tarjeta": imagen del resumen del jugador, lista para compartir ──────
// Un botón en el perfil público del jugador. Al tocarlo se arma una imagen
// vertical 4:5 (1080×1350, ideal para estados de WhatsApp e Instagram): foto
// grande, nombre, equipo, cifras en una fila, su mejor puesto frente a los
// demás y un QR que abre su perfil completo. Se manda a la hoja de compartir
// del celular (o se descarga en computador). Reutiliza descargarFlyer (espera
// fotos/fuentes antes de capturar).
//
// Todo va con posiciones fijas (nada de flex que se encime): lo que se ve en
// pantalla es exactamente lo que sale en la imagen.

const W = 360
const H = 450
const TITULAR = "'Barlow Condensed', 'Bebas Neue', 'Arial Narrow', system-ui, sans-serif"
const MARCA = "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const TEXTO = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

const ETIQUETAS_PUESTO = {
  goles: 'GOLES', mvp: 'MVP', pj: 'PARTIDOS', arqCero: 'ARCOS EN 0', arqPj: 'PARTIDOS',
}


// ── Colores de la tarjeta = colores del escudo del equipo ───────────────────
// Los equipos no guardan un color, así que se saca del escudo: se busca el tono
// más presente y vistoso (se ignoran blanco, negro y grises) y de ahí salen el
// fondo oscuro, el degradado de la foto y el acento (franja, puestos, posición).
// Sin escudo, o con escudo sin color (blanco y negro), queda el azul y dorado de Golmebol.
function hslARgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}
const rgbCss = (c, a) => (a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`)
const luminancia = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }

function armarTema(c) {
  return {
    fondo: c.fondo, alto: c.alto, medio: c.medio, acento: c.acento, acentoFin: c.acentoFin,
    textoAcento: luminancia(c.acento) > 0.35 ? rgbCss(c.fondo) : '#ffffff',
    suave: c.suave,
  }
}
const TEMA_GOLMEBOL = armarTema({
  fondo: [5, 11, 31], alto: [18, 58, 143], medio: [10, 31, 92],
  acento: [245, 200, 0], acentoFin: [255, 224, 102], suave: [157, 176, 224],
})
function temaDeTono(h) {
  return armarTema({
    fondo: hslARgb(h, 55, 7), alto: hslARgb(h, 70, 30), medio: hslARgb(h, 65, 16),
    acento: hslARgb(h, 92, h > 38 && h < 70 ? 52 : 58), acentoFin: hslARgb(h, 95, 70), suave: hslARgb(h, 45, 74),
  })
}

// Devuelve el tema sacado del escudo (o el de Golmebol si no se puede).
async function temaDesdeEscudo(url) {
  if (!url) return TEMA_GOLMEBOL
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = mal; i.src = url
    })
    const N = 48
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N
    const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(img, 0, 0, N, N)
    const px = cx.getImageData(0, 0, N, N).data
    const cubos = Array.from({ length: 36 }, () => ({ peso: 0, sumaH: 0, n: 0 }))
    let opacos = 0
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue
      opacos++
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
      const l = (mx + mn) / 2
      if (d === 0 || l < 0.15 || l > 0.88) continue
      const sat = d / (1 - Math.abs(2 * l - 1))
      if (sat < 0.3) continue
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
      h = (h * 60 + 360) % 360
      const c = cubos[Math.floor(h / 10) % 36]
      c.peso += sat; c.sumaH += h; c.n++
    }
    const mejor = cubos.reduce((a, c) => (c.peso > a.peso ? c : a), cubos[0])
    if (!opacos || mejor.n < opacos * 0.04) return TEMA_GOLMEBOL
    return temaDeTono(mejor.sumaH / mejor.n)
  } catch {
    return TEMA_GOLMEBOL
  }
}

// Mejor puesto del jugador (el más cercano al primero), solo si es destacable (mitad superior).
function mejorPuesto(puestos, arq) {
  const PL = puestos?.plataforma || {}
  const claves = arq ? ['arqCero', 'arqPj'] : ['goles', 'mvp', 'pj']
  let mejor = null
  claves.forEach(k => {
    const p = PL[k]
    if (!p || !p.n || !p.de) return
    const r = p.n / p.de
    if (!mejor || r < mejor.r) mejor = { k, n: p.n, de: p.de, r }
  })
  return mejor && mejor.r <= 0.5 ? { ...mejor, etiqueta: ETIQUETAS_PUESTO[mejor.k] } : null
}

// Un puesto solo se muestra si es bueno (mitad superior): la tarjeta es para presumir.
const puestoVisible = p => (p && p.n && p.de && p.n / p.de <= 0.5 ? p : null)

// "RONALD MONTES" → ['RONALD', 'MONTES'] · 3 palabras → 2 + 1 · 4 palabras → 2 + 2
function partirNombre(nombre) {
  const w = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (w.length <= 1) return [w[0] || '', '']
  const corte = Math.ceil(w.length / 2)
  return [w.slice(0, corte).join(' '), w.slice(corte).join(' ')]
}

function Muneco() {
  return (
    <svg viewBox="0 0 24 24" width="170" height="170" fill="rgba(255,255,255,.14)" aria-label="Sin foto">
      <circle cx="12" cy="7.5" r="4.2"/>
      <path d="M3.5 21.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z"/>
    </svg>
  )
}

// OJO: las fotos y escudos van como imagen de FONDO (background-size), no como <img object-fit>:
// html2canvas (lo que convierte la tarjeta en imagen) no respeta object-fit y estiraba la foto.
const fondoImagen = (url, ajuste, posicion = 'center') => ({
  backgroundImage: `url("${url}")`, backgroundSize: ajuste, backgroundPosition: posicion, backgroundRepeat: 'no-repeat',
})

function Cifra({ valor, etiqueta, puesto, ultimo, tema }) {
  const p = puestoVisible(puesto)
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center', borderRight: ultimo ? 'none' : '1px solid rgba(255,255,255,.14)', padding: '0 2px' }}>
      <div style={{ fontFamily: TITULAR, fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontFamily: TEXTO, fontSize: 7.5, fontWeight: 800, color: rgbCss(tema.suave), letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>{etiqueta}</div>
      <div style={{ height: 26, marginTop: 5 }}>
        {p && (
          <>
            <div style={{ fontFamily: TITULAR, fontSize: 15, fontWeight: 800, color: rgbCss(tema.acento), lineHeight: 1 }}>#{p.n}</div>
            <div style={{ fontFamily: TEXTO, fontSize: 7, fontWeight: 700, color: rgbCss(tema.suave, .8), marginTop: 1 }}>de {p.de}</div>
          </>
        )}
      </div>
    </div>
  )
}

function Lienzo({ jugador, totales, puestos, equipoActual, posicion, arq, qr, tema = TEMA_GOLMEBOL, lienzoRef }) {
  const PL = puestos?.plataforma || {}
  const foto = jugador.photo_face_url || jugador.photo_url
  const destacado = mejorPuesto(puestos, arq)
  const [nom1, nom2] = partirNombre(jugador.name)
  const apellido = nom2 || nom1
  const nombrePila = nom2 ? nom1 : ''
  const tamApellido = apellido.length > 16 ? 30 : apellido.length > 12 ? 38 : 48
  const fondo = rgbCss(tema.fondo)
  const acento = rgbCss(tema.acento)

  const cifras = arq
    ? [
        { valor: arq.pj, etiqueta: 'Partidos', puesto: PL.arqPj },
        { valor: arq.arcosEnCero, etiqueta: 'Arcos en 0', puesto: PL.arqCero },
        { valor: arq.recibidos, etiqueta: 'Goles rec.', puesto: PL.arqRec },
        { valor: arq.pj > 0 ? arq.promedio.toFixed(1) : '0.0', etiqueta: 'Prom. rec.', puesto: PL.arqProm },
      ]
    : [
        { valor: totales.pj, etiqueta: 'Partidos', puesto: PL.pj },
        { valor: totales.goles, etiqueta: 'Goles', puesto: PL.goles },
        { valor: totales.mvp, etiqueta: 'MVP', puesto: PL.mvp },
        { valor: totales.amarillas, etiqueta: 'Amarillas', puesto: null },
      ]

  return (
    <div ref={lienzoRef} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: fondo, color: '#fff', fontFamily: TEXTO }}>
      {/* FOTO GRANDE */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 250, background: `linear-gradient(160deg, ${rgbCss(tema.alto)} 0%, ${rgbCss(tema.medio)} 60%, ${fondo} 100%)`, overflow: 'hidden' }}>
        {foto
          ? <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 250, ...fondoImagen(foto, 'cover', 'center 18%') }}/>
          : <div style={{ position: 'absolute', left: 0, right: 0, top: 40, display: 'flex', justifyContent: 'center' }}><Muneco/></div>}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 250, background: `linear-gradient(180deg, ${rgbCss(tema.fondo, .72)} 0%, ${rgbCss(tema.fondo, 0)} 26%, ${rgbCss(tema.fondo, 0)} 40%, ${rgbCss(tema.fondo, .82)} 78%, ${fondo} 100%)` }}/>
      </div>

      {/* ENCABEZADO */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 16, height: 16 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, fontFamily: MARCA, fontSize: 12, fontWeight: 900, letterSpacing: '.32em', lineHeight: '16px' }}>GOLMEBOL</div>
        <div style={{ position: 'absolute', right: 0, top: 0, fontFamily: TEXTO, fontSize: 8.5, fontWeight: 800, letterSpacing: '.2em', lineHeight: '16px', color: 'rgba(255,255,255,.92)', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>RESUMEN DEL JUGADOR</div>
      </div>

      {/* NOMBRE · EQUIPO · POSICIÓN */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 134, height: 112 }}>
        {nombrePila && (
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, fontFamily: TITULAR, fontSize: 22, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.88)', lineHeight: '24px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombrePila}</div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: nombrePila ? 22 : 12, fontFamily: TITULAR, fontSize: tamApellido, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.01em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{apellido}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, display: 'flex', alignItems: 'center', gap: 8 }}>
          {equipoActual?.logo_url && (
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', flexShrink: 0, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 2, top: 2, width: 20, height: 20, ...fondoImagen(equipoActual.logo_url, 'contain') }}/>
            </div>
          )}
          {equipoActual && <span style={{ fontFamily: TEXTO, fontSize: 12.5, fontWeight: 800, letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{equipoActual.name}</span>}
          {posicion && <span style={{ flexShrink: 0, fontFamily: TEXTO, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: tema.textoAcento, background: acento, borderRadius: 4, padding: '3px 7px', lineHeight: 1 }}>{posicion}</span>}
        </div>
      </div>

      {/* CIFRAS */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 254, height: 88 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 34, height: 3, background: acento, borderRadius: 2 }}/>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 10, display: 'flex' }}>
          {cifras.map((c, i) => <Cifra key={c.etiqueta} {...c} tema={tema} ultimo={i === cifras.length - 1}/>)}
        </div>
      </div>

      {/* MEJOR PUESTO */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 350, height: 34, borderRadius: 7, background: destacado ? `linear-gradient(90deg, ${acento} 0%, ${rgbCss(tema.acentoFin)} 100%)` : 'transparent', border: destacado ? 'none' : `1.5px solid ${acento}`, boxSizing: 'border-box' }}>
        {destacado ? (
          <>
            <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: TEXTO, fontSize: 8.5, fontWeight: 900, letterSpacing: '.16em', color: tema.textoAcento }}>MEJOR PUESTO</div>
            <div style={{ position: 'absolute', right: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: TITULAR, fontSize: 19, fontWeight: 900, letterSpacing: '.02em', color: tema.textoAcento, whiteSpace: 'nowrap' }}>#{destacado.n} DE {destacado.de} · {destacado.etiqueta}</div>
          </>
        ) : (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TEXTO, fontSize: 9, fontWeight: 900, letterSpacing: '.18em', color: acento }}>SIGUE MIS PARTIDOS Y ESTADÍSTICAS</div>
        )}
      </div>

      {/* PIE: marca + QR */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 398, height: 36 }}>
        <div style={{ position: 'absolute', left: 0, top: 3 }}>
          <div style={{ fontFamily: MARCA, fontSize: 13, fontWeight: 900, letterSpacing: '.04em', lineHeight: '16px' }}>golmebol.com</div>
          <div style={{ fontFamily: TEXTO, fontSize: 8.5, fontWeight: 600, color: rgbCss(tema.suave), marginTop: 4, lineHeight: '11px' }}>Escanea y mira mi perfil completo</div>
        </div>
        {qr && <div style={{ position: 'absolute', right: 0, top: -2, width: 40, height: 40, borderRadius: 6, background: '#fff', ...fondoImagen(qr, '36px 36px', 'center') }}/>}
      </div>
    </div>
  )
}

export default function TarjetaResumenJugador({ jugador, totales, puestos, equipoActual, posicion, arq, estilo }) {
  const [generando, setGenerando] = useState(false)
  const [extra, setExtra] = useState({ qr: null, tema: TEMA_GOLMEBOL })
  const lienzoRef = useRef(null)

  useEffect(() => {
    if (!generando) return
    let cancelado = false
    ;(async () => {
      try {
        const [tema, qr] = await Promise.all([
          temaDesdeEscudo(equipoActual?.logo_url),
          // QR hacia el perfil (si falla, la tarjeta sale igual sin QR)
          import('qrcode')
            .then(({ default: QRCode }) => QRCode.toDataURL(`${window.location.origin}/j/${jugador.id}`, { width: 240, margin: 1, color: { dark: '#050b1f', light: '#ffffff' } }))
            .catch(() => null),
        ])
        if (cancelado) return
        setExtra({ qr, tema })
        // dos cuadros de espera para que el lienzo oculto ya esté pintado antes de capturarlo
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        if (!cancelado && lienzoRef.current) {
          await descargarFlyer(lienzoRef.current, {
            filename: `golmebol_${(jugador.name || 'jugador').replace(/\s+/g, '_')}.png`,
            opcionesCanvas: { scale: 3, backgroundColor: null, width: W, height: H },
            shareTitle: `${jugador.name} · Golmebol`,
            shareText: `Mi resumen en Golmebol 👉 ${window.location.origin}/j/${jugador.id}`,
          })
        }
      } catch (e) {
        console.error('No se pudo generar la tarjeta:', e)
      } finally {
        if (!cancelado) setGenerando(false)
      }
    })()
    return () => { cancelado = true }
  }, [generando, jugador.id, jugador.name, equipoActual?.logo_url])

  return (
    <>
      <button type="button" onClick={() => setGenerando(true)} disabled={generando} aria-label="Compartir mi tarjeta como imagen"
        style={estilo || { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}>
        <Camera size={15}/> {generando ? 'Generando…' : 'Mi tarjeta'}
      </button>
      {generando && (
        <div aria-hidden="true" style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }}>
          <Lienzo lienzoRef={lienzoRef} jugador={jugador} totales={totales} puestos={puestos} equipoActual={equipoActual} posicion={posicion} arq={arq} qr={extra.qr} tema={extra.tema}/>
        </div>
      )}
    </>
  )
}
