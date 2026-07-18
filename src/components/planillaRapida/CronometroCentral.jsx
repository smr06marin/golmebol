import { useRef, useState } from 'react'
import { formatTiempo } from './estilosRapida'

// Cronómetro flotante y arrastrable (mismo mecanismo que la planilla completa:
// se puede tocar/arrastrar desde cualquier parte del widget; un umbral de
// movimiento distingue "tap" de "arrastre" para que los botones de adentro
// sigan funcionando). Arranca grande y centrado para que se lea bien de lejos;
// con el ícono ↕ se puede achicar si estorba.
export default function CronometroCentral({
  periodo, segundos, corriendo, tiempoAgotado, golesLocal, golesVis, onToggle, onCambiarPeriodo,
}) {
  const [mini, setMini] = useState(false)
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(8, window.innerWidth / 2 - 100) : 100,
    y: typeof window !== 'undefined' ? Math.max(8, window.innerHeight / 2 - 90) : 200,
  }))
  const dragRef = useRef(null)

  function onDragStart(e) {
    const t = e.touches ? e.touches[0] : e
    dragRef.current = { mx: t.clientX, my: t.clientY, ox: pos.x, oy: pos.y, moved: false }
    if (e.touches) {
      window.addEventListener('touchmove', onDrag, { passive: false })
      window.addEventListener('touchend', onDragEnd)
      window.addEventListener('touchcancel', onDragEnd)
    } else {
      window.addEventListener('mousemove', onDrag)
      window.addEventListener('mouseup', onDragEnd)
    }
  }
  function onDrag(e) {
    if (!dragRef.current) return
    const t = e.touches ? e.touches[0] : e
    const dx = t.clientX - dragRef.current.mx, dy = t.clientY - dragRef.current.my
    if (!dragRef.current.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) dragRef.current.moved = true
    if (dragRef.current.moved) {
      if (e.touches) e.preventDefault()
      const maxX = window.innerWidth - 60, maxY = window.innerHeight - 60
      setPos({ x: Math.min(Math.max(0, dragRef.current.ox + dx), maxX), y: Math.min(Math.max(0, dragRef.current.oy + dy), maxY) })
    }
  }
  function onDragEnd() {
    if (dragRef.current?.moved) {
      const bloquear = ev => { ev.stopPropagation(); ev.preventDefault() }
      window.addEventListener('click', bloquear, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', bloquear, { capture: true }), 400)
    }
    dragRef.current = null
    window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', onDragEnd); window.removeEventListener('touchcancel', onDragEnd)
  }

  const fondo = tiempoAgotado ? '#b71c1c' : periodo === 1 ? '#1a3a8a' : '#d93025'

  return (
    <div onMouseDown={onDragStart} onTouchStart={onDragStart}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 900, background: fondo, borderRadius: mini ? '50px' : '22px', boxShadow: '0 10px 34px rgba(0,0,0,.55)', minWidth: mini ? '150px' : '210px', userSelect: 'none', touchAction: 'none', cursor: 'grab' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mini ? '6px 10px 0' : '8px 12px 0' }}>
        <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.75)', fontWeight: '700' }}>↕ {periodo === 1 ? '1T' : '2T'}</span>
        <button onClick={() => setMini(v => !v)} style={{ background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: '6px', padding: '2px 6px', cursor: 'pointer', color: '#fff', fontSize: '.6rem', fontWeight: '700' }}>
          {mini ? '⤢' : '⤡'}
        </button>
      </div>

      <div style={{ padding: mini ? '2px 14px 8px' : '2px 16px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: mini ? '1.6rem' : '2.8rem', fontWeight: '900', color: '#fff', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,.35)' }}>
          {formatTiempo(segundos)}
        </div>
        <div style={{ fontSize: mini ? '.75rem' : '1.05rem', fontWeight: '800', color: 'rgba(255,255,255,.92)', marginTop: mini ? '2px' : '6px', background: 'rgba(0,0,0,.25)', borderRadius: '8px', padding: mini ? '1px 8px' : '3px 10px', display: 'inline-block' }}>
          {golesLocal} - {golesVis}
        </div>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: mini ? '6px' : '10px' }}>
          <button onClick={onToggle}
            style={{ padding: mini ? '5px 12px' : '8px 16px', background: 'rgba(255,255,255,.92)', border: 'none', borderRadius: '10px', cursor: 'pointer', color: fondo, fontSize: mini ? '.75rem' : '.85rem', fontWeight: '800' }}>
            {corriendo ? '⏸ Pausar' : '▶️ Iniciar'}
          </button>
          {periodo === 1 && (
            <button onClick={onCambiarPeriodo}
              style={{ padding: mini ? '5px 10px' : '8px 12px', background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: mini ? '.68rem' : '.78rem', fontWeight: '700' }}>
              2T →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
