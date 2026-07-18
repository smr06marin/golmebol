import { useState } from 'react'

const BOTONES_EVENTO = [
  { tipo: 'goal',        emoji: '⚽', label: 'Gol',      color: '#1e8e3e' },
  { tipo: 'yellow_card', emoji: '🟨', label: 'Amarilla', color: '#f9c400' },
  { tipo: 'blue_card',   emoji: '🟦', label: 'Azul',     color: '#1a73e8' },
  { tipo: 'red_card',    emoji: '🟥', label: 'Roja',     color: '#d93025' },
  { tipo: 'falta_acum',  emoji: '🟠', label: 'Falta',    color: '#e8710a' },
]

// Una mitad de la pantalla de partido: nombre del equipo + faltas arriba, el
// ARQUERO bien grande debajo (para identificarlo de un vistazo), un input de
// número de camiseta + botones de evento, y el registro de lo anotado en
// este equipo (con scroll SOLO acá adentro, para que la pantalla completa
// nunca necesite scroll).
export default function EquipoHalf({
  equipoNombre, color, colorTexto, jugadores, arquero, eventos, mostrarFaltas, faltasEquipo,
  onSeleccionarArquero, onRegistrarEvento, onQuitarEvento, arriba,
}) {
  const [numero, setNumero] = useState('')
  const [mostrarPicker, setMostrarPicker] = useState(false)

  const numerados = jugadores.filter(j => (j.numero || '').trim() !== '')
  const botones = mostrarFaltas ? BOTONES_EVENTO : BOTONES_EVENTO.filter(b => b.tipo !== 'falta_acum')

  function handleEvento(tipo) {
    if (!numero.trim()) return
    onRegistrarEvento(numero.trim(), tipo)
    setNumero('')
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: color, borderTop: arriba ? 'none' : '2px solid #07070e' }}>
      {/* Equipo + faltas */}
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '.66rem', fontWeight: '800', color: colorTexto, opacity: .85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {equipoNombre}
        </span>
        {mostrarFaltas && (
          <span title="Faltas acumuladas del equipo en este tiempo"
            style={{ background: faltasEquipo >= 5 ? '#e8710a' : 'rgba(0,0,0,.25)', color: faltasEquipo >= 5 ? '#1a1a1a' : colorTexto, borderRadius: '6px', padding: '3px 7px', fontSize: '.65rem', fontWeight: '800', flexShrink: 0 }}>
            🟠 {faltasEquipo}
          </span>
        )}
      </div>

      {/* Arquero — grande, para identificarlo bien */}
      <button onClick={() => setMostrarPicker(v => !v)}
        style={{ margin: '0 8px 6px', padding: '8px 12px', background: 'rgba(0,0,0,.28)', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🧤</span>
        {arquero ? (
          <span style={{ flex: 1, textAlign: 'left', fontSize: '1.15rem', fontWeight: '900', color: colorTexto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.15 }}>
            {arquero.nombre}{arquero.numero ? ` · #${arquero.numero}` : ''}
          </span>
        ) : (
          <span style={{ flex: 1, textAlign: 'left', fontSize: '.95rem', fontWeight: '800', color: colorTexto }}>Elegir arquero</span>
        )}
        <span style={{ fontSize: '.65rem', fontWeight: '700', color: colorTexto, opacity: .85, background: 'rgba(0,0,0,.25)', borderRadius: '6px', padding: '3px 7px', flexShrink: 0 }}>
          {arquero ? 'Cambiar' : 'Elegir'}
        </span>
      </button>

      {mostrarPicker && (
        <div style={{ maxHeight: '130px', overflowY: 'auto', background: 'rgba(0,0,0,.35)', flexShrink: 0, margin: '0 8px 6px', borderRadius: '8px' }}>
          {numerados.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '.7rem', color: colorTexto, opacity: .8 }}>Primero asigna números en "Jugadores"</div>
          ) : numerados.map((j, i) => (
            <button key={j.id || j.nombre + i} onClick={() => { onSeleccionarArquero(j); setMostrarPicker(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', color: colorTexto, fontSize: '.82rem', fontWeight: '600' }}>
              #{j.numero} · {j.nombre || 'Sin nombre'}
            </button>
          ))}
        </div>
      )}

      {/* Entrada rápida: número + evento */}
      <div style={{ display: 'flex', gap: '6px', padding: '0 10px 6px', flexShrink: 0 }}>
        <input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, '').slice(0, 2))}
          inputMode="numeric" placeholder="N°" maxLength={2}
          style={{ width: '52px', padding: '8px 6px', borderRadius: '8px', border: 'none', fontSize: '1.1rem', fontWeight: '900', textAlign: 'center', outline: 'none', flexShrink: 0 }}/>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${botones.length},1fr)`, gap: '4px' }}>
          {botones.map(b => (
            <button key={b.tipo} onClick={() => handleEvento(b.tipo)} disabled={!numero.trim()}
              title={b.label}
              style={{ padding: '6px 2px', borderRadius: '7px', border: 'none', background: b.color, cursor: numero.trim() ? 'pointer' : 'default', opacity: numero.trim() ? 1 : .55, fontSize: '1rem' }}>
              {b.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Registro de este equipo */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'rgba(0,0,0,.22)', padding: '2px 8px' }}>
        {eventos.length === 0 ? (
          <div style={{ fontSize: '.65rem', color: colorTexto, opacity: .7, padding: '6px 4px' }}>Sin eventos aún</div>
        ) : [...eventos].reverse().map(e => (
          <div key={e.id} onClick={() => onQuitarEvento(e.id)} title="Toca para quitar"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 4px', fontSize: '.7rem', color: colorTexto, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span>{BOTONES_EVENTO.find(b => b.tipo === e.tipo)?.emoji}</span>
            <span style={{ fontWeight: '700' }}>#{e.numero}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.jugadorNombre || ''}</span>
            <span style={{ opacity: .75 }}>{e.minuto}</span>
            <span style={{ opacity: .6 }}>✕</span>
          </div>
        ))}
      </div>
    </div>
  )
}
