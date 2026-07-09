import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/card/PlayerCard'
import { CARD_DESIGNS, NIVEL_COLORES, NIVEL_NOMBRES } from '../components/card/designs/cardDesigns'

// Fondo ambiental propio de Golmebol: sin fotos de stock, se adapta al color
// del nivel/diseño actual con degradés, viñeta y una textura fina tipo carbono.
function AmbientBackground({ color }) {
  return (
    <>
      {/* Base */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: 'radial-gradient(circle at 50% -8%, #12121e 0%, #07070e 55%, #050509 100%)' }} />

      {/* Glow de color según el diseño actual */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 70% 45% at 15% 6%, ${color}30 0%, transparent 62%),
          radial-gradient(ellipse 65% 42% at 88% 80%, ${color}24 0%, transparent 62%),
          radial-gradient(ellipse 90% 55% at 50% 102%, ${color}1c 0%, transparent 68%)
        `,
        transition: 'background .6s ease',
      }} />

      {/* Líneas de cancha muy sutiles */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: .05,
        backgroundImage: `
          repeating-linear-gradient(90deg, transparent 0, transparent 78px, ${color}aa 78px, ${color}aa 79px),
          repeating-linear-gradient(0deg, transparent 0, transparent 78px, ${color}aa 78px, ${color}aa 79px)
        `,
      }} />

      {/* Textura fina diagonal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: .04,
        backgroundImage: 'repeating-linear-gradient(118deg, #fff 0px, #fff 1px, transparent 1px, transparent 30px)',
      }} />

      {/* Viñeta */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 100% 68% at 50% 42%, transparent 42%, rgba(3,3,8,.65) 100%)' }} />
    </>
  )
}

function Particles({ color }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ''
    const cols = [color, '#ffffff', color, '#ffffff']
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('div')
      const s = Math.random() * 2.5 + 1
      d.style.cssText = `position:absolute;border-radius:50%;width:${s}px;height:${s}px;left:${Math.random()*100}%;bottom:0;background:${cols[i%4]};opacity:${.04+Math.random()*.06};animation:rise ${13+Math.random()*15}s linear ${Math.random()*15}s infinite`
      ref.current.appendChild(d)
    }
  }, [color])
  return <div ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }} />
}

export default function HomePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [cardIndex, setCardIndex] = useState(0)
  const [showSponsor, setShowSponsor] = useState(false)
  const [sponsors, setSponsors] = useState({})

  const currentDesign = CARD_DESIGNS[cardIndex]
  const nivelColor = NIVEL_COLORES[currentDesign.nivel]
  const sponsor = sponsors[currentDesign.id]

  // Cargar sponsors desde Supabase
  useEffect(() => {
    supabase.from('sponsors').select('*').then(({ data }) => {
      if (!data) return
      const map = {}
      data.forEach(s => { map[s.card_id] = s })
      setSponsors(map)
    })
  }, [])

  useEffect(() => {
    setShowSponsor(false)
    const s = sponsors[CARD_DESIGNS[cardIndex]?.id]
    if (!s) return
    const t1 = setTimeout(() => setShowSponsor(true), 100)
    const t2 = setTimeout(() => setShowSponsor(false), 4100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [cardIndex, sponsors])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function prevCard() {
    setCardIndex(i => (i - 1 + CARD_DESIGNS.length) % CARD_DESIGNS.length)
  }

  function nextCard() {
    setCardIndex(i => (i + 1) % CARD_DESIGNS.length)
  }

  const nivelLabel =
    currentDesign.id.includes('bronce') ? 'BRONCE' :
    currentDesign.id.includes('plata') ? 'PLATA' :
    currentDesign.id.includes('oro') && currentDesign.nivel === 1 ? 'ORO' :
    NIVEL_NOMBRES[currentDesign.nivel]

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 'var(--max-width)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Fondo ambiental (sin fotos de stock) */}
      <AmbientBackground color={currentDesign.color}/>

      {/* Marca de agua */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        overflow: 'hidden', pointerEvents: 'none',
        display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start',
        padding: '12px', gap: '0px',
      }}>
        {Array.from({ length: 120 }).map((_, i) => (
          <span key={i} style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            letterSpacing: '.25em',
            color: currentDesign.color,
            opacity: .12,
            padding: '8px 10px',
            whiteSpace: 'nowrap',
            transform: 'rotate(-25deg)',
            userSelect: 'none',
          }}>
            {nivelLabel}
          </span>
        ))}
      </div>

      <Particles color={currentDesign.color} />

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.8rem 1rem .35rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.55rem', letterSpacing: '.18em', background: 'linear-gradient(90deg,#00ddd0,#9955ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          GOLMEBOL
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <button onClick={() => navigate('/admin/sponsors')}
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', color: 'rgba(255,255,255,.5)', fontSize: '.45rem', fontFamily: 'var(--font-display)', letterSpacing: '.1em' }}>
            ⚙ ADMIN
          </button>
          <button onClick={() => navigate('/elegir-tarjeta')}
            style={{ background: `${currentDesign.color}11`, border: `1px solid ${currentDesign.color}44`, borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', color: currentDesign.color, fontSize: '.55rem', fontFamily: 'var(--font-display)', letterSpacing: '.1em', transition: 'all .3s' }}>
            🎴 TARJETA
          </button>
          <button onClick={handleLogout}
            style={{ background: 'rgba(0,210,200,.04)', border: '1px solid rgba(0,210,200,.22)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '.7rem' }}>
            ✕
          </button>
        </div>
      </header>

      {/* Info diseño */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', padding: '0 1rem .4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '.5rem', letterSpacing: '.15em', color: nivelColor }}>
            NIVEL {currentDesign.nivel} · {NIVEL_NOMBRES[currentDesign.nivel]}
          </span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '.9rem', letterSpacing: '.12em', color: '#fff' }}>
            {currentDesign.nombre}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '.7rem', color: 'rgba(255,255,255,.3)' }}>
          {cardIndex + 1} / {CARD_DESIGNS.length}
        </div>
      </div>

      {/* Tarjeta + sponsor */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', padding: '.15rem .7rem .8rem', display: 'flex', justifyContent: 'center' }}>

        {/* Pantalla patrocinador */}
        {showSponsor && sponsor && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 20, pointerEvents: 'none',
            animation: 'sponsorShow 4s ease forwards',
          }}>
            <div style={{
              background: 'rgba(0,0,0,.88)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: `1px solid ${currentDesign.color}55`,
              padding: '24px 40px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '8px',
              boxShadow: `0 0 40px ${currentDesign.color}33`,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                letterSpacing: '.2em',
                color: `${currentDesign.color}99`,
              }}>PATROCINADO POR</span>
              <span style={{
  fontFamily: 'var(--font-display)',
  fontSize: '1.5rem',
  letterSpacing: '.2em',
  color: `${currentDesign.color}66`,
  display: 'block',
  textAlign: 'center',
}}>CARGANDO TARJETA...</span>

              {sponsor.logo_url ? (
                <img src={sponsor.logo_url} alt={sponsor.nombre}
                style={{ maxWidth: '800px', maxHeight: '500px', objectFit: 'contain', filter: 'none' }}
                />
              ) : (
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.2rem',
                  letterSpacing: '.2em',
                  color: '#ffffff',
                  textShadow: `0 0 30px ${currentDesign.color}, 0 0 60px ${currentDesign.color}66`,
                }}>{sponsor.nombre}</span>
              )}

              <div style={{
                width: '40px', height: '1.5px',
                background: `linear-gradient(90deg, transparent, ${currentDesign.color}, transparent)`,
                marginTop: '4px',
              }}/>
            </div>
          </div>
        )}

        {/* Tarjeta */}
        <div
          key={cardIndex}
          style={{
            width: '100%',
            animation: sponsor
              ? `cardReveal .5s ease ${showSponsor ? '1.6s' : '0s'} forwards`
              : `${
                  currentDesign.premium ? 'entrancePremium .8s' :
                  currentDesign.nivel === 6 ? 'entranceLeyenda .6s' :
                  currentDesign.nivel === 5 ? 'entranceElite .5s' :
                  currentDesign.nivel === 4 ? 'entranceOro .5s' :
                  currentDesign.nivel === 3 ? 'entrancePlata .4s' :
                  currentDesign.nivel === 2 ? 'entranceBronce .45s' :
                  'entranceNormal .35s'
                } cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
            opacity: showSponsor && sponsor ? 0 : 1,
          }}
        >
          <PlayerCard
            playerName="JHONATAN"
            cardType={currentDesign.id}
          />
        </div>
      </div>

      {/* Navegación */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.8rem' }}>
        <button onClick={prevCard} style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: `${nivelColor}15`, border: `1px solid ${nivelColor}55`,
          color: nivelColor, fontSize: '1.4rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s',
        }}>‹</button>

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', maxWidth: '200px', justifyContent: 'center' }}>
          {CARD_DESIGNS.map((d, i) => (
            <div key={d.id} onClick={() => setCardIndex(i)}
              style={{
                width: i === cardIndex ? '10px' : '5px',
                height: i === cardIndex ? '10px' : '5px',
                borderRadius: '50%',
                background: i === cardIndex ? NIVEL_COLORES[d.nivel] : 'rgba(255,255,255,.2)',
                cursor: 'pointer', transition: 'all .2s', flexShrink: 0,
                boxShadow: i === cardIndex ? `0 0 8px ${NIVEL_COLORES[d.nivel]}` : 'none',
              }}
            />
          ))}
        </div>

        <button onClick={nextCard} style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: `${nivelColor}15`, border: `1px solid ${nivelColor}55`,
          color: nivelColor, fontSize: '1.4rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s',
        }}>›</button>
      </div>

      {/* Botones nivel */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', gap: '6px', marginBottom: '1.2rem', flexWrap: 'wrap', justifyContent: 'center', padding: '0 1rem' }}>
        {[1,2,3,4,5,6].map(nivel => {
          const primeraDelNivel = CARD_DESIGNS.findIndex(d => d.nivel === nivel)
          const activo = currentDesign.nivel === nivel
          return (
            <button key={nivel} onClick={() => setCardIndex(primeraDelNivel)}
              style={{
                padding: '4px 14px', borderRadius: '20px',
                border: `1px solid ${NIVEL_COLORES[nivel]}${activo ? 'cc' : '44'}`,
                background: activo ? `${NIVEL_COLORES[nivel]}22` : 'rgba(0,0,0,.3)',
                color: NIVEL_COLORES[nivel],
                fontFamily: 'var(--font-display)', fontSize: '.5rem',
                letterSpacing: '.12em', cursor: 'pointer', transition: 'all .2s',
                boxShadow: activo ? `0 0 12px ${NIVEL_COLORES[nivel]}44` : 'none',
              }}>
              {NIVEL_NOMBRES[nivel]}
            </button>
          )
        })}
      </div>

      <div style={{ height: '72px' }} />

      {/* Nav inferior */}
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 'var(--max-width)', background: 'rgba(3,1,12,.96)', backdropFilter: 'blur(16px)', borderTop: `1px solid ${currentDesign.color}22`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '.48rem 0', zIndex: 100, transition: 'border-color .3s' }}>
        {[
          { label: 'INICIO', active: true },
          { label: 'RANKING' },
          { label: 'TORNEOS' },
          { label: 'EQUIPOS' },
          { label: 'ESPECIALES' },
        ].map(({ label, active }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.1rem', cursor: 'pointer', opacity: active ? 1 : .34, padding: '.18rem .38rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '.36rem', letterSpacing: '.14em', color: active ? currentDesign.color : 'var(--color-primary)', transition: 'color .3s' }}>{label}</span>
            {active && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: currentDesign.color, boxShadow: `0 0 6px ${currentDesign.color}`, transition: 'background .3s' }} />}
          </div>
        ))}
      </nav>
    </div>
  )
}
