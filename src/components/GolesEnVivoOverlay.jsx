// Gráfica de "goles del partido" para la transmisión en vivo — se activa a
// propósito desde el panel de control de /admin/config-sitio (no aparece
// sola): quien está transmitiendo la prende cuando quiere mostrar quién ha
// anotado, sin tener que decirlo por el micrófono. Reutiliza extraerGoles
// (la misma función que ya arma la lista de goles del modal de detalle de
// un partido en vivo en la portada) — mismo lenguaje visual oscuro que
// MarcadorEnVivoOverlay, pero abajo del video para no chocar con el
// marcador de arriba. Cada gol sale con el número de camiseta, el nombre del
// jugador, el minuto y el equipo.
import { extraerGoles } from '../lib/liveMatch'

const ROJO_VIVO = '#e5433d'

export default function GolesEnVivoOverlay({ partido }) {
  if (!partido) return null
  const goles = extraerGoles(partido)
  if (!goles.length) return null
  // Si hay muchos goles (partidos goleados), solo se muestran los últimos —
  // es una gráfica de transmisión, no un historial completo.
  const ultimos = goles.slice(-6)

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
      width: 'min(96%, 600px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '14px 14px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(8px, 2.6vw, 14px) clamp(10px, 3.2vw, 18px)', borderTop: `3px solid ${ROJO_VIVO}`,
    }}>
      <div style={{ fontSize: 'clamp(.7rem, 3vw, .9rem)', fontWeight: 900, color: '#f5a623', letterSpacing: '.08em', marginBottom: '6px' }}>
        ⚽ GOLES DEL PARTIDO
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {ultimos.map((g, i) => {
          const equipo = g.equipo === 'local' ? partido.home : partido.away
          const color = g.equipo === 'local' ? partido.colores?.colorLocal : partido.colores?.colorVisitante
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <span style={{ fontSize: 'clamp(.78rem, 3.2vw, 1rem)', fontWeight: 900, color: '#fff', minWidth: '34px', flexShrink: 0 }}>
                {g.minuto != null ? `${g.minuto}'` : '—'}
              </span>
              {g.numero && (
                <span style={{
                  flexShrink: 0, minWidth: '1.9em', textAlign: 'center', padding: '1px 6px', borderRadius: '6px',
                  background: color || '#33383d', color: '#fff', fontSize: 'clamp(.78rem, 3.2vw, 1rem)', fontWeight: 900,
                  textShadow: '0 1px 2px rgba(0,0,0,.6)',
                }}>{g.numero}</span>
              )}
              <span style={{ fontSize: 'clamp(.82rem, 3.4vw, 1.08rem)', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                {g.jugador}
              </span>
              <span style={{ fontSize: 'clamp(.68rem, 2.7vw, .85rem)', fontWeight: 700, color: '#9aa0a6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '36%', flexShrink: 0 }}>
                {equipo?.name || ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
