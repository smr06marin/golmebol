import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { descargarFlyer } from '../lib/flyerDescarga'
import { TEMAS_RESULTADO } from '../lib/flyerTemas'
import SelectorTemaFlyer from './SelectorTemaFlyer'
import LogoFlyer from './LogoFlyer'
import FranjaPatrocinadoresFlyer from './FranjaPatrocinadoresFlyer'
import { usePatrocinadoresFlyer } from '../lib/patrocinadoresFlyer'
import { useLogoLimpio } from '../lib/useLogoLimpio'

// Flyer de la TABLA DE POSICIONES para publicar en redes. Mismo sistema que el
// flyer de resultado: se dibuja siempre a tamaño real (1080 de ancho); la vista
// previa es una copia encogida con transform:scale() y la descarga captura otra
// copia oculta, sin transform, para que html2canvas dé exactamente 1080×1920
// (historia) o 1080×1350 (post). Las filas se ajustan solas al alto disponible:
// con pocos equipos salen grandes y con muchos se compactan (si aun así no caben,
// se avisa con "+N equipos").
//
// filas: [{ equipo:{ id, name, logo_url }, pj, pg, pe, pp, gf, gc, pts }] — ya ordenadas
// titulo:    "TABLA DE POSICIONES"
// subtitulo: "GRUPO A" (opcional)

const ANCHO = 1080
const FORMATOS = [
  // heroLogo: tamaño del logo del torneo (protagonista) · marca/marcaTop: el mismo logo
  // gigante y translúcido que decora el fondo detrás de la tabla
  { id: 'historia', nombre: 'Historia', sub: '1080×1920', alto: 1920, padY: 84, heroLogo: 400, torneo: 74, chip: 40, marca: 1250, marcaTop: 560 },
  { id: 'post',     nombre: 'Post',     sub: '1080×1350', alto: 1350, padY: 52, heroLogo: 250, torneo: 60, chip: 34, marca: 1040, marcaTop: 330 },
]

const F_TITULO = "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif"
const F_TEXTO = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"

const MIN_FILA = 54
const MAX_FILA = 124
const ALTO_CABECERA = 56
const HUECO = 7 // separación entre filas
const PAD_X = 52

const COLUMNAS = `56px minmax(0, 1fr) repeat(6, 54px) 68px 104px`
// Ancho aproximado de la columna del equipo (976 - 56 - 324 - 68 - 104)
const ANCHO_EQUIPO = 424
const ETIQUETAS = ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG']

function Escudo({ url, nombre, size }) {
  const iniciales = (nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const radio = Math.round(size * 0.22)
  if (url) return <LogoFlyer url={url} size={size} radio={radio} pad={Math.round(size * 0.08)}/>
  return (
    <div style={{ width: size, height: size, borderRadius: radio, background: '#fff', padding: Math.round(size * 0.08), boxSizing: 'border-box', flexShrink: 0 }}>
      <div style={{ width: '100%', height: '100%', borderRadius: radio * 0.6, background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: F_TITULO, fontSize: size * 0.42, color: '#fff', letterSpacing: 2 }}>{iniciales}</span>
      </div>
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

const dg = f => (Number(f.gf) || 0) - (Number(f.gc) || 0)
const fmtDg = n => (n > 0 ? `+${n}` : String(n))

// Nombre del equipo: una línea con letra grande si es corto; si es largo, letra
// más chica en hasta dos renglones (sin recortar con puntos suspensivos).
function tamanoNombre(nombre, rowH, esc) {
  const l = Math.max(String(nombre || '').length, 1)
  const base = Math.min(46, Math.round(rowH * 0.46))
  const disp = ANCHO_EQUIPO - 10 - 12 - esc - 6
  const ancho = 0.47 // ancho medio de una letra mayúscula, en "em", con el espaciado
  const fs1 = Math.floor(disp / (l * ancho))
  if (fs1 >= Math.round(base * 0.74)) return { fs: Math.min(base, fs1), lineas: 1 }
  const fs2 = Math.floor(disp / (ancho * (Math.ceil(l / 2) + 2)))
  return { fs: Math.max(16, Math.min(Math.round(base * 0.8), fs2)), lineas: 2 }
}

function Flyer({ torneo, filas, titulo, subtitulo, fecha, tema, formato }) {
  const tablaRef = useRef(null)
  const [alto, setAlto] = useState(0)

  useLayoutEffect(() => {
    const el = tablaRef.current
    if (!el) return
    const medir = () => setAlto(el.clientHeight)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [formato.id])

  const disponible = Math.max(0, alto - ALTO_CABECERA - 12)
  const capacidad = alto > 0 ? Math.max(3, Math.floor(disponible / MIN_FILA)) : 99
  const visibles = filas.length > capacidad ? filas.slice(0, capacidad - 1) : filas
  const ocultos = filas.length - visibles.length
  const nFilas = visibles.length + (ocultos > 0 ? 1 : 0)
  const rowH = alto > 0 ? Math.max(MIN_FILA, Math.min(MAX_FILA, Math.floor(disponible / Math.max(nFilas, 1)))) : 72

  const celda = { display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const nombreTorneo = (torneo?.name || '').toUpperCase()
  const logoLimpio = useLogoLimpio(torneo?.logo_url)
  const hero = !!torneo?.logo_url
  const columna = formato.id === 'historia'
  const chips = (
    <div style={{ display: 'flex', gap: 16, marginTop: hero ? (columna ? 30 : 22) : (columna ? 34 : 24), flexWrap: 'wrap', justifyContent: hero && columna ? 'center' : 'flex-start' }}>
      <span style={{ fontFamily: F_TITULO, fontSize: formato.chip, letterSpacing: 4, lineHeight: 1, background: tema.acento, color: '#10101c', borderRadius: 12, padding: '10px 26px 8px' }}>{titulo}</span>
      {subtitulo && (
        <span style={{ fontFamily: F_TITULO, fontSize: formato.chip, letterSpacing: 4, lineHeight: 1, border: `3px solid ${tema.acento}`, color: tema.acentoSuave, borderRadius: 12, padding: '8px 24px 6px' }}>{subtitulo}</span>
      )}
    </div>
  )
  const nombreEl = (
    <div style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: formato.torneo, lineHeight: 1.02, letterSpacing: 1, textTransform: 'uppercase', maxHeight: formato.torneo * 2.1, overflow: 'hidden' }}>{nombreTorneo}</div>
  )

  return (
    <div style={{
      width: ANCHO, height: formato.alto, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      background: `linear-gradient(180deg, ${tema.arriba} 0%, ${tema.abajo} 72%)`, color: '#fff', fontFamily: F_TEXTO,
    }}>
      {/* Foco de luz + reflectores + líneas de cancha (decoración) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 900, background: `radial-gradient(ellipse at 50% 0%, ${tema.luz} 0%, rgba(0,0,0,0) 62%)` }}/>
      <div style={{ position: 'absolute', top: -160, left: 30, width: 250, height: 1250, transform: 'rotate(-17deg)', transformOrigin: 'top left', background: `linear-gradient(180deg, ${tema.luz} 0%, rgba(0,0,0,0) 80%)`, opacity: 0.35 }}/>
      <div style={{ position: 'absolute', top: -160, right: 30, width: 250, height: 1250, transform: 'rotate(17deg)', transformOrigin: 'top right', background: `linear-gradient(180deg, ${tema.luz} 0%, rgba(0,0,0,0) 80%)`, opacity: 0.35 }}/>
      <div style={{ position: 'absolute', left: -60, right: -60, bottom: 150, height: 4, background: 'rgba(255,255,255,.08)' }}/>
      <div style={{ position: 'absolute', left: '50%', bottom: -380, width: 760, height: 760, marginLeft: -380, borderRadius: '50%', border: '4px solid rgba(255,255,255,.08)', boxSizing: 'border-box' }}/>

      {/* Marca de agua: el logo del torneo gigante y translúcido detrás de la tabla */}
      {typeof logoLimpio === 'string' && (
        <img src={logoLimpio} alt="" style={{ position: 'absolute', left: Math.round((ANCHO - formato.marca) / 2), top: formato.marcaTop, width: formato.marca, height: formato.marca, objectFit: 'contain', opacity: 0.1 }}/>
      )}

      <div style={{ position: 'relative', zIndex: 2, height: '100%', boxSizing: 'border-box', padding: `${formato.padY}px ${PAD_X}px ${formato.padY - 8}px`, display: 'flex', flexDirection: 'column' }}>

        {/* Torneo: el logo es el protagonista */}
        {hero ? (
          <div style={columna ? { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' } : { display: 'flex', alignItems: 'center', gap: 36 }}>
            <div style={{ position: 'relative', width: formato.heroLogo, height: formato.heroLogo, flexShrink: 0 }}>
              <div style={{ position: 'absolute', left: -Math.round(formato.heroLogo * 0.35), top: -Math.round(formato.heroLogo * 0.35), width: Math.round(formato.heroLogo * 1.7), height: Math.round(formato.heroLogo * 1.7), borderRadius: '50%', background: `radial-gradient(circle, ${tema.luz} 0%, rgba(0,0,0,0) 65%)` }}/>
              <div style={{ position: 'relative' }}>
                <LogoFlyer url={torneo.logo_url} size={formato.heroLogo} radio={Math.round(formato.heroLogo * 0.16)} pad={Math.round(formato.heroLogo * 0.05)}/>
              </div>
            </div>
            <div style={columna ? { marginTop: 30, width: '100%' } : { flex: 1, minWidth: 0 }}>
              {nombreEl}
              {chips}
            </div>
          </div>
        ) : (
          <>
            {nombreEl}
            {chips}
          </>
        )}

        {/* Tabla */}
        <div ref={tablaRef} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', marginTop: formato.id === 'historia' ? 40 : 28, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {/* Encabezado de columnas */}
          <div style={{ height: ALTO_CABECERA, display: 'grid', gridTemplateColumns: COLUMNAS, alignItems: 'center', borderBottom: `3px solid ${tema.acento}`, boxSizing: 'border-box', fontFamily: F_TEXTO, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: tema.acentoSuave }}>
            <span style={{ ...celda }}>#</span>
            <span style={{ paddingLeft: 10 }}>EQUIPO</span>
            {ETIQUETAS.map(e => <span key={e} style={{ ...celda }}>{e}</span>)}
            <span style={{ ...celda, color: tema.acento }}>PTS</span>
          </div>
          <div style={{ height: 12 }}/>

          {visibles.map((f, i) => {
            const pos = i + 1
            const diff = dg(f)
            const nombre = f.equipo?.name || 'Equipo'
            const esc = Math.min(70, Math.round(rowH * 0.7))
            const tn = tamanoNombre(nombre, rowH, esc)
            const lider = pos === 1
            const caja = Math.min(64, Math.round(rowH * 0.66))
            const numFs = Math.min(46, Math.round(rowH * 0.44))
            return (
              <div key={f.equipo?.id || i} style={{
                height: rowH - HUECO, marginBottom: HUECO, display: 'grid', gridTemplateColumns: COLUMNAS, alignItems: 'center', boxSizing: 'border-box',
                borderRadius: 16,
                background: lider ? `linear-gradient(90deg, ${tema.luz} 0%, rgba(255,255,255,.07) 70%)` : (i % 2 === 0 ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)'),
                boxShadow: lider ? `inset 6px 0 0 ${tema.acento}` : 'none',
              }}>
                <div style={{ ...celda }}>
                  <div style={{
                    width: caja, height: caja, borderRadius: Math.round(caja * 0.28), display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: F_TITULO, fontSize: Math.round(caja * 0.78), lineHeight: 1, paddingTop: 2, boxSizing: 'border-box',
                    background: lider ? tema.acento : pos <= 3 ? 'rgba(255,255,255,.2)' : 'transparent',
                    color: lider ? '#10101c' : pos <= 3 ? '#fff' : 'rgba(255,255,255,.6)',
                  }}>{pos}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 10, minWidth: 0 }}>
                  <Escudo url={f.equipo?.logo_url} nombre={nombre} size={esc}/>
                  <div style={{
                    flex: 1, minWidth: 0, fontFamily: F_TEXTO, fontWeight: 800, fontSize: tn.fs, lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: 0.5,
                    color: lider ? '#fff' : 'rgba(255,255,255,.95)', maxHeight: tn.fs * 1.06 * tn.lineas, overflow: 'hidden',
                    whiteSpace: tn.lineas === 1 ? 'nowrap' : 'normal',
                  }}>{nombre}</div>
                </div>
                {[f.pj, f.pg, f.pe, f.pp, f.gf, f.gc].map((v, k) => (
                  <div key={k} style={{ ...celda, fontFamily: F_TEXTO, fontWeight: 700, fontSize: numFs, color: 'rgba(255,255,255,.92)', lineHeight: 1 }}>{Number(v) || 0}</div>
                ))}
                <div style={{ ...celda, fontFamily: F_TEXTO, fontWeight: 800, fontSize: numFs, lineHeight: 1, color: diff > 0 ? tema.acentoSuave : diff < 0 ? '#ff8a80' : 'rgba(255,255,255,.6)' }}>{fmtDg(diff)}</div>
                <div style={{ ...celda }}>
                  <div style={{
                    minWidth: 88, height: Math.round(rowH * 0.74), borderRadius: 14, background: tema.acento, color: '#10101c', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: F_TITULO, fontSize: Math.round(rowH * 0.6), lineHeight: 1, paddingTop: 3, boxSizing: 'border-box',
                    boxShadow: lider ? `0 0 28px ${tema.luz}` : 'none',
                  }}>{Number(f.pts) || 0}</div>
                </div>
              </div>
            )
          })}

          {ocultos > 0 && (
            <div style={{ height: rowH - HUECO, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F_TITULO, fontSize: Math.round(rowH * 0.5), letterSpacing: 5, color: tema.acentoSuave }}>
              +{ocultos} EQUIPO{ocultos === 1 ? '' : 'S'} MÁS
            </div>
          )}
        </div>

        {/* Fecha de actualización + marca */}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: F_TEXTO, fontWeight: 600, fontSize: 32, letterSpacing: 1, color: tema.acentoSuave, textTransform: 'uppercase' }}>
            <IconoCalendario color={tema.acento} size={34}/>Actualizada el {fecha}
          </div>
          <div style={{ fontFamily: F_TITULO, fontSize: 30, letterSpacing: 10, color: 'rgba(255,255,255,.45)', lineHeight: 1 }}>GOLMEBOL</div>
        </div>
      </div>
    </div>
  )
}

// Si el torneo lo organiza Golmebol, al pie va la franja blanca con los patrocinadores: el flyer
// conserva su tamaño total (1080×1920 / 1080×1350) y las filas se acomodan en el alto que queda.
function FlyerConBanda({ patrocinadores, ...props }) {
  const { formato } = props
  const alturaBanda = patrocinadores.length ? (formato.id === 'historia' ? 150 : 120) : 0
  if (!alturaBanda) return <Flyer {...props}/>
  return (
    <div style={{ width: ANCHO, height: formato.alto, background: '#fff', overflow: 'hidden' }}>
      <div style={{ width: ANCHO, height: formato.alto - alturaBanda, overflow: 'hidden' }}>
        <Flyer {...props} formato={{ ...formato, alto: formato.alto - alturaBanda }}/>
      </div>
      <FranjaPatrocinadoresFlyer patrocinadores={patrocinadores} ancho={ANCHO} alto={alturaBanda}/>
    </div>
  )
}

export default function FlyerTablaPosiciones({ torneo, filas, titulo = 'TABLA DE POSICIONES', subtitulo = '', onClose }) {
  const wrapperRef = useRef(null)
  const flyerRef = useRef(null)
  const [formatoId, setFormatoId] = useState('historia')
  const [temaId, setTemaId] = useState(TEMAS_RESULTADO[0].id)
  const [escala, setEscala] = useState(0.4)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState('')
  const [hoy] = useState(() => new Date())

  const formato = FORMATOS.find(f => f.id === formatoId) || FORMATOS[0]
  const tema = TEMAS_RESULTADO.find(t => t.id === temaId) || TEMAS_RESULTADO[0]
  const fecha = useMemo(() => hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), [hoy])
  const { lista: patrocinadores, listo: patroListo } = usePatrocinadoresFlyer(torneo)

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
      const base = `${torneo?.name || 'golmebol'}_tabla_posiciones${subtitulo ? `_${subtitulo}` : ''}`
        .replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')
      await descargarFlyer(flyerRef.current, {
        filename: `${base}_${formato.id}.png`,
        opcionesCanvas: { scale: 1, width: ANCHO, height: formato.alto, backgroundColor: tema.abajo },
        shareTitle: `${titulo}${subtitulo ? ` · ${subtitulo}` : ''} — ${torneo?.name || ''}`,
      })
    } catch (e) {
      console.error('Flyer de tabla: no se pudo generar la imagen', e)
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
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.95rem' }}>Flyer de la tabla{subtitulo ? ` · ${subtitulo}` : ''}</div>
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
              <FlyerConBanda torneo={torneo} filas={filas} titulo={titulo} subtitulo={subtitulo} fecha={fecha} tema={tema} formato={formato} patrocinadores={patrocinadores}/>
            </div>
          </div>
        </div>

        {/* Copia a tamaño real, fuera de pantalla y SIN transform: es la que se captura */}
        <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: ANCHO, height: formato.alto, pointerEvents: 'none' }}>
          <div ref={flyerRef} style={{ width: ANCHO, height: formato.alto }}>
            <FlyerConBanda torneo={torneo} filas={filas} titulo={titulo} subtitulo={subtitulo} fecha={fecha} tema={tema} formato={formato} patrocinadores={patrocinadores}/>
          </div>
        </div>

        {errorDescarga && <div style={{ marginTop: 12, color: '#d93025', fontSize: '.8rem', textAlign: 'center' }}>{errorDescarga}</div>}
        <button onClick={handleDescargar} disabled={descargando || !patroListo}
          style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a73e8', border: 'none', borderRadius: 12, padding: '14px', cursor: (descargando || !patroListo) ? 'default' : 'pointer', color: '#fff', fontWeight: 800, fontSize: '.95rem', opacity: (descargando || !patroListo) ? 0.7 : 1 }}>
          <Download size={18}/> {descargando ? 'Generando imagen...' : !patroListo ? 'Preparando flyer...' : 'Descargar / Compartir'}
        </button>
        <button onClick={onClose}
          style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 12, padding: '13px', cursor: 'pointer', color: '#3c4043', fontWeight: 800, fontSize: '.95rem' }}>
          <X size={18}/> Cerrar flyer
        </button>
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: '.7rem', color: '#9aa0a6' }}>En el celular se abre "Guardar imagen" para que quede en tu galería.</div>
      </div>
    </div>
  )
}
