// ── Confeti y fuegos artificiales (sin librerías) ───────────────────────────
// celebrar('confeti' | 'fuegos' | 'ambos'): dibuja la celebración en un lienzo que se pone ENCIMA de la página por
// unos segundos y después se quita solo. No bloquea los toques (pointer-events: none), funciona igual en Android y en
// iPhone, y si el celular tiene activado "reducir movimiento" no se muestra.
const DORADOS = ['#f7d774', '#ffd54a', '#fff1b8', '#c9971c', '#ffffff', '#ffb703', '#e9eef5']
const FUEGOS = ['#ffd54a', '#ff5a52', '#7fd3ff', '#ffffff', '#b388ff', '#6fcf3d', '#ff9f43']

let activa = null // una celebración a la vez

export function celebrar(modo = 'confeti', { duracion = 4800, colores } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return } catch { /* nada */ }
  if (activa) activa()

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cv = document.createElement('canvas')
  cv.setAttribute('aria-hidden', 'true')
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000'
  document.body.appendChild(cv)
  const ctx = cv.getContext('2d')
  let W = 0, H = 0
  const medir = () => { W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
  medir()
  window.addEventListener('resize', medir)

  const azar = (a, b) => a + Math.random() * (b - a)
  const paleta = colores && colores.length ? colores : DORADOS
  const papeles = []
  const chispas = []
  const cohetes = []

  const conConfeti = modo === 'confeti' || modo === 'ambos'
  const conFuegos = modo === 'fuegos' || modo === 'ambos'

  if (conConfeti) {
    const n = Math.round(Math.min(220, Math.max(110, W / 3)))
    for (let i = 0; i < n; i++) {
      // la mitad cae desde arriba; la otra mitad sale disparada desde las dos esquinas de abajo
      const desdeArriba = i % 2 === 0
      const izq = i % 4 === 1
      papeles.push({
        x: desdeArriba ? azar(0, W) : (izq ? azar(-10, W * 0.1) : azar(W * 0.9, W + 10)),
        y: desdeArriba ? azar(-H * 0.6, -10) : H + 10,
        vx: desdeArriba ? azar(-1.2, 1.2) : (izq ? azar(2.5, 7) : azar(-7, -2.5)),
        vy: desdeArriba ? azar(1.5, 3.5) : azar(-16, -10),
        w: azar(6, 11), h: azar(9, 16), giro: azar(0, Math.PI * 2), vgiro: azar(-0.2, 0.2),
        balanceo: azar(0, Math.PI * 2), color: paleta[(Math.random() * paleta.length) | 0],
        retraso: desdeArriba ? 0 : azar(0, 600), forma: Math.random() < 0.25 ? 'circulo' : 'papel',
      })
    }
  }

  let proximoCohete = 0, cohetesLanzados = 0
  const maxCohetes = modo === 'ambos' ? 6 : 9
  const lanzarCohete = () => {
    cohetes.push({ x: azar(W * 0.15, W * 0.85), y: H + 5, vy: azar(-11.5, -9), alto: azar(H * 0.18, H * 0.45), color: FUEGOS[(Math.random() * FUEGOS.length) | 0] })
    cohetesLanzados++
  }
  const explotar = (c) => {
    const n = 70
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, vel = azar(2, 6.5)
      chispas.push({ x: c.x, y: c.y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: 1, color: Math.random() < 0.8 ? c.color : '#ffffff' })
    }
  }

  const inicio = performance.now()
  let ultimo = inicio, raf = 0, terminado = false
  const fin = () => {
    if (terminado) return
    terminado = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', medir)
    cv.remove()
    if (activa === fin) activa = null
  }
  activa = fin

  const cuadro = (ahora) => {
    const t = ahora - inicio
    const dt = Math.min(2.5, (ahora - ultimo) / 16.67) // 1 = un cuadro a 60 fps
    ultimo = ahora
    ctx.clearRect(0, 0, W, H)
    const desvanecer = t > duracion - 900 ? Math.max(0, (duracion - t) / 900) : 1

    // Fuegos artificiales
    if (conFuegos && cohetesLanzados < maxCohetes && t >= proximoCohete && t < duracion - 1400) {
      lanzarCohete()
      proximoCohete = t + azar(380, 700)
    }
    for (let i = cohetes.length - 1; i >= 0; i--) {
      const c = cohetes[i]
      c.y += c.vy * dt; c.vy *= 0.985
      ctx.globalAlpha = desvanecer
      ctx.fillStyle = c.color
      ctx.beginPath(); ctx.arc(c.x, c.y, 2.4, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 0.35 * desvanecer
      ctx.fillRect(c.x - 1, c.y, 2, 16)
      if (c.y <= c.alto || c.vy > -2) { explotar(c); cohetes.splice(i, 1) }
    }
    for (let i = chispas.length - 1; i >= 0; i--) {
      const p = chispas[i]
      p.x += p.vx * dt; p.y += p.vy * dt
      p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.07 * dt
      p.vida -= 0.012 * dt
      if (p.vida <= 0) { chispas.splice(i, 1); continue }
      ctx.globalAlpha = Math.max(0, p.vida) * desvanecer
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2); ctx.fill()
    }

    // Confeti
    for (const p of papeles) {
      if (t < p.retraso) continue
      p.vy = Math.min(p.vy + 0.18 * dt, 3.8)
      p.vx *= 0.99
      p.balanceo += 0.08 * dt
      p.x += (p.vx + Math.sin(p.balanceo) * 0.8) * dt
      p.y += p.vy * dt
      p.giro += p.vgiro * dt
      if (p.y > H + 30) continue
      ctx.save()
      ctx.globalAlpha = desvanecer
      ctx.translate(p.x, p.y)
      ctx.rotate(p.giro)
      ctx.fillStyle = p.color
      if (p.forma === 'circulo') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill() }
      else ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.balanceo)), p.w, p.h * Math.abs(Math.cos(p.balanceo)) + 1)
      ctx.restore()
    }
    ctx.globalAlpha = 1

    if (t < duracion) raf = requestAnimationFrame(cuadro)
    else fin()
  }
  raf = requestAnimationFrame(cuadro)
  return fin
}
