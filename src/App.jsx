// force redeploy
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PlayerLoginPage from './pages/PlayerLoginPage'
import RecordsPage from './pages/RecordsPage'
import PlayerHomePage from './pages/PlayerHomePage'
import ElegirTarjetaPage from './pages/ElegirTarjetaPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCrearPage from './pages/admin/AdminCrearPage'
import AdminTorneosPage from './pages/admin/AdminTorneosPage'
import AdminEquiposPage from './pages/admin/AdminEquiposPage'
import AdminJugadoresPage from './pages/admin/AdminJugadoresPage'
import AdminJugadorDetallePage from './pages/admin/AdminJugadorDetallePage'
import AdminCalendarioPage from './pages/admin/AdminCalendarioPage'
import AdminSponsorsPage from './pages/admin/AdminSponsorsPage'
import AdminEquipoDetallePage from './pages/admin/AdminEquipoDetallePage'
import AdminTorneoDetallePage from './pages/admin/AdminTorneoDetallePage'
import AdminTarjetasPage from './pages/admin/AdminTarjetasPage'
import AdminNoticiasPage from './pages/admin/AdminNoticiasPage'
import PlayerTorneoPage from './pages/PlayerTorneoPage'
import PlayerApuestasPage from './pages/PlayerApuestasPage'
import PlayerNoticiasPage from './pages/PlayerNoticiasPage'
import TorneoPublicoPage from './pages/TorneoPublicoPage'
import RegistroEquipoPage from './pages/RegistroEquipoPage'
import AdminRecordsPage from './pages/admin/AdminRecordsPage'
import PlayerHistorialPage from './pages/PlayerHistorialPage'
import AdminUsuariosPage from './pages/admin/AdminUsuariosPage'
import ArbitroPage from './pages/ArbitroPage'

// Correos que siempre son admin (respaldo por si la tabla de roles falla)
const ADMINS_PRINCIPALES = ['golmebol@gmail.com', 'smr06marin@gmail.com']

function PantallaCargando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1.2rem', color: '#1a73e8', fontWeight: '600' }}>
      Cargando...
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, rol, rolCargado } = useAuthStore()
  if (loading) return <PantallaCargando/>
  if (!user) return <Navigate to="/login" replace/>
  if (!rolCargado) return <PantallaCargando/>
  // Árbitros van a su portal
  if (rol?.rol === 'arbitro') return <Navigate to="/arbitro" replace/>
  // Cuenta sin rol de administración: mostrar con qué correo entró y a dónde puede ir
  if (rol?.rol !== 'admin' && rol?.rol !== 'organizador') return (
    <div style={{ minHeight: '100vh', background: '#f4f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '36px', textAlign: 'center', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🔒</div>
        <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.05rem', marginBottom: '6px' }}>Esta cuenta no tiene permisos de administración</div>
        <div style={{ fontSize: '.82rem', color: '#5f6368', marginBottom: '4px' }}>Entraste con:</div>
        <div style={{ fontSize: '.9rem', fontWeight: '700', color: '#1a73e8', marginBottom: '16px' }}>{user.email}</div>
        <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginBottom: '20px' }}>Si deberías tener acceso, pide al administrador que agregue este correo en la sección Usuarios.</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { window.location.href = '/jugador' }}
            style={{ flex: 1, padding: '11px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '600' }}>
            Ir al portal jugador
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
            style={{ flex: 1, padding: '11px', background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
  return children
}

function ArbitroRoute({ children }) {
  const { user, loading, rol, rolCargado } = useAuthStore()
  if (loading) return <PantallaCargando/>
  if (!user) return <Navigate to="/login" replace/>
  if (!rolCargado) return <PantallaCargando/>
  if (rol?.rol !== 'arbitro' && rol?.rol !== 'admin') return <Navigate to="/admin" replace/>
  return children
}

function PlayerRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#07070e', color: '#00ddd0', fontFamily: 'var(--font-display)', letterSpacing: '.2em', fontSize: '1rem' }}>
      CARGANDO...
    </div>
  )
  if (!user) return <Navigate to="/jugador/login" replace/>
  return children
}

export default function App() {
  const { setUser, setLoading, setRol, empezarCargaRol, user } = useAuthStore()
  const [cardType, setCardType] = useState('normal')

  async function cargarRol(u) {
    if (!u?.email) { setRol(null); return }
    empezarCargaRol() // evita usar el rol viejo mientras se consulta el nuevo
    const email = u.email.toLowerCase()
    try {
      const { data, error } = await supabase.from('roles_plataforma')
        .select('rol, plan, activo').eq('email', email).maybeSingle()
      if (error) throw error
      if (data && data.activo !== false) {
        setRol({ rol: data.rol, plan: data.plan })
        // Vincular la cuenta al rol (para que el admin vea de quién es cada torneo)
        supabase.from('roles_plataforma').update({ user_id: u.id }).eq('email', email).then(() => {}, () => {})
      }
      else if (ADMINS_PRINCIPALES.includes(email)) setRol({ rol: 'admin' })
      else setRol({ rol: null })
    } catch {
      // Tabla de roles aún no creada: comportamiento actual (todo usuario logueado es admin)
      setRol({ rol: 'admin' })
    }
  }

  useEffect(() => {
    // Timeout de seguridad: si en 5s no resuelve, forzar loading=false
    const timeout = setTimeout(() => setLoading(false), 2000)
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      setUser(session?.user ?? null)
      setLoading(false)
      cargarRol(session?.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      cargarRol(session?.user)
    })
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  return (
    <BrowserRouter>
      <Routes>

       {/* Redirigir inicio público al login de jugador */}
       <Route path="/" element={<RecordsPage />} />

{/* Login admin */}
<Route path="/login" element={user ? <Navigate to="/admin" replace/> : <LoginPage/>}/>
        {/* Panel Admin */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout/></ProtectedRoute>}>
          <Route index                element={<AdminDashboard/>}/>
          <Route path="crear"         element={<AdminCrearPage/>}/>
          <Route path="torneos"       element={<AdminTorneosPage/>}/>
          <Route path="torneos/:id"   element={<AdminTorneoDetallePage/>}/>
          <Route path="equipos"       element={<AdminEquiposPage/>}/>
          <Route path="equipos/:id"   element={<AdminEquipoDetallePage/>}/>
          <Route path="jugadores"     element={<AdminJugadoresPage/>}/>
          <Route path="jugadores/:id" element={<AdminJugadorDetallePage/>}/>
          <Route path="calendario"    element={<AdminCalendarioPage/>}/>
          <Route path="sponsors"      element={<AdminSponsorsPage/>}/>
          <Route path="tarjetas"      element={<AdminTarjetasPage/>}/>
          <Route path="noticias"      element={<AdminNoticiasPage/>}/>
          <Route path="records"       element={<AdminRecordsPage/>}/>
          <Route path="usuarios"      element={<AdminUsuariosPage/>}/>
        </Route>

        {/* Portal de árbitros */}
        <Route path="/arbitro" element={<ArbitroRoute><ArbitroPage/></ArbitroRoute>}/>

        {/* Página pública de torneo — sin login */}
        <Route path="/t/:id" element={<TorneoPublicoPage/>}/>
        {/* Registro público de jugadores por equipo */}
<Route path="/registro/equipo/:token/:tournamentId" element={<RegistroEquipoPage/>}/>

        {/* Equipo detalle — accesible por admin Y jugador */}
        <Route path="/equipos/:id" element={<PlayerRoute><AdminEquipoDetallePage modoLectura={true}/></PlayerRoute>}/>

        {/* Portal jugador */}
        <Route path="/" element={<RecordsPage />} />
<Route path="/records" element={<RecordsPage />} />
        <Route path="/jugador/login"      element={<PlayerLoginPage/>}/>
        <Route path="/jugador"            element={<PlayerRoute><PlayerHomePage/></PlayerRoute>}/>
        <Route path="/jugador/torneo/:id" element={<PlayerRoute><PlayerTorneoPage/></PlayerRoute>}/>
        <Route path="/jugador/apuestas"   element={<PlayerRoute><PlayerApuestasPage/></PlayerRoute>}/>
        <Route path="/jugador/historial"  element={<PlayerRoute><PlayerHistorialPage/></PlayerRoute>}/>
        <Route path="/jugador/noticias"   element={<PlayerRoute><PlayerNoticiasPage/></PlayerRoute>}/>

      </Routes>
    </BrowserRouter>
  )
}