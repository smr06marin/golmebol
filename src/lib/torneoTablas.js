// Cálculo de tablas de un torneo, compartido entre la vista de admin
// (AdminTorneoDetallePage), la vista pública (TorneoPublicoPage) y la vista
// del jugador (PlayerTorneoPage). Antes estaba copiado y pegado en los tres
// archivos (misma lógica, variables con nombres distintos).
import { getPuntosTorneo } from './puntosTorneo'
import { derivarEnVivo, extraerGolesConJugador } from './liveMatch'

// Mientras un partido se está jugando (el árbitro ya lo abrió y está
// llenando la planilla, pero todavía no le da "Guardar resultado"), lo
// trata como si ya hubiera terminado, usando el marcador que se ve en vivo
// en la portada — así la tabla de posiciones y la valla menos vencida se
// actualizan solas apenas se mete un gol, sin esperar el guardado final. Al
// derivarse de nuevo del snapshot completo cada vez, si el árbitro mete un
// gol de más y lo borra, acá simplemente deja de contar en el próximo
// recálculo — no hace falta ningún manejo especial para las correcciones.
export function conMarcadorEnVivo(partidos) {
  return (partidos || []).map(p => {
    if (p.status === 'finished') return p
    const vivo = derivarEnVivo(p)
    if (!vivo) return p
    return { ...p, status: 'finished', home_score: vivo.golesLocal, away_score: vivo.golesVis, _enVivo: true }
  })
}

// Para que quien mire la tabla sepa que un equipo tiene el partido EN JUEGO
// (y que sus números son provisionales hasta que se guarde el resultado):
// devuelve { gf, gc, rival } de ese equipo en el partido en vivo, o undefined
// si el partido no está en vivo. Las tablas lo pegan en la fila como `enVivo`
// y TablaPosiciones lo dibuja (punto rojo + marcador + aviso arriba).
export function enVivoDe(p, esLocal, nombreRival) {
  if (!p?._enVivo) return undefined
  return esLocal
    ? { gf: p.home_score || 0, gc: p.away_score || 0, rival: nombreRival || p.away?.name || '' }
    : { gf: p.away_score || 0, gc: p.home_score || 0, rival: nombreRival || p.home?.name || '' }
}

// Tabla general de posiciones: solo cuenta partidos finalizados (o en vivo,
// ver conMarcadorEnVivo) de fase de grupos (o sin fase asignada todavía).
export function computeTablaGeneral(equipos, partidos, torneo) {
  const P = getPuntosTorneo(torneo)
  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  conMarcadorEnVivo(partidos).filter(p => p.status === 'finished' && (!p.fase || p.fase === 'grupo')).forEach(p => {
    if (tabla[p.home_team_id]) {
      if (p._enVivo) tabla[p.home_team_id].enVivo = enVivoDe(p, true, tabla[p.away_team_id]?.equipo?.name)
      tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score || 0; tabla[p.home_team_id].gc += p.away_score || 0
      if (p.home_score > p.away_score)       { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += P.victoria }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += P.empate }
      else { tabla[p.home_team_id].pp++; tabla[p.home_team_id].pts += P.derrota }
    }
    if (tabla[p.away_team_id]) {
      if (p._enVivo) tabla[p.away_team_id].enVivo = enVivoDe(p, false, tabla[p.home_team_id]?.equipo?.name)
      tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score || 0; tabla[p.away_team_id].gc += p.home_score || 0
      if (p.away_score > p.home_score)       { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += P.victoria }
      else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += P.empate }
      else { tabla[p.away_team_id].pp++; tabla[p.away_team_id].pts += P.derrota }
    }
  })
  return Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
}

// Valla menos vencida GLOBAL por equipo: a diferencia de la tabla general
// (que en fase de grupos ya no cuenta partidos de eliminación directa), los
// goles en contra acá deben seguir sumando aunque el torneo ya esté en
// eliminatorias.
export function computeVallaEquipos(equipos, partidos, arqueros) {
  const gc = {}, pj = {}
  conMarcadorEnVivo(partidos).filter(p => p.status === 'finished').forEach(p => {
    gc[p.home_team_id] = (gc[p.home_team_id] || 0) + (p.away_score || 0); pj[p.home_team_id] = (pj[p.home_team_id] || 0) + 1
    gc[p.away_team_id] = (gc[p.away_team_id] || 0) + (p.home_score || 0); pj[p.away_team_id] = (pj[p.away_team_id] || 0) + 1
  })
  return equipos.filter(e => pj[e.id] > 0)
    .map(e => ({
      equipo: e, gc: gc[e.id] || 0, pj: pj[e.id] || 0,
      arqueros: arqueros.filter(a => a.team_id === e.id),
    }))
    .sort((a, b) => a.gc - b.gc || b.pj - a.pj)
}

// La tabla de goleadores del torneo (goleadores_por_torneo) sale de una
// vista que se arma a partir de match_events — y esos eventos solo quedan
// guardados cuando el árbitro termina el partido y le da "Guardar
// resultado". Mientras el partido se está jugando, esos goles todavía no
// están ahí. Esta función los suma por encima, en el navegador, usando el
// mismo snapshot en vivo que ya alimenta el marcador de la portada: si el
// jugador ya tiene goles de partidos anteriores (ya está en la lista que
// vino de la base de datos) se le suman los de este partido en vivo; si es
// su primer gol del torneo, se agrega como fila nueva. Igual que con la
// tabla de posiciones, como se vuelve a derivar del snapshot completo cada
// vez, un gol que el árbitro mete y borra por error simplemente deja de
// contar en el próximo recálculo.
export function mergeGoleadoresConVivo(goleadoresDB, partidos, equipos) {
  const golesVivo = new Map() // player_id -> { goles, teamId, nombre }
  ;(partidos || []).forEach(p => {
    if (p.status === 'finished') return
    extraerGolesConJugador(p).forEach(g => {
      if (!g.jugadorId) return
      const actual = golesVivo.get(g.jugadorId) || { goles: 0, teamId: g.teamId, nombre: g.jugadorNombre }
      actual.goles++
      golesVivo.set(g.jugadorId, actual)
    })
  })
  if (golesVivo.size === 0) return goleadoresDB || []

  const resultado = (goleadoresDB || []).map(g => ({ ...g }))
  golesVivo.forEach((info, playerId) => {
    const fila = resultado.find(g => g.player_id === playerId)
    if (fila) {
      fila.total_goals = (fila.total_goals || 0) + info.goles
      fila.golesVivo = info.goles // cuántos de esos goles son del partido que se está jugando (provisionales)
    } else {
      const equipo = (equipos || []).find(e => e.id === info.teamId)
      resultado.push({
        player_id: playerId, team_id: info.teamId,
        player_name: info.nombre, photo_url: null,
        team_name: equipo?.name || '', team_logo: equipo?.logo_url || null,
        total_goals: info.goles, partidos_jugados: 0, total_yellow: 0, total_blue: 0, total_red: 0,
        golesVivo: info.goles,
      })
    }
  })
  return resultado.sort((a, b) => b.total_goals - a.total_goals)
}
