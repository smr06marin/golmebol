// Logo de torneos por id. Sirve para las transmisiones que siguen un torneo
// automáticamente (stream.torneo_auto): mientras el árbitro no abre la planilla
// no hay "partido en vivo" del cual sacar el logo, pero el torneo ya se conoce.
// Se guarda en memoria para no pedirlo otra vez.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const cache = new Map() // id -> logo_url ('' si el torneo no tiene)

export function useLogosTorneos(ids) {
  const clave = useMemo(() => [...new Set((ids || []).filter(Boolean))].sort().join(','), [ids])
  const [, repintar] = useState(0)

  useEffect(() => {
    const faltan = clave ? clave.split(',').filter(id => !cache.has(id)) : []
    if (!faltan.length) return
    let cancelado = false
    supabase.from('tournaments').select('id, logo_url').in('id', faltan).then(({ data }) => {
      if (cancelado) return
      for (const t of data || []) cache.set(t.id, t.logo_url || '')
      repintar(n => n + 1)
    })
    return () => { cancelado = true }
  }, [clave])

  return id => (id && cache.get(id)) || null
}
