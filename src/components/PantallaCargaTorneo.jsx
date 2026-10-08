import { useEffect, useRef, useState } from 'react'
import { GiSoccerBall } from 'react-icons/gi'
import { supabase } from '../lib/supabase'
import { guardarCacheRapido, leerCacheRapido } from '../lib/cacheRapido'

// Pantalla de entrada a un torneo o a la vitrina de un organizador: el logo
// (grande) aparece en blanco y negro y se va llenando de COLOR de abajo hacia
// arriba mientras cargan los datos. Cuando los datos llegaron, termina de
// llenarse y recién ahí se entra. En dominios propios (ej. centegol.com) abajo
// va el logo de Golmebol, pequeño, como marca de agua.
//
//  · tipo:       'torneo' (por defecto) | 'organizador'
//  · id:         id del torneo / del organizador (para buscar su logo)
//  · identidad:  { name, logo_url } si ya se conoce (evita buscarla)
//  · listo:      true cuando ya están los datos
//  · onTerminar: se llama una sola vez cuando el logo quedó 100% a color
//  · quieto:     sin animación (solo logo gris): para la espera de código/dominio,
//                así la animación real arranca limpia desde 0 al entrar la página
//  · esperando:  todavía no se sabe de quién es el logo: se muestra solo la marca
const TAM = 150

function esHostPropio() {
  const h = (typeof window !== 'undefined' ? window.location.hostname : '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('golmebol.com') || h.endsWith('.vercel.app')
}

function identidadGuardada(tipo, id) {
  if (!id) return { name: '', logo_url: null }
  const propia = leerCacheRapido(`identidad_${tipo}_${id}`)
  let f = propia
  if (!f?.logo_url && tipo === 'torneo') {
    const delTorneo = leerCacheRapido(`torneo_${id}`)?.t
    const delInicio = (leerCacheRapido('landing_torneos') || []).find(x => String(x.id) === String(id))
    f = delTorneo || delInicio || propia
  }
  return f ? { name: f.name || '', logo_url: f.logo_url || null } : { name: '', logo_url: null }
}

function MarcaDeAgua() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 'max(18px, env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: .7, pointerEvents: 'none' }}>
      <img src="/marca/watermark-logo.png" alt="" style={{ height: 16, width: 'auto', display: 'block' }}/>
      <span style={{ fontSize: '.62rem', fontWeight: 600, letterSpacing: '.02em', color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap' }}>Creada por GOLMEBOL</span>
    </div>
  )
}

export default function PantallaCargaTorneo({ tipo = 'torneo', id, identidad, listo, onTerminar, quieto = false, esperando = false }) {
  const [ident, setIdent] = useState(() => (identidad?.logo_url || identidad?.name) ? { name: identidad.name || '', logo_url: identidad.logo_url || null } : identidadGuardada(tipo, id))
  const [buscando, setBuscando] = useState(() => !ident.logo_url && !!id)
  const colorRef = useRef(null)
  const pctRef = useRef(null)
  const listoRef = useRef(listo)
  const terminarRef = useRef(onTerminar)
  listoRef.current = listo
  terminarRef.current = onTerminar

  // Sin logo guardado: se pide solo nombre y logo, que es livianísimo.
  useEffect(() => {
    if (ident.logo_url || !id) { setBuscando(false); return }
    let vivo = true
    const q = tipo === 'organizador'
      ? supabase.from('organizador_perfiles').select('nombre_publico,logo_url').eq('organizador_id', id).maybeSingle()
      : supabase.from('tournaments').select('name,logo_url').eq('id', id).maybeSingle()
    q.then(({ data }) => {
      if (!vivo) return
      if (data) {
        const n = { name: (tipo === 'organizador' ? data.nombre_publico : data.name) || '', logo_url: data.logo_url || null }
        setIdent(n)
        guardarCacheRapido(`identidad_${tipo}_${id}`, n)
      }
      setBuscando(false)
    }).catch(() => { if (vivo) setBuscando(false) })
    return () => { vivo = false }
  }, [tipo, id])

  // Animación: avanza sola hacia ~88% mientras espera, y cuando llegan los
  // datos termina de llenarse rápido hasta 100%.
  useEffect(() => {
    if (quieto) return
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
  }, [quieto])

  const mostrarLogo = !esperando && (ident.logo_url || !buscando)
  const contenido = (color) => ident.logo_url
    ? <img src={ident.logo_url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none' }}/>
    : <GiSoccerBall style={{ width: '100%', height: '100%', color }}/>

  return (
    <div role="status" aria-label="Cargando" style={{ position: 'relative', minHeight: '100vh', background: '#07070e', color: '#fff', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 24, boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', width: TAM, height: TAM, opacity: mostrarLogo ? 1 : 0, transition: 'opacity .25s' }}>
        {/* base: blanco y negro */}
        <div style={{ position: 'absolute', inset: 0, filter: 'grayscale(1) brightness(.62) contrast(1.05)', opacity: .9 }}>
          {mostrarLogo && contenido('#8a8f98')}
        </div>
        {/* encima: a color, revelado de abajo hacia arriba */}
        <div ref={colorRef} style={{ position: 'absolute', inset: 0, clipPath: 'inset(100% 0 0 0)', willChange: 'clip-path', filter: 'drop-shadow(0 0 18px rgba(0,221,208,.28))' }}>
          {mostrarLogo && contenido('#00ddd0')}
        </div>
      </div>
      <div style={{ textAlign: 'center', minHeight: 44, opacity: mostrarLogo ? 1 : 0, transition: 'opacity .25s' }}>
        {ident.name && <div style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '.03em', marginBottom: 6 }}>{ident.name}</div>}
        {!quieto && <div ref={pctRef} style={{ color: '#00ddd0', fontSize: '.78rem', letterSpacing: '.2em', fontWeight: 700 }}>0%</div>}
      </div>
      {!esHostPropio() && <MarcaDeAgua/>}
    </div>
  )
}
