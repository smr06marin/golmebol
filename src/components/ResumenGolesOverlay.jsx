// Tablero de goles "minuto a minuto" que sale SOLO en la transmisión (ver
// OverlayEnVivoPage): en el descanso (1 min después de empezar, 2 min) y al
// finalizar el partido (apenas el árbitro cierra la planilla, 2 min). Usa el
// tablero estilo transmisión profesional de ./TableroBT.
// Recibe los goles ya armados (misma forma que extraerGoles) para servir igual
// con el partido en vivo (snapshot) que con el ya finalizado (match_events).
import TableroBT from './TableroBT'

const FRASE = 'El fútbol evoluciona. La tecnología también. Estos datos en vivo se dan gracias a GOLMEBOL'

export default function ResumenGolesOverlay({ partido, goles, modo = 'descanso' }) {
  if (!partido) return null
  const esFinal = modo === 'final'
  const lista = (goles || []).filter(g => esFinal || (g.periodo || 1) === 1)
  const gl = esFinal ? (partido.home_score ?? lista.filter(g => g.equipo === 'local').length) : (partido.vivo?.golesLocal ?? lista.filter(g => g.equipo === 'local').length)
  const gv = esFinal ? (partido.away_score ?? lista.filter(g => g.equipo !== 'local').length) : (partido.vivo?.golesVis ?? lista.filter(g => g.equipo !== 'local').length)
  return (
    <TableroBT
      partido={partido}
      goles={lista}
      marcador={{ gl, gv }}
      tag={esFinal ? 'Fin del partido' : 'Descanso'}
      pie={FRASE}
    />
  )
}
