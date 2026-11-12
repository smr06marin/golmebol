// Decide a qué chat va TU respuesta (venga de Telegram o de WhatsApp) y la guarda.
// Orden:
//   0. Escribiste dentro del TEMA de esa conversación (grupo de Telegram con Temas)   ← lo más seguro
//   1. Respondiste (Responder / swipe) al mensaje de esa persona
//   2. Empezaste el mensaje con su número:  #12 hola, ya te ayudo
// Ya NO se adivina "al último que escribió": con varias personas escribiendo a la vez eso mandaba respuestas
// a quien no era. Si no se sabe a quién va, no se envía y se te pide aclararlo.
// Devuelve { ok: true } o { ok: false } cuando no se pudo saber a quién contestarle.

import { avisarOrganizador } from './_soportePush.js'

export const AYUDA_RUTA = '⚠️ No envié tu mensaje porque no supe a quién va. Escríbelo dentro del tema de esa persona, o usa «Responder» sobre su mensaje (deslizar o mantener presionado → Responder), o empieza con su número, por ejemplo: #12 hola, ya te ayudo.'

// "adjunto" (opcional) es una función  async chatId => ({ path, tipo })  que sube el archivo una vez que se sabe a qué chat va.
export async function guardarRespuesta(admin, { texto, citadoId, idMensaje, adjunto, chatIdTema }) {
  let cuerpo = String(texto || '').trim()
  if (!cuerpo && !adjunto) return { ok: false }
  let chatId = chatIdTema || null

  if (!chatId && citadoId) {
    const { data: orig } = await admin.from('soporte_mensajes').select('chat_id').eq('wa_id', citadoId).maybeSingle()
    chatId = orig?.chat_id || null
  }
  if (!chatId) {
    const num = cuerpo.match(/^#(\d+)\s+([\s\S]+)/)
    if (num) {
      const { data: c } = await admin.from('soporte_chats').select('id').eq('codigo', Number(num[1])).maybeSingle()
      if (c) { chatId = c.id; cuerpo = num[2].trim() }
    }
  }
  if (!chatId) return { ok: false }

  let adj = null
  if (adjunto) {
    if (idMensaje) { // aviso repetido de Telegram: no se vuelve a subir el archivo
      const { data: ya } = await admin.from('soporte_mensajes').select('id').eq('wa_id', idMensaje).maybeSingle()
      if (ya) return { ok: true }
    }
    adj = await adjunto(chatId)
  }
  const { error } = await admin.from('soporte_mensajes').insert({ chat_id: chatId, de: 'soporte', texto: cuerpo.slice(0, 2000), wa_id: idMensaje || null, adjunto_path: adj?.path || null, adjunto_tipo: adj?.tipo || null })
  if (error && error.code !== '23505') throw error // 23505 = el aviso llegó repetido: ya estaba guardado
  if (!error) {
    await admin.from('soporte_chats').update({ ultimo_mensaje_at: new Date().toISOString() }).eq('id', chatId)
    await avisarOrganizador(admin, chatId, cuerpo || (adj?.tipo === 'video' ? '🎥 Te envió un video' : adj?.tipo === 'audio' ? '🎤 Te envió un audio' : '📷 Te envió una foto')) // notificación al organizador (si activó los avisos)
  }
  return { ok: true }
}
