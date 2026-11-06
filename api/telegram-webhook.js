// Chat de ayuda por Telegram: lo que TÚ contestas al bot vuelve al chat del organizador.
// Telegram llama a esta dirección (https://golmebol.com/api/telegram-webhook) con cada mensaje que recibe el bot.
// Se activa una sola vez (ver Guia_Chat_Ayuda_Telegram.md).
//
// Seguridad: Telegram manda el texto TELEGRAM_WEBHOOK_SECRET en una cabecera (si no coincide, se rechaza) y
// solo se aceptan respuestas desde TU chat (TELEGRAM_CHAT_ID); cualquier otra persona que le escriba al bot es ignorada.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { enviarTelegram, descargarTelegramArchivo } from './_telegram.js'
import { guardarRespuesta, AYUDA_RUTA } from './_soporteRespuesta.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'soporte-adjuntos'
const MAX_DESCARGA = 20 * 1024 * 1024 // Telegram solo deja a un bot bajar archivos de hasta 20 MB
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }

// Foto o video que mandaste al bot (como foto, como video o como archivo). null si no trae ninguno.
function leerMedia(m) {
  if (m.photo?.length) { const f = m.photo[m.photo.length - 1]; return { fileId: f.file_id, mime: 'image/jpeg', tipo: 'imagen', size: f.file_size } }
  if (m.video) return { fileId: m.video.file_id, mime: m.video.mime_type || 'video/mp4', tipo: 'video', size: m.video.file_size }
  if (m.document) return { fileId: m.document.file_id, mime: m.document.mime_type || '', tipo: String(m.document.mime_type || '').startsWith('video/') ? 'video' : 'imagen', size: m.document.file_size }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secreto || req.headers['x-telegram-bot-api-secret-token'] !== secreto) return res.status(401).json({ error: 'No autorizado' })
  if (!process.env.TELEGRAM_BOT_TOKEN) return res.status(500).json({ error: 'Falta TELEGRAM_BOT_TOKEN' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const m = body.message
  if (!m?.chat?.id) return res.status(200).json({ ok: true }) // otros tipos de aviso: se ignoran

  const miChat = String(process.env.TELEGRAM_CHAT_ID || '')
  const deQuien = String(m.chat.id)

  // Primera vez: el bot te dice cuál es tu número de chat para que lo pongas en Vercel
  if (!miChat) {
    await enviarTelegram(`¡Hola! Tu número de chat es:\n\n${deQuien}\n\nPónlo en Vercel como TELEGRAM_CHAT_ID, vuelve a desplegar, y ya quedan conectados el chat de ayuda y este bot.`, deQuien).catch(() => {})
    return res.status(200).json({ ok: true })
  }
  if (deQuien !== miChat) return res.status(200).json({ ok: true }) // nadie más puede contestar en nombre del soporte

  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('telegram-webhook: falta SUPABASE_SERVICE_ROLE_KEY'); return res.status(500).json({ error: 'Config incompleta' }) }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  try {
    const media = leerMedia(m)
    if (!media && !m.text) {
      await enviarTelegram('El chat solo puede mostrar texto, fotos y videos. Envía tu respuesta en uno de esos formatos.', miChat, m.message_id).catch(() => {})
      return res.status(200).json({ ok: true })
    }
    if (media && !EXT[media.mime]) {
      await enviarTelegram('Solo puedo pasar fotos (JPG, PNG, WEBP) y videos (MP4, MOV, WEBM).', miChat, m.message_id).catch(() => {})
      return res.status(200).json({ ok: true })
    }
    if (media && (media.size || 0) > MAX_DESCARGA) {
      await enviarTelegram('Ese archivo pesa más de 20 MB y Telegram no me deja pasarlo al chat. Envíalo más liviano o más corto.', miChat, m.message_id).catch(() => {})
      return res.status(200).json({ ok: true })
    }
    if (m.text?.startsWith('/')) { // /start y otros comandos: no son respuestas
      await enviarTelegram('Listo, estás conectado. Cuando un organizador escriba en el chat de ayuda, te llega aquí. Respóndele con "Responder" sobre su mensaje.', miChat).catch(() => {})
      return res.status(200).json({ ok: true })
    }
    const adjunto = media ? async chatId => {
      const { datos } = await descargarTelegramArchivo(media.fileId)
      const path = `${chatId}/${randomUUID()}.${EXT[media.mime]}`
      const { error } = await admin.storage.from(BUCKET).upload(path, datos, { contentType: media.mime })
      if (error) throw error
      return { path, tipo: media.tipo }
    } : undefined
    const r = await guardarRespuesta(admin, { texto: m.text || m.caption || '', citadoId: m.reply_to_message ? `tg-${m.reply_to_message.message_id}` : null, idMensaje: `tg-${m.message_id}`, adjunto })
    if (!r.ok) await enviarTelegram(AYUDA_RUTA, miChat, m.message_id).catch(() => {})
  } catch (e) {
    if (/too big/i.test(e.message || '')) { // Telegram no dejó bajar el archivo: no sirve reintentar
      await enviarTelegram('Ese archivo es demasiado grande para pasarlo al chat. Envíalo más liviano o más corto.', miChat, m.message_id).catch(() => {})
      return res.status(200).json({ ok: true })
    }
    console.error('telegram-webhook:', e.message || e)
    return res.status(500).json({ error: 'No se pudo guardar' }) // Telegram reintenta solo
  }
  return res.status(200).json({ ok: true })
}
