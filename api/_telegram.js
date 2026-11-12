// Envío de mensajes por un bot de Telegram (gratis, sin números ni plantillas).
// Variables de entorno en Vercel (servidor, NUNCA con prefijo VITE_):
//   TELEGRAM_BOT_TOKEN       el token que te da @BotFather
//   TELEGRAM_CHAT_ID         tu número de chat de Telegram (el bot te lo dice la primera vez que le escribes)
//   TELEGRAM_WEBHOOK_SECRET  texto inventado por ti (letras, números, _ y -) para comprobar que los avisos son de Telegram
//   TELEGRAM_TEMAS           "1" = cada conversación va en su PROPIO tema (hilo) de un grupo de Telegram con Temas
//                            activados, para que no se mezclen. TELEGRAM_CHAT_ID debe ser entonces el número del
//                            grupo (empieza por -100...). Ver Guia_Chat_Ayuda_Telegram.md.

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
// `temaId` (opcional): número del tema (hilo) del grupo donde va el mensaje.
export async function enviarTelegram(texto, chatId = process.env.TELEGRAM_CHAT_ID, citarId, silencioso = false, temaId) {
  const r = await llamar('sendMessage', {
    chat_id: chatId,
    ...(temaId ? { message_thread_id: Number(temaId) } : {}),
    text: String(texto).slice(0, 4000),
    disable_web_page_preview: true,
    ...(silencioso ? { disable_notification: true } : {}), // aviso sin sonido (cuando el asistente automático ya respondió)
    ...(citarId ? { reply_parameters: { message_id: citarId, allow_sending_without_reply: true } } : {}),
  })
  return `tg-${r.message_id}`
}

// Menú de comandos del bot (el botón «/» de Telegram). Se registra solo al escribirle /start.
export async function registrarComandos() {
  await llamar('setMyCommands', { commands: [
    { command: 'pendientes', description: 'Chats sin responder, por prioridad' },
    { command: 'chat', description: 'Ver una conversación. Ejemplo: /chat 14' },
    { command: 'ayuda', description: 'Cómo funciona' },
  ] })
}

// ── Fotos y videos ────────────────────────────────────────────
// Envía una foto o video (Blob) con leyenda. Telegram acepta hasta 10 MB en fotos y 50 MB en videos.
// Los audios van como nota de voz (se oyen con un toque); si Telegram no acepta el formato, van como archivo.
export async function enviarTelegramArchivo({ tipo, archivo, nombre, leyenda, chatId = process.env.TELEGRAM_CHAT_ID, temaId }) {
  const intentar = async (metodo, campo) => {
    const form = new FormData()
    form.append('chat_id', String(chatId))
    if (temaId) form.append('message_thread_id', String(temaId))
    if (leyenda) form.append('caption', String(leyenda).slice(0, 1024))
    if (campo === 'video') form.append('supports_streaming', 'true')
    form.append(campo, archivo, nombre)
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`, { method: 'POST', body: form })
    const json = await r.json().catch(() => ({}))
    if (!r.ok || !json.ok) throw new Error(json.description || `Telegram respondió ${r.status}`)
    return `tg-${json.result.message_id}`
  }
  if (tipo === 'video') return intentar('sendVideo', 'video')
  if (tipo === 'audio') {
    try { return await intentar('sendVoice', 'voice') } catch { return intentar('sendDocument', 'document') }
  }
  return intentar('sendPhoto', 'photo')
}

// Baja un archivo que te mandaron al bot (Telegram solo deja descargar hasta 20 MB).
export async function descargarTelegramArchivo(fileId) {
  const info = await llamar('getFile', { file_id: fileId })
  if (!info?.file_path) throw new Error('Telegram no dio el archivo')
  const r = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${info.file_path}`)
  if (!r.ok) throw new Error(`No se pudo bajar el archivo (${r.status})`)
  return { datos: Buffer.from(await r.arrayBuffer()), ruta: info.file_path }
}

// ── Un tema (hilo) por conversación ───────────────────────────
// Con TELEGRAM_TEMAS=1 y un grupo con Temas activados, cada conversación del chat de ayuda tiene su propio tema
// ("#14 Laura · Público"). Todo lo que escribe esa persona llega a su tema, y lo que TÚ escribes dentro del tema
// le llega SOLO a ella: ya no se mezclan las conversaciones aunque escriban varias personas a la vez.
export const temasActivos = () => ['1', 'si', 'sí', 'true'].includes(String(process.env.TELEGRAM_TEMAS || '').toLowerCase())

const COLOR_PUBLICO = 7322096    // azul
const COLOR_PANEL = 16766590     // amarillo (organizadores / usuarios con cuenta)

// Devuelve el número del tema de esta conversación (lo crea la primera vez). null si los temas no están activos
// o no se pudo crear (en ese caso el mensaje va al tema General, como antes).
export async function temaDeChat(admin, chat, etiqueta) {
  if (!temasActivos() || !chat?.id) return null
  if (chat.telegram_tema_id) return Number(chat.telegram_tema_id)
  const publico = chat.origen === 'publico'
  const nombre = `#${chat.codigo ?? ''} ${String(etiqueta || chat.nombre || chat.email || 'Usuario').trim()}${publico ? ' · 🌐 Público' : ''}`.slice(0, 120)
  let tema
  try {
    tema = await llamar('createForumTopic', { chat_id: process.env.TELEGRAM_CHAT_ID, name: nombre, icon_color: publico ? COLOR_PUBLICO : COLOR_PANEL })
  } catch (e) {
    console.error('telegram temas: no se pudo crear el tema', e.message)
    return null
  }
  const id = tema?.message_thread_id
  if (!id) return null
  // Se guarda solo si nadie lo guardó antes (dos mensajes al mismo tiempo): si ya había uno, se usa ese y se borra el repetido
  const { data: filas, error } = await admin.from('soporte_chats').update({ telegram_tema_id: id }).eq('id', chat.id).is('telegram_tema_id', null).select('telegram_tema_id')
  if (error) {
    console.error('telegram temas: falta la columna telegram_tema_id (corre migracion_telegram_temas.sql)', error.message)
    await llamar('deleteForumTopic', { chat_id: process.env.TELEGRAM_CHAT_ID, message_thread_id: id }).catch(() => {})
    return null
  }
  if (!filas?.length) {
    await llamar('deleteForumTopic', { chat_id: process.env.TELEGRAM_CHAT_ID, message_thread_id: id }).catch(() => {})
    const { data: ya } = await admin.from('soporte_chats').select('telegram_tema_id').eq('id', chat.id).maybeSingle()
    return ya?.telegram_tema_id ? Number(ya.telegram_tema_id) : null
  }
  chat.telegram_tema_id = id
  return id
}

// Envía al tema de la conversación. Si borraste ese tema en Telegram, se crea uno nuevo y se reintenta.
export async function enviarEnTema(admin, chat, etiqueta, enviar) {
  const tema = await temaDeChat(admin, chat, etiqueta)
  try {
    return await enviar(tema)
  } catch (e) {
    if (tema && /thread not found|topic_deleted|topic_closed|TOPIC_ID_INVALID/i.test(e.message || '')) {
      await admin.from('soporte_chats').update({ telegram_tema_id: null }).eq('id', chat.id)
      const nuevo = await temaDeChat(admin, { ...chat, telegram_tema_id: null }, etiqueta)
      return enviar(nuevo)
    }
    throw e
  }
}

// Texto del final de cada aviso: cómo contestarle
export const pieResponder = () => temasActivos()
  ? '\n\n↩️ Escribe aquí, en este tema, para contestarle.'
  : '\n\n↩️ Responde a ESTE mensaje para contestarle.'
