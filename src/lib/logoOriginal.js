import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// "Volver al original" de un logo/escudo al que se le quitó el fondo.
//
// Cada vez que se le quita el fondo a un logo (con el botón "✨ Quitar fondo" o
// automáticamente al subirlo), se guarda una copia de cómo era ANTES en la
// carpeta "originales/" del mismo almacenamiento, con el mismo nombre de archivo
// que el logo nuevo. Así la copia siempre corresponde a ESE logo y nunca a otro
// anterior. Si existe, el botón "↩️ Volver al original" aparece y la restaura.
//
// Solo cubre los cambios hechos desde que existe esta función.

function nombreDeArchivo(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || null } catch { return null }
}

function rutaOriginal(urlLogo) {
  const n = nombreDeArchivo(urlLogo)
  return n ? `originales/${n}` : null
}

// Guarda el "antes" (File/Blob) del logo cuya URL pública es urlLogoNuevo. No lanza error: si falla, el logo
// nuevo igual se guarda (solo no habrá botón para volver).
export async function guardarOriginal(bucket, urlLogoNuevo, blob) {
  try {
    const ruta = rutaOriginal(urlLogoNuevo)
    if (!ruta || !blob) return false
    const { error } = await supabase.storage.from(bucket).upload(ruta, blob, { upsert: true, contentType: blob.type || 'image/png' })
    return !error
  } catch { return false }
}

// Igual que guardarOriginal pero partiendo de la URL del logo de antes (lo descarga).
export async function guardarOriginalDesdeUrl(bucket, urlLogoNuevo, urlAntes) {
  try {
    const resp = await fetch(urlAntes, { mode: 'cors' })
    if (!resp.ok) return false
    return await guardarOriginal(bucket, urlLogoNuevo, await resp.blob())
  } catch { return false }
}

function urlPublicaOriginal(bucket, urlLogo) {
  const ruta = rutaOriginal(urlLogo)
  return ruta ? supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl : null
}

// Sube de nuevo el original como logo vigente (con ruta nueva, para que ningún caché muestre el anterior)
// y devuelve su URL pública, o lanza un error si no se pudo.
export async function restaurarOriginal(bucket, urlLogoActual, prefijoRuta) {
  const urlOrig = urlPublicaOriginal(bucket, urlLogoActual)
  if (!urlOrig) throw new Error('No hay copia del original')
  const resp = await fetch(urlOrig, { mode: 'cors', cache: 'no-store' })
  if (!resp.ok) throw new Error('No se encontró la copia del original')
  const blob = await resp.blob()
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[blob.type] || 'png'
  const ruta = `${prefijoRuta}_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(ruta, blob, { upsert: true, contentType: blob.type || 'image/png' })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl
}

// true si el logo actual tiene una copia de su original guardada.
export function useTieneOriginal(bucket, urlLogo) {
  const [estado, setEstado] = useState({ url: null, tiene: false })
  useEffect(() => {
    let vivo = true
    const u = urlLogo ? urlPublicaOriginal(bucket, urlLogo) : null
    if (!u) return undefined
    fetch(u, { method: 'HEAD', cache: 'no-store' })
      .then(r => { if (vivo) setEstado({ url: urlLogo, tiene: r.ok }) })
      .catch(() => { if (vivo) setEstado({ url: urlLogo, tiene: false }) })
    return () => { vivo = false }
  }, [bucket, urlLogo])
  return !!urlLogo && estado.url === urlLogo && estado.tiene
}
