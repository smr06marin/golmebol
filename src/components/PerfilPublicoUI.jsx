import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Share2, Check, Shield, User } from 'lucide-react'

// Piezas compartidas por los perfiles públicos de equipo (/e/:id) y de
// jugador (/j/:id): cabecera con botón de volver, escudo/foto, chips de
// forma, tarjetas de números y pestañas. Mismo look claro que la página
// pública del torneo, para que se sienta una sola app.

export const C = {
  bg: '#f8f9fa', card: '#fff', border: '#e8eaed', soft: '#f1f3f4',
  text: '#202124', text2: '#3c4043', muted: '#5f6368', faint: '#9aa0a6',
  win: '#1e8e3e', winBg: '#e6f4ea', draw: '#80868b', drawBg: '#f1f3f4', loss: '#d93025', lossBg: '#fce8e6',
  gold: '#b06000', goldBg: '#fef7e0',
}

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
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
      {copiado ? <><Check size={15}/> Link copiado</> : <><Share2 size={15}/> Compartir</>}
    </button>
  )
}

export function Escudo({ url, nombre, size = 32, radio = 8, fondo = '#fff' }) {
  const iniciales = (nombre || '?').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: radio, overflow: 'hidden', flexShrink: 0, background: url ? fondo : 'linear-gradient(135deg,#1a73e8,#6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

export function Numero({ valor, etiqueta, color = C.text }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: '12px', padding: '9px 6px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: '4px' }}>{etiqueta}</div>
    </div>
  )
}

export function Pestanas({ tabs, activa, onCambiar }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: '4px', margin: '0 0 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '4px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={activa === t.id} onClick={() => onCambiar(t.id)}
          style={{ flex: '1 0 auto', border: 'none', borderRadius: '9px', padding: '9px 14px', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            background: activa === t.id ? 'var(--color-primario, #1a73e8)' : 'transparent', color: activa === t.id ? '#fff' : C.muted }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Tarjeta({ titulo, children, aside }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: '16px' }}>
      {titulo && (
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: '.78rem', color: C.text2, borderBottom: `1px solid ${C.soft}`, background: '#fafbfc', letterSpacing: '.05em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
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
      <button onClick={volver} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '999px', border: 'none', background: 'var(--color-primario, #1a73e8)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><ArrowLeft size={16}/> Volver</button>
    </div>
  )
}

export function BotonVolver({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Volver"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px 7px 10px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
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
