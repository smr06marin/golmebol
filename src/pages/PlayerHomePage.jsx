import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/card/PlayerCard'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'

function getCardType(pj) {
  if (pj < 10) return 'nivel1_verde'
  if (pj < 25) return 'nivel2_inicio'
  return 'nivel3_inicio'
}

const TABS = [
  { id: 'tarjeta',  label: 'Mi Tarjeta', icon: '🃏' },
  { id: 'logros',   label: 'Logros',     icon: '⭐' },
]

export default function PlayerHomePage() {
  const navigate   = useNavigate()
  const [player,   setPlayer]   = useState(null)
  const [stats,    setStats]    = useState(null)
  const [torneos,  setTorneos]  = useState([])
  const [requisitos, setRequisitos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('tarjeta')
  const [cardType, setCardType] = useState('nivel1_verde')
  const [showSelector, setShowSelector] = useState(false)
  const [guardandoCard, setGuardandoCard] = useState(false)

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

    // Stats
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

    // Racha actual de victorias
    let rachaVictorias = 0
    for (const r of [...raw].reverse()) {
      if (r.team_result === 'win') rachaVictorias++
      else break
    }

    // Títulos del jugador
    const { data: logrosJug } = await supabase
      .from('tournament_logros')
      .select('tipo')
      .eq('player_id', p.id)
      .eq('tipo', 'campeon')
    const titulos = (logrosJug || []).length

    setStats({ pj, goles, recibidos, pg, pe, pp, eficacia, promedio, rachaVictorias, titulos, esPortero: esPort })

    // Requisitos de tarjetas desde DB
    const { data: reqs } = await supabase.from('card_requisitos').select('*')
    setRequisitos(reqs || [])

    // Torneos
    const { data: regs } = await supabase
      .from('tournament_player_registrations')
      .select('*, teams(id,name,logo_url), tournaments(id,name,modalidad,season,logo_url)')
      .eq('player_id', p.id).eq('activo', true)
    setTorneos(regs || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  // Verificar si una tarjeta está desbloqueada
  function estaDesbloqueada(cardId) {
    const req = requisitos.find(r => r.id === cardId)
    if (!req) return false
    if (req.requisito_meta === 0) return true // disponible desde inicio
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
    if (!req || req.requisito_meta === 0) return null
    if (!stats) return null
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
    return `${actual}${sufijo} / ${req.requisito_meta}${sufijo}`
  }

  async function handleSeleccionarTarjeta(id) {
    if (!estaDesbloqueada(id)) return
    setGuardandoCard(true)
    setCardType(id)
    await supabase.from('players').update({ card_type: id }).eq('id', player.id)
    setGuardandoCard(false)
    setShowSelector(false)
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
    const torneo = torneosData.find(t => t.id === itemId)
    if (torneo) { navigate(`/jugador/torneo/${torneo.id}`); return }
    const reg = torneos.find(t => t.teams?.id === itemId)
    if (reg) navigate(`/jugador/torneo/${reg.tournament_id}`)
  }

  // Tarjetas desbloqueadas
  const tarjetasDesbloqueadas = CARD_DESIGNS.filter(d => estaDesbloqueada(d.id))

  // Logros dinámicos
  const logrosDinamicos = [
    { nombre: 'Veterano',       desc: 'Juega 50 partidos',                         icono: '🌟', desbloqueado: (stats?.pj||0)>=50,            progreso: `${stats?.pj||0}/50 PJ` },
    { nombre: 'Goleador',       desc: 'Anota 20 goles',                            icono: '⚽', desbloqueado: !esPortero&&(stats?.goles||0)>=20, progreso: esPortero?'Solo campo':`${stats?.goles||0}/20 goles` },
    { nombre: 'Valla Invicta',  desc: '5 partidos sin recibir goles (portero)',    icono: '🧤', desbloqueado: esPortero&&(stats?.pj||0)>=5&&(stats?.recibidos||0)===0, progreso: esPortero?`${stats?.recibidos||0} recibidos`:'Solo porteros' },
    { nombre: 'Máxima Eficacia',desc: '80%+ eficacia con mínimo 10 PJ',           icono: '⚡', desbloqueado: (stats?.pj||0)>=10&&(stats?.eficacia||0)>=80, progreso: `${stats?.eficacia||0}% · ${stats?.pj||0} PJ` },
    { nombre: 'Racha Ganadora', desc: '10 victorias consecutivas',                 icono: '🔥', desbloqueado: (stats?.rachaVictorias||0)>=10,  progreso: `Racha: ${stats?.rachaVictorias||0}` },
    { nombre: 'Campeón',        desc: 'Gana un torneo con tu equipo',              icono: '🏆', desbloqueado: (stats?.titulos||0)>0,           progreso: `${stats?.titulos||0} títulos` },
  ]

  const logrosDesbloqueados = logrosDinamicos.filter(l => l.desbloqueado).length

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* Modal selector de tarjetas */}
      {showSelector && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowSelector(false)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem' }}>Elige tu tarjeta</div>
                <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '2px' }}>{tarjetasDesbloqueadas.length} de {CARD_DESIGNS.length} desbloqueadas</div>
              </div>
              <button onClick={() => setShowSelector(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#5f6368' }}>✕</button>
            </div>

            {/* Grupos */}
            {[
              { label: 'Nivel 1 — Inicio',  ids: CARD_DESIGNS.filter(d => d.nivel === 1).map(d => d.id), color: '#1e8e3e' },
              { label: 'Nivel 2 — 10 PJ',   ids: CARD_DESIGNS.filter(d => d.nivel === 2).map(d => d.id), color: '#1a73e8' },
              { label: 'Nivel 3 — 25 PJ',   ids: CARD_DESIGNS.filter(d => d.nivel === 3).map(d => d.id), color: '#6c35de' },
              { label: 'Premium',            ids: CARD_DESIGNS.filter(d => d.nivel === 6).map(d => d.id), color: '#e8710a' },
            ].map(grupo => (
              <div key={grupo.label} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '600', color: grupo.color, marginBottom: '8px', letterSpacing: '.06em' }}>{grupo.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {grupo.ids.map(cid => {
                    const d        = CARD_DESIGNS.find(x => x.id === cid)
                    const desbloq  = estaDesbloqueada(cid)
                    const activa   = cid === cardType
                    const progreso = getProgreso(cid)
                    if (!d) return null
                    return (
                      <div key={cid}
                        onClick={() => desbloq && handleSeleccionarTarjeta(cid)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 12px', borderRadius: '10px',
                          border: activa ? '2px solid #1a73e8' : '1px solid #e8eaed',
                          background: activa ? '#e8f0fe' : desbloq ? '#fff' : '#f8f9fa',
                          cursor: desbloq ? 'pointer' : 'default',
                          opacity: desbloq ? 1 : .5,
                          transition: 'all .15s',
                        }}>
                        {/* Swatch */}
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `linear-gradient(135deg, ${d.color}, ${d.colorSecundario || d.color})`, flexShrink: 0 }}/>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '.82rem', fontWeight: activa ? '700' : '500', color: activa ? '#1a73e8' : '#202124' }}>{d.nombre}</div>
                          {progreso && !desbloq && <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '2px' }}>{progreso}</div>}
                          {!desbloq && <div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>🔒 {requisitos.find(r => r.id === cid)?.descripcion}</div>}
                        </div>
                        {activa && <span style={{ fontSize: '.7rem', color: '#1a73e8', fontWeight: '700' }}>✓ Activa</span>}
                        {desbloq && !activa && <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '1px 8px' }}>Usar</span>}
                        {!desbloq && <span style={{ fontSize: '1rem' }}>🔒</span>}
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
            {player.photo_face_url
              ? <img src={player.photo_face_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : <span style={{ fontSize: '1.1rem' }}>👤</span>}
          </div>
          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', lineHeight: 1.2 }}>{player.name?.split(' ')[0]}</div>
            <div style={{ fontSize: '.72rem', color: nivelColor, fontWeight: '500' }}>{nivelTexto} · {stats?.pj || 0} PJ</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#fff', background: '#1a73e8', borderRadius: '20px', padding: '3px 10px' }}>GOLMEBOL</div>
          <button onClick={handleLogout}
            style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem', fontWeight: '500' }}>
            Salir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', padding: '0 16px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '.82rem', fontWeight: tab === t.id ? '600' : '400',
              color: tab === t.id ? '#1a73e8' : '#5f6368',
              borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: '5px', transition: 'all .15s',
            }}>
            <span>{t.icon}</span> {t.label}
            {t.id === 'logros' && logrosDesbloqueados > 0 && (
              <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#fff', background: '#1e8e3e', borderRadius: '10px', padding: '1px 6px', marginLeft: '2px' }}>
                {logrosDesbloqueados}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* MI TARJETA */}
      {tab === 'tarjeta' && (
        <div>
          <div style={{
            background: `radial-gradient(ellipse 85% 50% at 50% -5%, ${cardColor}22 0%, transparent 62%), #07070e`,
            padding: '12px 16px 20px',
          }}>
            {/* Botón cambiar tarjeta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.3)', letterSpacing: '.06em' }}>
                {torneos.length > 0 ? 'Toca el escudo para ver el torneo' : ''}
              </span>
              <button onClick={() => setShowSelector(true)}
                style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '20px', padding: '4px 12px', cursor: 'pointer', color: 'rgba(255,255,255,.7)', fontSize: '.68rem', fontWeight: '500' }}>
                🃏 {cardDesign?.nombre || 'Cambiar tarjeta'} {guardandoCard ? '...' : ''}
              </button>
            </div>

            <div style={{ width: '100%' }}>
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

          {/* Membresía */}
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

          {/* Tarjetas desbloqueadas resumen */}
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
              <div key={t.nombre} style={{
                background: '#fff',
                border: `1px solid ${t.desbloqueado ? '#1a73e8' : '#e8eaed'}`,
                borderRadius: '12px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: '14px',
                opacity: t.desbloqueado ? 1 : .6,
                boxShadow: t.desbloqueado ? '0 2px 8px rgba(26,115,232,.15)' : '0 1px 3px rgba(0,0,0,.06)',
              }}>
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
        </div>
      )}
    </div>
  )
}
