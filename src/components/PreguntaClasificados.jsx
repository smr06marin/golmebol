import { useState } from 'react'

// Pregunta, antes de las eliminaciones directas, cuántos equipos clasificaron.
// Con la respuesta, los que no clasificaron salen en rojo como eliminados.
// Pantalla simple: pasos numerados, botones grandes − / +, una sola acción.
//
// props:
//   numGrupos     cuántos grupos tiene el torneo (0 = una sola tabla)
//   maxPorGrupo   equipos del grupo más grande
//   totalEquipos  equipos del torneo
//   inicial       { modo, n, extra } guardado antes (o null)
//   sugeridoN     número para arrancar si no hay nada guardado
//   vistaPrevia(cfg) → { clasifican: number, eliminados: [nombre] }
//   guardando, onGuardar(cfg), onCerrar
export default function PreguntaClasificados({ numGrupos = 0, maxPorGrupo = 0, totalEquipos = 0, inicial = null, sugeridoN = 2, vistaPrevia, guardando = false, onGuardar, onCerrar }) {
  const porGrupos = numGrupos > 0
  const tope = Math.max(1, porGrupos ? (maxPorGrupo || 1) : (totalEquipos || 1))
  const topeExtra = Math.max(0, totalEquipos - 1)
  const [n, setN] = useState(() => Math.min(tope, Math.max(1, Number(inicial?.n) || Number(sugeridoN) || 2)))
  const [extra, setExtra] = useState(() => (porGrupos ? Math.min(topeExtra, Math.max(0, Number(inicial?.extra) || 0)) : 0))

  const cfg = porGrupos ? { modo: 'grupo', n, extra } : { modo: 'tabla', n, extra: 0 }
  const vp = vistaPrevia ? vistaPrevia(cfg) : { clasifican: 0, eliminados: [] }

  const fuente = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
  const paso = (num, texto) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.95rem', flexShrink: 0 }}>{num}</span>
      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#202124', lineHeight: 1.3 }}>{texto}</span>
    </div>
  )
  const contador = (valor, setValor, min, max, etiqueta) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button type="button" aria-label="Menos" onClick={() => setValor(v => Math.max(min, v - 1))} disabled={valor <= min}
        style={{ width: '56px', height: '56px', borderRadius: '14px', border: '1.5px solid #dadce0', background: '#fff', fontSize: '1.7rem', fontWeight: 700, color: valor <= min ? '#bdc1c6' : '#1a73e8', cursor: 'pointer', touchAction: 'manipulation', fontFamily: fuente }}>−</button>
      <div style={{ minWidth: '64px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#202124', lineHeight: 1 }}>{valor}</div>
        <div style={{ fontSize: '.85rem', color: '#5f6368', marginTop: '4px' }}>{etiqueta}</div>
      </div>
      <button type="button" aria-label="Más" onClick={() => setValor(v => Math.min(max, v + 1))} disabled={valor >= max}
        style={{ width: '56px', height: '56px', borderRadius: '14px', border: '1.5px solid #dadce0', background: '#fff', fontSize: '1.7rem', fontWeight: 700, color: valor >= max ? '#bdc1c6' : '#1a73e8', cursor: 'pointer', touchAction: 'manipulation', fontFamily: fuente }}>+</button>
    </div>
  )

  return (
    <div onClick={guardando ? undefined : onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(32,33,36,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="¿Cuántos equipos clasificaron?"
        style={{ background: '#fff', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: '520px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: fuente }}>

        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <button type="button" onClick={onCerrar} disabled={guardando}
            style={{ flexShrink: 0, minHeight: '44px', padding: '0 14px', borderRadius: '12px', border: '1.5px solid #dadce0', background: '#fff', color: '#3c4043', fontWeight: 700, fontSize: '.92rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Volver
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#202124', lineHeight: 1.25 }}>¿Cuántos equipos clasificaron?</div>
            <div style={{ fontSize: '.9rem', color: '#5f6368', marginTop: '3px', lineHeight: 1.4 }}>Antes de las eliminaciones directas. Los que <b>no clasificaron</b> saldrán en <b style={{ color: '#d93025' }}>rojo</b> como eliminados.</div>
          </div>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 16px 14px', flex: 1 }}>
          {porGrupos ? (
            <>
              {paso(1, '¿Cuántos pasan de cada grupo?')}
              {contador(n, setN, 1, tope, n === 1 ? 'equipo por grupo' : 'equipos por grupo')}

              <div style={{ height: '24px' }}/>
              {paso(2, '¿Pasan también los mejores de los que quedaron afuera?')}
              <div style={{ fontSize: '.9rem', color: '#5f6368', margin: '-4px 0 10px 38px', lineHeight: 1.4 }}>Ejemplo: los 2 mejores terceros. Si no pasa nadie más, déjalo en <b>0</b>.</div>
              {contador(extra, setExtra, 0, topeExtra, extra === 1 ? 'equipo más' : 'equipos más')}
            </>
          ) : (
            <>
              {paso(1, '¿Cuántos pasan de la tabla?')}
              <div style={{ fontSize: '.9rem', color: '#5f6368', margin: '-4px 0 10px 38px', lineHeight: 1.4 }}>Pasan los primeros de la tabla de posiciones.</div>
              {contador(n, setN, 1, tope, n === 1 ? 'equipo' : 'equipos')}
            </>
          )}

          <div style={{ marginTop: '22px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#202124' }}>✅ Clasifican {vp.clasifican} de {totalEquipos} equipos</div>
            {vp.eliminados.length > 0 ? (
              <>
                <div style={{ fontSize: '.92rem', fontWeight: 700, color: '#d93025', marginTop: '10px' }}>❌ Quedan eliminados ({vp.eliminados.length}):</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {vp.eliminados.map((nom, i) => (
                    <span key={i} style={{ background: '#fce8e6', color: '#a50e0e', borderRadius: '999px', padding: '5px 10px', fontSize: '.85rem', fontWeight: 600 }}>{nom}</span>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '.9rem', color: '#5f6368', marginTop: '6px' }}>Nadie queda eliminado todavía.</div>
            )}
            <div style={{ fontSize: '.85rem', color: '#5f6368', marginTop: '12px', lineHeight: 1.4 }}>Sale según cómo va la tabla ahora. Después, el que pierda su llave también queda eliminado.</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid #e8eaed', background: '#fff' }}>
          <button type="button" onClick={() => onGuardar(cfg)} disabled={guardando}
            style={{ width: '100%', border: 'none', borderRadius: '14px', minHeight: '54px', fontSize: '1.05rem', fontWeight: 800, cursor: guardando ? 'default' : 'pointer', background: '#1a73e8', color: '#fff', opacity: guardando ? 0.7 : 1, fontFamily: 'inherit' }}>
            {guardando ? 'Guardando…' : 'Guardar y seguir'}
          </button>
        </div>
      </div>
    </div>
  )
}
