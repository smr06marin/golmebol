// Aviso de GOL para la transmisión en vivo: cuando el árbitro anota un gol en
// la planilla, aparece solo (unos 8 segundos, con entrada y salida suaves) una
// tarjeta tipo "lower-third" con el número de camiseta, el nombre del
// jugador, su equipo y el marcador (sin minuto: la gente ya ve el reloj), y 6 s
// la foto semitransparente del goleador abajo a la DERECHA — sin que nadie
// tenga que prenderlo desde el panel. Detecta el gol nuevo comparando la lista de goles del
// partido con la anterior; al abrir la página (o al cambiar de partido) NO
// muestra los goles que ya estaban. Si el árbitro borra un gol por error,
// simplemente deja de contarlo. Diseño compartido en ./enVivoUI.
import { useEffect, useState } from 'react'
import { extraerGoles } from '../lib/liveMatch'
import { supabase } from '../lib/supabase'
import { EnVivoEstilos, Escudo, textoContraste } from './enVivoUI'

const DURACION_MS = 8000
const FOTO_SEG = 6 // la foto del goleador se ve 6 segundos (dentro de los 8 del aviso)

const claveGol = g => `${g.equipo}|${g.numero}|${g.jugador}|${g.periodo}|${g.minuto}`
const contar = goles => goles.reduce((acc, g) => { const k = claveGol(g); acc[k] = (acc[k] || 0) + 1; return acc }, {})
const mismas = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]) }

// `bottom`: altura del aviso (se sube cuando la lista de goles o la nómina están prendidas)
export default function GolAvisoEnVivoOverlay({ partido, bottom = '14%' }) {
  const goles = partido ? extraerGoles(partido) : []
  const idPartido = partido?.id ?? null
  const claves = contar(goles)

  // Estado derivado "durante el render": se compara con la lista anterior del
  // MISMO partido y, si apareció un gol nuevo, se arma el aviso.
  const [previo, setPrevio] = useState({ id: idPartido, claves, n: 0 })
  const [aviso, setAviso] = useState(null)
  if (previo.id !== idPartido) {
    setPrevio({ id: idPartido, claves, n: previo.n })
    setAviso(null)
  } else if (!mismas(previo.claves, claves)) {
    const vistos = {}
    const nuevo = goles.find(g => { const k = claveGol(g); vistos[k] = (vistos[k] || 0) + 1; return vistos[k] > (previo.claves[k] || 0) })
    const n = previo.n + 1
    setPrevio({ id: idPartido, claves, n })
    if (nuevo) setAviso({ ...nuevo, n })
  }

  // Se apaga solo a los 8 segundos (un gol nuevo reinicia la cuenta)
  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), DURACION_MS)
    return () => clearTimeout(t)
  }, [aviso])

  // Foto del goleador: primero la que ya viene en la planilla; si no vino,
  // se busca por id del jugador. Sin foto → escudo grande con el número.
  const [fotoBuscada, setFotoBuscada] = useState({ n: -1, url: null })
  useEffect(() => {
    if (!aviso || aviso.foto || !aviso.jugadorId) return undefined
    let vivo = true
    supabase.from('players_publico').select('photo_face_url,photo_url').eq('id', aviso.jugadorId).maybeSingle()
      .then(({ data }) => { if (vivo) setFotoBuscada({ n: aviso.n, url: data?.photo_face_url || data?.photo_url || null }) })
      .catch(() => {})
    return () => { vivo = false }
  }, [aviso])

  if (!aviso || !partido) return null
  const fotoUrl = aviso.foto || (fotoBuscada.n === aviso.n ? fotoBuscada.url : null)
  const local = aviso.equipo === 'local'
  const equipo = local ? partido.home : partido.away
  const color = (local ? partido.colores?.colorLocal : partido.colores?.colorVisitante) || '#1a73e8'

  return (
    <>
      <EnVivoEstilos/>
      {/* Foto del goleador: grande y semitransparente, abajo a la DERECHA, con los bordes difuminados. Va libre,
          lejos de la tarjeta del gol, para que no se tape. Sin foto no sale nada. */}
      {fotoUrl && (
        <div key={'f' + aviso.n} style={{
          position: 'absolute', bottom: 0, right: 0, width: 'min(30%, 420px)', height: '56%', zIndex: 2, pointerEvents: 'none',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          WebkitMaskImage: 'radial-gradient(ellipse 62% 70% at 50% 62%, #000 38%, transparent 100%)', maskImage: 'radial-gradient(ellipse 62% 70% at 50% 62%, #000 38%, transparent 100%)',
          animation: `gmGolFoto ${FOTO_SEG}s ease-out both`,
        }}>
          <img src={fotoUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 18px rgba(0,0,0,.5))' }}/>
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom, zIndex: 3, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div key={aviso.n} className="ev-u ev-av-w">
          <div className="ev-av">
            {aviso.numero && (
              <div className="ev-av-num" style={{ background: color, color: textoContraste(color) }}>{aviso.numero}</div>
            )}
            <div className="ev-av-body">
              <div className="ev-av-top"><span className="ev-av-gol">¡GOL!</span><span className="ev-av-firma">Datos en vivo · <b>GOLMEBOL</b></span></div>
              <div className="ev-av-nom ev-txt">{aviso.jugador}</div>
              <div className="ev-av-eq">
                <Escudo url={equipo?.logo_url} name={equipo?.name} size={4.6}/>
                <span className="ev-txt">{equipo?.name || ''}</span>
                <span className="ev-av-sc">{partido.vivo?.golesLocal ?? 0} – {partido.vivo?.golesVis ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
