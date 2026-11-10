// Abre el chat de ayuda de Golmebol (el mismo de siempre) con el mensaje ya escrito.
// - En las páginas públicas y del jugador responde ChatPublico.
// - Dentro del admin responde ChatSoporte.
// Solo uno de los dos está montado a la vez, así que mandar los dos avisos es seguro.
export function abrirChatAyuda(mensaje = '', { nombre = '', tema = 'otro' } = {}) {
  try {
    window.dispatchEvent(new CustomEvent('gm-abrir-chat-publico', { detail: { tema, mensaje, nombre } }))
    window.dispatchEvent(new CustomEvent('gm-abrir-chat-soporte', { detail: { mensaje } }))
  } catch { /* nada */ }
}
