import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Calendar, Clock, Check, Image, Shield, X } from 'lucide-react'
import FlyerPartido from '../../components/FlyerPartido'
import PlanillaPartido from '../../components/PlanillaPartido'

function TeamLogo({ logo_url, name, size = 32 }) {
  if (logo_url) return <img src={logo_url} style={{ width: size, height: size, objectFit: 'contain' }}/>
  return (
    <div style={{ width: size, height: size, background: '#e8f0fe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Shield size={size * 0.5} color="#1a73e8"/>
    </div>
  )
}

const FASE_LABEL = {
  grupo: 'Grupo', octavos: 'Octavos', cuartos: 'Cuartos',
  semifinal: 'Semifinal', tercero: '3er Puesto', final: 'Final',
}

export default function AdminCalendarioPage() {
  const navigate  = useNavigate()
  const [partidos,      setPartidos]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filtro,        setFiltro]        = useState('todos')
  const [torneoFiltro,  setTorneoFiltro]  = useState('')
  const [torneos,       setTorneos]       = useState([])
  const [flyerPartido,  setFlyerPartido]  = useState(null)
  const [planillaPartido, setPlanillaPartido] = useState(null)

  useEffect(() => { fetchTodo() }, [])

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

  const filtrados = partidos
    .filter(p => filtro === 'todos' ? true : filtro === 'pendientes' ? p.status !== 'finished' : p.status === 'finished')
    .filter(p => torneoFiltro ? p.tournament_id === torneoFiltro : true)

  // Agrupar por fecha
  const grupos = {}
  filtrados.forEach(p => {
    const fecha = p.played_at
      ? new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Sin fecha'
    if (!grupos[fecha]) grupos[fecha] = []
    grupos[fecha].push(p)
  })

  return (
    <div>
      {flyerPartido    && <FlyerPartido    partido={flyerPartido}    onClose={() => setFlyerPartido(null)}/>}
      {planillaPartido && <PlanillaPartido partido={planillaPartido} onClose={() => { setPlanillaPartido(null); fetchTodo() }}/>}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Calendario Global</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>Todos los partidos de todos los torneos</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '8px', padding: '3px' }}>
          {[{ id: 'todos', label: 'Todos' }, { id: 'pendientes', label: 'Pendientes' }, { id: 'jugados', label: 'Jugados' }].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', background: filtro === f.id ? '#1a73e8' : 'transparent', color: filtro === f.id ? '#fff' : '#5f6368' }}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #dadce0', borderRadius: '8px', fontSize: '.875rem', color: '#202124', outline: 'none', background: '#fff' }}>
          <option value="">Todos los torneos</option>
          {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '.8rem', color: '#9aa0a6' }}>{filtrados.length} partido{filtrados.length !== 1 ? 's' : ''}</div>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
      ) : Object.keys(grupos).length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
          <Calendar size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
          <div style={{ fontSize: '.875rem' }}>No hay partidos</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(grupos).map(([fecha, ps]) => (
            <div key={fecha}>
              {/* Separador de fecha */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ height: '1px', background: '#e8eaed', flex: 1 }}/>
                <span style={{ fontSize: '.82rem', fontWeight: '600', color: '#5f6368', textTransform: 'capitalize', background: '#f4f6f8', padding: '4px 16px', borderRadius: '20px', border: '1px solid #e8eaed' }}>
                  📅 {fecha}
                </span>
                <div style={{ height: '1px', background: '#e8eaed', flex: 1 }}/>
              </div>

              {/* Lista de partidos */}
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                {ps.map((p, i) => {
                  const esJugado = p.status === 'finished'
                  return (
                    <div key={p.id} style={{ padding: '12px 20px', borderBottom: i < ps.length - 1 ? '1px solid #f1f3f4' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>

                      {/* Badges izquierda */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '80px', flexShrink: 0 }}>
                        {p.matchday && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '1px 7px', fontWeight: '600', textAlign: 'center' }}>J{p.matchday}</span>}
                        {p.grupo    && <span style={{ fontSize: '.68rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '10px', padding: '1px 7px', textAlign: 'center' }}>{p.grupo}</span>}
                        {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.68rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '1px 7px', fontWeight: '700', textAlign: 'center' }}>{FASE_LABEL[p.fase]}</span>}
                        {p.played_at && <span style={{ fontSize: '.65rem', color: '#9aa0a6', textAlign: 'center' }}>{new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>

                      {/* Partido */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', textAlign: 'right' }}>{p.home?.name}</span>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                            <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={32}/>
                          </div>
                        </div>

                        {esJugado ? (
                          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#202124', background: '#f1f3f4', padding: '5px 16px', borderRadius: '8px', flexShrink: 0, minWidth: '64px', textAlign: 'center' }}>
                            {p.home_score} - {p.away_score}
                          </div>
                        ) : (
                          <div style={{ fontWeight: '700', fontSize: '.85rem', color: '#1a73e8', background: '#e8f0fe', padding: '5px 14px', borderRadius: '8px', flexShrink: 0 }}>VS</div>
                        )}

                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                            <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={32}/>
                          </div>
                          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.away?.name}</span>
                        </div>
                      </div>

                      {/* Info derecha */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '100px', flexShrink: 0 }}>
                        <span style={{ fontSize: '.68rem', color: '#9aa0a6', fontWeight: '500' }}>{p.tournaments?.name}</span>
                        {p.location && <span style={{ fontSize: '.68rem', color: '#5f6368' }}>📍 {p.location}</span>}
                        <span style={{ fontSize: '.65rem', fontWeight: '600', color: esJugado ? '#1e8e3e' : '#e8710a', background: esJugado ? '#e6f4ea' : '#fce8d9', borderRadius: '6px', padding: '1px 6px', textAlign: 'center' }}>
                          {esJugado ? '✓ Jugado' : '⏳ Pendiente'}
                        </span>
                      </div>

                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => setFlyerPartido(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#6c35de', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '500' }}>
                          <Image size={12}/> Flyer
                        </button>
                        <button onClick={() => setPlanillaPartido(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: esJugado ? 'none' : '#1a73e8', border: esJugado ? '1px solid #dadce0' : 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: esJugado ? '#5f6368' : '#fff', fontSize: '.72rem', fontWeight: '500' }}>
                          {esJugado ? '✏️ Editar' : <><Check size={12}/> Resultado</>}
                        </button>
                        <button onClick={() => navigate(`/admin/torneos/${p.tournament_id}`)}
                          style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', fontSize: '.72rem' }}>
                          →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
