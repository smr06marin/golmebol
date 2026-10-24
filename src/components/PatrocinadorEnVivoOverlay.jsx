import { useCallback, useEffect, useRef, useState } from 'react'
import { tamanoVideoEfectivo, DURACION_LOGO_MS, DURACION_BANNER_MS, DURACION_MAXIMA_VIDEO_MS } from '../lib/patrocinadorDisparo'

// Publicidad de un patrocinador, encima del video en vivo — disparada a
// propósito desde el panel de control (botones por patrocinador), nunca
// automática. Tiene tres formas (prop `tipo`):
//
//  · 'logo'   (el de siempre) franja con logo + "PRESENTA" + nombre, 8 segundos.
//  · 'banner' franja de abajo, ancho completo, con cada imagen del patrocinador
//             (campo `banners`) durante 10 segundos. Si hay varias salen todas,
//             una detrás de otra, solas.
//  · 'video'  el video corto del patrocinador (campo `video_url`):
//               - GRANDE y centrado (en el descanso, con la transmisión de fondo), o
//               - PEQUEÑO arriba a la derecha, sin tapar el marcador, mientras se juega.
//             `tamano` = 'auto' (grande si `descanso`, pequeño si no) | 'grande' | 'pequeno'.
//             Se quita solo cuando el video termina.
//
// Cuando termina llama a `onTerminar` para que quien lo muestra lo saque.
// `silencio`: true en las vistas web públicas (el navegador no deja reproducir
// con sonido sin que la persona toque); el overlay de OBS lo deja con sonido.
const ROJO_VIVO = '#e5433d'

// onTerminar llega como función nueva en cada dibujo de la página; esto la vuelve
// estable para que los temporizadores no se reinicien con cada refresco.
function useFnEstable(fn) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  return useCallback((...a) => ref.current?.(...a), [])
}

function Logo({ patrocinador, onTerminar: alTerminar }) {
  const onTerminar = useFnEstable(alTerminar)
  useEffect(() => {
    const t = setTimeout(() => onTerminar?.(), DURACION_LOGO_MS)
    return () => clearTimeout(t)
  }, [onTerminar])
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3,
      width: 'min(94%, 420px)', boxSizing: 'border-box', pointerEvents: 'none',
      background: 'rgba(6,6,8,.94)', borderRadius: '10px 10px 0 0', boxShadow: '0 -3px 14px rgba(0,0,0,.5)',
      padding: 'clamp(8px, 2.4vw, 14px)', borderTop: `2px solid ${ROJO_VIVO}`,
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      {patrocinador.logo_url && (
        <div style={{ width: 'clamp(36px, 10vw, 54px)', height: 'clamp(36px, 10vw, 54px)', borderRadius: '8px', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={patrocinador.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/>
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'clamp(.5rem, 2vw, .6rem)', fontWeight: 900, color: '#f5a623', letterSpacing: '.08em', marginBottom: '2px' }}>
          PRESENTA
        </div>
        <div style={{ fontSize: 'clamp(.68rem, 2.8vw, .88rem)', fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {patrocinador.nombre}
        </div>
      </div>
    </div>
  )
}

function Banners({ patrocinador, onTerminar: alTerminar }) {
  const onTerminar = useFnEstable(alTerminar)
  const lista = Array.isArray(patrocinador.banners) ? patrocinador.banners.filter(Boolean) : []
  const [i, setI] = useState(0)
  // Banner "de pantalla completa": una imagen 16:9 transparente (ej. 1920x1080) con el banner ya ubicado
  // abajo y un margen vacío alrededor. Esa se pone cubriendo TODO el video (el banner queda donde lo
  // diseñaron, sin recuadro). Una imagen de otra forma (una franja) sale centrada abajo, como antes.
  const [completo, setCompleto] = useState({})
  useEffect(() => {
    if (!lista.length) { onTerminar?.(); return }
    const t = setTimeout(() => {
      if (i + 1 >= lista.length) onTerminar?.()
      else setI(i + 1)
    }, DURACION_BANNER_MS)
    return () => clearTimeout(t)
  }, [i, lista.length, onTerminar])
  if (!lista.length) return null
  const alCargar = e => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
    const razon = h ? w / h : 0
    setCompleto(m => ({ ...m, [i]: razon > 1.6 && razon < 1.95 }))
  }
  const listo = completo[i] !== undefined
  const pantallaCompleta = completo[i] === true
  return (
    <div style={pantallaCompleta
      ? { position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }
      : { position: 'absolute', left: 0, right: 0, bottom: '3%', zIndex: 3, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <style>{'@keyframes gmBannerEntra{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}'}</style>
      <img key={i} src={lista[i]} alt={patrocinador.nombre || ''} onLoad={alCargar}
        style={pantallaCompleta
          ? { display: 'block', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom', animation: 'gmBannerEntra .35s ease-out both' }
          : { display: 'block', width: 'min(96%, 640px)', maxHeight: '34vh', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.55))', animation: 'gmBannerEntra .35s ease-out both', opacity: listo ? 1 : 0 }}/>
    </div>
  )
}

function Video({ patrocinador, tamano, descanso, silencio, onTerminar: alTerminar, onSonido }) {
  const onTerminar = useFnEstable(alTerminar)
  const avisarSonido = useFnEstable(onSonido)
  const ref = useRef(null)
  const grande = tamanoVideoEfectivo(tamano, descanso) === 'grande'
  useEffect(() => {
    const t = setTimeout(() => onTerminar?.(), DURACION_MAXIMA_VIDEO_MS)
    return () => clearTimeout(t)
  }, [onTerminar])
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const p = v.play()
    if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => onTerminar?.()) }) // sin permiso para sonido: se intenta mudo
  }, [onTerminar])
  // Avisa a quien lo muestra cuando el video suena de verdad (para bajarle el volumen al en vivo) y cuando deja de sonar
  useEffect(() => {
    const v = ref.current
    if (!v) return undefined
    const avisar = () => avisarSonido?.(!v.muted && !v.paused && !v.ended)
    const eventos = ['playing', 'pause', 'ended', 'volumechange']
    eventos.forEach(e => v.addEventListener(e, avisar))
    return () => { eventos.forEach(e => v.removeEventListener(e, avisar)); avisarSonido?.(false) }
  }, [avisarSonido])
  if (!patrocinador.video_url) return null
  const video = (
    <video ref={ref} src={patrocinador.video_url} autoPlay playsInline muted={!!silencio} preload="auto"
      onEnded={() => onTerminar?.()} onError={() => onTerminar?.()}
      style={grande
        ? { display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', background: '#000', boxShadow: '0 8px 30px rgba(0,0,0,.6)' }
        : { display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', background: '#000' }}/>
  )
  if (grande) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', pointerEvents: 'none', padding: '5%', boxSizing: 'border-box' }}>
        <div style={{ width: 'min(100%, 760px)', maxHeight: '100%', display: 'flex', justifyContent: 'center' }}>{video}</div>
      </div>
    )
  }
  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 3, width: 'clamp(110px, 26%, 300px)', maxHeight: '45%', display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none', border: '1px solid rgba(255,255,255,.35)', borderRadius: '9px', boxShadow: '0 3px 14px rgba(0,0,0,.55)', overflow: 'hidden', background: '#000' }}>
      {video}
    </div>
  )
}

export default function PatrocinadorEnVivoOverlay({ patrocinador, tipo = 'logo', tamano = 'auto', descanso = false, silencio = false, onTerminar, onSonido }) {
  if (!patrocinador) return null
  if (tipo === 'banner') return <Banners patrocinador={patrocinador} onTerminar={onTerminar}/>
  if (tipo === 'video') return <Video patrocinador={patrocinador} tamano={tamano} descanso={descanso} silencio={silencio} onTerminar={onTerminar} onSonido={onSonido}/>
  return <Logo patrocinador={patrocinador} onTerminar={onTerminar}/>
}
