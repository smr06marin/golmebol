import { useState } from 'react'
import { Megaphone, Image as IconoImagen, Film } from 'lucide-react'

// Botones para mostrar la publicidad de cada patrocinador en la transmisión.
// Por patrocinador: "Presenta" (logo + nombre), "Banner" (si subió banners) y
// "Video" (si subió video). Arriba se elige el tamaño del video:
// Auto (grande en el descanso, pequeño mientras se juega) | Grande | Pequeño.
// onMostrar(patrocinadorId, tipo, tamano)
const S = { border: '#2a2a2a', green: '#6fcf3d', text: '#fff', muted: '#9aa0a6' }

export default function BotonesPatrocinadores({ patrocinadores, onMostrar, denso = false }) {
  const [tamano, setTamano] = useState('auto')
  const hayVideo = patrocinadores.some(p => p.video_url)
  const pad = denso ? '8px 12px' : '10px 14px'
  const fuente = denso ? '.76rem' : '.8rem'
  const boton = { display: 'flex', alignItems: 'center', gap: '5px', padding: pad, background: '#2a2a2a', border: `1px solid ${S.border}`, borderRadius: '8px', cursor: 'pointer', color: S.text, fontSize: fuente, fontWeight: 700 }
  return (
    <div>
      {hayVideo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{ fontSize: '.7rem', color: S.muted, fontWeight: 600 }}>TAMAÑO DEL VIDEO</span>
          {[['auto', 'Auto'], ['grande', 'Grande'], ['pequeno', 'Pequeño']].map(([v, t]) => (
            <button key={v} type="button" onClick={() => setTamano(v)}
              style={{ padding: '6px 11px', borderRadius: '999px', border: `1px solid ${tamano === v ? S.green : S.border}`, background: tamano === v ? 'rgba(111,207,61,.15)' : 'transparent', color: tamano === v ? S.green : S.muted, fontSize: '.72rem', fontWeight: 800, cursor: 'pointer' }}>{t}</button>
          ))}
          <span style={{ fontSize: '.66rem', color: S.muted, flexBasis: '100%' }}>Auto: grande en el descanso, pequeño en una esquina mientras se juega.</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {patrocinadores.map(p => {
          const nBanners = Array.isArray(p.banners) ? p.banners.filter(Boolean).length : 0
          return (
            <div key={p.id}>
              <div style={{ fontSize: '.72rem', color: S.text, fontWeight: 800, marginBottom: '5px' }}>{p.nombre}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onMostrar(p.id, 'logo', tamano)} style={boton}><Megaphone size={13}/> Presenta</button>
                {nBanners > 0 && (
                  <button type="button" onClick={() => onMostrar(p.id, 'banner', tamano)} style={boton}><IconoImagen size={13}/> Banner{nBanners > 1 ? ` (${nBanners})` : ''}</button>
                )}
                {p.video_url && (
                  <button type="button" onClick={() => onMostrar(p.id, 'video', tamano)} style={boton}><Film size={13}/> Video</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
