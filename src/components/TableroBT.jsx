// Tablero de equipos estilo transmisión profesional (referencia: final de la
// Europa League en BT Sport): una barra negra con el NOMBRE de cada equipo a
// los lados, el marcador en una caja blanca al centro, los escudos grandes
// sobresaliendo en las puntas y, ENCIMA del nombre de cada equipo, quién hizo
// los goles con su minuto. Una etiqueta de color arriba dice qué se está
// viendo (Descanso, Fin del partido, Goles, Alineaciones) y una pestaña abajo
// lleva la firma de GOLMEBOL.
//
// Lo usan: GolesEnVivoOverlay (panel de control), ResumenGolesOverlay
// (descanso / final automáticos) y JugadoresEnVivoOverlay (con `cuerpo`).
// Medidas en `--u` (1% del ancho del tablero), ver ./enVivoUI.
import { EnVivoEstilos, Escudo, PieGolmebol } from './enVivoUI'

const MAX_LINEAS = 5

// Junta los goles de un mismo jugador en una sola línea: "SEBASTIÁN GÓMEZ 4' 19'"
function lineasDeGoles(goles, equipo, separarTiempos) {
  const mapa = new Map()
  goles.filter(g => (equipo === 'local') === (g.equipo === 'local')).forEach(g => {
    const clave = `${g.numero}|${g.jugador}`
    if (!mapa.has(clave)) mapa.set(clave, { numero: g.numero, jugador: g.jugador, minutos: [] })
    const t = separarTiempos && (g.periodo || 1) > 1 ? ` ${g.periodo}T` : ''
    mapa.get(clave).minutos.push(g.minuto != null ? `${g.minuto}'${t}` : '—')
  })
  return [...mapa.values()]
}

function Goleadores({ lineas }) {
  const visibles = lineas.slice(-MAX_LINEAS)
  const ocultos = lineas.length - visibles.length
  return (
    <div className="ev-bt-gs">
      {ocultos > 0 && <div className="ev-bt-g ev-bt-mas">+{ocultos} más</div>}
      {visibles.map((l, i) => (
        <div key={i} className="ev-bt-g">
          {l.numero && <span className="ev-bt-gn">{l.numero} </span>}
          <span className="ev-bt-gj">{l.jugador}</span>
          {' '}<span className="ev-bt-gm">{l.minutos.join(' · ')}</span>
        </div>
      ))}
    </div>
  )
}

// partido: { home, away: {name, logo_url}, colores? }
// goles: [{equipo:'local'|'visitante', jugador, numero, minuto, periodo}] (opcional)
// marcador: {gl, gv} o null para mostrar "VS" (alineaciones)
export default function TableroBT({ partido, tag, goles, marcador, subtitulo, pie, cuerpo, ancho }) {
  if (!partido) return null
  const cl = partido.colores?.colorLocal || '#5f6368'
  const cv = partido.colores?.colorVisitante || '#5f6368'
  const hayGoles = Array.isArray(goles) && goles.length > 0
  const separar = hayGoles && goles.some(g => (g.periodo || 1) > 1) && goles.some(g => (g.periodo || 1) === 1)
  const ll = hayGoles ? lineasDeGoles(goles, 'local', separar) : []
  const lv = hayGoles ? lineasDeGoles(goles, 'visitante', separar) : []

  return (
    <div className="ev-bt ev-u" style={ancho ? { width: ancho } : undefined}>
      <EnVivoEstilos/>
      <div className="ev-bt-tagw"><div className="ev-bt-tag">{tag}</div></div>
      <div className="ev-bt-panel">
        {hayGoles && (
          <div className="ev-bt-fila ev-bt-fgol">
            <Goleadores lineas={ll}/>
            <div/>
            <Goleadores lineas={lv}/>
          </div>
        )}
        <div className="ev-bt-fila ev-bt-fmain">
          <div className="ev-bt-n ev-bt-nl"><span>{partido.home?.name || '—'}</span></div>
          <div className="ev-bt-sc">
            {marcador
              ? <>{marcador.gl}<i>–</i>{marcador.gv}</>
              : <em>VS</em>}
          </div>
          <div className="ev-bt-n ev-bt-nr"><span>{partido.away?.name || '—'}</span></div>
          <div className="ev-bt-cl ev-bt-cl-l" style={{ background: cl }}/>
          <div className="ev-bt-cl ev-bt-cl-r" style={{ background: cv }}/>
          <div className="ev-bt-esc ev-bt-esc-l"><Escudo url={partido.home?.logo_url} name={partido.home?.name} size={13}/></div>
          <div className="ev-bt-esc ev-bt-esc-r"><Escudo url={partido.away?.logo_url} name={partido.away?.name} size={13}/></div>
        </div>
        {cuerpo}
      </div>
      <div className="ev-bt-piew">
        <div className="ev-bt-pie">
          {subtitulo && <div className="ev-bt-sub">{subtitulo}</div>}
          <PieGolmebol texto={pie}/>
        </div>
      </div>
    </div>
  )
}

