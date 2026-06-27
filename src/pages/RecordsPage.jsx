import { useState, useEffect } from 'react'
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

function RecordBlock({ titulo, nombre, subtitulo, descripcion, icono, color }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1.5px solid ${color}55`,
      borderRadius: '14px',
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${color}, ${color}44)` }}/>
      <div style={{ fontSize: '.65rem', fontWeight: '800', color: color, letterSpacing: '2px', marginBottom: '6px', textTransform: 'uppercase' }}>
        {icono} {titulo}
      </div>
      <div style={{ fontWeight: '900', color: S.text, fontSize: '1.05rem', letterSpacing: '.04em', marginBottom: '4px', lineHeight: 1.2 }}>
        {nombre}
      </div>
      {subtitulo && (
        <div style={{ fontSize: '.72rem', color: color, fontWeight: '700', marginBottom: '2px' }}>{subtitulo}</div>
      )}
      {descripcion && (
        <div style={{ fontSize: '.68rem', color: S.muted, fontWeight: '500' }}>{descripcion}</div>
      )}
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

export default function RecordsPage() {
  const navigate = useNavigate()
  const [loading,     setLoading]     = useState(true)
  const [automaticos, setAutomaticos] = useState([])
  const [historicos,  setHistoricos]  = useState([])
  const [totales,     setTotales]     = useState({ partidos: 0, goles: 0, jugadores: 0, torneos: 0 })

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    await Promise.all([fetchAutomaticos(), fetchHistoricos()])
    setLoading(false)
  }

  async function fetchHistoricos() {
    const { data } = await supabase
      .from('records_historicos')
      .select('*')
      .eq('activo', true)
      .order('orden')
    setHistoricos(data || [])
  }

  async function fetchAutomaticos() {
    // Stats cache completo
    const { data: cache } = await supabase
      .from('player_stats_cache')
      .select('*, players(name, posicion_futbol5, posicion_futbol7, posicion_futbol11)')

    // Stats por partido (para récords por partido)
    const { data: statsPorPartido } = await supabase
      .from('player_match_stats')
      .select('*, players(name), matches(home_score, away_score, played_at, home:home_team_id(name), away:away_team_id(name))')
      .gt('goals_scored', 0)
      .order('goals_scored', { ascending: false })

    // Partidos terminados
    const { data: matches } = await supabase
      .from('matches')
      .select('*, home:home_team_id(name), away:away_team_id(name)')
      .eq('status', 'finished')

    // Totales
    const { count: totalJugadores } = await supabase.from('players').select('id', { count: 'exact' }).eq('activo_membresia', true)
    const { count: totalTorneos }   = await supabase.from('tournaments').select('id', { count: 'exact' })

    const totalGoles    = (cache || []).reduce((s, r) => s + (r.goles || 0), 0)
    const totalPartidos = (matches || []).length

    setTotales({ partidos: totalPartidos, goles: totalGoles, jugadores: totalJugadores || 0, torneos: totalTorneos || 0 })

    const records = []

    // 1. MÁXIMO GOLEADOR HISTÓRICO
    const goleadores = [...(cache || [])].sort((a, b) => b.goles - a.goles)
    if (goleadores[0]?.goles > 0) {
      records.push({
        id: 'max_goleador',
        titulo: `${goleadores[0].goles} GOLES HISTÓRICOS`,
        nombre: goleadores[0].players?.name?.toUpperCase() || '?',
        subtitulo: `${goleadores[0].pj} partidos jugados`,
        descripcion: `Promedio de ${goleadores[0].pj > 0 ? (goleadores[0].goles / goleadores[0].pj).toFixed(2) : 0} goles por partido`,
        icono: '⚽',
        color: S.gold,
        orden: 1,
      })
    }

    // 2. MÁS GOLES EN UN SOLO PARTIDO
    const masGolesPartido = [...(statsPorPartido || [])].sort((a, b) => b.goals_scored - a.goals_scored)[0]
    if (masGolesPartido?.goals_scored >= 2) {
      records.push({
        id: 'mas_goles_partido',
        titulo: `${masGolesPartido.goals_scored} GOLES EN UN PARTIDO`,
        nombre: masGolesPartido.players?.name?.toUpperCase() || '?',
        subtitulo: `${masGolesPartido.matches?.home?.name} vs ${masGolesPartido.matches?.away?.name}`,
        descripcion: masGolesPartido.matches?.played_at ? new Date(masGolesPartido.matches.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
        icono: '🔥',
        color: '#e8710a',
        orden: 2,
      })
    }

    // 3. PARTIDO MÁS GOLEADOR
    const masGoles = [...(matches || [])].map(m => ({ ...m, total: (m.home_score || 0) + (m.away_score || 0) })).sort((a, b) => b.total - a.total)[0]
    if (masGoles?.total > 0) {
      records.push({
        id: 'partido_mas_goleador',
        titulo: `${masGoles.total} GOLES EN UN PARTIDO`,
        nombre: `${masGoles.home?.name?.toUpperCase()} ${masGoles.home_score} — ${masGoles.away_score} ${masGoles.away?.name?.toUpperCase()}`,
        subtitulo: 'PARTIDO MÁS GOLEADOR',
        descripcion: masGoles.played_at ? new Date(masGoles.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
        icono: '💥',
        color: '#d93025',
        orden: 3,
      })
    }

    // 4. MAYOR GOLEADA
    const mayorGoleada = [...(matches || [])].map(m => ({ ...m, diff: Math.abs((m.home_score || 0) - (m.away_score || 0)) })).sort((a, b) => b.diff - a.diff)[0]
    if (mayorGoleada?.diff >= 3) {
      records.push({
        id: 'mayor_goleada',
        titulo: `GOLEADA DE ${mayorGoleada.diff} GOLES`,
        nombre: `${mayorGoleada.home?.name?.toUpperCase()} ${mayorGoleada.home_score} — ${mayorGoleada.away_score} ${mayorGoleada.away?.name?.toUpperCase()}`,
        subtitulo: 'MAYOR GOLEADA DE LA HISTORIA',
        descripcion: mayorGoleada.played_at ? new Date(mayorGoleada.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
        icono: '⚡',
        color: '#9955ff',
        orden: 4,
      })
    }

    // 5. MÁS VICTORIAS
    const masVictorias = [...(cache || [])].sort((a, b) => b.victorias - a.victorias)[0]
    if (masVictorias?.victorias > 0) {
      records.push({
        id: 'mas_victorias',
        titulo: `${masVictorias.victorias} VICTORIAS`,
        nombre: masVictorias.players?.name?.toUpperCase() || '?',
        subtitulo: `En ${masVictorias.pj} partidos jugados`,
        descripcion: `${masVictorias.pj > 0 ? Math.round((masVictorias.victorias / masVictorias.pj) * 100) : 0}% de eficacia`,
        icono: '🏆',
        color: S.gold,
        orden: 5,
      })
    }

    // 6. RACHA DE VICTORIAS
    const masRachaVic = [...(cache || [])].sort((a, b) => (b.racha_victorias_max || b.racha_victorias_actual || 0) - (a.racha_victorias_max || a.racha_victorias_actual || 0))[0]
    const rachaVic = masRachaVic?.racha_victorias_max || masRachaVic?.racha_victorias_actual || 0
    if (rachaVic >= 2) {
      records.push({
        id: 'racha_victorias',
        titulo: `${rachaVic} VICTORIAS SEGUIDAS`,
        nombre: masRachaVic.players?.name?.toUpperCase() || '?',
        subtitulo: 'MAYOR RACHA DE VICTORIAS CONSECUTIVAS',
        descripcion: masRachaVic.racha_victorias_actual === rachaVic ? '🔥 Racha activa' : 'Récord histórico',
        icono: '⚡',
        color: '#00ee55',
        orden: 6,
      })
    }

    // 7. MÁS PARTIDOS JUGADOS
    const masPartidos = [...(cache || [])].sort((a, b) => b.pj - a.pj)[0]
    if (masPartidos?.pj > 0) {
      records.push({
        id: 'mas_partidos',
        titulo: `${masPartidos.pj} PARTIDOS JUGADOS`,
        nombre: masPartidos.players?.name?.toUpperCase() || '?',
        subtitulo: 'MÁS PARTIDOS EN LA HISTORIA',
        descripcion: `${masPartidos.victorias || 0}G · ${masPartidos.empates || 0}E · ${masPartidos.derrotas || 0}D`,
        icono: '🎮',
        color: S.cyan,
        orden: 7,
      })
    }

    // 8. HAT-TRICKS
    const masHat = [...(cache || [])].sort((a, b) => b.hat_tricks - a.hat_tricks)[0]
    if (masHat?.hat_tricks > 0) {
      records.push({
        id: 'hat_tricks',
        titulo: `${masHat.hat_tricks} HAT-TRICK${masHat.hat_tricks > 1 ? 'S' : ''}`,
        nombre: masHat.players?.name?.toUpperCase() || '?',
        subtitulo: 'MÁS HAT-TRICKS EN LA HISTORIA',
        descripcion: '3 o más goles en un solo partido',
        icono: '🎩',
        color: S.gold,
        orden: 8,
      })
    }

    // 9. ARCOS EN CERO (PORTERO)
    const porteros = (cache || []).filter(s => {
      const pos = s.players?.posicion_futbol5 || s.players?.posicion_futbol7 || s.players?.posicion_futbol11 || ''
      return pos === 'Portero'
    })
    const masArcos = [...porteros].sort((a, b) => b.arcos_cero - a.arcos_cero)[0]
    if (masArcos?.arcos_cero > 0) {
      records.push({
        id: 'arcos_cero',
        titulo: `${masArcos.arcos_cero} ARCOS EN CERO`,
        nombre: masArcos.players?.name?.toUpperCase() || '?',
        subtitulo: 'MEJOR ARQUERO · VALLA MENOS VENCIDA',
        descripcion: `En ${masArcos.pj} partidos jugados como portero`,
        icono: '🧤',
        color: S.cyan,
        orden: 9,
      })
    }

    // 10. FAIR PLAY - MÁS PARTIDOS SIN TARJETAS
    const masSinTarjetas = [...(cache || [])].filter(s => s.partidos_sin_tarjetas > 0).sort((a, b) => b.partidos_sin_tarjetas - a.partidos_sin_tarjetas)[0]
    if (masSinTarjetas?.partidos_sin_tarjetas > 0) {
      records.push({
        id: 'fair_play',
        titulo: `${masSinTarjetas.partidos_sin_tarjetas} PARTIDOS SIN TARJETAS`,
        nombre: masSinTarjetas.players?.name?.toUpperCase() || '?',
        subtitulo: 'FAIR PLAY · JUEGO LIMPIO',
        descripcion: `De ${masSinTarjetas.pj} partidos jugados`,
        icono: '✅',
        color: '#00ee55',
        orden: 10,
      })
    }

    // 11. EQUIPO MÁS GOLEADOR
    const equiposMap = {}
    ;(matches || []).forEach(m => {
      const add = (id, name, gF, gC) => {
        if (!equiposMap[id]) equiposMap[id] = { name, goles: 0, recibidos: 0, pj: 0, victorias: 0 }
        equiposMap[id].goles     += gF
        equiposMap[id].recibidos += gC
        equiposMap[id].pj        += 1
        if (gF > gC) equiposMap[id].victorias++
      }
      add(m.home_team_id, m.home?.name, m.home_score || 0, m.away_score || 0)
      add(m.away_team_id, m.away?.name, m.away_score || 0, m.home_score || 0)
    })
    const equiposArr = Object.values(equiposMap).filter(e => e.name)
    const masGolEq   = [...equiposArr].sort((a, b) => b.goles - a.goles)[0]
    if (masGolEq?.goles > 0) {
      records.push({
        id: 'equipo_goleador',
        titulo: `${masGolEq.goles} GOLES ANOTADOS`,
        nombre: masGolEq.name?.toUpperCase() || '?',
        subtitulo: 'EQUIPO MÁS GOLEADOR',
        descripcion: `En ${masGolEq.pj} partidos · ${masGolEq.victorias} victorias`,
        icono: '⚽',
        color: '#e8710a',
        orden: 11,
      })
    }

    // 12. EQUIPO MÁS VICTORIOSO
    const masVicEq = [...equiposArr].sort((a, b) => b.victorias - a.victorias)[0]
    if (masVicEq?.victorias > 0) {
      records.push({
        id: 'equipo_victorias',
        titulo: `${masVicEq.victorias} VICTORIAS`,
        nombre: masVicEq.name?.toUpperCase() || '?',
        subtitulo: 'EQUIPO MÁS VICTORIOSO',
        descripcion: `${masVicEq.pj} partidos · ${masVicEq.goles} goles anotados`,
        icono: '🏆',
        color: S.gold,
        orden: 12,
      })
    }

    // 13. RACHA GOLES CONSECUTIVOS
    const masRachaGol = [...(cache || [])].sort((a, b) => (b.racha_goles_actual || 0) - (a.racha_goles_actual || 0))[0]
    if (masRachaGol?.racha_goles_actual >= 2) {
      records.push({
        id: 'racha_goles',
        titulo: `GOLES EN ${masRachaGol.racha_goles_actual} PARTIDOS SEGUIDOS`,
        nombre: masRachaGol.players?.name?.toUpperCase() || '?',
        subtitulo: '🔥 RACHA GOLEADORA ACTIVA',
        descripcion: 'Marcó en partidos consecutivos',
        icono: '🔥',
        color: '#e8710a',
        orden: 13,
      })
    }

    setAutomaticos(records.sort((a, b) => a.orden - b.orden))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '2rem' }}>🏆</div>
      <div style={{ color: S.cyan, fontSize: '.9rem', fontWeight: '600' }}>Cargando récords...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #0a0a14 0%, #07070e 100%)', padding: '36px 16px 28px', textAlign: 'center', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ fontSize: '.7rem', fontWeight: '800', color: S.cyan, letterSpacing: '5px', marginBottom: '10px' }}>GOLMEBOL</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg, transparent, ${S.gold})` }}/>
          <div style={{ fontWeight: '900', color: S.gold, fontSize: '1.6rem', letterSpacing: '.08em' }}>RÉCORDS</div>
          <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg, ${S.gold}, transparent)` }}/>
        </div>
        <div style={{ fontSize: '.75rem', color: S.muted, letterSpacing: '.08em' }}>GUINNESS · GOLMEBOL</div>
      </div>

      {/* Totales */}
      <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
        <StatBox valor={totales.partidos}  label="PARTIDOS"  color={S.cyan}/>
        <StatBox valor={totales.goles}     label="GOLES"     color={S.gold}/>
        <StatBox valor={totales.jugadores} label="JUGADORES" color='#9955ff'/>
        <StatBox valor={totales.torneos}   label="TORNEOS"   color='#e8710a'/>
      </div>

      <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Récords automáticos */}
        {automaticos.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 4px' }}>
              <div style={{ height: '1px', flex: 1, background: S.border }}/>
              <span style={{ fontSize: '.62rem', fontWeight: '800', color: S.cyan, letterSpacing: '3px' }}>RÉCORDS ACTUALES</span>
              <div style={{ height: '1px', flex: 1, background: S.border }}/>
            </div>
            {automaticos.map(r => (
              <RecordBlock key={r.id} {...r}/>
            ))}
          </>
        )}

        {/* Récords históricos manuales */}
        {historicos.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0 4px' }}>
              <div style={{ height: '1px', flex: 1, background: S.border }}/>
              <span style={{ fontSize: '.62rem', fontWeight: '800', color: S.gold, letterSpacing: '3px' }}>RÉCORDS HISTÓRICOS</span>
              <div style={{ height: '1px', flex: 1, background: S.border }}/>
            </div>
            {historicos.map(r => (
              <RecordBlock key={r.id} {...r}/>
            ))}
          </>
        )}

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
