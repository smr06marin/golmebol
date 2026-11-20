// Opción del torneo: el cronómetro de la planilla arranca SOLO unos minutos
// después de la hora programada del partido (para manejar la puntualidad).
// valor: '' / null = apagado · número (0 o más) = minutos después de la hora.
const CHIPS = [0, 5, 10, 15]

export default function CampoInicioAutomatico({ valor, onChange }) {
  const activo = valor !== '' && valor !== null && valor !== undefined && Number.isFinite(Number(valor))
  const min = activo ? Number(valor) : 10
  const btn = on => ({
    flex: 1, minHeight: '44px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '.85rem', fontFamily: 'inherit',
    border: `1.5px solid ${on ? '#1a73e8' : '#dadce0'}`, background: on ? '#e8f0fe' : '#fff', color: on ? '#1a73e8' : '#3c4043',
  })
  return (
    <div style={{ border: '1px solid #e8eaed', borderRadius: '10px', padding: '14px' }}>
      <div style={{ fontSize: '.85rem', fontWeight: '700', color: '#202124', marginBottom: '2px' }}>⏱️ Puntualidad: ¿el cronómetro arranca solo?</div>
      <div style={{ fontSize: '.72rem', color: '#80868b', marginBottom: '12px', lineHeight: 1.45 }}>
        Si dices que sí, el cronómetro de la planilla empieza a correr solo unos minutos después de la hora del partido, aunque un equipo no haya llegado. El árbitro igual puede reiniciar el tiempo en la planilla.
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => onChange('')} style={btn(!activo)}>No, lo inicia el árbitro</button>
        <button type="button" onClick={() => onChange(activo ? min : 10)} style={btn(activo)}>Sí, que arranque solo</button>
      </div>
      {activo && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#3c4043', marginBottom: '8px' }}>¿Cuántos minutos después de la hora del partido?</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {CHIPS.map(c => (
              <button key={c} type="button" onClick={() => onChange(c)}
                style={{ minWidth: '56px', minHeight: '44px', borderRadius: '999px', cursor: 'pointer', fontWeight: 800, fontSize: '.85rem', fontFamily: 'inherit', border: `1.5px solid ${min === c ? '#1a73e8' : '#dadce0'}`, background: min === c ? '#1a73e8' : '#fff', color: min === c ? '#fff' : '#3c4043' }}>
                {c === 0 ? 'A la hora' : `${c} min`}
              </button>
            ))}
            <input type="number" min="0" max="120" inputMode="numeric" value={min}
              onChange={e => { const n = parseInt(e.target.value, 10); onChange(Number.isFinite(n) ? Math.max(0, Math.min(120, n)) : 0) }}
              aria-label="Minutos después de la hora del partido"
              style={{ width: '74px', minHeight: '44px', padding: '0 10px', border: '1px solid #dadce0', borderRadius: '10px', fontSize: '.95rem', textAlign: 'center', fontFamily: 'inherit' }}/>
          </div>
          <div style={{ fontSize: '.75rem', color: '#1e8e3e', marginTop: '10px', lineHeight: 1.4, background: '#e6f4ea', borderRadius: '8px', padding: '8px 10px' }}>
            Ejemplo: partido a las 3:00 PM → el cronómetro arranca solo a las {min === 0 ? '3:00' : `3:${String(min % 60).padStart(2, '0')}`}{min >= 60 ? ' (+1 h)' : ''} PM.
          </div>
        </div>
      )}
    </div>
  )
}
