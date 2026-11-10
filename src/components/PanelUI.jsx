import { useState, useRef, Fragment } from 'react'
import { Menu, X, LogOut, Camera, User, ChevronRight, ChevronDown } from 'lucide-react'
import PortalesMenu from './PortalesMenu'
import { G, BotonVolver } from './EscenarioUI'

// Piezas del panel de inicio de TODOS los perfiles (árbitro, coordinador, escuela, jugador, acudiente, encargado de cancha):
// negro, tarjetas planas, acento verde, letra grande y todo ordenado igual para que se sienta una sola app.
export { G, BotonVolver }

const FUENTE = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
export const ETIQUETA = { fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: G.muted }

// Pantalla completa con el fondo y la letra del panel
export function PaginaPanel({ children, ancho = 640 }) {
  return (
    <div style={{ minHeight: '100vh', background: G.bg, fontFamily: FUENTE, color: G.text, paddingBottom: '48px', WebkitTextSizeAdjust: '100%' }}>
      {children}
    </div>
  )
}
export function CuerpoPanel({ children, ancho = 640 }) {
  return <div style={{ maxWidth: ancho + 'px', margin: '0 auto', padding: '22px 16px' }}>{children}</div>
}

// Barra de arriba: foto/logo + nombre + rol + botón de menú.
// items: [{ icono: <Icono/>, label, onClick, aviso, rojo }] — acciones sueltas que van dentro del menú.
export function EncabezadoPanel({ nombre, rol, avatarUrl, icono, forma = 'cuadrada', onAvatar, subiendoAvatar, usuario, actual, onLogout, items = [], avisoMenu }) {
  const [menu, setMenu] = useState(false)
  const inputRef = useRef(null)
  const radio = forma === 'redonda' ? '50%' : 12
  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${G.border}` }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: radio, overflow: 'hidden', background: G.card2, border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : (icono || <User size={22} color={G.muted}/>)}
            </div>
            {onAvatar && (
              <>
                <button onClick={() => inputRef.current?.click()} aria-label="Cambiar la foto" disabled={subiendoAvatar}
                  style={{ position: 'absolute', right: -6, bottom: -6, width: 24, height: 24, borderRadius: '50%', background: G.green, border: `2px solid ${G.bg}`, color: G.greenDk, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                  <Camera size={12}/>
                </button>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { onAvatar(e.target.files?.[0] || null); e.target.value = '' }}/>
              </>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.08rem', color: G.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
            <div style={{ fontSize: '.82rem', color: G.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rol}</div>
          </div>
          <button onClick={() => setMenu(true)} aria-label="Abrir el menú"
            style={{ position: 'relative', width: 48, height: 48, flexShrink: 0, borderRadius: 12, background: G.card, border: `1px solid ${G.border}`, color: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Menu size={22}/>
            {avisoMenu > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, background: G.loss, color: '#fff', fontSize: '.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', border: `2px solid ${G.bg}` }}>{avisoMenu}</span>}
          </button>
        </div>
      </div>

      {menu && (
        <div role="dialog" aria-modal="true" aria-label="Menú" onClick={e => { if (e.target === e.currentTarget) setMenu(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: G.card, border: `1px solid ${G.border}`, borderRadius: '20px 20px 0 0', padding: '14px 0 20px', maxHeight: '88vh', overflowY: 'auto', fontFamily: FUENTE }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: G.text }}>Menú</div>
              <button onClick={() => setMenu(false)} aria-label="Cerrar el menú" style={{ width: 48, height: 48, borderRadius: 12, background: G.card2, border: `1px solid ${G.border}`, color: G.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            {items.map((it, i) => (
              <button key={i} onClick={() => { setMenu(false); it.onClick?.() }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 58, padding: '0 16px', background: 'none', border: 'none', borderTop: `1px solid ${G.border}`, color: it.rojo ? '#ff7b72' : G.text, fontWeight: 700, fontSize: '1rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ display: 'flex', color: it.rojo ? '#ff7b72' : G.muted }}>{it.icono}</span>
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.aviso ? <span style={{ background: G.lossBg, color: '#ff7b72', borderRadius: 999, fontSize: '.74rem', fontWeight: 800, padding: '3px 10px' }}>{it.aviso}</span> : null}
              </button>
            ))}
            {usuario && <PortalesMenu usuario={usuario} actual={actual} lista conTitulo/>}
            <button onClick={onLogout}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 58, padding: '0 16px', background: 'none', border: 'none', borderTop: `1px solid ${G.border}`, color: '#ff7b72', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <LogOut size={20}/> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// "Hola, Sebastian / ¿Qué quieres hacer hoy?"
export function Saludo({ nombre, texto = '¿Qué quieres hacer hoy?' }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, wordBreak: 'break-word' }}>Hola, {nombre}</div>
      <div style={{ fontSize: '1rem', color: G.muted, marginTop: '4px' }}>{texto}</div>
    </div>
  )
}

// Tarjeta con título en mayúsculas arriba y contenido abajo
export function TarjetaPanel({ icono: Icono, titulo, derecha, children, sinRelleno = false, style }) {
  return (
    <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: '18px', overflow: 'hidden', marginBottom: '14px', ...style }}>
      {titulo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '13px 16px', background: G.card2, borderBottom: `1px solid ${G.border}` }}>
          <span style={{ ...ETIQUETA, fontSize: '.76rem', display: 'flex', alignItems: 'center', gap: '8px' }}>{Icono && <Icono size={15}/>} {titulo}</span>
          {derecha ? <span style={{ fontSize: '.84rem', color: G.muted, fontWeight: 600 }}>{derecha}</span> : null}
        </div>
      )}
      <div style={{ padding: sinRelleno ? 0 : '16px' }}>{children}</div>
    </div>
  )
}

// Números grandes lado a lado: [{ valor, etiqueta, color }]
export function CifrasPanel({ cifras }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cifras.map((_, i) => (i ? '1px 1fr' : '1fr')).join(' '), alignItems: 'center', marginBottom: '14px' }}>
      {cifras.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <div style={{ width: 1, height: 52, background: G.border }}/>}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.7rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-.03em' }}>{c.valor}</div>
            <div style={{ fontSize: '.9rem', color: G.text2, fontWeight: 700, marginTop: '7px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {c.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }}/>} {c.etiqueta}
            </div>
          </div>
        </Fragment>
      ))}
    </div>
  )
}

export function BarraPanel({ pct, color = G.green }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: G.soft, overflow: 'hidden', marginBottom: '16px' }} aria-hidden="true">
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 999 }}/>
    </div>
  )
}

// Botón verde grande: la acción principal de la tarjeta
export function BotonVerde({ onClick, children, deshabilitado, flecha = true }) {
  return (
    <button onClick={onClick} disabled={deshabilitado}
      style={{ boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 58, border: 'none', borderRadius: 16, cursor: deshabilitado ? 'default' : 'pointer', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'inherit', background: deshabilitado ? G.soft : G.green, color: deshabilitado ? G.faint : G.greenDk }}>
      {children} {flecha && <ChevronRight size={22}/>}
    </button>
  )
}

// Botón con borde: acción secundaria
export function BotonContorno({ onClick, children, icono }) {
  return (
    <button onClick={onClick}
      style={{ boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 56, border: `1px solid ${G.border}`, borderRadius: 16, cursor: 'pointer', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'inherit', background: G.card2, color: G.text }}>
      {icono} {children}
    </button>
  )
}

// Fila grande con icono, título, explicación corta y flecha
export function FilaPanel({ icono: Icono, titulo, sub, aviso, onClick, verde = false, style }) {
  return (
    <button onClick={onClick}
      style={{ boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minHeight: 66, padding: '9px 14px', background: G.card2, border: `1px solid ${G.border}`, borderRadius: 16, cursor: 'pointer', color: G.text, fontFamily: 'inherit', textAlign: 'left', ...style }}>
      {Icono && <span style={{ width: 40, height: 40, borderRadius: 11, background: verde ? G.greenBg : G.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icono size={20} color={verde ? G.green : G.muted}/></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: '1.02rem' }}>{titulo}</span>
        {sub ? <span style={{ display: 'block', fontSize: '.86rem', color: G.muted, marginTop: 2, lineHeight: 1.35 }}>{sub}</span> : null}
      </span>
      {aviso ? <span style={{ background: G.goldBg, color: G.gold, borderRadius: 999, fontSize: '.74rem', fontWeight: 800, padding: '3px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}>{aviso}</span> : null}
      <ChevronRight size={20} color={G.muted} style={{ flexShrink: 0 }}/>
    </button>
  )
}

// Aviso importante arriba de todo (borde dorado o rojo)
export function AvisoPanel({ icono: Icono, titulo, sub, onClick, color = G.gold }) {
  return (
    <button onClick={onClick}
      style={{ boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 66, padding: '10px 14px', marginBottom: 14, background: G.card, border: `1px solid ${G.border}`, borderLeft: `4px solid ${color}`, borderRadius: 16, cursor: onClick ? 'pointer' : 'default', color: G.text, textAlign: 'left', fontFamily: 'inherit' }}>
      {Icono && <Icono size={22} color={color} style={{ flexShrink: 0 }}/>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: '1rem' }}>{titulo}</span>
        {sub ? <span style={{ display: 'block', fontSize: '.84rem', color: G.muted, marginTop: 2 }}>{sub}</span> : null}
      </span>
      {onClick && <ChevronRight size={20} color={G.muted} style={{ flexShrink: 0 }}/>}
    </button>
  )
}

// "Más opciones": cerrado por defecto para no abrumar. Adentro, filas (FilaPanel) o grupos con título.
export function MasOpciones({ titulo = 'Más opciones', hayAvisos = false, children }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
        style={{ boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 60, padding: '0 16px', background: G.card, border: `1px solid ${G.border}`, borderRadius: 18, cursor: 'pointer', color: G.text, fontWeight: 800, fontSize: '1.05rem', fontFamily: 'inherit' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {titulo}
          {!abierto && hayAvisos && <span aria-label="Hay avisos adentro" style={{ width: 9, height: 9, borderRadius: '50%', background: G.gold }}/>}
        </span>
        {abierto ? <ChevronDown size={22} color={G.muted}/> : <ChevronRight size={22} color={G.muted}/>}
      </button>
      {abierto && <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
    </>
  )
}
