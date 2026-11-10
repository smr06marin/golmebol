// Envío de notificaciones push: app nativa (Firebase Cloud Messaging) y navegador / app instalada (Web Push con VAPID).
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
//   5. ORGANIZADORES: las tarjetas rojas en vivo y los informes de los árbitros (tipos 'roja' e 'informe' de la cola)
//      van solo al celular del dueño del torneo (push_dispositivos.usuario_id) y salen a cualquier hora, en la
//      siguiente vuelta del cron (cada minuto).
//
// Variables de entorno en Vercel (servidor, NUNCA con prefijo VITE_):
//   SUPABASE_SERVICE_ROLE_KEY   clave "service_role" de Supabase
//   FIREBASE_SERVICE_ACCOUNT    el JSON completo de la cuenta de servicio de Firebase (celulares con la app nativa)
//   VITE_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   las mismas del chat de ayuda (navegador y app instalada)
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
// Avisos para ORGANIZADORES (tarjeta roja en vivo e informe del árbitro): salen de inmediato, a cualquier hora,
// y solo a quien es dueño del torneo (o administrador de Golmebol si el torneo no tiene organizador).
const URGENTES = ['roja', 'informe', 'cobro']
const EDAD_URGENTE_H = 6       // una roja o un informe de hace más de 6 horas ya no es "de inmediato"

// ── Firebase (HTTP v1) ────────────────────────────────────────
let cuenta = null
export function leerCuenta() {
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
export async function enviarUno(token, aviso) {
  if (!leerCuenta()) return 'error'
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

// ── Web Push (navegador / app instalada) ───────────────────────
let webpushListo = null
async function cargarWebPush() {
  if (webpushListo !== null) return webpushListo
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) { webpushListo = false; return false }
  try {
    const wp = (await import('web-push')).default
    wp.setVapidDetails('https://golmebol.com', pub, priv)
    webpushListo = wp
  } catch { webpushListo = false }
  return webpushListo
}
export async function enviarWeb(disp, aviso) {
  const wp = await cargarWebPush()
  if (!wp || !disp.suscripcion?.p256dh || !disp.suscripcion?.auth) return 'error'
  try {
    await wp.sendNotification(
      { endpoint: disp.token, keys: { p256dh: disp.suscripcion.p256dh, auth: disp.suscripcion.auth } },
      JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, ruta: aviso.ruta || '/', tag: aviso.tag || 'torneo', tipo: aviso.tipo || '', icono: aviso.icono || '' }),
      { TTL: 86400, urgency: 'normal', timeout: 8000 })
    return 'ok'
  } catch (e) {
    return e?.statusCode === 404 || e?.statusCode === 410 ? 'invalido' : 'error' // el navegador ya no existe
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
    const { data, error } = await db.from('push_dispositivos').select('token, plataforma, suscripcion, equipos, torneos, usuario_id').eq('activo', true).range(desde, desde + 999)
    if (error) throw new Error(error.message)
    todos.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return todos
}

// Quién recibe las rojas / informes de cada torneo: su organizador; si el torneo es de Golmebol (sin organizador), los administradores
async function cargarDuenos(db, items) {
  const ids = [...new Set(items.map(i => i.torneo_id).filter(Boolean))]
  const duenos = {}
  if (!ids.length) return duenos
  try {
    const { data: ts } = await db.from('tournaments').select('id, organizador_id').in('id', ids)
    let admins = null
    for (const t of ts || []) {
      if (t.organizador_id) { duenos[t.id] = new Set([t.organizador_id]); continue }
      if (admins === null) {
        const { data: rs } = await db.from('roles_plataforma').select('user_id').eq('rol', 'admin').neq('activo', false).not('user_id', 'is', null)
        admins = new Set((rs || []).map(r => r.user_id))
      }
      duenos[t.id] = admins
    }
  } catch { /* sin datos de dueños no se manda a nadie: el aviso se da por enviado igual */ }
  return duenos
}

export function leAplica(disp, item, duenos = {}) {
  // roja / informe: solo el organizador del torneo (nunca a los hinchas que siguen el torneo o el equipo)
  if (URGENTES.includes(item.tipo)) return !!disp.usuario_id && !!duenos[item.torneo_id]?.has(disp.usuario_id)
  const siguePorEquipo = item.equipos?.some(e => disp.equipos?.includes(e))
  if (item.tipo === 'recordatorio') return !!siguePorEquipo      // el recordatorio solo por equipo
  return !!siguePorEquipo || (!!item.torneo_id && !!disp.torneos?.includes(item.torneo_id))
}

const RESUMEN = {
  nuevo:     { titulo: 'Partidos nuevos programados', texto: n => `Hay ${n} partidos nuevos de tus equipos y torneos. Abre Golmebol para verlos.` },
  cambio:    { titulo: 'Cambios en tus partidos',     texto: n => `${n} partidos cambiaron de fecha, hora o cancha. Abre Golmebol para verlos.` },
  resultado: { titulo: 'Nuevos resultados',           texto: n => `Terminaron ${n} partidos de tus equipos y torneos. Abre Golmebol para verlos.` },
  recordatorio: { titulo: 'Tus partidos empiezan pronto', texto: n => `${n} de tus partidos empiezan en la próxima hora.` },
  roja:    { titulo: 'Tarjetas rojas en tus partidos', texto: n => `Hubo ${n} tarjetas rojas en tus torneos. Abre Golmebol para verlas.` },
  informe: { titulo: 'Informes de los árbitros',        texto: n => `Los árbitros escribieron ${n} informes en tus torneos. Abre Golmebol para leerlos.` },
  cobro:   { titulo: 'Transferencias de los árbitros',  texto: n => `Los árbitros recibieron ${n} transferencias en la cancha. Abre Golmebol para ver las fotos.` },
}

// ── Aviso ordenado: título corto + líneas (equipos / cuándo y dónde / torneo) ──
const DIAS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function partesBogota(iso) {
  const f = new Date(new Date(iso).getTime() - 5 * 3600 * 1000) // Colombia es UTC-5 todo el año
  const h = f.getUTCHours(), m = f.getUTCMinutes()
  return {
    dia: `${DIAS_ES[f.getUTCDay()]} ${f.getUTCDate()} ${MESES_ES[f.getUTCMonth()]}`,
    hora: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`,
  }
}
const mayus1 = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const urlLogo = u => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : '')

// Devuelve { titulo, cuerpo, icono } o null (si faltan datos: se usa el texto que ya traía la cola)
export function armarAvisoPartido(it, m, disp) {
  if (!m || !m.home || !m.away) return null
  const local = m.home.name || 'Local', visit = m.away.name || 'Visitante'
  const torneo = m.tournaments?.name || ''
  const lugar = (m.location || '').trim()
  const lineas = []
  let titulo
  if (URGENTES.includes(it.tipo)) {
    titulo = it.titulo
    lineas.push(it.cuerpo)
    const jugado = m.home_score != null && m.away_score != null
    lineas.push(`${local}${jugado ? ` ${m.home_score} – ${m.away_score} ` : ' vs '}${visit}`)
    if (torneo) lineas.push(torneo)
    lineas.push(it.tipo === 'informe' ? 'Toca para leer el informe' : it.tipo === 'cobro' ? 'Toca para ver la foto del comprobante' : 'Toca para ver el partido')
    return { titulo, cuerpo: lineas.join('\n'), icono: urlLogo(m.tournaments?.logo_url || m.home.logo_url) }
  }
  if (it.tipo === 'resultado') {
    titulo = 'Resultado final'
    const pen = (m.penales_local ?? '') !== '' && (m.penales_visitante ?? '') !== '' && m.penales_local != null && m.penales_visitante != null
      ? ` (pen. ${m.penales_local}-${m.penales_visitante})` : ''
    lineas.push(`${local} ${m.home_score ?? 0} – ${m.away_score ?? 0} ${visit}${pen}`)
    if (torneo) lineas.push(torneo)
    lineas.push('Toca para ver el minuto a minuto')
  } else {
    const c = m.played_at ? partesBogota(m.played_at) : null
    if (it.tipo === 'recordatorio') titulo = 'Tu partido empieza en 1 hora'
    else if (it.tipo === 'cambio') titulo = 'Cambio en el partido'
    else titulo = 'Nuevo partido programado'
    lineas.push(`${local} vs ${visit}`)
    if (c) {
      const cuando = it.tipo === 'recordatorio' ? c.hora : `${mayus1(c.dia)} · ${c.hora}`
      lineas.push((it.tipo === 'cambio' ? 'Ahora: ' : '') + cuando + (lugar ? ` · ${lugar}` : ''))
    } else if (lugar) lineas.push(lugar)
    if (torneo) lineas.push(torneo)
  }
  // Logo (solo lo muestran Android/Chrome): el del equipo que la persona sigue; si no, el del torneo
  const sigueLocal = disp?.equipos?.includes(m.home_team_id), sigueVisit = disp?.equipos?.includes(m.away_team_id)
  const icono = urlLogo(sigueLocal ? m.home.logo_url : sigueVisit ? m.away.logo_url : (m.tournaments?.logo_url || m.home.logo_url))
  return { titulo, cuerpo: lineas.join('\n'), icono }
}

export function avisosParaDispositivo(items, detalles = {}, disp = null) {
  const porTipo = {}
  for (const it of items) (porTipo[it.tipo] ||= []).push(it)
  const avisos = []
  for (const [tipo, lista] of Object.entries(porTipo)) {
    if (lista.length <= MAX_AGRUPAR) {
      for (const it of lista) {
        const rico = armarAvisoPartido(it, detalles[it.match_id], disp)
        avisos.push({
          tipo, titulo: rico?.titulo || it.titulo, cuerpo: rico?.cuerpo || it.cuerpo, icono: rico?.icono || '',
          // Al tocarlo abre el partido: el resultado abre el minuto a minuto; lo demás, la programación
          ruta: it.tipo === 'cobro'
            ? '/admin/cobros'
            : it.tipo === 'informe' && it.torneo_id
            ? `/admin/torneos/${it.torneo_id}?tab=informes${it.match_id ? `&partido=${it.match_id}` : ''}`
            : it.torneo_id ? `/t/${it.torneo_id}${it.match_id ? `?partido=${it.match_id}` : ''}` : '/',
          tag: URGENTES.includes(it.tipo) ? `${tipo}:${it.id ?? it.match_id}` : `${tipo}:${it.match_id}`, // cada roja / informe es su propia notificación
        })
      }
    } else {
      avisos.push({ tipo, titulo: RESUMEN[tipo].titulo, cuerpo: RESUMEN[tipo].texto(lista.length), ruta: URGENTES.includes(tipo) ? '/admin' : '/', tag: `resumen:${tipo}` })
    }
  }
  return avisos
}

// ── Handler ───────────────────────────────────────────────────
// Un solo archivo para el cron y para la prueba del botón de Avisos (límite de 12 funciones de Vercel Hobby)
export default async function handler(req, res) {
  let accion = ''
  try { accion = new URL(req.url, 'http://x').searchParams.get('accion') || '' } catch { /* sin accion */ }
  if (accion === 'probar') {
    const { probar } = await import('./_pushProbar.js')
    return probar(req, res)
  }
  return enviarCola(req, res)
}

async function enviarCola(req, res) {
  const secreto = (process.env.PUSH_CRON_SECRET || '').trim() // un espacio o salto de línea pegado de más no debe romper el cron
  // El cron manda el secreto en x-cron-secret (Authorization se pierde si el dominio redirige, p. ej. golmebol.com -> www)
  const recibido = String(req.headers['x-cron-secret'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')).trim()
  if (!secreto || recibido !== secreto) {
    // Pista para el administrador (solo largos, nunca el secreto): dice qué lado falla
    const motivo = !secreto ? 'vercel_sin_variable' : !recibido ? 'supabase_no_mando_secreto' : 'no_coinciden'
    return res.status(401).json({ error: 'No autorizado', motivo, largo_vercel: secreto.length, largo_supabase: recibido.length })
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' })

  const ahora = new Date()
  // Fuera del horario (10 pm – 10 am) solo salen las rojas y los informes para organizadores; lo demás espera a las 10 am
  const dentroHorario = enVentanaEnvio(ahora)
  if (!leerCuenta() && !(process.env.VAPID_PRIVATE_KEY && (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY))) {
    return res.status(500).json({ error: 'Falta FIREBASE_SERVICE_ACCOUNT o las claves VAPID (los avisos quedan en espera)' })
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    if (dentroHorario) await crearRecordatorios(db, ahora)

    let consulta = db.from('push_cola').select('*').is('enviado_en', null)
    if (!dentroHorario) consulta = consulta.in('tipo', URGENTES)
    const { data: cola, error } = await consulta.order('id', { ascending: true }).limit(MAX_POR_VUELTA)
    if (error) throw new Error(error.message)
    if (!cola?.length) return res.status(200).json({ enviados: 0, pendientes: 0, ...(dentroHorario ? {} : { motivo: 'fuera del horario (10 am – 10 pm)' }) })

    // Descarta lo que ya no sirve (partido que ya empezó, aviso muy viejo)
    const limiteEdad = ahora.getTime() - EDAD_MAXIMA_H * 3600 * 1000
    const vigentes = [], descartados = []
    for (const it of cola) {
      const limite = URGENTES.includes(it.tipo) ? ahora.getTime() - EDAD_URGENTE_H * 3600 * 1000 : limiteEdad
      const viejo = new Date(it.creado_en).getTime() < limite
      const yaEmpezo = it.vence_en && new Date(it.vence_en).getTime() <= ahora.getTime()
      ;(viejo || yaEmpezo ? descartados : vigentes).push(it.id)
    }
    if (descartados.length) await db.from('push_cola').update({ enviado_en: ahora.toISOString() }).in('id', descartados)
    const items = cola.filter(it => vigentes.includes(it.id))
    if (!items.length) return res.status(200).json({ enviados: 0, descartados: descartados.length })

    // Datos reales de cada partido (equipos, escudos, torneo, lugar) para armar avisos ordenados
    let detalles = {}
    try {
      const ids = [...new Set(items.map(i => i.match_id).filter(Boolean))]
      if (ids.length) {
        const { data: ms } = await db.from('matches')
          .select('*, home:home_team_id(name, logo_url), away:away_team_id(name, logo_url), tournaments(name, logo_url)')
          .in('id', ids)
        for (const m of ms || []) detalles[m.id] = m
      }
    } catch { detalles = {} } // si falla, salen con el texto de siempre

    const duenos = await cargarDuenos(db, items.filter(it => URGENTES.includes(it.tipo)))
    const dispositivos = await cargarDispositivos(db)
    const tareas = []
    for (const d of dispositivos) {
      const suyos = items.filter(it => leAplica(d, it, duenos))
      for (const aviso of avisosParaDispositivo(suyos, detalles, d)) tareas.push(async () => ({ token: d.token, r: d.plataforma === 'web' ? await enviarWeb(d, aviso) : await enviarUno(d.token, aviso) }))
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
