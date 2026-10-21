// Cuadro de la esquina inferior derecha de la transmisión: "Transmisión por
// Golmebol del torneo de <nombre>" + logo del torneo. Es lo más pequeño que
// alcanza para quedar ENCIMA de la marca de agua de la plataforma de
// streaming (ej. "PRISM Live") que se cuela en esa esquina. Se dibuja en el
// escenario fijo de 860px de ancho del overlay (ver OverlayEnVivoPage), por eso
// las medidas van en px. Para apagarlo: ?cuadro=0 en la URL del overlay.
export default function TransmisionPorGolmebol({ torneo }) {
  if (!torneo?.name) return null
  return (
    <div style={{
      position: 'absolute', right: 0, bottom: 0, zIndex: 3, width: '214px', minHeight: '54px', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 10px 6px 9px', pointerEvents: 'none', color: '#fff',
      background: 'linear-gradient(180deg, rgba(17,22,34,.98), rgba(6,8,13,.99))', borderTop: '2px solid #e5433d', borderRadius: '9px 0 0 0',
      boxShadow: '0 -3px 14px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)',
    }}>
      {torneo.logo_url && (
        <img src={torneo.logo_url} alt="" style={{ height: '40px', width: 'auto', maxWidth: '54px', objectFit: 'contain', flexShrink: 0 }}/>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '8px', fontWeight: 700, color: '#9aa6b8', lineHeight: 1.25 }}>Transmisión por Golmebol del torneo de</div>
        <div style={{ fontSize: '11.5px', fontWeight: 900, lineHeight: 1.15, textTransform: 'uppercase', letterSpacing: '.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{torneo.name}</div>
      </div>
    </div>
  )
}
