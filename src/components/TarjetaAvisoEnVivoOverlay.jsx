// Aviso de TARJETA para la transmisión en vivo: cuando el árbitro le saca una tarjeta (amarilla, azul o roja)
// a un jugador en la planilla, aparece solo (unos 8 segundos, con entrada y salida suaves) una tarjeta tipo
// "lower-third" abajo: número de camiseta, nombre del jugador, su equipo, la etiqueta "TARJETA ROJA" y el
// dibujo de la tarjeta, con el sello de la app GOLMEBOL debajo. Mismo molde y mismos tiempos que el aviso de gol
// (./GolAvisoEnVivoOverlay): detecta la tarjeta nueva comparando la lista con la anterior; al abrir la página
// (o cambiar de partido) NO muestra las que ya estaban. Diseño compartido en ./enVivoUI.
import { useEffect, useState } from 'react'
import { extraerTarjetas } from '../lib/liveMatch'
import { EnVivoEstilos, Escudo, textoContraste } from './enVivoUI'

const DURACION_MS = 8000

const TARJETAS = {
  amarilla: { nombre: 'TARJETA AMARILLA', color: '#f9c400' },
  azul:     { nombre: 'TARJETA AZUL',     color: '#1a73e8' },
  roja:     { nombre: 'TARJETA ROJA',     color: '#e5433d' },
}

const claveTarjeta = t => `${t.equipo}|${t.numero}|${t.jugador}|${t.color}|${t.periodo}|${t.minuto}`
const contar = lista => lista.reduce((acc, t) => { const k = claveTarjeta(t); acc[k] = (acc[k] || 0) + 1; return acc }, {})
const mismas = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]) }

// `bottom` / `arriba`: igual que el aviso de gol (propsAvisoGol decide dónde sale según la gráfica que esté prendida).
export default function TarjetaAvisoEnVivoOverlay({ partido, bottom = '17%', arriba = false }) {
  const tarjetas = partido ? extraerTarjetas(partido) : []
  const idPartido = partido?.id ?? null
  const claves = contar(tarjetas)

  const [previo, setPrevio] = useState({ id: idPartido, claves, n: 0 })
  const [aviso, setAviso] = useState(null)
  if (previo.id !== idPartido) {
    setPrevio({ id: idPartido, claves, n: previo.n })
    setAviso(null)
  } else if (!mismas(previo.claves, claves)) {
    const vistos = {}
    const nueva = tarjetas.find(t => { const k = claveTarjeta(t); vistos[k] = (vistos[k] || 0) + 1; return vistos[k] > (previo.claves[k] || 0) })
    const n = previo.n + 1
    setPrevio({ id: idPartido, claves, n })
    if (nueva) setAviso({ ...nueva, n })
  }

  // Se apaga solo a los 8 segundos (una tarjeta nueva reinicia la cuenta)
  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), DURACION_MS)
    return () => clearTimeout(t)
  }, [aviso])

  if (!aviso || !partido) return null
  const tipo = TARJETAS[aviso.color] || TARJETAS.amarilla
  const local = aviso.equipo === 'local'
  const equipo = local ? partido.home : partido.away
  const colorEquipo = (local ? partido.colores?.colorLocal : partido.colores?.colorVisitante) || '#1a73e8'
  const nombre = String(aviso.jugador || '')

  return (
    <>
      <EnVivoEstilos/>
      <div style={{ position: 'absolute', left: 0, right: 0, ...(arriba ? { top: '5%' } : { bottom }), zIndex: 3, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div key={aviso.n} className="ev-u ev-av-w">
          <div className="ev-av" style={{ borderBottomColor: tipo.color }}>
            {aviso.numero && (
              <div className="ev-av-num" style={{ background: colorEquipo, color: textoContraste(colorEquipo) }}>{aviso.numero}</div>
            )}
            <div className="ev-av-body">
              <div className="ev-av-top">
                <span className="ev-ta-tag" style={{ background: tipo.color, color: textoContraste(tipo.color) }}>{tipo.nombre}</span>
              </div>
              <div className={`ev-av-nom${nombre.length > 30 ? ' muy-largo' : nombre.length > 20 ? ' largo' : ''}`}>{nombre}</div>
              <div className="ev-av-eq">
                <Escudo url={equipo?.logo_url} name={equipo?.name} size={4.6}/>
                <span className="ev-txt">{equipo?.name || ''}</span>
              </div>
            </div>
            <div className="ev-ta-box" aria-label={tipo.nombre}>
              <span className="ev-ta-card" style={{ background: tipo.color }}/>
            </div>
          </div>
          {/* Sello: que se vea que la tarjeta la registra la app de GOLMEBOL */}
          <div key={'m' + aviso.n} className="ev-av-marca">
            <img src="/marca/watermark-logo.png" alt=""/>
            <span>Tarjeta registrada con la app <b>GOLMEBOL</b></span>
          </div>
        </div>
      </div>
    </>
  )
}
