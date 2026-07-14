// ── Tabla de posiciones estilo "eliminatorias" ──────────────────────────────
// Fondo azul oscuro, cada equipo en una franja con su número en caja azul,
// escudo circular, nombre en blanco y los puntos resaltados en caja azul.
//
// rows: [{ equipo: { id, name, logo_url }, pj, pg, pe, pp, gf, gc, pts }]
// miEquipoId (opcional): resalta la fila de ese equipo
// titulo (opcional): encabezado dentro de la tarjeta

function LogoCircular({ logo, name, size = 30 }) {
  if (logo) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
      <img src={logo} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/>
    </div>
  )
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfe0ff', fontWeight: 800, fontSize: size * .34 }}>
      {iniciales}
    </div>
  )
}

const COLS = '30px minmax(0,1fr) 26px 26px 26px 26px 26px 26px 30px 38px'

export default function TablaPosiciones({ titulo, rows, miEquipoId, vacio = 'Sin resultados aún' }) {
  if (!rows || rows.length === 0) return (
    <div style={{ background: 'linear-gradient(170deg,#0e2258,#08122e)', border: '1px solid #1e3a7a', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#8fa5cf', fontSize: '.85rem' }}>
      {vacio}
    </div>
  )

  return (
    <div style={{ background: 'linear-gradient(170deg,#0e2258,#08122e)', border: '1px solid #1e3a7a', borderRadius: '14px', padding: '12px 10px 14px', boxShadow: '0 3px 14px rgba(0,0,0,.3)' }}>
      {titulo && (
        <div style={{ textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: '1rem', letterSpacing: '.12em', textTransform: 'uppercase', padding: '6px 0 12px' }}>
          {titulo}
        </div>
      )}
      {/* Encabezados */}
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '3px', alignItems: 'center', padding: '0 4px 7px' }}>
        <div/><div/>
        {['PJ','PG','PE','PP','GF','GC','+/-'].map(h => (
          <div key={h} style={{ textAlign: 'center', color: '#7fb3ff', fontWeight: 800, fontSize: '.6rem', letterSpacing: '.05em' }}>{h}</div>
        ))}
        <div style={{ textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: '.62rem', background: '#2e90fa', borderRadius: '5px', padding: '3px 0' }}>PTS</div>
      </div>
      {/* Filas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.map((row, i) => {
          const dif = (row.gf || 0) - (row.gc || 0)
          const esMio = miEquipoId && row.equipo.id === miEquipoId
          return (
            <div key={row.equipo.id}
              style={{ display: 'grid', gridTemplateColumns: COLS, gap: '3px', alignItems: 'center', padding: '7px 4px', borderRadius: '9px',
                background: esMio ? 'rgba(46,144,250,.22)' : 'rgba(255,255,255,.045)',
                border: esMio ? '1px solid #2e90fa' : '1px solid rgba(127,179,255,.16)' }}>
              {/* Posición */}
              <div style={{ background: '#2e90fa', borderRadius: '6px', color: '#fff', fontWeight: 900, fontSize: '.78rem', textAlign: 'center', padding: '5px 0' }}>{i + 1}</div>
              {/* Equipo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, paddingLeft: '2px' }}>
                <LogoCircular logo={row.equipo.logo_url} name={row.equipo.name}/>
                <span style={{ color: '#fff', fontWeight: esMio ? 800 : 700, fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.equipo.name}</span>
              </div>
              {/* Números */}
              {[row.pj, row.pg, row.pe, row.pp, row.gf, row.gc].map((v, j) => (
                <div key={j} style={{ textAlign: 'center', color: '#dbe6fa', fontWeight: 600, fontSize: '.75rem' }}>{v}</div>
              ))}
              <div style={{ textAlign: 'center', color: dif > 0 ? '#7ee2a8' : dif < 0 ? '#ff9d9d' : '#dbe6fa', fontWeight: 700, fontSize: '.72rem' }}>{dif > 0 ? `+${dif}` : dif}</div>
              {/* Puntos */}
              <div style={{ background: '#2e90fa', borderRadius: '6px', color: '#fff', fontWeight: 900, fontSize: '.85rem', textAlign: 'center', padding: '4px 0' }}>{row.pts}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
