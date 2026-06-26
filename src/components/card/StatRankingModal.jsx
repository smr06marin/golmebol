import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const S = {
  navy:    '#07070e',
  card:    '#111827',
  card2:   '#1a2234',
  border:  '#1e2d3d',
  cyan:    '#00ddd0',
  cyanDim: 'rgba(0,221,208,.12)',
  gold:    '#f9a825',
  goldDim: 'rgba(249,168,37,.1)',
  text:    '#e8f4fd',
  text2:   '#b8d4e8',
  muted:   '#7a9ab5',
  win:     '#1e8e3e',
  loss:    '#d93025',
}

const STAT_CONFIG = {
  pj:   { label: 'Partidos Jugados',    icon: '🎮', color: '#1a73e8', campo: 'pj',       descripcion: 'Total de partidos jugados', formato: v => v,                             sufijo: 'PJ'    },
  gc:   { label: 'Goles / Recibidos',   icon: '⚽', color: '#1e8e3e', campo: 'goles',    descripcion: 'Goles anotados o recibidos', formato: v => v,                             sufijo: 'goles' },
  prom: { label: 'Promedio',            icon: '📊', color: '#6c35de', campo: 'promedio', descripcion: 'Promedio de goles por PJ',   formato: v => parseFloat(v).toFixed(2),      sufijo: 'x PJ'  },
  efic: { label: 'Eficacia',            icon: '⚡', color: '#e8710a', campo: 'eficacia', descripcion: '% de partidos ganados',      formato: v => `${v}%`,                       sufijo: ''      },
  pg:   { label: 'Partidos Ganados',    icon: '🏆', color: '#f9a825', campo: 'pg',       descripcion: 'Total de victorias',         formato: v => v,                             sufijo: 'PG'    },
  pe:   { label: 'Partidos Empatados',  icon: '🤝', color: '#9aa0a6', campo: 'pe',       descripcion: 'Total de empates',           formato: v => v,                             sufijo: 'PE'    },
  pp:   { label: 'Partidos Perdidos',   icon: '📉', color: '#d93025', campo: 'pp',       descripcion: 'Total de derrotas',          formato: v => v,                             sufijo: 'PP'    },
}

const FELICITACIONES = [
  '¡Eres el mejor! 🏆',
  '¡Increíble! Segundo en el ranking 🥈',
  '¡Top 3! Sigue así 🥉',
  '¡Estás en el top 4! 💪',
  '¡Top 5! Gran nivel 🔥',
]

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '.6rem', color: S.muted, width: '22px', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px' }}/>
      </div>
      <span style={{ fontSize: '.65rem', fontWeight: '700', color, width: '22px', textAlign: 'right', flexShrink: 0 }}>{value}</span>
    </div>
  )
}

export default function StatRankingModal({ statKey, playerId, esPortero, onClose }) {
  const [rankingCompleto, setRankingCompleto] = useState([])
  const [loading,         setLoading]         = useState(true)
  const [miPuesto,        setMiPuesto]        = useState(null)

  const config = STAT_CONFIG[statKey]

  useEffect(() => { if (config) fetchRanking() }, [statKey])

  async function fetchRanking() {
    setLoading(true)
    const { data: allStats } = await supabase
      .from('player_match_stats')
      .select('player_id, goals_scored, goals_conceded, team_result, players(id, name, photo_face_url, photo_url, posicion_futbol5, posicion_futbol7, posicion_futbol11)')

    if (!allStats) { setLoading(false); return }

    const mapa = {}
    allStats.forEach(s => {
      const pid = s.player_id
      if (!mapa[pid]) {
        mapa[pid] = {
          id: pid,
          nombre: s.players?.name || '?',
          foto: s.players?.photo_face_url || s.players?.photo_url || null,
          esPortero: s.players?.posicion_futbol5 === 'Portero' || s.players?.posicion_futbol7 === 'Portero' || s.players?.posicion_futbol11 === 'Portero',
          pj: 0, goles: 0, recibidos: 0, pg: 0, pe: 0, pp: 0,
        }
      }
      const j = mapa[pid]
      j.pj++
      j.goles     += s.goals_scored   || 0
      j.recibidos += s.goals_conceded || 0
      if (s.team_result === 'win')  j.pg++
      if (s.team_result === 'draw') j.pe++
      if (s.team_result === 'loss') j.pp++
    })

    const jugadores = Object.values(mapa).map(j => ({
      ...j,
      promedio: j.pj > 0 ? parseFloat((j.esPortero ? j.recibidos / j.pj : j.goles / j.pj).toFixed(2)) : 0,
      eficacia: j.pj >= 5 ? Math.round((j.pg / j.pj) * 100) : 0,
    }))

    const sorted = [...jugadores].sort((a, b) => {
      const va = config.campo === 'goles' ? (a.esPortero ? a.recibidos : a.goles) : a[config.campo]
      const vb = config.campo === 'goles' ? (b.esPortero ? b.recibidos : b.goles) : b[config.campo]
      if (config.campo === 'pp') return va - vb
      return vb - va
    })

    const miIdx = sorted.findIndex(j => j.id === playerId)
    if (miIdx >= 0) setMiPuesto({ puesto: miIdx + 1, dato: sorted[miIdx] })

    setRankingCompleto(sorted)
    setLoading(false)
  }

  if (!config) return null

  // Top 5
  const top5 = rankingCompleto.slice(0, 5)
  const maxPJ = Math.max(...top5.map(j => j.pj), 1)
  const maxPG = Math.max(...top5.map(j => j.pg), 1)

  // Contexto del jugador: 3 arriba, el jugador, 3 abajo
  const miIdx       = miPuesto ? miPuesto.puesto - 1 : -1
  const enTop5      = miPuesto && miPuesto.puesto <= 5
  const fuera5      = miPuesto && miPuesto.puesto > 5
  const inicio      = Math.max(5, miIdx - 3)   // empieza desde después del top5
  const fin         = Math.min(rankingCompleto.length, miIdx + 4)
  const contexto    = fuera5 ? rankingCompleto.slice(inicio, fin) : []

  const medallaColor = (i) => i === 0 ? '#f9a825' : i === 1 ? '#b0bec5' : i === 2 ? '#cd7f32' : S.muted
  const medallaIcon  = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

  function getValor(j) {
    return config.campo === 'goles' ? (j.esPortero ? j.recibidos : j.goles) : j[config.campo]
  }

  function FilaJugador({ j, puesto, esYo, compact = false }) {
    const valor = getValor(j)
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: compact ? '10px 20px' : '14px 20px',
        borderBottom: `0.5px solid ${S.border}`,
        background: esYo ? S.cyanDim : 'transparent',
        borderLeft: esYo ? `3px solid ${S.cyan}` : '3px solid transparent',
      }}>
        <div style={{ width: '28px', textAlign: 'center', flexShrink: 0 }}>
          {medallaIcon(puesto - 1)
            ? <span style={{ fontSize: '1rem' }}>{medallaIcon(puesto - 1)}</span>
            : <span style={{ fontSize: '.85rem', fontWeight: '800', color: esYo ? S.cyan : medallaColor(puesto - 1) }}>#{puesto}</span>}
        </div>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: S.border, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: esYo ? `2px solid ${S.cyan}` : 'none' }}>
          {j.foto ? <img src={j.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.75rem' }}>👤</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.85rem', fontWeight: esYo ? '700' : '500', color: esYo ? S.cyan : S.text }}>
            {j.nombre.split(' ')[0]}
            {esYo && <span style={{ marginLeft: '5px', fontSize: '.65rem', color: S.cyan }}>(tú)</span>}
          </div>
          <div style={{ fontSize: '.62rem', color: S.muted }}>{j.esPortero ? '🧤' : '⚽'} · {j.pj} PJ · {j.pg}G {j.pe}E {j.pp}P</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: esYo ? S.cyan : puesto <= 3 ? config.color : S.text }}>
            {config.formato(valor)}
          </div>
          {config.sufijo && <div style={{ fontSize: '.58rem', color: S.muted }}>{config.sufijo}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S.navy, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: `0.5px solid ${S.border}`, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${config.color}22`, border: `1px solid ${config.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
              {config.icon}
            </div>
            <div>
              <div style={{ fontWeight: '700', color: S.text, fontSize: '.95rem' }}>{config.label}</div>
              <div style={{ fontSize: '.68rem', color: S.muted }}>{config.descripcion}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: S.muted }}>Cargando ranking...</div>
          ) : rankingCompleto.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: S.muted }}>Sin datos aún</div>
          ) : (
            <>
              {/* Felicitaciones si está en top 5 */}
              {enTop5 && (
                <div style={{ padding: '14px 20px', background: `linear-gradient(135deg, ${S.goldDim}, ${S.cyanDim})`, borderBottom: `0.5px solid ${S.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>
                    {miPuesto.puesto === 1 ? '🏆' : miPuesto.puesto === 2 ? '🥈' : miPuesto.puesto === 3 ? '🥉' : '🔥'}
                  </div>
                  <div style={{ fontWeight: '800', color: S.gold, fontSize: '.95rem' }}>
                    {FELICITACIONES[miPuesto.puesto - 1]}
                  </div>
                  <div style={{ fontSize: '.72rem', color: S.muted, marginTop: '3px' }}>
                    Estás en el puesto #{miPuesto.puesto} de {rankingCompleto.length} jugadores
                  </div>
                </div>
              )}

              {/* TOP 5 con stats extendidos */}
              <div style={{ padding: '10px 20px 6px', background: `${S.card}88` }}>
                <div style={{ fontSize: '.65rem', fontWeight: '700', color: config.color, letterSpacing: '.1em' }}>TOP 5</div>
              </div>

              {top5.map((j, i) => (
                <div key={j.id}>
                  <FilaJugador j={j} puesto={i + 1} esYo={j.id === playerId}/>
                  {/* Barras de stats solo en top 5 */}
                  {i < 5 && (
                    <div style={{ padding: '6px 20px 10px 70px', borderBottom: `0.5px solid ${S.border}`, background: j.id === playerId ? `${S.cyanDim}88` : 'transparent' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <MiniBar label="PJ"  value={j.pj} max={maxPJ} color="#1a73e8"/>
                        <MiniBar label="PG"  value={j.pg} max={maxPG} color={S.win}/>
                        <MiniBar label="PE"  value={j.pe} max={maxPG} color={S.gold}/>
                        <MiniBar label="PP"  value={j.pp} max={maxPG} color={S.loss}/>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Separador y contexto del jugador si está fuera del top 5 */}
              {fuera5 && contexto.length > 0 && (
                <>
                  <div style={{ padding: '12px 20px 6px', background: `${S.card}88`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '1px', background: S.border }}/>
                    <span style={{ fontSize: '.65rem', color: S.muted, whiteSpace: 'nowrap' }}>Tu posición · #{miPuesto.puesto}</span>
                    <div style={{ flex: 1, height: '1px', background: S.border }}/>
                  </div>
                  {contexto.map((j, i) => {
                    const puesto = inicio + i + 1
                    return <FilaJugador key={j.id} j={j} puesto={puesto} esYo={j.id === playerId} compact/>
                  })}
                </>
              )}

              {/* Footer con resumen */}
              <div style={{ padding: '16px 20px', borderTop: `0.5px solid ${S.border}`, background: `${S.card}66`, textAlign: 'center' }}>
                <div style={{ fontSize: '.7rem', color: S.muted }}>
                  {rankingCompleto.length} jugadores en el ranking
                  {miPuesto && !enTop5 && (
                    <span style={{ color: S.cyan, fontWeight: '700', marginLeft: '6px' }}>
                      · Tú #{miPuesto.puesto}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
