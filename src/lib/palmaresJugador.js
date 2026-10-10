// ── Palmarés de un jugador: títulos, subtítulos, semifinales, cuartos, premios ──
// Función pura (no pide nada a la base de datos): recibe lo que ya trae el perfil
// público y lo ordena para mostrarlo en la tarjeta y en la pestaña "Logros".
//
// De dónde sale: la tabla `tournament_logros` guarda una fila por jugador y por
// torneo con la fase a la que llegó SU equipo (campeon, subcampeon, tercer_puesto,
// semifinal, cuartos, octavos, fase_grupos…) y, aparte, premios individuales
// (mvp por partido, goleador, mejor_jugador…).

export const FASES = {
  campeon:       { etiqueta: 'CAMPEÓN',        rango: 1, metal: 'oro' },
  campeonato:    { etiqueta: 'CAMPEÓN',        rango: 1, metal: 'oro' },
  subcampeon:    { etiqueta: 'SUBCAMPEÓN',     rango: 2, metal: 'plata' },
  final:         { etiqueta: 'FINALISTA',      rango: 2, metal: 'plata' },
  tercer_puesto: { etiqueta: '3ER PUESTO',     rango: 3, metal: 'bronce' },
  semifinal:     { etiqueta: 'SEMIFINAL',      rango: 4, metal: null },
  cuartos:       { etiqueta: 'CUARTOS',        rango: 5, metal: null },
  octavos:       { etiqueta: 'OCTAVOS',        rango: 6, metal: null },
  fase_grupos:   { etiqueta: 'FASE DE GRUPOS', rango: 7, metal: null },
}

const PREMIOS = {
  goleador:      'GOLEADOR DEL TORNEO',
  mejor_jugador: 'MEJOR JUGADOR',
  mejor_arquero: 'MEJOR ARQUERO',
  mejor_portero: 'MEJOR ARQUERO',
  valla_menos_vencida: 'VALLA MENOS VENCIDA',
  fair_play:     'JUEGO LIMPIO',
}

const RANGO_PARTICIPO = 8

// logros: filas de tournament_logros del jugador (con tournaments(name, season) y, si hay, team_id)
// partidos: filas de player_match_stats del jugador (con teams y tournament_id) — para saber con qué equipo
// porTorneo: resumen por torneo del perfil (para listar los torneos donde jugó y no tienen fase guardada)
export function armarPalmares(logros = [], partidos = [], porTorneo = []) {
  const equipoPorId = {}
  const equipoPorTorneo = {}
  ;(partidos || []).forEach(s => {
    if (!s?.teams?.id) return
    equipoPorId[s.teams.id] = s.teams
    if (s.tournament_id && !equipoPorTorneo[s.tournament_id]) equipoPorTorneo[s.tournament_id] = s.teams   // ya vienen del más reciente al más viejo
  })
  const nombreTorneo = {}
  ;(porTorneo || []).forEach(t => { if (t?.torneo?.id) nombreTorneo[t.torneo.id] = t.torneo })

  // ── Fase alcanzada en cada torneo (se queda la mejor por torneo y equipo) ──
  const mejorPorClave = {}
  ;(logros || []).forEach(l => {
    const f = FASES[l?.tipo]
    if (!f) return
    const tid = l.tournament_id || null
    const equipo = (l.team_id && equipoPorId[l.team_id]) || (tid && equipoPorTorneo[tid]) || null
    const clave = `${tid || l.id}|${l.team_id || ''}`
    const previo = mejorPorClave[clave]
    if (previo && previo.rango <= f.rango) return
    mejorPorClave[clave] = {
      tipo: l.tipo, etiqueta: f.etiqueta, rango: f.rango, metal: f.metal,
      torneoId: tid, torneo: l.tournaments?.name || nombreTorneo[tid]?.name || 'Torneo',
      season: l.tournaments?.season || nombreTorneo[tid]?.season || '', equipo,
    }
  })
  const filas = Object.values(mejorPorClave)

  // Torneos donde jugó pero no tienen fase guardada (torneo en juego o sin cerrar)
  const conFase = new Set(filas.map(f => f.torneoId).filter(Boolean))
  ;(porTorneo || []).forEach(t => {
    const id = t?.torneo?.id
    if (!id || conFase.has(id)) return
    filas.push({
      tipo: 'participo', etiqueta: 'PARTICIPÓ', rango: RANGO_PARTICIPO, metal: null,
      torneoId: id, torneo: t.torneo.name || 'Torneo', season: t.torneo.season || '', equipo: t.equipo || null,
      pj: t.pj, goles: t.goles,
    })
  })

  filas.sort((a, b) => a.rango - b.rango
    || String(b.season || '').localeCompare(String(a.season || ''))
    || String(a.torneo).localeCompare(String(b.torneo)))

  // ── Conteos ──
  const cuenta = rango => filas.filter(f => f.rango === rango && f.tipo !== 'final').length
  const conteo = {
    titulos: cuenta(1),
    subtitulos: filas.filter(f => f.tipo === 'subcampeon' || f.tipo === 'final').length,
    terceros: cuenta(3), semis: cuenta(4), cuartos: cuenta(5), octavos: cuenta(6),
  }

  // ── Premios individuales (todo lo que no es una fase y no es MVP de partido) ──
  const premiosMap = {}
  ;(logros || []).forEach(l => {
    if (!l?.tipo || FASES[l.tipo] || l.tipo === 'mvp') return
    const p = (premiosMap[l.tipo] = premiosMap[l.tipo] || { tipo: l.tipo, etiqueta: PREMIOS[l.tipo] || String(l.tipo).replace(/_/g, ' ').toUpperCase(), n: 0, torneos: [] })
    p.n++
    const nombre = l.tournaments?.name || nombreTorneo[l.tournament_id]?.name
    if (nombre) p.torneos.push(nombre)
  })
  const premios = Object.values(premiosMap)

  return { filas, conteo, premios }
}

// "2 títulos · 1 subcampeonato · 3 semifinales" (solo lo que tiene)
export function resumenPalmares(conteo) {
  const partes = []
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
  if (conteo.titulos) partes.push(plural(conteo.titulos, 'TÍTULO', 'TÍTULOS'))
  if (conteo.subtitulos) partes.push(plural(conteo.subtitulos, 'SUBCAMPEONATO', 'SUBCAMPEONATOS'))
  if (conteo.terceros) partes.push(plural(conteo.terceros, 'TERCER PUESTO', 'TERCEROS PUESTOS'))
  if (conteo.semis) partes.push(plural(conteo.semis, 'SEMIFINAL', 'SEMIFINALES'))
  if (conteo.cuartos) partes.push(plural(conteo.cuartos, 'CUARTOS', 'CUARTOS'))
  return partes
}
