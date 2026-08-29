import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { ArrowLeft, Shield, X, ChevronDown } from 'lucide-react'
import RankingPoster from '../components/RankingPoster'
import TablaPosiciones from '../components/TablaPosiciones'
import VallaEquipos from '../components/VallaEquipos'
import { getPuntosTorneo } from '../lib/puntosTorneo'
import { fmtHoraDate } from '../lib/horaHelpers'

const TABS = [
  { id: 'posiciones', label: 'Posiciones' },
  { id: 'partidos',   label: 'Partidos'   },
  { id: 'goleadores', label: 'Goleadores' },
]

const MEDALLA = ['#f9a825', '#c9cdd2', '#cd7f32']

// Árbol de eliminatorias, en modo solo-lectura para el jugador — mismo orden
// de fases que usa el admin para armar el bracket.
const FASE_ORDEN_ELIM = ['octavos', 'cuartos', 'semifinal', 'final']
const FASE_LABEL_ELIM = { octavos: '⚔️ Octavos', cuartos: '🔥 Cuartos', semifinal: '⚡ Semifinal', final: '🏆 Final' }

function getRondaNombre(total) {
  if (total === 16) return 'Octavos de final'
  if (total === 8)  return 'Cuartos de final'
  if (total === 4 || total === 3) return 'Semifinal'
  if (total === 2)  return 'Final'
  return `Ronda de ${total}`
}
function getFaseValue(total) {
  if (total > 8) return 'octavos'
  if (total > 4) return 'cuartos'
  if (total > 2) return 'semifinal'
  return 'final'
}

// Título de tabla que se despliega al tocarlo: arranca cerrado mostrando
// solo el nombre, y al hacer click se amplía mostrando la tabla completa.
function TablaColapsable({ titulo, rows, miEquipoId, defaultOpen = false, onClickEquipo }) {
  const [abierto, setAbierto] = useState(defaultOpen)
  return (
    <div>
      <button onClick={() => setAbierto(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          background: 'linear-gradient(170deg,#0e2258,#08122e)', border: '1px solid #1e3a7a', borderRadius: '14px',
          padding: '14px 16px', cursor: 'pointer', boxShadow: '0 3px 14px rgba(0,0,0,.3)',
        }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: '.88rem', letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'left' }}>{titulo}</span>
        <ChevronDown size={18} color="#7fb3ff" style={{ flexShrink: 0, transition: 'transform .15s', transform: abierto ? 'rotate(180deg)' : 'none' }}/>
      </button>
      {abierto && (
        <div style={{ marginTop: '8px' }}>
          <TablaPosiciones rows={rows} miEquipoId={miEquipoId} onClickEquipo={onClickEquipo}/>
        </div>
      )}
    </div>
  )
}

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
  const { team, jugadores, loading, stats } = rosterModal
  const infoTeam = [team.city, team.categoria, team.modalidad, team.genero].filter(Boolean).join(' · ')
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {team.logo_url ? <img src={team.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={16} color="#9aa0a6"/>}
            </div>
            <div>
              <div style={{ fontWeight: '800', color: '#202124', fontSize: '1.05rem', lineHeight: 1.2 }}>{team.name}</div>
              {infoTeam && <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>{infoTeam}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#5f6368', fontSize: '1rem', fontWeight: '700', flexShrink: 0 }}>✕</button>
        </div>

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', margin: '14px 0', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 6px' }}>
            {[['PJ', stats.pj], ['PG', stats.pg], ['PE', stats.pe], ['PP', stats.pp], ['GF', stats.gf], ['GC', stats.gc], ['PTS', stats.pts]].map(([label, val]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: '900', color: label === 'PTS' ? '#1a73e8' : '#202124', fontSize: '.9rem' }}>{val ?? 0}</div>
                <div style={{ fontSize: '.6rem', color: '#9aa0a6', fontWeight: '700', letterSpacing: '.04em', marginTop: '1px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '18px', lineHeight: 1.5 }}>
          Jugadores registrados de <b>{team.name}</b> en <b>{torneoNombre}</b>.
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Cargando jugadores...</div>
        ) : jugadores.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Este equipo aún no tiene jugadores registrados en este torneo</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '16px' }}>
            {jugadores.map(j => {
              const tieneTag = !!(j.es_elite || j.es_profesional || j.es_mayor_35 || j.etiqueta_personalizada)
              return (
              <div key={j.id} style={{ textAlign: 'center' }}>
                {/* Aro de color tipo "historia de Instagram" para resaltar de un
                    vistazo a los jugadores con alguna etiqueta */}
                <div style={{ width: '92px', height: '92px', borderRadius: '50%', margin: '0 auto', padding: tieneTag ? '3px' : '0',
                  background: tieneTag ? 'linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)' : 'transparent' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f1f3f4', border: tieneTag ? '3px solid #fff' : '2px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(j.photo_face_url || j.photo_url)
                      ? <img src={j.photo_face_url || j.photo_url} alt={j.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <span style={{ fontSize: '2rem' }}>👤</span>}
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontWeight: '700', color: '#202124', fontSize: '.82rem', lineHeight: 1.25 }}>{j.name}</div>
                {tieneTag && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '5px', alignItems: 'center' }}>
                    {j.es_elite && <span style={{ fontSize: '.62rem', color: '#1a1305', background: '#f5c542', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>💎 Élite</span>}
                    {j.es_profesional && <span style={{ fontSize: '.62rem', color: '#fff', background: '#7b3ff2', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>🎓 Profesional</span>}
                    {j.es_mayor_35 && <span style={{ fontSize: '.62rem', color: '#202124', background: '#f1f3f4', borderRadius: '8px', padding: '1px 7px', fontWeight: '700' }}>🕒 Mayor de 35</span>}
                    {j.etiqueta_personalizada && <span style={{ fontSize: '.62rem', color: '#fff', background: '#5b9dff', borderRadius: '8px', padding: '1px 7px', fontWeight: '800' }}>⭐ {j.etiqueta_personalizada}</span>}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlayerTorneoPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user }  = useAuthStore() // ya validado por PlayerRoute — evita otra ida y vuelta al login

  const [torneo,         setTorneo]         = useState(null)
  const [equipos,        setEquipos]        = useState([])
  const [partidos,       setPartidos]       = useState([])
  const [grupos,         setGrupos]         = useState([])
  const [grupoEquipos,   setGrupoEquipos]   = useState([])
  const [bracket,        setBracket]        = useState([]) // partidos de eliminatorias (todas las fases, no solo la actual)
  const [goleadores,     setGoleadores]     = useState([])
  const [miHistorial,    setMiHistorial]    = useState([])
  const [loading,        setLoading]        = useState(true)
  const [tab,            setTab]            = useState('posiciones')
  const [subTabPart,     setSubTabPart]     = useState('todos')
  const [filtroTodos,    setFiltroTodos]    = useState('proximos') // 'proximos' | 'jugados'
  const [filtroMios,     setFiltroMios]     = useState('proximos') // 'proximos' | 'jugados'
  const [miEquipoId,     setMiEquipoId]     = useState(null)
  const [playerId,       setPlayerId]       = useState(null)
  const [modalPartido,   setModalPartido]   = useState(null)
  const [vallas,         setVallas]         = useState({ opcion1: [], opcion2: [] })
  const [modoValla,      setModoValla]      = useState('opcion1')
  const [arquerosEquipos, setArquerosEquipos] = useState([]) // arqueros registrados por equipo
  const [rosterModal, setRosterModal] = useState(null) // { team, jugadores, loading } — ficha de fotos del equipo

  useEffect(() => { fetchTodo() }, [id])

  // Ya pasamos a eliminatorias directas (hay árbol real) → los grupos dejan de
  // ser lo relevante, así que si el jugador estaba viendo "Posiciones" (que ya
  // no va a estar en las pestañas) lo pasamos solo a "Llaves".
  useEffect(() => {
    if (bracket.length > 0 && tab === 'posiciones') setTab('llaves')
  }, [bracket.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // En vivo: cuando alguien (árbitro/admin) registra o edita un resultado de
  // este torneo, Supabase avisa por websocket y refrescamos partidos + árbol
  // de eliminatorias + goleadores solos, sin que el jugador tenga que recargar
  // la página. Debounce corto para no disparar 3 refetch seguidos si llegan
  // varios cambios juntos (ej. guardar varios goles de una planilla).
  const refetchTimer = useRef(null)
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`jugador-torneo-${id}-matches`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` }, () => {
        clearTimeout(refetchTimer.current)
        refetchTimer.current = setTimeout(() => {
          fetchPartidos(); fetchBracket(); fetchGoleadores()
        }, 600)
      })
      .subscribe()
    return () => { clearTimeout(refetchTimer.current); supabase.removeChannel(channel) }
  }, [id])

  async function abrirRoster(team, stats) {
    if (!team?.id) return
    setRosterModal({ team, jugadores: [], loading: true, stats })
    const { data } = await supabase
      .from('tournament_player_registrations')
      .select('players(id, name, photo_url, photo_face_url, es_elite, es_profesional, es_mayor_35, etiqueta_personalizada)')
      .eq('tournament_id', id)
      .eq('team_id', team.id)
      .eq('activo', true)
    const jugadores = (data || []).map(r => r.players).filter(Boolean).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setRosterModal({ team, jugadores, loading: false, stats })
  }

  // Al tocar un equipo en la tabla de posiciones: misma ficha de siempre,
  // pero con sus estadísticas del torneo (PJ/PG/PE/PP/GF/GC/PTS).
  function abrirEquipoInfo(row) {
    abrirRoster(row.equipo, { pj: row.pj, pg: row.pg, pe: row.pe, pp: row.pp, gf: row.gf, gc: row.gc, pts: row.pts })
  }

  async function fetchTodo() {
    setLoading(true)

    // Los datos del torneo (equipos, partidos, goleadores, grupos) no dependen
    // de quién sos, así que arrancan ya mismo en paralelo con la identificación
    // del jugador, en vez de esperarla como antes. Antes esto era 100%
    // secuencial (login → jugador → equipo → historial → recién ahí el
    // torneo), por eso tardaba tanto en entrar.
    const pTorneo = Promise.all([fetchTorneo(), fetchEquipos(), fetchPartidos(), fetchGoleadores(), fetchGrupos(), fetchBracket()])

    const pMio = (async () => {
      // PlayerRoute ya garantiza que hay usuario logueado antes de mostrar esta
      // página, así que usamos el user del store en vez de volver a pedirlo a
      // Supabase (esa llamada era un viaje extra a internet en cada entrada).
      if (!user) return
      const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
      if (!player) return
      setPlayerId(player.id)

      const [{ data: reg }, { data: hist }] = await Promise.all([
        supabase
          .from('tournament_player_registrations')
          .select('team_id').eq('tournament_id', id).eq('player_id', player.id).single(),
        supabase
          .from('player_match_stats')
          .select('*, matches(id, played_at, home_score, away_score, matchday, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url))')
          .eq('player_id', player.id)
          .eq('tournament_id', id) // antes traía TODO el historial del jugador en todos los torneos
          .order('created_at', { ascending: false }),
      ])
      if (reg) setMiEquipoId(reg.team_id)
      setMiHistorial(hist || [])
    })()

    await Promise.all([pTorneo, pMio])
    setLoading(false)
  }

  async function fetchGrupos() {
    const { data: grps } = await supabase.from('tournament_grupos').select('*').eq('tournament_id', id).order('orden')
    setGrupos(grps || [])
    if (grps && grps.length > 0) {
      const { data: ge } = await supabase.from('grupo_equipos').select('*, teams(id,name,logo_url)').in('grupo_id', grps.map(g => g.id))
      setGrupoEquipos(ge || [])
    }
  }

  // Todos los partidos de eliminatorias (todas las fases, jugadas o no) para
  // poder armar el árbol completo — no solo la ronda actual.
  async function fetchBracket() {
    const { data } = await supabase
      .from('matches')
      .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .eq('tournament_id', id)
      .neq('fase', 'grupo')
      .order('ronda').order('played_at', { ascending: true })
    setBracket(data || [])
  }

  // Agrupa los partidos del bracket en llaves por fase, con marcador global y ganador
  function getLlavesPorFaseElim() {
    const porFase = {}
    FASE_ORDEN_ELIM.forEach(f => {
      const ms = bracket.filter(p => p.fase === f)
      if (ms.length === 0) return
      const map = {}
      ms.forEach(m => {
        const key = [m.home_team_id, m.away_team_id].sort().join('|')
        if (!map[key]) map[key] = []
        map[key].push(m)
      })
      porFase[f] = Object.values(map).map(matches => {
        const primero = matches[0]
        const teamA = { id: primero.home_team_id, name: primero.home?.name, logo_url: primero.home?.logo_url }
        const teamB = { id: primero.away_team_id, name: primero.away?.name, logo_url: primero.away?.logo_url }
        const terminada = matches.every(m => m.status === 'finished')
        let golesA = 0, golesB = 0
        matches.forEach(m => {
          if (m.status !== 'finished') return
          if (m.home_team_id === teamA.id) { golesA += m.home_score || 0; golesB += m.away_score || 0 }
          else                             { golesA += m.away_score || 0; golesB += m.home_score || 0 }
        })
        let ganador = null, porPenales = false
        if (terminada) {
          if (golesA > golesB) ganador = teamA
          else if (golesB > golesA) ganador = teamB
          else {
            const conPenales = [...matches].reverse().find(m => m.penales_ganador || (m.penales_local != null && m.penales_visitante != null && m.penales_local !== m.penales_visitante))
            if (conPenales) {
              porPenales = true
              const ganaHome = conPenales.penales_ganador ? conPenales.penales_ganador === 'home' : conPenales.penales_local > conPenales.penales_visitante
              const idGanador = ganaHome ? conPenales.home_team_id : conPenales.away_team_id
              ganador = idGanador === teamA.id ? teamA : teamB
            }
          }
        }
        return { matches, teamA, teamB, golesA, golesB, terminada, ganador, porPenales, slotIndex: primero.slot_index }
      })
      // Mismo orden de casillas que usa el admin (0, 1, 2...) — así la
      // llave i de esta fase siempre corresponde a ganador(2i) vs
      // ganador(2i+1) de la fase anterior. Los partidos viejos sin
      // slot_index (de antes de este cambio) quedan al final.
      porFase[f].sort((a, b) => (a.slotIndex ?? 999) - (b.slotIndex ?? 999))
    })
    return porFase
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
    // Estas tres consultas son independientes entre sí, así que salen todas
    // juntas en vez de una atrás de la otra.
    const [{ data }, { data: statsPorteros }, { data: tt }] = await Promise.all([
      supabase
        .from('goleadores_por_torneo').select('*')
        .eq('tournament_id', id).gt('total_goals', 0)
        .order('total_goals', { ascending: false }),
      // Valla menos vencida: todos los partidos de arqueros
      supabase
        .from('player_match_stats')
        .select('player_id, goals_conceded, team_id, players(name, photo_face_url, photo_url, posicion_futbol5, posicion_futbol7, posicion_futbol11), teams(name, logo_url)')
        .eq('tournament_id', id),
      // Arqueros REGISTRADOS de cada equipo del torneo (para la valla por equipo)
      supabase.from('tournament_teams').select('team_id').eq('tournament_id', id),
    ])
    setGoleadores(data || [])

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

  // Tabla general de "todos los equipos juntos": solo cuenta partidos de
  // fase de grupos (o sin fase, torneos sin llaves), igual que la
  // reclasificación que usa el admin — así no se mezclan los resultados
  // de eliminatorias directas.
  function getTablaGrupoPlayer(grupoId) {
    const P = getPuntosTorneo(torneo)
    const eqIds = grupoEquipos.filter(ge => ge.grupo_id === grupoId).map(ge => ge.team_id)
    const partGrupo = partidos.filter(p => (p.fase === 'grupo' || !p.fase) && eqIds.includes(p.home_team_id) && eqIds.includes(p.away_team_id))
    const t = {}
    eqIds.forEach(eid => {
      const eq = equipos.find(e => e.id === eid)
      if (eq) t[eid] = { equipo: eq, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }
    })
    partGrupo.filter(p => p.status === 'finished').forEach(p => {
      if (t[p.home_team_id]) {
        t[p.home_team_id].pj++; t[p.home_team_id].gf += p.home_score||0; t[p.home_team_id].gc += p.away_score||0
        if (p.home_score > p.away_score) { t[p.home_team_id].pg++; t[p.home_team_id].pts += P.victoria }
        else if (p.home_score === p.away_score) { t[p.home_team_id].pe++; t[p.home_team_id].pts += P.empate }
        else { t[p.home_team_id].pp++; t[p.home_team_id].pts += P.derrota }
      }
      if (t[p.away_team_id]) {
        t[p.away_team_id].pj++; t[p.away_team_id].gf += p.away_score||0; t[p.away_team_id].gc += p.home_score||0
        if (p.away_score > p.home_score) { t[p.away_team_id].pg++; t[p.away_team_id].pts += P.victoria }
        else if (p.away_score === p.home_score) { t[p.away_team_id].pe++; t[p.away_team_id].pts += P.empate }
        else { t[p.away_team_id].pp++; t[p.away_team_id].pts += P.derrota }
      }
    })
    return Object.values(t).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  }

  const puntosTabla = getPuntosTorneo(torneo)
  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidos.filter(p => p.status === 'finished' && (p.fase === 'grupo' || !p.fase)).forEach(p => {
    if (tabla[p.home_team_id]) {
      tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score||0; tabla[p.home_team_id].gc += p.away_score||0
      if (p.home_score > p.away_score) { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += puntosTabla.victoria }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += puntosTabla.empate }
      else { tabla[p.home_team_id].pp++; tabla[p.home_team_id].pts += puntosTabla.derrota }
    }
    if (tabla[p.away_team_id]) {
      tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score||0; tabla[p.away_team_id].gc += p.home_score||0
      if (p.away_score > p.home_score) { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += puntosTabla.victoria }
      else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += puntosTabla.empate }
      else { tabla[p.away_team_id].pp++; tabla[p.away_team_id].pts += puntosTabla.derrota }
    }
  })
  const tablaOrdenada      = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))

  // ── Proyección en vivo del árbol (antes de que el admin cree el bracket
  // real) — misma lógica que usa el admin para su "vista previa en vivo",
  // pero solo lectura: quiénes clasifican hoy según la tabla, y cómo
  // quedarían las llaves si la fase de grupos terminara ahora mismo.
  function getClasificadosPreview() {
    const clasificanPorGrupo = torneo?.equipos_clasifican || 2
    const clasificados = []
    for (const grupo of grupos) {
      const t = getTablaGrupoPlayer(grupo.id)
      t.slice(0, clasificanPorGrupo).forEach((row, pos) => {
        if (row.equipo) clasificados.push({ ...row.equipo, posicion: pos + 1, grupo: grupo.nombre, pts: row.pts, dg: row.gf - row.gc })
      })
    }
    return clasificados.sort((a, b) => a.posicion - b.posicion || b.pts - a.pts || b.dg - a.dg)
  }

  function getParticipantesElimPreview(n) {
    const directos = grupos.length > 0 ? getClasificadosPreview() : []
    let lista = [...directos]
    if (lista.length > n) lista = lista.slice(0, n)
    if (lista.length < n) {
      const idsYa = new Set(lista.map(e => e.id))
      tablaOrdenada.forEach(row => {
        if (lista.length >= n || !row.equipo || idsYa.has(row.equipo.id)) return
        lista.push({ ...row.equipo, posicion: 99, grupo: directos.length > 0 ? 'Mejor perdedor' : null, pts: row.pts, dg: row.gf - row.gc, mejorPerdedor: directos.length > 0 })
        idsYa.add(row.equipo.id)
      })
    }
    return lista
  }

  // Config guardada por el admin (cupos, estilo de llaves, cómo resolver
  // número impar, y orden movido a mano) — misma fuente de datos que usa el
  // admin, así el árbol le sale IGUAL al jugador que al admin.
  function getPreviewConfig() {
    const pc = torneo?.preview_config || {}
    return {
      numClasifElim: pc.numClasifElim || 8,
      estiloLlaves: pc.estiloLlaves || 'consecutivo',
      modoImpar: pc.modoImpar || 'mejor_perdedor',
      equipoByeId: pc.equipoByeId || null,
      previewOrden: pc.previewOrden || null,
    }
  }

  // Si el número de clasificados queda impar, según lo que haya elegido el
  // admin: o entra un mejor perdedor más para completar par, o un equipo
  // pasa directo a la siguiente ronda sin jugar esta (bye).
  function getParticipantesConImparPreview() {
    const { numClasifElim, modoImpar, equipoByeId } = getPreviewConfig()
    const base = getParticipantesElimPreview(numClasifElim)
    if (base.length < 2 || base.length % 2 === 0) return { participantes: base, byeTeam: null }
    if (modoImpar === 'mejor_perdedor') {
      return { participantes: getParticipantesElimPreview(numClasifElim + 1), byeTeam: null }
    }
    const idBye = equipoByeId && base.some(t => String(t.id) === String(equipoByeId)) ? equipoByeId : base[base.length - 1].id
    const byeTeam = base.find(t => String(t.id) === String(idBye))
    return { participantes: base.filter(t => String(t.id) !== String(idBye)), byeTeam }
  }

  function getParejasElimPreview() {
    const { estiloLlaves, previewOrden } = getPreviewConfig()
    if (estiloLlaves === 'manual') return { parejas: [], byeTeam: null } // sorteo físico: el admin todavía no armó el árbol real
    const { participantes, byeTeam } = getParticipantesConImparPreview()
    const mapaPreview = new Map(participantes.map(p => [String(p.id), p]))
    const idsOrden = previewOrden && previewOrden.length === participantes.length
      ? previewOrden.map(String)
      : participantes.map(p => String(p.id))
    const ordenPreview = idsOrden.map(id => mapaPreview.get(id)).filter(Boolean)
    const parejas = []
    const totalOrden = ordenPreview.length
    if (estiloLlaves === 'cruzado') {
      for (let i = 0; i < Math.floor(totalOrden / 2); i++) parejas.push([ordenPreview[i], ordenPreview[totalOrden - 1 - i]])
    } else {
      for (let i = 0; i < totalOrden - 1; i += 2) parejas.push([ordenPreview[i], ordenPreview[i + 1]])
    }
    return { parejas, byeTeam }
  }

  // Valla menos vencida GLOBAL por equipo: ranking por goles en contra, con
  // los arqueros registrados de cada equipo (fotos y nombres). A diferencia
  // de la tabla de posiciones (que en fase de grupos ya no cuenta partidos
  // de eliminación directa), acá los goles en contra deben seguir sumando
  // aunque el torneo ya esté en eliminatorias.
  const gcVallaTotal = {}, pjVallaTotal = {}
  partidos.filter(p => p.status === 'finished').forEach(p => {
    if (tabla[p.home_team_id]) { gcVallaTotal[p.home_team_id] = (gcVallaTotal[p.home_team_id] || 0) + (p.away_score || 0); pjVallaTotal[p.home_team_id] = (pjVallaTotal[p.home_team_id] || 0) + 1 }
    if (tabla[p.away_team_id]) { gcVallaTotal[p.away_team_id] = (gcVallaTotal[p.away_team_id] || 0) + (p.home_score || 0); pjVallaTotal[p.away_team_id] = (pjVallaTotal[p.away_team_id] || 0) + 1 }
  })
  const vallaEquiposRows = equipos
    .filter(e => pjVallaTotal[e.id] > 0)
    .map(e => ({
      equipo: e, gc: gcVallaTotal[e.id] || 0, pj: pjVallaTotal[e.id] || 0,
      arqueros: arquerosEquipos.filter(a => a.team_id === e.id),
    }))
    .sort((a, b) => a.gc - b.gc || b.pj - a.pj)
  const partidosJugados    = partidos.filter(p => p.status === 'finished')
  // "partidos" viene ordenado del más reciente al más antiguo (para que
  // Resultados muestre el último jugado primero). Los próximos necesitan el
  // orden inverso: el que se juega más pronto arriba. Los que aún no tienen
  // fecha definida van al final.
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')
    .sort((a, b) => {
      if (!a.played_at && !b.played_at) return 0
      if (!a.played_at) return 1
      if (!b.played_at) return -1
      return new Date(a.played_at) - new Date(b.played_at)
    })
  const misPartidosProximos = miEquipoId ? partidosPendientes.filter(p => p.home?.id === miEquipoId || p.away?.id === miEquipoId) : []
  const idsPartidosTorneo  = new Set(partidos.map(p => p.id))
  const miHistorialTorneo  = miHistorial.filter(h => h.matches?.id && idsPartidosTorneo.has(h.matches.id))
  // Mis stats de ESTE torneo únicamente — separado del acumulado global que
  // se ve en el historial general del jugador.
  const misStatsTorneo = miHistorialTorneo.reduce((acc, h) => ({
    pj:        acc.pj + 1,
    goles:     acc.goles     + (h.goals_scored   || 0),
    amarillas: acc.amarillas + (h.yellow_cards   || 0),
    azules:    acc.azules    + (h.blue_cards     || 0),
    rojas:     acc.rojas     + (h.red_cards      || 0),
    recibidos: acc.recibidos + (h.goals_conceded || 0),
  }), { pj: 0, goles: 0, amarillas: 0, azules: 0, rojas: 0, recibidos: 0 })

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

      {/* Tabs — "Llaves" aparece si ya hay árbol real, o si hay suficientes
          equipos/grupos como para armar al menos una proyección en vivo.
          "Posiciones" (grupos) se quita apenas arranca la fase de
          eliminatorias directas — ya no aplica, lo que importa es el árbol. */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', padding: '0 16px', overflowX: 'auto' }}>
        {(bracket.length > 0
          ? [...TABS.filter(t => t.id !== 'posiciones'), { id: 'llaves', label: '🏆 Llaves' }]
          : (grupos.length > 0 || equipos.length >= 2) ? [...TABS, { id: 'llaves', label: '🏆 Llaves' }] : TABS
        ).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: tab === t.id ? '600' : '400', color: tab === t.id ? '#1a73e8' : '#5f6368', borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent', transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto' }}>

        {/* ── POSICIONES ── */}
        {tab === 'posiciones' && (
          <div>
            {grupos.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {grupos.map(g => (
                  <TablaColapsable key={g.id} titulo={`Grupo ${g.nombre}`} rows={getTablaGrupoPlayer(g.id)} miEquipoId={miEquipoId} onClickEquipo={abrirEquipoInfo}/>
                ))}
                <TablaColapsable titulo="Tabla general — todos los equipos" rows={tablaOrdenada} miEquipoId={miEquipoId} onClickEquipo={abrirEquipoInfo}/>
              </div>
            ) : (
              <TablaPosiciones titulo="Tabla de posiciones" rows={tablaOrdenada} miEquipoId={miEquipoId} onClickEquipo={abrirEquipoInfo}/>
            )}
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

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setFiltroTodos('proximos')}
                    style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${filtroTodos === 'proximos' ? '#e8710a' : '#dadce0'}`, background: filtroTodos === 'proximos' ? '#e8710a' : '#fff', color: filtroTodos === 'proximos' ? '#fff' : '#5f6368', fontSize: '.74rem', fontWeight: filtroTodos === 'proximos' ? '600' : '400', cursor: 'pointer' }}>
                    Próximos ({partidosPendientes.length})
                  </button>
                  <button onClick={() => setFiltroTodos('jugados')}
                    style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${filtroTodos === 'jugados' ? '#1e8e3e' : '#dadce0'}`, background: filtroTodos === 'jugados' ? '#1e8e3e' : '#fff', color: filtroTodos === 'jugados' ? '#fff' : '#5f6368', fontSize: '.74rem', fontWeight: filtroTodos === 'jugados' ? '600' : '400', cursor: 'pointer' }}>
                    Jugados ({partidosJugados.length})
                  </button>
                </div>

                {/* Próximos */}
                {filtroTodos === 'proximos' && partidosPendientes.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e8710a', display: 'inline-block' }}/>
                      Próximos partidos
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {partidosPendientes.map((p) => {
                        const esMiPartido = p.home?.id === miEquipoId || p.away?.id === miEquipoId
                        return (
                          <div key={p.id}
                            style={{
                              background: esMiPartido ? 'linear-gradient(135deg, #fff8ef, #fff)' : '#fff',
                              border: esMiPartido ? '1.5px solid #e8710a' : '1px solid #e8eaed',
                              borderRadius: '16px', overflow: 'hidden',
                              boxShadow: esMiPartido ? '0 3px 12px rgba(232,113,10,.15)' : '0 1px 4px rgba(0,0,0,.06)',
                            }}>
                            {(p.matchday || p.grupo) && (
                              <div style={{ display: 'flex', gap: '6px', padding: '8px 12px 0' }}>
                                {p.matchday && <span style={{ fontSize: '.62rem', fontWeight: '700', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 8px' }}>Fecha {p.matchday}</span>}
                                {p.grupo && <span style={{ fontSize: '.62rem', fontWeight: '700', color: '#9955ff', background: '#f3e8fd', borderRadius: '20px', padding: '2px 8px' }}>{p.grupo}</span>}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px' }}>
                              <div onClick={() => abrirRoster(p.home)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', minWidth: 0 }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, background: p.home?.id === miEquipoId ? '#fff4e5' : '#f8f9fa', borderRadius: '9px', padding: '7px 9px' }}>
                                  <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name}</div>
                                </div>
                              </div>
                              <div style={{ fontWeight: '900', fontSize: '.68rem', color: '#fff', background: '#1a73e8', padding: '7px 10px', borderRadius: '8px', flexShrink: 0, boxShadow: '0 2px 6px rgba(26,115,232,.35)', letterSpacing: '.5px' }}>VS</div>
                              <div onClick={() => abrirRoster(p.away)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', minWidth: 0, flexDirection: 'row-reverse' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, background: p.away?.id === miEquipoId ? '#fff4e5' : '#f8f9fa', borderRadius: '9px', padding: '7px 9px', textAlign: 'right' }}>
                                  <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name}</div>
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', paddingBottom: '12px' }}>
                              {p.played_at ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '.66rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.4px', textTransform: 'uppercase', background: '#f1f3f4', padding: '5px 14px', borderRadius: '20px' }}>
                                  📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })} · 🕐 {fmtHoraDate(p.played_at)}
                                  {p.location && ` · 📍 ${p.location}`}
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '.66rem', fontWeight: '700', color: '#9aa0a6', letterSpacing: '.4px', textTransform: 'uppercase', background: '#f1f3f4', padding: '5px 14px', borderRadius: '20px' }}>
                                  📅 Fecha por definir
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Resultados — clickeables */}
                {filtroTodos === 'jugados' && partidosJugados.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1e8e3e', display: 'inline-block' }}/>
                      Resultados <span style={{ fontWeight: '400', color: '#9aa0a6', fontSize: '.7rem' }}>· toca para ver detalles</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {partidosJugados.map((p) => {
                        const esMiPartido = p.home?.id === miEquipoId || p.away?.id === miEquipoId
                        const gane   = miEquipoId && ((p.home?.id === miEquipoId && p.home_score > p.away_score) || (p.away?.id === miEquipoId && p.away_score > p.home_score))
                        const empate = esMiPartido && p.home_score === p.away_score
                        const perdi  = esMiPartido && !gane && !empate
                        const resultColor = gane ? '#1e8e3e' : empate ? '#e8710a' : perdi ? '#d93025' : '#1a73e8'
                        const resultBg    = gane ? '#e6f4ea'  : empate ? '#fce8d9'  : perdi ? '#fce8e6'  : '#e8f0fe'
                        const resultLabel = gane ? 'G' : empate ? 'E' : perdi ? 'P' : ''
                        return (
                          <div key={p.id} onClick={() => setModalPartido(p)}
                            style={{
                              background: esMiPartido ? 'linear-gradient(135deg, #fff8ef, #fff)' : '#fff',
                              border: esMiPartido ? '1.5px solid #e8710a' : '1px solid #e8eaed',
                              borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
                              boxShadow: esMiPartido ? '0 3px 12px rgba(232,113,10,.15)' : '0 1px 4px rgba(0,0,0,.06)',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px 0' }}>
                              {esMiPartido && resultLabel && <span style={{ fontSize: '.65rem', fontWeight: '700', color: resultColor, background: resultBg, borderRadius: '4px', padding: '1px 6px' }}>{resultLabel}</span>}
                              {p.matchday && <span style={{ fontSize: '.62rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 8px', fontWeight: '700' }}>Fecha {p.matchday}</span>}
                              {p.grupo && <span style={{ fontSize: '.62rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '20px', padding: '2px 8px', fontWeight: '700' }}>{p.grupo}</span>}
                              <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: '#9aa0a6' }}>Ver detalles →</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
                              <div onClick={e => { e.stopPropagation(); abrirRoster(p.home) }}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', minWidth: 0 }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, background: p.home?.id === miEquipoId ? '#fff4e5' : '#f8f9fa', borderRadius: '9px', padding: '7px 9px' }}>
                                  <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name}</div>
                                </div>
                              </div>
                              <div style={{ fontWeight: '900', fontSize: '1.05rem', color: '#202124', background: '#fff', border: '1.5px solid #e8eaed', padding: '6px 12px', borderRadius: '10px', flexShrink: 0, minWidth: '58px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.08)' }}>
                                {p.home_score} - {p.away_score}
                              </div>
                              <div onClick={e => { e.stopPropagation(); abrirRoster(p.away) }}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', minWidth: 0, flexDirection: 'row-reverse' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, background: p.away?.id === miEquipoId ? '#fff4e5' : '#f8f9fa', borderRadius: '9px', padding: '7px 9px', textAlign: 'right' }}>
                                  <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name}</div>
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '.66rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.4px', textTransform: 'uppercase', background: '#f1f3f4', padding: '5px 14px', borderRadius: '20px' }}>
                                📅 {p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' }) : 'Fecha por definir'}
                              </span>
                            </div>
                            {p.mvp && (
                              <div style={{ margin: '0 14px 12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px', justifyContent: 'center' }}>
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
                {partidos.length > 0 && filtroTodos === 'proximos' && partidosPendientes.length === 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                    <div style={{ fontSize: '.875rem' }}>No hay próximos partidos programados</div>
                  </div>
                )}
                {partidos.length > 0 && filtroTodos === 'jugados' && partidosJugados.length === 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                    <div style={{ fontSize: '.875rem' }}>Todavía no se jugó ningún partido</div>
                  </div>
                )}
              </div>
            )}

            {/* Mis partidos */}
            {subTabPart === 'mios' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setFiltroMios('proximos')}
                    style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${filtroMios === 'proximos' ? '#e8710a' : '#dadce0'}`, background: filtroMios === 'proximos' ? '#e8710a' : '#fff', color: filtroMios === 'proximos' ? '#fff' : '#5f6368', fontSize: '.74rem', fontWeight: filtroMios === 'proximos' ? '600' : '400', cursor: 'pointer' }}>
                    Próximos ({misPartidosProximos.length})
                  </button>
                  <button onClick={() => setFiltroMios('jugados')}
                    style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${filtroMios === 'jugados' ? '#1e8e3e' : '#dadce0'}`, background: filtroMios === 'jugados' ? '#1e8e3e' : '#fff', color: filtroMios === 'jugados' ? '#fff' : '#5f6368', fontSize: '.74rem', fontWeight: filtroMios === 'jugados' ? '600' : '400', cursor: 'pointer' }}>
                    Jugados ({miHistorialTorneo.length})
                  </button>
                </div>

                {/* Próximos partidos de mi equipo */}
                {filtroMios === 'proximos' && (
                  misPartidosProximos.length === 0 ? (
                    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                      <div style={{ fontSize: '.875rem' }}>No tenés próximos partidos programados</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {misPartidosProximos.map((p) => (
                        <div key={p.id}
                          style={{ background: 'linear-gradient(135deg, #fff8ef, #fff)', border: '1.5px solid #e8710a', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 3px 12px rgba(232,113,10,.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                              </div>
                              <div style={{ flex: 1, minWidth: 0, background: p.home?.id === miEquipoId ? '#fff4e5' : '#f8f9fa', borderRadius: '9px', padding: '7px 9px' }}>
                                <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name}</div>
                              </div>
                            </div>
                            <div style={{ fontWeight: '900', fontSize: '.68rem', color: '#fff', background: '#1a73e8', padding: '7px 10px', borderRadius: '8px', flexShrink: 0, boxShadow: '0 2px 6px rgba(26,115,232,.35)', letterSpacing: '.5px' }}>VS</div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexDirection: 'row-reverse' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                              </div>
                              <div style={{ flex: 1, minWidth: 0, background: p.away?.id === miEquipoId ? '#fff4e5' : '#f8f9fa', borderRadius: '9px', padding: '7px 9px', textAlign: 'right' }}>
                                <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name}</div>
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', paddingBottom: '12px' }}>
                            {p.played_at ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '.66rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.4px', textTransform: 'uppercase', background: '#f1f3f4', padding: '5px 14px', borderRadius: '20px' }}>
                                📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })} · 🕐 {fmtHoraDate(p.played_at)}
                                {p.location && ` · 📍 ${p.location}`}
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '.66rem', fontWeight: '700', color: '#9aa0a6', letterSpacing: '.4px', textTransform: 'uppercase', background: '#f1f3f4', padding: '5px 14px', borderRadius: '20px' }}>
                                📅 Fecha por definir
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Jugados — historial con mis stats */}
                {filtroMios === 'jugados' && (
                  <>
                {miHistorialTorneo.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    {[
                      { label: 'PJ',        valor: misStatsTorneo.pj,        color: '#5f6368', bg: '#f1f3f4' },
                      { label: '⚽ Goles',   valor: misStatsTorneo.goles,     color: '#1e8e3e', bg: '#e6f4ea' },
                      { label: '🟨',         valor: misStatsTorneo.amarillas, color: '#e8710a', bg: '#fce8d9' },
                      { label: '🟦',         valor: misStatsTorneo.azules,    color: '#1a73e8', bg: '#e8f0fe' },
                      { label: '🟥',         valor: misStatsTorneo.rojas,     color: '#d93025', bg: '#fce8e6' },
                    ].filter(s => s.label === 'PJ' || s.valor > 0).map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: s.bg, border: '1px solid #e8eaed', borderRadius: '10px', padding: '6px 12px' }}>
                        <span style={{ fontSize: '.72rem', color: s.color, fontWeight: '600' }}>{s.label}</span>
                        <span style={{ fontSize: '.9rem', color: s.color, fontWeight: '800' }}>{s.valor}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: '.65rem', color: '#9aa0a6', alignSelf: 'center' }}>Solo de este torneo</div>
                  </div>
                )}
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
                      style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px 0' }}>
                        <span style={{ fontSize: '.65rem', fontWeight: '700', color: resColor, background: resBg, borderRadius: '4px', padding: '2px 7px' }}>{resLabel}</span>
                        {match.matchday && <span style={{ fontSize: '.62rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 8px', fontWeight: '700' }}>Fecha {match.matchday}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: '#9aa0a6' }}>Ver detalles →</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {match.home?.logo_url ? <img src={match.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, background: '#f8f9fa', borderRadius: '9px', padding: '7px 9px' }}>
                            <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.home?.name}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: '900', fontSize: '1.05rem', color: '#202124', background: '#fff', border: '1.5px solid #e8eaed', padding: '6px 12px', borderRadius: '10px', flexShrink: 0, minWidth: '58px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.08)' }}>
                          {match.home_score} - {match.away_score}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexDirection: 'row-reverse' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fff', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {match.away?.logo_url ? <img src={match.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={15} color="#9aa0a6"/>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, background: '#f8f9fa', borderRadius: '9px', padding: '7px 9px', textAlign: 'right' }}>
                            <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#202124', textTransform: 'uppercase', letterSpacing: '.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.away?.name}</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', paddingBottom: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '.66rem', fontWeight: '800', color: '#5f6368', letterSpacing: '.4px', textTransform: 'uppercase', background: '#f1f3f4', padding: '5px 14px', borderRadius: '20px' }}>
                          📅 {match.played_at ? new Date(match.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' }) : 'Fecha por definir'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 14px 12px', justifyContent: 'center' }}>
                        {(h.goals_scored  || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>⚽ {h.goals_scored} gol{h.goals_scored > 1 ? 'es' : ''}</span>}
                        {(h.yellow_cards  || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟨 Amarilla</span>}
                        {(h.blue_cards    || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟦 Azul</span>}
                        {(h.red_cards     || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#d93025', background: '#fce8e6', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟥 Roja</span>}
                        {(h.goals_conceded|| 0) > 0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>🧤 {h.goals_conceded} recibido{h.goals_conceded > 1 ? 's' : ''}</span>}
                        {(h.fouls         || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>✋ {h.fouls} falta{h.fouls > 1 ? 's' : ''}</span>}
                        {(h.goals_scored||0)===0 && (h.yellow_cards||0)===0 && (h.blue_cards||0)===0 && (h.red_cards||0)===0 && (h.fouls||0)===0 && (h.goals_conceded||0)===0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Sin incidencias</span>}
                      </div>
                      {partidoCompleto?.mvp && (
                        <div style={{ margin: '0 14px 12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px', justifyContent: 'center' }}>
                          <span style={{ fontSize: '.68rem', color: '#e8710a', fontWeight: '700' }}>⭐ MVP: {partidoCompleto.mvp.nombre}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
                  </>
                )}
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

        {/* ── LLAVES: proyección en vivo, mientras no exista el árbol real ── */}
        {tab === 'llaves' && bracket.length === 0 && (() => {
          const { parejas: parejasPreview, byeTeam: byeInicialPreview } = getParejasElimPreview()
          if (parejasPreview.length === 0 && !byeInicialPreview) return null

          // Columnas del árbol: la ronda proyectada + siguientes rondas como
          // placeholders "Por definir" hasta el campeón — se recalcula solo
          // con cada resultado que se registre en la fase de grupos.
          const columnasPreview = []
          let llavesRonda = parejasPreview.map(([a, b]) => ({ a, b }))
          let totalRonda = parejasPreview.length * 2 + (byeInicialPreview ? 1 : 0)
          while (true) {
            columnasPreview.push({ total: totalRonda, fase: getFaseValue(totalRonda), llaves: llavesRonda })
            if (llavesRonda.length <= 1) break
            const siguienteN = Math.max(Math.floor(llavesRonda.length / 2), 1)
            llavesRonda = Array.from({ length: siguienteN }, () => null)
            totalRonda = Math.max(Math.floor(totalRonda / 2), 2)
          }

          const clasificanPorGrupo = torneo?.equipos_clasifican || 2
          const calendarioPreview = torneo?.preview_calendario || {}

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.66rem', fontWeight: '800', color: '#d93025', background: '#fce8e6', borderRadius: '20px', padding: '3px 10px', letterSpacing: '.04em' }}>
                  <span className="gm-casi" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d93025', display: 'inline-block' }}/>
                  EN VIVO
                </span>
                <span style={{ fontSize: '.72rem', fontWeight: '700', color: '#202124' }}>Vista previa</span>
              </div>
              <div style={{ fontSize: '.75rem', color: '#5f6368', marginBottom: '14px' }}>
                Así quedaría el árbol si la fase de grupos terminara ahora mismo ({grupos.length > 0 ? `clasifican ${clasificanPorGrupo} por grupo` : `clasifican ${parejasPreview.length * 2}`}) — se va actualizando solo con cada resultado. Todavía no es el árbol oficial: eso lo arma el admin cuando termine la fase de grupos.
              </div>
              {byeInicialPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 12px', background: '#e6f4ea', border: '1px solid #a8dab5', borderRadius: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {byeInicialPreview.logo_url ? <img src={byeInicialPreview.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                  </div>
                  <span style={{ fontSize: '.76rem', fontWeight: '700', color: '#1e8e3e' }}>⏭️ {byeInicialPreview.name} pasa directo a la siguiente ronda sin jugar (número impar de clasificados)</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'stretch' }}>
                {columnasPreview.map((col, ci) => (
                  <div key={ci} style={{ minWidth: '200px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#e8710a', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                      {getRondaNombre(col.total).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: '10px' }}>
                      {col.llaves.map((ll, i) => ll ? (
                        <div key={i} style={{ background: '#fffaf3', border: '1.5px dashed #e8710a', borderLeft: '4px dashed #e8710a', borderRadius: '10px', overflow: 'hidden' }}>
                          {[ll.a, ll.b].map((eq, ti) => {
                            const esMiEquipo = miEquipoId && eq?.id === miEquipoId
                            return (
                              <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderBottom: ti === 0 ? '1px solid #f1e0c8' : 'none', outline: esMiEquipo ? '2px solid #1a73e8' : 'none', outlineOffset: '-2px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {eq?.logo_url ? <img src={eq.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '.76rem', fontWeight: '600', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq?.name || '— por definir —'}</div>
                                  {eq?.grupo && <div style={{ fontSize: '.6rem', color: '#9aa0a6' }}>{eq.grupo}</div>}
                                </div>
                                {eq?.posicion && <span style={{ fontSize: '.62rem', color: eq.mejorPerdedor ? '#e8710a' : '#9aa0a6', fontWeight: '700', flexShrink: 0 }}>{eq.mejorPerdedor ? '🎟️' : `#${eq.posicion}`}</span>}
                              </div>
                            )
                          })}
                          <div style={{ padding: '5px 10px', background: '#f8f9fa', fontSize: '.62rem', color: '#9aa0a6' }}>
                            {(() => {
                              const c = calendarioPreview?.[col.fase]?.[i]
                              if (!c?.fecha || !c?.hora) return '📅 Por definir'
                              const d = new Date(`${c.fecha}T${c.hora}:00`)
                              if (isNaN(d.getTime())) return '📅 Por definir'
                              return `📅 ${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · ${fmtHoraDate(d)}`
                            })()}
                          </div>
                        </div>
                      ) : (() => {
                        const c = calendarioPreview?.[col.fase]?.[i]
                        const hayFecha = c?.fecha && c?.hora
                        let textoFecha = 'Por definir'
                        if (hayFecha) {
                          const d = new Date(`${c.fecha}T${c.hora}:00`)
                          if (!isNaN(d.getTime())) textoFecha = `📅 ${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · ${fmtHoraDate(d)}`
                        }
                        return (
                          <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#9aa0a6', fontSize: '.7rem', fontWeight: '600', background: '#f1f3f4' }}>
                            <div>Por definir</div>
                            {hayFecha && <div style={{ marginTop: '4px', fontSize: '.64rem', fontWeight: '600', color: '#9aa0a6' }}>{textoFecha}</div>}
                          </div>
                        )
                      })())}
                    </div>
                  </div>
                ))}
                <div style={{ minWidth: '140px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#f9a825', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff8e1', borderRadius: '8px', padding: '6px' }}>
                    🏆 CAMPEÓN
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '100%', border: '2px dashed #ffd66b', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#e8b93a', fontSize: '.7rem', fontWeight: '700', background: '#fffaf0' }}>
                      Por definir
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── LLAVES (árbol de eliminatorias real, solo lectura) ── */}
        {tab === 'llaves' && bracket.length > 0 && (() => {
          const porFase = getLlavesPorFaseElim()
          const fasesExist = FASE_ORDEN_ELIM.filter(f => porFase[f])
          if (fasesExist.length === 0) return null

          const llaveFinal = porFase['final']?.find(l => !(l.matches[0].ronda || '').toLowerCase().includes('tercer'))
          const campeon = llaveFinal?.ganador || null
          const subcampeon = campeon ? (llaveFinal.ganador.id === llaveFinal.teamA.id ? llaveFinal.teamB : llaveFinal.teamA) : null
          const llaveTercer = porFase['final']?.find(l => (l.matches[0].ronda || '').toLowerCase().includes('tercer'))
          const tercerPuestoEq = llaveTercer?.ganador || null

          // Columnas del árbol: fases jugadas + placeholders "por definir", siempre hasta la final
          const columnas = []
          let n = porFase[fasesExist[0]].length
          let ultimaLlavesReales = null
          for (let idx = FASE_ORDEN_ELIM.indexOf(fasesExist[0]); idx < FASE_ORDEN_ELIM.length; idx++) {
            const f = FASE_ORDEN_ELIM[idx]
            if (porFase[f]) {
              columnas.push({ fase: f, llaves: porFase[f] })
              n = porFase[f].length
              ultimaLlavesReales = porFase[f]
            } else {
              n = Math.max(Math.floor(n / 2), 1)
              columnas.push({ fase: f, llaves: Array.from({ length: n }, () => null), feeder: ultimaLlavesReales })
              ultimaLlavesReales = null
            }
          }

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.66rem', fontWeight: '800', color: '#d93025', background: '#fce8e6', borderRadius: '20px', padding: '3px 10px', letterSpacing: '.04em' }}>
                  <span className="gm-casi" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d93025', display: 'inline-block' }}/>
                  EN VIVO
                </span>
                <span style={{ fontSize: '.75rem', color: '#5f6368' }}>
                  Así va el árbol — se actualiza solo apenas se registra un resultado.
                </span>
              </div>

              {/* Campeón */}
              {campeon && (
                <div style={{ background: 'linear-gradient(135deg, #fff8e1, #ffecb3)', border: '2px solid #f9a825', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.8rem' }}>🏆</span>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#fff', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {campeon.logo_url ? <img src={campeon.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={18} color="#9aa0a6"/>}
                    </div>
                    <div>
                      <div style={{ fontSize: '.65rem', fontWeight: '800', color: '#e8710a', letterSpacing: '2px' }}>CAMPEÓN DEL TORNEO</div>
                      <div style={{ fontWeight: '900', color: '#202124', fontSize: '1.05rem' }}>{campeon.name}</div>
                    </div>
                  </div>
                  {(subcampeon || tercerPuestoEq) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      {subcampeon && <span style={{ fontSize: '.76rem', color: '#5f6368', fontWeight: '600' }}>🥈 Subcampeón: {subcampeon.name}</span>}
                      {tercerPuestoEq && <span style={{ fontSize: '.76rem', color: '#5f6368', fontWeight: '600' }}>🥉 Tercer puesto: {tercerPuestoEq.name}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Árbol */}
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'stretch' }}>
                {columnas.map(col => (
                  <div key={col.fase} style={{ minWidth: '210px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#e8710a', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                      {FASE_LABEL_ELIM[col.fase].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: '10px' }}>
                      {col.llaves.map((ll, i) => ll ? (
                        <div key={i}
                          style={{ background: '#fff', border: '1.5px solid #c4c9d0', borderLeft: '4px solid #e8710a', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
                          {(ll.matches[0].ronda || '').toLowerCase().includes('repechaje') && (
                            <div style={{ padding: '3px 12px', background: '#f3e8fd', fontSize: '.6rem', fontWeight: '800', color: '#9955ff', letterSpacing: '1px' }}>🔁 REPECHAJE</div>
                          )}
                          {(ll.matches[0].ronda || '').toLowerCase().includes('tercer') && (
                            <div style={{ padding: '3px 12px', background: '#fff4e5', fontSize: '.6rem', fontWeight: '800', color: '#cd7f32', letterSpacing: '1px' }}>🥉 TERCER PUESTO</div>
                          )}
                          {[{ team: ll.teamA, goles: ll.golesA }, { team: ll.teamB, goles: ll.golesB }].map(({ team, goles }, ti) => {
                            const esGanador  = ll.ganador?.id === team.id
                            const esMiEquipo = miEquipoId && team.id === miEquipoId
                            const esPerdedor = ll.terminada && ll.ganador && !esGanador
                            return (
                              <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', background: esGanador ? '#e6f4ea' : ti === 1 ? '#f8f9fa' : '#fff', opacity: esPerdedor ? .45 : 1, borderBottom: ti === 0 ? '2px solid #dadce0' : 'none', outline: esMiEquipo ? '2px solid #1a73e8' : 'none', outlineOffset: '-2px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0, background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {team.logo_url ? <img src={team.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                                </div>
                                <span style={{ flex: 1, fontWeight: esGanador ? '800' : '500', color: '#202124', fontSize: '.76rem', textDecoration: esPerdedor ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
                                <span style={{ fontWeight: '900', fontSize: '.9rem', color: esGanador ? '#1e8e3e' : '#9aa0a6', flexShrink: 0 }}>
                                  {ll.matches.some(m => m.status === 'finished') ? goles : '—'}
                                </span>
                                {esGanador && <span style={{ fontSize: '.7rem', flexShrink: 0 }}>✓</span>}
                              </div>
                            )
                          })}
                          <div style={{ padding: '5px 10px', background: '#f8f9fa', fontSize: '.62rem', color: ll.terminada && !ll.ganador ? '#d93025' : '#9aa0a6', fontWeight: ll.terminada && !ll.ganador ? '700' : '400' }}>
                            {!ll.terminada
                              ? `${ll.matches.length > 1 ? 'Ida y vuelta · ' : ''}${ll.matches[0].played_at ? new Date(ll.matches[0].played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' · ' + fmtHoraDate(ll.matches[0].played_at) : '📅 Por definir'}`
                              : !ll.ganador
                                ? '⚠️ Empate — pendiente de penales'
                                : `${ll.matches.length > 1 ? `Global ${ll.golesA}-${ll.golesB}` : 'Jugado'}${ll.porPenales ? ' · Penales' : ''}`}
                          </div>
                        </div>
                      ) : (() => {
                        const feederA = col.feeder?.[i * 2], feederB = col.feeder?.[i * 2 + 1]
                        const conocidoA = feederA?.terminada && feederA?.ganador ? feederA.ganador : null
                        const conocidoB = feederB?.terminada && feederB?.ganador ? feederB.ganador : null
                        const hayConocido = conocidoA || conocidoB
                        return (
                          <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#9aa0a6', fontSize: '.7rem', fontWeight: '600', background: '#f1f3f4' }}>
                            {hayConocido ? (
                              [conocidoA, conocidoB].map((t, ti) => (
                                <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 2px', justifyContent: 'center' }}>
                                  {t ? (
                                    <>
                                      <div style={{ width: '18px', height: '18px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#fff' }}>
                                        {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={10} color="#9aa0a6"/>}
                                      </div>
                                      <span style={{ fontSize: '.74rem', fontWeight: '800', color: '#1e8e3e' }}>{t.name} ✓</span>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: '.66rem', color: '#9aa0a6', fontStyle: 'italic' }}>rival por definir</span>
                                  )}
                                </div>
                              ))
                            ) : 'Por definir'}
                          </div>
                        )
                      })())}
                    </div>
                  </div>
                ))}

                {/* Columna campeón */}
                <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#f9a825', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff8e1', borderRadius: '8px', padding: '6px' }}>
                    🏆 CAMPEÓN
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    {campeon ? (
                      <div style={{ width: '100%', background: 'linear-gradient(135deg, #fff8e1, #ffecb3)', border: '2px solid #f9a825', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', overflow: 'hidden', margin: '0 auto 6px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {campeon.logo_url ? <img src={campeon.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <Shield size={16} color="#9aa0a6"/>}
                        </div>
                        <div style={{ fontWeight: '900', color: '#202124', fontSize: '.78rem' }}>{campeon.name}</div>
                      </div>
                    ) : (
                      <div style={{ width: '100%', border: '1px dashed #f9a825', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#f9a825', fontSize: '.68rem', background: '#fffdf5' }}>
                        Por definir
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
