import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  bg:     '#07070e',
  card:   '#0f1623',
  border: '#1e2d3d',
  gold:   '#f9a825',
  silver: '#b0bec5',
  bronze: '#a1887f',
  cyan:   '#00ddd0',
  text:   '#e8f4fd',
  muted:  '#7a9ab5',
}

const MEDAL = ['🥇','🥈','🥉']

function RecordCard({ titulo, icono, color, items, campo, label, sufijo = '' }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>{icono}</div>
        <div style={{ fontWeight: '700', color: S.text, fontSize: '.9rem', letterSpacing: '.04em' }}>{titulo}</div>
      </div>
      <div style={{ padding: '8px 0' }}>
        {items.slice(0, 5).map((item, i) => {
          const valor = item[campo]
          const esTop = i === 0
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: esTop ? `${color}11` : 'transparent', borderLeft: esTop ? `3px solid ${color}` : '3px solid transparent' }}>
              <span style={{ fontSize: '.9rem', flexShrink: 0, width: '20px', textAlign: 'center' }}>{MEDAL[i] || <span style={{ fontSize: '.75rem', color: S.muted }}>{i+1}</span>}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: esTop ? '700' : '500', color: esTop ? S.text : S.muted, fontSize: '.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                {item.subtitulo && <div style={{ fontSize: '.68rem', color: S.muted, marginTop: '1px' }}>{item.subtitulo}</div>}
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <span style={{ fontWeight: '900', fontSize: esTop ? '1.1rem' : '.9rem', color: esTop ? color : S.muted, fontFamily: 'monospace' }}>{valor}{sufijo}</span>
                {label && <div style={{ fontSize: '.6rem', color: S.muted, marginTop: '1px' }}>{label}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatBox({ valor, label, color }) {
  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '14px 10px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontWeight: '900', fontSize: '1.6rem', color: color || S.cyan, fontFamily: 'monospace', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '.65rem', color: S.muted, marginTop: '4px', fontWeight: '600', letterSpacing: '.06em' }}>{label}</div>
    </div>
  )
}

export default function RecordsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data,    setData]    = useState({})

  useEffect(() => { fetchRecords() }, [])

  async function fetchRecords() {
    setLoading(true)

    const [
      goleadores, partidos, victorias, rachaGoles, rachaVictorias,
      amarillas, rojas, hatTricks, arcosCero, sinTarjetas,
      equiposGoles, equiposVictorias, equiposPJ,
      torneos, totalPartidos, totalGoles, totalJugadores,
    ] = await Promise.all([
      // Jugadores — goles totales
      supabase.from('player_match_stats').select('player_id, goals_scored, players(name)')
        .gt('goals_scored', 0).order('goals_scored', { ascending: false }).limit(10),

      // Jugadores — más partidos
      supabase.rpc('get_player_stats_sum').then(() => null).catch(() => null),

      // Victorias por jugador
      supabase.from('player_match_stats').select('player_id, team_result, players(name)')
        .eq('team_result', 'win'),

      // Stats cache — racha goles
      supabase.from('player_stats_cache').select('player_id, racha_goles_actual, goles, pj, victorias, hat_tricks, arcos_cero, partidos_sin_tarjetas, racha_victorias_actual, players(name)')
        .order('racha_goles_actual', { ascending: false }).limit(10),

      // Stats cache — racha victorias
      supabase.from('player_stats_cache').select('player_id, racha_victorias_actual, players(name)')
        .order('racha_victorias_actual', { ascending: false }).limit(5),

      // Tarjetas amarillas
      supabase.from('player_match_stats').select('player_id, yellow_cards, players(name)')
        .gt('yellow_cards', 0),

      // Tarjetas rojas
      supabase.from('player_match_stats').select('player_id, red_cards, players(name)')
        .gt('red_cards', 0),

      // Hat tricks
      supabase.from('player_stats_cache').select('player_id, hat_tricks, players(name)')
        .gt('hat_tricks', 0).order('hat_tricks', { ascending: false }).limit(5),

      // Arcos en cero
      supabase.from('player_stats_cache').select('player_id, arcos_cero, players(name)')
        .gt('arcos_cero', 0).order('arcos_cero', { ascending: false }).limit(5),

      // Partidos sin tarjetas
      supabase.from('player_stats_cache').select('player_id, partidos_sin_tarjetas, players(name)')
        .gt('partidos_sin_tarjetas', 0).order('partidos_sin_tarjetas', { ascending: false }).limit(5),

      // Equipos — más goles en matches
      supabase.from('matches').select('home_team_id, away_team_id, home_score, away_score, home:home_team_id(name), away:away_team_id(name)')
        .eq('status', 'finished'),

      // victorias de equipo
      supabase.from('matches').select('home_team_id, away_team_id, home_score, away_score, home:home_team_id(name), away:away_team_id(name)')
        .eq('status', 'finished'),

      // PJ equipos
      supabase.from('matches').select('home_team_id, away_team_id, home:home_team_id(name), away:away_team_id(name)')
        .eq('status', 'finished'),

      // Torneos
      supabase.from('tournaments').select('id, name, modalidad, status').order('created_at', { ascending: false }),

      // Totales globales
      supabase.from('matches').select('id', { count: 'exact' }).eq('status', 'finished'),
      supabase.from('player_match_stats').select('goals_scored'),
      supabase.from('players').select('id', { count: 'exact' }).eq('activo_membresia', true),
    ])

    // Procesar goleadores desde player_stats_cache
    const { data: statsCache } = await supabase
      .from('player_stats_cache')
      .select('player_id, goles, pj, victorias, hat_tricks, arcos_cero, partidos_sin_tarjetas, racha_goles_actual, racha_victorias_actual, players(name, posicion_futbol5, posicion_futbol7, posicion_futbol11)')
      .order('goles', { ascending: false })

    // Goleadores
    const goleadoresData = (statsCache || [])
      .filter(s => s.goles > 0)
      .map(s => ({ name: s.players?.name || '?', [campo('goles')]: s.goles }))
      .slice(0, 5)

    // Más partidos
    const masPartidos = (statsCache || [])
      .filter(s => s.pj > 0)
      .sort((a, b) => b.pj - a.pj)
      .map(s => ({ name: s.players?.name || '?', pj: s.pj }))
      .slice(0, 5)

    // Más victorias
    const masVictorias = (statsCache || [])
      .filter(s => s.victorias > 0)
      .sort((a, b) => b.victorias - a.victorias)
      .map(s => ({ name: s.players?.name || '?', victorias: s.victorias }))
      .slice(0, 5)

    // Racha goles
    const rachaGolesData = (statsCache || [])
      .filter(s => s.racha_goles_actual > 0)
      .sort((a, b) => b.racha_goles_actual - a.racha_goles_actual)
      .map(s => ({ name: s.players?.name || '?', racha: s.racha_goles_actual }))
      .slice(0, 5)

    // Racha victorias
    const rachaVictoriasData = (statsCache || [])
      .filter(s => s.racha_victorias_actual > 0)
      .sort((a, b) => b.racha_victorias_actual - a.racha_victorias_actual)
      .map(s => ({ name: s.players?.name || '?', racha: s.racha_victorias_actual }))
      .slice(0, 5)

    // Hat tricks
    const hatTricksData = (statsCache || [])
      .filter(s => s.hat_tricks > 0)
      .sort((a, b) => b.hat_tricks - a.hat_tricks)
      .map(s => ({ name: s.players?.name || '?', hat_tricks: s.hat_tricks }))
      .slice(0, 5)

    // Arcos en cero
    const arcosCeroData = (statsCache || [])
      .filter(s => {
        const pos = s.players?.posicion_futbol5 || s.players?.posicion_futbol7 || s.players?.posicion_futbol11 || ''
        return pos === 'Portero' && s.arcos_cero > 0
      })
      .sort((a, b) => b.arcos_cero - a.arcos_cero)
      .map(s => ({ name: s.players?.name || '?', arcos_cero: s.arcos_cero }))
      .slice(0, 5)

    // Sin tarjetas
    const sinTarjetasData = (statsCache || [])
      .filter(s => s.partidos_sin_tarjetas > 0)
      .sort((a, b) => b.partidos_sin_tarjetas - a.partidos_sin_tarjetas)
      .map(s => ({ name: s.players?.name || '?', partidos_sin_tarjetas: s.partidos_sin_tarjetas }))
      .slice(0, 5)

    // Tarjetas amarillas y rojas desde player_match_stats
    const { data: tarjetasStats } = await supabase
      .from('player_match_stats')
      .select('player_id, yellow_cards, red_cards, blue_cards, players(name)')

    const amarillasMap = {}, rojasMap = {}, azulesMap = {}
    ;(tarjetasStats || []).forEach(s => {
      const name = s.players?.name || '?'
      const id   = s.player_id
      if (!amarillasMap[id]) amarillasMap[id] = { name, v: 0 }
      if (!rojasMap[id])     rojasMap[id]     = { name, v: 0 }
      if (!azulesMap[id])    azulesMap[id]    = { name, v: 0 }
      amarillasMap[id].v += s.yellow_cards || 0
      rojasMap[id].v     += s.red_cards    || 0
      azulesMap[id].v    += s.blue_cards   || 0
    })
    const amarillasData = Object.values(amarillasMap).filter(x => x.v > 0).sort((a,b) => b.v-a.v).map(x => ({ name: x.name, amarillas: x.v })).slice(0, 5)
    const rojasData     = Object.values(rojasMap).filter(x => x.v > 0).sort((a,b) => b.v-a.v).map(x => ({ name: x.name, rojas: x.v })).slice(0, 5)
    const azulesData    = Object.values(azulesMap).filter(x => x.v > 0).sort((a,b) => b.v-a.v).map(x => ({ name: x.name, azules: x.v })).slice(0, 5)

    // Procesar equipos desde matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, home_score, away_score, home:home_team_id(name), away:away_team_id(name)')
      .eq('status', 'finished')

    const equiposMap = {}
    ;(matchesData || []).forEach(m => {
      const addEquipo = (id, name, gF, gC) => {
        if (!equiposMap[id]) equiposMap[id] = { name, goles: 0, recibidos: 0, pj: 0, victorias: 0, empates: 0, derrotas: 0 }
        equiposMap[id].goles     += gF
        equiposMap[id].recibidos += gC
        equiposMap[id].pj        += 1
        if (gF > gC) equiposMap[id].victorias++
        else if (gF === gC) equiposMap[id].empates++
        else equiposMap[id].derrotas++
      }
      addEquipo(m.home_team_id, m.home?.name || '?', m.home_score || 0, m.away_score || 0)
      addEquipo(m.away_team_id, m.away?.name || '?', m.away_score || 0, m.home_score || 0)
    })

    const equiposArr = Object.values(equiposMap)
    const equiposGolesData     = equiposArr.sort((a,b) => b.goles-a.goles).map(e => ({ name: e.name, goles: e.goles, subtitulo: `${e.pj} partidos` })).slice(0, 5)
    const equiposVictoriasData = [...equiposArr].sort((a,b) => b.victorias-a.victorias).map(e => ({ name: e.name, victorias: e.victorias, subtitulo: `${e.pj} PJ` })).slice(0, 5)
    const equiposPJData        = [...equiposArr].sort((a,b) => b.pj-a.pj).map(e => ({ name: e.name, pj: e.pj, subtitulo: `${e.victorias}G ${e.empates}E ${e.derrotas}D` })).slice(0, 5)

    // Partido más goleador
    const partidoMasGoles = (matchesData || [])
      .map(m => ({ ...m, total: (m.home_score||0) + (m.away_score||0) }))
      .sort((a,b) => b.total-a.total)[0]

    // Goleada más grande
    const mayorGoleada = (matchesData || [])
      .map(m => ({ ...m, diff: Math.abs((m.home_score||0)-(m.away_score||0)) }))
      .sort((a,b) => b.diff-a.diff)[0]

    // Totales globales
    const totalGolesNum = (tarjetasStats || []).reduce((s, r) => s + (r.goals_scored || 0), 0)
    // Contar goles desde stats cache
    const totalGolesReal = (statsCache || []).reduce((s, r) => s + (r.goles || 0), 0)

    setData({
      goleadoresData, masPartidos, masVictorias,
      rachaGolesData, rachaVictoriasData,
      hatTricksData, arcosCeroData, sinTarjetasData,
      amarillasData, rojasData, azulesData,
      equiposGolesData, equiposVictoriasData, equiposPJData,
      partidoMasGoles, mayorGoleada,
      torneos: torneos.data || [],
      totalPartidos: totalPartidos.count || 0,
      totalGoles: totalGolesReal,
      totalJugadores: totalJugadores.count || 0,
    })

    setLoading(false)
  }

  function campo(key) { return key }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.cyan, fontSize: '.9rem', fontWeight: '600' }}>Cargando récords...</div>
    </div>
  )

  const {
    goleadoresData, masPartidos, masVictorias,
    rachaGolesData, rachaVictoriasData,
    hatTricksData, arcosCeroData, sinTarjetasData,
    amarillasData, rojasData, azulesData,
    equiposGolesData, equiposVictoriasData, equiposPJData,
    partidoMasGoles, mayorGoleada,
    torneos, totalPartidos, totalGoles, totalJugadores,
  } = data

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(180deg, #0a0a14 0%, ${S.bg} 100%)`, padding: '32px 16px 24px', textAlign: 'center', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ fontSize: '.72rem', fontWeight: '700', color: S.cyan, letterSpacing: '4px', marginBottom: '8px' }}>GOLMEBOL</div>
        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: S.text, letterSpacing: '.04em', marginBottom: '4px' }}>🏆 RÉCORDS</div>
        <div style={{ fontSize: '.78rem', color: S.muted }}>Estadísticas históricas del torneo</div>
      </div>

      {/* Totales globales */}
      <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
        <StatBox valor={totalPartidos}  label="PARTIDOS"  color={S.cyan}/>
        <StatBox valor={totalGoles}     label="GOLES"     color={S.gold}/>
        <StatBox valor={totalJugadores} label="JUGADORES" color='#9955ff'/>
        <StatBox valor={torneos.length} label="TORNEOS"   color='#e8710a'/>
      </div>

      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Sección jugadores */}
        <div style={{ fontSize: '.68rem', fontWeight: '700', color: S.cyan, letterSpacing: '3px', marginTop: '8px' }}>JUGADORES</div>

        <RecordCard titulo="Máximos Goleadores" icono="⚽" color={S.gold}
          items={goleadoresData} campo="goles" label="goles"/>

        <RecordCard titulo="Más Partidos Jugados" icono="🎮" color={S.cyan}
          items={masPartidos} campo="pj" label="partidos"/>

        <RecordCard titulo="Más Victorias" icono="🏆" color='#9955ff'
          items={masVictorias} campo="victorias" label="victorias"/>

        {rachaGolesData.length > 0 && (
          <RecordCard titulo="Racha de Goles Activa" icono="🔥" color='#e8710a'
            items={rachaGolesData} campo="racha" label="partidos seguidos"/>
        )}

        {rachaVictoriasData.length > 0 && (
          <RecordCard titulo="Racha de Victorias Activa" icono="⚡" color='#00ee55'
            items={rachaVictoriasData} campo="racha" label="victorias seguidas"/>
        )}

        {hatTricksData.length > 0 && (
          <RecordCard titulo="Hat-tricks" icono="🎩" color={S.gold}
            items={hatTricksData} campo="hat_tricks" label="hat-tricks"/>
        )}

        {arcosCeroData.length > 0 && (
          <RecordCard titulo="Arcos en Cero" icono="🧤" color={S.cyan}
            items={arcosCeroData} campo="arcos_cero" label="partidos"/>
        )}

        {sinTarjetasData.length > 0 && (
          <RecordCard titulo="Fair Play · Sin Tarjetas" icono="✅" color='#00ee55'
            items={sinTarjetasData} campo="partidos_sin_tarjetas" label="partidos limpios"/>
        )}

        {amarillasData.length > 0 && (
          <RecordCard titulo="Más Amarillas" icono="🟨" color='#f9a825'
            items={amarillasData} campo="amarillas" label="amarillas"/>
        )}

        {rojasData.length > 0 && (
          <RecordCard titulo="Más Rojas" icono="🟥" color={ROJO}
            items={rojasData} campo="rojas" label="rojas"/>
        )}

        {azulesData.length > 0 && (
          <RecordCard titulo="Más Azules" icono="🟦" color='#4488ff'
            items={azulesData} campo="azules" label="azules"/>
        )}

        {/* Sección equipos */}
        <div style={{ fontSize: '.68rem', fontWeight: '700', color: S.cyan, letterSpacing: '3px', marginTop: '8px' }}>EQUIPOS</div>

        {equiposGolesData.length > 0 && (
          <RecordCard titulo="Más Goles Anotados" icono="⚽" color={S.gold}
            items={equiposGolesData} campo="goles" label="goles"/>
        )}

        {equiposVictoriasData.length > 0 && (
          <RecordCard titulo="Más Victorias" icono="🏆" color='#9955ff'
            items={equiposVictoriasData} campo="victorias" label="victorias"/>
        )}

        {equiposPJData.length > 0 && (
          <RecordCard titulo="Más Partidos Jugados" icono="🎮" color={S.cyan}
            items={equiposPJData} campo="pj" label="partidos"/>
        )}

        {/* Sección partidos especiales */}
        {(partidoMasGoles || mayorGoleada) && (
          <>
            <div style={{ fontSize: '.68rem', fontWeight: '700', color: S.cyan, letterSpacing: '3px', marginTop: '8px' }}>PARTIDOS</div>

            {partidoMasGoles && (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '14px 16px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '700', color: S.gold, letterSpacing: '.08em', marginBottom: '10px' }}>🔥 PARTIDO MÁS GOLEADOR</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: '.82rem', fontWeight: '600', color: S.text }}>{partidoMasGoles.home?.name}</div>
                  <div style={{ fontWeight: '900', fontSize: '1.4rem', color: S.gold, background: `${S.gold}22`, borderRadius: '10px', padding: '4px 14px' }}>
                    {partidoMasGoles.home_score} — {partidoMasGoles.away_score}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', fontSize: '.82rem', fontWeight: '600', color: S.text }}>{partidoMasGoles.away?.name}</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '.68rem', color: S.muted, marginTop: '6px' }}>
                  {partidoMasGoles.total} goles en total
                </div>
              </div>
            )}

            {mayorGoleada && (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '14px 16px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#e8710a', letterSpacing: '.08em', marginBottom: '10px' }}>⚡ MAYOR GOLEADA</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: '.82rem', fontWeight: '600', color: S.text }}>{mayorGoleada.home?.name}</div>
                  <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#e8710a', background: 'rgba(232,113,10,.15)', borderRadius: '10px', padding: '4px 14px' }}>
                    {mayorGoleada.home_score} — {mayorGoleada.away_score}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', fontSize: '.82rem', fontWeight: '600', color: S.text }}>{mayorGoleada.away?.name}</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '.68rem', color: S.muted, marginTop: '6px' }}>
                  Diferencia de {mayorGoleada.diff} goles
                </div>
              </div>
            )}
          </>
        )}

        {/* Torneos */}
        {torneos.length > 0 && (
          <>
            <div style={{ fontSize: '.68rem', fontWeight: '700', color: S.cyan, letterSpacing: '3px', marginTop: '8px' }}>TORNEOS</div>
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', overflow: 'hidden' }}>
              {torneos.map((t, i) => (
                <div key={t.id} style={{ padding: '12px 16px', borderBottom: i < torneos.length - 1 ? `1px solid ${S.border}` : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.status === 'active' ? '#00ee55' : S.muted, flexShrink: 0 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: S.text, fontSize: '.85rem' }}>{t.name}</div>
                    <div style={{ fontSize: '.68rem', color: S.muted, marginTop: '2px' }}>{t.modalidad}</div>
                  </div>
                  <span style={{ fontSize: '.65rem', fontWeight: '700', color: t.status === 'active' ? '#00ee55' : S.muted, background: t.status === 'active' ? 'rgba(0,238,85,.12)' : `${S.border}`, borderRadius: '20px', padding: '2px 10px' }}>
                    {t.status === 'active' ? 'EN CURSO' : t.status === 'finished' ? 'FINALIZADO' : 'PENDIENTE'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      {/* Footer login */}
      <div style={{ padding: '24px 16px 40px', borderTop: `1px solid ${S.border}`, textAlign: 'center' }}>
        <div style={{ fontSize: '.78rem', color: S.muted, marginBottom: '16px' }}>¿Eres jugador de Golmebol?</div>
        <button onClick={() => navigate('/jugador/login')}
          style={{ padding: '12px 32px', background: 'linear-gradient(90deg, #00ddd0, #1a73e8)', border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#000', fontWeight: '800', fontSize: '.95rem', letterSpacing: '.5px', marginBottom: '10px', width: '100%', maxWidth: '300px', display: 'block', margin: '0 auto 10px' }}>
          🎯 Ingresar al portal
        </button>
        <button onClick={() => navigate('/login')}
          style={{ padding: '10px 24px', background: 'none', border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.muted, fontSize: '.75rem', display: 'block', margin: '10px auto 0' }}>
          Acceso administrador →
        </button>
      </div>
    </div>
  )
}

const ROJO = '#d93025'
