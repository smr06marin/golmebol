import { useState } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, ORO, btnPrimario, btnSecundario } from './estilosRapida'

// Se muestra cuando se anota un número de camiseta que no tiene registro en
// ese equipo. Dos salidas: anotar el apellido ahí mismo (sin salir de la
// pantalla del partido) o ir a la lista de jugadores a asignarlo con calma.
export default function AlertaNumeroDesconocido({ numero, equipoNombre, onAnotarApellido, onIrALista, onCancelar }) {
  const [apellido, setApellido] = useState('')
  const [escribiendo, setEscribiendo] = useState(false)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '18px', padding: '22px', width: '100%', maxWidth: '340px' }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '8px' }}>⚠️</div>
        <div style={{ fontSize: '.95rem', fontWeight: '800', color: TEXTO, textAlign: 'center', marginBottom: '4px' }}>
          La camiseta #{numero} no tiene registro
        </div>
        <div style={{ fontSize: '.75rem', color: TEXTO_TENUE, textAlign: 'center', marginBottom: '18px' }}>en {equipoNombre}</div>

        {escribiendo ? (
          <>
            <input value={apellido} onChange={e => setApellido(e.target.value)} autoFocus placeholder="Apellido del jugador"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: 'none', fontSize: '.95rem', fontWeight: '700', textAlign: 'center', outline: 'none', marginBottom: '14px' }}/>
            <button onClick={() => apellido.trim() && onAnotarApellido(apellido.trim())} disabled={!apellido.trim()}
              style={{ ...btnPrimario, width: '100%', opacity: apellido.trim() ? 1 : .5, marginBottom: '8px' }}>
              ✓ Guardar y continuar
            </button>
            <button onClick={() => setEscribiendo(false)} style={{ ...btnSecundario, width: '100%' }}>‹ Volver</button>
          </>
        ) : (
          <>
            <button onClick={() => setEscribiendo(true)} style={{ ...btnPrimario, width: '100%', background: ORO, color: '#1a1a1a', marginBottom: '8px' }}>
              ✍️ Anotar apellido
            </button>
            <button onClick={onIrALista} style={{ ...btnPrimario, width: '100%', marginBottom: '8px' }}>
              📋 Ir a la lista de jugadores
            </button>
            <button onClick={onCancelar} style={{ ...btnSecundario, width: '100%' }}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  )
}
