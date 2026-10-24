import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, X, Plus, Trash2, Film, Image as IconoImagen, ChevronDown, ChevronUp } from 'lucide-react'

// Publicidad de patrocinadores DE UNA TRANSMISIÓN (cada transmisión tiene los suyos).
// Por patrocinador: logo, banners (varios) y un video corto. Lo que se sube queda
// de una vez como botones ("Presenta", "Banner", "Video") en el panel de control
// de ESA transmisión.
//
// Los patrocinadores de la transmisión se guardan junto a su panel de control
// (site_config.en_vivo_control[idTransmisión].patrocinadores): no hace falta
// ninguna tabla nueva. Los archivos van al almacenamiento "patrocinadores", con
// nombre único por subida para que nunca se vea una versión vieja guardada en caché.
//
// props:
//  patrocinadores  lista actual de ESTA transmisión: [{ id, nombre, logo_url, banners[], video_url }]
//  onGuardar(lista)  guarda la lista nueva completa
const S = { card: '#161616', border: '#2a2a2a', green: '#6fcf3d', red: '#e5433d', text: '#fff', muted: '#9aa0a6' }
const BUCKET = 'patrocinadores'
const MAX_VIDEO_MB = 50
const MAX_BANNER_MB = 5

// Motivo real del error (para saber qué falta en vez de adivinar)
const motivo = (e) => (e && (e.message || e.error_description || e.error)) ? ` — ${e.message || e.error_description || e.error}${e.code ? ` [${e.code}]` : ''}` : ''

function rutaDeUrl(url) {
  if (!url) return null
  const i = url.indexOf(`/${BUCKET}/`)
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])
}
const extDe = (f) => (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
const urlPublica = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
const quitarArchivos = (urls) => {
  const rutas = urls.map(rutaDeUrl).filter(Boolean)
  return rutas.length ? supabase.storage.from(BUCKET).remove(rutas) : Promise.resolve()
}

// Subida con barra de progreso (supabase-js no avisa el avance). Mismo endpoint que usa supabase-js.
async function subirConProgreso(path, file, onProgreso) {
  const { data } = await supabase.auth.getSession()
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY
  const token = data?.session?.access_token || clave
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('apikey', clave)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve({ error: null }); return }
      let msg = `Error ${xhr.status}`
      try { const j = JSON.parse(xhr.responseText); msg = j.message || j.error || msg } catch { /* respuesta sin JSON */ }
      resolve({ error: { message: msg, code: String(xhr.status) } })
    }
    xhr.onerror = () => resolve({ error: { message: 'Se cortó la conexión mientras subía. Revisa tu internet y vuelve a intentar' } })
    xhr.ontimeout = () => resolve({ error: { message: 'Tardó demasiado en subir' } })
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', file)
    xhr.send(form)
  })
}

const mb = (f) => `${(f.size / 1048576).toFixed(1)} MB`

// Mensaje fijo debajo de cada botón de subir: no desaparece solo (el error y el "listo" se quedan hasta la próxima subida)
function Estado({ e }) {
  if (!e) return null
  const color = e.fase === 'ok' ? S.green : e.fase === 'error' ? '#ff8a84' : '#fff'
  const fondo = e.fase === 'ok' ? 'rgba(111,207,61,.14)' : e.fase === 'error' ? 'rgba(229,67,61,.18)' : '#1f1f1f'
  return (
    <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: fondo, color, fontSize: '.78rem', fontWeight: 700, lineHeight: 1.4 }}>
      {e.texto}
      {e.fase === 'subiendo' && (
        <div style={{ marginTop: '6px', height: '8px', borderRadius: '4px', background: '#333', overflow: 'hidden' }}>
          <div style={{ width: `${e.pct ?? 0}%`, height: '100%', background: S.green, transition: 'width .2s' }}/>
        </div>
      )}
    </div>
  )
}

const botonSubir = (deshabilitado) => ({
  display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#2a2a2a',
  border: `1px dashed ${S.green}`, borderRadius: '8px', color: S.green, fontSize: '.76rem', fontWeight: 700,
  cursor: deshabilitado ? 'not-allowed' : 'pointer', opacity: deshabilitado ? .6 : 1,
})

export default function PublicidadPatrocinadoresEnVivo({ patrocinadores, onGuardar }) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(null) // `${id}:logo|banner|video`
  const [aviso, setAviso] = useState(null)
  const [estado, setEstado] = useState({}) // por patrocinador y tipo: { fase: 'subiendo'|'ok'|'error', texto, pct }
  const poner = (clave, e) => setEstado(m => ({ ...m, [clave]: e }))
  const [nombreNuevo, setNombreNuevo] = useState('')

  function decir(text, tipo = 'ok') {
    setAviso({ text, tipo })
    setTimeout(() => setAviso(null), tipo === 'error' ? 7000 : 3000)
  }

  const cambiar = (id, cambios) => onGuardar(patrocinadores.map(p => p.id === id ? { ...p, ...cambios } : p))

  function agregar() {
    const nombre = nombreNuevo.trim()
    if (!nombre || ocupado) return
    onGuardar([...patrocinadores, { id: crypto.randomUUID(), nombre, logo_url: null, banners: [], video_url: null }])
    setNombreNuevo('')
    decir('Patrocinador agregado ✓ — ahora súbele logo, banners o video')
  }

  async function subirLogo(p, file) {
    if (!file || ocupado) return
    const k = `${p.id}:logo`
    if (!file.type.startsWith('image/')) { poner(k, { fase: 'error', texto: '✗ El logo debe ser una imagen (PNG, JPG…)' }); return }
    setOcupado(k)
    poner(k, { fase: 'subiendo', texto: `Subiendo logo (${mb(file)})…`, pct: 0 })
    try {
      const path = `logo_${p.id}_${Date.now()}.${extDe(file)}`
      const { error } = await subirConProgreso(path, file, pct => poner(k, { fase: 'subiendo', texto: `Subiendo logo… ${pct}%`, pct }))
      if (error) { poner(k, { fase: 'error', texto: '✗ NO se subió el logo' + motivo(error) }); return }
      const vieja = p.logo_url
      cambiar(p.id, { logo_url: urlPublica(path) })
      if (vieja) await quitarArchivos([vieja])
      poner(k, { fase: 'ok', texto: '✓ Logo subido y guardado' })
    } finally { setOcupado(null) }
  }

  async function subirBanners(p, lista) {
    const files = Array.from(lista || [])
    if (!files.length || ocupado) return
    const k = `${p.id}:banner`
    if (files.some(f => !f.type.startsWith('image/') || f.size > MAX_BANNER_MB * 1048576)) {
      poner(k, { fase: 'error', texto: `✗ Cada banner debe ser una imagen de máximo ${MAX_BANNER_MB} MB` }); return
    }
    setOcupado(k)
    try {
      const nuevas = []
      let fallo = null
      for (let i = 0; i < files.length; i++) {
        poner(k, { fase: 'subiendo', texto: `Subiendo banner ${i + 1} de ${files.length}…`, pct: 0 })
        const path = `banner_${p.id}_${Date.now()}_${i}.${extDe(files[i])}`
        const { error } = await subirConProgreso(path, files[i], pct => poner(k, { fase: 'subiendo', texto: `Subiendo banner ${i + 1} de ${files.length}… ${pct}%`, pct }))
        if (error) { fallo = error; break }
        nuevas.push(urlPublica(path))
      }
      if (nuevas.length) cambiar(p.id, { banners: [...(p.banners || []), ...nuevas] })
      if (fallo) poner(k, { fase: 'error', texto: `✗ ${nuevas.length ? `Se subieron ${nuevas.length}, pero uno` : 'El banner'} NO se subió` + motivo(fallo) })
      else poner(k, { fase: 'ok', texto: nuevas.length > 1 ? `✓ ${nuevas.length} banners subidos y guardados` : '✓ Banner subido y guardado' })
    } finally { setOcupado(null) }
  }

  async function quitarBanner(p, url) {
    if (ocupado) return
    cambiar(p.id, { banners: (p.banners || []).filter(u => u !== url) })
    await quitarArchivos([url])
  }

  async function subirVideo(p, file) {
    if (!file || ocupado) return
    const k = `${p.id}:video`
    if (!file.type.startsWith('video/')) { poner(k, { fase: 'error', texto: '✗ Elige un archivo de video (mejor MP4)' }); return }
    if (file.size > MAX_VIDEO_MB * 1048576) {
      poner(k, { fase: 'error', texto: `✗ El video pesa ${(file.size / 1048576).toFixed(0)} MB y el máximo es ${MAX_VIDEO_MB} MB. Comprímelo y vuelve a subirlo` }); return
    }
    setOcupado(k)
    poner(k, { fase: 'subiendo', texto: `Subiendo video (${mb(file)})… 0%`, pct: 0 })
    try {
      const path = `video_${p.id}_${Date.now()}.${extDe(file)}`
      const { error } = await subirConProgreso(path, file, pct => poner(k, { fase: 'subiendo', texto: `Subiendo video (${mb(file)})… ${pct}%${pct >= 100 ? ' — guardando, espera' : ''}`, pct }))
      if (error) { poner(k, { fase: 'error', texto: '✗ NO se subió el video' + motivo(error) }); return }
      const vieja = p.video_url
      cambiar(p.id, { video_url: urlPublica(path) })
      if (vieja) await quitarArchivos([vieja])
      poner(k, { fase: 'ok', texto: `✓ Video subido y guardado (${mb(file)}). Ya sale el botón "Video" arriba en el panel` })
    } finally { setOcupado(null) }
  }

  async function quitarVideo(p) {
    if (ocupado) return
    const vieja = p.video_url
    poner(`${p.id}:video`, null)
    cambiar(p.id, { video_url: null })
    await quitarArchivos([vieja])
  }

  async function eliminar(p) {
    if (ocupado) return
    if (!confirm(`¿Quitar "${p.nombre}" de esta transmisión? Se borran también sus archivos.`)) return
    onGuardar(patrocinadores.filter(x => x.id !== p.id))
    await quitarArchivos([p.logo_url, p.video_url, ...(p.banners || [])].filter(Boolean))
  }

  return (
    <div style={{ background: '#0a0a0a', border: `1px solid ${S.border}`, borderRadius: '10px', padding: '12px 14px', marginTop: '14px' }}>
      <button type="button" onClick={() => setAbierto(a => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', color: S.text, padding: 0, textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '.8rem' }}>
          <Film size={15} color={S.green}/> PATROCINADORES DE ESTA TRANSMISIÓN — subir logo, banners y video
          {patrocinadores.length > 0 && <span style={{ color: S.muted, fontWeight: 600 }}>({patrocinadores.length})</span>}
        </span>
        {abierto ? <ChevronUp size={18} color={S.muted}/> : <ChevronDown size={18} color={S.muted}/>}
      </button>

      {abierto && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '.74rem', color: S.muted, marginBottom: '10px' }}>
            Estos patrocinadores son solo de esta transmisión. Lo que subas queda como botones en el panel de control de arriba.
          </div>
          {aviso && (
            <div style={{ padding: '9px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '.8rem', background: aviso.tipo === 'ok' ? 'rgba(111,207,61,.15)' : 'rgba(229,67,61,.18)', color: aviso.tipo === 'ok' ? S.green : '#ff8a84' }}>
              {aviso.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} placeholder="Nombre del patrocinador"
              onKeyDown={e => { if (e.key === 'Enter') agregar() }}
              style={{ flex: '1 1 180px', minWidth: 0, background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '9px 12px', color: '#202124', fontSize: '.85rem', outline: 'none', boxSizing: 'border-box' }}/>
            <button type="button" onClick={agregar} disabled={!nombreNuevo.trim() || !!ocupado}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '9px 14px', background: S.green, border: 'none', borderRadius: '8px', color: '#0a0a0a', fontSize: '.8rem', fontWeight: 800, cursor: nombreNuevo.trim() && !ocupado ? 'pointer' : 'not-allowed', opacity: nombreNuevo.trim() && !ocupado ? 1 : .5 }}>
              <Plus size={14}/> Agregar
            </button>
          </div>

          {patrocinadores.length === 0 && (
            <div style={{ fontSize: '.8rem', color: S.muted, padding: '4px 0' }}>Esta transmisión todavía no tiene patrocinadores. Escribe el nombre arriba y toca Agregar.</div>
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
                    <button type="button" onClick={() => eliminar(p)} title="Quitar este patrocinador de la transmisión"
                      style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: '4px' }}><Trash2 size={15}/></button>
                  </div>
                  <div style={{ marginTop: '-6px', marginBottom: '10px' }}><Estado e={estado[`${p.id}:logo`]}/></div>

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
                  <div style={{ marginTop: '-8px', marginBottom: '12px' }}><Estado e={estado[`${p.id}:banner`]}/></div>

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
                  <Estado e={estado[`${p.id}:video`]}/>
                  {p.video_url && !estado[`${p.id}:video`] && (
                    <div style={{ marginTop: '8px', fontSize: '.74rem', color: S.green, fontWeight: 700 }}>✓ Este patrocinador ya tiene video guardado</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
