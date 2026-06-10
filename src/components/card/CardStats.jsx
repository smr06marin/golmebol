export default function CardStats({ stats, onStatClick }) {
    return (
      <div style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        padding: '1.6% 5.5% 1%',
        background: 'rgba(4,1,22,.92)',
        borderTop: '1.5px solid rgba(110,50,210,.52)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Columna izquierda */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'GOL-CON', value: stats.golesContra, key: 'gc', dot: true },
              { label: 'PROMEDI', value: stats.promedio, key: 'prom', dot: true },
              { label: 'EFICACIA', value: stats.eficacia, key: 'efic' },
            ].map(({ label, value, key, dot }) => (
              <div key={key} onClick={() => onStatClick(key)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.5px 4px', cursor: 'pointer', borderRadius: '3px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '.62rem', letterSpacing: '.13em', color: 'rgba(255,255,255,.74)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.12rem', color: '#fff' }}>
                  {dot && <span style={{ fontSize: '.36rem', color: '#4488ff', marginRight: '2px', verticalAlign: 'middle' }}>●</span>}
                  {value}
                </span>
              </div>
            ))}
          </div>
  
          {/* Divisor */}
          <div style={{ width: '1.5px', height: '54px', margin: '0 3%', background: 'linear-gradient(180deg, transparent, rgba(140,65,220,.62), transparent)', flexShrink: 0 }} />
  
          {/* Columna derecha */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'P.G', value: stats.pg, key: 'pg' },
              { label: 'P.E', value: stats.pe, key: 'pe' },
              { label: 'P.P', value: stats.pp, key: 'pp' },
            ].map(({ label, value, key }) => (
              <div key={key} onClick={() => onStatClick(key)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.5px 4px', cursor: 'pointer', borderRadius: '3px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.12rem', color: '#fff' }}>{value}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '.62rem', letterSpacing: '.13em', color: 'rgba(255,255,255,.74)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }