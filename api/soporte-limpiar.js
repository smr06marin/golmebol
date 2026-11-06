// Limpieza automática del chat de ayuda: borra los mensajes, fotos, videos y audios con más de 8 días.
// La llama Vercel Cron una vez al día (ver "crons" en vercel.json) con el secreto CRON_SECRET.
// Variables en Vercel (servidor): CRON_SECRET (texto largo inventado por ti), SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'soporte-adjuntos'
const DIAS = 8
const LOTE = 100

export default async function handler(req, res) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) return res.status(401).json({ error: 'No autorizado' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Config incompleta' })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const limite = new Date(Date.now() - DIAS * 86400000)
  const inicio = Date.now()
  let mensajes = 0, archivos = 0

  try {
    // 1) Mensajes viejos: primero sus archivos, después el mensaje (si falla el archivo, el mensaje se conserva y se reintenta mañana)
    while (Date.now() - inicio < 40000) {
      const { data: viejos, error } = await admin.from('soporte_mensajes').select('id, adjunto_path')
        .lt('created_at', limite.toISOString()).order('created_at', { ascending: true }).limit(LOTE)
      if (error) throw error
      if (!viejos?.length) break
      const rutas = viejos.map(m => m.adjunto_path).filter(Boolean)
      if (rutas.length) {
        const { error: er } = await admin.storage.from(BUCKET).remove(rutas)
        if (er) throw er
        archivos += rutas.length
      }
      const { error: ed } = await admin.from('soporte_mensajes').delete().in('id', viejos.map(m => m.id))
      if (ed) throw ed
      mensajes += viejos.length
    }

    // 2) Archivos que se subieron pero nunca se enviaron en un mensaje (huérfanos) con más de 8 días
    const { data: carpetas } = await admin.storage.from(BUCKET).list('', { limit: 1000 })
    for (const c of carpetas || []) {
      if (Date.now() - inicio > 50000) break
      if (c.id) continue // solo carpetas (una por chat)
      const { data: files } = await admin.storage.from(BUCKET).list(c.name, { limit: 1000 })
      const rutas = (files || []).filter(f => f.created_at && new Date(f.created_at) < limite).map(f => `${c.name}/${f.name}`)
      if (rutas.length) { await admin.storage.from(BUCKET).remove(rutas); archivos += rutas.length }
    }
    return res.status(200).json({ ok: true, mensajes, archivos })
  } catch (e) {
    console.error('soporte-limpiar:', e?.message || e)
    return res.status(500).json({ error: 'No se pudo limpiar', mensajes, archivos })
  }
}
