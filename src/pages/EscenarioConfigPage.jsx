import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Image as ImageIcon, Plus, Trash2, RotateCcw } from 'lucide-react'
import { slugifyCancha, registrarActividad } from '../lib/escenarioHelpers'

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
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [canchas,   setCanchas]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFondo, setSubiendoFondo] = useState(false)
  const [msg,       setMsg]       = useState('')
  const [nuevaCancha, setNuevaCancha] = useState({ nombre:'', precio_hora:'' })
  const [agregando, setAgregando] = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    setEncargado(p)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    if (esc) setForm({
      name: esc.name || '', city: esc.city || '', whatsapp: esc.whatsapp || '', direccion: esc.direccion || '',
      hora_apertura: esc.hora_apertura ?? 8, hora_cierre: esc.hora_cierre ?? 22,
    })
    const { data: cs } = await supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).order('orden')
    setCanchas(cs || [])
    setLoading(false)
  }

  function editarCanchaLocal(id, campo, valor) {
    setCanchas(cs => cs.map(c => c.id === id ? { ...c, [campo]: valor } : c))
  }

  async function guardarCancha(c) {
    const original = (canchas.find(x => x.id === c.id)) || {}
    const nombreNuevo = c.nombre.trim() || 'Cancha'
    const precioNuevo = Number(c.precio_hora) || 0
    await supabase.from('escenario_canchas').update({ nombre: nombreNuevo, precio_hora: precioNuevo }).eq('id', c.id)
    const cambios = []
    if (Number(original.precio_hora) !== precioNuevo) cambios.push(`precio de $${Number(original.precio_hora||0).toLocaleString('es-CO')} a $${precioNuevo.toLocaleString('es-CO')}`)
    if (original.nombre !== nombreNuevo) cambios.push(`nombre de "${original.nombre}" a "${nombreNuevo}"`)
    if (cambios.length > 0) registrarActividad(escenarioId, encargado, 'editar', 'cancha', `Editó la cancha "${nombreNuevo}": cambió ${cambios.join(', ')}`)
    fetchTodo()
  }

  async function toggleCancha(c) {
    await supabase.from('escenario_canchas').update({ activa: !c.activa }).eq('id', c.id)
    registrarActividad(escenarioId, encargado, c.activa ? 'eliminar' : 'crear', 'cancha', `${c.activa ? 'Desactivó' : 'Reactivó'} la cancha "${c.nombre}"`)
    fetchTodo()
  }

  async function agregarCancha() {
    if (!nuevaCancha.nombre.trim()) { setMsg('Escribe un nombre para la cancha'); return }
    setAgregando(true)
    const slug = slugifyCancha(nuevaCancha.nombre)
    const { error } = await supabase.from('escenario_canchas').insert({
      escenario_id: escenarioId, slug, nombre: nuevaCancha.nombre.trim(),
      precio_hora: Number(nuevaCancha.precio_hora) || 0, orden: canchas.length, activa: true,
    })
    setAgregando(false)
    if (error) { setMsg('Error al crear la cancha: ' + error.message); return }
    registrarActividad(escenarioId, encargado, 'crear', 'cancha', `Creó la cancha "${nuevaCancha.nombre.trim()}" (precio ${Number(nuevaCancha.precio_hora)||0}/hora)`)
    setNuevaCancha({ nombre:'', precio_hora:'' })
    fetchTodo()
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
      direccion: form.direccion.trim() || null,
      hora_apertura: parseInt(form.hora_apertura)||8, hora_cierre: parseInt(form.hora_cierre)||22,
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
          <div style={{ marginBottom:'12px' }}>
            <label style={lbl}>WhatsApp del negocio (sin + ni espacios, con código de país)</label>
            <input value={form.whatsapp} onChange={e=>setForm(f=>({...f,whatsapp:e.target.value}))} style={inp} placeholder="573001234567"/>
          </div>
          <div style={{ marginBottom:'0' }}>
            <label style={lbl}>Dirección</label>
            <input value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} style={inp} placeholder="Ej: Barrio Puerto Espejo, Armenia, Quindío"/>
            <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'6px' }}>Se usa para mostrar el mapa en la página pública de reservas.</div>
          </div>
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'14px' }}>Horario</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label style={lbl}>Hora de apertura</label><input type="number" value={form.hora_apertura} onChange={e=>setForm(f=>({...f,hora_apertura:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Hora de cierre</label><input type="number" value={form.hora_cierre} onChange={e=>setForm(f=>({...f,hora_cierre:e.target.value}))} style={inp}/></div>
          </div>
          <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'8px' }}>Aplica para todas las canchas del escenario.</div>
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'4px' }}>Canchas</div>
          <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'14px' }}>Crea las canchas que tenga tu escenario, con su propio nombre y precio por hora.</div>

          {canchas.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', opacity: c.activa ? 1 : .5 }}>
              <input value={c.nombre} onChange={e=>editarCanchaLocal(c.id,'nombre',e.target.value)} onBlur={()=>guardarCancha(c)}
                style={{ ...inp, flex:'1 1 auto' }} placeholder="Nombre de la cancha"/>
              <input type="number" value={c.precio_hora} onChange={e=>editarCanchaLocal(c.id,'precio_hora',e.target.value)} onBlur={()=>guardarCancha(c)}
                style={{ ...inp, width:'110px', flex:'0 0 auto' }} placeholder="$/hora"/>
              <button onClick={()=>toggleCancha(c)} title={c.activa ? 'Desactivar cancha' : 'Reactivar cancha'}
                style={{ flexShrink:0, width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color: c.activa ? '#ff6b6b' : S.cyan }}>
                {c.activa ? <Trash2 size={14}/> : <RotateCcw size={14}/>}
              </button>
            </div>
          ))}
          {canchas.length === 0 && <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'12px' }}>Todavía no tienes canchas creadas.</div>}

          <div style={{ display:'flex', gap:'8px', marginTop:'14px', paddingTop:'14px', borderTop:`1px solid ${S.border}` }}>
            <input value={nuevaCancha.nombre} onChange={e=>setNuevaCancha(f=>({...f,nombre:e.target.value}))}
              style={{ ...inp, flex:'1 1 auto' }} placeholder="Ej: Cancha 3"/>
            <input type="number" value={nuevaCancha.precio_hora} onChange={e=>setNuevaCancha(f=>({...f,precio_hora:e.target.value}))}
              style={{ ...inp, width:'110px', flex:'0 0 auto' }} placeholder="$/hora"/>
            <button onClick={agregarCancha} disabled={agregando}
              style={{ flexShrink:0, width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', opacity:agregando?.7:1 }}>
              <Plus size={16}/>
            </button>
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
