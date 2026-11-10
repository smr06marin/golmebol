import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { diaBogota, pesos, resumenCaja } from '../../lib/cobrosCancha'
import { FotoComprobante } from '../../components/CobrosCancha'

// CUADRE DE CANCHA (para el dueño del torneo / administrador)
//  1) CUADRE POR DÍA Y POR CANCHA (todo automático): lo recogido (arbitrajes + tarjetas), lo que ya llegó a tu cuenta por
//     transferencia, el efectivo que recogió el árbitro, lo que le toca al árbitro, lo que te debe entregar, el alquiler
//     de la cancha y LO QUE TE QUEDA. Son las mismas cuentas de Finanzas del torneo (Gastos = canchas + árbitros).
//  2) TRANSFERENCIAS: cada foto de comprobante que tomó un árbitro, por día y cancha, con «revisada» para compararla con el banco.
// Datos: tabla cobros_cancha (migracion_cobros_cancha.sql). El aviso al celular llega al instante con cada transferencia.

const AZUL = '#1a73e8'
const VERDE = '#188038'
const NARANJA = '#e8710a'
const ROJO = '#d93025'
const INK = '#202124'
const MUTED = '#5f6368'
const LINE = '#e3e5e8'

const sumarDias = (dia, n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
const inicioDia = dia => new Date(`${dia}T00:00:00-05:00`).toISOString()
const finDia = dia => new Date(`${sumarDias(dia, 1)}T00:00:00-05:00`).toISOString()
const lunesDe = dia => { const d = new Date(dia + 'T12:00:00'); const k = (d.getDay() + 6) % 7; return sumarDias(dia, -k) }
const tituloDia = dia => {
  const hoy = diaBogota()
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  const t = new Date(dia + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
const fechaCorta = iso => new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota' })

function Tarjeta({ titulo, valor, sub, color = INK, fondo = '#fff', borde = LINE }) {
  return (
    <div style={{ flex: '1 1 140px', background: fondo, border: `1px solid ${borde}`, borderRadius: '14px', padding: '12px 14px' }}>
      <div style={{ fontSize: '.7rem', fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{titulo}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: '900', color, marginTop: '2px' }}>{valor}</div>
      {sub && <div style={{ fontSize: '.72rem', color: MUTED, marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

function Fila({ a, b, color, fuerte, tenue, signo }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: fuerte ? '.92rem' : '.84rem', fontWeight: fuerte ? '800' : '500', color: color || (tenue ? MUTED : INK) }}>
      <span>{a}</span><span style={{ whiteSpace: 'nowrap' }}>{signo}{b}</span>
    </div>
  )
}

// Cuenta de UNA cancha, en orden y sin vueltas: recogido → cuenta → efectivo → árbitro → alquiler → te queda
function CuentaCancha({ g }) {
  const entrega = g.teEntrega >= 0
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: '16px', marginBottom: '12px', overflow: 'hidden' }}>
      <div style={{ background: '#f8f9fa', padding: '12px 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: '900', fontSize: '1.02rem' }}>📍 {g.cancha}</div>
        <div style={{ fontSize: '.74rem', color: MUTED }}>
          {g.pitados} jugado{g.pitados === 1 ? '' : 's'}{g.ws ? ` · ${g.ws} W` : ''}{g.desiertos ? ` · ${g.desiertos} desierto` : ''}{g.sinTerminar ? ` · ⏳ ${g.sinTerminar} sin cerrar` : ''}
        </div>
      </div>
      <div style={{ padding: '10px 14px 14px' }}>
        <Fila a={`Arbitrajes (${g.equiposArbitraje} equipo${g.equiposArbitraje === 1 ? '' : 's'}${g.ws ? ', en W paga uno solo' : ''})`} b={pesos(g.arbitrajes)} tenue/>
        <Fila a="Tarjetas cobradas" b={pesos(g.tarjetas)} tenue/>
        <Fila a="Total recogido en la cancha" b={pesos(g.recogido)} fuerte/>
        <div style={{ height: 1, background: LINE, margin: '6px 0' }}/>
        <Fila a="📲 Ya está en tu cuenta (transferencias)" b={pesos(g.transferencia)} color={AZUL}/>
        <Fila a="💵 Efectivo que recogió el árbitro" b={pesos(g.efectivo)} fuerte color={g.efectivo < 0 ? ROJO : undefined}/>
        <Fila a="Le toca al árbitro (su pago)" b={pesos(g.leCorresponde)} tenue signo="−"/>
        <div style={{ margin: '6px 0', borderRadius: '12px', padding: '10px 12px', background: entrega ? '#e8f0fe' : '#fce8e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.8rem', fontWeight: '800', color: entrega ? AZUL : ROJO }}>{entrega ? '💵 El árbitro te entrega' : '💵 Tú le debes al árbitro'}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: entrega ? AZUL : ROJO }}>{pesos(Math.abs(g.teEntrega))}</span>
        </div>
        <div style={{ height: 1, background: LINE, margin: '6px 0' }}/>
        <Fila a="Alquiler de la cancha (lo que tú pagas)" b={pesos(g.alquiler)} tenue signo="−"/>
        <div style={{ marginTop: '8px', borderRadius: '12px', padding: '12px 14px', background: g.teQueda >= 0 ? '#e6f4ea' : '#fce8e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.86rem', fontWeight: '900', color: g.teQueda >= 0 ? '#0d652d' : ROJO }}>LO QUE TE QUEDA EN ESTA CANCHA</span>
          <span style={{ fontSize: '1.25rem', fontWeight: '900', color: g.teQueda >= 0 ? '#0d652d' : ROJO }}>{pesos(g.teQueda)}</span>
        </div>
        <div style={{ fontSize: '.68rem', color: MUTED, marginTop: '6px' }}>Lo que te queda = recogido − pago al árbitro − alquiler de la cancha.</div>

        {g.fotos.length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${LINE}` }}>
            <div style={{ fontSize: '.74rem', fontWeight: '800', color: AZUL, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>📲 Fotos de las transferencias de esta cancha ({g.fotos.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {g.fotos.map(f => (
                <div key={f.id} style={{ width: '92px' }}>
                  <FotoComprobante ruta={f.ruta} size={92}/>
                  <div style={{ fontSize: '.9rem', fontWeight: '900', marginTop: '4px' }}>{pesos(f.monto)}</div>
                  <div style={{ fontSize: '.66rem', color: MUTED, lineHeight: 1.3 }}>{f.partido.home?.name} vs {f.partido.away?.name}</div>
                  <div style={{ fontSize: '.66rem', color: MUTED }}>{hora(f.hora)}{f.por ? ` · ${f.por}` : ''}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '.68rem', color: MUTED, marginTop: '8px' }}>Toca una foto para verla grande.</div>
          </div>
        )}
      </div>
    </div>
  )
}

function CuadreBloque({ cuadre, modo }) {
  const t = cuadre.tot
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ background: '#fff', border: `2px solid ${t.teQueda >= 0 ? '#a8dab5' : '#f5b7b1'}`, borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
        <div style={{ fontSize: '.72rem', fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{modo === 'semana' ? 'En la semana' : 'En el día'}, después de pagar árbitros y canchas</div>
        <div style={{ fontSize: '2rem', fontWeight: '900', color: t.teQueda >= 0 ? '#0d652d' : ROJO, margin: '2px 0 10px' }}>{pesos(t.teQueda)} <span style={{ fontSize: '.8rem', fontWeight: '700', color: MUTED }}>te quedan</span></div>
        <Fila a="Recogido en todas las canchas" b={pesos(t.recogido)} tenue/>
        <Fila a="Pago a los árbitros" b={pesos(t.leCorresponde)} tenue signo="−"/>
        <Fila a="Alquiler de las canchas" b={pesos(t.alquiler)} tenue signo="−"/>
        <div style={{ height: 1, background: LINE, margin: '8px 0' }}/>
        <Fila a="📲 Ya está en tu cuenta" b={pesos(t.transferencia)} color={AZUL} fuerte/>
        <Fila a={t.teEntrega >= 0 ? '💵 Los árbitros te entregan en efectivo' : '💵 Tú les debes a los árbitros'} b={pesos(Math.abs(t.teEntrega))} fuerte color={t.teEntrega >= 0 ? AZUL : ROJO}/>
        {t.sinTerminar > 0 && <div style={{ fontSize: '.74rem', color: NARANJA, fontWeight: '700', marginTop: '8px' }}>⏳ Hay {t.sinTerminar} partido{t.sinTerminar === 1 ? '' : 's'} sin cerrar: el cuadre se completa cuando los cierren.</div>}
      </div>
      {cuadre.dias.map(d => (
        <div key={d.dia}>
          {modo === 'semana' && <div style={{ fontWeight: '900', fontSize: '.95rem', margin: '14px 0 8px', color: INK }}>{tituloDia(d.dia)}</div>}
          {d.r.canchas.map(g => <CuentaCancha key={d.dia + g.cancha} g={g}/>)}
        </div>
      ))}
    </div>
  )
}

export default function AdminCobrosCanchaPage() {
  const [sp] = useSearchParams()
  const [modo, setModo] = useState('dia') // dia | semana
  const [dia, setDia] = useState(/^\d{4}-\d{2}-\d{2}$/.test(sp.get('dia') || '') ? sp.get('dia') : diaBogota())
  const [cobros, setCobros] = useState([])
  const [partidos, setPartidos] = useState({})
  const [equipos, setEquipos] = useState({})
  const [torneos, setTorneos] = useState({})
  const [filtroTorneo, setFiltroTorneo] = useState('todos')
  const { user, rol } = useAuthStore()
  const [cuadre, setCuadre] = useState(null) // { dias: [{ dia, r, alquileres }], tot } | null mientras carga
    const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const desde = modo === 'semana' ? lunesDe(dia) : dia
  const hasta = modo === 'semana' ? sumarDias(lunesDe(dia), 6) : dia

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true); setError('')
      const { data, error: err } = await supabase.from('cobros_cancha').select('*')
        .eq('anulado', false).eq('tipo', 'transferencia').gte('cobrado_at', inicioDia(desde)).lt('cobrado_at', finDia(hasta)).order('cobrado_at', { ascending: true })
      if (!vivo) return
      if (err) {
        setError(/relation|does not exist|schema cache/i.test(err.message || '') ? 'Falta ejecutar migracion_cobros_cancha.sql en Supabase.' : 'No se pudieron cargar las transferencias. Intenta de nuevo.')
        setCobros([]); setCargando(false); return
      }
      const lista = data || []
      setCobros(lista)
      const mIds = [...new Set(lista.map(c => c.match_id))]
      const tIds = [...new Set(lista.map(c => c.tournament_id))]
      const [rm, rt] = await Promise.all([
        mIds.length ? supabase.from('matches').select('id, location, home_team_id, away_team_id, tournament_id').in('id', mIds) : { data: [] },
        tIds.length ? supabase.from('tournaments_publico').select('id, name').in('id', tIds) : { data: [] },
      ])
      const ms = {}; (rm.data || []).forEach(m => { ms[m.id] = m })
      const eIds = [...new Set((rm.data || []).flatMap(m => [m.home_team_id, m.away_team_id]).filter(Boolean))]
      const re = eIds.length ? await supabase.from('teams').select('id, name').in('id', eIds) : { data: [] }
      if (!vivo) return
      const es = {}; (re.data || []).forEach(e => { es[e.id] = e.name })
      const ts = {}; (rt.data || []).forEach(t => { ts[t.id] = t.name })
      setPartidos(ms); setEquipos(es); setTorneos(ts); setCargando(false)
    })()
    return () => { vivo = false }
  }, [desde, hasta])

  // Cuadre por día y cancha: partidos de los torneos que cobran en la cancha + sus cobros + precios de cancha
  useEffect(() => {
    let vivo = true
    ;(async () => {
      let qt = supabase.from('tournaments').select('id, name, finanzas_config, organizador_id')
      if (rol?.rol === 'organizador') qt = qt.eq('organizador_id', user?.id)
      const { data: ts } = await qt
      const torneosCobran = (ts || []).filter(t => t.finanzas_config?.cobro_en_cancha)
      if (!vivo) return
      if (!torneosCobran.length) { setCuadre({ dias: [], tot: null, sinTorneos: true }); return }
      const configs = {}; torneosCobran.forEach(t => { configs[t.id] = t.finanzas_config || {} })
      const tIds = torneosCobran.map(t => t.id)
      const { data: ms } = await supabase.from('matches')
        .select('id, tournament_id, location, cancha_id, home_team_id, away_team_id, status, tipo_resultado, home_score, away_score, played_at')
        .in('tournament_id', tIds).gte('played_at', inicioDia(desde)).lt('played_at', finDia(hasta)).order('played_at', { ascending: true })
      const partidos = ms || []
      const mIds = partidos.map(m => m.id)
      const eIds = [...new Set(partidos.flatMap(m => [m.home_team_id, m.away_team_id]).filter(Boolean))]
      const [rc, rcan, re] = await Promise.all([
        mIds.length ? supabase.from('cobros_cancha').select('*').in('match_id', mIds).eq('anulado', false) : { data: [] },
        supabase.from('canchas').select('id, nombre, tournament_id, precio_partido, precio_w').in('tournament_id', tIds),
        eIds.length ? supabase.from('teams').select('id, name').in('id', eIds) : { data: [] },
      ])
      if (!vivo) return
      const nom = {}; (re.data || []).forEach(e => { nom[e.id] = e.name })
      const canchas = rcan.data || []
      partidos.forEach(m => { m.home = { name: nom[m.home_team_id] }; m.away = { name: nom[m.away_team_id] } })
      // Alquiler de la cancha: igual que en Finanzas del torneo (precio propio de la cancha o el de por defecto del torneo)
      const alquilerDe = m => {
        if (m.status !== 'finished' || m.tipo_resultado === 'desierto') return 0
        const fc = configs[m.tournament_id] || {}
        const c = (m.cancha_id != null && m.cancha_id !== '' && canchas.find(x => String(x.id) === String(m.cancha_id)))
          || (m.location && canchas.find(x => x.tournament_id === m.tournament_id && x.nombre === m.location)) || null
        if (m.tipo_resultado === 'w') return Number(c && c.precio_w != null ? c.precio_w : fc.pago_cancha_w) || 0
        return Number(c && c.precio_partido != null ? c.precio_partido : fc.pago_cancha_partido) || 0
      }
      const porDia = {}
      partidos.forEach(m => { (porDia[diaBogota(m.played_at)] ||= []).push(m) })
      const dias = Object.keys(porDia).sort().map(dia => {
        const r = resumenCaja(porDia[dia], configs, rc.data || [])
        r.canchas.forEach(g => {
          g.alquiler = g.partidos.reduce((t, m) => t + alquilerDe(m), 0)
          g.teQueda = g.recogido - g.leCorresponde - g.alquiler
          g.teEntrega = g.efectivo - g.leCorresponde
        })
        return { dia, r }
      })
      const tot = { recogido: 0, transferencia: 0, efectivo: 0, leCorresponde: 0, alquiler: 0, teQueda: 0, teEntrega: 0, sinTerminar: 0 }
      dias.forEach(d => d.r.canchas.forEach(g => {
        tot.recogido += g.recogido; tot.transferencia += g.transferencia; tot.efectivo += g.efectivo; tot.leCorresponde += g.leCorresponde
        tot.alquiler += g.alquiler; tot.teQueda += g.teQueda; tot.teEntrega += g.teEntrega; tot.sinTerminar += g.sinTerminar
      }))
      setCuadre({ dias, tot })
    })()
    return () => { vivo = false }
  }, [desde, hasta, rol?.rol, user?.id])

  const visibles = useMemo(() => cobros.filter(c => filtroTorneo === 'todos' || c.tournament_id === filtroTorneo), [cobros, filtroTorneo])

  const tot = useMemo(() => visibles.reduce((t, c) => ({
    total: t.total + (Number(c.monto) || 0), n: t.n + 1, sinRev: t.sinRev + (c.revisado ? 0 : 1),
  }), { total: 0, n: 0, sinRev: 0 }), [visibles])

  const porCancha = useMemo(() => {
    const g = {}
    visibles.forEach(c => {
      const cancha = (partidos[c.match_id]?.location || '').trim() || 'Sin cancha'
      ;(g[cancha] ||= { cancha, items: [], total: 0 })
      g[cancha].items.push(c); g[cancha].total += Number(c.monto) || 0
    })
    return Object.values(g).sort((a, b) => a.cancha.localeCompare(b.cancha, 'es'))
  }, [visibles, partidos])

  async function marcarRevisado(c, valor) {
    const antes = cobros
    setCobros(prev => prev.map(x => x.id === c.id ? { ...x, revisado: valor } : x))
    const { error: err } = await supabase.from('cobros_cancha').update({ revisado: valor, revisado_at: valor ? new Date().toISOString() : null }).eq('id', c.id)
    if (err) { setCobros(antes); setError('No se pudo marcar como revisada. Intenta de nuevo.') }
  }

  const nombrePartido = id => { const m = partidos[id]; return m ? `${equipos[m.home_team_id] || '?'} vs ${equipos[m.away_team_id] || '?'}` : '' }
  const idsTorneos = [...new Set(cobros.map(c => c.tournament_id))]

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '16px 14px 60px', color: INK, WebkitTextSizeAdjust: '100%', textSizeAdjust: '100%' }}>
      <div style={{ fontSize: '1.35rem', fontWeight: '900' }}>💵 Cuadre de cancha</div>
      <div style={{ fontSize: '.84rem', color: MUTED, margin: '4px 0 14px', lineHeight: 1.4 }}>Cuánta plata se recogió en cada cancha, lo que ya está en tu cuenta, lo que te debe entregar el árbitro y lo que te queda.</div>

      {/* Día / semana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button onClick={() => setDia(sumarDias(dia, modo === 'semana' ? -7 : -1))} style={{ width: '46px', height: '46px', borderRadius: '12px', border: `1px solid ${LINE}`, background: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>‹</button>
        <div style={{ flex: '1 1 150px', textAlign: 'center', fontWeight: '900', fontSize: '1.05rem' }}>
          {modo === 'semana' ? `${fechaCorta(inicioDia(desde))} – ${fechaCorta(inicioDia(hasta))}` : tituloDia(dia)}
        </div>
        <button onClick={() => setDia(sumarDias(dia, modo === 'semana' ? 7 : 1))} disabled={hasta >= diaBogota()} style={{ width: '46px', height: '46px', borderRadius: '12px', border: `1px solid ${LINE}`, background: '#fff', fontSize: '1.2rem', cursor: 'pointer', opacity: hasta >= diaBogota() ? .35 : 1 }}>›</button>
        <input type="date" value={dia} max={diaBogota()} onChange={e => e.target.value && setDia(e.target.value)} style={{ height: '46px', borderRadius: '12px', border: `1px solid ${LINE}`, padding: '0 10px', fontSize: '.9rem' }}/>
        <div style={{ display: 'flex', gap: '4px', background: '#f1f3f4', borderRadius: '12px', padding: '4px' }}>
          {[['dia', 'Día'], ['semana', 'Semana']].map(([id, t]) => (
            <button key={id} onClick={() => setModo(id)} style={{ minHeight: '38px', padding: '0 14px', border: 'none', borderRadius: '9px', fontWeight: '800', fontSize: '.82rem', cursor: 'pointer', background: modo === id ? '#fff' : 'transparent', color: modo === id ? AZUL : MUTED, boxShadow: modo === id ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}>{t}</button>
          ))}
        </div>
      </div>

      {idsTorneos.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {idsTorneos.length > 1 && [['todos', 'Todos los torneos'], ...idsTorneos.map(id => [id, torneos[id] || 'Torneo'])].map(([id, t]) => (
            <button key={id} onClick={() => setFiltroTorneo(id)} style={{ minHeight: '38px', padding: '0 12px', borderRadius: '999px', border: `1px solid ${filtroTorneo === id ? AZUL : LINE}`, background: filtroTorneo === id ? '#e8f0fe' : '#fff', color: filtroTorneo === id ? AZUL : MUTED, fontWeight: '700', fontSize: '.78rem', cursor: 'pointer' }}>{t}</button>
          ))}
        </div>
      )}

      {error && <div style={{ background: '#fce8e6', color: '#b3261e', borderRadius: '10px', padding: '10px 12px', fontSize: '.84rem', fontWeight: '700', marginBottom: '12px' }}>{error}</div>}

      {!cuadre ? (
        <div style={{ textAlign: 'center', color: MUTED, padding: '24px 0' }}>Calculando el cuadre…</div>
      ) : cuadre.sinTorneos ? (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '14px', padding: '12px 14px', fontSize: '.84rem', color: '#7a5b00', marginBottom: '14px', lineHeight: 1.45 }}>
          Ningún torneo tiene activado <b>«Los árbitros cobran en la cancha»</b>. Actívalo en Torneos → tu torneo → Finanzas → configurar precios.
        </div>
      ) : cuadre.dias.length === 0 ? (
        <div style={{ textAlign: 'center', color: MUTED, padding: '24px 10px', background: '#f8f9fa', borderRadius: '14px', fontSize: '.9rem', marginBottom: '14px' }}>
          No hubo partidos {modo === 'semana' ? 'esta semana' : 'este día'} en torneos que cobran en la cancha.
        </div>
      ) : (
        <CuadreBloque cuadre={cuadre} modo={modo}/>
      )}

      <div style={{ fontSize: '1.05rem', fontWeight: '900', margin: '22px 0 8px' }}>📲 Transferencias recibidas</div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <Tarjeta titulo="📲 Total por transferencia" valor={pesos(tot.total)} sub={`${tot.n} transferencia${tot.n === 1 ? '' : 's'}${tot.sinRev ? ` · ${tot.sinRev} sin revisar` : tot.n ? ' · todas revisadas' : ''}`} color={AZUL} fondo="#f3f7fe" borde="#c6dafc"/>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', color: MUTED, padding: '40px 0' }}>Cargando…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', color: MUTED, padding: '40px 10px', background: '#f8f9fa', borderRadius: '14px', fontSize: '.9rem' }}>
          No hay transferencias {modo === 'semana' ? 'esta semana' : 'este día'}.
        </div>
      ) : (
        <>
          {porCancha.map(g => (
            <div key={g.cancha} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: '16px', marginBottom: '14px', overflow: 'hidden' }}>
              <div style={{ background: '#f8f9fa', padding: '12px 14px', display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: '900', fontSize: '1.02rem', flex: '1 1 120px' }}>📍 {g.cancha}</div>
                <div style={{ fontSize: '.8rem', color: MUTED }}>{g.items.length} transferencia{g.items.length === 1 ? '' : 's'}</div>
                <div style={{ fontWeight: '900', color: AZUL }}>{pesos(g.total)}</div>
              </div>
              {g.items.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', borderTop: `1px solid ${LINE}`, background: !c.revisado ? '#fffdf5' : '#fff' }}>
                  <FotoComprobante ruta={c.comprobante_path} size={72}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '800', fontSize: '.92rem' }}>{nombrePartido(c.match_id) || 'Partido'}</div>
                    <div style={{ fontSize: '.76rem', color: MUTED, marginTop: '2px' }}>
                      {modo === 'semana' ? `${fechaCorta(c.cobrado_at)} · ` : ''}{hora(c.cobrado_at)} · la recibió {c.cobrado_por_nombre || 'el árbitro'}{torneos[c.tournament_id] && idsTorneos.length > 1 ? ` · ${torneos[c.tournament_id]}` : ''}
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', minHeight: '40px', cursor: 'pointer', fontSize: '.82rem', fontWeight: '800', color: c.revisado ? VERDE : NARANJA }}>
                      <input type="checkbox" checked={!!c.revisado} onChange={e => marcarRevisado(c, e.target.checked)} style={{ width: 22, height: 22 }}/>
                      {c.revisado ? '✓ Revisada en el banco' : 'Marcar como revisada'}
                    </label>
                  </div>
                  <div style={{ fontWeight: '900', fontSize: '1.05rem', whiteSpace: 'nowrap' }}>{pesos(c.monto)}</div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
