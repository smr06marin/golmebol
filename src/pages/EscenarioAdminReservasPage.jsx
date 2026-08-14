import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getHours, slotEstado, todayStr, fmtDate, fmtMoney, nombreCancha, asegurarReservasFijas, fechaLocalStr } from '../lib/escenarioHelpers'
import { fmtHora12 } from '../lib/horaHelpers'
import { X } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', warn: '#e8710a', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'9px 12px', color:S.text, fontSize:'.82rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.68rem', color:S.muted, display:'block', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.05em' }
const card = { background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', marginBottom:'14px' }
const rowItem = { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:`1px solid ${S.border}` }

export default function EscenarioAdminReservasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [canchas,   setCanchas]   = useState([])
  const [reservas,  setReservas]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState('')
  const [mCancha,   setMCancha]   = useState(null)
  const [mFecha,    setMFecha]    = useState(todayStr())
  const [mHora,     setMHora]     = useState('')
  const [waConfirm, setWaConfirm] = useState(null) // { link, nombre } — confirmación pendiente de enviar por WhatsApp

  const [gestionando, setGestionando] = useState(null) // reserva que se está cancelando/reprogramando
  const [modoGestion, setModoGestion] = useState(null) // 'cancelar' | 'reprogramar'
  const [reForm, setReForm] = useState({ cancha:'', fecha:'', hora:'' })
  const [errorGestion, setErrorGestion] = useState('')
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
    setEncargado(p)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    const { data: cs } = await supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true).order('orden')
    setCanchas(cs || [])
    setMCancha(prev => prev || (cs && cs[0] ? cs[0].slug : null))
    await asegurarReservasFijas(escenarioId)
    const { data: rsvs } = await supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId)
    setReservas(rsvs || [])
    if (!mHora && esc) setMHora(getHours(esc)[0] || '08:00')
    setLoading(false)
  }

  function showMsg(t) { setMsg(t); setTimeout(()=>setMsg(''),3000) }

  async function aceptar(r) {
    let payload = { estado:'aceptada', aceptada_por: encargado?.id || null, aceptada_por_nombre: encargado?.name || null }
    let { error } = await supabase.from('escenario_reservas').update(payload).eq('id', r.id)
    let avisoDegradado = null
    if (error && (error.message?.includes('aceptada_por'))) {
      // Falta correr migracion_escenario_reservas_aceptada_por.sql en Supabase
      payload = { estado:'aceptada' }
      ;({ error } = await supabase.from('escenario_reservas').update(payload).eq('id', r.id))
      avisoDegradado = 'Aceptada, pero no se guardó quién la aceptó: ejecuta migracion_escenario_reservas_aceptada_por.sql en Supabase'
    }
    if (r.recurrente) {
      const filas = []
      for (let i=1;i<=8;i++) {
        const d = new Date(r.fecha+'T00:00:00'); d.setDate(d.getDate()+7*i)
        filas.push({
          escenario_id: r.escenario_id, cancha: r.cancha, fecha: fechaLocalStr(d), hora: r.hora, duracion: r.duracion,
          nombre: r.nombre, telefono: r.telefono, equipo: r.equipo, estado:'aceptada', pago:'pendiente', monto:r.monto, monto_pagado:0,
          recurrente:false, generada_de_recurrente:true,
        })
      }
      await supabase.from('escenario_reservas').insert(filas)
    }
    // El navegador bloquea el window.open automático acá (pasa después de un
    // await) — se deja un botón para que el encargado lo abra él mismo.
    if (escenario?.whatsapp) {
      const msgTxt = `Hola ${r.nombre}, tu reserva de ${nombreCancha(canchas, r.cancha)} el ${r.fecha} a las ${fmtHora12(r.hora)} fue confirmada. ¡Te esperamos!`
      setWaConfirm({ link: `https://wa.me/${escenario.whatsapp}?text=${encodeURIComponent(msgTxt)}`, nombre: r.nombre })
    }
    showMsg(avisoDegradado || '✅ Reserva aceptada')
    fetchTodo()
  }
  async function rechazar(r) {
    await supabase.from('escenario_reservas').update({ estado:'rechazada' }).eq('id', r.id)
    showMsg('Solicitud rechazada'); fetchTodo()
  }
  async function cambiarPago(r, valor) {
    const payload = { pago: valor }
    if (valor === 'pagado') payload.monto_pagado = r.monto
    await supabase.from('escenario_reservas').update(payload).eq('id', r.id)
    fetchTodo()
  }
  async function bloquear() {
    if (!escenario) return
    await supabase.from('escenario_reservas').insert({
      escenario_id: escenario.id, cancha: mCancha, fecha: mFecha, hora: mHora, duracion:60,
      nombre:'Mantenimiento', telefono:'', equipo:'', estado:'mantenimiento', pago:'pagado', monto:0,
    })
    showMsg('Horario bloqueado'); fetchTodo()
  }

  function abrirCancelar(r) { setGestionando(r); setModoGestion('cancelar'); setErrorGestion('') }
  function abrirReprogramar(r) { setGestionando(r); setModoGestion('reprogramar'); setReForm({ cancha:r.cancha, fecha:r.fecha, hora:r.hora }); setErrorGestion('') }
  function cerrarGestion() { setGestionando(null); setModoGestion(null); setErrorGestion('') }

  async function cancelarReserva(motivo) {
    await supabase.from('escenario_reservas').update({ estado:'cancelada', motivo_cancelacion: motivo }).eq('id', gestionando.id)
    cerrarGestion(); showMsg('Reserva cancelada — el horario quedó libre'); fetchTodo()
  }

  async function confirmarReprogramar() {
    if (!reForm.cancha || !reForm.fecha || !reForm.hora) { setErrorGestion('Completa cancha, fecha y hora'); return }
    // Se excluye la reserva actual de la comprobación de disponibilidad —
    // si no, chocaría consigo misma cuando la cancha/fecha/hora no cambian.
    const otras = reservas.filter(x => x.id !== gestionando.id)
    if (slotEstado(otras, reForm.cancha, reForm.fecha, reForm.hora) !== 'libre') { setErrorGestion('Ese horario ya está ocupado'); return }
    await supabase.from('escenario_reservas').update({ cancha: reForm.cancha, fecha: reForm.fecha, hora: reForm.hora }).eq('id', gestionando.id)
    cerrarGestion(); showMsg('Reserva reprogramada'); fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const pendientes = reservas.filter(r=>r.estado==='pendiente').sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora))
  const aceptadas = reservas.filter(r=>r.estado==='aceptada').sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).slice(0,20)
  const canceladas = reservas.filter(r=>r.estado==='cancelada').sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora)).slice(0,10)

  const clientesMap = {}
  reservas.forEach(r => {
    if (r.estado !== 'aceptada') return
    clientesMap[r.telefono] = clientesMap[r.telefono] || { nombre:r.nombre, telefono:r.telefono, reservas:0, pendiente:0 }
    clientesMap[r.telefono].reservas++
    if (r.pago !== 'pagado') clientesMap[r.telefono].pendiente += Math.max((r.monto||0)-(r.monto_pagado||0),0)
  })
  const clientes = Object.values(clientesMap)

  const ocupacion = {}
  canchas.forEach(c => { ocupacion[c.slug] = 0 })
  const horas = escenario ? getHours(escenario) : []
  const totalSlotsSemana = horas.length * 7
  const hoy = new Date()
  for (let i=0;i<7;i++) {
    const d = new Date(hoy); d.setDate(d.getDate()+i)
    const f = fechaLocalStr(d)
    canchas.forEach(c => { horas.forEach(h => { if (slotEstado(reservas,c.slug,f,h)==='ocupado') ocupacion[c.slug]++ }) })
  }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>✅ Solicitudes de cancha</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        {waConfirm && (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'12px 14px', marginBottom:'14px' }}>
            <span style={{ flex:1, fontSize:'.78rem', color:S.text2 }}>Reserva de {waConfirm.nombre} aceptada. ¿Le avisás por WhatsApp?</span>
            <a href={waConfirm.link} target="_blank" rel="noreferrer" onClick={()=>setWaConfirm(null)}
              style={{ padding:'8px 14px', background:'#25D366', borderRadius:'8px', color:'#fff', fontWeight:700, fontSize:'.75rem', textDecoration:'none', whiteSpace:'nowrap' }}>
              📲 WhatsApp
            </a>
            <button onClick={()=>setWaConfirm(null)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:'.75rem' }}>✕</button>
          </div>
        )}

        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Solicitudes pendientes</div>
          {pendientes.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>No hay solicitudes pendientes.</div> : pendientes.map(r => (
            <div key={r.id} style={rowItem}>
              <span style={{ fontSize:'.8rem' }}>{fmtDate(r.fecha)} {fmtHora12(r.hora)} · {nombreCancha(canchas, r.cancha)} · {r.nombre} ({r.telefono}){r.recurrente?' 🔁':''}</span>
              {!soloLectura && (
              <span style={{ display:'flex', gap:'6px' }}>
                <button onClick={()=>aceptar(r)} style={{ padding:'5px 10px', background:S.cyan, border:'none', borderRadius:'6px', cursor:'pointer', color:'#000', fontWeight:700, fontSize:'.72rem' }}>Aceptar</button>
                <button onClick={()=>rechazar(r)} style={{ padding:'5px 10px', background:'none', border:`1px solid ${S.loss}`, borderRadius:'6px', cursor:'pointer', color:S.loss, fontSize:'.72rem' }}>Rechazar</button>
              </span>
              )}
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Reservas confirmadas próximas</div>
          {aceptadas.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin reservas confirmadas.</div> : aceptadas.map(r => (
            <div key={r.id} style={{ ...rowItem, flexDirection:'column', alignItems:'stretch', gap:'8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'.8rem' }}>
                  {fmtDate(r.fecha)} {fmtHora12(r.hora)} · {nombreCancha(canchas, r.cancha)} · {r.nombre}
                  {(r.recurrente || r.generada_de_recurrente || r.reserva_fija_id) ? ' 🔁' : ''}
                  {r.aceptada_por_nombre && <span style={{ display:'block', fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Aceptada por {r.aceptada_por_nombre}</span>}
                </span>
                {soloLectura ? (
                  <span style={{ fontSize:'.72rem', color:S.text2, fontWeight:700 }}>{r.pago === 'pagado' ? 'Pagado' : r.pago === 'anticipo' ? 'Anticipo' : 'Pendiente'}</span>
                ) : (
                <select value={r.pago} onChange={e=>cambiarPago(r,e.target.value)} style={{ ...inp, width:'auto', padding:'5px 8px', fontSize:'.72rem' }}>
                  <option value="pendiente">Pendiente</option><option value="anticipo">Anticipo</option><option value="pagado">Pagado</option>
                </select>
                )}
              </div>
              {!soloLectura && (
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={()=>abrirReprogramar(r)} style={{ flex:1, padding:'5px 8px', background:'none', border:`1px solid ${S.border}`, borderRadius:'6px', cursor:'pointer', color:S.text2, fontSize:'.7rem', fontWeight:600 }}>Reprogramar</button>
                <button onClick={()=>abrirCancelar(r)} style={{ flex:1, padding:'5px 8px', background:'none', border:`1px solid ${S.loss}`, borderRadius:'6px', cursor:'pointer', color:S.loss, fontSize:'.7rem', fontWeight:600 }}>Cancelar</button>
              </div>
              )}
            </div>
          ))}
        </div>

        {!soloLectura && (
        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>🛠️ Bloquear horario (mantenimiento)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div><label style={lbl}>Cancha</label><select value={mCancha||''} onChange={e=>setMCancha(e.target.value)} style={inp}>{canchas.map(c=><option key={c.id} value={c.slug}>{c.nombre}</option>)}</select></div>
            <div><label style={lbl}>Fecha</label><input type="date" value={mFecha} onChange={e=>setMFecha(e.target.value)} style={inp}/></div>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Hora</label><select value={mHora} onChange={e=>setMHora(e.target.value)} style={inp}>{horas.map(h=><option key={h} value={h}>{fmtHora12(h)}</option>)}</select></div>
          </div>
          <button onClick={bloquear} style={{ width:'100%', padding:'10px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text, fontWeight:700, fontSize:'.8rem' }}>Bloquear</button>
        </div>
        )}

        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>📊 Ocupación de la semana</div>
          {canchas.map((c,i) => (
            <div key={c.id} style={i===canchas.length-1 ? {...rowItem, borderBottom:'none'} : rowItem}>
              <span style={{fontSize:'.8rem'}}>{c.nombre}</span>
              <span style={{fontSize:'.8rem', fontWeight:700, color:S.cyan}}>{totalSlotsSemana?Math.round((ocupacion[c.slug]||0)/totalSlotsSemana*100):0}%</span>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>👥 Historial de clientes</div>
          {clientes.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Aún no hay clientes con reservas confirmadas.</div> : clientes.map(c => (
            <div key={c.telefono} style={rowItem}>
              <span style={{fontSize:'.8rem'}}>{c.nombre} ({c.telefono})</span>
              <span style={{fontSize:'.78rem', color: c.pendiente>0?S.warn:S.win}}>{c.reservas} reservas · {c.pendiente>0?fmtMoney(c.pendiente)+' pend.':'al día'}</span>
            </div>
          ))}
        </div>

        <div style={{...card, marginBottom:0}}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>🚫 Canceladas recientes</div>
          {canceladas.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>No hay reservas canceladas.</div> : canceladas.map(r => (
            <div key={r.id} style={rowItem}>
              <span style={{fontSize:'.8rem'}}>{fmtDate(r.fecha)} {fmtHora12(r.hora)} · {nombreCancha(canchas, r.cancha)} · {r.nombre}</span>
              <span style={{fontSize:'.72rem', color:S.muted}}>{r.motivo_cancelacion === 'no_show' ? 'No llegó' : r.motivo_cancelacion === 'ultima_hora' ? 'Última hora' : 'Cancelada'}</span>
            </div>
          ))}
        </div>
      </div>

      {gestionando && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ fontWeight:800, fontSize:'1rem' }}>{modoGestion === 'cancelar' ? 'Cancelar reserva' : 'Reprogramar reserva'}</div>
              <button onClick={cerrarGestion} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
            </div>
            <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>
              {gestionando.nombre} · {fmtDate(gestionando.fecha)} {fmtHora12(gestionando.hora)} · {nombreCancha(canchas, gestionando.cancha)}
            </div>

            {modoGestion === 'cancelar' ? (
              <>
                <div style={{ fontSize:'.8rem', color:S.text2, marginBottom:'14px' }}>¿Por qué se cancela? El horario queda libre para otra reserva.</div>
                <button onClick={()=>cancelarReserva('no_show')} style={{ width:'100%', padding:'12px', marginBottom:'8px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text, fontWeight:700, fontSize:'.82rem' }}>No llegó</button>
                <button onClick={()=>cancelarReserva('ultima_hora')} style={{ width:'100%', padding:'12px', marginBottom:'8px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text, fontWeight:700, fontSize:'.82rem' }}>Canceló a última hora</button>
                <button onClick={cerrarGestion} style={{ width:'100%', padding:'10px', background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:'.78rem' }}>Volver</button>
              </>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                  <div><label style={lbl}>Cancha</label><select value={reForm.cancha} onChange={e=>setReForm(f=>({...f,cancha:e.target.value}))} style={inp}>{canchas.map(c=><option key={c.id} value={c.slug}>{c.nombre}</option>)}</select></div>
                  <div><label style={lbl}>Fecha</label><input type="date" value={reForm.fecha} onChange={e=>setReForm(f=>({...f,fecha:e.target.value}))} style={inp}/></div>
                </div>
                <div style={{ marginBottom:'14px' }}><label style={lbl}>Hora</label><select value={reForm.hora} onChange={e=>setReForm(f=>({...f,hora:e.target.value}))} style={inp}>{horas.map(h=><option key={h} value={h}>{fmtHora12(h)}</option>)}</select></div>
                {errorGestion && <div style={{ color:S.loss, fontSize:'.78rem', marginBottom:'12px' }}>{errorGestion}</div>}
                <button onClick={confirmarReprogramar} style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>Confirmar nuevo horario</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
