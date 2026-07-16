import { supabase } from './supabase'

// ── Registro de visitas del sitio público ───────────────────────────────────
// Guarda cada visita con un id de sesión del navegador y el tipo de
// dispositivo. Alimenta las analíticas del administrador principal.
// Nunca bloquea ni rompe la página si falla (fire-and-forget).

export function registrarVisita(pagina, torneoId = null) {
  try {
    let sid = sessionStorage.getItem('golmebol_sid')
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('golmebol_sid', sid)
    }
    const dispositivo = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'movil' : 'pc'
    supabase.from('site_visitas')
      .insert({ pagina, torneo_id: torneoId, session_id: sid, dispositivo })
      .then(() => {}, () => {})
  } catch (e) { /* nunca romper la página por una visita */ }
}
