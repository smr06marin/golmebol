// force redeploy
import { useEffect, useState, lazy, Suspense, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'

// Carga diferida por página: el celular solo descarga el código de la página que visita
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
const AdminRecordsPage        = lazy(() => import('./pages/admin/AdminRecordsPage'))
const AdminArbitrosPage       = lazy(() => import('./pages/admin/AdminArbitrosPage'))
const AdminUsuariosPage       = lazy(() => import('./pages/admin/AdminUsuariosPage'))
const AdminPredixPage         = lazy(() => import('./pages/admin/AdminPredixPage'))
const PlayerTorneoPage        = lazy(() => import('./pages/PlayerTorneoPage'))
const PlayerApuestasPage      = lazy(() => import('./pages/PlayerApuestasPage'))
const PlayerNoticiasPage      = lazy(() => import('./pages/PlayerNoticiasPage'))
const PlayerHistorialPage     = lazy(() => import('./pages/PlayerHistorialPage'))
const TorneoPublicoPage       = lazy(() => import('./pages/TorneoPublicoPage'))
const RegistroEquipoPage      = lazy(() => import('./pages/RegistroEquipoPage'))
const TestTarjetas            = lazy(() => import('./pages/TestTarjetas')) // TEMPORAL
const ArbitroHomePage         = lazy(() => import('./pages/ArbitroHomePage'))
const ArbitroLiderPage        = lazy(() => import('./pages/ArbitroLiderPage'))
const ArbitroPerfilPage       = lazy(() => import('./pages/ArbitroPerfilPage'))
const ArbitroRankingPage      = lazy(() => import('./pages/ArbitroRankingPage'))
const EncuestaArbitrosPage    = lazy(() => import('./pages/EncuestaArbitrosPage'))

// Correos que siempre son admin (respaldo por si la tabla de roles falla)
const ADMINS_PRINCIPALES = ['golmebol@gmail.com', 'smr06marin@gmail.com']

// Si tras un deploy el navegador tiene una versión vieja y un módulo diferido ya
// no existe (chunk 404), recargamos una vez para traer la versión nueva.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    if (!sessionStorage.getItem('golmebol_chunk_reload')) {
      sessionStorage.setItem('golmebol_chunk_reload', '1')
      window.location.reload()
    }
  })
}

// Si algo revienta en cualquier página, en vez de quedar la pantalla en negro
// (o en blanco) se muestra un mensaje con botón para recargar. Clave en
// celulares donde no se puede abrir la consola para ver el error.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', background: '#f4f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '16px', padding: '32px', textAlign: 'center', maxWidth: '380px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>😵</div>
          <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '8px' }}>Algo salió mal</div>
          <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '8px' }}>Recarga la página para continuar. Si sigue pasando, avísanos por WhatsApp.</div>
          <div style={{ fontSize: '.65rem', color: '#9aa0a6', marginBottom: '18px', wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error)}</div>
          <button onClick={() => window.location.reload()}
            style={{ width: '100%', padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: '700', fontSize: '.9rem' }}>
            🔄 Recargar
          </button>
        </div>
      </div>
    )
  }
}

function PantallaCargando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1.1rem', color: '#1a73e8', fontWeight: '600', fontFamily: 'system-ui, sans-serif' }}>
      Cargando...
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, rol, rolCargado } = useAuthStore()
  if (loading) return <PantallaCargando/>
  if (!user) return <Navigate to="/login" replace/>
  if (!rolCargado) return <PantallaCargando/>
  // Cuenta sin rol de administración: mostrar con qué correo entró y a dónde puede ir
  if (rol?.rol && rol.rol !== 'admin' && rol.rol !== 'organizador') return <Navigate to="/jugador" replace/>
  if (!rol?.rol) return (
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

// Solo deja pasar cuentas que son árbitro (rol='arbitro', es_arbitro o
// es_arbitro_lider) — un jugador sin ese rol nunca debe poder ver el portal
// de árbitros aunque escriba la URL a mano.
function ArbitroRoute({ children }) {
  const { user, loading } = useAuthStore()
  const [estado, setEstado] = useState('cargando') // cargando | ok | no_arbitro | sin_perfil

  useEffect(() => {
    if (loading) return
    if (!user) { setEstado('sin_perfil'); return }
    let cancelado = false
    supabase.from('players').select('rol, es_arbitro, es_arbitro_lider').eq('user_id', user.id).maybeSingle()
      .then(({ data: p }) => {
        if (cancelado) return
        if (!p) setEstado('sin_perfil')
        else if (p.rol === 'arbitro' || p.es_arbitro || p.es_arbitro_lider) setEstado('ok')
        else setEstado('no_arbitro')
      })
    return () => { cancelado = true }
  }, [loading, user])

  if (loading || estado === 'cargando') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#07070e', color: '#00ddd0', fontFamily: 'var(--font-display)', letterSpacing: '.2em', fontSize: '1rem' }}>
      CARGANDO...
    </div>
  )
  if (estado === 'sin_perfil')  return <Navigate to="/jugador/login" replace/>
  if (estado === 'no_arbitro')  return <Navigate to="/jugador" replace/>
  return children
}

// Pregunta confirmación antes de salir de Golmebol con el botón "atrás" del
// celular/navegador, para evitar salidas accidentales que obligan a volver a
// iniciar sesión. Solo interrumpe cuando ese "atrás" realmente sacaría de la
// app — la navegación normal entre páginas internas no se ve afectada.
function useConfirmarSalida() {
  useEffect(() => {
    const MARCA = 'golmebolGuard'
    if (!(window.history.state && window.history.state[MARCA])) {
      window.history.pushState({ [MARCA]: true }, '', window.location.href)
    }
    function onPopState(e) {
      if (!(e.state && e.state[MARCA])) return // navegación normal dentro de la app: no hacer nada
      const salir = window.confirm('¿Seguro que quieres salir de Golmebol?')
      if (salir) {
        window.removeEventListener('popstate', onPopState)
        window.history.back()
      } else {
        window.history.pushState({ [MARCA]: true }, '', window.location.href)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
}

export default function App() {
  const { setUser, setLoading, setRol, empezarCargaRol, user } = useAuthStore()
  useConfirmarSalida()

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
      // Tabla de roles aún no creada: comportamiento clásico (todo usuario logueado es admin)
      setRol({ rol: 'admin' })
    }
  }

  useEffect(() => {
    // Timeout de seguridad: si no resuelve, forzar loading=false
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
    <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<PantallaCargando/>}>
        <Routes>

          {/* Inicio público */}
          <Route path="/" element={<RecordsPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/test-tarjetas" element={<TestTarjetas/>}/>

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
            <Route path="usuarios"      element={<AdminUsuariosPage/>}/>
            <Route path="predix"        element={<AdminPredixPage/>}/>
          </Route>

          {/* Página pública de torneo — sin login */}
          <Route path="/t/:id" element={<TorneoPublicoPage/>}/>
          {/* Registro público de jugadores por equipo */}
          <Route path="/registro/equipo/:token/:tournamentId" element={<RegistroEquipoPage/>}/>

          {/* Equipo detalle — accesible por admin Y jugador */}
          <Route path="/equipos/:id" element={<PlayerRoute><AdminEquipoDetallePage modoLectura={true}/></PlayerRoute>}/>

          {/* Portal jugador */}
          <Route path="/jugador/login"      element={<PlayerLoginPage/>}/>
          <Route path="/jugador"            element={<PlayerRoute><PlayerHomePage/></PlayerRoute>}/>
          <Route path="/jugador/torneo/:id" element={<PlayerRoute><PlayerTorneoPage/></PlayerRoute>}/>
          <Route path="/jugador/apuestas"   element={<PlayerRoute><PlayerApuestasPage/></PlayerRoute>}/>
          <Route path="/jugador/historial"  element={<PlayerRoute><PlayerHistorialPage/></PlayerRoute>}/>
          <Route path="/jugador/noticias"   element={<PlayerRoute><PlayerNoticiasPage/></PlayerRoute>}/>

          {/* Portal árbitros */}
          <Route path="/arbitro"             element={<ArbitroRoute><ArbitroHomePage/></ArbitroRoute>}/>
          <Route path="/arbitro/lider"       element={<ArbitroRoute><ArbitroLiderPage/></ArbitroRoute>}/>
          <Route path="/arbitro/perfil/:id"  element={<ArbitroRoute><ArbitroPerfilPage/></ArbitroRoute>}/>
          <Route path="/arbitro/ranking"     element={<ArbitroRoute><ArbitroRankingPage/></ArbitroRoute>}/>
          <Route path="/arbitro/encuestas"   element={<ArbitroRoute><EncuestaArbitrosPage/></ArbitroRoute>}/>

        </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
