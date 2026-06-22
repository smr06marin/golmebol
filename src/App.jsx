import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PlayerLoginPage from './pages/PlayerLoginPage'
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
import PlayerTorneoPage from './pages/PlayerTorneoPage'
import AdminTarjetasPage from './pages/admin/AdminTarjetasPage'

// Ruta protegida para admin
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

// Ruta protegida para jugador — verifica sesión y membresía activa
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>

        {/* ── Login admin ── */}
        <Route path="/login" element={user ? <Navigate to="/" replace/> : <LoginPage/>}/>

        {/* ── App admin ── */}
        <Route path="/" element={<ProtectedRoute><HomePage cardType={cardType}/></ProtectedRoute>}/>
        <Route path="/elegir-tarjeta" element={<ProtectedRoute><ElegirTarjetaPage onSelect={setCardType} currentDesign={cardType}/></ProtectedRoute>}/>

        {/* ── Panel Admin ── */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout/></ProtectedRoute>}>
          <Route index                  element={<AdminDashboard/>}/>
          <Route path="crear"           element={<AdminCrearPage/>}/>
          <Route path="torneos"         element={<AdminTorneosPage/>}/>
          <Route path="torneos/:id"     element={<AdminTorneoDetallePage/>}/>
          <Route path="equipos"         element={<AdminEquiposPage/>}/>
          <Route path="equipos/:id"     element={<AdminEquipoDetallePage/>}/>
          <Route path="jugadores"       element={<AdminJugadoresPage/>}/>
          <Route path="jugadores/:id"   element={<AdminJugadorDetallePage/>}/>
          <Route path="calendario"      element={<AdminCalendarioPage/>}/>
          <Route path="sponsors"        element={<AdminSponsorsPage/>}/>
          <Route path="tarjetas" element={<AdminTarjetasPage/>}/>
        </Route>

        {/* ── Portal jugador ── */}
        <Route path="/jugador/login" element={<PlayerLoginPage/>}/>
        <Route path="/jugador"       element={<PlayerRoute><PlayerHomePage/></PlayerRoute>}/>
        <Route path="/jugador/torneo/:id" element={<PlayerRoute><PlayerTorneoPage/></PlayerRoute>}/>

      </Routes>
    </BrowserRouter>
  )
}
