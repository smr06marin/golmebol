import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { derivarEnVivo, extraerGoles, duracionPeriodo, derivarColoresUniforme, derivarFaltasYTarjetas, buscarPartidoHermano, marcadorGlobal, partidoActivoDeStream } from '../lib/liveMatch'
import { tablasConVivo, gruposConVivo } from '../lib/torneoTablas'
import { useTablasBase } from '../lib/useTablasBase'
import { useLogosTorneos } from '../lib/useLogosTorneos'
import MarcadorEnVivoOverlay from '../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../components/GolesEnVivoOverlay'
import GolAvisoEnVivoOverlay from '../components/GolAvisoEnVivoOverlay'
import TablaEnVivoOverlay from '../components/TablaEnVivoOverlay'
import { overlayTapaMarcador, propsAvisoGol } from '../components/enVivoUI'
import JugadoresEnVivoOverlay from '../components/JugadoresEnVivoOverlay'
import PatrocinadorEnVivoOverlay from '../components/PatrocinadorEnVivoOverlay'
import RepeticionTransmisionOverlay from '../components/RepeticionTransmisionOverlay'
import { detectarPlataforma, parseYouTubeId } from '../components/LiveEmbed'
import { disparoDeControl, disparoEsExclusivo, patrocinadorDeDisparo, patrocinadoresDeControl } from '../lib/patrocinadorDisparo'
import PatrocinadoresTorneoOverlay from '../components/PatrocinadoresTorneoOverlay'
import MarcaTransmision from '../components/MarcaTransmision'
import ResumenGolesOverlay from '../components/ResumenGolesOverlay'
import IntermedioDescansoOverlay from '../components/IntermedioDescansoOverlay'
import TablaDescansoOverlay from '../components/TablaDescansoOverlay'
import ProximosPartidosOverlay from '../components/ProximosPartidosOverlay'
import MvpPartidoOverlay, { DURACION_MVP_MS } from '../components/MvpPartidoOverlay'

// Página de overlay para OBS (u otro programa de transmisión): dibuja SOLO
// los gráficos de Golmebol (marcador, goles, tabla, nómina, publicidad,
// logos de patrocinador) sobre un fondo TRANSPARENTE, sin video y sin nada
// más de la app. En OBS se agrega como "Fuente de navegador" con la URL
//   https://golmebol.com/overlay/<id-de-la-transmision>
// a 1920x1080, encima de la cámara — y OBS manda el resultado a YouTube, así
// que la gente ve los gráficos DENTRO del video de YouTube.
//
// Los datos son los mismos que usa la portada (golmebol.com): el partido
// activo sale de la planilla del árbitro en tiempo real y los botones del
// panel de control (/en-vivo-control/... o /admin/config-sitio) prenden y
// apagan la tabla, los goles, la nómina y la publicidad igual que allá. Los
// gráficos se dibujan en un "escenario" de 860px de ancho (lo mismo que mide
// el video en la portada en un computador) y se escala todo junto al tamaño
// real de la ventana, así se ven idénticos a como se ven en la portada.
//
// REPETICIÓN (casilla "Repetición dentro de la transmisión" de la transmisión en /admin/config-sitio, o ?repeticion=1): el botón "Repetición" del panel de
// control hace que acá se abra, escondida, la propia transmisión de YouTube,
// se devuelva ~12 s y se muestre a pantalla completa con el letrero
// REPETICIÓN (ver RepeticionTransmisionOverlay). Necesita DVR activado en
// YouTube. Sin la casilla ni ?repeticion=1 no pasa nada (en OBS de escritorio se puede
// seguir usando su propio "Búfer de repetición").
//
// Parámetros opcionales en la URL:
//   ?prueba=1  fondo de cancha de mentiras, para verlo en un navegador normal
//   ?logo=0    sin la marca de arriba a la izquierda (logo de Golmebol + logo del torneo + "Esta transmisión es gracias a Golmebol")
//   ?repeticion=1  activa la repetición dentro de la transmisión aunque la casilla no esté marcada (?repeticion=0 la apaga)
//   ?debug=1  muestra en pantalla un diagnóstico de la repetición (qué está pasando y por qué se cancela)
//   ?velocidad=0.7  velocidad de la repetición (por defecto 0.7; la "Cámara lenta" va siempre a 0.5)
//   ?atras=12  segundos que dura la repetición (por defecto 12)
//   ?espera=8  segundos que espera antes de arrancarla, por el retraso de YouTube (por defecto 8)
//   ?auto=0    sin los gráficos automáticos (alineación al abrir la planilla; goles y tabla en el descanso y al finalizar)

const ANCHO_ESCENARIO = 860
// Cuánto dura en pantalla la alineación automática: 2 minutos
const DURACION_AUTO_MS = 120000
// Cuánto dura el tablero grande de goles y la tabla de posiciones (descanso y final): 1 minuto cada uno
const DURACION_TABLERO_MS = 60000

// MVP que el árbitro escogió al cerrar la planilla (tournament_logros, tipo 'mvp'): su foto, nombre, equipo y goles.
// Devuelve null si todavía no hay MVP guardado (o no escogieron uno).
async function buscarMvp(partidoId, m, colores) {
  const { data: logro } = await supabase.from('tournament_logros').select('player_id').eq('match_id', partidoId).eq('tipo', 'mvp').limit(1).maybeSingle()
  if (!logro?.player_id) return null
  const [jug, st, ev] = await Promise.all([
    supabase.from('players_publico').select('id, name, photo_url, photo_face_url').eq('id', logro.player_id).maybeSingle(),
    supabase.from('player_match_stats').select('team_id').eq('match_id', partidoId).eq('player_id', logro.player_id).maybeSingle(),
    supabase.from('match_events').select('team_id, event_type').eq('match_id', partidoId).eq('player_id', logro.player_id),
  ])
  const nombre = jug.data?.name
  if (!nombre) return null
  const eventos = ev.data || []
  const teamId = st.data?.team_id || (eventos.find(e => e.team_id) || {}).team_id || null
  const local = teamId ? teamId === m.home_team_id : null
  const equipo = local === null ? null : (local ? m.home : m.away)
  return {
    nombre,
    foto: jug.data?.photo_face_url || jug.data?.photo_url || null,
    equipo: equipo?.name || null,
    escudo: equipo?.logo_url || null,
    color: local === null ? null : ((local ? colores?.colorLocal : colores?.colorVisitante) || null),
    goles: eventos.filter(e => e.event_type === 'goal').length,
  }
}

function useEscala() {
  const [medidas, setMedidas] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setMedidas({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const escala = medidas.w / ANCHO_ESCENARIO
  return { escala, altoEscenario: medidas.h / escala }
}

// Partidos que siguen DESPUÉS del que está en descanso: mismo torneo, misma cancha (si el partido tiene),
// ese mismo día, todavía sin jugar. Ordenados por hora. Si no hay ninguno devuelve [].
async function cargarProximos(partidoId) {
  try {
    const { data: actual } = await supabase.from('matches').select('id, tournament_id, cancha_id, played_at').eq('id', partidoId).maybeSingle()
    if (!actual?.tournament_id || !actual.played_at) return []
    const desde = new Date(actual.played_at)
    const finDia = new Date(desde)
    finDia.setHours(23, 59, 59, 999)
    let q = supabase.from('matches')
      .select('id, status, fase, matchday, played_at, cancha_id, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .eq('tournament_id', actual.tournament_id).eq('status', 'scheduled')
      .gt('played_at', desde.toISOString()).lte('played_at', finDia.toISOString())
      .order('played_at', { ascending: true })
    if (actual.cancha_id) q = q.eq('cancha_id', actual.cancha_id)
    const { data } = await q
    return (data || []).filter(m => m.id !== partidoId && m.home && m.away)
  } catch { return [] }
}

export default function OverlayEnVivoPage() {
  const { streamId } = useParams()
  const [params] = useSearchParams()
  const modoPrueba = params.get('prueba') === '1'
  const mostrarLogo = params.get('logo') !== '0'
  const graficosAuto = params.get('auto') !== '0'
  const repeticionParam = params.get('repeticion')
  const modoDebug = params.get('debug') === '1'
  const velocidadRepeticion = Math.min(1, Math.max(0.25, Number(params.get('velocidad')) || 0.7))
  const segundosAtras = Math.min(60, Math.max(3, Number(params.get('atras')) || 12))
  const segundosEspera = Math.min(30, Math.max(0, params.get('espera') === null ? 8 : (Number(params.get('espera')) || 0)))
  const { escala, altoEscenario } = useEscala()

  const [siteConfig, setSiteConfig] = useState(null)
  const [matchesVivoRaw, setMatchesVivoRaw] = useState([])
  const [hermanosVivo, setHermanosVivo] = useState([])
  const [patrocinadorMostrando, setPatrocinadorMostrando] = useState(null)
  const [repeticionDisparo, setRepeticionDisparo] = useState(null)
  const [logRepeticion, setLogRepeticion] = useState([])
  const repeticionVistaRef = useRef(null)
  const repeticionContadorRef = useRef(0)
  const [tick, setTick] = useState(0)
  const patrocinadorVistoRef = useRef(null)

  // Transparente de verdad: la app le pone fondo oscuro a html/body/#root, y
  // OBS solo deja ver el video de abajo si la página no pinta nada. También
  // se esconden las cosas globales de la app que no deben salir en el video
  // (marca de agua "Creada por GOLMEBOL", aviso de versión nueva).
  useEffect(() => {
    document.body.classList.add('gm-overlay-obs')
    document.documentElement.classList.add('gm-overlay-obs')
    return () => {
      document.body.classList.remove('gm-overlay-obs')
      document.documentElement.classList.remove('gm-overlay-obs')
    }
  }, [])

  async function fetchSiteConfig() {
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams, en_vivo_repeticion_imagenes, en_vivo_control, patrocinador_logos_torneo').eq('id', true).maybeSingle()
    if (error) return
    setSiteConfig(data || null)
  }

  async function fetchPartidosVivo() {
    const { data, error } = await supabase.from('matches')
      .select('id, tournament_id, matchday, fase, status, cancha_id, home_team_id, away_team_id, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, modalidad, logo_url)')
      .eq('status', 'scheduled')
      .or('live_state.not.is.null,live_state_rapida.not.is.null')
    if (error) return
    setMatchesVivoRaw(data || [])
  }

  useEffect(() => {
    fetchSiteConfig(); fetchPartidosVivo()
    const tReloj = setInterval(() => setTick(x => x + 1), 1000)
    const tConfig = setInterval(fetchSiteConfig, 3000)
    const tPartidos = setInterval(fetchPartidosVivo, 5000)
    const canal = supabase.channel(`overlay-obs-${streamId}`)
    let tc = null, tp = null
    canal
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_config' }, () => { clearTimeout(tc); tc = setTimeout(fetchSiteConfig, 200) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => { clearTimeout(tp); tp = setTimeout(fetchPartidosVivo, 300) })
      .subscribe()
    return () => {
      clearInterval(tReloj); clearInterval(tConfig); clearInterval(tPartidos)
      clearTimeout(tc); clearTimeout(tp)
      supabase.removeChannel(canal)
    }
  }, [streamId])

  // Ida y vuelta: mismo cálculo que la portada, para el "Global" del marcador.
  useEffect(() => {
    const pares = [...new Set(matchesVivoRaw.filter(m => m.fase && m.fase !== 'grupo').map(m => `${m.tournament_id}|${m.fase}`))]
    if (!pares.length) { setHermanosVivo([]); return }
    Promise.all(pares.map(par => {
      const [tid, fase] = par.split('|')
      return supabase.from('matches').select('id, tournament_id, fase, home_team_id, away_team_id, home_score, away_score, status').eq('tournament_id', tid).eq('fase', fase).eq('status', 'finished')
    })).then(resultados => setHermanosVivo(resultados.flatMap(r => r.data || [])))
  }, [matchesVivoRaw])

  const partidosVivo = useMemo(() => {
    void tick
    return matchesVivoRaw.map(m => ({ ...m, vivo: derivarEnVivo(m), colores: derivarColoresUniforme(m), detalle: derivarFaltasYTarjetas(m) })).filter(m => m.vivo).map(m => {
      if (!m.fase || m.fase === 'grupo') return m
      const hermano = buscarPartidoHermano(m, hermanosVivo)
      if (!hermano) return m
      return { ...m, hermano, global: marcadorGlobal(m, hermano) }
    })
  }, [matchesVivoRaw, hermanosVivo, tick])

  const stream = useMemo(() => (
    (Array.isArray(siteConfig?.en_vivo_streams) ? siteConfig.en_vivo_streams : []).find(s => String(s.id) === String(streamId)) || null
  ), [siteConfig, streamId])

  const partido = stream ? partidoActivoDeStream(stream, partidosVivo) : null
  const logoDeTorneo = useLogosTorneos(stream?.torneo_auto ? [stream.torneo_auto] : [])
  const control = (siteConfig?.en_vivo_control || {})[streamId] || null
  // Repetición dentro de la transmisión: se prende con la casilla de la transmisión en /admin/config-sitio, o con ?repeticion=1 (y se apaga con ?repeticion=0)
  const repeticionActiva = repeticionParam === '1' || (repeticionParam !== '0' && !!stream?.repeticion_transmision)

  // Gráficos AUTOMÁTICOS (para transmitir sin nadie operando el panel):
  //  · al abrir el árbitro la planilla (antes de iniciar el reloj): la
  //    alineación de los dos equipos, hasta 2 min; si el árbitro toca
  //    "Iniciar" antes, se quita;
  //  · en el descanso: primero el tablero grande de goles (con quién hizo cada
  //    gol) 1 min; después la tabla de posiciones (2 min por cada 10 equipos,
  //    cada grupo por separado si el torneo tiene grupos, ver
  //    TablaDescansoOverlay); luego los próximos partidos de esa cancha, 1 min
  //    cada uno (si ya no quedan, no sale); y, si la
  //    transmisión tiene jugadas o videos de patrocinadores subidos, estos
  //    hasta que arranque el 2.º tiempo: jugada (2 veces) → patrocinador →
  //    jugada (2 veces) → otro patrocinador… (ver IntermedioDescansoOverlay);
  //  · al finalizar (el árbitro cierra la planilla y la transmisión sigue): el
  //    tablero grande con el resultado 1 min, y después la tabla de
  //    posiciones otro minuto.
  // Cada uno sale UNA vez por partido. Si el panel de control prende algo a
  // mano, eso manda. Al abrir la página con el partido ya iniciado no sale la
  // alineación.
  const [autoOverlay, setAutoOverlay] = useState(null)
  const [partidoFinal, setPartidoFinal] = useState(null)
  const [mvpFinal, setMvpFinal] = useState(null)
  // Torneo de la tabla automática (descanso / final); en el final ya no hay partido en vivo del cual sacarlo
  const [torneoAuto, setTorneoAuto] = useState(null)
  // Próximos partidos de la misma cancha ese día (se buscan al empezar el descanso)
  const [proximos, setProximos] = useState([])
  const autoRef = useRef({ partidoId: null, inicioHecho: false, descansoHecho: false, timers: [], finalesHechos: new Set(), desmontado: false })
  const ultimoPartidoRef = useRef(null)
  const idAnteriorRef = useRef(null)
  const vivoP = partido?.vivo || null
  const partidoIdAuto = partido?.id || null
  const segsReloj = vivoP ? (() => { const [m, sg] = String(vivoP.reloj || '0:00').split(':'); return (parseInt(m, 10) || 0) * 60 + (parseInt(sg, 10) || 0) })() : 0
  const descansoAuto = !!vivoP?.descanso
  const periodoAuto = vivoP?.periodo || 1
  const hayVivoAuto = !!vivoP
  // 2.º tiempo con el reloj corriendo: el árbitro ya arrancó el partido otra vez,
  // así que NO debe verse ningún gráfico automático (ni quedar programado).
  const segundoTiempoCorriendo = periodoAuto === 2 && !!vivoP?.corriendo
  // Ya tocaron "2.º tiempo" pero todavía no inician el reloj: los gráficos del
  // descanso se quedan en pantalla esperando hasta que el reloj arranque.
  const esperandoSegundoTiempo = periodoAuto === 2 && !vivoP?.corriendo && segsReloj === 0
  // El árbitro ya inició el partido (reloj corriendo o con tiempo): la alineación se quita
  const partidoYaInicio = periodoAuto > 1 || segsReloj > 0 || !!vivoP?.corriendo
  // ¿Hay jugadas o videos de patrocinadores para pasar en el descanso?
  const hayIntermedio = (Array.isArray(control?.jugadas) ? control.jugadas : []).some(j => j?.url) || patrocinadoresDeControl(control).some(p => p.video_url)

  // Muestra un gráfico automático `cual` después de `retrasoMs` y lo quita a
  // los `duracionMs` (solo si sigue siendo ese el que está en pantalla).
  function programarAuto(cual, retrasoMs, duracionMs) {
    const a = autoRef.current
    a.timers.push(setTimeout(() => setAutoOverlay(cual), retrasoMs))
    a.timers.push(setTimeout(() => setAutoOverlay(act => (act === cual ? null : act)), retrasoMs + duracionMs))
  }

  // Qué sigue cuando termina una pantalla del descanso: tabla → próximos partidos (si hay) → jugadas y patrocinadores (si hay)
  const proximosRef = useRef([])
  const hayIntermedioRef = useRef(false)
  useEffect(() => { proximosRef.current = proximos; hayIntermedioRef.current = hayIntermedio })
  function siguienteDelDescanso(actual) {
    const hayProx = actual === 'tabla_descanso' && proximosRef.current.length > 0
    const sig = hayProx ? 'proximos' : (hayIntermedioRef.current ? 'intermedio' : null)
    setAutoOverlay(act => (act === actual ? sig : act))
  }

  useEffect(() => {
    if (!graficosAuto || !partidoIdAuto || !hayVivoAuto) return
    const a = autoRef.current
    if (a.partidoId !== partidoIdAuto) { a.partidoId = partidoIdAuto; a.inicioHecho = false; a.descansoHecho = false }
    // Si el árbitro olvidó tocar "Ir al descanso" y recién al iniciar el 2.º
    // tiempo lo hace (o toca descanso e inicia de una), se cancela todo lo
    // automático que estuviera programado o en pantalla y no sale nada más.
    if (segundoTiempoCorriendo) {
      a.inicioHecho = true; a.descansoHecho = true
      a.timers.forEach(clearTimeout); a.timers = []
      setTimeout(() => setAutoOverlay(null), 0)
      return
    }
    if (!a.inicioHecho && periodoAuto === 1 && !descansoAuto) {
      a.inicioHecho = true
      // Planilla abierta y el reloj todavía sin iniciar: sale la alineación. Si la
      // página se abre con el partido ya iniciado, no sale.
      if (!partidoYaInicio) programarAuto('jugadores', 0, DURACION_AUTO_MS)
    } else if (descansoAuto && !a.descansoHecho) {
      a.descansoHecho = true
      const tid = partido?.tournament_id || null
      a.timers.push(setTimeout(() => setTorneoAuto(tid), 0))
      programarAuto('resumen', 0, DURACION_TABLERO_MS)
      // Tabla (dura según los equipos), próximos partidos y jugadas/patrocinadores van encadenados:
      // cada uno avisa cuando termina (ver siguienteDelDescanso).
      a.timers.push(setTimeout(() => setAutoOverlay('tabla_descanso'), DURACION_TABLERO_MS))
      cargarProximos(partidoIdAuto).then(l => { if (!a.desmontado) setProximos(l) })
    }
  }, [graficosAuto, partidoIdAuto, hayVivoAuto, periodoAuto, descansoAuto, segsReloj, segundoTiempoCorriendo, partidoYaInicio]) // eslint-disable-line react-hooks/exhaustive-deps

  // Guarda el último partido que se vio en vivo (para saber sus colores de
  // uniforme cuando ya no esté en vivo).
  useEffect(() => { if (partido) ultimoPartidoRef.current = partido }, [partido])

  // FINAL: cuando el partido que estaba en vivo deja de estarlo, se consulta si
  // el árbitro lo cerró (status 'finished'). Si fue solo una pausa/suspensión,
  // no pasa nada. Los goles salen de match_events (al cerrar la planilla se
  // borra el estado en vivo, y los goles quedan guardados ahí).
  useEffect(() => {
    const previo = idAnteriorRef.current
    idAnteriorRef.current = partidoIdAuto
    if (!graficosAuto || !previo || previo === partidoIdAuto) return
    const a = autoRef.current
    if (a.finalesHechos.has(previo)) return
    const base = ultimoPartidoRef.current?.id === previo ? ultimoPartidoRef.current : null
    let intentos = 0
    async function revisar() {
      if (a.desmontado || a.finalesHechos.has(previo)) return
      intentos++
      const { data: m } = await supabase.from('matches')
        .select('id, status, tournament_id, home_team_id, home_score, away_score, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, logo_url)')
        .eq('id', previo).maybeSingle()
      if (a.desmontado) return
      if (m?.status === 'finished') {
        a.finalesHechos.add(previo)
        const [ev, st] = await Promise.all([
          supabase.from('match_events').select('*, players!player_id(name)').eq('match_id', previo).eq('event_type', 'goal'),
          supabase.from('player_match_stats').select('player_id, numero_camiseta').eq('match_id', previo),
        ])
        if (a.desmontado) return
        const numeros = new Map((st.data || []).map(r => [r.player_id, r.numero_camiseta]))
        const goles = (ev.data || []).map(e => ({
          equipo: e.team_id === m.home_team_id ? 'local' : 'visitante',
          jugador: e.players?.name || e.player_nombre || 'Jugador',
          numero: String(numeros.get(e.player_id) ?? '').trim(),
          minuto: e.minute || null, periodo: e.periodo || 1, duracion: duracionPeriodo(base),
        })).sort((x, y) => (x.periodo - y.periodo) || ((parseInt(x.minuto) || 0) - (parseInt(y.minuto) || 0)))
        setPartidoFinal({ ...m, colores: base?.colores, goles })
        const tidFinal = m.tournament_id || null
        a.timers.push(setTimeout(() => setTorneoAuto(tidFinal), 0))
        // MVP: apenas se cierra la planilla sale la tarjeta del MVP (12 s) y después el tablero del final y la tabla.
        // El MVP se guarda casi a la vez que el cierre: se intenta 3 veces (0, 1.5 y 3 s) y, si no hay, sigue sin él.
        let mvp = null
        for (let i = 0; i < 3 && !mvp && !a.desmontado; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 1500))
          try { mvp = await buscarMvp(previo, m, base?.colores) } catch { mvp = null }
        }
        if (a.desmontado) return
        const espera = mvp ? DURACION_MVP_MS : 0
        if (mvp) { setMvpFinal(mvp); programarAuto('mvp', 0, DURACION_MVP_MS) }
        programarAuto('final', espera, DURACION_TABLERO_MS)
        programarAuto('tabla', espera + DURACION_TABLERO_MS, DURACION_TABLERO_MS)
        return
      }
      if (intentos < 6) a.timers.push(setTimeout(revisar, 5000))
    }
    a.timers.push(setTimeout(revisar, 1500))
  }, [graficosAuto, partidoIdAuto])

  useEffect(() => {
    const a = autoRef.current
    a.desmontado = false
    return () => { a.desmontado = true; a.timers.forEach(clearTimeout) }
  }, [])

  // El tablero de goles del descanso solo vale mientras siga el descanso: si
  // arranca el 2.º tiempo antes de los 2 minutos, se quita. Y con el 2.º tiempo
  // corriendo no sale ningún gráfico automático.
  // La alineación se quita apenas el árbitro inicia el reloj.
  const autoVisible = ((autoOverlay === 'resumen' || autoOverlay === 'intermedio' || autoOverlay === 'tabla_descanso' || autoOverlay === 'proximos') && !descansoAuto && !esperandoSegundoTiempo) || (autoOverlay === 'jugadores' && partidoYaInicio) || segundoTiempoCorriendo ? null : autoOverlay
  const overlayActivo = control?.overlay || (graficosAuto ? autoVisible : null)
  // Los gráficos que salen SOLOS llevan el mensaje institucional; los que
  // prende el panel de control llevan la leyenda normal de cada gráfica.
  const pieInstitucional = !control?.overlay && graficosAuto && autoOverlay ? 'El fútbol evoluciona. La tecnología también. Desarrollado por GOLMEBOL' : undefined

  // Tabla de posiciones: se trae cuando se prende el gráfico (a mano o automático)
  // y se refresca cada 30s mientras siga prendido (la transmisión dura horas y
  // la tabla cambia al terminar cada partido).
  const quiereTabla = overlayActivo === 'tabla' || overlayActivo === 'tabla_descanso' || (overlayActivo === 'resumen' && !control?.overlay) // en el tablero del descanso ya se va cargando la tabla
  const tablaTorneoId = quiereTabla ? (control?.overlay === 'tabla' ? control.overlay_tournament_id : (torneoAuto || partido?.tournament_id)) || null : null
  // Los partidos guardados se refrescan cada 30 s; lo que se está jugando AHORA
  // viene de matchesVivoRaw (cada 5 s + tiempo real) y se suma encima: así la
  // tabla muestra "así va" con el gol apenas lo marca el árbitro (provisional).
  const basesTabla = useTablasBase(tablaTorneoId ? [tablaTorneoId] : [], { conGrupos: true })
  const tablas = useMemo(() => { void tick; return tablasConVivo(basesTabla, matchesVivoRaw) }, [basesTabla, matchesVivoRaw, tick])
  const gruposTabla = useMemo(() => { void tick; return tablaTorneoId ? gruposConVivo(basesTabla[tablaTorneoId], matchesVivoRaw) : [] }, [basesTabla, tablaTorneoId, matchesVivoRaw, tick])

  // Publicidad rápida de un patrocinador: aparece 8s y se apaga sola, igual
  // que en la portada. Se ignora la marca que ya estaba cuando se abrió la
  // página (si no, cada vez que OBS recarga volvería a salir la última).
  // El temporizador vive en un ref (no en el cleanup del efecto) porque
  // `control` es un objeto nuevo cada vez que se refresca site_config, y un
  // cleanup lo cancelaría antes de apagar la publicidad.
  const patrocinadorTs = control?.patrocinador_ts || 0
  const patrocinadorId = control?.patrocinador_id
  const patrocinadorTimerRef = useRef(null)
  useEffect(() => {
    if (!siteConfig) return
    if (patrocinadorVistoRef.current === null) { patrocinadorVistoRef.current = patrocinadorTs; return }
    if (!patrocinadorTs || patrocinadorVistoRef.current === patrocinadorTs) return
    patrocinadorVistoRef.current = patrocinadorTs
    setPatrocinadorMostrando(disparoDeControl(control))
    clearTimeout(patrocinadorTimerRef.current)
    // Seguro: la propia publicidad avisa cuando termina (logo 8 s, banners 10 s cada uno, video al acabar)
    patrocinadorTimerRef.current = setTimeout(() => setPatrocinadorMostrando(null), 240000)
  }, [siteConfig, patrocinadorTs, patrocinadorId, control?.patrocinador_tipo, control?.patrocinador_tamano]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(patrocinadorTimerRef.current), [])

  // Repetición dentro de la transmisión: el botón del panel cambia repeticion_ts.
  // Se ignora la marca que ya estaba al abrir la página (si no, cada vez que
  // Prism recarga el overlay saldría la última repetición otra vez) y los
  // clics que lleguen mientras ya hay una repetición en pantalla.
  const repeticionTs = control?.repeticion_ts || 0
  const streamEsYouTube = detectarPlataforma(stream?.url) === 'youtube'
  useEffect(() => {
    if (!repeticionActiva || !siteConfig) return
    const anotar = m => setLogRepeticion(l => [...l.slice(-5), m])
    if (repeticionVistaRef.current === null) {
      repeticionVistaRef.current = repeticionTs
      anotar(repeticionTs ? 'página recién abierta: el último clic ya estaba guardado, se ignora (aprieta Repetición ahora)' : 'página lista, esperando el clic en Repetición')
      return
    }
    if (!repeticionTs || repeticionVistaRef.current === repeticionTs) return
    repeticionVistaRef.current = repeticionTs
    if (!streamEsYouTube) { anotar('clic recibido pero la transmisión no es de YouTube'); return }
    anotar('clic recibido → iniciando repetición')
    const imagenes = Array.isArray(siteConfig.en_vivo_repeticion_imagenes) ? siteConfig.en_vivo_repeticion_imagenes : []
    const imagenUrl = imagenes.length ? imagenes[repeticionContadorRef.current % imagenes.length].url : null
    repeticionContadorRef.current += 1
    setRepeticionDisparo(actual => { if (actual) anotar('clic ignorado: ya hay una repetición en curso'); return actual || { key: repeticionTs, camaraLenta: !!control?.repeticion_camara_lenta, imagenUrl } })
  }, [repeticionActiva, siteConfig, repeticionTs, streamEsYouTube]) // eslint-disable-line react-hooks/exhaustive-deps

  const sponsor = patrocinadorDeDisparo(patrocinadoresDeControl(control), patrocinadorMostrando)
  // Con el tablero grande de abajo (goles / descanso / final) se esconde el marcador de arriba, para que la mirada se quede en el minuto a minuto
  const tapaMarcador = overlayTapaMarcador(overlayActivo) && (overlayActivo !== 'final' || !!partidoFinal) && !(sponsor && disparoEsExclusivo(patrocinadorMostrando, descansoAuto))

  return (
    <>
      <style>{`
        html.gm-overlay-obs, body.gm-overlay-obs, body.gm-overlay-obs #root {
          background: transparent !important; overflow: hidden !important; min-height: 0 !important;
        }
        body.gm-overlay-obs .gm-marca-golmebol, body.gm-overlay-obs .gm-banner-version { display: none !important; }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        background: modoPrueba ? 'linear-gradient(135deg,#1f6b2c,#2f8f3f 50%,#1f6b2c)' : 'transparent',
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: ANCHO_ESCENARIO, height: altoEscenario, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
          {mostrarLogo && stream && <MarcaTransmision logoTorneo={partido?.tournaments?.logo_url || logoDeTorneo(stream.torneo_auto)}/>}
          {partido && !tapaMarcador && <MarcadorEnVivoOverlay partido={partido}/>}
          {partido && <GolAvisoEnVivoOverlay partido={partido} {...propsAvisoGol(overlayActivo, tapaMarcador)}/>}
          {sponsor && <PatrocinadorEnVivoOverlay key={patrocinadorMostrando.clave} patrocinador={sponsor} tipo={patrocinadorMostrando.tipo} tamano={patrocinadorMostrando.tamano} descanso={descansoAuto} onTerminar={() => setPatrocinadorMostrando(null)}/>}
          {!(sponsor && disparoEsExclusivo(patrocinadorMostrando, descansoAuto)) && (
            <>
              {overlayActivo === 'goles' && partido && <GolesEnVivoOverlay partido={partido}/>}
              {overlayActivo === 'tabla' && <TablaEnVivoOverlay filas={tablas[tablaTorneoId]} pagina={control?.overlay === 'tabla' ? control.tabla_pagina : null} pie={pieInstitucional}/>}
              {overlayActivo === 'tabla_descanso' && <TablaDescansoOverlay filas={tablas[tablaTorneoId]} grupos={gruposTabla} pie={pieInstitucional} onTerminar={() => siguienteDelDescanso('tabla_descanso')}/>}
              {overlayActivo === 'proximos' && <ProximosPartidosOverlay partidos={proximos} pie={pieInstitucional} onTerminar={() => siguienteDelDescanso('proximos')}/>}
              {overlayActivo === 'jugadores' && partido && <JugadoresEnVivoOverlay partido={partido} pie={pieInstitucional}/>}
              {overlayActivo === 'resumen' && partido && <ResumenGolesOverlay partido={partido} goles={extraerGoles(partido)} modo="descanso"/>}
              {overlayActivo === 'intermedio' && <IntermedioDescansoOverlay jugadas={control?.jugadas} patrocinadores={patrocinadoresDeControl(control)}/>}
              {overlayActivo === 'mvp' && mvpFinal && <MvpPartidoOverlay mvp={mvpFinal}/>}
              {overlayActivo === 'final' && partidoFinal && <ResumenGolesOverlay partido={partidoFinal} goles={partidoFinal.goles} modo="final"/>}
            </>
          )}
          {repeticionActiva && repeticionDisparo && stream?.url && (
            <RepeticionTransmisionOverlay key={repeticionDisparo.key} url={stream.url} disparo={repeticionDisparo} atras={segundosAtras} espera={segundosEspera} velocidad={velocidadRepeticion} onEstado={m => setLogRepeticion(l => [...l.slice(-5), m])} onTerminar={() => setRepeticionDisparo(null)}/>
          )}
          {modoDebug && (() => {
            void tick
            const hace = repeticionTs ? Math.round((Date.now() - repeticionTs) / 1000) : null
            const lineas = [
              'DIAGNÓSTICO REPETICIÓN (v4)',
              `repetición activa: ${repeticionActiva ? 'SÍ' : 'NO (marca la casilla y guarda, o usa ?repeticion=1)'}`,
              `config: ${siteConfig ? 'cargada' : 'NO CARGÓ (sin internet o sin permiso)'} · id del link: ${String(streamId).slice(0, 8)}… · transmisiones: ${(Array.isArray(siteConfig?.en_vivo_streams) ? siteConfig.en_vivo_streams : []).map(x => String(x.id).slice(0, 8)).join(', ') || 'ninguna'}`,
              `transmisión: ${stream ? 'encontrada' : 'NO ENCONTRADA (revisa el id del link)'} · es YouTube: ${streamEsYouTube ? 'sí' : 'NO (revisa el link del directo)'}`,
              `link del directo: ${stream?.url ? (parseYouTubeId(stream.url) ? `id de video ${parseYouTubeId(stream.url)}` : `NO SE PUEDE SACAR EL ID de: ${stream.url}`) : 'vacío'}`,
              `último clic en Repetición: ${hace === null ? 'ninguno' : `hace ${hace}s`}`,
              ...logRepeticion,
            ]
            return (
              <div style={{ position: 'absolute', top: 90, left: 10, zIndex: 60, maxWidth: 620, padding: '8px 10px', background: 'rgba(0,0,0,.85)', color: '#7cfc8a', font: '13px/1.4 monospace', borderRadius: 6 }}>
                {lineas.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )
          })()}
          {partido?.tournament_id && (
            <PatrocinadoresTorneoOverlay logos={siteConfig?.patrocinador_logos_torneo?.[partido.tournament_id]} activos={control?.logos_activos}/>
          )}
        </div>
      </div>
    </>
  )
}
