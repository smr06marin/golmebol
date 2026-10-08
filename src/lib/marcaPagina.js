// Título de la pestaña e ícono (favicon) de la página que se está viendo.
// En el dominio propio de un organizador/torneo (ej. centegol.com) deben ser
// los de ESE organizador/torneo, no los de Golmebol (que es lo que trae el
// index.html por defecto y lo que Chrome muestra en el buscador/historial).

export function esHostPropioGolmebol() {
  const h = (typeof window !== 'undefined' ? window.location.hostname : '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('golmebol.com') || h.endsWith('.vercel.app')
}

export function aplicarMarcaPagina({ titulo, iconoUrl } = {}) {
  try {
    if (titulo) document.title = titulo
    if (!iconoUrl) return
    // Se reemplazan TODOS los íconos (no solo se cambia el href): los del
    // index.html traen tamaños/tipo fijos y el navegador seguía prefiriéndolos.
    document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']").forEach(l => l.remove())
    const icon = document.createElement('link')
    icon.rel = 'icon'; icon.href = iconoUrl
    document.head.appendChild(icon)
    const apple = document.createElement('link')
    apple.rel = 'apple-touch-icon'; apple.href = iconoUrl
    document.head.appendChild(apple)
  } catch (e) { /* sin acceso al documento: no pasa nada */ }
}
