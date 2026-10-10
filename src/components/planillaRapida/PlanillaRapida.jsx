import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { resolverPrediccionesPartido, anularPrediccionesPartido } from '../../lib/predix'
import PantallaColores from './PantallaColores'
import PantallaAsignarNumeros from './PantallaAsignarNumeros'
import PantallaPartido from './PantallaPartido'
import ModalFotoNumero from './ModalFotoNumero'
import AlertaNumeroDesconocido from './AlertaNumeroDesconocido'
import AlertaFaltasEquipo from './AlertaFaltasEquipo'
import ModalCierrePartido from './ModalCierrePartido'
import ModalPartidoEspecialRapida from './ModalPartidoEspecialRapida'
import { FONDO, CIAN, formatTiempo } from './estilosRapida'
import { construirDeudaTarjetas, fetchMatchesInfo } from '../../lib/tarjetasDeuda'
import { comprimirImagen } from '../../lib/imageCompress'
import { limpiarStatsObsoletas, borrarStatsDePartido } from '../../lib/statsPartido'

function idUnico() {
  try { return crypto.randomUUID() } catch (e) { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

function filaVacia() {
  return { id: undefined, nombre: '', cedula: '', numero: '', photo_face_url: null, photo_url: null }
}

// Mezcla la lista fresca de la BD con la que ya tiene el árbitro en pantalla:
// conserva los números ya asignados y las filas "sin registro" que agregó a
// mano, y solo suma jugadores nuevos (recién registrados) o fotos nuevas.
//
// OJO (bug grave corregido): antes esta función devolvía SOLO la lista fresca
// + las filas sin registro. Si la consulta a la BD fallaba (señal mala en la
// cancha → llega vacía) o devolvía menos gente, TODOS los jugadores con id
// desaparecían de la planilla junto con sus números. Ahora:
//  · una lista fresca vacía/inválida se ignora (no se toca nada);
//  · un jugador con número asignado NUNCA se descarta, aunque no venga en la
//    lista fresca (el número ya está en uso en el partido).
function fusionarJugadores(actual, fresco) {
  if (!Array.isArray(fresco) || fresco.length === 0) return actual
  const porId = new Map(actual.filter(j => j.id).map(j => [j.id, j]))
  const idsFrescos = new Set(fresco.map(b => b.id))
  const actualizados = fresco.map(b => {
    const existente = porId.get(b.id)
    return existente ? { ...existente, ...b, numero: existente.numero } : b
  })
  const conNumeroFueraDeLista = actual.filter(j => j.id && !idsFrescos.has(j.id) && String(j.numero || '').trim() !== '')
  const sinRegistro = actual.filter(j => !j.id)
  const resultado = [...actualizados, ...conNumeroFueraDeLista, ...sinRegistro]
  // Si no cambió nada de verdad, se devuelve la MISMA referencia (no dispara autoguardados en falso).
  return JSON.stringify(resultado) === JSON.stringify(actual) ? actual : resultado
}

// Cuántos jugadores tienen número asignado (para detectar "borrones" masivos).
function contarNumeros(arr) {
  return (arr || []).filter(j => String(j?.numero || '').trim() !== '').length
}

// Firma de "lo que se edita a mano" en la planilla (números, colores, arqueros):
// sirve para saber si la plantilla cambió de verdad (y no solo flags de deuda/
// foto que cada celular recalcula por su cuenta desde la base de datos).
function firmaPlantilla(s) {
  const j = arr => (arr || []).map(x => [x.id || '', x.nombre || '', x.numero || ''])
  const a = x => x ? [x.id || '', x.nombre || '', x.numero || ''] : null
  return JSON.stringify([j(s.jugadoresLocal), j(s.jugadoresVisitante), s.colorLocal ?? null, s.colorVis ?? null, a(s.arqueroLocal), a(s.arqueroVis), (s.histArquerosLocal || []).map(a), (s.histArquerosVis || []).map(a)])
}

// Toma la lista de jugadores que mandó otro celular (con sus números) pero
// conserva lo que ESTE celular sabe mejor: los flags de deuda de tarjeta/foto
// (se recalculan desde la base de datos y pueden estar más al día acá) y los
// jugadores que solo yo tengo todavía (recién registrados).
function adoptarJugadoresRemotos(local, remoto) {
  const rem = remoto || []
  const norm = n => (n || '').trim().toLowerCase()
  const porId = new Map(local.filter(j => j.id).map(j => [j.id, j]))
  const porNombreConId = new Map(local.filter(j => j.id).map(j => [norm(j.nombre), j]))
  const usados = new Set()
  const resultado = rem.map(r => {
    const l = r.id ? porId.get(r.id) : porNombreConId.get(norm(r.nombre))
    if (!l) return r
    usados.add(l.id)
    return { ...r, id: l.id, debeTarjeta: l.debeTarjeta, debeFoto: l.debeFoto, debeInscripcion: l.debeInscripcion }
  })
  const idsRem = new Set(rem.filter(j => j.id).map(j => j.id))
  const nombresSinIdRem = new Set(rem.filter(j => !j.id).map(j => norm(j.nombre)))
  local.forEach(l => {
    if (l.id) { if (!idsRem.has(l.id) && !usados.has(l.id)) resultado.push(l) }
    else if (!nombresSinIdRem.has(norm(l.nombre))) resultado.push(l)
  })
  return JSON.stringify(resultado) === JSON.stringify(local) ? local : resultado
}

// Torneos con inscripción POR JUGADOR: el jugador queda bloqueado (sin número)
// hasta que el organizador marque su pago en Finanzas. Solo se bloquea si la
// columna inscripcion_pagada existe (migración corrida): si no, no se bloquea
// a nadie por error.
function debeInscripcionReg(r, fc) {
  return fc?.inscripcion_modo === 'jugador' && r && ('inscripcion_pagada' in r) && r.inscripcion_pagada !== true
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
  const [mostrarEspecial, setMostrarEspecial] = useState(false)
  const [guardandoDB, setGuardandoDB] = useState(false)
  const [finanzasConfig, setFinanzasConfig] = useState(null) // se guarda para poder recalcular la deuda en vivo
  const [registroSimple, setRegistroSimple] = useState(false) // torneo con registro simple (ej. internacionales): jugadores sin registro en la planilla quedan inscritos solos al guardar
  const [deudaDetalle, setDeudaDetalle] = useState({}) // player_id -> [{tipo, cantidad, monto, fecha, home_team_id, away_team_id}]
  const [equiposNombre, setEquiposNombre] = useState({}) // team_id -> name
  const [partidoHermano, setPartidoHermano] = useState(null) // ida y vuelta: el otro partido de la llave, si ya se jugó

  const remoteTimer = useRef(null)
  const alarmaRef = useRef(null)
  const inicioEpochRef = useRef(null) // ancla de hora real: si el celular se bloquea o el navegador frena el temporizador en 2do plano, al volver se recalcula el tiempo real transcurrido en vez de quedar atrasado
  const registroSimpleEnCursoRef = useRef(new Set()) // nombres ya en proceso de registro, para no duplicar el jugador si se dispara dos veces
  const finanzasConfigRef = useRef(null) // config de finanzas más reciente (para el refresco en vivo del roster)
  const deudaDetalleRef = useRef({}) // último deudaDetalle conocido, para no perder el flag "debeTarjeta" al refrescar el roster en vivo

  // ── Co-planillaje: dos (o más) celulares con LA MISMA planilla ───────────
  // Los celulares ya NO se reparten un equipo cada uno: todos ven y pueden
  // tocar TODO, y lo que hace uno (cronómetro, números, arquero, goles,
  // tarjetas, jugadores nuevos) aparece al instante en los demás.
  //
  // Cómo se evita que se pisen entre ellos (cada celular guarda su borrador
  // completo en matches.live_state_rapida y todos escuchan los cambios):
  //  · Goles/tarjetas/faltas: se UNEN por id (nadie pierde lo que anotó el
  //    otro). Para que borrar uno por error también se propague, cada borrado
  //    queda en "eventosEliminados" (si no, el otro celular lo "resucitaría").
  //  · Cronómetro: lleva su propia versión (relojV), un CONTADOR (no la hora
  //    del celular: los celulares casi nunca tienen la hora exacta igual, y
  //    comparar horas hacía que uno ignorara al otro). Cada acción de reloj
  //    (arrancar/pausar/2do tiempo) sube el contador; se adopta el reloj del
  //    otro celular si su contador es mayor (si empatan, gana un criterio
  //    fijo igual en los dos). Quien hizo la última acción además va
  //    corrigiendo la deriva: cada ~8 s manda los segundos exactos y los
  //    demás se ajustan si se separaron más de 2 s — así los relojes son EL
  //    MISMO, no dos independientes.
  //  · Números/colores/arqueros: otro contador (plantillaV), mismo criterio:
  //    gana la edición más reciente, sin perder jugadores nuevos de ninguno.
  const deviceIdRef = useRef(idUnico())
  const [otrosCelulares, setOtrosCelulares] = useState(0)
  const [eventosEliminados, setEventosEliminados] = useState([]) // ids de eventos borrados (lápidas para la unión)
  const eventosEliminadosRef = useRef([])
  useEffect(() => { eventosEliminadosRef.current = eventosEliminados }, [eventosEliminados])
  const relojVRef = useRef(0)        // contador de la última acción de reloj conocida (mía o ajena)
  const relojAutorRef = useRef('')   // celular que hizo esa última acción de reloj (el que corrige la deriva)
  const relojFirmaRef = useRef('')   // estado actual del reloj (para desempatar), se mantiene al día en cada render
  const plantillaVRef = useRef(0)    // contador de la última edición de números/colores/arqueros conocida
  const plantillaAutorRef = useRef('')
  const plantillaSigRef = useRef('') // firma de la plantilla ya conocida — para detectar ediciones propias reales
  const vistosMsRef = useRef(new Set()) // marcas de tiempo de guardados ya procesados (propios o ajenos): evita reprocesar el mismo
  const finalizandoRef = useRef(false)  // este celular está guardando el resultado final (no confundir con "otro celular lo cerró")
  const cierreRemotoRef = useRef(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => { relojFirmaRef.current = `${corriendo}|${periodo}|${tiempoAgotado}|${duracionMinutos}` })
  // Copias "al día" del estado (para leerlas desde callbacks con dependencias vacías)
  const jugLocalRef = useRef([])
  const jugVisRef = useRef([])
  const segundosRef = useRef(0)
  const restituirRef = useRef(null)   // guarda YA el estado de este celular (se usa para "curar" un borrado masivo que llegó de otro celular)
  const ultimoAjenoRef = useRef(0)    // última vez (hora local) que llegó algo de OTRO celular: indica que hay otro planillando
  jugLocalRef.current = jugadoresLocal
  jugVisRef.current = jugadoresVisitante
  segundosRef.current = segundos
  // No se sube NADA a la base de datos hasta haber consultado lo que ya hay allá:
  // antes, abrir la planilla con un borrador viejo del celular lo subía de una y
  // le PISABA a todos (incluida la pantalla en vivo) los números, goles y el reloj.
  const sincronizadoRef = useRef(false)
  const [sincronizado, setSincronizado] = useState(false)
  function marcarSincronizado() { if (!sincronizadoRef.current) { sincronizadoRef.current = true; setSincronizado(true) } }
  useEffect(() => { const t = setTimeout(marcarSincronizado, 10000); return () => clearTimeout(t) }, [])
  // Toda acción de reloj hecha en ESTE celular: sube el contador y se vuelve
  // el "dueño" de la corrección de deriva.
  function nuevaAccionReloj() { relojVRef.current += 1; relojAutorRef.current = deviceIdRef.current }

  const nombreLocal = partido.home?.name || 'Local'
  const nombreVis = partido.away?.name || 'Visitante'

  function bannerCoPlanillaje() {
    if (otrosCelulares < 1) return null
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#0b3d2e', color: '#7CFFB2', fontSize: '.7rem', fontWeight: '700', textAlign: 'center', padding: '5px 8px' }}>
        👥 {otrosCelulares + 1} celulares con esta planilla · todo se ve igual en todos, en vivo
      </div>
    )
  }

  // Presencia: solo para saber cuántos celulares hay con esta planilla abierta
  // (y mostrar el aviso de arriba). Ya no se pide elegir equipo.
  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    const ch = supabase.channel(`planilla-rapida-presencia-${partido.id}`, { config: { presence: { key: deviceIdRef.current } } })
    ch.on('presence', { event: 'sync' }, () => {
      setOtrosCelulares(Object.keys(ch.presenceState()).filter(k => k !== deviceIdRef.current).length)
    })
    ch.subscribe(status => { if (status === 'SUBSCRIBED') ch.track({ desde: Date.now() }) })
    return () => { supabase.removeChannel(ch) }
  }, [listo, partido.status, partido.id])

  // El otro celular ya guardó el resultado final: esta planilla no puede
  // seguir (volvería a guardar los mismos goles/tarjetas dos veces).
  const cierreRemoto = useCallback(() => {
    if (finalizandoRef.current || cierreRemotoRef.current) return
    cierreRemotoRef.current = true
    try { localStorage.removeItem(localKey) } catch (e) {}
    alert('✅ Este partido ya lo guardó el otro celular. Se cierra esta planilla.')
    onCloseRef.current && onCloseRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fusiona en vivo lo que llega de OTRO celular (por realtime o por el
  // chequeo de respaldo de más abajo). Cada setter devuelve el mismo valor
  // anterior si no cambió nada, para no disparar guardados en falso (evita un
  // ida-y-vuelta infinito entre los celulares).
  const procesarRemoto = useCallback((snap, ms) => {
    if (!snap || snap.autor === deviceIdRef.current) return
    ultimoAjenoRef.current = Date.now() // hay otro celular activo (se usa al "Suspender", ver pausarYSalir)
    if (ms) {
      if (vistosMsRef.current.has(ms)) return
      vistosMsRef.current.add(ms)
      if (vistosMsRef.current.size > 500) vistosMsRef.current = new Set([ms])
    }

    // 1) Goles/tarjetas/faltas: unión por id, menos los borrados (de cualquiera de los dos)
    const elimRemotos = Array.isArray(snap.eventosEliminados) ? snap.eventosEliminados : []
    if (elimRemotos.length > 0) {
      setEventosEliminados(prev => {
        const nuevos = elimRemotos.filter(id => !prev.includes(id))
        return nuevos.length > 0 ? [...prev, ...nuevos] : prev
      })
    }
    setEventos(prev => {
      const elim = new Set([...eventosEliminadosRef.current, ...elimRemotos])
      let res = prev.filter(e => !elim.has(e.id))
      let cambio = res.length !== prev.length
      ;(snap.eventos || []).filter(r => !elim.has(r.id)).forEach(r => {
        const i = res.findIndex(e => e.id === r.id)
        if (i === -1) { res = [...res, r]; cambio = true }
        else if (!res[i].jugadorId && r.jugadorId) { res = res.map((e, k) => k === i ? { ...e, jugadorId: r.jugadorId } : e); cambio = true }
      })
      return cambio ? res : prev
    })

    // 2) Etapa de la planilla: solo se adelanta (colores → asignar → partido),
    // nunca se arrastra hacia atrás a quien está viendo la lista a mitad de partido.
    const RANGO = { colores: 0, asignar: 1, partido: 2 }
    setStep(prev => ((RANGO[snap.step] ?? -1) > (RANGO[prev] ?? 0)) ? snap.step : prev)

    // 3) Cronómetro / tiempo
    const relojRemoto = Number(snap.relojV) > 1e11 ? 0 : (snap.relojV || 0) // (versiones viejas guardadas con hora: se ignoran)
    const firmaRelojRemoto = `${!!snap.corriendo}|${snap.periodo}|${!!snap.tiempoAgotado}|${snap.duracionMinutos}`
    const gana = relojRemoto > relojVRef.current ||
      (relojRemoto === relojVRef.current && relojRemoto > 0 && (snap.relojAutor || '') > relojAutorRef.current && firmaRelojRemoto !== relojFirmaRef.current)
    if (gana) {
      relojVRef.current = relojRemoto
      relojAutorRef.current = snap.relojAutor || ''
      pararAlarma()
      const segs = typeof snap.segundos === 'number' ? snap.segundos : 0
      inicioEpochRef.current = snap.corriendo ? Date.now() - segs * 1000 : null
      if (typeof snap.duracionMinutos === 'number') setDuracionMinutos(snap.duracionMinutos)
      if (typeof snap.periodo === 'number') setPeriodo(snap.periodo)
      setTiempoAgotado(!!snap.tiempoAgotado)
      setSegundos(segs)
      setCorriendo(!!snap.corriendo)
    } else if (relojRemoto === relojVRef.current && snap.corriendo && snap.relojAutor && snap.relojAutor === snap.autor && inicioEpochRef.current != null) {
      // Corrección de deriva: el celular que arrancó el reloj manda sus
      // segundos exactos; si el mío se separó más de 2 s, me ajusto.
      const segsRemotos = typeof snap.segundos === 'number' ? snap.segundos : null
      const misSegs = Math.floor((Date.now() - inicioEpochRef.current) / 1000)
      if (segsRemotos != null && Math.abs(segsRemotos - misSegs) > 2) {
        inicioEpochRef.current = Date.now() - segsRemotos * 1000
        setSegundos(segsRemotos)
      }
    }

    // 4) Números, colores y arqueros: gana la edición más reciente, sin perder jugadores nuevos
    const plantillaRemota = Number(snap.plantillaV) > 1e11 ? 0 : (snap.plantillaV || 0)
    const firmaRemota = firmaPlantilla(snap)
    const ganaPlantilla = plantillaRemota > plantillaVRef.current ||
      (plantillaRemota === plantillaVRef.current && plantillaRemota > 0 && (snap.plantillaAutor || '') > plantillaAutorRef.current && firmaRemota !== plantillaSigRef.current)
    // Defensa contra "borrones": una edición normal cambia UN número a la vez.
    // Si lo que llega le quita 2 o más números de golpe a lo que este celular
    // tiene, es una copia vieja/vacía/dañada (ej. otro celular con la lista
    // sin cargar): NO se adopta. En cambio este celular re-impone su plantilla
    // con versión más alta, y así también "cura" a los demás y a la base de datos.
    const numerosAqui = contarNumeros(jugLocalRef.current) + contarNumeros(jugVisRef.current)
    const numerosRemotos = contarNumeros(snap.jugadoresLocal) + contarNumeros(snap.jugadoresVisitante)
    if (ganaPlantilla && numerosAqui - numerosRemotos > 1) {
      plantillaVRef.current = Math.max(plantillaVRef.current, plantillaRemota) + 1
      plantillaAutorRef.current = deviceIdRef.current
      setTimeout(() => { restituirRef.current && restituirRef.current() }, 0)
    } else if (ganaPlantilla) {
      plantillaVRef.current = plantillaRemota
      plantillaAutorRef.current = snap.plantillaAutor || ''
      plantillaSigRef.current = firmaRemota
      setJugadoresLocal(prev => adoptarJugadoresRemotos(prev, snap.jugadoresLocal))
      setJugadoresVisitante(prev => adoptarJugadoresRemotos(prev, snap.jugadoresVisitante))
      setColorLocal(prev => (snap.colorLocal ?? null) === prev ? prev : (snap.colorLocal ?? null))
      setColorVis(prev => (snap.colorVis ?? null) === prev ? prev : (snap.colorVis ?? null))
      const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
      setArqueroLocal(prev => igual(prev, snap.arqueroLocal ?? null) ? prev : (snap.arqueroLocal ?? null))
      setArqueroVis(prev => igual(prev, snap.arqueroVis ?? null) ? prev : (snap.arqueroVis ?? null))
      setHistArquerosLocal(prev => igual(prev, snap.histArquerosLocal || []) ? prev : (snap.histArquerosLocal || []))
      setHistArquerosVis(prev => igual(prev, snap.histArquerosVis || []) ? prev : (snap.histArquerosVis || []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Suscripción continua (no solo al abrir): apenas otro celular guarda, este
  // lo recibe por realtime y lo fusiona.
  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    const channel = supabase
      .channel(`planilla-rapida-sync-${partido.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${partido.id}` }, (payload) => {
        const nuevo = payload.new
        if (nuevo?.status === 'finished') { cierreRemoto(); return }
        const ts = nuevo?.live_state_rapida_updated_at
        procesarRemoto(nuevo?.live_state_rapida, ts ? new Date(ts).getTime() : null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [listo, partido.status, partido.id, procesarRemoto, cierreRemoto])

  // Respaldo: si el realtime del celular se cae o se demora (señal mala, app
  // en 2do plano), cada 3 s se revisa si hay un guardado más nuevo del otro
  // celular — primero solo la marca de tiempo (liviano) y solo si cambió se
  // trae el borrador completo.
  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    let ocupado = false
    async function revisar() {
      if (ocupado || document.visibilityState === 'hidden' || !navigator.onLine) return
      ocupado = true
      try {
        const { data } = await supabase.from('matches').select('status, live_state_rapida_updated_at').eq('id', partido.id).maybeSingle()
        if (!data) return
        if (data.status === 'finished') { cierreRemoto(); return }
        const ms = data.live_state_rapida_updated_at ? new Date(data.live_state_rapida_updated_at).getTime() : null
        if (!ms || vistosMsRef.current.has(ms)) { marcarSincronizado(); return }
        const { data: completo, error: errCompleto } = await supabase.from('matches').select('live_state_rapida').eq('id', partido.id).maybeSingle()
        if (errCompleto) return
        procesarRemoto(completo?.live_state_rapida, ms)
        marcarSincronizado()
      } catch (e) { /* sin señal: se reintenta en el siguiente ciclo */ } finally { ocupado = false }
    }
    const t = setInterval(revisar, 3000)
    document.addEventListener('visibilitychange', revisar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', revisar) }
  }, [listo, partido.status, partido.id, procesarRemoto, cierreRemoto])

  // ── Carga inicial ──────────────────────────────────────────────────────
  useEffect(() => { fetchTodo() }, [])

  // Ida y vuelta: busca el otro partido de la llave (mismo torneo, misma
  // fase — nunca en grupos, ahí cada partido cuenta aparte — y los mismos
  // dos equipos, sin importar quién fue local en cada uno).
  useEffect(() => {
    if (!partido?.fase || partido.fase === 'grupo' || !partido.home_team_id || !partido.away_team_id) { setPartidoHermano(null); return }
    let cancelado = false
    supabase.from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, status')
      .eq('tournament_id', partido.tournament_id)
      .eq('fase', partido.fase)
      .neq('id', partido.id)
      .or(`and(home_team_id.eq.${partido.away_team_id},away_team_id.eq.${partido.home_team_id}),and(home_team_id.eq.${partido.home_team_id},away_team_id.eq.${partido.away_team_id})`)
      .then(({ data }) => { if (!cancelado) setPartidoHermano((data || []).find(m => m.status === 'finished') || null) })
    return () => { cancelado = true }
  }, [partido?.id, partido?.tournament_id, partido?.fase, partido?.home_team_id, partido?.away_team_id])

  // Si se registra el pago de una tarjeta desde otro lado mientras esta
  // planilla rápida está abierta, se libera al jugador acá en vivo (sin
  // tocar goles/números/eventos ya cargados) — igual que en la planilla completa.
  const refetchDeudaTarjetas = useCallback(async () => {
    if (!partido?.tournament_id || !finanzasConfig) return
    const { data, error: errDeuda } = await supabase.from('player_match_stats')
      .select('player_id, match_id, yellow_cards, yellow_paid, blue_cards, blue_paid, red_cards, red_paid')
      .eq('tournament_id', partido.tournament_id)
    if (errDeuda || !Array.isArray(data)) return // sin señal: no se tocan los avisos de deuda
    const matchesInfo = await fetchMatchesInfo((data || []).map(s => s.match_id))
    const { idsDebenTarjeta, detallePorJugador, idsEquipos } = construirDeudaTarjetas(data, finanzasConfig, matchesInfo)
    setDeudaDetalle(detallePorJugador)
    if (idsEquipos.size > 0) {
      supabase.from('teams').select('id,name').in('id', [...idsEquipos]).then(({ data: eq }) => {
        if (eq) setEquiposNombre(prev => { const m = { ...prev }; eq.forEach(t => { m[t.id] = t.name }); return m })
      })
    }
    setJugadoresLocal(prev => prev.map(j => j.id ? { ...j, debeTarjeta: idsDebenTarjeta.has(j.id) } : j))
    setJugadoresVisitante(prev => prev.map(j => j.id ? { ...j, debeTarjeta: idsDebenTarjeta.has(j.id) } : j))
    // Si el jugador que tenía abierto el modal de asignar número ya pagó, se desbloquea solo.
    setModalFoto(prev => (prev && prev.jugador?.id && !idsDebenTarjeta.has(prev.jugador.id)) ? { ...prev, jugador: { ...prev.jugador, debeTarjeta: false } } : prev)
  }, [partido?.tournament_id, finanzasConfig])

  useEffect(() => {
    if (!partido?.tournament_id) return
    const channel = supabase
      .channel(`planilla-rapida-deuda-tarjetas-${partido.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_match_stats', filter: `tournament_id=eq.${partido.tournament_id}` }, () => {
        refetchDeudaTarjetas()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [partido?.tournament_id, refetchDeudaTarjetas])

  useEffect(() => { deudaDetalleRef.current = deudaDetalle }, [deudaDetalle])
  useEffect(() => { finanzasConfigRef.current = finanzasConfig }, [finanzasConfig])

  // Si el admin/organizador registra (o inscribe) un jugador nuevo en
  // alguno de los dos equipos MIENTRAS esta planilla está abierta, se suma
  // solo a la lista en vivo — sin tocar los números/eventos que el árbitro
  // ya tiene cargados (misma lógica de fusionarJugadores que usa la carga
  // inicial cuando llega un borrador remoto más nuevo).
  const refetchRoster = useCallback(async () => {
    if (!partido?.tournament_id || partido.status === 'finished') return
    const [jugsL, jugsV, sancionesDB] = await Promise.all([
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,photo_face_url,photo_url,foto_cambiar_tarjeta,foto_cambiar_perfil,foto_cambiar_cedula_frontal,foto_cambiar_cedula_trasera)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.home_team_id).eq('activo', true),
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,photo_face_url,photo_url,foto_cambiar_tarjeta,foto_cambiar_perfil,foto_cambiar_cedula_frontal,foto_cambiar_cedula_trasera)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.away_team_id).eq('activo', true),
      supabase.from('sanciones').select('player_id, fecha_fin, partidos_pendientes').eq('activa', true).or(`tournament_id.eq.${partido.tournament_id},tournament_id.is.null`),
    ])
    // Si CUALQUIERA de las consultas falló (señal mala, timeout) no se toca la
    // lista: una respuesta vacía por error NO significa "no hay jugadores".
    if (jugsL.error || jugsV.error || sancionesDB.error || !Array.isArray(jugsL.data) || !Array.isArray(jugsV.data)) return
    const hoyIso = new Date().toISOString()
    const idsSancionados = new Set((sancionesDB?.data || [])
      .filter(s => (!s.fecha_fin || s.fecha_fin > hoyIso) && (s.partidos_pendientes === null || s.partidos_pendientes === undefined || s.partidos_pendientes > 0))
      .map(s => s.player_id))
    const idsDebenTarjeta = new Set(Object.keys(deudaDetalleRef.current || {}))
    const tieneFotoPendiente = (p) => !!(p?.foto_cambiar_tarjeta || p?.foto_cambiar_perfil || p?.foto_cambiar_cedula_frontal || p?.foto_cambiar_cedula_trasera)
    const mapJug = data => (data || [])
      .filter(r => !idsSancionados.has(r.players?.id))
      .map(r => ({ id: r.players?.id, nombre: r.players?.name || '', cedula: r.players?.numero_cedula || '', numero: '', photo_face_url: r.players?.photo_face_url || null, photo_url: r.players?.photo_url || null, debeTarjeta: idsDebenTarjeta.has(r.players?.id), debeFoto: tieneFotoPendiente(r.players), debeInscripcion: debeInscripcionReg(r, finanzasConfigRef.current) }))
    setJugadoresLocal(prev => fusionarJugadores(prev, mapJug(jugsL.data)))
    setJugadoresVisitante(prev => fusionarJugadores(prev, mapJug(jugsV.data)))
    // Si le marcaron el pago de inscripción al jugador que tiene abierto el modal, se desbloquea solo.
    const idsInscDeben = new Set([...jugsL.data, ...jugsV.data].filter(r => debeInscripcionReg(r, finanzasConfigRef.current)).map(r => r.players?.id))
    setModalFoto(prev => (prev?.jugador?.debeInscripcion && prev.jugador.id && !idsInscDeben.has(prev.jugador.id)) ? { ...prev, jugador: { ...prev.jugador, debeInscripcion: false } } : prev)
  }, [partido?.tournament_id, partido?.home_team_id, partido?.away_team_id, partido?.status])

  useEffect(() => {
    if (!partido?.tournament_id || partido.status === 'finished') return
    const channel = supabase
      .channel(`planilla-rapida-roster-${partido.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_player_registrations', filter: `tournament_id=eq.${partido.tournament_id}` }, () => {
        refetchRoster()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [partido?.tournament_id, partido?.status, refetchRoster])

  // Respaldo de jugadores nuevos y pagos de tarjetas: el realtime de esas dos
  // tablas depende de que estén habilitadas en Supabase, y si no lo están (o
  // el celular pierde el websocket) la planilla quedaba con la lista vieja.
  // Cada 8 s y al volver a la app se revisa de nuevo — así un jugador recién
  // registrado aparece solo y una tarjeta pagada se desbloquea sola.
  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    function refrescar() {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return
      refetchRoster()
      refetchDeudaTarjetas()
    }
    const t = setInterval(refrescar, 8000)
    document.addEventListener('visibilitychange', refrescar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', refrescar) }
  }, [listo, partido.status, refetchRoster, refetchDeudaTarjetas])

  // Antes se pedía la pantalla completa REAL del navegador (Fullscreen API)
  // para ocultar también la barra de arriba del celular. Se quitó: cada vez
  // que el navegador entra a ese modo, muestra SOLO (el celular, no
  // Golmebol — no hay forma de acortarlo ni quitarlo desde el código) un
  // aviso de "www.golmebol.com: para salir de la pantalla completa,
  // arrastra..." que se quedaba tapando la planilla y estorbando mientras
  // el árbitro la estaba usando. Sin este pedido, el celular ya no muestra
  // ese aviso — la planilla sigue viéndose a pantalla completa igual (con
  // el alto real del celular, ver 100dvh en los estilos), solo que sin
  // forzar el modo Fullscreen del navegador.

  // Baja la marca de agua "Creada por GOLMEBOL" al fondo mientras esta
  // planilla está abierta (arriba tapa el header) — ver index.css.
  useEffect(() => {
    document.body.classList.add('gm-planilla-abierta')
    return () => { document.body.classList.remove('gm-planilla-abierta') }
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
    const [jugsL, jugsV, torn, liveDB, sancionesDB, tarjetasDB] = await Promise.all([
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,photo_face_url,photo_url,foto_cambiar_tarjeta,foto_cambiar_perfil,foto_cambiar_cedula_frontal,foto_cambiar_cedula_trasera)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.home_team_id).eq('activo', true),
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,photo_face_url,photo_url,foto_cambiar_tarjeta,foto_cambiar_perfil,foto_cambiar_cedula_frontal,foto_cambiar_cedula_trasera)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.away_team_id).eq('activo', true),
      supabase.from('tournaments').select('modalidad, finanzas_config, registro_simple, duracion_tiempo_min').eq('id', partido.tournament_id).maybeSingle(),
      supabase.from('matches').select('live_state_rapida, live_state_rapida_updated_at').eq('id', partido.id).maybeSingle(),
      // Jugadores sancionados (de este torneo, o globales): no se les deja aparecer en la planilla mientras no esté ya jugado
      supabase.from('sanciones').select('player_id, fecha_fin, partidos_pendientes').eq('activa', true).or(`tournament_id.eq.${partido.tournament_id},tournament_id.is.null`),
      // Tarjetas sin pagar de este torneo: para avisarle al árbitro en la planilla
      // (con match_id para poder traer aparte los datos del partido y armar el detalle)
      supabase.from('player_match_stats').select('player_id, match_id, yellow_cards, yellow_paid, blue_cards, blue_paid, red_cards, red_paid').eq('tournament_id', partido.tournament_id),
    ])
    const modalidadDB = torn.data?.modalidad
    // La duración propia del torneo (si el organizador la configuró al
    // crear/editar el torneo) manda sobre el valor por defecto de la modalidad.
    const duracionPropia = Number(torn.data?.duracion_tiempo_min)
    const dur = duracionPropia > 0 ? duracionPropia : modalidadDB === 'Fútbol 7' ? 25 : modalidadDB === 'Fútbol 11' ? 45 : 20
    setModalidad(modalidadDB)

    // Un partido ya jugado conserva su alineación histórica tal cual —
    // la sanción solo bloquea que aparezca como opción hacia adelante.
    if (partido.status !== 'finished') {
      const hoyIso = new Date().toISOString()
      const idsSancionados = new Set((sancionesDB?.data || [])
        .filter(s => (!s.fecha_fin || s.fecha_fin > hoyIso) && (s.partidos_pendientes === null || s.partidos_pendientes === undefined || s.partidos_pendientes > 0))
        .map(s => s.player_id))
      if (idsSancionados.size > 0) {
        if (jugsL.data) jugsL.data = jugsL.data.filter(r => !idsSancionados.has(r.players?.id))
        if (jugsV.data) jugsV.data = jugsV.data.filter(r => !idsSancionados.has(r.players?.id))
      }
    }

    // Jugadores que deben alguna tarjeta de este torneo (solo si el torneo cobra
    // por tarjetas) — con detalle (tipo, monto, partido) para el modal de asignar número.
    const fcTorneoDeuda = torn.data?.finanzas_config || {}
    setFinanzasConfig(fcTorneoDeuda)
    setRegistroSimple(torn.data?.registro_simple === true)
    const matchesInfoDeuda = await fetchMatchesInfo((tarjetasDB?.data || []).map(s => s.match_id))
    const { idsDebenTarjeta, detallePorJugador, idsEquipos } = construirDeudaTarjetas(tarjetasDB?.data, fcTorneoDeuda, matchesInfoDeuda)
    setDeudaDetalle(detallePorJugador)
    if (idsEquipos.size > 0) {
      supabase.from('teams').select('id,name').in('id', [...idsEquipos]).then(({ data }) => {
        if (data) setEquiposNombre(prev => { const m = { ...prev }; data.forEach(t => { m[t.id] = t.name }); return m })
      })
    }

    const tieneFotoPendiente = (p) => !!(p?.foto_cambiar_tarjeta || p?.foto_cambiar_perfil || p?.foto_cambiar_cedula_frontal || p?.foto_cambiar_cedula_trasera)
    const mapJug = data => (data || []).map(r => ({ id: r.players?.id, nombre: r.players?.name || '', cedula: r.players?.numero_cedula || '', numero: '', photo_face_url: r.players?.photo_face_url || null, photo_url: r.players?.photo_url || null, debeTarjeta: idsDebenTarjeta.has(r.players?.id), debeFoto: tieneFotoPendiente(r.players), debeInscripcion: debeInscripcionReg(r, fcTorneoDeuda) }))
    let baseLocal = mapJug(jugsL.data)
    let baseVis = mapJug(jugsV.data)
    const idsDebenFoto = new Set([...(jugsL.data||[]), ...(jugsV.data||[])].filter(r => tieneFotoPendiente(r.players)).map(r => r.players?.id))

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
        aplicarDeudaTarjeta(idsDebenTarjeta, idsDebenFoto)
        // El snapshot guardado puede ser de ANTES de que se registraran
        // jugadores nuevos en el equipo (ej. se abrió la planilla una vez
        // sin nadie inscrito, se guardó ese borrador, y luego se inscribió
        // gente) — se fusiona siempre con el roster fresco de la BD para no
        // quedarse pegado con una lista vieja/vacía.
        setJugadoresLocal(prev => fusionarJugadores(prev, baseLocal))
        setJugadoresVisitante(prev => fusionarJugadores(prev, baseVis))
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
      // (otro árbitro guardó desde otro celular) — lo aplico encima, y
      // también fusiono con el roster fresco (mismo motivo que arriba).
      aplicarSnap(remoteSnap, dur)
      aplicarDeudaTarjeta(idsDebenTarjeta, idsDebenFoto)
      setJugadoresLocal(prev => fusionarJugadores(prev, baseLocal))
      setJugadoresVisitante(prev => fusionarJugadores(prev, baseVis))
      try { localStorage.setItem(localKey, JSON.stringify(remoteSnap)) } catch (e) {}
    } else {
      // El borrador local sigue siendo el más nuevo: solo sumo jugadores
      // nuevos que se hayan registrado después de armarlo, sin tocar nada
      // de lo que el árbitro ya tiene anotado.
      setJugadoresLocal(prev => fusionarJugadores(prev, baseLocal))
      setJugadoresVisitante(prev => fusionarJugadores(prev, baseVis))
    }
    // Ya se consultó lo que hay en la base de datos: desde ahora sí se puede subir.
    if (!liveDB?.error) marcarSincronizado()
  }

  // Un borrador (local o remoto) puede traer jugadores sin el flag de deuda
  // recalculado — se le pega encima después de aplicar el snapshot.
  function aplicarDeudaTarjeta(idsDebenTarjeta, idsDebenFoto) {
    if (idsDebenTarjeta && idsDebenTarjeta.size > 0) {
      setJugadoresLocal(prev => prev.map(j => j.id && idsDebenTarjeta.has(j.id) ? { ...j, debeTarjeta: true } : j))
      setJugadoresVisitante(prev => prev.map(j => j.id && idsDebenTarjeta.has(j.id) ? { ...j, debeTarjeta: true } : j))
    }
    if (idsDebenFoto && idsDebenFoto.size > 0) {
      setJugadoresLocal(prev => prev.map(j => j.id && idsDebenFoto.has(j.id) ? { ...j, debeFoto: true } : j))
      setJugadoresVisitante(prev => prev.map(j => j.id && idsDebenFoto.has(j.id) ? { ...j, debeFoto: true } : j))
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
    setEventosEliminados(snap.eventosEliminados || [])
    relojVRef.current = Number(snap.relojV) > 1e11 ? 0 : (snap.relojV || 0)
    relojAutorRef.current = snap.relojAutor || ''
    plantillaVRef.current = Number(snap.plantillaV) > 1e11 ? 0 : (snap.plantillaV || 0)
    plantillaAutorRef.current = snap.plantillaAutor || ''
    plantillaSigRef.current = firmaPlantilla(snap)
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
    const base = { jugadoresLocal, jugadoresVisitante, colorLocal, colorVis, arqueroLocal, arqueroVis, histArquerosLocal, histArquerosVis }
    // Si la plantilla cambió de verdad por una edición de ESTE celular, se le
    // sube la versión (así gana frente a una copia más vieja del otro celular).
    const firma = firmaPlantilla(base)
    if (firma !== plantillaSigRef.current) { plantillaSigRef.current = firma; plantillaVRef.current += 1; plantillaAutorRef.current = deviceIdRef.current }
    // Con el reloj andando, los segundos exactos salen del ancla de hora real
    // (no del último "tick" pintado) — así el otro celular arranca igualito.
    let segs = segundos
    if (corriendo && inicioEpochRef.current != null) segs = Math.min(duracionMinutos * 60, Math.floor((Date.now() - inicioEpochRef.current) / 1000))
    return { ...base, eventos, eventosEliminados, periodo, segundos: segs, corriendo, tiempoAgotado, duracionMinutos, step, autor: deviceIdRef.current, plantillaV: plantillaVRef.current, plantillaAutor: plantillaAutorRef.current, relojV: relojVRef.current, relojAutor: relojAutorRef.current, savedAt: new Date().toISOString() }
  }
  // Re-sube ya mismo el estado de ESTE celular (ver defensa de borrones en procesarRemoto)
  restituirRef.current = () => { try { localStorage.setItem(localKey, JSON.stringify(construirSnap())) } catch (e) {}; guardarRemotoInmediato(construirSnap()) }
  function guardarRemotoInmediato(snap) {
    if (!navigator.onLine || !sincronizadoRef.current) return
    const ts = new Date().toISOString()
    vistosMsRef.current.add(new Date(ts).getTime()) // para no tratar mi propio guardado como si fuera del otro celular
    supabase.from('matches').update({ live_state_rapida: snap, live_state_rapida_updated_at: ts }).eq('id', partido.id).then(() => {}, () => {})
  }
  function guardarRemotoDebounced(snap) {
    clearTimeout(remoteTimer.current)
    remoteTimer.current = setTimeout(() => guardarRemotoInmediato(snap), 350)
  }

  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch (e) {}
    guardarRemotoDebounced(snap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jugadoresLocal, jugadoresVisitante, colorLocal, colorVis, arqueroLocal, arqueroVis, histArquerosLocal, histArquerosVis, eventos, eventosEliminados, periodo, tiempoAgotado, duracionMinutos, step, sincronizado])

  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch (e) {}
    if (corriendo && segundos % 8 === 0) guardarRemotoInmediato(snap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos])

  // Cualquier cambio del RELOJ (arrancar, pausar, cambiar de tiempo, se acabó
  // el tiempo) se manda de inmediato, sin esperar el autoguardado — así el
  // otro celular arranca/pausa casi al mismo instante.
  const relojPrevRef = useRef(null)
  useEffect(() => {
    if (!listo || partido.status === 'finished') return
    const firma = `${corriendo}|${periodo}|${tiempoAgotado}|${duracionMinutos}`
    if (relojPrevRef.current === null) { relojPrevRef.current = firma; return }
    if (relojPrevRef.current === firma) return
    relojPrevRef.current = firma
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch (e) {}
    clearTimeout(remoteTimer.current)
    guardarRemotoInmediato(snap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, corriendo, periodo, tiempoAgotado, duracionMinutos])

  // ── Cronómetro ─────────────────────────────────────────────────────────
  // Se ancla a la hora real (Date.now), no a "ir sumando 1 cada segundo": así,
  // si el celular se bloquea o el árbitro cambia de app y el navegador frena
  // el setInterval, al volver se recalcula el tiempo real transcurrido en vez
  // de quedar atrasado o directamente detenido.
  useEffect(() => {
    if (!corriendo) return
    if (inicioEpochRef.current == null) inicioEpochRef.current = Date.now() - segundos * 1000

    function recalcular() {
      // Si el ancla se borró mientras el reloj seguía andando (ej. al aplicar un
      // borrador del otro celular), se rehace desde el segundo que se ve. Antes,
      // con el ancla en null el cálculo daba un tiempo enorme y el reloj saltaba
      // al final con la alarma, parando el partido para todos.
      if (inicioEpochRef.current == null) inicioEpochRef.current = Date.now() - segundosRef.current * 1000
      const limite = duracionMinutos * 60
      const elapsed = Math.floor((Date.now() - inicioEpochRef.current) / 1000)
      setSegundos(elapsed >= limite ? limite : elapsed)
      if (elapsed >= limite && !tiempoAgotado) { nuevaAccionReloj(); setTiempoAgotado(true); setCorriendo(false); iniciarAlarma() }
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
    nuevaAccionReloj()
    if (corriendo) inicioEpochRef.current = null // se pausa: al reanudar se recalcula el ancla desde el segundo actual
    setCorriendo(c => !c)
  }

  // Suspender el partido y salir SIN guardar resultado (no queda "jugado"):
  // pausa el reloj primero (si seguía corriendo) para que el tiempo restante
  // quede correcto al retomarlo, guarda el borrador ya mismo y sale. Al volver
  // a entrar a este mismo partido, la planilla se restaura tal cual quedó.
  function pausarYSalir() {
    // Con otro celular todavía planillando, salir de ESTE no pausa ni "suspende"
    // el partido: el otro sigue con el reloj y todo lo cargado. Además de la
    // presencia (que puede tardar o fallar con mala señal) se mira si el otro
    // celular mandó algo hace poco: antes, salir de un celular "de apoyo" cuando
    // la presencia no había cargado PAUSABA el reloj en todos los celulares.
    const hayOtroActivo = otrosCelulares > 0 || (Date.now() - ultimoAjenoRef.current < 25000)
    if (hayOtroActivo) {
      if (!window.confirm('Vas a salir de esta planilla SIN guardar el resultado.\n\nEl otro celular sigue con el partido (reloj, goles y tarjetas siguen igual). Podés volver a entrar cuando quieras.\n\n¿Continuar?')) return
      pararAlarma()
      guardarRemotoInmediato(construirSnap())
      onClose && onClose()
      return
    }
    const seguiaCorriendo = corriendo
    if (!window.confirm(seguiaCorriendo
      ? 'Se va a pausar el cronómetro y salir SIN guardar el resultado.\n\nEl partido queda pendiente — podés volver a entrar después y seguir jugando el tiempo que falta.\n\n¿Continuar?'
      : 'Vas a salir SIN guardar el resultado.\n\nEl partido queda pendiente — podés volver a entrar después y seguir donde quedó.\n\n¿Continuar?')) return
    pararAlarma()
    inicioEpochRef.current = null
    if (seguiaCorriendo) { nuevaAccionReloj(); setCorriendo(false) }
    // pausado:true → para que este partido deje de salir en "en vivo" en la
    // pantalla de inicio hasta que el árbitro vuelva a entrar y siga jugando
    // (el próximo guardado automático ya no manda este campo, así que vuelve
    // a aparecer en vivo solo).
    const snap = { ...construirSnap(), corriendo: false, pausado: true }
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch (e) {}
    guardarRemotoInmediato(snap)
    onClose && onClose()
  }
  function cambiarPeriodo() {
    if (periodo === 2) return
    pararAlarma()
    inicioEpochRef.current = null
    nuevaAccionReloj()
    setPeriodo(2); setSegundos(0); setTiempoAgotado(false); setCorriendo(false)
  }

  // ── Asignación de camisetas ────────────────────────────────────────────
  function abrirJugador(team, index) {
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    setModalFoto({ team, index, jugador: arr[index] })
  }
  // Torneos de "registro simple" (los internacionales): apenas un jugador
  // sin registro queda con nombre + número puestos en la planilla (no hay
  // que esperar a que termine el partido), se crea de una en Golmebol y
  // queda inscrito en el equipo/torneo — así ya sale identificado (no como
  // "Jugador" genérico) en todo lo que se vea EN VIVO mientras se juega.
  async function registrarSimpleSiFalta(team, nombre, numero) {
    if (!registroSimple) return
    const nombreLimpio = (nombre || '').trim()
    if (!nombreLimpio || !(numero || '').trim()) return
    const key = `${team}|${nombreLimpio.toLowerCase()}`
    if (registroSimpleEnCursoRef.current.has(key)) return
    registroSimpleEnCursoRef.current.add(key)
    const team_id = team === 'local' ? partido.home_team_id : partido.away_team_id
    try {
      const { data: nuevo, error } = await supabase.from('players')
        .insert({ name: nombreLimpio, activo_membresia: true, fecha_registro: new Date().toISOString() })
        .select().single()
      if (error || !nuevo) { registroSimpleEnCursoRef.current.delete(key); return }
      await supabase.from('team_players').insert({ team_id, player_id: nuevo.id, activo: true })
      await supabase.from('tournament_player_registrations').insert({ tournament_id: partido.tournament_id, team_id, player_id: nuevo.id, activo: true })
      const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
      setArr(prev => prev.map(j => (!j.id && (j.nombre || '').trim().toLowerCase() === nombreLimpio.toLowerCase()) ? { ...j, id: nuevo.id } : j))
      // Si ya había metido un gol/tarjeta antes de completar el registro, ese
      // evento también queda con el id real (para que ya no salga como "sin registro").
      setEventos(prev => prev.map(e => (!e.jugadorId && e.team === team && (e.jugadorNombre || '').trim().toLowerCase() === nombreLimpio.toLowerCase()) ? { ...e, jugadorId: nuevo.id } : e))
    } catch (e) {
      registroSimpleEnCursoRef.current.delete(key)
      /* si falla, el jugador sigue sin registro (se reintenta en el guardado final) */
    }
  }

  function confirmarNumero(numero, nombre) {
    const { team, index } = modalFoto
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const dup = arr.some((j, i) => i !== index && (j.numero || '').trim() === numero)
    if (dup) { alert(`El número ${numero} ya está asignado a otro jugador de este equipo.`); return }
    const nuevo = [...arr]
    const eraSinRegistro = !nuevo[index].id
    nuevo[index] = { ...nuevo[index], numero, ...(nuevo[index].id ? {} : { nombre }) }
    setArr(nuevo)
    setModalFoto(null)
    if (eraSinRegistro) registrarSimpleSiFalta(team, nombre, numero)
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

  // El árbitro YA NO puede cobrar/desbloquear tarjetas desde la planilla —
  // eso ahora solo lo hace el organizador, desde Finanzas del torneo o desde
  // el link de "Deudores de tarjetas" que genera para ese fin. Por eso acá
  // NO se le pasa onPagarEnCancha a ModalFotoNumero: sin ese prop, el modal
  // ya sabe mostrar solo el aviso de "no se le puede poner número hasta que
  // se ponga al día" (ver ModalFotoNumero.jsx), sin botón de pago.

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
    setEventosEliminados(prev => prev.includes(id) ? prev : [...prev, id]) // para que el otro celular también lo borre
  }
  function resolverAlertaApellido(nombreApellido) {
    const { team, numero, tipo } = alertaNumero
    const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const nuevoJugador = { ...filaVacia(), nombre: nombreApellido, numero }
    setArr([...arr, nuevoJugador])
    agregarEventoParaJugador(team, nuevoJugador, tipo)
    setAlertaNumero(null)
    registrarSimpleSiFalta(team, nombreApellido, numero)
  }
  // El árbitro se equivocó de número (o no lo sabía) pero el jugador SÍ está
  // en la lista del equipo — se busca por nombre en vez de anotarlo como
  // jugador sin registro, y le queda puesto el número que jugó.
  function resolverAlertaConJugadorExistente(jugadorExistente) {
    const { team, numero, tipo } = alertaNumero
    const setArr = team === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const arr = team === 'local' ? jugadoresLocal : jugadoresVisitante
    const idx = arr.findIndex(j => (j.id && j.id === jugadorExistente.id) || j === jugadorExistente)
    if (idx === -1) return
    const actualizado = { ...arr[idx], numero }
    const nuevo = [...arr]
    nuevo[idx] = actualizado
    setArr(nuevo)
    agregarEventoParaJugador(team, actualizado, tipo)
    setAlertaNumero(null)
  }

  // ── Guardado final ─────────────────────────────────────────────────────
  async function guardarFinal({ informeTexto, mvpId }) {
    finalizandoRef.current = true
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

    // Torneos de "registro simple" (los internacionales): un jugador SIN
    // registro en la planilla queda creado e inscrito de una en el equipo y
    // el torneo (sin cédula) — así sus goles/tarjetas de este partido sí
    // cuentan en goleadores/récords, no solo en el resultado. Se mutan los
    // objetos ya existentes (jugadoresLocal/Visitante, eventos, arqueros) en
    // vez de disparar un re-render, para que todo lo que se arma más abajo
    // en este mismo guardado ya vea el id nuevo.
    if (registroSimple) {
      const nombreKey = (team, nombre) => `${team}|${(nombre || '').trim().toLowerCase()}`
      const idsNuevos = new Map()
      const registrarSiFalta = async (jugadores, team, team_id) => {
        for (const j of jugadores) {
          if (j.id || !(j.nombre || '').trim()) continue
          try {
            const { data: nuevo, error: errNuevo } = await supabase.from('players')
              .insert({ name: j.nombre.trim(), activo_membresia: true, fecha_registro: new Date().toISOString() })
              .select().single()
            if (errNuevo || !nuevo) continue
            await supabase.from('team_players').insert({ team_id, player_id: nuevo.id, activo: true })
            await supabase.from('tournament_player_registrations').insert({ tournament_id: partido.tournament_id, team_id, player_id: nuevo.id, activo: true })
            j.id = nuevo.id
            idsNuevos.set(nombreKey(team, j.nombre), nuevo.id)
          } catch { /* si falla, el jugador sigue sin registro (como antes) */ }
        }
      }
      await registrarSiFalta(jugadoresLocal, 'local', partido.home_team_id)
      await registrarSiFalta(jugadoresVisitante, 'visitante', partido.away_team_id)
      if (idsNuevos.size > 0) {
        eventos.forEach(e => {
          if (!e.jugadorId && e.jugadorNombre) {
            const nuevoId = idsNuevos.get(nombreKey(e.team, e.jugadorNombre))
            if (nuevoId) e.jugadorId = nuevoId
          }
        })
        histArquerosLocal.forEach(a => { if (!a.id && a.nombre) { const nid = idsNuevos.get(nombreKey('local', a.nombre)); if (nid) a.id = nid } })
        histArquerosVis.forEach(a => { if (!a.id && a.nombre) { const nid = idsNuevos.get(nombreKey('visitante', a.nombre)); if (nid) a.id = nid } })
        if (arqueroLocal && !arqueroLocal.id && arqueroLocal.nombre) { const nid = idsNuevos.get(nombreKey('local', arqueroLocal.nombre)); if (nid) arqueroLocal.id = nid }
        if (arqueroVis && !arqueroVis.id && arqueroVis.nombre) { const nid = idsNuevos.get(nombreKey('visitante', arqueroVis.nombre)); if (nid) arqueroVis.id = nid }
      }
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
      else await limpiarStatsObsoletas(partido.id, statsRows.map(r => r.player_id))
    }

    // Sanción automática por tarjeta roja: mínimo 1 fecha, igual que en la
    // planilla completa (ver PlanillaPartido.jsx para el mismo comentario).
    try {
      const equiposPartido = [partido.home_team_id, partido.away_team_id].filter(Boolean)
      // partido.status ya era 'finished' cuando se abrió esta planilla = esto
      // es una edición, no el primer guardado → no se descuenta de nuevo.
      if (partido.status !== 'finished' && equiposPartido.length > 0) {
        const { data: pendientes } = await supabase.from('sanciones').select('id, partidos_pendientes')
          .eq('activa', true).not('partidos_pendientes', 'is', null).gt('partidos_pendientes', 0).in('team_id', equiposPartido)
        for (const s of (pendientes || [])) {
          const restante = (s.partidos_pendientes || 1) - 1
          await supabase.from('sanciones').update({ partidos_pendientes: restante, activa: restante > 0 }).eq('id', s.id)
        }
      }
      const conRoja = statsRows.filter(r => r.red_cards > 0)
      if (conRoja.length > 0) {
        const { data: yaExisten } = await supabase.from('sanciones').select('player_id').eq('match_id', partido.id).in('player_id', conRoja.map(r => r.player_id))
        const idsConSancion = new Set((yaExisten || []).map(s => s.player_id))
        const nuevasSanciones = conRoja.filter(r => !idsConSancion.has(r.player_id)).map(r => ({
          player_id: r.player_id, team_id: r.team_id, tournament_id: partido.tournament_id, match_id: partido.id,
          motivo: 'Tarjeta roja automática (mínimo 1 fecha) — el organizador puede extenderla desde el torneo',
          activa: true, partidos_pendientes: 1, fecha_fin: null,
        }))
        if (nuevasSanciones.length > 0) await supabase.from('sanciones').insert(nuevasSanciones)
      }
    } catch (e) { console.error('sanción automática roja:', e) }

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

    await resolverPrediccionesPartido(partido.id, golesLocalTotal, golesVisTotal)

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

  // ── Guardado de partido por W o Desierto (no se jugó) ──────────────────
  // Construido desde cero: la rápida no tenía este concepto (a diferencia de
  // la planilla completa). No hay eventos/arqueros/estadísticas que guardar
  // porque no se jugó — solo el resultado, el tipo y (si es W) la foto del
  // equipo que sí se presentó.
  async function guardarFinalEspecial({ tipo, equipoGana, foto }) {
    finalizandoRef.current = true
    setGuardandoDB(true)
    const golesLocalTotal = tipo === 'w' ? (equipoGana === 'local' ? 3 : 0) : 0
    const golesVisTotal   = tipo === 'w' ? (equipoGana === 'visitante' ? 3 : 0) : 0
    const erroresGuardado = []

    if (partido.status === 'finished') {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        let editorName = user?.email || 'Desconocido'
        if (user?.id) { const { data: pRow } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle(); if (pRow?.name) editorName = pRow.name }
        await supabase.from('match_edit_log').insert({ match_id: partido.id, editor_user_id: user?.id || null, editor_name: editorName, editor_email: user?.email || null })
      } catch (e) { console.error('No se pudo registrar la edición post-cierre:', e) }
    }

    // Foto del equipo que sí se presentó
    let fotoWUrl = null
    if (foto) {
      try {
        const liviana = await comprimirImagen(foto)
        const path = `partidos_w/${partido.id}_${Date.now()}.jpg`
        const { error: errFoto } = await supabase.storage.from('teams').upload(path, liviana, { upsert: true, contentType: 'image/jpeg' })
        if (!errFoto) {
          const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
          fotoWUrl = urlData.publicUrl
        } else {
          console.error('No se pudo subir la foto del equipo (W):', errFoto.message)
        }
      } catch (e) { console.error('No se pudo subir la foto del equipo (W):', e.message) }
    }

    // No se jugó: se limpian eventos/arqueros de un guardado previo, por si
    // se está reeditando un partido que antes sí se había jugado.
    await supabase.from('match_events').delete().eq('match_id', partido.id)
    await supabase.from('partido_arqueros').delete().eq('match_id', partido.id)
    // Y nadie jugó: fuera también las estadísticas individuales de ese guardado previo.
    await borrarStatsDePartido(partido.id)

    const updatePartido = {
      home_score: golesLocalTotal, away_score: golesVisTotal, status: 'finished',
      live_state_rapida: null, live_state_rapida_updated_at: null, tipo_resultado: tipo,
    }
    if (fotoWUrl) updatePartido.foto_w_url = fotoWUrl
    let { error: errPartido } = await supabase.from('matches').update(updatePartido).eq('id', partido.id)
    // Si falta la migración de foto_w_url, se reintenta sin ella: el
    // resultado no se debe perder por un dato secundario.
    if (errPartido && (errPartido.message || '').includes(`'foto_w_url'`)) {
      delete updatePartido.foto_w_url
      ;({ error: errPartido } = await supabase.from('matches').update(updatePartido).eq('id', partido.id))
    }
    if (errPartido) erroresGuardado.push('Resultado: ' + errPartido.message)

    await anularPrediccionesPartido(partido.id)

    if (erroresGuardado.length > 0) {
      setGuardandoDB(false)
      alert('⚠️ NO SE PUDO GUARDAR EL RESULTADO:\n\n' + erroresGuardado.join('\n') + '\n\nIntenta de nuevo con buena señal.')
      return
    }

    try { localStorage.removeItem(localKey) } catch (e) {}
    setGuardandoDB(false)
    setMostrarEspecial(false)
    onGuardarResultado && onGuardarResultado(golesLocalTotal, golesVisTotal)
    onClose && onClose()
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: FONDO, display: 'flex', alignItems: 'center', justifyContent: 'center', color: CIAN, fontFamily: 'system-ui,sans-serif' }}>
      Cargando planilla rápida...
    </div>
  )

  if (step === 'colores') return (
    <>
      {bannerCoPlanillaje()}
      <PantallaColores
        nombreLocal={nombreLocal} nombreVis={nombreVis} colorLocal={colorLocal} colorVis={colorVis}
        onElegir={(team, hex) => { team === 'local' ? setColorLocal(hex) : setColorVis(hex) }}
        onContinuar={() => setStep('asignar')}
      />
    </>
  )

  if (step === 'asignar') return (
    <>
      {bannerCoPlanillaje()}
      <PantallaAsignarNumeros
        nombreLocal={nombreLocal} nombreVis={nombreVis} colorLocal={colorLocal} colorVis={colorVis}
        jugadoresLocal={jugadoresLocal} jugadoresVisitante={jugadoresVisitante}
        onAbrirJugador={abrirJugador}
        onVolverColores={() => setStep('colores')}
        onContinuar={() => { setStep('partido'); setVolviendoDesdePartido(false) }}
        volviendoDesdePartido={volviendoDesdePartido}
        tarifaInscripcion={finanzasConfig?.inscripcion_jugador || 0}
      />
      {modalFoto && (
        <ModalFotoNumero jugador={modalFoto.jugador} tarifaInscripcion={finanzasConfig?.inscripcion_jugador || 0} deudaItems={deudaDetalle[modalFoto.jugador?.id] || []} equiposNombre={equiposNombre}
          onConfirmar={confirmarNumero} onQuitar={quitarNumero} onCerrar={() => setModalFoto(null)}/>
      )}
    </>
  )

  const eventosLocal = eventos.filter(e => e.team === 'local')
  const eventosVis = eventos.filter(e => e.team === 'visitante')
  const hayRoja = eventos.some(e => e.tipo === 'red_card')

  // Marcador GLOBAL de la llave (goles de este partido + los del hermano ya
  // jugado), en términos de local/visitante de ESTE partido.
  const globalLlave = (() => {
    if (!partidoHermano) return null
    const golesLocalActual = eventosLocal.filter(e => e.tipo === 'goal').length
    const golesVisActual = eventosVis.filter(e => e.tipo === 'goal').length
    const invertido = partidoHermano.home_team_id === partido.away_team_id
    const otroLocal     = invertido ? (partidoHermano.away_score || 0) : (partidoHermano.home_score || 0)
    const otroVisitante = invertido ? (partidoHermano.home_score || 0) : (partidoHermano.away_score || 0)
    return { local: golesLocalActual + otroLocal, visitante: golesVisActual + otroVisitante }
  })()

  return (
    <>
      {bannerCoPlanillaje()}
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
        onSalir={pausarYSalir} onAbrirEspecial={() => setMostrarEspecial(true)}
        globalLlave={globalLlave}
      />
      {alertaNumero && (
        <AlertaNumeroDesconocido
          numero={alertaNumero.numero} equipoNombre={alertaNumero.team === 'local' ? nombreLocal : nombreVis}
          jugadores={alertaNumero.team === 'local' ? jugadoresLocal : jugadoresVisitante}
          onAnotarApellido={resolverAlertaApellido}
          onSeleccionarExistente={resolverAlertaConJugadorExistente}
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
      {mostrarEspecial && (
        <ModalPartidoEspecialRapida
          nombreLocal={nombreLocal} nombreVis={nombreVis}
          guardando={guardandoDB} onConfirmar={guardarFinalEspecial} onCerrar={() => setMostrarEspecial(false)}
        />
      )}
    </>
  )
}
