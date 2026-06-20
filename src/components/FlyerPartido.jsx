import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { Shield, Download, X } from 'lucide-react'

export default function FlyerPartido({ partido, onClose }) {
  const flyerRef = useRef(null)
  const [descargando, setDescargando] = useState(false)

  async function handleDescargar() {
    if (!flyerRef.current) return
    setDescargando(true)
    const canvas = await html2canvas(flyerRef.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    })
    const link = document.createElement('a')
    link.download = `partido_${partido.home?.name}_vs_${partido.away?.name}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setDescargando(false)
  }

  const esJugado = partido.status === 'played'
  const fecha = partido.played_at
    ? new Date(partido.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const hora = partido.played_at
    ? new Date(partido.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Vista previa del flyer</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleDescargar} disabled={descargando}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: descargando ? .7 : 1 }}>
              <Download size={16}/> {descargando ? 'Generando...' : 'Descargar'}
            </button>
            <button onClick={onClose}
              style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* FLYER */}
        <div ref={flyerRef} style={{
          width: '400px',
          height: '700px',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Arial Black', 'Impact', sans-serif",
          background: '#F5C800',
          margin: '0 auto',
        }}>
          {/* Fondo azul central */}
          <div style={{ position: 'absolute', top: '60px', left: '20px', right: '20px', bottom: '60px', background: '#1a3a8a', borderRadius: '4px' }}/>

          {/* Rayones decorativos blancos */}
          <div style={{ position: 'absolute', bottom: '40px', left: '0', right: '0', height: '120px', opacity: .15 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ position: 'absolute', bottom: `${i * 12}px`, left: `-10px`, right: '-10px', height: '3px', background: '#fff', transform: `rotate(${-2 + i * 0.5}deg)` }}/>
            ))}
          </div>

          {/* Etiqueta GOLMEBOL arriba */}
          <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#d93025', padding: '6px 20px', borderRadius: '4px', zIndex: 10 }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900', letterSpacing: '2px' }}>GOLMEBOL</span>
          </div>

          {/* Título PROGRAMA / RESULTADO */}
          <div style={{ position: 'absolute', top: '65px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ color: '#F5C800', fontSize: '52px', fontWeight: '900', lineHeight: 1, letterSpacing: '-1px', textShadow: '3px 3px 0 rgba(0,0,0,.3)', textTransform: 'uppercase' }}>
              {esJugado ? 'RESULTADO' : 'PARTIDO'}
            </div>
            {/* Línea roja */}
            <div style={{ width: '200px', height: '5px', background: '#d93025', margin: '8px auto 0', borderRadius: '2px' }}/>
          </div>

          {/* Fecha y hora */}
          <div style={{ position: 'absolute', top: '175px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', letterSpacing: '1px', textTransform: 'capitalize' }}>{fecha}</div>
            {hora && <div style={{ color: '#F5C800', fontSize: '16px', fontWeight: '800', marginTop: '2px' }}>{hora}</div>}
          </div>

          {/* Equipos */}
          <div style={{ position: 'absolute', top: '230px', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 10, padding: '0 20px' }}>
            
            {/* Local */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fff', border: '4px solid #F5C800', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>
                {partido.home?.logo_url
                  ? <img src={partido.home.logo_url} style={{ width: '90%', height: '90%', objectFit: 'contain' }} crossOrigin="anonymous"/>
                  : <Shield size={36} color="#1a3a8a"/>
                }
              </div>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px', maxWidth: '110px', lineHeight: '1.2' }}>
                {partido.home?.name}
              </div>
            </div>

            {/* VS o Marcador */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {esJugado ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '72px', fontWeight: '900', color: '#F5C800', lineHeight: 1, textShadow: '2px 2px 0 rgba(0,0,0,.3)' }}>{partido.home_score}</span>
                  </div>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#fff', opacity: .7 }}>-</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '72px', fontWeight: '900', color: '#F5C800', lineHeight: 1, textShadow: '2px 2px 0 rgba(0,0,0,.3)' }}>{partido.away_score}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: '42px', fontWeight: '900', color: '#d93025', textShadow: '2px 2px 0 rgba(0,0,0,.2)', fontStyle: 'italic' }}>VS</span>
                </div>
              )}
            </div>

            {/* Visitante */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fff', border: '4px solid #F5C800', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>
                {partido.away?.logo_url
                  ? <img src={partido.away.logo_url} style={{ width: '90%', height: '90%', objectFit: 'contain' }} crossOrigin="anonymous"/>
                  : <Shield size={36} color="#1a3a8a"/>
                }
              </div>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px', maxWidth: '110px', lineHeight: '1.2' }}>
                {partido.away?.name}
              </div>
            </div>
          </div>

          {/* Cancha */}
          {partido.location && (
            <div style={{ position: 'absolute', bottom: '130px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600', background: 'rgba(255,255,255,.15)', borderRadius: '20px', padding: '4px 16px' }}>
                📍 {partido.location}
              </span>
            </div>
          )}

          {/* Jornada */}
          {partido.matchday && (
            <div style={{ position: 'absolute', bottom: '108px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
              <span style={{ color: '#F5C800', fontSize: '12px', fontWeight: '800', letterSpacing: '2px' }}>
                JORNADA {partido.matchday}
              </span>
            </div>
          )}

          {/* Nombre torneo abajo */}
          <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ color: '#1a3a8a', fontSize: '11px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {partido.tournaments?.name || 'GOLMEBOL'}
            </div>
          </div>

          {/* Pelota decorativa esquina */}
          <div style={{ position: 'absolute', top: '55px', right: '10px', fontSize: '50px', opacity: .25, zIndex: 5 }}>⚽</div>
          <div style={{ position: 'absolute', bottom: '55px', left: '8px', fontSize: '35px', opacity: .2, zIndex: 5 }}>⚽</div>
        </div>
      </div>
    </div>
  )
}
