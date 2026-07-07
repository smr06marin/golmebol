import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Upload, X, Shield } from 'lucide-react'

const EMPTY = { name: '', telefono: '', numero_cedula: '', city: '', genero: '' }
const inp = { width:'100%', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'8px 12px', color:'#202124', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#5f6368', display:'block', marginBottom:'4px' }

function ModalMembresia({ arbitro, onClose, onActivar }) {
  const [meses,   setMeses]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const yaTieneAuth = !!arbitro.user_id

  async function handleActivar() {
    setLoading(true); setError('')
    const err = await onActivar(arbitro, meses, yaTieneAuth)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'28px', width:'400px', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#202124', fontSize:'1rem' }}>
              {!yaTieneAuth ? 'Activar acceso' : arbitro.activo_membresia ? 'Renovar acceso' : 'Reactivar acceso'}
            </div>
            <div style={{ fontSize:'.8rem', color:'#5f6368', marginTop:'2px' }}>{arbitro.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={18}/></button>
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={lbl}>Meses de acceso</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[1,2,3,6,12].map(m => (
              <button key={m} onClick={() => setMeses(m)}
                style={{ flex:1, padding:'8px 4px', borderRadius:'8px', border:`1px solid ${meses===m?'#1a73e8':'#dadce0'}`, background: meses===m?'#1a73e8':'#fff', color: meses===m?'#fff':'#5f6368', cursor:'pointer', fontSize:'.8rem', fontWeight:'600' }}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        <div style={{ background:'#f8f9fa', borderRadius:'10px', padding:'12px 14px', marginBottom:'16px', fontSize:'.8rem', color:'#5f6368' }}>
          <div style={{ marginBottom:'4px' }}>📧 Email: <b>{arbitro.numero_cedula}@golmebol.com</b></div>
          <div>🔑 Contraseña inicial: <b>{arbitro.numero_cedula}</b></div>
        </div>
        {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'12px' }}>{error}</div>}
        <button onClick={handleActivar} disabled={loading}
          style={{ width:'100%', padding:'11px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
          {loading ? 'Procesando...' : !yaTieneAuth ? '✅ Activar acceso' : '🔄 Renovar'}
        </button>
      </div>
    </div>
  )
}

export default function AdminArbitrosPage() {
  const [arbitros,   setArbitros]   = useState([])
  const [form,       setForm]       = useState(EMPTY)
  const [editId,     setEditId]     = useState(null)
  const [showForm,   setShowForm]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [uploading,  setUploading]  = useState(null)
  const [msg,        setMsg]        = useState(null)
  const [search,     setSearch]     = useState('')
  const [modalMem,     setModalMem]     = useState(null)
  const [buscarJugador,setBuscarJugador] = useState(false)
  const [jugadoresTodos,setJugadoresTodos] = useState([])
  const [busqJug,      setBusqJug]      = useState('')

  useEffect(() => { fetchArbitros(); fetchJugadoresTodos() }, [])

  async function fetchJugadoresTodos() {
    const { data } = await supabase.from('players').select('id,name,numero_cedula,photo_url,photo_face_url,es_arbitro,rol').eq('rol', 'jugador').order('name')
    setJugadoresTodos(data || [])
  }

  async function handleMarcarArbitro(jugador) {
    await supabase.from('players').update({ es_arbitro: true }).eq('id', jugador.id)
    showMsgFn(`${jugador.name} marcado como árbitro ✓`)
    fetchArbitros(); fetchJugadoresTodos()
  }

  async function handleQuitarArbitro(jugador) {
    if (!confirm(`¿Quitar rol de árbitro a ${jugador.name}?`)) return
    await supabase.from('players').update({ es_arbitro: false }).eq('id', jugador.id)
    showMsgFn(`Rol de árbitro removido`)
    fetchArbitros()
  }

  async function fetchArbitros() {
    const { data } = await supabase.from('players').select('*').or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
    setArbitros(data || [])
  }

  function showMsgFn(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleSave() {
    if (!form.name)           return showMsgFn('El nombre es obligatorio', 'error')
    if (!form.numero_cedula)  return showMsgFn('La cédula es obligatoria', 'error')
    setLoading(true)
    const payload = { ...form, rol: 'arbitro', es_arbitro: true }
    if (editId) {
      const { error } = await supabase.from('players').update(payload).eq('id', editId)
      if (error) showMsgFn('Error al guardar', 'error')
      else { showMsgFn('Árbitro actualizado ✓'); setEditId(null) }
    } else {
      const { error } = await supabase.from('players').insert(payload)
      if (error) showMsgFn('Error al crear', 'error')
      else showMsgFn('Árbitro creado ✓')
    }
    setShowForm(false); setForm(EMPTY); setLoading(false); fetchArbitros()
  }

  async function handleFoto(arbitro, file) {
    if (!file) return
    setUploading(arbitro.id)
    const path = `fotos/${arbitro.id}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
      await supabase.from('players').update({ photo_url: urlData.publicUrl }).eq('id', arbitro.id)
      fetchArbitros()
    }
    setUploading(null)
  }

  async function handleActivarMembresia(arbitro, meses, yaTieneAuth) {
    const fechaVenc = (() => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.toISOString() })()
    const email     = `${arbitro.numero_cedula}@golmebol.com`
    try {
      let userId = arbitro.user_id
      if (!yaTieneAuth) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email, password: String(arbitro.numero_cedula),
          options: { data: { player_id: arbitro.id, cedula: arbitro.numero_cedula, rol: 'arbitro' } }
        })
        if (authError) return 'Error al crear cuenta: ' + authError.message
        if (!authData.user) return 'No se pudo crear la cuenta.'
        userId = authData.user.id
      }
      const { error: updError } = await supabase.from('players').update({
        user_id: userId, activo_membresia: true,
        fecha_pago: new Date().toISOString(), fecha_vencimiento: fechaVenc,
        meses_pagados: (arbitro.meses_pagados || 0) + meses, primer_ingreso: true,
      }).eq('id', arbitro.id)
      if (updError) return 'Error al activar: ' + updError.message
      showMsgFn(`✅ Acceso activado por ${meses} mes${meses > 1 ? 'es' : ''}`)
      setModalMem(null); fetchArbitros(); return null
    } catch(e) { return 'Error: ' + e.message }
  }

  async function handleDesactivar(arbitro) {
    if (!confirm(`¿Desactivar acceso de ${arbitro.name}?`)) return
    await supabase.from('players').update({ activo_membresia: false }).eq('id', arbitro.id)
    showMsgFn('Acceso desactivado'); fetchArbitros()
  }

  const filtrados = arbitros.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {msg && (
        <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background: msg.type==='ok'?'#e6f4ea':'#fce8e6', color: msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
          {msg.text}
        </div>
      )}

      {modalMem && <ModalMembresia arbitro={modalMem} onClose={() => setModalMem(null)} onActivar={handleActivarMembresia}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'1.25rem', fontWeight:'600', color:'#202124', margin:0 }}>Árbitros</h1>
          <p style={{ color:'#5f6368', margin:'4px 0 0', fontSize:'.875rem' }}>{arbitros.length} árbitros registrados</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={() => { setBuscarJugador(!buscarJugador) }}
            style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'1px solid #1a73e8', borderRadius:'8px', padding:'9px 18px', cursor:'pointer', color:'#1a73e8', fontSize:'.875rem', fontWeight:'600' }}>
            👤 Jugador existente
          </button>
          <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
          style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1a73e8', border:'none', borderRadius:'8px', padding:'9px 18px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600' }}>
          <Plus size={16}/> Árbitro nuevo
        </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:'600', color:'#202124', marginBottom:'16px' }}>{editId ? 'Editar árbitro' : 'Nuevo árbitro'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nombre completo *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre del árbitro"/></div>
            <div><label style={lbl}>Cédula *</label><input value={form.numero_cedula} onChange={e => setForm(f=>({...f,numero_cedula:e.target.value}))} style={inp} placeholder="Número de cédula"/></div>
            <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Teléfono"/></div>
            <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
            <div><label style={lbl}>Género</label><select value={form.genero} onChange={e => setForm(f=>({...f,genero:e.target.value}))} style={inp}><option value="">Seleccionar...</option><option>Masculino</option><option>Femenino</option></select></div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleSave} disabled={loading} style={{ padding:'8px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:loading?.7:1 }}>{loading?'Guardando...':editId?'Actualizar':'Crear árbitro'}</button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setEditId(null) }} style={{ padding:'8px 20px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.875rem' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel buscar jugador existente */}
      {buscarJugador && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:'600', color:'#202124', marginBottom:'12px' }}>Marcar jugador existente como árbitro</div>
          <input value={busqJug} onChange={e => setBusqJug(e.target.value)} placeholder="Buscar jugador..." style={{...inp, marginBottom:'12px'}}/>
          <div style={{ maxHeight:'280px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'6px' }}>
            {jugadoresTodos.filter(j => !j.es_arbitro && j.name.toLowerCase().includes(busqJug.toLowerCase())).map(j => (
              <div key={j.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#f8f9fa', borderRadius:'8px', border:'1px solid #e8eaed' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', background:'#f1f3f4', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {j.photo_face_url||j.photo_url ? <img src={j.photo_face_url||j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span>👤</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'600', fontSize:'.875rem', color:'#202124' }}>{j.name}</div>
                  <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>🪪 {j.numero_cedula}</div>
                </div>
                <button onClick={() => { handleMarcarArbitro(j); setBuscarJugador(false) }}
                  style={{ padding:'6px 14px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.8rem', fontWeight:'600' }}>
                  + Árbitro
                </button>
              </div>
            ))}
            {jugadoresTodos.filter(j => !j.es_arbitro && j.name.toLowerCase().includes(busqJug.toLowerCase())).length === 0 && (
              <div style={{ textAlign:'center', color:'#9aa0a6', padding:'20px', fontSize:'.875rem' }}>Sin jugadores</div>
            )}
          </div>
          <button onClick={() => setBuscarJugador(false)} style={{ marginTop:'12px', padding:'7px 16px', background:'#f1f3f4', border:'none', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.8rem' }}>Cerrar</button>
        </div>
      )}

      {/* Búsqueda */}
      <div style={{ marginBottom:'16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar árbitro..."
          style={{...inp, maxWidth:'340px'}}/>
      </div>

      {/* Lista */}
      <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#9aa0a6' }}>
            <Shield size={36} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>No hay árbitros registrados</div>
          </div>
        ) : filtrados.map((a, i) => {
          const dias = a.fecha_vencimiento ? Math.ceil((new Date(a.fecha_vencimiento) - new Date()) / 86400000) : null
          const activo = a.activo_membresia && dias !== null && dias > 0
          return (
            <div key={a.id} style={{ padding:'14px 20px', borderBottom: i<filtrados.length-1?'1px solid #f1f3f4':'none', display:'flex', alignItems:'center', gap:'14px' }}>
              {/* Foto */}
              <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => handleFoto(a, e.target.files[0])}/>
                <div style={{ width:'46px', height:'46px', borderRadius:'50%', overflow:'hidden', background:'#f1f3f4', border:'2px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {uploading===a.id ? <div style={{ fontSize:'.6rem', color:'#9aa0a6' }}>...</div>
                    : a.photo_face_url||a.photo_url ? <img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <span style={{ fontSize:'.9rem' }}>👤</span>}
                </div>
                <div style={{ position:'absolute', bottom:0, right:0, width:'16px', height:'16px', background:'#1a73e8', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Upload size={8} color="#fff"/>
                </div>
              </label>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124' }}>{a.name}</div>
                {a.es_arbitro && a.rol !== 'arbitro' && <span style={{ fontSize:'.65rem', color:'#9955ff', background:'#f3e8fd', borderRadius:'20px', padding:'1px 8px', fontWeight:'600' }}>Jugador+Árbitro</span>}
              </div>
                <div style={{ fontSize:'.75rem', color:'#9aa0a6', marginTop:'2px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {a.numero_cedula && <span>🪪 {a.numero_cedula}</span>}
                  {a.telefono      && <span>📞 {a.telefono}</span>}
                  {a.city          && <span>📍 {a.city}</span>}
                </div>
              </div>

              {/* Estado membresía */}
              <div style={{ textAlign:'center', flexShrink:0 }}>
                {!a.user_id ? (
                  <span style={{ fontSize:'.72rem', color:'#9aa0a6', background:'#f1f3f4', borderRadius:'6px', padding:'2px 8px' }}>Sin acceso</span>
                ) : activo ? (
                  <div>
                    <div style={{ fontSize:'.72rem', color:'#1e8e3e', fontWeight:'700' }}>✅ Activo</div>
                    <div style={{ fontSize:'.65rem', color:'#9aa0a6' }}>{dias}d restantes</div>
                  </div>
                ) : (
                  <span style={{ fontSize:'.72rem', color:'#d93025', background:'#fce8e6', borderRadius:'6px', padding:'2px 8px' }}>Vencido</span>
                )}
              </div>

              {/* Acciones */}
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => { setForm({ name:a.name, telefono:a.telefono||'', numero_cedula:a.numero_cedula||'', city:a.city||'', genero:a.genero||'' }); setEditId(a.id); setShowForm(true) }}
                  style={{ background:'none', border:'1px solid #dadce0', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#5f6368', fontSize:'.8rem' }}>✏️</button>
                <button onClick={() => setModalMem(a)}
                  style={{ background: activo?'none':'#1a73e8', border: activo?'1px solid #1a73e8':'none', borderRadius:'6px', padding:'5px 12px', cursor:'pointer', color: activo?'#1a73e8':'#fff', fontSize:'.8rem', fontWeight:'600' }}>
                  {!a.user_id ? 'Activar' : activo ? 'Renovar' : 'Reactivar'}
                </button>
                {activo && (
                  <button onClick={() => handleDesactivar(a)}
                    style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#d93025', fontSize:'.8rem' }}>Desactivar</button>
                )}
                {a.es_arbitro && a.rol !== 'arbitro' && (
                  <button onClick={() => handleQuitarArbitro(a)}
                    style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#d93025', fontSize:'.8rem' }}>Quitar rol</button>
                )}
                <button onClick={async () => {
                  await supabase.from('players').update({ es_arbitro_lider: !a.es_arbitro_lider }).eq('id', a.id)
                  showMsgFn(a.es_arbitro_lider ? 'Rol líder removido' : '👑 Marcado como árbitro líder ✓')
                  fetchArbitros()
                }} style={{ background: a.es_arbitro_lider?'rgba(249,168,37,.15)':'none', border:`1px solid ${a.es_arbitro_lider?'#f9a825':'#dadce0'}`, borderRadius:'6px', padding:'5px 8px', cursor:'pointer', color: a.es_arbitro_lider?'#f9a825':'#9aa0a6', fontSize:'.75rem' }} title={a.es_arbitro_lider?'Quitar rol líder':'Marcar como líder'}>
                  👑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
