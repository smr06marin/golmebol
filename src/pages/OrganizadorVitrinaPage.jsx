import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Globe, Trophy, MapPin, Calendar, ChevronRight, CalendarCheck, Handshake, Users, ShieldCheck, Mail, Phone } from 'lucide-react'
import { FaWhatsapp, FaFacebookF, FaInstagram, FaTiktok } from 'react-icons/fa'
import { PantallaCargando } from '../components/PantallaCargando'

const IMG_CTA = 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=900&q=60'

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
    page: { minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, sans-serif', color: '#0f172a', ['--color-primario']: colorPrimario, ['--color-secundario']: colorSecundario },
    section: { maxWidth: '1100px', margin: '0 auto', padding: '48px 20px' },
    pill: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '.82rem', textDecoration: 'none' },
    card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  }

  return (
    <div style={s.page}>
      {/* NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #eef0f3' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f1f3f4', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {perfil?.logo_url ? <img src={perfil.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Globe size={20} color={colorPrimario}/>}
            </div>
            <div>
              <div style={{ fontWeight: '900', fontSize: '1.05rem', lineHeight: 1.1, letterSpacing: '.01em' }}>{nombre.toUpperCase()}</div>
              {perfil?.descripcion && <div style={{ fontSize: '.68rem', color: '#5f6368', marginTop: '2px' }}>{perfil.descripcion.slice(0, 40)}</div>}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '26px', fontSize: '.8rem', fontWeight: '700', color: '#5f6368' }} className="gm-vitrina-nav">
            <a href="#inicio" style={{ color: colorPrimario, textDecoration: 'none' }}>INICIO</a>
            <a href="#torneos" style={{ color: 'inherit', textDecoration: 'none' }}>TORNEOS</a>
            {hayContacto && <a href="#contacto" style={{ color: 'inherit', textDecoration: 'none' }}>CONTACTO</a>}
          </div>
          {perfil?.escenario_id && (
            <Link to={`/reservar/${perfil.escenario_id}`} style={{ ...s.pill, background: colorPrimario, color: '#fff', flexShrink: 0 }}>
              <CalendarCheck size={15}/> Reservar cancha
            </Link>
          )}
        </div>
      </div>

      {/* HERO */}
      <div id="inicio" style={{ background: `linear-gradient(120deg, ${colorSecundario} 0%, #111827 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .08, backgroundImage: 'radial-gradient(circle at 15% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 85% 70%, #fff 1px, transparent 1px)', backgroundSize: '38px 38px' }}/>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '56px 20px', position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(240px,1fr)', gap: '36px', alignItems: 'center' }}>
          <div>
            <div style={{ color: colorPrimario, fontWeight: '800', fontSize: '.85rem', letterSpacing: '.04em', marginBottom: '6px' }}>Bienvenido a</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 6vw, 3.2rem)', fontWeight: '900', color: '#fff', lineHeight: 1.05, letterSpacing: '-.01em' }}>{nombre.toUpperCase()}</h1>
            {perfil?.descripcion && <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6, maxWidth: '480px', marginTop: '16px' }}>{perfil.descripcion}</p>}
            <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', marginTop: '28px' }}>
              {[
                { icon: <ShieldCheck size={18} color={colorPrimario}/>, texto: 'Torneos seguros y organizados' },
                { icon: <Users size={18} color={colorPrimario}/>, texto: 'Pasión por el fútbol amateur' },
                ...(perfil?.escenario_id ? [{ icon: <CalendarCheck size={18} color={colorPrimario}/>, texto: 'Canchas de calidad' }] : []),
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '150px' }}>
                  {f.icon}
                  <span style={{ color: '#e5e7eb', fontSize: '.78rem', fontWeight: '600', lineHeight: 1.3 }}>{f.texto}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '18px', padding: '30px 22px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: `${colorPrimario}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Handshake size={28} color={colorPrimario}/>
            </div>
            <div style={{ color: colorPrimario, fontWeight: '900', fontSize: '1.3rem', letterSpacing: '.01em' }}>TU MARCA AQUÍ</div>
            <div style={{ color: '#e5e7eb', fontSize: '.85rem', fontWeight: '600', marginTop: '4px' }}>Apoya el deporte local</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', fontSize: '.7rem', color: '#9ca3af' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colorPrimario, display: 'inline-block' }}/> Espacio disponible para patrocinadores
            </div>
          </div>
        </div>
      </div>

      {/* TORNEOS */}
      <div id="torneos" style={s.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '22px' }}>
          <Trophy size={20} color={colorPrimario}/>
          <div style={{ fontWeight: '900', fontSize: '1.1rem', letterSpacing: '.03em' }}>TORNEOS {torneos.length > 0 ? 'ACTIVOS' : ''}</div>
        </div>

        {torneos.length === 0 ? (
          <div style={{ ...s.card, padding: '48px 20px', textAlign: 'center', color: '#9aa0a6' }}>
            <Trophy size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
            <div>Todavía no hay torneos publicados acá</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {torneos.map(t => (
              <Link key={t.id} to={`/t/${t.id}`} style={{ ...s.card, display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ height: '90px', background: `linear-gradient(135deg, ${colorSecundario}, ${colorPrimario})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '54px', height: '54px', objectFit: 'contain' }}/> : <Trophy size={30} color="#fff"/>}
                </div>
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ alignSelf: 'flex-start', fontSize: '.62rem', fontWeight: '800', color: colorPrimario, background: `${colorPrimario}18`, borderRadius: '999px', padding: '2px 9px', marginBottom: '8px', letterSpacing: '.03em' }}>TORNEO</span>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '.95rem', marginBottom: '8px' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '.72rem', color: '#5f6368', marginBottom: '12px' }}>
                    {t.modalidad && <span>⚽ {t.modalidad}</span>}
                    {t.city && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={11}/>{t.city}</span>}
                    {t.season && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={11}/>{t.season}</span>}
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: colorPrimario, fontWeight: '700', fontSize: '.78rem' }}>
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
              <div style={{ fontWeight: '900', fontSize: '1.1rem', letterSpacing: '.03em' }}>PATROCINADORES OFICIALES</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {sponsors.map(sp => {
                const contenido = (
                  <div style={{ width: '150px', height: '80px', background: '#fff', border: '1px solid #eef0f3', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {sp.logo_url ? <img src={sp.logo_url} alt={sp.nombre} style={{ maxWidth: '128px', maxHeight: '68px', objectFit: 'contain' }}/> : <span style={{ fontSize: '.78rem', fontWeight: '700', color: '#5f6368', textAlign: 'center', padding: '0 8px' }}>{sp.nombre}</span>}
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
        <div style={{ borderRadius: '18px', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,260px)', background: colorSecundario }}>
          <div style={{ padding: '30px 32px' }}>
            <div style={{ color: '#fff', fontWeight: '900', fontSize: '1.25rem' }}>¿Quieres patrocinar nuestros torneos?</div>
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
          <div style={{ backgroundImage: `linear-gradient(90deg, ${colorSecundario} 0%, transparent 40%), url(${IMG_CTA})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
        </div>
      </div>

      {/* FOOTER */}
      <div id="contacto" style={{ background: '#0b1220', color: '#94a3b8', paddingTop: '40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '28px', paddingBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {perfil?.logo_url ? <img src={perfil.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Globe size={18} color={colorPrimario}/>}
              </div>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '.95rem' }}>{nombre.toUpperCase()}</div>
            </div>
            {perfil?.descripcion && <div style={{ fontSize: '.75rem', lineHeight: 1.6 }}>{perfil.descripcion}</div>}
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '.78rem', letterSpacing: '.03em', marginBottom: '12px' }}>ENLACES RÁPIDOS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '.78rem' }}>
              <a href="#inicio" style={{ color: 'inherit', textDecoration: 'none' }}>Inicio</a>
              <a href="#torneos" style={{ color: 'inherit', textDecoration: 'none' }}>Torneos</a>
              {hayContacto && <a href="#contacto" style={{ color: 'inherit', textDecoration: 'none' }}>Contacto</a>}
            </div>
          </div>

          {hayContacto && (
            <div>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '.78rem', letterSpacing: '.03em', marginBottom: '12px' }}>CONTÁCTANOS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '.78rem' }}>
                {perfil.whatsapp && <a href={waHref} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={13}/> {perfil.whatsapp}</a>}
                {perfil.email && <a href={`mailto:${perfil.email}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={13}/> {perfil.email}</a>}
                {perfil.direccion && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={13}/> {perfil.direccion}</div>}
              </div>
            </div>
          )}

          {hayRedes && (
            <div>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '.78rem', letterSpacing: '.03em', marginBottom: '12px' }}>SÍGUENOS</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {perfil.facebook_url && <a href={perfil.facebook_url} target="_blank" rel="noreferrer" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><FaFacebookF size={14}/></a>}
                {perfil.instagram_url && <a href={perfil.instagram_url} target="_blank" rel="noreferrer" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><FaInstagram size={14}/></a>}
                {perfil.tiktok_url && <a href={perfil.tiktok_url} target="_blank" rel="noreferrer" style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><FaTiktok size={13}/></a>}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', padding: '16px 20px', maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '.7rem' }}>
          <span>© {new Date().getFullYear()} {nombre}. Todos los derechos reservados.</span>
          <span>Desarrollado por GOLMEBOL</span>
        </div>
      </div>
    </div>
  )
}
