// Convierte la dirección de la pantalla donde estaba la persona al escribir al chat de ayuda
// (ej. /equipos/32798acc-…) en algo que se entienda en tu Telegram: «Equipo: CHAPECO».
// Si no reconoce la pantalla, deja la dirección tal cual (como antes). Nunca falla: ante cualquier error devuelve la dirección.
// (El nombre empieza con _ para que Vercel no lo cuente como función: el plan Hobby permite máximo 12.)

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const REGLAS = [
  { re: new RegExp(`^/(?:admin/)?equipos/(${UUID})`, 'i'), tabla: 'teams', etiqueta: 'Equipo' },
  { re: new RegExp(`^/(?:admin/)?jugadores/(${UUID})`, 'i'), tabla: 'players', etiqueta: 'Jugador' },
  { re: new RegExp(`^/(?:t|admin/torneos|jugador/torneo)/(${UUID})`, 'i'), tabla: 'tournaments', etiqueta: 'Torneo' },
]
const PANTALLAS = {
  '/admin': 'Panel principal', '/admin/torneos': 'Lista de torneos', '/admin/equipos': 'Lista de equipos',
  '/admin/jugadores': 'Lista de jugadores', '/admin/sponsors': 'Patrocinadores', '/admin/tarjetas': 'Tarjetas',
  '/admin/suspensiones': 'Suspensiones', '/admin/noticias': 'Noticias', '/admin/usuarios': 'Usuarios y permisos',
  '/': 'Página de inicio', '/torneos': 'Página de torneos',
}

export async function describirRuta(admin, ruta) {
  if (!ruta) return ''
  const r = String(ruta || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  try {
    for (const { re, tabla, etiqueta } of REGLAS) {
      const id = r.match(re)?.[1]
      if (!id) continue
      const { data } = await admin.from(tabla).select('name').eq('id', id).maybeSingle()
      if (data?.name) {
        const enAdmin = r.startsWith('/admin') ? ' (panel de administración)' : ''
        return `${etiqueta}: ${data.name}${enAdmin}`
      }
      return `${etiqueta} (no encontrado) · ${ruta}`
    }
  } catch { /* se devuelve la dirección */ }
  return PANTALLAS[r] || String(ruta || '')
}
