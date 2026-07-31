import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, fmtDate, todayStr } from '../lib/escenarioHelpers'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }

export default function EscenarioCierrePage() {
  const navigate = useNavigate()
  const [escenario, setEscenario] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [fecha,     setFecha]     = useState(todayStr())
  const [ventas,    setVentas]    = useState([])

  useEffect(() => { fetchEscenario() }, [])
  useEffect(() => { if (escenario) fetchVentas() }, [fecha, escenario])

  async function fetchEscenario() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario || !p.escenario_id) { navigate('/escenario'); return }
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', p.escenario_id).single()
    setEscenario(esc || null)
    setLoading(false)
  }

  async function fetchVentas() {
    const { data } = await supabase.from('escenario_ventas').select('*').eq('escenario_id', escenario.id).eq('fecha', fecha)
    setVentas(data || [])
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const totalVentas = ventas.reduce((a,v)=>a+Number(v.total||0),0)
  const costoTotal = ventas.reduce((a,v)=>a+Number(v.costo_total||0),0)
  const ganancia = totalVentas - costoTotal
  const productosVendidos = ventas.reduce((a,v)=>a+(v.items||[]).reduce((b,i)=>b+i.cantidad,0),0)

  const stat = { background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px', textAlign:'center' }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <style>{`@media print { .no-print { display:none !important } body * { visibility:hidden } #print-area, #print-area * { visibility:visible } #print-area { position:absolute; left:0; top:0; width:100% } }`}</style>

      <div className="no-print" style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>🧾 Cierre diario</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        <div className="no-print" style={{ marginBottom:'16px' }}>
          <label style={{ fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase' }}>Fecha del cierre</label>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/>
        </div>

        <div id="print-area" style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'18px' }}>
          <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:'14px' }}>🧾 Cierre diario — {fmtDate(fecha)}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Ventas del día</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.cyan }}>{fmtMoney(totalVentas)}</div></div>
            <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Costo de productos vendidos</div><div style={{ fontWeight:900, fontSize:'1.1rem' }}>{fmtMoney(costoTotal)}</div></div>
            <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Ganancia</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.gold }}>{fmtMoney(ganancia)}</div></div>
            <div style={stat}><div style={{ fontSize:'.68rem', color:S.muted }}>Productos vendidos</div><div style={{ fontWeight:900, fontSize:'1.1rem' }}>{productosVendidos}</div></div>
            <div style={{...stat, gridColumn:'1/-1'}}><div style={{ fontSize:'.68rem', color:S.muted }}>Caja esperada</div><div style={{ fontWeight:900, fontSize:'1.1rem', color:S.cyan }}>{fmtMoney(totalVentas)}</div></div>
          </div>
        </div>

        <button className="no-print" onClick={()=>window.print()} style={{ width:'100%', padding:'13px', marginTop:'16px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.9rem' }}>Generar / imprimir PDF del cierre</button>
        <div className="no-print" style={{ fontSize:'.72rem', color:S.muted, marginTop:'8px', textAlign:'center' }}>Se abre el diálogo de impresión del navegador — elige "Guardar como PDF".</div>
      </div>
    </div>
  )
}
