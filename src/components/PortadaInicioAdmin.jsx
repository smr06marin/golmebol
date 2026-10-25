import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Image as IconoImagen, Upload, Trash2, Monitor, Smartphone, Crop } from 'lucide-react'

// Portada de la página de inicio (imagen de fondo de la parte de arriba de golmebol.com).
//
// Se sube UNA sola foto y aquí mismo se elige qué parte se ve en el celular (vertical, 3:4) y qué parte
// en el computador (panorámica, 3:1). De esa foto se generan las dos versiones ya recortadas, y también se
// guarda la foto original para poder volver a ajustar el encuadre sin subirla otra vez.
//
// Se guarda en site_config.portada_inicio = { url, url_movil, url_original }
// (ver migracion_site_config_portada_inicio.sql). Los archivos van al almacenamiento "patrocinadores".
const BUCKET = 'patrocinadores'
const LADO_MAX_ORIGINAL = 2400

const DESTINOS = [
  { id: 'movil', titulo: 'En el CELULAR', Icono: Smartphone, aspecto: 3 / 4, salidaAncho: 1080, ayuda: 'Es lo que ve la mayoría de la gente.', maxW: 300 },
  { id: 'pc', titulo: 'En el COMPUTADOR', Icono: Monitor, aspecto: 3, salidaAncho: 2400, ayuda: 'Franja ancha: se ve poca altura de la foto.', maxW: 560 },
]

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const sinColumna = (m) => /does not exist|column/.test(m || '')
const AVISO_MIGRACION = '⚠️ Falta correr migracion_site_config_portada_inicio.sql en Supabase'

function rutaDeUrl(url) {
  if (!url) return null
  const i = url.indexOf(`/${BUCKET}/`)
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])
}

function aBlob(canvas, calidad) {
  return new Promise(r => canvas.toBlob(r, 'image/jpeg', calidad))
}

// Reduce la foto original (lado mayor ≤ 2400 px) a JPG: así pesa poco aunque venga de la cámara.
async function prepararOriginal(blobOrigen) {
  const bmp = await createImageBitmap(blobOrigen)
  const k = Math.min(1, LADO_MAX_ORIGINAL / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await aBlob(c, 0.9)
  if (!blob) throw new Error('No se pudo leer la imagen')
  bmp.close?.()
  return { blob, ancho: c.width, alto: c.height }
}

// Rectángulo (en píxeles de la foto) que corresponde a un encuadre.
function rectDe(ancho, alto, aspecto, v) {
  const baseW = Math.min(ancho, alto * aspecto)
  const w = baseW / v.zoom
  const h = w / aspecto
  const left = clamp(v.cx * ancho - w / 2, 0, ancho - w)
  const top = clamp(v.cy * alto - h / 2, 0, alto - h)
  return { w, h, left, top }
}

async function recortar(bmp, aspecto, salidaAncho, v) {
  const r = rectDe(bmp.width, bmp.height, aspecto, v)
  const outW = Math.min(salidaAncho, Math.round(r.w))
  const outH = Math.round(outW / aspecto)
  const c = document.createElement('canvas')
  c.width = outW; c.height = outH
  c.getContext('2d').drawImage(bmp, r.left, r.top, r.w, r.h, 0, 0, outW, outH)
  const blob = await aBlob(c, 0.88)
  if (!blob) throw new Error('No se pudo recortar la imagen')
  return blob
}

// Foto con un marco que se arrastra (con el dedo o el mouse) y un control para acercar.
function Encuadre({ src, ancho, alto, destino, valor, onChange }) {
  const ref = useRef(null)
  const arrastre = useRef(null)
  const r = rectDe(ancho, alto, destino.aspecto, valor)
  const bajaRes = r.w < destino.salidaAncho * 0.6

  function alBajar(e) {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    arrastre.current = { x: e.clientX, y: e.clientY, cx: valor.cx, cy: valor.cy }
  }
  function alMover(e) {
    const a = arrastre.current
    if (!a || !ref.current) return
    const caja = ref.current.getBoundingClientRect()
    const mx = r.w / 2 / ancho, my = r.h / 2 / alto
    onChange({
      ...valor,
      cx: clamp(a.cx + (e.clientX - a.x) / caja.width, mx, 1 - mx),
      cy: clamp(a.cy + (e.clientY - a.y) / caja.height, my, 1 - my),
    })
  }
  function alSoltar() { arrastre.current = null }

  return (
    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '.82rem', color: '#202124' }}>
        <destino.Icono size={15} color="#1a73e8"/> {destino.titulo}
      </div>
      <div style={{ fontSize: '.74rem', color: '#5f6368', margin: '2px 0 8px' }}>{destino.ayuda} Arrastra el recuadro para elegir qué parte se ve.</div>
      <div ref={ref} style={{ position: 'relative', width: '100%', maxWidth: destino.maxW, aspectRatio: `${ancho} / ${alto}`, overflow: 'hidden', borderRadius: '8px', background: '#202124', userSelect: 'none' }}>
        <img src={src} alt="" draggable={false} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}/>
        <div
          onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
          style={{
            position: 'absolute', cursor: 'grab', touchAction: 'none',
            left: `${(r.left / ancho) * 100}%`, top: `${(r.top / alto) * 100}%`,
            width: `${(r.w / ancho) * 100}%`, height: `${(r.h / alto) * 100}%`,
            border: '2px solid #6cd63a', boxSizing: 'border-box',
            boxShadow: '0 0 0 9999px rgba(0,0,0,.55)',
          }}>
          <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,.25)' }}/>
          <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,.25)' }}/>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '.76rem', color: '#5f6368', maxWidth: destino.maxW }}>
        Acercar
        <input type="range" min="1" max="3" step="0.05" value={valor.zoom}
          onChange={e => onChange({ ...valor, zoom: Number(e.target.value) })} style={{ flex: 1 }}/>
      </label>
      {bajaRes && <div style={{ fontSize: '.74rem', color: '#b06000', marginTop: '4px' }}>⚠️ Muy acercada: se puede ver borrosa. Aleja un poco o usa una foto más grande.</div>}
    </div>
  )
}

export default function PortadaInicioAdmin() {
  const [portada, setPortada] = useState({ url: null, url_movil: null, url_original: null })
  const [editor, setEditor] = useState(null) // { src, ancho, alto, blob (si es foto nueva), movil, pc }
  const [guardando, setGuardando] = useState(false)
  const [cargandoFoto, setCargandoFoto] = useState(false)
  const [aviso, setAviso] = useState(null) // { texto, tipo }

  useEffect(() => {
    supabase.from('site_config').select('portada_inicio').eq('id', true).maybeSingle().then(({ data, error }) => {
      if (error) { setAviso({ texto: sinColumna(error.message) ? AVISO_MIGRACION : 'No se pudo leer la portada', tipo: 'error' }); return }
      const p = data?.portada_inicio || {}
      setPortada({ url: p.url || null, url_movil: p.url_movil || null, url_original: p.url_original || null })
    })
  }, [])

  useEffect(() => () => { if (editor?.src) URL.revokeObjectURL(editor.src) }, [editor?.src])

  function abrirEditor(blob, ancho, alto, esNueva) {
    const src = URL.createObjectURL(blob)
    setEditor({ src, ancho, alto, blob: esNueva ? blob : null, movil: { cx: 0.5, cy: 0.5, zoom: 1 }, pc: { cx: 0.5, cy: 0.5, zoom: 1 } })
  }

  async function elegirFoto(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setAviso({ texto: 'Elige una imagen (JPG, PNG o WebP)', tipo: 'error' }); return }
    setCargandoFoto(true); setAviso(null)
    try {
      const { blob, ancho, alto } = await prepararOriginal(file)
      abrirEditor(blob, ancho, alto, true)
    } catch (e) {
      setAviso({ texto: 'No se pudo abrir la foto: ' + (e.message || 'formato no compatible'), tipo: 'error' })
    } finally { setCargandoFoto(false) }
  }

  async function reajustar() {
    if (!portada.url_original) return
    setCargandoFoto(true); setAviso(null)
    try {
      const resp = await fetch(portada.url_original)
      const { blob, ancho, alto } = await prepararOriginal(await resp.blob())
      abrirEditor(blob, ancho, alto, false)
    } catch {
      setAviso({ texto: 'No se pudo abrir la foto guardada. Sube la foto otra vez.', tipo: 'error' })
    } finally { setCargandoFoto(false) }
  }

  function cerrarEditor() { setEditor(null) }

  async function guardar(valor) {
    const hay = valor.url || valor.url_movil
    const { error } = await supabase.from('site_config').upsert({ id: true, portada_inicio: hay ? valor : null, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    return error
  }

  async function aplicar() {
    if (!editor || guardando) return
    setGuardando(true); setAviso(null)
    const subidos = []
    try {
      const bmp = await createImageBitmap(await (await fetch(editor.src)).blob())
      const ts = Date.now()
      async function subir(nombre, blob) {
        const path = `portada/${nombre}_${ts}.jpg`
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
        if (error) throw new Error('No se pudo subir la imagen — ' + error.message)
        subidos.push(path)
        return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      }
      const [pcDest, movilDest] = [DESTINOS[1], DESTINOS[0]]
      const urlPc = await subir('inicio_pc', await recortar(bmp, pcDest.aspecto, pcDest.salidaAncho, editor.pc))
      const urlMovil = await subir('inicio_movil', await recortar(bmp, movilDest.aspecto, movilDest.salidaAncho, editor.movil))
      const urlOriginal = editor.blob ? await subir('inicio_original', editor.blob) : portada.url_original
      const nuevo = { url: urlPc, url_movil: urlMovil, url_original: urlOriginal }
      const errGuardar = await guardar(nuevo)
      if (errGuardar) throw new Error(sinColumna(errGuardar.message) ? AVISO_MIGRACION : 'Se subió, pero no se pudo guardar — ' + errGuardar.message)
      // Se borran los archivos anteriores (menos el original, si se conserva)
      const viejos = [portada.url, portada.url_movil, editor.blob ? portada.url_original : null].map(rutaDeUrl).filter(Boolean)
      if (viejos.length) await supabase.storage.from(BUCKET).remove(viejos)
      setPortada(nuevo)
      setEditor(null)
      setAviso({ texto: '✓ Portada guardada. Ya se ve en la página de inicio, en celular y en computador.', tipo: 'ok' })
    } catch (e) {
      if (subidos.length) await supabase.storage.from(BUCKET).remove(subidos)
      setAviso({ texto: e.message || 'No se pudo guardar la portada', tipo: 'error' })
    } finally { setGuardando(false) }
  }

  async function quitar() {
    if (guardando) return
    if (!confirm('¿Quitar la portada? La página de inicio vuelve al diseño oscuro de siempre.')) return
    const error = await guardar({ url: null, url_movil: null, url_original: null })
    if (error) { setAviso({ texto: 'No se pudo quitar — ' + error.message, tipo: 'error' }); return }
    const viejos = [portada.url, portada.url_movil, portada.url_original].map(rutaDeUrl).filter(Boolean)
    if (viejos.length) await supabase.storage.from(BUCKET).remove(viejos)
    setPortada({ url: null, url_movil: null, url_original: null })
    setAviso({ texto: 'Portada quitada', tipo: 'ok' })
  }

  const hayPortada = !!(portada.url || portada.url_movil)
  const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', border: 'none' }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#202124', fontSize: '1rem', marginBottom: '4px' }}>
        <IconoImagen size={18} color="#1a73e8"/> Portada de la página de inicio
      </div>
      <p style={{ color: '#5f6368', margin: '0 0 12px', fontSize: '.8rem', lineHeight: 1.5 }}>
        Sube UNA sola foto y elige qué parte se ve en el celular y qué parte en el computador. Lo mejor: una foto grande y limpia de un partido (mínimo 2000 px de ancho), SIN letras. Si no subes ninguna, queda el diseño oscuro de siempre.
      </p>

      {!editor && (
        <>
          {hayPortada && (
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
              {[{ t: 'Así se ve en computador', u: portada.url || portada.url_movil, w: 300, h: 100 }, { t: 'Así se ve en celular', u: portada.url_movil || portada.url, w: 108, h: 144 }].map(v => (
                <div key={v.t}>
                  <div style={{ position: 'relative', width: v.w, height: v.h, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e8eaed', backgroundImage: `url(${v.u})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, rgba(10,10,10,.12) 0%, rgba(10,10,10,.12) 45%, rgba(10,10,10,.7) 80%, #0a0a0a 100%)' }}/>
                    <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', display: 'flex', gap: 3 }}>
                      <span style={{ width: v.w > 200 ? 34 : 22, height: 7, borderRadius: 2, background: '#6cd63a' }}/>
                      <span style={{ width: v.w > 200 ? 30 : 20, height: 7, borderRadius: 2, border: '1px solid rgba(255,255,255,.5)' }}/>
                    </div>
                  </div>
                  <div style={{ fontSize: '.68rem', color: '#80868b', marginTop: 4 }}>{v.t}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ ...btn, background: '#1a73e8', color: '#fff', cursor: cargandoFoto ? 'not-allowed' : 'pointer', opacity: cargandoFoto ? .6 : 1 }}>
              <Upload size={15}/> {cargandoFoto ? 'Abriendo…' : hayPortada ? 'Subir otra foto' : 'Subir foto'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={cargandoFoto} onChange={e => { elegirFoto(e.target.files[0]); e.target.value = '' }}/>
            </label>
            {portada.url_original && (
              <button type="button" onClick={reajustar} disabled={cargandoFoto} style={{ ...btn, background: '#fff', color: '#1a73e8', border: '1px solid #1a73e8' }}>
                <Crop size={14}/> Ajustar encuadre
              </button>
            )}
            {hayPortada && (
              <button type="button" onClick={quitar} style={{ ...btn, background: 'none', border: '1px solid #d93025', color: '#d93025' }}>
                <Trash2 size={14}/> Quitar portada
              </button>
            )}
          </div>
          {hayPortada && !portada.url_original && (
            <div style={{ marginTop: '10px', fontSize: '.76rem', color: '#5f6368' }}>
              Esta portada se subió con el sistema anterior. Para ajustar el encuadre, sube la foto otra vez.
            </div>
          )}
        </>
      )}

      {editor && (
        <>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {DESTINOS.map(d => (
              <Encuadre key={d.id} src={editor.src} ancho={editor.ancho} alto={editor.alto} destino={d}
                valor={editor[d.id]} onChange={v => setEditor(ed => ({ ...ed, [d.id]: v }))}/>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
            <button type="button" onClick={aplicar} disabled={guardando} style={{ ...btn, background: '#1e8e3e', color: '#fff', opacity: guardando ? .6 : 1 }}>
              {guardando ? 'Guardando…' : '✓ Guardar portada'}
            </button>
            <button type="button" onClick={cerrarEditor} disabled={guardando} style={{ ...btn, background: '#fff', color: '#5f6368', border: '1px solid #dadce0' }}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {aviso && (
        <div style={{ marginTop: '12px', padding: '9px 12px', borderRadius: '8px', fontSize: '.82rem', fontWeight: 600, background: aviso.tipo === 'ok' ? '#e6f4ea' : '#fce8e6', color: aviso.tipo === 'ok' ? '#1e8e3e' : '#d93025' }}>{aviso.texto}</div>
      )}
    </div>
  )
}
