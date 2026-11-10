import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { PaginaPanel, CuerpoPanel, EncabezadoPanel, Saludo, TarjetaPanel, G } from '../components/PanelUI'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { leerCopia, guardarCopia } from '../lib/perfilPrevio'
import TarjetaEscuelaJugador from '../components/TarjetaEscuelaJugador'
import FichaEvolucion from '../components/FichaEvolucion'

const S = {
  navy: '#0a0a0a', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#6fcf3d', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

export default function AcudientePage() {
  const navigate = useNavigate()
  // Lo último que vio esta cuenta se pinta de inmediato y los datos nuevos llegan detrás
  const uid = useAuthStore.getState().user?.id
  const [copia] = useState(() => leerCopia(uid, 'acudiente_home', 6 * 60 * 60 * 1000))
  const [acudiente, setAcudiente] = useState(copia?.acudiente || null)
  const [hijos, setHijos] = useState(copia?.hijos || []) // [{ jugador, escuelaNombre, premios }]
  const [loading, setLoading] = useState(!copia)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    if (!copia) setLoading(true)
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null // sesión del propio teléfono: getUser() iba a la red en cada entrada
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador/login'); return }
    if (!p.es_acudiente) { navigate('/jugador'); return }
    setAcudiente(p)

    const { data: vinculos } = await supabase.from('escuela_acudientes').select('*, jugador:jugador_id(*)').eq('acudiente_id', p.id)
    // Cada hijo se carga a la vez (antes uno detrás de otro, con varias consultas seguidas por cada uno)
    const lista = (await Promise.all((vinculos || []).map(async v => {
      const jugador = v.jugador
      if (!jugador) return null
      const [{ data: tp }, { data: premTorneo }] = await Promise.all([
        supabase.from('team_players').select('team_id, teams(name, categoria)').eq('player_id', jugador.id).maybeSingle(),
        supabase.from('escuela_torneo_premios').select('*, torneo:torneo_id(nombre)').eq('jugador_id', jugador.id).order('created_at', { ascending:false }),
      ])
      const escuelaId = tp?.team_id
      let premios = []
      if (escuelaId) {
        const { data: prem } = await supabase.from('escuela_premios').select('*').eq('escuela_id', escuelaId).order('umbral', { ascending:true })
        premios = prem || []
      }
      return { jugador, escuelaNombre: tp?.teams?.name || '', premios, premiosTorneo: premTorneo || [] }
    }))).filter(Boolean)
    setHijos(lista)
    setLoading(false)
    guardarCopia(uid, 'acudiente_home', { acudiente: p, hijos: lista })
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!acudiente) return null

  const primerNombre = acudiente.name?.split(' ')[0] || ''

  return (
    <PaginaPanel>
      <EncabezadoPanel nombre={acudiente.name} rol="Acudiente" avatarUrl={acudiente.photo_face_url} icono={<Users size={22} color={G.muted}/>}
        forma="redonda" usuario={acudiente} actual="acudiente" onLogout={handleLogout}/>

      <CuerpoPanel ancho={600}>
        <Saludo nombre={primerNombre} texto={hijos.length === 1 ? 'Así va tu jugador' : 'Así van tus jugadores'}/>

        {hijos.length === 0 ? (
          <TarjetaPanel>
            <div style={{ textAlign:'center', padding:'10px 0', color:G.muted }}>
              <div style={{ fontSize:'2.2rem', marginBottom:'8px' }}>👦</div>
              <div style={{ fontSize:'1rem', lineHeight:1.5 }}>Todavía no hay jugadores vinculados a tu cuenta.</div>
            </div>
          </TarjetaPanel>
        ) : (
          hijos.map(({ jugador, escuelaNombre, premios, premiosTorneo }) => (
            <TarjetaPanel key={jugador.id} icono={Users} titulo={jugador.name || 'Jugador'} derecha={escuelaNombre}>
              <TarjetaEscuelaJugador jugador={jugador} premios={premios} premiosTorneo={premiosTorneo}/>
              <FichaEvolucion jugadorId={jugador.id}/>
            </TarjetaPanel>
          ))
        )}
      </CuerpoPanel>
    </PaginaPanel>
  )
}
