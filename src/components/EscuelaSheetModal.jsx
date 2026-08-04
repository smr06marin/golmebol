import { X } from 'lucide-react'

const S = { card: '#111827', border: '#1e2d3d', muted: '#7a9ab5' }

// Hoja que sube desde abajo — mismo modal para todo el portal de escuela
// (se abre al tocar una tarjeta cuadrada: trae el formulario o el detalle
// de esa sección).
export default function EscuelaSheetModal({ titulo, subtitulo, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:600, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:S.card, borderTop:`1px solid ${S.border}`, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'560px', maxHeight:'88vh', overflowY:'auto', padding:'18px 18px 26px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:14 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'.95rem', color:'#fff' }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize:'.7rem', color:S.muted, marginTop:2 }}>{subtitulo}</div>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, display:'flex', flexShrink:0 }}><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}
