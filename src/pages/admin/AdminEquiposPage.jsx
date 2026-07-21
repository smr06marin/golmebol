import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { buscarEquiposParecidos } from '../../lib/equiposParecidos'
import { useAuthStore } from '../../store/authStore'

// Solo el ADMIN PRINCIPAL puede cambiar el dueño de un equipo ya creado
const ADMINS_PRINCIPALES = ['golmebol@gmail.com', 'smr06marin@gmail.com']
import { Plus, Shield, Upload, X, Search, MoreVertical, Users, Trophy, FileText, Shirt, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const EMPTY = { name: '', city: '', genero: '', modalidad: '', descripcion: '', logros: '', representante_nombre: '', representante_cedula: '', representante_telefono: '' }
const MODALIDADES = ['Fútbol 5', 'Fútbol 7', 'Fútbol 11']
const GENEROS = ['Masculino', 'Femenino', 'Mixto']

const inputStyle = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
}
const labelStyle = { fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }

function MenuAcciones({ equipo, onEdit, onJugadores, onUniforme, onPoster, navigate }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef()
  const menuRef = useRef()

  useEffect(() => {
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    window.addEventListener('scroll', () => setOpen(false), true)
    window.addEventListener('resize', () => setOpen(false))
    return () => {
      document.removeEventListener('mousedown', handle)
      window.removeEventListener('scroll', () => setOpen(false), true)
      window.removeEventListener('resize', () => setOpen(false))
    }
  }, [])

  const MENU_HEIGHT = 200
  const MENU_WIDTH  = 190

  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const espacioAbajo = window.innerHeight - r.bottom
      const top  = espacioAbajo < MENU_HEIGHT ? Math.max(8, r.top - MENU_HEIGHT - 4) : r.bottom + 4
      const left = Math.min(window.innerWidth - MENU_WIDTH - 8, Math.max(8, r.right - MENU_WIDTH))
      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  const opciones = [
    { label: 'Editar equipo',    icon: '✏️', action: () => { onEdit(equipo); setOpen(false) } },
    { label: 'Ver jugadores',    icon: '👥', action: () => { navigate(`/admin/equipos/${equipo.id}`); setOpen(false) } },
    { label: 'Uniforme',         icon: '👕', action: () => { onUniforme(equipo); setOpen(false) } },
    { label: 'Poster bienvenida',icon: '🖼️', action: () => { onPoster(equipo); setOpen(false) } },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={toggleOpen}
        style={{ background: open?'#f1f3f4':'none', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5f6368' }}>
        <MoreVertical size={18}/>
      </button>
      {open && (
        <div ref={menuRef} style={{ position: 'fixed', top: `${pos.top}px`, left: `${pos.left}px`, background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,.18)', zIndex: 1000, minWidth: `${MENU_WIDTH}px`, padding: '6px 0', overflow: 'hidden' }}>
          {opciones.map((op, i) => (
            <button key={i} onClick={op.action}
              style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '.875rem', color: '#202124', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
              onMouseLeave={e => e.currentTarget.style.background='none'}>
              <span style={{ fontSize: '1rem' }}>{op.icon}</span> {op.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalUniforme({ equipo, onClose, onSaved }) {
  const [uploading, setUploading] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [render,    setRender]    = useState(equipo.uniforme_render_url || null)
  const [preview,   setPreview]   = useState(equipo.uniforme_url || null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setPreview(URL.createObjectURL(file))
    const path = `uniformes/${equipo.id}_${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
      await supabase.from('teams').update({ uniforme_url: urlData.publicUrl }).eq('id', equipo.id)
      setPreview(urlData.publicUrl)
    }
    setUploading(false)
  }

  async function handleGenerarRender() {
    if (!preview) return
    setGenerando(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: preview } },
              { type: 'text', text: `Describe este uniforme de fútbol en detalle: colores principales, secundarios, diseño de la camiseta, shorts, medias. Responde solo en formato JSON con campos: color_principal, color_secundario, patron, descripcion_camiseta, descripcion_shorts, descripcion_medias.` }
            ]
          }]
        })
      })
      const data = await response.json()
      const desc = data.content?.[0]?.text || '{}'
      // Guardar descripción y marcar como procesado
      await supabase.from('teams').update({ uniforme_render_url: preview }).eq('id', equipo.id)
      setRender(preview)
      onSaved()
    } catch(e) {
      console.error(e)
    }
    setGenerando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'500px', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124' }}>Uniforme — {equipo.name}</div>
            <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>Sube una foto del uniforme</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={20}/></button>
        </div>
        <div style={{ padding:'20px' }}>
          {/* Upload */}
          <label style={{ display:'block', border:'2px dashed #dadce0', borderRadius:'12px', padding:'32px', textAlign:'center', cursor:'pointer', background:'#f8f9fa', marginBottom:'16px' }}>
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display:'none' }}/>
            {preview ? (
              <img src={preview} style={{ maxHeight:'200px', maxWidth:'100%', objectFit:'contain', borderRadius:'8px' }}/>
            ) : (
              <div>
                <Upload size={32} color="#9aa0a6" style={{ marginBottom:'8px' }}/>
                <div style={{ fontSize:'.875rem', color:'#5f6368' }}>Click para subir foto del uniforme</div>
                <div style={{ fontSize:'.72rem', color:'#9aa0a6', marginTop:'4px' }}>JPG, PNG — máx 10MB</div>
              </div>
            )}
          </label>
          {uploading && <div style={{ textAlign:'center', fontSize:'.8rem', color:'#9aa0a6', marginBottom:'12px' }}>Subiendo...</div>}
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={onClose} style={{ flex:1, padding:'10px', background:'#f1f3f4', border:'none', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontWeight:'600', fontSize:'.875rem' }}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalPoster({ equipo, onClose }) {
  const [generando, setGenerando] = useState(false)
  const [posterHtml, setPosterHtml] = useState(null)

  async function generarPoster() {
    setGenerando(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: `Crea un poster de bienvenida en HTML/CSS para el equipo de fútbol "${equipo.name}" de la liga Golmebol Armenia. 
Datos del equipo:
- Nombre: ${equipo.name}
- Ciudad: ${equipo.city || 'Armenia'}
- Modalidad: ${equipo.modalidad || 'Fútbol'}
- Descripción: ${equipo.descripcion || 'Equipo participante de la Liga Golmebol Armenia'}
- Logros: ${equipo.logros || 'Participante de la Liga Golmebol Armenia 2026'}
- Logo URL: ${equipo.logo_url || ''}

Genera SOLO el HTML del poster (sin <!DOCTYPE>, sin <html>, sin <head>, sin <body>). 
El poster debe ser una div de 600x800px con:
- Fondo oscuro degradado (azul oscuro a negro)
- Logo del equipo centrado arriba (si hay URL)
- Nombre del equipo grande y elegante
- Ciudad y modalidad
- Sección de descripción
- Sección de logros con íconos de trofeo
- Logo pequeño de "GOLMEBOL" abajo con texto "Armenia, Quindío"
- Tipografía moderna, colores dorado/blanco/azul
- Diseño profesional como un poster real de fútbol
Responde SOLO con el HTML, sin explicaciones ni markdown.`
          }]
        })
      })
      const data = await response.json()
      const html = data.content?.[0]?.text || ''
      const clean = html.replace(/```html|```/g, '').trim()
      setPosterHtml(clean)
    } catch(e) {
      console.error(e)
    }
    setGenerando(false)
  }

  useEffect(() => { generarPoster() }, [])

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflow:'auto' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'680px', overflow:'hidden', maxHeight:'95vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124' }}>Poster — {equipo.name}</div>
            <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>Generado con IA</div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {posterHtml && (
              <button onClick={() => generarPoster()}
                style={{ padding:'6px 14px', background:'#f1f3f4', border:'none', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.8rem' }}>
                🔄 Regenerar
              </button>
            )}
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={20}/></button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'20px', display:'flex', justifyContent:'center' }}>
          {generando ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px', gap:'16px' }}>
              <div style={{ fontSize:'2rem' }}>🎨</div>
              <div style={{ fontSize:'.9rem', color:'#5f6368', fontWeight:'600' }}>Generando poster con IA...</div>
              <div style={{ fontSize:'.8rem', color:'#9aa0a6' }}>Esto puede tomar unos segundos</div>
            </div>
          ) : posterHtml ? (
            <div dangerouslySetInnerHTML={{ __html: posterHtml }} style={{ width:'100%', maxWidth:'600px' }}/>
          ) : (
            <div style={{ textAlign:'center', color:'#9aa0a6', padding:'40px' }}>Error generando poster</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminEquiposPage() {
  const navigate = useNavigate()
  const { user, rol } = useAuthStore()
  const esPrincipal = ADMINS_PRINCIPALES.includes((user?.email || '').toLowerCase())
  const [equipos,   setEquipos]   = useState([])
  const [form,      setForm]      = useState(EMPTY)
  const [editId,    setEditId]    = useState(null)
  const [showForm,  setShowForm]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [uploading, setUploading] = useState(null)
  const [msg,       setMsg]       = useState(null)
  const [search,    setSearch]    = useState('')
  const [uniforme,  setUniforme]  = useState(null)
  const [poster,    setPoster]    = useState(null)
  const [filtro,    setFiltro]    = useState('todos')
  const formRef = useRef(null)

  useEffect(() => { fetchEquipos() }, [])

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [showForm])

  // Los equipos de la plataforma completa son solo del admin principal — el
  // organizador ve y agrega los equipos de su torneo desde el detalle de su
  // propio torneo, no desde este listado global.
  useEffect(() => { if (rol?.rol === 'organizador') navigate('/admin', { replace: true }) }, [rol])
  if (rol?.rol === 'organizador') return null

  async function fetchEquipos() {
    const { data } = await supabase.from('teams').select('*, tournament_player_registrations(id)').order('name')
    // Contar jugadores por equipo
    const { data: regs } = await supabase.from('tournament_player_registrations').select('team_id, player_id').eq('activo', true)
    const countMap = {}
    ;(regs || []).forEach(r => { countMap[r.team_id] = (countMap[r.team_id] || 0) + 1 })
    setEquipos((data || []).map(e => ({ ...e, num_jugadores: countMap[e.id] || 0 })))
  }

  function showMsgFn(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleSave() {
    if (!form.name) return showMsgFn('El nombre es obligatorio', 'error')
    // Todo equipo debe tener un DUEÑO identificado con cédula y teléfono
    if (!editId) {
      if (!(form.representante_nombre || '').trim())   return showMsgFn('El dueño/representante es obligatorio', 'error')
      if (!(form.representante_cedula || '').trim())   return showMsgFn('La cédula del dueño es obligatoria', 'error')
      if (!(form.representante_telefono || '').trim()) return showMsgFn('El teléfono del dueño es obligatorio', 'error')
    }
    // Al CREAR (no al editar): avisar si ya existe un equipo con nombre
    // parecido — duplicarlo hace que la historia quede huérfana en el viejo
    if (!editId) {
      const parecidos = await buscarEquiposParecidos(form.name)
      if (parecidos.length > 0) {
        const ok = window.confirm(
          `⚠️ YA EXISTE un equipo con nombre parecido:\n\n${parecidos.map(p => `• ${p.name}${p.city ? ` (${p.city})` : ''} — Dueño: ${p.representante_nombre || 'sin registrar'}`).join('\n')}\n\n` +
          `Si es el MISMO equipo, NO lo crees de nuevo: usa el existente para conservar su historia (partidos, palmarés, jugadores).\n\n` +
          `¿Es un equipo DISTINTO y quieres crearlo de todas formas?`
        )
        if (!ok) return
      }
    }
    setLoading(true)
    const payload = { name: form.name, city: form.city, genero: form.genero, modalidad: form.modalidad, descripcion: form.descripcion, logros: form.logros, representante_nombre: form.representante_nombre || null, representante_cedula: form.representante_cedula || null, representante_telefono: form.representante_telefono || null }
    // El DUEÑO solo lo puede modificar el admin principal: al editar, los
    // demás no envían esos campos (quedan como estaban)
    if (editId && !esPrincipal) {
      delete payload.representante_nombre
      delete payload.representante_cedula
      delete payload.representante_telefono
    }
    const guardar = async pl => editId
      ? supabase.from('teams').update(pl).eq('id', editId)
      : supabase.from('teams').insert(pl)
    let { error } = await guardar(payload)
    if (error && (error.message || '').includes('representante_cedula')) {
      // BD sin la migración de la cédula: guardar sin ella
      const { representante_cedula, ...sinCedula } = payload
      ;({ error } = await guardar(sinCedula))
    }
    if (error) showMsgFn(editId ? 'Error al guardar' : 'Error al crear', 'error')
    else { showMsgFn(editId ? 'Equipo actualizado ✓' : 'Equipo creado ✓'); setEditId(null) }
    setShowForm(false); setForm(EMPTY); setLoading(false); fetchEquipos()
  }

  async function handleLogo(equipo, file) {
    if (!file) return
    setUploading(equipo.id)
    const path = `logos/${equipo.id}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
      await supabase.from('teams').update({ logo_url: urlData.publicUrl }).eq('id', equipo.id)
      fetchEquipos()
    }
    setUploading(null)
  }

  const filtrados = equipos.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  return (
    <div>
      {msg && (
        <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:500, padding:'12px 20px', background: msg.type==='ok'?'#e6f4ea':'#fce8e6', color: msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
          {msg.text}
        </div>
      )}

      {uniforme && <ModalUniforme equipo={uniforme} onClose={() => setUniforme(null)} onSaved={() => { fetchEquipos(); setUniforme(null) }}/>}
      {poster   && <ModalPoster   equipo={poster}   onClose={() => setPoster(null)}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'1.25rem', fontWeight:'600', color:'#202124', margin:0 }}>Equipos</h1>
          <p style={{ color:'#5f6368', margin:'4px 0 0', fontSize:'.875rem' }}>{equipos.length} equipos registrados</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
          style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1a73e8', border:'none', borderRadius:'8px', padding:'9px 18px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600' }}>
          <Plus size={16}/> Agregar Equipo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div ref={formRef} style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:'600', color:'#202124', marginBottom:'16px' }}>{editId ? 'Editar equipo' : 'Nuevo equipo'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div style={{ gridColumn:'1/-1' }}><label style={labelStyle}>Nombre *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inputStyle} placeholder="Nombre del equipo"/></div>
            <div><label style={labelStyle}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inputStyle} placeholder="Ciudad"/></div>
            <div><label style={labelStyle}>Modalidad</label><select value={form.modalidad} onChange={e => setForm(f=>({...f,modalidad:e.target.value}))} style={inputStyle}><option value="">Seleccionar...</option>{MODALIDADES.map(m=><option key={m}>{m}</option>)}</select></div>
            <div><label style={labelStyle}>Género</label><select value={form.genero} onChange={e => setForm(f=>({...f,genero:e.target.value}))} style={inputStyle}><option value="">Seleccionar...</option>{GENEROS.map(g=><option key={g}>{g}</option>)}</select></div>
            <div>
              <label style={labelStyle}>Dueño / representante *</label>
              <input value={form.representante_nombre} onChange={e => setForm(f=>({...f,representante_nombre:e.target.value}))} style={{ ...inputStyle, opacity: editId && !esPrincipal ? .55 : 1 }} placeholder="Nombre completo" disabled={editId && !esPrincipal}/>
              {editId && !esPrincipal && <div style={{ fontSize: '.65rem', color: '#e8710a', marginTop: '3px' }}>🔒 Solo el admin principal puede cambiar el dueño</div>}
            </div>
            <div><label style={labelStyle}>Cédula del dueño *</label><input value={form.representante_cedula || ''} onChange={e => setForm(f=>({...f,representante_cedula:e.target.value}))} style={{ ...inputStyle, opacity: editId && !esPrincipal ? .55 : 1 }} placeholder="Número de cédula" type="number" disabled={editId && !esPrincipal}/></div>
            <div><label style={labelStyle}>Teléfono del dueño *</label><input value={form.representante_telefono} onChange={e => setForm(f=>({...f,representante_telefono:e.target.value}))} style={{ ...inputStyle, opacity: editId && !esPrincipal ? .55 : 1 }} placeholder="300 000 0000" type="tel" disabled={editId && !esPrincipal}/></div>
            <div style={{ gridColumn:'1/-1' }}><label style={labelStyle}>Descripción del equipo</label><textarea value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} style={{...inputStyle,height:'70px',resize:'vertical'}} placeholder="Historia, estilo de juego, descripción..."/></div>
            <div style={{ gridColumn:'1/-1' }}><label style={labelStyle}>Logros y palmarés</label><textarea value={form.logros} onChange={e => setForm(f=>({...f,logros:e.target.value}))} style={{...inputStyle,height:'60px',resize:'vertical'}} placeholder="Campeonatos, títulos, participaciones destacadas..."/></div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleSave} disabled={loading} style={{ padding:'8px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:loading?.7:1 }}>{loading?'Guardando...':editId?'Actualizar':'Crear equipo'}</button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setEditId(null) }} style={{ padding:'8px 20px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.875rem' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', alignItems:'center' }}>
        <div style={{ flex:1, position:'relative', maxWidth:'340px' }}>
          <Search size={16} color="#9aa0a6" style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar equipo..."
            style={{...inputStyle, paddingLeft:'34px'}}/>
        </div>
        <div style={{ fontSize:'.8rem', color:'#9aa0a6' }}>{filtrados.length} equipo{filtrados.length!==1?'s':''}</div>
      </div>

      {/* Lista */}
      <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#9aa0a6' }}>
            <Shield size={36} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>No hay equipos</div>
          </div>
        ) : filtrados.map((equipo, i) => (
          <div key={equipo.id} style={{ padding:'14px 20px', borderBottom: i<filtrados.length-1?'1px solid #f1f3f4':'none', display:'flex', alignItems:'center', gap:'14px' }}>
            {/* Logo */}
            <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => handleLogo(equipo, e.target.files[0])}/>
              <div style={{ width:'48px', height:'48px', borderRadius:'50%', overflow:'hidden', background:'#f1f3f4', border:'2px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {uploading===equipo.id ? (
                  <div style={{ fontSize:'.6rem', color:'#9aa0a6' }}>...</div>
                ) : equipo.logo_url ? (
                  <img src={equipo.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'4px' }}/>
                ) : (
                  <Shield size={20} color="#9aa0a6"/>
                )}
              </div>
              <div style={{ position:'absolute', bottom:0, right:0, width:'16px', height:'16px', background:'#1a73e8', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Upload size={8} color="#fff"/>
              </div>
            </label>

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{equipo.name}</div>
              <div style={{ fontSize:'.75rem', color:'#9aa0a6', marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {equipo.modalidad && <span style={{ color:'#1a73e8', fontWeight:'500' }}>{equipo.modalidad}</span>}
                {equipo.genero    && <span>{equipo.genero}</span>}
                {equipo.city      && <span>📍 {equipo.city}</span>}
                <span style={{ color:'#1a73e8' }}>
                  <Users size={11} style={{ display:'inline', marginRight:'2px' }}/>
                  {equipo.num_jugadores} jugadores
                </span>
                {equipo.logros    && <span style={{ color:'#f9a825' }}>🏆 {equipo.logros.substring(0,40)}{equipo.logros.length>40?'...':''}</span>}
              </div>
              <div style={{ fontSize:'.72rem', marginTop:'3px', fontWeight: '600', color: equipo.representante_nombre ? '#1a73e8' : '#d93025' }}>
                {equipo.representante_nombre ? `👤 Dueño: ${equipo.representante_nombre}` : '⚠️ Sin dueño registrado'}
                {equipo.created_at && <span style={{ color: '#9aa0a6', fontWeight: '400' }}> · 🗓️ Creado el {new Date(equipo.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
              </div>
            </div>

            {/* Indicadores */}
            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
              {equipo.uniforme_url     && <span title="Uniforme subido"    style={{ fontSize:'.7rem', background:'#e8f0fe', color:'#1a73e8', borderRadius:'20px', padding:'2px 8px' }}>👕</span>}
              {equipo.descripcion      && <span title="Con descripción"    style={{ fontSize:'.7rem', background:'#f3e8fd', color:'#9955ff', borderRadius:'20px', padding:'2px 8px' }}>📝</span>}
            </div>

            {/* Acciones */}
            <MenuAcciones
              equipo={equipo}
              onEdit={eq => { setForm({ name:eq.name, city:eq.city||'', genero:eq.genero||'', modalidad:eq.modalidad||'', descripcion:eq.descripcion||'', logros:eq.logros||'', representante_nombre:eq.representante_nombre||'', representante_telefono:eq.representante_telefono||'' }); setEditId(eq.id); setShowForm(true) }}
              onJugadores={eq => navigate(`/admin/equipos/${eq.id}`)}
              onUniforme={eq => setUniforme(eq)}
              onPoster={eq => setPoster(eq)}
              navigate={navigate}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
