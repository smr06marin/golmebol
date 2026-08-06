import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr } from '../lib/escenarioHelpers'
import { ShoppingCart, Search } from 'lucide-react'
import TutorialPedido from '../components/TutorialPedido'

// Página pública (sin login) para que un cliente arme su propio pedido desde
// la cancha y lo mande por WhatsApp — link tipo /pedir/:escenarioId, se
// comparte igual que el link de reservas. Mismo look que la tienda interna
// (EscenarioVentasPage): tarjetas de tamaño fijo, ordenadas por lo más
// vendido primero.
const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'11px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }

function claveTutorialVisto(escenarioId) {
  return `golmebol_pedido_tutorial_visto_${escenarioId}`
}

export default function PedirEscenarioPage() {
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [ventasPorProducto, setVentasPorProducto] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [cart,      setCart]      = useState({})
  const [nombre,    setNombre]    = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [metodoPago,setMetodoPago]= useState('') // '' | 'efectivo' | 'transferencia'
  const [pagaCon,   setPagaCon]   = useState('')
  const [msg,       setMsg]       = useState('')
  const [buscar,    setBuscar]    = useState('')
  const [enviando,  setEnviando]  = useState(false)
  const [mostrarTutorial, setMostrarTutorial] = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  useEffect(() => {
    if (!escenarioId) return
    let visto = false
    try { visto = !!localStorage.getItem(claveTutorialVisto(escenarioId)) } catch {}
    if (!visto) setMostrarTutorial(true)
  }, [escenarioId])

  function cerrarTutorial() {
    setMostrarTutorial(false)
    try { localStorage.setItem(claveTutorialVisto(escenarioId), '1') } catch {}
  }

  async function fetchTodo() {
    setLoading(true)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).maybeSingle()
    if (!esc) { setNotFound(true); setLoading(false); return }
    setEscenario(esc)
    const { data: prods } = await supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId).order('nombre')
    setProductos(prods || [])

    // Mismo orden que la tienda interna (más vendido primero) pero leído de
    // una vista pública que solo trae la cuenta de unidades, sin plata.
    const { data: conteo } = await supabase.from('escenario_ventas_conteo_publico').select('producto_id, cantidad').eq('escenario_id', escenarioId)
    const mapa = {}
    ;(conteo || []).forEach(c => { mapa[c.producto_id] = c.cantidad })
    setVentasPorProducto(mapa)
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

  const items = Object.entries(cart).filter(([,q])=>q>0)
  const total = items.reduce((a,[id,q])=> a + q*getProduct(id).precio, 0)
  const pagaConNum = Number(pagaCon) || 0
  const devuelta = metodoPago === 'efectivo' && pagaConNum > 0 ? pagaConNum - total : null

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

  async function enviarPedido() {
    if (items.length === 0 || !metodoPago) return
    setEnviando(true)
    const pedidoItems = items.map(([id,q]) => { const p=getProduct(id); return { productId:id, nombre:p.nombre, cantidad:q, precio:p.precio } })
    const now = new Date()
    const { error } = await supabase.from('escenario_pedidos').insert({
      escenario_id: escenarioId, items: pedidoItems, nombre: nombre.trim()||'Cliente', telefono: telefono.trim(),
      total, fecha: todayStr(), hora: now.toTimeString().slice(0,5), estado:'pendiente',
      metodo_pago: metodoPago, paga_con: metodoPago==='efectivo' ? (pagaConNum || null) : null,
      devuelta: devuelta !== null && devuelta >= 0 ? devuelta : null,
    })
    setEnviando(false)
    if (error) { setMsg('Error al enviar el pedido: ' + error.message); return }
    if (escenario?.whatsapp) {
      const lineaPago = metodoPago === 'efectivo'
        ? `Pago: Efectivo${pagaConNum > 0 ? ` (pago con ${fmtMoney(pagaConNum)}${devuelta>=0 ? `, devuelta ${fmtMoney(devuelta)}` : ''})` : ''}`
        : 'Pago: Transferencia'
      const wa = `Hola, quiero hacer un pedido:\n` + pedidoItems.map(it=>`- ${it.cantidad}x ${it.nombre} (${fmtMoney(it.precio*it.cantidad)})`).join('\n') +
        `\nTotal: ${fmtMoney(total)}\n${lineaPago}\nNombre: ${nombre.trim()||'Cliente'}\nEstoy en la cancha, ¿me lo pueden traer?`
      window.open(`https://wa.me/${escenario.whatsapp}?text=${encodeURIComponent(wa)}`, '_blank')
    }
    setCart({})
    setMetodoPago(''); setPagaCon('')
    setMsg('📱 ¡Pedido enviado! Ya lo están viendo en la tienda.')
    setTimeout(()=>setMsg(''), 4000)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem', padding:'24px', textAlign:'center' }}>
      Este link de pedidos no existe o ya no está disponible.
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom: items.length>0 ? '400px' : '40px' }}>
      {mostrarTutorial && <TutorialPedido onCerrar={cerrarTutorial}/>}

      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px', position:'sticky', top:0, zIndex:40 }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:38, height:38, borderRadius:10, background:S.cyanDim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ShoppingCart size={19} color={S.cyan}/>
          </div>
          <div>
            <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>Pedido a distancia</div>
            <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'16px 16px 0' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}
        <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'14px' }}>Toca los productos que quieres, arma tu pedido y lo mandamos por WhatsApp — te lo llevan a la cancha.</div>

        <div style={{ position:'relative', marginBottom:'14px' }}>
          <Search size={15} color={S.muted} style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)' }}/>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar producto..."
            style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'11px 14px 11px 38px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }}/>
        </div>

        {productos.length===0 ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'40px 0' }}>
            <ShoppingCart size={32} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>Todavía no hay productos disponibles para pedir.</div>
          </div>
        ) : visibles.length === 0 ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'40px 0', fontSize:'.85rem' }}>Sin resultados.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
            {visibles.map(p => (
              <div key={p.id} onClick={()=>addToCart(p.id)}
                style={{ position:'relative', display:'flex', flexDirection:'column', background: p.cantidad<=0 ? 'rgba(217,48,37,.1)' : S.card, border:`1px solid ${p.cantidad<=0?S.loss:S.border}`, borderRadius:'14px', overflow:'hidden', cursor: p.cantidad<=0 ? 'not-allowed' : 'pointer', opacity: p.cantidad<=0 ? .55 : 1 }}>
                {cart[p.id] && (
                  <span onClick={e=>{e.stopPropagation(); quitarUno(p.id)}} style={{ position:'absolute', top:'6px', right:'6px', zIndex:2, background:S.cyan, color:'#000', borderRadius:'50%', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.72rem', fontWeight:800 }}>{cart[p.id]}</span>
                )}
                <div style={{ width:'100%', paddingBottom:'100%', position:'relative', background:S.card2, overflow:'hidden' }}>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.foto_url
                      ? <img src={p.foto_url} style={{ maxWidth:'85%', maxHeight:'85%', width:'auto', height:'auto', objectFit:'contain' }}/>
                      : <span style={{ fontSize:'2.4rem' }}>{p.emoji || '📦'}</span>}
                  </div>
                </div>
                <div style={{ padding:'8px 9px' }}>
                  <div style={{ fontSize:'.75rem', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
                  <div style={{ fontSize:'.76rem', color:S.gold, fontWeight:800, marginTop:'2px' }}>
                    {p.cantidad<=0 ? 'Agotado' : fmtMoney(p.precio)}
                  </div>
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
              <ShoppingCart size={14}/> Tu pedido ({items.reduce((a,[,q])=>a+q,0)})
            </div>
            <div style={{ maxHeight:'80px', overflowY:'auto', marginBottom:'10px' }}>
              {items.map(([id,q]) => { const p=getProduct(id); return (
                <div key={id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'.78rem', padding:'5px 0', borderBottom:`1px solid ${S.border}` }}>
                  <span style={{ flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{q}x {p.nombre}</span>
                  <span>{fmtMoney(p.precio*q)}</span>
                </div>
              )})}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
              <input value={nombre} onChange={e=>setNombre(e.target.value)} style={inp} placeholder="Tu nombre"/>
              <input value={telefono} onChange={e=>setTelefono(e.target.value)} style={inp} placeholder="Teléfono (opcional, recomendado)"/>
            </div>

            <div style={{ fontSize:'.72rem', fontWeight:700, color:S.muted, marginBottom:'6px' }}>¿Cómo vas a pagar?</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom: metodoPago==='efectivo' ? '8px' : '10px' }}>
              <button type="button" onClick={()=>setMetodoPago('efectivo')}
                style={{ padding:'10px', borderRadius:'10px', cursor:'pointer', fontWeight:800, fontSize:'.8rem',
                  background: metodoPago==='efectivo' ? S.cyan : 'transparent', color: metodoPago==='efectivo' ? '#000' : S.text2,
                  border:`1.5px solid ${metodoPago==='efectivo' ? S.cyan : S.border}` }}>
                💵 Efectivo
              </button>
              <button type="button" onClick={()=>setMetodoPago('transferencia')}
                style={{ padding:'10px', borderRadius:'10px', cursor:'pointer', fontWeight:800, fontSize:'.8rem',
                  background: metodoPago==='transferencia' ? S.cyan : 'transparent', color: metodoPago==='transferencia' ? '#000' : S.text2,
                  border:`1.5px solid ${metodoPago==='transferencia' ? S.cyan : S.border}` }}>
                🏦 Transferencia
              </button>
            </div>

            {metodoPago === 'efectivo' && (
              <div style={{ marginBottom:'10px' }}>
                <input value={pagaCon} onChange={e=>setPagaCon(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" style={inp} placeholder="¿Con cuánto vas a pagar? (opcional)"/>
                {devuelta !== null && (
                  <div style={{ fontSize:'.78rem', fontWeight:700, marginTop:'6px', color: devuelta >= 0 ? S.cyan : S.loss }}>
                    {devuelta >= 0 ? `Te devuelven: ${fmtMoney(devuelta)}` : `Con eso no alcanza — faltan ${fmtMoney(-devuelta)}`}
                  </div>
                )}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <span style={{ fontWeight:700, fontSize:'.9rem' }}>Total</span>
              <span style={{ fontWeight:900, fontSize:'1.3rem', color:S.gold }}>{fmtMoney(total)}</span>
            </div>
            <button onClick={enviarPedido} disabled={enviando || !metodoPago}
              style={{ width:'100%', padding:'14px', background:S.cyan, border:'none', borderRadius:'12px', cursor: (enviando || !metodoPago) ? 'default' : 'pointer', color:'#000', fontWeight:900, fontSize:'.92rem', opacity: (enviando || !metodoPago) ? .5 : 1 }}>
              {enviando ? 'Enviando...' : !metodoPago ? 'Elige cómo vas a pagar' : 'Enviar pedido por WhatsApp'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
