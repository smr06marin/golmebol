// Gráfica de "nómina" (número + nombre) de cada equipo para la transmisión
// en vivo — igual que Goles/Tabla, se activa a propósito desde el panel de
// control. Reutiliza extraerJugadores, que saca los nombres del mismo
// snapshot de la planilla del árbitro (no pide nada nuevo a la base de
// datos). Dos columnas, una por equipo, mismo lenguaje visual oscuro que
// los demás overlays.
import { extraerJugadores } from '../lib/liveMatch'

const ROJO_VIVO = '#e5433d'
const MAX_POR_EQUIPO = 12

function Columna({ titulo, jugadores }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 900, color: '#9aa0a6', letterSpacing: '.04em', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {titulo || '—'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {jugadores.slice(0, MAX_POR_EQUIPO).map((j, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{ fontSize: 'clamp(.52rem, 2.1vw, .64rem)', fontWeight: 900, color: '#f5a623', minWidth: '14px', flexShrink: 0 }}>{j.numero}</span>
            <span style={{ fontSize: 'clamp(.52rem, 2.1vw, .64rem)', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nombre}</span>
          </div>
        ))}
        {jugadores.length > MAX_POR_EQUIPO && (
          <div style={{ fontSize: 'clamp(.48rem, 1.8vw, .56rem)', color: '#9aa0a6', marginTop: '1px' }}>+{jugadores.length - MAX_POR_EQUIPO} más</div>
        )}
      </div>
    </div>
  )
}

export default function JugadoresEnVivoOverlay({ partido }) {
  if (!partido) return null
  const { local, visitante } = extraerJugadores(partido)
  if (!local.length && !visitante.length) return null

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
      width: 'min(96%, 480px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '10px 10px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(6px, 2vw, 10px) clamp(8px, 2.4vw, 14px)', borderTop: `2px solid ${ROJO_VIVO}`,
      display: 'flex', gap: '14px', maxHeight: '48%', overflow: 'hidden',
    }}>
      <Columna titulo={partido.home?.name} jugadores={local}/>
      <Columna titulo={partido.away?.name} jugadores={visitante}/>
    </div>
  )
}
