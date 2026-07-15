export default function DesignNivel1({ color = '#00ee55', colorSecundario = '#00ffaa', cardId = 'nivel1_verde', clipId = 'activeCardClip' }) {

    const c = color
    const c2 = colorSecundario
  
    const SHAPE = "M 20 90 C 20 90 60 88 100 75 C 130 65 150 55 170 50 C 190 55 210 65 240 75 C 280 88 320 90 320 90 L 320 480 L 170 520 L 20 480 Z"
    const INNER = "M 26 90 C 26 90 64 88 103 76 C 132 67 152 57 170 52 C 188 57 208 67 237 76 C 276 88 314 90 314 90 L 314 478 L 170 514 L 26 478 Z"
  
    // Textura según el color
    function getTexture() {
      if (cardId === 'nivel1_verde') return (
        <g opacity=".12">
          {/* Césped / líneas de campo */}
          {[0,1,2,3,4,5,6,7].map(i => (
            <line key={i} x1="20" y1={120 + i * 52} x2="320" y2={120 + i * 52}
              stroke="#00ff44" strokeWidth={i % 2 === 0 ? "28" : "24"} opacity={i % 2 === 0 ? ".08" : ".04"}/>
          ))}
          {/* Círculo central */}
          <circle cx="170" cy="300" r="60" fill="none" stroke="#00ff44" strokeWidth="1" opacity=".15"/>
          <circle cx="170" cy="300" r="30" fill="none" stroke="#00ff44" strokeWidth="1" opacity=".1"/>
          <line x1="170" y1="120" x2="170" y2="480" stroke="#00ff44" strokeWidth="1" opacity=".1"/>
        </g>
      )
      if (cardId === 'nivel1_azul') return (
        <g opacity=".15">
          {/* Ondas de agua */}
          {[0,1,2,3,4,5,6].map(i => (
            <path key={i}
              d={`M 20 ${150 + i * 50} Q 85 ${140 + i * 50} 170 ${150 + i * 50} Q 255 ${160 + i * 50} 320 ${150 + i * 50}`}
              fill="none" stroke="#44aaff" strokeWidth="1.5" opacity={.2 - i * .02}/>
          ))}
          {/* Burbujas */}
          {[60,120,200,260,90,180,240].map((x, i) => (
            <circle key={i} cx={x} cy={180 + i * 40} r={3 + i % 3} fill="none" stroke="#44ccff" strokeWidth=".8" opacity=".15"/>
          ))}
        </g>
      )
      if (cardId === 'nivel1_bronce') return (
        <g opacity=".12">
          {/* Textura metálica rugosa */}
          {[0,1,2,3,4,5,6,7,8,9].map(i => (
            <line key={i}
              x1={20 + i * 30} y1="90"
              x2={20 + i * 30 + 80} y2="480"
              stroke="#cc7722" strokeWidth="8" opacity=".06"/>
          ))}
          {/* Rayaduras */}
          {[0,1,2,3,4].map(i => (
            <line key={i} x1={40 + i * 60} y1={120 + i * 30} x2={60 + i * 60} y2={180 + i * 30}
              stroke="#ffaa44" strokeWidth=".8" opacity=".2"/>
          ))}
          <line x1="80" y1="150" x2="260" y2="420" stroke="#ffaa44" strokeWidth="1" opacity=".1"/>
          <line x1="100" y1="130" x2="280" y2="400" stroke="#dd8833" strokeWidth=".6" opacity=".08"/>
        </g>
      )
      if (cardId === 'nivel1_plata') return (
        <g opacity=".12">
          {/* Metal pulido — reflejos */}
          <rect x="20" y="90" width="130" height="390" fill="url(#n1PlataRef1)" opacity=".15"/>
          <rect x="150" y="90" width="170" height="390" fill="url(#n1PlataRef2)" opacity=".1"/>
          {/* Líneas finas horizontales */}
          {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
            <line key={i} x1="20" y1={100 + i * 32} x2="320" y2={100 + i * 32}
              stroke="#ffffff" strokeWidth=".5" opacity={.08 + (i % 3) * .04}/>
          ))}
          {/* Rayaduras diagonales finas */}
          <line x1="60" y1="90" x2="200" y2="480" stroke="#ffffff" strokeWidth=".4" opacity=".08"/>
          <line x1="120" y1="90" x2="260" y2="480" stroke="#ffffff" strokeWidth=".3" opacity=".06"/>
        </g>
      )
      if (cardId === 'nivel1_oro') return (
        <g opacity=".15">
          {/* Partículas doradas */}
          {[
            [80,140],[140,200],[200,160],[260,220],[100,280],
            [180,300],[240,340],[130,380],[200,420],[90,450],
            [260,160],[300,300],[50,320],[170,250],[220,280]
          ].map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r={1.5 + (i % 3)} fill="#ffdd00" opacity={.2 + (i % 4) * .05}/>
          ))}
          {/* Vetas doradas */}
          <line x1="40" y1="120" x2="220" y2="300" stroke="#ffcc00" strokeWidth="1.5" opacity=".08"/>
          <line x1="80" y1="100" x2="300" y2="350" stroke="#ffee44" strokeWidth="1" opacity=".06"/>
          <line x1="20" y1="250" x2="250" y2="460" stroke="#ffcc00" strokeWidth="1" opacity=".07"/>
          {/* Destellos */}
          <line x1="150" y1="180" x2="156" y2="180" stroke="#ffffff" strokeWidth="1.5" opacity=".3"/>
          <line x1="153" y1="177" x2="153" y2="183" stroke="#ffffff" strokeWidth="1.5" opacity=".3"/>
          <line x1="240" y1="320" x2="246" y2="320" stroke="#ffffff" strokeWidth="1.5" opacity=".25"/>
          <line x1="243" y1="317" x2="243" y2="323" stroke="#ffffff" strokeWidth="1.5" opacity=".25"/>
        </g>
      )
      return null
    }
  
    return (
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox="0 0 340 530"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="n1Border" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c2} stopOpacity="1"/>
            <stop offset="30%" stopColor="#ffffff" stopOpacity=".5"/>
            <stop offset="60%" stopColor={c} stopOpacity=".9"/>
            <stop offset="100%" stopColor={c} stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="n1Shine" x1="0%" y1="0%" x2="60%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".5"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="n1BorderInner" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c} stopOpacity=".8"/>
            <stop offset="50%" stopColor={c2} stopOpacity=".4"/>
            <stop offset="100%" stopColor={c} stopOpacity=".8"/>
          </linearGradient>
          <linearGradient id="n1Bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a0a1a"/>
            <stop offset="50%" stopColor="#0d0d22"/>
            <stop offset="100%" stopColor="#080812"/>
          </linearGradient>
          <radialGradient id="n1BgGlow" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor={c} stopOpacity=".18"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="n1Ray1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c} stopOpacity="0"/>
            <stop offset="40%" stopColor={c} stopOpacity=".4"/>
            <stop offset="60%" stopColor="#ffffff" stopOpacity=".15"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="n1Ray2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c} stopOpacity="0"/>
            <stop offset="40%" stopColor={c2} stopOpacity=".28"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="n1Ray3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0"/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity=".1"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </linearGradient>
          <radialGradient id="n1Gem" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".9"/>
            <stop offset="30%" stopColor={c2} stopOpacity=".8"/>
            <stop offset="70%" stopColor={c} stopOpacity=".6"/>
            <stop offset="100%" stopColor="#000020" stopOpacity=".8"/>
          </radialGradient>
          <radialGradient id="n1GemGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={c} stopOpacity=".7"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </radialGradient>
          {/* Gradientes textura plata */}
          <linearGradient id="n1PlataRef1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0"/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity=".15"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="n1PlataRef2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".08"/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity=".05"/>
          </linearGradient>
          <filter id="n1Glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <filter id="n1Soft">
            <feGaussianBlur stdDeviation="2"/>
          </filter>
          <filter id="n1GemFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox" transform="scale(0.002941,0.001887)">
            <path d="M 20 90 C 20 90 60 88 100 75 C 130 65 150 55 170 50 C 190 55 210 65 240 75 C 280 88 320 90 320 90 L 320 480 L 170 520 L 20 480 Z"/>
          </clipPath>
        </defs>
  
        {/* EXTENSIONES LATERALES */}
        <rect x="-18" y="260" width="22" height="55" rx="3" fill={c} opacity=".5"/>
        <rect x="-18" y="260" width="22" height="55" rx="3" fill="none" stroke={c} strokeWidth="1.5" opacity=".9"/>
        <rect x="-14" y="264" width="14" height="47" rx="2" fill="none" stroke="#ffffff" strokeWidth=".5" opacity=".3"/>
        <line x1="-18" y1="275" x2="4" y2="275" stroke="#ffffff" strokeWidth=".8" opacity=".35"/>
        <line x1="-18" y1="295" x2="4" y2="295" stroke="#ffffff" strokeWidth=".8" opacity=".35"/>
  
        <rect x="336" y="260" width="22" height="55" rx="3" fill={c} opacity=".5"/>
        <rect x="336" y="260" width="22" height="55" rx="3" fill="none" stroke={c} strokeWidth="1.5" opacity=".9"/>
        <rect x="336" y="264" width="14" height="47" rx="2" fill="none" stroke="#ffffff" strokeWidth=".5" opacity=".3"/>
        <line x1="336" y1="275" x2="358" y2="275" stroke="#ffffff" strokeWidth=".8" opacity=".35"/>
        <line x1="336" y1="295" x2="358" y2="295" stroke="#ffffff" strokeWidth=".8" opacity=".35"/>
  
        {/* SOMBRA EXTERIOR */}
        <path d={SHAPE} fill="rgba(0,0,0,.6)" filter="url(#n1Soft)" transform="translate(3,4)"/>
  
        {/* FONDO */}
        <path d={SHAPE} fill="url(#n1Bg)"/>
        <path d={SHAPE} fill="url(#n1BgGlow)" opacity=".8"/>
  
        {/* TEXTURA SEGÚN COLOR */}
        {getTexture()}
  
        {/* RAYOS DIAGONALES */}
        <polygon points="60,90 200,90 320,260 320,380 180,380 40,200"
          fill="url(#n1Ray1)" opacity=".6"/>
        <polygon points="100,90 180,90 320,300 320,400 260,400 80,180"
          fill="url(#n1Ray2)" opacity=".4"/>
        <polygon points="130,90 150,90 320,340 320,360 310,360 120,110"
          fill="url(#n1Ray3)" opacity=".5"/>
        <line x1="80" y1="90" x2="320" y2="360" stroke={c} strokeWidth="1" opacity=".2"/>
        <line x1="120" y1="90" x2="320" y2="310" stroke="#ffffff" strokeWidth=".5" opacity=".1"/>
  
        {/* PUNTOS DECORATIVOS */}
        <g opacity=".2">
          {[0,1,2,3,4,5].map(row =>
            [0,1,2,3,4].map(col => (
              <circle key={`${row}-${col}`}
                cx={218 + col * 14}
                cy={195 + row * 14}
                r="1.5"
                fill={c}
                opacity={0.4 - row * 0.05}
              />
            ))
          )}
        </g>
  
        {/* LÍNEA SEPARADORA */}
        <line x1="25" y1="375" x2="315" y2="375" stroke={c} strokeWidth="1" opacity=".3"/>
        <line x1="40" y1="379" x2="300" y2="379" stroke={c} strokeWidth=".5" opacity=".2"/>
  
        {/* MARCO INTERIOR */}
        <path d={INNER} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="6"/>
        <path d={INNER} fill="none" stroke="url(#n1BorderInner)" strokeWidth="2" opacity=".7"/>
        <path d={INNER} fill="none" stroke="#ffffff" strokeWidth=".5" opacity=".2"/>
  
        {/* MARCO EXTERIOR */}
        <path d={SHAPE} fill="none" stroke="url(#n1Border)" strokeWidth="6" filter="url(#n1Glow)"/>
        <path d={SHAPE} fill="none" stroke="url(#n1Shine)" strokeWidth="2.5" opacity=".6"/>
        <path d={SHAPE} fill="none" stroke={c} strokeWidth="1" opacity=".4"/>
  
        {/* MUESCAS */}
        <rect x="0" y="130" width="8" height="3" fill={c} opacity=".7" rx="1"/>
        <rect x="0" y="138" width="5" height="2" fill={c} opacity=".5" rx="1"/>
        <rect x="332" y="130" width="8" height="3" fill={c} opacity=".7" rx="1"/>
        <rect x="335" y="138" width="5" height="2" fill={c} opacity=".5" rx="1"/>
  
        {/* DETALLES LATERALES */}
        {[120,160,200,240,280,320,360].map((y, i) => (
          <g key={i}>
            <line x1="20" y1={y} x2="26" y2={y} stroke={c} strokeWidth="1.5" opacity=".5"/>
            <line x1="314" y1={y} x2="320" y2={y} stroke={c} strokeWidth="1.5" opacity=".5"/>
          </g>
        ))}
  
        {/* GEMA HEXAGONAL */}
        <circle cx="170" cy="528" r="24" fill="url(#n1GemGlow)" opacity=".5"/>
        <polygon points="170,548 190,537 190,515 170,504 150,515 150,537"
          fill={c} opacity=".35" filter="url(#n1GemFilter)"/>
        <polygon points="170,548 190,537 190,515 170,504 150,515 150,537"
          fill="none" stroke={c} strokeWidth="2.5" opacity=".9"/>
        <polygon points="170,543 186,534 186,518 170,509 154,518 154,534"
          fill={c} opacity=".2"/>
        <polygon points="170,543 186,534 186,518 170,509 154,518 154,534"
          fill="none" stroke="#ffffff" strokeWidth="1" opacity=".35"/>
        <polygon points="170,538 183,531 183,519 170,512 157,519 157,531"
          fill="url(#n1Gem)" opacity=".95"/>
        <polygon points="164,519 170,515 176,519 170,525" fill="#ffffff" opacity=".5"/>
        <line x1="170" y1="512" x2="170" y2="538" stroke="#ffffff" strokeWidth=".5" opacity=".3"/>
        <line x1="157" y1="519" x2="183" y2="531" stroke="#ffffff" strokeWidth=".5" opacity=".2"/>
        <line x1="183" y1="519" x2="157" y2="531" stroke="#ffffff" strokeWidth=".5" opacity=".2"/>
  
        {/* MICRO SCRATCHES */}
        <g opacity=".05" stroke="#ffffff" strokeWidth=".3" fill="none">
          <line x1="30" y1="110" x2="58" y2="107"/>
          <line x1="68" y1="130" x2="98" y2="127"/>
          <line x1="255" y1="112" x2="295" y2="109"/>
          <line x1="245" y1="145" x2="295" y2="141"/>
          <line x1="48" y1="350" x2="82" y2="346"/>
          <line x1="245" y1="342" x2="285" y2="338"/>
        </g>
  
        {/* GLOW FINAL */}
        <path d={SHAPE} fill="none" stroke={c} strokeWidth="16" opacity=".05" filter="url(#n1Soft)"/>
  
        {/* PUNTOS ESQUINAS */}
        <circle cx="20" cy="90" r="3" fill={c} opacity=".8"/>
        <circle cx="320" cy="90" r="3" fill={c} opacity=".8"/>
        <circle cx="20" cy="480" r="3" fill={c} opacity=".6"/>
        <circle cx="320" cy="480" r="3" fill={c} opacity=".6"/>
        <circle cx="170" cy="50" r="3" fill={c2} opacity=".7"/>
  
      </svg>
    )
  }
  