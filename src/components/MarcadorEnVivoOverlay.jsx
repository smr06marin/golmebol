// Marcador en vivo que se muestra ENCIMA del video de transmisión de la
// portada (golmebol.com) — como el "score bug" chiquito de un canal
// deportivo, en la esquina superior izquierda, sin taparle nada del partido
// a quien esté viendo el video. Puede haber varias transmisiones a la vez
// (site_config.en_vivo_streams, por si hay varios partidos jugándose a la
// misma hora); cada una tiene su propio partido opcional, elegido por el
// admin desde /admin/config-sitio. Todo lo demás (goles, colores de
// uniforme, faltas, tarjetas) sale del mismo estado en vivo que ya sube la
// planilla del árbitro — ver src/lib/liveMatch.js.

function EscudoChico({ logo_url, name, size = 18 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: size * .3, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '1px' }}/>
        : <span style={{ fontSize: size * .4, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

// Una fila = un equipo: color de uniforme (lo elige el árbitro al iniciar) ·
// escudo · nombre · tarjetas (solo si tiene) · goles.
function FilaEquipo({ nombre, logo_url, color, goles, amarillas, rojas }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      {color && <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: color, flexShrink: 0, border: '1px solid rgba(255,255,255,.45)' }}/>}
      <EscudoChico logo_url={logo_url} name={nombre}/>
      <span style={{ flex: 1, minWidth: 0, fontSize: '.62rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nombre || '—'}
      </span>
      {(amarillas > 0 || rojas > 0) && (
        <span style={{ display: 'flex', gap: '3px', flexShrink: 0, fontSize: '.55rem', fontWeight: 800 }}>
          {amarillas > 0 && <span style={{ color: '#f4c430' }}>🟨{amarillas}</span>}
          {rojas > 0 && <span style={{ color: '#e5433d' }}>🟥{rojas}</span>}
        </span>
      )}
      <span style={{ fontWeight: 900, fontSize: '.85rem', color: '#fff', minWidth: '14px', textAlign: 'right', flexShrink: 0 }}>{goles}</span>
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
      position: 'absolute', top: '10px', left: '10px', zIndex: 2,
      background: 'rgba(8,8,8,.88)', borderRadius: '9px', padding: '7px 9px',
      display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '148px', maxWidth: '190px',
      pointerEvents: 'none', boxShadow: '0 2px 10px rgba(0,0,0,.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e5433d', display: 'inline-block', flexShrink: 0 }}/>
        <span style={{ fontSize: '.55rem', fontWeight: 900, color: '#e5433d', letterSpacing: '.03em' }}>VIVO</span>
        <span style={{ marginLeft: 'auto', fontSize: '.58rem', fontWeight: 800, color: '#e5433d' }}>{vivo.descanso ? 'DESC' : vivo.reloj}</span>
      </div>
      <FilaEquipo nombre={home?.name} logo_url={home?.logo_url} color={col.colorLocal} goles={vivo.golesLocal} amarillas={det.amarillasLocal} rojas={det.rojasLocal}/>
      <FilaEquipo nombre={away?.name} logo_url={away?.logo_url} color={col.colorVisitante} goles={vivo.golesVis} amarillas={det.amarillasVisitante} rojas={det.rojasVisitante}/>
      {(hayFaltas || global) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.55rem', color: '#c9c9c9', fontWeight: 700, paddingTop: '3px', borderTop: '1px solid rgba(255,255,255,.14)' }}>
          {hayFaltas ? <span>F {det.faltasLocal || 0}</span> : <span/>}
          {global && <span style={{ color: '#f5a623' }}>Global {global.local}-{global.visitante}</span>}
          {hayFaltas ? <span>F {det.faltasVisitante || 0}</span> : <span/>}
        </div>
      )}
    </div>
  )
}
