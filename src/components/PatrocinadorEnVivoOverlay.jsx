// Gráfica de publicidad de un patrocinador, encima del video en vivo —
// disparada a propósito desde el panel de control (botón por patrocinador),
// no es automática. A diferencia de Tabla/Goles/Jugadores (que quedan
// prendidas hasta que alguien las apague), esta aparece unos segundos y se
// va sola (ver TIEMPO_VISIBLE_MS más abajo y cómo LandingPage/
// EnVivoControlLinkPage arman su temporizador). Reutiliza los mismos datos
// de /admin/patrocinadores (tabla patrocinadores_golmebol) que ya se
// muestran rotando en el banner de la portada — no hace falta subir nada
// nuevo para esto.
const ROJO_VIVO = '#e5433d'

export default function PatrocinadorEnVivoOverlay({ patrocinador }) {
  if (!patrocinador) return null
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3,
      width: 'min(94%, 420px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '10px 10px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(8px, 2.4vw, 14px)', borderTop: `2px solid ${ROJO_VIVO}`,
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      {patrocinador.logo_url && (
        <div style={{ width: 'clamp(36px, 10vw, 54px)', height: 'clamp(36px, 10vw, 54px)', borderRadius: '8px', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={patrocinador.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/>
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 900, color: '#f5a623', letterSpacing: '.08em', marginBottom: '2px' }}>
          PRESENTA
        </div>
        <div style={{ fontSize: 'clamp(.68rem, 2.8vw, .88rem)', fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {patrocinador.nombre}
        </div>
      </div>
    </div>
  )
}
