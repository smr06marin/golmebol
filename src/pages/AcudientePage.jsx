import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TarjetaEscuelaJugador from '../components/TarjetaEscuelaJugador'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

export default function AcudientePage() {
  const navigate = useNavigate()
  const [acudiente, setAcudiente] = useState(null)
  const [hijos, setHijos] = useState([]) // [{ jugador, escuelaNombre, premios }]
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador/login'); return }
    if (!p.es_acudiente) { navigate('/jugador'); return }
    setAcudiente(p)

    const { data: vinculos } = await supabase.from('escuela_acudientes').select('*, jugador:jugador_id(*)').eq('acudiente_id', p.id)
    const lista = []
    for (const v of vinculos || []) {
      const jugador = v.jugador
      if (!jugador) continue
      const { data: tp } = await supabase.from('team_players').select('team_id, teams(name, categoria)').eq('player_id', jugador.id).maybeSingle()
      const escuelaId = tp?.team_id
      let premios = []
      if (escuelaId) {
        const { data: prem } = await supabase.from('escuela_premios').select('*').eq('escuela_id', escuelaId).order('umbral', { ascending:true })
        premios = prem || []
      }
      const { data: premTorneo } = await supabase.from('escuela_torneo_premios').select('*, torneo:torneo_id(nombre)').eq('jugador_id', jugador.id).order('created_at', { ascending:false })
      lista.push({ jugador, escuelaNombre: tp?.teams?.name || '', premios, premiosTorneo: premTorneo || [] })
    }
    setHijos(lista)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!acudiente) return null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'600px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em' }}>👪 Acudiente · Golmebol</div>
            <div style={{ fontWeight:'800', fontSize:'1.1rem' }}>{acudiente.name}</div>
          </div>
          <button onClick={handleLogout} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'7px 14px', cursor:'pointer', color:S.muted, fontSize:'.78rem', fontWeight:'600' }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'20px 16px' }}>
        {hijos.length === 0 ? (
          <div style={{ textAlign:'center', padding:'50px 20px', color:S.muted }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>👦</div>
            <div style={{ fontSize:'.85rem' }}>Todavía no hay jugadores vinculados a tu cuenta.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {hijos.map(({ jugador, escuelaNombre, premios, premiosTorneo }) => (
              <div key={jugador.id}>
                {escuelaNombre && <div style={{ fontSize:'.72rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8, textAlign:'center' }}>{escuelaNombre}</div>}
                <TarjetaEscuelaJugador jugador={jugador} premios={premios} premiosTorneo={premiosTorneo}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
