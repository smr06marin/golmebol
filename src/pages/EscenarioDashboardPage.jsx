import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PortalBanner from '../components/PortalBanner'
import { fmtMoney, todayStr, allSlotsForDate, escenarioActivo, asegurarReservasFijas } from '../lib/escenarioHelpers'
import { Building2, ShoppingCart, Smartphone, Package, Truck, Receipt, BarChart3, CheckSquare, Settings, ArrowRight, ArrowLeftRight, Repeat } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
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

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true); setNotFound(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    setEncargado(p)

    const { data: acceso } = await supabase.from('escenario_encargados').select('id').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { setNotFound(true); setLoading(false); return }

    const { data: asignaciones } = await supabase.from('escenario_encargados').select('escenarios(id, name, logo_url)').eq('player_id', p.id)
    setOtros((asignaciones || []).map(a => a.escenarios).filter(Boolean))

    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)

    const hoy = todayStr()
    await asegurarReservasFijas(escenarioId)
    const [{ data: prods }, { data: ventas }, { data: cs }, { data: rsvs }, { count: cPed }] = await Promise.all([
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId),
      supabase.from('escenario_ventas').select('*').eq('escenario_id', escenarioId).eq('fecha', hoy).eq('estado', 'completada'),
      supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true),
      supabase.from('escenario_reservas').select('*').eq('escenario_id', escenarioId).gte('fecha', hoy),
      supabase.from('escenario_pedidos').select('id', { count: 'exact', head: true }).eq('escenario_id', escenarioId).eq('estado', 'pendiente'),
    ])
    setProductos(prods || [])
    setVentasHoy(ventas || [])
    setCanchas(cs || [])
    setReservas(rsvs || [])
    setPedidosPend(cPed || 0)
    setLoading(false)
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
      setEscenario(e => ({ ...e, logo_url: urlData.publicUrl }))
    }
    setSubiendoLogo(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (notFound) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:20, textAlign:'center', gap:'14px' }}>
      No tenés acceso a este escenario.
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
  const slotsHoy = allSlotsForDate(escenario, canchas, reservas, todayStr())
  const libres = slotsHoy.filter(s => s.estado === 'libre').length
  const ocupados = slotsHoy.filter(s => s.estado !== 'libre').length

  const B = escenarioId
  const NAV = [
    { to: `/escenario/${B}/canchas`,    icon: GiSoccerBall,   label: 'Canchas',        desc: 'Ver horarios y reservar internamente' },
    { to: `/escenario/${B}/reservas`,   icon: CheckSquare,    label: 'Solicitudes',    desc: 'Aprobar/rechazar reservas, mantenimiento' },
    { to: `/escenario/${B}/fijas`,      icon: Repeat,         label: 'Reservas fijas', desc: 'Clientes que juegan el mismo día y hora' },
    { to: `/escenario/${B}/ventas`,     icon: ShoppingCart,   label: 'Ventas',         desc: 'Punto de venta de la tienda' },
    { to: `/escenario/${B}/pedido`,     icon: Smartphone,     label: 'Pedido remoto',  desc: 'Pedidos por WhatsApp desde la cancha' },
    { to: `/escenario/${B}/inventario`, icon: Package,        label: 'Inventario',     desc: 'Productos, precios y stock' },
    { to: `/escenario/${B}/compras`,    icon: Truck,          label: 'Compras',        desc: 'Registro de compras a proveedores' },
    { to: `/escenario/${B}/cierre`,     icon: Receipt,        label: 'Cierre diario',  desc: 'Cierre e imprimir PDF' },
    { to: `/escenario/${B}/reportes`,   icon: BarChart3,      label: 'Reportes',       desc: 'Más vendidos, ganancia por producto' },
    { to: `/escenario/${B}/config`,     icon: Settings,       label: 'Configuración',  desc: 'Datos, WhatsApp, horarios, precios, fondo' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <PortalBanner theme="dark" sticky
        avatarUrl={escenario.logo_url} avatarEmoji={<Building2 size={22}/>} avatarShape="rounded"
        onAvatarUpload={handleLogo} uploadingAvatar={subiendoLogo}
        kicker={<span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><Building2 size={11}/> Escenario deportivo</span>} title={escenario.name}
        subtitle={<span>🏟️ Encargado · {encargado.name?.split(' ')[0]}</span>}
        subtitleColor={S.gold}
        usuario={encargado} actual="escenario" onLogout={handleLogout}
      />

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'20px 16px' }}>

        {otros.length > 1 && (
          <button onClick={()=>navigate('/escenario')}
            style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'7px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'14px' }}>
            <ArrowLeftRight size={12}/> Cambiar de escenario ({otros.length})
          </button>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:S.cyan }}>{fmtMoney(totalVentasHoy)}</div>
            <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Ventas hoy</div>
          </div>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:S.gold }}>{fmtMoney(gananciaHoy)}</div>
            <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Ganancia hoy</div>
          </div>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:'#3ddc84' }}>{libres}</div>
            <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Horarios libres hoy</div>
          </div>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:'#ff6b6b' }}>{ocupados}</div>
            <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Horarios ocupados hoy</div>
          </div>
        </div>

        {(bajoStock.length > 0 || pedidosPend > 0) && (
          <div style={{ background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'12px', padding:'12px 14px', marginBottom:'16px', fontSize:'.78rem', color:S.cyan, display:'flex', flexDirection:'column', gap:'4px' }}>
            {bajoStock.length > 0 && <div>📦 {bajoStock.length} producto{bajoStock.length===1?'':'s'} con poco stock</div>}
            {pedidosPend > 0 && <div>📱 {pedidosPend} pedido{pedidosPend===1?'':'s'} remoto{pedidosPend===1?'':'s'} pendiente{pedidosPend===1?'':'s'}</div>}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {NAV.map(n => (
            <button key={n.to} onClick={() => navigate(n.to)}
              style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left' }}>
              <n.icon size={22} color={S.cyan}/>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:'700', fontSize:'.9rem' }}>{n.label}</div>
                <div style={{ fontSize:'.72rem', color:S.muted }}>{n.desc}</div>
              </div>
              <ArrowRight size={15} color={S.muted}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
