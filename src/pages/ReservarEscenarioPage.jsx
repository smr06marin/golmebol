import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getHours, slotEstado, todayStr, fmtDate, precioCancha, fmtMoney } from '../lib/escenarioHelpers'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', warn: '#e8710a', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'11px 13px', color:S.text, fontSize:'.88rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.72rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.05em' }

export default function ReservarEscenarioPage() {
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [reservas,  setReservas]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [cancha,    setCancha]    = useState('futbol5')
  const [fecha,     setFecha]     = useState(todayStr())
  const [modalSlot, setModalSlot] = useState(null)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [equipo, setEquipo] = useState('')
  const [duracion, setDuracion] = useState(60)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    const { data } = await supabase.from('escenarios').select('*').eq('id', escenarioId).maybeSingle()
    if (!data) { setNotFound(true); setLoading(false); return }
    setEscenario(data)
    const { data: rsvs } = await supabase.from('escenario_reservas').select('cancha, fecha, hora, duracion, estado').eq('escenario_id', escenarioId)
    setReservas(rsvs || [])
    setLoading(false)
  }

  function abrirSlot(hora) {
    setModalSlot(hora); setNombre(''); setTelefono(''); setEquipo(''); setDuracion(60); setError(''); setExito(false)
  }

  async function enviarReserva() {
    if (!nombre.trim() || !telefono.trim()) { setError('Nombre y teléfono son obligatorios'); return }
    setEnviando(true); setError('')
    const monto = precioCancha(escenario, cancha)
    const { error: errIns } = await supabase.from('escenario_reservas').insert({
      escenario_id: escenario.id, cancha, fecha, hora: modalSlot, duracion,
      nombre: nombre.trim(), telefono: telefono.trim(), equipo: equipo.trim() || null,
      estado: 'pendiente', pago: 'pendiente', monto, monto_pagado: 0,
    })
    setEnviando(false)
    if (errIns) { setError('No se pudo enviar la solicitud: ' + errIns.message); return }
    if (escenario.whatsapp) {
      const msg = `Hola, quiero reservar la cancha de ${cancha==='futbol5'?'Fútbol 5':'Fútbol 7'}.\n` +
        `Nombre: ${nombre}\nTeléfono: ${telefono}\nEquipo: ${equipo||'-'}\nFecha: ${fecha}\nHora: ${modalSlot}\nDuración: ${duracion} min`
      window.open(`https://wa.me/${escenario.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank')
    }
    setExito(true)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (notFound) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center' }}>Este link de reserva no es válido.</div>
  )

  const horas = getHours(escenario)

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{
        position:'relative', padding:'34px 16px 22px', textAlign:'center', overflow:'hidden',
        borderBottom:`0.5px solid ${S.border}`,
        ...(escenario?.imagen_fondo_url
          ? { backgroundImage:`linear-gradient(180deg, rgba(7,7,14,.55), rgba(7,7,14,.92)), url(${escenario.imagen_fondo_url})`, backgroundSize:'cover', backgroundPosition:'center' }
          : { background:S.surface }),
      }}>
        {escenario?.logo_url ? (
          <img src={escenario.logo_url} style={{ width:'56px', height:'56px', borderRadius:'14px', objectFit:'cover', marginBottom:'10px', border:`2px solid ${S.border}` }}/>
        ) : (
          <div style={{ width:'56px', height:'56px', borderRadius:'14px', background:S.card2, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', border:`2px solid ${S.border}` }}>
            <Building2 size={26} color={S.cyan}/>
          </div>
        )}
        <div style={{ fontSize:'.7rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em' }}>Reserva de cancha · Golmebol</div>
        <div style={{ fontWeight:900, fontSize:'1.2rem', marginTop:4 }}>{escenario?.name}</div>
        {escenario?.city && <div style={{ fontSize:'.78rem', color:S.text2, marginTop:2 }}>{escenario.city}</div>}
      </div>

      <div style={{ maxWidth:'520px', margin:'0 auto', padding:'20px 16px' }}>
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          {['futbol5','futbol7'].map(c => (
            <button key={c} onClick={()=>setCancha(c)}
              style={{ flex:1, padding:'11px', borderRadius:'10px', border:'none', cursor:'pointer', fontWeight:800, fontSize:'.85rem', background: cancha===c?S.cyan:S.card, color: cancha===c?'#000':S.muted }}>
              {c==='futbol5'?'Fútbol 5':'Fútbol 7'} · {fmtMoney(precioCancha(escenario,c))}/h
            </button>
          ))}
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={lbl}>Fecha</label>
          <input type="date" min={todayStr()} value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {horas.map(h => {
            const est = slotEstado(reservas, cancha, fecha, h)
            const label = est==='libre' ? '🟢 Disponible' : est==='pendiente' ? '🟡 Solicitud pendiente' : '🔴 Ocupado'
            const color = est==='libre' ? S.win : est==='pendiente' ? S.warn : S.loss
            return (
              <div key={h} onClick={() => est==='libre' && abrirSlot(h)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', cursor: est==='libre'?'pointer':'default' }}>
                <span style={{ fontWeight:700, fontSize:'.85rem' }}>{h}</span>
                <span style={{ fontSize:'.78rem', color, fontWeight:600 }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {modalSlot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
            {exito ? (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'2.2rem', marginBottom:10 }}>✅</div>
                <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:8 }}>¡Solicitud enviada!</div>
                <div style={{ fontSize:'.82rem', color:S.text2, lineHeight:1.5, marginBottom:18 }}>
                  Tu reserva de {cancha==='futbol5'?'Fútbol 5':'Fútbol 7'} el {fmtDate(fecha)} a las {modalSlot} quedó pendiente de aprobación del escenario.
                </div>
                <button onClick={()=>setModalSlot(null)} style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>Listo</button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <div style={{ fontWeight:800, fontSize:'1rem' }}>Reservar {cancha==='futbol5'?'Fútbol 5':'Fútbol 7'}</div>
                  <button onClick={()=>setModalSlot(null)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
                </div>
                <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>{fmtDate(fecha)} — {modalSlot} · {fmtMoney(precioCancha(escenario,cancha))}/h</div>
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Nombre *</label><input value={nombre} onChange={e=>setNombre(e.target.value)} style={inp} placeholder="Tu nombre"/></div>
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Teléfono *</label><input value={telefono} onChange={e=>setTelefono(e.target.value)} style={inp} placeholder="3001234567"/></div>
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Equipo (opcional)</label><input value={equipo} onChange={e=>setEquipo(e.target.value)} style={inp} placeholder="Nombre del equipo"/></div>
                <div style={{ marginBottom:'18px' }}>
                  <label style={lbl}>Duración</label>
                  <select value={duracion} onChange={e=>setDuracion(parseInt(e.target.value))} style={inp}>
                    <option value={60}>1 hora</option><option value={90}>1.5 horas</option><option value={120}>2 horas</option>
                  </select>
                </div>
                {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'14px' }}>{error}</div>}
                <button onClick={enviarReserva} disabled={enviando}
                  style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem', opacity:enviando?.7:1 }}>
                  {enviando ? 'Enviando...' : 'Pedir reserva'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
