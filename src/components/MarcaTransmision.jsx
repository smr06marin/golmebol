// Marca de la transmisión en el overlay de OBS (arriba a la izquierda): logo de
// Golmebol + logo del torneo que se está jugando, con "EN VIVO" debajo. Se
// dibuja en el escenario fijo de 860px de ancho del overlay (ver
// OverlayEnVivoPage), por eso va en px.
const SOMBRA = 'drop-shadow(0 1px 4px rgba(0,0,0,.85))'

export default function MarcaTransmision({ logoTorneo }) {
  return (
    <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/marca/watermark-logo.png" alt="" style={{ height: '34px', width: 'auto', filter: SOMBRA }}/>
        {logoTorneo && (
          <>
            <span style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,.6)', boxShadow: '0 1px 3px rgba(0,0,0,.6)' }}/>
            <img src={logoTorneo} alt="" style={{ height: '34px', width: 'auto', maxWidth: '64px', objectFit: 'contain', filter: SOMBRA }}/>
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#e5433d', flexShrink: 0, animation: 'gmMicPulso 1s ease-in-out infinite', boxShadow: '0 0 3px rgba(0,0,0,.9)' }}/>
        <span style={{ fontSize: '.62rem', fontWeight: 900, color: '#fff', letterSpacing: '.04em', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>EN VIVO</span>
      </div>
    </div>
  )
}
