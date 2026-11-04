import { useState } from 'react'
import { cubrirSinMarca, etiquetaFecha } from '../lib/tarjetasEstado'

// Tarjetas de UN equipo en Finanzas, ordenadas para cobrar:
//   · "Por pagar": cada jugador con lo que debe, partido por partido, y un botón "✓ Ya pagó" en cada tarjeta.
//   · "Pagadas": lo que ya está al día (cerrado por defecto).
// Estados de cada tarjeta:
//   pendiente / sin_marca  → se debe (sin_marca = la planilla no puede marcarla; se salda anotando el pago con nombre)
//   pagada                 → marcada como pagada en la planilla
//   pagada_registro        → pagada con un pago anotado con el nombre del jugador
// Si la cuenta del equipo no coincide con lo pendiente, lo explica y deja registrar la diferencia.

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
const iconos = f => (f.am > 0 ? '🟨'.repeat(f.am) : '') + (f.az > 0 ? '🟦'.repeat(f.az) : '') + (f.rj > 0 ? '🟥'.repeat(f.rj) : '')

export default function DetalleTarjetasEquipo({ filas, marcas, partidos, precios, saldo, pagos, onRegistrarDiferencia, onYaPagoSinMarca, onYaPagoMarcada }) {
  const [verPagadas, setVerPagadas] = useState(false)
  const [ocupado, setOcupado] = useState('')
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
  const base = [...porClave.values()].map(f => {
    const valor = Math.max(f.am > 0 ? pA : 0, f.az > 0 ? pZ : 0, f.rj > 0 ? pR : 0)
    const m = f.player_id ? marcas[`${f.player_id}|${f.match_id}`] : null
    let estado, pendiente
    if (!m) { estado = 'sin_marca'; pendiente = valor }
    else {
      pendiente = Math.max(m.am && !m.amPaid ? pA : 0, m.az && !m.azPaid ? pZ : 0, m.rj && !m.rjPaid ? pR : 0)
      estado = pendiente > 0 ? 'pendiente' : 'pagada'
    }
    const p = (partidos || []).find(x => x.id === f.match_id)
    return { ...f, valor, pendiente, estado, partido: p, fecha: p?.played_at || null }
  }).filter(f => f.valor > 0)

  // Las tarjetas sin marca se cruzan con los pagos anotados con el nombre del jugador
  const cubiertas = cubrirSinMarca(base, pagos)
  const todas = base.map((f, i) => cubiertas.has(i) ? { ...f, estado: 'pagada_registro', pendiente: 0 } : f)

  const porPagar = todas.filter(f => f.estado === 'pendiente' || f.estado === 'sin_marca')
  const pagadas = todas.filter(f => f.estado === 'pagada' || f.estado === 'pagada_registro')
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
  const totalPendiente = porPagar.reduce((a, f) => a + f.pendiente, 0)
  const diferencia = Math.round(saldo - totalPendiente)
  if (todas.length === 0 && Math.abs(diferencia) < 1) return null

  // Por pagar, agrupado por jugador (A→Z) y dentro de cada uno, del partido más viejo al más nuevo
  const grupos = []
  ;[...porPagar].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es') || new Date(a.fecha || 0) - new Date(b.fecha || 0))
    .forEach(f => {
      const k = f.player_id || `nr:${f.nombre}`
      let g = grupos.find(x => x.k === k)
      if (!g) { g = { k, nombre: f.nombre || 'Jugador sin registro', filas: [], total: 0 }; grupos.push(g) }
      g.filas.push(f); g.total += f.pendiente
    })

  const rival = p => p ? `${p.home?.name || '?'} vs ${p.away?.name || '?'}` : 'Partido sin dato'
  const fechaTxt = f => f.fecha ? etiquetaFecha(f.fecha) : ''

  async function yaPago(f) {
    const id = `${f.player_id || f.nombre}|${f.match_id}`
    setOcupado(id)
    try {
      if (f.estado === 'sin_marca') await onYaPagoSinMarca({ ...f, rivalTxt: rival(f.partido), fechaTxt: fechaTxt(f) })
      else await onYaPagoMarcada(f)
    } finally { setOcupado('') }
  }

  const caja = { background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, overflow: 'hidden' }
  const aviso = { background: '#fff8e1', border: '1px solid #f9e29d', borderRadius: 10, padding: '10px 12px', margin: '2px 0 8px', fontSize: '.76rem', color: '#7a5d00', lineHeight: 1.5 }

  return (
    <div style={{ flexBasis: '100%' }}>
      {diferencia > 0 && (
        <div style={aviso}>
          ⚠️ La cuenta dice que debe <b>{fmt(saldo)}</b>, pero las tarjetas pendientes suman <b>{fmt(totalPendiente)}</b>.
          Sobran <b>{fmt(diferencia)}</b>: son tarjetas ya marcadas como pagadas cuya plata no quedó anotada.
          <div style={{ marginTop: 4 }}>Si esa plata <b>sí te la pagaron</b>, regístrala para que cuadre:</div>
          <button onClick={() => onRegistrarDiferencia(diferencia)}
            style={{ marginTop: 6, minHeight: 40, padding: '8px 14px', background: '#1e8e3e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '.78rem', fontWeight: 700 }}>
            Registrar {fmt(diferencia)} como pagado
          </button>
        </div>
      )}
      {diferencia < 0 && (
        <div style={aviso}>
          ⚠️ Las tarjetas pendientes suman <b>{fmt(totalPendiente)}</b> pero la cuenta solo muestra <b>{fmt(Math.max(saldo, 0))}</b>: hay pagos anotados sin nombre o sin marcar sus tarjetas.
        </div>
      )}

      {grupos.length > 0 ? (
        <div style={{ margin: '2px 0 8px' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#202124', margin: '0 2px 6px' }}>
            Por pagar · {porPagar.length} {porPagar.length === 1 ? 'tarjeta' : 'tarjetas'} · <span style={{ color: '#d93025' }}>{fmt(totalPendiente)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grupos.map(g => (
              <div key={g.k} style={caja}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px', background: '#f8f9fa', borderBottom: '1px solid #f1f3f4' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#202124', minWidth: 0, wordBreak: 'break-word' }}>{g.nombre}</span>
                  <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#d93025', whiteSpace: 'nowrap' }}>{fmt(g.total)}</span>
                </div>
                {g.filas.map((f, i) => {
                  const id = `${f.player_id || f.nombre}|${f.match_id}`
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#202124' }}>{iconos(f)} {fmt(f.pendiente)}</div>
                        <div style={{ fontSize: '.7rem', color: '#5f6368', lineHeight: 1.35 }}>{rival(f.partido)}{fechaTxt(f) ? ` · ${fechaTxt(f)}` : ''}</div>
                      </div>
                      <button onClick={() => yaPago(f)} disabled={!!ocupado}
                        style={{ minHeight: 40, padding: '8px 12px', background: ocupado === id ? '#dadce0' : '#1e8e3e', color: '#fff', border: 'none', borderRadius: 8, cursor: ocupado ? 'not-allowed' : 'pointer', fontSize: '.76rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {ocupado === id ? 'Guardando…' : '✓ Ya pagó'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        todas.length > 0 && <div style={{ ...aviso, background: '#e6f4ea', borderColor: '#ceead6', color: '#137333', fontWeight: 700 }}>✓ No hay tarjetas por pagar en este equipo.</div>
      )}

      {pagadas.length > 0 && (
        <>
          <button onClick={() => setVerPagadas(v => !v)} aria-expanded={verPagadas}
            style={{ background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer', color: '#1a73e8', fontSize: '.78rem', fontWeight: 700, minHeight: 36 }}>
            ✓ {verPagadas ? 'Ocultar' : 'Ver'} tarjetas pagadas ({pagadas.length}) {verPagadas ? '▴' : '▾'}
          </button>
          {verPagadas && (
            <div style={caja}>
              {pagadas.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none', background: '#fafafa' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#202124', wordBreak: 'break-word' }}>{iconos(f)} {f.nombre || 'Jugador sin registro'}</div>
                    <div style={{ fontSize: '.68rem', color: '#5f6368' }}>{rival(f.partido)}{fechaTxt(f) ? ` · ${fechaTxt(f)}` : ''}</div>
                  </div>
                  <span style={{ fontSize: '.64rem', fontWeight: 800, color: '#137333', background: '#e6f4ea', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                    {f.estado === 'pagada_registro' ? '✓ Pagada (pago anotado)' : '✓ Pagada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
