import { AlertTriangle } from 'lucide-react'
import FichaEquipo from './FichaEquipo'

// Confirmación GRANDE y clara cuando se va a crear un equipo cuyo nombre se
// parece a uno que ya existe (o cuya cédula de dueño ya tiene equipo) — para
// no duplicar equipos y no perder su historia (partidos, palmarés, jugadores).
// `equipos`: resultado de buscarEquiposParecidos(nombre, { cedula, torneoId }).
// `onUsar(equipo)`: el admin confirmó que ES el mismo equipo.
// `onCrearNuevo()`: el admin confirmó que es OTRO equipo con nombre parecido.
// `onCancelar()`: cierra sin hacer nada.
export default function ModalEquipoParecido({ equipos, onUsar, onCrearNuevo, onCancelar, creando }) {
  if (!equipos || equipos.length === 0) return null
  const porCedula = equipos.some(e => e.por_cedula)

  return (
    <div style={overlay} onClick={onCancelar}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <AlertTriangle size={26} color="#e8710a" style={{ flexShrink: 0 }} />
          <div style={titulo}>{porCedula ? 'Esta cédula ya tiene un equipo' : '¿Ya existe este equipo?'}</div>
        </div>
        <div style={subtitulo}>
          {porCedula
            ? <>El dueño con esa cédula ya tiene un equipo en Golmebol. Si es el <b>mismo equipo</b>, úsalo: así conserva toda su historia.</>
            : <>Ya hay {equipos.length === 1 ? 'un equipo registrado' : 'equipos registrados'} con un nombre parecido. Si es el <b>mismo equipo</b>, úsalo: así conserva toda su historia (partidos, palmarés, jugadores).</>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0' }}>
          {[...equipos].sort((a, b) => (a.en_este_torneo ? 1 : 0) - (b.en_este_torneo ? 1 : 0)).map(e => (
            <FichaEquipo key={e.id} equipo={e} mostrarCedula>
              {(
                <button onClick={() => onUsar(e)} disabled={creando} style={btnUsar}>✓ Sí, es este equipo — usarlo</button>
              )}
            </FichaEquipo>
          ))}
        </div>

        <button onClick={onCrearNuevo} disabled={creando} style={btnNuevo}>
          {creando ? 'Creando...' : 'No, es otro equipo distinto — crear uno nuevo'}
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
  background: '#fff', borderRadius: '18px', padding: '20px', boxShadow: '0 12px 40px rgba(0,0,0,.3)',
  fontFamily: 'system-ui, sans-serif', WebkitTextSizeAdjust: '100%',
}
const titulo = { fontSize: '1.15rem', fontWeight: '800', color: '#202124', lineHeight: 1.2 }
const subtitulo = { fontSize: '.82rem', color: '#5f6368', lineHeight: 1.5 }
const btnUsar = {
  width: '100%', padding: '12px', background: '#1e8e3e', border: 'none', borderRadius: '10px',
  cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '800',
}
const btnNuevo = {
  width: '100%', padding: '12px', background: 'none', border: '1px solid #dadce0', borderRadius: '10px',
  cursor: 'pointer', color: '#5f6368', fontSize: '.82rem', marginBottom: '8px',
}
const btnCancelar = {
  width: '100%', padding: '10px', background: 'none', border: 'none',
  cursor: 'pointer', color: '#9aa0a6', fontSize: '.8rem',
}
