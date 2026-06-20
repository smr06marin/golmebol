import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function StatCard({ icon, label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: '12px',
      padding: '20px 24px', border: '1px solid #e8eaed',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .2s',
      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)' }}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
          {icon}
        </div>
        <span style={{ fontSize: '.75rem', fontWeight: '600', color: '#5f6368', letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#202124' }}>{value}</div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ torneos: 0, equipos: 0, jugadores: 0, partidos_hoy: 0 })
  const [torneos, setTorneos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchTorneos()
  }, [])

  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0]
    const [t, e, j, p] = await Promise.all([
      supabase.from('tournaments').select('id', { count: 'exact' }).eq('status', 'activo'),
      supabase.from('teams').select('id', { count: 'exact' }),
      supabase.from('players').select('id', { count: 'exact' }),
      supabase.from('matches').select('id', { count: 'exact' }).gte('played_at', today + 'T00:00:00').lte('played_at', today + 'T23:59:59'),
    ])
    setStats({
      torneos: t.count || 0,
      equipos: e.count || 0,
      jugadores: j.count || 0,
      partidos_hoy: p.count || 0,
    })
    setLoading(false)
  }

  async function fetchTorneos() {
    const { data } = await supabase.from('tournaments').select('*').eq('status', 'activo').order('created_at', { ascending: false }).limit(5)
    setTorneos(data || [])
  }

  return (
    <div>
      {/* Bienvenida */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#202124', margin: 0 }}>Panel de Administración</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>Bienvenido a Golmebol — gestiona tus torneos desde aquí</p>
      </div>

      {/* Tarjetas estadísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard icon="🏆" label="Torneos Activos"   value={loading ? '...' : stats.torneos}      color="#1a73e8" onClick={() => navigate('/admin/torneos')}/>
        <StatCard icon="📅" label="Partidos Hoy"      value={loading ? '...' : stats.partidos_hoy}  color="#e8710a" onClick={() => navigate('/admin/calendario')}/>
        <StatCard icon="⚽" label="Equipos"           value={loading ? '...' : stats.equipos}       color="#1e8e3e" onClick={() => navigate('/admin/equipos')}/>
        <StatCard icon="👤" label="Jugadores"         value={loading ? '...' : stats.jugadores}     color="#6c35de" onClick={() => navigate('/admin/jugadores')}/>
      </div>

      {/* Torneos activos */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Torneos Activos</span>
          <button onClick={() => navigate('/admin/torneos')}
            style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500' }}>
            Ver todos →
          </button>
        </div>
        {torneos.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>
            No hay torneos activos aún
          </div>
        ) : (
          torneos.map((t, i) => (
            <div key={t.id} style={{
              padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: i < torneos.length - 1 ? '1px solid #f1f3f4' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🏆</div>
                <div>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{t.name}</div>
                  <div style={{ color: '#9aa0a6', fontSize: '.75rem', marginTop: '2px' }}>
                    {[t.modalidad, t.categoria, t.city].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {t.genero && <span style={{ fontSize: '.7rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '12px', padding: '2px 10px' }}>{t.genero}</span>}
                <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '12px', padding: '2px 10px' }}>Activo</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Acciones rápidas */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Acciones Rápidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Nuevo Torneo',   icon: '🏆', ruta: '/admin/crear' },
            { label: 'Nueva Escuela',  icon: '🏫', ruta: '/admin/crear' },
            { label: 'Nuevo Equipo',   icon: '⚽', ruta: '/admin/equipos' },
            { label: 'Nuevo Jugador',  icon: '👤', ruta: '/admin/jugadores' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.ruta)}
              style={{
                background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px',
                padding: '14px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '10px', fontSize: '.8rem',
                color: '#202124', fontWeight: '500', transition: 'all .15s',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'}
            >
              <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
