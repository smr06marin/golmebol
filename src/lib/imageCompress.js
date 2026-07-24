// Comprime y redimensiona una imagen en el navegador ANTES de subirla a
// Supabase Storage. Las fotos que salen directo de la cámara del celular
// pesan varios MB — eso es lo que hace que toda la app se sienta lenta
// (cada lista de jugadores/equipos descarga esas fotos en tamaño completo
// aunque se muestren en miniaturas de 40px). Con esto, cualquier foto nueva
// queda liviana (normalmente <150-250kb) sin perder calidad visible.
//
// Uso: const archivoLiviano = await comprimirImagen(file)
//      const archivoLiviano = await comprimirImagen(file, { maxSize: 1200, calidad: 0.85 })

export function comprimirImagen(file, { maxSize = 900, calidad = 0.82 } = {}) {
  return new Promise((resolve) => {
    // Si no es una imagen que el navegador pueda decodificar (o algo falla),
    // seguimos con el archivo original en vez de romper la subida.
    if (!file || !file.type?.startsWith('image/')) { resolve(file); return }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width >= height) { height = Math.round(height * (maxSize / width)); width = maxSize }
          else { width = Math.round(width * (maxSize / height)); height = maxSize }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return }
          // Si por alguna razón el "comprimido" salió más pesado que el original
          // (pasa con imágenes ya muy livianas), nos quedamos con el original.
          if (blob.size >= file.size) { resolve(file); return }
          const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], nombre, { type: 'image/jpeg' }))
        }, 'image/jpeg', calidad)
      } catch {
        resolve(file)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
