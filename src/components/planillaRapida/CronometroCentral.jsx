import { formatTiempo, TEXTO, TEXTO_TENUE } from './estilosRapida'

// Franja central de la planilla rápida: cronómetro + marcador. Los goles y
// tarjetas se registran en cada mitad de la pantalla (EquipoHalf), acá solo
// se controla el tiempo y se ve el resultado en vivo.
export default function CronometroCentral({
  periodo, segundos, corriendo, tiempoAgotado, nombreLocal, nombreVis,
  golesLocal, golesVis, onToggle, onCambiarPeriodo,
}) {
  const fondoCrono = tiempoAgotado ? '#b71c1c' : periodo === 1 ? '#1a3a8a' : '#d93025'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', background: '#0d1117', borderBottom: '1px solid #1e2d3d', flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: '.68rem', fontWeight: '700', color: TEXTO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreLocal}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: '900', color: TEXTO, background: '#1e2d3d', padding: '3px 9px', borderRadius: '7px', minWidth: '44px', textAlign: 'center' }}>
          {golesLocal}-{golesVis}
        </div>
        <button onClick={onToggle} title={corriendo ? 'Pausar' : 'Iniciar'}
          style={{ background: fondoCrono, border: 'none', borderRadius: '8px', padding: '5px 9px', cursor: 'pointer', color: '#fff', fontWeight: '900', fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {corriendo ? '⏸' : '▶️'} {formatTiempo(segundos)}
        </button>
        <button onClick={onCambiarPeriodo}
          style={{ background: 'none', border: '1px solid #2a3a4a', borderRadius: '8px', padding: '5px 7px', cursor: 'pointer', color: TEXTO_TENUE, fontSize: '.65rem', fontWeight: '700' }}>
          {periodo === 1 ? '1T▸2T' : '2T'}
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0, fontSize: '.68rem', fontWeight: '700', color: TEXTO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreVis}</div>
    </div>
  )
}
