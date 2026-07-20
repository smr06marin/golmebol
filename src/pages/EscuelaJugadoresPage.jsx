import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

const EMPTY = { name:'', fecha_nacimiento:'', numero_cedula:'', tipo_sangre:'', genero:'', telefono:'', acudiente_nombre:'', acudiente_telefono:'' }
const TIPOS_SANGRE = ['O+','O-','A+','A-','B+','B-','AB+','AB-']

function calcularEdad(fecha) {
  if (!fecha) return null
  const hoy = new Date(), nac = new Date(fecha)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

export default function EscuelaJugadoresPage() {
  const navigate = useNavigate()
  const [profesor,   setProfesor]   = useState(null)
  const [escuela,    setEscuela]    = useState(null)
  const [jugadores,  setJugadores]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [form,       setForm]       = useState(EMPTY)
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState('')
  const [fotoFrontal, setFotoFrontal] = useState(null)
  const [fotoTrasera, setFotoTrasera] = useState(null)
  const [search,     setSearch]     = useState('')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) { navigate('/jugador'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    setProfesor(p)

    const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
    setEscuela(esc || null)

    const { data: tp } = await supabase.from('team_players').select('*, players(*)').eq('team_id', p.escuela_id)
    const lista = (tp || []).map(t => t.players).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name))
    setJugadores(lista)
    setLoading(false)
  }

  const esCoordinador = !!profesor?.es_profesor_coordinador

  function cerrarForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY); setError('')
    setFotoFrontal(null); setFotoTrasera(null)
  }

  function abrirEditar(j) {
    setForm({
      name: j.name || '', fecha_nacimiento: j.fecha_nacimiento || '', numero_cedula: j.numero_cedula || '',
      tipo_sangre: j.tipo_sangre || '', genero: j.genero || '', telefono: j.telefono || '',
      acudiente_nombre: j.acudiente_nombre || '', acudiente_telefono: j.acudiente_telefono || '',
    })
    setEditId(j.id); setShowForm(true)
  }

  async function subirFotos(playerId) {
    const urls = {}
    if (fotoFrontal) {
      const ext = fotoFrontal.name.split('.').pop()
      const path = `${playerId}_frontal.${ext}`
      await supabase.storage.from('cedulas').upload(path, fotoFrontal, { upsert: true })
      const { data } = supabase.storage.from('cedulas').getPublicUrl(path)
      urls.cedula_frontal_url = data.publicUrl
    }
    if (fotoTrasera) {
      const ext = fotoTrasera.name.split('.').pop()
      const path = `${playerId}_trasera.${ext}`
      await supabase.storage.from('cedulas').upload(path, fotoTrasera, { upsert: true })
      const { data } = supabase.storage.from('cedulas').getPublicUrl(path)
      urls.cedula_trasera_url = data.publicUrl
    }
    if (Object.keys(urls).length > 0) await supabase.from('players').update(urls).eq('id', playerId)
  }

  async function handleGuardar() {
    setError('')
    if (!form.name.trim())             return setError('El nombre es obligatorio')
    if (!form.fecha_nacimiento)        return setError('La fecha de nacimiento es obligatoria')
    setGuardando(true)

    if (editId) {
      const { error: errUpd } = await supabase.from('players').update(form).eq('id', editId)
      if (errUpd) { setError('Error al guardar: ' + errUpd.message); setGuardando(false); return }
      await subirFotos(editId)
      setGuardando(false); cerrarForm(); fetchTodo()
      return
    }

    const tiJugador = form.numero_cedula.trim()
    if (tiJugador) {
      const { data: yaExiste } = await supabase.from('players').select('id').eq('numero_cedula', tiJugador).maybeSingle()
      if (yaExiste) { setError('Ya hay una persona registrada con ese número de documento.'); setGuardando(false); return }
    }

    const { data: nuevo, error: errIns } = await supabase.from('players')
      .insert({ ...form, es_jugador_escuela: !!tiJugador, activo_membresia: true, fecha_vencimiento: null, primer_ingreso: false, fecha_registro: new Date().toISOString() })
      .select().single()
    if (errIns || !nuevo) { setError('Error al crear: ' + (errIns?.message || '')); setGuardando(false); return }

    if (tiJugador) {
      const email = `${tiJugador}@golmebol.com`
      const { data: authData, error: errAuth } = await supabase.auth.signUp({
        email, password: tiJugador, options: { data: { player_id: nuevo.id, cedula: tiJugador } },
      })
      if (!errAuth && authData?.user) await supabase.from('players').update({ user_id: authData.user.id }).eq('id', nuevo.id)
    }

    await subirFotos(nuevo.id)
    const { error: errLink } = await supabase.from('team_players').insert({ team_id: escuela.id, player_id: nuevo.id, activo: true })
    setGuardando(false)
    if (errLink) { setError('El jugador se creó pero no se pudo vincular a la escuela: ' + errLink.message); return }
    cerrarForm(); fetchTodo()
  }

  const filtrados = jugadores.filter(j => j.name.toLowerCase().includes(search.toLowerCase()))

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
              <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>Jugadores</div>
              <div style={{ fontSize:'.72rem', color:S.muted }}>{escuela?.name}{escuela?.categoria ? ` · ${escuela.categoria}` : ''} · {jugadores.length} en la plantilla</div>
            </div>
            {esCoordinador && (
              <button onClick={() => { cerrarForm(); setShowForm(true) }}
                style={{ background:S.cyan, border:'none', borderRadius:'10px', padding:'9px 16px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.82rem' }}>
                + Jugador
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>

        {esCoordinador && escuela && (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px 16px', marginBottom:'18px' }}>
            <div style={{ fontWeight:700, fontSize:'.85rem', marginBottom:4 }}>📲 Link de registro para los acudientes</div>
            <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:10 }}>Envíaselo por WhatsApp — cada acudiente registra a su hijo/a y su cédula queda como acceso para ver la tarjeta después.</div>
            <button onClick={() => {
                const link = `${window.location.origin}/registro/escuela/${escuela.id}`
                const texto = `¡Hola! Regístrate como acudiente de tu hijo/a en ${escuela.name} en Golmebol: ${link}`
                window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
              }}
              style={{ width:'100%', padding:'10px', background:'#25D366', border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.8rem' }}>
              Compartir por WhatsApp
            </button>
          </div>
        )}

        {showForm && (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'18px', marginBottom:'18px' }}>
            <div style={{ fontWeight:'700', fontSize:'.95rem', marginBottom:'4px' }}>{editId ? 'Editar jugador' : 'Nuevo jugador'}</div>
            <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'14px' }}>
              {calcularEdad(form.fecha_nacimiento) !== null && calcularEdad(form.fecha_nacimiento) < 18
                ? 'Como es menor de edad, el número de documento es su Tarjeta de Identidad.'
                : 'Si ya es mayor de edad, el número de documento es su Cédula.'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nombre completo *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre del jugador"/></div>
              <div><label style={lbl}>Fecha de nacimiento *</label><input type="date" value={form.fecha_nacimiento} onChange={e => setForm(f=>({...f,fecha_nacimiento:e.target.value}))} style={inp}/></div>
              <div><label style={lbl}>Género</label><select value={form.genero} onChange={e => setForm(f=>({...f,genero:e.target.value}))} style={inp}><option value="">Seleccionar...</option><option>Masculino</option><option>Femenino</option></select></div>
              <div><label style={lbl}>{calcularEdad(form.fecha_nacimiento) !== null && calcularEdad(form.fecha_nacimiento) < 18 ? 'Tarjeta de identidad' : 'Cédula'}</label><input value={form.numero_cedula} onChange={e => setForm(f=>({...f,numero_cedula:e.target.value}))} style={inp} placeholder="Número de documento"/></div>
              <div><label style={lbl}>Tipo de sangre</label><select value={form.tipo_sangre} onChange={e => setForm(f=>({...f,tipo_sangre:e.target.value}))} style={inp}><option value="">Seleccionar...</option>{TIPOS_SANGRE.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Opcional"/></div>
              <div><label style={lbl}>Nombre del acudiente</label><input value={form.acudiente_nombre} onChange={e => setForm(f=>({...f,acudiente_nombre:e.target.value}))} style={inp} placeholder="Papá, mamá o acudiente"/></div>
              <div><label style={lbl}>Teléfono del acudiente</label><input value={form.acudiente_telefono} onChange={e => setForm(f=>({...f,acudiente_telefono:e.target.value}))} style={inp} placeholder="Teléfono de contacto"/></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
              <div>
                <label style={lbl}>Foto documento (frente)</label>
                <input type="file" accept="image/*" onChange={e => setFotoFrontal(e.target.files[0] || null)} style={{ ...inp, padding:'8px' }}/>
              </div>
              <div>
                <label style={lbl}>Foto documento (atrás)</label>
                <input type="file" accept="image/*" onChange={e => setFotoTrasera(e.target.files[0] || null)} style={{ ...inp, padding:'8px' }}/>
              </div>
            </div>
            {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'12px' }}>{error}</div>}
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={handleGuardar} disabled={guardando}
                style={{ flex:1, padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.85rem', opacity:guardando?.7:1 }}>
                {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear jugador'}
              </button>
              <button onClick={cerrarForm} style={{ padding:'11px 18px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>Cancelar</button>
            </div>
          </div>
        )}

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador..." style={{ ...inp, marginBottom:'14px' }}/>

        {filtrados.length === 0 ? (
          <div style={{ textAlign:'center', padding:'50px 20px', color:S.muted }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>👥</div>
            <div style={{ fontSize:'.85rem' }}>{jugadores.length === 0 ? 'Aún no hay jugadores en la escuela' : 'Sin resultados'}</div>
          </div>
        ) : filtrados.map(j => {
          const edad = calcularEdad(j.fecha_nacimiento)
          return (
            <div key={j.id} onClick={() => navigate(`/escuela/jugador/${j.id}`)} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'12px 16px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {j.photo_face_url || j.photo_url ? <img src={j.photo_face_url || j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span>👤</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:'700', fontSize:'.88rem' }}>{j.name}</div>
                <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {edad !== null && <span>{edad} años{edad < 18 ? ' · menor' : ''}</span>}
                  {j.numero_cedula && <span>🪪 {j.numero_cedula}</span>}
                  {j.acudiente_nombre && <span>👪 {j.acudiente_nombre}</span>}
                </div>
              </div>
              {esCoordinador && (
                <button onClick={e => { e.stopPropagation(); abrirEditar(j) }} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:S.muted, fontSize:'.78rem' }}>✏️</button>
              )}
              <span style={{ color:S.muted, fontSize:'.8rem' }}>→</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
