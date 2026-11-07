// (Se llama desde api/push-enviar.js con ?accion=probar: Vercel Hobby solo deja 12 funciones, por eso no es un archivo propio.)
// Prueba de avisos desde el celular: el botón «Enviarme una prueba» (hoja de Avisos) llama aquí.
// Manda UNA notificación de prueba a ESE celular y dice qué encontró el servidor (si está registrado, cuántos equipos
// y torneos sigue, si el envío funcionó o por qué no). Sirve para saber en 20 segundos si los avisos de verdad llegan.
//
// Seguridad: solo se puede probar un celular cuyo "token" ya esté registrado, y ese token solo lo conoce el propio
// celular. No hay cola ni envío masivo: es un solo mensaje, con un descanso de 15 segundos por celular.

import { createClient } from '@supabase/supabase-js'
import { enviarUno, enviarWeb, leerCuenta } from './push-enviar.js'
import { enVentanaEnvio, horaColombia } from './_horario.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ultimaPrueba = new Map() // token -> hora de la última prueba (descanso de 15 s)

function cabeceras(res) {
  res.setHeader('Access-Control-Allow-Origin', '*') // la app nativa (Capacitor) llama desde otro origen
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export async function probar(req, res) {
  cabeceras(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const token = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body).token } catch { return null } })() : req.body?.token
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'Token inválido' })

  // Qué le falta configurar al servidor (para decírselo claro al administrador)
  const faltan = []
  if (!SUPABASE_URL || !SERVICE_KEY) faltan.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.VAPID_PRIVATE_KEY || !(process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY)) faltan.push('VAPID_PRIVATE_KEY / VITE_VAPID_PUBLIC_KEY (navegador y app instalada)')
  if (!leerCuenta()) faltan.push('FIREBASE_SERVICE_ACCOUNT (app nativa)')
  const config = { faltan, cron_secreto: !!process.env.PUSH_CRON_SECRET, en_horario_de_envio: enVentanaEnvio(), hora_colombia: horaColombia() }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ registrado: false, error: 'servidor', config })

  const antes = ultimaPrueba.get(token) || 0
  if (Date.now() - antes < 15000) return res.status(429).json({ error: 'espera', config })
  ultimaPrueba.set(token, Date.now())
  if (ultimaPrueba.size > 500) ultimaPrueba.clear()

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: disp, error } = await db.from('push_dispositivos').select('token, plataforma, suscripcion, equipos, torneos, activo').eq('token', token).maybeSingle()
  if (error) return res.status(500).json({ registrado: false, error: 'base', detalle: String(error.message || '').slice(0, 200), config })
  if (!disp) return res.status(200).json({ registrado: false, config })

  const aviso = { tipo: 'prueba', titulo: 'Golmebol · prueba de avisos', cuerpo: 'Si ves esto, los avisos funcionan en este celular.', ruta: '/', tag: 'prueba' }
  const envio = disp.plataforma === 'web' ? await enviarWeb(disp, aviso) : await enviarUno(disp.token, aviso)
  return res.status(200).json({
    registrado: true, activo: !!disp.activo, plataforma: disp.plataforma,
    equipos: (disp.equipos || []).length, torneos: (disp.torneos || []).length,
    envio, config,
  })
}
