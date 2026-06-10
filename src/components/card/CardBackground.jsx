export default function CardBackground() {
    return (
      <>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `
            linear-gradient(142deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.07) 16%, rgba(0,215,205,.06) 26%, transparent 40%),
            repeating-linear-gradient(54deg, transparent 0, transparent 24px, rgba(255,255,255,.016) 24px, rgba(255,255,255,.016) 25px),
            repeating-linear-gradient(-54deg, transparent 0, transparent 24px, rgba(0,170,170,.013) 24px, rgba(0,170,170,.013) 25px),
            linear-gradient(168deg, #00e8d8 0%, #00cdce 4%, #009ecc 12%, #1558e2 26%, #2626c4 40%, #1a0eae 54%, #200c86 68%, #190866 82%, #110450 100%)
          `
        }} />
        {/* Reflejo cristal arriba izquierda */}
        <div style={{
          position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none',
          width: '62%', height: '56%',
          background: 'linear-gradient(148deg, rgba(0,235,215,.24) 0%, rgba(0,195,195,.1) 28%, transparent 55%)',
          clipPath: 'polygon(0 0, 100% 0, 55% 100%, 0 80%)'
        }} />
        {/* Reflejo cristal arriba derecha */}
        <div style={{
          position: 'absolute', top: 0, right: 0, zIndex: 1, pointerEvents: 'none',
          width: '40%', height: '38%',
          background: 'linear-gradient(220deg, rgba(0,180,210,.12) 0%, transparent 55%)',
          clipPath: 'polygon(100% 0, 100% 100%, 8% 0)'
        }} />
        {/* Líneas geométricas */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: `
            repeating-linear-gradient(-38deg, transparent 0, transparent 36px, rgba(255,255,255,.024) 36px, rgba(255,255,255,.024) 37px),
            repeating-linear-gradient(52deg, transparent 0, transparent 36px, rgba(0,180,170,.016) 36px, rgba(0,180,170,.016) 37px)
          `
        }} />
        {/* Texto marca de agua */}
        <div style={{ position: 'absolute', left: '1.5%', top: '7%', zIndex: 1, pointerEvents: 'none', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '.12em', color: 'rgba(255,255,255,.055)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', userSelect: 'none' }}>GOLMEBOL</div>
        <div style={{ position: 'absolute', right: '1.5%', top: '7%', zIndex: 1, pointerEvents: 'none', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '.12em', color: 'rgba(255,255,255,.055)', writingMode: 'vertical-rl', userSelect: 'none' }}>GOLMEBOL</div>
      </>
    )
  }