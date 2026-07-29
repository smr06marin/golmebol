// Sistema de puntos configurable por torneo (victoria / empate / derrota).
// Antes estaba fijo en 3-1-0 en cada página que arma la tabla de
// posiciones; ahora cada torneo puede definir el suyo (migracion_sistema_puntos.sql).
// Si el torneo todavía no tiene el campo (torneos viejos, o falta correr la
// migración), se usa el default de siempre: 3 por victoria, 1 por empate, 0 por derrota.
export function getPuntosTorneo(torneo) {
  return {
    victoria: torneo?.pts_victoria ?? 3,
    empate:   torneo?.pts_empate   ?? 1,
    derrota:  torneo?.pts_derrota  ?? 0,
  }
}
