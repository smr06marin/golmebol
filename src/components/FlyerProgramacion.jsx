import { useRef, useState, useMemo, useEffect } from 'react'
import { Download, X, ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { descargarFlyer } from '../lib/flyerDescarga'
import { TEMAS_PROGRAMACION } from '../lib/flyerTemas'
import SelectorTemaFlyer from './SelectorTemaFlyer'

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
// Cantidad de partidos por página — mínimo 10 en ambos modos (pedido del
// cliente), calculada para que las tarjetas entren a su tamaño real (ver
// comentario grande sobre flexShrink en FilaPartido) sin que el navegador
// tenga que achicarlas. Para que 10 quepan con letra grande, el encabezado
// y el pie de página se recortaron a lo esencial (ver más abajo).
const POR_PAGINA_CON_TORNEO = 10
const POR_PAGINA_SIN_TORNEO = 10

// Los 5 tonos (oscuro/medio/claro/acento/acentoSuave) ya no son fijos —
// vienen del tema elegido (ver TEMAS_PROGRAMACION en lib/flyerTemas.js) y
// se le pasan como prop `paleta` a los sub-componentes de abajo, que antes
// los usaban directo de estas constantes.

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
function EscudoCirculo({ logo_url, size = 40, paleta }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff', border: `2px solid ${paleta.acento}`, boxShadow: '0 2px 5px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {logo_url
        ? <img src={logo_url} crossOrigin="anonymous" style={{ width: '82%', height: '82%', objectFit: 'contain' }}/>
        : <Trophy size={size * 0.42} color="#b0862a"/>}
    </div>
  )
}

// Ancho fijo del nombre de cada equipo — ya no se trunca con "...": si el
// nombre completo no entra en una sola línea, se envuelve a una segunda
// línea (en vez de recortarlo o achicar la letra). El ancho es FIJO (no
// maxWidth) a propósito: así el escudo queda siempre a la misma distancia
// del centro sin importar qué tan largo sea el nombre de cada equipo,
// alineando visualmente todos los escudos de la página en una columna.
const NOMBRE_MAXW = 138

function NombreEquipo({ nombre, align }) {
  return (
    <span style={{
      color: '#fff', fontWeight: 900, fontSize: '14.5px', textTransform: 'uppercase',
      textAlign: align, lineHeight: 1.14, wordBreak: 'break-word',
      width: `${NOMBRE_MAXW}px`, flexShrink: 0,
      // Tope de 2 líneas por las dudas (nombre absurdamente largo) — dentro
      // de ese tope nunca se corta, solo se envuelve.
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      textShadow: '0 1px 3px rgba(0,0,0,.6)',
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
function FilaPartido({ p, mostrarTorneo, paleta }) {
  const esJugado = p.status === 'finished'
  const fechaObj = p.played_at ? new Date(p.played_at) : null
  const marcador = esJugado ? `${p.home_score}-${p.away_score}` : null
  const centro = marcador || (fechaObj ? formatHora(fechaObj) : 'VS')
  const infoCancha = [p.location, fechaObj && formatFechaCorta(fechaObj)].filter(Boolean).join('  ·  ')

  return (
    <div style={{ flexShrink: 0, margin: '0 18px' }}>
      {/* Antes el fondo de la tarjeta era un negro muy transparente
          (rgba(0,0,0,.22)) que, sobre todo en los temas de color oscuro (ej.
          "Negro"), se perdía casi por completo contra el fondo del flyer —
          quedaba todo del mismo tono y quedaban "pegados" los partidos y el
          fondo. Ahora es bastante más opaco (así siempre se distingue, sea
          cual sea el tema) y además lleva un borde fino del color de acento
          de cada tema (que siempre contrasta fuerte contra el fondo), para
          que cada tarjeta se note como un bloque propio y no se confunda
          con el fondo ni con la tarjeta de al lado. */}
      <div style={{ background: 'rgba(0,0,0,.55)', border: `1px solid ${paleta.acento}55`, boxShadow: '0 2px 8px rgba(0,0,0,.35)', borderRadius: '9px', overflow: 'hidden' }}>
        {/* Zona 1 (dorada): de qué torneo es — solo en el flyer "todos los torneos" */}
        {mostrarTorneo && p.tournaments?.name && (
          <div style={{ textAlign: 'center', background: paleta.acento, padding: '2px 8px' }}>
            <span style={{ color: paleta.oscuro, fontSize: '11px', fontWeight: 900, letterSpacing: '.2px', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.tournaments.name}
            </span>
          </div>
        )}
        {/* Zona 2 (oscura): el partido — escudos, nombres, hora o marcador.
            height FIJO (la tarjeta no crece): a 14.5px con 2 líneas el nombre
            mide ~33px de alto, que entra sobrado en los 50px de la fila. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '50px', padding: '0 10px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '7px' }}>
            <NombreEquipo nombre={p.home?.name} align="right"/>
            <EscudoCirculo logo_url={p.home?.logo_url} size={34} paleta={paleta}/>
          </div>
          <div style={{ flexShrink: 0, width: '58px', textAlign: 'center' }}>
            <span style={{ color: paleta.acento, fontWeight: 900, fontSize: marcador ? '18px' : '14px', letterSpacing: marcador ? '.5px' : '.3px' }}>{centro}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
            <EscudoCirculo logo_url={p.away?.logo_url} size={34} paleta={paleta}/>
            <NombreEquipo nombre={p.away?.name} align="left"/>
          </div>
        </div>
        {/* Zona 3 (clara): cancha y fecha (la hora ya se ve arriba, en el
            centro, así que no se repite acá) */}
        <div style={{ textAlign: 'center', background: 'rgba(243,212,122,.16)', padding: '2px 8px' }}>
          {/* whiteSpace:nowrap + ellipsis, igual que la zona del torneo arriba:
              si la cancha tiene un nombre largo, esta línea NO puede
              envolverse a una segunda línea — cada tarjeta debe medir
              siempre la misma altura fija, porque "porPagina" (arriba) está
              calculado asumiendo eso. Si se dejaba envolver, la última
              tarjeta de la página quedaba más alta de lo previsto y el
              overflow:hidden del lienzo la cortaba (reportado con "El Club
              de los Amigos" / "Complejo Deportivo El Gol"). */}
          <span style={{ color: paleta.acentoSuave, fontSize: '11px', fontWeight: 900, letterSpacing: '.2px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {infoCancha || 'Por confirmar'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Banda decorativa tipo "chevron" (rayas diagonales) — el mismo motivo que
// usa el flyer de referencia arriba y abajo del todo.
function BandaChevron({ arriba, paleta }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, height: '9px', zIndex: 1,
      [arriba ? 'top' : 'bottom']: 0,
      background: `repeating-linear-gradient(135deg, ${paleta.acento} 0px, ${paleta.acento} 7px, ${paleta.oscuro} 7px, ${paleta.oscuro} 14px)`,
    }}/>
  )
}

// Clave de agrupación por día, a partir de la fecha/hora REAL del partido
// (no de un string formateado) — así nunca depende del idioma ni del
// formato de muestra. Siempre son dígitos (YYYY-MM-DD), que ordenan bien
// como texto, salvo "sin-fecha" para los partidos que todavía no tienen
// fecha puesta — como empieza con una letra, ordena solo DESPUÉS de
// cualquier fecha real (comparación de texto plana, sin lógica aparte).
function diaKeyDe(p) {
  if (!p.played_at) return 'sin-fecha'
  const d = new Date(p.played_at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FlyerProgramacion({ torneo, equipos, partidos, canchas = [], onClose }) {
  const flyerRef = useRef(null)
  const wrapperRef = useRef(null)
  const [escalaPreview, setEscalaPreview] = useState(1)
  const [descargando, setDescargando] = useState(false)
  const [temaId, setTemaId] = useState(TEMAS_PROGRAMACION[0].id)
  const paleta = TEMAS_PROGRAMACION.find(t => t.id === temaId) || TEMAS_PROGRAMACION[0]
  const [modo, setModo] = useState(() => {
    const hayProximos = partidos.some(p => p.status !== 'finished')
    return hayProximos ? 'proximos' : 'jugados'
  })
  const [pagina, setPagina] = useState(0)

  // Filtros de día / escenario / cancha — para armar un flyer de SOLO esa
  // combinación (ej. "el sábado, en Centegol, cancha 2") en vez de uno con
  // TODOS los partidos mezclados, que es lo que se estaba "enredando"
  // cuando hay varias canchas o varios escenarios jugando el mismo torneo.
  // Son en CASCADA: cambiar el día resetea escenario y cancha (las
  // opciones de abajo dependen de lo elegido arriba), para no quedar con
  // una combinación que ya no tiene ningún partido.
  const [filtroDia, setFiltroDia] = useState('todos')
  const [filtroEscenario, setFiltroEscenario] = useState('todos')
  const [filtroCancha, setFiltroCancha] = useState('todos')

  // El filtro de ESCENARIO solo tiene sentido si nos pasaron la lista de
  // canchas del torneo (con su campo "escenario") — eso solo está
  // disponible cuando el flyer se pide desde el detalle de UN torneo. Desde
  // el calendario general (que puede juntar partidos de varios torneos) no
  // se manda, y ahí el flyer igual permite filtrar por día y por cancha
  // (usando el nombre de cancha tal cual quedó guardado en el partido).
  const hayEscenarios = canchas.length > 0
  const canchaPorNombre = useMemo(() => new Map(canchas.filter(c => c.nombre).map(c => [c.nombre, c])), [canchas])
  function escenarioDe(p) {
    if (!p.location) return 'Sin sede'
    return canchaPorNombre.get(p.location)?.escenario || 'Sin sede'
  }

  function cambiarModo(m) { setModo(m); setFiltroDia('todos'); setFiltroEscenario('todos'); setFiltroCancha('todos'); setPagina(0) }
  function cambiarDia(v) { setFiltroDia(v); setFiltroEscenario('todos'); setFiltroCancha('todos'); setPagina(0) }
  function cambiarEscenario(v) { setFiltroEscenario(v); setFiltroCancha('todos'); setPagina(0) }
  function cambiarCancha(v) { setFiltroCancha(v); setPagina(0) }

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
  // domingo — sin importar de qué torneo sea cada uno. Los filtros de
  // día/escenario/cancha de abajo se aplican DESPUÉS, en cascada, sobre
  // esa misma lista ya ordenada — así el orden final no cambia, solo se
  // va recortando la lista.
  const porModo = useMemo(() => ordenarPartidos(partidos, modo), [partidos, modo])

  const diasOpciones = useMemo(() => {
    const mapa = new Map()
    porModo.forEach(p => {
      const key = diaKeyDe(p)
      if (!mapa.has(key)) mapa.set(key, key === 'sin-fecha' ? 'Sin fecha' : formatFechaCorta(new Date(p.played_at)))
    })
    return Array.from(mapa.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  }, [porModo])
  const partidosDelDia = useMemo(() => filtroDia === 'todos' ? porModo : porModo.filter(p => diaKeyDe(p) === filtroDia), [porModo, filtroDia])

  const escenariosOpciones = useMemo(() => {
    if (!hayEscenarios) return []
    const set = new Set(partidosDelDia.map(escenarioDe))
    return Array.from(set).sort((a, b) => a === 'Sin sede' ? 1 : b === 'Sin sede' ? -1 : a.localeCompare(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidosDelDia, hayEscenarios, canchaPorNombre])
  const partidosDelEscenario = useMemo(() => {
    if (!hayEscenarios || filtroEscenario === 'todos') return partidosDelDia
    return partidosDelDia.filter(p => escenarioDe(p) === filtroEscenario)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidosDelDia, filtroEscenario, hayEscenarios, canchaPorNombre])

  const canchasOpciones = useMemo(() => {
    const set = new Set(partidosDelEscenario.map(p => p.location || 'Sin cancha'))
    return Array.from(set).sort((a, b) => a === 'Sin cancha' ? 1 : b === 'Sin cancha' ? -1 : a.localeCompare(b))
  }, [partidosDelEscenario])
  const ordenados = useMemo(() => {
    if (filtroCancha === 'todos') return partidosDelEscenario
    return partidosDelEscenario.filter(p => (p.location || 'Sin cancha') === filtroCancha)
  }, [partidosDelEscenario, filtroCancha])

  const paginas = useMemo(() => trocear(ordenados, porPagina), [ordenados, porPagina])
  const totalPaginas = paginas.length
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const items = paginas[paginaActual] || []

  // Para mostrar en el flyer QUÉ recorte es (ej. "SÁB 20 SEP · CENTEGOL ·
  // CANCHA 2"), cuando el organizador filtró a algo puntual — así el
  // afiche mismo deja claro a qué partidos corresponde.
  const filtroTxt = [
    filtroDia !== 'todos' ? (diasOpciones.find(([k]) => k === filtroDia)?.[1]) : null,
    hayEscenarios && filtroEscenario !== 'todos' ? filtroEscenario : null,
    filtroCancha !== 'todos' ? filtroCancha : null,
  ].filter(Boolean).join(' · ')

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
    // Poppins (peso 900, "Black") se carga async desde Google Fonts
    // (index.html) — si html2canvas captura antes de que termine de
    // cargar, el texto sale con la tipografía de respaldo (Arial/Impact)
    // en vez de Poppins. descargarFlyer ya espera imágenes + fuentes antes
    // de capturar, y en el celular manda el PNG a la hoja de compartir
    // nativa para que quede guardado en la Galería (no en Descargas).
    const base = (torneo?.name || 'golmebol').replace(/\s+/g, '_')
    const tipo = modo === 'jugados' ? 'resultados' : 'programacion'
    // scale:2 sobre un lienzo de 540x960 = 1080x1920 exactos (historia de Instagram).
    await descargarFlyer(flyerRef.current, {
      filename: totalPaginas > 1 ? `${base}_${tipo}_pag${idx + 1}de${totalPaginas}.png` : `${base}_${tipo}.png`,
      opcionesCanvas: { scale: 2, backgroundColor: paleta.oscuro, width: ANCHO, height: ALTO },
      shareTitle: torneo?.name,
    })
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

        <SelectorTemaFlyer temas={TEMAS_PROGRAMACION} temaId={temaId} onElegir={setTemaId} />

        {/* Toggle próximos / jugados */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {['proximos', 'jugados'].map(m => (
            <button key={m} onClick={() => cambiarModo(m)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '.82rem', fontWeight: '600', background: modo === m ? '#1a73e8' : '#fff', color: modo === m ? '#fff' : '#5f6368', border: modo === m ? 'none' : '1px solid #dadce0' }}>
              {m === 'proximos' ? 'Próximos partidos' : 'Partidos jugados'}
            </button>
          ))}
        </div>

        {/* Filtros de día / escenario / cancha — para armar un flyer de SOLO
            esa combinación en vez de uno con todo mezclado. En cascada: las
            opciones de escenario dependen del día elegido, y las de cancha
            dependen del día + escenario elegidos. */}
        {partidos.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <select value={filtroDia} onChange={e => cambiarDia(e.target.value)}
              style={{ flex: '1 1 130px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '.8rem', fontWeight: '600', color: '#5f6368', background: '#fff', cursor: 'pointer' }}>
              <option value="todos">Todos los días</option>
              {diasOpciones.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            {hayEscenarios && (
              <select value={filtroEscenario} onChange={e => cambiarEscenario(e.target.value)}
                style={{ flex: '1 1 130px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '.8rem', fontWeight: '600', color: '#5f6368', background: '#fff', cursor: 'pointer' }}>
                <option value="todos">Todos los escenarios</option>
                {escenariosOpciones.map(esc => <option key={esc} value={esc}>{esc}</option>)}
              </select>
            )}
            <select value={filtroCancha} onChange={e => cambiarCancha(e.target.value)}
              style={{ flex: '1 1 130px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '.8rem', fontWeight: '600', color: '#5f6368', background: '#fff', cursor: 'pointer' }}>
              <option value="todos">Todas las canchas</option>
              {canchasOpciones.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', background: '#f8f9fa', borderRadius: '12px' }}>
            No hay {modo === 'jugados' ? 'partidos jugados' : 'próximos partidos'} para mostrar{filtroTxt ? ` con ese filtro (${filtroTxt})` : ''}.
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
              fontFamily: "'Poppins', 'Arial Black', 'Impact', sans-serif",
              background: `radial-gradient(ellipse at 50% 15%, ${paleta.claro} 0%, ${paleta.medio} 42%, ${paleta.oscuro} 100%)`,
            }}>
              {/* Textura diagonal sutil de fondo */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: .5, background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0px, rgba(255,255,255,.045) 16px, transparent 16px, transparent 32px)' }}/>

              <BandaChevron arriba paleta={paleta}/>
              <BandaChevron paleta={paleta}/>

              <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header — solo cuando el flyer es de UN torneo (torneo
                    viene con nombre). Cuando junta partidos de varios
                    torneos no hay título ni escudo: va directo a la lista
                    de partidos, cada uno con su propio torneo. */}
                {sinEncabezado ? (
                  <div style={{ flexShrink: 0, height: '10px' }}/>
                ) : (
                  <div style={{ flexShrink: 0, textAlign: 'center', padding: '16px 24px 8px' }}>
                    <div style={{ width: '52px', height: '52px', margin: '0 auto', borderRadius: '50%', background: '#fff', border: `2px solid ${paleta.acento}`, boxShadow: '0 3px 10px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {torneo?.logo_url
                        ? <img src={torneo.logo_url} crossOrigin="anonymous" style={{ width: '84%', height: '84%', objectFit: 'contain' }}/>
                        : <Trophy size={22} color={paleta.medio}/>}
                    </div>
                    <div style={{ color: paleta.acento, fontSize: '11px', fontWeight: 900, letterSpacing: '2.5px', marginTop: '5px' }}>GOLMEBOL</div>
                    <div style={{ color: '#fff', fontSize: '28px', fontWeight: 900, letterSpacing: '.2px', textTransform: 'uppercase', lineHeight: 1.08, marginTop: '3px', textShadow: '0 2px 8px rgba(0,0,0,.5)' }}>
                      {torneo.name}
                    </div>
                    {subtitulo && (
                      <div style={{ color: paleta.acentoSuave, fontSize: '10px', fontWeight: 900, letterSpacing: '1px', marginTop: '3px', textTransform: 'uppercase' }}>
                        {subtitulo}
                      </div>
                    )}
                    <div style={{ display: 'inline-block', border: `1.5px solid ${paleta.acento}`, borderRadius: '16px', padding: '2px 14px', marginTop: '7px' }}>
                      <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900, letterSpacing: '1.2px' }}>{titulo}</span>
                    </div>
                    {/* Si se filtró a un día/escenario/cancha puntual, el
                        afiche mismo lo deja claro (ej. "SÁB 20 SEP ·
                        CENTEGOL · CANCHA 2") en vez de mostrar solo "PRÓXIMOS
                        PARTIDOS" sin aclarar a qué recorte corresponde. */}
                    {filtroTxt && (
                      <div style={{ color: '#fff', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.3px', marginTop: '6px', textTransform: 'uppercase', opacity: .92 }}>
                        {filtroTxt}
                      </div>
                    )}
                  </div>
                )}

                {/* Partidos — la separación entre tarjetas es SIEMPRE la misma
                    (gap fijo), sin importar cuántos partidos traiga la
                    página: antes era "justify-content: space-evenly", que
                    repartía TODO el espacio libre entre las tarjetas, así
                    que con pocos partidos (ej. 2 o 3) quedaban separadas por
                    un hueco enorme y con muchos quedaban pegadas — ahora el
                    grupo entero se centra con "justify-content: center" y la
                    distancia entre tarjetas vecinas no cambia nunca. */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '9px', padding: '2px 0' }}>
                  {items.map(p => <FilaPartido key={p.id} p={p} mostrarTorneo={sinEncabezado} paleta={paleta}/>)}
                </div>

                {/* Marca de agua — antes era una línea de texto centrada
                    ("golmebol.com") que a veces tapaba la última tarjeta;
                    ahora es solo el logo chico, pegado a la derecha, para
                    que no estorbe la información de los partidos. */}
                <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '4px 18px 8px' }}>
                  <img src="/marca/watermark-logo.png" alt="" style={{ height: '20px', width: 'auto', opacity: .8 }}/>
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
