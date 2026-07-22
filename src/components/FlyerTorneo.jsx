import { useRef, useState } from 'react'
import { Shield, Trophy, Download, X, Ticket } from 'lucide-react'

const CENTER_TAM = 124 // diámetro del escudo del torneo, al centro
const HEADER_H   = 122 // alto del bloque de título arriba
const FOOTER_H   = 66  // alto del pie sin el badge de cupos
const FOOTER_CUPOS_H = 40 // alto extra si se muestra el badge de cupos

// Reparte los items (equipos + cupos libres) en aros concéntricos, calculando
// para cada aro cuántos caben sin que se toquen los escudos ni se encimen los
// nombres. Si no caben todos, agrega más aros hacia afuera (nunca aprieta).
function calcularAros(total) {
  if (total <= 0) return { aros: [], radioMax: CENTER_TAM / 2, tam: 0 }

  const tam = total <= 6 ? 92 : total <= 10 ? 78 : total <= 16 ? 64 : total <= 24 ? 52 : 44
  const espacioMin = tam + 42 // ancho que necesita cada escudo + su nombre para no chocar con el vecino

  const aros = []
  let restantes = total
  let radio = CENTER_TAM / 2 + 36 + tam / 2 // separación clara respecto al escudo del centro

  while (restantes > 0) {
    const capacidad = Math.max(3, Math.floor((2 * Math.PI * radio) / espacioMin))
    const n = Math.min(restantes, capacidad)
    aros.push({ radio, tam, n })
    restantes -= n
    radio += tam + 48 // separación entre un aro y el siguiente (deja espacio para las etiquetas)
  }

  const ultimo = aros[aros.length - 1]
  const radioMax = ultimo.radio + ultimo.tam / 2 + 24 // + espacio para que quepa el nombre debajo
  return { aros, radioMax, tam }
}

function posicion(i, n, radio, offset) {
  const angle = offset + (2 * Math.PI * i / n) - Math.PI / 2
  return { x: Math.cos(angle) * radio, y: Math.sin(angle) * radio }
}

function CrestBadge({ item, tam }) {
  if (item.tipo === 'cupo') {
    return (
      <div style={{ width: tam, height: tam, borderRadius: '50%', background: 'rgba(255,255,255,.10)', border: '3px dashed rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.35)', flexShrink: 0 }}>
        <span style={{ fontSize: tam * 0.4, fontWeight: '900', color: '#fff' }}>?</span>
      </div>
    )
  }
  return (
    <div style={{ width: tam, height: tam, borderRadius: '50%', background: '#fff', border: '3px solid #f9a825', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,.35)', flexShrink: 0 }}>
      {item.logo_url
        ? <img src={item.logo_url} crossOrigin="anonymous" style={{ width: '82%', height: '82%', objectFit: 'contain' }}/>
        : <Shield size={tam * 0.42} color="#1a3a8a"/>}
    </div>
  )
}

export default function FlyerTorneo({ torneo, equipos, onClose }) {
  const flyerRef = useRef(null)
  const [descargando, setDescargando] = useState(false)

  const cuposPermitidos = torneo?.equipos_permitidos || 0
  const cuposRestantes  = Math.max(0, cuposPermitidos - equipos.length)

  const [paso, setPaso] = useState(cuposRestantes > 0 ? 'preguntar' : 'flyer')
  const [mostrarCupos, setMostrarCupos] = useState(false)

  async function handleDescargar() {
    if (!flyerRef.current) return
    setDescargando(true)
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(flyerRef.current, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: null })
    const link = document.createElement('a')
    link.download = `torneo_${(torneo?.name || 'golmebol').replace(/\s+/g, '_')}_equipos.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setDescargando(false)
  }

  // ── Paso 1: preguntar si mostrar cupos libres ──
  if (paso === 'preguntar') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}><Ticket size={38} color="#f9a825" style={{ display: 'inline-block' }}/></div>
          <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '8px' }}>¿Mostrar cupos libres en el flyer?</div>
          <div style={{ color: '#5f6368', fontSize: '.85rem', marginBottom: '22px', lineHeight: 1.5 }}>
            Quedan <strong>{cuposRestantes}</strong> cupo{cuposRestantes !== 1 ? 's' : ''} disponible{cuposRestantes !== 1 ? 's' : ''} en este torneo ({equipos.length}/{cuposPermitidos} equipos confirmados). Puedes marcarlos en el flyer para invitar a más equipos a inscribirse.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => { setMostrarCupos(true); setPaso('flyer') }}
              style={{ padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: '700', fontSize: '.88rem' }}>
              Sí, mostrar cupos libres
            </button>
            <button onClick={() => { setMostrarCupos(false); setPaso('flyer') }}
              style={{ padding: '12px', background: '#f1f3f4', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontWeight: '600', fontSize: '.88rem' }}>
              No, solo equipos confirmados
            </button>
            <button onClick={onClose}
              style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '.8rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Paso 2: vista previa + descarga ──
  const items = [
    ...equipos.map(e => ({ tipo: 'equipo', id: e.id, name: e.name, logo_url: e.logo_url })),
    ...(mostrarCupos ? Array.from({ length: cuposRestantes }, (_, i) => ({ tipo: 'cupo', id: `cupo-${i}` })) : []),
  ]
  const { aros, radioMax } = calcularAros(items.length)
  let cursor = 0

  const circleSize  = radioMax * 2
  const footerH     = FOOTER_H + (mostrarCupos && cuposRestantes > 0 ? FOOTER_CUPOS_H : 0)
  const flyerHeight = HEADER_H + circleSize + footerH
  const flyerWidth  = Math.max(460, circleSize + 60)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: `${flyerWidth + 48}px`, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>

        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Vista previa del flyer</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {cuposRestantes > 0 && (
              <button onClick={() => setPaso('preguntar')}
                style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#5f6368', fontSize: '.78rem', fontWeight: '500' }}>
                ← Cambiar cupos
              </button>
            )}
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
          width: `${flyerWidth}px`,
          height: `${flyerHeight}px`,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Arial Black', 'Impact', sans-serif",
          background: 'radial-gradient(circle at 50% 28%, #1a3a8a 0%, #0c1c4a 55%, #06102c 100%)',
          margin: '0 auto',
        }}>
          {/* Header */}
          <div style={{ position: 'absolute', top: '18px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ display: 'inline-block', background: '#d93025', padding: '5px 18px', borderRadius: '4px' }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '900', letterSpacing: '2px' }}>GOLMEBOL</span>
            </div>
            <div style={{ marginTop: '10px', color: '#fff', fontSize: '19px', fontWeight: '900', letterSpacing: '.5px', textTransform: 'uppercase', padding: '0 30px', lineHeight: 1.25, textShadow: '0 2px 6px rgba(0,0,0,.5)' }}>
              {torneo?.name || 'Torneo'}
            </div>
            <div style={{ width: '120px', height: '4px', background: '#f9a825', margin: '8px auto 0', borderRadius: '2px' }}/>
          </div>

          {/* Área circular de escudos */}
          <div style={{ position: 'absolute', top: `${HEADER_H}px`, left: '50%', transform: 'translateX(-50%)', width: `${circleSize}px`, height: `${circleSize}px` }}>
            {/* Escudo del torneo, al centro */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 6 }}>
              <div style={{ width: `${CENTER_TAM}px`, height: `${CENTER_TAM}px`, borderRadius: '50%', background: '#fff', border: '5px solid #00ddd0', boxShadow: '0 0 28px rgba(0,221,208,.55), 0 6px 18px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {torneo?.logo_url
                  ? <img src={torneo.logo_url} crossOrigin="anonymous" style={{ width: '86%', height: '86%', objectFit: 'contain' }}/>
                  : <Trophy size={52} color="#1a3a8a"/>}
              </div>
            </div>

            {/* Escudos de equipos (y cupos libres) en aros */}
            {aros.map((aro, ai) => {
              const offset = ai % 2 === 0 ? 0 : Math.PI / aro.n
              const slice = items.slice(cursor, cursor + aro.n)
              cursor += aro.n
              return slice.map((item, i) => {
                const { x, y } = posicion(i, aro.n, aro.radio, offset)
                return (
                  <div key={item.id} style={{ position: 'absolute', top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: `${aro.tam + 36}px`, zIndex: 4 }}>
                    <CrestBadge item={item} tam={aro.tam}/>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: '#fff', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.2px', lineHeight: 1.2, textShadow: '0 1px 3px rgba(0,0,0,.8), 0 0 4px rgba(0,0,0,.6)' }}>
                      {item.tipo === 'cupo' ? 'CUPO LIBRE' : item.name}
                    </span>
                  </div>
                )
              })
            })}
          </div>

          {/* Footer */}
          <div style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            {mostrarCupos && cuposRestantes > 0 && (
              <div style={{ display: 'inline-block', background: 'rgba(249,168,37,.16)', border: '1.5px solid #f9a825', borderRadius: '20px', padding: '6px 16px', marginBottom: '8px' }}>
                <span style={{ color: '#f9a825', fontSize: '11px', fontWeight: '800', letterSpacing: '1px' }}>
                  🎟️ {cuposRestantes} CUPO{cuposRestantes !== 1 ? 'S' : ''} DISPONIBLE{cuposRestantes !== 1 ? 'S' : ''}
                </span>
              </div>
            )}
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' }}>GOLMEBOL · LA CASA DEL MICROFÚTBOL</div>
          </div>
        </div>
      </div>
    </div>
  )
}
