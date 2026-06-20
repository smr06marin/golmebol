import { useNavigate } from 'react-router-dom'

const SECCIONES = [
  { label: 'TORNEOS',   icon: '🏆', ruta: '/admin/torneos',    desc: 'Crear y gestionar torneos' },
  { label: 'EQUIPOS',   icon: '⚽', ruta: '/admin/equipos',    desc: 'Equipos y escudos' },
  { label: 'JUGADORES', icon: '👤', ruta: '/admin/jugadores',  desc: 'Jugadores y fotos' },
  { label: 'FECHAS',    icon: '📅', ruta: '/admin/fechas',     desc: 'Jornadas y partidos' },
  { label: 'RESULTADOS',icon: '📊', ruta: '/admin/resultados', desc: 'Ingresar resultados' },
  { label: 'SPONSORS',  icon: '🎯', ruta: '/admin/sponsors',   desc: 'Patrocinadores' },
]

export default function AdminPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #07070e 0%, #0a0a1a 100%)',
      padding: '1.5rem 1rem',
      color: '#fff',
      fontFamily: 'var(--font-display)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <div style={{ fontSize: '1.4rem', letterSpacing: '.15em', background: 'linear-gradient(90deg,#00ddd0,#9955ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            GOLMEBOL
          </div>
          <div style={{ fontSize: '.55rem', letterSpacing: '.2em', color: 'rgba(255,255,255,.4)', marginTop: '2px' }}>
            PANEL ADMINISTRADOR
          </div>
        </div>
        <button onClick={() => navigate('/')}
          style={{ background: 'rgba(0,210,200,.06)', border: '1px solid rgba(0,210,200,.22)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#00ddd0', fontSize: '.5rem', letterSpacing: '.1em' }}>
          ← VOLVER
        </button>
      </div>

      {/* Grid secciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {SECCIONES.map(s => (
          <div key={s.ruta} onClick={() => navigate(s.ruta)}
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: '16px',
              padding: '1.5rem 1rem',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '.6rem',
              transition: 'all .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,210,200,.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
          >
            <span style={{ fontSize: '2.5rem' }}>{s.icon}</span>
            <span style={{ fontSize: '.7rem', letterSpacing: '.18em', color: '#00ddd0' }}>{s.label}</span>
            <span style={{ fontSize: '.45rem', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', textAlign: 'center' }}>{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
