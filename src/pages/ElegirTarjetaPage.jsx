import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'

export default function ElegirTarjetaPage({ onSelect, currentDesign = 'normal' }) {
  const [selected, setSelected] = useState(currentDesign)
  const navigate = useNavigate()

  function handleSelect(design) {
    if (design.bloqueado) return
    setSelected(design.id)
  }

  function handleConfirm() {
    onSelect?.(selected)
    navigate('/')
  }

  return (
    <div style={{
      width: '100%', maxWidth: '420px',
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Fondo */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 85% 50% at 50% -5%,rgba(0,35,110,.38) 0%,transparent 62%), #07070e' }} />

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.2rem .5rem' }}>
        <button onClick={() => navigate('/')}
          style={{ background: 'rgba(0,210,200,.04)', border: '1px solid rgba(0,210,200,.22)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ←
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '.18em', color: 'var(--color-primary)', margin: 0 }}>
          ELEGIR TARJETA
        </h1>
      </header>

      {/* Grid de tarjetas */}
      <div style={{ position: 'relative', zIndex: 10, padding: '.8rem 1rem', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
          {CARD_DESIGNS.map(design => (
            <div key={design.id}
              onClick={() => handleSelect(design)}
              style={{
                borderRadius: '12px',
                border: `2px solid ${selected === design.id ? design.color : design.bloqueado ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.15)'}`,
                background: design.bloqueado ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.05)',
                cursor: design.bloqueado ? 'not-allowed' : 'pointer',
                overflow: 'hidden',
                transition: 'all .2s',
                transform: selected === design.id ? 'scale(1.03)' : 'scale(1)',
                boxShadow: selected === design.id ? `0 0 20px ${design.color}44` : 'none',
                opacity: design.bloqueado ? .5 : 1,
              }}
            >
              {/* Preview del diseño */}
              <div style={{
                height: '90px',
                background: design.preview,
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {design.bloqueado && (
                  <div style={{ fontSize: '1.8rem' }}>🔒</div>
                )}
                {!design.bloqueado && selected === design.id && (
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: design.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.9rem', fontWeight: 'bold', color: '#000'
                  }}>✓</div>
                )}
                {/* Badge seleccionado */}
                {selected === design.id && (
                  <div style={{
                    position: 'absolute', top: '6px', right: '6px',
                    background: design.color, borderRadius: '4px',
                    padding: '1px 5px',
                    fontFamily: 'var(--font-display)', fontSize: '.3rem',
                    color: '#000', letterSpacing: '.1em'
                  }}>ACTIVA</div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '.6rem .7rem' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '.7rem', letterSpacing: '.1em',
                  color: design.bloqueado ? 'rgba(255,255,255,.4)' : '#fff',
                  marginBottom: '2px'
                }}>
                  {design.nombre}
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '.55rem',
                  color: 'rgba(255,255,255,.4)',
                  marginBottom: design.progreso !== undefined ? '6px' : 0
                }}>
                  {design.descripcion}
                </div>

                {/* Barra de progreso si está bloqueado */}
                {design.bloqueado && design.progreso !== undefined && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '.45rem', color: 'rgba(255,255,255,.3)' }}>
                        {design.progreso} / {design.meta}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '.45rem', color: 'rgba(255,255,255,.3)' }}>
                        {Math.round(design.progreso / design.meta * 100)}%
                      </span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: '4px', height: '4px' }}>
                      <div style={{
                        height: '100%', borderRadius: '4px',
                        width: `${Math.round(design.progreso / design.meta * 100)}%`,
                        background: `linear-gradient(90deg, ${design.color}, var(--color-secondary))`
                      }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botón confirmar */}
      <div style={{ position: 'relative', zIndex: 10, padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button onClick={handleConfirm}
          style={{
            width: '100%', padding: '.85rem',
            background: 'var(--color-primary)',
            border: 'none', borderRadius: '10px',
            color: '#000', fontFamily: 'var(--font-display)',
            fontSize: '1.1rem', letterSpacing: '.15em',
            cursor: 'pointer'
          }}>
          USAR ESTA TARJETA
        </button>
      </div>
    </div>
  )
}