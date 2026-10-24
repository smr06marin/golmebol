import { useEffect, useId, useRef, useState } from 'react'
import { cargarYouTubeAPI, parseYouTubeId } from './LiveEmbed'

// Repetición DENTRO de la transmisión (para Prism Live / OBS).
//
// El overlay de Prism es una página web que se dibuja encima de la cámara, y
// esa página no puede grabar el video de la cámara. Lo que SÍ puede hacer es
// abrir (escondido) la propia transmisión de YouTube, devolverla `atras`
// segundos y mostrarla a pantalla completa con el letrero REPETICIÓN; como el
// overlay sale dentro del video que Prism manda a YouTube, la repetición la
// ve todo el mundo. Se monta SOLO cuando se aprieta el botón (no gasta datos
// el resto del partido) y se desmonta al terminar.
//
// Requisitos: la transmisión de YouTube tiene que tener el DVR activado
// (en YouTube Studio → Transmitir → Configuración → "Habilitar DVR"), si no
// YouTube no deja devolverse y la repetición se cancela sola, sin mostrar nada.
//
// Cuándo arranca: YouTube muestra la transmisión con unos segundos de retraso,
// así que lo que pasó hace un instante (cuando se apretó el botón) todavía no
// llega al reproductor. Por eso se espera `espera` segundos y recién ahí se
// devuelve `atras` segundos desde el borde en vivo: así la repetición cubre
// justo la jugada que acaba de pasar. Mientras, la transmisión sigue normal.
//
// Fases (data-fase): 'cargando' (escondido) → 'bumper' (imagen de repetición
// de /admin/config-sitio, si hay) → 'video' (repetición + letrero) → 'saliendo'.

const ESTADO_REPRODUCIENDO = 1
const BUMPER_MS = 2500
const SALE_MS = 500
const SEGURO_MS = 60000

export default function RepeticionTransmisionOverlay({ url, disparo, atras = 12, espera = 8, onTerminar }) {
  const [fase, setFase] = useState('cargando')
  const idIframe = `yt-repe-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const onTerminarRef = useRef(onTerminar)
  useEffect(() => { onTerminarRef.current = onTerminar })
  const videoId = parseYouTubeId(url)
  const imagenUrl = disparo?.imagenUrl || null
  const lento = !!disparo?.camaraLenta
  const key = disparo?.key

  useEffect(() => {
    if (!videoId) { onTerminarRef.current?.(); return undefined }
    const velocidad = lento ? 0.5 : 1
    const timers = []
    let cancelado = false
    let player = null
    const t0 = Date.now()
    let reprodujo = false, saltado = false, saltoEn = 0, revelado = false
    const terminar = () => { if (!cancelado) { cancelado = true; onTerminarRef.current?.() } }
    const despues = (fn, ms) => timers.push(setTimeout(fn, Math.max(0, ms)))

    // Muestra la repetición: con imagen de apertura si hay (tapa el buffering), y después el video.
    function revelar() {
      if (revelado || cancelado) return
      revelado = true
      // El salto no funcionó (sin DVR): el video seguiría en el borde en vivo → no mostrar nada.
      try {
        const ahora = player.getCurrentTime(), dur = player.getDuration()
        if (!(dur - ahora > atras * velocidad * 0.5)) return terminar()
      } catch { return terminar() }
      const hastaBumper = imagenUrl ? Math.max(0, BUMPER_MS - (Date.now() - saltoEn)) : 0
      despues(() => {
        if (cancelado) return
        setFase('video')
        despues(() => {
          if (cancelado) return
          try { if (lento) player.setPlaybackRate(1) } catch { /* nada */ }
          setFase('saliendo')
          despues(terminar, SALE_MS)
        }, atras * 1000)
      }, hastaBumper)
    }

    function saltar() {
      if (saltado || cancelado) return
      saltado = true
      let dur = 0
      try { dur = player.getDuration() } catch { /* nada */ }
      if (!dur || !isFinite(dur)) return terminar()
      // Con imagen de apertura, parte del video corre escondido debajo de ella: se retrocede un poco más.
      const retroceso = (atras + (imagenUrl ? BUMPER_MS / 1000 : 0)) * velocidad
      saltoEn = Date.now()
      try {
        player.seekTo(Math.max(0, dur - retroceso), true)
        if (lento) player.setPlaybackRate(0.5)
      } catch { return terminar() }
      if (imagenUrl) setFase('bumper')
      // Cuando YouTube termina de cargar el tramo, se muestra; si tarda demasiado, igual.
      despues(revelar, 4000)
    }

    function intentarSaltar() {
      if (reprodujo && Date.now() - t0 >= espera * 1000) saltar()
    }

    cargarYouTubeAPI().then(YT => {
      if (cancelado || !YT || !document.getElementById(idIframe)) return
      player = new YT.Player(idIframe, {
        events: {
          onReady: () => { try { player.mute(); player.playVideo() } catch { /* nada */ } },
          onStateChange: e => {
            if (e.data !== ESTADO_REPRODUCIENDO) return
            if (!reprodujo) { reprodujo = true; despues(intentarSaltar, espera * 1000 - (Date.now() - t0)); intentarSaltar() }
            else if (saltado) despues(revelar, 700)
          },
          onError: ev => { console.warn('[Repetición] YouTube no dejó controlar el video (código', ev?.data, ')'); terminar() },
        },
      })
    })
    despues(terminar, SEGURO_MS)

    return () => {
      cancelado = true
      timers.forEach(clearTimeout)
      try { player?.destroy?.() } catch { /* nada */ }
    }
  }, [key, videoId, lento, imagenUrl, atras, espera, idIframe])

  if (!videoId) return null
  const origen = typeof window !== 'undefined' ? window.location.origin : ''
  const params = `enablejsapi=1&origin=${encodeURIComponent(origen)}&autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`
  const visible = fase === 'bumper' || fase === 'video'
  return (
    <div data-fase={fase} style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, background: '#000', overflow: 'hidden',
      pointerEvents: 'none', opacity: visible ? 1 : 0, transition: fase === 'saliendo' ? `opacity ${SALE_MS}ms ease` : 'none',
    }}>
      <iframe id={idIframe} title="Repetición" src={`https://www.youtube.com/embed/${videoId}?${params}`}
        allow="autoplay; encrypted-media" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}/>
      {fase === 'video' && (
        <div style={{ position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(6,6,8,.92)', borderRadius: '8px', padding: '6px 16px', boxShadow: '0 2px 12px rgba(0,0,0,.5)' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#e5433d', animation: 'gmMicPulso 1s ease-in-out infinite' }}/>
          <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', letterSpacing: '.08em', whiteSpace: 'nowrap', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>REPETICIÓN{lento ? ' · CÁMARA LENTA' : ''}</span>
        </div>
      )}
      {fase === 'bumper' && imagenUrl && (
        <div className="gm-repeticion-entra" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3, background: '#000' }}>
          <img src={imagenUrl} alt="Repetición" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        </div>
      )}
    </div>
  )
}
