import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home } from 'lucide-react'

// Botón flotante "Inicio" para volver a la portada de Golmebol desde las
// páginas PÚBLICAS (tabla de un torneo, vitrina de organizador, escenarios,
// historial de equipo, records...). Pensado para no estorbar:
//  · es chico y va abajo a la izquierda (la marca de agua va arriba a la derecha);
//  · los primeros segundos muestra "Inicio" con una casita para que se entienda
//    qué hace, y después se encoge a solo la casita, más transparente;
//  · queda por debajo de los modales/ventanas (z-index menor), así no los tapa;
//  · respeta la barra de abajo del iPhone (safe-area).
// No aparece en la portada, ni en admin, login, planillas ni paneles de jugador/
// árbitro/escuela/escenario (ahí ya hay su propia navegación). En dominios propios
// de organizadores se usa BotonVolverInicio (a la vitrina de ese organizador).
const RUTAS_PUBLICAS = [/^\/t\/[^/]+/, /^\/organizador\/[^/]+/, /^\/reservar\/[^/]+/, /^\/pedir\/[^/]+/, /^\/equipos\/[^/]+/, /^\/escenarios\/?$/, /^\/records\/?$/]

export default function BotonInicioGolmebol() {
  const { pathname } = useLocation()
  const visible = RUTAS_PUBLICAS.some(r => r.test(pathname))
  const [expandido, setExpandido] = useState(true)

  // Cada vez que se entra a una página pública, se muestra con texto unos segundos y se encoge.
  useEffect(() => {
    setExpandido(true)
    const t = setTimeout(() => setExpandido(false), 4000)
    return () => clearTimeout(t)
  }, [pathname])

  if (!visible) return null

  return (
    <Link
      to="/"
      aria-label="Volver al inicio de Golmebol"
      title="Volver al inicio"
      style={{
        position: 'fixed',
        left: '10px',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        zIndex: 450,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expandido ? '6px' : 0,
        height: '36px',
        minWidth: '36px',
        padding: expandido ? '0 13px 0 10px' : '0',
        borderRadius: '999px',
        background: 'rgba(10, 10, 16, .72)',
        border: '1px solid rgba(255,255,255,.14)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,.28)',
        color: '#fff',
        fontSize: '.76rem',
        fontWeight: 700,
        letterSpacing: '.02em',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        opacity: expandido ? 1 : 0.62,
        transition: 'padding .3s ease, gap .3s ease, opacity .3s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Home size={16} strokeWidth={2.4} />
      {expandido && <span>Inicio</span>}
    </Link>
  )
}
