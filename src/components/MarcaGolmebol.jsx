import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home } from 'lucide-react'

// Sello de la plataforma: logo + "Creada por GOLMEBOL", visible en todas las
// páginas. Se monta una sola vez en App.jsx (igual que SessionGuard).
//
// DOS versiones:
//
//  1) MarcaEstatica — el sello de siempre, arriba a la derecha y con
//     pointer-events: none para que nunca tape un botón real (en las planillas
//     se baja abajo, ver index.css). Se usa en toda la app y en los dominios
//     propios de organizadores (ahí se monta fuera del router, por eso no usa
//     hooks de router).
//
//  2) MarcaConInicio — en las páginas PÚBLICAS de golmebol.com (tabla de un
//     torneo, vitrina de organizador, escenarios, reservas, historial de equipo,
//     records) el MISMO sello pasa a ser el botón "ir al inicio de Golmebol":
//       · lleva una casita al lado del texto para que se entienda que es un botón;
//       · va abajo a la izquierda, no arriba a la derecha: arriba chocaba con las
//         pestañas de la tabla (Posiciones/Resultados/Próximos/Calendario) y, siendo
//         clicable, las habría bloqueado;
//       · los primeros segundos se ve completo y después se encoge a logo + casita
//         (más transparente) para no estorbar;
//       · queda por debajo de modales/ventanas (z-index menor) y respeta la barra
//         de gestos de abajo (safe-area; en Android vale 0).
//     En la portada ("/") y en el resto de rutas se ve el sello estático.
const imgStyle = { height: '13px', width: 'auto', display: 'block', opacity: 0.95 }

const textStyle = {
  fontSize: '.62rem',
  fontWeight: '600',
  letterSpacing: '.02em',
  color: 'rgba(255,255,255,.88)',
  whiteSpace: 'nowrap',
}

const RUTAS_PUBLICAS = [/^\/t\/[^/]+/, /^\/organizador\/[^/]+/, /^\/reservar\/[^/]+/, /^\/pedir\/[^/]+/, /^\/equipos\/[^/]+/, /^\/e\/[^/]+/, /^\/j\/[^/]+/, /^\/escenarios\/?$/, /^\/records\/?$/]

function MarcaEstatica() {
  return (
    <div className="gm-marca-golmebol" aria-hidden="true">
      <img src="/marca/watermark-logo.png" alt="" style={imgStyle} />
      <span style={textStyle}>Creada por GOLMEBOL</span>
    </div>
  )
}

function MarcaConInicio() {
  const { pathname } = useLocation()
  const esPublica = RUTAS_PUBLICAS.some(r => r.test(pathname))
  const [expandido, setExpandido] = useState(true)

  // En cada página pública se ve completo unos segundos y luego se encoge.
  useEffect(() => {
    setExpandido(true)
    const t = setTimeout(() => setExpandido(false), 5000)
    return () => clearTimeout(t)
  }, [pathname])

  if (!esPublica) return <MarcaEstatica />

  return (
    <Link
      to="/"
      aria-label="Ir al inicio de Golmebol"
      title="Ir al inicio de Golmebol"
      style={{
        position: 'fixed',
        left: '10px',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        zIndex: 450,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: '34px',
        padding: expandido ? '0 11px 0 9px' : '0 10px 0 9px',
        borderRadius: '999px',
        background: 'rgba(10, 10, 16, .78)',
        border: '1px solid rgba(255,255,255,.16)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        textDecoration: 'none',
        opacity: expandido ? 1 : 0.68,
        transition: 'opacity .3s ease',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
    >
      <img src="/marca/watermark-logo.png" alt="" style={{ ...imgStyle, height: '15px' }} />
      {expandido && <span style={textStyle}>Creada por GOLMEBOL</span>}
      <span style={{ width: '1px', height: '15px', background: 'rgba(255,255,255,.25)', flexShrink: 0 }} />
      <Home size={15} strokeWidth={2.4} color="#fff" style={{ flexShrink: 0 }} />
    </Link>
  )
}

export default function MarcaGolmebol({ conInicio = false }) {
  return conInicio ? <MarcaConInicio /> : <MarcaEstatica />
}
