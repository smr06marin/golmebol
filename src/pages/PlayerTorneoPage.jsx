import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Shield, X } from 'lucide-react'
import RankingPoster from '../components/RankingPoster'
import TablaPosiciones from '../components/TablaPosiciones'
import VallaEquipos from '../components/VallaEquipos'

const TABS = [
  { id: 'posiciones', label: 'Posiciones' },
  { id: 'partidos',   label: 'Partidos'   },
  { id: 'goleadores', label: 'Goleadores' },
]

const MEDALLA = ['#f9a825', '#c9cdd2', '#cd7f32']

// Banner tipo "poster" con el podio de goleadores y la valla menos vencida del torneo
function TopGoleadoresBanner({ goleadores, vallaDestacados, vallaRecibidos }) {
  const top3 = goleadores.slice(0, 3)
  if (top3.length === 0 && vallaDestacados.length === 0) return null

  return (
    <div style={{
      background: 'radial-gradient(circle at 50% 0%, #241a05 0%, #0a0a12 55%, #07070e 100%)',
      borderRadius: '18px',
      padding: '26px 16px 22px',
      marginBottom: '16px',
      border: '1px solid #2a2410',
      boxShadow: '0 8px 30px rgba(0,0,0,.25)',
    }}>
      {top3.length > 0 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '1.7rem', marginBottom: '4px' }}>🏆</div>
            <div style={{ fontWeight: '900', color: '#fff', fontSize: '1.05rem', letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1.3 }}>
              Top Goleadores
            </div>
            <div style={{ color: '#f9a825', fontWeight: '800', fontSize: '.68rem', letterSpacing: '.18em', marginTop: '2px' }}>
              DEL TORNEO
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {top3.map((g, i) => (
              <div key={`${g.player_id}-${g.team_id}`} style={{ width: '104px', textAlign: 'center' }}>
                <div style={{ width: '74px', height: '74px', borderRadius: '50%', margin: '0 auto', border: `3px solid ${MEDALLA[i]}`, overflow: 'hidden', background: '#1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${MEDALLA[i]}55` }}>
                  {g.photo_url ? <img src={g.photo_url} alt={g.player_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1.6rem' }}>👤</span>}
                </div>
                <div style={{ marginTop: '-13px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ background: MEDALLA[i], color: '#000', fontWeight: '900', fontSize: '.7rem', borderRadius: '10px', padding: '2px 9px', border: '2px solid #0a0a12', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{g.total_goals}</span>
                    {g.team_logo && <img src={g.team_logo} style={{ width: '11px', height: '11px', objectFit: 'contain', flexShrink: 0 }}/>}
                  </div>
                </div>
                <div style={{ marginTop: '7px', color: '#fff', fontWeight: '800', fontSize: '.7rem', textTransform: 'uppercase', lineHeight: 1.2 }}>{g.player_name}</div>
                <div style={{ color: '#8a8f9a', fontSize: '.62rem', marginTop: '2px' }}>{g.team_name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {vallaDestacados.length > 0 && (
        <div style={{ marginTop: top3.length > 0 ? '22px' : '0', paddingTop: top3.length > 0 ? '18px' : '0', borderTop: top3.length > 0 ? '1px solid rgba(255,255,255,.08)' : 'none', textAlign: 'center' }}>
          <div style={{ color: '#00ddd0', fontWeight: '800', fontSize: '.68rem', letterSpacing: '.14em', marginBottom: '10px' }}>
            🧤 VALLA MENOS VENCIDA · {vallaRecibidos} gol{vallaRecibidos === 1 ? '' : 'es'} recibido{vallaRecibidos === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {vallaDestacados.map(a => (
              <div key={a.player_id} style={{ textAlign: 'center', width: '86px' }}>
                <div style={{ width: '58px', height: '58px', borderRadius: '50%', margin: '0 auto', border: '2px solid #00ddd0', overflow: 'hidden', background: '#1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px #00ddd055' }}>
                  {a.foto ? <img src={a.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1.2rem' }}>🧤</span>}
                </div>
                <div style={{ marginTop: '6px', color: '#fff', fontWeight: '700', fontSize: '.65rem', lineHeight: 1.2 }}>{a.nombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '3px' }}>
                  {a.team_logo && <img src={a.team_logo} style={{ width: '11px', height: '11px', objectFit: 'contain' }}/>}
                  <span style={{ color: '#8a8f9a', fontSize: '.6rem' }}>{a.team_name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Modal historial de partido
function ModalPartido({ partido, onClose }) {
  const [stats,   setStats]   = useState([])
  const [mvp,     setMvp]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: statsData }, { data: mvpData }] = await Promise.all([
        supabase.from('player_match_stats')
          .select('*, players(id, name, photo_face_url, photo_url), teams(id, name, logo_url)')
          .eq('match_id', partido.id)
          .order('goals_scored', { ascending: false }),
        supabase.from('tournament_logros')
          .select('*, players(name, photo_face_url, photo_url)')
          .eq('match_id', partido.id)
          .eq('tipo', 'mvp')
          .maybeSingle(),
      ])
      setStats(statsData || [])
      if (mvpData?.players) setMvp(mvpData)
      setLoading(false)
    }
    load()
  }, [partido.id])

  const local    = stats.filter(s => s.team_id === partido.home_team_id)
  const visitante= stats.filter(s => s.team_id === partido.away_team_id)

  function TeamStats({ jugadores, equipo, logo }) {
    const goleadores = jugadores.filter(j => j.goals_scored > 0)
    const amarillas  = jugadores.filter(j => j.yellow_cards > 0)
    const azules     = jugadores.filter(j => j.blue_cards > 0)
    const rojas      = jugadores.filter(j => j.red_cards > 0)
    const faltas     = jugadores.filter(j => j.fouls > 0)

    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {logo ? <img src={logo} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={13} color="#9aa0a6"/>}
          </div>
          <span style={{ fontWeight: '700', fontSize: '.85rem', color: '#202124' }}>{equipo}</span>
        </div>

        {jugadores.length === 0 && <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Sin datos</div>}

        {goleadores.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#5f6368', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>⚽ Goles</div>
            {goleadores.map(j => (
              <div key={j.player_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {j.players?.photo_face_url || j.players?.photo_url
                    ? <img src={j.players.photo_face_url || j.players.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <span style={{ fontSize: '.65rem' }}>👤</span>}
                </div>
                <span style={{ fontSize: '.78rem', color: '#202124', flex: 1 }}>{j.players?.name}</span>
                <span style={{ fontSize: '.78rem', fontWeight: '700', color: '#1e8e3e' }}>×{j.goals_scored}</span>
              </div>
            ))}
          </div>
        )}

        {amarillas.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#5f6368', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>🟨 Amarillas</div>
            {amarillas.map(j => (
              <div key={j.player_id} style={{ fontSize: '.75rem', color: '#e8710a', marginBottom: '2px' }}>• {j.players?.name}</div>
            ))}
          </div>
        )}

        {azules.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#5f6368', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>🟦 Azules</div>
            {azules.map(j => (
              <div key={j.player_id} style={{ fontSize: '.75rem', color: '#1a73e8', marginBottom: '2px' }}>• {j.players?.name}</div>
            ))}
          </div>
        )}

        {rojas.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#5f6368', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>🟥 Rojas</div>
            {rojas.map(j => (
              <div key={j.player_id} style={{ fontSize: '.75rem', color: '#d93025', marginBottom: '2px' }}>• {j.players?.name}</div>
            ))}
          </div>
        )}

        {faltas.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#5f6368', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>✋ Faltas</div>
            {faltas.map(j => (
              <div key={j.player_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: '#5f6368', marginBottom: '2px' }}>
                <span>• {j.players?.name}</span>
                <span style={{ fontWeight: '600' }}>{j.fouls}</span>
              </div>
            ))}
          </div>
        )}

        {goleadores.length === 0 && amarillas.length === 0 && azules.length === 0 && rojas.length === 0 && faltas.length === 0 && jugadores.length > 0 && (
          <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Sin incidencias</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '.95rem', color: '#202124' }}>{partido.home?.name} vs {partido.away?.name}</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>
              {partido.played_at && new Date(partido.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' })}
              {partido.matchday && ` · J${partido.matchday}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', display: 'flex' }}><X size={20}/></button>
        </div>

        {/* Marcador */}
        <div style={{ padding: '16px 20px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
            <span style={{ fontWeight: '700', fontSize: '.9rem', color: '#202124', textAlign: 'right' }}>{partido.home?.name}</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {partido.home?.logo_url ? <img src={partido.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={14} color="#9aa0a6"/>}
            </div>
          </div>
          <div style={{ fontWeight: '900', fontSize: '1.8rem', color: '#202124', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '6px 18px', flexShrink: 0 }}>
            {partido.home_score} — {partido.away_score}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {partido.away?.logo_url ? <img src={partido.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={14} color="#9aa0a6"/>}
            </div>
            <span style={{ fontWeight: '700', fontSize: '.9rem', color: '#202124' }}>{partido.away?.name}</span>
          </div>
        </div>

        {/* MVP */}
        {mvp && (
          <div style={{ padding: '10px 20px', background: '#fff8e1', borderBottom: '1px solid #ffe082', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mvp.players?.photo_face_url || mvp.players?.photo_url
                ? <img src={mvp.players.photo_face_url || mvp.players.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : <span style={{ fontSize: '.85rem' }}>👤</span>}
            </div>
            <div>
              <div style={{ fontSize: '.65rem', color: '#e8710a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.05em' }}>⭐ MVP del partido</div>
              <div style={{ fontSize: '.88rem', fontWeight: '700', color: '#202124' }}>{mvp.players?.name}</div>
            </div>
          </div>
        )}

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9aa0a6' }}>Cargando historial...</div>
          ) : stats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9aa0a6' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
              <div style={{ fontSize: '.875rem' }}>Sin datos de planilla para este partido</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '20px' }}>
              <TeamStats jugadores={local}     equipo={partido.home?.name} logo={partido.home?.logo_url}/>
              <div style={{ width: '1px', background: '#e8eaed', flexShrink: 0 }}/>
              <TeamStats jugadores={visitante} equipo={partido.away?.name} logo={partido.away?.logo_url}/>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Modal con foto grande + nombre de cada jugador REGISTRADO de un equipo en
// este torneo — para verificar en cancha quién sí está inscrito.
function RosterModal({ rosterModal, onClose, torneoNombre }) {
  if (!rosterModal) return null
  const { team, jugadores, loading } = rosterModal
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {team.logo_url ? <img src={team.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={16} color="#9aa0a6"/>}
            </div>
            <div style={{ fontWeight: '800', color: '#202124', fontSize: '1.05rem' }}>{team.name}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#5f6368', fontSize: '1rem', fontWeight: '700' }}>✕</button>
        </div>
        <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '18px', lineHeight: 1.5 }}>
          Jugadores registrados de <b>{team.name}</b> en <b>{torneoNombre}</b>.
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Cargando jugadores...</div>
        ) : jugadores.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Este equipo aún no tiene jugadores registrados en este torneo</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '16px' }}>
            {jugadores.map(j => (
              <div key={j.id} style={{ textAlign: 'center' }}>
                <div style={{ width: '92px', height: '92px', borderRadius: '50%', margin: '0 auto', overflow: 'hidden', background: '#f1f3f4', border: '2px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(j.photo_face_url || j.photo_url)
                    ? <img src={j.photo_face_url || j.photo_url} alt={j.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <span style={{ fontSize: '2rem' }}>👤</span>}
                </div>
                <div style={{ marginTop: '8px', fontWeight: '700', color: '#202124', fontSize: '.82rem', lineHeight: 1.25 }}>{j.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlayerTorneoPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [torneo,         setTorneo]         = useState(null)
  const [equipos,        setEquipos]        = useState([])
  const [partidos,       setPartidos]       = useState([])
  const [goleadores,     setGoleadores]     = useState([])
  const [miHistorial,    setMiHistorial]    = useState([])
  const [loading,        setLoading]        = useState(true)
  const [tab,            setTab]            = useState('posiciones')
  const [subTabPart,     setSubTabPart]     = useState('todos')
  const [miEquipoId,     setMiEquipoId]     = useState(null)
  const [playerId,       setPlayerId]       = useState(null)
  const [modalPartido,   setModalPartido]   = useState(null)
  const [vallas,         setVallas]         = useState({ opcion1: [], opcion2: [] })
  const [modoValla,      setModoValla]      = useState('opcion1')
  const [arquerosEquipos, setArquerosEquipos] = useState([]) // arqueros registrados por equipo
  const [rosterModal, setRosterModal] = useState(null) // { team, jugadores, loading } — ficha de fotos del equipo

  useEffect(() => { fetchTodo() }, [id])

  async function abrirRoster(team) {
    if (!team?.id) return
    setRosterModal({ team, jugadores: [], loading: true })
    const { data } = await supabase
      .from('tournament_player_registrations')
      .select('players(id, name, photo_url, photo_face_url)')
      .eq('tournament_id', id)
      .eq('team_id', team.id)
      .eq('activo', true)
    const jugadores = (data || []).map(r => r.players).filter(Boolean).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setRosterModal({ team, jugadores, loading: false })
  }

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
    if (player) {
      setPlayerId(player.id)
      const { data: reg } = await supabase
        .from('tournament_player_registrations')
        .select('team_id').eq('tournament_id', id).eq('player_id', player.id).single()
      if (reg) setMiEquipoId(reg.team_id)

      const { data: hist } = await supabase
        .from('player_match_stats')
        .select('*, matches(id, played_at, home_score, away_score, matchday, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url))')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
      setMiHistorial(hist || [])
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

    const lista = data || []
    if (lista.length > 0) {
      const { data: mvps } = await supabase
        .from('tournament_logros')
        .select('match_id, player_id, players(name, photo_face_url, photo_url)')
        .eq('tournament_id', id).eq('tipo', 'mvp')
        .in('match_id', lista.map(p => p.id))
      const mvpMap = {}
      ;(mvps || []).forEach(m => { mvpMap[m.match_id] = { nombre: m.players?.name, foto: m.players?.photo_face_url || m.players?.photo_url } })
      setPartidos(lista.map(p => ({ ...p, mvp: mvpMap[p.id] || null })))
    } else {
      setPartidos([])
    }
  }

  async function fetchGoleadores() {
    const { data } = await supabase
      .from('goleadores_por_torneo').select('*')
      .eq('tournament_id', id).gt('total_goals', 0)
      .order('total_goals', { ascending: false })
    setGoleadores(data || [])

    // Valla menos vencida: todos los partidos de arqueros
    const { data: statsPorteros } = await supabase
      .from('player_match_stats')
      .select('player_id, goals_conceded, team_id, players(name, photo_face_url, photo_url, posicion_futbol5, posicion_futbol7, posicion_futbol11), teams(name, logo_url)')
      .eq('tournament_id', id)

    // Agrupar por jugador
    const mapPorteros = {}
    ;(statsPorteros || []).forEach(s => {
      const esPortero = s.players?.posicion_futbol5 === 'Portero' || s.players?.posicion_futbol7 === 'Portero' || s.players?.posicion_futbol11 === 'Portero'
      if (!esPortero) return
      if (!mapPorteros[s.player_id]) {
        mapPorteros[s.player_id] = {
          player_id: s.player_id,
          nombre: s.players?.name,
          foto: s.players?.photo_face_url || s.players?.photo_url,
          team_name: s.teams?.name,
          team_logo: s.teams?.logo_url,
          pj: 0,
          total_recibidos: 0,
        }
      }
      mapPorteros[s.player_id].pj++
      mapPorteros[s.player_id].total_recibidos += s.goals_conceded || 0
    })

    const listaPorteros = Object.values(mapPorteros)
    // Opción 1: promedio goles recibidos/PJ (menor es mejor)
    const op1 = listaPorteros
      .map(p => ({ ...p, promedio: p.pj > 0 ? parseFloat((p.total_recibidos / p.pj).toFixed(2)) : 99 }))
      .sort((a, b) => a.promedio - b.promedio)

    // Opción 2: menos goles recibidos total — solo arqueros (todos)
    const op2 = listaPorteros
      .sort((a, b) => a.total_recibidos - b.total_recibidos)

    setVallas({ opcion1: op1, opcion2: op2 })

    // Arqueros REGISTRADOS de cada equipo del torneo (para la valla por equipo)
    const { data: tt } = await supabase.from('tournament_teams').select('team_id').eq('tournament_id', id)
    const teamIds = (tt || []).map(t => t.team_id).filter(Boolean)
    if (teamIds.length > 0) {
      const { data: tp } = await supabase.from('team_players')
        .select('team_id, players(name, photo_face_url, photo_url, posicion_futbol5, posicion_futbol7, posicion_futbol11)')
        .in('team_id', teamIds)
      setArquerosEquipos((tp || [])
        .filter(x => x.players && (x.players.posicion_futbol5 === 'Portero' || x.players.posicion_futbol7 === 'Portero' || x.players.posicion_futbol11 === 'Portero'))
        .map(x => ({ team_id: x.team_id, name: x.players.name, foto: x.players.photo_face_url || x.players.photo_url })))
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#1a73e8', fontSize: '.9rem', fontWeight: '500' }}>Cargando...</div>
    </div>
  )

  if (!torneo) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6' }}>Torneo no encontrado</div>
  )

  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidos.filter(p => p.status === 'finished').forEach(p => {
    if (tabla[p.home_team_id]) {
      tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score||0; tabla[p.home_team_id].gc += p.away_score||0
      if (p.home_score > p.away_score) { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += 3 }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts++ }
      else tabla[p.home_team_id].pp++
    }
    if (tabla[p.away_team_id]) {
      tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score||0; tabla[p.away_team_id].gc += p.home_score||0
      if (p.away_score > p.home_score) { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += 3 }
      else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts++ }
      else tabla[p.away_team_id].pp++
    }
  })
  const tablaOrdenada      = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))

  // Valla menos vencida GLOBAL por equipo: ranking por goles en contra, con
  // los arqueros registrados de cada equipo (fotos y nombres)
  const vallaEquiposRows = tablaOrdenada
    .filter(r => r.pj > 0)
    .sort((a, b) => a.gc - b.gc || b.pj - a.pj)
    .map(r => ({
      equipo: r.equipo, gc: r.gc, pj: r.pj,
      arqueros: arquerosEquipos.filter(a => a.team_id === r.equipo.id),
    }))
  const partidosJugados    = partidos.filter(p => p.status === 'finished')
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')
  const idsPartidosTorneo  = new Set(partidos.map(p => p.id))
  const miHistorialTorneo  = miHistorial.filter(h => h.matches?.id && idsPartidosTorneo.has(h.matches.id))

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {modalPartido && <ModalPartido partido={modalPartido} onClose={() => setModalPartido(null)}/>}
      <RosterModal rosterModal={rosterModal} onClose={() => setRosterModal(null)} torneoNombre={torneo?.name}/>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate('/jugador')} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', flexShrink: 0 }}><ArrowLeft size={18}/></button>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {torneo.logo_url ? <img src={torneo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/> : <span style={{ fontSize: '1.2rem' }}>🏆</span>}
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
            <TablaPosiciones titulo="Tabla de posiciones" rows={tablaOrdenada} miEquipoId={miEquipoId}/>
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', padding: '10px 14px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', fontSize: '.68rem', color: '#5f6368', flexWrap: 'wrap' }}>
              <span>PJ=Jugados</span><span>PG=Ganados</span><span>PE=Empates</span><span>PP=Perdidos</span><span>GF=Goles Favor</span><span>GC=Goles Contra</span>
            </div>
          </div>
        )}

        {/* ── PARTIDOS ── */}
        {tab === 'partidos' && (
          <div>
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

            {subTabPart === 'todos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Próximos */}
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
                              <div onClick={() => abrirRoster(p.home)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', cursor: 'pointer' }}>
                                <span style={{ fontSize: '.85rem', fontWeight: p.home?.id === miEquipoId ? '700' : '500', color: '#202124', textAlign: 'right' }}>{p.home?.name}</span>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={13} color="#9aa0a6"/>}
                                </div>
                              </div>
                              <div style={{ fontSize: '.72rem', fontWeight: '600', color: '#5f6368', padding: '4px 10px', background: '#f1f3f4', borderRadius: '6px', flexShrink: 0 }}>VS</div>
                              <div onClick={() => abrirRoster(p.away)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={13} color="#9aa0a6"/>}
                                </div>
                                <span style={{ fontSize: '.85rem', fontWeight: p.away?.id === miEquipoId ? '700' : '500', color: '#202124' }}>{p.away?.name}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '6px' }}>
                              <span style={{ fontSize: '.62rem', color: '#9aa0a6' }}>👆 Toca un equipo para ver sus jugadores registrados</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Resultados — clickeables */}
                {partidosJugados.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1e8e3e', display: 'inline-block' }}/>
                      Resultados <span style={{ fontWeight: '400', color: '#9aa0a6', fontSize: '.7rem' }}>· toca para ver detalles</span>
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
                          <div key={p.id} onClick={() => setModalPartido(p)}
                            style={{ padding: '12px 14px', borderBottom: i < partidosJugados.length - 1 ? '1px solid #f1f3f4' : 'none', background: '#fff', cursor: 'pointer', transition: 'background .1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                              {esMiPartido && resultLabel && <span style={{ fontSize: '.65rem', fontWeight: '700', color: resultColor, background: resultBg, borderRadius: '4px', padding: '1px 6px', marginRight: '4px' }}>{resultLabel}</span>}
                              {p.matchday && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '1px 7px', fontWeight: '500' }}>J{p.matchday}</span>}
                              {p.played_at && <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>}
                              {p.grupo && <span style={{ fontSize: '.65rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '20px', padding: '1px 7px' }}>{p.grupo}</span>}
                              <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: '#9aa0a6' }}>Ver detalles →</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div onClick={e => { e.stopPropagation(); abrirRoster(p.home) }}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: '.85rem', fontWeight: p.home?.id === miEquipoId ? '700' : '500', color: '#202124', textAlign: 'right' }}>{p.home?.name}</span>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
                                </div>
                              </div>
                              <div style={{ fontWeight: '700', fontSize: '1rem', color: '#202124', padding: '4px 12px', background: '#f1f3f4', borderRadius: '8px', flexShrink: 0, minWidth: '56px', textAlign: 'center' }}>
                                {p.home_score} - {p.away_score}
                              </div>
                              <div onClick={e => { e.stopPropagation(); abrirRoster(p.away) }}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
                                </div>
                                <span style={{ fontSize: '.85rem', fontWeight: p.away?.id === miEquipoId ? '700' : '500', color: '#202124' }}>{p.away?.name}</span>
                              </div>
                            </div>
                            {p.mvp && (
                              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px' }}>
                                <span style={{ fontSize: '.68rem', color: '#e8710a', fontWeight: '700' }}>⭐ MVP: {p.mvp.nombre}</span>
                              </div>
                            )}
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

            {/* Mis partidos */}
            {subTabPart === 'mios' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {miHistorialTorneo.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                    <div style={{ fontSize: '.875rem' }}>Aún no has jugado en este torneo</div>
                  </div>
                ) : miHistorialTorneo.map((h, i) => {
                  const match    = h.matches
                  if (!match) return null
                  const resultado = h.team_result
                  const resColor  = resultado === 'win' ? '#1e8e3e' : resultado === 'draw' ? '#e8710a' : '#d93025'
                  const resBg     = resultado === 'win' ? '#e6f4ea'  : resultado === 'draw' ? '#fce8d9'  : '#fce8e6'
                  const resLabel  = resultado === 'win' ? 'G' : resultado === 'draw' ? 'E' : 'P'
                  const partidoCompleto = partidos.find(pp => pp.id === match.id)
                  return (
                    <div key={i} onClick={() => partidoCompleto && setModalPartido(partidoCompleto)}
                      style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '.65rem', fontWeight: '700', color: resColor, background: resBg, borderRadius: '4px', padding: '2px 7px' }}>{resLabel}</span>
                          {match.matchday && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '1px 7px' }}>J{match.matchday}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {match.played_at && <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>📅 {new Date(match.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                          <span style={{ fontSize: '.6rem', color: '#9aa0a6' }}>Ver detalles →</span>
                        </div>
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
                        {(h.goals_scored  || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>⚽ {h.goals_scored} gol{h.goals_scored > 1 ? 'es' : ''}</span>}
                        {(h.yellow_cards  || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟨 Amarilla</span>}
                        {(h.blue_cards    || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟦 Azul</span>}
                        {(h.red_cards     || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#d93025', background: '#fce8e6', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟥 Roja</span>}
                        {(h.goals_conceded|| 0) > 0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>🧤 {h.goals_conceded} recibido{h.goals_conceded > 1 ? 's' : ''}</span>}
                        {(h.fouls         || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>✋ {h.fouls} falta{h.fouls > 1 ? 's' : ''}</span>}
                        {(h.goals_scored||0)===0 && (h.yellow_cards||0)===0 && (h.blue_cards||0)===0 && (h.red_cards||0)===0 && (h.fouls||0)===0 && (h.goals_conceded||0)===0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Sin incidencias</span>}
                      </div>
                      {partidoCompleto?.mvp && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px' }}>
                          <span style={{ fontSize: '.68rem', color: '#e8710a', fontWeight: '700' }}>⭐ MVP: {partidoCompleto.mvp.nombre}</span>
                        </div>
                      )}
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
            <RankingPoster
              titulo="⚽ Goleadores"
              statLabel="goles" statColor="#ffd54a"
              vacio="Sin goles aún"
              rows={goleadores.map(g => ({
                id: `${g.player_id}-${g.team_id}`,
                nombre: g.player_name,
                foto: g.photo_url,
                teamName: g.team_name,
                teamLogo: g.team_logo,
                valor: g.total_goals,
                sub: `${g.partidos_jugados} PJ${(g.total_yellow||0)>0?` · 🟨${g.total_yellow}`:''}${(g.total_blue||0)>0?` · 🟦${g.total_blue}`:''}${(g.total_red||0)>0?` · 🟥${g.total_red}`:''}`,
              }))}
            />

            {/* Valla menos vencida GLOBAL por equipo, con los arqueros
                registrados del equipo líder (fotos y nombres) */}
            <div style={{ marginTop: '16px' }}>
              <VallaEquipos rows={vallaEquiposRows}/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
