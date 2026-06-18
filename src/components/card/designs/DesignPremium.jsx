export default function DesignPremium() {

    const SHAPE = "M 20 110 C 28 110 38 105 50 95 C 62 82 70 58 88 48 C 105 38 120 36 127 32 C 134 40 141 45 153 40 C 159 36 164 32 170 28 C 176 32 181 36 187 40 C 199 45 206 40 213 32 C 220 36 235 38 252 48 C 270 58 278 82 290 95 C 302 105 312 110 320 110 L 320 440 Q 320 465 302 480 Q 275 494 242 500 Q 210 506 192 510 Q 181 516 170 522 Q 159 516 148 510 Q 130 506 98 500 Q 65 494 38 480 Q 20 465 20 440 Z"
  
    const INNER = "M 26 110 C 33 110 42 106 53 96 C 65 83 72 60 89 50 C 106 40 120 38 127 34 C 134 42 141 47 153 42 C 159 38 164 34 170 31 C 176 34 181 38 187 42 C 199 47 206 42 213 34 C 220 38 234 40 251 50 C 268 60 275 83 287 96 C 298 106 307 110 314 110 L 314 438 Q 314 462 297 476 Q 271 489 239 495 Q 208 501 191 505 Q 181 510 170 516 Q 159 510 149 505 Q 132 501 101 495 Q 69 489 43 476 Q 26 462 26 438 Z"
  
    return (
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox="0 0 340 530"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gGold1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF5C0"/>
            <stop offset="20%" stopColor="#F4E6A1"/>
            <stop offset="45%" stopColor="#C8980A"/>
            <stop offset="65%" stopColor="#B88A2C"/>
            <stop offset="85%" stopColor="#D6B65D"/>
            <stop offset="100%" stopColor="#8F6A18"/>
          </linearGradient>
          <linearGradient id="gGold2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF5C0"/>
            <stop offset="30%" stopColor="#D6B65D"/>
            <stop offset="70%" stopColor="#8F6A18"/>
            <stop offset="100%" stopColor="#B88A2C"/>
          </linearGradient>
          <linearGradient id="gGold3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8F6A18"/>
            <stop offset="30%" stopColor="#D6B65D"/>
            <stop offset="60%" stopColor="#F4E6A1"/>
            <stop offset="100%" stopColor="#8F6A18"/>
          </linearGradient>
          <linearGradient id="gGoldShine" x1="0%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".7"/>
            <stop offset="35%" stopColor="#F4E6A1" stopOpacity=".4"/>
            <stop offset="100%" stopColor="#D6B65D" stopOpacity="0"/>
          </linearGradient>
          <radialGradient id="gBg1" cx="40%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#1A3FAA"/>
            <stop offset="50%" stopColor="#0A2580"/>
            <stop offset="100%" stopColor="#030D30"/>
          </radialGradient>
          <linearGradient id="gBg2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D2B8E"/>
            <stop offset="100%" stopColor="#040E40"/>
          </linearGradient>
          <linearGradient id="gCrystal1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#66E6FF" stopOpacity=".9"/>
            <stop offset="60%" stopColor="#00B8FF" stopOpacity=".5"/>
            <stop offset="100%" stopColor="#0050FF" stopOpacity=".2"/>
          </linearGradient>
          <linearGradient id="gCrystal2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#29D5FF" stopOpacity=".8"/>
            <stop offset="100%" stopColor="#0088FF" stopOpacity=".2"/>
          </linearGradient>
          <linearGradient id="gCrystal3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".5"/>
            <stop offset="100%" stopColor="#29D5FF" stopOpacity=".1"/>
          </linearGradient>
          <radialGradient id="gFlare" cx="42%" cy="45%" r="40%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".35"/>
            <stop offset="40%" stopColor="#66B8FF" stopOpacity=".12"/>
            <stop offset="100%" stopColor="#66B8FF" stopOpacity="0"/>
          </radialGradient>
          <filter id="fGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feColorMatrix in="b" type="matrix"
              values="1.3 0.7 0 0 0  0.7 0.6 0 0 0  0 0 0.1 0 0  0 0 0 0.9 0" result="c"/>
            <feComposite in="SourceGraphic" in2="c" operator="over"/>
          </filter>
          <filter id="fCrystalGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feColorMatrix in="b" type="matrix"
              values="0 0 0 0 0  0 0.5 1 0 0.1  0 0.8 1 0 0.3  0 0 0 0.9 0" result="c"/>
            <feComposite in="SourceGraphic" in2="c" operator="over"/>
          </filter>
          <filter id="fSoft">
            <feGaussianBlur stdDeviation="2"/>
          </filter>
          <filter id="fInnerGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.5" result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <clipPath id="activeCardClip" clipPathUnits="objectBoundingBox" transform="scale(0.002941,0.001887)">
            <path d="M 20 110 C 28 110 38 105 50 95 C 62 82 70 58 88 48 C 105 38 120 36 127 32 C 134 40 141 45 153 40 C 159 36 164 32 170 28 C 176 32 181 36 187 40 C 199 45 206 40 213 32 C 220 36 235 38 252 48 C 270 58 278 82 290 95 C 302 105 312 110 320 110 L 320 440 Q 320 465 302 480 Q 275 494 242 500 Q 210 506 192 510 Q 181 516 170 522 Q 159 516 148 510 Q 130 506 98 500 Q 65 494 38 480 Q 20 465 20 440 Z"/>
          </clipPath>
        </defs>
  
        {/* ALAS CRISTALINAS IZQUIERDA */}
        <polygon points="-45,150 -8,128 -4,148 -10,208 -13,238 -42,232 -52,192"
          fill="url(#gCrystal2)" filter="url(#fCrystalGlow)" opacity=".3"/>
        <polygon points="-36,155 -5,135 -2,155 -7,205 -10,230 -36,225 -44,190"
          fill="url(#gCrystal1)" opacity=".4"/>
        <polygon points="-25,162 -2,142 1,160 -4,202 -6,222 -24,218 -30,188"
          fill="url(#gCrystal3)" opacity=".55"/>
        <line x1="-45" y1="150" x2="-8" y2="128" stroke="#66E6FF" strokeWidth="1.2" opacity=".7"/>
        <line x1="-45" y1="150" x2="-52" y2="192" stroke="#29D5FF" strokeWidth=".8" opacity=".5"/>
        <line x1="-52" y1="192" x2="-42" y2="232" stroke="#29D5FF" strokeWidth=".8" opacity=".4"/>
        <polygon points="-18,100 8,82 12,100 8,128 -14,126"
          fill="url(#gCrystal1)" opacity=".45" filter="url(#fCrystalGlow)"/>
        <polygon points="-18,100 8,82 12,100 8,128 -14,126"
          fill="none" stroke="#66E6FF" strokeWidth=".8" opacity=".6"/>
        <polygon points="-30,258 -4,248 -1,268 -7,288 -28,284"
          fill="url(#gCrystal2)" opacity=".35"/>
        <polygon points="-14,308 0,302 2,314 -10,319" fill="#00B8FF" opacity=".3"/>
        <polygon points="-20,345 -4,339 -2,350 -16,355" fill="#29D5FF" opacity=".22"/>
  
        {/* ALAS CRISTALINAS DERECHA */}
        <polygon points="385,150 348,128 344,148 350,208 353,238 382,232 392,192"
          fill="url(#gCrystal2)" filter="url(#fCrystalGlow)" opacity=".3"/>
        <polygon points="376,155 345,135 342,155 347,205 350,230 376,225 384,190"
          fill="url(#gCrystal1)" opacity=".4"/>
        <polygon points="365,162 342,142 339,160 344,202 346,222 364,218 370,188"
          fill="url(#gCrystal3)" opacity=".55"/>
        <line x1="385" y1="150" x2="348" y2="128" stroke="#66E6FF" strokeWidth="1.2" opacity=".7"/>
        <line x1="385" y1="150" x2="392" y2="192" stroke="#29D5FF" strokeWidth=".8" opacity=".5"/>
        <line x1="392" y1="192" x2="382" y2="232" stroke="#29D5FF" strokeWidth=".8" opacity=".4"/>
        <polygon points="358,100 332,82 328,100 332,128 354,126"
          fill="url(#gCrystal1)" opacity=".45" filter="url(#fCrystalGlow)"/>
        <polygon points="358,100 332,82 328,100 332,128 354,126"
          fill="none" stroke="#66E6FF" strokeWidth=".8" opacity=".6"/>
        <polygon points="370,258 344,248 341,268 347,288 368,284"
          fill="url(#gCrystal2)" opacity=".35"/>
        <polygon points="354,308 340,302 338,314 350,319" fill="#00B8FF" opacity=".3"/>
        <polygon points="360,345 344,339 342,350 356,355" fill="#29D5FF" opacity=".22"/>
  
        {/* CRISTALES SUPERIORES */}
        <polygon points="30,88 57,70 61,85 57,108 35,106"
          fill="url(#gCrystal1)" opacity=".5" filter="url(#fCrystalGlow)"/>
        <polygon points="30,88 57,70 61,85 57,108 35,106"
          fill="none" stroke="#66E6FF" strokeWidth=".8" opacity=".65"/>
        <polygon points="83,60 111,48 113,62 111,82 87,80"
          fill="url(#gCrystal2)" opacity=".45"/>
        <polygon points="153,36 170,20 187,36 184,52 156,52"
          fill="url(#gCrystal1)" opacity=".6" filter="url(#fCrystalGlow)"/>
        <polygon points="153,36 170,20 187,36 184,52 156,52"
          fill="none" stroke="#66E6FF" strokeWidth="1" opacity=".7"/>
        <line x1="170" y1="20" x2="170" y2="52" stroke="#FFFFFF" strokeWidth=".8" opacity=".6"/>
        <polygon points="227,48 255,60 257,75 255,82 231,80"
          fill="url(#gCrystal2)" opacity=".45"/>
        <polygon points="279,70 306,88 301,106 279,108 265,85"
          fill="url(#gCrystal1)" opacity=".5" filter="url(#fCrystalGlow)"/>
        <polygon points="279,70 306,88 301,106 279,108 265,85"
          fill="none" stroke="#66E6FF" strokeWidth=".8" opacity=".65"/>
        <polygon points="126,50 140,42 138,53 124,56" fill="#29D5FF" opacity=".4"/>
        <polygon points="200,42 214,50 212,60 198,56" fill="#29D5FF" opacity=".4"/>
  
        {/* CRISTALES INFERIORES */}
        <polygon points="48,530 76,540 83,527 60,522"
          fill="url(#gCrystal2)" opacity=".4" filter="url(#fCrystalGlow)"/>
        <polygon points="98,538 126,546 130,532 104,528"
          fill="url(#gCrystal1)" opacity=".35"/>
        <polygon points="148,542 170,558 192,542 188,528 152,528"
          fill="url(#gCrystal1)" opacity=".6" filter="url(#fCrystalGlow)"/>
        <polygon points="148,542 170,558 192,542 188,528 152,528"
          fill="none" stroke="#66E6FF" strokeWidth="1.2" opacity=".8"/>
        <line x1="170" y1="558" x2="170" y2="528" stroke="#FFFFFF" strokeWidth="1" opacity=".7"/>
        <polygon points="210,532 236,546 246,538 216,528"
          fill="url(#gCrystal1)" opacity=".35"/>
        <polygon points="256,522 276,527 283,540 260,546"
          fill="url(#gCrystal2)" opacity=".4" filter="url(#fCrystalGlow)"/>
  
        {/* SOMBRA EXTERIOR */}
        <path d={SHAPE} fill="rgba(0,0,0,.7)" filter="url(#fSoft)" transform="translate(4,5)"/>
  
        {/* FONDO INTERNO */}
        <path d={SHAPE} fill="url(#gBg2)"/>
        <path d={SHAPE} fill="url(#gBg1)" opacity=".8"/>
  
        {/* VETAS DORADAS */}
        <g opacity=".1" stroke="#D6B65D" fill="none">
          <line x1="30" y1="120" x2="180" y2="250" strokeWidth="1.2"/>
          <line x1="20" y1="195" x2="200" y2="345" strokeWidth="1"/>
          <line x1="160" y1="115" x2="315" y2="275" strokeWidth="1"/>
          <line x1="50" y1="315" x2="280" y2="465" strokeWidth=".8"/>
          <line x1="145" y1="155" x2="320" y2="335" strokeWidth="1"/>
        </g>
  
        {/* GRIETAS ENERGÍA */}
        <g opacity=".2" stroke="#D6B65D" strokeWidth=".6" fill="none">
          <path d="M 90 138 L 108 163 L 98 183 L 120 213"/>
          <path d="M 235 152 L 253 176 L 243 196 L 262 222"/>
          <path d="M 42 288 L 64 308 L 52 328 L 70 346"/>
          <path d="M 282 268 L 300 292 L 289 312 L 308 332"/>
          <path d="M 130 425 L 152 405 L 140 383 L 164 360"/>
          <path d="M 205 435 L 223 413 L 211 391 L 233 368"/>
        </g>
  
        {/* FRAGMENTOS CRISTALINOS INTERNOS */}
        <polygon points="185,208 228,178 258,228 244,286 200,296 178,256"
          fill="#005DFF" opacity=".13" filter="url(#fSoft)"/>
        <polygon points="185,208 228,178 258,228 244,286 200,296 178,256"
          fill="none" stroke="#00BFFF" strokeWidth=".9" opacity=".38"/>
        <polygon points="218,160 248,146 266,180 253,208 221,213"
          fill="#008CFF" opacity=".11" filter="url(#fSoft)"/>
        <polygon points="218,160 248,146 266,180 253,208 221,213"
          fill="none" stroke="#4FDFFF" strokeWidth=".7" opacity=".35"/>
        <polygon points="198,296 238,286 252,330 233,355 191,346"
          fill="#00BFFF" opacity=".09" filter="url(#fSoft)"/>
        <polygon points="198,296 238,286 252,330 233,355 191,346"
          fill="none" stroke="#4FDFFF" strokeWidth=".7" opacity=".28"/>
        <polygon points="244,223 266,213 274,240 257,248"
          fill="#005DFF" opacity=".17"/>
        <polygon points="244,223 266,213 274,240 257,248"
          fill="none" stroke="#00BFFF" strokeWidth=".6" opacity=".48"/>
        <line x1="228" y1="178" x2="258" y2="158" stroke="#4FDFFF" strokeWidth=".5" opacity=".42"/>
        <line x1="253" y1="208" x2="282" y2="196" stroke="#4FDFFF" strokeWidth=".4" opacity=".32"/>
  
        {/* FLARE */}
        <ellipse cx="150" cy="308" rx="110" ry="130" fill="url(#gFlare)" opacity=".85"/>
  
        {/* MARCO INTERIOR */}
        <path d={INNER} fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="8"/>
        <path d={INNER} fill="none" stroke="url(#gGold1)" strokeWidth="3" opacity=".7"/>
        <path d={INNER} fill="none" stroke="#F4E6A1" strokeWidth=".8" opacity=".3"/>
  
        {/* MARCO EXTERIOR DORADO */}
        <path d={SHAPE} fill="none" stroke="url(#gGold1)" strokeWidth="14" filter="url(#fGoldGlow)"/>
        <path d={SHAPE} fill="none" stroke="#FFF5C0" strokeWidth="1.5" opacity=".7"/>
        <path d={SHAPE} fill="none" stroke="url(#gGoldShine)" strokeWidth="8" opacity=".5"/>
  
        {/* PUNTA CENTRAL SUPERIOR */}
        <path d="M 120 36 L 127 32 C 134 40 141 45 153 40 C 159 36 164 32 170 28 C 176 32 181 36 187 40 C 199 45 206 40 213 32 L 220 36"
          fill="none" stroke="#F4E6A1" strokeWidth="1.5" opacity=".8"/>
        <circle cx="170" cy="28" r="4" fill="#F4E6A1" opacity=".95"/>
        <circle cx="170" cy="28" r="7" fill="none" stroke="#D6B65D" strokeWidth="1" opacity=".5"/>
        <line x1="170" y1="20" x2="170" y2="40" stroke="#F4E6A1" strokeWidth="1.2" opacity=".7"/>
  
        {/* REMACHES LATERALES */}
        {[148, 208, 268, 328, 388].map((y, i) => (
          <g key={i}>
            <circle cx="22" cy={y} r="4" fill="url(#gGold2)" opacity=".8"/>
            <circle cx="22" cy={y} r="6" fill="none" stroke="#F4E6A1" strokeWidth=".8" opacity=".45"/>
            <circle cx="22" cy={y} r="2" fill="#FFF5C0" opacity=".6"/>
          </g>
        ))}
        {[148, 208, 268, 328, 388].map((y, i) => (
          <g key={i}>
            <circle cx="318" cy={y} r="4" fill="url(#gGold2)" opacity=".8"/>
            <circle cx="318" cy={y} r="6" fill="none" stroke="#F4E6A1" strokeWidth=".8" opacity=".45"/>
            <circle cx="318" cy={y} r="2" fill="#FFF5C0" opacity=".6"/>
          </g>
        ))}
  
        {/* PUNTA INFERIOR */}
        <line x1="170" y1="522" x2="90" y2="500" stroke="#D6B65D" strokeWidth="1" opacity=".5"/>
        <line x1="170" y1="522" x2="250" y2="500" stroke="#D6B65D" strokeWidth="1" opacity=".5"/>
        <polygon points="170,530 177,522 170,514 163,522"
          fill="#F4E6A1" opacity=".8" filter="url(#fInnerGlow)"/>
  
        {/* HEXÁGONO INFERIOR */}
        <polygon points="170,542 183,535 183,521 170,514 157,521 157,535"
          fill="#6EE7FF" opacity=".22" filter="url(#fCrystalGlow)"/>
        <polygon points="170,542 183,535 183,521 170,514 157,521 157,535"
          fill="none" stroke="#00D9FF" strokeWidth="1.2" opacity=".85"/>
        <line x1="170" y1="514" x2="170" y2="542" stroke="#6EE7FF" strokeWidth=".7" opacity=".55"/>
        <circle cx="170" cy="528" r="3.5" fill="#00D9FF" opacity=".75"/>
  
        {/* EMBLEMA SUPERIOR */}
        <path d="M 157 50 L 170 43 L 183 50 L 183 65 Q 183 74 170 78 Q 157 74 157 65 Z"
          fill="none" stroke="#C8C8C8" strokeWidth="1.2" opacity=".7"/>
        <text x="170" y="68" textAnchor="middle" fill="#EDEDED"
          fontSize="9" fontFamily="Georgia, serif" opacity=".8" letterSpacing="1.5">XII</text>
  
        {/* MICRO SCRATCHES */}
        <g opacity=".05" stroke="#F4E6A1" strokeWidth=".3" fill="none">
          <line x1="30" y1="135" x2="58" y2="132"/>
          <line x1="68" y1="155" x2="98" y2="152"/>
          <line x1="260" y1="138" x2="302" y2="135"/>
          <line x1="248" y1="168" x2="300" y2="164"/>
          <line x1="48" y1="385" x2="82" y2="380"/>
          <line x1="245" y1="375" x2="285" y2="370"/>
          <line x1="105" y1="435" x2="142" y2="430"/>
          <line x1="192" y1="445" x2="235" y2="440"/>
        </g>
  
        {/* GLOW FINAL */}
        <path d={SHAPE} fill="none" stroke="#D6B65D" strokeWidth="18" opacity=".05" filter="url(#fSoft)"/>
        <circle cx="170" cy="28" r="5" fill="#FFF5C0" opacity=".9" filter="url(#fInnerGlow)"/>
        <circle cx="22" cy="110" r="2.5" fill="#F4E6A1" opacity=".7"/>
        <circle cx="318" cy="110" r="2.5" fill="#F4E6A1" opacity=".7"/>
        <circle cx="20" cy="440" r="2.5" fill="#D6B65D" opacity=".6"/>
        <circle cx="320" cy="440" r="2.5" fill="#D6B65D" opacity=".6"/>
        <circle cx="170" cy="522" r="3" fill="#F4E6A1" opacity=".8" filter="url(#fInnerGlow)"/>
  
      </svg>
    )
  }