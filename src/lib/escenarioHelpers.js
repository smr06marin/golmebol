// Helpers compartidos por todas las páginas del módulo Escenarios Deportivos
// (tienda + canchas). Centralizados acá para no repetir la lógica de horarios/
// slots en cada página (Canchas, Solicitudes, Panel, página pública, etc).

export function fmtMoney(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }

export function todayStr() { return new Date().toISOString().slice(0, 10) }

export function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
}

// Horas del día según la config de apertura/cierre del escenario (default 8-22 si aún no tiene config).
export function getHours(escenario) {
  const apertura = escenario?.hora_apertura ?? 8
  const cierre = escenario?.hora_cierre ?? 22
  const arr = []
  for (let h = apertura; h < cierre; h++) arr.push(String(h).padStart(2, '0') + ':00')
  return arr
}

function horaEnRango(hora, r) {
  const inicio = parseInt(r.hora, 10)
  const fin = inicio + Math.ceil((r.duracion || 60) / 60)
  const h = parseInt(hora, 10)
  return h >= inicio && h < fin
}

// Estado de un horario puntual: 'libre' | 'pendiente' | 'ocupado'
export function slotEstado(reservas, cancha, fecha, hora) {
  const rs = (reservas || []).filter(r => r.cancha === cancha && r.fecha === fecha && horaEnRango(hora, r))
  if (rs.some(r => r.estado === 'aceptada' || r.estado === 'mantenimiento')) return 'ocupado'
  if (rs.some(r => r.estado === 'pendiente')) return 'pendiente'
  return 'libre'
}

export function allSlotsForDate(escenario, reservas, fecha) {
  const slots = []
  ;['futbol5', 'futbol7'].forEach(cancha => {
    getHours(escenario).forEach(h => {
      slots.push({ cancha, hora: h, estado: slotEstado(reservas, cancha, fecha, h) })
    })
  })
  return slots
}

export function precioCancha(escenario, cancha) {
  return cancha === 'futbol5' ? (escenario?.precio_futbol5 ?? 60000) : (escenario?.precio_futbol7 ?? 90000)
}
