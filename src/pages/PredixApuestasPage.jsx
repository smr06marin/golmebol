import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react'

const S = {
  navy:    '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border:  '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', goldDim: 'rgba(249,168,37,.1)',
  win: '#1e8e3e', winDim: 'rgba(30,142,62,.1)',
  loss: '#d93025', lossDim: 'rgba(217,48,37,.1)',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

// ── Reglas de liquidación de un cruce (puntos, no dinero real) ──
// - Si hay ganador claro (sin penales): el que acertó se queda con el 80%
//   de lo cruzado del que perdió (recupera además su propio monto cruzado,
//   por eso acá solo contamos la GANANCIA neta); el 20% restante es "casa".
// - Si el partido queda empatado: cada lado pierde el 20% de lo cruzado
//   (recupera el 80%).
// - Si el ganador se define por penales: el que acertó solo se queda con
//   el 50% de lo cruzado del que perdió.
// Lo que nunca se cruzó con nadie no entra a este cálculo: se devuelve
// completo, no gana ni pierde, porque nunca estuvo realmente en juego.
function resultadoReal(p) {
  if (!p || p.status !== 'finished' || p.home_score == null || p.away_score == null) return null
  if (p.home_score === p.away_score) {
    if (p.penales_ganador === 'home') return 'local'
    if (p.penales_ganador === 'away') return 'visitante'
    return 'empate'
  }
  return p.home_score > p.away_score ? 'local' : 'visitante'
}
function huboPenales(p) { return p && p.home_score === p.away_score && !!p.penales_ganador }

function calcularCruce(monto, equipoA, equipoB, partido) {
  const real = resultadoReal(partido)
  if (real === null) return { a: 0, b: 0 }
  if (real === 'empate') return { a: -0.2 * monto, b: -0.2 * monto }
  const factor = huboPenales(partido) ? 0.5 : 0.8
  const aGana = equipoA === real
  return aGana ? { a: factor * monto, b: -monto } : { a: -monto, b: factor * monto }
}

function puntosApuesta(apuesta, partido, cruces, apuestas) {
  if (!partido || partido.status !== 'finished') return { neto: 0, estado: 'pendiente' }
  const relacionados = cruces.filter(c => c.apuesta_a_id === apuesta.id || c.apuesta_b_id === apuesta.id)
  const sinCruzar = apuesta.monto - apuesta.monto_emparejado
  if (relacionados.length === 0) return { neto: 0, estado: sinCruzar > 0 ? 'sin_cruce' : 'sin_cruce' }
  let neto = 0
  relacionados.forEach(c => {
    const soyA = c.apuesta_a_id === apuesta.id
    const otraId = soyA ? c.apuesta_b_id : c.apuesta_a_id
    const otra = apuestas.find(a => a.id === otraId)
    if (!otra) return
    const r = calcularCruce(c.monto, soyA ? apuesta.equipo : otra.equipo, soyA ? otra.equipo : apuesta.equipo, partido)
    neto += soyA ? r.a : r.b
  })
  return { neto, estado: neto > 0 ? 'ganada' : neto < 0 ? 'perdida' : 'empate' }
}

function puedeApostar(p) {
  if (!p || p.status === 'finished') return false
  if (p.played_at && new Date(p.played_at) <= new Date()) return false
  return true
}

export default function PredixApuestasPage() {
  const navigate = useNavigate()
  const [user,         setUser]         = useState(null)
  const [nombre,        setNombre]       = useState('')
  const [homeUrl,       setHomeUrl]      = useState('/')
  const [loading,       setLoading]      = useState(true)
  const [partidos,      setPartidos]     = useState([])
  const [apuestas,      setApuestas]     = useState([])
  const [cruces,        setCruces]       = useState([])
  const [tab,           setTab]          = useState('partidos')
  const [torneoFiltro,  setTorneoFiltro] = useState(null)
  const [collapsed,     setCollapsed]    = useState({})
  const [modalApuesta,  setModalApuesta] = useState(null)
  const [formEquipo,    setFormEquipo]   = useState(null)
  const [formMonto,     setFormMonto]    = useState('')
  const [guardando,     setGuardando]    = useState(false)
  const [msg,           setMsg]          = useState(null)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { navigate('/jugador/login'); return }
    setUser(u)

    let nombreResuelto = u.email ? u.email.split('@')[0] : 'Usuario'
    let destino = '/'
    const { data: p } = await supabase.from('players').select('name, rol, es_arbitro, es_arbitro_lider').eq('user_id', u.id).maybeSingle()
    if (p?.name) nombreResuelto = p.name
    if (p?.es_arbitro_lider) destino = '/arbitro/lider'
    else if (p?.es_arbitro || p?.rol === 'arbitro') destino = '/arbitro'
    else if (p) destino = '/jugador'
    setNombre(nombreResuelto)
    setHomeUrl(destino)

    const [{ data: mData }, { data: apData }, { data: crData }] = await Promise.all([
      supabase.from('matches')
        .select('*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), tournaments(id,name,modalidad)')
        .order('played_at', { ascending: true }).limit(300),
      supabase.from('predix_apuestas').select('*').order('created_at', { ascending: true }),
      supabase.from('predix_cruces').select('*'),
    ])
    setPartidos(mData || [])
    setApuestas(apData || [])
    setCruces(crData || [])
    setLoading(false)
  }

  function abrirModal(partido, equipo) {
    setModalApuesta(partido)
    setFormEquipo(equipo || null)
    setFormMonto('')
    setMsg(null)
  }

  async function colocarApuesta() {
    const monto = parseFloat(formMonto)
    if (!monto || monto <= 0) { setMsg({ tipo: 'error', texto: 'Pon un número válido' }); return }
    if (!formEquipo) { setMsg({ tipo: 'error', texto: 'Elige un equipo' }); return }
    setGuardando(true)
    const equipoRival = formEquipo === 'local' ? 'visitante' : 'local'

    const { data: rivales } = await supabase.from('predix_apuestas')
      .select('*').eq('match_id', modalApuesta.id).eq('equipo', equipoRival).eq('estado', 'abierta')
      .order('created_at', { ascending: true })

    const { data: nueva, error } = await supabase.from('predix_apuestas')
      .insert({ match_id: modalApuesta.id, user_id: user.id, nombre, equipo: formEquipo, monto, monto_emparejado: 0, estado: 'abierta' })
      .select().single()
    if (error || !nueva) { setMsg({ tipo: 'error', texto: 'No se pudo registrar la apuesta' }); setGuardando(false); return }

    let restante = monto
    for (const riv of (rivales || [])) {
      if (restante <= 0) break
      const capacidad = riv.monto - riv.monto_emparejado
      if (capacidad <= 0) continue
      const cruce = Math.min(restante, capacidad)
      await supabase.from('predix_cruces').insert({ match_id: modalApuesta.id, apuesta_a_id: nueva.id, apuesta_b_id: riv.id, monto: cruce })
      const nuevoEmp = riv.monto_emparejado + cruce
      await supabase.from('predix_apuestas').update({ monto_emparejado: nuevoEmp, estado: nuevoEmp >= riv.monto ? 'cerrada' : 'abierta' }).eq('id', riv.id)
      restante -= cruce
    }
    const empPropio = monto - restante
    await supabase.from('predix_apuestas').update({ monto_emparejado: empPropio, estado: empPropio >= monto ? 'cerrada' : 'abierta' }).eq('id', nueva.id)

    setGuardando(false)
    setModalApuesta(null)
    setFormEquipo(null)
    setFormMonto('')
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.cyan, fontSize: '.9rem' }}>Cargando...</div>
  )

  const pendientes = partidos.filter(p => p.status !== 'finished')

  function groupByTournament(lista) {
    const groups = {}
    lista.forEach(p => {
      const tid = p.tournament_id
      if (!groups[tid]) groups[tid] = { torneo: p.tournaments, partidos: [] }
      groups[tid].partidos.push(p)
    })
    return Object.values(groups)
  }
  const gruposPendientes = groupByTournament(torneoFiltro ? pendientes.filter(p => p.tournament_id === torneoFiltro) : pendientes)
  const torneosUnicos    = [...new Map(pendientes.map(p => [p.tournament_id, p.tournaments])).values()]

  function toggleCollapse(tid) { setCollapsed(prev => ({ ...prev, [tid]: !prev[tid] })) }

  function resumenPartido(matchId) {
    const aps = apuestas.filter(a => a.match_id === matchId)
    const local = aps.filter(a => a.equipo === 'local')
    const visitante = aps.filter(a => a.equipo === 'visitante')
    return { local, visitante }
  }

  const misApuestas = apuestas.filter(a => a.user_id === user.id).slice().reverse()

  // Ranking global: puntos netos acumulados por usuario en partidos terminados
  const rankMap = {}
  apuestas.forEach(ap => {
    const partido = partidos.find(p => p.id === ap.match_id)
    if (!partido || partido.status !== 'finished') return
    const { neto } = puntosApuesta(ap, partido, cruces, apuestas)
    if (!rankMap[ap.user_id]) rankMap[ap.user_id] = { user_id: ap.user_id, nombre: ap.nombre, puntos: 0 }
    rankMap[ap.user_id].puntos += neto
    rankMap[ap.user_id].nombre = ap.nombre
  })
  const ranking = Object.values(rankMap).sort((a, b) => b.puntos - a.puntos)
  const misPuntos = ranking.find(r => r.user_id === user.id)?.puntos || 0
  const miPosicion = ranking.findIndex(r => r.user_id === user.id) + 1

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'system-ui,sans-serif', color: S.text, paddingBottom: '40px' }}>

      {/* Modal: colocar apuesta */}
      {modalApuesta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModalApuesta(null)}>
          <div style={{ background: S.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '20px', border: `0.5px solid ${S.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontWeight: '700', fontSize: '.95rem', color: S.text }}>{modalApuesta.home?.name} vs {modalApuesta.away?.name}</div>
              <button onClick={() => setModalApuesta(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ fontSize: '.72rem', color: S.muted, marginBottom: '18px' }}>{modalApuesta.tournaments?.name}</div>

            <div style={{ fontSize: '.8rem', fontWeight: '600', color: S.text, marginBottom: '10px' }}>¿A cuál equipo le pones?</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              {[{ val: 'local', label: modalApuesta.home?.name }, { val: 'visitante', label: modalApuesta.away?.name }].map(opt => (
                <div key={opt.val} onClick={() => setFormEquipo(opt.val)}
                  style={{ flex: 1, padding: '14px 10px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', border: `1px solid ${formEquipo === opt.val ? S.cyan : S.border}`, background: formEquipo === opt.val ? S.cyanDim : S.card }}>
                  <span style={{ fontWeight: '700', fontSize: '.85rem', color: formEquipo === opt.val ? S.cyan : S.text }}>{opt.label}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '.8rem', fontWeight: '600', color: S.text, marginBottom: '8px' }}>¿Cuántos puntos pones?</div>
            <input type="number" inputMode="numeric" value={formMonto} onChange={e => setFormMonto(e.target.value)} placeholder="Ej: 50"
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: '1.3rem', fontWeight: '700', textAlign: 'center', marginBottom: '10px', boxSizing: 'border-box' }}/>
            <div style={{ fontSize: '.68rem', color: S.muted, marginBottom: '16px' }}>
              Se cruza automáticamente contra lo que otros ya hayan puesto al equipo contrario. Lo que no se cruce con nadie queda abierto en la mesa.
            </div>

            {msg && <div style={{ fontSize: '.75rem', color: msg.tipo === 'error' ? S.loss : S.win, marginBottom: '10px' }}>{msg.texto}</div>}

            <button disabled={guardando} onClick={colocarApuesta}
              style={{ width: '100%', padding: '13px', background: S.cyan, border: 'none', borderRadius: '12px', cursor: guardando ? 'not-allowed' : 'pointer', color: '#000', fontWeight: '800', fontSize: '.9rem', opacity: guardando ? .7 : 1 }}>
              {guardando ? 'Registrando...' : 'CONFIRMAR APUESTA'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: S.surface, borderBottom: `0.5px solid ${S.border}`, padding: '16px 20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button onClick={() => navigate(homeUrl)} style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: S.muted, fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: '5px', width: 'fit-content' }}>← Inicio</button>
            <div style={{ fontSize: '.68rem', color: S.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>Predix · Apuestas 1x1</div>
            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: S.text }}>{nombre}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: misPuntos >= 0 ? S.gold : S.loss, lineHeight: 1 }}>{misPuntos > 0 ? '+' : ''}{Math.round(misPuntos * 10) / 10}</div>
            <div style={{ fontSize: '.65rem', color: S.muted }}>pts netos · #{miPosicion || '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 16px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 0', position: 'sticky', top: 0, background: S.navy, zIndex: 10 }}>
          {[{ id: 'partidos', label: 'Partidos' }, { id: 'mias', label: 'Mis apuestas' }, { id: 'ranking', label: 'Ranking' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '9px 4px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '.78rem', fontWeight: '700', transition: 'all .15s', background: tab === t.id ? S.cyan : S.card, color: tab === t.id ? '#000' : S.muted }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: Partidos */}
        {tab === 'partidos' && (
          <div>
            {torneosUnicos.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                {[{ id: null, name: 'Todos' }, ...torneosUnicos].map(t => (
                  <button key={t?.id || 'all'} onClick={() => setTorneoFiltro(t?.id || null)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '.75rem', whiteSpace: 'nowrap', background: torneoFiltro === (t?.id || null) ? S.cyan : S.card, color: torneoFiltro === (t?.id || null) ? '#000' : S.muted }}>
                    {t?.name || 'Todos'}
                  </button>
                ))}
              </div>
            )}
            {gruposPendientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: S.muted }}><div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎲</div><div>No hay partidos pendientes</div></div>
            ) : gruposPendientes.map(grupo => {
              const tid = grupo.torneo?.id, isCollapsed = collapsed[tid]
              return (
                <div key={tid} style={{ marginBottom: '16px', background: S.card, borderRadius: '16px', overflow: 'hidden', border: `0.5px solid ${S.border}` }}>
                  <div onClick={() => toggleCollapse(tid)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: S.card2, borderBottom: isCollapsed ? 'none' : `0.5px solid ${S.border}` }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,221,208,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trophy size={16} color={S.cyan}/></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '.9rem', color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grupo.torneo?.name || 'Torneo'}</div>
                      <div style={{ fontSize: '.68rem', color: S.muted, marginTop: '1px' }}>{grupo.torneo?.modalidad} · {grupo.partidos.length} partido{grupo.partidos.length !== 1 ? 's' : ''}</div>
                    </div>
                    {isCollapsed ? <ChevronDown size={18} color={S.muted}/> : <ChevronUp size={18} color={S.muted}/>}
                  </div>
                  {!isCollapsed && grupo.partidos.map((p, i) => {
                    const { local, visitante } = resumenPartido(p.id)
                    const abierto = puedeApostar(p)
                    const abiertoLocal = local.reduce((s, a) => s + (a.monto - a.monto_emparejado), 0)
                    const abiertoVisitante = visitante.reduce((s, a) => s + (a.monto - a.monto_emparejado), 0)
                    return (
                      <div key={p.id} style={{ borderTop: i > 0 ? `0.5px solid ${S.border}` : 'none', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          {p.matchday && <span style={{ fontSize: '.65rem', background: 'rgba(0,221,208,.1)', color: S.cyan, borderRadius: '10px', padding: '1px 7px', fontWeight: '600' }}>J{p.matchday}</span>}
                          {p.played_at && <span style={{ fontSize: '.68rem', color: S.muted }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })} {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {!abierto && <span style={{ fontSize: '.65rem', color: S.muted, background: S.card2, borderRadius: '10px', padding: '1px 7px' }}>Mesa cerrada</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[{ eq: 'local', team: p.home, abiertoLista: local, abiertoTotal: abiertoLocal }, { eq: 'visitante', team: p.away, abiertoLista: visitante, abiertoTotal: abiertoVisitante }].map(col => (
                            <div key={col.eq} style={{ flex: 1, background: S.navy, borderRadius: '10px', padding: '10px', border: `0.5px solid ${S.border}`, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: S.card2, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {col.team?.logo_url ? <img src={col.team.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <span style={{ fontSize: '.5rem', fontWeight: '800', color: '#fff' }}>{(col.team?.name || '?').substring(0, 2).toUpperCase()}</span>}
                                </div>
                                <span style={{ fontWeight: '700', fontSize: '.78rem', color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.team?.name}</span>
                              </div>
                              {col.abiertoLista.length === 0 ? (
                                <div style={{ fontSize: '.65rem', color: S.muted, marginBottom: '8px' }}>Sin apuestas aún</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px', maxHeight: '90px', overflowY: 'auto' }}>
                                  {col.abiertoLista.map(a => (
                                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem' }}>
                                      <span style={{ color: S.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70px' }}>{a.nombre}</span>
                                      <span style={{ color: a.estado === 'cerrada' ? S.win : S.gold, fontWeight: '700' }}>{a.monto}{a.estado !== 'cerrada' ? ` (${a.monto - a.monto_emparejado} libre)` : ' ✓'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {abierto && (
                                <button onClick={() => abrirModal(p, col.eq)} style={{ width: '100%', padding: '7px', background: S.cyanDim, border: `1px solid ${S.cyan}`, borderRadius: '8px', cursor: 'pointer', color: S.cyan, fontWeight: '700', fontSize: '.7rem' }}>
                                  + Apostar
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: Mis apuestas */}
        {tab === 'mias' && (
          <div>
            {misApuestas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: S.muted }}><div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎲</div><div>Aún no has apostado</div></div>
            ) : misApuestas.map(a => {
              const partido = partidos.find(p => p.id === a.match_id)
              const { neto, estado } = puntosApuesta(a, partido, cruces, apuestas)
              const sinCruzar = a.monto - a.monto_emparejado
              const colorEstado = estado === 'ganada' ? S.win : estado === 'perdida' ? S.loss : estado === 'empate' ? S.gold : S.muted
              const labelEstado = estado === 'ganada' ? '✅ Ganada' : estado === 'perdida' ? '❌ Perdida' : estado === 'empate' ? '🤝 Empate' : estado === 'sin_cruce' ? 'Sin cruzar' : 'Pendiente'
              return (
                <div key={a.id} style={{ background: S.card, borderRadius: '14px', padding: '14px 16px', marginBottom: '10px', border: `0.5px solid ${S.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '.72rem', color: S.muted }}>{partido?.tournaments?.name}</span>
                    <span style={{ fontSize: '.72rem', fontWeight: '800', color: colorEstado, background: `${colorEstado}22`, borderRadius: '10px', padding: '2px 10px' }}>
                      {labelEstado}{partido?.status === 'finished' && neto !== 0 ? ` · ${neto > 0 ? '+' : ''}${Math.round(neto * 10) / 10} pts` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '.85rem', fontWeight: '600', color: S.text, marginBottom: '4px' }}>{partido?.home?.name} vs {partido?.away?.name}</div>
                  <div style={{ fontSize: '.75rem', color: S.text2 }}>
                    Le pusiste <span style={{ color: S.cyan, fontWeight: '700' }}>{a.monto}</span> a <span style={{ fontWeight: '700' }}>{a.equipo === 'local' ? partido?.home?.name : partido?.away?.name}</span>
                    {a.monto_emparejado > 0 && <span> · cruzado: {a.monto_emparejado}</span>}
                    {sinCruzar > 0 && <span> · sin cruzar: {sinCruzar}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: Ranking */}
        {tab === 'ranking' && (
          <div>
            {ranking.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: S.muted }}><div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏆</div><div>Sin datos de ranking aún</div></div>
            ) : ranking.map((r, i) => {
              const esYo = r.user_id === user.id
              return (
                <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: esYo ? S.cyanDim : S.card, borderRadius: '12px', marginBottom: '8px', border: `0.5px solid ${esYo ? S.cyan : S.border}` }}>
                  <div style={{ width: '28px', fontWeight: '900', fontSize: '.9rem', textAlign: 'center', flexShrink: 0, color: i === 0 ? S.gold : i === 1 ? '#9aa0a6' : i === 2 ? '#cd7f32' : S.muted }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <span style={{ flex: 1, fontWeight: esYo ? '800' : '500', color: esYo ? S.cyan : S.text, fontSize: '.875rem' }}>
                    {r.nombre} {esYo && <span style={{ fontSize: '.68rem', color: S.muted }}>(tú)</span>}
                  </span>
                  <span style={{ fontWeight: '900', fontSize: '1.1rem', color: r.puntos >= 0 ? S.gold : S.loss }}>{r.puntos > 0 ? '+' : ''}{Math.round(r.puntos * 10) / 10}</span>
                  <span style={{ fontSize: '.65rem', color: S.muted }}>pts</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
