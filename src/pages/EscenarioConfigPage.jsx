import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Image as ImageIcon, Plus, Trash2, RotateCcw, Upload, Globe } from 'lucide-react'
import { slugifyCancha, registrarActividad, invalidarAccesoEscenario } from '../lib/escenarioHelpers'

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
  const [soloLectura, setSoloLectura] = useState(false)
  // Vitrina pública (organizador_perfiles) — solo existe si un admin u
  // organizador ya vinculó este escenario desde "Mi dominio". El encargado
  // puede editar los datos (logo, descripción, contacto, redes) pero no el
  // dominio propio ni desvincular el escenario, eso lo controla el admin.
  const [vitrina,   setVitrina]   = useState(null)
  const [formVitrina, setFormVitrina] = useState(null)
  const [guardandoVitrina, setGuardandoVitrina] = useState(false)
  const [subiendoLogoVitrina, setSubiendoLogoVitrina] = useState(false)
  const [subiendoFaviconVitrina, setSubiendoFaviconVitrina] = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id, solo_lectura').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    setSoloLectura(!!acceso.solo_lectura)
    setEncargado(p)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    if (esc) setForm({
      name: esc.name || '', city: esc.city || '', whatsapp: esc.whatsapp || '', direccion: esc.direccion || '',
      hora_apertura: esc.hora_apertura ?? 8, hora_cierre: esc.hora_cierre ?? 22,
    })
    const { data: cs } = await supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).order('orden')
    setCanchas(cs || [])
    const { data: vit } = await supabase.from('organizador_perfiles').select('*').eq('escenario_id', escenarioId).maybeSingle()
    setVitrina(vit || null)
    if (vit) setFormVitrina({
      nombre_publico: vit.nombre_publico || '', descripcion: vit.descripcion || '',
      color_primario: vit.color_primario || '#22c55e', color_secundario: vit.color_secundario || '#0f172a',
      logo_url: vit.logo_url || '', favicon_url: vit.favicon_url || '',
      whatsapp: vit.whatsapp || '', email: vit.email || '', direccion: vit.direccion || '',
      facebook_url: vit.facebook_url || '', instagram_url: vit.instagram_url || '', tiktok_url: vit.tiktok_url || '',
    })
    setLoading(false)
  }

  async function guardarVitrina() {
    if (!vitrina) return
    setGuardandoVitrina(true)
    const payload = {
      nombre_publico: formVitrina.nombre_publico.trim() || null,
      descripcion: formVitrina.descripcion.trim() || null,
      color_primario: formVitrina.color_primario?.trim() || null,
      color_secundario: formVitrina.color_secundario?.trim() || null,
      logo_url: formVitrina.logo_url || null,
      favicon_url: formVitrina.favicon_url || null,
      whatsapp: formVitrina.whatsapp.trim() || null,
      email: formVitrina.email.trim() || null,
      direccion: formVitrina.direccion.trim() || null,
      facebook_url: formVitrina.facebook_url.trim() || null,
      instagram_url: formVitrina.instagram_url.trim() || null,
      tiktok_url: formVitrina.tiktok_url.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('organizador_perfiles').update(payload).eq('id', vitrina.id).select().single()
    setGuardandoVitrina(false)
    if (error) { setMsg('Error al guardar la vitrina: ' + error.message); return }
    setVitrina(data)
    setMsg('✅ Vitrina guardada'); setTimeout(()=>setMsg(''),3000)
  }

  async function handleLogoVitrina(file) {
    if (!file || !vitrina) return
    setSubiendoLogoVitrina(true)
    const ext = file.name.split('.').pop()
    const path = `${vitrina.organizador_id}/logo.${ext}`
    const { error: errUp } = await supabase.storage.from('organizador-branding').upload(path, file, { upsert: true })
    if (errUp) { setSubiendoLogoVitrina(false); setMsg('Error al subir logo: ' + errUp.message); return }
    const { data: urlData } = supabase.storage.from('organizador-branding').getPublicUrl(path)
    setFormVitrina(f => ({ ...f, logo_url: urlData.publicUrl }))
    setSubiendoLogoVitrina(false)
    setMsg('Logo subido — recuerda guardar la vitrina'); setTimeout(()=>setMsg(''),3500)
  }

  async function handleFaviconVitrina(file) {
    if (!file || !vitrina) return
    setSubiendoFaviconVitrina(true)
    const ext = file.name.split('.').pop()
    const path = `${vitrina.organizador_id}/favicon.${ext}`
    const { error: errUp } = await supabase.storage.from('organizador-branding').upload(path, file, { upsert: true })
    if (errUp) { setSubiendoFaviconVitrina(false); setMsg('Error al subir favicon: ' + errUp.message); return }
    const { data: urlData } = supabase.storage.from('organizador-branding').getPublicUrl(path)
    setFormVitrina(f => ({ ...f, favicon_url: urlData.publicUrl }))
    setSubiendoFaviconVitrina(false)
    setMsg('Favicon subido — recuerda guardar la vitrina'); setTimeout(()=>setMsg(''),3500)
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
      invalidarAccesoEscenario(escenario.id)
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
    invalidarAccesoEscenario(escenario.id)
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
          <div style={{ marginBottom:'12px' }}><label style={lbl}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} disabled={soloLectura}/></div>
          <div style={{ marginBottom:'12px' }}><label style={lbl}>Ciudad</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inp} disabled={soloLectura}/></div>
          <div style={{ marginBottom:'12px' }}>
            <label style={lbl}>WhatsApp del negocio (sin + ni espacios, con código de país)</label>
            <input value={form.whatsapp} onChange={e=>setForm(f=>({...f,whatsapp:e.target.value}))} style={inp} placeholder="573001234567" disabled={soloLectura}/>
            <div style={{ background:'rgba(249,168,37,.1)', border:`1px solid ${S.gold}`, borderRadius:'10px', padding:'10px 12px', marginTop:'8px', fontSize:'.72rem', color:S.text2, lineHeight:1.5 }}>
              <b style={{ color:S.gold }}>⚠️ Cuidado con este número:</b> cada reserva de la página le manda un mensaje de WhatsApp — si llegan muchas reservas de gente que no tiene el número guardado, WhatsApp puede poner la cuenta "en revisión" y bloquearla. Para bajar el riesgo:
              <ul style={{ margin:'6px 0 0', paddingLeft:'18px' }}>
                <li>Usa <b>WhatsApp Business</b> en ese número, no el WhatsApp normal.</li>
                <li>No uses este mismo número para enviar mensajes masivos o en cadena por otro lado.</li>
                <li>Si ya te sale "cuenta en revisión", no la sigas usando ni la reinstales varias veces — espera a que WhatsApp la revise (puede tardar días).</li>
                <li>Si se pone muy grave, considera usar un número aparte solo para las reservas de la página.</li>
              </ul>
            </div>
          </div>
          <div style={{ marginBottom:'0' }}>
            <label style={lbl}>Dirección</label>
            <input value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} style={inp} placeholder="Ej: Barrio Puerto Espejo, Armenia, Quindío" disabled={soloLectura}/>
            <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'6px' }}>Se usa para mostrar el mapa en la página pública de reservas.</div>
          </div>
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'14px' }}>Horario</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label style={lbl}>Hora de apertura</label><input type="number" value={form.hora_apertura} onChange={e=>setForm(f=>({...f,hora_apertura:e.target.value}))} style={inp} disabled={soloLectura}/></div>
            <div><label style={lbl}>Hora de cierre</label><input type="number" value={form.hora_cierre} onChange={e=>setForm(f=>({...f,hora_cierre:e.target.value}))} style={inp} disabled={soloLectura}/></div>
          </div>
          <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'8px' }}>Aplica para todas las canchas del escenario.</div>
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'4px' }}>Canchas</div>
          <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'14px' }}>Crea las canchas que tenga tu escenario, con su propio nombre y precio por hora.</div>

          {canchas.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', opacity: c.activa ? 1 : .5 }}>
              <input value={c.nombre} onChange={e=>editarCanchaLocal(c.id,'nombre',e.target.value)} onBlur={()=>guardarCancha(c)}
                style={{ ...inp, flex:'1 1 auto' }} placeholder="Nombre de la cancha" disabled={soloLectura}/>
              <input type="number" value={c.precio_hora} onChange={e=>editarCanchaLocal(c.id,'precio_hora',e.target.value)} onBlur={()=>guardarCancha(c)}
                style={{ ...inp, width:'110px', flex:'0 0 auto' }} placeholder="$/hora" disabled={soloLectura}/>
              {!soloLectura && (
              <button onClick={()=>toggleCancha(c)} title={c.activa ? 'Desactivar cancha' : 'Reactivar cancha'}
                style={{ flexShrink:0, width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color: c.activa ? '#ff6b6b' : S.cyan }}>
                {c.activa ? <Trash2 size={14}/> : <RotateCcw size={14}/>}
              </button>
              )}
            </div>
          ))}
          {canchas.length === 0 && <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'12px' }}>Todavía no tienes canchas creadas.</div>}

          {!soloLectura && (
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
          )}
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'4px' }}>Imagen de fondo</div>
          <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'10px' }}>Se muestra en la página pública de reservas (el link que le mandas a los clientes).</div>
          {escenario?.imagen_fondo_url && (
            <div style={{ width:'100%', height:'90px', borderRadius:'10px', overflow:'hidden', marginBottom:'8px', border:`1px solid ${S.border}` }}>
              <img src={escenario.imagen_fondo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          )}
          {!soloLectura && (
          <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background:S.card2, border:`1px dashed ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text2, fontSize:'.8rem', fontWeight:'600' }}>
            <ImageIcon size={14}/> {subiendoFondo ? 'Subiendo...' : escenario?.imagen_fondo_url ? 'Cambiar imagen de fondo' : 'Subir imagen de fondo'}
            <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoFondo} onChange={e=>handleFondo(e.target.files[0])}/>
          </label>
          )}
          {escenario && (
            <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'10px' }}>
              Link público para reservar: <a href={`/reservar/${escenario.id}`} target="_blank" rel="noreferrer" style={{ color:S.cyan }}>golmebol.com/reservar/{escenario.id}</a>
            </div>
          )}
        </div>

        {!soloLectura && (
        <button onClick={guardar} disabled={guardando}
          style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem', opacity:guardando?.7:1 }}>
          {guardando ? 'Guardando...' : 'Guardar configuración'}
        </button>
        )}

        {/* Vitrina pública — solo si un admin/organizador ya vinculó este
            escenario a un dominio propio desde "Mi dominio". */}
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginTop:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}><Globe size={16} color={S.cyan}/> Vitrina pública</div>
          {!vitrina ? (
            <div style={{ fontSize:'.78rem', color:S.muted, marginTop:'10px' }}>
              Este escenario todavía no está vinculado a ningún dominio propio. Pídele al administrador que lo cree y vincule en "Mi dominio" — después vas a poder editar acá el logo, la descripción, el contacto y las redes que se ven ahí.
            </div>
          ) : (
            <>
              <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'14px' }}>Estos datos se ven en {vitrina.custom_domain || 'el dominio propio del organizador'} — el dominio en sí solo lo cambia el administrador.</div>

              <div style={{ marginBottom:'12px' }}><label style={lbl}>Nombre público</label><input value={formVitrina.nombre_publico} onChange={e=>setFormVitrina(f=>({...f,nombre_publico:e.target.value}))} style={inp} disabled={soloLectura}/></div>
              <div style={{ marginBottom:'12px' }}><label style={lbl}>Descripción corta</label><input value={formVitrina.descripcion} onChange={e=>setFormVitrina(f=>({...f,descripcion:e.target.value}))} style={inp} disabled={soloLectura}/></div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                <div>
                  <label style={lbl}>Logo</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'44px', height:'44px', borderRadius:'8px', background:S.card2, border:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                      {formVitrina.logo_url ? <img src={formVitrina.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Globe size={18} color={S.muted}/>}
                    </div>
                    {!soloLectura && (
                    <label style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'.7rem', color:S.cyan, border:`1px solid ${S.cyan}`, borderRadius:'6px', padding:'6px 10px', cursor:'pointer' }}>
                      <Upload size={11}/> {subiendoLogoVitrina ? '...' : 'Subir'}
                      <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoLogoVitrina} onChange={e=>{ handleLogoVitrina(e.target.files[0]); e.target.value='' }}/>
                    </label>
                    )}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Favicon</label>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'44px', height:'44px', borderRadius:'8px', background:S.card2, border:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                      {formVitrina.favicon_url ? <img src={formVitrina.favicon_url} style={{ width:'28px', height:'28px', objectFit:'contain' }}/> : <ImageIcon size={16} color={S.muted}/>}
                    </div>
                    {!soloLectura && (
                    <label style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'.7rem', color:S.cyan, border:`1px solid ${S.cyan}`, borderRadius:'6px', padding:'6px 10px', cursor:'pointer' }}>
                      <Upload size={11}/> {subiendoFaviconVitrina ? '...' : 'Subir'}
                      <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoFaviconVitrina} onChange={e=>{ handleFaviconVitrina(e.target.files[0]); e.target.value='' }}/>
                    </label>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                <div><label style={lbl}>Color primario</label><input type="color" value={formVitrina.color_primario} onChange={e=>setFormVitrina(f=>({...f,color_primario:e.target.value}))} style={{ ...inp, padding:'2px', height:'40px', cursor:'pointer' }} disabled={soloLectura}/></div>
                <div><label style={lbl}>Color secundario</label><input type="color" value={formVitrina.color_secundario} onChange={e=>setFormVitrina(f=>({...f,color_secundario:e.target.value}))} style={{ ...inp, padding:'2px', height:'40px', cursor:'pointer' }} disabled={soloLectura}/></div>
              </div>

              <div style={{ fontWeight:700, fontSize:'.78rem', color:S.text2, margin:'16px 0 10px' }}>Contacto y redes (en el pie de página)</div>
              <div style={{ marginBottom:'12px' }}><label style={lbl}>WhatsApp</label><input value={formVitrina.whatsapp} onChange={e=>setFormVitrina(f=>({...f,whatsapp:e.target.value}))} style={inp} placeholder="3001234567" disabled={soloLectura}/></div>
              <div style={{ marginBottom:'12px' }}><label style={lbl}>Correo</label><input value={formVitrina.email} onChange={e=>setFormVitrina(f=>({...f,email:e.target.value}))} style={inp} disabled={soloLectura}/></div>
              <div style={{ marginBottom:'12px' }}><label style={lbl}>Dirección / ciudad</label><input value={formVitrina.direccion} onChange={e=>setFormVitrina(f=>({...f,direccion:e.target.value}))} style={inp} disabled={soloLectura}/></div>
              <div style={{ marginBottom:'12px' }}><label style={lbl}>Facebook</label><input value={formVitrina.facebook_url} onChange={e=>setFormVitrina(f=>({...f,facebook_url:e.target.value}))} style={inp} placeholder="https://facebook.com/..." disabled={soloLectura}/></div>
              <div style={{ marginBottom:'12px' }}><label style={lbl}>Instagram</label><input value={formVitrina.instagram_url} onChange={e=>setFormVitrina(f=>({...f,instagram_url:e.target.value}))} style={inp} placeholder="https://instagram.com/..." disabled={soloLectura}/></div>
              <div style={{ marginBottom:'16px' }}><label style={lbl}>TikTok</label><input value={formVitrina.tiktok_url} onChange={e=>setFormVitrina(f=>({...f,tiktok_url:e.target.value}))} style={inp} placeholder="https://tiktok.com/@..." disabled={soloLectura}/></div>

              {!soloLectura && (
              <button onClick={guardarVitrina} disabled={guardandoVitrina}
                style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem', opacity:guardandoVitrina?.7:1 }}>
                {guardandoVitrina ? 'Guardando...' : '✓ Guardar vitrina'}
              </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
