import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, MapPin, ChevronRight, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { supabase } from '../lib/supabase'
import { getHours, slotEstado, reservasDeSlot, intervalosSolapan, horasSeguidasLibres, horaFin, todayStr, fmtDate, precioCancha, nombreCancha, fmtMoney, escenarioActivo, sincronizarReservasFijas, proximosDias } from '../lib/escenarioHelpers'
import { leerCacheRapido, guardarCacheRapido } from '../lib/cacheRapido'
import { fmtHora12 } from '../lib/horaHelpers'

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

export default function ReservarEscenarioPage() {
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [canchas,   setCanchas]   = useState([])
  const [reservas,  setReservas]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [cancha,    setCancha]    = useState(null)
  const [fecha,     setFecha]     = useState(todayStr())
  const [horaSel,   setHoraSel]   = useState(null)
  const [modalSlot, setModalSlot] = useState(null)
  const [infoSlot,  setInfoSlot]  = useState(null) // { hora, reservas: [...] } — al tocar un horario ya tomado
  const fechasRef = useRef(null)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [equipo, setEquipo] = useState('')
  // Todo es de 60 en 60 minutos (nada de 30 ni 90). Si la persona quiere más
  // tiempo elige 2 o 3 horas: se ocupan esos horarios seguidos (solo si están
  // libres) y el valor es el de una hora por la cantidad de horas.
  const [horasSel, setHorasSel] = useState(1)
  const duracion = horasSel * 60
  const [error, setError] = useState('')
  const [estadoEnvio, setEstadoEnvio] = useState('idle') // idle | esperando | ok | timeout | ocupado

  useEffect(() => { fetchTodo() }, [escenarioId])
  useEffect(() => { setHoraSel(null); setHorasSel(1) }, [fecha, cancha])

  async function fetchTodo() {
    // Lo último que se vio de este escenario se pinta DE INMEDIATO (horarios incluidos) y lo nuevo llega detrás.
    // Al reservar se vuelve a comprobar que el horario siga libre, así que un dato viejo nunca produce una reserva doble.
    const clave = 'reservar_' + escenarioId
    const c = leerCacheRapido(clave, 30 * 60 * 1000)
    if (c && c.escenario) {
      setEscenario(c.escenario); setCanchas(c.canchas || []); setReservas(c.reservas || [])
      setCancha(prev => prev || (c.canchas && c.canchas[0] ? c.canchas[0].slug : null))
      setNotFound(false); setLoading(false)
    } else {
      setLoading(true)
    }

    // Todo sale a la vez (antes iba una cosa detrás de otra, incluida la revisión de reservas fijas)
    const [{ data }, { data: cs }, { data: rsvs }] = await Promise.all([
      supabase.from('escenarios').select('*').eq('id', escenarioId).maybeSingle(),
      supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true).order('orden'),
      // La página pública no lee la tabla (tiene teléfonos): pide solo la ocupación a una función del servidor
      supabase.rpc('escenario_ocupacion', { p_escenario_id: escenarioId }),
    ])
    if (!data) { setNotFound(true); setLoading(false); return }
    setNotFound(false)
    setEscenario(data)
    setCanchas(cs || [])
    setReservas(rsvs || [])
    setCancha(prev => prev || (cs && cs[0] ? cs[0].slug : null))
    setLoading(false)
    guardarCacheRapido(clave, { escenario: data, canchas: cs || [], reservas: rsvs || [] })

    // Las reservas fijas se ponen al día DETRÁS de la pantalla; solo si cambió algo se vuelve a pedir la ocupación
    sincronizarReservasFijas(escenarioId).then(async cambio => {
      if (!cambio) return
      const { data: nuevas } = await supabase.rpc('escenario_ocupacion', { p_escenario_id: escenarioId })
      if (nuevas) setReservas(nuevas)
    }).catch(() => {})
  }

  function abrirSlot() {
    if (!horaSel) return
    setModalSlot(horaSel); setNombre(''); setTelefono(''); setEquipo(''); setError(''); setEstadoEnvio('idle')
  }

  function cerrarModal() {
    setModalSlot(null); setEstadoEnvio('idle')
  }

  // Antes la reserva NO se guardaba apenas se hacía click: se guardaba solo
  // cuando esta pestaña detectaba (con visibilitychange) que el navegador
  // salió hacia WhatsApp — la idea era evitar reservas de alguien que nunca
  // llegó a abrir WhatsApp. El problema: esa detección puede fallar en
  // silencio en varios celulares (sobre todo iOS), y cuando fallaba, el
  // mensaje SÍ le llegaba al negocio por WhatsApp — hasta lo confirmaban
  // por chat — pero la reserva nunca quedaba guardada acá. El horario
  // seguía viéndose "Disponible" para cualquier otra persona, y terminaba
  // pasando exactamente eso: dos personas con la misma cancha a la misma
  // hora. Ahora la reserva se guarda EN EL CLICK, de forma síncrona y
  // confiable, y solo después de guardarla se abre WhatsApp.
  async function handleReservar(e) {
    e.preventDefault()
    const waUrl = e.currentTarget.href
    if (!nombre.trim()) { setError('Escribe tu nombre'); return }
    if (!telefono.trim()) { setError('Escribe tu número de WhatsApp'); return }
    setError('')
    setEstadoEnvio('esperando')

    // Revalidación de último momento: la grilla de horarios se cargó una
    // sola vez al entrar a la página, así que si la persona se demoró
    // llenando el formulario, alguien más pudo haber tomado ese mismo
    // horario mientras tanto.
    const { data: actuales, error: errCheck } = await supabase.rpc('escenario_ocupacion', {
      p_escenario_id: escenario.id, p_cancha: cancha, p_fecha: fecha,
    })
    if (errCheck) { setEstadoEnvio('timeout'); return }
    const chocaConOtra = (actuales || []).some(r =>
      (r.estado === 'aceptada' || r.estado === 'pendiente' || r.estado === 'mantenimiento') &&
      intervalosSolapan(modalSlot, duracion, r.hora, r.duracion)
    )
    if (chocaConOtra) { setEstadoEnvio('ocupado'); setHoraSel(null); fetchTodo(); return }

    const datos = {
      escenario_id: escenario.id, cancha, fecha, hora: modalSlot, duracion,
      nombre: nombre.trim(), telefono: telefono.trim(), equipo: equipo.trim() || null,
      estado: 'pendiente', pago: 'pendiente', monto: precioCancha(canchas, cancha) * horasSel, monto_pagado: 0,
    }
    const { error: errInsert } = await supabase.from('escenario_reservas').insert(datos)
    if (errInsert) { setEstadoEnvio('timeout'); return }

    fetchTodo()
    setEstadoEnvio('ok')
    if (waUrl) window.open(waUrl, '_blank')
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
  if (canchas.length === 0) return (
    <div style={{ minHeight:'100vh', background:S.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center', gap:'12px' }}>
      <div style={{ fontSize:'2.2rem' }}>⚽</div>
      <div style={{ fontWeight:800, fontSize:'1rem', color:S.text }}>{escenario.name} todavía no tiene canchas configuradas</div>
      <div style={{ maxWidth:'320px', lineHeight:1.5 }}>Volvé a intentar más tarde.</div>
    </div>
  )

  const horas = getHours(escenario)
  const dias = proximosDias()
  const maxHoras = horaSel ? horasSeguidasLibres(reservas, cancha, fecha, horas, horaSel, 3) : 0
  const precioHora = precioCancha(canchas, cancha)
  const idxSel = horaSel ? horas.findIndex(x => parseInt(x,10) === parseInt(horaSel,10)) : -1
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
              <FaWhatsapp size={15}/> Quiero chatear con alguien
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
              {canchas.map(c => {
                const sel = cancha === c.slug
                return (
                  <button key={c.id} onClick={() => setCancha(c.slug)}
                    style={{ flex:'1 1 160px', display:'flex', alignItems:'center', gap:10, padding:'13px 16px', borderRadius:12, cursor:'pointer',
                      border: sel ? `2px solid ${S.green}` : `1.5px solid ${S.border}`, background: sel ? S.greenDim : '#fff' }}>
                    <Building2 size={18} color={sel ? S.greenDark : S.muted}/>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontWeight:800, fontSize:'.9rem', color: sel ? S.greenDark : S.text }}>{c.nombre}</div>
                      <div style={{ fontSize:'.72rem', color:S.muted }}>{fmtMoney(c.precio_hora)}/hora</div>
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
              {horas.map((h, i) => {
                const est = slotEstado(reservas, cancha, fecha, h)
                const sel = idxSel >= 0 && i >= idxSel && i < idxSel + horasSel
                const libre = est === 'libre'
                const color = est === 'libre' ? S.win : est === 'pendiente' ? S.warn : S.loss
                const label = est === 'libre' ? 'Disponible' : est === 'pendiente' ? 'Pendiente' : 'Ocupado'
                return (
                  <button key={h}
                    onClick={() => {
                      if (libre) { setHoraSel(h); setHorasSel(1); return }
                      const rs = reservasDeSlot(reservas, cancha, fecha, h)
                      if (rs.length) setInfoSlot({ hora: h, reservas: rs })
                    }}
                    style={{ padding:'12px 10px', borderRadius:12, textAlign:'left', cursor:'pointer',
                      border: sel ? `2px solid ${S.green}` : est === 'ocupado' ? `1.5px solid #f3d3d3` : `1.5px solid ${S.border}`,
                      background: sel ? S.greenDim : est === 'ocupado' ? '#fdf4f4' : '#fff' }}>
                    <div style={{ fontWeight:800, fontSize:'.92rem', color: sel ? S.greenDark : S.text }}>{fmtHora12(h)}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'.7rem', color, fontWeight:700, marginTop:3 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }}/>
                      {label}{!libre && ' · toca para ver'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ¿Cuántas horas? — solo aparece cuando ya eligió la hora */}
          {horaSel && (
            <div>
              <StepLabel n={4} texto="¿Cuántas horas?"/>
              <div style={{ display:'flex', gap:10 }}>
                {[1,2,3].map(n => {
                  const ok = n <= maxHoras
                  const activo = horasSel === n
                  return (
                    <button key={n} type="button" disabled={!ok} onClick={() => setHorasSel(n)}
                      style={{ flex:1, padding:'12px 6px', borderRadius:12, cursor: ok ? 'pointer' : 'not-allowed', fontFamily:'inherit', textAlign:'center',
                        border: activo ? `2px solid ${S.green}` : `1.5px solid ${S.border}`, background: activo ? S.greenDim : '#fff', opacity: ok ? 1 : .4 }}>
                      <div style={{ fontWeight:900, fontSize:'.95rem', color: activo ? S.greenDark : S.text }}>{n} {n === 1 ? 'hora' : 'horas'}</div>
                      {precioHora > 0 && <div style={{ fontSize:'.72rem', color:S.muted, marginTop:2 }}>{fmtMoney(precioHora * n)}</div>}
                    </button>
                  )
                })}
              </div>
              {maxHoras < 3 && (
                <div style={{ fontSize:'.74rem', color:S.muted, marginTop:8 }}>
                  {maxHoras === 1 ? 'Después de esta hora el horario ya está ocupado (o el lugar cierra), por eso solo se puede 1 hora.' : 'Solo hay 2 horas seguidas libres desde esta hora.'}
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <button onClick={abrirSlot} disabled={!horaSel}
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', cursor: horaSel ? 'pointer' : 'not-allowed',
              background: horaSel ? `linear-gradient(135deg, ${S.green}, ${S.greenDark})` : '#e5e9e7', color: horaSel ? '#fff' : S.muted,
              fontWeight:900, fontSize:'.95rem', textAlign:'center', boxShadow: horaSel ? '0 8px 22px rgba(34,197,94,.35)' : 'none' }}>
            {horaSel ? (
              <>Reservar {fmtHora12(horaSel)}{horasSel > 1 ? ` – ${fmtHora12(horaFin(horaSel, horasSel))}` : ''}{precioHora > 0 ? ` · ${fmtMoney(precioHora * horasSel)}` : ''}<div style={{ fontWeight:600, fontSize:'.76rem', marginTop:2, opacity:.9 }}>{nombreCancha(canchas, cancha)} – {fmtDate(fecha)}</div></>
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

        {/* Footer CTA — bien visible: horarios especiales / eventos no están
            en la grilla de horas, así que hay que ofrecer WhatsApp directo. */}
        {waHref && (
          <div style={{
            background:'linear-gradient(135deg, #17231d, #0f1a16)', borderRadius:20,
            boxShadow:'0 10px 30px rgba(20,60,40,.25)', padding:'24px', marginTop:20,
            display:'flex', alignItems:'center', gap:18, flexWrap:'wrap',
            border:`1.5px solid ${S.green}`,
          }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'rgba(34,197,94,.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <FaWhatsapp size={22} color={S.green}/>
            </div>
            <div style={{ flex:'1 1 220px' }}>
              <div style={{ fontWeight:900, fontSize:'1rem', color:'#fff' }}>¿Necesitas algo especial?</div>
              <div style={{ fontSize:'.82rem', color:'#c9d6d1', marginTop:4, lineHeight:1.5 }}>
                Si quieres reservar una cancha <b style={{ color:'#fff' }}>fuera de los horarios publicados</b>, escríbenos.
                Si quieres hacer un <b style={{ color:'#fff' }}>evento</b>, también puedes escribirnos por WhatsApp.
              </div>
            </div>
            <a href={waHref} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:8, background:S.green, borderRadius:12, padding:'13px 22px', color:'#0f1a16', fontWeight:900, fontSize:'.85rem', textDecoration:'none', whiteSpace:'nowrap', boxShadow:'0 6px 18px rgba(34,197,94,.4)' }}>
              <FaWhatsapp size={18}/> Quiero chatear con alguien
            </a>
          </div>
        )}
      </div>

      {infoSlot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,15,13,.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
          onClick={() => setInfoSlot(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:'18px', padding:'22px', width:'340px', maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ fontWeight:800, fontSize:'.95rem' }}>{nombreCancha(canchas, cancha)} — {fmtHora12(infoSlot.hora)}</div>
              <button onClick={() => setInfoSlot(null)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
            </div>
            {infoSlot.reservas.map((r, i) => (
              <div key={i} style={{ padding:'10px 0', borderTop: i > 0 ? `1px solid ${S.border}` : 'none' }}>
                <div style={{ fontWeight:800, fontSize:'.9rem', color:S.text }}>{r.nombre || 'Sin nombre'}</div>
                {r.equipo && <div style={{ fontSize:'.78rem', color:S.text2, marginTop:2 }}>Equipo: {r.equipo}</div>}
                <div style={{ fontSize:'.72rem', color:S.muted, marginTop:2 }}>
                  {fmtHora12(r.hora)} · {Math.max(1, Math.round((r.duracion||60)/60))} {Math.max(1, Math.round((r.duracion||60)/60)) === 1 ? 'hora' : 'horas'} · {r.estado === 'pendiente' ? 'Pendiente de confirmar' : r.estado === 'aceptada' ? 'Confirmada' : r.estado === 'mantenimiento' ? 'Mantenimiento' : r.estado}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalSlot && (() => {
        const mensajeWA = `Hola, quiero reservar la ${nombreCancha(canchas, cancha)}.\n` +
          `Nombre: ${nombre.trim() || '-'}\nWhatsApp: ${telefono.trim() || '-'}\nEquipo: ${equipo.trim() || '-'}\nFecha: ${fmtDate(fecha)}\nHora: ${fmtHora12(modalSlot)}${horasSel > 1 ? ' a ' + fmtHora12(horaFin(modalSlot, horasSel)) : ''}\nDuración: ${horasSel} ${horasSel === 1 ? 'hora' : 'horas'}${precioCancha(canchas,cancha) > 0 ? '\nValor: ' + fmtMoney(precioCancha(canchas,cancha) * horasSel) : ''}`
        const hrefReservar = escenario?.whatsapp ? `https://wa.me/${escenario.whatsapp}?text=${encodeURIComponent(mensajeWA)}` : null
        return (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,15,13,.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'18px', padding:'24px', width:'380px', maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <div style={{ fontWeight:800, fontSize:'1rem' }}>Reservar {nombreCancha(canchas, cancha)}</div>
              <button onClick={cerrarModal} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
            </div>
            <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>{fmtDate(fecha)} — {fmtHora12(modalSlot)}{horasSel > 1 ? ` a ${fmtHora12(horaFin(modalSlot, horasSel))}` : ''} · {horasSel} {horasSel === 1 ? 'hora' : 'horas'}{precioCancha(canchas,cancha) > 0 ? ` · ${fmtMoney(precioCancha(canchas,cancha) * horasSel)}` : ''}</div>

            {estadoEnvio === 'ocupado' ? (
              <div style={{ textAlign:'center', padding:'10px 0 4px' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>😕</div>
                <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:6 }}>Ese horario ya no está disponible</div>
                <div style={{ fontSize:'.8rem', color:S.muted, marginBottom:18 }}>Alguien más reservó {nombreCancha(canchas, cancha)} a esa hora justo antes que tú. Elige otro horario.</div>
                <button onClick={cerrarModal} style={{ width:'100%', padding:'12px', background:S.green, border:'none', borderRadius:'12px', cursor:'pointer', color:'#fff', fontWeight:800, fontSize:'.85rem' }}>Elegir otro horario</button>
              </div>
            ) : estadoEnvio === 'ok' ? (
              <div style={{ textAlign:'center', padding:'10px 0 4px' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>✅</div>
                <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:6 }}>¡Solicitud registrada!</div>
                <div style={{ fontSize:'.8rem', color:S.muted, marginBottom:18 }}>Ya quedó pendiente de confirmar. Si no le diste enviar al mensaje en WhatsApp, hazlo para que te confirmen.</div>
                <button onClick={cerrarModal} style={{ width:'100%', padding:'12px', background:S.green, border:'none', borderRadius:'12px', cursor:'pointer', color:'#fff', fontWeight:800, fontSize:'.85rem' }}>Listo</button>
              </div>
            ) : estadoEnvio === 'esperando' ? (
              <div style={{ textAlign:'center', padding:'10px 0 4px' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>📲</div>
                <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:6 }}>Guardando tu reserva...</div>
                <div style={{ fontSize:'.8rem', color:S.muted }}>Ya casi — en un momento se abre WhatsApp para que la confirmes.</div>
              </div>
            ) : (
              <>
                {estadoEnvio === 'timeout' && (
                  <div style={{ background:'rgba(220,38,38,.08)', color:S.loss, borderRadius:8, padding:'8px 12px', fontSize:'.75rem', marginBottom:14, textAlign:'center' }}>
                    No se pudo guardar la reserva. Revisa tu conexión e intenta de nuevo.
                  </div>
                )}
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Nombre *</label><input value={nombre} onChange={e=>setNombre(e.target.value)} style={inp} placeholder="Tu nombre"/></div>
                <div style={{ marginBottom:'12px' }}><label style={lbl}>Número de WhatsApp real para confirmar la reserva *</label><input type="tel" value={telefono} onChange={e=>setTelefono(e.target.value)} style={inp} placeholder="3001234567"/></div>
                <div style={{ marginBottom:'18px' }}><label style={lbl}>Equipo (opcional)</label><input value={equipo} onChange={e=>setEquipo(e.target.value)} style={inp} placeholder="Nombre del equipo"/></div>
                {error && <div style={{ color:S.loss, fontSize:'.78rem', marginBottom:'14px' }}>{error}</div>}
                <div style={{ fontSize:'.7rem', color:S.muted, marginBottom:'10px', textAlign:'center' }}>Al enviar, tu reserva queda guardada y se abre WhatsApp para que la confirmes con el lugar.</div>
                <a href={hrefReservar} target="_blank" rel="noreferrer" onClick={handleReservar}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'13px', background:S.green, border:'none', borderRadius:'12px', cursor:'pointer', color:'#fff', fontWeight:800, fontSize:'.9rem', textDecoration:'none', boxSizing:'border-box' }}>
                  <FaWhatsapp size={17}/> Enviar reserva por WhatsApp
                </a>
              </>
            )}
          </div>
        </div>
        )
      })()}
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
