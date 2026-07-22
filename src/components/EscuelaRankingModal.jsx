const S = {
  navy: '#07070e', card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)', gold: '#f9a825', goldDim: 'rgba(249,168,37,.1)',
  text: '#e8f4fd', muted: '#7a9ab5',
}

function fmtValor(v, item) {
  if (v == null) return '—'
  return `${v}${item.unidad ? ` ${item.unidad}` : ''}`
}

function Fila({ j, puesto, esYo, item }) {
  const medalla = puesto === 1 ? '🥇' : puesto === 2 ? '🥈' : puesto === 3 ? '🥉' : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: esYo ? S.cyanDim : 'transparent', borderLeft: esYo ? `3px solid ${S.cyan}` : '3px solid transparent' }}>
      <div style={{ width: 28, textAlign: 'center', flexShrink: 0, fontWeight: 900, fontSize: medalla ? '1.05rem' : '.82rem', color: puesto <= 3 ? S.gold : S.muted }}>
        {medalla || `#${puesto}`}
      </div>
      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: S.border, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {j.foto ? <img src={j.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.75rem' }}>👤</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: '.82rem', fontWeight: esYo ? 800 : 500, color: esYo ? S.cyan : S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {j.nombre}{esYo && ' · Tú'}
      </div>
      <div style={{ fontWeight: 900, fontSize: '.92rem', color: esYo ? S.cyan : '#fff', flexShrink: 0 }}>{fmtValor(j.valor, item)}</div>
    </div>
  )
}

// Ranking de una categoría de la escuela. Un jugador (modoCompleto=false) solo
// ve al #1 y su propia posición — para que se sientan en competencia por
// llegar a la cima sin exponer ni comparar a todos los compañeros entre sí.
// Un profesor (modoCompleto=true) ve la lista completa.
export default function EscuelaRankingModal({ item, roster, playerId, modoCompleto, onClose }) {
  if (!item) return null
  const filtrado = roster.filter(j => (!item.soloPortero || j.esPortero) && j[item.campo] != null)
  const ordenado = [...filtrado]
    .sort((a, b) => item.orden === 'asc' ? a[item.campo] - b[item.campo] : b[item.campo] - a[item.campo])
    .map(j => ({ ...j, valor: j[item.campo] }))
  const miIdx = ordenado.findIndex(j => j.id === playerId)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: S.navy, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: `0.5px solid ${S.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: S.text }}>{item.icon} {item.label}</div>
            <div style={{ fontSize: '.7rem', color: S.muted, marginTop: '2px' }}>
              {item.soloPortero ? 'Solo arqueros · ' : ''}{ordenado.length} jugador{ordenado.length === 1 ? '' : 'es'} con datos
            </div>
          </div>
          <button onClick={onClose} style={{ background: S.border, border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: S.muted, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {ordenado.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: S.muted, fontSize: '.85rem' }}>Todavía no hay datos para este ranking.</div>
          ) : modoCompleto ? (
            ordenado.map((j, i) => <Fila key={j.id} j={j} puesto={i + 1} esYo={j.id === playerId} item={item}/>)
          ) : (
            <>
              <Fila j={ordenado[0]} puesto={1} esYo={ordenado[0].id === playerId} item={item}/>
              {miIdx > 0 && <Fila j={ordenado[miIdx]} puesto={miIdx + 1} esYo item={item}/>}
              {miIdx === -1 && (
                <div style={{ padding: '18px 20px', textAlign: 'center', color: S.muted, fontSize: '.8rem' }}>Todavía no tienes datos en esta categoría.</div>
              )}
              {miIdx === 0 && (
                <div style={{ margin: '10px 18px', background: S.goldDim, borderRadius: 10, padding: '10px 14px', textAlign: 'center', color: S.gold, fontWeight: 700, fontSize: '.8rem' }}>🏆 ¡Vas primero! Sigue así.</div>
              )}
              {miIdx > 0 && (
                <div style={{ padding: '14px 20px 6px', textAlign: 'center', color: S.muted, fontSize: '.76rem' }}>Sigue mejorando para alcanzar el primer lugar 💪</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
