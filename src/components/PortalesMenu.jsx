import { useNavigate } from 'react-router-dom'

const PALETAS = {
  dark:  { border: '#1e2d3d', muted: '#7a9ab5' },
  light: { border: '#dadce0', muted: '#5f6368' },
}

// Menú compartido de "cambiar de portal": aparece en la cabecera de las
// páginas de cada rol (jugador, árbitro, coordinador de árbitros, profesor/
// coordinador de escuela) para saltar entre los portales que tenga esa misma
// cuenta, resaltando en cuál está parado ahora mismo. Si la cuenta solo tiene
// un rol, no se muestra (no hay a dónde más ir).
export default function PortalesMenu({ usuario, actual, theme = 'dark' }) {
  const navigate = useNavigate()
  if (!usuario) return null
  const c = PALETAS[theme] || PALETAS.dark

  const opciones = []
  if (usuario.rol !== 'arbitro' && usuario.rol !== 'profesor') {
    opciones.push({ key: 'jugador', label: '👤 Jugador', to: '/jugador', color: '#00ddd0', bg: 'rgba(0,221,208,.15)' })
  }
  if (usuario.es_arbitro || usuario.rol === 'arbitro') {
    opciones.push({ key: 'arbitro', label: '🟡 Árbitro', to: '/arbitro', color: '#f9a825', bg: 'rgba(249,168,37,.15)' })
  }
  if (usuario.es_arbitro_lider) {
    opciones.push({ key: 'arbitro_lider', label: '👑 Coord. Árbitros', to: '/arbitro/lider', color: '#f9a825', bg: 'rgba(249,168,37,.15)' })
  }
  if (usuario.es_profesor || usuario.es_profesor_coordinador || usuario.rol === 'profesor') {
    opciones.push({
      key: 'profesor',
      label: usuario.es_profesor_coordinador ? '👑 Coord. Escuela' : '🧑‍🏫 Profesor',
      to: '/escuela', color: '#00ddd0', bg: 'rgba(0,221,208,.15)',
    })
  }

  if (opciones.length <= 1) return null

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {opciones.map(o => {
        const isActual = o.key === actual
        return (
          <button key={o.key} onClick={() => !isActual && navigate(o.to)} disabled={isActual}
            style={{
              background: isActual ? o.bg : 'none',
              border: `1px solid ${isActual ? o.color + '66' : c.border}`,
              borderRadius: '8px', padding: '6px 11px', cursor: isActual ? 'default' : 'pointer',
              color: isActual ? o.color : c.muted, fontSize: '.72rem', fontWeight: '700',
              opacity: isActual ? 1 : .85, whiteSpace: 'nowrap',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
