// Gráfica de "goles del partido" para la transmisión en vivo — se activa a
// propósito desde el panel de control de /admin/config-sitio (no aparece
// sola): quien está transmitiendo la prende cuando quiere mostrar quién ha
// anotado, sin tener que decirlo por el micrófono. Reutiliza extraerGoles
// (la misma función que ya arma la lista de goles del modal de detalle de
// un partido en vivo en la portada). Va abajo del video para no chocar con el
// marcador de arriba. Cada gol sale con minuto, número, jugador y equipo, y
// una barra del color de uniforme del equipo. Diseño compartido en ./enVivoUI.
import { extraerGoles } from '../lib/liveMatch'
import { EnVivoEstilos, Escudo, textoContraste } from './enVivoUI'

export default function GolesEnVivoOverlay({ partido }) {
  if (!partido) return null
  const goles = extraerGoles(partido)
  if (!goles.length) return null
  // Si hay muchos goles (partidos goleados), solo se muestran los últimos —
  // es una gráfica de transmisión, no un historial completo.
  const ultimos = goles.slice(-6)
  const gl = partido.vivo?.golesLocal ?? goles.filter(g => g.equipo === 'local').length
  const gv = partido.vivo?.golesVis ?? goles.filter(g => g.equipo !== 'local').length

  return (
    <div className="ev-p ev-u">
      <EnVivoEstilos/>
      <div className="ev-h">
        <div className="ev-tag">Goles del partido</div>
        <div className="ev-sub">
          <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.25em' }}>{gl} – {gv}</span>
        </div>
      </div>
      <div>
        {ultimos.map((g, i) => {
          const local = g.equipo === 'local'
          const equipo = local ? partido.home : partido.away
          const color = local ? partido.colores?.colorLocal : partido.colores?.colorVisitante
          return (
            <div key={i} className="ev-g" style={{ '--cg': color || '#5f6368' }}>
              <span className="ev-g-min">{g.minuto != null ? `${g.minuto}'` : '—'}</span>
              {g.numero && <span className="ev-num" style={{ background: color || '#33383d', color: textoContraste(color) }}>{g.numero}</span>}
              <span className="ev-g-nom ev-txt">{g.jugador}</span>
              <span className="ev-g-eq">
                <Escudo url={equipo?.logo_url} name={equipo?.name} size={4.2}/>
                <span className="ev-txt">{equipo?.name || ''}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
