import { armarPalmares, resumenPalmares } from './palmaresJugador'

// ── Tarjeta del jugador dibujada DIRECTO en un canvas ───────────────────────
// Antes se armaba con HTML y se convertía en imagen con html2canvas (una librería
// pesada que además tardaba varios segundos en celulares modestos). Dibujarla
// directo en el canvas toma una fracción de segundo, no necesita descargar nada
// extra y se ve idéntica en todos los teléfonos.
//
// Formato 9:16 (1080×1920 en la imagen final): el de los estados de WhatsApp e
// Instagram. Todo va en coordenadas fijas de un lienzo de 360×640.

export const W = 360
export const H = 640
export const ESCALA = 3

const TITULAR = "'Barlow Condensed', 'Bebas Neue', 'Arial Narrow', system-ui, sans-serif"
const MARCA = "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const TEXTO = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"


// ── Colores de la tarjeta = colores del escudo del equipo ───────────────────
function hslARgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}
export const rgbCss = (c, a) => (a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`)
const luminancia = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }

function armarTema(c) {
  return { ...c, textoAcento: luminancia(c.acento) > 0.35 ? rgbCss(c.fondo) : '#ffffff' }
}
export const TEMA_GOLMEBOL = armarTema({
  fondo: [5, 11, 31], alto: [18, 58, 143], medio: [10, 31, 92],
  acento: [245, 200, 0], acentoFin: [255, 224, 102], suave: [157, 176, 224],
})
function temaDeTono(h) {
  return armarTema({
    fondo: hslARgb(h, 55, 7), alto: hslARgb(h, 70, 30), medio: hslARgb(h, 65, 16),
    acento: hslARgb(h, 92, h > 38 && h < 70 ? 52 : 58), acentoFin: hslARgb(h, 95, 70), suave: hslARgb(h, 45, 74),
  })
}

// Tema sacado del escudo (imagen ya cargada). Sin escudo o sin color: azul y dorado de Golmebol.
export function temaDesdeImagen(img) {
  if (!img) return TEMA_GOLMEBOL
  try {
    const N = 48
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N
    const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(img, 0, 0, N, N)
    const px = cx.getImageData(0, 0, N, N).data
    const cubos = Array.from({ length: 36 }, () => ({ peso: 0, sumaH: 0, n: 0 }))
    let opacos = 0
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue
      opacos++
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
      const l = (mx + mn) / 2
      if (d === 0 || l < 0.15 || l > 0.88) continue
      const sat = d / (1 - Math.abs(2 * l - 1))
      if (sat < 0.3) continue
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
      h = (h * 60 + 360) % 360
      const c = cubos[Math.floor(h / 10) % 36]
      c.peso += sat; c.sumaH += h; c.n++
    }
    const mejor = cubos.reduce((a, c) => (c.peso > a.peso ? c : a), cubos[0])
    if (!opacos || mejor.n < opacos * 0.04) return TEMA_GOLMEBOL
    return temaDeTono(mejor.sumaH / mejor.n)
  } catch {
    return TEMA_GOLMEBOL
  }
}

// ── Modelo: qué datos lleva la tarjeta (sin dibujar nada) ───────────────────
const puestoVisible = p => (p && p.n && p.de && p.n / p.de <= 0.5 ? p : null)

function partirNombre(nombre) {
  const w = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (w.length <= 1) return [w[0] || '', '']
  const corte = Math.ceil(w.length / 2)
  return [w.slice(0, corte).join(' '), w.slice(corte).join(' ')]
}

export function armarModelo({ jugador, totales, puestos, equipoActual, posicion, arq, porTorneo = [], logros = [], partidos = [] }) {
  const PL = puestos?.plataforma || {}
  const torneosJugados = (porTorneo || []).filter(t => t?.torneo?.id)
  const palmares = armarPalmares(logros, partidos, porTorneo)

  const cifras = arq
    ? [
        { valor: totales.pj, etiqueta: 'Partidos', puesto: PL.pj },
        { valor: totales.g || 0, etiqueta: 'Ganados', puesto: PL.g },
        { valor: arq.arcosEnCero, etiqueta: 'Arcos en 0', puesto: PL.arqCero, unidad: 'arqueros' },
        { valor: arq.pj > 0 ? arq.promedio.toFixed(1) : '0.0', etiqueta: 'Prom. rec.', puesto: PL.arqProm, unidad: 'arqueros' },
      ]
    : [
        { valor: totales.pj, etiqueta: 'Partidos', puesto: PL.pj },
        { valor: totales.g || 0, etiqueta: 'Ganados', puesto: PL.g },
        { valor: totales.goles, etiqueta: 'Goles', puesto: PL.goles },
        { valor: totales.mvp, etiqueta: 'MVP', puesto: PL.mvp },
      ]

  const partidosResultado = (totales.g || 0) + (totales.e || 0) + (totales.p || 0)
  const mini = arq
    ? [
        { valor: torneosJugados.length, etiqueta: 'Torneos' },
        { valor: arq.penalesAtajados == null ? '—' : arq.penalesAtajados, etiqueta: 'Pen. atajados' },
        { valor: arq.rachaMax || 0, etiqueta: 'Mejor racha en 0' },
        { valor: arq.pj > 0 ? `${arq.pctArcoEnCero}%` : '—', etiqueta: '% arco en 0' },
      ]
    : [
        { valor: torneosJugados.length, etiqueta: 'Torneos' },
        { valor: totales.hatTricks || 0, etiqueta: 'Hat-tricks' },
        { valor: totales.pj > 0 ? (totales.goles / totales.pj).toFixed(2) : '0.00', etiqueta: 'Goles / partido' },
        { valor: partidosResultado > 0 ? `${Math.round(((totales.g || 0) / partidosResultado) * 100)}%` : '—', etiqueta: '% victorias' },
      ]

  // Reconocimientos: SOLO de torneos finalizados y SOLO lo que no se ve ya en las cifras de arriba
  // (el MVP, los goles y los puestos frente a los demás ya están arriba). Cada uno dice qué es, cuántas veces y dónde.
  const PRIMERO = new Set(['goleador', 'valla_menos_vencida', 'mejor_jugador', 'mejor_arquero', 'mejor_portero'])
  const TITULOS = {
    goleador:            ['GOLEADOR DEL TORNEO', 'GOLEADOR DE TORNEOS'],
    valla_menos_vencida: ['VALLA MENOS VENCIDA', 'VALLA MENOS VENCIDA'],
    mejor_jugador:       ['MEJOR JUGADOR', 'MEJOR JUGADOR'],
    mejor_arquero:       ['MEJOR ARQUERO', 'MEJOR ARQUERO'],
    mejor_portero:       ['MEJOR ARQUERO', 'MEJOR ARQUERO'],
  }
  const reconocimientos = []
  const goleadorEn = new Set()
  palmares.premios.forEach(p => {
    if (p.tipo === 'goleador') p.ids.forEach(id => goleadorEn.add(id))
    const [uno, varios] = TITULOS[p.tipo] || [p.etiqueta, p.etiqueta]
    const detalle = p.torneos.length === 0 ? '' : p.n === 1 || p.torneos.length === 1 ? p.torneos[0] : `${p.torneos[0]} +${p.n - 1}`
    reconocimientos.push({ valor: PRIMERO.has(p.tipo) && p.n === 1 ? '1°' : String(p.n), titulo: p.n === 1 ? uno : varios, detalle })
  })
  // Podio dentro de un torneo FINALIZADO (1.º a 3.º) cuando todavía no tiene guardado su premio
  const cerrados = new Set(palmares.cerrados)
  const claveT = arq ? 'arqCero' : 'goles'
  const deTorneo = []
  torneosJugados.forEach(t => {
    const p = (puestos?.torneos?.[t.torneo.id] || {})[claveT]
    if (!cerrados.has(t.torneo.id) || !p || p.n > 3 || p.de < 6) return
    if (claveT === 'goles' && p.n === 1 && goleadorEn.has(t.torneo.id)) return   // ya sale como "Goleador del torneo"
    deTorneo.push({ n: p.n, valor: `${p.n}°`, titulo: arq ? 'EN ARCOS EN 0' : 'EN GOLES DEL TORNEO', detalle: String(t.torneo.name || '') })
  })
  deTorneo.sort((a, b) => a.n - b.n).slice(0, 2).forEach(({ valor, titulo, detalle }) => reconocimientos.push({ valor, titulo, detalle }))

  const [nom1, nom2] = partirNombre(jugador.name)
  return {
    nombre: jugador.name || '',
    nombrePila: nom2 ? nom1 : '',
    apellido: nom2 || nom1,
    equipo: equipoActual?.name || '',
    posicion: posicion || '',
    cifras, mini, reconocimientos, palmares,
    resumen: resumenPalmares(palmares.conteo),
  }
}

// ── Dibujo ──────────────────────────────────────────────────────────────────
const fuente = (ctx, peso, tam, fam) => { ctx.font = `${peso} ${tam}px ${fam}` }

function anchoTexto(ctx, s, esp) {
  if (!esp) return ctx.measureText(s).width
  let a = 0
  for (const ch of s) a += ctx.measureText(ch).width + esp
  return a - esp
}

function ajustar(ctx, s, maxW, esp) {
  if (!maxW || anchoTexto(ctx, s, esp) <= maxW) return s
  let t = s
  while (t.length > 1 && anchoTexto(ctx, `${t}…`, esp) > maxW) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

// y = línea base. Con `esp` (separación entre letras) se dibuja letra por letra:
// ctx.letterSpacing no existe en todos los celulares.
function texto(ctx, s, x, y, { peso = 700, tam = 10, fam = TEXTO, color = '#fff', align = 'left', esp = 0, maxW, sombra } = {}) {
  if (s == null || s === '') return 0
  fuente(ctx, peso, tam, fam)
  const str = ajustar(ctx, String(s), maxW, esp)
  const w = anchoTexto(ctx, str, esp)
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  ctx.save()
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1 }
  if (!esp) ctx.fillText(str, x0, y)
  else { let cx = x0; for (const ch of str) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + esp } }
  ctx.restore()
  return w
}

function rectRedondo(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Encuadre de la foto dentro del recuadro (w×h). Con `foco` (dónde está la cara, ver focoRostro.js)
// se acomoda para que se vean los OJOS bien arriba y la cara completa; si la cara sale chica se
// acerca (zoom). Sin foco: encuadre de siempre (arriba de la foto).
export function encuadreFoto(iw, ih, w, h, foco) {
  const r0 = Math.max(w / iw, h / ih)
  if (!foco) return { r: r0, dx: (w - iw * r0) / 2, dy: (h - ih * r0) * 0.18 }
  const CARA_IDEAL = 104                       // ancho de la cara en la tarjeta (px de 360)
  const rCara = CARA_IDEAL / Math.max(1, foco.ancho * iw)
  const r = Math.min(Math.max(r0, rCara), r0 * 2.2)
  const OJOS_Y = h * 0.33                      // dónde quedan los ojos (arriba del nombre)
  let dx = w / 2 - foco.cx * iw * r
  let dy = OJOS_Y - foco.ojos * ih * r
  dx = Math.min(0, Math.max(w - iw * r, dx))
  dy = Math.min(0, Math.max(h - ih * r, dy))
  return { r, dx, dy }
}

function contener(ctx, img, x, y, w, h) {
  if (!img) return
  const r = Math.min(w / img.width, h / img.height)
  const dw = img.width * r, dh = img.height * r
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function escudito(ctx, img, cx, cy, d) {
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill()
  contener(ctx, img, cx - d / 2 + 2, cy - d / 2 + 2, d - 4, d - 4)
  ctx.restore()
}

const METALES = {
  oro:    { a: '#ffd84a', b: '#e8a900', texto: '#3b2a00' },
  plata:  { a: '#eef1f6', b: '#aab3c0', texto: '#1f2733' },
  bronce: { a: '#e3a46a', b: '#b06a2c', texto: '#2e1800' },
}

// Etiqueta de la fase (CAMPEÓN, SUBCAMPEÓN…) con ancho fijo
function etiquetaFase(ctx, f, x, cy, w, tema, h = 17, tamMax = 8) {
  const y = cy - h / 2
  ctx.save()
  if (f.metal) {
    const m = METALES[f.metal]
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, m.a); g.addColorStop(1, m.b)
    ctx.fillStyle = g
    rectRedondo(ctx, x, y, w, h, 4); ctx.fill()
  } else {
    const participo = f.tipo === 'fase_grupos'
    ctx.lineWidth = 1
    ctx.strokeStyle = participo ? 'rgba(255,255,255,.34)' : rgbCss(tema.acento, .9)
    rectRedondo(ctx, x + .5, y + .5, w - 1, h - 1, 4); ctx.stroke()
  }
  ctx.restore()
  const color = f.metal ? METALES[f.metal].texto : f.tipo === 'fase_grupos' ? 'rgba(255,255,255,.7)' : rgbCss(tema.acento)
  let tam = tamMax
  fuente(ctx, 900, tam, TEXTO)
  while (tam > 5 && anchoTexto(ctx, f.etiqueta, 0.6) > w - 8) { tam -= 0.5; fuente(ctx, 900, tam, TEXTO) }
  texto(ctx, f.etiqueta, x + w / 2, cy + tam * 0.36, { peso: 900, tam, color, align: 'center', esp: 0.6 })
}

// d = modelo (armarModelo) + { foto, escudo, qr, tema }
export function dibujarTarjeta(canvas, d) {
  canvas.width = W * ESCALA
  canvas.height = H * ESCALA
  const ctx = canvas.getContext('2d')
  ctx.scale(ESCALA, ESCALA)
  ctx.imageSmoothingQuality = 'high'
  const tema = d.tema || TEMA_GOLMEBOL
  const acento = rgbCss(tema.acento)
  const fondo = rgbCss(tema.fondo)
  const FOTO_H = 240

  // Fondo
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, W, H)

  // ── FOTO ──
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, FOTO_H); ctx.clip()
  const gf = ctx.createLinearGradient(W * 0.3, 0, W * 0.7, FOTO_H)
  gf.addColorStop(0, rgbCss(tema.alto)); gf.addColorStop(0.6, rgbCss(tema.medio)); gf.addColorStop(1, fondo)
  ctx.fillStyle = gf
  ctx.fillRect(0, 0, W, FOTO_H)
  if (d.foto) {
    const e = encuadreFoto(d.foto.width, d.foto.height, W, FOTO_H, d.foco)
    ctx.drawImage(d.foto, e.dx, e.dy, d.foto.width * e.r, d.foto.height * e.r)
  }
  else {
    // sin foto: silueta
    ctx.fillStyle = 'rgba(255,255,255,.14)'
    ctx.beginPath(); ctx.arc(W / 2, 92, 38, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(W / 2, 190, 78, 62, 0, Math.PI, 0); ctx.fill()
  }
  const so = ctx.createLinearGradient(0, 0, 0, FOTO_H)
  so.addColorStop(0, rgbCss(tema.fondo, 0.72)); so.addColorStop(0.26, rgbCss(tema.fondo, 0))
  so.addColorStop(0.4, rgbCss(tema.fondo, 0)); so.addColorStop(0.78, rgbCss(tema.fondo, 0.82)); so.addColorStop(1, fondo)
  ctx.fillStyle = so
  ctx.fillRect(0, 0, W, FOTO_H)
  ctx.restore()

  // Franja de color arriba
  ctx.fillStyle = acento
  ctx.fillRect(0, 0, W, 3)

  // ── ENCABEZADO ──
  texto(ctx, 'GOLMEBOL', 20, 28, { peso: 900, tam: 12, fam: MARCA, esp: 3.8 })
  texto(ctx, 'RESUMEN DEL JUGADOR', W - 20, 27, { peso: 800, tam: 8.5, color: 'rgba(255,255,255,.92)', align: 'right', esp: 1.7, sombra: true })

  // ── NOMBRE · EQUIPO · POSICIÓN ──
  const tamAp = d.apellido.length > 16 ? 30 : d.apellido.length > 12 ? 38 : 48
  const topNombre = 124
  if (d.nombrePila) texto(ctx, d.nombrePila.toUpperCase(), 20, topNombre + 18, { peso: 600, tam: 22, fam: TITULAR, color: 'rgba(255,255,255,.88)', esp: 3.5, maxW: W - 40 })
  texto(ctx, d.apellido.toUpperCase(), 20, topNombre + (d.nombrePila ? 22 : 12) + tamAp * 0.86, { peso: 900, tam: tamAp, fam: TITULAR, maxW: W - 40 })

  const yEq = topNombre + 112 - 13
  let xEq = 20
  if (d.escudo) { escudito(ctx, d.escudo, 32, yEq, 24); xEq = 32 + 12 + 8 }
  let anchoPos = 0
  if (d.posicion) {
    fuente(ctx, 800, 9, TEXTO)
    anchoPos = anchoTexto(ctx, d.posicion.toUpperCase(), 0.9) + 14
  }
  if (d.equipo) {
    const w = texto(ctx, d.equipo.toUpperCase(), xEq, yEq + 4.5, { peso: 800, tam: 12.5, esp: 0.25, maxW: W - 20 - xEq - (anchoPos ? anchoPos + 8 : 0) })
    xEq += w + 8
  }
  if (d.posicion) {
    ctx.fillStyle = acento
    rectRedondo(ctx, xEq, yEq - 7.5, anchoPos, 15, 4); ctx.fill()
    texto(ctx, d.posicion.toUpperCase(), xEq + anchoPos / 2, yEq + 3, { peso: 800, tam: 9, color: tema.textoAcento, align: 'center', esp: 0.9 })
  }

  // ── CIFRAS ──
  ctx.fillStyle = acento
  rectRedondo(ctx, 20, 246, 34, 3, 1.5); ctx.fill()
  const celda = (W - 40) / 4
  d.cifras.forEach((c, i) => {
    const cx = 20 + celda * i + celda / 2
    if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(20 + celda * i, 258, 1, 66) }
    texto(ctx, String(c.valor), cx, 286, { peso: 800, tam: 34, fam: TITULAR, align: 'center' })
    texto(ctx, c.etiqueta.toUpperCase(), cx, 299, { peso: 800, tam: 7.5, color: rgbCss(tema.suave), align: 'center', esp: 0.9 })
    // Posición en el ranking: "12° RANKING" + "de 1641 jugadores" (así se entiende que es un puesto)
    const p = puestoVisible(c.puesto)
    if (p) {
      const num = `${p.n}°`
      fuente(ctx, 800, 15, TITULAR)
      const wn = ctx.measureText(num).width
      fuente(ctx, 800, 6.5, TEXTO)
      const wr = anchoTexto(ctx, 'RANKING', 0.6)
      const x0 = cx - (wn + 3 + wr) / 2
      texto(ctx, num, x0, 316, { peso: 800, tam: 15, fam: TITULAR, color: acento })
      texto(ctx, 'RANKING', x0 + wn + 3, 316, { peso: 800, tam: 6.5, color: rgbCss(tema.suave), esp: 0.6 })
      texto(ctx, `de ${p.de} ${c.unidad || 'jugadores'}`, cx, 326, { peso: 700, tam: 6.8, color: rgbCss(tema.suave, 0.85), align: 'center', maxW: celda - 2 })
    }
  })

  // ── FILA 2: datos extra ──
  ctx.fillStyle = 'rgba(255,255,255,.07)'
  rectRedondo(ctx, 20, 336, W - 40, 32, 7); ctx.fill()
  d.mini.forEach((c, i) => {
    const cx = 20 + celda * i + celda / 2
    if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(20 + celda * i, 342, 1, 20) }
    texto(ctx, String(c.valor), cx, 351, { peso: 800, tam: 15, fam: TITULAR, align: 'center' })
    texto(ctx, c.etiqueta.toUpperCase(), cx, 362, { peso: 700, tam: 6, color: rgbCss(tema.suave), align: 'center', esp: 0.5, maxW: celda - 6 })
  })

  // ── PALMARÉS ──
  const FOOT = 600
  const yCab = 388
  texto(ctx, 'PALMARÉS', 20, yCab, { peso: 900, tam: 9, color: acento, esp: 2.2 })
  if (d.resumen.length) {
    fuente(ctx, 700, 7.5, TEXTO)
    let r = ''
    d.resumen.forEach(parte => { const prueba = r ? `${r} · ${parte}` : parte; if (anchoTexto(ctx, prueba, 0.4) <= 236) r = prueba })
    texto(ctx, r, W - 20, yCab, { peso: 700, tam: 7.5, color: rgbCss(tema.suave), align: 'right', esp: 0.4 })
  }
  ctx.fillStyle = 'rgba(255,255,255,.14)'
  ctx.fillRect(20, yCab + 6, W - 40, 1)

  // RECONOCIMIENTOS: cuadritos de 2 columnas pegados al pie (máx. 4). Cada uno: cifra grande + qué es + dónde.
  const items = d.reconocimientos.slice(0, 4)
  const filasItems = Math.ceil(items.length / 2)
  const PASO_IT = 34, ALTO_IT = 30, CAB_IT = 14
  const bloqueAlto = items.length ? CAB_IT + filasItems * PASO_IT - 4 : 0
  const chipsTop = FOOT - 4 - bloqueAlto
  if (items.length) {
    texto(ctx, 'RECONOCIMIENTOS', 20, chipsTop + 8, { peso: 900, tam: 9, color: acento, esp: 2.2 })
    items.forEach((it, i) => {
      const completo = items.length % 2 === 1 && i === items.length - 1
      const ancho = completo ? W - 40 : (W - 40 - 8) / 2
      const x = 20 + (completo ? 0 : (i % 2) * (ancho + 8))
      const y = chipsTop + CAB_IT + Math.floor(i / 2) * PASO_IT
      ctx.fillStyle = 'rgba(255,255,255,.07)'
      rectRedondo(ctx, x, y, ancho, ALTO_IT, 7); ctx.fill()
      ctx.fillStyle = acento
      rectRedondo(ctx, x, y + 5, 3, ALTO_IT - 10, 1.5); ctx.fill()
      fuente(ctx, 900, 20, TITULAR)
      const wv = Math.max(ctx.measureText(it.valor).width, 20)
      texto(ctx, it.valor, x + 12, y + ALTO_IT / 2 + 7, { peso: 900, tam: 20, fam: TITULAR, color: acento })
      const xt = x + 12 + wv + 8
      texto(ctx, it.titulo, xt, y + 13, { peso: 800, tam: 7.4, esp: 0.3, maxW: x + ancho - 6 - xt })
      texto(ctx, it.detalle, xt, y + 23, { peso: 600, tam: 7.2, color: rgbCss(tema.suave), maxW: x + ancho - 6 - xt })
    })
  }

  // filas del palmarés: las 3 mejores en grande (torneo + equipo), el resto en una sola línea
  const y0 = yCab + 12
  const GRANDE = 28, CHICA = 17, N_GRANDES = 3
  const finFilas = (items.length ? chipsTop : FOOT) - 4
  const filas = d.palmares.filas
  const altoDe = i => (i < N_GRANDES ? GRANDE : CHICA)
  let usado = 0, caben = 0
  for (let i = 0; i < filas.length; i++) {
    if (y0 + usado + altoDe(i) > finFilas) break
    usado += altoDe(i); caben++
  }
  // Si no entran todas las filas, se deja una línea para "+ N más en mi perfil".
  const importantes = filas.length
  let hayMas = false
  if (caben < importantes) {
    hayMas = true
    while (caben > 1 && y0 + usado + CHICA > finFilas) { caben--; usado -= altoDe(caben) }
  }
  const PILL = 92, PILL_CHICA = 74
  let yy = y0
  filas.slice(0, caben).forEach((f, i) => {
    const alto = altoDe(i)
    const ultima = i === caben - 1 && !hayMas
    if (alto === GRANDE) {
      const cy = yy + 12
      etiquetaFase(ctx, f, 20, cy, PILL, tema, 17, 8)
      const xt = 20 + PILL + 9
      const sub = f.season ? String(f.season) : ''
      texto(ctx, f.torneo, xt, cy - 1.5, { peso: 800, tam: 14, fam: TITULAR, maxW: W - 20 - xt })
      let xs = xt
      const esc = f.equipo?.id && d.escudosCache?.[f.equipo.id]
      if (esc) { escudito(ctx, esc, xt + 6, cy + 8.5, 12); xs = xt + 16 }
      const linea2 = [f.equipo?.name ? f.equipo.name.toUpperCase() : '', sub].filter(Boolean).join('  ·  ')
      texto(ctx, linea2, xs, cy + 12, { peso: 700, tam: 7.5, color: rgbCss(tema.suave), esp: 0.3, maxW: W - 20 - xs })
    } else {
      const cy = yy + 8
      etiquetaFase(ctx, f, 20, cy, PILL_CHICA, tema, 13, 6.5)
      const xt = 20 + PILL_CHICA + 8
      const der = [f.equipo?.name ? f.equipo.name.toUpperCase() : '', f.season ? String(f.season) : ''].filter(Boolean).join(' · ')
      fuente(ctx, 700, 7, TEXTO)
      const wDer = der ? Math.min(anchoTexto(ctx, der, 0.3), 104) : 0
      texto(ctx, der, W - 20, cy + 2.6, { peso: 700, tam: 7, color: rgbCss(tema.suave), align: 'right', esp: 0.3, maxW: 104 })
      texto(ctx, f.torneo, xt, cy + 4, { peso: 800, tam: 12, fam: TITULAR, maxW: W - 20 - xt - wDer - 8 })
    }
    if (!ultima) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(20, yy + alto - 2, W - 40, 1) }
    yy += alto
  })
  if (hayMas) {
    texto(ctx, `+ ${importantes - caben} más en mi perfil`, 20, yy + 11, { peso: 800, tam: 8.5, color: acento, esp: 0.8 })
  }
  // Si sobra espacio (pocos logros), una invitación en lugar de un hueco vacío
  const libreHasta = finFilas
  if (!items.length && libreHasta - (y0 + usado) >= 62) {
    const bh = Math.min(70, libreHasta - (y0 + usado) - 10), by = libreHasta - bh
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,.05)'
    rectRedondo(ctx, 20, by, W - 40, bh, 10); ctx.fill()
    ctx.setLineDash([4, 3]); ctx.strokeStyle = rgbCss(tema.acento, 0.5); ctx.lineWidth = 1
    rectRedondo(ctx, 20.5, by + .5, W - 41, bh - 1, 10); ctx.stroke()
    ctx.restore()
    const t1 = filas.length === 0 ? 'SU HISTORIA APENAS EMPIEZA' : 'CADA PARTIDO SUMA'
    texto(ctx, t1, W / 2, by + bh / 2 - 1, { peso: 800, tam: 17, fam: TITULAR, color: acento, align: 'center', esp: 1.6 })
    texto(ctx, 'Sigue mi camino y mis estadísticas en golmebol.com', W / 2, by + bh / 2 + 14, { peso: 600, tam: 8.5, color: rgbCss(tema.suave), align: 'center' })
  }

  // ── PIE: marca + QR ──
  texto(ctx, 'golmebol.com', 20, FOOT + 16, { peso: 900, tam: 13, fam: MARCA, esp: 0.5 })
  texto(ctx, 'Escanea y mira mi perfil completo', 20, FOOT + 29, { peso: 600, tam: 8.5, color: rgbCss(tema.suave) })
  if (d.qr) {
    ctx.fillStyle = '#fff'
    rectRedondo(ctx, W - 20 - 36, FOOT + 1, 36, 36, 5); ctx.fill()
    ctx.drawImage(d.qr, W - 20 - 34, FOOT + 3, 32, 32)
  }
  return canvas
}
