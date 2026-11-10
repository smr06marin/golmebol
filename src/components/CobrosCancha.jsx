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

// Miniatura de un comprobante (privado: se pide un enlace temporal). Al tocarla se ve grande.
export function FotoComprobante({ ruta, size = 44 }) {
  const [url, setUrl] = useState(null)
  const [grande, setGrande] = useState(false)
  useEffect(() => { let vivo = true; urlComprobante(ruta).then(u => { if (vivo) setUrl(u) }); return () => { vivo = false } }, [ruta])
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
