import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  bg:     '#07070e',
  card:   '#0f1623',
  border: '#1e2d3d',
  gold:   '#f9a825',
  cyan:   '#00ddd0',
  text:   '#e8f4fd',
  muted:  '#7a9ab5',
}

function RecordCard({ titulo, nombre, subtitulo, descripcion, color }) {
  return (
    <div style={{
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
      <div style={{ padding: '20px 16px 18px', textAlign: 'center' }}>
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
            <RecordCard {...r}/>
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
  const [totales,  setTotales]  = useState({ partidos: 0, goles: 0, jugadores: 0, torneos: 0 })
  const [campeones,  setCampeones]  = useState([])
  const [showSplash, setShowSplash] = useState(false)

  useEffect(() => { fetchTodo(); fetchCampeonesRecientes() }, [])

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

    const { count: totalJugadores } = await supabase.from('players').select('id', { count: 'exact' }).eq('activo_membresia', true)
    const { count: totalTorneos }   = await supabase.from('tournaments').select('id', { count: 'exact' })
    const totalGoles = (cache || []).reduce((s, r) => s + (r.goles || 0), 0)
    setTotales({ partidos: (matches || []).length, goles: totalGoles, jugadores: totalJugadores || 0, torneos: totalTorneos || 0 })

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
        <div style={{ fontSize: '.7rem', fontWeight: '800', color: S.cyan, letterSpacing: '5px', marginBottom: '12px' }}>GOLMEBOL</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, transparent, ${S.gold})` }}/>
          <div style={{ fontWeight: '900', color: S.gold, fontSize: '1.3rem', letterSpacing: '.06em', textAlign: 'center', lineHeight: 1.3 }}>
            RECORDS GUINNESS<br/>GOLMEBOL
          </div>
          <div style={{ height: '2px', flex: 1, background: `linear-gradient(90deg, ${S.gold}, transparent)` }}/>
        </div>
        <div style={{ fontSize: '.65rem', color: S.muted, letterSpacing: '2px', fontWeight: '700', marginTop: '8px' }}>
          {records.length} RÉCORDS REGISTRADOS
        </div>
      </div>

      {/* Totales */}
      <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
        <StatBox valor={totales.partidos}  label="PARTIDOS"  color={S.cyan}/>
        <StatBox valor={totales.goles}     label="GOLES"     color={S.gold}/>
        <StatBox valor={totales.jugadores} label="JUGADORES" color='#9955ff'/>
        <StatBox valor={totales.torneos}   label="TORNEOS"   color='#e8710a'/>
      </div>

      {/* Carrusel único */}
      <div style={{ padding: '8px 0 32px' }}>
        <Carrusel records={records}/>
      </div>

      {/* Footer login */}
      <div style={{ padding: '24px 16px 48px', borderTop: `1px solid ${S.border}`, textAlign: 'center', background: 'rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: '.72rem', color: S.muted, marginBottom: '16px' }}>¿Eres jugador de Golmebol?</div>
        <button onClick={() => navigate('/jugador/login')}
          style={{ width: '100%', maxWidth: '300px', padding: '13px', background: `linear-gradient(90deg, ${S.cyan}, #1a73e8)`, border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#000', fontWeight: '800', fontSize: '.95rem', letterSpacing: '.5px', display: 'block', margin: '0 auto 12px' }}>
          🎯 Ingresar al portal
        </button>
        <button onClick={() => navigate('/login')}
          style={{ padding: '9px 24px', background: 'none', border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.muted, fontSize: '.75rem' }}>
          Acceso administrador →
        </button>
      </div>
    </div>
  )
}
