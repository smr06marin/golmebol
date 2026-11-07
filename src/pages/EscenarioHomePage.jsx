import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EncabezadoEscenario, G } from '../components/EscenarioUI'
import { Building2, ChevronRight, Hourglass } from 'lucide-react'

// Mismo look que el resto de Golmebol: negro, tarjetas planas, acento verde.
const S = { navy: G.bg, card: G.card, card2: G.card2, border: G.border, cyan: G.green, gold: G.gold, text: G.text, muted: G.muted }

// Selector de escenario: un mismo encargado puede tener varios escenarios
// asignados (por el admin, en /admin/escenarios). Si tiene uno solo entra
// directo a su panel; si tiene varios, elige acá cuál administrar.
export default function EscenarioHomePage() {
  const navigate = useNavigate()
  const [encargado,  setEncargado]  = useState(null)
  const [escenarios, setEscenarios] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null // sesión del propio teléfono: getUser() iba a la red en cada entrada
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_encargado_escenario) { navigate('/jugador'); return }
    setEncargado(p)

    const { data: asignaciones } = await supabase.from('escenario_encargados').select('escenarios(*)').eq('player_id', p.id)
    const lista = (asignaciones || []).map(a => a.escenarios).filter(Boolean)
    setEscenarios(lista)

    if (lista.length === 1) { navigate(`/escenario/${lista[0].id}`, { replace: true }); return }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!encargado) return null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <EncabezadoEscenario nombre="Tus escenarios" rol={`Encargado · ${encargado.name?.split(' ')[0] || ''}`}
        usuario={encargado} onLogout={handleLogout}/>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'20px 16px' }}>
        {escenarios.length === 0 ? (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', textAlign:'center' }}>
            <div style={{ marginBottom:'8px' }}><Hourglass size={28} color={S.muted}/></div>
            <div style={{ fontSize:'.85rem', color:S.muted }}>Todavía no tienes ningún escenario asignado. Pídele al administrador de Golmebol que te asigne uno.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:900, color:S.text, margin:'4px 0 2px' }}>Hola, {encargado.name?.split(' ')[0]}</div>
            <div style={{ fontSize:'.9rem', color:S.muted, marginBottom:'6px' }}>Toca el escenario que quieres manejar</div>
            {escenarios.map(e => (
              <button key={e.id} onClick={() => navigate(`/escenario/${e.id}`)}
                style={{ display:'flex', alignItems:'center', gap:'12px', width:'100%', minHeight:'72px', padding:'14px 16px', boxSizing:'border-box', background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', cursor:'pointer', color:S.text, textAlign:'left', fontFamily:'inherit' }}>
                <div style={{ width:'48px', height:'48px', borderRadius:'12px', overflow:'hidden', background:S.card2, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {e.logo_url ? <img src={e.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Building2 size={18} color={S.cyan}/>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:'1rem' }}>{e.name}</div>
                  <div style={{ fontSize:'.8rem', color:S.muted, marginTop:2 }}>{e.city || 'Sin ciudad'}</div>
                </div>
                <ChevronRight size={20} color={S.muted}/>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
