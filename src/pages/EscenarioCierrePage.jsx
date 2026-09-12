import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, fmtDate, todayStr, fechaLocalStr, getHours, nombreCancha, registrarActividad } from '../lib/escenarioHelpers'
import { fmtHora12 } from '../lib/horaHelpers'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const seccion = { fontWeight:800, fontSize:'.85rem', margin:'18px 0 8px' }
const rowItem = { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:`1px solid ${S.border}`, fontSize:'.78rem' }

// Valor total de una compra: el de la factura si se guardó, si no costo x cantidad.
function totalCompra(c) {
  return c.factura_total != null ? Number(c.factura_total) : Number(c.costo || 0) * Number(c.cantidad || 0)
}
function compraDebe(c) { return !!(c.pago_estado && c.pago_estado !== 'pagado') }
// Cuánto se le pagó realmente al proveedor por esta compra. Si quedó
// marcada como "pagado" siempre es el total (aunque monto_pagado haya
// quedado en 0 por una migración vieja que backfillea con default 0 en
// compras registradas antes de correrla) — si no, se usa lo que sí quedó
// guardado (0 para pendiente, lo abonado para parcial).
function pagadoDe(c) {
  if (c.pago_estado === 'pagado') return totalCompra(c)
  return Number(c.monto_pagado || 0)
}

export default function EscenarioCierrePage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [encargado, setEncargado] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [modo,      setModo]      = useState('dia') // 'dia' | 'rango'
  const [fecha,     setFecha]     = useState(todayStr())
  const [fechaDesde, setFechaDesde] = useState(todayStr())
  const [fechaHasta, setFechaHasta] = useState(todayStr())
  const [ventas,    setVentas]    = useState([])
  const [reservas,  setReservas]  = useState([])
  const [canchas,   setCanchas]   = useState([])
  const [compras,   setCompras]   = useState([])
  const [gastos,    setGastos]    = useState([])
  const [productos, setProductos] = useState([])
  const [deudasClientes,   setDeudasClientes]   = useState([])
  const [deudasProveedores, setDeudasProveedores] = useState([])
  const [baseActual, setBaseActual] = useState(null)
  const [conteos,      setConteos]      = useState({}) // product_id -> fila de escenario_conteos_stock
  const [conteoAyer,   setConteoAyer]   = useState({}) // product_id -> fila del conteo físico del día ANTERIOR (modo día) — es el "II" (inventario inicial) del reporte tipo planilla de papel
  const [conteoApertura, setConteoApertura] = useState({}) // product_id -> fila del conteo físico en la fecha "desde" (modo rango)
  const [conteoCierre,   setConteoCierre]   = useState({}) // product_id -> fila del conteo físico en la fecha "hasta" (modo rango)
  const [inputFisico,  setInputFisico]  = useState({}) // product_id -> texto que se está escribiendo
  const [guardandoConteo, setGuardandoConteo] = useState(false)
  const [msgConteo, setMsgConteo] = useState('')
  const [soloLectura, setSoloLectura] = useState(false)

  useEffect(() => { fetchEscenario() }, [escenarioId])
  useEffect(() => { if (escenario) fetchDia() }, [modo, fecha, fechaDesde, fechaHasta, escenario])

  async function fetchEscenario() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id, solo_lectura').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    setSoloLectura(!!acceso.solo_lectura)
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    setEncargado(p)
    const { data: cs } = await supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId)
    setCanchas(cs || [])
    const { data: bs } = await supabase.from('escenario_base_caja').select('*').eq('escenario_id', escenarioId)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1)
    setBaseActual(bs?.[0] || null)
    setLoading(false)
  }

  async function fetchDia() {
    // En modo "rango" se filtra entre fechaDesde y fechaHasta; en modo "día"
    // se usan los mismos límites pero iguales a `fecha`, así el resto de la
    // función (y todos los cálculos de más abajo) no necesitan dos caminos
    // distintos. Si alguien invierte las fechas del rango, se corrige solo.
    const enRango = modo === 'rango'
    const desde = enRango ? (fechaDesde <= fechaHasta ? fechaDesde : fechaHasta) : fecha
    const hasta = enRango ? (fechaDesde <= fechaHasta ? fechaHasta : fechaDesde) : fecha
    const [{ data: v }, { data: r }, { data: c }, { data: g }, { data: prods }, { data: dc }, { data: dp }, { data: cnt }, { data: cntRango }, { data: cntAyer }] = await Promise.all([
      supabase.from('escenario_ventas').select('*').eq('escenario_id', escenario.id).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('hora'),
      supabase.from('escenario_reservas').select('*').eq('escenario_id', escenario.id).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('hora'),
      supabase.from('escenario_compras').select('*').eq('escenario_id', escenario.id).gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('escenario_gastos').select('*').eq('escenario_id', escenario.id).gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenario.id).order('nombre'),
      supabase.from('escenario_ventas').select('*').eq('escenario_id', escenario.id).eq('pago_estado', 'pendiente').eq('estado', 'completada'),
      supabase.from('escenario_compras').select('*').eq('escenario_id', escenario.id),
      // El conteo físico es una foto de UN día puntual — en modo rango no
      // aplica, así que no se pide (queda vacío y esa sección se oculta).
      enRango ? Promise.resolve({ data: [] }) : supabase.from('escenario_conteos_stock').select('*').eq('escenario_id', escenario.id).eq('fecha', fecha),
      // En modo rango sí interesan los conteos físicos de los dos extremos
      // del periodo (apertura y cierre) — son la base del resumen semanal
      // "apertura + compras − cierre = vendido" por producto.
      enRango ? supabase.from('escenario_conteos_stock').select('*').eq('escenario_id', escenario.id).in('fecha', [desde, hasta]) : Promise.resolve({ data: [] }),
      // En modo día, el conteo del día ANTERIOR hace de "II" (inventario
      // inicial) del reporte tipo planilla de papel — lo que quedó ayer es
      // con lo que se arrancó hoy.
      enRango ? Promise.resolve({ data: [] }) : supabase.from('escenario_conteos_stock').select('*').eq('escenario_id', escenario.id).eq('fecha', fechaLocalStr(new Date(new Date(fecha + 'T00:00:00').getTime() - 86400000))),
    ])
    setVentas(v || [])
    setReservas(r || [])
    setCompras(c || [])
    setGastos(g || [])
    setProductos(prods || [])
    setDeudasClientes(dc || [])
    setDeudasProveedores((dp || []).filter(compraDebe))
    const mapaConteos = {}
    ;(cnt || []).forEach(row => { if (row.product_id) mapaConteos[row.product_id] = row })
    setConteos(mapaConteos)
    const mapaApertura = {}, mapaCierre = {}
    ;(cntRango || []).forEach(row => {
      if (!row.product_id) return
      if (row.fecha === desde) mapaApertura[row.product_id] = row
      if (row.fecha === hasta) mapaCierre[row.product_id] = row
    })
    setConteoApertura(mapaApertura)
    setConteoCierre(mapaCierre)
    const mapaAyer = {}
    ;(cntAyer || []).forEach(row => { if (row.product_id) mapaAyer[row.product_id] = row })
    setConteoAyer(mapaAyer)
    setInputFisico({})
  }

  // Guarda el conteo físico de todos los productos en los que se escribió
  // algo, y calcula la diferencia contra lo que dice el sistema en este
  // momento — así queda anotado si faltó o sobró algo ese día.
  async function guardarConteo() {
    const filas = productos.map(p => {
      const texto = inputFisico[p.id]
      if (texto === undefined || texto === '') return null
      const fisica = parseInt(texto) || 0
      return {
        escenario_id: escenario.id, fecha, product_id: p.id, nombre: p.nombre,
        cantidad_sistema: p.cantidad, cantidad_fisica: fisica, diferencia: fisica - p.cantidad,
        player_id: encargado?.id || null,
      }
    }).filter(Boolean)
    if (filas.length === 0) return
    setGuardandoConteo(true)
    const { error } = await supabase.from('escenario_conteos_stock').upsert(filas, { onConflict: 'escenario_id,fecha,product_id' })
    setGuardandoConteo(false)
    if (error) {
      setMsgConteo(/does not exist/.test(error.message||'') ? '⚠️ Falta correr la migración migracion_escenario_conteo_stock.sql' : '❌ ' + error.message)
      setTimeout(()=>setMsgConteo(''),5000)
      return
    }
    const conDiferencia = filas.filter(f => f.diferencia !== 0)
    setMsgConteo(conDiferencia.length ? `⚠️ Guardado — ${conDiferencia.length} producto(s) con diferencia` : '✅ Conteo guardado, todo coincide')
    setTimeout(()=>setMsgConteo(''),5000)
    if (conDiferencia.length) {
      registrarActividad(escenarioId, encargado, 'crear', 'conteo',
        `Conteo físico del ${fecha}: ${conDiferencia.map(f=>`${f.nombre} ${f.diferencia>0?'+':''}${f.diferencia}`).join(', ')}`)
    }
    fetchDia()
  }

  const ventasCompletadas = ventas.filter(v => v.estado !== 'devuelta')
  const ventasDevueltas = ventas.filter(v => v.estado === 'devuelta')
  const totalDevuelto = ventasDevueltas.reduce((a,v)=>a+Number(v.total||0),0)
  const ventasFiadas = ventasCompletadas.filter(v => v.pago_estado === 'pendiente')
  const totalFiadoHoy = ventasFiadas.reduce((a,v)=>a+Number(v.total||0),0)

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const totalVentas = ventasCompletadas.reduce((a,v)=>a+Number(v.total||0),0)
  const costoTotal = ventasCompletadas.reduce((a,v)=>a+Number(v.costo_total||0),0)
  const ganancia = totalVentas - costoTotal
  const productosVendidos = ventasCompletadas.reduce((a,v)=>a+(v.items||[]).reduce((b,i)=>b+i.cantidad,0),0)
  const ingresoTienda = totalVentas - totalFiadoHoy

  // Una reserva cancelada o rechazada no debe contar en la caja aunque haya
  // quedado con monto_pagado>0 de antes (cancelar no borra ese campo, solo
  // marca el estado — si no se filtra acá, el informe suma plata de una
  // reserva que ya no cuenta, y el total no cuadra contra lo que de verdad
  // se cobró ese día).
  const reservasValidas = reservas.filter(r => r.estado !== 'cancelada' && r.estado !== 'rechazada')
  const reservasCanceladas = reservas.filter(r => r.estado === 'cancelada' || r.estado === 'rechazada')
  const ingresoCanchas = reservasValidas.reduce((a,r)=>a+Number(r.monto_pagado||0),0)
  const totalCanchas = reservasValidas.reduce((a,r)=>a+Number(r.monto||0),0)

  const gastoCompras = compras.reduce((a,c)=>a+totalCompra(c),0)
  const pagadoCompras = compras.reduce((a,c)=>a+pagadoDe(c),0)
  const totalGastos = gastos.reduce((a,g)=>a+Number(g.monto||0),0)

  const montoBase = Number(baseActual?.monto || 0)
  const cajaNeta = montoBase + ingresoTienda + ingresoCanchas - pagadoCompras - totalGastos

  // Resumen del periodo por producto (solo modo rango): apertura + compras
  // − cierre = lo que de verdad salió de la nevera/bodega, sin importar si
  // quedó registrado como venta o no (sirve para ver faltantes, dañados o
  // ventas que no se cargaron al sistema). Depende de que se haya guardado
  // el conteo físico tanto en la fecha "desde" como en la fecha "hasta" del
  // rango — si falta alguno de los dos, no se puede calcular ese producto.
  const resumenProductos = modo === 'rango' ? productos.map(p => {
    const apertura = conteoApertura[p.id]?.cantidad_fisica
    const cierre = conteoCierre[p.id]?.cantidad_fisica
    const comprasProd = compras.filter(c => c.product_id === p.id).reduce((a,c)=>a+Number(c.cantidad||0),0)
    const ventasRegistradas = ventasCompletadas.reduce((a,v)=>a+(v.items||[]).filter(i=>i.productId===p.id).reduce((b,i)=>b+Number(i.cantidad||0),0), 0)
    const tieneAmbosConteos = apertura != null && cierre != null
    const vendidoReal = tieneAmbosConteos ? apertura + comprasProd - cierre : null
    const diferencia = tieneAmbosConteos ? vendidoReal - ventasRegistradas : null
    return { producto: p, apertura, cierre, comprasProd, ventasRegistradas, vendidoReal, diferencia, tieneAmbosConteos }
  }) : []

  // Reporte diario estilo planilla de papel (solo modo día). "Vendido" ya NO
  // depende de contar físicamente: sale directo de las ventas que se van
  // registrando en la tienda (igual que "Total"), porque eso es justo lo que
  // el encargado ya lleva al día. El conteo físico (II/IF) queda como
  // verificación OPCIONAL: si se guardó el de ayer y el de hoy, se puede
  // comparar contra lo vendido registrado y avisar si no cuadra (faltante,
  // daño, o una venta que no se cargó al sistema) — pero si no se contó,
  // igual sale el vendido y el total sin ningún bloqueo.
  const resumenProductosDia = modo === 'dia' ? productos.map(p => {
    const ii = conteoAyer[p.id]?.cantidad_fisica
    const iff = conteos[p.id]?.cantidad_fisica
    const llego = compras.filter(c => c.product_id === p.id).reduce((a,c)=>a+Number(c.cantidad||0),0)
    const vendido = ventasCompletadas.reduce((a,v)=>a+(v.items||[]).filter(i=>i.productId===p.id).reduce((b,i)=>b+Number(i.cantidad||0),0), 0)
    const total = vendido * Number(p.precio || 0)
    const tieneAmbosConteos = ii != null && iff != null
    const vendidoSegunConteo = tieneAmbosConteos ? ii + llego - iff : null
    const diferencia = tieneAmbosConteos ? vendidoSegunConteo - vendido : null
    return { producto: p, ii, iff, llego, vendido, total, tieneAmbosConteos, vendidoSegunConteo, diferencia }
  }) : []
  const totalVentasLedger = resumenProductosDia.reduce((a,rp)=>a+(rp.total||0), 0)

  // Grilla de canchas × horarios del día (solo modo día) — un cuadro por
  // cancha, con una fila por cada hora configurada del escenario, mostrando
  // si esa hora tiene reserva y cuánto se cobró. Igual que arriba, no cuenta
  // las canceladas/rechazadas.
  const horasDia = escenario ? getHours(escenario) : []
  const canchasGrid = modo === 'dia' ? canchas.map(cancha => {
    const filas = horasDia.map(h => {
      const r = reservasValidas.find(rv => rv.cancha === cancha.slug && rv.hora === h)
      return { hora: h, reserva: r || null }
    })
    const total = filas.reduce((a,f)=>a+(f.reserva ? Number(f.reserva.monto_pagado||0) : 0), 0)
    return { cancha, filas, total }
  }) : []
  const totalTodasCanchas = canchasGrid.reduce((a,cg)=>a+cg.total, 0)

  const totalDeudaClientes = deudasClientes.reduce((a,v)=>a+Number(v.total||0),0)
  const totalDeudaProveedores = deudasProveedores.reduce((a,c)=>a+(totalCompra(c)-(c.monto_pagado||0)),0)

  const stat = { background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <style>{`@media print { .no-print { display:none !important } body * { visibility:hidden } #print-area, #print-area * { visibility:visible } #print-area { position:absolute; left:0; top:0; width:100% } }`}</style>

      <div className="no-print" style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>🧾 Informe diario</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        <div className="no-print" style={{ marginBottom:'16px' }}>
          <label style={{ fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase' }}>Periodo del informe</label>
          <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
            <button onClick={()=>setModo('dia')}
              style={{ flex:1, padding:'9px', borderRadius:'8px', border:`1px solid ${modo==='dia'?S.cyan:S.border}`, background: modo==='dia'?S.cyanDim:'none', color: modo==='dia'?S.cyan:S.text2, cursor:'pointer', fontWeight:700, fontSize:'.78rem' }}>Un día</button>
            <button onClick={()=>setModo('rango')}
              style={{ flex:1, padding:'9px', borderRadius:'8px', border:`1px solid ${modo==='rango'?S.cyan:S.border}`, background: modo==='rango'?S.cyanDim:'none', color: modo==='rango'?S.cyan:S.text2, cursor:'pointer', fontWeight:700, fontSize:'.78rem' }}>Rango de fechas</button>
          </div>
          {modo === 'dia' ? (
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <label style={{ fontSize:'.66rem', color:S.muted, display:'block', marginBottom:'4px' }}>Desde</label>
                <input type="date" value={fechaDesde} onChange={e=>setFechaDesde(e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={{ fontSize:'.66rem', color:S.muted, display:'block', marginBottom:'4px' }}>Hasta</label>
                <input type="date" value={fechaHasta} onChange={e=>setFechaHasta(e.target.value)} style={inp}/>
              </div>
            </div>
          )}
        </div>

        <div id="print-area" style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px' }}>
          <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:'14px' }}>
            🧾 Informe {modo==='dia' ? `diario — ${fmtDate(fecha)}` : `del ${fmtDate(fechaDesde<=fechaHasta?fechaDesde:fechaHasta)} al ${fmtDate(fechaDesde<=fechaHasta?fechaHasta:fechaDesde)}`}
          </div>

          {/* Planilla del día, estilo papel: productos (II/Llegó/IF/Vendido/Total)
              a un lado, canchas + compras + gastos al otro. */}
          {modo === 'dia' && (
            <div style={{ marginBottom:'22px' }}>
              <div style={seccion}>📋 Planilla del día</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'14px', alignItems:'start' }}>

                {/* Columna izquierda: productos */}
                <div style={{ border:`1px solid ${S.border}`, borderRadius:'10px', overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.68rem' }}>
                    <thead>
                      <tr style={{ background:S.card2 }}>
                        {['Producto','II','Llegó','IF','Vendido','Precio','Total'].map(h => (
                          <th key={h} style={{ padding:'6px 5px', textAlign: h==='Producto' ? 'left' : 'right', color:S.muted, fontWeight:700, borderBottom:`1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productos.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding:'10px', textAlign:'center', color:S.muted }}>Sin productos.</td></tr>
                      ) : resumenProductosDia.map(rp => (
                        <tr key={rp.producto.id} style={{ borderBottom:`1px solid ${S.border}` }}>
                          <td style={{ padding:'5px' }}>{rp.producto.emoji || '📦'} {rp.producto.nombre}</td>
                          <td style={{ padding:'5px', textAlign:'right', color:S.muted }}>{rp.ii ?? '—'}</td>
                          <td style={{ padding:'5px', textAlign:'right', color:S.muted }}>{rp.llego || ''}</td>
                          <td style={{ padding:'5px', textAlign:'right', color:S.muted }}>{rp.iff ?? '—'}</td>
                          <td style={{ padding:'5px', textAlign:'right', fontWeight:700, color:S.cyan }}>
                            {rp.vendido}
                            {rp.tieneAmbosConteos && rp.diferencia !== 0 && (
                              <div style={{ fontWeight:400, fontSize:'.62rem', color:S.gold }}>⚠️ conteo dice {rp.vendidoSegunConteo}</div>
                            )}
                          </td>
                          <td style={{ padding:'5px', textAlign:'right', color:S.muted }}>{fmtMoney(rp.producto.precio)}</td>
                          <td style={{ padding:'5px', textAlign:'right', fontWeight:700 }}>{fmtMoney(rp.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {productos.length > 0 && (
                      <tfoot>
                        <tr style={{ background:S.card2 }}>
                          <td colSpan={6} style={{ padding:'6px 5px', textAlign:'right', fontWeight:800 }}>Total Ventas Día</td>
                          <td style={{ padding:'6px 5px', textAlign:'right', fontWeight:900, color:S.cyan }}>{fmtMoney(totalVentasLedger)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  <div style={{ fontSize:'.66rem', color:S.muted, padding:'6px 8px' }}>
                    Vendido y Total salen directo de las ventas ya registradas en la tienda — no hace falta contar nada. II/IF son opcionales (conteo físico de ayer y de hoy, ver más abajo): si guardaste los dos, acá aparece una alerta si el conteo no coincide con lo vendido registrado.
                  </div>
                </div>

                {/* Columna derecha: canchas + compras + gastos */}
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {canchasGrid.length === 0 ? (
                    <div style={{ border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px', fontSize:'.75rem', color:S.muted }}>Sin canchas configuradas.</div>
                  ) : canchasGrid.map(cg => (
                    <div key={cg.cancha.id} style={{ border:`1px solid ${S.border}`, borderRadius:'10px', overflow:'hidden' }}>
                      <div style={{ background:S.card2, padding:'6px 8px', fontWeight:800, fontSize:'.76rem' }}>{cg.cancha.nombre}</div>
                      {cg.filas.map(f => (
                        <div key={f.hora} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', fontSize:'.72rem', borderTop:`1px solid ${S.border}` }}>
                          <span style={{ color:S.muted }}>{fmtHora12(f.hora)}</span>
                          <span style={{ fontWeight: f.reserva ? 700 : 400, color: f.reserva ? (f.reserva.pago==='pagado' ? S.cyan : S.gold) : S.muted }}>
                            {f.reserva ? `${fmtMoney(f.reserva.monto_pagado||0)}/${fmtMoney(f.reserva.monto||0)}` : ''}
                          </span>
                        </div>
                      ))}
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', fontSize:'.74rem', fontWeight:800, borderTop:`1px solid ${S.border}`, background:S.card2 }}>
                        <span>TOTAL</span><span style={{ color:S.cyan }}>{fmtMoney(cg.total)}</span>
                      </div>
                    </div>
                  ))}
                  {canchasGrid.length > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', border:`1px solid ${S.border}`, borderRadius:'10px', fontWeight:900, fontSize:'.8rem' }}>
                      <span>TOTAL CANCHAS</span><span style={{ color:S.cyan }}>{fmtMoney(totalTodasCanchas)}</span>
                    </div>
                  )}

                  {/* Compras del día */}
                  <div style={{ border:`1px solid ${S.border}`, borderRadius:'10px', overflow:'hidden' }}>
                    <div style={{ background:S.card2, padding:'6px 8px', fontWeight:800, fontSize:'.76rem' }}>COMPRAS</div>
                    {compras.length === 0 ? (
                      <div style={{ padding:'8px', fontSize:'.72rem', color:S.muted }}>Sin compras hoy.</div>
                    ) : compras.map(c => (
                      <div key={c.id} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', fontSize:'.72rem', borderTop:`1px solid ${S.border}` }}>
                        <span style={{ color:S.text2 }}>{c.nombre} x{c.cantidad}</span>
                        <span style={{ fontWeight:700 }}>{fmtMoney(totalCompra(c))}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', fontSize:'.74rem', fontWeight:800, borderTop:`1px solid ${S.border}`, background:S.card2 }}>
                      <span>TOTAL COMPRAS</span><span>{fmtMoney(gastoCompras)}</span>
                    </div>
                  </div>

                  {/* Gastos del día */}
                  <div style={{ border:`1px solid ${S.border}`, borderRadius:'10px', overflow:'hidden' }}>
                    <div style={{ background:S.card2, padding:'6px 8px', fontWeight:800, fontSize:'.76rem' }}>GASTOS</div>
                    {gastos.length === 0 ? (
                      <div style={{ padding:'8px', fontSize:'.72rem', color:S.muted }}>Sin gastos hoy.</div>
                    ) : gastos.map(g => (
                      <div key={g.id} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', fontSize:'.72rem', borderTop:`1px solid ${S.border}` }}>
                        <span style={{ color:S.text2 }}>{g.descripcion}</span>
                        <span style={{ fontWeight:700, color:S.loss }}>{fmtMoney(g.monto)}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', fontSize:'.74rem', fontWeight:800, borderTop:`1px solid ${S.border}`, background:S.card2 }}>
                      <span>TOTAL GASTOS</span><span style={{ color:S.loss }}>{fmtMoney(totalGastos)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totales del pie, igual que la planilla de papel */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'8px', marginTop:'12px', border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px' }}>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Total Ventas Día</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(totalVentasLedger)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Base</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(montoBase)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Compras</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(gastoCompras)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Gastos</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(totalGastos)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Total Efectivo Día</div><div style={{ fontWeight:900, fontSize:'.95rem', color:S.cyan }}>{fmtMoney(montoBase + totalVentasLedger + totalTodasCanchas - pagadoCompras - totalGastos)}</div></div>
              </div>
            </div>
          )}

          {/* Resumen general */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Ventas tienda</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.cyan }}>{fmtMoney(totalVentas)}</div></div>
              <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Pagado en compras</div><div style={{ fontWeight:900, fontSize:'1.1rem' }}>{fmtMoney(pagadoCompras)}</div></div>
              <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Gastos</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.loss }}>{fmtMoney(totalGastos)}</div></div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Cobrado en canchas</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.cyan }}>{fmtMoney(ingresoCanchas)}</div></div>
              {ventasFiadas.length > 0 && (
                <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Fiado hoy ({ventasFiadas.length})</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.gold }}>{fmtMoney(totalFiadoHoy)}</div></div>
              )}
              <div style={stat}>
                <div style={{ fontSize:'.68rem', color:S.muted }}>Base de caja</div>
                <div style={{ fontWeight:900, fontSize:'1.1rem' }}>{fmtMoney(montoBase)}</div>
                {baseActual && <div style={{ fontSize:'.62rem', color:S.muted }}>puesta el {fmtDate(baseActual.fecha)}</div>}
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'10px' }}>
            <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Ganancia tienda</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.gold }}>{fmtMoney(ganancia)}</div></div>
            {ventasDevueltas.length > 0 && (
              <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Devuelto ({ventasDevueltas.length})</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.loss }}>-{fmtMoney(totalDevuelto)}</div></div>
            )}
            {reservasCanceladas.length > 0 && (
              <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Canceladas/rechazadas ({reservasCanceladas.length})</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.muted }}>No suman a la caja</div></div>
            )}
            <div style={{...stat, gridColumn:'1/-1'}}><div style={{ fontSize:'.68rem', color:S.muted }}>Caja neta del día (base + tienda + canchas − compras − gastos)</div><div style={{ fontWeight:900, fontSize:'1.3rem', color:S.cyan }}>{fmtMoney(cajaNeta)}</div></div>
          </div>

          {/* Canchas del día — no incluye las canceladas (aunque hayan quedado
              con un monto_pagado de antes de cancelarse, no cuentan en la caja) */}
          <div style={seccion}>🏟️ Canchas — {reservasValidas.length} reserva(s), {fmtMoney(totalCanchas)} en total</div>
          {reservasValidas.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Sin reservas {modo==='dia'?'este día':'en el periodo'}.</div> : reservasValidas.map(r => (
            <div key={r.id} style={rowItem}>
              <span>{modo==='rango' ? fmtDate(r.fecha)+' · ' : ''}{r.hora} · {nombreCancha(canchas, r.cancha)} · {r.nombre || 'Sin nombre'}{r.motivo_pago ? ` · pagó menos (${r.motivo_pago})` : ''}</span>
              <span style={{ fontWeight:700, color: r.pago==='pagado' ? S.cyan : S.gold }}>{fmtMoney(r.monto_pagado||0)}/{fmtMoney(r.monto||0)}</span>
            </div>
          ))}
          {reservasCanceladas.length > 0 && (
            <div style={{ ...rowItem, color:S.muted, fontSize:'.72rem', fontStyle:'italic' }}>
              {reservasCanceladas.length} reserva(s) cancelada(s)/rechazada(s) este {modo==='dia'?'día':'periodo'} — no se cuentan en el total.
            </div>
          )}

          {/* Ventas del día (detalle) */}
          <div style={seccion}>🛒 Ventas — {ventasCompletadas.length} venta(s), {productosVendidos} producto(s)</div>
          {ventasCompletadas.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Sin ventas {modo==='dia'?'este día':'en el periodo'}.</div> : ventasCompletadas.map(v => (
            <div key={v.id} style={rowItem}>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{modo==='rango' ? fmtDate(v.fecha)+' · ' : ''}{v.hora} · {(v.items||[]).map(i=>i.cantidad+'x '+i.nombre).join(', ')}{v.pago_estado==='pendiente' ? ' · fiado' : ''}</span>
              <span style={{ fontWeight:700 }}>{fmtMoney(v.total)}</span>
            </div>
          ))}

          {/* Compras del día */}
          <div style={seccion}>🚚 Compras — {compras.length} compra(s), {fmtMoney(gastoCompras)} en total</div>
          {compras.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Sin compras {modo==='dia'?'este día':'en el periodo'}.</div> : compras.map(c => (
            <div key={c.id} style={rowItem}>
              <span>{modo==='rango' ? fmtDate(c.fecha)+' · ' : ''}{c.hora ? c.hora+' · ' : ''}{c.nombre} x{c.cantidad} · {c.proveedor}</span>
              <span style={{ fontWeight:700, color: compraDebe(c) ? S.gold : S.text }}>{fmtMoney(totalCompra(c))}{compraDebe(c) ? ' (debe)' : ''}</span>
            </div>
          ))}

          {/* Gastos del día */}
          <div style={seccion}>💸 Gastos — {gastos.length} gasto(s), {fmtMoney(totalGastos)} en total</div>
          {gastos.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Sin gastos {modo==='dia'?'este día':'en el periodo'}.</div> : gastos.map(g => (
            <div key={g.id} style={rowItem}>
              <span>{modo==='rango' ? fmtDate(g.fecha)+' · ' : ''}{g.hora ? g.hora+' · ' : ''}{g.descripcion}{g.categoria ? ` · ${g.categoria}` : ''}</span>
              <span style={{ fontWeight:700, color:S.loss }}>{fmtMoney(g.monto)}</span>
            </div>
          ))}

          {/* Deudas pendientes (a hoy, no solo de este día) */}
          <div style={seccion}>📝 Por cobrar a clientes — {deudasClientes.length} deuda(s), {fmtMoney(totalDeudaClientes)} en total</div>
          {deudasClientes.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Nadie debe en la tienda.</div> : deudasClientes.map(v => (
            <div key={v.id} style={rowItem}>
              <span>{v.deudor_nombre || 'Sin nombre'}{v.deudor_cancha ? ` · ${v.deudor_cancha}` : ''} <span style={{ color:S.muted }}>({v.fecha})</span></span>
              <span style={{ fontWeight:700, color:S.gold }}>{fmtMoney(v.total)}</span>
            </div>
          ))}

          <div style={seccion}>📝 Por pagar a proveedores — {deudasProveedores.length} deuda(s), {fmtMoney(totalDeudaProveedores)} en total</div>
          {deudasProveedores.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>No se debe nada a proveedores.</div> : deudasProveedores.map(c => (
            <div key={c.id} style={rowItem}>
              <span>{c.proveedor} · {c.nombre} x{c.cantidad} <span style={{ color:S.muted }}>({c.fecha})</span></span>
              <span style={{ fontWeight:700, color:S.gold }}>{fmtMoney(totalCompra(c)-(c.monto_pagado||0))}</span>
            </div>
          ))}

          {/* Resumen del periodo por producto — apertura + compras − cierre = vendido real */}
          {modo === 'rango' && (
            <>
              <div style={seccion}>📦 Resumen del periodo por producto</div>
              <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'8px', lineHeight:1.4 }}>
                Apertura = conteo físico guardado en {fmtDate(fechaDesde<=fechaHasta?fechaDesde:fechaHasta)}. Cierre = conteo físico guardado en {fmtDate(fechaDesde<=fechaHasta?fechaHasta:fechaDesde)}. Si falta alguno de los dos, no se puede calcular — guárdalos desde "Verificar stock físico" en modo "Un día", en esas dos fechas.
              </div>
              {productos.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Sin productos.</div> : resumenProductos.map(rp => (
                <div key={rp.producto.id} style={{ padding:'8px 0', borderBottom:`1px solid ${S.border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'.8rem', fontWeight:700 }}>
                    <span>{rp.producto.emoji || '📦'} {rp.producto.nombre}</span>
                    {rp.tieneAmbosConteos ? (
                      <span style={{ color:S.cyan }}>{rp.vendidoReal} vendido(s)</span>
                    ) : (
                      <span style={{ color:S.muted, fontWeight:400, fontSize:'.72rem' }}>falta conteo físico</span>
                    )}
                  </div>
                  <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'2px' }}>
                    Apertura: {rp.apertura ?? '—'} · + Compras: {rp.comprasProd} · − Cierre: {rp.cierre ?? '—'}
                    {rp.tieneAmbosConteos && (
                      <> · Según ventas registradas: {rp.ventasRegistradas}{rp.diferencia !== 0 && (
                        <span style={{ color: S.gold, fontWeight:700 }}> · diferencia: {rp.diferencia>0?'+':''}{rp.diferencia}</span>
                      )}</>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Stock actual — sistema vs. físico contado, si ya se verificó ese día */}
          <div style={seccion}>📦 Stock — lo que quedó (sistema vs. conteo físico)</div>
          {productos.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Sin productos.</div> : productos.map(p => {
            const cnt = conteos[p.id]
            return (
              <div key={p.id} style={rowItem}>
                <span>{p.emoji || '📦'} {p.nombre}</span>
                {cnt ? (
                  <span style={{ fontWeight:700, textAlign:'right' }}>
                    <span style={{ color:S.text }}>{cnt.cantidad_sistema} sist. → {cnt.cantidad_fisica} físico</span>{' '}
                    <span style={{ color: cnt.diferencia===0 ? '#22c55e' : cnt.diferencia<0 ? S.loss : S.gold }}>
                      ({cnt.diferencia===0 ? '✓ coincide' : (cnt.diferencia>0?'+':'')+cnt.diferencia})
                    </span>
                  </span>
                ) : (
                  <span style={{ fontWeight:700, color: p.cantidad<=p.stock_minimo ? S.loss : S.text }}>{p.cantidad} und <span style={{ color:S.muted, fontWeight:400 }}>(sin verificar)</span></span>
                )}
              </div>
            )
          })}

          {/* Verificación física — solo interactivo, no sale impreso hasta guardarse.
              Solo aplica a modo "día": el conteo físico es una foto de un momento
              puntual, no tiene sentido "contar" a lo largo de un rango. */}
          {!soloLectura && modo==='dia' && (
          <div className="no-print" style={{ marginTop:'16px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px' }}>
            <div style={{ fontWeight:800, fontSize:'.82rem', marginBottom:'4px' }}>🔍 Verificar stock físico de este día</div>
            <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'12px' }}>Cuenta lo que realmente queda de cada producto y compáralo con lo que dice el sistema.</div>
            {productos.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 0' }}>
                <span style={{ flex:1, fontSize:'.8rem' }}>{p.emoji || '📦'} {p.nombre} <span style={{ color:S.muted, fontSize:'.72rem' }}>(sistema: {p.cantidad})</span></span>
                <input type="number" placeholder={String(p.cantidad)}
                  value={inputFisico[p.id] ?? (conteos[p.id]?.cantidad_fisica ?? '')}
                  onChange={e=>setInputFisico(m=>({...m,[p.id]:e.target.value}))}
                  style={{ width:'70px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'8px', padding:'6px 8px', color:S.text, fontSize:'.8rem', outline:'none', boxSizing:'border-box' }}/>
              </div>
            ))}
            {msgConteo && <div style={{ fontSize:'.76rem', color:S.cyan, textAlign:'center', margin:'10px 0' }}>{msgConteo}</div>}
            <button onClick={guardarConteo} disabled={guardandoConteo} style={{ width:'100%', padding:'11px', marginTop:'8px', background:S.gold, border:'none', borderRadius:'10px', cursor:'pointer', color:'#1a1300', fontWeight:800, fontSize:'.8rem', opacity:guardandoConteo?.7:1 }}>
              {guardandoConteo ? 'Guardando...' : 'Guardar conteo físico'}
            </button>
          </div>
          )}
        </div>

        <button className="no-print" onClick={()=>window.print()} style={{ width:'100%', padding:'13px', marginTop:'16px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem' }}>Generar / imprimir PDF del informe</button>
        <div className="no-print" style={{ fontSize:'.72rem', color:S.muted, marginTop:'8px', textAlign:'center' }}>Se abre el diálogo de impresión del navegador — elige "Guardar como PDF".</div>
      </div>
    </div>
  )
}
