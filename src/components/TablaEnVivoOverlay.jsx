// Gráfica de "tabla de posiciones" para la transmisión en vivo — igual que
// GolesEnVivoOverlay, se activa a propósito desde el panel de control de
// /admin/config-sitio. No calcula nada por su cuenta: recibe las filas ya
// calculadas con computeTablaGeneral (misma función que usa la tabla de
// posiciones real del torneo, en AdminTorneoDetallePage/TorneoPublicoPage),
// para no duplicar esa lógica acá.
const ROJO_VIVO = '#e5433d'

export default function TablaEnVivoOverlay({ filas }) {
  if (!filas || !filas.length) return null
  // Solo el top 5 — es una gráfica de transmisión, no la tabla completa.
  const top = filas.slice(0, 5)

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
      width: 'min(96%, 460px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '10px 10px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(6px, 2vw, 10px) clamp(8px, 2.4vw, 14px)', borderTop: `2px solid ${ROJO_VIVO}`,
    }}>
      <div style={{ fontSize: 'clamp(.52rem, 2.2vw, .62rem)', fontWeight: 900, color: '#f5a623', letterSpacing: '.08em', marginBottom: '4px' }}>
        🏆 TABLA DE POSICIONES
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {top.map((f, i) => (
          <div key={f.equipo?.id || i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ fontSize: 'clamp(.54rem, 2.2vw, .68rem)', fontWeight: 900, color: '#9aa0a6', minWidth: '14px', flexShrink: 0 }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 'clamp(.56rem, 2.3vw, .7rem)', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {f.equipo?.name || '—'}
            </span>
            <span style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 600, color: '#9aa0a6', flexShrink: 0 }}>
              PJ {f.pj}
            </span>
            <span style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 600, color: '#9aa0a6', flexShrink: 0, minWidth: '30px', textAlign: 'right' }}>
              DG {f.gf - f.gc}
            </span>
            <span style={{ fontSize: 'clamp(.6rem, 2.5vw, .76rem)', fontWeight: 900, color: '#fff', flexShrink: 0, minWidth: '24px', textAlign: 'right' }}>
              {f.pts}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
