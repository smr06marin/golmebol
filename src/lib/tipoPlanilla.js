import { normalizarPapel, papelVacio } from './planillaPapel'

const hayTexto = v => String(v ?? '').trim() !== ''
const listaConDatos = arr => (arr || []).some(j => j && (hayTexto(j.numero) || (!j.id && hayTexto(j.nombre))))

// ¿El borrador de la planilla rápida / de papel está sin tocar? (null = no hay borrador)
export function borradorRapidaVacio(s) {
  if (!s || typeof s !== 'object') return true
  if ((s.eventos || []).length || (s.eventosEliminados || []).length) return false
  if (s.corriendo || s.tiempoAgotado || (s.segundos || 0) > 0 || (s.periodo || 1) > 1) return false
  if (s.arqueroLocal || s.arqueroVis || (s.histArquerosLocal || []).length || (s.histArquerosVis || []).length) return false
  if (listaConDatos(s.jugadoresLocal) || listaConDatos(s.jugadoresVisitante)) return false
  if (s.papel && JSON.stringify(normalizarPapel(s.papel)) !== JSON.stringify(papelVacio())) return false
  return true
}

// Borrador de papel guardado en ESTE celular: sin borrador o vacío = true; ilegible = false (por precaución)
function borradorLocalRapidaVacio(id) {
  try {
    const raw = id ? localStorage.getItem(`planilla_rapida_${id}`) : null
    if (!raw) return true
    return borradorRapidaVacio(JSON.parse(raw))
  } catch { return false }
}

function haySalonLocal(id) {
  try { return !!(id && localStorage.getItem(`planilla_${id}`)) } catch { return false }
}

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
// OJO con los borradores vacíos: la planilla de Fútbol 11 guarda un borrador
// apenas se abre el partido, aunque no se haya anotado nada. Si ese borrador
// está VACÍO (sin goles, tarjetas, números, hoja de papel ni cronómetro) NO
// cuenta como trabajo: manda la planilla escogida para el torneo. Así, un
// partido que alguien abrió "de curioso" antes de escoger la planilla no queda
// pegado a Fútbol 11 para siempre.
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
  // Admin/organizador con planilla escogida para el torneo: un borrador de papel
  // vacío (solo abierto, sin datos) no ata el partido a Fútbol 11.
  if (contexto !== 'arbitro' && (tipoTorneo === 'salon' || tipoTorneo === 'futbol11')
      && !p.planilla_papel && borradorRapidaVacio(p.live_state_rapida) && borradorLocalRapidaVacio(p.id)) {
    if (p.live_state || haySalonLocal(p.id)) return true // ya hay trabajo en la de salón
    if (p.planilla_tipo === 'salon') return true
    if (p.planilla_tipo === 'futbol11') return false
    return tipoTorneo === 'salon'
  }
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
