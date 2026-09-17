// Fila de circulitos de color para elegir el tema del flyer antes de
// descargarlo — cada flyer (torneo, partido, programación) le pasa su
// propia lista de temas (ver src/lib/flyerTemas.js).
export default function SelectorTemaFlyer({ temas, temaId, onElegir }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '2px 0 16px' }}>
      <span style={{ fontSize: '.75rem', color: '#5f6368', fontWeight: '600', marginRight: '2px' }}>Color:</span>
      {temas.map(t => {
        const activo = t.id === temaId
        return (
          <button key={t.id} type="button" onClick={() => onElegir(t.id)} title={t.nombre}
            style={{
              width: '26px', height: '26px', borderRadius: '50%', background: t.swatch, cursor: 'pointer',
              border: activo ? '3px solid #202124' : '2px solid #dadce0',
              boxShadow: activo ? '0 0 0 2px #fff inset' : 'none',
              flexShrink: 0, padding: 0,
            }}
          />
        )
      })}
    </div>
  )
}
