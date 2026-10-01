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
import { PlayCircle, Gauge, Table2, ListOrdered, Ban, Users, Megaphone } from 'lucide-react'
import LiveEmbed from '../components/LiveEmbed'
import MarcadorEnVivoOverlay from '../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../components/GolesEnVivoOverlay'
import TablaEnVivoOverlay from '../components/TablaEnVivoOverlay'
import JugadoresEnVivoOverlay from '../components/JugadoresEnVivoOverlay'
import PatrocinadorEnVivoOverlay from '../components/PatrocinadorEnVivoOverlay'
import { derivarEnVivo, derivarColoresUniforme, derivarFaltasYTarjetas } from '../lib/liveMatch'
import { computeTablaGeneral } from '../lib/torneoTablas'

const S = { bg: '#0a0a0a', card: '#161616', border: '#2a2a2a', red: '#e5433d', green: '#6fcf3d', text: '#fff' }

export default function EnVivoControlLinkPage() {
  const { token } = useParams()
  const [siteConfig, setSiteConfig] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [partido, setPartido] = useState(null)
  const [patrocinadoresBtn, setPatrocinadoresBtn] = useState([])
  const [tablas, setTablas] = useState({})
  const [patrocinadorMostrando, setPatrocinadorMostrando] = useState(null)
  const [repeticion, setRepeticion] = useState(null)
  // Referencia al <LiveEmbed> de este stream — para leer, justo al apretar
  // Repetición/Cámara lenta, en qué segundo de la transmisión quedó después
  // de que quien opera se devolvió a mano con la barra nativa de YouTube.
  const liveEmbedRef = useRef(null)

  const stream = useMemo(() => (
    Array.isArray(siteConfig?.en_vivo_streams) ? siteConfig.en_vivo_streams.find(s => s.control_token && s.control_token === token) : null
  ), [siteConfig, token])
  const control = (siteConfig?.en_vivo_control || {})[stream?.id] || {}

  async function fetchSiteConfig() {
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams, en_vivo_repeticion_imagenes, en_vivo_control').eq('id', true).maybeSingle()
    if (!error) setSiteConfig(data || null)
    setCargando(false)
  }

  async function fetchPatrocinadoresBtn() {
    const { data } = await supabase.from('patrocinadores_golmebol').select('id, nombre, logo_url').eq('activo', true).order('orden')
    setPatrocinadoresBtn(data || [])
  }

  useEffect(() => { fetchSiteConfig(); fetchPatrocinadoresBtn() }, [])

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

  // Trae el partido elegido para esta transmisión (si tiene uno) y lo
  // refresca cada pocos segundos para que el marcador/goles/jugadores se
  // vean al día — más rápido que el refresco normal de la portada porque acá
  // quien opera necesita ver lo que está pasando AHORA para decidir cuándo
  // apretar los botones.
  async function fetchPartido(matchId) {
    const { data } = await supabase.from('matches')
      .select('id, tournament_id, home_team_id, away_team_id, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, modalidad)')
      .eq('id', matchId).maybeSingle()
    setPartido(data || null)
  }
  useEffect(() => {
    if (!stream?.match_id) { setPartido(null); return }
    fetchPartido(stream.match_id)
    const t = setInterval(() => fetchPartido(stream.match_id), 4000)
    return () => clearInterval(t)
  }, [stream?.match_id])

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
    actualizarControl({ overlay, overlay_tournament_id: overlay === 'tabla' ? (tournamentId || null) : null })
    if (overlay === 'tabla' && tournamentId) cargarTabla(tournamentId)
  }

  function mostrarPatrocinador(patrocinadorId) {
    actualizarControl({ patrocinador_id: patrocinadorId, patrocinador_ts: Date.now() })
  }

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
  useEffect(() => {
    if (control.overlay === 'tabla' && control.overlay_tournament_id) cargarTabla(control.overlay_tournament_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarTabla ya revisa su propia caché
  }, [control.overlay, control.overlay_tournament_id])

  // Repetición manual: igual que en LandingPage, se compara repeticion_ts
  // contra la última ya mostrada para no repetirla dos veces.
  const repeticionVistaRef = useRef(null)
  const imagenesRepeticion = Array.isArray(siteConfig?.en_vivo_repeticion_imagenes) ? siteConfig.en_vivo_repeticion_imagenes : []
  const repContadorRef = useRef(0)
  useEffect(() => {
    if (!control.repeticion_ts || repeticionVistaRef.current === control.repeticion_ts) return
    repeticionVistaRef.current = control.repeticion_ts
    const imagenUrl = imagenesRepeticion.length ? imagenesRepeticion[repContadorRef.current % imagenesRepeticion.length].url : null
    repContadorRef.current += 1
    const segundosAtras = Math.max(0, Number(stream?.segundos_repeticion) || 28)
    setRepeticion({ key: Date.now(), objetivoSegundos: control.repeticion_objetivo_segundos, segundosAtras, duracionVisible: 12, imagenUrl, camaraLenta: !!control.repeticion_camara_lenta })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control.repeticion_ts])

  // Resumen de goles del entretiempo — mismo patrón que LandingPage: el
  // panel de /admin/config-sitio ya guardó el segundo exacto de cada gol del
  // primer tiempo (resumen_goles) y avisó una sola vez (resumen_ts) al
  // llegar el descanso; acá solo se encadenan uno detrás de otro.
  const resumenVistoRef = useRef(null)
  function mostrarGolDeResumen(goles, indice) {
    const gol = goles[indice]
    if (!gol || typeof gol.segundo !== 'number' || !isFinite(gol.segundo)) {
      if (indice + 1 < goles.length) mostrarGolDeResumen(goles, indice + 1)
      return
    }
    const etiqueta = `${gol.jugador || 'Gol'}${gol.minuto ? ' · ' + gol.minuto + "'" : ''}`
    setRepeticion({
      key: Date.now(),
      objetivoSegundos: gol.segundo,
      duracionVisible: 10,
      etiqueta,
      ultimoDeSerie: indice === goles.length - 1,
      onFinSegmento: () => mostrarGolDeResumen(goles, indice + 1),
    })
  }
  useEffect(() => {
    const goles = Array.isArray(control.resumen_goles) ? control.resumen_goles : []
    if (!control.resumen_ts || resumenVistoRef.current === control.resumen_ts || !goles.length) return
    resumenVistoRef.current = control.resumen_ts
    mostrarGolDeResumen(goles, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control.resumen_ts])

  // Publicidad de patrocinador: aparece unos segundos y se apaga sola.
  const patrocinadorVistoRef = useRef(null)
  useEffect(() => {
    if (!control.patrocinador_ts || patrocinadorVistoRef.current === control.patrocinador_ts) return
    patrocinadorVistoRef.current = control.patrocinador_ts
    setPatrocinadorMostrando(control.patrocinador_id)
    const t = setTimeout(() => setPatrocinadorMostrando(null), 8000)
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

  const sponsor = patrocinadorMostrando ? patrocinadoresBtn.find(p => p.id === patrocinadorMostrando) : null
  const tieneTorneo = !!partido?.tournament_id

  return (
    <div style={{ minHeight:'100vh', background:S.bg, fontFamily:'system-ui, sans-serif', padding:'16px', boxSizing:'border-box' }}>
      <div style={{ maxWidth:'480px', margin:'0 auto' }}>
        <div style={{ color:'#fff', fontWeight:'900', fontSize:'1rem', marginBottom:'2px' }}>Panel de control en vivo</div>
        <div style={{ color:'#9aa0a6', fontSize:'.8rem', marginBottom:'16px' }}>{stream.titulo || (partido ? `${partido.home?.name || '?'} vs ${partido.away?.name || '?'}` : 'Transmisión')}</div>

        <LiveEmbed ref={liveEmbedRef} url={stream.url} titulo={stream.titulo} S={S}
          overlay={(
            <>
              {partido && vivo && (
                <MarcadorEnVivoOverlay partido={{
                  home: partido.home, away: partido.away, tournaments: partido.tournaments, vivo,
                  colores: derivarColoresUniforme(partido), detalle: derivarFaltasYTarjetas(partido),
                }}/>
              )}
              {sponsor ? <PatrocinadorEnVivoOverlay patrocinador={sponsor}/> : (
                <>
                  {control.overlay === 'goles' && partido && vivo && <GolesEnVivoOverlay partido={partido}/>}
                  {control.overlay === 'tabla' && <TablaEnVivoOverlay filas={tablas[control.overlay_tournament_id]}/>}
                  {control.overlay === 'jugadores' && partido && vivo && <JugadoresEnVivoOverlay partido={partido}/>}
                </>
              )}
            </>
          )}
          repeticion={repeticion}/>

        {partido && !vivo && (
          <div style={{ fontSize:'.72rem', color:'#f5a623', marginTop:'10px', textAlign:'center' }}>
            ⚠️ Este partido todavía no está en vivo (el árbitro no ha empezado la planilla).
          </div>
        )}

        <div style={{ marginTop:'20px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px' }}>
          <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>REPETICIÓN</div>
          <div style={{ fontSize:'.74rem', color:'#9aa0a6', marginBottom:'10px' }}>
            Devuélvete con la barra del video de arriba hasta la jugada que quieras repetir, pausalo ahí, y aprieta uno de estos dos — se muestra desde ese mismo punto.
          </div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
            <button onClick={() => dispararRepeticion(false)}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'13px', background:S.green, border:'none', borderRadius:'10px', cursor:'pointer', color:'#0a0a0a', fontSize:'.85rem', fontWeight:'700' }}>
              <PlayCircle size={17}/> Repetición
            </button>
            <button onClick={() => dispararRepeticion(true)}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'13px', background:'#2a2a2a', border:`1px solid ${S.green}`, borderRadius:'10px', cursor:'pointer', color:S.green, fontSize:'.85rem', fontWeight:'700' }}>
              <Gauge size={17}/> Cámara lenta
            </button>
          </div>
        </div>

        <div style={{ marginTop:'14px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px' }}>
          <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'8px' }}>GRÁFICA ENCIMA DEL VIDEO</div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <button onClick={() => cambiarOverlay(null, null)}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'10px 14px', background: !control.overlay ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.8rem', fontWeight:'700' }}>
              <Ban size={14}/> Ninguna
            </button>
            <button onClick={() => cambiarOverlay('tabla', partido?.tournament_id)}
              disabled={!tieneTorneo}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'10px 14px', background: control.overlay === 'tabla' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: tieneTorneo ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.8rem', fontWeight:'700', opacity: tieneTorneo ? 1 : .45 }}>
              <Table2 size={14}/> Tabla
            </button>
            <button onClick={() => cambiarOverlay('goles', null)}
              disabled={!partido}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'10px 14px', background: control.overlay === 'goles' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: partido ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.8rem', fontWeight:'700', opacity: partido ? 1 : .45 }}>
              <ListOrdered size={14}/> Goles
            </button>
            <button onClick={() => cambiarOverlay('jugadores', null)}
              disabled={!partido}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'10px 14px', background: control.overlay === 'jugadores' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: partido ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.8rem', fontWeight:'700', opacity: partido ? 1 : .45 }}>
              <Users size={14}/> Jugadores
            </button>
          </div>
        </div>

        {patrocinadoresBtn.length > 0 && (
          <div style={{ marginTop:'14px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px' }}>
            <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'8px' }}>MOSTRAR PUBLICIDAD DE UN PATROCINADOR</div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {patrocinadoresBtn.map(p => (
                <button key={p.id} onClick={() => mostrarPatrocinador(p.id)}
                  style={{ display:'flex', alignItems:'center', gap:'5px', padding:'10px 14px', background:'#2a2a2a', border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.8rem', fontWeight:'700' }}>
                  <Megaphone size={14}/> {p.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
