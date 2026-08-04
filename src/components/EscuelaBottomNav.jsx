import { useNavigate } from 'react-router-dom'
import { Home, BarChart3 } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'

// Barra fija de abajo para todas las páginas del portal de escuela — el
// balón del medio siempre vuelve al panel principal (/escuela), sin
// importar en qué sub-página esté el profesor/coordinador. "Inicio" y
// "Estadísticas" todavía no llevan a ningún lado (a definir más adelante).
export default function EscuelaBottomNav() {
  const navigate = useNavigate()
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: '#0a0a14', borderTop: '1px solid #1e2d3d',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom)', height: '58px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: '#7a9ab5' }}>
        <Home size={18}/>
        <span style={{ fontSize: '.58rem', fontWeight: '700' }}>INICIO</span>
      </div>

      <button onClick={() => navigate('/escuela')} title="Panel principal"
        style={{
          width: '58px', height: '58px', borderRadius: '50%', marginTop: '-26px',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: '3px solid #0a0a14',
          boxShadow: '0 4px 16px rgba(34,197,94,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}>
        <GiSoccerBall size={26} color="#07070e"/>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: '#7a9ab5' }}>
        <BarChart3 size={18}/>
        <span style={{ fontSize: '.58rem', fontWeight: '700' }}>ESTADÍSTICAS</span>
      </div>
    </div>
  )
}
