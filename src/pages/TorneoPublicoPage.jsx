import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Trophy, MapPin, Calendar, Star } from 'lucide-react'

function TeamLogo({ logo_url, name, size = 28 }) {
  const iniciales = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (logo_url) return <img src={logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: size * 0.32 + 'px', fontWeight: '800', color: '#fff', fontFamily: 'system-ui' }}>{iniciales}</span>
    </div>
  )
}

const FASE_LABEL = { grupo: 'Grupo', octavos: 'Octavos', cuartos: 'Cuartos de final', semifinal: 'Semifinal', final: 'Final' }

export default function TorneoPublicoPage() {
  const { id } = useParams()

  const [torneo,    setTorneo]    = useState(null)
  const [equipos,   setEquipos]   = useState([])
  const [partidos,  setPartidos]  = useState([])
  const [goleadores, setGoleadores] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('posiciones')

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const [{ data: t }, { data: teData }, { data: pData }, { data: gData }] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('tournament_teams').select('*, teams(*)').eq('tournament_id', id),
        supabase.from('matches').select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)').eq('tournament_id', id).order('played_at', { ascending: true }),
        supabase.from('goleadores_por_torneo').select('*').eq('tournament_id', id).order('total_goals', { ascending: false }).limit(10),
      ])
      setTorneo(t)
      setEquipos((teData || []).map(d => ({ ...d.teams })))
      setPartidos(pData || [])
      setGoleadores(gData || [])
      setLoading(false)
    }
    fetchAll()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ddd0', fontFamily: 'system-ui', fontSize: '1rem', letterSpacing: '.1em' }}>
      Cargando...
    </div>
  )

  if (!torneo) return (
    <div style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6', fontFamily: 'system-ui' }}>
      Torneo no encontrado
    </div>
  )

  const partidosJugados    = partidos.filter(p => p.status === 'finished').slice().reverse()
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')

  // Tabla de posiciones
  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidos.filter(p => p.status === 'finished' && (!p.fase || p.fase === 'grupo')).forEach(p => {
    if (tabla[p.home_team_id]) {
      tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score || 0; tabla[p.home_team_id].gc += p.away_score || 0
      if (p.home_score > p.away_score) { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += 3 }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += 1 }
      else tabla[p.home_team_id].pp++
    }
    if (tabla[p.away_team_id]) {
      tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score || 0; tabla[p.away_team_id].gc += p.home_score || 0
      if (p.away_score > p.home_score) { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += 3 }
      else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += 1 }
      else tabla[p.away_team_id].pp++
    }
  })
  const tablaOrdenada = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))

  const tabs = [
    { id: 'posiciones', label: 'Posiciones' },
    { id: 'resultados', label: 'Resultados' },
    { id: 'proximos',   label: 'Próximos' },
    { id: 'goleadores', label: 'Goleadores' },
  ]

  const s = {
    page: { minHeight: '100vh', background: '#f4f6fb', fontFamily: 'system-ui, sans-serif' },
    header: {
      background: 'linear-gradient(135deg, #1a237e 0%, #1a73e8 60%, #00bcd4 100%)',
      padding: '0',
      position: 'relative',
      overflow: 'hidden',
    },
    headerInner: { maxWidth: '720px', margin: '0 auto', padding: '32px 20px 24px', position: 'relative', zIndex: 1 },
    body: { maxWidth: '720px', margin: '0 auto', padding: '24px 16px' },
    tabBar: { display: 'flex', gap: '4px', marginBottom: '20px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '4px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflowX: 'auto' },
    card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: '16px' },
    cardTitle: { padding: '14px 18px', fontWeight: '700', fontSize: '.85rem', color: '#3c4043', borderBottom: '1px solid #f1f3f4', background: '#fafbfc', letterSpacing: '.04em', textTransform: 'uppercase' },
  }

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={{ position: 'absolute', inset: 0, opacity: .07, backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div style={s.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '16px', background: 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {torneo.logo_url
                ? <img src={torneo.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                : <Trophy size={36} color="#fff"/>}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#fff', lineHeight: 1.2 }}>{torneo.name}</h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {torneo.modalidad && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: '20px', padding: '3px 12px', fontWeight: '600' }}>{torneo.modalidad}</span>}
                {torneo.genero    && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: '20px', padding: '3px 12px' }}>{torneo.genero}</span>}
                {torneo.categoria && <span style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: '20px', padding: '3px 12px' }}>{torneo.categoria}</span>}
                {torneo.city      && <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12}/>{torneo.city}</span>}
                {torneo.season    && <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12}/>{torneo.season}</span>}
              </div>
            </div>
          </div>

          {/* Stats rápidas */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Equipos',  val: equipos.length,        color: '#fff' },
              { label: 'Partidos', val: partidos.length,        color: '#fff' },
              { label: 'Jugados',  val: partidosJugados.length, color: '#a5f3fc' },
              { label: 'Próximos', val: partidosPendientes.length, color: '#fde68a' },
            ].map(st => (
              <div key={st.label} style={{ background: 'rgba(255,255,255,.12)', borderRadius: '10px', padding: '8px 16px', textAlign: 'center', minWidth: '70px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: st.color, lineHeight: 1 }}>{st.val}</div>
                <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.75)', marginTop: '2px' }}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={s.body}>
        {/* Tab bar */}
        <div style={s.tabBar}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: '1 1 auto', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: '600', whiteSpace: 'nowrap', transition: 'all .15s', background: tab === t.id ? '#1a73e8' : 'transparent', color: tab === t.id ? '#fff' : '#5f6368' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* POSICIONES */}
        {tab === 'posiciones' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Tabla de posiciones</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '10px 8px 10px 16px', textAlign: 'left', color: '#5f6368', fontWeight: '600', whiteSpace: 'nowrap' }}>#</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#5f6368', fontWeight: '600' }}>Equipo</th>
                    {['PJ','PG','PE','PP','GF','GC','DIF','PTS'].map(h => (
                      <th key={h} style={{ padding: '10px 8px', textAlign: 'center', color: h === 'PTS' ? '#1a73e8' : '#5f6368', fontWeight: '600', minWidth: '34px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablaOrdenada.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6' }}>Sin resultados aún</td></tr>
                  ) : tablaOrdenada.map((row, i) => (
                    <tr key={row.equipo.id} style={{ borderTop: '1px solid #f1f3f4', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ padding: '11px 8px 11px 16px', fontWeight: '700', color: i < 3 ? '#1a73e8' : '#9aa0a6', fontSize: '.8rem' }}>{i + 1}</td>
                      <td style={{ padding: '11px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                            <TeamLogo logo_url={row.equipo.logo_url} name={row.equipo.name} size={26}/>
                          </div>
                          <span style={{ fontWeight: '600', color: '#202124', whiteSpace: 'nowrap' }}>{row.equipo.name}</span>
                        </div>
                      </td>
                      {[row.pj, row.pg, row.pe, row.pp, row.gf, row.gc].map((v, j) => (
                        <td key={j} style={{ padding: '11px 8px', textAlign: 'center', color: '#5f6368' }}>{v}</td>
                      ))}
                      <td style={{ padding: '11px 8px', textAlign: 'center', color: (row.gf - row.gc) > 0 ? '#1e8e3e' : (row.gf - row.gc) < 0 ? '#d93025' : '#5f6368', fontWeight: '600' }}>
                        {(row.gf - row.gc) > 0 ? '+' : ''}{row.gf - row.gc}
                      </td>
                      <td style={{ padding: '11px 16px 11px 8px', textAlign: 'center', fontWeight: '800', color: '#1a73e8', fontSize: '.95rem' }}>{row.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTADOS */}
        {tab === 'resultados' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Resultados</div>
            {partidosJugados.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>No hay resultados aún</div>
            ) : partidosJugados.map((p, i) => {
              const homeWin = p.home_score > p.away_score
              const awayWin = p.away_score > p.home_score
              return (
                <div key={p.id} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {p.matchday && <span style={{ fontSize: '.7rem', background: '#e8f0fe', color: '#1a73e8', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>J{p.matchday}</span>}
                    {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.7rem', background: '#fce8d9', color: '#e8710a', borderRadius: '10px', padding: '2px 8px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                    {p.played_at && <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>{new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                    {p.location && <span style={{ fontSize: '.72rem', color: '#9aa0a6', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10}/>{p.location}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <span style={{ fontWeight: homeWin ? '800' : '500', color: homeWin ? '#202124' : '#5f6368', fontSize: '.9rem', textAlign: 'right' }}>{p.home?.name}</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                        <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={28}/>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f3f4', borderRadius: '10px', padding: '6px 14px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', fontSize: '1.15rem', color: homeWin ? '#1a73e8' : '#202124', minWidth: '20px', textAlign: 'center' }}>{p.home_score}</span>
                      <span style={{ color: '#9aa0a6', fontSize: '.85rem', fontWeight: '400' }}>-</span>
                      <span style={{ fontWeight: '800', fontSize: '1.15rem', color: awayWin ? '#1a73e8' : '#202124', minWidth: '20px', textAlign: 'center' }}>{p.away_score}</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                        <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={28}/>
                      </div>
                      <span style={{ fontWeight: awayWin ? '800' : '500', color: awayWin ? '#202124' : '#5f6368', fontSize: '.9rem' }}>{p.away?.name}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* PRÓXIMOS */}
        {tab === 'proximos' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Próximos partidos</div>
            {partidosPendientes.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>No hay partidos programados</div>
            ) : partidosPendientes.map((p, i) => (
              <div key={p.id} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {p.matchday && <span style={{ fontSize: '.7rem', background: '#e8f0fe', color: '#1a73e8', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>J{p.matchday}</span>}
                  {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.7rem', background: '#fce8d9', color: '#e8710a', borderRadius: '10px', padding: '2px 8px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                  {p.played_at && (
                    <span style={{ fontSize: '.72rem', color: '#202124', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={10} color="#1a73e8"/>
                      {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                      {' · '}
                      {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {p.location && <span style={{ fontSize: '.72rem', color: '#9aa0a6', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10}/>{p.location}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', textAlign: 'right' }}>{p.home?.name}</span>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={30}/>
                    </div>
                  </div>
                  <span style={{ fontWeight: '700', color: '#9aa0a6', fontSize: '.9rem', flexShrink: 0, background: '#f1f3f4', padding: '4px 12px', borderRadius: '8px' }}>VS</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={30}/>
                    </div>
                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{p.away?.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GOLEADORES */}
        {tab === 'goleadores' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Top goleadores</div>
            {goleadores.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Sin estadísticas aún</div>
            ) : goleadores.map((g, i) => (
              <div key={`${g.player_id}-${g.team_id}`} style={{ padding: '12px 18px', borderTop: i > 0 ? '1px solid #f1f3f4' : 'none', display: 'flex', alignItems: 'center', gap: '12px', background: i === 0 ? '#fffbf0' : '#fff' }}>
                <div style={{ width: '28px', textAlign: 'center', fontWeight: '800', fontSize: '.9rem', color: i === 0 ? '#f59e0b' : i === 1 ? '#9aa0a6' : i === 2 ? '#cd7f32' : '#c9cdd2', flexShrink: 0 }}>
                  {i === 0 ? <Star size={18} fill="#f59e0b" color="#f59e0b"/> : i + 1}
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: '#f1f3f4', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {g.photo_url ? <img src={g.photo_url} alt={g.player_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1rem' }}>👤</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.player_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={g.team_logo} name={g.team_name} size={16}/>
                    </div>
                    <span style={{ fontSize: '.75rem', color: '#5f6368' }}>{g.team_name}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#1a73e8', lineHeight: 1 }}>{g.total_goals}</div>
                    <div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>goles</div>
                  </div>
                  {g.total_yellow > 0 && <span style={{ fontSize: '.75rem', background: '#fef9c3', color: '#ca8a04', borderRadius: '6px', padding: '2px 7px', fontWeight: '700' }}>🟨{g.total_yellow}</span>}
                  {g.total_red    > 0 && <span style={{ fontSize: '.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', padding: '2px 7px', fontWeight: '700' }}>🟥{g.total_red}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', color: '#c4c7ca', fontSize: '.72rem' }}>
          golmebol.app
        </div>
      </div>
    </div>
  )
}
