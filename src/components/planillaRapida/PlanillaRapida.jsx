import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PantallaColores from './PantallaColores'
import PantallaAsignarNumeros from './PantallaAsignarNumeros'
import PantallaPartido from './PantallaPartido'
import ModalFotoNumero from './ModalFotoNumero'
import AlertaNumeroDesconocido from './AlertaNumeroDesconocido'
import AlertaFaltasEquipo from './AlertaFaltasEquipo'
import ModalCierrePartido from './ModalCierrePartido'
import { FONDO, CIAN, formatTiempo } from './estilosRapida'

function idUnico() {
  try { return crypto.randomUUID() } catch (e) { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

function filaVacia() {
  return { id: undefined, nombre: '', cedula: '', numero: '', photo_face_url: null, photo_url: null }
}

// Mezcla la lista fresca de la BD con la que ya tiene el árbitro en pantalla:
// conserva los números ya asignados y las filas "sin registro" que agregó a
// mano, y solo suma jugadores nuevos (recién registrados) o fotos nuevas.
function fusionarJugadores(actual, fresco) {
  const porId = new Map(actual.filter(j => j.id).map(j => [j.id, j]))
  const actualizados = fresco.map(b => {
    const existente = porId.get(b.id)
    return existente ? { ...b, numero: existente.numero } : b
  })
  const sinRegistro = actual.filter(j => !j.id)
  return [...actualizados, ...sinRegistro]
}

// Planilla RÁPIDA — independiente de PlanillaPartido.jsx (esa no se toca).
// Pensada para cuando NO hay planillador dedicado: los mismos árbitros la
// llevan desde el celular. Mismo destino final de datos (match_events,
// player_match_stats, partido_arqueros, matches, tournament_logros,
// predicciones) para que el admin vea todo igual de completo, pero con una
// carga durante el partido mucho más simple: solo número + tipo de evento.
export default function PlanillaRapida({ partido, onClose, onGuardarResultado }) {
  const localKey = `planilla_rapida_${partido.id}`
  const [loading, setLoading] = useState(true)
  const [listo, setListo] = useState(false) // true cuando ya se puede autoguardar sin pisar nada
  const [step, setStep] = useState('colores') // colores | asignar | partido
  const [volviendoDesdePartido, setVolviendoDesdePartido] = useState(false)

  const [jugadoresLocal, setJugadoresLocal] = useState([])
  const [jugadoresVisitante, setJugadoresVisitante] = useState([])
  const [colorLocal, setColorLocal] = useState(null)
  const [colorVis, setColorVis] = useState(null)
  const [arqueroLocal, setArqueroLocal] = useState(null)
  const [arqueroVis, setArqueroVis] = useState(null)
  const [histArquerosLocal, setHistArquerosLocal] = useState([])
  const [histArquerosVis, setHistArquerosVis] = useState([])
  const [eventos, setEventos] = useState([])
  const [modalidad, setModalidad] = useState(null)
  const [duracionMinutos, setDuracionMinutos] = useState(20)
  const [periodo, setPeriodo] = useState(1)
  const [segundos, setSegundos] = useState(0)
  const [corriendo, setCorriendo] = useState(false)
  const [tiempoAgotado, setTiempoAgotado] = useState(false)

  const [modalFoto, setModalFoto] = useState(null) // { team, index, jugador }
  const [alertaNumero, setAlertaNumero] = useState(null) // { team, numero, tipo }
  const [alertaFaltas, setAlertaFaltas] = useState(null) // { team }
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [guardandoDB, setGuardandoDB] = useState(false)

  const remoteTimer = useRef(null)
  const alarmaRef = useRef(null)
  const inicioEpochRef = useRef(null) // ancla de hora real: si el celular se bloquea o el navegador frena el temporizador en 2do plano, al volver se recalcula el tiempo real transcurrido en vez de quedar atrasado

  const nombreLocal = partido.home?.name || 'Local'
  const nombreVis = partido.away?.name || 'Visitante'

  // ── Carga inicial ──────────────────────────────────────────────────────
  useEffect(() => { fetchTodo() }, [])

  // Pantalla completa real (oculta también la barra del navegador móvil),
  // igual que la planilla completa — se sale sola al desmontar el componente.
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { document.exitFullscreen?.().catch(() => {}) }
  }, [])

  async function fetchTodo() {
    // 1) Restauro INSTANTÁNEO desde el borrador local, sin esperar la red —
    // clave para que abrir la planilla sea inmediato (el árbitro solo tiene
    // el celular en la mano unos segundos). Si hay borrador, ya se puede ver
    // y usar la planilla mientras la sincronización real pasa en 2do plano.
    let localSnap = null
    try {
      const local = localStorage.getItem(localKey)
      localSnap = local ? JSON.parse(local) : null
    } catch (e) {}

    const hayBorradorUsable = localSnap && partido.status !== 'finished'
    if (hayBorradorUsable) {
      aplicarSnap(localSnap, localSnap.duracionMinutos || 20)
      setListo(true)
      setLoading(false)
    } else {
      setLoading(true)
    }

    // 2) En 2do plano, sincronizo con la base de datos: jugadores nuevos,
    // fotos, modalidad del torneo, y reviso si hay un borrador remoto más
    // nuevo (por ejemplo si otro árbitro guardó desde otro celular).
    const [jugsL, jugsV, torn, liveDB, sancionesDB] = await Promise.all([
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,photo_face_url,photo_url)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.home_team_id).eq('activo', true),
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,photo_face_url,photo_url)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.away_team_id).eq('activo', true),
      supabase.from('tournaments').select('modalidad').eq('id', partido.tournament_id).maybeSingle(),
      supabase.from('matches').select('live_state_rapida, live_state_rapida_updated_at').eq('id', partido.id).maybeSingle(),
      // Jugadores sancionados (de este torneo, o globales): no se les deja aparecer en la planilla mientras no esté ya jugado
      supabase.from('sanciones').select('player_id, fecha_fin').eq('activa', true).or(`tournament_id.eq.${partido.tournament_id},tournament_id.is.null`),
    ])
    const modalidadDB = torn.data?.modalidad
    const dur = modalidadDB === 'Fútbol 7' ? 25 : modalidadDB === 'Fútbol 11' ? 45 : 20
    setModalidad(modalidadDB)

    // Un partido ya jugado conserva su alineación histórica tal cual —
    // la sanción solo bloquea que aparezca como opción hacia adelante.
    if (partido.status !== 'finished') {
      const hoyIso = new Date().toISOString()
      const idsSancionados = new Set((sancionesDB?.data || []).filter(s => !s.fecha_fin || s.fecha_fin > hoyIso).map(s => s.player_id))
      if (idsSancionados.size > 0) {
        if (jugsL.data) jugsL.data = jugsL.data.filter(r => !idsSancionados.has(r.players?.id))
        if (jugsV.data) jugsV.data = jugsV.data.filter(r => !idsSancionados.has(r.players?.id))
      }
    }

    const mapJug = data => (data || []).map(r => ({ id: r.players?.id, nombre: r.players?.name || '', cedula: r.players?.numero_cedula || '', numero: '', photo_face_url: r.players?.photo_face_url || null, photo_url: r.players?.photo_url || null }))
    let baseLocal = mapJug(jugsL.data)
    let baseVis = mapJug(jugsV.data)

    if (partido.status === 'finished') {
      await reconstruirPartidoCerrado(baseLocal, baseVis)
      setDuracionMinutos(dur)
      setStep('partido')
      setListo(true)
      setLoading(false)
      return
    }

    const remoteSnap = liveDB?.data?.live_state_rapida || null
    const localTime = localSnap ? new Date(localSnap.savedAt || 0).getTime() : -1
    const remoteTime = remoteSnap ? new Date(liveDB?.data?.live_state_rapida_updated_at || remoteSnap.savedAt || 0).getTime() : -1

    if (!hayBorradorUsable) {
      // No había nada que mostrar de una: si hay borrador remoto lo aplico,
      // si no, arranco con el roster fresco de la BD.
      if (remoteTime >= 0) {
        aplicarSnap(remoteSnap, dur)
        try { localStorage.setItem(localKey, JSON.stringify(remoteSnap)) } catch (e) {}
      } else {
        setJugadoresLocal(baseLocal)
        setJugadoresVisitante(baseVis)
        setDuracionMinutos(dur)
      }
      setListo(true)
      setLoading(false)
    } else if (remoteTime > localTime) {
      // Ya se mostró el borrador local, pero el remoto resultó más nuevo
      // (otro árbitro guardó desde otro celular) — lo aplico encima.
      aplicarSnap(remoteSnap, dur)
      try { localStorage.setItem(localKey, JSON.stringify(remoteSnap)) } catch (e) {}
    } else {
      // El borrador local sigue siendo el más nuevo: solo sumo jugadores
      // nuevos que se hayan registrado después de armarlo, sin tocar nada
      // de lo que el árbitro ya tiene anotado.
      setJugadoresLocal(prev => fusionarJugadores(prev, baseLocal))
      setJugadoresVisitante(prev => fusionarJugadores(prev, baseVis))
    }
  }

  function aplicarSnap(snap, dur) {
    if (!snap) return
    setJugadoresLocal(snap.jugadoresLocal || [])
    setJugadoresVisitante(snap.jugadoresVisitante || [])
    setColorLocal(snap.colorLocal || null)
    setColorVis(snap.colorVis || null)
    setArqueroLocal(snap.arqueroLocal || null)
    setArqueroVis(snap.arqueroVis || null)
    setHistArquerosLocal(snap.histArquerosLocal || [])
    setHistArquerosVis(snap.histArquerosVis || [])
    setEventos(snap.eventos || [])
    setPeriodo(snap.periodo || 1)
    const durFinal = snap.duracionMinutos || dur
    setDuracionMinutos(durFinal)
    setStep(snap.step || 'colores')

    // Si el cronómetro seguía corriendo cuando se guardó este borrador, se le
    // suma el tiempo real transcurrido desde entonces — así, al reabrir (el
    // mismo celular después de un rato, o desde otro celular) el reloj
    // muestra lo que realmente debería marcar y sigue corriendo solo, en vez
    // de quedar pausado y atrasado en lo último que se alcanzó a guardar.
    let segs = typeof snap.segundos === 'number' ? snap.segundos : 0
    if (snap.corriendo && snap.savedAt) {
      const transcurrido = Math.floor((Date.now() - new Date(snap.savedAt).getTime()) / 1000)
      if (transcurrido > 0) segs += transcurrido
    }
    const limite = durFinal * 60
    inicioEpochRef.current = null
    if (segs >= limite) {
      setSegundos(limite)
      setCorriendo(false)
      setTiempoAgotado(true)
    } else {
      setSegundos(segs)
      setCorriendo(!!snap.corriendo)
      setTiempoAgotado(!!snap.tiempoAgotado)
    }
  }

  // Reconstruye una planilla rápida ya cerrada (para que el árbitro líder / admin pueda reeditarla)
  async function reconstruirPartidoCerrado(baseLocal, baseVis) {
    const [evsDB, statsDB, arqDB] = await Promise.all([
      supabase.from('match_events').select('*').eq('match_id', partido.id).order('created_at', { ascending: true }),
      supabase.from('player_match_stats').select('*').eq('match_id', partido.id),
      supabase.from('partido_arqueros').select('*').eq('match_id', partido.id).order('orden'),
    ])
    const stats = statsDB.data || []
    const conNumero = (base, team_id) => base.map(j => {
      const s = stats.find(st => st.player_id === j.id && st.team_id === team_id)
      return s ? { ...j, numero: s.numero_camiseta || '' } : j
    })
    let arrLocal = conNumero(baseLocal, partido.home_team_id)
    let arrVis = conNumero(baseVis, partido.away_team_id)

    ;(evsDB.data || []).forEach(e => {
      if (e.player_id || !e.player_nombre) return
      const esLocal = e.team_id === partido.home_team_id
      const arr = esLocal ? arrLocal : arrVis
      if (!arr.some(j => !j.id && j.nombre === e.player_nombre)) arr.push({ ...filaVacia(), nombre: e.player_nombre })
    })

    const eventosReconstruidos = (evsDB.data || [])
      .filter(e => ['goal', 'yellow_card', 'blue_card', 'red_card', 'falta_acum'].includes(e.event_type))
      .map(e => {
        const esLocal = e.team_id === partido.home_team_id
        const arr = esLocal ? arrLocal : arrVis
        const jug = e.player_id ? arr.find(x => x.id === e.player_id) : arr.find(x => !x.id && x.nombre === e.player_nombre)
        return { id: e.id, team: esLocal ? 'local' : 'visitante', tipo: e.event_type, numero: jug?.numero || '', jugadorId: e.player_id || null, jugadorNombre: jug?.nombre || e.player_nombre || '', minuto: e.minute || '', periodo: e.periodo || 1 }
      })

    const mapArq = a => a.player_id
      ? { id: a.player_id, nombre: (arrLocal.find(j => j.id === a.player_id) || arrVis.find(j => j.id === a.player_id))?.nombre || '', numero: a.numero || '' }
      : { id: undefined, nombre: a.player_nombre || '', numero: a.numero || '' }
    const arqL = (arqDB.data || []).filter(a => a.team_id === partido.home_team_id).map(mapArq)
    const arqV = (arqDB.data || []).filter(a => a.team_id === partido.away_team_id).map(mapArq)

    setJugadoresLocal(arrLocal)
    setJugadoresVisitante(arrVis)
    setEventos(eventosReconstruidos)
    setHistArquerosLocal(arqL)
    setHistArquerosVis(arqV)
    if (arqL.length) setArqueroLocal(arqL[arqL.length - 1])
    if (arqV.length) setArqueroVis(arqV[arqV.length - 1])
  }

  // ── Autoguardado (borrador local + remoto) ────────────────────────────
  function construirSnap() {
    return { jugadoresLocal, jugadoresVisitante, colorLocal, colorVis, arqueroLocal, arqueroVis, histArquerosLocal, histArquerosVis, eventos, periodo, segundos, corriendo, tiempoAgotado, duracionMinutos, step, savedAt: new Date().toISOString() }
  }
  function guardarRemotoInmediato(snap) {
    if (!navigator.onLine) return
    supabase.from('matches').update({ live_state_rapida: snap, live_state_rapida_updated_at: new Date().toISOString() }).eq('id', partido.id).then(() => {}, () => {})
  }
  function guardarRemotoDebounced(snap) {
    clearTimeout(remoteTimer.current)
    remoteTimer.current = setTimeout(() => guardarRemotoInmediato(snap), 1200)
  }

  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch (e) {}
    guardarRemotoDebounced(snap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jugadoresLocal, jugadoresVisitante, colorLocal, colorVis, arqueroLocal, arqueroVis, histArquerosLocal, histArquerosVis, eventos, periodo, tiempoAgotado, duracionMinutos, step])

  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch (e) {}
    if (corriendo && segundos % 8 === 0) guardarRemotoInmediato(snap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos])

  // ── Cronómetro ─────────────────────────────────────────────────────────
  // Se ancla a la hora real (Date.now), no a "ir sumando 1 cada segundo": así,
  // si el celular se bloquea o el árbitro cambia de app y el navegador frena
  // el setInterval, al volver se recalcula el tiempo real transcurrido en vez
  // de quedar atrasado o directamente detenido.
  useEffect(() => {
    if (!corriendo) return
    if (inicioEpochRef.current == null) inicioEpochRef.current = Date.now() - segundos * 1000

    function recalcular() {
      const limite = duracionMinutos * 60
      const elapsed = Math.floor((Date.now() - inicioEpochRef.current) / 1000)
      setSegundos(elapsed >= limite ? limite : elapsed)
      if (elapsed >= limite && !tiempoAgotado) { setTiempoAgotado(true); setCorriendo(false); iniciarAlarma() }
    }

    const id = setInterval(recalcular, 1000)
    document.addEventListener('visibilitychange', recalcular)
    window.addEventListener('focus', recalcular)
    window.addEventListener('pageshow', recalcular)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', recalcular)
      window.removeEventListener('focus', recalcular)
      window.removeEventListener('pageshow', recalcular)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo, duracionMinutos, tiempoAgotado])

  function sonarBeep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880
      g.gain.setValueAtTime(0.3, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      o.start(); o.stop(ctx.currentTime + 0.3)
    } catch (e) {}
    try { navigator.vibrate && navigator.vibrate([300, 120, 300]) } catch (e) {}
  }
  function iniciarAlarma() {
    if (alarmaRef.current) return
    sonarBeep()
    alarmaRef.current = setInterval(sonarBeep, 2500)
  }
  function pararAlarma() {
    clearInterval(alarmaRef.current); alarmaRef.current = null
    try { navigator.vibrate && navigator.vibrate(0) } catch (e) {}
  }
  useEffect(() => () => { clearInterval(alarmaRef.current) }, [])

  function toggleCronometro() {
    pararAlarma()
    if (corriendo) inicioEpochRef.current = null // se pausa: al reanudar se recalcula el ancla desde el segundo actual
    setCorriendo(c => !c)
  }
  function cambiarPeriodo() {
    if (periodo === 2) return
    pararAlarma()
    inicioEpochRef.current = null
    setPeriodo(2); setSegundos(0); setTiempoAgotado(false); setCorriendo(false)
  }

  // ── Asignación de camisetas ────────────────────────────────────────────
  function abrirJugador(team, index) {
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    setModalFoto({ team, index, jugador: arr[index] })
  }
  function agregarSinRegistro(team) {
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const nueva = filaVacia()
    const index = arr.length
    setArr([...arr, nueva])
    setModalFoto({ team, index, jugador: nueva })
  }
  function confirmarNumero(numero, nombre) {
    const { team, index } = modalFoto
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const dup = arr.some((j, i) => i !== index && (j.numero || '').trim() === numero)
    if (dup) { alert(`El número ${numero} ya está asignado a otro jugador de este equipo.`); return }
    const nuevo = [...arr]
    nuevo[index] = { ...nuevo[index], numero, ...(nuevo[index].id ? {} : { nombre }) }
    setArr(nuevo)
    setModalFoto(null)
  }
  function quitarNumero() {
    const { team, index } = modalFoto
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const nuevo = [...arr]
    nuevo[index] = { ...nuevo[index], numero: '' }
    setArr(nuevo)
    setModalFoto(null)
  }

  // ── Arquero ────────────────────────────────────────────────────────────
  function seleccionarArquero(team, jugador) {
    const arq = { id: jugador.id, nombre: jugador.nombre, numero: jugador.numero }
    const setArq = team === 'local' ? setArqueroLocal : setArqueroVis
    const setHist = team === 'local' ? setHistArquerosLocal : setHistArquerosVis
    setArq(arq)
    setHist(prev => prev.some(h => (h.id && h.id === arq.id) || (!h.id && !arq.id && h.nombre === arq.nombre)) ? prev : [...prev, arq])
  }

  // ── Eventos (goles/tarjetas/faltas) ────────────────────────────────────
  function agregarEventoParaJugador(team, jugador, tipo) {
    setEventos(prev => [...prev, { id: idUnico(), team, tipo, numero: jugador.numero, jugadorId: jugador.id || null, jugadorNombre: jugador.nombre || '', minuto: formatTiempo(segundos), periodo }])
    // Aviso de 5 faltas del equipo en el tiempo (solo Fútbol 5): desde la
    // siguiente falta es tiro libre directo sin barrera para el rival.
    if (tipo === 'falta_acum' && modalidad === 'Fútbol 5') {
      const yaTenia = eventos.filter(e => e.team === team && e.tipo === 'falta_acum' && e.periodo === periodo).length
      if (yaTenia + 1 === 5) {
        setAlertaFaltas({ team })
        try { navigator.vibrate && navigator.vibrate([300, 100, 300, 100, 300]) } catch (e) {}
      }
    }
  }
  function registrarEvento(team, numero, tipo) {
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const jugador = arr.find(j => (j.numero || '').trim() === numero)
    if (!jugador) { setAlertaNumero({ team, numero, tipo }); return }
    agregarEventoParaJugador(team, jugador, tipo)
  }
  function quitarEvento(_team, id) {
    setEventos(prev => prev.filter(e => e.id !== id))
  }
  function resolverAlertaApellido(nombreApellido) {
    const { team, numero, tipo } = alertaNumero
    const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const nuevoJugador = { ...filaVacia(), nombre: nombreApellido, numero }
    setArr([...arr, nuevoJugador])
    agregarEventoParaJugador(team, nuevoJugador, tipo)
    setAlertaNumero(null)
  }

  // ── Guardado final ─────────────────────────────────────────────────────
  async function guardarFinal({ informeTexto, mvpId }) {
    setGuardandoDB(true)
    const golesLocalTotal = eventos.filter(e => e.team === 'local' && e.tipo === 'goal').length
    const golesVisTotal = eventos.filter(e => e.team === 'visitante' && e.tipo === 'goal').length
    const erroresGuardado = []

    if (partido.status === 'finished') {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        let editorName = user?.email || 'Desconocido'
        if (user?.id) { const { data: pRow } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle(); if (pRow?.name) editorName = pRow.name }
        await supabase.from('match_edit_log').insert({ match_id: partido.id, editor_user_id: user?.id || null, editor_name: editorName, editor_email: user?.email || null })
      } catch (e) { console.error('No se pudo registrar la edición post-cierre:', e) }
    }

    // Las faltas acumuladas (falta_acum) solo se guardan si el jugador está
    // registrado — igual que la planilla completa. Las de jugadores sin
    // registro ya cumplieron su función en vivo (avisar la 5ta del equipo)
    // pero no generan fila individual.
    const eventosDB = eventos
      .filter(e => e.tipo !== 'falta_acum' || e.jugadorId)
      .map(e => ({
        match_id: partido.id, tournament_id: partido.tournament_id,
        team_id: e.team === 'local' ? partido.home_team_id : partido.away_team_id,
        player_id: e.jugadorId || null,
        player_nombre: (!e.jugadorId && e.tipo !== 'goal') ? (e.jugadorNombre || null) : null,
        event_type: e.tipo, minute: e.minuto || null, periodo: e.periodo || 1,
      }))
    await supabase.from('match_events').delete().eq('match_id', partido.id)
    if (eventosDB.length > 0) {
      let { error } = await supabase.from('match_events').insert(eventosDB)
      if (error && (error.message || '').includes('player_nombre')) {
        ;({ error } = await supabase.from('match_events').insert(eventosDB.map(({ player_nombre, ...e }) => e)))
      }
      if (error) erroresGuardado.push('Eventos: ' + error.message)
    }

    const { error: errPartido } = await supabase.from('matches').update({
      home_score: golesLocalTotal, away_score: golesVisTotal, status: 'finished',
      live_state_rapida: null, live_state_rapida_updated_at: null,
    }).eq('id', partido.id)
    if (errPartido) erroresGuardado.push('Resultado: ' + errPartido.message)

    await supabase.from('partido_arqueros').delete().eq('match_id', partido.id)
    const arqRows = []
    const pushHist = (hist, team_id) => hist.forEach((a, i) => {
      if (a.id) arqRows.push({ match_id: partido.id, team_id, player_id: a.id, orden: i + 1 })
      else if ((a.nombre || '').trim()) arqRows.push({ match_id: partido.id, team_id, player_id: null, player_nombre: a.nombre.trim(), numero: a.numero ? String(a.numero) : null, orden: i + 1 })
    })
    pushHist(histArquerosLocal, partido.home_team_id)
    pushHist(histArquerosVis, partido.away_team_id)
    if (arqRows.length > 0) {
      let { error } = await supabase.from('partido_arqueros').insert(arqRows)
      if (error && ((error.message || '').includes('player_nombre') || (error.message || '').includes('null value'))) {
        ;({ error } = await supabase.from('partido_arqueros').insert(arqRows.filter(r => r.player_id).map(({ player_nombre, numero, ...r }) => r)))
      }
      if (error) erroresGuardado.push('Arqueros: ' + error.message)
    }

    const arquerosLocalIds = new Set([...histArquerosLocal.map(a => a.id), arqueroLocal?.id].filter(Boolean))
    const arquerosVisIds = new Set([...histArquerosVis.map(a => a.id), arqueroVis?.id].filter(Boolean))
    const calcResultado = (gF, gC) => gF > gC ? 'win' : gF === gC ? 'draw' : 'loss'
    const statsRows = []
    const procesarStats = (jugadores, team_id, esLocal) => {
      const gF = esLocal ? golesLocalTotal : golesVisTotal
      const gC = esLocal ? golesVisTotal : golesLocalTotal
      const arqueroIds = esLocal ? arquerosLocalIds : arquerosVisIds
      const arqueroActualId = esLocal ? arqueroLocal?.id : arqueroVis?.id
      jugadores.forEach(j => {
        if (!j.id || !(j.numero || '').trim()) return
        const propios = eventos.filter(e => e.jugadorId === j.id)
        statsRows.push({
          match_id: partido.id, tournament_id: partido.tournament_id,
          player_id: j.id, team_id, numero_camiseta: j.numero,
          goals_scored: propios.filter(e => e.tipo === 'goal').length,
          goals_conceded: j.id === arqueroActualId ? gC : 0,
          fue_arquero: arqueroIds.has(j.id), own_goals: 0,
          yellow_cards: propios.filter(e => e.tipo === 'yellow_card').length,
          blue_cards: propios.filter(e => e.tipo === 'blue_card').length,
          red_cards: propios.filter(e => e.tipo === 'red_card').length,
          fouls: propios.filter(e => e.tipo === 'falta_acum').length,
          team_result: calcResultado(gF, gC),
        })
      })
    }
    procesarStats(jugadoresLocal, partido.home_team_id, true)
    procesarStats(jugadoresVisitante, partido.away_team_id, false)
    if (statsRows.length > 0) {
      const { error } = await supabase.from('player_match_stats').upsert(statsRows, { onConflict: 'match_id,player_id' })
      if (error) erroresGuardado.push('Estadísticas: ' + error.message)
    }

    if (informeTexto && informeTexto.trim().length >= 10) {
      let creadoPor = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        creadoPor = user?.email || null
        if (user?.id) { const { data: pRow } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle(); if (pRow?.name) creadoPor = pRow.name }
      } catch (e) {}
      await supabase.from('match_informes').insert({ match_id: partido.id, tournament_id: partido.tournament_id, tipo: 'roja', descripcion: informeTexto.trim(), creado_por: creadoPor })
    }

    if (mvpId) {
      await supabase.from('tournament_logros').delete().eq('match_id', partido.id).eq('tipo', 'mvp')
      await supabase.from('tournament_logros').insert({ player_id: mvpId, tournament_id: partido.tournament_id, match_id: partido.id, tipo: 'mvp' })
    }

    const ganador = golesLocalTotal > golesVisTotal ? 'home' : golesLocalTotal < golesVisTotal ? 'away' : 'draw'
    const { data: preds } = await supabase.from('predicciones').select('*').eq('match_id', partido.id).eq('resuelta', false)
    if (preds && preds.length > 0) {
      for (const pred of preds) {
        let pts = 0
        if (pred.ganador === ganador) pts += ganador === 'draw' ? 5 : 3
        if (pred.goles_home === golesLocalTotal) pts += 3
        if (pred.goles_away === golesVisTotal) pts += 3
        if (pred.goles_home === golesLocalTotal && pred.goles_away === golesVisTotal) pts += 10
        await supabase.from('predicciones').update({ puntos_ganados: pts, resuelta: true }).eq('id', pred.id)
      }
    }

    if (erroresGuardado.length > 0) {
      setGuardandoDB(false)
      alert('⚠️ NO SE PUDO GUARDAR EL RESULTADO:\n\n' + erroresGuardado.join('\n') + '\n\nTus datos siguen como borrador. Intenta de nuevo con buena señal.')
      return
    }

    try { localStorage.removeItem(localKey) } catch (e) {}
    setGuardandoDB(false)
    setMostrarCierre(false)
    onGuardarResultado && onGuardarResultado(golesLocalTotal, golesVisTotal)
    onClose && onClose()
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: FONDO, display: 'flex', alignItems: 'center', justifyContent: 'center', color: CIAN, fontFamily: 'system-ui,sans-serif' }}>
      Cargando planilla rápida...
    </div>
  )

  if (step === 'colores') return (
    <PantallaColores
      nombreLocal={nombreLocal} nombreVis={nombreVis} colorLocal={colorLocal} colorVis={colorVis}
      onElegir={(team, hex) => (team === 'local' ? setColorLocal(hex) : setColorVis(hex))}
      onContinuar={() => setStep('asignar')}
    />
  )

  if (step === 'asignar') return (
    <>
      <PantallaAsignarNumeros
        nombreLocal={nombreLocal} nombreVis={nombreVis} colorLocal={colorLocal} colorVis={colorVis}
        jugadoresLocal={jugadoresLocal} jugadoresVisitante={jugadoresVisitante}
        onAbrirJugador={abrirJugador} onAgregarSinRegistro={agregarSinRegistro}
        onVolverColores={() => setStep('colores')}
        onContinuar={() => { setStep('partido'); setVolviendoDesdePartido(false) }}
        volviendoDesdePartido={volviendoDesdePartido}
      />
      {modalFoto && (
        <ModalFotoNumero jugador={modalFoto.jugador} onConfirmar={confirmarNumero} onQuitar={quitarNumero} onCerrar={() => setModalFoto(null)}/>
      )}
    </>
  )

  const eventosLocal = eventos.filter(e => e.team === 'local')
  const eventosVis = eventos.filter(e => e.team === 'visitante')
  const hayRoja = eventos.some(e => e.tipo === 'red_card')

  return (
    <>
      <PantallaPartido
        nombreLocal={nombreLocal} nombreVis={nombreVis} colorLocal={colorLocal} colorVis={colorVis}
        jugadoresLocal={jugadoresLocal} jugadoresVisitante={jugadoresVisitante}
        arqueroLocal={arqueroLocal} arqueroVis={arqueroVis}
        eventosLocal={eventosLocal} eventosVis={eventosVis} modalidad={modalidad}
        periodo={periodo} segundos={segundos} corriendo={corriendo} tiempoAgotado={tiempoAgotado}
        onVolverLista={() => { setStep('asignar'); setVolviendoDesdePartido(true) }}
        onAbrirCierre={() => setMostrarCierre(true)}
        onToggleCronometro={toggleCronometro} onCambiarPeriodo={cambiarPeriodo}
        onSeleccionarArquero={seleccionarArquero}
        onRegistrarEvento={registrarEvento} onQuitarEvento={quitarEvento}
      />
      {alertaNumero && (
        <AlertaNumeroDesconocido
          numero={alertaNumero.numero} equipoNombre={alertaNumero.team === 'local' ? nombreLocal : nombreVis}
          onAnotarApellido={resolverAlertaApellido}
          onIrALista={() => { setStep('asignar'); setVolviendoDesdePartido(true); setAlertaNumero(null) }}
          onCancelar={() => setAlertaNumero(null)}
        />
      )}
      {alertaFaltas && (
        <AlertaFaltasEquipo
          equipoNombre={alertaFaltas.team === 'local' ? nombreLocal : nombreVis}
          onCerrar={() => setAlertaFaltas(null)}
        />
      )}
      {mostrarCierre && (
        <ModalCierrePartido
          nombreLocal={nombreLocal} nombreVis={nombreVis} arqueroLocal={arqueroLocal} arqueroVis={arqueroVis}
          hayRoja={hayRoja} jugadoresLocal={jugadoresLocal} jugadoresVisitante={jugadoresVisitante}
          guardando={guardandoDB} onFinalizar={guardarFinal} onCerrar={() => setMostrarCierre(false)}
        />
      )}
    </>
  )
}
