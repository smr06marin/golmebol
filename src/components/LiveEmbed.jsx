import { useEffect, useId, useRef, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

// Saca el ID del video de cualquier formato de link de YouTube: watch?v=,
// youtu.be/, /embed/, /live/, /shorts/. Si no reconoce el formato (por
// ejemplo si le pasan el link del CANAL en vez del video/live puntual),
// devuelve null y se cae al botón "Ver en vivo" en vez de un embed roto.
function parseYouTubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/\/(embed|live|shorts)\/([^/?]+)/)
      if (m) return m[2]
    }
  } catch {}
  return null
}

export function detectarPlataforma(url) {
  if (!url) return null
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook'
  if (/instagram\.com/i.test(url)) return 'instagram'
  return 'otro'
}

function LinkFallback({ url, S }) {
  return (
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'40px 20px', borderRadius:'16px', background:S.card, border:`1px solid ${S.red}55`, color:S.red, fontWeight:800, textDecoration:'none', fontSize:'.9rem' }}>
      ▶ Ver en vivo
    </a>
  )
}

// Botón propio de pantalla completa (en vez del que trae YouTube/Facebook
// adentro del iframe) — ver comentario grande más abajo sobre por qué.
function BotonPantallaCompleta({ activo, onClick }) {
  return (
    <button onClick={onClick} aria-label={activo ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
      style={{ position:'absolute', top:'10px', right:'10px', zIndex:3, width:'34px', height:'34px', borderRadius:'50%',
        border:'none', background:'rgba(0,0,0,.55)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
      {activo ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
    </button>
  )
}

// Etiqueta fija al centro-izquierda del video mientras dura la repetición
// del gol — para que quien esté viendo sepa que lo que aparece no es un
// momento nuevo del partido sino la jugada de hace unos segundos. Va al
// centro vertical (no arriba, donde ya está el marcador) durante toda la
// repetición.
function EtiquetaRepeticion() {
  return (
    <div style={{ position:'absolute', top:'50%', left:'10px', transform:'translateY(-50%)', zIndex:5, display:'flex', alignItems:'center', gap:'6px', background:'rgba(6,6,8,.92)', borderRadius:'7px', padding:'4px 10px', pointerEvents:'none', boxShadow:'0 2px 10px rgba(0,0,0,.45)' }}>
      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#e5433d', flexShrink:0, animation:'gmMicPulso 1s ease-in-out infinite' }}/>
      <span style={{ fontSize:'clamp(.55rem,2.2vw,.66rem)', fontWeight:900, color:'#fff', letterSpacing:'.03em', whiteSpace:'nowrap' }}>REPETICIÓN</span>
    </div>
  )
}

// La gráfica que tapa el video un instante justo cuando empieza la
// repetición — se sube desde /admin/config-sitio (junto con el link de la
// transmisión), se puede subir varias y van rotando en orden. Entra y sale
// con transición (ver .gm-repeticion-entra / .gm-repeticion-sale en
// index.css); `fase` controla cuál de las dos animaciones se ve en cada
// momento.
function BumperRepeticion({ fase, imagenUrl }) {
  return (
    <div className={fase === 'sale' ? 'gm-repeticion-sale' : 'gm-repeticion-entra'}
      style={{ position:'absolute', inset:0, zIndex:6, background:'#000', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', pointerEvents:'none' }}>
      <img src={imagenUrl} alt="Repetición" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
    </div>
  )
}

// Cierre de TODA repetición (haya o no gráfica de patrocinador al principio):
// justo cuando toca volver al momento en vivo real, el logo de Golmebol
// aparece SOLO (sin fondo, se ve el video detrás) y se va agrandando cada
// vez más rápido hasta desvanecerse — la propia ampliada sirve de
// transición hacia el video ya en vivo al día, en vez de un corte brusco.
// El salto de verdad (seekTo) se hace a la mitad de esa animación, cuando
// el logo está más grande y más lleno de la pantalla. Va por encima de
// todo lo demás (etiqueta, gráfica de apertura).
function BumperCierre() {
  return (
    <div style={{ position:'absolute', inset:0, zIndex:7, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
      <img src="/marca/logo-cierre-repeticion.png" alt="Golmebol" className="gm-cierre-logo"
        style={{ width:'42%', maxWidth:'300px', height:'auto' }}/>
    </div>
  )
}

const cajaNormal = { position:'relative', paddingBottom:'56.25%', height:0, borderRadius:'16px', overflow:'hidden', background:'#000' }
const cajaCompleta = { position:'fixed', inset:0, zIndex:9999, background:'#000', borderRadius:0 }

// Carga el script oficial del reproductor de YouTube controlable por
// JavaScript (IFrame Player API) una sola vez, sin importar cuántos
// <LiveEmbed> de YouTube haya montados a la vez (puede haber varios si hay
// varias transmisiones activas) — todos comparten la misma promesa/script.
let promesaYouTubeAPI = null
function cargarYouTubeAPI() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (promesaYouTubeAPI) return promesaYouTubeAPI
  promesaYouTubeAPI = new Promise(resolve => {
    const anterior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { anterior?.(); resolve(window.YT) }
    if (!document.getElementById('youtube-iframe-api')) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }
  })
  return promesaYouTubeAPI
}

// Embebe un link de "en vivo" — YouTube se muestra directo en un iframe
// (lo más confiable, no necesita API key). Facebook usa su plugin público
// de video (tampoco necesita API key, pero solo funciona bien con videos de
// una Página pública). Instagram necesita su script oficial de embeds — se
// carga una sola vez y se le pide procesar el bloque cada vez que cambia el
// link. Si no se reconoce la plataforma, o el link de YouTube no trae un ID
// de video reconocible (por ejemplo si pegaron el link del canal en vez del
// video puntual), se muestra un botón que abre el link en una pestaña
// nueva en vez de dejar un cuadro roto.
//
// `overlay` (opcional): algo para dibujar ENCIMA del video — hoy es el
// marcador en vivo (ver MarcadorEnVivoOverlay). No se usa el botón de
// pantalla completa NATIVO de YouTube/Facebook para esto: ese botón le pide
// al navegador poner en pantalla completa solo el <iframe> del reproductor,
// y todo lo que esté AFUERA del iframe (el marcador, que es un div hermano)
// desaparece. Por eso acá se apaga ese botón nativo (se quita
// `allowFullScreen`) y se pone uno propio que agranda esta CAJA completa
// (video + marcador juntos) con CSS, no con la API de pantalla completa del
// navegador — esa API además no funciona bien para esto en Safari de
// iPhone, así que este método funciona igual en todos los celulares.
//
// `repeticion` (opcional): { key, segundos, imagenUrl } — cada vez que
// `key` cambia (LandingPage lo cambia apenas detecta un gol nuevo): si hay
// una imagen de repetición cargada (desde /admin/config-sitio, rotan en
// orden si hay varias), esa imagen tapa el video un instante con
// transición de entrada y salida; mientras dura toda la repetición, al
// centro-izquierda queda la etiqueta "REPETICIÓN" para que se sepa que no
// es un momento nuevo del partido. En YouTube, además, el video de verdad
// se rebobina `segundos` (usando la IFrame Player API en vez del <iframe> a
// secas) y después de ese mismo tiempo vuelve solo al momento en vivo real
// — ese regreso siempre queda de transición con el logo de Golmebol
// agrandándose encima del video (ver BumperCierre), para que el salto no
// se note. En Facebook/Instagram no hay forma
// confiable de mover el video desde acá, así que ahí solo se ven la
// etiqueta y las dos gráficas (apertura y cierre), sin rebobinar de verdad.
export default function LiveEmbed({ url, titulo, S, overlay, repeticion }) {
  const plataforma = detectarPlataforma(url)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [mostrandoEtiqueta, setMostrandoEtiqueta] = useState(false) // "REPETICIÓN" al centro-izquierda, dura toda la repetición
  const [faseBumper, setFaseBumper] = useState(null) // null | 'entra' | 'sale' — la gráfica de repetición, solo al principio
  const [mostrandoCierre, setMostrandoCierre] = useState(false) // el logo de Golmebol agrandándose, al final, de transición hacia el en vivo
  const iframeRef = useRef(null)
  const ytPlayerRef = useRef(null)
  // Id propio para el iframe de YouTube (puede haber varios <LiveEmbed> a la
  // vez si hay varias transmisiones) — la IFrame Player API de YouTube solo
  // "adopta" un iframe ya existente de forma confiable cuando se le pasa el
  // ID en texto (así lo documenta YouTube), no la referencia al elemento.
  const idIframeYoutube = `yt-player-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    if (plataforma !== 'instagram') return
    function procesar() { window.instgrm?.Embeds?.process() }
    if (window.instgrm) { procesar(); return }
    const existente = document.getElementById('ig-embed-script')
    if (existente) { existente.addEventListener('load', procesar); return }
    const script = document.createElement('script')
    script.id = 'ig-embed-script'
    script.src = '//www.instagram.com/embed.js'
    script.async = true
    script.onload = procesar
    document.body.appendChild(script)
  }, [plataforma, url])

  // Solo en YouTube: crea el reproductor controlable por JS a partir del
  // mismo <iframe> que ya se está mostrando (necesita `enablejsapi=1` en su
  // link, ver más abajo). La API REEMPLAZA ese iframe por uno propio, así
  // que hay que volver a guardar la referencia con `getIframe()` — si no,
  // el chequeo de pantalla completa nativa de más abajo quedaría comparando
  // contra un elemento que ya no existe.
  useEffect(() => {
    if (plataforma !== 'youtube') return
    const id = parseYouTubeId(url)
    if (!id) return
    let cancelado = false
    let player = null
    cargarYouTubeAPI().then(YT => {
      if (cancelado || !YT || !document.getElementById(idIframeYoutube)) return
      player = new YT.Player(idIframeYoutube, {
        events: {
          onReady: () => {
            if (cancelado) return
            ytPlayerRef.current = player
            iframeRef.current = player.getIframe()
          },
          // Si YouTube no deja controlar este video puntual (pasa con algunos
          // videos/streams según cómo los configuró el dueño del canal), que
          // quede al menos en la consola — así no se ve como un error
          // "silencioso" si algún día hay que revisar por qué no rebobina.
          onError: e => console.warn('[LiveEmbed] YouTube player no se pudo controlar (código', e?.data, ')'),
        },
      })
    })
    return () => {
      cancelado = true
      ytPlayerRef.current = null
      if (player?.destroy) player.destroy()
    }
  }, [plataforma, url, idIframeYoutube])

  // Mientras está en nuestra pantalla completa: bloquea el scroll de fondo
  // (igual que cualquier modal de la app) y permite cerrarla con Escape.
  useEffect(() => {
    if (!pantallaCompleta) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) { if (e.key === 'Escape') setPantallaCompleta(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previo; window.removeEventListener('keydown', onKey) }
  }, [pantallaCompleta])

  // Red de seguridad: aunque ya quitamos "fullscreen" del `allow` del
  // iframe, algunos navegadores (sobre todo el navegador interno de apps
  // como WhatsApp/Instagram/Facebook) igual dejan pasar el botón nativo de
  // ampliar de YouTube/Facebook — y ahí el marcador desaparece porque el
  // navegador solo pone en pantalla completa el <iframe>, sin sus hermanos.
  // Por eso acá escuchamos el evento nativo: si detectamos que el que se
  // puso en pantalla completa es justo NUESTRO iframe, lo cancelamos al
  // instante y activamos nuestra propia pantalla completa (con CSS), que sí
  // incluye el marcador porque este vive adentro de la misma caja.
  useEffect(() => {
    function onFullscreenChange() {
      const el = document.fullscreenElement || document.webkitFullscreenElement
      if (el && iframeRef.current && el === iframeRef.current) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
        setPantallaCompleta(true)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [])

  // Dispara la repetición apenas cambia `repeticion.key` (un gol nuevo):
  // 1) de una, rebobina el video en YouTube (tapado por la gráfica de
  //    apertura si hay una, así el "salto" del rebobinado no se nota);
  // 2) la gráfica de apertura entra, se queda un momento y sale;
  // 3) la etiqueta "REPETICIÓN" se queda al centro-izquierda durante toda
  //    la repetición;
  // 4) al cabo de `segundos`, el logo de Golmebol aparece solo (sin fondo)
  //    encima del video y se va agrandando — a la mitad de esa animación,
  //    ya bien grande, el video vuelve por detrás al momento en vivo real,
  //    y el logo termina de agrandarse hasta desvanecerse mostrando el en
  //    vivo ya al día: la propia ampliada es la transición, en NINGUNA
  //    repetición se ve como un corte brusco (con o sin gráfica de
  //    apertura, y también en Facebook/Instagram, donde no hay salto real
  //    pero el cierre queda igual de parejo).
  useEffect(() => {
    if (!repeticion?.key) return
    const segundos = repeticion.segundos || 12
    const timers = []

    // Tiempos del cierre, relativos al momento en que toca volver al en
    // vivo: `CIERRE_MS` tiene que ser el mismo tiempo que dura la animación
    // .gm-cierre-logo en index.css. El salto de verdad se hace a la mitad
    // (55%) de esa animación, cuando el logo ya está grande.
    const CIERRE_MS = 900
    const msCierreInicio = segundos * 1000
    const msCierreSeek = msCierreInicio + Math.round(CIERRE_MS * .55)
    const msCierreFin = msCierreInicio + CIERRE_MS

    setMostrandoEtiqueta(true)

    const player = ytPlayerRef.current
    const puedeControlarVideo = plataforma === 'youtube' && typeof player?.seekTo === 'function' && typeof player?.getCurrentTime === 'function'
    if (puedeControlarVideo) {
      try {
        const actual = player.getCurrentTime()
        player.seekTo(Math.max(0, actual - segundos), true)
      } catch { /* si el reproductor todavía no está listo, se pierde este intento */ }
    }

    if (repeticion.imagenUrl) {
      setFaseBumper('entra')
      timers.push(setTimeout(() => setFaseBumper('sale'), 2000))
      timers.push(setTimeout(() => setFaseBumper(null), 2400))
    }

    timers.push(setTimeout(() => setMostrandoCierre(true), msCierreInicio))
    timers.push(setTimeout(() => {
      // El salto de verdad al en vivo pasa acá, con el logo ya grande.
      if (!puedeControlarVideo) return
      try {
        const duracion = player.getDuration?.()
        if (duracion) player.seekTo(duracion, true)
      } catch { /* si el reproductor ya no responde, no pasa nada */ }
    }, msCierreSeek))
    timers.push(setTimeout(() => {
      setMostrandoCierre(false)
      setMostrandoEtiqueta(false)
    }, msCierreFin))

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe disparar cuando cambia la key, no en cada render
  }, [repeticion?.key, plataforma])

  if (!url) return null

  if (plataforma === 'youtube') {
    const id = parseYouTubeId(url)
    if (!id) return <LinkFallback url={url} S={S}/>
    const origen = typeof window !== 'undefined' ? window.location.origin : ''
    return (
      <div style={pantallaCompleta ? cajaCompleta : cajaNormal}>
        <iframe ref={iframeRef} id={idIframeYoutube} src={`https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${encodeURIComponent(origen)}`} title={titulo || 'En vivo'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}/>
        {overlay}
        {mostrandoEtiqueta && <EtiquetaRepeticion/>}
        {faseBumper && repeticion?.imagenUrl && (
          <BumperRepeticion fase={faseBumper} imagenUrl={repeticion.imagenUrl}/>
        )}
        {mostrandoCierre && <BumperCierre/>}
        <BotonPantallaCompleta activo={pantallaCompleta} onClick={() => setPantallaCompleta(v => !v)}/>
      </div>
    )
  }

  if (plataforma === 'facebook') {
    return (
      <div style={pantallaCompleta ? cajaCompleta : cajaNormal}>
        <iframe ref={iframeRef} src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`}
          title={titulo || 'En vivo'} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}/>
        {overlay}
        {mostrandoEtiqueta && <EtiquetaRepeticion/>}
        {faseBumper && repeticion?.imagenUrl && (
          <BumperRepeticion fase={faseBumper} imagenUrl={repeticion.imagenUrl}/>
        )}
        {mostrandoCierre && <BumperCierre/>}
        <BotonPantallaCompleta activo={pantallaCompleta} onClick={() => setPantallaCompleta(v => !v)}/>
      </div>
    )
  }

  if (plataforma === 'instagram') {
    return (
      <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14"
        style={{ margin:'0 auto', maxWidth:'540px', width:'100%', minHeight:'300px' }}/>
    )
  }

  return <LinkFallback url={url} S={S}/>
}
