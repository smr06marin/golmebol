// Gráfica de "nómina" (número + nombre) de cada equipo para la transmisión
// en vivo — igual que Goles/Tabla, se activa a propósito desde el panel de
// control. Reutiliza extraerJugadores, que saca los nombres del mismo
// snapshot de la planilla del árbitro (no pide nada nuevo a la base de
// datos) y deja SOLO a los jugadores planillados con camiseta (los inscritos
// a los que no se les asignó número no salen). Dos columnas, una por equipo,
// con escudo y barra del color de uniforme. Diseño compartido en ./enVivoUI.
import { extraerJugadores } from '../lib/liveMatch'
import { EnVivoEstilos, Escudo, PieGolmebol, textoContraste } from './enVivoUI'

const MAX_POR_EQUIPO = 12

function Columna({ equipo, jugadores, color }) {
  return (
    <div className="ev-col" style={{ '--cg': color || '#5f6368' }}>
      <div className="ev-col-h">
        <Escudo url={equipo?.logo_url} name={equipo?.name} size={4.4}/>
        <span className="ev-txt">{equipo?.name || '—'}</span>
      </div>
      <div>
        {jugadores.slice(0, MAX_POR_EQUIPO).map((j, i) => (
          <div key={i} className="ev-j">
            <span className="ev-num" style={{ background: color || '#33383d', color: textoContraste(color) }}>{j.numero}</span>
            <span className="ev-txt">{j.nombre}</span>
          </div>
        ))}
        {jugadores.length > MAX_POR_EQUIPO && (
          <div className="ev-pie" style={{ borderTop: 'none' }}>+{jugadores.length - MAX_POR_EQUIPO} más</div>
        )}
      </div>
    </div>
  )
}

// `pie`: leyenda de abajo (por defecto la de alineaciones; al arrancar el partido la página de overlay manda el mensaje institucional)
export default function JugadoresEnVivoOverlay({ partido, pie = 'Alineaciones en tiempo real · tecnología GOLMEBOL' }) {
  if (!partido) return null
  const { local, visitante } = extraerJugadores(partido)
  if (!local.length && !visitante.length) return null

  return (
    <div className="ev-p ev-u" style={{ width: 'clamp(min(96%, 330px), 52%, 900px)', maxHeight: '70%' }}>
      <EnVivoEstilos/>
      <div className="ev-h">
        <div className="ev-tag">Alineaciones</div>
      </div>
      <div className="ev-cols2">
        <Columna equipo={partido.home} jugadores={local} color={partido.colores?.colorLocal}/>
        <Columna equipo={partido.away} jugadores={visitante} color={partido.colores?.colorVisitante}/>
      </div>
      <PieGolmebol texto={pie}/>
    </div>
  )
}
