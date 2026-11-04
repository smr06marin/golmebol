// Chat de ayuda: el organizador escribe en la web → se guarda → te llega a WhatsApp.
// Lo llama el chat de la web con el token de sesión del usuario (Authorization: Bearer ...).
// Si WhatsApp no está configurado o falla, el mensaje igual queda guardado en el chat.

import { createClient } from '@supabase/supabase-js'
import { enviarTexto, enviarPlantilla, waConfigurado } from './_whatsapp.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAX_POR_MINUTO = 8
const MAX_POR_HORA = 60

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Inicia sesión para escribir' })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  try {
    const { data: u, error: eu } = await admin.auth.getUser(token)
    const user = u?.user
    if (eu || !user) return res.status(401).json({ error: 'Sesión no válida' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const texto = String(body.texto || '').trim()
    const contexto = String(body.contexto || '').slice(0, 300)
    if (!texto) return res.status(400).json({ error: 'Escribe un mensaje' })
    if (texto.length > 1000) return res.status(400).json({ error: 'El mensaje es muy largo (máximo 1000 letras)' })

    const { data: chat } = await admin.from('soporte_chats').select('*').eq('user_id', user.id).maybeSingle()
    if (!chat) return res.status(400).json({ error: 'Abre el chat otra vez e intenta de nuevo' })

    // Freno contra spam
    const hace = min => new Date(Date.now() - min * 60000).toISOString()
    const [{ count: ultMin }, { count: ultHora }] = await Promise.all([
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id).eq('de', 'usuario').gte('created_at', hace(1)),
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id).eq('de', 'usuario').gte('created_at', hace(60)),
    ])
    if ((ultMin || 0) >= MAX_POR_MINUTO || (ultHora || 0) >= MAX_POR_HORA) return res.status(429).json({ error: 'Espera un momento antes de enviar más mensajes' })

    const { data: msg, error: em } = await admin.from('soporte_mensajes')
      .insert({ chat_id: chat.id, de: 'usuario', texto, wa_estado: waConfigurado() ? null : 'sin_configurar' })
      .select('id, created_at').single()
    if (em) return res.status(500).json({ error: 'No se pudo guardar el mensaje' })
    await admin.from('soporte_chats').update({ ultimo_mensaje_at: msg.created_at, ultimo_contexto: contexto || null, email: user.email || chat.email }).eq('id', chat.id)

    if (!waConfigurado()) return res.status(200).json({ ok: true, id: msg.id, wa_estado: 'sin_configurar' })

    // Nombre del torneo si estaba dentro de uno
    let torneo = ''
    const uuid = contexto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
    if (uuid) { const { data: t } = await admin.from('tournaments').select('name').eq('id', uuid).maybeSingle(); torneo = t?.name || '' }
    const quien = user.email || chat.email || 'usuario'
    const donde = torneo ? `Torneo ${torneo}` : (contexto || 'sin pantalla')

    let waId = null, estado = 'enviado'
    try {
      waId = await enviarTexto(`💬 *Soporte #${chat.codigo}*\n👤 ${quien}\n📍 ${donde}\n\n${texto}\n\n↩️ Responde a ESTE mensaje para contestarle.`)
    } catch (e1) {
      // Pasadas 24 h desde tu último mensaje a la línea, WhatsApp solo deja avisar con una plantilla aprobada
      if (!process.env.SOPORTE_PLANTILLA) { estado = 'error'; console.error('soporte-enviar:', e1.message) }
      else {
        try { waId = await enviarPlantilla(process.env.SOPORTE_PLANTILLA, [`#${chat.codigo} ${quien}`, donde, texto]); estado = 'plantilla' }
        catch (e2) { estado = 'error'; console.error('soporte-enviar plantilla:', e2.message) }
      }
    }
    await admin.from('soporte_mensajes').update({ wa_id: waId, wa_estado: estado }).eq('id', msg.id)
    return res.status(200).json({ ok: true, id: msg.id, wa_estado: estado })
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) })
  }
}
