import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PortalBanner from '../components/PortalBanner'
import { fmtMoney, todayStr, allSlotsForDate, escenarioActivo, asegurarReservasFijasThrottled, obtenerAccesoEscenario, invalidarAccesoEscenario } from '../lib/escenarioHelpers'
import { fmtHoraDate } from '../lib/horaHelpers'
import { Building2, ShoppingCart, Smartphone, Package, Truck, Wallet, Receipt, BarChart3, Settings, ArrowLeftRight, Repeat, History, AlertTriangle, Pencil } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import EscuelaFeatureCard from '../components/EscuelaFeatureCard'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  green: '#22c55e', loss: '#d93025',
}

// Mismas fotos de fondo (tenues, solo de ambiente) que ya se usan en el
// portal de escuela — así las tarjetas de Escenario quedan con el mismo
// look sin depender de subir imágenes nuevas.
const IMG_CANCHA      = 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=60'
const IMG_TIENDA      = 'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=60'
const IMG_EQUIPO      = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=60'
const IMG_CLIPBOARD   = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60'
const IMG_TROFEO      = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=60'

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
  const [expandirActividad, setExpandirActividad] = useState(false)
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

  function toggleActividad() {
    setExpandirActividad(v => {
      const abriendo = !v
      if (abriendo && actividadReciente[0]) {
        localStorage.setItem(`escenario_actividad_visto_${escenarioId}_${encargado.id}`, actividadReciente[0].created_at)
      }
      return abriendo
    })
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
  const NAV = [
    { to: `/escenario/${B}/canchas`,    icon: GiSoccerBall,   label: 'Canchas',        desc: 'Ver horarios y reservar internamente', bg: IMG_CANCHA },
    { to: `/escenario/${B}/fijas`,      icon: Repeat,         label: 'Reservas fijas', desc: 'Clientes que juegan el mismo día y hora', bg: IMG_CLIPBOARD },
    { to: `/escenario/${B}/ventas`,     icon: ShoppingCart,   label: 'Ventas',         desc: 'Punto de venta de la tienda', bg: IMG_TIENDA },
    { to: `/escenario/${B}/pedido`,     icon: Smartphone,     label: 'Pedido remoto',  desc: 'Pedidos por WhatsApp desde la cancha', bg: IMG_EQUIPO, badge: pedidosPend, warn: pedidosPend > 0 },
    { to: `/escenario/${B}/inventario`, icon: Package,        label: 'Inventario',     desc: 'Productos, precios y stock', bg: IMG_TIENDA, badge: bajoStock.length, warn: bajoStock.length > 0 },
    { to: `/escenario/${B}/compras`,    icon: Truck,          label: 'Compras',        desc: 'Registro de compras a proveedores', bg: IMG_CLIPBOARD },
    { to: `/escenario/${B}/gastos`,     icon: Wallet,         label: 'Gastos',         desc: 'Arriendo, servicios, nómina y otros gastos', bg: IMG_TROFEO },
    { to: `/escenario/${B}/cierre`,     icon: Receipt,        label: 'Informe diario', desc: 'Canchas, ventas, compras, deudas y stock — imprimir PDF', bg: IMG_EQUIPO },
    { to: `/escenario/${B}/reportes`,   icon: BarChart3,      label: 'Reportes',       desc: 'Más vendidos, ganancia por producto', bg: IMG_TROFEO },
    { to: `/escenario/${B}/actividad`,  icon: History,        label: 'Actividad',      desc: 'Quién cambió precios, agregó o eliminó algo', bg: IMG_CANCHA },
    { to: `/escenario/${B}/config`,     icon: Settings,       label: 'Configuración',  desc: 'Datos, WhatsApp, horarios, precios, fondo', bg: IMG_CLIPBOARD },
  ]

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {mostrarAviso && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.gold}`, borderRadius:'16px', padding:'24px', maxWidth:'360px', textAlign:'center' }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>⚠️</div>
            <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:'8px' }}>Recordatorio</div>
            <div style={{ fontSize:'.82rem', color:S.text2, lineHeight:1.5, marginBottom:'18px' }}>
              Recuerda que cualquier modificación que hagas acá — ventas, precios, cancelaciones, pagos, lo que sea — queda registrada con tu nombre, la fecha y la hora. Todos los que tienen acceso a este escenario van a poder ver que fuiste vos quien lo hizo.
            </div>
            <button onClick={cerrarAviso} style={{ width:'100%', padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>Entendido</button>
          </div>
        </div>
      )}

      <PortalBanner theme="dark" sticky
        avatarUrl={escenario.logo_url} avatarEmoji={<Building2 size={22}/>} avatarShape="rounded"
        onAvatarUpload={soloLectura ? undefined : handleLogo} uploadingAvatar={subiendoLogo}
        kicker={<span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><Building2 size={11}/> Escenario deportivo</span>} title={escenario.name}
        subtitle={<span>🏟️ {soloLectura ? '👁️ Solo lectura' : 'Encargado'} · {encargado.name?.split(' ')[0]}</span>}
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

        {!soloLectura && (
          <button onClick={()=>navigate(`/escenario/${B}/config`)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', width:'100%', padding:'10px', marginBottom:'14px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'10px', cursor:'pointer', color:S.cyan, fontSize:'.8rem', fontWeight:'700' }}>
            <Pencil size={13}/> Editar escenario y página pública
          </button>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.cyan}44`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}><ShoppingCart size={18} color={S.cyan}/></div>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:S.cyan, lineHeight:1 }}>{fmtMoney(totalVentasHoy)}</div>
            <div style={{ fontSize:'.72rem', color:S.text, marginTop:'4px', fontWeight:'700' }}>Ventas hoy</div>
          </div>
          <div style={{ background:S.card, border:`1px solid ${S.gold}44`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}><Wallet size={18} color={S.gold}/></div>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:S.gold, lineHeight:1 }}>{fmtMoney(gananciaHoy)}</div>
            <div style={{ fontSize:'.72rem', color:S.text, marginTop:'4px', fontWeight:'700' }}>Ganancia hoy</div>
          </div>
          <div style={{ background:S.card, border:`1px solid ${S.green}44`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}><GiSoccerBall size={18} color={S.green}/></div>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:S.green, lineHeight:1 }}>{libres}</div>
            <div style={{ fontSize:'.72rem', color:S.text, marginTop:'4px', fontWeight:'700' }}>Horarios libres</div>
            <div style={{ fontSize:'.62rem', color:S.muted, marginTop:'1px' }}>Hoy</div>
          </div>
          <div style={{ background:S.card, border:`1px solid ${S.loss}44`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}><GiSoccerBall size={18} color={S.loss}/></div>
            <div style={{ fontSize:'1.4rem', fontWeight:'900', color:S.loss, lineHeight:1 }}>{ocupados}</div>
            <div style={{ fontSize:'.72rem', color:S.text, marginTop:'4px', fontWeight:'700' }}>Horarios ocupados</div>
            <div style={{ fontSize:'.62rem', color:S.muted, marginTop:'1px' }}>Hoy</div>
          </div>
        </div>

        {(bajoStock.length > 0 || pedidosPend > 0 || reservasPendientes.length > 0) && (
          <div style={{ background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'12px', padding:'12px 14px', marginBottom:'16px', fontSize:'.78rem', color:S.cyan, display:'flex', flexDirection:'column', gap:'4px' }}>
            {bajoStock.length > 0 && <div>📦 {bajoStock.length} producto{bajoStock.length===1?'':'s'} con poco stock</div>}
            {pedidosPend > 0 && <div>📱 {pedidosPend} pedido{pedidosPend===1?'':'s'} remoto{pedidosPend===1?'':'s'} pendiente{pedidosPend===1?'':'s'}</div>}
            {reservasPendientes.length > 0 && (
              <div onClick={() => navigate(`/escenario/${escenarioId}/canchas`)} style={{ cursor:'pointer', textDecoration:'underline' }}>
                🏟️ {reservasPendientes.length} solicitud{reservasPendientes.length===1?'':'es'} de reserva pendiente{reservasPendientes.length===1?'':'s'} de confirmar (aunque no haya llegado el WhatsApp) — toca para revisar
              </div>
            )}
          </div>
        )}

        {actividadReciente.length > 0 && (
          <div style={{ marginBottom:'16px' }}>
            <button onClick={toggleActividad}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background: hayActividadNueva ? 'rgba(249,168,37,.1)' : S.card, border:`1px solid ${hayActividadNueva ? S.gold : S.border}`, borderRadius:'12px', padding:'12px 14px', cursor:'pointer', color: hayActividadNueva ? S.gold : S.text2, fontWeight:700, fontSize:'.8rem' }}>
              <span style={{ display:'flex', alignItems:'center', gap:'7px' }}><AlertTriangle size={14}/> {hayActividadNueva ? 'Hay movimientos nuevos en el sistema' : 'Actividad reciente'}</span>
              <span style={{ fontSize:'.7rem' }}>{expandirActividad ? 'Ocultar' : 'Ver'}</span>
            </button>
            {expandirActividad && (
              <div style={{ marginTop:'8px', display:'flex', flexDirection:'column', gap:'6px' }}>
                {actividadReciente.map(a => (
                  <div key={a.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 12px' }}>
                    <div style={{ fontSize:'.8rem' }}>{a.descripcion}</div>
                    <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'2px' }}>{a.player_nombre || 'Alguien'} · {fmtHoraDate(a.created_at)}</div>
                  </div>
                ))}
                <button onClick={()=>navigate(`/escenario/${escenarioId}/actividad`)} style={{ background:'none', border:'none', color:S.cyan, fontSize:'.76rem', cursor:'pointer', padding:'6px 0', textAlign:'left' }}>Ver todo el historial →</button>
              </div>
            )}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px' }}>
          {NAV.map(n => (
            <EscuelaFeatureCard key={n.to} onClick={() => navigate(n.to)} bg={n.bg}
              icon={<n.icon size={24} color={S.green}/>} title={n.label} desc={n.desc}
              badge={n.badge} warn={n.warn}/>
          ))}
        </div>
      </div>
    </div>
  )
}
