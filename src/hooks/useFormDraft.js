import { useEffect, useRef } from 'react'

// Cuando el celular pasa la pestaña a segundo plano (por ejemplo al abrir
// WhatsApp) y se demora un rato, el navegador puede matar la página para
// liberar memoria — al volver, la recarga desde cero y todo lo que estaba
// escrito en un formulario (useState en memoria) se pierde. Este hook guarda
// automáticamente el formulario en localStorage mientras se llena, y lo
// restaura solo si vuelve a encontrar un borrador guardado.
//
// Uso:
//   const [form, setForm] = useState(EMPTY)
//   useFormDraft('draft_crear_equipo', form, setForm)
//   ...
//   // al guardar con éxito:
//   limpiarBorrador('draft_crear_equipo')
//
// `skip: true` desactiva el guardado/restauración (útil mientras se está
// EDITANDO un registro existente, para no pisar los datos reales con un
// borrador viejo de una creación anterior).
export function useFormDraft(key, value, setValue, { skip = false } = {}) {
  const restaurado = useRef(false)

  useEffect(() => {
    if (skip || restaurado.current) return
    restaurado.current = true
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft && typeof draft === 'object') setValue(prev => ({ ...prev, ...draft }))
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip])

  useEffect(() => {
    if (skip || !restaurado.current) return
    try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value, skip])
}

export function limpiarBorrador(key) {
  try { localStorage.removeItem(key) } catch (e) {}
}
