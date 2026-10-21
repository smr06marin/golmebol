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

// Lee la página /live y dice si hay una transmisión en vivo ahora.
export function analizarPaginaLive(html) {
  if (!html || !html.includes('ytInitialPlayerResponse') && !html.includes('ytInitialData')) return { error: 'respuesta inesperada de YouTube' }
  const canonico = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)
  if (!canonico) return { live: false }
  const enVivoAhora = /"liveBroadcastDetails":\{[^}]*"isLiveNow":true/.test(html)
  return enVivoAhora ? { live: true, videoId: canonico[1] } : { live: false }
}

export default async function handler(req, res) {
  const ruta = rutaDeCanal(req.query?.u)
  if (!ruta) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(400).json({ error: 'Link de canal de YouTube no válido' })
    return
  }
  try {
    const r = await fetch(`https://www.youtube.com${ruta}/live`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5', Cookie: 'CONSENT=YES+cb; SOCS=CAI' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    if (r.status === 404) {
      res.setHeader('Cache-Control', 'public, s-maxage=60')
      res.status(404).json({ error: 'No se encontró ese canal de YouTube' })
      return
    }
    if (!r.ok) throw new Error('YouTube respondió ' + r.status)
    const resultado = analizarPaginaLive(await r.text())
    if (resultado.error) throw new Error(resultado.error)
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    res.status(200).json(resultado)
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: e?.message || 'No se pudo consultar YouTube' })
  }
}
