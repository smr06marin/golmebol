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
//  · FÚTBOL 11 = la hoja de papel (PlanillaPapel, la normal, la sencilla).
//
// REGLA: la planilla profesional SOLO se abre cuando el árbitro entra con su PROPIO usuario (contexto 'arbitro':
// cuenta de árbitro, asignado por el árbitro líder, o de coordinador). Todos los demás (admin, organizador, planillador
// por link) usan la planilla normal. Ya no se escoge planilla al crear el torneo: el torneo no cambia nada acá.
//
// Qué se abre:
//  1. Si el árbitro líder eligió una planilla para ese partido (matches.planilla_tipo = 'futbol11'), la normal.
//  2. Si no, contexto 'arbitro' → profesional; cualquier otro contexto → normal.
//
// Protecciones para no dañar trabajo que ya existe (mandan sobre lo anterior):
//  · Un partido YA JUGADO se reedita con la planilla con la que se llenó: si se llenó con la normal (tiene datos de
//    papel) o con la rápida ("sin planillador"), abre la normal; si no, abre la profesional para no perder nada.
//  · Un partido a medias (borrador en la base o en este celular) sigue en la planilla donde está hasta cerrarlo.
//  · Un borrador de papel VACÍO (solo abierto, sin goles/tarjetas/números/cronómetro) no ata el partido a la normal.
export function usaPlanillaCompleta(p, contexto = 'admin') {
  if (!p) return false
  if (p.status === 'finished') return !(p.planilla_papel || p.sin_planillador)
  const esArbitro = contexto === 'arbitro'
  const sinTrabajoDePapel = !p.planilla_papel && borradorRapidaVacio(p.live_state_rapida) && borradorLocalRapidaVacio(p.id)
  if (sinTrabajoDePapel) {
    if (p.live_state || haySalonLocal(p.id)) return true // ya hay trabajo en la profesional
    if (p.planilla_tipo === 'futbol11') return false
    return esArbitro
  }
  if (p.live_state && !p.live_state_rapida && !p.planilla_papel) return true
  try {
    if (p.id && localStorage.getItem(`planilla_${p.id}`) && !localStorage.getItem(`planilla_rapida_${p.id}`)) return true
    if (p.id && localStorage.getItem(`planilla_rapida_${p.id}`)) return false
  } catch { /* sin acceso al almacenamiento: se ignora */ }
  if (p.live_state_rapida || p.planilla_papel) return false
  if (p.planilla_tipo === 'futbol11') return false
  return esArbitro
}
