import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Calendar, Check, Image, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import FlyerPartido from '../../components/FlyerPartido'
import PlanillaPartido from '../../components/PlanillaPartido'
import { recuperarPlanillaAbierta } from '../../lib/planillaRecovery'

function TeamLogo({ logo_url, name, size = 32 }) {
  if (logo_url) return <img src={logo_url} style={{ width: size, height: size, objectFit: 'contain' }}/>
  return <div style={{ width: size, height: size, background: '#e8f0fe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={size * 0.5} color="#1a73e8"/></div>
}

const FASE_LABEL = {
  grupo: 'Fase de Grupos', octavos: 'Octavos de Final', cuartos: 'Cuartos de Final',
  semifinal: 'Semifinales', tercero: 'Tercer Puesto', final: 'Final',
}

function agruparPorJornada(partidos) {
  const grupos = {}
  partidos.forEach(p => {
    // Clave de agrupación: fase especial primero, luego por jornada, luego por fecha
    let key, label, orden
    if (p.fase && p.fase !== 'grupo') {
      key = `fase_${p.fase}`
      label = FASE_LABEL[p.fase] || p.fase
      orden = { final: 99, tercero: 98, semifinal: 97, cuartos: 96, octavos: 95 }[p.fase] || 94
    } else if (p.matchday) {
      key = `jornada_${p.matchday}`
      label = `Jornada ${p.matchday}`
      orden = p.matchday
    } else {
      const fecha = p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sin fecha'
      key = `fecha_${fecha}`
      label = fecha
      orden = p.played_at ? new Date(p.played_at).getTime() / 1000000 : 0
    }
    if (!grupos[key]) {
      const fechas = []
      grupos[key] = { key, label, orden, partidos: [], fechas }
    }
    grupos[key].partidos.push(p)
    if (p.played_at) {
      const f = new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
      if (!grupos[key].fechas.includes(f)) grupos[key].fechas.push(f)
    }
  })
  return Object.values(grupos).sort((a, b) => a.orden - b.orden)
}

export default function AdminCalendarioPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [partidos,        setPartidos]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [filtro,          setFiltro]          = useState('todos')
  const [torneoFiltro,    setTorneoFiltro]    = useState('')
  const [torneos,         setTorneos]         = useState([])
  const [flyerPartido,    setFlyerPartido]    = useState(null)
  const [planillaPartido, setPlanillaPartido] = useState(null)
  const [abiertos,        setAbiertos]        = useState({})

  useEffect(() => { fetchTodo() }, [])
  // La planilla abierta queda marcada en la URL (?planilla=<id>): así, sin
  // importar qué haga el navegador al volver (recargar, matar la pestaña,
  // etc.), se reabre exactamente la misma planilla. Solo el botón "Salir"
  // (cerrarPlanilla) puede sacar de la planilla.
  useEffect(() => {
    const matchId = searchParams.get('planilla')
    if (matchId) {
      supabase.from('matches')
        .select('*, tournaments(id,name,modalidad), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
        .eq('id', matchId).single()
        .then(({ data }) => { if (data) setPlanillaPartido(data) })
    } else {
      recuperarPlanillaAbierta().then(p => { if (p) abrirPlanilla(p) })
    }
  }, [])

  function abrirPlanilla(p) {
    setPlanillaPartido(p)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('planilla', p.id); return n }, { replace: true })
  }
  function cerrarPlanilla() {
    setPlanillaPartido(null)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('planilla'); return n }, { replace: true })
    fetchTodo()
  }

  async function fetchTodo() {
    setLoading(true)
    const [{ data: pts }, { data: trs }] = await Promise.all([
      supabase.from('matches')
        .select('*, tournaments(id,name,modalidad), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
        .order('played_at', { ascending: true }),
      supabase.from('tournaments').select('id,name').eq('status', 'active'),
    ])
    setPartidos(pts || [])
    setTorneos(trs || [])
    setLoading(false)
  }

  function toggleAbierto(key) {
    setAbiertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filtrados = partidos
    .filter(p => filtro === 'todos' ? true : filtro === 'pendientes' ? p.status !== 'finished' : p.status === 'finished')
    .filter(p => torneoFiltro ? p.tournament_id === torneoFiltro : true)

  const jornadas = agruparPorJornada(filtrados)

  return (
    <div>
      {flyerPartido    && <FlyerPartido    partido={flyerPartido}    onClose={() => setFlyerPartido(null)}/>}
      {planillaPartido && <PlanillaPartido partido={planillaPartido} onClose={cerrarPlanilla}/>}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Calendario Global</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>Todos los partidos de todos los torneos</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '8px', padding: '3px' }}>
          {[{ id:'todos', label:'Todos' }, { id:'pendientes', label:'Pendientes' }, { id:'jugados', label:'Jugados' }].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', background: filtro===f.id?'#1a73e8':'transparent', color: filtro===f.id?'#fff':'#5f6368' }}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #dadce0', borderRadius: '8px', fontSize: '.875rem', color: '#202124', outline: 'none', background: '#fff' }}>
          <option value="">Todos los torneos</option>
          {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '.8rem', color: '#9aa0a6' }}>{filtrados.length} partido{filtrados.length!==1?'s':''}</div>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
      ) : jornadas.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
          <Calendar size={36} style={{ opacity:.3, marginBottom:'8px' }}/>
          <div style={{ fontSize: '.875rem' }}>No hay partidos</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {jornadas.map(jornada => {
            const isOpen    = !!abiertos[jornada.key]
            const jugados   = jornada.partidos.filter(p => p.status === 'finished').length
            const pendientes= jornada.partidos.length - jugados
            const esFase    = jornada.key.startsWith('fase_')
            const headerBg  = esFase ? 'linear-gradient(135deg,#1a73e8,#6c35de)' : '#fff'
            const headerColor = esFase ? '#fff' : '#202124'
            return (
              <div key={jornada.key} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                {/* Header acordeón */}
                <div onClick={() => toggleAbierto(jornada.key)}
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: headerBg, transition: 'background .15s' }}
                  onMouseEnter={e => !esFase && (e.currentTarget.style.background = '#f8f9fa')}
                  onMouseLeave={e => !esFase && (e.currentTarget.style.background = '#fff')}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '.95rem', color: headerColor }}>{jornada.label}</div>
                    <div style={{ fontSize: '.72rem', color: esFase ? 'rgba(255,255,255,.75)' : '#9aa0a6', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {jornada.fechas.length > 0 && <span>📅 {jornada.fechas.join(' · ')}</span>}
                      <span>{jornada.partidos.length} partido{jornada.partidos.length!==1?'s':''}</span>
                      {jugados > 0    && <span style={{ color: esFase?'rgba(255,255,255,.85)':'#1e8e3e' }}>✓ {jugados} jugado{jugados!==1?'s':''}</span>}
                      {pendientes > 0 && <span style={{ color: esFase?'rgba(255,255,255,.85)':'#e8710a' }}>⏳ {pendientes} pendiente{pendientes!==1?'s':''}</span>}
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp  size={18} color={esFase?'rgba(255,255,255,.8)':'#9aa0a6'}/>
                    : <ChevronDown size={18} color={esFase?'rgba(255,255,255,.8)':'#9aa0a6'}/>}
                </div>

                {/* Partidos desplegados */}
                {isOpen && (
                  <div>
                    {jornada.partidos.map((p, i) => {
                      const esJugado = p.status === 'finished'
                      return (
                        <div key={p.id} style={{ padding: '12px 18px', borderTop: '1px solid #f1f3f4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Fecha y hora */}
                            <div style={{ minWidth: '64px', flexShrink: 0 }}>
                              {p.played_at && (
                                <>
                                  <div style={{ fontSize: '.68rem', color: '#5f6368', fontWeight: '600' }}>
                                    {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                                  </div>
                                  <div style={{ fontSize: '.68rem', color: '#9aa0a6' }}>
                                    {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </>
                              )}
                              {p.location && <div style={{ fontSize: '.62rem', color: '#1a73e8', marginTop: '2px' }}>📍 {p.location}</div>}
                            </div>

                            {/* Partido */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name}</span>
                                <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                                  <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={26}/>
                                </div>
                              </div>
                              {esJugado ? (
                                <div style={{ fontWeight: '800', fontSize: '.92rem', color: '#202124', background: '#f1f3f4', padding: '3px 10px', borderRadius: '8px', flexShrink: 0, minWidth: '50px', textAlign: 'center' }}>
                                  {p.home_score} - {p.away_score}
                                </div>
                              ) : (
                                <div style={{ fontWeight: '700', fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', padding: '3px 9px', borderRadius: '8px', flexShrink: 0 }}>VS</div>
                              )}
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                                  <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={26}/>
                                </div>
                                <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Torneo + estado */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span style={{ fontSize: '.65rem', color: '#9aa0a6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.tournaments?.name}</span>
                              <span style={{ fontSize: '.65rem', fontWeight: '600', color: esJugado?'#1e8e3e':'#e8710a', background: esJugado?'#e6f4ea':'#fce8d9', borderRadius: '6px', padding: '1px 6px', flexShrink: 0 }}>
                                {esJugado ? '✓ Jugado' : '⏳ Pendiente'}
                              </span>
                            </div>

                            {/* Acciones */}
                            <div style={{ display: 'flex', gap: '5px', flexShrink: 0, flexWrap: 'wrap' }}>
                              <button onClick={() => setFlyerPartido(p)}
                                style={{ background: '#6c35de', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#fff', fontSize: '.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Image size={11}/> Flyer
                              </button>
                              <button onClick={() => abrirPlanilla(p)}
                                style={{ background: esJugado?'none':'#1a73e8', border: esJugado?'1px solid #dadce0':'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: esJugado?'#5f6368':'#fff', fontSize: '.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {esJugado ? '✏️ Editar' : <><Check size={11}/> Resultado</>}
                              </button>
                              <button onClick={() => navigate(`/admin/torneos/${p.tournament_id}`)}
                                style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', fontSize: '.7rem' }}>Ver torneo →</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
