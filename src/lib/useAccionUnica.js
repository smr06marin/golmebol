// Evita doble clic / doble envío en botones que guardan o crean algo (ej:
// "Vender", "Crear equipo", "Guardar"). Si el usuario le da varias veces
// mientras la primera todavía está cargando (por internet lento, etc), NO
// se repite la acción — usa un ref (no state) para que el bloqueo sea
// inmediato, sin esperar a que React vuelva a renderizar.
//
// Uso:
//   const [enviando, conGuardaUnica] = useAccionUnica()
//   ...
//   <button disabled={enviando} onClick={conGuardaUnica(handleGuardar)}>
//     {enviando ? 'Guardando...' : 'Guardar'}
//   </button>
//
// O si el handler ya está definido aparte:
//   const handleGuardarSeguro = conGuardaUnica(handleGuardar)
//   <button disabled={enviando} onClick={handleGuardarSeguro}>Guardar</button>
import { useCallback, useRef, useState } from 'react'

export function useAccionUnica() {
  const [enviando, setEnviando] = useState(false)
  const enCursoRef = useRef(false)

  const conGuardaUnica = useCallback((fn) => {
    return async (...args) => {
      if (enCursoRef.current) return
      enCursoRef.current = true
      setEnviando(true)
      try {
        return await fn(...args)
      } finally {
        enCursoRef.current = false
        setEnviando(false)
      }
    }
  }, [])

  return [enviando, conGuardaUnica]
}
