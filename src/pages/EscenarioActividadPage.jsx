import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/escenarioHelpers'
import { fmtHoraDate } from '../lib/horaHelpers'
import { PlusCircle, Pencil, Trash2, RotateCcw, History } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025',
  win: '#22c55e',
}

const ICONO = { crear: PlusCircle, editar: Pencil, eliminar: Trash2, devolver: RotateCcw }
const COLOR = { crear: S.win, editar: S.gold, eliminar: S.loss, devolver: S.loss }

// Agrupa por fecha (Hoy / Ayer / fecha) para que el historial sea fácil de
// leer en vez de una lista plana sin fin.
function etiquetaDia(fecha) {
  const hoy = new Date().toISOString().slice(0,10)
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0,10)
  if (fecha === hoy) return 'Hoy'
  if (fecha === ayer) return 'Ayer'
  return fmtDate(fecha)
}

export default function EscenarioActividadPage() {
  const navigate = useNavigate()
  const { escenarioId } = useParams()
  const [escenario, setEscenario] = useState(null)
  const [actividad, setActividad] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)

  useEffect(() => { fetchTodo() }, [escenarioId])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    const { data: acceso } = await supabase.from('escenario_encargados').select('id').eq('escenario_id', escenarioId).eq('player_id', p.id).maybeSingle()
    if (!acceso) { navigate('/escenario'); return }
    const { data: esc } = await supabase.from('escenarios').select('*').eq('id', escenarioId).single()
    setEscenario(esc || null)
    const { data, error: err } = await supabase.from('escenario_actividad').select('*').eq('escenario_id', escenarioId).order('created_at', { ascending: false }).limit(300)
    if (err) setError(true)
    setActividad(data || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  // Agrupar por día (created_at ya viene en orden descendente)
  const grupos = []
  actividad.forEach(a => {
    const dia = (a.created_at || '').slice(0,10)
    let g = grupos.find(x => x.dia === dia)
    if (!g) { g = { dia, items: [] }; grupos.push(g) }
    g.items.push(a)
  })

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escenario/'+escenarioId)} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escenario</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem', display:'flex', alignItems:'center', gap:'8px' }}><History size={18} color={S.cyan}/> Actividad</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escenario?.name} · quién hizo cada cambio</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>
        {error && (
          <div style={{ background:'rgba(217,48,37,.1)', border:`1px solid ${S.loss}`, color:S.loss, borderRadius:10, padding:'12px 14px', fontSize:'.78rem', marginBottom:16 }}>
            Todavía no está lista esta sección — falta correr <code>migracion_escenario_actividad.sql</code> en la base de datos.
          </div>
        )}

        {grupos.length === 0 && !error ? (
          <div style={{ textAlign:'center', color:S.muted, padding:'40px 0' }}>
            <History size={32} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>Todavía no hay movimientos registrados.</div>
          </div>
        ) : grupos.map(g => (
          <div key={g.dia} style={{ marginBottom:'20px' }}>
            <div style={{ fontSize:'.7rem', fontWeight:800, color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>{etiquetaDia(g.dia)}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {g.items.map(a => {
                const Icono = ICONO[a.accion] || Pencil
                const color = COLOR[a.accion] || S.muted
                return (
                  <div key={a.id} style={{ display:'flex', gap:'10px', padding:'12px 14px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px' }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icono size={15} color={color}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'.83rem', lineHeight:1.4 }}>{a.descripcion}</div>
                      <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'2px' }}>{a.player_nombre || 'Alguien'} · {fmtHoraDate(a.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
