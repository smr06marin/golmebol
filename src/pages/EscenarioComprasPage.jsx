import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr, comprimirImagen, registrarActividad } from '../lib/escenarioHelpers'
import { Camera, Receipt, NotebookPen, CheckCircle2, Plus, Trash2 } from 'lucide-react'

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
// Una factura puede traer varios productos. Los agrupamos por
// fecha+hora+proveedor (todos los productos de una misma compra se guardan
// con esos tres datos iguales) para mostrarlos juntos en pantalla.
function agruparPorFactura(lista) {
  const grupos = {}
  const orden = []
  lista.forEach(c => {
    const key = `${c.fecha}_${c.hora || ''}_${c.proveedor}`
    if (!grupos[key]) {
      grupos[key] = { key, fecha: c.fecha, hora: c.hora, proveedor: c.proveedor, factura_foto_url: c.factura_foto_url, pago_estado: c.pago_estado, items: [] }
      orden.push(key)
    }
    grupos[key].items.push(c)
  })
  return orden.map(k => grupos[k])
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
  const [fecha,     setFecha]     = useState(todayStr())
  const [facturaFoto,  setFacturaFoto]  = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [pagoEstado, setPagoEstado] = useState('pagado') // pagado | parcial | pendiente
  const [montoParcial, setMontoParcial] = useState('')

  // Carrito de productos de la factura actual: cada línea trae el TOTAL
  // pagado por esa línea (no el precio unitario) — el costo unitario se
  // calcula solo dividiendo ese total entre la cantidad.
  const [itemsFactura, setItemsFactura] = useState([])
  const [guardandoCompra, setGuardandoCompra] = useState(false)
  const guardandoCompraRef = useRef(false) // bloqueo inmediato para que doble clic no registre la compra dos veces
  const [tempProductId, setTempProductId] = useState('')
  const [tempCantidad,  setTempCantidad]  = useState(1)
  const [tempTotalLinea, setTempTotalLinea] = useState('')
  const [soloLectura, setSoloLectura] = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id, solo_lectura').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    setSoloLectura(!!acceso.solo_lectura)
    setEncargado(p)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    const [{ data: prods }, { data: comp }] = await Promise.all([
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId).order('nombre'),
      supabase.from('escenario_compras').select('*').eq('escenario_id', escenarioId).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setProductos(prods || [])
    if (prods?.length && !tempProductId) setTempProductId(prods[0].id)
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

  function agregarItemCarrito() {
    const cantNum = Number(tempCantidad)
    const totalNum = Number(tempTotalLinea)
    if (!tempProductId || !(cantNum > 0) || tempTotalLinea === '' || !(totalNum >= 0)) {
      setMsg('Elige el producto, la cantidad y el total pagado por ese producto'); setTimeout(()=>setMsg(''),3000); return
    }
    const p = productos.find(x=>x.id===tempProductId)
    setItemsFactura(items => [...items, { productId: tempProductId, nombre: p?.nombre || '', cantidad: cantNum, totalLinea: totalNum }])
    setTempCantidad(1); setTempTotalLinea('')
  }

  function quitarItemCarrito(i) {
    setItemsFactura(items => items.filter((_, idx) => idx !== i))
  }

  async function registrarCompra() {
    if (guardandoCompraRef.current) return // ya se está guardando — evita doble clic
    if (itemsFactura.length === 0) { setMsg('Agrega al menos un producto a la factura'); setTimeout(()=>setMsg(''),3000); return }
    guardandoCompraRef.current = true
    setGuardandoCompra(true)
    try {
      await registrarCompraInner()
    } finally {
      guardandoCompraRef.current = false
      setGuardandoCompra(false)
    }
  }

  async function registrarCompraInner() {
    const proveedorFinal = proveedor.trim() || 'Sin especificar'
    const hora = horaAhora()
    const facturaTotalGlobal = itemsFactura.reduce((a,it)=>a+it.totalLinea, 0)
    const montoPagadoGlobal = pagoEstado === 'pagado' ? facturaTotalGlobal : pagoEstado === 'parcial' ? (Number(montoParcial) || 0) : 0

    // Actualiza el stock y costo de cada producto uno por uno (por si el
    // mismo producto aparece en dos líneas de la misma factura).
    const stockActual = {}
    productos.forEach(p => { stockActual[p.id] = p.cantidad })
    for (const it of itemsFactura) {
      const costoUnit = Math.round(it.totalLinea / it.cantidad)
      const nuevaCant = (stockActual[it.productId] ?? 0) + it.cantidad
      await supabase.from('escenario_productos').update({ cantidad: nuevaCant, ...(costoUnit>0?{costo:costoUnit}:{}) }).eq('id', it.productId)
      stockActual[it.productId] = nuevaCant
    }

    // Reparte el pago del proveedor entre las líneas (línea por línea,
    // hasta que se acaba lo pagado) para que la deuda quede correcta.
    let restantePago = montoPagadoGlobal
    const filas = itemsFactura.map(it => {
      const costoUnit = Math.round(it.totalLinea / it.cantidad)
      const pagadoLinea = Math.min(restantePago, it.totalLinea)
      restantePago -= pagadoLinea
      return {
        escenario_id: escenario.id, proveedor: proveedorFinal, product_id: it.productId, nombre: it.nombre,
        cantidad: it.cantidad, costo: costoUnit, fecha, hora,
        factura_foto_url: facturaFoto || null,
        pago_estado: pagoEstado, monto_pagado: pagadoLinea,
      }
    })

    let { error } = await supabase.from('escenario_compras').insert(filas)
    // Si aún no se corrió alguna migración de compras (foto de factura,
    // hora, deuda con proveedor), reintenta sin esos campos en vez de
    // perder todo el registro.
    const camposOmitidos = []
    let filasActuales = filas
    while (error && /Could not find the .* column/.test(error.message || '')) {
      const m = error.message.match(/Could not find the '(\w+)' column/)
      if (!m || !(m[1] in filasActuales[0])) break
      filasActuales = filasActuales.map(({ [m[1]]: _omitido, ...resto }) => resto)
      camposOmitidos.push(m[1])
      ;({ error } = await supabase.from('escenario_compras').insert(filasActuales))
    }
    if (error) { setMsg('❌ ' + error.message); setTimeout(()=>setMsg(''),5000); return }

    const debe = facturaTotalGlobal - montoPagadoGlobal
    if (debe > 0) {
      registrarActividad(escenarioId, encargado, 'crear', 'compra',
        `Registró una compra de ${itemsFactura.length} producto(s) (factura ${fmtMoney(facturaTotalGlobal)}) — quedó debiendo ${fmtMoney(debe)} a ${proveedorFinal}`)
    } else {
      registrarActividad(escenarioId, encargado, 'crear', 'compra',
        `Registró una compra de ${itemsFactura.length} producto(s) (factura ${fmtMoney(facturaTotalGlobal)}) a ${proveedorFinal}`)
    }

    setMsg(camposOmitidos.length
      ? `✅ Compra guardada, pero falta correr una migración para: ${camposOmitidos.join(', ')}`
      : debe > 0
        ? `📝 Inventario actualizado — quedaste debiendo ${fmtMoney(debe)} a ${proveedorFinal}`
        : `✅ Inventario actualizado (${itemsFactura.length} producto(s))`)
    setAvisoStock(true)
    setTimeout(()=>{ setMsg(''); setAvisoStock(false) }, 7000)
    setProveedor(''); setFacturaFoto(null); setPagoEstado('pagado'); setMontoParcial(''); setItemsFactura([])
    fetchTodo()
  }

  async function marcarGrupoPagado(grupo) {
    await Promise.all(grupo.items.map(c =>
      supabase.from('escenario_compras').update({ pago_estado:'pagado', monto_pagado: totalDe(c), pagado_at: new Date().toISOString() }).eq('id', c.id)
    ))
    const totalGrupo = grupo.items.reduce((a,c)=>a+(totalDe(c)-(c.monto_pagado||0)), 0)
    setMsg(`✅ Le pagaste a ${grupo.proveedor} ${fmtMoney(totalGrupo)}`); setTimeout(()=>setMsg(''),3000)
    registrarActividad(escenarioId, encargado, 'editar', 'compra', `Marcó como pagada la deuda con "${grupo.proveedor}" (${fmtMoney(totalGrupo)}) — factura del ${grupo.fecha}`)
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
            {agruparPorFactura(deudas).map(grupo => {
              const debeGrupo = grupo.items.reduce((a,c)=>a+(totalDe(c)-(c.monto_pagado||0)), 0)
              return (
                <div key={grupo.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 12px', background:'rgba(249,168,37,.08)', border:`1px solid ${S.gold}`, borderRadius:'10px', marginBottom:'8px' }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'.82rem', fontWeight:800 }}>{grupo.proveedor}</div>
                    <div style={{ fontSize:'.76rem', color:S.text2 }}>{grupo.items.map(c=>`${c.nombre} x${c.cantidad}`).join(', ')} · {grupo.fecha}</div>
                    <div style={{ fontSize:'.82rem', fontWeight:800, color:S.gold }}>Debes {fmtMoney(debeGrupo)}</div>
                  </div>
                  {!soloLectura && (
                    <button onClick={()=>marcarGrupoPagado(grupo)} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 11px', background:'rgba(34,197,94,.15)', border:`1px solid ${S.green}`, borderRadius:'8px', cursor:'pointer', color:S.green, fontWeight:700, fontSize:'.72rem', flexShrink:0, whiteSpace:'nowrap' }}>
                      <CheckCircle2 size={12}/> Ya pagué
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!soloLectura && (
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'12px' }}>Agregar compra</div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Proveedor</label><input value={proveedor} onChange={e=>setProveedor(e.target.value)} style={inp} placeholder="Nombre del proveedor"/></div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/></div>

          <div style={{ marginBottom:'14px' }}>
            <label style={lbl}>Foto de la factura (opcional)</label>
            <label style={{ cursor:'pointer', display:'inline-block', position:'relative' }}>
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
          </div>

          <div style={{ borderTop:`1px solid ${S.border}`, paddingTop:'14px', marginBottom:'14px' }}>
            <div style={{ fontSize:'.78rem', fontWeight:700, color:S.text2, marginBottom:'10px' }}>Productos de esta factura</div>
            <div style={{ marginBottom:'10px' }}>
              <label style={lbl}>Producto</label>
              <select value={tempProductId} onChange={e=>setTempProductId(e.target.value)} style={inp}>
                {productos.map(p => <option key={p.id} value={p.id}>{p.emoji || '📦'} {p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
              <div><label style={lbl}>Cantidad</label><input type="number" value={tempCantidad} onChange={e=>setTempCantidad(e.target.value)} style={inp}/></div>
              <div><label style={lbl}>Total pagado por este producto</label><input type="number" value={tempTotalLinea} onChange={e=>setTempTotalLinea(e.target.value)} style={inp} placeholder="$"/></div>
            </div>
            {tempTotalLinea !== '' && Number(tempCantidad) > 0 && (
              <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'10px' }}>Costo unitario: {fmtMoney(Math.round(Number(tempTotalLinea)/Number(tempCantidad)))} c/u</div>
            )}
            <button onClick={agregarItemCarrito} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', width:'100%', padding:'9px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'8px', cursor:'pointer', color:S.cyan, fontWeight:700, fontSize:'.78rem' }}>
              <Plus size={14}/> Agregar producto a la factura
            </button>

            {itemsFactura.length > 0 && (
              <div style={{ marginTop:'12px' }}>
                {itemsFactura.map((it, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', padding:'8px 10px', background:S.card2, borderRadius:'8px', marginBottom:'6px' }}>
                    <div style={{ minWidth:0, fontSize:'.78rem' }}>
                      <div style={{ fontWeight:700 }}>{it.nombre} x{it.cantidad}</div>
                      <div style={{ color:S.muted, fontSize:'.7rem' }}>{fmtMoney(Math.round(it.totalLinea/it.cantidad))} c/u</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                      <div style={{ fontWeight:700, fontSize:'.8rem' }}>{fmtMoney(it.totalLinea)}</div>
                      <button onClick={()=>quitarItemCarrito(i)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, display:'flex' }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem', fontWeight:800, marginTop:'8px' }}>
                  <span>Total de la factura</span>
                  <span style={{ color:S.cyan }}>{fmtMoney(itemsFactura.reduce((a,it)=>a+it.totalLinea,0))}</span>
                </div>
              </div>
            )}
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

          <button onClick={registrarCompra} disabled={guardandoCompra} style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor: guardandoCompra ? 'default' : 'pointer', opacity: guardandoCompra ? .6 : 1, color:'#000', fontWeight:800, fontSize:'.85rem' }}>{guardandoCompra ? 'Guardando...' : 'Registrar compra'}</button>
        </div>
        )}

        <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Historial de compras</div>
        {compras.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin compras registradas.</div> : agruparPorFactura(compras).map(grupo => {
          const totalGrupo = grupo.items.reduce((a,c)=>a+totalDe(c), 0)
          const debeGrupo = grupo.items.reduce((a,c)=>a+(totalDe(c)-(c.monto_pagado||0)), 0)
          return (
            <div key={grupo.key} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px 0', borderBottom:`1px solid ${S.border}`, fontSize:'.8rem' }}>
              {grupo.factura_foto_url
                ? <a href={grupo.factura_foto_url} target="_blank" rel="noreferrer" style={{ flexShrink:0 }}>
                    <img src={grupo.factura_foto_url} style={{ width:'34px', height:'34px', borderRadius:'8px', objectFit:'cover', border:`1px solid ${S.border}` }}/>
                  </a>
                : null}
              <div style={{ flex:1, minWidth:0 }}>
                <div>{grupo.fecha}{grupo.hora ? ` · ${grupo.hora}` : ''} · {grupo.proveedor}</div>
                <div style={{ color:S.text2, fontSize:'.76rem' }}>{grupo.items.map(c=>`${c.nombre} x${c.cantidad}`).join(', ')}</div>
                {debeGrupo > 0 && (
                  <div style={{ fontSize:'.68rem', color:S.gold, fontWeight:700 }}>Debes {fmtMoney(debeGrupo)}</div>
                )}
              </div>
              <div style={{ textAlign:'right', fontWeight:700, flexShrink:0 }}>{fmtMoney(totalGrupo)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
