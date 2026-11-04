// Envío de mensajes por la API oficial de WhatsApp (Meta Cloud API).
// Variables de entorno en Vercel (servidor, NUNCA con prefijo VITE_):
//   WHATSAPP_TOKEN        token permanente del "usuario del sistema" de Meta
//   WHATSAPP_PHONE_ID     "Identificador del número de teléfono" de la línea de soporte
//   SOPORTE_WA_DESTINO    TU número de WhatsApp con código de país, sin + (ej: 573001234567)
//   SOPORTE_PLANTILLA     (opcional) nombre de la plantilla aprobada para avisarte cuando pasaron
//                         más de 24 h desde tu último mensaje a la línea (ej: soporte_nuevo_mensaje)

const VERSION = 'v21.0'

export const soloDigitos = t => String(t || '').replace(/\D/g, '')
export const destinoSoporte = () => soloDigitos(process.env.SOPORTE_WA_DESTINO)

export function waConfigurado() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && destinoSoporte())
}

async function llamar(cuerpo) {
  const r = await fetch(`https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: destinoSoporte(), ...cuerpo }),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(json?.error?.message || `WhatsApp respondió ${r.status}`)
    e.codigo = json?.error?.code
    throw e
  }
  return json?.messages?.[0]?.id || null
}

export const enviarTexto = (texto, citarId) =>
  llamar({ type: 'text', text: { body: String(texto).slice(0, 3800), preview_url: false }, ...(citarId ? { context: { message_id: citarId } } : {}) })

// Las variables de una plantilla no admiten saltos de línea ni espacios repetidos
const limpiarVar = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 600) || '-'
export const enviarPlantilla = (nombre, variables, idioma = 'es') =>
  llamar({ type: 'template', template: { name: nombre, language: { code: idioma }, components: [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: limpiarVar(v) })) }] } })
