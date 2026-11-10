import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getHours, slotEstado, todayStr, fmtDate, fmtMoney, precioCancha, nombreCancha, sincronizarReservasFijas, proximosDias, obtenerAccesoEscenario, horasSeguidasLibres, horaFin, intervalosSolapan, fechaLocalStr } from '../lib/escenarioHelpers'
import { useAuthStore } from '../store/authStore'
import { leerCopia, guardarCopia } from '../lib/perfilPrevio'
import { fmtHora12 } from '../lib/horaHelpers'
import { X, Phone, Eye, Wrench, Bell, CalendarDays, Goal } from 'lucide-react'
import { BotonVolver } from '../components/EscenarioUI'

const S = {
  // Mismo look que el resto de Golmebol: negro, tarjetas planas, acento verde.
  navy: '#0a0a0a', surface: '#0a0a0a', card: '#161616', card2: '#1c1c1c',
  border: '#2a2a2a', cyan: '#6fcf3d', cyanDim: 'rgba(111,207,61,.13)',
  gold: '#f5a623', text: '#ffffff', text2: '#c9c9c9', muted: '#8a8a8a',
  win: '#6fcf3d', warn: '#f5a623', loss: '#e5433d',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'0 14px', minHeight:'48px', color:S.text, fontSize:'1rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
const lbl = { fontSize:'.78rem', color:S.text2, display:'block', marginBottom:'6px', fontWeight:700 }
const BTN = { boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', width:'100%', minHeight:'52px', border:'none', borderRadius:'14px', cursor:'pointer', fontWeight:900, fontSize:'1rem', fontFamily:'inherit' }
const BTN_SUAVE = { boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center', width:'100%', minHeight:'46px', borderRadius:'12px', cursor:'pointer', fontWeight:800, fontSize:'.88rem', fontFamily:'inherit', background:'none' }

// Ventana que sube desde abajo (en el celular se alcanza con el pulgar). Siempre trae un título y un botón visible para cerrar.
// `completa`: ocupa toda la pantalla, con título fijo arriba, el contenido que se desplaza en medio y los botones
// (`pie`) fijos abajo. Así al arrastrar para subir o bajar no se "pega" ni se mueve la página de atrás.
function Hoja({ titulo, subtitulo, onClose, completa, pie, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const cabecera = (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px' }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:900, fontSize:'1.12rem', lineHeight:1.25 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize:'.82rem', color:S.muted, marginTop:'3px' }}>{subtitulo}</div>}
      </div>
      <button onClick={onClose} aria-label="Cerrar" style={{ flexShrink:0, width:'44px', height:'44px', borderRadius:'12px', background:S.card2, border:`1px solid ${S.border}`, cursor:'pointer', color:S.text2, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={20}/></button>
    </div>
  )
  if (completa) return (
    <div role="dialog" aria-modal="true" aria-label={titulo}
      style={{ position:'fixed', top:0, left:0, right:0, bottom:0, height:'100dvh', zIndex:500, background:S.navy, display:'flex', flexDirection:'column', touchAction:'manipulation' }}>
      <div style={{ flexShrink:0, padding:'max(12px, env(safe-area-inset-top)) 16px 12px', borderBottom:`1px solid ${S.border}`, background:S.card }}>
        <div style={{ maxWidth:'520px', margin:'0 auto' }}>{cabecera}</div>
      </div>
      <div style={{ flex:1, minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', overscrollBehavior:'contain', padding:'18px 16px 24px' }}>
        <div style={{ maxWidth:'520px', margin:'0 auto' }}>{children}</div>
      </div>
      {pie && (
        <div style={{ flexShrink:0, maxHeight:'50vh', overflowY:'auto', overscrollBehavior:'contain', padding:'12px 16px calc(14px + env(safe-area-inset-bottom))', borderTop:`1px solid ${S.border}`, background:S.card }}>
          <div style={{ maxWidth:'520px', margin:'0 auto', display:'grid', gap:'10px' }}>{pie}</div>
        </div>
      )}
    </div>
  )
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'22px 22px 0 0', width:'100%', maxWidth:'480px', maxHeight:'92vh', overflowY:'auto', overscrollBehavior:'contain', padding:'18px 18px 24px', boxSizing:'border-box' }}>
        <div style={{ marginBottom:'14px' }}>{cabecera}</div>
        {children}
      </div>
    </div>
  )
}

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
    onResuelto(error ? 'Error al aceptar: ' + error.message : 'Reserva aceptada')
  }

  async function rechazar() {
    setProcesando(true)
    const { error } = await supabase.from('escenario_reservas').update({ estado:'rechazada' }).eq('id', reserva.id)
    setProcesando(false)
    onResuelto(error ? 'Error al rechazar: ' + error.message : 'Solicitud rechazada')
  }

  return (
    <Hoja titulo="Un cliente quiere reservar" subtitulo={`${nombreCancha(canchas, reserva.cancha)} · ${fmtDate(reserva.fecha)} · ${fmtHora12(reserva.hora)}`} onClose={onClose}>
      <div style={{ background:S.card2, borderRadius:'14px', padding:'14px', marginBottom:'16px' }}>
        <div style={{ fontSize:'1.05rem', fontWeight:800, marginBottom:'6px' }}>{reserva.nombre}</div>
        {reserva.equipo && <div style={{ fontSize:'.88rem', color:S.text2, marginBottom:'2px' }}>Equipo: {reserva.equipo}</div>}
        <div style={{ fontSize:'.88rem', color:S.text2 }}>Quiere jugar {reserva.duracion >= 60 ? `${reserva.duracion / 60} ${reserva.duracion === 60 ? 'hora' : 'horas'}` : `${reserva.duracion} min`}</div>
        {reserva.telefono && (
          <a href={`tel:${reserva.telefono}`} style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginTop:'10px', color:S.cyan, fontWeight:800, fontSize:'.92rem', textDecoration:'none' }}>
            <Phone size={16}/> {reserva.telefono}
          </a>
        )}
      </div>
      {soloLectura ? (
        <div style={{ fontSize:'.84rem', color:S.muted, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><Eye size={16}/> Solo puedes mirar: no puedes aceptar ni rechazar.</div>
      ) : (
        <div style={{ display:'grid', gap:'10px' }}>
          <button onClick={aceptar} disabled={procesando} style={{ ...BTN, background:S.cyan, color:'#0a1a05', opacity:procesando?.7:1 }}>{procesando ? 'Un momento…' : 'Aceptar reserva'}</button>
          <button onClick={rechazar} disabled={procesando} style={{ ...BTN_SUAVE, border:`1px solid ${S.loss}`, color:'#ff7b72', opacity:procesando?.7:1 }}>Rechazar</button>
        </div>
      )}
    </Hoja>
  )
}

function ModalReserva({ escenario, canchas, reservas, horas, cancha, fecha, hora, onClose, onGuardado }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [equipo, setEquipo] = useState('')
  // Todo es de 60 en 60 minutos. 2 horas = 2 horarios seguidos y el valor de 2 horas.
  const [nHoras, setNHoras] = useState(1)
  const [recurrente, setRecurrente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const precioHora = precioCancha(canchas, cancha)
  const monto = precioHora * nHoras
  const duracion = nHoras * 60
  const maxHoras = horasSeguidasLibres(reservas, cancha, fecha, horas, hora, 3)
  const ocupan = e => e === 'aceptada' || e === 'pendiente' || e === 'mantenimiento'

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Escribe el nombre y el teléfono de quien reserva.'); return }
    setGuardando(true); setError('')
    // Revisión de último momento: que esas horas sigan libres (alguien pudo reservar mientras se llenaba el formulario)
    const { data: actuales } = await supabase.from('escenario_reservas').select('*').eq('escenario_id', escenario.id)
    const choca = (actuales || []).some(r => r.cancha === cancha && r.fecha === fecha && ocupan(r.estado) && intervalosSolapan(hora, duracion, r.hora, r.duracion))
    if (choca) { setGuardando(false); setError('Ese horario acaba de ocuparse. Cierra esta ventana y elige otro.'); return }
    const { error: errIns } = await supabase.from('escenario_reservas').insert({
      escenario_id: escenario.id, cancha, fecha, hora, duracion,
      nombre: nombre.trim(), telefono: telefono.trim(), equipo: equipo.trim() || null,
      estado: 'aceptada', pago: 'pendiente', monto, monto_pagado: 0, recurrente: false,
    })
    if (errIns) { setGuardando(false); setError('No se pudo guardar: ' + errIns.message); return }
    // "Repetir cada semana": las 8 semanas siguientes, saltando las que ya estén ocupadas
    let textoFinal = 'Reserva guardada'
    if (recurrente) {
      const filas = []; let saltadas = 0
      for (let i = 1; i <= 8; i++) {
        const d = new Date(fecha + 'T00:00:00'); d.setDate(d.getDate() + 7 * i)
        const f = fechaLocalStr(d)
        const libre = !(actuales || []).some(r => r.cancha === cancha && r.fecha === f && ocupan(r.estado) && intervalosSolapan(hora, duracion, r.hora, r.duracion))
        if (!libre) { saltadas++; continue }
        filas.push({ escenario_id: escenario.id, cancha, fecha: f, hora, duracion, nombre: nombre.trim(), telefono: telefono.trim(), equipo: equipo.trim() || null,
          estado: 'aceptada', pago: 'pendiente', monto, monto_pagado: 0, recurrente: false, generada_de_recurrente: true })
      }
      if (filas.length) await supabase.from('escenario_reservas').insert(filas)
      textoFinal = `Reserva guardada y repetida ${filas.length} ${filas.length === 1 ? 'semana' : 'semanas'}` + (saltadas ? ` (${saltadas} ya estaban ocupadas)` : '')
    }
    setGuardando(false)
    onGuardado(textoFinal)
  }

  async function handleBloquear() {
    setGuardando(true); setError('')
    const { error: errIns } = await supabase.from('escenario_reservas').insert({
      escenario_id: escenario.id, cancha, fecha, hora, duracion: 60,
      nombre: 'Mantenimiento', telefono: '', equipo: '', estado: 'mantenimiento', pago: 'pagado', monto: 0,
    })
    setGuardando(false)
    if (errIns) { setError('No se pudo cerrar el horario: ' + errIns.message); return }
    onGuardado()
  }

  const chip = activo => ({ flex:1, minHeight:'46px', borderRadius:'12px', cursor:'pointer', fontWeight:800, fontSize:'.9rem', fontFamily:'inherit', border: activo ? `2px solid ${S.cyan}` : `1px solid ${S.border}`, background: activo ? S.cyanDim : S.card2, color: activo ? S.cyan : S.text2 })

  return (
    <Hoja completa titulo="Anotar una reserva" subtitulo={`${nombreCancha(canchas, cancha)} · ${fmtDate(fecha)} · ${fmtHora12(hora)}`} onClose={onClose}
      pie={<>
        {error && <div style={{ color:'#ff7b72', fontSize:'.86rem', fontWeight:700, textAlign:'center' }}>{error}</div>}
        <button onClick={handleReservar} disabled={guardando} style={{ ...BTN, background:S.cyan, color:'#0a1a05', opacity:guardando?.7:1 }}>{guardando ? 'Guardando…' : 'Guardar reserva'}</button>
      </>}>
      <div style={{ display:'grid', gap:'14px' }}>
        <div><label style={lbl}>¿Quién reserva?</label><input value={nombre} onChange={e=>setNombre(e.target.value)} style={inp} placeholder="Nombre" autoComplete="off"/></div>
        <div><label style={lbl}>Teléfono</label><input value={telefono} onChange={e=>setTelefono(e.target.value)} style={inp} placeholder="300 123 4567" inputMode="tel" autoComplete="off"/></div>
        <div><label style={lbl}>Equipo <span style={{ color:S.muted, fontWeight:500 }}>(si quieres anotarlo)</span></label><input value={equipo} onChange={e=>setEquipo(e.target.value)} style={inp} placeholder="Nombre del equipo" autoComplete="off"/></div>
        <div>
          <label style={lbl}>¿Cuánto tiempo?</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[1,2,3].map(n => {
              const ok = n <= maxHoras
              return <button key={n} type="button" disabled={!ok} onClick={()=>setNHoras(n)} style={{ ...chip(nHoras===n), opacity: ok ? 1 : .35, cursor: ok ? 'pointer' : 'not-allowed' }}>{n} {n === 1 ? 'hora' : 'horas'}</button>
            })}
          </div>
          <div style={{ fontSize:'.78rem', color:S.muted, marginTop:'8px', lineHeight:1.4 }}>
            {nHoras > 1 ? <>Se ocupan {nHoras} horarios seguidos: de <b style={{ color:S.text2 }}>{fmtHora12(hora)}</b> a <b style={{ color:S.text2 }}>{fmtHora12(horaFin(hora, nHoras))}</b>.</> : null}
            {maxHoras < 3 ? <>{nHoras > 1 ? ' ' : ''}{maxHoras === 1 ? 'Después de este horario ya está ocupado o el lugar cierra: solo se puede 1 hora.' : 'Solo hay 2 horas seguidas libres desde acá.'}</> : null}
          </div>
        </div>
        <button type="button" onClick={()=>setRecurrente(v=>!v)} aria-pressed={recurrente}
          style={{ display:'flex', alignItems:'center', gap:'12px', textAlign:'left', width:'100%', minHeight:'56px', padding:'8px 14px', borderRadius:'12px', cursor:'pointer', fontFamily:'inherit', border: recurrente ? `2px solid ${S.cyan}` : `1px solid ${S.border}`, background: recurrente ? S.cyanDim : S.card2, color:S.text }}>
          <span style={{ width:'24px', height:'24px', borderRadius:'7px', flexShrink:0, border:`2px solid ${recurrente ? S.cyan : S.muted}`, background: recurrente ? S.cyan : 'transparent', color:'#0a1a05', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem' }}>{recurrente ? '✓' : ''}</span>
          <span><b style={{ fontSize:'.9rem' }}>Repetir cada semana</b><br/><span style={{ fontSize:'.76rem', color:S.muted }}>Lo anota el mismo día y hora por 8 semanas</span></span>
        </button>
        {monto > 0 && <div style={{ fontSize:'.88rem', color:S.text2, textAlign:'center' }}>Valor{nHoras > 1 ? ` de ${nHoras} horas` : ' de la cancha'}: <b style={{ color:S.gold }}>{fmtMoney(monto)}</b></div>}
        <button onClick={handleBloquear} disabled={guardando} style={{ ...BTN_SUAVE, border:`1px solid ${S.border}`, color:S.muted, fontSize:'.8rem', opacity:guardando?.7:1 }}>
          <Wrench size={15} style={{ marginRight:6 }}/> Mejor cerrar este horario (mantenimiento)
        </button>
      </div>
    </Hoja>
  )
}

// Cuando el horario ya está ocupado — muestra los datos de quien reservó
// (o el bloqueo de mantenimiento) y permite marcar el pago, reprogramar o
// cancelar sin tener que salir a otra pantalla.
function ModalGestionar({ reserva, canchas, horas, soloLectura, onClose, onResuelto }) {
  const [modo, setModo] = useState(null) // null | 'cancelar' | 'reprogramar' | 'parcial'
  const [reForm, setReForm] = useState({ cancha: reserva.cancha, fecha: reserva.fecha, hora: reserva.hora })
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [montoPagadoInput, setMontoPagadoInput] = useState(reserva.pago === 'anticipo' ? String(reserva.monto_pagado ?? '') : '')
  const [motivoInput, setMotivoInput] = useState(reserva.motivo_pago || '')

  const esMantenimiento = reserva.estado === 'mantenimiento'
  const monto = Number(reserva.monto) || 0
  const pagoMenor = Number(montoPagadoInput) > 0 && Number(montoPagadoInput) < monto

  // Un solo lugar guarda el pago: "todo", "una parte" o "nada todavía"
  async function guardarPago(pagadoNum, motivo) {
    const pago = pagadoNum <= 0 ? 'pendiente' : pagadoNum >= monto ? 'pagado' : 'anticipo'
    setProcesando(true)
    const { error } = await supabase.from('escenario_reservas').update({
      pago, monto_pagado: pagadoNum,
      motivo_pago: pago === 'anticipo' ? ((motivo || '').trim() || null) : null,
    }).eq('id', reserva.id)
    setProcesando(false)
    if (error) {
      onResuelto(/does not exist/.test(error.message||'') ? 'Falta correr la migración migracion_escenario_motivo_pago.sql en Supabase' : error.message)
      return
    }
    onResuelto(pago === 'pagado' ? 'Marcada como pagada' : pago === 'anticipo' ? 'Pago parcial guardado' : 'Marcada como sin pagar')
  }

  async function desbloquear() {
    setProcesando(true)
    const { error } = await supabase.from('escenario_reservas').delete().eq('id', reserva.id)
    setProcesando(false)
    onResuelto(error ? error.message : 'Horario abierto otra vez')
  }

  async function cancelar(motivo) {
    setProcesando(true)
    const { error } = await supabase.from('escenario_reservas').update({ estado: 'cancelada', motivo_cancelacion: motivo }).eq('id', reserva.id)
    setProcesando(false)
    onResuelto(error ? error.message : 'Reserva cancelada — el horario quedó libre')
  }

  async function confirmarReprogramar() {
    if (!reForm.cancha || !reForm.fecha || !reForm.hora) { setError('Elige la cancha, el día y la hora.'); return }
    // Que las horas de esta reserva (1, 2, 3...) quepan antes de que cierre el lugar y no se crucen con otra
    const nH = Math.max(1, Math.ceil((reserva.duracion || 60) / 60))
    const iHora = horas.findIndex(x => parseInt(x, 10) === parseInt(reForm.hora, 10))
    if (iHora >= 0 && iHora + nH > horas.length) { setError(`Esa hora no sirve: la reserva dura ${nH} ${nH === 1 ? 'hora' : 'horas'} y el lugar cierra antes.`); return }
    const { data: otras } = await supabase.from('escenario_reservas').select('*').eq('escenario_id', reserva.escenario_id)
    const choca = (otras || []).some(r => r.id !== reserva.id && r.cancha === reForm.cancha && r.fecha === reForm.fecha
      && (r.estado === 'aceptada' || r.estado === 'pendiente' || r.estado === 'mantenimiento') && intervalosSolapan(reForm.hora, reserva.duracion, r.hora, r.duracion))
    if (choca) { setError(nH > 1 ? `Esas ${nH} horas seguidas no están libres. Prueba otra hora.` : 'Ese horario ya está ocupado. Prueba otro.'); return }
    const { error } = await supabase.from('escenario_reservas').update({ cancha: reForm.cancha, fecha: reForm.fecha, hora: reForm.hora }).eq('id', reserva.id)
    if (error) { setError(error.message); return }
    onResuelto('Reserva movida al nuevo horario')
  }

  const subtitulo = `${nombreCancha(canchas, reserva.cancha)} · ${fmtDate(reserva.fecha)} · ${fmtHora12(reserva.hora)}`
  const volver = <button onClick={()=>{ setModo(null); setError('') }} style={{ ...BTN_SUAVE, color:S.muted, border:`1px solid ${S.border}`, marginTop:'10px' }}>‹ Volver</button>

  if (esMantenimiento) return (
    <Hoja titulo="Horario cerrado" subtitulo={subtitulo} onClose={onClose}>
      <div style={{ fontSize:'.9rem', color:S.text2, marginBottom:'16px', lineHeight:1.5 }}>Este horario está cerrado por mantenimiento y nadie puede reservarlo.</div>
      {soloLectura
        ? <div style={{ fontSize:'.84rem', color:S.muted, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><Eye size={16}/> Solo puedes mirar.</div>
        : <button onClick={desbloquear} disabled={procesando} style={{ ...BTN, background:S.cyan, color:'#0a1a05', opacity:procesando?.7:1 }}>{procesando ? 'Un momento…' : 'Abrir este horario otra vez'}</button>}
    </Hoja>
  )

  if (modo === 'cancelar') return (
    <Hoja titulo="¿Por qué se cancela?" subtitulo="El horario queda libre para otra reserva." onClose={onClose}>
      <div style={{ display:'grid', gap:'10px' }}>
        <button onClick={()=>cancelar('no_show')} disabled={procesando} style={{ ...BTN, background:S.card2, border:`1px solid ${S.border}`, color:S.text, fontSize:'.95rem' }}>No llegó</button>
        <button onClick={()=>cancelar('ultima_hora')} disabled={procesando} style={{ ...BTN, background:S.card2, border:`1px solid ${S.border}`, color:S.text, fontSize:'.95rem' }}>Canceló a última hora</button>
      </div>
      {volver}
    </Hoja>
  )

  if (modo === 'reprogramar') return (
    <Hoja titulo="Cambiar de horario" subtitulo={`Ahora: ${subtitulo}`} onClose={onClose}>
      <div style={{ display:'grid', gap:'14px' }}>
        {canchas.length > 1 && (
          <div><label style={lbl}>Cancha</label><select value={reForm.cancha} onChange={e=>setReForm(f=>({...f,cancha:e.target.value}))} style={inp}>{canchas.map(c=><option key={c.id} value={c.slug}>{c.nombre}</option>)}</select></div>
        )}
        <div><label style={lbl}>Día</label><input type="date" value={reForm.fecha} onChange={e=>setReForm(f=>({...f,fecha:e.target.value}))} style={inp}/></div>
        <div><label style={lbl}>Hora</label>
          <select value={reForm.hora} onChange={e=>setReForm(f=>({...f,hora:e.target.value}))} style={inp}>
            {(horas.includes(reForm.hora) ? horas : [reForm.hora, ...horas]).map(h => <option key={h} value={h}>{fmtHora12(h)}</option>)}
          </select>
        </div>
        {error && <div style={{ color:'#ff7b72', fontSize:'.86rem', fontWeight:700, textAlign:'center' }}>{error}</div>}
        <button onClick={confirmarReprogramar} style={{ ...BTN, background:S.cyan, color:'#0a1a05' }}>Guardar el nuevo horario</button>
      </div>
      {volver}
    </Hoja>
  )

  return (
    <Hoja titulo={reserva.nombre || 'Reserva'} subtitulo={subtitulo} onClose={onClose}>
      <div style={{ background:S.card2, borderRadius:'14px', padding:'14px', marginBottom:'16px', display:'grid', gap:'4px' }}>
        {reserva.equipo && <div style={{ fontSize:'.9rem', color:S.text2 }}>Equipo: {reserva.equipo}</div>}
        <div style={{ fontSize:'.9rem', color:S.text2 }}>Tiempo: {Math.max(1, Math.round((reserva.duracion || 60) / 60))} {Math.max(1, Math.round((reserva.duracion || 60) / 60)) === 1 ? 'hora' : 'horas'}</div>
        {reserva.telefono && (
          <a href={`tel:${reserva.telefono}`} style={{ display:'inline-flex', alignItems:'center', gap:'6px', color:S.cyan, fontWeight:800, fontSize:'.92rem', textDecoration:'none', marginTop:'4px' }}><Phone size={16}/> {reserva.telefono}</a>
        )}
        <div style={{ fontSize:'.95rem', marginTop:'8px' }}>
          Valor: <b>{fmtMoney(monto)}</b>
          {reserva.pago === 'pagado' && <span style={{ color:S.win, fontWeight:800 }}> · Pagado</span>}
          {reserva.pago === 'anticipo' && <span style={{ color:S.gold, fontWeight:800 }}> · pagó {fmtMoney(reserva.monto_pagado)}</span>}
          {(reserva.pago === 'pendiente' || !reserva.pago) && <span style={{ color:'#ff7b72', fontWeight:800 }}> · sin pagar</span>}
        </div>
        {reserva.motivo_pago && <div style={{ fontSize:'.8rem', color:S.gold }}>Pagó menos por: {reserva.motivo_pago}</div>}
      </div>

      {soloLectura ? (
        <div style={{ fontSize:'.84rem', color:S.muted, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><Eye size={16}/> Solo puedes mirar: no puedes cambiar el pago, mover ni cancelar.</div>
      ) : modo === 'parcial' ? (
        <div style={{ display:'grid', gap:'12px' }}>
          <div><label style={lbl}>¿Cuánto pagó?</label><input type="number" inputMode="numeric" value={montoPagadoInput} onChange={e=>setMontoPagadoInput(e.target.value)} style={inp} placeholder="Ej: 20000" autoFocus/></div>
          {pagoMenor && <div><label style={lbl}>¿Por qué pagó menos? <span style={{ color:S.muted, fontWeight:500 }}>(opcional)</span></label><input value={motivoInput} onChange={e=>setMotivoInput(e.target.value)} style={inp} placeholder="Descuento, cliente frecuente, lluvia…"/></div>}
          <button onClick={()=>guardarPago(Number(montoPagadoInput) || 0, motivoInput)} disabled={procesando} style={{ ...BTN, background:S.cyan, color:'#0a1a05', opacity:procesando?.7:1 }}>{procesando ? 'Guardando…' : 'Guardar pago'}</button>
          {volver}
        </div>
      ) : (
        <div style={{ display:'grid', gap:'10px' }}>
          <div style={{ fontSize:'.76rem', fontWeight:800, letterSpacing:'.06em', color:S.muted, textTransform:'uppercase' }}>¿Ya pagó?</div>
          {reserva.pago !== 'pagado' && <button onClick={()=>guardarPago(monto, '')} disabled={procesando} style={{ ...BTN, background:S.win, color:'#05140a', opacity:procesando?.7:1 }}>Pagó todo ({fmtMoney(monto)})</button>}
          <div style={{ display:'grid', gridTemplateColumns: reserva.pago === 'pagado' ? '1fr' : '1fr 1fr', gap:'10px' }}>
            <button onClick={()=>setModo('parcial')} style={{ ...BTN_SUAVE, border:`1px solid ${S.gold}`, color:S.gold }}>Pagó una parte</button>
            {reserva.pago !== 'pendiente' && reserva.pago && <button onClick={()=>guardarPago(0, '')} disabled={procesando} style={{ ...BTN_SUAVE, border:`1px solid ${S.border}`, color:S.text2 }}>Aún no pagó</button>}
          </div>
          <div style={{ height:'1px', background:S.border, margin:'6px 0' }}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <button onClick={()=>setModo('reprogramar')} style={{ ...BTN_SUAVE, border:`1px solid ${S.border}`, color:S.text2 }}>Cambiar horario</button>
            <button onClick={()=>setModo('cancelar')} style={{ ...BTN_SUAVE, border:`1px solid ${S.loss}`, color:'#ff7b72' }}>Cancelar reserva</button>
          </div>
        </div>
      )}
    </Hoja>
  )
}

export default function EscenarioCanchasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  // Lo último que vio esta cuenta: horarios y reservas se pintan de inmediato y se actualizan detrás
  const uid = useAuthStore.getState().user?.id
  const [copia] = useState(() => leerCopia(uid, 'esc_canchas_' + escenarioId, 6 * 60 * 60 * 1000))
  const [encargado, setEncargado] = useState(copia?.encargado || null)
  const [escenario, setEscenario] = useState(copia?.escenario || null)
  const [canchas,   setCanchas]   = useState(copia?.canchas || [])
  const [reservas,  setReservas]  = useState(copia?.reservas || [])
  const [loading,   setLoading]   = useState(!copia)
  const [cancha,    setCancha]    = useState(copia?.canchas?.[0]?.slug || null)
  const [fecha,     setFecha]     = useState(todayStr())
  const [otraFecha, setOtraFecha] = useState(false)
  const [modalSlot, setModalSlot] = useState(null)
  const [revisando, setRevisando] = useState(null)
  const [gestionando, setGestionando] = useState(null)
  const [msg,       setMsg]       = useState('')
  const [soloLectura, setSoloLectura] = useState(!!copia?.soloLectura)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    if (!copia) setLoading(true)
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
    // Canchas y reservas se piden a la vez (antes una esperaba a la otra y a la revisión de reservas fijas)
    const [{ data: cs }, { data: rsvs }] = await Promise.all([
      supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true).order('orden'),
      supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId),
    ])
    setCanchas(cs || [])
    setCancha(prev => prev || (cs && cs[0] ? cs[0].slug : null))
    setReservas(rsvs || [])
    setLoading(false)
    guardarCopia(uid, 'esc_canchas_' + escenarioId, { encargado: r.encargado, escenario: r.escenario, soloLectura: !!r.acceso.solo_lectura, canchas: cs || [], reservas: rsvs || [] })

    // Las reservas fijas se ponen al día DETRÁS de la pantalla; solo si cambió algo se vuelven a leer
    sincronizarReservasFijas(escenarioId).then(async cambio => {
      if (!cambio) return
      const { data: nuevas } = await supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId)
      if (nuevas) setReservas(nuevas)
    }).catch(() => {})
  }

  function abrir(cancha, fecha, hora) { if (!soloLectura) setModalSlot({ cancha, fecha, hora }) }
  function guardado(texto) { setModalSlot(null); setMsg(typeof texto === 'string' ? texto : 'Reserva guardada'); setTimeout(()=>setMsg(''),3000); fetchTodo() }

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

  const estados = horas.map(h => slotEstado(reservas, cancha, fecha, h))
  const nLibres = estados.filter(e => e === 'libre').length
  const nOcupados = estados.length - nLibres
  const paso = { display:'flex', alignItems:'center', gap:'8px', fontSize:'.86rem', fontWeight:900, color:S.text, margin:'0 0 10px' }
  const numero = { width:'24px', height:'24px', borderRadius:'50%', background:S.cyan, color:'#0a1a05', fontWeight:900, fontSize:'.78rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {modalSlot && (
        <ModalReserva escenario={escenario} canchas={canchas} reservas={reservas} horas={horas} cancha={modalSlot.cancha} fecha={modalSlot.fecha} hora={modalSlot.hora}
          onClose={()=>setModalSlot(null)} onGuardado={guardado}/>
      )}
      {revisando && (
        <ModalRevisar reserva={revisando} canchas={canchas} encargado={encargado} soloLectura={soloLectura}
          onClose={()=>setRevisando(null)} onResuelto={resuelto}/>
      )}
      {gestionando && (
        <ModalGestionar reserva={gestionando} canchas={canchas} horas={horas} soloLectura={soloLectura}
          onClose={()=>setGestionando(null)} onResuelto={resueltoGestion}/>
      )}

      <div style={{ background:'rgba(10,10,10,.94)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', borderBottom:`1px solid ${S.border}`, padding:'10px 16px 14px', position:'sticky', top:0, zIndex:40 }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <BotonVolver onClick={() => navigate('/escenario/'+escenarioId)}/>
          <div style={{ fontWeight:900, fontSize:'1.2rem', marginTop:'10px', display:'flex', alignItems:'center', gap:8 }}><Goal size={20} color={S.cyan}/> Reservas de canchas</div>
          <div style={{ fontSize:'.8rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, border:`1px solid ${S.cyan}55`, color:S.cyan, borderRadius:12, padding:'12px 14px', fontSize:'.9rem', fontWeight:800, marginBottom:14, textAlign:'center' }}>{msg}</div>}

        {pendientesTodas.length > 0 && (
          <div style={{ background:'rgba(245,166,35,.1)', border:`1.5px solid ${S.warn}`, borderRadius:'14px', padding:'12px 14px', marginBottom:'18px' }}>
            <div style={{ fontWeight:900, fontSize:'.92rem', color:S.warn, marginBottom:'2px' }}><Bell size={15} style={{ verticalAlign:'-2px', marginRight:6 }}/>{pendientesTodas.length} {pendientesTodas.length>1?'clientes quieren reservar':'cliente quiere reservar'}</div>
            <div style={{ fontSize:'.76rem', color:S.text2, marginBottom:'6px' }}>Toca uno para aceptarlo o rechazarlo</div>
            {pendientesTodas.map((r,i) => (
              <button key={r.id} onClick={()=>irAPendiente(r)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', width:'100%', minHeight:'48px', textAlign:'left', background:'none', border:'none', borderTop: `1px solid rgba(245,166,35,.3)`, padding:'8px 0', cursor:'pointer', color:S.text, fontFamily:'inherit' }}>
                <span style={{ fontSize:'.84rem' }}>{fmtDate(r.fecha)} · {fmtHora12(r.hora)}<br/><span style={{ color:S.muted, fontSize:'.74rem' }}>{nombreCancha(canchas, r.cancha)}</span></span>
                <span style={{ fontSize:'.84rem', fontWeight:800, color:S.warn, flexShrink:0 }}>{r.nombre} ›</span>
              </button>
            ))}
          </div>
        )}

        {/* Paso 1: el día */}
        <div style={{ marginBottom:'20px' }}>
          <div style={paso}><span style={numero}>1</span> ¿Qué día?</div>
          <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'6px', WebkitOverflowScrolling:'touch' }}>
            {dias.map(d => {
              const sel = d.iso === fecha
              const pendiente = fechasPendientes.has(d.iso)
              return (
                <button key={d.iso} onClick={()=>{ setFecha(d.iso); setOtraFecha(false) }} aria-pressed={sel}
                  style={{ position:'relative', flexShrink:0, minWidth:'58px', minHeight:'72px', textAlign:'center', padding:'8px 6px', borderRadius:'14px', cursor:'pointer', fontFamily:'inherit',
                    border: sel ? `2px solid ${S.cyan}` : `1px solid ${S.border}`, background: sel ? S.cyanDim : S.card }}>
                  {pendiente && <span style={{ position:'absolute', top:'5px', right:'5px', width:'9px', height:'9px', borderRadius:'50%', background:S.warn }}/>}
                  <div style={{ fontSize:'.7rem', fontWeight:800, color: sel?S.cyan:S.muted }}>{d.etiqueta}</div>
                  <div style={{ fontSize:'1.15rem', fontWeight:900, color: sel?S.cyan:S.text, margin:'1px 0' }}>{d.num}</div>
                  <div style={{ fontSize:'.64rem', color:S.muted }}>{d.mes}</div>
                </button>
              )
            })}
          </div>
          {otraFecha
            ? <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{ ...inp, marginTop:'8px' }} aria-label="Elegir otra fecha"/>
            : <button onClick={()=>setOtraFecha(true)} style={{ background:'none', border:'none', color:S.cyan, fontWeight:800, fontSize:'.82rem', cursor:'pointer', padding:'8px 2px', minHeight:'40px', fontFamily:'inherit' }}><CalendarDays size={15} style={{ verticalAlign:'-3px', marginRight:5 }}/>Elegir otro día</button>}
        </div>

        {/* Paso 2: la cancha (solo si hay más de una) */}
        {canchas.length > 1 && (
          <div style={{ marginBottom:'20px' }}>
            <div style={paso}><span style={numero}>2</span> ¿Qué cancha?</div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {canchas.map(c => (
                <button key={c.id} onClick={()=>setCancha(c.slug)} aria-pressed={cancha===c.slug}
                  style={{ flex:'1 1 auto', minHeight:'50px', padding:'0 14px', borderRadius:'14px', border: cancha===c.slug ? `2px solid ${S.cyan}` : `1px solid ${S.border}`, cursor:'pointer', fontWeight:900, fontSize:'.92rem', fontFamily:'inherit', background: cancha===c.slug ? S.cyanDim : S.card, color: cancha===c.slug ? S.cyan : S.text2 }}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
        {canchas.length === 0 && (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px', marginBottom:'18px', textAlign:'center', fontSize:'.9rem', color:S.text2, lineHeight:1.5 }}>
            Todavía no hay canchas creadas.<br/>Agrégalas en <b>Ajustes del escenario</b> (en Más opciones del inicio).
          </div>
        )}

        {/* Paso 3: el horario */}
        {canchas.length > 0 && (
          <div>
            <div style={paso}><span style={numero}>{canchas.length > 1 ? 3 : 2}</span> {soloLectura ? 'Así están los horarios' : 'Toca un horario'}</div>
            <div style={{ fontSize:'.84rem', color:S.muted, margin:'-4px 0 12px 32px' }}>
              {fmtDate(fecha)} · <b style={{ color:S.win }}>{nLibres} {nLibres === 1 ? 'libre' : 'libres'}</b> · <b style={{ color:'#ff7b72' }}>{nOcupados} {nOcupados === 1 ? 'ocupado' : 'ocupados'}</b>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {horas.map((h, i) => {
                const est = estados[i]
                const r = est==='ocupado' ? reservaDeSlot(cancha, fecha, h) : null
                const rp = est==='pendiente' ? pendientesTodas.find(x => x.cancha === cancha && x.fecha === fecha && parseInt(h,10) >= parseInt(x.hora,10) && parseInt(h,10) < parseInt(x.hora,10) + Math.ceil((x.duracion||60)/60)) : null
                const mant = r && r.estado === 'mantenimiento'
                const pagado = r && !mant && r.pago === 'pagado'
                const parcial = r && !mant && r.pago === 'anticipo'
                let titulo, detalle, color, bg, borde, accion
                if (est === 'libre') { titulo = 'Libre'; detalle = ''; color = S.win; bg = S.card; borde = S.border; accion = soloLectura ? '' : 'Reservar +' }
                else if (est === 'pendiente') { titulo = rp?.nombre || 'Solicitud'; detalle = 'Quiere reservar — responde'; color = S.warn; bg = 'rgba(245,166,35,.1)'; borde = S.warn; accion = 'Responder ›' }
                else if (mant) { titulo = 'Cerrado'; detalle = 'Mantenimiento'; color = S.muted; bg = S.card; borde = S.border; accion = 'Ver ›' }
                else { titulo = r?.nombre || 'Reservado'; detalle = [r?.equipo, pagado ? 'Pagado' : parcial ? 'Pagó una parte' : 'Sin pagar'].filter(Boolean).join(' · '); color = pagado ? S.win : parcial ? S.gold : '#ff7b72'; bg = pagado ? 'rgba(111,207,61,.1)' : parcial ? 'rgba(245,166,35,.1)' : 'rgba(229,67,61,.1)'; borde = pagado ? S.win : parcial ? S.gold : S.loss; accion = 'Ver ›' }
                return (
                  <button key={h} onClick={() => est==='libre' ? abrir(cancha, fecha, h) : est==='pendiente' ? abrirRevisar(cancha, fecha, h) : abrirGestionar(cancha, fecha, h)}
                    disabled={est==='libre' && soloLectura}
                    style={{ display:'flex', alignItems:'center', gap:'12px', width:'100%', minHeight:'62px', padding:'8px 14px', background:bg, border:`1px solid ${borde}`, borderLeft:`5px solid ${color}`, borderRadius:'14px', cursor: est==='libre' && soloLectura ? 'default' : 'pointer', color:S.text, textAlign:'left', fontFamily:'inherit', boxSizing:'border-box' }}>
                    <span style={{ fontWeight:900, fontSize:'.98rem', width:'86px', flexShrink:0, whiteSpace:'nowrap' }}>{fmtHora12(h)}</span>
                    <span style={{ flex:1, minWidth:0 }}>
                      <span style={{ display:'block', fontWeight:800, fontSize:'.92rem', color: est==='libre' ? S.win : S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{titulo}</span>
                      {detalle && <span style={{ display:'block', fontSize:'.76rem', color, fontWeight:700, marginTop:'1px' }}>{detalle}</span>}
                    </span>
                    {accion && <span style={{ fontSize:'.8rem', fontWeight:900, color: est==='libre' ? S.cyan : S.muted, flexShrink:0 }}>{accion}</span>}
                  </button>
                )
              })}
              {horas.length === 0 && <div style={{ fontSize:'.88rem', color:S.muted, textAlign:'center', padding:'16px' }}>Este escenario no tiene horarios. Revisa los horarios en Ajustes del escenario.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
