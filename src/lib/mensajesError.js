// Mensajes de error entendibles para el organizador.
// El detalle técnico (códigos de la base, nombres de archivos .sql, etc.)
// NO se muestra en pantalla: se deja en la consola del navegador para
// quien administra Golmebol. El organizador solo ve qué pasó y qué hacer.

export function errorAmigable(error, accion = 'No se pudo completar la acción') {
  try { console.error('[Golmebol]', accion, error) } catch { /* sin consola */ }
  const texto = String(error?.message || error?.details || error || '').toLowerCase()
  const codigo = String(error?.code || '')
  // Jugador vetado de Golmebol (lo rechaza la base de datos al inscribirlo): se muestra su mensaje tal cual
  if (/vetado de golmebol/.test(texto)) return String(error?.message || '').trim()
  let causa
  if (/failed to fetch|network|timeout|timed out|load failed|conexi/.test(texto)) {
    causa = 'Parece un problema de conexión. Revisa tu internet e intenta de nuevo.'
  } else if (codigo === '42501' || /row-level security|permission denied|not authorized|jwt/.test(texto)) {
    causa = 'No tienes permiso para hacer esto. Si crees que es un error, avísale al administrador.'
  } else if (codigo === '23505' || /duplicate key|already exists/.test(texto)) {
    causa = 'Ese dato ya existe.'
  } else if (codigo === '23503' || /foreign key/.test(texto)) {
    causa = 'Todavía hay información que depende de esto.'
  } else if (codigo === '42703' || codigo === '42P01' || /does not exist|schema cache/.test(texto)) {
    causa = 'Esta opción todavía no está lista en tu cuenta. Avísale al administrador de Golmebol.'
  } else {
    causa = 'Intenta de nuevo. Si sigue pasando, avísale al administrador.'
  }
  return `${accion}. ${causa}`
}

// Cuando falta correr una migración SQL: el organizador no necesita saber
// el nombre del archivo, pero queda en la consola para quien administra.
export function avisoMigracion(archivo) {
  try { console.warn('[Golmebol] Falta correr la migración:', archivo) } catch { /* sin consola */ }
  return 'Esta opción todavía no está activada en tu cuenta. Avísale al administrador de Golmebol.'
}

export const TEXTO_OPCION_NO_ACTIVADA = 'Esta opción todavía no está activada en tu cuenta. Avísale al administrador de Golmebol.'
export const TEXTO_SIN_PERMISO = 'No tienes permiso para hacer esto. Si crees que es un error, avísale al administrador.'
