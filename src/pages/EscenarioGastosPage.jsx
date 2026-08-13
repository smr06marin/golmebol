import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtMoney, todayStr, fmtDate, CATEGORIAS_GASTO, registrarActividad } from '../lib/escenarioHelpers'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }

function horaAhora() { return new Date().toTimeString().slice(0, 5) }

export default function EscenarioGastosPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [encargado, setEncargado] = useState(null)
  const [gastos,    setGastos]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState('')

  const [categoria,   setCategoria]   = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [monto,       setMonto]       = useState('')
  const [fecha,       setFecha]       = useState(todayStr())

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
    const { data: gs } = await supabase.from('escenario_gastos').select('*').eq('escenario_id', escenarioId)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false })
    setGastos(gs || [])
    setLoading(false)
  }

  async function registrarGasto() {
    const montoNum = Number(monto) || 0
    if (!descripcion.trim() || montoNum <= 0) { setMsg('Escribe qué fue y un monto válido'); setTimeout(()=>setMsg(''),3000); return }
    const { error } = await supabase.from('escenario_gastos').insert({
      escenario_id: escenario.id, categoria: categoria.trim() || 'Otro', descripcion: descripcion.trim(),
      monto: montoNum, fecha, hora: horaAhora(),
    })
    if (error) { setMsg('❌ ' + error.message); setTimeout(()=>setMsg(''),5000); return }
    registrarActividad(escenarioId, encargado, 'crear', 'gasto', `Registró un gasto de ${fmtMoney(montoNum)}: ${descripcion.trim()}`)
    setMsg(`✅ Gasto registrado: ${fmtMoney(montoNum)}`); setTimeout(()=>setMsg(''),3000)
    setCategoria(''); setDescripcion(''); setMonto('')
    fetchTodo()
  }

  async function eliminarGasto(g) {
    if (!confirm(`¿Eliminar el gasto "${g.descripcion}" (${fmtMoney(g.monto)})?`)) return
    await supabase.from('escenario_gastos').delete().eq('id', g.id)
    setMsg('Gasto eliminado'); setTimeout(()=>setMsg(''),3000)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const totalMes = gastos.filter(g => g.fecha?.slice(0,7) === todayStr().slice(0,7)).reduce((a,g)=>a+Number(g.monto||0),0)

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>💸 Gastos</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {msg && <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>}

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', marginBottom:'14px', textAlign:'center' }}>
          <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'4px' }}>Gastos de este mes</div>
          <div style={{ fontWeight:900, fontSize:'1.4rem', color:S.loss }}>{fmtMoney(totalMes)}</div>
        </div>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'12px' }}>Agregar gasto</div>
          <div style={{ marginBottom:'10px' }}>
            <label style={lbl}>Categoría</label>
            <input value={categoria} onChange={e=>setCategoria(e.target.value)} style={inp} placeholder="Ej: Servicios" list="categorias-gasto"/>
            <datalist id="categorias-gasto">{CATEGORIAS_GASTO.map(c => <option key={c} value={c}/>)}</datalist>
          </div>
          <div style={{ marginBottom:'10px' }}><label style={lbl}>¿Qué fue?</label><input value={descripcion} onChange={e=>setDescripcion(e.target.value)} style={inp} placeholder="Ej: Recibo de luz de julio"/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
            <div><label style={lbl}>Monto</label><input type="number" value={monto} onChange={e=>setMonto(e.target.value)} style={inp} placeholder="$"/></div>
            <div><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/></div>
          </div>
          <button onClick={registrarGasto} style={{ width:'100%', padding:'12px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem' }}>Registrar gasto</button>
        </div>

        <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:'10px' }}>Historial de gastos</div>
        {gastos.length===0 ? <div style={{ color:S.muted, fontSize:'.8rem' }}>Sin gastos registrados.</div> : gastos.map(g => (
          <div key={g.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:`1px solid ${S.border}`, fontSize:'.8rem' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div>{fmtDate(g.fecha)}{g.hora ? ` · ${g.hora}` : ''} · {g.descripcion}</div>
              {g.categoria && <div style={{ fontSize:'.7rem', color:S.muted }}>{g.categoria}</div>}
            </div>
            <span style={{ fontWeight:700, color:S.loss }}>{fmtMoney(g.monto)}</span>
            <button onClick={()=>eliminarGasto(g)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:'.9rem', flexShrink:0 }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
