// Confirmaciones propias de Golmebol (en vez del cuadro gris del navegador).
// Uso:  if (!(await confirmar('¿Archivar "Copa"? No se borra nada.'))) return
// El texto se parte solo: la pregunta (hasta el primer "?") es el título y lo
// que sigue es la explicación. El botón dice la acción ("Sí, archivar").
// Si por alguna razón no hay ventana montada, usa el confirm normal.

let escuchador = null
let montados = 0

export function registrarConfirmHost(fn) {
  escuchador = fn
  montados += fn ? 1 : -1
  if (!fn && montados < 0) montados = 0
}

const VERBOS_PELIGROSOS = /^(eliminar|borrar|quitar|sacar|bloquear|desactivar|cancelar|deshacer)/i

export function armarDialogo(texto) {
  const limpio = String(texto ?? '').trim()
  const m = limpio.match(/^(¿[^?]*\?)\s*([\s\S]*)$/)
  const titulo = m ? m[1] : '¿Continuar?'
  const detalle = m ? m[2].trim() : limpio
  const verbo = (m ? m[1].replace(/^¿\s*/, '') : '').split(/\s+/)[0]?.toLowerCase().replace(/[^a-záéíóúñ]/gi, '') || ''
  const esInfinitivo = /(ar|er|ir)$/.test(verbo) && verbo.length > 3
  return {
    titulo,
    detalle,
    si: esInfinitivo ? `Sí, ${verbo}` : 'Sí, continuar',
    peligro: esInfinitivo && VERBOS_PELIGROSOS.test(verbo),
  }
}

export function confirmar(texto) {
  if (!escuchador || montados <= 0) return Promise.resolve(window.confirm(texto))
  return new Promise(resolver => escuchador({ ...armarDialogo(texto), resolver }))
}
