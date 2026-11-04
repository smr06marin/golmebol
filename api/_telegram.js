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
