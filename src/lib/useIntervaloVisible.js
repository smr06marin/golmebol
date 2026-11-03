import { useEffect, useRef } from 'react'

// Igual que setInterval, pero SOLO trabaja mientras la pantalla está a la vista.
// Si la persona deja la pestaña en segundo plano o bloquea el celular, se detiene (no le pega a la base de datos
// para nada); al volver, refresca ya mismo si pasó más tiempo que el intervalo. `ms` = 0/null lo apaga.
export function useIntervaloVisible(fn, ms) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  useEffect(() => {
    if (!ms) return undefined
    let ultimo = Date.now()
    const ejecutar = () => { ultimo = Date.now(); try { if (ref.current) ref.current() } catch { /* se reintenta en el próximo ciclo */ } }
    const t = setInterval(() => { if (!document.hidden) ejecutar() }, ms)
    const alVolver = () => { if (!document.hidden && Date.now() - ultimo >= ms) ejecutar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver) }
  }, [ms])
}
