import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, ChevronDown, ChevronUp, Shield, Plus, X, Upload, Check } from 'lucide-react'

const inp = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#7a9ab5', display:'block', marginBottom:'4px' }

const TABS = [
  { id:'sin_asignar', label:'Sin árbitro',   icon:'⚠️' },
  { id:'asignados',   label:'Asignados',      icon:'✅' },
  { id:'jugados',     label:'Jugados',        icon:'📋' },
  { id:'arbitros',    label:'Árbitros',       icon:'🟡' },
]

function ModalNuevoArbitro({ onClose, onCreado }) {
  const [form,     setForm]     = useState({ name:'', numero_cedula:'', telefono:'', city:'' })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [fotoFile, setFotoFile] = useState(null)

  async function handleGuardar() {
    if (!form.name || !form.numero_cedula) return setError('Nombre y cédula son obligatorios')
    setLoading(true)
    // Gratis: queda activo de inmediato, sin membresía ni vencimiento. Solo le
    // falta entrar con su cédula en /jugador/login y crear su contraseña.
    const { data, error: err } = await supabase.from('players').insert({
      ...form, rol:'arbitro', es_arbitro:true,
      activo_membresia:true, fecha_vencimiento:null, primer_ingreso:false,
    }).select().single()
    if (err) { setError('Error: ' + err.message); setLoading(false); return }
    if (fotoFile && data?.id) {
      const path = `fotos/${data.id}.${fotoFile.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('players').upload(path, fotoFile, { upsert:true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
        await supabase.from('players').update({ photo_url: urlData.publicUrl }).eq('id', data.id)
      }
    }
    onCreado(data); onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'28px', width:'420px', border:'1px solid #1e2d3d', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontWeight:'700', fontSize:'1rem', color:'#e8f4fd' }}>Nuevo árbitro</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        <div style={{ textAlign:'center', marginBottom:'16px' }}>
          <label style={{ cursor:'pointer' }}>
            <input type="file" accept="image/*" onChange={e=>setFotoFile(e.target.files[0])} style={{ display:'none' }}/>
            <div style={{ width:'70px', height:'70px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:`2px dashed ${fotoFile?'#00ddd0':'#2a3a4a'}`, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {fotoFile ? <img src={URL.createObjectURL(fotoFile)} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.5rem' }}>📷</span>}
            </div>
            <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'4px' }}>Foto del árbitro</div>
          </label>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
          <div><label style={lbl}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre completo"/></div>
          <div><label style={lbl}>Cédula *</label><input value={form.numero_cedula} onChange={e=>setForm(f=>({...f,numero_cedula:e.target.value}))} style={inp} placeholder="Número de cédula"/></div>
          <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Teléfono"/></div>
          <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
        </div>
        <div style={{ background:'rgba(0,221,208,.06)', border:'1px solid rgba(0,221,208,.15)', borderRadius:'8px', padding:'10px 12px', marginBottom:'14px', fontSize:'.75rem', color:'#7a9ab5' }}>
          📧 <b style={{ color:'#00ddd0' }}>{form.numero_cedula||'cédula'}@golmebol.com</b> · 🔑 <b style={{ color:'#00ddd0' }}>{form.numero_cedula||'cédula'}</b>
        </div>
        {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'10px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading?'Creando...':'Crear árbitro'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 16px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function CardPartido({ partido, arbitros, onAsignar, modoVer }) {
  const [abierto, setAbierto] = useState(false)
  const p = partido
  const esJugado = p.status === 'finished'
  const arb1 = arbitros.find(a=>a.id===p.arbitro1_id)
  const arb2 = arbitros.find(a=>a.id===p.arbitro2_id)
  const arb3 = arbitros.find(a=>a.id===p.arbitro3_id)
  const tieneArbitro = !!(p.arbitro1_id || p.arbitro2_id || p.arbitro3_id)

  return (
    <div style={{ background:'#111827', border:`1px solid ${!tieneArbitro&&!esJugado?'rgba(232,113,10,.3)':'#1e2d3d'}`, borderRadius:'12px', marginBottom:'8px', overflow:'hidden' }}>
      {/* Fila principal */}
      <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
        {/* Fecha */}
        <div style={{ minWidth:'52px', flexShrink:0, textAlign:'center' }}>
          {p.played_at ? (
            <>
              <div style={{ fontSize:'.7rem', fontWeight:'700', color:'#e8f4fd' }}>{new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</div>
              <div style={{ fontSize:'.62rem', color:'#7a9ab5' }}>{new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</div>
            </>
          ) : <div style={{ fontSize:'.65rem', color:'#7a9ab5' }}>Sin fecha</div>}
        </div>

        {/* Partido */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:'5px', justifyContent:'flex-end' }}>
              {p.home?.logo_url && <img src={p.home.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain', flexShrink:0 }}/>}
              <span style={{ fontSize:'.8rem', fontWeight:'700', color:'#e8f4fd', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.home?.name}</span>
            </div>
            <div style={{ fontWeight:'900', fontSize: esJugado?'.9rem':'.75rem', color: esJugado?'#e8f4fd':'#7a9ab5', background:'#1e2d3d', padding:'3px 8px', borderRadius:'6px', flexShrink:0 }}>
              {esJugado ? `${p.home_score}-${p.away_score}` : 'VS'}
            </div>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:'5px' }}>
              <span style={{ fontSize:'.8rem', fontWeight:'700', color:'#e8f4fd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.away?.name}</span>
              {p.away?.logo_url && <img src={p.away.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain', flexShrink:0 }}/>}
            </div>
          </div>
          {/* Info secundaria */}
          <div style={{ display:'flex', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'.6rem', color:'#00ddd0', background:'rgba(0,221,208,.08)', borderRadius:'4px', padding:'1px 6px' }}>{p.tournaments?.name}</span>
            {p.matchday && <span style={{ fontSize:'.6rem', color:'#7a9ab5' }}>J{p.matchday}</span>}
            {p.fase && p.fase!=='grupo' && <span style={{ fontSize:'.6rem', color:'#f9a825', fontWeight:'700' }}>{p.fase.toUpperCase()}</span>}
            {p.location && <span style={{ fontSize:'.6rem', color:'#7a9ab5' }}>📍 {p.location}</span>}
            {tieneArbitro && !esJugado && (
              <span style={{ fontSize:'.6rem', color:'#1e8e3e' }}>✅ {[arb1?.name,arb2?.name,arb3?.name].filter(Boolean).join(' · ')}</span>
            )}
          </div>
        </div>

        {/* Botón asignar / expandir */}
        {!esJugado && (
          <button onClick={()=>setAbierto(!abierto)}
            style={{ background: abierto?'#1a73e8':(!tieneArbitro?'rgba(232,113,10,.15)':'rgba(30,142,62,.1)'), border:`1px solid ${abierto?'#1a73e8':(!tieneArbitro?'#e8710a':'#1e8e3e')}`, borderRadius:'8px', padding:'5px 10px', cursor:'pointer', color: abierto?'#fff':(!tieneArbitro?'#e8710a':'#1e8e3e'), fontSize:'.72rem', fontWeight:'700', flexShrink:0, display:'flex', alignItems:'center', gap:'4px' }}>
            {abierto ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            {!tieneArbitro ? 'Asignar' : 'Cambiar'}
          </button>
        )}
      </div>

      {/* Panel asignación */}
      {abierto && !esJugado && (
        <div style={{ borderTop:'0.5px solid #1e2d3d', padding:'10px 14px', background:'#0d1117' }}>
          <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.08em' }}>🟡 Asignar árbitros</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
            {[
              { campo:'arbitro1_id', label:'Principal', val:p.arbitro1_id },
              { campo:'arbitro2_id', label:'Asistente 1', val:p.arbitro2_id },
              { campo:'arbitro3_id', label:'Asistente 2', val:p.arbitro3_id },
            ].map(({campo,label,val})=>(
              <div key={campo}>
                <div style={{ fontSize:'.6rem', color:'#7a9ab5', marginBottom:'3px' }}>{label}</div>
                <select value={val||''} onChange={e=>onAsignar(p.id,campo,e.target.value||null)}
                  style={{ width:'100%', background:'#1e2d3d', border:`1px solid ${val?'#00ddd0':'#2a3a4a'}`, borderRadius:'6px', padding:'5px 6px', color:val?'#00ddd0':'#7a9ab5', fontSize:'.72rem', outline:'none' }}>
                  <option value="">Sin asignar</option>
                  {arbitros.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={()=>setAbierto(false)} style={{ marginTop:'8px', padding:'4px 12px', background:'#1a73e8', border:'none', borderRadius:'6px', cursor:'pointer', color:'#fff', fontSize:'.72rem', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>
            <Check size={12}/> Listo
          </button>
        </div>
      )}
    </div>
  )
}

function ModalReclamoLider({ partido, arbitros, onClose, onGuardar }) {
  const [arbitroId, setArbitroId] = useState('')
  const [tipo,      setTipo]      = useState('tecnico')
  const [desc,      setDesc]      = useState('')
  const [loading,   setLoading]   = useState(false)

  const arbsPartido = [partido.arbitro1_id, partido.arbitro2_id, partido.arbitro3_id]
    .filter(Boolean).map(aid => arbitros.find(a=>a.id===aid)).filter(Boolean)

  async function handleGuardar() {
    if (!arbitroId || !desc.trim()) return
    setLoading(true)
    await onGuardar(partido, arbitroId, tipo, desc)
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'440px', border:'1px solid rgba(217,48,37,.4)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>⚠️ Registrar reclamo</div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginTop:'2px' }}>
              {partido.home?.name} vs {partido.away?.name}
              {partido.played_at && ` · ${new Date(partido.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>

        {/* Árbitros del partido */}
        <div style={{ marginBottom:'12px' }}>
          <label style={{ fontSize:'.75rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'6px' }}>Árbitro reclamado *</label>
          {arbsPartido.length > 0 ? (
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {arbsPartido.map(a=>(
                <button key={a.id} onClick={()=>setArbitroId(a.id)}
                  style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${arbitroId===a.id?'#d93025':'#1e2d3d'}`, background:arbitroId===a.id?'rgba(217,48,37,.15)':'transparent', color:arbitroId===a.id?'#d93025':'#7a9ab5', cursor:'pointer', fontSize:'.82rem', fontWeight:'600' }}>
                  {a.name}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:'.75rem', color:'#e8710a', marginBottom:'8px' }}>⚠️ Este partido no tiene árbitros asignados — selecciona de la lista:</div>
              <select value={arbitroId} onChange={e=>setArbitroId(e.target.value)}
                style={{ width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none' }}>
                <option value="">Seleccionar árbitro...</option>
                {arbitros.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Tipo */}
        <div style={{ marginBottom:'12px' }}>
          <label style={{ fontSize:'.75rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'6px' }}>Tipo de reclamo</label>
          <div style={{ display:'flex', gap:'6px' }}>
            {[{id:'tecnico',label:'Técnico'},{id:'disciplinario',label:'Disciplinario'},{id:'comportamiento',label:'Comportamiento'}].map(t=>(
              <button key={t.id} onClick={()=>setTipo(t.id)}
                style={{ flex:1, padding:'6px', borderRadius:'7px', border:`1px solid ${tipo===t.id?'#e8710a':'#1e2d3d'}`, background:tipo===t.id?'rgba(232,113,10,.15)':'transparent', color:tipo===t.id?'#e8710a':'#7a9ab5', cursor:'pointer', fontSize:'.68rem', fontWeight:'600' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción */}
        <div style={{ marginBottom:'16px' }}>
          <label style={{ fontSize:'.75rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'4px' }}>Descripción *</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
            style={{ width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', resize:'vertical', boxSizing:'border-box' }}
            placeholder="Describe el reclamo en detalle..."/>
        </div>

        <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginBottom:'12px', background:'rgba(232,113,10,.06)', border:'1px solid rgba(232,113,10,.15)', borderRadius:'7px', padding:'8px 10px' }}>
          📱 El árbitro recibirá una notificación de este reclamo
        </div>

        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading||!arbitroId||!desc.trim()}
            style={{ flex:1, padding:'10px', background:'#d93025', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading||!arbitroId||!desc.trim()?.5:1 }}>
            {loading?'Registrando...':'Registrar reclamo'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function ArbitroLiderPage() {
  const navigate   = useNavigate()
  const [lider,    setLider]    = useState(null)
  const [partidos, setPartidos] = useState([])
  const [arbitros, setArbitros] = useState([])
  const [tab,      setTab]      = useState('sin_asignar')
  const [loading,  setLoading]  = useState(true)
  const [showNuevo,setShowNuevo]= useState(false)
  const [msg,      setMsg]      = useState(null)
  const [uploading,setUploading]= useState(null)
  const [busqArb,      setBusqArb]      = useState('')
  const [torneoFiltro, setTorneoFiltro] = useState('')
  const [modalRec,     setModalRec]     = useState(null)
  const [reclamosMap,  setReclamosMap]  = useState({})

  useEffect(()=>{ fetchTodo() },[])

  async function fetchTodo() {
    setLoading(true)
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data:p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p||!p.es_arbitro_lider) { navigate('/jugador/login'); return }
    setLider(p)
    await Promise.all([fetchPartidos(), fetchArbitros()])
    setLoading(false)
  }

  async function fetchPartidos() {
    const { data } = await supabase.from('matches')
      .select('*, tournaments(id,name,modalidad), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
      .order('played_at', { ascending: true })
    setPartidos(data||[])
    // Cargar reclamos por partido
    const { data: recs } = await supabase.from('arbitro_reclamos').select('match_id, estado, arbitro_id')
    const rm = {}
    ;(recs||[]).forEach(r => { if (!rm[r.match_id]) rm[r.match_id] = []; rm[r.match_id].push(r) })
    setReclamosMap(rm)
  }

  async function fetchArbitros() {
    const { data } = await supabase.from('players').select('id,name,photo_url,photo_face_url,activo_membresia,fecha_vencimiento,numero_cedula,telefono')
      .or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
    // Contar partidos por árbitro
    const { data: stats } = await supabase.from('matches').select('arbitro1_id,arbitro2_id,arbitro3_id,status')
    const countMap = {}
    ;(stats||[]).forEach(m=>{
      [m.arbitro1_id,m.arbitro2_id,m.arbitro3_id].filter(Boolean).forEach(aid=>{
        if (!countMap[aid]) countMap[aid]={total:0,jugados:0}
        countMap[aid].total++
        if (m.status==='finished') countMap[aid].jugados++
      })
    })
    setArbitros((data||[]).map(a=>({...a, stats:countMap[a.id]||{total:0,jugados:0}})))
  }

  async function handleAsignar(matchId, campo, arbitroId) {
    await supabase.from('matches').update({[campo]:arbitroId||null}).eq('id',matchId)
    fetchPartidos()
  }

  async function handleActivar(arb) {
    // Los árbitros son gratis: sin membresía ni fecha de vencimiento. Si ya
    // tiene cuenta creada, basta con marcarlo activo; si no, se le crea con
    // una contraseña inicial (puede cambiarla luego con su cédula).
    try {
      if (arb.user_id) {
        await supabase.from('players').update({ activo_membresia:true, fecha_vencimiento:null }).eq('id',arb.id)
      } else {
        const email = `${arb.numero_cedula}@golmebol.com`
        const { data:authData, error:authErr } = await supabase.auth.signUp({ email, password:String(arb.numero_cedula), options:{ data:{player_id:arb.id,rol:'arbitro'} } })
        if (authErr) throw authErr
        await supabase.from('players').update({ user_id:authData.user?.id, activo_membresia:true, fecha_vencimiento:null, primer_ingreso:true }).eq('id',arb.id)
      }
      showMsgFn('✅ Acceso activado (gratis)'); fetchArbitros()
    } catch(e) { showMsgFn('Error: '+e.message,'error') }
  }

  async function handleFoto(arb, file) {
    if (!file) return
    setUploading(arb.id)
    const path = `fotos/${arb.id}.${file.name.split('.').pop()}`
    const {error} = await supabase.storage.from('players').upload(path,file,{upsert:true})
    if (!error) {
      const {data:u} = supabase.storage.from('players').getPublicUrl(path)
      await supabase.from('players').update({photo_url:u.publicUrl}).eq('id',arb.id)
      fetchArbitros()
    }
    setUploading(null)
  }

  function showMsgFn(text,type='ok') { setMsg({text,type}); setTimeout(()=>setMsg(null),3000) }

  async function registrarReclamo(partido, arbitroId, tipo, desc) {
    if (!arbitroId || !desc.trim()) return
    // Insertar reclamo
    const { data: rec } = await supabase.from('arbitro_reclamos').insert({
      match_id: partido.id, arbitro_id: arbitroId, descripcion: desc,
      tipo, estado: 'abierto', registrado_por: lider?.id,
    }).select().single()
    // Notificar al árbitro
    const arb = arbitros.find(a=>a.id===arbitroId)
    if (arb) {
      await supabase.from('notificaciones').insert({
        player_id: arbitroId,
        titulo: '⚠️ Reclamo registrado',
        mensaje: `Se registró un reclamo en el partido ${partido.home?.name} vs ${partido.away?.name}. Tipo: ${tipo}. "${desc}"`,
        tipo: 'reclamo',
        referencia_id: rec?.id,
      })
    }
    showMsgFn('Reclamo registrado — árbitro notificado ✓')
    setModalRec(null)
    fetchPartidos()
  }

  if (loading) return <div style={{ minHeight:'100vh',background:'#07070e',display:'flex',alignItems:'center',justifyContent:'center',color:'#00ddd0' }}>Cargando...</div>

  // Filtrar por torneo
  const partsFiltrados = torneoFiltro ? partidos.filter(p=>p.tournament_id===torneoFiltro) : partidos

  const sinAsignar = partsFiltrados.filter(p=>p.status!=='finished'&&!p.arbitro1_id&&!p.arbitro2_id&&!p.arbitro3_id)
  const asignados  = partsFiltrados.filter(p=>p.status!=='finished'&&(p.arbitro1_id||p.arbitro2_id||p.arbitro3_id))
  const jugados    = partsFiltrados.filter(p=>p.status==='finished')
  const pendTodos  = partsFiltrados.filter(p=>p.status!=='finished')

  const torneos = [...new Map(partidos.map(p=>[p.tournament_id,p.tournaments])).values()]

  const tabData = {
    sin_asignar: { lista:sinAsignar, color:'#e8710a', empty:'Todos los partidos tienen árbitro asignado ✓' },
    asignados:   { lista:asignados,  color:'#1e8e3e', empty:'Sin partidos asignados pendientes' },
    jugados:     { lista:jugados,    color:'#1a73e8', empty:'Sin partidos jugados' },
    arbitros:    { lista:null,       color:'#f9a825', empty:'' },
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      {msg && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background:msg.type==='ok'?'#e6f4ea':'#fce8e6', color:msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 16px rgba(0,0,0,.3)' }}>{msg.text}</div>}
      {/* Modal reclamo */}
      {modalRec && (
        <ModalReclamoLider
          partido={modalRec}
          arbitros={arbitros}
          onClose={()=>setModalRec(null)}
          onGuardar={registrarReclamo}
        />
      )}

      {showNuevo && <ModalNuevoArbitro onClose={()=>setShowNuevo(false)} onCreado={()=>{ showMsgFn('Árbitro creado ✓'); fetchArbitros() }}/>}

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(249,168,37,.2)', border:'2px solid #f9a825', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:'.9rem' }}>👑</span>
          </div>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{lider?.name?.split(' ')[0]}</div>
            <div style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'600' }}>{lider?.genero === 'Femenino' ? 'Coordinadora' : 'Coordinador'}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {lider?.rol!=='arbitro' && <button onClick={()=>navigate('/jugador')} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#00ddd0', fontSize:'.72rem' }}>👤 Jugador</button>}
          {(lider?.es_arbitro||lider?.rol==='arbitro') && <button onClick={()=>navigate('/arbitro')} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#f9a825', fontSize:'.72rem' }}>🟡 Árbitro</button>}
          <button onClick={async()=>{ await supabase.auth.signOut(); navigate('/jugador/login') }} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex', alignItems:'center' }}><LogOut size={14}/></button>
        </div>
      </div>

      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'16px' }}>

        {/* Resumen en 4 tarjetas */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
          {[
            { label:'Sin árbitro', value:sinAsignar.length, color:'#e8710a', bg:'rgba(232,113,10,.1)', border:'rgba(232,113,10,.3)', icon:'⚠️', tab:'sin_asignar' },
            { label:'Asignados',   value:asignados.length,  color:'#1e8e3e', bg:'rgba(30,142,62,.1)',  border:'rgba(30,142,62,.3)',  icon:'✅', tab:'asignados' },
            { label:'Jugados',     value:jugados.length,    color:'#1a73e8', bg:'rgba(26,115,232,.1)', border:'rgba(26,115,232,.3)', icon:'📋', tab:'jugados' },
            { label:'Árbitros',    value:arbitros.length,   color:'#f9a825', bg:'rgba(249,168,37,.1)', border:'rgba(249,168,37,.3)', icon:'🟡', tab:'arbitros' },
          ].map(s=>(
            <div key={s.tab} onClick={()=>setTab(s.tab)}
              style={{ background:tab===s.tab?s.bg:'#111827', border:`1px solid ${tab===s.tab?s.border:'#1e2d3d'}`, borderRadius:'12px', padding:'12px', textAlign:'center', cursor:'pointer', transition:'all .15s' }}>
              <div style={{ fontSize:'1.1rem', marginBottom:'2px' }}>{s.icon}</div>
              <div style={{ fontSize:'1.5rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'.6rem', color:'#7a9ab5', marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtro torneo (solo para tabs de partidos) */}
        {tab !== 'arbitros' && torneos.length > 1 && (
          <div style={{ display:'flex', gap:'6px', overflowX:'auto', marginBottom:'12px', paddingBottom:'4px', scrollbarWidth:'none' }}>
            <button onClick={()=>setTorneoFiltro('')}
              style={{ flexShrink:0, padding:'5px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'.72rem', whiteSpace:'nowrap', background:!torneoFiltro?'#1a73e8':'#111827', color:!torneoFiltro?'#fff':'#7a9ab5' }}>
              Todos ({partidos.filter(p=> tab==='sin_asignar'?p.status!=='finished'&&!p.arbitro1_id : tab==='asignados'?p.status!=='finished'&&(p.arbitro1_id||p.arbitro2_id) : p.status==='finished').length})
            </button>
            {torneos.map(t=>(
              <button key={t.id} onClick={()=>setTorneoFiltro(t.id)}
                style={{ flexShrink:0, padding:'5px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'.72rem', whiteSpace:'nowrap', background:torneoFiltro===t.id?'#1a73e8':'#111827', color:torneoFiltro===t.id?'#fff':'#7a9ab5' }}>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Tab Sin árbitro */}
        {tab==='sin_asignar' && (
          <div>
            {sinAsignar.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px', background:'#111827', borderRadius:'12px', border:'1px solid #1e2d3d', color:'#1e8e3e' }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🎉</div>
                <div style={{ fontWeight:'700' }}>Todos los partidos tienen árbitro</div>
              </div>
            ) : sinAsignar.map(p=><CardPartido key={p.id} partido={p} arbitros={arbitros} onAsignar={handleAsignar}/>)}
          </div>
        )}

        {/* Tab Asignados */}
        {tab==='asignados' && (
          <div>
            {asignados.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px', background:'#111827', borderRadius:'12px', border:'1px solid #1e2d3d', color:'#7a9ab5' }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
                <div>Sin partidos asignados</div>
              </div>
            ) : asignados.map(p=><CardPartido key={p.id} partido={p} arbitros={arbitros} onAsignar={handleAsignar}/>)}
          </div>
        )}

        {/* Tab Jugados */}
        {tab==='jugados' && (
          <div>
            {jugados.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px', background:'#111827', borderRadius:'12px', border:'1px solid #1e2d3d', color:'#7a9ab5' }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
                <div>Sin partidos jugados</div>
              </div>
            ) : [...jugados].reverse().map(p => {
              const tieneReclamo = reclamosMap[p.id]?.length > 0
              const recAbierto   = reclamosMap[p.id]?.some(r=>r.estado==='abierto')
              const tieneArbitro = p.arbitro1_id||p.arbitro2_id||p.arbitro3_id
              return (
                <div key={p.id} style={{ marginBottom:'8px', borderRadius:'12px', overflow:'hidden', border:`1px solid ${recAbierto?'rgba(217,48,37,.5)':tieneReclamo?'rgba(217,48,37,.2)':'#1e2d3d'}`, background:recAbierto?'rgba(217,48,37,.05)':'transparent' }}>
                  <CardPartido partido={p} arbitros={arbitros} onAsignar={handleAsignar}/>
                  <div style={{ padding:'6px 14px 10px', borderTop:'0.5px solid #1e2d3d', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', flex:1 }}>
                        {(reclamosMap[p.id]||[]).map((r,i)=>{
                          const arb = arbitros.find(a=>a.id===r.arbitro_id)
                          return <span key={i} style={{ fontSize:'.62rem', color:r.estado==='abierto'?'#d93025':r.estado==='resuelto'?'#1e8e3e':'#7a9ab5', background:r.estado==='abierto'?'rgba(217,48,37,.1)':'rgba(122,154,181,.08)', borderRadius:'5px', padding:'2px 7px' }}>⚠️ {arb?.name?.split(' ')[0]||'Árb.'} · {r.estado}</span>
                        })}
                      </div>
                      <button onClick={()=>setModalRec(p)} style={{ padding:'4px 10px', background:'none', border:'1px solid #d93025', borderRadius:'7px', cursor:'pointer', color:'#d93025', fontSize:'.72rem', fontWeight:'700', flexShrink:0 }}>⚠️ Reclamo</button>
                    </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab Árbitros */}
        {tab==='arbitros' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <input value={busqArb} onChange={e=>setBusqArb(e.target.value)} placeholder="Buscar árbitro..."
                style={{...inp, maxWidth:'220px'}}/>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={()=>navigate('/arbitro/ranking')}
                  style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(249,168,37,.1)', border:'1px solid rgba(249,168,37,.3)', borderRadius:'8px', padding:'7px 12px', cursor:'pointer', color:'#f9a825', fontSize:'.78rem', fontWeight:'700' }}>
                  🏆 Ranking
                </button>
                <button onClick={()=>navigate('/arbitro/encuestas')}
                  style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(26,115,232,.1)', border:'1px solid rgba(26,115,232,.3)', borderRadius:'8px', padding:'7px 12px', cursor:'pointer', color:'#1a73e8', fontSize:'.78rem', fontWeight:'700' }}>
                  📝 Encuestas
                </button>
                <button onClick={()=>setShowNuevo(true)}
                  style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1a73e8', border:'none', borderRadius:'8px', padding:'8px 14px', cursor:'pointer', color:'#fff', fontSize:'.82rem', fontWeight:'700' }}>
                  <Plus size={14}/> Nuevo
                </button>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {arbitros.filter(a=>a.name.toLowerCase().includes(busqArb.toLowerCase())).map(a=>{
                const dias = a.fecha_vencimiento ? Math.ceil((new Date(a.fecha_vencimiento)-new Date())/86400000) : null
                const activo = a.activo_membresia && (dias===null || dias>0) // sin vencimiento = gratis, siempre activo
                return (
                  <div key={a.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
                      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleFoto(a,e.target.files[0])}/>
                      <div style={{ width:'42px', height:'42px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:`2px solid ${activo?'#00ddd0':'#2a3a4a'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {uploading===a.id?<span style={{ fontSize:'.6rem' }}>...</span>
                          :a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          :<span>👤</span>}
                      </div>
                      <div style={{ position:'absolute', bottom:0, right:0, width:'14px', height:'14px', background:'#1a73e8', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Upload size={7} color="#fff"/>
                      </div>
                    </label>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div onClick={()=>navigate(`/arbitro/perfil/${a.id}`)}
                        style={{ fontWeight:'700', fontSize:'.88rem', color:'#00ddd0', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(0,221,208,.3)' }}>{a.name}</div>
                      <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'2px', display:'flex', gap:'8px' }}>
                        <span>📋 {a.stats.total} asig.</span>
                        <span style={{ color:'#1e8e3e' }}>✅ {a.stats.jugados} pitados</span>
                        {a.numero_cedula && <span>🪪 {a.numero_cedula}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      {!a.user_id?(
                        <button onClick={()=>handleActivar(a)} style={{ padding:'5px 10px', background:'#1a73e8', border:'none', borderRadius:'7px', cursor:'pointer', color:'#fff', fontSize:'.72rem', fontWeight:'700' }}>Activar</button>
                      ):activo?(
                        <div>
                          <div style={{ fontSize:'.7rem', color:'#1e8e3e', fontWeight:'700' }}>✅ Activo</div>
                          <div style={{ fontSize:'.6rem', color:'#7a9ab5' }}>{dias}d</div>
                        </div>
                      ):(
                        <button onClick={()=>handleActivar(a)} style={{ padding:'5px 10px', background:'none', border:'1px solid #e8710a', borderRadius:'7px', cursor:'pointer', color:'#e8710a', fontSize:'.72rem' }}>Renovar</button>
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
