import { useState } from 'react'
import { PANEL, TEXTO, TEXTO_TENUE, CIAN, btnPrimario, btnSecundario } from './estilosRapida'
import { fmtHoraDate } from '../../lib/horaHelpers'

// Sale cuando el cronómetro arrancó SOLO (puntualidad, opción del torneo):
// el árbitro decide si sigue con el tiempo corriendo o lo reinicia a 00:00.
export default function AvisoInicioAutomatico({ horaArranque, minutos, onSeguir, onReiniciar }) {
  const [confirmar, setConfirmar] = useState(false)
  const hora = fmtHoraDate(new Date(horaArranque))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 755, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div role="alertdialog" aria-label="El cronómetro arrancó solo"
        style={{ background: PANEL, border: `2px solid ${CIAN}`, borderRadius: '20px', padding: '24px 20px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ fontSize: '2.6rem', lineHeight: 1 }} aria-hidden="true">⏱️</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: TEXTO, marginTop: '10px', lineHeight: 1.2 }}>El cronómetro arrancó solo</div>
        <div style={{ fontSize: '.95rem', color: TEXTO_TENUE, marginTop: '8px', lineHeight: 1.45 }}>
          Empezó a correr a las <b style={{ color: CIAN }}>{hora}</b>
          {Number(minutos) > 0 ? <>, {minutos} min después de la hora del partido</> : <>, a la hora del partido</>}, por puntualidad.
        </div>
        {!confirmar ? (
          <>
            <button onClick={onSeguir} style={{ ...btnPrimario, width: '100%', marginTop: '20px', minHeight: '54px', fontSize: '1rem' }}>
              ▶ Seguir con el tiempo corriendo
            </button>
            <button onClick={() => setConfirmar(true)} style={{ ...btnSecundario, width: '100%', marginTop: '10px', minHeight: '50px', fontSize: '.95rem', color: TEXTO }}>
              ↺ Reiniciar el tiempo a 00:00
            </button>
          </>
        ) : (
          <div style={{ marginTop: '18px', background: 'rgba(0,0,0,.3)', borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '.95rem', fontWeight: 800, color: TEXTO, lineHeight: 1.35 }}>¿Reiniciar el tiempo?</div>
            <div style={{ fontSize: '.85rem', color: TEXTO_TENUE, marginTop: '4px', lineHeight: 1.4 }}>El reloj queda en 00:00 y lo inicias tú cuando empiece el partido.</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={onReiniciar} style={{ ...btnPrimario, flex: 1, minHeight: '50px', background: '#fff', color: '#111' }}>Sí, reiniciar</button>
              <button onClick={() => setConfirmar(false)} style={{ ...btnSecundario, flex: 1, minHeight: '50px', color: TEXTO }}>No</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
