// Gráfica de "goles del partido" para la transmisión en vivo — se activa a
// propósito desde el panel de control de /admin/config-sitio (no aparece
// sola): quien está transmitiendo la prende cuando quiere mostrar quién ha
// anotado, sin tener que decirlo por el micrófono. Reutiliza extraerGoles
// (la misma función que arma la lista de goles del modal de detalle de un
// partido en vivo en la portada). Diseño: tablero estilo transmisión
// profesional (./TableroBT) con el goleador sobre el nombre de su equipo.
import { extraerGoles } from '../lib/liveMatch'
import TableroBT from './TableroBT'

export default function GolesEnVivoOverlay({ partido }) {
  if (!partido) return null
  const goles = extraerGoles(partido)
  const gl = partido.vivo?.golesLocal ?? goles.filter(g => g.equipo === 'local').length
  const gv = partido.vivo?.golesVis ?? goles.filter(g => g.equipo !== 'local').length
  return (
    <TableroBT
      partido={partido}
      goles={goles}
      marcador={{ gl, gv }}
      tag="Goles del partido"
      pie="Datos del partido actualizados por GOLMEBOL"
    />
  )
}
