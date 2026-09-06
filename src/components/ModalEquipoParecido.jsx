import { Shield, AlertTriangle } from 'lucide-react'

// Confirmación GRANDE y clara cuando se va a crear un equipo cuyo nombre se
// parece a uno que ya existe (en éste u otro torneo) — para evitar duplicar
// equipos por accidente y perder su historia (partidos, palmarés, jugadores).
// `equipos`: resultado de buscarEquiposParecidos(nombre).
// `onUsar(equipo)`: el admin confirmó que ES el mismo equipo.
// `onCrearNuevo()`: el admin confirmó que es OTRO equipo con nombre parecido.
// `onCancelar()`: cierra sin hacer nada.
export default function ModalEquipoParecido({ equipos, onUsar, onCrearNuevo, onCancelar, creando }) {
  if (!equipos || equipos.length === 0) return null

  return (
    <div style={overlay} onClick={onCancelar}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <AlertTriangle size={26} color="#e8710a" />
          <div style={titulo}>¿Ya existe este equipo?</div>
        </div>
        <div style={subtitulo}>
          Ya hay {equipos.length === 1 ? 'un equipo registrado' : 'equipos registrados'} con un nombre parecido.
          Si es el <b>mismo equipo</b>, úsalo — así conserva toda su historia (partidos, palmarés, jugadores).
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '18px 0' }}>
          {equipos.map(e => (
            <div key={e.id} style={filaEquipo}>
              <div style={escudoWrap}>
                {e.logo_url
                  ? <img src={e.logo_url} style={escudoImg} />
                  : <Shield size={42} color="#9aa0a6" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={nombreEquipo}>{e.name}</div>
                {e.city && <div style={ciudad}>📍 {e.city}</div>}
                <div style={dueno}>👤 Dueño: {e.representante_nombre || 'sin registrar'}</div>
              </div>
              <button onClick={() => onUsar(e)} disabled={creando} style={btnUsar}>
                ✓ Es este<br />usarlo
              </button>
            </div>
          ))}
        </div>

        <button onClick={onCrearNuevo} disabled={creando} style={btnNuevo}>
          {creando ? 'Creando...' : 'No, es otro equipo distinto con nombre parecido — crear nuevo'}
        </button>
        <button onClick={onCancelar} disabled={creando} style={btnCancelar}>Cancelar</button>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 900,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
}
const card = {
  width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
  background: '#fff', borderRadius: '18px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,.3)',
  fontFamily: 'system-ui, sans-serif',
}
const titulo = { fontSize: '1.15rem', fontWeight: '800', color: '#202124' }
const subtitulo = { fontSize: '.8rem', color: '#5f6368', lineHeight: 1.5 }
const filaEquipo = {
  display: 'flex', alignItems: 'center', gap: '14px',
  background: '#fff8e1', border: '2px solid #f9a825', borderRadius: '14px', padding: '14px',
}
const escudoWrap = {
  width: '64px', height: '64px', borderRadius: '12px', flexShrink: 0,
  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  border: '1px solid #f1e3b0',
}
const escudoImg = { width: '100%', height: '100%', objectFit: 'contain' }
const nombreEquipo = { fontWeight: '800', color: '#202124', fontSize: '1.05rem', lineHeight: 1.2 }
const ciudad = { fontSize: '.75rem', color: '#8a5a00', marginTop: '2px' }
const dueno = { fontSize: '.85rem', color: '#1a73e8', fontWeight: '700', marginTop: '4px' }
const btnUsar = {
  flexShrink: 0, padding: '10px 12px', background: '#1e8e3e', border: 'none', borderRadius: '10px',
  cursor: 'pointer', color: '#fff', fontSize: '.75rem', fontWeight: '800', lineHeight: 1.3, textAlign: 'center',
}
const btnNuevo = {
  width: '100%', padding: '11px', background: 'none', border: '1px solid #dadce0', borderRadius: '10px',
  cursor: 'pointer', color: '#5f6368', fontSize: '.8rem', marginBottom: '8px',
}
const btnCancelar = {
  width: '100%', padding: '9px', background: 'none', border: 'none',
  cursor: 'pointer', color: '#9aa0a6', fontSize: '.78rem',
}
