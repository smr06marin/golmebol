import { useEffect, useRef, useState } from 'react'
import { GiSoccerBall } from 'react-icons/gi'
import { supabase } from '../lib/supabase'
import { leerCacheRapido } from '../lib/cacheRapido'

// Pantalla de entrada a un torneo: el logo del torneo aparece en blanco y negro
// y se va llenando de COLOR de abajo hacia arriba mientras cargan los datos.
// Cuando los datos llegaron, termina de llenarse y recién ahí se entra.
//
//  · listo:      true cuando ya están los datos de la tabla.
//  · onTerminar: se llama una sola vez cuando el logo quedó 100% a color.
const TAM = 150

function identidadGuardada(id) {
  const delInicio = (leerCacheRapido('landing_torneos') || []).find(x => String(x.id) === String(id))
  const delTorneo = leerCacheRapido(`torneo_${id}`)?.t
  const f = delTorneo || delInicio
  return f ? { name: f.name || '', logo_url: f.logo_url || null } : { name: '', logo_url: null }
}

export default function PantallaCargaTorneo({ id, listo, onTerminar }) {
  const [ident, setIdent] = useState(() => identidadGuardada(id))
  const colorRef = useRef(null)
  const pctRef = useRef(null)
  const listoRef = useRef(listo)
  const terminarRef = useRef(onTerminar)
  listoRef.current = listo
  terminarRef.current = onTerminar

  // Primera visita (sin logo guardado): se pide solo nombre y logo, que es livianísimo.
  useEffect(() => {
    if (ident.logo_url) return
    let vivo = true
    supabase.from('tournaments').select('name,logo_url').eq('id', id).maybeSingle()
      .then(({ data }) => { if (vivo && data) setIdent({ name: data.name || '', logo_url: data.logo_url || null }) })
      .catch(() => {})
    return () => { vivo = false }
  }, [id])

  // Animación: avanza sola hacia ~88% mientras espera, y cuando llegan los
  // datos termina de llenarse rápido hasta 100%.
  useEffect(() => {
    let p = 0, last = performance.now(), raf = 0, fin = false, tFin = 0
    const pintar = () => {
      if (colorRef.current) colorRef.current.style.clipPath = `inset(${(1 - p) * 100}% 0 0 0)`
      if (pctRef.current) pctRef.current.textContent = `${Math.round(p * 100)}%`
    }
    const tick = now => {
      const dt = Math.min(now - last, 64); last = now
      if (listoRef.current) p = Math.min(1, p + dt / 420)
      else p += (0.88 - p) * (1 - Math.exp(-dt / 900))
      pintar()
      if (p >= 1 && !fin) {
        fin = true
        tFin = setTimeout(() => terminarRef.current?.(), 220)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    pintar()
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(tFin) }
  }, [])

  const contenido = (color) => ident.logo_url
    ? <img src={ident.logo_url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none' }}/>
    : <GiSoccerBall style={{ width: '100%', height: '100%', color }}/>

  return (
    <div role="status" aria-label="Cargando torneo" style={{ minHeight: '100vh', background: '#07070e', color: '#fff', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 24 }}>
      <div style={{ position: 'relative', width: TAM, height: TAM }}>
        {/* base: blanco y negro */}
        <div style={{ position: 'absolute', inset: 0, filter: 'grayscale(1) brightness(.62) contrast(1.05)', opacity: .9 }}>
          {contenido('#8a8f98')}
        </div>
        {/* encima: a color, revelado de abajo hacia arriba */}
        <div ref={colorRef} style={{ position: 'absolute', inset: 0, clipPath: 'inset(100% 0 0 0)', willChange: 'clip-path', filter: 'drop-shadow(0 0 18px rgba(0,221,208,.28))' }}>
          {contenido('#00ddd0')}
        </div>
      </div>
      <div style={{ textAlign: 'center', minHeight: 44 }}>
        {ident.name && <div style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '.03em', marginBottom: 6 }}>{ident.name}</div>}
        <div ref={pctRef} style={{ color: '#00ddd0', fontSize: '.78rem', letterSpacing: '.2em', fontWeight: 700 }}>0%</div>
      </div>
    </div>
  )
}
