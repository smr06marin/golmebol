import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/card/PlayerCard'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'
import html2canvas from 'html2canvas'
import StatRankingModal from '../components/card/StatRankingModal'
import CardProgressSection from '../components/card/CardProgressSection'
import SponsorSplash from '../components/card/SponsorSplash'

const TABS = [
  { id: 'tarjeta',   label: 'Mi Tarjeta', icon: '🃏' },
  { id: 'historial', label: 'Historial',  icon: '📋' },
  { id: 'predix',    label: 'Predix',     icon: '🎯' },
]

function NotifBanner({ notifs, onDismiss }) {
  const [idx, setIdx] = useState(0)
  if (!notifs || notifs.length === 0) return null
  const n = notifs[idx]
  return (
    <div style={{ background: n.bg, borderBottom: `2px solid ${n.color}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{n.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.8rem', fontWeight: '700', color: n.color }}>{n.titulo}</div>
        <div style={{ fontSize: '.73rem', color: '#5f6368', marginTop: '1px' }}>{n.texto}</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {n.accion && (
          <button onClick={n.accion.fn}
            style={{ padding: '5px 10px', background: n.color, border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
            {n.accion.label}
          </button>
        )}
        {notifs.length > 1 && idx < notifs.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)}
            style={{ padding: '5px 8px', background: 'rgba(0,0,0,.08)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.72rem' }}>
            {idx + 1}/{notifs.length} →
          </button>
        )}
        <button onClick={() => onDismiss(n.id)}
          style={{ padding: '5px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '1rem', lineHeight: 1 }}>✕</button>
      </div>
    </div>
  )
}

export default function PlayerHomePage() {
  const navigate   = useNavigate()
  const cardRef    = useRef(null)
  const [player,            setPlayer]            = useState(null)
  const [stats,             setStats]             = useState(null)
  const [torneos,           setTorneos]           = useState([])
  const [historial,         setHistorial]         = useState([])
  const [sponsors,          setSponsors]          = useState([])
  const [cardLevelProgress, setCardLevelProgress] = useState([])
  const [tarjetasCustom,    setTarjetasCustom]    = useState([]) // tarjetas custom de BD
  const [loading,           setLoading]           = useState(true)
  const [tab,               setTab]               = useState('tarjeta')
  const [cardType,          setCardType]          = useState('nivel1_verde')
  const [showSelector,      setShowSelector]      = useState(false)
  const [guardandoCard,     setGuardandoCard]     = useState(false)
  const [previewCard,       setPreviewCard]       = useState(null)
  const [previewLogros,     setPreviewLogros]     = useState([])
  const [nuevasTarjetas,    setNuevasTarjetas]    = useState([])
  const [notifIndex,        setNotifIndex]        = useState(0)
  const [compartiendo,      setCompartiendo]      = useState(false)
  const [rankingModal,      setRankingModal]      = useState(null)
  const [notifs,            setNotifs]            = useState([])
  const [splashPreview,     setSplashPreview]     = useState(null)
  const [pendingPreview,    setPendingPreview]    = useState(null)
  const [splash,            setSplash]            = useState(null)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador/login'); return }

    if (!p.activo_membresia || (p.fecha_vencimiento && new Date(p.fecha_vencimiento) < new Date())) {
      await supabase.auth.signOut(); navigate('/jugador/login'); return
    }

    setPlayer(p)
    if (p.card_type) setCardType(p.card_type)

    const { data: rawStats } = await supabase.from('player_match_stats').select('*').eq('player_id', p.id)
    const raw       = rawStats || []
    const pj        = raw.length
    const goles     = raw.reduce((s, r) => s + (r.goals_scored   || 0), 0)
    const recibidos = raw.reduce((s, r) => s + (r.goals_conceded || 0), 0)
    const pg        = raw.filter(r => r.team_result === 'win').length
    const pe        = raw.filter(r => r.team_result === 'draw').length
    const pp        = raw.filter(r => r.team_result === 'loss').length
    const eficacia  = pj > 0 ? Math.round((pg / pj) * 100) : 0
    const esPort    = p.posicion_futbol5 === 'Portero' || p.posicion_futbol7 === 'Portero' || p.posicion_futbol11 === 'Portero'
    const promedio  = pj > 0 ? parseFloat((esPort ? recibidos / pj : goles / pj).toFixed(2)) : 0

    let rachaVictorias = 0
    for (const r of [...raw].reverse()) {
      if (r.team_result === 'win') rachaVictorias++
      else break
    }

    const { data: logrosJug } = await supabase.from('tournament_logros').select('tipo').eq('player_id', p.id).eq('tipo', 'campeon')
    const titulos = (logrosJug || []).length

    const statsCalc = { pj, goles, recibidos, pg, pe, pp, eficacia, promedio, rachaVictorias, titulos, esPortero: esPort }
    setStats(statsCalc)

    const { data: histData } = await supabase
      .from('player_match_stats')
      .select('*, matches(id, played_at, home_score, away_score, matchday, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)), teams(name,logo_url)')
      .eq('player_id', p.id)
      .order('created_at', { ascending: false })
    setHistorial(histData || [])

    const { data: spons } = await supabase.from('sponsors').select('*').eq('activo', true)
    setSponsors(spons || [])

    const { data: clp } = await supabase
      .from('player_card_level_progress')
      .select('*, card_levels(card_design_id, card_id, logros_requeridos)')
      .eq('player_id', p.id)
    setCardLevelProgress(clp || [])

    // Tarjetas custom de BD (orden > 4)
    const { data: customCards } = await supabase
      .from('cards')
      .select('*, card_levels(*)')
      .gt('orden', 4)
      .order('orden')
    setTarjetasCustom(customCards || [])

    const { data: regs } = await supabase
      .from('tournament_player_registrations')
      .select('*, teams(id,name,logo_url), tournaments(id,name,modalidad,season,logo_url)')
      .eq('player_id', p.id).eq('activo', true)
    setTorneos(regs || [])

    // NOTIFICACIONES
    const notifsList = []
    const dismissed  = JSON.parse(localStorage.getItem('golmebol_notifs_dismissed') || '[]')

    if (regs && regs.length > 0) {
      const teamIds = regs.map(r => r.team_id).filter(Boolean)
      const ahora   = new Date()
      const en24h   = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)
      const { data: proximosPartidos } = await supabase
        .from('matches')
        .select('*, home:home_team_id(name), away:away_team_id(name)')
        .in('home_team_id', teamIds)
        .gte('played_at', ahora.toISOString())
        .lte('played_at', en24h.toISOString())
        .eq('status', 'scheduled')
        .order('played_at', { ascending: true })
        .limit(1)

      if (proximosPartidos && proximosPartidos.length > 0) {
        const partido   = proximosPartidos[0]
        const fecha     = new Date(partido.played_at)
        const horaStr   = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        const diffMs    = fecha - ahora
        const diffH     = Math.floor(diffMs / 3600000)
        const diffM     = Math.floor((diffMs % 3600000) / 60000)
        const tiempoStr = diffH > 0 ? `en ${diffH}h ${diffM}min` : `en ${diffM} min`
        const nid = `partido_${partido.id}`
        if (!dismissed.includes(nid)) {
          notifsList.push({
            id: nid, icon: '⚽',
            titulo: `¡Partido ${tiempoStr}!`,
            texto: `${partido.home?.name} vs ${partido.away?.name} · ${horaStr}`,
            color: '#e8710a', bg: '#fffbf0',
            accion: { label: 'Ver PREDIX', fn: () => navigate('/jugador/apuestas') },
          })
        }
      }
    }

    const { data: predsResueltas } = await supabase
      .from('predicciones').select('puntos_ganados, match_id')
      .eq('player_id', p.id).eq('resuelta', true).gt('puntos_ganados', 0)

    if (predsResueltas && predsResueltas.length > 0) {
      const nid = `predix_puntos_${predsResueltas.length}`
      if (!dismissed.includes(nid)) {
        const totalPts = predsResueltas.reduce((s, r) => s + (r.puntos_ganados || 0), 0)
        notifsList.push({
          id: nid, icon: '🎯',
          titulo: `¡Tienes ${totalPts} puntos en PREDIX!`,
          texto: `${predsResueltas.length} predicción${predsResueltas.length > 1 ? 'es' : ''} resuelta${predsResueltas.length > 1 ? 's' : ''} · Ve tu ranking`,
          color: '#00a896', bg: '#f0faf9',
          accion: { label: 'Ver ranking', fn: () => navigate('/jugador/apuestas') },
        })
      }
    }

    if (p.fecha_vencimiento) {
      const diasRestantes = Math.ceil((new Date(p.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
      if (diasRestantes <= 7 && diasRestantes > 0) {
        const nid = `membresia_vence_${diasRestantes}`
        if (!dismissed.includes(nid)) {
          notifsList.push({
            id: nid, icon: '⏰',
            titulo: `Tu membresía vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`,
            texto: 'Renueva para seguir compitiendo en PREDIX',
            color: '#d93025', bg: '#fff8f8',
            accion: {
              label: '📲 Renovar',
              fn: () => window.open(`https://wa.me/573226490055?text=${encodeURIComponent('Hola! Quiero renovar mi membresía de PREDIX Golmebol 🎯')}`, '_blank')
            },
          })
        }
      }
    }

    // Notificaciones de nuevas tarjetas custom
    if (customCards && customCards.length > 0) {
      const { data: playerNotifs } = await supabase
        .from('player_notifications')
        .select('*')
        .eq('player_id', p.id)
        .eq('tipo', 'nueva_tarjeta')
        .eq('leida', false)
      ;(playerNotifs || []).forEach(n => {
        const nid = `nueva_tarjeta_${n.id}`
        if (!dismissed.includes(nid)) {
          notifsList.push({
            id: nid, icon: '⭐',
            titulo: n.titulo,
            texto: n.mensaje,
            color: '#e8710a', bg: '#fff8f0',
            accion: { label: 'Ver tarjetas', fn: () => setShowSelector(true) },
          })
        }
      })
    }

    setNotifs(notifsList)

    if (clp && clp.length > 0) {
      const vistas = p.tarjetas_vistas || []
      const nuevas = clp
        .filter(c => c.desbloqueada && c.card_levels?.card_design_id && !vistas.includes(c.card_levels.card_design_id))
        .map(c => CARD_DESIGNS.find(d => d.id === c.card_levels.card_design_id))
        .filter(Boolean)
      if (nuevas.length > 0) { setNuevasTarjetas(nuevas); setNotifIndex(0) }
    }

    setLoading(false)
  }

  function dismissNotif(id) {
    const dismissed = JSON.parse(localStorage.getItem('golmebol_notifs_dismissed') || '[]')
    localStorage.setItem('golmebol_notifs_dismissed', JSON.stringify([...dismissed, id]))
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function handleCerrarNotif() {
    if (notifIndex < nuevasTarjetas.length - 1) {
      setNotifIndex(i => i + 1)
    } else {
      const vistas      = player.tarjetas_vistas || []
      const nuevasIds   = nuevasTarjetas.map(t => t.id)
      const todasVistas = [...new Set([...vistas, ...nuevasIds])]
      await supabase.from('players').update({ tarjetas_vistas: todasVistas }).eq('id', player.id)
      setNuevasTarjetas([])
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  async function handleCompartir() {
    if (!cardRef.current) return
    setCompartiendo(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#07070e', scale: 3, useCORS: true, allowTaint: true,
        logging: false, foreignObjectRendering: false, imageTimeout: 15000,
        onclone: (doc) => {
          const style = doc.createElement('style')
          style.innerHTML = `:root { --font-display: Impact, sans-serif; --font-body: Arial, sans-serif; --color-primary: #00ddd0; }`
          doc.head.appendChild(style)
        }
      })
      const url = canvas.toDataURL('image/png')
      const a   = document.createElement('a')
      a.href = url; a.download = `${nombre}_golmebol.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch (e) { console.error('Error al generar imagen:', e) }
    setCompartiendo(false)
  }

  function getPosicionTipo(p) {
    if (!p) return 'campo'
    const pos = p.posicion_futbol5 || p.posicion_futbol7 || p.posicion_futbol11 || ''
    if (pos === 'Portero') return 'arquero'
    const defensas = ['Cierre','Defensa central','Lateral derecho','Lateral izquierdo','Mediocampista defensivo']
    if (defensas.some(d => pos.includes(d))) return 'defensa'
    return 'campo'
  }

  // Verifica si una tarjeta está desbloqueada
  // Para tarjetas estáticas (CARD_DESIGNS): busca en cardLevelProgress por card_design_id
  // Para tarjetas custom (BD): busca en cardLevelProgress por card_level_id del primer nivel
  function estaDesbloqueada(cardId) {
    if (cardId === 'nivel1_verde') return true // EL DEBUT siempre libre
    // Tarjeta estática
    const clp = cardLevelProgress.find(p => p.card_levels?.card_design_id === cardId)
    if (clp) return clp.desbloqueada
    // Tarjeta custom — cardId es el card_id de la tabla cards
    const custom = tarjetasCustom.find(c => c.id === cardId)
    if (custom && custom.card_levels?.length > 0) {
      const levelId = custom.card_levels[0].id
      const clpCustom = cardLevelProgress.find(p => p.card_level_id === levelId)
      return clpCustom?.desbloqueada || false
    }
    return false
  }

  function getProgreso(cardId) {
    // Tarjeta estática
    const clp = cardLevelProgress.find(p => p.card_levels?.card_design_id === cardId)
    if (clp) {
      const requeridos  = clp.card_levels?.logros_requeridos || 3
      const completados = clp.logros_completados || 0
      const pct         = Math.min(100, Math.round((completados / requeridos) * 100))
      return { actual: completados, meta: requeridos, sufijo: ' logros', pct, descripcion: `Completa ${requeridos} de 5 logros para desbloquear` }
    }
    // Tarjeta custom
    const custom = tarjetasCustom.find(c => c.id === cardId)
    if (custom && custom.card_levels?.length > 0) {
      const level     = custom.card_levels[0]
      const clpCustom = cardLevelProgress.find(p => p.card_level_id === level.id)
      const requeridos  = level.logros_requeridos || 3
      const completados = clpCustom?.logros_completados || 0
      const pct         = Math.min(100, Math.round((completados / requeridos) * 100))
      return { actual: completados, meta: requeridos, sufijo: ' logros', pct, descripcion: `Completa ${requeridos} logros para desbloquear` }
    }
    return null
  }

  function getSponsor(cardId) { return sponsors.find(s => s.card_id === cardId) || null }

  async function fetchLogrosPreview(cardId) {
    // Buscar card_level_id — puede ser estático o custom
    let levelId = null
    const clp = cardLevelProgress.find(p => p.card_levels?.card_design_id === cardId)
    if (clp) {
      levelId = clp.card_level_id
    } else {
      const custom = tarjetasCustom.find(c => c.id === cardId)
      if (custom && custom.card_levels?.length > 0) levelId = custom.card_levels[0].id
    }
    if (!levelId || !player) return

    const pos = getPosicionTipo(player)
    const { data: logros } = await supabase
      .from('achievements').select('*')
      .eq('card_level_id', levelId)
      .in('tipo', ['universal', pos])
      .order('orden')

    if (!logros || logros.length === 0) return

    const { data: progreso } = await supabase
      .from('player_achievement_progress').select('*')
      .eq('player_id', player.id)
      .in('achievement_id', logros.map(l => l.id))

    const progresoMap = {}
    ;(progreso || []).forEach(p => { progresoMap[p.achievement_id] = p })

    const { data: cache } = await supabase
      .from('player_stats_cache').select('*')
      .eq('player_id', player.id).single()

    const statValor = (key) => ({
      pj: cache?.pj, victorias: cache?.victorias, goles: cache?.goles,
      dobletes: cache?.dobletes, hat_tricks: cache?.hat_tricks,
      racha_goles_actual: cache?.racha_goles_actual,
      racha_victorias_actual: cache?.racha_victorias_actual,
      arcos_cero: cache?.arcos_cero, partidos_sin_tarjetas: cache?.partidos_sin_tarjetas,
      campeonatos: cache?.campeonatos, mejor_arquero_count: cache?.mejor_arquero_count,
      valla_menos_vencida_count: cache?.valla_menos_vencida_count,
      goleador_torneo_count: cache?.goleador_torneo_count,
    }[key] || 0)

    setPreviewLogros(logros.map(l => ({
      nombre: l.nombre, tipo: l.tipo,
      completado: progresoMap[l.id]?.completado || false,
      valorActual: statValor(l.stat_key),
      meta: Number(l.meta),
    })))
  }

  async function handleSeleccionarTarjeta(id) {
    if (!estaDesbloqueada(id)) return
    setGuardandoCard(true); setCardType(id)
    await supabase.from('players').update({ card_type: id }).eq('id', player.id)
    setGuardandoCard(false); setShowSelector(false)
  }

  async function handleClickTarjeta(d) {
    if (estaDesbloqueada(d.id)) handleSeleccionarTarjeta(d.id)
    else {
      setShowSelector(false)
      const sponsor    = getSponsor(d.id)
      const color      = d.color || '#00ee55'
      const nombre_    = d.nombre || ''
      if (sponsor) {
        setSplashPreview({ sponsor, cardColor: color, cardNombre: nombre_ })
        setPendingPreview(d)
      } else {
        setPreviewCard(d)
        setPreviewLogros([])
        fetchLogrosPreview(d.id)
      }
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#1a73e8', fontSize: '.9rem', fontWeight: '500' }}>Cargando...</div>
    </div>
  )

  if (!player) return null

  const esPortero  = stats?.esPortero || false
  const nivelTexto = (stats?.pj || 0) < 10 ? 'Nivel 1' : (stats?.pj || 0) < 25 ? 'Nivel 2' : 'Nivel 3'
  const nivelColor = (stats?.pj || 0) < 10 ? '#1e8e3e' : (stats?.pj || 0) < 25 ? '#1a73e8' : '#6c35de'
  const cardDesign = CARD_DESIGNS.find(d => d.id === cardType) || CARD_DESIGNS[0]
  const cardColor  = cardDesign?.color || '#00ee55'

  const cardStats = {
    pj:          stats?.pj        || 0,
    golesContra: esPortero ? (stats?.recibidos || 0) : (stats?.goles || 0),
    promedio:    stats?.promedio   || 0,
    eficacia:    stats?.eficacia   || 0,
    pg:          stats?.pg         || 0,
    pe:          stats?.pe         || 0,
    pp:          stats?.pp         || 0,
  }

  const nombre      = player.name?.toUpperCase().split(' ')[0] || 'JUGADOR'
  const torneosData = torneos.map(t => ({ id: t.tournament_id, nombre: t.tournaments?.name, logo_url: t.tournaments?.logo_url || null }))
  const equiposData = torneos.map(t => ({ id: t.teams?.id, nombre: t.teams?.name, logo_url: t.teams?.logo_url || null })).filter((e, i, arr) => e.id && arr.findIndex(x => x.id === e.id) === i)

  function handleCardClick(itemId) {
    const statKeys = ['pj', 'gc', 'prom', 'efic', 'pg', 'pe', 'pp']
    if (statKeys.includes(itemId)) { setRankingModal(itemId); return }
    const torneo = torneosData.find(t => t.id === itemId)
    if (torneo) { navigate(`/jugador/torneo/${torneo.id}`); return }
    const reg = torneos.find(t => t.teams?.id === itemId)
    if (reg) navigate(`/equipos/${reg.teams?.id}`)
  }

  const tarjetasDesbloqueadas = CARD_DESIGNS.filter(d => estaDesbloqueada(d.id))

  const GRUPOS = [
    { label: 'Iniciación', ids: CARD_DESIGNS.filter(d => d.nivel === 1).map(d => d.id), color: '#00ee55' },
    { label: 'Competidor', ids: CARD_DESIGNS.filter(d => d.nivel === 2).map(d => d.id), color: '#4488FF' },
    { label: 'Élite',      ids: CARD_DESIGNS.filter(d => d.nivel === 3).map(d => d.id), color: '#9955ff' },
    { label: 'Leyenda',    ids: CARD_DESIGNS.filter(d => d.nivel === 6).map(d => d.id), color: '#f9a825' },
  ]

  const tarjetaNotif = nuevasTarjetas[notifIndex]

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* NOTIFICACIÓN TARJETA NUEVA */}
      {tarjetaNotif && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontWeight: '800', color: '#fff', fontSize: '1.3rem', letterSpacing: '.04em' }}>¡NUEVA TARJETA!</div>
              <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.55)', marginTop: '4px' }}>Has desbloqueado una nueva tarjeta</div>
              {nuevasTarjetas.length > 1 && <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.4)', marginTop: '4px' }}>{notifIndex + 1} de {nuevasTarjetas.length}</div>}
            </div>
            <div style={{ width: '100%', filter: `drop-shadow(0 0 20px ${tarjetaNotif.color}88)` }}>
              <PlayerCard playerName={nombre} stats={cardStats} cardType={tarjetaNotif.id} esPortero={esPortero} photoUrlExterno={player.photo_url || null} hideShields={true}/>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '700', color: tarjetaNotif.color, fontSize: '1.1rem', letterSpacing: '.08em' }}>{tarjetaNotif.nombre}</div>
              <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.45)', marginTop: '4px' }}>Ya puedes usar esta tarjeta en tu perfil</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={() => { handleSeleccionarTarjeta(tarjetaNotif.id); handleCerrarNotif() }}
                style={{ flex: 1, padding: '12px', background: tarjetaNotif.color, border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#000', fontWeight: '700', fontSize: '.9rem' }}>
                ✓ Usar ahora
              </button>
              <button onClick={handleCerrarNotif}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '12px', cursor: 'pointer', color: '#fff', fontWeight: '600', fontSize: '.9rem' }}>
                {notifIndex < nuevasTarjetas.length - 1 ? 'Siguiente →' : 'Después'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPLASH LOGIN */}
      {splash && (
        <SponsorSplash
          sponsor={splash.sponsor}
          cardColor={splash.cardColor}
          cardNombre={splash.cardNombre}
          onDone={() => setSplash(null)}
        />
      )}

      {/* SPLASH PREVIEW */}
      {splashPreview && (
        <SponsorSplash
          sponsor={splashPreview.sponsor}
          cardColor={splashPreview.cardColor}
          cardNombre={splashPreview.cardNombre}
          onDone={() => {
            setSplashPreview(null)
            setPreviewCard(pendingPreview)
            setPreviewLogros([])
            fetchLogrosPreview(pendingPreview.id)
            setPendingPreview(null)
          }}
        />
      )}

      {/* PREVIEW TARJETA BLOQUEADA */}
      {previewCard && (() => {
        const prog      = getProgreso(previewCard.id)
        const sponsor   = getSponsor(previewCard.id)
        const marcaAgua = sponsor?.nombre || 'GOLMEBOL'
        const previewColor = previewCard.color || '#00ee55'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}
            onClick={() => setPreviewCard(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: '700', color: '#fff', fontSize: '1rem', marginBottom: '2px' }}>{previewCard.nombre}</div>
                <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.45)' }}>Vista previa · Desbloquea para usarla</div>
              </div>
              <div style={{ width: '100%', position: 'relative', userSelect: 'none' }}>
                {/* Para tarjetas custom mostramos un placeholder visual */}
                <PlayerCard
  playerName={nombre}
  stats={cardStats}
  cardType={previewCard.id}
  customDesign={{
    color: previewCard.color || '#e8710a',
    colorSecundario: previewCard.color || '#e8710a',
    fondo: ['#0a0a0a', '#111111', '#080808'],
    borde: previewCard.color || '#e8710a',
    nivel: 1,
    efectos: [],
    decoracion: null,
  }}
  esPortero={esPortero}
  photoUrlExterno={player.photo_url || null}
  hideShields={true}
/>
                  <PlayerCard playerName={nombre} stats={cardStats} cardType={previewCard.id} esPortero={esPortero} photoUrlExterno={player.photo_url || null} hideShields={true}/>
                )}
                <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden', borderRadius: '12px' }}>
                  {[...Array(10)].map((_, row) => (
                    <div key={row} style={{ position: 'absolute', top: `${row * 13 - 10}%`, left: '-30%', width: '160%', display: 'flex', gap: '32px', transform: 'rotate(-35deg)', whiteSpace: 'nowrap' }}>
                      {[...Array(6)].map((_, col) => (
                        <span key={col} style={{ fontSize: '1.4rem', fontWeight: '900', color: 'rgba(255,255,255,.45)', letterSpacing: '.18em', textTransform: 'uppercase', flexShrink: 0, fontFamily: 'system-ui' }}>{marcaAgua}</span>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 25, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(30,30,30,.85)', backdropFilter: 'blur(10px)', border: '2px solid rgba(180,180,180,.4)', boxShadow: '0 6px 30px rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {sponsor?.logo_url ? <img src={sponsor.logo_url} style={{ width: '90px', height: '90px', objectFit: 'cover' }}/> : <span style={{ fontSize: '2.6rem', filter: 'grayscale(100%) brightness(0.6)' }}>🔒</span>}
                  </div>
                  <div style={{ background: 'rgba(30,30,30,.85)', backdropFilter: 'blur(6px)', borderRadius: '20px', padding: '4px 16px', fontSize: '.65rem', color: 'rgba(230,230,230,.9)', fontWeight: '700', letterSpacing: '.14em', border: '1px solid rgba(180,180,180,.3)' }}>
                    {sponsor?.logo_url ? sponsor.nombre.toUpperCase() : 'BLOQUEADA'}
                  </div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 18px', width: '100%' }}>
                <div style={{ fontSize: '.7rem', color: '#9aa0a6', fontWeight: '600', letterSpacing: '.08em', marginBottom: '8px' }}>CÓMO DESBLOQUEAR</div>
                <div style={{ fontSize: '.85rem', color: '#d93025', fontWeight: '600', marginBottom: '12px' }}>🔒 {prog?.descripcion || 'Completa los logros requeridos'}</div>
                {prog && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '.75rem', color: '#5f6368' }}>Tu progreso</span>
                      <span style={{ fontSize: '.75rem', fontWeight: '700', color: '#202124' }}>{prog.actual} / {prog.meta} logros</span>
                    </div>
                    <div style={{ background: '#f1f3f4', borderRadius: '10px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${prog.pct}%`, background: 'linear-gradient(90deg,#1a73e8,#6c35de)', borderRadius: '10px' }}/>
                    </div>
                    <div style={{ fontSize: '.72rem', color: prog.pct >= 80 ? '#1e8e3e' : '#9aa0a6', textAlign: 'center', fontWeight: '500', marginBottom: previewLogros.length > 0 ? '12px' : '0' }}>
                      {prog.pct}% completado {prog.pct >= 80 ? '🔥 ¡Ya casi!' : ''}
                    </div>
                  </>
                )}
                {previewLogros.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', fontWeight: '600', marginBottom: '4px' }}>LOGROS REQUERIDOS</div>
                    {previewLogros.map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: l.completado ? '#e6f4ea' : '#f8f9fa', border: `1px solid ${l.completado ? '#1e8e3e33' : '#e8eaed'}` }}>
                        <span style={{ fontSize: '.85rem', flexShrink: 0 }}>{l.completado ? '✅' : l.tipo === 'universal' ? '⭐' : l.tipo === 'arquero' ? '🧤' : l.tipo === 'defensa' ? '🛡️' : '⚽'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.76rem', fontWeight: '500', color: l.completado ? '#1e8e3e' : '#202124' }}>{l.nombre}</div>
                          {!l.completado && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                              <div style={{ flex: 1, background: '#e8eaed', borderRadius: '4px', height: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, Math.round((l.valorActual / l.meta) * 100))}%`, background: '#1a73e8', borderRadius: '4px' }}/>
                              </div>
                              <span style={{ fontSize: '.62rem', color: '#9aa0a6', flexShrink: 0 }}>{l.valorActual}/{l.meta}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {previewLogros.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '8px', color: '#9aa0a6', fontSize: '.72rem' }}>Cargando logros...</div>
                )}
                {sponsor && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f3f4', fontSize: '.7rem', color: '#9aa0a6', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    {sponsor.logo_url && <img src={sponsor.logo_url} style={{ height: '14px', objectFit: 'contain' }}/>}
                    Patrocinado por <span style={{ fontWeight: '600', color: '#5f6368' }}>{sponsor.nombre}</span>
                  </div>
                )}
              </div>
              <button onClick={() => setPreviewCard(null)} style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '10px', padding: '10px 32px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '500' }}>Cerrar</button>
            </div>
          </div>
        )
      })()}

      {/* SELECTOR */}
      {showSelector && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowSelector(false)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem' }}>Elige tu tarjeta</div>
                <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '2px' }}>{tarjetasDesbloqueadas.length} / {CARD_DESIGNS.length + tarjetasCustom.length} desbloqueadas</div>
              </div>
              <button onClick={() => setShowSelector(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#5f6368' }}>✕</button>
            </div>

            {/* Grupos estáticos */}
            {GRUPOS.map(grupo => (
              <div key={grupo.label} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '600', color: grupo.color, marginBottom: '8px', letterSpacing: '.06em' }}>{grupo.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {grupo.ids.map(cid => {
                    const d       = CARD_DESIGNS.find(x => x.id === cid)
                    const desbloq = estaDesbloqueada(cid)
                    const activa  = cid === cardType
                    const prog    = getProgreso(cid)
                    const sponsor = getSponsor(cid)
                    if (!d) return null
                    return (
                      <div key={cid} onClick={() => handleClickTarjeta(d)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: activa ? '2px solid #1a73e8' : '1px solid #e8eaed', background: activa ? '#e8f0fe' : '#fff', cursor: 'pointer', transition: 'all .15s' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `linear-gradient(135deg, ${d.color}, ${d.colorSecundario || d.color})`, filter: desbloq ? 'none' : 'grayscale(80%) brightness(0.7)' }}/>
                          {!desbloq && <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '.65rem' }}>🔒</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.82rem', fontWeight: activa ? '700' : '500', color: activa ? '#1a73e8' : desbloq ? '#202124' : '#9aa0a6' }}>{d.nombre}</div>
                          {sponsor && desbloq && <div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>✦ {sponsor.nombre}</div>}
                          {prog && !desbloq && (
                            <>
                              <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '1px' }}>{prog.descripcion}</div>
                              <div style={{ background: '#f1f3f4', borderRadius: '6px', height: '3px', marginTop: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${prog.pct}%`, background: '#1a73e8', borderRadius: '6px' }}/>
                              </div>
                              <div style={{ fontSize: '.6rem', color: '#9aa0a6', marginTop: '2px' }}>{prog.actual} / {prog.meta} logros</div>
                            </>
                          )}
                        </div>
                        {activa      && <span style={{ fontSize: '.7rem', color: '#1a73e8', fontWeight: '700', flexShrink: 0 }}>✓ Activa</span>}
                        {desbloq && !activa && <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '1px 8px', flexShrink: 0 }}>Usar</span>}
                        {!desbloq    && <span style={{ fontSize: '.72rem', color: '#1a73e8', flexShrink: 0 }}>👁 Ver</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Tarjetas custom */}
            {tarjetasCustom.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '600', color: '#e8710a', marginBottom: '8px', letterSpacing: '.06em' }}>⭐ ESPECIALES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tarjetasCustom.map(card => {
                    const cardObj  = { id: card.id, nombre: card.nombre, color: card.color || '#e8710a', isCustom: true, descripcion: card.descripcion }
                    const desbloq  = estaDesbloqueada(card.id)
                    const activa   = card.id === cardType
                    const prog     = getProgreso(card.id)
                    const sponsor  = getSponsor(`custom_${card.id}`)
                    return (
                      <div key={card.id} onClick={() => handleClickTarjeta(cardObj)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: activa ? `2px solid ${card.color}` : '1px solid #e8eaed', background: activa ? `${card.color}11` : '#fff', cursor: 'pointer', transition: 'all .15s' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: card.color || '#e8710a', filter: desbloq ? 'none' : 'grayscale(80%) brightness(0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.9rem' }}>⭐</div>
                          {!desbloq && <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '.65rem' }}>🔒</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.82rem', fontWeight: activa ? '700' : '500', color: activa ? card.color : desbloq ? '#202124' : '#9aa0a6' }}>{card.nombre}</div>
                          {card.descripcion && <div style={{ fontSize: '.65rem', color: '#9aa0a6', marginTop: '1px' }}>{card.descripcion}</div>}
                          {sponsor && <div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>✦ {sponsor.nombre}</div>}
                          {prog && !desbloq && (
                            <>
                              <div style={{ background: '#f1f3f4', borderRadius: '6px', height: '3px', marginTop: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${prog.pct}%`, background: card.color || '#e8710a', borderRadius: '6px' }}/>
                              </div>
                              <div style={{ fontSize: '.6rem', color: '#9aa0a6', marginTop: '2px' }}>{prog.actual} / {prog.meta} logros</div>
                            </>
                          )}
                        </div>
                        {activa      && <span style={{ fontSize: '.7rem', fontWeight: '700', color: card.color, flexShrink: 0 }}>✓ Activa</span>}
                        {desbloq && !activa && <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '1px 8px', flexShrink: 0 }}>Usar</span>}
                        {!desbloq    && <span style={{ fontSize: '.72rem', color: '#1a73e8', flexShrink: 0 }}>👁 Ver</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e8f0fe', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {player.photo_face_url ? <img src={player.photo_face_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1.1rem' }}>👤</span>}
          </div>
          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', lineHeight: 1.2 }}>{player.name?.split(' ')[0]}</div>
            <div style={{ fontSize: '.72rem', color: nivelColor, fontWeight: '500' }}>{nivelTexto} · {stats?.pj || 0} PJ</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#fff', background: '#1a73e8', borderRadius: '20px', padding: '3px 10px' }}>GOLMEBOL</div>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem', fontWeight: '500' }}>Salir</button>
        </div>
      </div>

      <NotifBanner notifs={notifs} onDismiss={dismissNotif}/>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', padding: '0 16px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: tab === t.id ? '600' : '400', color: tab === t.id ? '#1a73e8' : '#5f6368', borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <span>{t.icon}</span> {t.label}
            {t.id === 'historial' && historial.length > 0 && (
              <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#fff', background: '#5f6368', borderRadius: '10px', padding: '1px 6px', marginLeft: '2px' }}>{historial.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* MI TARJETA */}
      {tab === 'tarjeta' && (
        <div>
          <div style={{ background: `radial-gradient(ellipse 85% 50% at 50% -5%, ${cardColor}22 0%, transparent 62%), #07070e`, padding: '12px 16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.3)', letterSpacing: '.06em' }}>
                {torneos.length > 0 ? 'Toca el escudo para ver el torneo' : ''}
              </span>
              <button onClick={() => setShowSelector(true)}
                style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '20px', padding: '4px 12px', cursor: 'pointer', color: 'rgba(255,255,255,.7)', fontSize: '.68rem', fontWeight: '500' }}>
                🃏 {cardDesign?.nombre || 'Cambiar'} {guardandoCard ? '...' : ''}
              </button>
            </div>
            <div ref={cardRef} style={{ width: '100%' }}>
              <PlayerCard
                playerName={nombre} stats={cardStats} cardType={cardType} esPortero={esPortero}
                photoUrlExterno={player.photo_url || null} torneosData={torneosData} equiposData={equiposData}
                onStatClick={handleCardClick}
              />
            </div>
          </div>

          <CardProgressSection
            playerId={player.id}
            esPortero={esPortero}
            posicionDetallada={player.posicion_futbol5 || player.posicion_futbol7 || player.posicion_futbol11}
          />

          {player.fecha_vencimiento && (
            <div style={{ padding: '0 16px 8px' }}>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1e8e3e', flexShrink: 0 }}/>
                <div style={{ fontSize: '.78rem', color: '#5f6368' }}>
                  Membresía activa hasta <span style={{ fontWeight: '600', color: '#202124' }}>
                    {new Date(player.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '0 16px 8px' }}>
            <button onClick={handleCompartir} disabled={compartiendo}
              style={{ width: '100%', padding: '11px', background: compartiendo ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: compartiendo ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '600', fontSize: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {compartiendo ? '⏳ Generando imagen...' : '📤 Descargar / Compartir tarjeta'}
            </button>
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer' }}
              onClick={() => setShowSelector(true)}>
              <div style={{ fontSize: '.78rem', color: '#5f6368' }}>
                Tarjetas desbloqueadas: <span style={{ fontWeight: '600', color: '#1a73e8' }}>{tarjetasDesbloqueadas.length}</span> / {CARD_DESIGNS.length + tarjetasCustom.length}
              </div>
              <span style={{ fontSize: '.75rem', color: '#1a73e8', fontWeight: '500' }}>Ver todas →</span>
            </div>
          </div>
        </div>
      )}

      {/* HISTORIAL */}
      {tab === 'historial' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '.82rem', fontWeight: '600', color: '#202124', marginBottom: '12px' }}>
            Mis partidos · {historial.length} jugados
          </div>
          {historial.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
              <div style={{ fontSize: '.875rem' }}>Aún no has jugado partidos</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historial.map((h, i) => {
                const match     = h.matches
                if (!match) return null
                const resultado = h.team_result
                const resColor  = resultado === 'win' ? '#1e8e3e' : resultado === 'draw' ? '#e8710a' : '#d93025'
                const resBg     = resultado === 'win' ? '#e6f4ea'  : resultado === 'draw' ? '#fce8d9'  : '#fce8e6'
                const resLabel  = resultado === 'win' ? 'G'        : resultado === 'draw' ? 'E'        : 'P'
                return (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '.65rem', fontWeight: '700', color: resColor, background: resBg, borderRadius: '4px', padding: '2px 7px' }}>{resLabel}</span>
                        {match.matchday && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '1px 7px' }}>J{match.matchday}</span>}
                      </div>
                      {match.played_at && (
                        <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>
                          📅 {new Date(match.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '.85rem', fontWeight: '600', color: '#202124', textAlign: 'right' }}>{match.home?.name}</span>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {match.home?.logo_url ? <img src={match.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <span style={{ fontSize: '.7rem' }}>⚽</span>}
                        </div>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: '#202124', padding: '4px 12px', background: '#f1f3f4', borderRadius: '8px', flexShrink: 0 }}>
                        {match.home_score} - {match.away_score}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {match.away?.logo_url ? <img src={match.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/> : <span style={{ fontSize: '.7rem' }}>⚽</span>}
                        </div>
                        <span style={{ fontSize: '.85rem', fontWeight: '600', color: '#202124' }}>{match.away?.name}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(h.goals_scored || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>⚽ {h.goals_scored} gol{h.goals_scored > 1 ? 'es' : ''}</span>}
                      {(h.yellow_cards || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟨 Amarilla</span>}
                      {(h.blue_cards || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟦 Azul</span>}
                      {(h.red_cards || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#d93025', background: '#fce8e6', borderRadius: '20px', padding: '2px 9px', fontWeight: '600' }}>🟥 Roja</span>}
                      {(h.goals_conceded || 0) > 0 && esPortero && <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>🧤 {h.goals_conceded} recibido{h.goals_conceded > 1 ? 's' : ''}</span>}
                      {(h.fouls || 0) > 0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 9px' }}>✋ {h.fouls} falta{h.fouls > 1 ? 's' : ''}</span>}
                      {(h.goals_scored || 0) === 0 && (h.yellow_cards || 0) === 0 && (h.blue_cards || 0) === 0 && (h.red_cards || 0) === 0 && (h.fouls || 0) === 0 && <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Sin incidencias</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* PREDIX */}
      {tab === 'predix' && (
        <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/jugador/noticias')}
            style={{ width: '100%', maxWidth: '300px', padding: '12px 16px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <span style={{ fontSize: '1.2rem' }}>📰</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>Noticias del torneo</div>
              <div style={{ fontSize: '.72rem', color: '#5f6368' }}>Pre-partido, resultados y más</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#9aa0a6' }}>→</span>
          </button>
          <div style={{ fontSize: '2.5rem' }}>🎯</div>
          <div style={{ fontWeight: '800', fontSize: '1.3rem', color: '#07070e', letterSpacing: '2px' }}>PREDIX</div>
          <div style={{ fontSize: '.85rem', color: '#5f6368', textAlign: 'center', maxWidth: '280px' }}>
            Predice los resultados de los partidos y compite con otros jugadores por puntos
          </div>
          <button onClick={() => navigate('/jugador/apuestas')}
            style={{ padding: '14px 32px', background: '#07070e', border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#00ddd0', fontWeight: '800', fontSize: '1rem', letterSpacing: '1px' }}>
            ENTRAR A PREDIX →
          </button>
        </div>
      )}

      {rankingModal && (
        <StatRankingModal
          statKey={rankingModal}
          playerId={player.id}
          esPortero={esPortero}
          onClose={() => setRankingModal(null)}
        />
      )}
    </div>
  )
}
