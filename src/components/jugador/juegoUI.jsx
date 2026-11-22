import { Children, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { urlMini, alFallarMini } from '../../lib/imagenMini'
import { J, FT, HEXAGONO, recorte, useContador, leerAbierto, guardarAbierto } from './juegoEstilo'

// Piezas de la pantalla con estilo de videojuego (colores, letras y animaciones en juegoEstilo.js)

export function Contador({ valor, ms }) {
  return <>{useContador(valor, ms)}</>
}

// Panel con esquinas cortadas y borde de luz (el borde puede ser un color o un degradado)
export function Panel({ children, borde = J.linea, fondo = J.panel, corte = 16, retraso = 0, style, interior }) {
  const clip = recorte(corte)
  return (
    <div className="gj-entra" style={{ clipPath: clip, WebkitClipPath: clip, background: borde, padding: 1.5, marginBottom: 10, animationDelay: `${retraso}s`, ...style }}>
      <div style={{ clipPath: clip, WebkitClipPath: clip, background: fondo, position: 'relative', overflow: 'hidden', ...interior }}>
        {children}
      </div>
    </div>
  )
}

// Ícono dentro de un hexágono de color
export function IconoHex({ children, color = J.green, size = 46, lleno = false }) {
  return (
    <span style={{ width: size, height: size, flexShrink: 0, clipPath: HEXAGONO, WebkitClipPath: HEXAGONO,
      background: lleno ? `linear-gradient(160deg, ${color}, ${color}bb)` : `linear-gradient(160deg, ${color}40, ${color}1a)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .46, lineHeight: 1 }}>
      {children}
    </span>
  )
}

// ── Sección desplegable ────────────────────────────────────────────────────────
// Cerrada: una fila limpia con ícono, título y un resumen corto (lo más importante de un vistazo).
// Al tocarla se abre y muestra todo. Se recuerda en el celular qué secciones dejó abiertas.
export function Desplegable({ id, icono, color = J.green, titulo, resumen, derecha, abiertoPorDefecto = false, retraso = 0, children }) {
  const [abierto, setAbierto] = useState(() => leerAbierto(id, abiertoPorDefecto))
  const alternar = () => setAbierto(a => { guardarAbierto(id, !a); return !a })
  // Otra parte de la pantalla puede pedir que esta sección se abra (ver abrirSeccion en juegoEstilo.js)
  useEffect(() => {
    const abrir = e => { if (e.detail === id) setAbierto(true) }
    window.addEventListener('gj-abrir', abrir)
    return () => window.removeEventListener('gj-abrir', abrir)
  }, [id])
  return (
    <div id={`gj-${id}`} style={{ scrollMarginTop: 84 }}>
    <Panel retraso={retraso}
      borde={abierto ? `linear-gradient(160deg, ${color}cc, ${color}22 40%, rgba(255,255,255,.07))` : J.linea}
      fondo={abierto ? `radial-gradient(90% 50% at 0% 0%, ${color}1c, transparent 70%), ${J.panel}` : J.panel}>
      <button type="button" onClick={alternar} aria-expanded={abierto} className="gj-boton"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 72, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: J.text, fontFamily: FT }}>
        <IconoHex color={color}>{icono}</IconoHex>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '1.12rem', fontWeight: 800, lineHeight: 1.2 }}>{titulo}</span>
          {resumen && <span style={{ display: 'block', fontSize: '.98rem', fontWeight: 500, color: J.text2, marginTop: 3, lineHeight: 1.3 }}>{resumen}</span>}
        </span>
        {derecha}
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', background: abierto ? `${color}26` : 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronDown className="gj-flecha" size={22} color={abierto ? color : J.text2} style={{ transform: abierto ? 'rotate(180deg)' : 'none' }}/>
        </span>
      </button>
      {abierto && (
        <div className="gj-abre" style={{ padding: '2px 14px 16px', fontFamily: FT }}>
          {children}
        </div>
      )}
    </Panel>
    </div>
  )
}

// Botón grande de juego (verde u oro lleno, o con contorno)
export function BotonJuego({ children, onClick, variante = 'verde', style }) {
  const clip = recorte(10)
  if (variante === 'verde' || variante === 'oro') {
    const oro = variante === 'oro'
    return (
      <button type="button" onClick={onClick} className="gj-boton"
        style={{ position: 'relative', overflow: 'hidden', width: '100%', minHeight: 50, border: 'none', cursor: 'pointer', clipPath: clip, WebkitClipPath: clip,
          background: oro ? `linear-gradient(180deg, ${J.goldLuz} 0%, ${J.gold} 60%, #d08f0a 100%)` : `linear-gradient(180deg, ${J.greenLuz} 0%, ${J.green} 55%, #4fa826 100%)`,
          color: oro ? '#2a1a00' : J.greenDk,
          fontFamily: FT, fontWeight: 900, fontSize: '1.05rem', letterSpacing: '.01em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, ...style }}>
        <span aria-hidden="true" className="gj-anim" style={{ position: 'absolute', inset: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)', animation: 'gjBrillo 3.2s ease-in-out infinite' }}/>
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>{children}</span>
      </button>
    )
  }
  return (
    <button type="button" onClick={onClick} className="gj-boton"
      style={{ width: '100%', minHeight: 48, border: 'none', padding: 1.5, cursor: 'pointer', clipPath: clip, WebkitClipPath: clip, background: 'rgba(255,255,255,.22)', ...style }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 45, clipPath: clip, WebkitClipPath: clip, background: '#121513',
        color: J.text, fontFamily: FT, fontWeight: 800, fontSize: '1rem' }}>
        {children}
      </span>
    </button>
  )
}

// Escudo: el logo en un cuadrito blanco; sin logo, un hexágono con las iniciales
export function Escudo({ url, nombre, size = 44 }) {
  if (url) {
    return (
      <span style={{ width: size, height: size, borderRadius: Math.max(10, Math.round(size * .2)), background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}>
        <img src={urlMini(url, size)} onError={alFallarMini} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}/>
      </span>
    )
  }
  const ini = String(nombre || '?').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
  return (
    <span style={{ width: size, height: size, flexShrink: 0, clipPath: HEXAGONO, WebkitClipPath: HEXAGONO, background: 'linear-gradient(160deg, #3a4a3c, #1a221c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: FT, fontWeight: 900, fontSize: size * .3, color: J.text, lineHeight: 1 }}>{ini}</span>
    </span>
  )
}

// Barra que se llena al aparecer
export function Barra({ pct, color = J.green, alto = 8, fondo = 'rgba(255,255,255,.08)', retraso = .2 }) {
  return (
    <div style={{ height: alto, borderRadius: 999, background: fondo, overflow: 'hidden' }} aria-hidden="true">
      <div className="gj-anim" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}99`, transformOrigin: 'left', animation: `gjLlena .9s cubic-bezier(.2,.8,.2,1) ${retraso}s both` }}/>
    </div>
  )
}

// Pastilla de texto
export function Chip({ children, color = J.gold }) {
  return <span style={{ fontFamily: FT, fontSize: '.9rem', fontWeight: 700, color, background: `${color}1c`, border: `1px solid ${color}44`, borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>{children}</span>
}

// Hexágonos con los últimos resultados (G verde, E gris, P rojo)
export function FormaReciente({ resultados = [] }) {
  const R = { win: ['G', J.green], draw: ['E', J.gris], loss: ['P', J.red] }
  return (
    <span style={{ display: 'flex', gap: 3 }} aria-hidden="true">
      {resultados.map((r, i) => {
        const [l, c] = R[r] || ['–', J.muted]
        return <span key={i} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: HEXAGONO, WebkitClipPath: HEXAGONO, background: c, color: '#0a0a0a', fontFamily: FT, fontWeight: 900, fontSize: '.78rem' }}>{l}</span>
      })}
    </span>
  )
}

// ── Carrusel: tarjetas que se deslizan de lado; se asoma un pedacito de la siguiente y los puntitos
// de abajo dicen en cuál va (también se pueden tocar). Con una sola tarjeta se ve normal, a todo lo ancho.
export function Carrusel({ children, color = J.gold, nombres = [] }) {
  const items = Children.toArray(children)
  const ref = useRef(null)
  const [actual, setActual] = useState(0)
  const varios = items.length > 1
  const alDeslizar = () => {
    const el = ref.current
    if (!el) return
    const ancho = el.firstChild?.offsetWidth || el.clientWidth
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / (ancho + 12))))
    if (i !== actual) setActual(i)
  }
  const irA = i => {
    const el = ref.current
    const hijo = el?.children?.[i]
    if (el && hijo) el.scrollTo({ left: Math.max(0, hijo.offsetLeft - (el.clientWidth - hijo.offsetWidth) / 2), behavior: 'smooth' })
  }
  return (
    <div>
      <div ref={ref} onScroll={varios ? alDeslizar : undefined} className="gj-sin-barra"
        style={{ position: 'relative', display: 'flex', gap: 12, overflowX: varios ? 'auto' : 'visible', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {items.map((it, i) => (
          <div key={i} style={{ flex: varios ? '0 0 86%' : '1 1 100%', minWidth: 0, scrollSnapAlign: 'center' }}>{it}</div>
        ))}
      </div>
      {varios && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {items.map((_, i) => (
            <button key={i} type="button" onClick={() => irA(i)} aria-label={`Ver ${nombres[i] || i + 1}`}
              style={{ width: i === actual ? 22 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: i === actual ? color : 'rgba(255,255,255,.25)', transition: 'width .25s ease, background .25s ease' }}/>
          ))}
        </div>
      )}
    </div>
  )
}
