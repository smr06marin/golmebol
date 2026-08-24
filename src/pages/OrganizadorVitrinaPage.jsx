import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Globe, Trophy, MapPin, Calendar, ChevronRight } from 'lucide-react'

// Vitrina pública de un organizador: junta TODOS sus torneos (tournaments
// donde organizador_id = este organizador) en una sola página, servida
// desde su dominio propio (organizador_perfiles.custom_domain) — pero el
// contenido en sí sigue viviendo 100% en Golmebol. Cada torneo de la lista
// lleva al mismo detalle público de siempre (TorneoPublicoPage), montado
// como ruta hermana dentro del mismo dominio (ver DominioPersonalizadoGate).
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6', fontSize: '.9rem' }}>Cargando...</div>
  )

  const colorPrimario   = perfil?.color_primario   || '#1a73e8'
  const colorSecundario = perfil?.color_secundario || '#1a237e'
  const nombre = perfil?.nombre_publico || 'Torneos'

  const s = {
    page: { minHeight: '100vh', background: '#f4f6fb', fontFamily: 'system-ui, sans-serif', ['--color-primario']: colorPrimario, ['--color-secundario']: colorSecundario },
    header: { background: 'linear-gradient(135deg, var(--color-secundario) 0%, var(--color-primario) 60%, #00bcd4 100%)', position: 'relative', overflow: 'hidden' },
    headerInner: { maxWidth: '720px', margin: '0 auto', padding: '40px 20px 28px', position: 'relative', zIndex: 1 },
    body: { maxWidth: '720px', margin: '0 auto', padding: '24px 16px 60px' },
    card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={{ position: 'absolute', inset: 0, opacity: .07, backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div style={s.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '76px', height: '76px', borderRadius: '18px', background: 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {perfil?.logo_url ? <img src={perfil.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Globe size={38} color="#fff"/>}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: '#fff', lineHeight: 1.2 }}>{nombre}</h1>
              <div style={{ fontSize: '.85rem', color: 'rgba(255,255,255,.8)', marginTop: '6px' }}>{torneos.length} torneo{torneos.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={s.body}>
        {torneos.length === 0 ? (
          <div style={{ ...s.card, padding: '48px 20px', textAlign: 'center', color: '#9aa0a6' }}>
            <Trophy size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
            <div>Todavía no hay torneos publicados acá</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {torneos.map(t => (
              <Link key={t.id} to={`/t/${t.id}`} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#e8f0fe', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Trophy size={22} color="#1a73e8"/>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', color: '#202124', fontSize: '.95rem' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {t.modalidad && <span style={{ fontSize: '.72rem', color: '#5f6368' }}>{t.modalidad}</span>}
                    {t.city && <span style={{ fontSize: '.72rem', color: '#9aa0a6', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10}/>{t.city}</span>}
                    {t.season && <span style={{ fontSize: '.72rem', color: '#9aa0a6', display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={10}/>{t.season}</span>}
                  </div>
                </div>
                <ChevronRight size={18} color="#9aa0a6" style={{ flexShrink: 0 }}/>
              </Link>
            ))}
          </div>
        )}

        {sponsors.length > 0 && (
          <div style={s.card}>
            <div style={{ padding: '14px 18px', fontWeight: '700', fontSize: '.85rem', color: '#3c4043', borderBottom: '1px solid #f1f3f4', background: '#fafbfc', letterSpacing: '.04em', textTransform: 'uppercase' }}>Patrocinadores</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '18px', justifyContent: 'center' }}>
              {sponsors.map(sp => {
                const contenido = (
                  <div style={{ width: '110px', height: '64px', background: '#fff', border: '1px solid #f1f3f4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {sp.logo_url ? <img src={sp.logo_url} alt={sp.nombre} style={{ maxWidth: '96px', maxHeight: '56px', objectFit: 'contain' }}/> : <span style={{ fontSize: '.72rem', color: '#9aa0a6', textAlign: 'center', padding: '0 6px' }}>{sp.nombre}</span>}
                  </div>
                )
                return sp.link
                  ? <a key={sp.id} href={sp.link} target="_blank" rel="noreferrer">{contenido}</a>
                  : <div key={sp.id}>{contenido}</div>
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
