import { useEffect, useRef } from 'react'

// Caja arrastrable/agrandable para UBICAR un logo de patrocinador del
// torneo, SOLO en la vista previa de quien transmite (ver
// AdminConfigSitioPage) — mientras se está editando, nadie más la ve; recién
// cuando se aprieta "Publicar" (fuera de este componente) el logo sale en
// esa posición para todo el mundo. Se arrastra desde cualquier parte del
// logo para moverlo, y desde el puntito de la esquina para agrandarlo o
// achicarlo — las dos cosas en porcentaje del tamaño del video, no en
// píxeles, para que se vea igual de bien en cualquier pantalla.
export default function EditorLogoPatrocinadorTorneo({ logo, onMover }) {
  const cajaRef = useRef(null)
  const arrastreRef = useRef(null) // { tipo: 'mover'|'agrandar', inicioX, inicioY, logoInicio }

  function empezarArrastre(e, tipo) {
    e.stopPropagation()
    e.preventDefault()
    arrastreRef.current = { tipo, inicioX: e.clientX, inicioY: e.clientY, logoInicio: { ...logo } }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  function mover(e) {
    const arrastre = arrastreRef.current
    const padre = cajaRef.current?.parentElement
    if (!arrastre || !padre) return
    const rect = padre.getBoundingClientRect()
    const dxPct = ((e.clientX - arrastre.inicioX) / rect.width) * 100
    const dyPct = ((e.clientY - arrastre.inicioY) / rect.height) * 100
    const { logoInicio } = arrastre
    if (arrastre.tipo === 'mover') {
      onMover({ x: Math.min(96, Math.max(0, logoInicio.x + dxPct)), y: Math.min(96, Math.max(0, logoInicio.y + dyPct)) })
    } else {
      onMover({ ancho: Math.min(80, Math.max(6, logoInicio.ancho + dxPct)) })
    }
  }
  function soltar() {
    arrastreRef.current = null
    window.removeEventListener('pointermove', mover)
    window.removeEventListener('pointerup', soltar)
  }
  // Por si se desmonta (cambia de pestaña, se deja de editar) a mitad de un
  // arrastre — sin esto, los listeners de window se quedarían pegados.
  useEffect(() => () => {
    window.removeEventListener('pointermove', mover)
    window.removeEventListener('pointerup', soltar)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mover/soltar son los mismos durante toda la vida del componente
  }, [])

  return (
    <div ref={cajaRef} onPointerDown={e => empezarArrastre(e, 'mover')}
      style={{ position:'absolute', left:`${logo.x}%`, top:`${logo.y}%`, width:`${logo.ancho}%`, zIndex:9, cursor:'move', touchAction:'none' }}>
      <div style={{ position:'relative', border:'2px dashed #fff', borderRadius:'6px', boxShadow:'0 0 0 2000px rgba(0,0,0,.25)' }}>
        <img src={logo.url} alt="" draggable={false} style={{ width:'100%', height:'auto', display:'block', opacity:.92 }}/>
        <div onPointerDown={e => empezarArrastre(e, 'agrandar')}
          style={{ position:'absolute', right:'-9px', bottom:'-9px', width:'18px', height:'18px', borderRadius:'50%', background:'#fff', border:'2px solid #1a73e8', cursor:'nwse-resize', touchAction:'none' }}/>
      </div>
    </div>
  )
}
