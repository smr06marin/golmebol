import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Trophy, Shield, Users, CalendarDays, Star, CreditCard, Newspaper, Medal, UserCheck, UserCog, GraduationCap, Building2, Radio, Globe, Megaphone } from 'lucide-react'
import { supabase, supabaseSilent } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { notify } from '../../lib/notify'

const MENU_COMPLETO = [
  { icon: <Trophy size={22}/>,       label: 'TORNEOS',    ruta: '/admin/torneos' },
  { icon: <Globe size={22}/>,        label: 'MI DOMINIO', ruta: '/admin/perfil-organizador', ocultoOrganizador: true },
  { icon: <Shield size={22}/>,       label: 'EQUIPOS',    ruta: '/admin/equipos',   ocultoOrganizador: true },
  { icon: <Users size={22}/>,        label: 'JUGADORES',  ruta: '/admin/jugadores', ocultoOrganizador: true },
  { icon: <CalendarDays size={22}/>, label: 'CALENDARIO', ruta: '/admin/calendario' },
  { icon: <CreditCard size={22}/>,   label: 'TARJETAS',   ruta: '/admin/tarjetas',  soloAdmin: true },
  { icon: <Star size={22}/>,         label: 'SPONSORS',   ruta: '/admin/sponsors',  soloAdmin: true },
  { icon: <Newspaper size={22}/>,    label: 'NOTICIAS',   ruta: '/admin/noticias', ocultoOrganizador: true },
  { icon: <Medal size={22}/>,        label: 'RÉCORDS',    ruta: '/admin/records',   soloAdmin: true },
  { icon: <UserCheck size={22}/>,    label: 'ÁRBITROS',   ruta: '/admin/arbitros',  soloAdmin: true },
  { icon: <GraduationCap size={22}/>,label: 'ESCUELAS',   ruta: '/admin/escuelas',  soloAdmin: true },
  { icon: <Building2 size={22}/>,    label: 'ESCENARIOS', ruta: '/admin/escenarios',soloAdmin: true },
  { icon: <Radio size={22}/>,        label: 'EN VIVO',    ruta: '/admin/config-sitio', soloAdmin: true },
  { icon: <Megaphone size={22}/>,    label: 'PATROCINADORES', ruta: '/admin/patrocinadores', soloAdmin: true },
  { icon: <UserCog size={22}/>,      label: 'USUARIOS',   ruta: '/admin/usuarios',  soloAdmin: true },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { rol, user, setRol } = useAuthStore()
  const isMobile = useIsMobile()
  // Sin sistema de roles cargado (tabla no creada), todo usuario del admin es admin
  const esAdmin = rol?.rol ? rol.rol === 'admin' : true
  const esOrganizador = rol?.rol === 'organizador'
  const MENU = MENU_COMPLETO.filter(m => (esAdmin || !m.soloAdmin) && !(esOrganizador && m.ocultoOrganizador))

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Cambiar contraseña OBLIGATORIO, de pantalla completa — sale solo una
  // vez, justo después de que un admin le resetea la contraseña a alguien y
  // esa persona entra con la que le dieron. No hay botón para abrirlo a
  // voluntad en ningún otro momento (si alguien quiere cambiarla sin que se
  // la hayan reseteado, que escriba por WhatsApp). En cuanto la cambia acá,
  // no vuelve a salir nunca más.
  const [passActual1, setPassActual1] = useState('')
  const [passActual2, setPassActual2] = useState('')
  const [errorPass, setErrorPass]     = useState('')
  const [guardandoPass, setGuardandoPass] = useState(false)

  async function handleCambiarPassPropia() {
    if (!passActual1 || passActual1.length < 6) { setErrorPass('Mínimo 6 caracteres'); return }
    if (passActual1 !== passActual2) { setErrorPass('Las contraseñas no coinciden'); return }
    setGuardandoPass(true)
    setErrorPass('')
    const { error } = await supabase.auth.updateUser({ password: passActual1 })
    setGuardandoPass(false)
    if (error) { setErrorPass('Error: ' + error.message); return }
    setPassActual1(''); setPassActual2('')
    notify('Contraseña actualizada ✓')
    // Se quita de una en la sesión (para que la pantalla desaparezca al
    // toque) y también en la base (para que no vuelva a salir en la
    // próxima entrada). Con supabaseSilent para no disparar "Cambios
    // guardados ✓" encima del aviso de arriba.
    setRol({ ...rol, debeCambiarPassword: false })
    if (user?.email) {
      supabaseSilent.from('roles_plataforma').update({ debe_cambiar_password: false }).eq('email', user.email.toLowerCase()).then(() => {}, () => {})
    }
  }

  // Pantalla completa, obligatoria — tapa TODO el panel (sidebar, menú,
  // Outlet) hasta que la persona ponga su propia contraseña. Sin botón de
  // "cancelar": no se puede seguir sin cambiarla.
  if (rol?.debeCambiarPassword) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🔑</div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.1rem', marginBottom: '8px' }}>Crea tu contraseña</div>
            <div style={{ fontSize: '.8rem', color: '#5f6368', lineHeight: 1.5 }}>
              Por seguridad, antes de seguir crea una contraseña que solo tú conozcas
            </div>
          </div>
          <input type="password" placeholder="Nueva contraseña" value={passActual1} onChange={e => setPassActual1(e.target.value)} autoFocus
            style={{ width: '100%', background: '#fff', border: '1.5px solid #dadce0', borderRadius: '10px', padding: '12px 14px', color: '#202124', fontSize: '.95rem', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}/>
          <input type="password" placeholder="Repite la contraseña" value={passActual2} onChange={e => setPassActual2(e.target.value)}
            style={{ width: '100%', background: '#fff', border: '1.5px solid #dadce0', borderRadius: '10px', padding: '12px 14px', color: '#202124', fontSize: '.95rem', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}/>
          {errorPass && <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '8px', padding: '10px 12px', fontSize: '.82rem', color: '#d93025', marginBottom: '16px' }}>{errorPass}</div>}
          <button onClick={handleCambiarPassPropia} disabled={guardandoPass}
            style={{ width: '100%', padding: '12px', background: guardandoPass ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: guardandoPass ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.95rem' }}>
            {guardandoPass ? 'Guardando...' : 'Guardar y entrar →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui, sans-serif' }}>

      {/* Sidebar (solo escritorio) */}
      {!isMobile && (
        <div style={{ width: '64px', background: '#fff', borderRight: '1px solid #e8eaed', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, boxShadow: '2px 0 8px rgba(0,0,0,.06)' }}>
          {/* Logo */}
          <div onClick={() => navigate('/admin')} style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '24px', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>G</span>
          </div>

          {/* Menú */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center', overflowY: 'auto' }}>
            {MENU.map(item => {
              const active = location.pathname === item.ruta || location.pathname.startsWith(item.ruta + '/')
              return (
                <div key={item.ruta} onClick={() => navigate(item.ruta)} title={item.label}
                  style={{ width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: active ? '#1a73e8' : '#5f6368', background: active ? '#e8f0fe' : 'transparent', transition: 'all .15s', flexShrink: 0 }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f1f3f4' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                  {item.icon}
                </div>
              )
            })}
          </div>

          {/* Logout */}
          <div style={{ marginTop: 'auto' }}>
            <div onClick={handleLogout} title="Cerrar sesión"
              style={{ width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fce8e6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              🚪
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior (solo celular) */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#fff', borderTop: '1px solid #e8eaed', boxShadow: '0 -2px 12px rgba(0,0,0,.08)', display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 4px calc(4px + env(safe-area-inset-bottom))' }}>
          {MENU.map(item => {
            const active = location.pathname === item.ruta || location.pathname.startsWith(item.ruta + '/')
            return (
              <div key={item.ruta} onClick={() => navigate(item.ruta)}
                style={{ minWidth: '64px', flex: '1 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '7px 4px', borderRadius: '10px', cursor: 'pointer', color: active ? '#1a73e8' : '#5f6368', background: active ? '#e8f0fe' : 'transparent' }}>
                {item.icon}
                <span style={{ fontSize: '.55rem', fontWeight: active ? '700' : '500', letterSpacing: '.02em' }}>{item.label}</span>
              </div>
            )
          })}
          <div onClick={handleLogout}
            style={{ minWidth: '56px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '7px 4px', color: '#d93025' }}>
            <span style={{ fontSize: '1.05rem' }}>🚪</span>
            <span style={{ fontSize: '.55rem', fontWeight: '500' }}>SALIR</span>
          </div>
        </div>
      )}

      {/* Contenido */}
      <div style={{ marginLeft: isMobile ? 0 : '64px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ height: '52px', background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', padding: isMobile ? '0 14px' : '0 24px', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {isMobile && (
              <div onClick={() => navigate('/admin')} style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: '.85rem', fontWeight: 'bold' }}>G</span>
              </div>
            )}
            <div style={{ fontSize: '.95rem', fontWeight: '600', color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {MENU.find(m => location.pathname === m.ruta || location.pathname.startsWith(m.ruta + '/'))?.label || 'PANEL ADMIN'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button onClick={() => navigate('/')}
              style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>
              ← App
            </button>
            {!isMobile && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#1a73e8,#6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.75rem', fontWeight: 'bold' }}>
                A
              </div>
            )}
          </div>
        </div>

        {/* Página */}
        <div style={{ flex: 1, padding: isMobile ? '14px 12px calc(84px + env(safe-area-inset-bottom))' : '24px', overflowY: 'auto', minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
