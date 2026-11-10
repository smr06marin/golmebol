// Convierte la tarjeta del jugador (components/card/PlayerCard) en una imagen PNG, tal cual se ve.
//
// La tarjeta se dibuja en SVG, así que la imagen se arma juntando sus capas en un solo SVG
// (fondo + foto + frente) y pintándolo en un canvas. Es nítida a cualquier tamaño (sirve para imprimir)
// y no depende de librerías de "captura de pantalla".
const ANCHO = 340, ALTO = 520
const CSS_FUENTE = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap'

const aDataUrl = blob => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(blob) })

// La letra de la tarjeta (Bebas Neue) hay que meterla dentro de la imagen; si no se puede bajar, queda una letra parecida.
let _fuente = null
async function fuenteIncrustada(urlCss) {
  if (_fuente !== null) return _fuente
  try {
    const css = await (await fetch(urlCss)).text()
    const bloques = css.split('@font-face').slice(1)
    const latino = bloques.find(b => /U\+0000-00FF/i.test(b)) || bloques[bloques.length - 1]
    const url = latino.match(/url\(([^)]+)\)/)[1].replace(/["']/g, '')
    const datos = await aDataUrl(await (await fetch(new URL(url, urlCss))).blob())
    _fuente = `@font-face{font-family:'Bebas Neue';src:url(${datos}) format('woff2');}`
  } catch { _fuente = '' }
  return _fuente
}

export async function tarjetaAPng(contenedor, { fondo = '#07070e', escala = 3, margen = 20, urlFuenteCss = CSS_FUENTE } = {}) {
  const capas = [...contenedor.querySelectorAll(`svg[viewBox="0 0 ${ANCHO} ${ALTO}"]`)]
  if (capas.length < 2) throw new Error('No se encontró la tarjeta')
  const [capaFondo, capaFrente] = capas
  const recorte = capaFondo.querySelector('clipPath')?.id
  const foto = contenedor.querySelector('img[data-foto-tarjeta]')

  let fotoSvg = ''
  if (foto?.src) {
    const datos = await aDataUrl(await (await fetch(foto.src, { mode: 'cors' })).blob())
    fotoSvg = `<image href="${datos}" x="0" y="0" width="${ANCHO}" height="${(ALTO * 0.63).toFixed(1)}" preserveAspectRatio="xMidYMin slice"${recorte ? ` clip-path="url(#${recorte})"` : ''}/>`
  }
  const estilo = await fuenteIncrustada(urlFuenteCss)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${ANCHO} ${ALTO}" width="${ANCHO * escala}" height="${ALTO * escala}">`
    + `<style>${estilo}.gmc-brillo,.gmc-pista{display:none}</style>`
    + capaFondo.innerHTML + fotoSvg + capaFrente.innerHTML + '</svg>'

  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = () => mal(new Error('No se pudo dibujar la tarjeta')); img.src = url })
    const lienzo = document.createElement('canvas')
    lienzo.width = (ANCHO + margen * 2) * escala
    lienzo.height = (ALTO + margen * 2) * escala
    const ctx = lienzo.getContext('2d')
    if (fondo) { ctx.fillStyle = fondo; ctx.fillRect(0, 0, lienzo.width, lienzo.height) }
    ctx.drawImage(img, margen * escala, margen * escala, ANCHO * escala, ALTO * escala)
    return lienzo.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}
