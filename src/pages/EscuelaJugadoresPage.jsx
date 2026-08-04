import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { comprimirImagen } from '../lib/imageCompress'
import { ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, MessageCircle, CreditCard, Users, Pencil, Shield, Circle } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,.14)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

const EMPTY = { name:'', fecha_nacimiento:'', numero_cedula:'', tipo_sangre:'', genero:'', telefono:'', acudiente_nombre:'', acudiente_telefono:'', posicion:'', pie_dominante:'', anios_jugando:'' }
const TIPOS_SANGRE = ['O+','O-','A+','A-','B+','B-','AB+','AB-']
const POSICIONES = ['Portero','Defensa','Mediocampista','Delantero','Cierre','Ala','Pívot']

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
      posicion: j.posicion || '', pie_dominante: j.pie_dominante || '', anios_jugando: j.anios_jugando ?? '',
    })
    setEditId(j.id); setShowForm(true)
  }

  async function subirFotos(playerId) {
    const urls = {}
    if (fotoFrontal) {
      // Más resolución que una foto de perfil (1600px) para que el número
      // de cédula siga siendo legible después de comprimir.
      const archivo = await comprimirImagen(fotoFrontal, { maxSize: 1600, calidad: 0.85 })
      const ext = archivo.name.split('.').pop()
      const path = `${playerId}_frontal.${ext}`
      await supabase.storage.from('cedulas').upload(path, archivo, { upsert: true })
      const { data } = supabase.storage.from('cedulas').getPublicUrl(path)
      urls.cedula_frontal_url = data.publicUrl
    }
    if (fotoTrasera) {
      const archivo = await comprimirImagen(fotoTrasera, { maxSize: 1600, calidad: 0.85 })
      const ext = archivo.name.split('.').pop()
      const path = `${playerId}_trasera.${ext}`
      await supabase.storage.from('cedulas').upload(path, archivo, { upsert: true })
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

    const payload = { ...form, anios_jugando: form.anios_jugando === '' ? null : Number(form.anios_jugando), pie_dominante: form.pie_dominante || null, posicion: form.posicion || null }

    if (editId) {
      const { error: errUpd } = await supabase.from('players').update(payload).eq('id', editId)
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
      .insert({ ...payload, es_jugador_escuela: !!tiJugador, activo_membresia: true, fecha_vencimiento: null, primer_ingreso: false, fecha_registro: new Date().toISOString() })
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
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.green, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ padding:'16px 16px 4px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', display:'flex', alignItems:'flex-start', gap:'12px', flexWrap:'wrap' }}>
          <button onClick={() => navigate('/escuela')} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, padding:'4px 0', flexShrink:0, display:'flex' }}>
            <ChevronLeft size={24}/>
          </button>
          <div style={{ width:'52px', height:'52px', borderRadius:'10px', overflow:'hidden', flexShrink:0, background:S.card2, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {escuela?.logo_url ? <img src={escuela.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={24} color={S.muted}/>}
          </div>
          <div style={{ flex:1, minWidth:'160px' }}>
            <div style={{ fontSize:'.68rem', fontWeight:'800', color:S.green, letterSpacing:'.07em', textTransform:'uppercase' }}>{escuela?.name}</div>
            <div style={{ fontSize:'1.5rem', fontWeight:'900', color:'#fff', lineHeight:1.05, marginTop:'2px', letterSpacing:'.01em' }}>JUGADORES</div>
            <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'5px', display:'flex', alignItems:'center', gap:'6px' }}>
              <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:S.green, display:'inline-block', flexShrink:0 }}/>
              {escuela?.categoria || 'Libre'} · {jugadores.length} en la plantilla
            </div>
          </div>
          {esCoordinador && (
            <button onClick={() => { cerrarForm(); setShowForm(true) }}
              style={{ display:'flex', alignItems:'center', gap:'6px', background:S.green, border:'none', borderRadius:'12px', padding:'11px 16px', cursor:'pointer', color:'#07240f', fontWeight:'900', fontSize:'.72rem', letterSpacing:'.02em', whiteSpace:'nowrap', flexShrink:0 }}>
              <Plus size={15} strokeWidth={3}/> AGREGAR JUGADOR
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>

        {esCoordinador && escuela && (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'16px', marginBottom:'18px', display:'flex', gap:'12px', alignItems:'flex-start' }}>
            <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:S.greenDim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <MessageCircle size={18} color={S.green}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:'.86rem', color:'#fff', marginBottom:4 }}>Link de registro para los acudientes</div>
              <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:12, lineHeight:1.4 }}>Envíalo por WhatsApp — cada acudiente registra a su hijo/a y su cédula queda como acceso para ver la tarjeta después.</div>
              <button onClick={() => {
                  const link = `${window.location.origin}/registro/escuela/${escuela.id}`
                  const texto = `¡Hola! Regístrate como acudiente de tu hijo/a en ${escuela.name} en Golmebol: ${link}`
                  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
                }}
                style={{ width:'100%', padding:'12px', background:S.green, border:'none', borderRadius:'12px', cursor:'pointer', color:'#07240f', fontWeight:900, fontSize:'.78rem', letterSpacing:'.02em', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                COMPARTIR POR WHATSAPP <FaWhatsapp size={16}/>
              </button>
            </div>
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
              <div><label style={lbl}>Posición</label><select value={form.posicion} onChange={e => setForm(f=>({...f,posicion:e.target.value}))} style={inp}><option value="">Seleccionar...</option>{POSICIONES.map(p => <option key={p}>{p}</option>)}</select></div>
              <div><label style={lbl}>Pie dominante</label><select value={form.pie_dominante} onChange={e => setForm(f=>({...f,pie_dominante:e.target.value}))} style={inp}><option value="">Seleccionar...</option><option value="derecho">Derecho</option><option value="izquierdo">Izquierdo</option><option value="ambidiestro">Ambidiestro</option></select></div>
              <div><label style={lbl}>Años jugando fútbol</label><input type="number" min="0" step="0.5" value={form.anios_jugando} onChange={e => setForm(f=>({...f,anios_jugando:e.target.value}))} style={inp} placeholder="Ej: 2"/></div>
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
                style={{ flex:1, padding:'11px', background:S.green, border:'none', borderRadius:'10px', cursor:'pointer', color:'#07240f', fontWeight:'800', fontSize:'.85rem', opacity:guardando?.7:1 }}>
                {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear jugador'}
              </button>
              <button onClick={cerrarForm} style={{ padding:'11px 18px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={15} color={S.muted} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador..." style={{ ...inp, paddingLeft:'34px' }}/>
          </div>
          <button title="Filtros" style={{ width:'42px', flexShrink:0, background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, cursor:'pointer' }}>
            <SlidersHorizontal size={15}/>
          </button>
        </div>

        {filtrados.length === 0 ? (
          <div style={{ textAlign:'center', padding:'50px 20px', color:S.muted }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>👥</div>
            <div style={{ fontSize:'.85rem' }}>{jugadores.length === 0 ? 'Aún no hay jugadores en la escuela' : 'Sin resultados'}</div>
          </div>
        ) : filtrados.map((j, i) => {
          const edad = calcularEdad(j.fecha_nacimiento)
          return (
            <div key={j.id} onClick={() => navigate(`/escuela/jugador/${j.id}`)}
              style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'14px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }}>
              <div style={{ fontSize:'1.4rem', fontWeight:'900', color:'#fff', width:'24px', textAlign:'center', flexShrink:0 }}>{i + 1}</div>
              <div style={{ width:'62px', height:'62px', borderRadius:'12px', overflow:'hidden', flexShrink:0, background:S.card2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {j.photo_face_url || j.photo_url ? <img src={j.photo_face_url || j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.5rem' }}>👤</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                  <div style={{ fontWeight:'900', fontSize:'.84rem', color:'#fff', lineHeight:1.25, textTransform:'uppercase' }}>{j.name}</div>
                  {j.posicion && (
                    <span style={{ flexShrink:0, fontSize:'.6rem', fontWeight:'700', color:S.green, border:`1px solid ${S.green}66`, borderRadius:'20px', padding:'2px 9px', whiteSpace:'nowrap' }}>{j.posicion}</span>
                  )}
                </div>
                <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'5px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  {edad !== null && <span>{edad} años{edad < 18 ? ' · Menor' : ''}</span>}
                  {j.posicion && <span style={{ display:'flex', alignItems:'center', gap:'4px', color:S.green, fontWeight:'700' }}><Circle size={6} fill={S.green} color={S.green}/> {j.posicion}</span>}
                </div>
                <div style={{ fontSize:'.66rem', color:S.muted, marginTop:'4px', display:'flex', flexDirection:'column', gap:'3px' }}>
                  {j.numero_cedula && <span style={{ display:'flex', alignItems:'center', gap:'5px' }}><CreditCard size={11}/> {j.numero_cedula}</span>}
                  {j.acudiente_nombre && <span style={{ display:'flex', alignItems:'center', gap:'5px' }}><Users size={11}/> {j.acudiente_nombre}</span>}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', flexShrink:0 }}>
                {esCoordinador && (
                  <button onClick={e => { e.stopPropagation(); abrirEditar(j) }}
                    style={{ width:'32px', height:'32px', borderRadius:'50%', background:'none', border:`1.5px solid ${S.green}88`, cursor:'pointer', color:S.green, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Pencil size={13}/>
                  </button>
                )}
                <ChevronRight size={16} color={S.muted}/>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
