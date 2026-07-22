import { FONDO, PANEL, BORDE, TEXTO, TEXTO_TENUE, VERDE, btnPrimario } from './estilosRapida'

function FilaJugador({ j, color, onAbrir }) {
  const foto = j.photo_face_url || j.photo_url
  const asignado = (j.numero || '').trim() !== ''
  return (
    <button onClick={() => onAbrir(j)}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'none', border: 'none', borderBottom: `1px solid ${BORDE}`, cursor: 'pointer' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', background: '#1e2d3d', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {foto ? <img src={foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.9rem' }}>👤</span>}
      </div>
      <span style={{ flex: 1, minWidth: 0, fontSize: '.85rem', fontWeight: '600', color: TEXTO, overflow: 'hidden' }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {j.nombre || <em style={{ color: TEXTO_TENUE }}>Sin nombre — toca para escribirlo</em>}
        </span>
        {j.debeTarjeta && (
          <span style={{ display: 'inline-block', marginTop: '2px', fontSize: '.62rem', fontWeight: '800', color: '#fff', background: '#d93025', borderRadius: '5px', padding: '2px 6px' }}>
            ⚠️ DEBE TARJETA
          </span>
        )}
      </span>
      {asignado ? (
        <span style={{ background: VERDE, color: '#fff', fontWeight: '900', fontSize: '.8rem', borderRadius: '7px', padding: '4px 10px', flexShrink: 0 }}>#{j.numero}</span>
      ) : (
        <span style={{ color, background: 'rgba(255,255,255,.06)', fontSize: '.68rem', fontWeight: '700', borderRadius: '7px', padding: '4px 10px', flexShrink: 0 }}>Asignar</span>
      )}
    </button>
  )
}

function BloqueEquipo({ titulo, color, jugadores, onAbrir, onAgregarSinRegistro }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '14px', marginBottom: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', fontSize: '.82rem', fontWeight: '800', color, background: 'rgba(255,255,255,.03)' }}>{titulo}</div>
      {jugadores.map((j, i) => <FilaJugador key={j.id || 'sr' + i} j={j} color={color} onAbrir={() => onAbrir(i)}/>)}
      <button onClick={onAgregarSinRegistro}
        style={{ display: 'block', width: '100%', textAlign: 'center', padding: '10px', background: 'none', border: 'none', cursor: 'pointer', color: TEXTO_TENUE, fontSize: '.75rem', fontWeight: '700' }}>
        + Jugador sin registro
      </button>
    </div>
  )
}

// Paso 2: asignar el número de camiseta a cada jugador (con su foto grande al
// tocarlo, en ModalFotoNumero). Se puede volver acá en cualquier momento desde
// el partido — por eso "Continuar" no borra nada, solo cambia de pantalla.
export default function PantallaAsignarNumeros({
  nombreLocal, nombreVis, colorLocal, colorVis, jugadoresLocal, jugadoresVisitante,
  onAbrirJugador, onAgregarSinRegistro, onContinuar, onVolverColores, volviendoDesdePartido,
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: FONDO, color: TEXTO, fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, background: '#0d1117', borderBottom: `1px solid ${BORDE}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onVolverColores} style={{ background: 'none', border: 'none', color: TEXTO_TENUE, fontSize: '.78rem', cursor: 'pointer' }}>‹ Colores</button>
        <div style={{ fontSize: '.85rem', fontWeight: '800' }}>Asignar camisetas</div>
        <div style={{ width: '54px' }}/>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 12px' }}>
          <BloqueEquipo titulo={`🏠 ${nombreLocal}`} color={colorLocal} jugadores={jugadoresLocal}
            onAbrir={i => onAbrirJugador('local', i)} onAgregarSinRegistro={() => onAgregarSinRegistro('local')}/>
          <BloqueEquipo titulo={`🚩 ${nombreVis}`} color={colorVis} jugadores={jugadoresVisitante}
            onAbrir={i => onAbrirJugador('visitante', i)} onAgregarSinRegistro={() => onAgregarSinRegistro('visitante')}/>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: '12px 16px', background: '#0d1117', borderTop: `1px solid ${BORDE}` }}>
        <button onClick={onContinuar} style={btnPrimario}>
          {volviendoDesdePartido ? '✓ Volver al partido' : '⚽ Iniciar partido →'}
        </button>
      </div>
    </div>
  )
}
