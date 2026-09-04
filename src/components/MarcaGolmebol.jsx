// Marca de agua de la plataforma: un sello pequeño y fijo con el logo y el
// texto "Creada por GOLMEBOL", visible en todas las páginas. Se monta una
// sola vez en App.jsx (igual que SessionGuard) para que aparezca en toda la
// app sin tener que tocar cada página. pointer-events: none para que nunca
// tape un botón real, aunque visualmente quede encima de algo.
//
// Va arriba a la derecha (no abajo): casi todas las pantallas de la app
// tienen algo fijo pegado abajo (la barra inferior del admin/celular, el
// botón circular de cerrar la planilla, las barras de navegación del sitio
// público, el carrito de escenarios, etc.) — abajo a la derecha SIEMPRE
// terminaba tapando alguno de esos elementos. Arriba a la derecha está
// libre en prácticamente todas las pantallas (el sidebar del admin es
// izquierdo, y no hay barras superiores fijas de ese lado).
const wrapStyle = {
  position: 'fixed',
  right: '8px',
  top: '8px',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '4px 9px 4px 5px',
  borderRadius: '999px',
  background: 'rgba(10, 10, 16, .55)',
  backdropFilter: 'blur(3px)',
  boxShadow: '0 2px 8px rgba(0,0,0,.25)',
  pointerEvents: 'none',
  userSelect: 'none',
}

const imgStyle = { height: '13px', width: 'auto', display: 'block', opacity: 0.95 }

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
