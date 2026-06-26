import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const S = {
  navy:    '#07070e',
  card:    '#111827',
  border:  '#1e2d3d',
  cyan:    '#00ddd0',
  cyanDim: 'rgba(0,221,208,.12)',
  gold:    '#f9a825',
  goldDim: 'rgba(249,168,37,.1)',
  text:    '#e8f4fd',
  muted:   '#7a9ab5',
  win:     '#1e8e3e',
  loss:    '#d93025',
}

const STAT_CONFIG = {
  pj:   { label: 'Partidos Jugados',   icon: '🎮', color: '#1a73e8', campo: 'pj',       descripcion: 'Total de partidos jugados',  formato: v => v,                         sufijo: 'PJ'    },
  gc:   { label: 'Goles / Recibidos',  icon: '⚽', color: '#1e8e3e', campo: 'goles',    descripcion: 'Goles anotados o recibidos', formato: v => v,                         sufijo: 'goles' },
  prom: { label: 'Promedio',           icon: '📊', color: '#6c35de', campo: 'promedio', descripcion: 'Promedio de goles por PJ',   formato: v => parseFloat(v).toFixed(2),  sufijo: 'x PJ'  },
  efic: { label: 'Eficacia',           icon: '⚡', color: '#e8710a', campo: 'eficacia', descripcion: '% de partidos ganados',      formato: v => `${v}%`,                   sufijo: ''      },
  pg:   { label: 'Partidos Ganados',   icon: '🏆', color: '#f9a825', campo: 'pg',       descripcion: 'Total de victorias',         formato: v => v,                         sufijo: 'PG'    },
  pe:   { label: 'Partidos Empatados', icon: '🤝', color: '#9aa0a6', campo: 'pe',       descripcion: 'Total de empates',           formato: v => v,                         sufijo: 'PE'    },
  pp:   { label: 'Partidos Perdidos',  icon: '📉', color: '#d93025', campo: 'pp',       descripcion: 'Total de derrotas',          formato: v => v,                         sufijo: 'PP'    },
}

const FELICITACIONES = [
  '¡Eres el #1! 🏆',
  '¡Segundo lugar! 🥈',
  '¡Top 3! Sigue así 🥉',
  '¡Estás en el top 4! 💪',
  '¡Top 5! Gran nivel 🔥',
]

export default function StatRankingModal({ statKey, playerId, esPortero, onClose }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [miPuesto, setMiPuesto] = useState(null)

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
    if (miIdx >= 0) setMiPuesto({ puesto: miIdx + 1, dato: sorted[miIdx], idx: miIdx })
    setRanking(sorted)
    setLoading(false)
  }

  if (!config) return null

  function getValor(j) {
    return config.campo === 'goles' ? (j.esPortero ? j.recibidos : j.goles) : j[config.campo]
  }

  const medallaIcon = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

  function Fila({ j, puesto, esYo }) {
    const valor = getValor(j)
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 20px',
        borderBottom: `0.5px solid ${S.border}`,
        background: esYo ? S.cyanDim : 'transparent',
        borderLeft: esYo ? `3px solid ${S.cyan}` : '3px solid transparent',
      }}>
        {/* Puesto */}
        <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>
          {medallaIcon(puesto - 1)
            ? <span style={{ fontSize: '1.1rem' }}>{medallaIcon(puesto - 1)}</span>
            : <span style={{ fontSize: '.85rem', fontWeight: '800', color: esYo ? S.cyan : S.muted }}>#{puesto}</span>}
        </div>

        {/* Foto */}
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: S.border, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: esYo ? `2px solid ${S.cyan}` : 'none' }}>
          {j.foto ? <img src={j.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.8rem' }}>👤</span>}
        </div>

        {/* Nombre */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.88rem', fontWeight: esYo ? '800' : '500', color: esYo ? S.cyan : S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {j.nombre.split(' ')[0]}
            {esYo && <span style={{ marginLeft: '6px', fontSize: '.65rem', color: S.cyan, fontWeight: '600' }}>(tú)</span>}
          </div>
        </div>

        {/* Valor */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: '1.15rem', fontWeight: '900', color: esYo ? S.cyan : puesto <= 3 ? config.color : S.text }}>
            {config.formato(valor)}
          </span>
          {config.sufijo && <span style={{ fontSize: '.65rem', color: S.muted, marginLeft: '4px' }}>{config.sufijo}</span>}
        </div>
      </div>
    )
  }

  const top5       = ranking.slice(0, 5)
  const enTop5     = miPuesto && miPuesto.puesto <= 5
  const fuera5     = miPuesto && miPuesto.puesto > 5
  const miIdx      = miPuesto?.idx ?? -1
  const inicio     = Math.max(5, miIdx - 2)
  const fin        = Math.min(ranking.length, miIdx + 3)
  const contexto   = fuera5 ? ranking.slice(inicio, fin) : []

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
          ) : ranking.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: S.muted }}>Sin datos aún</div>
          ) : (
            <>
              {/* Felicitaciones si está en top 5 */}
              {enTop5 && (
                <div style={{ padding: '12px 20px', background: `linear-gradient(135deg, ${S.goldDim}, ${S.cyanDim})`, borderBottom: `0.5px solid ${S.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '2px' }}>
                    {miPuesto.puesto === 1 ? '🏆' : miPuesto.puesto === 2 ? '🥈' : miPuesto.puesto === 3 ? '🥉' : '🔥'}
                  </div>
                  <div style={{ fontWeight: '800', color: S.gold, fontSize: '.9rem' }}>
                    {FELICITACIONES[miPuesto.puesto - 1]}
                  </div>
                </div>
              )}

              {/* Label TOP 5 */}
              <div style={{ padding: '8px 20px 4px', background: `${S.card}88` }}>
                <span style={{ fontSize: '.63rem', fontWeight: '700', color: config.color, letterSpacing: '.1em' }}>TOP 5</span>
              </div>

              {/* Filas top 5 */}
              {top5.map((j, i) => (
                <Fila key={j.id} j={j} puesto={i + 1} esYo={j.id === playerId}/>
              ))}

              {/* Contexto del jugador fuera del top 5 */}
              {fuera5 && contexto.length > 0 && (
                <>
                  <div style={{ padding: '10px 20px 4px', background: `${S.card}88`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '1px', background: S.border }}/>
                    <span style={{ fontSize: '.63rem', color: S.muted, whiteSpace: 'nowrap' }}>tu posición · #{miPuesto.puesto}</span>
                    <div style={{ flex: 1, height: '1px', background: S.border }}/>
                  </div>
                  {contexto.map((j, i) => (
                    <Fila key={j.id} j={j} puesto={inicio + i + 1} esYo={j.id === playerId}/>
                  ))}
                </>
              )}

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: `0.5px solid ${S.border}`, textAlign: 'center' }}>
                <span style={{ fontSize: '.68rem', color: S.muted }}>
                  {ranking.length} jugadores · {miPuesto ? `Tú en #${miPuesto.puesto}` : 'Sin datos tuyos'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
