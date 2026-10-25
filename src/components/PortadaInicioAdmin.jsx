import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Image as IconoImagen, Upload, Trash2, Monitor, Smartphone } from 'lucide-react'

// Portada de la página de inicio (imagen de fondo de la parte de arriba de golmebol.com).
// Se guarda en site_config.portada_inicio = { url, url_movil } (ver migracion_site_config_portada_inicio.sql):
//   · url        → foto para computador (ancha, 3:1)
//   · url_movil  → foto para celular (vertical, 3:4)
// Si solo se sube una, se usa en las dos. Los archivos van al almacenamiento "patrocinadores".
// La foto se reduce antes de subirla (máx. 2400 px de ancho la de computador y 1080 px la de celular),
// para que la página de inicio cargue rápido aunque se suba una foto grande del celular.
const BUCKET = 'patrocinadores'

const SLOTS = [
  {
    campo: 'url', prefijo: 'inicio_pc', ancho: 2400, Icono: Monitor,
    titulo: 'Foto para COMPUTADOR', medida: '2400 × 800 px', forma: 'ancha, 3:1',
    ayuda: 'Una foto panorámica. Pon lo importante en el centro.',
    prev: { w: 300, h: 100 },
  },
  {
    campo: 'url_movil', prefijo: 'inicio_movil', ancho: 1080, Icono: Smartphone,
    titulo: 'Foto para CELULAR', medida: '1080 × 1440 px', forma: 'vertical, 3:4',
    ayuda: 'Una foto vertical, como las del celular. Aquí se ve la mayor parte de la gente.',
    prev: { w: 108, h: 144 },
  },
]

function rutaDeUrl(url) {
  if (!url) return null
  const i = url.indexOf(`/${BUCKET}/`)
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])
}

// Reduce y comprime la foto a JPG (calidad 0.85). Si el navegador no puede, sube el archivo tal cual.
async function reducirFoto(file, anchoMax) {
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, anchoMax / bmp.width)
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return blob ? { blob, ext: 'jpg', tipo: 'image/jpeg' } : { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), tipo: file.type }
  } catch {
    return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), tipo: file.type }
  }
}

const sinColumna = (m) => /does not exist|column/.test(m || '')
const AVISO_MIGRACION = '⚠️ Falta correr migracion_site_config_portada_inicio.sql en Supabase'

export default function PortadaInicioAdmin() {
  const [portada, setPortada] = useState({ url: null, url_movil: null })
  const [subiendo, setSubiendo] = useState(null) // campo que se está subiendo
  const [aviso, setAviso] = useState(null) // { texto, tipo }

  useEffect(() => {
    supabase.from('site_config').select('portada_inicio').eq('id', true).maybeSingle().then(({ data, error }) => {
      if (error) { setAviso({ texto: sinColumna(error.message) ? AVISO_MIGRACION : 'No se pudo leer la portada', tipo: 'error' }); return }
      const p = data?.portada_inicio || {}
      setPortada({ url: p.url || null, url_movil: p.url_movil || null })
    })
  }, [])

  async function guardar(valor) {
    const hay = valor.url || valor.url_movil
    const { error } = await supabase.from('site_config').upsert({ id: true, portada_inicio: hay ? valor : null, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    return error
  }

  async function subir(slot, file) {
    if (!file || subiendo) return
    if (!file.type.startsWith('image/')) { setAviso({ texto: 'Elige una imagen (JPG, PNG o WebP)', tipo: 'error' }); return }
    setSubiendo(slot.campo); setAviso(null)
    try {
      const { blob, ext, tipo } = await reducirFoto(file, slot.ancho)
      const path = `portada/${slot.prefijo}_${Date.now()}.${ext}`
      const { error: errSubida } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: tipo, upsert: false })
      if (errSubida) { setAviso({ texto: 'No se pudo subir la imagen — ' + errSubida.message, tipo: 'error' }); return }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      const nuevo = { ...portada, [slot.campo]: url }
      const errGuardar = await guardar(nuevo)
      if (errGuardar) { setAviso({ texto: sinColumna(errGuardar.message) ? AVISO_MIGRACION : 'Se subió, pero no se pudo guardar — ' + errGuardar.message, tipo: 'error' }); return }
      const vieja = rutaDeUrl(portada[slot.campo])
      setPortada(nuevo)
      if (vieja) await supabase.storage.from(BUCKET).remove([vieja])
      setAviso({ texto: '✓ Guardada. Ya se ve en la página de inicio.', tipo: 'ok' })
    } finally { setSubiendo(null) }
  }

  async function quitar(slot) {
    if (!portada[slot.campo] || subiendo) return
    if (!confirm('¿Quitar esta foto? Si no queda ninguna, la página de inicio vuelve al diseño oscuro de siempre.')) return
    const nuevo = { ...portada, [slot.campo]: null }
    const error = await guardar(nuevo)
    if (error) { setAviso({ texto: 'No se pudo quitar — ' + error.message, tipo: 'error' }); return }
    const vieja = rutaDeUrl(portada[slot.campo])
    setPortada(nuevo)
    if (vieja) await supabase.storage.from(BUCKET).remove([vieja])
    setAviso({ texto: 'Foto quitada', tipo: 'ok' })
  }

  const hayAlguna = !!(portada.url || portada.url_movil)

  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#202124', fontSize: '1rem', marginBottom: '4px' }}>
        <IconoImagen size={18} color="#1a73e8"/> Portada de la página de inicio
      </div>
      <p style={{ color: '#5f6368', margin: '0 0 12px', fontSize: '.8rem', lineHeight: 1.5 }}>
        Es la foto de fondo de la parte de arriba de golmebol.com, con los botones encima. Para que se vea bien en las dos pantallas, sube DOS fotos: una ancha para computador y una vertical para celular. Usa fotos limpias, SIN letras (de un partido, una final, la cancha). Si solo subes una, se usa en las dos. Si no subes ninguna, queda el diseño oscuro de siempre.
      </p>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {SLOTS.map(slot => {
          const url = portada[slot.campo]
          const ocupado = subiendo === slot.campo
          return (
            <div key={slot.campo} style={{ flex: '1 1 260px', border: '1px solid #e8eaed', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '.82rem', color: '#202124' }}>
                <slot.Icono size={15} color="#1a73e8"/> {slot.titulo}
              </div>
              <div style={{ background: '#e8f0fe', border: '1px solid #c6dafc', borderRadius: '8px', padding: '8px 10px', margin: '8px 0', fontSize: '.76rem', lineHeight: 1.5, color: '#174ea6' }}>
                <b>{slot.medida}</b> ({slot.forma}) · JPG o PNG<br/>{slot.ayuda}
              </div>
              <div style={{ position: 'relative', width: slot.prev.w, height: slot.prev.h, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e8eaed', background: '#f1f3f4', marginBottom: '10px', ...(url ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }}>
                {url ? (
                  <>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, rgba(10,10,10,.12) 0%, rgba(10,10,10,.12) 45%, rgba(10,10,10,.7) 80%, #0a0a0a 100%)' }}/>
                    <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', display: 'flex', gap: 3 }}>
                      <span style={{ width: slot.prev.w > 200 ? 34 : 22, height: 7, borderRadius: 2, background: '#6cd63a' }}/>
                      <span style={{ width: slot.prev.w > 200 ? 30 : 20, height: 7, borderRadius: 2, border: '1px solid rgba(255,255,255,.5)' }}/>
                    </div>
                  </>
                ) : (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6', fontSize: '.7rem', textAlign: 'center', padding: 6 }}>
                    {portada[slot.campo === 'url' ? 'url_movil' : 'url'] ? 'Usa la otra foto' : 'Sin foto'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#1a73e8', color: '#fff', borderRadius: '8px', fontSize: '.82rem', fontWeight: 600, cursor: subiendo ? 'not-allowed' : 'pointer', opacity: subiendo && !ocupado ? .6 : 1 }}>
                  <Upload size={14}/> {ocupado ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={!!subiendo} onChange={e => { subir(slot, e.target.files[0]); e.target.value = '' }}/>
                </label>
                {url && (
                  <button type="button" onClick={() => quitar(slot)} disabled={!!subiendo}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'none', border: '1px solid #d93025', color: '#d93025', borderRadius: '8px', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer' }}>
                    <Trash2 size={13}/> Quitar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {hayAlguna && !(portada.url && portada.url_movil) && (
        <div style={{ marginTop: '12px', fontSize: '.78rem', color: '#5f6368' }}>
          Solo hay una foto: se usa en computador y en celular. Sube la otra para que cada pantalla tenga la suya.
        </div>
      )}
      {aviso && (
        <div style={{ marginTop: '12px', padding: '9px 12px', borderRadius: '8px', fontSize: '.82rem', fontWeight: 600, background: aviso.tipo === 'ok' ? '#e6f4ea' : '#fce8e6', color: aviso.tipo === 'ok' ? '#1e8e3e' : '#d93025' }}>{aviso.texto}</div>
      )}
    </div>
  )
}
