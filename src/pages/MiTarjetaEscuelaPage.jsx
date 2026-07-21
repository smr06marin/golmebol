import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TarjetaEscuelaJugador from '../components/TarjetaEscuelaJugador'
import FichaEvolucion from '../components/FichaEvolucion'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

// Portal del jugador de escuela (el niño/a) cuando entra con su propia
// tarjeta de identidad — ve su propia tarjeta, en modo solo lectura.
export default function MiTarjetaEscuelaPage() {
  const navigate = useNavigate()
  const [jugador, setJugador] = useState(null)
  const [escuelaNombre, setEscuelaNombre] = useState('')
  const [premios, setPremios] = useState([])
  const [premiosTorneo, setPremiosTorneo] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCuenta, setErrorCuenta] = useState(false)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    // maybeSingle (no single): si por algún motivo hay más de una fila o
    // ninguna con este user_id, no explota — se muestra un aviso en vez de
    // devolver en silencio a la pantalla de la cédula.
    const { data: p, error: errP } = await supabase.from('players').select('*').eq('user_id', user.id).maybeSingle()
    if (errP || !p) { setLoading(false); setErrorCuenta(true); return }
    if (!p.es_jugador_escuela) { navigate('/jugador'); return }
    setJugador(p)

    const { data: tp } = await supabase.from('team_players').select('team_id, teams(name, categoria)').eq('player_id', p.id).maybeSingle()
    setEscuelaNombre(tp?.teams?.name || '')
    const escuelaId = tp?.team_id
    if (escuelaId) {
      const { data: prem } = await supabase.from('escuela_premios').select('*').eq('escuela_id', escuelaId).order('umbral', { ascending:true })
      setPremios(prem || [])
    }
    const { data: premTorneo } = await supabase.from('escuela_torneo_premios').select('*, torneo:torneo_id(nombre)').eq('jugador_id', p.id).order('created_at', { ascending:false })
    setPremiosTorneo(premTorneo || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (errorCuenta) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ maxWidth:'380px', textAlign:'center', color:S.text }}>
        <div style={{ fontSize:'2.2rem', marginBottom:'10px' }}>⚠️</div>
        <div style={{ fontWeight:'700', marginBottom:'8px' }}>No pudimos cargar tu tarjeta</div>
        <div style={{ fontSize:'.85rem', color:S.text2, marginBottom:'20px', lineHeight:1.5 }}>
          Tu cuenta no quedó bien vinculada. Escríbenos por WhatsApp con tu número de documento para arreglarlo.
        </div>
        <a href={`https://wa.me/573226490055?text=${encodeURIComponent('Hola, no puedo ver mi tarjeta de jugador de escuela')}`} target="_blank" rel="noreferrer"
          style={{ display:'inline-block', padding:'10px 20px', background:S.cyan, color:'#07070e', borderRadius:'10px', textDecoration:'none', fontWeight:'700', fontSize:'.85rem' }}>
          💬 Escribir por WhatsApp
        </a>
      </div>
    </div>
  )
  if (!jugador) return null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'500px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em' }}>⚽ Mi tarjeta · Golmebol</div>
            <div style={{ fontWeight:'800', fontSize:'1.1rem' }}>{jugador.name}</div>
          </div>
          <button onClick={handleLogout} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'7px 14px', cursor:'pointer', color:S.muted, fontSize:'.78rem', fontWeight:'600' }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth:'500px', margin:'0 auto', padding:'24px 16px' }}>
        {escuelaNombre && <div style={{ fontSize:'.72rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10, textAlign:'center' }}>{escuelaNombre}</div>}
        <TarjetaEscuelaJugador jugador={jugador} premios={premios} premiosTorneo={premiosTorneo}/>
        <FichaEvolucion jugadorId={jugador.id}/>
      </div>
    </div>
  )
}
