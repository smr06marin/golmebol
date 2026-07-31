import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PortalBanner from '../components/PortalBanner'
import { fmtMoney, todayStr, allSlotsForDate } from '../lib/escenarioHelpers'
import { Building2, ShoppingCart, Smartphone, Package, Truck, Receipt, BarChart3, CheckSquare, Settings, ArrowRight } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'11px 14px', color:S.text, fontSize:'.9rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.72rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.05em' }

export default function EscenarioHomePage() {
  const navigate = useNavigate()
  const [encargado,  setEncargado]  = useState(null)
  const [escenario,  setEscenario]  = useState(null)
  const [productos,  setProductos]  = useState([])
  const [ventasHoy,  setVentasHoy]  = useState([])
  const [reservas,   setReservas]   = useState([])
  const [pedidosPend,setPedidosPend]= useState(0)
  const [loading,    setLoading]    = useState(true)
  const [nombreNuevo,setNombreNuevo]= useState('')
  const [ciudadNueva,setCiudadNueva]= useState('')
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState('')
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    setEncargado(p)

    if (p.escenario_id) {
      const { data: esc } = await supabase.from('escenarios').select('*').eq('id', p.escenario_id).single()
      setEscenario(esc || null)
      const hoy = todayStr()
      const [{ data: prods }, { data: ventas }, { data: rsvs }, { count: cPed }] = await Promise.all([
        supabase.from('escenario_productos').select('*').eq('escenario_id', p.escenario_id),
        supabase.from('escenario_ventas').select('*').eq('escenario_id', p.escenario_id).eq('fecha', hoy),
        supabase.from('escenario_reservas').select('*').eq('escenario_id', p.escenario_id).gte('fecha', hoy),
        supabase.from('escenario_pedidos').select('id', { count: 'exact', head: true }).eq('escenario_id', p.escenario_id).eq('estado', 'pendiente'),
      ])
      setProductos(prods || [])
      setVentasHoy(ventas || [])
      setReservas(rsvs || [])
      setPedidosPend(cPed || 0)
    }
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

  async function handleCrearEscenario() {
    setError('')
    if (!nombreNuevo.trim()) { setError('Ponle un nombre a tu escenario'); return }
    setGuardando(true)
    const { data: nuevo, error: errIns } = await supabase.from('escenarios')
      .insert({ name: nombreNuevo.trim(), city: ciudadNueva.trim() || null })
      .select().single()
    if (errIns || !nuevo) { setError('No se pudo crear: ' + (errIns?.message || '')); setGuardando(false); return }
    const { error: errUpd } = await supabase.from('players').update({ escenario_id: nuevo.id }).eq('id', encargado.id)
    setGuardando(false)
    if (errUpd) { setError('El escenario se creó pero no se pudo vincular a tu cuenta: ' + errUpd.message); return }
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  if (!encargado) return null

  const totalVentasHoy = ventasHoy.reduce((a, v) => a + Number(v.total || 0), 0)
  const gananciaHoy = ventasHoy.reduce((a, v) => a + Number(v.ganancia || 0), 0)
  const bajoStock = productos.filter(p => p.cantidad <= p.stock_minimo)
  const slotsHoy = escenario ? allSlotsForDate(escenario, reservas, todayStr()) : []
  const libres = slotsHoy.filter(s => s.estado === 'libre').length
  const ocupados = slotsHoy.filter(s => s.estado !== 'libre').length

  const NAV = [
    { to: '/escenario/canchas',    icon: GiSoccerBall,   label: 'Canchas',        desc: 'Ver horarios y reservar internamente' },
    { to: '/escenario/reservas',   icon: CheckSquare,    label: 'Solicitudes',    desc: 'Aprobar/rechazar reservas, mantenimiento' },
    { to: '/escenario/ventas',     icon: ShoppingCart,   label: 'Ventas',         desc: 'Punto de venta de la tienda' },
    { to: '/escenario/pedido',     icon: Smartphone,     label: 'Pedido remoto',  desc: 'Pedidos por WhatsApp desde la cancha' },
    { to: '/escenario/inventario', icon: Package,        label: 'Inventario',     desc: 'Productos, precios y stock' },
    { to: '/escenario/compras',    icon: Truck,          label: 'Compras',        desc: 'Registro de compras a proveedores' },
    { to: '/escenario/cierre',     icon: Receipt,        label: 'Cierre diario',  desc: 'Cierre e imprimir PDF' },
    { to: '/escenario/reportes',   icon: BarChart3,      label: 'Reportes',       desc: 'Más vendidos, ganancia por producto' },
    { to: '/escenario/config',     icon: Settings,       label: 'Configuración',  desc: 'Datos, WhatsApp, horarios, precios, fondo' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <PortalBanner theme="dark" sticky
        avatarUrl={escenario?.logo_url} avatarEmoji={<Building2 size={22}/>} avatarShape="rounded"
        onAvatarUpload={escenario ? handleLogo : undefined} uploadingAvatar={subiendoLogo}
        kicker={<span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><Building2 size={11}/> Escenario deportivo</span>} title={escenario?.name || 'Sin escenario todavía'}
        subtitle={<span>🏟️ Encargado · {encargado.name?.split(' ')[0]}</span>}
        subtitleColor={S.gold}
        usuario={encargado} actual="escenario" onLogout={handleLogout}
      />

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Sin escenario todavía */}
        {!encargado.escenario_id && (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px' }}>
            <div style={{ marginBottom:'8px' }}><Building2 size={28} color={S.cyan}/></div>
            <div style={{ fontWeight:'800', fontSize:'1.05rem', marginBottom:'4px' }}>Crea tu escenario</div>
            <div style={{ fontSize:'.8rem', color:S.muted, marginBottom:'18px' }}>Ponle el nombre y la ciudad — después podrás agregar el logo, los productos de la tienda y configurar las canchas.</div>
            <div style={{ marginBottom:'12px' }}>
              <label style={lbl}>Nombre del escenario *</label>
              <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} style={inp} placeholder="Ej: Canchas El Gol"/>
            </div>
            <div style={{ marginBottom:'16px' }}>
              <label style={lbl}>Ciudad</label>
              <input value={ciudadNueva} onChange={e => setCiudadNueva(e.target.value)} style={inp} placeholder="Ciudad"/>
            </div>
            {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'12px' }}>{error}</div>}
            <button onClick={handleCrearEscenario} disabled={guardando}
              style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.9rem', opacity:guardando?.7:1 }}>
              {guardando ? 'Creando...' : 'CREAR ESCENARIO →'}
            </button>
          </div>
        )}

        {/* Ya tiene escenario */}
        {encargado.escenario_id && escenario && (
          <div>
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
        )}
      </div>
    </div>
  )
}
