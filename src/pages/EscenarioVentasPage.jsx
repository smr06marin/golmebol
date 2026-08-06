import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr } from '../lib/escenarioHelpers'
import { ShoppingCart, Search, Trash2, DollarSign } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
  green: '#22c55e', greenDark: '#16a34a',
}
export default function EscenarioVentasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [ventasPorProducto, setVentasPorProducto] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [cart,      setCart]      = useState({})
  const [msg,       setMsg]       = useState('')
  const [buscar,    setBuscar]    = useState('')

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
    const { data: prods } = await supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId).order('nombre')
    setProductos(prods || [])

    // El orden de la vitrina se calcula solo de las ventas de los últimos 60
    // días — no es un campo que el encargado tenga que marcar a mano. Lo más
    // vendido queda de primero, sin pestañas ni que separar nada.
    const desde = new Date(); desde.setDate(desde.getDate() - 60)
    const { data: ventas } = await supabase.from('escenario_ventas').select('items').eq('escenario_id', escenarioId).gte('fecha', desde.toISOString().slice(0,10))
    const conteo = {}
    ;(ventas || []).forEach(v => (v.items || []).forEach(it => { conteo[it.productId] = (conteo[it.productId] || 0) + it.cantidad }))
    setVentasPorProducto(conteo)
    setLoading(false)
  }

  function getProduct(id) { return productos.find(p => p.id === id) }

  function addToCart(id) {
    const p = getProduct(id)
    setCart(c => {
      const actual = (c[id] || 0) + 1
      if (actual > p.cantidad) { setMsg(`⚠️ Solo quedan ${p.cantidad} unidades de ${p.nombre}`); setTimeout(()=>setMsg(''),2500); return { ...c, [id]: p.cantidad } }
      return { ...c, [id]: actual }
    })
  }
  function quitarUno(id) {
    setCart(c => { const n = (c[id]||0) - 1; const cp = { ...c }; if (n<=0) delete cp[id]; else cp[id]=n; return cp })
  }
  function quitarItem(id) {
    setCart(c => { const cp = { ...c }; delete cp[id]; return cp })
  }

  async function finalizarVenta() {
    const items = Object.entries(cart).filter(([,q])=>q>0).map(([id,q]) => {
      const p = getProduct(id); return { productId:id, nombre:p.nombre, cantidad:q, precio:p.precio, costo:p.costo }
    })
    if (items.length===0) return
    for (const it of items) {
      const p = getProduct(it.productId)
      if (it.cantidad > p.cantidad) { setMsg(`⚠️ No hay suficiente ${p.nombre} en inventario`); setTimeout(()=>setMsg(''),2500); return }
    }
    const total = items.reduce((a,it)=>a+it.cantidad*it.precio,0)
    const costoTotal = items.reduce((a,it)=>a+it.cantidad*it.costo,0)
    const now = new Date()
    const { error } = await supabase.from('escenario_ventas').insert({
      escenario_id: escenario.id, fecha: todayStr(), hora: now.toTimeString().slice(0,5),
      items, total, costo_total: costoTotal, ganancia: total-costoTotal,
    })
    if (error) { setMsg('Error al registrar venta: ' + error.message); return }
    await Promise.all(items.map(it => supabase.from('escenario_productos').update({ cantidad: getProduct(it.productId).cantidad - it.cantidad }).eq('id', it.productId)))
    setCart({})
    setMsg(`✅ Venta registrada: ${fmtMoney(total)}`); setTimeout(()=>setMsg(''),3000)
    fetchTodo()
  }

  const items = Object.entries(cart).filter(([,q])=>q>0)
  const total = items.reduce((a,[id,q])=> a + q*getProduct(id).precio, 0)

  // Un solo listado, sin pestañas: lo más vendido de primero, después lo
  // segundo más vendido, y así — los productos sin ventas en los últimos 60
  // días quedan al final, ordenados por nombre entre ellos.
  const visibles = useMemo(() => {
    let lista = productos
    if (buscar.trim()) {
      const q = buscar.trim().toLowerCase()
      lista = lista.filter(p => p.nombre.toLowerCase().includes(q))
    }
    return [...lista].sort((a, b) => {
      const va = ventasPorProducto[a.id] || 0
      const vb = ventasPorProducto[b.id] || 0
      if (vb !== va) return vb - va
      return a.nombre.localeCompare(b.nombre)
    })
  }, [productos, buscar, ventasPorProducto])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom: items.length>0 ? '220px' : '40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px', position:'sticky', top:0, zIndex:40 }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:38, height:38, borderRadius:10, background:S.cyanDim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ShoppingCart size={19} color={S.cyan}/>
            </div>
            <div>
              <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>Punto de venta</div>
              <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
            </div>
          </div>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'6px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', flexShrink:0 }}>← Escenario</button>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'16px 16px 0' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        <div style={{ position:'relative', marginBottom:'14px' }}>
          <Search size={15} color={S.muted} style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)' }}/>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar producto..."
            style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'11px 14px 11px 38px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }}/>
        </div>

        {productos.length===0 ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'40px 0' }}>
            <ShoppingCart size={32} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>No hay productos en el inventario todavía.</div>
            <button onClick={()=>navigate(`/escenario/${escenarioId}/inventario`)} style={{ marginTop:'12px', padding:'9px 18px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:700, fontSize:'.8rem' }}>Ir a Inventario</button>
          </div>
        ) : visibles.length === 0 ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'40px 0', fontSize:'.85rem' }}>Sin resultados.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
            {visibles.map(p => (
              <div key={p.id} onClick={()=>addToCart(p.id)}
                style={{ position:'relative', display:'flex', flexDirection:'column', background: p.cantidad<=p.stock_minimo ? 'rgba(217,48,37,.1)' : S.card, border:`1px solid ${p.cantidad<=p.stock_minimo?S.loss:S.border}`, borderRadius:'14px', overflow:'hidden', cursor:'pointer' }}>
                {cart[p.id] && (
                  <span onClick={e=>{e.stopPropagation(); quitarUno(p.id)}} style={{ position:'absolute', top:'6px', right:'6px', zIndex:2, background:S.cyan, color:'#000', borderRadius:'50%', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.72rem', fontWeight:800 }}>{cart[p.id]}</span>
                )}
                {/* Cuadro de tamaño fijo para la foto: padding-bottom:100% fuerza
                    el cuadrado sin depender de aspect-ratio (algunos navegadores
                    embebidos, como el de WhatsApp, lo ignoran y dejan que la
                    foto original — vertical, horizontal, lo que sea — estire
                    toda la tarjeta). Así todas las tarjetas quedan del mismo
                    tamaño sin importar la forma de la imagen que se suba. */}
                <div style={{ width:'100%', paddingBottom:'100%', position:'relative', background:S.card2, overflow:'hidden' }}>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.foto_url
                      ? <img src={p.foto_url} style={{ maxWidth:'85%', maxHeight:'85%', width:'auto', height:'auto', objectFit:'contain' }}/>
                      : <span style={{ fontSize:'2.4rem' }}>{p.emoji || '📦'}</span>}
                  </div>
                </div>
                <div style={{ padding:'8px 9px' }}>
                  <div style={{ fontSize:'.75rem', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
                  <div style={{ fontSize:'.76rem', color:S.gold, fontWeight:800, marginTop:'2px' }}>{fmtMoney(p.precio)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:S.card, borderTop:`1px solid ${S.border}`, padding:'14px 16px', boxShadow:'0 -4px 16px rgba(0,0,0,.3)', zIndex:50 }}>
          <div style={{ maxWidth:'640px', margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', fontWeight:800, fontSize:'.82rem', marginBottom:'8px' }}>
              <ShoppingCart size={14}/> Pedido ({items.reduce((a,[,q])=>a+q,0)})
            </div>
            <div style={{ maxHeight:'110px', overflowY:'auto', marginBottom:'10px' }}>
              {items.map(([id,q]) => { const p=getProduct(id); return (
                <div key={id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'.78rem', padding:'5px 0', borderBottom:`1px solid ${S.border}` }}>
                  <span style={{ flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{q}x {p.nombre}</span>
                  <span style={{ marginRight:'10px' }}>{fmtMoney(p.precio*q)}</span>
                  <button onClick={()=>quitarItem(id)} style={{ background:'none', border:'none', cursor:'pointer', color:S.loss, flexShrink:0, padding:'2px' }}><Trash2 size={14}/></button>
                </div>
              )})}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <span style={{ fontWeight:700, fontSize:'.9rem' }}>Total</span>
              <span style={{ fontWeight:900, fontSize:'1.3rem', color:S.gold }}>{fmtMoney(total)}</span>
            </div>
            <button onClick={finalizarVenta}
              style={{ width:'100%', padding:'14px', background:`linear-gradient(135deg, ${S.green}, ${S.greenDark})`, border:'none', borderRadius:'12px', cursor:'pointer', color:'#fff', fontWeight:900, fontSize:'.92rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              <DollarSign size={17}/> COBRAR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
