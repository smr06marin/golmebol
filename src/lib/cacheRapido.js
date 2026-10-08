// Caché de "lo último que se vio" para que las páginas públicas (inicio y
// tabla de cada torneo) pinten AL INSTANTE al volver a entrar, y los datos
// frescos lleguen detrás y reemplacen lo guardado (stale-while-revalidate).
//
// Es solo una copia de datos que ya son públicos. Si el navegador no deja
// guardar (modo privado, cupo lleno), todo funciona igual, sin caché.
const PREFIJO = 'gm_cache_'

export function leerCacheRapido(clave, maxEdadMs = 6 * 60 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(PREFIJO + clave)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o.t !== 'number' || Date.now() - o.t > maxEdadMs) return null
    return o.v ?? null
  } catch (e) { return null }
}

export function guardarCacheRapido(clave, valor) {
  const guardar = () => localStorage.setItem(PREFIJO + clave, JSON.stringify({ v: valor, t: Date.now() }))
  try { guardar(); return } catch (e) {}
  // Cupo lleno: se borran las copias más viejas de este mismo caché y se reintenta una vez.
  try {
    const claves = Object.keys(localStorage).filter(k => k.startsWith(PREFIJO))
    claves.map(k => { let t = 0; try { t = JSON.parse(localStorage.getItem(k)).t || 0 } catch (e) {} return { k, t } })
      .sort((a, b) => a.t - b.t).slice(0, Math.max(1, Math.ceil(claves.length / 2)))
      .forEach(({ k }) => localStorage.removeItem(k))
    guardar()
  } catch (e) {}
}
