import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { G, EncabezadoEscenario } from '../components/EscenarioUI'
import { fmtMoney, fmtDate, todayStr, allSlotsForDate, escenarioActivo, asegurarReservasFijasThrottled, obtenerAccesoEscenario, invalidarAccesoEscenario } from '../lib/escenarioHelpers'
import { fmtHoraDate } from '../lib/horaHelpers'
import { ShoppingCart, Smartphone, Package, Truck, Wallet, Receipt, BarChart3, Settings, Repeat, History, Bell, ChevronRight, ChevronDown, CalendarDays, AlertTriangle } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'

// Mismos colores del resto de Golmebol (negro + verde); "cyan" es el verde de acento.
const S = {
  navy: G.bg, surface: G.card, card: G.card, card2: G.card2, soft: G.soft,
  border: G.border, cyan: G.green, cyanDim: G.greenBg,
  gold: G.gold, goldBg: G.goldBg, text: G.text, text2: G.text2, muted: G.muted, faint: G.faint,
  green: G.green, loss: G.loss, warn: G.gold,
}

export default function EscenarioDashboardPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [encargado,  setEncargado]  = useState(null)
  const [escenario,  setEscenario]  = useState(null)
  const [otros,      setOtros]      = useState([]) // otros escenarios del mismo encargado (para el switch)
  const [productos,  setProductos]  = useState([])
  const [ventasHoy,  setVentasHoy]  = useState([])
  const [canchas,    setCanchas]    = useState([])
  const [reservas,   setReservas]   = useState([])
  const [pedidosPend,setPedidosPend]= useState(0)
  const [nFijos,     setNFijos]     = useState(0) // clientes que juegan siempre el mismo día y hora
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [actividadReciente, setActividadReciente] = useState([])
  const [mostrarAviso, setMostrarAviso] = useState(false)
  const [mostrarMas, setMostrarMas] = useState(false)
  const [soloLectura, setSoloLectura] = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true); setNotFound(false)
    // La identidad + acceso + datos del escenario vienen de un cache
    // compartido (dura 3 minutos) — así no se repiten esas consultas cada
    // vez que se vuelve a este panel desde Canchas, Ventas, etc.
    const r = await obtenerAccesoEscenario(escenarioId)
    if (r.estado === 'sin_sesion') { navigate('/jugador/login'); return }
    if (r.estado === 'sin_rol') { navigate('/jugador'); return }
    if (r.estado === 'sin_acceso') { setNotFound(true); setLoading(false); return }
    setEncargado(r.encargado)
    setSoloLectura(!!r.acceso.solo_lectura)
    setEscenario(r.escenario)
    const p = r.encargado

    const hoy = todayStr()
    const [{ data: asignaciones }, { data: prods }, { data: ventas }, { data: cs }, { data: rsvs }, { count: cPed }, { data: act }, { data: fijosAct }] = await Promise.all([
      supabase.from('escenario_encargados').select('escenarios(id, name, logo_url)').eq('player_id', p.id),
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId),
      supabase.from('escenario_ventas').select('*').eq('escenario_id', escenarioId).eq('fecha', hoy).eq('estado', 'completada'),
      supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true),
      supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId).gte('fecha', hoy),
      supabase.from('escenario_pedidos').select('id', { count: 'exact', head: true }).eq('escenario_id', escenarioId).eq('estado', 'pendiente'),
      supabase.from('escenario_actividad').select('*').eq('escenario_id', escenarioId).order('created_at', { ascending: false }).limit(8),
      supabase.from('escenario_reservas_fijas').select('id').eq('escenario_id', escenarioId).eq('activa', true),
      asegurarReservasFijasThrottled(escenarioId),
    ])
    setOtros((asignaciones || []).map(a => a.escenarios).filter(Boolean))
    setProductos(prods || [])
    setVentasHoy(ventas || [])
    setCanchas(cs || [])
    setReservas(rsvs || [])
    setPedidosPend(cPed || 0)
    setNFijos((fijosAct || []).length)
    setActividadReciente(act || [])

    // Recordatorio de responsabilidad: una vez por día por persona, para
    // que cualquiera que use el escenario tenga presente que los cambios
    // quedan anotados con su nombre.
    const keyAviso = `escenario_aviso_${escenarioId}_${p.id}_${hoy}`
    if (!r.acceso.solo_lectura && !localStorage.getItem(keyAviso)) setMostrarAviso(true)

    setLoading(false)
  }

  function cerrarAviso() {
    localStorage.setItem(`escenario_aviso_${escenarioId}_${encargado.id}_${todayStr()}`, '1')
    setMostrarAviso(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  async function handleLogo(file) {
    if (!file || !escenario) return
    setSubiendoLogo(true)
    const ext = file.name.split('.').pop()
    const path = `logos/${escenario.id}.${ext}`
    const { error: errUp } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (!errUp) {
      const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
      await supabase.from('escenarios').update({ logo_url: urlData.publicUrl }).eq('id', escenario.id)
      invalidarAccesoEscenario(escenario.id)
      setEscenario(e => ({ ...e, logo_url: urlData.publicUrl }))
    }
    setSubiendoLogo(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (notFound) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center', gap:'14px' }}>
      No tienes acceso a este escenario.
      <button onClick={()=>navigate('/escenario')} style={{ padding:'9px 18px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:700, fontSize:'.8rem' }}>Ver mis escenarios</button>
    </div>
  )
  if (!encargado || !escenario) return null

  if (!escenarioActivo(escenario)) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center', gap:'14px' }}>
      <div style={{ fontSize:'2.2rem' }}>🔒</div>
      <div style={{ fontWeight:800, fontSize:'1rem', color:S.text }}>{escenario.name} está bloqueado</div>
      <div style={{ maxWidth:'320px', lineHeight:1.5 }}>Contactá al administrador de Golmebol para reactivar el acceso a este escenario.</div>
      {otros.length > 1 && (
        <button onClick={()=>navigate('/escenario')} style={{ padding:'9px 18px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:700, fontSize:'.8rem' }}>Ver mis escenarios</button>
      )}
      <button onClick={handleLogout} style={{ padding:'9px 18px', background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:S.muted, fontWeight:700, fontSize:'.8rem' }}>Cerrar sesión</button>
    </div>
  )

  const totalVentasHoy = ventasHoy.reduce((a, v) => a + Number(v.total || 0), 0)
  const gananciaHoy = ventasHoy.reduce((a, v) => a + Number(v.ganancia || 0), 0)
  const bajoStock = productos.filter(p => p.cantidad <= p.stock_minimo)
  // El cliente pide la cancha desde el link público y la solicitud queda
  // guardada aquí igual, así el WhatsApp con el mensaje nunca le llegue al
  // encargado (a veces la persona abre WhatsApp y no le da enviar). Este
  // aviso no depende de WhatsApp — se ve apenas se entra al panel.
  const reservasPendientes = reservas.filter(r => r.estado === 'pendiente')
  const slotsHoy = allSlotsForDate(escenario, canchas, reservas, todayStr())
  const libres = slotsHoy.filter(s => s.estado === 'libre').length
  const ocupados = slotsHoy.filter(s => s.estado !== 'libre').length

  const ultimoVisto = localStorage.getItem(`escenario_actividad_visto_${escenarioId}_${encargado.id}`)
  const hayActividadNueva = actividadReciente.some(a => !ultimoVisto || a.created_at > ultimoVisto)

  const B = escenarioId
  const nombrePila = encargado.name?.split(' ')[0] || ''
  const totalHorarios = libres + ocupados
  const pctOcupado = totalHorarios > 0 ? Math.round((ocupados / totalHorarios) * 100) : 0
  // Lo de todos los días va grande arriba; el resto queda agrupado y explicado en "Más opciones".
  const GRUPOS = [
    { titulo: 'Tu tienda', items: [
      { to: `/escenario/${B}/inventario`, icon: Package,  label: 'Productos y precios', desc: 'Cuánto hay y cuánto cuesta cada cosa', aviso: bajoStock.length > 0 ? `${bajoStock.length} con poco stock` : '' },
      { to: `/escenario/${B}/compras`,    icon: Truck,    label: 'Compras', desc: 'Lo que le compras a los proveedores' },
      { to: `/escenario/${B}/gastos`,     icon: Wallet,   label: 'Gastos', desc: 'Arriendo, servicios, nómina y otros' },
    ] },
    { titulo: 'Informes', items: [
      { to: `/escenario/${B}/cierre`,   icon: Receipt,   label: 'Informe del día', desc: 'El resumen del día, para imprimir o guardar en PDF' },
      { to: `/escenario/${B}/reportes`, icon: BarChart3, label: 'Lo más vendido', desc: 'Qué productos dejan más ganancia' },
    ] },
    { titulo: 'Otras cosas', items: [
      { to: `/escenario/${B}/pedido`,    icon: Smartphone, label: 'Pedidos desde la cancha', desc: 'Los que llegan por WhatsApp', aviso: pedidosPend > 0 ? `${pedidosPend} por atender` : '' },
      { to: `/escenario/${B}/actividad`, icon: History,    label: 'Quién hizo qué', desc: 'Cambios de precios, ventas y cancelaciones', aviso: hayActividadNueva ? 'Nuevo' : '' },
      { to: `/escenario/${B}/config`,    icon: Settings,   label: 'Ajustes del escenario', desc: 'Horarios, precios, datos y página pública' },
    ] },
  ]
  const hayAvisosMas = bajoStock.length > 0 || pedidosPend > 0 || hayActividadNueva
  function abrirOpcion(to) {
    if (to.endsWith('/actividad') && actividadReciente[0]) {
      try { localStorage.setItem(`escenario_actividad_visto_${escenarioId}_${encargado.id}`, actividadReciente[0].created_at) } catch { /* sin almacenamiento: no pasa nada */ }
    }
    navigate(to)
  }
  const ETIQUETA = { fontSize:'.68rem', fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:S.muted }
  const TARJETA = { background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', overflow:'hidden', marginBottom:'14px' }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,-apple-system,sans-serif', color:S.text, paddingBottom:'48px' }}>
      {mostrarAviso && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'18px', padding:'22px', maxWidth:'360px', width:'100%' }}>
            <div style={{ fontWeight:800, fontSize:'1.05rem', marginBottom:'8px' }}>Un recordatorio</div>
            <div style={{ fontSize:'.88rem', color:S.text2, lineHeight:1.55, marginBottom:'18px' }}>
              Todo lo que cambies aquí (ventas, precios, cancelaciones, pagos) queda anotado con tu nombre, la fecha y la hora. Los demás encargados del escenario pueden verlo.
            </div>
            <button onClick={cerrarAviso} style={{ boxSizing:'border-box', width:'100%', minHeight:'50px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:G.greenDk, fontWeight:900, fontSize:'.95rem', fontFamily:'inherit' }}>Entendido</button>
          </div>
        </div>
      )}

      <EncabezadoEscenario nombre={escenario.name} logoUrl={escenario.logo_url}
        rol={`${soloLectura ? 'Solo lectura' : 'Encargado'} · ${nombrePila}`} usuario={encargado}
        onLogo={soloLectura ? undefined : handleLogo} subiendoLogo={subiendoLogo}
        onCambiarEscenario={otros.length > 1 ? () => navigate('/escenario') : undefined} onLogout={handleLogout}/>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'22px 16px' }}>

        <div style={{ marginBottom:'20px' }}>
          <div style={{ fontSize:'1.55rem', fontWeight:900, letterSpacing:'-.02em', lineHeight:1.15 }}>Hola, {nombrePila}</div>
          <div style={{ fontSize:'.88rem', color:S.muted, marginTop:'4px' }}>¿Qué quieres hacer hoy?</div>
        </div>

        {/* Solicitudes de reserva esperando respuesta: lo más urgente va primero */}
        {reservasPendientes.length > 0 && (
          <button onClick={() => navigate(`/escenario/${B}/canchas`)}
            style={{ boxSizing:'border-box', display:'flex', alignItems:'center', gap:'12px', width:'100%', minHeight:'64px', padding:'10px 14px', marginBottom:'14px', background:S.card, border:`1px solid ${S.border}`, borderLeft:`4px solid ${S.gold}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left', fontFamily:'inherit' }}>
            <Bell size={20} color={S.gold} style={{ flexShrink:0 }}/>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:'block', fontWeight:800, fontSize:'.92rem' }}>{reservasPendientes.length} {reservasPendientes.length === 1 ? 'cliente quiere reservar' : 'clientes quieren reservar'}</span>
              <span style={{ display:'block', fontSize:'.76rem', color:S.muted, marginTop:'2px' }}>Toca para aceptar o rechazar</span>
            </span>
            <ChevronRight size={20} color={S.muted} style={{ flexShrink:0 }}/>
          </button>
        )}

        {/* Reservas: lo principal de todos los días */}
        <div style={TARJETA}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', padding:'12px 16px', background:S.card2, borderBottom:`1px solid ${S.border}` }}>
            <span style={{ ...ETIQUETA, display:'flex', alignItems:'center', gap:'7px' }}><CalendarDays size={14}/> Reservas de hoy</span>
            <span style={{ fontSize:'.74rem', color:S.muted, fontWeight:600 }}>{fmtDate(todayStr())}</span>
          </div>
          <div style={{ padding:'16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1px 1fr', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', fontWeight:900, lineHeight:1, letterSpacing:'-.03em' }}>{libres}</div>
                <div style={{ fontSize:'.78rem', color:S.text2, fontWeight:700, marginTop:'6px', display:'inline-flex', alignItems:'center', gap:'6px' }}><span style={{ width:'8px', height:'8px', borderRadius:'50%', background:S.green }}/> {libres === 1 ? 'Horario libre' : 'Horarios libres'}</div>
              </div>
              <div style={{ width:'1px', height:'46px', background:S.border }}/>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', fontWeight:900, lineHeight:1, letterSpacing:'-.03em' }}>{ocupados}</div>
                <div style={{ fontSize:'.78rem', color:S.text2, fontWeight:700, marginTop:'6px', display:'inline-flex', alignItems:'center', gap:'6px' }}><span style={{ width:'8px', height:'8px', borderRadius:'50%', background:S.loss }}/> {ocupados === 1 ? 'Ya reservado' : 'Ya reservados'}</div>
              </div>
            </div>
            <div style={{ height:'6px', borderRadius:'999px', background:S.soft, overflow:'hidden', marginBottom:'16px' }} aria-hidden="true">
              <div style={{ width:`${pctOcupado}%`, height:'100%', background:S.loss, borderRadius:'999px' }}/>
            </div>
            <button onClick={() => navigate(`/escenario/${B}/canchas`)}
              style={{ boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', width:'100%', minHeight:'54px', border:'none', borderRadius:'14px', cursor:'pointer', fontWeight:900, fontSize:'1rem', fontFamily:'inherit', background:S.cyan, color:G.greenDk }}>
              {soloLectura ? 'Ver los horarios' : 'Ver horarios y reservar'} <ChevronRight size={20}/>
            </button>
            {/* Los que juegan siempre el mismo día y hora: justo debajo de reservar, a un toque */}
            <button onClick={() => navigate(`/escenario/${B}/fijas`)}
              style={{ boxSizing:'border-box', display:'flex', alignItems:'center', gap:'12px', width:'100%', minHeight:'60px', marginTop:'10px', padding:'8px 14px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, fontFamily:'inherit', textAlign:'left' }}>
              <span style={{ width:'36px', height:'36px', borderRadius:'10px', background:G.greenBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Repeat size={18} color={G.green}/></span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', fontWeight:800, fontSize:'.95rem' }}>Clientes de todas las semanas</span>
                <span style={{ display:'block', fontSize:'.76rem', color:S.muted, marginTop:'2px' }}>{nFijos > 0 ? `${nFijos} ${nFijos === 1 ? 'cliente fijo' : 'clientes fijos'} · ver, agregar o quitar` : 'Los que juegan siempre el mismo día y hora'}</span>
              </span>
              <ChevronRight size={20} color={S.muted} style={{ flexShrink:0 }}/>
            </button>
          </div>
        </div>

        {/* Tienda */}
        <div style={TARJETA}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', padding:'12px 16px', background:S.card2, borderBottom:`1px solid ${S.border}` }}>
            <span style={{ ...ETIQUETA, display:'flex', alignItems:'center', gap:'7px' }}><ShoppingCart size={14}/> Tienda</span>
          </div>
          <div style={{ padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom: bajoStock.length > 0 ? '12px' : '16px' }}>
              <div style={{ fontSize:'2rem', fontWeight:900, letterSpacing:'-.03em', lineHeight:1 }}>{fmtMoney(totalVentasHoy)}</div>
              <div style={{ fontSize:'.8rem', color:S.muted, fontWeight:600 }}>vendido hoy</div>
            </div>
            {bajoStock.length > 0 && (
              <button onClick={() => navigate(`/escenario/${B}/inventario`)}
                style={{ boxSizing:'border-box', display:'flex', alignItems:'center', gap:'10px', width:'100%', minHeight:'46px', padding:'0 12px', marginBottom:'14px', background:S.goldBg, border:'none', borderRadius:'10px', color:S.gold, fontSize:'.84rem', fontWeight:700, cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                <AlertTriangle size={17} style={{ flexShrink:0 }}/>
                <span style={{ flex:1 }}>{bajoStock.length} {bajoStock.length === 1 ? 'producto con poco stock' : 'productos con poco stock'}</span>
                <ChevronRight size={17} style={{ flexShrink:0 }}/>
              </button>
            )}
            <button onClick={() => navigate(`/escenario/${B}/ventas`)}
              style={{ boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', width:'100%', minHeight:'52px', border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', fontWeight:800, fontSize:'.98rem', fontFamily:'inherit', background:S.card2, color:S.text }}>
              <ShoppingCart size={19}/> {soloLectura ? 'Ver las ventas' : 'Hacer una venta'}
            </button>
          </div>
        </div>

        {/* Más opciones: cerradas para no abrumar */}
        <button onClick={() => setMostrarMas(v => !v)} aria-expanded={mostrarMas}
          style={{ boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', minHeight:'56px', padding:'0 16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', cursor:'pointer', color:S.text, fontWeight:800, fontSize:'.95rem', fontFamily:'inherit' }}>
          <span style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            Más opciones
            {!mostrarMas && hayAvisosMas && <span aria-label="Hay avisos adentro" style={{ width:'8px', height:'8px', borderRadius:'50%', background:S.gold }}/>}
          </span>
          {mostrarMas ? <ChevronDown size={20} color={S.muted}/> : <ChevronRight size={20} color={S.muted}/>}
        </button>

        {mostrarMas && (
          <div style={{ marginTop:'18px', display:'flex', flexDirection:'column', gap:'20px' }}>
            {GRUPOS.map(g => (
              <div key={g.titulo}>
                <div style={{ ...ETIQUETA, margin:'0 4px 8px' }}>{g.titulo}</div>
                <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', overflow:'hidden' }}>
                  {g.items.map((n, i) => (
                    <button key={n.to} onClick={() => abrirOpcion(n.to)}
                      style={{ boxSizing:'border-box', display:'flex', alignItems:'center', gap:'14px', width:'100%', minHeight:'64px', padding:'10px 16px', background:'none', border:'none', borderTop: i > 0 ? `1px solid ${S.border}` : 'none', cursor:'pointer', color:S.text, textAlign:'left', fontFamily:'inherit' }}>
                      <n.icon size={21} color={S.muted} style={{ flexShrink:0 }}/>
                      <span style={{ flex:1, minWidth:0 }}>
                        <span style={{ display:'block', fontWeight:700, fontSize:'.92rem' }}>{n.label}</span>
                        <span style={{ display:'block', fontSize:'.76rem', color:S.muted, lineHeight:1.35, marginTop:'2px' }}>{n.desc}</span>
                      </span>
                      {n.aviso && <span style={{ background:S.goldBg, color:S.gold, borderRadius:'999px', fontSize:'.68rem', fontWeight:800, padding:'3px 9px', flexShrink:0, whiteSpace:'nowrap' }}>{n.aviso}</span>}
                      <ChevronRight size={18} color={S.faint} style={{ flexShrink:0 }}/>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
