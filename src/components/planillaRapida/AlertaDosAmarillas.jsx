import { PANEL, TEXTO, TEXTO_TENUE, ORO, btnPrimario, btnSecundario } from './estilosRapida'
import { timbreConVoz } from '../../lib/timbreTarjetas'

// Aviso cuando a un jugador le marcan la SEGUNDA amarilla del partido: suena
// un timbre, el celular dice "ya acumuló dos amarillas" y queda este aviso grande.
export default function AlertaDosAmarillas({ numero, nombre, equipoNombre, textoVoz, onCerrar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 760, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div role="alertdialog" aria-label="Ya acumuló dos amarillas"
        style={{ background: PANEL, border: `3px solid ${ORO}`, borderRadius: '20px', padding: '26px 22px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ width: '42px', height: '58px', borderRadius: '6px', background: '#fdd835', transform: 'rotate(-8deg)', boxShadow: '0 4px 10px rgba(0,0,0,.4)' }}/>
          <span style={{ width: '42px', height: '58px', borderRadius: '6px', background: '#fdd835', transform: 'rotate(8deg)', boxShadow: '0 4px 10px rgba(0,0,0,.4)' }}/>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: TEXTO, lineHeight: 1.2 }}>
          {numero ? `#${numero} ` : ''}{nombre || 'Jugador'}
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: ORO, marginTop: '8px' }}>
          Ya acumuló dos amarillas
        </div>
        {equipoNombre && <div style={{ fontSize: '.95rem', color: TEXTO_TENUE, marginTop: '6px' }}>{equipoNombre}</div>}
        <button onClick={onCerrar} style={{ ...btnPrimario, width: '100%', marginTop: '22px', minHeight: '54px', fontSize: '1.05rem', background: ORO, color: '#1a1a1a' }}>
          Entendido
        </button>
        <button onClick={() => timbreConVoz(textoVoz)} style={{ ...btnSecundario, width: '100%', marginTop: '10px', minHeight: '46px' }}>
          🔊 Escuchar otra vez
        </button>
      </div>
    </div>
  )
}
