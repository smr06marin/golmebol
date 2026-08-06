import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getHours, slotEstado, todayStr, fmtDate, precioCancha, nombreCancha } from '../lib/escenarioHelpers'
import { X } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', warn: '#e8710a', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }

function ModalReserva({ escenario, canchas, cancha, fecha, hora, onClose, onGuardado }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [equipo, setEquipo] = useState('')
  const [duracion, setDuracion] = useState(60)
  const [recurrente, setRecurrente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Nombre y teléfono son obligatorios'); return }
    setGuardando(true); setError('')
    const monto = precioCancha(canchas, cancha)
    const { error: errIns } = await supabase.from('escenario_reservas').insert({
      escenario_id: escenario.id, cancha, fecha, hora, duracion,
      nombre: nombre.trim(), telefono: telefono.trim(), equipo: equipo.trim() || null,
      estado: 'aceptada', pago: 'pendiente', monto, monto_pagado: 0, recurrente,
    })
    setGuardando(false)
    if (errIns) { setError('Error al reservar: ' + errIns.message); return }
    onGuardado()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <div style={{ fontWeight:800, fontSize:'1rem' }}>Reservar {nombreCancha(canchas, cancha)}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
        </div>
        <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>{fmtDate(fecha)} — {hora}</div>
        <div style={{ marginBottom:'12px' }}><label style={lbl}>Nombre</label><input value={nombre} onChange={e=>setNombre(e.target.value)} style={inp} placeholder="Nombre"/></div>
        <div style={{ marginBottom:'12px' }}><label style={lbl}>Teléfono</label><input value={telefono} onChange={e=>setTelefono(e.target.value)} style={inp} placeholder="3001234567"/></div>
        <div style={{ marginBottom:'12px' }}><label style={lbl}>Equipo (opcional)</label><input value={equipo} onChange={e=>setEquipo(e.target.value)} style={inp} placeholder="Nombre del equipo"/></div>
        <div style={{ marginBottom:'12px' }}>
          <label style={lbl}>Duración</label>
          <select value={duracion} onChange={e=>setDuracion(parseInt(e.target.value))} style={inp}>
            <option value={60}>1 hora</option><option value={90}>1.5 horas</option><option value={120}>2 horas</option>
          </select>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'.8rem', color:S.text2, marginBottom:'16px' }}>
          <input type="checkbox" checked={recurrente} onChange={e=>setRecurrente(e.target.checked)}/> Repetir todas las semanas (8 semanas)
        </label>
        {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'12px' }}>{error}</div>}
        <button onClick={handleReservar} disabled={guardando}
          style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem', opacity:guardando?.7:1 }}>
          {guardando ? 'Guardando...' : 'Reservar'}
        </button>
      </div>
    </div>
  )
}

export default function EscenarioCanchasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [canchas,   setCanchas]   = useState([])
  const [reservas,  setReservas]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [cancha,    setCancha]    = useState(null)
  const [fecha,     setFecha]     = useState(todayStr())
  const [modalSlot, setModalSlot] = useState(null)
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
    setEncargado(p)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    const { data: cs } = await supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true).order('orden')
    setCanchas(cs || [])
    setCancha(prev => prev || (cs && cs[0] ? cs[0].slug : null))
    const { data: rsvs } = await supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId)
    setReservas(rsvs || [])
    setLoading(false)
  }

  function abrir(cancha, fecha, hora) { setModalSlot({ cancha, fecha, hora }) }
  function guardado() { setModalSlot(null); setMsg('✅ Reserva registrada'); setTimeout(()=>setMsg(''),3000); fetchTodo() }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const horas = escenario ? getHours(escenario) : []

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {modalSlot && (
        <ModalReserva escenario={escenario} canchas={canchas} cancha={modalSlot.cancha} fecha={modalSlot.fecha} hora={modalSlot.hora}
          onClose={()=>setModalSlot(null)} onGuardado={guardado}/>
      )}

      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>⚽ Canchas</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap' }}>
          {canchas.map(c => (
            <button key={c.id} onClick={()=>setCancha(c.slug)}
              style={{ flex:'1 1 auto', padding:'10px', borderRadius:'10px', border:'none', cursor:'pointer', fontWeight:800, fontSize:'.82rem', background: cancha===c.slug?S.cyan:S.card, color: cancha===c.slug?'#000':S.muted }}>
              {c.nombre}
            </button>
          ))}
          {canchas.length === 0 && <div style={{ fontSize:'.8rem', color:S.muted }}>No hay canchas creadas — agrégalas en Configuración.</div>}
        </div>
        <div style={{ marginBottom:'14px' }}>
          <label style={lbl}>Fecha</label>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {horas.map(h => {
            const est = slotEstado(reservas, cancha, fecha, h)
            const label = est==='libre' ? '🟢 Disponible' : est==='pendiente' ? '🟡 Solicitud pendiente' : '🔴 Ocupado'
            const color = est==='libre' ? S.win : est==='pendiente' ? S.warn : S.loss
            return (
              <div key={h} onClick={() => est==='libre' && abrir(cancha, fecha, h)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', cursor: est==='libre'?'pointer':'default' }}>
                <span style={{ fontWeight:700, fontSize:'.85rem' }}>{h}</span>
                <span style={{ fontSize:'.78rem', color, fontWeight:600 }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
