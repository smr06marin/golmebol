// Gráfica de "tabla de posiciones" para la transmisión en vivo — igual que
// GolesEnVivoOverlay, se activa a propósito desde el panel de control de
// /admin/config-sitio. No calcula nada por su cuenta: recibe las filas ya
// calculadas con computeTablaGeneral (misma función que usa la tabla de
// posiciones real del torneo, en AdminTorneoDetallePage/TorneoPublicoPage),
// para no duplicar esa lógica acá. Diseño compartido en ./enVivoUI.
import { useLayoutEffect, useRef, useState } from 'react'
import { EnVivoEstilos, Escudo } from './enVivoUI'

export default function TablaEnVivoOverlay({ filas }) {
  // Cuántas filas caben LEGIBLES en el video: en un celular chico no caben 10
  // con letra cómoda, así que se muestran menos (siempre las de arriba + los
  // equipos que juegan ahora). En pantalla grande / OBS salen las 10.
  const ref = useRef(null)
  const [cabenFilas, setCabenFilas] = useState(10)
  useLayoutEffect(() => {
    const el = ref.current
    const padre = el?.parentElement
    if (!el || !padre) return undefined
    const medir = () => {
      const u = el.offsetWidth / 100
      if (!u || !padre.clientHeight) return
      const libre = padre.clientHeight * 0.92 - u * (5.8 + 4 + 1.5)
      setCabenFilas(Math.max(4, Math.floor(libre / (u * 5.2))))
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(medir)
    ro.observe(padre)
    return () => ro.disconnect()
  }, [])

  if (!filas || !filas.length) return null
  // Top 10 como máximo — es una gráfica de transmisión, no la tabla completa.
  // Si un equipo que está jugando AHORA queda fuera, igual se muestra abajo con
  // su posición real, para que se vea cómo va la tabla con ese partido.
  const N = 10
  const vivosFuera = filas.slice(N).filter(f => f.enVivo).length
  const nTop = Math.max(3, Math.min(N, cabenFilas - vivosFuera - (vivosFuera ? 1 : 0)))
  const top = filas.slice(0, nTop).map((f, i) => ({ f, pos: i + 1 }))
  const extra = filas.slice(nTop).map((f, i) => ({ f, pos: i + nTop + 1 })).filter(x => x.f.enVivo)
  const hayVivo = filas.some(f => f.enVivo)

  const fila = ({ f, pos }) => {
    const dg = f.gf - f.gc
    return (
      <div key={f.equipo?.id || pos} className={`ev-r${f.enVivo ? ' vivo' : ''}${pos === 1 ? ' top1' : ''}`}>
        <span className="ev-c-pos">{pos}</span>
        <span className="ev-c-eq">
          <Escudo url={f.equipo?.logo_url} name={f.equipo?.name} size={3.6}/>
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
        <div className="ev-sub">{hayVivo && <><span className="ev-dot"/>En vivo · provisional</>}</div>
      </div>
      <div className="ev-cols">
        <span className="ev-c-pos" style={{ fontWeight: 800 }}>#</span>
        <span style={{ flex: 1 }}>Equipo</span>
        <span className="ev-c-n">PJ</span>
        <span className="ev-c-n">DG</span>
        <span className="ev-c-pts" style={{ color: 'inherit' }}>PTS</span>
      </div>
      <div>
        {top.map(fila)}
        {extra.length > 0 && <div className="ev-mas">···</div>}
        {extra.map(fila)}
      </div>
    </div>
  )
}
