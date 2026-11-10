import { Shield } from 'lucide-react'

// Ficha para RECONOCER un equipo que ya existe en Golmebol: escudo grande,
// ciudad, dueño y su "vida futbolística" (torneos jugados, último torneo,
// jugadores y partidos). Se usa al agregar un equipo al torneo y en el aviso
// de equipos parecidos, para que el organizador no se confunda entre dos
// equipos con el mismo nombre.
// `equipo`: fila de buscar_equipos_para_inscribir (los datos de ficha pueden faltar).
// `children`: botón de acción que va debajo (ej. "Es este equipo").
export default function FichaEquipo({ equipo: e, children, resaltado = false }) {
  const tieneFicha = typeof e.torneos === 'number'
  const chips = []
  if (tieneFicha) {
    chips.push(e.torneos > 0
      ? { t: `🏆 ${e.torneos} ${e.torneos === 1 ? 'torneo' : 'torneos'}`, fuerte: true }
      : { t: 'Sin torneos todavía' })
    if (e.jugadores > 0) chips.push({ t: `👥 ${e.jugadores} ${e.jugadores === 1 ? 'jugador' : 'jugadores'}` })
    if (e.partidos > 0) chips.push({ t: `⚽ ${e.partidos} ${e.partidos === 1 ? 'partido' : 'partidos'}` })
  }
  return (
    <div style={{ ...card, ...(resaltado || e.por_cedula ? cardResaltada : {}) }}>
      {e.por_cedula && <div style={badgeVerde}>✓ La cédula del dueño es la misma</div>}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={escudo}>
          {e.logo_url ? <img src={e.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={34} color="#9aa0a6"/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={nombre}>{e.name}</div>
          {e.city && <div style={linea}>📍 {e.city}</div>}
          <div style={{ ...linea, color: e.representante_nombre ? '#1a73e8' : '#d93025', fontWeight: 700 }}>
            {e.representante_nombre ? `👤 Dueño: ${e.representante_nombre}` : '⚠️ Sin dueño registrado'}
          </div>
        </div>
      </div>
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          {chips.map((c, i) => <span key={i} style={c.fuerte ? chipFuerte : chip}>{c.t}</span>)}
        </div>
      )}
      {tieneFicha && e.ultimo_torneo && <div style={{ ...linea, marginTop: '6px' }}>Último torneo: <b>{e.ultimo_torneo}</b></div>}
      {e.en_este_torneo && <div style={badgeGris}>Ya está inscrito en este torneo</div>}
      {e.desactivado_en_este_torneo && <div style={badgeNaranja}>Está desactivado en este torneo — reactívalo desde «Ver desactivados»</div>}
      {children && <div style={{ marginTop: '12px' }}>{children}</div>}
    </div>
  )
}

const card = { background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', padding: '12px', fontFamily: 'system-ui, sans-serif', WebkitTextSizeAdjust: '100%' }
const cardResaltada = { background: '#f1faf4', border: '2px solid #34a853' }
const escudo = { width: '64px', height: '64px', borderRadius: '12px', flexShrink: 0, background: '#f8f9fa', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
const nombre = { fontWeight: 800, color: '#202124', fontSize: '1.02rem', lineHeight: 1.2, wordBreak: 'break-word' }
const linea = { fontSize: '.78rem', color: '#5f6368', marginTop: '3px' }
const chip = { fontSize: '.72rem', background: '#f1f3f4', color: '#3c4043', borderRadius: '999px', padding: '3px 9px', fontWeight: 600 }
const chipFuerte = { ...chip, background: '#e8f0fe', color: '#174ea6' }
const badgeVerde = { display: 'inline-block', background: '#34a853', color: '#fff', borderRadius: '8px', padding: '3px 9px', fontSize: '.72rem', fontWeight: 800, marginBottom: '8px' }
const badgeGris = { marginTop: '10px', background: '#f1f3f4', color: '#5f6368', borderRadius: '8px', padding: '6px 10px', fontSize: '.75rem', fontWeight: 700 }
const badgeNaranja = { marginTop: '10px', background: '#fff4e5', color: '#b45309', borderRadius: '8px', padding: '6px 10px', fontSize: '.75rem', fontWeight: 700 }
