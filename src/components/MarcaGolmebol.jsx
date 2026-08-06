// Marca de agua de la plataforma: un sello pequeño y fijo con el logo y el
// texto "Creada por GOLMEBOL", visible en todas las páginas. Se monta una
// sola vez en App.jsx (igual que SessionGuard) para que aparezca en toda la
// app sin tener que tocar cada página. pointer-events: none para que nunca
// tape un botón real, aunque visualmente quede encima de algo.
const wrapStyle = {
  position: 'fixed',
  right: '10px',
  bottom: '10px',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 10px 5px 6px',
  borderRadius: '999px',
  background: 'rgba(10, 10, 16, .62)',
  backdropFilter: 'blur(3px)',
  boxShadow: '0 2px 8px rgba(0,0,0,.25)',
  pointerEvents: 'none',
  userSelect: 'none',
}

const imgStyle = { height: '15px', width: 'auto', display: 'block', opacity: 0.95 }

const textStyle = {
  fontSize: '.62rem',
  fontWeight: '600',
  letterSpacing: '.02em',
  color: 'rgba(255,255,255,.88)',
  whiteSpace: 'nowrap',
}

export default function MarcaGolmebol() {
  return (
    <div style={wrapStyle} aria-hidden="true">
      <img src="/marca/watermark-logo.png" alt="" style={imgStyle} />
      <span style={textStyle}>Creada por GOLMEBOL</span>
    </div>
  )
}
