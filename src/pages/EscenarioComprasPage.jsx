import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr, comprimirImagen, registrarActividad } from '../lib/escenarioHelpers'
import { Camera, Receipt, NotebookPen, CheckCircle2 } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  green: '#22c55e',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }

function horaAhora() {
  return new Date().toTimeString().slice(0, 5)
}
// Valor total de una compra ya guardada: si se registró el total de la
// factura se usa ese, si no se estima como costo unitario x cantidad.
function totalDe(c) {
  return c.factura_total != null ? Number(c.factura_total) : Number(c.costo || 0) * Number(c.cantidad || 0)
}

export default function EscenarioComprasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [encargado, setEncargado] = useState(null)
  const [productos, setProductos] = useState([])
  const [compras,   setCompras]   = useState([])
  const [deudas,    setDeudas]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState('')
  const [avisoStock, setAvisoStock] = useState(false)
  const [mostrarDeudas, setMostrarDeudas] = useState(false)

  const [proveedor, setProveedor] = useState('')
  const [productId, setProductId] = useState('')
  const [cantidad,  setCantidad]  = useState(1)
  const [costo,     setCosto]     = useState(0)
  const [fecha,     setFecha]     = useState(todayStr())
  const [facturaTotal, setFacturaTotal] = useState('')
  const [facturaFoto,  setFacturaFoto]  = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [pagoEstado, setPagoEstado] = useState('pagado') // pagado | parcial | pendiente
  const [montoParcial, setMontoParcial] = useState('')

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
    const [{ data: prods }, { data: comp }] = await Promise.all([
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId).order('nombre'),
      supabase.from('escenario_compras').select('*').eq('escenario_id', escenarioId).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setProductos(prods || [])
    if (prods?.length && !productId) setProductId(prods[0].id)
    setCompras(comp || [])
    // Deudas con proveedores (compras no pagadas del todo) — no se limitan
    // al día de hoy, por si algo quedó debiendo de antes.
    setDeudas((comp || []).filter(c => c.pago_estado && c.pago_estado !== 'pagado'))
    setLoading(false)
  }

  async function handleFacturaFoto(file) {
    if (!file) return
    setSubiendoFoto(true)
    try {
      const procesada = await comprimirImagen(file, { maxDim: 900 })
      const path = `facturas/${escenarioId}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('teams').upload(path, procesada, { upsert: true, contentType: 'image/jpeg' })
      if (!error) {
        const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
        setFacturaFoto(urlData.publicUrl + '?t=' + Date.now())
      }
    } catch (e) { /* si falla, el encargado puede reintentar tocando la foto de nuevo */ }
    setSubiendoFoto(false)
  }

  async function registrarCompra() {
    if (!productId || cantidad<=0) { setMsg('Ingresa una cantidad válida'); setTimeout(()=>setMsg(''),3000); return }
    const p = productos.find(x=>x.id===productId)
    const costoNum = Number(costo) || 0
    const totalCompra = facturaTotal !== '' ? Number(facturaTotal) : costoNum * Number(cantidad)
    const montoPagado = pagoEstado === 'pagado' ? totalCompra : pagoEstado === 'parcial' ? (Number(montoParcial) || 0) : 0

    await supabase.from('escenario_productos').update({ cantidad: p.cantidad + Number(cantidad), ...(costoNum>0?{costo:costoNum}:{}) }).eq('id', productId)

    const payload = {
      escenario_id: escenario.id, proveedor: proveedor.trim() || 'Sin especificar', product_id: productId, nombre: p.nombre,
      cantidad: Number(cantidad), costo: costoNum, fecha, hora: horaAhora(),
      factura_total: facturaTotal !== '' ? Number(facturaTotal) : null,
      factura_foto_url: facturaFoto || null,
      pago_estado: pagoEstado, monto_pagado: montoPagado,
    }
    let { error } = await supabase.from('escenario_compras').insert(payload)
    // Si aún no se corrió alguna migración de compras (foto/total de
    // factura, hora, deuda con proveedor), reintenta sin esos campos en
    // vez de perder todo el registro.
    const camposOmitidos = []
    let restante = payload
    while (error && /Could not find the .* column/.test(error.message || '')) {
      const m = error.message.match(/Could not find the '(\w+)' column/)
      if (!m || !(m[1] in restante)) break
      const { [m[1]]: _omitido, ...sinCampo } = restante
      restante = sinCampo
      camposOmitidos.push(m[1])
      ;({ error } = await supabase.from('escenario_compras').insert(restante))
    }
    if (error) { setMsg('❌ ' + error.message); setTimeout(()=>setMsg(''),5000); return }

    if (pagoEstado !== 'pagado') {
      registrarActividad(escenarioId, encargado, 'crear', 'compra',
        `Registró una compra de ${p.nombre} x${cantidad} — quedó debiendo ${fmtMoney(totalCompra - montoPagado)} a ${payload.proveedor}`)
    } else {
      registrarActividad(escenarioId, encargado, 'crear', 'compra',
        `Registró una compra de ${p.nombre} x${cantidad}${payload.factura_total ? ` (factura ${fmtMoney(payload.factura_total)})` : ''}`)
    }

    setMsg(camposOmitidos.length
      ? `✅ Compra guardada, pero falta correr una migración para: ${camposOmitidos.join(', ')}`
      : pagoEstado !== 'pagado'
        ? `📝 Inventario actualizado (+${cantidad}) — quedaste debiendo ${fmtMoney(totalCompra - montoPagado)} a ${payload.proveedor}`
        : `✅ Inventario de ${p.nombre} actualizado (+${cantidad})`)
    setAvisoStock(true)
    setTimeout(()=>{ setMsg(''); setAvisoStock(false) }, 7000)
    setProveedor(''); setCantidad(1); setCosto(0); setFacturaTotal(''); setFacturaFoto(null); setPagoEstado('pagado'); setMontoParcial('')
    fetchTodo()
  }

  async function marcarPagado(c) {
    await supabase.from('escenario_compras').update({ pago_estado:'pagado', monto_pagado: totalDe(c), pagado_at: new Date().toISOString() }).eq('id', c.id)
    setMsg(`✅ Le pagaste a ${c.proveedor} ${fmtMoney(totalDe(c))}`); setTimeout(()=>setMsg(''),3000)
    registrarActividad(escenarioId, encargado, 'editar', 'compra', `Marcó como pagada la deuda con "${c.proveedor}" (${fmtMoney(totalDe(c) - (c.monto_pagado||0))})`)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>🚚 Compras</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && (
          <div style={{ background:S.cyanDim, borderRadius:8, padding:'10px 12px', marginBottom:14, textAlign:'center' }}>
            <div style={{ color:S.cyan, fontSize:'.78rem' }}>{msg}</div>
            {avisoStock && (
              <button onClick={()=>navigate(`/escenario/${escenarioId}/inventario`)}
                style={{ marginTop:'8px', padding:'7px 14px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.75rem' }}>
                📦 Ver en Inventario →
              </button>
            )}
          </div>
        )}

        {deudas.length > 0 && (
          <button onClick={()=>setMostrarDeudas(v=>!v)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', width:'100%', padding:'10px', marginBottom:'14px', background: mostrarDeudas ? 'rgba(249,168,37,.15)' : S.card, border:`1px solid ${mostrarDeudas ? S.gold : S.border}`, borderRadius:'10px', cursor:'pointer', color: mostrarDeudas ? S.gold : S.text2, fontWeight:700, fontSize:'.78rem' }}>
            <NotebookPen size={14}/> Debes a proveedores ({deudas.length})
          </button>
        )}

        {mostrarDeudas && deudas.length > 0 && (
          <div style={{ marginBottom:'16px' }}>
            {deudas.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 12px', background:'rgba(249,168,37,.08)', border:`1px solid ${S.gold}`, borderRadius:'10px', marginBottom:'8px' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'.82rem', fontWeight:800 }}>{c.proveedor}</div>
                  <div style={{ fontSize:'.76rem', color:S.text2 }}>{c.nombre} x{c.cantidad} · {c.fecha}</div>
                  <div style={{ fontSize:'.82rem', fontWeight:800, color:S.gold }}>Debes {fmtMoney(totalDe(c) - (c.monto_pagado||0))}</div>
                </div>
                <button onClick={()=>marcarPagado(c)} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 11px', background:'rgba(34,197,94,.15)', border:`1px solid ${S.green}`, borderRadius:'8px', cursor:'pointer', color:S.green, fontWeight:700, fontSize:'.72rem', flexShrink:0, whiteSpace:'nowrap' }}>
                  <CheckCircle2 size={12}/> Ya pagué
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'12px' }}>Agregar compra</div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Proveedor</label><input value={proveedor} onChange={e=>setProveedor(e.target.value)} style={inp} placeholder="Nombre del proveedor"/></div>
          <div style={{ marginBottom:'10px' }}>
            <label style={lbl}>Producto</label>
            <select value={productId} onChange={e=>setProductId(e.target.value)} style={inp}>
              {productos.map(p => <option key={p.id} value={p.id}>{p.emoji || '📦'} {p.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div><label style={lbl}>Cantidad</label><input type="number" value={cantidad} onChange={e=>setCantidad(e.target.value)} style={inp}/></div>
            <div><label style={lbl}>Costo unitario</label><input type="number" value={costo} onChange={e=>setCosto(e.target.value)} style={inp}/></div>
          </div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/></div>

          <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'14px' }}>
            <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleFacturaFoto(e.target.files[0])}/>
              <div style={{
                width:'56px', height:'56px', borderRadius:'12px', overflow:'hidden', border:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'center',
                background: facturaFoto ? '#000' : S.card2,
              }}>
                {subiendoFoto ? <div style={{ fontSize:'.6rem', color:S.muted }}>...</div>
                  : facturaFoto ? <img src={facturaFoto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <Receipt size={20} color={S.muted}/>}
              </div>
              <div style={{ position:'absolute', bottom:'-3px', right:'-3px', width:'20px', height:'20px', background:S.cyan, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Camera size={11} color="#000"/>
              </div>
            </label>
            <div style={{ flex:1 }}>
              <label style={lbl}>Total de la factura</label>
              <input type="number" value={facturaTotal} onChange={e=>setFacturaTotal(e.target.value)} style={inp} placeholder="Opcional"/>
            </div>
          </div>

          <div style={{ marginBottom:'14px' }}>
            <label style={lbl}>Pago al proveedor</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
              {[['pagado','Pagué todo'],['parcial','Pagué parte'],['pendiente','Debo todo']].map(([v,l]) => (
                <button key={v} onClick={()=>setPagoEstado(v)}
                  style={{ padding:'9px 4px', borderRadius:'8px', border:`1px solid ${pagoEstado===v ? S.gold : S.border}`, cursor:'pointer', fontWeight:700, fontSize:'.7rem', background: pagoEstado===v ? 'rgba(249,168,37,.15)' : S.card2, color: pagoEstado===v ? S.gold : S.text2 }}>
                  {l}
                </button>
              ))}
            </div>
            {pagoEstado === 'parcial' && (
              <input type="number" value={montoParcial} onChange={e=>setMontoParcial(e.target.value)} style={{ ...inp, marginTop:'8px' }} placeholder="¿Cuánto pagaste?"/>
            )}
          </div>

          <button onClick={registrarCompra} style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>Registrar compra</button>
        </div>

        <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Historial de compras</div>
        {compras.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin compras registradas.</div> : compras.map(c => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:`1px solid ${S.border}`, fontSize:'.8rem' }}>
            {c.factura_foto_url
              ? <a href={c.factura_foto_url} target="_blank" rel="noreferrer" style={{ flexShrink:0 }}>
                  <img src={c.factura_foto_url} style={{ width:'34px', height:'34px', borderRadius:'8px', objectFit:'cover', border:`1px solid ${S.border}` }}/>
                </a>
              : null}
            <div style={{ flex:1, minWidth:0 }}>
              <div>{c.fecha}{c.hora ? ` · ${c.hora}` : ''} · {c.nombre} x{c.cantidad} · {c.proveedor}</div>
              {c.pago_estado && c.pago_estado !== 'pagado' && (
                <div style={{ fontSize:'.68rem', color:S.gold, fontWeight:700 }}>Debes {fmtMoney(totalDe(c) - (c.monto_pagado||0))}</div>
              )}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:700 }}>{fmtMoney(c.costo*c.cantidad)}</div>
              {c.factura_total ? <div style={{ fontSize:'.68rem', color:S.muted }}>Factura {fmtMoney(c.factura_total)}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
