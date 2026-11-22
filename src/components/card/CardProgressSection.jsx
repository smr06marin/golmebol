import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { abrirChatAyuda } from '../../lib/abrirChat'
import { celebrar } from '../../lib/celebracion'
import { PLAZO_PREMIO_MS, tiempoParaReclamar } from '../../lib/desbloqueosTarjetas'

// ── Tarjetas del jugador ─────────────────────────────────────────────────────
// REGLA (ver migracion_tarjetas_cadena.sql):
//  · Todos empiezan con INICIACIÓN I.
//  · Con 3 de los 5 logros de su tarjeta se desbloquea la SIGUIENTE (Iniciación I → II → … → V → Competidor I …).
//  · Con LOS 5 logros de una tarjeta gana su PREMIO, y tiene 3 días para reclamarlo (pantallazo por el chat).
// Pantalla: arriba los premios por reclamar; después "TU TARJETA" con sus 5 logros y las dos metas
// (3 → siguiente tarjeta, 5 → premio); después los premios que le faltan de tarjetas anteriores; y el mapa de puntos.

const S = {
  cyan:    '#6fcf3d',
  gold:    '#f5a623',
  text2:   '#c9c9c9',
  muted:   '#a8a8a8',
  win:     '#1e8e3e',
  winDim:  'rgba(30,142,62,.12)',
}

// Tarjetas de la cadena principal, en orden
const CADENA = [
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000004',
]
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
const colorDe = nivel => CARD_COLORS[nivel?.card_id] || nivel?.card?.color || '#00ee55'
const iconoDe = nivel => CARD_ICONS[nivel?.card_id] || nivel?.card?.icono || '⭐'
const nombreDe = nivel => `${nivel?.card?.nombre || ''} · ${nivel?.nombre || ''}`

// ¿La tarjeta da premio? Lo decide el administrador (cards.da_premio, pestaña Desbloqueos). Si esa opción
// todavía no existe en la base, ninguna da premio (para no prometer algo que no está activado).
function conPremio(nivel, cards) {
  const card = nivel?.card || (cards || []).find(c => c.id === nivel?.card_id)
  return !!card && card.da_premio !== undefined && card.da_premio !== null && card.da_premio !== false
}

// Meta (fila con check): "3 logros → desbloqueas X" / "5 logros → ganas el premio"
function Meta({ hecho, icono, titulo, detalle, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: hecho ? S.winDim : 'rgba(255,255,255,.04)', border: `1px solid ${hecho ? S.win + '55' : 'rgba(255,255,255,.08)'}` }}>
      <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{hecho ? '✅' : icono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.84rem', fontWeight: 800, color: hecho ? '#fff' : color, lineHeight: 1.25 }}>{titulo}</div>
        <div style={{ fontSize: '.72rem', color: S.muted, marginTop: '2px', lineHeight: 1.3 }}>{detalle}</div>
      </div>
    </div>
  )
}

export default function CardProgressSection({ playerId, esPortero, posicionDetallada }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [abiertoAnterior, setAbiertoAnterior] = useState(null) // tarjeta anterior con los logros a la vista
  const [celebrando, setCelebrando] = useState(null)           // { nivel, tipo: 'desbloqueo' | 'premio' }
  const [reclamando, setReclamando] = useState(null)
  const [ahora, setAhora] = useState(() => Date.now())

  // El reloj del plazo para reclamar se actualiza cada minuto
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!playerId) return undefined
    const t = setTimeout(fetchProgreso, 0)
    return () => clearTimeout(t)
  }, [playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ¿Desbloqueó una tarjeta o ganó un premio desde la última vez que entró (en este celular)? → confeti y aviso.
  // La primera vez en un celular solo se celebra lo de los últimos 7 días.
  useEffect(() => {
    if (!data || !playerId) return undefined
    const eventos = []
    data.cadena.forEach((l, i) => {
      const pr = data.progresoMap[l.id]
      if (i > 0 && pr?.desbloqueada) eventos.push({ clave: 'u:' + l.id, fecha: pr.fecha_desbloqueada, nivel: l, tipo: 'desbloqueo' })
      if (pr?.fecha_completa && conPremio(l, data.cards)) eventos.push({ clave: 'c:' + l.id, fecha: pr.fecha_completa, nivel: l, tipo: 'premio' })
    })
    const clave = `gm_tarjetas_vistas2_${playerId}`
    let vistas = null
    try { vistas = JSON.parse(window.localStorage.getItem(clave) || 'null') } catch { vistas = null }
    try { window.localStorage.setItem(clave, JSON.stringify(eventos.map(e => e.clave))) } catch { /* modo privado */ }
    const hace7dias = Date.now() - 7 * 864e5
    const nuevos = eventos.filter(e => Array.isArray(vistas) ? !vistas.includes(e.clave) : (Date.parse(e.fecha) || 0) > hace7dias)
    if (!nuevos.length) return undefined
    // Lo más importante primero: un premio ganado; si no, la tarjeta más alta desbloqueada
    const elegido = nuevos.find(e => e.tipo === 'premio') || nuevos[nuevos.length - 1]
    const t = setTimeout(() => { setCelebrando(elegido); celebrar('ambos') }, 500)
    return () => clearTimeout(t)
  }, [data, playerId])

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
    const [{ data: cards }, { data: levels }, { data: progreso }, { data: achievements }, { data: achProgress }, { data: cache }] = await Promise.all([
      supabase.from('cards').select('*').order('orden'),
      supabase.from('card_levels').select('*').order('subnivel'),
      supabase.from('player_card_level_progress').select('*').eq('player_id', playerId),
      supabase.from('achievements').select('*').in('tipo', ['universal', pos]),
      supabase.from('player_achievement_progress').select('*').eq('player_id', playerId),
      supabase.from('player_stats_cache').select('*').eq('player_id', playerId).single(),
    ])

    const progresoMap = {}
    ;(progreso || []).forEach(p => { progresoMap[p.card_level_id] = p })
    const achMap = {}
    ;(achProgress || []).forEach(p => { achMap[p.achievement_id] = p })

    const conCard = l => ({ ...l, card: (cards || []).find(c => c.id === l.card_id) })
    // Cadena principal en orden: Iniciación I…V, Competidor I…V, Élite…, Leyenda…
    const cadena = (levels || [])
      .filter(l => CADENA.includes(l.card_id))
      .sort((a, b) => CADENA.indexOf(a.card_id) - CADENA.indexOf(b.card_id) || a.subnivel - b.subnivel)
      .map(conCard)
    const orden = { universal: 0, campo: 1, defensa: 1, arquero: 1 }
    const logrosDe = {}
    ;(levels || []).forEach(l => {
      logrosDe[l.id] = (achievements || []).filter(a => a.card_level_id === l.id).sort((a, b) => (orden[a.tipo] - orden[b.tipo]) || (a.orden - b.orden))
    })

    setData({ cards: cards || [], cadena, progresoMap, achMap, logrosDe, cache: cache || {} })
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
  if (!data || !data.cadena.length) return null

  const { cadena, progresoMap, achMap, logrosDe, cache } = data
  const desbloqueada = (l, i) => i === 0 || !!progresoMap[l.id]?.desbloqueada  // Iniciación I la tienen todos
  let idxActual = 0
  cadena.forEach((l, i) => { if (desbloqueada(l, i)) idxActual = i })
  const actual = cadena[idxActual]
  const siguiente = cadena[idxActual + 1] || null
  const rotos = l => (logrosDe[l.id] || []).filter(a => achMap[a.id]?.completado).length

  const logrosActual = logrosDe[actual.id] || []
  const rotosActual  = rotos(actual)
  const totalActual  = logrosActual.length || 5
  const requeridos   = actual.logros_requeridos || 3
  const cardColor    = colorDe(actual)
  const premioActual = conPremio(actual, data.cards)
  const completaActual = !!progresoMap[actual.id]?.fecha_completa
  const faltanSig    = Math.max(0, requeridos - rotosActual)
  const faltanPremio = Math.max(0, totalActual - rotosActual)

  // Premios: tarjetas con sus 5 logros rotos → por reclamar (3 días), ya reclamados o vencidos hace poco
  const premios = cadena
    .filter(l => progresoMap[l.id]?.fecha_completa && conPremio(l, data.cards))
    .map(l => {
      const pr = progresoMap[l.id]
      const t = Date.parse(pr.fecha_completa) || 0
      const estado = pr.premio_entregado_en ? 'entregado' : pr.premio_reclamado_en ? 'reclamado' : ahora - t > PLAZO_PREMIO_MS ? 'vencido' : 'en_plazo'
      return { nivel: l, fecha: pr.fecha_completa, estado, vencioHace: ahora - t - PLAZO_PREMIO_MS }
    })
    .filter(p => p.estado === 'en_plazo' || p.estado === 'reclamado' || (p.estado === 'vencido' && p.vencioHace < 7 * 864e5))
    .sort((a, b) => (Date.parse(b.fecha) || 0) - (Date.parse(a.fecha) || 0))

  // Tarjetas anteriores a las que todavía les falta algún logro para el premio
  const anterioresSinPremio = cadena.slice(0, idxActual).filter(l => conPremio(l, data.cards) && !progresoMap[l.id]?.fecha_completa)

  async function reclamar(p) {
    setReclamando(p.nivel.id)
    const { data: r, error } = await supabase.rpc('reclamar_premio_tarjeta', { p_player_id: playerId, p_card_level_id: String(p.nivel.id) })
    setReclamando(null)
    if (!error && r?.ok) {
      setData(d => d && ({ ...d, progresoMap: { ...d.progresoMap, [p.nivel.id]: { ...d.progresoMap[p.nivel.id], premio_reclamado_en: r.reclamado_en || new Date().toISOString() } } }))
    } else if (r?.motivo === 'vencido') {
      fetchProgreso()
      return
    }
    abrirChatAyuda(`🎁 ¡Rompí los 5 logros de la tarjeta ${nombreDe(p.nivel)} en Golmebol! Vengo a reclamar mi premio. Te adjunto el pantallazo de mi tarjeta 📸`)
  }

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
          <div style={{ fontSize: '.8rem', fontWeight: completado || casi ? '700' : '500', color: completado ? '#fff' : casi ? '#ffe9c4' : S.text2, lineHeight: 1.2 }}>
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
      {/* Celebración: tarjeta desbloqueada o premio ganado */}
      {celebrando && (
        <div onClick={() => setCelebrando(null)} role="dialog" aria-modal="true"
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '360px', textAlign: 'center', background: 'radial-gradient(120% 80% at 50% 0%, rgba(245,200,75,.28), rgba(245,200,75,0) 60%), linear-gradient(165deg,#15120a,#0a0a12)', border: `1px solid ${celebrando.tipo === 'premio' ? S.gold : colorDe(celebrando.nivel)}88`, borderRadius: '20px', padding: '26px 20px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
            <div style={{ fontSize: '2.6rem', lineHeight: 1 }}>{celebrando.tipo === 'premio' ? '🎁' : iconoDe(celebrando.nivel)}</div>
            <div style={{ fontSize: '.7rem', fontWeight: 900, letterSpacing: '.24em', color: S.gold, marginTop: '12px' }}>
              {celebrando.tipo === 'premio' ? '¡GANASTE EL PREMIO!' : '¡NUEVA TARJETA!'}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', marginTop: '6px', lineHeight: 1.2 }}>{nombreDe(celebrando.nivel)}</div>
            <div style={{ fontSize: '.88rem', color: S.text2, marginTop: '8px', lineHeight: 1.45 }}>
              {celebrando.tipo === 'premio'
                ? <>Rompiste los 5 logros de esta tarjeta. Tienes <b style={{ color: S.gold }}>3 días</b> para reclamar tu premio: arriba te decimos cómo.</>
                : <>Rompiste 3 logros de tu tarjeta anterior y la desbloqueaste. ¡Ya es tuya! 🔥</>}
            </div>
            <button type="button" onClick={() => setCelebrando(null)}
              style={{ marginTop: '18px', width: '100%', minHeight: '50px', border: 'none', borderRadius: '14px', background: celebrando.tipo === 'premio' ? S.gold : S.cyan, color: '#0a1a05', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {celebrando.tipo === 'premio' ? '¡A reclamarlo! 🎁' : '¡Vamos! 💪'}
            </button>
          </div>
        </div>
      )}

      {/* 1. Premios por reclamar (3 días desde que rompe los 5 logros) */}
      {premios.map(p => {
        const nombre = nombreDe(p.nivel)
        if (p.estado === 'en_plazo') {
          return (
            <div key={p.nivel.id} className="gm-premio-pulso" style={{ marginBottom: '12px', borderRadius: '16px', padding: '16px', background: 'linear-gradient(150deg, rgba(245,166,35,.22), rgba(245,166,35,.06) 60%), #120e05', border: `1.5px solid ${S.gold}`, boxShadow: '0 0 0 3px rgba(245,166,35,.12)' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 900, letterSpacing: '.18em', color: S.gold }}>🎁 ¡RECLAMA TU PREMIO!</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginTop: '6px', lineHeight: 1.25 }}>Rompiste los 5 logros de {nombre}</div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,.35)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontSize: '1.3rem' }}>⏳</span>
                <div style={{ fontSize: '.86rem', color: '#fff', lineHeight: 1.35 }}>
                  Te quedan <b style={{ color: S.gold }}>{tiempoParaReclamar(p.fecha, ahora)}</b> para reclamarlo.<br/>
                  <span style={{ color: S.muted, fontSize: '.76rem' }}>Después de 3 días ya no se puede reclamar.</span>
                </div>
              </div>
              <ol style={{ margin: '12px 0 0', paddingLeft: '20px', color: S.text2, fontSize: '.84rem', lineHeight: 1.5 }}>
                <li><b style={{ color: '#fff' }}>Toma un pantallazo</b> de esta pantalla, que se vea tu tarjeta y los 5 niveles.</li>
                <li>Toca <b style={{ color: '#fff' }}>Reclamar mi premio</b> y <b style={{ color: '#fff' }}>envía el pantallazo</b> por el chat.</li>
              </ol>
              <button type="button" disabled={reclamando === p.nivel.id} onClick={() => reclamar(p)}
                style={{ marginTop: '12px', width: '100%', minHeight: '52px', border: 'none', borderRadius: '14px', background: S.gold, color: '#1a1000', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', opacity: reclamando === p.nivel.id ? .6 : 1 }}>
                {reclamando === p.nivel.id ? 'Abriendo el chat…' : '📸 Reclamar mi premio'}
              </button>
            </div>
          )
        }
        if (p.estado === 'reclamado') {
          return (
            <div key={p.nivel.id} style={{ marginBottom: '12px', borderRadius: '14px', padding: '14px 16px', background: S.winDim, border: `1px solid ${S.win}66` }}>
              <div style={{ fontSize: '.86rem', fontWeight: 800, color: '#fff' }}>✓ Ya reclamaste el premio de {nombre}</div>
              <div style={{ fontSize: '.78rem', color: S.text2, marginTop: '4px', lineHeight: 1.45 }}>Te vamos a responder por el chat. Si todavía no enviaste el pantallazo de tu tarjeta, envíalo ahí.</div>
              <button type="button" onClick={() => abrirChatAyuda(`🎁 Reclamé el premio de la tarjeta ${nombre}. Te envío el pantallazo 📸`)}
                style={{ marginTop: '10px', minHeight: '44px', padding: '0 16px', border: `1px solid ${S.win}`, borderRadius: '12px', background: 'transparent', color: '#fff', fontWeight: 800, fontSize: '.84rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                💬 Abrir el chat
              </button>
            </div>
          )
        }
        return (
          <div key={p.nivel.id} style={{ marginBottom: '12px', borderRadius: '14px', padding: '12px 16px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ fontSize: '.82rem', fontWeight: 800, color: S.text2 }}>⌛ Se venció el plazo del premio de {nombre}</div>
            <div style={{ fontSize: '.74rem', color: S.muted, marginTop: '3px', lineHeight: 1.4 }}>Había 3 días para reclamarlo. En tu próximo premio, ¡reclámalo apenas lo ganes!</div>
          </div>
        )
      })}
      {premios.some(p => p.estado === 'en_plazo') && (
        <style>{'@keyframes gmPremioPulso{0%,100%{box-shadow:0 0 0 3px rgba(245,166,35,.12)}50%{box-shadow:0 0 0 7px rgba(245,166,35,.22)}} .gm-premio-pulso{animation:gmPremioPulso 2s ease-in-out infinite} @media (prefers-reduced-motion: reduce){.gm-premio-pulso{animation:none}}'}</style>
      )}

      {/* 2. Tu tarjeta actual: sus 5 logros y las dos metas */}
      <div style={{ background: '#07070e', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${cardColor}33` }}>
        <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${cardColor}22`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>{iconoDe(actual)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.6rem', fontWeight: 900, color: S.muted, letterSpacing: '.14em', marginBottom: '2px' }}>TU TARJETA</div>
            <div style={{ fontWeight: '900', color: cardColor, fontSize: '.95rem', letterSpacing: '.05em' }}>{nombreDe(actual)}</div>
          </div>
          <span style={{ fontSize: '.72rem', fontWeight: '700', color: S.win, background: S.winDim, borderRadius: '20px', padding: '3px 10px', flexShrink: 0 }}>✓ Es tuya</span>
        </div>

        <div style={{ padding: '12px 16px 4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {siguiente && (
            <Meta hecho={false} icono="🔓" color={colorDe(siguiente)}
              titulo={`Rompe ${requeridos} de ${totalActual} logros → desbloqueas ${nombreDe(siguiente)}`}
              detalle={faltanSig === 1 ? '🔥 ¡Te falta solo 1 logro!' : `Te faltan ${faltanSig} logros`}/>
          )}
          {premioActual && (
            <Meta hecho={completaActual} icono="🎁" color={S.gold}
              titulo={completaActual ? 'Rompiste los 5 logros: ganaste el premio' : `Rompe los ${totalActual} logros → ganas el PREMIO de esta tarjeta`}
              detalle={completaActual ? 'Reclámalo arriba antes de 3 días' : faltanPremio === 1 ? '🔥 ¡Te falta solo 1 logro para el premio!' : `Te faltan ${faltanPremio} logros`}/>
          )}
        </div>

        {/* Barra: marca en 3 (siguiente tarjeta) y en 5 (premio) */}
        <div style={{ padding: '12px 16px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '.7rem', color: S.muted }}>Logros rotos</span>
            <span style={{ fontSize: '.74rem', fontWeight: '800', color: rotosActual >= totalActual ? S.gold : rotosActual >= requeridos ? S.win : cardColor }}>{rotosActual} de {totalActual}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '8px', height: '10px', overflow: 'hidden' }}>
            <div className="gm-barra-shimmer" style={{ height: '100%', width: `${Math.min(100, (rotosActual / totalActual) * 100)}%`, background: `linear-gradient(90deg, ${cardColor}, ${rotosActual >= totalActual ? S.gold : cardColor + 'aa'})`, borderRadius: '8px', transition: 'width .5s ease' }}/>
          </div>
          <div style={{ position: 'relative', height: '16px' }}>
            {siguiente && (
              <div style={{ position: 'absolute', left: `${(requeridos / totalActual) * 100}%`, top: 1, transform: 'translateX(-50%)', fontSize: '.58rem', color: cardColor, fontWeight: '800', whiteSpace: 'nowrap' }}>▲ {requeridos} siguiente</div>
            )}
            {premioActual && (
              <div style={{ position: 'absolute', right: 0, top: 1, fontSize: '.58rem', color: S.gold, fontWeight: '800', whiteSpace: 'nowrap' }}>▲ {totalActual} 🎁</div>
            )}
          </div>
        </div>

        <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {logrosActual.map(a => filaLogro(a, cardColor))}
        </div>
      </div>

      {/* 3. Tarjetas anteriores: lo que les falta para el premio */}
      {anterioresSinPremio.length > 0 && (
        <div style={{ marginTop: '12px', background: '#07070e', borderRadius: '14px', border: '1px solid rgba(245,166,35,.25)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 6px', fontSize: '.66rem', fontWeight: 900, letterSpacing: '.12em', color: S.gold }}>🎁 PREMIOS QUE TE FALTAN DE TUS TARJETAS</div>
          {anterioresSinPremio.map(l => {
            const r = rotos(l), tot = (logrosDe[l.id] || []).length || 5
            const abierto = abiertoAnterior === l.id
            return (
              <div key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <button type="button" onClick={() => setAbiertoAnterior(abierto ? null : l.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: '1rem' }}>{iconoDe(l)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 800, color: colorDe(l) }}>{nombreDe(l)}</div>
                    <div style={{ fontSize: '.72rem', color: S.muted }}>{r} de {tot} logros · {tot - r === 1 ? '¡te falta 1 para el premio!' : `te faltan ${tot - r} para el premio`}</div>
                  </div>
                  <span style={{ fontSize: '.68rem', color: S.muted, flexShrink: 0 }}>{abierto ? 'Ocultar ▲' : 'Ver ▼'}</span>
                </button>
                {abierto && (
                  <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(logrosDe[l.id] || []).map(a => filaLogro(a, colorDe(l)))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 4. Mapa de todas las tarjetas */}
      <style>{'@keyframes gmPuntoCurso{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}} .gm-punto-curso{animation:gmPuntoCurso 1.4s ease-in-out infinite} @media (prefers-reduced-motion: reduce){.gm-punto-curso{animation:none}}'}</style>
      <div style={{ marginTop: '14px', display: 'flex', gap: '6px' }}>
        {data.cards.filter(c => CADENA.includes(c.id)).map(card => {
          const lvls  = cadena.filter(l => l.card_id === card.id)
          const color = CARD_COLORS[card.id] || '#fff'
          const tiene = l => desbloqueada(l, cadena.indexOf(l))
          const n     = lvls.filter(tiene).length
          return (
            <div key={card.id} style={{ flex: 1, background: '#07070e', borderRadius: '10px', padding: '8px 6px', border: `1px solid ${color}22`, textAlign: 'center' }}>
              <div style={{ fontSize: '.9rem', marginBottom: '4px' }}>{CARD_ICONS[card.id]}</div>
              <div style={{ fontSize: '.58rem', color, fontWeight: '700', lineHeight: 1.2, marginBottom: '6px' }}>{card.nombre}</div>
              <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                {lvls.map(l => {
                  const es = tiene(l), enCurso = l.id === actual.id, premio = !!progresoMap[l.id]?.fecha_completa
                  return (
                    <div key={l.id} className={enCurso ? 'gm-punto-curso' : undefined}
                      title={enCurso ? 'Tu tarjeta ahora' : es ? 'Desbloqueada' : 'Por desbloquear'}
                      style={{ width: '8px', height: '8px', borderRadius: '50%', boxSizing: 'border-box',
                        background: es ? color : 'rgba(255,255,255,.1)',
                        border: premio ? `1.5px solid ${S.gold}` : enCurso ? '1.5px solid #fff' : `1px solid ${color}44`,
                        boxShadow: enCurso ? `0 0 6px ${color}` : 'none' }}/>
                  )
                })}
              </div>
              <div style={{ fontSize: '.55rem', color: S.muted, marginTop: '4px' }}>
                {n}/{lvls.length || 5}{actual.card_id === card.id && <span style={{ color, fontWeight: 800 }}> · vas en la {actual.subnivel}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
