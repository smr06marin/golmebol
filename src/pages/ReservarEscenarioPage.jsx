import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, MapPin, ChevronRight, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { supabase } from '../lib/supabase'
import { getHours, slotEstado, todayStr, fmtDate, precioCancha, fmtMoney, escenarioActivo } from '../lib/escenarioHelpers'

// Tema claro tipo landing page — distinto del resto del portal (que es
// oscuro) porque esta es la página pública que un cliente cualquiera ve
// desde el link de WhatsApp, no un panel interno.
const S = {
  bg: '#f4f6f5', card: '#ffffff', border: '#e7ebe9',
  green: '#22c55e', greenDark: '#16a34a', greenDim: 'rgba(34,197,94,.1)',
  text: '#12181a', text2: '#4b5a56', muted: '#8a9490',
  win: '#16a34a', warn: '#d97706', loss: '#dc2626',
}
const inp = { width:'100%', background:'#fff', border:`1.5px solid ${S.border}`, borderRadius:'10px', padding:'11px 13px', color:S.text, fontSize:'.88rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.72rem', fontWeight:'700', color:S.muted, display:'block', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.05em' }

const CANCHA_LABEL = { futbol5: 'Cancha 5', futbol7: 'Cancha 7' }

function fmtHora12(h) {
  const n = parseInt(h, 10)
  const ampm = n >= 12 ? 'PM' : 'AM'
  let h12 = n % 12
  if (h12 === 0) h12 = 12
  return `${h12}:00 ${ampm}`
}

// Próximos días para la tira de fechas — Hoy / Mañana / día de semana + fecha.
function proximosDias(n = 10) {
  const dias = []
  const hoy = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1).replace('.', '')
    dias.push({
      iso,
      etiqueta: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : cap(d.toLocaleDateString('es-CO', { weekday: 'short' })),
      num: d.getDate(),
      mes: cap(d.toLocaleDateString('es-CO', { month: 'short' })),
    })
  }
  return dias
}

export default function ReservarEscenarioPage() {
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [reservas,  setReservas]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [cancha,    setCancha]    = useState('futbol5')
  const [fecha,     setFecha]     = useState(todayStr())
  const [horaSel,   setHoraSel]   = useState(null)
  const [modalSlot, setModalSlot] = useState(null)
  const fechasRef = useRef(null)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [equipo, setEquipo] = useState('')
  const [duracion, setDuracion] = useState(60)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [waLink, setWaLink] = useState(null)

  useEffect(() => { fetchTodo() }, [escenarioId])
  useEffect(() => { setHoraSel(null) }, [fecha, cancha])

  async function fetchTodo() {
    setLoading(true)
    const { data } = await supabase.from('escenarios').select('*').eq('id', escenarioId).maybeSingle()
    if (!data) { setNotFound(true); setLoading(false); return }
    setEscenario(data)
    const { data: rsvs } = await supabase.from('escenario_reservas').select('cancha, fecha, hora, duracion, estado').eq('escenario_id', escenarioId)
    setReservas(rsvs || [])
    setLoading(false)
  }

  function abrirSlot() {
    if (!horaSel) return
    setModalSlot(horaSel); setNombre(''); setTelefono(''); setEquipo(''); setDuracion(60); setError(''); setExito(false); setWaLink(null)
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
    // El navegador bloquea el window.open automático acá porque pasa después
    // de un await (ya no cuenta como "click directo del usuario") — en vez de
    // intentar abrirlo solo, se muestra un botón para que la persona lo abra
    // ella misma con un click, así funciona siempre (celular y escritorio).
    if (escenario.whatsapp) {
      const msg = `Hola, quiero reservar la ${CANCHA_LABEL[cancha]}.\n` +
        `Nombre: ${nombre}\nTeléfono: ${telefono}\nEquipo: ${equipo||'-'}\nFecha: ${fecha}\nHora: ${modalSlot}\nDuración: ${duracion} min`
      setWaLink(`https://wa.me/${escenario.whatsapp}?text=${encodeURIComponent(msg)}`)
    } else {
      setWaLink(null)
    }
    setExito(true)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.bg, display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (notFound) return (
    <div style={{ minHeight:'100vh', background:S.bg, display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center' }}>Este link de reserva no es válido.</div>
  )
  if (!escenarioActivo(escenario)) return (
    <div style={{ minHeight:'100vh', background:S.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center', gap:'12px' }}>
      <div style={{ fontSize:'2.2rem' }}>🔒</div>
      <div style={{ fontWeight:800, fontSize:'1rem', color:S.text }}>{escenario.name} no está disponible por ahora</div>
      <div style={{ maxWidth:'320px', lineHeight:1.5 }}>Este escenario no está aceptando reservas en este momento. Intentá más tarde o contactá directamente al lugar.</div>
    </div>
  )

  const horas = getHours(escenario)
  const dias = proximosDias()
  const waHref = escenario?.whatsapp ? `https://wa.me/${escenario.whatsapp}?text=${encodeURIComponent('Hola, quiero reservar una cancha en ' + escenario.name)}` : null

  return (
    <div style={{ minHeight:'100vh', background:S.bg, fontFamily:'system-ui,sans-serif', color:S.text }}>

      {/* Header */}
      <div style={{ background:'#fff', borderBottom:`1px solid ${S.border}`, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
            {escenario?.logo_url ? (
              <img src={escenario.logo_url} style={{ width:36, height:36, borderRadius:9, objectFit:'cover', flexShrink:0 }}/>
            ) : (
              <div style={{ width:36, height:36, borderRadius:9, background:S.greenDim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Building2 size={19} color={S.greenDark}/>
              </div>
            )}
            <div style={{ fontWeight:900, fontSize:'1rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{escenario?.name}</div>
          </div>
          {waHref && (
            <a href={waHref} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:7, border:`1.5px solid ${S.green}`, borderRadius:999, padding:'8px 16px', color:S.greenDark, fontWeight:800, fontSize:'.8rem', textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
              <FaWhatsapp size={15}/> Reservar por WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{
        position:'relative', padding:'56px 20px 100px', overflow:'hidden',
        ...(escenario?.imagen_fondo_url
          ? { backgroundImage:`linear-gradient(100deg, rgba(7,10,9,.82) 0%, rgba(7,10,9,.35) 60%), url(${escenario.imagen_fondo_url})`, backgroundSize:'cover', backgroundPosition:'center' }
          : { background:'linear-gradient(135deg, #0f1a16, #17231d)' }),
      }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto', color:'#fff' }}>
          {escenario?.city && (
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.78rem', fontWeight:700, color:'#d6ffe8', marginBottom:14 }}>
              <MapPin size={13}/> {escenario.city}
            </div>
          )}
          <div style={{ fontSize:'2.1rem', fontWeight:900, lineHeight:1.15, maxWidth:520 }}>
            Reserva tu <span style={{ color:S.green }}>cancha</span><br/>en segundos
          </div>
          <div style={{ fontSize:'.85rem', color:'#c9d6d1', marginTop:16 }}>
            Horario: {fmtHora12(String(escenario?.hora_apertura ?? 8).padStart(2,'0')+':00')} – {fmtHora12(String(escenario?.hora_cierre ?? 22).padStart(2,'0')+':00')}
          </div>
        </div>
      </div>

      {/* Tarjeta de reserva — se monta sobre el hero */}
      <div style={{ maxWidth:'1000px', margin:'-64px auto 0', padding:'0 16px 40px', position:'relative' }}>
        <div style={{ background:S.card, borderRadius:20, boxShadow:'0 12px 40px rgba(20,30,25,.12)', padding:'26px 22px', display:'flex', flexDirection:'column', gap:26 }}>

          {/* Paso 1: fecha */}
          <div>
            <StepLabel n={1} texto="Elige la fecha"/>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div ref={fechasRef} style={{ display:'flex', gap:9, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
                {dias.map(d => {
                  const sel = d.iso === fecha
                  return (
                    <button key={d.iso} onClick={() => setFecha(d.iso)}
                      style={{ flexShrink:0, minWidth:64, textAlign:'center', padding:'10px 8px', borderRadius:12, cursor:'pointer',
                        border: sel ? `2px solid ${S.green}` : `1.5px solid ${S.border}`, background: sel ? S.greenDim : '#fff' }}>
                      <div style={{ fontSize:'.68rem', fontWeight:700, color: sel ? S.greenDark : S.muted }}>{d.etiqueta}</div>
                      <div style={{ fontSize:'1.15rem', fontWeight:900, color: sel ? S.greenDark : S.text, margin:'2px 0' }}>{d.num}</div>
                      <div style={{ fontSize:'.66rem', color:S.muted }}>{d.mes}</div>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => fechasRef.current?.scrollBy({ left: 160, behavior:'smooth' })}
                style={{ flexShrink:0, width:34, height:34, borderRadius:'50%', border:`1px solid ${S.border}`, background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:S.muted }}>
                <ChevronRight size={16}/>
              </button>
            </div>
          </div>

          {/* Paso 2: cancha */}
          <div>
            <StepLabel n={2} texto="Elige la cancha"/>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {['futbol5','futbol7'].map(c => {
                const sel = cancha === c
                return (
                  <button key={c} onClick={() => setCancha(c)}
                    style={{ flex:'1 1 160px', display:'flex', alignItems:'center', gap:10, padding:'13px 16px', borderRadius:12, cursor:'pointer',
                      border: sel ? `2px solid ${S.green}` : `1.5px solid ${S.border}`, background: sel ? S.greenDim : '#fff' }}>
                    <Building2 size={18} color={sel ? S.greenDark : S.muted}/>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontWeight:800, fontSize:'.9rem', color: sel ? S.greenDark : S.text }}>{CANCHA_LABEL[c]}</div>
                      <div style={{ fontSize:'.72rem', color:S.muted }}>{fmtMoney(precioCancha(escenario, c))}/hora</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Paso 3: hora */}
          <div>
            <StepLabel n={3} texto="Elige la hora"/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:10 }}>
              {horas.map(h => {
                const est = slotEstado(reservas, cancha, fecha, h)
                const sel = horaSel === h
                const libre = est === 'libre'
                const color = est === 'libre' ? S.win : est === 'pendiente' ? S.warn : S.loss
                const label = est === 'libre' ? 'Disponible' : est === 'pendiente' ? 'Pendiente' : 'Ocupado'
                return (
                  <button key={h} onClick={() => libre && setHoraSel(h)} disabled={!libre}
                    style={{ padding:'12px 10px', borderRadius:12, textAlign:'left', cursor: libre ? 'pointer' : 'not-allowed',
                      border: sel ? `2px solid ${S.green}` : est === 'ocupado' ? `1.5px solid #f3d3d3` : `1.5px solid ${S.border}`,
                      background: sel ? S.greenDim : est === 'ocupado' ? '#fdf4f4' : '#fff' }}>
                    <div style={{ fontWeight:800, fontSize:'.92rem', color: sel ? S.greenDark : S.text }}>{fmtHora12(h)}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'.7rem', color, fontWeight:700, marginTop:3 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }}/>
                      {label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* CTA */}
          <button onClick={abrirSlot} disabled={!horaSel}
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', cursor: horaSel ? 'pointer' : 'not-allowed',
              background: horaSel ? `linear-gradient(135deg, ${S.green}, ${S.greenDark})` : '#e5e9e7', color: horaSel ? '#fff' : S.muted,
              fontWeight:900, fontSize:'.95rem', textAlign:'center', boxShadow: horaSel ? '0 8px 22px rgba(34,197,94,.35)' : 'none' }}>
            {horaSel ? (
              <>Reservar {fmtHora12(horaSel)}<div style={{ fontWeight:600, fontSize:'.76rem', marginTop:2, opacity:.9 }}>{CANCHA_LABEL[cancha]} – {fmtDate(fecha)}</div></>
            ) : 'Elige una hora disponible'}
          </button>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:'.72rem', color:S.muted, marginTop:-14 }}>
            🔒 Tu reserva está 100% segura
          </div>
        </div>

        {/* Dónde estamos */}
        {escenario?.direccion && (
          <div style={{ background:S.card, borderRadius:20, boxShadow:'0 4px 18px rgba(20,30,25,.06)', padding:'22px', marginTop:20 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:S.greenDim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <MapPin size={18} color={S.greenDark}/>
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:'.95rem' }}>¿Dónde estamos?</div>
                <div style={{ fontSize:'.82rem', color:S.text2, marginTop:2 }}>{escenario.direccion}</div>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(escenario.direccion)}`} target="_blank" rel="noreferrer"
                  style={{ fontSize:'.78rem', color:S.greenDark, fontWeight:700, textDecoration:'none' }}>Ver en Google Maps ↗</a>
              </div>
            </div>
            <div style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${S.border}`, height:200 }}>
              <iframe title="Mapa" width="100%" height="100%" style={{ border:0, display:'block' }} loading="lazy"
                src={`https://www.google.com/maps?q=${encodeURIComponent(escenario.direccion)}&output=embed`}/>
            </div>
          </div>
        )}

        {/* Footer CTA */}
        {waHref && (
          <div style={{ background:S.card, borderRadius:20, boxShadow:'0 4px 18px rgba(20,30,25,.06)', padding:'22px', marginTop:20, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontWeight:800, fontSize:'.95rem' }}>¿Listo para jugar?</div>
              <div style={{ fontSize:'.78rem', color:S.muted, marginTop:2 }}>Reserva ahora por WhatsApp y asegura tu hora.</div>
            </div>
            <a href={waHref} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:8, background:S.green, borderRadius:12, padding:'12px 20px', color:'#fff', fontWeight:800, fontSize:'.85rem', textDecoration:'none', whiteSpace:'nowrap' }}>
              <FaWhatsapp size={17}/> Reservar por WhatsApp
            </a>
          </div>
        )}
      </div>

      {modalSlot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,15,13,.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'18px', padding:'24px', width:'380px', maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            {exito ? (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'2.2rem', marginBottom:10 }}>✅</div>
                <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:8 }}>¡Solicitud enviada!</div>
                <div style={{ fontSize:'.82rem', color:S.text2, lineHeight:1.5, marginBottom:18 }}>
                  Tu reserva de {CANCHA_LABEL[cancha]} el {fmtDate(fecha)} a las {fmtHora12(modalSlot)} quedó pendiente de aprobación del escenario.
                </div>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noreferrer"
                    style={{ display:'block', width:'100%', padding:'13px', marginBottom:'10px', background:'#25D366', borderRadius:'10px', color:'#fff', fontWeight:800, fontSize:'.85rem', textDecoration:'none', boxSizing:'border-box' }}>
                    📲 Confirmar por WhatsApp
                  </a>
                )}
                <button onClick={()=>setModalSlot(null)} style={{ width:'100%', padding:'12px', background: waLink ? 'none' : S.green, border: waLink ? `1px solid ${S.border}` : 'none', borderRadius:'10px', cursor:'pointer', color: waLink ? S.muted : '#fff', fontWeight:800, fontSize:'.85rem' }}>
                  {waLink ? 'Cerrar' : 'Listo'}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <div style={{ fontWeight:800, fontSize:'1rem' }}>Reservar {CANCHA_LABEL[cancha]}</div>
                  <button onClick={()=>setModalSlot(null)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
                </div>
                <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>{fmtDate(fecha)} — {fmtHora12(modalSlot)} · {fmtMoney(precioCancha(escenario,cancha))}/h</div>
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Nombre *</label><input value={nombre} onChange={e=>setNombre(e.target.value)} style={inp} placeholder="Tu nombre"/></div>
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Teléfono *</label><input value={telefono} onChange={e=>setTelefono(e.target.value)} style={inp} placeholder="3001234567"/></div>
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Equipo (opcional)</label><input value={equipo} onChange={e=>setEquipo(e.target.value)} style={inp} placeholder="Nombre del equipo"/></div>
                <div style={{ marginBottom:'18px' }}>
                  <label style={lbl}>Duración</label>
                  <select value={duracion} onChange={e=>setDuracion(parseInt(e.target.value))} style={inp}>
                    <option value={60}>1 hora</option><option value={90}>1.5 horas</option><option value={120}>2 horas</option>
                  </select>
                </div>
                {error && <div style={{ color:S.loss, fontSize:'.78rem', marginBottom:'14px' }}>{error}</div>}
                <button onClick={enviarReserva} disabled={enviando}
                  style={{ width:'100%', padding:'13px', background:S.green, border:'none', borderRadius:'12px', cursor:'pointer', color:'#fff', fontWeight:800, fontSize:'.9rem', opacity:enviando?.7:1 }}>
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

function StepLabel({ n, texto }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
      <div style={{ width:24, height:24, borderRadius:'50%', background:S.green, color:'#fff', fontWeight:900, fontSize:'.75rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{n}</div>
      <div style={{ fontWeight:800, fontSize:'.95rem' }}>{texto}</div>
    </div>
  )
}
