import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { descargarFlyer } from '../lib/flyerDescarga'

// ── "Mi tarjeta": imagen del resumen del jugador, lista para compartir ──────
// Un botón en el perfil público del jugador. Al tocarlo se arma una imagen
// vertical 4:5 (1080×1350, ideal para estados de WhatsApp e Instagram) con su
// foto, equipo, números y su mejor puesto frente a los demás jugadores, y se
// manda a la hoja de compartir del celular (o se descarga en computador).
// Reutiliza descargarFlyer (espera fotos/fuentes antes de capturar).
//
// Props: jugador, totales, puestos (ver lib/rankings.js → puestosJugador),
//        equipoActual, posicion, arq (resumen de arquero o null), estilo (del botón)

const ANCHO = 360
const ALTO = 450

const ETIQUETAS_PUESTO = {
  goles: 'goles', mvp: 'MVP', pj: 'partidos jugados', arqCero: 'arcos en cero', arqPj: 'partidos como arquero',
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

function Dato({ valor, etiqueta, puesto, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: 14, padding: '12px 4px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(255,255,255,.8)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 6 }}>{etiqueta}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#fde68a', marginTop: 4, minHeight: 13 }}>{puesto?.n ? `#${puesto.n} de ${puesto.de}` : ''}</div>
    </div>
  )
}

function Lienzo({ jugador, totales, puestos, equipoActual, posicion, arq, lienzoRef }) {
  const PL = puestos?.plataforma || {}
  const foto = jugador.photo_face_url || jugador.photo_url
  const destacado = mejorPuesto(puestos, arq)
  const url = `${window.location.host}/j/${jugador.id}`
  const datos = arq
    ? [
        { valor: arq.pj, etiqueta: 'Partidos', puesto: PL.arqPj, color: '#fff' },
        { valor: arq.arcosEnCero, etiqueta: 'Arcos en cero', puesto: PL.arqCero, color: '#a7f3d0' },
        { valor: arq.recibidos, etiqueta: 'Goles recibidos', puesto: PL.arqRec, color: '#fff' },
        { valor: arq.pj > 0 ? arq.promedio.toFixed(1) : '0.0', etiqueta: 'Prom. recibidos', puesto: PL.arqProm, color: '#fde68a' },
      ]
    : [
        { valor: totales.pj, etiqueta: 'Partidos', puesto: PL.pj, color: '#fff' },
        { valor: totales.goles, etiqueta: 'Goles', puesto: PL.goles, color: '#fde68a' },
        { valor: totales.mvp, etiqueta: 'MVP', puesto: PL.mvp, color: '#a7f3d0' },
        { valor: totales.amarillas, etiqueta: 'Amarillas', puesto: PL.amarillas, color: '#fff' },
      ]
  const partes = (jugador.name || '').trim().split(/\s+/)
  const linea1 = partes[0] || ''
  const linea2 = partes.slice(1).join(' ')

  return (
    <div ref={lienzoRef} style={{
      width: ANCHO, height: ALTO, boxSizing: 'border-box', padding: '22px 22px 18px', position: 'relative', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: '#fff',
      background: 'linear-gradient(165deg, #0a1d52 0%, #0d47a1 48%, #0097a7 120%)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'absolute', right: -70, top: -70, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }}/>
      <div style={{ position: 'absolute', left: -90, bottom: 90, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }}/>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.26em' }}>GOLMEBOL</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.16em', color: '#fde68a', border: '1px solid rgba(253,230,138,.6)', borderRadius: 20, padding: '3px 10px' }}>MI RESUMEN</div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
        <div style={{ width: 104, height: 104, borderRadius: '50%', border: '4px solid rgba(255,255,255,.7)', overflow: 'hidden', flexShrink: 0, background: '#1a2a5c' }}>
          {foto && <img src={foto} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}/>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '.01em' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linea1}</div>
            {linea2 && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linea2}</div>}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {posicion && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,.22)', borderRadius: 20, padding: '3px 10px' }}>{posicion}</span>}
          </div>
          {equipoActual && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              {equipoActual.logo_url && <img src={equipoActual.logo_url} alt="" crossOrigin="anonymous" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: '50%', background: 'rgba(255,255,255,.9)', padding: 2 }}/>}
              <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipoActual.name}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginTop: 22 }}>
        {datos.map(d => <Dato key={d.etiqueta} {...d}/>)}
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        {destacado && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(255,255,255,.75)' }}>MI MEJOR PUESTO</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fde68a', marginTop: 4, lineHeight: 1.1 }}>#{destacado.n} de {destacado.de}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>en {destacado.etiqueta} · toda la plataforma</div>
          </div>
        )}
      </div>

      <div style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,.25)', paddingTop: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>Mira mi perfil completo</div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.02em', marginTop: 2 }}>{url}</div>
      </div>
    </div>
  )
}

export default function TarjetaResumenJugador({ jugador, totales, puestos, equipoActual, posicion, arq, estilo }) {
  const [generando, setGenerando] = useState(false)
  const lienzoRef = useRef(null)

  useEffect(() => {
    if (!generando) return
    let cancelado = false
    ;(async () => {
      // dos cuadros de espera para que el lienzo oculto ya esté pintado antes de capturarlo
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      try {
        if (!cancelado && lienzoRef.current) {
          await descargarFlyer(lienzoRef.current, {
            filename: `golmebol_${(jugador.name || 'jugador').replace(/\s+/g, '_')}.png`,
            opcionesCanvas: { scale: 3, backgroundColor: null, width: ANCHO, height: ALTO },
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
  }, [generando])

  return (
    <>
      <button type="button" onClick={() => setGenerando(true)} disabled={generando} aria-label="Compartir mi tarjeta como imagen"
        style={estilo || { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}>
        <Camera size={15}/> {generando ? 'Generando…' : 'Mi tarjeta'}
      </button>
      {generando && (
        <div aria-hidden="true" style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }}>
          <Lienzo lienzoRef={lienzoRef} jugador={jugador} totales={totales} puestos={puestos} equipoActual={equipoActual} posicion={posicion} arq={arq}/>
        </div>
      )}
    </>
  )
}
