import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PortalBanner from '../components/PortalBanner'
import { fmtMoney, fmtDate, todayStr, allSlotsForDate, escenarioActivo, asegurarReservasFijasThrottled, obtenerAccesoEscenario, invalidarAccesoEscenario } from '../lib/escenarioHelpers'
import { fmtHoraDate } from '../lib/horaHelpers'
import { Building2, ShoppingCart, Smartphone, Package, Truck, Wallet, Receipt, BarChart3, Settings, ArrowLeftRight, Repeat, History, Bell, ChevronRight, ChevronDown } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  green: '#22c55e', loss: '#d93025', warn: '#e8710a',
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
    const [{ data: asignaciones }, { data: prods }, { data: ventas }, { data: cs }, { data: rsvs }, { count: cPed }, { data: act }] = await Promise.all([
      supabase.from('escenario_encargados').select('escenarios(id, name, logo_url)').eq('player_id', p.id),
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId),
      supabase.from('escenario_ventas').select('*').eq('escenario_id', escenarioId).eq('fecha', hoy).eq('estado', 'completada'),
      supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true),
      supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId).gte('fecha', hoy),
      supabase.from('escenario_pedidos').select('id', { count: 'exact', head: true }).eq('escenario_id', escenarioId).eq('estado', 'pendiente'),
      supabase.from('escenario_actividad').select('*').eq('escenario_id', escenarioId).order('created_at', { ascending: false }).limit(8),
      asegurarReservasFijasThrottled(escenarioId),
    ])
    setOtros((asignaciones || []).map(a => a.escenarios).filter(Boolean))
    setProductos(prods || [])
    setVentasHoy(ventas || [])
    setCanchas(cs || [])
    setReservas(rsvs || [])
    setPedidosPend(cPed || 0)
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
  // Lo de todos los días va grande arriba; el resto queda agrupado y explicado en "Más opciones".
  const GRUPOS = [
    { titulo: 'Tu tienda', items: [
      { to: `/escenario/${B}/inventario`, icon: Package,  label: 'Productos y precios', desc: 'Cuánto hay y cuánto cuesta cada cosa', badge: bajoStock.length, badgeTxt: 'poco stock' },
      { to: `/escenario/${B}/compras`,    icon: Truck,    label: 'Compras', desc: 'Lo que le compras a los proveedores' },
      { to: `/escenario/${B}/gastos`,     icon: Wallet,   label: 'Gastos', desc: 'Arriendo, servicios, nómina y otros' },
    ] },
    { titulo: 'Informes', items: [
      { to: `/escenario/${B}/cierre`,   icon: Receipt,   label: 'Informe del día', desc: 'Todo el resumen del día, para imprimir o guardar en PDF' },
      { to: `/escenario/${B}/reportes`, icon: BarChart3, label: 'Lo más vendido', desc: 'Qué productos dejan más ganancia' },
    ] },
    { titulo: 'Otras cosas', items: [
      { to: `/escenario/${B}/fijas`,     icon: Repeat,     label: 'Clientes de todas las semanas', desc: 'Los que juegan siempre el mismo día y hora' },
      { to: `/escenario/${B}/pedido`,    icon: Smartphone, label: 'Pedidos desde la cancha', desc: 'Los que llegan por WhatsApp', badge: pedidosPend, badgeTxt: 'por atender' },
      { to: `/escenario/${B}/actividad`, icon: History,    label: 'Quién hizo qué', desc: 'Cambios de precios, ventas y cancelaciones', badge: hayActividadNueva ? 1 : 0, badgeTxt: 'nuevo' },
      { to: `/escenario/${B}/config`,    icon: Settings,   label: 'Ajustes del escenario', desc: 'Horarios, precios, datos y página pública' },
    ] },
  ]
  function abrirOpcion(to) {
    if (to.endsWith('/actividad') && actividadReciente[0]) {
      try { localStorage.setItem(`escenario_actividad_visto_${escenarioId}_${encargado.id}`, actividadReciente[0].created_at) } catch { /* sin almacenamiento: no pasa nada */ }
    }
    navigate(to)
  }
  const avisosMas = bajoStock.length + pedidosPend + (hayActividadNueva ? 1 : 0)
  const BOTON_GRANDE = { boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', width:'100%', minHeight:'56px', border:'none', borderRadius:'14px', cursor:'pointer', fontWeight:900, fontSize:'1rem', fontFamily:'inherit' }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {mostrarAviso && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.gold}`, borderRadius:'16px', padding:'24px', maxWidth:'360px', textAlign:'center' }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>⚠️</div>
            <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:'8px' }}>Recordatorio</div>
            <div style={{ fontSize:'.86rem', color:S.text2, lineHeight:1.5, marginBottom:'18px' }}>
              Todo lo que cambies aquí (ventas, precios, cancelaciones, pagos) queda anotado con tu nombre, la fecha y la hora. Los demás encargados del escenario pueden verlo.
            </div>
            <button onClick={cerrarAviso} style={{ ...BOTON_GRANDE, background:S.cyan, color:'#000', minHeight:'48px', fontSize:'.9rem' }}>Entendido</button>
          </div>
        </div>
      )}

      <PortalBanner theme="dark" sticky
        avatarUrl={escenario.logo_url} avatarEmoji={<Building2 size={22}/>} avatarShape="rounded"
        onAvatarUpload={soloLectura ? undefined : handleLogo} uploadingAvatar={subiendoLogo}
        kicker={<span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><Building2 size={11}/> Escenario deportivo</span>} title={escenario.name}
        subtitle={<span>🏟️ {soloLectura ? '👁️ Solo lectura' : 'Encargado'} · {nombrePila}</span>}
        subtitleColor={S.gold}
        usuario={encargado} actual="escenario" onLogout={handleLogout}
      />

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'20px 16px' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', marginBottom:'16px' }}>
          <div>
            <div style={{ fontSize:'1.25rem', fontWeight:900, lineHeight:1.2 }}>Hola, {nombrePila} 👋</div>
            <div style={{ fontSize:'.84rem', color:S.muted, marginTop:'2px' }}>¿Qué quieres hacer hoy?</div>
          </div>
          {otros.length > 1 && (
            <button onClick={()=>navigate('/escenario')}
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', padding:'0 12px', minHeight:'40px', cursor:'pointer', color:S.text2, fontSize:'.76rem', fontWeight:700, flexShrink:0, fontFamily:'inherit' }}>
              <ArrowLeftRight size={13}/> Cambiar
            </button>
          )}
        </div>

        {/* Solicitudes de reserva esperando respuesta: lo más urgente va primero */}
        {reservasPendientes.length > 0 && (
          <button onClick={() => navigate(`/escenario/${B}/canchas`)}
            style={{ ...BOTON_GRANDE, justifyContent:'space-between', padding:'12px 16px', marginBottom:'14px', background:'rgba(232,113,14,.14)', border:`1.5px solid ${S.warn}`, color:S.text, textAlign:'left', fontWeight:700, fontSize:'.9rem' }}>
            <span style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <Bell size={20} color={S.warn}/>
              <span><b style={{ color:S.warn }}>{reservasPendientes.length} {reservasPendientes.length === 1 ? 'cliente quiere' : 'clientes quieren'} reservar.</b><br/><span style={{ fontSize:'.78rem', color:S.text2, fontWeight:500 }}>Toca para aceptar o rechazar</span></span>
            </span>
            <ChevronRight size={20} color={S.warn}/>
          </button>
        )}

        {/* 1 · Reservas: lo principal de todos los días */}
        <div style={{ background:`linear-gradient(160deg, ${S.card}, ${S.card2})`, border:`1.5px solid ${S.cyan}66`, borderRadius:'18px', padding:'16px', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
            <GiSoccerBall size={22} color={S.cyan}/>
            <div>
              <div style={{ fontWeight:900, fontSize:'1.02rem' }}>Reservas de hoy</div>
              <div style={{ fontSize:'.74rem', color:S.muted }}>{fmtDate(todayStr())}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' }}>
            <div style={{ background:'rgba(34,197,94,.1)', border:`1px solid ${S.green}55`, borderRadius:'12px', padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:'1.7rem', fontWeight:900, color:S.green, lineHeight:1 }}>{libres}</div>
              <div style={{ fontSize:'.76rem', color:S.text2, marginTop:'4px', fontWeight:700 }}>Horarios libres</div>
            </div>
            <div style={{ background:'rgba(217,48,37,.1)', border:`1px solid ${S.loss}55`, borderRadius:'12px', padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:'1.7rem', fontWeight:900, color:'#ff7b72', lineHeight:1 }}>{ocupados}</div>
              <div style={{ fontSize:'.76rem', color:S.text2, marginTop:'4px', fontWeight:700 }}>Ya reservados</div>
            </div>
          </div>
          <button onClick={() => navigate(`/escenario/${B}/canchas`)} style={{ ...BOTON_GRANDE, background:S.cyan, color:'#000' }}>
            <GiSoccerBall size={20}/> {soloLectura ? 'Ver los horarios' : 'Ver horarios y reservar'}
          </button>
        </div>

        {/* 2 · Tienda */}
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'18px', padding:'16px', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <ShoppingCart size={22} color={S.gold}/>
              <div style={{ fontWeight:900, fontSize:'1.02rem' }}>Tienda</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'1.25rem', fontWeight:900, color:S.gold, lineHeight:1 }}>{fmtMoney(totalVentasHoy)}</div>
              <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'3px' }}>vendido hoy</div>
            </div>
          </div>
          {bajoStock.length > 0 && (
            <button onClick={() => navigate(`/escenario/${B}/inventario`)}
              style={{ display:'block', width:'100%', textAlign:'left', background:'rgba(249,168,37,.1)', border:`1px solid ${S.gold}66`, borderRadius:'10px', padding:'9px 12px', marginBottom:'10px', color:S.gold, fontSize:'.8rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              📦 {bajoStock.length} {bajoStock.length === 1 ? 'producto con poco stock' : 'productos con poco stock'} — toca para verlos
            </button>
          )}
          <button onClick={() => navigate(`/escenario/${B}/ventas`)} style={{ ...BOTON_GRANDE, background:S.gold, color:'#1a1200' }}>
            <ShoppingCart size={20}/> {soloLectura ? 'Ver las ventas' : 'Hacer una venta'}
          </button>
        </div>

        {/* Más opciones: cerradas para no abrumar */}
        <button onClick={() => setMostrarMas(v => !v)} aria-expanded={mostrarMas}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', minHeight:'54px', padding:'0 16px', background:S.surface, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, fontWeight:800, fontSize:'.92rem', fontFamily:'inherit' }}>
          <span style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            Más opciones
            {!mostrarMas && avisosMas > 0 && <span style={{ background:S.warn, color:'#fff', borderRadius:'999px', fontSize:'.68rem', fontWeight:900, padding:'2px 8px' }}>{avisosMas}</span>}
          </span>
          {mostrarMas ? <ChevronDown size={20} color={S.muted}/> : <ChevronRight size={20} color={S.muted}/>}
        </button>

        {mostrarMas && (
          <div style={{ marginTop:'12px', display:'flex', flexDirection:'column', gap:'16px' }}>
            {GRUPOS.map(g => (
              <div key={g.titulo}>
                <div style={{ fontSize:'.7rem', fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:S.muted, margin:'0 4px 8px' }}>{g.titulo}</div>
                <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', overflow:'hidden' }}>
                  {g.items.map((n, i) => (
                    <button key={n.to} onClick={() => { abrirOpcion(n.to) }}
                      style={{ display:'flex', alignItems:'center', gap:'12px', width:'100%', minHeight:'62px', padding:'10px 14px', background:'none', border:'none', borderTop: i > 0 ? `1px solid ${S.border}` : 'none', cursor:'pointer', color:S.text, textAlign:'left', fontFamily:'inherit' }}>
                      <span style={{ width:'38px', height:'38px', borderRadius:'10px', background:S.cyanDim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><n.icon size={19} color={S.cyan}/></span>
                      <span style={{ flex:1, minWidth:0 }}>
                        <span style={{ display:'block', fontWeight:800, fontSize:'.9rem' }}>{n.label}</span>
                        <span style={{ display:'block', fontSize:'.74rem', color:S.muted, lineHeight:1.35, marginTop:'1px' }}>{n.desc}</span>
                      </span>
                      {n.badge > 0 && <span style={{ background:S.warn, color:'#fff', borderRadius:'999px', fontSize:'.66rem', fontWeight:900, padding:'3px 8px', flexShrink:0 }}>{n.badge === 1 && n.badgeTxt === 'nuevo' ? 'nuevo' : `${n.badge} ${n.badgeTxt}`}</span>}
                      <ChevronRight size={18} color={S.muted} style={{ flexShrink:0 }}/>
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
