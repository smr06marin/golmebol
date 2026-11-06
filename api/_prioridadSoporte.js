// Orden de los avisos de soporte en Telegram: prioridad de cada chat y lista de pendientes.
//   🔴 URGENTE   quiere organizar su torneo, tiene una cancha (reservas), queja o reglamento, pidió una persona,
//                u organizador con partidos hoy
//   🟠 IMPORTANTE cualquier otro organizador (chat dentro del admin)
//   ⚪ NORMAL    consulta general desde las páginas públicas
// Un chat está PENDIENTE cuando el último mensaje es del visitante u organizador (nadie le ha respondido, ni una
// persona ni el asistente automático). Lo usan los avisos nuevos, el comando /pendientes, /chat N y el resumen diario.

const ZONA = 'America/Bogota'
const PERSONA = /hablar con (una |un )?(persona|humano|asesor|alguien)/i

export const NIVELES = {
  1: { emoji: '🔴', nombre: 'URGENTE' },
  2: { emoji: '🟠', nombre: 'IMPORTANTE' },
  3: { emoji: '⚪', nombre: 'NORMAL' },
}

export function nivelDe(chat, { pidioPersona = false, conPartidosHoy = false } = {}) {
  if (chat.tema === 'organizador') return { nivel: 1, motivo: 'quiere organizar su torneo con Golmebol' }
  if (chat.tema === 'escenario') return { nivel: 1, motivo: 'tiene una cancha y quiere el sistema de reservas' }
  if (chat.tema === 'torneo') return { nivel: 1, motivo: 'reglamento o queja de un torneo' }
  if (pidioPersona) return { nivel: 1, motivo: 'pidió hablar con una persona' }
  if (chat.user_id && conPartidosHoy) return { nivel: 1, motivo: 'organizador con partidos hoy' }
  if (chat.user_id) return { nivel: 2, motivo: 'organizador' }
  return { nivel: 3, motivo: 'consulta general' }
}

// Primera línea de un aviso nuevo: "🔴 URGENTE · motivo\n"
export function lineaPrioridad(chat, opciones) {
  const { nivel, motivo } = nivelDe(chat, opciones)
  return `${NIVELES[nivel].emoji} ${NIVELES[nivel].nombre} · ${motivo}\n`
}

export const pidioPersonaTexto = t => PERSONA.test(String(t || ''))

// Organizadores (ids de usuario) que tienen hoy partidos programados en un torneo activo
export async function usuariosConPartidosHoy(admin, userIds) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))]
    if (!ids.length) return new Set()
    const { data: ts } = await admin.from('tournaments').select('id, organizador_id').in('organizador_id', ids).eq('status', 'active')
    if (!ts?.length) return new Set()
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA }) // 2026-10-04
    const ini = new Date(`${hoy}T00:00:00-05:00`)
    const fin = new Date(ini.getTime() + 86400000)
    const { data: ms } = await admin.from('matches').select('tournament_id').in('tournament_id', ts.map(t => t.id)).gte('played_at', ini.toISOString()).lt('played_at', fin.toISOString()).limit(1000)
    const conPartido = new Set((ms || []).map(m => m.tournament_id))
    return new Set(ts.filter(t => conPartido.has(t.id)).map(t => t.organizador_id))
  } catch { return new Set() }
}

const cortar = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s }
const quien = c => c.nombre || c.email || 'Sin nombre'
function hace(min) {
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${Math.round(min)} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} d`
}

// { pendientes: [{ chat, nivel, motivo, ultimo, esperaMin }], atendidosAuto }
export async function listarPendientes(admin) {
  const desde = new Date(Date.now() - 8 * 86400000).toISOString()
  let r = await admin.from('soporte_chats').select('id, codigo, user_id, origen, tema, nombre, email, ultimo_mensaje_at').gte('ultimo_mensaje_at', desde).order('ultimo_mensaje_at', { ascending: false }).limit(300)
  if (r.error) r = await admin.from('soporte_chats').select('id, codigo, user_id, nombre, email, ultimo_mensaje_at').gte('ultimo_mensaje_at', desde).order('ultimo_mensaje_at', { ascending: false }).limit(300)
  const chats = r.data || []
  if (!chats.length) return { pendientes: [], atendidosAuto: 0 }
  let rm = await admin.from('soporte_mensajes').select('chat_id, de, texto, automatico, created_at').in('chat_id', chats.map(c => c.id)).gte('created_at', desde).order('created_at', { ascending: false }).limit(3000)
  if (rm.error) rm = await admin.from('soporte_mensajes').select('chat_id, de, texto, created_at').in('chat_id', chats.map(c => c.id)).gte('created_at', desde).order('created_at', { ascending: false }).limit(3000)
  const porChat = new Map()
  for (const m of rm.data || []) { if (!porChat.has(m.chat_id)) porChat.set(m.chat_id, []); porChat.get(m.chat_id).push(m) } // del más nuevo al más viejo
  const hace24 = Date.now() - 86400000
  const atendidosAuto = (rm.data || []).filter(m => m.de === 'soporte' && m.automatico && new Date(m.created_at).getTime() >= hace24).length

  const candidatos = []
  for (const c of chats) {
    const ms = porChat.get(c.id) || []
    if (!ms.length || ms[0].de !== 'usuario') continue // el último mensaje no es de ellos: ya se les respondió
    const seguidos = []
    for (const m of ms) { if (m.de !== 'usuario') break; seguidos.push(m) } // los mensajes sin respuesta
    const masViejo = seguidos[seguidos.length - 1]
    candidatos.push({ chat: c, ultimo: seguidos[0], esperaMin: (Date.now() - new Date(masViejo.created_at).getTime()) / 60000, pidioPersona: seguidos.some(m => pidioPersonaTexto(m.texto)) })
  }
  const conPartidos = await usuariosConPartidosHoy(admin, candidatos.map(x => x.chat.user_id))
  const pendientes = candidatos.map(x => ({ ...x, ...nivelDe(x.chat, { pidioPersona: x.pidioPersona, conPartidosHoy: conPartidos.has(x.chat.user_id) }) }))
    .sort((a, b) => (a.nivel - b.nivel) || (b.esperaMin - a.esperaMin))
  return { pendientes, atendidosAuto }
}

const MAX_LISTA = 12
export function textoPendientes({ pendientes, atendidosAuto }, titulo = '📋 Pendientes por responder') {
  const auto = atendidosAuto ? `\n🤖 El asistente atendió solo ${atendidosAuto} ${atendidosAuto === 1 ? 'mensaje' : 'mensajes'} en las últimas 24 h.` : ''
  if (!pendientes.length) return `✅ No tienes chats pendientes. ¡Todo respondido!${auto}`
  const cuenta = [1, 2, 3].map(n => [n, pendientes.filter(p => p.nivel === n).length]).filter(([, k]) => k).map(([n, k]) => `${NIVELES[n].emoji} ${k}`).join(' · ')
  const lineas = [`${titulo}: ${pendientes.length}`, cuenta, '']
  let nivelActual = 0
  for (const p of pendientes.slice(0, MAX_LISTA)) {
    if (p.nivel !== nivelActual) { nivelActual = p.nivel; lineas.push(`${NIVELES[p.nivel].emoji} ${NIVELES[p.nivel].nombre}`) }
    lineas.push(`#${p.chat.codigo} · ${quien(p.chat)} — ${p.motivo} · ${hace(p.esperaMin)}`)
    lineas.push(`“${cortar(p.ultimo.texto || '📎 archivo', 90)}”`)
    lineas.push('')
  }
  if (pendientes.length > MAX_LISTA) lineas.push(`… y ${pendientes.length - MAX_LISTA} más.`, '')
  lineas.push('Para responder: escribe el número y tu mensaje, por ejemplo  #' + pendientes[0].chat.codigo + ' Hola, ya te ayudo.', 'Para ver la conversación: /chat ' + pendientes[0].chat.codigo)
  return (lineas.join('\n') + auto).slice(0, 3900)
}

// /chat 14 → últimos mensajes de esa conversación
export async function textoConversacion(admin, codigo) {
  const n = Number(codigo)
  if (!Number.isInteger(n) || n < 1) return 'Escribe el número del chat, por ejemplo: /chat 14'
  const { data: c } = await admin.from('soporte_chats').select('id, codigo, user_id, tema, nombre, email').eq('codigo', n).maybeSingle()
  if (!c) return `No encontré el chat #${n}.`
  let rm = await admin.from('soporte_mensajes').select('de, texto, automatico, adjunto_tipo, created_at').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(8)
  if (rm.error) rm = await admin.from('soporte_mensajes').select('de, texto, created_at').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(8)
  const ms = (rm.data || []).slice().reverse()
  if (!ms.length) return `El chat #${n} no tiene mensajes (se borran a los 8 días).`
  const { nivel, motivo } = nivelDe(c, { pidioPersona: ms.some(m => m.de === 'usuario' && pidioPersonaTexto(m.texto)) })
  const hora = iso => new Date(iso).toLocaleString('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  const quienDe = m => (m.de === 'usuario' ? `🙋 ${quien(c)}` : m.automatico ? '🤖 Asistente' : '🧑‍💼 Soporte')
  const cuerpo = ms.map(m => `${quienDe(m)} (${hora(m.created_at)})\n${cortar(m.texto, 400) || (m.adjunto_tipo ? `📎 ${m.adjunto_tipo}` : '')}`).join('\n\n')
  return `${NIVELES[nivel].emoji} #${c.codigo} · ${quien(c)} — ${motivo}\n\n${cuerpo}\n\nResponde con:  #${c.codigo} tu mensaje`.slice(0, 3900)
}
