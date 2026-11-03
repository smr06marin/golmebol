import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ── Personas viendo el sitio AHORA ───────────────────────────────────────────
// Cada persona que tiene abierta la portada se anota en un canal de "presencia" de Realtime (no guarda nada en la base
// de datos: la presencia desaparece sola cuando cierra la página). El semáforo del administrador principal se conecta
// al mismo canal solo para CONTAR (sin anotarse). Nunca rompe la página si algo falla.

export const CANAL_PRESENCIA = 'sitio-presencia'

function idSesion() {
  let sid = null
  try {
    sid = sessionStorage.getItem('golmebol_sid')
    if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('golmebol_sid', sid) }
  } catch { /* sin almacenamiento */ }
  return sid || Math.random().toString(36).slice(2)
}

// enVivo = true cuando en la pantalla hay una transmisión o un partido en vivo
export function usePresenciaSitio(enVivo) {
  const canalRef = useRef(null)
  const listoRef = useRef(false)
  const enVivoRef = useRef(!!enVivo)
  useEffect(() => { enVivoRef.current = !!enVivo }, [enVivo])

  useEffect(() => {
    let canal = null
    try {
      canal = supabase.channel(CANAL_PRESENCIA, { config: { presence: { key: idSesion() } } })
      canalRef.current = canal
      canal.subscribe((estado) => {
        if (estado === 'SUBSCRIBED') { listoRef.current = true; canal.track({ enVivo: enVivoRef.current }).catch(() => {}) }
      })
    } catch { /* la presencia es opcional */ }
    return () => { listoRef.current = false; try { if (canal) supabase.removeChannel(canal) } catch { /* nada */ } }
  }, [])

  useEffect(() => {
    if (listoRef.current && canalRef.current) { try { canalRef.current.track({ enVivo: !!enVivo }).catch(() => {}) } catch { /* nada */ } }
  }, [enVivo])
}

// Para el administrador: cuántas personas hay en el sitio y cuántas están con el en vivo a la vista
export function contarPresencia(estado) {
  const llaves = Object.keys(estado || {})
  const viendoVivo = llaves.filter(k => (estado[k] || []).some(m => m && m.enVivo)).length
  return { enSitio: llaves.length, viendoVivo }
}
