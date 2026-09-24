import { useEffect, useRef, useState } from 'react'
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

// Aviso de "repetición" que aparece unos segundos abajo del video cuando el
// árbitro anota un gol — con el patrocinador de turno, como el "cortesía
// de" que ponen las transmisiones profesionales. En YouTube el video de
// verdad se rebobina (ver `dispararRepeticion` más abajo); en las demás
// plataformas no se puede mover el video desde acá, así que solo se avisa
// del gol, sin decir "repetición".
function AvisoRepeticion({ conRebobinado, patrocinador }) {
  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:'10px', zIndex:4, display:'flex', justifyContent:'center', pointerEvents:'none' }}>
      <div style={{ background:'rgba(6,6,8,.94)', borderRadius:'9px', padding:'6px 14px', display:'flex', alignItems:'center', gap:'8px', boxShadow:'0 3px 14px rgba(0,0,0,.5)', maxWidth:'92%' }}>
        <span style={{ fontSize:'clamp(.6rem,2.4vw,.72rem)', fontWeight:900, color:'#fff', whiteSpace:'nowrap' }}>
          {conRebobinado ? '🔁 REPETICIÓN' : '⚽ ¡GOL!'}
        </span>
        {patrocinador && (
          <>
            <span style={{ width:'1px', height:'16px', background:'rgba(255,255,255,.25)', flexShrink:0 }}/>
            <span style={{ fontSize:'clamp(.52rem,2vw,.6rem)', color:'#c9c9c9', fontWeight:700, whiteSpace:'nowrap' }}>Cortesía de</span>
            {patrocinador.logo_url
              ? <img src={patrocinador.logo_url} alt={patrocinador.nombre || ''} style={{ height:'18px', maxWidth:'90px', objectFit:'contain', flexShrink:0 }}/>
              : <span style={{ fontSize:'clamp(.55rem,2.2vw,.65rem)', fontWeight:900, color:'#fff', whiteSpace:'nowrap' }}>{patrocinador.nombre}</span>}
          </>
        )}
      </div>
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
// `repeticion` (opcional): { key, segundos, patrocinador } — cada vez que
// `key` cambia (LandingPage lo cambia apenas detecta un gol nuevo), se
// muestra el aviso de "repetición" con el patrocinador de turno durante
// unos segundos. En YouTube, además, el video de verdad se rebobina
// `segundos` (usando la IFrame Player API en vez del <iframe> a secas) y
// después de ese mismo tiempo vuelve solo al momento en vivo real. En
// Facebook/Instagram no hay forma confiable de mover el video desde acá,
// así que ahí solo se muestra el aviso, sin rebobinar.
export default function LiveEmbed({ url, titulo, S, overlay, repeticion }) {
  const plataforma = detectarPlataforma(url)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [mostrandoRepeticion, setMostrandoRepeticion] = useState(false)
  const iframeRef = useRef(null)
  const ytPlayerRef = useRef(null)

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
      if (cancelado || !YT || !iframeRef.current) return
      player = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            if (cancelado) return
            ytPlayerRef.current = player
            iframeRef.current = player.getIframe()
          },
        },
      })
    })
    return () => {
      cancelado = true
      ytPlayerRef.current = null
      if (player?.destroy) player.destroy()
    }
  }, [plataforma, url])

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

  // Dispara la repetición apenas cambia `repeticion.key` (un gol nuevo): en
  // YouTube rebobina el video de verdad; en cualquier plataforma muestra el
  // aviso con el patrocinador durante unos segundos.
  useEffect(() => {
    if (!repeticion?.key) return
    const segundos = repeticion.segundos || 12
    setMostrandoRepeticion(true)
    let volverEnVivoTimer
    const player = ytPlayerRef.current
    if (plataforma === 'youtube' && typeof player?.seekTo === 'function' && typeof player?.getCurrentTime === 'function') {
      try {
        const actual = player.getCurrentTime()
        player.seekTo(Math.max(0, actual - segundos), true)
        // Después de repetir la jugada, vuelve sola al momento en vivo real
        // (si no, se quedaría viendo el partido con `segundos` de retraso).
        volverEnVivoTimer = setTimeout(() => {
          try {
            const duracion = player.getDuration?.()
            if (duracion) player.seekTo(duracion, true)
          } catch { /* si el reproductor ya no responde, no pasa nada */ }
        }, segundos * 1000)
      } catch { /* si el reproductor todavía no está listo, se pierde este intento */ }
    }
    const ocultarAvisoTimer = setTimeout(() => setMostrandoRepeticion(false), 5000)
    return () => { clearTimeout(volverEnVivoTimer); clearTimeout(ocultarAvisoTimer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe disparar cuando cambia la key, no en cada render
  }, [repeticion?.key, plataforma])

  if (!url) return null

  if (plataforma === 'youtube') {
    const id = parseYouTubeId(url)
    if (!id) return <LinkFallback url={url} S={S}/>
    const origen = typeof window !== 'undefined' ? window.location.origin : ''
    return (
      <div style={pantallaCompleta ? cajaCompleta : cajaNormal}>
        <iframe ref={iframeRef} src={`https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${encodeURIComponent(origen)}`} title={titulo || 'En vivo'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}/>
        {overlay}
        {mostrandoRepeticion && <AvisoRepeticion conRebobinado patrocinador={repeticion?.patrocinador}/>}
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
        {mostrandoRepeticion && <AvisoRepeticion conRebobinado={false} patrocinador={repeticion?.patrocinador}/>}
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
