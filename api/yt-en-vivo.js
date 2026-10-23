// Detecta si un CANAL de YouTube está transmitiendo en vivo ahora mismo y, si
// lo está, devuelve el id del video de esa transmisión.
//
// Para qué: el organizador pega en /admin/config-sitio el link de su CANAL
// (youtube.com/@micanal) en vez del link del video en vivo de cada partido —
// el link del video cambia con cada transmisión. La portada de Golmebol llama
// a este endpoint cada rato y, apenas el canal está en vivo, muestra esa
// transmisión sola (y la quita cuando termina).
//
//   GET /api/yt-en-vivo?u=https://www.youtube.com/@micanal
//   → { live: true,  videoId: "XXXXXXXXXXX" }
//   → { live: false }                          (el canal existe pero no está en vivo)
//   → 4xx/5xx { error }                        (link inválido o YouTube no respondió)
//
// Cómo lo detecta: pide la página youtube.com/<canal>/live — YouTube manda ahí
// al video en vivo del canal si lo hay — y revisa que esa página marque el
// video como "en vivo ahora" (un directo ya terminado NO cuenta).
//
// Solo se aceptan links de youtube.com con forma de canal (nunca una URL
// cualquiera), así el endpoint no sirve para pedir páginas arbitrarias. La
// respuesta se guarda 30 s en el caché de Vercel: aunque haya cientos de
// personas en la portada, YouTube recibe una sola consulta cada 30 s por canal.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const SUFIJOS = '(?:\\/(?:live|streams|videos|featured|about|home|playlists|community))?'

export function rutaDeCanal(entrada) {
  const txt = String(entrada || '').trim()
  if (!txt) return null
  let u
  try { u = new URL(/^https?:\/\//i.test(txt) ? txt : 'https://' + txt) } catch { return null }
  if (u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '') !== 'youtube.com') return null
  const p = u.pathname.replace(/\/+$/, '')
  let m = p.match(new RegExp('^\\/(@[A-Za-z0-9._%-]{2,120})' + SUFIJOS + '$'))
  if (m) return '/' + m[1]
  m = p.match(new RegExp('^\\/channel\\/(UC[A-Za-z0-9_-]{20,24})' + SUFIJOS + '$'))
  if (m) return '/channel/' + m[1]
  m = p.match(new RegExp('^\\/(c|user)\\/([A-Za-z0-9._%-]{1,120})' + SUFIJOS + '$'))
  if (m) return `/${m[1]}/${m[2]}`
  return null
}

// ── Lectura de la página de YouTube ─────────────────────────────────────
// Un video "en vivo ahora" se reconoce por cualquiera de estas marcas que trae
// la propia página (no dependemos de una sola, YouTube cambia detalles seguido):
//   · microformat → "liveBroadcastDetails":{"isLiveNow":true,…}
//   · videoDetails → "isLive":true
//   · contador de espectadores → "videoViewCountRenderer":{…"isLive":true} ("1 persona mirando ahora")
const RE_LIVE_BROADCAST = /"liveBroadcastDetails":\{[^}]*"isLiveNow":true/
const RE_VIDEO_DETAILS_LIVE = /"videoDetails":\{"videoId":"[\w-]{11}"[^]{0,4000}?"isLive":true/
const RE_VISTAS_LIVE = /"videoViewCountRenderer":\{[^]{0,600}?"isLive":true/

// ¿YouTube nos mandó una pared (cookies / bloqueo) en vez de la página? OJO: la
// página real pesa más de 1 MB y trae palabras como "captcha" en su código, así
// que NO se busca texto suelto: se mira a dónde terminó la consulta y que la
// página traiga los datos de YouTube.
function esPaginaBloqueada(html, url = '') {
  if (!html) return 'YouTube respondió vacío'
  if (/consent\.youtube\.com|consent\.google\./i.test(url)) return 'YouTube pidió aceptar cookies (bloqueó la consulta desde el servidor)'
  if (/google\.com\/sorry|\/sorry\//i.test(url)) return 'YouTube bloqueó la consulta desde el servidor (tráfico inusual)'
  if (!html.includes('ytInitialPlayerResponse') && !html.includes('ytInitialData')) {
    return /Before you continue|unusual traffic/i.test(html) ? 'YouTube bloqueó la consulta desde el servidor' : 'respuesta inesperada de YouTube'
  }
  return null
}

// Id del video que muestra la página (de la marca más confiable a la menos).
function extraerVideoId(html) {
  const patrones = [
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/,
    /<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/,
    /"videoDetails":\{"videoId":"([\w-]{11})"/,
    /"currentVideoEndpoint":\{[^]{0,500}?"videoId":"([\w-]{11})"/,
  ]
  for (const re of patrones) { const m = html.match(re); if (m) return m[1] }
  return null
}

function extraerCanalId(html) {
  const m = html.match(/"(?:externalChannelId|channelId)":"(UC[\w-]{22})"/) || html.match(/youtube\.com\/channel\/(UC[\w-]{22})/)
  return m ? m[1] : null
}

// Página youtube.com/<canal>/live: si el canal está en vivo, YouTube muestra ahí el video.
// Devuelve { live:true, videoId } (videoId puede ser null si la página no lo trae: ver idPorRss).
export function analizarPaginaLive(html, url = '') {
  const bloqueo = esPaginaBloqueada(html, url)
  if (bloqueo) return { error: bloqueo }
  const enVivo = RE_LIVE_BROADCAST.test(html) || RE_VIDEO_DETAILS_LIVE.test(html) || RE_VISTAS_LIVE.test(html)
  return enVivo ? { live: true, videoId: extraerVideoId(html) } : { live: false }
}

// Respaldo: pestaña "En directo" del canal (youtube.com/<canal>/streams): un video
// con la insignia LIVE antes de que empiece el siguiente video de la lista.
export function analizarPaginaStreams(html, url = '') {
  const bloqueo = esPaginaBloqueada(html, url)
  if (bloqueo) return { error: bloqueo }
  const m = html.match(/"videoId":"([\w-]{11})"(?:(?!"videoId")[^]){0,6000}?"style":"LIVE"/)
  return m ? { live: true, videoId: m[1] } : { live: false }
}

// Si la página dice "en vivo" pero no trae el id del video: se piden los videos
// recientes del canal (feed RSS público) y se toma el primero que aparece también
// dentro de la página en vivo — ese es el video que está transmitiendo.
export async function idPorRss(html, ruta) {
  const canal = extraerCanalId(html) || (ruta.startsWith('/channel/') ? ruta.slice('/channel/'.length) : null)
  if (!canal) return null
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const xml = await r.text()
    const ids = [...xml.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].map(x => x[1])
    return ids.find(id => html.includes(id)) || null
  } catch { return null }
}

function diagnosticar(html, r) {
  const trozo = (re, antes = 80, despues = 160) => { const i = html.search(re); return i < 0 ? null : html.slice(Math.max(0, i - antes), i + despues) }
  return {
    status: r.status,
    urlFinal: r.url,
    largo: html.length,
    titulo: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || null,
    canonical: (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || null,
    marcas: {
      ytInitialData: html.includes('ytInitialData'),
      ytInitialPlayerResponse: html.includes('ytInitialPlayerResponse'),
      liveBroadcastDetails: html.includes('liveBroadcastDetails'),
      isLiveNowTrue: html.includes('"isLiveNow":true'),
      isLiveTrue: html.includes('"isLive":true'),
      styleLIVE: html.includes('"style":"LIVE"'),
      vistasLive: RE_VISTAS_LIVE.test(html),
      videoDetailsLive: RE_VIDEO_DETAILS_LIVE.test(html),
      ogUrl: /og:url/.test(html),
      currentVideoEndpoint: html.includes('currentVideoEndpoint'),
    },
    idDirecto: extraerVideoId(html),
    canalId: extraerCanalId(html),
    idsEnLaPagina: [...new Set([...html.matchAll(/"videoId":"([\w-]{11})"/g)].map(m => m[1]))].slice(0, 6),
    extracto: trozo(/liveBroadcastDetails/) || trozo(/"isLive"/),
  }
}

async function pedir(ruta) {
  const r = await fetch(`https://www.youtube.com${ruta}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5', Cookie: 'CONSENT=YES+cb; SOCS=CAI' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  })
  return { r, html: r.ok ? await r.text() : '' }
}

// La app (Capacitor) llama a estas funciones desde su propio origen: Android
// usa https://localhost y iOS capacitor://localhost. Solo esos orígenes (y el
// sitio mismo, que no necesita permiso) quedan autorizados.
const ORIGENES_APP = ['https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost']
function permitirApp(req, res) {
  const origen = req.headers.origin
  if (origen && ORIGENES_APP.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }
}


export default async function handler(req, res) {
  permitirApp(req, res)
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  const ruta = rutaDeCanal(req.query?.u)
  if (!ruta) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(400).json({ error: 'Link de canal de YouTube no válido' })
    return
  }
  const depurar = req.query?.debug === '1' // /api/yt-en-vivo?u=…&debug=1 → muestra qué recibió el servidor de YouTube
  try {
    const p1 = await pedir(`${ruta}/live`)
    if (p1.r.status === 404 && !depurar) {
      res.setHeader('Cache-Control', 'public, s-maxage=60')
      res.status(404).json({ error: 'No se encontró ese canal de YouTube' })
      return
    }
    if (!p1.r.ok && !depurar) throw new Error('YouTube respondió ' + p1.r.status)
    let resultado = analizarPaginaLive(p1.html, p1.r.url)
    let p2 = null
    // Si la página /live no lo marca en vivo, se revisa también la pestaña de directos
    if (!resultado.live) {
      try {
        p2 = await pedir(`${ruta}/streams`)
        const r2 = p2.r.ok ? analizarPaginaStreams(p2.html, p2.r.url) : { error: 'YouTube respondió ' + p2.r.status }
        if (r2.live) resultado = r2
        else if (resultado.error && !r2.error) resultado = r2
      } catch { /* si el respaldo falla, vale lo que dijo la primera */ }
    }
    if (resultado.live && !resultado.videoId) resultado = { live: true, videoId: await idPorRss(p1.html, ruta) }
    if (resultado.live && !resultado.videoId) resultado = { error: 'El canal está en vivo pero no se pudo identificar el video' }
    if (depurar) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ resultado, ruta, paso1_live: diagnosticar(p1.html, p1.r), paso2_streams: p2 ? diagnosticar(p2.html, p2.r) : null })
      return
    }
    if (resultado.error) throw new Error(resultado.error)
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    res.status(200).json(resultado)
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: e?.message || 'No se pudo consultar YouTube' })
  }
}
