import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, X, Plus, Trash2, Film, Image as IconoImagen, ChevronDown, ChevronUp } from 'lucide-react'

// Cargar la publicidad de los patrocinadores DESDE la página de En vivo:
// logo, banners (varios) y video corto de cada patrocinador, y agregar
// patrocinadores nuevos. Lo que se sube queda de una vez como botones
// ("Presenta", "Banner", "Video") en el panel de control de la transmisión.
//
// Los archivos van al almacenamiento "patrocinadores" (el mismo del admin de
// patrocinadores), con nombre único por subida para que nunca se vea una
// versión vieja guardada en caché.
//
// props:
//  patrocinadores  lista actual (patrocinadores_golmebol, activos)
//  onCambio(id, cambios)  actualiza un patrocinador en la lista de la página
//  onNuevo(patrocinador)  agrega uno nuevo a la lista de la página
//  onQuitar(id)           lo saca de la lista (se desactivó)
const S = { card: '#161616', border: '#2a2a2a', green: '#6fcf3d', red: '#e5433d', text: '#fff', muted: '#9aa0a6' }
const BUCKET = 'patrocinadores'
const MAX_VIDEO_MB = 50
const MAX_BANNER_MB = 5

// Motivo real del error (para saber qué falta en Supabase en vez de adivinar)
const motivo = (e) => (e && (e.message || e.error_description || e.error)) ? ` — ${e.message || e.error_description || e.error}${e.code ? ` [${e.code}]` : ''}` : ''

function rutaDeUrl(url) {
  if (!url) return null
  const i = url.indexOf(`/${BUCKET}/`)
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])
}
const extDe = (f) => (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
const urlPublica = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

const botonSubir = (deshabilitado) => ({
  display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#2a2a2a',
  border: `1px dashed ${S.green}`, borderRadius: '8px', color: S.green, fontSize: '.76rem', fontWeight: 700,
  cursor: deshabilitado ? 'not-allowed' : 'pointer', opacity: deshabilitado ? .6 : 1,
})

export default function PublicidadPatrocinadoresEnVivo({ patrocinadores, onCambio, onNuevo, onQuitar }) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(null) // `${id}:logo|banner|video` o 'nuevo'
  const [aviso, setAviso] = useState(null)
  const [nombreNuevo, setNombreNuevo] = useState('')

  function decir(text, tipo = 'ok') {
    setAviso({ text, tipo })
    setTimeout(() => setAviso(null), tipo === 'error' ? 7000 : 3000)
  }

  async function agregar() {
    const nombre = nombreNuevo.trim()
    if (!nombre || ocupado) return
    setOcupado('nuevo')
    try {
      const orden = patrocinadores.reduce((m, p) => Math.max(m, p.orden || 0), 0) + 1
      const { data, error } = await supabase.from('patrocinadores_golmebol')
        .insert({ nombre, orden, activo: true }).select().single()
      if (error) { decir('No se pudo crear el patrocinador' + motivo(error), 'error'); return }
      onNuevo(data)
      setNombreNuevo('')
      decir('Patrocinador agregado ✓ — ahora súbele logo, banners o video')
    } finally { setOcupado(null) }
  }

  async function subirLogo(p, file) {
    if (!file || ocupado) return
    if (!file.type.startsWith('image/')) { decir('El logo debe ser una imagen', 'error'); return }
    setOcupado(`${p.id}:logo`)
    try {
      const path = `logo_${p.id}_${Date.now()}.${extDe(file)}`
      const { error: e1 } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (e1) { decir('Error al subir el logo' + motivo(e1), 'error'); return }
      const url = urlPublica(path)
      const { error: e2 } = await supabase.from('patrocinadores_golmebol').update({ logo_url: url }).eq('id', p.id)
      if (e2) { decir('Error al guardar el logo' + motivo(e2), 'error'); return }
      const vieja = rutaDeUrl(p.logo_url)
      onCambio(p.id, { logo_url: url })
      if (vieja) await supabase.storage.from(BUCKET).remove([vieja])
      decir('Logo subido ✓')
    } finally { setOcupado(null) }
  }

  async function subirBanners(p, lista) {
    const files = Array.from(lista || [])
    if (!files.length || ocupado) return
    if (files.some(f => !f.type.startsWith('image/') || f.size > MAX_BANNER_MB * 1048576)) {
      decir(`Cada banner debe ser una imagen de máximo ${MAX_BANNER_MB} MB`, 'error'); return
    }
    setOcupado(`${p.id}:banner`)
    try {
      const nuevas = []
      for (let i = 0; i < files.length; i++) {
        const path = `banner_${p.id}_${Date.now()}_${i}.${extDe(files[i])}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, files[i], { contentType: files[i].type })
        if (error) { decir('Error al subir un banner' + motivo(error), 'error'); break }
        nuevas.push(urlPublica(path))
      }
      if (!nuevas.length) return
      const todos = [...(p.banners || []), ...nuevas]
      const { error } = await supabase.from('patrocinadores_golmebol').update({ banners: todos }).eq('id', p.id)
      if (error) { decir('No se pudo guardar' + motivo(error), 'error'); return }
      onCambio(p.id, { banners: todos })
      decir(nuevas.length > 1 ? `${nuevas.length} banners subidos ✓` : 'Banner subido ✓')
    } finally { setOcupado(null) }
  }

  async function quitarBanner(p, url) {
    if (ocupado) return
    const todos = (p.banners || []).filter(u => u !== url)
    const { error } = await supabase.from('patrocinadores_golmebol').update({ banners: todos }).eq('id', p.id)
    if (error) { decir('Error al quitar el banner' + motivo(error), 'error'); return }
    onCambio(p.id, { banners: todos })
    const ruta = rutaDeUrl(url)
    if (ruta) await supabase.storage.from(BUCKET).remove([ruta])
  }

  async function subirVideo(p, file) {
    if (!file || ocupado) return
    if (!file.type.startsWith('video/')) { decir('Elige un archivo de video (mejor MP4)', 'error'); return }
    if (file.size > MAX_VIDEO_MB * 1048576) {
      decir(`El video pesa ${(file.size / 1048576).toFixed(0)} MB y el máximo es ${MAX_VIDEO_MB} MB. Comprímelo y vuelve a subirlo`, 'error'); return
    }
    setOcupado(`${p.id}:video`)
    try {
      const path = `video_${p.id}_${Date.now()}.${extDe(file)}`
      const { error: e1 } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (e1) { decir('Error al subir el video' + motivo(e1), 'error'); return }
      const url = urlPublica(path)
      const { error: e2 } = await supabase.from('patrocinadores_golmebol').update({ video_url: url }).eq('id', p.id)
      if (e2) { decir('No se pudo guardar' + motivo(e2), 'error'); return }
      const vieja = rutaDeUrl(p.video_url)
      onCambio(p.id, { video_url: url })
      if (vieja) await supabase.storage.from(BUCKET).remove([vieja])
      decir('Video subido ✓')
    } finally { setOcupado(null) }
  }

  async function quitarVideo(p) {
    if (ocupado) return
    const { error } = await supabase.from('patrocinadores_golmebol').update({ video_url: null }).eq('id', p.id)
    if (error) { decir('Error al quitar el video' + motivo(error), 'error'); return }
    const ruta = rutaDeUrl(p.video_url)
    onCambio(p.id, { video_url: null })
    if (ruta) await supabase.storage.from(BUCKET).remove([ruta])
  }

  async function ocultar(p) {
    if (ocupado) return
    if (!confirm(`¿Ocultar "${p.nombre}" de los botones? (No se borra: puedes volver a activarlo en Patrocinadores.)`)) return
    const { error } = await supabase.from('patrocinadores_golmebol').update({ activo: false }).eq('id', p.id)
    if (error) { decir('Error al ocultar' + motivo(error), 'error'); return }
    onQuitar(p.id)
  }

  return (
    <div style={{ background: '#0a0a0a', border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
      <button type="button" onClick={() => setAbierto(a => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', color: S.text, padding: 0, textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '.95rem' }}>
          <Film size={16} color={S.green}/> Publicidad de patrocinadores (videos y banners)
        </span>
        {abierto ? <ChevronUp size={18} color={S.muted}/> : <ChevronDown size={18} color={S.muted}/>}
      </button>
      <div style={{ fontSize: '.78rem', color: S.muted, marginTop: '4px' }}>
        Sube aquí el logo, los banners y el video de cada patrocinador. Quedan como botones en el panel de control de la transmisión.
      </div>

      {abierto && (
        <div style={{ marginTop: '14px' }}>
          {aviso && (
            <div style={{ padding: '9px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '.8rem', background: aviso.tipo === 'ok' ? 'rgba(111,207,61,.15)' : 'rgba(229,67,61,.18)', color: aviso.tipo === 'ok' ? S.green : '#ff8a84' }}>
              {aviso.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} placeholder="Nombre del patrocinador nuevo"
              onKeyDown={e => { if (e.key === 'Enter') agregar() }}
              style={{ flex: '1 1 180px', minWidth: 0, background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '9px 12px', color: '#202124', fontSize: '.85rem', outline: 'none', boxSizing: 'border-box' }}/>
            <button type="button" onClick={agregar} disabled={!nombreNuevo.trim() || !!ocupado}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '9px 14px', background: S.green, border: 'none', borderRadius: '8px', color: '#0a0a0a', fontSize: '.8rem', fontWeight: 800, cursor: nombreNuevo.trim() && !ocupado ? 'pointer' : 'not-allowed', opacity: nombreNuevo.trim() && !ocupado ? 1 : .5 }}>
              <Plus size={14}/> {ocupado === 'nuevo' ? 'Agregando...' : 'Agregar'}
            </button>
          </div>

          {patrocinadores.length === 0 && (
            <div style={{ fontSize: '.8rem', color: S.muted, padding: '8px 0' }}>Todavía no hay patrocinadores activos. Escribe el nombre arriba y toca Agregar.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {patrocinadores.map(p => {
              const banners = Array.isArray(p.banners) ? p.banners.filter(Boolean) : []
              const sub = (t) => ocupado === `${p.id}:${t}`
              return (
                <div key={p.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {p.logo_url ? <img src={p.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }}/> : <span style={{ fontSize: '.55rem', color: '#9aa0a6' }}>Sin logo</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, color: S.text, fontWeight: 800, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                    <label style={botonSubir(!!ocupado)}>
                      <Upload size={12}/> {sub('logo') ? 'Subiendo...' : p.logo_url ? 'Cambiar logo' : 'Subir logo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={!!ocupado}
                        onChange={e => { subirLogo(p, e.target.files[0]); e.target.value = '' }}/>
                    </label>
                    <button type="button" onClick={() => ocultar(p)} title="Ocultar de los botones"
                      style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: '4px' }}><Trash2 size={15}/></button>
                  </div>

                  <div style={{ fontSize: '.7rem', color: S.muted, fontWeight: 600, marginBottom: '6px' }}>
                    <IconoImagen size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }}/>BANNERS — cada uno sale 10 s; si hay varios salen todos solos, uno tras otro
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
                    {banners.map((url, i) => (
                      <div key={url} style={{ position: 'relative', width: '110px', height: '50px', background: '#222', border: `1px solid ${S.border}`, borderRadius: '6px', overflow: 'hidden' }}>
                        <img src={url} alt={`Banner ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                        <button type="button" onClick={() => quitarBanner(p, url)} title="Quitar este banner"
                          style={{ position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', padding: 0 }}><X size={12}/></button>
                      </div>
                    ))}
                    <label style={botonSubir(!!ocupado)}>
                      <Upload size={12}/> {sub('banner') ? 'Subiendo...' : 'Subir banners'}
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={!!ocupado}
                        onChange={e => { subirBanners(p, e.target.files); e.target.value = '' }}/>
                    </label>
                  </div>

                  <div style={{ fontSize: '.7rem', color: S.muted, fontWeight: 600, marginBottom: '6px' }}>
                    <Film size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }}/>VIDEO — grande en el descanso, pequeño mientras se juega (MP4, máx. {MAX_VIDEO_MB} MB)
                  </div>
                  {p.video_url && (
                    <video src={p.video_url} controls preload="metadata" playsInline
                      style={{ display: 'block', width: '100%', maxWidth: '260px', maxHeight: '150px', borderRadius: '6px', background: '#000', marginBottom: '8px' }}/>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <label style={botonSubir(!!ocupado)}>
                      <Upload size={12}/> {sub('video') ? 'Subiendo video... (puede tardar)' : p.video_url ? 'Cambiar video' : 'Subir video'}
                      <input type="file" accept="video/*" style={{ display: 'none' }} disabled={!!ocupado}
                        onChange={e => { subirVideo(p, e.target.files[0]); e.target.value = '' }}/>
                    </label>
                    {p.video_url && (
                      <button type="button" onClick={() => quitarVideo(p)} disabled={!!ocupado}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: 'none', border: `1px solid ${S.red}`, borderRadius: '8px', color: '#ff8a84', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        <Trash2 size={12}/> Quitar video
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
