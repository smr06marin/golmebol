import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Globe, Trophy, MapPin, Calendar, ChevronRight, CalendarCheck, Handshake, Users, ShieldCheck, Mail, Phone, ArrowRight, Tag, Radio, X } from 'lucide-react'
import { FaWhatsapp, FaFacebookF, FaInstagram, FaTiktok } from 'react-icons/fa'
import { GiSoccerBall } from 'react-icons/gi'
import { PantallaCargando } from '../components/PantallaCargando'
import { derivarEnVivo, extraerGoles, extraerTarjetas } from '../lib/liveMatch'

// Escudo del equipo (logo o iniciales) — versión chica para las tarjetas de
// "en vivo" de la vitrina.
function EscudoChico({ logo_url, name, size = 34 }) {
  const iniciales = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: logo_url ? '#fff' : 'linear-gradient(135deg,#1a73e8,#6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eef0f3' }}>
      {logo_url ? <img src={logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <span style={{ fontSize: size * 0.32, fontWeight: '800', color: '#fff' }}>{iniciales}</span>}
    </div>
  )
}

// Etiqueta corta del momento del partido en vivo: "1T · 12:34" o "DESCANSO"
function labelTiempoVivoVit(vivo) {
  if (vivo.descanso) return 'DESCANSO'
  const per = vivo.periodo === 2 ? '2T' : '1T'
  return `${per} · ${vivo.reloj}`
}

const COLOR_TARJETA_VIT = { amarilla: '#f9c400', azul: '#1a73e8', roja: '#d93025' }

// Une goles y tarjetas de un partido en vivo en una sola línea de tiempo,
// ordenada minuto a minuto — mismo criterio que golmebol.com.
function eventosDelPartidoVivoVit(m) {
  const goles    = extraerGoles(m).map(g => ({ ...g, tipoEvento: 'gol' }))
  const tarjetas = extraerTarjetas(m).map(t => ({ ...t, tipoEvento: 'tarjeta' }))
  return [...goles, ...tarjetas].sort((a, b) => (a.periodo - b.periodo) || ((parseInt(a.minuto) || 0) - (parseInt(b.minuto) || 0)))
}

// Detalle de un partido EN VIVO (marcador + reloj + minuto a minuto) — mismo
// modal que se ve en golmebol.com, adaptado a la vitrina del organizador.
function LiveMatchDetalleVit({ m, onClose }) {
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  const eventos = eventosDelPartidoVivoVit(m)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '540px', maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontWeight: 900, color: m.vivo.descanso ? '#e8710a' : '#d93025', fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14}/> {m.vivo.descanso ? 'DESCANSO' : `EN VIVO · ${labelTiempoVivoVit(m.vivo)}`}
          </span>
          <button onClick={onClose} style={{ background: '#f1f3f4', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16}/></button>
        </div>

        {m.tournaments?.name && (
          <div style={{ textAlign: 'center', marginBottom: '8px', color: '#1e8e3e', fontSize: '.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Trophy size={11}/> {m.tournaments.name}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '22px', margin: '10px 0 20px' }}>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', overflow: 'hidden', margin: '0 auto' }}><EscudoChico logo_url={m.home?.logo_url} name={m.home?.name} size={52}/></div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.8rem', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home?.name}</div>
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#202124' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', overflow: 'hidden', margin: '0 auto' }}><EscudoChico logo_url={m.away?.logo_url} name={m.away?.name} size={52}/></div>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.8rem', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away?.name}</div>
          </div>
        </div>

        <div style={{ background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '.62rem', fontWeight: 800, color: '#9aa0a6', letterSpacing: '.08em', marginBottom: '10px', textAlign: 'center' }}>MINUTO A MINUTO</div>
          {eventos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.8rem', padding: '18px 0' }}>Aún no hay goles ni tarjetas</div>
          ) : (
            eventos.map((ev, i) => {
              const esLocal = ev.equipo === 'local'
              const icono = ev.tipoEvento === 'gol' ? <GiSoccerBall size={13} color="#202124"/> : <span style={{ display: 'inline-block', width: '9px', height: '13px', borderRadius: '2px', background: COLOR_TARJETA_VIT[ev.color] || '#999', flexShrink: 0 }}/>
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', alignItems: 'center', gap: '6px', padding: '8px 0', borderTop: i > 0 ? '1px solid #e8eaed' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', textAlign: 'right', minWidth: 0 }}>
                    {esLocal && <>
                      <span style={{ fontWeight: 700, fontSize: '.8rem', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.jugador}</span>
                      <span style={{ flexShrink: 0, display: 'flex' }}>{icono}</span>
                    </>}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '999px', padding: '3px 8px', fontSize: '.64rem', fontWeight: 800, color: '#5f6368', whiteSpace: 'nowrap' }}>{ev.minuto ? `${ev.minuto}'` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    {!esLocal && <>
                      <span style={{ flexShrink: 0, display: 'flex' }}>{icono}</span>
                      <span style={{ fontWeight: 700, fontSize: '.8rem', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.jugador}</span>
                    </>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const IMG_HERO   = 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1600&q=70'
const IMG_CANCHA = 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=900&q=60'

// CSS con media queries reales (no se puede hacer con style={{}} inline) —
// es lo que faltaba antes: la barra de navegación y las dos grillas de dos
// columnas (hero y CTA) no se achicaban en celular, entonces la página
// entera se renderizaba más ancha que la pantalla y el navegador la
// mostraba reducida con espacio en blanco alrededor. Acá se apilan a una
// columna y se oculta el menú de texto por debajo de 720px.
const CSS_RESPONSIVO = `
  .gm-vit-navlinks { display: flex; }
  .gm-vit-card { transition: transform .15s ease, box-shadow .15s ease; }
  .gm-vit-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,.1); }
  @media (max-width: 720px) {
    .gm-vit-navlinks { display: none; }
    .gm-vit-hero-grid { grid-template-columns: 1fr !important; }
    .gm-vit-hero-side { margin-top: 22px; }
    .gm-vit-cta-grid { grid-template-columns: 1fr !important; }
    .gm-vit-cta-image { display: none; }
    .gm-vit-title { font-size: 2rem !important; }
  }
`

function formatearFecha(iso) {
  if (!iso) return null
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

// Vitrina pública de un organizador: junta TODOS sus torneos (tournaments
// donde organizador_id = este organizador) en una sola página de tipo
// landing, servida desde su dominio propio (organizador_perfiles.custom_domain)
// — pero el contenido en sí sigue viviendo 100% en Golmebol. Cada torneo de
// la lista lleva al mismo detalle público de siempre (TorneoPublicoPage),
// montado como ruta hermana dentro del mismo dominio (ver
// DominioPersonalizadoGate), igual que /reservar y /pedir si hay un
// escenario vinculado.
export default function OrganizadorVitrinaPage({ organizadorId } = {}) {
  const params = useParams()
  const id = organizadorId || params.organizadorId

  const [perfil, setPerfil] = useState(null)
  const [torneos, setTorneos] = useState([])
  const [equiposPorTorneo, setEquiposPorTorneo] = useState({})
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(true)

  // Partidos en vivo de CUALQUIERA de los torneos de este organizador —
  // antes esto solo salía en golmebol.com; ahora también sale directo en la
  // página principal del dominio propio (ej. centegol.com), sin tener que
  // entrar a un torneo puntual.
  const [matchesVivoRaw, setMatchesVivoRaw] = useState([])
  const [tick, setTick] = useState(0)
  const [detalleVivoId, setDetalleVivoId] = useState(null)

  useEffect(() => { if (id) fetchTodo() }, [id])

  useEffect(() => {
    if (torneos.length) fetchPartidosVivo()
    const tRefetch = setInterval(fetchPartidosVivo, 20000)
    return () => clearInterval(tRefetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneos])

  useEffect(() => {
    const tRelog = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(tRelog)
  }, [])

  async function fetchPartidosVivo() {
    if (!torneos.length) { setMatchesVivoRaw([]); return }
    const { data } = await supabase.from('matches')
      .select('id, tournament_id, matchday, fase, status, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name)')
      .in('tournament_id', torneos.map(t => t.id))
      .eq('status', 'scheduled')
      .or('live_state.not.is.null,live_state_rapida.not.is.null')
    setMatchesVivoRaw(data || [])
  }

  const partidosVivo = useMemo(() => {
    void tick
    return matchesVivoRaw.map(m => ({ ...m, vivo: derivarEnVivo(m) })).filter(m => m.vivo)
  }, [matchesVivoRaw, tick])

  async function fetchTodo() {
    setLoading(true)
    const [{ data: p }, { data: ts }, { data: sp }] = await Promise.all([
      supabase.from('organizador_perfiles').select('*').eq('organizador_id', id).maybeSingle(),
      supabase.from('tournaments').select('id, name, logo_url, modalidad, genero, categoria, city, season, fecha_inicio').eq('organizador_id', id).order('created_at', { ascending: false }),
      supabase.from('organizador_sponsors').select('*').eq('organizador_id', id).order('orden', { ascending: true }),
    ])
    setPerfil(p)
    setTorneos(ts || [])
    setSponsors(sp || [])

    // Conteo de equipos inscritos por torneo (para el detalle de cada
    // tarjeta) — una sola consulta extra en vez de una por torneo.
    if (ts?.length) {
      const { data: tt } = await supabase.from('tournament_teams').select('tournament_id').in('tournament_id', ts.map(t => t.id))
      const conteo = {}
      for (const row of (tt || [])) conteo[row.tournament_id] = (conteo[row.tournament_id] || 0) + 1
      setEquiposPorTorneo(conteo)
    }

    setLoading(false)
  }

  // Favicon dinámico del organizador (mismo patrón que TorneoPublicoPage)
  useEffect(() => {
    if (!perfil?.favicon_url) return
    const links = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
    if (links.length === 0) {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = perfil.favicon_url
      document.head.appendChild(link)
      return
    }
    links.forEach(link => { link.href = perfil.favicon_url })
  }, [perfil?.favicon_url])

  // Pantalla de carga con el logo de Golmebol — la misma que usa el resto
  // de la app, así el visitante ve la marca mientras carga y después entra
  // a la vitrina propia del organizador.
  if (loading) return <PantallaCargando/>

  const colorPrimario   = perfil?.color_primario   || '#22c55e'
  const colorSecundario = perfil?.color_secundario || '#0f172a'
  const nombre = perfil?.nombre_publico || 'Torneos'
  const hayContacto = perfil?.whatsapp || perfil?.email || perfil?.direccion
  const hayRedes = perfil?.facebook_url || perfil?.instagram_url || perfil?.tiktok_url
  const waHref = perfil?.whatsapp ? `https://wa.me/${perfil.whatsapp.replace(/\D/g, '')}` : null
  const hayEscenario = !!perfil?.escenario_id

  const s = {
    page: { minHeight: '100vh', maxWidth: '100vw', overflowX: 'hidden', background: '#fff', fontFamily: 'system-ui, sans-serif', color: '#0f172a', ['--color-primario']: colorPrimario, ['--color-secundario']: colorSecundario },
    section: { maxWidth: '1100px', margin: '0 auto', padding: '48px 20px' },
    pill: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '.82rem', textDecoration: 'none', whiteSpace: 'nowrap' },
    card: { background: '#fff', border: '1px solid #eef0f3', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
    eyebrow: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '22px' },
    eyebrowText: { fontWeight: '800', fontSize: '.92rem', letterSpacing: '.06em', color: '#5f6368' },
  }

  return (
    <div style={s.page}>
      <style>{CSS_RESPONSIVO}</style>

      {/* NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #eef0f3' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f1f3f4', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {perfil?.logo_url ? <img src={perfil.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Globe size={18} color={colorPrimario}/>}
            </div>
            <div style={{ fontWeight: '800', fontSize: '.92rem', lineHeight: 1.15, letterSpacing: '.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
          </div>
          <div className="gm-vit-navlinks" style={{ flex: 1, justifyContent: 'center', gap: '26px', fontSize: '.76rem', fontWeight: '700', color: '#5f6368', letterSpacing: '.02em' }}>
            <a href="#inicio" style={{ color: colorPrimario, textDecoration: 'none' }}>INICIO</a>
            <a href="#torneos" style={{ color: 'inherit', textDecoration: 'none' }}>TORNEOS</a>
            {hayContacto && <a href="#contacto" style={{ color: 'inherit', textDecoration: 'none' }}>CONTACTO</a>}
          </div>
          {hayEscenario && (
            <Link to={`/reservar/${perfil.escenario_id}`} style={{ ...s.pill, padding: '9px 16px', background: colorPrimario, color: '#fff', flexShrink: 0 }}>
              <CalendarCheck size={14}/> Reservar cancha
            </Link>
          )}
        </div>
      </div>

      {/* HERO */}
      <div id="inicio" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', overflow: 'hidden', backgroundImage: `linear-gradient(105deg, ${colorSecundario}f2 20%, ${colorSecundario}b3 55%, ${colorSecundario}66 100%), url(${IMG_HERO})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="gm-vit-hero-grid" style={{ maxWidth: '1100px', margin: '0 auto', padding: '64px 20px 90px', position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', gap: '36px', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: colorPrimario, fontWeight: '700', fontSize: '.82rem', letterSpacing: '.08em', marginBottom: '10px' }}>BIENVENIDO A</div>
              <h1 className="gm-vit-title" style={{ margin: 0, fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: '800', color: '#fff', lineHeight: 1.1, letterSpacing: '-.01em', wordBreak: 'break-word' }}>{nombre.toUpperCase()}</h1>
              <div style={{ width: '46px', height: '3px', background: colorPrimario, borderRadius: '2px', margin: '18px 0' }}/>
              {perfil?.descripcion && <p style={{ color: '#dbe1e8', fontSize: '.98rem', lineHeight: 1.65, maxWidth: '460px', fontWeight: '400' }}>{perfil.descripcion}</p>}
            </div>

            <div className="gm-vit-hero-side">
              {hayEscenario ? (
                <Link to={`/reservar/${perfil.escenario_id}`} style={{ display: 'block', textDecoration: 'none', borderRadius: '18px', overflow: 'hidden', background: `linear-gradient(155deg, ${colorPrimario}, ${colorPrimario}cc)`, boxShadow: '0 16px 40px rgba(0,0,0,.28)' }}>
                  <div style={{ padding: '30px 26px', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      {perfil?.logo_url ? <img src={perfil.logo_url} style={{ width: '38px', height: '38px', objectFit: 'contain' }}/> : <CalendarCheck size={30} color="#fff"/>}
                    </div>
                    <div style={{ color: '#fff', fontWeight: '800', fontSize: '1.5rem', letterSpacing: '-.01em', lineHeight: 1.15 }}>RESERVAR<br/>CANCHA</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'rgba(255,255,255,.92)', fontSize: '.82rem', fontWeight: '600', marginTop: '14px' }}>
                      Haz tu reserva en segundos <ArrowRight size={15}/>
                    </div>
                  </div>
                </Link>
              ) : (
                <div style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: '18px', padding: '30px 24px', textAlign: 'center' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${colorPrimario}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Handshake size={24} color={colorPrimario}/>
                  </div>
                  <div style={{ color: colorPrimario, fontWeight: '800', fontSize: '1.1rem', letterSpacing: '.01em' }}>TU MARCA AQUÍ</div>
                  <div style={{ color: '#dbe1e8', fontSize: '.82rem', fontWeight: '500', marginTop: '4px' }}>Apoya el deporte local</div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* EN VIVO — partido(s) de cualquiera de los torneos de este organizador
          que se están jugando ahora mismo, visible directo en la página
          principal sin tener que entrar a ningún torneo. */}
      {partidosVivo.length > 0 && (
        <div style={{ ...s.section, paddingTop: '36px', paddingBottom: '0' }}>
          <div style={s.eyebrow}>
            <Radio size={19} color="#d93025"/>
            <span style={{ ...s.eyebrowText, color: '#d93025' }}>EN VIVO AHORA</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {partidosVivo.map(m => (
              <div key={m.id} style={{ ...s.card, border: '1px solid #f8b4b0', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '.64rem', fontWeight: '900', padding: '4px 9px', borderRadius: '999px', background: '#fce8e6', color: '#d93025', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d93025', display: 'inline-block' }}/> EN VIVO
                  </span>
                  {m.tournaments?.name && <span style={{ fontSize: '.66rem', color: '#5f6368', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.tournaments.name}</span>}
                </div>
                <div onClick={() => setDetalleVivoId(m.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <EscudoChico logo_url={m.home?.logo_url} name={m.home?.name}/>
                    <span style={{ fontSize: '.66rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{m.home?.name}</span>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontWeight: '900', fontSize: '1.25rem', color: '#0f172a' }}>{m.vivo.golesLocal} - {m.vivo.golesVis}</div>
                    <div style={{ fontSize: '.6rem', color: '#d93025', fontWeight: '800', marginTop: '2px' }}>{m.vivo.descanso ? 'DESCANSO' : m.vivo.reloj}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <EscudoChico logo_url={m.away?.logo_url} name={m.away?.name}/>
                    <span style={{ fontSize: '.66rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{m.away?.name}</span>
                  </div>
                </div>
                <div onClick={() => setDetalleVivoId(m.id)} style={{ cursor: 'pointer', textAlign: 'center', color: '#9aa0a6', fontSize: '.62rem', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  Toca para ver quién anotó <GiSoccerBall size={10}/>
                </div>
                <Link to={`/t/${m.tournament_id}`} className="gm-hover" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '9px', borderRadius: '9px', border: '1px solid #d93025', background: 'transparent', color: '#d93025', fontSize: '.75rem', fontWeight: '800', textDecoration: 'none', boxSizing: 'border-box' }}>
                  VER TORNEO
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {detalleVivoId && partidosVivo.some(p => p.id === detalleVivoId) && (
        <LiveMatchDetalleVit m={partidosVivo.find(p => p.id === detalleVivoId)} onClose={() => setDetalleVivoId(null)}/>
      )}

      {/* TORNEOS */}
      <div id="torneos" style={{ ...s.section, paddingTop: '64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={s.eyebrow}>
            <Trophy size={19} color={colorPrimario}/>
            <span style={s.eyebrowText}>TORNEOS {torneos.length > 0 ? 'ACTIVOS' : ''}</span>
          </div>
        </div>

        {torneos.length === 0 ? (
          <div style={{ ...s.card, padding: '48px 20px', textAlign: 'center', color: '#9aa0a6' }}>
            <Trophy size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
            <div>Todavía no hay torneos publicados acá</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '18px' }}>
            {torneos.map(t => (
              <Link key={t.id} to={`/t/${t.id}`} className="gm-vit-card" style={{ ...s.card, display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ height: '96px', background: `linear-gradient(135deg, ${colorSecundario}, ${colorPrimario})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '56px', height: '56px', objectFit: 'contain' }}/> : <Trophy size={30} color="#fff"/>}
                </div>
                <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ alignSelf: 'flex-start', fontSize: '.62rem', fontWeight: '800', color: colorPrimario, background: `${colorPrimario}16`, borderRadius: '999px', padding: '3px 10px', marginBottom: '10px', letterSpacing: '.04em' }}>TORNEO ACTIVO</span>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '.95rem', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap', fontSize: '.7rem', color: '#5f6368', marginBottom: '10px' }}>
                    {t.modalidad && <span>⚽ {t.modalidad}</span>}
                    {t.city && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={11}/>{t.city}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '.72rem', color: '#5f6368', paddingTop: '10px', borderTop: '1px solid #f1f3f4', marginBottom: '4px' }}>
                    {equiposPorTorneo[t.id] != null && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={12}/> {equiposPorTorneo[t.id]} equipos inscritos</span>}
                    {t.fecha_inicio && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={12}/> {formatearFecha(t.fecha_inicio)}</span>}
                    {t.categoria && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Tag size={12}/> {t.categoria}</span>}
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: colorPrimario, fontWeight: '700', fontSize: '.78rem', paddingTop: '6px' }}>
                    Ver detalles <ChevronRight size={14}/>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* PATROCINADORES */}
      {sponsors.length > 0 && (
        <div style={{ background: '#f8f9fa' }}>
          <div style={s.section}>
            <div style={s.eyebrow}>
              <ShieldCheck size={19} color={colorPrimario}/>
              <span style={s.eyebrowText}>PATROCINADORES OFICIALES</span>
            </div>
            {/* Todos los logos van en una caja del MISMO tamaño (contain, no
                crop) para que ningún logo — cuadrado, ancho, alto — desarme
                la fila, sin importar la proporción de la imagen que suba
                cada patrocinador. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
              {sponsors.map(sp => {
                const contenido = (
                  <div className="gm-vit-card" style={{ width: '100%', height: '78px', background: '#fff', border: '1px solid #eef0f3', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px' }}>
                    {sp.logo_url ? <img src={sp.logo_url} alt={sp.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/> : <span style={{ fontSize: '.76rem', fontWeight: '700', color: '#5f6368', textAlign: 'center' }}>{sp.nombre}</span>}
                  </div>
                )
                return sp.link
                  ? <a key={sp.id} href={sp.link} target="_blank" rel="noreferrer">{contenido}</a>
                  : <div key={sp.id}>{contenido}</div>
              })}
            </div>
          </div>
        </div>
      )}

      {/* CTA — reserva de cancha si hay escenario vinculado; si no, invitación
          a patrocinar (para organizadores que todavía no tienen cancha). */}
      <div style={s.section}>
        {hayEscenario ? (
          <div className="gm-vit-cta-grid" style={{ borderRadius: '18px', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,260px)', background: colorSecundario }}>
            <div style={{ padding: '34px 30px' }}>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '1.25rem', letterSpacing: '-.005em' }}>¿Ya tienes con quién jugar?</div>
              <div style={{ color: '#cbd5e1', fontSize: '.87rem', marginTop: '7px', marginBottom: '20px' }}>Reserva tu cancha en minutos y asegura tu horario.</div>
              <Link to={`/reservar/${perfil.escenario_id}`} style={{ ...s.pill, background: colorPrimario, color: '#fff' }}>
                <CalendarCheck size={15}/> Reservar cancha
              </Link>
            </div>
            <div className="gm-vit-cta-image" style={{ backgroundImage: `linear-gradient(90deg, ${colorSecundario} 0%, transparent 45%), url(${IMG_CANCHA})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
          </div>
        ) : (
          <div className="gm-vit-cta-grid" style={{ borderRadius: '18px', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,260px)', background: colorSecundario }}>
            <div style={{ padding: '34px 30px' }}>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '1.25rem', letterSpacing: '-.005em' }}>¿Quieres patrocinar nuestros torneos?</div>
              <div style={{ color: '#cbd5e1', fontSize: '.87rem', marginTop: '7px', marginBottom: '20px' }}>Asocia tu marca con el deporte y llega a más personas.</div>
              {waHref ? (
                <a href={`${waHref}?text=${encodeURIComponent(`Hola, quiero patrocinar los torneos de ${nombre}`)}`} target="_blank" rel="noreferrer" style={{ ...s.pill, background: colorPrimario, color: '#fff' }}>
                  <FaWhatsapp size={14}/> Conoce nuestros planes
                </a>
              ) : (
                <span style={{ ...s.pill, background: 'rgba(255,255,255,.12)', color: '#fff' }}>Conoce nuestros planes</span>
              )}
            </div>
            <div className="gm-vit-cta-image" style={{ backgroundImage: `linear-gradient(90deg, ${colorSecundario} 0%, transparent 45%), url(${IMG_CANCHA})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div id="contacto" style={{ background: '#0b1220', color: '#94a3b8', paddingTop: '40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '28px', paddingBottom: '32px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {perfil?.logo_url ? <img src={perfil.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Globe size={17} color={colorPrimario}/>}
              </div>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '.9rem' }}>{nombre}</div>
            </div>
            {perfil?.descripcion && <div style={{ fontSize: '.75rem', lineHeight: 1.6 }}>{perfil.descripcion}</div>}
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '.75rem', letterSpacing: '.03em', marginBottom: '12px' }}>ENLACES RÁPIDOS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '.78rem' }}>
              <a href="#inicio" style={{ color: 'inherit', textDecoration: 'none' }}>Inicio</a>
              <a href="#torneos" style={{ color: 'inherit', textDecoration: 'none' }}>Torneos</a>
              {hayContacto && <a href="#contacto" style={{ color: 'inherit', textDecoration: 'none' }}>Contacto</a>}
            </div>
          </div>

          {hayContacto && (
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '.75rem', letterSpacing: '.03em', marginBottom: '12px' }}>CONTÁCTANOS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '.76rem' }}>
                {perfil.whatsapp && <a href={waHref} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={13} style={{ flexShrink: 0 }}/> {perfil.whatsapp}</a>}
                {perfil.email && <a href={`mailto:${perfil.email}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', overflowWrap: 'anywhere' }}><Mail size={13} style={{ flexShrink: 0 }}/> {perfil.email}</a>}
                {perfil.direccion && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={13} style={{ flexShrink: 0 }}/> {perfil.direccion}</div>}
              </div>
            </div>
          )}

          {hayRedes && (
            <div>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '.75rem', letterSpacing: '.03em', marginBottom: '12px' }}>SÍGUENOS</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {perfil.facebook_url && <a href={perfil.facebook_url} target="_blank" rel="noreferrer" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}><FaFacebookF size={14}/></a>}
                {perfil.instagram_url && <a href={perfil.instagram_url} target="_blank" rel="noreferrer" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}><FaInstagram size={14}/></a>}
                {perfil.tiktok_url && <a href={perfil.tiktok_url} target="_blank" rel="noreferrer" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}><FaTiktok size={13}/></a>}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', padding: '16px 20px', maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '.68rem' }}>
          <span>© {new Date().getFullYear()} {nombre}. Todos los derechos reservados.</span>
          <span>Desarrollado por GOLMEBOL</span>
        </div>
      </div>
    </div>
  )
}
