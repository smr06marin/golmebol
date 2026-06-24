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
  text2:   '#b8d4e8',
  muted:   '#7a9ab5',
  win:     '#1e8e3e',
}

const STAT_CONFIG = {
  pj: {
    label: 'Partidos Jugados',
    icon: '🎮',
    color: '#1a73e8',
    campo: 'pj',
    descripcion: 'Total de partidos jugados en todos los torneos',
    formato: v => v,
    sufijo: 'PJ',
  },
  gc: {
    label: 'Goles / Goles Concedidos',
    icon: '⚽',
    color: '#1e8e3e',
    campo: 'goles',
    descripcion: 'Goles anotados (jugadores de campo) o recibidos (porteros)',
    formato: v => v,
    sufijo: 'goles',
  },
  prom: {
    label: 'Promedio',
    icon: '📊',
    color: '#6c35de',
    campo: 'promedio',
    descripcion: 'Promedio de goles por partido',
    formato: v => parseFloat(v).toFixed(2),
    sufijo: 'x PJ',
  },
  efic: {
    label: 'Eficacia',
    icon: '⚡',
    color: '#e8710a',
    campo: 'eficacia',
    descripcion: 'Porcentaje de partidos ganados (mínimo 5 PJ)',
    formato: v => `${v}%`,
    sufijo: '',
  },
  pg: {
    label: 'Partidos Ganados',
    icon: '🏆',
    color: '#f9a825',
    campo: 'pg',
    descripcion: 'Total de victorias',
    formato: v => v,
    sufijo: 'PG',
  },
  pe: {
    label: 'Partidos Empatados',
    icon: '🤝',
    color: '#9aa0a6',
    campo: 'pe',
    descripcion: 'Total de empates',
    formato: v => v,
    sufijo: 'PE',
  },
  pp: {
    label: 'Partidos Perdidos',
    icon: '📉',
    color: '#d93025',
    campo: 'pp',
    descripcion: 'Total de derrotas',
    formato: v => v,
    sufijo: 'PP',
  },
}

export default function StatRankingModal({ statKey, playerId, esPortero, onClose }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [miPuesto, setMiPuesto] = useState(null)

  const config = STAT_CONFIG[statKey]

  useEffect(() => {
    if (!config) return
    fetchRanking()
  }, [statKey])

  async function fetchRanking() {
    setLoading(true)

    // Traer todos los stats de jugadores
    const { data: allStats } = await supabase
      .from('player_match_stats')
      .select('player_id, goals_scored, goals_conceded, team_result, players(id, name, photo_face_url, photo_url, posicion_futbol5, posicion_futbol7, posicion_futbol11)')

    if (!allStats) { setLoading(false); return }

    // Agrupar por jugador
    const mapaJugadores = {}
    allStats.forEach(s => {
      const pid = s.player_id
      if (!mapaJugadores[pid]) {
        mapaJugadores[pid] = {
          id: pid,
          nombre: s.players?.name || '?',
          foto: s.players?.photo_face_url || s.players?.photo_url || null,
          esPortero: s.players?.posicion_futbol5 === 'Portero' || s.players?.posicion_futbol7 === 'Portero' || s.players?.posicion_futbol11 === 'Portero',
          pj: 0, goles: 0, recibidos: 0, pg: 0, pe: 0, pp: 0,
        }
      }
      const j = mapaJugadores[pid]
      j.pj++
      j.goles     += s.goals_scored    || 0
      j.recibidos += s.goals_conceded  || 0
      if (s.team_result === 'win')  j.pg++
      if (s.team_result === 'draw') j.pe++
      if (s.team_result === 'loss') j.pp++
    })

    // Calcular métricas derivadas
    const jugadores = Object.values(mapaJugadores).map(j => ({
      ...j,
      promedio: j.pj > 0 ? parseFloat((j.esPortero ? j.recibidos / j.pj : j.goles / j.pj).toFixed(2)) : 0,
      eficacia: j.pj >= 5 ? Math.round((j.pg / j.pj) * 100) : 0,
    }))

    // Ordenar según el stat
    let campo = config.campo
    // Para 'gc' en portero ordenar por recibidos, en campo por goles
    const sorted = [...jugadores].sort((a, b) => {
      const va = campo === 'goles' ? (a.esPortero ? a.recibidos : a.goles) : a[campo]
      const vb = campo === 'goles' ? (b.esPortero ? b.recibidos : b.goles) : b[campo]
      // PP: menor es mejor
      if (campo === 'pp') return va - vb
      return vb - va
    })

    // Encontrar mi puesto (puede estar fuera del top 10)
    const miIdx = sorted.findIndex(j => j.id === playerId)
    setMiPuesto(miIdx >= 0 ? { puesto: miIdx + 1, dato: sorted[miIdx] } : null)

    setRanking(sorted.slice(0, 10))
    setLoading(false)
  }

  if (!config) return null

  const medallaColor = (i) => i === 0 ? '#f9a825' : i === 1 ? '#b0bec5' : i === 2 ? '#cd7f32' : S.muted

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S.navy, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: `0.5px solid ${S.border}`, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${config.color}22`, border: `1px solid ${config.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
              {config.icon}
            </div>
            <div>
              <div style={{ fontWeight: '700', color: S.text, fontSize: '.95rem' }}>{config.label}</div>
              <div style={{ fontSize: '.68rem', color: S.muted, marginTop: '1px' }}>{config.descripcion}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Mi puesto (si no está en top 10) */}
        {miPuesto && miPuesto.puesto > 10 && (
          <div style={{ padding: '10px 20px', borderBottom: `0.5px solid ${S.border}`, background: S.cyanDim, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '.75rem', color: S.cyan, fontWeight: '700' }}>Tu posición: #{miPuesto.puesto}</span>
              <span style={{ fontSize: '.72rem', color: S.muted }}>
                {config.formato(
                  config.campo === 'goles'
                    ? (miPuesto.dato.esPortero ? miPuesto.dato.recibidos : miPuesto.dato.goles)
                    : miPuesto.dato[config.campo]
                )} {config.sufijo}
              </span>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: S.muted, fontSize: '.875rem' }}>Cargando ranking...</div>
          ) : ranking.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: S.muted, fontSize: '.875rem' }}>Sin datos aún</div>
          ) : (
            <>
              {/* Header tabla */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', padding: '10px 20px', background: `${S.card}88`, borderBottom: `0.5px solid ${S.border}`, position: 'sticky', top: 0 }}>
                <div style={{ fontSize: '.65rem', fontWeight: '700', color: S.muted, letterSpacing: '.06em' }}>#</div>
                <div style={{ fontSize: '.65rem', fontWeight: '700', color: S.muted, letterSpacing: '.06em' }}>JUGADOR</div>
                <div style={{ fontSize: '.65rem', fontWeight: '700', color: config.color, letterSpacing: '.06em', textAlign: 'center' }}>{config.sufijo || config.label.toUpperCase().slice(0, 5)}</div>
              </div>

              {ranking.map((j, i) => {
                const esYo   = j.id === playerId
                const valor  = config.campo === 'goles'
                  ? (j.esPortero ? j.recibidos : j.goles)
                  : j[config.campo]

                return (
                  <div key={j.id} style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 80px',
                    padding: '12px 20px',
                    borderBottom: `0.5px solid ${S.border}`,
                    alignItems: 'center',
                    background: esYo ? S.cyanDim : 'transparent',
                    borderLeft: esYo ? `3px solid ${S.cyan}` : '3px solid transparent',
                    transition: 'background .15s',
                  }}>
                    {/* Puesto */}
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: medallaColor(i) }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>

                    {/* Jugador */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: S.border, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: esYo ? `2px solid ${S.cyan}` : 'none' }}>
                        {j.foto
                          ? <img src={j.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          : <span style={{ fontSize: '.75rem' }}>👤</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: '.85rem', fontWeight: esYo ? '700' : '500', color: esYo ? S.cyan : S.text, lineHeight: 1.2 }}>
                          {j.nombre.split(' ')[0]}
                          {esYo && <span style={{ marginLeft: '5px', fontSize: '.65rem', color: S.cyan }}>(tú)</span>}
                        </div>
                        <div style={{ fontSize: '.65rem', color: S.muted, marginTop: '1px' }}>
                          {j.esPortero ? '🧤 Portero' : '⚽ Campo'} · {j.pj} PJ
                        </div>
                      </div>
                    </div>

                    {/* Valor */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: esYo ? S.cyan : i < 3 ? config.color : S.text }}>
                        {config.formato(valor)}
                      </div>
                      {config.sufijo && (
                        <div style={{ fontSize: '.6rem', color: S.muted, marginTop: '1px' }}>{config.sufijo}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer con mi puesto si está en top 10 */}
        {miPuesto && miPuesto.puesto <= 10 && (
          <div style={{ padding: '12px 20px', borderTop: `0.5px solid ${S.border}`, flexShrink: 0, background: S.cyanDim }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '.78rem', color: S.cyan, fontWeight: '700' }}>
                Estás en el puesto #{miPuesto.puesto} 🎯
              </span>
              {miPuesto.puesto === 1 && <span style={{ fontSize: '.75rem', color: S.gold }}>¡Líder del ranking!</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
