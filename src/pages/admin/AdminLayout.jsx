import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { PlusCircle, Trophy, Shield, Users, CalendarDays, Star, CreditCard } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const MENU = [
  { icon: <PlusCircle size={22}/>,   label: 'CREAR',      ruta: '/admin/crear' },
  { icon: <Trophy size={22}/>,       label: 'TORNEOS',    ruta: '/admin/torneos' },
  { icon: <Shield size={22}/>,       label: 'EQUIPOS',    ruta: '/admin/equipos' },
  { icon: <Users size={22}/>,        label: 'JUGADORES',  ruta: '/admin/jugadores' },
  { icon: <CalendarDays size={22}/>, label: 'CALENDARIO', ruta: '/admin/calendario' },
  { icon: <CreditCard size={22}/>,   label: 'TARJETAS',   ruta: '/admin/tarjetas' },
  { icon: <Star size={22}/>,         label: 'SPONSORS',   ruta: '/admin/sponsors' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: '64px', background: '#fff',
        borderRight: '1px solid #e8eaed',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '16px 0',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 100, boxShadow: '2px 0 8px rgba(0,0,0,.06)',
      }}>
        {/* Logo */}
        <div onClick={() => navigate('/admin')} style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #1a73e8, #6c35de)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', marginBottom: '24px', flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>G</span>
        </div>

        {/* Menú */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center' }}>
          {MENU.map(item => {
            const active = location.pathname === item.ruta || location.pathname.startsWith(item.ruta + '/')
            return (
              <div key={item.ruta}
                onClick={() => navigate(item.ruta)}
                title={item.label}
                style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  color: active ? '#1a73e8' : '#5f6368',
                  background: active ? '#e8f0fe' : 'transparent',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f1f3f4' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {item.icon}
              </div>
            )
          })}
        </div>

        {/* Logout abajo */}
        <div style={{ marginTop: 'auto' }}>
          <div onClick={handleLogout} title="Cerrar sesión"
            style={{ width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fce8e6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🚪
          </div>
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ marginLeft: '64px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <div style={{
          height: '56px', background: '#fff',
          borderBottom: '1px solid #e8eaed',
          display: 'flex', alignItems: 'center',
          padding: '0 24px', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124' }}>
            {MENU.find(m => location.pathname === m.ruta || location.pathname.startsWith(m.ruta + '/'))?.label || 'PANEL ADMIN'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/')}
              style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>
              ← App
            </button>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#1a73e8,#6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.75rem', fontWeight: 'bold' }}>
              A
            </div>
          </div>
        </div>

        {/* Página */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
