import { useState, useEffect } from 'react'
import { Check, X, ZoomIn } from 'lucide-react'

// Selector de "con qué planilla se maneja el torneo" (se muestra al crear el
// torneo). Enseña las DOS planillas con capturas reales para que el
// organizador vea las diferencias antes de escoger. Sin nada marcado de antemano.
//   value: '' | 'salon' | 'futbol11'    onChange(valor)
//   mostrarError: pinta en rojo el aviso cuando falta escoger
//   requerido: false al editar un torneo viejo que nunca eligió (queda opcional)
const PLANILLAS_TORNEO = [
  {
    id: 'salon',
    titulo: 'Fútbol de salón',
    subtitulo: 'Planilla profesional completa',
    imagen: '/planillas/planilla-salon.webp',
    ideal: 'Fútbol de salón, microfútbol y torneos con árbitro y anotador',
    puntos: [
      'Firmas digitales de capitanes, árbitros y anotador',
      'Faltas acumuladas por tiempo, con alerta a la quinta',
      'Goles con minuto, tarjetas, arqueros y cambios',
      'MVP del partido e informe obligatorio si hay roja',
      'Tanda de penales dentro de la planilla',
    ],
  },
  {
    id: 'futbol11',
    titulo: 'Fútbol 11',
    subtitulo: 'Hoja de papel digital, en una sola pantalla',
    imagen: '/planillas/planilla-futbol11.webp',
    ideal: 'Fútbol 11 y torneos donde un solo árbitro llena todo desde el celular',
    puntos: [
      'Una sola pantalla: documento, nombre, número, tarjetas y gol',
      'Un toque por gol; la tarjeta con doble toque; el minuto sale del cronómetro',
      'DT, capitán, carnés y 4 preguntas de Sí/No',
      'Informe arbitral y cierre con MVP y arqueros',
      'Sin firmas digitales ni faltas acumuladas',
    ],
  },
]

const AZUL = '#1a73e8'

function ModalZoom({ planilla, elegida, onElegir, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(10,12,20,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '460px', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid #e8eaed' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#202124' }}>{planilla.titulo}</div>
            <div style={{ fontSize: '.75rem', color: '#5f6368' }}>{planilla.subtitulo}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: '#f1f3f4', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={18} color="#5f6368"/>
          </button>
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: '#f1f3f4', flex: 1 }}>
          <img src={planilla.imagen} alt={`Captura de la planilla de ${planilla.titulo}`} style={{ display: 'block', width: '100%', height: 'auto' }}/>
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e8eaed' }}>
          <button type="button" onClick={() => { onElegir(planilla.id); onClose() }}
            style={{ width: '100%', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '.95rem', fontWeight: '700', cursor: 'pointer', background: elegida ? '#e6f4ea' : AZUL, color: elegida ? '#137333' : '#fff' }}>
            {elegida ? '✓ Planilla elegida' : `Elegir ${planilla.titulo}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Tarjeta({ planilla, elegida, onElegir, onZoom }) {
  return (
    <div role="radio" aria-checked={elegida} tabIndex={0}
      onClick={() => onElegir(planilla.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onElegir(planilla.id) } }}
      style={{ position: 'relative', border: `2px solid ${elegida ? AZUL : '#dadce0'}`, background: elegida ? '#f3f8ff' : '#fff', borderRadius: '12px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, transition: 'border-color .15s, background .15s' }}>
      {elegida && (
        <div style={{ position: 'absolute', top: '-10px', right: '-6px', background: AZUL, color: '#fff', borderRadius: '999px', padding: '3px 10px 3px 8px', fontSize: '.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 2 }}>
          <Check size={13}/> Elegida
        </div>
      )}
      <button type="button" onClick={e => { e.stopPropagation(); onZoom(planilla.id) }} aria-label={`Ver más grande la planilla de ${planilla.titulo}`}
        style={{ position: 'relative', padding: 0, border: '1px solid #e8eaed', borderRadius: '8px', overflow: 'hidden', background: '#f1f3f4', height: '300px', cursor: 'zoom-in', display: 'block', width: '100%' }}>
        <img src={planilla.imagen} alt={`Captura de la planilla de ${planilla.titulo}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}/>
        <span style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(32,33,36,.82)', color: '#fff', borderRadius: '999px', padding: '4px 9px', fontSize: '.68rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ZoomIn size={12}/> Ampliar
        </span>
      </button>
      <div>
        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#202124', lineHeight: 1.2 }}>{planilla.titulo}</div>
        <div style={{ fontSize: '.74rem', color: '#5f6368', marginTop: '2px' }}>{planilla.subtitulo}</div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {planilla.puntos.map(p => (
          <li key={p} style={{ display: 'flex', gap: '6px', fontSize: '.74rem', color: '#3c4043', lineHeight: 1.3 }}>
            <span style={{ color: AZUL, fontWeight: '700', flexShrink: 0 }}>•</span><span>{p}</span>
          </li>
        ))}
      </ul>
      <div style={{ fontSize: '.7rem', color: '#80868b', borderTop: '1px dashed #e0e3e7', paddingTop: '8px' }}>
        <b style={{ color: '#5f6368' }}>Ideal para:</b> {planilla.ideal}
      </div>
      <div style={{ marginTop: 'auto', textAlign: 'center', borderRadius: '8px', padding: '9px', fontSize: '.82rem', fontWeight: '700', background: elegida ? AZUL : '#f1f3f4', color: elegida ? '#fff' : '#3c4043' }}>
        {elegida ? '✓ Elegida' : 'Usar esta planilla'}
      </div>
    </div>
  )
}

export default function SelectorPlanillaTorneo({ value, onChange, mostrarError = false, isMobile = false, requerido = true }) {
  const [zoom, setZoom] = useState(null)
  const planillaZoom = PLANILLAS_TORNEO.find(p => p.id === zoom)
  return (
    <div style={{ border: `1px solid ${mostrarError && !value && requerido ? '#d93025' : '#e8eaed'}`, borderRadius: '10px', padding: '14px' }}>
      <div style={{ fontSize: '.85rem', fontWeight: '700', color: '#202124', marginBottom: '2px' }}>
        Planilla del torneo {requerido && <span style={{ color: '#d93025' }}>*</span>}
      </div>
      <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '12px', lineHeight: 1.4 }}>
        Es la hoja que usan los árbitros para llenar cada partido. Compara las dos y escoge la que quieres para este torneo (toca la imagen para verla grande).
      </div>
      <div role="radiogroup" aria-label="Planilla del torneo" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', paddingTop: '6px' }}>
        {PLANILLAS_TORNEO.map(p => (
          <Tarjeta key={p.id} planilla={p} elegida={value === p.id} onElegir={onChange} onZoom={setZoom}/>
        ))}
      </div>
      {mostrarError && !value && requerido && (
        <div style={{ marginTop: '10px', fontSize: '.78rem', fontWeight: '600', color: '#d93025' }}>Escoge una planilla para continuar</div>
      )}
      {planillaZoom && (
        <ModalZoom planilla={planillaZoom} elegida={value === planillaZoom.id} onElegir={onChange} onClose={() => setZoom(null)}/>
      )}
    </div>
  )
}
