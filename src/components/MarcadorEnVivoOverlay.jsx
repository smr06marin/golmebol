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

const LADO = { display: 'flex', alignItems: 'center', gap: 'clamp(4px, 2.2vw, 12px)', minWidth: 0 }

// Cifras (marcador y cronómetro) en un trazo normal, sin negrilla, y de ancho
// fijo por dígito: en video comprimido (YouTube, celular) una cifra delgada y
// espaciada se lee mejor que una negrilla que se empasta.
const NUMEROS = { fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif', fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }

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
function EscudoConTarjetas({ logo_url, name, amarillas, rojas, size = 'clamp(25px, 7.2vw, 38px)' }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const hayTarjetas = (amarillas || 0) > 0 || (rojas || 0) > 0
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,.9)' }}>
        {logo_url
          ? <img src={logo_url} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/>
          : <span style={{ fontSize: 'clamp(.65rem, 2.8vw, .9rem)', fontWeight: 900, color: '#1a3a8a' }}>{iniciales}</span>}
      </div>
      {hayTarjetas && (
        <div style={{ position: 'absolute', bottom: -4, right: -6, display: 'flex', gap: '1px', background: '#000', borderRadius: '5px', padding: '1px 3px', lineHeight: 1, boxShadow: '0 0 0 1px rgba(255,255,255,.25)' }}>
          {amarillas > 0 && <span style={{ fontSize: '.6rem', fontWeight: 900 }}>🟨{amarillas}</span>}
          {rojas > 0 && <span style={{ fontSize: '.6rem', fontWeight: 900 }}>🟥{rojas}</span>}
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
      fontSize: 'clamp(.6rem, 3vw, 1.02rem)', letterSpacing: '.01em',
      // el nombre va SIEMPRE en el centro de su placa (el padding de cada lado compensa el corte en diagonal)
      padding: derecha ? '5px 12px 5px 17px' : '5px 17px 5px 12px',
      // hasta 2 lineas: en celular un nombre largo baja de renglon en vez de cortarse
      lineHeight: 1.08, textAlign: 'center', justifyContent: 'center', overflow: 'hidden', wordBreak: 'break-word',
      display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
      maxWidth: 'clamp(84px, 32vw, 210px)', flex: '1 1 auto', minWidth: 0,
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
      width: 'max-content', maxWidth: '96%', pointerEvents: 'none',
    }}>
      {/* ── Barra principal: equipo · escudo · marcador · escudo · equipo ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', columnGap: 'clamp(4px, 2.2vw, 12px)',
        background: 'rgba(6,6,8,.94)', borderRadius: '0 0 12px 12px', boxSizing: 'border-box',
        // sin margen negro antes del 1.er equipo ni despues del 2.o: las placas llegan hasta las puntas
        padding: 'clamp(4px, 1.4vw, 7px) 0', boxShadow: '0 3px 14px rgba(0,0,0,.5)', overflow: 'hidden',
      }}>
        {/* Las dos mitades miden SIEMPRE lo mismo (la del nombre más largo), así el marcador
            queda exactamente en el centro, igual que el cronómetro de abajo */}
        <div style={LADO}>
          <EtiquetaEquipo nombre={home?.name} color={col.colorLocal} lado="izquierda"/>
          <EscudoConTarjetas logo_url={home?.logo_url} name={home?.name} amarillas={det.amarillasLocal} rojas={det.rojasLocal}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 2.1vw, 9px)', flexShrink: 0, padding: '0 2px' }}>
          <span style={{ ...NUMEROS, fontSize: 'clamp(1.4rem, 7.2vw, 1.95rem)', color: '#fff', minWidth: '1ch', textAlign: 'center' }}>{vivo.golesLocal}</span>
          <span style={{ ...NUMEROS, fontSize: 'clamp(.9rem, 3.9vw, 1.2rem)', color: '#8b9097' }}>–</span>
          <span style={{ ...NUMEROS, fontSize: 'clamp(1.4rem, 7.2vw, 1.95rem)', color: '#fff', minWidth: '1ch', textAlign: 'center' }}>{vivo.golesVis}</span>
        </div>
        <div style={LADO}>
          <EscudoConTarjetas logo_url={away?.logo_url} name={away?.name} amarillas={det.amarillasVisitante} rojas={det.rojasVisitante}/>
          <EtiquetaEquipo nombre={away?.name} color={col.colorVisitante} lado="derecha"/>
        </div>
      </div>

      {/* ── Reloj del partido, en su propia píldora debajo, con acento rojo de "en vivo" ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', columnGap: '8px', background: 'rgba(6,6,8,.94)',
        borderRadius: '0 0 12px 12px', padding: '4px 14px 6px', marginTop: '-1px',
        borderBottom: `3px solid ${ROJO_VIVO}`, boxShadow: '0 3px 10px rgba(0,0,0,.45)', maxWidth: '100%',
      }}>
        {/* tres columnas: el cronómetro (o DESCANSO) queda SIEMPRE en el centro, el punto rojo a su izquierda y faltas/global a su derecha */}
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROJO_VIVO, justifySelf: 'end' }}/>
        <span style={vivo.descanso
          ? { fontSize: 'clamp(.78rem, 3.3vw, .98rem)', fontWeight: 700, color: '#fff', letterSpacing: '.06em', whiteSpace: 'nowrap' }
          : { ...NUMEROS, fontSize: 'clamp(.9rem, 3.8vw, 1.12rem)', color: '#fff', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
          {vivo.descanso ? 'DESCANSO' : vivo.reloj}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hayFaltas && (
            <span style={{ ...NUMEROS, fontSize: 'clamp(.75rem, 3vw, .9rem)', color: '#c9c9c9', whiteSpace: 'nowrap' }}>
              F {det.faltasLocal || 0}-{det.faltasVisitante || 0}
            </span>
          )}
          {global && (
            <span style={{ ...NUMEROS, fontSize: 'clamp(.75rem, 3vw, .9rem)', color: '#f5a623', whiteSpace: 'nowrap' }}>
              Global {global.local}-{global.visitante}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
