import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Botón flotante fijo "Volver al inicio" — se muestra en TODAS las páginas
// del dominio propio de un organizador (torneo, reservar cancha, pedir
// cancha, etc.) para que el visitante siempre pueda volver a la vitrina
// principal de ese organizador sin usar el botón "atrás" del navegador.
// No se muestra en la vitrina misma (pathname "/"), porque ahí ya está en
// el inicio.
export default function BotonVolverInicio() {
  const location = useLocation()
  if (location.pathname === '/') return null

  return (
    <Link
      to="/"
      aria-label="Volver al inicio"
      style={{
        position: 'fixed',
        left: '10px',
        bottom: '10px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '9px 14px 9px 11px',
        borderRadius: '999px',
        background: 'rgba(10, 10, 16, .78)',
        backdropFilter: 'blur(3px)',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        color: '#fff',
        fontSize: '.78rem',
        fontWeight: '700',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <ArrowLeft size={15} /> Inicio
    </Link>
  )
}
