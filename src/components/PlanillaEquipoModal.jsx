import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download } from 'lucide-react'

// Planilla del equipo en hoja A4: escudo, equipo, torneo y una tarjeta por
// jugador con foto, nombre, cédula, fecha de nacimiento y casilla de firma.
// 8 jugadores por hoja (2 columnas x 4 filas). Se ve en pantalla (vista previa
// ajustada al ancho del celular) y "Descargar PDF" abre la impresión del
// navegador con solo las hojas, listas para "Guardar como PDF" o imprimir.
//
// datos = { equipo:{name,logo_url,city,representante_nombre}, torneo:{name,modalidad},
//           jugadores:[{id,name,cedula,fecha_nacimiento,foto}], generado }

const POR_HOJA = 8
const HOJA_W = 793.7   // 210 mm a 96 dpi
const HOJA_H = 1122.5  // 297 mm

const ESTILOS = `
.pe-hoja{width:210mm;height:297mm;box-sizing:border-box;background:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pe-head{background:#0b1220;color:#fff;height:27mm;display:flex;align-items:center;gap:5mm;padding:0 10mm;flex-shrink:0;position:relative}
.pe-head::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1.5mm;background:linear-gradient(90deg,#22d3ee,#1a73e8)}
.pe-logo{width:18mm;height:18mm;border-radius:3mm;background:#fff;object-fit:contain;padding:1mm;box-sizing:border-box;flex-shrink:0}
.pe-logo-vacio{width:18mm;height:18mm;border-radius:3mm;background:#1e293b;color:#94a3b8;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16pt;flex-shrink:0}
.pe-tit{flex:1;min-width:0}
.pe-sup{font-size:7pt;letter-spacing:.18em;text-transform:uppercase;color:#22d3ee;font-weight:800}
.pe-eq{font-size:19pt;font-weight:900;line-height:1.05;text-transform:uppercase;margin-top:.8mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pe-sub{font-size:8pt;color:#cbd5e1;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pe-der{text-align:right;flex-shrink:0;max-width:62mm}
.pe-tor{font-size:10pt;font-weight:800;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pe-meta{font-size:7.5pt;color:#cbd5e1;margin-top:1mm}
.pe-cuerpo{flex:1;min-height:0;padding:6mm 10mm 4mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,minmax(0,1fr));gap:4mm}
.pe-card{display:flex;gap:3.5mm;border:.35mm solid #cbd5e1;border-radius:2.5mm;padding:3mm;box-sizing:border-box;min-height:0;overflow:hidden;background:#fff}
.pe-foto{position:relative;width:32mm;flex-shrink:0;border-radius:1.8mm;overflow:hidden;background:#e2e8f0}
.pe-foto img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.pe-sinfoto{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5mm;color:#94a3b8;font-size:6pt;font-weight:800;letter-spacing:.1em}
.pe-num{position:absolute;left:0;top:0;background:#0b1220;color:#fff;font-weight:800;font-size:7.5pt;padding:.8mm 2mm;border-bottom-right-radius:1.8mm}
.pe-info{flex:1;min-width:0;display:flex;flex-direction:column}
.pe-nombre{font-weight:900;font-size:10.5pt;line-height:1.15;text-transform:uppercase;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:2.2mm;min-height:2.3em}
.pe-dato{margin-bottom:1.6mm}
.pe-dato span{display:block;font-size:6pt;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:800}
.pe-dato b{display:block;font-size:9.5pt;font-weight:700;color:#0f172a;margin-top:.2mm}
.pe-firma{margin-top:auto;border-top:.3mm solid #475569;padding-top:.8mm;font-size:6pt;color:#64748b;letter-spacing:.12em;text-transform:uppercase;font-weight:800}
.pe-pie{height:11mm;margin:0 10mm;border-top:.3mm solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;font-size:7pt;color:#64748b;flex-shrink:0}
.pe-vacio{grid-column:1/-1;grid-row:1/-1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:11pt;text-align:center}
#pe-print-root{display:none}
@page{size:A4;margin:0}
@media print{
  html,body{height:auto!important;overflow:visible!important;background:#fff!important}
  body>*:not(#pe-print-root){display:none!important}
  #pe-print-root{display:block!important}
  #pe-print-root .pe-hoja{break-after:page;page-break-after:always}
  #pe-print-root .pe-hoja:last-child{break-after:auto;page-break-after:auto}
}
`

function fmtCedula(c) {
  const s = String(c || '').trim()
  if (!s) return '—'
  return /^\d+$/.test(s) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : s
}
function parseFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null
}
function fmtFecha(iso) {
  const f = parseFecha(iso)
  return f ? `${String(f.d).padStart(2, '0')}/${String(f.m).padStart(2, '0')}/${f.y}` : '—'
}
function edadDe(iso, hoy) {
  const f = parseFecha(iso)
  if (!f) return null
  let e = hoy.getFullYear() - f.y
  if (hoy.getMonth() + 1 < f.m || (hoy.getMonth() + 1 === f.m && hoy.getDate() < f.d)) e--
  return e >= 0 && e < 100 ? e : null
}
function fmtGenerado(iso) {
  const d = iso ? new Date(iso) : new Date()
  return (isNaN(d.getTime()) ? new Date() : d).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Nombres largos: letra un poco más chica para que se lea completo (hasta 3 líneas)
function tamNombre(n) {
  const l = String(n || '').length
  return l <= 24 ? undefined : l <= 36 ? { fontSize: '9pt' } : { fontSize: '8pt' }
}

function Hoja({ datos, jugadores, pagina, total, offset, hoy }) {
  const eq = datos.equipo || {}
  const tor = datos.torneo || {}
  const sub = [eq.city, eq.representante_nombre ? `Dueño: ${eq.representante_nombre}` : null].filter(Boolean).join(' · ')
  return (
    <div className="pe-hoja">
      <div className="pe-head">
        {eq.logo_url
          ? <img className="pe-logo" src={eq.logo_url} alt="" />
          : <div className="pe-logo-vacio">{(eq.name || '?').trim().charAt(0).toUpperCase()}</div>}
        <div className="pe-tit">
          <div className="pe-sup">Planilla de jugadores</div>
          <div className="pe-eq">{eq.name}</div>
          {sub && <div className="pe-sub">{sub}</div>}
        </div>
        <div className="pe-der">
          <div className="pe-tor">{tor.name}</div>
          <div className="pe-meta">{[tor.modalidad, `${datos.jugadores.length} jugador${datos.jugadores.length === 1 ? '' : 'es'}`].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      <div className="pe-cuerpo">
        {jugadores.length === 0 && <div className="pe-vacio">Este equipo todavía no tiene jugadores inscritos en el torneo.</div>}
        {jugadores.map((j, i) => {
          const edad = edadDe(j.fecha_nacimiento, hoy)
          return (
            <div className="pe-card" key={j.id || i}>
              <div className="pe-foto">
                {j.foto
                  ? <img src={j.foto} alt="" />
                  : (
                    <div className="pe-sinfoto">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
                      SIN FOTO
                    </div>
                  )}
                <span className="pe-num">{String(offset + i + 1).padStart(2, '0')}</span>
              </div>
              <div className="pe-info">
                <div className="pe-nombre" style={tamNombre(j.name)}>{j.name || 'Sin nombre'}</div>
                <div className="pe-dato"><span>Cédula</span><b>{fmtCedula(j.cedula)}</b></div>
                <div className="pe-dato"><span>Fecha de nacimiento</span><b>{fmtFecha(j.fecha_nacimiento)}{edad != null ? ` · ${edad} años` : ''}</b></div>
                <div className="pe-firma">Firma</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="pe-pie">
        <span>Golmebol · Generada el {fmtGenerado(datos.generado)}</span>
        <span>Hoja {pagina} de {total}</span>
      </div>
    </div>
  )
}

export default function PlanillaEquipoModal({ datos, onClose }) {
  const hoy = useMemo(() => new Date(), [])
  const hojas = useMemo(() => {
    const lista = datos?.jugadores || []
    const trozos = []
    for (let i = 0; i < lista.length; i += POR_HOJA) trozos.push({ offset: i, jugadores: lista.slice(i, i + POR_HOJA) })
    return trozos.length ? trozos : [{ offset: 0, jugadores: [] }]
  }, [datos])

  const cajaRef = useRef(null)
  const [esc, setEsc] = useState(() => Math.min(1, Math.max(0.3, (window.innerWidth - 24) / HOJA_W)))
  const [imprimiendo, setImprimiendo] = useState(false)

  useEffect(() => {
    const el = cajaRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setEsc(Math.min(1, Math.max(0.3, (el.clientWidth - 24) / HOJA_W))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Bloquea el scroll de la página de atrás mientras está abierta
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = antes }
  }, [])

  async function descargar() {
    if (imprimiendo) return
    setImprimiendo(true)
    try {
      // Espera a que carguen las fotos para que no salgan en blanco en el PDF
      const raiz = document.getElementById('pe-print-root')
      const imgs = raiz ? [...raiz.querySelectorAll('img')] : []
      await Promise.race([
        Promise.all(imgs.map(im => (im.complete ? null : new Promise(r => { im.onload = r; im.onerror = r })))),
        new Promise(r => setTimeout(r, 6000)),
      ])
      const tituloAntes = document.title
      const limpio = s => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').trim()
      document.title = `Planilla ${limpio(datos.equipo?.name)} - ${limpio(datos.torneo?.name)}`
      const volver = () => { document.title = tituloAntes; window.removeEventListener('afterprint', volver) }
      window.addEventListener('afterprint', volver)
      window.print()
    } finally {
      setImprimiendo(false)
    }
  }

  const nombreEq = datos?.equipo?.name || 'Equipo'
  const contenido = (
    <>
      <style>{ESTILOS}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#e5e7eb', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#0b1220', color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Planilla · {nombreEq}</div>
            <div style={{ fontSize: '.68rem', color: '#94a3b8' }}>{datos.jugadores.length} jugador{datos.jugadores.length === 1 ? '' : 'es'} · {hojas.length} hoja{hojas.length === 1 ? '' : 's'}</div>
          </div>
          <button onClick={descargar} disabled={imprimiendo || datos.jugadores.length === 0}
            style={{ background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '9px', padding: '9px 14px', fontWeight: 800, fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: (imprimiendo || datos.jugadores.length === 0) ? .6 : 1, flexShrink: 0 }}>
            <Download size={15} /> {imprimiendo ? 'Preparando…' : 'Descargar PDF'}
          </button>
          <button onClick={onClose} aria-label="Cerrar"
            style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: 'none', borderRadius: '9px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ background: '#fffbeb', color: '#92400e', fontSize: '.7rem', padding: '5px 14px', flexShrink: 0 }}>
          Al tocar “Descargar PDF” se abre la impresión: elige <b>Guardar como PDF</b> (o imprímela directamente).
        </div>
        <div ref={cajaRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 0 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          {hojas.map((h, i) => (
            <div key={i} style={{ width: HOJA_W * esc, height: HOJA_H * esc, flexShrink: 0, boxShadow: '0 4px 18px rgba(0,0,0,.22)', background: '#fff' }}>
              <div style={{ transform: `scale(${esc})`, transformOrigin: 'top left', width: HOJA_W, height: HOJA_H }}>
                <Hoja datos={datos} jugadores={h.jugadores} pagina={i + 1} total={hojas.length} offset={h.offset} hoy={hoy} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div id="pe-print-root">
        {hojas.map((h, i) => (
          <Hoja key={i} datos={datos} jugadores={h.jugadores} pagina={i + 1} total={hojas.length} offset={h.offset} hoy={hoy} />
        ))}
      </div>
    </>
  )
  return createPortal(contenido, document.body)
}
