import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Users, Target, Radio, Building2, GraduationCap, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { derivarEnVivo } from '../lib/liveMatch'
import { registrarVisita } from '../lib/visitas'

// Misma paleta oscura que usa el resto de la plataforma (Récords, Escenarios,
// etc.) — así la nueva portada se siente parte de la misma app, no un
// mockup pegado encima.
const S = {
  bg:     '#07070e',
  bg2:    '#0b0e17',
  card:   '#0f1623',
  border: '#1e2d3d',
  gold:   '#f9a825',
  cyan:   '#00ddd0',
  green:  '#22c55e',
  red:    '#e53935',
  text:   '#e8f4fd',
  muted:  '#7a9ab5',
}

function Escudo({ logo_url, name, size = 40, radius = 10 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size > 30 ? '4px' : '2px' }}/>
        : <span style={{ fontSize: size * .34, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ torneos: 0, jugadores: 0, equipos: 0, goles: 0 })
  const [torneos, setTorneos] = useState([])
  const [matchesVivoRaw, setMatchesVivoRaw] = useState([])
  const [escenarios, setEscenarios] = useState([])
  const [escuelas, setEscuelas] = useState([])
  const [tick, setTick] = useState(0)

  const torneosRef = useRef(null)
  const vivoRef = useRef(null)

  useEffect(() => {
    fetchStats(); fetchTorneosActivos(); fetchPartidosVivo(); fetchEscenarios(); fetchEscuelas()
    registrarVisita('inicio')
  }, [])

  // Reloj de los partidos en vivo: recalcula localmente cada segundo, y cada
  // 20s refresca de verdad por si hubo un gol nuevo o cambió algo.
  useEffect(() => {
    const tRelog = setInterval(() => setTick(x => x + 1), 1000)
    const tRefetch = setInterval(fetchPartidosVivo, 20000)
    return () => { clearInterval(tRelog); clearInterval(tRefetch) }
  }, [])

  const partidosVivo = useMemo(() => {
    void tick
    return matchesVivoRaw.map(m => ({ ...m, vivo: derivarEnVivo(m) })).filter(m => m.vivo)
  }, [matchesVivoRaw, tick])

  async function fetchStats() {
    const [{ count: cTorneos }, { count: cJugadores }, { count: cEquipos }, { data: golesData }] = await Promise.all([
      supabase.from('tournaments').select('id', { count: 'exact', head: true }),
      supabase.from('players_publico').select('id', { count: 'exact', head: true }),
      supabase.from('teams').select('id', { count: 'exact', head: true }),
      supabase.from('matches').select('home_score, away_score').eq('status', 'finished'),
    ])
    const goles = (golesData || []).reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0)
    setStats({ torneos: cTorneos || 0, jugadores: cJugadores || 0, equipos: cEquipos || 0, goles })
  }

  async function fetchTorneosActivos() {
    let torsRes = await supabase.from('tournaments').select('id, name, logo_url, modalidad, season').eq('status', 'active')
    if (torsRes.error) torsRes = await supabase.from('tournaments').select('id, name, logo_url, modalidad, season').eq('status', 'active')
    const [{ data: tts }, { data: ms }] = await Promise.all([
      supabase.from('tournament_teams').select('tournament_id'),
      supabase.from('matches').select('tournament_id, matchday, fase, status'),
    ])
    const tors = torsRes.data
    const cuentaEq = {}
    ;(tts || []).forEach(t => { cuentaEq[t.tournament_id] = (cuentaEq[t.tournament_id] || 0) + 1 })
    const FASES = { octavos: 'Octavos de final', cuartos: 'Cuartos de final', semifinal: 'Semifinales', final: 'Gran final' }
    const PESO  = { octavos: 1, cuartos: 2, semifinal: 3, final: 4 }
    setTorneos((tors || []).map(t => {
      const mts = (ms || []).filter(m => m.tournament_id === t.id)
      const elim = mts.filter(m => m.fase && m.fase !== 'grupo').sort((a, b) => (PESO[b.fase] || 0) - (PESO[a.fase] || 0))[0]
      const maxFecha = Math.max(0, ...mts.filter(m => m.matchday).map(m => m.matchday))
      const estado = elim ? (FASES[elim.fase] || 'Eliminatorias') : maxFecha > 0 ? `Fecha ${maxFecha}` : 'Por comenzar'
      return { ...t, equipos: cuentaEq[t.id] || 0, estado }
    }))
  }

  async function fetchPartidosVivo() {
    const { data } = await supabase.from('matches')
      .select('id, tournament_id, status, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, modalidad)')
      .eq('status', 'scheduled')
      .or('live_state.not.is.null,live_state_rapida.not.is.null')
    setMatchesVivoRaw(data || [])
  }

  async function fetchEscenarios() {
    const { data } = await supabase.from('escenarios').select('id, name, city, logo_url').eq('activo', true).limit(6)
    setEscenarios(data || [])
  }

  async function fetchEscuelas() {
    const { data } = await supabase.from('teams').select('id, name, logo_url, categoria').eq('tipo', 'escuela').limit(6)
    setEscuelas(data || [])
  }

  function scrollA(ref) { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  const btnGhost = { padding: '9px 16px', borderRadius: '10px', border: `1px solid ${S.border}`, background: 'transparent', color: S.text, fontSize: '.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  const btnPrimary = { padding: '11px 22px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${S.gold}, #ffcc4d)`, color: '#1a1200', fontSize: '.9rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,168,37,.35)', whiteSpace: 'nowrap' }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: 'system-ui,sans-serif', color: S.text }}>

      {/* ── Header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,7,14,.92)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/marca/watermark-logo.png" alt="Golmebol" style={{ height: '26px' }}/>
            <span style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: '.02em' }}>GOLMEBOL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => navigate('/login')} style={btnGhost}>Administrador</button>
            <button onClick={() => navigate('/jugador/login')} style={btnPrimary}>Ingresar</button>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ position: 'relative', padding: '56px 16px 44px', textAlign: 'center', overflow: 'hidden', background: `radial-gradient(circle at 50% 0%, ${S.bg2}, ${S.bg} 70%)` }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .06, backgroundImage: `radial-gradient(${S.cyan} 1px, transparent 1px)`, backgroundSize: '22px 22px', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '999px', border: `1px solid ${S.border}`, color: S.cyan, fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', marginBottom: '18px' }}>
            LIGA AMATEUR DE FÚTBOL SALA — ARMENIA, QUINDÍO
          </div>
          <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.5rem)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 14px' }}>
            Todos los torneos<br/>en un solo lugar
          </h1>
          <p style={{ color: S.muted, fontSize: '.95rem', margin: '0 0 26px', lineHeight: 1.5 }}>
            Torneos en vivo, tablas de posiciones, récords, escenarios deportivos y escuelas de fútbol — todo en Golmebol.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => scrollA(torneosRef)} style={btnPrimary}>Ver torneos</button>
            <button onClick={() => scrollA(vivoRef)} style={btnGhost}>Ver partidos en vivo</button>
          </div>
        </div>
      </div>

      {/* ── Barra de stats ── */}
      <div style={{ maxWidth: '1080px', margin: '-18px auto 0', padding: '0 16px 6px', position: 'relative', zIndex: 2 }}>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '18px 10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
          {[
            { label: 'Torneos', val: stats.torneos, icon: Trophy, color: S.gold },
            { label: 'Equipos', val: stats.equipos, icon: Users, color: S.cyan },
            { label: 'Jugadores', val: stats.jugadores, icon: Users, color: S.green },
            { label: 'Goles', val: stats.goles, icon: Target, color: S.red },
          ].map((s, i) => (
            <div key={i}>
              <s.icon size={16} color={s.color} style={{ marginBottom: '4px' }}/>
              <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>{s.val}</div>
              <div style={{ fontSize: '.62rem', color: S.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Torneos en juego ── */}
      <div ref={torneosRef} style={{ maxWidth: '1080px', margin: '0 auto', padding: '40px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Torneos en juego</h2>
          <button onClick={() => navigate('/records')} style={{ background: 'none', border: 'none', color: S.cyan, fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
            Ver todos <ChevronRight size={14}/>
          </button>
        </div>
        {torneos.length === 0 ? (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '24px', textAlign: 'center', color: S.muted, fontSize: '.85rem' }}>
            No hay torneos activos en este momento.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px' }}>
            {torneos.map(t => {
              const enVivo = partidosVivo.some(m => m.tournament_id === t.id)
              return (
                <button key={t.id} onClick={() => navigate('/records')} style={{ textAlign: 'left', background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer', color: S.text }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <Escudo logo_url={t.logo_url} name={t.name} size={38}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      <div style={{ fontSize: '.7rem', color: S.muted }}>{t.modalidad || 'Fútbol sala'}{t.season ? ` · ${t.season}` : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '.68rem', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', background: enVivo ? 'rgba(229,57,53,.15)' : 'rgba(0,221,208,.12)', color: enVivo ? S.red : S.cyan }}>
                      {enVivo ? '● EN VIVO' : t.estado}
                    </span>
                    <span style={{ fontSize: '.72rem', color: S.muted }}>{t.equipos} equipos</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Partidos en vivo ── */}
      <div ref={vivoRef} style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 16px 8px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={17} color={S.red}/> Partidos en vivo
        </h2>
        {partidosVivo.length === 0 ? (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '24px', textAlign: 'center', color: S.muted, fontSize: '.85rem' }}>
            No hay partidos en vivo en este momento.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {partidosVivo.map(m => (
              <div key={m.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: S.red, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: S.red, display: 'inline-block' }}/> EN VIVO
                  </span>
                  <span style={{ fontSize: '.7rem', color: S.muted }}>{m.vivo.descanso ? 'Descanso' : `${m.vivo.reloj} · P${m.vivo.periodo}`}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <Escudo logo_url={m.home?.logo_url} name={m.home?.name} size={26}/>
                    <span style={{ fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home?.name}</span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{m.away?.name}</span>
                    <Escudo logo_url={m.away?.logo_url} name={m.away?.name} size={26}/>
                  </div>
                </div>
                <div style={{ fontSize: '.68rem', color: S.muted, marginTop: '8px', textAlign: 'center' }}>{m.tournaments?.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Escenarios / Escuelas ── */}
      {(escenarios.length > 0 || escuelas.length > 0) && (
        <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 16px 8px', display: 'grid', gridTemplateColumns: escenarios.length > 0 && escuelas.length > 0 ? '1fr 1fr' : '1fr', gap: '20px' }}>
          {escenarios.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.02rem', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Building2 size={16} color={S.cyan}/> Escenarios
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {escenarios.map(e => (
                  <button key={e.id} onClick={() => navigate('/reservar/' + e.id)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '10px 12px', cursor: 'pointer', color: S.text }}>
                    <Escudo logo_url={e.logo_url} name={e.name} size={32} radius={8}/>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '.83rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                      {e.city && <div style={{ fontSize: '.68rem', color: S.muted }}>{e.city}</div>}
                    </div>
                    <ChevronRight size={15} color={S.muted}/>
                  </button>
                ))}
              </div>
            </div>
          )}
          {escuelas.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.02rem', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <GraduationCap size={16} color={S.gold}/> Escuelas de fútbol
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {escuelas.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '10px 12px' }}>
                    <Escudo logo_url={e.logo_url} name={e.name} size={32} radius={8}/>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '.83rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                      {e.categoria && <div style={{ fontSize: '.68rem', color: S.muted }}>{e.categoria}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${S.border}`, marginTop: '44px', padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginBottom: '8px' }}>
          <img src="/marca/watermark-logo.png" alt="Golmebol" style={{ height: '18px' }}/>
          <span style={{ fontWeight: 800, fontSize: '.85rem' }}>GOLMEBOL</span>
        </div>
        <div style={{ fontSize: '.72rem', color: S.muted, marginBottom: '10px' }}>Armenia, Quindío · Colombia</div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '.75rem' }}>
          <button onClick={() => navigate('/records')} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}>Récords</button>
          <button onClick={() => navigate('/jugador/login')} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}>Ingresar</button>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}>Administrador</button>
        </div>
      </div>
    </div>
  )
}
