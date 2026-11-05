// Guarda o quita la suscripción a avisos push de un navegador (chat de ayuda).
// Lo llama la web con el token de sesión del usuario (Authorization: Bearer ...).
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAX_POR_USUARIO = 10

// Solo servicios de push reales de los navegadores (evita que alguien nos haga llamar direcciones arbitrarias)
function endpointValido(e) {
  try {
    const u = new URL(e)
    if (u.protocol !== 'https:' || e.length > 1000) return false
    const h = u.hostname
    return h === 'fcm.googleapis.com' || h.endsWith('.push.services.mozilla.com') || h.endsWith('.push.apple.com') || h.endsWith('.notify.windows.com')
  } catch { return false }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Método no permitido' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'No disponible por ahora' })
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Inicia sesión' })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  try {
    const { data: u, error: eu } = await admin.auth.getUser(token)
    const user = u?.user
    if (eu || !user) return res.status(401).json({ error: 'Sesión no válida' })
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const endpoint = String(body.endpoint || '')

    if (req.method === 'DELETE') {
      await admin.from('soporte_push').delete().eq('user_id', user.id).eq('endpoint', endpoint)
      return res.status(200).json({ ok: true })
    }

    const p256dh = String(body.keys?.p256dh || '')
    const auth = String(body.keys?.auth || '')
    if (!endpointValido(endpoint) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return res.status(400).json({ error: 'Suscripción no válida' })

    const { error } = await admin.from('soporte_push').upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' })
    if (error) return res.status(500).json({ error: 'No se pudo guardar' })

    // Máximo de dispositivos por usuario: se quitan los más viejos
    const { data: todas } = await admin.from('soporte_push').select('id').eq('user_id', user.id).order('creado_en', { ascending: false })
    const sobran = (todas || []).slice(MAX_POR_USUARIO).map(f => f.id)
    if (sobran.length) await admin.from('soporte_push').delete().in('id', sobran)
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('soporte-push:', e?.message)
    return res.status(500).json({ error: 'No se pudo guardar' })
  }
}
