// Gráfica de "goles del partido" para la transmisión en vivo — se activa a
// propósito desde el panel de control de /admin/config-sitio (no aparece
// sola): quien está transmitiendo la prende cuando quiere mostrar quién ha
// anotado, sin tener que decirlo por el micrófono. Reutiliza extraerGoles
// (la misma función que ya arma la lista de goles del modal de detalle de
// un partido en vivo en la portada) — mismo lenguaje visual oscuro que
// MarcadorEnVivoOverlay, pero abajo del video para no chocar con el
// marcador de arriba.
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
      width: 'min(94%, 420px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '10px 10px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(6px, 2vw, 10px) clamp(8px, 2.4vw, 14px)', borderTop: `2px solid ${ROJO_VIVO}`,
    }}>
      <div style={{ fontSize: 'clamp(.52rem, 2.2vw, .62rem)', fontWeight: 900, color: '#f5a623', letterSpacing: '.08em', marginBottom: '4px' }}>
        ⚽ GOLES DEL PARTIDO
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {ultimos.map((g, i) => {
          const equipo = g.equipo === 'local' ? partido.home : partido.away
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
              <span style={{ fontSize: 'clamp(.58rem, 2.4vw, .72rem)', fontWeight: 900, color: '#fff', minWidth: '28px', flexShrink: 0 }}>
                {g.minuto != null ? `${g.minuto}'` : '—'}
              </span>
              <span style={{ fontSize: 'clamp(.58rem, 2.4vw, .72rem)', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {g.jugador}
              </span>
              <span style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 700, color: '#9aa0a6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '38%', flexShrink: 0 }}>
                {equipo?.name || ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
