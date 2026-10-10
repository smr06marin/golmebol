import { supabase } from './supabase'
import { consultaPartidosTorneo, resolverPartidosTorneo } from './partidosPublicos'
import { guardarCacheRapido } from './cacheRapido'

// Datos de la página pública de un torneo, en un solo lugar para poder
// ADELANTARLOS: cuando alguien pasa el dedo/mouse por la tarjeta de un torneo
// (o la portada tiene un rato libre) se empiezan a pedir ya, y cuando por fin
// toca "Ver torneo" la tabla está lista o casi. Si la página pide lo mismo
// mientras el pedido sigue en camino, reutiliza ESE pedido (no se duplica).
//
// Se resuelve en dos tiempos:
//  · base: lo necesario para pintar la tabla (torneo, equipos, partidos, grupos);
//  · extras: goleadores y patrocinadores, que llegan aparte para que la
//    consulta más pesada (los goleadores) no frene la entrada.
const enVuelo = new Map()

// PRIVACIDAD: la página pública NO lee las tablas teams / tournaments directo (guardan cédula y teléfono del
// representante y el token+contraseña del link de deudores). Lee las vistas públicas, que no traen esas columnas
// (ver migracion_datos_representante_paso1.sql). Si la vista aún no existe en la base (migración sin correr)
// se usa la consulta de antes, para que la página no se caiga mientras tanto.
const faltaVista = e => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|could not find the table/i.test(e.message || ''))

export function cargarTorneoPublico(id) {
  if (enVuelo.has(id)) return enVuelo.get(id)
  const p = (async () => {
    // Todas las consultas salen a la vez desde el primer instante.
    const qT  = supabase.from('tournaments_publico').select('*').eq('id', id).single()
    const qTe = supabase.from('tournament_teams_publico').select('*').eq('tournament_id', id)
    const qP  = consultaPartidosTorneo(id)
    const qGr = supabase.from('tournament_grupos').select('*').eq('tournament_id', id).order('orden')
    const qG  = supabase.from('goleadores_por_torneo').select('*').eq('tournament_id', id).gt('total_goals', 0).order('total_goals', { ascending: false })
    const qSp = supabase.from('tournament_sponsors').select('*').eq('tournament_id', id).order('orden', { ascending: true })

    let [rT, rTe, rP, rGr] = await Promise.all([qT, qTe, qP, qGr])
    if (faltaVista(rT.error))  rT  = await supabase.from('tournaments').select('*').eq('id', id).single()
    if (faltaVista(rTe.error)) rTe = await supabase.from('tournament_teams').select('*, teams(*)').eq('tournament_id', id)
    const partidos = await resolverPartidosTorneo(rP, id)
    const grupos = rGr.data || []
    let grupoEquipos = []
    if (grupos.length) {
      const { data: ge } = await supabase.from('grupo_equipos').select('*, teams(id,name,logo_url)').in('grupo_id', grupos.map(g => g.id))
      grupoEquipos = ge || []
    }
    const base = {
      t: rT.data,
      equipos: (rTe.data || []).map(d => ({ ...d.teams })),
      partidos, grupos, grupoEquipos,
    }
    const extras = Promise.all([qG, qSp]).then(([rG, rSp]) => ({ goleadores: rG.data || [], sponsors: rSp.data || [] }))
    // Copia para la próxima visita (se completa cuando llegan los extras).
    if (base.t) extras.then(ex => guardarCacheRapido(`torneo_${id}`, { ...base, ...ex })).catch(() => {})
    return { base, extras, errorTorneo: rT.error || null }
  })()
  enVuelo.set(id, p)
  // Un pedido terminado se reutiliza unos segundos (por si se toca dos veces);
  // pasado eso se vuelve a pedir fresco.
  p.then(() => setTimeout(() => enVuelo.delete(id), 8000), () => enVuelo.delete(id))
  return p
}

function conexionLenta() {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null
  return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')))
}

// Adelanta los datos de un torneo (sin esperar ni molestar si falla).
export function prefetchTorneoPublico(id) {
  if (!id || conexionLenta()) return
  cargarTorneoPublico(id).catch(() => {})
}

// Adelanta el código de la página del torneo (se baja una sola vez).
export function precargarPaginaTorneo() {
  if (conexionLenta()) return
  import('../pages/TorneoPublicoPage').catch(() => {})
}

// Handlers para ponerle a una tarjeta/enlace de torneo: con el mouse, al pasar
// por encima; con el dedo, medio instante después de tocar (si el dedo
// arrastra para hacer scroll, el navegador cancela y no se pide nada).
export function propsPrefetchTorneo(id) {
  let timer = null
  return {
    onPointerEnter: e => { if (e.pointerType === 'mouse') prefetchTorneoPublico(id) },
    onPointerDown: e => {
      if (e.pointerType === 'mouse') return
      clearTimeout(timer); timer = setTimeout(() => prefetchTorneoPublico(id), 90)
    },
    onPointerCancel: () => clearTimeout(timer),
  }
}
