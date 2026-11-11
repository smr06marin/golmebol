// Versión reducida de una imagen guardada en Supabase Storage.
// Los escudos se suben en tamaño grande (~1000 px) y se muestran a 20–60 px: bajar el original de cada uno
// (a veces 80–300 KB) hace lenta la portada con señal floja. Supabase puede entregarlos ya reducidos
// (/render/image/…?width=): 85 KB pasan a ~6 KB. Si la reducción no está disponible o falla,
// `alFallarMini` vuelve solo al original, así que nunca queda una imagen rota.
const RE = /^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/(.+?)(\?.*)?$/

let reduccionApagada = false // si la reducción falla una vez en esta sesión, ya no se intenta más

// px = tamaño con que se dibuja (en píxeles CSS). Se pide al doble para que se vea nítida en pantallas retina.
export function urlMini(url, px = 48) {
  if (!url || reduccionApagada) return url
  const m = RE.exec(url)
  if (!m) return url
  const ancho = Math.min(512, Math.max(32, Math.ceil(px * 2 / 16) * 16))
  // OJO: hay que pedir ancho Y alto con resize=contain. Con solo `width` Supabase deja el alto original y la imagen sale
  // como una tira angosta recortada. Con contain cabe entera dentro del cuadrado, sin deformarse.
  return `${m[1]}/storage/v1/render/image/public/${m[2]}?width=${ancho}&height=${ancho}&resize=contain&quality=75`
}

// onError de la <img>: pasa al original una sola vez
export function alFallarMini(e) {
  const img = e.currentTarget
  if (img.dataset.original) return
  const actual = img.currentSrc || img.src
  const m = /^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/render\/image\/public\/(.+?)\?/.exec(actual)
  if (!m) return
  reduccionApagada = true
  img.dataset.original = '1'
  img.src = `${m[1]}/storage/v1/object/public/${m[2]}`
}
