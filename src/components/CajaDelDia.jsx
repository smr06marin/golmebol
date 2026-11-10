import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cobraEnCancha, pesos, diaBogota, resumenCaja } from '../lib/cobrosCancha'
import { FotoComprobante } from './CobrosCancha'

// «Mi caja»: el cuadre del día del árbitro, por cancha. TODO se calcula solo:
//  · arbitrajes = cada equipo paga el valor del torneo (en un W paga uno solo; en un desierto nadie)
//  · tarjetas   = las que desbloqueó en la planilla
//  · transferencias = las fotos que registró (llegan a la cuenta de Golmebol)
//  · efectivo   = lo recogido − transferencias (lo que debe tener en la mano)
//  · lo que le corresponde (pago por partido / por W de cada torneo) y lo que ENTREGA a Golmebol
// Solo cuenta partidos de torneos con «cobro en cancha» (los de Golmebol).

const FONDO = '#07070e'
const PANEL = '#111827'
const BORDE = '#1e2d3d'
const TEXTO = '#e8f4fd'
const TENUE = '#7a9ab5'
const ORO = '#f9a825'
const VERDE = '#34a853'
const ROJO = '#ff6b6b'

const sumarDias = (dia, n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
const tituloDia = dia => {
  const hoy = diaBogota()
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  const t = new Date(dia + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const hora = iso => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '')

// Trae el finanzas_config de los torneos de esos partidos
async function cargarConfigs(partidos) {
  const ids = [...new Set((partidos || []).map(p => p.tournament_id).filter(Boolean))]
  if (!ids.length) return {}
  const { data } = await supabase.from('tournaments_publico').select('id, finanzas_config').in('id', ids)
  const m = {}
  ;(data || []).forEach(t => { m[t.id] = t.finanzas_config || {} })
  return m
}

export function CajaDelDia({ partidos, configs, onClose, diaInicial }) {
  const [dia, setDia] = useState(diaInicial || diaBogota())
  const [cobros, setCobros] = useState([])
  const [cargando, setCargando] = useState(true)

  const delDia = useMemo(
    () => (partidos || []).filter(p => p.played_at && diaBogota(p.played_at) === dia && cobraEnCancha({ finanzas_config: configs[p.tournament_id] })),
    [partidos, configs, dia])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      if (!delDia.length) { setCobros([]); setCargando(false); return }
      const { data } = await supabase.from('cobros_cancha').select('*').in('match_id', delDia.map(p => p.id)).eq('anulado', false)
      if (vivo) { setCobros(data || []); setCargando(false) }
    })()
    return () => { vivo = false }
  }, [delDia])

  const r = useMemo(() => resumenCaja(delDia, configs, cobros), [delDia, configs, cobros])
  const t = r.totales
  const entrega = t.aEntregar >= 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9600, overflowY: 'auto', background: FONDO, color: TEXTO, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: '440px', margin: '0 auto', padding: '14px 16px 40px' }}>
        <button onClick={onClose} style={{ background: 'none', border: `1px solid ${BORDE}`, color: TENUE, borderRadius: '10px', padding: '10px 14px', fontWeight: '700', fontSize: '.85rem', cursor: 'pointer' }}>← Volver</button>

        <div style={{ textAlign: 'center', margin: '14px 0 10px' }}>
          <div style={{ fontSize: '.65rem', letterSpacing: '.3em', color: TENUE, textTransform: 'uppercase' }}>GOLMEBOL · MI CAJA</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setDia(sumarDias(dia, -1))} style={{ width: '44px', height: '44px', borderRadius: '12px', border: `1px solid ${BORDE}`, background: PANEL, color: TEXTO, fontSize: '1.1rem', cursor: 'pointer' }}>‹</button>
            <div style={{ minWidth: '150px', fontSize: '1.15rem', fontWeight: '900' }}>{tituloDia(dia)}</div>
            <button onClick={() => setDia(sumarDias(dia, 1))} disabled={dia >= diaBogota()} style={{ width: '44px', height: '44px', borderRadius: '12px', border: `1px solid ${BORDE}`, background: PANEL, color: TEXTO, fontSize: '1.1rem', cursor: 'pointer', opacity: dia >= diaBogota() ? .35 : 1 }}>›</button>
          </div>
        </div>

        {!r.hayPartidos ? (
          <div style={{ textAlign: 'center', color: TENUE, fontSize: '.9rem', padding: '40px 10px' }}>No tienes partidos con cobro en cancha este día.</div>
        ) : (
          <>
            {t.sinTerminar > 0 ? (
              <div style={{ background: 'rgba(249,168,37,.1)', border: '1px solid rgba(249,168,37,.45)', color: ORO, borderRadius: '12px', padding: '10px 12px', fontSize: '.8rem', fontWeight: '700', marginBottom: '12px' }}>
                ⏳ Faltan {t.sinTerminar} planilla{t.sinTerminar === 1 ? '' : 's'} por cerrar. El cuadre queda completo cuando cierres todas.
              </div>
            ) : (
              <div style={{ background: 'rgba(52,168,83,.12)', border: '1px solid rgba(52,168,83,.4)', color: '#7ee0a0', borderRadius: '12px', padding: '10px 12px', fontSize: '.8rem', fontWeight: '700', marginBottom: '12px' }}>
                ✓ Todas las planillas del día están cerradas.
              </div>
            )}

            {/* Resumen del día */}
            <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
              <div style={{ fontSize: '.72rem', color: TENUE, fontWeight: '700' }}>SE RECOGIÓ EN TOTAL</div>
              <div style={{ fontSize: '2.1rem', fontWeight: '900', margin: '2px 0 10px' }}>{pesos(t.recogido)}</div>
              <Fila a="🧑‍⚖️ Arbitrajes" b={pesos(t.arbitrajes)} tenue/>
              <Fila a="🟨 Tarjetas desbloqueadas" b={pesos(t.tarjetas)} tenue/>
              <div style={{ height: '1px', background: BORDE, margin: '10px 0' }}/>
              <Fila a="📲 En transferencias (cuenta de Golmebol)" b={pesos(t.transferencia)} fuerte/>
              <Fila a="💵 En efectivo (debes tenerlo en la mano)" b={pesos(t.efectivo)} fuerte color={t.efectivo < 0 ? ROJO : undefined}/>
              {t.efectivo < 0 && <div style={{ fontSize: '.72rem', color: ROJO, margin: '4px 0' }}>Las transferencias suman más que lo recogido. Revisa los montos de las fotos.</div>}
              <div style={{ height: '1px', background: BORDE, margin: '10px 0' }}/>
              <Fila a="➖ Lo que te corresponde a ti" b={'−' + pesos(t.leCorresponde)} fuerte color={ORO}/>
              <div style={{ marginTop: '12px', borderRadius: '12px', padding: '14px', textAlign: 'center', background: entrega ? 'rgba(26,115,232,.14)' : 'rgba(217,48,37,.14)', border: `1px solid ${entrega ? 'rgba(26,115,232,.5)' : 'rgba(217,48,37,.5)'}` }}>
                <div style={{ fontSize: '.72rem', fontWeight: '800', color: entrega ? '#8ab4f8' : ROJO }}>{entrega ? 'ENTREGAS EN EFECTIVO A GOLMEBOL' : 'GOLMEBOL TE DEBE'}</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', marginTop: '2px' }}>{pesos(Math.abs(t.aEntregar))}</div>
                <div style={{ fontSize: '.72rem', color: TENUE, marginTop: '4px' }}>
                  {entrega ? `Efectivo ${pesos(t.efectivo)} − lo tuyo ${pesos(t.leCorresponde)}` : `Lo tuyo ${pesos(t.leCorresponde)} es más que el efectivo (${pesos(t.efectivo)})`}
                </div>
              </div>
            </div>

            {/* Por cancha */}
            {r.canchas.map(g => {
              const dif = g.efectivo - g.leCorresponde
              return (
                <div key={g.cancha} style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '16px', padding: '14px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontWeight: '900', fontSize: '1rem' }}>📍 {g.cancha}</div>
                    <div style={{ fontSize: '.72rem', color: TENUE }}>{g.pitados} pitado{g.pitados === 1 ? '' : 's'}{g.ws ? ` · ${g.ws} W` : ''}{g.desiertos ? ` · ${g.desiertos} desierto` : ''}</div>
                  </div>
                  <div style={{ margin: '10px 0 4px' }}>
                    <Fila a={`Arbitrajes (${g.equiposArbitraje} equipo${g.equiposArbitraje === 1 ? '' : 's'})`} b={pesos(g.arbitrajes)} tenue/>
                    {g.ws > 0 && <div style={{ fontSize: '.68rem', color: TENUE, margin: '-1px 0 3px' }}>En los W solo paga el equipo que ganó.</div>}
                    <Fila a="Tarjetas" b={pesos(g.tarjetas)} tenue/>
                    <Fila a="Recogido en la cancha" b={pesos(g.recogido)} fuerte/>
                    <Fila a="📲 Transferencias" b={pesos(g.transferencia)} tenue/>
                    <Fila a="💵 Efectivo que debes tener" b={pesos(g.efectivo)} fuerte/>
                    <Fila a="Te corresponde" b={pesos(g.leCorresponde)} tenue color={ORO}/>
                    <Fila a={dif >= 0 ? 'Entregas de esta cancha' : 'Golmebol te debe (esta cancha)'} b={pesos(Math.abs(dif))} fuerte color={dif >= 0 ? undefined : ROJO}/>
                  </div>

                  {g.fotos.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '.7rem', color: TENUE, fontWeight: '700', marginBottom: '6px' }}>FOTOS DE LAS TRANSFERENCIAS ({g.fotos.length})</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {g.fotos.map(f => (
                          <div key={f.id} style={{ width: '88px' }}>
                            <FotoComprobante ruta={f.ruta} size={88}/>
                            <div style={{ fontSize: '.78rem', fontWeight: '800', marginTop: '3px' }}>{pesos(f.monto)}</div>
                            <div style={{ fontSize: '.62rem', color: TENUE, lineHeight: 1.25 }}>{f.partido.home?.name} vs {f.partido.away?.name} · {hora(f.hora)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '12px' }}>
                    {g.partidos.map(p => (
                      <div key={p.id} style={{ padding: '7px 0', borderTop: `1px solid ${BORDE}`, fontSize: '.78rem' }}>
                        <span style={{ color: TENUE }}>{hora(p.played_at)} </span>{p.home?.name} vs {p.away?.name}
                        {p.tipo_resultado === 'w' ? ' (W)' : p.tipo_resultado === 'desierto' ? ' (desierto)' : p.status === 'finished' ? ` · ${p.home_score}-${p.away_score}` : ' · sin cerrar'}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {cargando && <div style={{ textAlign: 'center', color: TENUE, fontSize: '.8rem' }}>Actualizando…</div>}
            <div style={{ fontSize: '.68rem', color: TENUE, textAlign: 'center', lineHeight: 1.5, marginTop: '8px' }}>
              El arbitraje, las tarjetas y lo que te corresponde se calculan solos con los valores de cada torneo. Lo único que registras tú son las fotos de transferencias.
            </div>
          </>
        )}
      </div>

    </div>
  )
}

function Fila({ a, b, tenue, fuerte, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '3px 0', fontSize: fuerte ? '.9rem' : '.82rem', fontWeight: fuerte ? '800' : '500', color: color || (tenue ? TENUE : TEXTO) }}>
      <span>{a}</span><span style={{ whiteSpace: 'nowrap' }}>{b}</span>
    </div>
  )
}

// Tarjeta que se ve en la pantalla de inicio del árbitro (solo si tiene partidos de torneos que cobran en cancha).
// Se vuelve verde y grande cuando ya cerró TODAS las planillas de hoy.
export default function BannerCaja({ partidos }) {
  const [configs, setConfigs] = useState(null)
  const [abierta, setAbierta] = useState(false)
  const claveIds = [...new Set((partidos || []).map(p => p.tournament_id).filter(Boolean))].sort().join(',')
  useEffect(() => {
    let vivo = true
    cargarConfigs(partidos).then(c => { if (vivo) setConfigs(c) }).catch(() => { if (vivo) setConfigs({}) })
    return () => { vivo = false }
  }, [claveIds]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!configs) return null
  const cobran = (partidos || []).filter(p => cobraEnCancha({ finanzas_config: configs[p.tournament_id] }))
  if (!cobran.length) return null
  const hoy = diaBogota()
  const deHoy = cobran.filter(p => p.played_at && diaBogota(p.played_at) === hoy)
  const todasCerradas = deHoy.length > 0 && deHoy.every(p => p.status === 'finished')

  return (
    <>
      <button onClick={() => setAbierta(true)}
        style={{ width: '100%', textAlign: 'left', marginBottom: '14px', padding: todasCerradas ? '16px' : '12px 14px', borderRadius: '14px', cursor: 'pointer',
          border: `1px solid ${todasCerradas ? 'rgba(52,168,83,.6)' : BORDE}`, background: todasCerradas ? 'rgba(52,168,83,.14)' : PANEL, color: TEXTO,
          boxShadow: todasCerradas ? '0 0 0 3px rgba(52,168,83,.15)' : 'none' }}>
        <div style={{ fontWeight: '900', fontSize: todasCerradas ? '1.05rem' : '.9rem' }}>{todasCerradas ? '💰 Cerraste todas las planillas de hoy' : '💰 Mi caja'}</div>
        <div style={{ fontSize: '.76rem', color: todasCerradas ? '#7ee0a0' : TENUE, marginTop: '3px', fontWeight: todasCerradas ? '700' : '500' }}>
          {todasCerradas ? 'Toca para ver el cuadre: cuánto se recogió, transferencias y lo que entregas' : 'Cuadre de plata de la cancha'}
        </div>
      </button>
      {abierta && <CajaDelDia partidos={partidos} configs={configs} onClose={() => setAbierta(false)}/>}
    </>
  )
}
