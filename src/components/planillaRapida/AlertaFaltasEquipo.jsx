import { PANEL, BORDE, TEXTO, TEXTO_TENUE, ORO, btnPrimario } from './estilosRapida'

// Aviso al llegar a la 5ta falta acumulada del equipo en el tiempo (solo
// Fútbol 5): desde la siguiente, el rival cobra tiro libre directo sin
// barrera. Se dispara una sola vez al llegar a 5 — el contador que queda
// visible en la mitad del equipo recuerda el resto del tiempo.
export default function AlertaFaltasEquipo({ equipoNombre, onCerrar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: PANEL, border: `2px solid ${ORO}`, borderRadius: '18px', padding: '24px', width: '100%', maxWidth: '340px', textAlign: 'center' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🟠</div>
        <div style={{ fontSize: '1rem', fontWeight: '800', color: TEXTO, marginBottom: '6px' }}>
          {equipoNombre} llegó a 5 faltas
        </div>
        <div style={{ fontSize: '.8rem', color: TEXTO_TENUE, marginBottom: '20px' }}>
          en este tiempo — desde la próxima, tiro libre directo sin barrera (Fútbol 5)
        </div>
        <button onClick={onCerrar} style={{ ...btnPrimario, width: '100%', background: ORO, color: '#1a1a1a' }}>
          Entendido
        </button>
      </div>
    </div>
  )
}
