import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Shield, Trophy, Clock, CheckCircle, Calendar } from 'lucide-react'

export default function ArbitroHomePage() {
  const navigate  = useNavigate()
  const [arbitro,  setArbitro]  = useState(null)
  const [partidos, setPartidos] = useState([])
  const [stats,    setStats]    = useState({ total:0, jugados:0, torneos:0, pagos:0 })
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('proximos')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).or('rol.eq.arbitro,es_arbitro.eq.true').single()
    if (!p) { navigate('/jugador/login'); return }
    if (!p.es_arbitro && p.rol !== 'arbitro') { navigate('/jugador'); return }
    if (!p.activo_membresia) { navigate('/jugador/login'); return }
    setArbitro(p)

    // Traer partidos asignados a este árbitro
    const { data: pts } = await supabase
      .from('matches')
      .select('*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .or(`arbitro1.eq.${p.name},arbitro2.eq.${p.name}`)
      .order('played_at', { ascending: false })

    const lista = pts || []
    setPartidos(lista)
    setStats({
      total:   lista.length,
      jugados: lista.filter(m => m.status === 'finished').length,
      torneos: new Set(lista.map(m => m.tournament_id)).size,
    })
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

  const proximos = partidos.filter(p => p.status !== 'finished')
  const jugados  = partidos.filter(p => p.status === 'finished')
  const lista    = tab === 'proximos' ? proximos : jugados
  const diasRestantes = arbitro?.fecha_vencimiento
    ? Math.ceil((new Date(arbitro.fecha_vencimiento) - new Date()) / 86400000)
    : null

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#1e2d3d', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {arbitro?.photo_face_url || arbitro?.photo_url
              ? <img src={arbitro.photo_face_url||arbitro.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:'.9rem' }}>👤</span>}
          </div>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{arbitro?.name?.split(' ')[0]}</div>
            <div style={{ fontSize:'.65rem', color:'#7a9ab5' }}>
              🟡 Árbitro · {diasRestantes !== null && diasRestantes > 0 ? `${diasRestantes}d activo` : 'Acceso vencido'}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {arbitro?.rol !== 'arbitro' && (
            <button onClick={() => navigate('/jugador')}
              style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#00ddd0', fontSize:'.75rem' }}>
              👤 Mi perfil
            </button>
          )}
          <button onClick={handleLogout} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#7a9ab5', display:'flex', alignItems:'center', gap:'5px', fontSize:'.75rem' }}>
            <LogOut size={14}/> Salir
          </button>
        </div>
      </div>

      <div style={{ maxWidth:'500px', margin:'0 auto', padding:'16px' }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Partidos',  value:stats.total,   icon:'📋', color:'#00ddd0' },
            { label:'Arbitrados',value:stats.jugados,  icon:'✅', color:'#1e8e3e' },
            { label:'Torneos',   value:stats.torneos,  icon:'🏆', color:'#f9a825' },
          ].map(s => (
            <div key={s.label} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px', textAlign:'center' }}>
              <div style={{ fontSize:'1.1rem', marginBottom:'4px' }}>{s.icon}</div>
              <div style={{ fontSize:'1.5rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'.65rem', color:'#7a9ab5', marginTop:'3px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'16px', background:'#111827', borderRadius:'10px', padding:'4px' }}>
          {[{ id:'proximos', label:`Próximos (${proximos.length})` }, { id:'jugados', label:`Arbitrados (${jugados.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'700', background: tab===t.id?'#1a73e8':'transparent', color: tab===t.id?'#fff':'#7a9ab5' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista partidos */}
        {lista.length === 0 ? (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'48px', textAlign:'center', color:'#7a9ab5' }}>
            <div style={{ fontSize:'2rem', marginBottom:'8px' }}>{tab==='proximos'?'📅':'✅'}</div>
            <div style={{ fontSize:'.875rem' }}>{tab==='proximos'?'Sin partidos asignados':'Sin partidos arbitrados'}</div>
          </div>
        ) : lista.map((p, i) => {
          const esJugado = p.status === 'finished'
          return (
            <div key={p.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px' }}>
              {/* Torneo y fecha */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <span style={{ fontSize:'.7rem', color:'#00ddd0', background:'rgba(0,221,208,.1)', borderRadius:'6px', padding:'2px 8px' }}>{p.tournaments?.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  {p.matchday && <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>J{p.matchday}</span>}
                  {p.played_at && <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</span>}
                  <span style={{ fontSize:'.65rem', fontWeight:'700', color: esJugado?'#1e8e3e':'#e8710a', background: esJugado?'rgba(30,142,62,.1)':'rgba(232,113,10,.1)', borderRadius:'6px', padding:'1px 6px' }}>
                    {esJugado ? '✓ Arbitrado' : '⏳ Pendiente'}
                  </span>
                </div>
              </div>

              {/* Marcador */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                  <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd', textAlign:'right' }}>{p.home?.name}</span>
                  <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'#1e2d3d', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={12} color="#7a9ab5"/>}
                  </div>
                </div>
                <div style={{ fontWeight:'900', fontSize: esJugado?'1.1rem':'.85rem', color: esJugado?'#e8f4fd':'#7a9ab5', background:'#1e2d3d', padding:'5px 14px', borderRadius:'8px', flexShrink:0, minWidth:'56px', textAlign:'center' }}>
                  {esJugado ? `${p.home_score} - ${p.away_score}` : 'VS'}
                </div>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'#1e2d3d', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={12} color="#7a9ab5"/>}
                  </div>
                  <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{p.away?.name}</span>
                </div>
              </div>

              {/* Hora y cancha */}
              {(p.played_at || p.location) && (
                <div style={{ marginTop:'8px', display:'flex', gap:'12px', fontSize:'.7rem', color:'#7a9ab5' }}>
                  {p.played_at && <span>🕐 {new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</span>}
                  {p.location  && <span>📍 {p.location}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
