import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/card/PlayerCard'

function getCardType(pj) {
  if (pj < 10) return 'nivel1_verde'
  if (pj < 25) return 'nivel2_inicio'
  return 'nivel3_inicio'
}

const TABS = [
  { id: 'tarjeta', label: 'Mi Tarjeta', icon: '🃏' },
  { id: 'logros',  label: 'Logros',     icon: '⭐' },
]

export default function PlayerHomePage() {
  const navigate  = useNavigate()
  const [player,  setPlayer]  = useState(null)
  const [stats,   setStats]   = useState(null)
  const [torneos, setTorneos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('tarjeta')

  useEffect(() => { fetchPlayer() }, [])

  async function fetchPlayer() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador/login'); return }

    if (!p.activo_membresia || (p.fecha_vencimiento && new Date(p.fecha_vencimiento) < new Date())) {
      await supabase.auth.signOut(); navigate('/jugador/login'); return
    }

    setPlayer(p)

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
    setStats({ pj, goles, recibidos, pg, pe, pp, eficacia, promedio })

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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#1a73e8', fontSize: '.9rem', fontWeight: '500' }}>Cargando...</div>
    </div>
  )

  if (!player) return null

  const esPortero  = player.posicion_futbol5 === 'Portero' || player.posicion_futbol7 === 'Portero' || player.posicion_futbol11 === 'Portero'
  const cardType   = getCardType(stats?.pj || 0)
  const nivelTexto = (stats?.pj || 0) < 10 ? 'Nivel 1' : (stats?.pj || 0) < 25 ? 'Nivel 2' : 'Nivel 3'
  const nivelColor = (stats?.pj || 0) < 10 ? '#1e8e3e' : (stats?.pj || 0) < 25 ? '#1a73e8' : '#6c35de'
  const cardColor  = cardType.startsWith('nivel3') ? '#4488ff' : cardType.startsWith('nivel2') ? '#4488ff' : '#00ee55'

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

  // Navegar al tocar escudo de torneo o equipo en la tarjeta
  function handleCardClick(itemId) {
    // ¿Es un torneo?
    const torneo = torneosData.find(t => t.id === itemId)
    if (torneo) { navigate(`/jugador/torneo/${torneo.id}`); return }
    // ¿Es un equipo? → ir al torneo de ese equipo
    const reg = torneos.find(t => t.teams?.id === itemId)
    if (reg) navigate(`/jugador/torneo/${reg.tournament_id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

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
          </button>
        ))}
      </div>

      {/* MI TARJETA */}
      {tab === 'tarjeta' && (
        <div>
          {/* Tarjeta con fondo oscuro propio */}
          <div style={{
            background: `radial-gradient(ellipse 85% 50% at 50% -5%, ${cardColor}22 0%, transparent 62%), #07070e`,
            padding: '12px 16px 20px',
          }}>
            {/* Hint para que sepa que puede tocar los escudos */}
            {torneos.length > 0 && (
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.3)', letterSpacing: '.06em' }}>
                  Toca el escudo del torneo o equipo para ver más info
                </span>
              </div>
            )}
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
        </div>
      )}

      {/* LOGROS */}
      {tab === 'logros' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '.82rem', fontWeight: '600', color: '#202124', marginBottom: '12px' }}>Logros y tarjetas especiales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { nombre: 'Máxima Eficacia', desc: 'Gana 10 partidos seguidos',        icono: '⚡', desbloqueado: false },
              { nombre: 'Goleador',        desc: 'Anota 20 goles en un torneo',       icono: '⚽', desbloqueado: false },
              { nombre: 'Valla Invicta',   desc: 'Mantén 5 partidos sin recibir gol', icono: '🧤', desbloqueado: false },
              { nombre: 'Campeón',         desc: 'Gana un torneo',                    icono: '🏆', desbloqueado: false },
              { nombre: 'Veterano',        desc: 'Juega 50 partidos',                 icono: '🌟', desbloqueado: false },
            ].map(t => (
              <div key={t.nombre} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', opacity: t.desbloqueado ? 1 : .55, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.desbloqueado ? '#e8f0fe' : '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                  {t.desbloqueado ? t.icono : '🔒'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: t.desbloqueado ? '#1a73e8' : '#202124', fontSize: '.875rem' }}>{t.nombre}</div>
                  <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '2px' }}>{t.desc}</div>
                </div>
                {t.desbloqueado && <span style={{ fontSize: '.72rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '2px 10px', fontWeight: '600', flexShrink: 0 }}>✓ Obtenido</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
