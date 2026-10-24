import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Radio, Plus, Trash2, Upload, Repeat, X, PlayCircle, Gauge, Table2, ListOrdered, Ban, Link2, Copy, Check, Users, ImagePlus, Pencil, Eye, EyeOff } from 'lucide-react'
import LiveEmbed, { detectarPlataforma } from '../../components/LiveEmbed'
import { esCanalYoutube, useCanalesEnVivo } from '../../lib/enVivoCanal'
import MarcadorEnVivoOverlay from '../../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../../components/GolesEnVivoOverlay'
import TablaEnVivoOverlay from '../../components/TablaEnVivoOverlay'
import JugadoresEnVivoOverlay from '../../components/JugadoresEnVivoOverlay'
import PatrocinadorEnVivoOverlay from '../../components/PatrocinadorEnVivoOverlay'
import BotonesPatrocinadores from '../../components/BotonesPatrocinadores'
import PublicidadPatrocinadoresEnVivo from '../../components/PublicidadPatrocinadoresEnVivo'
import { disparoDeControl, disparoEsExclusivo, cargaDisparo, patrocinadoresDeControl } from '../../lib/patrocinadorDisparo'
import PatrocinadoresTorneoOverlay from '../../components/PatrocinadoresTorneoOverlay'
import EditorLogoPatrocinadorTorneo from '../../components/EditorLogoPatrocinadorTorneo'
import { derivarEnVivo, derivarColoresUniforme, derivarFaltasYTarjetas, idsPartidosDeStream, partidoActivoDeStream } from '../../lib/liveMatch'
import { tablasConVivo } from '../../lib/torneoTablas'
import { useTablasBase } from '../../lib/useTablasBase'
import { fmtHoraDate } from '../../lib/horaHelpers'
import { apiUrl } from '../../lib/apiBase'

const S = {
  bg: '#0a0a0a', card: '#161616', border: '#2a2a2a', red: '#e5433d', green: '#6fcf3d', text: '#fff',
}
const inp = { width:'100%', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'9px 12px', color:'#202124', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#5f6368', display:'block', marginBottom:'4px' }

const NOMBRE_PLATAFORMA = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', otro: 'Enlace genérico (se mostrará un botón "Ver en vivo")' }

function streamVacio(ownerId) {
  return { id: crypto.randomUUID(), owner_id: ownerId || null, url: '', titulo: '', match_id: null, match_ids: [], activo: true }
}

export default function AdminConfigSitioPage() {
  // Admin ve y maneja TODAS las transmisiones; un organizador ve y maneja solo
  // las suyas (owner_id = su cuenta) y solo con partidos de SUS torneos.
  const { rol, user } = useAuthStore()
  const esOrganizador = rol?.rol === 'organizador'
  const miId = user?.id || null
  const idsCargadosRef = useRef(new Set()) // ids de transmisiones que esta pantalla ya trajo (para no borrar las que otros agreguen después)
  const colaControlRef = useRef(Promise.resolve())
  const idsTorneosRef = useRef(null)
  const [streams, setStreams] = useState([]) // [{id, url, titulo, match_id, activo}] — uno por transmisión
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [partidos, setPartidos] = useState([]) // partidos elegibles para el marcador (no finalizados)
  const [diagnosticos, setDiagnosticos] = useState({}) // { [streamId]: texto } — respuesta de /api/yt-en-vivo?debug=1 (para ver qué recibe el servidor de YouTube)
  const [torneos, setTorneos] = useState([]) // torneos que una transmisión puede "seguir" (torneo_auto)
  const [canchasPorTorneo, setCanchasPorTorneo] = useState({}) // { [torneoId]: [{id, nombre, escenario}] }
  const [imagenesRepeticion, setImagenesRepeticion] = useState([]) // [{id, url}] — rotan en la repetición del gol
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  // Panel de control en vivo: qué gráfica extra (tabla/goles) se muestra por
  // transmisión y el disparador de la repetición manual — ver
  // migracion_en_vivo_control.sql. { [streamId]: { overlay, overlay_tournament_id, repeticion_ts,
  // repeticion_camara_lenta, repeticion_objetivo_segundos } } — las repeticiones son
  // SOLO manuales (ya no hay repetición automática al marcar un gol ni resumen
  // de goles del descanso en video).
  // logos_activos: ids de los logos de patrocinador del torneo (ver
  // patrocinador_logos_torneo / migracion_patrocinador_logos_torneo.sql) que
  // están prendidos AHORA en ESTA transmisión puntual — la posición/tamaño
  // de cada logo es del torneo (se reutiliza en todos sus partidos), pero
  // prenderlo o no es de cada transmisión.
  const [control, setControl] = useState({})
  // Tablas de posiciones ya calculadas, en caché por torneo, para no volver a
  // pedirlas cada vez que se prende/apaga el overlay del mismo torneo.
  // Patrocinadores reales del negocio (/admin/patrocinadores) — un botón por
  // cada uno en el panel, para mostrar su publicidad encima del video cuando
  // Sebas quiera (no son las imágenes de la repetición del gol, que son
  // aparte y rotan solas).
  // Qué patrocinador se está mostrando AHORA MISMO en la vista previa, por
  // transmisión — a diferencia de tabla/goles/jugadores (que quedan
  // prendidos hasta apagarlos), esto se apaga solo después de unos segundos.
  const [patrocinadorMostrando, setPatrocinadorMostrando] = useState({})
  const patrocinadorVistoRef = useRef({})
  // Logos de patrocinador del TORNEO (aparte de los de arriba): se suben sin
  // límite, quedan guardados por torneo (se repiten partido tras partido) con
  // su posición y tamaño ya elegidos a mano, y pueden estar varios prendidos
  // a la vez. { [tournamentId]: [{ id, url, nombre, x, y, ancho }] }
  const [logosPorTorneo, setLogosPorTorneo] = useState({})
  const [subiendoLogoTorneo, setSubiendoLogoTorneo] = useState(false)
  // Qué logo se está editando (ubicando) AHORA MISMO, y en qué transmisión —
  // mientras se edita, el cuadrito arrastrable solo lo ve quien transmite
  // (ver EditorLogoPatrocinadorTorneo); nadie más se entera hasta "Publicar".
  // Un solo logo a la vez en todo el panel, para no enredar el arrastre.
  const [editandoLogo, setEditandoLogo] = useState(null) // { streamId, tournamentId, logoId } | null
  const [posicionDraft, setPosicionDraft] = useState(null) // posición/tamaño en vivo mientras se arrastra, antes de guardar
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
  // Partidos que se pueden elegir para el marcador: cualquiera que no haya
  // terminado (para poder elegirlo desde antes de que arranque). Se marcan
  // primero los que YA están en vivo (el árbitro ya empezó la planilla), así
  // el admin los ve de una sin tener que buscar entre partidos que todavía
  // no arrancan. La misma lista sirve para el selector de CADA transmisión.
  async function diagnosticarCanal(s) {
    setDiagnosticos(d => ({ ...d, [s.id]: 'Consultando…' }))
    let texto
    try {
      const r = await fetch(apiUrl('/api/yt-en-vivo?debug=1&u=' + encodeURIComponent((s.url || '').trim())))
      texto = JSON.stringify(await r.json(), null, 1)
    } catch (e) {
      texto = 'No se pudo consultar: ' + (e?.message || 'error')
    }
    setDiagnosticos(d => ({ ...d, [s.id]: texto }))
  }

  // Torneos que se pueden "seguir" desde una transmisión: todos para el admin;
  // para un organizador, solo los suyos.
  async function fetchTorneos() {
    let q = supabase.from('tournaments').select('id, name, logo_url').order('created_at', { ascending: false }).limit(80)
    if (esOrganizador) q = q.eq('organizador_id', miId)
    const { data } = await q
    setTorneos(data || [])
  }
  async function cargarCanchas(torneoId) {
    const { data } = await supabase.from('canchas').select('id, nombre, escenario').eq('tournament_id', torneoId)
    setCanchasPorTorneo(prev => ({ ...prev, [torneoId]: data || [] }))
  }
  // Canchas de cada torneo que alguna transmisión esté siguiendo (se cargan una sola vez)
  const idsTorneosAuto = [...new Set(streams.map(x => x.torneo_auto).filter(Boolean))].join(',')
  useEffect(() => {
    idsTorneosAuto.split(',').filter(Boolean).forEach(tid => { if (!canchasPorTorneo[tid]) cargarCanchas(tid) })
  }, [idsTorneosAuto]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPartidos() {
    let q = supabase.from('matches')
      .select('id, tournament_id, cancha_id, played_at, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, logo_url)')
      .neq('status', 'finished')
      .order('played_at', { ascending: true })
      .limit(100)
    if (esOrganizador) {
      if (!idsTorneosRef.current) {
        const { data: ts } = await supabase.from('tournaments').select('id').eq('organizador_id', miId)
        idsTorneosRef.current = (ts || []).map(t => t.id)
      }
      if (idsTorneosRef.current.length === 0) { setPartidos([]); return }
      q = q.in('tournament_id', idsTorneosRef.current)
    }
    const { data } = await q
    const conVivo = (data || []).map(m => ({ ...m, enVivo: !!derivarEnVivo(m) }))
    conVivo.sort((a, b) => (b.enVivo === a.enVivo) ? 0 : (b.enVivo ? 1 : -1))
    setPartidos(conVivo)
  }

  useEffect(() => { fetchConfig(); fetchPartidos(); fetchTorneos() }, [esOrganizador, miId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apenas cambia la marca de tiempo de "mostrar este patrocinador" (botón
  // del panel), lo prende acá en la vista previa durante unos segundos y
  // después se apaga solo — mismo patrón que usa LandingPage para la
  // repetición manual.
  const TIEMPO_PATROCINADOR_MS = 240000
  useEffect(() => {
    Object.entries(control).forEach(([streamId, c]) => {
      if (!c?.patrocinador_ts || patrocinadorVistoRef.current[streamId] === c.patrocinador_ts) return
      patrocinadorVistoRef.current[streamId] = c.patrocinador_ts
      setPatrocinadorMostrando(m => ({ ...m, [streamId]: disparoDeControl(c) }))
      // Seguro: la propia publicidad avisa cuando termina (logo 8 s, banners 10 s cada uno, video al acabar)
      setTimeout(() => setPatrocinadorMostrando(m => (m[streamId]?.clave === c.patrocinador_ts ? { ...m, [streamId]: null } : m)), TIEMPO_PATROCINADOR_MS)
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
      setRepeticiones(r => ({ ...r, [streamId]: { key: Date.now(), objetivoSegundos: c.repeticion_objetivo_segundos, duracionVisible: 12, imagenUrl, camaraLenta: !!c.repeticion_camara_lenta } }))
    })
  }, [control, imagenesRepeticion])

  // `partidos` antes solo se traía una vez al entrar a la página — para el
  // resumen de goles automático de abajo hace falta enterarse SOLA de los
  // goles nuevos y de cuándo arranca el entretiempo, así que ahora también
  // se refresca cada rato mientras el panel queda abierto.
  useEffect(() => {
    const t = setInterval(fetchPartidos, 10000)
    return () => clearInterval(t)
  }, [])

  async function fetchConfig() {
    setLoading(true)
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams, en_vivo_repeticion_imagenes, en_vivo_control, patrocinador_logos_torneo').eq('id', true).maybeSingle()
    if (error) {
      setMsg({ text: /does not exist|column/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config_en_vivo_streams.sql y migracion_site_config_repeticion_imagenes.sql en Supabase' : error.message, type:'error' })
      setLoading(false)
      return
    }
    const todas = Array.isArray(data?.en_vivo_streams) ? data.en_vivo_streams : []
    idsCargadosRef.current = new Set(todas.map(x => x.id).filter(Boolean))
    const lista = esOrganizador ? todas.filter(x => x.owner_id === miId) : todas
    setStreams(lista.map(s => ({ ...s, id: s.id || crypto.randomUUID() })))
    setImagenesRepeticion(Array.isArray(data?.en_vivo_repeticion_imagenes) ? data.en_vivo_repeticion_imagenes : [])
    setControl((data?.en_vivo_control && typeof data.en_vivo_control === 'object') ? data.en_vivo_control : {})
    setLogosPorTorneo((data?.patrocinador_logos_torneo && typeof data.patrocinador_logos_torneo === 'object') ? data.patrocinador_logos_torneo : {})
    setLoading(false)
  }

  // Arma el payload de en_vivo_streams a partir de un arreglo dado (no
  // siempre el `streams` del estado — ver generarLinkControl, que necesita
  // guardar de una el token recién creado sin esperar a que React aplique el
  // setStreams antes de leer el estado, cosa que no pasa en la misma línea).
  async function guardarStreamsArray(arr, { silencioso } = {}) {
    if (!silencioso) { setGuardando(true); setMsg(null) }
    // Se vuelve a leer lo guardado para no pisar las transmisiones de otros
    // organizadores (o las que otro agregó mientras esta pantalla estaba abierta).
    const { data: filaActual, error: errLeer } = await supabase.from('site_config').select('en_vivo_streams').eq('id', true).maybeSingle()
    if (errLeer) {
      if (!silencioso) setGuardando(false)
      setMsg({ text: 'Error al guardar: ' + errLeer.message, type:'error' })
      return false
    }
    const enDb = Array.isArray(filaActual?.en_vivo_streams) ? filaActual.en_vivo_streams : []
    const idsArr = new Set(arr.map(x => x.id))
    const conservar = enDb.filter(x => !idsArr.has(x.id) && (esOrganizador ? x.owner_id !== miId : !idsCargadosRef.current.has(x.id)))
    const payload = {
      id: true,
      en_vivo_streams: [...conservar, ...arr.map(s => ({
        id: s.id,
        owner_id: s.owner_id || null,
        url: (s.url || '').trim() || null,
        titulo: (s.titulo || '').trim() || null,
        match_id: s.match_id || null,
        match_ids: Array.isArray(s.match_ids) && s.match_ids.length > 0 ? s.match_ids : null,
        torneo_auto: s.torneo_auto || null,
        cancha_auto: s.torneo_auto ? (s.cancha_auto || null) : null,
        activo: !!s.activo,
        control_token: s.control_token || null,
      }))],
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
    idsCargadosRef.current = new Set([...conservar, ...arr].map(x => x.id).filter(Boolean))
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

  // Logos de patrocinador del TORNEO (ver migracion_patrocinador_logos_torneo.sql):
  // se suben uno por uno, SIN LÍMITE de cuántos, y quedan guardados en la
  // biblioteca de ESE torneo (reutilizable en todos sus partidos). Posición
  // de arranque: centrado-arriba, chico — después se ubica a mano con
  // "Editar posición" antes de publicarlo.
  async function guardarLogosTorneo(tournamentId, lista) {
    const { data: filaLogos } = await supabase.from('site_config').select('patrocinador_logos_torneo').eq('id', true).maybeSingle()
    const baseLogos = (filaLogos?.patrocinador_logos_torneo && typeof filaLogos.patrocinador_logos_torneo === 'object') ? filaLogos.patrocinador_logos_torneo : logosPorTorneo
    const next = { ...baseLogos, [tournamentId]: lista }
    const { error } = await supabase.from('site_config').upsert({ id: true, patrocinador_logos_torneo: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) {
      setMsg({ text: /does not exist|column/.test(error.message||'') ? '⚠️ Falta correr migracion_patrocinador_logos_torneo.sql en Supabase' : 'Error al guardar el logo', type:'error' })
      return false
    }
    setLogosPorTorneo(next)
    return true
  }
  async function subirLogoTorneo(tournamentId, file) {
    if (!file || !tournamentId) return
    setSubiendoLogoTorneo(true)
    const id = crypto.randomUUID()
    const ext = file.name.split('.').pop()
    const path = `patrocinador-torneo/${tournamentId}/${id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('patrocinadores').upload(path, file, { upsert: true })
    if (uploadError) { setSubiendoLogoTorneo(false); setMsg({ text:'Error al subir el logo', type:'error' }); return }
    const { data: urlData } = supabase.storage.from('patrocinadores').getPublicUrl(path)
    const url = `${urlData.publicUrl}?t=${Date.now()}`
    const listaActual = logosPorTorneo[tournamentId] || []
    const nuevoLogo = { id, url, nombre: file.name, x: 4, y: 4, ancho: 16 }
    const ok = await guardarLogosTorneo(tournamentId, [...listaActual, nuevoLogo])
    setSubiendoLogoTorneo(false)
    if (ok) { setMsg({ text:'✅ Logo agregado — ahora ubicalo con "Editar posición"', type:'ok' }); setTimeout(() => setMsg(null), 4000) }
  }
  async function borrarLogoTorneo(tournamentId, logo) {
    const listaActual = logosPorTorneo[tournamentId] || []
    const ok = await guardarLogosTorneo(tournamentId, listaActual.filter(l => l.id !== logo.id))
    if (!ok) return
    const path = (logo.url || '').split('/patrocinadores/')[1]?.split('?')[0]
    if (path) await supabase.storage.from('patrocinadores').remove([path])
    // Si estaba publicado en alguna transmisión, lo saca de ahí también —
    // si no, quedaría un id de logo activo que ya no existe en la biblioteca.
    streams.forEach(s => {
      const activos = control[s.id]?.logos_activos || []
      if (activos.includes(logo.id)) actualizarControl(s.id, { logos_activos: activos.filter(id2 => id2 !== logo.id) })
    })
    if (editandoLogo?.logoId === logo.id) { setEditandoLogo(null); setPosicionDraft(null) }
  }

  // Ubicar un logo: mientras se edita, SOLO lo ve quien transmite (el cuadro
  // arrastrable de EditorLogoPatrocinadorTorneo, en la vista previa de acá
  // abajo) — la posición de verdad (la que ya ven todos, si está publicado)
  // no cambia hasta "Guardar posición".
  function editarLogoTorneo(streamId, tournamentId, logo) {
    setEditandoLogo({ streamId, tournamentId, logoId: logo.id })
    setPosicionDraft({ x: logo.x, y: logo.y, ancho: logo.ancho })
  }
  function cancelarEdicionLogo() {
    setEditandoLogo(null)
    setPosicionDraft(null)
  }
  async function guardarPosicionLogo() {
    if (!editandoLogo || !posicionDraft) return
    const { tournamentId, logoId } = editandoLogo
    const listaActual = logosPorTorneo[tournamentId] || []
    const nuevaLista = listaActual.map(l => l.id === logoId ? { ...l, ...posicionDraft } : l)
    const ok = await guardarLogosTorneo(tournamentId, nuevaLista)
    if (ok) { setEditandoLogo(null); setPosicionDraft(null) }
  }

  // Publicar/quitar: a diferencia de la posición (que es del torneo, para
  // todos sus partidos), esto es de CADA transmisión puntual — empezar a
  // transmitir un partido nuevo no prende solo los logos que quedaron
  // prendidos del partido anterior.
  function publicarLogoEnStream(streamId, logoId) {
    const activos = control[streamId]?.logos_activos || []
    if (!activos.includes(logoId)) actualizarControl(streamId, { logos_activos: [...activos, logoId] })
  }
  function quitarLogoDeStream(streamId, logoId) {
    const activos = control[streamId]?.logos_activos || []
    actualizarControl(streamId, { logos_activos: activos.filter(id2 => id2 !== logoId) })
  }

  // Panel de control en vivo: a diferencia de "Guardar" (que sube TODO el
  // arreglo de transmisiones de una), cada acción del panel se guarda sola,
  // al toque — igual que las imágenes de repetición — porque esto se usa
  // EN VIVO, durante el partido, y no tiene sentido que quien transmite
  // tenga que acordarse de apretar "Guardar" para que el botón surta efecto.
  // Se actualiza el estado local primero (optimista) para que el botón se
  // sienta instantáneo, y después se manda a Supabase.
  async function actualizarControl(streamId, cambios) {
    setControl(c => ({ ...c, [streamId]: { ...c[streamId], ...cambios } }))
    // Se guarda leyendo lo último de Supabase y cambiando SOLO esta
    // transmisión (así no pisa el panel de otro organizador), y en cola para
    // que dos toques seguidos no se pisen entre sí.
    colaControlRef.current = colaControlRef.current.then(async () => {
      const { data } = await supabase.from('site_config').select('en_vivo_control').eq('id', true).maybeSingle()
      const base = (data?.en_vivo_control && typeof data.en_vivo_control === 'object') ? data.en_vivo_control : {}
      const next = { ...base, [streamId]: { ...base[streamId], ...cambios } }
      const { error } = await supabase.from('site_config').upsert({ id: true, en_vivo_control: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      if (error) {
        setMsg({ text: /en_vivo_control|column .* does not exist/.test(error.message||'') ? '⚠️ Falta correr migracion_en_vivo_control.sql en Supabase' : 'Error al actualizar el panel de control', type:'error' })
      }
    }).catch(() => {})
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
  }

  // Muestra la publicidad de un patrocinador encima del video unos segundos
  // — a diferencia de los overlays de arriba, este no se queda prendido: se
  // apaga solo (ver el efecto que escucha patrocinador_ts más arriba).
  function mostrarPatrocinador(streamId, patrocinadorId, tipo, tamano) {
    actualizarControl(streamId, cargaDisparo(patrocinadorId, tipo, tamano))
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

  // Tablas de posiciones de las vistas previas: se refrescan solas (misma
  // función que la tabla real del torneo) y suman lo que se está jugando ahora.
  const idsTabla = useMemo(() => [...new Set(Object.values(control).filter(c => c?.overlay === 'tabla' && c.overlay_tournament_id).map(c => c.overlay_tournament_id))], [control])
  const basesTabla = useTablasBase(idsTabla, { intervalo: 15000, conVivo: true })
  const tablas = useMemo(() => tablasConVivo(basesTabla, []), [basesTabla])

  function agregarStream() {
    setStreams(s => [...s, streamVacio(esOrganizador ? miId : null)])
  }
  function quitarStream(id) {
    setStreams(s => s.filter(x => x.id !== id))
  }
  function actualizarStream(id, campo, valor) {
    setStreams(s => s.map(x => x.id === id ? { ...x, [campo]: valor } : x))
  }

  // Link de CANAL de YouTube: se consulta si está en vivo (lib/enVivoCanal). La vista
  // previa SIEMPRE lista la transmisión (para tener a mano los links de control y de
  // OBS), pero el video solo se muestra cuando el canal está transmitiendo.
  const canalesEnVivo = useCanalesEnVivo(streams)
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
    const disparo = patrocinadorMostrando[s.id] || null
    const patrocinador = disparo ? patrocinadoresDeControl(c).find(p => p.id === disparo.id) : null
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
        {patrocinador && <PatrocinadorEnVivoOverlay key={disparo.clave} patrocinador={patrocinador} tipo={disparo.tipo} tamano={disparo.tamano} descanso={!!vivo?.descanso} silencio onTerminar={() => setPatrocinadorMostrando(m => ({ ...m, [s.id]: null }))}/>}
        {!(patrocinador && disparoEsExclusivo(disparo, !!vivo?.descanso)) && (
          <>
            {c?.overlay === 'goles' && partidoSeleccionado && vivo && <GolesEnVivoOverlay partido={partidoSeleccionado}/>}
            {c?.overlay === 'tabla' && <TablaEnVivoOverlay filas={tablas[c.overlay_tournament_id]}/>}
            {c?.overlay === 'jugadores' && partidoSeleccionado && vivo && <JugadoresEnVivoOverlay partido={partidoSeleccionado}/>}
          </>
        )}
        {/* Logos de patrocinador del torneo ya publicados — se ven acá
            exactamente igual que en la página pública. El que se está
            editando AHORA MISMO (si hay uno) se dibuja aparte, arrastrable,
            encima de todo — ver editarLogoTorneo más abajo. */}
        {partidoSeleccionado?.tournament_id && (
          <PatrocinadoresTorneoOverlay logos={logosPorTorneo[partidoSeleccionado.tournament_id]} activos={c?.logos_activos}/>
        )}
        {editandoLogo?.streamId === s.id && posicionDraft && (
          <EditorLogoPatrocinadorTorneo
            logo={{ ...(logosPorTorneo[editandoLogo.tournamentId] || []).find(l => l.id === editandoLogo.logoId), ...posicionDraft }}
            onMover={cambios => setPosicionDraft(p => ({ ...p, ...cambios }))}/>
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
              const partidoSeleccionado = partidoActivoDeStream(s, partidos)
              const c = control[s.id] || {}
              const torneoIdActual = partidoSeleccionado?.tournament_id || s.torneo_auto || null
              const tieneTorneo = !!torneoIdActual
              const patrocinadoresStream = patrocinadoresDeControl(c)
              const puedeGraficaPartido = !!partidoSeleccionado || !!s.torneo_auto // si la transmisión sigue un torneo, la gráfica queda elegida y sale cuando empiece el partido
              const urlVideo = esCanalYoutube(s.url) ? canalesEnVivo[s.id]?.url || null : s.url
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
                    {!urlVideo ? (
                      <div style={{ aspectRatio:'16 / 9', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'16px', borderRadius:'14px', background:S.card, border:`1px solid ${S.border}`, color:'#9aa0a6', fontSize:'.8rem' }}>
                        Tu canal de YouTube todavía no está transmitiendo en vivo. Apenas empieces, el video aparece aquí solo.
                      </div>
                    ) : (
                      <LiveEmbed ref={el => { liveEmbedRefs.current[s.id] = el }} url={urlVideo} titulo={s.titulo} S={S} logoTorneo={partidoSeleccionado?.tournaments?.logo_url || torneos.find(t => t.id === s.torneo_auto)?.logo_url} overlay={overlayDe(s, partidoSeleccionado)} repeticion={repeticiones[s.id]}/>
                    )}
                  </div>
                  {s.torneo_auto && !partidoSeleccionado && (
                    <div style={{ fontSize:'.68rem', color:'#9aa0a6', marginBottom:'14px', textAlign:'center' }}>
                      Esta transmisión sigue automáticamente el torneo{s.cancha_auto ? ' y la cancha' : ''} que elegiste: apenas el árbitro abra la planilla de un partido en vivo, el marcador aparece solo.
                    </div>
                  )}
                  {idsPartidosDeStream(s).length > 0 && !partidoSeleccionado?.enVivo && (
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

                  {/* Link del overlay transparente para OBS: se agrega en OBS como
                      "Fuente de navegador" (1920x1080) encima de la cámara, y los
                      gráficos de esta transmisión salen DENTRO del video de YouTube.
                      Usa el id de la transmisión, no el token de control — solo
                      muestra gráficos, no deja manejar nada. */}
                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>LINK PARA OBS (GRÁFICOS DENTRO DE YOUTUBE)</div>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'6px' }}>
                    <input readOnly value={`${window.location.origin}/overlay/${s.id}`} onFocus={e => e.target.select()}
                      style={{ flex:1, background:'#161616', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'9px 10px', color:'#9aa0a6', fontSize:'.72rem' }}/>
                    <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/overlay/${s.id}`); setCopiado(`obs-${s.id}`); setTimeout(() => setCopiado(c2 => c2 === `obs-${s.id}` ? null : c2), 2000) }}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'9px 12px', background:'#2a2a2a', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.76rem', fontWeight:'700', whiteSpace:'nowrap' }}>
                      {copiado === `obs-${s.id}` ? <><Check size={13} color={S.green}/> Copiado</> : <><Copy size={13}/> Copiar</>}
                    </button>
                  </div>
                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', marginBottom:'14px', lineHeight:1.45 }}>
                    En OBS: Fuentes → + → Navegador, pega este link, ancho 1920 y alto 1080, y pónlo encima de la cámara. Fondo transparente: lo que prendas o apagues en este panel se ve en el video de YouTube. (La repetición y cámara lenta de abajo solo funcionan en golmebol.com, no dentro de OBS.)
                  </div>

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

                  {tieneTorneo && (() => {
                    const listaLogos = logosPorTorneo[torneoIdActual] || []
                    return (
                      <>
                        <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>LOGOS DE PATROCINADOR DEL TORNEO</div>
                        <div style={{ fontSize:'.72rem', color:'#9aa0a6', marginBottom:'8px' }}>
                          Se suben una sola vez por torneo y quedan para todos sus partidos. Subí la imagen, "Editar posición" para arrastrarla y agrandarla/achicarla en el video de arriba (ahí SOLO la ves vos), "Guardar posición" cuando quede bien, y recién "Publicar" para que la vea todo el mundo. Podés tener varias publicadas a la vez.
                        </div>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginBottom:'10px', padding:'9px 14px', background:'#fff', border:'1px dashed #1a73e8', borderRadius:'8px', cursor:'pointer', color:'#1a73e8', fontSize:'.78rem', fontWeight:'700' }}>
                          <ImagePlus size={14}/> {subiendoLogoTorneo ? 'Subiendo...' : 'Subir logo'}
                          <input type="file" accept="image/*" hidden disabled={subiendoLogoTorneo}
                            onChange={e => { const f = e.target.files?.[0]; if (f) subirLogoTorneo(torneoIdActual, f); e.target.value = '' }}/>
                        </label>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'14px' }}>
                          {listaLogos.map(logo => {
                            const estaPublicado = (c?.logos_activos || []).includes(logo.id)
                            const estaEditando = editandoLogo?.streamId === s.id && editandoLogo?.logoId === logo.id
                            return (
                              <div key={logo.id} style={{ width:'136px', background:'#161616', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'8px' }}>
                                <div style={{ width:'100%', height:'56px', background:'#000', borderRadius:'4px', marginBottom:'6px', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                                  <img src={logo.url} alt="" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }}/>
                                </div>
                                {estaEditando ? (
                                  <div style={{ display:'flex', gap:'4px', marginBottom:'4px' }}>
                                    <button onClick={guardarPosicionLogo}
                                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', padding:'6px', background:S.green, border:'none', borderRadius:'6px', cursor:'pointer', color:'#0a0a0a', fontSize:'.68rem', fontWeight:'700' }}>
                                      <Check size={11}/> Guardar
                                    </button>
                                    <button onClick={cancelarEdicionLogo}
                                      style={{ padding:'6px 8px', background:'#2a2a2a', border:'none', borderRadius:'6px', cursor:'pointer', color:'#9aa0a6' }}>
                                      <X size={11}/>
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => editarLogoTorneo(s.id, torneoIdActual, logo)}
                                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', padding:'6px', marginBottom:'4px', background:'#2a2a2a', border:'none', borderRadius:'6px', cursor:'pointer', color:'#fff', fontSize:'.68rem', fontWeight:'700' }}>
                                    <Pencil size={11}/> Editar posición
                                  </button>
                                )}
                                <div style={{ display:'flex', gap:'4px' }}>
                                  <button onClick={() => estaPublicado ? quitarLogoDeStream(s.id, logo.id) : publicarLogoEnStream(s.id, logo.id)}
                                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', padding:'6px', background: estaPublicado ? S.red : S.green, border:'none', borderRadius:'6px', cursor:'pointer', color: estaPublicado ? '#fff' : '#0a0a0a', fontSize:'.68rem', fontWeight:'700' }}>
                                    {estaPublicado ? <><EyeOff size={11}/> Quitar</> : <><Eye size={11}/> Publicar</>}
                                  </button>
                                  <button onClick={() => borrarLogoTorneo(torneoIdActual, logo)}
                                    style={{ padding:'6px 8px', background:'#2a2a2a', border:'none', borderRadius:'6px', cursor:'pointer', color:'#9aa0a6' }}>
                                    <Trash2 size={11}/>
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                          {!listaLogos.length && <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>Todavía no subiste ningún logo para este torneo.</div>}
                        </div>
                      </>
                    )
                  })()}

                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>GRÁFICA ENCIMA DEL VIDEO</div>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom: patrocinadoresStream.length ? '14px' : 0 }}>
                    <button onClick={() => cambiarOverlay(s.id, null, null)}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: !c.overlay ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.76rem', fontWeight:'700' }}>
                      <Ban size={13}/> Ninguna
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'tabla', torneoIdActual)}
                      disabled={!tieneTorneo} title={tieneTorneo ? '' : 'Elige un partido para esta transmisión, así se sabe de qué torneo mostrar la tabla'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'tabla' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: tieneTorneo ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: tieneTorneo ? 1 : .45 }}>
                      <Table2 size={13}/> Tabla de posiciones
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'goles', null)}
                      disabled={!puedeGraficaPartido} title={puedeGraficaPartido ? '' : 'Elige un partido para esta transmisión, así se sabe de quién mostrar los goles'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'goles' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: puedeGraficaPartido ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: puedeGraficaPartido ? 1 : .45 }}>
                      <ListOrdered size={13}/> Goles del partido
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'jugadores', null)}
                      disabled={!puedeGraficaPartido} title={puedeGraficaPartido ? '' : 'Elige un partido para esta transmisión, así se sabe la nómina de quién mostrar'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'jugadores' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: puedeGraficaPartido ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: puedeGraficaPartido ? 1 : .45 }}>
                      <Users size={13}/> Jugadores
                    </button>
                  </div>

                  {patrocinadoresStream.length > 0 && (
                    <>
                      <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>MOSTRAR PUBLICIDAD DE UN PATROCINADOR</div>
                      <BotonesPatrocinadores denso patrocinadores={patrocinadoresStream} onMostrar={(pid, tipo, tamano) => mostrarPatrocinador(s.id, pid, tipo, tamano)}/>
                    </>
                  )}

                  <PublicidadPatrocinadoresEnVivo
                    patrocinadores={patrocinadoresStream}
                    onGuardar={lista => actualizarControl(s.id, { patrocinadores: lista })}/>

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
                  <label style={lbl}>Link de tu canal o de la transmisión</label>
                  <input value={s.url || ''} onChange={e => actualizarStream(s.id, 'url', e.target.value)} style={inp}
                    placeholder="Ej: https://www.youtube.com/@micanal  (o el link de un video en vivo)"/>
                  {s.url && !esCanalYoutube(s.url) && <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>Detectado: {NOMBRE_PLATAFORMA[plataforma] || plataforma}</div>}
                  {esCanalYoutube(s.url) && (() => {
                    const est = canalesEnVivo[s.id]
                    const texto = !est ? 'Revisando si tu canal está en vivo…'
                      : est.estado === 'vivo' ? '🔴 Tu canal está EN VIVO ahora — ya se ve en la página de inicio'
                      : est.estado === 'no-vivo' ? '⚪ Tu canal no está transmitiendo en este momento'
                      : est.estado === 'falla' ? `⚠️ No se pudo revisar tu canal ahora: ${est.motivo || 'error desconocido'}`
                      : '⚠️ No se encontró ese canal de YouTube: revisa que el link esté bien escrito'
                    const color = est?.estado === 'vivo' ? '#d93025' : (est?.estado === 'error' || est?.estado === 'falla') ? '#e8710a' : '#5f6368'
                    return (
                      <div style={{ marginTop:'6px', fontSize:'.74rem', lineHeight:1.45 }}>
                        <div style={{ color:'#1e8e3e', fontWeight:'600' }}>✓ Detectado: canal de YouTube — no hace falta cambiar el link en cada partido</div>
                        <div style={{ color, fontWeight:'600', marginTop:'2px' }}>{texto}</div>
                        <div style={{ color:'#9aa0a6', marginTop:'2px' }}>La transmisión aparece sola en golmebol.com cuando empiezas el en vivo y se quita cuando termina (se revisa cada ~45 segundos).</div>
                        <button type="button" onClick={() => diagnosticarCanal(s)}
                          style={{ marginTop:'6px', background:'none', border:'1px solid #dadce0', borderRadius:'6px', padding:'4px 9px', cursor:'pointer', color:'#5f6368', fontSize:'.7rem', fontWeight:'600' }}>
                          🔍 Diagnóstico
                        </button>
                        {diagnosticos[s.id] && (
                          <pre style={{ marginTop:'6px', maxHeight:'220px', overflow:'auto', background:'#f8f9fa', border:'1px solid #e8eaed', borderRadius:'8px', padding:'8px', fontSize:'.62rem', color:'#202124', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{diagnosticos[s.id]}</pre>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Título (opcional)</label>
                  <input value={s.titulo || ''} onChange={e => actualizarStream(s.id, 'titulo', e.target.value)} style={inp}
                    placeholder="Ej: Cancha 1 · Final del Torneo Relámpago"/>
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>¿De dónde sale el marcador?</label>
                  <select value={s.torneo_auto || ''} onChange={e => { actualizarStream(s.id, 'torneo_auto', e.target.value || null); actualizarStream(s.id, 'cancha_auto', null) }} style={inp}>
                    <option value="">Elegir los partidos a mano</option>
                    {torneos.map(t => <option key={t.id} value={t.id}>Seguir automáticamente: {t.name}</option>)}
                  </select>
                  {s.torneo_auto && (() => {
                    const canchas = canchasPorTorneo[s.torneo_auto] || []
                    return (
                      <div style={{ marginTop:'8px' }}>
                        {canchas.length > 0 && (
                          <>
                            <label style={lbl}>Cancha (opcional)</label>
                            <select value={s.cancha_auto || ''} onChange={e => actualizarStream(s.id, 'cancha_auto', e.target.value || null)} style={inp}>
                              <option value="">Todas las canchas del torneo</option>
                              {canchas.map(c => <option key={c.id} value={c.id}>{c.escenario ? c.escenario + ' — ' : ''}{c.nombre}</option>)}
                            </select>
                          </>
                        )}
                        <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'6px', lineHeight:1.45 }}>
                          El marcador toma solo el partido de este torneo{s.cancha_auto ? ' y esa cancha' : ''} que el árbitro tenga EN VIVO en cada momento — no tienes que elegir los partidos uno por uno, y el link de OBS y el de control no cambian nunca.
                          {!s.cancha_auto && ' Si se juegan dos partidos a la vez en este torneo (dos canchas), elige la cancha de esta cámara para que no se confundan.'}
                          {s.cancha_auto && ' Solo funciona con partidos programados con esa cancha asignada.'}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {!s.torneo_auto && (
                <div>
                  <label style={lbl}>Partidos con marcador en esta transmisión (opcional)</label>
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginBottom:'8px' }}>
                    Agrega los partidos que se juegan seguidos en esta misma transmisión (por ejemplo, los 3 partidos del día en esa cancha, sin cortar el video entre uno y otro) — el marcador va cambiando solo al que el árbitro tenga abierto en la planilla en cada momento; cuando termina uno y el árbitro abre el siguiente, el marcador salta solo.
                  </div>
                  {(() => {
                    const ids = idsPartidosDeStream(s)
                    const agregados = ids.map(id => partidos.find(p => p.id === id)).filter(Boolean)
                    const yaJugados = ids.length - agregados.length
                    const disponibles = partidos.filter(p => !ids.includes(p.id))
                    return (
                      <>
                        {agregados.length > 0 && (
                          <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'10px' }}>
                            {agregados.map(p => (
                              <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', background:'#f8f9fa', border:'1px solid #e8eaed', borderRadius:'8px', padding:'7px 10px' }}>
                                <span style={{ fontSize:'.78rem', color:'#202124' }}>
                                  {p.enVivo ? '🔴 ' : ''}{p.tournaments?.name ? p.tournaments.name + ' — ' : ''}{p.home?.name || '?'} vs {p.away?.name || '?'}{p.played_at ? ' · ' + fmtHoraDate(p.played_at) : ''}
                                </span>
                                <button type="button" onClick={() => actualizarStream(s.id, 'match_ids', ids.filter(id => id !== p.id))}
                                  aria-label="Quitar este partido de la transmisión"
                                  style={{ display:'flex', background:'none', border:'none', color:'#d93025', cursor:'pointer', padding:'2px' }}>
                                  <X size={14}/>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {yaJugados > 0 && (
                          <div style={{ fontSize:'.7rem', color:'#5f6368', marginBottom:'10px' }}>
                            + {yaJugados} partido{yaJugados > 1 ? 's' : ''} ya jugado{yaJugados > 1 ? 's' : ''} en esta transmisión (quedan contados igual, no hace falta hacer nada con ellos).
                          </div>
                        )}
                        <select value="" onChange={e => { if (e.target.value) actualizarStream(s.id, 'match_ids', [...ids, e.target.value]) }} style={inp}>
                          <option value="">{agregados.length > 0 || yaJugados > 0 ? '+ Agregar otro partido…' : '— Sin marcador (solo el video) —'}</option>
                          {disponibles.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.enVivo ? '🔴 ' : ''}{p.tournaments?.name ? p.tournaments.name + ' — ' : ''}{p.home?.name || '?'} vs {p.away?.name || '?'}{p.played_at ? ' · ' + fmtHoraDate(p.played_at) : ''}
                            </option>
                          ))}
                        </select>
                      </>
                    )
                  })()}
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
                    Si eliges el partido (o partidos) que se transmiten acá, se muestra su marcador en vivo (el mismo que ya sube el árbitro desde la planilla) como una barra encima del video. Aparece solo, apenas el árbitro empieza a cargar el partido.
                  </div>
                </div>
                )}
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

      {!esOrganizador && (
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
      )}

      {/* La vista previa del video (con overlays y repetición) ya se ve
          arriba, adentro de "Panel de control en vivo" — antes había otra
          acá abajo, aparte, pero era OTRO reproductor sin conectar: al
          apretar Repetición ese de acá no se movía, y daba la sensación de
          que no estaba funcionando. Un solo reproductor por transmisión, no
          dos. */}
    </div>
  )
}
