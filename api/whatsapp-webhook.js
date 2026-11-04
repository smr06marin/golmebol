// Chat de ayuda: lo que TÚ contestas en WhatsApp vuelve al chat del organizador.
// Meta llama a esta dirección (https://golmebol.com/api/whatsapp-webhook):
//   GET  → verificación inicial del webhook (hub.verify_token)
//   POST → mensajes que llegan a la línea de soporte
//
// Variables de entorno en Vercel: ver api/_whatsapp.js, y además
//   WHATSAPP_VERIFY_TOKEN   texto inventado por ti (el mismo que pones en Meta al configurar el webhook)
//   WHATSAPP_APP_SECRET     "Clave secreta de la app" de Meta (para comprobar que el aviso es de Meta)
//   SUPABASE_SERVICE_ROLE_KEY
//
// A qué chat va tu respuesta (en este orden):
//   1. Respondes (mantener presionado → Responder) al mensaje del organizador.   ← lo normal
//   2. Empiezas el mensaje con el número:  #12 hola, ya te ayudo
//   3. Si no, al último organizador que escribió y todavía no tiene respuesta.

import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { enviarTexto, destinoSoporte, soloDigitos } from './_whatsapp.js'
import { guardarRespuesta, AYUDA_RUTA } from './_soporteRespuesta.js'

export const config = { api: { bodyParser: false } }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function leerCrudo(req) {
  const partes = []
  for await (const p of req) partes.push(typeof p === 'string' ? Buffer.from(p) : p)
  return Buffer.concat(partes)
}

function firmaValida(crudo, cabecera) {
  const secreto = process.env.WHATSAPP_APP_SECRET
  if (!secreto || !cabecera) return false
  const esperada = 'sha256=' + createHmac('sha256', secreto).update(crudo).digest('hex')
  const a = Buffer.from(esperada), b = Buffer.from(String(cabecera))
  return a.length === b.length && timingSafeEqual(a, b)
}


export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': modo, 'hub.verify_token': tk, 'hub.challenge': reto } = req.query || {}
    if (modo === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && tk === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(String(reto))
    return res.status(403).send('Token no válido')
  }
  if (req.method !== 'POST') return res.status(405).end()
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' })
  if (!process.env.WHATSAPP_APP_SECRET) return res.status(500).json({ error: 'Falta WHATSAPP_APP_SECRET' })

  const crudo = await leerCrudo(req)
  if (!firmaValida(crudo, req.headers['x-hub-signature-256'])) return res.status(401).json({ error: 'Firma no válida' })

  let datos
  try { datos = JSON.parse(crudo.toString('utf8')) } catch { return res.status(400).json({ error: 'Cuerpo no válido' }) }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const mio = destinoSoporte()

  try {
    for (const entrada of datos.entry || []) {
      for (const cambio of entrada.changes || []) {
        for (const m of cambio.value?.messages || []) {
          // Solo se aceptan mensajes de TU número: nadie más puede contestar en nombre del soporte
          if (!mio || soloDigitos(m.from) !== mio) continue

          if (m.type !== 'text' || !m.text?.body) {
            await enviarTexto('Por ahora el chat solo muestra texto. Escribe tu respuesta en letras.', m.id).catch(() => {})
            continue
          }
          const r = await guardarRespuesta(admin, { texto: m.text.body, citadoId: m.context?.id, idMensaje: m.id })
          if (!r.ok) await enviarTexto(AYUDA_RUTA, m.id).catch(() => {})
        }
      }
    }
  } catch (e) {
    console.error('whatsapp-webhook:', e.message || e)
    return res.status(500).json({ error: 'No se pudo guardar' }) // Meta reintenta solo
  }
  return res.status(200).json({ ok: true })
}
