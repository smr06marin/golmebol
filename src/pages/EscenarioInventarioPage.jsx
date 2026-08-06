import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, prepararFotoProducto, CATEGORIAS_PRODUCTO, registrarActividad } from '../lib/escenarioHelpers'
import { Plus, X, Package, Camera, Wand2 } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }

const EMPTY = { emoji:'📦', nombre:'', categoria:'', costo:0, precio:0, cantidad:0, stock_minimo:5, foto_url:null }

function ModalProducto({ producto, escenarioId, onClose, onGuardar, onEliminar }) {
  const [f, setF] = useState(producto || EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [quitarFondo, setQuitarFondo] = useState(true)

  async function handleFoto(file) {
    if (!file) return
    setSubiendoFoto(true)
    try {
      const procesada = await prepararFotoProducto(file, { maxDim: 500, quitarFondo })
      const ext = quitarFondo ? 'png' : 'jpg'
      const path = `productos/${escenarioId}/${f.id || Date.now()}.${ext}`
      const { error } = await supabase.storage.from('teams').upload(path, procesada, { upsert: true, contentType: quitarFondo ? 'image/png' : 'image/jpeg' })
      if (!error) {
        const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
        setF(p => ({ ...p, foto_url: urlData.publicUrl + '?t=' + Date.now() }))
      }
    } catch (e) { /* si falla, la persona puede reintentar tocando la foto de nuevo */ }
    setSubiendoFoto(false)
  }

  async function guardar() {
    setGuardando(true)
    await onGuardar({ ...f, costo:Number(f.costo)||0, precio:Number(f.precio)||0, cantidad:parseInt(f.cantidad)||0, stock_minimo:parseInt(f.stock_minimo)||0 })
    setGuardando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'380px', maxWidth:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'1rem' }}>{producto?.id ? 'Editar' : 'Nuevo'} producto</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', gap:'12px', marginBottom:'8px', alignItems:'center' }}>
          <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleFoto(e.target.files[0])}/>
            <div style={{
              width:'60px', height:'60px', borderRadius:'12px', overflow:'hidden', border:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'center',
              background: f.foto_url ? 'repeating-conic-gradient(#22303f 0% 25%, #1a2234 0% 50%) 50% / 12px 12px' : S.card2,
            }}>
              {subiendoFoto ? <div style={{ fontSize:'.6rem', color:S.muted }}>...</div>
                : f.foto_url ? <img src={f.foto_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
                : <Package size={22} color={S.muted}/>}
            </div>
            <div style={{ position:'absolute', bottom:'-3px', right:'-3px', width:'20px', height:'20px', background:S.cyan, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Camera size={11} color="#000"/>
            </div>
          </label>
          <div style={{ flex:1 }}><label style={lbl}>Nombre</label><input value={f.nombre} onChange={e=>setF(p=>({...p,nombre:e.target.value}))} style={inp} placeholder="Nombre del producto"/></div>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'.76rem', color:S.text2, marginBottom:'14px', cursor:'pointer' }}>
          <input type="checkbox" checked={quitarFondo} onChange={e=>setQuitarFondo(e.target.checked)}/>
          <Wand2 size={13} color={S.cyan}/> Quitar el fondo automáticamente al subir la foto
        </label>
        <div style={{ marginBottom:'12px' }}>
          <label style={lbl}>Categoría</label>
          <input value={f.categoria||''} onChange={e=>setF(p=>({...p,categoria:e.target.value}))} style={inp} placeholder="Ej: Bebidas" list="categorias-producto"/>
          <datalist id="categorias-producto">{CATEGORIAS_PRODUCTO.map(c => <option key={c} value={c}/>)}</datalist>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
          <div><label style={lbl}>Precio de compra</label><input type="number" value={f.costo} onChange={e=>setF(p=>({...p,costo:e.target.value}))} style={inp}/></div>
          <div><label style={lbl}>Precio de venta</label><input type="number" value={f.precio} onChange={e=>setF(p=>({...p,precio:e.target.value}))} style={inp}/></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'18px' }}>
          <div><label style={lbl}>Cantidad disponible</label><input type="number" value={f.cantidad} onChange={e=>setF(p=>({...p,cantidad:e.target.value}))} style={inp}/></div>
          <div><label style={lbl}>Stock mínimo</label><input type="number" value={f.stock_minimo} onChange={e=>setF(p=>({...p,stock_minimo:e.target.value}))} style={inp}/></div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={guardar} disabled={guardando} style={{ flex:1, padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem', opacity:guardando?.7:1 }}>{guardando?'Guardando...':'Guardar'}</button>
          {producto?.id && <button onClick={()=>onEliminar(producto)} style={{ padding:'12px 16px', background:'none', border:`1px solid ${S.loss}`, borderRadius:'10px', cursor:'pointer', color:S.loss, fontSize:'.85rem' }}>Eliminar</button>}
        </div>
      </div>
    </div>
  )
}

export default function EscenarioInventarioPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [encargado, setEncargado] = useState(null)
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null) // null | {} (nuevo) | producto (editar)
  const [msg,       setMsg]       = useState('')

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
    setLoading(false)
  }

  async function guardarProducto(data) {
    const esNuevo = !data.id
    const original = data.id ? productos.find(p => p.id === data.id) : null

    const intentar = (payload) => data.id
      ? supabase.from('escenario_productos').update(payload).eq('id', data.id)
      : supabase.from('escenario_productos').insert({ ...payload, escenario_id: escenario.id })

    const { id, escenario_id, created_at, ...payload } = data
    let { error } = await intentar(payload)
    // Si faltan correr las migraciones de foto_url o categoria, se
    // reintenta sin esos campos en vez de perder todo el cambio.
    const camposOmitidos = []
    let restante = payload
    while (error && /Could not find the .* column/.test(error.message || '')) {
      const m = error.message.match(/Could not find the '(\w+)' column/)
      if (!m || !(m[1] in restante)) break
      const { [m[1]]: _omitido, ...sinCampo } = restante
      restante = sinCampo
      camposOmitidos.push(m[1])
      ;({ error } = await intentar(restante))
    }
    if (error) { setMsg('❌ ' + error.message); setTimeout(()=>setMsg(''),5000); return }
    setModal(null)
    setMsg(camposOmitidos.length ? `⚠️ Guardado, pero falta correr una migración para: ${camposOmitidos.join(', ')}` : '✅ Producto guardado')
    setTimeout(()=>setMsg(''),4000)

    if (esNuevo) {
      registrarActividad(escenarioId, encargado, 'crear', 'producto', `Agregó el producto "${data.nombre}" (precio ${fmtMoney(data.precio)})`)
    } else if (original) {
      const cambios = []
      if (Number(original.precio) !== Number(data.precio)) cambios.push(`precio de ${fmtMoney(original.precio)} a ${fmtMoney(data.precio)}`)
      if (Number(original.costo) !== Number(data.costo)) cambios.push(`precio de compra de ${fmtMoney(original.costo)} a ${fmtMoney(data.costo)}`)
      if (original.nombre !== data.nombre) cambios.push(`nombre de "${original.nombre}" a "${data.nombre}"`)
      if (Number(original.cantidad) !== Number(data.cantidad)) cambios.push(`cantidad de ${original.cantidad} a ${data.cantidad}`)
      if (cambios.length > 0) {
        registrarActividad(escenarioId, encargado, 'editar', 'producto', `Editó "${data.nombre}": cambió ${cambios.join(', ')}`)
      }
    }
    fetchTodo()
  }
  async function eliminarProducto(p) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    await supabase.from('escenario_productos').delete().eq('id', p.id)
    setModal(null); setMsg('Producto eliminado'); setTimeout(()=>setMsg(''),3000)
    registrarActividad(escenarioId, encargado, 'eliminar', 'producto', `Eliminó el producto "${p.nombre}" (precio ${fmtMoney(p.precio)})`)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {modal && <ModalProducto producto={modal.id ? modal : null} escenarioId={escenarioId} onClose={()=>setModal(null)} onGuardar={guardarProducto} onEliminar={eliminarProducto}/>}

      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
            <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>📦 Inventario</div>
            <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
          </div>
          <button onClick={()=>setModal({})} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 14px', background:S.cyan, border:'none', borderRadius:'8px', cursor:'pointer', color:'#000', fontWeight:700, fontSize:'.78rem' }}><Plus size={14}/> Agregar</button>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        {productos.length===0 ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'40px 0' }}>
            <Package size={32} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>Sin productos todavía.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {productos.map(p => (
              <button key={p.id} onClick={()=>setModal(p)}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background: p.cantidad<=p.stock_minimo ? 'rgba(217,48,37,.1)' : S.card, border:`1px solid ${p.cantidad<=p.stock_minimo?S.loss:S.border}`, borderRadius:'12px', cursor:'pointer', color:S.text, textAlign:'left' }}>
                {p.foto_url
                  ? <div style={{ width:'36px', height:'36px', borderRadius:'8px', overflow:'hidden', flexShrink:0, background:S.card2 }}><img src={p.foto_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/></div>
                  : <span style={{ fontSize:'1.4rem' }}>{p.emoji || '📦'}</span>}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.85rem' }}>{p.nombre}{p.categoria && <span style={{ fontWeight:600, fontSize:'.66rem', color:S.muted }}> · {p.categoria}</span>}</div>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>Compra {fmtMoney(p.costo)} · Venta {fmtMoney(p.precio)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:800, fontSize:'.9rem', color: p.cantidad<=p.stock_minimo?S.loss:S.cyan }}>{p.cantidad}</div>
                  <div style={{ fontSize:'.65rem', color:S.muted }}>und. (mín {p.stock_minimo})</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
