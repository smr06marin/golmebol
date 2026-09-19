// Helpers de eliminatorias (bracket) compartidos entre la vista de admin
// (AdminTorneoDetallePage), la vista pública (TorneoPublicoPage) y la vista
// del jugador (PlayerTorneoPage). Antes estaban copiados y pegados en los
// tres archivos con nombres ligeramente distintos.

// Nombre/fase de cada ronda de eliminatorias según cuántos equipos quedan
// (16 → octavos, 8 → cuartos, etc.) — se usa tanto para el bracket real como
// para la vista previa en vivo antes de que existan partidos de eliminación.
export function getRondaNombre(total) {
  if (total === 16) return 'Octavos de final'
  if (total === 8)  return 'Cuartos de final'
  if (total === 4 || total === 3) return 'Semifinal'
  if (total === 2)  return 'Final'
  return `Ronda de ${total}`
}

export function getFaseValue(total) {
  if (total > 8) return 'octavos'
  if (total > 4) return 'cuartos'
  if (total > 2) return 'semifinal'
  return 'final'
}
