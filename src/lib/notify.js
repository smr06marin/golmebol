// Notificación global de "cambios guardados" — sin Context ni Redux, así
// se puede llamar desde cualquier archivo (páginas, helpers, lo que sea)
// sin tener que pasar props. src/lib/supabase.js dispara esto solo cuando
// detecta un insert/update/upsert/delete exitoso; GlobalToast.jsx (montado
// una sola vez en App.jsx) se suscribe y dibuja el aviso.
const listeners = new Set()

export function onNotify(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function notify(mensaje = 'Cambios guardados ✓', tipo = 'ok') {
  const evento = { id: Date.now() + Math.random(), mensaje, tipo }
  listeners.forEach(fn => { try { fn(evento) } catch (_) {} })
}
