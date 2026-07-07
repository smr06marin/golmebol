import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Shield, Users, Calendar, Trophy, ChevronDown, ChevronUp, Plus, X, Upload } from 'lucide-react'

const inp = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#7a9ab5', display:'block', marginBottom:'4px' }

function ModalNuevoArbitro({ onClose, onCreado }) {
  const [form,    setForm]    = useState({ name:'', numero_cedula:'', telefono:'', city:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [fotoFile,setFotoFile] = useState(null)

  async function handleGuardar() {
    if (!form.name || !form.numero_cedula) return setError('Nombre y cédula son obligatorios')
    setLoading(true)
    const { data, error: err } = await supabase.from('players').insert({
      ...form, rol:'arbitro', es_arbitro:true, activo_membresia:false
    }).select().single()
    if (err) { setError('Error: ' + err.message); setLoading(false); return }
    // Subir foto si hay
    if (fotoFile && data?.id) {
      const path = `fotos/${data.id}.${fotoFile.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('players').upload(path, fotoFile, { upsert:true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
        await supabase.from('players').update({ photo_url: urlData.publicUrl }).eq('id', data.id)
      }
    }
    onCreado(data)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'28px', width:'420px', border:'1px solid #1e2d3d' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontWeight:'700', fontSize:'1rem', color:'#e8f4fd' }}>Nuevo árbitro</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
          {/* Foto */}
          <div style={{ textAlign:'center' }}>
            <label style={{ cursor:'pointer' }}>
              <input type="file" accept="image/*" onChange={e=>setFotoFile(e.target.files[0])} style={{ display:'none' }}/>
              <div style={{ width:'70px', height:'70px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:`2px dashed ${fotoFile?'#00ddd0':'#2a3a4a'}`, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                {fotoFile ? <img src={URL.createObjectURL(fotoFile)} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.5rem' }}>📷</span>}
              </div>
              <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'4px' }}>Toca para subir foto</div>
            </label>
          </div>
          <div><label style={lbl}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre completo"/></div>
          <div><label style={lbl}>Cédula *</label><input value={form.numero_cedula} onChange={e=>setForm(f=>({...f,numero_cedula:e.target.value}))} style={inp} placeholder="Número de cédula"/></div>
          <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Teléfono"/></div>
          <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
        </div>
        {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'10px' }}>{error}</div>}
        <div style={{ background:'rgba(0,221,208,.08)', border:'1px solid rgba(0,221,208,.2)', borderRadius:'8px', padding:'10px 12px', marginBottom:'14px', fontSize:'.78rem', color:'#7a9ab5' }}>
          📧 Email: <b style={{ color:'#00ddd0' }}>{form.numero_cedula||'cédula'}@golmebol.com</b><br/>
          🔑 Contraseña inicial: <b style={{ color:'#00ddd0' }}>{form.numero_cedula||'cédula'}</b>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading ? 'Creando...' : 'Crear árbitro'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 16px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function ArbitroLiderPage() {
  const navigate  = useNavigate()
  const [lider,      setLider]      = useState(null)
  const [torneos,    setTorneos]    = useState([])
  const [arbitros,   setArbitros]   = useState([])
  const [tab,        setTab]        = useState('torneos')
  const [loading,    setLoading]    = useState(true)
  const [abiertos,   setAbiertos]   = useState({})
  const [showNuevo,  setShowNuevo]  = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [uploading,  setUploading]  = useState(null)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_arbitro_lider) { navigate('/jugador/login'); return }
    setLider(p)
    await Promise.all([fetchTorneos(), fetchArbitros()])
    setLoading(false)
  }

  async function fetchTorneos() {
    const { data } = await supabase.from('tournaments').select(`
      *, matches(id, played_at, home_score, away_score, status, matchday, fase, arbitro1_id, arbitro2_id, arbitro3_id,
        home:home_team_id(name,logo_url), away:away_team_id(name,logo_url))
    `).order('created_at', { ascending: false })
    setTorneos(data || [])
  }

  async function fetchArbitros() {
    const { data: arbs } = await supabase.from('players').select('*').or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
    // Contar partidos por árbitro
    const { data: matches } = await supabase.from('matches').select('arbitro1_id, arbitro2_id, arbitro3_id, status')
    const countMap = {}
    ;(matches||[]).forEach(m => {
      [m.arbitro1_id, m.arbitro2_id, m.arbitro3_id].filter(Boolean).forEach(aid => {
        if (!countMap[aid]) countMap[aid] = { total:0, jugados:0 }
        countMap[aid].total++
        if (m.status === 'finished') countMap[aid].jugados++
      })
    })
    setArbitros((arbs||[]).map(a => ({ ...a, stats: countMap[a.id] || { total:0, jugados:0 } })))
  }

  async function handleActivar(arbitro) {
    setLoading(true)
    const fechaVenc = new Date(); fechaVenc.setMonth(fechaVenc.getMonth() + 3)
    const email = `${arbitro.numero_cedula}@golmebol.com`
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password: String(arbitro.numero_cedula),
        options: { data: { player_id: arbitro.id, rol: 'arbitro' } }
      })
      if (authError) throw authError
      await supabase.from('players').update({
        user_id: authData.user?.id, activo_membresia: true,
        fecha_vencimiento: fechaVenc.toISOString(), primer_ingreso: true
      }).eq('id', arbitro.id)
      showMsgFn('Acceso activado ✓')
      fetchArbitros()
    } catch(e) { showMsgFn('Error: ' + e.message, 'error') }
    setLoading(false)
  }

  async function handleFoto(arbitro, file) {
    if (!file) return
    setUploading(arbitro.id)
    const path = `fotos/${arbitro.id}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert:true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
      await supabase.from('players').update({ photo_url: urlData.publicUrl }).eq('id', arbitro.id)
      fetchArbitros()
    }
    setUploading(null)
  }

  async function handleAsignar(matchId, campo, arbitroId) {
    await supabase.from('matches').update({ [campo]: arbitroId || null }).eq('id', matchId)
    fetchTorneos()
  }

  function showMsgFn(text, type='ok') { setMsg({text,type}); setTimeout(()=>setMsg(null),3000) }
  function toggleTorneo(id) { setAbiertos(prev=>({...prev,[id]:!prev[id]})) }

  if (loading) return <div style={{ minHeight:'100vh', background:'#07070e', display:'flex', alignItems:'center', justifyContent:'center', color:'#00ddd0' }}>Cargando...</div>

  const arbitrosLista = arbitros.filter(a => a.rol === 'arbitro' || a.es_arbitro)
  const totalPartidos = torneos.reduce((s,t) => s+(t.matches?.length||0), 0)
  const sinArbitro    = torneos.reduce((s,t) => s+(t.matches||[]).filter(m=>!m.arbitro1_id&&m.status!=='finished').length, 0)

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      {msg && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background:msg.type==='ok'?'#e6f4ea':'#fce8e6', color:msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 12px rgba(0,0,0,.3)' }}>{msg.text}</div>}
      {showNuevo && <ModalNuevoArbitro onClose={()=>setShowNuevo(false)} onCreado={()=>{ showMsgFn('Árbitro creado ✓'); fetchArbitros() }}/>}

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(249,168,37,.2)', border:'2px solid #f9a825', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontSize:'.9rem' }}>👑</span>
          </div>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{lider?.name?.split(' ')[0]}</div>
            <div style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'600' }}>Árbitro Líder</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {lider?.rol !== 'arbitro' && (
            <button onClick={()=>navigate('/jugador')} style={{ background:'none', border:'1px solid rgba(0,221,208,.3)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#00ddd0', fontSize:'.72rem' }}>👤 Mi perfil jugador</button>
          )}
          {(lider?.es_arbitro||lider?.rol==='arbitro') && (
            <button onClick={()=>navigate('/arbitro')} style={{ background:'none', border:'1px solid rgba(249,168,37,.3)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#f9a825', fontSize:'.72rem' }}>🟡 Mi portal árbitro</button>
          )}
          <button onClick={async()=>{ await supabase.auth.signOut(); navigate('/jugador/login') }}
            style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex', alignItems:'center' }}>
            <LogOut size={14}/>
          </button>
        </div>
      </div>

      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'16px' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Torneos',    value:torneos.length,    icon:'🏆', color:'#00ddd0' },
            { label:'Partidos',   value:totalPartidos,     icon:'📋', color:'#1a73e8' },
            { label:'Sin árbitro',value:sinArbitro,        icon:'⚠️', color: sinArbitro>0?'#e8710a':'#1e8e3e' },
          ].map(s=>(
            <div key={s.label} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px', textAlign:'center' }}>
              <div style={{ fontSize:'1.1rem', marginBottom:'4px' }}>{s.icon}</div>
              <div style={{ fontSize:'1.5rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'.65rem', color:'#7a9ab5', marginTop:'3px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', background:'#111827', borderRadius:'10px', padding:'4px' }}>
          {[{id:'torneos',label:'Torneos'},{id:'arbitros',label:'Árbitros'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'.82rem', fontWeight:'700', background:tab===t.id?'#1a73e8':'transparent', color:tab===t.id?'#fff':'#7a9ab5' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB TORNEOS */}
        {tab==='torneos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {torneos.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px', color:'#7a9ab5' }}>Sin torneos</div>
            ) : torneos.map(torneo => {
              const isOpen = !!abiertos[torneo.id]
              const matchesPendientes = (torneo.matches||[]).filter(m=>m.status!=='finished')
              const matchesJugados    = (torneo.matches||[]).filter(m=>m.status==='finished')
              return (
                <div key={torneo.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', overflow:'hidden' }}>
                  {/* Header torneo */}
                  <div onClick={()=>toggleTorneo(torneo.id)} style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'8px', background:'#1e2d3d', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {torneo.logo_url ? <img src={torneo.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'3px' }}/> : <Trophy size={16} color="#00ddd0"/>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{torneo.name}</div>
                      <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'2px', display:'flex', gap:'8px' }}>
                        <span>{torneo.modalidad}</span>
                        <span>{(torneo.matches||[]).length} partidos</span>
                        {matchesPendientes.filter(m=>!m.arbitro1_id).length > 0 && (
                          <span style={{ color:'#e8710a' }}>⚠️ {matchesPendientes.filter(m=>!m.arbitro1_id).length} sin árbitro</span>
                        )}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={16} color="#7a9ab5"/> : <ChevronDown size={16} color="#7a9ab5"/>}
                  </div>

                  {/* Partidos */}
                  {isOpen && (
                    <div>
                      {(torneo.matches||[]).length === 0 ? (
                        <div style={{ padding:'16px 20px', color:'#7a9ab5', fontSize:'.8rem' }}>Sin partidos programados</div>
                      ) : [...(torneo.matches||[])].sort((a,b)=>new Date(a.played_at)-new Date(b.played_at)).map((m,i) => {
                        const esJugado = m.status === 'finished'
                        const arb1 = arbitrosLista.find(a=>a.id===m.arbitro1_id)
                        const arb2 = arbitrosLista.find(a=>a.id===m.arbitro2_id)
                        const arb3 = arbitrosLista.find(a=>a.id===m.arbitro3_id)
                        return (
                          <div key={m.id} style={{ padding:'12px 16px', borderTop:'0.5px solid #1e2d3d', background: !m.arbitro1_id&&!esJugado?'rgba(232,113,10,.04)':'transparent' }}>
                            {/* Info partido */}
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                              <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                                <span style={{ fontSize:'.82rem', fontWeight:'600', color:'#e8f4fd' }}>{m.home?.name}</span>
                                <div style={{ width:'22px', height:'22px', borderRadius:'5px', background:'#1e2d3d', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  {m.home?.logo_url ? <img src={m.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={10} color="#7a9ab5"/>}
                                </div>
                              </div>
                              <div style={{ fontWeight:'800', fontSize:'.9rem', color:'#e8f4fd', background:'#1e2d3d', padding:'3px 10px', borderRadius:'6px', flexShrink:0 }}>
                                {esJugado ? `${m.home_score}-${m.away_score}` : 'VS'}
                              </div>
                              <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
                                <div style={{ width:'22px', height:'22px', borderRadius:'5px', background:'#1e2d3d', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  {m.away?.logo_url ? <img src={m.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={10} color="#7a9ab5"/>}
                                </div>
                                <span style={{ fontSize:'.82rem', fontWeight:'600', color:'#e8f4fd' }}>{m.away?.name}</span>
                              </div>
                              <div style={{ fontSize:'.65rem', color:'#7a9ab5', textAlign:'right', flexShrink:0 }}>
                                {m.played_at && new Date(m.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}
                                {m.matchday && ` · J${m.matchday}`}
                              </div>
                            </div>

                            {/* Asignación árbitros */}
                            {!esJugado && (
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px' }}>
                                {[
                                  { campo:'arbitro1_id', label:'Principal', val:m.arbitro1_id },
                                  { campo:'arbitro2_id', label:'Asistente 1', val:m.arbitro2_id },
                                  { campo:'arbitro3_id', label:'Asistente 2', val:m.arbitro3_id },
                                ].map(({ campo, label, val }) => (
                                  <div key={campo}>
                                    <div style={{ fontSize:'.6rem', color:'#7a9ab5', marginBottom:'2px' }}>🟡 {label}</div>
                                    <select value={val||''} onChange={e=>handleAsignar(m.id, campo, e.target.value||null)}
                                      style={{ width:'100%', background:'#1e2d3d', border:`1px solid ${val?'rgba(0,221,208,.3)':'#2a3a4a'}`, borderRadius:'6px', padding:'4px 6px', color: val?'#00ddd0':'#7a9ab5', fontSize:'.68rem', outline:'none' }}>
                                      <option value="">Sin asignar</option>
                                      {arbitrosLista.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            )}
                            {esJugado && (arb1||arb2||arb3) && (
                              <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'4px' }}>
                                🟡 {[arb1?.name,arb2?.name,arb3?.name].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* TAB ÁRBITROS */}
        {tab==='arbitros' && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'14px' }}>
              <button onClick={()=>setShowNuevo(true)}
                style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1a73e8', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600' }}>
                <Plus size={15}/> Nuevo árbitro
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {arbitrosLista.length===0 ? (
                <div style={{ textAlign:'center', padding:'48px', color:'#7a9ab5' }}>Sin árbitros registrados</div>
              ) : arbitrosLista.map(a => {
                const diasRestantes = a.fecha_vencimiento ? Math.ceil((new Date(a.fecha_vencimiento)-new Date())/86400000) : null
                const activo = a.activo_membresia && diasRestantes>0
                return (
                  <div key={a.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
                    {/* Foto */}
                    <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
                      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleFoto(a,e.target.files[0])}/>
                      <div style={{ width:'44px', height:'44px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:`2px solid ${activo?'#00ddd0':'#2a3a4a'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {uploading===a.id ? <span style={{ fontSize:'.6rem', color:'#7a9ab5' }}>...</span>
                          : a.photo_face_url||a.photo_url ? <img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          : <span style={{ fontSize:'.9rem' }}>👤</span>}
                      </div>
                      <div style={{ position:'absolute', bottom:0, right:0, width:'16px', height:'16px', background:'#1a73e8', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Upload size={8} color="#fff"/>
                      </div>
                    </label>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div onClick={()=>navigate(`/arbitro/perfil/${a.id}`)} style={{ fontWeight:'700', fontSize:'.9rem', color:'#00ddd0', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(0,221,208,.3)', textUnderlineOffset:'3px' }}>{a.name}</div>
                      <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        {a.numero_cedula && <span>🪪 {a.numero_cedula}</span>}
                        {a.telefono      && <span>📞 {a.telefono}</span>}
                      </div>
                      <div style={{ fontSize:'.7rem', marginTop:'4px', display:'flex', gap:'10px' }}>
                        <span style={{ color:'#00ddd0' }}>📋 {a.stats.total} asignados</span>
                        <span style={{ color:'#1e8e3e' }}>✅ {a.stats.jugados} pitados</span>
                      </div>
                    </div>
                    {/* Estado */}
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      {!a.user_id ? (
                        <button onClick={()=>handleActivar(a)}
                          style={{ padding:'6px 12px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.78rem', fontWeight:'600' }}>
                          Activar acceso
                        </button>
                      ) : activo ? (
                        <div>
                          <div style={{ fontSize:'.72rem', color:'#1e8e3e', fontWeight:'700' }}>✅ Activo</div>
                          <div style={{ fontSize:'.65rem', color:'#7a9ab5' }}>{diasRestantes}d</div>
                        </div>
                      ) : (
                        <button onClick={()=>handleActivar(a)}
                          style={{ padding:'5px 10px', background:'none', border:'1px solid #e8710a', borderRadius:'8px', cursor:'pointer', color:'#e8710a', fontSize:'.75rem' }}>
                          Renovar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
