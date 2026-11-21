import { plataformaDeStream } from '../lib/liveMatch'

// Botón discreto "Ver en YouTube / Facebook / Instagram" que va dentro del partido en vivo (Partidos de hoy y minuto a
// minuto). Pequeño y elegante, pero con área de toque cómoda en cualquier celular (Android o iPhone).
const COLORES = { YouTube: '#ff0033', Facebook: '#1877f2', Instagram: '#e1306c' }

function Icono({ plataforma, size }) {
  const c = COLORES[plataforma] || COLORES.YouTube
  if (plataforma === 'Facebook') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="12" fill={c}/>
        <path d="M13.4 19v-6h2l.3-2.4h-2.3V9.1c0-.7.2-1.1 1.2-1.1h1.2V5.9c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.7h-2V13h2v6h2.4z" fill="#fff"/>
      </svg>
    )
  }
  if (plataforma === 'Instagram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect width="24" height="24" rx="7" fill={c}/>
        <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.8"/>
        <circle cx="12" cy="12" r="2.8" fill="none" stroke="#fff" strokeWidth="1.8"/>
      </svg>
    )
  }
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 24 17" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="24" height="17" rx="5" fill={c}/>
      <path d="M9.6 4.8v7.4l6.2-3.7z" fill="#fff"/>
    </svg>
  )
}

export default function BotonTransmision({ stream, grande = false, style }) {
  if (!stream?.url) return null
  const plataforma = plataformaDeStream(stream.url)
  const c = COLORES[plataforma] || COLORES.YouTube
  return (
    <a href={stream.url} target="_blank" rel="noopener noreferrer"
      onClick={ev => ev.stopPropagation()} onKeyDown={ev => ev.stopPropagation()}
      aria-label={`Ver la transmisión en vivo en ${plataforma}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: grande ? '9px' : '7px',
        minHeight: grande ? '42px' : '34px', padding: grande ? '0 18px' : '0 13px', borderRadius: '999px',
        background: '#151515', border: `1px solid ${c}55`, color: '#eaeaea',
        fontWeight: 700, fontSize: grande ? '.86rem' : '.76rem', letterSpacing: '.01em',
        textDecoration: 'none', whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent', ...style,
      }}>
      <Icono plataforma={plataforma} size={grande ? 20 : 17}/>
      Ver en {plataforma}
    </a>
  )
}
