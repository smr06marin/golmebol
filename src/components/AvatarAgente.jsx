// Dibujo del asistente del chat de ayuda (secretario con audífonos). SVG propio, sin imágenes externas.
export default function AvatarAgente({ agente, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={agente.nombre} style={{ flexShrink: 0, borderRadius: '50%', display: 'block' }}>
      <rect width="48" height="48" fill={agente.fondo} />
      <path d="M5 48c0-9.5 8.5-14.5 19-14.5S43 38.5 43 48z" fill="#2f3a6b" />
      <path d="M19.2 33.8L24 41l4.8-7.2z" fill="#fff" />
      <path d="M24 36.5l-1.9 3 1.9 8.5 1.9-8.5z" fill={agente.corbata} />
      <rect x="21" y="28" width="6" height="7" rx="2" fill={agente.cuello} />
      <ellipse cx="24" cy="21" rx="8" ry="9" fill={agente.piel} />
      <path d="M15.8 20.5c-.4-6.5 3.5-10.3 8.2-10.3s8.6 3.8 8.2 10.3c-1.6-3.2-4.3-4.8-8.2-4.8s-6.6 1.6-8.2 4.8z" fill={agente.pelo} />
      <circle cx="20.7" cy="22" r="1.05" fill="#3b2b24" />
      <circle cx="27.3" cy="22" r="1.05" fill="#3b2b24" />
      {agente.gafas && <g fill="none" stroke="#2b2b2b" strokeWidth="0.9"><circle cx="20.7" cy="22" r="2.6" /><circle cx="27.3" cy="22" r="2.6" /><path d="M23.3 22h1.4" /></g>}
      <path d="M21 26q3 2.6 6 0" fill="none" stroke="#b5654a" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14.6 21c0-6.8 4.1-11 9.4-11s9.4 4.2 9.4 11" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" />
      <rect x="12.6" y="19.5" width="3.3" height="6.2" rx="1.65" fill="#1a73e8" />
      <rect x="32.1" y="19.5" width="3.3" height="6.2" rx="1.65" fill="#1a73e8" />
      <path d="M33.8 25.5c0 3.2-2.2 4.8-5.3 4.8" fill="none" stroke="#1a73e8" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28.3" cy="30.3" r="1.4" fill="#1a73e8" />
    </svg>
  )
}
