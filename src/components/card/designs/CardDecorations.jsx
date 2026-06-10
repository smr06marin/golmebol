export default function CardDecorations({ decoracion, color = '#00ddd0', colorSecundario }) {
    if (!decoracion) return null
  
    const c = color
    const c2 = colorSecundario || color
  
    switch (decoracion) {
  
      case 'cristales':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <polygon points="170,0 155,-18 170,-28 185,-18" fill={c} opacity=".5"/>
            <polygon points="155,-18 140,-12 145,-24 155,-18" fill={c} opacity=".3"/>
            <polygon points="185,-18 195,-12 190,-24 185,-18" fill={c} opacity=".3"/>
            <polygon points="130,-8 118,-2 122,-14 130,-8" fill={c} opacity=".2"/>
            <polygon points="210,-8 222,-2 218,-14 210,-8" fill={c} opacity=".2"/>
          </svg>
        )
  
      case 'corona_pequeña':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M140,-15 L155,-30 L170,-18 L185,-30 L200,-15 L195,0 L145,0 Z" fill={c} opacity=".85"/>
            <circle cx="155" cy="-30" r="4" fill={c} opacity=".9"/>
            <circle cx="170" cy="-22" r="3" fill={c} opacity=".9"/>
            <circle cx="185" cy="-30" r="4" fill={c} opacity=".9"/>
            <line x1="145" y1="0" x2="195" y2="0" stroke={c} strokeWidth="1.5" opacity=".6"/>
          </svg>
        )
  
      case 'chispas':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <circle cx="170" cy="-20" r="3" fill={c} opacity=".8"/>
            <circle cx="150" cy="-30" r="2" fill={c} opacity=".6"/>
            <circle cx="190" cy="-28" r="2" fill={c} opacity=".6"/>
            <circle cx="130" cy="-15" r="1.5" fill={c} opacity=".4"/>
            <circle cx="210" cy="-18" r="1.5" fill={c} opacity=".4"/>
            <circle cx="155" cy="-40" r="1" fill={c} opacity=".3"/>
            <circle cx="185" cy="-38" r="1" fill={c} opacity=".3"/>
            <line x1="170" y1="-24" x2="165" y2="-35" stroke={c} strokeWidth="1" opacity=".5"/>
            <line x1="170" y1="-24" x2="175" y2="-38" stroke={c} strokeWidth="1" opacity=".5"/>
            <line x1="160" y1="-18" x2="148" y2="-26" stroke={c} strokeWidth="1" opacity=".4"/>
            <line x1="180" y1="-18" x2="192" y2="-25" stroke={c} strokeWidth="1" opacity=".4"/>
          </svg>
        )
  
      case 'hojas':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M-15,80 Q-30,65 -18,50 Q-10,60 -15,80Z" fill={c} opacity=".5"/>
            <path d="M-18,110 Q-35,95 -22,78 Q-12,90 -18,110Z" fill={c} opacity=".4"/>
            <path d="M-12,140 Q-28,128 -16,112 Q-8,123 -12,140Z" fill={c} opacity=".3"/>
            <path d="M355,80 Q370,65 358,50 Q350,60 355,80Z" fill={c} opacity=".5"/>
            <path d="M358,110 Q375,95 362,78 Q352,90 358,110Z" fill={c} opacity=".4"/>
            <path d="M352,140 Q368,128 356,112 Q348,123 352,140Z" fill={c} opacity=".3"/>
          </svg>
        )
  
      case 'puntos':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            {[...Array(8)].map((_, i) => (
              <circle key={i} cx={-20 + (i % 2) * 12} cy={60 + i * 22} r="2" fill={c} opacity={.4 - i * .04}/>
            ))}
            {[...Array(8)].map((_, i) => (
              <circle key={i} cx={360 - (i % 2) * 12} cy={60 + i * 22} r="2" fill={c} opacity={.4 - i * .04}/>
            ))}
          </svg>
        )
  
      case 'estrellas_pequeñas':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <text x="170" y="-12" textAnchor="middle" fill={c} fontSize="14" opacity=".8">★</text>
            <text x="140" y="-5" textAnchor="middle" fill={c} fontSize="9" opacity=".5">★</text>
            <text x="200" y="-5" textAnchor="middle" fill={c} fontSize="9" opacity=".5">★</text>
            <text x="-18" y="80" textAnchor="middle" fill={c} fontSize="8" opacity=".4">★</text>
            <text x="358" y="80" textAnchor="middle" fill={c} fontSize="8" opacity=".4">★</text>
            <text x="-18" y="200" textAnchor="middle" fill={c} fontSize="6" opacity=".3">★</text>
            <text x="358" y="200" textAnchor="middle" fill={c} fontSize="6" opacity=".3">★</text>
          </svg>
        )
  
      case 'nubes':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <ellipse cx="-22" cy="90" rx="18" ry="10" fill={c} opacity=".2"/>
            <ellipse cx="-14" cy="84" rx="12" ry="8" fill={c} opacity=".15"/>
            <ellipse cx="-22" cy="160" rx="16" ry="9" fill={c} opacity=".15"/>
            <ellipse cx="362" cy="90" rx="18" ry="10" fill={c} opacity=".2"/>
            <ellipse cx="354" cy="84" rx="12" ry="8" fill={c} opacity=".15"/>
            <ellipse cx="362" cy="160" rx="16" ry="9" fill={c} opacity=".15"/>
          </svg>
        )
  
      case 'gemas':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <polygon points="170,-28 178,-16 170,-8 162,-16" fill={c} opacity=".8"/>
            <polygon points="178,-16 170,-8 182,-8" fill={c2} opacity=".5"/>
            <polygon points="148,-20 154,-10 148,-4 142,-10" fill={c} opacity=".5"/>
            <polygon points="192,-20 198,-10 192,-4 186,-10" fill={c} opacity=".5"/>
            <polygon points="-14,100 -8,110 -14,116 -20,110" fill={c} opacity=".4"/>
            <polygon points="354,100 360,110 354,116 348,110" fill={c} opacity=".4"/>
          </svg>
        )
  
      case 'flores':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <circle cx="170" cy="-20" r="5" fill={c} opacity=".7"/>
            <circle cx="162" cy="-26" r="4" fill={c} opacity=".5"/>
            <circle cx="178" cy="-26" r="4" fill={c} opacity=".5"/>
            <circle cx="160" cy="-18" r="3.5" fill={c} opacity=".4"/>
            <circle cx="180" cy="-18" r="3.5" fill={c} opacity=".4"/>
            <circle cx="-16" cy="120" r="4" fill={c} opacity=".4"/>
            <circle cx="-22" cy="114" r="3" fill={c} opacity=".3"/>
            <circle cx="-10" cy="114" r="3" fill={c} opacity=".3"/>
            <circle cx="356" cy="120" r="4" fill={c} opacity=".4"/>
            <circle cx="350" cy="114" r="3" fill={c} opacity=".3"/>
            <circle cx="362" cy="114" r="3" fill={c} opacity=".3"/>
          </svg>
        )
  
      case 'corona_grande':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M125,-10 L145,-35 L170,-20 L195,-35 L215,-10 L208,4 L132,4 Z" fill={c} opacity=".9"/>
            <path d="M130,-8 L148,-30 L170,-17 L192,-30 L210,-8" fill="none" stroke={c2} strokeWidth="1" opacity=".5"/>
            <circle cx="145" cy="-35" r="5" fill={c} opacity=".95"/>
            <circle cx="170" cy="-24" r="4" fill={c} opacity=".95"/>
            <circle cx="195" cy="-35" r="5" fill={c} opacity=".95"/>
            <circle cx="145" cy="-35" r="2" fill="white" opacity=".5"/>
            <circle cx="195" cy="-35" r="2" fill="white" opacity=".5"/>
            <line x1="132" y1="4" x2="208" y2="4" stroke={c} strokeWidth="2" opacity=".7"/>
          </svg>
        )
  
      case 'rayos_sol':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <circle cx="170" cy="-20" r="10" fill={c} opacity=".6"/>
            <line x1="170" y1="-32" x2="170" y2="-42" stroke={c} strokeWidth="2" opacity=".7"/>
            <line x1="182" y1="-28" x2="189" y2="-36" stroke={c} strokeWidth="2" opacity=".6"/>
            <line x1="158" y1="-28" x2="151" y2="-36" stroke={c} strokeWidth="2" opacity=".6"/>
            <line x1="186" y1="-20" x2="196" y2="-20" stroke={c} strokeWidth="2" opacity=".5"/>
            <line x1="154" y1="-20" x2="144" y2="-20" stroke={c} strokeWidth="2" opacity=".5"/>
            <line x1="182" y1="-12" x2="189" y2="-5" stroke={c} strokeWidth="1.5" opacity=".4"/>
            <line x1="158" y1="-12" x2="151" y2="-5" stroke={c} strokeWidth="1.5" opacity=".4"/>
          </svg>
        )
  
      case 'burbujas':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <circle cx="170" cy="-22" r="8" fill="none" stroke={c} strokeWidth="1.5" opacity=".6"/>
            <circle cx="148" cy="-18" r="5" fill="none" stroke={c} strokeWidth="1" opacity=".4"/>
            <circle cx="192" cy="-18" r="5" fill="none" stroke={c} strokeWidth="1" opacity=".4"/>
            <circle cx="158" cy="-32" r="4" fill="none" stroke={c} strokeWidth="1" opacity=".3"/>
            <circle cx="182" cy="-32" r="4" fill="none" stroke={c} strokeWidth="1" opacity=".3"/>
            <circle cx="-18" cy="100" r="6" fill="none" stroke={c} strokeWidth="1" opacity=".3"/>
            <circle cx="-18" cy="150" r="4" fill="none" stroke={c} strokeWidth="1" opacity=".2"/>
            <circle cx="358" cy="100" r="6" fill="none" stroke={c} strokeWidth="1" opacity=".3"/>
            <circle cx="358" cy="150" r="4" fill="none" stroke={c} strokeWidth="1" opacity=".2"/>
          </svg>
        )
  
      case 'hojas_laurel':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M100,10 Q88,-5 95,-18 Q108,-5 100,10Z" fill={c} opacity=".6"/>
            <path d="M112,2 Q100,-14 108,-26 Q120,-12 112,2Z" fill={c} opacity=".55"/>
            <path d="M124,-4 Q114,-20 122,-32 Q134,-18 124,-4Z" fill={c} opacity=".5"/>
            <path d="M138,-8 Q130,-24 140,-35 Q150,-22 138,-8Z" fill={c} opacity=".45"/>
            <path d="M152,-10 Q146,-27 157,-36 Q166,-23 152,-10Z" fill={c} opacity=".4"/>
            <path d="M240,10 Q252,-5 245,-18 Q232,-5 240,10Z" fill={c} opacity=".6"/>
            <path d="M228,2 Q240,-14 232,-26 Q220,-12 228,2Z" fill={c} opacity=".55"/>
            <path d="M216,-4 Q226,-20 218,-32 Q206,-18 216,-4Z" fill={c} opacity=".5"/>
            <path d="M202,-8 Q210,-24 200,-35 Q190,-22 202,-8Z" fill={c} opacity=".45"/>
            <path d="M188,-10 Q194,-27 183,-36 Q174,-23 188,-10Z" fill={c} opacity=".4"/>
            <line x1="100" y1="10" x2="170" y2="-5" stroke={c} strokeWidth="1" opacity=".3"/>
            <line x1="240" y1="10" x2="170" y2="-5" stroke={c} strokeWidth="1" opacity=".3"/>
          </svg>
        )
  
      case 'trofeo':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M160,-40 L180,-40 L183,-20 Q183,-8 170,-5 Q157,-8 157,-20 Z" fill={c} opacity=".8"/>
            <path d="M157,-20 Q145,-22 143,-32 L160,-40" fill="none" stroke={c} strokeWidth="1.5" opacity=".6"/>
            <path d="M183,-20 Q195,-22 197,-32 L180,-40" fill="none" stroke={c} strokeWidth="1.5" opacity=".6"/>
            <rect x="163" y="-5" width="14" height="5" rx="1" fill={c} opacity=".7"/>
            <rect x="156" y="0" width="28" height="3" rx="1" fill={c} opacity=".6"/>
            <text x="170" y="-18" textAnchor="middle" fill="white" fontSize="8" opacity=".6" fontFamily="Arial">★</text>
            <text x="148" y="-5" textAnchor="middle" fill={c} fontSize="8" opacity=".5">★</text>
            <text x="192" y="-5" textAnchor="middle" fill={c} fontSize="8" opacity=".5">★</text>
          </svg>
        )
  
      case 'alas_corona':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M0,60 Q-25,45 -22,75 Q-25,105 0,92 Q-10,76 0,60Z" fill={c} opacity=".35"/>
            <path d="M0,65 Q-15,55 -13,78 Q-15,98 0,88" fill="none" stroke={c} strokeWidth=".8" opacity=".4"/>
            <path d="M340,60 Q365,45 362,75 Q365,105 340,92 Q350,76 340,60Z" fill={c} opacity=".35"/>
            <path d="M340,65 Q355,55 353,78 Q355,98 340,88" fill="none" stroke={c} strokeWidth=".8" opacity=".4"/>
            <path d="M130,-5 L148,-28 L170,-15 L192,-28 L210,-5 L204,6 L136,6 Z" fill={c} opacity=".85"/>
            <circle cx="148" cy="-28" r="4" fill={c} opacity=".9"/>
            <circle cx="170" cy="-19" r="3" fill={c} opacity=".9"/>
            <circle cx="192" cy="-28" r="4" fill={c} opacity=".9"/>
          </svg>
        )
  
      case 'llamas_pequeñas':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M155,-5 Q150,-20 158,-28 Q160,-15 165,-10 Q162,-22 170,-30 Q178,-22 175,-10 Q180,-15 182,-28 Q190,-20 185,-5" fill={c} opacity=".6"/>
            <path d="M162,-5 Q158,-16 164,-22 Q166,-12 168,-8 Q170,-16 176,-22 Q178,-12 178,-8" fill={c2} opacity=".4"/>
            <path d="M-5,380 Q-15,365 -8,350 Q-2,362 0,370" fill={c} opacity=".3"/>
            <path d="M345,380 Q355,365 348,350 Q342,362 340,370" fill={c} opacity=".3"/>
          </svg>
        )
  
      case 'rayos_electricos':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M170,-35 L165,-20 L172,-18 L164,-5" stroke={c} strokeWidth="2" fill="none" opacity=".8"/>
            <path d="M155,-30 L151,-18 L156,-16 L150,-8" stroke={c} strokeWidth="1.5" fill="none" opacity=".5"/>
            <path d="M185,-30 L189,-18 L184,-16 L190,-8" stroke={c} strokeWidth="1.5" fill="none" opacity=".5"/>
            <circle cx="170" cy="-38" r="3" fill={c} opacity=".7"/>
            <path d="M-5,80 L2,95 L-2,97 L5,112" stroke={c} strokeWidth="1.5" fill="none" opacity=".4"/>
            <path d="M345,80 L338,95 L342,97 L335,112" stroke={c} strokeWidth="1.5" fill="none" opacity=".4"/>
          </svg>
        )
  
      case 'codigo_digital':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <text x="-20" y="70" fill={c} fontSize="6" opacity=".3" fontFamily="monospace">01</text>
            <text x="-20" y="82" fill={c} fontSize="6" opacity=".25" fontFamily="monospace">10</text>
            <text x="-20" y="94" fill={c} fontSize="6" opacity=".2" fontFamily="monospace">01</text>
            <text x="-20" y="106" fill={c} fontSize="6" opacity=".15" fontFamily="monospace">11</text>
            <text x="352" y="70" fill={c} fontSize="6" opacity=".3" fontFamily="monospace">10</text>
            <text x="352" y="82" fill={c} fontSize="6" opacity=".25" fontFamily="monospace">01</text>
            <text x="352" y="94" fill={c} fontSize="6" opacity=".2" fontFamily="monospace">11</text>
            <text x="352" y="106" fill={c} fontSize="6" opacity=".15" fontFamily="monospace">00</text>
            <text x="140" y="-15" fill={c} fontSize="6" opacity=".3" fontFamily="monospace">01010</text>
            <text x="148" y="-25" fill={c} fontSize="6" opacity=".2" fontFamily="monospace">10101</text>
          </svg>
        )
  
      case 'circulos_cyber':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <circle cx="170" cy="-20" r="16" fill="none" stroke={c} strokeWidth="1" opacity=".5" strokeDasharray="4,3"/>
            <circle cx="170" cy="-20" r="10" fill="none" stroke={c} strokeWidth="1" opacity=".4"/>
            <circle cx="170" cy="-20" r="4" fill={c} opacity=".6"/>
            <circle cx="-15" cy="100" r="10" fill="none" stroke={c} strokeWidth="1" opacity=".3" strokeDasharray="3,2"/>
            <circle cx="355" cy="100" r="10" fill="none" stroke={c} strokeWidth="1" opacity=".3" strokeDasharray="3,2"/>
            <circle cx="-15" cy="200" r="7" fill="none" stroke={c} strokeWidth="1" opacity=".2" strokeDasharray="3,2"/>
            <circle cx="355" cy="200" r="7" fill="none" stroke={c} strokeWidth="1" opacity=".2" strokeDasharray="3,2"/>
          </svg>
        )
  
      case 'llamas_grandes_rayos':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M170,-45 L162,-25 L172,-22 L160,-5" stroke={c} strokeWidth="2.5" fill="none" opacity=".8"/>
            <path d="M150,-38 L144,-20 L151,-18 L143,-5" stroke={c2} strokeWidth="2" fill="none" opacity=".6"/>
            <path d="M190,-38 L196,-20 L189,-18 L197,-5" stroke={c2} strokeWidth="2" fill="none" opacity=".6"/>
            <path d="M130,-25 L126,-12 L131,-11 L125,-2" stroke={c} strokeWidth="1.5" fill="none" opacity=".4"/>
            <path d="M210,-25 L214,-12 L209,-11 L215,-2" stroke={c} strokeWidth="1.5" fill="none" opacity=".4"/>
            <path d="M0,400 Q-20,380 -15,360 Q-5,375 0,385 Q-10,368 0,355" fill={c} opacity=".35"/>
            <path d="M340,400 Q360,380 355,360 Q345,375 340,385 Q350,368 340,355" fill={c2} opacity=".35"/>
            <path d="M20,486 Q14,470 22,460 Q26,472 24,480" fill={c} opacity=".4"/>
            <path d="M170,500 Q160,480 168,468 Q175,480 172,490" fill={c} opacity=".5"/>
            <path d="M320,486 Q326,470 318,460 Q314,472 316,480" fill={c2} opacity=".4"/>
          </svg>
        )
  
      case 'estrellas_nebulosa':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            {[...Array(20)].map((_, i) => (
              <circle key={i}
                cx={[160,175,145,190,130,200,155,185,140,170,165,150,180,135,195,125,205,170,148,192][i]}
                cy={[-30,-25,-18,-22,-10,-15,-35,-30,-5,-40,-12,-28,-8,-20,-18,-8,-25,-45,-38,-32][i]}
                r={[1.5,1,2,1.5,1,2,1,1.5,1,2.5,1,1.5,1,1,1.5,1,1,2,1,1.5][i]}
                fill="white"
                opacity={[.7,.5,.8,.6,.4,.7,.5,.6,.3,.9,.4,.6,.3,.5,.6,.3,.5,.8,.6,.5][i]}
              />
            ))}
            <ellipse cx="170" cy="-25" rx="30" ry="15" fill={c} opacity=".08"/>
            <ellipse cx="150" cy="-30" rx="15" ry="8" fill={c} opacity=".06"/>
            <ellipse cx="190" cy="-20" rx="12" ry="7" fill={c2} opacity=".06"/>
            <circle cx="-15" cy="150" r="2" fill="white" opacity=".4"/>
            <circle cx="-20" cy="200" r="1.5" fill="white" opacity=".3"/>
            <circle cx="355" cy="150" r="2" fill="white" opacity=".4"/>
            <circle cx="360" cy="200" r="1.5" fill="white" opacity=".3"/>
          </svg>
        )
  
      case 'gemas_destellos':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <polygon points="170,-40 178,-26 170,-16 162,-26" fill={c} opacity=".9"/>
            <polygon points="178,-26 170,-16 186,-16" fill="white" opacity=".3"/>
            <polygon points="148,-32 154,-20 148,-14 142,-20" fill={c} opacity=".6"/>
            <polygon points="192,-32 198,-20 192,-14 186,-20" fill={c} opacity=".6"/>
            <line x1="170" y1="-48" x2="170" y2="-42" stroke="white" strokeWidth="1.5" opacity=".6"/>
            <line x1="162" y1="-44" x2="165" y2="-40" stroke="white" strokeWidth="1" opacity=".4"/>
            <line x1="178" y1="-44" x2="175" y2="-40" stroke="white" strokeWidth="1" opacity=".4"/>
            <line x1="-10" y1="95" x2="-10" y2="91" stroke="white" strokeWidth="1.5" opacity=".5"/>
            <line x1="-14" y1="93" x2="-6" y2="93" stroke="white" strokeWidth="1.5" opacity=".5"/>
            <line x1="350" y1="95" x2="350" y2="91" stroke="white" strokeWidth="1.5" opacity=".5"/>
            <line x1="346" y1="93" x2="354" y2="93" stroke="white" strokeWidth="1.5" opacity=".5"/>
          </svg>
        )
  
      case 'arcoiris_destellos':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            <path d="M120,-5 Q170,-40 220,-5" fill="none" stroke="#ff0064" strokeWidth="2" opacity=".5"/>
            <path d="M125,-2 Q170,-35 215,-2" fill="none" stroke="#ff8800" strokeWidth="2" opacity=".5"/>
            <path d="M130,1 Q170,-30 210,1" fill="none" stroke="#ffd700" strokeWidth="2" opacity=".5"/>
            <path d="M135,4 Q170,-25 205,4" fill="none" stroke="#00ff96" strokeWidth="2" opacity=".5"/>
            <path d="M140,7 Q170,-20 200,7" fill="none" stroke="#0064ff" strokeWidth="2" opacity=".5"/>
            <path d="M145,10 Q170,-15 195,10" fill="none" stroke="#9955ff" strokeWidth="2" opacity=".5"/>
            <circle cx="170" cy="-45" r="4" fill="white" opacity=".8"/>
            <line x1="170" y1="-50" x2="170" y2="-44" stroke="white" strokeWidth="2" opacity=".6"/>
            <line x1="164" y1="-48" x2="167" y2="-44" stroke="white" strokeWidth="1.5" opacity=".4"/>
            <line x1="176" y1="-48" x2="173" y2="-44" stroke="white" strokeWidth="1.5" opacity=".4"/>
          </svg>
        )
  
      case 'corona_alas_llamas':
        return (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 340 492">
            {/* Corona */}
            <path d="M125,-8 L145,-35 L170,-20 L195,-35 L215,-8 L208,5 L132,5 Z" fill={c} opacity=".9"/>
            <circle cx="145" cy="-35" r="5" fill={c} opacity="1"/>
            <circle cx="170" cy="-24" r="4" fill={c} opacity="1"/>
            <circle cx="195" cy="-35" r="5" fill={c} opacity="1"/>
            <circle cx="145" cy="-35" r="2" fill="white" opacity=".6"/>
            <circle cx="195" cy="-35" r="2" fill="white" opacity=".6"/>
            {/* Alas */}
            <path d="M0,70 Q-30,52 -26,85 Q-30,118 0,105 Q-12,88 0,70Z" fill={c} opacity=".3"/>
            <path d="M0,75 Q-18,62 -16,87 Q-18,110 0,100" fill="none" stroke={c} strokeWidth="1" opacity=".35"/>
            <path d="M340,70 Q370,52 366,85 Q370,118 340,105 Q352,88 340,70Z" fill={c2} opacity=".3"/>
            <path d="M340,75 Q358,62 356,87 Q358,110 340,100" fill="none" stroke={c2} strokeWidth="1" opacity=".35"/>
            {/* Llamas abajo */}
            <path d="M20,492 Q14,475 22,463 Q28,476 25,485" fill={c} opacity=".5"/>
            <path d="M60,496 Q52,478 62,464 Q70,478 66,490" fill={c2} opacity=".5"/>
            <path d="M170,500 Q162,480 170,466 Q178,480 170,495" fill={c} opacity=".6"/>
            <path d="M280,496 Q288,478 278,464 Q270,478 274,490" fill={c2} opacity=".5"/>
            <path d="M320,492 Q326,475 318,463 Q312,476 315,485" fill={c} opacity=".5"/>
          </svg>
        )
  
      default:
        return null
    }
  }