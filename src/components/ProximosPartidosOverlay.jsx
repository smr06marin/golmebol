import { useEffect, useRef, useState } from 'react'
import { EnVivoEstilos, Escudo, PieGolmebol } from './enVivoUI'
import { fmtHoraDate } from '../lib/horaHelpers'

// "Próximo partido" del DESCANSO: después de la tabla salen, uno por uno, los partidos que siguen
// en la misma cancha ese día. Cada partido dura 1 minuto. Si no hay más partidos, no se muestra
// (el que lo muestra ni siquiera lo prende). Al terminar el último avisa con `onTerminar`.
// `partidos`: [{ id, played_at, matchday, fase, home:{name,logo_url}, away:{name,logo_url} }] ya ordenados por hora.

export const MS_POR_PROXIMO = 60000
const FASES = { octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semifinal', final: 'Final', tercer_puesto: '3.er puesto' }

const CSS = `
.ev-px { padding: calc(var(--u) * 3.2) calc(var(--u) * 2.4) calc(var(--u) * 2.6); display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 2); animation: evFade .45s ease both; }
.ev-px-eq { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 1.6); text-align: center; }
.ev-px-nom { max-width: 100%; font-weight: 800; font-size: calc(var(--u) * 3.7); line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-transform: uppercase; letter-spacing: .01em; }
.ev-px-medio { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * .8); }
.ev-px-vs { color: var(--tenue); font-weight: 800; font-size: calc(var(--u) * 2.6); letter-spacing: .14em; }
.ev-px-hora { font-weight: 800; font-size: calc(var(--u) * 6.2); line-height: 1; color: #fff; white-space: nowrap; }
`

function etiquetaPartido(p) {
  if (p.fase && FASES[p.fase]) return FASES[p.fase]
  if (p.matchday) return `Jornada ${p.matchday}`
  return ''
}

export default function ProximosPartidosOverlay({ partidos, pie, onTerminar }) {
  const lista = Array.isArray(partidos) ? partidos : []
  const [idx, setIdx] = useState(0)
  const alTerminar = useRef(onTerminar)
  useEffect(() => { alTerminar.current = onTerminar })
  const n = lista.length

  useEffect(() => {
    const t = setTimeout(() => {
      if (idx + 1 < n) setIdx(idx + 1)
      else alTerminar.current?.()
    }, n ? MS_POR_PROXIMO : 0)
    return () => clearTimeout(t)
  }, [idx, n])

  const p = lista[idx]
  if (!p) return null
  const ultimo = idx === n - 1
  const hora = p.played_at ? fmtHoraDate(p.played_at) : ''
  const detalle = etiquetaPartido(p)
  return (
    <div className="ev-p ev-u">
      <EnVivoEstilos/>
      <style>{CSS}</style>
      <div className="ev-h">
        <div className="ev-tag">{idx === 0 ? 'Próximo partido' : ultimo && n > 1 ? 'Último partido' : 'Sigue'}</div>
        <div className="ev-sub">
          {detalle && <span>{detalle}</span>}
          {n > 1 && <span className="ev-parte">{idx + 1}/{n}</span>}
        </div>
      </div>
      <div className="ev-px" key={p.id || idx}>
        <div className="ev-px-eq">
          <Escudo url={p.home?.logo_url} name={p.home?.name} size={14}/>
          <div className="ev-px-nom">{p.home?.name || '—'}</div>
        </div>
        <div className="ev-px-medio">
          <div className="ev-px-hora">{hora || 'VS'}</div>
          {hora && <div className="ev-px-vs">VS</div>}
        </div>
        <div className="ev-px-eq">
          <Escudo url={p.away?.logo_url} name={p.away?.name} size={14}/>
          <div className="ev-px-nom">{p.away?.name || '—'}</div>
        </div>
      </div>
      <PieGolmebol texto={pie || 'El fútbol evoluciona. La tecnología también. Desarrollado por GOLMEBOL'}/>
    </div>
  )
}
