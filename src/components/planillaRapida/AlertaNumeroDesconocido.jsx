import { useState } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, ORO, btnPrimario, btnSecundario } from './estilosRapida'

// Se muestra cuando se anota un número de camiseta que no tiene registro en
// ese equipo. Tres salidas: buscar por nombre entre los jugadores del equipo
// (por si el número estaba mal o no se sabía), anotar el apellido ahí mismo
// (sin salir de la pantalla del partido, para un jugador que de verdad no
// está inscrito) o ir a la lista de jugadores a asignarlo con calma.
export default function AlertaNumeroDesconocido({ numero, equipoNombre, jugadores = [], onAnotarApellido, onSeleccionarExistente, onIrALista, onCancelar }) {
  const [apellido, setApellido] = useState('')
  const [modo, setModo] = useState(null) // null | 'apellido' | 'buscar'
  const [busqueda, setBusqueda] = useState('')

  const coincidencias = busqueda.trim()
    ? jugadores.filter(j => (j.nombre || '').toLowerCase().includes(busqueda.trim().toLowerCase()))
    : jugadores

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '18px', padding: '22px', width: '100%', maxWidth: '340px' }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '8px' }}>⚠️</div>
        <div style={{ fontSize: '.95rem', fontWeight: '800', color: TEXTO, textAlign: 'center', marginBottom: '4px' }}>
          La camiseta #{numero} no tiene registro
        </div>
        <div style={{ fontSize: '.75rem', color: TEXTO_TENUE, textAlign: 'center', marginBottom: '18px' }}>en {equipoNombre}</div>

        {modo === 'apellido' ? (
          <>
            <input value={apellido} onChange={e => setApellido(e.target.value)} autoFocus placeholder="Apellido del jugador"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: 'none', fontSize: '.95rem', fontWeight: '700', textAlign: 'center', outline: 'none', marginBottom: '14px' }}/>
            <button onClick={() => apellido.trim() && onAnotarApellido(apellido.trim())} disabled={!apellido.trim()}
              style={{ ...btnPrimario, width: '100%', opacity: apellido.trim() ? 1 : .5, marginBottom: '8px' }}>
              ✓ Guardar y continuar
            </button>
            <button onClick={() => setModo(null)} style={{ ...btnSecundario, width: '100%' }}>‹ Volver</button>
          </>
        ) : modo === 'buscar' ? (
          <>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus placeholder="Buscar por nombre..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: 'none', fontSize: '.9rem', fontWeight: '600', outline: 'none', marginBottom: '10px' }}/>
            <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '14px', border: `1px solid ${BORDE}`, borderRadius: '10px' }}>
              {coincidencias.length === 0 ? (
                <div style={{ padding: '14px', fontSize: '.8rem', color: TEXTO_TENUE, textAlign: 'center' }}>Sin coincidencias.</div>
              ) : coincidencias.map((j, i) => (
                <button key={j.id || i} onClick={() => onSeleccionarExistente(j)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '11px 12px', background: 'none', border: 'none', borderBottom: i < coincidencias.length - 1 ? `1px solid ${BORDE}` : 'none', cursor: 'pointer', color: TEXTO, fontSize: '.88rem', fontWeight: '700' }}>
                  <span>{j.nombre || <em style={{ color: TEXTO_TENUE }}>Sin nombre</em>}</span>
                  {j.numero && <span style={{ color: TEXTO_TENUE, fontSize: '.75rem', fontWeight: '700' }}>#{j.numero}</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setModo(null)} style={{ ...btnSecundario, width: '100%' }}>‹ Volver</button>
          </>
        ) : (
          <>
            <button onClick={() => setModo('buscar')} style={{ ...btnPrimario, width: '100%', marginBottom: '8px' }}>
              🔍 Buscar por nombre
            </button>
            <button onClick={() => setModo('apellido')} style={{ ...btnPrimario, width: '100%', background: ORO, color: '#1a1a1a', marginBottom: '8px' }}>
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
