import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getHours, nombreCancha, fmtMoney, DIAS_SEMANA, asegurarReservasFijas, todayStr } from '../lib/escenarioHelpers'
import { fmtHora12 } from '../lib/horaHelpers'
import { Plus, RotateCcw, Trash2, Pencil, X } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }
const card = { background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'16px' }

export default function EscenarioReservasFijasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [canchas,   setCanchas]   = useState([])
  const [fijas,     setFijas]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState('')
  const [guardando, setGuardando] = useState(false)
  const vacio = { cancha:'', dia_semana:1, hora:'', duracion:60, nombre:'', telefono:'', equipo:'', monto:'' }
  const [form, setForm] = useState(vacio)
  const [editId, setEditId] = useState(null) // id de la fija que se está editando, o null si es "nuevo"
  const [soloLectura, setSoloLectura] = useState(false)

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
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    const { data: cs } = await supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true).order('orden')
    setCanchas(cs || [])
    if (!form.cancha && cs && cs[0]) setForm(f => ({ ...f, cancha: cs[0].slug, hora: (esc && getHours(esc)[0]) || '08:00' }))
    const { data: fs } = await supabase.from('escenario_reservas_fijas').select('*').eq('escenario_id', escenarioId).order('created_at', { ascending: false })
    setFijas(fs || [])
    setLoading(false)
  }

  function abrirEditar(f) {
    setEditId(f.id)
    setForm({
      cancha: f.cancha, dia_semana: f.dia_semana, hora: f.hora, duracion: f.duracion,
      nombre: f.nombre || '', telefono: f.telefono || '', equipo: f.equipo || '', monto: f.monto ?? '',
    })
    setMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicion() {
    setEditId(null)
    setForm(f => ({ ...vacio, cancha: f.cancha, hora: f.hora }))
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.cancha || !form.hora) { setMsg('Completa cancha, día, hora y nombre del cliente'); return }
    setGuardando(true); setMsg('')
    const payload = {
      escenario_id: escenarioId, cancha: form.cancha, dia_semana: Number(form.dia_semana), hora: form.hora,
      duracion: Number(form.duracion) || 60, nombre: form.nombre.trim(), telefono: form.telefono.trim() || null,
      equipo: form.equipo.trim() || null, monto: Number(form.monto) || 0,
    }

    if (editId) {
      const { error } = await supabase.from('escenario_reservas_fijas').update(payload).eq('id', editId)
      if (error) { setGuardando(false); setMsg('Error al guardar: ' + error.message); return }
      // Como cambió el día/hora/cancha (o cualquier dato), las ocurrencias
      // futuras que ya se habían generado con los datos viejos quedan
      // desactualizadas — se borran (solo las que todavía no pasaron) y se
      // vuelven a generar ya con los datos nuevos.
      await supabase.from('escenario_reservas').delete()
        .eq('reserva_fija_id', editId).eq('estado', 'aceptada').gte('fecha', todayStr())
      await asegurarReservasFijas(escenarioId)
      setGuardando(false)
      setEditId(null)
      setForm(f => ({ ...vacio, cancha: f.cancha, hora: f.hora }))
      setMsg('✅ Horario fijo actualizado — se reprogramaron las próximas fechas'); setTimeout(()=>setMsg(''),4000)
      fetchTodo()
      return
    }

    const { error } = await supabase.from('escenario_reservas_fijas').insert({ ...payload, activa: true })
    if (!error) await asegurarReservasFijas(escenarioId)
    setGuardando(false)
    if (error) { setMsg('Error al crear: ' + error.message); return }
    setForm(f => ({ ...vacio, cancha: f.cancha, hora: f.hora }))
    setMsg('✅ Horario fijo creado — se mantendrá reservado indefinidamente hasta que lo desactives'); setTimeout(()=>setMsg(''),4000)
    fetchTodo()
  }

  async function toggle(f) {
    await supabase.from('escenario_reservas_fijas').update({ activa: !f.activa }).eq('id', f.id)
    if (!f.activa) await asegurarReservasFijas(escenarioId)
    fetchTodo()
  }

  async function eliminar(f) {
    if (!window.confirm(`¿Eliminar "${f.nombre}" (${DIAS_SEMANA[f.dia_semana]} ${fmtHora12(f.hora)}) definitivamente?\n\nEsto no se puede deshacer. Las reservas que ya se generaron con este horario fijo no se borran, solo dejan de estar vinculadas a él.`)) return
    const { error } = await supabase.from('escenario_reservas_fijas').delete().eq('id', f.id)
    if (error) { setMsg('❌ ' + error.message); return }
    setMsg('✅ Horario fijo eliminado'); setTimeout(()=>setMsg(''),4000)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const horas = escenario ? getHours(escenario) : []

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>🔁 Reservas fijas</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background: msg.startsWith('✅')?S.cyanDim:'rgba(217,48,37,.12)', color: msg.startsWith('✅')?S.cyan:'#ff6b6b', borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        {!soloLectura && (
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
            <div style={{ fontWeight:800, fontSize:'.9rem' }}>{editId ? 'Editar horario fijo' : 'Nuevo horario fijo'}</div>
            {editId && <button onClick={cancelarEdicion} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={16}/></button>}
          </div>
          <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'14px' }}>
            {editId
              ? 'Al guardar, las próximas fechas ya generadas con los datos anteriores se reprogramarán con los nuevos.'
              : <>Un cliente que juega siempre el mismo día y hora — queda reservado <b>para siempre</b>, semana tras semana, sin que tengas que hacer nada. Solo se detiene cuando lo desactivás manualmente.</>}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div>
              <label style={lbl}>Cancha</label>
              <select value={form.cancha} onChange={e=>setForm(f=>({...f,cancha:e.target.value}))} style={inp}>
                {canchas.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Día de la semana</label>
              <select value={form.dia_semana} onChange={e=>setForm(f=>({...f,dia_semana:e.target.value}))} style={inp}>
                {DIAS_SEMANA.map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Hora</label>
              <select value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} style={inp}>
                {horas.map(h => <option key={h} value={h}>{fmtHora12(h)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Duración</label>
              <select value={form.duracion} onChange={e=>setForm(f=>({...f,duracion:e.target.value}))} style={inp}>
                <option value={60}>1 hora</option><option value={90}>1.5 horas</option><option value={120}>2 horas</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Nombre del cliente</label><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} style={inp} placeholder="Nombre"/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="3001234567"/></div>
            <div><label style={lbl}>Monto por sesión</label><input type="number" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))} style={inp} placeholder="$"/></div>
          </div>
          <div style={{ marginBottom:'14px' }}><label style={lbl}>Equipo (opcional)</label><input value={form.equipo} onChange={e=>setForm(f=>({...f,equipo:e.target.value}))} style={inp}/></div>

          <button onClick={guardar} disabled={guardando}
            style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity:guardando?.7:1 }}>
            <Plus size={15}/> {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear horario fijo'}
          </button>
        </div>
        )}

        <div style={{...card, marginBottom:0}}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Horarios fijos activos</div>
          {fijas.length === 0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Todavía no tienes horarios fijos.</div> : fijas.map(f => (
            <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:`1px solid ${S.border}`, opacity: f.activa ? 1 : .5 }}>
              <div>
                <div style={{ fontSize:'.85rem', fontWeight:700 }}>{f.nombre}</div>
                <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>
                  {DIAS_SEMANA[f.dia_semana]} {fmtHora12(f.hora)} · {nombreCancha(canchas, f.cancha)} · {fmtMoney(f.monto)}
                  {!f.activa && ' · inactivo'}
                </div>
              </div>
              {!soloLectura && (
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button onClick={()=>abrirEditar(f)} title="Editar"
                    style={{ width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:S.text2 }}>
                    <Pencil size={13}/>
                  </button>
                  <button onClick={()=>toggle(f)} title={f.activa ? 'Desactivar' : 'Reactivar'}
                    style={{ width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color: f.activa ? '#ff6b6b' : S.cyan }}>
                    {f.activa ? <Trash2 size={13}/> : <RotateCcw size={13}/>}
                  </button>
                  <button onClick={()=>eliminar(f)} title="Eliminar definitivamente"
                    style={{ width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:'#ff6b6b' }}>
                    <X size={15}/>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
