// Envío de mensajes por un bot de Telegram (gratis, sin números ni plantillas).
// Variables de entorno en Vercel (servidor, NUNCA con prefijo VITE_):
//   TELEGRAM_BOT_TOKEN       el token que te da @BotFather
//   TELEGRAM_CHAT_ID         tu número de chat de Telegram (el bot te lo dice la primera vez que le escribes)
//   TELEGRAM_WEBHOOK_SECRET  texto inventado por ti (letras, números, _ y -) para comprobar que los avisos son de Telegram

export const telegramConfigurado = () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)

async function llamar(metodo, cuerpo) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok || !json.ok) throw new Error(json.description || `Telegram respondió ${r.status}`)
  return json.result
}

// Devuelve "tg-<id del mensaje>": con ese id se sabe a qué organizador contestas cuando le das "Responder"
export async function enviarTelegram(texto, chatId = process.env.TELEGRAM_CHAT_ID, citarId) {
  const r = await llamar('sendMessage', {
    chat_id: chatId,
    text: String(texto).slice(0, 4000),
    disable_web_page_preview: true,
    ...(citarId ? { reply_parameters: { message_id: citarId, allow_sending_without_reply: true } } : {}),
  })
  return `tg-${r.message_id}`
}

// ── Fotos y videos ────────────────────────────────────────────
// Envía una foto o video (Blob) con leyenda. Telegram acepta hasta 10 MB en fotos y 50 MB en videos.
export async function enviarTelegramArchivo({ tipo, archivo, nombre, leyenda, chatId = process.env.TELEGRAM_CHAT_ID }) {
  const form = new FormData()
  form.append('chat_id', String(chatId))
  if (leyenda) form.append('caption', String(leyenda).slice(0, 1024))
  if (tipo === 'video') form.append('supports_streaming', 'true')
  form.append(tipo === 'video' ? 'video' : 'photo', archivo, nombre)
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${tipo === 'video' ? 'sendVideo' : 'sendPhoto'}`, { method: 'POST', body: form })
  const json = await r.json().catch(() => ({}))
  if (!r.ok || !json.ok) throw new Error(json.description || `Telegram respondió ${r.status}`)
  return `tg-${json.result.message_id}`
}

// Baja un archivo que te mandaron al bot (Telegram solo deja descargar hasta 20 MB).
export async function descargarTelegramArchivo(fileId) {
  const info = await llamar('getFile', { file_id: fileId })
  if (!info?.file_path) throw new Error('Telegram no dio el archivo')
  const r = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${info.file_path}`)
  if (!r.ok) throw new Error(`No se pudo bajar el archivo (${r.status})`)
  return { datos: Buffer.from(await r.arrayBuffer()), ruta: info.file_path }
}
