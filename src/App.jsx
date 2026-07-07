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
import AdminArbitrosPage from './pages/admin/AdminArbitrosPage'
import ArbitroHomePage from './pages/ArbitroHomePage'
import ArbitroLiderPage from './pages/ArbitroLiderPage'
import ArbitroPerfilPage from './pages/ArbitroPerfilPage'
import ArbitroRankingPage from './pages/ArbitroRankingPage'
import PlayerHistorialPage from './pages/PlayerHistorialPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1.2rem', color: '#1a73e8', fontWeight: '600' }}>
      Cargando...
    </div>
  )
  if (!user) return <Navigate to="/login" replace/>
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
  const { setUser, setLoading, user } = useAuthStore()
  const [cardType, setCardType] = useState('normal')

  useEffect(() => {
    // Timeout de seguridad: si en 5s no resuelve, forzar loading=false
    const timeout = setTimeout(() => setLoading(false), 2000)
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
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
          <Route path="arbitros"      element={<AdminArbitrosPage/>}/>
        </Route>

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
        <Route path="/arbitro"            element={<ArbitroHomePage/>}/>
        <Route path="/arbitro/lider"       element={<ArbitroLiderPage/>}/>
        <Route path="/arbitro/perfil/:id"   element={<ArbitroPerfilPage/>}/>
        <Route path="/arbitro/ranking"       element={<ArbitroRankingPage/>}/>
        <Route path="/jugador/noticias"   element={<PlayerRoute><PlayerNoticiasPage/></PlayerRoute>}/>

      </Routes>
    </BrowserRouter>
  )
}