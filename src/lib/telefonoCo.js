// Teléfonos de Colombia para mostrar y para armar enlaces de WhatsApp

// Solo dígitos, y con indicativo de Colombia (57) si vino un celular de 10 dígitos
export function digitosWhatsapp(numero) {
  let d = String(numero || '').replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('3')) d = '57' + d
  return d
}

// 3144705567 / 573144705567 / +57 314 470 5567  →  "314 470 5567"
export function telefonoBonito(numero) {
  let d = String(numero || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2)
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  return String(numero || '').trim()
}
