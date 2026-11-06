// Resumen de la mañana: te manda por Telegram la lista de chats de ayuda que siguen sin responder,
// con los de prioridad alta arriba. Lo llama Vercel Cron una vez al día (ver "crons" en vercel.json)
// con el mismo secreto CRON_SECRET de la limpieza. Si no hay pendientes, no te escribe.
import { createClient } from '@supabase/supabase-js'
import { enviarTelegram, telegramConfigurado } from './_telegram.js'
import { listarPendientes, textoPendientes } from './_prioridadSoporte.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) return res.status(401).json({ error: 'No autorizado' })
  if (!SUPABASE_URL || !SERVICE_KEY || !telegramConfigurado()) return res.status(500).json({ error: 'Config incompleta' })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  try {
    const r = await listarPendientes(admin)
    if (r.pendientes.length) await enviarTelegram(textoPendientes(r, '☀️ Buenos días. Pendientes por responder'))
    return res.status(200).json({ ok: true, pendientes: r.pendientes.length })
  } catch (e) {
    console.error('soporte-resumen:', e?.message || e)
    return res.status(500).json({ error: 'No se pudo enviar el resumen' })
  }
}
