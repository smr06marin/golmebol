import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Shield, Download } from 'lucide-react'

function ModalCambiarContrasena({ onClose }) {
  const [actual,  setActual]  = useState('')
  const [nueva,   setNueva]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  async function handleCambiar() {
    if (nueva !== confirm) return setMsg('Las contraseñas no coinciden')
    if (nueva.length < 6)  return setMsg('Mínimo 6 caracteres')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('✅ Contraseña cambiada'); setTimeout(onClose, 1500) }
    setLoading(false)
  }

  const inp = { width:'100%', background:'#1e2d3d', border:'1px solid #2a3a4a', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'28px', width:'360px', border:'1px solid #1e2d3d' }}>
        <div style={{ fontWeight:'700', color:'#e8f4fd', marginBottom:'20px' }}>Cambiar contraseña</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
          <input type="password" value={nueva}   onChange={e=>setNueva(e.target.value)}   style={inp} placeholder="Nueva contraseña"/>
          <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={inp} placeholder="Confirmar contraseña"/>
        </div>
        {msg && <div style={{ fontSize:'.8rem', color: msg.includes('✅')?'#1e8e3e':'#d93025', marginBottom:'10px' }}>{msg}</div>}
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleCambiar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading?'Guardando...':'Cambiar'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function FlyerPartidos({ arbitro, partidos, onClose }) {
  const ref = useRef()

  const pendientes = partidos.filter(p => p.status !== 'finished')
    .sort((a,b) => new Date(a.played_at) - new Date(b.played_at))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflow:'auto' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:'700', color:'#202124' }}>Mis partidos asignados</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => window.print()} style={{ padding:'5px 12px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.78rem' }}>🖨️ Imprimir</button>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6', fontSize:'1.2rem' }}>✕</button>
          </div>
        </div>

        {/* Poster imprimible */}
        <div ref={ref} style={{ padding:'24px', background:'#07070e', minHeight:'400px' }}>
          <div style={{ textAlign:'center', marginBottom:'20px' }}>
            <div style={{ fontSize:'.65rem', letterSpacing:'.3em', color:'#7a9ab5', textTransform:'uppercase', marginBottom:'8px' }}>GOLMEBOL · ARMENIA</div>
            {arbitro?.photo_face_url || arbitro?.photo_url ? (
              <div style={{ width:'60px', height:'60px', borderRadius:'50%', overflow:'hidden', margin:'0 auto 10px', border:'2px solid #f9a825' }}>
                <img src={arbitro.photo_face_url||arbitro.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              </div>
            ) : <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🟡</div>}
            <div style={{ fontSize:'1.1rem', fontWeight:'900', color:'#fff', textTransform:'uppercase' }}>{arbitro?.name}</div>
            <div style={{ fontSize:'.7rem', color:'#f9a825', fontWeight:'700', marginTop:'2px' }}>ÁRBITRO</div>
          </div>

          <div style={{ width:'100%', height:'1px', background:'linear-gradient(90deg,transparent,#f9a825,transparent)', marginBottom:'16px' }}/>

          {pendientes.length === 0 ? (
            <div style={{ textAlign:'center', color:'#7a9ab5', padding:'24px', fontSize:'.85rem' }}>Sin partidos pendientes asignados</div>
          ) : pendientes.map((p, i) => (
            <div key={p.id} style={{ padding:'10px 12px', marginBottom:'6px', background:'rgba(255,255,255,.04)', borderRadius:'10px', border:'0.5px solid rgba(255,255,255,.08)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                <span style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'700' }}>{p.tournaments?.name}</span>
                <span style={{ fontSize:'.65rem', color:'#7a9ab5' }}>
                  {p.played_at && new Date(p.played_at).toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short'})}
                  {p.played_at && ` ${new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}`}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                  {p.home?.logo_url && <img src={p.home.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain' }}/>}
                  <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#e8f4fd' }}>{p.home?.name}</span>
                </div>
                <span style={{ fontSize:'.72rem', fontWeight:'800', color:'#7a9ab5', background:'#1e2d3d', padding:'2px 8px', borderRadius:'5px' }}>VS</span>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#e8f4fd' }}>{p.away?.name}</span>
                  {p.away?.logo_url && <img src={p.away.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain' }}/>}
                </div>
              </div>
              {p.location && <div style={{ fontSize:'.62rem', color:'#7a9ab5', marginTop:'4px', textAlign:'center' }}>📍 {p.location}</div>}
            </div>
          ))}

          <div style={{ textAlign:'center', marginTop:'16px', fontSize:'.6rem', color:'#3a4a5a', letterSpacing:'.1em' }}>
            GOLMEBOL.COM · ARMENIA, QUINDÍO
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ArbitroHomePage() {
  const navigate = useNavigate()
  const [arbitro,   setArbitro]   = useState(null)
  const [partidos,  setPartidos]  = useState([])
  const [stats,     setStats]     = useState({ total:0, jugados:0, torneos:0 })
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('proximos')
  const [showPass,  setShowPass]  = useState(false)
  const [showFlyer, setShowFlyer] = useState(false)
  const [notifs,    setNotifs]    = useState([])

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).or('rol.eq.arbitro,es_arbitro.eq.true').single()
    if (!p) { navigate('/jugador/login'); return }
    if (!p.activo_membresia) { navigate('/jugador/login'); return }
    setArbitro(p)

    const { data: pts } = await supabase
      .from('matches')
      .select('*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .or(`arbitro1_id.eq.${p.id},arbitro2_id.eq.${p.id},arbitro3_id.eq.${p.id},arbitro1.eq.${p.name},arbitro2.eq.${p.name}`)
      .order('played_at', { ascending: false })

    const lista = pts || []
    setPartidos(lista)
    setStats({ total:lista.length, jugados:lista.filter(m=>m.status==='finished').length, torneos:new Set(lista.map(m=>m.tournament_id)).size })
    // Notificaciones no leídas
    const { data: nots } = await supabase.from('notificaciones').select('*').eq('player_id', p.id).eq('leida', false).order('created_at',{ascending:false})
    setNotifs(nots||[])
    setLoading(false)
  }

  if (loading) return <div style={{ minHeight:'100vh', background:'#07070e', display:'flex', alignItems:'center', justifyContent:'center', color:'#00ddd0', fontSize:'.9rem' }}>Cargando...</div>

  const proximos = partidos.filter(p => p.status !== 'finished')
  const jugados  = partidos.filter(p => p.status === 'finished')
  const lista    = tab === 'proximos' ? proximos : jugados
  const dias     = arbitro?.fecha_vencimiento ? Math.ceil((new Date(arbitro.fecha_vencimiento)-new Date())/86400000) : null

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      {/* Panel notificaciones reclamos */}
      {notifs.length>0 && (
        <div style={{ background:'rgba(217,48,37,.08)', borderBottom:'1px solid rgba(217,48,37,.2)', padding:'10px 16px' }}>
          {notifs.map(n=>(
            <div key={n.id} style={{ fontSize:'.78rem', color:'#e8f4fd', marginBottom:'4px' }}>
              <span style={{ color:'#d93025', fontWeight:'700' }}>⚠️ {n.titulo}</span> — {n.mensaje}
            </div>
          ))}
        </div>
      )}

      {showPass  && <ModalCambiarContrasena onClose={()=>setShowPass(false)}/>}
      {showFlyer && <FlyerPartidos arbitro={arbitro} partidos={partidos} onClose={()=>setShowFlyer(false)}/>}

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#1e2d3d', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {arbitro?.photo_face_url||arbitro?.photo_url ? <img src={arbitro.photo_face_url||arbitro.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.9rem' }}>👤</span>}
          </div>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{arbitro?.name?.split(' ')[0]}</div>
            <div style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'600' }}>🟡 Árbitro · {dias>0?`${dias}d activo`:'Vencido'}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {notifs.length>0 && (
            <button onClick={async()=>{
              await supabase.from('notificaciones').update({leida:true}).eq('player_id',arbitro.id).eq('leida',false)
              setNotifs([])
            }} style={{ position:'relative', background:'rgba(217,48,37,.15)', border:'1px solid rgba(217,48,37,.4)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#d93025', fontSize:'.72rem', fontWeight:'700' }}>
              ⚠️ {notifs.length} reclamo{notifs.length>1?'s':''}
            </button>
          )}
          {arbitro?.rol !== 'arbitro' && (
            <button onClick={()=>navigate('/jugador')} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#00ddd0', fontSize:'.72rem' }}>👤 Mi perfil</button>
          )}
          <button onClick={()=>setShowFlyer(true)} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#f9a825', fontSize:'.72rem' }}>📋 Mis partidos</button>
          <button onClick={()=>navigate('/arbitro/encuestas')} style={{ background:'none', border:'1px solid rgba(26,115,232,.3)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#1a73e8', fontSize:'.72rem', fontWeight:'700' }}>📝</button>
          <button onClick={()=>setShowPass(true)}  style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#7a9ab5', fontSize:'.72rem' }}>🔑</button>
          <button onClick={async()=>{ await supabase.auth.signOut(); navigate('/jugador/login') }}
            style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex', alignItems:'center' }}>
            <LogOut size={14}/>
          </button>
        </div>
      </div>

      <div style={{ maxWidth:'500px', margin:'0 auto', padding:'16px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Asignados', value:stats.total,   icon:'📋', color:'#00ddd0' },
            { label:'Pitados',   value:stats.jugados,  icon:'✅', color:'#1e8e3e' },
            { label:'Torneos',   value:stats.torneos,  icon:'🏆', color:'#f9a825' },
          ].map(s=>(
            <div key={s.label} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px', textAlign:'center' }}>
              <div style={{ fontSize:'1.1rem', marginBottom:'4px' }}>{s.icon}</div>
              <div style={{ fontSize:'1.5rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'.65rem', color:'#7a9ab5', marginTop:'3px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'16px', background:'#111827', borderRadius:'10px', padding:'4px' }}>
          {[{id:'proximos',label:`Próximos (${proximos.length})`},{id:'jugados',label:`Pitados (${jugados.length})`}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'700', background:tab===t.id?'#1a73e8':'transparent', color:tab===t.id?'#fff':'#7a9ab5' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {lista.length===0 ? (
          <div style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'48px', textAlign:'center', color:'#7a9ab5' }}>
            <div style={{ fontSize:'2rem', marginBottom:'8px' }}>{tab==='proximos'?'📅':'✅'}</div>
            <div style={{ fontSize:'.875rem' }}>{tab==='proximos'?'Sin partidos asignados':'Sin partidos pitados'}</div>
          </div>
        ) : lista.map(p=>{
          const esJugado = p.status==='finished'
          return (
            <div key={p.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'.7rem', color:'#00ddd0', background:'rgba(0,221,208,.1)', borderRadius:'6px', padding:'2px 8px' }}>{p.tournaments?.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  {p.matchday && <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>J{p.matchday}</span>}
                  {p.played_at && <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</span>}
                  <span style={{ fontSize:'.65rem', fontWeight:'700', color:esJugado?'#1e8e3e':'#e8710a', background:esJugado?'rgba(30,142,62,.1)':'rgba(232,113,10,.1)', borderRadius:'6px', padding:'1px 6px' }}>
                    {esJugado?'✓ Pitado':'⏳ Pendiente'}
                  </span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                  <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd', textAlign:'right' }}>{p.home?.name}</span>
                  <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:'#1e2d3d', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.home?.logo_url?<img src={p.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>:<Shield size={11} color="#7a9ab5"/>}
                  </div>
                </div>
                <div style={{ fontWeight:'900', fontSize:esJugado?'1rem':'.85rem', color:esJugado?'#e8f4fd':'#7a9ab5', background:'#1e2d3d', padding:'4px 12px', borderRadius:'7px', flexShrink:0, minWidth:'52px', textAlign:'center' }}>
                  {esJugado?`${p.home_score}-${p.away_score}`:'VS'}
                </div>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:'#1e2d3d', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.away?.logo_url?<img src={p.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>:<Shield size={11} color="#7a9ab5"/>}
                  </div>
                  <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{p.away?.name}</span>
                </div>
              </div>
              {(p.played_at||p.location) && (
                <div style={{ marginTop:'6px', display:'flex', gap:'12px', fontSize:'.68rem', color:'#7a9ab5' }}>
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
