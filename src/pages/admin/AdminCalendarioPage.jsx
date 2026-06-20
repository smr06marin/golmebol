import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Calendar, Shield, Image } from 'lucide-react'
import FlyerPartido from '../../components/FlyerPartido'

export default function AdminCalendarioPage() {
  const navigate = useNavigate()
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [torneoFiltro, setTorneoFiltro] = useState('')
  const [torneos, setTorneos] = useState([])
  const [flyerPartido, setFlyerPartido] = useState(null)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const [{ data: pts }, { data: trs }] = await Promise.all([
      supabase.from('matches')
        .select('*, tournaments(id,name), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
        .order('played_at', { ascending: true }),
      supabase.from('tournaments').select('id,name').eq('status', 'active'),
    ])
    setPartidos(pts || [])
    setTorneos(trs || [])
    setLoading(false)
  }

  const filtrados = partidos
    .filter(p => filtro === 'todos' ? true : filtro === 'pendientes' ? p.status !== 'played' : p.status === 'played')
    .filter(p => torneoFiltro ? p.tournament_id === torneoFiltro : true)

  const grupos = {}
  filtrados.forEach(p => {
    const fecha = p.played_at
      ? new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Sin fecha'
    if (!grupos[fecha]) grupos[fecha] = []
    grupos[fecha].push(p)
  })

  function formatHora(dt) {
    if (!dt) return ''
    return new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  }

  function formatFechaCorta(dt) {
    if (!dt) return ''
    return new Date(dt).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div>
      {flyerPartido && <FlyerPartido partido={flyerPartido} onClose={() => setFlyerPartido(null)}/>}

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
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
      ) : Object.keys(grupos).length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
          <Calendar size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
          <div style={{ fontSize: '.875rem' }}>No hay partidos</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {Object.entries(grupos).map(([fecha, ps]) => (
            <div key={fecha}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ height: '1px', background: '#e8eaed', flex: 1 }}/>
                <span style={{ fontSize: '.85rem', fontWeight: '600', color: '#5f6368', textTransform: 'capitalize', background: '#f4f6f8', padding: '4px 16px', borderRadius: '20px', border: '1px solid #e8eaed' }}>
                  {fecha}
                </span>
                <div style={{ height: '1px', background: '#e8eaed', flex: 1 }}/>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                {ps.map(p => (
                  <div key={p.id}
                    style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column' }}>

                    {/* Header */}
                    <div style={{ background: '#1a73e8', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {p.matchday && <span style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.8)', fontWeight: '500' }}>JORNADA {p.matchday}</span>}
                        <span style={{ fontSize: '.75rem', color: '#fff', fontWeight: '600', textTransform: 'capitalize' }}>
                          {formatFechaCorta(p.played_at)}
                        </span>
                      </div>
                      <span style={{ fontSize: '.75rem', color: '#fff', fontWeight: '700', background: 'rgba(255,255,255,.2)', borderRadius: '8px', padding: '3px 10px' }}>
                        {formatHora(p.played_at)}
                      </span>
                    </div>

                    {/* Cuerpo */}
                    <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#f1f3f4', border: '2px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={22} color="#9aa0a6"/>}
                        </div>
                        <span style={{ fontSize: '.75rem', fontWeight: '600', color: '#202124', textAlign: 'center', lineHeight: '1.2' }}>{p.home?.name}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {p.status === 'played' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#202124', lineHeight: 1 }}>{p.home_score}</span>
                            <span style={{ fontSize: '1rem', fontWeight: '600', color: '#9aa0a6' }}>-</span>
                            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#202124', lineHeight: 1 }}>{p.away_score}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '1rem', fontWeight: '800', color: '#1a73e8' }}>VS</span>
                        )}
                        <span style={{ fontSize: '.65rem', color: p.status === 'played' ? '#1e8e3e' : '#e8710a', fontWeight: '600', background: p.status === 'played' ? '#e6f4ea' : '#fce8d9', borderRadius: '8px', padding: '2px 8px' }}>
                          {p.status === 'played' ? 'Jugado' : 'Pendiente'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#f1f3f4', border: '2px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={22} color="#9aa0a6"/>}
                        </div>
                        <span style={{ fontSize: '.75rem', fontWeight: '600', color: '#202124', textAlign: 'center', lineHeight: '1.2' }}>{p.away?.name}</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ borderTop: '1px solid #f1f3f4', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {p.location && <span style={{ fontSize: '.72rem', color: '#5f6368' }}>📍 {p.location}</span>}
                        <span style={{ fontSize: '.7rem', color: '#9aa0a6' }}>{p.tournaments?.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setFlyerPartido(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#6c35de', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '500' }}>
                          <Image size={12}/> Flyer
                        </button>
                        <button onClick={() => navigate(`/admin/torneos/${p.tournament_id}`)}
                          style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#5f6368', fontSize: '.72rem' }}>
                          Ver torneo
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
