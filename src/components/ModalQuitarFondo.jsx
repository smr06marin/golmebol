import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'

// Vista previa "antes / después" del recorte de fondo de un logo o escudo.
// Se muestra sobre cuadros (para ver la transparencia) y sobre fondo oscuro
// (como se verá en los flyers). La persona decide si aplica el cambio.
const CUADROS = 'repeating-conic-gradient(#d9dce1 0% 25%, #f4f5f7 0% 50%) 50% / 16px 16px'

export default function ModalQuitarFondo({ urlAntes, urlDespues, guardando, onAplicar, onCancelar }) {
  const aplicarRef = useRef(null)
  useEffect(() => { aplicarRef.current?.focus() }, [])
  const caja = fondo => ({ width: '100%', aspectRatio: '1 / 1', borderRadius: 14, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e8eaed' })
  const img = { width: '88%', height: '88%', objectFit: 'contain', display: 'block' }
  // Se dibuja en <body> para que ningún contenedor con filtro/blur lo recorte o lo desplace
  return createPortal(
    <div onClick={guardando ? undefined : onCancelar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 440, maxHeight: '94vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#202124' }}>Quitar fondo</div>
          <button onClick={onCancelar} disabled={guardando} aria-label="Cerrar"
            style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16}/>
          </button>
        </div>
        <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: 14 }}>Revisa el resultado antes de aplicarlo. Los cuadros muestran la parte transparente.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#9aa0a6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Antes</div>
            <div style={caja('#fff')}><img src={urlAntes} alt="" style={img}/></div>
          </div>
          <div>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#1a73e8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Después</div>
            <div style={caja(CUADROS)}><img src={urlDespues} alt="" style={img}/></div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#9aa0a6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Así se ve en un flyer</div>
          <div style={{ ...caja('linear-gradient(180deg, #4a2aa8 0%, #12082e 100%)'), aspectRatio: 'auto', height: 96 }}>
            <img src={urlDespues} alt="" style={{ height: '82%', width: 'auto', maxWidth: '40%', objectFit: 'contain', display: 'block' }}/>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onCancelar} disabled={guardando}
            style={{ flex: 1, background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 12, padding: 13, cursor: 'pointer', color: '#3c4043', fontWeight: 700, fontSize: '.9rem' }}>
            Dejar como estaba
          </button>
          <button ref={aplicarRef} onClick={onAplicar} disabled={guardando}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1a73e8', border: 'none', borderRadius: 12, padding: 13, cursor: guardando ? 'default' : 'pointer', color: '#fff', fontWeight: 800, fontSize: '.9rem', opacity: guardando ? .7 : 1 }}>
            <Check size={16}/> {guardando ? 'Guardando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
