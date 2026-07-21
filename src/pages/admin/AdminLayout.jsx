import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Trophy, Shield, Users, CalendarDays, Star, CreditCard, Newspaper, Medal, UserCheck, UserCog, Ticket, GraduationCap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useIsMobile } from '../../hooks/useIsMobile'

const MENU_COMPLETO = [
  { icon: <Trophy size={22}/>,       label: 'TORNEOS',    ruta: '/admin/torneos' },
  { icon: <Shield size={22}/>,       label: 'EQUIPOS',    ruta: '/admin/equipos',   ocultoOrganizador: true },
  { icon: <Users size={22}/>,        label: 'JUGADORES',  ruta: '/admin/jugadores', ocultoOrganizador: true },
  { icon: <CalendarDays size={22}/>, label: 'CALENDARIO', ruta: '/admin/calendario' },
  { icon: <CreditCard size={22}/>,   label: 'TARJETAS',   ruta: '/admin/tarjetas',  soloAdmin: true },
  { icon: <Star size={22}/>,         label: 'SPONSORS',   ruta: '/admin/sponsors',  soloAdmin: true },
  { icon: <Newspaper size={22}/>,    label: 'NOTICIAS',   ruta: '/admin/noticias' },
  { icon: <Ticket size={22}/>,       label: 'PREDIX',      ruta: '/admin/predix' },
  { icon: <Medal size={22}/>,        label: 'RÉCORDS',    ruta: '/admin/records',   soloAdmin: true },
  { icon: <UserCheck size={22}/>,    label: 'ÁRBITROS',   ruta: '/admin/arbitros',  soloAdmin: true },
  { icon: <GraduationCap size={22}/>,label: 'ESCUELAS',   ruta: '/admin/escuelas',  soloAdmin: true },
  { icon: <UserCog size={22}/>,      label: 'USUARIOS',   ruta: '/admin/usuarios',  soloAdmin: true },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { rol } = useAuthStore()
  const isMobile = useIsMobile()
  // Sin sistema de roles cargado (tabla no creada), todo usuario del admin es admin
  const esAdmin = rol?.rol ? rol.rol === 'admin' : true
  const esOrganizador = rol?.rol === 'organizador'
  const MENU = MENU_COMPLETO.filter(m => (esAdmin || !m.soloAdmin) && !(esOrganizador && m.ocultoOrganizador))

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
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
