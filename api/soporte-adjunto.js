// Chat de ayuda: da permiso TEMPORAL para subir UNA foto o video al chat del usuario.
// El archivo sube directo a Supabase Storage (sin pasar por Vercel, que limita el tamaño).
// Después la web llama a /api/soporte-enviar con el "path" para mandar el mensaje.
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
export const BUCKET = 'soporte-adjuntos'

const TIPOS = {
  'image/jpeg': { ext: 'jpg', tipo: 'imagen', max: 10 * 1024 * 1024 },
  'image/png':  { ext: 'png', tipo: 'imagen', max: 10 * 1024 * 1024 },
  'image/webp': { ext: 'webp', tipo: 'imagen', max: 10 * 1024 * 1024 },
  'video/mp4':  { ext: 'mp4', tipo: 'video', max: 50 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', tipo: 'video', max: 50 * 1024 * 1024 },
  'video/webm': { ext: 'webm', tipo: 'video', max: 50 * 1024 * 1024 },
}
const MAX_ADJUNTOS_POR_HORA = 30

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'El chat no está disponible por ahora. Intenta de nuevo más tarde.' })
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Inicia sesión para enviar archivos' })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  try {
    const { data: u, error: eu } = await admin.auth.getUser(token)
    const user = u?.user
    if (eu || !user) return res.status(401).json({ error: 'Sesión no válida' })
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const info = TIPOS[String(body.contentType || '').toLowerCase()]
    const size = Number(body.size) || 0
    if (!info) return res.status(400).json({ error: 'Solo se pueden enviar fotos (JPG, PNG, WEBP) y videos (MP4, MOV, WEBM)' })
    if (size <= 0 || size > info.max) return res.status(400).json({ error: info.tipo === 'video' ? 'El video pesa más de 50 MB. Grábalo más corto o en menor calidad.' : 'La foto pesa demasiado.' })

    const { data: chat } = await admin.from('soporte_chats').select('id').eq('user_id', user.id).maybeSingle()
    if (!chat) return res.status(400).json({ error: 'Abre el chat otra vez e intenta de nuevo' })

    const hace = new Date(Date.now() - 60 * 60000).toISOString()
    const { count } = await admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id).eq('de', 'usuario').not('adjunto_path', 'is', null).gte('created_at', hace)
    if ((count || 0) >= MAX_ADJUNTOS_POR_HORA) return res.status(429).json({ error: 'Enviaste muchos archivos seguidos. Espera un momento.' })

    const path = `${chat.id}/${randomUUID()}.${info.ext}`
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data?.token) { console.error('soporte-adjunto:', error?.message); return res.status(500).json({ error: 'No se pudo preparar el archivo. Intenta de nuevo.' }) }
    return res.status(200).json({ path, token: data.token, tipo: info.tipo })
  } catch (e) {
    console.error('soporte-adjunto:', e?.message || e)
    return res.status(500).json({ error: 'No se pudo preparar el archivo. Intenta de nuevo.' })
  }
}
