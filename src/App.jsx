// force redeploy
import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'

// Carga diferida por página: el celular descarga solo el código de la
// página que visita (antes bajaba 1.4MB de una sola vez en cada carga)
const LoginPage               = lazy(() => import('./pages/LoginPage'))
const PlayerLoginPage         = lazy(() => import('./pages/PlayerLoginPage'))
const RecordsPage             = lazy(() => import('./pages/RecordsPage'))
const PlayerHomePage          = lazy(() => import('./pages/PlayerHomePage'))
const AdminLayout             = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard          = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminCrearPage          = lazy(() => import('./pages/admin/AdminCrearPage'))
const AdminTorneosPage        = lazy(() => import('./pages/admin/AdminTorneosPage'))
const AdminEquiposPage        = lazy(() => import('./pages/admin/AdminEquiposPage'))
const AdminJugadoresPage      = lazy(() => import('./pages/admin/AdminJugadoresPage'))
const AdminJugadorDetallePage = lazy(() => import('./pages/admin/AdminJugadorDetallePage'))
const AdminCalendarioPage     = lazy(() => import('./pages/admin/AdminCalendarioPage'))
const AdminSponsorsPage       = lazy(() => import('./pages/admin/AdminSponsorsPage'))
const AdminEquipoDetallePage  = lazy(() => import('./pages/admin/AdminEquipoDetallePage'))
const AdminTorneoDetallePage  = lazy(() => import('./pages/admin/AdminTorneoDetallePage'))
const AdminTarjetasPage       = lazy(() => import('./pages/admin/AdminTarjetasPage'))
const AdminNoticiasPage       = lazy(() => import('./pages/admin/AdminNoticiasPage'))
const PlayerTorneoPage        = lazy(() => import('./pages/PlayerTorneoPage'))
const PlayerApuestasPage      = lazy(() => import('./pages/PlayerApuestasPage'))
const PlayerNoticiasPage      = lazy(() => import('./pages/PlayerNoticiasPage'))
const TorneoPublicoPage       = lazy(() => import('./pages/TorneoPublicoPage'))
const RegistroEquipoPage      = lazy(() => import('./pages/RegistroEquipoPage'))
const AdminRecordsPage        = lazy(() => import('./pages/admin/AdminRecordsPage'))
const AdminArbitrosPage       = lazy(() => import('./pages/admin/AdminArbitrosPage'))
const ArbitroHomePage         = lazy(() => import('./pages/ArbitroHomePage'))
const ArbitroLiderPage        = lazy(() => import('./pages/ArbitroLiderPage'))
const ArbitroPerfilPage       = lazy(() => import('./pages/ArbitroPerfilPage'))
const ArbitroRankingPage      = lazy(() => import('./pages/ArbitroRankingPage'))
const EncuestaArbitrosPage    = lazy(() => import('./pages/EncuestaArbitrosPage'))
const PlayerHistorialPage     = lazy(() => import('./pages/PlayerHistorialPage'))

// Pantalla mínima mientras se descarga el código de una página
function CargandoPagina() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f4f6f8' }}>
      <div className="gm-spinner"/>
    </div>
  )
}

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
      <Suspense fallback={<CargandoPagina/>}>
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
        <Route path="/arbitro/encuestas"     element={<EncuestaArbitrosPage/>}/>
        <Route path="/jugador/noticias"   element={<PlayerRoute><PlayerNoticiasPage/></PlayerRoute>}/>

      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}