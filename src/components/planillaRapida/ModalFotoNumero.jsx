import { useState } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, btnPrimario, btnSecundario, VERDE } from './estilosRapida'

// Al tocar un jugador en la lista se abre esto: foto GRANDE para confirmar que
// es el jugador correcto, y el número de camiseta se escribe justo debajo.
// Si es un jugador SIN registro (fila agregada a mano) también deja escribir
// el apellido/nombre acá mismo.
export default function ModalFotoNumero({ jugador, onConfirmar, onQuitar, onCerrar }) {
  const [numero, setNumero] = useState(jugador?.numero || '')
  const [nombre, setNombre] = useState(jugador?.nombre || '')
  const foto = jugador?.photo_face_url || jugador?.photo_url
  const esSinRegistro = !jugador?.id
  const puedeConfirmar = numero.trim() && (!esSinRegistro || nombre.trim())

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '18px', padding: '22px', width: '100%', maxWidth: '340px', textAlign: 'center' }}>
        <div style={{ width: '160px', height: '160px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px', background: '#1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #2a3a4a' }}>
          {foto ? <img src={foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '4rem' }}>👤</span>}
        </div>

        {esSinRegistro ? (
          <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus placeholder="Nombre o apellido"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: '10px', border: 'none', fontSize: '.95rem', fontWeight: '700', textAlign: 'center', outline: 'none', marginBottom: '14px' }}/>
        ) : (
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: TEXTO, marginBottom: '2px' }}>{jugador?.nombre || 'Sin nombre'}</div>
        )}
        {jugador?.cedula && <div style={{ fontSize: '.7rem', color: TEXTO_TENUE, marginBottom: '18px' }}>🪪 {jugador.cedula}</div>}
        {!jugador?.cedula && !esSinRegistro && <div style={{ marginBottom: '14px' }}/>}

        <div style={{ fontSize: '.72rem', color: TEXTO_TENUE, marginBottom: '6px', fontWeight: '600' }}>Número de camiseta</div>
        <input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, '').slice(0, 2))}
          inputMode="numeric" placeholder="Ej: 10" maxLength={2}
          style={{ width: '110px', padding: '12px', borderRadius: '12px', border: 'none', fontSize: '1.8rem', fontWeight: '900', textAlign: 'center', outline: 'none', marginBottom: '18px' }}/>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCerrar} style={{ ...btnSecundario, flex: 1 }}>Cancelar</button>
          {jugador?.numero && (
            <button onClick={onQuitar} style={{ ...btnSecundario, flex: 1, color: '#d93025', borderColor: 'rgba(217,48,37,.4)' }}>Quitar N°</button>
          )}
          <button onClick={() => puedeConfirmar && onConfirmar(numero.trim(), nombre.trim())} disabled={!puedeConfirmar}
            style={{ ...btnPrimario, flex: 1, background: VERDE, opacity: puedeConfirmar ? 1 : .5 }}>
            ✓ Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
