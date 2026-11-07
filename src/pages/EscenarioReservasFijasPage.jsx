import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getHours, nombreCancha, fmtMoney, DIAS_SEMANA, asegurarReservasFijas, todayStr, proximasFechasDiaSemana, precioCancha, intervalosSolapan, horaFin } from '../lib/escenarioHelpers'
import { fmtHora12 } from '../lib/horaHelpers'
import { Plus, Repeat, X, Pencil, Pause, Play, Trash2, Phone, Check } from 'lucide-react'
import { BotonVolver, G } from '../components/EscenarioUI'

// Clientes que juegan siempre el mismo día y hora ("reservas fijas").
// Look de Golmebol (negro + verde). Todo en pocos toques: una lista clara, un solo botón
// para agregar, y cada cliente se maneja tocándolo (editar / pausar / eliminar).

const S = { navy: G.bg, card: G.card, card2: G.card2, border: G.border, cyan: G.green, cyanDim: G.greenBg, gold: G.gold, text: G.text, text2: G.text2, muted: G.muted }
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'0 14px', minHeight:'48px', color:S.text, fontSize:'1rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
const lbl = { fontSize:'.78rem', color:S.text2, display:'block', marginBottom:'6px', fontWeight:700 }
const BTN = { boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', width:'100%', minHeight:'52px', border:'none', borderRadius:'14px', cursor:'pointer', fontWeight:900, fontSize:'1rem', fontFamily:'inherit' }
const BTN_LINEA = { ...BTN, minHeight:'48px', background:S.card2, border:`1px solid ${S.border}`, color:S.text, fontSize:'.92rem', fontWeight:800 }

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0] // la semana empieza el lunes
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const vacio = { cancha:'', dia_semana:1, hora:'', nHoras:1, nombre:'', telefono:'', equipo:'', monto:'' }

// Ventana que sube desde abajo, siempre con título y botón visible para cerrar.
function Hoja({ titulo, subtitulo, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'22px 22px 0 0', width:'100%', maxWidth:'480px', maxHeight:'92vh', overflowY:'auto', padding:'18px 18px 24px', boxSizing:'border-box' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px', marginBottom:'14px' }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:'1.12rem', lineHeight:1.25 }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize:'.82rem', color:S.muted, marginTop:'3px' }}>{subtitulo}</div>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ flexShrink:0, width:'44px', height:'44px', borderRadius:'12px', background:S.card2, border:`1px solid ${S.border}`, cursor:'pointer', color:S.text2, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function EscenarioReservasFijasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [canchas,   setCanchas]   = useState([])
  const [fijas,     setFijas]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState(null) // { ok, txt }
  const [guardando, setGuardando] = useState(false)
  const [soloLectura, setSoloLectura] = useState(false)
  const [hoja, setHoja] = useState(null) // null | { tipo:'form', editId } | { tipo:'gestion', f, confirmarBorrar }
  const [form, setForm] = useState(vacio)
  const [montoManual, setMontoManual] = useState(false)
  const [error, setError] = useState('')
  const [advertencia, setAdvertencia] = useState('')

  useEffect(() => { fetchTodo() }, [escenarioId])

  function avisar(ok, txt) { setMsg({ ok, txt }); setTimeout(() => setMsg(null), 4500) }

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
    const { data: fs } = await supabase.from('escenario_reservas_fijas').select('*').eq('escenario_id', escenarioId).order('created_at', { ascending: false })
    setFijas(fs || [])
    setLoading(false)
  }

  const horas = escenario ? getHours(escenario) : []

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setAdvertencia(''); setError('') }

  function abrirNuevo() {
    setForm({ ...vacio, cancha: canchas[0]?.slug || '', hora: horas[0] || '' })
    setMontoManual(false); setError(''); setAdvertencia('')
    setHoja({ tipo: 'form', editId: null })
  }

  function abrirEditar(f) {
    setForm({
      cancha: f.cancha, dia_semana: Number(f.dia_semana), hora: f.hora, nHoras: Math.max(1, Math.ceil((f.duracion || 60) / 60)),
      nombre: f.nombre || '', telefono: f.telefono || '', equipo: f.equipo || '', monto: f.monto ?? '',
    })
    setMontoManual(true); setError(''); setAdvertencia('')
    setHoja({ tipo: 'form', editId: f.id })
  }

  // Valor por defecto: precio de la cancha por hora × horas (se puede cambiar a mano).
  const montoAuto = precioCancha(canchas, form.cancha) * form.nHoras
  const montoMostrado = montoManual ? form.monto : (montoAuto || '')

  // Que las horas pedidas quepan antes de que cierre el lugar.
  function cabeEnElDia() {
    const i = horas.findIndex(x => parseInt(x, 10) === parseInt(form.hora, 10))
    return i >= 0 && i + form.nHoras <= horas.length
  }

  // Antes de crear o editar, avisa si ese cancha + día + hora ya está comprometido con algo más
  // (nunca sobrescribe nada: las fechas que choquen simplemente no se generan).
  async function chequearConflicto(editId) {
    const diaSemana = Number(form.dia_semana)
    const dur = form.nHoras * 60
    const otraFijaChoca = fijas.find(f => f.activa && f.id !== editId && f.cancha === form.cancha && Number(f.dia_semana) === diaSemana && intervalosSolapan(form.hora, dur, f.hora, f.duracion))
    if (otraFijaChoca) {
      return `Ya hay otro cliente fijo a esa hora: "${otraFijaChoca.nombre}" (${DIAS_SEMANA[diaSemana]} ${fmtHora12(otraFijaChoca.hora)}). Si sigues, se van a pisar y uno de los dos se quedará sin reservar cada semana.`
    }
    const fechas = proximasFechasDiaSemana(diaSemana, 8)
    const { data: choques } = await supabase.from('escenario_reservas')
      .select('fecha, nombre, hora, duracion, reserva_fija_id, estado')
      .eq('escenario_id', escenarioId).eq('cancha', form.cancha)
      .in('fecha', fechas).in('estado', ['aceptada', 'pendiente'])
    const ajenos = (choques || []).filter(c => c.reserva_fija_id !== editId && intervalosSolapan(form.hora, dur, c.hora, c.duracion))
    if (ajenos.length > 0) {
      const detalle = ajenos.slice(0, 4).map(c => `${c.fecha} (${c.nombre || 'sin nombre'})`).join(', ')
      return `Ya hay reservas a esa hora en ${ajenos.length} fecha(s) próxima(s): ${detalle}${ajenos.length > 4 ? '…' : ''}. Esas no se tocan: el cliente fijo se saltará solo esas semanas.`
    }
    return null
  }

  async function guardar(forzar = false) {
    const editId = hoja?.editId || null
    if (!form.nombre.trim()) { setError('Escribe el nombre del cliente.'); return }
    if (!form.cancha || !form.hora) { setError('Elige la cancha y la hora.'); return }
    if (!cabeEnElDia()) { setError(`Esa hora no sirve: son ${form.nHoras} ${form.nHoras === 1 ? 'hora' : 'horas'} y el lugar cierra antes. Elige una hora más temprano.`); return }
    setGuardando(true); setError('')
    if (!forzar) {
      const adv = await chequearConflicto(editId)
      if (adv) { setGuardando(false); setAdvertencia(adv); return }
    }
    const payload = {
      escenario_id: escenarioId, cancha: form.cancha, dia_semana: Number(form.dia_semana), hora: form.hora,
      duracion: form.nHoras * 60, nombre: form.nombre.trim(), telefono: form.telefono.trim() || null,
      equipo: form.equipo.trim() || null, monto: Number(montoManual ? form.monto : montoAuto) || 0,
    }

    if (editId) {
      const { error: err } = await supabase.from('escenario_reservas_fijas').update(payload).eq('id', editId)
      if (err) { setGuardando(false); setError('No se pudo guardar: ' + err.message); return }
      // Las fechas futuras ya generadas con los datos viejos se borran (solo las que no pasaron) y se generan de nuevo.
      await supabase.from('escenario_reservas').delete().eq('reserva_fija_id', editId).eq('estado', 'aceptada').gte('fecha', todayStr())
      await asegurarReservasFijas(escenarioId)
      setGuardando(false); setHoja(null)
      avisar(true, 'Listo: se cambiaron también las próximas fechas')
      fetchTodo()
      return
    }

    const { error: err } = await supabase.from('escenario_reservas_fijas').insert({ ...payload, activa: true })
    if (!err) await asegurarReservasFijas(escenarioId)
    setGuardando(false)
    if (err) { setError('No se pudo crear: ' + err.message); return }
    setHoja(null)
    avisar(true, 'Listo: queda reservado cada semana hasta que lo pauses o lo elimines')
    fetchTodo()
  }

  async function alternar(f) {
    await supabase.from('escenario_reservas_fijas').update({ activa: !f.activa }).eq('id', f.id)
    if (!f.activa) await asegurarReservasFijas(escenarioId)
    setHoja(null)
    avisar(true, f.activa ? 'En pausa: ya no se reserva cada semana' : 'Activo otra vez: vuelve a reservarse cada semana')
    fetchTodo()
  }

  async function eliminar(f) {
    // Primero se liberan los cupos futuros ya generados (solo los que no pasaron y siguen "aceptados"; el historial queda para las finanzas).
    const { error: errLiberar } = await supabase.from('escenario_reservas').delete().eq('reserva_fija_id', f.id).eq('estado', 'aceptada').gte('fecha', todayStr())
    if (errLiberar) { setHoja(null); avisar(false, 'No se pudieron liberar las fechas: ' + errLiberar.message); return }
    const { error: err } = await supabase.from('escenario_reservas_fijas').delete().eq('id', f.id)
    setHoja(null)
    if (err) { avisar(false, err.message); return }
    avisar(true, 'Eliminado: las fechas futuras quedaron libres')
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const activos = fijas.filter(f => f.activa).length
  const porDia = ORDEN_DIAS.map(d => ({
    dia: d,
    items: fijas.filter(f => Number(f.dia_semana) === d).sort((a, b) => parseInt(a.hora, 10) - parseInt(b.hora, 10)),
  })).filter(g => g.items.length > 0)

  const chip = (activo, ok = true) => ({ flex:'1 1 0', minWidth:0, minHeight:'46px', borderRadius:'12px', cursor: ok ? 'pointer' : 'not-allowed', fontWeight:800, fontSize:'.88rem', fontFamily:'inherit', padding:'0 4px', opacity: ok ? 1 : .35,
    border: activo ? `2px solid ${S.cyan}` : `1px solid ${S.border}`, background: activo ? S.cyanDim : S.card2, color: activo ? S.cyan : S.text2 })

  const fGest = hoja?.tipo === 'gestion' ? hoja.f : null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:'rgba(10,10,10,.94)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', borderBottom:`1px solid ${S.border}`, padding:'10px 16px 12px', position:'sticky', top:0, zIndex:40 }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <BotonVolver onClick={() => navigate('/escenario/'+escenarioId)}/>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontWeight:900, fontSize:'1.2rem' }}><Repeat size={20} color={S.cyan}/> Clientes de todas las semanas</div>
          <div style={{ fontSize:'.8rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background: msg.ok ? S.cyanDim : 'rgba(229,67,61,.14)', border:`1px solid ${msg.ok ? 'rgba(111,207,61,.35)' : 'rgba(229,67,61,.4)'}`, color: msg.ok ? S.cyan : '#ff7b72', borderRadius:12, padding:'12px 14px', fontSize:'.9rem', fontWeight:800, marginBottom:14, textAlign:'center' }}>{msg.txt}</div>}

        <div style={{ fontSize:'.9rem', color:S.text2, lineHeight:1.5, marginBottom:'14px' }}>
          Los que juegan <b style={{ color:S.text }}>siempre el mismo día y hora</b>. Se anotan una sola vez y quedan reservados cada semana, sin que tengas que hacer nada.
        </div>

        {!soloLectura && (
          <button onClick={abrirNuevo} style={{ ...BTN, background:S.cyan, color:G.greenDk, marginBottom:'20px' }}><Plus size={20}/> Agregar un cliente fijo</button>
        )}

        {fijas.length === 0 ? (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'28px 20px', textAlign:'center' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:S.cyanDim, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}><Repeat size={24} color={S.cyan}/></div>
            <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:4 }}>Todavía no tienes clientes fijos</div>
            <div style={{ fontSize:'.84rem', color:S.muted, lineHeight:1.5 }}>{soloLectura ? 'Cuando el encargado agregue alguno, aparecerá aquí.' : 'Toca el botón verde para agregar el primero.'}</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:'.68rem', fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:S.muted, marginBottom:'10px' }}>
              {activos} {activos === 1 ? 'cliente activo' : 'clientes activos'}{fijas.length > activos ? ` · ${fijas.length - activos} en pausa` : ''}
            </div>
            {porDia.map(g => (
              <div key={g.dia} style={{ marginBottom:'16px' }}>
                <div style={{ fontWeight:900, fontSize:'.95rem', marginBottom:'8px' }}>{DIAS_SEMANA[g.dia]}</div>
                <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', overflow:'hidden' }}>
                  {g.items.map((f, i) => {
                    const nh = Math.max(1, Math.ceil((f.duracion || 60) / 60))
                    return (
                      <button key={f.id} onClick={() => setHoja({ tipo: 'gestion', f, confirmarBorrar: false })}
                        style={{ display:'flex', alignItems:'center', gap:'12px', width:'100%', minHeight:'72px', padding:'12px 14px', boxSizing:'border-box', background:'none', border:'none', borderTop: i ? `1px solid ${S.border}` : 'none', cursor:'pointer', color:S.text, fontFamily:'inherit', textAlign:'left', opacity: f.activa ? 1 : .55 }}>
                        <span style={{ flexShrink:0, minWidth:'74px', textAlign:'center', background: f.activa ? S.cyanDim : S.card2, borderRadius:'12px', padding:'8px 6px' }}>
                          <span style={{ display:'block', fontWeight:900, fontSize:'1rem', color: f.activa ? S.cyan : S.muted, lineHeight:1.1 }}>{fmtHora12(f.hora)}</span>
                          <span style={{ display:'block', fontSize:'.68rem', color:S.muted, marginTop:3 }}>{nh} {nh === 1 ? 'hora' : 'horas'}</span>
                        </span>
                        <span style={{ flex:1, minWidth:0 }}>
                          <span style={{ display:'block', fontWeight:800, fontSize:'.98rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.nombre}</span>
                          <span style={{ display:'block', fontSize:'.78rem', color:S.muted, marginTop:2 }}>
                            {nombreCancha(canchas, f.cancha)}{f.monto > 0 ? ` · ${fmtMoney(f.monto)}` : ''}
                          </span>
                        </span>
                        {!f.activa && <span style={{ flexShrink:0, fontSize:'.7rem', fontWeight:800, color:S.gold, background:'rgba(245,166,35,.14)', borderRadius:8, padding:'3px 8px' }}>En pausa</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Agregar / editar */}
      {hoja?.tipo === 'form' && (
        <Hoja titulo={hoja.editId ? 'Cambiar este cliente' : 'Cliente de todas las semanas'} subtitulo={hoja.editId ? 'Al guardar, también se cambian las próximas fechas.' : 'Se reserva solo, cada semana.'} onClose={() => setHoja(null)}>
          <div style={{ display:'grid', gap:'16px' }}>
            <div>
              <label style={lbl}>¿Quién es?</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} style={inp} placeholder="Nombre del cliente" autoComplete="off"/>
            </div>
            <div>
              <label style={lbl}>Teléfono <span style={{ color:S.muted, fontWeight:500 }}>(si quieres anotarlo)</span></label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} style={inp} placeholder="300 123 4567" inputMode="tel" autoComplete="off"/>
            </div>

            <div>
              <label style={lbl}>¿Qué día juega?</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px' }}>
                {ORDEN_DIAS.map(d => <button key={d} type="button" onClick={() => set('dia_semana', d)} style={{ ...chip(Number(form.dia_semana) === d), flex:'none' }}>{DIA_CORTO[d]}</button>)}
              </div>
            </div>

            {canchas.length > 1 && (
              <div>
                <label style={lbl}>¿En qué cancha?</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                  {canchas.map(c => <button key={c.id} type="button" onClick={() => set('cancha', c.slug)} style={{ ...chip(form.cancha === c.slug), flex:'1 1 auto', padding:'0 14px' }}>{c.nombre}</button>)}
                </div>
              </div>
            )}

            <div>
              <label style={lbl}>¿A qué hora empieza?</label>
              <select value={form.hora} onChange={e => set('hora', e.target.value)} style={inp}>
                {(horas.includes(form.hora) || !form.hora ? horas : [form.hora, ...horas]).map(h => <option key={h} value={h}>{fmtHora12(h)}</option>)}
              </select>
            </div>

            <div>
              <label style={lbl}>¿Cuánto tiempo?</label>
              <div style={{ display:'flex', gap:'8px' }}>
                {[1, 2, 3].map(n => <button key={n} type="button" onClick={() => set('nHoras', n)} style={chip(form.nHoras === n)}>{n} {n === 1 ? 'hora' : 'horas'}</button>)}
              </div>
              {form.hora && (
                <div style={{ fontSize:'.78rem', color:S.muted, marginTop:'8px' }}>
                  De <b style={{ color:S.text2 }}>{fmtHora12(form.hora)}</b> a <b style={{ color:S.text2 }}>{fmtHora12(horaFin(form.hora, form.nHoras))}</b>
                </div>
              )}
            </div>

            <div>
              <label style={lbl}>¿Cuánto paga cada semana?</label>
              <input type="number" inputMode="numeric" value={montoMostrado} onChange={e => { setMontoManual(true); set('monto', e.target.value) }} style={inp} placeholder="$"/>
              {!montoManual && montoAuto > 0 && <div style={{ fontSize:'.76rem', color:S.muted, marginTop:'6px' }}>Calculado con el precio de la cancha ({fmtMoney(precioCancha(canchas, form.cancha))} por hora). Puedes cambiarlo.</div>}
            </div>

            <div>
              <label style={lbl}>Equipo <span style={{ color:S.muted, fontWeight:500 }}>(si quieres anotarlo)</span></label>
              <input value={form.equipo} onChange={e => set('equipo', e.target.value)} style={inp} placeholder="Nombre del equipo" autoComplete="off"/>
            </div>

            {error && <div style={{ color:'#ff7b72', fontSize:'.86rem', fontWeight:700, textAlign:'center' }}>{error}</div>}

            {advertencia && (
              <div style={{ background:'rgba(245,166,35,.1)', border:`1px solid ${S.gold}`, borderRadius:'14px', padding:'12px 14px', fontSize:'.84rem', lineHeight:1.5, color:S.text2 }}>
                <b style={{ color:S.gold }}>Ojo:</b> {advertencia}
              </div>
            )}

            {advertencia
              ? <>
                  <button onClick={() => guardar(true)} disabled={guardando} style={{ ...BTN, background:S.gold, color:'#1a1000', opacity:guardando?.7:1 }}>{guardando ? 'Guardando…' : 'Guardar de todas formas'}</button>
                  <button onClick={() => setAdvertencia('')} style={{ ...BTN_LINEA }}>Mejor cambiar la hora o el día</button>
                </>
              : <button onClick={() => guardar(false)} disabled={guardando} style={{ ...BTN, background:S.cyan, color:G.greenDk, opacity:guardando?.7:1 }}>
                  <Check size={20}/> {guardando ? 'Guardando…' : hoja.editId ? 'Guardar los cambios' : 'Guardar'}
                </button>}
          </div>
        </Hoja>
      )}

      {/* Un cliente: editar / pausar / eliminar */}
      {fGest && (() => {
        const nh = Math.max(1, Math.ceil((fGest.duracion || 60) / 60))
        return (
          <Hoja titulo={fGest.nombre} subtitulo={`${DIAS_SEMANA[fGest.dia_semana]} · ${fmtHora12(fGest.hora)} a ${fmtHora12(horaFin(fGest.hora, nh))}`} onClose={() => setHoja(null)}>
            <div style={{ background:S.card2, borderRadius:'14px', padding:'14px', marginBottom:'16px', display:'grid', gap:'6px', fontSize:'.9rem', color:S.text2 }}>
              <div>{nombreCancha(canchas, fGest.cancha)} · {nh} {nh === 1 ? 'hora' : 'horas'}{fGest.monto > 0 ? <> · <b style={{ color:S.gold }}>{fmtMoney(fGest.monto)}</b> cada semana</> : null}</div>
              {fGest.equipo && <div>Equipo: {fGest.equipo}</div>}
              {fGest.telefono && <a href={`tel:${fGest.telefono}`} style={{ display:'inline-flex', alignItems:'center', gap:6, color:S.cyan, fontWeight:800, textDecoration:'none' }}><Phone size={16}/> {fGest.telefono}</a>}
              {!fGest.activa && <div style={{ color:S.gold, fontWeight:700 }}>En pausa: ahora no se reserva cada semana.</div>}
            </div>

            {soloLectura ? null : hoja.confirmarBorrar ? (
              <div style={{ display:'grid', gap:'10px' }}>
                <div style={{ fontSize:'.9rem', color:S.text2, lineHeight:1.5 }}>
                  ¿Eliminar a <b style={{ color:S.text }}>{fGest.nombre}</b> para siempre? Todas sus fechas que vienen quedan <b style={{ color:S.text }}>libres</b> para otros clientes. No se puede deshacer.
                </div>
                <button onClick={() => eliminar(fGest)} style={{ ...BTN, background:'#e5433d', color:'#fff' }}>Sí, eliminar</button>
                <button onClick={() => setHoja({ ...hoja, confirmarBorrar: false })} style={BTN_LINEA}>No, volver</button>
              </div>
            ) : (
              <div style={{ display:'grid', gap:'10px' }}>
                <button onClick={() => abrirEditar(fGest)} style={BTN_LINEA}><Pencil size={18}/> Cambiar día, hora o datos</button>
                <button onClick={() => alternar(fGest)} style={{ ...BTN_LINEA, color: fGest.activa ? S.gold : S.cyan, borderColor: fGest.activa ? 'rgba(245,166,35,.45)' : 'rgba(111,207,61,.45)' }}>
                  {fGest.activa ? <><Pause size={18}/> Pausar (que no se reserve por ahora)</> : <><Play size={18}/> Volver a activar</>}
                </button>
                <button onClick={() => setHoja({ ...hoja, confirmarBorrar: true })} style={{ ...BTN_LINEA, color:'#ff7b72', borderColor:'rgba(229,67,61,.4)' }}><Trash2 size={18}/> Eliminar para siempre</button>
              </div>
            )}
          </Hoja>
        )
      })()}
    </div>
  )
}
