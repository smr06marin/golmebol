import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PortalBanner from '../components/PortalBanner'
import { Building2, ArrowRight, Hourglass } from 'lucide-react'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

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
    const { data: { user } } = await supabase.auth.getUser()
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
      <PortalBanner theme="dark" sticky
        avatarEmoji={<Building2 size={22}/>} avatarShape="rounded"
        kicker={<span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><Building2 size={11}/> Escenarios deportivos</span>}
        title="Tus escenarios"
        subtitle={<span>🏟️ Encargado · {encargado.name?.split(' ')[0]}</span>}
        subtitleColor={S.gold}
        usuario={encargado} actual="escenario" onLogout={handleLogout}
      />

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'20px 16px' }}>
        {escenarios.length === 0 ? (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', textAlign:'center' }}>
            <div style={{ marginBottom:'8px' }}><Hourglass size={28} color={S.muted}/></div>
            <div style={{ fontSize:'.85rem', color:S.muted }}>Todavía no tenés ningún escenario asignado. Avisale al admin de Golmebol para que te asigne uno desde /admin/escenarios.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'2px' }}>Elegí cuál escenario querés administrar:</div>
            {escenarios.map(e => (
              <button key={e.id} onClick={() => navigate(`/escenario/${e.id}`)}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'16px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', cursor:'pointer', color:S.text, textAlign:'left' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'10px', overflow:'hidden', background:S.card2, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {e.logo_url ? <img src={e.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Building2 size={18} color={S.cyan}/>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'700', fontSize:'.9rem' }}>{e.name}</div>
                  <div style={{ fontSize:'.72rem', color:S.muted }}>{e.city || 'Sin ciudad'}</div>
                </div>
                <ArrowRight size={15} color={S.muted}/>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
