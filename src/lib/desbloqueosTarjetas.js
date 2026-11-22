// Desbloqueo de tarjetas y su premio — compartido entre la pestaña "Desbloqueos" del administrador,
// el número rojo del menú del admin y la tarjeta del jugador (CardProgressSection).

export const PLAZO_PREMIO_MS = 3 * 24 * 3600 * 1000            // 3 días para reclamar el premio
export const CLAVE_VISTO_DESBLOQUEOS = 'gm_admin_desbloqueos_visto' // última vez que el admin abrió la pestaña

// d: { da_premio, completa, entregado, reclamado } (fila de admin_desbloqueos_tarjetas)
// El premio se gana al romper LOS 5 logros de la tarjeta (d.completa = cuándo) y se reclama dentro de 3 días.
// → 'sin_premio' | 'sin_completar' | 'entregado' | 'reclamado' | 'en_plazo' | 'vencido'
export function estadoPremio(d, ahora = Date.now()) {
  if (!d || d.da_premio === false) return 'sin_premio'
  if (d.entregado) return 'entregado'
  if (d.reclamado) return 'reclamado'
  if (!d.completa) return 'sin_completar'
  const t = Date.parse(d.completa) || 0
  return ahora - t > PLAZO_PREMIO_MS ? 'vencido' : 'en_plazo'
}

// Cuánto tiempo le queda para reclamar: "2 días y 5 horas", "5 horas", o null si ya se venció
export function tiempoParaReclamar(fecha, ahora = Date.now()) {
  const ms = (Date.parse(fecha) || 0) + PLAZO_PREMIO_MS - ahora
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000)
  if (d > 0) return `${d} día${d === 1 ? '' : 's'}${h ? ` y ${h} hora${h === 1 ? '' : 's'}` : ''}`
  if (h > 0) return `${h} hora${h === 1 ? '' : 's'}`
  return `${Math.max(1, Math.floor(ms / 60000))} minutos`
}

