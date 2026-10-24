// Gráfica de "tabla de posiciones" para la transmisión en vivo — igual que
// GolesEnVivoOverlay, se activa a propósito desde el panel de control de
// /admin/config-sitio. No calcula nada por su cuenta: recibe las filas ya
// calculadas con computeTablaGeneral (misma función que usa la tabla de
// posiciones real del torneo, en AdminTorneoDetallePage/TorneoPublicoPage),
// para no duplicar esa lógica acá. Diseño compartido en ./enVivoUI.
//
// PARTES: la tabla se muestra de a 10 equipos (en una pantalla chica caben
// menos y se muestran los que quepan LEGIBLES). Si el torneo tiene más equipos
// que los que caben, las partes rotan solas cada PARTE_MS ("automática") o se
// deja fija una parte con `pagina` (1, 2, 3…) — el botón del panel de control
// guarda ese número en site_config.en_vivo_control[streamId].tabla_pagina.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EnVivoEstilos, Escudo, PieGolmebol, TABLA_POR_PARTE } from './enVivoUI'

const PARTE_MS = 9000

// `pagina`: número de parte fija (1 = primeros 10…) o null/'auto' para que roten solas
// `pie`: leyenda de abajo (por defecto la de la tabla; en el descanso la página de overlay manda el mensaje institucional)
export default function TablaEnVivoOverlay({ filas, pagina = null, pie = 'Tabla actualizada automáticamente · tecnología GOLMEBOL' }) {
  // Cuántas filas caben LEGIBLES en el video: en un celular chico no caben 10
  // con letra cómoda, así que cada parte muestra menos y las demás salen al
  // rotar. En pantalla grande / OBS salen las 10.
  const ref = useRef(null)
  const [cabenFilas, setCabenFilas] = useState(TABLA_POR_PARTE)
  useLayoutEffect(() => {
    const el = ref.current
    const padre = el?.parentElement
    if (!el || !padre) return undefined
    const medir = () => {
      const u = el.offsetWidth / 100
      if (!u || !padre.clientHeight) return
      // El panel va entre el marcador de arriba y el margen de abajo: en un video angosto (celular) el
      // marcador ocupa proporcionalmente más alto, así que se le reserva más. Menos cabecera, títulos y pie.
      const reserva = padre.clientWidth <= 600 ? 0.36 : 0.2
      const libre = padre.clientHeight * (1 - reserva - 0.09) - u * (5.8 + 4 + 5.4)
      setCabenFilas(Math.max(4, Math.floor(libre / (u * 5.4))))
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(medir)
    ro.observe(padre)
    return () => ro.disconnect()
  }, [])

  // Parte que se está mostrando (solo en automático o si una parte fija no cabe entera)
  const [turno, setTurno] = useState({ clave: '', i: 0 })
  const total = filas?.length || 0
  const nPartes = Math.max(1, Math.ceil(total / TABLA_POR_PARTE))
  const fija = Number.isFinite(Number(pagina)) && Number(pagina) >= 1 && Number(pagina) <= nPartes ? Math.floor(Number(pagina)) : null
  const desde = fija ? (fija - 1) * TABLA_POR_PARTE : 0
  const base = fija ? filas.slice(desde, desde + TABLA_POR_PARTE) : (filas || [])
  const tam = Math.max(1, Math.min(TABLA_POR_PARTE, cabenFilas))
  const grupos = Math.max(1, Math.ceil(base.length / tam))
  const clave = `${fija || 'auto'}|${total}`
  if (turno.clave !== clave) setTurno({ clave, i: 0 })
  const idx = turno.clave === clave ? turno.i % grupos : 0

  useEffect(() => {
    if (grupos < 2) return undefined
    const t = setInterval(() => setTurno(p => ({ ...p, i: p.i + 1 })), PARTE_MS)
    return () => clearInterval(t)
  }, [grupos, clave])

  if (!filas || !filas.length) return null
  const visibles = base.slice(idx * tam, (idx + 1) * tam).map((f, k) => ({ f, pos: desde + idx * tam + k + 1 }))
  // Relleno invisible: todas las partes miden igual y el panel no "salta" al cambiar
  const relleno = grupos > 1 ? Math.max(0, tam - visibles.length) : 0
  const hayVivo = filas.some(f => f.enVivo)
  // "Parte 2/3": con parte fija es la que eligió el admin; en automático, la que va saliendo
  const parteActual = fija ? fija : idx + 1
  const partesTotal = fija ? nPartes : grupos

  const fila = ({ f, pos }) => {
    const dg = f.gf - f.gc
    return (
      <div key={f.equipo?.id || pos} className={`ev-r${f.enVivo ? ' vivo' : ''}${pos === 1 ? ' top1' : ''}`}>
        <span className="ev-c-pos">{pos}</span>
        <span className="ev-c-eq">
          <Escudo url={f.equipo?.logo_url} name={f.equipo?.name} size={3.8}/>
          <span className="ev-txt">{f.equipo?.name || '—'}</span>
          {f.enVivo && <span className="ev-chip">{f.enVivo.gf}-{f.enVivo.gc}</span>}
        </span>
        <span className="ev-c-n">{f.pj}</span>
        <span className="ev-c-n">{dg > 0 ? `+${dg}` : dg}</span>
        <span className="ev-c-pts">{f.pts}</span>
      </div>
    )
  }

  return (
    <div className="ev-p ev-u" ref={ref}>
      <EnVivoEstilos/>
      <div className="ev-h">
        <div className="ev-tag">{hayVivo ? 'Así va la tabla' : 'Tabla de posiciones'}</div>
        <div className="ev-sub">
          {hayVivo && <><span className="ev-dot"/>En vivo</>}
          {partesTotal > 1 && <span className="ev-parte">Parte {parteActual}/{partesTotal}</span>}
        </div>
      </div>
      <div className="ev-cols">
        <span className="ev-c-pos" style={{ fontWeight: 700 }}>#</span>
        <span style={{ flex: 1 }}>Equipo</span>
        <span className="ev-c-n">PJ</span>
        <span className="ev-c-n">DG</span>
        <span className="ev-c-pts" style={{ color: 'inherit' }}>PTS</span>
      </div>
      <div key={`${clave}|${idx}`} className="ev-filas">
        {visibles.map(fila)}
        {Array.from({ length: relleno }, (_, k) => <div key={`r${k}`} className="ev-r" style={{ visibility: 'hidden' }}/>)}
      </div>
      <PieGolmebol texto={pie}/>
    </div>
  )
}
