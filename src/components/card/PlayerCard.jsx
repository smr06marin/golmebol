import { useState } from 'react'
import CardBackground from './CardBackground'
import CardEffects from './designs/CardEffects'
import CardDecorations from './designs/CardDecorations'
import { CARD_DESIGNS } from './designs/cardDesigns'

const CARD_PATH = "M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z"

const TORNEOS = [
  { id: 't1', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g1" cx="48%" cy="36%" r="56%"><stop offset="0%" stop-color="#ff99cc" stop-opacity=".74"/><stop offset="100%" stop-color="#260010" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g1)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#ff66aa" stroke-width="2"/><text x="35" y="27.5" text-anchor="middle" fill="#fff" font-size="8" font-family="Impact">GOLM</text><text x="35" y="37.5" text-anchor="middle" fill="rgba(255,222,238,.92)" font-size="7" font-family="Impact">BCN</text><text x="35" y="46.5" text-anchor="middle" fill="rgba(255,200,225,.6)" font-size="4.5" font-family="Impact">T1 · 2025</text></svg>` },
  { id: 't2', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g2" cx="48%" cy="36%" r="56%"><stop offset="0%" stop-color="#44cc66" stop-opacity=".72"/><stop offset="100%" stop-color="#001408" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g2)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#33bb55" stroke-width="2"/><text x="35" y="37" text-anchor="middle" fill="#fff" font-size="10.5" font-family="Impact">NB</text><text x="35" y="47" text-anchor="middle" fill="rgba(180,255,200,.7)" font-size="4.5" font-family="Impact">BCN · Q</text></svg>` }
]

const EQUIPOS = [
  { id: 'e1', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g3" cx="48%" cy="34%" r="56%"><stop offset="0%" stop-color="#ff3366" stop-opacity=".68"/><stop offset="100%" stop-color="#140006" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g3)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#ee2255" stroke-width="2"/><text x="35" y="32" text-anchor="middle" fill="#fff" font-size="8" font-family="Impact">ACR</text><text x="35" y="42.5" text-anchor="middle" fill="rgba(255,195,210,.72)" font-size="4.5" font-family="Impact">ARMENIA</text></svg>` },
  { id: 'e2', svg: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g4" cx="48%" cy="34%" r="56%"><stop offset="0%" stop-color="#2266ff" stop-opacity=".68"/><stop offset="100%" stop-color="#000616" stop-opacity=".96"/></radialGradient></defs><circle cx="35" cy="35" r="33" fill="url(#g4)"/><circle cx="35" cy="35" r="33" fill="none" stroke="#1155ee" stroke-width="2"/><text x="35" y="38" text-anchor="middle" fill="#fff" font-size="11.5" font-family="Impact">NB</text></svg>` }
]

const STATS_DEFAULT = {
  pj: 12, golesContra: 28, promedio: 2.3,
  eficacia: 76, pg: 9, pe: 1, pp: 2
}

function getBorderStyle(design) {
  if (design.borde === 'gradiente_fuego') return 'url(#brdFuego)'
  if (design.borde === 'gradiente_galaxia') return 'url(#brdGalaxia)'
  if (design.borde === 'gradiente_diamante') return 'url(#brdDiamante)'
  if (design.borde === 'gradiente_arcoiris') return 'url(#brdArcoiris)'
  if (design.borde === 'gradiente_negro_oro') return 'url(#brdNegroOro)'
  return design.borde || '#00ddd0'
}

export default function PlayerCard({
  playerName = 'JHONATAN',
  stats = STATS_DEFAULT,
  cardType = 'normal_teal',
  onStatClick
}) {
  const [tI, setTI] = useState(0)
  const [eI, setEI] = useState(0)
  const [photoUrl, setPhotoUrl] = useState(null)

  const design = CARD_DESIGNS.find(d => d.id === cardType) || CARD_DESIGNS[0]
  const fondo = design.fondo || ['#00e8d8', '#1558e2', '#110450']
  const color = design.color || '#00ddd0'
  const color2 = design.colorSecundario || color
  const color3 = design.colorTerciario || color2
  const borde = getBorderStyle(design)

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPhotoUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  const gradienteFondo = `linear-gradient(168deg, ${fondo[0]} 0%, ${fondo[1] || fondo[0]} 35%, ${fondo[2] || fondo[1]} 70%, ${fondo[3] || fondo[2]} 100%)`

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '345px',
      margin: '0 auto',
      filter: `drop-shadow(0 10px 40px rgba(0,0,0,.78)) drop-shadow(0 0 14px ${color}40) drop-shadow(0 0 2px ${color}cc)`
    }}>
      <div style={{ position: 'relative', width: '100%', paddingBottom: '145%' }}>

        {/* SVG borde + clipPath */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          viewBox="0 0 340 492" fill="none"
        >
          <defs>
            <linearGradient id="brdFuego" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4400"/>
              <stop offset="50%" stopColor="#ff8800"/>
              <stop offset="100%" stopColor="#ffcc00"/>
            </linearGradient>
            <linearGradient id="brdGalaxia" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0a003c"/>
              <stop offset="50%" stopColor="#6432ff"/>
              <stop offset="100%" stopColor="#ff00c8"/>
            </linearGradient>
            <linearGradient id="brdDiamante" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a0d8ff"/>
              <stop offset="50%" stopColor="#ffffff"/>
              <stop offset="100%" stopColor="#a0d8ff"/>
            </linearGradient>
            <linearGradient id="brdArcoiris" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff0064"/>
              <stop offset="25%" stopColor="#ff8800"/>
              <stop offset="50%" stopColor="#00ff96"/>
              <stop offset="75%" stopColor="#0064ff"/>
              <stop offset="100%" stopColor="#ff00c8"/>
            </linearGradient>
            <linearGradient id="brdNegroOro" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd700"/>
              <stop offset="50%" stopColor="#ff8800"/>
              <stop offset="100%" stopColor="#ffd700"/>
            </linearGradient>
            <clipPath id="activeCardClip" clipPathUnits="objectBoundingBox" transform="scale(0.002941,0.002033)">
              <path d={CARD_PATH}/>
            </clipPath>
          </defs>

          {/* Borde exterior */}
          <path d={CARD_PATH} fill="none" stroke={borde} strokeWidth="3.5"/>
          {/* Borde interior */}
          <path d="M 23 4 L 121 4 L 134 13 L 153 5.5 L 170 4 L 187 5.5 L 206 13 L 217 4 L 317 4 Q 333 4 335 20 L 335 379 Q 335 417 302 442 Q 276 459 242 469 Q 217 477 170 478 Q 123 477 98 469 Q 64 459 38 442 Q 5 417 5 379 L 5 20 Q 7 4 23 4 Z"
            fill="none" stroke={`${color}28`} strokeWidth="1"/>
          <line x1="170" y1="0" x2="170" y2="29" stroke={`${color}aa`} strokeWidth="1.5"/>
          <line x1="134" y1="10" x2="134" y2="27" stroke={`${color}77`} strokeWidth="1"/>
          <line x1="206" y1="10" x2="206" y2="27" stroke={`${color}77`} strokeWidth="1"/>
          <path d="M 96 476 Q 133 490 170 492 Q 207 490 244 476" fill="none" stroke={`${color}44`} strokeWidth="1.2"/>
        </svg>

        {/* Decoraciones exteriores */}
        <CardDecorations
          decoracion={design.decoracion}
          color={color}
          colorSecundario={color2}
          colorTerciario={color3}
        />

        {/* Contenido recortado */}
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: 'url(#activeCardClip)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Fondo del diseño */}
          <div style={{ position: 'absolute', inset: 0, background: gradienteFondo, zIndex: 0 }} />

          {/* Efectos internos */}
          <CardEffects efectos={design.efectos} color={color} />

        {/* Foto de fondo */}
{photoUrl && (
  <>
    <img src={photoUrl} style={{
      position: 'absolute', top: 0, left: 0,
      width: '100%', height: '100%',
      objectFit: 'cover', objectPosition: 'top center',
      zIndex: 2, pointerEvents: 'none',
      opacity: 0.55,
    }} alt="jugador" />
    {/* Overlay con color del diseño */}
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: '100%', height: '100%',
      zIndex: 3, pointerEvents: 'none',
      background: `linear-gradient(168deg, ${fondo[0]}99 0%, ${fondo[1] || fondo[0]}88 35%, ${fondo[2] || fondo[1]}77 70%, ${fondo[3] || fondo[2]}99 100%)`,
      mixBlendMode: 'multiply',
    }} />
    {/* Brillo del color encima */}
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: '100%', height: '100%',
      zIndex: 4, pointerEvents: 'none',
      background: `radial-gradient(ellipse 80% 60% at 50% 20%, ${color}33 0%, transparent 70%)`,
    }} />
  </>
)}
          {/* PJ arriba */}
          <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, padding: '6% 6% 0 6%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div onClick={() => onStatClick?.('pj')} style={{ cursor: 'pointer', lineHeight: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem,13vw,4.2rem)', lineHeight: '.86', color: '#fff', animation: 'pjp 3.5s ease-in-out infinite' }}>
                {stats.pj}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '.62rem', letterSpacing: '.28em', color: `${color}cc`, marginTop: '2px' }}>PJ</div>
            </div>
            {photoUrl && (
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '.3rem', color: `${color}99`, border: `1px dashed ${color}55`, padding: '3px 6px', borderRadius: '3px', cursor: 'pointer', background: 'rgba(0,0,0,.5)', marginTop: '4px' }}>
                ✎
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </label>
            )}
          </div>

          {/* Zona media */}
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* Panel izquierdo escudos */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: '36%', zIndex: 12,
              display: 'flex', flexDirection: 'column',
              padding: '4% 0 2% 6%', gap: '5px'
            }}>
              {/* Torneo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '.34rem', letterSpacing: '.18em', color: `${color}99` }}>TORNEO</span>
                <div onClick={() => onStatClick?.(TORNEOS[tI].id)}
                  style={{ width: '62px', height: '62px', cursor: 'pointer', animation: 'sflt 4.2s ease-in-out infinite', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.6))' }}
                  dangerouslySetInnerHTML={{ __html: TORNEOS[tI].svg }}
                />
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  <button onClick={() => setTI(i => (i - 1 + TORNEOS.length) % TORNEOS.length)}
                    style={{ width: '15px', height: '15px', borderRadius: '3px', background: 'rgba(0,0,0,.6)', border: `1px solid ${color}66`, color: '#fff', cursor: 'pointer', fontSize: '.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {TORNEOS.map((_, i) => (
                      <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: i === tI ? color : 'rgba(255,255,255,.3)' }} />
                    ))}
                  </div>
                  <button onClick={() => setTI(i => (i + 1) % TORNEOS.length)}
                    style={{ width: '15px', height: '15px', borderRadius: '3px', background: 'rgba(0,0,0,.6)', border: `1px solid ${color}66`, color: '#fff', cursor: 'pointer', fontSize: '.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </div>
              </div>

              <div style={{ height: '1px', background: `linear-gradient(90deg,rgba(255,255,255,.06),${color}44,rgba(255,255,255,.06))`, marginRight: '6px' }} />

              {/* Equipo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '.34rem', letterSpacing: '.18em', color: `${color}99` }}>EQUIPO</span>
                <div onClick={() => onStatClick?.(EQUIPOS[eI].id)}
                  style={{ width: '62px', height: '62px', cursor: 'pointer', animation: 'sflt 4.2s ease-in-out infinite', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.6))' }}
                  dangerouslySetInnerHTML={{ __html: EQUIPOS[eI].svg }}
                />
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  <button onClick={() => setEI(i => (i - 1 + EQUIPOS.length) % EQUIPOS.length)}
                    style={{ width: '15px', height: '15px', borderRadius: '3px', background: 'rgba(0,0,0,.6)', border: `1px solid ${color}66`, color: '#fff', cursor: 'pointer', fontSize: '.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {EQUIPOS.map((_, i) => (
                      <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: i === eI ? color : 'rgba(255,255,255,.3)' }} />
                    ))}
                  </div>
                  <button onClick={() => setEI(i => (i + 1) % EQUIPOS.length)}
                    style={{ width: '15px', height: '15px', borderRadius: '3px', background: 'rgba(0,0,0,.6)', border: `1px solid ${color}66`, color: '#fff', cursor: 'pointer', fontSize: '.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </div>
              </div>
            </div>

            {/* Muñeco por defecto */}
            {!photoUrl && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
                <svg viewBox="0 0 228 314" fill="none" style={{ width: '100%', height: '100%' }}>
                  <ellipse cx="114" cy="310" rx="70" ry="9" fill="rgba(0,0,0,.48)"/>
                  <path d="M78 292 Q74 303 70 307 Q66 311 83 311 Q100 311 101 303 Q101 292 93 290Z" fill="rgba(11,11,28,.96)"/>
                  <path d="M122 292 Q120 303 118 307 Q114 311 131 311 Q148 311 149 303 Q149 292 141 290Z" fill="rgba(11,11,28,.96)"/>
                  <rect x="77" y="257" width="22" height="37" rx="8" fill="rgba(16,16,46,.9)"/>
                  <rect x="119" y="257" width="22" height="37" rx="8" fill="rgba(16,16,46,.9)"/>
                  <path d="M75 199 Q80 244 93 252 Q113 262 133 252 Q146 244 151 199Z" fill="rgba(18,18,55,.94)"/>
                  <path d="M68 113 Q62 146 62 173 L62 203 L164 203 L164 173 Q164 146 158 113 Q142 100 113 98 Q84 100 68 113Z" fill="rgba(178,48,128,.52)"/>
                  <text x="113" y="173" textAnchor="middle" fill="rgba(255,255,255,.52)" fontSize="26" fontFamily="Impact">1</text>
                  <path d="M68 116 Q50 130 32 152 Q22 165 26 176 Q30 185 42 180 L60 163 L70 148Z" fill="rgba(178,48,128,.52)"/>
                  <circle cx="20" cy="178" r="25" fill="rgba(202,188,160,.26)" stroke="rgba(255,255,255,.44)" strokeWidth="2"/>
                  <rect x="106" y="86" width="17" height="16" rx="7" fill="rgba(185,146,108,.42)"/>
                  <ellipse cx="113" cy="62" rx="30" ry="32" fill="rgba(185,146,108,.46)"/>
                  <ellipse cx="113" cy="37" rx="28" ry="17" fill="rgba(16,11,5,.85)"/>
                  <path d="M85 46 Q89 24 113 20 Q137 24 141 46" fill="rgba(16,11,5,.8)"/>
                </svg>
              </div>
            )}

            {/* Degradado abajo */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36%', zIndex: 4, background: `linear-gradient(0deg,rgba(10,2,42,.99) 0%,rgba(10,2,42,.68) 48%,transparent 100%)`, pointerEvents: 'none' }} />

            {/* Botón subir foto */}
            {!photoUrl && (
              <div style={{ position: 'absolute', bottom: '42%', left: '30%', right: 0, zIndex: 8, display: 'flex', justifyContent: 'center' }}>
                <label style={{ fontFamily: 'var(--font-display)', fontSize: '.36rem', letterSpacing: '.12em', color: `${color}77`, border: `1px dashed ${color}44`, padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', background: 'rgba(0,0,0,.3)' }}>
                  + SUBIR FOTO
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                </label>
              </div>
            )}
          </div>

          {/* Nombre */}
          <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, textAlign: 'center', padding: '1.3% 4% .5%', background: 'linear-gradient(0deg,rgba(10,2,44,.98) 0%,rgba(10,2,44,.84) 46%,transparent 100%)' }}>
            <div style={{ height: '1.5px', width: '82%', margin: '0 auto 4px', background: `linear-gradient(90deg,transparent,${color}bb,transparent)` }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,10vw,2.8rem)', letterSpacing: '.1em', color: '#fff', lineHeight: 1, textShadow: `0 2px 14px rgba(0,0,0,.98),0 0 28px ${color}44` }}>
              {playerName}
            </div>
          </div>

          {/* Stats */}
          <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, padding: '1.5% 5% 1%', background: 'rgba(4,1,22,.92)', borderTop: `1.5px solid ${color}44` }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: 'GOL-CON', value: stats.golesContra, key: 'gc', dot: true },
                  { label: 'PROMEDI', value: stats.promedio, key: 'prom', dot: true },
                  { label: 'EFICACIA', value: stats.eficacia, key: 'efic' },
                ].map(({ label, value, key, dot }) => (
                  <div key={key} onClick={() => onStatClick?.(key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.5px 4px', cursor: 'pointer', borderRadius: '3px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '.58rem', letterSpacing: '.1em', color: 'rgba(255,255,255,.74)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#fff' }}>
                      {dot && <span style={{ fontSize: '.3rem', color: color, marginRight: '2px', verticalAlign: 'middle' }}>●</span>}
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ width: '1.5px', height: '50px', margin: '0 3%', background: `linear-gradient(180deg,transparent,${color}99,transparent)`, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: 'P.G', value: stats.pg, key: 'pg' },
                  { label: 'P.E', value: stats.pe, key: 'pe' },
                  { label: 'P.P', value: stats.pp, key: 'pp' },
                ].map(({ label, value, key }) => (
                  <div key={key} onClick={() => onStatClick?.(key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.5px 4px', cursor: 'pointer', borderRadius: '3px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#fff' }}>{value}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '.58rem', letterSpacing: '.1em', color: 'rgba(255,255,255,.74)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ribbon */}
          <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, textAlign: 'center', padding: '.7% 4% .55%', background: 'rgba(2,0,14,.88)', borderTop: `1px solid ${color}33` }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '.42rem', letterSpacing: '.16em', color: `${color}dd` }}>⬡ VALLA MENOS VENCIDA · T1 2025 ⬡</span>
          </div>

          {/* Emblem */}
          <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '.4% 0 .95%', background: 'rgba(2,0,14,.88)' }}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none" style={{ opacity: .5 }}>
              <path d="M14 3 L17 10 L25 10 L19 15 L21 22 L14 18 L7 22 L9 15 L3 10 L11 10 Z" stroke={color} strokeWidth="1.3" fill={`${color}11`}/>
            </svg>
          </div>

        </div>
      </div>
    </div>
  )
}