import { useState, useRef } from 'react'
import { Building2, Camera, Menu, X, ArrowLeftRight, LogOut } from 'lucide-react'
import PortalesMenu from './PortalesMenu'

// Piezas del portal del encargado de escenario, con el mismo look del resto de Golmebol
// (negro, tarjetas planas, acento verde) para que se sienta una sola app.

export const G = {
  bg: '#0a0a0a', card: '#161616', card2: '#1c1c1c', border: '#2a2a2a', soft: '#232323',
  text: '#ffffff', text2: '#c9c9c9', muted: '#8a8a8a', faint: '#6b6b6b',
  green: '#6fcf3d', greenDk: '#0a1a05', greenBg: 'rgba(111,207,61,.13)',
  gold: '#f5a623', goldBg: 'rgba(245,166,35,.14)',
  loss: '#e5433d', lossBg: 'rgba(229,67,61,.14)',
}

// Barra de arriba, compacta: logo + nombre del escenario + botón de menú.
// Todo lo "administrativo" (cambiar de escenario, de portal, salir) vive dentro del menú, no suelto en la pantalla.
export function EncabezadoEscenario({ nombre, logoUrl, rol, usuario, onLogo, subiendoLogo, onCambiarEscenario, onLogout }) {
  const [menu, setMenu] = useState(false)
  const inputRef = useRef(null)
  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${G.border}` }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: G.card2, border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Building2 size={22} color={G.muted}/>}
            </div>
            {onLogo && (
              <>
                <button onClick={() => inputRef.current?.click()} aria-label="Cambiar el logo del escenario" disabled={subiendoLogo}
                  style={{ position: 'absolute', right: -6, bottom: -6, width: 22, height: 22, borderRadius: '50%', background: G.green, border: `2px solid ${G.bg}`, color: G.greenDk, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                  <Camera size={11}/>
                </button>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { onLogo(e.target.files?.[0]); e.target.value = '' }}/>
              </>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: G.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
            <div style={{ fontSize: '.74rem', color: G.muted, marginTop: 2 }}>{rol}</div>
          </div>
          <button onClick={() => setMenu(true)} aria-label="Abrir el menú"
            style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: G.card, border: `1px solid ${G.border}`, color: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Menu size={20}/>
          </button>
        </div>
      </div>

      {menu && (
        <div role="dialog" aria-modal="true" aria-label="Menú" onClick={e => { if (e.target === e.currentTarget) setMenu(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: G.card, border: `1px solid ${G.border}`, borderRadius: '20px 20px 0 0', padding: '14px 0 20px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: G.text }}>Menú</div>
              <button onClick={() => setMenu(false)} aria-label="Cerrar el menú" style={{ width: 44, height: 44, borderRadius: 12, background: G.card2, border: `1px solid ${G.border}`, color: G.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            {onCambiarEscenario && (
              <button onClick={() => { setMenu(false); onCambiarEscenario() }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 54, padding: '0 16px', background: 'none', border: 'none', borderTop: `1px solid ${G.border}`, color: G.text, fontWeight: 700, fontSize: '.92rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <ArrowLeftRight size={19} color={G.muted}/> Cambiar de escenario
              </button>
            )}
            {usuario && (
              <div style={{ borderTop: `1px solid ${G.border}` }}>
                <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: G.muted, padding: '12px 16px 4px' }}>Ir a otro portal</div>
                <PortalesMenu usuario={usuario} actual="escenario" lista/>
              </div>
            )}
            <button onClick={onLogout}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 54, padding: '0 16px', background: 'none', border: 'none', borderTop: `1px solid ${G.border}`, color: '#ff7b72', fontWeight: 700, fontSize: '.92rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <LogOut size={19}/> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Botón de volver, siempre el mismo y siempre visible arriba de cada pantalla interna.
export function BotonVolver({ onClick, texto = 'Volver al inicio' }) {
  return (
    <button onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: '0 16px 0 12px', minHeight: 44, cursor: 'pointer', color: G.text, fontSize: '.88rem', fontWeight: 800, fontFamily: 'inherit' }}>
      <span style={{ fontSize: '1.15rem', lineHeight: 1, marginTop: -2 }}>‹</span> {texto}
    </button>
  )
}
