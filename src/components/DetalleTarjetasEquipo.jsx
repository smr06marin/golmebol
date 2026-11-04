import { useState } from 'react'

// Jugadores que DEBEN tarjetas de un equipo (Finanzas) — misma lista que ve el organizador en el link de deudores:
// solo las tarjetas que siguen sin marcar como pagadas. Cada jugador con su total y, debajo, cada partido,
// y un botón "✓ Ya pagó" que anota el pago y marca sus tarjetas como pagadas (así sale de la lista y se descuenta).

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
const iconos = it => (it.am ? '🟨' : '') + (it.az ? '🟦' : '') + (it.rj ? '🟥' : '')
const fechaCorta = iso => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })

export default function DetalleTarjetasEquipo({ jugadores, partidos, onYaPago }) {
  const [ocupado, setOcupado] = useState('')
  if (!jugadores || jugadores.length === 0) return null

  const partidoDe = id => (partidos || []).find(p => p.id === id)

  async function yaPago(j) {
    setOcupado(j.player_id)
    try { await onYaPago(j) } finally { setOcupado('') }
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {jugadores.map(j => (
        <div key={j.player_id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#f8f9fa', borderBottom: '1px solid #f1f3f4' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: '.84rem', fontWeight: 800, color: '#202124', wordBreak: 'break-word' }}>{j.nombre}</span>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#d93025', whiteSpace: 'nowrap' }}>{fmt(j.total)}</span>
          </div>
          <div style={{ padding: '6px 12px' }}>
            {j.items.map((it, i) => {
              const p = partidoDe(it.match_id)
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', fontSize: '.74rem', color: '#3c4043', lineHeight: 1.35 }}>
                  <span style={{ minWidth: 0 }}>{iconos(it)} {p ? `${p.home?.name || '?'} vs ${p.away?.name || '?'}` : 'Partido'}{p?.played_at ? ` · ${fechaCorta(p.played_at)}` : ''}</span>
                  <span style={{ whiteSpace: 'nowrap', color: '#5f6368' }}>{fmt(it.monto)}</span>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '4px 12px 10px' }}>
            <button onClick={() => yaPago(j)} disabled={!!ocupado}
              style={{ width: '100%', minHeight: 42, padding: '9px 12px', background: ocupado === j.player_id ? '#dadce0' : '#1e8e3e', color: '#fff', border: 'none', borderRadius: 8, cursor: ocupado ? 'not-allowed' : 'pointer', fontSize: '.8rem', fontWeight: 700 }}>
              {ocupado === j.player_id ? 'Guardando…' : `✓ Ya pagó — ${fmt(j.total)}`}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
