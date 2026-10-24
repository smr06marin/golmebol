// Panel de control en vivo, para manejar desde OTRO celular, sin iniciar
// sesión — el link se genera en /admin/config-sitio ("Generar link de
// control") y queda guardado en ese stream dentro de site_config.en_vivo_streams
// (campo control_token). Cualquiera con el link puede operar ESA transmisión
// puntual: disparar repeticiones (con ajuste de cuánto rebobina), cámara
// lenta, prender/apagar las gráficas de tabla/goles/jugadores, y mostrar
// publicidad de un patrocinador — exactamente las mismas acciones que ya
// existen en el panel de /admin/config-sitio, reutilizando los mismos
// componentes de gráfica.
//
// Nota de seguridad: site_config no tiene RLS (ver migracion_site_config.sql)
// — ya es de lectura/escritura abierta para cualquiera con la URL de
// Supabase, con o sin este link. El token acá es para que cada quien opere
// SOLO la transmisión que le corresponde, no una medida de seguridad nueva.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LiveEmbed from '../components/LiveEmbed'
import MarcadorEnVivoOverlay from '../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../components/GolesEnVivoOverlay'
import TablaEnVivoOverlay from '../components/TablaEnVivoOverlay'
import MesaControlEnVivo from '../components/MesaControlEnVivo'
import { overlayTapaMarcador } from '../components/enVivoUI'
import JugadoresEnVivoOverlay from '../components/JugadoresEnVivoOverlay'
import PatrocinadorEnVivoOverlay from '../components/PatrocinadorEnVivoOverlay'
import { disparoDeControl, disparoEsExclusivo, cargaDisparo, apagarDisparo, patrocinadorDeDisparo, patrocinadoresDeControl } from '../lib/patrocinadorDisparo'
import PatrocinadoresTorneoOverlay from '../components/PatrocinadoresTorneoOverlay'
import { derivarEnVivo, derivarColoresUniforme, derivarFaltasYTarjetas, idsPartidosDeStream, elegirPartidoActivo, partidoAutoDeTorneo } from '../lib/liveMatch'
import { tablasConVivo } from '../lib/torneoTablas'
import { useTablasBase } from '../lib/useTablasBase'
import { useLogosTorneos } from '../lib/useLogosTorneos'
import { esCanalYoutube, useCanalesEnVivo } from '../lib/enVivoCanal'

const S = { bg: '#0a0a0a', card: '#161616', border: '#2a2a2a', red: '#e5433d', green: '#6fcf3d', text: '#fff' }

export default function EnVivoControlLinkPage() {
  const { token } = useParams()
  const [siteConfig, setSiteConfig] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [partidosStream, setPartidosStream] = useState([])
  const [patrocinadorMostrando, setPatrocinadorMostrando] = useState(null)
  const [repeticion, setRepeticion] = useState(null)
  // Referencia al <LiveEmbed> de este stream — para leer, justo al apretar
  // Repetición/Cámara lenta, en qué segundo de la transmisión quedó después
  // de que quien opera se devolvió a mano con la barra nativa de YouTube.
  const liveEmbedRef = useRef(null)

  const stream = useMemo(() => (
    Array.isArray(siteConfig?.en_vivo_streams) ? siteConfig.en_vivo_streams.find(s => s.control_token && s.control_token === token) : null
  ), [siteConfig, token])
  // Link de CANAL de YouTube: se usa el video en vivo que tenga ahora (ver lib/enVivoCanal)
  const streamParaCanal = useMemo(() => (stream ? [stream] : []), [stream])
  const canalesEnVivo = useCanalesEnVivo(streamParaCanal)
  const urlVideo = stream ? (esCanalYoutube(stream.url) ? canalesEnVivo[stream.id]?.url || null : stream.url) : null
  const control = (siteConfig?.en_vivo_control || {})[stream?.id] || {}
  const patrocinadoresBtn = patrocinadoresDeControl(control)

  async function fetchSiteConfig() {
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams, en_vivo_repeticion_imagenes, en_vivo_control, patrocinador_logos_torneo').eq('id', true).maybeSingle()
    if (!error) setSiteConfig(data || null)
    setCargando(false)
  }

  useEffect(() => { fetchSiteConfig() }, [])

  // Respaldo de refresco además del realtime de abajo (ver
  // migracion_realtime_site_config.sql) — así este panel igual se entera de
  // cambios aunque el realtime falle, y también así el operador ve el
  // marcador/goles actualizarse sin recargar.
  useEffect(() => {
    const t = setInterval(fetchSiteConfig, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`en-vivo-control-${token}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_config' }, fetchSiteConfig)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [token])

  // Trae los partidos configurados para esta transmisión (puede ser más de
  // uno, si en esta misma transmisión se juegan varios seguidos sin cortar
  // el video — ver idsPartidosDeStream) y los refresca cada pocos segundos
  // para que el marcador/goles/jugadores se vean al día — más rápido que el
  // refresco normal de la portada porque acá quien opera necesita ver lo que
  // está pasando AHORA para decidir cuándo apretar los botones. De esa
  // lista, elegirPartidoActivo decide cuál mostrar: el que el árbitro tenga
  // abierto en la planilla en ese momento.
  const streamIds = idsPartidosDeStream(stream)
  // Transmisión que sigue un torneo (y quizá una cancha): se traen los partidos
  // en vivo de ese torneo y se elige el que corresponde (ver partidoAutoDeTorneo).
  const torneoAuto = stream?.torneo_auto || null
  const canchaAuto = stream?.cancha_auto || null
  const streamIdsKey = torneoAuto ? `auto:${torneoAuto}:${canchaAuto || ''}` : streamIds.join(',')
  const COLUMNAS_PARTIDO = 'id, tournament_id, cancha_id, home_team_id, away_team_id, status, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, modalidad, logo_url)'
  async function fetchPartidosStream() {
    const q = supabase.from('matches').select(COLUMNAS_PARTIDO)
    const { data } = torneoAuto
      ? await q.eq('tournament_id', torneoAuto).neq('status', 'finished').or('live_state.not.is.null,live_state_rapida.not.is.null')
      : await q.in('id', streamIds)
    setPartidosStream(data || [])
  }
  useEffect(() => {
    if (!torneoAuto && streamIds.length === 0) { setPartidosStream([]); return }
    fetchPartidosStream()
    const t = setInterval(fetchPartidosStream, 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- streamIds es un arreglo nuevo en cada render (viene de stream, que se recalcula con cada refresco de siteConfig); el intervalo solo debe reiniciarse cuando cambian los ids (o el torneo/cancha que sigue) en sí, por eso la dependencia real es streamIdsKey
  }, [streamIdsKey])
  const partido = torneoAuto ? partidoAutoDeTorneo(stream, partidosStream) : elegirPartidoActivo(partidosStream)
  // Torneo conocido aunque todavía no haya partido en vivo (transmisión que sigue un torneo)
  const logoDeTorneo = useLogosTorneos(torneoAuto ? [torneoAuto] : [])
  const torneoIdActual = partido?.tournament_id || torneoAuto || null
  const logoTorneoActual = partido?.tournaments?.logo_url || logoDeTorneo(torneoAuto)

  const vivo = partido ? derivarEnVivo(partido) : null

  async function actualizarControl(cambios) {
    if (!stream) return
    const next = { ...(siteConfig?.en_vivo_control || {}), [stream.id]: { ...control, ...cambios } }
    setSiteConfig(sc => ({ ...sc, en_vivo_control: next }))
    await supabase.from('site_config').upsert({ id: true, en_vivo_control: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  }

  // Ya no se calcula "cuánto rebobinar": se lee el segundo exacto donde
  // quedó el video después de que quien opera lo devolvió a mano con la
  // barra nativa de YouTube, y se manda tal cual para que todos salten ahí.
  function dispararRepeticion(camaraLenta) {
    const t = liveEmbedRef.current?.getCurrentTime?.()
    const objetivo = (typeof t === 'number' && isFinite(t)) ? t : null
    actualizarControl({ repeticion_ts: Date.now(), repeticion_camara_lenta: camaraLenta, repeticion_objetivo_segundos: objetivo })
  }

  function cambiarOverlay(overlay, tournamentId) {
    actualizarControl({ overlay, overlay_tournament_id: overlay === 'tabla' ? (tournamentId || null) : null, tabla_pagina: null })
  }

  function mostrarPatrocinador(patrocinadorId, tipo, tamano) {
    actualizarControl(cargaDisparo(patrocinadorId, tipo, tamano))
  }

  // Apaga lo que esté saliendo (banners, logo o video) en todas las pantallas
  function apagarPatrocinador() {
    actualizarControl(apagarDisparo())
  }

  // Tabla de posiciones de la vista previa: se refresca sola y suma lo que se está jugando ahora
  const basesTabla = useTablasBase(control.overlay === 'tabla' && control.overlay_tournament_id ? [control.overlay_tournament_id] : [], { intervalo: 15000, conVivo: true })
  const tablas = useMemo(() => tablasConVivo(basesTabla, []), [basesTabla])

  // Repetición manual: igual que en LandingPage, se compara repeticion_ts
  // contra la última ya mostrada para no repetirla dos veces.
  const repeticionVistaRef = useRef(null)
  const imagenesRepeticion = Array.isArray(siteConfig?.en_vivo_repeticion_imagenes) ? siteConfig.en_vivo_repeticion_imagenes : []
  const repContadorRef = useRef(0)
  useEffect(() => {
    if (!control.repeticion_ts || repeticionVistaRef.current === control.repeticion_ts) return
    repeticionVistaRef.current = control.repeticion_ts
    if (stream?.repeticion_transmision) return // sale dentro de la transmisión, no en esta vista previa
    const imagenUrl = imagenesRepeticion.length ? imagenesRepeticion[repContadorRef.current % imagenesRepeticion.length].url : null
    repContadorRef.current += 1
    setRepeticion({ key: Date.now(), objetivoSegundos: control.repeticion_objetivo_segundos, duracionVisible: 12, imagenUrl, camaraLenta: !!control.repeticion_camara_lenta })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control.repeticion_ts])

  // Publicidad de patrocinador: aparece unos segundos y se apaga sola.
  const patrocinadorVistoRef = useRef(null)
  useEffect(() => {
    if (!control.patrocinador_ts || patrocinadorVistoRef.current === control.patrocinador_ts) return
    patrocinadorVistoRef.current = control.patrocinador_ts
    setPatrocinadorMostrando(disparoDeControl(control))
    // Seguro: la propia publicidad avisa cuando termina (logo 8 s, banners 10 s cada uno, video al acabar)
    const t = setTimeout(() => setPatrocinadorMostrando(null), 240000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control.patrocinador_ts])

  if (cargando) {
    return <div style={{ minHeight:'100vh', background:S.bg, display:'flex', alignItems:'center', justifyContent:'center', color:'#9aa0a6', fontFamily:'system-ui, sans-serif' }}>Cargando...</div>
  }

  if (!stream) {
    return (
      <div style={{ minHeight:'100vh', background:S.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:'system-ui, sans-serif' }}>
        <div style={{ textAlign:'center', color:'#9aa0a6', maxWidth:'320px' }}>
          <div style={{ fontSize:'2rem', marginBottom:'10px' }}>🔗</div>
          <div style={{ fontWeight:'700', color:'#fff', marginBottom:'6px' }}>Este link no es válido</div>
          <div style={{ fontSize:'.85rem' }}>Puede que la transmisión ya no exista, o que el link de control se haya generado de nuevo desde /admin/config-sitio.</div>
        </div>
      </div>
    )
  }

  const sponsor = patrocinadorDeDisparo(patrocinadoresBtn, patrocinadorMostrando)
  // El tablero de goles (abajo) esconde el marcador de arriba para que la mirada se quede en él
  const tapaMarcador = overlayTapaMarcador(control.overlay) && !(sponsor && disparoEsExclusivo(patrocinadorMostrando, !!vivo?.descanso))
  const tieneTorneo = !!torneoIdActual
  const puedeGraficaPartido = !!partido || !!torneoAuto // en una transmisión que sigue un torneo se puede dejar elegida la gráfica: aparece cuando empiece el partido

  return (
    <div style={{ minHeight:'100vh', background:S.bg, fontFamily:'system-ui, sans-serif', padding:'16px', boxSizing:'border-box' }}>
      <div style={{ maxWidth:'480px', margin:'0 auto' }}>
        <div style={{ color:'#fff', fontWeight:'900', fontSize:'1rem', marginBottom:'2px' }}>Panel de control en vivo</div>
        <div style={{ color:'#9aa0a6', fontSize:'.8rem', marginBottom:'16px' }}>{stream.titulo || (partido ? `${partido.home?.name || '?'} vs ${partido.away?.name || '?'}` : 'Transmisión')}</div>

        {!urlVideo && (
          <div style={{ aspectRatio:'16 / 9', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'16px', borderRadius:'14px', background:S.card, border:`1px solid ${S.border}`, color:'#9aa0a6', fontSize:'.85rem' }}>
            Tu canal de YouTube todavía no está transmitiendo en vivo. Apenas empieces, el video aparece aquí solo.
          </div>
        )}
        {urlVideo && <LiveEmbed ref={liveEmbedRef} url={urlVideo} titulo={stream.titulo} S={S} logoTorneo={logoTorneoActual}
          overlay={(
            <>
              {partido && vivo && !tapaMarcador && (
                <MarcadorEnVivoOverlay partido={{
                  home: partido.home, away: partido.away, tournaments: partido.tournaments, vivo,
                  colores: derivarColoresUniforme(partido), detalle: derivarFaltasYTarjetas(partido),
                }}/>
              )}
              {sponsor && <PatrocinadorEnVivoOverlay key={patrocinadorMostrando.clave} patrocinador={sponsor} tipo={patrocinadorMostrando.tipo} tamano={patrocinadorMostrando.tamano} descanso={!!vivo?.descanso} silencio onTerminar={() => setPatrocinadorMostrando(null)}/>}
              {!(sponsor && disparoEsExclusivo(patrocinadorMostrando, !!vivo?.descanso)) && (
                <>
                  {control.overlay === 'goles' && partido && vivo && <GolesEnVivoOverlay partido={partido}/>}
                  {control.overlay === 'tabla' && <TablaEnVivoOverlay filas={tablas[control.overlay_tournament_id]} pagina={control.tabla_pagina}/>}
                  {control.overlay === 'jugadores' && partido && vivo && <JugadoresEnVivoOverlay partido={partido}/>}
                </>
              )}
              {partido?.tournament_id && (
                <PatrocinadoresTorneoOverlay logos={siteConfig?.patrocinador_logos_torneo?.[partido.tournament_id]} activos={control.logos_activos}/>
              )}
            </>
          )}
          repeticion={repeticion}/>}

        {partido && !vivo && (
          <div style={{ fontSize:'.72rem', color:'#f5a623', marginTop:'10px', textAlign:'center' }}>
            ⚠️ Este partido todavía no está en vivo (el árbitro no ha empezado la planilla).
          </div>
        )}

        <div style={{ marginTop:'14px' }}>
          <MesaControlEnVivo
            control={control} tieneTorneo={tieneTorneo} puedeGraficaPartido={puedeGraficaPartido}
            tablaTotal={tablas[control.overlay_tournament_id]?.length || 0}
            patrocinadores={patrocinadoresBtn} activoPatrocinador={patrocinadorMostrando}
            repeticionEnTransmision={!!stream.repeticion_transmision}
            onRepeticion={dispararRepeticion}
            onOverlay={o => cambiarOverlay(o, o === 'tabla' ? torneoIdActual : null)}
            onPagina={pag => actualizarControl({ tabla_pagina: pag })}
            onMostrarPatrocinador={mostrarPatrocinador} onApagarPatrocinador={apagarPatrocinador}/>
          {torneoAuto && !partido && (
            <div style={{ fontSize:'.78rem', color:'#9aa0a6', marginTop:'10px', lineHeight:1.45 }}>
              Todavía no hay un partido en vivo. La tabla ya se puede mostrar; Goles y Jugadores quedan elegidos y salen solos apenas el árbitro empiece la planilla.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
