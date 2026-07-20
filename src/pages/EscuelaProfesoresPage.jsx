import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

const EMPTY = { name:'', telefono:'', city:'', genero:'' }

export default function EscuelaProfesoresPage() {
  const navigate = useNavigate()
  const [profesor,   setProfesor]   = useState(null)
  const [escuela,    setEscuela]    = useState(null)
  const [profesores, setProfesores] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [cedulaBuscar,      setCedulaBuscar]      = useState('')
  const [buscando,          setBuscando]          = useState(false)
  const [personaEncontrada, setPersonaEncontrada] = useState(null)
  const [mostrarCamposNuevo,setMostrarCamposNuevo]= useState(false)
  const [form,       setForm]       = useState(EMPTY)
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState('')
  const [msg,        setMsg]        = useState('')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) { navigate('/jugador'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    // Solo el coordinador puede administrar profesores.
    if (!p.es_profesor_coordinador) { navigate('/escuela'); return }
    setProfesor(p)

    const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
    setEscuela(esc || null)

    const { data: profs } = await supabase.from('players')
      .select('*').eq('escuela_id', p.escuela_id).or('rol.eq.profesor,es_profesor.eq.true').order('name')
    setProfesores(profs || [])
    setLoading(false)
  }

  function cerrarForm() {
    setShowForm(false); setCedulaBuscar(''); setPersonaEncontrada(null); setMostrarCamposNuevo(false)
    setForm(EMPTY); setError('')
  }

  function showMsgFn(text) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  async function handleBuscarCedula() {
    setError('')
    if (!cedulaBuscar.trim()) { setError('Ingresa la cédula'); return }
    setBuscando(true)
    setPersonaEncontrada(null); setMostrarCamposNuevo(false)
    const { data } = await supabase.from('players').select('*, escuela:escuela_id(name)').eq('numero_cedula', cedulaBuscar.trim()).maybeSingle()
    if (data) setPersonaEncontrada(data)
    else { setMostrarCamposNuevo(true); setForm(f => ({ ...f })) }
    setBuscando(false)
  }

  async function handleConfirmarPersonaEncontrada() {
    const existente = personaEncontrada
    if (existente.es_profesor && existente.escuela_id === escuela.id) {
      setError('Esta persona ya es profesor de tu escuela'); return
    }
    if (existente.escuela_id && existente.escuela_id !== escuela.id) {
      if (!confirm(`${existente.name} ya pertenece a "${existente.escuela?.name || 'otra escuela'}". ¿Moverlo/a a tu escuela de todos modos?`)) return
    }
    setGuardando(true)
    const { error: errUpd } = await supabase.from('players').update({
      es_profesor: true, escuela_id: escuela.id,
      activo_membresia: true, fecha_vencimiento: existente.rol === 'profesor' ? null : existente.fecha_vencimiento,
    }).eq('id', existente.id)
    setGuardando(false)
    if (errUpd) { setError('Error: ' + errUpd.message); return }
    showMsgFn(`${existente.name} agregado como profesor de ${escuela.name} ✓`)
    cerrarForm(); fetchTodo()
  }

  async function handleCrearProfesorNuevo() {
    setError('')
    if (!form.name.trim())     { setError('El nombre es obligatorio'); return }
    if (!cedulaBuscar.trim())  { setError('Falta la cédula'); return }
    setGuardando(true)
    const { error: errIns } = await supabase.from('players').insert({
      ...form, numero_cedula: cedulaBuscar.trim(), rol: 'profesor', es_profesor: true, escuela_id: escuela.id,
      activo_membresia: true, fecha_vencimiento: null, primer_ingreso: false,
    })
    setGuardando(false)
    if (errIns) { setError('Error al crear: ' + errIns.message); return }
    showMsgFn(`Profesor creado ✓ — ya puede entrar con su cédula en /jugador/login`)
    cerrarForm(); fetchTodo()
  }

  async function handleQuitar(p) {
    if (p.id === profesor.id) { alert('No te puedes quitar a ti mismo/a de la escuela'); return }
    if (!confirm(`¿Quitar a ${p.name} de la escuela?`)) return
    await supabase.from('players').update({ es_profesor: false, es_profesor_coordinador: false, escuela_id: null }).eq('id', p.id)
    showMsgFn('Profesor removido de la escuela')
    fetchTodo()
  }

  async function handleToggleCoordinador(p) {
    await supabase.from('players').update({ es_profesor_coordinador: !p.es_profesor_coordinador }).eq('id', p.id)
    showMsgFn(p.es_profesor_coordinador ? 'Ya no es coordinador/a' : `${p.name} ahora también es coordinador/a`)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escuela')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escuela</button>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>Profesores</div>
              <div style={{ fontSize:'.72rem', color:S.muted }}>{escuela?.name} · {profesores.length} profesor{profesores.length!==1?'es':''}</div>
            </div>
            <button onClick={() => { cerrarForm(); setShowForm(true) }}
              style={{ background:S.cyan, border:'none', borderRadius:'10px', padding:'9px 16px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.82rem' }}>
              + Profesor
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>

        {msg && (
          <div style={{ background:'rgba(0,221,208,.1)', border:`1px solid rgba(0,221,208,.3)`, borderRadius:'10px', padding:'10px 14px', marginBottom:'14px', fontSize:'.8rem', color:S.cyan }}>{msg}</div>
        )}

        {showForm && (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'18px', marginBottom:'18px' }}>
            {!personaEncontrada && !mostrarCamposNuevo && (
              <>
                <div style={{ fontWeight:'700', fontSize:'.95rem', marginBottom:'4px' }}>Nuevo profesor</div>
                <div style={{ fontSize:'.75rem', color:S.muted, marginBottom:'12px' }}>Primero escribe su cédula — así revisamos si ya está registrado en Golmebol.</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <input value={cedulaBuscar} onChange={e => setCedulaBuscar(e.target.value)} onKeyDown={e => e.key==='Enter' && handleBuscarCedula()} style={inp} placeholder="Número de cédula" autoFocus/>
                  <button onClick={handleBuscarCedula} disabled={buscando} style={{ padding:'10px 18px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'700', fontSize:'.82rem', flexShrink:0, opacity:buscando?.7:1 }}>{buscando?'Buscando...':'Buscar'}</button>
                </div>
              </>
            )}

            {personaEncontrada && (
              <>
                <div style={{ background:S.cyanDim, border:`1px solid rgba(0,221,208,.3)`, borderRadius:'10px', padding:'14px', marginBottom:'14px' }}>
                  <div style={{ fontSize:'.68rem', fontWeight:'700', color:S.cyan, marginBottom:'8px', letterSpacing:'.05em' }}>YA ESTÁ REGISTRADO EN GOLMEBOL</div>
                  <div style={{ fontWeight:'700' }}>{personaEncontrada.name}</div>
                  <div style={{ fontSize:'.75rem', color:S.text2, marginTop:'2px' }}>🪪 {personaEncontrada.numero_cedula}{personaEncontrada.escuela?.name ? ` · ya pertenece a ${personaEncontrada.escuela.name}` : ''}</div>
                </div>
                <div style={{ fontSize:'.82rem', marginBottom:'14px' }}>¿Agregar a <b>{personaEncontrada.name}</b> como profesor de <b>{escuela?.name}</b>?</div>
                {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'10px' }}>{error}</div>}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={handleConfirmarPersonaEncontrada} disabled={guardando} style={{ flex:1, padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.85rem', opacity:guardando?.7:1 }}>{guardando?'Guardando...':'✓ Sí, agregar'}</button>
                  <button onClick={() => { setPersonaEncontrada(null); setCedulaBuscar('') }} style={{ padding:'11px 16px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>Otra cédula</button>
                </div>
              </>
            )}

            {mostrarCamposNuevo && (
              <>
                <div style={{ fontWeight:'700', fontSize:'.95rem', marginBottom:'4px' }}>Nuevo profesor</div>
                <div style={{ fontSize:'.75rem', color:S.muted, marginBottom:'14px' }}>⚠️ No hay nadie con la cédula <b>{cedulaBuscar}</b>. Completa sus datos.</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
                  <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nombre completo *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre del profesor"/></div>
                  <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Teléfono"/></div>
                  <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
                  <div><label style={lbl}>Género</label><select value={form.genero} onChange={e => setForm(f=>({...f,genero:e.target.value}))} style={inp}><option value="">Seleccionar...</option><option>Masculino</option><option>Femenino</option></select></div>
                </div>
                {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'10px' }}>{error}</div>}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={handleCrearProfesorNuevo} disabled={guardando} style={{ flex:1, padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.85rem', opacity:guardando?.7:1 }}>{guardando?'Creando...':'Crear profesor'}</button>
                  <button onClick={cerrarForm} style={{ padding:'11px 16px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>Cancelar</button>
                </div>
              </>
            )}

            {!personaEncontrada && !mostrarCamposNuevo && (
              <button onClick={cerrarForm} style={{ marginTop:'12px', background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:'.78rem' }}>Cancelar</button>
            )}
          </div>
        )}

        {profesores.length === 0 ? (
          <div style={{ textAlign:'center', padding:'50px 20px', color:S.muted }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>🧑‍🏫</div>
            <div style={{ fontSize:'.85rem' }}>Todavía eres el único profesor de la escuela</div>
          </div>
        ) : profesores.map(p => (
          <div key={p.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'12px 16px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {p.photo_face_url || p.photo_url ? <img src={p.photo_face_url || p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span>👤</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                <div style={{ fontWeight:'700', fontSize:'.88rem' }}>{p.name}{p.id === profesor.id ? ' (tú)' : ''}</div>
                {p.es_profesor_coordinador && <span style={{ fontSize:'.62rem', color:S.gold, background:'rgba(249,168,37,.15)', borderRadius:'20px', padding:'1px 8px', fontWeight:'700' }}>👑 Coordinador</span>}
              </div>
              <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {p.numero_cedula && <span>🪪 {p.numero_cedula}</span>}
                {p.telefono && <span>📞 {p.telefono}</span>}
                <span>{p.user_id ? '✅ con acceso' : '⏳ falta crear contraseña'}</span>
              </div>
            </div>
            {p.id !== profesor.id && (
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => handleToggleCoordinador(p)}
                  style={{ background: p.es_profesor_coordinador?'rgba(249,168,37,.15)':'none', border:`1px solid ${p.es_profesor_coordinador?'#f9a825':S.border}`, borderRadius:'8px', padding:'5px 8px', cursor:'pointer', color: p.es_profesor_coordinador?S.gold:S.muted, fontSize:'.75rem' }}
                  title="Marcar/quitar como coordinador">👑</button>
                <button onClick={() => handleQuitar(p)}
                  style={{ background:'none', border:'1px solid rgba(217,48,37,.4)', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', color:'#ff6b6b', fontSize:'.75rem' }}>Quitar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
