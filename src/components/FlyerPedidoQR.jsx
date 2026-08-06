import { useEffect, useRef, useState } from 'react'
import { X, Download, QrCode } from 'lucide-react'

// Cartel con código QR del link público de pedido (/pedir/:escenarioId) para
// imprimir y pegar en la cancha — el cliente lo escanea con la cámara del
// celular y le abre directo la página para armar su pedido, sin login.
// Fondo claro (no el tema oscuro del resto del portal) a propósito: así el
// QR queda con buen contraste para escanear e imprime bien en blanco y negro.
export default function FlyerPedidoQR({ escenario, escenarioId, onClose }) {
  const flyerRef = useRef(null)
  const [qrUrl, setQrUrl] = useState(null)
  const [descargando, setDescargando] = useState(false)

  const link = `${window.location.origin}/pedir/${escenarioId}`

  useEffect(() => {
    let cancelado = false
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toDataURL(link, { width: 640, margin: 1, color: { dark: '#07070e', light: '#ffffff' } })
        .then(url => { if (!cancelado) setQrUrl(url) })
    })
    return () => { cancelado = true }
  }, [link])

  async function handleDescargar() {
    if (!flyerRef.current) return
    setDescargando(true)
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(flyerRef.current, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' })
    const a = document.createElement('a')
    a.download = `pedido_qr_${(escenario?.name || 'golmebol').replace(/\s+/g, '_')}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
    setDescargando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div style={{ position: 'relative', maxWidth: '380px', width: '100%' }}>
        <button onClick={onClose} aria-label="Cerrar" style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: '6px' }}>
          <X size={24}/>
        </button>

        <div ref={flyerRef} style={{ background: '#fff', borderRadius: '20px', padding: '30px 26px', textAlign: 'center', fontFamily: 'system-ui,sans-serif' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#e8fdfb', color: '#009e94', borderRadius: '999px', padding: '5px 14px', fontSize: '.7rem', fontWeight: '800', letterSpacing: '.04em', marginBottom: '16px' }}>
            <QrCode size={13}/> GOLMEBOL · ESCENARIOS
          </div>

          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#12181a', lineHeight: 1.15, marginBottom: '6px' }}>
            Escanea y pide<br/>sin moverte de la cancha
          </div>
          <div style={{ fontSize: '.85rem', color: '#5f6368', fontWeight: '600', marginBottom: '22px' }}>{escenario?.name}</div>

          <div style={{ background: '#f8f9fa', border: '1px solid #e7ebe9', borderRadius: '16px', padding: '18px', marginBottom: '18px', display: 'inline-block' }}>
            {qrUrl
              ? <img src={qrUrl} style={{ width: '220px', height: '220px', display: 'block' }}/>
              : <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6', fontSize: '.8rem' }}>Generando QR...</div>}
          </div>

          <div style={{ fontSize: '.8rem', color: '#4b5a56', lineHeight: 1.5, marginBottom: '4px', fontWeight: '600' }}>
            1. Abre la cámara de tu celular<br/>
            2. Apunta al código y toca el link<br/>
            3. Arma tu pedido y lo mandamos por WhatsApp
          </div>

          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #e7ebe9', fontSize: '.68rem', color: '#9aa0a6', fontWeight: '700', letterSpacing: '.05em' }}>
            GOLMEBOL.COM
          </div>
        </div>

        <button onClick={handleDescargar} disabled={!qrUrl || descargando}
          style={{ width: '100%', marginTop: '14px', padding: '13px', background: '#00ddd0', border: 'none', borderRadius: '12px', cursor: (!qrUrl || descargando) ? 'default' : 'pointer', color: '#000', fontWeight: '800', fontSize: '.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (!qrUrl || descargando) ? .6 : 1 }}>
          <Download size={16}/> {descargando ? 'Generando imagen...' : 'Descargar para imprimir'}
        </button>
      </div>
    </div>
  )
}
