// Dirección de las funciones del servidor (carpeta /api de Vercel).
// En la web normal basta la ruta relativa ("/api/..."): el navegador la manda
// al mismo dominio. Dentro de la APP (Android/iOS con Capacitor) la web corre
// desde el propio celular, así que una ruta relativa NO llega a Vercel: hay que
// usar el dominio completo.
import { Capacitor } from '@capacitor/core'

const DOMINIO_SERVIDOR = 'https://golmebol.com'

export function apiUrl(ruta) {
  return (Capacitor.isNativePlatform() ? DOMINIO_SERVIDOR : '') + ruta
}
