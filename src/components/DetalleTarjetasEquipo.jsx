import { useState } from 'react'

// Detalle de las tarjetas de UN equipo para el organizador: una fila por jugador y partido, con su estado
//   ✓ Pagada            → la tarjeta está marcada como pagada (planilla / link de deudores / modal de pago)
//   Pendiente           → sigue sin pagar
//   Sin marca de pago   → jugador sin registro o partido sin estadísticas: no se puede marcar como pagada
// y, si lo que dice la cuenta ("debe $X") no coincide con las tarjetas realmente pendientes, lo explica
// y deja registrar la diferencia con un toque. Así nunca queda una deuda "fantasma" sin nombres.

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

export default function DetalleTarjetasEquipo({ filas, marcas, partidos, precios, saldo, onRegistrarDiferencia }) {
  const [abierto, setAbierto] = useState(false)
  const { am: pA, az: pZ, rj: pR } = precios

  // Una fila por jugador+partido (si saca varias en el mismo partido, solo se cobra la más cara)
  const porClave = new Map()
  ;(filas || []).forEach((f, i) => {
    if ((f.am || 0) + (f.az || 0) + (f.rj || 0) === 0) return
    const key = `${f.player_id || 'nr:' + (f.nombre || i)}|${f.match_id || 'sp' + i}`
    const a = porClave.get(key) || { ...f, am: 0, az: 0, rj: 0 }
    a.am += f.am || 0; a.az += f.az || 0; a.rj += f.rj || 0
    porClave.set(key, a)
  })
  const filasDetalle = [...porClave.values()].map(f => {
    const valor = Math.max(f.am > 0 ? pA : 0, f.az > 0 ? pZ : 0, f.rj > 0 ? pR : 0)
    const m = f.player_id ? marcas[`${f.player_id}|${f.match_id}`] : null
    let estado, pendiente
    if (!m) { estado = 'sin_marca'; pendiente = valor }
    else {
      pendiente = Math.max(m.am && !m.amPaid ? pA : 0, m.az && !m.azPaid ? pZ : 0, m.rj && !m.rjPaid ? pR : 0)
      estado = pendiente > 0 ? 'pendiente' : 'pagada'
    }
    const p = (partidos || []).find(x => x.id === f.match_id)
    return { ...f, valor, pendiente, estado, partido: p }
  }).filter(f => f.valor > 0)
    .sort((a, b) => new Date(b.partido?.played_at || 0) - new Date(a.partido?.played_at || 0))

  const totalPendiente = filasDetalle.reduce((a, f) => a + f.pendiente, 0)
  const diferencia = Math.round(saldo - totalPendiente)
  if (filasDetalle.length === 0 && Math.abs(diferencia) < 1) return null

  const chip = {
    pagada:    { t: '✓ Pagada', bg: '#e6f4ea', c: '#137333' },
    pendiente: { t: 'Pendiente', bg: '#fce8e6', c: '#c5221f' },
    sin_marca: { t: 'Sin marca de pago', bg: '#fef3c7', c: '#92400e' },
  }
  const rival = p => p ? `${p.home?.name || '?'} vs ${p.away?.name || '?'}` : 'Partido sin dato'

  return (
    <div style={{ flexBasis: '100%' }}>
      {diferencia > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #f9e29d', borderRadius: 10, padding: '10px 12px', margin: '2px 0 6px', fontSize: '.76rem', color: '#7a5d00', lineHeight: 1.5 }}>
          ⚠️ La cuenta dice que debe <b>{fmt(saldo)}</b>, pero las tarjetas realmente pendientes suman <b>{fmt(totalPendiente)}</b>.
          Faltan <b>{fmt(diferencia)}</b> por explicar: son tarjetas que ya están marcadas como pagadas pero cuya plata no quedó anotada
          (por ejemplo, pagadas por el link de deudores antes del arreglo, o se borró el pago después de marcarlas).
          <div style={{ marginTop: 4 }}>Si esa plata <b>sí te la pagaron</b>, regístrala para que la cuenta cuadre:</div>
          <button onClick={() => onRegistrarDiferencia(diferencia)}
            style={{ marginTop: 6, minHeight: 40, padding: '8px 14px', background: '#1e8e3e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '.78rem', fontWeight: 700 }}>
            Registrar {fmt(diferencia)} como pagado
          </button>
        </div>
      )}
      {diferencia < 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #f9e29d', borderRadius: 10, padding: '10px 12px', margin: '2px 0 6px', fontSize: '.76rem', color: '#7a5d00', lineHeight: 1.5 }}>
          ⚠️ Hay tarjetas pendientes por <b>{fmt(totalPendiente)}</b> pero la cuenta solo muestra <b>{fmt(Math.max(saldo, 0))}</b>: hay pagos registrados sin marcar sus tarjetas como pagadas.
        </div>
      )}
      {filasDetalle.length > 0 && (
        <>
          <button onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
            style={{ background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer', color: '#1a73e8', fontSize: '.78rem', fontWeight: 700, minHeight: 32 }}>
            🔎 {abierto ? 'Ocultar' : 'Ver'} detalle de tarjetas ({filasDetalle.length}) {abierto ? '▴' : '▾'}
          </button>
          {abierto && (
            <div style={{ marginTop: 4, border: '1px solid #e8eaed', borderRadius: 10, overflow: 'hidden' }}>
              {filasDetalle.map((f, i) => {
                const c = chip[f.estado]
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none', background: '#fafafa' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#202124', wordBreak: 'break-word' }}>
                        {(f.am > 0 ? '🟨'.repeat(f.am) : '') + (f.az > 0 ? '🟦'.repeat(f.az) : '') + (f.rj > 0 ? '🟥'.repeat(f.rj) : '')} {f.nombre || 'Jugador sin registro'}
                      </div>
                      <div style={{ fontSize: '.68rem', color: '#5f6368' }}>
                        {rival(f.partido)}{f.partido?.played_at ? ` · ${new Date(f.partido.played_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.78rem', fontWeight: 800, color: '#202124' }}>{fmt(f.valor)}</div>
                      <span style={{ fontSize: '.64rem', fontWeight: 800, color: c.c, background: c.bg, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{c.t}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
