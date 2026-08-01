import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Image as ImageIcon } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }

export default function EscenarioConfigPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFondo, setSubiendoFondo] = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    if (esc) setForm({
      name: esc.name || '', city: esc.city || '', whatsapp: esc.whatsapp || '',
      hora_apertura: esc.hora_apertura ?? 8, hora_cierre: esc.hora_cierre ?? 22,
      precio_futbol5: esc.precio_futbol5 ?? 60000, precio_futbol7: esc.precio_futbol7 ?? 90000,
    })
    setLoading(false)
  }

  async function handleFondo(file) {
    if (!file || !escenario) return
    setSubiendoFondo(true)
    const ext = file.name.split('.').pop()
    const path = `escenarios-fondos/${escenario.id}.${ext}`
    const { error: errUp } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (!errUp) {
      const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
      await supabase.from('escenarios').update({ imagen_fondo_url: urlData.publicUrl }).eq('id', escenario.id)
      setEscenario(e => ({ ...e, imagen_fondo_url: urlData.publicUrl }))
    }
    setSubiendoFondo(false)
  }

  async function guardar() {
    if (!form.name.trim()) { setMsg('El nombre es obligatorio'); return }
    setGuardando(true); setMsg('')
    const payload = {
      name: form.name.trim(), city: form.city.trim() || null, whatsapp: form.whatsapp.trim() || null,
      hora_apertura: parseInt(form.hora_apertura)||8, hora_cierre: parseInt(form.hora_cierre)||22,
      precio_futbol5: Number(form.precio_futbol5)||0, precio_futbol7: Number(form.precio_futbol7)||0,
    }
    const { error } = await supabase.from('escenarios').update(payload).eq('id', escenario.id)
    setGuardando(false)
    if (error) { setMsg('Error al guardar: ' + error.message); return }
    setEscenario(e => ({ ...e, ...payload }))
    setMsg('✅ Configuración guardada'); setTimeout(()=>setMsg(''),3000)
  }

  if (loading || !form) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>⚙️ Configuración</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background: msg.startsWith('✅')?S.cyanDim:'rgba(217,48,37,.12)', color: msg.startsWith('✅')?S.cyan:'#ff6b6b', borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'14px' }}>Datos del escenario</div>
          <div style={{ marginBottom:'12px' }}><label style={lbl}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp}/></div>
          <div style={{ marginBottom:'12px' }}><label style={lbl}>Ciudad</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inp}/></div>
          <div style={{ marginBottom:'0' }}>
            <label style={lbl}>WhatsApp del negocio (sin + ni espacios, con código de país)</label>
            <input value={form.whatsapp} onChange={e=>setForm(f=>({...f,whatsapp:e.target.value}))} style={inp} placeholder="573001234567"/>
          </div>
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'14px' }}>Canchas</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
            <div><label style={lbl}>Hora de apertura</label><input type="number" value={form.hora_apertura} onChange={e=>setForm(f=>({...f,hora_apertura:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Hora de cierre</label><input type="number" value={form.hora_cierre} onChange={e=>setForm(f=>({...f,hora_cierre:e.target.value}))} style={inp}/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label style={lbl}>Precio por hora Fútbol 5</label><input type="number" value={form.precio_futbol5} onChange={e=>setForm(f=>({...f,precio_futbol5:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Precio por hora Fútbol 7</label><input type="number" value={form.precio_futbol7} onChange={e=>setForm(f=>({...f,precio_futbol7:e.target.value}))} style={inp}/></div>
          </div>
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'4px' }}>Imagen de fondo</div>
          <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'10px' }}>Se muestra en la página pública de reservas (el link que le mandas a los clientes).</div>
          {escenario?.imagen_fondo_url && (
            <div style={{ width:'100%', height:'90px', borderRadius:'10px', overflow:'hidden', marginBottom:'8px', border:`1px solid ${S.border}` }}>
              <img src={escenario.imagen_fondo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          )}
          <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background:S.card2, border:`1px dashed ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text2, fontSize:'.8rem', fontWeight:'600' }}>
            <ImageIcon size={14}/> {subiendoFondo ? 'Subiendo...' : escenario?.imagen_fondo_url ? 'Cambiar imagen de fondo' : 'Subir imagen de fondo'}
            <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoFondo} onChange={e=>handleFondo(e.target.files[0])}/>
          </label>
          {escenario && (
            <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'10px' }}>
              Link público para reservar: <a href={`/reservar/${escenario.id}`} target="_blank" rel="noreferrer" style={{ color:S.cyan }}>golmebol.com/reservar/{escenario.id}</a>
            </div>
          )}
        </div>

        <button onClick={guardar} disabled={guardando}
          style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem', opacity:guardando?.7:1 }}>
          {guardando ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
