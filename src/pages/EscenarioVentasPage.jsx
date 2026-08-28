import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr, registrarActividad, fechaLocalStr, fmtDate, obtenerAccesoEscenario } from '../lib/escenarioHelpers'
import { useAccionUnica } from '../lib/useAccionUnica'
import { ShoppingCart, Search, Trash2, DollarSign, RotateCcw, History, NotebookPen, X, CheckCircle2, CalendarClock } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
  green: '#22c55e', greenDark: '#16a34a',
}
// Elegir cuánto se devuelve de cada producto de la venta — no toda la venta
// a la fuerza (ej. pidieron 3 aguas, pagaron, y solo devuelven 1).
function ModalDevolucion({ venta, onClose, onConfirmar }) {
  const [cantidades, setCantidades] = useState({})

  function set(productId, valor, max) {
    const v = Math.max(0, Math.min(max, valor))
    setCantidades(c => ({ ...c, [productId]: v }))
  }

  const totalDevolver = (venta.items||[]).reduce((a,it) => a + (cantidades[it.productId]||0) * it.precio, 0)
  const hayAlgo = Object.values(cantidades).some(v => v > 0)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <div style={{ fontWeight:800, fontSize:'1rem' }}>↩️ Devolución</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
        </div>
        <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>Elige cuántas unidades de cada producto se devuelven.</div>

        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'18px' }}>
          {(venta.items||[]).map(it => {
            const val = cantidades[it.productId] || 0
            return (
              <div key={it.productId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', background:S.card2, borderRadius:'10px', padding:'10px 12px' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'.82rem', fontWeight:700 }}>{it.nombre}</div>
                  <div style={{ fontSize:'.7rem', color:S.muted }}>Vendidas: {it.cantidad}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                  <button onClick={()=>set(it.productId, val-1, it.cantidad)} disabled={val<=0}
                    style={{ width:'28px', height:'28px', borderRadius:'8px', border:`1px solid ${S.border}`, background:S.card, color:S.text, cursor:'pointer', fontWeight:800, opacity:val<=0?.4:1 }}>−</button>
                  <span style={{ minWidth:'18px', textAlign:'center', fontWeight:800, fontSize:'.85rem' }}>{val}</span>
                  <button onClick={()=>set(it.productId, val+1, it.cantidad)} disabled={val>=it.cantidad}
                    style={{ width:'28px', height:'28px', borderRadius:'8px', border:`1px solid ${S.border}`, background:S.card, color:S.text, cursor:'pointer', fontWeight:800, opacity:val>=it.cantidad?.4:1 }}>+</button>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <span style={{ fontSize:'.8rem', color:S.text2 }}>Total a devolver</span>
          <span style={{ fontWeight:900, fontSize:'1.1rem', color:S.loss }}>{fmtMoney(totalDevolver)}</span>
        </div>

        <button onClick={()=>onConfirmar(cantidades)} disabled={!hayAlgo}
          style={{ width:'100%', padding:'13px', background:S.loss, border:'none', borderRadius:'12px', cursor:'pointer', color:'#fff', fontWeight:800, fontSize:'.88rem', opacity: hayAlgo ? 1 : .5 }}>
          Confirmar devolución
        </button>
      </div>
    </div>
  )
}

export default function EscenarioVentasPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [canchas,   setCanchas]   = useState([])
  const [ventasPorProducto, setVentasPorProducto] = useState({})
  const [ventasHoy, setVentasHoy] = useState([])
  const [deudas,    setDeudas]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [cart,      setCart]      = useState({})
  const [msg,       setMsg]       = useState('')
  const [buscar,    setBuscar]    = useState('')
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [mostrarDeudas,    setMostrarDeudas]    = useState(false)
  const [modalDebe, setModalDebe] = useState(false)
  const [deudorNombre, setDeudorNombre] = useState('')
  const [deudorCancha, setDeudorCancha] = useState('')
  const [devolviendo, setDevolviendo] = useState(null) // venta a la que se le está eligiendo qué devolver
  const [enviandoVenta, conVentaUnica] = useAccionUnica()
  const [pagandoId, setPagandoId] = useState(null) // id de la venta que se está marcando como pagada, para no duplicar el clic
  const [soloLectura, setSoloLectura] = useState(false)
  // Día para el que se están registrando/viendo las ventas — por defecto
  // hoy, pero se puede retroceder para anotar ventas de ayer o de días
  // anteriores (ej. lo que quedó apuntado a mano en el cuaderno). Nunca
  // hacia el futuro.
  const [fechaVenta, setFechaVenta] = useState(todayStr())
  const esHoy = fechaVenta === todayStr()

  useEffect(() => { fetchTodo() }, [escenarioId, fechaVenta])

  async function fetchTodo() {
    setLoading(true)
    // La identidad + acceso + datos del escenario vienen de un cache
    // compartido (dura 3 minutos) — así no se repiten esas consultas cada
    // vez que se entra y sale de esta pestaña.
    const r = await obtenerAccesoEscenario(escenarioId)
    if (r.estado === 'sin_sesion') { navigate('/jugador/login'); return }
    if (r.estado === 'sin_rol') { navigate('/jugador'); return }
    if (r.estado === 'sin_acceso') { navigate('/escenario'); return }
    setSoloLectura(!!r.acceso.solo_lectura)
    setEncargado(r.encargado)
    setEscenario(r.escenario)

    // El orden de la vitrina se calcula solo de las ventas de los últimos 60
    // días — no es un campo que el encargado tenga que marcar a mano. Lo más
    // vendido queda de primero, sin pestañas ni que separar nada.
    const desde = new Date(); desde.setDate(desde.getDate() - 60)
    // Ninguna de estas cinco consultas depende de otra — se piden todas en
    // paralelo en vez de una detrás de otra para que la pantalla cargue
    // rápido (esto es lo que se usa para registrar ventas al momento).
    const [{ data: prods }, { data: cs }, { data: ventas }, { data: hoy }, { data: pend }] = await Promise.all([
      supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId).order('nombre'),
      supabase.from('escenario_canchas').select('*').eq('escenario_id', escenarioId).eq('activa', true).order('orden'),
      supabase.from('escenario_ventas').select('items').eq('escenario_id', escenarioId).eq('estado', 'completada').gte('fecha', fechaLocalStr(desde)),
      // Ventas del día que se está viendo (hoy por defecto, o el día al que
      // se retrocedió), para poder devolver alguna si el cliente trae algo
      // de vuelta — la más reciente de primero.
      supabase.from('escenario_ventas').select('*').eq('escenario_id', escenarioId).eq('fecha', fechaVenta).order('hora', { ascending: false }),
      // Deudas ("debe") sin pagar todavía — no se limitan a hoy, por si
      // alguien se quedó debiendo de otro día.
      supabase.from('escenario_ventas').select('*').eq('escenario_id', escenarioId).eq('pago_estado', 'pendiente').eq('estado', 'completada').order('created_at', { ascending: false }),
    ])
    setProductos(prods || [])
    setCanchas(cs || [])
    const conteo = {}
    ;(ventas || []).forEach(v => (v.items || []).forEach(it => { conteo[it.productId] = (conteo[it.productId] || 0) + it.cantidad }))
    setVentasPorProducto(conteo)
    setVentasHoy(hoy || [])
    setDeudas(pend || [])
    setLoading(false)
  }

  // Devuelve solo las unidades que se elijan por producto (puede ser parte
  // de la venta, ej. 1 de las 3 aguas que pidieron) — no toda la venta a la
  // fuerza. `cantidades` es { productId: unidadesADevolver }.
  async function devolverParcial(venta, cantidades) {
    const aDevolver = Object.entries(cantidades).filter(([,c]) => c > 0)
    if (aDevolver.length === 0) return

    await Promise.all(aDevolver.map(([productId, cant]) => {
      const p = getProduct(productId)
      return p ? supabase.from('escenario_productos').update({ cantidad: p.cantidad + cant }).eq('id', productId) : null
    }).filter(Boolean))

    const nuevosItems = (venta.items || [])
      .map(it => aDevolver.some(([pid]) => pid === it.productId) ? { ...it, cantidad: it.cantidad - (cantidades[it.productId] || 0) } : it)
      .filter(it => it.cantidad > 0)

    const nuevoTotal = nuevosItems.reduce((a,it)=>a+it.cantidad*it.precio,0)
    const nuevoCosto = nuevosItems.reduce((a,it)=>a+it.cantidad*it.costo,0)
    const quedaAlgo = nuevosItems.length > 0

    await supabase.from('escenario_ventas').update({
      items: nuevosItems, total: nuevoTotal, costo_total: nuevoCosto, ganancia: nuevoTotal - nuevoCosto,
      ...(quedaAlgo ? {} : { estado:'devuelta', devuelta_at: new Date().toISOString() }),
    }).eq('id', venta.id)

    const detalle = aDevolver.map(([pid,cant]) => `${cant}x ${getProduct(pid)?.nombre || (venta.items||[]).find(i=>i.productId===pid)?.nombre || '?'}`).join(', ')
    setMsg(quedaAlgo ? `↩️ Devueltos: ${detalle}` : '↩️ Venta devuelta completa — inventario repuesto')
    setTimeout(()=>setMsg(''),3000)
    registrarActividad(escenarioId, encargado, 'devolver', 'venta', `Devolvió ${detalle} de una venta`)
    fetchTodo()
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

  const finalizarVenta = conVentaUnica(async function finalizarVentaInner(fiado) {
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
    const payload = {
      escenario_id: escenario.id, fecha: fechaVenta,
      // Si es una venta de HOY se guarda la hora real; si es de un día
      // anterior (anotada del cuaderno) no tiene sentido ponerle la hora
      // actual — queda sin hora para no mentir el dato.
      hora: esHoy ? now.toTimeString().slice(0,5) : null,
      items, total, costo_total: costoTotal, ganancia: total-costoTotal,
    }
    if (fiado) {
      payload.pago_estado = 'pendiente'
      payload.deudor_nombre = fiado.nombre
      payload.deudor_cancha = fiado.cancha
    }
    const { error } = await supabase.from('escenario_ventas').insert(payload)
    if (error) { setMsg('Error al registrar venta: ' + error.message); return }
    await Promise.all(items.map(it => supabase.from('escenario_productos').update({ cantidad: getProduct(it.productId).cantidad - it.cantidad }).eq('id', it.productId)))
    setCart({})
    const sufijoFecha = esHoy ? '' : ` (${fmtDate(fechaVenta)})`
    if (fiado) {
      setMsg(`📝 Anotado: ${fiado.nombre} debe ${fmtMoney(total)}${sufijoFecha}`); setTimeout(()=>setMsg(''),4000)
      registrarActividad(escenarioId, encargado, 'crear', 'venta', `Anotó fiado a "${fiado.nombre}" (${fiado.cancha}) por ${fmtMoney(total)}${sufijoFecha}`)
    } else {
      setMsg(`✅ Venta registrada: ${fmtMoney(total)}${sufijoFecha}`); setTimeout(()=>setMsg(''),3000)
    }
    fetchTodo()
  })

  function abrirDebe() {
    setDeudorNombre(''); setDeudorCancha(''); setModalDebe(true)
  }

  function confirmarDebe() {
    if (!deudorNombre.trim() || !deudorCancha.trim()) return
    setModalDebe(false)
    finalizarVenta({ nombre: deudorNombre.trim(), cancha: deudorCancha.trim() })
  }

  async function marcarPagado(venta) {
    if (pagandoId) return // ya se está guardando otra — evita doble clic
    setPagandoId(venta.id)
    try {
      await supabase.from('escenario_ventas').update({ pago_estado:'pagado', pagado_at: new Date().toISOString() }).eq('id', venta.id)
      setMsg(`✅ ${venta.deudor_nombre} ya pagó ${fmtMoney(venta.total)}`); setTimeout(()=>setMsg(''),3000)
      registrarActividad(escenarioId, encargado, 'editar', 'venta', `Marcó como pagada la deuda de "${venta.deudor_nombre}" (${fmtMoney(venta.total)})`)
      await fetchTodo()
    } finally {
      setPagandoId(null)
    }
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
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom: items.length>0 ? '220px' : '40px', touchAction:'manipulation' }}>
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

        {/* Día para el que se registra/ve la venta — por defecto hoy, pero
            se puede retroceder para anotar lo que quedó en el cuaderno de
            un día anterior. */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom: esHoy ? '14px' : '8px' }}>
          <CalendarClock size={14} color={S.muted} style={{ flexShrink:0 }}/>
          <button onClick={()=>{ const d=new Date(fechaVenta+'T00:00:00'); d.setDate(d.getDate()-1); setFechaVenta(fechaLocalStr(d)) }}
            style={{ padding:'6px 10px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:S.text2, fontSize:'.72rem', fontWeight:700, flexShrink:0 }}>← Ayer</button>
          <input type="date" value={fechaVenta} max={todayStr()} onChange={e=>e.target.value && setFechaVenta(e.target.value)}
            style={{ flex:1, minWidth:0, background:S.card, border:`1px solid ${S.border}`, borderRadius:'8px', padding:'6px 8px', color:S.text, fontSize:'.72rem', outline:'none', colorScheme:'dark' }}/>
          {!esHoy && (
            <button onClick={()=>setFechaVenta(todayStr())}
              style={{ padding:'6px 10px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'8px', cursor:'pointer', color:S.cyan, fontSize:'.72rem', fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }}>Hoy</button>
          )}
        </div>
        {!esHoy && (
          <div style={{ background:'rgba(249,168,37,.1)', border:`1px solid ${S.gold}`, borderRadius:'10px', padding:'8px 12px', fontSize:'.75rem', color:S.gold, fontWeight:600, marginBottom:'14px', textAlign:'center' }}>
            📅 Estás registrando ventas del {fmtDate(fechaVenta)}, no de hoy.
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns: deudas.length>0 ? '1fr 1fr' : '1fr', gap:'8px', marginBottom:'14px' }}>
          <button onClick={()=>setMostrarHistorial(v=>!v)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background: mostrarHistorial ? S.cyanDim : S.card, border:`1px solid ${mostrarHistorial ? S.cyan : S.border}`, borderRadius:'10px', cursor:'pointer', color: mostrarHistorial ? S.cyan : S.text2, fontWeight:700, fontSize:'.74rem' }}>
            <History size={13}/> {esHoy ? 'Ventas de hoy' : `Ventas del ${fmtDate(fechaVenta)}`} {ventasHoy.length>0 ? `(${ventasHoy.length})` : ''}
          </button>
          {deudas.length > 0 && (
            <button onClick={()=>setMostrarDeudas(v=>!v)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background: mostrarDeudas ? 'rgba(249,168,37,.15)' : S.card, border:`1px solid ${mostrarDeudas ? S.gold : S.border}`, borderRadius:'10px', cursor:'pointer', color: mostrarDeudas ? S.gold : S.text2, fontWeight:700, fontSize:'.74rem' }}>
              <NotebookPen size={13}/> Deben ({deudas.length})
            </button>
          )}
        </div>

        {mostrarDeudas && deudas.length > 0 && (
          <div style={{ marginBottom:'16px' }}>
            {deudas.map(v => (
              <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 12px', background:'rgba(249,168,37,.08)', border:`1px solid ${S.gold}`, borderRadius:'10px', marginBottom:'8px' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'.82rem', fontWeight:800 }}>{v.deudor_nombre} <span style={{ fontWeight:600, color:S.muted }}>· {v.deudor_cancha}</span></div>
                  <div style={{ fontSize:'.76rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:S.text2 }}>{(v.items||[]).map(i=>i.cantidad+'x '+i.nombre).join(', ')}</div>
                  <div style={{ fontSize:'.82rem', fontWeight:800, color:S.gold }}>{fmtMoney(v.total)}</div>
                </div>
                {!soloLectura && (
                  <button onClick={()=>marcarPagado(v)} disabled={pagandoId===v.id} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 11px', background:'rgba(34,197,94,.15)', border:`1px solid ${S.green}`, borderRadius:'8px', cursor: pagandoId===v.id ? 'default' : 'pointer', opacity: pagandoId===v.id ? .6 : 1, color:S.green, fontWeight:700, fontSize:'.72rem', flexShrink:0, whiteSpace:'nowrap' }}>
                    <CheckCircle2 size={12}/> {pagandoId===v.id ? 'Guardando...' : 'Ya pagó'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {mostrarHistorial && (
          <div style={{ marginBottom:'16px' }}>
            {ventasHoy.length===0 ? (
              <div style={{ textAlign:'center', color:S.muted, fontSize:'.8rem', padding:'14px 0' }}>Todavía no hay ventas {esHoy ? 'hoy' : `el ${fmtDate(fechaVenta)}`}.</div>
            ) : ventasHoy.map(v => (
              <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 12px', background:S.card, border:`1px solid ${v.estado==='devuelta'?S.loss:S.border}`, borderRadius:'10px', marginBottom:'8px', opacity: v.estado==='devuelta' ? .55 : 1 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>{v.hora}</div>
                  <div style={{ fontSize:'.78rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{(v.items||[]).map(i=>i.cantidad+'x '+i.nombre).join(', ')}</div>
                  <div style={{ fontSize:'.82rem', fontWeight:800, color:S.gold }}>{fmtMoney(v.total)}</div>
                </div>
                {v.estado==='devuelta'
                  ? <span style={{ fontSize:'.7rem', fontWeight:700, color:S.loss, flexShrink:0 }}>Devuelta</span>
                  : !soloLectura && <button onClick={()=>setDevolviendo(v)} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 11px', background:'rgba(217,48,37,.12)', border:`1px solid ${S.loss}`, borderRadius:'8px', cursor:'pointer', color:S.loss, fontWeight:700, fontSize:'.72rem', flexShrink:0, whiteSpace:'nowrap' }}>
                      <RotateCcw size={12}/> Devolver
                    </button>}
              </div>
            ))}
          </div>
        )}

        <div style={{ position:'relative', marginBottom:'14px' }}>
          <Search size={15} color={S.muted} style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)' }}/>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar producto..."
            style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'11px 14px 11px 38px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }}/>
        </div>

        {productos.length>0 && (
          <div style={{ fontSize:'.7rem', color:S.muted, marginBottom:'10px', textAlign:'center' }}>
            {soloLectura ? '👁️ Modo solo lectura — no podés registrar ventas' : 'Toca dos veces un producto para agregarlo al carrito'}
          </div>
        )}

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
              <div key={p.id} onDoubleClick={soloLectura ? undefined : ()=>addToCart(p.id)}
                style={{ position:'relative', display:'flex', flexDirection:'column', background: p.cantidad<=p.stock_minimo ? 'rgba(217,48,37,.1)' : S.card, border:`1px solid ${p.cantidad<=p.stock_minimo?S.loss:S.border}`, borderRadius:'14px', overflow:'hidden', cursor:'pointer', touchAction:'manipulation', userSelect:'none' }}>
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
                  <span style={{ position:'absolute', bottom:'4px', left:'4px', zIndex:2, background: p.cantidad<=p.stock_minimo ? S.loss : 'rgba(0,0,0,.6)', color:'#fff', borderRadius:'6px', padding:'2px 6px', fontSize:'.65rem', fontWeight:800 }}>
                    {p.cantidad} und
                  </span>
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
            {!esHoy && (
              <div style={{ textAlign:'center', fontSize:'.72rem', color:S.gold, fontWeight:700, marginBottom:'8px' }}>📅 Se va a registrar con fecha {fmtDate(fechaVenta)}</div>
            )}
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={abrirDebe} disabled={enviandoVenta}
                style={{ flex:'0 0 auto', padding:'14px 16px', background:'none', border:`1.5px solid ${S.gold}`, borderRadius:'12px', cursor: enviandoVenta ? 'default' : 'pointer', opacity: enviandoVenta ? .6 : 1, color:S.gold, fontWeight:800, fontSize:'.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'7px' }}>
                <NotebookPen size={16}/> Debe
              </button>
              <button onClick={()=>finalizarVenta()} disabled={enviandoVenta}
                style={{ flex:1, padding:'14px', background:`linear-gradient(135deg, ${S.green}, ${S.greenDark})`, border:'none', borderRadius:'12px', cursor: enviandoVenta ? 'default' : 'pointer', opacity: enviandoVenta ? .7 : 1, color:'#fff', fontWeight:900, fontSize:'.92rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                <DollarSign size={17}/> {enviandoVenta ? 'Procesando...' : esHoy ? 'COBRAR' : `COBRAR (${fmtDate(fechaVenta)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalDebe && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'360px', maxWidth:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <div style={{ fontWeight:800, fontSize:'1rem' }}>📝 Anotar en cuenta</div>
              <button onClick={()=>setModalDebe(false)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
            </div>
            <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'16px' }}>Total: <span style={{ color:S.gold, fontWeight:800 }}>{fmtMoney(total)}</span> — para saber a quién cobrarle después</div>
            <div style={{ marginBottom:'12px' }}>
              <label style={{ fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }}>Nombre</label>
              <input value={deudorNombre} onChange={e=>setDeudorNombre(e.target.value)} autoFocus
                style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }} placeholder="¿Quién debe?"/>
            </div>
            <div style={{ marginBottom:'18px' }}>
              <label style={{ fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }}>Cancha en la que está jugando</label>
              <input value={deudorCancha} onChange={e=>setDeudorCancha(e.target.value)}
                style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }}
                placeholder="Ej: Cancha 1" list="canchas-debe"/>
              <datalist id="canchas-debe">{canchas.map(c => <option key={c.id} value={c.nombre}/>)}</datalist>
            </div>
            <button onClick={confirmarDebe} disabled={!deudorNombre.trim() || !deudorCancha.trim() || enviandoVenta}
              style={{ width:'100%', padding:'13px', background:S.gold, border:'none', borderRadius:'12px', cursor:'pointer', color:'#1a1300', fontWeight:800, fontSize:'.88rem', opacity: (!deudorNombre.trim() || !deudorCancha.trim()) ? .5 : 1 }}>
              Anotar deuda
            </button>
          </div>
        </div>
      )}

      {devolviendo && (
        <ModalDevolucion venta={devolviendo} onClose={()=>setDevolviendo(null)}
          onConfirmar={async (cantidades) => { const v = devolviendo; setDevolviendo(null); await devolverParcial(v, cantidades) }}/>
      )}
    </div>
  )
}
