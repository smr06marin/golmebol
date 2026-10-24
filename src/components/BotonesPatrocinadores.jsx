import { useState } from 'react'
import { Megaphone, Image as IconoImagen, Film, Square } from 'lucide-react'
import { ID_TODOS_BANNERS, todosLosBanners } from '../lib/patrocinadorDisparo'

// Botones para mostrar la publicidad de los patrocinadores en la transmisión.
//  · ENCENDER BANNERS (uno solo, de todos): salen los banners de TODOS los patrocinadores,
//    uno tras otro como un video (10 s cada uno). Se apagan solos al terminar los últimos,
//    o tocando el mismo botón otra vez.
//  · Por patrocinador: "Presenta" (logo + nombre, 8 s) y "Video" (si subió video).
// El botón de lo que está EN PANTALLA se pone verde y dice "Quitar": tocarlo lo apaga.
// Arriba se elige el tamaño del video: Auto (grande en el descanso, pequeño mientras se juega) | Grande | Pequeño.
//
// activo: { id, tipo } de lo que se está mostrando ahora (o null) · onMostrar(id, tipo, tamano) · onApagar()
const S = { border: '#2a2a2a', green: '#6fcf3d', text: '#fff', muted: '#9aa0a6' }

export default function BotonesPatrocinadores({ patrocinadores, onMostrar, onApagar, activo = null, denso = false }) {
  const [tamano, setTamano] = useState('auto')
  const hayVideo = patrocinadores.some(p => p.video_url)
  const nBanners = todosLosBanners(patrocinadores).length
  const pad = denso ? '8px 12px' : '10px 14px'
  const fuente = denso ? '.76rem' : '.8rem'
  const boton = on => ({
    display: 'flex', alignItems: 'center', gap: '5px', padding: pad, borderRadius: '8px', cursor: 'pointer', fontSize: fuente, fontWeight: 700,
    background: on ? S.green : '#2a2a2a', border: `1px solid ${on ? S.green : S.border}`, color: on ? '#0a0a0a' : S.text,
  })
  const esActivo = (id, tipo) => !!activo && activo.id === id && activo.tipo === tipo
  // Tocar el botón de lo que ya está en pantalla lo apaga; si no, lo muestra
  const pulsar = (id, tipo) => (esActivo(id, tipo) && onApagar ? onApagar() : onMostrar(id, tipo, tamano))
  const bannersOn = esActivo(ID_TODOS_BANNERS, 'banner')
  return (
    <div>
      {nBanners > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <button type="button" onClick={() => pulsar(ID_TODOS_BANNERS, 'banner')} style={{ ...boton(bannersOn), fontWeight: 800 }}>
            {bannersOn ? <Square size={13} fill="currentColor"/> : <IconoImagen size={13}/>}
            {bannersOn ? 'APAGAR BANNERS (están saliendo)' : `ENCENDER BANNERS (${nBanners})`}
          </button>
          <div style={{ fontSize: '.66rem', color: S.muted, marginTop: '5px', lineHeight: 1.4 }}>
            Salen los banners de todos los patrocinadores, uno tras otro, 10 s cada uno. Se apagan solos al terminar, o toca el botón otra vez para apagarlos antes.
          </div>
        </div>
      )}
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
          const logoOn = esActivo(p.id, 'logo')
          const videoOn = esActivo(p.id, 'video')
          return (
            <div key={p.id}>
              <div style={{ fontSize: '.72rem', color: S.text, fontWeight: 800, marginBottom: '5px' }}>{p.nombre}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => pulsar(p.id, 'logo')} style={boton(logoOn)}>
                  {logoOn ? <Square size={13} fill="currentColor"/> : <Megaphone size={13}/>} {logoOn ? 'Quitar' : 'Presenta'}
                </button>
                {p.video_url && (
                  <button type="button" onClick={() => pulsar(p.id, 'video')} style={boton(videoOn)}>
                    {videoOn ? <Square size={13} fill="currentColor"/> : <Film size={13}/>} {videoOn ? 'Quitar video' : 'Video'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
