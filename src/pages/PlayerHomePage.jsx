import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/card/PlayerCard'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'
import html2canvas from 'html2canvas'
import StatRankingModal from '../components/card/StatRankingModal'

const TABS = [
  { id: 'tarjeta', label: 'Mi Tarjeta', icon: '🃏' },
  { id: 'logros',  label: 'Logros',     icon: '⭐' },
  { id: 'predix',  label: 'Predix',     icon: '🎯' },
]

export default function PlayerHomePage() {
  const navigate     = useNavigate()
  const cardRef      = useRef(null)
  const [player,     setPlayer]     = useState(null)
  const [stats,      setStats]      = useState(null)
  const [torneos,    setTorneos]    = useState([])
  const [requisitos, setRequisitos] = useState([])
  const [sponsors,   setSponsors]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('tarjeta')
  const [cardType,   setCardType]   = useState('nivel1_verde')
  const [showSelector,   setShowSelector]   = useState(false)
  const [guardandoCard,  setGuardandoCard]  = useState(false)
  const [previewCard,    setPreviewCard]    = useState(null)
  const [nuevasTarjetas, setNuevasTarjetas] = useState([])
  const [notifIndex,     setNotifIndex]     = useState(0)
  const [compartiendo,   setCompartiendo]   = useState(false)
  const [rankingModal, setRankingModal] = useState(null) // key del stat

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

    const { data: reqs } = await supabase.from('card_requisitos').select('*')
    setRequisitos(reqs || [])

    const { data: spons } = await supabase.from('sponsors').select('*').eq('activo', true)
    setSponsors(spons || [])

    const { data: regs } = await supabase
      .from('tournament_player_registrations')
      .select('*, teams(id,name,logo_url), tournaments(id,name,modalidad,season,logo_url)')
      .eq('player_id', p.id).eq('activo', true)
    setTorneos(regs || [])

    if (reqs) {
      const vistas = p.tarjetas_vistas || []
      const desbloqueadas = CARD_DESIGNS.filter(d => {
        const req = reqs.find(r => r.id === d.id)
        if (!req) return false
        if (req.requisito_meta === 0) return true
        switch (req.requisito_tipo) {
          case 'pj':        return (statsCalc.pj        || 0) >= req.requisito_meta
          case 'goles':     return (statsCalc.goles      || 0) >= req.requisito_meta
          case 'victorias': return (statsCalc.pg         || 0) >= req.requisito_meta
          case 'eficacia':  return (statsCalc.pj || 0) >= 5 && (statsCalc.eficacia || 0) >= req.requisito_meta
          case 'racha':     return (statsCalc.rachaVictorias || 0) >= req.requisito_meta
          case 'titulos':   return (statsCalc.titulos    || 0) >= req.requisito_meta
          default:          return false
        }
      })
      const nuevas = desbloqueadas.filter(d => !vistas.includes(d.id))
      if (nuevas.length > 0) {
        setNuevasTarjetas(nuevas)
        setNotifIndex(0)
      }
    }

    setLoading(false)
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
        backgroundColor: '#07070e',
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        onclone: (doc) => {
          const style = doc.createElement('style')
          style.innerHTML = `
            :root {
              --font-display: Impact, sans-serif;
              --font-body: Arial, sans-serif;
              --color-primary: #00ddd0;
            }
          `
          doc.head.appendChild(style)
        }
      })

      // Siempre descargar directamente para evitar error de gesto de usuario
      // En móvil el jugador puede compartir desde la galería
      const url = canvas.toDataURL('image/png')
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${nombre}_golmebol.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

    } catch (e) {
      console.error('Error al generar imagen:', e)
    }
    setCompartiendo(false)
  }

  function estaDesbloqueada(cardId) {
    const req = requisitos.find(r => r.id === cardId)
    if (!req) return false
    if (req.requisito_meta === 0) return true
    if (!stats) return false
    switch (req.requisito_tipo) {
      case 'pj':        return (stats.pj        || 0) >= req.requisito_meta
      case 'goles':     return (stats.goles      || 0) >= req.requisito_meta
      case 'victorias': return (stats.pg         || 0) >= req.requisito_meta
      case 'eficacia':  return (stats.pj || 0) >= 5 && (stats.eficacia || 0) >= req.requisito_meta
      case 'racha':     return (stats.rachaVictorias || 0) >= req.requisito_meta
      case 'titulos':   return (stats.titulos    || 0) >= req.requisito_meta
      default:          return false
    }
  }

  function getProgreso(cardId) {
    const req = requisitos.find(r => r.id === cardId)
    if (!req || req.requisito_meta === 0 || !stats) return null
    let actual = 0
    switch (req.requisito_tipo) {
      case 'pj':        actual = stats.pj || 0; break
      case 'goles':     actual = stats.goles || 0; break
      case 'victorias': actual = stats.pg || 0; break
      case 'eficacia':  actual = stats.eficacia || 0; break
      case 'racha':     actual = stats.rachaVictorias || 0; break
      case 'titulos':   actual = stats.titulos || 0; break
    }
    const sufijo = req.requisito_tipo === 'eficacia' ? '%' : ''
    const pct    = Math.min(100, Math.round((actual / req.requisito_meta) * 100))
    return { actual, meta: req.requisito_meta, sufijo, pct, descripcion: req.descripcion }
  }

  function getSponsor(cardId) {
    return sponsors.find(s => s.card_id === cardId) || null
  }

  async function handleSeleccionarTarjeta(id) {
    if (!estaDesbloqueada(id)) return
    setGuardandoCard(true)
    setCardType(id)
    await supabase.from('players').update({ card_type: id }).eq('id', player.id)
    setGuardandoCard(false)
    setShowSelector(false)
  }

  function handleClickTarjeta(d) {
    if (estaDesbloqueada(d.id)) {
      handleSeleccionarTarjeta(d.id)
    } else {
      setPreviewCard(d)
      setShowSelector(false)
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
    // Si es una stat key, abrir ranking
    const statKeys = ['pj', 'gc', 'prom', 'efic', 'pg', 'pe', 'pp']
    if (statKeys.includes(itemId)) {
      setRankingModal(itemId)
      return
    }
    // Si es torneo o equipo, navegar
    const torneo = torneosData.find(t => t.id === itemId)
    if (torneo) { navigate(`/jugador/torneo/${torneo.id}`); return }
    const reg = torneos.find(t => t.teams?.id === itemId)
    if (reg) navigate(`/jugador/torneo/${reg.tournament_id}`)
  }

  const tarjetasDesbloqueadas = CARD_DESIGNS.filter(d => estaDesbloqueada(d.id))

  const logrosDinamicos = [
    { nombre: 'Veterano',        desc: 'Juega 50 partidos',                       icono: '🌟', desbloqueado: (stats?.pj||0)>=50,                                    progreso: `${stats?.pj||0}/50 PJ` },
    { nombre: 'Goleador',        desc: 'Anota 20 goles',                          icono: '⚽', desbloqueado: !esPortero&&(stats?.goles||0)>=20,                      progreso: esPortero?'Solo campo':`${stats?.goles||0}/20 goles` },
    { nombre: 'Valla Invicta',   desc: '5 partidos sin recibir goles (portero)',  icono: '🧤', desbloqueado: esPortero&&(stats?.pj||0)>=5&&(stats?.recibidos||0)===0, progreso: esPortero?`${stats?.recibidos||0} recibidos`:'Solo porteros' },
    { nombre: 'Máxima Eficacia', desc: '80%+ eficacia con mínimo 10 PJ',         icono: '⚡', desbloqueado: (stats?.pj||0)>=10&&(stats?.eficacia||0)>=80,            progreso: `${stats?.eficacia||0}% · ${stats?.pj||0} PJ` },
    { nombre: 'Racha Ganadora',  desc: '10 victorias consecutivas',               icono: '🔥', desbloqueado: (stats?.rachaVictorias||0)>=10,                          progreso: `Racha: ${stats?.rachaVictorias||0}` },
    { nombre: 'Campeón',         desc: 'Gana un torneo con tu equipo',            icono: '🏆', desbloqueado: (stats?.titulos||0)>0,                                   progreso: `${stats?.titulos||0} títulos` },
  ]


  const logrosDesbloqueados = logrosDinamicos.filter(l => l.desbloqueado).length

  const GRUPOS = [
    { label: 'Nivel 1 — Inicio', ids: CARD_DESIGNS.filter(d => d.nivel === 1).map(d => d.id), color: '#1e8e3e' },
    { label: 'Nivel 2 — 10 PJ',  ids: CARD_DESIGNS.filter(d => d.nivel === 2).map(d => d.id), color: '#1a73e8' },
    { label: 'Nivel 3 — 25 PJ',  ids: CARD_DESIGNS.filter(d => d.nivel === 3).map(d => d.id), color: '#6c35de' },
    { label: 'Premium',           ids: CARD_DESIGNS.filter(d => d.nivel === 6).map(d => d.id), color: '#e8710a' },
  ]

  const tarjetaNotif = nuevasTarjetas[notifIndex]

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* ── NOTIFICACIÓN TARJETA NUEVA ── */}
      {tarjetaNotif && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontWeight: '800', color: '#fff', fontSize: '1.3rem', letterSpacing: '.04em' }}>¡NUEVA TARJETA!</div>
              <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.55)', marginTop: '4px' }}>Has desbloqueado una nueva tarjeta</div>
              {nuevasTarjetas.length > 1 && (
                <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.4)', marginTop: '4px' }}>{notifIndex + 1} de {nuevasTarjetas.length}</div>
              )}
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

      {/* ── PREVIEW TARJETA BLOQUEADA ── */}
      {previewCard && (() => {
        const prog      = getProgreso(previewCard.id)
        const sponsor   = getSponsor(previewCard.id)
        const marcaAgua = sponsor?.nombre || 'GOLMEBOL'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}
            onClick={() => setPreviewCard(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: '700', color: '#fff', fontSize: '1rem', marginBottom: '2px' }}>{previewCard.nombre}</div>
                <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.45)' }}>Vista previa · Desbloquea para usarla</div>
              </div>
              <div style={{ width: '100%', position: 'relative', userSelect: 'none' }}>
                <PlayerCard playerName={nombre} stats={cardStats} cardType={previewCard.id} esPortero={esPortero} photoUrlExterno={player.photo_url || null} hideShields={true}/>
                <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden', borderRadius: '12px' }}>
                  {[...Array(10)].map((_, row) => (
                    <div key={row} style={{ position: 'absolute', top: `${row * 13 - 10}%`, left: '-30%', width: '160%', display: 'flex', gap: '32px', transform: 'rotate(-35deg)', whiteSpace: 'nowrap' }}>
                      {[...Array(6)].map((_, col) => (
                        <span key={col} style={{ fontSize: '1.4rem', fontWeight: '900', color: 'rgba(255,255,255,.45)', letterSpacing: '.18em', textTransform: 'uppercase', flexShrink: 0, fontFamily: 'system-ui, sans-serif' }}>{marcaAgua}</span>
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
                <div style={{ fontSize: '.85rem', color: '#d93025', fontWeight: '600', marginBottom: '12px' }}>🔒 {prog?.descripcion || 'Completa el requisito'}</div>
                {prog && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '.75rem', color: '#5f6368' }}>Tu progreso</span>
                      <span style={{ fontSize: '.75rem', fontWeight: '700', color: '#202124' }}>{prog.actual}{prog.sufijo} / {prog.meta}{prog.sufijo}</span>
                    </div>
                    <div style={{ background: '#f1f3f4', borderRadius: '10px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${prog.pct}%`, background: 'linear-gradient(90deg,#1a73e8,#6c35de)', borderRadius: '10px' }}/>
                    </div>
                    <div style={{ fontSize: '.72rem', color: prog.pct >= 80 ? '#1e8e3e' : '#9aa0a6', textAlign: 'center', fontWeight: '500' }}>
                      {prog.pct}% completado {prog.pct >= 80 ? '🔥 ¡Ya casi!' : ''}
                    </div>
                  </>
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

      {/* ── SELECTOR ── */}
      {showSelector && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowSelector(false)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem' }}>Elige tu tarjeta</div>
                <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '2px' }}>{tarjetasDesbloqueadas.length} / {CARD_DESIGNS.length} desbloqueadas</div>
              </div>
              <button onClick={() => setShowSelector(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#5f6368' }}>✕</button>
            </div>
            {GRUPOS.map(grupo => (
              <div key={grupo.label} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '600', color: grupo.color, marginBottom: '8px', letterSpacing: '.06em' }}>{grupo.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {grupo.ids.map(cid => {
                    const d = CARD_DESIGNS.find(x => x.id === cid)
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
                              <div style={{ fontSize: '.6rem', color: '#9aa0a6', marginTop: '2px' }}>{prog.actual}{prog.sufijo} / {prog.meta}{prog.sufijo}</div>
                            </>
                          )}
                        </div>
                        {activa     && <span style={{ fontSize: '.7rem', color: '#1a73e8', fontWeight: '700', flexShrink: 0 }}>✓ Activa</span>}
                        {desbloq && !activa && <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '1px 8px', flexShrink: 0 }}>Usar</span>}
                        {!desbloq   && <span style={{ fontSize: '.72rem', color: '#1a73e8', flexShrink: 0 }}>👁 Ver</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
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

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', padding: '0 16px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: tab === t.id ? '600' : '400', color: tab === t.id ? '#1a73e8' : '#5f6368', borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all .15s' }}>
            <span>{t.icon}</span> {t.label}
            {t.id === 'logros' && logrosDesbloqueados > 0 && (
              <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#fff', background: '#1e8e3e', borderRadius: '10px', padding: '1px 6px', marginLeft: '2px' }}>{logrosDesbloqueados}</span>
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
                playerName={nombre}
                stats={cardStats}
                cardType={cardType}
                esPortero={esPortero}
                photoUrlExterno={player.photo_url || null}
                torneosData={torneosData}
                equiposData={equiposData}
                onStatClick={handleCardClick}
              />
            </div>
          </div>

          {player.fecha_vencimiento && (
            <div style={{ padding: '10px 16px' }}>
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
              style={{ width: '100%', padding: '11px', background: compartiendo ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: compartiendo ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '600', fontSize: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background .15s' }}>
              {compartiendo ? '⏳ Generando imagen...' : '📤 Descargar / Compartir tarjeta'}
            </button>
          </div>

          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer' }}
              onClick={() => setShowSelector(true)}>
              <div style={{ fontSize: '.78rem', color: '#5f6368' }}>
                Tarjetas desbloqueadas: <span style={{ fontWeight: '600', color: '#1a73e8' }}>{tarjetasDesbloqueadas.length}</span> / {CARD_DESIGNS.length}
              </div>
              <span style={{ fontSize: '.75rem', color: '#1a73e8', fontWeight: '500' }}>Ver todas →</span>
            </div>
          </div>
        </div>
      )}

      {/* LOGROS */}
      {tab === 'logros' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '.82rem', fontWeight: '600', color: '#202124' }}>Logros</div>
            <span style={{ fontSize: '.75rem', color: '#5f6368' }}>{logrosDesbloqueados} / {logrosDinamicos.length} obtenidos</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logrosDinamicos.map(t => (
              <div key={t.nombre} style={{ background: '#fff', border: `1px solid ${t.desbloqueado ? '#1a73e8' : '#e8eaed'}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', opacity: t.desbloqueado ? 1 : .6, boxShadow: t.desbloqueado ? '0 2px 8px rgba(26,115,232,.15)' : '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.desbloqueado ? '#e8f0fe' : '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                  {t.desbloqueado ? t.icono : '🔒'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: t.desbloqueado ? '#1a73e8' : '#202124', fontSize: '.875rem' }}>{t.nombre}</div>
                  <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '2px' }}>{t.desc}</div>
                  <div style={{ fontSize: '.68rem', color: t.desbloqueado ? '#1e8e3e' : '#9aa0a6', marginTop: '3px', fontWeight: '500' }}>{t.progreso}</div>
                </div>
                {t.desbloqueado && <span style={{ fontSize: '.72rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '2px 10px', fontWeight: '600', flexShrink: 0 }}>✓</span>}
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/jugador/apuestas')}
  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', background: '#07070e', border: '1px solid #1e2d3d', borderRadius: '20px', cursor: 'pointer', color: '#00ddd0', fontSize: '.78rem', fontWeight: '700' }}>
  🎯 PREDIX
</button>
        </div>
      )}
      {/* PREDIX */}
{tab === 'predix' && (
  <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
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
{/* PREDIX */}
{tab === 'predix' && (
        <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
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