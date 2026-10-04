import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { derivarEnVivo, derivarColoresUniforme, derivarFaltasYTarjetas, buscarPartidoHermano, marcadorGlobal, partidoActivoDeStream } from '../lib/liveMatch'
import { computeTablaGeneral } from '../lib/torneoTablas'
import MarcadorEnVivoOverlay from '../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../components/GolesEnVivoOverlay'
import TablaEnVivoOverlay from '../components/TablaEnVivoOverlay'
import JugadoresEnVivoOverlay from '../components/JugadoresEnVivoOverlay'
import PatrocinadorEnVivoOverlay from '../components/PatrocinadorEnVivoOverlay'
import PatrocinadoresTorneoOverlay from '../components/PatrocinadoresTorneoOverlay'

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
// NO incluye la repetición / cámara lenta: en la portada esa función
// rebobina el reproductor de YouTube, y acá no hay reproductor — la
// repetición dentro de OBS se hace con su propio "Búfer de repetición".
//
// Parámetros opcionales en la URL:
//   ?prueba=1  fondo de cancha de mentiras, para verlo en un navegador normal
//   ?logo=0    sin el logo y la etiqueta "EN VIVO" arriba a la izquierda

const ANCHO_ESCENARIO = 860

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

export default function OverlayEnVivoPage() {
  const { streamId } = useParams()
  const [params] = useSearchParams()
  const modoPrueba = params.get('prueba') === '1'
  const mostrarLogo = params.get('logo') !== '0'
  const { escala, altoEscenario } = useEscala()

  const [siteConfig, setSiteConfig] = useState(null)
  const [matchesVivoRaw, setMatchesVivoRaw] = useState([])
  const [hermanosVivo, setHermanosVivo] = useState([])
  const [patrocinadores, setPatrocinadores] = useState([])
  const [tablas, setTablas] = useState({}) // { [tournamentId]: filas }
  const [patrocinadorMostrando, setPatrocinadorMostrando] = useState(null)
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
      .select('id, tournament_id, matchday, fase, status, home_team_id, away_team_id, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, modalidad)')
      .eq('status', 'scheduled')
      .or('live_state.not.is.null,live_state_rapida.not.is.null')
    if (error) return
    setMatchesVivoRaw(data || [])
  }

  async function fetchPatrocinadores() {
    const { data, error } = await supabase.from('patrocinadores_golmebol').select('*').eq('activo', true).order('orden').order('created_at')
    if (error) return
    setPatrocinadores(data || [])
  }

  useEffect(() => {
    fetchSiteConfig(); fetchPartidosVivo(); fetchPatrocinadores()
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
  const control = (siteConfig?.en_vivo_control || {})[streamId] || null

  // Tabla de posiciones: se trae cuando se prende el gráfico y se refresca
  // cada 30s mientras siga prendido (la portada solo la trae una vez, pero
  // acá la transmisión dura horas y la tabla cambia al terminar cada partido).
  const tablaTorneoId = control?.overlay === 'tabla' ? control.overlay_tournament_id : null
  useEffect(() => {
    if (!tablaTorneoId) return
    let cancelado = false
    async function cargar() {
      const [{ data: torneo }, { data: equiposData }, { data: partidosT }] = await Promise.all([
        supabase.from('tournaments').select('pts_victoria, pts_empate, pts_derrota').eq('id', tablaTorneoId).maybeSingle(),
        supabase.from('tournament_teams').select('teams(id, name, logo_url)').eq('tournament_id', tablaTorneoId),
        supabase.from('matches').select('status, fase, home_team_id, away_team_id, home_score, away_score').eq('tournament_id', tablaTorneoId),
      ])
      if (cancelado) return
      const equipos = (equiposData || []).map(d => d.teams).filter(Boolean)
      setTablas(t => ({ ...t, [tablaTorneoId]: computeTablaGeneral(equipos, partidosT || [], torneo || {}) }))
    }
    cargar()
    const t = setInterval(cargar, 30000)
    return () => { cancelado = true; clearInterval(t) }
  }, [tablaTorneoId])

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
    setPatrocinadorMostrando(patrocinadorId)
    clearTimeout(patrocinadorTimerRef.current)
    patrocinadorTimerRef.current = setTimeout(() => setPatrocinadorMostrando(null), 8000)
  }, [siteConfig, patrocinadorTs, patrocinadorId])
  useEffect(() => () => clearTimeout(patrocinadorTimerRef.current), [])

  const sponsor = patrocinadorMostrando ? patrocinadores.find(p => p.id === patrocinadorMostrando) : null

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
          {mostrarLogo && stream && (
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
              <img src="/marca/watermark-logo.png" alt="" style={{ height: '16px', width: 'auto', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.85))' }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#e5433d', animation: 'gmMicPulso 1s ease-in-out infinite' }}/>
                <span style={{ fontSize: '.42rem', fontWeight: 900, color: '#fff', letterSpacing: '.03em', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>EN VIVO</span>
              </div>
            </div>
          )}
          {partido && <MarcadorEnVivoOverlay partido={partido}/>}
          {sponsor ? <PatrocinadorEnVivoOverlay patrocinador={sponsor}/> : (
            <>
              {control?.overlay === 'goles' && partido && <GolesEnVivoOverlay partido={partido}/>}
              {control?.overlay === 'tabla' && <TablaEnVivoOverlay filas={tablas[control.overlay_tournament_id]}/>}
              {control?.overlay === 'jugadores' && partido && <JugadoresEnVivoOverlay partido={partido}/>}
            </>
          )}
          {partido?.tournament_id && (
            <PatrocinadoresTorneoOverlay logos={siteConfig?.patrocinador_logos_torneo?.[partido.tournament_id]} activos={control?.logos_activos}/>
          )}
        </div>
      </div>
    </>
  )
}
