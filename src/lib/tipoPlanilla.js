// Decide qué planilla se abre para un partido.
//
// Hay DOS planillas:
//  · FÚTBOL DE SALÓN = la planilla profesional (PlanillaPartido, la completa).
//  · FÚTBOL 11 = la hoja de papel (PlanillaPapel, la sencilla).
//
// Qué se abre:
//  1. Si el coordinador eligió una para ese partido (matches.planilla_tipo =
//     'salon' | 'futbol11'), esa.
//  2. Si no eligió, y quien abre es admin/organizador (cualquier contexto que
//     no sea 'arbitro'), manda la planilla que se escogió al CREAR el torneo
//     (tournaments.planilla_tipo).
//  3. Si tampoco hay (torneos viejos, sin elegir) → automático:
//       contexto 'arbitro' (cuenta de árbitro o de coordinador) → Fútbol de salón
//       cualquier otro (admin, organizador) → Fútbol 11
//     La planilla del torneo NO cambia lo que ve un árbitro/coordinador.
//     (el link de planillador no pasa por aquí: sigue igual que siempre).
//
// Dos protecciones para no dañar trabajo que ya existe (mandan sobre lo anterior):
//  · Un partido YA JUGADO se reedita con la planilla con la que se llenó: si se
//    llenó con la de Fútbol 11 (tiene datos de papel) o con la rápida ("sin
//    planillador"), abre Fútbol 11; si no, abre la de salón para no perder nada.
//  · Un partido a medias (borrador en la base o en este celular) sigue en la
//    planilla donde está hasta cerrarlo.
export function usaPlanillaCompleta(p, contexto = 'admin', tipoTorneo = null) {
  if (!p) return false
  if (p.status === 'finished') return !(p.planilla_papel || p.sin_planillador)
  if (p.live_state && !p.live_state_rapida && !p.planilla_papel) return true
  try {
    if (p.id && localStorage.getItem(`planilla_${p.id}`) && !localStorage.getItem(`planilla_rapida_${p.id}`)) return true
    if (p.id && localStorage.getItem(`planilla_rapida_${p.id}`)) return false
  } catch { /* sin acceso al almacenamiento: se ignora */ }
  if (p.live_state_rapida || p.planilla_papel) return false
  if (p.planilla_tipo === 'salon') return true
  if (p.planilla_tipo === 'futbol11') return false
  if (contexto !== 'arbitro') {
    if (tipoTorneo === 'salon') return true
    if (tipoTorneo === 'futbol11') return false
  }
  return contexto === 'arbitro'
}
