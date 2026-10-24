// Botones del panel de control para elegir qué PARTE de la tabla de posiciones
// se muestra en la transmisión cuando el torneo tiene más de 10 equipos (la
// gráfica muestra de a 10): "Automática" = las partes van rotando solas; o una
// parte fija (1-10, 11-20, 21-23…). El valor se guarda en
// site_config.en_vivo_control[streamId].tabla_pagina (null = automática) y lo
// lee TablaEnVivoOverlay. Si la tabla tiene 10 equipos o menos no se muestra.
import { TABLA_POR_PARTE } from './enVivoUI'

export default function BotonesPartesTabla({ total, pagina, onElegir, denso = false }) {
  if (!total || total <= TABLA_POR_PARTE) return null
  const partes = Math.ceil(total / TABLA_POR_PARTE)
  const elegida = Number.isFinite(Number(pagina)) && Number(pagina) >= 1 && Number(pagina) <= partes ? Math.floor(Number(pagina)) : null
  const estilo = activo => ({
    padding: denso ? '7px 11px' : '9px 13px', background: activo ? '#e5433d' : '#2a2a2a', border: 'none', borderRadius: '8px',
    cursor: 'pointer', color: '#fff', fontSize: denso ? '.72rem' : '.78rem', fontWeight: '700',
  })
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '.68rem', color: '#9aa0a6', fontWeight: '600', marginBottom: '6px' }}>
        TABLA DE {total} EQUIPOS — QUÉ PARTE SE MUESTRA
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button onClick={() => onElegir(null)} style={estilo(!elegida)}>Automática</button>
        {Array.from({ length: partes }, (_, i) => {
          const desde = i * TABLA_POR_PARTE + 1
          const hasta = Math.min(total, (i + 1) * TABLA_POR_PARTE)
          return (
            <button key={i} onClick={() => onElegir(i + 1)} style={estilo(elegida === i + 1)}>
              Parte {i + 1} <span style={{ opacity: .7, fontWeight: 600 }}>({desde}-{hasta})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
