// Misma forma que el SVG genérico de PlayerCard (CARD_PATH)
// Estructura única: picos arriba + bordes redondeados abajo

const PALETA = {
    inicio: {
      c:    '#4488FF',
      c2:   '#88BBFF',
      bg:   ['#020A2A', '#0A2060', '#0D3AAE'],
      glow: '#1155EE',
    },
    bronce: {
      c:    '#CC6622',
      c2:   '#FF9944',
      bg:   ['#180800', '#3A1600', '#5A2800'],
      glow: '#994400',
    },
    plata: {
      c:    '#AAAACC',
      c2:   '#DDDDEE',
      bg:   ['#0A0A14', '#222230', '#3A3A4A'],
      glow: '#777799',
    },
    oro: {
      c:    '#FFCC00',
      c2:   '#FFE840',
      bg:   ['#140E00', '#382800', '#5A4000'],
      glow: '#CC9900',
    },
    legendario: {
      c:    '#00CC66',
      c2:   '#00FF88',
      bg:   ['#060010', '#0E0028', '#1A0040'],
      glow: '#008844',
    },
  }
  
  export default function DesignNivel2({ variant = 'inicio', clipId = 'activeCardClip' }) {
    const p = PALETA[variant] || PALETA.inicio
    const c  = p.c
    const c2 = p.c2
  
    const SHAPE = "M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z"
    const INNER = "M 23 4 L 121 4 L 134 13 L 153 5.5 L 170 4 L 187 5.5 L 206 13 L 217 4 L 317 4 Q 333 4 335 20 L 335 379 Q 335 417 302 442 Q 276 459 242 469 Q 217 477 170 478 Q 123 477 98 469 Q 64 459 38 442 Q 5 417 5 379 L 5 20 Q 7 4 23 4 Z"
  
    return (
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox="0 0 340 492"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradientes de borde */}
          <linearGradient id={`n2Brd_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={c2}/>
            <stop offset="30%"  stopColor="#ffffff" stopOpacity=".6"/>
            <stop offset="60%"  stopColor={c}/>
            <stop offset="100%" stopColor={c}/>
          </linearGradient>
          <linearGradient id={`n2BrdInner_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={c}  stopOpacity=".7"/>
            <stop offset="50%"  stopColor={c2} stopOpacity=".35"/>
            <stop offset="100%" stopColor={c}  stopOpacity=".7"/>
          </linearGradient>
          <linearGradient id={`n2Shine_${variant}`} x1="0%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity=".55"/>
            <stop offset="100%" stopColor={c}       stopOpacity="0"/>
          </linearGradient>
          {/* Fondo */}
          <linearGradient id={`n2Bg_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={p.bg[0]}/>
            <stop offset="50%"  stopColor={p.bg[1]}/>
            <stop offset="100%" stopColor={p.bg[2]}/>
          </linearGradient>
          <radialGradient id={`n2BgGlow_${variant}`} cx="50%" cy="38%" r="55%">
            <stop offset="0%"   stopColor={c} stopOpacity=".20"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </radialGradient>
          {/* Rayos */}
          <linearGradient id={`n2Ray1_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={c}  stopOpacity="0"/>
            <stop offset="40%"  stopColor={c}  stopOpacity=".35"/>
            <stop offset="60%"  stopColor="#ffffff" stopOpacity=".12"/>
            <stop offset="100%" stopColor={c}  stopOpacity="0"/>
          </linearGradient>
          <linearGradient id={`n2Ray2_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={c2} stopOpacity="0"/>
            <stop offset="45%"  stopColor={c2} stopOpacity=".22"/>
            <stop offset="100%" stopColor={c2} stopOpacity="0"/>
          </linearGradient>
          {/* Gema */}
          <radialGradient id={`n2Gem_${variant}`} cx="40%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity=".9"/>
            <stop offset="30%"  stopColor={c2}      stopOpacity=".8"/>
            <stop offset="70%"  stopColor={c}       stopOpacity=".6"/>
            <stop offset="100%" stopColor="#000020" stopOpacity=".8"/>
          </radialGradient>
          <radialGradient id={`n2GemGlow_${variant}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={c} stopOpacity=".7"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </radialGradient>
          {/* Filtros */}
          <filter id={`n2Glow_${variant}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <filter id="n2Soft"><feGaussianBlur stdDeviation="2"/></filter>
          <filter id={`n2GemF_${variant}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox" transform="scale(0.002941,0.002033)">
            <path d={SHAPE}/>
          </clipPath>
        </defs>
  
        {/* ── EXTENSIONES LATERALES ── */}
        <rect x="-20" y="255" width="24" height="60" rx="3" fill={c} opacity=".45"/>
        <rect x="-20" y="255" width="24" height="60" rx="3" fill="none" stroke={c} strokeWidth="1.5" opacity=".9"/>
        <rect x="-16" y="259" width="15" height="52" rx="2" fill="none" stroke="#ffffff" strokeWidth=".5" opacity=".3"/>
        <line x1="-20" y1="270" x2="4" y2="270" stroke="#ffffff" strokeWidth=".8" opacity=".3"/>
        <line x1="-20" y1="285" x2="4" y2="285" stroke="#ffffff" strokeWidth=".8" opacity=".3"/>
        <line x1="-20" y1="300" x2="4" y2="300" stroke="#ffffff" strokeWidth=".5" opacity=".2"/>
        {/* Triángulo decorativo izquierdo */}
        <polygon points="-20,240 -4,248 -4,255 -20,255" fill={c} opacity=".3"/>
        <polygon points="-20,315 -4,315 -4,322 -20,330" fill={c} opacity=".25"/>
  
        <rect x="336" y="255" width="24" height="60" rx="3" fill={c} opacity=".45"/>
        <rect x="336" y="255" width="24" height="60" rx="3" fill="none" stroke={c} strokeWidth="1.5" opacity=".9"/>
        <rect x="341" y="259" width="15" height="52" rx="2" fill="none" stroke="#ffffff" strokeWidth=".5" opacity=".3"/>
        <line x1="336" y1="270" x2="360" y2="270" stroke="#ffffff" strokeWidth=".8" opacity=".3"/>
        <line x1="336" y1="285" x2="360" y2="285" stroke="#ffffff" strokeWidth=".8" opacity=".3"/>
        <line x1="336" y1="300" x2="360" y2="300" stroke="#ffffff" strokeWidth=".5" opacity=".2"/>
        <polygon points="360,240 344,248 344,255 360,255" fill={c} opacity=".3"/>
        <polygon points="360,315 344,315 344,322 360,330" fill={c} opacity=".25"/>
  
        {/* ── SOMBRA EXTERIOR ── */}
        <path d={SHAPE} fill="rgba(0,0,0,.65)" filter="url(#n2Soft)" transform="translate(3,5)"/>
  
        {/* ── FONDO ── */}
        <path d={SHAPE} fill={`url(#n2Bg_${variant})`}/>
        <path d={SHAPE} fill={`url(#n2BgGlow_${variant})`} opacity=".85"/>
  
        {/* ── TEXTURA INTERNA — patrón de rombos ── */}
        <g opacity=".07" stroke={c} fill="none" strokeWidth=".6">
          {[0,1,2,3,4,5,6,7,8].map(row =>
            [0,1,2,3,4,5,6].map(col => (
              <polygon key={`${row}-${col}`}
                points={`${30 + col*42},${20 + row*52} ${51 + col*42},${46 + row*52} ${30 + col*42},${72 + row*52} ${9 + col*42},${46 + row*52}`}
              />
            ))
          )}
        </g>
  
        {/* ── RAYOS DIAGONALES ── */}
        <polygon points="50,0 190,0 340,230 340,340 210,340 30,80"
          fill={`url(#n2Ray1_${variant})`} opacity=".55"/>
        <polygon points="100,0 170,0 340,280 340,360 290,360 70,60"
          fill={`url(#n2Ray2_${variant})`} opacity=".40"/>
        <line x1="80" y1="0" x2="340" y2="340" stroke={c} strokeWidth="1" opacity=".15"/>
        <line x1="130" y1="0" x2="340" y2="280" stroke="#ffffff" strokeWidth=".5" opacity=".08"/>
  
        {/* ── DETALLE PICOS SUPERIORES — líneas que bajan de los picos ── */}
        <line x1="170" y1="0"  x2="170" y2="32" stroke={c2} strokeWidth="2"   opacity=".9"/>
        <line x1="134" y1="10" x2="134" y2="30" stroke={c}  strokeWidth="1.2" opacity=".7"/>
        <line x1="206" y1="10" x2="206" y2="30" stroke={c}  strokeWidth="1.2" opacity=".7"/>
        <line x1="154" y1="2"  x2="154" y2="22" stroke={c}  strokeWidth=".8"  opacity=".5"/>
        <line x1="186" y1="2"  x2="186" y2="22" stroke={c}  strokeWidth=".8"  opacity=".5"/>
        <line x1="120" y1="0"  x2="120" y2="18" stroke={c}  strokeWidth=".8"  opacity=".4"/>
        <line x1="220" y1="0"  x2="220" y2="18" stroke={c}  strokeWidth=".8"  opacity=".4"/>
        {/* Punto en pico central */}
        <circle cx="170" cy="0" r="4" fill={c2} opacity=".95"/>
        <circle cx="170" cy="0" r="7" fill="none" stroke={c} strokeWidth="1" opacity=".5"/>
        <circle cx="134" cy="10" r="2.5" fill={c} opacity=".8"/>
        <circle cx="206" cy="10" r="2.5" fill={c} opacity=".8"/>
  
        {/* ── LÍNEAS LATERALES ── */}
        {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((y, i) => (
          <g key={i}>
            <line x1="0"   y1={y} x2="8"   y2={y} stroke={c} strokeWidth="1.5" opacity=".45"/>
            <line x1="332" y1={y} x2="340" y2={y} stroke={c} strokeWidth="1.5" opacity=".45"/>
          </g>
        ))}
  
        {/* ── MUESCAS LATERALES ── */}
        <rect x="0"   y="150" width="10" height="3" rx="1" fill={c} opacity=".65"/>
        <rect x="0"   y="157" width="6"  height="2" rx="1" fill={c} opacity=".45"/>
        <rect x="330" y="150" width="10" height="3" rx="1" fill={c} opacity=".65"/>
        <rect x="334" y="157" width="6"  height="2" rx="1" fill={c} opacity=".45"/>
  
        {/* ── PUNTOS DECORATIVOS ESQUINA ── */}
        <g opacity=".22">
          {[0,1,2,3,4].map(row =>
            [0,1,2,3].map(col => (
              <circle key={`${row}-${col}`}
                cx={225 + col * 15}
                cy={55  + row * 15}
                r="1.5"
                fill={c}
                opacity={.45 - row * .06}
              />
            ))
          )}
        </g>
  
        {/* ── LÍNEA SEPARADORA MEDIA ── */}
        <line x1="20"  y1="370" x2="320" y2="370" stroke={c} strokeWidth="1"   opacity=".28"/>
        <line x1="35"  y1="374" x2="305" y2="374" stroke={c} strokeWidth=".5"  opacity=".18"/>
  
        {/* ── ARC INFERIOR — curva decorativa ── */}
        <path d="M 96 476 Q 133 490 170 492 Q 207 490 244 476"
          fill="none" stroke={c} strokeWidth="1.5" opacity=".5"/>
        <path d="M 105 472 Q 137 484 170 486 Q 203 484 235 472"
          fill="none" stroke={c2} strokeWidth=".8" opacity=".3"/>
  
        {/* ── MARCO INTERIOR ── */}
        <path d={INNER} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="6"/>
        <path d={INNER} fill="none" stroke={`url(#n2BrdInner_${variant})`} strokeWidth="2" opacity=".65"/>
        <path d={INNER} fill="none" stroke="#ffffff" strokeWidth=".5" opacity=".18"/>
  
        {/* ── MARCO EXTERIOR ── */}
        <path d={SHAPE} fill="none" stroke={`url(#n2Brd_${variant})`}  strokeWidth="5.5" filter={`url(#n2Glow_${variant})`}/>
        <path d={SHAPE} fill="none" stroke={`url(#n2Shine_${variant})`} strokeWidth="2.5" opacity=".55"/>
        <path d={SHAPE} fill="none" stroke={c} strokeWidth="1" opacity=".35"/>
  
        {/* ── GEMA INFERIOR ── */}
        <circle cx="170" cy="492" r="22" fill={`url(#n2GemGlow_${variant})`} opacity=".45"/>
        <polygon points="170,510 188,500 188,480 170,470 152,480 152,500"
          fill={c} opacity=".30" filter={`url(#n2GemF_${variant})`}/>
        <polygon points="170,510 188,500 188,480 170,470 152,480 152,500"
          fill="none" stroke={c} strokeWidth="2.5" opacity=".88"/>
        <polygon points="170,505 185,496 185,482 170,473 155,482 155,496"
          fill={c} opacity=".18"/>
        <polygon points="170,505 185,496 185,482 170,473 155,482 155,496"
          fill="none" stroke="#ffffff" strokeWidth=".8" opacity=".30"/>
        <polygon points="170,500 182,493 182,483 170,476 158,483 158,493"
          fill={`url(#n2Gem_${variant})`} opacity=".92"/>
        <polygon points="164,478 170,474 176,478 170,484" fill="#ffffff" opacity=".48"/>
        <line x1="170" y1="476" x2="170" y2="500" stroke="#ffffff" strokeWidth=".5" opacity=".28"/>
        <line x1="158" y1="483" x2="182" y2="493" stroke="#ffffff" strokeWidth=".5" opacity=".18"/>
        <line x1="182" y1="483" x2="158" y2="493" stroke="#ffffff" strokeWidth=".5" opacity=".18"/>
  
        {/* ── MICRO SCRATCHES ── */}
        <g opacity=".05" stroke="#ffffff" strokeWidth=".3" fill="none">
          <line x1="28"  y1="22"  x2="55"  y2="19"/>
          <line x1="65"  y1="38"  x2="95"  y2="35"/>
          <line x1="258" y1="24"  x2="298" y2="21"/>
          <line x1="248" y1="55"  x2="298" y2="51"/>
          <line x1="48"  y1="360" x2="82"  y2="356"/>
          <line x1="245" y1="352" x2="285" y2="348"/>
          <line x1="108" y1="440" x2="145" y2="436"/>
          <line x1="195" y1="448" x2="238" y2="444"/>
        </g>
  
        {/* ── GLOW FINAL ── */}
        <path d={SHAPE} fill="none" stroke={c} strokeWidth="18" opacity=".05" filter="url(#n2Soft)"/>
  
        {/* ── PUNTOS ESQUINAS ── */}
        <circle cx="20"  cy="0"   r="3" fill={c2} opacity=".85"/>
        <circle cx="320" cy="0"   r="3" fill={c2} opacity=".85"/>
        <circle cx="0"   cy="380" r="3" fill={c}  opacity=".65"/>
        <circle cx="340" cy="380" r="3" fill={c}  opacity=".65"/>
        <circle cx="170" cy="0"   r="5" fill={c2} opacity=".95"/>
  
      </svg>
    )
  }
  