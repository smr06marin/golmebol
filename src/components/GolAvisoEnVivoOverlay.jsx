// Aviso de GOL para la transmisión en vivo: cuando el árbitro anota un gol en
// la planilla, aparece solo (unos 8 segundos) una tarjeta grande con el
// número de camiseta, el nombre del jugador, su equipo y el minuto — sin que
// nadie tenga que prenderlo desde el panel. Detecta el gol nuevo comparando
// la lista de goles del partido con la anterior; al abrir la página (o al
// cambiar de partido) NO muestra los goles que ya estaban. Si el árbitro
// borra un gol por error, simplemente deja de contarlo.
import { useEffect, useState } from 'react'
import { extraerGoles } from '../lib/liveMatch'

const DURACION_MS = 8000
const ROJO_VIVO = '#e5433d'

const claveGol = g => `${g.equipo}|${g.numero}|${g.jugador}|${g.periodo}|${g.minuto}`
const contar = goles => goles.reduce((acc, g) => { const k = claveGol(g); acc[k] = (acc[k] || 0) + 1; return acc }, {})
const mismas = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]) }

function textoContraste(hex) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return '#fff'
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0c1116' : '#fff'
}

// `bottom`: altura del aviso (se sube cuando la lista de goles o la nómina están prendidas)
export default function GolAvisoEnVivoOverlay({ partido, bottom = '14%' }) {
  const goles = partido ? extraerGoles(partido) : []
  const idPartido = partido?.id ?? null
  const claves = contar(goles)

  // Estado derivado "durante el render": se compara con la lista anterior del
  // MISMO partido y, si apareció un gol nuevo, se arma el aviso.
  const [previo, setPrevio] = useState({ id: idPartido, claves, n: 0 })
  const [aviso, setAviso] = useState(null)
  if (previo.id !== idPartido) {
    setPrevio({ id: idPartido, claves, n: previo.n })
    setAviso(null)
  } else if (!mismas(previo.claves, claves)) {
    const vistos = {}
    const nuevo = goles.find(g => { const k = claveGol(g); vistos[k] = (vistos[k] || 0) + 1; return vistos[k] > (previo.claves[k] || 0) })
    const n = previo.n + 1
    setPrevio({ id: idPartido, claves, n })
    if (nuevo) setAviso({ ...nuevo, n })
  }

  // Se apaga solo a los 8 segundos (un gol nuevo reinicia la cuenta)
  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), DURACION_MS)
    return () => clearTimeout(t)
  }, [aviso])

  if (!aviso || !partido) return null
  const local = aviso.equipo === 'local'
  const equipo = local ? partido.home : partido.away
  const color = (local ? partido.colores?.colorLocal : partido.colores?.colorVisitante) || '#1a73e8'

  return (
    <>
      <style>{`@keyframes gmGolEntra { 0% { opacity: 0; transform: translateY(36px) scale(.96); } 60% { opacity: 1; transform: translateY(-4px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      <div key={aviso.n} style={{ position: 'absolute', left: 0, right: 0, bottom, zIndex: 3, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{
          width: 'min(94%, 640px)', display: 'flex', alignItems: 'stretch', borderRadius: '14px', overflow: 'hidden',
          background: 'rgba(6,6,8,.96)', boxShadow: '0 8px 28px rgba(0,0,0,.65)', borderBottom: `4px solid ${ROJO_VIVO}`,
          animation: 'gmGolEntra .5s ease-out both',
        }}>
          {aviso.numero && (
            <div style={{
              background: color, color: textoContraste(color), display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 clamp(12px, 3.6vw, 22px)', minWidth: '1.7ch', fontWeight: 900, fontSize: 'clamp(1.8rem, 9vw, 3rem)', lineHeight: 1,
            }}>{aviso.numero}</div>
          )}
          <div style={{ flex: 1, minWidth: 0, padding: 'clamp(8px, 2.4vw, 14px) clamp(12px, 3.4vw, 20px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
              <span style={{ fontSize: 'clamp(.78rem, 3.2vw, 1.05rem)', fontWeight: 900, color: '#f5a623', letterSpacing: '.12em' }}>⚽ ¡GOL!</span>
              {aviso.minuto != null && <span style={{ fontSize: 'clamp(.78rem, 3.2vw, 1.05rem)', fontWeight: 800, color: '#fff' }}>{aviso.minuto}'</span>}
            </div>
            <div style={{ fontSize: 'clamp(1.1rem, 5.6vw, 1.9rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {aviso.jugador}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', minWidth: 0 }}>
              {equipo?.logo_url && (
                <span style={{ width: 'clamp(18px, 5vw, 26px)', height: 'clamp(18px, 5vw, 26px)', borderRadius: '50%', background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={equipo.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px', boxSizing: 'border-box' }}/>
                </span>
              )}
              <span style={{ fontSize: 'clamp(.8rem, 3.4vw, 1.05rem)', fontWeight: 700, color: '#c9c9c9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipo?.name || ''}</span>
              <span style={{ marginLeft: 'auto', fontSize: 'clamp(1rem, 4.4vw, 1.5rem)', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {partido.vivo?.golesLocal ?? 0} – {partido.vivo?.golesVis ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
