import { Shield } from 'lucide-react'

// Ficha para RECONOCER y ESCOGER un equipo que ya existe en Golmebol:
// escudo, nombre, ciudad, dueño y su "vida futbolística" en tres números
// (torneos, jugadores, partidos) + el último torneo. Se usa al agregar un
// equipo al torneo y en el aviso de equipos parecidos, para que el organizador
// no se confunda entre dos equipos con el mismo nombre.
// `equipo`: fila de buscar_equipos_para_inscribir (los datos de ficha pueden faltar).
// `children`: botón de acción que va debajo (ej. "Es este equipo").
// `mostrarCedula`: marca "la cédula del dueño es la misma" (solo útil cuando la lista mezcla equipos).
export default function FichaEquipo({ equipo: e, children, mostrarCedula = false }) {
  const tieneFicha = typeof e.torneos === 'number'
  const yaEsta = !!e.en_este_torneo
  const desactivado = !!e.desactivado_en_este_torneo
  const atenuada = yaEsta || desactivado
  const stats = tieneFicha ? [
    { n: e.torneos, t: e.torneos === 1 ? 'torneo' : 'torneos' },
    { n: e.jugadores, t: e.jugadores === 1 ? 'jugador' : 'jugadores' },
    { n: e.partidos, t: e.partidos === 1 ? 'partido' : 'partidos' },
  ] : []

  return (
    <div style={{ ...card, opacity: atenuada ? 0.8 : 1 }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <div style={escudo}>
          {e.logo_url ? <img src={e.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={34} color="#9aa0a6"/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={nombre}>{e.name}</div>
          <div style={fila}>{e.city ? <span>📍 {e.city}</span> : <span style={{ color: '#9aa0a6' }}>Sin ciudad</span>}</div>
          <div style={{ ...fila, color: e.representante_nombre ? '#1a56c4' : '#d93025', fontWeight: 700 }}>
            {e.representante_nombre ? `Dueño: ${e.representante_nombre}` : '⚠️ Sin dueño registrado'}
          </div>
        </div>
      </div>

      {mostrarCedula && e.por_cedula && <div style={pildora}>✓ Misma cédula del dueño</div>}

      {stats.length > 0 && (
        <div style={grilla}>
          {stats.map((s, i) => (
            <div key={i} style={{ ...celda, borderLeft: i > 0 ? '1px solid #e3e6ea' : 'none' }}>
              <div style={numero}>{s.n}</div>
              <div style={etiqueta}>{s.t}</div>
            </div>
          ))}
        </div>
      )}
      {tieneFicha && e.ultimo_torneo && (
        <div style={ultimo}><span style={{ color: '#80868b' }}>Último torneo</span> <b style={{ color: '#3c4043' }}>{e.ultimo_torneo}</b></div>
      )}

      {yaEsta && <div style={estadoVerde}>✓ Ya está inscrito en este torneo</div>}
      {desactivado && <div style={estadoNaranja}>Está desactivado en este torneo · reactívalo desde «Ver desactivados»</div>}
      {children && !atenuada && <div style={{ marginTop: '12px' }}>{children}</div>}
    </div>
  )
}

const card = { background: '#fff', border: '1px solid #dfe3e8', borderRadius: '16px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', fontFamily: 'system-ui, sans-serif', WebkitTextSizeAdjust: '100%', boxSizing: 'border-box' }
const escudo = { width: '68px', height: '68px', borderRadius: '14px', flexShrink: 0, background: '#f8f9fa', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
const nombre = { fontWeight: 800, color: '#202124', fontSize: '1.05rem', lineHeight: 1.2, wordBreak: 'break-word', textTransform: 'uppercase', letterSpacing: '.2px' }
const fila = { fontSize: '.8rem', color: '#5f6368', marginTop: '3px', lineHeight: 1.25 }
const grilla = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#f6f8fa', border: '1px solid #e8eaed', borderRadius: '12px', marginTop: '12px', overflow: 'hidden' }
const celda = { padding: '8px 4px', textAlign: 'center' }
const numero = { fontSize: '1.2rem', fontWeight: 800, color: '#174ea6', lineHeight: 1.1 }
const etiqueta = { fontSize: '.68rem', color: '#5f6368', fontWeight: 600, marginTop: '2px' }
const ultimo = { fontSize: '.76rem', marginTop: '9px', lineHeight: 1.3, wordBreak: 'break-word' }
const pildora = { display: 'inline-block', background: '#e6f4ea', color: '#137333', borderRadius: '999px', padding: '3px 10px', fontSize: '.7rem', fontWeight: 800, marginTop: '10px' }
const estadoVerde = { marginTop: '10px', background: '#f1f3f4', color: '#3c4043', borderRadius: '10px', padding: '8px 10px', fontSize: '.78rem', fontWeight: 700, textAlign: 'center' }
const estadoNaranja = { marginTop: '10px', background: '#fff4e5', color: '#b45309', borderRadius: '10px', padding: '8px 10px', fontSize: '.76rem', fontWeight: 700, textAlign: 'center' }
