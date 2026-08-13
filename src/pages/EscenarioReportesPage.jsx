import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, fechaLocalStr } from '../lib/escenarioHelpers'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const card = { background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', marginBottom:'14px' }
const rowItem = { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:`1px solid ${S.border}` }

function rangoPeriodo(periodo) {
  const d = new Date()
  if (periodo === 'semana') d.setDate(d.getDate() - 7)
  else if (periodo === 'mes') d.setMonth(d.getMonth() - 1)
  else d.setFullYear(d.getFullYear() - 1)
  return fechaLocalStr(d)
}

export default function EscenarioReportesPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [productos, setProductos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [periodo,   setPeriodo]   = useState('semana')
  const [ventas,    setVentas]    = useState([])
  const [compras,   setCompras]   = useState([])

  useEffect(() => { fetchEscenario() }, [escenarioId])
  useEffect(() => { if (escenario) fetchVentas() }, [periodo, escenario])

  async function fetchEscenario() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    const { data: prods } = await supabase.from('escenario_productos').select('*').eq('escenario_id', escenarioId)
    setProductos(prods || [])
    setLoading(false)
  }

  async function fetchVentas() {
    const desde = rangoPeriodo(periodo)
    const { data } = await supabase.from('escenario_ventas').select('*').eq('escenario_id', escenario.id).eq('estado', 'completada').gte('fecha', desde)
    setVentas(data || [])
    const { data: comp } = await supabase.from('escenario_compras').select('*').eq('escenario_id', escenario.id).gte('fecha', desde).order('fecha', { ascending: false })
    setCompras(comp || [])
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const porProducto = {}
  ventas.forEach(v => (v.items||[]).forEach(it => {
    porProducto[it.productId] = porProducto[it.productId] || { nombre: it.nombre, cantidad:0, ganancia:0 }
    porProducto[it.productId].cantidad += it.cantidad
    porProducto[it.productId].ganancia += (it.precio - it.costo) * it.cantidad
  }))
  const lista = Object.values(porProducto).sort((a,b)=>b.cantidad-a.cantidad)
  const masVendidos = lista.slice(0,5)
  const menorRotacion = productos.map(p => ({ nombre:p.nombre, cantidad: porProducto[p.id]?.cantidad || 0 })).sort((a,b)=>a.cantidad-b.cantidad).slice(0,5)
  const gananciaTotal = ventas.reduce((a,v)=>a+Number(v.ganancia||0),0)

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>📈 Reportes</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
          {['semana','mes','año'].map(p => (
            <button key={p} onClick={()=>setPeriodo(p)}
              style={{ flex:1, padding:'9px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:700, fontSize:'.78rem', background: periodo===p?S.cyan:S.card, color: periodo===p?'#000':S.muted }}>
              Por {p}
            </button>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'4px' }}>Ganancia total del periodo</div>
          <div style={{ fontWeight:900, fontSize:'1.6rem', color:S.gold }}>{fmtMoney(gananciaTotal)}</div>
        </div>

        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Productos más vendidos</div>
          {masVendidos.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin ventas en este periodo.</div> : masVendidos.map((p,i) => (
            <div key={i} style={rowItem}><span style={{fontSize:'.82rem'}}>{p.nombre}</span><span style={{fontSize:'.82rem', fontWeight:700, color:S.cyan}}>{p.cantidad} und</span></div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Productos con menor rotación</div>
          {menorRotacion.map((p,i) => (
            <div key={i} style={rowItem}><span style={{fontSize:'.82rem'}}>{p.nombre}</span><span style={{fontSize:'.82rem', fontWeight:700}}>{p.cantidad} und</span></div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Ganancia por producto</div>
          {lista.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin datos.</div> : lista.map((p,i) => (
            <div key={i} style={rowItem}><span style={{fontSize:'.82rem'}}>{p.nombre}</span><span style={{fontSize:'.82rem', fontWeight:700, color:S.gold}}>{fmtMoney(p.ganancia)}</span></div>
          ))}
        </div>

        <div style={{...card, marginBottom:0}}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Compras y facturas del periodo</div>
          {compras.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin compras registradas en este periodo.</div> : compras.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:`1px solid ${S.border}` }}>
              {c.factura_foto_url
                ? <a href={c.factura_foto_url} target="_blank" rel="noreferrer" style={{ flexShrink:0 }}>
                    <img src={c.factura_foto_url} style={{ width:'34px', height:'34px', borderRadius:'8px', objectFit:'cover', border:`1px solid ${S.border}` }}/>
                  </a>
                : <div style={{ width:'34px', height:'34px', borderRadius:'8px', flexShrink:0, background:S.card2 }}/>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'.82rem' }}>{c.nombre} x{c.cantidad}</div>
                <div style={{ fontSize:'.68rem', color:S.muted }}>{c.fecha}{c.hora ? ` · ${c.hora}` : ''} · {c.proveedor}</div>
              </div>
              {c.factura_total ? <div style={{ fontSize:'.82rem', fontWeight:700, color:S.gold }}>{fmtMoney(c.factura_total)}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
