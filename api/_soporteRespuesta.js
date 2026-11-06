// Decide a qué chat va TU respuesta (venga de Telegram o de WhatsApp) y la guarda.
// Orden:
//   1. Respondiste (Responder / swipe) al mensaje de un organizador       ← lo normal
//   2. Empezaste el mensaje con su número:  #12 hola, ya te ayudo
//   3. Si no, va al último organizador que escribió y todavía no tiene respuesta
// Devuelve { ok: true } o { ok: false } cuando no se pudo saber a quién contestarle.

import { avisarOrganizador } from './_soportePush.js'

export const AYUDA_RUTA = 'No supe a quién contestarle. Responde directamente al mensaje del organizador (en Telegram: deslizar o mantener presionado → Responder), o empieza tu mensaje con su número, por ejemplo: #12 hola, ya te ayudo.'

// "adjunto" (opcional) es una función  async chatId => ({ path, tipo })  que sube el archivo una vez que se sabe a qué chat va.
export async function guardarRespuesta(admin, { texto, citadoId, idMensaje, adjunto }) {
  let cuerpo = String(texto || '').trim()
  if (!cuerpo && !adjunto) return { ok: false }
  let chatId = null

  if (citadoId) {
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
  if (!chatId) {
    const { data: ult } = await admin.from('soporte_mensajes').select('chat_id, created_at').eq('de', 'usuario').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (ult) {
      const { count } = await admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', ult.chat_id).eq('de', 'soporte').gt('created_at', ult.created_at)
      if (!count) chatId = ult.chat_id
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
    await avisarOrganizador(admin, chatId, cuerpo || (adj?.tipo === 'video' ? '🎥 Te envió un video' : '📷 Te envió una foto')) // notificación al organizador (si activó los avisos)
  }
  return { ok: true }
}
