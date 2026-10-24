import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Megaphone, Upload, X, Plus, Trash2, Film, Image as IconoImagen } from 'lucide-react'
import { FaFacebook, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa'

const inputStyle = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = {
  fontSize: '.75rem', fontWeight: '500', color: '#5f6368',
  display: 'block', marginBottom: '4px',
}

const MAX_VIDEO_MB = 50
const MAX_BANNER_MB = 5

// Ruta del archivo dentro del bucket a partir de su URL pública
function rutaDeUrl(url) {
  if (!url) return null
  const i = url.indexOf('/patrocinadores/')
  return i < 0 ? null : decodeURIComponent(url.slice(i + '/patrocinadores/'.length).split('?')[0])
}
const extDe = (f) => (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'

export default function AdminPatrocinadoresPage() {
  const [patrocinadores, setPatrocinadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [subiendoMedia, setSubiendoMedia] = useState(null) // `${id}:banner` | `${id}:video`
  const [msg, setMsg] = useState(null)
  const guardandoRef = useRef({}) // { [id]: bool } — bloqueo inmediato por fila, evita doble clic en "Guardar"
  const creandoRef = useRef(false) // bloqueo inmediato para "Agregar patrocinador"

  useEffect(() => { fetchPatrocinadores() }, [])

  async function fetchPatrocinadores() {
    setLoading(true)
    const { data, error } = await supabase.from('patrocinadores_golmebol').select('*').order('orden').order('created_at')
    if (error) showMsg('Falta ejecutar migracion_patrocinadores_golmebol.sql en Supabase', 'error')
    setPatrocinadores(data || [])
    setLoading(false)
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), type === 'error' ? 6000 : 3000)
  }

  async function handleAgregar() {
    if (creandoRef.current) return // ya se está creando — evita doble clic
    creandoRef.current = true
    try {
      const maxOrden = patrocinadores.reduce((m, p) => Math.max(m, p.orden || 0), 0)
      const { data, error } = await supabase.from('patrocinadores_golmebol')
        .insert({ nombre: 'Nuevo patrocinador', orden: maxOrden + 1, activo: true }).select().single()
      if (error) { showMsg('Error al crear', 'error'); return }
      setPatrocinadores(prev => [...prev, data])
      showMsg('Patrocinador agregado ✓')
    } finally {
      creandoRef.current = false
    }
  }

  async function handleSave(patro) {
    if (guardandoRef.current[patro.id]) return // ya se está guardando — evita doble clic
    guardandoRef.current[patro.id] = true
    setSaving(patro.id)
    try {
      const { error } = await supabase.from('patrocinadores_golmebol').update({
        nombre: patro.nombre, whatsapp: patro.whatsapp, direccion: patro.direccion,
        facebook: patro.facebook, instagram: patro.instagram, tiktok: patro.tiktok,
        orden: patro.orden, activo: patro.activo,
      }).eq('id', patro.id)
      if (error) showMsg('Error al guardar', 'error')
      else showMsg('Guardado ✓')
    } finally {
      guardandoRef.current[patro.id] = false
      setSaving(null)
    }
  }

  async function handleEliminar(patro) {
    if (!confirm(`¿Eliminar "${patro.nombre}"? Esto no se puede deshacer.`)) return
    const { error } = await supabase.from('patrocinadores_golmebol').delete().eq('id', patro.id)
    if (error) { showMsg('Error al eliminar', 'error'); return }
    if (patro.logo_url) {
      const path = `${patro.id}.${patro.logo_url.split('.').pop().split('?')[0]}`
      await supabase.storage.from('patrocinadores').remove([path])
    }
    const rutas = [...(patro.banners || []), patro.video_url].map(rutaDeUrl).filter(Boolean)
    if (rutas.length) await supabase.storage.from('patrocinadores').remove(rutas)
    setPatrocinadores(prev => prev.filter(p => p.id !== patro.id))
    showMsg('Patrocinador eliminado')
  }

  async function handleLogo(patro, file) {
    if (!file) return
    setUploading(patro.id)
    const ext = file.name.split('.').pop()
    const path = `${patro.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('patrocinadores').upload(path, file, { upsert: true })
    if (uploadError) { setUploading(null); showMsg('Error al subir imagen', 'error'); return }
    const { data: urlData } = supabase.storage.from('patrocinadores').getPublicUrl(path)
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}` // cache-bust: si reemplazan el logo, que se vea el nuevo de una
    const { error: updateError } = await supabase.from('patrocinadores_golmebol').update({ logo_url: logoUrl }).eq('id', patro.id)
    if (updateError) { setUploading(null); showMsg('Error al guardar URL', 'error'); return }
    setPatrocinadores(prev => prev.map(p => p.id === patro.id ? { ...p, logo_url: logoUrl } : p))
    setUploading(null)
    showMsg('Logo subido ✓')
  }

  // Banners: se pueden subir varios a la vez; cada uno con nombre único (así nunca se ve uno viejo guardado en caché)
  async function handleBanners(patro, fileList) {
    const files = Array.from(fileList || [])
    if (!files.length || subiendoMedia) return
    const malos = files.filter(f => !f.type.startsWith('image/') || f.size > MAX_BANNER_MB * 1024 * 1024)
    if (malos.length) { showMsg(`Cada banner debe ser una imagen de máximo ${MAX_BANNER_MB} MB`, 'error'); return }
    setSubiendoMedia(`${patro.id}:banner`)
    try {
      const nuevas = []
      for (let i = 0; i < files.length; i++) {
        const path = `banner_${patro.id}_${Date.now()}_${i}.${extDe(files[i])}`
        const { error } = await supabase.storage.from('patrocinadores').upload(path, files[i], { contentType: files[i].type })
        if (error) { showMsg('Error al subir un banner. Revisa que exista el almacenamiento "patrocinadores"', 'error'); break }
        nuevas.push(supabase.storage.from('patrocinadores').getPublicUrl(path).data.publicUrl)
      }
      if (!nuevas.length) return
      const lista = [...(patro.banners || []), ...nuevas]
      const { error } = await supabase.from('patrocinadores_golmebol').update({ banners: lista }).eq('id', patro.id)
      if (error) { showMsg('Falta ejecutar migracion_patrocinadores_video_banner.sql en Supabase', 'error'); return }
      updateLocal(patro.id, 'banners', lista)
      showMsg(nuevas.length > 1 ? `${nuevas.length} banners subidos ✓` : 'Banner subido ✓')
    } finally {
      setSubiendoMedia(null)
    }
  }

  async function handleQuitarBanner(patro, url) {
    if (subiendoMedia) return
    const lista = (patro.banners || []).filter(u => u !== url)
    const { error } = await supabase.from('patrocinadores_golmebol').update({ banners: lista }).eq('id', patro.id)
    if (error) { showMsg('Error al quitar el banner', 'error'); return }
    updateLocal(patro.id, 'banners', lista)
    const ruta = rutaDeUrl(url)
    if (ruta) await supabase.storage.from('patrocinadores').remove([ruta])
    showMsg('Banner quitado')
  }

  // Video: uno por patrocinador (si sube otro, reemplaza al anterior)
  async function handleVideo(patro, file) {
    if (!file || subiendoMedia) return
    if (!file.type.startsWith('video/')) { showMsg('Elige un archivo de video (mejor MP4)', 'error'); return }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      showMsg(`El video pesa ${(file.size / 1048576).toFixed(0)} MB y el máximo es ${MAX_VIDEO_MB} MB. Comprímelo y vuelve a subirlo`, 'error'); return
    }
    setSubiendoMedia(`${patro.id}:video`)
    try {
      const path = `video_${patro.id}_${Date.now()}.${extDe(file)}`
      const { error: upErr } = await supabase.storage.from('patrocinadores').upload(path, file, { contentType: file.type })
      if (upErr) { showMsg('Error al subir el video. Revisa que exista el almacenamiento "patrocinadores"', 'error'); return }
      const url = supabase.storage.from('patrocinadores').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('patrocinadores_golmebol').update({ video_url: url }).eq('id', patro.id)
      if (error) { showMsg('Falta ejecutar migracion_patrocinadores_video_banner.sql en Supabase', 'error'); return }
      const vieja = rutaDeUrl(patro.video_url)
      updateLocal(patro.id, 'video_url', url)
      if (vieja) await supabase.storage.from('patrocinadores').remove([vieja])
      showMsg('Video subido ✓')
    } finally {
      setSubiendoMedia(null)
    }
  }

  async function handleQuitarVideo(patro) {
    if (subiendoMedia) return
    const { error } = await supabase.from('patrocinadores_golmebol').update({ video_url: null }).eq('id', patro.id)
    if (error) { showMsg('Error al quitar el video', 'error'); return }
    const ruta = rutaDeUrl(patro.video_url)
    updateLocal(patro.id, 'video_url', null)
    if (ruta) await supabase.storage.from('patrocinadores').remove([ruta])
    showMsg('Video quitado')
  }

  function updateLocal(id, field, value) {
    setPatrocinadores(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)', textAlign: 'center', maxWidth: '90vw' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Patrocinadores oficiales</h1>
          <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>El banner que rota cada 5 segundos en la página de inicio pública. Al hacer clic en uno, la gente ve su info y puede escribirle por WhatsApp.</p>
        </div>
        <button onClick={handleAgregar} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '600' }}>
          <Plus size={16}/> Agregar patrocinador
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '48px', fontSize: '.875rem' }}>Cargando...</div>
      ) : patrocinadores.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '48px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px' }}>
          <Megaphone size={32} style={{ opacity: .3, marginBottom: '8px' }}/>
          <div>Todavía no hay patrocinadores. Agrega el primero arriba.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {patrocinadores.map(patro => (
            <div key={patro.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Megaphone size={16} color="#1a73e8"/>
                  <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{patro.nombre || 'Sin nombre'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={patro.activo} onChange={e => updateLocal(patro.id, 'activo', e.target.checked)} style={{ accentColor: '#1a73e8', width: '16px', height: '16px' }}/>
                    <span style={{ fontSize: '.8rem', color: patro.activo ? '#1e8e3e' : '#9aa0a6', fontWeight: '500' }}>
                      {patro.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </label>
                  <button onClick={() => handleEliminar(patro)} title="Eliminar" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#d93025' }}>
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'start' }}>
                <div>
                  <div style={{ width: '120px', height: '70px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '8px' }}>
                    {patro.logo_url ? (
                      <img src={patro.logo_url} alt={patro.nombre} style={{ maxWidth: '110px', maxHeight: '60px', objectFit: 'contain' }}/>
                    ) : (
                      <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>Sin logo</span>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                    <Upload size={12}/> {uploading === patro.id ? 'Subiendo...' : 'Subir logo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogo(patro, e.target.files[0])} disabled={uploading === patro.id}/>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Nombre del patrocinador</label>
                      <input value={patro.nombre || ''} onChange={e => updateLocal(patro.id, 'nombre', e.target.value)} style={inputStyle} placeholder="Ej: Tienda Deportiva El Gol"/>
                    </div>
                    <div>
                      <label style={labelStyle}>Orden</label>
                      <input type="number" value={patro.orden ?? 0} onChange={e => updateLocal(patro.id, 'orden', parseInt(e.target.value, 10) || 0)} style={{ ...inputStyle, width: '80px' }}/>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}><FaWhatsapp style={{ verticalAlign: '-2px', marginRight: '3px' }} color="#25d366"/>WhatsApp (con indicativo, ej: 573001234567)</label>
                    <input value={patro.whatsapp || ''} onChange={e => updateLocal(patro.id, 'whatsapp', e.target.value)} style={inputStyle} placeholder="573001234567"/>
                  </div>

                  <div>
                    <label style={labelStyle}>Dirección</label>
                    <input value={patro.direccion || ''} onChange={e => updateLocal(patro.id, 'direccion', e.target.value)} style={inputStyle} placeholder="Ej: Cra 14 # 5-30, Armenia"/>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}><FaFacebook style={{ verticalAlign: '-2px', marginRight: '3px' }} color="#1877f2"/>Facebook</label>
                      <input value={patro.facebook || ''} onChange={e => updateLocal(patro.id, 'facebook', e.target.value)} style={inputStyle} placeholder="https://facebook.com/..."/>
                    </div>
                    <div>
                      <label style={labelStyle}><FaInstagram style={{ verticalAlign: '-2px', marginRight: '3px' }} color="#e1306c"/>Instagram</label>
                      <input value={patro.instagram || ''} onChange={e => updateLocal(patro.id, 'instagram', e.target.value)} style={inputStyle} placeholder="https://instagram.com/..."/>
                    </div>
                    <div>
                      <label style={labelStyle}><FaTiktok style={{ verticalAlign: '-2px', marginRight: '3px' }}/>TikTok</label>
                      <input value={patro.tiktok || ''} onChange={e => updateLocal(patro.id, 'tiktok', e.target.value)} style={inputStyle} placeholder="https://tiktok.com/@..."/>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleSave(patro)} disabled={saving === patro.id}
                      style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: saving === patro.id ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: saving === patro.id ? .7 : 1 }}>
                      {saving === patro.id ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px dashed #dadce0' }}>
                <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124', marginBottom: '2px' }}>Publicidad para las transmisiones en vivo</div>
                <p style={{ margin: '0 0 12px', fontSize: '.75rem', color: '#5f6368' }}>Lo que subas aquí aparece como botones en el control de la transmisión (“Banner” y “Video”) para mostrarlo cuando tú quieras.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}><IconoImagen size={12} style={{ verticalAlign: '-2px', marginRight: '3px' }}/>Banners (cada uno sale 10 s; si hay varios salen todos, uno tras otro)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      {(patro.banners || []).map((url, i) => (
                        <div key={url} style={{ position: 'relative', width: '120px', height: '54px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '6px', overflow: 'hidden' }}>
                          <img src={url} alt={`Banner ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                          <button type="button" onClick={() => handleQuitarBanner(patro, url)} title="Quitar este banner"
                            style={{ position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', padding: 0 }}>
                            <X size={12}/>
                          </button>
                        </div>
                      ))}
                      {!(patro.banners || []).length && <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>Sin banners</span>}
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '5px 10px', cursor: subiendoMedia ? 'not-allowed' : 'pointer', opacity: subiendoMedia ? .6 : 1 }}>
                      <Upload size={12}/> {subiendoMedia === `${patro.id}:banner` ? 'Subiendo...' : 'Subir banners'}
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={!!subiendoMedia}
                        onChange={e => { handleBanners(patro, e.target.files); e.target.value = '' }}/>
                    </label>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>Imágenes horizontales (ej. 1280×360), máx. {MAX_BANNER_MB} MB cada una.</div>
                  </div>

                  <div>
                    <label style={labelStyle}><Film size={12} style={{ verticalAlign: '-2px', marginRight: '3px' }}/>Video (grande en el descanso, pequeño mientras se juega)</label>
                    {patro.video_url ? (
                      <div style={{ marginBottom: '8px' }}>
                        <video src={patro.video_url} controls preload="metadata" playsInline style={{ display: 'block', width: '100%', maxWidth: '260px', maxHeight: '150px', borderRadius: '6px', background: '#000' }}/>
                      </div>
                    ) : (
                      <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginBottom: '8px' }}>Sin video</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '5px 10px', cursor: subiendoMedia ? 'not-allowed' : 'pointer', opacity: subiendoMedia ? .6 : 1 }}>
                        <Upload size={12}/> {subiendoMedia === `${patro.id}:video` ? 'Subiendo video...' : patro.video_url ? 'Cambiar video' : 'Subir video'}
                        <input type="file" accept="video/*" style={{ display: 'none' }} disabled={!!subiendoMedia}
                          onChange={e => { handleVideo(patro, e.target.files[0]); e.target.value = '' }}/>
                      </label>
                      {patro.video_url && (
                        <button type="button" onClick={() => handleQuitarVideo(patro)} disabled={!!subiendoMedia}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#d93025', background: 'none', border: '1px solid #d93025', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer' }}>
                          <Trash2 size={12}/> Quitar video
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>MP4, máx. {MAX_VIDEO_MB} MB. Puede tardar un poco en subir.</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
