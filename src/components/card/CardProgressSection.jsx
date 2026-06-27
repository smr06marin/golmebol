import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const S = {
  navy:    '#07070e',
  card:    '#111827',
  border:  '#1e2d3d',
  cyan:    '#00ddd0',
  cyanDim: 'rgba(0,221,208,.12)',
  gold:    '#f9a825',
  text:    '#e8f4fd',
  muted:   '#7a9ab5',
  win:     '#1e8e3e',
  winDim:  'rgba(30,142,62,.12)',
}

const CARD_COLORS = {
  '11111111-0000-0000-0000-000000000001': '#00ee55',
  '11111111-0000-0000-0000-000000000002': '#4488FF',
  '11111111-0000-0000-0000-000000000003': '#9955ff',
  '11111111-0000-0000-0000-000000000004': '#f9a825',
}

const CARD_ICONS = {
  '11111111-0000-0000-0000-000000000001': '🟢',
  '11111111-0000-0000-0000-000000000002': '🔵',
  '11111111-0000-0000-0000-000000000003': '🟣',
  '11111111-0000-0000-0000-000000000004': '👑',
}

export default function CardProgressSection({ playerId, esPortero, posicionDetallada }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [verSiguiente, setVerSiguiente] = useState(false)

  useEffect(() => { if (playerId) fetchProgreso() }, [playerId])

  // Detectar tipo de posición
  function getPosicion() {
    if (esPortero) return 'arquero'
    const defensas = ['Cierre','Defensa central','Lateral derecho','Lateral izquierdo','Mediocampista defensivo']
    if (posicionDetallada && defensas.some(d => posicionDetallada.includes(d))) return 'defensa'
    return 'campo'
  }

  async function fetchProgreso() {
    setLoading(true)
    const pos = getPosicion()

    // Traer todas las tarjetas y subniveles
    const { data: cards }  = await supabase.from('cards').select('*').order('orden')
    const { data: levels } = await supabase.from('card_levels').select('*').order('subnivel')

    // Traer progreso del jugador
    const { data: progreso } = await supabase
      .from('player_card_level_progress')
      .select('*')
      .eq('player_id', playerId)

    // Traer logros y su progreso
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .in('tipo', ['universal', pos])

    const { data: achProgress } = await supabase
      .from('player_achievement_progress')
      .select('*')
      .eq('player_id', playerId)

    const progresoMap = {}
    ;(progreso || []).forEach(p => { progresoMap[p.card_level_id] = p })

    const achMap = {}
    ;(achProgress || []).forEach(p => { achMap[p.achievement_id] = p })

    // Encontrar subnivel activo (último desbloqueado) y siguiente
    let subnivel_activo  = null
    let subnivel_siguiente = null

    for (const card of (cards || [])) {
      const lvls = (levels || []).filter(l => l.card_id === card.id).sort((a,b) => a.subnivel - b.subnivel)
      for (let i = 0; i < lvls.length; i++) {
        const lvl  = lvls[i]
        const prog = progresoMap[lvl.id]
        if (prog?.desbloqueada) {
          subnivel_activo = { ...lvl, card, prog }
          subnivel_siguiente = lvls[i + 1] ? { ...lvls[i + 1], card } : null
        } else if (!subnivel_activo) {
          // Primer subnivel sin desbloquear = el actual a trabajar
          subnivel_activo = { ...lvl, card, prog: prog || { logros_completados: 0, desbloqueada: false } }
          subnivel_siguiente = null
          break
        }
      }
      if (subnivel_activo && !subnivel_activo.desbloqueada) break
    }

    // Si todos desbloqueados, el activo es el último
    if (!subnivel_activo && (levels || []).length > 0) {
      const last = levels[levels.length - 1]
      const card = cards.find(c => c.id === last.card_id)
      subnivel_activo = { ...last, card, prog: progresoMap[last.id] || { logros_completados: 0, desbloqueada: false } }
    }

    // Logros del subnivel activo
    const logrosActivo = subnivel_activo
      ? (achievements || [])
          .filter(a => a.card_level_id === subnivel_activo.id)
          .sort((a,b) => {
            const orden = { universal: 0, campo: 1, defensa: 1, arquero: 1 }
            return (orden[a.tipo] - orden[b.tipo]) || (a.orden - b.orden)
          })
      : []

    // Logros del subnivel siguiente
    const logrosSiguiente = subnivel_siguiente
      ? (achievements || [])
          .filter(a => a.card_level_id === subnivel_siguiente.id)
          .sort((a,b) => {
            const orden = { universal: 0, campo: 1, defensa: 1, arquero: 1 }
            return (orden[a.tipo] - orden[b.tipo]) || (a.orden - b.orden)
          })
      : []

    // Traer cache de stats para mostrar progreso
    const { data: cache } = await supabase
      .from('player_stats_cache')
      .select('*')
      .eq('player_id', playerId)
      .single()
    
    setData({
      cards: cards || [],
      levels: levels || [],
      progresoMap,
      achMap,
      subnivel_activo,
      subnivel_siguiente,
      logrosActivo,
      logrosSiguiente,
      cache: cache || {},
      pos,
    })
    setLoading(false)
  }

  function getValorActual(stat_key, cache) {
    const mapa = {
      pj:                     cache.pj,
      victorias:              cache.victorias,
      goles:                  cache.goles,
      dobletes:               cache.dobletes,
      hat_tricks:             cache.hat_tricks,
      racha_goles_actual:     cache.racha_goles_actual,
      racha_victorias_actual: cache.racha_victorias_actual,
      arcos_cero:             cache.arcos_cero,
      partidos_sin_tarjetas:  cache.partidos_sin_tarjetas,
      campeonatos:            cache.campeonatos,
      mejor_arquero_count:    cache.mejor_arquero_count,
      valla_menos_vencida_count: cache.valla_menos_vencida_count,
      goleador_torneo_count:  cache.goleador_torneo_count,
    }
    return mapa[stat_key] || 0
  }

  if (loading) return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#9aa0a6', fontSize: '.8rem' }}>
      Cargando progreso...
    </div>
  )

  if (!data) return null

  const { subnivel_activo, subnivel_siguiente, logrosActivo, logrosSiguiente, achMap, cache, progresoMap } = data
  if (!subnivel_activo) return null

  const cardColor     = CARD_COLORS[subnivel_activo.card?.id] || '#00ee55'
  const cardIcon      = CARD_ICONS[subnivel_activo.card?.id]  || '🟢'
  const logrosCompletos = logrosActivo.filter(a => achMap[a.id]?.completado).length
  const totalLogros   = logrosActivo.length
  const requeridos    = subnivel_activo.logros_requeridos || 3
  const desbloqueada  = subnivel_activo.prog?.desbloqueada || logrosCompletos >= requeridos
  const pct           = totalLogros > 0 ? Math.round((logrosCompletos / requeridos) * 100) : 0

  // Subnivel siguiente logros
  const logrosSigCompletos = logrosSiguiente.filter(a => achMap[a.id]?.completado).length

  return (
    <div style={{ padding: '0 16px 24px' }}>

      {/* Header tarjeta actual */}
      <div style={{ background: '#07070e', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${cardColor}33` }}>

        {/* Título */}
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${cardColor}22`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.3rem' }}>{cardIcon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '800', color: cardColor, fontSize: '.9rem', letterSpacing: '.06em' }}>
              {subnivel_activo.card?.nombre} · {subnivel_activo.nombre}
            </div>
            <div style={{ fontSize: '.68rem', color: S.muted, marginTop: '2px' }}>
              {desbloqueada ? '✓ Desbloqueada' : `Necesitas ${requeridos} de ${totalLogros} logros`}
            </div>
          </div>
          {desbloqueada && (
            <span style={{ fontSize: '.72rem', fontWeight: '700', color: S.win, background: S.winDim, borderRadius: '20px', padding: '3px 10px' }}>
              ✓ Activa
            </span>
          )}
        </div>

        {/* Barra de progreso */}
        <div style={{ padding: '12px 16px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '.68rem', color: S.muted }}>Progreso de logros</span>
            <span style={{ fontSize: '.72rem', fontWeight: '700', color: logrosCompletos >= requeridos ? S.win : cardColor }}>
              {logrosCompletos}/{totalLogros} · {Math.min(logrosCompletos, requeridos)}/{requeridos} requeridos
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${cardColor}, ${cardColor}aa)`, borderRadius: '8px', transition: 'width .5s ease' }}/>
          </div>
          {/* Marcador del mínimo requerido */}
          <div style={{ position: 'relative', height: '12px' }}>
            <div style={{ position: 'absolute', left: `${(requeridos / totalLogros) * 100}%`, top: 0, transform: 'translateX(-50%)', fontSize: '.55rem', color: cardColor, fontWeight: '700' }}>
              ▲ {requeridos}
            </div>
          </div>
        </div>

        {/* Lista de logros */}
        <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {logrosActivo.map(a => {
            const completado  = achMap[a.id]?.completado || false
            const valorActual = getValorActual(a.stat_key, cache)
            const pctLogro    = Math.min(100, Math.round((valorActual / Number(a.meta)) * 100))
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '10px',
                background: completado ? S.winDim : 'rgba(255,255,255,.03)',
                border: `1px solid ${completado ? S.win + '44' : 'rgba(255,255,255,.06)'}`,
              }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: completado ? S.win : 'rgba(255,255,255,.08)', border: `1.5px solid ${completado ? S.win : 'rgba(255,255,255,.15)'}` }}>
                  {completado
                    ? <span style={{ fontSize: '.75rem', color: '#fff' }}>✓</span>
                    : <span style={{ fontSize: '.55rem', color: S.muted }}>{a.tipo === 'universal' ? '★' : a.tipo === 'campo' ? '⚽' : a.tipo === 'defensa' ? '🛡' : '🧤'}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.78rem', fontWeight: completado ? '700' : '500', color: completado ? '#fff' : S.text2, lineHeight: 1.2 }}>
                    {a.nombre}
                  </div>
                  {!completado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: '4px', height: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctLogro}%`, background: cardColor, borderRadius: '4px' }}/>
                      </div>
                      <span style={{ fontSize: '.6rem', color: S.muted, flexShrink: 0 }}>{valorActual}/{Number(a.meta)}</span>
                    </div>
                  )}
                </div>
                {completado && (
                  <span style={{ fontSize: '.65rem', color: S.win, flexShrink: 0 }}>+1</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Siguiente subnivel */}
        {subnivel_siguiente && (
          <div style={{ borderTop: `1px solid ${cardColor}22` }}>
            <button onClick={() => setVerSiguiente(v => !v)}
              style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '.72rem', color: S.muted }}>Siguiente:</span>
                <span style={{ fontSize: '.78rem', fontWeight: '700', color: CARD_COLORS[subnivel_siguiente.card?.id] || cardColor }}>
                  {subnivel_siguiente.card?.nombre} · {subnivel_siguiente.nombre}
                </span>
              </div>
              <span style={{ fontSize: '.7rem', color: S.muted }}>{verSiguiente ? '▲' : '▼'}</span>
            </button>

            {verSiguiente && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {logrosSiguiente.map(a => {
                  const completado  = achMap[a.id]?.completado || false
                  const valorActual = getValorActual(a.stat_key, cache)
                  const pctLogro    = Math.min(100, Math.round((valorActual / Number(a.meta)) * 100))
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', background: completado ? S.winDim : 'rgba(255,255,255,.02)', border: `1px solid ${completado ? S.win + '33' : 'rgba(255,255,255,.05)'}` }}>
                      <span style={{ fontSize: '.7rem', flexShrink: 0 }}>{completado ? '✓' : '○'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.75rem', color: completado ? '#fff' : S.muted }}>{a.nombre}</div>
                        {!completado && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: '3px', height: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pctLogro}%`, background: CARD_COLORS[subnivel_siguiente.card?.id] || cardColor }}/>
                            </div>
                            <span style={{ fontSize: '.58rem', color: S.muted }}>{valorActual}/{Number(a.meta)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mapa de todas las tarjetas */}
      <div style={{ marginTop: '14px', display: 'flex', gap: '6px' }}>
        {data.cards.map(card => {
          const lvls          = data.levels.filter(l => l.card_id === card.id).sort((a,b) => a.subnivel - b.subnivel)
          const color         = CARD_COLORS[card.id] || '#fff'
          const desbloqueados = lvls.filter(l => progresoMap[l.id]?.desbloqueada).length
          return (
            <div key={card.id} style={{ flex: 1, background: '#07070e', borderRadius: '10px', padding: '8px 6px', border: `1px solid ${color}22`, textAlign: 'center' }}>
              <div style={{ fontSize: '.9rem', marginBottom: '4px' }}>{CARD_ICONS[card.id]}</div>
              <div style={{ fontSize: '.58rem', color, fontWeight: '700', lineHeight: 1.2, marginBottom: '6px' }}>{card.nombre}</div>
              <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                {lvls.map((l, i) => (
                  <div key={l.id} style={{ width: '8px', height: '8px', borderRadius: '50%', background: progresoMap[l.id]?.desbloqueada ? color : 'rgba(255,255,255,.1)', border: `1px solid ${color}44` }}/>
                ))}
              </div>
              <div style={{ fontSize: '.55rem', color: S.muted, marginTop: '4px' }}>{desbloqueados}/5</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
