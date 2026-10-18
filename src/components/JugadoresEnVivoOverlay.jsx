// Gráfica de "nómina" (número + nombre) de cada equipo para la transmisión
// en vivo — igual que Goles/Tabla, se activa a propósito desde el panel de
// control. Reutiliza extraerJugadores, que saca los nombres del mismo
// snapshot de la planilla del árbitro (no pide nada nuevo a la base de
// datos) y deja SOLO a los jugadores planillados con camiseta (los inscritos
// a los que no se les asignó número no salen). Dos columnas, una por equipo,
// mismo lenguaje visual oscuro que los demás overlays.
import { extraerJugadores } from '../lib/liveMatch'

const ROJO_VIVO = '#e5433d'
const MAX_POR_EQUIPO = 12

function Columna({ titulo, jugadores, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 'clamp(.68rem, 2.8vw, .85rem)', fontWeight: 900, color: '#fff', letterSpacing: '.03em', marginBottom: '5px', paddingBottom: '3px', borderBottom: `2px solid ${color || '#5f6368'}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {titulo || '—'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {jugadores.slice(0, MAX_POR_EQUIPO).map((j, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
            <span style={{ fontSize: 'clamp(.72rem, 2.9vw, .9rem)', fontWeight: 900, color: '#f5a623', minWidth: '1.7em', textAlign: 'right', flexShrink: 0 }}>{j.numero}</span>
            <span style={{ fontSize: 'clamp(.72rem, 2.9vw, .9rem)', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nombre}</span>
          </div>
        ))}
        {jugadores.length > MAX_POR_EQUIPO && (
          <div style={{ fontSize: 'clamp(.62rem, 2.4vw, .75rem)', color: '#9aa0a6', marginTop: '1px' }}>+{jugadores.length - MAX_POR_EQUIPO} más</div>
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
      width: 'min(96%, 640px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '14px 14px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(8px, 2.6vw, 14px) clamp(10px, 3.2vw, 18px)', borderTop: `3px solid ${ROJO_VIVO}`,
      display: 'flex', gap: '18px', maxHeight: '52%', overflow: 'hidden',
    }}>
      <Columna titulo={partido.home?.name} jugadores={local} color={partido.colores?.colorLocal}/>
      <Columna titulo={partido.away?.name} jugadores={visitante} color={partido.colores?.colorVisitante}/>
    </div>
  )
}
