// ⚠️ ARCHIVO RETIRADO — ya no se usa ni se importa desde ninguna parte.
//
// Esta página (ruta /predix) era una mesa de apuestas 1x1 duplicada: hacía
// lo mismo que la pestaña "Apuestas abiertas" dentro de /jugador/apuestas
// (PlayerApuestasPage.jsx), pero con sus propias tablas (predix_apuestas /
// predix_cruces), sin el tope de saldo, sin filtro de "no puedes apostar en
// tu propio partido" y sin conexión al sistema de suscripciones Predix.
//
// Se dejó de usar el 2026-07-19 (fase 2 de suscripciones Predix). Las tablas
// predix_apuestas y predix_cruces se eliminan en
// migracion_predix_fase2_limpieza.sql.
//
// No se pudo borrar este archivo del repo por permisos — puedes eliminarlo
// tú manualmente (botón derecho → eliminar) sin que rompa nada; no lo
// importa ningún otro archivo.
export default function PredixApuestasPageRetirado() {
  return null
}
