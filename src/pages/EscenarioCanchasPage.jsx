import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getHours, slotEstado, todayStr, fmtDate, fmtMoney, precioCancha, nombreCancha, asegurarReservasFijasThrottled, proximosDias, obtenerAccesoEscenario } from '../lib/escenarioHelpers'
import { fmtHora12 } from '../lib/horaHelpers'
import { X } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', warn: '#e8710a', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }

// Cuando el horario ya tiene una solicitud pendiente, es porque el cliente
// ya llenó sus datos desde la página pública — acá no se le vuelven a pedir,
// solo se muestran para revisar y aceptar/rechazar con un click.
function ModalRevisar({ reserva, canchas, encargado, soloLectura, onClose, onResuelto }) {
  const [procesando, setProcesando] = useState(false)

  async function aceptar() {
    setProcesando(true)
    let { error } = await supabase.from('escenario_reservas')
      .update({ estado:'aceptada', aceptada_por: encargado?.id || null, aceptada_por_nombre: encargado?.name || null })
      .eq('id', reserva.id)
    if (error && error.message?.includes('aceptada_por')) {
      ;({ error } = await supabase.from('escenario_reservas').update({ estado:'aceptada' }).eq('id', reserva.id))
    }
    setProcesando(false)
    onResuelto(error ? 'Error al aceptar: ' + error.message : '✅ Reserva aceptada')
  }

  async function rechazar() {
    setProcesando(true)
    const { error } = await supabase.from('escenario_reservas').update({ estado:'rechazada' }).eq('id', reserva.id)
    setProcesando(false)
    onResuelto(error ? 'Error al rechazar: ' + error.message : 'Solicitud rechazada')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <div style={{ fontWeight:800, fontSize:'1rem' }}>Solicitud pendiente</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
        </div>
        <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>{nombreCancha(canchas, reserva.cancha)} · {fmtDate(reserva.fecha)} — {fmtHora12(reserva.hora)}</div>
        <div style={{ background:S.card2, borderRadius:'10px', padding:'14px', marginBottom:'18px' }}>
          <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Datos ya enviados por el cliente</div>
          <div style={{ fontSize:'.88rem', fontWeight:700, marginBottom:'4px' }}>{reserva.nombre}</div>
          {reserva.telefono && <div style={{ fontSize:'.8rem', color:S.text2 }}>{reserva.telefono}</div>}
          {reserva.equipo && <div style={{ fontSize:'.8rem', color:S.text2 }}>Equipo: {reserva.equipo}</div>}
          <div style={{ fontSize:'.8rem', color:S.text2 }}>Duración: {reserva.duracion} min</div>
        </div>
        {soloLectura ? (
          <div style={{ fontSize:'.76rem', color:S.muted, textAlign:'center' }}>👁️ Modo solo lectura — no podés aceptar ni rechazar.</div>
        ) : (
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={rechazar} disabled={procesando} style={{ flex:1, padding:'12px', background:'none', border:`1px solid ${S.loss}`, borderRadius:'10px', cursor:'pointer', color:S.loss, fontWeight:700, fontSize:'.85rem', opacity:procesando?.7:1 }}>Rechazar</button>
            <button onClick={aceptar} disabled={procesando} style={{ flex:1, padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem', opacity:procesando?.7:1 }}>
              {procesando ? '...' : 'Aceptar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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

  async function handleBloquear() {
    setGuardando(true); setError('')
    const { error: errIns } = await supabase.from('escenario_reservas').insert({
      escenario_id: escenario.id, cancha, fecha, hora, duracion: 60,
      nombre: 'Mantenimiento', telefono: '', equipo: '', estado: 'mantenimiento', pago: 'pagado', monto: 0,
    })
    setGuardando(false)
    if (errIns) { setError('Error al bloquear: ' + errIns.message); return }
    onGuardado()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <div style={{ fontWeight:800, fontSize:'1rem' }}>Reservar {nombreCancha(canchas, cancha)}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
        </div>
        <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>{fmtDate(fecha)} — {fmtHora12(hora)}</div>
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
        <button onClick={handleBloquear} disabled={guardando}
          style={{ width:'100%', padding:'10px', marginTop:'8px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text2, fontWeight:700, fontSize:'.78rem', opacity:guardando?.7:1 }}>
          🛠️ Bloquear este horario (mantenimiento)
        </button>
      </div>
    </div>
  )
}

// Cuando el horario ya está ocupado — muestra los datos de quien reservó
// (o el bloqueo de mantenimiento) y permite marcar el pago, reprogramar o
// cancelar sin tener que salir a otra pantalla.
function ModalGestionar({ reserva, canchas, soloLectura, onClose, onResuelto }) {
  const [modo, setModo] = useState(null) // null | 'cancelar' | 'reprogramar'
  const [reForm, setReForm] = useState({ cancha: reserva.cancha, fecha: reserva.fecha, hora: reserva.hora })
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [montoPagadoInput, setMontoPagadoInput] = useState(String(reserva.monto_pagado ?? 0))
  const [motivoInput, setMotivoInput] = useState(reserva.motivo_pago || '')
  const [guardandoPago, setGuardandoPago] = useState(false)

  const esMantenimiento = reserva.estado === 'mantenimiento'
  const pagoMenor = Number(montoPagadoInput) > 0 && Number(montoPagadoInput) < Number(reserva.monto)

  async function guardarPago() {
    const monto = Number(reserva.monto) || 0
    const pagadoNum = Number(montoPagadoInput) || 0
    const pago = pagadoNum <= 0 ? 'pendiente' : pagadoNum >= monto ? 'pagado' : 'anticipo'
    setGuardandoPago(true)
    const { error } = await supabase.from('escenario_reservas').update({
      pago, monto_pagado: pagadoNum,
      motivo_pago: pago === 'anticipo' ? (motivoInput.trim() || null) : null,
    }).eq('id', reserva.id)
    setGuardandoPago(false)
    if (error) {
      onResuelto(/does not exist/.test(error.message||'') ? '⚠️ Falta correr la migración migracion_escenario_motivo_pago.sql en Supabase' : '❌ ' + error.message)
      return
    }
    onResuelto('✅ Pago actualizado')
  }

  async function desbloquear() {
    setProcesando(true)
    const { error } = await supabase.from('escenario_reservas').delete().eq('id', reserva.id)
    setProcesando(false)
    onResuelto(error ? '❌ ' + error.message : 'Horario desbloqueado')
  }

  async function cancelar(motivo) {
    setProcesando(true)
    const { error } = await supabase.from('escenario_reservas').update({ estado: 'cancelada', motivo_cancelacion: motivo }).eq('id', reserva.id)
    setProcesando(false)
    onResuelto(error ? '❌ ' + error.message : 'Reserva cancelada — el horario quedó libre')
  }

  async function confirmarReprogramar() {
    if (!reForm.cancha || !reForm.fecha || !reForm.hora) { setError('Completa cancha, fecha y hora'); return }
    const { error } = await supabase.from('escenario_reservas').update({ cancha: reForm.cancha, fecha: reForm.fecha, hora: reForm.hora }).eq('id', reserva.id)
    if (error) { setError(error.message); return }
    onResuelto('Reserva reprogramada')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <div style={{ fontWeight:800, fontSize:'1rem' }}>{esMantenimiento ? 'Horario bloqueado' : 'Reserva'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
        </div>
        <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>{nombreCancha(canchas, reserva.cancha)} · {fmtDate(reserva.fecha)} — {fmtHora12(reserva.hora)}</div>

        {esMantenimiento ? (
          <>
            <div style={{ fontSize:'.8rem', color:S.text2, marginBottom:'16px' }}>Este horario está marcado como mantenimiento, no acepta reservas.</div>
            {soloLectura ? (
              <div style={{ fontSize:'.76rem', color:S.muted, textAlign:'center' }}>👁️ Modo solo lectura — no podés desbloquearlo.</div>
            ) : (
              <button onClick={desbloquear} disabled={procesando} style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem', opacity:procesando?.7:1 }}>
                {procesando ? '...' : 'Desbloquear horario'}
              </button>
            )}
          </>
        ) : modo === 'cancelar' ? (
          <>
            <div style={{ fontSize:'.8rem', color:S.text2, marginBottom:'14px' }}>¿Por qué se cancela? El horario queda libre para otra reserva.</div>
            <button onClick={()=>cancelar('no_show')} disabled={procesando} style={{ width:'100%', padding:'12px', marginBottom:'8px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text, fontWeight:700, fontSize:'.82rem' }}>No llegó</button>
            <button onClick={()=>cancelar('ultima_hora')} disabled={procesando} style={{ width:'100%', padding:'12px', marginBottom:'8px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text, fontWeight:700, fontSize:'.82rem' }}>Canceló a última hora</button>
            <button onClick={()=>setModo(null)} style={{ width:'100%', padding:'10px', background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:'.78rem' }}>Volver</button>
          </>
        ) : modo === 'reprogramar' ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div><label style={lbl}>Cancha</label><select value={reForm.cancha} onChange={e=>setReForm(f=>({...f,cancha:e.target.value}))} style={inp}>{canchas.map(c=><option key={c.id} value={c.slug}>{c.nombre}</option>)}</select></div>
              <div><label style={lbl}>Fecha</label><input type="date" value={reForm.fecha} onChange={e=>setReForm(f=>({...f,fecha:e.target.value}))} style={inp}/></div>
            </div>
            <div style={{ marginBottom:'14px' }}><label style={lbl}>Hora</label><input type="text" value={reForm.hora} onChange={e=>setReForm(f=>({...f,hora:e.target.value}))} style={inp} placeholder="HH:00"/></div>
            {error && <div style={{ color:S.loss, fontSize:'.78rem', marginBottom:'12px' }}>{error}</div>}
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={()=>setModo(null)} style={{ padding:'12px 16px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>Volver</button>
              <button onClick={confirmarReprogramar} style={{ flex:1, padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>Confirmar nuevo horario</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background:S.card2, borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
              <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Datos de quien reservó</div>
              <div style={{ fontSize:'.88rem', fontWeight:700, marginBottom:'4px' }}>{reserva.nombre}</div>
              {reserva.telefono && <div style={{ fontSize:'.8rem', color:S.text2 }}>{reserva.telefono}</div>}
              {reserva.equipo && <div style={{ fontSize:'.8rem', color:S.text2 }}>Equipo: {reserva.equipo}</div>}
              <div style={{ fontSize:'.8rem', color:S.text2 }}>Duración: {reserva.duracion} min</div>
              <div style={{ fontSize:'.8rem', color:S.text2, marginTop:'6px' }}>Valor: {fmtMoney(reserva.monto)}{reserva.monto_pagado ? ` · pagado ${fmtMoney(reserva.monto_pagado)}` : ''}</div>
              {reserva.motivo_pago && <div style={{ fontSize:'.74rem', color:S.gold, marginTop:'4px' }}>Pagó menos por: {reserva.motivo_pago}</div>}
            </div>
            {soloLectura ? (
              <div style={{ fontSize:'.76rem', color:S.muted, textAlign:'center' }}>👁️ Modo solo lectura — no podés cambiar el pago, reprogramar ni cancelar.</div>
            ) : (
              <>
                <div style={{ marginBottom:'16px' }}>
                  <label style={lbl}>Monto pagado</label>
                  <input type="number" value={montoPagadoInput} onChange={e=>setMontoPagadoInput(e.target.value)} style={inp}/>
                  <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'4px' }}>Valor de la cancha: {fmtMoney(reserva.monto)}</div>
                  {pagoMenor && (
                    <div style={{ marginTop:'10px' }}>
                      <label style={lbl}>¿Por qué pagó menos?</label>
                      <input value={motivoInput} onChange={e=>setMotivoInput(e.target.value)} style={inp} placeholder="Ej: descuento, cliente frecuente, lluvia..."/>
                    </div>
                  )}
                  <button onClick={guardarPago} disabled={guardandoPago} style={{ width:'100%', padding:'10px', marginTop:'10px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'8px', cursor:'pointer', color:S.cyan, fontWeight:700, fontSize:'.8rem', opacity:guardandoPago?.7:1 }}>
                    {guardandoPago ? 'Guardando...' : 'Guardar pago'}
                  </button>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={()=>setModo('reprogramar')} style={{ flex:1, padding:'11px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text2, fontWeight:700, fontSize:'.78rem' }}>Reprogramar</button>
                  <button onClick={()=>setModo('cancelar')} style={{ flex:1, padding:'11px', background:'none', border:`1px solid ${S.loss}`, borderRadius:'10px', cursor:'pointer', color:S.loss, fontWeight:700, fontSize:'.78rem' }}>Cancelar reserva</button>
                </div>
              </>
            )}
          </>
        )}
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
  const [revisando, setRevisando] = useState(null)
  const [gestionando, setGestionando] = useState(null)
  const [msg,       setMsg]       = useState('')
  const [soloLectura, setSoloLectura] = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    // La identidad + acceso + datos del escenario vienen de un cache
    // compartido (dura 3 minutos) — así no se repiten esas consultas cada
    // vez que se entra y sale de esta pestaña.
    const r = await obtenerAccesoEscenario(escenarioId)
    if (r.estado === 'sin_sesion') { navigate('/jugador/login'); return }
    if (r.estado === 'sin_rol') { navigate('/jugador'); return }
    if (r.estado === 'sin_acceso') { navigate('/escenario'); return }
    setSoloLectura(!!r.acceso.solo_lectura)
    setEncargado(r.encargado)
    setEscenario(r.escenario)
    const [{ data: cs }] = await Promise.all([
      supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true).order('orden'),
      asegurarReservasFijasThrottled(escenarioId),
    ])
    setCanchas(cs || [])
    setCancha(prev => prev || (cs && cs[0] ? cs[0].slug : null))
    const { data: rsvs } = await supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId)
    setReservas(rsvs || [])
    setLoading(false)
  }

  function abrir(cancha, fecha, hora) { if (!soloLectura) setModalSlot({ cancha, fecha, hora }) }
  function guardado() { setModalSlot(null); setMsg('✅ Reserva registrada'); setTimeout(()=>setMsg(''),3000); fetchTodo() }

  function abrirRevisar(cancha, fecha, hora) {
    const r = reservas.find(x => x.cancha === cancha && x.fecha === fecha && x.estado === 'pendiente'
      && parseInt(hora,10) >= parseInt(x.hora,10) && parseInt(hora,10) < parseInt(x.hora,10) + Math.ceil((x.duracion||60)/60))
    if (r) setRevisando(r)
  }
  function resuelto(texto) { setRevisando(null); setMsg(texto); setTimeout(()=>setMsg(''),3000); fetchTodo() }

  function reservaDeSlot(cancha, fecha, hora) {
    return reservas.find(x => x.cancha === cancha && x.fecha === fecha && (x.estado === 'aceptada' || x.estado === 'mantenimiento')
      && parseInt(hora,10) >= parseInt(x.hora,10) && parseInt(hora,10) < parseInt(x.hora,10) + Math.ceil((x.duracion||60)/60))
  }

  function abrirGestionar(cancha, fecha, hora) {
    const r = reservaDeSlot(cancha, fecha, hora)
    if (r) setGestionando(r)
  }
  function resueltoGestion(texto) { setGestionando(null); setMsg(texto); setTimeout(()=>setMsg(''),3000); fetchTodo() }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const horas = escenario ? getHours(escenario) : []
  const dias = proximosDias()

  // Solicitudes pendientes de TODAS las canchas y fechas, no solo la que se
  // está viendo — para que el aviso de arriba avise aunque estés parado en
  // otro día u otra cancha.
  const pendientesTodas = reservas.filter(r => r.estado === 'pendiente').sort((a,b) => (a.fecha+a.hora).localeCompare(b.fecha+b.hora))
  const fechasPendientes = new Set(pendientesTodas.map(r => r.fecha))

  function irAPendiente(r) { setCancha(r.cancha); setFecha(r.fecha); setRevisando(r) }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {modalSlot && (
        <ModalReserva escenario={escenario} canchas={canchas} cancha={modalSlot.cancha} fecha={modalSlot.fecha} hora={modalSlot.hora}
          onClose={()=>setModalSlot(null)} onGuardado={guardado}/>
      )}
      {revisando && (
        <ModalRevisar reserva={revisando} canchas={canchas} encargado={encargado} soloLectura={soloLectura}
          onClose={()=>setRevisando(null)} onResuelto={resuelto}/>
      )}
      {gestionando && (
        <ModalGestionar reserva={gestionando} canchas={canchas} soloLectura={soloLectura}
          onClose={()=>setGestionando(null)} onResuelto={resueltoGestion}/>
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

        {pendientesTodas.length > 0 && (
          <div style={{ background:'rgba(232,113,14,.1)', border:`1px solid ${S.warn}`, borderRadius:'12px', padding:'12px 14px', marginBottom:'14px' }}>
            <div style={{ fontWeight:800, fontSize:'.82rem', color:S.warn, marginBottom:'6px' }}>🔔 {pendientesTodas.length} solicitud{pendientesTodas.length>1?'es':''} por confirmar</div>
            {pendientesTodas.map((r,i) => (
              <button key={r.id} onClick={()=>irAPendiente(r)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', textAlign:'left', background:'none', border:'none', borderTop: i>0 ? `1px solid rgba(232,113,14,.25)` : 'none', padding:'8px 0', cursor:'pointer', color:S.text }}>
                <span style={{ fontSize:'.78rem' }}>{fmtDate(r.fecha)} · {fmtHora12(r.hora)} · {nombreCancha(canchas, r.cancha)}</span>
                <span style={{ fontSize:'.76rem', fontWeight:700, color:S.warn, flexShrink:0, marginLeft:'8px' }}>{r.nombre}</span>
              </button>
            ))}
          </div>
        )}

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
          <div style={{ display:'flex', gap:'7px', overflowX:'auto', paddingBottom:'4px' }}>
            {dias.map(d => {
              const sel = d.iso === fecha
              const pendiente = fechasPendientes.has(d.iso)
              return (
                <button key={d.iso} onClick={()=>setFecha(d.iso)}
                  style={{ position:'relative', flexShrink:0, minWidth:'52px', textAlign:'center', padding:'8px 6px', borderRadius:'10px', cursor:'pointer',
                    border: sel ? `2px solid ${S.cyan}` : `1px solid ${S.border}`, background: sel ? S.cyanDim : S.card }}>
                  {pendiente && <span style={{ position:'absolute', top:'4px', right:'4px', width:'7px', height:'7px', borderRadius:'50%', background:S.warn }}/>}
                  <div style={{ fontSize:'.6rem', fontWeight:700, color: sel?S.cyan:S.muted }}>{d.etiqueta}</div>
                  <div style={{ fontSize:'.95rem', fontWeight:900, color: sel?S.cyan:S.text, margin:'2px 0' }}>{d.num}</div>
                  <div style={{ fontSize:'.58rem', color:S.muted }}>{d.mes}</div>
                </button>
              )
            })}
          </div>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{ ...inp, marginTop:'8px' }}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {horas.map(h => {
            const est = slotEstado(reservas, cancha, fecha, h)
            const r = est==='ocupado' ? reservaDeSlot(cancha, fecha, h) : null
            const pagado = r && r.pago === 'pagado'
            const pagoParcial = r && r.pago === 'anticipo'
            const label = est==='libre' ? '🟢 Disponible' : est==='pendiente' ? '🟡 Solicitud pendiente'
              : pagado ? '✅ Pagado' : pagoParcial ? '🟠 Pagó menos' : '🔴 Ocupado'
            const color = est==='libre' ? S.win : est==='pendiente' ? S.warn : pagado ? S.win : pagoParcial ? S.gold : S.loss
            const bg = pagado ? 'rgba(30,142,62,.12)' : pagoParcial ? 'rgba(249,168,37,.1)' : S.card
            const border = pagado ? S.win : pagoParcial ? S.gold : S.border
            return (
              <div key={h} onClick={() => est==='libre' ? abrir(cancha, fecha, h) : est==='pendiente' ? abrirRevisar(cancha, fecha, h) : abrirGestionar(cancha, fecha, h)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:bg, border:`1px solid ${border}`, borderRadius:'10px', cursor:'pointer' }}>
                <span style={{ fontWeight:700, fontSize:'.85rem' }}>{fmtHora12(h)}</span>
                <span style={{ fontSize:'.78rem', color, fontWeight:600 }}>{label}{est!=='libre' && ' · toca para ver'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
