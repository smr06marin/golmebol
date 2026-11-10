import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cobraEnCancha, pesos, diaBogota, resumenCaja } from '../lib/cobrosCancha'
import { CarruselFotos } from './CobrosCancha'

// «Mi cuenta del día»: lo que el árbitro necesita saber al cerrar las planillas, en lenguaje sencillo.
//  1) Arriba, UNA frase grande: cuánto entrega a Golmebol (o cuánto le deben).
//  2) La cuenta paso a paso (recogido → transferencias → efectivo → su pago).
//  3) Por cancha: partido por partido, y las fotos de las transferencias en carrusel.
// TODO se calcula solo con los valores del torneo. Solo cuenta torneos con «cobro en cancha» (los de Golmebol).
// Las transferencias llegan a la cuenta de Golmebol: el árbitro solo maneja el efectivo.

const FONDO = '#07070e'
const PANEL = '#111827'
const BORDE = '#1e2d3d'
const TEXTO = '#f1f7fc'
const TENUE = '#9db4c8'
const ORO = '#f9a825'
const VERDE = '#4ade80'
const AZUL = '#8ab4f8'

const sumarDias = (dia, n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
const tituloDia = dia => {
  const hoy = diaBogota()
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  const t = new Date(dia + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const hora = iso => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '')
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// Trae el finanzas_config de los torneos de esos partidos
async function cargarConfigs(partidos) {
  const ids = [...new Set((partidos || []).map(p => p.tournament_id).filter(Boolean))]
  if (!ids.length) return {}
  const { data } = await supabase.from('tournaments_publico').select('id, finanzas_config').in('id', ids)
  const m = {}
  ;(data || []).forEach(t => { m[t.id] = t.finanzas_config || {} })
  return m
}

// Qué hacer con la plata, dicho en una frase
function Veredicto({ efectivo, leCorresponde, aEntregar, titulo }) {
  const entrega = aEntregar >= 0
  const color = entrega ? AZUL : VERDE
  return (
    <div style={{ background: entrega ? 'rgba(26,115,232,.14)' : 'rgba(74,222,128,.12)', border: `2px solid ${entrega ? 'rgba(138,180,248,.55)' : 'rgba(74,222,128,.5)'}`, borderRadius: '18px', padding: '18px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: '.95rem', fontWeight: '800', color, letterSpacing: '.04em' }}>{titulo || (entrega ? 'DEBES ENTREGAR A GOLMEBOL' : 'GOLMEBOL TE DEBE')}</div>
      <div style={{ fontSize: '2.6rem', fontWeight: '900', margin: '4px 0 8px', color: TEXTO, lineHeight: 1.1 }}>{pesos(Math.abs(aEntregar))}</div>
      <div style={{ fontSize: '1rem', lineHeight: 1.5, color: TEXTO }}>
        {entrega
          ? <>Debes tener <b>{pesos(efectivo)}</b> en efectivo. Quédate con tu pago (<b>{pesos(leCorresponde)}</b>) y entrega el resto.</>
          : <>Debes tener <b>{pesos(efectivo)}</b> en efectivo y es tuyo. Golmebol te paga la diferencia hasta completar tu pago de <b>{pesos(leCorresponde)}</b>.</>}
      </div>
    </div>
  )
}

function Paso({ n, titulo, valor, nota, fuerte, color, signo }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 0', borderTop: n > 1 ? `1px solid ${BORDE}` : 'none' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: fuerte ? ORO : '#1e2d3d', color: fuerte ? '#1b1300' : TEXTO, fontWeight: 900, fontSize: '.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
          <div style={{ fontSize: '1rem', fontWeight: fuerte ? 900 : 700, color: color || TEXTO }}>{titulo}</div>
          <div style={{ fontSize: fuerte ? '1.3rem' : '1.1rem', fontWeight: 900, color: color || TEXTO, whiteSpace: 'nowrap' }}>{signo}{valor}</div>
        </div>
        {nota && <div style={{ fontSize: '.88rem', color: TENUE, marginTop: '3px', lineHeight: 1.45 }}>{nota}</div>}
      </div>
    </div>
  )
}

function Cuenta({ t }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '18px', padding: '8px 16px 10px' }}>
      <Paso n={1} titulo="Se recogió en total" valor={pesos(t.recogido)}
        nota={`Arbitrajes ${pesos(t.arbitrajes)} + tarjetas ${pesos(t.tarjetas)}`}/>
      <Paso n={2} titulo="Pagaron por transferencia" valor={pesos(t.transferencia)} signo="−" color={AZUL}
        nota="Esa plata ya llegó a la cuenta de Golmebol. Tú no la tienes."/>
      <Paso n={3} titulo="Efectivo que debes tener" valor={pesos(t.efectivo)} fuerte
        nota="Es la plata que debes tener en la mano."/>
      <Paso n={4} titulo="Tu pago por arbitrar" valor={pesos(t.leCorresponde)} signo="−" color={ORO}
        nota="Según los partidos que pitaste. Te lo quedas tú."/>
    </div>
  )
}

function LineaPartido({ l }) {
  const p = l.partido
  const nombre = `${p.home?.name || '?'} vs ${p.away?.name || '?'}`
  let estado = ''
  if (!l.cerrado) estado = 'Sin cerrar'
  else if (l.tipo === 'w') estado = 'Por W'
  else if (l.tipo === 'desierto') estado = 'Desierto'
  else estado = `${p.home_score ?? 0} - ${p.away_score ?? 0}`
  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${BORDE}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
        <div style={{ fontSize: '1rem', fontWeight: 800 }}>{nombre}</div>
        <div style={{ fontSize: '.85rem', color: l.cerrado ? TENUE : ORO, fontWeight: 700, whiteSpace: 'nowrap' }}>{hora(p.played_at)} · {estado}</div>
      </div>
      {!l.cerrado ? (
        <div style={{ fontSize: '.9rem', color: ORO, marginTop: '4px' }}>⏳ Cierra la planilla para que cuente.</div>
      ) : l.tipo === 'desierto' ? (
        <div style={{ fontSize: '.9rem', color: TENUE, marginTop: '4px' }}>Nadie paga arbitraje en un partido desierto.</div>
      ) : (
        <div style={{ fontSize: '.92rem', color: TENUE, marginTop: '4px', lineHeight: 1.55 }}>
          Arbitraje: <b style={{ color: TEXTO }}>{pesos(l.arbitraje)}</b> {l.tipo === 'w' ? '(en un W paga un solo equipo)' : `(${plural(l.equipos, 'equipo', 'equipos')})`}
          {l.tarjetas > 0 && <> · Tarjetas: <b style={{ color: TEXTO }}>{pesos(l.tarjetas)}</b></>}
          <br/>Tu pago: <b style={{ color: ORO }}>{pesos(l.pago)}</b>
        </div>
      )}
    </div>
  )
}

function TarjetaCancha({ g, abiertaInicial }) {
  const [abierta, setAbierta] = useState(abiertaInicial)
  const dif = g.efectivo - g.leCorresponde
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '18px', marginBottom: '14px', overflow: 'hidden' }}>
      <button onClick={() => setAbierta(a => !a)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: TEXTO, padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>📍 {g.cancha}</div>
          <div style={{ fontSize: '.88rem', color: TENUE, marginTop: '3px' }}>
            {plural(g.partidos.length, 'partido', 'partidos')}{g.sinTerminar ? ` · ⏳ ${g.sinTerminar} sin cerrar` : ''} · {dif >= 0 ? 'Entregas' : 'Te deben'} <b style={{ color: dif >= 0 ? AZUL : VERDE }}>{pesos(Math.abs(dif))}</b>
          </div>
        </div>
        <div style={{ fontSize: '1.4rem', color: TENUE, transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</div>
      </button>

      {abierta && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 800, color: TENUE, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '2px' }}>Partido por partido</div>
          {g.detalle.map(l => <LineaPartido key={l.partido.id} l={l}/>)}

          <div style={{ marginTop: '12px', background: '#0b1220', borderRadius: '14px', padding: '12px 14px' }}>
            <FilaSimple a="Recogido en esta cancha" b={pesos(g.recogido)}/>
            <FilaSimple a="Por transferencia (ya en Golmebol)" b={'−' + pesos(g.transferencia)} color={AZUL}/>
            <FilaSimple a="Efectivo que debes tener" b={pesos(g.efectivo)} fuerte/>
            <FilaSimple a="Tu pago" b={'−' + pesos(g.leCorresponde)} color={ORO}/>
            <div style={{ borderTop: `1px solid ${BORDE}`, marginTop: '6px', paddingTop: '8px' }}>
              <FilaSimple a={dif >= 0 ? 'Entregas de esta cancha' : 'Golmebol te debe (esta cancha)'} b={pesos(Math.abs(dif))} fuerte color={dif >= 0 ? AZUL : VERDE}/>
            </div>
          </div>

          {g.fotos.length > 0 ? (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '.8rem', fontWeight: 800, color: AZUL, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>📲 Transferencias recibidas ({g.fotos.length})</div>
              <CarruselFotos oscuro fotos={g.fotos.map(f => ({ id: f.id, ruta: f.ruta, monto: f.monto, titulo: `${f.partido.home?.name || '?'} vs ${f.partido.away?.name || '?'}`, sub: hora(f.hora) }))}/>
            </div>
          ) : (
            <div style={{ fontSize: '.88rem', color: TENUE, marginTop: '14px' }}>No hubo transferencias en esta cancha.</div>
          )}
        </div>
      )}
    </div>
  )
}

function FilaSimple({ a, b, color, fuerte }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: fuerte ? '1.02rem' : '.95rem', fontWeight: fuerte ? 900 : 600, color: color || TEXTO }}>
      <span>{a}</span><span style={{ whiteSpace: 'nowrap' }}>{b}</span>
    </div>
  )
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
  const hoy = diaBogota()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9600, overflowY: 'auto', background: FONDO, color: TEXTO, fontFamily: 'system-ui,sans-serif', WebkitTextSizeAdjust: '100%', textSizeAdjust: '100%' }}>
      <div style={{ maxWidth: '460px', margin: '0 auto', padding: '14px 16px 48px' }}>
        <button onClick={onClose} style={{ background: 'none', border: `1px solid ${BORDE}`, color: TEXTO, borderRadius: '12px', padding: '12px 16px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', minHeight: '48px' }}>← Volver</button>

        <div style={{ textAlign: 'center', margin: '16px 0 14px' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '900' }}>💰 Mi cuenta del día</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '10px' }}>
            <button onClick={() => setDia(sumarDias(dia, -1))} aria-label="Día anterior" style={{ width: '52px', height: '52px', borderRadius: '14px', border: `1px solid ${BORDE}`, background: PANEL, color: TEXTO, fontSize: '1.3rem', cursor: 'pointer' }}>‹</button>
            <div style={{ minWidth: '140px', fontSize: '1.2rem', fontWeight: '900' }}>{tituloDia(dia)}</div>
            <button onClick={() => setDia(sumarDias(dia, 1))} disabled={dia >= hoy} aria-label="Día siguiente" style={{ width: '52px', height: '52px', borderRadius: '14px', border: `1px solid ${BORDE}`, background: PANEL, color: TEXTO, fontSize: '1.3rem', cursor: 'pointer', opacity: dia >= hoy ? .35 : 1 }}>›</button>
          </div>
        </div>

        {!r.hayPartidos ? (
          <div style={{ textAlign: 'center', color: TENUE, fontSize: '1rem', padding: '40px 10px', lineHeight: 1.5 }}>No tienes partidos con cobro en cancha este día.</div>
        ) : (
          <>
            {t.sinTerminar > 0 ? (
              <div style={{ background: 'rgba(249,168,37,.12)', border: '1px solid rgba(249,168,37,.5)', color: ORO, borderRadius: '14px', padding: '12px 14px', fontSize: '.95rem', fontWeight: '700', marginBottom: '14px', lineHeight: 1.45 }}>
                ⏳ Faltan {plural(t.sinTerminar, 'planilla', 'planillas')} por cerrar. Esta cuenta aún no está completa.
              </div>
            ) : (
              <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.4)', color: VERDE, borderRadius: '14px', padding: '12px 14px', fontSize: '.95rem', fontWeight: '800', marginBottom: '14px' }}>
                ✓ Cerraste todas las planillas. Esta es tu cuenta final.
              </div>
            )}

            <Veredicto efectivo={t.efectivo} leCorresponde={t.leCorresponde} aEntregar={t.aEntregar}/>

            <div style={{ fontSize: '.8rem', fontWeight: 800, color: TENUE, letterSpacing: '.06em', textTransform: 'uppercase', margin: '22px 2px 8px' }}>¿Cómo salió la cuenta?</div>
            <Cuenta t={t}/>

            <div style={{ fontSize: '.8rem', fontWeight: 800, color: TENUE, letterSpacing: '.06em', textTransform: 'uppercase', margin: '22px 2px 8px' }}>
              {r.canchas.length === 1 ? 'Detalle de la cancha' : 'Detalle por cancha'}
            </div>
            {r.canchas.map(g => <TarjetaCancha key={g.cancha} g={g} abiertaInicial={r.canchas.length === 1}/>)}

            {cargando && <div style={{ textAlign: 'center', color: TENUE, fontSize: '.9rem' }}>Actualizando…</div>}
            <div style={{ fontSize: '.85rem', color: TENUE, textAlign: 'center', lineHeight: 1.55, marginTop: '10px' }}>
              Todo se calcula solo con los valores del torneo. Si algún número no te cuadra, habla con el organizador.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Botón grande para el aviso «Planilla cerrada»: lleva directo a la cuenta del día (solo si el torneo cobra en cancha)
export function BotonCuentaDelDia({ partido, onAntes }) {
  const [cobra, setCobra] = useState(false)
  useEffect(() => {
    let vivo = true
    if (!partido?.tournament_id) return undefined
    cargarConfigs([partido]).then(c => { if (vivo) setCobra(cobraEnCancha({ finanzas_config: c[partido.tournament_id] })) }).catch(() => {})
    return () => { vivo = false }
  }, [partido?.tournament_id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!cobra) return null
  return (
    <button onClick={() => { onAntes?.(); window.dispatchEvent(new Event('golmebol:abrir-caja')) }}
      style={{ marginTop: '10px', width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(74,222,128,.5)', background: 'rgba(74,222,128,.12)', color: VERDE, fontWeight: '900', fontSize: '.95rem', cursor: 'pointer', minHeight: '52px' }}>
      💰 Ver mi cuenta del día
    </button>
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
  useEffect(() => {
    const abrir = () => setAbierta(true)
    window.addEventListener('golmebol:abrir-caja', abrir)
    return () => window.removeEventListener('golmebol:abrir-caja', abrir)
  }, [])

  if (!configs) return null
  const cobran = (partidos || []).filter(p => cobraEnCancha({ finanzas_config: configs[p.tournament_id] }))
  if (!cobran.length) return null
  const hoy = diaBogota()
  const deHoy = cobran.filter(p => p.played_at && diaBogota(p.played_at) === hoy)
  const todasCerradas = deHoy.length > 0 && deHoy.every(p => p.status === 'finished')

  return (
    <>
      <button onClick={() => setAbierta(true)}
        style={{ width: '100%', textAlign: 'left', marginBottom: '14px', padding: '16px', borderRadius: '16px', cursor: 'pointer', minHeight: '64px',
          border: `2px solid ${todasCerradas ? 'rgba(74,222,128,.6)' : BORDE}`, background: todasCerradas ? 'rgba(74,222,128,.12)' : PANEL, color: TEXTO,
          boxShadow: todasCerradas ? '0 0 0 3px rgba(74,222,128,.12)' : 'none' }}>
        <div style={{ fontWeight: '900', fontSize: '1.05rem' }}>{todasCerradas ? '💰 Cerraste todas las planillas de hoy' : '💰 Mi cuenta del día'}</div>
        <div style={{ fontSize: '.9rem', color: todasCerradas ? VERDE : TENUE, marginTop: '4px', fontWeight: todasCerradas ? '700' : '500', lineHeight: 1.4 }}>
          {todasCerradas ? 'Toca aquí para ver cuánto debes entregar' : 'Toca para ver cuánta plata debes tener y entregar'}
        </div>
      </button>
      {abierta && <CajaDelDia partidos={partidos} configs={configs} onClose={() => setAbierta(false)}/>}
    </>
  )
}
