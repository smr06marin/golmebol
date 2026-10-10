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
const FONDO = '#050b1f'
const ORO = '#f5c800'
const TITULAR = "'Barlow Condensed', 'Bebas Neue', 'Arial Narrow', system-ui, sans-serif"
const MARCA = "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const TEXTO = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

const ETIQUETAS_PUESTO = {
  goles: 'GOLES', mvp: 'MVP', pj: 'PARTIDOS', arqCero: 'ARCOS EN 0', arqPj: 'PARTIDOS',
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

function Cifra({ valor, etiqueta, puesto, ultimo }) {
  const p = puestoVisible(puesto)
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center', borderRight: ultimo ? 'none' : '1px solid rgba(255,255,255,.14)', padding: '0 2px' }}>
      <div style={{ fontFamily: TITULAR, fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontFamily: TEXTO, fontSize: 7.5, fontWeight: 800, color: '#9db0e0', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>{etiqueta}</div>
      <div style={{ height: 26, marginTop: 5 }}>
        {p && (
          <>
            <div style={{ fontFamily: TITULAR, fontSize: 15, fontWeight: 800, color: ORO, lineHeight: 1 }}>#{p.n}</div>
            <div style={{ fontFamily: TEXTO, fontSize: 7, fontWeight: 700, color: '#7f93c8', marginTop: 1 }}>de {p.de}</div>
          </>
        )}
      </div>
    </div>
  )
}

function Lienzo({ jugador, totales, puestos, equipoActual, posicion, arq, qr, lienzoRef }) {
  const PL = puestos?.plataforma || {}
  const foto = jugador.photo_face_url || jugador.photo_url
  const destacado = mejorPuesto(puestos, arq)
  const [nom1, nom2] = partirNombre(jugador.name)
  const apellido = nom2 || nom1
  const nombrePila = nom2 ? nom1 : ''
  const tamApellido = apellido.length > 16 ? 30 : apellido.length > 12 ? 38 : 48

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
    <div ref={lienzoRef} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: FONDO, color: '#fff', fontFamily: TEXTO }}>
      {/* FOTO GRANDE */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 250, background: 'linear-gradient(160deg, #123a8f 0%, #0a1f5c 60%, #050b1f 100%)', overflow: 'hidden' }}>
        {foto
          ? <img src={foto} alt="" crossOrigin="anonymous" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%', display: 'block' }}/>
          : <div style={{ position: 'absolute', left: 0, right: 0, top: 40, display: 'flex', justifyContent: 'center' }}><Muneco/></div>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,11,31,.72) 0%, rgba(5,11,31,0) 26%, rgba(5,11,31,0) 40%, rgba(5,11,31,.82) 78%, #050b1f 100%)' }}/>
      </div>

      {/* ENCABEZADO */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 16, height: 16 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, fontFamily: MARCA, fontSize: 12, fontWeight: 900, letterSpacing: '.32em', lineHeight: '16px' }}>GOLMEBOL</div>
        <div style={{ position: 'absolute', right: 0, top: 0, fontFamily: TEXTO, fontSize: 8.5, fontWeight: 800, letterSpacing: '.2em', lineHeight: '16px', color: ORO }}>RESUMEN DEL JUGADOR</div>
      </div>

      {/* NOMBRE · EQUIPO · POSICIÓN */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 134, height: 112 }}>
        {nombrePila && (
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, fontFamily: TITULAR, fontSize: 22, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.88)', lineHeight: '24px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombrePila}</div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: nombrePila ? 22 : 12, fontFamily: TITULAR, fontSize: tamApellido, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.01em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{apellido}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, display: 'flex', alignItems: 'center', gap: 8 }}>
          {equipoActual?.logo_url && <img src={equipoActual.logo_url} alt="" crossOrigin="anonymous" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: '50%', background: '#fff', padding: 2, flexShrink: 0 }}/>}
          {equipoActual && <span style={{ fontFamily: TEXTO, fontSize: 12.5, fontWeight: 800, letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{equipoActual.name}</span>}
          {posicion && <span style={{ flexShrink: 0, fontFamily: TEXTO, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: FONDO, background: ORO, borderRadius: 4, padding: '3px 7px', lineHeight: 1 }}>{posicion}</span>}
        </div>
      </div>

      {/* CIFRAS */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 254, height: 88 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 34, height: 3, background: ORO, borderRadius: 2 }}/>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 10, display: 'flex' }}>
          {cifras.map((c, i) => <Cifra key={c.etiqueta} {...c} ultimo={i === cifras.length - 1}/>)}
        </div>
      </div>

      {/* MEJOR PUESTO */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 350, height: 34, borderRadius: 7, background: destacado ? 'linear-gradient(90deg, #f5c800 0%, #ffe066 100%)' : 'transparent', border: destacado ? 'none' : `1.5px solid ${ORO}`, boxSizing: 'border-box' }}>
        {destacado ? (
          <>
            <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: TEXTO, fontSize: 8.5, fontWeight: 900, letterSpacing: '.16em', color: FONDO }}>MEJOR PUESTO</div>
            <div style={{ position: 'absolute', right: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: TITULAR, fontSize: 19, fontWeight: 900, letterSpacing: '.02em', color: FONDO, whiteSpace: 'nowrap' }}>#{destacado.n} DE {destacado.de} · {destacado.etiqueta}</div>
          </>
        ) : (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TEXTO, fontSize: 9, fontWeight: 900, letterSpacing: '.18em', color: ORO }}>SIGUE MIS PARTIDOS Y ESTADÍSTICAS</div>
        )}
      </div>

      {/* PIE: marca + QR */}
      <div style={{ position: 'absolute', left: 20, right: 20, top: 398, height: 36 }}>
        <div style={{ position: 'absolute', left: 0, top: 3 }}>
          <div style={{ fontFamily: MARCA, fontSize: 13, fontWeight: 900, letterSpacing: '.04em', lineHeight: '16px' }}>golmebol.com</div>
          <div style={{ fontFamily: TEXTO, fontSize: 8.5, fontWeight: 600, color: '#9db0e0', marginTop: 4, lineHeight: '11px' }}>Escanea y mira mi perfil completo</div>
        </div>
        {qr && <img src={qr} alt="" style={{ position: 'absolute', right: 0, top: -2, width: 40, height: 40, borderRadius: 6, background: '#fff', padding: 2, boxSizing: 'border-box', display: 'block' }}/>}
      </div>
    </div>
  )
}

export default function TarjetaResumenJugador({ jugador, totales, puestos, equipoActual, posicion, arq, estilo }) {
  const [generando, setGenerando] = useState(false)
  const [qr, setQr] = useState(null)
  const lienzoRef = useRef(null)

  useEffect(() => {
    if (!generando) return
    let cancelado = false
    ;(async () => {
      try {
        // QR hacia el perfil (si falla, la tarjeta sale igual sin QR)
        let qrUrl = null
        try {
          const { default: QRCode } = await import('qrcode')
          qrUrl = await QRCode.toDataURL(`${window.location.origin}/j/${jugador.id}`, { width: 240, margin: 1, color: { dark: FONDO, light: '#ffffff' } })
        } catch { /* sin QR */ }
        if (cancelado) return
        setQr(qrUrl)
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
  }, [generando, jugador.id, jugador.name])

  return (
    <>
      <button type="button" onClick={() => setGenerando(true)} disabled={generando} aria-label="Compartir mi tarjeta como imagen"
        style={estilo || { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}>
        <Camera size={15}/> {generando ? 'Generando…' : 'Mi tarjeta'}
      </button>
      {generando && (
        <div aria-hidden="true" style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }}>
          <Lienzo lienzoRef={lienzoRef} jugador={jugador} totales={totales} puestos={puestos} equipoActual={equipoActual} posicion={posicion} arq={arq} qr={qr}/>
        </div>
      )}
    </>
  )
}
