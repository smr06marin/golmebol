// ── Valla menos vencida GLOBAL por equipo ───────────────────────────────────
// Ranking de equipos por goles en contra (menos = mejor). El equipo líder se
// muestra en grande con las fotos y nombres de sus arqueros registrados.
//
// rows: [{ equipo: { id, name, logo_url }, gc, pj, arqueros: [{ name, foto }] }]

const TEAL = '#00ddd0'

function LogoEquipo({ logo, name, size = 40 }) {
  if (logo) return <img src={logo} alt={name || ''} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%', background: 'rgba(255,255,255,.08)', padding: '3px', flexShrink: 0 }}/>
  const ini = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 3).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aeb6c6', fontWeight: 800, fontSize: size * .3, flexShrink: 0 }}>{ini}</div>
  )
}

function Arquero({ a, grande }) {
  const size = grande ? 56 : 30
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: grande ? '84px' : '64px' }}>
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#16202e', border: `2px solid ${TEAL}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', boxShadow: grande ? `0 0 14px ${TEAL}44` : 'none' }}>
        {a.foto
          ? <img src={a.foto} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}/>
          : <svg viewBox="0 0 24 24" width={size * .62} height={size * .62} fill="#3d4659"><circle cx="12" cy="7.5" r="4.2"/><path d="M3.5 21.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z"/></svg>}
      </div>
      <div style={{ color: '#dfe6f2', fontSize: grande ? '.68rem' : '.6rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.15 }}>{a.name}</div>
    </div>
  )
}

export default function VallaEquipos({ rows, vacio = 'Sin datos aún' }) {
  if (!rows || rows.length === 0) return (
    <div style={{ background: 'linear-gradient(165deg,#151a28,#0c0f18)', border: '1px solid #232b3d', borderRadius: '14px', padding: '36px', textAlign: 'center', color: '#8b93a5', fontSize: '.85rem' }}>
      {vacio}
    </div>
  )

  const lider = rows[0]

  return (
    <div style={{ background: 'linear-gradient(165deg,#151a28,#0c0f18)', border: '1px solid #232b3d', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 3px 14px rgba(0,0,0,.3)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', color: TEAL, fontWeight: 800, fontSize: '.78rem', letterSpacing: '.14em', textTransform: 'uppercase' }}>
        🧤 Valla menos vencida · por equipo
      </div>

      {/* Equipo líder: en grande, con sus arqueros registrados */}
      <div style={{ padding: '16px', borderBottom: rows.length > 1 ? '1px solid rgba(255,255,255,.07)' : 'none', background: `linear-gradient(90deg, ${TEAL}0e, transparent 70%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: lider.arqueros?.length ? '14px' : 0 }}>
          <div style={{ background: TEAL, borderRadius: '8px', color: '#04211f', fontWeight: 900, fontSize: '.9rem', padding: '6px 10px', flexShrink: 0 }}>1°</div>
          <LogoEquipo logo={lider.equipo.logo_url} name={lider.equipo.name} size={46}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lider.equipo.name}</div>
            <div style={{ color: '#8b93a5', fontSize: '.68rem' }}>{lider.pj} PJ</div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ color: TEAL, fontWeight: 900, fontSize: '1.5rem', lineHeight: 1 }}>{lider.gc}</div>
            <div style={{ color: TEAL, fontWeight: 700, fontSize: '.55rem', letterSpacing: '.08em', opacity: .85 }}>GOLES EN CONTRA</div>
          </div>
        </div>
        {lider.arqueros?.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {lider.arqueros.map((a, i) => <Arquero key={i} a={a} grande/>)}
          </div>
        )}
      </div>

      {/* Resto de equipos: filas compactas */}
      {rows.slice(1).map((r, i) => (
        <div key={r.equipo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: i === rows.length - 2 ? 'none' : '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ width: '26px', flexShrink: 0, fontWeight: 800, fontSize: '.78rem', color: '#7d8598', textAlign: 'center' }}>{i + 2}°</div>
          <LogoEquipo logo={r.equipo.logo_url} name={r.equipo.name} size={26}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#e8ecf4', fontWeight: 700, fontSize: '.82rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.equipo.name}</div>
            <div style={{ color: '#8b93a5', fontSize: '.62rem' }}>{r.pj} PJ</div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ color: TEAL, fontWeight: 900, fontSize: '.92rem' }}>{r.gc}</span>
            <span style={{ color: TEAL, fontWeight: 700, fontSize: '.55rem', opacity: .8 }}>GC</span>
          </div>
        </div>
      ))}
    </div>
  )
}
