import { useEffect, useState } from 'react'
import { CARD_DESIGNS } from './designs/cardDesigns'

export default function SponsorSplash({ cardType, sponsor, cardColor, cardNombre, onDone }) {
  const [fase, setFase] = useState('sponsor') // sponsor → tarjeta → done

  useEffect(() => {
    // Fase 1: sponsor 1.8s
    const t1 = setTimeout(() => setFase('tarjeta'), 1800)
    // Fase 2: nombre tarjeta 1.2s
    const t2 = setTimeout(() => onDone(), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const color = cardColor || '#00ee55'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#07070e',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity .4s',
    }}>
      {/* Fase sponsor */}
      {fase === 'sponsor' && sponsor && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', animation: 'fadeIn .4s ease' }}>
          <div style={{ fontSize: '.65rem', fontWeight: '700', color: 'rgba(255,255,255,.3)', letterSpacing: '.2em', textTransform: 'uppercase' }}>
            Presentado por
          </div>
          {sponsor.logo_url ? (
            <img src={sponsor.logo_url} style={{ height: '80px', objectFit: 'contain', filter: 'brightness(1.1)' }}/>
          ) : (
            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#fff', letterSpacing: '.1em' }}>
              {sponsor.nombre?.toUpperCase()}
            </div>
          )}
          {sponsor.nombre && sponsor.logo_url && (
            <div style={{ fontSize: '.9rem', fontWeight: '700', color: 'rgba(255,255,255,.7)', letterSpacing: '.1em' }}>
              {sponsor.nombre.toUpperCase()}
            </div>
          )}
          {/* Barra de progreso */}
          <div style={{ width: '120px', height: '2px', background: 'rgba(255,255,255,.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: color, borderRadius: '2px', animation: 'progress 1.8s linear forwards' }}/>
          </div>
        </div>
      )}

      {/* Fase sin sponsor — solo loading */}
      {fase === 'sponsor' && !sponsor && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: color, letterSpacing: '.3em' }}>GOLMEBOL</div>
          <div style={{ width: '80px', height: '2px', background: 'rgba(255,255,255,.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: color, borderRadius: '2px', animation: 'progress 1.8s linear forwards' }}/>
          </div>
        </div>
      )}

      {/* Fase nombre tarjeta */}
      {fase === 'tarjeta' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', animation: 'fadeIn .3s ease' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `linear-gradient(135deg, ${color}, ${color}88)` }}/>
          </div>
          <div style={{ fontSize: '.65rem', color: 'rgba(255,255,255,.4)', letterSpacing: '.2em' }}>TU TARJETA</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color, letterSpacing: '.08em', textAlign: 'center' }}>
            {cardNombre?.toUpperCase() || 'EL DEBUT'}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes progress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  )
}
