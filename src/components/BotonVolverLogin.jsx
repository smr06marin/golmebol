import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Botón "VOLVER" fijo arriba a la izquierda en las pantallas de ingreso
// (admin y jugador): lleva a la portada de Golmebol. Funciona igual en la web
// y en la app (usa el router, no el botón "atrás" del navegador).
// tema: 'oscuro' (login admin) | 'claro' (login jugador).
export default function BotonVolverLogin({ tema = 'oscuro' }) {
  const claro = tema === 'claro'
  return (
    <Link
      to="/"
      aria-label="Volver al inicio"
      style={{
        position: 'fixed',
        top: 'calc(10px + env(safe-area-inset-top, 0px))',
        left: '10px',
        zIndex: 60,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 15px 10px 12px',
        borderRadius: '999px',
        background: claro ? '#fff' : 'rgba(255,255,255,.08)',
        border: claro ? '1px solid #dadce0' : '1px solid rgba(255,255,255,.2)',
        color: claro ? '#202124' : '#fff',
        fontSize: '.8rem',
        fontWeight: 800,
        letterSpacing: '.04em',
        textDecoration: 'none',
        boxShadow: claro ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
        WebkitTapHighlightColor: 'transparent',
        whiteSpace: 'nowrap',
      }}
    >
      <ArrowLeft size={16} strokeWidth={2.6} /> VOLVER
    </Link>
  )
}
