import { useEffect, useState } from 'react'

// Porcentaje que sube solo mientras la pantalla está esperando (rápido al principio, más lento al final, sin pasar de
// 99 %): así quien espera ve que la app está avanzando. Cuando la pantalla de verdad carga, esta desaparece.
// El conteo sigue aunque la pantalla de espera cambie (la de la ruta, la del código de la página, la de la propia
// página): se guarda cuándo empezó la espera y solo se reinicia cuando ya no queda ninguna en pantalla.
let inicioEspera = null
let esperasActivas = 0
let reinicio = null

function Porcentaje() {
  const [n, setN] = useState(0)
  useEffect(() => {
    clearTimeout(reinicio)
    esperasActivas++
    if (inicioEspera === null) inicioEspera = performance.now()
    const calcular = () => {
      const seg = (performance.now() - inicioEspera) / 1000
      return Math.min(99, Math.floor(99 * (1 - Math.exp(-seg / 1.6))))
    }
    const id = setInterval(() => setN(calcular()), 50)
    const t = setTimeout(() => setN(calcular()), 0)
    return () => {
      clearInterval(id); clearTimeout(t)
      esperasActivas--
      if (esperasActivas === 0) reinicio = setTimeout(() => { if (esperasActivas === 0) inicioEspera = null }, 600)
    }
  }, [])
  return (
    <div style={{ width: 'min(220px, 62vw)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
      <div style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontSize: '2.6rem', lineHeight: 1, color: '#fff', letterSpacing: '.04em', fontVariantNumeric: 'tabular-nums' }}>
        {n}<span style={{ fontSize: '1.2rem', opacity: .6, marginLeft: '2px' }}>%</span>
      </div>
      <div style={{ width: '100%', height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}>
        <div style={{ width: `${n}%`, height: '100%', borderRadius: '4px', background: 'var(--color-secondary, #6fcf3d)', transition: 'width .08s linear' }}/>
      </div>
    </div>
  )
}

export function PantallaCargando({ compact = false }) {
  const logoSize = compact ? 40 : 72
  return (
    <div
      role="status"
      aria-label="Cargando"
      style={compact ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '60px 0',
      } : {
        minHeight: '100vh',
        height: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}
    >
      <img
        src="/marca/watermark-logo.png"
        alt=""
        width={logoSize}
        height={logoSize}
        style={{ width: logoSize, height: 'auto', display: 'block' }}
      />
      {!compact && (
        <div style={{
          fontFamily: 'var(--font-display), system-ui, sans-serif',
          fontSize: '1.3rem',
          letterSpacing: '.14em',
          color: '#fff',
          fontWeight: 400,
          marginTop: '-6px',
        }}>
          GOLMEBOL
        </div>
      )}
      {compact
        ? <div className="gm-spinner" style={{ width: 22, height: 22, borderWidth: 2 }}/>
        : <Porcentaje/>}
    </div>
  )
}
