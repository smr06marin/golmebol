// Alarma de "se cumplió el tiempo" de las planillas (completa y rápida) y
// pantalla siempre encendida mientras corre el cronómetro.
//
// POR QUÉ NO SONABA EN ALGUNOS CELULARES: antes cada pitido creaba un
// AudioContext NUEVO al momento de sonar. En Android/iPhone el navegador deja
// en silencio cualquier audio que no nazca de un toque del usuario, y a los 20
// minutos ya nadie está tocando la pantalla. La solución es "preparar" el audio
// UNA vez, justo cuando el árbitro toca INICIAR (un toque real), y reutilizar
// ese mismo audio ya autorizado cuando toque sonar.
//
//  · Sonido: un <audio> con un pitido generado por código (no depende de ningún
//    archivo ni de internet). A diferencia de Web Audio, en iPhone un <audio>
//    suena aunque el interruptor de silencio esté puesto. Si por algo falla, se
//    usa Web Audio como respaldo.
//  · Vibración: navigator.vibrate (Android/Chrome/Firefox). iPhone no la
//    permite en ninguna página web: ahí cuenta el sonido y el aviso en pantalla.
//  · Pantalla encendida: Wake Lock — si el celular se bloquea, el navegador
//    congela la página y el cronómetro no puede avisar hasta que se desbloquee.
import { useEffect } from 'react'

let ctxAudio = null
let elementoAudio = null
let urlPitido = null

// Pitido de ~1 s (dos tonos) como archivo WAV armado en memoria.
function crearUrlPitido() {
  if (urlPitido) return urlPitido
  const tasa = 22050
  const tonos = [[880, 0, 0.35], [1175, 0.45, 0.5]]
  const total = Math.floor(tasa * 1.05)
  const datos = new Int16Array(total)
  tonos.forEach(([freq, ini, dur]) => {
    const desde = Math.floor(ini * tasa), hasta = Math.min(total, Math.floor((ini + dur) * tasa))
    for (let i = desde; i < hasta; i++) {
      const t = (i - desde) / tasa
      const borde = Math.min(1, (i - desde) / 200, (hasta - i) / 400) // evita "clics" al empezar y terminar
      const seno = Math.sin(2 * Math.PI * freq * t)
      const onda = Math.sign(seno) * 0.55 + seno * 0.35 // cuadrada + seno: suena fuerte en parlantes chicos
      datos[i] = Math.max(-1, Math.min(1, onda * borde)) * 30000
    }
  })
  const buf = new ArrayBuffer(44 + datos.length * 2)
  const v = new DataView(buf)
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  txt(0, 'RIFF'); v.setUint32(4, 36 + datos.length * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, tasa, true)
  v.setUint32(28, tasa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, datos.length * 2, true)
  for (let i = 0; i < datos.length; i++) v.setInt16(44 + i * 2, datos[i], true)
  urlPitido = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return urlPitido
}

// Llamar DENTRO de un toque del usuario (ej. al tocar INICIAR). Deja el audio
// autorizado para que más tarde pueda sonar sin que nadie toque la pantalla.
export function prepararAlarma() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      if (!ctxAudio) ctxAudio = new Ctx()
      if (ctxAudio.state === 'suspended') ctxAudio.resume()
      const b = ctxAudio.createBuffer(1, 1, 22050), s = ctxAudio.createBufferSource()
      s.buffer = b; s.connect(ctxAudio.destination); s.start(0)
    }
  } catch { /* sin Web Audio */ }
  try {
    if (!elementoAudio) { elementoAudio = new Audio(crearUrlPitido()); elementoAudio.preload = 'auto' }
    elementoAudio.muted = true
    const p = elementoAudio.play()
    const listo = () => { try { elementoAudio.pause(); elementoAudio.currentTime = 0; elementoAudio.muted = false } catch { /* nada */ } }
    if (p && p.then) p.then(listo).catch(() => { elementoAudio.muted = false })
    else listo()
  } catch { /* sin <audio> */ }
}

function pitidoWebAudio() {
  try {
    if (!ctxAudio) return
    if (ctxAudio.state === 'suspended') ctxAudio.resume()
    const beep = (freq, ini, dur) => {
      const o = ctxAudio.createOscillator(), g = ctxAudio.createGain()
      o.type = 'square'; o.frequency.value = freq; o.connect(g); g.connect(ctxAudio.destination)
      const t0 = ctxAudio.currentTime + ini
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      o.start(t0); o.stop(t0 + dur + 0.02)
    }
    beep(880, 0, 0.35); beep(1175, 0.45, 0.5)
  } catch { /* nada */ }
}

// Un ciclo de alarma: pitido + vibración. Se repite desde la planilla hasta que la silencien.
export function sonarAlarmaUnaVez() {
  let sono = false
  try {
    if (!elementoAudio) { elementoAudio = new Audio(crearUrlPitido()); elementoAudio.preload = 'auto' }
    elementoAudio.muted = false; elementoAudio.volume = 1; elementoAudio.currentTime = 0
    const p = elementoAudio.play()
    if (p && p.catch) p.catch(() => pitidoWebAudio())
    sono = true
  } catch { /* se usa el respaldo */ }
  if (!sono) pitidoWebAudio()
  try { if (navigator.vibrate) navigator.vibrate([500, 150, 500, 150, 500]) } catch { /* sin vibración */ }
}

export function detenerVibracion() {
  try { if (navigator.vibrate) navigator.vibrate(0) } catch { /* nada */ }
}

// Mantiene la pantalla encendida mientras `activo` (cronómetro corriendo). Se
// vuelve a pedir al regresar a la planilla, porque el navegador la suelta si la
// página pasó a segundo plano.
export function usePantallaEncendida(activo) {
  useEffect(() => {
    if (!activo || typeof navigator === 'undefined' || !navigator.wakeLock) return
    let candado = null, cancelado = false
    const pedir = async () => {
      try {
        if (document.visibilityState !== 'visible' || candado) return
        const c = await navigator.wakeLock.request('screen')
        if (cancelado) { c.release().catch(() => {}); return }
        candado = c
        c.addEventListener('release', () => { if (candado === c) candado = null })
      } catch { /* sin permiso o batería baja: se sigue sin esto */ }
    }
    pedir()
    document.addEventListener('visibilitychange', pedir)
    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', pedir)
      if (candado) { candado.release().catch(() => {}); candado = null }
    }
  }, [activo])
}
