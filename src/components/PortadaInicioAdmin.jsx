import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Image as IconoImagen, Upload, Trash2 } from 'lucide-react'

// Portada de la página de inicio (imagen de fondo de la parte de arriba de golmebol.com).
// Se guarda en site_config.portada_inicio = { url } (ver migracion_site_config_portada_inicio.sql) y el archivo
// va al almacenamiento "patrocinadores". La foto se reduce a máximo 1920 px de ancho antes de subirla,
// para que la página de inicio cargue rápido aunque se suba una foto grande del celular.
const BUCKET = 'patrocinadores'
const ANCHO_MAX = 1920

function rutaDeUrl(url) {
  if (!url) return null
  const i = url.indexOf(`/${BUCKET}/`)
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])
}

// Reduce y comprime la foto a JPG (calidad 0.85). Si el navegador no puede, sube el archivo tal cual.
async function reducirFoto(file) {
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, ANCHO_MAX / bmp.width)
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return blob ? { blob, ext: 'jpg', tipo: 'image/jpeg' } : { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), tipo: file.type }
  } catch {
    return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), tipo: file.type }
  }
}

export default function PortadaInicioAdmin() {
  const [portada, setPortada] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState(null) // { texto, tipo }

  useEffect(() => {
    supabase.from('site_config').select('portada_inicio').eq('id', true).maybeSingle().then(({ data, error }) => {
      if (error) { setAviso({ texto: /does not exist|column/.test(error.message || '') ? '⚠️ Falta correr migracion_site_config_portada_inicio.sql en Supabase' : 'No se pudo leer la portada', tipo: 'error' }); return }
      setPortada(data?.portada_inicio?.url ? data.portada_inicio : null)
    })
  }, [])

  async function guardar(valor) {
    const { error } = await supabase.from('site_config').upsert({ id: true, portada_inicio: valor, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    return error
  }

  async function subir(file) {
    if (!file || subiendo) return
    if (!file.type.startsWith('image/')) { setAviso({ texto: 'Elige una imagen (JPG, PNG o WebP)', tipo: 'error' }); return }
    setSubiendo(true); setAviso(null)
    try {
      const { blob, ext, tipo } = await reducirFoto(file)
      const path = `portada/inicio_${Date.now()}.${ext}`
      const { error: errSubida } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: tipo, upsert: false })
      if (errSubida) { setAviso({ texto: 'No se pudo subir la imagen — ' + errSubida.message, tipo: 'error' }); return }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      const errGuardar = await guardar({ url })
      if (errGuardar) { setAviso({ texto: /does not exist|column/.test(errGuardar.message || '') ? '⚠️ Falta correr migracion_site_config_portada_inicio.sql en Supabase' : 'Se subió, pero no se pudo guardar — ' + errGuardar.message, tipo: 'error' }); return }
      const vieja = rutaDeUrl(portada?.url)
      setPortada({ url })
      if (vieja) await supabase.storage.from(BUCKET).remove([vieja])
      setAviso({ texto: '✓ Portada guardada. Ya se ve en la página de inicio.', tipo: 'ok' })
    } finally { setSubiendo(false) }
  }

  async function quitar() {
    if (!portada?.url || subiendo) return
    if (!confirm('¿Quitar la portada? La página de inicio vuelve al diseño oscuro de siempre.')) return
    const error = await guardar(null)
    if (error) { setAviso({ texto: 'No se pudo quitar — ' + error.message, tipo: 'error' }); return }
    const vieja = rutaDeUrl(portada.url)
    setPortada(null)
    if (vieja) await supabase.storage.from(BUCKET).remove([vieja])
    setAviso({ texto: 'Portada quitada', tipo: 'ok' })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#202124', fontSize: '1rem', marginBottom: '4px' }}>
        <IconoImagen size={18} color="#1a73e8"/> Portada de la página de inicio
      </div>
      <p style={{ color: '#5f6368', margin: '0 0 14px', fontSize: '.8rem', lineHeight: 1.5 }}>
        Es la imagen de fondo de la parte de arriba de golmebol.com, detrás del título y los botones. Usa una foto horizontal y de buena calidad (de un partido, una final, la cancha). Se oscurece sola para que el texto se lea; si no subes ninguna, queda el diseño oscuro de siempre.
      </p>
      {portada?.url && (
        <div style={{ position: 'relative', maxWidth: '520px', aspectRatio: '16 / 7', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e8eaed', marginBottom: '12px', backgroundImage: `url(${portada.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, rgba(10,10,10,.5), rgba(10,10,10,.85))' }}/>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: 'center', color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>Así se ve detrás del título</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#1a73e8', color: '#fff', borderRadius: '8px', fontSize: '.85rem', fontWeight: 600, cursor: subiendo ? 'not-allowed' : 'pointer', opacity: subiendo ? .6 : 1 }}>
          <Upload size={15}/> {subiendo ? 'Subiendo…' : portada?.url ? 'Cambiar portada' : 'Subir portada'}
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={subiendo} onChange={e => { subir(e.target.files[0]); e.target.value = '' }}/>
        </label>
        {portada?.url && (
          <button type="button" onClick={quitar} disabled={subiendo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'none', border: '1px solid #d93025', color: '#d93025', borderRadius: '8px', fontSize: '.85rem', fontWeight: 600, cursor: 'pointer' }}>
            <Trash2 size={14}/> Quitar portada
          </button>
        )}
      </div>
      {aviso && (
        <div style={{ marginTop: '12px', padding: '9px 12px', borderRadius: '8px', fontSize: '.82rem', fontWeight: 600, background: aviso.tipo === 'ok' ? '#e6f4ea' : '#fce8e6', color: aviso.tipo === 'ok' ? '#1e8e3e' : '#d93025' }}>{aviso.texto}</div>
      )}
    </div>
  )
}
