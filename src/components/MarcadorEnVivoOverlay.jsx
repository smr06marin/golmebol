// Barra de marcador en vivo que se muestra ENCIMA del video de transmisión
// de la portada (golmebol.com) — como el "score bug" de un canal deportivo.
// El partido a mostrar lo elige el admin desde /admin/config-sitio
// (site_config.en_vivo_match_id); el marcador en sí sale del mismo estado
// en vivo que ya sube la planilla del árbitro (ver src/lib/liveMatch.js) —
// no es un dato aparte que haya que cargar a mano durante el partido.

function EscudoChico({ logo_url, name, size = 26 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: size * .3, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}/>
        : <span style={{ fontSize: size * .38, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

// `partido` viene con la misma forma que arma `partidosVivo` en LandingPage:
// { home: {name, logo_url}, away: {name, logo_url}, vivo: {golesLocal, golesVis, reloj, descanso}, tournaments: {name}, global? }
// Si no hay partido (todavía no hay marcador que mostrar), no renderiza nada.
export default function MarcadorEnVivoOverlay({ partido }) {
  if (!partido?.vivo) return null
  const { home, away, vivo, global } = partido
  const nombreTorneo = partido.tournaments?.name

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2,
      background: 'linear-gradient(0deg, rgba(0,0,0,.94) 0%, rgba(0,0,0,.82) 70%, rgba(0,0,0,0) 100%)',
      padding: '18px 10px 8px', display: 'flex', flexDirection: 'column', gap: '4px', pointerEvents: 'none',
    }}>
      {nombreTorneo && (
        <div style={{ fontSize: '.6rem', color: '#c9c9c9', fontWeight: 700, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nombreTorneo}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.55rem', fontWeight: 900, color: '#e5433d', flexShrink: 0, marginRight: '2px' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e5433d', display: 'inline-block' }}/> VIVO
        </span>
        <EscudoChico logo_url={home?.logo_url} name={home?.name}/>
        <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#fff', maxWidth: '86px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.name || 'Local'}</span>
        <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#fff', padding: '0 2px' }}>{vivo.golesLocal} - {vivo.golesVis}</span>
        <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#fff', maxWidth: '86px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{away?.name || 'Visitante'}</span>
        <EscudoChico logo_url={away?.logo_url} name={away?.name}/>
        <span style={{ fontSize: '.62rem', fontWeight: 800, color: '#e5433d', flexShrink: 0, marginLeft: '2px', minWidth: '48px' }}>
          {vivo.descanso ? 'DESCANSO' : vivo.reloj}
        </span>
      </div>
      {global && (
        <div style={{ fontSize: '.6rem', color: '#f5a623', fontWeight: 800, textAlign: 'center' }}>
          Global {global.local}-{global.visitante}
        </div>
      )}
    </div>
  )
}
