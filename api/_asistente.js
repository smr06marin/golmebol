// Asistente automático del chat de ayuda: responde solo las preguntas que se pueden contestar con datos
// que Golmebol YA tiene guardados y que son públicos (partidos de un equipo, tablas, goleadores, campeón,
// torneos activos, cómo reservar una cancha). Sin inteligencia artificial: reconoce la pregunta por palabras
// clave y arma la respuesta con los datos reales. Si no entiende la pregunta, devuelve null y el mensaje
// le llega a una persona por Telegram como siempre. Nunca inventa: si no tiene el dato, lo dice.

import { responderGuia } from './_guiasAyuda.js'

const DOMINIO = 'https://golmebol.com'
const ZONA = 'America/Bogota'

const SALUDO = '¡Hola! 👋 Soy el asistente automático de Golmebol. Puedo contarte cuándo juega tu equipo, cómo le fue, la tabla de posiciones, los goleadores y cómo reservar una cancha. ¿Qué quieres saber? Si necesitas otra cosa, escríbela y una persona te responde.'
const HORARIO = '🕒 Atendemos todos los días de 7:00 a. m. a 11:00 p. m. (hora de Colombia). Fuera de ese horario deja tu mensaje y te respondemos apenas podamos.'

const PARAR_EQUIPO = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'fc', 'club', 'cd', 'deportivo', 'sporting', 'team', 'equipo', 'golmebol', 'y', 'e'])
const PARAR_TORNEO = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'torneo', 'copa', 'cup', 'liga', 'campeonato', 'futbol', 'y', 'e'])

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

const RX = {
  saludo: /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|ola|saludos|que tal)( [a-z]{0,20}){0,2}$/,
  persona: /(hablar con (una |un )?(persona|alguien|humano|asesor|agente)|asesor|humano)/,
  reglamento: /(reglamento|queja|reclamo|denuncia|protesto|sancion|expulsion|apelacion|apelar|soborno|trampa|fraude)/,
  lead: /((quiero|queremos|necesito|necesitamos|me interesa|nos interesa).{0,40}(organizar|montar|crear|hacer).{0,30}torneo)|((tengo|tenemos|administro|manejo|soy dueno|somos duenos).{0,25}(cancha|canchas|escenario|complejo))|((precio|costo|cuanto cuesta|cuanto vale|cuanto cobran).{0,30}(golmebol|plataforma|sistema|la app))/,
  horario: /(horario de atencion|a que hora (atienden|responden|abren)|hay alguien|estan disponibles)/,
  reserva: /(reserv|alquil|arrend).{0,30}cancha|cancha.{0,30}(reserv|alquil|disponib)|como reservo|reservar|sistema de reservas?|agendar.{0,15}cancha/,
  torneos: /((que|cuales|cuantos|cuantas).{0,25}torneos)|(torneos (activos|disponibles|hay))|lista de torneos|hay torneos/,
  proximo: /((cuando|a que hora|que dia|contra quien|con quien|donde).{0,25}(juega|jugamos|jugara|toca|es el partido|partido))|proximo partido|siguiente partido|proximos partidos|programacion|calendario|fixture|horarios? (de|del) (los )?partidos?|partidos de (hoy|manana)|partidos (hoy|manana)|que partidos|que juegos/,
  resultado: /(como (quedo|quedaron|le fue|les fue)|resultados?|cuanto quedo|marcador|ultimo partido|ultimos partidos|gano|perdio|empato)/,
  tabla: /(tabla|posiciones|clasificacion|va primero|quien va ganando)/,
  tablaSuelta: /(puntos|puesto|posicion|lider|como va)/, // solo cuenta si la pregunta nombra un equipo o un torneo
  goleador: /(goleador|goleadores|maximo anotador|maximos anotadores|artillero|quien (mas )?goles|mas goles)/,
  campeon: /(campeon|quien gano el torneo|quien fue el campeon)/,
  deEquipo: /(juega|jugamos|jugara|mi equipo|nuestro equipo|le fue|les fue|quedo mi|quedaron mis)/,
}

// ── Formatos ──────────────────────────────────────────────
const fechaCo = iso => new Date(iso).toLocaleString('es-CO', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true })
const diaCo = d => new Date(d).toLocaleDateString('en-CA', { timeZone: ZONA }) // 2026-10-04
const linkTorneo = id => `${DOMINIO}/t/${id}`
const FASES = { octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semifinal', final: 'Final' }
const etapa = m => (m.fase && m.fase !== 'grupo' ? FASES[m.fase] || 'Eliminatoria' : m.matchday ? `Fecha ${m.matchday}` : '')
const nombreEq = (m, lado) => m[lado]?.name || 'Por definir'
const lineaProximo = m => `• ${nombreEq(m, 'home')} vs ${nombreEq(m, 'away')} — ${m.played_at ? fechaCo(m.played_at) : 'fecha por definir'}${m.location ? ` · ${m.location}` : ''}${etapa(m) ? ` · ${etapa(m)}` : ''}`
const lineaResultado = m => `• ${nombreEq(m, 'home')} ${m.home_score ?? 0} - ${m.away_score ?? 0} ${nombreEq(m, 'away')}${m.played_at ? ` (${new Date(m.played_at).toLocaleDateString('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short' })})` : ''}${etapa(m) ? ` · ${etapa(m)}` : ''}`

// ── Reconocer nombres de equipos o torneos dentro de la pregunta ──
function mencionados(texto, items, parar) {
  const t = ` ${norm(texto)} `
  const palabras = new Set(t.trim().split(' '))
  let mejor = 0, res = []
  for (const it of items) {
    const n = norm(it.name)
    if (!n) continue
    let score = 0
    if (t.includes(` ${n} `)) score = 1000 + n.length
    else {
      const sig = n.split(' ').filter(w => w.length >= 2 && !parar.has(w))
      if (sig.length && sig.every(w => palabras.has(w))) score = sig.length * 10 + sig.join('').length
    }
    if (score > mejor) { mejor = score; res = [it] } else if (score && score === mejor) res.push(it)
  }
  return res
}

// ── Datos base (torneos activos y sus equipos), guardados 60 s para no repetir consultas ──
let cacheBase = null
async function cargarBase(admin) {
  if (cacheBase && Date.now() - cacheBase.t < 60000) return cacheBase
  let r = await admin.from('tournaments').select('id, name, archivado, pts_victoria, pts_empate, pts_derrota, w_puntos_ganador').eq('status', 'active')
  if (r.error) r = await admin.from('tournaments').select('id, name, archivado').eq('status', 'active')
  const torneos = (r.data || []).filter(t => !t.archivado)
  let equipos = []
  if (torneos.length) {
    const { data } = await admin.from('tournament_teams').select('tournament_id, teams(id, name)').in('tournament_id', torneos.map(t => t.id)).limit(3000)
    const porId = new Map()
    for (const f of data || []) {
      const e = f.teams
      if (!e?.id) continue
      if (!porId.has(e.id)) porId.set(e.id, { id: e.id, name: e.name, torneos: [] })
      porId.get(e.id).torneos.push(f.tournament_id)
    }
    equipos = [...porId.values()]
  }
  cacheBase = { t: Date.now(), torneos, equipos }
  return cacheBase
}

// ── Tabla de posiciones: mismas reglas de la plataforma (puntos del torneo, W, descuentos, grupos) ──
async function tablaDe(admin, torneo) {
  const [{ data: tt }, { data: ms }, { data: desc }, { data: grupos }] = await Promise.all([
    admin.from('tournament_teams').select('teams(id, name)').eq('tournament_id', torneo.id),
    admin.from('matches').select('status, fase, tipo_resultado, home_team_id, away_team_id, home_score, away_score').eq('tournament_id', torneo.id),
    admin.from('descuentos_puntos').select('team_id, puntos').eq('tournament_id', torneo.id),
    admin.from('tournament_grupos').select('id, nombre, orden').eq('tournament_id', torneo.id).order('orden'),
  ])
  const victoria = torneo.pts_victoria ?? 3, empate = torneo.pts_empate ?? 1, derrota = torneo.pts_derrota ?? 0
  const victoriaW = torneo.w_puntos_ganador ?? victoria
  const filas = {}
  for (const f of tt || []) if (f.teams?.id) filas[f.teams.id] = { id: f.teams.id, name: f.teams.name, pj: 0, gf: 0, gc: 0, pts: 0 }
  for (const p of ms || []) {
    if (p.status !== 'finished' || (p.fase && p.fase !== 'grupo')) continue
    const h = filas[p.home_team_id], a = filas[p.away_team_id]
    const gh = p.home_score || 0, ga = p.away_score || 0
    const ptsV = p.tipo_resultado === 'w' ? victoriaW : victoria
    if (h) { h.pj++; h.gf += gh; h.gc += ga; h.pts += gh > ga ? ptsV : gh === ga ? empate : derrota }
    if (a) { a.pj++; a.gf += ga; a.gc += gh; a.pts += ga > gh ? ptsV : ga === gh ? empate : derrota }
  }
  for (const d of desc || []) if (filas[d.team_id]) filas[d.team_id].pts += Number(d.puntos) || 0
  const ordenar = lista => lista.sort((x, y) => (y.pts - x.pts) || ((y.gf - y.gc) - (x.gf - x.gc)) || (y.gf - x.gf) || (x.gc - y.gc))
  if ((grupos || []).length > 1) {
    const { data: ge } = await admin.from('grupo_equipos').select('grupo_id, team_id').in('grupo_id', grupos.map(g => g.id))
    return grupos.map(g => ({
      nombre: g.nombre,
      filas: ordenar((ge || []).filter(x => x.grupo_id === g.id).map(x => filas[x.team_id]).filter(Boolean)),
    }))
  }
  return [{ nombre: '', filas: ordenar(Object.values(filas)) }]
}

const lineaFila = (f, i) => `${i + 1}. ${f.name} · ${f.pts} pts · PJ ${f.pj} · DG ${f.gf - f.gc > 0 ? '+' : ''}${f.gf - f.gc}`

async function respuestaTabla(admin, torneo) {
  const tablas = await tablaDe(admin, torneo)
  if (!tablas.some(g => g.filas.length)) return { texto: `Todavía no hay equipos en la tabla de ${torneo.name}. Míralo aquí: ${linkTorneo(torneo.id)}` }
  const partes = tablas.map(g => `${g.nombre ? `${g.nombre}\n` : ''}${g.filas.slice(0, tablas.length > 1 ? 4 : 8).map(lineaFila).join('\n')}`)
  return { texto: `📊 Tabla de ${torneo.name}\n\n${partes.join('\n\n')}\n\nTabla completa y en vivo: ${linkTorneo(torneo.id)}` }
}

// ── Partidos ──────────────────────────────────────────────
const COLS_PARTIDO = 'id, tournament_id, status, fase, matchday, played_at, location, home_score, away_score, home_team_id, away_team_id, home:home_team_id(name), away:away_team_id(name)'
const sinJugar = m => m.status !== 'finished'
const porFechaAsc = (a, b) => (a.played_at ? new Date(a.played_at).getTime() : Infinity) - (b.played_at ? new Date(b.played_at).getTime() : Infinity)
const porFechaDesc = (a, b) => (b.played_at ? new Date(b.played_at).getTime() : 0) - (a.played_at ? new Date(a.played_at).getTime() : 0)
const vigente = m => !m.played_at || new Date(m.played_at).getTime() >= Date.now() - 4 * 3600000 // un partido de hace pocas horas aún puede estar en juego

async function respuestaEquipo(admin, equipo, base, t, intent) {
  const { data } = await admin.from('matches').select(COLS_PARTIDO)
    .or(`home_team_id.eq.${equipo.id},away_team_id.eq.${equipo.id}`).in('tournament_id', equipo.torneos).limit(200)
  const todos = data || []
  const proximos = todos.filter(m => sinJugar(m) && vigente(m)).sort(porFechaAsc).slice(0, 3)
  const jugados = todos.filter(m => m.status === 'finished').sort(porFechaDesc).slice(0, 3)
  const quiereProx = intent.proximo, quiereRes = intent.resultado, quierePos = intent.tabla
  const todo = !quiereProx && !quiereRes && !quierePos
  const partes = []
  if (quiereProx || todo) {
    partes.push(proximos.length ? `📅 Próximos partidos de ${equipo.name}\n${proximos.map(lineaProximo).join('\n')}` : `📅 ${equipo.name} no tiene partidos programados por ahora.`)
  }
  if (quiereRes || todo) {
    partes.push(jugados.length ? `⚽ Últimos resultados de ${equipo.name}\n${jugados.map(lineaResultado).join('\n')}` : `⚽ ${equipo.name} todavía no tiene partidos jugados.`)
  }
  if (quierePos || todo) {
    const lineas = []
    for (const tid of equipo.torneos.slice(0, 2)) {
      const torneo = base.torneos.find(x => x.id === tid)
      if (!torneo) continue
      const tablas = await tablaDe(admin, torneo)
      for (const g of tablas) {
        const i = g.filas.findIndex(f => f.id === equipo.id)
        if (i >= 0) lineas.push(`📊 En ${torneo.name}${g.nombre ? ` (${g.nombre})` : ''} va ${i + 1}.º con ${g.filas[i].pts} pts en ${g.filas[i].pj} partidos.`)
      }
    }
    if (lineas.length) partes.push(lineas.join('\n'))
  }
  const torneoId = equipo.torneos[0]
  partes.push(`Más detalles: ${linkTorneo(torneoId)}`)
  return { texto: partes.join('\n\n') }
}

async function respuestaPartidosTorneo(admin, torneo, t, soloResultados) {
  const { data } = await admin.from('matches').select(COLS_PARTIDO).eq('tournament_id', torneo.id).limit(500)
  const todos = data || []
  if (soloResultados) {
    const j = todos.filter(m => m.status === 'finished').sort(porFechaDesc).slice(0, 6)
    return { texto: j.length ? `⚽ Últimos resultados de ${torneo.name}\n${j.map(lineaResultado).join('\n')}\n\nTodos los partidos: ${linkTorneo(torneo.id)}` : `${torneo.name} todavía no tiene partidos jugados.` }
  }
  let prox = todos.filter(m => sinJugar(m) && vigente(m)).sort(porFechaAsc)
  let titulo = `📅 Próximos partidos de ${torneo.name}`
  if (/\bhoy\b/.test(t)) { const hoy = diaCo(Date.now()); prox = prox.filter(m => m.played_at && diaCo(m.played_at) === hoy); titulo = `📅 Partidos de hoy en ${torneo.name}` }
  else if (/\bmanana\b/.test(t)) { const man = diaCo(Date.now() + 86400000); prox = prox.filter(m => m.played_at && diaCo(m.played_at) === man); titulo = `📅 Partidos de mañana en ${torneo.name}` }
  if (!prox.length) return { texto: `No hay partidos programados${/\bhoy\b/.test(t) ? ' para hoy' : /\bmanana\b/.test(t) ? ' para mañana' : ' por ahora'} en ${torneo.name}. Mira la programación completa: ${linkTorneo(torneo.id)}` }
  return { texto: `${titulo}\n${prox.slice(0, 6).map(lineaProximo).join('\n')}${prox.length > 6 ? `\n… y ${prox.length - 6} más` : ''}\n\nProgramación completa: ${linkTorneo(torneo.id)}` }
}

async function respuestaGoleadores(admin, torneo) {
  const { data } = await admin.from('goleadores_por_torneo').select('player_name, team_name, total_goals').eq('tournament_id', torneo.id).gt('total_goals', 0).order('total_goals', { ascending: false }).limit(5)
  if (!data?.length) return { texto: `Todavía no hay goleadores registrados en ${torneo.name}.` }
  return { texto: `🥇 Goleadores de ${torneo.name}\n${data.map((g, i) => `${i + 1}. ${g.player_name}${g.team_name ? ` (${g.team_name})` : ''} — ${g.total_goals} ${g.total_goals === 1 ? 'gol' : 'goles'}`).join('\n')}\n\nLista completa: ${linkTorneo(torneo.id)}` }
}

async function respuestaCampeon(admin, torneo) {
  const { data } = await admin.from('tournament_logros').select('team_id').eq('tournament_id', torneo.id).eq('tipo', 'campeon').limit(1)
  const teamId = data?.[0]?.team_id
  if (!teamId) return { texto: `${torneo.name} todavía no tiene campeón registrado: sigue en juego. Míralo aquí: ${linkTorneo(torneo.id)}` }
  const { data: eq } = await admin.from('teams').select('name').eq('id', teamId).maybeSingle()
  return { texto: eq?.name ? `🏆 El campeón de ${torneo.name} es ${eq.name}.` : `${torneo.name} ya tiene campeón. Míralo aquí: ${linkTorneo(torneo.id)}` }
}

async function respuestaReservas(admin) {
  const { data } = await admin.from('escenarios').select('id, name, city').eq('activo', true).order('name').limit(6)
  const lista = (data || []).map(e => `• ${e.name}${e.city ? ` (${e.city})` : ''}: ${DOMINIO}/reservar/${e.id}`).join('\n')
  return { texto: `🏟️ Reservar una cancha es fácil: entra a ${DOMINIO}/escenarios, elige el escenario y la cancha, escoge el día y la hora, y confirma tu reserva desde el celular.${lista ? `\n\nEscenarios disponibles:\n${lista}` : ''}` }
}

// ── Entrada principal ─────────────────────────────────────
// Devuelve { texto } si sabe responder, o null para que lo conteste una persona.
// exigirMencion: solo responde si la pregunta nombra un equipo o un torneo (lo usa el chat de organizadores, donde casi
// todas las preguntas son de cómo usar la plataforma y deben ir a una persona).
export async function responderAuto(admin, textoOriginal, { torneoCtx, exigirMencion = false } = {}) {
  const t = norm(textoOriginal)
  if (!t || t.length > 300) return null
  if (RX.persona.test(t) || RX.reglamento.test(t)) return null
  if (exigirMencion) { const guia = responderGuia(t); if (guia) return guia } // chat de organizadores: guías de cómo usar la plataforma
  if (RX.lead.test(t)) return null
  if (RX.saludo.test(t)) return { texto: SALUDO }
  if (RX.horario.test(t)) return { texto: HORARIO }
  if (!exigirMencion && RX.reserva.test(t)) return respuestaReservas(admin)

  const base = await cargarBase(admin)
  const equiposM = mencionados(textoOriginal, base.equipos, PARAR_EQUIPO)
  const torneosM = mencionados(textoOriginal, base.torneos, PARAR_TORNEO)
  if (exigirMencion && !equiposM.length && !torneosM.length) return null
  const intent = { proximo: RX.proximo.test(t), resultado: RX.resultado.test(t), tabla: RX.tabla.test(t) || (RX.tablaSuelta.test(t) && (equiposM.length > 0 || torneosM.length > 0)), goleador: RX.goleador.test(t), campeon: RX.campeon.test(t), torneos: RX.torneos.test(t) }
  const preguntaAlgo = Object.values(intent).some(Boolean)
  if (!preguntaAlgo && !equiposM.length && !torneosM.length) return null

  // Pregunta de torneo (tabla, goleadores, campeón) con el torneo nombrado, o de partidos del torneo
  const deTorneo = (intent.tabla && !intent.proximo) || intent.goleador || intent.campeon
  if (equiposM.length && !(deTorneo && torneosM.length)) {
    if (equiposM.length > 1) {
      const opciones = equiposM.slice(0, 5).map(e => `• ${e.name} (${base.torneos.find(x => x.id === e.torneos[0])?.name || 'torneo'})`).join('\n')
      return { texto: `Encontré varios equipos con ese nombre:\n${opciones}\n\n¿De cuál hablas? Escríbeme el nombre completo.` }
    }
    return respuestaEquipo(admin, equiposM[0], base, t, intent)
  }

  if (intent.torneos && !torneosM.length) {
    if (!base.torneos.length) return { texto: 'Ahora mismo no hay torneos activos en Golmebol. Míralos aquí: ' + DOMINIO + '/torneos' }
    return { texto: `🏆 Torneos activos en Golmebol\n${base.torneos.slice(0, 15).map(x => `• ${x.name}`).join('\n')}\n\nVer todos con sus escudos: ${DOMINIO}/torneos` }
  }

  // ¿De qué torneo? Nombrado, el que está mirando, o el único que hay
  let torneo = torneosM.length === 1 ? torneosM[0] : null
  if (!torneo && torneosM.length > 1) return { texto: `Hay varios torneos con ese nombre:\n${torneosM.slice(0, 5).map(x => `• ${x.name}`).join('\n')}\n\n¿De cuál hablas? Escríbeme el nombre completo.` }
  if (!torneo && torneoCtx) torneo = base.torneos.find(x => x.id === torneoCtx) || null
  if (!torneo && base.torneos.length === 1) torneo = base.torneos[0]

  if (!preguntaAlgo) return torneo ? { texto: `🏆 ${torneo.name}: mira la tabla, los partidos y los goleadores aquí: ${linkTorneo(torneo.id)}\n\nSi quieres algo en especial (tabla, goleadores, próximos partidos), pregúntame.` } : null

  // Preguntas de "mi equipo" sin encontrar el equipo: no se adivina
  if (RX.deEquipo.test(t) && !torneosM.length) return { texto: 'No encontré ese equipo entre los torneos activos. Escríbeme el nombre del equipo tal como aparece en Golmebol, o toca «Hablar con una persona».' }

  if (!torneo) {
    if (!base.torneos.length) return null
    if (intent.tabla || intent.goleador || intent.campeon || intent.proximo || intent.resultado) {
      return { texto: `¿De cuál torneo? Tenemos:\n${base.torneos.slice(0, 12).map(x => `• ${x.name}`).join('\n')}\n\nEscríbeme el nombre del torneo y te cuento.` }
    }
    return null
  }
  if (intent.campeon) return respuestaCampeon(admin, torneo)
  if (intent.goleador) return respuestaGoleadores(admin, torneo)
  if (intent.tabla && !intent.proximo) return respuestaTabla(admin, torneo)
  if (intent.proximo) return respuestaPartidosTorneo(admin, torneo, t, false)
  if (intent.resultado) return respuestaPartidosTorneo(admin, torneo, t, true)
  return null
}
