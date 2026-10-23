import { useEffect, useMemo, useState } from 'react'
import { apiUrl } from './apiBase'

// Links de CANAL de YouTube (youtube.com/@micanal, /channel/UC…, /c/…, /user/…),
// no de un video puntual. Es lo que muchos organizadores pegan en vez del link
// de cada transmisión: el canal siempre es el mismo, el video en vivo cambia.
// Mismo criterio que api/yt-en-vivo.js (que es quien lo vuelve a validar).
const SUFIJOS = '(?:\\/(?:live|streams|videos|featured|about|home|playlists|community))?'
const PATRONES_CANAL = [
  new RegExp('^\\/@[A-Za-z0-9._%-]{2,120}' + SUFIJOS + '$'),
  new RegExp('^\\/channel\\/UC[A-Za-z0-9_-]{20,24}' + SUFIJOS + '$'),
  new RegExp('^\\/(c|user)\\/[A-Za-z0-9._%-]{1,120}' + SUFIJOS + '$'),
]

export function esCanalYoutube(url) {
  const txt = String(url || '').trim()
  if (!txt) return false
  try {
    const u = new URL(/^https?:\/\//i.test(txt) ? txt : 'https://' + txt)
    if (u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '') !== 'youtube.com') return false
    const p = u.pathname.replace(/\/+$/, '')
    return PATRONES_CANAL.some(re => re.test(p))
  } catch {
    return false
  }
}

const CADA_MS = 45000

// Para cada transmisión cuyo link es un CANAL de YouTube, pregunta cada 45 s si
// está en vivo (api/yt-en-vivo.js). Devuelve { [idTransmision]: { estado, url } }:
//   estado 'vivo'     → url = link del video en vivo de ese canal
//   estado 'no-vivo'  → el canal no está transmitiendo ahora (url null)
//   estado 'error'    → el link no es un canal válido / no existe
//   estado 'falla'    → no se pudo consultar (YouTube bloqueó, servidor caído…); `motivo` dice por qué
// Si una consulta falla de pronto (internet, YouTube), se conserva el último
// resultado conocido: una falla pasajera no apaga una transmisión que sigue.
// Las transmisiones con link de video normal no pasan por acá.
export function useCanalesEnVivo(streams) {
  const canales = useMemo(
    () => (streams || []).filter(s => esCanalYoutube(s.url)).map(s => ({ id: s.id, url: String(s.url).trim() })),
    [streams],
  )
  const clave = canales.map(c => `${c.id}|${c.url}`).join('\n')
  const [estados, setEstados] = useState({})

  useEffect(() => {
    if (!canales.length) return undefined
    let activo = true
    async function consultar() {
      await Promise.all(canales.map(async c => {
        let nuevo
        try {
          const r = await fetch(apiUrl('/api/yt-en-vivo?u=' + encodeURIComponent(c.url)))
          const j = await r.json().catch(() => ({}))
          if (r.status === 400 || r.status === 404) nuevo = { estado: 'error', url: null, motivo: j.error }
          else if (!r.ok) { if (activo) setEstados(prev => (prev[c.id] ? prev : { ...prev, [c.id]: { estado: 'falla', url: null, motivo: j.error || `el servidor respondió ${r.status}` } })); return }
          else nuevo = j.live && j.videoId ? { estado: 'vivo', url: `https://www.youtube.com/watch?v=${j.videoId}` } : { estado: 'no-vivo', url: null }
        } catch {
          if (activo) setEstados(prev => (prev[c.id] ? prev : { ...prev, [c.id]: { estado: 'falla', url: null, motivo: 'no se pudo conectar con el servidor de Golmebol' } }))
          return
        }
        if (activo) setEstados(prev => ({ ...prev, [c.id]: nuevo }))
      }))
    }
    // Pequeña espera antes de la primera consulta: en el panel de admin el
    // link se va escribiendo letra por letra y no hay que consultar cada una.
    const t0 = setTimeout(consultar, 600)
    const t = setInterval(consultar, CADA_MS)
    return () => { activo = false; clearTimeout(t0); clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `canales` sale de `streams` (cambia de identidad en cada refresco de la configuración); lo que importa es su contenido, que resume `clave`
  }, [clave])

  return estados
}

// Aplica el resultado a una lista de transmisiones: las de video normal pasan
// igual; las de canal se reemplazan por el link del video en vivo, y si el canal
// no está en vivo se quitan (la portada solo muestra lo que está transmitiendo).
export function resolverStreams(streams, estados) {
  return (streams || []).flatMap(s => {
    if (!esCanalYoutube(s.url)) return [s]
    const url = estados[s.id]?.url
    return url ? [{ ...s, url }] : []
  })
}
