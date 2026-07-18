import { COLORES_UNIFORME } from '../../lib/coloresUniforme'
import { FONDO, PANEL, BORDE, TEXTO, TEXTO_TENUE, btnPrimario } from './estilosRapida'

// Primer paso: elegir el color de cada uniforme para pintar la pantalla
// dividida del partido. Con un toque alcanza — pensado para elegir parados
// en la cancha antes de arrancar.
export default function PantallaColores({ nombreLocal, nombreVis, colorLocal, colorVis, onElegir, onContinuar }) {
  const puedeContinuar = !!colorLocal && !!colorVis

  function Paleta({ equipo, seleccionado, otro }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
        {COLORES_UNIFORME.map(c => {
          const activo = seleccionado === c.hex
          const ocupadoPorOtro = otro === c.hex
          return (
            <button key={c.hex} onClick={() => onElegir(equipo, c.hex)} disabled={ocupadoPorOtro}
              title={c.nombre}
              style={{
                aspectRatio: '1', borderRadius: '10px', background: c.hex, cursor: ocupadoPorOtro ? 'default' : 'pointer',
                border: activo ? `3px solid ${TEXTO}` : '2px solid rgba(255,255,255,.15)',
                opacity: ocupadoPorOtro ? .3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {activo && <span style={{ color: c.texto, fontSize: '1rem', fontWeight: '900' }}>✓</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, overflowY: 'auto', background: FONDO, color: TEXTO, fontFamily: 'system-ui,sans-serif', padding: '20px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: '.7rem', color: TEXTO_TENUE, letterSpacing: '.08em' }}>PLANILLA RÁPIDA</div>
        <div style={{ fontSize: '1rem', fontWeight: '800' }}>Elige el color de cada uniforme</div>
      </div>

      <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '14px', padding: '14px' }}>
        <div style={{ fontSize: '.82rem', fontWeight: '700', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏠 {nombreLocal}</div>
        <Paleta equipo="local" seleccionado={colorLocal} otro={colorVis}/>
      </div>

      <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '14px', padding: '14px' }}>
        <div style={{ fontSize: '.82rem', fontWeight: '700', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🚩 {nombreVis}</div>
        <Paleta equipo="visitante" seleccionado={colorVis} otro={colorLocal}/>
      </div>

      <button onClick={onContinuar} disabled={!puedeContinuar} style={{ ...btnPrimario, opacity: puedeContinuar ? 1 : .5, marginTop: 'auto' }}>
        Continuar → Asignar camisetas
      </button>
    </div>
  )
}
