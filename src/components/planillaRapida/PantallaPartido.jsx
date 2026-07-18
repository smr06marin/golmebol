import CronometroCentral from './CronometroCentral'
import EquipoHalf from './EquipoHalf'
import { colorPorHex } from '../../lib/coloresUniforme'
import { FONDO, TEXTO, TEXTO_TENUE, BORDE } from './estilosRapida'

// Pantalla del partido en vivo: TODO cabe en una sola pantalla, sin scroll de
// página — dividida en dos mitades (una por equipo, con su color) más la
// franja del cronómetro arriba. Solo el registro de eventos de cada mitad
// tiene su propio scroll interno si se llena.
export default function PantallaPartido({
  nombreLocal, nombreVis, colorLocal, colorVis, jugadoresLocal, jugadoresVisitante,
  arqueroLocal, arqueroVis, eventosLocal, eventosVis, periodo, segundos, corriendo, tiempoAgotado, modalidad,
  onVolverLista, onAbrirCierre, onToggleCronometro, onCambiarPeriodo, onSeleccionarArquero,
  onRegistrarEvento, onQuitarEvento,
}) {
  const cLocal = colorPorHex(colorLocal)
  const cVis = colorPorHex(colorVis)
  const golesLocal = eventosLocal.filter(e => e.tipo === 'goal').length
  const golesVis = eventosVis.filter(e => e.tipo === 'goal').length
  const mostrarFaltas = modalidad === 'Fútbol 5'
  const faltasLocal = eventosLocal.filter(e => e.tipo === 'falta_acum' && e.periodo === periodo).length
  const faltasVis = eventosVis.filter(e => e.tipo === 'falta_acum' && e.periodo === periodo).length

  return (
    <div style={{ height: '100dvh', background: FONDO, color: TEXTO, fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${BORDE}`, flexShrink: 0 }}>
        <button onClick={onVolverLista} style={{ background: 'none', border: 'none', color: TEXTO_TENUE, fontSize: '.72rem', cursor: 'pointer', padding: '4px' }}>👥 Jugadores</button>
        <span style={{ fontSize: '.68rem', color: TEXTO_TENUE, fontWeight: '700' }}>PLANILLA RÁPIDA</span>
        <button onClick={onAbrirCierre} style={{ background: '#1a73e8', border: 'none', borderRadius: '7px', color: '#fff', fontSize: '.72rem', fontWeight: '800', cursor: 'pointer', padding: '5px 10px' }}>🏁 Finalizar</button>
      </div>

      <CronometroCentral
        periodo={periodo} segundos={segundos} corriendo={corriendo} tiempoAgotado={tiempoAgotado}
        nombreLocal={nombreLocal} nombreVis={nombreVis} golesLocal={golesLocal} golesVis={golesVis}
        onToggle={onToggleCronometro} onCambiarPeriodo={onCambiarPeriodo}
      />

      <EquipoHalf arriba equipoNombre={nombreLocal} color={cLocal.hex} colorTexto={cLocal.texto}
        jugadores={jugadoresLocal} arquero={arqueroLocal} eventos={eventosLocal}
        mostrarFaltas={mostrarFaltas} faltasEquipo={faltasLocal}
        onSeleccionarArquero={j => onSeleccionarArquero('local', j)}
        onRegistrarEvento={(numero, tipo) => onRegistrarEvento('local', numero, tipo)}
        onQuitarEvento={id => onQuitarEvento('local', id)}
      />
      <EquipoHalf equipoNombre={nombreVis} color={cVis.hex} colorTexto={cVis.texto}
        jugadores={jugadoresVisitante} arquero={arqueroVis} eventos={eventosVis}
        mostrarFaltas={mostrarFaltas} faltasEquipo={faltasVis}
        onSeleccionarArquero={j => onSeleccionarArquero('visitante', j)}
        onRegistrarEvento={(numero, tipo) => onRegistrarEvento('visitante', numero, tipo)}
        onQuitarEvento={id => onQuitarEvento('visitante', id)}
      />
    </div>
  )
}
