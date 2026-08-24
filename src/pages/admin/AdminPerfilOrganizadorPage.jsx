import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Globe, Upload, Image as ImageIcon, Plus, X, ExternalLink, Trophy } from 'lucide-react'

// Perfil de organizador: dominio propio + branding que junta TODOS los
// torneos de un mismo organizador en una sola "vitrina" pública, servida
// desde su propio dominio pero manejada 100% desde acá (Golmebol). Es el
// mismo concepto que la pestaña "Personalización" de un torneo individual
// (migracion_personalizacion_torneo.sql), pero a nivel de organizador —
// requiere migracion_organizador_perfil.sql.

const inputStyle = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = { fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }

function hexValido(v, fallback) {
  const t = (v || '').trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t}`
  return fallback
}

export default function AdminPerfilOrganizadorPage() {
  const { user, rol } = useAuthStore()
  const esOrganizador = rol?.rol === 'organizador'
  const esAdmin = rol?.rol ? rol.rol === 'admin' : true // sin sistema de roles cargado, todo usuario del admin es admin

  // El admin puede elegir A CUÁL organizador le está editando el perfil —
  // solo él puede asignar el dominio propio. El organizador solo ve/edita
  // el suyo (targetId = user.id) y el campo de dominio queda de solo
  // lectura para él.
  const [listaOrganizadores, setListaOrganizadores] = useState([]) // [{user_id, email}]
  const [organizadorSel, setOrganizadorSel] = useState('')
  const targetId = esAdmin ? organizadorSel : user?.id

  const [perfil, setPerfil] = useState(null) // fila de organizador_perfiles (o null si aún no existe)
  const [form, setForm] = useState({ nombre_publico: '', custom_domain: '', color_primario: '#1a73e8', color_secundario: '#202124', logo_url: '', favicon_url: '', escenario_id: '', descripcion: '', whatsapp: '', email: '', direccion: '', facebook_url: '', instagram_url: '', tiktok_url: '' })
  const [torneos, setTorneos] = useState([])
  const [sponsors, setSponsors] = useState([])
  const [escenariosDisponibles, setEscenariosDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingSponsors, setLoadingSponsors] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [uploadingSponsorId, setUploadingSponsorId] = useState(null)
  const [savingSponsorId, setSavingSponsorId] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (esAdmin) fetchListaOrganizadores()
    else if (user?.id) setOrganizadorSel(user.id) // no se usa (targetId = user.id directo) pero deja todo consistente
    fetchEscenarios()
  }, [esAdmin, user?.id])

  useEffect(() => {
    if (targetId) { fetchPerfil(); fetchTorneos(); fetchSponsors() }
    else { setLoading(false); setPerfil(null); setTorneos([]); setSponsors([]) }
  }, [targetId])

  function showMsg(text, type = 'ok') { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000) }

  async function fetchListaOrganizadores() {
    const { data, error } = await supabase.from('roles_plataforma').select('user_id, email').eq('rol', 'organizador').not('user_id', 'is', null)
    if (!error) setListaOrganizadores(data || [])
  }

  // No hay ninguna relación automática entre una cuenta de organizador
  // (torneos) y un escenario (canchas) — los encargados de escenario se
  // identifican por cédula, no por esta cuenta. Por eso se elige a mano de
  // la lista completa de escenarios.
  async function fetchEscenarios() {
    const { data, error } = await supabase.from('escenarios').select('id, name, city').order('name')
    if (!error) setEscenariosDisponibles(data || [])
  }

  async function fetchPerfil() {
    setLoading(true)
    const { data, error } = await supabase.from('organizador_perfiles').select('*').eq('organizador_id', targetId).maybeSingle()
    if (error) {
      showMsg(/does not exist/.test(error.message || '') ? '⚠️ Falta correr migracion_organizador_perfil.sql en Supabase' : 'Error: ' + error.message, 'error')
      setLoading(false)
      return
    }
    setPerfil(data)
    setForm({
      nombre_publico: data?.nombre_publico || '', custom_domain: data?.custom_domain || '',
      color_primario: data?.color_primario || '#1a73e8', color_secundario: data?.color_secundario || '#202124',
      logo_url: data?.logo_url || '', favicon_url: data?.favicon_url || '', escenario_id: data?.escenario_id || '',
      descripcion: data?.descripcion || '', whatsapp: data?.whatsapp || '', email: data?.email || '', direccion: data?.direccion || '',
      facebook_url: data?.facebook_url || '', instagram_url: data?.instagram_url || '', tiktok_url: data?.tiktok_url || '',
    })
    setLoading(false)
  }

  async function fetchTorneos() {
    const { data } = await supabase.from('tournaments').select('id, name, logo_url, fecha_inicio, fecha_fin').eq('organizador_id', targetId).order('created_at', { ascending: false })
    setTorneos(data || [])
  }

  async function fetchSponsors() {
    setLoadingSponsors(true)
    const { data, error } = await supabase.from('organizador_sponsors').select('*').eq('organizador_id', targetId).order('orden', { ascending: true })
    setLoadingSponsors(false)
    if (!error) setSponsors(data || [])
  }

  async function guardar() {
    setGuardando(true)
    const payload = {
      organizador_id: targetId,
      nombre_publico: form.nombre_publico.trim() || null,
      color_primario: form.color_primario?.trim() || null,
      color_secundario: form.color_secundario?.trim() || null,
      logo_url: form.logo_url || null,
      favicon_url: form.favicon_url || null,
      escenario_id: form.escenario_id || null,
      descripcion: form.descripcion.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
      facebook_url: form.facebook_url.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      tiktok_url: form.tiktok_url.trim() || null,
      updated_at: new Date().toISOString(),
    }
    // El dominio solo lo toca el admin — si lo guarda el organizador, ni
    // siquiera se manda esa columna (así no se pisa lo que haya puesto el
    // admin, ni se puede poner uno el organizador por su cuenta).
    // En minúsculas siempre: el navegador busca el dominio en minúsculas
    // (window.location.hostname), así que si acá quedara con mayúsculas la
    // vitrina nunca hace match y no se ve nada.
    if (esAdmin) payload.custom_domain = form.custom_domain.trim().toLowerCase() || null
    const { data, error } = await supabase.from('organizador_perfiles').upsert(payload, { onConflict: 'organizador_id' }).select().single()
    setGuardando(false)
    if (error) return showMsg('Error al guardar: ' + error.message, 'error')
    setPerfil(data)
    setForm(f => ({ ...f, custom_domain: data.custom_domain || '' }))
    showMsg('✅ Vitrina guardada')
  }

  async function handleUploadLogo(file) {
    if (!file || !targetId) return
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${targetId}/logo.${ext}`
    const { error: uploadError } = await supabase.storage.from('organizador-branding').upload(path, file, { upsert: true })
    if (uploadError) { setUploadingLogo(false); return showMsg('Error al subir logo: ' + uploadError.message, 'error') }
    const { data: urlData } = supabase.storage.from('organizador-branding').getPublicUrl(path)
    setForm(f => ({ ...f, logo_url: urlData.publicUrl }))
    setUploadingLogo(false)
    showMsg('Logo subido — recuerda guardar')
  }

  async function handleUploadFavicon(file) {
    if (!file || !targetId) return
    setUploadingFavicon(true)
    const ext = file.name.split('.').pop()
    const path = `${targetId}/favicon.${ext}`
    const { error: uploadError } = await supabase.storage.from('organizador-branding').upload(path, file, { upsert: true })
    if (uploadError) { setUploadingFavicon(false); return showMsg('Error al subir favicon: ' + uploadError.message, 'error') }
    const { data: urlData } = supabase.storage.from('organizador-branding').getPublicUrl(path)
    setForm(f => ({ ...f, favicon_url: urlData.publicUrl }))
    setUploadingFavicon(false)
    showMsg('Favicon subido — recuerda guardar')
  }

  async function handleAgregarSponsor() {
    const orden = sponsors.length > 0 ? Math.max(...sponsors.map(s => s.orden || 0)) + 1 : 0
    const { data, error } = await supabase.from('organizador_sponsors').insert({ organizador_id: targetId, nombre: '', logo_url: null, link: null, orden }).select().single()
    if (error) return showMsg('Error al agregar patrocinador: ' + error.message, 'error')
    setSponsors(prev => [...prev, data])
  }

  function updateSponsorLocal(sponsorId, field, value) {
    setSponsors(prev => prev.map(s => s.id === sponsorId ? { ...s, [field]: value } : s))
  }

  async function saveSponsorField(sponsor, field, value) {
    setSavingSponsorId(sponsor.id)
    const { error } = await supabase.from('organizador_sponsors').update({ [field]: value }).eq('id', sponsor.id)
    setSavingSponsorId(null)
    if (error) showMsg('Error al guardar patrocinador', 'error')
  }

  async function handleSponsorLogo(sponsor, file) {
    if (!file) return
    setUploadingSponsorId(sponsor.id)
    const ext = file.name.split('.').pop()
    const path = `${targetId}/sponsors/${sponsor.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('organizador-branding').upload(path, file, { upsert: true })
    if (uploadError) { setUploadingSponsorId(null); return showMsg('Error al subir logo', 'error') }
    const { data: urlData } = supabase.storage.from('organizador-branding').getPublicUrl(path)
    const { error } = await supabase.from('organizador_sponsors').update({ logo_url: urlData.publicUrl }).eq('id', sponsor.id)
    setUploadingSponsorId(null)
    if (error) return showMsg('Error al guardar logo del patrocinador', 'error')
    setSponsors(prev => prev.map(s => s.id === sponsor.id ? { ...s, logo_url: urlData.publicUrl } : s))
    showMsg('Logo del patrocinador subido ✓')
  }

  async function handleEliminarSponsor(sponsor) {
    if (!confirm(`¿Eliminar patrocinador${sponsor.nombre ? ` "${sponsor.nombre}"` : ''}?`)) return
    const { error } = await supabase.from('organizador_sponsors').delete().eq('id', sponsor.id)
    if (error) return showMsg('Error al eliminar', 'error')
    setSponsors(prev => prev.filter(s => s.id !== sponsor.id))
    showMsg('Patrocinador eliminado')
  }

  if (esAdmin && !targetId) return (
    <div style={{ maxWidth: '520px' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Globe size={20} color="#1a73e8"/> Mi dominio / vitrina
      </h1>
      <p style={{ color: '#5f6368', margin: '0 0 20px', fontSize: '.875rem' }}>Elegí a qué organizador le vas a asignar dominio y branding.</p>
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <label style={labelStyle}>Organizador</label>
        <select value={organizadorSel} onChange={e => setOrganizadorSel(e.target.value)} style={inputStyle}>
          <option value="">— Elegir organizador —</option>
          {listaOrganizadores.map(o => <option key={o.user_id} value={o.user_id}>{o.email}</option>)}
        </select>
        {listaOrganizadores.length === 0 && <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '8px' }}>No hay ningún usuario con rol "organizador" todavía.</div>}
      </div>
    </div>
  )

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '760px' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Globe size={20} color="#1a73e8"/> Mi dominio / vitrina
      </h1>
      <p style={{ color: '#5f6368', margin: '0 0 20px', fontSize: '.875rem' }}>
        Un dominio propio que junta {esOrganizador ? 'todos tus torneos' : 'todos los torneos de un organizador'} en una sola página pública, con tu logo, favicon y patrocinadores — todo lo administras acá, en Golmebol.
      </p>

      {esAdmin && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ ...labelStyle, marginBottom: 0, flexShrink: 0 }}>Editando a:</label>
          <select value={organizadorSel} onChange={e => setOrganizadorSel(e.target.value)} style={{ ...inputStyle, maxWidth: '320px' }}>
            <option value="">— Elegir organizador —</option>
            {listaOrganizadores.map(o => <option key={o.user_id} value={o.user_id}>{o.email}</option>)}
          </select>
        </div>
      )}

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '.85rem', background: msg.type === 'ok' ? '#e6f4ea' : '#fce8e6', color: msg.type === 'ok' ? '#1e8e3e' : '#d93025' }}>
          {msg.text}
        </div>
      )}

      {/* Marca */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', marginBottom: '4px' }}>🎨 Marca</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Nombre público, colores, dominio, logo y favicon de tu vitrina</div>
          </div>
          {perfil?.id && (
            <a href={`/organizador/${targetId}`} target="_blank" rel="noreferrer" title="Vista previa tal cual la ve el público, aunque el dominio propio aún no esté vinculado"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0, padding: '8px 12px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', color: '#1a73e8', fontSize: '.78rem', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <ExternalLink size={14}/> Ver vitrina
            </a>
          )}
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Nombre público</label>
          <input value={form.nombre_publico} onChange={e => setForm(f => ({ ...f, nombre_publico: e.target.value }))} style={inputStyle} placeholder="Ej: Liga Relámpago Armenia"/>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Descripción corta (aparece debajo del título)</label>
          <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={inputStyle} placeholder="Ej: Organizamos los mejores torneos de fútbol en Armenia"/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Dominio propio {!esAdmin && '(solo lo asigna el administrador)'}</label>
            <input value={form.custom_domain} onChange={e => setForm(f => ({ ...f, custom_domain: e.target.value }))} style={{ ...inputStyle, ...(esAdmin ? {} : { background: '#f1f3f4', color: '#5f6368', cursor: 'not-allowed' }) }}
              placeholder={esAdmin ? 'miliga.com' : 'Todavía no tienes uno asignado'} disabled={!esAdmin} readOnly={!esAdmin}/>
            <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>
              {esAdmin ? 'Ej: miliga.com — después hay que apuntar el DNS a Golmebol' : 'Escríbele al administrador por WhatsApp para que te asigne tu dominio propio.'}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Color primario</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color" value={hexValido(form.color_primario, '#1a73e8')} onChange={e => setForm(f => ({ ...f, color_primario: e.target.value }))}
                style={{ width: '44px', height: '38px', border: '1px solid #dadce0', borderRadius: '8px', padding: '2px', background: '#fff', cursor: 'pointer', flexShrink: 0 }}/>
              <input value={form.color_primario} onChange={e => setForm(f => ({ ...f, color_primario: e.target.value }))}
                onBlur={e => setForm(f => ({ ...f, color_primario: hexValido(e.target.value, f.color_primario || '#1a73e8') }))} style={inputStyle} placeholder="#1a73e8"/>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Color secundario</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color" value={hexValido(form.color_secundario, '#202124')} onChange={e => setForm(f => ({ ...f, color_secundario: e.target.value }))}
                style={{ width: '44px', height: '38px', border: '1px solid #dadce0', borderRadius: '8px', padding: '2px', background: '#fff', cursor: 'pointer', flexShrink: 0 }}/>
              <input value={form.color_secundario} onChange={e => setForm(f => ({ ...f, color_secundario: e.target.value }))}
                onBlur={e => setForm(f => ({ ...f, color_secundario: hexValido(e.target.value, f.color_secundario || '#202124') }))} style={inputStyle} placeholder="#202124"/>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: '#e8f0fe', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Globe size={22} color="#1a73e8"/>}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                <Upload size={12}/> {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingLogo} onChange={e => { handleUploadLogo(e.target.files[0]); e.target.value = '' }}/>
              </label>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Favicon</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: '#f8f9fa', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {form.favicon_url ? <img src={form.favicon_url} alt="favicon" style={{ width: '32px', height: '32px', objectFit: 'contain' }}/> : <ImageIcon size={20} color="#9aa0a6"/>}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                <Upload size={12}/> {uploadingFavicon ? 'Subiendo...' : 'Subir favicon'}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingFavicon} onChange={e => { handleUploadFavicon(e.target.files[0]); e.target.value = '' }}/>
              </label>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>Escenario para reservar cancha (opcional)</label>
          <select value={form.escenario_id} onChange={e => setForm(f => ({ ...f, escenario_id: e.target.value }))} style={inputStyle}>
            <option value="">— Sin escenario vinculado —</option>
            {escenariosDisponibles.map(e => <option key={e.id} value={e.id}>{e.name}{e.city ? ` — ${e.city}` : ''}</option>)}
          </select>
          <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>
            Si el organizador también tiene canchas en Escenarios Deportivos, elegí cuál acá y la vitrina muestra un botón "Reservar cancha". Si todavía no existe, creálo primero en ESCENARIOS.
          </div>
        </div>

      </div>

      {/* Contacto y redes — se usan en el pie de página de la vitrina */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', marginBottom: '4px' }}>📞 Contacto y redes</div>
        <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '16px' }}>Aparecen en el pie de página de la vitrina — dejá vacío lo que no quieras mostrar.</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} style={inputStyle} placeholder="3001234567"/>
          </div>
          <div>
            <label style={labelStyle}>Correo</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="info@miliga.com"/>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Dirección / ciudad</label>
            <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} style={inputStyle} placeholder="Armenia, Quindío"/>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Facebook</label>
            <input value={form.facebook_url} onChange={e => setForm(f => ({ ...f, facebook_url: e.target.value }))} style={inputStyle} placeholder="https://facebook.com/..."/>
          </div>
          <div>
            <label style={labelStyle}>Instagram</label>
            <input value={form.instagram_url} onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))} style={inputStyle} placeholder="https://instagram.com/..."/>
          </div>
          <div>
            <label style={labelStyle}>TikTok</label>
            <input value={form.tiktok_url} onChange={e => setForm(f => ({ ...f, tiktok_url: e.target.value }))} style={inputStyle} placeholder="https://tiktok.com/@..."/>
          </div>
        </div>
      </div>

      <button onClick={guardar} disabled={guardando}
        style={{ padding: '10px 22px', background: guardando ? '#dadce0' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: guardando ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700', marginBottom: '16px' }}>
        {guardando ? 'Guardando...' : '✓ Guardar vitrina'}
      </button>

      {/* Torneos que se ven en la vitrina */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', marginBottom: '4px' }}>🏆 Torneos en tu vitrina</div>
        <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '14px' }}>Se muestran solos, automáticamente — cualquier torneo que crees a tu nombre aparece acá sin hacer nada más.</div>
        {torneos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '20px', fontSize: '.8rem', background: '#f8f9fa', borderRadius: '10px' }}>Todavía no tienes torneos creados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {torneos.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#fafafa', borderRadius: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Trophy size={14} color="#1a73e8"/>}
                </div>
                <span style={{ fontSize: '.85rem', color: '#202124', fontWeight: '600' }}>{t.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patrocinadores */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>🤝 Patrocinadores de la vitrina</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>Se ven en toda tu vitrina — distinto de los patrocinadores de cada torneo por separado</div>
          </div>
          <button onClick={handleAgregarSponsor}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>
            <Plus size={14}/> Agregar patrocinador
          </button>
        </div>

        {loadingSponsors ? (
          <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '32px', fontSize: '.875rem' }}>Cargando...</div>
        ) : sponsors.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '28px', fontSize: '.8rem', background: '#f8f9fa', borderRadius: '10px' }}>Todavía no hay patrocinadores — agregá el primero</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sponsors.map(sponsor => (
              <div key={sponsor.id} style={{ border: '1px solid #e8eaed', borderRadius: '10px', padding: '14px', background: '#fafafa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px', alignItems: 'start' }}>
                  <div>
                    <div style={{ width: '100px', height: '60px', background: '#fff', borderRadius: '8px', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '8px' }}>
                      {sponsor.logo_url ? <img src={sponsor.logo_url} alt={sponsor.nombre || 'sponsor'} style={{ maxWidth: '90px', maxHeight: '52px', objectFit: 'contain' }}/> : <span style={{ fontSize: '.7rem', color: '#9aa0a6' }}>Sin logo</span>}
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                      <Upload size={11}/> {uploadingSponsorId === sponsor.id ? 'Subiendo...' : 'Logo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingSponsorId === sponsor.id} onChange={e => { handleSponsorLogo(sponsor, e.target.files[0]); e.target.value = '' }}/>
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                    <div>
                      <label style={labelStyle}>Nombre</label>
                      <input value={sponsor.nombre || ''} onChange={e => updateSponsorLocal(sponsor.id, 'nombre', e.target.value)}
                        onBlur={e => saveSponsorField(sponsor, 'nombre', e.target.value)} style={inputStyle} placeholder="Nombre del patrocinador"/>
                    </div>
                    <div>
                      <label style={labelStyle}>Link</label>
                      <input value={sponsor.link || ''} onChange={e => updateSponsorLocal(sponsor.id, 'link', e.target.value)}
                        onBlur={e => saveSponsorField(sponsor, 'link', e.target.value || null)} style={inputStyle} placeholder="https://..."/>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ width: '90px' }}>
                        <label style={labelStyle}>Orden</label>
                        <input type="number" value={sponsor.orden ?? 0} onChange={e => updateSponsorLocal(sponsor.id, 'orden', parseInt(e.target.value, 10) || 0)}
                          onBlur={e => saveSponsorField(sponsor, 'orden', parseInt(e.target.value, 10) || 0)} style={inputStyle}/>
                      </div>
                      <button onClick={() => handleEliminarSponsor(sponsor)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: '#fff', border: '1px solid #fad2cf', borderRadius: '8px', cursor: 'pointer', color: '#d93025', fontSize: '.75rem', marginBottom: '1px' }}>
                        <X size={13}/> Eliminar
                      </button>
                      {savingSponsorId === sponsor.id && <span style={{ fontSize: '.72rem', color: '#9aa0a6', paddingBottom: '10px' }}>Guardando...</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
