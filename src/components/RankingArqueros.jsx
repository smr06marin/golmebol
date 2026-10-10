// ── Ranking de ARQUEROS del torneo ──────────────────────────────────────────
// El arquero también tiene su tabla, como los goleadores: dos formas de medir
// (botones arriba), igual que la valla por equipos:
//  · Arcos en cero: partidos en que su equipo no recibió gol mientras él atajó.
//  · Promedio: goles recibidos ÷ partidos en que atajó (menos es mejor).
// Si atajó penales en una tanda se muestra aparte (🧤 N pen.): esos penales NO
// entran en goles recibidos.
//
// rows: [{ id, name, foto, teamId, pj, recibidos, arcosEnCero, promedio, penAtajados, penEnfrentados }]
// equipos: { [teamId]: { name, logo_url } }

import { useState } from 'react'

const TEAL = '#00ddd0'

function Foto({ url, nombre, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#16202e', border: `2px solid ${TEAL}`, flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt={nombre || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}/>
        : <svg viewBox="0 0 24 24" width={size * .62} height={size * .62} fill="#3d4659"><circle cx="12" cy="7.5" r="4.2"/><path d="M3.5 21.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z"/></svg>}
    </div>
  )
}

export default function RankingArqueros({ rows, equipos = {}, onClickFila }) {
  const [modo, setModo] = useState('cero')
  const [verTodos, setVerTodos] = useState(false)

  if (!rows || rows.length === 0) return null // sin datos de arqueros no se muestra la tabla

  const ordenadas = [...rows].sort((a, b) => modo === 'cero'
    ? (b.arcosEnCero - a.arcosEnCero || a.promedio - b.promedio || b.pj - a.pj)
    : (a.promedio - b.promedio || b.arcosEnCero - a.arcosEnCero || b.pj - a.pj))
  const visibles = verTodos ? ordenadas : ordenadas.slice(0, 10)
  const valor = r => modo === 'cero' ? r.arcosEnCero : parseFloat(r.promedio.toFixed(2))
  const etiqueta = modo === 'cero' ? 'EN CERO' : 'PROM.'

  const chip = (id, texto) => (
    <button type="button" onClick={() => setModo(id)}
      style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${modo === id ? TEAL : 'rgba(255,255,255,.18)'}`, background: modo === id ? 'rgba(0,221,208,.14)' : 'transparent', color: modo === id ? TEAL : '#8b93a5', fontSize: '.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
      {texto}
    </button>
  )

  return (
    <div style={{ background: 'linear-gradient(165deg,#151a28,#0c0f18)', border: '1px solid #232b3d', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 3px 14px rgba(0,0,0,.3)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: TEAL, fontWeight: 800, fontSize: '.78rem', letterSpacing: '.14em', textTransform: 'uppercase' }}>🧤 Mejores arqueros</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {chip('cero', 'Arcos en cero')}
          {chip('promedio', 'Promedio')}
        </div>
      </div>

      {visibles.map((r, i) => {
        const eq = equipos[r.teamId]
        const puesto = i + 1
        return (
          <div key={r.id} role={onClickFila ? 'link' : undefined} tabIndex={onClickFila ? 0 : undefined}
            onClick={onClickFila ? () => onClickFila(r) : undefined}
            onKeyDown={onClickFila ? (e => { if (e.key === 'Enter') onClickFila(r) }) : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: i === 0 ? '14px 16px' : '10px 16px', borderBottom: i === visibles.length - 1 ? 'none' : '1px solid rgba(255,255,255,.06)', cursor: onClickFila ? 'pointer' : 'default', background: i === 0 ? `linear-gradient(90deg, ${TEAL}0e, transparent 70%)` : 'transparent' }}>
            <div style={{ width: '26px', flexShrink: 0, fontWeight: 900, fontSize: i === 0 ? '.95rem' : '.78rem', color: i === 0 ? TEAL : '#7d8598', textAlign: 'center' }}>{puesto}°</div>
            <Foto url={r.foto} nombre={r.name} size={i === 0 ? 46 : 36}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: i === 0 ? '#fff' : '#e8ecf4', fontWeight: 800, fontSize: i === 0 ? '.95rem' : '.82rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ color: '#8b93a5', fontSize: '.62rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '1px' }}>
                {eq && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>{eq.name}</span>}
                <span>{r.pj} PJ · {r.recibidos} GC</span>
                {r.penAtajados > 0 && <span style={{ color: '#f9a825', fontWeight: 700 }}>🧤 {r.penAtajados} pen.</span>}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{ color: TEAL, fontWeight: 900, fontSize: i === 0 ? '1.4rem' : '.95rem', lineHeight: 1 }}>{valor(r)}</div>
              <div style={{ color: TEAL, fontWeight: 700, fontSize: '.5rem', letterSpacing: '.08em', opacity: .85, marginTop: '2px' }}>{etiqueta}</div>
            </div>
          </div>
        )
      })}

      {ordenadas.length > 10 && (
        <button type="button" onClick={() => setVerTodos(v => !v)}
          style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: 'none', borderTop: '1px solid rgba(255,255,255,.08)', padding: '11px', cursor: 'pointer', color: '#aeb6c6', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit' }}>
          {verTodos ? '▲ Ver menos' : `▼ Ver los ${ordenadas.length - 10} arqueros restantes`}
        </button>
      )}
    </div>
  )
}
