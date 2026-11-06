import CronometroCentral from './CronometroCentral'
import EquipoHalf from './EquipoHalf'
import { colorPorHex } from '../../lib/coloresUniforme'
import { FONDO, TEXTO, TEXTO_TENUE, BORDE, ESTILO_RESALTE, ANIM_RESALTE, AMARILLO } from './estilosRapida'

// Pantalla del partido en vivo: ocupa TODA la pantalla (position fixed, por
// encima de cualquier otra cosa de la app) — dividida en dos mitades, una por
// equipo, con su color. El cronómetro es un widget flotante y arrastrable
// (no ocupa espacio fijo) para dejarle todo el alto posible a cada mitad.
export default function PantallaPartido({
  nombreLocal, nombreVis, colorLocal, colorVis, jugadoresLocal, jugadoresVisitante,
  arqueroLocal, arqueroVis, eventosLocal, eventosVis, periodo, segundos, corriendo, tiempoAgotado, modalidad,
  onVolverLista, onVolverColores, onAbrirCierre, onToggleCronometro, onCambiarPeriodo, onSeleccionarArquero,
  onRegistrarEvento, onQuitarEvento, onAbrirEspecial, globalLlave, cambiosReloj = [],
  puedeIniciar = true, motivoNoIniciar = '', onReiniciar, onVolverPrimero, onSilenciar, nuevosSinNumero = 0,
  duracionMinutos = 0, alarmaActiva = false, onTerminarTiempo,
}) {
  const cLocal = colorPorHex(colorLocal)
  const cVis = colorPorHex(colorVis)
  const golesLocal = eventosLocal.filter(e => e.tipo === 'goal').length
  const golesVis = eventosVis.filter(e => e.tipo === 'goal').length
  const mostrarFaltas = modalidad === 'Fútbol 5'
  const faltasLocal = eventosLocal.filter(e => e.tipo === 'falta_acum' && e.periodo === periodo).length
  const faltasVis = eventosVis.filter(e => e.tipo === 'falta_acum' && e.periodo === periodo).length

  const iniciado = corriendo || periodo === 2 || segundos > 0 || eventosLocal.length > 0 || eventosVis.length > 0
  const finDelPartido = tiempoAgotado && periodo === 2

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: FONDO, color: TEXTO, fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{ESTILO_RESALTE}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', gap: '6px', flexWrap: 'wrap', borderBottom: `1px solid ${BORDE}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={onVolverLista}
            style={nuevosSinNumero > 0
              ? { background: AMARILLO, border: 'none', borderRadius: '8px', color: '#1a1a1a', fontSize: '.78rem', fontWeight: '900', cursor: 'pointer', padding: '7px 9px', minHeight: '36px', animation: ANIM_RESALTE, whiteSpace: 'nowrap' }
              : { background: 'rgba(255,255,255,.14)', border: `1px solid ${BORDE}`, borderRadius: '8px', color: TEXTO, fontSize: '.78rem', fontWeight: '800', cursor: 'pointer', padding: '7px 9px', minHeight: '36px', whiteSpace: 'nowrap' }}>
            {nuevosSinNumero > 0 ? `👥 ${nuevosSinNumero} nuevo${nuevosSinNumero > 1 ? 's' : ''}` : '👥 Jugadores'}
          </button>
          {onVolverColores && (
            <button onClick={onVolverColores} title="Cambiar el color de los uniformes — el cronómetro sigue corriendo"
              style={{ background: 'rgba(255,255,255,.14)', border: `1px solid ${BORDE}`, borderRadius: '8px', color: TEXTO, fontSize: '.78rem', fontWeight: '800', cursor: 'pointer', padding: '7px 9px', minHeight: '36px', whiteSpace: 'nowrap' }}>
              🎨 Colores
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {!iniciado && (
            <button onClick={onAbrirEspecial} title="Partido por W o Desierto (no se jugó)"
              style={{ background: 'none', border: `1px solid ${BORDE}`, borderRadius: '7px', color: TEXTO_TENUE, fontSize: '.68rem', fontWeight: '700', cursor: 'pointer', padding: '7px 8px', minHeight: '36px' }}>⚠️ W</button>
          )}
          <button onClick={onAbrirCierre}
            style={{ background: '#1a73e8', border: 'none', borderRadius: '7px', color: '#fff', fontSize: '.76rem', fontWeight: '800', cursor: 'pointer', padding: '7px 9px', minHeight: '36px', animation: finDelPartido ? ANIM_RESALTE : 'none' }}>🏁 Finalizar</button>
        </div>
      </div>

      {/* Marcador fijo arriba — siempre visible y bien grande, pero SIN
          flotar sobre la pantalla (a diferencia del cronómetro, que sí es
          arrastrable): así nunca tapa los botones de gol/tarjeta de abajo. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '4px 10px 7px', flexShrink: 0, background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${BORDE}` }}>
        <span style={{ flex: 1, textAlign: 'right', fontSize: '.72rem', fontWeight: '700', color: TEXTO_TENUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreLocal}</span>
        <span style={{ fontSize: '1.5rem', fontWeight: '900', color: TEXTO, background: 'rgba(255,255,255,.08)', borderRadius: '10px', padding: '2px 14px', letterSpacing: '.02em', flexShrink: 0 }}>
          {golesLocal} - {golesVis}
        </span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: '.72rem', fontWeight: '700', color: TEXTO_TENUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreVis}</span>
      </div>

      {cambiosReloj.length > 0 && (
        <div title="Cambios marcados desde el reloj del árbitro" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '3px 10px', flexShrink: 0, overflowX: 'auto', whiteSpace: 'nowrap', fontSize: '.66rem', fontWeight: '700', color: TEXTO_TENUE, background: 'rgba(26,115,232,.12)', borderBottom: `1px solid ${BORDE}` }}>
          <span style={{ color: '#8ab4f8', fontWeight: '900' }}>⌚ 🔄 CAMBIOS</span>
          {[['local', nombreLocal], ['visitante', nombreVis]].map(([k, nom]) => {
            const lst = cambiosReloj.filter(c => c.team === k)
            if (!lst.length) return null
            return <span key={k}>{nom}: {lst.map(c => `↓${c.numero || '?'} ↑${c.numero2 || '?'} (${c.minuto})`).join(' · ')}</span>
          })}
        </div>
      )}

      <EquipoHalf arriba equipoNombre={nombreLocal} color={cLocal.hex} colorTexto={cLocal.texto}
        jugadores={jugadoresLocal} arquero={arqueroLocal} eventos={eventosLocal} resaltarArquero
        mostrarFaltas={mostrarFaltas} faltasEquipo={faltasLocal}
        onSeleccionarArquero={j => onSeleccionarArquero('local', j)}
        onRegistrarEvento={(numero, tipo) => onRegistrarEvento('local', numero, tipo)}
        onQuitarEvento={id => onQuitarEvento('local', id)}
      />
      <EquipoHalf equipoNombre={nombreVis} color={cVis.hex} colorTexto={cVis.texto}
        jugadores={jugadoresVisitante} arquero={arqueroVis} eventos={eventosVis} resaltarArquero
        mostrarFaltas={mostrarFaltas} faltasEquipo={faltasVis}
        onSeleccionarArquero={j => onSeleccionarArquero('visitante', j)}
        onRegistrarEvento={(numero, tipo) => onRegistrarEvento('visitante', numero, tipo)}
        onQuitarEvento={id => onQuitarEvento('visitante', id)}
      />

      <CronometroCentral
        periodo={periodo} segundos={segundos} corriendo={corriendo} tiempoAgotado={tiempoAgotado}
        golesLocal={golesLocal} golesVis={golesVis} globalLlave={globalLlave}
        puedeIniciar={puedeIniciar} motivoNoIniciar={motivoNoIniciar}
        duracionMinutos={duracionMinutos} alarmaActiva={alarmaActiva} onTerminarTiempo={onTerminarTiempo}
        onToggle={onToggleCronometro} onReiniciar={onReiniciar} onCambiarPeriodo={onCambiarPeriodo}
        onVolverPrimero={onVolverPrimero} onSilenciar={onSilenciar} onFinalizar={onAbrirCierre}
      />
    </div>
  )
}
