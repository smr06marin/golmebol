import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, Trash2, Film, ChevronDown, ChevronUp } from 'lucide-react'

// Jugadas (videos de repetición ya grabados) DE UNA TRANSMISIÓN, para el descanso.
// En el descanso, después del marcador grande y la tabla, el overlay pasa solo:
// jugada (2 veces) → video de un patrocinador → otra jugada (2 veces) → otro
// patrocinador… (ver IntermedioDescansoOverlay). Los patrocinadores salen una vez cada
// uno; las jugadas siguen turnándose.
//
// Se guardan junto al panel de control de la transmisión
// (site_config.en_vivo_control[idTransmisión].jugadas = [{ id, url, nombre }]): no hace falta
// ninguna tabla nueva. Los archivos van al almacenamiento "patrocinadores" (el mismo de los
// videos de patrocinadores, así que valen sus mismos permisos y tipos de video).
//
// props:
//  jugadas      lista actual de ESTA transmisión
//  onGuardar(lista)  guarda la lista nueva completa
const S = { card: '#161616', border: '#2a2a2a', green: '#6fcf3d', red: '#e5433d', text: '#fff', muted: '#9aa0a6' }
const BUCKET = 'patrocinadores'
const MAX_VIDEO_MB = 50

const motivo = (e) => (e && (e.message || e.error_description || e.error)) ? ` — ${e.message || e.error_description || e.error}${e.code ? ` [${e.code}]` : ''}` : ''
const extDe = (f) => (f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4'
const urlPublica = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
const mb = (f) => `${(f.size / 1048576).toFixed(1)} MB`
function rutaDeUrl(url) {
  if (!url) return null
  const i = url.indexOf(`/${BUCKET}/`)
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])
}

// Subida con barra de progreso (mismo endpoint que usa supabase-js)
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

export default function JugadasDescansoEnVivo({ jugadas, onGuardar }) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [estado, setEstado] = useState(null) // { fase: 'subiendo'|'ok'|'error', texto, pct }

  async function subir(lista) {
    const files = Array.from(lista || [])
    if (!files.length || ocupado) return
    const malos = files.filter(f => !f.type.startsWith('video/') || f.size > MAX_VIDEO_MB * 1048576)
    if (malos.length) {
      setEstado({ fase: 'error', texto: `✗ Cada jugada debe ser un video (mejor MP4) de máximo ${MAX_VIDEO_MB} MB. Revisa: ${malos.map(f => f.name).join(', ')}` })
      return
    }
    setOcupado(true)
    const nuevas = []
    let fallo = null
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        setEstado({ fase: 'subiendo', texto: `Subiendo jugada ${i + 1} de ${files.length} (${mb(f)})… 0%`, pct: 0 })
        const id = crypto.randomUUID()
        const path = `jugada_${id}_${Date.now()}.${extDe(f)}`
        const { error } = await subirConProgreso(path, f, pct => setEstado({ fase: 'subiendo', texto: `Subiendo jugada ${i + 1} de ${files.length} (${mb(f)})… ${pct}%${pct >= 100 ? ' — guardando, espera' : ''}`, pct }))
        if (error) { fallo = error; break }
        nuevas.push({ id, url: urlPublica(path), nombre: f.name.replace(/\.[^.]+$/, '').slice(0, 60) })
      }
      if (nuevas.length) onGuardar([...jugadas, ...nuevas])
      if (fallo) setEstado({ fase: 'error', texto: `✗ ${nuevas.length ? `Se subieron ${nuevas.length}, pero una` : 'La jugada'} NO se subió` + motivo(fallo) })
      else setEstado({ fase: 'ok', texto: nuevas.length > 1 ? `✓ ${nuevas.length} jugadas subidas y guardadas` : '✓ Jugada subida y guardada' })
    } finally { setOcupado(false) }
  }

  async function quitar(j) {
    if (ocupado) return
    onGuardar(jugadas.filter(x => x.id !== j.id))
    const ruta = rutaDeUrl(j.url)
    if (ruta) await supabase.storage.from(BUCKET).remove([ruta])
  }

  const colorEstado = estado?.fase === 'ok' ? S.green : estado?.fase === 'error' ? '#ff8a84' : '#fff'
  const fondoEstado = estado?.fase === 'ok' ? 'rgba(111,207,61,.14)' : estado?.fase === 'error' ? 'rgba(229,67,61,.18)' : '#1f1f1f'

  return (
    <div style={{ background: '#0a0a0a', border: `1px solid ${S.border}`, borderRadius: '10px', padding: '12px 14px', marginTop: '14px' }}>
      <button type="button" onClick={() => setAbierto(a => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', color: S.text, padding: 0, textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '.8rem' }}>
          <Film size={15} color={S.green}/> JUGADAS PARA EL DESCANSO — videos de repetición
          {jugadas.length > 0 && <span style={{ color: S.muted, fontWeight: 600 }}>({jugadas.length})</span>}
        </span>
        {abierto ? <ChevronUp size={18} color={S.muted}/> : <ChevronDown size={18} color={S.muted}/>}
      </button>

      {abierto && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '.74rem', color: S.muted, marginBottom: '12px', lineHeight: 1.5 }}>
            En el descanso, después del marcador grande y la tabla, sale solo: <b style={{ color: '#fff' }}>una jugada (2 veces) → un video de patrocinador → otra jugada (2 veces) → otro patrocinador…</b>{' '}
            Cada patrocinador sale una sola vez; cuando ya salieron todos, siguen solo las jugadas. Se quita cuando empieza el 2.º tiempo.
            Necesitas jugadas subidas o videos de patrocinadores para que salga (MP4, máx. {MAX_VIDEO_MB} MB cada una).
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
            {jugadas.map((j, i) => (
              <div key={j.id} style={{ width: '150px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '6px' }}>
                <video src={j.url} controls preload="metadata" playsInline
                  style={{ display: 'block', width: '100%', height: '84px', borderRadius: '5px', background: '#000', objectFit: 'contain' }}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '.7rem', color: S.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {j.nombre || 'Jugada'}</span>
                  <button type="button" onClick={() => quitar(j)} disabled={ocupado} title="Quitar esta jugada"
                    style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: '2px' }}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
            {!jugadas.length && <div style={{ fontSize: '.8rem', color: S.muted }}>Esta transmisión todavía no tiene jugadas.</div>}
          </div>

          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#2a2a2a', border: `1px dashed ${S.green}`, borderRadius: '8px',
            color: S.green, fontSize: '.76rem', fontWeight: 700, cursor: ocupado ? 'not-allowed' : 'pointer', opacity: ocupado ? .6 : 1,
          }}>
            <Upload size={12}/> {ocupado ? 'Subiendo... (puede tardar)' : 'Subir jugadas'}
            <input type="file" accept="video/*" multiple style={{ display: 'none' }} disabled={ocupado}
              onChange={e => { subir(e.target.files); e.target.value = '' }}/>
          </label>

          {estado && (
            <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: fondoEstado, color: colorEstado, fontSize: '.78rem', fontWeight: 700, lineHeight: 1.4 }}>
              {estado.texto}
              {estado.fase === 'subiendo' && (
                <div style={{ marginTop: '6px', height: '8px', borderRadius: '4px', background: '#333', overflow: 'hidden' }}>
                  <div style={{ width: `${estado.pct ?? 0}%`, height: '100%', background: S.green, transition: 'width .2s' }}/>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
