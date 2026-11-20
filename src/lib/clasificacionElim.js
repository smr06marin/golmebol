// Cuántos equipos clasificaron a las eliminaciones directas.
// Lo responde el organizador ANTES de programar el primer partido de
// eliminación directa, y se guarda en tournaments.clasificacion_elim:
//   { modo: 'grupo', n: 2, extra: 2 }  → pasan 2 de cada grupo + los 2 mejores de los que quedaron afuera
//   { modo: 'tabla', n: 8 }            → pasan los 8 primeros de la tabla
// Con eso la tabla pública marca en rojo a los que no clasificaron; después,
// cada equipo que pierde su llave también queda eliminado.

export function leerClasificacionElim(torneo) {
  const c = torneo?.clasificacion_elim
  if (!c || typeof c !== 'object') return null
  const n = Math.floor(Number(c.n))
  if (!Number.isFinite(n) || n < 1) return null
  const extra = Math.max(0, Math.floor(Number(c.extra) || 0))
  return { modo: c.modo === 'grupo' ? 'grupo' : 'tabla', n, extra }
}

// Ids de los equipos que clasificaron según esa respuesta.
// tablaDeGrupo(grupoId) y tablaGeneral: filas { equipo: { id } } ya ordenadas (1° primero).
export function idsClasificados(cfg, { grupos = [], tablaDeGrupo, tablaGeneral = [] } = {}) {
  const ids = new Set()
  if (!cfg) return ids
  const agregar = r => { const id = r?.equipo?.id; if (id) ids.add(id) }
  if (cfg.modo === 'grupo' && grupos.length > 0 && typeof tablaDeGrupo === 'function') {
    grupos.forEach(g => (tablaDeGrupo(g.id) || []).slice(0, cfg.n).forEach(agregar))
    let faltan = cfg.extra
    for (const r of tablaGeneral) {
      if (faltan <= 0) break
      const id = r?.equipo?.id
      if (id && !ids.has(id)) { ids.add(id); faltan-- }
    }
  } else {
    tablaGeneral.slice(0, cfg.n).forEach(agregar)
  }
  return ids
}

// Texto corto para mostrar lo que se respondió.
export function textoClasificacion(cfg) {
  if (!cfg) return ''
  if (cfg.modo === 'grupo') {
    return `${cfg.n} de cada grupo${cfg.extra > 0 ? ` + ${cfg.extra} mejor${cfg.extra === 1 ? '' : 'es'} de los que quedaron afuera` : ''}`
  }
  return `los ${cfg.n} primeros de la tabla`
}
