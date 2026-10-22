// Gráfica de "nómina" (número + nombre) de cada equipo para la transmisión
// en vivo — igual que Goles/Tabla, se activa a propósito desde el panel de
// control (o sale sola al arrancar el partido). Reutiliza extraerJugadores,
// que saca los nombres del mismo snapshot de la planilla del árbitro (no pide
// nada nuevo a la base de datos) y deja SOLO a los jugadores planillados con
// camiseta. Diseño: la misma barra de equipos de ./TableroBT (escudos, nombres
// y "VS" al centro) con una columna de jugadores debajo de cada equipo.
import { extraerJugadores } from '../lib/liveMatch'
import { textoContraste } from './enVivoUI'
import TableroBT from './TableroBT'

const MAX_POR_EQUIPO = 12

function Columna({ jugadores, color }) {
  return (
    <div className="ev-col" style={{ '--cg': color || '#5f6368' }}>
      {jugadores.slice(0, MAX_POR_EQUIPO).map((j, i) => (
        <div key={i} className="ev-j">
          <span className="ev-num" style={{ background: color || '#33383d', color: textoContraste(color) }}>{j.numero}</span>
          <span className="ev-txt">{j.nombre}</span>
        </div>
      ))}
      {jugadores.length > MAX_POR_EQUIPO && (
        <div className="ev-bt-mas-j">+{jugadores.length - MAX_POR_EQUIPO} más</div>
      )}
    </div>
  )
}

// `pie`: leyenda de abajo (por defecto la de alineaciones; al arrancar el partido la página de overlay manda el mensaje institucional)
export default function JugadoresEnVivoOverlay({ partido, pie = 'Alineaciones en tiempo real · tecnología GOLMEBOL' }) {
  if (!partido) return null
  const { local, visitante } = extraerJugadores(partido)
  if (!local.length && !visitante.length) return null
  return (
    <TableroBT
      partido={partido}
      tag="Alineaciones"
      marcador={null}
      pie={pie}
      ancho="clamp(min(96%, 330px), 46%, 680px)"
      cuerpo={(
        <div className="ev-bt-cols">
          <Columna jugadores={local} color={partido.colores?.colorLocal}/>
          <Columna jugadores={visitante} color={partido.colores?.colorVisitante}/>
        </div>
      )}
    />
  )
}
