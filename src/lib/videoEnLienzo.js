import { useEffect } from 'react'

// ── Video copiado a un lienzo (canvas) ──────────────────────────────────────
// Las apps de transmisión que ponen la página del overlay encima de la cámara (PRISM Live en el celular y algunas
// fuentes de navegador de OBS / PRISM Studio) "fotografían" la página para mandarla al en vivo, pero esa foto NO
// incluye el reproductor de video del sistema: el video salía como un PARCHE NEGRO y solo se oía el audio.
// Un lienzo sí sale en esa foto, así que cada cuadro del video se copia al lienzo, que queda exactamente encima
// del <video> (mismo lugar y tamaño). El <video> sigue debajo sonando (el audio sale de él). En un navegador
// normal se ve igual que antes.
//
// Uso: <video ref={videoRef} …/> y, en el MISMO contenedor (con position relative/absolute), justo después:
//      <canvas ref={lienzoRef} style={ESTILO_LIENZO}/>   y llamar useVideoEnLienzo(videoRef, lienzoRef).
export const ESTILO_LIENZO = { position: 'absolute', left: 0, top: 0, width: 0, height: 0, visibility: 'hidden', pointerEvents: 'none' }

export function useVideoEnLienzo(videoRef, lienzoRef) {
  useEffect(() => {
    const v = videoRef.current, cv = lienzoRef.current
    if (!v || !cv) return undefined
    const ctx = cv.getContext('2d')
    let raf = 0, vivo = true
    const dibujar = () => {
      if (!vivo) return
      if (v.readyState >= 2 && v.videoWidth && v.offsetWidth) {
        const st = cv.style
        st.left = v.offsetLeft + 'px'; st.top = v.offsetTop + 'px'
        st.width = v.offsetWidth + 'px'; st.height = v.offsetHeight + 'px'
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const w = Math.max(1, Math.round(v.offsetWidth * dpr)), h = Math.max(1, Math.round(v.offsetHeight * dpr))
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h }
        const k = Math.min(w / v.videoWidth, h / v.videoHeight)
        const dw = v.videoWidth * k, dh = v.videoHeight * k
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, w, h)
        try { ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh) } catch { /* cuadro no listo todavía */ }
        st.visibility = 'visible'
      }
      raf = requestAnimationFrame(dibujar)
    }
    raf = requestAnimationFrame(dibujar)
    return () => { vivo = false; cancelAnimationFrame(raf) }
  }, [videoRef, lienzoRef])
}
