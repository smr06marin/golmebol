import { Star } from 'lucide-react'

// Estrella para seguir / dejar de seguir un equipo. El área táctil es de 30px (configurable con `area`)
// (más grande que el dibujo) para que se pueda tocar bien en el celular, y
// detiene el clic para no activar la fila o tarjeta donde está metida.
export default function BotonEstrella({ activo, onClick, nombre = 'el equipo', size = 16, area = 30, colorOff = '#6b7280', colorOn = '#f5a623' }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); e.preventDefault(); onClick?.() }}
      aria-pressed={!!activo}
      aria-label={activo ? `Dejar de seguir a ${nombre}` : `Seguir a ${nombre}`}
      title={activo ? 'Dejar de seguir' : 'Seguir equipo'}
      style={{ width: area, height: area, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
    >
      <Star size={size} color={activo ? colorOn : colorOff} fill={activo ? colorOn : 'none'} strokeWidth={2}/>
    </button>
  )
}
