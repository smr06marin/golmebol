// Chat de ayuda: el organizador escribe en la web → se guarda → te llega a WhatsApp.
// Lo llama el chat de la web con el token de sesión del usuario (Authorization: Bearer ...).
// Si WhatsApp no está configurado o falla, el mensaje igual queda guardado en el chat.

import { createClient } from '@supabase/supabase-js'
import { enviarTexto, enviarPlantilla, waConfigurado } from './_whatsapp.js'
import { enviarTelegram, enviarTelegramArchivo, telegramConfigurado, enviarEnTema, pieResponder } from './_telegram.js'
import { aOggOpus } from './_audio.js'
import { responderAuto } from './_asistente.js'
import { lineaPrioridad, usuariosConPartidosHoy } from './_prioridadSoporte.js'
import { describirRuta } from './_dondeEstaba.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'soporte-adjuntos'
const MAX_POR_MINUTO = 8
const MAX_POR_HORA = 60

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('soporte-enviar: falta SUPABASE_SERVICE_ROLE_KEY en Vercel')
    return res.status(500).json({ error: 'El chat no está disponible por ahora. Intenta de nuevo más tarde.' })
  }

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
    if (texto.length > 1000) return res.status(400).json({ error: 'El mensaje es muy largo (máximo 1000 letras)' })

    const { data: chat } = await admin.from('soporte_chats').select('*').eq('user_id', user.id).maybeSingle()
    if (!chat) return res.status(400).json({ error: 'Abre el chat otra vez e intenta de nuevo' })

    // Foto o video (ya subido a Storage por /api/soporte-adjunto): se valida que sea de ESTE chat
    let adj = null, urlAdj = ''
    const ruta = String(body.adjunto?.path || '')
    if (ruta) {
      const m = ruta.match(/^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm|m4a|mp3|aac|weba|ogg)$/i)
      if (!m || m[1] !== chat.id) return res.status(400).json({ error: 'Archivo no válido' })
      const ext = m[2].toLowerCase()
      const { data: firmada, error: ef } = await admin.storage.from(BUCKET).createSignedUrl(ruta, 3600)
      if (ef || !firmada?.signedUrl) return res.status(400).json({ error: 'No encontramos el archivo. Vuelve a intentarlo.' })
      adj = { path: ruta, ext, tipo: ['mp4', 'mov', 'webm'].includes(ext) ? 'video' : ['m4a', 'mp3', 'aac', 'weba', 'ogg'].includes(ext) ? 'audio' : 'imagen' }
      urlAdj = firmada.signedUrl
    }
    if (!texto && !adj) return res.status(400).json({ error: 'Escribe un mensaje' })

    // Si pidió una persona, se le cuenta cuál era su pregunta anterior
    const pidioPersona = /hablar con (una |un )?(persona|humano|asesor|alguien)/i.test(texto)
    let previo = ''
    if (pidioPersona) {
      const { data: p } = await admin.from('soporte_mensajes').select('texto').eq('chat_id', chat.id).eq('de', 'usuario').order('created_at', { ascending: false }).limit(1)
      previo = p?.[0]?.texto || ''
    }

    // Freno contra spam
    const hace = min => new Date(Date.now() - min * 60000).toISOString()
    const [{ count: ultMin }, { count: ultHora }] = await Promise.all([
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id).eq('de', 'usuario').gte('created_at', hace(1)),
      admin.from('soporte_mensajes').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id).eq('de', 'usuario').gte('created_at', hace(60)),
    ])
    if ((ultMin || 0) >= MAX_POR_MINUTO || (ultHora || 0) >= MAX_POR_HORA) return res.status(429).json({ error: 'Espera un momento antes de enviar más mensajes' })

    const { data: msg, error: em } = await admin.from('soporte_mensajes')
      .insert({ chat_id: chat.id, de: 'usuario', texto, adjunto_path: adj?.path || null, adjunto_tipo: adj?.tipo || null, wa_estado: (telegramConfigurado() || waConfigurado()) ? null : 'sin_configurar' })
      .select('id, created_at').single()
    if (em) return res.status(500).json({ error: 'No se pudo guardar el mensaje' })
    await admin.from('soporte_chats').update({ ultimo_mensaje_at: msg.created_at, ultimo_contexto: contexto || null, email: user.email || chat.email }).eq('id', chat.id)


    // Asistente automático: solo si la pregunta nombra un equipo o un torneo (las demás son de cómo usar la plataforma y las atiende una persona)
    let auto = null
    if (texto && !adj) {
      try { auto = await responderAuto(admin, texto, { exigirMencion: true }) } catch (e) { console.error('soporte-enviar asistente:', e?.message) }
    }
    if (auto) {
      const { data: r, error: er } = await admin.from('soporte_mensajes').insert({ chat_id: chat.id, de: 'soporte', texto: auto.texto.slice(0, 1900), automatico: true }).select('created_at').single()
      if (er) { console.error('soporte-enviar respuesta automática:', er.message); auto = null } // si no se pudo guardar, lo atiende una persona
      else await admin.from('soporte_chats').update({ ultimo_mensaje_at: r.created_at }).eq('id', chat.id)
    }

    if (!telegramConfigurado() && !waConfigurado()) return res.status(200).json({ ok: true, id: msg.id, auto: !!auto, wa_estado: 'sin_configurar' })

    // Dónde estaba: el nombre del equipo, jugador o torneo (no la dirección con el código largo)
    const quien = user.email || chat.email || 'usuario'
    const donde = (await describirRuta(admin, contexto)) || 'sin pantalla'

    // Quién es: nombre del organizador (su perfil público), rol si no es organizador y los torneos que organiza
    const lineaNombre = chat.nombre ? [`🙋 ${chat.nombre}`] : [] // el nombre que dijo la primera vez
    let lineasQuien = [...lineaNombre, `👤 ${quien}`]
    try {
      const [{ data: rolFila }, { data: perfil }, { data: ts }] = await Promise.all([
        admin.from('roles_plataforma').select('rol').eq('user_id', user.id).limit(1).maybeSingle(),
        admin.from('organizador_perfiles').select('nombre_publico').eq('organizador_id', user.id).maybeSingle(),
        admin.from('tournaments').select('name').eq('organizador_id', user.id).order('created_at', { ascending: false }).limit(20),
      ])
      const nombres = (ts || []).map(t => t.name).filter(Boolean)
      lineasQuien = [
        ...lineaNombre,
        ...(perfil?.nombre_publico ? [`🏷️ ${perfil.nombre_publico}`] : []),
        `👤 ${quien}`,
        ...(rolFila?.rol && rolFila.rol !== 'organizador' ? [`🔑 Rol: ${rolFila.rol}`] : []),
        ...(nombres.length ? [`🏆 ${nombres.slice(0, 4).join(', ')}${nombres.length > 4 ? ` (+${nombres.length - 4} más)` : ''}`] : []),
      ]
    } catch (e) { console.error('soporte-enviar quien:', e?.message) } // si falla, el aviso sale solo con el correo
    const datosQuien = lineasQuien.join('\n')

    let waId = null, estado = 'enviado'
    if (telegramConfigurado()) {
      try {
        const prioridad = auto ? '' : lineaPrioridad(chat, { pidioPersona, conPartidosHoy: (await usuariosConPartidosHoy(admin, [user.id])).has(user.id) })
        const cab = `${prioridad}💬 Soporte #${chat.codigo}${auto ? ' · 🤖 respondió el asistente' : ''}\n${datosQuien}\n📍 ${donde}`
        const pie = pieResponder()
        if (adj) {
          const { data: archivo, error: ed } = await admin.storage.from(BUCKET).download(adj.path)
          if (ed || !archivo) throw new Error('No se pudo leer el archivo guardado')
          let envio = archivo, nombreEnvio = `adjunto.${adj.ext}`
          if (adj.tipo === 'audio') { // la nota de voz que graba el navegador no trae duración: se pasa a OGG/Opus para que Telegram la reproduzca
            const ogg = await aOggOpus(Buffer.from(await archivo.arrayBuffer()), adj.ext === 'weba' ? 'webm' : adj.ext)
            if (ogg) { envio = new Blob([ogg], { type: 'audio/ogg' }); nombreEnvio = 'voz.ogg' }
          }
          const cabe = !texto || (cab.length + texto.length + pie.length + 2) <= 1024 // la leyenda de Telegram admite 1024 letras
          waId = await enviarEnTema(admin, chat, chat.nombre || quien, async tema => {
            const id = await enviarTelegramArchivo({ tipo: adj.tipo, archivo: envio, nombre: nombreEnvio, leyenda: cab + (texto && cabe ? `\n\n${texto}` : '') + pie, temaId: tema })
            if (texto && !cabe) await enviarTelegram(texto, undefined, Number(id.slice(3)), false, tema).catch(() => {})
            return id
          })
        } else {
          const extra = (auto ? `\n\n🤖 Respuesta automática:\n${auto.texto}` : '') + (pidioPersona ? `\n\n🙋 Pidió hablar con una persona${previo ? `\nSu pregunta anterior: ${previo}` : ''}` : '')
          waId = await enviarEnTema(admin, chat, chat.nombre || quien, tema => enviarTelegram(`${cab}\n\n${texto}${extra}${pie}`, undefined, undefined, !!auto, tema))
        }
      }
      catch (e) { estado = 'error'; console.error('soporte-enviar telegram:', e.message) }
    } else try {
      waId = await enviarTexto(`💬 *Soporte #${chat.codigo}*\n${datosQuien}\n📍 ${donde}\n\n${texto}${adj ? `\n\n📎 ${adj.tipo === 'video' ? 'Video' : adj.tipo === 'audio' ? 'Audio' : 'Foto'}: ${urlAdj}` : ''}\n\n↩️ Responde a ESTE mensaje para contestarle.`)
    } catch (e1) {
      // Pasadas 24 h desde tu último mensaje a la línea, WhatsApp solo deja avisar con una plantilla aprobada
      if (!process.env.SOPORTE_PLANTILLA) { estado = 'error'; console.error('soporte-enviar:', e1.message) }
      else {
        try { waId = await enviarPlantilla(process.env.SOPORTE_PLANTILLA, [`#${chat.codigo} ${quien}`, donde, texto]); estado = 'plantilla' }
        catch (e2) { estado = 'error'; console.error('soporte-enviar plantilla:', e2.message) }
      }
    }
    await admin.from('soporte_mensajes').update({ wa_id: waId, wa_estado: estado }).eq('id', msg.id)
    return res.status(200).json({ ok: true, id: msg.id, auto: !!auto, wa_estado: estado })
  } catch (e) {
    console.error('soporte-enviar:', e.message || e)
    return res.status(500).json({ error: 'No se pudo enviar. Intenta de nuevo en un momento.' })
  }
}
