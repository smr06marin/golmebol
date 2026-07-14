import { useState } from 'react'

// ── Ranking estilo "poster" (como los flyers del torneo) ────────────────────
// Los primeros 3 se ven en franjas oscuras grandes: nombre en mayúsculas a la
// izquierda, la foto de la tarjeta del jugador al centro (si no tiene foto,
// aparece un muñeco) y el escudo del equipo a la derecha. Del 4° en adelante
// son filas compactas sin foto. Se muestran 10 y una flecha despliega el resto.
//
// rows: [{ id, nombre, foto, teamName, teamLogo, valor, sub }]
// statLabel: texto junto al valor ("goles", "GC", "prom.")
// statColor: color de acento del valor

function Muneco({ size = 44 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#3d4659" aria-label="Sin foto">
      <circle cx="12" cy="7.5" r="4.2"/>
      <path d="M3.5 21.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z"/>
    </svg>
  )
}

function LogoEquipo({ logo, name, size = 44 }) {
  if (logo) return <img src={logo} alt={name || ''} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%', background: 'rgba(255,255,255,.06)', padding: '3px' }}/>
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 3).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aeb6c6', fontWeight: 800, fontSize: size * .3 }}>
      {iniciales}
    </div>
  )
}

function FilaTop({ r, pos, statColor, statLabel }) {
  const medalla = pos === 1 ? '#ffd54a' : pos === 2 ? '#c9d1de' : '#d08a4e'
  const partes = (r.nombre || '').trim().split(/\s+/)
  const linea1 = partes[0] || ''
  const linea2 = partes.slice(1).join(' ')
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: '92px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'linear-gradient(90deg, rgba(255,255,255,.03), transparent 55%)' }}>
      {/* Posición + nombre */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px 0 16px' }}>
        <div style={{ fontSize: '.62rem', fontWeight: 900, color: medalla, letterSpacing: '.18em', marginBottom: '2px' }}>{pos}°</div>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.02rem', lineHeight: 1.08, textTransform: 'uppercase', letterSpacing: '.03em', overflow: 'hidden' }}>
          <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{linea1}</div>
          {linea2 && <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{linea2}</div>}
        </div>
        <div style={{ marginTop: '3px', display: 'flex', alignItems: 'baseline', gap: '5px' }}>
          <span style={{ color: statColor, fontWeight: 900, fontSize: '.95rem' }}>{r.valor}</span>
          {statLabel && <span style={{ color: statColor, fontWeight: 700, fontSize: '.62rem', letterSpacing: '.08em', textTransform: 'uppercase', opacity: .85 }}>{statLabel}</span>}
          {r.sub && <span style={{ color: '#8b93a5', fontSize: '.62rem', marginLeft: '3px' }}>{r.sub}</span>}
        </div>
      </div>
      {/* Foto de la tarjeta (o muñeco si no tiene) */}
      <div style={{ width: '104px', flexShrink: 0, background: '#1a2030', overflow: 'hidden', display: 'flex', alignItems: r.foto ? 'stretch' : 'flex-end', justifyContent: 'center' }}>
        {r.foto
          ? <img src={r.foto} alt={r.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}/>
          : <Muneco size={62}/>}
      </div>
      {/* Escudo del equipo */}
      <div style={{ width: '92px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LogoEquipo logo={r.teamLogo} name={r.teamName} size={48}/>
      </div>
    </div>
  )
}

function FilaCompacta({ r, pos, statColor, statLabel, ultima }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: ultima ? 'none' : '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ width: '26px', flexShrink: 0, fontWeight: 800, fontSize: '.78rem', color: '#7d8598', textAlign: 'center' }}>{pos}°</div>
      <div style={{ flexShrink: 0 }}><LogoEquipo logo={r.teamLogo} name={r.teamName} size={24}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#e8ecf4', fontWeight: 700, fontSize: '.82rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
        {r.sub && <div style={{ color: '#8b93a5', fontSize: '.62rem' }}>{r.sub}</div>}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ color: statColor, fontWeight: 900, fontSize: '.92rem' }}>{r.valor}</span>
        {statLabel && <span style={{ color: statColor, fontWeight: 700, fontSize: '.58rem', textTransform: 'uppercase', opacity: .8 }}>{statLabel}</span>}
      </div>
    </div>
  )
}

export default function RankingPoster({ titulo, rows, statLabel, statColor = '#ffd54a', vacio = 'Sin datos aún' }) {
  const [verTodos, setVerTodos] = useState(false)

  if (!rows || rows.length === 0) return (
    <div style={{ background: 'linear-gradient(165deg,#151a28,#0c0f18)', border: '1px solid #232b3d', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#8b93a5', fontSize: '.85rem' }}>
      {vacio}
    </div>
  )

  const visibles = verTodos ? rows : rows.slice(0, 10)
  const ocultas  = rows.length - 10

  return (
    <div style={{ background: 'linear-gradient(165deg,#151a28,#0c0f18)', border: '1px solid #232b3d', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 3px 14px rgba(0,0,0,.3)' }}>
      {titulo && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', color: '#fff', fontWeight: 800, fontSize: '.8rem', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {titulo}
        </div>
      )}
      {visibles.map((r, i) => i < 3
        ? <FilaTop key={r.id} r={r} pos={i + 1} statColor={statColor} statLabel={statLabel}/>
        : <FilaCompacta key={r.id} r={r} pos={i + 1} statColor={statColor} statLabel={statLabel} ultima={i === visibles.length - 1 && !(rows.length > 10)}/>
      )}
      {rows.length > 10 && (
        <button onClick={() => setVerTodos(v => !v)}
          style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: 'none', borderTop: '1px solid rgba(255,255,255,.08)', padding: '11px', cursor: 'pointer', color: '#aeb6c6', fontSize: '.75rem', fontWeight: 700, letterSpacing: '.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          {verTodos ? <>▲ Ver menos</> : <>▼ Ver las {ocultas} posiciones restantes</>}
        </button>
      )}
    </div>
  )
}
