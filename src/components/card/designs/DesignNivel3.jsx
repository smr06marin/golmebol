const VARIANTS = {
    inicio: {
      // ── AZUL PURO — solo azules, sin oro ──
      bg1: { cx: '40%', cy: '40%', c0: '#1A5FDD', c50: '#0A3AAA', c100: '#020A2A' },
      bg2: { c0: '#0D3AAE', c100: '#030C38' },
      // Marco y bordes: azul eléctrico
      frameColor: '#4488FF',
      frameGlow: '#1155EE',
      frameLight: '#88BBFF',
      frameShine: '#CCDDFF',
      // Cristales: azul hielo
      cr1: { c0: '#88CCFF', c0op: '.85', c60: '#2277FF', c60op: '.50', c100: '#0033CC', c100op: '.20' },
      cr2: { c0: '#44AAFF', c0op: '.75', c100: '#0055DD', c100op: '.18' },
      cr3: { c0: '#CCEEFF', c0op: '.55', c100: '#4499FF', c100op: '.12' },
      flare: { cx: '42%', cy: '45%', c0op: '.30', c40op: '.12', color: '#4488FF' },
      wingOpacity: { outer: '.22', mid: '.32', inner: '.44' },
      wingLineOp: '.55',
      topCrystalOp: '.42',
      fracOp: { a: '.10', b: '.09', c: '.08', d: '.14' },
      cracksOp: '.14',
      veinsOp: '.08',
      borderOuter: { w: '12', op: '.88' },
      borderInner: { w: '2.5', op: '.58' },
      rimOpacity: '.25',
      glowFinalOp: '.05',
      rivetOp: '.68',
      centerDot: { r: '3.5', op: '.80' },
      accentLine: '#4488FF',
      accentDot: '#88BBFF',
      extraAura: null,
      rivetColor: '#4488FF',
      rivetLight: '#AACCFF',
    },
  
    bronce: {
      // ── COBRE/CAFÉ — marrón cobre bien visible ──
      bg1: { cx: '38%', cy: '38%', c0: '#5A2800', c50: '#3A1600', c100: '#180800' },
      bg2: { c0: '#4A2200', c100: '#1A0A00' },
      frameColor: '#CC6622',
      frameGlow: '#994400',
      frameLight: '#FF9944',
      frameShine: '#FFCC88',
      cr1: { c0: '#FF9944', c0op: '.88', c60: '#CC5500', c60op: '.55', c100: '#882200', c100op: '.25' },
      cr2: { c0: '#FF7722', c0op: '.78', c100: '#AA3300', c100op: '.22' },
      cr3: { c0: '#FFDDAA', c0op: '.58', c100: '#FF8833', c100op: '.14' },
      flare: { cx: '44%', cy: '44%', c0op: '.35', c40op: '.14', color: '#FF8833' },
      wingOpacity: { outer: '.28', mid: '.38', inner: '.52' },
      wingLineOp: '.62',
      topCrystalOp: '.50',
      fracOp: { a: '.12', b: '.11', c: '.10', d: '.18' },
      cracksOp: '.18',
      veinsOp: '.11',
      borderOuter: { w: '13', op: '.92' },
      borderInner: { w: '2.8', op: '.65' },
      rimOpacity: '.32',
      glowFinalOp: '.06',
      rivetOp: '.78',
      centerDot: { r: '4', op: '.85' },
      accentLine: '#CC6622',
      accentDot: '#FF9944',
      extraAura: null,
      rivetColor: '#CC6622',
      rivetLight: '#FFAA55',
    },
  
    plata: {
      // ── GRIS PLATEADO — plata fría, cristales gris plata ──
      bg1: { cx: '42%', cy: '36%', c0: '#3A3A4A', c50: '#222230', c100: '#0A0A14' },
      bg2: { c0: '#2A2A3A', c100: '#080810' },
      frameColor: '#AAAACC',
      frameGlow: '#777799',
      frameLight: '#DDDDEE',
      frameShine: '#FFFFFF',
      cr1: { c0: '#DDDDEE', c0op: '.90', c60: '#9999BB', c60op: '.58', c100: '#444466', c100op: '.25' },
      cr2: { c0: '#CCCCDD', c0op: '.82', c100: '#666688', c100op: '.22' },
      cr3: { c0: '#FFFFFF', c0op: '.68', c100: '#AAAACC', c100op: '.16' },
      flare: { cx: '40%', cy: '43%', c0op: '.40', c40op: '.16', color: '#BBBBDD' },
      wingOpacity: { outer: '.32', mid: '.44', inner: '.60' },
      wingLineOp: '.70',
      topCrystalOp: '.62',
      fracOp: { a: '.15', b: '.13', c: '.11', d: '.22' },
      cracksOp: '.22',
      veinsOp: '.13',
      borderOuter: { w: '14', op: '.94' },
      borderInner: { w: '3', op: '.72' },
      rimOpacity: '.40',
      glowFinalOp: '.07',
      rivetOp: '.82',
      centerDot: { r: '4', op: '.88' },
      accentLine: '#AAAACC',
      accentDot: '#DDDDEE',
      extraAura: null,
      rivetColor: '#AAAACC',
      rivetLight: '#FFFFFF',
    },
  
    oro: {
      // ── ORO INTENSO — amarillo dorado brillante ──
      bg1: { cx: '40%', cy: '38%', c0: '#5A4000', c50: '#382800', c100: '#140E00' },
      bg2: { c0: '#4A3400', c100: '#100C00' },
      frameColor: '#FFCC00',
      frameGlow: '#CC9900',
      frameLight: '#FFE840',
      frameShine: '#FFFAAA',
      cr1: { c0: '#FFE840', c0op: '.95', c60: '#FFAA00', c60op: '.68', c100: '#AA6600', c100op: '.30' },
      cr2: { c0: '#FFD800', c0op: '.88', c100: '#DD8800', c100op: '.30' },
      cr3: { c0: '#FFFAAA', c0op: '.78', c100: '#FFD800', c100op: '.20' },
      flare: { cx: '41%', cy: '42%', c0op: '.52', c40op: '.22', color: '#FFD800' },
      wingOpacity: { outer: '.40', mid: '.55', inner: '.72' },
      wingLineOp: '.82',
      topCrystalOp: '.75',
      fracOp: { a: '.20', b: '.18', c: '.15', d: '.30' },
      cracksOp: '.30',
      veinsOp: '.18',
      borderOuter: { w: '15', op: '1' },
      borderInner: { w: '3.2', op: '.80' },
      rimOpacity: '.48',
      glowFinalOp: '.09',
      rivetOp: '.92',
      centerDot: { r: '4.5', op: '.95' },
      accentLine: '#FFCC00',
      accentDot: '#FFE840',
      extraAura: { color: '#FFAA00', op: '.10', r: '140' },
      rivetColor: '#FFCC00',
      rivetLight: '#FFFAAA',
    },
  
    legendario: {
      // ── DIAMANTE VERDE + MORADO OSCURO — rudo, masculino ──
      bg1: { cx: '38%', cy: '35%', c0: '#1A0040', c50: '#0E0028', c100: '#060010' },
      bg2: { c0: '#160035', c100: '#04000E' },
      frameColor: '#00CC66',
      frameGlow: '#008844',
      frameLight: '#00FF88',
      frameShine: '#AAFFCC',
      cr1: { c0: '#00FF88', c0op: '.95', c60: '#00CC55', c60op: '.65', c100: '#006633', c100op: '.30' },
      cr2: { c0: '#00EE77', c0op: '.88', c100: '#009944', c100op: '.28' },
      cr3: { c0: '#AAFFCC', c0op: '.72', c100: '#00DD66', c100op: '.22' },
      flare: { cx: '40%', cy: '40%', c0op: '.45', c40op: '.18', color: '#00CC66' },
      wingOpacity: { outer: '.55', mid: '.70', inner: '.85' },
      wingLineOp: '.95',
      topCrystalOp: '.90',
      fracOp: { a: '.28', b: '.25', c: '.22', d: '.40' },
      cracksOp: '.40',
      veinsOp: '.24',
      borderOuter: { w: '16', op: '1' },
      borderInner: { w: '3.5', op: '.90' },
      rimOpacity: '.62',
      glowFinalOp: '.14',
      rivetOp: '1',
      centerDot: { r: '5', op: '1' },
      accentLine: '#00CC66',
      accentDot: '#00FF88',
      extraAura: { color: '#6600CC', op: '.18', r: '160' },
      rivetColor: '#00CC66',
      rivetLight: '#AAFFCC',
    },
  }
  
  export default function DesignPremium({ variant = 'inicio', clipId = 'activeCardClip' }) {
    const v = VARIANTS[variant] || VARIANTS.inicio
  
    const SHAPE = "M 170 0 Q 140 30 100 45 Q 60 58 20 60 L 20 130 Q 20 165 0 170 L 0 440 Q 0 465 38 480 Q 65 494 98 500 Q 130 506 148 510 Q 159 516 170 522 Q 181 516 192 510 Q 210 506 242 500 Q 275 494 302 480 Q 340 465 340 440 L 340 170 Q 320 165 320 130 L 320 60 Q 280 58 240 45 Q 200 30 170 0 Z"
    const INNER = "M 42 4 Q 24 4 24 22 L 24 50 Q 24 68 6 68 L 6 438 Q 6 462 42 476 Q 68 489 100 495 Q 131 501 149 505 Q 159 510 170 516 Q 181 510 191 505 Q 209 501 240 495 Q 272 489 298 476 Q 334 462 334 438 L 334 68 Q 316 68 316 50 L 316 22 Q 316 4 298 4 Z"
    const cr1 = v.cr1
    const cr2 = v.cr2
    const cr3 = v.cr3
    const isLegendario = variant === 'legendario'
    const isOro = variant === 'oro'
  
    return (
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox="0 0 340 530"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradientes de marco — únicos por variante */}
          <linearGradient id={`gFrame1_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={v.frameShine}/>
            <stop offset="25%"  stopColor={v.frameLight}/>
            <stop offset="50%"  stopColor={v.frameColor}/>
            <stop offset="75%"  stopColor={v.frameGlow}/>
            <stop offset="100%" stopColor={v.frameColor}/>
          </linearGradient>
          <linearGradient id={`gFrame2_${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={v.frameShine}/>
            <stop offset="40%"  stopColor={v.frameLight}/>
            <stop offset="100%" stopColor={v.frameGlow}/>
          </linearGradient>
          <linearGradient id={`gFrameShine_${variant}`} x1="0%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#FFFFFF"      stopOpacity={v.goldShine || '.6'}/>
            <stop offset="40%"  stopColor={v.frameLight} stopOpacity=".3"/>
            <stop offset="100%" stopColor={v.frameColor} stopOpacity="0"/>
          </linearGradient>
          {/* Fondos */}
          <radialGradient id={`gBg1_${variant}`} cx={v.bg1.cx} cy={v.bg1.cy} r="65%">
            <stop offset="0%"   stopColor={v.bg1.c0}/>
            <stop offset="50%"  stopColor={v.bg1.c50}/>
            <stop offset="100%" stopColor={v.bg1.c100}/>
          </radialGradient>
          <linearGradient id={`gBg2_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={v.bg2.c0}/>
            <stop offset="100%" stopColor={v.bg2.c100}/>
          </linearGradient>
          {/* Cristales */}
          <linearGradient id={`gCr1_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={cr1.c0}   stopOpacity={cr1.c0op}/>
            <stop offset="60%"  stopColor={cr1.c60}  stopOpacity={cr1.c60op}/>
            <stop offset="100%" stopColor={cr1.c100} stopOpacity={cr1.c100op}/>
          </linearGradient>
          <linearGradient id={`gCr2_${variant}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={cr2.c0}   stopOpacity={cr2.c0op}/>
            <stop offset="100%" stopColor={cr2.c100} stopOpacity={cr2.c100op}/>
          </linearGradient>
          <linearGradient id={`gCr3_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={cr3.c0}   stopOpacity={cr3.c0op}/>
            <stop offset="100%" stopColor={cr3.c100} stopOpacity={cr3.c100op}/>
          </linearGradient>
          {/* Flare */}
          <radialGradient id={`gFlare_${variant}`} cx={v.flare.cx} cy={v.flare.cy} r="40%">
            <stop offset="0%"   stopColor="#FFFFFF"       stopOpacity={v.flare.c0op}/>
            <stop offset="40%"  stopColor={v.flare.color} stopOpacity={v.flare.c40op}/>
            <stop offset="100%" stopColor={v.flare.color} stopOpacity="0"/>
          </radialGradient>
          {/* Aura extra */}
          {v.extraAura && (
            <radialGradient id={`gAura_${variant}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={v.extraAura.color} stopOpacity={v.extraAura.op}/>
              <stop offset="100%" stopColor={v.extraAura.color} stopOpacity="0"/>
            </radialGradient>
          )}
          {/* Filtros */}
          <filter id={`fGlow_${variant}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={isLegendario ? '4.5' : isOro ? '4' : '3'} result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <filter id={`fCrGlow_${variant}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation={isLegendario ? '5.5' : isOro ? '4.5' : '4'} result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <filter id="fSoft_p"><feGaussianBlur stdDeviation="2"/></filter>
          <filter id="fIG_p" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.5" result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox" transform="scale(0.002941,0.001887)">
            <path d={SHAPE}/>
          </clipPath>
        </defs>
  
        {/* ── ALAS IZQUIERDA ── */}
        <polygon points="-45,150 -8,128 -4,148 -10,208 -13,238 -42,232 -52,192"
          fill={`url(#gCr2_${variant})`} filter={`url(#fCrGlow_${variant})`} opacity={v.wingOpacity.outer}/>
        <polygon points="-36,155 -5,135 -2,155 -7,205 -10,230 -36,225 -44,190"
          fill={`url(#gCr1_${variant})`} opacity={v.wingOpacity.mid}/>
        <polygon points="-25,162 -2,142 1,160 -4,202 -6,222 -24,218 -30,188"
          fill={`url(#gCr3_${variant})`} opacity={v.wingOpacity.inner}/>
        <line x1="-45" y1="150" x2="-8"  y2="128" stroke={v.accentLine} strokeWidth="1.2" opacity={v.wingLineOp}/>
        <line x1="-45" y1="150" x2="-52" y2="192" stroke={v.accentLine} strokeWidth=".8"  opacity={v.wingLineOp}/>
        <line x1="-52" y1="192" x2="-42" y2="232" stroke={v.accentLine} strokeWidth=".8"  opacity={parseFloat(v.wingLineOp) * .75}/>
        <polygon points="-18,100 8,82 12,100 8,128 -14,126"
          fill={`url(#gCr1_${variant})`} opacity={v.wingOpacity.inner} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="-18,100 8,82 12,100 8,128 -14,126"
          fill="none" stroke={v.accentLine} strokeWidth=".8" opacity={v.wingLineOp}/>
        <polygon points="-30,258 -4,248 -1,268 -7,288 -28,284"
          fill={`url(#gCr2_${variant})`} opacity={parseFloat(v.wingOpacity.outer) * 1.4}/>
        <polygon points="-14,308 0,302 2,314 -10,319"
          fill={v.accentLine} opacity={parseFloat(v.wingOpacity.outer) * 1.2}/>
        <polygon points="-20,345 -4,339 -2,350 -16,355"
          fill={v.accentLine} opacity={parseFloat(v.wingOpacity.outer) * .9}/>
  
        {/* Alas extra legendario/oro */}
        {(isLegendario || isOro) && (
          <>
            <polygon points="-62,168 -28,144 -22,165 -30,225 -34,260 -65,252 -78,205"
              fill={`url(#gCr2_${variant})`} filter={`url(#fCrGlow_${variant})`}
              opacity={isLegendario ? '.30' : '.20'}/>
            <line x1="-62" y1="168" x2="-28" y2="144" stroke={v.accentLine} strokeWidth="1"
              opacity={isLegendario ? '.58' : '.40'}/>
          </>
        )}
  
        {/* ── ALAS DERECHA ── */}
        <polygon points="385,150 348,128 344,148 350,208 353,238 382,232 392,192"
          fill={`url(#gCr2_${variant})`} filter={`url(#fCrGlow_${variant})`} opacity={v.wingOpacity.outer}/>
        <polygon points="376,155 345,135 342,155 347,205 350,230 376,225 384,190"
          fill={`url(#gCr1_${variant})`} opacity={v.wingOpacity.mid}/>
        <polygon points="365,162 342,142 339,160 344,202 346,222 364,218 370,188"
          fill={`url(#gCr3_${variant})`} opacity={v.wingOpacity.inner}/>
        <line x1="385" y1="150" x2="348" y2="128" stroke={v.accentLine} strokeWidth="1.2" opacity={v.wingLineOp}/>
        <line x1="385" y1="150" x2="392" y2="192" stroke={v.accentLine} strokeWidth=".8"  opacity={v.wingLineOp}/>
        <line x1="392" y1="192" x2="382" y2="232" stroke={v.accentLine} strokeWidth=".8"  opacity={parseFloat(v.wingLineOp) * .75}/>
        <polygon points="358,100 332,82 328,100 332,128 354,126"
          fill={`url(#gCr1_${variant})`} opacity={v.wingOpacity.inner} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="358,100 332,82 328,100 332,128 354,126"
          fill="none" stroke={v.accentLine} strokeWidth=".8" opacity={v.wingLineOp}/>
        <polygon points="370,258 344,248 341,268 347,288 368,284"
          fill={`url(#gCr2_${variant})`} opacity={parseFloat(v.wingOpacity.outer) * 1.4}/>
        <polygon points="354,308 340,302 338,314 350,319"
          fill={v.accentLine} opacity={parseFloat(v.wingOpacity.outer) * 1.2}/>
        <polygon points="360,345 344,339 342,350 356,355"
          fill={v.accentLine} opacity={parseFloat(v.wingOpacity.outer) * .9}/>
  
        {(isLegendario || isOro) && (
          <>
            <polygon points="402,168 368,144 362,165 370,225 374,260 405,252 418,205"
              fill={`url(#gCr2_${variant})`} filter={`url(#fCrGlow_${variant})`}
              opacity={isLegendario ? '.30' : '.20'}/>
            <line x1="402" y1="168" x2="368" y2="144" stroke={v.accentLine} strokeWidth="1"
              opacity={isLegendario ? '.58' : '.40'}/>
          </>
        )}
  
        {/* ── CRISTALES SUPERIORES ── */}
        <polygon points="30,88 57,70 61,85 57,108 35,106"
          fill={`url(#gCr1_${variant})`} opacity={v.topCrystalOp} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="30,88 57,70 61,85 57,108 35,106"
          fill="none" stroke={v.accentLine} strokeWidth=".8" opacity={parseFloat(v.topCrystalOp) + .12}/>
        <polygon points="83,60 111,48 113,62 111,82 87,80"
          fill={`url(#gCr2_${variant})`} opacity={parseFloat(v.topCrystalOp) * .9}/>
        <polygon points="153,36 170,20 187,36 184,52 156,52"
          fill={`url(#gCr1_${variant})`} opacity={parseFloat(v.topCrystalOp) + .08} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="153,36 170,20 187,36 184,52 156,52"
          fill="none" stroke={v.accentLine} strokeWidth="1" opacity={parseFloat(v.topCrystalOp) + .18}/>
        <line x1="170" y1="20" x2="170" y2="52" stroke="#FFFFFF" strokeWidth=".8" opacity={parseFloat(v.topCrystalOp) + .08}/>
        <polygon points="227,48 255,60 257,75 255,82 231,80"
          fill={`url(#gCr2_${variant})`} opacity={parseFloat(v.topCrystalOp) * .9}/>
        <polygon points="279,70 306,88 301,106 279,108 265,85"
          fill={`url(#gCr1_${variant})`} opacity={v.topCrystalOp} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="279,70 306,88 301,106 279,108 265,85"
          fill="none" stroke={v.accentLine} strokeWidth=".8" opacity={parseFloat(v.topCrystalOp) + .12}/>
        <polygon points="126,50 140,42 138,53 124,56" fill={v.accentLine} opacity={parseFloat(v.topCrystalOp) * .75}/>
        <polygon points="200,42 214,50 212,60 198,56" fill={v.accentLine} opacity={parseFloat(v.topCrystalOp) * .75}/>
  
        {/* Cristales superiores extra legendario */}
        {isLegendario && (
          <>
            <polygon points="10,72 36,55 40,70 36,92 15,90"
              fill={`url(#gCr1_${variant})`} opacity=".58" filter={`url(#fCrGlow_${variant})`}/>
            <polygon points="300,72 324,90 320,92 296,92 280,70"
              fill={`url(#gCr1_${variant})`} opacity=".58" filter={`url(#fCrGlow_${variant})`}/>
            <polygon points="60,40 80,28 84,42 80,56 62,54"
              fill={`url(#gCr3_${variant})`} opacity=".48"/>
            <polygon points="256,28 280,40 278,54 258,56 252,42"
              fill={`url(#gCr3_${variant})`} opacity=".48"/>
          </>
        )}
  
        {/* ── CRISTALES INFERIORES ── */}
        <polygon points="48,530 76,540 83,527 60,522"
          fill={`url(#gCr2_${variant})`} opacity={parseFloat(v.wingOpacity.outer) * 1.5} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="98,538 126,546 130,532 104,528"
          fill={`url(#gCr1_${variant})`} opacity={parseFloat(v.wingOpacity.outer) * 1.3}/>
        <polygon points="148,542 170,558 192,542 188,528 152,528"
          fill={`url(#gCr1_${variant})`} opacity={parseFloat(v.topCrystalOp) + .10} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="148,542 170,558 192,542 188,528 152,528"
          fill="none" stroke={v.accentLine} strokeWidth="1.2" opacity={parseFloat(v.topCrystalOp) + .22}/>
        <line x1="170" y1="558" x2="170" y2="528" stroke="#FFFFFF" strokeWidth="1" opacity={parseFloat(v.topCrystalOp) + .12}/>
        <polygon points="210,532 236,546 246,538 216,528"
          fill={`url(#gCr1_${variant})`} opacity={parseFloat(v.wingOpacity.outer) * 1.3}/>
        <polygon points="256,522 276,527 283,540 260,546"
          fill={`url(#gCr2_${variant})`} opacity={parseFloat(v.wingOpacity.outer) * 1.5} filter={`url(#fCrGlow_${variant})`}/>
  
        {/* ── SOMBRA EXTERIOR ── */}
        <path d={SHAPE} fill="rgba(0,0,0,.75)" filter="url(#fSoft_p)" transform="translate(4,5)"/>
  
        {/* ── FONDO INTERNO ── */}
        <path d={SHAPE} fill={`url(#gBg2_${variant})`}/>
        <path d={SHAPE} fill={`url(#gBg1_${variant})`} opacity=".85"/>
  
        {/* Aura extra */}
        {v.extraAura && (
          <ellipse cx="170" cy="300" rx={v.extraAura.r} ry="160"
            fill={`url(#gAura_${variant})`} opacity="1"/>
        )}
  
        {/* ── VETAS ── */}
        <g opacity={v.veinsOp} stroke={v.accentLine} fill="none">
          <line x1="30"  y1="120" x2="180" y2="250" strokeWidth="1.2"/>
          <line x1="20"  y1="195" x2="200" y2="345" strokeWidth="1"/>
          <line x1="160" y1="115" x2="315" y2="275" strokeWidth="1"/>
          <line x1="50"  y1="315" x2="280" y2="465" strokeWidth=".8"/>
          <line x1="145" y1="155" x2="320" y2="335" strokeWidth="1"/>
        </g>
  
        {/* ── GRIETAS ── */}
        <g opacity={v.cracksOp} stroke={v.accentLine} strokeWidth=".6" fill="none">
          <path d="M 90 138 L 108 163 L 98 183 L 120 213"/>
          <path d="M 235 152 L 253 176 L 243 196 L 262 222"/>
          <path d="M 42 288 L 64 308 L 52 328 L 70 346"/>
          <path d="M 282 268 L 300 292 L 289 312 L 308 332"/>
          <path d="M 130 425 L 152 405 L 140 383 L 164 360"/>
          <path d="M 205 435 L 223 413 L 211 391 L 233 368"/>
          {(isLegendario || isOro) && (
            <>
              <path d="M 55 158 L 72 182 L 62 200 L 82 226"/>
              <path d="M 260 165 L 278 188 L 268 208 L 288 232"/>
            </>
          )}
        </g>
  
        {/* ── FRAGMENTOS INTERNOS ── */}
        <polygon points="185,208 228,178 258,228 244,286 200,296 178,256"
          fill={v.accentLine} opacity={v.fracOp.a} filter="url(#fSoft_p)"/>
        <polygon points="185,208 228,178 258,228 244,286 200,296 178,256"
          fill="none" stroke={v.accentLine} strokeWidth=".9" opacity={v.fracOp.b}/>
        <polygon points="218,160 248,146 266,180 253,208 221,213"
          fill={v.accentLine} opacity={parseFloat(v.fracOp.a) * .85} filter="url(#fSoft_p)"/>
        <polygon points="218,160 248,146 266,180 253,208 221,213"
          fill="none" stroke={v.accentLine} strokeWidth=".7" opacity={v.fracOp.c}/>
        <polygon points="198,296 238,286 252,330 233,355 191,346"
          fill={v.accentLine} opacity={parseFloat(v.fracOp.a) * .7} filter="url(#fSoft_p)"/>
        <polygon points="198,296 238,286 252,330 233,355 191,346"
          fill="none" stroke={v.accentLine} strokeWidth=".7" opacity={parseFloat(v.fracOp.c) * .85}/>
        <polygon points="244,223 266,213 274,240 257,248"
          fill={v.accentLine} opacity={v.fracOp.d}/>
        <polygon points="244,223 266,213 274,240 257,248"
          fill="none" stroke={v.accentLine} strokeWidth=".6" opacity={parseFloat(v.fracOp.d) * 1.4}/>
  
        {/* Fragmentos extra legendario */}
        {isLegendario && (
          <>
            <polygon points="82,220 120,200 138,240 124,288 85,295 68,258"
              fill={v.accentLine} opacity=".20" filter="url(#fSoft_p)"/>
            <polygon points="82,220 120,200 138,240 124,288 85,295 68,258"
              fill="none" stroke={v.accentLine} strokeWidth=".8" opacity=".35"/>
            <polygon points="105,165 138,152 152,184 138,208 108,212"
              fill={v.accentLine} opacity=".16" filter="url(#fSoft_p)"/>
            <polygon points="105,165 138,152 152,184 138,208 108,212"
              fill="none" stroke={v.accentLine} strokeWidth=".6" opacity=".30"/>
          </>
        )}
  
        {/* ── FLARE ── */}
        <ellipse cx="150" cy="308" rx="110" ry="130" fill={`url(#gFlare_${variant})`} opacity=".9"/>
  
        {/* ── MARCO INTERIOR ── */}
        <path d={INNER} fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="8"/>
        <path d={INNER} fill="none" stroke={`url(#gFrame1_${variant})`} strokeWidth={v.borderInner.w} opacity={v.borderInner.op}/>
        <path d={INNER} fill="none" stroke={v.accentDot} strokeWidth=".8" opacity={v.rimOpacity}/>
  
        {/* ── MARCO EXTERIOR ── */}
        <path d={SHAPE} fill="none" stroke={`url(#gFrame1_${variant})`} strokeWidth={v.borderOuter.w} filter={`url(#fGlow_${variant})`} opacity={v.borderOuter.op}/>
        <path d={SHAPE} fill="none" stroke={v.accentDot} strokeWidth="1.5" opacity={parseFloat(v.rimOpacity) + .10}/>
        <path d={SHAPE} fill="none" stroke={`url(#gFrameShine_${variant})`} strokeWidth="8" opacity=".5"/>
  
        {/* ── PUNTA SUPERIOR ── */}
        <path d="M 120 36 L 127 32 C 134 40 141 45 153 40 C 159 36 164 32 170 28 C 176 32 181 36 187 40 C 199 45 206 40 213 32 L 220 36"
          fill="none" stroke={v.accentDot} strokeWidth="1.5" opacity={parseFloat(v.rimOpacity) + .48}/>
        <circle cx="170" cy="28" r={v.centerDot.r}                      fill={v.accentDot} opacity={v.centerDot.op}/>
        <circle cx="170" cy="28" r={parseFloat(v.centerDot.r) + 3}      fill="none" stroke={v.accentLine} strokeWidth="1" opacity={parseFloat(v.centerDot.op) * .5}/>
        <line x1="170" y1="20" x2="170" y2="40" stroke={v.accentDot} strokeWidth="1.2" opacity={parseFloat(v.centerDot.op) * .68}/>
  
        {isLegendario && (
          <circle cx="170" cy="28" r="16" fill="none" stroke={v.accentLine}
            strokeWidth=".8" opacity=".38" filter={`url(#fCrGlow_${variant})`}/>
        )}
  
        {/* ── REMACHES ── */}
        {[148, 208, 268, 328, 388].map((y, i) => (
          <g key={`rl_${i}`}>
            <circle cx="22" cy={y} r="4" fill={`url(#gFrame2_${variant})`} opacity={v.rivetOp}/>
            <circle cx="22" cy={y} r="6" fill="none" stroke={v.rivetLight} strokeWidth=".8" opacity={parseFloat(v.rivetOp) * .48}/>
            <circle cx="22" cy={y} r="2" fill={v.rivetLight} opacity={parseFloat(v.rivetOp) * .62}/>
          </g>
        ))}
        {[148, 208, 268, 328, 388].map((y, i) => (
          <g key={`rr_${i}`}>
            <circle cx="318" cy={y} r="4" fill={`url(#gFrame2_${variant})`} opacity={v.rivetOp}/>
            <circle cx="318" cy={y} r="6" fill="none" stroke={v.rivetLight} strokeWidth=".8" opacity={parseFloat(v.rivetOp) * .48}/>
            <circle cx="318" cy={y} r="2" fill={v.rivetLight} opacity={parseFloat(v.rivetOp) * .62}/>
          </g>
        ))}
  
        {/* ── PUNTA INFERIOR ── */}
        <line x1="170" y1="522" x2="90"  y2="500" stroke={v.accentLine} strokeWidth="1" opacity={parseFloat(v.rimOpacity) + .26}/>
        <line x1="170" y1="522" x2="250" y2="500" stroke={v.accentLine} strokeWidth="1" opacity={parseFloat(v.rimOpacity) + .26}/>
        <polygon points="170,530 177,522 170,514 163,522"
          fill={v.accentDot} opacity={parseFloat(v.centerDot.op) * .85} filter="url(#fIG_p)"/>
  
        {/* ── HEXÁGONO INFERIOR ── */}
        <polygon points="170,542 183,535 183,521 170,514 157,521 157,535"
          fill={v.accentLine} opacity={v.rimOpacity} filter={`url(#fCrGlow_${variant})`}/>
        <polygon points="170,542 183,535 183,521 170,514 157,521 157,535"
          fill="none" stroke={v.accentLine} strokeWidth="1.2" opacity={parseFloat(v.rimOpacity) + .40}/>
        <line x1="170" y1="514" x2="170" y2="542" stroke={v.accentLine} strokeWidth=".7" opacity={parseFloat(v.rimOpacity) + .20}/>
        <circle cx="170" cy="528" r="3.5" fill={v.accentLine} opacity={parseFloat(v.rimOpacity) + .40}/>
  
        {/* ── EMBLEMA ── */}
        <path d="M 157 50 L 170 43 L 183 50 L 183 65 Q 183 74 170 78 Q 157 74 157 65 Z"
          fill="none" stroke={v.accentLine} strokeWidth="1.2" opacity={parseFloat(v.rimOpacity) + .36}/>
        <text x="170" y="68" textAnchor="middle" fill={v.accentDot}
          fontSize="9" fontFamily="Georgia, serif" opacity={parseFloat(v.rimOpacity) + .46} letterSpacing="1.5">XII</text>
  
        {/* ── MICRO SCRATCHES ── */}
        <g opacity={parseFloat(v.veinsOp) * .65} stroke={v.accentLine} strokeWidth=".3" fill="none">
          <line x1="30"  y1="135" x2="58"  y2="132"/>
          <line x1="68"  y1="155" x2="98"  y2="152"/>
          <line x1="260" y1="138" x2="302" y2="135"/>
          <line x1="248" y1="168" x2="300" y2="164"/>
          <line x1="48"  y1="385" x2="82"  y2="380"/>
          <line x1="245" y1="375" x2="285" y2="370"/>
        </g>
  
        {/* ── GLOW FINAL ── */}
        <path d={SHAPE} fill="none" stroke={v.accentLine} strokeWidth="20" opacity={v.glowFinalOp} filter="url(#fSoft_p)"/>
        <circle cx="170" cy="28"  r="5"   fill={v.accentDot} opacity={parseFloat(v.centerDot.op) * .90} filter="url(#fIG_p)"/>
        <circle cx="22"  cy="110" r="2.5" fill={v.accentDot} opacity={parseFloat(v.rivetOp) * .70}/>
        <circle cx="318" cy="110" r="2.5" fill={v.accentDot} opacity={parseFloat(v.rivetOp) * .70}/>
        <circle cx="20"  cy="440" r="2.5" fill={v.accentLine} opacity={parseFloat(v.rivetOp) * .60}/>
        <circle cx="320" cy="440" r="2.5" fill={v.accentLine} opacity={parseFloat(v.rivetOp) * .60}/>
        <circle cx="170" cy="522" r="3"   fill={v.accentDot} opacity={parseFloat(v.centerDot.op) * .80} filter="url(#fIG_p)"/>
  
      </svg>
    )
  }
  