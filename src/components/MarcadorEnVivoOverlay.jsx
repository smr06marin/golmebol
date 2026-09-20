// Marcador en vivo que se muestra ENCIMA del video de transmisión de la
// portada (golmebol.com) — barra centrada en la parte superior, estilo
// transmisión profesional (tags angulados con el color de uniforme de cada
// equipo, escudo, marcador grande al centro y el reloj abajo en su propia
// píldora) — sin taparle nada del partido a quien esté viendo el video.
// Puede haber varias transmisiones a la vez (site_config.en_vivo_streams,
// por si hay varios partidos jugándose a la misma hora); cada una tiene su
// propio partido opcional, elegido por el admin desde /admin/config-sitio.
// Todo lo demás (goles, colores de uniforme, faltas, tarjetas) sale del
// mismo estado en vivo que ya sube la planilla del árbitro — ver
// src/lib/liveMatch.js.

const ROJO_VIVO = '#e5433d'

// El color de uniforme lo elige el árbitro con un selector libre (planilla
// completa) o de una paleta fija (planilla rápida) — en cualquier caso puede
// tocar un color claro (amarillo, blanco) o uno oscuro, así que el texto de
// la etiqueta necesita calcularse para que siempre se lea bien, en vez de
// asumir un solo color de texto fijo.
function textoContraste(hex) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return '#fff'
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminancia > 0.6 ? '#0c1116' : '#fff'
}

// Escudo con las tarjetas del equipo como insignia pequeña en la esquina —
// solo aparece si el equipo ya tiene alguna.
function EscudoConTarjetas({ logo_url, name, amarillas, rojas, size = 24 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const hayTarjetas = (amarillas || 0) > 0 || (rojas || 0) > 0
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,.9)' }}>
        {logo_url
          ? <img src={logo_url} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/>
          : <span style={{ fontSize: size * .38, fontWeight: 900, color: '#1a3a8a' }}>{iniciales}</span>}
      </div>
      {hayTarjetas && (
        <div style={{ position: 'absolute', bottom: -3, right: -4, display: 'flex', gap: '1px', background: '#000', borderRadius: '4px', padding: '1px 2px', lineHeight: 1, boxShadow: '0 0 0 1px rgba(255,255,255,.25)' }}>
          {amarillas > 0 && <span style={{ fontSize: '.4rem', fontWeight: 900 }}>🟨{amarillas}</span>}
          {rojas > 0 && <span style={{ fontSize: '.4rem', fontWeight: 900 }}>🟥{rojas}</span>}
        </div>
      )}
    </div>
  )
}

// Etiqueta angulada con el nombre del equipo, rellena con su color de
// uniforme — el mismo lenguaje visual de "tag" que usan las transmisiones
// profesionales para identificar equipos/jugadores.
function EtiquetaEquipo({ nombre, color, lado }) {
  const bg = color || '#33383d'
  const derecha = lado === 'derecha'
  return (
    <div style={{
      background: bg, color: textoContraste(color), fontWeight: 900,
      fontSize: 'clamp(.5rem, 2.6vw, .68rem)', letterSpacing: '.01em',
      padding: derecha ? '3px 8px 3px 14px' : '3px 14px 3px 8px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      maxWidth: 'clamp(52px, 22vw, 120px)', flexShrink: 1, minWidth: 0,
      clipPath: derecha ? 'polygon(12% 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
    }}>
      {nombre || '—'}
    </div>
  )
}

// `partido` viene con la misma forma que arma `partidosVivo` en LandingPage:
// { home, away: {name, logo_url}, vivo: {golesLocal, golesVis, reloj, descanso},
//   colores?: {colorLocal, colorVisitante}, detalle?: {faltasLocal, faltasVisitante, amarillas*, rojas*}, global? }
// Si no hay partido en vivo que mostrar, no renderiza nada.
export default function MarcadorEnVivoOverlay({ partido }) {
  if (!partido?.vivo) return null
  const { home, away, vivo, global } = partido
  const col = partido.colores || {}
  const det = partido.detalle || {}
  const hayFaltas = (det.faltasLocal || 0) > 0 || (det.faltasVisitante || 0) > 0

  return (
    <div style={{
      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: 'min(94%, 480px)', pointerEvents: 'none',
    }}>
      {/* ── Barra principal: equipo · escudo · marcador · escudo · equipo ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(4px, 1.6vw, 8px)',
        background: 'rgba(6,6,8,.94)', borderRadius: '0 0 10px 10px', width: '100%', boxSizing: 'border-box',
        padding: 'clamp(4px, 1.4vw, 7px) clamp(6px, 2vw, 10px)', boxShadow: '0 3px 14px rgba(0,0,0,.5)',
      }}>
        <EtiquetaEquipo nombre={home?.name} color={col.colorLocal} lado="izquierda"/>
        <EscudoConTarjetas logo_url={home?.logo_url} name={home?.name} amarillas={det.amarillasLocal} rojas={det.rojasLocal}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(3px, 1.4vw, 6px)', flexShrink: 0, padding: '0 2px' }}>
          <span style={{ fontWeight: 900, fontSize: 'clamp(.85rem, 4.5vw, 1.15rem)', color: '#fff', minWidth: '1ch', textAlign: 'center' }}>{vivo.golesLocal}</span>
          <span style={{ fontSize: 'clamp(.6rem, 2.6vw, .78rem)', fontWeight: 700, color: '#6b7076' }}>–</span>
          <span style={{ fontWeight: 900, fontSize: 'clamp(.85rem, 4.5vw, 1.15rem)', color: '#fff', minWidth: '1ch', textAlign: 'center' }}>{vivo.golesVis}</span>
        </div>
        <EscudoConTarjetas logo_url={away?.logo_url} name={away?.name} amarillas={det.amarillasVisitante} rojas={det.rojasVisitante}/>
        <EtiquetaEquipo nombre={away?.name} color={col.colorVisitante} lado="derecha"/>
      </div>

      {/* ── Reloj del partido, en su propia píldora debajo, con acento rojo de "en vivo" ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(6,6,8,.94)',
        borderRadius: '0 0 8px 8px', padding: '3px 12px 4px', marginTop: '-1px',
        borderBottom: `2px solid ${ROJO_VIVO}`, boxShadow: '0 3px 10px rgba(0,0,0,.45)', maxWidth: '100%',
      }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ROJO_VIVO, flexShrink: 0 }}/>
        <span style={{ fontSize: 'clamp(.52rem, 2.2vw, .65rem)', fontWeight: 900, color: '#fff', letterSpacing: '.02em', whiteSpace: 'nowrap' }}>
          {vivo.descanso ? 'DESCANSO' : vivo.reloj}
        </span>
        {hayFaltas && (
          <span style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 700, color: '#c9c9c9', whiteSpace: 'nowrap' }}>
            · F {det.faltasLocal || 0}-{det.faltasVisitante || 0}
          </span>
        )}
        {global && (
          <span style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 800, color: '#f5a623', whiteSpace: 'nowrap' }}>
            · Global {global.local}-{global.visitante}
          </span>
        )}
      </div>
    </div>
  )
}
