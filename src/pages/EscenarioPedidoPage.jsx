import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr } from '../lib/escenarioHelpers'
import { Link2, QrCode } from 'lucide-react'
import FlyerPedidoQR from '../components/FlyerPedidoQR'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }

export default function EscenarioPedidoPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [pedidos,   setPedidos]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [cart,      setCart]      = useState({})
  const [nombre,    setNombre]    = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [msg,       setMsg]       = useState('')
  const [copiado,   setCopiado]   = useState(false)
  const [mostrarQR, setMostrarQR] = useState(false)

  function copiarLinkClientes() {
    const link = `${window.location.origin}/pedir/${escenarioId}`
    navigator.clipboard?.writeText(link).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 2000)
    })
  }

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    setEncargado(p)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    const [{ data: prods }, { data: peds }] = await Promise.all([
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId).order('nombre'),
      supabase.from('escenario_pedidos').select('*').eq('escenario_id', escenarioId).eq('estado', 'pendiente').order('created_at', { ascending: false }),
    ])
    setProductos(prods || [])
    setPedidos(peds || [])
    setLoading(false)
  }

  function getProduct(id) { return productos.find(p => p.id === id) }
  function addToCart(id) { setCart(c => ({ ...c, [id]: (c[id]||0)+1 })) }

  async function enviarPedido() {
    const items = Object.entries(cart).filter(([,q])=>q>0).map(([id,q]) => { const p=getProduct(id); return { productId:id, nombre:p.nombre, cantidad:q, precio:p.precio } })
    if (items.length===0) return
    const total = items.reduce((a,it)=>a+it.cantidad*it.precio,0)
    const now = new Date()
    const { error } = await supabase.from('escenario_pedidos').insert({
      escenario_id: escenario.id, items, nombre: nombre.trim()||'Cliente', telefono: telefono.trim(),
      total, fecha: todayStr(), hora: now.toTimeString().slice(0,5), estado:'pendiente',
    })
    if (error) { setMsg('Error: ' + error.message); return }
    if (escenario?.whatsapp) {
      const wa = `Hola, quiero hacer un pedido:\n` + items.map(it=>`- ${it.cantidad}x ${it.nombre} (${fmtMoney(it.precio*it.cantidad)})`).join('\n') +
        `\nTotal: ${fmtMoney(total)}\nNombre: ${nombre||'Cliente'}\nEstoy en la cancha, ¿me lo pueden traer?`
      window.open(`https://wa.me/${escenario.whatsapp}?text=${encodeURIComponent(wa)}`, '_blank')
    }
    setCart({}); setNombre(''); setTelefono('')
    setMsg('📱 Pedido enviado'); setTimeout(()=>setMsg(''),3000)
    fetchTodo()
  }

  async function entregarPedido(pedido) {
    const items = pedido.items.map(it => {
      const p = getProduct(it.productId)
      const cantidad = p ? Math.min(it.cantidad, p.cantidad) : it.cantidad
      return { productId: it.productId, nombre: it.nombre, cantidad, precio: it.precio, costo: p?.costo || 0 }
    })
    await Promise.all(items.map(it => { const p=getProduct(it.productId); return p ? supabase.from('escenario_productos').update({ cantidad: p.cantidad - it.cantidad }).eq('id', it.productId) : null }).filter(Boolean))
    // El domicilio ($1.000 que cobra la página pública por llevar el pedido)
    // no viene en "items" — hay que sumarlo aparte para que la venta quede
    // completa (es ganancia pura, no tiene costo asociado).
    const domicilio = pedido.domicilio || 0
    const total = items.reduce((a,it)=>a+it.cantidad*it.precio,0) + domicilio
    const costoTotal = items.reduce((a,it)=>a+it.cantidad*it.costo,0)
    const now = new Date()
    await supabase.from('escenario_ventas').insert({
      escenario_id: escenario.id, fecha: todayStr(), hora: now.toTimeString().slice(0,5),
      items, total, costo_total: costoTotal, ganancia: total-costoTotal, origen_pedido: true,
    })
    await supabase.from('escenario_pedidos').update({ estado:'completado' }).eq('id', pedido.id)
    setMsg('✅ Pedido entregado y registrado como venta'); setTimeout(()=>setMsg(''),3000)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const items = Object.entries(cart).filter(([,q])=>q>0)
  const total = items.reduce((a,[id,q])=> a + q*getProduct(id).precio, 0)

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>📱 Pedido a distancia</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}
        <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'10px' }}>Para clientes que están en la cancha y no quieren acercarse a la tienda: arman su pedido y lo envían por WhatsApp.</div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'18px' }}>
          <button onClick={copiarLinkClientes}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', padding:'11px 10px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'10px', cursor:'pointer', color:S.cyan, fontWeight:700, fontSize:'.76rem', textAlign:'center' }}>
            <Link2 size={15}/> {copiado ? '¡Copiado!' : 'Copiar enlace'}
          </button>
          <button onClick={()=>setMostrarQR(true)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', padding:'11px 10px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'10px', cursor:'pointer', color:S.cyan, fontWeight:700, fontSize:'.76rem', textAlign:'center' }}>
            <QrCode size={15}/> Código QR para imprimir
          </button>
        </div>

        <div style={{ fontWeight:800, fontSize:'.85rem', marginBottom:'10px' }}>Armar pedido manual (por teléfono)</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
          {productos.map(p => (
            <button key={p.id} onClick={()=>addToCart(p.id)}
              style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', padding:'14px 8px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', cursor:'pointer', color:S.text }}>
              {cart[p.id] && <span style={{ position:'absolute', top:'-6px', right:'-6px', background:S.cyan, color:'#000', borderRadius:'50%', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.72rem', fontWeight:800 }}>{cart[p.id]}</span>}
              {p.foto_url
                ? <div style={{ width:'34px', height:'34px', borderRadius:'8px', overflow:'hidden' }}><img src={p.foto_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/></div>
                : <span style={{ fontSize:'1.4rem' }}>{p.emoji || '📦'}</span>}
              <span style={{ fontSize:'.72rem', fontWeight:700, textAlign:'center' }}>{p.nombre}</span>
              <span style={{ fontSize:'.7rem', color:S.gold, fontWeight:700 }}>{fmtMoney(p.precio)}</span>
            </button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
          <input value={nombre} onChange={e=>setNombre(e.target.value)} style={inp} placeholder="Tu nombre"/>
          <input value={telefono} onChange={e=>setTelefono(e.target.value)} style={inp} placeholder="Teléfono"/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'1rem', marginBottom:'10px' }}>
          <span>Total</span><span style={{ color:S.cyan }}>{fmtMoney(total)}</span>
        </div>
        <button onClick={enviarPedido} disabled={items.length===0}
          style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem', opacity:items.length===0?.5:1, marginBottom:'22px' }}>
          Enviar pedido por WhatsApp
        </button>

        <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Pedidos pendientes por entregar</div>
        {pedidos.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>No hay pedidos remotos pendientes.</div> : pedidos.map(o => (
          <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 14px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', marginBottom:'8px' }}>
            <span style={{ fontSize:'.78rem' }}>
              {o.nombre} · {(o.items||[]).map(i=>i.cantidad+'x '+i.nombre).join(', ')} · {fmtMoney(o.total)}
              {o.domicilio > 0 && <span style={{ color:S.muted }}> (incluye {fmtMoney(o.domicilio)} domicilio)</span>}
              {o.metodo_pago === 'efectivo' && (
                <span style={{ display:'block', color:S.gold, fontWeight:700, marginTop:'2px' }}>
                  💵 Efectivo{o.paga_con ? ` · paga con ${fmtMoney(o.paga_con)}` : ''}{o.devuelta!=null ? ` · devuelta ${fmtMoney(o.devuelta)}` : ''}
                </span>
              )}
              {o.metodo_pago === 'transferencia' && (
                <span style={{ display:'block', color:S.gold, fontWeight:700, marginTop:'2px' }}>🏦 Transferencia</span>
              )}
            </span>
            <button onClick={()=>entregarPedido(o)} style={{ padding:'6px 12px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:700, fontSize:'.75rem', whiteSpace:'nowrap', flexShrink:0 }}>Entregado</button>
          </div>
        ))}
      </div>

      {mostrarQR && <FlyerPedidoQR escenario={escenario} escenarioId={escenarioId} onClose={()=>setMostrarQR(false)}/>}
    </div>
  )
}
