// Portada (miniatura) de YouTube de 1280x720 para una transmisión: panel oscuro a la
// izquierda con los escudos grandes y panel de color a la derecha con el NOMBRE DEL TORNEO
// arriba, solo en texto los equipos que se enfrentan en ese video y GOLMEBOL abajo.
// El color del panel sale del logo del torneo.
// Se dibuja con canvas, así que se descarga como imagen sin servidor.
//
// generarPortada({ torneo: { name, logo_url }, partidos: [{ home: { name, logo_url }, away: { name, logo_url } }] })
//   → Promise<HTMLCanvasElement>

export const ANCHO = 1280
export const ALTO = 720
const NAVY = '#0e1c2e'
const COLOR_RESPALDO = '#f5b82e'
const FUENTE = '"Barlow Condensed", "Roboto Condensed", "Arial Narrow", Impact, "Segoe UI", Arial, sans-serif'
const MAX_PARTIDOS = 6

// Carga una imagen con CORS (para poder exportar el canvas). Si no carga, devuelve null.
// El parámetro extra evita que el navegador reutilice una copia guardada sin permisos CORS.
function cargarImg(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src.startsWith('/') || src.startsWith('data:') ? src : src + (src.includes('?') ? '&' : '?') + 'gmcors=1'
  })
}

function luminancia(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
const aHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

// Color más "vivo" del logo (ignora blancos, negros y grises). Sin logo o sin color claro → amarillo de respaldo.
export function colorDominante(img) {
  if (!img) return COLOR_RESPALDO
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')
    x.drawImage(img, 0, 0, 64, 64)
    const datos = x.getImageData(0, 0, 64, 64).data
    const cubos = new Map()
    for (let i = 0; i < datos.length; i += 4) {
      const a = datos[i + 3]
      if (a < 200) continue
      const r = datos[i], g = datos[i + 1], b = datos[i + 2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 510
      const sat = max === 0 ? 0 : (max - min) / max
      if (l < 0.18 || l > 0.9 || sat < 0.3) continue
      const clave = `${r >> 5}-${g >> 5}-${b >> 5}`
      const e = cubos.get(clave) || { n: 0, r: 0, g: 0, b: 0, sat: 0 }
      e.n++; e.r += r; e.g += g; e.b += b; e.sat += sat
      cubos.set(clave, e)
    }
    let mejor = null
    cubos.forEach(e => { const puntaje = e.n * (0.5 + e.sat / e.n); if (!mejor || puntaje > mejor.puntaje) mejor = { ...e, puntaje } })
    if (!mejor || mejor.n < 12) return COLOR_RESPALDO
    return aHex(mejor.r / mejor.n, mejor.g / mejor.n, mejor.b / mejor.n)
  } catch {
    return COLOR_RESPALDO
  }
}

// Parte `texto` en líneas (máximo `maxLineas`) usando la letra más grande posible, entre `max` y `min` px.
function ajustarBloque(ctx, texto, ancho, { max, min, maxLineas, peso = 800 }) {
  const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean)
  for (let t = max; t >= min; t -= 2) {
    ctx.font = `${peso} ${t}px ${FUENTE}`
    const lineas = []
    let actual = ''
    for (const w of palabras) {
      const prueba = actual ? `${actual} ${w}` : w
      if (ctx.measureText(prueba).width <= ancho || !actual) { actual = prueba } else { lineas.push(actual); actual = w }
    }
    if (actual) lineas.push(actual)
    if (lineas.length <= maxLineas && lineas.every(l => ctx.measureText(l).width <= ancho)) return { lineas, tam: t }
  }
  ctx.font = `${peso} ${min}px ${FUENTE}`
  return { lineas: [String(texto || '')], tam: min }
}

// Una línea que cabe en `ancho`: baja la letra hasta que entre.
function lineaAjustada(ctx, texto, x, y, ancho, tam, { peso = 800, minimo = 22 } = {}) {
  let t = tam
  do {
    ctx.font = `${peso} ${t}px ${FUENTE}`
    t -= 2
  } while (ctx.measureText(texto).width > ancho && t > minimo)
  ctx.fillText(texto, x, y)
}

// Dibuja el escudo ajustado (sin deformar) dentro de un cuadro, con sombra suave; sin imagen, un círculo con las iniciales.
function escudo(ctx, img, nombre, cx, cy, lado) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = lado * 0.08; ctx.shadowOffsetY = lado * 0.03
  if (img) {
    const k = Math.min(lado / img.width, lado / img.height)
    const w = img.width * k, h = img.height * k
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  } else {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(cx, cy, lado / 2, 0, Math.PI * 2); ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = NAVY
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `800 ${Math.round(lado * 0.4)}px ${FUENTE}`
    const iniciales = (nombre || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
    ctx.fillText(iniciales, cx, cy + lado * 0.02)
  }
  ctx.restore()
}

export async function generarPortada({ torneo, partidos }) {
  const lista = (partidos || []).slice(0, MAX_PARTIDOS)
  if (document.fonts?.load) {
    try { await Promise.all([document.fonts.load(`800 40px "Barlow Condensed"`), document.fonts.load(`700 40px "Barlow Condensed"`)]) } catch { /* se usa la letra de respaldo */ }
  }
  const [logoTorneo, marca, ...escudos] = await Promise.all([
    cargarImg(torneo?.logo_url),
    cargarImg('/marca/watermark-logo.png'),
    ...lista.flatMap(p => [cargarImg(p.home?.logo_url), cargarImg(p.away?.logo_url)]),
  ])
  const fondo = colorDominante(logoTorneo)
  const claro = luminancia(fondo) > 0.55
  const texto = claro ? NAVY : '#ffffff'

  const canvas = document.createElement('canvas')
  canvas.width = ANCHO; canvas.height = ALTO
  const ctx = canvas.getContext('2d')

  // Panel de color (con un degradado muy suave para que no se vea plano), franja clara en diagonal y panel oscuro de los escudos
  const gf = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  gf.addColorStop(0, fondo); gf.addColorStop(1, fondo)
  ctx.fillStyle = gf; ctx.fillRect(0, 0, ANCHO, ALTO)
  const brillo = ctx.createLinearGradient(ANCHO, 0, 560, ALTO)
  brillo.addColorStop(0, 'rgba(255,255,255,.16)'); brillo.addColorStop(.6, 'rgba(255,255,255,0)'); brillo.addColorStop(1, 'rgba(0,0,0,.14)')
  ctx.fillStyle = brillo; ctx.fillRect(0, 0, ANCHO, ALTO)

  ctx.fillStyle = 'rgba(255,255,255,.95)'
  ctx.beginPath(); ctx.moveTo(548, 0); ctx.lineTo(584, 0); ctx.lineTo(494, ALTO); ctx.lineTo(458, ALTO); ctx.closePath(); ctx.fill()
  const gn = ctx.createLinearGradient(0, 0, 0, ALTO)
  gn.addColorStop(0, '#12253c'); gn.addColorStop(1, '#0a1626')
  ctx.fillStyle = gn
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(548, 0); ctx.lineTo(458, ALTO); ctx.lineTo(0, ALTO); ctx.closePath(); ctx.fill()

  // ── Escudos grandes a la izquierda ──
  const n = lista.length || 1
  const p0 = lista[0] || { home: { name: 'Equipo local' }, away: { name: 'Equipo visitante' } }
  if (n === 1) {
    escudo(ctx, escudos[0], p0.home?.name, 235, 190, 275)
    escudo(ctx, escudos[1], p0.away?.name, 235, 520, 275)
  } else {
    // una fila por partido: local | visitante. El panel se angosta hacia abajo, así que el par se corre a la izquierda
    const zonaTop = 50, zonaAlto = ALTO - 100
    const fila = zonaAlto / n
    const lado = Math.min(fila * 0.86, 190)
    lista.forEach((p, i) => {
      const cy = zonaTop + fila * (i + 0.5)
      const centro = 290 - (cy / ALTO) * 90
      const sep = lado * 0.62
      escudo(ctx, escudos[i * 2], p.home?.name, centro - sep, cy, lado)
      escudo(ctx, escudos[i * 2 + 1], p.away?.name, centro + sep, cy, lado)
    })
  }

  // ── Texto a la derecha: torneo (donde antes decía PARTIDO), equipos solo en texto y GOLMEBOL abajo ──
  const X = 640, ANCHO_TXT = ANCHO - X - 55
  ctx.fillStyle = texto
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'

  // Reparto del alto (de arriba hacia abajo): torneo · rayita · equipos · [espacio] · GOLMEBOL.
  // Primero se mide lo que ocupan los equipos y el torneo usa la letra más grande que quepa en lo que sobra.
  const TOPE = 40, FIN = 590, GAP_RAYA = 30, GAP_EQUIPOS = 40
  let bloqueEquipos
  if (n === 1) {
    const a = `${p0.home?.name || ''} vs.`, b = p0.away?.name || ''
    let t = 66
    do { ctx.font = `800 ${t}px ${FUENTE}`; t -= 2 } while ((ctx.measureText(a).width > ANCHO_TXT || ctx.measureText(b).width > ANCHO_TXT) && t > 30)
    const tam = t + 2
    bloqueEquipos = { tam, alto: tam * 0.8 + tam * 1.08 + tam * 0.2, dibujar: yy => { ctx.font = `800 ${tam}px ${FUENTE}`; ctx.fillText(a, X, yy + tam * 0.8); ctx.fillText(b, X, yy + tam * 0.8 + tam * 1.08) } }
  } else {
    const paso = Math.min(58, 250 / n)
    bloqueEquipos = { alto: paso * n, dibujar: yy => lista.forEach((p, k) => lineaAjustada(ctx, `${p.home?.name || ''} vs. ${p.away?.name || ''}`, X, yy + paso * k + paso * 0.74, ANCHO_TXT, Math.round(paso * 0.78), { peso: 700, minimo: 22 })) }
  }
  const altoTitulo = FIN - TOPE - GAP_RAYA - 6 - GAP_EQUIPOS - bloqueEquipos.alto
  const nombreTorneo = (torneo?.name || 'Torneo').toUpperCase()
  let bT = null
  for (let t = 128; t >= 40 && !bT; t -= 2) {
    const b = ajustarBloque(ctx, nombreTorneo, ANCHO_TXT, { max: t, min: t, maxLineas: 3, peso: 800 })
    if (b.lineas.length <= 3 && b.lineas.every(l => ctx.measureText(l).width <= ANCHO_TXT) && (b.lineas.length - 1) * t * 0.98 + t * 0.8 <= altoTitulo) bT = { ...b, tam: t }
  }
  if (!bT) bT = ajustarBloque(ctx, nombreTorneo, ANCHO_TXT, { max: 40, min: 40, maxLineas: 3, peso: 800 })
  const interT = bT.tam * 0.98
  const altoTituloReal = (bT.lineas.length - 1) * interT + bT.tam * 0.8
  // si sobra espacio, el bloque (torneo + equipos) se centra un poco en vertical
  const sobra = Math.max(0, altoTitulo - altoTituloReal)
  let y = TOPE + Math.min(sobra * 0.45, 60)
  ctx.fillStyle = texto
  ctx.font = `800 ${bT.tam}px ${FUENTE}`
  bT.lineas.forEach((l, k) => ctx.fillText(l, X, y + bT.tam * 0.8 + k * interT))
  y += altoTituloReal + GAP_RAYA
  ctx.fillStyle = claro ? 'rgba(14,28,46,.55)' : 'rgba(255,255,255,.6)'
  ctx.fillRect(X, y, 96, 6)
  ctx.fillStyle = texto
  y += 6 + GAP_EQUIPOS
  bloqueEquipos.dibujar(y)

  // GOLMEBOL, abajo
  const yMarca = 650
  let xM = X
  if (marca) {
    const alto = 54, k = alto / marca.height
    // el logo es blanco: sobre un fondo claro se tiñe de oscuro
    if (claro) {
      const t = document.createElement('canvas'); t.width = Math.round(marca.width * k); t.height = alto
      const tx = t.getContext('2d'); tx.drawImage(marca, 0, 0, t.width, t.height)
      tx.globalCompositeOperation = 'source-in'; tx.fillStyle = texto; tx.fillRect(0, 0, t.width, t.height)
      ctx.drawImage(t, X, yMarca - alto / 2)
    } else {
      ctx.drawImage(marca, X, yMarca - alto / 2, marca.width * k, alto)
    }
    xM = X + marca.width * k + 16
  }
  ctx.fillStyle = texto
  ctx.textBaseline = 'middle'
  ctx.font = `800 52px ${FUENTE}`
  ctx.fillText('GOLMEBOL', xM, yMarca + 3)

  return canvas
}

// PNG (si pesa menos de 2 MB, el límite de YouTube) o JPG
export function canvasABlob(canvas) {
  return new Promise(resolve => {
    canvas.toBlob(png => {
      if (png && png.size < 2 * 1024 * 1024) { resolve({ blob: png, ext: 'png' }); return }
      canvas.toBlob(jpg => resolve({ blob: jpg, ext: 'jpg' }), 'image/jpeg', 0.92)
    }, 'image/png')
  })
}
