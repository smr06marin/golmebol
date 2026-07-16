import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TablaPosiciones from '../components/TablaPosiciones'
import { registrarVisita } from '../lib/visitas'

// Icono de cada récord automático (los históricos traen el suyo o usan 🏆)
const ICONOS_RECORD = {
  max_goleador: '⚽', goles_partido: '💥', hat_tricks: '🎩', victorias: '🏅',
  mas_partidos: '🎽', racha_vic: '🔥', racha_gol: '🔥', arcos_cero: '🧤',
  fair_play: '🤝', partido_goles: '⚡', goleada: '🚀', eq_goles: '🛡️', eq_victorias: '👑',
}

const S = {
  bg:     '#07070e',
  card:   '#0f1623',
  border: '#1e2d3d',
  gold:   '#f9a825',
  cyan:   '#00ddd0',
  text:   '#e8f4fd',
  muted:  '#7a9ab5',
}

function RecordCard({ titulo, nombre, subtitulo, descripcion, color, icono }) {
  return (
    <div className="gm-fade" style={{
      width: '100%',
      background: '#0a0f1e',
      border: `2px solid ${color}`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Banda superior */}
      <div style={{ background: color, padding: '8px 14px', textAlign: 'center' }}>
        <div style={{ fontWeight: '900', fontSize: '.78rem', color: '#fff', letterSpacing: '1.5px', textTransform: 'uppercase', lineHeight: 1.3 }}>
          {titulo}
        </div>
      </div>
      {/* Cuerpo */}
      <div style={{ padding: '14px 16px 18px', textAlign: 'center' }}>
        <div className="gm-trofeo" style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{icono || '🏆'}</div>
        <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#fff', letterSpacing: '.04em', lineHeight: 1.2, marginBottom: '10px', textTransform: 'uppercase' }}>
          {nombre}
        </div>
        {subtitulo && (
          <div style={{ fontWeight: '700', fontSize: '.78rem', color: color, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: descripcion ? '6px' : '0' }}>
            {subtitulo}
          </div>
        )}
        {descripcion && (
          <div style={{ fontWeight: '600', fontSize: '.68rem', color: 'rgba(255,255,255,.5)', letterSpacing: '.5px', textTransform: 'uppercase' }}>
            {descripcion}
          </div>
        )}
      </div>
    </div>
  )
}

function Carrusel({ records }) {
  const ref   = useRef(null)
  const [idx, setIdx] = useState(0)
  const total = records.length

  function scrollTo(i) {
    const newIdx = Math.max(0, Math.min(i, total - 1))
    setIdx(newIdx)
    if (ref.current) {
      ref.current.scrollTo({ left: newIdx * ref.current.offsetWidth, behavior: 'smooth' })
    }
  }

  function handleScroll() {
    if (ref.current) {
      setIdx(Math.round(ref.current.scrollLeft / ref.current.offsetWidth))
    }
  }

  if (total === 0) return null

  return (
    <div>
      <div ref={ref} onScroll={handleScroll}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {records.map((r, i) => (
          <div key={r.id || i} style={{ minWidth: '100%', scrollSnapAlign: 'start', padding: '0 20px', boxSizing: 'border-box' }}>
            <RecordCard {...r} icono={r.icono || ICONOS_RECORD[r.id] || '🏆'}/>
          </div>
        ))}
      </div>

      {/* Controles */}
      {total > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '18px' }}>
          <button onClick={() => scrollTo(idx - 1)} disabled={idx === 0}
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: idx === 0 ? S.border : S.gold, border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? S.muted : '#000', fontSize: '1.2rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ‹
          </button>
          <div style={{ fontSize: '.75rem', color: S.muted, fontWeight: '700', minWidth: '50px', textAlign: 'center' }}>{idx + 1} / {total}</div>
          <button onClick={() => scrollTo(idx + 1)} disabled={idx === total - 1}
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: idx === total - 1 ? S.border : S.gold, border: 'none', cursor: idx === total - 1 ? 'default' : 'pointer', color: idx === total - 1 ? S.muted : '#000', fontSize: '1.2rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ›
          </button>
        </div>
      )}

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '12px', flexWrap: 'wrap', padding: '0 20px' }}>
        {records.map((_, i) => (
          <div key={i} onClick={() => scrollTo(i)}
            style={{ width: i === idx ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === idx ? S.gold : S.border, cursor: 'pointer', transition: 'all .2s', flexShrink: 0 }}/>
        ))}
      </div>
    </div>
  )
}

function StatBox({ valor, label, color }) {
  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px 10px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontWeight: '900', fontSize: '1.6rem', color: color || S.cyan, fontFamily: 'monospace', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '.62rem', color: S.muted, marginTop: '4px', fontWeight: '700', letterSpacing: '.08em' }}>{label}</div>
    </div>
  )
}

// Pantalla de bienvenida con los campeones de los últimos 15 días
function SplashCampeones({ campeones, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 9000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'radial-gradient(circle at 50% 28%, #1c1305, #07070e 72%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
      <style>{`
        @keyframes splashPop  { 0% { transform: scale(.55); opacity: 0 } 65% { transform: scale(1.07) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes splashGlow { 0%,100% { box-shadow: 0 0 26px rgba(249,168,37,.35) } 50% { box-shadow: 0 0 64px rgba(249,168,37,.75) } }
        @keyframes splashFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
      `}</style>
      <div style={{ fontSize: '2.6rem', marginBottom: '4px', animation: 'splashFloat 2.4s ease-in-out infinite' }}>🏆</div>
      <div style={{ fontWeight: '900', letterSpacing: '4px', color: S.gold, fontSize: '1.15rem', marginBottom: '4px', textAlign: 'center' }}>
        {campeones.length > 1 ? '¡TENEMOS CAMPEONES!' : '¡TENEMOS CAMPEÓN!'}
      </div>
      <div style={{ color: S.muted, fontSize: '.72rem', letterSpacing: '2px', marginBottom: '24px' }}>🎉 FELICITACIONES 🎉</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', justifyContent: 'center', maxWidth: '760px' }}>
        {campeones.map((c, i) => {
          const iniciales = (c.team_name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
          return (
            <div key={`${c.team_id}-${c.tournament_id}`} style={{ animation: `splashPop .7s ease ${i * 0.25}s both`, background: S.card, border: `2px solid ${S.gold}`, borderRadius: '18px', padding: '28px 32px', textAlign: 'center', minWidth: '230px', maxWidth: '300px' }}>
              <div style={{ width: '116px', height: '116px', borderRadius: '50%', margin: '0 auto 16px', background: '#0a0f1e', border: `3px solid ${S.gold}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'splashGlow 2.2s ease-in-out infinite' }}>
                {c.logo_url
                  ? <img src={c.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }}/>
                  : <span style={{ fontSize: '2.4rem', fontWeight: '900', color: S.gold }}>{iniciales}</span>}
              </div>
              <div style={{ fontWeight: '900', fontSize: '1.25rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '.05em', lineHeight: 1.2 }}>{c.team_name}</div>
              <div style={{ marginTop: '8px', color: '#000', background: S.gold, display: 'inline-block', borderRadius: '20px', padding: '3px 14px', fontWeight: '900', fontSize: '.68rem', letterSpacing: '2px' }}>CAMPEÓN</div>
              <div style={{ marginTop: '8px', color: S.muted, fontSize: '.78rem' }}>del torneo</div>
              <div style={{ color: S.cyan, fontWeight: '700', fontSize: '.85rem', marginTop: '2px' }}>{c.tournament_name}</div>
            </div>
          )
        })}
      </div>
      <button onClick={onClose}
        style={{ marginTop: '30px', background: S.gold, color: '#000', border: 'none', borderRadius: '10px', padding: '13px 42px', fontWeight: '900', letterSpacing: '2px', fontSize: '.85rem', cursor: 'pointer' }}>
        ENTRAR →
      </button>
    </div>
  )
}

export default function RecordsPage() {
  const navigate = useNavigate()
  const [loading,  setLoading]  = useState(true)
  const [records,  setRecords]  = useState([])
  const [campeones,  setCampeones]  = useState([])
  const [showSplash, setShowSplash] = useState(false)
  // Torneos activos (vitrina pública) y tabla de posiciones del torneo elegido
  const [torneosActivos, setTorneosActivos] = useState([])
  const [torneoTabla,    setTorneoTabla]    = useState(null) // { torneo, filas } | 'cargando'

  useEffect(() => { fetchTodo(); fetchCampeonesRecientes(); fetchTorneosActivos(); registrarVisita('inicio') }, [])

  // ── TORNEOS ACTIVOS ────────────────────────────────────────────────────────
  async function fetchTorneosActivos() {
    const [{ data: tors }, { data: tts }, { data: ms }] = await Promise.all([
      supabase.from('tournaments').select('id, name, logo_url, modalidad, season, fase_actual').eq('status', 'active'),
      supabase.from('tournament_teams').select('tournament_id'),
      supabase.from('matches').select('tournament_id, matchday, fase, status'),
    ])
    const cuentaEq = {}
    ;(tts || []).forEach(t => { cuentaEq[t.tournament_id] = (cuentaEq[t.tournament_id] || 0) + 1 })
    const FASES = { octavos: 'Octavos de final', cuartos: 'Cuartos de final', semifinal: 'Semifinales', final: '¡Gran Final!' }
    const PESO  = { octavos: 1, cuartos: 2, semifinal: 3, final: 4 }
    setTorneosActivos((tors || []).map(t => {
      const mts = (ms || []).filter(m => m.tournament_id === t.id)
      const elim = mts.filter(m => m.fase && m.fase !== 'grupo').sort((a, b) => (PESO[b.fase] || 0) - (PESO[a.fase] || 0))[0]
      const maxFecha = Math.max(0, ...mts.filter(m => m.matchday).map(m => m.matchday))
      const estado = elim ? (FASES[elim.fase] || 'Eliminatorias') : maxFecha > 0 ? `Fecha ${maxFecha}` : 'Por comenzar'
      return { ...t, equipos: cuentaEq[t.id] || 0, estado, enElim: !!elim }
    }))
  }

  // Tabla de posiciones PÚBLICA del torneo (solo la clasificación)
  async function abrirTablaTorneo(t) {
    setTorneoTabla('cargando')
    registrarVisita('tabla_torneo', t.id)
    const [{ data: tts }, { data: ms }] = await Promise.all([
      supabase.from('tournament_teams').select('*, teams(id, name, logo_url)').eq('tournament_id', t.id),
      supabase.from('matches').select('home_team_id, away_team_id, home_score, away_score, status, fase').eq('tournament_id', t.id),
    ])
    const tabla = {}
    ;(tts || []).forEach(r => { if (r.teams) tabla[r.teams.id] = { equipo: r.teams, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
    ;(ms || []).filter(m => m.status === 'finished' && (!m.fase || m.fase === 'grupo')).forEach(m => {
      const L = tabla[m.home_team_id], V = tabla[m.away_team_id]
      if (L) { L.pj++; L.gf += m.home_score || 0; L.gc += m.away_score || 0
        if (m.home_score > m.away_score) { L.pg++; L.pts += 3 } else if (m.home_score === m.away_score) { L.pe++; L.pts++ } else L.pp++ }
      if (V) { V.pj++; V.gf += m.away_score || 0; V.gc += m.home_score || 0
        if (m.away_score > m.home_score) { V.pg++; V.pts += 3 } else if (m.away_score === m.home_score) { V.pe++; V.pts++ } else V.pp++ }
    })
    const filas = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
    setTorneoTabla({ torneo: t, filas })
  }

  // Campeones coronados en los últimos 15 días (se muestran a todo el que entre)
  async function fetchCampeonesRecientes() {
    if (sessionStorage.getItem('golmebol_splash_campeones')) return
    const desde = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('tournament_logros')
      .select('team_id, tournament_id, created_at, teams(name, logo_url), tournaments(name)')
      .eq('tipo', 'campeon')
      .not('team_id', 'is', null)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
    const unicos = []
    ;(data || []).forEach(l => {
      if (!unicos.some(u => u.team_id === l.team_id && u.tournament_id === l.tournament_id)) {
        unicos.push({ team_id: l.team_id, tournament_id: l.tournament_id, team_name: l.teams?.name, logo_url: l.teams?.logo_url, tournament_name: l.tournaments?.name })
      }
    })
    if (unicos.length > 0) { setCampeones(unicos); setShowSplash(true) }
  }

  function cerrarSplash() {
    sessionStorage.setItem('golmebol_splash_campeones', '1')
    setShowSplash(false)
  }

  async function fetchTodo() {
    setLoading(true)
    const [recsAuto, recsHist] = await Promise.all([fetchAutomaticos(), fetchHistoricos()])
    setRecords([...(recsAuto || []), ...(recsHist || [])])
    setLoading(false)
  }

  async function fetchHistoricos() {
    const { data } = await supabase
      .from('records_historicos')
      .select('*')
      .eq('activo', true)
      .order('orden')
    return data || []
  }

  async function fetchAutomaticos() {
    const { data: cache } = await supabase
      .from('player_stats_cache')
      .select('*, players(name, posicion_futbol5, posicion_futbol7, posicion_futbol11)')

    const { data: statsPorPartido } = await supabase
      .from('player_match_stats')
      .select('*, players(name), matches(home_score, away_score, played_at, home:home_team_id(name), away:away_team_id(name))')
      .gt('goals_scored', 0)
      .order('goals_scored', { ascending: false })

    const { data: matches } = await supabase
      .from('matches')
      .select('*, home:home_team_id(name), away:away_team_id(name)')
      .eq('status', 'finished')

    const recs = []

    // 1. Máximo goleador
    const topGol = [...(cache || [])].sort((a, b) => b.goles - a.goles)[0]
    if (topGol?.goles > 0) recs.push({
      id: 'max_goleador',
      titulo: `${topGol.goles} goles históricos`,
      nombre: topGol.players?.name || '?',
      subtitulo: `${topGol.pj} partidos jugados`,
      descripcion: `Promedio ${topGol.pj > 0 ? (topGol.goles / topGol.pj).toFixed(2) : 0} goles/partido`,
      color: S.gold,
    })

    // 2. Más goles en un partido
    const topGolPar = (statsPorPartido || [])[0]
    if (topGolPar?.goals_scored >= 2) recs.push({
      id: 'goles_partido',
      titulo: `${topGolPar.goals_scored} goles en un partido`,
      nombre: topGolPar.players?.name || '?',
      subtitulo: `${topGolPar.matches?.home?.name} vs ${topGolPar.matches?.away?.name}`,
      descripcion: topGolPar.matches?.played_at ? new Date(topGolPar.matches.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      color: '#e8710a',
    })

    // 3. Hat-tricks
    const topHat = [...(cache || [])].sort((a, b) => b.hat_tricks - a.hat_tricks)[0]
    if (topHat?.hat_tricks > 0) recs.push({
      id: 'hat_tricks',
      titulo: `${topHat.hat_tricks} hat-trick${topHat.hat_tricks > 1 ? 's' : ''}`,
      nombre: topHat.players?.name || '?',
      subtitulo: 'más hat-tricks en la historia',
      descripcion: '3 o más goles en un solo partido',
      color: S.gold,
    })

    // 4. Más victorias
    const topVic = [...(cache || [])].sort((a, b) => b.victorias - a.victorias)[0]
    if (topVic?.victorias > 0) recs.push({
      id: 'victorias',
      titulo: `${topVic.victorias} victorias`,
      nombre: topVic.players?.name || '?',
      subtitulo: `en ${topVic.pj} partidos`,
      descripcion: `${topVic.pj > 0 ? Math.round((topVic.victorias / topVic.pj) * 100) : 0}% de eficacia`,
      color: '#9955ff',
    })

    // 5. Más partidos
    const topPJ = [...(cache || [])].sort((a, b) => b.pj - a.pj)[0]
    if (topPJ?.pj > 0) recs.push({
      id: 'mas_partidos',
      titulo: `${topPJ.pj} partidos jugados`,
      nombre: topPJ.players?.name || '?',
      subtitulo: 'más partidos en la historia',
      descripcion: `${topPJ.victorias || 0}V · ${topPJ.empates || 0}E · ${topPJ.derrotas || 0}D`,
      color: S.cyan,
    })

    // 6. Racha victorias
    const topRachaV = [...(cache || [])].sort((a, b) => (b.racha_victorias_max || b.racha_victorias_actual || 0) - (a.racha_victorias_max || a.racha_victorias_actual || 0))[0]
    const rachaV = topRachaV?.racha_victorias_max || topRachaV?.racha_victorias_actual || 0
    if (rachaV >= 2) recs.push({
      id: 'racha_vic',
      titulo: `${rachaV} victorias seguidas`,
      nombre: topRachaV.players?.name || '?',
      subtitulo: 'mayor racha de victorias consecutivas',
      descripcion: topRachaV?.racha_victorias_actual === rachaV ? '🔥 Racha activa' : 'Récord histórico',
      color: '#00ee55',
    })

    // 7. Racha goles
    const topRachaG = [...(cache || [])].sort((a, b) => (b.racha_goles_actual || 0) - (a.racha_goles_actual || 0))[0]
    if (topRachaG?.racha_goles_actual >= 2) recs.push({
      id: 'racha_gol',
      titulo: `goles en ${topRachaG.racha_goles_actual} partidos seguidos`,
      nombre: topRachaG.players?.name || '?',
      subtitulo: '🔥 racha goleadora activa',
      descripcion: 'marcó en partidos consecutivos',
      color: '#e8710a',
    })

    // 8. Arcos en cero
    const porteros = (cache || []).filter(s => {
      const pos = s.players?.posicion_futbol5 || s.players?.posicion_futbol7 || s.players?.posicion_futbol11 || ''
      return pos === 'Portero'
    })
    const topArcos = [...porteros].sort((a, b) => b.arcos_cero - a.arcos_cero)[0]
    if (topArcos?.arcos_cero > 0) recs.push({
      id: 'arcos_cero',
      titulo: `${topArcos.arcos_cero} arcos en cero`,
      nombre: topArcos.players?.name || '?',
      subtitulo: 'mejor arquero · valla menos vencida',
      descripcion: `en ${topArcos.pj} partidos jugados`,
      color: S.cyan,
    })

    // 9. Fair play
    const topFair = [...(cache || [])].filter(s => s.partidos_sin_tarjetas > 0).sort((a, b) => b.partidos_sin_tarjetas - a.partidos_sin_tarjetas)[0]
    if (topFair) recs.push({
      id: 'fair_play',
      titulo: `${topFair.partidos_sin_tarjetas} partidos sin tarjetas`,
      nombre: topFair.players?.name || '?',
      subtitulo: 'fair play · juego limpio',
      descripcion: `de ${topFair.pj} partidos jugados`,
      color: '#00ee55',
    })

    // 10. Partido más goleador
    const masGolesPar = [...(matches || [])].map(m => ({ ...m, total: (m.home_score || 0) + (m.away_score || 0) })).sort((a, b) => b.total - a.total)[0]
    if (masGolesPar?.total > 0) recs.push({
      id: 'partido_goles',
      titulo: `${masGolesPar.total} goles en un partido`,
      nombre: `${masGolesPar.home?.name} ${masGolesPar.home_score} — ${masGolesPar.away_score} ${masGolesPar.away?.name}`,
      subtitulo: 'partido más goleador de la historia',
      descripcion: masGolesPar.played_at ? new Date(masGolesPar.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      color: '#d93025',
    })

    // 11. Mayor goleada
    const goleada = [...(matches || [])].map(m => ({ ...m, diff: Math.abs((m.home_score || 0) - (m.away_score || 0)) })).sort((a, b) => b.diff - a.diff)[0]
    if (goleada?.diff >= 2) recs.push({
      id: 'goleada',
      titulo: `goleada de ${goleada.diff} goles`,
      nombre: `${goleada.home?.name} ${goleada.home_score} — ${goleada.away_score} ${goleada.away?.name}`,
      subtitulo: 'mayor goleada de la historia',
      descripcion: goleada.played_at ? new Date(goleada.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      color: '#e8710a',
    })

    // 12. Equipo más goleador
    const equiposMap = {}
    ;(matches || []).forEach(m => {
      const add = (id, name, gF, gC) => {
        if (!id || !name) return
        if (!equiposMap[id]) equiposMap[id] = { name, goles: 0, pj: 0, victorias: 0, empates: 0, derrotas: 0 }
        equiposMap[id].goles += gF
        equiposMap[id].pj   += 1
        if (gF > gC) equiposMap[id].victorias++
        else if (gF === gC) equiposMap[id].empates++
        else equiposMap[id].derrotas++
      }
      add(m.home_team_id, m.home?.name, m.home_score || 0, m.away_score || 0)
      add(m.away_team_id, m.away?.name, m.away_score || 0, m.home_score || 0)
    })
    const equiposArr = Object.values(equiposMap)

    const topGolEq = [...equiposArr].sort((a, b) => b.goles - a.goles)[0]
    if (topGolEq?.goles > 0) recs.push({
      id: 'eq_goles',
      titulo: `${topGolEq.goles} goles anotados`,
      nombre: topGolEq.name || '?',
      subtitulo: 'equipo más goleador',
      descripcion: `en ${topGolEq.pj} partidos`,
      color: S.gold,
    })

    const topVicEq = [...equiposArr].sort((a, b) => b.victorias - a.victorias)[0]
    if (topVicEq?.victorias > 0) recs.push({
      id: 'eq_victorias',
      titulo: `${topVicEq.victorias} victorias`,
      nombre: topVicEq.name || '?',
      subtitulo: 'equipo más victorioso',
      descripcion: `${topVicEq.pj} PJ · ${topVicEq.goles} goles`,
      color: '#9955ff',
    })

    return recs
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      {showSplash && campeones.length > 0 && <SplashCampeones campeones={campeones} onClose={cerrarSplash}/>}
      <div style={{ fontSize: '2rem' }}>🏆</div>
      <div style={{ color: S.cyan, fontSize: '.9rem', fontWeight: '600' }}>Cargando récords...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text }}>
      {showSplash && campeones.length > 0 && <SplashCampeones campeones={campeones} onClose={cerrarSplash}/>}

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #0a0a14 0%, #07070e 100%)', padding: '36px 16px 24px', textAlign: 'center', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: S.cyan, letterSpacing: '6px', marginBottom: '6px' }}>GOLMEBOL</div>
        <div style={{ fontSize: '.68rem', color: S.muted, letterSpacing: '3px', fontWeight: '700' }}>
          LA CASA DEL MICROFÚTBOL
        </div>
      </div>

      {/* ── TORNEOS ACTIVOS ── */}
      {torneosActivos.length > 0 && (
        <div style={{ padding: '22px 16px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, transparent, ${S.cyan})` }}/>
            <div style={{ fontWeight: '900', color: S.cyan, fontSize: '.95rem', letterSpacing: '.14em' }}>🏆 TORNEOS ACTIVOS</div>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, ${S.cyan}, transparent)` }}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '12px', maxWidth: '760px', margin: '0 auto' }}>
            {torneosActivos.map(t => (
              <div key={t.id} onClick={() => abrirTablaTorneo(t)} className="gm-fade"
                style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 3px 14px rgba(0,0,0,.3)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#0a0f1e', border: `1px solid ${S.border}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/> : <span style={{ fontSize: '1.5rem' }}>🏆</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '800', color: '#fff', fontSize: '.9rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.62rem', fontWeight: '800', color: t.enElim ? '#000' : S.cyan, background: t.enElim ? S.gold : 'rgba(0,221,208,.12)', border: t.enElim ? 'none' : `1px solid ${S.cyan}44`, borderRadius: '20px', padding: '3px 10px', letterSpacing: '.06em' }}>{t.estado.toUpperCase()}</span>
                    {t.equipos > 0 && <span style={{ fontSize: '.62rem', fontWeight: '700', color: S.muted, background: 'rgba(255,255,255,.05)', borderRadius: '20px', padding: '3px 10px' }}>{t.equipos} EQUIPOS</span>}
                  </div>
                </div>
                <div style={{ flexShrink: 0, color: S.gold, fontWeight: '800', fontSize: '.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Ver tabla <span style={{ fontSize: '.9rem' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RÉCORDS GOLMEBOL ── */}
      <div style={{ padding: '26px 16px 8px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, transparent, ${S.gold})` }}/>
          <div style={{ fontWeight: '900', color: S.gold, fontSize: '1.1rem', letterSpacing: '.1em', lineHeight: 1.3 }}>
            🏆 SALÓN DE LOS RÉCORDS
          </div>
          <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, ${S.gold}, transparent)` }}/>
        </div>
        <div style={{ fontSize: '.62rem', color: S.muted, letterSpacing: '2px', fontWeight: '700' }}>
          RÉCORDS GOLMEBOL · {records.length} REGISTRADOS
        </div>
      </div>

      {/* Carrusel único */}
      <div style={{ padding: '8px 0 32px' }}>
        <Carrusel records={records}/>
      </div>

      {/* ── INICIA SESIÓN PARA DESBLOQUEAR ── */}
      <div style={{ padding: '28px 16px 48px', borderTop: `1px solid ${S.border}`, background: 'rgba(0,0,0,.3)' }}>
        <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔓</div>
          <div style={{ fontWeight: '900', color: '#fff', fontSize: '1.05rem', letterSpacing: '.04em', marginBottom: '6px' }}>
            Inicia sesión para desbloquear todas las estadísticas y funciones de Golmebol
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', margin: '16px 0 20px' }}>
            {['👤 Perfil completo', '📊 Estadísticas personales', '📋 Historial de partidos', '⚽ Goles', '🏅 Logros', '🎁 Premios', '🎯 PREDIX', '🃏 Tu tarjeta de jugador'].map(b => (
              <span key={b} style={{ fontSize: '.68rem', fontWeight: '700', color: S.text, background: S.card, border: `1px solid ${S.border}`, borderRadius: '20px', padding: '6px 12px' }}>{b}</span>
            ))}
          </div>
          <button onClick={() => navigate('/jugador/login')}
            style={{ width: '100%', maxWidth: '320px', padding: '15px', background: `linear-gradient(90deg, ${S.cyan}, #1a73e8)`, border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#000', fontWeight: '900', fontSize: '1rem', letterSpacing: '.5px', display: 'block', margin: '0 auto 12px', boxShadow: `0 4px 20px ${S.cyan}44` }}>
            🎯 Ingresar al portal
          </button>
          <button onClick={() => navigate('/login')}
            style={{ padding: '9px 24px', background: 'none', border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.muted, fontSize: '.75rem' }}>
            Acceso administrador →
          </button>
        </div>
      </div>

      {/* ── TABLA PÚBLICA DEL TORNEO (solo posiciones) ── */}
      {torneoTabla && (
        <div style={{ position: 'fixed', inset: 0, background: S.bg, zIndex: 500, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 14px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button onClick={() => setTorneoTabla(null)}
                style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', color: S.text, fontSize: '.85rem', fontWeight: '700', flexShrink: 0 }}>
                ← Volver
              </button>
              {torneoTabla !== 'cargando' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {torneoTabla.torneo.logo_url && <img src={torneoTabla.torneo.logo_url} style={{ width: '34px', height: '34px', objectFit: 'contain', flexShrink: 0 }}/>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '800', color: '#fff', fontSize: '.9rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneoTabla.torneo.name}</div>
                    <div style={{ fontSize: '.62rem', color: S.cyan, fontWeight: '700', letterSpacing: '.08em' }}>{torneoTabla.torneo.estado?.toUpperCase()}</div>
                  </div>
                </div>
              )}
            </div>
            {torneoTabla === 'cargando' ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: S.cyan, fontWeight: '700', fontSize: '.85rem' }}>Cargando tabla...</div>
            ) : (
              <>
                <TablaPosiciones titulo="Tabla de posiciones" rows={torneoTabla.filas}/>
                {/* CTA: lo demás se desbloquea con sesión */}
                <div style={{ marginTop: '18px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: '.82rem', color: S.text, fontWeight: '700', marginBottom: '4px' }}>🔒 ¿Goleadores, estadísticas y tu perfil?</div>
                  <div style={{ fontSize: '.7rem', color: S.muted, marginBottom: '14px' }}>Inicia sesión para desbloquear toda la experiencia Golmebol</div>
                  <button onClick={() => navigate('/jugador/login')}
                    style={{ padding: '12px 32px', background: `linear-gradient(90deg, ${S.cyan}, #1a73e8)`, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#000', fontWeight: '900', fontSize: '.85rem' }}>
                    Iniciar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
