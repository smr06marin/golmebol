// Arte de las tarjetas de jugador de Golmebol (diseños propios).
//
// Cuatro materiales, uno por nivel, para que cada nivel se vea claramente mejor que el anterior:
//   1 · INICIACIÓN  → "Cancha":  mate, líneas de cancha, marco fino.
//   2 · COMPETIDOR  → "Acero":   metal cepillado, marco biselado con remaches.
//   3 · ÉLITE       → "Cristal": facetas, brillo que recorre la tarjeta, gema arriba.
//   4 · LEYENDA     → "Mármol y oro": vetas doradas, corona, destellos; las dos últimas cambian a placa clara.
// Dentro de cada nivel hay 5 pasos (las 5 tarjetas del nivel): cambian el color y suman una estrella.
//
// Todo se dibuja en SVG sobre un lienzo fijo de 340×520, así la tarjeta se ve idéntica en cualquier
// tamaño y en cualquier celular (Android o iPhone).

export const W = 340
export const H = 520
export const FUENTE = "'Bebas Neue','Barlow Condensed',Impact,'Arial Narrow',sans-serif"

// Silueta de cada nivel
export const FORMAS = {
  1: 'M 30 16 H 136 L 150 26 H 190 L 204 16 H 310 Q 324 16 324 30 V 404 Q 324 436 296 452 L 170 506 L 44 452 Q 16 436 16 404 V 30 Q 16 16 30 16 Z',
  2: 'M 44 22 H 122 L 136 10 H 204 L 218 22 H 296 L 324 50 V 400 Q 324 438 292 454 L 170 508 L 48 454 Q 16 438 16 400 V 50 Z',
  3: 'M 170 6 L 214 30 H 300 Q 312 30 316 42 L 326 72 V 398 Q 326 440 290 456 L 170 510 L 50 456 Q 14 440 14 398 V 72 L 24 42 Q 28 30 40 30 H 126 Z',
  4: 'M 170 4 L 196 28 L 232 14 L 248 36 H 298 Q 314 36 318 52 L 328 84 V 396 Q 328 440 290 458 L 170 514 L 50 458 Q 12 440 12 396 V 84 L 22 52 Q 26 36 42 36 H 92 L 108 14 L 144 28 Z',
}
const GROSOR = { 1: 3, 2: 6, 3: 7, 4: 9 }
export const NOMBRE_NIVEL = { 1: 'INICIACIÓN', 2: 'COMPETIDOR', 3: 'ÉLITE', 4: 'LEYENDA' }
export const MATERIAL_NIVEL = { 1: 'Cancha', 2: 'Acero', 3: 'Cristal', 4: 'Mármol y oro' }

// La silueta como polígono en porcentajes: sirve para recortar la foto con CSS en cualquier tamaño.
function muestrear(d) {
  const t = d.match(/[MLHVQZ]|-?\d+(?:\.\d+)?/g)
  const pts = []
  let i = 0, x = 0, y = 0, cmd = ''
  const n = () => parseFloat(t[i++])
  while (i < t.length) {
    if (/[MLHVQZ]/.test(t[i])) cmd = t[i++]
    if (cmd === 'Z') break
    if (cmd === 'M' || cmd === 'L') { x = n(); y = n(); pts.push([x, y]) }
    else if (cmd === 'H') { x = n(); pts.push([x, y]) }
    else if (cmd === 'V') { y = n(); pts.push([x, y]) }
    else if (cmd === 'Q') {
      const cx = n(), cy = n(), ex = n(), ey = n()
      for (let k = 1; k <= 6; k++) {
        const u = k / 6
        pts.push([(1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * ex, (1 - u) * (1 - u) * y + 2 * (1 - u) * u * cy + u * u * ey])
      }
      x = ex; y = ey
    }
  }
  return pts
}
const POLIGONOS = {}
export function poligonoCss(nivel) {
  if (!POLIGONOS[nivel]) {
    POLIGONOS[nivel] = 'polygon(' + muestrear(FORMAS[nivel]).map(([x, y]) => `${(x / W * 100).toFixed(2)}% ${(y / H * 100).toFixed(2)}%`).join(',') + ')'
  }
  return POLIGONOS[nivel]
}

// ── Paleta de cada tarjeta ────────────────────────────────────────────────────────────────────
// a = acento · b = acento claro · fondo = arriba/abajo · placa = zona de datos · tinta = texto sobre la placa
const OSC = { tinta: '#ffffff', suave: 'rgba(255,255,255,.72)', arriba: '#ffffff' }
const ARTE = {
  // INICIACIÓN · Cancha
  nivel1_verde:  { n: 1, p: 1, a: '#35e06f', b: '#b6ffd0', fondo: ['#123322', '#060d09'], placa: ['#0d1410', '#070a08'], ...OSC },
  nivel1_azul:   { n: 1, p: 2, a: '#2ea6ff', b: '#bfe4ff', fondo: ['#0e2a45', '#050b12'], placa: ['#0c1219', '#06090d'], ...OSC },
  nivel1_bronce: { n: 1, p: 3, a: '#e58f42', b: '#ffd2a6', fondo: ['#3a2110', '#0e0804'], placa: ['#17100a', '#0b0705'], ...OSC },
  nivel1_plata:  { n: 1, p: 4, a: '#d5dbe2', b: '#ffffff', fondo: ['#2b3036', '#0a0b0d'], placa: ['#14161a', '#08090b'], ...OSC },
  nivel1_oro:    { n: 1, p: 5, a: '#ffcf33', b: '#fff0a8', fondo: ['#3d3008', '#0e0b02'], placa: ['#181405', '#0b0902'], ...OSC },
  // COMPETIDOR · Acero
  nivel2_inicio:     { n: 2, p: 1, a: '#4f92ff', b: '#cfe1ff', fondo: ['#1b4fc4', '#061233'], placa: ['#101a33', '#060a14'], ...OSC },
  nivel2_bronce:     { n: 2, p: 2, a: '#ef7f36', b: '#ffd0a8', fondo: ['#9a3f0e', '#210b02'], placa: ['#2a160b', '#0e0703'], ...OSC },
  nivel2_plata:      { n: 2, p: 3, a: '#c3cadf', b: '#ffffff', fondo: ['#5b6076', '#12131b'], placa: ['#20222c', '#0b0c11'], ...OSC },
  nivel2_oro:        { n: 2, p: 4, a: '#ffc928', b: '#fff0a8', fondo: ['#9a7208', '#201702'], placa: ['#2b2207', '#0f0c02'], ...OSC },
  nivel2_legendario: { n: 2, p: 5, a: '#1fdc84', b: '#b6ffdb', fondo: ['#0b7a48', '#03180f'], placa: ['#0b2318', '#040d09'], ...OSC },
  // ÉLITE · Cristal
  nivel3_inicio:     { n: 3, p: 1, a: '#5fa0ff', b: '#e0edff', fondo: ['#2a6cf0', '#050b2c'], placa: ['#0d1c4a', '#040818'], ...OSC },
  nivel3_bronce:     { n: 3, p: 2, a: '#ff8c40', b: '#ffe0c4', fondo: ['#d2530f', '#240902'], placa: ['#3a1707', '#120602'], ...OSC },
  nivel3_plata:      { n: 3, p: 3, a: '#dfe6ff', b: '#ffffff', fondo: ['#8d95b8', '#11121c'], placa: ['#272a3c', '#0b0c14'], ...OSC },
  nivel3_oro:        { n: 3, p: 4, a: '#ffd84a', b: '#fff6c8', fondo: ['#d39c0a', '#231802'], placa: ['#3a2c06', '#120e02'], ...OSC },
  nivel3_legendario: { n: 3, p: 5, a: '#2df09c', b: '#d0ffea', fondo: ['#0aa863', '#0c0426'], placa: ['#0c2f24', '#07051a'], ...OSC },
  // LEYENDA · Mármol y oro
  premium_inicio:     { n: 4, p: 1, a: '#dcbb5e', b: '#fff1c2', fondo: ['#26262c', '#050506'], placa: ['#17171a', '#060607'], tinta: '#fbefc9', suave: 'rgba(251,239,201,.74)', arriba: '#fbefc9', marco: 'oro' },
  premium_bronce:     { n: 4, p: 2, a: '#eeb680', b: '#ffe6cf', fondo: ['#6a1428', '#14040a'], placa: ['#300b15', '#0e0306'], tinta: '#ffeede', suave: 'rgba(255,238,222,.74)', arriba: '#ffeede', marco: 'oroRosa' },
  premium_plata:      { n: 4, p: 3, a: '#d6e4ff', b: '#ffffff', fondo: ['#1f46a8', '#060b26'], placa: ['#0f1d4a', '#050816'], tinta: '#f1f6ff', suave: 'rgba(241,246,255,.74)', arriba: '#f1f6ff', marco: 'platino' },
  premium_oro:        { n: 4, p: 4, a: '#6e4b08', b: '#3a2703', fondo: ['#e3b848', '#7a560d'], placa: ['#f6dd86', '#c99d2e'], tinta: '#231703', suave: 'rgba(35,23,3,.72)', arriba: '#231703', marco: 'oro', clara: true },
  premium_legendario: { n: 4, p: 5, a: '#a97c10', b: '#5e4406', fondo: ['#fdfaf1', '#d8cfb8'], placa: ['#fffdf7', '#e7dec6'], tinta: '#1d1606', suave: 'rgba(29,22,6,.7)', arriba: '#1d1606', marco: 'oro', clara: true, holo: true },
}

const MARCOS = {
  oro:     ['#7a5a12', '#f8e7a0', '#c9a23a', '#fff6c8', '#8a6a1a'],
  oroRosa: ['#7d4a2a', '#ffd9b8', '#d39a6a', '#fff0e2', '#8a5532'],
  platino: ['#5d6b8c', '#f4f8ff', '#aebbd8', '#ffffff', '#6b7896'],
}

// Devuelve la paleta de una tarjeta. Las tarjetas especiales creadas desde el panel (solo traen un color)
// usan el material del nivel 1 con ese color.
export function arteDe(design) {
  const base = ARTE[design?.id]
  if (base) return { ...base, id: design.id }
  const a = design?.color || '#35e06f'
  return { n: 1, p: 0, a, b: design?.colorSecundario || a, fondo: ['#1b1f24', '#07080a'], placa: ['#111316', '#07080a'], ...OSC, id: design?.id || 'custom' }
}

// Números "al azar" pero siempre iguales para la misma tarjeta (facetas y vetas no cambian entre visitas)
function azar(semilla) {
  let h = 2166136261
  for (let i = 0; i < semilla.length; i++) { h ^= semilla.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function Facetas({ semilla, x0, y0, w, h, cols, filas }) {
  const r = azar(semilla)
  const P = []
  for (let j = 0; j <= filas; j++) for (let i = 0; i <= cols; i++) {
    const borde = i === 0 || j === 0 || i === cols || j === filas
    P.push([x0 + (i / cols) * w + (borde ? 0 : (r() - .5) * (w / cols) * .7), y0 + (j / filas) * h + (borde ? 0 : (r() - .5) * (h / filas) * .7)])
  }
  const tri = []
  const at = (i, j) => P[j * (cols + 1) + i]
  for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1)
    const corte = r() > .5
    ;(corte ? [[a, b, c], [b, d, c]] : [[a, b, d], [a, d, c]]).forEach(t => {
      const v = r()
      tri.push(<polygon key={tri.length} points={t.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}
        fill={v > .5 ? '#ffffff' : '#000000'} opacity={(v > .5 ? (v - .5) * .26 : (.5 - v) * .42).toFixed(3)}/>)
    })
  }
  return <g>{tri}</g>
}

function Vetas({ semilla, color, opacidad = .55 }) {
  const r = azar(semilla)
  const vetas = []
  for (let k = 0; k < 6; k++) {
    let x = r() * W, y = -10 + r() * 60
    let d = `M ${x.toFixed(0)} ${y.toFixed(0)}`
    const dir = r() > .5 ? 1 : -1
    for (let s = 0; s < 5; s++) {
      const nx = x + dir * (30 + r() * 50), ny = y + 50 + r() * 70
      d += ` Q ${(x + dir * r() * 60).toFixed(0)} ${(y + 30 + r() * 30).toFixed(0)} ${nx.toFixed(0)} ${ny.toFixed(0)}`
      if (r() > .55) vetas.push(<path key={`r${k}${s}`} d={`M ${x.toFixed(0)} ${y.toFixed(0)} q ${(-dir * 18).toFixed(0)} ${(16 + r() * 14).toFixed(0)} ${(-dir * (26 + r() * 22)).toFixed(0)} ${(40 + r() * 26).toFixed(0)}`}
        stroke={color} strokeWidth=".7" fill="none" opacity={opacidad * .6}/>)
      x = nx; y = ny
    }
    vetas.push(<path key={k} d={d} stroke={color} strokeWidth={(0.8 + r() * 1.1).toFixed(2)} fill="none" opacity={opacidad} strokeLinecap="round"/>)
  }
  return <g>{vetas}</g>
}

const Destello = ({ x, y, s = 1, color = '#fff', retraso = 0, animado }) => (
  <path d={`M ${x} ${y - 7 * s} Q ${x + 1.2 * s} ${y - 1.2 * s} ${x + 7 * s} ${y} Q ${x + 1.2 * s} ${y + 1.2 * s} ${x} ${y + 7 * s} Q ${x - 1.2 * s} ${y + 1.2 * s} ${x - 7 * s} ${y} Q ${x - 1.2 * s} ${y - 1.2 * s} ${x} ${y - 7 * s} Z`}
    fill={color} className={animado ? 'gmc-destello' : undefined} style={animado ? { animationDelay: `${retraso}s` } : undefined} opacity={animado ? undefined : .8}/>
)

// Definiciones compartidas por el fondo y el frente de una misma tarjeta
export function ArteDefs({ c, uid }) {
  const marco = c.n === 4 ? (MARCOS[c.marco] || MARCOS.oro) : null
  return (
    <defs>
      <clipPath id={`${uid}f`}><path d={FORMAS[c.n]}/></clipPath>
      <clipPath id={`${uid}pz`}><rect y="300" width={W} height={H - 300}/></clipPath>
      <linearGradient id={`${uid}bg`} x1="0" y1="0" x2={c.n === 1 ? '0' : '.35'} y2="1">
        <stop offset="0" stopColor={c.fondo[0]}/><stop offset="1" stopColor={c.fondo[1]}/>
      </linearGradient>
      <linearGradient id={`${uid}pl`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.placa[0]}/><stop offset="1" stopColor={c.placa[1]}/>
      </linearGradient>
      {/* La foto se funde con la placa de datos */}
      <linearGradient id={`${uid}fu`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.placa[0]} stopOpacity="0"/><stop offset=".55" stopColor={c.placa[0]} stopOpacity=".72"/><stop offset="1" stopColor={c.placa[0]}/>
      </linearGradient>
      <linearGradient id={`${uid}ri`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity=".7"/><stop offset=".55" stopColor="#000" stopOpacity=".28"/><stop offset="1" stopColor="#000" stopOpacity="0"/>
      </linearGradient>
      <radialGradient id={`${uid}gl`} cx=".5" cy=".28" r=".62">
        <stop offset="0" stopColor={c.clara ? '#ffffff' : c.a} stopOpacity={c.clara ? '.55' : '.34'}/><stop offset="1" stopColor={c.clara ? '#ffffff' : c.a} stopOpacity="0"/>
      </radialGradient>
      <linearGradient id={`${uid}mc`} x1="0" y1="0" x2=".25" y2="1">
        {marco
          ? marco.map((s, i) => <stop key={i} offset={i / (marco.length - 1)} stopColor={s}/>)
          : c.n === 1
            ? <><stop offset="0" stopColor={c.a}/><stop offset="1" stopColor={c.a}/></>
            : <><stop offset="0" stopColor={c.b}/><stop offset=".3" stopColor={c.a}/><stop offset=".55" stopColor={c.fondo[1]}/><stop offset=".8" stopColor={c.a}/><stop offset="1" stopColor={c.b}/></>}
      </linearGradient>
      <linearGradient id={`${uid}br`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0"/><stop offset=".5" stopColor="#fff" stopOpacity={c.clara ? '.75' : '.3'}/><stop offset="1" stopColor="#fff" stopOpacity="0"/>
      </linearGradient>
      <linearGradient id={`${uid}ti`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.n === 4 ? (MARCOS[c.marco] || MARCOS.oro)[2] : c.a} stopOpacity={c.n === 1 ? '.22' : '.42'}/><stop offset="1" stopColor={c.n === 4 ? (MARCOS[c.marco] || MARCOS.oro)[2] : c.a} stopOpacity="0"/>
      </linearGradient>
      {c.holo && (
        <linearGradient id={`${uid}ho`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8ad4" stopOpacity=".0"/><stop offset=".25" stopColor="#ffb86b" stopOpacity=".28"/><stop offset=".5" stopColor="#7df0c8" stopOpacity=".3"/><stop offset=".75" stopColor="#8fb6ff" stopOpacity=".28"/><stop offset="1" stopColor="#d59bff" stopOpacity="0"/>
        </linearGradient>
      )}
      {c.n === 2 && (
        <pattern id={`${uid}ce`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <rect width="5" height="1" fill="#fff" opacity=".055"/><rect y="2.5" width="5" height=".6" fill="#000" opacity=".12"/>
        </pattern>
      )}
    </defs>
  )
}

// Fondo de la tarjeta (va DEBAJO de la foto; se ve completo mientras el jugador no ha subido foto)
export function ArteFondo({ c, uid }) {
  return (
    <g clipPath={`url(#${uid}f)`}>
      <rect width={W} height={H} fill={`url(#${uid}bg)`}/>
      {c.n === 1 && (
        <>
          {[0, 1, 2, 3, 4, 5].map(i => <rect key={i} y={i * 52} width={W} height="26" fill="#fff" opacity=".035"/>)}
          <rect width={W} height={H} fill={`url(#${uid}gl)`}/>
          <g stroke={c.a} strokeWidth="1.5" fill="none" opacity=".3">
            <circle cx="170" cy="172" r="86"/>
            <line x1="16" y1="172" x2="324" y2="172"/>
            <rect x="96" y="14" width="148" height="58"/>
            <path d="M 136 72 Q 170 96 204 72"/>
          </g>
          <circle cx="170" cy="172" r="3.5" fill={c.a} opacity=".5"/>
        </>
      )}
      {c.n === 2 && (
        <>
          <rect width={W} height={H} fill={`url(#${uid}gl)`}/>
          <rect width={W} height={H} fill={`url(#${uid}ce)`}/>
          <polygon points="214,0 286,0 120,330 48,330" fill="#fff" opacity=".07"/>
          <polygon points="300,0 318,0 152,330 134,330" fill="#fff" opacity=".05"/>
          <polygon points="0,150 70,0 110,0 0,240" fill="#000" opacity=".16"/>
        </>
      )}
      {c.n === 3 && (
        <>
          <Facetas semilla={c.id} x0={0} y0={0} w={W} h={320} cols={5} filas={5}/>
          <rect width={W} height={H} fill={`url(#${uid}gl)`}/>
        </>
      )}
      {c.n === 4 && (
        <>
          <rect width={W} height={H} fill={`url(#${uid}gl)`}/>
          <Vetas semilla={c.id} color={c.clara ? (c.holo ? '#b8902a' : '#fff3c4') : (MARCOS[c.marco] || MARCOS.oro)[1]} opacidad={c.clara ? .6 : .5}/>
          {c.holo && <rect width={W} height={H} fill={`url(#${uid}ho)`}/>}
        </>
      )}
    </g>
  )
}

// Frente: fundido de la foto, placa de datos, brillos, marco y adornos (va ENCIMA de la foto)
export function ArteFrente({ c, uid, conFoto, animado }) {
  const g = GROSOR[c.n]
  const marcoClaro = c.n === 4 ? (MARCOS[c.marco] || MARCOS.oro)[3] : c.b
  return (
    <>
      <g clipPath={`url(#${uid}f)`}>
        {conFoto && <rect width={W} height="130" fill={`url(#${uid}ti)`}/>}
        {conFoto && <rect width="150" height="300" fill={`url(#${uid}ri)`}/>}
        {/* fundido foto → placa */}
        <rect y="196" width={W} height="112" fill={`url(#${uid}fu)`}/>
        <rect y="306" width={W} height={H - 306} fill={`url(#${uid}pl)`}/>

        {/* textura de la placa según el material */}
        {c.n === 2 && (
          <>
            <rect y="306" width={W} height={H - 306} fill={`url(#${uid}ce)`}/>
            <polygon points="250,306 300,306 210,520 160,520" fill="#fff" opacity=".035"/>
          </>
        )}
        {c.n === 3 && (
          <>
            <rect y="306" width={W} height={H - 306} fill={c.a} opacity=".08"/>
            <g opacity=".7"><Facetas semilla={c.id + 'p'} x0={0} y0={306} w={W} h={214} cols={4} filas={3}/></g>
          </>
        )}
        {c.n === 4 && (
          <>
            <g opacity=".5" clipPath={`url(#${uid}pz)`}><Vetas semilla={c.id + 'p'} color={c.clara ? '#b8902a' : (MARCOS[c.marco] || MARCOS.oro)[1]} opacidad={c.clara ? .35 : .22}/></g>
            <rect y="196" width={W} height="112" fill={`url(#${uid}fu)`} opacity=".9"/>
            <rect y="306" width={W} height={H - 306} fill={`url(#${uid}pl)`} opacity=".86"/>
            {c.holo && <rect y="306" width={W} height={H - 306} fill={`url(#${uid}ho)`} opacity=".7"/>}
          </>
        )}

        {/* acentos sobre la foto (esquinas), para que el material se note aunque haya foto */}
        {c.n === 2 && conFoto && <polygon points="250,0 340,0 340,120" fill={c.a} opacity=".16"/>}
        {c.n === 3 && conFoto && (
          <g opacity=".5">
            <polygon points="340,0 340,150 262,0" fill={c.a} opacity=".3"/>
            <polygon points="340,40 340,190 296,96" fill="#fff" opacity=".1"/>
          </g>
        )}
        {c.n === 4 && conFoto && <polygon points="340,0 340,130 268,0" fill={(MARCOS[c.marco] || MARCOS.oro)[2]} opacity=".2"/>}

        {/* brillo que recorre la tarjeta (niveles 3 y 4) */}
        {c.n >= 3 && animado && (
          <rect x="-160" y="-20" width="110" height={H + 40} fill={`url(#${uid}br)`} className="gmc-brillo" style={{ mixBlendMode: c.clara ? 'normal' : 'screen' }}/>
        )}

        {/* marco: trazo grueso recortado a la silueta (queda por dentro) + filo claro */}
        <path d={FORMAS[c.n]} fill="none" stroke={`url(#${uid}mc)`} strokeWidth={g * 2}/>
        {c.n >= 2 && <path d={FORMAS[c.n]} fill="none" stroke={marcoClaro} strokeWidth={c.n === 4 ? 3 : 2.4} opacity={c.n === 4 ? .95 : .8}/>}
      </g>

      {/* adornos propios de cada nivel */}
      {c.n === 1 && <path d="M 138 17.5 L 150 26 H 190 L 202 17.5 Z" fill={c.a}/>}
      {c.n === 2 && (
        <>
          <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 152 22 L 170 34 L 188 22" stroke={c.b}/>
            <path d="M 156 33 L 170 42.5 L 184 33" stroke={c.a} opacity=".65"/>
          </g>
          {[[31, 66], [309, 66], [31, 392], [309, 392]].map(([x, y], i) => (
            <g key={i}><circle cx={x} cy={y} r="3.2" fill={c.fondo[1]} stroke={c.b} strokeWidth="1"/><circle cx={x - .8} cy={y - .8} r="1" fill="#fff" opacity=".7"/></g>
          ))}
        </>
      )}
      {c.n === 3 && (
        <>
          <path d="M 170 14 L 184 30 L 170 46 L 156 30 Z" fill={c.a} stroke={c.b} strokeWidth="1.5"/>
          <path d="M 170 14 L 184 30 L 170 30 Z" fill="#fff" opacity=".45"/>
          <path d="M 156 30 L 170 46 L 170 30 Z" fill="#000" opacity=".2"/>
          <path d="M 40 30 L 24 42 L 14 72" fill="none" stroke={c.b} strokeWidth="1.5" opacity=".9"/>
          <path d="M 300 30 L 316 42 L 326 72" fill="none" stroke={c.b} strokeWidth="1.5" opacity=".9"/>
        </>
      )}
      {c.n === 4 && (
        <>
          {[[170, 6], [232, 16], [108, 16]].map(([x, y], i) => (
            <g key={i}><circle cx={x} cy={y + 3} r={i === 0 ? 5 : 4} fill={(MARCOS[c.marco] || MARCOS.oro)[3]} stroke={(MARCOS[c.marco] || MARCOS.oro)[0]} strokeWidth="1"/><circle cx={x - 1.2} cy={y + 1.8} r="1.3" fill="#fff"/></g>
          ))}
          {/* laureles a los lados de la cinta del nivel */}
          <g fill="none" stroke={(MARCOS[c.marco] || MARCOS.oro)[c.clara ? 0 : 1]} strokeWidth="1.3" strokeLinecap="round" opacity=".9">
            {[0, 1, 2].map(i => <path key={`l${i}`} d={`M ${116 - i * 9} ${470 - i * 6} q -9 -2 -11 -10 q 9 0 11 10`}/>)}
            {[0, 1, 2].map(i => <path key={`r${i}`} d={`M ${224 + i * 9} ${470 - i * 6} q 9 -2 11 -10 q -9 0 -11 10`}/>)}
          </g>
          <Destello x={62} y={86} s={.9} color={marcoClaro} retraso={0} animado={animado}/>
          <Destello x={288} y={150} s={.7} color={marcoClaro} retraso={1.1} animado={animado}/>
          <Destello x={300} y={330} s={.8} color={marcoClaro} retraso={2.2} animado={animado}/>
          <Destello x={44} y={300} s={.6} color={marcoClaro} retraso={3.1} animado={animado}/>
        </>
      )}
    </>
  )
}

export const ESTILOS_ARTE = `
@keyframes gmcBrillo { 0% { transform: translateX(0) skewX(-18deg) } 22%, 100% { transform: translateX(640px) skewX(-18deg) } }
@keyframes gmcDestello { 0%, 100% { opacity: .15; transform: scale(.6) } 50% { opacity: 1; transform: scale(1) } }
@keyframes gmcPista { 0%, 55%, 100% { opacity: 0 } 25% { opacity: 1 } }
.gmc-brillo { animation: gmcBrillo 6.5s ease-in-out 1.2s infinite; }
.gmc-destello { animation: gmcDestello 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.gmc-pista { animation: gmcPista 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .gmc-brillo, .gmc-destello, .gmc-pista { animation: none !important } .gmc-brillo, .gmc-pista { opacity: 0 } }
`
