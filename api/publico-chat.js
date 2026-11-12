// Chat de ayuda PÚBLICO: visitantes de las páginas públicas (sin cuenta) le escriben a Golmebol.
// Lo que escriben te llega a Telegram (marcado "🌐 Público") y tus respuestas vuelven a su chat.
// El visitante se identifica con un "token" secreto guardado en su navegador; nada de esto toca las tablas directamente.
//
// accion "adjunto": { token, contentType, size, (nombre, tema, torneoId, contacto si aún no tiene chat) }
//                   → { path, token, tipo }  permiso temporal para subir UNA foto o audio directo a Storage
// accion "enviar":  { token, texto, adjunto?: { path }, nombre?, tema?, torneoId?, contacto?, ruta?, web (anti-robots, debe ir vacío) }
// accion "leer":    { token }  → { chat, nombre, mensajes }  (las fotos y audios llegan con un link temporal: adjunto_url)
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { enviarTelegram, enviarTelegramArchivo, telegramConfigurado } from './_telegram.js'
import { aOggOpus } from './_audio.js'
import { responderAuto } from './_asistente.js'
import { lineaPrioridad } from './_prioridadSoporte.js'
import { describirRuta } from './_dondeEstaba.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'soporte-adjuntos'
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
const MAX_ADJUNTOS_POR_HORA = 15

// En el chat público se aceptan fotos y audios (notas de voz)
const TIPOS = {
  'image/jpeg': { ext: 'jpg', tipo: 'imagen', max: 10 * 1024 * 1024 },
  'image/png':  { ext: 'png', tipo: 'imagen', max: 10 * 1024 * 1024 },
  'image/webp': { ext: 'webp', tipo: 'imagen', max: 10 * 1024 * 1024 },
  'audio/mp4':  { ext: 'm4a', tipo: 'audio', max: 15 * 1024 * 1024 },
  'audio/x-m4a': { ext: 'm4a', tipo: 'audio', max: 15 * 1024 * 1024 },
  'audio/mpeg': { ext: 'mp3', tipo: 'audio', max: 15 * 1024 * 1024 },
  'audio/aac':  { ext: 'aac', tipo: 'audio', max: 15 * 1024 * 1024 },
  'audio/webm': { ext: 'weba', tipo: 'audio', max: 15 * 1024 * 1024 },
  'audio/ogg':  { ext: 'ogg', tipo: 'audio', max: 15 * 1024 * 1024 },
}
const EXT_AUDIO = ['m4a', 'mp3', 'aac', 'weba', 'ogg']

// Crea el chat del visitante la primera vez que escribe (o envía un archivo)
async function crearChat(admin, req, body, token) {
  const nombre = String(body.nombre || '').replace(/\s+/g, ' ').trim()
  if (nombre.length < 2 || nombre.length > 60) return { error: 'Cuéntanos tu nombre primero', status: 400 }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip'
  const ipHash = createHash('sha256').update(`${ip}|golmebol-chat`).digest('hex').slice(0, 24)
  const hace = new Date(Date.now() - 60 * 60000).toISOString()
  const { count } = await admin.from('soporte_chats').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', hace)
  if ((count || 0) >= MAX_CHATS_NUEVOS_POR_IP_HORA) return { error: 'Demasiados intentos desde esta conexión. Intenta más tarde.', status: 429 }
  const tema = Object.hasOwn(TEMAS, body.tema) ? body.tema : 'otro'
  const contacto = String(body.contacto || '').replace(/[^0-9+\s-]/g, '').trim().slice(0, 20) || null
  const torneoId = UUID.test(String(body.torneoId || '')) ? body.torneoId : null
  const { data: nuevo, error } = await admin.from('soporte_chats').insert({ origen: 'publico', token, nombre, tema, torneo_id: torneoId, contacto, ip_hash: ipHash }).select('*').single()
  if (error) { console.error('publico-chat crear:', error.message); return { error: 'No se pudo enviar. Intenta de nuevo en un momento.', status: 500 } }
  return { chat: nuevo }
}

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
      const { data: filas } = await admin.from('soporte_mensajes').select('id, de, texto, created_at, automatico, adjunto_path, adjunto_tipo').eq('chat_id', chat.id).order('created_at', { ascending: true }).limit(200)
      const mensajes = filas || []
      // Fotos y audios: link temporal (1 hora) para verlos/oírlos sin cuenta
      const rutas = mensajes.map(m => m.adjunto_path).filter(Boolean)
      if (rutas.length) {
        const { data: firmadas } = await admin.storage.from(BUCKET).createSignedUrls(rutas, 3600)
        const porRuta = new Map((firmadas || []).filter(f => f?.signedUrl).map(f => [f.path, f.signedUrl]))
        mensajes.forEach(m => { if (m.adjunto_path) m.adjunto_url = porRuta.get(m.adjunto_path) || null })
      }
      return res.status(200).json({ chat: true, nombre: chat.nombre, mensajes: mensajes.map(({ adjunto_path, ...m }) => ({ ...m, tiene_adjunto: !!adjunto_path })) })
    }

    if (body.accion === 'adjunto') {
      if (body.web) return res.status(400).json({ error: 'Solicitud no válida' })
      const info = TIPOS[String(body.contentType || '').toLowerCase().split(';')[0]]
      const size = Number(body.size) || 0
      if (!info) return res.status(400).json({ error: 'Solo se pueden enviar fotos y audios' })
      if (size <= 0 || size > info.max) return res.status(400).json({ error: info.tipo === 'audio' ? 'El audio es muy largo o pesado. Envía uno más corto.' : 'La foto pesa demasiado. Prueba con otra.' })
      let c = chat
      if (!c) {
        const r = await crearChat(admin, req, body, token)
        if (r.error) return res.status(r.status).json({ error: r.error })
        c = r.chat
      }
      const hace = new Date(Date.now() - 60 * 60000).toISOString()
      const { count } = await admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', c.id).eq('de', 'usuario').not('adjunto_path', 'is', null).gte('created_at', hace)
      if ((count || 0) >= MAX_ADJUNTOS_POR_HORA) return res.status(429).json({ error: 'Enviaste muchos archivos seguidos. Espera un momento.' })
      const path = `${c.id}/${randomUUID()}.${info.ext}`
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data?.token) { console.error('publico-chat adjunto:', error?.message); return res.status(500).json({ error: 'No se pudo preparar el archivo. Intenta de nuevo.' }) }
      return res.status(200).json({ path, token: data.token, tipo: info.tipo })
    }

    if (body.accion !== 'enviar') return res.status(400).json({ error: 'Solicitud no válida' })

    if (body.web) return res.status(200).json({ ok: true, id: 'ok' }) // trampa para robots: se les responde "bien" sin guardar nada
    const texto = String(body.texto || '').trim()
    if (texto.length > 600) return res.status(400).json({ error: 'El mensaje es muy largo (máximo 600 letras)' })

    let c = chat
    if (!c) {
      if (!texto) return res.status(400).json({ error: 'Escribe un mensaje' })
      const r = await crearChat(admin, req, body, token)
      if (r.error) return res.status(r.status).json({ error: r.error })
      c = r.chat
    }

    // Foto o audio ya subido a Storage (con el permiso de "adjunto"): se valida que sea de ESTE chat
    let adj = null
    const rutaAdj = String(body.adjunto?.path || '')
    if (rutaAdj) {
      const m = rutaAdj.match(/^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp|m4a|mp3|aac|weba|ogg)$/i)
      if (!m || m[1] !== c.id) return res.status(400).json({ error: 'Archivo no válido' })
      const ext = m[2].toLowerCase()
      adj = { path: rutaAdj, ext, tipo: EXT_AUDIO.includes(ext) ? 'audio' : 'imagen' }
    }
    if (!texto && !adj) return res.status(400).json({ error: 'Escribe un mensaje' })

    const hace = min => new Date(Date.now() - min * 60000).toISOString()
    const [{ count: ultMin }, { count: ultHora }] = await Promise.all([
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', c.id).eq('de', 'usuario').gte('created_at', hace(1)),
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', c.id).eq('de', 'usuario').gte('created_at', hace(60)),
    ])
    if ((ultMin || 0) >= MAX_POR_MINUTO || (ultHora || 0) >= MAX_POR_HORA) return res.status(429).json({ error: 'Espera un momento antes de enviar más mensajes' })

    // Si pidió una persona, se le cuenta cuál era su pregunta anterior
    const pidioPersona = /hablar con (una |un )?(persona|humano|asesor|alguien)/i.test(texto)
    let previo = ''
    if (pidioPersona) {
      const { data: p } = await admin.from('soporte_mensajes').select('texto').eq('chat_id', c.id).eq('de', 'usuario').order('created_at', { ascending: false }).limit(1)
      previo = p?.[0]?.texto || ''
    }

    const { data: msg, error: em } = await admin.from('soporte_mensajes')
      .insert({ chat_id: c.id, de: 'usuario', texto, adjunto_path: adj?.path || null, adjunto_tipo: adj?.tipo || null, wa_estado: telegramConfigurado() ? null : 'sin_configurar' })
      .select('id, created_at').single()
    if (em) return res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo en un momento.' })
    const ruta = String(body.ruta || '').slice(0, 200)
    await admin.from('soporte_chats').update({ ultimo_mensaje_at: msg.created_at, ultimo_contexto: ruta || null }).eq('id', c.id)

    // Asistente automático: contesta solo lo que se puede responder con datos de Golmebol (solo en consultas generales
    // de texto, no en las de organizar un torneo, reservas, reglamento/quejas o fotos/audios, que atiende una persona)
    let auto = null
    if (c.tema === 'otro' && texto && !adj) {
      try { auto = await responderAuto(admin, texto, { torneoCtx: ruta.match(/^\/t\/([0-9a-f-]{36})/i)?.[1] }) } catch (e) { console.error('publico-chat asistente:', e?.message) }
    }
    if (auto) {
      const { data: r, error: er } = await admin.from('soporte_mensajes').insert({ chat_id: c.id, de: 'soporte', texto: auto.texto.slice(0, 1900), automatico: true }).select('created_at').single()
      if (er) { console.error('publico-chat respuesta automática:', er.message); auto = null } // si no se pudo guardar, lo atiende una persona
      else await admin.from('soporte_chats').update({ ultimo_mensaje_at: r.created_at }).eq('id', c.id)
    }
    if (!telegramConfigurado()) return res.status(200).json({ ok: true, id: msg.id, auto: !!auto, wa_estado: 'sin_configurar' })

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
    const dondeTxt = (await describirRuta(admin, ruta)) || 'página pública'
    const cab = `${auto ? '' : lineaPrioridad(c, { pidioPersona })}💬 Soporte #${c.codigo} · 🌐 Público${auto ? ' · 🤖 respondió el asistente' : ''}\n🙋 ${c.nombre}${c.contacto ? `\n📱 ${c.contacto}` : ''}\n🎯 ${TEMAS[c.tema] || TEMAS.otro}${torneoTxt}\n📍 ${dondeTxt}`
    const pie = '\n\n↩️ Responde a ESTE mensaje para contestarle.'
    try {
      if (adj) {
        const { data: archivo, error: ed } = await admin.storage.from(BUCKET).download(adj.path)
        if (ed || !archivo) throw new Error('No se pudo leer el archivo guardado')
        let envio = archivo, nombreEnvio = `adjunto.${adj.ext}`
        if (adj.tipo === 'audio') { // la nota de voz que graba el navegador no trae duración: se pasa a OGG/Opus para que Telegram la reproduzca
          try {
            const ogg = await aOggOpus(Buffer.from(await archivo.arrayBuffer()), adj.ext === 'weba' ? 'webm' : adj.ext)
            if (ogg) { envio = new Blob([ogg], { type: 'audio/ogg' }); nombreEnvio = 'voz.ogg' }
          } catch (e) { console.error('publico-chat audio:', e?.message) } // si no se puede convertir, va como archivo
        }
        const cabe = !texto || (cab.length + texto.length + pie.length + 2) <= 1024 // la leyenda de Telegram admite 1024 letras
        waId = await enviarTelegramArchivo({ tipo: adj.tipo, archivo: envio, nombre: nombreEnvio, leyenda: cab + (texto && cabe ? `\n\n${texto}` : '') + pie })
        if (texto && !cabe) await enviarTelegram(texto, undefined, Number(waId.slice(3))).catch(() => {})
      } else {
        waId = await enviarTelegram(`${cab}\n\n${texto}${auto ? `\n\n🤖 Respuesta automática:\n${auto.texto}` : ''}${pidioPersona ? `\n\n🙋 Pidió hablar con una persona${previo ? `\nSu pregunta anterior: ${previo}` : ''}` : ''}${pie}`, undefined, undefined, !!auto)
      }
    } catch (e) { estado = 'error'; console.error('publico-chat telegram:', e.message) }
    await admin.from('soporte_mensajes').update({ wa_id: waId, wa_estado: estado }).eq('id', msg.id)
    return res.status(200).json({ ok: true, id: msg.id, auto: !!auto, wa_estado: estado })
  } catch (e) {
    console.error('publico-chat:', e?.message || e)
    return res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo en un momento.' })
  }
}
