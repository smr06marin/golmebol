// Chat de ayuda PÚBLICO: visitantes de las páginas públicas (sin cuenta) le escriben a Golmebol.
// Lo que escriben te llega a Telegram (marcado "🌐 Público") y tus respuestas vuelven a su chat.
// El visitante se identifica con un "token" secreto guardado en su navegador; nada de esto toca las tablas directamente.
//
// accion "enviar": { token, texto, nombre?, tema?, torneoId?, contacto?, ruta?, web (anti-robots, debe ir vacío) }
// accion "leer":   { token }  → { chat, nombre, mensajes }
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { enviarTelegram, telegramConfigurado } from './_telegram.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TEMAS = {
  organizador: 'Quiere organizar su torneo con Golmebol',
  escenario: 'Tiene una cancha o escenario y quiere sistema de reservas',
  torneo: 'Reglamento o queja de un torneo',
  otro: 'Otra consulta',
}
const MAX_POR_MINUTO = 5
const MAX_POR_HORA = 40
const MAX_CHATS_NUEVOS_POR_IP_HORA = 5

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'El chat no está disponible por ahora. Intenta de nuevo más tarde.' })
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body || '{}') } catch { return {} } })() : (req.body || {})
  const token = String(body.token || '')
  if (!UUID.test(token)) return res.status(400).json({ error: 'Solicitud no válida' })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  try {
    const { data: chat } = await admin.from('soporte_chats').select('*').eq('token', token).eq('origen', 'publico').maybeSingle()

    if (body.accion === 'leer') {
      if (!chat) return res.status(200).json({ chat: false, mensajes: [] })
      const { data: mensajes } = await admin.from('soporte_mensajes').select('id, de, texto, created_at').eq('chat_id', chat.id).order('created_at', { ascending: true }).limit(200)
      return res.status(200).json({ chat: true, nombre: chat.nombre, mensajes: mensajes || [] })
    }
    if (body.accion !== 'enviar') return res.status(400).json({ error: 'Solicitud no válida' })

    if (body.web) return res.status(200).json({ ok: true, id: 'ok' }) // trampa para robots: se les responde "bien" sin guardar nada
    const texto = String(body.texto || '').trim()
    if (!texto) return res.status(400).json({ error: 'Escribe un mensaje' })
    if (texto.length > 600) return res.status(400).json({ error: 'El mensaje es muy largo (máximo 600 letras)' })

    let c = chat
    if (!c) {
      const nombre = String(body.nombre || '').replace(/\s+/g, ' ').trim()
      if (nombre.length < 2 || nombre.length > 60) return res.status(400).json({ error: 'Cuéntanos tu nombre primero' })
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip'
      const ipHash = createHash('sha256').update(`${ip}|golmebol-chat`).digest('hex').slice(0, 24)
      const hace = new Date(Date.now() - 60 * 60000).toISOString()
      const { count } = await admin.from('soporte_chats').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', hace)
      if ((count || 0) >= MAX_CHATS_NUEVOS_POR_IP_HORA) return res.status(429).json({ error: 'Demasiados intentos desde esta conexión. Intenta más tarde.' })
      const tema = Object.hasOwn(TEMAS, body.tema) ? body.tema : 'otro'
      const contacto = String(body.contacto || '').replace(/[^0-9+\s-]/g, '').trim().slice(0, 20) || null
      const torneoId = UUID.test(String(body.torneoId || '')) ? body.torneoId : null
      const { data: nuevo, error } = await admin.from('soporte_chats').insert({ origen: 'publico', token, nombre, tema, torneo_id: torneoId, contacto, ip_hash: ipHash }).select('*').single()
      if (error) { console.error('publico-chat crear:', error.message); return res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo en un momento.' }) }
      c = nuevo
    }

    const hace = min => new Date(Date.now() - min * 60000).toISOString()
    const [{ count: ultMin }, { count: ultHora }] = await Promise.all([
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', c.id).eq('de', 'usuario').gte('created_at', hace(1)),
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', c.id).eq('de', 'usuario').gte('created_at', hace(60)),
    ])
    if ((ultMin || 0) >= MAX_POR_MINUTO || (ultHora || 0) >= MAX_POR_HORA) return res.status(429).json({ error: 'Espera un momento antes de enviar más mensajes' })

    const { data: msg, error: em } = await admin.from('soporte_mensajes')
      .insert({ chat_id: c.id, de: 'usuario', texto, wa_estado: telegramConfigurado() ? null : 'sin_configurar' }).select('id, created_at').single()
    if (em) return res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo en un momento.' })
    const ruta = String(body.ruta || '').slice(0, 200)
    await admin.from('soporte_chats').update({ ultimo_mensaje_at: msg.created_at, ultimo_contexto: ruta || null }).eq('id', c.id)
    if (!telegramConfigurado()) return res.status(200).json({ ok: true, id: msg.id, wa_estado: 'sin_configurar' })

    // Datos del torneo y su organizador para tu aviso
    let torneoTxt = ''
    if (c.torneo_id) {
      const { data: t } = await admin.from('tournaments').select('name, organizador_id').eq('id', c.torneo_id).maybeSingle()
      if (t?.name) {
        let org = ''
        if (t.organizador_id) { const { data: p } = await admin.from('organizador_perfiles').select('nombre_publico').eq('organizador_id', t.organizador_id).maybeSingle(); org = p?.nombre_publico || '' }
        torneoTxt = `\n🏆 ${t.name}${org ? ` · 🏷️ ${org}` : ''}`
      }
    }
    let waId = null, estado = 'enviado'
    try {
      waId = await enviarTelegram(`💬 Soporte #${c.codigo} · 🌐 Público\n🙋 ${c.nombre}${c.contacto ? `\n📱 ${c.contacto}` : ''}\n🎯 ${TEMAS[c.tema] || TEMAS.otro}${torneoTxt}\n📍 ${ruta || 'página pública'}\n\n${texto}\n\n↩️ Responde a ESTE mensaje para contestarle.`)
    } catch (e) { estado = 'error'; console.error('publico-chat telegram:', e.message) }
    await admin.from('soporte_mensajes').update({ wa_id: waId, wa_estado: estado }).eq('id', msg.id)
    return res.status(200).json({ ok: true, id: msg.id, wa_estado: estado })
  } catch (e) {
    console.error('publico-chat:', e?.message || e)
    return res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo en un momento.' })
  }
}
