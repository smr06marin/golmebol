import { useState } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, VERDE, ROJO, btnPrimario, btnSecundario } from './estilosRapida'

// Partido por W o Desierto en la planilla rápida — mismo concepto que la
// planilla completa (ver ModalEspecial en PlanillaPartido.jsx), pero
// construido desde cero acá porque la rápida no tenía nada de esto. Además
// de elegir el tipo (y, si es W, qué equipo se presentó), pide la foto del
// equipo que sí se presentó para que quede visible en la app.
export default function ModalPartidoEspecialRapida({ nombreLocal, nombreVis, guardando, onConfirmar, onCerrar }) {
  const [tipo, setTipo] = useState(null) // null | 'w' | 'desierto'
  const [equipoGana, setEquipoGana] = useState('')
  const [foto, setFoto] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)

  const esW = tipo === 'w'
  const puedeConfirmar = tipo === 'desierto' || (tipo === 'w' && equipoGana && foto)

  function handleFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function handleConfirmar() {
    if (!puedeConfirmar || guardando) return
    onConfirmar({ tipo, equipoGana: esW ? equipoGana : null, foto: esW ? foto : null })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 850, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: PANEL, borderRadius: '18px 18px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '88dvh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '1rem', fontWeight: '800', color: TEXTO, marginBottom: '14px', textAlign: 'center' }}>⚠️ Partido especial</div>

        {!tipo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <button onClick={() => setTipo('w')} style={{ padding: '14px', background: 'rgba(30,142,62,.12)', border: `1px solid ${VERDE}`, borderRadius: '10px', cursor: 'pointer', color: VERDE, fontWeight: '800', fontSize: '.85rem', textAlign: 'left' }}>
              🏆 Por W<div style={{ fontSize: '.72rem', fontWeight: '500', color: TEXTO_TENUE, marginTop: '3px' }}>Un equipo no se presentó. El otro gana 3 a 0.</div>
            </button>
            <button onClick={() => setTipo('desierto')} style={{ padding: '14px', background: 'rgba(217,48,37,.12)', border: `1px solid ${ROJO}`, borderRadius: '10px', cursor: 'pointer', color: ROJO, fontWeight: '800', fontSize: '.85rem', textAlign: 'left' }}>
              ❌ Desierto<div style={{ fontSize: '.72rem', fontWeight: '500', color: TEXTO_TENUE, marginTop: '3px' }}>Ninguno de los dos se presentó. Queda anulado.</div>
            </button>
          </div>
        )}

        {tipo && (
          <div style={{ background: 'rgba(249,168,37,.1)', border: '1px solid #f9a825', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px', fontSize: '.72rem', color: '#f9a825' }}>
            Este partido <b>no contará</b> para las predicciones.
          </div>
        )}

        {esW && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '.75rem', fontWeight: '700', color: TEXTO, marginBottom: '8px' }}>¿Qué equipo SÍ se presentó?</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEquipoGana('local')} style={{ flex: 1, padding: '10px', border: `2px solid ${equipoGana === 'local' ? VERDE : BORDE}`, borderRadius: '8px', cursor: 'pointer', background: equipoGana === 'local' ? 'rgba(30,142,62,.12)' : 'none', color: equipoGana === 'local' ? VERDE : TEXTO_TENUE, fontWeight: equipoGana === 'local' ? '800' : '500', fontSize: '.8rem' }}>{nombreLocal}</button>
              <button onClick={() => setEquipoGana('visitante')} style={{ flex: 1, padding: '10px', border: `2px solid ${equipoGana === 'visitante' ? VERDE : BORDE}`, borderRadius: '8px', cursor: 'pointer', background: equipoGana === 'visitante' ? 'rgba(30,142,62,.12)' : 'none', color: equipoGana === 'visitante' ? VERDE : TEXTO_TENUE, fontWeight: equipoGana === 'visitante' ? '800' : '500', fontSize: '.8rem' }}>{nombreVis}</button>
            </div>
          </div>
        )}

        {esW && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '.75rem', fontWeight: '700', color: TEXTO, marginBottom: '8px' }}>📸 Foto del equipo que se presentó</div>
            {fotoPreview ? (
              <div>
                <img src={fotoPreview} alt="Foto del equipo" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: `1px solid ${BORDE}` }}/>
                <label style={{ display: 'block', marginTop: '8px', textAlign: 'center', padding: '9px', border: `1px solid ${BORDE}`, borderRadius: '8px', cursor: 'pointer', color: '#1a73e8', fontWeight: '700', fontSize: '.78rem' }}>
                  Cambiar foto
                  <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: 'none' }}/>
                </label>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '18px', border: `2px dashed ${BORDE}`, borderRadius: '10px', cursor: 'pointer', color: TEXTO_TENUE }}>
                <span style={{ fontSize: '1.5rem' }}>📷</span>
                <span style={{ fontSize: '.78rem', fontWeight: '700' }}>Tomar foto</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: 'none' }}/>
              </label>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCerrar} disabled={guardando} style={{ ...btnSecundario, flex: 1 }}>‹ Cancelar</button>
          {tipo && (
            <button onClick={handleConfirmar} disabled={!puedeConfirmar || guardando}
              style={{ ...btnPrimario, flex: 2, background: esW ? VERDE : ROJO, opacity: puedeConfirmar && !guardando ? 1 : .5 }}>
              {guardando ? 'Guardando...' : '💾 Confirmar y guardar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
