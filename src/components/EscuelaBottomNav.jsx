import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, BarChart3 } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import { supabase } from '../lib/supabase'

// Barra fija de abajo para todas las páginas del portal de escuela — el
// botón del medio siempre vuelve al panel principal (/escuela), sin
// importar en qué sub-página esté el profesor/coordinador. Muestra el
// escudo de la escuela si ya tiene uno subido; si no, un balón por
// defecto. "Inicio" y "Estadísticas" todavía no llevan a ningún lado (a
// definir más adelante).
export default function EscuelaBottomNav() {
  const navigate = useNavigate()
  const [logoUrl, setLogoUrl] = useState(null)

  useEffect(() => {
    let cancelado = false
    async function fetchLogo() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('players').select('escuela_id').eq('user_id', user.id).single()
      if (!p?.escuela_id || cancelado) return
      const { data: esc } = await supabase.from('teams').select('logo_url').eq('id', p.escuela_id).single()
      if (!cancelado) setLogoUrl(esc?.logo_url || null)
    }
    fetchLogo()
    return () => { cancelado = true }
  }, [])

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
          background: logoUrl ? '#fff' : 'linear-gradient(135deg, #22c55e, #16a34a)',
          border: '3px solid #0a0a14', overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(34,197,94,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, padding: logoUrl ? '4px' : 0,
        }}>
        {logoUrl
          ? <img src={logoUrl} alt="Escudo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
          : <GiSoccerBall size={26} color="#07070e"/>}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: '#7a9ab5' }}>
        <BarChart3 size={18}/>
        <span style={{ fontSize: '.58rem', fontWeight: '700' }}>ESTADÍSTICAS</span>
      </div>
    </div>
  )
}
