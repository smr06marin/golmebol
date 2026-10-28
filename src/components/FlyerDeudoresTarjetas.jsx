import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { capturarFlyerBlob, compartirOBajarBlobs } from '../lib/flyerDescarga'
import { TEMAS_RESULTADO } from '../lib/flyerTemas'
import SelectorTemaFlyer from './SelectorTemaFlyer'

// Flyer de DEUDORES DE TARJETAS para mandar a los grupos de WhatsApp: por cada
// jugador sale su nombre (y equipo), la tarjeta que debe y la plata. Mismo
// sistema que los otros flyers: se dibuja siempre a tamaño real (1080 de
// ancho); la vista previa es una copia encogida con transform:scale() y la
// descarga captura copias ocultas, sin transform, para que html2canvas dé
// exactamente 1080×1920 (historia) o 1080×1350 (post).
//
// Si hay más deudores de los que caben en una imagen, NO se esconden: se
// reparten en varias imágenes (1/2, 2/2…) y se comparten todas juntas.
//
// deudores: [{ player_id, nombre, equipo, total, items:[{ tipo, monto }] }]
// subtituloEquipo: nombre del equipo si la lista está filtrada por uno (opcional)

const ANCHO = 1080
const FORMATOS = [
  { id: 'historia', nombre: 'Historia', sub: '1080×1920', alto: 1920, padY: 84, filas: 10, torneo: 74, fila: 108 },
  { id: 'post',     nombre: 'Post',     sub: '1080×1350', alto: 1350, padY: 52, filas: 6,  torneo: 60, fila: 104 },
]

const F_TITULO = "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif"
const F_TEXTO = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"
const PAD_X = 52
const HUECO = 10
const COLOR_TARJETA = { Amarilla: '#f9c70c', Azul: '#2f6fe0', Roja: '#e5282b' }
const ORDEN_TARJETA = ['Amarilla', 'Azul', 'Roja']

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

// Cuántas tarjetas de cada tipo debe el jugador (se cuenta la tarjeta que se le cobra en cada partido)
function resumenTarjetas(d) {
  const cuenta = {}
  ;(d.items || []).forEach(it => {
    const t = it.tipo || 'Amarilla'
    cuenta[t] = (cuenta[t] || 0) + 1
  })
  const tipos = Object.keys(cuenta).sort((a, b) => (ORDEN_TARJETA.indexOf(a) + 99) % 99 - (ORDEN_TARJETA.indexOf(b) + 99) % 99)
  return tipos.map(t => ({ tipo: t, n: cuenta[t] }))
}

function Tarjeta({ tipo, n }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 38, height: 54, borderRadius: 7, background: COLOR_TARJETA[tipo] || '#aaa', boxShadow: '0 3px 8px rgba(0,0,0,.35)', transform: 'rotate(-6deg)' }}/>
      {n > 1 && <span style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: 44, lineHeight: 1, color: '#fff' }}>×{n}</span>}
    </div>
  )
}

// Letra grande si el nombre es corto; si es largo se achica y, si aun así no
// cabe en una línea, pasa a dos (nunca se corta con puntos suspensivos).
function tamanoNombre(nombre, disp) {
  const l = Math.max(String(nombre || '').length, 1)
  const fs1 = Math.floor(disp / (l * 0.68))
  if (fs1 >= 34) return { fs: Math.min(50, fs1), lineas: 1 }
  const fs2 = Math.floor(disp / (Math.ceil(l / 2 + 2) * 0.68))
  return { fs: Math.max(28, Math.min(32, fs2)), lineas: 2 }
}

function Flyer({ torneo, pagina, totalPaginas, filas, totalGeneral, cantidad, subtituloEquipo, mostrarEquipo, fecha, tema, formato }) {
  const nombreTorneo = (torneo || '').toUpperCase()
  const ANCHO_NOMBRE = 560
  return (
    <div style={{
      width: ANCHO, height: formato.alto, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      background: `linear-gradient(180deg, ${tema.arriba} 0%, ${tema.abajo} 72%)`, color: '#fff', fontFamily: F_TEXTO,
    }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 900, background: `radial-gradient(ellipse at 50% 0%, ${tema.luz} 0%, rgba(0,0,0,0) 62%)` }}/>
      <div style={{ position: 'absolute', left: -60, right: -60, bottom: 150, height: 4, background: 'rgba(255,255,255,.08)' }}/>
      <div style={{ position: 'absolute', left: '50%', bottom: -380, width: 760, height: 760, marginLeft: -380, borderRadius: '50%', border: '4px solid rgba(255,255,255,.08)', boxSizing: 'border-box' }}/>

      <div style={{ position: 'relative', zIndex: 2, height: '100%', boxSizing: 'border-box', padding: `${formato.padY}px ${PAD_X}px ${formato.padY - 8}px`, display: 'flex', flexDirection: 'column' }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F_TITULO, fontSize: 30, letterSpacing: 10, color: 'rgba(255,255,255,.55)', lineHeight: 1, marginBottom: 18 }}>GOLMEBOL</div>
          <div style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: formato.torneo, lineHeight: 1.02, letterSpacing: 1, textTransform: 'uppercase', maxHeight: formato.torneo * 2.1, overflow: 'hidden' }}>{nombreTorneo}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontFamily: F_TITULO, fontSize: 44, letterSpacing: 4, lineHeight: 1, background: tema.acento, color: '#10101c', borderRadius: 12, padding: '10px 26px 8px' }}>DEUDORES DE TARJETAS</span>
            {subtituloEquipo && (
              <span style={{ fontFamily: F_TITULO, fontSize: 44, letterSpacing: 4, lineHeight: 1, border: `3px solid ${tema.acento}`, color: tema.acentoSuave, borderRadius: 12, padding: '8px 24px 6px', maxWidth: 900, overflow: 'hidden', whiteSpace: 'nowrap' }}>{subtituloEquipo.toUpperCase()}</span>
            )}
            {totalPaginas > 1 && (
              <span style={{ fontFamily: F_TITULO, fontSize: 44, letterSpacing: 4, lineHeight: 1, border: '3px solid rgba(255,255,255,.4)', color: 'rgba(255,255,255,.85)', borderRadius: 12, padding: '8px 24px 6px' }}>{pagina}/{totalPaginas}</span>
            )}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', marginTop: 34 }}>
          {filas.map((d, i) => {
            const tarjetas = resumenTarjetas(d)
            const tn = tamanoNombre(d.nombre, ANCHO_NOMBRE)
            return (
              <div key={d.player_id || i} style={{
                height: formato.fila, marginBottom: HUECO, boxSizing: 'border-box', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px 0 26px',
                background: i % 2 === 0 ? 'rgba(255,255,255,.085)' : 'rgba(255,255,255,.04)',
              }}>
                <div style={{ width: 96, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {tarjetas.map(t => <Tarjeta key={t.tipo} tipo={t.tipo} n={t.n}/>)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: tn.fs, lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: tn.lineas === 1 ? 'nowrap' : 'normal', maxHeight: tn.fs * 1.05 * tn.lineas, overflow: 'hidden' }}>{d.nombre}</div>
                  {mostrarEquipo && (
                    <div style={{ fontFamily: F_TEXTO, fontWeight: 600, fontSize: 28, lineHeight: 1.1, marginTop: 2, color: tema.acentoSuave, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.equipo || 'Sin equipo'}</div>
                  )}
                </div>
                <div style={{ fontFamily: F_TITULO, fontSize: 68, lineHeight: 1, paddingTop: 4, color: tema.acento, whiteSpace: 'nowrap', textAlign: 'right' }}>{fmt(d.total)}</div>
              </div>
            )
          })}
        </div>

        {/* Total + fecha */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, background: tema.acento, color: '#10101c', padding: '14px 30px 10px' }}>
            <div style={{ fontFamily: F_TEXTO, fontWeight: 800, fontSize: 34, letterSpacing: 2, lineHeight: 1.1 }}>
              TOTAL QUE DEBEN<br/><span style={{ fontWeight: 600, fontSize: 28, letterSpacing: 1 }}>{cantidad} JUGADOR{cantidad === 1 ? '' : 'ES'}</span>
            </div>
            <div style={{ fontFamily: F_TITULO, fontSize: 84, lineHeight: 1, paddingTop: 4 }}>{fmt(totalGeneral)}</div>
          </div>
          <div style={{ marginTop: 14, textAlign: 'center', fontFamily: F_TEXTO, fontWeight: 600, fontSize: 30, letterSpacing: 1, color: tema.acentoSuave, textTransform: 'uppercase' }}>Actualizado el {fecha}</div>
        </div>
      </div>
    </div>
  )
}

export default function FlyerDeudoresTarjetas({ torneo, deudores, subtituloEquipo = '', onClose }) {
  const wrapperRef = useRef(null)
  const refs = useRef([])
  const [formatoId, setFormatoId] = useState('historia')
  const [temaId, setTemaId] = useState('rojo')
  const [pag, setPag] = useState(0)
  const [escala, setEscala] = useState(0.4)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState('')
  const [hoy] = useState(() => new Date())

  const formato = FORMATOS.find(f => f.id === formatoId) || FORMATOS[0]
  const tema = TEMAS_RESULTADO.find(t => t.id === temaId) || TEMAS_RESULTADO[0]
  const fecha = useMemo(() => hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), [hoy])

  // Con "todos los equipos" se ordena por equipo y nombre (más fácil de revisar en el grupo)
  const ordenados = useMemo(() => [...(deudores || [])].sort((a, b) =>
    subtituloEquipo ? (a.nombre || '').localeCompare(b.nombre || '', 'es') : ((a.equipo || '').localeCompare(b.equipo || '', 'es') || (a.nombre || '').localeCompare(b.nombre || '', 'es'))
  ), [deudores, subtituloEquipo])
  const totalGeneral = useMemo(() => ordenados.reduce((a, d) => a + (d.total || 0), 0), [ordenados])
  const paginas = useMemo(() => {
    const out = []
    for (let i = 0; i < ordenados.length; i += formato.filas) out.push(ordenados.slice(i, i + formato.filas))
    return out.length ? out : [[]]
  }, [ordenados, formato.filas])
  const paginaActual = Math.min(pag, paginas.length - 1)

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

  const propsFlyer = { torneo, totalPaginas: paginas.length, totalGeneral, cantidad: ordenados.length, subtituloEquipo, mostrarEquipo: !subtituloEquipo, fecha, tema, formato }

  async function handleDescargar() {
    setDescargando(true)
    setErrorDescarga('')
    try {
      const base = `${torneo || 'golmebol'}_deudores_tarjetas${subtituloEquipo ? `_${subtituloEquipo}` : ''}`.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')
      const blobs = []
      for (let i = 0; i < paginas.length; i++) {
        const b = await capturarFlyerBlob(refs.current[i], { scale: 1, width: ANCHO, height: formato.alto, backgroundColor: tema.abajo })
        if (b) blobs.push({ blob: b, filename: `${base}${paginas.length > 1 ? `_${i + 1}de${paginas.length}` : ''}_${formato.id}.png` })
      }
      await compartirOBajarBlobs(blobs, { shareTitle: `Deudores de tarjetas — ${torneo || ''}` })
    } catch (e) {
      console.error('Flyer de deudores: no se pudo generar la imagen', e)
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
  const flecha = deshabilitado => ({ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: deshabilitado ? 'default' : 'pointer', opacity: deshabilitado ? .4 : 1, color: '#3c4043', display: 'flex', alignItems: 'center', justifyContent: 'center' })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 620, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 540, maxHeight: '94vh', overflowY: 'auto',
        overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '18px 18px 22px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.95rem' }}>Flyer de deudores{subtituloEquipo ? ` · ${subtituloEquipo}` : ''}</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: 2 }}>Elige formato y color, y compártelo a los grupos</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16}/>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {FORMATOS.map(f => (
            <button key={f.id} type="button" onClick={() => { setFormatoId(f.id); setPag(0) }} style={boton(f.id === formatoId)}>
              {f.nombre} <span style={{ fontWeight: 500, opacity: 0.75 }}>· {f.sub}</span>
            </button>
          ))}
        </div>
        <SelectorTemaFlyer temas={TEMAS_RESULTADO} temaId={temaId} onElegir={setTemaId}/>

        {paginas.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
            <button type="button" aria-label="Imagen anterior" disabled={paginaActual === 0} onClick={() => setPag(paginaActual - 1)} style={flecha(paginaActual === 0)}><ChevronLeft size={18}/></button>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#3c4043' }}>Imagen {paginaActual + 1} de {paginas.length}</span>
            <button type="button" aria-label="Imagen siguiente" disabled={paginaActual === paginas.length - 1} onClick={() => setPag(paginaActual + 1)} style={flecha(paginaActual === paginas.length - 1)}><ChevronRight size={18}/></button>
          </div>
        )}

        {/* Vista previa: el flyer mide ANCHO×alto reales; solo se encoge por transform */}
        <div ref={wrapperRef} style={{ width: '100%' }}>
          <div style={{ width: ANCHO * escala, height: formato.alto * escala, margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.25)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: ANCHO, height: formato.alto, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
              <Flyer {...propsFlyer} pagina={paginaActual + 1} filas={paginas[paginaActual]}/>
            </div>
          </div>
        </div>

        {/* Copias a tamaño real, fuera de pantalla y SIN transform: son las que se capturan */}
        <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: ANCHO, pointerEvents: 'none' }}>
          {paginas.map((filas, i) => (
            <div key={i} ref={el => { refs.current[i] = el }} style={{ width: ANCHO, height: formato.alto }}>
              <Flyer {...propsFlyer} pagina={i + 1} filas={filas}/>
            </div>
          ))}
        </div>

        {errorDescarga && <div style={{ marginTop: 12, color: '#d93025', fontSize: '.8rem', textAlign: 'center' }}>{errorDescarga}</div>}
        <button onClick={handleDescargar} disabled={descargando || !ordenados.length}
          style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a73e8', border: 'none', borderRadius: 12, padding: '14px', cursor: descargando ? 'default' : 'pointer', color: '#fff', fontWeight: 800, fontSize: '.95rem', opacity: descargando || !ordenados.length ? 0.7 : 1 }}>
          <Download size={18}/> {descargando ? 'Generando imagen...' : paginas.length > 1 ? `Descargar / Compartir (${paginas.length} imágenes)` : 'Descargar / Compartir'}
        </button>
        <button onClick={onClose}
          style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 12, padding: '13px', cursor: 'pointer', color: '#3c4043', fontWeight: 800, fontSize: '.95rem' }}>
          <X size={18}/> Cerrar flyer
        </button>
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: '.7rem', color: '#9aa0a6' }}>En el celular se abre "Guardar imagen" / compartir para que lo mandes directo al grupo.</div>
      </div>
    </div>
  )
}
