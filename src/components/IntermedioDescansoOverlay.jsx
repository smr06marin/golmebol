import { useEffect, useRef, useState } from 'react'
import PatrocinadorEnVivoOverlay from './PatrocinadorEnVivoOverlay'

// Pantalla automática del DESCANSO, después del marcador grande y la tabla:
//   jugada (se repite 2 veces) → video de un patrocinador → otra jugada (2 veces) → otro patrocinador → …
// · Las jugadas son los videos que se suben por transmisión (control.jugadas, ver JugadasDescansoEnVivo).
// · Los patrocinadores salen UNA sola vez cada uno (no se repiten): cuando ya salieron todos,
//   solo siguen las jugadas, de a dos veces cada una, y al terminar la lista vuelven a empezar.
// · Si no hay jugadas, solo salen los videos de los patrocinadores (una vez cada uno).
// El que la muestra (OverlayEnVivoPage) la quita solo cuando arranca el 2.º tiempo.

const MAX_CLIP_MS = 90000 // seguro por si un video nunca avisa que terminó

// Qué viene después de `s` (el paso que acaba de terminar). null = ya no hay nada más que mostrar.
// Pasos: { tipo: 'jugada', clip, vez, mostrados, n } | { tipo: 'patrocinador', pIdx, clip, mostrados, n }
function siguiente(s, nClips, nPatros) {
  if (!s) {
    if (nClips) return { tipo: 'jugada', clip: 0, vez: 1, mostrados: 0, n: 1 }
    if (nPatros) return { tipo: 'patrocinador', pIdx: 0, clip: -1, mostrados: 1, n: 1 }
    return null
  }
  const n = s.n + 1
  if (s.tipo === 'jugada') {
    if (s.vez === 1) return { ...s, vez: 2, n }
    if (s.mostrados < nPatros) return { tipo: 'patrocinador', pIdx: s.mostrados, clip: s.clip, mostrados: s.mostrados + 1, n }
    return { tipo: 'jugada', clip: (s.clip + 1) % nClips, vez: 1, mostrados: s.mostrados, n }
  }
  if (nClips) return { tipo: 'jugada', clip: (s.clip + 1) % nClips, vez: 1, mostrados: s.mostrados, n }
  if (s.mostrados < nPatros) return { tipo: 'patrocinador', pIdx: s.mostrados, clip: -1, mostrados: s.mostrados + 1, n }
  return null
}

function ClipJugada({ url, vez, onTerminar }) {
  const ref = useRef(null)
  const alTerminar = useRef(onTerminar)
  useEffect(() => { alTerminar.current = onTerminar })
  useEffect(() => {
    const t = setTimeout(() => alTerminar.current?.(), MAX_CLIP_MS)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const p = v.play()
    if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => alTerminar.current?.()) }) // sin permiso para sonido: se intenta mudo
  }, [])
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', pointerEvents: 'none', padding: '5%', boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', width: 'min(100%, 760px)', maxHeight: '100%', display: 'flex', justifyContent: 'center' }}>
        <video ref={ref} src={url} autoPlay playsInline preload="auto"
          onEnded={() => alTerminar.current?.()} onError={() => alTerminar.current?.()}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', background: '#000', boxShadow: '0 8px 30px rgba(0,0,0,.6)' }}/>
        <div style={{
          position: 'absolute', top: '3%', left: '3%', display: 'flex', alignItems: 'center', gap: '8px', background: '#e5433d', color: '#fff',
          fontFamily: '"Segoe UI", Roboto, Arial, system-ui, sans-serif', fontWeight: 800, fontSize: '15px', letterSpacing: '.1em',
          padding: '5px 14px 5px 12px', borderRadius: '4px', textTransform: 'uppercase', boxShadow: '0 2px 8px rgba(0,0,0,.5)',
        }}>
          Repetición{vez === 2 ? ' · 2' : ''}
        </div>
      </div>
    </div>
  )
}

export default function IntermedioDescansoOverlay({ jugadas, patrocinadores }) {
  const clips = (Array.isArray(jugadas) ? jugadas : []).filter(j => j && j.url)
  const patros = (Array.isArray(patrocinadores) ? patrocinadores : []).filter(p => p && p.video_url)
  const [paso, setPaso] = useState(() => siguiente(null, clips.length, patros.length))
  // `n` evita avanzar dos veces cuando un video avisa que terminó y también salta el seguro
  const avanzar = n => setPaso(s => (s && s.n === n ? siguiente(s, clips.length, patros.length) : s))

  const patro = paso?.tipo === 'patrocinador' ? patros[paso.pIdx] : null
  const clip = paso?.tipo === 'jugada' && clips.length ? clips[paso.clip % clips.length] : null
  const pasoN = paso?.n
  const pasoSinMaterial = !!paso && !patro && !clip
  useEffect(() => {
    // la lista cambió y ya no existe lo que tocaba mostrar: se salta
    if (!pasoSinMaterial) return undefined
    const t = setTimeout(() => avanzar(pasoN), 0)
    return () => clearTimeout(t)
  }, [pasoSinMaterial, pasoN]) // eslint-disable-line react-hooks/exhaustive-deps

  if (clip) return <ClipJugada key={`j${paso.n}`} url={clip.url} vez={paso.vez} onTerminar={() => avanzar(paso.n)}/>
  if (patro) return <PatrocinadorEnVivoOverlay key={`p${paso.n}`} patrocinador={patro} tipo="video" tamano="grande" descanso onTerminar={() => avanzar(paso.n)}/>
  return null
}
