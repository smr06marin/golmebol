// Helpers compartidos para mostrar horas en formato 12h (AM/PM) en toda la
// plataforma. Las horas se siguen GUARDANDO en 24h (columnas 'HH:MM',
// <input type="time">, timestamps played_at, etc) — esto solo cambia cómo
// se muestran al usuario.

// Convierte un string de hora en 24h ('HH:MM' o 'HH:00') a 12h con AM/PM.
// Ej: '14:00' → '2:00 PM', '08:30' → '8:30 AM'.
export function fmtHora12(hora) {
  if (!hora) return ''
  const [hStr, mStr] = String(hora).split(':')
  const h = parseInt(hStr, 10)
  if (Number.isNaN(h)) return String(hora)
  const m = (mStr || '00').padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${m} ${ampm}`
}

// Convierte la hora de un Date (o un valor que Date() pueda parsear, como
// un timestamp ISO) a 12h con AM/PM. Arma el string a mano (en vez de
// toLocaleTimeString con hour12) para que quede 'PM'/'AM' igual que
// fmtHora12, no 'p. m.'/'a. m.' (que es lo que da el locale es-CO).
export function fmtHoraDate(fechaOIso) {
  const d = fechaOIso instanceof Date ? fechaOIso : new Date(fechaOIso)
  if (Number.isNaN(d.getTime())) return ''
  return fmtHora12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`)
}
