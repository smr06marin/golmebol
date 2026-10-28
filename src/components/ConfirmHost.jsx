import { useState, useEffect, useRef } from 'react'
import { registrarConfirmHost } from '../lib/confirmar'

// Ventana de confirmación única para todo el panel. Se monta una sola vez
// (en AdminLayout) y la usan todas las llamadas a confirmar().
export default function ConfirmHost() {
  const [dlg, setDlg] = useState(null)
  const botonNo = useRef(null)

  useEffect(() => {
    registrarConfirmHost(setDlg)
    return () => registrarConfirmHost(null)
  }, [])

  useEffect(() => {
    if (!dlg) return
    botonNo.current?.focus()
    const onKey = e => { if (e.key === 'Escape') cerrar(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlg])

  function cerrar(valor) {
    const actual = dlg
    setDlg(null)
    actual?.resolver(valor)
  }

  if (!dlg) return null
  return (
    <div onClick={() => cerrar(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(32,33,36,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="gm-confirm-titulo" onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '18px', width: '100%', boxSizing: 'border-box', maxWidth: '430px', maxHeight: '90vh', overflowY: 'auto', padding: '24px 22px 20px', boxShadow: '0 12px 40px rgba(0,0,0,.3)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: dlg.peligro ? '#fce8e6' : '#e8f0fe', color: dlg.peligro ? '#d93025' : '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, marginBottom: '14px' }}>
          {dlg.peligro ? '!' : '?'}
        </div>
        <div id="gm-confirm-titulo" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#202124', marginBottom: dlg.detalle ? '6px' : '18px', lineHeight: 1.3 }}>{dlg.titulo}</div>
        {dlg.detalle && <div style={{ fontSize: '.88rem', color: '#5f6368', lineHeight: 1.5, marginBottom: '20px', whiteSpace: 'pre-line' }}>{dlg.detalle}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button ref={botonNo} type="button" onClick={() => cerrar(false)}
            style={{ padding: '12px 20px', minHeight: '46px', borderRadius: '10px', border: 'none', background: '#f1f3f4', color: '#3c4043', fontSize: '.92rem', fontWeight: 700, cursor: 'pointer' }}>Mejor no</button>
          <button type="button" onClick={() => cerrar(true)}
            style={{ padding: '12px 20px', minHeight: '46px', borderRadius: '10px', border: 'none', background: dlg.peligro ? '#d93025' : '#1a73e8', color: '#fff', fontSize: '.92rem', fontWeight: 700, cursor: 'pointer' }}>{dlg.si}</button>
        </div>
      </div>
    </div>
  )
}
