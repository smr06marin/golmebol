import { useEffect, useRef, useState } from 'react'
import { formatTiempo } from './estilosRapida'

// Cronómetro flotante y arrastrable. Botones SENCILLOS y grandes:
//   ▶ INICIAR / ⏸ PARAR CRONÓMETRO · ↺ REINICIAR · 2º TIEMPO →
// Cuando se acaba el 1er tiempo aparece abajo un botón enorme "PASAR A SEGUNDO
// TIEMPO". Si se pasó al 2do por error, en el 2do tiempo sale "↩ Volver al 1º".
// Lo que no se puede deshacer (reiniciar, terminar el tiempo antes de hora)
// pide confirmación en el mismo widget — sin ventanas del navegador.
//
// Se puede arrastrar desde cualquier parte; un umbral de movimiento distingue
// "tap" de "arrastre" para que los botones de adentro sigan funcionando.
export default function CronometroCentral({
  periodo, segundos, corriendo, tiempoAgotado, golesLocal, golesVis, globalLlave,
  puedeIniciar = true, motivoNoIniciar = '',
  duracionMinutos = 0, alarmaActiva = false, onTerminarTiempo,
  onToggle, onReiniciar, onCambiarPeriodo, onVolverPrimero, onSilenciar, onFinalizar,
}) {
  // Tamaño: con el reloj CORRIENDO se ve compacto (para no tapar los botones de
  // gol/tarjeta); en pausa o al empezar se ve completo, con todos los botones.
  // Mientras falten los arqueros también va compacto, para no tapar su casilla
  // iluminada. "⋯ Más" abre el panel completo aunque el reloj esté corriendo.
  const [mini, setMini] = useState(false)       // la persona lo achicó a propósito
  const [abierto, setAbierto] = useState(false) // la persona abrió el panel completo con el reloj corriendo
  const [confirmar, setConfirmar] = useState(null) // null | 'reiniciar' | 'periodo' | 'volver'
  // Mientras no se arrastre, el widget queda pegado ABAJO (crece hacia arriba).
  const [pos, setPos] = useState({ x: typeof window !== 'undefined' ? Math.max(8, (window.innerWidth - 230) / 2) : 100, y: null })
  const elRef = useRef(null)
  const dragRef = useRef(null)
  const confirmarTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(confirmarTimerRef.current), [])

  // PARAR exige DOBLE TOQUE (dos toques seguidos en menos de 0,7 s): un toque
  // suelto por error ya no detiene el reloj del partido. Con el primer toque el
  // botón se pone amarillo y dice "¡Otra vez!" por un instante. Iniciar y
  // continuar siguen siendo un toque normal.
  const ultimoToqueRef = useRef(0)
  const [avisoParar, setAvisoParar] = useState(false)
  const avisoTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(avisoTimerRef.current), [])
  function tocarReloj() {
    if (!corriendo) { onToggle && onToggle(); return }
    const ahora = Date.now()
    if (ahora - ultimoToqueRef.current < 700) {
      ultimoToqueRef.current = 0
      clearTimeout(avisoTimerRef.current)
      setAvisoParar(false)
      onToggle && onToggle()
      return
    }
    ultimoToqueRef.current = ahora
    setAvisoParar(true)
    clearTimeout(avisoTimerRef.current)
    avisoTimerRef.current = setTimeout(() => setAvisoParar(false), 1200)
  }
  const etiquetaParar = avisoParar ? '👆 ¡OTRA VEZ PARA PARAR!' : '⏸ PARAR (doble toque)'

  function pedirConfirmacion(que) {
    setConfirmar(que)
    clearTimeout(confirmarTimerRef.current)
    confirmarTimerRef.current = setTimeout(() => setConfirmar(null), 7000)
  }
  function cancelarConfirmacion() { clearTimeout(confirmarTimerRef.current); setConfirmar(null) }
  function confirmarSi() {
    const que = confirmar
    cancelarConfirmacion()
    if (que === 'reiniciar') onReiniciar && onReiniciar()
    else if (que === 'periodo') onCambiarPeriodo && onCambiarPeriodo()
    else if (que === 'volver') onVolverPrimero && onVolverPrimero()
  }

  function onDragStart(e) {
    const t = e.touches ? e.touches[0] : e
    let ox = pos.x, oy = pos.y
    if (oy == null) { // primera vez que se mueve: se pasa de "pegado abajo" a posición libre
      const r = elRef.current?.getBoundingClientRect()
      ox = r ? r.left : pos.x; oy = r ? r.top : 100
    }
    dragRef.current = { mx: t.clientX, my: t.clientY, ox, oy, moved: false }
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

  // TIEMPO EXTRA: al cumplirse el tiempo el reloj no se detiene; sigue corriendo
  // y se ve "EXTRA +mm:ss" hasta que el árbitro toque el botón grande de IR AL
  // DESCANSO (1er tiempo) o FINALIZAR PARTIDO (2do).
  const limite = (duracionMinutos || 0) * 60
  const enExtra = !tiempoAgotado && limite > 0 && segundos >= limite
  const fondo = tiempoAgotado ? '#b71c1c' : enExtra ? '#b45309' : periodo === 1 ? '#1a3a8a' : '#d93025'
  const arranque = !corriendo && segundos === 0 && periodo === 1
  const bloqueado = !corriendo && !puedeIniciar
  const miniEf = bloqueado || mini || (corriendo && !abierto)
  const botonMas = () => {
    if (miniEf) { setMini(false); setAbierto(true) } else { setMini(true); setAbierto(false) }
  }
  const botonPasar2T = periodo === 1 && tiempoAgotado
  const botonFinal = periodo === 2 && tiempoAgotado && !!onFinalizar
  const botonTerminar = enExtra && !!onTerminarTiempo
  // BOTÓN DE CIERRE DE TIEMPO — vive DENTRO del cronómetro (antes eran botones enormes flotando
  // aparte, abajo de la pantalla). Según el momento dice:
  //   · tiempo cumplido (reloj en EXTRA): IR AL DESCANSO (1er tiempo) / FINALIZAR PARTIDO (2do)
  //   · ya en descanso:                   INICIAR 2DO TIEMPO
  //   · partido terminado:                TERMINAR Y GUARDAR RESULTADO
  const accionCierre = botonTerminar
    ? { txt: periodo === 1 ? '⏸ IR AL DESCANSO' : '🏁 FINALIZAR PARTIDO', bg: periodo === 1 ? '#e8710a' : '#1a73e8', fn: () => { onTerminarTiempo(); if (periodo === 2 && onFinalizar) onFinalizar() } }
    : botonPasar2T
      ? { txt: '▶ INICIAR 2DO TIEMPO', bg: '#1e8e3e', fn: onCambiarPeriodo }
      : botonFinal
        ? { txt: '🏁 TERMINAR Y GUARDAR RESULTADO', bg: '#1a73e8', fn: onFinalizar }
        : null
  const bottomPx = 12
  const btnBase = { border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', fontFamily: 'inherit' }

  return (
    <>
      <div ref={elRef} onMouseDown={onDragStart} onTouchStart={onDragStart}
        style={{ position: 'fixed', left: pos.x, ...(pos.y == null ? { bottom: `calc(${bottomPx}px + env(safe-area-inset-bottom))` } : { top: pos.y }), zIndex: 900, background: fondo, borderRadius: miniEf ? '26px' : '22px', boxShadow: '0 10px 34px rgba(0,0,0,.55)', width: miniEf ? '200px' : '230px', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', userSelect: 'none', touchAction: 'none', cursor: 'grab' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: miniEf ? '6px 10px 0' : '8px 12px 0' }}>
          <span style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.85)', fontWeight: '800' }}>↕ {periodo === 1 ? '1er TIEMPO' : '2do TIEMPO'}</span>
          <button onClick={botonMas} style={{ background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: '#fff', fontSize: '.65rem', fontWeight: '800' }}>
            {miniEf ? '⋯ Más' : '⤡ Achicar'}
          </button>
        </div>

        <div style={{ padding: miniEf ? '2px 12px 10px' : '2px 14px 14px', textAlign: 'center' }}>
          <style>{'@keyframes gmExtraPulso { 0%,100% { opacity: 1 } 50% { opacity: .35 } }'}</style>
          <div style={{ fontSize: miniEf ? '2rem' : '3rem', fontWeight: '900', color: '#fff', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,.35)' }}>
            {enExtra ? (
              <>
                <div style={{ fontSize: miniEf ? '.62rem' : '.78rem', fontWeight: '900', letterSpacing: '.18em', color: '#ffe066', fontFamily: 'system-ui,sans-serif', marginBottom: '3px', animation: 'gmExtraPulso 1s infinite' }}>⏱ EXTRA</div>
                +{formatTiempo(segundos - limite)}
              </>
            ) : formatTiempo(segundos)}
          </div>
          <div style={{ fontSize: miniEf ? '.8rem' : '1.05rem', fontWeight: '800', color: 'rgba(255,255,255,.92)', marginTop: miniEf ? '2px' : '6px', background: 'rgba(0,0,0,.25)', borderRadius: '8px', padding: miniEf ? '1px 8px' : '3px 10px', display: 'inline-block' }}>
            {golesLocal} - {golesVis}
          </div>
          {globalLlave && !miniEf && (
            <div style={{ marginTop: '4px' }}>
              <span style={{ fontSize: '.6rem', color: '#ffdd44', fontWeight: '800', letterSpacing: '.03em', marginRight: '5px' }}>GLOBAL</span>
              <span style={{ fontSize: '.78rem', fontWeight: '800', color: '#fff' }}>{globalLlave.local} - {globalLlave.visitante}</span>
            </div>
          )}

          {/* ── Modo compacto: un solo botón ── */}
          {miniEf && (
            <>
              <button onClick={tocarReloj} disabled={bloqueado || tiempoAgotado}
                style={{ ...btnBase, marginTop: '6px', padding: '9px 8px', width: '100%', background: corriendo && avisoParar ? '#ffdd44' : 'rgba(255,255,255,.92)', color: corriendo && avisoParar ? '#222' : fondo, fontSize: corriendo ? '.78rem' : '.9rem', opacity: (bloqueado || tiempoAgotado) ? .5 : 1 }}>
                {corriendo ? etiquetaParar : (arranque ? '▶ INICIAR' : '▶ CONTINUAR')}
              </button>
              {alarmaActiva && (
                <button onClick={onSilenciar} style={{ ...btnBase, marginTop: '6px', padding: '8px', width: '100%', background: '#fff', color: '#b71c1c', fontSize: '.78rem', animation: 'gmExtraPulso 1s infinite' }}>🔕 SILENCIAR ALARMA</button>
              )}
              {bloqueado && motivoNoIniciar && (
                <div style={{ fontSize: '.66rem', fontWeight: '800', color: '#ffe066', lineHeight: 1.25, marginTop: '5px' }}>{motivoNoIniciar}</div>
              )}
            </>
          )}

          {/* ── Botón de cierre de tiempo (IR AL DESCANSO / INICIAR 2DO TIEMPO / GUARDAR) ── */}
          {accionCierre && (
            <button onClick={accionCierre.fn}
              style={{ ...btnBase, marginTop: '8px', width: '100%', padding: miniEf ? '12px 8px' : '15px 8px', background: accionCierre.bg, color: '#fff', fontSize: miniEf ? '.88rem' : '1.02rem', letterSpacing: '.02em', border: '2px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,.4)', touchAction: 'manipulation' }}>
              {accionCierre.txt}
            </button>
          )}

          {/* ── Confirmación en el mismo widget ── */}
          {!miniEf && confirmar && (
            <div style={{ marginTop: '10px', background: 'rgba(0,0,0,.35)', borderRadius: '12px', padding: '10px' }}>
              <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#fff', marginBottom: '8px', lineHeight: 1.25 }}>
                {confirmar === 'reiniciar' && `¿Reiniciar el ${periodo === 1 ? '1er' : '2do'} tiempo a 00:00?`}
                {confirmar === 'periodo' && '¿Terminar el 1er tiempo ahora y pasar al 2do?'}
                {confirmar === 'volver' && '¿Volver al 1er tiempo? (el 2do tiempo se queda en 00:00)'}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={confirmarSi} style={{ ...btnBase, flex: 1, padding: '10px 4px', background: '#fff', color: '#111', fontSize: '.85rem' }}>Sí</button>
                <button onClick={cancelarConfirmacion} style={{ ...btnBase, flex: 1, padding: '10px 4px', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: '.85rem' }}>No</button>
              </div>
            </div>
          )}

          {/* ── Botones normales ── */}
          {!miniEf && !confirmar && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {tiempoAgotado ? (
                <>
                  <div style={{ fontSize: '.85rem', fontWeight: '900', color: '#fff', background: 'rgba(0,0,0,.3)', borderRadius: '10px', padding: '7px' }}>
                    {periodo === 1 ? '⏱ FIN DEL 1ER TIEMPO' : '🏁 FIN DEL PARTIDO'}
                  </div>
                  {alarmaActiva && <button onClick={onSilenciar} style={{ ...btnBase, padding: '10px', background: 'rgba(255,255,255,.92)', color: fondo, fontSize: '.85rem' }}>🔕 Silenciar alarma</button>}
                </>
              ) : (
                <button onClick={tocarReloj} disabled={bloqueado}
                  style={{ ...btnBase, padding: '13px 8px', background: corriendo && avisoParar ? '#ffdd44' : (bloqueado ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.95)'), color: corriendo && avisoParar ? '#222' : (bloqueado ? 'rgba(255,255,255,.8)' : fondo), fontSize: corriendo ? '.88rem' : '1rem', letterSpacing: '.01em' }}>
                  {corriendo ? (avisoParar ? '👆 ¡OTRA VEZ PARA PARAR!' : '⏸ PARAR CRONÓMETRO (doble toque)') : (arranque ? '▶ INICIAR PARTIDO' : '▶ CONTINUAR')}
                </button>
              )}
              {alarmaActiva && (
                <button onClick={onSilenciar} style={{ ...btnBase, padding: '11px', background: '#fff', color: '#b71c1c', fontSize: '.9rem', animation: 'gmExtraPulso 1s infinite' }}>🔕 SILENCIAR ALARMA</button>
              )}
              {bloqueado && motivoNoIniciar && (
                <div style={{ fontSize: '.72rem', fontWeight: '800', color: '#ffe066', lineHeight: 1.25 }}>{motivoNoIniciar}</div>
              )}
              <div style={{ display: 'flex', gap: '7px' }}>
                <button onClick={() => pedirConfirmacion('reiniciar')} disabled={segundos === 0 && !corriendo}
                  style={{ ...btnBase, flex: 1, padding: '9px 4px', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: '.78rem', opacity: (segundos === 0 && !corriendo) ? .45 : 1 }}>
                  ↺ Reiniciar
                </button>
                {periodo === 1 ? (botonPasar2T ? null : (
                  <button onClick={() => (tiempoAgotado ? onCambiarPeriodo && onCambiarPeriodo() : pedirConfirmacion('periodo'))}
                    style={{ ...btnBase, flex: 1.2, padding: '9px 4px', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: '.78rem' }}>
                    2º tiempo →
                  </button>
                )) : (
                  <button onClick={() => pedirConfirmacion('volver')}
                    style={{ ...btnBase, flex: 1.2, padding: '9px 4px', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: '.78rem' }}>
                    ↩ Volver al 1º
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  )
}
