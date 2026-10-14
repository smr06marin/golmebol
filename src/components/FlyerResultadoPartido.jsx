import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import { fmtHoraDate } from '../lib/horaHelpers'
import { descargarFlyer } from '../lib/flyerDescarga'
import { TEMAS_RESULTADO } from '../lib/flyerTemas'
import { COLOR_TARJETA, FASE_LABEL, acortarNombre, datosParaFlyer, penalesDe } from '../lib/resumenPartido'
import SelectorTemaFlyer from './SelectorTemaFlyer'

// Flyer de RESULTADO que los equipos publican en sus redes. Se dibuja siempre
// a tamaño real (1080 de ancho); la vista previa es una copia encogida con
// transform:scale() y la descarga captura otra copia oculta, sin transform,
// para que html2canvas dé exactamente 1080×1920 / 1080×1350. Solo usa degradados lineales/radiales,
// bordes y sombras de texto, que html2canvas dibuja igual que el navegador.

const ANCHO = 1080
const FORMATOS = [
  { id: 'historia', nombre: 'Historia', sub: '1080×1920', alto: 1920, escudo: 250, score: 310, padY: 84 },
  { id: 'post',     nombre: 'Post',     sub: '1080×1350', alto: 1350, escudo: 170, score: 220, padY: 52 },
]

const F_TITULO = "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif"
const F_TEXTO = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"

const MIN_FILA = 32
const MAX_FILA = 60
const ALTO_CABECERA_SECCION = 56
const ESPACIO_SECCION = 22

function Escudo({ url, nombre, size, radio }) {
  const iniciales = (nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: radio, background: '#fff', padding: Math.round(size * 0.07),
      boxSizing: 'border-box', flexShrink: 0,
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>
        : (
          <div style={{ width: '100%', height: '100%', borderRadius: radio * 0.6, background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: F_TITULO, fontSize: size * 0.4, color: '#fff', letterSpacing: 2 }}>{iniciales}</span>
          </div>
        )}
    </div>
  )
}

function IconoCalendario({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>
    </svg>
  )
}
function IconoReloj({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>
    </svg>
  )
}
function IconoUbicacion({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>
    </svg>
  )
}

function CabeceraSeccion({ texto, tema }) {
  return (
    <div style={{
      height: ALTO_CABECERA_SECCION, display: 'flex', alignItems: 'center', padding: '0 20px', boxSizing: 'border-box',
      background: 'rgba(255,255,255,.09)', borderLeft: `7px solid ${tema.acento}`, borderRadius: 6, marginBottom: 8,
    }}>
      <span style={{ fontFamily: F_TITULO, fontSize: 38, letterSpacing: 5, color: tema.acento, lineHeight: 1 }}>{texto}</span>
    </div>
  )
}

function ColumnaEstadisticas({ goles, filasGoles, tarjetas, tarjetasMas, rowH, tema }) {
  const fuente = Math.min(36, Math.round(rowH * 0.58))
  const fila = {
    height: rowH, display: 'flex', alignItems: 'center', gap: 14, borderBottom: `2px solid ${tema.linea}`,
    boxSizing: 'border-box', padding: '0 6px',
  }
  const nombre = { flex: 1, minWidth: 0, fontFamily: F_TEXTO, fontWeight: 700, fontSize: fuente, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1 }
  const vacio = { ...fila, color: 'rgba(255,255,255,.4)', fontFamily: F_TEXTO, fontSize: fuente, fontWeight: 600 }
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <CabeceraSeccion texto="GOLES" tema={tema}/>
      {goles.length === 0 && <div style={vacio}>—</div>}
      {goles.map((g, i) => (
        <div key={i} style={fila}>
          <GiSoccerBall size={Math.round(rowH * 0.62)} color="#fff" style={{ flexShrink: 0 }}/>
          <span style={nombre}>{acortarNombre(g.jugador, 30)}</span>
          <span style={{ fontFamily: F_TITULO, fontSize: Math.round(rowH * 0.85), color: tema.acento, lineHeight: 1, flexShrink: 0 }}>{g.cantidad}</span>
        </div>
      ))}
      {/* relleno para que TARJETAS arranque a la misma altura en los dos equipos */}
      {filasGoles - Math.max(1, goles.length) > 0 && <div style={{ height: (filasGoles - Math.max(1, goles.length)) * rowH }}/>}
      <div style={{ height: ESPACIO_SECCION }}/>
      <CabeceraSeccion texto="TARJETAS" tema={tema}/>
      {tarjetas.length === 0 && <div style={vacio}>—</div>}
      {tarjetas.map((t, i) => (
        <div key={i} style={fila}>
          <span style={{ width: Math.round(rowH * 0.34), height: Math.round(rowH * 0.5), borderRadius: 4, background: COLOR_TARJETA[t.color] || '#999', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,.35)' }}/>
          <span style={nombre}>{acortarNombre(t.jugador, 30)}</span>
        </div>
      ))}
      {tarjetasMas > 0 && (
        <div style={{ ...vacio, color: tema.acentoSuave, fontWeight: 700 }}>+{tarjetasMas} más</div>
      )}
    </div>
  )
}

// Las tarjetas se recortan si no caben (los goles siempre se muestran) y se
// avisa con "+N más". `g` son las filas de goles (las mismas en los 2 equipos).
function recortarTarjetas(tarjetas, capFilas, g) {
  const permitidas = Math.max(1, capFilas - g)
  if (tarjetas.length <= permitidas) return { tarjetas, mas: 0, filas: Math.max(1, tarjetas.length) }
  const visibles = Math.max(0, permitidas - 1)
  return { tarjetas: tarjetas.slice(0, visibles), mas: tarjetas.length - visibles, filas: visibles + 1 }
}

function Flyer({ partido, torneo, datos, tema, formato }) {
  const statsRef = useRef(null)
  const [alturaStats, setAlturaStats] = useState(0)

  useLayoutEffect(() => {
    const el = statsRef.current
    if (!el) return
    const medir = () => setAlturaStats(el.clientHeight)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [formato.id])

  const { golesLocal, golesVisitante, tarjetasLocal, tarjetasVisitante } = datos
  const esW = partido.tipo_resultado === 'w'
  const esDesierto = partido.tipo_resultado === 'desierto'
  // Sin goles ni tarjetas registrados (W, desierto o partido sin detalle): no se
  // muestra la sección de estadísticas y el marcador se centra en el flyer.
  const sinEstadisticas = !!partido.tipo_resultado
    || (golesLocal.length + golesVisitante.length + tarjetasLocal.length + tarjetasVisitante.length === 0)

  const capFilas = alturaStats > 0 ? Math.max(3, Math.floor((alturaStats - 2 * ALTO_CABECERA_SECCION - ESPACIO_SECCION - 16) / MIN_FILA)) : 99
  const filasGoles = Math.max(1, golesLocal.length, golesVisitante.length)
  const colL = recortarTarjetas(tarjetasLocal, capFilas, filasGoles)
  const colV = recortarTarjetas(tarjetasVisitante, capFilas, filasGoles)
  const maxFilas = Math.max(filasGoles + Math.max(colL.filas, colV.filas), 3)
  const disponible = alturaStats - 2 * ALTO_CABECERA_SECCION - ESPACIO_SECCION - 16
  const rowH = alturaStats > 0
    ? Math.max(MIN_FILA, Math.min(MAX_FILA, Math.floor(disponible / maxFilas)))
    : 48

  const hs = Number(partido.home_score) || 0
  const as = Number(partido.away_score) || 0
  const pen = penalesDe(partido)
  const ganaLocal = pen ? pen.ganador === 'local' : hs > as
  const ganaVisitante = pen ? pen.ganador === 'visitante' : as > hs
  const colorLocal = ganaLocal ? tema.acento : '#fff'
  const colorVis = ganaVisitante ? tema.acento : '#fff'
  const glow = c => (c === '#fff' ? 'none' : `0 0 40px ${tema.luz}, 0 6px 0 rgba(0,0,0,.25)`)

  const fecha = partido.played_at
    ? new Date(partido.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const fechaTxt = fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : ''
  const hora = partido.played_at ? fmtHoraDate(partido.played_at) : ''
  const faseTxt = partido.fase && partido.fase !== 'grupo'
    ? (FASE_LABEL[partido.fase] || partido.fase).toUpperCase()
    : (partido.matchday ? `FECHA ${partido.matchday}` : 'FASE DE GRUPOS')

  const nombreTorneo = (torneo?.name || '').toUpperCase()
  const gran = formato.id === 'historia'
  const tam = {
    chip: gran ? 40 : 34,
    nombreEquipo: gran ? 54 : 46,
    meta: gran ? 40 : 34,
    titulo: gran ? 40 : 34,
    torneo: gran ? 62 : 52,
    logo: gran ? 132 : 104,
  }

  return (
    <div style={{
      width: ANCHO, height: formato.alto, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      background: `linear-gradient(180deg, ${tema.arriba} 0%, ${tema.abajo} 72%)`, color: '#fff', fontFamily: F_TEXTO,
    }}>
      {/* Foco de luz + reflectores + líneas de cancha (decoración) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 900, background: `radial-gradient(ellipse at 50% 0%, ${tema.luz} 0%, rgba(0,0,0,0) 62%)` }}/>
      <div style={{ position: 'absolute', top: -160, left: 30, width: 250, height: 1250, transform: 'rotate(-17deg)', transformOrigin: 'top left', background: `linear-gradient(180deg, ${tema.luz} 0%, rgba(0,0,0,0) 78%)`, opacity: 0.32 }}/>
      <div style={{ position: 'absolute', top: -160, right: 30, width: 250, height: 1250, transform: 'rotate(17deg)', transformOrigin: 'top right', background: `linear-gradient(180deg, ${tema.luz} 0%, rgba(0,0,0,0) 78%)`, opacity: 0.32 }}/>
      <div style={{ position: 'absolute', left: -60, right: -60, bottom: 150, height: 4, background: 'rgba(255,255,255,.10)' }}/>
      <div style={{ position: 'absolute', left: '50%', bottom: -380, width: 760, height: 760, marginLeft: -380, borderRadius: '50%', border: '4px solid rgba(255,255,255,.10)', boxSizing: 'border-box' }}/>

      <div style={{ position: 'relative', zIndex: 2, height: '100%', boxSizing: 'border-box', padding: `${formato.padY}px 64px ${formato.padY - 8}px`, display: 'flex', flexDirection: 'column' }}>

        {/* Torneo + etiquetas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {torneo?.logo_url && (
            <div style={{ width: tam.logo, height: tam.logo, borderRadius: 28, background: '#fff', padding: 10, boxSizing: 'border-box', flexShrink: 0 }}>
              <img src={torneo.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: tam.torneo, lineHeight: 1.02, letterSpacing: 1, textTransform: 'uppercase', maxHeight: tam.torneo * 2.1, overflow: 'hidden' }}>{nombreTorneo}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: gran ? 34 : 24, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: F_TITULO, fontSize: tam.chip, letterSpacing: 4, lineHeight: 1, background: tema.acento, color: '#10101c', borderRadius: 12, padding: '10px 26px 8px' }}>FINALIZADO</span>
          <span style={{ fontFamily: F_TITULO, fontSize: tam.chip, letterSpacing: 4, lineHeight: 1, border: `3px solid ${tema.acento}`, color: tema.acentoSuave, borderRadius: 12, padding: '8px 24px 6px' }}>{faseTxt}</span>
        </div>

        <div style={sinEstadisticas ? { flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' } : undefined}>
        {/* Marcador */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', columnGap: 18, marginTop: gran ? 64 : 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Escudo url={partido.home?.logo_url} nombre={partido.home?.name} size={formato.escudo} radio={Math.round(formato.escudo * 0.2)}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F_TITULO, lineHeight: 0.9, fontSize: formato.score, letterSpacing: 4 }}>
            <span style={{ color: colorLocal, textShadow: glow(colorLocal) }}>{hs}</span>
            <span style={{ color: 'rgba(255,255,255,.9)', fontSize: formato.score * 0.6, margin: '0 18px', position: 'relative', top: -formato.score * 0.05 }}>-</span>
            <span style={{ color: colorVis, textShadow: glow(colorVis) }}>{as}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Escudo url={partido.away?.logo_url} nombre={partido.away?.name} size={formato.escudo} radio={Math.round(formato.escudo * 0.2)}/>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', columnGap: 18, marginTop: 22, alignItems: 'start' }}>
          <div style={{ textAlign: 'center', fontFamily: F_TEXTO, fontWeight: 800, fontSize: tam.nombreEquipo, lineHeight: 1.02, textTransform: 'uppercase', color: ganaLocal ? tema.acentoSuave : '#fff', maxHeight: tam.nombreEquipo * 2.15, overflow: 'hidden' }}>{partido.home?.name}</div>
          <div style={{ width: formato.score * 0.95 }}/>
          <div style={{ textAlign: 'center', fontFamily: F_TEXTO, fontWeight: 800, fontSize: tam.nombreEquipo, lineHeight: 1.02, textTransform: 'uppercase', color: ganaVisitante ? tema.acentoSuave : '#fff', maxHeight: tam.nombreEquipo * 2.15, overflow: 'hidden' }}>{partido.away?.name}</div>
        </div>

        {(pen || esW || esDesierto) && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
            <span style={{ fontFamily: F_TITULO, fontSize: tam.chip, letterSpacing: 4, lineHeight: 1, color: tema.acentoSuave, border: `2px solid ${tema.linea}`, background: 'rgba(255,255,255,.08)', borderRadius: 40, padding: '10px 30px 8px' }}>
              {pen ? `PENALES ${pen.local} - ${pen.visitante}` : esW ? 'GANADO POR W' : 'PARTIDO DESIERTO'}
            </span>
          </div>
        )}

        {/* Fecha, hora y lugar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 44, rowGap: 10, marginTop: gran ? 44 : 28, fontFamily: F_TEXTO, fontWeight: 600, fontSize: tam.meta, color: 'rgba(255,255,255,.88)' }}>
          {fechaTxt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}><IconoCalendario color={tema.acento} size={tam.meta + 2}/>{fechaTxt}</span>}
          {hora && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}><IconoReloj color={tema.acento} size={tam.meta + 2}/>{hora}</span>}
          {partido.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}><IconoUbicacion color={tema.acento} size={tam.meta + 2}/>{partido.location}</span>}
        </div>

        </div>

        {/* Estadísticas */}
        {!sinEstadisticas && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: gran ? 44 : 28, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 3, background: `linear-gradient(90deg, rgba(0,0,0,0), ${tema.acento})` }}/>
          <span style={{ fontFamily: F_TEXTO, fontWeight: 700, fontSize: tam.titulo, letterSpacing: 8, color: tema.acento, textTransform: 'uppercase' }}>Estadísticas del partido</span>
          <div style={{ flex: 1, height: 3, background: `linear-gradient(270deg, rgba(0,0,0,0), ${tema.acento})` }}/>
        </div>

        <div ref={statsRef} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', gap: 40 }}>
          <ColumnaEstadisticas goles={golesLocal} filasGoles={filasGoles} tarjetas={colL.tarjetas} tarjetasMas={colL.mas} rowH={rowH} tema={tema}/>
          <ColumnaEstadisticas goles={golesVisitante} filasGoles={filasGoles} tarjetas={colV.tarjetas} tarjetasMas={colV.mas} rowH={rowH} tema={tema}/>
        </div>
        </>)}

        {/* Marca de agua discreta: el protagonista es el torneo */}
        <div style={{ textAlign: 'center', marginTop: 18, fontFamily: F_TITULO, fontSize: 30, letterSpacing: 10, color: 'rgba(255,255,255,.45)', lineHeight: 1 }}>GOLMEBOL</div>
      </div>
    </div>
  )
}

export default function FlyerResultadoPartido({ partido, torneo, eventos, nombreDe, onClose }) {
  const wrapperRef = useRef(null)
  const flyerRef = useRef(null)
  const [formatoId, setFormatoId] = useState('historia')
  const [temaId, setTemaId] = useState(TEMAS_RESULTADO[0].id)
  const [escala, setEscala] = useState(0.4)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState('')

  const formato = FORMATOS.find(f => f.id === formatoId) || FORMATOS[0]
  const tema = TEMAS_RESULTADO.find(t => t.id === temaId) || TEMAS_RESULTADO[0]
  const datos = useMemo(() => datosParaFlyer(partido, eventos || [], nombreDe), [partido, eventos, nombreDe])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const calcular = () => setEscala(Math.min(1, wrapper.offsetWidth / ANCHO) || 0.3)
    calcular()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(calcular)
    obs.observe(wrapper)
    return () => obs.disconnect()
  }, [])

  async function handleDescargar() {
    if (!flyerRef.current) return
    setDescargando(true)
    setErrorDescarga('')
    try {
      const base = `${torneo?.name || 'golmebol'}_${partido.home?.name || 'local'}_vs_${partido.away?.name || 'visitante'}`
        .replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')
      await descargarFlyer(flyerRef.current, {
        filename: `${base}_${formato.id}.png`,
        opcionesCanvas: { scale: 1, width: ANCHO, height: formato.alto, backgroundColor: tema.abajo },
        shareTitle: `${partido.home?.name} ${partido.home_score} - ${partido.away_score} ${partido.away?.name}`,
      })
    } catch (e) {
      console.error('Flyer de resultado: no se pudo generar la imagen', e)
      setErrorDescarga('No se pudo generar la imagen. Intenta de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  const boton = activo => ({
    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: '.8rem', fontWeight: 700,
    border: activo ? '2px solid #1a73e8' : '1px solid #dadce0',
    background: activo ? '#e8f0fe' : '#fff', color: activo ? '#1a73e8' : '#5f6368',
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 620, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 540, maxHeight: '94vh', overflowY: 'auto',
        overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '18px 18px 22px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.95rem' }}>Flyer para tus redes</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: 2 }}>Elige formato y color, y descárgalo o compártelo</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16}/>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {FORMATOS.map(f => (
            <button key={f.id} type="button" onClick={() => setFormatoId(f.id)} style={boton(f.id === formatoId)}>
              {f.nombre} <span style={{ fontWeight: 500, opacity: 0.75 }}>· {f.sub}</span>
            </button>
          ))}
        </div>
        <SelectorTemaFlyer temas={TEMAS_RESULTADO} temaId={temaId} onElegir={setTemaId}/>

        {/* Vista previa: el flyer mide ANCHO×alto reales; solo se encoge por transform */}
        <div ref={wrapperRef} style={{ width: '100%' }}>
          <div style={{ width: ANCHO * escala, height: formato.alto * escala, margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.25)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: ANCHO, height: formato.alto, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
              <Flyer partido={partido} torneo={torneo} datos={datos} tema={tema} formato={formato}/>
            </div>
          </div>
        </div>

        {/* Copia a tamaño real, fuera de pantalla y SIN transform: es la que se
            captura. html2canvas mide mal un elemento que vive dentro de un
            contenedor con transform:scale (la vista previa de arriba). */}
        <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: ANCHO, height: formato.alto, pointerEvents: 'none' }}>
          <div ref={flyerRef} style={{ width: ANCHO, height: formato.alto }}>
            <Flyer partido={partido} torneo={torneo} datos={datos} tema={tema} formato={formato}/>
          </div>
        </div>

        {errorDescarga && <div style={{ marginTop: 12, color: '#d93025', fontSize: '.8rem', textAlign: 'center' }}>{errorDescarga}</div>}
        <button onClick={handleDescargar} disabled={descargando}
          style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a73e8', border: 'none', borderRadius: 12, padding: '14px', cursor: descargando ? 'wait' : 'pointer', color: '#fff', fontSize: '.95rem', fontWeight: 800, opacity: descargando ? 0.7 : 1 }}>
          <Download size={18}/> {descargando ? 'Generando imagen...' : 'Descargar / Compartir'}
        </button>
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: '.7rem', color: '#9aa0a6' }}>En el celular se abre "Guardar imagen" para que quede en tu galería.</div>
      </div>
    </div>
  )
}
