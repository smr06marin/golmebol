// Torneos favoritos del visitante ("Mis torneos"). Igual que los equipos favoritos (lib/favoritos.js):
// se guardan en el propio navegador (localStorage), sin cuenta; si el navegador no deja guardar se
// mantienen en memoria mientras la pestaña siga abierta, y todos los componentes que usan el hook
// se mantienen sincronizados (también entre pestañas) con un evento.
import { useState, useEffect, useCallback } from 'react'

const CLAVE = 'gm_torneos_favoritos'
const EVENTO = 'gm-torneos-favoritos'
const EVENTO_SEGUIDO = 'gm-torneo-seguido' // detail: { id, seguido } — lib/avisos.js lo usa para activar o quitar los avisos de ese torneo
export const EVENTO_TORNEO_SEGUIDO = EVENTO_SEGUIDO
let memoria = []

function leer() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (Array.isArray(v)) { memoria = v; return v }
  } catch { /* sin acceso a localStorage: se usa la memoria */ }
  return memoria
}

function escribir(ids) {
  memoria = ids
  try { localStorage.setItem(CLAVE, JSON.stringify(ids)) } catch { /* ignorar */ }
  try { window.dispatchEvent(new Event(EVENTO)) } catch { /* ignorar */ }
}

export function useFavoritosTorneos() {
  const [ids, setIds] = useState(leer)

  useEffect(() => {
    const sync = () => setIds(leer())
    window.addEventListener(EVENTO, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENTO, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const esFavorito = useCallback(id => !!id && ids.includes(id), [ids])
  const alternar = useCallback(id => {
    if (!id) return
    const actual = leer()
    const agrega = !actual.includes(id)
    escribir(agrega ? [...actual, id] : actual.filter(x => x !== id))
    try { window.dispatchEvent(new CustomEvent(EVENTO_SEGUIDO, { detail: { id, seguido: agrega } })) } catch { /* ignorar */ }
  }, [])

  return { ids, esFavorito, alternar }
}
