// Dice en qué estado está UN video de YouTube: 'vivo' (transmitiendo ahora), 'programado' (la "sala de espera"
// de un directo que todavía no empezó) u 'otro' (video normal, directo ya terminado, etc.).
//
// Para qué: el reproductor de YouTube marca como "directo" tanto al que está transmitiendo como al programado que
// no ha empezado, y la portada mostraba esa sala de espera como si fuera un EN VIVO (ej. un directo programado
// para días atrás que nunca arrancó). Con esto la portada sabe que es una sala de espera y la esconde hasta que
// de verdad empiece.
//
//   GET /api/yt-video-estado?v=XXXXXXXXXXX → { estado: 'vivo' | 'programado' | 'otro' }
//   Si YouTube no responde → 502 { error } (la portada, ante la duda, se comporta como antes).
//
// Solo acepta ids de video de 11 caracteres (nunca una URL cualquiera). Respuesta en caché de Vercel 30 s.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const ORIGENES_APP = ['https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost']

export function estadoDeVideo(html, id) {
  if (!html || (!html.includes('ytInitialPlayerResponse') && !html.includes('ytInitialData'))) return null
  if (/"liveBroadcastDetails":\{[^}]*"isLiveNow":true/.test(html)) return 'vivo'
  const desde = '"videoDetails":\\{"videoId":"' + id + '"[^]{0,4000}?'
  if (new RegExp(desde + '"isUpcoming":true').test(html)) return 'programado'
  if (new RegExp(desde + '"isLive":true').test(html)) return 'vivo'
  return 'otro'
}

export default async function handler(req, res) {
  const origen = req.headers.origin
  if (origen && ORIGENES_APP.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  const id = String(req.query?.v || '')
  if (!/^[\w-]{11}$/.test(id)) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(400).json({ error: 'Id de video no válido' })
    return
  }
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5', Cookie: 'CONSENT=YES+cb; SOCS=CAI' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error('YouTube respondió ' + r.status)
    const estado = estadoDeVideo(await r.text(), id)
    if (!estado) throw new Error('respuesta inesperada de YouTube')
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    res.status(200).json({ estado })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: e?.message || 'No se pudo consultar YouTube' })
  }
}
