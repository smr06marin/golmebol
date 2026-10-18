import { comprimirImagen } from './imageCompress'

// Logos y escudos con fondo transparente.
//
// Dos problemas que resuelve:
//  1) Un escudo con fondo blanco (JPG, o PNG exportado con fondo) se veía como
//     un recuadro blanco pegado sobre los flyers.
//  2) comprimirImagen() convierte todo a JPG, y el JPG no tiene transparencia:
//     un PNG transparente quedaba con fondo sólido al subirlo.
//
// El recorte NO usa IA ni librerías externas: toma el color del borde de la
// imagen y borra solo el fondo que está CONECTADO con el borde (relleno por
// inundación). Así los blancos de adentro del escudo (letras, franjas, balón)
// se conservan, cosa que no pasa si se borra "todo lo parecido al fondo".
// Si el fondo no es liso (una foto, un degradado fuerte), no toca nada.

const MAX_DIM_POR_DEFECTO = 600

function cargarImagen(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}

function aPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png')
  })
}

const mediana = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

// Analiza una imagen y, si tiene un fondo liso, lo vuelve transparente.
// `fuente` es un File/Blob. Devuelve { blob, estado } con estado:
//   'quitado'          → se borró el fondo (blob = PNG transparente)
//   'ya-transparente'  → ya traía transparencia (blob = PNG, redimensionado)
//   'sin-fondo'        → no había fondo liso que quitar (blob = null)
//   'no-uniforme'      → el fondo es una foto/degradado (blob = null)
export async function quitarFondoLogo(fuente, { maxDim = MAX_DIM_POR_DEFECTO, tolerancia = 34 } = {}) {
  const img = await cargarImagen(fuente)
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  if (!w || !h) throw new Error('Imagen vacía')
  const escala = Math.min(1, maxDim / Math.max(w, h))
  w = Math.max(1, Math.round(w * escala))
  h = Math.max(1, Math.round(h * escala))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  if (w < 8 || h < 8) return { blob: null, estado: 'sin-fondo' }

  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data

  // Píxeles del borde (anillo de 2 px)
  const borde = []
  for (let x = 0; x < w; x++) { borde.push(x, w + x, (h - 1) * w + x, (h - 2) * w + x) }
  for (let y = 0; y < h; y++) { borde.push(y * w, y * w + 1, y * w + w - 1, y * w + w - 2) }

  // ¿Ya es transparente? (la mayoría del borde casi sin opacidad)
  let transp = 0
  for (const p of borde) if (d[p * 4 + 3] < 40) transp++
  if (transp / borde.length > 0.5) return { blob: await aPng(canvas), estado: 'ya-transparente' }

  // Color del fondo = mediana del borde (solo píxeles opacos)
  const rs = [], gs = [], bs = []
  for (const p of borde) {
    const i = p * 4
    if (d[i + 3] < 200) continue
    rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2])
  }
  if (rs.length < borde.length * 0.5) return { blob: null, estado: 'no-uniforme' }
  const bg = [mediana(rs), mediana(gs), mediana(bs)]
  // Solo se quitan fondos lisos CLAROS (blanco, gris muy claro) u OSCUROS
  // (negro): son las cajas que estorban en los flyers. Un fondo de color suele
  // ser parte del diseño del escudo (un cuadro azul con un balón, por ejemplo)
  // y no se toca.
  const claro = Math.min(bg[0], bg[1], bg[2]) >= 190
  const oscuro = Math.max(bg[0], bg[1], bg[2]) <= 60
  if (!claro && !oscuro) return { blob: null, estado: 'sin-fondo' }
  const tol = oscuro ? Math.max(tolerancia, 42) : tolerancia
  const dist = i => Math.sqrt((d[i] - bg[0]) ** 2 + (d[i + 1] - bg[1]) ** 2 + (d[i + 2] - bg[2]) ** 2)

  // ¿El borde es liso? Si no, es una foto o un fondo complicado
  let parecidos = 0
  for (const p of borde) if (dist(p * 4) <= tol * 1.3) parecidos++
  if (parecidos / borde.length < 0.82) return { blob: null, estado: 'no-uniforme' }

  // Relleno por inundación desde el borde: solo lo conectado con el borde
  const total = w * h
  const quitar = new Uint8Array(total)
  const cola = new Int32Array(total)
  let ini = 0, fin = 0
  const meter = p => {
    if (quitar[p]) return
    if (dist(p * 4) > tol) return
    quitar[p] = 1
    cola[fin++] = p
  }
  for (const p of borde) meter(p)
  while (ini < fin) {
    const p = cola[ini++]
    const x = p % w
    if (x > 0) meter(p - 1)
    if (x < w - 1) meter(p + 1)
    if (p >= w) meter(p - w)
    if (p < total - w) meter(p + w)
  }

  // Fugas: una franja blanca interna que llega hasta el borde del escudo queda
  // "conectada" con el fondo y se borraría también. Para evitarlo se mira el
  // fondo quitado en una cuadrícula gruesa y solo se aceptan las zonas que están
  // cerca de un área de fondo realmente grande (el exterior). Las franjas
  // angostas que se meten en el escudo se conservan. El exterior se considera
  // continuo más allá del borde de la imagen para no perder márgenes finos.
  const celda = Math.max(2, Math.ceil(Math.max(w, h) / 110))
  const cw = Math.ceil(w / celda), ch = Math.ceil(h / celda)
  const R = 6
  const pw = cw + 2 * (R + 2), ph = ch + 2 * (R + 2)
  const gruesa = new Uint8Array(pw * ph).fill(1)
  const llenas = new Uint16Array(cw * ch)
  const tam = new Uint16Array(cw * ch)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = Math.floor(y / celda) * cw + Math.floor(x / celda)
    tam[c]++
    if (quitar[y * w + x]) llenas[c]++
  }
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    const c = cy * cw + cx
    gruesa[(cy + R + 2) * pw + (cx + R + 2)] = llenas[c] === tam[c] ? 1 : 0
  }
  const minimo = (src, r) => { // erosión con ventana cuadrada, separable
    const a = new Uint8Array(pw * ph), b = new Uint8Array(pw * ph)
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      let v = 1
      for (let k = -r; k <= r && v; k++) { const xx = x + k; if (xx >= 0 && xx < pw && !src[y * pw + xx]) v = 0 }
      a[y * pw + x] = v
    }
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      let v = 1
      for (let k = -r; k <= r && v; k++) { const yy = y + k; if (yy >= 0 && yy < ph && !a[yy * pw + x]) v = 0 }
      b[y * pw + x] = v
    }
    return b
  }
  const maximo = (src, r) => { // dilatación con ventana cuadrada, separable
    const a = new Uint8Array(pw * ph), b = new Uint8Array(pw * ph)
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      let v = 0
      for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < pw && src[y * pw + xx]) v = 1 }
      a[y * pw + x] = v
    }
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      let v = 0
      for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < ph && a[yy * pw + x]) v = 1 }
      b[y * pw + x] = v
    }
    return b
  }
  const zonaFondo = maximo(minimo(gruesa, R), R + 1)
  let fin2 = 0
  for (let p = 0; p < total; p++) {
    if (!quitar[p]) continue
    const x = p % w, y = (p - x) / w
    if (zonaFondo[(Math.floor(y / celda) + R + 2) * pw + Math.floor(x / celda) + R + 2]) fin2++
    else quitar[p] = 0
  }

  const fraccion = fin2 / total
  if (fraccion < 0.01) return { blob: null, estado: 'sin-fondo' }
  // Si se borraría casi todo, el "fondo" era en realidad el escudo (ej. un
  // escudo de un solo color que toca los bordes): mejor no tocar nada.
  if (fraccion > 0.88) return { blob: null, estado: 'no-uniforme' }

  // Borde suave: los píxeles que tocan el fondo quitado quedan semitransparentes
  // según qué tan distintos son del fondo, para que el corte no se vea dentado.
  const ancho = tol * 2.4
  for (let p = 0; p < total; p++) {
    const i = p * 4
    if (quitar[p]) { d[i + 3] = 0; continue }
    const x = p % w
    const toca = (x > 0 && quitar[p - 1]) || (x < w - 1 && quitar[p + 1]) || (p >= w && quitar[p - w]) || (p < total - w && quitar[p + w])
    if (!toca) continue
    const dd = dist(i)
    if (dd < tol + ancho) d[i + 3] = Math.round(Math.min(255, Math.max(0, 255 * (dd - tol * 0.4) / (ancho + tol * 0.6))))
  }
  ctx.putImageData(imageData, 0, 0)
  return { blob: await aPng(canvas), estado: 'quitado' }
}

// Prepara un logo/escudo para subirlo: si tiene fondo liso lo quita, si ya es
// transparente lo conserva, y solo si no queda otra lo comprime a JPG como
// siempre. Devuelve { archivo, estado } — `archivo` es un File listo para subir.
// Con { sinComprimir: true } (logos de torneo, que siempre se subieron tal cual)
// el archivo original se devuelve sin tocar cuando no hay nada que quitar.
export async function prepararLogoParaSubir(file, { maxSize = 500, sinComprimir = false } = {}) {
  if (!file) return { archivo: file, estado: 'sin-fondo' }
  const alternativo = () => (sinComprimir ? Promise.resolve(file) : comprimirImagen(file, { maxSize }))
  try {
    const r = await quitarFondoLogo(file, { maxDim: maxSize })
    if (r.blob && (r.estado === 'quitado' || r.estado === 'ya-transparente')) {
      const nombre = (file.name || 'logo').replace(/\.[^.]+$/, '') + '.png'
      return { archivo: new File([r.blob], nombre, { type: 'image/png' }), estado: r.estado }
    }
    return { archivo: await alternativo(), estado: r.estado }
  } catch {
    return { archivo: await alternativo(), estado: 'error' }
  }
}

// Para el botón "Quitar fondo" de un logo que ya está subido: lo descarga, le
// quita el fondo y devuelve un File PNG listo para subir, o null si no hay un
// fondo liso que quitar. Lanza un error si no se pudo leer la imagen.
export async function limpiarLogoGuardado(url, { maxSize = 600 } = {}) {
  const resp = await fetch(url, { mode: 'cors' })
  if (!resp.ok) throw new Error('No se pudo descargar el logo')
  const blob = await resp.blob()
  const r = await quitarFondoLogo(blob, { maxDim: maxSize })
  if (r.estado === 'quitado' && r.blob) return { archivo: new File([r.blob], 'logo.png', { type: 'image/png' }), estado: r.estado }
  return { archivo: null, estado: r.estado }
}

// ── Para los flyers: logo limpio a partir de la URL ya guardada ─────────────
// Devuelve la URL a mostrar (la original si ya era transparente, un blob: con
// el fondo quitado si lo tenía liso) o null si no se pudo / no hizo falta. Se
// guarda en caché para no repetir el trabajo con cada dibujo del flyer.
const promesas = new Map()
const resueltos = new Map() // url → string | null (solo cuando ya terminó)

export function logoLimpioDesdeUrl(url) {
  if (!url) return Promise.resolve(null)
  if (promesas.has(url)) return promesas.get(url)
  const p = (async () => {
    let res = null
    try {
      const resp = await fetch(url, { mode: 'cors' })
      if (resp.ok) {
        const blob = await resp.blob()
        const r = await quitarFondoLogo(blob, { maxDim: 600 })
        if (r.estado === 'ya-transparente') res = url
        else if (r.estado === 'quitado' && r.blob) res = URL.createObjectURL(r.blob)
      }
    } catch {
      res = null
    }
    resueltos.set(url, res)
    return res
  })()
  promesas.set(url, p)
  return p
}

// undefined = todavía no se sabe; null = usar la imagen original; string = usar esa
export function logoLimpioListo(url) {
  return resueltos.has(url) ? resueltos.get(url) : undefined
}
