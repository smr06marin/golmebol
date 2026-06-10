export default function DesignValla() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 340 492" fill="none">
      <defs>
        <linearGradient id="brdV" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" stopOpacity="1"/>
          <stop offset="50%" stopColor="#ffaa00" stopOpacity=".9"/>
          <stop offset="100%" stopColor="#ff6600" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="bgV" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#2a1800"/>
          <stop offset="30%" stopColor="#1a0e00"/>
          <stop offset="100%" stopColor="#0a0500"/>
        </linearGradient>
        <radialGradient id="glowV" cx="50%" cy="25%" r="55%">
          <stop offset="0%" stopColor="#ffd700" stopOpacity=".18"/>
          <stop offset="100%" stopColor="#ffd700" stopOpacity="0"/>
        </radialGradient>
        <clipPath id="activeCardClip" clipPathUnits="objectBoundingBox" transform="scale(0.002941,0.002033)">
          <path d="M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z"/>
        </clipPath>
      </defs>

      {/* Fondo dorado oscuro */}
      <path d="M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z" fill="url(#bgV)"/>

      {/* Brillo radial dorado */}
      <path d="M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z" fill="url(#glowV)"/>

      {/* Borde dorado exterior grueso */}
      <path d="M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z" fill="none" stroke="url(#brdV)" strokeWidth="5"/>

      {/* Borde interior dorado sutil */}
      <path d="M 23 4 L 121 4 L 134 13 L 153 5.5 L 170 4 L 187 5.5 L 206 13 L 217 4 L 317 4 Q 333 4 335 20 L 335 379 Q 335 417 302 442 Q 276 459 242 469 Q 217 477 170 478 Q 123 477 98 469 Q 64 459 38 442 Q 5 417 5 379 L 5 20 Q 7 4 23 4 Z" fill="none" stroke="rgba(255,215,0,.25)" strokeWidth="1.5"/>

      {/* Detalles top dorados */}
      <line x1="170" y1="0" x2="170" y2="29" stroke="rgba(255,215,0,.8)" strokeWidth="1.5"/>
      <line x1="134" y1="10" x2="134" y2="27" stroke="rgba(255,215,0,.5)" strokeWidth="1"/>
      <line x1="206" y1="10" x2="206" y2="27" stroke="rgba(255,215,0,.5)" strokeWidth="1"/>

      {/* Arco inferior dorado */}
      <path d="M 96 476 Q 133 490 170 492 Q 207 490 244 476" fill="none" stroke="rgba(255,215,0,.4)" strokeWidth="1.5"/>

      {/* Estrella trofeo arriba centro */}
      <text x="170" y="18" textAnchor="middle" fill="rgba(255,215,0,.7)" fontSize="10" fontFamily="Arial">🏆</text>

      {/* Esquinas decorativas */}
      <circle cx="20" cy="20" r="3" fill="rgba(255,215,0,.4)"/>
      <circle cx="320" cy="20" r="3" fill="rgba(255,215,0,.4)"/>
    </svg>
  )
}