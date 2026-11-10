import { useState, useEffect, useRef, useCallback } from 'react'
import { cobraEnCancha, pesos, cargarCobrosPartido, registrarTransferencia, anularCobro, urlComprobante } from '../lib/cobrosCancha'

// Torneos con «cobro en cancha» (los de Golmebol): cuando a un árbitro le pagan por TRANSFERENCIA, toca el botón de
// arriba de la planilla, toma la foto del comprobante y escribe cuánto fue. Nada más.
// (El arbitraje y las tarjetas se suman solos en «Mi caja».)

const INK = '#202124'
const MUTED = '#5f6368'
const LINE = '#e3e5e8'
const VERDE = '#188038'
const ROJO = '#d93025'
const AZUL = '#1a73e8'

const btnGrande = (bg, color = '#fff', borde = 'none') => ({
  width: '100%', minHeight: '58px', padding: '12px 14px', borderRadius: '14px', border: borde, background: bg, color,
  fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
})
const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })

// Enlace temporal de un comprobante privado (null mientras carga o si falla)
function useUrlComprobante(ruta) {
  const [url, setUrl] = useState(null)
  useEffect(() => { let vivo = true; urlComprobante(ruta).then(u => { if (vivo) setUrl(u) }); return () => { vivo = false } }, [ruta])
  return url
}

// Miniatura de un comprobante. Al tocarla se ve grande.
export function FotoComprobante({ ruta, size = 44 }) {
  const url = useUrlComprobante(ruta)
  const [grande, setGrande] = useState(false)
  if (!url) return <div style={{ width: size, height: size, borderRadius: 8, background: '#f1f3f4' }}/>
  return (
    <>
      <img src={url} alt="Comprobante" onClick={() => setGrande(true)} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, border: `1px solid ${LINE}`, cursor: 'pointer' }}/>
      {grande && (
        <div onClick={() => setGrande(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <img src={url} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}/>
        </div>
      )}
    </>
  )
}

function ImgCarrusel({ ruta, ancho, alto, onClick }) {
  const url = useUrlComprobante(ruta)
  const caja = { width: ancho, height: alto, borderRadius: 12, background: '#e8eaed', flexShrink: 0 }
  if (!url) return <div style={caja}/>
  return <img src={url} alt="Comprobante" onClick={onClick} style={{ ...caja, objectFit: 'cover', cursor: 'pointer', border: '1px solid rgba(128,128,128,.3)', display: 'block' }}/>
}

// Foto en pantalla completa con flechas y deslizar el dedo para pasar a la anterior / siguiente
function VisorFotos({ fotos, inicio, onClose }) {
  const [k, setK] = useState(inicio)
  const toque = useRef(null)
  const n = fotos.length
  const ir = useCallback(d => setK(x => (x + d + n) % n), [n])
  useEffect(() => {
    const f = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1) }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [ir, onClose])
  const f = fotos[k]
  const url = useUrlComprobante(f.ruta)
  const flecha = lado => ({ position: 'absolute', top: '50%', [lado]: 8, transform: 'translateY(-50%)', width: 52, height: 52, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: '1.6rem', fontWeight: 800, cursor: 'pointer' })
  return (
    <div onClick={onClose} onTouchStart={e => { toque.current = e.touches[0].clientX }}
      onTouchEnd={e => { if (toque.current == null) return; const dx = e.changedTouches[0].clientX - toque.current; toque.current = null; if (Math.abs(dx) > 50 && n > 1) ir(dx < 0 ? 1 : -1) }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 9990, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 12px 24px', WebkitTextSizeAdjust: '100%' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', color: '#fff' }}>
        <div style={{ flex: 1, fontSize: '.85rem', fontWeight: 700 }}>Foto {k + 1} de {n}</div>
        <button onClick={e => { e.stopPropagation(); onClose() }} style={{ minWidth: 48, minHeight: 48, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer' }}>✕</button>
      </div>
      {url ? <img src={url} alt="Comprobante" onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8 }}/> : <div style={{ color: '#fff' }}>Cargando…</div>}
      <div style={{ color: '#fff', textAlign: 'center', marginTop: 12 }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{pesos(f.monto)}</div>
        {f.titulo && <div style={{ fontSize: '.82rem', opacity: .85 }}>{f.titulo}</div>}
        {f.sub && <div style={{ fontSize: '.74rem', opacity: .7 }}>{f.sub}</div>}
      </div>
      {n > 1 && <>
        <button onClick={e => { e.stopPropagation(); ir(-1) }} style={flecha('left')} aria-label="Anterior">‹</button>
        <button onClick={e => { e.stopPropagation(); ir(1) }} style={flecha('right')} aria-label="Siguiente">›</button>
      </>}
    </div>
  )
}

// CARRUSEL de comprobantes: una fila que se desliza de lado, con flechas y contador. Al tocar una foto se abre grande
// y se pasa de una a otra. fotos: [{ id, ruta, monto, titulo, sub }]
export function CarruselFotos({ fotos, oscuro = false }) {
  const pista = useRef(null)
  const [activa, setActiva] = useState(0)
  const [visor, setVisor] = useState(null)
  const ANCHO = 150, ALTO = 190, GAP = 12
  const n = fotos.length
  const texto = oscuro ? '#e8f4fd' : INK
  const tenue = oscuro ? '#7a9ab5' : MUTED
  const ir = d => {
    const el = pista.current; if (!el) return
    el.scrollBy({ left: d * (ANCHO + GAP), behavior: 'smooth' })
  }
  const flecha = lado => ({ position: 'absolute', top: ALTO / 2 - 22, [lado]: -4, width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(32,33,36,.78)', color: '#fff', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer', zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,.35)' })
  if (!n) return null
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div ref={pista} onScroll={e => setActiva(Math.min(n - 1, Math.max(0, Math.round(e.currentTarget.scrollLeft / (ANCHO + GAP)))))}
          style={{ display: 'flex', gap: GAP, overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', paddingBottom: 6, scrollbarWidth: 'none' }}>
          {fotos.map((f, i) => (
            <div key={f.id || i} style={{ flex: `0 0 ${ANCHO}px`, scrollSnapAlign: 'start', color: texto }}>
              <ImgCarrusel ruta={f.ruta} ancho={ANCHO} alto={ALTO} onClick={() => setVisor(i)}/>
              <div style={{ fontSize: '1rem', fontWeight: 900, marginTop: 6 }}>{pesos(f.monto)}</div>
              {f.titulo && <div style={{ fontSize: '.68rem', color: tenue, lineHeight: 1.3 }}>{f.titulo}</div>}
              {f.sub && <div style={{ fontSize: '.66rem', color: tenue }}>{f.sub}</div>}
            </div>
          ))}
        </div>
        {n > 1 && <>
          <button onClick={() => ir(-1)} style={flecha('left')} aria-label="Foto anterior">‹</button>
          <button onClick={() => ir(1)} style={flecha('right')} aria-label="Foto siguiente">›</button>
        </>}
      </div>
      {n > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
          {fotos.map((_, i) => <span key={i} style={{ width: i === activa ? 16 : 7, height: 7, borderRadius: 4, background: i === activa ? AZUL : (oscuro ? '#2b3b4d' : '#c4c7cc'), transition: 'width .15s' }}/>)}
          <span style={{ fontSize: '.7rem', color: tenue, marginLeft: 6 }}>{activa + 1} de {n}</span>
        </div>
      )}
      {visor != null && <VisorFotos fotos={fotos} inicio={visor} onClose={() => setVisor(null)}/>}
    </div>
  )
}

// Botón de la barra de arriba de la planilla + hoja para tomar la foto y escribir el monto
export function BotonTransferencia({ partido, torneo }) {
  const activo = cobraEnCancha(torneo)
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState([])
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [montoTxt, setMontoTxt] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [guardada, setGuardada] = useState(false)
  const inputRef = useRef(null)
  const matchId = partido?.id

  const recargar = useCallback(async () => {
    if (!matchId) return
    const c = await cargarCobrosPartido(matchId)
    setLista(c.filter(x => x.tipo === 'transferencia'))
  }, [matchId])
  useEffect(() => { if (activo) recargar() }, [activo, recargar])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (!activo) return null

  const monto = Number(String(montoTxt).replace(/\D/g, '')) || 0
  const sugerido = Number(torneo?.finanzas_config?.arbitraje_equipo) || 0

  function limpiar() { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(null); setMontoTxt(''); setError('') }
  function abrir() {
    limpiar(); setGuardada(false); setAbierto(true); recargar()
    // el toque en el botón cuenta como permiso: la cámara se abre de una vez
    try { inputRef.current?.click() } catch { /* el botón de la hoja la vuelve a abrir */ }
  }
  function fotoTomada(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f); setPreview(URL.createObjectURL(f)); setError(''); setGuardada(false)
  }
  async function guardar() {
    if (enviando || !file || monto <= 0) return
    setEnviando(true); setError('')
    const r = await registrarTransferencia({ partido, monto, file })
    setEnviando(false)
    if (!r.ok) { setError(r.error); return }
    limpiar(); setGuardada(true); recargar()
  }
  async function deshacer(c) {
    if (!window.confirm(`¿Quitar la transferencia de ${pesos(c.monto)}?`)) return
    const r = await anularCobro(c.id)
    if (!r.ok) { setError(r.error); return }
    recargar()
  }

  const total = lista.reduce((s, c) => s + (Number(c.monto) || 0), 0)
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={fotoTomada} style={{ display: 'none' }}/>
      <button onClick={abrir} className="no-print"
        style={{ padding: '9px 18px', background: AZUL, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.92rem', fontWeight: '900' }}>
        📲 Pago transferencia{lista.length > 0 ? ` (${lista.length})` : ''}
      </button>

      {abierto && (
        <div className="no-print" onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9800, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', overscrollBehavior: 'contain', borderRadius: '20px 20px 0 0', padding: '16px 16px 24px', boxShadow: '0 -10px 40px rgba(0,0,0,.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: INK }}>📲 Pago por transferencia</div>
                <div style={{ fontSize: '.8rem', color: MUTED, marginTop: '2px' }}>{partido?.home?.name} vs {partido?.away?.name}</div>
              </div>
              <button onClick={() => setAbierto(false)} style={{ minWidth: '52px', minHeight: '52px', borderRadius: '14px', border: `1px solid ${LINE}`, background: '#f8f9fa', fontSize: '1.2rem', fontWeight: '800', color: INK, cursor: 'pointer' }}>✕</button>
            </div>

            {error && <div style={{ background: '#fce8e6', color: '#b3261e', borderRadius: '10px', padding: '10px 12px', fontSize: '.84rem', fontWeight: '700', marginBottom: '10px' }}>{error}</div>}
            {guardada && <div style={{ background: '#e6f4ea', color: '#0d652d', borderRadius: '10px', padding: '10px 12px', fontSize: '.88rem', fontWeight: '800', marginBottom: '10px' }}>✓ Guardada. Ya le llegó el aviso al organizador.</div>}

            {!preview ? (
              <button onClick={() => inputRef.current?.click()} style={{ ...btnGrande(AZUL), minHeight: '76px', fontSize: '1.1rem' }}>
                📷 {guardada ? 'Otra transferencia' : 'Tomar foto del comprobante'}
              </button>
            ) : (
              <div>
                <img src={preview} alt="Comprobante" style={{ width: '100%', maxHeight: '38vh', objectFit: 'contain', borderRadius: '12px', border: `1px solid ${LINE}`, background: '#f1f3f4' }}/>
                <div style={{ fontSize: '.74rem', color: MUTED, margin: '6px 0 12px' }}>Revisa que se lea bien el comprobante.</div>
                <div style={{ fontSize: '.95rem', fontWeight: '800', color: INK, marginBottom: '6px' }}>¿Cuánto fue la transferencia?</div>
                <input value={montoTxt ? Number(montoTxt.replace(/\D/g, '')).toLocaleString('es-CO') : ''} onChange={e => setMontoTxt(e.target.value.replace(/\D/g, '').slice(0, 9))} inputMode="numeric" placeholder="$ 0"
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '1.7rem', fontWeight: '800', textAlign: 'center', padding: '14px', borderRadius: '12px', border: `2px solid ${AZUL}`, outline: 'none', color: INK }}/>
                {sugerido > 0 && (
                  <div style={{ display: 'flex', gap: '8px', margin: '8px 0 0' }}>
                    {[sugerido, sugerido * 2].map(v => (
                      <button key={v} onClick={() => setMontoTxt(String(v))} style={{ flex: 1, minHeight: '44px', borderRadius: '10px', border: `1px solid ${LINE}`, background: '#f8f9fa', fontWeight: '800', color: INK, cursor: 'pointer' }}>{pesos(v)}</button>
                    ))}
                  </div>
                )}
                <button disabled={enviando || monto <= 0} onClick={guardar} style={{ ...btnGrande(monto > 0 ? VERDE : '#9aa0a6'), marginTop: '12px' }}>{enviando ? 'Guardando…' : 'Guardar transferencia'}</button>
                <button disabled={enviando} onClick={() => inputRef.current?.click()} style={{ ...btnGrande('#fff', INK, `2px solid ${LINE}`), marginTop: '8px' }}>📷 Tomar otra foto</button>
                <button disabled={enviando} onClick={limpiar} style={{ background: 'none', border: 'none', color: MUTED, fontWeight: '700', fontSize: '.85rem', padding: '12px 6px 0', cursor: 'pointer' }}>Cancelar</button>
              </div>
            )}

            {lista.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Registradas en este partido · {pesos(total)}</div>
                {lista.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: `1px solid ${LINE}` }}>
                    <FotoComprobante ruta={c.comprobante_path} size={48}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '900', color: INK }}>{pesos(c.monto)}</div>
                      <div style={{ fontSize: '.74rem', color: MUTED }}>{hora(c.cobrado_at)}</div>
                    </div>
                    <button onClick={() => deshacer(c)} style={{ minHeight: '40px', padding: '0 12px', borderRadius: '10px', border: `1px solid ${LINE}`, background: '#fff', color: ROJO, fontWeight: '700', fontSize: '.78rem', cursor: 'pointer' }}>Quitar</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setAbierto(false)} style={{ ...btnGrande('#fff', INK, `2px solid ${LINE}`), marginTop: '16px' }}>Listo</button>
          </div>
        </div>
      )}
    </>
  )
}
