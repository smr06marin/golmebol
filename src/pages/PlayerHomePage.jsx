import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/card/PlayerCard'
import { LogOut, Trophy, Zap, Newspaper, History } from 'lucide-react'

export default function PlayerHomePage() {
  const navigate = useNavigate()
  const [player,   setPlayer]   = useState(null)
  const [stats,    setStats]    = useState(null)
  const [torneos,  setTorneos]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [mvpCount, setMvpCount] = useState(0)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador/login'); return }
    if (!p.activo_membresia) { navigate('/jugador/login'); return }
    setPlayer(p)

    const [{ data: raw }, { data: torneosData }, { data: mvps }] = await Promise.all([
      supabase.from('player_match_stats').select('*').eq('player_id', p.id),
      supabase.from('tournament_player_registrations')
        .select('*, tournaments(id,name,modalidad,season,logo_url), teams(id,name,logo_url)')
        .eq('player_id', p.id).eq('activo', true),
      supabase.from('tournament_logros').select('id').eq('player_id', p.id).eq('tipo', 'mvp'),
    ])

    const r = raw || []
    const pj        = r.length
    const goles     = r.reduce((s, x) => s + (x.goals_scored   || 0), 0)
    const recibidos = r.reduce((s, x) => s + (x.goals_conceded || 0), 0)
    const pg        = r.filter(x => x.team_result === 'win').length
    const pe        = r.filter(x => x.team_result === 'draw').length
    const pp        = r.filter(x => x.team_result === 'loss').length
    const amarillas = r.reduce((s, x) => s + (x.yellow_cards   || 0), 0)
    const azules    = r.reduce((s, x) => s + (x.blue_cards     || 0), 0)
    const rojas     = r.reduce((s, x) => s + (x.red_cards      || 0), 0)
    const eficacia  = pj > 0 ? Math.round((pg / pj) * 100) : 0
    let racha = 0, maxRacha = 0
    for (const x of [...r].reverse()) {
      if (x.team_result === 'win') { racha++; maxRacha = Math.max(maxRacha, racha) }
      else racha = 0
    }
    setStats({ pj, goles, recibidos, pg, pe, pp, amarillas, azules, rojas, eficacia, maxRacha })
    setTorneos(torneosData || [])
    setMvpCount((mvps || []).length)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/jugador/login')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#07070e', display:'flex', alignItems:'center', justifyContent:'center', color:'#00ddd0', fontSize:'.9rem' }}>
      Cargando...
    </div>
  )

  const esPortero = player?.posicion_futbol5==='Portero' || player?.posicion_futbol7==='Portero' || player?.posicion_futbol11==='Portero'

  const cardStats = {
    pj:          stats?.pj       || 0,
    golesContra: esPortero ? (stats?.recibidos || 0) : (stats?.goles || 0),
    promedio:    stats?.pj > 0 ? parseFloat((esPortero ? stats.recibidos/stats.pj : stats.goles/stats.pj).toFixed(2)) : 0,
    eficacia:    stats?.eficacia || 0,
    pg:          stats?.pg       || 0,
    pe:          stats?.pe       || 0,
    pp:          stats?.pp       || 0,
  }

  const diasRestantes = player?.fecha_vencimiento
    ? Math.ceil((new Date(player.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#1e2d3d', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {player?.photo_face_url || player?.photo_url
              ? <img src={player.photo_face_url || player.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:'.9rem' }}>👤</span>}
          </div>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{player?.name?.split(' ')[0]}</div>
            <div style={{ fontSize:'.65rem', color:'#7a9ab5' }}>
              {diasRestantes !== null && diasRestantes > 0 ? `Membresía activa · ${diasRestantes}d` : diasRestantes !== null && diasRestantes <= 0 ? 'Membresía vencida' : 'Portal jugador'}
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#7a9ab5', display:'flex', alignItems:'center', gap:'5px', fontSize:'.75rem' }}>
          <LogOut size={14}/> Salir
        </button>
      </div>

      <div style={{ maxWidth:'480px', margin:'0 auto', padding:'16px' }}>

        {/* Tarjeta */}
        <div style={{ background:'#07070e', borderRadius:'16px', padding:'20px', marginBottom:'16px', display:'flex', justifyContent:'center' }}>
          <PlayerCard
            playerName={player?.name?.toUpperCase().split(' ')[0] || 'JUGADOR'}
            stats={cardStats}
            cardType={player?.card_type || 'nivel1_verde'}
            esPortero={esPortero}
            photoUrlExterno={player?.photo_url || null}
            hideShields={true}
          />
        </div>

        {/* Stats rápidas — CLICKEABLES → historial */}
        <div onClick={() => navigate('/jugador/historial')}
          style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'14px', padding:'16px', marginBottom:'12px', cursor:'pointer', transition:'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background='#1a2234'}
          onMouseLeave={e => e.currentTarget.style.background='#111827'}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <History size={15} color="#00ddd0"/>
              <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#00ddd0' }}>Mi historial</span>
            </div>
            <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>Ver desglose →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'10px' }}>
            {[
              { label:'Partidos',  value:stats?.pj       ||0, color:'#00ddd0' },
              { label:'Victorias', value:stats?.pg       ||0, color:'#1e8e3e' },
              { label:'Empates',   value:stats?.pe       ||0, color:'#e8710a' },
              { label:'Derrotas',  value:stats?.pp       ||0, color:'#d93025' },
              { label:'MVPs',      value:mvpCount,            color:'#f9a825' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', background:'#0d1117', borderRadius:'8px', padding:'8px 4px' }}>
                <div style={{ fontSize:'1.3rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'.58rem', color:'#7a9ab5', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px' }}>
            {[
              { label:'Goles',     value:stats?.goles    ||0, icon:'⚽', color:'#00ddd0' },
              { label:'Amarillas', value:stats?.amarillas ||0, icon:'🟨', color:'#e8710a' },
              { label:'Azules',    value:stats?.azules   ||0, icon:'🟦', color:'#1a73e8' },
              { label:'Rojas',     value:stats?.rojas    ||0, icon:'🟥', color:'#d93025' },
              { label:'Eficacia',  value:`${stats?.eficacia||0}%`, icon:'📈', color:'#1e8e3e' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', background:'#0d1117', borderRadius:'8px', padding:'8px 4px' }}>
                <div style={{ fontSize:'.85rem', marginBottom:'1px' }}>{s.icon}</div>
                <div style={{ fontSize:'1rem', fontWeight:'900', color:s.value>0||String(s.value).includes('%')?s.color:'#2a3a4a', lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'.58rem', color:'#7a9ab5', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
          <button onClick={() => navigate('/jugador/apuestas')}
            style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'14px', padding:'16px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'8px', transition:'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background='#1a2234'}
            onMouseLeave={e => e.currentTarget.style.background='#111827'}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(0,221,208,.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Zap size={18} color="#00ddd0"/>
            </div>
            <div>
              <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd' }}>Predix</div>
              <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'1px' }}>Predice partidos</div>
            </div>
          </button>
          <button onClick={() => navigate('/jugador/historial')}
            style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'14px', padding:'16px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'8px', transition:'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background='#1a2234'}
            onMouseLeave={e => e.currentTarget.style.background='#111827'}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(249,168,37,.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <History size={18} color="#f9a825"/>
            </div>
            <div>
              <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd' }}>Historial</div>
              <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'1px' }}>Todos mis partidos</div>
            </div>
          </button>
        </div>

        {/* Torneos activos */}
        {torneos.length > 0 && (
          <div style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#7a9ab5', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'10px' }}>
              Mis torneos
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {torneos.map(t => (
                <button key={t.id} onClick={() => navigate(`/jugador/torneo/${t.tournament_id}`)}
                  style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'14px', padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px', transition:'background .15s', width:'100%', textAlign:'left' }}
                  onMouseEnter={e => e.currentTarget.style.background='#1a2234'}
                  onMouseLeave={e => e.currentTarget.style.background='#111827'}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'#1e2d3d', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {t.tournaments?.logo_url
                      ? <img src={t.tournaments.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'4px' }}/>
                      : <Trophy size={18} color="#00ddd0"/>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.tournaments?.name}</div>
                    <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'2px', display:'flex', gap:'6px' }}>
                      {t.tournaments?.modalidad && <span>{t.tournaments.modalidad}</span>}
                      {t.teams?.name && <span>· {t.teams.name}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:'.75rem', color:'#00ddd0', flexShrink:0 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Noticias */}
        <button onClick={() => navigate('/jugador/noticias')}
          style={{ width:'100%', background:'#111827', border:'1px solid #1e2d3d', borderRadius:'14px', padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px', transition:'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background='#1a2234'}
          onMouseLeave={e => e.currentTarget.style.background='#111827'}>
          <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(108,53,222,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Newspaper size={18} color="#6c35de"/>
          </div>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontWeight:'700', fontSize:'.88rem', color:'#e8f4fd' }}>Noticias</div>
            <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'1px' }}>Novedades del torneo</div>
          </div>
          <span style={{ marginLeft:'auto', fontSize:'.75rem', color:'#7a9ab5' }}>→</span>
        </button>

      </div>
    </div>
  )
}
