import { useEffect, useRef, useState } from 'react'
import TablaEnVivoOverlay from './TablaEnVivoOverlay'
import { TABLA_POR_PARTE } from './enVivoUI'

// Tabla de posiciones del DESCANSO (la que sale sola, ver OverlayEnVivoPage).
// Cuánto dura cada pantalla depende de cuántos equipos muestra: una pantalla de 10 equipos
// dura 2 minutos, una de 5 dura 1 minuto, y así (12 segundos por equipo). Una tabla de un solo
// equipo dura solo 12 segundos.
//  · Torneo con varios grupos → sale cada grupo, uno después del otro, cada uno con su tiempo.
//  · Tabla con más de 10 equipos → se parte de a 10 y cada parte dura lo suyo.
// Al terminar la última pantalla avisa con `onTerminar` para que siga lo que toque (próximos partidos…).

export const MS_POR_EQUIPO_TABLA = 12000
const MS_MINIMO = 10000
const ESPERA_DATOS_MS = 10000 // si la tabla nunca llega, se salta en vez de quedarse esperando

// Pantallas que se van a mostrar: [{ etiqueta, filas, pagina, ms }]
export function pantallasTablaDescanso(general, grupos) {
  const tablas = Array.isArray(grupos) && grupos.length > 1
    ? grupos.map(g => ({ etiqueta: g.nombre ? `Grupo ${g.nombre}` : null, filas: g.filas }))
    : (general && general.length ? [{ etiqueta: null, filas: general }] : [])
  return tablas.flatMap(t => {
    const total = t.filas.length
    const partes = Math.max(1, Math.ceil(total / TABLA_POR_PARTE))
    return Array.from({ length: partes }, (_, k) => {
      const enParte = Math.min(TABLA_POR_PARTE, total - k * TABLA_POR_PARTE)
      return { etiqueta: t.etiqueta, filas: t.filas, pagina: k + 1, ms: Math.max(MS_MINIMO, enParte * MS_POR_EQUIPO_TABLA) }
    })
  })
}

export default function TablaDescansoOverlay({ filas, grupos, pie, onTerminar }) {
  const pantallas = pantallasTablaDescanso(filas, grupos)
  const [idx, setIdx] = useState(0)
  const alTerminar = useRef(onTerminar)
  useEffect(() => { alTerminar.current = onTerminar })

  const hayDatos = pantallas.length > 0
  const actual = pantallas[idx] || null
  const ms = actual?.ms || 0
  const n = pantallas.length

  useEffect(() => {
    if (!hayDatos) {
      const t = setTimeout(() => alTerminar.current?.(), ESPERA_DATOS_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      if (idx + 1 < n) setIdx(idx + 1)
      else alTerminar.current?.()
    }, ms)
    return () => clearTimeout(t)
  }, [hayDatos, idx, ms, n])

  if (!actual) return null
  return <TablaEnVivoOverlay key={`${idx}|${actual.etiqueta || ''}`} filas={actual.filas} pagina={actual.pagina} etiqueta={actual.etiqueta} pie={pie}/>
}
