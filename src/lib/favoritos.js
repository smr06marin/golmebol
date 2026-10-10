// Equipos favoritos del visitante ("seguir" con la estrella). Se guardan en
// el propio navegador (localStorage) — no hace falta crear cuenta. Si el
// navegador no deja guardar (modo privado, datos bloqueados) se mantienen en
// memoria mientras la pestaña siga abierta, así la estrella nunca "no hace
// nada". Todos los componentes que usan el hook se mantienen sincronizados
// entre sí (y entre pestañas) con un evento.
import { useState, useEffect, useCallback } from 'react'

const CLAVE = 'gm_equipos_favoritos'
const EVENTO = 'gm-favoritos'
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

export function useFavoritos() {
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
    escribir(actual.includes(id) ? actual.filter(x => x !== id) : [...actual, id])
  }, [])

  return { ids, esFavorito, alternar }
}
