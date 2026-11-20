// Timbre + voz para avisarle al árbitro en la planilla, por ejemplo cuando a
// un jugador le marcan la SEGUNDA amarilla.
//
// Se llama dentro del toque del árbitro (al marcar la tarjeta), así el celular
// deja sonar el audio. El sonido es un <audio> con un timbre armado por código
// (no depende de ningún archivo ni de internet; en iPhone suena aunque esté el
// interruptor de silencio). La voz usa la del propio celular (speechSynthesis);
// si el celular no tiene voz en español, queda solo el timbre y el aviso en pantalla.

let urlTimbre = null
let audioTimbre = null

// "Ding-dong" de timbre (~1,5 s) como WAV en memoria
function crearUrlTimbre() {
  if (urlTimbre) return urlTimbre
  const tasa = 22050
  const total = Math.floor(tasa * 1.6)
  const datos = new Float32Array(total)
  const golpe = (freq, ini) => {
    const desde = Math.floor(ini * tasa)
    for (let i = desde; i < total; i++) {
      const t = (i - desde) / tasa
      const ataque = Math.min(1, t / 0.004)
      const caida = Math.exp(-t * 3.2)
      const s = Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * 2 * t) + 0.25 * Math.sin(2 * Math.PI * freq * 3.01 * t)
      datos[i] += s * ataque * caida * 0.5
    }
  }
  golpe(1046.5, 0)   // ding
  golpe(784, 0.5)    // dong
  const buf = new ArrayBuffer(44 + total * 2)
  const v = new DataView(buf)
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  txt(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, tasa, true)
  v.setUint32(28, tasa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, total * 2, true)
  for (let i = 0; i < total; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, datos[i])) * 30000, true)
  urlTimbre = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return urlTimbre
}

function vozEspanol() {
  try {
    const voces = window.speechSynthesis.getVoices() || []
    return voces.find(v => /^es[-_](CO|419|MX|US)/i.test(v.lang)) || voces.find(v => /^es/i.test(v.lang)) || null
  } catch { return null }
}

export function decir(texto) {
  try {
    if (!('speechSynthesis' in window) || !texto) return
    const u = new SpeechSynthesisUtterance(texto)
    const voz = vozEspanol()
    if (voz) u.voice = voz
    u.lang = voz?.lang || 'es-CO'
    u.rate = 0.95
    u.volume = 1
    window.speechSynthesis.speak(u)
  } catch { /* sin voz: queda el timbre */ }
}

// Suena el timbre y, apenas termina, dice el texto en voz alta.
export function timbreConVoz(texto) {
  try {
    if (!audioTimbre) { audioTimbre = new Audio(crearUrlTimbre()); audioTimbre.preload = 'auto' }
    audioTimbre.muted = false; audioTimbre.volume = 1; audioTimbre.currentTime = 0
    const p = audioTimbre.play()
    if (p && p.catch) p.catch(() => { /* el navegador no dejó sonar: queda la voz y el aviso */ })
  } catch { /* sin audio */ }
  try { navigator.vibrate && navigator.vibrate([250, 120, 250]) } catch { /* sin vibración */ }
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      // iPhone solo deja hablar si la primera vez es dentro del toque: se "despierta" la voz ya mismo
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
      setTimeout(() => decir(texto), 1300)
    }
  } catch { /* sin voz */ }
}
