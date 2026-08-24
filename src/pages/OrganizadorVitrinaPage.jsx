import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Globe, Trophy, MapPin, Calendar, ChevronRight, CalendarCheck, Handshake, Users, ShieldCheck, Mail, Phone } from 'lucide-react'
import { FaWhatsapp, FaFacebookF, FaInstagram, FaTiktok } from 'react-icons/fa'
import { PantallaCargando } from '../components/PantallaCargando'

const IMG_CTA = 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=900&q=60'

// CSS con media queries reales (no se puede hacer con style={{}} inline) —
// es lo que faltaba antes: la barra de navegación y las dos grillas de dos
// columnas (hero y CTA) no se achicaban en celular, entonces la página
// entera se renderizaba más ancha que la pantalla y el navegador la
// mostraba reducida con espacio en blanco alrededor. Acá se apilan a una
// columna y se oculta el menú de texto por debajo de 720px.
const CSS_RESPONSIVO = `
  .gm-vit-navlinks { display: flex; }
  .gm-vit-card { transition: transform .15s ease, box-shadow .15s ease; }
  .gm-vit-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,.1); }
  @media (max-width: 720px) {
    .gm-vit-navlinks { display: none; }
    .gm-vit-hero-grid { grid-template-columns: 1fr !important; }
    .gm-vit-hero-sponsor { margin-top: 8px; }
    .gm-vit-cta-grid { grid-template-columns: 1fr !important; }
    .gm-vit-cta-image { display: none; }
    .gm-vit-title { font-size: 2rem !important; }
  }
`

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
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (id) fetchTodo() }, [id])

  async function fetchTodo() {
    setLoading(true)
    const [{ data: p }, { data: ts }, { data: sp }] = await Promise.all([
      supabase.from('organizador_perfiles').select('*').eq('organizador_id', id).maybeSingle(),
      supabase.from('tournaments').select('id, name, logo_url, modalidad, genero, city, season').eq('organizador_id', id).order('created_at', { ascending: false }),
      supabase.from('organizador_sponsors').select('*').eq('organizador_id', id).order('orden', { ascending: true }),
    ])
    setPerfil(p)
    setTorneos(ts || [])
    setSponsors(sp || [])
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

  const s = {
    page: { minHeight: '100vh', maxWidth: '100vw', overflowX: 'hidden', background: '#fff', fontFamily: 'system-ui, sans-serif', color: '#0f172a', ['--color-primario']: colorPrimario, ['--color-secundario']: colorSecundario },
    section: { maxWidth: '1100px', margin: '0 auto', padding: '48px 20px' },
    pill: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '.82rem', textDecoration: 'none', whiteSpace: 'nowrap' },
    card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  }

  return (
    <div style={s.page}>
      <style>{CSS_RESPONSIVO}</style>

      {/* NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #eef0f3' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f3f4', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {perfil?.logo_url ? <img src={perfil.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Globe size={19} color={colorPrimario}/>}
            </div>
            <div style={{ fontWeight: '900', fontSize: '.95rem', lineHeight: 1.15, letterSpacing: '.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
          </div>
          <div className="gm-vit-navlinks" style={{ flex: 1, justifyContent: 'center', gap: '24px', fontSize: '.78rem', fontWeight: '700', color: '#5f6368' }}>
            <a href="#inicio" style={{ color: colorPrimario, textDecoration: 'none' }}>INICIO</a>
            <a href="#torneos" style={{ color: 'inherit', textDecoration: 'none' }}>TORNEOS</a>
            {hayContacto && <a href="#contacto" style={{ color: 'inherit', textDecoration: 'none' }}>CONTACTO</a>}
          </div>
          {perfil?.escenario_id && (
            <Link to={`/reservar/${perfil.escenario_id}`} style={{ ...s.pill, background: colorPrimario, color: '#fff', flexShrink: 0 }}>
              <CalendarCheck size={14}/> <span className="gm-vit-navlinks" style={{ display: 'inline' }}>Reservar cancha</span>
            </Link>
          )}
        </div>
      </div>

      {/* HERO */}
      <div id="inicio" style={{ background: `linear-gradient(120deg, ${colorSecundario} 0%, #111827 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .08, backgroundImage: 'radial-gradient(circle at 15% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 85% 70%, #fff 1px, transparent 1px)', backgroundSize: '38px 38px' }}/>
        <div className="gm-vit-hero-grid" style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 20px', position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: '32px', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: colorPrimario, fontWeight: '800', fontSize: '.85rem', letterSpacing: '.04em', marginBottom: '6px' }}>Bienvenido a</div>
            <h1 className="gm-vit-title" style={{ margin: 0, fontSize: 'clamp(1.9rem, 7vw, 3.2rem)', fontWeight: '900', color: '#fff', lineHeight: 1.08, letterSpacing: '-.01em', wordBreak: 'break-word' }}>{nombre.toUpperCase()}</h1>
            {perfil?.descripcion && <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6, maxWidth: '480px', marginTop: '16px' }}>{perfil.descripcion}</p>}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '26px' }}>
              {[
                { icon: <ShieldCheck size={18} color={colorPrimario}/>, texto: 'Torneos seguros y organizados' },
                { icon: <Users size={18} color={colorPrimario}/>, texto: 'Pasión por el fútbol amateur' },
                ...(perfil?.escenario_id ? [{ icon: <CalendarCheck size={18} color={colorPrimario}/>, texto: 'Canchas de calidad' }] : []),
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '160px' }}>
                  {f.icon}
                  <span style={{ color: '#e5e7eb', fontSize: '.78rem', fontWeight: '600', lineHeight: 1.3 }}>{f.texto}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="gm-vit-hero-sponsor" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '18px', padding: '28px 22px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${colorPrimario}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Handshake size={26} color={colorPrimario}/>
            </div>
            <div style={{ color: colorPrimario, fontWeight: '900', fontSize: '1.2rem', letterSpacing: '.01em' }}>TU MARCA AQUÍ</div>
            <div style={{ color: '#e5e7eb', fontSize: '.83rem', fontWeight: '600', marginTop: '4px' }}>Apoya el deporte local</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', fontSize: '.68rem', color: '#9ca3af' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colorPrimario, display: 'inline-block', flexShrink: 0 }}/> Espacio disponible para patrocinadores
            </div>
          </div>
        </div>
      </div>

      {/* TORNEOS */}
      <div id="torneos" style={s.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '22px' }}>
          <Trophy size={20} color={colorPrimario}/>
          <div style={{ fontWeight: '900', fontSize: '1.05rem', letterSpacing: '.03em' }}>TORNEOS {torneos.length > 0 ? 'ACTIVOS' : ''}</div>
        </div>

        {torneos.length === 0 ? (
          <div style={{ ...s.card, padding: '48px 20px', textAlign: 'center', color: '#9aa0a6' }}>
            <Trophy size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
            <div>Todavía no hay torneos publicados acá</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {torneos.map(t => (
              <Link key={t.id} to={`/t/${t.id}`} className="gm-vit-card" style={{ ...s.card, display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ height: '88px', background: `linear-gradient(135deg, ${colorSecundario}, ${colorPrimario})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '52px', height: '52px', objectFit: 'contain' }}/> : <Trophy size={28} color="#fff"/>}
                </div>
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ alignSelf: 'flex-start', fontSize: '.62rem', fontWeight: '800', color: colorPrimario, background: `${colorPrimario}18`, borderRadius: '999px', padding: '2px 9px', marginBottom: '8px', letterSpacing: '.03em' }}>TORNEO</span>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '.92rem', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap', fontSize: '.7rem', color: '#5f6368', marginBottom: '12px' }}>
                    {t.modalidad && <span>⚽ {t.modalidad}</span>}
                    {t.city && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={11}/>{t.city}</span>}
                    {t.season && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={11}/>{t.season}</span>}
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: colorPrimario, fontWeight: '700', fontSize: '.76rem' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '22px' }}>
              <ShieldCheck size={20} color={colorPrimario}/>
              <div style={{ fontWeight: '900', fontSize: '1.05rem', letterSpacing: '.03em' }}>PATROCINADORES OFICIALES</div>
            </div>
            {/* Todos los logos van en una caja del MISMO tamaño (contain, no
                crop) para que ningún logo — cuadrado, ancho, alto — desarme
                la fila, sin importar la proporción de la imagen que suba
                cada patrocinador. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
              {sponsors.map(sp => {
                const contenido = (
                  <div className="gm-vit-card" style={{ width: '100%', height: '76px', background: '#fff', border: '1px solid #eef0f3', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px' }}>
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

      {/* CTA patrocinio */}
      <div style={s.section}>
        <div className="gm-vit-cta-grid" style={{ borderRadius: '18px', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,240px)', background: colorSecundario }}>
          <div style={{ padding: '30px 28px' }}>
            <div style={{ color: '#fff', fontWeight: '900', fontSize: '1.2rem' }}>¿Quieres patrocinar nuestros torneos?</div>
            <div style={{ color: '#cbd5e1', fontSize: '.85rem', marginTop: '6px', marginBottom: '18px' }}>Asocia tu marca con el deporte y llega a más personas.</div>
            {waHref ? (
              <a href={`${waHref}?text=${encodeURIComponent(`Hola, quiero patrocinar los torneos de ${nombre}`)}`} target="_blank" rel="noreferrer"
                style={{ ...s.pill, background: colorPrimario, color: '#fff' }}>
                <FaWhatsapp size={14}/> Conoce nuestros planes
              </a>
            ) : (
              <span style={{ ...s.pill, background: 'rgba(255,255,255,.12)', color: '#fff' }}>Conoce nuestros planes</span>
            )}
          </div>
          <div className="gm-vit-cta-image" style={{ backgroundImage: `linear-gradient(90deg, ${colorSecundario} 0%, transparent 45%), url(${IMG_CTA})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
        </div>
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
