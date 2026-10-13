// Decide qué planilla se abre para un partido.
//
//  · Por defecto (en todos los torneos, para árbitros, organizadores, admin y
//    links) se abre la PLANILLA DE PAPEL (la hoja sencilla).
//  · La planilla COMPLETA (profesional) solo se abre cuando el coordinador la
//    activó en ese partido (matches.planilla_completa = true).
//
// Dos protecciones para no dañar trabajo que ya existe:
//  · Un partido YA JUGADO se reedita con la planilla con la que se llenó: si se
//    llenó con la completa (no tiene datos de papel ni "sin planillador"), sigue
//    abriendo la completa para no perder nada de lo que ella guarda.
//  · Un partido a medias con la completa (borrador de la completa en la base o en
//    este celular) sigue en la completa hasta cerrarlo.
export function usaPlanillaCompleta(p) {
  if (!p) return false
  if (p.planilla_completa === true) return true
  if (p.status === 'finished') return !(p.planilla_papel || p.sin_planillador)
  if (p.live_state && !p.live_state_rapida && !p.planilla_papel) return true
  try {
    if (p.id && localStorage.getItem(`planilla_${p.id}`) && !localStorage.getItem(`planilla_rapida_${p.id}`)) return true
  } catch { /* sin acceso al almacenamiento: se ignora */ }
  return false
}
