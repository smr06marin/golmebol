import { useState, useEffect, useRef } from 'react'

// Signo "?" chiquito junto a un término difícil. Al tocarlo aparece una frase
// corta y se cierra sola (a los 7 s, al tocar fuera o al hacer scroll).
// No cambia ninguna función. El globo se posiciona sobre la pantalla (fixed)
// para que nunca se salga del borde en celulares angostos.
export default function AyudaTermino({ texto, ancho = 280 }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!pos) return
    const cerrar = e => { if (!ref.current || !ref.current.contains(e.target)) setPos(null) }
    const alScroll = () => setPos(null)
    document.addEventListener('pointerdown', cerrar)
    window.addEventListener('scroll', alScroll, true)
    const t = setTimeout(() => setPos(null), 7000)
    return () => {
      document.removeEventListener('pointerdown', cerrar)
      window.removeEventListener('scroll', alScroll, true)
      clearTimeout(t)
    }
  }, [pos])

  function alternar(e) {
    e.preventDefault(); e.stopPropagation()
    if (pos) { setPos(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const w = Math.min(ancho, window.innerWidth - 32)
    const left = Math.min(Math.max(16, r.left - 8), window.innerWidth - w - 16)
    const abajo = r.bottom + 8
    const arriba = window.innerHeight - abajo < 140 // si no cabe debajo, se abre hacia arriba
    setPos({ left, width: w, ...(arriba ? { bottom: window.innerHeight - r.top + 8 } : { top: abajo }) })
  }

  return (
    <span ref={ref} style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: '6px' }}>
      <button
        type="button"
        aria-label="Ver explicación"
        aria-expanded={!!pos}
        onClick={alternar}
        style={{
          width: '22px', height: '22px', minWidth: '22px', borderRadius: '50%', border: 'none', padding: 0,
          background: '#e8f0fe', color: '#1a73e8', fontSize: '.75rem', fontWeight: 800, lineHeight: 1,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >?</button>
      {pos && (
        <span
          role="tooltip"
          style={{
            position: 'fixed', zIndex: 10001, boxSizing: 'border-box', ...pos,
            background: '#202124', color: '#fff', borderRadius: '10px', padding: '10px 12px',
            fontSize: '.78rem', lineHeight: 1.45, fontWeight: 500, textAlign: 'left', whiteSpace: 'normal',
            textTransform: 'none', letterSpacing: 'normal', boxShadow: '0 6px 20px rgba(0,0,0,.3)',
          }}
        >{texto}</span>
      )}
    </span>
  )
}
