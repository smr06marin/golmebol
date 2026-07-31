import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr } from '../lib/escenarioHelpers'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }

export default function EscenarioComprasPage() {
  const navigate = useNavigate()
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [compras,   setCompras]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState('')

  const [proveedor, setProveedor] = useState('')
  const [productId, setProductId] = useState('')
  const [cantidad,  setCantidad]  = useState(1)
  const [costo,     setCosto]     = useState(0)
  const [fecha,     setFecha]     = useState(todayStr())

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario || !p.escenario_id) { navigate('/escenario'); return }
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', p.escenario_id).single()
    setEscenario(esc || null)
    const [{ data: prods }, { data: comp }] = await Promise.all([
      supabase.from('escenario_productos').select('*').eq('escenario_id', p.escenario_id).order('nombre'),
      supabase.from('escenario_compras').select('*').eq('escenario_id', p.escenario_id).order('fecha', { ascending: false }),
    ])
    setProductos(prods || [])
    if (prods?.length && !productId) setProductId(prods[0].id)
    setCompras(comp || [])
    setLoading(false)
  }

  async function registrarCompra() {
    if (!productId || cantidad<=0) { setMsg('Ingresa una cantidad válida'); setTimeout(()=>setMsg(''),3000); return }
    const p = productos.find(x=>x.id===productId)
    const costoNum = Number(costo) || 0
    await supabase.from('escenario_productos').update({ cantidad: p.cantidad + Number(cantidad), ...(costoNum>0?{costo:costoNum}:{}) }).eq('id', productId)
    await supabase.from('escenario_compras').insert({
      escenario_id: escenario.id, proveedor: proveedor.trim() || 'Sin especificar', product_id: productId, nombre: p.nombre,
      cantidad: Number(cantidad), costo: costoNum, fecha,
    })
    setMsg(`✅ Inventario de ${p.nombre} actualizado (+${cantidad})`); setTimeout(()=>setMsg(''),3000)
    setProveedor(''); setCantidad(1); setCosto(0)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>🚚 Compras</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'12px' }}>Agregar compra</div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Proveedor</label><input value={proveedor} onChange={e=>setProveedor(e.target.value)} style={inp} placeholder="Nombre del proveedor"/></div>
          <div style={{ marginBottom:'10px' }}>
            <label style={lbl}>Producto</label>
            <select value={productId} onChange={e=>setProductId(e.target.value)} style={inp}>
              {productos.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div><label style={lbl}>Cantidad</label><input type="number" value={cantidad} onChange={e=>setCantidad(e.target.value)} style={inp}/></div>
            <div><label style={lbl}>Costo unitario</label><input type="number" value={costo} onChange={e=>setCosto(e.target.value)} style={inp}/></div>
          </div>
          <div style={{ marginBottom:'14px' }}><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/></div>
          <button onClick={registrarCompra} style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>Registrar compra</button>
        </div>

        <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Historial de compras</div>
        {compras.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin compras registradas.</div> : compras.map(c => (
          <div key={c.id} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:`1px solid ${S.border}`, fontSize:'.8rem' }}>
            <span>{c.fecha} · {c.nombre} x{c.cantidad} · {c.proveedor}</span>
            <span style={{ fontWeight:700 }}>{fmtMoney(c.costo*c.cantidad)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
