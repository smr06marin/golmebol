// Helper compartido para descargar/compartir los flyers (torneo, partido,
// programación, QR de pedido) que se generan con html2canvas a partir de un
// DOM visible. Resuelve dos problemas que se repetían en todos los flyers:
//
// 1) "La imagen sale distinta a como se ve en pantalla": html2canvas toma la
//    foto del DOM en el momento exacto en que se lo llama — si algún <img>
//    (escudo, logo de equipo) o la tipografía (Poppins de Google Fonts, que
//    carga async) todavía no habían terminado de cargar, la captura salía
//    con huecos en vez de los escudos, o con la letra de respaldo en vez de
//    la que se ve en pantalla. Por eso acá SIEMPRE se espera a que las
//    imágenes y las fuentes terminen de cargar antes de capturar.
// 2) "Al descargar no queda en la galería del celular": un <a download> con
//    un data:URL, en el celular, guarda el archivo en Descargas/Archivos —
//    no en la Galería/Fotos. La Galería solo recibe imágenes guardadas
//    desde la hoja de compartir nativa ("Guardar imagen"/"Guardar en
//    Fotos"). Por eso en el celular se usa navigator.share con el archivo
//    (cuando el navegador lo soporta) en vez del link de descarga de
//    siempre, que queda solo como respaldo para computador.

async function esperarListoParaCapturar(container) {
  if (!container) return
  const imgs = Array.from(container.querySelectorAll('img'))
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res })))
  if (document.fonts?.ready) { try { await document.fonts.ready } catch (e) { /* no bloquea la captura */ } }
}

// Genera el PNG del flyer (esperando imágenes/fuentes primero) y lo manda a
// la hoja de compartir nativa del celular (para guardarlo directo en la
// Galería) o, si eso no está disponible, lo descarga como antes.
// `opcionesCanvas` son las opciones de html2canvas propias de cada flyer
// (scale, backgroundColor, width, height...).
export async function descargarFlyer(container, { filename, opcionesCanvas = {}, shareTitle } = {}) {
  if (!container) return
  await esperarListoParaCapturar(container)
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(container, { useCORS: true, allowTaint: true, ...opcionesCanvas })

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))

  if (blob && navigator.canShare && navigator.share) {
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: shareTitle || filename })
        return
      } catch (e) {
        // La persona cerró/canceló la hoja de compartir — no forzar además
        // la descarga de respaldo, ya vio la imagen y decidió no guardarla.
        if (e?.name === 'AbortError') return
      }
    }
  }

  // Respaldo (computador, o navegadores sin Web Share de archivos): el link
  // de descarga de toda la vida.
  const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.download = filename
  a.href = url
  a.click()
  if (blob) setTimeout(() => URL.revokeObjectURL(url), 4000)
}
