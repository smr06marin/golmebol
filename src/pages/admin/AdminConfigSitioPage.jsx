import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Radio, Plus, Trash2, Upload, Repeat, X, PlayCircle, Gauge, Table2, ListOrdered, Ban, Link2, Copy, Check, Users, Megaphone } from 'lucide-react'
import LiveEmbed, { detectarPlataforma } from '../../components/LiveEmbed'
import MarcadorEnVivoOverlay from '../../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../../components/GolesEnVivoOverlay'
import TablaEnVivoOverlay from '../../components/TablaEnVivoOverlay'
import JugadoresEnVivoOverlay from '../../components/JugadoresEnVivoOverlay'
import PatrocinadorEnVivoOverlay from '../../components/PatrocinadorEnVivoOverlay'
import { derivarEnVivo, derivarColoresUniforme, derivarFaltasYTarjetas, extraerGoles } from '../../lib/liveMatch'
import { computeTablaGeneral } from '../../lib/torneoTablas'
import { fmtHoraDate } from '../../lib/horaHelpers'

const S = {
  bg: '#0a0a0a', card: '#161616', border: '#2a2a2a', red: '#e5433d', green: '#6fcf3d', text: '#fff',
}
const inp = { width:'100%', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'9px 12px', color:'#202124', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#5f6368', display:'block', marginBottom:'4px' }

const NOMBRE_PLATAFORMA = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', otro: 'Enlace genérico (se mostrará un botón "Ver en vivo")' }

function streamVacio() {
  return { id: crypto.randomUUID(), url: '', titulo: '', match_id: null, activo: true, retraso_segundos: 20, segundos_repeticion: 28 }
}

export default function AdminConfigSitioPage() {
  const [streams, setStreams] = useState([]) // [{id, url, titulo, match_id, activo}] — uno por transmisión
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [partidos, setPartidos] = useState([]) // partidos elegibles para el marcador (no finalizados)
  const [imagenesRepeticion, setImagenesRepeticion] = useState([]) // [{id, url}] — rotan en la repetición del gol
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  // Panel de control en vivo: qué gráfica extra (tabla/goles) se muestra por
  // transmisión y el disparador de la repetición manual — ver
  // migracion_en_vivo_control.sql. { [streamId]: { overlay, overlay_tournament_id, repeticion_ts,
  // repeticion_camara_lenta, repeticion_objetivo_segundos, resumen_goles, resumen_ts } } —
  // resumen_goles/resumen_ts son el resumen automático de goles del entretiempo (ver el
  // efecto más abajo que los guarda solo y los dispara solo).
  const [control, setControl] = useState({})
  // Tablas de posiciones ya calculadas, en caché por torneo, para no volver a
  // pedirlas cada vez que se prende/apaga el overlay del mismo torneo.
  const [tablas, setTablas] = useState({})
  // Patrocinadores reales del negocio (/admin/patrocinadores) — un botón por
  // cada uno en el panel, para mostrar su publicidad encima del video cuando
  // Sebas quiera (no son las imágenes de la repetición del gol, que son
  // aparte y rotan solas).
  const [patrocinadoresBtn, setPatrocinadoresBtn] = useState([])
  // Qué patrocinador se está mostrando AHORA MISMO en la vista previa, por
  // transmisión — a diferencia de tabla/goles/jugadores (que quedan
  // prendidos hasta apagarlos), esto se apaga solo después de unos segundos.
  const [patrocinadorMostrando, setPatrocinadorMostrando] = useState({})
  const patrocinadorVistoRef = useRef({})
  // Qué link se acaba de copiar (para el "✓ Copiado" de 2 segundos del botón)
  const [copiado, setCopiado] = useState(null)
  // Repetición EN ESTA MISMA pantalla — antes el video de acá no se movía al
  // apretar "Repetición" (solo se avisaba a los demás), así que Sebas no
  // tenía forma de ver hasta qué parte rebobinaba antes de que lo vieran los
  // demás. Ahora el video de este panel rebobina al mismo tiempo que el del
  // público, hasta el mismo punto exacto — mismo patrón que ya usa
  // LandingPage para la repetición manual.
  const [repeticiones, setRepeticiones] = useState({})
  const repeticionVistaRef = useRef({})
  const repeticionContadorRef = useRef(0)
  // Una referencia al <LiveEmbed> de cada transmisión (puede haber varias a
  // la vez) — para poder preguntarle "¿en qué segundo estás?" justo cuando
  // se aprieta Repetición/Cámara lenta, después de que Sebas se devolvió a
  // mano con la barra nativa de YouTube hasta la jugada que quiere repetir.
  const liveEmbedRefs = useRef({})
  // Resumen de goles para el entretiempo: por PARTIDO (no por transmisión,
  // para que no se pierda si a mitad de partido se cambia de transmisión
  // asignada) — la última lista de goles ya guardada (para detectar solo
  // los nuevos, comparando por contenido, no por posición: ver golesNuevos
  // más abajo) y si ya se disparó el resumen para este entretiempo, para no
  // volver a mandarlo mientras el partido se quede en "descanso".
  const golesGuardadosRef = useRef({}) // { [matchId]: últimos goles ya guardados (lista completa) }
  const descansoDisparadoRef = useRef({}) // { [matchId]: true una vez ya se mandó el resumen }
  // Las escrituras de "guardar este gol en el resumen" se encolan una
  // detrás de otra (en vez de leer-modificar-escribir directo cada una) por
  // si dos goles quedan a guardar casi al mismo tiempo — sin esto, la
  // segunda escritura podría pisar a la primera porque ambas leerían la
  // lista sin el gol que la otra todavía no había terminado de guardar.
  const colaResumenRef = useRef(Promise.resolve())

  // Partidos que se pueden elegir para el marcador: cualquiera que no haya
  // terminado (para poder elegirlo desde antes de que arranque). Se marcan
  // primero los que YA están en vivo (el árbitro ya empezó la planilla), así
  // el admin los ve de una sin tener que buscar entre partidos que todavía
  // no arrancan. La misma lista sirve para el selector de CADA transmisión.
  async function fetchPartidos() {
    const { data } = await supabase.from('matches')
      .select('id, tournament_id, played_at, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name)')
      .neq('status', 'finished')
      .order('played_at', { ascending: true })
      .limit(100)
    const conVivo = (data || []).map(m => ({ ...m, enVivo: !!derivarEnVivo(m) }))
    conVivo.sort((a, b) => (b.enVivo === a.enVivo) ? 0 : (b.enVivo ? 1 : -1))
    setPartidos(conVivo)
  }

  async function fetchPatrocinadoresBtn() {
    const { data } = await supabase.from('patrocinadores_golmebol').select('id, nombre, logo_url').eq('activo', true).order('orden')
    setPatrocinadoresBtn(data || [])
  }

  useEffect(() => { fetchConfig(); fetchPartidos(); fetchPatrocinadoresBtn() }, [])

  // Apenas cambia la marca de tiempo de "mostrar este patrocinador" (botón
  // del panel), lo prende acá en la vista previa durante unos segundos y
  // después se apaga solo — mismo patrón que usa LandingPage para la
  // repetición manual.
  const TIEMPO_PATROCINADOR_MS = 8000
  useEffect(() => {
    Object.entries(control).forEach(([streamId, c]) => {
      if (!c?.patrocinador_ts || patrocinadorVistoRef.current[streamId] === c.patrocinador_ts) return
      patrocinadorVistoRef.current[streamId] = c.patrocinador_ts
      setPatrocinadorMostrando(m => ({ ...m, [streamId]: c.patrocinador_id }))
      setTimeout(() => setPatrocinadorMostrando(m => ({ ...m, [streamId]: null })), TIEMPO_PATROCINADOR_MS)
    })
  }, [control])

  // Apenas cambia repeticion_ts (botón "Repetición"/"Cámara lenta" de acá
  // mismo, o disparada desde el link de control en otro celular), rebobina
  // también el video de ESTA pantalla, para que se vea con los propios ojos
  // hasta dónde llegó el rebobinado — antes de que termine de verse en la
  // página pública.
  useEffect(() => {
    Object.entries(control).forEach(([streamId, c]) => {
      if (!c?.repeticion_ts || repeticionVistaRef.current[streamId] === c.repeticion_ts) return
      repeticionVistaRef.current[streamId] = c.repeticion_ts
      const imagenUrl = imagenesRepeticion.length
        ? imagenesRepeticion[repeticionContadorRef.current % imagenesRepeticion.length].url
        : null
      repeticionContadorRef.current += 1
      const s = streams.find(x => x.id === streamId)
      const segundosAtras = Math.max(0, Number(s?.segundos_repeticion) || 28)
      setRepeticiones(r => ({ ...r, [streamId]: { key: Date.now(), objetivoSegundos: c.repeticion_objetivo_segundos, segundosAtras, duracionVisible: 12, imagenUrl, camaraLenta: !!c.repeticion_camara_lenta } }))
    })
  }, [control, streams, imagenesRepeticion])

  // `partidos` antes solo se traía una vez al entrar a la página — para el
  // resumen de goles automático de abajo hace falta enterarse SOLA de los
  // goles nuevos y de cuándo arranca el entretiempo, así que ahora también
  // se refresca cada rato mientras el panel queda abierto.
  useEffect(() => {
    const t = setInterval(fetchPartidos, 10000)
    return () => clearInterval(t)
  }, [])

  // Compara la lista de goles actual contra la última que ya se guardó para
  // el resumen y devuelve solo los nuevos — comparando por CONTENIDO
  // (equipo+jugador+minuto+periodo), no por posición en la lista, porque
  // extraerGoles la devuelve ordenada por minuto: si un gol se carga fuera
  // de orden (el árbitro lo corrige después, o dos caen en el mismo minuto),
  // mirar solo "lo que se agregó al final" podría perderse alguno o
  // guardarlo dos veces.
  function golesNuevos(actuales, anteriores) {
    const claveDe = g => `${g.periodo}|${g.equipo}|${g.jugador}|${g.minuto}`
    const disponibles = {}
    anteriores.forEach(g => { const k = claveDe(g); disponibles[k] = (disponibles[k] || 0) + 1 })
    return actuales.filter(g => {
      const k = claveDe(g)
      if (disponibles[k] > 0) { disponibles[k] -= 1; return false }
      return true
    })
  }

  // Guarda UN gol en la lista del resumen, leyendo y escribiendo site_config
  // de una (no el `control` que ya tiene este panel en memoria, que puede
  // estar desactualizado) — encolado detrás de cualquier otra escritura de
  // resumen que esté a medias, para que dos goles casi seguidos no se pisen
  // entre sí.
  async function guardarGolResumen(streamId, gol) {
    const { data } = await supabase.from('site_config').select('en_vivo_control').eq('id', true).maybeSingle()
    const controlActual = (data?.en_vivo_control && typeof data.en_vivo_control === 'object') ? data.en_vivo_control : {}
    const listaActual = controlActual[streamId]?.resumen_goles || []
    const next = { ...controlActual, [streamId]: { ...controlActual[streamId], resumen_goles: [...listaActual, gol] } }
    setControl(next)
    await supabase.from('site_config').upsert({ id: true, en_vivo_control: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  }
  function encolarGolResumen(streamId, gol) {
    colaResumenRef.current = colaResumenRef.current.then(() => guardarGolResumen(streamId, gol)).catch(() => {})
  }

  // Resumen de goles del entretiempo: apenas aparece un gol nuevo en un
  // partido con transmisión activa, se espera el mismo "retraso" que ya usa
  // la repetición automática del gol (para que el video haya alcanzado esa
  // jugada) y se guarda el segundo exacto de la transmisión en el que quedó
  // — igual de cómo se calcula para la repetición automática normal
  // (segundos_repeticion para atrás desde donde esté el video en ese
  // momento). Así, cuando el árbitro pasa el partido a "descanso", ya hay
  // una lista lista para mostrarse sola en la página pública, sin que nadie
  // tenga que armarla a mano. OJO: esto necesita que ESTE panel (no el link
  // de control de otro celular) quede abierto durante el partido, porque es
  // acá donde se lee el segundo del video (liveEmbedRefs) y se guarda la
  // lista.
  useEffect(() => {
    streams.forEach(s => {
      if (!s.activo || !s.match_id) return
      const partido = partidos.find(p => p.id === s.match_id)
      if (!partido) return
      const vivo = derivarEnVivo(partido)
      if (!vivo) return

      if (vivo.periodo === 1) {
        const golesActuales = extraerGoles(partido).filter(g => g.periodo === 1)
        const anteriores = golesGuardadosRef.current[s.match_id] || []
        const nuevos = golesNuevos(golesActuales, anteriores)
        if (nuevos.length) {
          golesGuardadosRef.current[s.match_id] = golesActuales // marcado de una, antes de esperar, para no procesar los mismos goles dos veces si este efecto vuelve a correr mientras tanto
          const retrasoMs = Math.max(0, Number(s.retraso_segundos) || 20) * 1000
          const segundosAtras = Math.max(0, Number(s.segundos_repeticion) || 28)
          nuevos.forEach(gol => {
            setTimeout(() => {
              const t = liveEmbedRefs.current[s.id]?.getCurrentTime?.()
              const segundo = (typeof t === 'number' && isFinite(t)) ? Math.max(0, t - segundosAtras) : null
              encolarGolResumen(s.id, { segundo, equipo: gol.equipo, jugador: gol.jugador, minuto: gol.minuto })
            }, retrasoMs)
          })
        }
      }

      // Entretiempo: en cuanto el partido pasa a "descanso" (y ya hay algún
      // gol guardado), se avisa una sola vez para que arranque solo el
      // resumen en la página pública — aunque el descanso dure un rato y
      // este efecto se siga corriendo mientras tanto, no se repite.
      if (vivo.descanso && !descansoDisparadoRef.current[s.match_id] && (control[s.id]?.resumen_goles || []).length > 0) {
        descansoDisparadoRef.current[s.match_id] = true
        actualizarControl(s.id, { resumen_ts: Date.now() })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- golesNuevos/guardarGolResumen/encolarGolResumen se redefinen cada render pero no hace falta re-correr el efecto por eso
  }, [partidos, streams, control])

  async function fetchConfig() {
    setLoading(true)
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams, en_vivo_repeticion_imagenes, en_vivo_control').eq('id', true).maybeSingle()
    if (error) {
      setMsg({ text: /does not exist|column/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config_en_vivo_streams.sql y migracion_site_config_repeticion_imagenes.sql en Supabase' : error.message, type:'error' })
      setLoading(false)
      return
    }
    const lista = Array.isArray(data?.en_vivo_streams) ? data.en_vivo_streams : []
    setStreams(lista.map(s => ({ ...s, id: s.id || crypto.randomUUID(), retraso_segundos: s.retraso_segundos ?? 20, segundos_repeticion: s.segundos_repeticion ?? 28 })))
    setImagenesRepeticion(Array.isArray(data?.en_vivo_repeticion_imagenes) ? data.en_vivo_repeticion_imagenes : [])
    setControl((data?.en_vivo_control && typeof data.en_vivo_control === 'object') ? data.en_vivo_control : {})
    setLoading(false)
  }

  // Arma el payload de en_vivo_streams a partir de un arreglo dado (no
  // siempre el `streams` del estado — ver generarLinkControl, que necesita
  // guardar de una el token recién creado sin esperar a que React aplique el
  // setStreams antes de leer el estado, cosa que no pasa en la misma línea).
  async function guardarStreamsArray(arr, { silencioso } = {}) {
    if (!silencioso) { setGuardando(true); setMsg(null) }
    const payload = {
      id: true,
      en_vivo_streams: arr.map(s => ({
        id: s.id,
        url: (s.url || '').trim() || null,
        titulo: (s.titulo || '').trim() || null,
        match_id: s.match_id || null,
        activo: !!s.activo,
        retraso_segundos: Number(s.retraso_segundos) || 20,
        segundos_repeticion: Number(s.segundos_repeticion) || 28,
        control_token: s.control_token || null,
      })),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('site_config').upsert(payload, { onConflict: 'id' })
    if (!silencioso) setGuardando(false)
    if (error) {
      const msgError = /en_vivo_streams/.test(error.message||'') || /column .* does not exist/.test(error.message||'')
        ? '⚠️ Falta correr migracion_site_config_en_vivo_streams.sql en Supabase'
        : 'Error al guardar: ' + error.message
      setMsg({ text: msgError, type:'error' })
      return false
    }
    if (!silencioso) {
      setMsg({ text: '✅ Guardado', type:'ok' })
      setTimeout(() => setMsg(null), 3000)
    }
    return true
  }

  async function guardar() {
    await guardarStreamsArray(streams)
  }

  // Imágenes para la repetición del gol: se suben y se borran de una vez
  // (no esperan al botón "Guardar" de arriba, igual que el logo de un
  // patrocinador), y se guardan aparte del arreglo de transmisiones para no
  // pisar cambios sin guardar que el admin tenga a medias en esa sección.
  async function subirImagenRepeticion(file) {
    if (!file) return
    setSubiendoImagen(true)
    const id = crypto.randomUUID()
    const ext = file.name.split('.').pop()
    const path = `repeticion/${id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('patrocinadores').upload(path, file, { upsert: true })
    if (uploadError) { setSubiendoImagen(false); setMsg({ text:'Error al subir imagen', type:'error' }); return }
    const { data: urlData } = supabase.storage.from('patrocinadores').getPublicUrl(path)
    const url = `${urlData.publicUrl}?t=${Date.now()}`
    const nuevaLista = [...imagenesRepeticion, { id, url }]
    const { error } = await supabase.from('site_config').upsert({ id: true, en_vivo_repeticion_imagenes: nuevaLista, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setSubiendoImagen(false)
    if (error) {
      setMsg({ text: /does not exist|column/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config_repeticion_imagenes.sql en Supabase' : 'Error al guardar la imagen', type:'error' })
      return
    }
    setImagenesRepeticion(nuevaLista)
    setMsg({ text:'✅ Imagen agregada', type:'ok' })
    setTimeout(() => setMsg(null), 3000)
  }

  async function quitarImagenRepeticion(img) {
    const nuevaLista = imagenesRepeticion.filter(x => x.id !== img.id)
    const { error } = await supabase.from('site_config').upsert({ id: true, en_vivo_repeticion_imagenes: nuevaLista, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) { setMsg({ text:'Error al quitar la imagen', type:'error' }); return }
    setImagenesRepeticion(nuevaLista)
    const path = (img.url || '').split('/patrocinadores/')[1]?.split('?')[0]
    if (path) await supabase.storage.from('patrocinadores').remove([path])
  }

  // Panel de control en vivo: a diferencia de "Guardar" (que sube TODO el
  // arreglo de transmisiones de una), cada acción del panel se guarda sola,
  // al toque — igual que las imágenes de repetición — porque esto se usa
  // EN VIVO, durante el partido, y no tiene sentido que quien transmite
  // tenga que acordarse de apretar "Guardar" para que el botón surta efecto.
  // Se actualiza el estado local primero (optimista) para que el botón se
  // sienta instantáneo, y después se manda a Supabase.
  async function actualizarControl(streamId, cambios) {
    const next = { ...control, [streamId]: { ...control[streamId], ...cambios } }
    setControl(next)
    const { error } = await supabase.from('site_config').upsert({ id: true, en_vivo_control: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) {
      setMsg({ text: /en_vivo_control|column .* does not exist/.test(error.message||'') ? '⚠️ Falta correr migracion_en_vivo_control.sql en Supabase' : 'Error al actualizar el panel de control', type:'error' })
    }
  }

  // Dispara una repetición manual (botón del panel) — a diferencia de la
  // automática (que espera el retraso configurado de la transmisión porque
  // reacciona sola a un gol), esta la aprieta a propósito quien está viendo
  // el video, así que en la portada se dispara de una, sin esperar nada.
  // Ya no se calcula "cuánto rebobinar": Sebas se devuelve él mismo con la
  // barra del video de arriba (controles nativos de YouTube) hasta la
  // jugada que quiere repetir, y acá se lee justo ese segundo
  // (`getCurrentTime()`, expuesto por LiveEmbed) para mandárselo a todo el
  // mundo tal cual — `repeticion_objetivo_segundos`. Si por algo no se pudo
  // leer (video no es de YouTube, o el reproductor no respondió todavía),
  // se manda sin ese dato y LiveEmbed cae de vuelta al valor configurado
  // para esa transmisión.
  function dispararRepeticion(s, camaraLenta) {
    const t = liveEmbedRefs.current[s.id]?.getCurrentTime?.()
    const objetivo = (typeof t === 'number' && isFinite(t)) ? t : null
    actualizarControl(s.id, { repeticion_ts: Date.now(), repeticion_camara_lenta: camaraLenta, repeticion_objetivo_segundos: objetivo })
  }

  // Prende/apaga la gráfica de tabla de posiciones, goles o jugadores encima
  // del video. Para la tabla hace falta saber de qué torneo — se usa el del
  // partido que ya tiene elegido esa transmisión (si tiene uno).
  function cambiarOverlay(streamId, overlay, tournamentId) {
    actualizarControl(streamId, { overlay, overlay_tournament_id: overlay === 'tabla' ? (tournamentId || null) : null })
    if (overlay === 'tabla' && tournamentId) cargarTabla(tournamentId)
  }

  // Muestra la publicidad de un patrocinador encima del video unos segundos
  // — a diferencia de los overlays de arriba, este no se queda prendido: se
  // apaga solo (ver el efecto que escucha patrocinador_ts más arriba).
  function mostrarPatrocinador(streamId, patrocinadorId) {
    actualizarControl(streamId, { patrocinador_id: patrocinadorId, patrocinador_ts: Date.now() })
  }

  // Genera (o reutiliza) el link para manejar el panel de control desde otro
  // celular, sin necesidad de iniciar sesión — se guarda de una vez en
  // Supabase (no espera al botón "Guardar" de más abajo, para no compartir
  // por error un link que todavía no quedó guardado).
  async function generarLinkControl(streamId) {
    const actual = streams.find(s => s.id === streamId)
    if (actual?.control_token) return // ya tiene uno — no hace falta generar otro
    const next = streams.map(s => s.id === streamId ? { ...s, control_token: crypto.randomUUID() } : s)
    setStreams(next)
    await guardarStreamsArray(next, { silencioso: true })
  }

  // Trae equipos + partidos de un torneo y calcula su tabla general una sola
  // vez (se guarda en caché) — misma función que usa la tabla de posiciones
  // real del torneo (AdminTorneoDetallePage/TorneoPublicoPage), para que la
  // gráfica en vivo muestre exactamente lo mismo.
  async function cargarTabla(tournamentId) {
    if (!tournamentId || tablas[tournamentId]) return
    const [{ data: torneo }, { data: equiposData }, { data: partidosT }] = await Promise.all([
      supabase.from('tournaments').select('pts_victoria, pts_empate, pts_derrota').eq('id', tournamentId).maybeSingle(),
      supabase.from('tournament_teams').select('teams(id, name, logo_url)').eq('tournament_id', tournamentId),
      supabase.from('matches').select('status, fase, home_team_id, away_team_id, home_score, away_score').eq('tournament_id', tournamentId),
    ])
    const equipos = (equiposData || []).map(d => d.teams).filter(Boolean)
    setTablas(t => ({ ...t, [tournamentId]: computeTablaGeneral(equipos, partidosT || [], torneo || {}) }))
  }

  // Si al entrar a esta página ya había una tabla de posiciones prendida de
  // antes (de una sesión anterior del panel de control), la trae de una vez
  // — si no, la vista previa de abajo se queda esperando sin mostrar nada
  // hasta que alguien vuelva a tocar el botón.
  useEffect(() => {
    Object.values(control).forEach(c => { if (c?.overlay === 'tabla' && c.overlay_tournament_id) cargarTabla(c.overlay_tournament_id) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarTabla ya revisa su propia caché, no hace falta re-correr por eso
  }, [control])

  function agregarStream() {
    setStreams(s => [...s, streamVacio()])
  }
  function quitarStream(id) {
    setStreams(s => s.filter(x => x.id !== id))
  }
  function actualizarStream(id, campo, valor) {
    setStreams(s => s.map(x => x.id === id ? { ...x, [campo]: valor } : x))
  }

  const streamsPreview = streams.filter(s => s.activo && (s.url || '').trim())

  // Arma lo que va ENCIMA del video para una transmisión: el marcador (si
  // tiene partido elegido) siempre va; debajo de todo, la gráfica de tabla o
  // de goles si el panel de control la tiene prendida para esta transmisión.
  // Misma composición que arma la página de inicio pública — así esta vista
  // previa muestra EXACTAMENTE lo que ve quien está viendo la transmisión.
  function overlayDe(s, partidoSeleccionado) {
    const c = control[s.id]
    // La gráfica de goles/jugadores necesita que el partido esté REALMENTE en
    // vivo (igual que ya exige el marcador) — si no, acá en la vista previa
    // se vería una gráfica con datos viejos/de prueba que en la página
    // pública nunca aparece (ahí si no está en vivo, directamente no se
    // pinta nada), y eso es justo lo que confundía: se veía acá pero no allá.
    const vivo = partidoSeleccionado ? derivarEnVivo(partidoSeleccionado) : null
    const patrocinador = patrocinadorMostrando[s.id] ? patrocinadoresBtn.find(p => p.id === patrocinadorMostrando[s.id]) : null
    return (
      <>
        {partidoSeleccionado && vivo && (
          <MarcadorEnVivoOverlay partido={{
            home: partidoSeleccionado.home, away: partidoSeleccionado.away,
            tournaments: partidoSeleccionado.tournaments,
            vivo,
            colores: derivarColoresUniforme(partidoSeleccionado),
            detalle: derivarFaltasYTarjetas(partidoSeleccionado),
          }}/>
        )}
        {/* La publicidad de un patrocinador tapa, mientras dura, cualquier
            otra gráfica de abajo (tabla/goles/jugadores) — son mutuamente
            excluyentes en este mismo espacio para no amontonar texto. */}
        {patrocinador ? <PatrocinadorEnVivoOverlay patrocinador={patrocinador}/> : (
          <>
            {c?.overlay === 'goles' && partidoSeleccionado && vivo && <GolesEnVivoOverlay partido={partidoSeleccionado}/>}
            {c?.overlay === 'tabla' && <TablaEnVivoOverlay filas={tablas[c.overlay_tournament_id]}/>}
            {c?.overlay === 'jugadores' && partidoSeleccionado && vivo && <JugadoresEnVivoOverlay partido={partidoSeleccionado}/>}
          </>
        )}
      </>
    )
  }

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:'#9aa0a6' }}>Cargando...</div>

  return (
    <div style={{ maxWidth:'640px' }}>
      <h1 style={{ fontSize:'1.25rem', fontWeight:'600', color:'#202124', margin:'0 0 4px' }}>Configuración del sitio</h1>
      <p style={{ color:'#5f6368', margin:'0 0 24px', fontSize:'.875rem' }}>Lo que pongas acá se muestra en la página de inicio pública (golmebol.com).</p>

      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:'8px', marginBottom:'16px', fontSize:'.85rem', background: msg.type==='ok'?'#e6f4ea':'#fce8e6', color: msg.type==='ok'?'#1e8e3e':'#d93025' }}>
          {msg.text}
        </div>
      )}

      {streamsPreview.length > 0 && (
        <div style={{ background:S.bg, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'20px', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:'700', color:'#fff', marginBottom:'4px' }}>
            <PlayCircle size={16} color={S.green}/> Panel de control en vivo
          </div>
          <div style={{ fontSize:'.8rem', color:'#9aa0a6', marginBottom:'16px' }}>
            Para usar DURANTE el partido: cada botón actúa al toque, sin tener que tocar "Guardar". Repetición dispara de una (no espera el retraso de la transmisión, porque acá lo aprietas vos mismo viendo el video).
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {streamsPreview.map(s => {
              const partidoSeleccionado = partidos.find(p => p.id === s.match_id) || null
              const c = control[s.id] || {}
              const tieneTorneo = !!partidoSeleccionado?.tournament_id
              const linkControl = s.control_token ? `${window.location.origin}/en-vivo-control/${s.control_token}` : null
              return (
                <div key={s.id} style={{ border:`1px solid ${S.border}`, borderRadius:'10px', padding:'12px' }}>
                  <div style={{ fontSize:'.78rem', fontWeight:'700', color:'#fff', marginBottom:'10px' }}>
                    {s.titulo || (partidoSeleccionado ? `${partidoSeleccionado.home?.name || '?'} vs ${partidoSeleccionado.away?.name || '?'}` : 'Transmisión sin título')}
                  </div>

                  {/* El video va JUSTO acá, pegado a los botones de abajo, y
                      ahora rebobina en vivo cuando se aprieta Repetición —
                      así se ve con los propios ojos hasta qué parte llegó el
                      rebobinado, en vez de confiar a ciegas en el número de
                      segundos. */}
                  <div style={{ marginBottom:'14px' }}>
                    <LiveEmbed ref={el => { liveEmbedRefs.current[s.id] = el }} url={s.url} titulo={s.titulo} S={S} overlay={overlayDe(s, partidoSeleccionado)} repeticion={repeticiones[s.id]}/>
                  </div>
                  {s.match_id && !partidoSeleccionado?.enVivo && (
                    <div style={{ fontSize:'.68rem', color:'#9aa0a6', marginBottom:'14px', textAlign:'center' }}>
                      Elegiste un partido para el marcador, pero todavía no está en vivo (el árbitro no ha empezado la planilla) — por eso no se ve acá. Apenas empiece, aparece solo.
                    </div>
                  )}

                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>LINK PARA MANEJAR DESDE OTRO CELULAR</div>
                  {linkControl ? (
                    <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
                      <input readOnly value={linkControl} onFocus={e => e.target.select()}
                        style={{ flex:1, background:'#161616', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'9px 10px', color:'#9aa0a6', fontSize:'.72rem' }}/>
                      <button onClick={() => { navigator.clipboard?.writeText(linkControl); setCopiado(s.id); setTimeout(() => setCopiado(c2 => c2 === s.id ? null : c2), 2000) }}
                        style={{ display:'flex', alignItems:'center', gap:'5px', padding:'9px 12px', background:'#2a2a2a', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.76rem', fontWeight:'700', whiteSpace:'nowrap' }}>
                        {copiado === s.id ? <><Check size={13} color={S.green}/> Copiado</> : <><Copy size={13}/> Copiar</>}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => generarLinkControl(s.id)}
                      style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'14px', padding:'9px 14px', background:'#fff', border:'1px dashed #1a73e8', borderRadius:'8px', cursor:'pointer', color:'#1a73e8', fontSize:'.78rem', fontWeight:'700' }}>
                      <Link2 size={14}/> Generar link de control
                    </button>
                  )}

                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>REPETICIÓN</div>
                  <div style={{ fontSize:'.72rem', color:'#9aa0a6', marginBottom:'8px' }}>
                    Devuélvete con la barra del video de arriba hasta la jugada que quieras repetir, pausalo ahí, y aprieta uno de estos dos — se muestra desde ese mismo punto.
                  </div>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
                    <button onClick={() => dispararRepeticion(s, false)}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background:S.green, border:'none', borderRadius:'8px', cursor:'pointer', color:'#0a0a0a', fontSize:'.8rem', fontWeight:'700' }}>
                      <PlayCircle size={15}/> Repetición
                    </button>
                    <button onClick={() => dispararRepeticion(s, true)}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background:'#2a2a2a', border:`1px solid ${S.green}`, borderRadius:'8px', cursor:'pointer', color:S.green, fontSize:'.8rem', fontWeight:'700' }}>
                      <Gauge size={15}/> Cámara lenta
                    </button>
                  </div>

                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>GRÁFICA ENCIMA DEL VIDEO</div>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom: patrocinadoresBtn.length ? '14px' : 0 }}>
                    <button onClick={() => cambiarOverlay(s.id, null, null)}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: !c.overlay ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.76rem', fontWeight:'700' }}>
                      <Ban size={13}/> Ninguna
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'tabla', partidoSeleccionado?.tournament_id)}
                      disabled={!tieneTorneo} title={tieneTorneo ? '' : 'Elige un partido para esta transmisión, así se sabe de qué torneo mostrar la tabla'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'tabla' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: tieneTorneo ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: tieneTorneo ? 1 : .45 }}>
                      <Table2 size={13}/> Tabla de posiciones
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'goles', null)}
                      disabled={!partidoSeleccionado} title={partidoSeleccionado ? '' : 'Elige un partido para esta transmisión, así se sabe de quién mostrar los goles'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'goles' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: partidoSeleccionado ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: partidoSeleccionado ? 1 : .45 }}>
                      <ListOrdered size={13}/> Goles del partido
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'jugadores', null)}
                      disabled={!partidoSeleccionado} title={partidoSeleccionado ? '' : 'Elige un partido para esta transmisión, así se sabe la nómina de quién mostrar'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'jugadores' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: partidoSeleccionado ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: partidoSeleccionado ? 1 : .45 }}>
                      <Users size={13}/> Jugadores
                    </button>
                  </div>

                  {patrocinadoresBtn.length > 0 && (
                    <>
                      <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>MOSTRAR PUBLICIDAD DE UN PATROCINADOR</div>
                      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        {patrocinadoresBtn.map(p => (
                          <button key={p.id} onClick={() => mostrarPatrocinador(s.id, p.id)}
                            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background:'#2a2a2a', border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.76rem', fontWeight:'700' }}>
                            <Megaphone size={13}/> {p.nombre}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {partidoSeleccionado && !partidoSeleccionado.enVivo && (
                    <div style={{ fontSize:'.68rem', color:'#f5a623', marginTop:'10px' }}>
                      ⚠️ Este partido todavía no está en vivo (el árbitro no ha empezado la planilla) — las gráficas de goles/jugadores no se ven hasta que empiece, aunque las dejes prendidas de una vez.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:'600', color:'#202124', marginBottom:'4px' }}>
          <Radio size={16} color={S.red}/> Transmisiones en vivo
        </div>
        <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'16px' }}>
          Agrega el link del video o transmisión en vivo puntual (no el del canal/perfil) — funciona con YouTube, Facebook o Instagram. Si hay varios partidos jugándose a la misma hora, agrega una transmisión por cada uno y todas se muestran juntas en la página de inicio.
        </div>

        {streams.length === 0 && (
          <div style={{ fontSize:'.8rem', color:'#9aa0a6', padding:'14px 0', textAlign:'center' }}>
            Todavía no has agregado ninguna transmisión.
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {streams.map((s, i) => {
            const plataforma = detectarPlataforma(s.url)
            return (
              <div key={s.id} style={{ border:'1px solid #e8eaed', borderRadius:'10px', padding:'14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                  <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#5f6368' }}>Transmisión {i + 1}</span>
                  <button onClick={() => quitarStream(s.id)} aria-label="Quitar transmisión"
                    style={{ display:'flex', alignItems:'center', gap:'4px', background:'none', border:'none', color:'#d93025', fontSize:'.75rem', fontWeight:'600', cursor:'pointer', padding:'4px' }}>
                    <Trash2 size={13}/> Quitar
                  </button>
                </div>

                <label style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', cursor:'pointer' }}>
                  <input type="checkbox" checked={!!s.activo} onChange={e => actualizarStream(s.id, 'activo', e.target.checked)}/>
                  <span style={{ fontSize:'.85rem', color:'#202124', fontWeight:'600' }}>Mostrar en la página de inicio</span>
                </label>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Link del video / transmisión</label>
                  <input value={s.url || ''} onChange={e => actualizarStream(s.id, 'url', e.target.value)} style={inp}
                    placeholder="Ej: https://www.youtube.com/watch?v=XXXXXXXXXXX"/>
                  {s.url && <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>Detectado: {NOMBRE_PLATAFORMA[plataforma] || plataforma}</div>}
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Título (opcional)</label>
                  <input value={s.titulo || ''} onChange={e => actualizarStream(s.id, 'titulo', e.target.value)} style={inp}
                    placeholder="Ej: Cancha 1 · Final del Torneo Relámpago"/>
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Retraso de esta transmisión (segundos)</label>
                  <input type="number" min="0" step="1" value={s.retraso_segundos ?? 20}
                    onChange={e => actualizarStream(s.id, 'retraso_segundos', e.target.value)} style={{ ...inp, maxWidth:'120px' }}/>
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
                    Cuánto va atrasada esta transmisión respecto al partido real (todo "en vivo" tiene algo de retraso). Se usa para esperar ese tiempo antes de disparar la repetición del gol — si no, el video rebobina a un momento en el que el gol todavía no había pasado. Para calcularlo: mira algo que pase en la cancha y cuenta cuántos segundos tarda en aparecer en la transmisión.
                  </div>
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Cuánto rebobina la repetición del gol (segundos)</label>
                  <input type="number" min="0" step="1" value={s.segundos_repeticion ?? 28}
                    onChange={e => actualizarStream(s.id, 'segundos_repeticion', e.target.value)} style={{ ...inp, maxWidth:'120px' }}/>
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
                    Si al ver la repetición el gol ya pasó (se ve la celebración pero no la jugada), sube este número — significa que el gol está más atrás de lo que se está rebobinando. Si en cambio se ve mucho relleno antes del gol, bájalo. No tiene relación con el número de arriba: ese es cuánto ESPERAR antes de disparar la repetición, este es hacia dónde atrás SALTA el video una vez que dispara.
                  </div>
                </div>

                <div>
                  <label style={lbl}>Marcador encima del video (opcional)</label>
                  <select value={s.match_id || ''} onChange={e => actualizarStream(s.id, 'match_id', e.target.value || null)} style={inp}>
                    <option value="">— Sin marcador (solo el video) —</option>
                    {partidos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.enVivo ? '🔴 ' : ''}{p.tournaments?.name ? p.tournaments.name + ' — ' : ''}{p.home?.name || '?'} vs {p.away?.name || '?'}{p.played_at ? ' · ' + fmtHoraDate(p.played_at) : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
                    Si eliges el partido que se transmite acá, se muestra su marcador en vivo (el mismo que ya sube el árbitro desde la planilla) como una barra encima del video. Aparece solo, apenas el árbitro empieza a cargar el partido.
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={agregarStream}
          style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'14px', padding:'9px 14px', background:'#fff', border:'1px dashed #1a73e8', borderRadius:'8px', cursor:'pointer', color:'#1a73e8', fontSize:'.8rem', fontWeight:'600' }}>
          <Plus size={14}/> Agregar otra transmisión
        </button>

        <button onClick={guardar} disabled={guardando}
          style={{ display:'block', marginTop:'20px', padding:'10px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:guardando?.7:1 }}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginTop:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:'600', color:'#202124', marginBottom:'4px' }}>
          <Repeat size={16} color={S.red}/> Imágenes para la repetición del gol
        </div>
        <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'16px' }}>
          Cuando el árbitro anota un gol, el video se tapa unos segundos con una de estas imágenes (con una transición de entrada y salida, y tiempo de sobra para leerla) antes de mostrar otra vez la jugada — como el "cortesía de" de una transmisión deportiva. Puedes subir varias: van rotando en orden, una por cada gol. Ideal horizontal (16:9), igual de ancha que el video.
        </div>

        {imagenesRepeticion.length === 0 && (
          <div style={{ fontSize:'.8rem', color:'#9aa0a6', padding:'14px 0', textAlign:'center' }}>
            Todavía no has agregado ninguna imagen.
          </div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginBottom: imagenesRepeticion.length ? '16px' : 0 }}>
          {imagenesRepeticion.map(img => (
            <div key={img.id} style={{ position:'relative', width:'140px' }}>
              <img src={img.url} alt="Imagen de repetición" style={{ width:'140px', height:'79px', objectFit:'cover', borderRadius:'8px', border:'1px solid #e8eaed', display:'block' }}/>
              <button onClick={() => quitarImagenRepeticion(img)} aria-label="Quitar imagen"
                style={{ position:'absolute', top:'-6px', right:'-6px', width:'22px', height:'22px', borderRadius:'50%', border:'none', background:'#d93025', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}>
                <X size={13}/>
              </button>
            </div>
          ))}
        </div>

        <label style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'9px 14px', background:'#fff', border:'1px dashed #1a73e8', borderRadius:'8px', cursor: subiendoImagen ? 'not-allowed' : 'pointer', color:'#1a73e8', fontSize:'.8rem', fontWeight:'600' }}>
          <Upload size={14}/> {subiendoImagen ? 'Subiendo...' : 'Agregar imagen'}
          <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoImagen}
            onChange={e => { subirImagenRepeticion(e.target.files[0]); e.target.value = '' }}/>
        </label>
      </div>

      {/* La vista previa del video (con overlays y repetición) ya se ve
          arriba, adentro de "Panel de control en vivo" — antes había otra
          acá abajo, aparte, pero era OTRO reproductor sin conectar: al
          apretar Repetición ese de acá no se movía, y daba la sensación de
          que no estaba funcionando. Un solo reproductor por transmisión, no
          dos. */}
    </div>
  )
}
