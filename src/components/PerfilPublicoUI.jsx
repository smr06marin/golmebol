import { useState, useCallback, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Share2, Check, Shield, User } from 'lucide-react'
import { textoPuesto } from '../lib/rankings'

// La ventana con el ranking completo se baja solo cuando alguien toca un puesto
const RankingModal = lazy(() => import('./RankingModal'))

// Piezas compartidas por los perfiles públicos de equipo (/e/:id) y de
// jugador (/j/:id): cabecera con botón de volver, escudo/foto, chips de
// forma, tarjetas de números y pestañas. Mismo look oscuro con acento verde
// que la página de inicio de Golmebol, para que se sienta una sola app.

export const C = {
  bg: '#0a0a0a', card: '#161616', card2: '#1c1c1c', border: '#2a2a2a', soft: '#232323',
  text: '#ffffff', text2: '#c9c9c9', muted: '#8a8a8a', faint: '#6b6b6b',
  green: '#6fcf3d', greenDk: '#0a1a05',
  win: '#6fcf3d', winBg: 'rgba(111,207,61,.14)', draw: '#a0a0a0', drawBg: 'rgba(255,255,255,.08)', loss: '#e5433d', lossBg: 'rgba(229,67,61,.15)',
  gold: '#f5a623', goldBg: 'rgba(245,166,35,.15)',
  // Fondo de la cabecera de los perfiles: negro con un resplandor verde muy suave arriba.
  cabecera: { background: 'radial-gradient(120% 90% at 50% -15%, rgba(111,207,61,.2) 0%, rgba(111,207,61,0) 62%), linear-gradient(180deg, #111a0d 0%, #0d0d0d 100%)', borderBottom: '1px solid #2a2a2a' },
}
const BOTON_CABECERA = { display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', border: `1px solid ${C.border}`, background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }

// Volver: a la página anterior si la hay; si se entró directo por un link, al inicio.
// (key === 'default' → es la primera pantalla de este router, no hay "atrás".)
export function useVolver() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.key && location.key !== 'default') navigate(-1)
    else navigate('/')
  }, [navigate, location.key])
}

// Compartir el perfil: hoja nativa del celular (WhatsApp, etc.); si no existe, copia el link.
export function BotonCompartir({ titulo, ruta }) {
  const [copiado, setCopiado] = useState(false)
  async function compartir() {
    const url = `${window.location.origin}${ruta}`
    try {
      if (navigator.share) { await navigator.share({ title: titulo, text: titulo, url }); return }
    } catch (e) { if (e && e.name === 'AbortError') return }
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true); setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copia este link:', url)
    }
  }
  return (
    <button type="button" onClick={compartir} aria-label={`Compartir ${titulo}`}
      style={{ ...BOTON_CABECERA, padding: '8px 14px' }}>
      {copiado ? <><Check size={15}/> Link copiado</> : <><Share2 size={15}/> Compartir</>}
    </button>
  )
}

export function Escudo({ url, nombre, size = 32, radio = 8, fondo = '#fff' }) {
  const iniciales = (nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: radio, overflow: 'hidden', flexShrink: 0, background: url ? fondo : 'linear-gradient(135deg,#1d3a12,#2f6a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt={nombre || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size > 40 ? '4px' : '2px' }}/>
        : <span style={{ fontSize: size * 0.34 + 'px', fontWeight: 800, color: '#fff' }}>{iniciales || <Shield size={size * 0.45} color="#fff"/>}</span>}
    </div>
  )
}

export function FotoJugador({ url, nombre, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: C.soft, border: `2px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt={nombre || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        : <User size={size * 0.5} color={C.faint}/>}
    </div>
  )
}

const COLOR_FORMA = { G: [C.win, C.winBg], E: [C.draw, C.drawBg], P: [C.loss, C.lossBg] }
export function ChipForma({ letra, size = 24 }) {
  const [fg, bg] = COLOR_FORMA[letra] || COLOR_FORMA.E
  return <span style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, border: `1.5px solid ${fg}`, fontSize: size * 0.46 + 'px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{letra}</span>
}

// Chip de puesto en el ranking: "3° ranking de 48". Oro el 1°, verde del 2° al 3°, gris el resto.
// etiqueta → texto antes (ej. "Goles"). compacto (o apilado/claro, por compatibilidad) → solo "3°", para cuadros angostos
// como los números de la cabecera (el significado se explica en una nota debajo).
// p = { n, de } (null/undefined = no se pinta nada, así un dato sin puesto no deja un hueco raro).
export function ChipPuesto(props) {
  if (!props.p || !props.p.n) return null
  return <ChipPuestoInterno {...props}/>
}
function ChipPuestoInterno({ p, claro = false, etiqueta, apilado = false, compacto = false }) {
  const oro = p.n === 1, top = p.n <= 3
  const fondo = oro ? C.goldBg : top ? C.winBg : 'rgba(255,255,255,.07)'
  const color = oro ? C.gold : top ? C.win : C.muted
  const [abierto, setAbierto] = useState(false)
  // Con "k" (de qué dato es) el puesto se puede tocar y abre el ranking completo.
  // Puestos viejos guardados en el celular sin "k" se ven igual, sin tocar.
  const tocable = !!p.k && !!p.tipo
  const titulo = tocable ? textoPuesto(p) : `Puesto ${p.n} del ranking, de ${p.de}`
  const baseBoton = tocable
    ? { border: 'none', fontFamily: 'inherit', cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)', WebkitTapHighlightColor: 'transparent' }
    : {}
  const Marco = tocable ? 'button' : 'span'
  const propsMarco = tocable
    ? { type: 'button', 'aria-label': titulo, onClick: e => { e.stopPropagation(); e.preventDefault(); setAbierto(true) }, onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() } }
    : {}
  const modal = abierto && (
    <Suspense fallback={null}>
      <RankingModal p={p} onClose={() => setAbierto(false)}/>
    </Suspense>
  )
  if (compacto || apilado || claro) {
    return (
      <>
        <Marco {...propsMarco} title={titulo}
          style={{ display: 'inline-flex', alignItems: 'center', background: fondo, color, borderRadius: '999px', padding: tocable ? '3px 9px' : '2px 8px', fontSize: '.66rem', fontWeight: 800, lineHeight: 1.4, whiteSpace: 'nowrap', ...baseBoton }}>
          {p.n}°
        </Marco>
        {modal}
      </>
    )
  }
  return (
    <>
      <Marco {...propsMarco} title={titulo}
        style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px', background: fondo, color, borderRadius: '999px', padding: tocable ? '3px 9px' : '1px 8px', fontSize: '.64rem', fontWeight: 800, lineHeight: 1.5, whiteSpace: 'nowrap', ...baseBoton }}>
        {etiqueta && <span style={{ fontWeight: 600, opacity: .85 }}>{etiqueta}</span>}
        <span>{p.n}° ranking</span>
        <span style={{ fontWeight: 600, opacity: .8 }}>de {p.de}</span>
        {tocable && <span aria-hidden="true" style={{ fontWeight: 800, opacity: .8 }}>›</span>}
      </Marco>
      {modal}
    </>
  )
}

// Los colores que mandan las páginas (pensados para el degradado azul de antes) se traducen a la paleta oscura.
const COLOR_NUMERO = { '#a7f3d0': C.win, '#fecaca': C.loss, '#fde68a': C.gold, '#fff': '#fff' }
export function Numero({ valor, etiqueta, color = '#fff', puesto }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '12px 4px 10px', textAlign: 'center', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: COLOR_NUMERO[color] || color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '.58rem', fontWeight: 800, color: C.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: '7px', lineHeight: 1.25 }}>{etiqueta}</div>
      <div style={{ marginTop: 'auto', paddingTop: '7px', minHeight: '24px' }}>{puesto && <ChipPuesto p={puesto} compacto/>}</div>
    </div>
  )
}

// Explica el numerito de puesto ("3°") que aparece bajo los datos de la cabecera.
export function NotaPuestos({ children }) {
  return <div style={{ marginTop: '10px', fontSize: '.68rem', color: C.muted, lineHeight: 1.45 }}>{children}</div>
}

export function Pestanas({ tabs, activa, onCambiar }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: '4px', margin: '0 0 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={activa === t.id} onClick={() => onCambiar(t.id)}
          style={{ flex: '1 0 auto', border: 'none', borderRadius: '9px', padding: '9px 14px', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            background: activa === t.id ? 'rgba(111,207,61,.16)' : 'transparent', color: activa === t.id ? C.green : C.muted }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Tarjeta({ titulo, children, aside }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
      {titulo && (
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: '.78rem', color: C.muted, borderBottom: `1px solid ${C.border}`, background: C.card2, letterSpacing: '.08em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span>{titulo}</span>{aside}
        </div>
      )}
      {children}
    </div>
  )
}

export function Vacio({ children }) {
  return <div style={{ padding: '26px 16px', textAlign: 'center', color: C.faint, fontSize: '.85rem' }}>{children}</div>
}

export function PaginaCargando({ texto = 'Cargando…' }) {
  return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint, fontSize: '.9rem', fontFamily: 'system-ui, sans-serif' }}>{texto}</div>
}

export function NoEncontrado({ que }) {
  const volver = useVolver()
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: '2.2rem' }}>🔎</div>
      <div style={{ fontWeight: 800, color: C.text, fontSize: '1.05rem' }}>No encontramos {que}</div>
      <button onClick={volver} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '999px', border: 'none', background: C.green, color: C.greenDk, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}><ArrowLeft size={16}/> Volver</button>
    </div>
  )
}

export function BotonVolver({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Volver"
      style={{ ...BOTON_CABECERA, padding: '8px 14px 8px 10px' }}>
      <ArrowLeft size={16}/> Volver
    </button>
  )
}

export const fmtFecha = iso => {
  if (!iso) return 'Por definir'
  try { return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}
export const fmtHora = iso => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) } catch { return '' }
}
