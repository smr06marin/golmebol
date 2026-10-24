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

export default function RepeticionTransmisionOverlay({ url, disparo, atras = 12, espera = 8, velocidad = 0.7, onTerminar, onEstado }) {
  const [fase, setFase] = useState('cargando')
  const idIframe = `yt-repe-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const onTerminarRef = useRef(onTerminar)
  const onEstadoRef = useRef(onEstado)
  useEffect(() => { onTerminarRef.current = onTerminar; onEstadoRef.current = onEstado })
  const videoId = parseYouTubeId(url)
  const imagenUrl = disparo?.imagenUrl || null
  const lento = !!disparo?.camaraLenta
  const key = disparo?.key

  useEffect(() => {
    if (!videoId) { onEstadoRef.current?.('cancelada: el link de la transmisión no es un video de YouTube'); onTerminarRef.current?.(); return undefined }
    // `atras` son segundos de JUEGO. A velocidad normal-lenta (0.7) la repetición cubre esos
    // segundos completos (y dura más en pantalla); la cámara lenta (0.5, botón aparte) cubre la mitad.
    const velPedida = lento ? 0.5 : velocidad
    const contenido = lento ? atras * 0.5 : atras
    let velReal = velPedida
    const timers = []
    let cancelado = false
    let player = null
    const t0 = Date.now()
    let reprodujo = false, saltado = false, saltoEn = 0, revelado = false, cabezaAntes = 0
    const estado = m => onEstadoRef.current?.(m)
    const terminar = (motivo) => { if (!cancelado) { cancelado = true; if (motivo) estado(motivo); onTerminarRef.current?.() } }
    const despues = (fn, ms) => timers.push(setTimeout(fn, Math.max(0, ms)))

    // Muestra la repetición: con imagen de apertura si hay (tapa el buffering), y después el video.
    function revelar() {
      if (revelado || cancelado) return
      revelado = true
      // El salto no funcionó (sin DVR): el video seguiría en el borde en vivo → no mostrar nada.
      try {
        // Si el salto funcionó, el video va ~`contenido` segundos detrás de donde estaría sin saltar.
        const ahora = player.getCurrentTime()
        const transcurrido = (Date.now() - saltoEn) / 1000
        const sinSaltar = cabezaAntes + transcurrido
        if (!(sinSaltar - ahora > contenido * 0.5)) return terminar(`cancelada: YouTube no dejó retroceder (¿DVR apagado?). posición ${ahora.toFixed(0)}s, en vivo ${sinSaltar.toFixed(0)}s`)
        estado(`mostrando (retrocedió ${(sinSaltar - ahora).toFixed(0)}s)`)
      } catch { return terminar('cancelada: error leyendo la posición del video') }
      const hastaBumper = imagenUrl ? Math.max(0, BUMPER_MS - (Date.now() - saltoEn)) : 0
      despues(() => {
        if (cancelado) return
        setFase('video')
        despues(() => {
          if (cancelado) return
          try { if (velReal !== 1) player.setPlaybackRate(1) } catch { /* nada */ }
          setFase('saliendo')
          despues(() => terminar('terminó'), SALE_MS)
        }, Math.round((contenido / velReal) * 1000))
      }, hastaBumper)
    }

    function saltar() {
      if (saltado || cancelado) return
      saltado = true
      let cabeza = 0
      try { cabeza = player.getCurrentTime() } catch { /* nada */ }
      if (!cabeza || !isFinite(cabeza)) return terminar('cancelada: el reproductor no dio la posición del video')
      cabezaAntes = cabeza
      // Velocidad: YouTube a veces solo acepta ciertos pasos (0.25, 0.5, 0.75, 1…); se usa el más cercano.
      try {
        if (velPedida !== 1) {
          player.setPlaybackRate(velPedida)
          const disp = player.getAvailablePlaybackRates?.()
          if (Array.isArray(disp) && disp.length && !disp.includes(velPedida)) {
            velReal = disp.reduce((a, b) => (Math.abs(b - velPedida) < Math.abs(a - velPedida) ? b : a))
            player.setPlaybackRate(velReal)
          }
        }
      } catch { /* nada */ }
      // Con imagen de apertura, parte del video corre escondido debajo de ella: se retrocede un poco más.
      const retroceso = contenido + (imagenUrl ? (BUMPER_MS / 1000) * velReal : 0)
      saltoEn = Date.now()
      estado(`retrocediendo ${retroceso.toFixed(0)}s (velocidad ${velReal})…`)
      try { player.seekTo(Math.max(0, cabeza - retroceso), true) } catch { return terminar('cancelada: seekTo falló') }
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
          onReady: () => { estado('reproductor listo, iniciando video…'); try { player.mute(); player.playVideo() } catch { /* nada */ } },
          onStateChange: e => {
            if (e.data !== ESTADO_REPRODUCIENDO) return
            if (!reprodujo) { reprodujo = true; estado(`video reproduciendo, esperando ${espera}s…`); despues(intentarSaltar, espera * 1000 - (Date.now() - t0)); intentarSaltar() }
            else if (saltado) despues(revelar, 700)
          },
          onError: ev => { console.warn('[Repetición] YouTube no dejó controlar el video (código', ev?.data, ')'); terminar(`cancelada: error de YouTube (código ${ev?.data})`) },
        },
      })
    })
    estado('cargando YouTube…')
    despues(() => terminar(reprodujo ? 'cancelada: tiempo agotado' : 'cancelada: el video no arrancó (¿autoplay bloqueado en este navegador?)'), SEGURO_MS)

    return () => {
      cancelado = true
      timers.forEach(clearTimeout)
      try { player?.destroy?.() } catch { /* nada */ }
    }
  }, [key, videoId, lento, imagenUrl, atras, espera, velocidad, idIframe])

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
