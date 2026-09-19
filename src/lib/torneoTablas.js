// Cálculo de tablas de un torneo, compartido entre la vista de admin
// (AdminTorneoDetallePage), la vista pública (TorneoPublicoPage) y la vista
// del jugador (PlayerTorneoPage). Antes estaba copiado y pegado en los tres
// archivos (misma lógica, variables con nombres distintos).
import { getPuntosTorneo } from './puntosTorneo'

// Tabla general de posiciones: solo cuenta partidos finalizados de fase de
// grupos (o sin fase asignada todavía).
export function computeTablaGeneral(equipos, partidos, torneo) {
  const P = getPuntosTorneo(torneo)
  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidos.filter(p => p.status === 'finished' && (!p.fase || p.fase === 'grupo')).forEach(p => {
    if (tabla[p.home_team_id]) {
      tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score || 0; tabla[p.home_team_id].gc += p.away_score || 0
      if (p.home_score > p.away_score)       { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += P.victoria }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += P.empate }
      else { tabla[p.home_team_id].pp++; tabla[p.home_team_id].pts += P.derrota }
    }
    if (tabla[p.away_team_id]) {
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
  partidos.filter(p => p.status === 'finished').forEach(p => {
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
