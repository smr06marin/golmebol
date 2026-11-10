import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { diaBogota, pesos } from '../../lib/cobrosCancha'
import { FotoComprobante } from '../../components/CobrosCancha'

// TRANSFERENCIAS DE CANCHA (para el dueño del torneo / administrador)
// Cada vez que a un árbitro le pagan por transferencia, toma la foto del comprobante y escribe el monto.
// Aquí queda el registro: por día y por cancha, con la foto, y se puede marcar «revisada» al compararla con el banco.
// Datos: tabla cobros_cancha (migracion_cobros_cancha.sql). El aviso al celular llega al instante con cada transferencia.

const AZUL = '#1a73e8'
const VERDE = '#188038'
const NARANJA = '#e8710a'
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

export default function AdminCobrosCanchaPage() {
  const [sp] = useSearchParams()
  const [modo, setModo] = useState('dia') // dia | semana
  const [dia, setDia] = useState(/^\d{4}-\d{2}-\d{2}$/.test(sp.get('dia') || '') ? sp.get('dia') : diaBogota())
  const [cobros, setCobros] = useState([])
  const [partidos, setPartidos] = useState({})
  const [equipos, setEquipos] = useState({})
  const [torneos, setTorneos] = useState({})
  const [filtroTorneo, setFiltroTorneo] = useState('todos')
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
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '16px 14px 60px', color: INK }}>
      <div style={{ fontSize: '1.35rem', fontWeight: '900' }}>📲 Transferencias de cancha</div>
      <div style={{ fontSize: '.84rem', color: MUTED, margin: '4px 0 14px', lineHeight: 1.4 }}>Cada pago por transferencia que recibieron los árbitros, con su foto, por día y por cancha.</div>

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
