// ── Dónde está la cara en la foto del jugador ───────────────────────────────
// Sirve para encuadrar bien la foto de la tarjeta: que se vean los OJOS y la cara
// (no solo la frente), sin importar cómo haya subido la foto el jugador.
//
// Usa un detector de rostros chiquito que corre en el celular del que mira (la foto
// no sale a ningún servidor). El detector pesa ~0,7 MB y solo se descarga la primera
// vez que hace falta; el resultado de cada foto queda guardado en el celular, así la
// siguiente vez es instantáneo y no se vuelve a descargar nada.
//
// Si el detector no carga (sin internet, celular muy viejo) o no encuentra cara,
// devuelve null y la tarjeta usa el encuadre de siempre.

const PREFIJO = 'gm_foco_v1:'
const CARPETA_MODELO = '/modelos-rostro'
const LADO_MAX = 512          // la foto se achica a esto antes de buscar la cara (más rápido)
const OJOS_EN_CARA = 0.38     // los ojos están ~38% más abajo del borde de arriba del recuadro de la cara

let motorPromesa = null
function cargarMotor() {
  if (!motorPromesa) {
    motorPromesa = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      const tf = faceapi.tf
      try { await tf.setBackend('webgl'); await tf.ready() } catch { await tf.setBackend('cpu'); await tf.ready() }
      await faceapi.nets.tinyFaceDetector.loadFromUri(CARPETA_MODELO)
      return faceapi
    })().catch(e => { motorPromesa = null; throw e })
  }
  return motorPromesa
}

function leerCache(url) {
  try {
    const t = window.localStorage.getItem(PREFIJO + url)
    if (t == null) return undefined
    return JSON.parse(t)           // objeto, o null si ya se buscó y no había cara
  } catch { return undefined }
}
function guardarCache(url, valor) {
  try { window.localStorage.setItem(PREFIJO + url, JSON.stringify(valor)) } catch { /* sin espacio / modo privado */ }
}

// Detecta en una imagen ya cargada (Image, ImageBitmap o canvas).
// Devuelve { cx, ojos, ancho, alto } en proporciones (0–1) de la foto, o null.
export async function detectarRostro(img) {
  const w0 = img.width, h0 = img.height
  if (!w0 || !h0) return null
  const k = Math.min(1, LADO_MAX / Math.max(w0, h0))
  const cv = document.createElement('canvas')
  cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k)
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)

  const faceapi = await cargarMotor()
  let dets = await faceapi.detectAllFaces(cv, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 }))
  if (!dets || dets.length === 0) {
    // foto de cuerpo entero (cara muy chica): segunda pasada más fina
    dets = await faceapi.detectAllFaces(cv, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 }))
  }
  if (!dets || dets.length === 0) return null
  // la cara más grande (la del jugador; si salen otras personas al fondo, son más chicas)
  const mejor = dets.reduce((a, d) => (d.box.width * d.box.height * d.score > a.box.width * a.box.height * a.score ? d : a), dets[0])
  const b = mejor.box
  const f = {
    cx: (b.x + b.width / 2) / cv.width,
    ojos: (b.y + b.height * OJOS_EN_CARA) / cv.height,
    ancho: b.width / cv.width,
    alto: b.height / cv.height,
  }
  if (![f.cx, f.ojos, f.ancho, f.alto].every(Number.isFinite)) return null
  return f
}

// Con memoria en el celular y sin gastar datos en conexiones "ahorro de datos".
export async function focoDeFoto(url, img) {
  if (!url || !img) return null
  const guardado = leerCache(url)
  if (guardado !== undefined) return guardado
  try {
    if (navigator.connection?.saveData) return null
    const f = await detectarRostro(img)
    guardarCache(url, f)
    return f
  } catch {
    return null    // no se guarda: se vuelve a intentar la próxima vez
  }
}
