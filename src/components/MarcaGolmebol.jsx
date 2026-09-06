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
//
// EXCEPCIÓN: en las planillas (PlanillaRapida/PlanillaPartido) arriba SÍ
// está ocupado por el header (Jugadores/Suspender/W/Finalizar) y tapaba
// esos botones. Esas pantallas le agregan la clase "gm-planilla-abierta"
// a <body> mientras están montadas — la regla en index.css baja la marca
// abajo solo en ese caso, sin tocar el resto de la app.
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
    <div className="gm-marca-golmebol" aria-hidden="true">
      <img src="/marca/watermark-logo.png" alt="" style={imgStyle} />
      <span style={textStyle}>Creada por GOLMEBOL</span>
    </div>
  )
}
