import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr } from '../lib/escenarioHelpers'
import { ShoppingCart } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
}

export default function EscenarioVentasPage() {
  const navigate = useNavigate()
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [cart,      setCart]      = useState({})
  const [msg,       setMsg]       = useState('')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario || !p.escenario_id) { navigate('/escenario'); return }
    setEncargado(p)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', p.escenario_id).single()
    setEscenario(esc || null)
    const { data: prods } = await supabase.from('escenario_productos').select('*').eq('escenario_id', p.escenario_id).order('nombre')
    setProductos(prods || [])
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

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const items = Object.entries(cart).filter(([,q])=>q>0)
  const total = items.reduce((a,[id,q])=> a + q*getProduct(id).precio, 0)

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'160px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>🛒 Punto de venta</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        {productos.length===0 ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'40px 0' }}>
            <ShoppingCart size={32} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>No hay productos en el inventario todavía.</div>
            <button onClick={()=>navigate('/escenario/inventario')} style={{ marginTop:'12px', padding:'9px 18px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:700, fontSize:'.8rem' }}>Ir a Inventario</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
            {productos.map(p => (
              <button key={p.id} onClick={()=>addToCart(p.id)}
                style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', padding:'14px 8px', background: p.cantidad<=p.stock_minimo ? 'rgba(217,48,37,.12)' : S.card, border:`1px solid ${p.cantidad<=p.stock_minimo?S.loss:S.border}`, borderRadius:'12px', cursor:'pointer', color:S.text }}>
                {cart[p.id] && (
                  <span onClick={e=>{e.stopPropagation(); quitarUno(p.id)}} style={{ position:'absolute', top:'-6px', right:'-6px', background:S.cyan, color:'#000', borderRadius:'50%', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.72rem', fontWeight:800 }}>{cart[p.id]}</span>
                )}
                <span style={{ fontSize:'1.4rem' }}>{p.emoji}</span>
                <span style={{ fontSize:'.72rem', fontWeight:700, textAlign:'center' }}>{p.nombre}</span>
                <span style={{ fontSize:'.7rem', color:S.gold, fontWeight:700 }}>{fmtMoney(p.precio)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:S.card, borderTop:`1px solid ${S.border}`, padding:'14px 16px', boxShadow:'0 -4px 16px rgba(0,0,0,.3)' }}>
          <div style={{ maxWidth:'640px', margin:'0 auto' }}>
            <div style={{ maxHeight:'90px', overflowY:'auto', marginBottom:'10px' }}>
              {items.map(([id,q]) => { const p=getProduct(id); return (
                <div key={id} style={{ display:'flex', justifyContent:'space-between', fontSize:'.78rem', padding:'3px 0' }}>
                  <span>{p.emoji} {p.nombre} x{q}</span><span>{fmtMoney(p.precio*q)}</span>
                </div>
              )})}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'1rem', marginBottom:'10px' }}>
              <span>Total</span><span style={{ color:S.cyan }}>{fmtMoney(total)}</span>
            </div>
            <button onClick={finalizarVenta} style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem' }}>Finalizar venta</button>
          </div>
        </div>
      )}
    </div>
  )
}
