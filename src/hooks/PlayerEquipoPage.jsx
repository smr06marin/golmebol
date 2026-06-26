import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Shield, Trophy, Calendar } from 'lucide-react'

export default function PlayerEquipoPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [equipo,    setEquipo]    = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [partidos,  setPartidos]  = useState([])
  const [torneos,   setTorneos]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('info')

  useEffect(() => { fetchTodo() }, [id])

  async function fetchTodo() {
    setLoading(true)
    const [{ data: eq }, { data: jugs }, { data: parts }, { data: torns }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', id).single(),
      supabase.from('tournament_player_registrations')
        .select('*, players(*)')
        .eq('team_id', id)
        .eq('activo', true),
      supabase.from('matches')
        .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name)')
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .order('played_at', { ascending: false }),
      supabase.from('tournament_teams')
        .select('*, tournaments(*)')
        .eq('team_id', id),
    ])
    setEquipo(eq)
    setJugadores(jugs || [])
    setPartidos(parts || [])
    setTorneos(torns || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#1a73e8', fontSize: '.9rem', fontWeight: '500' }}>Cargando...</div>
    </div>
  )

  if (!equipo) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6' }}>
      Equipo no encontrado
    </div>
  )

  const partidosJugados    = partidos.filter(p => p.status === 'finished')
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')

  // Stats del equipo
  let pg = 0, pe = 0, pp = 0, gf = 0, gc = 0
  partidosJugados.forEach(p => {
    const esLocal = p.home_team_id === id
    const gfP = esLocal ? (p.home_score || 0) : (p.away_score || 0)
    const gcP = esLocal ? (p.away_score || 0) : (p.home_score || 0)
    gf += gfP; gc += gcP
    if (gfP > gcP) pg++
    else if (gfP === gcP) pe++
    else pp++
  })
  const pts = pg * 3 + pe

  const TABS = [
    { id: 'info',      label: 'Info',      icon: <Shield size={14}/> },
    { id: 'jugadores', label: 'Jugadores', icon: '👥' },
    { id: 'partidos',  label: 'Partidos',  icon: <Calendar size={14}/> },
  ]

  const posicionColor = (pos) => {
    if (!pos) return '#9aa0a6'
    if (pos === 'Portero') return '#1a73e8'
    if (pos.includes('Defensa') || pos.includes('Lateral') || pos.includes('Cierre')) return '#1e8e3e'
    if (pos.includes('Medio') || pos.includes('Pivot') || pos.includes('Ala')) return '#e8710a'
    return '#6c35de'
  }

  const posicionLabel = (j) => {
    return j.posicion_futbol5 || j.posicion_futbol7 || j.posicion_futbol11 || ''
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* Header con gradiente */}
      <div style={{ background: 'linear-gradient(135deg, #1a237e 0%, #1a73e8 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .06, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}/>
        <div style={{ position: 'relative', zIndex: 1, padding: '12px 16px' }}>
          <button onClick={() => navigate(-1)}
            style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.8rem', marginBottom: '16px' }}>
            <ArrowLeft size={16}/> Volver
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '16px', background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {equipo.logo_url
                ? <img src={equipo.logo_url} alt={equipo.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}/>
                : <Shield size={36} color="#fff"/>}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#fff', lineHeight: 1.2 }}>{equipo.name}</h1>
              {equipo.city && <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.7)', marginTop: '4px' }}>📍 {equipo.city}</div>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.72rem', background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: '20px', padding: '2px 10px' }}>
                  {jugadores.length} jugadores
                </span>
                <span style={{ fontSize: '.72rem', background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: '20px', padding: '2px 10px' }}>
                  {torneos.length} torneo{torneos.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Stats rápidas */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            {[
              { label: 'PJ',  value: partidosJugados.length, color: '#fff' },
              { label: 'PG',  value: pg,   color: '#a5f3fc' },
              { label: 'PE',  value: pe,   color: '#fde68a' },
              { label: 'PP',  value: pp,   color: '#fca5a5' },
              { label: 'GF',  value: gf,   color: '#fff' },
              { label: 'GC',  value: gc,   color: '#fff' },
              { label: 'PTS', value: pts,  color: '#fde68a' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.12)', borderRadius: '8px', padding: '6px 12px', textAlign: 'center', minWidth: '44px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '.6rem', color: 'rgba(255,255,255,.65)', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', padding: '0 16px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: tab === t.id ? '600' : '400', color: tab === t.id ? '#1a73e8' : '#5f6368', borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all .15s', whiteSpace: 'nowrap' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>

        {/* INFO */}
        {tab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Torneos */}
            {torneos.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={16} color="#1a73e8"/> Torneos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {torneos.map(t => (
                    <div key={t.id} onClick={() => navigate(`/jugador/torneo/${t.tournament_id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: '#f8f9fa', cursor: 'pointer', border: '1px solid #e8eaed' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {t.tournaments?.logo_url
                          ? <img src={t.tournaments.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/>
                          : <Trophy size={16} color="#1a73e8"/>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem' }}>{t.tournaments?.name}</div>
                        <div style={{ fontSize: '.7rem', color: '#9aa0a6' }}>{t.tournaments?.modalidad} · {t.tournaments?.season}</div>
                      </div>
                      <span style={{ fontSize: '.75rem', color: '#1a73e8' }}>→</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Datos del equipo */}
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '12px' }}>📊 Estadísticas globales</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Partidos jugados', value: partidosJugados.length, color: '#1a73e8' },
                  { label: 'Victorias',         value: pg,   color: '#1e8e3e' },
                  { label: 'Empates',           value: pe,   color: '#e8710a' },
                  { label: 'Derrotas',          value: pp,   color: '#d93025' },
                  { label: 'Goles a favor',     value: gf,   color: '#1a73e8' },
                  { label: 'Goles en contra',   value: gc,   color: '#5f6368' },
                  { label: 'Puntos totales',    value: pts,  color: '#6c35de' },
                  { label: 'Jugadores activos', value: jugadores.length, color: '#1a73e8' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '3px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* JUGADORES */}
        {tab === 'jugadores' && (
          <div>
            {jugadores.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '.875rem' }}>Sin jugadores registrados</div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                {jugadores.map((j, i) => {
                  const p   = j.players
                  const pos = posicionLabel(p)
                  return (
                    <div key={j.id} style={{ padding: '12px 16px', borderBottom: i < jugadores.length - 1 ? '1px solid #f1f3f4' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f1f3f4', border: '2px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {p?.photo_face_url
                          ? <img src={p.photo_face_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          : p?.photo_url
                          ? <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
                          : <span style={{ fontSize: '1.2rem' }}>👤</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p?.name}</div>
                        {p?.city && <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>📍 {p.city}</div>}
                      </div>
                      {pos && (
                        <span style={{ fontSize: '.68rem', fontWeight: '600', color: posicionColor(pos), background: `${posicionColor(pos)}18`, borderRadius: '20px', padding: '2px 9px', flexShrink: 0 }}>
                          {pos}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* PARTIDOS */}
        {tab === 'partidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {partidosPendientes.length > 0 && (
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e8710a', display: 'inline-block' }}/> Próximos
                </div>
                <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  {partidosPendientes.map((p, i) => (
                    <div key={p.id} style={{ padding: '12px 16px', borderBottom: i < partidosPendientes.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                      {p.played_at && (
                        <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginBottom: '8px' }}>
                          📅 {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })} · {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          {p.location && <span> · 📍 {p.location}</span>}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '.85rem', fontWeight: p.home_team_id === id ? '700' : '500', color: '#202124', textAlign: 'right' }}>{p.home?.name}</span>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
                          </div>
                        </div>
                        <div style={{ fontSize: '.72rem', fontWeight: '600', color: '#5f6368', padding: '4px 10px', background: '#f1f3f4', borderRadius: '6px', flexShrink: 0 }}>VS</div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
                          </div>
                          <span style={{ fontSize: '.85rem', fontWeight: p.away_team_id === id ? '700' : '500', color: '#202124' }}>{p.away?.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {partidosJugados.length > 0 && (
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1e8e3e', display: 'inline-block' }}/> Resultados
                </div>
                <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  {partidosJugados.map((p, i) => {
                    const esLocal = p.home_team_id === id
                    const gfP    = esLocal ? (p.home_score || 0) : (p.away_score || 0)
                    const gcP    = esLocal ? (p.away_score || 0) : (p.home_score || 0)
                    const res    = gfP > gcP ? 'G' : gfP === gcP ? 'E' : 'P'
                    const resC   = res === 'G' ? '#1e8e3e' : res === 'E' ? '#e8710a' : '#d93025'
                    const resBg  = res === 'G' ? '#e6f4ea'  : res === 'E' ? '#fce8d9'  : '#fce8e6'
                    return (
                      <div key={p.id} style={{ padding: '12px 16px', borderBottom: i < partidosJugados.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '.65rem', fontWeight: '700', color: resC, background: resBg, borderRadius: '4px', padding: '1px 7px' }}>{res}</span>
                          {p.matchday && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '1px 7px' }}>J{p.matchday}</span>}
                          {p.played_at && <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>}
                          {p.tournaments?.name && <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>· {p.tournaments.name}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '.85rem', fontWeight: p.home_team_id === id ? '700' : '500', color: '#202124', textAlign: 'right' }}>{p.home?.name}</span>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={11} color="#9aa0a6"/>}
                            </div>
                          </div>
                          <div style={{ fontWeight: '700', fontSize: '1rem', color: '#202124', padding: '4px 12px', background: '#f1f3f4', borderRadius: '8px', flexShrink: 0 }}>
                            {p.home_score} - {p.away_score}
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={11} color="#9aa0a6"/>}
                            </div>
                            <span style={{ fontSize: '.85rem', fontWeight: p.away_team_id === id ? '700' : '500', color: '#202124' }}>{p.away?.name}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {partidos.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                <div style={{ fontSize: '.875rem' }}>Sin partidos aún</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
