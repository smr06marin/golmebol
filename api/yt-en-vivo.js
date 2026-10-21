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
const RE_LIVE_BROADCAST = /"liveBroadcastDetails":\{[^}]*"isLiveNow":true/
const RE_VIDEO_DETAILS_LIVE = /"videoDetails":\{"videoId":"([\w-]{11})"[^]{0,4000}?"isLive":true/

function esPaginaBloqueada(html) {
  if (!html) return 'YouTube respondió vacío'
  if (/consent\.youtube\.com|Before you continue/i.test(html)) return 'YouTube pidió aceptar cookies (bloqueó la consulta desde el servidor)'
  if (/unusual traffic|captcha|sorry\/index/i.test(html)) return 'YouTube bloqueó la consulta desde el servidor (tráfico inusual)'
  if (!html.includes('ytInitialPlayerResponse') && !html.includes('ytInitialData')) return 'respuesta inesperada de YouTube'
  return null
}

// Página youtube.com/<canal>/live: si el canal está en vivo, YouTube muestra ahí el video.
export function analizarPaginaLive(html) {
  const bloqueo = esPaginaBloqueada(html)
  if (bloqueo) return { error: bloqueo }
  const canonico = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/)
  const detalles = html.match(RE_VIDEO_DETAILS_LIVE)
  const enVivo = RE_LIVE_BROADCAST.test(html) || !!detalles
  const videoId = (canonico && canonico[1]) || (detalles && detalles[1]) || (html.match(/"videoDetails":\{"videoId":"([\w-]{11})"/) || [])[1]
  return enVivo && videoId ? { live: true, videoId } : { live: false }
}

// Respaldo: pestaña "En directo" del canal (youtube.com/<canal>/streams): un video
// con la insignia LIVE antes de que empiece el siguiente video de la lista.
export function analizarPaginaStreams(html) {
  const bloqueo = esPaginaBloqueada(html)
  if (bloqueo) return { error: bloqueo }
  const m = html.match(/"videoId":"([\w-]{11})"(?:(?!"videoId")[^]){0,6000}?"style":"LIVE"/)
  return m ? { live: true, videoId: m[1] } : { live: false }
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
      consentimiento: /consent\.youtube\.com|Before you continue/i.test(html),
    },
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

export default async function handler(req, res) {
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
    let resultado = analizarPaginaLive(p1.html)
    let p2 = null
    // Si la página /live no lo marca en vivo, se revisa también la pestaña de directos
    if (!resultado.live) {
      try {
        p2 = await pedir(`${ruta}/streams`)
        const r2 = p2.r.ok ? analizarPaginaStreams(p2.html) : { error: 'YouTube respondió ' + p2.r.status }
        if (r2.live) resultado = r2
        else if (resultado.error && !r2.error) resultado = r2
      } catch { /* si el respaldo falla, vale lo que dijo la primera */ }
    }
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
