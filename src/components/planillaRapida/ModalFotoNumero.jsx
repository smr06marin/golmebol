import { useState } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, btnPrimario, btnSecundario, VERDE } from './estilosRapida'

// Al tocar un jugador en la lista se abre esto: foto GRANDE para confirmar que
// es el jugador correcto, y el número de camiseta se escribe justo debajo.
// Si es un jugador SIN registro (fila agregada a mano) también deja escribir
// el apellido/nombre acá mismo.
export default function ModalFotoNumero({ jugador, deudaItems = [], equiposNombre = {}, onConfirmar, onQuitar, onCerrar }) {
  const [numero, setNumero] = useState(jugador?.numero || '')
  const [nombre, setNombre] = useState(jugador?.nombre || '')
  const foto = jugador?.photo_face_url || jugador?.photo_url
  const esSinRegistro = !jugador?.id
  const debeTarjeta = !!jugador?.debeTarjeta
  const puedeConfirmar = !debeTarjeta && numero.trim() && (!esSinRegistro || nombre.trim())
  const iconoTipo = { Amarilla: '🟨', Azul: '🟦', Roja: '🟥' }

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

        {debeTarjeta ? (
          <div style={{ background: 'rgba(217,48,37,.12)', border: '1px solid rgba(217,48,37,.45)', borderRadius: '12px', padding: '12px 14px', marginBottom: '18px', textAlign: 'left' }}>
            <div style={{ fontWeight: '800', color: '#ff6b5e', fontSize: '.82rem', marginBottom: '8px' }}>⚠️ Debe tarjeta sin pagar</div>
            {deudaItems.length === 0 ? (
              <div style={{ fontSize: '.75rem', color: TEXTO_TENUE }}>Sin detalle disponible.</div>
            ) : deudaItems.map((it, i) => (
              <div key={i} style={{ fontSize: '.75rem', color: TEXTO, marginBottom: '5px' }}>
                <span style={{ fontWeight: '700' }}>
                  {(it.tiposDelPartido || [it.tipo]).map(t => iconoTipo[t] || '🃏').join(' ')} {(it.tiposDelPartido || [it.tipo]).join(' + ')}
                </span>
                {it.tiposDelPartido?.length > 1 && (
                  <div style={{ color: TEXTO_TENUE, fontSize: '.65rem' }}>Varias en el mismo partido — se cobra solo la de mayor valor</div>
                )}
                {(it.home_team_id || it.away_team_id) && (
                  <div style={{ color: TEXTO_TENUE, fontSize: '.68rem' }}>{equiposNombre[it.home_team_id] || '?'} vs {equiposNombre[it.away_team_id] || '?'}{it.fecha ? ' · ' + new Date(it.fecha).toLocaleDateString('es-CO') : ''}</div>
                )}
                {it.monto > 0 && <span style={{ fontWeight: '700' }}> · ${it.monto.toLocaleString('es-CO')}</span>}
              </div>
            ))}
            <div style={{ fontSize: '.68rem', color: TEXTO_TENUE, marginTop: '8px' }}>No se le puede poner número hasta ponerse al día. En cuanto se registre el pago, se libera solo — sin recargar.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '.72rem', color: TEXTO_TENUE, marginBottom: '6px', fontWeight: '600' }}>Número de camiseta</div>
            <input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, '').slice(0, 2))}
              inputMode="numeric" placeholder="Ej: 10" maxLength={2}
              style={{ width: '110px', padding: '12px', borderRadius: '12px', border: 'none', fontSize: '1.8rem', fontWeight: '900', textAlign: 'center', outline: 'none', marginBottom: '18px' }}/>
          </>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCerrar} style={{ ...btnSecundario, flex: 1 }}>Cancelar</button>
          {!debeTarjeta && jugador?.numero && (
            <button onClick={onQuitar} style={{ ...btnSecundario, flex: 1, color: '#d93025', borderColor: 'rgba(217,48,37,.4)' }}>Quitar N°</button>
          )}
          {!debeTarjeta && (
            <button onClick={() => puedeConfirmar && onConfirmar(numero.trim(), nombre.trim())} disabled={!puedeConfirmar}
              style={{ ...btnPrimario, flex: 1, background: VERDE, opacity: puedeConfirmar ? 1 : .5 }}>
              ✓ Confirmar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
