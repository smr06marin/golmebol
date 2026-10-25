import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Banner de patrocinadores de GOLMEBOL para los flyers.
//
// Solo lo llevan los flyers de torneos que ORGANIZA GOLMEBOL (torneos sin
// organizador externo: organizador_id vacío). Los torneos de un organizador
// independiente salen sin banner. Los patrocinadores son los mismos que se
// gestionan en /admin/patrocinadores y salen en la página de inicio.

const MAX_LOGOS = 6
let promesaPatrocinadores = null
const cacheOrganizador = new Map() // id de torneo -> organizador_id | null

function cargarPatrocinadores() {
  if (!promesaPatrocinadores) {
    promesaPatrocinadores = supabase.from('patrocinadores_golmebol').select('id, nombre, logo_url').eq('activo', true).order('orden').order('created_at')
      .then(({ data, error }) => {
        if (error) { promesaPatrocinadores = null; return [] } // si falla, se vuelve a intentar la próxima vez
        return (data || []).filter(p => p.logo_url).slice(0, MAX_LOGOS)
      })
      .catch(() => { promesaPatrocinadores = null; return [] })
  }
  return promesaPatrocinadores
}

// ¿Es un torneo organizado por Golmebol? `organizador_id` puede venir ya en el objeto del torneo; si no
// viene (undefined), se consulta por el id del torneo.
async function organizadorDe(torneoId, organizadorId) {
  if (organizadorId !== undefined) return organizadorId || null
  if (!torneoId) return 'desconocido'
  if (cacheOrganizador.has(torneoId)) return cacheOrganizador.get(torneoId)
  try {
    const { data, error } = await supabase.from('tournaments').select('organizador_id').eq('id', torneoId).maybeSingle()
    if (error || !data) return 'desconocido'
    cacheOrganizador.set(torneoId, data.organizador_id || null)
    return data.organizador_id || null
  } catch { return 'desconocido' }
}

// Devuelve { lista, listo }: `lista` son los patrocinadores a dibujar (vacía si el torneo no es de
// Golmebol) y `listo` indica que ya se sabe la respuesta (para no descargar el flyer antes de tiempo).
// Acepta un torneo { id, organizador_id? } o una lista de torneos (flyers que juntan partidos de varios
// torneos): el banner sale solo si TODOS son de Golmebol.
export function usePatrocinadoresFlyer(torneoOLista) {
  const torneos = (Array.isArray(torneoOLista) ? torneoOLista : [torneoOLista]).filter(t => t && t.id)
  const clave = torneos.map(t => `${t.id}|${t.organizador_id === undefined ? '?' : t.organizador_id || ''}`).sort().join(',')
  const [res, setRes] = useState({ clave: null, lista: [] })
  useEffect(() => {
    let vivo = true
    ;(async () => {
      let lista = []
      try {
        if (torneos.length > 0) {
          const orgs = await Promise.all(torneos.map(t => organizadorDe(t.id, t.organizador_id)))
          if (orgs.every(o => o === null)) lista = await cargarPatrocinadores()
        }
      } catch { lista = [] }
      if (vivo) setRes({ clave, lista })
    })()
    return () => { vivo = false }
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps
  return res.clave === clave ? { lista: res.lista, listo: true } : { lista: [], listo: false }
}
