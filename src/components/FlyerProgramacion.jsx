import { useRef, useState, useMemo, useEffect } from 'react'
import { Download, X, ChevronLeft, ChevronRight, Trophy } from 'lucide-react'

// Tamaño fijo de "historia" de Instagram (1080x1920 = relación 9:16). Se
// dibuja a mitad de escala (540x960) y se exporta con scale:2 en
// html2canvas, así el PNG final da exactamente 1080x1920 sin importar
// cuántos partidos tenga la página — el layout se acomoda dentro de ese
// alto fijo (ver "flex + justify-content: space-evenly" en la lista de
// partidos) en vez de crecer sin límite como antes.
//
// IMPORTANTE sobre el tamaño: el div que se captura con html2canvas
// (flyerRef) SIEMPRE debe medir exactamente ANCHOxALTO px de verdad — antes
// tenía "maxWidth:100%", así que en un celular angosto el navegador lo
// achicaba de verdad (su propio ancho real quedaba, por ej., en 320px) y el
// contenido interno (hecho con márgenes/anchos en píxeles fijos) se
// desbordaba y se cortaba. El PNG exportado salía con esa franja de
// contenido apretada a la izquierda y el resto del lienzo (hasta completar
// los 540px pedidos) relleno con el color de fondo de reserva — una franja
// oscura sin nada, que es exactamente el "parche negro" reportado. La forma
// correcta de verlo más chico en pantalla SIN tocar su tamaño real es un
// transform:scale() en un div ENVOLVENTE (el transform no cambia el tamaño
// de layout del hijo, solo cómo se pinta) — ver "escalaPreview" más abajo.
const ANCHO = 540
const ALTO  = 960
// Cantidad de partidos por página — calculada para que las tarjetas entren
// a su tamaño real (ver comentario grande sobre flexShrink en FilaPartido)
// sin que el navegador tenga que achicarlas: con encabezado de torneo hay
// menos alto libre (el encabezado ocupa bastante), así que caben menos que
// sin encabezado (que va directo a la lista de partidos).
const POR_PAGINA_CON_TORNEO = 5
const POR_PAGINA_SIN_TORNEO = 6

const ROJO_OSC = '#230404'
const ROJO     = '#7a0f0f'
const ROJO_CL  = '#a51e1e'
const ORO      = '#e8b923'
const ORO_SUAVE = '#f3d47a'

// Deja primero los partidos sin jugar, ordenados por fecha/hora ascendente
// (los sin fecha van al final); para los jugados, orden cronológico también.
function ordenarPartidos(lista, modo) {
  const filtrados = lista.filter(p => modo === 'jugados' ? p.status === 'finished' : p.status !== 'finished')
  return [...filtrados].sort((a, b) => {
    if (!a.played_at && !b.played_at) return 0
    if (!a.played_at) return 1
    if (!b.played_at) return -1
    return new Date(a.played_at) - new Date(b.played_at)
  })
}

function trocear(lista, tam) {
  const paginas = []
  for (let i = 0; i < lista.length; i += tam) paginas.push(lista.slice(i, i + tam))
  return paginas.length ? paginas : [[]]
}

async function esperarImagenes(container) {
  if (!container) return
  const imgs = Array.from(container.querySelectorAll('img'))
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res })))
}

function formatFechaCorta(fecha) {
  return fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase().replace('.', '')
}
function formatHora(fecha) {
  let h = fecha.getHours()
  const m = fecha.getMinutes()
  const suf = h >= 12 ? 'PM' : 'AM'
  h = h % 12; if (h === 0) h = 12
  return `${h}:${String(m).padStart(2, '0')} ${suf}`
}

// Escudo circular con anillo dorado — pensado para verse bien sobre la
// cinta roja (fondo blanco propio, así el logo del equipo siempre contrasta).
function EscudoCirculo({ logo_url, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff', border: `2px solid ${ORO}`, boxShadow: '0 2px 5px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {logo_url
        ? <img src={logo_url} crossOrigin="anonymous" style={{ width: '82%', height: '82%', objectFit: 'contain' }}/>
        : <Trophy size={size * 0.42} color="#b0862a"/>}
    </div>
  )
}

// Ancho máximo del nombre de cada equipo antes de truncar con "..." — así
// un nombre largo nunca se envuelve en varias líneas ni se sale de su fila
// (que es justo lo que se veía "desordenado" antes).
const NOMBRE_MAXW = 138

function NombreEquipo({ nombre, align }) {
  return (
    <span style={{
      color: '#fff', fontWeight: 900, fontSize: '17px', textTransform: 'uppercase',
      textAlign: align, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      maxWidth: `${NOMBRE_MAXW}px`, textShadow: '0 1px 3px rgba(0,0,0,.6)',
    }}>
      {nombre || 'Por definir'}
    </span>
  )
}

// Fila plana por partido: escudo + nombre a cada lado (con elipsis si el
// nombre no entra) y la hora del partido (o el marcador, si ya se jugó) bien
// visible en el centro — sin cinta sesgada ni rombo, para que se vea
// ordenado y prolijo como el flyer de referencia.
//
// mostrarTorneo: cuando el flyer junta partidos de VARIOS torneos (no tiene
// un encabezado de torneo propio — ver "sinEncabezado" en el componente
// principal), cada fila necesita decir de qué torneo es ese partido, ya que
// no hay un título general que lo diga.
//
// Tarjeta por partido: tres zonas con color propio para que no se confundan
// entre sí aunque vayan pegadas — insignia dorada arriba (torneo, solo si
// aplica), franja oscura en el medio (el partido en sí: escudos + nombres +
// hora/marcador) y una etiqueta clara abajo (cancha + fecha) — todo dentro
// de una misma tarjeta con borde, para que se lea como un conjunto.
//
// OJO con flexShrink: el contenedor de partidos (más abajo) es un flex
// column con "space-evenly", y por el mismo motivo del "parche negro" (ver
// comentario grande arriba de ANCHO/ALTO) un elemento flex con
// overflow:hidden tiene su "tamaño mínimo automático" en 0 — así que si
// el total de tarjetas no entra en el alto fijo, el navegador las achica
// (recorta el texto) en vez de simplemente desbordar. Por eso overflow:
// hidden va en un DIV DE ADENTRO (para el borde redondeado) y no en la
// tarjeta misma, que además lleva flexShrink:0 para que nunca se comprima
// — la cantidad de partidos por página (porPagina) ya está calculada para
// que quepan todos a su tamaño real, sin necesidad de achicarlos.
function FilaPartido({ p, mostrarTorneo }) {
  const esJugado = p.status === 'finished'
  const fechaObj = p.played_at ? new Date(p.played_at) : null
  const marcador = esJugado ? `${p.home_score}-${p.away_score}` : null
  const centro = marcador || (fechaObj ? formatHora(fechaObj) : 'VS')
  const infoCancha = [p.location, fechaObj && formatFechaCorta(fechaObj)].filter(Boolean).join('  ·  ')

  return (
    <div style={{ flexShrink: 0, margin: '0 20px' }}>
      <div style={{ background: 'rgba(0,0,0,.22)', border: '1px solid rgba(255,255,255,.16)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Zona 1 (dorada): de qué torneo es — solo en el flyer "todos los torneos" */}
        {mostrarTorneo && p.tournaments?.name && (
          <div style={{ textAlign: 'center', background: ORO, padding: '5px 8px' }}>
            <span style={{ color: ROJO_OSC, fontSize: '13px', fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.tournaments.name}
            </span>
          </div>
        )}
        {/* Zona 2 (oscura): el partido — escudos, nombres, hora o marcador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', height: '66px', padding: '0 12px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '9px' }}>
            <NombreEquipo nombre={p.home?.name} align="right"/>
            <EscudoCirculo logo_url={p.home?.logo_url} size={42}/>
          </div>
          <div style={{ flexShrink: 0, width: '72px', textAlign: 'center' }}>
            <span style={{ color: ORO, fontWeight: 900, fontSize: marcador ? '23px' : '17px', letterSpacing: marcador ? '.5px' : '.3px' }}>{centro}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
            <EscudoCirculo logo_url={p.away?.logo_url} size={42}/>
            <NombreEquipo nombre={p.away?.name} align="left"/>
          </div>
        </div>
        {/* Zona 3 (clara): cancha y fecha (la hora ya se ve arriba, en el
            centro, así que no se repite acá) */}
        <div style={{ textAlign: 'center', background: 'rgba(243,212,122,.16)', padding: '5px 8px' }}>
          <span style={{ color: ORO_SUAVE, fontSize: '13px', fontWeight: 700, letterSpacing: '.2px' }}>
            {infoCancha || 'Por confirmar'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Banda decorativa tipo "chevron" (rayas diagonales) — el mismo motivo que
// usa el flyer de referencia arriba y abajo del todo.
function BandaChevron({ arriba }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, height: '9px', zIndex: 1,
      [arriba ? 'top' : 'bottom']: 0,
      background: `repeating-linear-gradient(135deg, ${ORO} 0px, ${ORO} 7px, ${ROJO_OSC} 7px, ${ROJO_OSC} 14px)`,
    }}/>
  )
}

export default function FlyerProgramacion({ torneo, equipos, partidos, onClose }) {
  const flyerRef = useRef(null)
  const wrapperRef = useRef(null)
  const [escalaPreview, setEscalaPreview] = useState(1)
  const [descargando, setDescargando] = useState(false)
  const [modo, setModo] = useState(() => {
    const hayProximos = partidos.some(p => p.status !== 'finished')
    return hayProximos ? 'proximos' : 'jugados'
  })
  const [pagina, setPagina] = useState(0)

  // Sin torneo (viene null desde el calendario cuando junta partidos de
  // VARIOS torneos): no hay encabezado propio que mostrar — nada de
  // escudo/nombre/insignia — el flyer va directo a la lista de partidos, y
  // cada partido se identifica con su propio torneo (ver FilaPartido). Con
  // torneo (un solo torneo, ya sea porque el flyer se pide desde el detalle
  // del torneo o porque el calendario está filtrado a uno solo) sí se
  // muestra el encabezado de siempre. Al no haber encabezado sobra más
  // alto libre, así que entran más partidos por página.
  const sinEncabezado = !torneo?.name
  const porPagina = sinEncabezado ? POR_PAGINA_SIN_TORNEO : POR_PAGINA_CON_TORNEO

  // Los partidos siempre quedan ordenados por fecha/hora real ascendente
  // (ordenarPartidos), así que si hay partidos el sábado y el domingo,
  // primero salen todos los del sábado en orden de hora y después los del
  // domingo — sin importar de qué torneo sea cada uno.
  const ordenados = useMemo(() => ordenarPartidos(partidos, modo), [partidos, modo])
  const paginas = useMemo(() => trocear(ordenados, porPagina), [ordenados, porPagina])
  const totalPaginas = paginas.length
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const items = paginas[paginaActual] || []

  function cambiarModo(m) { setModo(m); setPagina(0) }

  // El flyer (flyerRef) SIEMPRE mide ANCHOxALTO de verdad — nunca se achica
  // por CSS — porque html2canvas necesita que su tamaño de layout real
  // coincida con lo que le pedimos (ver comentario grande arriba). Para que
  // igual se vea completo en pantallas angostas (celular), lo encogemos
  // visualmente con transform:scale() sobre el div envolvente
  // (wrapperRef): el transform no cambia el tamaño de layout del hijo, así
  // que flyerRef sigue midiendo 540x960 de verdad para html2canvas.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const calcular = () => setEscalaPreview(Math.min(1, wrapper.offsetWidth / ANCHO))
    calcular()
    const obs = new ResizeObserver(calcular)
    obs.observe(wrapper)
    return () => obs.disconnect()
  }, [])

  async function descargarPagina(idx) {
    await esperarImagenes(flyerRef.current)
    // Bebas Neue se carga async desde Google Fonts (index.html) — si
    // html2canvas captura antes de que termine de cargar, el texto sale con
    // la tipografía de respaldo (Arial/Impact) en vez de Bebas Neue.
    if (document.fonts?.ready) await document.fonts.ready
    const { default: html2canvas } = await import('html2canvas')
    // scale:2 sobre un lienzo de 540x960 = 1080x1920 exactos (historia de Instagram).
    const canvas = await html2canvas(flyerRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: ROJO_OSC, width: ANCHO, height: ALTO })
    const link = document.createElement('a')
    const base = (torneo?.name || 'golmebol').replace(/\s+/g, '_')
    const tipo = modo === 'jugados' ? 'resultados' : 'programacion'
    link.download = totalPaginas > 1 ? `${base}_${tipo}_pag${idx + 1}de${totalPaginas}.png` : `${base}_${tipo}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function handleDescargarActual() {
    setDescargando(true)
    try { await descargarPagina(paginaActual) } finally { setDescargando(false) }
  }

  async function handleDescargarTodas() {
    setDescargando(true)
    try {
      for (let i = 0; i < totalPaginas; i++) {
        setPagina(i)
        // esperar a que React pinte la página i antes de capturarla
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        await new Promise(r => setTimeout(r, 200))
        await descargarPagina(i)
        await new Promise(r => setTimeout(r, 250))
      }
    } finally { setDescargando(false) }
  }

  const titulo = modo === 'jugados' ? 'RESULTADOS' : 'PRÓXIMOS PARTIDOS'
  const subtitulo = [torneo?.modalidad, torneo?.season || torneo?.categoria].filter(Boolean).join(' · ')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '92vh', overflow: 'auto' }}>

        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Flyer de programación · historia de Instagram (1080×1920)</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Toggle próximos / jugados */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {['proximos', 'jugados'].map(m => (
            <button key={m} onClick={() => cambiarModo(m)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '.82rem', fontWeight: '600', background: modo === m ? '#1a73e8' : '#fff', color: modo === m ? '#fff' : '#5f6368', border: modo === m ? 'none' : '1px solid #dadce0' }}>
              {m === 'proximos' ? 'Próximos partidos' : 'Partidos jugados'}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', background: '#f8f9fa', borderRadius: '12px' }}>
            No hay {modo === 'jugados' ? 'partidos jugados' : 'próximos partidos'} para mostrar.
          </div>
        ) : (
          <>
            {/* Paginador */}
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={paginaActual === 0}
                  style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px', cursor: paginaActual === 0 ? 'default' : 'pointer', color: '#5f6368', opacity: paginaActual === 0 ? .4 : 1, display: 'flex' }}>
                  <ChevronLeft size={16}/>
                </button>
                <span style={{ fontSize: '.8rem', color: '#5f6368', fontWeight: '600' }}>Página {paginaActual + 1} de {totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={paginaActual === totalPaginas - 1}
                  style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px', cursor: paginaActual === totalPaginas - 1 ? 'default' : 'pointer', color: '#5f6368', opacity: paginaActual === totalPaginas - 1 ? .4 : 1, display: 'flex' }}>
                  <ChevronRight size={16}/>
                </button>
              </div>
            )}

            {/* FLYER — tamaño fijo de historia de Instagram (540x960 acá,
                exporta 1080x1920). overflow:hidden para que nunca "se salga"
                del lienzo — por eso la cantidad de partidos por página está
                limitada (porPagina) y el resto queda en más páginas.
                wrapperRef reserva el alto ya escalado (para que no quede un
                hueco vacío en el modal) y centra; flyerRef adentro SIEMPRE
                mide 540x960 de verdad y solo se ve más chico por el
                transform:scale — así html2canvas nunca ve un tamaño achicado. */}
            <div ref={wrapperRef} style={{ width: '100%', maxWidth: `${ANCHO}px`, height: `${ALTO * escalaPreview}px`, margin: '0 auto', overflow: 'hidden' }}>
            <div ref={flyerRef} style={{
              width: `${ANCHO}px`, height: `${ALTO}px`,
              transform: `scale(${escalaPreview})`, transformOrigin: 'top left',
              position: 'relative', overflow: 'hidden', borderRadius: '4px',
              fontFamily: "'Bebas Neue', 'Arial Black', 'Impact', sans-serif",
              background: `radial-gradient(ellipse at 50% 15%, ${ROJO_CL} 0%, ${ROJO} 42%, ${ROJO_OSC} 100%)`,
            }}>
              {/* Textura diagonal sutil de fondo */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: .5, background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0px, rgba(255,255,255,.045) 16px, transparent 16px, transparent 32px)' }}/>

              <BandaChevron arriba/>
              <BandaChevron/>

              <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header — solo cuando el flyer es de UN torneo (torneo
                    viene con nombre). Cuando junta partidos de varios
                    torneos no hay título ni escudo: va directo a la lista
                    de partidos, cada uno con su propio torneo. */}
                {sinEncabezado ? (
                  <div style={{ flexShrink: 0, height: '20px' }}/>
                ) : (
                  <div style={{ flexShrink: 0, textAlign: 'center', padding: '36px 26px 12px' }}>
                    <div style={{ width: '78px', height: '78px', margin: '0 auto', borderRadius: '50%', background: '#fff', border: `3px solid ${ORO}`, boxShadow: '0 4px 14px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {torneo?.logo_url
                        ? <img src={torneo.logo_url} crossOrigin="anonymous" style={{ width: '84%', height: '84%', objectFit: 'contain' }}/>
                        : <Trophy size={34} color={ROJO}/>}
                    </div>
                    <div style={{ color: ORO, fontSize: '14px', fontWeight: 900, letterSpacing: '3px', marginTop: '8px' }}>GOLMEBOL</div>
                    <div style={{ color: '#fff', fontSize: '33px', fontWeight: 900, letterSpacing: '.5px', textTransform: 'uppercase', lineHeight: 1.12, marginTop: '4px', textShadow: '0 2px 10px rgba(0,0,0,.5)' }}>
                      {torneo.name}
                    </div>
                    {subtitulo && (
                      <div style={{ color: ORO_SUAVE, fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', marginTop: '4px', textTransform: 'uppercase' }}>
                        {subtitulo}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '10px 0 8px' }}>
                      <div style={{ flex: 1, maxWidth: '90px', height: '2px', background: `linear-gradient(90deg, transparent, ${ORO})` }}/>
                      <div style={{ width: '9px', height: '9px', background: ORO, transform: 'rotate(45deg)', flexShrink: 0 }}/>
                      <div style={{ flex: 1, maxWidth: '90px', height: '2px', background: `linear-gradient(90deg, ${ORO}, transparent)` }}/>
                    </div>
                    <div style={{ display: 'inline-block', border: `1.5px solid ${ORO}`, borderRadius: '20px', padding: '4px 18px' }}>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 900, letterSpacing: '1.5px' }}>{titulo}</span>
                    </div>
                  </div>
                )}

                {/* Partidos — reparte el espacio vertical restante en partes
                    iguales (space-evenly) cuando la página trae menos de
                    porPagina partidos, y "gap" asegura una separación mínima
                    fija entre tarjetas aunque el espacio esté justo (antes,
                    sin gap, con muchas tarjetas terminaban pegadas una con
                    otra). */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: '8px', padding: '4px 0' }}>
                  {items.map(p => <FilaPartido key={p.id} p={p} mostrarTorneo={sinEncabezado}/>)}
                </div>

                {/* Footer */}
                <div style={{ flexShrink: 0, textAlign: 'center', padding: '12px 20px 16px' }}>
                  <div style={{ color: '#fff', fontSize: '16px', fontWeight: 900, letterSpacing: '.5px' }}>golmebol.com</div>
                  <div style={{ color: ORO_SUAVE, fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.5px', marginTop: '4px' }}>PASIÓN · RESPETO · COMPETENCIA</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '7px' }}>
                    {['IG', 'FB', 'TT'].map(s => (
                      <div key={s} style={{ width: '18px', height: '18px', borderRadius: '50%', border: `1px solid ${ORO}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: ORO, fontSize: '7px', fontWeight: 900 }}>{s}</span>
                      </div>
                    ))}
                    <span style={{ color: 'rgba(255,255,255,.7)', fontSize: '11.5px', fontWeight: 700, marginLeft: '4px' }}>@golmebol</span>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Descargar */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '18px', flexWrap: 'wrap' }}>
              <button onClick={handleDescargarActual} disabled={descargando}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '600', opacity: descargando ? .7 : 1 }}>
                <Download size={16}/> {descargando ? 'Generando...' : totalPaginas > 1 ? `Descargar página ${paginaActual + 1}` : 'Descargar'}
              </button>
              {totalPaginas > 1 && (
                <button onClick={handleDescargarTodas} disabled={descargando}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #1a73e8', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', color: '#1a73e8', fontSize: '.85rem', fontWeight: '600', opacity: descargando ? .7 : 1 }}>
                  <Download size={16}/> Descargar las {totalPaginas} páginas
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
