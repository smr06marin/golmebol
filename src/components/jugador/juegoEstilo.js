import { useEffect, useState } from 'react'

// ── Estilo "videojuego" para el inicio del jugador: colores, letras, animaciones ──
// Paneles con esquinas cortadas y borde luminoso, secciones que se despliegan al tocarlas, números que suben
// al abrir, barras que se llenan y la tarjeta flotando con rayos de luz.
// Letras: los TEXTOS van con la letra normal del celular (Roboto en Android, San Francisco en iPhone), que es la
// más fácil de leer. La letra de marcador (Bebas Neue) se usa SOLO para números grandes (marcadores, cifras).
// Todo es CSS liviano (transform/opacity), así que corre bien en celulares Android sencillos y en iPhone.
// Si el celular tiene "reducir movimiento" activado, las animaciones se apagan solas.
// Los componentes (Panel, Desplegable, botones, escudo…) están en juegoUI.jsx.

export const J = {
  bg: '#07090a',
  panel: 'linear-gradient(165deg, #171c18 0%, #111412 50%, #0c0e0d 100%)',
  linea: 'rgba(255,255,255,.09)',
  text: '#ffffff', text2: '#d2d8d3', muted: '#97a098',
  green: '#6fcf3d', greenLuz: '#9dff6a', greenDk: '#0a1a05',
  gold: '#f5b623', goldLuz: '#ffd866',
  red: '#ff5a52', gris: '#a3aba8',
  azul: '#4c8dff',
}

export const FT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"   // todos los textos
export const FD = "'Bebas Neue', Impact, 'Arial Narrow', sans-serif"                                    // solo números grandes

export const CSS_JUEGO = `
@keyframes gjFlota { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes gjRayos { to { transform: translate(-50%,-50%) rotate(360deg) } }
@keyframes gjEntra { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes gjAbre { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: none } }
@keyframes gjPulso { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes gjLlena { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes gjAro { 0% { box-shadow: 0 0 0 0 rgba(111,207,61,.7) } 100% { box-shadow: 0 0 0 12px rgba(111,207,61,0) } }
@keyframes gjBrillo { 0% { transform: translateX(-130%) skewX(-22deg) } 55%,100% { transform: translateX(260%) skewX(-22deg) } }
.gj-entra { animation: gjEntra .45s cubic-bezier(.2,.8,.2,1) both }
.gj-abre { animation: gjAbre .3s cubic-bezier(.2,.8,.2,1) both }
.gj-boton { transition: transform .12s ease, filter .12s ease; -webkit-tap-highlight-color: transparent }
.gj-boton:active { transform: scale(.98); filter: brightness(1.15) }
.gj-flecha { transition: transform .25s ease }
.gj-sin-barra::-webkit-scrollbar { display: none }
@media (prefers-reduced-motion: reduce) {
  .gj-anim, .gj-anim *, .gj-entra, .gj-abre { animation: none !important; transition: none !important }
}
`

const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Número que sube desde 0 al aparecer (como el marcador de un juego)
export function useContador(valor, ms = 900) {
  const final = Number(valor) || 0
  const [v, setV] = useState(() => (sinMovimiento() ? final : 0))
  useEffect(() => {
    let raf
    if (sinMovimiento() || final === 0) { raf = requestAnimationFrame(() => setV(final)); return () => cancelAnimationFrame(raf) }
    let t0 = null
    const paso = t => {
      if (t0 === null) t0 = t
      const k = Math.min(1, (t - t0) / ms)
      setV(Math.round(final * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [final, ms])
  return v
}

// Las secciones NO se recuerdan abiertas: cada vez que el jugador entra (o vuelve al inicio) todo aparece
// cerrado y limpio. Se borra lo que guardaba la versión anterior en el celular.
try { localStorage.removeItem('golmebol_inicio_abiertos') } catch { /* sin acceso, no pasa nada */ }

// Abre una sección desplegable desde otro lugar (p. ej. el botón de cámara de la tarjeta) y baja hasta ella
export function abrirSeccion(id) {
  try { window.dispatchEvent(new CustomEvent('gj-abrir', { detail: id })) } catch { /* navegador muy viejo */ }
  setTimeout(() => document.getElementById(`gj-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
}

export const recorte = c => `polygon(${c}px 0, 100% 0, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, 0 100%, 0 ${c}px)`
export const HEXAGONO = 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'
