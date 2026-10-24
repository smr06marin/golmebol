// Horario de envío de notificaciones: SOLO entre las 10:00 am y las 10:00 pm
// de Colombia (UTC-5, sin horario de verano). Fuera de ese rango los avisos
// esperan en la cola y salen a partir de las 10:00 am.
export const HORA_INICIO = 10
export const HORA_FIN = 22
const DESFASE_COLOMBIA_H = -5

export function horaColombia(fecha = new Date()) {
  return (fecha.getUTCHours() + DESFASE_COLOMBIA_H + 24) % 24
}

export function enVentanaEnvio(fecha = new Date()) {
  const h = horaColombia(fecha)
  return h >= HORA_INICIO && h < HORA_FIN
}
