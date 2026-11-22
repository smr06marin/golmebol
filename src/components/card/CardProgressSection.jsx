import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { abrirChatAyuda } from '../../lib/abrirChat'
import { celebrar } from '../../lib/celebracion'

const S = {
  navy:    '#0a0a0a',
  card:    '#161616',
  border:  '#2a2a2a',
  cyan:    '#6fcf3d',
  cyanDim: 'rgba(111,207,61,.13)',
  gold:    '#f5a623',
  text:    '#ffffff',
  text2:   '#c9c9c9',
  muted:   '#a8a8a8',
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
  const [verRotos, setVerRotos] = useState(false)
  const [celebrando, setCelebrando] = useState(null) // tarjeta recién desbloqueada que se está celebrando

  // ¿Desbloqueó una tarjeta nueva desde la última vez que entró (en este celular)? → confeti, fuegos y aviso.
  // La primera vez que se abre en un celular solo se celebra lo desbloqueado en los últimos 7 días.
  useEffect(() => {
    if (!data || !playerId) return undefined
    const desbloq = (data.levels || []).filter(l => data.progresoMap[l.id]?.desbloqueada)
    const clave = `gm_tarjetas_vistas_${playerId}`
    let vistas = null
    try { vistas = JSON.parse(window.localStorage.getItem(clave) || 'null') } catch { vistas = null }
    try { window.localStorage.setItem(clave, JSON.stringify(desbloq.map(l => l.id))) } catch { /* modo privado */ }
    const hace7dias = Date.now() - 7 * 864e5
    const nuevas = desbloq.filter(l => Array.isArray(vistas)
      ? !vistas.includes(l.id)
      : (Date.parse(data.progresoMap[l.id]?.fecha_desbloqueada) || 0) > hace7dias)
    if (!nuevas.length) return undefined
    const ultima = nuevas[nuevas.length - 1]
    const nivel = { ...ultima, card: (data.cards || []).find(c => c.id === ultima.card_id) }
    const t = setTimeout(() => { setCelebrando(nivel); celebrar('ambos') }, 500)
    return () => clearTimeout(t)
  }, [data, playerId])

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

  const cuantosRotos = lista => lista.filter(a => achMap[a.id]?.completado).length
  const activoCompleto = !!subnivel_activo.prog?.desbloqueada || cuantosRotos(logrosActivo) >= (subnivel_activo.logros_requeridos || 3)
  // Si ya tiene la tarjeta actual, lo importante es la SIGUIENTE: esa sale grande con sus logros, para que se vea
  // qué le falta. La que ya tiene queda arriba en una franja ("✓ Ya es tuya"), con sus logros rotos para mirarlos.
  const objetivo = activoCompleto && subnivel_siguiente ? subnivel_siguiente : subnivel_activo
  const logrosObjetivo = objetivo === subnivel_activo ? logrosActivo : logrosSiguiente
  const hayYaTiene = objetivo !== subnivel_activo

  const colorDe = nivel => CARD_COLORS[nivel.card?.id] || '#00ee55'
  const iconoDe = nivel => CARD_ICONS[nivel.card?.id] || '🟢'
  const cardColor       = colorDe(objetivo)
  const cardIcon        = iconoDe(objetivo)
  const logrosCompletos = cuantosRotos(logrosObjetivo)
  const totalLogros     = logrosObjetivo.length
  const requeridos      = objetivo.logros_requeridos || 3
  const desbloqueada    = !hayYaTiene && activoCompleto
  const pct             = totalLogros > 0 ? Math.round((logrosCompletos / requeridos) * 100) : 0
  // Premio por el chat: solo tarjetas que no son de Iniciación
  const conPremio = nivel => !['nivel1_verde','nivel1_azul','nivel1_bronce','nivel1_plata','nivel1_oro'].includes(nivel.card_design_id)
  const premioActivo = activoCompleto && conPremio(subnivel_activo)

  const filaLogro = (a, color) => {
    const completado  = achMap[a.id]?.completado || false
    const valorActual = getValorActual(a.stat_key, cache)
    const pctLogro    = Math.min(100, Math.round((valorActual / Number(a.meta)) * 100))
    const falta       = Math.max(0, Number(a.meta) - valorActual)
    const casi        = !completado && valorActual > 0 && (falta === 1 || pctLogro >= 75)
    return (
      <div key={a.id} className={`gm-logro${casi ? ' gm-casi' : ''}`} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '10px',
        background: completado ? S.winDim : casi ? 'rgba(249,168,37,.08)' : 'rgba(255,255,255,.03)',
        border: `1.5px solid ${completado ? S.win + '44' : casi ? S.gold : 'rgba(255,255,255,.06)'}`,
      }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: completado ? S.win : casi ? 'rgba(249,168,37,.2)' : 'rgba(255,255,255,.08)', border: `1.5px solid ${completado ? S.win : casi ? S.gold : 'rgba(255,255,255,.15)'}` }}>
          {completado
            ? <span style={{ fontSize: '.75rem', color: '#fff' }}>✓</span>
            : <span style={{ fontSize: '.6rem', color: casi ? S.gold : S.muted }}>{a.tipo === 'universal' ? '★' : a.tipo === 'campo' ? '⚽' : a.tipo === 'defensa' ? '🛡' : '🧤'}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.78rem', fontWeight: completado || casi ? '700' : '500', color: completado ? '#fff' : casi ? '#ffe9c4' : S.text2, lineHeight: 1.2 }}>
            {a.nombre}
          </div>
          {!completado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
                <div className={pctLogro > 0 ? 'gm-barra-shimmer' : ''} style={{ height: '100%', width: `${pctLogro}%`, background: casi ? `linear-gradient(90deg, ${S.gold}, #ff6f00)` : color, borderRadius: '4px', transition: 'width .5s ease' }}/>
              </div>
              <span style={{ fontSize: '.62rem', color: casi ? S.gold : S.muted, fontWeight: casi ? '800' : '400', flexShrink: 0 }}>{valorActual}/{Number(a.meta)}</span>
            </div>
          )}
          {casi && <div style={{ fontSize: '.62rem', color: S.gold, fontWeight: '800', marginTop: '3px' }}>🔥 ¡Te falta{falta === 1 ? '' : 'n'} {falta} para romperlo!</div>}
        </div>
        {completado && (
          <span style={{ fontSize: '.62rem', color: S.win, fontWeight: '800', flexShrink: 0 }}>¡ROTO! 💥</span>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 24px' }}>
      {celebrando && (
        <div onClick={() => setCelebrando(null)} role="dialog" aria-modal="true"
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '360px', textAlign: 'center', background: 'radial-gradient(120% 80% at 50% 0%, rgba(245,200,75,.28), rgba(245,200,75,0) 60%), linear-gradient(165deg,#15120a,#0a0a12)', border: `1px solid ${CARD_COLORS[celebrando.card?.id] || S.gold}88`, borderRadius: '20px', padding: '26px 20px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
            <div style={{ fontSize: '2.6rem', lineHeight: 1 }}>{CARD_ICONS[celebrando.card?.id] || '🎉'}</div>
            <div style={{ fontSize: '.7rem', fontWeight: 900, letterSpacing: '.24em', color: S.gold, marginTop: '12px' }}>¡NUEVA TARJETA!</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', marginTop: '6px', lineHeight: 1.2 }}>{celebrando.card?.nombre} · {celebrando.nombre}</div>
            <div style={{ fontSize: '.85rem', color: S.text2, marginTop: '8px', lineHeight: 1.45 }}>Rompiste los logros y la desbloqueaste. ¡Ya es tuya! 🔥</div>
            <button type="button" onClick={() => setCelebrando(null)}
              style={{ marginTop: '18px', width: '100%', minHeight: '50px', border: 'none', borderRadius: '14px', background: S.cyan, color: '#0a1a05', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              ¡Vamos! 💪
            </button>
          </div>
        </div>
      )}

      {/* Tarjeta que ya tiene (cuando ya va por la siguiente) */}
      {hayYaTiene && (
        <div style={{ background: '#07070e', borderRadius: '14px', border: `1px solid ${colorDe(subnivel_activo)}33`, marginBottom: '10px', overflow: 'hidden' }}>
          <button type="button" onClick={() => setVerRotos(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <span style={{ fontSize: '1.1rem' }}>{iconoDe(subnivel_activo)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.62rem', fontWeight: 800, color: S.win, letterSpacing: '.08em' }}>✓ YA ES TUYA</div>
              <div style={{ fontSize: '.84rem', fontWeight: 800, color: colorDe(subnivel_activo) }}>{subnivel_activo.card?.nombre} · {subnivel_activo.nombre}</div>
            </div>
            <span style={{ fontSize: '.68rem', color: S.muted, flexShrink: 0 }}>{verRotos ? 'Ocultar ▲' : 'Ver logros ▼'}</span>
          </button>
          {verRotos && (
            <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {logrosActivo.map(a => filaLogro(a, colorDe(subnivel_activo)))}
            </div>
          )}
          {premioActivo && (
            <div style={{ margin: '0 16px 12px', background: 'linear-gradient(135deg, rgba(30,142,62,.15), rgba(249,168,37,.1))', border: `1px solid ${S.win}44`, borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '.82rem', fontWeight: '800', color: S.gold, marginBottom: '6px' }}>🎉 ¡Tarjeta desbloqueada!</div>
              <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.7)', lineHeight: 1.5, marginBottom: '12px' }}>Cuéntanos por el chat que la desbloqueaste y reclama tu premio 👇</div>
              <button type="button" onClick={() => abrirChatAyuda(`¡Desbloqueé la tarjeta ${subnivel_activo.card?.nombre} · ${subnivel_activo.nombre} en Golmebol! 🎉 Vengo a reclamar mi premio.`)}
                style={{ border:'none', cursor:'pointer', fontFamily:'inherit', boxSizing:'border-box', width:'100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: S.win, borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '.82rem' }}>
                💬 Reclamar premio por el chat
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tarjeta por la que va */}
      <div style={{ background: '#07070e', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${cardColor}33` }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${cardColor}22`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.3rem' }}>{cardIcon}</span>
          <div style={{ flex: 1 }}>
            {hayYaTiene && <div style={{ fontSize: '.6rem', fontWeight: 900, color: S.muted, letterSpacing: '.12em', marginBottom: '2px' }}>AHORA VAS POR</div>}
            <div style={{ fontWeight: '800', color: cardColor, fontSize: '.9rem', letterSpacing: '.06em' }}>
              {objetivo.card?.nombre} · {objetivo.nombre}
            </div>
            <div style={{ fontSize: '.68rem', color: desbloqueada ? S.muted : (requeridos - logrosCompletos) <= 1 ? S.gold : S.muted, fontWeight: (requeridos - logrosCompletos) <= 1 && !desbloqueada ? '800' : '400', marginTop: '2px' }}>
              {desbloqueada ? '✓ Desbloqueada'
                : (requeridos - logrosCompletos) === 1 ? '🔥 ¡Te falta solo 1 logro para romperla!'
                : `💪 Rompe ${requeridos - logrosCompletos} logros más y es tuya (${requeridos} de ${totalLogros})`}
            </div>
          </div>
          {desbloqueada && (
            <span style={{ fontSize: '.72rem', fontWeight: '700', color: S.win, background: S.winDim, borderRadius: '20px', padding: '3px 10px' }}>
              ✓ Activa
            </span>
          )}
        </div>
        {!hayYaTiene && premioActivo && (
          <div style={{ margin: '12px 16px 0', background: 'linear-gradient(135deg, rgba(30,142,62,.15), rgba(249,168,37,.1))', border: `1px solid ${S.win}44`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '.82rem', fontWeight: '800', color: S.gold, marginBottom: '6px' }}>🎉 ¡Tarjeta desbloqueada!</div>
            <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.7)', lineHeight: 1.5, marginBottom: '12px' }}>Cuéntanos por el chat que la desbloqueaste y reclama tu premio 👇</div>
            <button type="button" onClick={() => abrirChatAyuda(`¡Desbloqueé la tarjeta ${subnivel_activo.card?.nombre} · ${subnivel_activo.nombre} en Golmebol! 🎉 Vengo a reclamar mi premio.`)}
              style={{ border:'none', cursor:'pointer', fontFamily:'inherit', boxSizing:'border-box', width:'100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: S.win, borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '.82rem' }}>
              💬 Reclamar premio por el chat
            </button>
          </div>
        )}
        {/* Barra de progreso */}
        <div style={{ padding: '12px 16px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '.68rem', color: S.muted }}>Progreso de logros</span>
            <span style={{ fontSize: '.72rem', fontWeight: '700', color: logrosCompletos >= requeridos ? S.win : cardColor }}>
              {logrosCompletos}/{totalLogros} · {Math.min(logrosCompletos, requeridos)}/{requeridos} requeridos
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '8px', height: '10px', overflow: 'hidden' }}>
            <div className="gm-barra-shimmer" style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${cardColor}, ${cardColor}aa)`, borderRadius: '8px', transition: 'width .5s ease' }}/>
          </div>
          {totalLogros > 0 && (
            <div style={{ position: 'relative', height: '12px' }}>
              <div style={{ position: 'absolute', left: `${Math.min(100, (requeridos / totalLogros) * 100)}%`, top: 0, transform: 'translateX(-50%)', fontSize: '.55rem', color: cardColor, fontWeight: '700' }}>
                ▲ {requeridos}
              </div>
            </div>
          )}
        </div>

        {/* Lista de logros */}
        <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {logrosObjetivo.map(a => filaLogro(a, cardColor))}
        </div>
      </div>

      <style>{'@keyframes gmPuntoCurso{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}} .gm-punto-curso{animation:gmPuntoCurso 1.4s ease-in-out infinite} @media (prefers-reduced-motion: reduce){.gm-punto-curso{animation:none}}'}</style>
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
                {lvls.map(l => {
                  const tiene = !!progresoMap[l.id]?.desbloqueada
                  // La que está ganando ahora: punto a medio llenar, con brillo que late (ej. "va en la 2")
                  const enCurso = !tiene && l.id === objetivo.id
                  return (
                    <div key={l.id} className={enCurso ? 'gm-punto-curso' : undefined} title={tiene ? 'Desbloqueada' : enCurso ? 'La estás ganando ahora' : 'Por desbloquear'}
                      style={{ width: '8px', height: '8px', borderRadius: '50%', boxSizing: 'border-box',
                        background: tiene ? color : enCurso ? `linear-gradient(90deg, ${color} 50%, rgba(255,255,255,.12) 50%)` : 'rgba(255,255,255,.1)',
                        border: enCurso ? `1.5px solid ${color}` : `1px solid ${color}44`,
                        boxShadow: enCurso ? `0 0 6px ${color}` : 'none' }}/>
                  )
                })}
              </div>
              <div style={{ fontSize: '.55rem', color: S.muted, marginTop: '4px' }}>
                {desbloqueados}/5{lvls.some(l => l.id === objetivo.id && !progresoMap[l.id]?.desbloqueada) && <span style={{ color, fontWeight: 800 }}> · vas en la {objetivo.subnivel}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
