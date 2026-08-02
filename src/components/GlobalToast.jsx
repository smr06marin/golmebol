import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { onNotify } from '../lib/notify'

// Aviso flotante de "cambios guardados" — se monta una sola vez en App.jsx
// y se suscribe a src/lib/notify.js. src/lib/supabase.js dispara el evento
// solo cada vez que un insert/update/upsert/delete en cualquier pantalla
// del proyecto termina sin error, así que esto no requiere tocar cada
// página a mano.
export default function GlobalToast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return onNotify((evento) => {
      setToasts(prev => [...prev.slice(-2), evento]) // como mucho 3 a la vez
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== evento.id))
      }, 2800)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: '18px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px',
      alignItems: 'center', pointerEvents: 'none', width: '100%', padding: '0 16px', boxSizing: 'border-box',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: t.tipo === 'error' ? '#3a1414' : '#0f2419',
          border: `1px solid ${t.tipo === 'error' ? '#d93025' : '#1e8e3e'}`,
          color: '#fff', padding: '10px 16px', borderRadius: '999px',
          fontSize: '.82rem', fontWeight: 600, fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 6px 20px rgba(0,0,0,.35)', maxWidth: '100%',
          animation: 'gToastIn .25s ease-out',
        }}>
          {t.tipo === 'error' ? <XCircle size={15} color="#ff6b6b"/> : <CheckCircle2 size={15} color="#3ddc84"/>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.mensaje}</span>
        </div>
      ))}
      <style>{`@keyframes gToastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}
