import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Shield } from 'lucide-react'

const TABS = [
  { id: 'posiciones', label: 'Posiciones' },
  { id: 'partidos',   label: 'Partidos'   },
  { id: 'goleadores', label: 'Goleadores' },
]

export default function PlayerTorneoPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [torneo,      setTorneo]      = useState(null)
  const [equipos,     setEquipos]     = useState([])
  const [partidos,    setPartidos]    = useState([])
  const [goleadores,  setGoleadores]  = useState([])
  const [miHistorial, setMiHistorial] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('posiciones')
  const [subTabPart,  setSubTabPart]  = useState('todos')
  const [miEquipoId,  setMiEquipoId]  = useState(null)
  const [playerId,    setPlayerId]    = useState(null)

  useEffect(() => { fetchTodo() }, [id])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
    if (player) {
      setPlayerId(player.id)
      const { data: reg } = await supabase
        .from('tournament_player_registrations')
        .select('team_id')
        .eq('tournament_id', id)
        .eq('player_id', player.id)
        .single()
      if (reg) setMiEquipoId(reg.team_id)

      // Historial del jugador en este torneo
      const { data: hist } = await supabase
        .from('player_match_stats')
        .select('*, matches(id, played_at, home_score, away_score, matchday, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url))')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
      // Filtrar solo los partidos de este torneo
      const histTorneo = (hist || []).filter(h => h.matches?.id && partidos.find(p => p.id === h.matches.id))
      setMiHistorial(hist || []) // guardamos todo, filtramos después
    }

    await Promise.all([fetchTorneo(), fetchEquipos(), fetchPartidos(), fetchGoleadores()])
    setLoading(false)
  }

  async function fetchTorneo() {
    const { data } = await supabase.from('tournaments').select('*').eq('id', id).single()
    setTorneo(data)
  }

  async function fetchEquipos() {
    const { data } = await supabase.from('tournament_teams').select('*, teams(*)').eq('tournament_id', id)
    setEquipos((data || []).map(d => ({ ...d.teams, tournament_team_id: d.id })))
  }

  async function fetchPartidos() {
    const { data } = await supabase
      .from('matches')
      .select('*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
      .eq('tournament_id', id)
      .order('played_at', { ascending: false })
    setPartidos(data || [])
  }

  async function fetchGoleadores() {
    const { data } = await supabase
      .from('goleadores_por_torneo')
      .select('*')
      .eq('tournament_id', id)
      .gt('total_goals', 0)
      .order('total_goals', { ascending: false })
    setGoleadores(data || [])
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#1a73e8', fontSize: '.9rem', fontWeight: '500' }}>Cargando...</div>
    </div>
  )

  if (!torneo) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6' }}>
      Torneo no encontrado
    </div>
  )

  // Tabla de posiciones
  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidos.filter(p => p.status === 'finished').forEach(p => {
    if (tabla[p.home_team_id]) {
      tabla[p.home_team_id].pj++
      tabla[p.home_team_id].gf += p.home_score || 0
      tabla[p.home_team_id].gc += p.away_score || 0
      if (p.home_score > p.away_score)       { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += 3 }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += 1 }
      else                                     tabla[p.home_team_id].pp++
    }
    if (tabla[p.away_team_id]) {
      tabla[p.away_team_id].pj++
      tabla[p.away_team_id].gf += p.away_score || 0
      tabla[p.away_team_id].gc += p.home_score || 0
      if (p.away_score > p.home_score)       { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += 3 }
      else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += 1 }
      else                                     tabla[p.away_team_id].pp++
    }
  })
  const tablaOrdenada      = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  const partidosJugados    = partidos.filter(p => p.status === 'finished')
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')

  // Historial filtrado por este torneo
  const idsPartidosTorneo = new Set(partidos.map(p => p.id))
  const miHistorialTorneo = miHistorial.filter(h => h.matches?.id && idsPartidosTorneo.has(h.matches.id))

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate('/jugador')}
          style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {torneo.logo_url
            ? <img src={torneo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/>
            : <span style={{ fontSize: '1.2rem' }}>🏆</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneo.name}</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
            {torneo.modalidad && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '1px 7px', fontWeight: '500' }}>{torneo.modalidad}</span>}
            {torneo.season    && <span style={{ fontSize: '.68rem', color: '#5f6368' }}>{torneo.season}</span>}
          </div>
        </div>
        <div style={{ fontSize: '.72rem', color: '#5f6368', flexShrink: 0 }}>{equipos.length} equipos</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', padding: '0 16px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: tab === t.id ? '600' : '400', color: tab === t.id ? '#1a73e8' : '#5f6368', borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent', transition: 'all .15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto' }}>

        {/* ── POSICIONES ── */}
        {tab === 'posiciones' && (
          <div>
            {tablaOrdenada.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
                <div style={{ fontSize: '.875rem' }}>Sin resultados aún</div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 32px 32px 32px 32px 32px 32px 40px', gap: '2px', padding: '10px 12px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.65rem', fontWeight: '600', color: '#5f6368' }}>
                  <div>#</div><div>Equipo</div>
                  <div style={{ textAlign: 'center' }}>PJ</div>
                  <div style={{ textAlign: 'center' }}>PG</div>
                  <div style={{ textAlign: 'center' }}>PE</div>
                  <div style={{ textAlign: 'center' }}>PP</div>
                  <div style={{ textAlign: 'center' }}>GF</div>
                  <div style={{ textAlign: 'center' }}>GC</div>
                  <div style={{ textAlign: 'center', color: '#1a73e8' }}>PTS</div>
                </div>
                {tablaOrdenada.map((row, i) => {
                  const esMiEquipo = row.equipo.id === miEquipoId
                  return (
                    <div key={row.equipo.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 32px 32px 32px 32px 32px 32px 40px', gap: '2px', padding: '10px 12px', borderBottom: i < tablaOrdenada.length - 1 ? '1px solid #f1f3f4' : 'none', alignItems: 'center', background: esMiEquipo ? '#e8f0fe' : '#fff', borderLeft: esMiEquipo ? '3px solid #1a73e8' : '3px solid transparent' }}>
                      <div style={{ fontSize: '.75rem', fontWeight: '700', color: i === 0 ? '#f9a825' : i === 1 ? '#9aa0a6' : i === 2 ? '#cd7f32' : '#bdbdbd' }}>{i + 1}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {row.equipo.logo_url ? <img src={row.equipo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
                        </div>
                        <span style={{ fontSize: '.78rem', fontWeight: esMiEquipo ? '700' : '500', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.equipo.name}</span>
                      </div>
                      {[row.pj, row.pg, row.pe, row.pp, row.gf, row.gc].map((v, j) => (
                        <div key={j} style={{ textAlign: 'center', fontSize: '.78rem', color: '#5f6368' }}>{v}</div>
                      ))}
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '.88rem', color: esMiEquipo ? '#fff' : '#202124', background: esMiEquipo ? '#1a73e8' : '#f1f3f4', borderRadius: '6px', padding: '2px 7px' }}>{row.pts}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', padding: '10px 14px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', fontSize: '.68rem', color: '#5f6368', flexWrap: 'wrap' }}>
              <span>PJ = Partidos Jugados</span><span>PG = Ganados</span><span>PE = Empates</span>
              <span>PP = Perdidos</span><span>GF = Goles a Favor</span><span>GC = Goles en Contra</span>
            </div>
          </div>
        )}

        {/* ── PARTIDOS ── */}
        {tab === 'partidos' && (
          <div>
            {/* Subtabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              <button onClick={() => setSubTabPart('todos')}
                style={{ padding: '6px 16px', borderRadius: '20px', border: `1px solid ${subTabPart === 'todos' ? '#1a73e8' : '#dadce0'}`, background: subTabPart === 'todos' ? '#1a73e8' : '#fff', color: subTabPart === 'todos' ? '#fff' : '#5f6368', fontSize: '.78rem', fontWeight: subTabPart === 'todos' ? '600' : '400', cursor: 'pointer' }}>
                Todos ({partidos.length})
              </button>
              {miEquipoId && (
                <button onClick={() => setSubTabPart('mios')}
                  style={{ padding: '6px 16px', borderRadius: '20px', border: `1px solid ${subTabPart === 'mios' ? '#1a73e8' : '#dadce0'}`, background: subTabPart === 'mios' ? '#1a73e8' : '#fff', color: subTabPart === 'mios' ? '#fff' : '#5f6368', fontSize: '.78rem', fontWeight: subTabPart === 'mios' ? '600' : '400', cursor: 'pointer' }}>
                  Mis partidos ({miHistorialTorneo.length})
                </button>
              )}
            </div>

            {/* ── TODOS ── */}
            {subTabPart === 'todos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {partidosPendientes.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e8710a', display: 'inline-block' }}/>
                      Próximos partidos
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      {partidosPendientes.map((p, i) => {
                        const esMiPartido = p.home?.id === miEquipoId || p.away?.id === miEquipoId
                        return (
                          <div key={p.id} style={{ padding: '12px 14px', borderBottom: i < partidosPendientes.length - 1 ? '1px solid #f1f3f4' : 'none', background: esMiPartido ? '#fffbf0' : '#fff', borderLeft: esMiPartido ? '3px solid #e8710a' : '3px solid transparent' }}>
                            {p.played_at && (
                              <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginBottom: '8px', display: 'flex', gap: '8px' }}>
                                <span>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                                <span>🕐 {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                                {p.location && <span>📍 {p.location}</span>}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: '.85rem', fontWeight: p.home?.id === miEquipoId ? '700' : '500', color: '#202124', textAlign: 'right' }}>{p.home?.name}</span>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={13} color="#9aa0a6"/>}
                                </div>
                              </div>
                              <div style={{ fontSize: '.72rem', fontWeight: '600', color: '#5f6368', padding: '4px 10px', background: '#f1f3f4', borderRadius: '6px', flexShrink: 0 }}>VS</div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={13} color="#9aa0a6"/>}
                                </div>
                                <span style={{ fontSize: '.85rem', fontWeight: p.away?.id === miEquipoId ? '700' : '500', color: '#202124' }}>{p.away?.name}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {partidosJugados.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1e8e3e', display: 'inline-block' }}/>
                      Resultados
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      {partidosJugados.map((p, i) => {
                        const esMiPartido = p.home?.id === miEquipoId || p.away?.id === miEquipoId
                        const gane   = miEquipoId && ((p.home?.id === miEquipoId && p.home_score > p.away_score) || (p.away?.id === miEquipoId && p.away_score > p.home_score))
                        const empate = esMiPartido && p.home_score === p.away_score
                        const perdi  = esMiPartido && !gane && !empate
                        const resultColor = gane ? '#1e8e3e' : empate ? '#e8710a' : perdi ? '#d93025' : '#1a73e8'
                        const resultBg    = gane ? '#e6f4ea'  : empate ? '#fce8d9'  : perdi ? '#fce8e6'  : '#e8f0fe'
                        const resultLabel = gane ? 'G' : empate ? 'E' : perdi ? 'P' : ''
                        return (
                          <div key={p.id} style={{ padding: '12px 14px', borderBottom: i < partidosJugados.length - 1 ? '1px solid #f1f3f4' : 'none', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                              {esMiPartido && resultLabel && (
                                <span style={{ fontSize: '.65rem', fontWeight: '700', color: resultColor, background: resultBg, borderRadius: '4px', padding: '1px 6px', marginRight: '4px' }}>{resultLabel}</span>
                              )}
                              {p.matchday && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '1px 7px', fontWeight: '500' }}>J{p.matchday}</span>}
                              {p.played_at && <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: '.85rem', fontWeight: p.home?.id === miEquipoId ? '700' : '500', color: '#202124', textAlign: 'right' }}>{p.home?.name}</span>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
                                </div>
                              </div>
                              <div style={{ fontWeight: '700', fontSize: '1rem', color: '#202124', padding: '4px 12px', background: '#f1f3f4', borderRadius: '8px', flexShrink: 0, minWidth: '56px', textAlign: 'center' }}>
                                {p.home_score} - {p.away_score}
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
                                </div>
                                <span style={{ fontSize: '.85rem', fontWeight: p.away?.id === miEquipoId ? '700' : '500', color: '#202124' }}>{p.away?.name}</span>
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

            {/* ── MIS PARTIDOS ── */}
            {subTabPart === 'mios' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {miHistorialTorneo.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                    <div style={{ fontSize: '.875rem' }}>Aún no has jugado en este torneo</div>
                  </div>
                ) : miHistorialTorneo.map((h, i) => {
                  const match     = h.matches
                  if (!match) return null
                  const resultado = h.team_result
                  const resColor  = resultado === 'win' ? '#1e8e3e' : resultado === 'draw' ? '#e8710a' : '#d93025'
                  const resBg     = resultado === 'win' ? '#e6f4ea'  : resultado === 'draw' ? '#fce8d9'  : '#fce8e6'
                  const resLabel  = resultado === 'win' ? 'G' : resultado === 'draw' ? 'E' : 'P'
                  return (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '.65rem', fontWeight: '700', color: resColor, background: resBg, borderRadius: '4px', padding: '2px 7px' }}>{resLabel}</span>
                          {match.matchday && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '1px 7px' }}>J{match.matchday}</span>}
                        </div>
                        {match.played_at && (
                          <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>
                            📅 {new Date(match.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '.85rem', fontWeight: '600', color: '#202124', textAlign: 'right' }}>{match.home?.name}</span>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {match.home?.logo_url ? <img src={match.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={11} color="#9aa0a6"/>}
                          </div>
                        </div>
                        <div style={{ fontWeight: '700', fontSize: '1rem', color: '#202124', padding: '4px 12px', background: '#f1f3f4', borderRadius: '8px', flexShrink: 0 }}>
                          {match.home_score} - {match.away_score}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {match.away?.logo_url ? <img src={match.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={11} color="#9aa0a6"/>}
                          </div>
                          <span style={{ fontSize: '.85rem', fontWeight: '600', color: '#202124' }}>{match.away?.name}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(h.goals_scored || 0) > 0 && (
                          <span style={{ fontSize: '.72rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>⚽ {h.goals_scored} gol{h.goals_scored > 1 ? 'es' : ''}</span>
                        )}
                        {(h.yellow_cards || 0) > 0 && (
                          <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟨 Amarilla</span>
                        )}
                        {(h.blue_cards || 0) > 0 && (
                          <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟦 Azul</span>
                        )}
                        {(h.red_cards || 0) > 0 && (
                          <span style={{ fontSize: '.72rem', color: '#d93025', background: '#fce8e6', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟥 Roja</span>
                        )}
                        {(h.goals_conceded || 0) > 0 && (
                          <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>🧤 {h.goals_conceded} recibido{h.goals_conceded > 1 ? 's' : ''}</span>
                        )}
                        {(h.fouls || 0) > 0 && (
                          <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>✋ {h.fouls} falta{h.fouls > 1 ? 's' : ''}</span>
                        )}
                        {(h.goals_scored || 0) === 0 && (h.yellow_cards || 0) === 0 && (h.blue_cards || 0) === 0 && (h.red_cards || 0) === 0 && (h.fouls || 0) === 0 && (h.goals_conceded || 0) === 0 && (
                          <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Sin incidencias</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── GOLEADORES ── */}
        {tab === 'goleadores' && (
          <div>
            {goleadores.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚽</div>
                <div style={{ fontSize: '.875rem' }}>Sin goles aún</div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 36px 30px 30px 30px', gap: '2px', padding: '10px 12px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.65rem', fontWeight: '600', color: '#5f6368' }}>
                  <div>#</div><div>Jugador</div><div>Equipo</div>
                  <div style={{ textAlign: 'center', color: '#1a73e8' }}>⚽</div>
                  <div style={{ textAlign: 'center' }}>🟨</div>
                  <div style={{ textAlign: 'center' }}>🟦</div>
                  <div style={{ textAlign: 'center' }}>🟥</div>
                </div>
                {goleadores.map((g, i) => (
                  <div key={`${g.player_id}-${g.team_id}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 36px 30px 30px 30px', gap: '2px', padding: '11px 12px', borderBottom: i < goleadores.length - 1 ? '1px solid #f1f3f4' : 'none', alignItems: 'center' }}>
                    <div style={{ fontSize: '.78rem', fontWeight: '700', color: i === 0 ? '#f9a825' : i === 1 ? '#9aa0a6' : i === 2 ? '#cd7f32' : '#bdbdbd' }}>{i + 1}°</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {g.photo_url ? <img src={g.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.9rem' }}>👤</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.player_name}</div>
                        <div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>{g.partidos_jugados} PJ</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                      {g.team_logo && <img src={g.team_logo} style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }}/>}
                      <span style={{ fontSize: '.72rem', color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.team_name}</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '.95rem', color: i === 0 ? '#f9a825' : '#1a73e8' }}>{g.total_goals}</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '.8rem', color: (g.total_yellow || 0) > 0 ? '#f9a825' : '#bdbdbd', fontWeight: (g.total_yellow || 0) > 0 ? '600' : '400' }}>{g.total_yellow || 0}</div>
                    <div style={{ textAlign: 'center', fontSize: '.8rem', color: (g.total_blue || 0) > 0 ? '#1a73e8' : '#bdbdbd', fontWeight: (g.total_blue || 0) > 0 ? '600' : '400' }}>{g.total_blue || 0}</div>
                    <div style={{ textAlign: 'center', fontSize: '.8rem', color: (g.total_red || 0) > 0 ? '#d93025' : '#bdbdbd', fontWeight: (g.total_red || 0) > 0 ? '600' : '400' }}>{g.total_red || 0}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
