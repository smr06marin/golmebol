// Envío de notificaciones push de la app (Firebase Cloud Messaging).
//
// Lo llama Supabase (pg_cron) cada 5 minutos con el secreto PUSH_CRON_SECRET.
// Qué hace en cada vuelta:
//   1. Si NO son las 10:00 am – 10:00 pm de Colombia, no manda nada (los avisos
//      esperan en la cola y salen a partir de las 10:00 am).
//   2. Crea los RECORDATORIOS: partidos "scheduled" que empiezan dentro de la
//      próxima hora y todavía no tienen recordatorio. (Si la hora exacta cayó en
//      silencio, sale a las 10:00 am mientras el partido no haya empezado.)
//   3. Manda la cola pendiente (partido nuevo, cambio de fecha/hora/cancha,
//      resultado final) a los celulares que siguen ese equipo o ese torneo.
//      El recordatorio solo les llega a quienes siguen alguno de los dos equipos.
//   4. Si a un celular le toca más de 3 avisos del mismo tipo, recibe uno solo
//      resumido, para no llenarlo de notificaciones.
//
// Variables de entorno en Vercel (servidor, NUNCA con prefijo VITE_):
//   SUPABASE_SERVICE_ROLE_KEY   clave "service_role" de Supabase
//   FIREBASE_SERVICE_ACCOUNT    el JSON completo de la cuenta de servicio de Firebase
//   PUSH_CRON_SECRET            texto largo inventado por ti (el mismo del SQL del cron)
//   (VITE_SUPABASE_URL ya existe)

import { createClient } from '@supabase/supabase-js'
import { createSign } from 'node:crypto'
import { enVentanaEnvio } from './_horario.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAX_AGRUPAR = 3          // más de 3 avisos del mismo tipo para un celular => 1 resumen
const MAX_POR_VUELTA = 300     // avisos de la cola que se procesan por vuelta
const EDAD_MAXIMA_H = 72       // un aviso con más de 3 días ya no sirve
const CONCURRENCIA = 20

// ── Firebase (HTTP v1) ────────────────────────────────────────
let cuenta = null
function leerCuenta() {
  if (cuenta) return cuenta
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null
  try { cuenta = JSON.parse(raw) } catch { return null }
  if (cuenta.private_key) cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n')
  return cuenta
}

let tokenGoogle = { valor: null, vence: 0 }
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')

async function accessToken() {
  if (tokenGoogle.valor && Date.now() < tokenGoogle.vence - 60000) return tokenGoogle.valor
  const c = leerCuenta()
  const ahora = Math.floor(Date.now() / 1000)
  const cuerpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
  })}`
  const firma = createSign('RSA-SHA256').update(cuerpo).sign(c.private_key, 'base64url')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cuerpo}.${firma}` }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('No se pudo autenticar con Firebase: ' + (j.error_description || j.error || r.status))
  tokenGoogle = { valor: j.access_token, vence: Date.now() + (j.expires_in || 3600) * 1000 }
  return tokenGoogle.valor
}

// Devuelve 'ok' | 'invalido' (el celular ya no existe: hay que desactivarlo) | 'error'
async function enviarUno(token, aviso) {
  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${leerCuenta().project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: aviso.titulo, body: aviso.cuerpo },
          data: { ruta: aviso.ruta || '/', tipo: aviso.tipo || '' },
          android: { priority: 'HIGH', notification: { tag: aviso.tag || undefined } },
        },
      }),
    })
    if (r.ok) return 'ok'
    const j = await r.json().catch(() => ({}))
    const estado = j?.error?.status
    if (r.status === 404 || estado === 'NOT_FOUND' || estado === 'UNREGISTERED' || estado === 'INVALID_ARGUMENT') return 'invalido'
    return 'error'
  } catch {
    return 'error'
  }
}

async function enParalelo(tareas, limite) {
  const salida = []
  let i = 0
  async function obrero() {
    while (i < tareas.length) { const n = i++; salida[n] = await tareas[n]() }
  }
  await Promise.all(Array.from({ length: Math.min(limite, tareas.length) }, obrero))
  return salida
}

// ── Recordatorios (1 hora antes) ──────────────────────────────
async function crearRecordatorios(db, ahora) {
  const hasta = new Date(ahora.getTime() + 60 * 60 * 1000)
  const { data: partidos, error } = await db.from('matches')
    .select('id, tournament_id, home_team_id, away_team_id, played_at, location, home:home_team_id(name), away:away_team_id(name), tournaments(name)')
    .eq('status', 'scheduled')
    .gt('played_at', ahora.toISOString())
    .lte('played_at', hasta.toISOString())
  if (error || !partidos?.length) return 0
  const filas = partidos.filter(p => p.home_team_id && p.away_team_id).map(p => {
    const hora = new Date(p.played_at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' }).replace(/\s/g, ' ').toLowerCase()
    return {
      tipo: 'recordatorio', match_id: p.id, torneo_id: p.tournament_id,
      equipos: [p.home_team_id, p.away_team_id],
      titulo: 'Tu partido empieza pronto',
      cuerpo: `${p.home?.name || 'Local'} vs ${p.away?.name || 'Visitante'} · ${hora}${p.location ? ' · ' + p.location : ''}`,
      clave: `rec:${p.id}:${Math.floor(new Date(p.played_at).getTime() / 1000)}`,
      vence_en: p.played_at,
    }
  })
  if (!filas.length) return 0
  await db.from('push_cola').upsert(filas, { onConflict: 'clave', ignoreDuplicates: true })
  return filas.length
}

// ── Destinatarios ─────────────────────────────────────────────
async function cargarDispositivos(db) {
  const todos = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('push_dispositivos').select('token, equipos, torneos').eq('activo', true).range(desde, desde + 999)
    if (error) throw new Error(error.message)
    todos.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return todos
}

export function leAplica(disp, item) {
  const siguePorEquipo = item.equipos?.some(e => disp.equipos?.includes(e))
  if (item.tipo === 'recordatorio') return !!siguePorEquipo      // el recordatorio solo por equipo
  return !!siguePorEquipo || (!!item.torneo_id && !!disp.torneos?.includes(item.torneo_id))
}

const RESUMEN = {
  nuevo:     { titulo: 'Partidos nuevos programados', texto: n => `Hay ${n} partidos nuevos de tus equipos y torneos. Abre Golmebol para verlos.` },
  cambio:    { titulo: 'Cambios en tus partidos',     texto: n => `${n} partidos cambiaron de fecha, hora o cancha. Abre Golmebol para verlos.` },
  resultado: { titulo: 'Nuevos resultados',           texto: n => `Terminaron ${n} partidos de tus equipos y torneos. Abre Golmebol para verlos.` },
  recordatorio: { titulo: 'Tus partidos empiezan pronto', texto: n => `${n} de tus partidos empiezan en la próxima hora.` },
}

export function avisosParaDispositivo(items) {
  const porTipo = {}
  for (const it of items) (porTipo[it.tipo] ||= []).push(it)
  const avisos = []
  for (const [tipo, lista] of Object.entries(porTipo)) {
    if (lista.length <= MAX_AGRUPAR) {
      for (const it of lista) avisos.push({ tipo, titulo: it.titulo, cuerpo: it.cuerpo, ruta: it.torneo_id ? `/t/${it.torneo_id}` : '/', tag: `${tipo}:${it.match_id}` })
    } else {
      avisos.push({ tipo, titulo: RESUMEN[tipo].titulo, cuerpo: RESUMEN[tipo].texto(lista.length), ruta: '/', tag: `resumen:${tipo}` })
    }
  }
  return avisos
}

// ── Handler ───────────────────────────────────────────────────
export default async function handler(req, res) {
  const secreto = process.env.PUSH_CRON_SECRET
  const recibido = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!secreto || recibido !== secreto) return res.status(401).json({ error: 'No autorizado' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' })

  const ahora = new Date()
  if (!enVentanaEnvio(ahora)) return res.status(200).json({ enviados: 0, motivo: 'fuera del horario (10 am – 10 pm)' })
  if (!leerCuenta()) return res.status(500).json({ error: 'Falta FIREBASE_SERVICE_ACCOUNT (los avisos quedan en espera)' })

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    await crearRecordatorios(db, ahora)

    const { data: cola, error } = await db.from('push_cola').select('*').is('enviado_en', null).order('id', { ascending: true }).limit(MAX_POR_VUELTA)
    if (error) throw new Error(error.message)
    if (!cola?.length) return res.status(200).json({ enviados: 0, pendientes: 0 })

    // Descarta lo que ya no sirve (partido que ya empezó, aviso muy viejo)
    const limiteEdad = ahora.getTime() - EDAD_MAXIMA_H * 3600 * 1000
    const vigentes = [], descartados = []
    for (const it of cola) {
      const viejo = new Date(it.creado_en).getTime() < limiteEdad
      const yaEmpezo = it.vence_en && new Date(it.vence_en).getTime() <= ahora.getTime()
      ;(viejo || yaEmpezo ? descartados : vigentes).push(it.id)
    }
    if (descartados.length) await db.from('push_cola').update({ enviado_en: ahora.toISOString() }).in('id', descartados)
    const items = cola.filter(it => vigentes.includes(it.id))
    if (!items.length) return res.status(200).json({ enviados: 0, descartados: descartados.length })

    const dispositivos = await cargarDispositivos(db)
    const tareas = []
    for (const d of dispositivos) {
      const suyos = items.filter(it => leAplica(d, it))
      for (const aviso of avisosParaDispositivo(suyos)) tareas.push(async () => ({ token: d.token, r: await enviarUno(d.token, aviso) }))
    }
    const resultados = await enParalelo(tareas, CONCURRENCIA)

    // Si NADIE recibió nada y hubo errores (Firebase caído, credenciales malas), los avisos se quedan
    // en la cola para reintentar en la próxima vuelta.
    if (tareas.length && !resultados.some(x => x?.r === 'ok' || x?.r === 'invalido')) {
      return res.status(502).json({ error: 'Firebase no aceptó ningún mensaje; se reintenta en la próxima vuelta', intentos: tareas.length })
    }

    // Celulares que ya no existen: se desactivan
    const invalidos = [...new Set(resultados.filter(x => x?.r === 'invalido').map(x => x.token))]
    if (invalidos.length) await db.from('push_dispositivos').update({ activo: false }).in('token', invalidos)

    await db.from('push_cola').update({ enviado_en: ahora.toISOString() }).in('id', items.map(i => i.id))
    // Limpieza: avisos enviados hace más de 14 días
    await db.from('push_cola').delete().lt('enviado_en', new Date(ahora.getTime() - 14 * 86400000).toISOString())

    return res.status(200).json({
      avisos_procesados: items.length, descartados: descartados.length,
      mensajes_enviados: resultados.filter(x => x?.r === 'ok').length,
      fallidos: resultados.filter(x => x?.r === 'error').length, desactivados: invalidos.length,
    })
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 300) })
  }
}
