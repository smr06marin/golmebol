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
  const [bases,     setBases]     = useState([]) // TODAS las filas de escenario_base_caja (para poder saber cuál regía en cualquier fecha del informe, no solo la última puesta)
  const [mostrarFormBase, setMostrarFormBase] = useState(false)
  const [montoBaseInput,  setMontoBaseInput]  = useState('')
  const [guardandoBase,   setGuardandoBase]   = useState(false)
  const [msgBase,         setMsgBase]         = useState('')
  const [conteos,      setConteos]      = useState({}) // product_id -> fila de escenario_conteos_stock
  const [conteoAyer,   setConteoAyer]   = useState({}) // product_id -> fila del conteo físico del día ANTERIOR (modo día) — es el "II" (inventario inicial) del reporte tipo planilla de papel
  const [conteoApertura, setConteoApertura] = useState({}) // product_id -> fila del conteo físico en la fecha "desde" (modo rango)
  const [conteoCierre,   setConteoCierre]   = useState({}) // product_id -> fila del conteo físico en la fecha "hasta" (modo rango)
  const [inputFisico,  setInputFisico]  = useState({}) // product_id -> texto que se está escribiendo
  const [guardandoConteo, setGuardandoConteo] = useState(false)
  const [msgConteo, setMsgConteo] = useState('')
  const [soloLectura, setSoloLectura] = useState(false)

  // Límites reales del periodo que se está viendo — en modo "día" son la
  // misma fecha dos veces, así el resto del código (fetch, conteo físico,
  // base de caja) no necesita dos caminos distintos. Si alguien invierte
  // las fechas del rango, se corrige solo. Calculados acá arriba (no solo
  // dentro de fetchDia) para que estén disponibles también en guardarConteo
  // y guardarBaseReporte.
  const desde = modo === 'rango' ? (fechaDesde <= fechaHasta ? fechaDesde : fechaHasta) : fecha
  const hasta = modo === 'rango' ? (fechaDesde <= fechaHasta ? fechaHasta : fechaDesde) : fecha

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
    await fetchBases(escenarioId)
    setLoading(false)
  }

  // Trae TODAS las bases (no solo la última) para poder saber cuál regía en
  // cualquier fecha que se esté viendo en el informe, no solo hoy.
  async function fetchBases(escId) {
    const { data: bs } = await supabase.from('escenario_base_caja').select('*').eq('escenario_id', escId)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false })
    setBases(bs || [])
  }

  // La base "de este día" es la más reciente puesta EN O ANTES de la fecha
  // que se está viendo (bases ya viene ordenado de más reciente a más
  // antiguo) — así el informe de un día pasado usa la base que regía ese
  // día, no la última que se puso después.
  function baseComoDe(fechaObjetivo) {
    return bases.find(b => b.fecha <= fechaObjetivo) || null
  }

  async function fetchDia() {
    const enRango = modo === 'rango'
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
  // momento — así queda anotado si faltó o sobró algo ese día. En modo
  // rango se guarda en la fecha "hasta" (el cierre del periodo) — es lo que
  // completa el "IF" de la planilla; el "II" (apertura) es el conteo que ya
  // se haya guardado en la fecha "desde", de otra sesión.
  async function guardarConteo() {
    const filas = productos.map(p => {
      const texto = inputFisico[p.id]
      if (texto === undefined || texto === '') return null
      const fisica = parseInt(texto) || 0
      return {
        escenario_id: escenario.id, fecha: hasta, product_id: p.id, nombre: p.nombre,
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
        `Conteo físico del ${hasta}: ${conDiferencia.map(f=>`${f.nombre} ${f.diferencia>0?'+':''}${f.diferencia}`).join(', ')}`)
    }
    fetchDia()
  }

  // Pone (o cambia) la base de caja de la fecha que se está viendo — se
  // guarda como una fila nueva (no se edita la anterior), igual que ya hacía
  // la página de Reportes; acá queda además ligada al día del informe.
  async function guardarBaseReporte() {
    const montoNum = Number(montoBaseInput) || 0
    if (montoNum <= 0) { setMsgBase('Ingresa un monto válido'); setTimeout(()=>setMsgBase(''),3000); return }
    setGuardandoBase(true)
    const { error } = await supabase.from('escenario_base_caja').insert({
      escenario_id: escenario.id, monto: montoNum, fecha: hasta, hora: new Date().toTimeString().slice(0,5), player_id: encargado?.id || null,
    })
    setGuardandoBase(false)
    if (error) { setMsgBase('❌ ' + error.message); setTimeout(()=>setMsgBase(''),5000); return }
    registrarActividad(escenarioId, encargado, 'crear', 'base_caja', `Puso la base de caja: ${fmtMoney(montoNum)} (${hasta})`)
    setMsgBase(`✅ Base guardada: ${fmtMoney(montoNum)}`); setTimeout(()=>setMsgBase(''),3000)
    setMontoBaseInput(''); setMostrarFormBase(false)
    fetchBases(escenario.id)
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

  // La base de caja "de este informe" es la más reciente puesta en o antes
  // de la fecha final del periodo que se está viendo (hasta) — no siempre
  // la última que se puso en general.
  const baseDelDia = baseComoDe(hasta)
  const montoBase = Number(baseDelDia?.monto || 0)
  const cajaNeta = montoBase + ingresoTienda + ingresoCanchas - pagadoCompras - totalGastos

  // Planilla de productos, estilo papel: II (apertura) + Llegó (compras del
  // periodo) − IF (cierre) sirven de verificación, pero "Vendido" y "Total"
  // salen directo de las ventas ya registradas en la tienda (no dependen de
  // contar nada) — porque eso es justo lo que el encargado ya lleva al día.
  // En modo día, II = conteo físico de AYER e IF = conteo físico de HOY. En
  // modo rango, II = conteo guardado en "desde" e IF = conteo guardado en
  // "hasta". Si falta alguno de los dos conteos, no hay con qué comparar —
  // pero Vendido/Total igual salen, sin ningún bloqueo.
  const aperturaMap = modo === 'rango' ? conteoApertura : conteoAyer
  const cierreMap = modo === 'rango' ? conteoCierre : conteos
  const resumenProductosPlanilla = productos.map(p => {
    const ii = aperturaMap[p.id]?.cantidad_fisica
    const iff = cierreMap[p.id]?.cantidad_fisica
    const llego = compras.filter(c => c.product_id === p.id).reduce((a,c)=>a+Number(c.cantidad||0),0)
    const vendido = ventasCompletadas.reduce((a,v)=>a+(v.items||[]).filter(i=>i.productId===p.id).reduce((b,i)=>b+Number(i.cantidad||0),0), 0)
    const total = vendido * Number(p.precio || 0)
    const tieneAmbosConteos = ii != null && iff != null
    const vendidoSegunConteo = tieneAmbosConteos ? ii + llego - iff : null
    const diferencia = tieneAmbosConteos ? vendidoSegunConteo - vendido : null
    return { producto: p, ii, iff, llego, vendido, total, tieneAmbosConteos, vendidoSegunConteo, diferencia }
  })
  const totalVentasLedger = resumenProductosPlanilla.reduce((a,rp)=>a+(rp.total||0), 0)

  // Cuadro(s) de canchas: en modo día, una fila por cada horario configurado
  // (para ver hora a hora quién pagó y cuánto, igual que la planilla de
  // papel). En modo rango no tiene sentido una grilla hora × día — se
  // muestra en cambio el total y la cantidad de reservas de cada cancha en
  // todo el periodo. Ninguno de los dos cuenta canceladas/rechazadas.
  const horasDia = escenario ? getHours(escenario) : []
  const canchasGrid = canchas.map(cancha => {
    const reservasCancha = reservasValidas.filter(rv => rv.cancha === cancha.slug)
    if (modo === 'dia') {
      const filas = horasDia.map(h => ({ hora: h, reserva: reservasCancha.find(rv => rv.hora === h) || null }))
      const total = filas.reduce((a,f)=>a+(f.reserva ? Number(f.reserva.monto_pagado||0) : 0), 0)
      return { cancha, filas, total, cantidadReservas: filas.filter(f=>f.reserva).length }
    }
    const total = reservasCancha.reduce((a,r)=>a+Number(r.monto_pagado||0), 0)
    return { cancha, filas: null, total, cantidadReservas: reservasCancha.length }
  })
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
            🧾 Informe {modo==='dia' ? `diario — ${fmtDate(fecha)}` : `del ${fmtDate(desde)} al ${fmtDate(hasta)}`}
          </div>

          {/* Planilla, estilo papel: productos (II/Llegó/IF/Vendido/Total) a
              un lado, canchas + compras + gastos al otro. Funciona igual en
              modo día y en modo rango (con canchas resumidas por total en
              vez de hora a hora). */}
          <div style={{ marginBottom:'22px' }}>
              <div style={seccion}>📋 Planilla {modo==='dia' ? 'del día' : 'del periodo'}</div>
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
                      ) : resumenProductosPlanilla.map(rp => (
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
                          <td colSpan={6} style={{ padding:'6px 5px', textAlign:'right', fontWeight:800 }}>Total Ventas {modo==='dia'?'Día':'Periodo'}</td>
                          <td style={{ padding:'6px 5px', textAlign:'right', fontWeight:900, color:S.cyan }}>{fmtMoney(totalVentasLedger)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  <div style={{ fontSize:'.66rem', color:S.muted, padding:'6px 8px' }}>
                    Vendido y Total salen directo de las ventas ya registradas en la tienda — no hace falta contar nada. II = conteo físico de {modo==='dia' ? 'ayer' : `${fmtDate(desde)} (apertura)`}. IF = conteo físico de {modo==='dia' ? 'hoy' : `${fmtDate(hasta)} (cierre)`}, ver más abajo. Ambos son opcionales — si están los dos, acá aparece una alerta si no coinciden con lo vendido registrado.
                  </div>
                </div>

                {/* Columna derecha: canchas + compras + gastos */}
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {canchasGrid.length === 0 ? (
                    <div style={{ border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px', fontSize:'.75rem', color:S.muted }}>Sin canchas configuradas.</div>
                  ) : canchasGrid.map(cg => (
                    <div key={cg.cancha.id} style={{ border:`1px solid ${S.border}`, borderRadius:'10px', overflow:'hidden' }}>
                      <div style={{ background:S.card2, padding:'6px 8px', fontWeight:800, fontSize:'.76rem' }}>{cg.cancha.nombre}</div>
                      {cg.filas ? cg.filas.map(f => (
                        <div key={f.hora} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', fontSize:'.72rem', borderTop:`1px solid ${S.border}` }}>
                          <span style={{ color:S.muted }}>{fmtHora12(f.hora)}</span>
                          <span style={{ fontWeight: f.reserva ? 700 : 400, color: f.reserva ? (f.reserva.pago==='pagado' ? S.cyan : S.gold) : S.muted }}>
                            {f.reserva ? `${fmtMoney(f.reserva.monto_pagado||0)}/${fmtMoney(f.reserva.monto||0)}` : ''}
                          </span>
                        </div>
                      )) : (
                        <div style={{ padding:'6px 8px', fontSize:'.72rem', color:S.text2, borderTop:`1px solid ${S.border}` }}>
                          {cg.cantidadReservas} reserva{cg.cantidadReservas===1?'':'s'} en el periodo
                        </div>
                      )}
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
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Total Ventas {modo==='dia'?'Día':'Periodo'}</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(totalVentasLedger)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Base</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(montoBase)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Compras</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(gastoCompras)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Gastos</div><div style={{ fontWeight:800, fontSize:'.9rem' }}>{fmtMoney(totalGastos)}</div></div>
                <div><div style={{ fontSize:'.66rem', color:S.muted }}>Total Efectivo {modo==='dia'?'Día':'Periodo'}</div><div style={{ fontWeight:900, fontSize:'.95rem', color:S.cyan }}>{fmtMoney(montoBase + totalVentasLedger + totalTodasCanchas - pagadoCompras - totalGastos)}</div></div>
              </div>
          </div>

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
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:'.68rem', color:S.muted }}>Base de caja</div>
                  {!soloLectura && (
                    <button className="no-print" onClick={()=>{ setMostrarFormBase(v=>!v); setMontoBaseInput(baseDelDia?.fecha===hasta ? String(baseDelDia.monto) : '') }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:S.cyan, fontSize:'.68rem', fontWeight:700 }}>
                      {mostrarFormBase ? 'cancelar' : (baseDelDia?.fecha===hasta ? 'editar' : 'poner')}
                    </button>
                  )}
                </div>
                {!mostrarFormBase && (
                  <>
                    <div style={{ fontWeight:900, fontSize:'1.1rem' }}>{fmtMoney(montoBase)}</div>
                    {baseDelDia && <div style={{ fontSize:'.62rem', color:S.muted }}>puesta el {fmtDate(baseDelDia.fecha)}</div>}
                  </>
                )}
                {mostrarFormBase && (
                  <div className="no-print" style={{ marginTop:'6px' }}>
                    <input type="number" value={montoBaseInput} onChange={e=>setMontoBaseInput(e.target.value)} placeholder="$"
                      style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', padding:'7px 9px', color:S.text, fontSize:'.8rem', outline:'none', boxSizing:'border-box', marginBottom:'6px' }}/>
                    <div style={{ fontSize:'.62rem', color:S.muted, marginBottom:'6px' }}>Para el {fmtDate(hasta)}</div>
                    {msgBase && <div style={{ fontSize:'.68rem', color:S.cyan, marginBottom:'6px' }}>{msgBase}</div>}
                    <button onClick={guardarBaseReporte} disabled={guardandoBase}
                      style={{ width:'100%', padding:'7px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.76rem', opacity:guardandoBase?.7:1 }}>
                      {guardandoBase ? 'Guardando...' : 'Guardar base'}
                    </button>
                  </div>
                )}
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

          {/* Stock — sistema vs. físico contado en la fecha de cierre (hasta) */}
          <div style={seccion}>📦 Stock — lo que quedó (sistema vs. conteo físico)</div>
          {productos.length===0 ? <div style={{ color:S.muted, fontSize:'.78rem' }}>Sin productos.</div> : productos.map(p => {
            const cnt = cierreMap[p.id]
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
              En modo rango se guarda como el cierre (fecha "hasta") del periodo. */}
          {!soloLectura && (
          <div className="no-print" style={{ marginTop:'16px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px' }}>
            <div style={{ fontWeight:800, fontSize:'.82rem', marginBottom:'4px' }}>🔍 Verificar stock físico de {modo==='dia' ? 'este día' : `el cierre (${fmtDate(hasta)})`}</div>
            <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'12px' }}>Cuenta lo que realmente queda de cada producto y compáralo con lo que dice el sistema.</div>
            {productos.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 0' }}>
                <span style={{ flex:1, fontSize:'.8rem' }}>{p.emoji || '📦'} {p.nombre} <span style={{ color:S.muted, fontSize:'.72rem' }}>(sistema: {p.cantidad})</span></span>
                <input type="number" placeholder={String(p.cantidad)}
                  value={inputFisico[p.id] ?? (cierreMap[p.id]?.cantidad_fisica ?? '')}
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
