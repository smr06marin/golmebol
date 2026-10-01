import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Users, Target, Radio, Building2, GraduationCap, Calendar, ArrowRight, X, MapPin, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react'
import { GiSoccerBall } from 'react-icons/gi'
import { FaFacebook, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa'
import { supabase } from '../lib/supabase'
import { derivarEnVivo, extraerGoles, extraerTarjetas, buscarPartidoHermano, marcadorGlobal, derivarColoresUniforme, derivarFaltasYTarjetas, idsPartidosDeStream, partidoActivoDeStream } from '../lib/liveMatch'
import { registrarVisita } from '../lib/visitas'
import LiveEmbed from '../components/LiveEmbed'
import MarcadorEnVivoOverlay from '../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../components/GolesEnVivoOverlay'
import TablaEnVivoOverlay from '../components/TablaEnVivoOverlay'
import JugadoresEnVivoOverlay from '../components/JugadoresEnVivoOverlay'
import PatrocinadorEnVivoOverlay from '../components/PatrocinadorEnVivoOverlay'
import PatrocinadoresTorneoOverlay from '../components/PatrocinadoresTorneoOverlay'
import { computeTablaGeneral } from '../lib/torneoTablas'

// Paleta inspirada en el mockup que pidió Sebas: header claro, cuerpo oscuro,
// acento verde (en vez del cyan/dorado que usa el resto de la app) — esta
// portada tiene su propia identidad visual, más "marketing", que el resto
// del sitio (que sigue siendo cyan/dorado sobre navy).
const S = {
  bg:      '#0a0a0a',
  bg2:     '#111111',
  card:    '#161616',
  card2:   '#1c1c1c',
  border:  '#2a2a2a',
  green:   '#6fcf3d',
  greenDk: '#4ca82a',
  red:     '#e5433d',
  gold:    '#f5a623',
  text:    '#ffffff',
  text2:   '#c9c9c9',
  muted:   '#8a8a8a',
}

function Escudo({ logo_url, name, size = 40, radius = 10 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size > 30 ? '4px' : '2px' }}/>
        : <span style={{ fontSize: size * .34, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

// Tamaño de letra del nombre del torneo según su largo — así un nombre
// largo se ve completo (más chiquito, hasta 2 líneas) en vez de cortarse
// con "..." en la tarjeta de la portada.
function tamNombreTorneo(nombre) {
  const len = (nombre || '').length
  if (len > 28) return '.7rem'
  if (len > 20) return '.78rem'
  if (len > 14) return '.85rem'
  return '.92rem'
}

function fmtFecha(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return null }
}

// Etiqueta corta del momento del partido: "1T · 12:34" o "DESCANSO"
function labelTiempoVivo(vivo) {
  if (vivo.descanso) return 'DESCANSO'
  const per = vivo.periodo === 2 ? '2T' : '1T'
  return `${per} · ${vivo.reloj}`
}

const COLOR_TARJETA = { amarilla: '#f9c400', azul: '#1a73e8', roja: '#d93025' }
function IconoTarjeta({ color }) {
  return <span style={{ display: 'inline-block', width: '9px', height: '13px', borderRadius: '2px', background: COLOR_TARJETA[color] || '#999', flexShrink: 0 }}/>
}

// Con qué torneo/fase/fecha se identifica un partido — se usa tanto en las
// tarjetas de "Partidos en vivo" como en el detalle al tocarlas.
const FASES_LABEL = { octavos: 'Octavos de final', cuartos: 'Cuartos de final', semifinal: 'Semifinales', final: 'Gran final' }
function labelPartido(m) {
  if (m.fase && m.fase !== 'grupo') return FASES_LABEL[m.fase] || 'Eliminatorias'
  if (m.matchday) return `Fecha ${m.matchday}`
  return m.tournaments?.name || ''
}

// Une goles y tarjetas en una sola línea de tiempo, ordenada minuto a
// minuto, para que el detalle del partido se lea como un relato (en vez de
// dos listas separadas que hay que cruzar mentalmente por minuto).
function eventosDelPartido(m) {
  const goles    = extraerGoles(m).map(g => ({ ...g, tipoEvento: 'gol' }))
  const tarjetas = extraerTarjetas(m).map(t => ({ ...t, tipoEvento: 'tarjeta' }))
  return [...goles, ...tarjetas].sort((a, b) => (a.periodo - b.periodo) || ((parseInt(a.minuto) || 0) - (parseInt(b.minuto) || 0)))
}

// Detalle de un partido en vivo: marcador, reloj y lista de goles/tarjetas —
// se lee del mismo snapshot que ya sube en tiempo real la planilla del
// árbitro (matches.live_state / live_state_rapida), sin depender de que el
// jugador quede registrado en el torneo.
function LiveMatchDetalle({ m, onClose }) {
  // Bloquear el scroll del fondo mientras el modal está abierto: si no, en
  // Android el gesto de scroll dentro del modal se "escapa" hacia la página
  // de atrás apenas llega al borde (scroll chaining) y rebota, dando la
  // sensación de que no deja bajar a ver el resto (ej. las tarjetas).
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  const eventos = eventosDelPartido(m)
  const torneoNombre = m.tournaments?.name
  const torneoFase = labelPartido(m)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 560, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '22px 20px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontWeight: 900, color: m.vivo.descanso ? S.gold : S.red, fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Radio size={14}/> {m.vivo.descanso ? 'DESCANSO' : `EN VIVO · ${labelTiempoVivo(m.vivo)}`}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', display: 'flex', padding: '4px' }}><X size={20}/></button>
        </div>

        {(torneoNombre || torneoFase) && (
          <div style={{ textAlign: 'center', marginBottom: '10px', color: S.text2, fontSize: '.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {torneoNombre && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: S.green }}><Trophy size={11}/> {torneoNombre}</span>}
            {torneoNombre && torneoFase && torneoFase !== torneoNombre && <span style={{ color: S.muted }}>·</span>}
            {torneoFase && torneoFase !== torneoNombre && <span>{torneoFase}</span>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '22px', margin: '18px 0 22px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <Escudo logo_url={m.home?.logo_url} name={m.home?.name} size={56}/>
            <div style={{ color: S.text, fontWeight: 800, fontSize: '.82rem', marginTop: '8px' }}>{m.home?.name}</div>
          </div>
          {m.hermano && m.global ? (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '.6rem', color: S.muted, fontWeight: 800, letterSpacing: '.04em' }}>IDA</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: S.text2 }}>{m.idaLocal} - {m.idaVisitante}</div>
              <div style={{ fontSize: '.6rem', color: S.red, fontWeight: 800, letterSpacing: '.04em', marginTop: '8px' }}>VUELTA · EN VIVO</div>
              <div style={{ color: S.text, fontWeight: 900, fontSize: '1.5rem', letterSpacing: '.02em' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${S.border}` }}>
                <div style={{ fontSize: '.62rem', color: S.gold, fontWeight: 900, letterSpacing: '.04em' }}>GLOBAL</div>
                <div style={{ fontWeight: 900, fontSize: '1.5rem', color: S.gold }}>{m.global.local} - {m.global.visitante}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: S.text, fontWeight: 900, fontSize: '2rem', letterSpacing: '.02em' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
          )}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <Escudo logo_url={m.away?.logo_url} name={m.away?.name} size={56}/>
            <div style={{ color: S.text, fontWeight: 800, fontSize: '.82rem', marginTop: '8px' }}>{m.away?.name}</div>
          </div>
        </div>

        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '.66rem', fontWeight: 800, color: S.muted, letterSpacing: '.08em', marginBottom: '10px', textAlign: 'center' }}>MINUTO A MINUTO</div>
          {eventos.length === 0 ? (
            <div style={{ textAlign: 'center', color: S.muted, fontSize: '.8rem', padding: '18px 0' }}>Aún no hay goles ni tarjetas</div>
          ) : (
            <div>
              {eventos.map((ev, i) => {
                const esLocal = ev.equipo === 'local'
                const icono = ev.tipoEvento === 'gol' ? <GiSoccerBall size={13} color={S.text}/> : <IconoTarjeta color={ev.color}/>
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', alignItems: 'center', gap: '6px', padding: '8px 0', borderTop: i > 0 ? `1px solid ${S.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', textAlign: 'right', minWidth: 0 }}>
                      {esLocal && <>
                        <span style={{ fontWeight: 700, fontSize: '.8rem', color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.jugador}</span>
                        <span style={{ flexShrink: 0, display: 'flex' }}>{icono}</span>
                      </>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: '999px', padding: '3px 8px', fontSize: '.64rem', fontWeight: 800, color: S.text2, whiteSpace: 'nowrap' }}>{ev.minuto ? `${ev.minuto}'` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      {!esLocal && <>
                        <span style={{ flexShrink: 0, display: 'flex' }}>{icono}</span>
                        <span style={{ fontWeight: 700, fontSize: '.8rem', color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.jugador}</span>
                      </>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Enlace directo de WhatsApp — acepta el número con o sin indicativo, con
// espacios/guiones/paréntesis, y arma el link con un mensaje ya escrito.
function linkWhatsapp(numero, texto) {
  const digitos = (numero || '').replace(/\D/g, '')
  if (!digitos) return null
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`
}

// Detalle de un patrocinador oficial al tocar su banner: info de contacto,
// botón directo a WhatsApp y redes sociales.
function PatrocinadorDetalleModal({ p, onClose }) {
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  const waLink = linkWhatsapp(p.whatsapp, `Hola! Vi a ${p.nombre} como patrocinador de Golmebol y quería escribirles 🙂`)
  const redes = [
    p.facebook  && { href: p.facebook,  icon: <FaFacebook size={16}/>,  label: 'Facebook',  color: '#1877f2' },
    p.instagram && { href: p.instagram, icon: <FaInstagram size={16}/>, label: 'Instagram', color: '#e1306c' },
    p.tiktok    && { href: p.tiktok,    icon: <FaTiktok size={16}/>,    label: 'TikTok',     color: '#fff' },
  ].filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 560, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '22px 20px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <span style={{ fontWeight: 900, color: S.green, fontSize: '.78rem', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: '6px' }}><Megaphone size={14}/> PATROCINADOR OFICIAL</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', display: 'flex', padding: '4px' }}><X size={20}/></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '18px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '12px' }}>
            {p.logo_url ? <img src={p.logo_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}/> : <Megaphone size={30} color="#1a3a8a"/>}
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{p.nombre}</div>
          {p.direccion && (
            <div style={{ fontSize: '.8rem', color: S.text2, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={13} color={S.muted}/> {p.direccion}
            </div>
          )}
        </div>

        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="gm-hover"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: '#25d366', borderRadius: '12px', color: '#fff', fontWeight: '800', fontSize: '.92rem', textDecoration: 'none', marginBottom: '12px' }}>
            <FaWhatsapp size={18}/> Escribir a {p.nombre}
          </a>
        )}

        {redes.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {redes.map(r => (
              <a key={r.label} href={r.href} target="_blank" rel="noopener noreferrer" title={r.label} className="gm-hover"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', background: S.card, border: `1px solid ${S.border}`, color: r.color }}>
                {r.icon}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Equipo campeón: sale de la(s) partido(s) de la GRAN FINAL (fase 'final',
// sin contar el de tercer puesto) — suma goles si fue ida y vuelta, y si
// empataron global usa penales. Misma lógica que usa el árbol público de
// cada torneo (TorneoPublicoPage) para decidir el ganador de una llave.
function calcularCampeon(mts) {
  const finales = mts.filter(m => m.fase === 'final' && m.status === 'finished' && !(m.ronda || '').toLowerCase().includes('tercer'))
  if (finales.length === 0) return null
  const teamAId = finales[0].home_team_id, teamBId = finales[0].away_team_id
  const partidosFinal = finales.filter(m => (m.home_team_id === teamAId || m.home_team_id === teamBId) && (m.away_team_id === teamAId || m.away_team_id === teamBId))
  let golesA = 0, golesB = 0
  partidosFinal.forEach(m => {
    if (m.home_team_id === teamAId) { golesA += m.home_score || 0; golesB += m.away_score || 0 }
    else { golesA += m.away_score || 0; golesB += m.home_score || 0 }
  })
  let ganadorId = null
  if (golesA > golesB) ganadorId = teamAId
  else if (golesB > golesA) ganadorId = teamBId
  else {
    const conPenales = [...partidosFinal].reverse().find(m => m.penales_ganador || (m.penales_local != null && m.penales_visitante != null && m.penales_local !== m.penales_visitante))
    if (conPenales) {
      const ganaHome = conPenales.penales_ganador ? conPenales.penales_ganador === 'home' : conPenales.penales_local > conPenales.penales_visitante
      ganadorId = ganaHome ? conPenales.home_team_id : conPenales.away_team_id
    }
  }
  if (!ganadorId) return null
  const partidoGanador = partidosFinal.find(m => m.home_team_id === ganadorId || m.away_team_id === ganadorId)
  const equipo = partidoGanador.home_team_id === ganadorId ? partidoGanador.home : partidoGanador.away
  return equipo ? { id: ganadorId, name: equipo.name, logo_url: equipo.logo_url } : null
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ torneos: 0, jugadores: 0, equipos: 0, goles: 0 })
  const [torneos, setTorneos] = useState([])
  const [visitasHoy, setVisitasHoy] = useState({}) // { [torneo_id]: cantidad de visitas hoy }
  const [matchesVivoRaw, setMatchesVivoRaw] = useState([])
  const [detalleVivoId,  setDetalleVivoId]  = useState(null) // id del partido en vivo que se está viendo en detalle (goles/tarjetas)
  const [escenarios, setEscenarios] = useState([])
  const [escenarioIdx, setEscenarioIdx] = useState(0) // qué foto de escenario se muestra ahora en el carrusel
  const [escuelas, setEscuelas] = useState([])
  const [tick, setTick] = useState(0)
  const [siteConfig, setSiteConfig] = useState(null)
  const [patrocinadores, setPatrocinadores] = useState([])
  const [patroIdx, setPatroIdx] = useState(0) // qué patrocinador se muestra ahora en el banner
  const [patroDetalle, setPatroDetalle] = useState(null) // patrocinador abierto en el modal de detalle

  const torneosRef = useRef(null)
  const vivoRef = useRef(null)

  // Arrastrar con el mouse para mover el carrusel de torneos en PC — en
  // celular ya se mueve con el dedo (scroll táctil nativo), pero en
  // computador sin pantalla táctil no había forma de moverlo.
  const scrollerRef = useRef(null)
  const arrastreRef = useRef({ activo: false, x: 0, scrollLeft: 0, movido: false })

  function iniciarArrastre(e) {
    const el = scrollerRef.current
    if (!el) return
    arrastreRef.current = { activo: true, x: e.pageX, scrollLeft: el.scrollLeft, movido: false }
  }
  function moverArrastre(e) {
    const st = arrastreRef.current
    const el = scrollerRef.current
    if (!st.activo || !el) return
    const delta = e.pageX - st.x
    if (Math.abs(delta) > 4) st.movido = true
    el.scrollLeft = st.scrollLeft - delta
  }
  function terminarArrastre() {
    arrastreRef.current.activo = false
  }
  function moverCarrusel(direccion) {
    scrollerRef.current?.scrollBy({ left: direccion * 260, behavior: 'smooth' })
  }

  useEffect(() => {
    fetchStats(); fetchTorneosActivos(); fetchPartidosVivo(); fetchEscenarios(); fetchEscuelas(); fetchVisitasHoy(); fetchSiteConfig(); fetchPatrocinadores()
    registrarVisita('inicio')
  }, [])

  // Reloj de los partidos en vivo: recalcula localmente cada segundo, y cada
  // 20s refresca de verdad por si hubo un gol nuevo o cambió algo. Cada 30s
  // también se refresca el conteo de visitas del día, para que el orden de
  // "torneos en juego" (los más consultados primero) se vaya actualizando
  // solo, sin que nadie tenga que recargar la página.
  useEffect(() => {
    const tRelog = setInterval(() => setTick(x => x + 1), 1000)
    const tRefetch = setInterval(fetchPartidosVivo, 20000)
    const tVisitas = setInterval(fetchVisitasHoy, 30000)
    // site_config trae el panel de control en vivo (en_vivo_control): el
    // realtime de más abajo ya lo refresca casi al instante, pero este
    // refresco de respaldo cada 5s asegura que el botón de repetición/tabla/
    // goles igual llegue aunque el realtime de esa tabla falle por lo que
    // sea (hay que correr migracion_realtime_site_config.sql para que
    // funcione bien de una, esto es solo el respaldo).
    const tControl = setInterval(fetchSiteConfig, 5000)
    return () => { clearInterval(tRelog); clearInterval(tRefetch); clearInterval(tVisitas); clearInterval(tControl) }
  }, [])

  // Carrusel de fotos de escenarios y banner de patrocinadores: cada uno
  // avanza solo cada 5 segundos, para que se vean todos sin que nadie tenga
  // que hacer nada.
  useEffect(() => {
    const tEsc = setInterval(() => setEscenarioIdx(i => i + 1), 5000)
    const tPatro = setInterval(() => setPatroIdx(i => i + 1), 5000)
    return () => { clearInterval(tEsc); clearInterval(tPatro) }
  }, [])

  // Ida y vuelta: para cada partido en vivo que sea de una fase de
  // eliminación (nunca en grupos), busca si ya se jugó el otro partido de la
  // llave — así se puede mostrar "Ida / Vuelta (en vivo) / Global". (Declarado
  // acá arriba, antes del useMemo de partidosVivo, porque ese useMemo ya lo
  // usa — si quedara declarado más abajo, sería un error "Cannot access
  // 'hermanosVivo' before initialization" al renderizar.)
  const [hermanosVivo, setHermanosVivo] = useState([])

  const partidosVivo = useMemo(() => {
    void tick
    return matchesVivoRaw.map(m => ({ ...m, vivo: derivarEnVivo(m), colores: derivarColoresUniforme(m), detalle: derivarFaltasYTarjetas(m) })).filter(m => m.vivo).map(m => {
      if (!m.fase || m.fase === 'grupo') return m
      const hermano = buscarPartidoHermano(m, hermanosVivo)
      if (!hermano) return m
      const invertido = hermano.home_team_id === m.away_team_id
      const idaLocal     = invertido ? (hermano.away_score || 0) : (hermano.home_score || 0)
      const idaVisitante = invertido ? (hermano.home_score || 0) : (hermano.away_score || 0)
      return { ...m, hermano, idaLocal, idaVisitante, global: marcadorGlobal(m, hermano) }
    })
  }, [matchesVivoRaw, hermanosVivo, tick])

  // Transmisiones en vivo activas — puede haber varias a la vez (por ejemplo
  // si hay varios partidos jugándose a la misma hora en canchas distintas),
  // cada una configurada desde /admin/config-sitio con su propio link y,
  // opcionalmente, su propio partido para el marcador.
  const streamsVivos = useMemo(() => (
    Array.isArray(siteConfig?.en_vivo_streams) ? siteConfig.en_vivo_streams : []
  ).filter(s => s.activo && (s.url || '').trim()), [siteConfig])

  // Mientras haya alguna transmisión con marcador activa, escucha los
  // cambios de la tabla matches casi al instante (en vez de esperar hasta
  // 20s del refresco normal) — así, apenas el árbitro anota un gol, la
  // repetición sale de una y no varios segundos tarde.
  useEffect(() => {
    const hayMarcadorActivo = streamsVivos.some(s => idsPartidosDeStream(s).length > 0)
    if (!hayMarcadorActivo) return
    const timer = { current: null }
    const channel = supabase
      .channel('landing-en-vivo-marcador')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        clearTimeout(timer.current)
        timer.current = setTimeout(fetchPartidosVivo, 400)
      })
      .subscribe()
    return () => { clearTimeout(timer.current); supabase.removeChannel(channel) }
  }, [streamsVivos])

  // Mientras haya alguna transmisión activa, escucha los cambios en
  // site_config casi al instante — es ahí donde vive el panel de control de
  // /admin/config-sitio (ver en_vivo_control), así que apenas quien
  // transmite aprieta un botón (repetición, mostrar tabla, mostrar goles),
  // se ve acá sin que nadie tenga que recargar la página.
  useEffect(() => {
    if (!streamsVivos.length) return
    const timer = { current: null }
    const channel = supabase
      .channel('landing-en-vivo-control')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_config' }, () => {
        clearTimeout(timer.current)
        timer.current = setTimeout(fetchSiteConfig, 300)
      })
      .subscribe()
    return () => { clearTimeout(timer.current); supabase.removeChannel(channel) }
  }, [streamsVivos.length])

  // Imágenes para la repetición del gol — se cargan desde /admin/config-sitio
  // (junto con el link de la transmisión en vivo), se puede subir varias y
  // van rotando en orden.
  const imagenesRepeticion = useMemo(() => (
    Array.isArray(siteConfig?.en_vivo_repeticion_imagenes) ? siteConfig.en_vivo_repeticion_imagenes : []
  ), [siteConfig])

  // Repetición automática del gol: cuando el árbitro anota un gol en el
  // partido de alguna transmisión activa, se le avisa a esa transmisión
  // (ver LiveEmbed) para que rebobine unos segundos y muestre otra vez la
  // jugada, tapándola primero un instante con la imagen que le toque en la
  // rotación (si ya hay alguna cargada).
  //
  // OJO con el retraso de la transmisión: el video en vivo (YouTube/Facebook)
  // siempre va varios segundos ATRASADO respecto al partido real (retraso de
  // transmisión normal en cualquier "en vivo" — puede ser 10, 20, hasta 40
  // segundos según cómo esté transmitiendo). Si se dispara la repetición de
  // una, apenas el árbitro anota el gol, el video TODAVÍA no ha mostrado esa
  // jugada — se rebobina hacia un momento anterior al gol y la repetición no
  // alcanza a mostrarlo. Por eso acá se ESPERA "retraso_segundos" (configurado
  // por transmisión en /admin/config-sitio, con la transmisión real de
  // Sebas) antes de disparar la repetición: ese tiempo es justo lo que le
  // falta al video para "alcanzar" el momento del gol, así que cuando por
  // fin se dispara, el gol ya pasó en la transmisión y el rebobinado sí lo
  // agarra.
  //
  // repeticion_automatica_desactivada (botón nuevo en el panel de control):
  // apaga ESTA repetición automática y aproximada, nada más — el marcador
  // sigue actualizándose solo en tiempo real pase lo que pase acá, y el
  // resumen de goles del entretiempo (ver AdminConfigSitioPage) también
  // sigue guardando los goles igual. Con esto apagado, cada repetición se
  // dispara a mano desde el panel (botón "Repetición"), con el punto exacto
  // que Sebas elija devolviéndose con la barra de YouTube — más preciso que
  // el cálculo aproximado de acá.
  const golesAnterioresRef = useRef({}) // { [matchId]: { local, vis } }
  const repeticionContadorRef = useRef(0)
  const repeticionTimersRef = useRef([]) // ids de los setTimeout de espera, para limpiarlos si el componente se desmonta
  const [repeticiones, setRepeticiones] = useState({}) // { [streamId]: { key, segundos, imagenUrl } }

  useEffect(() => {
    streamsVivos.forEach(s => {
      const partido = partidoActivoDeStream(s, partidosVivo)
      if (!partido?.vivo) return
      const anterior = golesAnterioresRef.current[partido.id]
      const actual = { local: partido.vivo.golesLocal || 0, vis: partido.vivo.golesVis || 0 }
      // repeticion_automatica_desactivada (botón del panel de control): el
      // marcador de arriba (partido.vivo) se sigue actualizando siempre, en
      // tiempo real, pase lo que pase acá — esto SOLO apaga la repetición
      // que se dispara sola y aproximada; con esto apagado, Sebas se encarga
      // de todas a mano, con el botón de Repetición, en el momento exacto
      // que él vea que corresponde.
      const automaticaApagada = !!(siteConfig?.en_vivo_control || {})[s.id]?.repeticion_automatica_desactivada
      if (anterior && !automaticaApagada && (actual.local > anterior.local || actual.vis > anterior.vis)) {
        const imagenUrl = imagenesRepeticion.length
          ? imagenesRepeticion[repeticionContadorRef.current % imagenesRepeticion.length].url
          : null
        repeticionContadorRef.current += 1
        const retrasoMs = Math.max(0, Number(s.retraso_segundos) || 20) * 1000
        // segundosAtras es configurable por transmisión (/admin/config-sitio)
        // porque en la práctica cada transmisión queda con un atraso real
        // distinto — si se queda corto, el rebobinado cae en medio de la
        // celebración en vez de antes del gol (ver LiveEmbed). duracionVisible:
        // los 12 segundos de juego que pidió Sebas, contados desde que se va
        // la imagen del patrocinador.
        const segundosAtras = Math.max(0, Number(s.segundos_repeticion) || 28)
        const timerId = setTimeout(() => {
          setRepeticiones(r => ({ ...r, [s.id]: { key: Date.now(), segundosAtras, duracionVisible: 12, imagenUrl } }))
        }, retrasoMs)
        repeticionTimersRef.current.push(timerId)
      }
      golesAnterioresRef.current[partido.id] = actual
    })
  }, [partidosVivo, streamsVivos, imagenesRepeticion, siteConfig])

  useEffect(() => () => repeticionTimersRef.current.forEach(clearTimeout), [])

  // Repetición MANUAL, disparada a propósito desde el panel de control de
  // /admin/config-sitio (botón "Repetición" o "Cámara lenta") — a diferencia
  // de la automática de arriba (que espera el retraso de la transmisión
  // porque reacciona sola a un gol que nadie vio venir), acá quien transmite
  // ya está viendo el video en el momento justo, así que se dispara de una,
  // sin esperar nada. `repeticion_ts` cambia cada vez que se aprieta el
  // botón (ver en_vivo_control); se compara contra la última marca ya
  // procesada para no repetir la misma repetición dos veces si llega otro
  // cambio de site_config por cualquier otro motivo.
  const controlRepeticionRef = useRef({}) // { [streamId]: último repeticion_ts ya mostrado }
  useEffect(() => {
    const control = siteConfig?.en_vivo_control || {}
    streamsVivos.forEach(s => {
      const c = control[s.id]
      if (!c?.repeticion_ts || controlRepeticionRef.current[s.id] === c.repeticion_ts) return
      controlRepeticionRef.current[s.id] = c.repeticion_ts
      const imagenUrl = imagenesRepeticion.length
        ? imagenesRepeticion[repeticionContadorRef.current % imagenesRepeticion.length].url
        : null
      repeticionContadorRef.current += 1
      // repeticion_objetivo_segundos: el segundo exacto de la transmisión al
      // que se devolvió quien transmite con la barra de YouTube en su propio
      // panel — se salta directo ahí, en vez de calcular "tantos segundos
      // para atrás" (eso solo lo usa la repetición automática del gol, arriba,
      // que no tiene un punto elegido a mano). Si no vino (transmisión que no
      // es de YouTube, o el reproductor de quien transmite no respondió a
      // tiempo), LiveEmbed cae de vuelta al valor configurado para esta
      // transmisión.
      const segundosAtras = Math.max(0, Number(s.segundos_repeticion) || 28)
      setRepeticiones(r => ({ ...r, [s.id]: { key: Date.now(), objetivoSegundos: c.repeticion_objetivo_segundos, segundosAtras, duracionVisible: 12, imagenUrl, camaraLenta: !!c.repeticion_camara_lenta } }))
    })
  }, [siteConfig, streamsVivos, imagenesRepeticion])

  // Resumen de goles del entretiempo: /admin/config-sitio guarda solo, gol a
  // gol, el segundo exacto de cada uno (ver resumen_goles en
  // en_vivo_control) y avisa una sola vez (resumen_ts) apenas el árbitro
  // marca el descanso — acá no hace falta calcular nada, solo encadenar los
  // goles de la lista uno detrás de otro: cada uno se muestra con
  // `ultimoDeSerie:false` (LiveEmbed no vuelve al en vivo solo, avisa con
  // `onFinSegmento` cuando termina ese gol) menos el ÚLTIMO, que si hace el
  // cierre normal y vuelve al en vivo, igual que cualquier repetición.
  const controlResumenRef = useRef({}) // { [streamId]: último resumen_ts ya mostrado }
  function mostrarGolDeResumen(s, goles, indice) {
    const gol = goles[indice]
    if (!gol || typeof gol.segundo !== 'number' || !isFinite(gol.segundo)) {
      // Gol sin segundo guardado (no se pudo leer getCurrentTime en su
      // momento) — se salta, en vez de cortar ahí todo el resumen.
      if (indice + 1 < goles.length) mostrarGolDeResumen(s, goles, indice + 1)
      return
    }
    const etiqueta = `${gol.jugador || 'Gol'}${gol.minuto ? ' · ' + gol.minuto + "'" : ''}`
    setRepeticiones(r => ({
      ...r,
      [s.id]: {
        key: Date.now(),
        objetivoSegundos: gol.segundo,
        duracionVisible: 10,
        etiqueta,
        ultimoDeSerie: indice === goles.length - 1,
        onFinSegmento: () => mostrarGolDeResumen(s, goles, indice + 1),
      },
    }))
  }
  useEffect(() => {
    const control = siteConfig?.en_vivo_control || {}
    streamsVivos.forEach(s => {
      const c = control[s.id]
      const goles = Array.isArray(c?.resumen_goles) ? c.resumen_goles : []
      if (!c?.resumen_ts || controlResumenRef.current[s.id] === c.resumen_ts || !goles.length) return
      controlResumenRef.current[s.id] = c.resumen_ts
      mostrarGolDeResumen(s, goles, 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mostrarGolDeResumen se redefine cada render pero no hace falta re-correr el efecto por eso
  }, [siteConfig, streamsVivos])

  // Gráfica de tabla de posiciones encima del video (también prendida desde
  // el panel de control): se trae y calcula una sola vez por torneo (caché),
  // reutilizando computeTablaGeneral — la misma función que usa la tabla de
  // posiciones real del torneo — para que la gráfica en vivo muestre
  // exactamente lo mismo que esa tabla.
  const [tablasEnVivo, setTablasEnVivo] = useState({}) // { [tournamentId]: filas }
  useEffect(() => {
    const control = siteConfig?.en_vivo_control || {}
    const idsFaltantes = [...new Set(
      Object.values(control)
        .filter(c => c?.overlay === 'tabla' && c.overlay_tournament_id)
        .map(c => c.overlay_tournament_id)
    )].filter(tid => !tablasEnVivo[tid])
    if (!idsFaltantes.length) return
    idsFaltantes.forEach(async tid => {
      const [{ data: torneo }, { data: equiposData }, { data: partidosT }] = await Promise.all([
        supabase.from('tournaments').select('pts_victoria, pts_empate, pts_derrota').eq('id', tid).maybeSingle(),
        supabase.from('tournament_teams').select('teams(id, name, logo_url)').eq('tournament_id', tid),
        supabase.from('matches').select('status, fase, home_team_id, away_team_id, home_score, away_score').eq('tournament_id', tid),
      ])
      const equipos = (equiposData || []).map(d => d.teams).filter(Boolean)
      setTablasEnVivo(t => ({ ...t, [tid]: computeTablaGeneral(equipos, partidosT || [], torneo || {}) }))
    })
  }, [siteConfig, tablasEnVivo])

  // Publicidad de un patrocinador (botón del panel de control, aparte de los
  // patrocinadores oficiales que ya rotan solos en el banner de abajo): a
  // diferencia de tabla/goles/jugadores, esto no se queda prendido — aparece
  // unos segundos encima del video y se apaga solo.
  const patrocinadorVistoRef = useRef({}) // { [streamId]: último patrocinador_ts ya mostrado }
  const [patrocinadoresMostrando, setPatrocinadoresMostrando] = useState({}) // { [streamId]: patrocinadorId }
  useEffect(() => {
    const control = siteConfig?.en_vivo_control || {}
    streamsVivos.forEach(s => {
      const c = control[s.id]
      if (!c?.patrocinador_ts || patrocinadorVistoRef.current[s.id] === c.patrocinador_ts) return
      patrocinadorVistoRef.current[s.id] = c.patrocinador_ts
      setPatrocinadoresMostrando(m => ({ ...m, [s.id]: c.patrocinador_id }))
      setTimeout(() => setPatrocinadoresMostrando(m => ({ ...m, [s.id]: null })), 8000)
    })
  }, [siteConfig, streamsVivos])

  async function fetchStats() {
    const [{ count: cTorneos }, { count: cJugadores }, { count: cEquipos }, { data: golesData }] = await Promise.all([
      supabase.from('tournaments').select('id', { count: 'exact', head: true }),
      supabase.from('players_publico').select('id', { count: 'exact', head: true }),
      supabase.from('teams').select('id', { count: 'exact', head: true }),
      supabase.from('matches').select('home_score, away_score').eq('status', 'finished'),
    ])
    const goles = (golesData || []).reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0)
    setStats({ torneos: cTorneos || 0, jugadores: cJugadores || 0, equipos: cEquipos || 0, goles })
  }

  async function fetchTorneosActivos() {
    let torsRes = await supabase.from('tournaments').select('id, name, logo_url, modalidad, season, created_at, archivado, torneo_padre_id, edicion').eq('status', 'active')
    if (torsRes.error) torsRes = await supabase.from('tournaments').select('id, name, logo_url, modalidad, season, torneo_padre_id, edicion').eq('status', 'active')
    const torsRaw = torsRes.data || []
    const [{ data: tts }, { data: ms }] = await Promise.all([
      supabase.from('tournament_teams').select('tournament_id'),
      supabase.from('matches').select('tournament_id, matchday, fase, status, ronda, home_team_id, away_team_id, home_score, away_score, penales_local, penales_visitante, penales_ganador, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)'),
    ])
    // Una edición archivada (porque ya se creó la siguiente) no se muestra
    // en el feed principal — solo se ve la edición vigente de cada torneo.
    const tors = torsRaw.filter(t => !t.archivado)
    const cuentaEq = {}
    ;(tts || []).forEach(t => { cuentaEq[t.tournament_id] = (cuentaEq[t.tournament_id] || 0) + 1 })
    const FASES = { octavos: 'Octavos de final', cuartos: 'Cuartos de final', semifinal: 'Semifinales', final: 'Gran final' }
    const PESO  = { octavos: 1, cuartos: 2, semifinal: 3, final: 4 }
    const base = tors.map(t => {
      const mts = (ms || []).filter(m => m.tournament_id === t.id)
      const elim = mts.filter(m => m.fase && m.fase !== 'grupo').sort((a, b) => (PESO[b.fase] || 0) - (PESO[a.fase] || 0))[0]
      const maxFecha = Math.max(0, ...mts.filter(m => m.matchday).map(m => m.matchday))
      const estado = elim ? (FASES[elim.fase] || 'Eliminatorias') : maxFecha > 0 ? `Fecha ${maxFecha}` : 'Por comenzar'
      // El torneo no tiene un status "finalizado" en la base (nunca se marca
      // así desde el admin) — se deduce de si ya se jugó la gran final. OJO:
      // NO se puede usar "todos los partidos que existen están finalizados"
      // como señal de torneo terminado — eso daba falsos positivos: cuando
      // se juega toda una fecha (jornada) y el admin todavía no ha creado la
      // siguiente, momentáneamente TODOS los partidos existentes quedan en
      // 'finished' aunque el torneo siga en curso y no haya campeón todavía
      // (pasó con el Torneo Relámpago Municipal Córdoba).
      const finalizado = mts.some(m => m.fase === 'final' && m.status === 'finished')
      const campeon = finalizado ? calcularCampeon(mts) : null
      return { ...t, equipos: cuentaEq[t.id] || 0, estado, finalizado, campeon }
    })

    // Campeón vigente: la edición que se está jugando ahora todavía no tiene
    // campeón propio (recién empieza) — se muestra el de la edición anterior
    // ya finalizada en vez de dejar la tarjeta vacía. Ojo: tournament_logros
    // no tiene relación declarada hacia teams en Supabase, así que se busca
    // el equipo en una consulta aparte (ver TorneoPublicoPage).
    const sinCampeonPropio = base.filter(t => !t.campeon)
    if (sinCampeonPropio.length > 0) {
      const raizPorId = Object.fromEntries(torsRaw.map(t => [t.id, t.torneo_padre_id || t.id]))
      const edicionPorId = Object.fromEntries(torsRaw.map(t => [t.id, t.edicion || 1]))
      const raizRelevantes = new Set(sinCampeonPropio.map(t => raizPorId[t.id]))
      const idsRelevantes = torsRaw.filter(t => raizRelevantes.has(raizPorId[t.id])).map(t => t.id)
      if (idsRelevantes.length > 0) {
        const { data: camps } = await supabase.from('tournament_logros').select('tournament_id, team_id').in('tournament_id', idsRelevantes).eq('tipo', 'campeon').limit(1000)
        const mejorPorRaiz = {}
        ;(camps || []).forEach(c => {
          if (!c.team_id) return
          const raiz = raizPorId[c.tournament_id]
          const ed = edicionPorId[c.tournament_id] || 0
          if (!mejorPorRaiz[raiz] || ed > mejorPorRaiz[raiz].edicion) mejorPorRaiz[raiz] = { edicion: ed, team_id: c.team_id }
        })
        const teamIds = [...new Set(Object.values(mejorPorRaiz).map(m => m.team_id))]
        if (teamIds.length > 0) {
          const { data: teamsData } = await supabase.from('teams').select('id,name,logo_url').in('id', teamIds)
          const teamById = Object.fromEntries((teamsData || []).map(tm => [tm.id, tm]))
          Object.values(mejorPorRaiz).forEach(m => { m.team = teamById[m.team_id] || null })
        }
        base.forEach(t => {
          if (t.campeon) return
          const mejor = mejorPorRaiz[raizPorId[t.id]]
          if (mejor) t.campeonVigente = mejor
        })
      }
    }

    setTorneos(base)
  }

  // Conteo público de visitas a la tabla de cada torneo, solo de hoy (ver
  // migracion_visitas_torneos_publico.sql) — para ordenar "torneos en
  // juego" poniendo primero los que más está consultando la gente. Si la
  // migración todavía no se corrió, la vista no existe y esto simplemente
  // no cambia el orden (se queda como venía).
  async function fetchVisitasHoy() {
    const { data, error } = await supabase.from('site_visitas_torneos_hoy').select('torneo_id, visitas')
    if (error || !data) return
    const mapa = {}
    data.forEach(r => { mapa[r.torneo_id] = r.visitas })
    setVisitasHoy(mapa)
  }

  async function fetchPartidosVivo() {
    const { data } = await supabase.from('matches')
      .select('id, tournament_id, matchday, fase, status, home_team_id, away_team_id, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name, modalidad)')
      .eq('status', 'scheduled')
      .or('live_state.not.is.null,live_state_rapida.not.is.null')
    setMatchesVivoRaw(data || [])
  }

  useEffect(() => {
    const pares = [...new Set(matchesVivoRaw.filter(m => m.fase && m.fase !== 'grupo').map(m => `${m.tournament_id}|${m.fase}`))]
    if (!pares.length) { setHermanosVivo([]); return }
    Promise.all(pares.map(par => {
      const [tid, fase] = par.split('|')
      return supabase.from('matches').select('id, tournament_id, fase, home_team_id, away_team_id, home_score, away_score, status').eq('tournament_id', tid).eq('fase', fase).eq('status', 'finished')
    })).then(resultados => setHermanosVivo(resultados.flatMap(r => r.data || [])))
  }, [matchesVivoRaw])

  async function fetchEscenarios() {
    // Sin límite: el carrusel de fotos de abajo tiene que poder mostrar
    // TODOS los escenarios activos, no solo los primeros 6.
    const { data } = await supabase.from('escenarios').select('id, name, city, logo_url, imagen_fondo_url').eq('activo', true)
    setEscenarios(data || [])
  }

  // Patrocinadores oficiales de Golmebol — banner que rota cada 5s en la
  // portada pública (se gestionan desde /admin/patrocinadores). Si la tabla
  // todavía no existe (falta correr migracion_patrocinadores_golmebol.sql),
  // simplemente no se muestra nada, sin romper el resto de la página.
  async function fetchPatrocinadores() {
    const { data, error } = await supabase.from('patrocinadores_golmebol').select('*').eq('activo', true).order('orden').order('created_at')
    if (error) return
    setPatrocinadores(data || [])
  }

  async function fetchEscuelas() {
    const { data } = await supabase.from('teams').select('id, name, logo_url, categoria').eq('tipo', 'escuela').limit(6)
    setEscuelas(data || [])
  }

  // Link de "en vivo" (YouTube/Facebook/Instagram) que se configura desde
  // /admin/config-sitio — si la tabla todavía no existe (falta correr
  // migracion_site_config.sql) simplemente no se muestra nada, sin romper
  // el resto de la página.
  async function fetchSiteConfig() {
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams, en_vivo_repeticion_imagenes, en_vivo_control, patrocinador_logos_torneo').eq('id', true).maybeSingle()
    if (error) return
    setSiteConfig(data || null)
  }

  // Torneos en juego primero (los más visitados hoy, de primero), y los ya
  // finalizados de últimos en la fila — así se ven todos pero el orden
  // premia lo que la gente está consultando en el momento.
  const torneosOrdenados = useMemo(() => {
    const enJuego = torneos.filter(t => !t.finalizado)
      .sort((a, b) => (visitasHoy[b.id] || 0) - (visitasHoy[a.id] || 0) || b.equipos - a.equipos)
    const finalizados = torneos.filter(t => t.finalizado)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    return [...enJuego, ...finalizados]
  }, [torneos, visitasHoy])

  function scrollA(ref) { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: 'system-ui,sans-serif', color: S.text }}>
      <style>{`
        .gm-scrollx::-webkit-scrollbar { display: none }
        .gm-scrollx { scrollbar-width: none; -ms-overflow-style: none }
        .gm-scrollx:active { cursor: grabbing }
        .gm-carousel-flecha:hover { filter: brightness(1.25) }
        @media (pointer: coarse) { .gm-carousel-flecha { display: none !important } }
        .gm-hover:hover { filter: brightness(1.08) }
        @keyframes gm-fadein { from { opacity: 0 } to { opacity: 1 } }
        .gm-fade { animation: gm-fadein 1s ease }
      `}</style>

      {/* ── Header: fondo claro, como el mockup ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#ffffff', borderBottom: '1px solid #eaeaea' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <img src="/marca/watermark-logo.png" alt="Golmebol" style={{ height: '30px' }}/>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: '.01em', color: '#111', lineHeight: 1.1 }}>GOLMEBOL</div>
              <div style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.08em', color: '#9a9a9a' }}>TORNEOS DE FÚTBOL</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="gm-hover" onClick={() => navigate('/jugador/login')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: S.green, color: '#0a1a00', fontSize: '.85rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <ArrowRight size={15}/> INGRESAR
            </button>
            <button className="gm-hover" onClick={() => navigate('/login')} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #111', background: '#fff', color: '#111', fontSize: '.8rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ADMIN
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero: oscuro con acento verde ── */}
      <div style={{ position: 'relative', padding: '64px 16px 90px', textAlign: 'center', overflow: 'hidden', background: `radial-gradient(circle at 50% -10%, ${S.bg2}, ${S.bg} 65%)` }}>
        <div style={{ position: 'absolute', top: '-140px', right: '-100px', width: '420px', height: '420px', borderRadius: '50%', border: `1px solid ${S.border}`, opacity: .5 }}/>
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '280px', height: '280px', borderRadius: '50%', border: `1px solid ${S.border}`, opacity: .5 }}/>
        <div style={{ position: 'relative', maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '999px', border: `1px solid ${S.border}`, color: S.green, fontSize: '.68rem', fontWeight: 800, letterSpacing: '.06em', marginBottom: '20px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: S.green, display: 'inline-block' }}/> LIGA AMATEUR · ARMENIA, QUINDÍO
          </div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5.5vw, 2.7rem)', fontWeight: 900, lineHeight: 1.12, margin: '0 0 16px', letterSpacing: '-.01em' }}>
            Todos los torneos en<br/>un <span style={{ color: S.green }}>solo lugar</span>
          </h1>
          <p style={{ color: S.text2, fontSize: '.95rem', margin: '0 0 30px', lineHeight: 1.6 }}>
            Torneos en vivo, tablas de posiciones, récords, escenarios deportivos y escuelas de fútbol — todo en Golmebol.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="gm-hover" onClick={() => scrollA(torneosRef)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '13px 26px', borderRadius: '10px', border: 'none', background: S.green, color: '#0a1a00', fontSize: '.88rem', fontWeight: 900, cursor: 'pointer' }}>
              VER TORNEOS <ArrowRight size={16}/>
            </button>
            <button className="gm-hover" onClick={() => scrollA(vivoRef)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '13px 26px', borderRadius: '10px', border: `1px solid ${S.border}`, background: 'transparent', color: S.text, fontSize: '.88rem', fontWeight: 800, cursor: 'pointer' }}>
              <Radio size={15} color={S.red}/> VER EN VIVO
            </button>
          </div>
        </div>
      </div>

      {/* ── Barra de stats (flotando sobre el hero, como el mockup) ── */}
      <div style={{ maxWidth: '1120px', margin: '-42px auto 0', padding: '0 16px', position: 'relative', zIndex: 2 }}>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '18px', padding: '22px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,.4)' }}>
          {[
            { label: 'Torneos', val: stats.torneos, icon: Trophy },
            { label: 'Equipos', val: stats.equipos, icon: Users },
            { label: 'Jugadores', val: stats.jugadores, icon: Users },
            { label: 'Goles', val: stats.goles, icon: Target },
          ].map((s, i) => (
            <div key={i}>
              <s.icon size={18} color={S.green} style={{ marginBottom: '6px' }}/>
              <div style={{ fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', fontWeight: 900 }}>{s.val.toLocaleString('es-CO')}</div>
              <div style={{ fontSize: '.6rem', color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── En vivo (YouTube/Facebook/Instagram) — configurable desde /admin/config-sitio, puede haber varias a la vez ── */}
      {streamsVivos.length > 0 && (
        <div style={{ maxWidth: '860px', margin: '44px auto 0', padding: '0 16px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 900, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: S.red }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: S.red, display: 'inline-block' }}/> EN VIVO
            </span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {streamsVivos.map(s => {
              const partidoDeStream = partidoActivoDeStream(s, partidosVivo)
              const controlStream = siteConfig?.en_vivo_control?.[s.id]
              const patrocinadorIdMostrando = patrocinadoresMostrando[s.id]
              const sponsorMostrando = patrocinadorIdMostrando ? patrocinadores.find(p => p.id === patrocinadorIdMostrando) : null
              return (
                <div key={s.id}>
                  {s.titulo && <div style={{ color: S.text2, fontWeight: 700, fontSize: '.85rem', marginBottom: '8px' }}>{s.titulo}</div>}
                  <LiveEmbed url={s.url} titulo={s.titulo} S={S}
                    overlay={(
                      <>
                        {partidoDeStream && <MarcadorEnVivoOverlay partido={partidoDeStream}/>}
                        {sponsorMostrando ? <PatrocinadorEnVivoOverlay patrocinador={sponsorMostrando}/> : (
                          <>
                            {controlStream?.overlay === 'goles' && partidoDeStream && <GolesEnVivoOverlay partido={partidoDeStream}/>}
                            {controlStream?.overlay === 'tabla' && <TablaEnVivoOverlay filas={tablasEnVivo[controlStream.overlay_tournament_id]}/>}
                            {controlStream?.overlay === 'jugadores' && partidoDeStream && <JugadoresEnVivoOverlay partido={partidoDeStream}/>}
                          </>
                        )}
                        {/* Logos de patrocinador del torneo, ubicados y
                            publicados a mano desde /admin/config-sitio — ver
                            PatrocinadoresTorneoOverlay. Independiente de la
                            publicidad rápida de arriba: pueden estar los dos
                            a la vez. */}
                        {partidoDeStream?.tournament_id && (
                          <PatrocinadoresTorneoOverlay logos={siteConfig?.patrocinador_logos_torneo?.[partidoDeStream.tournament_id]} activos={controlStream?.logos_activos}/>
                        )}
                      </>
                    )}
                    repeticion={repeticiones[s.id]}/>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Torneos en juego (carrusel horizontal) ── */}
      <div ref={torneosRef} style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 16px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} color={S.green}/> Torneos en juego
          </h2>
        </div>
        {torneosOrdenados.length === 0 ? (
          <div style={{ margin: '0 16px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '24px', textAlign: 'center', color: S.muted, fontSize: '.85rem' }}>
            No hay torneos activos en este momento.
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <button
              className="gm-carousel-flecha"
              onClick={() => moverCarrusel(-1)}
              aria-label="Ver torneos anteriores"
              style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: '38px', height: '38px', borderRadius: '50%', border: `1px solid ${S.border}`, background: 'rgba(22,22,22,.88)', color: S.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronLeft size={20}/>
            </button>
            <button
              className="gm-carousel-flecha"
              onClick={() => moverCarrusel(1)}
              aria-label="Ver más torneos"
              style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: '38px', height: '38px', borderRadius: '50%', border: `1px solid ${S.border}`, background: 'rgba(22,22,22,.88)', color: S.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronRight size={20}/>
            </button>
            <div
              ref={scrollerRef}
              className="gm-scrollx"
              onMouseDown={iniciarArrastre}
              onMouseMove={moverArrastre}
              onMouseUp={terminarArrastre}
              onMouseLeave={terminarArrastre}
              style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 16px 8px', scrollSnapType: 'x proximity', cursor: 'grab' }}
            >
            {torneosOrdenados.map(t => {
              const enVivo = partidosVivo.some(m => m.tournament_id === t.id)
              const inicio = fmtFecha(t.created_at)
              const badge = t.finalizado ? { txt: 'FINALIZADO', bg: 'rgba(138,138,138,.18)', color: S.muted }
                : enVivo ? { txt: '● EN VIVO', bg: 'rgba(229,67,61,.15)', color: S.red }
                : { txt: 'EN JUEGO', bg: 'rgba(111,207,61,.15)', color: S.green }
              return (
                <button key={t.id} className="gm-hover" onClick={() => { if (arrastreRef.current.movido) return; navigate('/t/' + t.id) }} style={{ scrollSnapAlign: 'start', flex: '0 0 240px', width: '240px', minHeight: '292px', display: 'flex', flexDirection: 'column', textAlign: 'left', background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '16px', cursor: 'pointer', color: S.text, opacity: t.finalizado ? .8 : 1 }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ display: 'inline-block', fontSize: '.62rem', fontWeight: 900, padding: '4px 10px', borderRadius: '999px', background: badge.bg, color: badge.color }}>
                      {badge.txt}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    <Escudo logo_url={t.logo_url} name={t.name} size={56} radius={14}/>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: tamNombreTorneo(t.name), textAlign: 'center', marginBottom: '10px', lineHeight: 1.25, wordBreak: 'break-word' }}>{t.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '.72rem', color: S.muted, marginBottom: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={12}/> {t.equipos} equipos</span>
                    {inicio && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={12}/> Inició: {inicio}</span>}
                    {!t.finalizado && <span style={{ color: S.green, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.estado}</span>}
                  </div>
                  {t.finalizado && t.campeon ? (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '.6rem', fontWeight: 900, color: S.gold, letterSpacing: '.08em' }}>🏆 CAMPEÓN</span>
                      <Escudo logo_url={t.campeon.logo_url} name={t.campeon.name} size={46} radius={12}/>
                      <span style={{ fontSize: tamNombreTorneo(t.campeon.name), fontWeight: 800, color: S.text, textAlign: 'center', maxWidth: '100%', lineHeight: 1.25, wordBreak: 'break-word', padding: '0 4px' }}>{t.campeon.name}</span>
                    </div>
                  ) : !t.finalizado && t.campeonVigente?.team ? (
                    // Esta edición todavía no tiene su propio campeón (recién
                    // empieza) — se muestra el de la edición anterior ya
                    // finalizada, para que la tarjeta no se vea vacía.
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '.6rem', fontWeight: 900, color: S.gold, letterSpacing: '.08em' }}>🏆 CAMPEÓN VIGENTE</span>
                      <Escudo logo_url={t.campeonVigente.team.logo_url} name={t.campeonVigente.team.name} size={46} radius={12}/>
                      <span style={{ fontSize: tamNombreTorneo(t.campeonVigente.team.name), fontWeight: 800, color: S.text, textAlign: 'center', maxWidth: '100%', lineHeight: 1.25, wordBreak: 'break-word', padding: '0 4px' }}>{t.campeonVigente.team.name}</span>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0 }}/>
                  )}
                  <div style={{ width: '100%', textAlign: 'center', padding: '9px', borderRadius: '9px', background: S.card2, color: t.finalizado ? S.muted : S.green, fontSize: '.75rem', fontWeight: 800 }}>VER TORNEO</div>
                </button>
              )
            })}
            </div>
          </div>
        )}
      </div>

      {/* ── Partidos en vivo ── */}
      <div ref={vivoRef} style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 16px 8px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 900, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={17} color={S.red}/> Partidos en vivo
        </h2>
        {partidosVivo.length === 0 ? (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '24px', textAlign: 'center', color: S.muted, fontSize: '.85rem' }}>
            No hay partidos en vivo en este momento.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
            {partidosVivo.map(m => (
              <div key={m.id} style={{ background: S.card, border: `1px solid ${S.red}55`, borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '.65rem', fontWeight: 900, padding: '4px 9px', borderRadius: '999px', background: 'rgba(229,67,61,.15)', color: S.red, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: S.red, display: 'inline-block' }}/> EN VIVO
                  </span>
                  <span style={{ fontSize: '.68rem', color: S.muted, fontWeight: 700 }}>{labelPartido(m)}</span>
                </div>
                {m.tournaments?.name && (
                  <div style={{ fontSize: '.66rem', color: S.green, fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Trophy size={11}/> {m.tournaments.name}
                  </div>
                )}
                <div onClick={() => setDetalleVivoId(m.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <Escudo logo_url={m.home?.logo_url} name={m.home?.name} size={34}/>
                    <span style={{ fontSize: '.68rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{m.home?.name}</span>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
                    <div style={{ fontSize: '.6rem', color: S.red, fontWeight: 800, marginTop: '2px' }}>{m.vivo.descanso ? 'DESCANSO' : m.vivo.reloj}</div>
                    {m.global && <div style={{ fontSize: '.6rem', color: S.gold, fontWeight: 800, marginTop: '2px' }}>Global {m.global.local}-{m.global.visitante}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <Escudo logo_url={m.away?.logo_url} name={m.away?.name} size={34}/>
                    <span style={{ fontSize: '.68rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{m.away?.name}</span>
                  </div>
                </div>
                <div onClick={() => setDetalleVivoId(m.id)} style={{ cursor: 'pointer', textAlign: 'center', color: S.muted, fontSize: '.62rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  Toca para ver quién anotó <GiSoccerBall size={10}/>
                </div>
                <button className="gm-hover" onClick={() => navigate('/t/' + m.tournament_id)} style={{ width: '100%', padding: '9px', borderRadius: '9px', border: `1px solid ${S.red}`, background: 'transparent', color: S.red, fontSize: '.75rem', fontWeight: 800, cursor: 'pointer' }}>
                  VER TORNEO
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Escenarios / Escuelas ── */}
      {(escenarios.length > 0 || escuelas.length > 0) && (
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 16px 8px', display: 'grid', gridTemplateColumns: escenarios.length > 0 && escuelas.length > 0 ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: '16px' }}>
          {escenarios.length > 0 && (() => {
            const fotos = escenarios.filter(e => e.imagen_fondo_url)
            const actual = fotos.length > 0 ? fotos[escenarioIdx % fotos.length] : null
            return (
              <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', border: `1px solid ${S.border}`, minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '20px' }}>
                <div key={actual?.id || 'sin-foto'} className="gm-fade"
                  style={{ position: 'absolute', inset: 0, zIndex: 0,
                    backgroundImage: actual ? `linear-gradient(180deg, rgba(10,10,10,.2), rgba(10,10,10,.92)), url(${actual.imagen_fondo_url})` : `linear-gradient(160deg, ${S.card}, ${S.bg2})`,
                    backgroundSize: 'cover', backgroundPosition: 'center' }}/>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <Building2 size={20} color={S.green} style={{ marginBottom: '8px' }}/>
                  <div style={{ fontWeight: 900, fontSize: '1.02rem', marginBottom: '4px' }}>Escenarios{actual?.name ? ` · ${actual.name}` : ''}</div>
                  <div style={{ fontSize: '.78rem', color: S.text2, marginBottom: '14px' }}>Los mejores escenarios deportivos para que vivas tu pasión.</div>
                  <button className="gm-hover" onClick={() => navigate('/escenarios')} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: S.green, fontSize: '.8rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}>
                    VER ESCENARIOS <ArrowRight size={14}/>
                  </button>
                  {fotos.length > 1 && (
                    <div style={{ display: 'flex', gap: '5px', marginTop: '12px' }}>
                      {fotos.map((f, i) => (
                        <span key={f.id} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === escenarioIdx % fotos.length ? S.green : 'rgba(255,255,255,.35)' }}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
          {escuelas.length > 0 && (
            <div style={{ borderRadius: '18px', border: `1px solid ${S.border}`, background: S.card, padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <GraduationCap size={20} color={S.green} style={{ marginBottom: '8px' }}/>
              <div style={{ fontWeight: 900, fontSize: '1.02rem', marginBottom: '4px' }}>Escuelas de fútbol</div>
              <div style={{ fontSize: '.78rem', color: S.text2, marginBottom: '14px' }}>Formamos talentos, construimos sueños.</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {escuelas.slice(0, 5).map(e => <Escudo key={e.id} logo_url={e.logo_url} name={e.name} size={34} radius={9}/>)}
              </div>
              <button className="gm-hover" onClick={() => navigate('/jugador/login')} style={{ alignSelf: 'flex-start', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: S.green, fontSize: '.8rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}>
                VER ESCUELAS <ArrowRight size={14}/>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Patrocinadores oficiales ── */}
      {patrocinadores.length > 0 && (() => {
        const actual = patrocinadores[patroIdx % patrocinadores.length]
        return (
          <div style={{ maxWidth: '780px', margin: '48px auto 0', padding: '0 16px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, margin: '0 0 14px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
              <Megaphone size={17} color={S.green}/> Patrocinadores oficiales Golmebol
            </h2>
            <div onClick={() => setPatroDetalle(actual)} className="gm-hover"
              style={{ cursor: 'pointer', background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '110px' }}>
              <div key={actual.id} className="gm-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {actual.logo_url ? <img src={actual.logo_url} alt={actual.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}/> : <Megaphone size={22} color="#1a3a8a"/>}
                </div>
                <div style={{ fontWeight: 800, fontSize: '.85rem' }}>{actual.nombre}</div>
                <div style={{ fontSize: '.68rem', color: S.muted }}>Toca para ver más</div>
              </div>
            </div>
            {patrocinadores.length > 1 && (
              <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '10px' }}>
                {patrocinadores.map((pp, i) => (
                  <span key={pp.id} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === patroIdx % patrocinadores.length ? S.green : S.border }}/>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${S.border}`, marginTop: '54px', padding: '28px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginBottom: '6px' }}>
          <img src="/marca/watermark-logo.png" alt="Golmebol" style={{ height: '20px' }}/>
          <span style={{ fontWeight: 900, fontSize: '.9rem' }}>GOLMEBOL</span>
        </div>
        <div style={{ fontSize: '.68rem', color: S.muted, marginBottom: '14px' }}>© {new Date().getFullYear()} Golmebol · Armenia, Quindío · Todos los derechos reservados</div>
        <div style={{ display: 'flex', gap: '18px', justifyContent: 'center', fontSize: '.75rem' }}>
          <button onClick={() => navigate('/jugador/login')} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}>Ingresar</button>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer' }}>Administrador</button>
        </div>
      </div>

      {detalleVivoId && partidosVivo.some(p => p.id === detalleVivoId) && (
        <LiveMatchDetalle m={partidosVivo.find(p => p.id === detalleVivoId)} onClose={() => setDetalleVivoId(null)}/>
      )}

      {patroDetalle && (
        <PatrocinadorDetalleModal p={patroDetalle} onClose={() => setPatroDetalle(null)}/>
      )}
    </div>
  )
}
