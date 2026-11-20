import { supabase } from './supabase'

// Consultas de la página de inicio que se pueden ADELANTAR: main.jsx las
// dispara apenas arranca la app (mientras todavía se baja el código de la
// página), y la página de inicio usa esa misma respuesta en vez de volver a
// pedirla. Así los torneos aparecen ~1 s antes la primera vez que se entra.

export const COLUMNAS_TORNEO_INICIO = 'id, name, logo_url, modalidad, city, pais, departamento, municipio_codigo, vereda, categoria, genero, season, created_at, archivado, torneo_padre_id, edicion'

const consultas = {
  torneos: () => Promise.resolve(supabase.from('tournaments').select(COLUMNAS_TORNEO_INICIO).eq('status', 'active')),
  resumen: () => Promise.resolve(supabase.rpc('resumen_torneos_inicio')),
}

const adelantadas = new Map() // clave → { promesa, t }

export function precargarInicio() {
  for (const clave of Object.keys(consultas)) {
    if (!adelantadas.has(clave)) adelantadas.set(clave, { promesa: consultas[clave](), t: Date.now() })
  }
}

// Devuelve la respuesta adelantada (si es de hace poco) o pide de nuevo. Cada adelantada se usa UNA vez.
export function pedirInicio(clave) {
  const a = adelantadas.get(clave)
  adelantadas.delete(clave)
  if (a && Date.now() - a.t < 20000) return a.promesa
  return consultas[clave]()
}
