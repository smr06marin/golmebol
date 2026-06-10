export default function ShieldSlot({ items, activeIndex, label, onPrev, onNext, onShieldClick }) {
    const item = items[activeIndex]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', flex: 1, justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '.4rem', letterSpacing: '.24em', color: 'rgba(255,255,255,.62)', marginBottom: '1px' }}>{label}</span>
        {/* Escudo */}
        <div onClick={onShieldClick}
          style={{ width: 'clamp(56px,15.5vw,70px)', height: 'clamp(56px,15.5vw,70px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', filter: 'drop-shadow(0 5px 14px rgba(0,0,0,.62))', animation: 'sflt 4.2s ease-in-out infinite', flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: item?.svg || '' }}
        />
        {/* Controles */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          <button onClick={onPrev} style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', cursor: 'pointer', fontSize: '.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {items.map((_, i) => (
              <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: i === activeIndex ? '#fff' : 'rgba(255,255,255,.3)', boxShadow: i === activeIndex ? '0 0 5px rgba(255,255,255,.7)' : 'none', transition: '.18s' }} />
            ))}
          </div>
          <button onClick={onNext} style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', cursor: 'pointer', fontSize: '.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
      </div>
    )
  }